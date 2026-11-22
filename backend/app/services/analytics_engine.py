from __future__ import annotations

import asyncio
import logging
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.historical_post import ClientHistoricalPost
from app.schemas.analytics import (
    ClientAnalyticsBenchmarksOut,
    FormatBenchmarkItem,
    WinningOutlierPost,
)

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com"


def _get_api_version() -> str:
    return getattr(settings, "META_GRAPH_API_VERSION", "v22.0")


from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from app.core.llm import invoke_structured_llm

NEMOTRON_CLASSIFICATION_MODELS = [
    "nvidia/nemotron-3.5-bolt-e4b",
    "nvidia/nemotron-mini-4b-instruct",
    "llama-3.1-8b-instant",
]


class LLMPostClassificationSchema(BaseModel):
    extracted_hook: str = Field(description="The primary opening hook sentence or question designed to stop the scroll (max 120 chars)")
    hook_archetype: str = Field(
        description="The psychological hook framework: 'Curiosity / Question Hook', 'Contrarian / Myth-Buster', 'High-Value Checklist / Framework', 'Social Proof & Transformation', 'Behind-The-Scenes Craft', 'Direct Announcement / CTA', or 'Authoritative Insight'"
    )
    content_pillar: str = Field(
        description="The content pillar category: 'Educational Authority', 'Social Proof & Results', 'Brand Culture & Process', 'Conversion & Offer', or 'Community Engagement'"
    )
    audience_intent: str = Field(
        description="Primary audience intent: 'learn_actionable_tip', 'seek_social_proof', 'product_discovery', 'entertainment', or 'opinion_debate'"
    )


async def classify_post_intelligence_with_nemotron(
    caption: str | None,
    media_type: str = "IMAGE",
    deliverable_format: str = "reel",
) -> LLMPostClassificationSchema:
    """
    Deep intent and psychological hook classification using the Nemotron 8B model.
    Avoids simplistic regex or keyword heuristics.
    """
    if not caption or not caption.strip():
        return LLMPostClassificationSchema(
            extracted_hook="Visual-First Post (No caption provided)",
            hook_archetype="Visual-First Post",
            content_pillar="Brand Culture & Process",
            audience_intent="entertainment",
        )

    system_prompt = (
        "You are an elite Creative Strategy & Audience Intelligence AI. "
        "Analyze social media post captions to extract the scroll-stopping hook, "
        "classify the psychological hook archetype, content pillar, and underlying audience intent. "
        "Do NOT rely on simplistic keyword checks. Read the tone, copywriting framework, and semantic intent."
    )
    user_prompt = f"""
POST FORMAT: {deliverable_format.upper()} ({media_type})
POST CAPTION:
\"\"\"{caption.strip()[:1000]}\"\"\"

Analyze the copy and provide:
1. extracted_hook: The exact first 1-2 sentences designed to capture attention (max 120 chars).
2. hook_archetype: Choose the best fit from:
   - 'Curiosity / Question Hook'
   - 'Contrarian / Myth-Buster'
   - 'High-Value Checklist / Framework'
   - 'Social Proof & Transformation'
   - 'Behind-The-Scenes Craft'
   - 'Direct Announcement / CTA'
   - 'Authoritative Insight'
3. content_pillar: Choose from:
   - 'Educational Authority'
   - 'Social Proof & Results'
   - 'Brand Culture & Process'
   - 'Conversion & Offer'
   - 'Community Engagement'
4. audience_intent: Choose from:
   - 'learn_actionable_tip'
   - 'seek_social_proof'
   - 'product_discovery'
   - 'entertainment'
   - 'opinion_debate'
"""
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    for model_name in NEMOTRON_CLASSIFICATION_MODELS:
        try:
            return await invoke_structured_llm(
                prompt=messages,
                schema_class=LLMPostClassificationSchema,
                model=model_name,
                temperature=0.1,
                max_tokens=1024,
                timeout=30.0,
            )
        except Exception as e:
            logger.warning("Nemotron model %s failed for post classification: %s. Trying next fallback...", model_name, e)

    # Safe fallback if all LLM attempts fail
    clean = caption.strip()
    first_line = clean.split("\n")[0][:100]
    return LLMPostClassificationSchema(
        extracted_hook=first_line or "Visual Creative Post",
        hook_archetype="Authoritative Insight",
        content_pillar="Community Engagement",
        audience_intent="entertainment",
    )


