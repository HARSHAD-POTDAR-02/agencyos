from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ContractQuota,
    FeedbackItem,
    ProhibitedClaim,
    ProhibitedTerm,
    ToneGuideline,
    VerifiedOffer,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.campaign_intelligence.tools.brand_tools import (
    ClientNotFoundError,
    detect_exact_prohibited_term_conflicts,
    get_client_and_brand_profile,
    get_client_contract_quotas,
    get_client_verified_offers,
    retrieve_client_feedback_history,
)
from app.core.config import settings
from app.core.llm import invoke_structured_llm
from app.models.brand_profile import BrandProfile
from app.models.client import Client

logger = logging.getLogger(__name__)


class BrandSynthesisOutput(BaseModel):
    """Structured LLM output for tone interpretation and semantic claim validation."""
    tone_do: list[str] = Field(default_factory=list, description="Prescribed tone practices based on voice and past feedback")
    tone_dont: list[str] = Field(default_factory=list, description="Proscribed tone practices based on voice and past feedback")
    semantic_conflicts: list[str] = Field(default_factory=list, description="Semantic contradictions between brief requests and brand rules")
    assumptions: list[str] = Field(default_factory=list, description="Explicit inferences made to fill context without fabricating facts")
    additional_knowledge_gaps: list[str] = Field(default_factory=list, description="Missing brand guidance that should be clarified")


