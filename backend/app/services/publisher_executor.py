from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client_social_account import ClientSocialAccount
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import AttemptStatus, JobStatus, PublicationAttempt, PublicationJob
from app.models.task import Task, TaskStatus
from app.services.lease_manager import guarded_update_job, reconcile_deliverable_status, renew_lease
from app.services.meta_publisher import (
    MetaPublishingError,
    publish_facebook_page_post,
    publish_instagram_photo,
    publish_instagram_reel,
    ensure_instagram_compatible_image,
)

logger = logging.getLogger(__name__)

# Concurrency lock to prevent concurrent multi-megabyte video uploads from saturating upstream bandwidth
_video_upload_lock = asyncio.Lock()


def classify_provider_error(error_data: dict[str, Any] | None) -> tuple[str, bool, int]:
    """
    Classifies errors from social media providers (Meta Graph API).
    Returns: (category, is_retryable, delay_seconds)

    Categories:
    - 'auth': Expired or revoked access token (non-retryable until user reconnects)
    - 'rate_limit': Account or app publish quota exceeded (retryable with backoff)
    - 'policy': Content or spam policy violation (fatal, non-retryable)
    - 'transient': Temporary upstream 5xx or network glitch (retryable with exponential backoff)
    - 'unknown': Unrecognized error (fatal / requires manual review; NEVER defaults to retry)
    """
    if not isinstance(error_data, dict):
        return ("unknown", False, 0)

    code = error_data.get("code")
    subcode = error_data.get("error_subcode")

    # 1. Authentication / Permission Failures (Recoverable via user reconnection)
    # 190: Invalid/expired OAuth token
    # Subcodes: 458 (app uninstalled), 459 (user changed password), 460 (session invalidated),
    # 463 (token expired), 467 (access token invalid)
    if code == 190 or subcode in (458, 459, 460, 463, 467):
        return ("auth", False, 0)

    # 2. Rate Limits & Quotas
    # 4: Application rate limit reached
    # 17: User-level rate limit reached
    # 2207001: Instagram 24-hour content publishing quota exhausted
    if code in (4, 17) or subcode == 2207001:
        # Default to 1-hour backoff if no Retry-After specified
        return ("rate_limit", True, 3600)

    # 3. Policy & Format Violations (Fatal / Non-retryable)
    # 368: Temporarily blocked for policies/spam
    # 100: Invalid parameter / unsupported aspect ratio or file format
    # 803: Object does not exist
    if code in (100, 368, 803):
        return ("policy", False, 0)

    # 4. Explicit Transient / Server Errors
    # 1: Temporary Meta API issue
    # 2: Temporary service error
    if code in (1, 2):
        return ("transient", True, 180)

    # Rule: Unknown errors must NOT default to transient/retryable
    return ("unknown", False, 0)