def extract_hook_and_archetype(caption: str | None) -> tuple[str, str, str]:
    """Deprecated synchronous helper, kept for compatibility."""
    if not caption or not caption.strip():
        return ("Visual-First Post", "Visual-First Post", "Brand Culture & Process")
    clean = caption.strip()
    first_line = clean.split("\n")[0][:110]
    return (first_line, "Authoritative Insight", "Community Engagement")


async def ingest_client_social_history(
    db: AsyncSession,
    client_id: uuid.UUID,
    limit: int = 100,
    days: int = 180,
) -> dict[str, Any]:
    """
    Ingests up to 100+ historical posts across connected Meta social accounts
    (Instagram Business Profile + Facebook Page), querying post metrics and
    extracting top 10% winning outlier patterns.
    """
    # 1. Fetch active social accounts
    stmt = select(ClientSocialAccount).where(
        ClientSocialAccount.client_id == client_id,
        ClientSocialAccount.is_active == True,
    )
    res = await db.execute(stmt)
    accounts = list(res.scalars().all())
    if not accounts:
        return {
            "success": False,
            "message": "No connected social accounts found for this client.",
            "posts_ingested": 0,
            "posts_updated": 0,
            "total_historical_posts": 0,
            "top_outliers_identified": 0,
        }

    version = _get_api_version()
    since_date = datetime.now(timezone.utc) - timedelta(days=days)
    posts_ingested = 0
    posts_updated = 0

    async with httpx.AsyncClient(timeout=20.0) as http_client:
        for acc in accounts:
            token = acc.access_token

            # ─────────────────────────────────────────────────────────────
            # A. Instagram Media Ingestion
            # ─────────────────────────────────────────────────────────────
            if acc.platform == "instagram" and acc.instagram_business_id:
                ig_id = acc.instagram_business_id
                next_url: str | None = f"{GRAPH_API_BASE}/{version}/{ig_id}/media"
                params: dict[str, Any] | None = {
                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
                    "access_token": token,
                    "limit": min(50, limit),
                }

                raw_media: list[dict[str, Any]] = []
                while next_url and len(raw_media) < limit:
                    try:
                        resp = await http_client.get(next_url, params=params)
                        params = None  # Next url already includes parameters
                        if resp.status_code != 200:
                            logger.warning(f"Meta Graph API error fetching IG media for {ig_id}: {resp.status_code} {resp.text}")
                            break
                        data = resp.json()
                        items = data.get("data", [])
                        if not items:
                            break
                        raw_media.extend(items)
                        next_url = data.get("paging", {}).get("next")
                    except Exception as e:
                        logger.warning(f"Exception during IG media pagination: {e}")
                        break

                logger.info(f"Retrieved {len(raw_media)} Instagram media items for client {client_id}")

                # Concurrently query post insights
                async def _fetch_ig_insights(item_id: str, m_type: str) -> dict[str, int]:
                    metric_str = "reach,saved,total_interactions"
                    if m_type == "VIDEO":
                        metric_str += ",views"
                    try:
                        ins_res = await http_client.get(
                            f"{GRAPH_API_BASE}/{version}/{item_id}/insights",
                            params={"metric": metric_str, "access_token": token},
                        )
                        if ins_res.status_code == 200:
                            data_items = ins_res.json().get("data", [])
                            return {
                                m["name"]: (
                                    m.get("values", [{}])[0].get("value", 0)
                                    if m.get("values")
                                    else 0
                                )
                                for m in data_items
                            }
                    except Exception:
                        pass
                    return {}

                # Concurrently query post insights and classify posts with Nemotron LLM
                sem = asyncio.Semaphore(5)

                async def _classify_with_sem(c_text: str, m_type: str, d_fmt: str):
                    async with sem:
                        return await classify_post_intelligence_with_nemotron(c_text, media_type=m_type, deliverable_format=d_fmt)

                insights_task = asyncio.gather(
                    *(_fetch_ig_insights(m["id"], m.get("media_type") or "IMAGE") for m in raw_media),
                    return_exceptions=True,
                )
                classifications_task = asyncio.gather(
                    *(_classify_with_sem(
                        m.get("caption") or "",
                        m.get("media_type") or "IMAGE",
                        "reel" if (m.get("media_type") or "") == "VIDEO" else ("carousel" if (m.get("media_type") or "") == "CAROUSEL_ALBUM" else "single_image")
                    ) for m in raw_media),
                    return_exceptions=True,
                )

                insights_res, classifications_res = await asyncio.gather(insights_task, classifications_task)

                # Upsert into client_historical_posts
                for idx, m in enumerate(raw_media):
                    ext_id = str(m.get("id"))
                    m_type = m.get("media_type") or "IMAGE"
                    deliverable_format = "reel" if m_type == "VIDEO" else ("carousel" if m_type == "CAROUSEL_ALBUM" else "single_image")
                    caption = m.get("caption") or ""
                    thumb = m.get("thumbnail_url") or m.get("media_url")
                    permalink = m.get("permalink") or f"https://www.instagram.com/p/{ext_id}"

                    # Parse timestamp
                    pub_at = None
                    raw_time = m.get("timestamp")
                    if raw_time:
                        try:
                            pub_at = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                        except Exception:
                            pass

                    likes = int(m.get("like_count") or 0)
                    comments = int(m.get("comments_count") or 0)

                    # Extract insights
                    ins = insights_res[idx] if idx < len(insights_res) and isinstance(insights_res[idx], dict) else {}
                    reach = int(ins.get("reach", 0))
                    views = int(ins.get("views", 0))
                    saves = int(ins.get("saved", 0))
                    shares = 0

                    interactions = likes + comments + shares + saves
                    # Engagement rate: (interactions / reach or views * 100)
                    if views > 0:
                        eng_rate = round((interactions / views) * 100.0, 2)
                    elif reach > 0:
                        eng_rate = round((interactions / reach) * 100.0, 2)
                    else:
                        eng_rate = round(float(interactions * 2.5), 2)

                    cls_out = (
                        classifications_res[idx]
                        if idx < len(classifications_res) and isinstance(classifications_res[idx], LLMPostClassificationSchema)
                        else LLMPostClassificationSchema(
                            extracted_hook=(caption.strip()[:100] if caption else "Visual Creative Post"),
                            hook_archetype="Authoritative Insight",
                            content_pillar="Community Engagement",
                            audience_intent="entertainment",
                        )
                    )
                    hook = cls_out.extracted_hook
                    archetype = cls_out.hook_archetype
                    pillar = cls_out.content_pillar

                    # Check existing
                    existing_stmt = select(ClientHistoricalPost).where(
                        ClientHistoricalPost.client_id == client_id,
                        ClientHistoricalPost.external_post_id == ext_id,
                    )
                    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
                    if existing:
                        existing.likes_count = likes
                        existing.comments_count = comments
                        existing.saves_count = saves
                        existing.reach_count = reach
                        existing.views_count = views
                        existing.engagement_rate = eng_rate
                        existing.caption = caption
                        existing.media_url = thumb
                        existing.permalink = permalink
                        existing.extracted_hook = hook
                        existing.hook_archetype = archetype
                        existing.content_pillar = pillar
                        posts_updated += 1
                    else:
                        new_post = ClientHistoricalPost(
                            id=uuid.uuid4(),
                            client_id=client_id,
                            social_account_id=acc.id,
                            platform="instagram",
                            external_post_id=ext_id,
                            media_type=m_type,
                            deliverable_format=deliverable_format,
                            caption=caption,
                            permalink=permalink,
                            media_url=thumb,
                            published_at=pub_at,
                            likes_count=likes,
                            comments_count=comments,
                            shares_count=shares,
                            saves_count=saves,
                            views_count=views,
                            reach_count=reach,
                            impressions_count=views or reach,
                            engagement_rate=eng_rate,
                            is_outlier=False,
                            outlier_score=1.0,
                            extracted_hook=hook,
                            hook_archetype=archetype,
                            content_pillar=pillar,
                        )
                        db.add(new_post)
                        posts_ingested += 1

            # ─────────────────────────────────────────────────────────────
            # B. Facebook Page Feed Ingestion
            # ─────────────────────────────────────────────────────────────
            if acc.platform == "facebook" and acc.facebook_page_id:
                fb_id = acc.facebook_page_id
                fb_url = f"{GRAPH_API_BASE}/{version}/{fb_id}/feed"
                fb_params = {
                    "fields": "id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)",
                    "access_token": token,
                    "limit": min(50, limit),
                }
                try:
                    fb_res = await http_client.get(fb_url, params=fb_params)
                    if fb_res.status_code == 200:
                        feed_items = fb_res.json().get("data", [])

                        fb_classifications = await asyncio.gather(
                            *(_classify_with_sem(item.get("message") or "", "STATUS", "status") for item in feed_items),
                            return_exceptions=True,
                        )

                        for idx, item in enumerate(feed_items):
                            ext_id = str(item.get("id"))
                            message = item.get("message") or ""
                            permalink = item.get("permalink_url") or f"https://www.facebook.com/{ext_id}"

                            pub_at = None
                            created_time = item.get("created_time")
                            if created_time:
                                try:
                                    pub_at = datetime.fromisoformat(created_time.replace("Z", "+00:00"))
                                except Exception:
                                    pass

                            reactions_summary = item.get("reactions", {}).get("summary", {})
                            likes = int(reactions_summary.get("total_count", 0))
                            comments_summary = item.get("comments", {}).get("summary", {})
                            comments = int(comments_summary.get("total_count", 0))
                            shares = int(item.get("shares", {}).get("count", 0)) if item.get("shares") else 0

                            interactions = likes + comments + shares
                            eng_rate = round(float(interactions * 2.0), 2)

                            cls_out = (
                                fb_classifications[idx]
                                if idx < len(fb_classifications) and isinstance(fb_classifications[idx], LLMPostClassificationSchema)
                                else LLMPostClassificationSchema(
                                    extracted_hook=(message.strip()[:100] if message else "Facebook Status"),
                                    hook_archetype="Authoritative Insight",
                                    content_pillar="Community Engagement",
                                    audience_intent="entertainment",
                                )
                            )
                            hook = cls_out.extracted_hook
                            archetype = cls_out.hook_archetype
                            pillar = cls_out.content_pillar

                            existing_stmt = select(ClientHistoricalPost).where(
                                ClientHistoricalPost.client_id == client_id,
                                ClientHistoricalPost.external_post_id == ext_id,
                            )
                            existing = (await db.execute(existing_stmt)).scalar_one_or_none()
                            if existing:
                                existing.likes_count = likes
                                existing.comments_count = comments
                                existing.shares_count = shares
                                existing.engagement_rate = eng_rate
                                existing.caption = message
                                existing.permalink = permalink
                                existing.extracted_hook = hook
                                existing.hook_archetype = archetype
                                existing.content_pillar = pillar
                                posts_updated += 1
                            else:
                                new_post = ClientHistoricalPost(
                                    id=uuid.uuid4(),
                                    client_id=client_id,
                                    social_account_id=acc.id,
                                    platform="facebook",
                                    external_post_id=ext_id,
                                    media_type="STATUS",
                                    deliverable_format="status",
                                    caption=message,
                                    permalink=permalink,
                                    media_url=None,
                                    published_at=pub_at,
                                    likes_count=likes,
                                    comments_count=comments,
                                    shares_count=shares,
                                    saves_count=0,
                                    views_count=0,
                                    reach_count=0,
                                    impressions_count=0,
                                    engagement_rate=eng_rate,
                                    is_outlier=False,
                                    outlier_score=1.0,
                                    extracted_hook=hook,
                                    hook_archetype=archetype,
                                    content_pillar=pillar,
                                )
                                db.add(new_post)
                                posts_ingested += 1
                except Exception as e:
                    logger.warning(f"Error fetching Facebook feed for {fb_id}: {e}")

    await db.commit()

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Outlier Extraction & Benchmark Recalculation
    # ─────────────────────────────────────────────────────────────────────────
    all_posts_stmt = select(ClientHistoricalPost).where(
        ClientHistoricalPost.client_id == client_id
    ).order_by(desc(ClientHistoricalPost.published_at))
    all_posts = list((await db.execute(all_posts_stmt)).scalars().all())

    total_posts = len(all_posts)
    top_outliers_count = 0

    if total_posts >= 3:
        # Compute baseline engagement rate
        rates = [p.engagement_rate for p in all_posts]
        baseline_rate = sum(rates) / total_posts if total_posts > 0 else 0.0

        # Sort posts by engagement rate descending
        sorted_by_eng = sorted(all_posts, key=lambda x: (x.engagement_rate, x.likes_count + x.comments_count), reverse=True)

        # Top 10% outlier cut-off (minimum 2 posts if >= 5 posts, else top 1)
        num_outliers = max(1, int(round(total_posts * 0.10)))
        if total_posts >= 5:
            num_outliers = max(2, num_outliers)

        outlier_posts = sorted_by_eng[:num_outliers]
        outlier_ids = {p.id for p in outlier_posts}

        for p in all_posts:
            if p.id in outlier_ids:
                p.is_outlier = True
                mult = round(p.engagement_rate / max(0.5, baseline_rate), 1) if baseline_rate > 0 else 2.0
                p.outlier_score = max(1.5, mult)
                top_outliers_count += 1
            else:
                p.is_outlier = False
                p.outlier_score = 1.0

        await db.commit()

    benchmarks = await compute_client_benchmarks(client_id=client_id, db=db)

    return {
        "success": True,
        "client_id": client_id,
        "posts_ingested": posts_ingested,
        "posts_updated": posts_updated,
        "total_historical_posts": total_posts,
        "top_outliers_identified": top_outliers_count,
        "dominant_format": benchmarks.dominant_winning_format,
        "baseline_engagement_rate": benchmarks.baseline_engagement_rate,
        "message": f"Successfully synced {posts_ingested + posts_updated} posts. Identified {top_outliers_count} winning outliers.",
    }


