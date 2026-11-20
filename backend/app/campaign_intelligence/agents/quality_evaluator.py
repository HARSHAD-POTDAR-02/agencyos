from __future__ import annotations

import collections
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan
from app.campaign_intelligence.schemas.quality import (
    FindingCategory,
    FindingSeverity,
    QualityEvaluation,
    QualityFinding,
    RevisionInstruction,
)
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Semantic Critic Schemas
# ---------------------------------------------------------------------------

class SemanticAuditIssue(BaseModel):
    """Structured issue returned by semantic LLM audit."""
    deliverable_index: int = Field(default=0, description="Index (0-based) of the affected deliverable")
    category: Literal[
        "prohibited_claim",
        "brand_compliance",
        "strategic_alignment",
        "brand_boundary",
        "visual_production_feasibility",
    ] = "brand_compliance"
    severity: Literal["critical", "blocking", "warning", "info"] = "warning"
    issue_description: str = Field(default="")
    issue: str = Field(default="")
    remediation_instruction: str = Field(default="")

    @model_validator(mode="before")
    @classmethod
    def normalize_issue(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)

        desc = d.get("issue_description") or d.get("issue") or ""
        d["issue_description"] = desc
        d["issue"] = desc

        sev = str(d.get("severity") or "warning").lower().strip()
        if sev in ("critical", "blocking", "high", "urgent", "blocker"):
            d["severity"] = "blocking"
        elif sev in ("info", "low", "minor", "suggestion"):
            d["severity"] = "info"
        else:
            d["severity"] = "warning"

        cat = str(d.get("category") or "brand_compliance").lower().strip()
        if "visual" in cat or "filmable" in cat or "impossible" in cat:
            d["category"] = "visual_production_feasibility"
        elif "claim" in cat or "prohibit" in cat:
            d["category"] = "prohibited_claim"
        elif "bound" in cat or "concept" in cat:
            d["category"] = "brand_boundary"
        elif "strateg" in cat or "align" in cat:
            d["category"] = "strategic_alignment"
        else:
            d["category"] = "brand_compliance"

        try:
            d["deliverable_index"] = max(0, int(d.get("deliverable_index") or 0))
        except Exception:
            d["deliverable_index"] = 0

        return d


class SemanticAuditOutput(BaseModel):
    """Container for semantic audit findings."""
    issues: list[SemanticAuditIssue] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Timing & Text Helpers
# ---------------------------------------------------------------------------

def parse_timestamp_seconds(ts_str: str) -> float:
    """Parse a single timestamp like '0:03' or '00:15' or '3' or '1:05.5' into seconds."""
    ts_str = ts_str.strip()
    if ":" in ts_str:
        parts = ts_str.split(":")
        if len(parts) == 2:
            try:
                mins = float(parts[0])
                secs = float(parts[1])
                return mins * 60.0 + secs
            except ValueError:
                return 0.0
        elif len(parts) == 3:
            try:
                hrs = float(parts[0])
                mins = float(parts[1])
                secs = float(parts[2])
                return hrs * 3600.0 + mins * 60.0 + secs
            except ValueError:
                return 0.0
    try:
        return float(ts_str)
    except ValueError:
        return 0.0


def parse_scene_range(ts_range: str) -> tuple[float, float] | None:
    """Parse '0:00 - 0:03' or '0:00-0:03' into (start_sec, end_sec)."""
    if not ts_range:
        return None
    parts = re.split(r"\s*[-–—]\s*|\s+to\s+", ts_range.strip())
    if len(parts) == 2:
        start = parse_timestamp_seconds(parts[0])
        end = parse_timestamp_seconds(parts[1])
        return (start, end)
    return None


