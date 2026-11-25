"""
Storage service supporting Backblaze B2 (S3-compatible API), generic S3, and local filesystem fallback.
Stores creative media assets, raw footage, scripts, and exports.
"""
from __future__ import annotations

import asyncio
from functools import lru_cache
import hashlib
import logging
from pathlib import Path
from typing import Any
import uuid

import aiofiles
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_remote_storage_active() -> bool:
    """Returns True if Backblaze B2 or S3 is configured and enabled."""
    backend = (settings.STORAGE_BACKEND or "local").lower()
    if backend in ("b2", "s3"):
        # Check if keys are provided
        has_b2 = bool(settings.B2_KEY_ID and settings.B2_APPLICATION_KEY)
        has_s3 = bool(settings.S3_ACCESS_KEY and settings.S3_SECRET_KEY)
        return has_b2 or has_s3
    return False


@lru_cache()
def _get_boto3_client() -> Any | None:
    """Initializes and caches the boto3 S3 client for Backblaze B2 / S3."""
    if not is_remote_storage_active():
        return None

    backend = (settings.STORAGE_BACKEND or "local").lower()
    if backend == "b2" or settings.B2_KEY_ID:
        endpoint = settings.B2_ENDPOINT
        access_key = settings.B2_KEY_ID
        secret_key = settings.B2_APPLICATION_KEY
        region = settings.B2_REGION or "us-east-005"
    else:
        endpoint = settings.S3_ENDPOINT
        access_key = settings.S3_ACCESS_KEY
        secret_key = settings.S3_SECRET_KEY
        region = settings.S3_REGION or "us-east-005"

    try:
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
        return client
    except Exception as e:
        logger.error(f"Failed to initialize S3/B2 client: {e}")
        return None


def _get_bucket_name() -> str:
    """Returns the target bucket name for Backblaze B2 or S3."""
    backend = (settings.STORAGE_BACKEND or "local").lower()
    if backend == "b2" or settings.B2_BUCKET_NAME:
        return settings.B2_BUCKET_NAME
    return settings.S3_BUCKET


