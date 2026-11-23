from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import require_agency_member
from app.models.client_social_account import ClientSocialAccount
from app.models.user import Membership
from app.schemas.social import (
    ClientSocialAccountCreate,
    ClientSocialAccountOut,
    ExchangeTokenRequest,
    ExchangeTokenResponse,
    MetaConnectSelectedRequest,
    MetaInstagramAccount,
    MetaOAuthUrlResponse,
    MetaPageOption,
    MetaResolveCodeRequest,
    MetaResolveCodeResponse,
    VerifyAccountRequest,
    VerifyAccountResponse,
)
from app.services.meta_publisher import (
    MetaPublishingError,
    exchange_code_for_user_token,
    exchange_long_lived_token,
    get_user_pages_and_instagram,
    verify_instagram_account,
)
from app.core.config import settings
from app.services.tenant_service import get_client_for_agency

router = APIRouter(
    prefix="/agencies/{agency_id}/clients/{client_id}/social-accounts",
    tags=["social-accounts"],
)


def compute_token_health(account: ClientSocialAccount) -> tuple[str, int | None, bool, str, datetime | None]:
    """Compute active, expiring_soon, or expired status and days remaining for Meta OAuth token."""
    now = datetime.now(timezone.utc)
    expires_at = account.token_expires_at
    if not expires_at:
        # Standard Meta long-lived tokens have a 60-day shelf life from last update
        base_time = account.updated_at or account.created_at or now
        expires_at = base_time + timedelta(days=60)

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    delta = expires_at - now
    days = int(delta.total_seconds() // 86400)

    if delta.total_seconds() <= 0:
        return (
            "expired",
            0,
            True,
            "Token expired — Reconnect to resume scheduled publishing",
            expires_at,
        )
    elif days <= 14:
        msg = f"Token expiring in {max(1, days)} day{'s' if days != 1 else ''} — Reconnect soon"
        return (
            "expiring_soon",
            max(0, days),
            False,
            msg,
            expires_at,
        )
    else:
        return (
            "active",
            days,
            False,
            f"Token active (valid for {days} days)",
            expires_at,
        )


def format_social_account_out(account: ClientSocialAccount) -> ClientSocialAccountOut:
    status_str, days_rem, is_exp, msg, exp_date = compute_token_health(account)
    out = ClientSocialAccountOut.model_validate(account)
    out.token_status = status_str
    out.days_remaining = days_rem
    out.is_expired = is_exp
    out.health_message = msg
    out.token_expires_at = exp_date or account.token_expires_at
    return out


@router.get("", response_model=list[ClientSocialAccountOut])
async def list_client_social_accounts(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientSocialAccountOut]:
    """List all connected social accounts for a specific client with computed token health."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(ClientSocialAccount)
        .where(ClientSocialAccount.client_id == client_id)
        .order_by(ClientSocialAccount.created_at.desc())
    )
    accounts = result.scalars().all()
    return [format_social_account_out(a) for a in accounts]


@router.get("/{account_id}/health", response_model=ClientSocialAccountOut)
async def check_social_account_health(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    account_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientSocialAccountOut:
    """Check health and expiration status for a specific connected social account."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.id == account_id,
            ClientSocialAccount.client_id == client_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return format_social_account_out(account)


@router.post("", response_model=ClientSocialAccountOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_client_social_account(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientSocialAccountCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientSocialAccountOut:
    """
    Connect or update a social account (Instagram or Facebook) for a client.
    Replaces existing account for the same platform if one already exists.
    """
    client = await get_client_for_agency(client_id, agency_id, db)

    # If handle or name was not provided, attempt to verify and fetch from Meta
    handle = payload.account_handle
    name = payload.account_name
    if payload.platform == "instagram" and payload.instagram_business_id:
        try:
            details = await verify_instagram_account(payload.access_token, payload.instagram_business_id)
            if not handle and details.get("username"):
                handle = f"@{details['username']}"
            if not name and details.get("name"):
                name = details["name"]
        except Exception:
            # If verification fails, still allow saving with manual fields
            pass

    # Check for existing account on this platform
    existing = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.client_id == client_id,
            ClientSocialAccount.platform == payload.platform,
        )
    )
    account = existing.scalar_one_or_none()

    token_exp = payload.token_expires_at or (datetime.now(timezone.utc) + timedelta(days=60))
    if account is not None:
        account.account_name = name or account.account_name
        account.account_handle = handle or account.account_handle
        account.instagram_business_id = payload.instagram_business_id or account.instagram_business_id
        account.facebook_page_id = payload.facebook_page_id or account.facebook_page_id
        account.access_token = payload.access_token
        account.token_expires_at = token_exp
        account.is_active = True
    else:
        account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client_id,
            platform=payload.platform,
            account_name=name or client.business_name,
            account_handle=handle,
            instagram_business_id=payload.instagram_business_id,
            facebook_page_id=payload.facebook_page_id,
            access_token=payload.access_token,
            token_expires_at=token_exp,
            is_active=True,
        )
        db.add(account)

    await db.commit()
    await db.refresh(account)

    # Automatically trigger background historical backfill
    try:
        import asyncio
        from app.services.analytics_engine import run_background_backfill
        asyncio.create_task(run_background_backfill(client_id, limit=50, days=180))
    except Exception:
        pass

    return format_social_account_out(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_client_social_account(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    account_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Disconnect and delete a client social account."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.id == account_id,
            ClientSocialAccount.client_id == client_id,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social account not found.")
    await db.delete(account)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify", response_model=VerifyAccountResponse)
async def verify_account_credentials(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: VerifyAccountRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> VerifyAccountResponse:
    """Test and verify an Instagram Business ID & access token with Meta Graph API."""
    await get_client_for_agency(client_id, agency_id, db)
    try:
        data = await verify_instagram_account(payload.access_token, payload.instagram_business_id)
        return VerifyAccountResponse(
            id=str(data.get("id", payload.instagram_business_id)),
            username=data.get("username"),
            name=data.get("name"),
            profile_picture_url=data.get("profile_picture_url"),
        )
    except MetaPublishingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/exchange-token", response_model=ExchangeTokenResponse)
async def exchange_token_for_long_lived(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ExchangeTokenRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ExchangeTokenResponse:
    """Exchange a short-lived user token for a 60-day Long-Lived User Token."""
    await get_client_for_agency(client_id, agency_id, db)
    try:
        data = await exchange_long_lived_token(
            payload.app_id, payload.app_secret, payload.short_lived_token
        )
        return ExchangeTokenResponse(
            access_token=data["access_token"],
            token_type=data.get("token_type", "bearer"),
            expires_in=data.get("expires_in"),
        )
    except MetaPublishingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/meta/oauth-url", response_model=MetaOAuthUrlResponse)
async def get_meta_oauth_url(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    redirect_uri: str,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> MetaOAuthUrlResponse:
    """Construct and return the Meta OAuth 2.0 authorization dialog URL."""
    await get_client_for_agency(client_id, agency_id, db)
    app_id = settings.META_APP_ID
    if not app_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="META_APP_ID is not configured in backend.",
        )
    
    version = getattr(settings, "META_GRAPH_API_VERSION", "v22.0")
    scopes = [
        "pages_show_list",
        "pages_read_engagement",
        "pages_read_user_content",
        "pages_manage_posts",
        "pages_manage_engagement",
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_messages",
        "instagram_manage_insights",
        "instagram_manage_engagement",
        "business_management",
    ]
    scope_str = ",".join(scopes)
    import urllib.parse
    state_payload = urllib.parse.quote(f"{agency_id}:{client_id}")
    encoded_redirect = urllib.parse.quote(redirect_uri, safe="")
    
    oauth_url = (
        f"https://www.facebook.com/{version}/dialog/oauth"
        f"?client_id={app_id}"
        f"&redirect_uri={encoded_redirect}"
        f"&scope={scope_str}"
        f"&state={state_payload}"
        f"&response_type=code"
        f"&auth_type=rerequest"
    )
    return MetaOAuthUrlResponse(oauth_url=oauth_url, client_id=app_id, redirect_uri=redirect_uri)


@router.post("/meta/resolve-code", response_model=MetaResolveCodeResponse)
async def resolve_meta_oauth_code(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: MetaResolveCodeRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> MetaResolveCodeResponse:
    """Exchange Meta OAuth code for accounts (Facebook Pages + linked Instagram Business profiles)."""
    await get_client_for_agency(client_id, agency_id, db)
    try:
        # 1. Exchange code for user token
        token_data = await exchange_code_for_user_token(
            code=payload.code,
            redirect_uri=payload.redirect_uri,
        )
        user_access_token = token_data["access_token"]
        
        # 2. Upgrade to 60-day Long-Lived User Token
        try:
            long_lived = await exchange_long_lived_token(
                settings.META_APP_ID,
                settings.META_APP_SECRET,
                user_access_token,
            )
            user_access_token = long_lived.get("access_token", user_access_token)
        except Exception:
            pass  # Fall back to token if exchange fails
            
        # 3. Fetch managed Facebook Pages and linked Instagram accounts
        accounts_data = await get_user_pages_and_instagram(user_access_token)
        
        pages_out: list[MetaPageOption] = []
        for p in accounts_data:
            page_id = str(p.get("id"))
            page_name = p.get("name", "Facebook Page")
            page_token = p.get("access_token", user_access_token)
            ig_raw = p.get("instagram_business_account")
            ig_acc: MetaInstagramAccount | None = None
            if ig_raw and isinstance(ig_raw, dict):
                ig_acc = MetaInstagramAccount(
                    id=str(ig_raw.get("id")),
                    username=ig_raw.get("username"),
                    name=ig_raw.get("name"),
                    profile_picture_url=ig_raw.get("profile_picture_url"),
                )
            pages_out.append(
                MetaPageOption(
                    page_id=page_id,
                    page_name=page_name,
                    page_access_token=page_token,
                    instagram_business_account=ig_acc,
                )
            )
        return MetaResolveCodeResponse(pages=pages_out)
    except MetaPublishingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/meta/connect-selected", response_model=list[ClientSocialAccountOut])
async def connect_selected_meta_accounts(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: MetaConnectSelectedRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientSocialAccountOut]:
    """Save selected Facebook Page and/or Instagram account to client."""
    client = await get_client_for_agency(client_id, agency_id, db)
    saved_accounts: list[ClientSocialAccount] = []
    
    default_expiry = datetime.now(timezone.utc) + timedelta(days=60)

    # 1. Connect Facebook Page if requested
    if payload.connect_facebook and payload.page_id:
        fb_existing = await db.execute(
            select(ClientSocialAccount).where(
                ClientSocialAccount.client_id == client_id,
                ClientSocialAccount.platform == "facebook",
            )
        )
        fb_acc = fb_existing.scalar_one_or_none()
        if fb_acc:
            fb_acc.account_name = payload.page_name
            fb_acc.facebook_page_id = payload.page_id
            fb_acc.access_token = payload.page_access_token
            fb_acc.token_expires_at = default_expiry
            fb_acc.is_active = True
        else:
            fb_acc = ClientSocialAccount(
                id=uuid.uuid4(),
                client_id=client_id,
                platform="facebook",
                account_name=payload.page_name,
                facebook_page_id=payload.page_id,
                access_token=payload.page_access_token,
                token_expires_at=default_expiry,
                is_active=True,
            )
            db.add(fb_acc)
        saved_accounts.append(fb_acc)
        
    # 2. Connect Instagram Account if requested
    if payload.connect_instagram and payload.instagram_business_id:
        ig_existing = await db.execute(
            select(ClientSocialAccount).where(
                ClientSocialAccount.client_id == client_id,
                ClientSocialAccount.platform == "instagram",
            )
        )
        ig_acc = ig_existing.scalar_one_or_none()
        handle = f"@{payload.instagram_username}" if payload.instagram_username else None
        if ig_acc:
            ig_acc.account_name = payload.instagram_username or payload.page_name
            ig_acc.account_handle = handle
            ig_acc.instagram_business_id = payload.instagram_business_id
            ig_acc.facebook_page_id = payload.page_id
            ig_acc.access_token = payload.page_access_token
            ig_acc.token_expires_at = default_expiry
            ig_acc.is_active = True
        else:
            ig_acc = ClientSocialAccount(
                id=uuid.uuid4(),
                client_id=client_id,
                platform="instagram",
                account_name=payload.instagram_username or payload.page_name,
                account_handle=handle,
                instagram_business_id=payload.instagram_business_id,
                facebook_page_id=payload.page_id,
                access_token=payload.page_access_token,
                token_expires_at=default_expiry,
                is_active=True,
            )
            db.add(ig_acc)
        saved_accounts.append(ig_acc)
        
    await db.commit()
    for acc in saved_accounts:
        await db.refresh(acc)

    # Automatically trigger background historical backfill
    try:
        import asyncio
        from app.services.analytics_engine import run_background_backfill
        asyncio.create_task(run_background_backfill(client_id, limit=100, days=180))
    except Exception:
        pass

    return [format_social_account_out(a) for a in saved_accounts]

