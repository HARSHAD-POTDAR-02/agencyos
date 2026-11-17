from __future__ import annotations

import logging
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

TUNNEL_FILE = Path(__file__).resolve().parent.parent.parent / ".active_tunnel_url"


def get_effective_public_base_url() -> str:
    """
    Returns the effective publicly reachable base URL for media assets.
    Order of preference:
    1. If .active_tunnel_url exists and contains a valid https URL, return that.
    2. If settings.PUBLIC_BASE_URL is not localhost / 127.0.0.1, return that.
    3. Fallback to settings.PUBLIC_BASE_URL (defaults to http://localhost:8000).
    """
    if TUNNEL_FILE.is_file():
        try:
            stored_url = TUNNEL_FILE.read_text().strip()
            if stored_url.startswith(("http://", "https://")) and not any(
                h in stored_url.lower() for h in ("localhost", "127.0.0.1", "0.0.0.0")
            ):
                return stored_url.rstrip("/")
        except Exception as e:
            logger.debug(f"Could not read .active_tunnel_url: {e}")

    configured = getattr(settings, "PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
    return configured


def get_effective_media_url(storage_key: str, override_url: str | None = None) -> str:
    """
    Constructs a fully qualified public URL for a media asset.
    """
    if override_url:
        return override_url.strip()
    base = get_effective_public_base_url()
    return f"{base.rstrip('/')}/uploads/{storage_key.lstrip('/')}"