class BrandIntelligenceAgent:
    """
    Agent 1: Brand Intelligence
    
    Responsibilities:
    1. Deterministically retrieve client brand profile, contracts, and feedback history.
    2. Enforce strict multi-tenant isolation.
    3. Detect deterministic exact prohibited-term conflicts before LLM invocation.
    4. Use centralized LLM for nuanced tone synthesis and semantic claim contradiction detection.
    5. Construct final BrandContext with rigid epistemic separation:
       - Confirmed DB facts cannot be overwritten by LLM.
       - Missing information is reported in knowledge_gaps (zero fake data).
       - Inferences are labeled in assumptions.
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.1):
        self.model_name = model_name or settings.FALLBACK_MODEL
        self.temperature = temperature

    async def run(
        self,
        brief: CampaignBrief,
        db: AsyncSession,
    ) -> BrandContext:
        """
        Execute the Brand Intelligence workflow against the database and Groq LLM.
        """
        # 1. Deterministic database retrieval
        client, brand_profile = await get_client_and_brand_profile(brief.client_id, brief.agency_id, db)
        quotas = await get_client_contract_quotas(brief.client_id, brief.agency_id, db)
        feedback_history = await retrieve_client_feedback_history(brief.client_id, brief.agency_id, db)
        verified_offers = await get_client_verified_offers(brief.client_id, brief.agency_id, db, brand_profile)

        # 2. Extract and structure confirmed database fields
        confirmed_facts: list[str] = [
            f"Client business name: '{client.business_name}'",
        ]
        if client.industry:
            confirmed_facts.append(f"Client verified industry: '{client.industry}'")
        if client.website:
            confirmed_facts.append(f"Client verified website: '{client.website}'")

        knowledge_gaps: list[str] = []
        brand_voice: list[str] = []
        approved_phrases: list[str] = []
        prohibited_terms: list[ProhibitedTerm] = []
        prohibited_claims: list[ProhibitedClaim] = []
        target_audience: list[str] = []
        content_pillars: list[str] = []
        brand_positioning: str | None = None

        if not brand_profile:
            knowledge_gaps.append("No BrandProfile record exists in the database for this client.")
            knowledge_gaps.append("Brand voice, approved phrases, content pillars, and prohibited claims are unconfigured.")
        else:
            if brand_profile.is_confirmed:
                confirmed_facts.append("Brand profile is formally confirmed by the client or account manager.")
            else:
                knowledge_gaps.append("Brand profile is unconfirmed (draft status).")

            # Parse voice
            if brand_profile.brand_voice:
                if isinstance(brand_profile.brand_voice, str):
                    # Could be comma-separated or sentence
                    brand_voice = [v.strip() for v in brand_profile.brand_voice.split(",") if v.strip()]
                elif isinstance(brand_profile.brand_voice, list):
                    brand_voice = [str(v) for v in brand_profile.brand_voice]
            else:
                knowledge_gaps.append("Brand voice is not explicitly configured in BrandProfile.")

            # Parse target audience
            if brand_profile.target_audience:
                if isinstance(brand_profile.target_audience, list):
                    target_audience = [str(a) for a in brand_profile.target_audience]
                elif isinstance(brand_profile.target_audience, dict):
                    target_audience = [f"{k}: {v}" for k, v in brand_profile.target_audience.items()]
            if not target_audience:
                knowledge_gaps.append("Target audience is not explicitly configured in BrandProfile.")

            # Parse content pillars
            if brand_profile.content_pillars:
                if isinstance(brand_profile.content_pillars, list):
                    content_pillars = [str(p) for p in brand_profile.content_pillars]
                elif isinstance(brand_profile.content_pillars, dict):
                    content_pillars = [f"{k}: {v}" for k, v in brand_profile.content_pillars.items()]
            if not content_pillars:
                knowledge_gaps.append("Content pillars are not explicitly configured in BrandProfile.")

            # Parse approved phrases
            if brand_profile.approved_phrases:
                if isinstance(brand_profile.approved_phrases, list):
                    approved_phrases = [str(p) for p in brand_profile.approved_phrases]
                elif isinstance(brand_profile.approved_phrases, dict):
                    approved_phrases = [str(v) for v in brand_profile.approved_phrases.values()]

            # Parse prohibited claims & terms
            if brand_profile.prohibited_claims:
                raw_claims = brand_profile.prohibited_claims
                if isinstance(raw_claims, list):
                    for item in raw_claims:
                        if isinstance(item, dict):
                            prohibited_claims.append(
                                ProhibitedClaim(
                                    claim=item.get("claim", str(item)),
                                    semantic_context=item.get("context"),
                                    reason=item.get("reason"),
                                )
                            )
                        else:
                            prohibited_claims.append(ProhibitedClaim(claim=str(item)))
                elif isinstance(raw_claims, dict):
                    for k, v in raw_claims.items():
                        if k == "exact_terms" and isinstance(v, list):
                            for term in v:
                                prohibited_terms.append(ProhibitedTerm(term=str(term), is_exact_match=True))
                        else:
                            prohibited_claims.append(ProhibitedClaim(claim=f"{k}: {v}"))

            # Brand positioning check (do not hallucinate!)
            # If not in DB, keep None
            knowledge_gaps.append("Brand positioning statement is not explicitly defined in the database.")

        if verified_offers:
            confirmed_facts.append(f"Verified offers found in database: {', '.join([o.name for o in verified_offers])}")

        # 3. Deterministic Pre-LLM Conflict Detection (Exact Term Matching)
        conflicts: list[str] = detect_exact_prohibited_term_conflicts(brief, prohibited_terms)

        # 4. LLM Synthesis for Nuanced Tone & Semantic Contradictions
        tone_guideline = ToneGuideline()
        assumptions: list[str] = []

        try:
            prompt = self._build_synthesis_prompt(
                client=client,
                brand_voice=brand_voice,
                target_audience=target_audience,
                content_pillars=content_pillars,
                approved_phrases=approved_phrases,
                prohibited_claims=prohibited_claims,
                feedback_history=feedback_history,
                brief=brief,
            )

            llm_result: BrandSynthesisOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=BrandSynthesisOutput,
                temperature=self.temperature,
                model=self.model_name,
            )

            tone_guideline = ToneGuideline(
                do=llm_result.tone_do,
                dont=llm_result.tone_dont,
            )
            assumptions.extend(llm_result.assumptions)
            conflicts.extend(llm_result.semantic_conflicts)
            knowledge_gaps.extend(llm_result.additional_knowledge_gaps)

        except Exception as e:
            logger.error(f"Error during LLM brand synthesis: {e}")
            assumptions.append("LLM tone synthesis encountered an error; using default deterministic boundaries.")

        # 5. Build and return final validated BrandContext
        return BrandContext(
            client_id=client.id,
            agency_id=client.agency_id,
            business_name=client.business_name,
            industry=client.industry,
            website=client.website,
            brand_positioning=brand_positioning,
            brand_voice=brand_voice,
            tone_guidelines=tone_guideline,
            target_audience=target_audience,
            content_pillars=content_pillars,
            approved_phrases=approved_phrases,
            prohibited_terms=prohibited_terms,
            prohibited_claims=prohibited_claims,
            verified_offers=verified_offers,
            contract_quotas=quotas,
            classified_feedback=feedback_history,
            confirmed_facts=confirmed_facts,
            assumptions=assumptions,
            conflicts=conflicts,
            knowledge_gaps=knowledge_gaps,
        )

    def _build_synthesis_prompt(
        self,
        client: Client,
        brand_voice: list[str],
        target_audience: list[str],
        content_pillars: list[str],
        approved_phrases: list[str],
        prohibited_claims: list[ProhibitedClaim],
        feedback_history: list[FeedbackItem],
        brief: CampaignBrief,
    ) -> str:
        """Construct the prompt for Groq LLM synthesis."""
        return f"""You are the Brand Intelligence Agent for AgencyOS.
