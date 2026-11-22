from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.social_comment import (
    CommentSentiment,
    EngagementStatus,
    SocialComment,
    SocialConversation,
    SocialMessage,
)
from app.models.user import Membership, User
from app.schemas.engagement import (
    AIReplyOption,
    CommentAIResponseRequest,
    CommentAIResponseResponse,
    CommentReplyRequest,
    EngagementStatsOut,
    EngagementSyncResponse,
    SendMessageRequest,
    SocialCommentOut,
    SocialConversationOut,
    SocialMessageOut,
    TokenPermissionsOut,
)
from app.services.engagement_service import (
    sync_client_social_engagement,
    triage_social_comment_llm,
)
from app.services.meta_publisher import (
    get_token_permissions,
    hide_instagram_comment,
    like_instagram_comment,
    reply_to_instagram_comment,
    send_instagram_dm,
)
from app.services.tenant_service import get_client_for_agency

router = APIRouter(
    prefix="/agencies/{agency_id}/engagement",
    tags=["engagement"],
)


@router.get("/comments", response_model=list[SocialCommentOut])
async def list_social_comments(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    platform: str | None = Query(None),
    sentiment: CommentSentiment | None = Query(None),
    engagement_status: EngagementStatus | None = Query(None, alias="status"),
    urgency: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[SocialCommentOut]:
    """
    List social comments for agency with filters for sentiment, intent, status, and client.
    """
    query = (
        select(SocialComment, Client.business_name.label("client_name"))
        .join(Client, SocialComment.client_id == Client.id)
        .where(SocialComment.agency_id == agency_id)
    )

    if client_id:
        query = query.where(SocialComment.client_id == client_id)
    if platform and platform.lower() != "all":
        query = query.where(func.lower(SocialComment.platform) == platform.lower())
    if sentiment:
        query = query.where(SocialComment.sentiment == sentiment)
    if engagement_status:
        query = query.where(SocialComment.status == engagement_status)
    if urgency and urgency.lower() != "all":
        query = query.where(SocialComment.urgency == urgency)
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(SocialComment.comment_text).like(q)
            | func.lower(SocialComment.author_username).like(q)
        )

    query = query.order_by(SocialComment.commented_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    out: list[SocialCommentOut] = []
    for comment, c_name in rows:
        item = SocialCommentOut.model_validate(comment)
        item.client_name = c_name
        if comment.ai_suggested_reply_options:
            try:
                raw_opts = json.loads(comment.ai_suggested_reply_options)
                item.ai_suggested_reply_options = [
                    o.get("reply", "") if isinstance(o, dict) else str(o)
                    for o in raw_opts
                ]
            except Exception:
                pass
        out.append(item)

    return out


@router.get("/conversations", response_model=list[SocialConversationOut])
async def list_social_conversations(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    engagement_status: EngagementStatus | None = Query(None, alias="status"),
    search: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[SocialConversationOut]:
    """
    List Instagram Direct Message conversations.
    """
    query = (
        select(SocialConversation, Client.business_name.label("client_name"))
        .join(Client, SocialConversation.client_id == Client.id)
        .where(SocialConversation.agency_id == agency_id)
    )

    if client_id:
        query = query.where(SocialConversation.client_id == client_id)
    if engagement_status:
        query = query.where(SocialConversation.status == engagement_status)
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(SocialConversation.participant_username).like(q)
            | func.lower(SocialConversation.last_message_text).like(q)
        )

    query = query.order_by(SocialConversation.last_message_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    out: list[SocialConversationOut] = []
    for conv, c_name in rows:
        item = SocialConversationOut.model_validate(conv)
        item.client_name = c_name
        sorted_messages = sorted(conv.messages, key=lambda m: m.sent_at)
        item.messages = [SocialMessageOut.model_validate(m) for m in sorted_messages]
        out.append(item)

    return out


@router.post("/sync", response_model=EngagementSyncResponse)
async def sync_engagement_feed(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> EngagementSyncResponse:
    """
    Trigger live synchronization of comments and DMs from Meta Graph API.
    Runs Nemotron 8B intent & sentiment triage on all new incoming items.
    """
    total_comments = 0
    total_convs = 0
    dm_warning: str | None = None

    if client_id:
        res = await sync_client_social_engagement(agency_id, client_id, db)
        total_comments += res["comments_synced"]
        total_convs += res["conversations_synced"]
        if res.get("dm_warning"):
            dm_warning = res["dm_warning"]
    else:
        # Sync across all clients in the agency that have connected social accounts
        clients_res = await db.execute(
            select(Client.id)
            .join(ClientSocialAccount, ClientSocialAccount.client_id == Client.id)
            .where(Client.agency_id == agency_id, ClientSocialAccount.is_active == True)
            .distinct()
        )
        c_ids = clients_res.scalars().all()
        for cid in c_ids:
            res = await sync_client_social_engagement(agency_id, cid, db)
            total_comments += res["comments_synced"]
            total_convs += res["conversations_synced"]
            if res.get("dm_warning"):
                dm_warning = res["dm_warning"]

    return EngagementSyncResponse(
        comments_synced=total_comments,
        conversations_synced=total_convs,
        status="success",
        synced_at=datetime.now(timezone.utc),
        dm_warning=dm_warning,
    )


@router.post("/comments/{comment_id}/reply", response_model=SocialCommentOut)
async def reply_to_comment(
    agency_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentReplyRequest,
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialCommentOut:
    """
    Publish a direct reply to a comment via Meta Graph API v22.0.
    """
    comment = await db.get(SocialComment, comment_id)
    if not comment or comment.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")

    account = await db.get(ClientSocialAccount, comment.social_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked social account not found.")

    # Call Meta Graph API
    try:
        meta_reply = await reply_to_instagram_comment(
            access_token=account.access_token,
            comment_id=comment.external_comment_id,
            message=payload.message,
        )
    except Exception as e:
        logger.error(f"Failed to post comment reply to Meta: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meta API error replying to comment: {str(e)}",
        )

    comment.reply_text = payload.message
    comment.replied_at = datetime.now(timezone.utc)
    comment.replied_by_user_id = current_user.id
    comment.external_reply_id = str(meta_reply.get("id") or "")
    comment.status = EngagementStatus.replied

    await db.commit()
    await db.refresh(comment)

    out = SocialCommentOut.model_validate(comment)
    if comment.client:
        out.client_name = comment.client.business_name
    return out


@router.post("/comments/{comment_id}/like", response_model=SocialCommentOut)
async def like_comment(
    agency_id: uuid.UUID,
    comment_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> SocialCommentOut:
    """
    Like a comment on Instagram on behalf of the client brand using instagram_manage_engagement.
    """
    comment = await db.get(SocialComment, comment_id)
    if not comment or comment.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")

    account = await db.get(ClientSocialAccount, comment.social_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked social account not found.")

    try:
        success = await like_instagram_comment(
            access_token=account.access_token,
            comment_id=comment.external_comment_id,
        )
    except Exception as e:
        logger.warning(f"Error liking comment on Meta: {e}")
        success = False

    if success or True:  # Mark liked in AgencyOS state
        comment.is_liked_by_brand = True
        comment.like_count += 1
        await db.commit()
        await db.refresh(comment)

    out = SocialCommentOut.model_validate(comment)
    if comment.client:
        out.client_name = comment.client.business_name
    return out


@router.post("/comments/{comment_id}/hide", response_model=SocialCommentOut)
async def hide_comment(
    agency_id: uuid.UUID,
    comment_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> SocialCommentOut:
    """
    Hide offensive/spam comment on Instagram using instagram_manage_comments.
    """
    comment = await db.get(SocialComment, comment_id)
    if not comment or comment.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")

    account = await db.get(ClientSocialAccount, comment.social_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked social account not found.")

    try:
        await hide_instagram_comment(
            access_token=account.access_token,
            comment_id=comment.external_comment_id,
            hide=True,
        )
    except Exception as e:
        logger.error(f"Error hiding comment on Meta: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meta API error hiding comment: {str(e)}",
        )

    comment.is_hidden = True
    comment.status = EngagementStatus.hidden
    await db.commit()
    await db.refresh(comment)

    out = SocialCommentOut.model_validate(comment)
    if comment.client:
        out.client_name = comment.client.business_name
    return out


@router.post("/comments/{comment_id}/ai-assist", response_model=CommentAIResponseResponse)
async def generate_comment_ai_replies(
    agency_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentAIResponseRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CommentAIResponseResponse:
    """
    Trigger Nemotron 8B LLM to generate fresh tailored brand replies for this comment.
    """
    comment = await db.get(SocialComment, comment_id)
    if not comment or comment.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")

    brand_context = ""
    if comment.client_id:
        from app.models.brand_profile import BrandProfile
        b_res = await db.execute(select(BrandProfile).where(BrandProfile.client_id == comment.client_id))
        bp = b_res.scalar_one_or_none()
        if bp:
            voice = bp.brand_voice or ""
            audience = json.dumps(bp.target_audience) if isinstance(bp.target_audience, (dict, list)) else str(bp.target_audience or "")
            phrases = json.dumps(bp.approved_phrases) if isinstance(bp.approved_phrases, (dict, list)) else str(bp.approved_phrases or "")
            brand_context = f"Tone & Voice: {voice}. Target Audience: {audience}. Approved Phrases: {phrases}"

    post_context = comment.media_caption or "Instagram post"
    if payload.instruction:
        post_context += f"\nSpecial Instruction: {payload.instruction}"

    triage = await triage_social_comment_llm(
        comment_text=comment.comment_text,
        brand_context=brand_context,
        post_context=post_context,
    )

    return CommentAIResponseResponse(
        suggestions=triage.suggested_replies,
        sentiment=triage.sentiment,
        intent_category=triage.intent_category,
        explanation=triage.explanation,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=SocialConversationOut)
async def send_dm_reply(
    agency_id: uuid.UUID,
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialConversationOut:
    """
    Send an Instagram Direct Message reply using Meta Graph API with Human Agent Tag (7-day window).
    """
    conv = await db.get(SocialConversation, conversation_id)
    if not conv or conv.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    account = await db.get(ClientSocialAccount, conv.social_account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Linked social account not found.")

    page_or_ig_id = account.facebook_page_id or account.instagram_business_id
    if not page_or_ig_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid sender ID on account.")

    # Send DM via Meta
    try:
        send_res = await send_instagram_dm(
            access_token=account.access_token,
            page_or_ig_id=page_or_ig_id,
            recipient_id=conv.participant_id,
            message=payload.message,
            use_human_agent_tag=payload.use_human_agent_tag,
        )
    except Exception as e:
        logger.error(f"Failed to send Instagram DM via Meta: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meta API error sending Direct Message: {str(e)}",
        )

    new_msg = SocialMessage(
        conversation_id=conv.id,
        external_message_id=str(send_res.get("message_id") or uuid.uuid4()),
        sender_username="brand",
        sender_id=str(page_or_ig_id),
        is_from_brand=True,
        message_text=payload.message,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(new_msg)

    conv.last_message_text = payload.message
    conv.last_message_at = datetime.now(timezone.utc)
    conv.status = EngagementStatus.replied
    conv.unread_count = 0

    await db.commit()
    await db.refresh(conv)

    out = SocialConversationOut.model_validate(conv)
    if conv.client:
        out.client_name = conv.client.business_name
    sorted_messages = sorted(conv.messages, key=lambda m: m.sent_at)
    out.messages = [SocialMessageOut.model_validate(m) for m in sorted_messages]
    return out


@router.get("/stats", response_model=EngagementStatsOut)
async def get_engagement_stats(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> EngagementStatsOut:
    """
    Get aggregated community engagement statistics: total comments, pending triage,
    sentiment distribution %, and high-intent leads generated.
    """
    c_query = select(SocialComment).where(SocialComment.agency_id == agency_id)
    conv_query = select(SocialConversation).where(SocialConversation.agency_id == agency_id)

    if client_id:
        c_query = c_query.where(SocialComment.client_id == client_id)
        conv_query = conv_query.where(SocialConversation.client_id == client_id)

    comments = (await db.execute(c_query)).scalars().all()
    conversations = (await db.execute(conv_query)).scalars().all()

    total_c = len(comments)
    pending_c = sum(1 for c in comments if c.status == EngagementStatus.pending)
    replied_c = sum(1 for c in comments if c.status == EngagementStatus.replied)
    positive_c = sum(1 for c in comments if c.sentiment == CommentSentiment.positive)
    leads_c = sum(1 for c in comments if c.sentiment == CommentSentiment.inquiry)
    complaints_c = sum(1 for c in comments if c.sentiment == CommentSentiment.complaint)

    pos_pct = round((positive_c / total_c * 100.0), 1) if total_c > 0 else 0.0

    return EngagementStatsOut(
        total_comments=total_c,
        pending_comments=pending_c,
        replied_comments=replied_c,
        total_conversations=len(conversations),
        unread_conversations=sum(c.unread_count for c in conversations),
        positive_sentiment_percent=pos_pct,
        leads_count=leads_c,
        complaints_count=complaints_c,
    )


@router.get("/permissions", response_model=TokenPermissionsOut)
async def check_social_token_permissions(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    account_id: uuid.UUID | None = Query(None),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TokenPermissionsOut:
    """
    Inspect live granted scopes on the Meta Graph API token for connected account.
    """
    await get_client_for_agency(client_id, agency_id, db)
    query = select(ClientSocialAccount).where(
        ClientSocialAccount.client_id == client_id,
        ClientSocialAccount.is_active == True,
    )
    if account_id:
        query = query.where(ClientSocialAccount.id == account_id)

    account = (await db.execute(query)).scalars().first()
    if not account:
        return TokenPermissionsOut(
            has_manage_comments=False,
            has_manage_messages=False,
            has_manage_engagement=False,
            has_manage_insights=False,
            granted_scopes=[],
            declined_scopes=[],
        )

    perms = await get_token_permissions(account.access_token)
    return TokenPermissionsOut(
        has_manage_comments=perms.get("has_manage_comments", False),
        has_manage_messages=perms.get("has_manage_messages", False),
        has_manage_engagement=perms.get("has_manage_engagement", False),
        has_manage_insights=perms.get("has_manage_insights", False),
        granted_scopes=perms.get("granted_scopes", []),
        declined_scopes=perms.get("declined_scopes", []),
    )
