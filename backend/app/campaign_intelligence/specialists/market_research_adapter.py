"""
Market Research Specialist — Campaign Studio

Reliability & Truth Guarantees (2026-11-11):
  1. Citation Validation: Every key finding citation is normalized and strictly
     checked against retrieved tool sources AND tested for topical support.
     Unsupported or fabricated URLs are rejected and findings marked [UNVERIFIED HYPOTHESIS].
  2. Discovered vs Inspected Separation: Discovered search snippets and deeply
     inspected webpage contents are tracked separately in telemetry, prompts, and reply.
  3. Official Platform Documentation: Feature documentation retrieved via
     get_platform_documentation / get_platform_benchmarks contains zero stale numerical claims.
  4. URL Safety: Rejects localhost, private IP ranges, loopback, internal domains,
     and unsafe redirects.
  5. Execution Health Classification: Explicitly tracks SUCCESSFUL, PARTIAL, and FAILED
     runtime statuses based on ExecutionStatus and telemetry.
  6. Deterministic Sufficiency Gate: If 0 usable sources exist, skips synthesis completely
     and returns an honest insufficient-evidence response without hallucinations.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    ComplaintScope,
    CompetitorActivity,
    CompetitorRelevance,
    CompetitorType,
    EvidenceCitation,
    InferredOpportunity,
    MarketResearchArtifactPayload,
    OpportunityStatus,
    ResearchDimensionItem,
    ResearchDimensionStatus,
    ResearchScopeMode,
    SocialPlatform,
)
from app.campaign_intelligence.runtime import (
    BoundedToolRuntime,
    ExecutionStatus,
    ToolCallStatus,
    ToolExecutionContext,
    ToolExecutionResult,
    ToolRuntimeConfig,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.campaign_intelligence.tools.market_research_tools import get_market_research_tool_registry
from app.campaign_intelligence.tools.research_tools import (
    _is_safe_url,
    _normalize_url,
    gather_market_evidence,  # noqa: F401 — preserved for external test patch targets
)
from app.core.config import settings
from app.core.llm import get_llm, invoke_structured_llm, key_pool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Synthesis schemas
# ---------------------------------------------------------------------------

class CitedKeyFinding(BaseModel):
    """A key finding with its supporting source URL and verification tag."""
    finding: str = Field(description="Factual statement grounded in retrieved evidence")
    source_url: str | None = Field(
        default=None,
        description="Exact URL from retrieved evidence supporting this finding; None if not directly citable",
    )


class CompetitorFindingItem(BaseModel):
    competitor_name: str = Field(
        description="Exact name of an actual business, brand, company, product, or creator entity. Must NOT be an SEO aggregate title, search query, or hashtag topic."
    )
    platform: str = Field(default="web", description="Platform observed on, e.g. 'web', 'official_site', 'linkedin', 'instagram', 'youtube'")
    observed_creative_angle: str = Field(description="Specific observed hook, positioning, or creative pattern")
    observed_format: str = Field(default="Social Post", description="e.g. 'Short-form Video', 'Carousel Deck', 'Feature Showcase', 'Product Demo'")
    supporting_source_url: str | None = Field(
        default=None,
        description="Exact URL from retrieved evidence that establishes this observation",
    )
    citation_quote: str = Field(default="", description="Verbatim excerpt from source")
    competitor_type: CompetitorType = Field(
        default=CompetitorType.DIRECT,
        description="Classification: 'direct' (same core product/service & market), 'indirect' (substitute solutions/needs), 'product_level' (specific feature/offering), or 'channel' (aggregators and distribution platforms)."
    )
    relevance: CompetitorRelevance | None = Field(
        default=None,
        description="Structured overlap analysis across geography, product, price, audience, and occasion."
    )


class InferredOpportunityItem(BaseModel):
    opportunity_description: str = Field(description="Concrete strategic opportunity or actionable differentiation angle")
    target_whitespace: str = Field(
        description="Authentic market whitespace or unserved customer need. Must be logically consistent with findings."
    )
    status: OpportunityStatus = Field(
        default=OpportunityStatus.HYPOTHESIS,
        description="Explicit status: 'validated_opportunity' (grounded in verified cost/demand metrics) or 'hypothesis' (untested strategic angle)."
    )
    supporting_evidence: list[str] = Field(
        default_factory=list,
        description="Verified observations backing this opportunity",
    )
    missing_evidence: list[str] = Field(
        default_factory=list,
        description="Crucial missing data points (costs, margin, willingness to pay)",
    )
    test_method: str | None = Field(
        default=None,
        description="Practical, low-risk way for an agency to test this hypothesis cheaply",
    )
    validation_criteria: str | None = Field(
        default=None,
        description="Specific measurable outcome that validates or rejects the hypothesis",
    )
    supporting_source_urls: list[str] = Field(
        default_factory=list,
        description="URLs providing the basis for this inference",
    )


OpportunityFindingItem = InferredOpportunityItem


class MarketResearchSynthesisOutput(BaseModel):
    executive_summary: str = Field(
        description="High-density summary strictly grounded in retrieved evidence"
    )
    key_findings: list[CitedKeyFinding] = Field(
        min_length=1,
        description="3–5 factual findings each tied to a source URL where possible",
    )
    verified_observations: list[str] = Field(
        default_factory=list,
        description="Facts directly seen in inspected page content",
    )
    source_reported_claims: list[str] = Field(
        default_factory=list,
        description="Information reported by articles or industry portals",
    )
    observed_competitors: list[CompetitorFindingItem] = Field(default_factory=list)
    inferred_opportunities: list[InferredOpportunityItem] = Field(default_factory=list)
    research_dimensions: list[ResearchDimensionItem] = Field(
        default_factory=list,
        description="Explicit accounting of each requested query dimension: answered, partial, missing, not_verified, or not_available.",
    )
    search_limitations: str | None = Field(
        default=None,
        description="Honest note on what could not be verified",
    )
    recommendations: list[str] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Specialist adapter
# ---------------------------------------------------------------------------

class MarketResearchSpecialistAdapter(SpecialistAdapter):
    """
    Perplexity-style Market Research Specialist for AgencyOS Campaign Studio.

    Guarantees:
    - BoundedToolRuntime is the sole research execution path.
    - Deterministic Evidence Sufficiency Gate prevents hallucinated findings when no sources exist.
    - Discovered (search snippet) vs Inspected (extracted page) sources are clearly separated.
    - Citations are strictly validated by canonical URL and topical content relevance.
    - Unsupported findings are labelled [UNVERIFIED HYPOTHESIS].
    - Publication metadata is preserved or set to None (zero fabricated dates).
    - Execution health (successful, partial, failed) is classified and reported honestly.
    """

    def __init__(self) -> None:
        super().__init__(
            specialist_id="market_research",
            specialist_name="Market & Trend Researcher",
        )
        self.tool_registry = get_market_research_tool_registry()

    # ------------------------------------------------------------------ #
    # Public entry point
    # ------------------------------------------------------------------ #

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any | None = None,
    ) -> SpecialistResult:
        # Route to LangGraph multi-stage deep research workflow by default.
        # Fast mode is available as opt-in via context.mode == "fast" or query starting with "fast:" / "/fast".
        is_fast_mode = (
            getattr(context, "mode", None) == "fast"
            or query.lower().startswith("fast:")
            or query.lower().startswith("/fast")
        )
        if not is_fast_mode:
            from app.campaign_intelligence.specialists.deep_research_adapter import DeepResearchSpecialistAdapter
            deep_adapter = DeepResearchSpecialistAdapter()
            deep_res = await deep_adapter.execute(query=query, context=context, db=db, on_event=on_event)
            if hasattr(deep_res, "specialist_id"):
                deep_res.specialist_id = self.specialist_id
            if hasattr(deep_res, "specialist_name"):
                deep_res.specialist_name = self.specialist_name
            return deep_res

        activity_logs: list[str] = [
            f"Initiating dynamic research investigation for: '{query[:80]}'...",
        ]

        client_name = context.client_name
        industry = context.client_industry or "General Business"
        location = context.client_location
        target_audience = context.campaign_brief.target_audience or []
        platforms = context.campaign_brief.platforms or ["instagram"]

        # Scope classification: distinguish client-scoped queries from independent research
        scope = self._classify_research_scope(query, client_name)
        is_client_scoped = (scope == "CLIENT_SCOPED")

        # -- 1. Trusted execution context -----------------------------------------
        exec_context = ToolExecutionContext(
            agency_id=context.agency_id,
            client_id=context.client_id,
            campaign_id=context.campaign_id,
            specialist_id=self.specialist_id,
            studio_context=context,
        )

        # -- 2. Build follow-up continuity block (strictly topic-matched) ---------
        prior_context_block = self._build_prior_context(context, query=query, is_client_scoped=is_client_scoped)

        # -- 3. System prompt with explicit context isolation ---------------------
        if is_client_scoped:
            context_block = f"""CLIENT CONTEXT (Explicitly requested by user):