async def compute_client_benchmarks(
    client_id: uuid.UUID,
    db: AsyncSession,
) -> ClientAnalyticsBenchmarksOut:
    """
    Computes deterministic statistical benchmarks, format win-rates,
    and identifies top 10% winning outlier patterns from client_historical_posts.
    """
    client = await db.get(Client, client_id)
    client_name = client.business_name if client else "Client"

    stmt = select(ClientHistoricalPost).where(
        ClientHistoricalPost.client_id == client_id
    ).order_by(desc(ClientHistoricalPost.published_at))
    posts = list((await db.execute(stmt)).scalars().all())

    total_posts = len(posts)

    # 1. Determine Data Sufficiency
    if total_posts == 0:
        return ClientAnalyticsBenchmarksOut(
            client_id=client_id,
            client_name=client_name,
            data_sufficiency="cold_start",
            total_posts_analyzed=0,
            date_range_days=0,
            earliest_post_date=None,
            latest_post_date=None,
            baseline_engagement_rate=0.0,
            baseline_avg_reach=0.0,
            baseline_avg_views=0.0,
            dominant_winning_format="None",
            outlier_multiplier_ceiling=1.0,
            format_benchmarks=[],
            top_winning_outliers=[],
            winning_hooks_and_angles=["No historical data ingested yet. Connect social accounts or run backfill."],
            underperforming_patterns=["Insufficient historical sample to identify fatigue patterns."],
            recommended_format_mix={"reel": 2, "carousel": 2},
            campaign_studio_synced=False,
        )

    data_sufficiency = "sparse" if total_posts < 5 else "sufficient"

    # 2. Date Range
    valid_dates = [p.published_at for p in posts if p.published_at]
    earliest_date = min(valid_dates) if valid_dates else None
    latest_date = max(valid_dates) if valid_dates else None
    date_range_days = (latest_date - earliest_date).days if (earliest_date and latest_date) else 0

    # 3. Baseline Metrics
    total_likes = sum(p.likes_count for p in posts)
    total_comments = sum(p.comments_count for p in posts)
    total_shares = sum(p.shares_count for p in posts)
    total_reach = sum(p.reach_count for p in posts)
    total_views = sum(p.views_count for p in posts)

    avg_reach = round(total_reach / total_posts, 1) if total_posts > 0 else 0.0
    avg_views = round(total_views / total_posts, 1) if total_posts > 0 else 0.0
    rates = [p.engagement_rate for p in posts]
    baseline_er = round(sum(rates) / total_posts, 2) if total_posts > 0 else 0.0

    # 4. Group by Deliverable Format
    format_groups: dict[str, list[ClientHistoricalPost]] = defaultdict(list)
    for p in posts:
        fmt = (p.deliverable_format or "single_image").lower()
        format_groups[fmt].append(p)

    format_benchmarks: list[FormatBenchmarkItem] = []
    for fmt, f_posts in format_groups.items():
        count = len(f_posts)
        vol_pct = round((count / total_posts) * 100.0, 1) if total_posts > 0 else 0.0
        f_likes = sum(p.likes_count for p in f_posts) / count
        f_comments = sum(p.comments_count for p in f_posts) / count
        f_shares = sum(p.shares_count for p in f_posts) / count
        f_reach = sum(p.reach_count for p in f_posts) / count
        f_views = sum(p.views_count for p in f_posts) / count
        f_er = sum(p.engagement_rate for p in f_posts) / count

        # Top hooks for this format
        sorted_f = sorted(f_posts, key=lambda x: x.engagement_rate, reverse=True)
        hooks = [p.extracted_hook for p in sorted_f[:2] if p.extracted_hook]

        format_benchmarks.append(
            FormatBenchmarkItem(
                deliverable_format=fmt,
                platform=f_posts[0].platform if f_posts else "instagram",
                total_posts=count,
                share_of_volume_pct=vol_pct,
                avg_likes=round(f_likes, 1),
                avg_comments=round(f_comments, 1),
                avg_shares=round(f_shares, 1),
                avg_reach=round(f_reach, 1),
                avg_views=round(f_views, 1),
                avg_engagement_rate=round(f_er, 2),
                top_hooks=hooks,
                is_dominant_format=False,
            )
        )

    # Sort format benchmarks by engagement rate descending
    format_benchmarks.sort(key=lambda x: x.avg_engagement_rate, reverse=True)

    dominant_format = "single_image"
    if format_benchmarks:
        format_benchmarks[0].is_dominant_format = True
        dominant_format = format_benchmarks[0].deliverable_format

    # 5. Top 10% Winning Outliers
    outlier_entities = [p for p in posts if p.is_outlier]
    if not outlier_entities and total_posts > 0:
        # Fallback to top 1-2 posts if no explicit flag
        sorted_posts = sorted(posts, key=lambda x: (x.engagement_rate, x.likes_count), reverse=True)
        outlier_entities = sorted_posts[:min(2, total_posts)]

    top_outliers: list[WinningOutlierPost] = []
    max_multiplier = 1.0
    for p in outlier_entities:
        mult = p.outlier_score if p.outlier_score > 1.0 else (round(p.engagement_rate / max(0.5, baseline_er), 1) if baseline_er > 0 else 1.5)
        if mult > max_multiplier:
            max_multiplier = mult

        snippet = (p.caption or "")[:80] + "..." if p.caption and len(p.caption) > 80 else (p.caption or "No caption")
        top_outliers.append(
            WinningOutlierPost(
                id=str(p.id),
                platform=p.platform,
                external_post_id=p.external_post_id,
                deliverable_format=p.deliverable_format,
                published_at=p.published_at,
                media_url=p.media_url,
                permalink=p.permalink,
                caption_snippet=snippet,
                extracted_hook=p.extracted_hook or snippet[:60],
                hook_archetype=p.hook_archetype or "Curiosity / Question Hook",
                likes=p.likes_count,
                comments=p.comments_count,
                reach=p.reach_count,
                views=p.views_count,
                engagement_rate=p.engagement_rate,
                outlier_multiplier=mult,
            )
        )

    # 6. Extract Winning Angles & Hypotheses
    winning_angles: list[str] = []
    for o in top_outliers[:4]:
        winning_angles.append(f"{o.hook_archetype}: \"{o.extracted_hook}\" ({o.outlier_multiplier}x baseline engagement)")

    if not winning_angles:
        winning_angles = ["Maintain baseline empirical testing across formats."]

    # 7. Fatigue & Underperforming Patterns
    underperforming: list[str] = []
    if len(format_benchmarks) > 1:
        lowest_fmt = format_benchmarks[-1]
        underperforming.append(
            f"Underperforming format: {lowest_fmt.deliverable_format.upper()} averaged only {lowest_fmt.avg_engagement_rate}% engagement. Limit volume in upcoming sprint."
        )
    if baseline_er < 1.0 and total_posts > 5:
        underperforming.append("Low overall baseline interaction rate. Prioritize high-retention question and contrarian hooks.")

    # 8. Recommended Deliverable Mix based on Empirical History
    recommended_mix: dict[str, int] = {}
    if dominant_format == "reel":
        recommended_mix = {"reel": 4, "carousel": 2, "single_image": 1}
    elif dominant_format == "carousel":
        recommended_mix = {"carousel": 4, "reel": 2, "single_image": 1}
    else:
        recommended_mix = {"single_image": 3, "reel": 2, "carousel": 2}

    return ClientAnalyticsBenchmarksOut(
        client_id=client_id,
        client_name=client_name,
        data_sufficiency=data_sufficiency,
        total_posts_analyzed=total_posts,
        date_range_days=date_range_days,
        earliest_post_date=earliest_date,
        latest_post_date=latest_date,
        baseline_engagement_rate=baseline_er,
        baseline_avg_reach=avg_reach,
        baseline_avg_views=avg_views,
        dominant_winning_format=dominant_format.upper(),
        outlier_multiplier_ceiling=round(max_multiplier, 1),
        format_benchmarks=format_benchmarks,
        top_winning_outliers=top_outliers,
        winning_hooks_and_angles=winning_angles,
        underperforming_patterns=underperforming,
        recommended_format_mix=recommended_mix,
        campaign_studio_synced=True,
    )


async def run_background_backfill(client_id: uuid.UUID, limit: int = 50, days: int = 180) -> None:
    """Safe detached background worker that creates its own AsyncSession."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as session:
            await ingest_client_social_history(session, client_id, limit=limit, days=days)
    except Exception as ex:
        logger.warning(f"Background backfill task failed for client {client_id}: {ex}")

