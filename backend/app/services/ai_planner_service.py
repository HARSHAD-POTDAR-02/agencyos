from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Any

import httpx

from app.core.config import settings
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.contract import ScopeItem

logger = logging.getLogger(__name__)

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def _detect_industry_category(industry_str: str | None, voice_str: str | None) -> str:
    combined = f"{industry_str or ''} {voice_str or ''}".lower()
    if any(k in combined for k in ["tech", "software", "saas", "digital", "app", "cloud", "ai", "platform"]):
        return "technology_saas"
    if any(k in combined for k in ["fashion", "apparel", "clothing", "beauty", "cosmetics", "jewel"]):
        return "fashion_lifestyle"
    if any(k in combined for k in ["fitness", "gym", "health", "wellness", "yoga", "medical", "clinic"]):
        return "fitness_wellness"
    if any(k in combined for k in ["real estate", "property", "interior", "architecture", "construction"]):
        return "real_estate_home"
    if any(k in combined for k in ["finance", "legal", "consulting", "marketing", "agency", "corporate"]):
        return "professional_services"
    return "general_business"


def _generate_generic_sprint(
    brand_name: str,
    industry: str,
    pillars: list[str],
    voice: str,
    total_days: int,
) -> list[dict[str, Any]]:
    """Synthesizes industry-aware reels for general businesses."""
    items = []
    templates = [
        {
            "hook": f"3 things you never knew about {brand_name} ⚡",
            "visual": "Fast-paced cinematic montage highlighting core features and client benefits with bold typography.",
            "caption": f"At {brand_name}, we believe in excellence and tangible results. Here is what sets us apart from the rest.\n\nSave this reel for your reference!",
            "cta": "Drop your thoughts in comments or DM us for details.",
            "audio": "Trending upbeat electronic rhythm",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#innovation", "#growth", "#industryleader"]
        },
        {
            "hook": f"The biggest mistake people make in {industry or 'our industry'} (and how we solve it) 💡",
            "visual": "Founder / team member breaking down key solution steps with engaging visual overlays.",
            "caption": f"Avoid common pitfalls with proven strategies. Here is how we ensure seamless execution at {brand_name}.\n\nFollow for more expert breakdowns!",
            "cta": "Save this reel and share with someone who needs this!",
            "audio": "Thought-provoking modern ambient track",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#businesstips", "#problemsolved", "#strategy"]
        },
        {
            "hook": f"Behind The Scenes: How we deliver excellence at {brand_name} ✨",
            "visual": "Cinematic behind-the-scenes footage tracking the team craft, process precision, and final delivery.",
            "caption": f"Every single day our team focuses on quality craftsmanship and precision. Real work, real standards.\n\nLearn more via link in bio.",
            "cta": "Visit our website to discover our full range of solutions!",
            "audio": "Inspiring build-up melodic soundtrack",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#behindthescenes", "#craftsmanship", "#teamwork"]
        },
        {
            "hook": f"Real feedback from clients who trusted {brand_name} ⭐⭐⭐⭐⭐",
            "visual": "Dynamic testimonial transitions pairing client quotes with real-world results and proof metrics.",
            "caption": f"Nothing matters more than client satisfaction and proven outcomes. Thank you for your continued trust!\n\nReady to get started? We are here to help.",
            "cta": "Link in bio to schedule your consultation or explore services!",
            "audio": "Upbeat cheerful review trend audio",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#clientlove", "#socialproof", "#results"]
        }
    ]

    for i in range(1, total_days + 1):
        tmpl = templates[(i - 1) % len(templates)]
        pillar = pillars[(i - 1) % len(pillars)] if pillars else "Brand Story"
        clean_pillar = pillar.split("–")[0].split("-")[0].strip()
        items.append({
            "day_number": i,
            "title": f"Day {i}: {clean_pillar} Spotlight",
            "deliverable_type": "reel",
            "platform": "instagram",
            "pillar": clean_pillar,
            "hook": tmpl["hook"],
            "visual_concept": tmpl["visual"],
            "caption": tmpl["caption"],
            "cta": tmpl["cta"],
            "audio_vibe": tmpl["audio"],
            "hashtags": tmpl["tags"],
        })
    return items
    industry: str,
    pillars: list[str],
    voice: str,
    total_days: int,
) -> list[dict[str, Any]]:
    """Synthesizes industry-aware reels for general businesses."""
    items = []
    for i in range(1, total_days + 1):
        pillar = pillars[(i - 1) % len(pillars)] if pillars else "Brand Story"
        clean_pillar = pillar.split("–")[0].split("-")[0].strip()
        items.append({
            "day_number": i,
            "title": f"Day {i}: {clean_pillar} Spotlight",
            "deliverable_type": "reel",
            "platform": "instagram",
            "pillar": clean_pillar,
            "hook": f"3 things you never knew about {clean_pillar.lower()} at {brand_name} ⚡",
            "visual_concept": f"Dynamic jump cuts highlighting {clean_pillar.lower()}, high contrast lighting with crisp bold typography overlay.",
            "caption": f"At {brand_name}, we believe in transparency and excellence. Today we are diving deep into {clean_pillar.lower()}.\n\nSave this reel for your reference!",
            "cta": "Drop your thoughts in comments or DM us for details.",
            "audio_vibe": "Trending upbeat electronic lo-fi rhythm",
            "hashtags": [f"#{brand_name.replace(' ', '').lower()}", f"#{clean_pillar.replace(' ', '').lower()}", "#viralgrowth", "#indiancreators"]
        })
    return items


