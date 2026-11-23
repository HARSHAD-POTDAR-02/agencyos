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
    crawl_client_website,
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
    """Structured LLM output for tone interpretation, positioning, and semantic claim validation."""
    brand_positioning: str | None = Field(default=None, description="Concise brand positioning statement synthesized from facts and website")
    tone_do: list[str] = Field(default_factory=list, description="Prescribed tone practices based on voice and past feedback")
    tone_dont: list[str] = Field(default_factory=list, description="Proscribed tone practices based on voice and past feedback")
    semantic_conflicts: list[str] = Field(default_factory=list, description="Semantic contradictions between brief requests and brand rules")
    assumptions: list[str] = Field(default_factory=list, description="Explicit inferences made to fill context without fabricating facts")
    additional_knowledge_gaps: list[str] = Field(default_factory=list, description="Missing brand guidance that should be clarified")
    prohibited_concepts: list[str] = Field(default_factory=list, description="Semantic equivalents or prohibited concepts derived from rules")
    website_extracted_facts: list[str] = Field(default_factory=list, description="Facts extracted directly from crawled website text")
    website_extracted_offers: list[dict[str, str]] = Field(default_factory=list, description="Products/services discovered with 'name', 'description', and 'source_url'")


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
        self.model_name = model_name or settings.GROQ_MODEL
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
        location = getattr(client, "location", None)
        if location:
            confirmed_facts.append(f"Client location: '{location}'")
        if client.industry:
            confirmed_facts.append(f"Client verified industry: '{client.industry}'")
        if client.website:
            confirmed_facts.append(f"Client verified website: '{client.website}'")

        db_confirmed_facts = list(confirmed_facts)

        knowledge_gaps: list[str] = []
        brand_voice: list[str] = []
        tone_examples: list[str] = []
        approved_phrases: list[str] = []
        prohibited_terms: list[ProhibitedTerm] = []
        prohibited_claims: list[ProhibitedClaim] = []
        prohibited_concepts: list[str] = []
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

            # Parse tone examples
            if getattr(brand_profile, "tone_examples", None):
                raw_tones = brand_profile.tone_examples
                if isinstance(raw_tones, str):
                    tone_examples = [t.strip() for t in raw_tones.splitlines() if t.strip()]
                    if not tone_examples:
                        tone_examples = [t.strip() for t in raw_tones.split(",") if t.strip()]
                elif isinstance(raw_tones, list):
                    tone_examples = [str(t).strip() for t in raw_tones if str(t).strip()]

            # Parse prohibited claims & terms
            if brand_profile.prohibited_claims:
                raw_claims = brand_profile.prohibited_claims
                if isinstance(raw_claims, list):
                    for item in raw_claims:
                        if isinstance(item, dict):
                            claim_text = item.get("claim", str(item))
                            prohibited_claims.append(
                                ProhibitedClaim(
                                    claim=claim_text,
                                    semantic_context=item.get("context"),
                                    reason=item.get("reason"),
                                )
                            )
                            prohibited_concepts.append(claim_text)
                        else:
                            prohibited_claims.append(ProhibitedClaim(claim=str(item)))
                            prohibited_concepts.append(str(item))
                elif isinstance(raw_claims, dict):
                    for k, v in raw_claims.items():
                        if k == "exact_terms" and isinstance(v, list):
                            for term in v:
                                prohibited_terms.append(ProhibitedTerm(term=str(term), is_exact_match=True))
                                prohibited_concepts.append(str(term))
                        else:
                            prohibited_claims.append(ProhibitedClaim(claim=f"{k}: {v}"))
                            prohibited_concepts.append(f"{k}: {v}")

        if verified_offers:
            confirmed_facts.append(f"Verified offers found in database: {', '.join([o.name for o in verified_offers])}")

        # 2a. Deterministically load active Cortex BrandFacts (Guardrails, Taboos, Personas)
        try:
            from app.services.cortex_service import cortex_service
            cortex_rules = await cortex_service.get_deterministic_rules(
                db=db,
                client_id=brief.client_id,
                channel="all",
            )
            for g in cortex_rules.get("guardrails", []):
                db_confirmed_facts.append(f"[CORTEX GUARDRAIL] {g.statement}")
                tone_examples.append(g.statement)
            for t in cortex_rules.get("taboos", []):
                prohibited_terms.append(ProhibitedTerm(term=t.statement, is_exact_match=False))
                prohibited_claims.append(ProhibitedClaim(claim=t.statement, reason=t.rationale or "Cortex Active Taboo"))
                prohibited_concepts.append(t.statement)
            for p in cortex_rules.get("personas", []):
                target_audience.append(f"[CORTEX AUDIENCE PERSONA] {p.statement}")
            logger.info(
                f"Grounding BrandIntelligence with Cortex Memory: {len(cortex_rules.get('guardrails', []))} guardrails, "
                f"{len(cortex_rules.get('taboos', []))} taboos, {len(cortex_rules.get('personas', []))} personas."
            )
        except Exception as cortex_err:
            logger.warning(f"Could not load Cortex Memory into BrandIntelligenceAgent: {cortex_err}")

        # 2b. Trigger Website Crawler if client.website is set AND profile is missing key fields
        crawled_website_data: dict[str, Any] = {}
        should_crawl = bool(
            client.website
            and (
                not brand_profile
                or not brand_voice
                or not target_audience
                or not content_pillars
                or len(db_confirmed_facts) < 2
            )
        )
        if should_crawl:
            try:
                crawled_website_data = await crawl_client_website(
                    client_website=client.website,
                    max_pages=4,
                    db=db,
                    brand_profile=brand_profile,
                )
            except Exception as crawl_err:
                logger.warning(f"crawl_client_website failed for {client.website}: {crawl_err}")

        crawled_urls: set[str] = {p["url"] for p in crawled_website_data.get("pages", []) if isinstance(p, dict) and "url" in p}
        crawled_combined_text = crawled_website_data.get("combined_text", "")

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
                crawled_combined_text=crawled_combined_text,
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

            # 1. Positioning synthesis
            if llm_result.brand_positioning:
                brand_positioning = llm_result.brand_positioning
                assumptions.append("[INFERRED_NEEDS_REVIEW] Positioning synthesized from website/context")

            # 2. Prohibited concepts
            for pc in llm_result.prohibited_concepts:
                if pc and pc.strip() and pc.strip() not in prohibited_concepts:
                    prohibited_concepts.append(pc.strip())

            # 3. Deterministic Python Post-Filter on Website-Extracted Facts
            for raw_fact in llm_result.website_extracted_facts:
                fact_str = str(raw_fact).strip()
                if not fact_str:
                    continue
                matched_url = next((u for u in crawled_urls if u in fact_str), None)
                if matched_url:
                    clean_fact = fact_str if fact_str.startswith("[Website Confirmed") else f"[Website Confirmed | {matched_url}] {fact_str}"
                    if clean_fact not in confirmed_facts:
                        confirmed_facts.append(clean_fact)
                else:
                    # No matching crawled URL in this run -> Demote to assumptions
                    assumptions.append(f"[INFERRED_NEEDS_REVIEW] {fact_str}")

            # 4. Website-Extracted Offers (Must match a crawled URL)
            for raw_offer in llm_result.website_extracted_offers:
                if isinstance(raw_offer, dict) and raw_offer.get("name"):
                    offer_name = str(raw_offer["name"]).strip()
                    offer_desc = str(raw_offer.get("description", "")).strip()
                    source_url = str(raw_offer.get("source_url", "")).strip()
                    if source_url and any(u in source_url for u in crawled_urls):
                        if offer_name and not any(o.name.lower() == offer_name.lower() for o in verified_offers):
                            verified_offers.append(
                                VerifiedOffer(
                                    name=offer_name,
                                    description=offer_desc,
                                    source="client_website",
                                    is_verified=True,
                                )
                            )
                    else:
                        assumptions.append(f"[INFERRED_NEEDS_REVIEW] Offer without crawled source citation: {offer_name}")

        except Exception as e:
            logger.error(f"Error during LLM brand synthesis: {e}")
            assumptions.append("LLM tone synthesis encountered an error; using default deterministic boundaries.")

        # Commercial fact gaps check
        if not any("pricing" in f.lower() for f in confirmed_facts):
            knowledge_gaps.append("No verified pricing tiers found")
        if not any("testimonial" in f.lower() or "case study" in f.lower() for f in confirmed_facts):
            knowledge_gaps.append("No verified client testimonials or case-study metrics")

        # 5. Build and return final validated BrandContext
        return BrandContext(
            client_id=client.id,
            agency_id=client.agency_id,
            business_name=client.business_name,
            industry=client.industry,
            location=location,
            website=client.website,
            brand_positioning=brand_positioning,
            brand_voice=brand_voice,
            tone_guidelines=tone_guideline,
            tone_examples=tone_examples,
            target_audience=target_audience,
            content_pillars=content_pillars,
            approved_phrases=approved_phrases,
            prohibited_terms=prohibited_terms,
            prohibited_claims=prohibited_claims,
            prohibited_concepts=prohibited_concepts,
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
        crawled_combined_text: str = "",
    ) -> str:
        """Construct the prompt for Groq LLM synthesis."""
        website_section = (
            f"\n### CRAWLED CLIENT WEBSITE TEXT (Empirical Context)\n{crawled_combined_text}\n"
            if crawled_combined_text else ""
        )
        return f"""You are the Brand Intelligence Agent for AgencyOS.
Analyze the confirmed client brand data and historical feedback to extract actionable tone guardrails, positioning, and detect semantic policy violations.

### CONFIRMED CLIENT FACTS (Immutable)
- Business Name: {client.business_name}
- Industry: {client.industry or 'Unspecified'}
- Location: {getattr(client, 'location', 'Unspecified') or 'Unspecified'}
- Brand Voice: {', '.join(brand_voice) if brand_voice else 'None specified'}
- Target Audience: {', '.join(target_audience) if target_audience else 'None specified'}
- Content Pillars: {', '.join(content_pillars) if content_pillars else 'None specified'}
- Approved Phrases: {', '.join(approved_phrases) if approved_phrases else 'None specified'}
{website_section}
### PROHIBITED CLAIMS (Brand Boundaries)
{chr(10).join([f"- {pc.claim} (Reason: {pc.reason or 'Unspecified'})" for pc in prohibited_claims]) if prohibited_claims else 'None configured'}

### HISTORICAL REVIEWER FEEDBACK
{chr(10).join([f"- [{f.classification.value}] {f.content}" for f in feedback_history]) if feedback_history else 'No past feedback recorded'}

### CAMPAIGN BRIEF
- Objective: {brief.objective}
- Custom Brief: {brief.custom_brief or 'None'}
- Constraints: {', '.join(brief.additional_constraints) if brief.additional_constraints else 'None'}

### YOUR TASK
1. brand_positioning:
   - Provide a concise 1-2 sentence brand positioning statement synthesized from confirmed facts and website.
2. Tone Guidelines:
   - Formulate actionable 'tone_do' (prescribed tone practices tailored to this industry and brand voice).
   - Formulate actionable 'tone_dont' (proscribed tone practices, integrating reviewer feedback).
3. Semantic Conflicts:
   - Identify whether any statement in the campaign brief contradicts the spirit of the prohibited claims.
4. prohibited_concepts:
   - Identify semantic equivalents of prohibited claims to prevent creative bypasses.
5. website_extracted_facts & website_extracted_offers:
   - Extract up to 4 empirical facts and any concrete product/service offerings explicitly present in the crawled text.
6. Assumptions & Knowledge Gaps:
   - Transparently list inferences and missing information without fabricating data.
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
    model_name = settings.GROQ_MODEL

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

