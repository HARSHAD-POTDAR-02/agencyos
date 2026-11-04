from __future__ import annotations

import json
import logging
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


def _build_procedural_fallback_plan(
    client: Client,
    brand_profile: BrandProfile | None,
    scopes: list[ScopeItem],
    period_month: int,
    period_year: int,
    objective: str | None,
) -> dict[str, Any]:
    """Generates an intelligent, realistic 30-day social media campaign plan

    tailored for Indian agencies when Groq API key is not configured or offline.
    """
    month_name = MONTH_NAMES[period_month] if 1 <= period_month <= 12 else f"Month {period_month}"
    industry = client.industry or "Lifestyle & Business"
    brand_name = client.business_name
    brand_voice = (brand_profile.brand_voice if brand_profile and brand_profile.brand_voice else "Engaging, authoritative yet approachable Indian tone")
    pillars = (brand_profile.content_pillars if brand_profile and brand_profile.content_pillars else [
        "Industry Insights & Busting Myths",
        "Behind The Scenes & Agency Culture",
        "Relatable Humor & Trending Audio",
        "Client Transformation / Case Study",
        "Actionable Quick Tips / How-To"
    ])
    
    total_reels = sum(s.monthly_quantity for s in scopes if "reel" in s.deliverable_type.lower())
    if total_reels == 0:
        total_reels = 30  # Standard Indian retainer benchmark

    templates = [
        {
            "pillar": pillars[0 % len(pillars)],
            "type": "reel",
            "platform": "instagram",
            "hook": f"Stop doing this with your {industry.lower()} in 2026! 🛑",
            "visual_concept": "Fast-paced jump cuts, text on screen with red stop sign sticker, direct-to-camera eye contact.",
            "caption": f"Most founders get this completely wrong when growing their {industry.lower()}. Here are 3 common pitfalls you must avoid to scale faster in India.\n\nSave this for your next team review!",
            "cta": "Drop 'GROW' in comments to get our full framework.",
            "audio_vibe": "Trending suspenseful beat transitioning into upbeat lo-fi",
            "hashtags": [f"#{industry.replace(' ', '').lower()}", "#growmindset", "#agencyos", "#businessgrowth"]
        },
        {
            "pillar": pillars[1 % len(pillars)],
            "type": "reel",
            "platform": "instagram",
            "hook": f"The exact strategy we used to double {brand_name}'s inbound inquiries in 30 days 📈",
            "visual_concept": "Screen recording of analytics dashboard showing upward curve, then host walking through step-by-step whiteboard breakdown.",
            "caption": f"Results don't happen by accident. Here is the step-by-step breakdown of how {brand_name} cracked the organic reach algorithm this quarter.",
            "cta": "Share this with a founder who needs to see this right now.",
            "audio_vibe": "Motivational cinematic background audio",
            "hashtags": [f"#{brand_name.replace(' ', '').lower()}", "#casestudy", "#inboundmarketing", "#scalingup"]
        },
        {
            "pillar": pillars[2 % len(pillars)],
            "type": "reel",
            "platform": "instagram",
            "hook": "Agency life in India be like: 'Sir, thoda colors pop kar do' 😭",
            "visual_concept": "POV angle, designer looking at screen then staring into camera with funny sound effect. Split-screen with client feedback messages.",
            "caption": f"Tag that client or teammate who says 'logo ko thoda bada karo' every single week! At {brand_name}, we keep it real.",
            "cta": "Which client feedback gives you nightmares? Tell us below!",
            "audio_vibe": "Viral trending meme audio / Bollywood reaction audio",
            "hashtags": ["#agencylife", "#relatablework", "#marketingmemes", "#officehumor"]
        },
        {
            "pillar": pillars[3 % len(pillars)],
            "type": "reel",
            "platform": "instagram",
            "hook": f"3 tools every {industry.lower()} enthusiast needs in their toolkit right now ⚡",
            "visual_concept": "Quick hands-on screen demo on iPad / MacBook with dynamic zooms and sleek motion graphic overlays.",
            "caption": f"Save yourself 10+ hours a week with these 3 game-changing tools curated specifically for {industry.lower()}.",
            "cta": "Bookmark this reel before you forget!",
            "audio_vibe": "Modern rhythmic electronic synth beat",
            "hashtags": ["#techtools", "#productivityhacks", "#smartwork", f"#{industry.replace(' ', '').lower()}"]
        },
        {
            "pillar": pillars[4 % len(pillars)],
            "type": "reel",
            "platform": "instagram",
            "hook": f"What nobody tells you about building in {industry} in India today 🇮🇳",
            "visual_concept": "Atmospheric b-roll with voiceover narrative, typography transitions and documentary grade color grading.",
            "caption": f"The market is moving fast. If you're building for the Indian consumer, authenticity beats flashy ads every single time. Here is our perspective at {brand_name}.",
            "cta": "Do you agree? Let's discuss in the comments.",
            "audio_vibe": "Ambient chill acoustic guitar melody",
            "hashtags": ["#indianstartups", "#makeinindia", "#brandbuilding", "#authenticity"]
        }
    ]

    calendar_items = []
    days_to_plan = min(total_reels, 30)

    for i in range(1, days_to_plan + 1):
        tmpl = templates[(i - 1) % len(templates)]
        calendar_items.append({
            "day_number": i,
            "title": f"Day {i}: {tmpl['hook'][:40]}...",
            "deliverable_type": tmpl["type"],
            "platform": tmpl["platform"],
            "pillar": tmpl["pillar"],
            "hook": tmpl["hook"],
            "visual_concept": tmpl["visual_concept"],
            "caption": tmpl["caption"],
            "cta": tmpl["cta"],
            "audio_vibe": tmpl["audio_vibe"],
            "hashtags": tmpl["hashtags"],
        })

    return {
        "campaign_name": f"{brand_name} - {month_name} {period_year} Content Sprint",
        "objective": objective or f"Drive high-intent reach and client conversion across Indian audiences for {month_name} {period_year}.",
        "brand_voice": brand_voice,
        "content_pillars": pillars,
        "total_deliverables_planned": len(calendar_items),
        "generator": "agencyos-core-planner",
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

    (with automatic graceful fallback).
    """
    month_name = MONTH_NAMES[period_month] if 1 <= period_month <= 12 else f"Month {period_month}"
    
    total_quantity = sum(s.monthly_quantity for s in scopes) or 30
    
    # Check if Groq API key is present
    if not settings.GROQ_API_KEY:
        logger.info("GROQ_API_KEY not set. Using intelligent AgencyOS procedural planner.")
        return _build_procedural_fallback_plan(
            client=client,
            brand_profile=brand_profile,
            scopes=scopes,
            period_month=period_month,
            period_year=period_year,
            objective=objective,
        )

    # Groq prompt preparation
    brand_context = f"""
    Client Business Name: {client.business_name}
    Industry: {client.industry or 'General'}
    Location: {client.location or 'India'}
    Website: {client.website or 'N/A'}
    """

    if brand_profile:
        brand_context += f"""
        Brand Voice: {brand_profile.brand_voice or 'Professional and modern'}
        Tone Examples: {brand_profile.tone_examples or 'N/A'}
        Target Audience: {brand_profile.target_audience or 'Indian consumers / SMBs'}
        Content Pillars: {brand_profile.content_pillars or []}
        Approved Phrases: {brand_profile.approved_phrases or []}
        PROHIBITED CLAIMS & WORDS: {brand_profile.prohibited_claims or []}
        Goals: {brand_profile.goals or []}
        """

    scope_details = [
        f"{s.monthly_quantity}x {s.deliverable_type} on {s.platform}"
        for s in scopes
    ] or ["30x Reels on Instagram"]

    system_prompt = (
        "You are the Head of Social Strategy at a top Indian digital marketing agency. "
        "Your job is to generate a comprehensive, highly-converting 30-day content calendar plan for a retainer client. "
        "Strictly adhere to the client's brand voice, tone guidelines, and strictly avoid all prohibited claims. "
        "Output MUST be valid JSON only with no markdown backticks or commentary outside JSON."
    )

    user_prompt = f"""
    Generate a full content calendar plan for {month_name} {period_year}.
    
    CLIENT INFORMATION:
    {brand_context}
    
    CONTRACTED SCOPE:
    {', '.join(scope_details)}
    Total deliverables to generate: {total_quantity}
    
    CAMPAIGN OBJECTIVE:
    {objective or 'Maximize organic engagement, viral reel reach, and high-intent inbound leads'}
    
    ADDITIONAL BRIEF:
    {custom_brief or 'Focus on scroll-stopping hooks within the first 3 seconds and strong CTAs.'}
    
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
          "pillar": "Pillar name",
          "hook": "The first 3 seconds hook to stop the scroll",
          "visual_concept": "Visual description, camera movements, text overlays",
          "caption": "Full Instagram caption text",
          "cta": "Call to action",
          "audio_vibe": "Music style or viral audio suggestion",
          "hashtags": ["#tag1", "#tag2"]
        }}
      ]
    }}
    """

    try:
        async with httpx.AsyncClient(timeout=45.0) as http_client:
            response = await http_client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.7,
                },
            )
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                parsed["generator"] = "groq-llama-3.3-70b-versatile"
                return parsed
            else:
                logger.warning("Groq API returned error %s: %s. Using fallback.", response.status_code, response.text)
                fallback = _build_procedural_fallback_plan(
                    client=client,
                    brand_profile=brand_profile,
                    scopes=scopes,
                    period_month=period_month,
                    period_year=period_year,
                    objective=objective,
                )
                fallback["generator"] = f"fallback-due-to-groq-{response.status_code}"
                return fallback

    except Exception as exc:
        logger.warning("Groq generation failed with exception: %s. Using fallback.", exc)
        fallback = _build_procedural_fallback_plan(
            client=client,
            brand_profile=brand_profile,
            scopes=scopes,
            period_month=period_month,
            period_year=period_year,
            objective=objective,
        )
        fallback["generator"] = "fallback-exception"
        return fallback