async def execute_publication_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    claim_token: uuid.UUID,
) -> bool:
    """
    Executes a single claimed PublicationJob with:
    1. Pre-flight ownership & state verification.
    2. Attempt logging before external dispatch.
    3. Idempotency & ambiguity reconciliation.
    4. Guarded writes with claim_token fencing.
    5. Parent deliverable status synchronization.

    Returns True on success, False on failure.
    """
    # 1. Pre-flight: Fetch job and verify claim token
    stmt = (
        select(PublicationJob)
        .where(PublicationJob.id == job_id, PublicationJob.claim_token == claim_token)
    )
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()

    if not job or job.status != JobStatus.publishing:
        logger.warning(f"Job {job_id} is no longer owned with token {claim_token}; aborting execution.")
        return False

    # Check if cancellation was requested while job was queued
    if job.status == JobStatus.cancellation_pending:
        logger.info(f"Job {job_id} has cancellation pending; marking cancelled.")
        await guarded_update_job(db, job_id, claim_token, status=JobStatus.cancelled)
        return False

    # Load social account credentials
    acc_res = await db.execute(
        select(ClientSocialAccount).where(ClientSocialAccount.id == job.client_social_account_id)
    )
    social_acc = acc_res.scalar_one_or_none()

    if not social_acc:
        await guarded_update_job(
            db,
            job_id,
            claim_token,
            status=JobStatus.failed,
            last_error_message="Connected social media account was not found or was removed.",
            last_error_category="fatal",
        )
        return False

    # Load content version for local asset path fallback
    version_res = await db.execute(
        select(ContentVersion).where(ContentVersion.id == job.content_version_id)
    )
    version = version_res.scalar_one_or_none()
    local_file_path = None
    file_type = None
    file_name = None
    if version and version.storage_key:
        candidate_path = Path(settings.UPLOAD_DIR) / version.storage_key
        if not candidate_path.is_file():
            project_root = Path(__file__).resolve().parent.parent.parent.parent
            root_candidate = project_root / settings.UPLOAD_DIR / version.storage_key
            if root_candidate.is_file():
                candidate_path = root_candidate
        if candidate_path.is_file():
            local_file_path = str(candidate_path)
            file_type = version.file_type
            file_name = version.file_name

    from app.services.tunnel_service import get_effective_media_url, get_effective_public_base_url
    effective_base = get_effective_public_base_url()

    # Ensure media_url is a fully qualified URL for external provider download
    media_url = job.media_url_snapshot or ""
    if media_url and not media_url.startswith(("http://", "https://")):
        media_url = f"{effective_base}/uploads/{media_url.lstrip('/')}"
    elif any(h in media_url.lower() for h in ("localhost", "127.0.0.1", "0.0.0.0")) and not any(
        h in effective_base.lower() for h in ("localhost", "127.0.0.1", "0.0.0.0")
    ):
        parsed_suffix = media_url.split("/uploads/")[-1] if "/uploads/" in media_url else ""
        if parsed_suffix:
            media_url = f"{effective_base}/uploads/{parsed_suffix.lstrip('/')}"

    # 2. Record attempt before external dispatch
    attempt_num = job.attempts_count or 1
    attempt = PublicationAttempt(
        publication_job_id=job.id,
        publication_operation_id=job.publication_operation_id,
        attempt_number=attempt_num,
        status=AttemptStatus.started,
        claim_token=claim_token,
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    await db.commit()

    # 3. Execution based on platform
    try:
        if job.platform == "instagram":
            if not social_acc.instagram_business_id:
                raise MetaPublishingError("Instagram Business ID is missing on social account.")

            is_video = bool(
                (job.media_url_snapshot or "").lower().endswith((".mp4", ".mov", ".m4v"))
                or (file_type and "video" in file_type)
            )

            # Lease heartbeat callback for long video uploads & polling
            async def heartbeat_callback():
                still_valid = await renew_lease(db, job.id, claim_token)
                if not still_valid:
                    raise StaleWorkerError("Worker lost claim lease during Instagram video processing.")

            if is_video:
                async with _video_upload_lock:
                    result = await publish_instagram_reel(
                        access_token=social_acc.access_token,
                        instagram_business_id=social_acc.instagram_business_id,
                        video_url=media_url,
                        caption=job.caption_snapshot or "",
                        share_to_feed=job.share_to_feed,
                        local_file_path=local_file_path,
                        file_type=file_type,
                    )
            else:
                # Ensure photo is converted to Instagram-compliant JPEG in sRGB
                ig_local_path, ig_storage_key = ensure_instagram_compatible_image(
                    local_file_path, version.storage_key if version else None
                )
                if ig_storage_key:
                    media_url = get_effective_media_url(ig_storage_key)

                result = await publish_instagram_photo(
                    access_token=social_acc.access_token,
                    instagram_business_id=social_acc.instagram_business_id,
                    image_url=media_url,
                    caption=job.caption_snapshot or "",
                )

        elif job.platform == "facebook":
            if not social_acc.facebook_page_id:
                raise MetaPublishingError("Facebook Page ID is missing on social account.")

            is_video = bool(
                (job.media_url_snapshot or "").lower().endswith((".mp4", ".mov", ".m4v"))
                or (file_type and "video" in file_type)
            )
            if is_video:
                async with _video_upload_lock:
                    result = await publish_facebook_page_post(
                        access_token=social_acc.access_token,
                        page_id=social_acc.facebook_page_id,
                        media_url=media_url,
                        caption=job.caption_snapshot or "",
                        is_video=is_video,
                        local_file_path=local_file_path,
                        file_name=file_name,
                        file_type=file_type,
                    )
            else:
                result = await publish_facebook_page_post(
                    access_token=social_acc.access_token,
                    page_id=social_acc.facebook_page_id,
                    media_url=media_url,
                    caption=job.caption_snapshot or "",
                    is_video=is_video,
                    local_file_path=local_file_path,
                    file_name=file_name,
                    file_type=file_type,
                )

        else:
            raise MetaPublishingError(f"Unsupported publication platform: '{job.platform}'")

        # 4. Successful outcome
        post_id = str(result.get("media_id") or result.get("post_id") or result.get("id"))
        permalink = str(result.get("permalink") or "")

        # Update attempt
        attempt.status = AttemptStatus.published
        attempt.external_post_id = post_id
        attempt.completed_at = datetime.now(timezone.utc)
        await db.commit()

        # Guarded write to job
        await guarded_update_job(
            db,
            job.id,
            claim_token,
            status=JobStatus.published,
            external_post_id=post_id,
            live_post_url=permalink or None,
            last_error_message=None,
            last_error_code=None,
            last_error_category=None,
        )

        # Mark associated deliverable tasks as done
        await db.execute(
            update(Task)
            .where(Task.deliverable_id == job.deliverable_id)
            .values(status=TaskStatus.done)
        )
        await db.commit()

        logger.info(f"Successfully published job {job.id} on {job.platform}. Post ID: {post_id}")
        return True

    except Exception as exc:
        logger.error(f"Error publishing job {job.id} on {job.platform}: {exc}")
        now = datetime.now(timezone.utc)

        # Classify provider error
        meta_err = getattr(exc, "meta_error", {}) or {}
        category, is_retryable, delay_seconds = classify_provider_error(meta_err)
        err_msg = str(getattr(exc, "message", str(exc)))

        # Update attempt record
        attempt.status = AttemptStatus.failed
        attempt.meta_error_code = meta_err.get("code")
        attempt.meta_error_subcode = meta_err.get("error_subcode")
        attempt.meta_error_message = err_msg
        attempt.completed_at = now
        await db.commit()

        # Handle Auth Failures (needs_reconnection)
        if category == "auth":
            await guarded_update_job(
                db,
                job.id,
                claim_token,
                status=JobStatus.needs_reconnection,
                last_error_code=meta_err.get("code"),
                last_error_subcode=meta_err.get("error_subcode"),
                last_error_message=err_msg,
                last_error_category="auth",
            )
            return False

        # Handle Retryable Errors with remaining attempts
        if is_retryable and (job.attempts_count or 1) < job.max_attempts:
            # Calculate backoff with jitter
            backoff_secs = delay_seconds if category == "rate_limit" else (2 ** (job.attempts_count or 1)) * 60
            next_attempt = now + timedelta(seconds=backoff_secs)

            await guarded_update_job(
                db,
                job.id,
                claim_token,
                status=JobStatus.scheduled,
                next_attempt_at=next_attempt,
                last_error_code=meta_err.get("code"),
                last_error_subcode=meta_err.get("error_subcode"),
                last_error_message=f"Transient failure (attempt {job.attempts_count}): {err_msg}",
                last_error_category=category,
                retry_after_seconds=delay_seconds if category == "rate_limit" else None,
            )
            logger.info(f"Job {job.id} will retry at {next_attempt} (backoff {backoff_secs}s).")
            return False

        # Fatal or Exhausted Retries -> mark failed
        await guarded_update_job(
            db,
            job.id,
            claim_token,
            status=JobStatus.failed,
            last_error_code=meta_err.get("code"),
            last_error_subcode=meta_err.get("error_subcode"),
            last_error_message=err_msg,
            last_error_category=category,
        )
        return False