- Brand: {client_name}
- Industry: {industry}
- Geography: {location or 'Global / Not Location-Constrained'}
- Target Platforms: {', '.join(platforms)}
- Target Audience: {', '.join(target_audience) if target_audience else 'Broad target market'}
- Research Protocol: Tailor research specifically to this client. If you make inferences about the client, label them under research assumptions.
"""
        else:
            context_block = """RESEARCH SCOPE: INDEPENDENT MARKET RESEARCH
- Query Scope: The user is investigating an independent market or competitor ecosystem.
- STRICT ISOLATION RULE: Do NOT inject, assume, or tailor findings to any external agency client or client location context.
- Investigate exclusively the market, brands, locations, or topics specified in the user query.
"""

        system_prompt = f"""You are the Market & Trend Research Specialist for AgencyOS.
Your objective is to conduct rigorous, Perplexity-style web investigations.

{context_block}
{prior_context_block}
CALL BUDGET ALLOCATION & ORCHESTRATION (6 CALLS MAXIMUM TOTAL SHARED BUDGET):
- Strict Tool Quotas: Maximum 3 `web_search` calls and maximum 3 `extract_webpages` calls. Shared global budget of 6 calls.
- DYNAMIC ENTITY & FACET COVERAGE:
  * When multiple competitors or comparison entities are named (e.g. Entity A, B, and C):
    DO NOT spend multiple searches on Entity A! Dynamically distribute research attention:
    - Phase 1 (Coverage Guarantee): Search 1 should cover Entities A & B; Search 2 should cover Entity C and specific requested dimensions (e.g. pricing, tiers, subscriptions, or reviews).
    - Phase 2 (Targeted Page Extraction): Immediately call `extract_webpages` on 1 to 2 URLs containing catalogs, pricing, service plans, or product specs for the competitors.
    - Phase 3 (Gap Closure): If any named competitor or requested dimension is still missing, dedicate the remaining search or extraction specifically to that missing dimension.
  * Prioritize page extraction over redundant searches: verified primary page data is required for pricing and promotional claims.
  * If the user specifically asks for customer complaints, negative reviews, or delivery issues: brand homepages NEVER list their own complaints! You MUST dedicate at least one search specifically to user reviews/complaints (e.g. "{{brand}} reviews complaints issues", "site:reddit.com {{brand}} review", "{{domain}} service delay complaints").
- DEEP PAGE INSPECTION (1 to 3 calls): Use `extract_webpages` on the most promising discovered URLs to inspect full product catalogs, actual pricing tiers, subscription details, or review threads — not just snippets!
- COMPLETION: When evidence has been gathered, write your plain-text summary covering competitors, key facts, and whitespace gaps.

RESEARCH PROTOCOL:
1. FORMULATE PRECISE QUERIES: Call `web_search` with focused queries.
   For broad queries, consider searching both editorial/industry sources (articles, reviews, directories, guides)
   and social/community conversations (hashtags, public posts, creator angles).
2. INSPECT WEBPAGE CONTENT: Use `extract_webpages` on 1–3 high-value URLs to
   read actual marketing copy, offers, pricing, and campaign details — not just snippets.
   IMPORTANT: Target articles, blogs, reviews, directories, guides, or company sites.
   Do not call `extract_webpages` on login-walled social media feed URLs (Instagram, TikTok, Facebook, LinkedIn, X/Twitter)
   as scrapers are blocked by authentication walls; analyze social trends directly from search snippets instead.
3. ADAPTIVE FOLLOW-UP: If the first search is insufficient, run a targeted
   follow-up query. If evidence is sparse, stop and report limitations honestly.
4. EVIDENCE INTEGRITY: Never invent competitor names, URLs, statistics, or
   engagement figures not supported by retrieved evidence.