def _build_procedural_fallback_plan(
    client: Client,
    brand_profile: BrandProfile | None,
    scopes: list[ScopeItem],
    period_month: int,
    period_year: int,
    objective: str | None,
) -> dict[str, Any]:
    """Generates an intelligent, brand-aware 30-day social media campaign plan

    tailored directly to the client's industry, brand voice, and content pillars.
    """
    month_name = MONTH_NAMES[period_month] if 1 <= period_month <= 12 else f"Month {period_month}"
    brand_name = client.business_name
    industry = client.industry or "General Business"
    voice = (brand_profile.brand_voice if brand_profile and brand_profile.brand_voice else "")
    
    pillars: list[str] = []
    if brand_profile and brand_profile.content_pillars:
        if isinstance(brand_profile.content_pillars, list):
            pillars = brand_profile.content_pillars
        elif isinstance(brand_profile.content_pillars, str):
            pillars = [p.strip() for p in brand_profile.content_pillars.split("\n") if p.strip()]

    if not pillars:
        pillars = [
            "Core Product & Service Excellence",
            "Behind The Scenes Craftsmanship",
            "Customer Stories & Social Proof",
            "Industry Leadership & Insights",
            "Community & Client Spotlights"
        ]

    total_reels = sum(s.monthly_quantity for s in scopes if "reel" in s.deliverable_type.lower())
    if total_reels == 0:
        total_reels = 30

    calendar_items = _generate_generic_sprint(brand_name, industry, pillars, voice, total_reels)

    clean_pillars_list = [p.split("–")[0].split("-")[0].strip() for p in pillars]

    return {
        "campaign_name": f"{brand_name} - {month_name} {period_year} Content Sprint",
        "objective": objective or f"Maximize brand awareness, organic engagement, and conversions for {month_name} {period_year}.",
        "brand_voice": voice or "Authentic, professional and customer-centric",
        "content_pillars": clean_pillars_list,
        "total_deliverables_planned": len(calendar_items),
        "generator": "agencyos-intelligent-sprint-engine",
        "deliverables": calendar_items,
    }