Analyze the confirmed client brand data and historical feedback to extract actionable tone guardrails and detect semantic policy violations.

### CONFIRMED CLIENT FACTS (Immutable)
- Business Name: {client.business_name}
- Industry: {client.industry or 'Unspecified'}
- Brand Voice: {', '.join(brand_voice) if brand_voice else 'None specified'}
- Target Audience: {', '.join(target_audience) if target_audience else 'None specified'}
- Content Pillars: {', '.join(content_pillars) if content_pillars else 'None specified'}
- Approved Phrases: {', '.join(approved_phrases) if approved_phrases else 'None specified'}

### PROHIBITED CLAIMS (Brand Boundaries)
{chr(10).join([f"- {pc.claim} (Reason: {pc.reason or 'Unspecified'})" for pc in prohibited_claims]) if prohibited_claims else 'None configured'}

### HISTORICAL REVIEWER FEEDBACK
{chr(10).join([f"- [{f.classification.value}] {f.content}" for f in feedback_history]) if feedback_history else 'No past feedback recorded'}

### CAMPAIGN BRIEF
- Objective: {brief.objective}
- Custom Brief: {brief.custom_brief or 'None'}
- Constraints: {', '.join(brief.additional_constraints) if brief.additional_constraints else 'None'}

### YOUR TASK
1. Tone Guidelines:
   - Formulate actionable 'tone_do' (prescribed tone practices tailored to this industry and brand voice).
   - Formulate actionable 'tone_dont' (proscribed tone practices, integrating reviewer feedback).
2. Semantic Conflicts:
   - Identify whether any statement in the campaign brief contradicts the spirit of the prohibited claims (e.g. guaranteeing 100% bug-free uptime, promising unverified savings, or violating explicit reviewer rules).
3. Assumptions:
   - List any necessary inferences you had to make about the brand due to unconfigured fields.
4. Knowledge Gaps:
   - List any critical missing brand assets or guidelines needed for production.

IMPORTANT: Do NOT invent positioning statements, fake client awards, or ungrounded claims. Ground your analysis strictly in the provided brand data.
"""


async def brand_intelligence_node(
    state: CampaignState,
    db_session_factory: Callable[[], AsyncSession],
) -> dict[str, Any]:
    """
    LangGraph node entry point for Brand Intelligence Agent.
    
    1. Obtains a fresh AsyncSession from db_session_factory (never stored in state).
    2. Runs BrandIntelligenceAgent.
    3. Records execution telemetry (AgentTelemetry).
    4. Returns updates for brand_context, pipeline_agents_executed, and agent_traces.
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "brand_intelligence"
    model_name = settings.FALLBACK_MODEL

    try:
        async with db_session_factory() as db:
            agent = BrandIntelligenceAgent(model_name=model_name)
            brand_context = await agent.run(brief=state["brief"], db=db)

        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()

        telemetry = AgentTelemetry(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            model_name=model_name,
            success=True,
        )

        return {
            "brand_context": brand_context,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Brand Intelligence failed: {str(e)}"
        logger.error(err_msg, exc_info=True)

        telemetry = AgentTelemetry(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            model_name=model_name,
            success=False,
            error_message=str(e),
        )

        return {
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "errors": [err_msg],
            "current_agent": agent_name,
        }