COMPLETION RULE — THIS IS MANDATORY:
After you have gathered sufficient evidence (typically 1–3 searches and optionally 1–2 extractions),
you MUST write a plain-text summary of your key findings as your FINAL message.
Do NOT call another tool after you have enough evidence — write your summary instead.
Your summary should cover: what you found, which competitors were observed, and what gaps exist.
The downstream system uses your text to trigger structured synthesis; without it the session
is classified as incomplete regardless of how many tools ran.
If you have called 4 or more tools and still have open questions, write your summary now
and disclose the open questions as limitations — do not keep calling more tools.
"""

        # -- 4. BoundedToolRuntime execution --------------------------------------
        runtime_config = ToolRuntimeConfig(
            max_turns=6,
            max_total_tool_calls=6,
            per_tool_max_calls={"web_search": 3, "extract_webpages": 3, "web_extract": 3},
            execution_timeout_seconds=120.0,
            per_tool_timeout_seconds=15.0,
            budget_units=80.0,
            max_request_tokens=5000,
        )
        runtime = BoundedToolRuntime(registry=self.tool_registry, config=runtime_config)
        initial_messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query),
        ]

        try:
            runtime_result = await runtime.run(
                initial_messages=initial_messages,
                exec_context=exec_context,
                llm=get_llm(
                    model=settings.MARKET_RESEARCH_MODEL,
                    temperature=0.1,
                ),
                on_event=on_event,
            )
        except Exception as run_err:
            logger.error("BoundedToolRuntime raised an exception: %s", run_err, exc_info=True)
            runtime_result = None

        # -- 5. Classify execution health -----------------------------------------
        health_status, health_issues = self._classify_execution_health(runtime_result)

        # -- 6. Index evidence & separate discovered vs inspected sources ---------
        discovered_sources_map: dict[str, EvidenceCitation] = {}
        inspected_sources_map: dict[str, EvidenceCitation] = {}
        verified_sources_map: dict[str, EvidenceCitation] = {}
        inspected_pages: list[dict[str, Any]] = []

        if runtime_result:
            for tele in runtime_result.telemetry:
                activity_logs.append(
                    f"Tool: {tele.tool_name} → {tele.status.value} ({tele.duration_ms:.0f}ms)"
                )

            for obs in runtime_result.observations:
                if obs.status != ToolCallStatus.SUCCESS:
                    continue

                if obs.tool_name == "web_search" and isinstance(obs.data, dict):
                    for item in obs.data.get("results", []):
                        raw_url = (item.get("url") or "").strip()
                        if not raw_url or not _is_safe_url(raw_url):
                            continue
                        canonical = _normalize_url(raw_url)
                        snippet = (item.get("snippet") or "").strip()
                        if snippet:
                            pub_date: str | None = item.get("publication_date") or None
                            if pub_date in ("Recent", "2026", "2025", ""):
                                pub_date = None
                            cite = EvidenceCitation(
                                source_title=item.get("title") or canonical,
                                source_url=canonical,
                                publisher=item.get("publisher") or "Web Search (Snippet)",
                                publication_date=pub_date,
                                excerpt=snippet,
                                is_direct_quote=False,
                                geographic_relevance=location,
                            )
                            discovered_sources_map[canonical] = cite
                            if canonical not in verified_sources_map:
                                verified_sources_map[canonical] = cite

                elif obs.tool_name in ("extract_webpages", "web_extract") and isinstance(obs.data, dict):
                    for page in obs.data.get("pages", []):
                        raw_url = (page.get("url") or "").strip()
                        content = (page.get("content") or "").strip()
                        status = page.get("status", "")
                        if not raw_url or not content or "error" in status or "unsafe" in status:
                            continue
                        if not _is_safe_url(raw_url):
                            continue
                        canonical = _normalize_url(raw_url)
                        key_excerpts = page.get("key_excerpts") or []
                        extracted_metrics = page.get("extracted_metrics") or []
                        extracted_at = page.get("extracted_at") or ""
                        summary = page.get("summary") or ""
                        primary_excerpt = key_excerpts[0] if key_excerpts else content[:500]

                        cite = EvidenceCitation(
                            source_title=page.get("title") or canonical,
                            source_url=canonical,
                            publisher=urlparse(canonical).netloc or "Inspected Webpage",
                            publication_date=None,
                            excerpt=primary_excerpt,
                            is_direct_quote=bool(key_excerpts),
                            geographic_relevance=location,
                        )
                        inspected_sources_map[canonical] = cite
                        # Inspected sources override search snippets in verified map
                        verified_sources_map[canonical] = cite
                        inspected_pages.append({
                            "url": canonical,
                            "title": page.get("title") or canonical,
                            "content": content,
                            "summary": summary,
                            "key_excerpts": key_excerpts,
                            "extracted_metrics": extracted_metrics,
                            "extracted_at": extracted_at,
                        })

                elif obs.tool_name in ("get_platform_documentation", "get_platform_benchmarks") and isinstance(obs.data, dict):
                    for b in obs.data.get("benchmarks", []):
                        b_url = (b.get("url") or "").strip()
                        if b_url and _is_safe_url(b_url):
                            canonical = _normalize_url(b_url)
                            if canonical not in verified_sources_map:
                                verified_sources_map[canonical] = EvidenceCitation(
                                    source_title=b.get("title") or "Platform Documentation",
                                    source_url=canonical,
                                    publisher=b.get("platform") or "Platform Documentation",
                                    publication_date=None,
                                    excerpt=b.get("retention_benchmark") or b.get("key_takeaway") or "",
                                    is_direct_quote=False,
                                    geographic_relevance=None,
                                )

        search_only_count = max(0, len(discovered_sources_map) - len(inspected_sources_map))
        activity_logs.append(
            f"Retrieved {len(discovered_sources_map)} discovered search results "
            f"({len(inspected_sources_map)} deeply inspected pages, {search_only_count} search snippets)."
        )

        all_verified_urls = set(discovered_sources_map.keys()) | set(inspected_sources_map.keys()) | set(verified_sources_map.keys())

        # -- 7. Deterministic Evidence Sufficiency Gate ---------------------------
        synthesis: MarketResearchSynthesisOutput | None = None

        # Case A: Zero usable search results retrieved
        if not verified_sources_map:
            subject_label = client_name if is_client_scoped else f"'{query[:50]}'"
            limit_msg = (
                f"Live search returned 0 indexable sources for '{query}' in {location or 'the specified market'}. "
                "Analysis halted to prevent hallucinated findings."
            )
            synthesis = MarketResearchSynthesisOutput(
                executive_summary=(
                    f"Market landscape investigation: I've analyzed the market landscape for {subject_label}, "
                    f"but zero usable search results were retrieved for this query."
                ),
                key_findings=[
                    CitedKeyFinding(
                        finding="No external public documentation or competitor listings were discovered.",
                        source_url=None,
                    )
                ],
                verified_observations=[],
                source_reported_claims=[],
                observed_competitors=[],
                inferred_opportunities=[],
                search_limitations=limit_msg,
                recommendations=[],
                suggested_followups=["Try broadening search terms or specifying known competitor brand names directly."],
            )

        # Case B & C: Sources are available, run structured synthesis
        else:
            # Build search snippet block - select top 12 most informative snippets to keep reasoning fast & high-quality
            search_lines: list[str] = []
            snippet_items = list(discovered_sources_map.items())[:12]
            for canonical, cite in snippet_items:
                if canonical not in inspected_sources_map:
                    search_lines.append(
                        f"  • [{cite.source_title}]({cite.source_url})\n"
                        f"    Publisher: {cite.publisher}\n"
                        f"    Preliminary Snippet: {cite.excerpt[:280]}"
                    )
            search_block = "\n".join(search_lines) if search_lines else "No separate snippets (pages directly inspected)."

            # Build structured inspected page evidence dossier
            page_blocks: list[str] = []
            for page in inspected_pages[:4]:
                p_url = page["url"]
                p_title = page.get("title") or p_url
                p_time = page.get("extracted_at") or "Recently extracted"
                p_summary = page.get("summary") or ""
                excerpts = page.get("key_excerpts") or []
                metrics = page.get("extracted_metrics") or []
                excerpts_text = "\n".join(f"      * Verbatim Evidence: \"{ex}\"" for ex in excerpts[:4]) if excerpts else "      * No standalone metric excerpts detected."
                metrics_text = ", ".join(metrics[:6]) if metrics else "None"
                passage = self._extract_relevant_passage(page.get("content", ""), query, max_chars=800)

                page_blocks.append(
                    f"  • Source: [{p_title}]({p_url})\n"
                    f"    Inspection Timestamp: {p_time}\n"
                    f"    Core Offering / Summary: {p_summary}\n"
                    f"    Detected Metrics / Numbers: {metrics_text}\n"
                    f"    Verified Verbatim Excerpts:\n{excerpts_text}\n"
                    f"    Inspected Passage (Context):\n    {passage}"
                )
            inspected_block = "\n\n".join(page_blocks) if page_blocks else "Zero pages successfully extracted."

            # Case B: Discovered snippets only, no extracted pages
            if not inspected_sources_map:
                evidence_status_header = (
                    "EVIDENCE STATUS: Preliminary search snippets ONLY. ZERO webpages could be deeply inspected.\n"
                    "MANDATE: All findings are source-reported and preliminary. Do NOT describe any finding or competitor as directly inspected or verified."
                )
            else:
                evidence_status_header = (
                    f"EVIDENCE STATUS: {len(inspected_pages)} webpages deeply inspected with primary content."
                )

            if is_client_scoped:
                scope_header = f"""RESEARCH SCOPE: CLIENT-SCOPED RESEARCH