def _upload_root() -> Path:
    """Local cache / uploads directory."""
    path = Path(settings.UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_file(file: UploadFile, deliverable_id: uuid.UUID) -> tuple[str, str, int]:
    """
    Persist an uploaded file to Backblaze B2 (if configured) and mirror to local cache.

    Returns:
        (storage_key, checksum_sha256, file_size_bytes)
    """
    # 1. Read bytes to compute checksum and size
    file_bytes = await file.read()
    checksum = hashlib.sha256(file_bytes).hexdigest()
    file_size = len(file_bytes)

    # 2. Build unique storage key
    suffix = Path(file.filename or "file").suffix
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    storage_key = f"{deliverable_id}/{unique_name}"

    # 3. Always mirror to local cache for fast aspect-ratio conversion & preview
    local_root = _upload_root()
    dest_dir = local_root / str(deliverable_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique_name
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(file_bytes)

    # 4. Upload to Backblaze B2 / S3 if active
    s3 = _get_boto3_client()
    if s3:
        bucket = _get_bucket_name()
        content_type = file.content_type or "application/octet-stream"

        def _sync_upload():
            s3.put_object(
                Bucket=bucket,
                Key=storage_key,
                Body=file_bytes,
                ContentType=content_type,
            )

        try:
            await asyncio.to_thread(_sync_upload)
            logger.info(f"Successfully uploaded {storage_key} ({file_size} bytes) to Backblaze B2 [{bucket}].")
        except Exception as e:
            logger.error(f"Error uploading to Backblaze B2, fell back to local storage: {e}")

    return storage_key, checksum, file_size


def save_text_content(deliverable_id: uuid.UUID, file_name: str, text: str) -> tuple[str, str, int]:
    """
    Persist raw text (such as scripts, copy, or markdown) to storage.
    """
    raw_bytes = text.encode("utf-8")
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    file_size = len(raw_bytes)

    suffix = Path(file_name).suffix or ".txt"
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    storage_key = f"{deliverable_id}/{unique_name}"

    # Local mirror
    dest_dir = _upload_root() / str(deliverable_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / unique_name).write_bytes(raw_bytes)

    # Remote upload
    s3 = _get_boto3_client()
    if s3:
        bucket = _get_bucket_name()
        try:
            s3.put_object(
                Bucket=bucket,
                Key=storage_key,
                Body=raw_bytes,
                ContentType="text/plain; charset=utf-8",
            )
        except Exception as e:
            logger.error(f"Error uploading text to Backblaze B2: {e}")

    return storage_key, checksum, file_size


async def save_remote_bytes(
    data: bytes,
    deliverable_id: uuid.UUID,
    file_name: str,
    content_type: str = "image/jpeg",
) -> tuple[str, str, int]:
    """
    Persist generated visual bytes directly to Backblaze B2 / S3 object storage
    without writing to local filesystem storage.

    Returns:
        (storage_key, checksum_sha256, file_size_bytes)
    """
    s3 = _get_boto3_client()
    if not s3:
        raise RuntimeError(
            "Remote S3/Backblaze B2 object storage is not configured. Refusing local disk storage."
        )

    checksum = hashlib.sha256(data).hexdigest()
    file_size = len(data)
    suffix = Path(file_name).suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    storage_key = f"{deliverable_id}/{unique_name}"
    bucket = _get_bucket_name()

    def _sync_put() -> None:
        s3.put_object(
            Bucket=bucket,
            Key=storage_key,
            Body=data,
            ContentType=content_type,
        )

    await asyncio.to_thread(_sync_put)
    logger.info(
        f"Uploaded generated visual {storage_key} ({file_size} bytes) directly to remote bucket [{bucket}]."
    )
    return storage_key, checksum, file_size


def upload_local_file(local_file_path: str, storage_key: str, content_type: str = "image/jpeg") -> bool:
    """
    Upload an existing file from the local filesystem to Backblaze B2 / S3.
    """
    s3 = _get_boto3_client()
    if not s3 or not Path(local_file_path).is_file():
        return False
    bucket = _get_bucket_name()
    try:
        with open(local_file_path, "rb") as f:
            data = f.read()
        s3.put_object(
            Bucket=bucket,
            Key=storage_key,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"Successfully uploaded local file '{local_file_path}' ({len(data)} bytes) to B2 '{storage_key}'.")
        return True
    except Exception as e:
        logger.error(f"Error uploading local file {local_file_path} to Backblaze B2: {e}")
        return False


def delete_file(storage_key: str) -> None:
    """Remove a stored file from both remote B2 and local cache."""
    # 1. Local
    try:
        path = Path(settings.UPLOAD_DIR) / storage_key
        path.unlink(missing_ok=True)
    except Exception:
        pass

    # 2. Remote B2
    s3 = _get_boto3_client()
    if s3:
        bucket = _get_bucket_name()
        try:
            s3.delete_object(Bucket=bucket, Key=storage_key)
            logger.info(f"Deleted object {storage_key} from B2 bucket {bucket}.")
        except Exception as e:
            logger.warning(f"Error deleting object {storage_key} from Backblaze B2: {e}")


def generate_presigned_url(storage_key: str, expires_in: int | None = None) -> str | None:
    """
    Generates a secure, temporary pre-signed HTTPS URL for a file in Backblaze B2.
    Valid for expires_in seconds (defaults to B2_PRESIGNED_EXPIRATION_SECONDS, 24 hours).
    """
    s3 = _get_boto3_client()
    if not s3:
        return None

    ttl = expires_in or getattr(settings, "B2_PRESIGNED_EXPIRATION_SECONDS", 86400)
    bucket = _get_bucket_name()

    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": storage_key},
            ExpiresIn=ttl,
        )
        return url
    except Exception as e:
        logger.error(f"Error generating presigned URL for {storage_key}: {e}")
        return None
