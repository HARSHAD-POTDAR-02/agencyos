from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.agents.brand_intelligence import BrandIntelligenceAgent
from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    BrandPositioningPayload,
    TruthTierItem,
)
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.core.config import settings
from app.core.llm import invoke_structured_llm
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BrandConversationalReply(BaseModel):
    conversational_summary: str = Field(
        description="Comprehensive, deeply structured markdown response with clear section headers (###), bold bullet points, and fully enumerated lists. Never cut off mid-list."
    )
    clarifying_questions_for_user: list[str] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)


class BrandSpecialistAdapter(SpecialistAdapter):
    """
    Adapter bridging BrandIntelligenceAgent into Campaign Studio.
    Enforces the 4-tier epistemic truth architecture:
    1. Verified Facts (from database/profile with explicit DB source)
    2. Inferred Insights (labeled as inference)
    3. Hypotheses Requiring Validation (prompting human confirmation)
    4. Missing Information (explicit clarifying questions without persona hallucination)
    """

    def __init__(self):
        super().__init__(
            specialist_id="brand_intelligence",
            specialist_name="Brand Identity Specialist",
        )

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any | None = None,
        **kwargs: Any,
    ) -> SpecialistResult:
        activity_logs: list[str] = []
        activity_logs.append("Retrieving confirmed brand profile & database records...")

        # 1. Reuse existing BrandIntelligenceAgent
        brand_agent = BrandIntelligenceAgent(model_name=settings.FALLBACK_MODEL)
        brand_context: BrandContext = context.brand_context or await brand_agent.run(
            brief=context.campaign_brief,
            db=db,
        )
        activity_logs.append("Audited brand boundaries, pillars, and verified offers.")

        # 2. Structure 4-Tier Epistemic Truth Items
        confirmed_facts: list[TruthTierItem] = []
        for fact in brand_context.confirmed_facts:
            confirmed_facts.append(
                TruthTierItem(
                    tier="verified_fact",
                    statement=fact,
                    source_reference="Database: clients / brand_profiles table",
                )
            )

        inferred_insights: list[TruthTierItem] = []
        for assumption in brand_context.assumptions:
            inferred_insights.append(
                TruthTierItem(
                    tier="inferred_insight",
                    statement=assumption,
                    source_reference="Inference from industry & confirmed parameters",
                )
            )

        hypotheses_to_validate: list[TruthTierItem] = []
        if brand_context.brand_voice:
            hypotheses_to_validate.append(
                TruthTierItem(
                    tier="hypothesis_to_validate",
                    statement=f"Prescribed tone aligns with: {', '.join(brand_context.brand_voice)}",
                    source_reference="Client Voice Guidelines (Requires ongoing resonance validation)",
                )
            )

        missing_information_questions: list[TruthTierItem] = []
        for gap in brand_context.knowledge_gaps:
            question = f"Could you provide clarification on: {gap}?"
            missing_information_questions.append(
                TruthTierItem(
                    tier="missing_information",
                    statement=gap,
                    clarifying_question=question,
                )
            )

        # 3. Construct Typed Artifact Payload
        payload = BrandPositioningPayload(
            business_name=brand_context.business_name,
            brand_voice=brand_context.brand_voice,
            confirmed_facts=confirmed_facts,
            inferred_insights=inferred_insights,
            hypotheses_to_validate=hypotheses_to_validate,
            missing_information_questions=missing_information_questions,
        )

        # 4. Synthesize Conversational Answer using Groq LLM
        brief_objective = getattr(context.campaign_brief, "objective", None) or ""
        brief_custom = getattr(context.campaign_brief, "custom_brief", None) or ""

        prompt = f"""You are the Brand Identity Specialist for AgencyOS.
A user asked: "{query}"

Client Reality & Positioning:
- Business: {brand_context.business_name}
- Industry: {brand_context.industry or 'General'}
- Sprint Objective: {brief_objective if brief_objective else 'Targeted B2B performance sprint'}
- Sprint Context: {brief_custom if brief_custom else 'Deliver high-impact authority content'}
- Confirmed Facts: {[f.statement for f in confirmed_facts] if confirmed_facts else 'None on file'}
- Brand Voice: {', '.join(brand_context.brand_voice) if brand_context.brand_voice else 'Authoritative, Technical, Minimalist'}
- Brand Positioning: {brand_context.brand_positioning or 'Enterprise Cloud Optimization'}
- Content Pillars: {', '.join(brand_context.content_pillars) if brand_context.content_pillars else 'Core Value Props'}
- Prohibited Claims: {[c.claim for c in brand_context.prohibited_claims]}
- Prohibited Terms: {[t.term for t in brand_context.prohibited_terms]}
- Knowledge Gaps: {[g.statement for g in missing_information_questions]}

CRITICAL EXECUTION GUIDELINES:
1. STRUCTURE & DEPTH (NO SINGLE-PARAGRAPH COMPRESSION):
   - When the user asks for multi-part breakdowns (such as tone audits, ICP pain-point breakdowns, or boundary claims lists), DO NOT compress everything into a single cramped paragraph!
   - Organize your response using clear markdown headings (e.g. `### Tone & Voice Alignment`, `### Ideal Customer Profile (ICP) Breakdown`, `### Strict Boundary Claims to Avoid`), bullet points, and numbered lists.
   - Fully enumerate all items requested by the user. If the user asks for 3 boundary claims, list all 3 completely (1, 2, and 3) with full context and the specific reason to avoid each claim. NEVER cut off mid-enumeration!

2. TECHNICAL GROUNDING & SPECIFICITY (NO GENERIC FLUFF):
   - When profiling ICPs (such as VP of Engineering, CTO, DevOps Lead, or FinOps Director), ground their pain points directly in the client's concrete technical domain and sprint themes (e.g. tail-latency spikes under load, SLA/SLO breach risks, pulling engineers off roadmaps for triage, unpredictable cross-region data egress line items, untagged cloud transfer spend, delayed billing visibility, quarterly cloud forecast variance).
   - Avoid generic textbook platitudes like "they care about scalability, reliability, and cost". Detail the real operational tensions and workflow friction they face daily.

3. BOUNDARY CLAIMS & ANTI-HYPE HYGIENE:
   - Identify concrete, realistic boundary claims that an enterprise buyer would perceive as cheap AI hype or unrealistic marketing fluff (e.g. "Eliminates 100% of downtime with autonomous AI", "Guarantees 10x speedup overnight", "Unqualified zero-latency promises").
   - Explain why each claim damages enterprise trust and propose the compliant, authoritative alternative.

4. ACCURACY & EVIDENCE:
   - If recommending metric-driven or customer story pillars without confirmed case studies in brand records, explicitly flag '[CLIENT_INPUT_NEEDED]: <explanation of what proof is needed>'.
   - Maintain an authoritative, minimalist, and expert executive tone.
"""

        try:
            llm_reply: BrandConversationalReply = await invoke_structured_llm(
                prompt=prompt,
                schema_class=BrandConversationalReply,
                temperature=0.2,
                model=settings.FALLBACK_MODEL,
                max_tokens=1500,
            )
            reply_text = llm_reply.conversational_summary
            followups = llm_reply.suggested_followups or [
                "Clarify content pillars",
                "Define ideal customer profile",
                "Audit prohibited claims list",
            ]
        except Exception as ex:
            logger.warning(f"Error generating conversational reply for brand specialist: {ex}")
            reply_text = (
                f"I've audited the brand guidelines for **{brand_context.business_name}**. "
                f"We have {len(confirmed_facts)} confirmed database facts and {len(missing_information_questions)} "
                f"knowledge gaps identified for your review."
            )
            followups = ["Clarify missing brand information", "Review prohibited claims"]

        # Deterministic check: surface [CLIENT_INPUT_NEEDED] if suggesting case-study / metric pillars without confirmed proof
        has_verified_proof = any(
            any(k in f.lower() for k in ("case study", "case-study", "testimonial", "customer success", "client story", "client results", "roi", "metric"))
            for f in brand_context.confirmed_facts
        )
        needs_proof_keywords = (
            "case stud", "customer success", "customer stor", "client stor",
            "measurable outcome", "benchmark", "metrics-driven", "data-backed"
        )
        reply_lower = reply_text.lower()
        if any(kw in reply_lower for kw in needs_proof_keywords) and not has_verified_proof:
            if "[CLIENT_INPUT_NEEDED]" not in reply_text:
                missing_detail = "Verified case studies and measurable customer success metrics are currently missing from brand records."
                for g in brand_context.knowledge_gaps:
                    if any(k in g.lower() for k in ("case study", "testimonial", "metric", "proof", "pricing", "result")):
                        missing_detail = g
                        break
                missing_detail_clean = missing_detail.rstrip()
                if not missing_detail_clean.endswith((".", "!", "?")):
                    missing_detail_clean += "."
                reply_text += (
                    f"\n\n⚠️ **[CLIENT_INPUT_NEEDED]**: {missing_detail_clean} "
                    f"Client input is required before publishing proof-oriented deliverables."
                )

        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=reply_text,
            artifact_type=ArtifactType.brand_positioning,
            artifact_payload=payload.model_dump(),
            activity_logs=activity_logs,
            suggested_followups=followups,
        )