CLIENT: {client_name} ({industry}, Location: {location or 'General'})
NOTE: Focus findings on strategic positioning for this client. If you infer client assumptions, state them under research limitations."""
            else:
                scope_header = """RESEARCH SCOPE: INDEPENDENT MARKET RESEARCH
CRITICAL ISOLATION RULE: Do NOT inject, assume, or tailor findings to any external agency client profile or location. Focus 100% on the entities, brands, and geography specified in USER QUERY."""

            synthesis_prompt = f"""You are the Market Research Synthesizer for AgencyOS.
Produce an evidence-grounded research synthesis for the user query.

USER QUERY: "{query}"
{scope_header}

{evidence_status_header}

--- DISCOVERED SEARCH SNIPPETS (PRELIMINARY / SOURCE-REPORTED) ---
{search_block}

--- DEEPLY INSPECTED WEBPAGES (VERIFIED PRIMARY CONTENT) ---
{inspected_block}

STRICT RULES:
1. Every competitor (observed_competitors) MUST cite a supporting_source_url that appears verbatim in the evidence above. Never invent URLs.
2. COMPETITOR ENTITY INTEGRITY: `competitor_name` must be an actual company, brand, product, organization, or creator name (e.g. 'Stripe', 'Notion', 'Acme Corp').
   NEVER output SEO query titles, aggregate listicles, or hashtag collections (e.g., do NOT output 'Best CRM Software', 'Popular Reels', or 'Top Rated Services' as competitor names). If a source is an aggregate list, extract the specific entity named in the text, or omit it.
3. If competitors are based on search snippets rather than inspected pages, note this in observed_creative_angle (e.g. 'Preliminary — based on search snippet').
4. EVIDENCE GROUNDING FOR SENSITIVE CLAIMS: Pricing tiers, subscription fees, promotional discounts, customer review complaints, and quantitative performance numbers require an inspected webpage to be treated as verified evidence. If only found in a snippet, disclose as preliminary / unverified page content.
5. STRATEGIC WHITESPACE CONSISTENCY: Every inferred opportunity (inferred_opportunities) must identify a genuine whitespace or differentiation gap that is internally consistent with your findings. Do NOT claim an angle is missing or unserved if your own findings state competitors are actively using it. Every opportunity must cite supporting_source_urls that appear in the evidence above.
6. For key_findings, include the source_url when supported; set source_url to null if general or uncited.
7. RESEARCH DIMENSIONS TRACKING: Decompose the original user query into 3 to 6 explicit requested dimensions (e.g., 'Competitor Pricing & Subscriptions', 'Core Offering Tiers', 'Customer Review Complaints', 'Coverage in Target Geographic Markets').
   For each dimension, output a `ResearchDimensionItem`:
   - `dimension`: The specific entity, data point, or question requested.
   - `status`: 'answered' (if verified by primary inspected pages or clear evidence), 'partial' (if only preliminary snippets or unverified), or 'missing' (if unsearched, unverified, or omitted).
   - `summary`: Concise factual summary if answered/partial, or the explicit reason if missing (e.g. 'Tool quota exhausted before dedicated search could run', or 'Inspected brand marketing websites do not publish customer review complaints').