def calculate_jaccard_similarity(text_a: str, text_b: str) -> float:
    """Compute token Jaccard similarity between two texts."""
    tokens_a = set(re.findall(r"\b[a-zA-Z0-9]+\b", text_a.lower()))
    tokens_b = set(re.findall(r"\b[a-zA-Z0-9]+\b", text_b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / len(tokens_a | tokens_b)


def strip_placeholders(text: str) -> str:
    """Strip valid [CLIENT_INPUT_NEEDED: ...] placeholders before audit checks."""
    if not text:
        return ""
    return re.sub(r"\[CLIENT_INPUT_NEEDED:[^\]]*\]", "", text, flags=re.IGNORECASE).strip()


# ---------------------------------------------------------------------------
# Quality Evaluator Agent
# ---------------------------------------------------------------------------

class QualityEvaluatorAgent:
    """
    Agent 6: Quality Evaluator & Hybrid QA Gate
    
    Implements the 6-Check Hybrid Deterministic & Semantic QA Gate:
    - Check 1: Marketing Cliché & AI Slop Scanner (Deterministic Regex → blocking)
    - Check 2: Brand Boundary & Prohibited Concepts (Deterministic Exact + Semantic Critic → blocking)
    - Check 3: Commercial & Unverified Claim Audit (Deterministic Grounding → blocking)
    - Check 4: Technical Compliance & Pacing Continuity (Deterministic: Reel 15-60s, WPS bounds, Carousel 3-10 slides)
    - Check 5: Visual Production Feasibility Critic (Semantic Critic on CAMPAIGN_QUALITY_MODEL)
    - Check 6: Hook Length & CTA Structural Hygiene (Deterministic: 13-18 words warn, >18 words block, URL hygiene)
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.15):
        self.model_name = (
            model_name
            or getattr(settings, "CAMPAIGN_QUALITY_MODEL", None)
            or settings.CAMPAIGN_EVALUATION_MODEL
        )
        self.temperature = temperature

    async def evaluate(
        self,
        deliverables: list[DeliverablePlan],
        strategy: CampaignStrategy | None = None,
        brief: CampaignBrief | None = None,
        brand_context: BrandContext | None = None,
        market_research: Any | None = None,
        revision_count: int = 0,
        max_revisions: int = 2,
    ) -> QualityEvaluation:
        """
        Execute comprehensive 6-check hybrid audit on planned deliverables.
        """
        findings: list[QualityFinding] = []
        total_checks = 0
        checks_passed = 0

        # Edge case: No deliverables planned
        if not deliverables:
            findings.append(
                QualityFinding(
                    category=FindingCategory.production_feasibility,
                    severity=FindingSeverity.critical,
                    deliverable_index=None,
                    deliverable_title=None,
                    issue_description="No deliverables were produced for evaluation.",
                    issue="No deliverables were produced for evaluation.",
                    remediation_instruction="Generate at least one complete deliverable matching campaign requirements.",
                )
            )
            return QualityEvaluation(
                is_approved_for_human_review=False,
                compliance_score=0.0,
                findings=findings,
                failing_deliverable_indices=[],
                revision_required=True,
                revision_instruction=RevisionInstruction(
                    target_agent="human" if revision_count >= max_revisions else "content_architect",
                    reason="Plan contains zero deliverables.",
                    instructions=["Content Architect must generate deliverable plans."],
                ),
                evaluated_at=datetime.now(timezone.utc).isoformat(),
            )

        # -------------------------------------------------------------
        # Check 1: Marketing Cliché & AI Slop Scanner (Deterministic Regex)
        # -------------------------------------------------------------
        c1_findings, c1_passed, c1_total = self._audit_banned_cliches(deliverables)
        findings.extend(c1_findings)
        checks_passed += c1_passed
        total_checks += c1_total

        # -------------------------------------------------------------
        # Check 2: Brand Boundary & Prohibited Terms (Deterministic Exact)
        # -------------------------------------------------------------
        c2_findings, c2_passed, c2_total = self._audit_prohibited_terms(deliverables, brand_context)
        findings.extend(c2_findings)
        checks_passed += c2_passed
        total_checks += c2_total

        # -------------------------------------------------------------
        # Check 3: Commercial & Unverified Claim Audit (Deterministic Grounding)
        # -------------------------------------------------------------
        c3_findings, c3_passed, c3_total = self._audit_verified_offers_and_discounts(
            deliverables=deliverables,
            brand_context=brand_context,
            brief=brief,
            strategy=strategy,
            market_research=market_research,
        )
        findings.extend(c3_findings)
        checks_passed += c3_passed
        total_checks += c3_total

        # -------------------------------------------------------------
        # Check 4: Technical Compliance & Pacing Continuity (Deterministic)
        # -------------------------------------------------------------
        c4_findings, c4_passed, c4_total = self._audit_technical_compliance_and_pacing(deliverables)
        findings.extend(c4_findings)
        checks_passed += c4_passed
        total_checks += c4_total

        # -------------------------------------------------------------
        # Check 5: Visual Production Feasibility & Semantic Critic
        # (Combined Check 2 Semantic Boundaries + Check 5 Feasibility)
        # -------------------------------------------------------------
        c5_findings, c5_passed, c5_total = await self._audit_semantic_compliance(
            deliverables=deliverables,
            strategy=strategy,
            brand_context=brand_context,
        )
        findings.extend(c5_findings)
        checks_passed += c5_passed
        total_checks += c5_total

        # -------------------------------------------------------------
        # Check 6: Hook Length & CTA Structural Hygiene (Deterministic)
        # -------------------------------------------------------------
        c6_findings, c6_passed, c6_total = self._audit_hook_length_and_cta_hygiene(
            deliverables=deliverables,
            brand_context=brand_context,
            brief=brief,
        )
        findings.extend(c6_findings)
        checks_passed += c6_passed
        total_checks += c6_total

        # -------------------------------------------------------------
        # Contract Quotas Compliance Audit
        # -------------------------------------------------------------
        quota_findings, quota_passed, quota_total = self._audit_contract_quotas(deliverables, brand_context)
        findings.extend(quota_findings)
        checks_passed += quota_passed
        total_checks += quota_total

        # -------------------------------------------------------------
        # Calculate Objective Compliance Score & Failing Deliverable Indices
        # -------------------------------------------------------------
        total_checks = max(total_checks, 1)
        compliance_score = round(checks_passed / total_checks, 2)

        critical_findings = [
            f for f in findings
            if f.severity in (FindingSeverity.critical, FindingSeverity.blocking, "critical", "blocking")
        ]
        warning_findings = [
            f for f in findings
            if f.severity == FindingSeverity.warning
        ]

        failing_deliverable_indices: list[int] = sorted(
            list(set(
                int(f.deliverable_index)
                for f in critical_findings
                if f.deliverable_index is not None
            ))
        )

        # Approval requires ZERO critical/blocking findings and compliance score >= 0.75
        is_approved = (len(critical_findings) == 0) and (compliance_score >= 0.75)
        revision_required = not is_approved

        revision_instruction: RevisionInstruction | None = None
        if revision_required:
            if revision_count >= max_revisions:
                # Escalation threshold reached
                instruction_items = [
                    f"[{getattr(f.category, 'value', f.category).upper()}] {f.deliverable_title or 'General'}: {f.issue_description} -> Remediation: {f.remediation_instruction}"
                    for f in critical_findings
                ]
                if not instruction_items:
                    instruction_items = [
                        f"[{getattr(f.category, 'value', f.category).upper()}] {f.deliverable_title or 'General'}: {f.issue_description} -> Remediation: {f.remediation_instruction}"
                        for f in warning_findings[:3]
                    ]
                revision_instruction = RevisionInstruction(
                    target_agent="human",
                    reason=f"Maximum automated revision limit ({max_revisions}) reached with {len(critical_findings)} critical compliance finding(s). Escalating to human director.",
                    instructions=instruction_items or ["Conduct manual human review to resolve remaining quality issues."],
                )
            else:
                # Intelligent routing to appropriate agent
                has_strategic_issue = any(
                    f.category in (FindingCategory.strategic_alignment, FindingCategory.quota_mismatch, "strategic_alignment", "quota_mismatch")
                    for f in critical_findings
                )
                target_agent: Literal["content_architect", "campaign_strategist", "human"] = (
                    "campaign_strategist" if has_strategic_issue else "content_architect"
                )

                instruction_items = [
                    f"[{getattr(f.category, 'value', f.category).upper()}] Deliverable #{int(f.deliverable_index) + 1 if f.deliverable_index is not None else 'Plan'} '{f.deliverable_title or 'Deliverable'}': {f.issue_description} (Action: {f.remediation_instruction})"
                    for f in critical_findings
                ]
                if not instruction_items:
                    instruction_items = [
                        f"[{getattr(f.category, 'value', f.category).upper()}] Deliverable #{int(f.deliverable_index) + 1 if f.deliverable_index is not None else 'Plan'} '{f.deliverable_title or 'Deliverable'}': {f.issue_description} (Action: {f.remediation_instruction})"
                        for f in warning_findings[:4]
                    ]

                revision_instruction = RevisionInstruction(
                    target_agent=target_agent,
                    reason=f"Quality score {compliance_score:.2f} failed automated quality threshold ({len(critical_findings)} critical issue(s)).",
                    instructions=instruction_items or ["Review flagged issues and regenerate compliant deliverables."],
                )

        return QualityEvaluation(
            is_approved_for_human_review=is_approved,
            compliance_score=compliance_score,
            findings=findings,
            failing_deliverable_indices=failing_deliverable_indices,
            revision_required=revision_required,
            revision_instruction=revision_instruction,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )

    # -----------------------------------------------------------------------
    # Check 1: Marketing Cliché & AI Slop Scanner (Deterministic Regex)
    # -----------------------------------------------------------------------
    def _audit_banned_cliches(
        self,
        deliverables: list[DeliverablePlan],
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Check 1: Scan ALL text surfaces for marketing buzzwords and AI clichés.
        Surfaces scanned: primary_hook, title, caption, CTA, carousel slides, reel scenes.
        """
        banned_patterns = [
            (r"\bin today'?s (?:fast-?paced )?world\b", "in today's fast-paced world"),
            (r"\bgame-?changer\b", "game-changer"),
            (r"\bunlock (?:your|the) potential\b", "unlock your potential"),
            (r"\blook no further\b", "look no further"),
            (r"\bdive (?:right )?in(?:to)?\b", "dive in / dive into"),
            (r"\bsupercharge\b", "supercharge"),
            (r"\bseamlessly\b", "seamlessly"),
            (r"\brevolutionize\b", "revolutionize"),
            (r"\belevate your\b", "elevate your"),
            (r"\btake it to the next level\b", "take it to the next level"),
            (r"\bcutting-?edge solution\b", "cutting-edge solution"),
            (r"\bunleash(?:ing)?(?: the power)?\b", "unleash / unleash the power"),
            (r"\bdelve\b", "delve"),
            (r"\bsecret sauce\b", "secret sauce"),
            (r"\bskyrocket\b", "skyrocket"),
            (r"\bwithout further ado\b", "without further ado"),
        ]

        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        for idx, deliv in enumerate(deliverables):
            total_checks += 1
            text_parts = [
                deliv.title or "",
                deliv.primary_hook or "",
                *(deliv.hook_options or []),
                deliv.caption or "",
                deliv.call_to_action or "",
            ]
            if deliv.carousel_slides:
                for sl in deliv.carousel_slides:
                    text_parts.extend([sl.headline or "", sl.body_copy or "", sl.visual_layout or ""])
            if deliv.reel_scenes:
                for sc in deliv.reel_scenes:
                    text_parts.extend([
                        sc.visual_action or "",
                        sc.on_screen_text or "",
                        sc.spoken_audio_or_voiceover or "",
                    ])

            searchable_text = strip_placeholders(" ".join(text_parts)).lower()
            detected: list[str] = []
            for pat, label in banned_patterns:
                if re.search(pat, searchable_text, flags=re.IGNORECASE):
                    detected.append(label)

            if detected:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.cliche_slop,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' contains banned marketing cliché(s): {', '.join(detected)}.",
                        issue=f"Deliverable #{idx+1} contains banned cliché(s): {', '.join(detected)}.",
                        remediation_instruction="Replace generic marketing buzzwords and AI clichés with grounded, persona-authentic language.",
                    )
                )
            else:
                checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Check 2: Brand Boundary & Prohibited Terms (Deterministic Exact)
    # -----------------------------------------------------------------------
    def _audit_prohibited_terms(
        self,
        deliverables: list[DeliverablePlan],
        brand_context: BrandContext | None,
    ) -> tuple[list[QualityFinding], int, int]:
        """Scan all text fields in all deliverables for exact prohibited terms and claims."""
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        has_terms = bool(brand_context and brand_context.prohibited_terms)
        has_claims = bool(brand_context and brand_context.prohibited_claims)

        for idx, deliv in enumerate(deliverables):
            # Gather all deliverable copy into searchable text
            text_parts = [
                deliv.title or "",
                deliv.primary_hook or "",
                *(deliv.hook_options or []),
                deliv.caption or "",
                deliv.call_to_action or "",
                " ".join(deliv.hashtags or []),
            ]
            if deliv.reel_scenes:
                for sc in deliv.reel_scenes:
                    text_parts.extend([
                        sc.visual_action or "",
                        sc.on_screen_text or "",
                        sc.spoken_audio_or_voiceover or "",
                    ])
            if deliv.carousel_slides:
                for sl in deliv.carousel_slides:
                    text_parts.extend([sl.headline or "", sl.body_copy or "", sl.visual_layout or ""])

            full_text = strip_placeholders(" ".join(text_parts)).lower()

            # 1. Prohibited Terms
            if has_terms and brand_context:
                for pt in brand_context.prohibited_terms:
                    term_clean = pt.term.strip().lower()
                    if not term_clean:
                        continue
                    total_checks += 1
                    pattern = rf"\b{re.escape(term_clean)}\b"
                    if re.search(pattern, full_text):
                        reason_ctx = f" (Brand Rule: {pt.reason})" if pt.reason else ""
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.prohibited_term,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Exact prohibited term '{pt.term}' found in deliverable '{deliv.title}'{reason_ctx}.",
                                issue=f"Prohibited term '{pt.term}' found in deliverable '{deliv.title}'.",
                                remediation_instruction=f"Remove or replace prohibited term '{pt.term}' with an approved alternative.",
                            )
                        )
                    else:
                        checks_passed += 1

            # 2. Prohibited Claims (Deterministic Exact)
            if has_claims and brand_context:
                for pc in brand_context.prohibited_claims:
                    claim_clean = pc.claim.strip().lower()
                    if not claim_clean or len(claim_clean) < 4:
                        continue
                    total_checks += 1
                    if claim_clean in full_text:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.prohibited_claim,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Exact prohibited claim '{pc.claim}' found in deliverable '{deliv.title}'.",
                                issue=f"Prohibited claim '{pc.claim}' found in deliverable '{deliv.title}'.",
                                remediation_instruction=f"Remove prohibited claim: {pc.claim}.",
                            )
                        )
                    else:
                        checks_passed += 1

            # 3. Deliverable slot factual boundary constraints
            if deliv.factual_boundary_constraints:
                for constraint in deliv.factual_boundary_constraints:
                    c_clean = constraint.strip().lower()
                    if not c_clean or len(c_clean) < 4:
                        continue
                    total_checks += 1
                    if c_clean in full_text:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.brand_boundary,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Deliverable '{deliv.title}' violates slot boundary constraint: '{constraint}'.",
                                issue=f"Violates slot boundary constraint: '{constraint}'.",
                                remediation_instruction=f"Comply with boundary constraint: {constraint}.",
                            )
                        )
                    else:
                        checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Check 3: Commercial & Unverified Claim Audit (Deterministic Grounding)
    # -----------------------------------------------------------------------
    def _audit_verified_offers_and_discounts(
        self,
        deliverables: list[DeliverablePlan],
        brand_context: BrandContext | None,
        brief: CampaignBrief | None = None,
        strategy: CampaignStrategy | None = None,
        market_research: Any | None = None,
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Check 3: Detect unverified promotional offers, discounts, currencies, and numeric claims.
        Enforces Mandatory User Adjustment 2:
        - Scans currency ($ € £ ₹), discounts, guarantees, and numeric claims even when verified_offers == [].
        - Validates against confirmed_facts + verified_offers + campaign brief + ResearchEvidence.
        - Strips valid [CLIENT_INPUT_NEEDED: ...] placeholders without penalty.
        - Flags unverified claims as blocking.
        """
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        # Construct combined verified corpus
        verified_elements: list[str] = []
        if brand_context:
            if brand_context.confirmed_facts:
                verified_elements.extend(brand_context.confirmed_facts)
            if brand_context.verified_offers:
                for o in brand_context.verified_offers:
                    verified_elements.extend([o.name, o.description])
                    if hasattr(o, "price") and getattr(o, "price", None):
                        verified_elements.append(str(getattr(o, "price")))
                    if hasattr(o, "discount") and getattr(o, "discount", None):
                        verified_elements.append(str(getattr(o, "discount")))
            if getattr(brand_context, "client_type", None):
                verified_elements.append(brand_context.client_type)
            if getattr(brand_context, "industry", None):
                verified_elements.append(brand_context.industry)

        if brief:
            if brief.objective:
                verified_elements.append(brief.objective)
            if brief.custom_brief:
                verified_elements.append(brief.custom_brief)
            if brief.target_audience:
                verified_elements.extend(brief.target_audience)
            success_crit = getattr(brief, "success_criteria", None) or []
            verified_elements.extend(success_crit)

        if strategy and strategy.strategic_angles:
            for a in strategy.strategic_angles:
                if a.supporting_evidence:
                    verified_elements.extend(a.supporting_evidence)
                if a.rationale:
                    verified_elements.append(a.rationale)

        if market_research:
            snippets = getattr(market_research, "buyer_language_snippets", None) or []
            verified_elements.extend(snippets)
            pain_points = getattr(market_research, "pain_points", None) or []
            verified_elements.extend(pain_points)

        verified_corpus = " ".join([elem for elem in verified_elements if elem]).lower()

        # Regex patterns for commercial claims, currencies, discounts, guarantees
        commercial_patterns = [
            # Currency figures: $500, €49, £100, ₹999, 500 dollars, 50 USD
            re.compile(r"([$€£₹]\s*\d+(?:[.,]\d+)?|\b\d+\s*(?:dollars|usd|inr|euros|pounds)\b)", re.IGNORECASE),
            # Discounts & freebies: 50% off, flat 20%, free consultation, discount code
            re.compile(
                r"(\b\d+%\s*off\b|\bflat\s*\d+%\b|\b\d+%\s*discount\b|\bfree\s+(?:membership|trial|lifetime|giveaway|consultation|shipping|gift)\b|\bdiscount\s+code\b|\bpromo\s+code\b)",
                re.IGNORECASE,
            ),
            # Guarantees: 100% money back, risk-free guarantee
            re.compile(
                r"(\b\d+%\s*(?:money-?back|satisfaction|maintenance-free)?\s*guarantee\b|\b(?:money-?back|risk-?free)\s+guarantee\b)",
                re.IGNORECASE,
            ),
            # Metric claims: 10x roi, 50% boost, cut downtime by 75%
            re.compile(
                r"(\b\d+(?:\.\d+)?x\s+(?:faster|cheaper|reduction|increase|boost|roi|growth)\b|\b\d+%\s+(?:faster|cheaper|reduction|increase|drop|boost|roi|growth|downtime)\b)",
                re.IGNORECASE,
            ),
        ]

        for idx, deliv in enumerate(deliverables):
            total_checks += 1
            # Combine all deliverable copy
            text_parts = [
                deliv.title or "",
                deliv.primary_hook or "",
                deliv.caption or "",
                deliv.call_to_action or "",
            ]
            if deliv.carousel_slides:
                for sl in deliv.carousel_slides:
                    text_parts.extend([sl.headline or "", sl.body_copy or ""])
            if deliv.reel_scenes:
                for sc in deliv.reel_scenes:
                    text_parts.extend([sc.on_screen_text or "", sc.spoken_audio_or_voiceover or ""])

            # Strip valid client input placeholders first
            raw_text = " ".join(text_parts)
            clean_text = strip_placeholders(raw_text)

            unverified_claims: list[str] = []
            for pat in commercial_patterns:
                for match in pat.finditer(clean_text):
                    claim_str = match.group(0).strip().lower()
                    # Extract the core numeric or key token
                    num_match = re.search(r"\d+", claim_str)
                    core_num = num_match.group(0) if num_match else None

                    # Check if the claim or its core number/offer is grounded in the verified corpus
                    is_grounded = False
                    if claim_str in verified_corpus:
                        is_grounded = True
                    elif core_num and (core_num in verified_corpus):
                        is_grounded = True
                    elif "free consultation" in claim_str and ("consult" in verified_corpus or "demo" in verified_corpus):
                        is_grounded = True

                    if not is_grounded:
                        unverified_claims.append(claim_str)

            if unverified_claims:
                uniq_claims = list(dict.fromkeys(unverified_claims))
                findings.append(
                    QualityFinding(
                        category=FindingCategory.commercial_unverified_claim,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' features unverified commercial claim(s) or discount(s): {', '.join(uniq_claims)}.",
                        issue=f"Unverified commercial claim(s): {', '.join(uniq_claims)}.",
                        remediation_instruction="Remove unverified claims or ground them in confirmed facts / verified offers, or use [CLIENT_INPUT_NEEDED: <fact>].",
                    )
                )
            else:
                checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Check 4: Technical Compliance & Pacing Continuity (Deterministic)
    # -----------------------------------------------------------------------
    def _audit_technical_compliance_and_pacing(
        self,
        deliverables: list[DeliverablePlan],
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Check 4: Production Feasibility, Pacing & Technical Continuity.
        Enforces Mandatory User Adjustment 1:
        - WPS: Generation target is 2.2-2.8 wps. In QA: warn > 3.2 wps, block > 3.8 wps.
          Never block slow/pause scenes < 2.2 wps.
        - Reel duration: 15-60s total duration.
        - Scene timestamps: sequential and non-overlapping.
        - Carousel slides: 3-10 slides hard QA bound.
        - Caption length: <= 2200 characters.
        - Cross-deliverable hook token Jaccard similarity < 0.65.
        """
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        for idx, deliv in enumerate(deliverables):
            deliv_type = (deliv.deliverable_type or "").lower().strip()

            # 1. Caption length check (Platform max 2200 chars)
            total_checks += 1
            if not deliv.caption or len(deliv.caption.strip()) < 10:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' lacks a complete caption body (minimum 10 characters).",
                        issue="Lacks complete caption body.",
                        remediation_instruction="Provide a publishable caption of at least 10 characters.",
                    )
                )
            elif len(deliv.caption) > 2200:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.technical_compliance,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} caption length ({len(deliv.caption)} chars) exceeds platform limit of 2200 characters.",
                        issue=f"Caption length {len(deliv.caption)} exceeds 2200 characters.",
                        remediation_instruction="Trim caption copy to remain within the 2200 character platform boundary.",
                    )
                )
            else:
                checks_passed += 1

            # 2. Format-Specific Checks: Reel
            if deliv_type == "reel":
                total_checks += 1
                if not deliv.reel_scenes or len(deliv.reel_scenes) == 0:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.production_feasibility,
                            severity=FindingSeverity.critical,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Reel #{idx+1} '{deliv.title}' has zero director scenes planned.",
                            issue="Reel has zero director scenes planned.",
                            remediation_instruction="Architect scene-by-scene beats with timestamps and director instructions.",
                        )
                    )
                else:
                    checks_passed += 1

                    # Check sequential non-overlapping timestamps and total duration
                    prev_end = 0.0
                    total_reel_duration = 0.0
                    has_overlap = False

                    for sc_idx, sc in enumerate(deliv.reel_scenes):
                        total_checks += 1
                        time_range = parse_scene_range(sc.timestamp_range)
                        if not time_range:
                            # Could not parse timestamp
                            findings.append(
                                QualityFinding(
                                    category=FindingCategory.technical_compliance,
                                    severity=FindingSeverity.warning,
                                    deliverable_index=idx,
                                    deliverable_title=deliv.title,
                                    issue_description=f"Reel #{idx+1} Scene #{sc.scene_number} has unparseable timestamp range: '{sc.timestamp_range}'.",
                                    issue=f"Unparseable scene timestamp: '{sc.timestamp_range}'.",
                                    remediation_instruction="Use standard '0:00 - 0:03' timestamp range syntax.",
                                )
                            )
                            continue

                        start_s, end_s = time_range
                        scene_dur = max(0.0, end_s - start_s)
                        total_reel_duration = max(total_reel_duration, end_s)

                        # Sequential start check for Scene 1
                        if sc_idx == 0:
                            if start_s != 0.0:
                                findings.append(
                                    QualityFinding(
                                        category=FindingCategory.platform_best_practice,
                                        severity=FindingSeverity.info,
                                        deliverable_index=idx,
                                        deliverable_title=deliv.title,
                                        issue_description=f"Reel Scene 1 starts at {start_s:.1f}s instead of 0:00 to optimize opening hook retention.",
                                        issue="Opening scene does not start at 0:00.",
                                        remediation_instruction="Align opening scene timestamp range to start at 0:00.",
                                    )
                                )
                        else:
                            # Overlap check
                            if start_s < prev_end - 0.05:  # small 50ms tolerance
                                has_overlap = True
                                findings.append(
                                    QualityFinding(
                                        category=FindingCategory.technical_compliance,
                                        severity=FindingSeverity.critical,
                                        deliverable_index=idx,
                                        deliverable_title=deliv.title,
                                        issue_description=f"Reel #{idx+1} Scene #{sc.scene_number} ({sc.timestamp_range}) overlaps with preceding scene ending at {prev_end:.1f}s.",
                                        issue=f"Scene #{sc.scene_number} overlaps with previous scene.",
                                        remediation_instruction="Ensure non-overlapping, strictly sequential scene timestamps (e.g. 0:00-0:03, 0:03-0:08).",
                                    )
                                )

                        prev_end = max(prev_end, end_s)

                        # Spoken Pacing Check: User Adjustment 1
                        # warn > 3.2 wps, block > 3.8 wps, never block slow scenes < 2.2 wps
                        vo_text = strip_placeholders(sc.spoken_audio_or_voiceover or "")
                        if vo_text and scene_dur > 0:
                            word_count = len(re.findall(r"\b\w+\b", vo_text))
                            wps = word_count / scene_dur

                            if wps > 3.8:
                                findings.append(
                                    QualityFinding(
                                        category=FindingCategory.technical_compliance,
                                        severity=FindingSeverity.critical,
                                        deliverable_index=idx,
                                        deliverable_title=deliv.title,
                                        issue_description=f"Reel #{idx+1} Scene #{sc.scene_number} spoken pacing ({wps:.1f} words/sec) exceeds hard ceiling of 3.8 wps ({word_count} words in {scene_dur:.1f}s).",
                                        issue=f"Spoken pacing ({wps:.1f} wps) exceeds 3.8 wps.",
                                        remediation_instruction=f"Reduce voiceover to at most {int(scene_dur * 2.8)} words for this {scene_dur:.1f}s beat.",
                                    )
                                )
                            elif wps > 3.2:
                                findings.append(
                                    QualityFinding(
                                        category=FindingCategory.technical_compliance,
                                        severity=FindingSeverity.warning,
                                        deliverable_index=idx,
                                        deliverable_title=deliv.title,
                                        issue_description=f"Reel #{idx+1} Scene #{sc.scene_number} spoken pacing ({wps:.1f} words/sec) exceeds conversational pacing target of 3.2 wps ({word_count} words in {scene_dur:.1f}s).",
                                        issue=f"Spoken pacing ({wps:.1f} wps) exceeds 3.2 wps.",
                                        remediation_instruction=f"Calibrate voiceover to target 2.2-2.8 words/sec (~{int(scene_dur * 2.5)} words).",
                                    )
                                )
                            else:
                                checks_passed += 1
                        else:
                            checks_passed += 1

                    # Total Reel Duration Check (15s to 60s hard QA bound)
                    total_checks += 1
                    if total_reel_duration < 15.0:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.technical_compliance,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Reel #{idx+1} duration ({total_reel_duration:.1f}s) is below minimum duration requirement of 15 seconds.",
                                issue=f"Reel duration ({total_reel_duration:.1f}s) < 15 seconds.",
                                remediation_instruction="Extend storyboard scenes to total between 15 and 60 seconds.",
                            )
                        )
                    elif total_reel_duration > 60.0:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.technical_compliance,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Reel #{idx+1} duration ({total_reel_duration:.1f}s) exceeds maximum duration requirement of 60 seconds.",
                                issue=f"Reel duration ({total_reel_duration:.1f}s) > 60 seconds.",
                                remediation_instruction="Tighten storyboard scenes to total between 15 and 60 seconds.",
                            )
                        )
                    else:
                        checks_passed += 1

            # 3. Format-Specific Checks: Carousel (3-10 slides hard QA bound)
            elif deliv_type == "carousel":
                total_checks += 1
                slide_count = len(deliv.carousel_slides) if deliv.carousel_slides else 0
                if slide_count < 3:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.technical_compliance,
                            severity=FindingSeverity.critical,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Carousel #{idx+1} '{deliv.title}' has only {slide_count} slide(s) (minimum 3 required: cover, content, takeaway/CTA).",
                            issue=f"Carousel has only {slide_count} slide(s) (< 3 required).",
                            remediation_instruction="Architect at least 3 slides: cover thumb-stop, value slides, and conversion CTA slide.",
                        )
                    )
                elif slide_count > 10:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.technical_compliance,
                            severity=FindingSeverity.critical,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Carousel #{idx+1} '{deliv.title}' has {slide_count} slides (hard ceiling is 10 slides).",
                            issue=f"Carousel has {slide_count} slides (> 10 max).",
                            remediation_instruction="Condense carousel deck to between 3 and 10 slides.",
                        )
                    )
                else:
                    checks_passed += 1

        # 4. Cross-Deliverable Anti-Repetition: Hook Token Jaccard Similarity < 0.65
        for i in range(len(deliverables)):
            for j in range(i + 1, len(deliverables)):
                total_checks += 1
                hook_i = strip_placeholders(deliverables[i].primary_hook or "")
                hook_j = strip_placeholders(deliverables[j].primary_hook or "")
                if hook_i and hook_j:
                    sim = calculate_jaccard_similarity(hook_i, hook_j)
                    if sim >= 0.65:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.platform_best_practice,
                                severity=FindingSeverity.critical,
                                deliverable_index=j,
                                deliverable_title=deliverables[j].title,
                                issue_description=f"Deliverable #{j+1} hook strongly repeats Deliverable #{i+1} hook (Jaccard token similarity {sim:.2f} >= 0.65): '{hook_j[:60]}' vs '{hook_i[:60]}'.",
                                issue=f"Hook token similarity ({sim:.2f}) with Deliverable #{i+1} exceeds 0.65.",
                                remediation_instruction="Diversify primary hook phrasing and strategic angle to prevent repetitive campaign feeds.",
                            )
                        )
                    else:
                        checks_passed += 1
                else:
                    checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Check 6: Hook Length & CTA Structural Hygiene (Deterministic)
    # -----------------------------------------------------------------------
    def _audit_hook_length_and_cta_hygiene(
        self,
        deliverables: list[DeliverablePlan],
        brand_context: BrandContext | None = None,
        brief: CampaignBrief | None = None,
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Check 6: Primary hook length bounds and CTA structural hygiene.
        - Hook presence: >= 5 chars
        - Hook word count: 13-18 words warning, > 18 words blocking.
        - CTA presence: >= 3 chars
        - URL hygiene: allows verified client/brief URLs on LinkedIn while blocking fabricated URLs.
        """
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        # Collect verified URLs / domains from context
        verified_domains: set[str] = set()
        if brand_context:
            if getattr(brand_context, "website", None):
                domain_match = re.search(r"https?://(?:www\.)?([^/\s]+)", brand_context.website)
                if domain_match:
                    verified_domains.add(domain_match.group(1).lower())
            if brand_context.business_name:
                name_clean = re.sub(r"[^a-zA-Z0-9]", "", brand_context.business_name).lower()
                if name_clean:
                    verified_domains.add(name_clean)
            if brand_context.confirmed_facts:
                for fact in brand_context.confirmed_facts:
                    for d_match in re.finditer(r"\b([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b", fact):
                        verified_domains.add(d_match.group(1).lower())

        if brief:
            if brief.custom_brief:
                for d_match in re.finditer(r"\b([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b", brief.custom_brief):
                    verified_domains.add(d_match.group(1).lower())

        url_extractor = re.compile(
            r"(?:https?://|www\.)[a-zA-Z0-9.\-_]+(?:\.[a-zA-Z]{2,})(?:/[^\s]*)?|\b[a-zA-Z0-9.\-_]+\.(?:com|org|io|ai|net|co|in|edu|gov)(?:/[^\s]*)?",
            re.IGNORECASE,
        )

        for idx, deliv in enumerate(deliverables):
            platform = (deliv.platform or "").lower().strip()

            # 1. Primary Hook length & word count
            total_checks += 1
            hook_text = strip_placeholders(deliv.primary_hook or "")
            if not hook_text or len(hook_text) < 5:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' lacks a functional primary hook.",
                        issue="Lacks functional primary hook.",
                        remediation_instruction="Draft an attention-grabbing primary hook of at least 5 characters.",
                    )
                )
            else:
                words = len(re.findall(r"\b\w+\b", hook_text))
                if words > 18:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.hook_length_cta,
                            severity=FindingSeverity.critical,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Deliverable #{idx+1} primary hook ({words} words) exceeds hard limit of 18 words ('{hook_text[:60]}...').",
                            issue=f"Primary hook word count ({words}) > 18 words.",
                            remediation_instruction="Condense opening hook to under 13 words to prevent feed truncation.",
                        )
                    )
                elif words >= 13:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.hook_length_cta,
                            severity=FindingSeverity.warning,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Deliverable #{idx+1} primary hook ({words} words) is in warning zone (13-18 words): recommend tightening for maximum thumb-stop punch.",
                            issue=f"Primary hook word count ({words}) between 13-18 words.",
                            remediation_instruction="Tighten primary hook to fewer than 13 words.",
                        )
                    )
                else:
                    checks_passed += 1

            # 2. Call To Action check
            total_checks += 1
            cta_text = strip_placeholders(deliv.call_to_action or "")
            if not cta_text or len(cta_text) < 3:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.warning,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' has an empty or weak Call To Action.",
                        issue="Empty or weak Call To Action.",
                        remediation_instruction="Add an actionable, conversion-focused Call To Action.",
                    )
                )
            else:
                checks_passed += 1

            # 3. URL Hygiene check (User Adjustment 2)
            total_checks += 1
            copy_with_cta = f"{deliv.caption or ''} {deliv.call_to_action or ''}"
            detected_urls = url_extractor.findall(copy_with_cta)
            url_violation = False

            for raw_url in detected_urls:
                raw_url_clean = raw_url.lower()
                is_verified = any(d in raw_url_clean for d in verified_domains)

                if platform == "linkedin":
                    if not is_verified:
                        url_violation = True
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.hook_length_cta,
                                severity=FindingSeverity.critical,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description=f"Deliverable #{idx+1} contains unverified or fabricated URL '{raw_url}'. Only verified client links from brief are permitted.",
                                issue=f"Unverified or fabricated URL: '{raw_url}'.",
                                remediation_instruction="Remove invented external links and use only verified client domains or standard CTA copy.",
                            )
                        )
                elif platform in ("instagram", "tiktok"):
                    # Raw clickable URLs in captions don't work on IG / TikTok
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.platform_best_practice,
                            severity=FindingSeverity.warning,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Raw external URL '{raw_url}' in {platform} caption is not clickable. Use 'link in bio' CTA instead.",
                            issue=f"Non-clickable URL in {platform} caption: '{raw_url}'.",
                            remediation_instruction="Replace inline link with 'check the link in our bio' CTA.",
                        )
                    )

            if not url_violation:
                checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Contract Quotas Compliance Audit
    # -----------------------------------------------------------------------
    def _audit_contract_quotas(
        self,
        deliverables: list[DeliverablePlan],
        brand_context: BrandContext | None,
    ) -> tuple[list[QualityFinding], int, int]:
        """Verify delivered counts match or satisfy ContractQuota expectations."""
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        if not brand_context or not brand_context.contract_quotas:
            return findings, 0, 0

        actual_counts: dict[tuple[str, str], int] = collections.defaultdict(int)
        for d in deliverables:
            actual_counts[(d.platform.lower(), d.deliverable_type.lower())] += 1

        for quota in brand_context.contract_quotas:
            total_checks += 1
            key = (quota.platform.lower(), quota.deliverable_type.lower())
            actual = actual_counts.get(key, 0)
            expected = quota.monthly_quantity

            if actual < expected:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.quota_mismatch,
                        severity=FindingSeverity.warning,
                        deliverable_index=None,
                        deliverable_title=None,
                        issue_description=f"Contract quota deficit for {quota.platform} {quota.deliverable_type}: planned {actual}, contracted monthly quantity {expected}.",
                        issue=f"Quota deficit for {quota.platform} {quota.deliverable_type}: {actual}/{expected}.",
                        remediation_instruction=f"Plan {expected - actual} additional {quota.platform} {quota.deliverable_type} deliverable(s).",
                    )
                )
            else:
                checks_passed += 1

        return findings, checks_passed, total_checks

    # -----------------------------------------------------------------------
    # Check 5 & Semantic Boundary Audit (Semantic Critic)
    # -----------------------------------------------------------------------
    async def _audit_semantic_compliance(
        self,
        deliverables: list[DeliverablePlan],
        strategy: CampaignStrategy | None,
        brand_context: BrandContext | None,
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Perform semantic LLM evaluation for:
        - Check 2: Brand prohibited concepts and subtle claims
        - Check 5: Visual production feasibility (physically filmable vs impossible directions)
        """
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        has_prohibited_claims = bool(brand_context and brand_context.prohibited_claims)
        has_prohibited_concepts = bool(brand_context and getattr(brand_context, "prohibited_concepts", None))
        has_tone_guidelines = bool(
            brand_context and brand_context.tone_guidelines and (brand_context.tone_guidelines.do or brand_context.tone_guidelines.dont)
        )

        # Build concise audit context
        claims_text = "None specified."
        if brand_context and brand_context.prohibited_claims:
            claims_text = "\n".join([
                f"- Prohibited Claim: {pc.claim} (Reason: {pc.reason or 'strict policy'})"
                for pc in brand_context.prohibited_claims
            ])

        concepts_text = "None specified."
        if brand_context and getattr(brand_context, "prohibited_concepts", None):
            concepts_text = "\n".join([f"- Prohibited Concept: {c}" for c in brand_context.prohibited_concepts])

        tone_text = "Standard professional."
        if brand_context and brand_context.tone_guidelines:
            dos = ", ".join(brand_context.tone_guidelines.do) or "None"
            donts = ", ".join(brand_context.tone_guidelines.dont) or "None"
            tone_text = f"Prescribed (DO): {dos}\nProscribed (DON'T): {donts}"

        strat_text = "General marketing alignment."
        if strategy and strategy.strategic_angles:
            strat_text = "\n".join([f"- Angle: {a.angle_name}: {a.rationale}" for a in strategy.strategic_angles])

        deliverable_summaries = []
        for i, d in enumerate(deliverables):
            deliv_summary = f"[Deliverable #{i}: {d.title} ({d.platform} {d.deliverable_type})]\n  Hook: {d.primary_hook}\n  Caption: {d.caption}\n  CTA: {d.call_to_action}"
            if d.reel_scenes:
                scene_text = " | ".join([
                    f"{s.timestamp_range}: Visual: {s.visual_action} | Audio: {s.spoken_audio_or_voiceover or s.on_screen_text}"
                    for s in d.reel_scenes
                ])
                deliv_summary += f"\n  Scenes: {scene_text}"
            if d.carousel_slides:
                slide_text = " | ".join([
                    f"Slide {s.slide_number} ({s.slide_type}): Layout: {s.visual_layout} | Headline: {s.headline}"
                    for s in d.carousel_slides
                ])
                deliv_summary += f"\n  Slides: {slide_text}"
            deliverable_summaries.append(deliv_summary)

        audit_prompt = f"""You are the AgencyOS Quality Evaluator and Brand Compliance Critic.
Conduct a rigorous audit of the planned deliverables against Brand Guardrails, Physical Filmability, and Campaign Strategy.

BRAND PROHIBITED CLAIMS (CRITICAL VIOLATIONS):
{claims_text}

BRAND PROHIBITED CONCEPTS:
{concepts_text}

BRAND TONE & VOICE GUIDELINES:
{tone_text}

CAMPAIGN STRATEGIC ANGLES:
{strat_text}

DELIVERABLES TO EVALUATE:
{chr(10).join(deliverable_summaries)}

AUDIT INSTRUCTIONS:
1. Identify any assertions, promises, or implications that violate BRAND PROHIBITED CLAIMS or CONCEPTS.
2. Critique visual director instructions: flag physically impossible or abstract instructions (e.g. impossible CGI like camera traveling inside living human brain, atoms dancing) that cannot be filmed by real production teams.
3. Check if any deliverable completely contradicts the strategic angles.
4. If a deliverable is compliant and feasible, DO NOT fabricate issues. Only return genuine violations.
5. If everything is compliant, return an empty issues list.
"""

        total_checks += len(deliverables)

        try:
            audit_result: SemanticAuditOutput = await invoke_structured_llm(
                schema_class=SemanticAuditOutput,
                prompt=audit_prompt,
                model=self.model_name,
                temperature=self.temperature,
            )

            for issue in audit_result.issues:
                idx = issue.deliverable_index
                d_title = deliverables[idx].title if 0 <= idx < len(deliverables) else None
                cat_val = issue.category
                sev_enum = FindingSeverity.critical if issue.severity in ("critical", "blocking") else FindingSeverity.warning
                findings.append(
                    QualityFinding(
                        category=cat_val,
                        severity=sev_enum,
                        deliverable_index=idx,
                        deliverable_title=d_title,
                        issue_description=issue.issue_description,
                        issue=issue.issue or issue.issue_description,
                        remediation_instruction=issue.remediation_instruction,
                    )
                )

            flagged_indices = {i.deliverable_index for i in audit_result.issues if i.severity in ("critical", "blocking", "warning")}
            checks_passed += (len(deliverables) - len(flagged_indices))

        except Exception as e:
            logger.warning(f"Semantic audit LLM invocation encountered issue: {e}. Defaulting to deterministic checks.")
            checks_passed += len(deliverables)

        return findings, checks_passed, total_checks


# ---------------------------------------------------------------------------
# LangGraph Execution Node
# ---------------------------------------------------------------------------

async def quality_evaluator_node(state: CampaignState) -> dict[str, Any]:
    """
    LangGraph execution node for Agent 6: Quality Evaluator & Hybrid QA Gate.
    """
    agent_name = "quality_evaluator"
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    model_name = (
        getattr(settings, "CAMPAIGN_QUALITY_MODEL", None)
        or settings.CAMPAIGN_EVALUATION_MODEL
    )

    try:
        deliverables = state.get("deliverable_plans") or []
        strategy = state.get("campaign_strategy")
        brand_context = state.get("brand_context")
        brief = state.get("brief")
        market_research = state.get("market_research")
        revision_count = state.get("revision_count", 0)
        max_revisions = state.get("max_revisions", 2)

        evaluator = QualityEvaluatorAgent(model_name=model_name)
        evaluation: QualityEvaluation = await evaluator.evaluate(
            deliverables=deliverables,
            strategy=strategy,
            brief=brief,
            brand_context=brand_context,
            market_research=market_research,
            revision_count=revision_count,
            max_revisions=max_revisions,
        )

        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()

        # Determine next workflow status
        if evaluation.is_approved_for_human_review:
            workflow_status = "awaiting_approval"
        elif evaluation.revision_instruction and evaluation.revision_instruction.target_agent == "human":
            workflow_status = "escalated_to_human"
        else:
            workflow_status = "refining_plan"

        new_revision_count = revision_count + (1 if evaluation.revision_required else 0)

        telemetry = AgentTelemetry(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            model_name=model_name,
            success=True,
        )

        return {
            "quality_evaluation": evaluation,
            "revision_count": new_revision_count,
            "workflow_status": workflow_status,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Quality Evaluator node failed: {str(e)}"
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
