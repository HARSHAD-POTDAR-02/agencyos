#!/usr/bin/env python3
"""
End-to-End Pipeline Verification Test
--------------------------------------
Tests the upgraded Campaign Intelligence pipeline using:
- Campaign Strategist: MiniMax M3.1 Flash (T=0.55)
- Content Architect: MiniMax M3.1 Flash (T=0.70)
- Quality Evaluator: GPT-OSS-120B (T=0.15) with Banned Cliché & Factual Discount Auditing
"""

import asyncio
import sys
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.brand import (
    BrandContext, VerifiedOffer, ProhibitedClaim, ProhibitedTerm, ToneGuideline
)
from app.campaign_intelligence.agents.campaign_strategist import CampaignStrategistAgent
from app.campaign_intelligence.agents.content_architect import ContentArchitectAgent
from app.campaign_intelligence.agents.quality_evaluator import QualityEvaluatorAgent

async def run_pipeline_test():
    print("\n" + "=" * 80)
    print("🚀 RUNNING FULL END-TO-END CAMPAIGN INTELLIGENCE PIPELINE WITH MINIMAX")
    print("=" * 80)

    # 1. Setup Realistic Client Context (Heritage Restaurant Archetype)
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="Copper & Clay Dum Biryani",
        industry="Hospitality & Dining",
        brand_voice=["Warm", "Passionate", "Sensory", "Contrarian against fake mass-produced food"],
        tone_guidelines=ToneGuideline(
            do=["Sensory descriptions of slow-cooking process", "Emphasize 6-hour sealing and hand-ground spices"],
            dont=["No discount coupons", "No generic 'best in town' claims", "No fast-food speed promises"]
        ),
        confirmed_facts=[
            "Dum biryani is hand-sealed with dough and slow-cooked over coal embers for exactly 6 hours",
            "Family recipe dating back 42 years to Old Hyderabad (Charminar)",
            "Only 80 portions prepared fresh daily; when sold out, kitchen closes"
        ],
        verified_offers=[
            VerifiedOffer(
                name="Chef's Reserved Dawat Tasting Pass",
                description="Advance table booking for the 80-portion limited evening service including chef's spiced raita.",
                source="confirmed_brand_profile"
            )
        ],
        prohibited_terms=[
            ProhibitedTerm(term="cheap eats", reason="damages artisanal heritage positioning"),
            ProhibitedTerm(term="instant delivery", reason="contradicts slow dum method")
        ],
        prohibited_claims=[
            ProhibitedClaim(claim="Fastest delivery in 10 minutes", reason="impossible for authentic slow dum cooking"),
            ProhibitedClaim(claim="Guaranteed weight loss", reason="false medical claim for rich cuisine")
        ],
        knowledge_gaps=[
            "Exact supplier of cardamom seeds is proprietary/undisclosed",
            "No promotional discount codes currently exist"
        ]
    )

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        objective="Drive awareness of authentic artisanal slow cooking and sell out the 80 daily portions",
        custom_brief="Target discerning foodies tired of microwave-reheated commercial biryani. Highlight the sealed handi cracking ritual.",
        platforms=["instagram"],
        deliverable_preferences=["reel"],
        period_month=11,
        period_year=2026,
        duration_days=1,
    )

    # 2. Execute Campaign Strategist (MiniMax M3.1 Flash)
    print("\n[Stage 1] 🧠 Running Campaign Strategist (MiniMax M3.1 Flash, T=0.55)...")
    strategist = CampaignStrategistAgent()
    strategy = await strategist.run(brief=brief, brand_context=brand_context)
    
    print("\n✅ STRATEGY GENERATED:")
    print(f"Theme: {strategy.campaign_theme}")
    print(f"Strategic Thesis: {strategy.strategic_thesis}")
    print(f"Core Tension: {strategy.core_tension}")
    print(f"Strategic Angles ({len(strategy.strategic_angles)}):")
    for a in strategy.strategic_angles:
        print(f"  - [{a.angle_name}]: {a.rationale}")

    # 3. Execute Content Architect (MiniMax M3.1 Flash)
    print("\n[Stage 2] 🎬 Running Content Architect (MiniMax M3.1 Flash, T=0.70)...")
    architect = ContentArchitectAgent()
    deliverables = await architect.run(strategy=strategy, brief=brief, brand_context=brand_context)

    print(f"\n✅ DELIVERABLES GENERATED: {len(deliverables)}")
    for d in deliverables:
        print(f"\nTitle: {d.title}")
        print(f"Format: {d.deliverable_type.upper()} | Platform: {d.platform.upper()}")
        print(f"Primary Hook (0-3s): {d.primary_hook}")
        print(f"Call To Action: {d.call_to_action}")
        if d.reel_scenes:
            print(f"Storyboards ({len(d.reel_scenes)} scenes):")
            for sc in d.reel_scenes:
                print(f"  * Scene {sc.scene_number} [{sc.timestamp_range}]:")
                print(f"    - Camera & Action: {sc.visual_action}")
                print(f"    - Dialogue: \"{sc.spoken_audio_or_voiceover}\"")
                print(f"    - On-Screen Text: \"{sc.on_screen_text}\"")

    # 4. Execute Quality Evaluator (GPT-OSS-120B)
    print("\n[Stage 3] ⚖️ Running Quality Evaluator (GPT-OSS-120B, T=0.15)...")
    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=deliverables,
        strategy=strategy,
        brief=brief,
        brand_context=brand_context
    )

    print("\n✅ QUALITY EVALUATION REPORT:")
    print(f"Approved for Human Review: {evaluation.is_approved_for_human_review}")
    print(f"Compliance Score: {evaluation.compliance_score * 100:.1f}%")
    print(f"Revision Required: {evaluation.revision_required}")
    if evaluation.findings:
        print(f"Findings ({len(evaluation.findings)}):")
        for f in evaluation.findings:
            print(f"  - [{f.severity.value.upper()}] {f.category.value}: {f.issue_description} (Action: {f.remediation_instruction})")

    # 5. Output JSON summary
    report = {
        "status": "success",
        "campaign_theme": strategy.campaign_theme,
        "strategic_thesis": strategy.strategic_thesis,
        "core_tension": strategy.core_tension,
        "deliverables_count": len(deliverables),
        "deliverables_summary": [
            {
                "title": d.title,
                "primary_hook": d.primary_hook,
                "call_to_action": d.call_to_action,
                "scenes_count": len(d.reel_scenes or [])
            } for d in deliverables
        ],
        "compliance_score": evaluation.compliance_score,
        "is_approved": evaluation.is_approved_for_human_review,
        "findings_count": len(evaluation.findings)
    }

    out_file = backend_dir / "benchmarks" / "runs" / "e2e_minimax_pipeline_test.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n💾 Telemetry written to {out_file}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
