from __future__ import annotations

import uuid

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
    VerifyAccountRequest,
    VerifyAccountResponse,
)
from app.services.meta_publisher import (
    MetaPublishingError,
    exchange_long_lived_token,
    verify_instagram_account,
)
from app.services.tenant_service import get_client_for_agency

router = APIRouter(
    prefix="/agencies/{agency_id}/clients/{client_id}/social-accounts",
    tags=["social-accounts"],
)


@router.get("", response_model=list[ClientSocialAccountOut])
async def list_client_social_accounts(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientSocialAccountOut]:
    """List all connected social accounts for a specific client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(ClientSocialAccount)
        .where(ClientSocialAccount.client_id == client_id)
        .order_by(ClientSocialAccount.created_at.desc())
    )
    accounts = result.scalars().all()
    return [ClientSocialAccountOut.model_validate(a) for a in accounts]


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

    if account is not None:
        account.account_name = name or account.account_name
        account.account_handle = handle or account.account_handle
        account.instagram_business_id = payload.instagram_business_id or account.instagram_business_id
        account.facebook_page_id = payload.facebook_page_id or account.facebook_page_id
        account.access_token = payload.access_token
        account.token_expires_at = payload.token_expires_at
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
            token_expires_at=payload.token_expires_at,
            is_active=True,
        )
        db.add(account)

    await db.commit()
    await db.refresh(account)
    return ClientSocialAccountOut.model_validate(account)


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
