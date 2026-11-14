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
    conversational_summary: str
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
        prompt = f"""You are the Brand Identity Specialist for AgencyOS.
A user asked: "{query}"

Client Reality:
- Business: {brand_context.business_name}
- Industry: {brand_context.industry or 'General'}
- Confirmed Facts: {len(confirmed_facts)} verified items
- Brand Voice: {', '.join(brand_context.brand_voice) if brand_context.brand_voice else 'Authoritative, Professional'}
- Content Pillars: {', '.join(brand_context.content_pillars) if brand_context.content_pillars else 'Core Value Props'}
- Prohibited Claims: {[c.claim for c in brand_context.prohibited_claims]}
- Knowledge Gaps: {[g.statement for g in missing_information_questions]}

CRITICAL RULES:
1. Never hallucinate or invent fake customer personas, fabricated pain points, or fake review quotes.
2. Directly answer the user's specific query.
3. If information is missing, explicitly list clarifying questions instead of guessing.
4. Keep the conversational summary concise and executive in tone.
"""

        try:
            llm_reply: BrandConversationalReply = await invoke_structured_llm(
                prompt=prompt,
                schema_class=BrandConversationalReply,
                temperature=0.2,
                model=settings.FALLBACK_MODEL,
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

        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=reply_text,
            artifact_type=ArtifactType.brand_positioning,
            artifact_payload=payload.model_dump(),
            activity_logs=activity_logs,
            suggested_followups=followups,
        )