async def generate_campaign_plan(
    client: Client,
    brand_profile: BrandProfile | None,
    scopes: list[ScopeItem],
    period_month: int,
    period_year: int,
    objective: str | None = None,
    custom_brief: str | None = None,
) -> dict[str, Any]:
    """Generates an AI content campaign plan for the client using Groq LLM

    (with automatic graceful fallback tailored to client's exact brand profile).
    """
    month_name = MONTH_NAMES[period_month] if 1 <= period_month <= 12 else f"Month {period_month}"
    total_quantity = sum(s.monthly_quantity for s in scopes) or 30

    # If Groq API key is NOT set, use the newly upgraded brand-aware procedural engine
    if not settings.GROQ_API_KEY:
        logger.info("GROQ_API_KEY not set. Using AgencyOS brand-aware sprint engine.")
        return _build_procedural_fallback_plan(
            client=client,
            brand_profile=brand_profile,
            scopes=scopes,
            period_month=period_month,
            period_year=period_year,
            objective=objective,
        )

    # Groq prompt preparation with full brand profile injection
    brand_context = f"""
    Client Business Name: {client.business_name}
    Industry: {client.industry or 'General'}
    Location: {client.location or 'India'}
    Website: {client.website or 'N/A'}
    """

    if brand_profile:
        brand_context += f"""
        Brand Voice & Personality: {brand_profile.brand_voice or 'Authentic, inviting and engaging'}
        Tone & Copy Examples: {brand_profile.tone_examples or 'N/A'}
        Target Audience: {brand_profile.target_audience or 'Target audience and clients'}
        Content Pillars: {brand_profile.content_pillars or []}
        Approved Phrases: {brand_profile.approved_phrases or []}
        PROHIBITED CLAIMS & FORBIDDEN WORDS: {brand_profile.prohibited_claims or []}
        Goals: {brand_profile.goals or []}
        """

    scope_details = [
        f"{s.monthly_quantity}x {s.deliverable_type} on {s.platform}"
        for s in scopes
    ] or ["30x Reels on Instagram"]

    system_prompt = (
        "You are the Head of Social Media Strategy at a premier creative agency. "
        "Your task is to create a hyper-specific, high-converting 30-day Instagram Reel content calendar for this specific client. "
        "CRITICAL INSTRUCTIONS: "
        "1. Strictly align every single reel hook, shot list, and caption with the client's actual industry, brand voice, and content pillars. "
        "2. Ground every deliverable in the client's actual offerings, value propositions, and real-world brand context. DO NOT write vague advice. "
        "3. Strictly avoid all prohibited claims and forbidden words. "
        "4. Output MUST be valid JSON only with NO markdown backticks or extra text outside JSON."
    )

    user_prompt = f"""
    Generate a full 30-day content calendar plan for {month_name} {period_year}.
    
    CLIENT INFORMATION:
    {brand_context}
    
    CONTRACTED SCOPE:
    {', '.join(scope_details)}
    Total deliverables to generate: {total_quantity}
    
    CAMPAIGN OBJECTIVE:
    {objective or 'Maximize brand awareness, organic audience engagement, and qualified conversions'}
    
    ADDITIONAL BRIEF:
    {custom_brief or 'Focus on irresistible 3-second hooks, dynamic visual transitions, and strong community CTAs.'}
    
    Return a JSON object with this exact structure:
    {{
      "campaign_name": "string",
      "objective": "string",
      "brand_voice": "string",
      "content_pillars": ["string"],
      "total_deliverables_planned": {total_quantity},
      "deliverables": [
        {{
          "day_number": 1,
          "title": "Short title",
          "deliverable_type": "reel",
          "platform": "instagram",
          "pillar": "Pillar name from brand profile",
          "hook": "The first 3 seconds hook to stop the scroll",
          "visual_concept": "Visual description, camera movements, and key action shots",
          "caption": "Full Instagram caption text in brand voice",
          "cta": "Call to action",
          "audio_vibe": "Music style or viral audio suggestion",
          "hashtags": ["#tag1", "#tag2"]
        }}
      ]
    }}
    """

    candidate_models = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "llama-3.3-70b-versatile",
    ]

    for model in candidate_models:
        try:
            async with httpx.AsyncClient(timeout=90.0) as http_client:
                response = await http_client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.7,
                        "max_tokens": 8192,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    parsed["generator"] = f"groq-{model}"
                    return parsed
                else:
                    logger.warning("Groq API model %s failed with %s: %s", model, response.status_code, response.text)
        except Exception as exc:
            logger.warning("Groq model %s exception: %s", model, exc)

    logger.warning("All Groq models exhausted. Using intelligent brand-aware sprint engine.")
    fallback = _build_procedural_fallback_plan(
        client=client,
        brand_profile=brand_profile,
        scopes=scopes,
        period_month=period_month,
        period_year=period_year,
        objective=objective,
    )
    fallback["generator"] = "fallback-brand-aware-engine"
    return fallback