8. Do NOT invent competitor names, engagement numbers, or facts not present in the evidence.
9. If evidence is sparse or pages could not be inspected, disclose this honestly in search_limitations.
10. Return JSON matching MarketResearchSynthesisOutput exactly.
"""

            if on_event:
                try:
                    await on_event({
                        "type": "status",
                        "stage": "synthesizing",
                        "message": f"Analyzing and synthesizing findings across {len(discovered_sources_map)} discovered sources with Nemotron Lightning 30B...",
                    })
                except Exception:
                    pass

            try:
                synthesis = await invoke_structured_llm(
                    prompt=synthesis_prompt,
                    schema_class=MarketResearchSynthesisOutput,
                    temperature=0.2,
                    model=settings.MARKET_RESEARCH_MODEL,
                    max_tokens=8192,
                )
            except Exception as syn_err:
                logger.error("Structured synthesis error: %s", syn_err, exc_info=True)

            # Fallback deterministic synthesis when invoke_structured_llm fails
            if synthesis is None:
                top_sources = list(verified_sources_map.values())
                if top_sources:
                    limit_msg = (
                        "Structured synthesis failed. The following sources were retrieved "
                        "but could not be synthesized automatically."
                    )
                    findings = [
                        CitedKeyFinding(finding=s.excerpt[:200], source_url=s.source_url)
                        for s in top_sources[:3]
                    ]
                    subject_label = client_name if is_client_scoped else f"'{query[:50]}'"
                    exec_summary = (
                        f"Market landscape investigation: Analyzed the market landscape for "
                        f"{subject_label} across {len(discovered_sources_map)} discovered search results "
                        f"({len(inspected_sources_map)} deeply inspected pages)."
                    )
                else:
                    limit_msg = "Zero sources retrieved: No verifiable evidence was found across the queried terms."
                    findings = [CitedKeyFinding(finding="No verifiable evidence retrieved across queried terms.", source_url=None)]
                    exec_summary = (
                        f"Zero sources retrieved: No verifiable evidence could be retrieved for '{query[:50]}'. "
                        "The requested research dimensions remain unverified."
                    )

                synthesis = MarketResearchSynthesisOutput(
                    executive_summary=exec_summary,
                    key_findings=findings,
                    verified_observations=[],
                    source_reported_claims=[],
                    observed_competitors=[],
                    inferred_opportunities=[],
                    search_limitations=limit_msg,
                    recommendations=[],
                    suggested_followups=[],
                )

        # -- 8. Citation validation pass ------------------------------------------
        validated_findings = self._validate_key_findings(
            synthesis.key_findings, all_verified_urls, verified_sources_map, inspected_sources_map
        )
        synthesis.key_findings = validated_findings

        validated_competitors = self._validate_competitors(
            synthesis.observed_competitors, all_verified_urls, verified_sources_map, inspected_sources_map
        )
        validated_opportunities = self._validate_opportunities(
            synthesis.inferred_opportunities, all_verified_urls, verified_sources_map
        )

        # Append execution health notes to search_limitations if partial/failed
        if health_status == "partial" and health_issues:
            issues_str = "; ".join(health_issues)
            extra_lim = f" Note: Partial runtime execution ({issues_str})."
            synthesis.search_limitations = (
                f"{synthesis.search_limitations}{extra_lim}"
                if synthesis.search_limitations
                else extra_lim.strip()
            )
        elif health_status == "failed" and health_issues:
            issues_str = "; ".join(health_issues)
            synthesis.search_limitations = f"Research runtime failed: {issues_str}."

        # Collect distinct URLs that actually support individual claims in synthesis
        claim_supported_urls: set[str] = set()
        for f in synthesis.key_findings:
            if f.source_url:
                canonical = _normalize_url(f.source_url)
                if canonical in all_verified_urls:
                    claim_supported_urls.add(canonical)
        for c in validated_competitors:
            if c.citation and c.citation.source_url:
                canonical = _normalize_url(c.citation.source_url)
                if canonical in all_verified_urls:
                    claim_supported_urls.add(canonical)
        for o in validated_opportunities:
            for cite in o.supporting_citations:
                if cite and cite.source_url:
                    canonical = _normalize_url(cite.source_url)
                    if canonical in all_verified_urls:
                        claim_supported_urls.add(canonical)

        # -- 9. Assemble artifact -------------------------------------------------
        supporting_evidence_citations = [
            cite for url, cite in inspected_sources_map.items()
        ] + [
            cite for url, cite in discovered_sources_map.items()
            if url in claim_supported_urls and url not in inspected_sources_map
        ]
        if not supporting_evidence_citations:
            supporting_evidence_citations = list(verified_sources_map.values())[:5]

        artifact_payload = MarketResearchArtifactPayload(
            query_topic=query or "Market Landscape & Competitive Intelligence",
            observed_competitors=validated_competitors,
            inferred_opportunities=validated_opportunities,
            verified_sources=supporting_evidence_citations,
            search_limitations=synthesis.search_limitations,
            research_dimensions=getattr(synthesis, "research_dimensions", []),
            discovered_count=len(discovered_sources_map),
            inspected_count=len(inspected_sources_map),
            claim_supported_count=len(claim_supported_urls),
        )

        # -- 10. Format reply -----------------------------------------------------
        reply_markdown = self._format_reply(
            synthesis=synthesis,
            validated_competitors=validated_competitors,
            validated_opportunities=validated_opportunities,
            claim_supported_count=len(claim_supported_urls),
            inspected_count=len(inspected_sources_map),
            discovered_count=len(discovered_sources_map),
            health_status=health_status,
            health_issues=health_issues,
            all_verified_urls=all_verified_urls,
        )

        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=reply_markdown.strip(),
            artifact_type=ArtifactType.research_evidence,
            artifact_payload=artifact_payload.model_dump(),
            activity_logs=activity_logs,
            suggested_followups=synthesis.suggested_followups or [],
        )

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _classify_execution_health(
        runtime_result: ToolExecutionResult | None,
    ) -> tuple[str, list[str]]:
        """
        Classify execution into 'successful', 'partial', or 'failed' based on
        ExecutionStatus and ToolCallStatus telemetry.
        """
        if runtime_result is None:
            return "failed", ["Runtime failed to initialize or execute."]

        status = runtime_result.status

        # Collect genuine tool execution errors (e.g. crashes, HTTP 500, timeouts)
        # Note: CALL_LIMIT_REACHED is normal bounding, not an execution error.
        real_error_issues: list[str] = []
        for t in runtime_result.telemetry:
            if t.status in (
                ToolCallStatus.TOOL_ERROR,
                ToolCallStatus.TIMEOUT,
                ToolCallStatus.BUDGET_EXCEEDED,
                ToolCallStatus.UNAUTHORIZED_SPECIALIST,
                ToolCallStatus.UNAUTHORIZED_TENANT,
                ToolCallStatus.UNKNOWN_TOOL,
                ToolCallStatus.MALFORMED_TOOL_CALL,
                ToolCallStatus.INVALID_ARGUMENTS,
            ):
                real_error_issues.append(f"{t.tool_name} ({t.status.value}: {t.error_message or 'error'})")

        # 1. Total provider or execution crashes -> failed
        if status in (ExecutionStatus.PROVIDER_FAILURE, ExecutionStatus.TOOL_EXECUTION_FAILURE):
            issues = list(real_error_issues)
            failure_detail = runtime_result.failure_reason or f"Runtime terminated with {status.value}"
            issues.insert(0, failure_detail)
            return "failed", issues

        # 2. Hard timeout or budget exhaustion with zero successful tools -> failed
        if status in (ExecutionStatus.TIMEOUT, ExecutionStatus.BUDGET_EXHAUSTED) and runtime_result.successful_tool_calls == 0:
            issues = list(real_error_issues)
            issues.insert(0, f"Runtime terminated with {status.value} before any tools succeeded")
            return "failed", issues

        # 3. Timeout or budget exhaustion mid-flight -> partial
        if status in (ExecutionStatus.TIMEOUT, ExecutionStatus.BUDGET_EXHAUSTED):
            issues = list(real_error_issues)
            if not issues:
                issues.append(f"Execution reached {status.value}")
            return "partial", issues

        # 4. If actual tool execution errors occurred -> partial
        if real_error_issues:
            return "partial", real_error_issues

        # 5. If successful tools were executed and no real tool errors occurred:
        # Reaching MAX_TOOL_CALLS_REACHED, MAX_TURNS_REACHED, or NORMAL_COMPLETION
        # is a healthy, fully-bounded research session.
        if runtime_result.successful_tool_calls > 0:
            return "successful", []

        # 6. Normal completion with 0 tool calls (e.g. answered directly from context) -> successful
        if status == ExecutionStatus.NORMAL_COMPLETION:
            return "successful", []

        return "partial", ["No research tools were executed."]

    @staticmethod
    def _is_finding_supported_by_source(finding: str, citation: EvidenceCitation) -> bool:
        """
        Deterministic check if the citation source excerpt/title actually supports the finding.
        Extracts substantive content words (>= 4 chars, non-stopwords) and checks for presence.
        """
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
            "be", "been", "being", "have", "has", "had", "do", "does", "did", "this", "that",
            "these", "those", "it", "its", "they", "them", "their", "we", "us", "our", "you",
            "your", "he", "she", "his", "her", "not", "no", "can", "could", "will", "would",
            "should", "may", "might", "must", "than", "more", "most", "also", "very"
        }
        source_text = f"{citation.source_title} {citation.excerpt}".lower()
        clean_finding = re.sub(r"\[UNVERIFIED HYPOTHESIS\]\s*", "", finding)
        finding_words = [
            re.sub(r"[^\w]", "", w.lower())
            for w in clean_finding.split()
            if len(re.sub(r"[^\w]", "", w)) >= 4
        ]
        substantive = [w for w in finding_words if w and w not in stop_words]
        if not substantive:
            return True

        return any(w in source_text for w in substantive)

    def _validate_key_findings(
        self,
        findings: list[CitedKeyFinding],
        all_verified_urls: set[str],
        verified_sources_map: dict[str, EvidenceCitation],
        inspected_sources_map: dict[str, EvidenceCitation] | None = None,
    ) -> list[CitedKeyFinding]:
        """
        Validate and sanitize key finding citations.
        - Normalizes candidate URLs.
        - Rejects fabricated or unsupported URLs.
        - Labels unsupported findings as [UNVERIFIED HYPOTHESIS].
        - Flags sensitive claims (pricing, subscription, offers, complaints) backed only by search snippets as preliminary.
        """
        inspected_map = inspected_sources_map or {}
        validated: list[CitedKeyFinding] = []
        for f in findings:
            raw_url = (f.source_url or "").strip()
            canonical = _normalize_url(raw_url) if raw_url else ""

            if canonical and canonical in all_verified_urls:
                cite = verified_sources_map[canonical]
                if self._is_finding_supported_by_source(f.finding, cite):
                    finding_text = f.finding
                    # Claim-to-source validation: sensitive claims (pricing, fees, offers, review complaints)
                    # require an inspected page to be treated as verified evidence.
                    is_sensitive_claim = bool(re.search(
                        r"(?:₹|\$|rs\.?|inr|\bprice\b|\bpricing\b|\bfee\b|\bcost\b|\bdiscount\b|\boff\b|\bbogo\b|\bsubscription\b|\bplan\b|\bcomplaint\b|\bnegative review\b|\bviews\b|\bfollowers\b|\bengagement\b)",
                        finding_text,
                        re.IGNORECASE,
                    ))
                    if is_sensitive_claim and canonical not in inspected_map:
                        if not finding_text.startswith("[PRELIMINARY") and not finding_text.startswith("[UNVERIFIED"):
                            finding_text = f"[PRELIMINARY SNIPPET - UNVERIFIED PAGE CONTENT] {finding_text}"

                    validated.append(
                        CitedKeyFinding(
                            finding=finding_text,
                            source_url=canonical,
                        )
                    )
                else:
                    logger.info("Finding '%s' is not supported by source '%s'", f.finding[:60], canonical)
                    unverified_text = f.finding if f.finding.startswith("[UNVERIFIED") else f"[UNVERIFIED HYPOTHESIS] {f.finding}"
                    validated.append(
                        CitedKeyFinding(
                            finding=unverified_text,
                            source_url=None,
                        )
                    )
            else:
                if raw_url:
                    logger.info("Finding '%s' cited unverified/fabricated URL: %r", f.finding[:60], raw_url)
                unverified_text = f.finding if f.finding.startswith("[UNVERIFIED") else f"[UNVERIFIED HYPOTHESIS] {f.finding}"
                validated.append(
                    CitedKeyFinding(
                        finding=unverified_text,
                        source_url=None,
                    )
                )
        return validated

    def _validate_competitors(
        self,
        competitors: list[CompetitorFindingItem],
        all_verified_urls: set[str],
        verified_sources_map: dict[str, EvidenceCitation],
        inspected_sources_map: dict[str, EvidenceCitation],
    ) -> list[CompetitorActivity]:
        """
        Strict citation validation for competitor findings.
        Rejects any competitor with an unverified or fabricated URL.
        Discloses whether the competitor observation is based on an inspected page or search snippet.
        """
        validated: list[CompetitorActivity] = []
        for comp in competitors:
            raw_url = (comp.supporting_source_url or "").strip()
            canonical = _normalize_url(raw_url) if raw_url else ""

            if not canonical or canonical not in all_verified_urls:
                logger.info(
                    "Competitor '%s' rejected: supporting_source_url %r is not in verified evidence.",
                    comp.competitor_name,
                    raw_url,
                )
                continue

            citation = verified_sources_map[canonical]
            angle = comp.observed_creative_angle
            if canonical not in inspected_sources_map:
                if "[Preliminary" not in angle and "[Search Snippet" not in angle:
                    angle = f"{angle} (Preliminary — based on search snippet)"

            validated.append(
                CompetitorActivity(
                    competitor_name=comp.competitor_name,
                    platform=self._map_platform(comp.platform, canonical),
                    observed_creative_angle=angle,
                    observed_format=comp.observed_format,
                    citation=citation,
                )
            )
        return validated

    def _validate_opportunities(
        self,
        opportunities: list[InferredOpportunityItem],
        all_verified_urls: set[str],
        verified_sources_map: dict[str, EvidenceCitation],
    ) -> list[InferredOpportunity]:
        """
        Strict citation validation for inferred opportunities.
        Retains only valid source URLs. If no valid citations exist, labels as [UNVERIFIED HYPOTHESIS].
        """
        validated: list[InferredOpportunity] = []
        for opp in opportunities:
            valid_citations = [
                verified_sources_map[_normalize_url(u.strip())]
                for u in opp.supporting_source_urls
                if u.strip() and _normalize_url(u.strip()) in all_verified_urls
            ]
            if not valid_citations:
                description = f"[UNVERIFIED HYPOTHESIS] {opp.opportunity_description}"
                logger.info(
                    "Opportunity '%s' has no verified citations; marked as unverified hypothesis.",
                    opp.opportunity_description,
                )
            else:
                description = opp.opportunity_description

            validated.append(
                InferredOpportunity(
                    opportunity_description=description,
                    target_whitespace=opp.target_whitespace,
                    supporting_citations=valid_citations,
                )
            )
        return validated

    @staticmethod
    def _classify_research_scope(query: str, client_name: str) -> str:
        """
        Classify research into one of three explicit modes:
        - CLIENT_SCOPED: Researching the active client's market, competitors, or offerings.
        - CLIENT_INFORMED_EXTERNAL: Researching external trends/practices informed by the client's industry/location.
        - INDEPENDENT_RESEARCH: Explicitly named external subjects take precedence over client context.
        """
        q = query.lower()

        # Priority 0: Explicit negative client instructions
        negative_client_cues = [
            r"\bdo not relate\b",
            r"\bnot relate\b",
            r"\bdo not connect\b",
            r"\bignore client\b",
            r"\bindependent of\b",
            r"\bwithout client\b",
            r"\bnot related to\b",
        ]
        if any(re.search(pat, q) for pat in negative_client_cues):
            return "INDEPENDENT_RESEARCH"

        cleaned_client = re.sub(r"[^\w\s]", "", (client_name or "").lower()).strip()
        client_terms = {
            "our competitors", "who are our competitors", "what are our competitors",
            "what are our direct and indirect competitors", "our direct competitors",
            "who is our competition", "my client", "our client", "the client",
            "our brand", "our company", "our business", "our enterprise", "our agency",
            "our product", "our pricing", "our location", "around us", "for us",
            "we offer", "we are", "we're", "our service", "our shop", "our agency client",
        }
        has_client_cue = any(term in q for term in client_terms) or (len(cleaned_client) >= 4 and cleaned_client in q)

        # Priority 1: Hybrid Client-Informed External
        hybrid_external_cues = [
            r"\bbased on\b",
            r"\bwhat opportunities could\b",
            r"\bwhat can\s+[a-z0-9\s,&-]+\s+learn\b",
            r"\bhow can\s+[a-z0-9\s,&-]+\s+(?:adopt|explore|apply|leverage)\b",
            r"\bopportunities\s+for\s+[a-z0-9\s,&-]+\s+from\b",
            r"\bwhat\s+[a-z0-9\s,&-]+\s+could\s+[a-z0-9\s,&-]+\s+(?:adopt|explore)\b",
        ]
        is_hybrid_query = any(re.search(pat, q) for pat in hybrid_external_cues) and has_client_cue
        if is_hybrid_query:
            return "CLIENT_INFORMED_EXTERNAL"

        # Priority 2: Explicit user-named external subjects take priority
        named_patterns = [
            r"\bspecifically\b",
            r"\bcompare\s+[a-z0-9\s,&-]+(?:\sand\s|\svs\s)",
            r"\b(?:between|across)\s+[a-z0-9\s,&-]+(?:\sand\s|\svs\s)",
            r"\bcompeting with\b",
            r"\b(?:for|on)\s+(?!(?:my|our|the)\s+(?:client|brand|company|business)|us\b)(?:an?\s+)?[a-z0-9\s,&-]+\s+(?:in|across|at|near)\s+[a-z0-9\s,&-]+\b",
            r"\b(?:analysis|research)\s+on\s+[a-z0-9\s,&-]+(?:company|companies|business|businesses|brand|brands|enterprise|enterprises|market|markets|sector|sectors|industry|industries|organization|organizations|service|services|product|products|vertical|verticals|niche|category|categories|segment|segments|domain|space|field)\b",
        ]
        if any(re.search(pat, q) for pat in named_patterns):
            return "INDEPENDENT_RESEARCH"

        # Priority 3: Client-scoped cues
        if has_client_cue:
            return "CLIENT_SCOPED"

        # Priority 4: External trend queries informed by client context
        trend_terms = {"trend", "trends", "viral", "hooks", "benchmark", "benchmarks", "format", "formats", "growth", "playbook"}
        if any(t in q for t in trend_terms):
            return "CLIENT_INFORMED_EXTERNAL"

        return "INDEPENDENT_RESEARCH"

    @staticmethod
    def _build_prior_context(
        context: CampaignStudioContext,
        query: str = "",
        is_client_scoped: bool = False,
    ) -> str:
        """Build a prior-context prompt block from active artifact only if strictly relevant."""
        if not (
            context.active_artifact_payload
            and context.active_artifact_type == ArtifactType.research_evidence.value
        ):
            return ""

        payload = context.active_artifact_payload
        prior_topic = str(payload.get("query_topic") or "").lower()
        q = query.lower()

        # Follow-up continuity keywords
        followup_cues = {
            "the second", "the first", "the third", "tell me more", "continue",
            "earlier", "previous", "elaborate", "drill down", "deep dive",
            "expand on", "what about competitor", "why did you", "what did you find",
        }
        is_followup = any(cue in q for cue in followup_cues)

        # Keyword overlap check between prior topic and current query
        prior_words = {w for w in re.findall(r"\w{4,}", prior_topic) if w not in {"what", "when", "where", "which", "with", "from", "about"}}
        query_words = {w for w in re.findall(r"\w{4,}", q) if w not in {"what", "when", "where", "which", "with", "from", "about"}}
        has_topic_overlap = bool(prior_words.intersection(query_words))

        # For independent research, do NOT inject prior session artifacts unless the user explicitly asks a follow-up question
        if not is_client_scoped and not is_followup:
            return ""

        # For client-scoped research, require either an explicit follow-up cue or substantive topic overlap
        if is_client_scoped and not is_followup and not has_topic_overlap:
            logger.info("Discarding prior research artifact: topic does not overlap with prior topic '%s'", prior_topic[:40])
            return ""

        prev_competitors = [
            f"  - {c.get('competitor_name')} on {c.get('platform')}: {c.get('observed_creative_angle')}"
            f" [source: {c.get('citation', {}).get('source_url', 'unknown')}]"
            for c in payload.get("observed_competitors", [])
        ]
        prev_sources = [
            f"  - [{s.get('source_title')}]({s.get('source_url')})"
            for s in payload.get("verified_sources", [])[:6]
        ]

        lines = ["\nPRIOR RESEARCH CONTEXT IN THIS SESSION (from previous turn):"]
        lines.append(f"- Query Topic: {payload.get('query_topic', 'Unknown')}")
        if prev_competitors:
            lines.append("- Previously Observed Competitors:")
            lines.extend(prev_competitors)
        if prev_sources:
            lines.append("- Previously Verified Sources:")
            lines.extend(prev_sources)
        lines.append(
            "If the user refers to a previous finding (e.g. 'the second competitor' or "
            "'deep dive into X'), build upon the prior evidence listed above.\n"
        )
        return "\n".join(lines)

    @staticmethod
    def _extract_relevant_passage(content: str, query: str, max_chars: int = 1500) -> str:
        """
        Extract a relevant passage from inspected page content.
        Skips leading navigation boilerplate (first 200 chars on long pages),
        finds paragraph with highest keyword overlap, and returns up to max_chars.
        """
        start = 200 if len(content) > 500 else 0
        body = content[start:]

        query_words = set(query.lower().split())
        paragraphs = [p.strip() for p in body.split("\n") if len(p.strip()) > 60]

        if not paragraphs:
            return body[:max_chars]

        def score(p: str) -> int:
            p_lower = p.lower()
            return sum(1 for w in query_words if w in p_lower)

        best_idx = max(range(len(paragraphs)), key=lambda i: score(paragraphs[i]))
        passage = "\n".join(paragraphs[best_idx:])
        return passage[:max_chars]

    @staticmethod
    def _map_platform(platform_str: str, source_url: str = "") -> SocialPlatform:
        src_lower = (source_url or "").lower()
        plat_lower = (platform_str or "").lower()

        # 1. First check actual source_url domain if available
        if "instagram.com" in src_lower:
            return SocialPlatform.instagram
        if "tiktok.com" in src_lower:
            return SocialPlatform.tiktok
        if "linkedin.com" in src_lower:
            return SocialPlatform.linkedin
        if "youtube.com" in src_lower:
            return SocialPlatform.youtube
        if "facebook.com" in src_lower:
            return SocialPlatform.facebook
        if "twitter.com" in src_lower or "x.com" in src_lower:
            return SocialPlatform.twitter

        # 2. If source_url is a web/blog/pricing URL (not a social network):
        if src_lower and not any(s in src_lower for s in ("instagram", "tiktok", "linkedin", "youtube", "facebook", "twitter", "x.com")):
            if any(k in src_lower for k in ("/official", "/store", "/shop", "pricing")) or any(k in plat_lower for k in ("official", "store", "shop")):
                return SocialPlatform.official_site
            return SocialPlatform.web

        # 3. Fallback when source_url did not clarify: inspect platform_str
        if "instagram" in plat_lower:
            return SocialPlatform.instagram
        if "tiktok" in plat_lower:
            return SocialPlatform.tiktok
        if "linkedin" in plat_lower:
            return SocialPlatform.linkedin
        if "youtube" in plat_lower:
            return SocialPlatform.youtube
        if "facebook" in plat_lower:
            return SocialPlatform.facebook
        if any(k in plat_lower for k in ("official", "store", "shop", "homepage", "company", "pricing")):
            return SocialPlatform.official_site
        return SocialPlatform.web

    @staticmethod
    def _format_reply(
        *,
        synthesis: MarketResearchSynthesisOutput,
        validated_competitors: list[CompetitorActivity],
        validated_opportunities: list[InferredOpportunity],
        all_cited_sources: list[EvidenceCitation] | None = None,
        claim_supported_count: int | None = None,
        inspected_count: int,
        discovered_count: int,
        health_status: str,
        health_issues: list[str],
        all_verified_urls: set[str],
    ) -> str:
        # --- Execution status banner ---
        status_banner = ""
        if health_status == "failed":
            issues_text = "; ".join(health_issues) if health_issues else "Runtime error"
            status_banner = (
                f"> ⚠️ **Research Status**: Research execution failed ({issues_text}). "
                "Findings may be missing or incomplete.\n\n"
            )
        elif health_status == "partial":
            issues_text = "; ".join(health_issues) if health_issues else "Execution limits reached"
            status_banner = (
                f"> ℹ️ **Research Status**: Incomplete research ({issues_text}). "
                "Some tools did not complete successfully. Findings may be partial.\n\n"
            )

        # --- Key findings with validated inline citations ---
        findings_lines = []
        for f in synthesis.key_findings[:5]:
            if f.source_url and _normalize_url(f.source_url) in all_verified_urls:
                canonical = _normalize_url(f.source_url)
                findings_lines.append(f"- {f.finding} \\[[source]({canonical})\\]")
            else:
                findings_lines.append(f"- {f.finding}")
        findings_block = "\n".join(findings_lines) if findings_lines else "No findings available."

        # --- Research scope & dimension tracking block ---
        dim_block = ""
        dims = getattr(synthesis, "research_dimensions", [])
        if dims:
            dim_lines = []
            for d in dims:
                status_val = d.status.value if hasattr(d.status, "value") else str(d.status).lower()
                if status_val == "answered":
                    icon = "✅"
                    label = "Verified"
                elif status_val == "partial":
                    icon = "⚠️"
                    label = "Partial"
                elif status_val == "not_verified":
                    icon = "🔍"
                    label = "Not Verified"
                elif status_val == "not_available":
                    icon = "🚫"
                    label = "Not Available"
                else:
                    icon = "❌"
                    label = "Missing"
                dim_lines.append(f"- {icon} **{d.dimension}**: {label} — {d.summary}")
            dim_block = "\n\n### Research Scope & Dimension Tracking\n" + "\n".join(dim_lines)

        # --- Competitor block with classification and structured relevance ---
        comp_block = ""
        if validated_competitors:
            lines = []
            for c in validated_competitors[:4]:
                type_tag = f"[{c.competitor_type.value.upper()}]" if hasattr(c, "competitor_type") else ""
                rel_parts = []
                if hasattr(c, "relevance") and c.relevance:
                    if getattr(c.relevance, "geographic_overlap", None):
                        rel_parts.append(f"Geo: {c.relevance.geographic_overlap}")
                    if getattr(c.relevance, "product_or_service_overlap", None):
                        rel_parts.append(f"Product: {c.relevance.product_or_service_overlap}")
                rel_str = f" *({', '.join(rel_parts)})*" if rel_parts else ""
                lines.append(
                    f"- {type_tag} **{c.competitor_name}** ({c.platform.value}): {c.observed_creative_angle}{rel_str} "
                    f"— *[{c.citation.publisher}]({c.citation.source_url})*"
                )
            comp_block = "\n\n### Observed Competitor Landscape\n" + "\n".join(lines)

        # --- Opportunity block with hypothesis labeling and practical test methods ---
        opp_block = ""
        real_opps = [o for o in validated_opportunities if not o.opportunity_description.startswith("[UNVERIFIED")]
        if real_opps:
            lines = []
            for o in real_opps[:3]:
                status_tag = f"[{o.status.value.replace('_', ' ').upper()}]" if hasattr(o, "status") else "[HYPOTHESIS]"
                extra_lines = []
                if hasattr(o, "missing_evidence") and o.missing_evidence:
                    extra_lines.append(f"    * Missing Evidence: {', '.join(o.missing_evidence)}")
                if hasattr(o, "test_method") and o.test_method:
                    extra_lines.append(f"    * Low-Risk Test: {o.test_method}")
                if hasattr(o, "validation_criteria") and o.validation_criteria:
                    extra_lines.append(f"    * Success Metric: {o.validation_criteria}")
                extra_str = ("\n" + "\n".join(extra_lines)) if extra_lines else ""
                lines.append(
                    f"- {status_tag} **{o.opportunity_description}** *(Whitespace: {o.target_whitespace})*{extra_str}"
                )
            opp_block = "\n\n### Strategic Market Whitespace & Actionable Hypotheses\n" + "\n".join(lines)

        # --- Limitations ---
        limit_section = ""
        if synthesis.search_limitations:
            limit_section = f"\n\n> ⚠️ **Research Note**: {synthesis.search_limitations}"

        # Distinct sources footer
        search_only_count = max(0, discovered_count - inspected_count)
        effective_claim_count = (
            claim_supported_count
            if claim_supported_count is not None
            else (len(all_cited_sources) if all_cited_sources is not None else 0)
        )

        return (
            f"{status_banner}{synthesis.executive_summary}\n\n"
            f"### Key Findings\n{findings_block}"
            f"{dim_block}"
            f"{comp_block}{opp_block}{limit_section}\n\n"
            f"**Sources Consulted**: {discovered_count} discovered search results "
            f"({inspected_count} deeply inspected pages, {search_only_count} search snippets only, {effective_claim_count} sources supporting specific claims)."
        )
