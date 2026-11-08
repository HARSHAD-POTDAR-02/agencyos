"""
Interactive CLI for testing the AgencyOS Campaign Intelligence Engine
Agent 1: Brand Intelligence (Powered by Groq openai/gpt-oss-120b)
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import date

# Add backend to path
sys.path.insert(0, os.path.abspath("backend"))

from app.core.config import settings
from app.campaign_intelligence.agents.brand_intelligence import BrandIntelligenceAgent
from app.campaign_intelligence.agents.campaign_strategist import CampaignStrategistAgent
from app.campaign_intelligence.agents.content_architect import ContentArchitectAgent
from app.campaign_intelligence.agents.historical_performance import HistoricalPerformanceAgent
from app.campaign_intelligence.agents.market_research import MarketResearchAgent
from app.campaign_intelligence.agents.quality_evaluator import QualityEvaluatorAgent
from app.campaign_intelligence.schemas import CampaignBrief, BrandContext
from app.campaign_intelligence.schemas.brand import ProhibitedClaim, ProhibitedTerm, ContractQuota, ToneGuideline
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan, CarouselSlide, ReelScene
from app.campaign_intelligence.schemas.quality import QualityEvaluation, FindingSeverity, FindingCategory
from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.comment import DeliverableComment
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.user import Membership, RoleEnum, User
from tests.conftest import TestSessionLocal, test_engine, Base


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_section(title: str):
    print(f"\n--- [ {title} ] " + "-" * (50 - len(title)))


async def run_scenario(
    business_name: str,
    industry: str,
    website: str,
    brand_voice: str,
    approved_phrases: list[str],
    prohibited_claims: list[dict],
    target_audience: list[str],
    content_pillars: list[str],
    offers: list[dict],
    quotas: list[dict],
    past_feedback: list[dict],
    brief_objective: str,
    brief_custom: str,
    brief_platforms: list[str],
):
    """Seeds the scenario into an isolated test session and executes BrandIntelligenceAgent."""
    print(f"\nInitializing test environment with model: {settings.GROQ_MODEL}...")

    # Ensure tables exist
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            email=f"tester_{uuid.uuid4().hex[:6]}@agencyos.local",
            hashed_password="test_hashed_password_123",
            full_name="Alex Lead Strategist",
        )
        db.add(user)

        agency = Agency(
            id=uuid.uuid4(),
            name="Apex Digital Agency",
            slug=f"apex-digital-{uuid.uuid4().hex[:6]}",
        )
        db.add(agency)
        await db.flush()

        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name=business_name,
            industry=industry,
            website=website,
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            confirmed_by_id=user.id,
            brand_voice=brand_voice,
            approved_phrases={"phrases": approved_phrases},
            prohibited_claims=prohibited_claims,
            target_audience={"primary": target_audience},
            content_pillars=content_pillars,
            goals={"offers": offers},
        )
        db.add(bp)

        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Retainer 2026",
            start_date=date(2026, 1, 1),
            status=ContractStatus.active,
            notes="Active SLA scope.",
        )
        db.add(contract)
        await db.flush()

        for q in quotas:
            si = ScopeItem(
                id=uuid.uuid4(),
                contract_id=contract.id,
                deliverable_type=q["type"],
                platform=q["platform"],
                monthly_quantity=q["quantity"],
            )
            db.add(si)
        await db.flush()

        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Strategy",
            status=CampaignStatus.planning,
        )
        db.add(campaign)
        await db.flush()

        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Past Post Review",
            deliverable_type="carousel",
            platform="linkedin",
            status=DeliverableStatus.in_production,
        )
        db.add(deliv)
        await db.flush()

        for fb in past_feedback:
            c = DeliverableComment(
                id=uuid.uuid4(),
                deliverable_id=deliv.id,
                author_id=user.id,
                message=fb["message"],
                is_internal=fb.get("is_internal", False),
            )
            db.add(c)

        await db.commit()

        # Construct brief
        brief = CampaignBrief(
            client_id=client.id,
            agency_id=agency.id,
            period_month=11,
            period_year=2026,
            objective=brief_objective,
            custom_brief=brief_custom,
            target_audience=target_audience,
            platforms=brief_platforms,
        )

        print("\nExecuting BrandIntelligenceAgent.run()...")
        agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
        start_time = asyncio.get_event_loop().time()
        context = await agent.run(brief=brief, db=db)
        elapsed = asyncio.get_event_loop().time() - start_time

    # Display results
    print_header(f"BRAND CONTEXT RESULT: {context.business_name} (in {elapsed:.2f}s)")

    print_section("CONFIRMED DATABASE FACTS (Immutable)")
    for f in context.confirmed_facts:
        print(f"  [✓] {f}")

    print_section("VERIFIED OFFERS (Commercial Reality)")
    for o in context.verified_offers:
        print(f"  [*] {o.name} -> {o.description} (Source: {o.source}, Verified: {o.is_verified})")

    print_section("CONTRACT QUOTAS")
    for q in context.contract_quotas:
        print(f"  [#] {q.deliverable_type} on {q.platform}: {q.monthly_quantity}/month (Remaining: {q.remaining})")

    print_section("CLASSIFIED REVIEWER FEEDBACK")
    for fb in context.classified_feedback:
        print(f"  [!] [{fb.classification.value.upper()}] \"{fb.content}\" (Internal: {fb.is_internal})")

    print_section("SYNTHESIZED TONE GUIDELINES (Groq openai/gpt-oss-120b)")
    print("  DO:")
    for do in context.tone_guidelines.do:
        print(f"    + {do}")
    print("  DON'T:")
    for dont in context.tone_guidelines.dont:
        print(f"    - {dont}")

    print_section("POLICY & BRAND CONFLICTS")
    if context.conflicts:
        for c in context.conflicts:
            print(f"  [ALERT] {c}")
    else:
        print("  [✓] No brand policy or claim violations detected.")

    print_section("EPISTEMIC SAFETY: KNOWLEDGE GAPS & ASSUMPTIONS")
    print(f"  Brand Positioning: {context.brand_positioning or 'None (Strictly unverified; zero hallucinated data)'}")
    print("  Knowledge Gaps Reported:")
    for kg in context.knowledge_gaps:
        print(f"    ? {kg}")
    print("  Assumptions Made:")
    for a in context.assumptions:
        print(f"    ~ {a}")

    print("\n" + "=" * 70 + "\n")


async def run_market_research_interactive(
    industry: str,
    target_audience: list[str],
    platforms: list[str],
    objective: str,
):
    """Executes MarketResearchAgent live and displays formatted report."""
    print(f"\nInitializing Market Research with model: {settings.GROQ_MODEL}...")
    brief = CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=11,
        period_year=2026,
        objective=objective,
        target_audience=target_audience,
        platforms=platforms,
    )
    brand_context = BrandContext(
        client_id=brief.client_id,
        agency_id=brief.agency_id,
        business_name="Research Probe Corp",
        industry=industry,
    )

    agent = MarketResearchAgent(model_name=settings.GROQ_MODEL)
    start_time = asyncio.get_event_loop().time()
    report = await agent.run(brief=brief, brand_context=brand_context)
    elapsed = asyncio.get_event_loop().time() - start_time

    print_header(f"MARKET RESEARCH REPORT: {industry} (in {elapsed:.2f}s)")
    print(f"Confidence Score: {report.confidence_score * 100:.1f}%\n")

    print_section("TARGET AUDIENCE INSIGHTS (External Evidence)")
    for obs in report.target_audience_insights:
        print(f"  [*] Segment: {obs.segment_name}")
        print(f"      Pain Point:    {obs.pain_point}")
        print(f"      Trigger Topic: {obs.trigger_topic}")
        for ev in obs.evidence:
            print(f"      [Source: {ev.source_title} -> {ev.source_url}]")

    print_section("COMPETITOR LANDSCAPE & DIFFERENTIATION")
    for comp in report.competitor_landscape:
        print(f"  [#] Competitor / Angle: {comp.competitor_name}")
        print(f"      Observed Format:    {comp.format_used}")
        print(f"      Angle:              {comp.observed_angle}")
        print(f"      Differentiation:    {comp.differentiation_opportunity}")

    print_section("PLATFORM & FORMAT TRENDS")
    for trend in report.format_and_platform_trends:
        print(f"  [+] {trend.platform.upper()} ({trend.format}):")
        print(f"      Trend:          {trend.trend_description}")
        print(f"      Recommendation: {trend.recommendation}")

    print_section("STRATEGIC OPPORTUNITIES")
    for opp in report.strategic_opportunities:
        print(f"  [★] {opp}")

    print_section("VERIFIABLE EVIDENCE CITATIONS")
    for ev in report.evidence_sources:
        print(f"  - {ev.source_title} ({ev.publisher})")
        print(f"    URL: {ev.source_url}")
        print(f"    Key: {ev.key_takeaway}\n")

    print("=" * 70 + "\n")


async def run_performance_analysis_interactive(has_history: bool = True):
    """Executes HistoricalPerformanceAgent live against test database and Groq."""
    print(f"\nInitializing Performance Analysis with model: {settings.GROQ_MODEL}...")

    # Ensure tables exist
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            email=f"perf_tester_{uuid.uuid4().hex[:6]}@agencyos.local",
            hashed_password="test_hashed_password_123",
            full_name="Performance Lead",
        )
        db.add(user)

        agency = Agency(
            id=uuid.uuid4(),
            name="Apex Performance Agency",
            slug=f"apex-perf-{uuid.uuid4().hex[:6]}",
        )
        db.add(agency)
        await db.flush()

        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="RoboTech Precision Performance",
            industry="Industrial Automation",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q3 Completed Retainer",
            status=CampaignStatus.completed,
        )
        db.add(campaign)
        await db.flush()

        if has_history:
            # Seed 4 Carousels
            carousel_stats = [
                (1200, 65, 12, 6, "Modular Robotic Cell Setup in 48h"),
                (2500, 140, 28, 15, "Hydraulic vs Electric Actuators TCO"),
                (1800, 90, 18, 5, "Sub-millimeter Precision Calibration Guide"),
                (1400, 70, 14, 4, "Safety Curtain Layouts in Modern Factories"),
            ]
            for idx, (v, l, c, s, title) in enumerate(carousel_stats):
                db.add(Deliverable(
                    id=uuid.uuid4(),
                    campaign_id=campaign.id,
                    title=title,
                    deliverable_type="carousel",
                    platform="linkedin",
                    status=DeliverableStatus.published,
                    views_count=v,
                    likes_count=l,
                    comments_count=c,
                    shares_count=s,
                ))

            # Seed 2 Reels
            reel_stats = [
                (6500, 310, 45, 25, "Robot Arm 50kg Heavy Load Stress Test"),
                (4200, 180, 22, 12, "Quick-Lock Tool Changer in Real-time"),
            ]
            for idx, (v, l, c, s, title) in enumerate(reel_stats):
                db.add(Deliverable(
                    id=uuid.uuid4(),
                    campaign_id=campaign.id,
                    title=title,
                    deliverable_type="reel",
                    platform="instagram",
                    status=DeliverableStatus.published,
                    views_count=v,
                    likes_count=l,
                    comments_count=c,
                    shares_count=s,
                ))
            await db.commit()
        else:
            await db.commit()

        brief = CampaignBrief(
            client_id=client.id,
            agency_id=agency.id,
            period_month=11,
            period_year=2026,
            objective="Scale enterprise demo leads for modular cells",
            platforms=["linkedin", "instagram"],
            deliverable_preferences=["carousel", "reel"],
        )

        agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
        start_time = asyncio.get_event_loop().time()
        playbook = await agent.run(brief=brief, db=db)
        elapsed = asyncio.get_event_loop().time() - start_time

    print_header(f"HISTORICAL PERFORMANCE PLAYBOOK (in {elapsed:.2f}s)")
    print(f"Data Sufficiency:          {playbook.data_sufficiency.value.upper()}")
    print(f"Historical Posts Analyzed: {playbook.historical_posts_analyzed}\n")

    print_section("DETERMINISTIC STATISTICAL BREAKDOWNS (Python/SQL)")
    if playbook.format_summaries:
        for s in playbook.format_summaries:
            print(f"  [#] {s.deliverable_type.upper()} on {s.platform.upper()}:")
            print(f"      Total Published:     {s.total_published}")
            print(f"      Average Views:       {s.avg_views:,.1f}")
            print(f"      Average Likes:       {s.avg_likes:,.1f}")
            print(f"      Avg Engagement Rate: {s.avg_engagement_rate}%")
            print(f"      Top Performing:      {', '.join(s.top_performing_angles[:2])}")
    else:
        print("  [i] No historical posts found. Format summaries empty (Zero fake statistics).")

    print_section("AUDIENCE FATIGUE SIGNALS")
    if playbook.fatigue_signals:
        for f in playbook.fatigue_signals:
            print(f"  [!] {f.topic_or_format} (Level: {f.fatigue_level.upper()})")
            print(f"      Recommendation: {f.recommendation}")
    else:
        print("  [✓] No audience fatigue or diminishing returns detected.")

    print_section("WINNING HOOKS & STRATEGIC ANGLES")
    for w in playbook.winning_hooks_and_angles:
        print(f"  [★] {w}")

    print_section("UNDERPERFORMING PATTERNS & RISKS TO AVOID")
    for u in playbook.underperforming_patterns:
        print(f"  [-] {u}")

    print_section("RECOMMENDED DELIVERABLE FORMAT MIX")
    for fmt, qty in playbook.recommended_format_mix.items():
        print(f"  -> {fmt.capitalize()}: {qty} posts/month")

    print("\n" + "=" * 70 + "\n")


async def run_campaign_strategist_interactive():
    """Executes CampaignStrategistAgent live, synthesizing all 3 intelligence streams."""
    print(f"\nInitializing Campaign Strategist with model: {settings.GROQ_MODEL}...")

    # Ensure tables exist
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    # 1. Create client & run Brand Intelligence
    async with TestSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            email=f"strat_user_{uuid.uuid4().hex[:6]}@agencyos.local",
            hashed_password="test_hashed_password_123",
            full_name="Chief Strategist",
        )
        db.add(user)

        agency = Agency(
            id=uuid.uuid4(),
            name="Apex Strategy Partners",
            slug=f"apex-strat-{uuid.uuid4().hex[:6]}",
        )
        db.add(agency)
        await db.flush()

        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="AeroBotix Automation",
            industry="Industrial Robotics & Factory Automation",
            website="https://aerobotix.ai",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            confirmed_by_id=user.id,
            brand_voice="authoritative, technical, engineering-focused, ROI-driven",
            approved_phrases={"phrases": ["sub-millimeter precision", "ISO 9001 certified", "modular robotic cell"]},
            prohibited_claims=[{"claim": "Never claim 100% bug-free uptime or zero downtime guarantee", "reason": "Warranty violation"}],
            target_audience={"primary": "Factory Floor Directors", "secondary": "Automation Plant Engineers"},
            content_pillars=["Repeatability Benchmarks", "TCO Analysis", "Deployment Speed"],
            goals={"offers": [{"name": "AeroBotix ARM-X1", "description": "6-axis robotic arm with 50kg payload"}]},
        )
        db.add(bp)

        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Retainer 2026",
            start_date=date(2026, 1, 1),
            status=ContractStatus.active,
        )
        db.add(contract)
        await db.flush()

        db.add(ScopeItem(id=uuid.uuid4(), contract_id=contract.id, deliverable_type="carousel", platform="linkedin", monthly_quantity=4))
        db.add(ScopeItem(id=uuid.uuid4(), contract_id=contract.id, deliverable_type="reel", platform="instagram", monthly_quantity=2))

        # Seed historical posts
        camp = Campaign(id=uuid.uuid4(), client_id=client.id, name="Past Campaign", status=CampaignStatus.completed)
        db.add(camp)
        await db.flush()

        db.add(Deliverable(id=uuid.uuid4(), campaign_id=camp.id, title="Hydraulic vs Electric Actuators TCO", deliverable_type="carousel", platform="linkedin", status=DeliverableStatus.published, views_count=2200, likes_count=120, comments_count=24, shares_count=10))
        db.add(Deliverable(id=uuid.uuid4(), campaign_id=camp.id, title="ARM-X1 50kg Load Stress Test", deliverable_type="reel", platform="instagram", status=DeliverableStatus.published, views_count=5800, likes_count=260, comments_count=35, shares_count=20))
        await db.commit()

        brief = CampaignBrief(
            client_id=client.id,
            agency_id=agency.id,
            period_month=11,
            period_year=2026,
            objective="Drive 25 qualified plant director demo requests for ARM-X1 modular cells",
            custom_brief="Target automotive manufacturing plants looking to cut commissioning downtime.",
            target_audience=["Plant Directors", "Automation Engineers"],
            platforms=["linkedin", "instagram"],
            deliverable_preferences=["carousel", "reel"],
        )

        print("1/3 Running Agent 1 (Brand Intelligence)...")
        brand_agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
        brand_context = await brand_agent.run(brief=brief, db=db)

        print("2/3 Running Agent 2 (Market & Trend Research with live search)...")
        market_agent = MarketResearchAgent(model_name=settings.GROQ_MODEL)
        market_research = await market_agent.run(brief=brief, brand_context=brand_context)

        print("3/3 Running Agent 3 (Historical Performance Analysis)...")
        perf_agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
        performance_playbook = await perf_agent.run(brief=brief, db=db, brand_context=brand_context)

    # Now execute CampaignStrategistAgent
    print("\nSynthesizing all 3 intelligence artifacts with Agent 4 (Campaign Strategist)...")
    strat_agent = CampaignStrategistAgent(model_name=settings.GROQ_MODEL)
    start_time = asyncio.get_event_loop().time()
    strategy = await strat_agent.run(
        brief=brief,
        brand_context=brand_context,
        market_research=market_research,
        performance_playbook=performance_playbook,
    )
    elapsed = asyncio.get_event_loop().time() - start_time

    print_header(f"CAMPAIGN STRATEGY: '{strategy.campaign_theme}' (in {elapsed:.2f}s)")
    print(f"Primary Objective: {strategy.primary_objective}\n")
    print(f"Target Audience:   {strategy.target_audience_definition}\n")

    print_section("STRATEGIC ANGLES")
    for idx, angle in enumerate(strategy.strategic_angles, 1):
        print(f"  {idx}. {angle.angle_name.upper()}")
        print(f"     Rationale: {angle.rationale}")
        print(f"     Segment:   {angle.target_audience_segment}")
        print(f"     Pillar:    {angle.aligned_content_pillar}")
        if angle.supporting_evidence:
            print(f"     Evidence:  {'; '.join(angle.supporting_evidence[:2])}")
        print()

    print_section("MESSAGING PILLARS")
    for idx, p in enumerate(strategy.messaging_pillars, 1):
        print(f"  Pillar {idx}: {p.pillar_name}")
        print(f"    Message: {p.core_message}")
        print(f"    CTA:     {p.primary_call_to_action}")
        print(f"    Emotions: {', '.join(p.target_emotions)}\n")

    print_section("PLATFORM DISTRIBUTION STRATEGY")
    for plat, role in strategy.platform_distribution_strategy.items():
        print(f"  - {plat.upper()}: {role}")

    print_section("WEEKLY PACING & CADENCE")
    print(f"  {strategy.pacing_and_cadence}")

    print_section("SUCCESS BENCHMARKS")
    for metric, target in strategy.success_benchmarks.items():
        print(f"  [#] {metric}: {target}")

    print_section("STRATEGIC RISKS & MITIGATION")
    for risk in strategy.assumptions_and_risks:
        print(f"  [!] {risk}")

    print("\n" + "=" * 70 + "\n")


async def run_content_architect_interactive():
    """Executes ContentArchitectAgent live, generating polymorphic deliverables."""
    print(f"\nInitializing Content Architect with model: {settings.GROQ_MODEL}...")

    # Ensure tables exist
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            email=f"content_user_{uuid.uuid4().hex[:6]}@agencyos.local",
            hashed_password="test_hashed_password_123",
            full_name="Creative Director",
        )
        db.add(user)

        agency = Agency(
            id=uuid.uuid4(),
            name="Creative Agency OS",
            slug=f"creative-os-{uuid.uuid4().hex[:6]}",
        )
        db.add(agency)
        await db.flush()

        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="AeroBotix Automation",
            industry="Industrial Robotics & Factory Automation",
            website="https://aerobotix.ai",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            brand_voice="authoritative, technical, ROI-driven",
            approved_phrases={"phrases": ["sub-millimeter precision", "ISO 9001 certified", "modular robotic cell"]},
            content_pillars=["Repeatability Benchmarks", "TCO Analysis", "Deployment Speed"],
            goals={"offers": [{"name": "AeroBotix ARM-X1", "description": "6-axis modular precision robot arm"}]},
        )
        db.add(bp)

        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Scope",
            start_date=date(2026, 1, 1),
            status=ContractStatus.active,
        )
        db.add(contract)
        await db.flush()

        # Contract quota: 2 Carousels on LinkedIn, 1 Reel on Instagram
        db.add(ScopeItem(id=uuid.uuid4(), contract_id=contract.id, deliverable_type="carousel", platform="linkedin", monthly_quantity=2))
        db.add(ScopeItem(id=uuid.uuid4(), contract_id=contract.id, deliverable_type="reel", platform="instagram", monthly_quantity=1))
        await db.commit()

        brief = CampaignBrief(
            client_id=client.id,
            agency_id=agency.id,
            period_month=11,
            period_year=2026,
            objective="Drive qualified plant director demo requests for ARM-X1",
            platforms=["linkedin", "instagram"],
            deliverable_preferences=["carousel", "reel"],
        )

        brand_agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
        brand_context = await brand_agent.run(brief=brief, db=db)

    # Build strategy
    strat_agent = CampaignStrategistAgent(model_name=settings.GROQ_MODEL)
    strategy = await strat_agent.run(brief=brief, brand_context=brand_context)

    print("Generating polymorphic deliverables with Agent 5 (Content Architect)...")
    content_agent = ContentArchitectAgent(model_name=settings.GROQ_MODEL)
    start_time = asyncio.get_event_loop().time()
    deliverables = await content_agent.run(
        strategy=strategy,
        brief=brief,
        brand_context=brand_context,
    )
    elapsed = asyncio.get_event_loop().time() - start_time

    print_header(f"CONTENT ARCHITECT DELIVERABLES ({len(deliverables)} items in {elapsed:.2f}s)")

    for idx, d in enumerate(deliverables, 1):
        print_section(f"DELIVERABLE #{idx}: [{d.deliverable_type.upper()}] on {d.platform.upper()} (Week {d.planned_week})")
        print(f"  Title:        {d.title}")
        print(f"  Primary Hook: \"{d.primary_hook}\"")
        if d.hook_options:
            print(f"  Hook Options: {'; '.join(d.hook_options[:2])}")
        print(f"  CTA:          {d.call_to_action}")
        print(f"\n  Caption:\n  {d.caption}\n")

        if d.deliverable_type.lower() == "carousel" and d.carousel_slides:
            print(f"  CAROUSEL SLIDES ({len(d.carousel_slides)} slides):")
            for s in d.carousel_slides:
                print(f"    Slide {s.slide_number} [{s.slide_type.upper()}]: {s.headline}")
                print(f"      Copy:   {s.body_copy[:100]}")
                print(f"      Layout: {s.visual_layout}\n")

        elif d.deliverable_type.lower() == "reel" and d.reel_scenes:
            print(f"  REEL DIRECTOR SCENES ({len(d.reel_scenes)} beats):")
            for sc in d.reel_scenes:
                print(f"    Scene {sc.scene_number} ({sc.timestamp_range}):")
                print(f"      Action:    {sc.visual_action}")
                print(f"      Text:      \"{sc.on_screen_text}\"")
                print(f"      Voiceover: \"{sc.spoken_audio_or_voiceover}\"\n")

    print("\n" + "=" * 70 + "\n")


async def run_quality_evaluator_interactive():
    print_header("AGENT 6: QUALITY EVALUATOR & CRITIC AUDIT")
    print("Testing objective compliance scoring, deterministic term checks, and revision routing.\n")

    # 1. Setup sample BrandContext
    brand_context = BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="AeroBotix Automation",
        industry="Industrial Robotics & Factory Automation",
        brand_positioning="High-precision industrial robotics for automotive manufacturing.",
        brand_voice=["Technical", "Authoritative", "Engineering-focused", "ROI-driven"],
        tone_guidelines=ToneGuideline(
            do=["Sub-millimeter precision metrics", "ISO certified references"],
            dont=["Cheap marketing jargon", "Hyperbolic promises"],
        ),
        prohibited_terms=[
            ProhibitedTerm(term="cheap", reason="Cheap implies substandard component build quality"),
            ProhibitedTerm(term="magic bullet", reason="Over-promising unscientific claims"),
            ProhibitedTerm(term="foolproof", reason="All industrial machinery requires certified operators"),
        ],
        prohibited_claims=[
            ProhibitedClaim(claim="100% bug-free uptime or zero downtime guarantee", reason="Warranty violation"),
        ],
        contract_quotas=[
            ContractQuota(platform="linkedin", deliverable_type="carousel", monthly_quantity=1),
            ContractQuota(platform="instagram", deliverable_type="reel", monthly_quantity=1),
        ],
    )

    # 2. Setup Deliverables (Clean vs Contaminated)
    print("Testing Scenario A: 100% Compliant Deliverable Plan...")
    clean_carousel = DeliverablePlan(
        title="Rapid Deployment in 7 Days",
        deliverable_type="carousel",
        platform="linkedin",
        planned_week=1,
        strategic_angle="Rapid Deployment",
        hook_options=["What if you could cut downtime by 75% in 7 days?"],
        primary_hook="What if you could cut downtime by 75% in 7 days?",
        caption="Traditional robotics installations drag on for months. Discover how modular cells enable 7-day commissioning with full ISO compliance.",
        call_to_action="Book an engineering demo today.",
        hashtags=["#Robotics", "#FactoryAutomation"],
        carousel_slides=[
            CarouselSlide(slide_number=1, slide_type="cover", headline="Deploy in 7 Days", body_copy="Why wait 4 months for robotics integration?", visual_layout="Factory timeline"),
            CarouselSlide(slide_number=2, slide_type="content", headline="Modular Pre-Wiring", body_copy="Pre-tested cable harnesses reduce on-site wiring.", visual_layout="Wiring diagram"),
            CarouselSlide(slide_number=3, slide_type="cta", headline="Book an Engineering Consult", body_copy="Schedule a live consultation.", visual_layout="CTA button"),
        ],
    )

    clean_reel = DeliverablePlan(
        title="Sub-Millimeter Precision Test",
        deliverable_type="reel",
        platform="instagram",
        planned_week=1,
        strategic_angle="Precision Benchmarks",
        hook_options=["Sub-millimeter accuracy under high heat."],
        primary_hook="Sub-millimeter accuracy under high heat.",
        caption="High temperature testing of the ARM-X1. Watch how repeatability remains unaffected under rigorous load.",
        call_to_action="Visit the link in bio to see the full whitepaper.",
        hashtags=["#Automation", "#Engineering"],
        reel_scenes=[
            ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action="Arm moves quickly across test grid", on_screen_text="0.01mm repeatability", spoken_audio_or_voiceover="Watch sub-millimeter precision in real time."),
            ReelScene(scene_number=2, timestamp_range="0:03 - 0:15", visual_action="Thermal camera shows arm operating at 60C", on_screen_text="Thermal stress test", spoken_audio_or_voiceover="Operating consistently even in high ambient heat."),
        ],
    )

    evaluator = QualityEvaluatorAgent(model_name=settings.GROQ_MODEL)
    clean_eval: QualityEvaluation = await evaluator.evaluate(
        deliverables=[clean_carousel, clean_reel],
        brand_context=brand_context,
    )

    print(f"  Result: Approved: {clean_eval.is_approved_for_human_review} | Compliance Score: {clean_eval.compliance_score:.2f} | Critical Findings: {len([f for f in clean_eval.findings if f.severity == FindingSeverity.critical])}")
    print(f"  Revision Required: {clean_eval.revision_required}\n")

    print("Testing Scenario B: Adversarial Non-Compliant Plan (Injected Prohibited Term & Claim)...")
    dirty_carousel = clean_carousel.model_copy(deep=True)
    dirty_carousel.carousel_slides[1].body_copy = "ARM-X1 is a cheap robotics alternative that guarantees 100% bug-free uptime."

    dirty_reel = clean_reel.model_copy(deep=True)
    dirty_reel.reel_scenes[0].spoken_audio_or_voiceover = "This is a magic bullet solution for all your factory automation needs."

    dirty_eval: QualityEvaluation = await evaluator.evaluate(
        deliverables=[dirty_carousel, dirty_reel],
        brand_context=brand_context,
        revision_count=0,
        max_revisions=2,
    )

    print(f"  Result: Approved: {dirty_eval.is_approved_for_human_review} | Compliance Score: {dirty_eval.compliance_score:.2f}")
    print(f"  Revision Required: {dirty_eval.revision_required}")
    print("\n  DETECTED FINDINGS:")
    for f in dirty_eval.findings:
        print(f"    [{f.severity.value.upper()}] ({f.category.value}): {f.issue_description}")
        print(f"      -> Remediation: {f.remediation_instruction}")

    if dirty_eval.revision_instruction:
        print(f"\n  REVISION ROUTING:")
        print(f"    Target Agent: {dirty_eval.revision_instruction.target_agent}")
        print(f"    Reason:       {dirty_eval.revision_instruction.reason}")
        print(f"    Instructions: {dirty_eval.revision_instruction.instructions}")

    print("\n" + "=" * 70 + "\n")


async def main():
    print_header("AgencyOS Campaign Intelligence Engine — Interactive Tester")
    print(f"Configured Model: {settings.GROQ_MODEL}")
    print(f"API Provider:     {settings.LLM_PROVIDER}")

    while True:
        print("\nChoose an option to test:")
        print("1. [Agent 1] Preset: Industrial Robotics (AeroBotix Automation - B2B)")
        print("2. [Agent 1] Preset: Conflict Detection (Violates 'cheapest' & '100% bug-free')")
        print("3. [Agent 1] Preset: Cold Start / Missing Data (Zero fabrication)")
        print("4. [Agent 1] Custom Brand & Brief interactively")
        print("5. [Agent 2] Market Research: Autonomous Port Automation")
        print("6. [Agent 2] Custom Market Research Query (Live Tavily Search)")
        print("7. [Agent 3] Historical Performance: Client with Published Track Record")
        print("8. [Agent 3] Historical Performance: Cold Start Client (Zero fake stats)")
        print("9. [Agent 4] Full Strategy Synthesis (Brand + Market + Performance -> Strategy)")
        print("10. [Agent 5] Content Architect (Generate Polymorphic Deliverables)")
        print("11. [Agent 6] Quality Evaluator & Critic (Audit Deliverables against Guardrails)")
        print("12. Exit")

        choice = input("\nEnter choice [1-12]: ").strip()

        if choice == "1":
            await run_scenario(
                business_name="AeroBotix Automation",
                industry="Industrial Robotics & Factory Automation",
                website="https://aerobotix.ai",
                brand_voice="authoritative, technical, engineering-focused, ROI-driven",
                approved_phrases=["sub-millimeter precision", "ISO 9001 certified", "modular robotic cell"],
                prohibited_claims=[{"claim": "Never claim 100% bug-free uptime or zero downtime guarantee", "reason": "Warranty violation"}],
                target_audience=["Plant Directors", "Factory Automation Engineers"],
                content_pillars=["Repeatability Benchmarks", "TCO Analysis", "Deployment Speed"],
                offers=[{"name": "AeroBotix ARM-X1", "description": "6-axis robotic arm with 50kg payload"}],
                quotas=[{"type": "carousel", "platform": "linkedin", "quantity": 4}, {"type": "reel", "platform": "youtube", "quantity": 2}],
                past_feedback=[{"message": "Never show unshielded robotic equipment without safety light curtains in renders.", "is_internal": False}],
                brief_objective="Generate 25 qualified plant director demo requests for ARM-X1",
                brief_custom="Showcase deployment speed and reliability for tier-1 automotive manufacturing plants.",
                brief_platforms=["linkedin", "youtube"],
            )

        elif choice == "2":
            await run_scenario(
                business_name="CyberShield Security",
                industry="Enterprise Cloud Cybersecurity",
                website="https://cybershield.security",
                brand_voice="vigilant, precise, institutional",
                approved_phrases=["Zero-trust architecture", "SOC 2 Type II certified"],
                prohibited_claims={
                    "exact_terms": ["cheapest", "foolproof", "unhackable"],
                    "policy": "Never guarantee that a network is 100% unhackable or immune to all zero-day exploits.",
                },
                target_audience=["CISOs", "VP of Infrastructure"],
                content_pillars=["Zero Trust Defense", "Ransomware Prevention"],
                offers=[{"name": "ShieldSOC Managed Detection", "description": "24/7 cloud threat hunting"}],
                quotas=[{"type": "carousel", "platform": "linkedin", "quantity": 3}],
                past_feedback=[{"message": "Do not use childish hacker hoodies or green matrix code graphics.", "is_internal": True}],
                brief_objective="Position CyberShield as the most unhackable network defense",
                brief_custom="Position our solution as the cheapest managed SOC that guarantees you are 100% unhackable against any adversary.",
                brief_platforms=["linkedin"],
            )

        elif choice == "3":
            # Cold start scenario
            await run_scenario(
                business_name="Vanguard CleanTech",
                industry="Commercial Geothermal Systems",
                website="https://vanguardcleantech.com",
                brand_voice="",  # Empty
                approved_phrases=[],
                prohibited_claims=[],
                target_audience=[],
                content_pillars=[],
                offers=[],
                quotas=[],
                past_feedback=[],
                brief_objective="Q4 brand awareness launch",
                brief_custom="We need an intro campaign on LinkedIn.",
                brief_platforms=["linkedin"],
            )

        elif choice == "4":
            print("\n--- Enter Custom Brand Details ---")
            b_name = input("Business Name: ").strip() or "Custom Corp"
            b_ind = input("Industry: ").strip() or "B2B SaaS"
            b_web = input("Website (optional): ").strip() or "https://customcorp.com"
            b_voice = input("Brand Voice (e.g. bold, authoritative): ").strip() or "authoritative, technical"
            b_proh_term = input("Exact Prohibited Term (e.g. cheapest): ").strip()
            b_proh_claim = input("Prohibited Claim (e.g. Never guarantee 100% bug-free uptime): ").strip()
            b_offer = input("Offer / Product Name (e.g. CloudScale Enterprise): ").strip() or "Main Product"
            b_obj = input("Campaign Objective: ").strip() or "Generate sales leads"
            b_custom = input("Campaign Brief (try putting prohibited terms to test conflicts!): ").strip() or "Scale reach"

            proh_claims = []
            if b_proh_term:
                proh_claims.append({"claim": f"Do not use the word '{b_proh_term}'", "exact_terms": [b_proh_term]})
            if b_proh_claim:
                proh_claims.append({"claim": b_proh_claim, "reason": "Brand policy"})

            await run_scenario(
                business_name=b_name,
                industry=b_ind,
                website=b_web,
                brand_voice=b_voice,
                approved_phrases=["Industry leading", "Enterprise ready"],
                prohibited_claims=proh_claims,
                target_audience=["Decision Makers"],
                content_pillars=["Core Features", "Customer Proof"],
                offers=[{"name": b_offer, "description": "Standard offering"}],
                quotas=[{"type": "carousel", "platform": "linkedin", "quantity": 4}],
                past_feedback=[{"message": "Always keep graphics clean and legible.", "is_internal": False}],
                brief_objective=b_obj,
                brief_custom=b_custom,
                brief_platforms=["linkedin"],
            )

        elif choice == "5":
            await run_market_research_interactive(
                industry="Maritime Logistics & Container Port Automation",
                target_audience=["Port Operations Directors", "Harbor Terminal Managers"],
                platforms=["linkedin", "youtube"],
                objective="Drive enterprise demo requests for autonomous container handling cranes",
            )

        elif choice == "6":
            print("\n--- Enter Market Research Parameters ---")
            c_ind = input("Target Industry: ").strip() or "B2B SaaS Security"
            c_aud = input("Target Audience (comma-separated): ").strip() or "CISOs, Security Engineers"
            c_plat = input("Target Platforms (e.g. linkedin, instagram): ").strip() or "linkedin"
            c_obj = input("Campaign Objective: ").strip() or "Drive enterprise awareness"

            await run_market_research_interactive(
                industry=c_ind,
                target_audience=[a.strip() for a in c_aud.split(",") if a.strip()],
                platforms=[p.strip() for p in c_plat.split(",") if p.strip()],
                objective=c_obj,
            )

        elif choice == "7":
            await run_performance_analysis_interactive(has_history=True)

        elif choice == "8":
            await run_performance_analysis_interactive(has_history=False)

        elif choice == "9":
            await run_campaign_strategist_interactive()

        elif choice == "10":
            await run_content_architect_interactive()

        elif choice == "11":
            await run_quality_evaluator_interactive()

        elif choice == "12":
            print("Exiting.")
            break
        else:
            print("Invalid selection. Please choose 1 to 12.")


if __name__ == "__main__":
    asyncio.run(main())
