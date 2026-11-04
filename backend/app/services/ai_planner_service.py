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
    if any(k in combined for k in ["restaurant", "food", "cafe", "hotel", "beverage", "dining", "cuisine", "thali", "raan", "kitchen", "bakery", "sweet"]):
        return "food_hospitality"
    if any(k in combined for k in ["fashion", "apparel", "clothing", "beauty", "cosmetics", "jewel"]):
        return "fashion_lifestyle"
    if any(k in combined for k in ["fitness", "gym", "health", "wellness", "yoga"]):
        return "fitness_wellness"
    if any(k in combined for k in ["real estate", "property", "interior", "architecture"]):
        return "real_estate_home"
    return "general_business"


def _generate_food_hospitality_sprint(
    brand_name: str,
    pillars: list[str],
    voice: str,
    total_days: int,
) -> list[dict[str, Any]]:
    """Synthesizes authentic restaurant and food reels tailored to the brand's cuisine,

    pillars, and voice.
    """
    # Extract signature dishes from voice if present
    signatures = []
    if "raan" in voice.lower():
        signatures.append("Signature Raan Special (Mutton & Chicken)")
    if "thali" in voice.lower():
        signatures.append("Grand Maharashtrian Thali")
    if not signatures:
        signatures = ["Chef's Special Thali", "Signature Sizzler", "Traditional House Special"]

    is_marathi = any(k in voice.lower() for k in ["marathi", "maharashtrian", "kolhapur", "pune", "mumbai"])

    food_templates = [
        {
            "pillar_idx": 0,
            "hook": f"Ekda tari he try kelach pahije at {brand_name}! 🔥🤤" if is_marathi else f"Have you tried the legendary food at {brand_name}? 🤤🔥",
            "visual": "Extreme close-up macro shot of sizzling hot food being plated, steam rising, rich aromatic gravy poured over fresh bread/bhakri.",
            "caption": f"When authentic flavors meet traditional recipes, magic happens! Come hungry and experience our signature preparations crafted with age-old secret spices.\n\n📍 Visit us today at {brand_name}.",
            "cta": "Tag your foodie partner who needs to take you here this week!",
            "audio": "Trending rhythmic folk-fusion beat with upbeat food reel vibes",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#foodreels", "#indiancuisine", "#foodiesofindia", "#maharashtrianfood"]
        },
        {
            "pillar_idx": 1,
            "hook": f"Pure meat lovers' paradise: Look at this massive feast! 🍗🍖",
            "visual": "Table-filling spread shot from overhead 4K angle, showcasing overflowing thalis, smoking tandoori starters, and authentic accompaniments.",
            "caption": f"Generous portions, tender slow-cooked meats, and unmatched authentic taste. At {brand_name}, we don't hold back on flavors.\n\nWhich one are you attacking first? 👇",
            "cta": "Save this reel for your next weekend family feast!",
            "audio": "Trending dramatic bass-drop foodie transition audio",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#muttonlovers", "#chickenthali", "#nonvegfeast", "#carnivore"]
        },
        {
            "pillar_idx": 2,
            "hook": f"Behind The Kitchen: The secret spice blend that makes {brand_name} unique 🌶️✨",
            "visual": "Fast-paced cinematic montage: Chef hand-crushing whole spices on a stone mortar, tossing aromatic masala in a giant flaming wok.",
            "caption": f"No shortcuts, no ready-made pastes. Every morning our kitchen starts with fresh regional spices roasted to perfection.\n\nTaste the real tradition at {brand_name}.",
            "cta": "Drop a ❤️ if you appreciate authentic, slow-cooked food!",
            "audio": "Acoustic traditional percussion mixed with contemporary rhythm",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#secretrecipe", "#chefskills", "#authenticcooking", "#spicejourney"]
        },
        {
            "pillar_idx": 3,
            "hook": f"POV: You finally brought your family to {brand_name} on a Sunday afternoon 🏡❤️",
            "visual": "Warm candid shots of multi-generational family smiling, sharing plates, clinking glasses, children enjoying food in traditional village-style seating.",
            "caption": f"Good food tastes 10x better when shared with family. Experience the warmth of village-inspired hospitality right in the heart of town.\n\nBook your family table today!",
            "cta": "Share this with your family WhatsApp group for Sunday lunch!",
            "audio": "Soulful, heartwarming acoustic melody with flute/sitar highlights",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#familydining", "#villageambience", "#weekendlunch", "#sundayfeast"]
        },
        {
            "pillar_idx": 4,
            "hook": f"Wait till the end to see the full plate reveal! 🤯✨",
            "visual": "Tantalizing reveal shot: Waiter carrying massive smoking platter through the rustic dining area, unveiling the signature feast to a stunned customer.",
            "caption": f"Warning: Do not watch this reel on an empty stomach! 🤤 Here is our most popular special served fresh and sizzling.\n\nTag that one friend who is always hungry!",
            "cta": "Comment 'HUNGRY' and we will DM you our full menu & location!",
            "audio": "Viral high-tempo Marathi/Bollywood trending reel audio",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#foodporn", "#platereveal", "#viralreels", "#cravingssatisfied"]
        },
        {
            "pillar_idx": 5,
            "hook": f"What 100+ happy customers say about our signature feast ⭐⭐⭐⭐⭐",
            "visual": "Rapid cuts of genuine diners smiling, giving a thumbs up, dipping bhakri into rassa with authentic 'waah' expressions.",
            "caption": f"Nothing beats genuine customer love! Thank you for making {brand_name} your favorite dining destination week after week.\n\nHave you tried our signature dishes yet?",
            "cta": "Tell us your favorite dish in the comments below!",
            "audio": "Upbeat cheerful review audio trend",
            "tags": [f"#{brand_name.replace(' ', '').lower()}", "#customerlove", "#foodreview", "#5starfood", "#happycustomers"]
        }
    ]

    items = []
    for i in range(1, total_days + 1):
        tmpl = food_templates[(i - 1) % len(food_templates)]
        pillar_name = pillars[tmpl["pillar_idx"] % len(pillars)] if pillars else "Authentic Dining"
        # If pillar has description after hyphen/dash, clean it up for title
        clean_pillar = pillar_name.split("–")[0].split("-")[0].strip()

        items.append({
            "day_number": i,
            "title": f"Day {i}: {tmpl['hook'][:42]}...",
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


def _generate_generic_sprint(
    brand_name: str,
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
    industry = client.industry or "Food & Hospitality"
    voice = (brand_profile.brand_voice if brand_profile and brand_profile.brand_voice else "")
    
    pillars: list[str] = []
    if brand_profile and brand_profile.content_pillars:
        if isinstance(brand_profile.content_pillars, list):
            pillars = brand_profile.content_pillars
        elif isinstance(brand_profile.content_pillars, str):
            pillars = [p.strip() for p in brand_profile.content_pillars.split("\n") if p.strip()]

    if not pillars:
        pillars = [
            "Authentic Signature Specialties",
            "Behind The Scenes Craftsmanship",
            "Customer Moments & Social Proof",
            "Ambience & Culture Experience",
            "Special Combos & Weekend Highlights"
        ]

    total_reels = sum(s.monthly_quantity for s in scopes if "reel" in s.deliverable_type.lower())
    if total_reels == 0:
        total_reels = 30

    category = _detect_industry_category(industry, voice)

    if category == "food_hospitality":
        calendar_items = _generate_food_hospitality_sprint(brand_name, pillars, voice, total_reels)
    else:
        calendar_items = _generate_generic_sprint(brand_name, industry, pillars, voice, total_reels)

    clean_pillars_list = [p.split("–")[0].split("-")[0].strip() for p in pillars]

    return {
        "campaign_name": f"{brand_name} - {month_name} {period_year} Content Sprint",
        "objective": objective or f"Maximize footfall, viral reel reach, and loyal customer engagement for {month_name} {period_year}.",
        "brand_voice": voice or "Authentic, inviting and customer-centric",
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
        Target Audience: {brand_profile.target_audience or 'Local food lovers and families'}
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
        "You are the Head of Social Media Strategy at a premier Indian creative agency. "
        "Your task is to create a hyper-specific, high-converting 30-day Instagram Reel content calendar for this specific client. "
        "CRITICAL INSTRUCTIONS: "
        "1. Strictly align every single reel hook, shot list, and caption with the client's actual industry, brand voice, and content pillars. "
        "2. If the client is a restaurant/hotel, every reel MUST feature their actual food (e.g. signature dishes, thalis, raan, sizzling kitchen preparations, family dining ambiance). DO NOT write generic agency advice. "
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
    {objective or 'Maximize local footfall, viral organic reel reach, and mouth-watering food engagement'}
    
    ADDITIONAL BRIEF:
    {custom_brief or 'Focus on irresistible 3-second visual hooks, sizzling food transitions, and strong local community CTAs.'}
    
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
          "visual_concept": "Visual description, camera movements, food action shots",
          "caption": "Full Instagram caption text in brand voice",
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
                logger.warning("Groq API error %s: %s. Using brand-aware sprint engine.", response.status_code, response.text)
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
        logger.warning("Groq generation failed with exception: %s. Using brand-aware sprint engine.", exc)
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
