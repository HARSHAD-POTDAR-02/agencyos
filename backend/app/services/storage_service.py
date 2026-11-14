"""
Local filesystem storage service for MVP.
Stores files under UPLOAD_DIR/{deliverable_id}/{filename}.
In production this would be swapped out for S3/MinIO.
"""
from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from app.core.config import settings


def _upload_root() -> Path:
    path = Path(settings.UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_file(file: UploadFile, deliverable_id: uuid.UUID) -> tuple[str, str, int]:
    """
    Persist an uploaded file to the local uploads directory.

    Returns:
        (storage_key, checksum_sha256, file_size_bytes)

    storage_key is a path relative to UPLOAD_DIR, e.g.
        "{deliverable_id}/{unique_filename}"
    which can be served at /uploads/{storage_key}.
    """
    root = _upload_root()

    # Read bytes once so we can compute checksum and size
    file_bytes = await file.read()
    checksum = hashlib.sha256(file_bytes).hexdigest()
    file_size = len(file_bytes)

    # Build a unique filename to avoid collisions on re-upload
    suffix = Path(file.filename or "file").suffix  # e.g. .mp4
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    dest_dir = root / str(deliverable_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique_name

    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(file_bytes)

    storage_key = f"{deliverable_id}/{unique_name}"
    return storage_key, checksum, file_size


def save_text_content(deliverable_id: uuid.UUID, file_name: str, text: str) -> tuple[str, str, int]:
    """
    Persist raw text (such as scripts, copy, or markdown) to the uploads directory.
    Returns:
        (storage_key, checksum_sha256, file_size_bytes)
    """
    root = _upload_root()
    dest_dir = root / str(deliverable_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    raw_bytes = text.encode("utf-8")
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    file_size = len(raw_bytes)
    suffix = Path(file_name).suffix or ".txt"
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    (dest_dir / unique_name).write_bytes(raw_bytes)
    storage_key = f"{deliverable_id}/{unique_name}"
    return storage_key, checksum, file_size


def delete_file(storage_key: str) -> None:
    """Remove a stored file (best-effort, ignores missing files)."""
    try:
        path = Path(settings.UPLOAD_DIR) / storage_key
        path.unlink(missing_ok=True)
    except Exception:
        pass
