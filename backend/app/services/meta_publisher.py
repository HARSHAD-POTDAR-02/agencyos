"""
Meta Graph API (Instagram & Facebook) Content Publishing Service.
Compatible with Graph API v21.0 & v22.0.
Supports:
- Instagram Reels publishing (asynchronous container + status polling)
- Instagram Single Photo publishing
- Facebook Page Post publishing
- Token exchange (short-lived user token -> 60-day long-lived token)
- Instagram Business profile verification & details fetch
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com"
GRAPH_VIDEO_API_BASE = "https://graph-video.facebook.com"


class MetaPublishingError(Exception):
    def __init__(self, message: str, meta_error: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.meta_error = meta_error or {}


class MetaPostNotFoundError(MetaPublishingError):
    """Raised when a post has been deleted on Facebook or Instagram."""
    pass


def _is_meta_post_deleted(data: dict[str, Any]) -> bool:
    """Helper to detect if Meta Graph API returned an error indicating a deleted or nonexistent post."""
    if not isinstance(data, dict):
        return False
    error = data.get("error")
    if not isinstance(error, dict):
        return False
    code = error.get("code")
    subcode = error.get("error_subcode")
    message = str(error.get("message", "")).lower()

    if subcode == 33:
        return True
    if code in (100, 803) and (
        "does not exist" in message
        or "cannot be loaded" in message
        or "unsupported get request" in message
    ):
        return True
    return False


def _get_api_version() -> str:
    return getattr(settings, "META_GRAPH_API_VERSION", "v22.0")


async def verify_instagram_account(access_token: str, instagram_business_id: str) -> dict[str, Any]:
    """
    Verify the Instagram Business ID and access token with Meta.
    Returns account details (id, username, name, profile_picture_url).
    """
    version = _get_api_version()
    url = f"{GRAPH_API_BASE}/{version}/{instagram_business_id}"
    params = {
        "fields": "id,username,name,profile_picture_url",
        "access_token": access_token,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        data = res.json()
        if res.status_code != 200 or "error" in data:
            err_msg = data.get("error", {}).get("message", "Failed to verify Instagram account.")
            raise MetaPublishingError(f"Meta API error: {err_msg}", data.get("error"))
        return data


async def exchange_long_lived_token(
    app_id: str,
    app_secret: str,
    short_lived_token: str,
) -> dict[str, Any]:
    """
    Exchange a short-lived user/page token for a 60-day long-lived token.
    """
    version = _get_api_version()
    url = f"{GRAPH_API_BASE}/{version}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_lived_token,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        data = res.json()
        if res.status_code != 200 or "error" in data:
            err_msg = data.get("error", {}).get("message", "Token exchange failed.")
            raise MetaPublishingError(f"Token exchange error: {err_msg}", data.get("error"))
        return data


async def publish_instagram_photo(
    access_token: str,
    instagram_business_id: str,
    image_url: str,
    caption: str = "",
) -> dict[str, Any]:
    """
    Publish a single photo to Instagram.
    Step 1: POST /{ig_user_id}/media (image_url, caption) -> creation_id
    Step 2: POST /{ig_user_id}/media_publish (creation_id) -> media_id
    Step 3: GET /{media_id}?fields=permalink -> live URL
    """
    version = _get_api_version()
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Create Container
        container_url = f"{GRAPH_API_BASE}/{version}/{instagram_business_id}/media"
        container_payload = {
            "image_url": image_url,
            "caption": caption,
            "access_token": access_token,
        }
        res1 = await client.post(container_url, data=container_payload)
        data1 = res1.json()
        if res1.status_code != 200 or "id" not in data1:
            err_msg = data1.get("error", {}).get("message", "Failed to create Instagram photo container.")
            raise MetaPublishingError(f"Container creation failed: {err_msg}", data1.get("error"))

        creation_id = data1["id"]

        # Step 2: Poll status to ensure image download is ready
        status_url = f"{GRAPH_API_BASE}/{version}/{creation_id}"
        waited = 0
        poll_interval = 2
        max_wait = 30
        while waited < max_wait:
            status_res = await client.get(
                status_url,
                params={"fields": "status_code,status", "access_token": access_token},
            )
            status_data = status_res.json()
            status_code = status_data.get("status_code", "").upper()
            if status_code == "FINISHED":
                break
            elif status_code == "ERROR":
                err_msg = status_data.get("status", "Meta photo processing error")
                raise MetaPublishingError(f"Instagram photo processing error: {err_msg}", status_data)
            await asyncio.sleep(poll_interval)
            waited += poll_interval

        # Step 3: Publish Container
        publish_url = f"{GRAPH_API_BASE}/{version}/{instagram_business_id}/media_publish"
        publish_payload = {
            "creation_id": creation_id,
            "access_token": access_token,
        }
        res2 = await client.post(publish_url, data=publish_payload)
        data2 = res2.json()
        if res2.status_code != 200 or "id" not in data2:
            err_msg = data2.get("error", {}).get("message", "Failed to publish Instagram photo.")
            raise MetaPublishingError(f"Publishing failed: {err_msg}", data2.get("error"))

        media_id = data2["id"]

        # Step 4: Fetch post permalink
        permalink = await _fetch_permalink(client, version, media_id, access_token)
        return {
            "media_id": media_id,
            "permalink": permalink,
            "creation_id": creation_id,
            "platform": "instagram",
        }


async def publish_instagram_reel(
    access_token: str,
    instagram_business_id: str,
    video_url: str,
    caption: str = "",
    share_to_feed: bool = True,
    cover_url: str | None = None,
    max_wait_seconds: int = 120,
) -> dict[str, Any]:
    """
    Publish a Reel to Instagram.
    Step 1: POST /{ig_user_id}/media (media_type=REELS, video_url, caption, share_to_feed=true)
    Step 2: Poll GET /{creation_id}?fields=status_code until FINISHED
    Step 3: POST /{ig_user_id}/media_publish (creation_id)
    Step 4: GET /{media_id}?fields=permalink
    """
    version = _get_api_version()
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Create Container
        container_url = f"{GRAPH_API_BASE}/{version}/{instagram_business_id}/media"
        container_payload = {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "share_to_feed": "true" if share_to_feed else "false",
            "access_token": access_token,
        }
        if cover_url:
            container_payload["cover_url"] = cover_url

        res1 = await client.post(container_url, data=container_payload)
        data1 = res1.json()
        if res1.status_code != 200 or "id" not in data1:
            err_msg = data1.get("error", {}).get("message", "Failed to create Instagram Reel container.")
            raise MetaPublishingError(f"Reel container creation failed: {err_msg}", data1.get("error"))

        creation_id = data1["id"]

        # Step 2: Poll for video processing status
        status_url = f"{GRAPH_API_BASE}/{version}/{creation_id}"
        waited = 0
        poll_interval = 3
        while waited < max_wait_seconds:
            await asyncio.sleep(poll_interval)
            waited += poll_interval

            status_res = await client.get(
                status_url,
                params={"fields": "status_code,status", "access_token": access_token},
            )
            status_data = status_res.json()
            status_code = status_data.get("status_code", "").upper()

            if status_code == "FINISHED":
                break
            elif status_code == "ERROR":
                err_msg = status_data.get("status", "Meta processing error")
                raise MetaPublishingError(f"Instagram Reel video processing error: {err_msg}", status_data)
            elif status_code == "EXPIRED":
                raise MetaPublishingError("Instagram container expired before publishing.", status_data)

            logger.info(f"Reel container {creation_id} processing: {status_code} ({waited}s)")
        else:
            raise MetaPublishingError(
                f"Reel processing timed out on Meta after {max_wait_seconds} seconds. Try again later."
            )

        # Step 3: Publish Container
        publish_url = f"{GRAPH_API_BASE}/{version}/{instagram_business_id}/media_publish"
        publish_payload = {
            "creation_id": creation_id,
            "access_token": access_token,
        }
        res3 = await client.post(publish_url, data=publish_payload)
        data3 = res3.json()
        if res3.status_code != 200 or "id" not in data3:
            err_msg = data3.get("error", {}).get("message", "Failed to publish Instagram Reel.")
            raise MetaPublishingError(f"Reel publishing failed: {err_msg}", data3.get("error"))

        media_id = data3["id"]

        # Step 4: Fetch post permalink
        permalink = await _fetch_permalink(client, version, media_id, access_token)
        return {
            "media_id": media_id,
            "permalink": permalink,
            "creation_id": creation_id,
            "platform": "instagram",
        }


async def publish_facebook_page_post(
    access_token: str,
    page_id: str,
    media_url: str | None = None,
    caption: str = "",
    is_video: bool = False,
    local_file_path: str | None = None,
    file_name: str | None = None,
    file_type: str | None = None,
) -> dict[str, Any]:
    """
    Publish a post, photo, or video to a Facebook Page.
    Automatically resolves Page Access Token from user token if necessary.
    Uses direct binary multipart upload via 'source' when local_file_path is available,
    avoiding external fetch failures on Meta's end.
    For videos, routes to https://graph-video.facebook.com as required by Meta.
    """
    version = _get_api_version()
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Resolve Page Access Token if User Access Token was provided
        page_token = access_token
        try:
            pt_res = await client.get(
                f"{GRAPH_API_BASE}/{version}/{page_id}",
                params={"fields": "access_token", "access_token": access_token},
            )
            pt_data = pt_res.json()
            if pt_data.get("access_token"):
                page_token = pt_data["access_token"]
        except Exception:
            pass

        if is_video:
            video_url = f"{GRAPH_VIDEO_API_BASE}/{version}/{page_id}/videos"
            if local_file_path and Path(local_file_path).is_file():
                with open(local_file_path, "rb") as f:
                    mime = file_type or "video/mp4"
                    fname = file_name or Path(local_file_path).name
                    files = {"source": (fname, f.read(), mime)}
                    data = {
                        "description": caption,
                        "access_token": page_token,
                    }
                    res = await client.post(video_url, data=data, files=files)
            elif media_url:
                payload = {
                    "file_url": media_url,
                    "description": caption,
                    "access_token": page_token,
                }
                res = await client.post(video_url, data=payload)
            else:
                raise MetaPublishingError("No video file or URL provided for Facebook video post.")

        elif (local_file_path and Path(local_file_path).is_file()) or media_url:
            photo_url = f"{GRAPH_API_BASE}/{version}/{page_id}/photos"
            if local_file_path and Path(local_file_path).is_file():
                with open(local_file_path, "rb") as f:
                    mime = file_type or "image/jpeg"
                    fname = file_name or Path(local_file_path).name
                    files = {"source": (fname, f.read(), mime)}
                    data = {
                        "caption": caption,
                        "access_token": page_token,
                    }
                    res = await client.post(photo_url, data=data, files=files)
            else:
                payload = {
                    "url": media_url,
                    "caption": caption,
                    "access_token": page_token,
                }
                res = await client.post(photo_url, data=payload)

        else:
            url = f"{GRAPH_API_BASE}/{version}/{page_id}/feed"
            payload = {
                "message": caption,
                "access_token": page_token,
            }
            res = await client.post(url, data=payload)

        data = res.json()
        if res.status_code != 200 or "id" not in data:
            err_msg = data.get("error", {}).get("message", "Failed to publish to Facebook Page.")
            raise MetaPublishingError(f"Facebook publishing failed: {err_msg}", data.get("error"))

        post_id = str(data.get("post_id") or data.get("id"))
        if is_video:
            permalink = f"https://www.facebook.com/watch/?v={post_id}"
        else:
            permalink = f"https://www.facebook.com/{post_id}"

        try:
            p_res = await client.get(
                f"{GRAPH_API_BASE}/{version}/{post_id}",
                params={"fields": "permalink_url", "access_token": page_token},
            )
            p_data = p_res.json()
            if "permalink_url" in p_data:
                permalink = p_data["permalink_url"]
        except Exception:
            pass

        return {
            "post_id": post_id,
            "permalink": permalink,
            "platform": "facebook",
        }


async def sync_facebook_metrics(
    access_token: str,
    post_id: str,
    page_id: str | None = None,
) -> dict[str, int]:
    """
    Query Meta Graph API to fetch live likes, comments, views, and shares
    for a published Facebook Page post. Automatically resolves Page Access Token
    if a user access token was provided.
    """
    version = _get_api_version()
    metrics = {
        "likes_count": 0,
        "comments_count": 0,
        "views_count": 0,
        "shares_count": 0,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Resolve Page Access Token from User Access Token if necessary
        page_token = access_token
        target_page_id = page_id or (post_id.split("_")[0] if "_" in post_id else None)
        if target_page_id:
            try:
                pt_res = await client.get(
                    f"{GRAPH_API_BASE}/{version}/{target_page_id}",
                    params={"fields": "access_token", "access_token": access_token},
                )
                if pt_res.status_code == 200:
                    pt_data = pt_res.json()
                    if pt_data.get("access_token"):
                        page_token = pt_data["access_token"]
            except Exception as e:
                logger.warning(f"Failed to resolve Page Access Token for {target_page_id}: {e}")

        # 1. Fetch likes, reactions, comments, shares
        try:
            url = f"{GRAPH_API_BASE}/{version}/{post_id}"
            res = await client.get(
                url,
                params={
                    "fields": "shares,likes.summary(true).limit(0),reactions.summary(true).limit(0),comments.summary(true).limit(0)",
                    "access_token": page_token,
                },
            )
            data = res.json()
            if res.status_code == 200:
                likes = int(data.get("likes", {}).get("summary", {}).get("total_count", 0))
                reactions = int(data.get("reactions", {}).get("summary", {}).get("total_count", 0))
                metrics["likes_count"] = max(likes, reactions)
                metrics["comments_count"] = int(data.get("comments", {}).get("summary", {}).get("total_count", 0))
                metrics["shares_count"] = int(data.get("shares", {}).get("count", 0))
            elif _is_meta_post_deleted(data):
                raise MetaPostNotFoundError(f"Facebook post {post_id} was deleted.")
        except MetaPostNotFoundError:
            raise
        except Exception as e:
            logger.warning(f"Error fetching Facebook post metrics for {post_id}: {e}")

        # 2. Fetch video views / impressions via post_video_views insights
        try:
            ins_res = await client.get(
                f"{GRAPH_API_BASE}/{version}/{post_id}/insights/post_video_views",
                params={"access_token": page_token},
            )
            if ins_res.status_code == 200:
                ins_data = ins_res.json()
                for item in ins_data.get("data", []):
                    if item.get("name") == "post_video_views":
                        vals = item.get("values", [])
                        if vals:
                            metrics["views_count"] = max(metrics["views_count"], int(vals[0].get("value", 0)))
        except Exception:
            pass

        # 3. Fallback to direct views field if present
        try:
            url = f"{GRAPH_API_BASE}/{version}/{post_id}"
            res = await client.get(
                url,
                params={"fields": "views", "access_token": page_token},
            )
            if res.status_code == 200:
                data = res.json()
                if "views" in data:
                    metrics["views_count"] = max(metrics["views_count"], int(data.get("views") or 0))
        except Exception:
            pass

    return metrics


async def _fetch_permalink(
    client: httpx.AsyncClient,
    version: str,
    media_id: str,
    access_token: str,
) -> str:
    """Best-effort attempt to get the public permalink for a published post."""
    try:
        url = f"{GRAPH_API_BASE}/{version}/{media_id}"
        res = await client.get(url, params={"fields": "permalink", "access_token": access_token})
        data = res.json()
        return data.get("permalink", f"https://www.instagram.com/p/{media_id}")
    except Exception:
        return f"https://www.instagram.com/p/{media_id}"


async def sync_instagram_metrics(
    access_token: str,
    media_id: str,
) -> dict[str, int]:
    """
    Query Meta Graph API v22.0 to fetch live likes, comments, views, and shares
    for a published Instagram post or Reel.
    """
    version = _get_api_version()
    metrics = {
        "likes_count": 0,
        "comments_count": 0,
        "views_count": 0,
        "shares_count": 0,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Basic node fields (likes & comments count)
        try:
            url = f"{GRAPH_API_BASE}/{version}/{media_id}"
            res = await client.get(
                url,
                params={
                    "fields": "like_count,comments_count,media_type",
                    "access_token": access_token,
                },
            )
            data = res.json()
            if res.status_code == 200:
                metrics["likes_count"] = int(data.get("like_count") or 0)
                metrics["comments_count"] = int(data.get("comments_count") or 0)
            elif _is_meta_post_deleted(data):
                raise MetaPostNotFoundError(f"Instagram media {media_id} was deleted.")
        except MetaPostNotFoundError:
            raise
        except Exception as e:
            logger.warning(f"Error fetching basic media fields for {media_id}: {e}")

        # 2. Insights fields (views, shares)
        try:
            insights_url = f"{GRAPH_API_BASE}/{version}/{media_id}/insights"
            ins_res = await client.get(
                insights_url,
                params={
                    "metric": "views,shares,total_interactions",
                    "access_token": access_token,
                },
            )
            if ins_res.status_code == 200:
                ins_data = ins_res.json()
                total_interactions = 0
                for item in ins_data.get("data", []):
                    name = item.get("name")
                    values = item.get("values", [])
                    val = values[0].get("value", 0) if values else 0
                    if name == "views":
                        metrics["views_count"] = int(val or 0)
                    elif name == "shares":
                        metrics["shares_count"] = int(val or 0)
                    elif name == "total_interactions":
                        total_interactions = int(val or 0)

                # If Meta insights hasn't completed granular aggregation for shares yet,
                # deduce remaining interaction counts from total_interactions:
                if total_interactions > (metrics["likes_count"] + metrics["comments_count"]):
                    deduced = total_interactions - (metrics["likes_count"] + metrics["comments_count"])
                    metrics["shares_count"] = max(metrics["shares_count"], deduced)
        except Exception as e:
            logger.info(f"Insights not available yet for {media_id}: {e}")

    return metrics
