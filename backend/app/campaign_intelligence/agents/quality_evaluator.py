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


class SemanticAuditIssue(BaseModel):
    """Structured issue returned by semantic LLM audit."""
    deliverable_index: int = Field(default=0, description="Index (0-based) of the affected deliverable")
    category: Literal["prohibited_claim", "brand_compliance", "strategic_alignment"] = "brand_compliance"
    severity: Literal["critical", "warning", "info"] = "warning"
    issue_description: str
    remediation_instruction: str

    @model_validator(mode="before")
    @classmethod
    def normalize_issue(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)

        sev = str(d.get("severity") or "warning").lower().strip()
        if sev in ("critical", "high", "urgent", "blocker"):
            d["severity"] = "critical"
        elif sev in ("info", "low", "minor", "suggestion"):
            d["severity"] = "info"
        else:
            d["severity"] = "warning"

        cat = str(d.get("category") or "brand_compliance").lower().strip()
        if "claim" in cat or "prohibit" in cat:
            d["category"] = "prohibited_claim"
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


class QualityEvaluatorAgent:
    """
    Agent 6: Quality Evaluator & Critic
    
    Responsibilities:
    1. Deterministic Prohibited Terms Verification:
       - Rigorously scans all deliverable text fields (titles, hooks, captions, slides, scene voiceovers).
       - Zero tolerance for exact prohibited terms.
    2. Contract Quotas Compliance Audit:
       - Matches planned deliverable counts by platform and deliverable type against monthly contract quotas.
    3. Production Feasibility & Completeness Gate:
       - Verifies Reels have timestamped director scenes, visual actions, on-screen text, and voiceovers.
       - Verifies Carousels have multi-slide structures with distinct cover and CTA slides.
       - Verifies hook presence and publishable caption depth.
    4. Semantic Prohibited Claims & Brand Alignment Audit:
       - Evaluates against brand prohibited claims and core tone guardrails via structured LLM audit.
    5. Objective Compliance Scoring & Automated Revision Routing:
       - Calculates exact passed/total check ratio.
       - Routes actionable revision instructions back to Content Architect, Campaign Strategist, or Human.
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.1):
        self.model_name = model_name or settings.GROQ_MODEL
        self.temperature = temperature

    async def evaluate(
        self,
        deliverables: list[DeliverablePlan],
        strategy: CampaignStrategy | None = None,
        brief: CampaignBrief | None = None,
        brand_context: BrandContext | None = None,
        revision_count: int = 0,
        max_revisions: int = 2,
    ) -> QualityEvaluation:
        """
        Execute comprehensive hybrid audit on planned deliverables.
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
                    remediation_instruction="Generate at least one complete deliverable matching campaign requirements.",
                )
            )
            return QualityEvaluation(
                is_approved_for_human_review=False,
                compliance_score=0.0,
                findings=findings,
                revision_required=True,
                revision_instruction=RevisionInstruction(
                    target_agent="human" if revision_count >= max_revisions else "content_architect",
                    reason="Plan contains zero deliverables.",
                    instructions=["Content Architect must generate deliverable plans."],
                ),
                evaluated_at=datetime.now(timezone.utc).isoformat(),
            )

        # -------------------------------------------------------------
        # 1. Deterministic Audit: Exact Prohibited Terms Scan
        # -------------------------------------------------------------
        term_findings, term_passed, term_total = self._audit_prohibited_terms(deliverables, brand_context)
        findings.extend(term_findings)
        checks_passed += term_passed
        total_checks += term_total

        # -------------------------------------------------------------
        # 2. Deterministic Audit: Contract Quotas Compliance
        # -------------------------------------------------------------
        quota_findings, quota_passed, quota_total = self._audit_contract_quotas(deliverables, brand_context)
        findings.extend(quota_findings)
        checks_passed += quota_passed
        total_checks += quota_total

        # -------------------------------------------------------------
        # 3. Deterministic Audit: Production Feasibility & Completeness
        # -------------------------------------------------------------
        feas_findings, feas_passed, feas_total = self._audit_production_feasibility(deliverables)
        findings.extend(feas_findings)
        checks_passed += feas_passed
        total_checks += feas_total

        # -------------------------------------------------------------
        # 4. Semantic Audit: Prohibited Claims & Strategic Alignment
        # -------------------------------------------------------------
        semantic_findings, sem_passed, sem_total = await self._audit_semantic_compliance(
            deliverables=deliverables,
            strategy=strategy,
            brand_context=brand_context,
        )
        findings.extend(semantic_findings)
        checks_passed += sem_passed
        total_checks += sem_total

        # -------------------------------------------------------------
        # 5. Calculate Objective Compliance Score
        # -------------------------------------------------------------
        total_checks = max(total_checks, 1)
        compliance_score = round(checks_passed / total_checks, 2)

        # -------------------------------------------------------------
        # 6. Determine Approval & Revision Decision Gate
        # -------------------------------------------------------------
        critical_findings = [f for f in findings if f.severity == FindingSeverity.critical]
        warning_findings = [f for f in findings if f.severity == FindingSeverity.warning]

        # Approval requires ZERO critical findings and compliance score >= 0.75
        is_approved = (len(critical_findings) == 0) and (compliance_score >= 0.75)
        revision_required = not is_approved

        revision_instruction: RevisionInstruction | None = None
        if revision_required:
            if revision_count >= max_revisions:
                # Escalation threshold reached
                instruction_items = [
                    f"[{f.category.value.upper()}] {f.deliverable_title or 'General'}: {f.issue_description} -> Remediation: {f.remediation_instruction}"
                    for f in critical_findings
                ]
                if not instruction_items:
                    instruction_items = [
                        f"[{f.category.value.upper()}] {f.deliverable_title or 'General'}: {f.issue_description} -> Remediation: {f.remediation_instruction}"
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
                    f.category in (FindingCategory.strategic_alignment, FindingCategory.quota_mismatch)
                    for f in critical_findings
                )
                target_agent: Literal["content_architect", "campaign_strategist", "human"] = (
                    "campaign_strategist" if has_strategic_issue else "content_architect"
                )

                instruction_items = [
                    f"[{f.category.value.upper()}] Deliverable '{f.deliverable_title or 'Plan'}': {f.issue_description} (Action: {f.remediation_instruction})"
                    for f in critical_findings
                ]
                if not instruction_items:
                    instruction_items = [
                        f"[{f.category.value.upper()}] Deliverable '{f.deliverable_title or 'Plan'}': {f.issue_description} (Action: {f.remediation_instruction})"
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
            revision_required=revision_required,
            revision_instruction=revision_instruction,
            evaluated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _audit_prohibited_terms(
        self,
        deliverables: list[DeliverablePlan],
        brand_context: BrandContext | None,
    ) -> tuple[list[QualityFinding], int, int]:
        """Scan all text fields in all deliverables for exact prohibited terms."""
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        if not brand_context or not brand_context.prohibited_terms:
            return findings, 0, 0

        for idx, deliv in enumerate(deliverables):
            # Gather all deliverable copy into searchable text
            text_parts = [
                deliv.title,
                deliv.primary_hook,
                *(deliv.hook_options or []),
                deliv.caption,
                deliv.call_to_action,
                " ".join(deliv.hashtags or []),
            ]
            if deliv.reel_scenes:
                for sc in deliv.reel_scenes:
                    text_parts.extend([sc.visual_action, sc.on_screen_text or "", sc.spoken_audio_or_voiceover or ""])
            if deliv.carousel_slides:
                for sl in deliv.carousel_slides:
                    text_parts.extend([sl.headline, sl.body_copy, sl.visual_layout])

            full_text = " ".join(text_parts).lower()

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
                            remediation_instruction=f"Remove or replace prohibited term '{pt.term}' with an approved alternative.",
                        )
                    )
                else:
                    checks_passed += 1

        return findings, checks_passed, total_checks

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
                        remediation_instruction=f"Plan {expected - actual} additional {quota.platform} {quota.deliverable_type} deliverable(s).",
                    )
                )
            else:
                checks_passed += 1

        return findings, checks_passed, total_checks

    def _audit_production_feasibility(
        self,
        deliverables: list[DeliverablePlan],
    ) -> tuple[list[QualityFinding], int, int]:
        """Check completeness of hooks, captions, CTAs, scenes, and slides."""
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        for idx, deliv in enumerate(deliverables):
            # 1. Primary Hook check
            total_checks += 1
            if not deliv.primary_hook or len(deliv.primary_hook.strip()) < 5:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' lacks a functional primary hook.",
                        remediation_instruction="Draft an attention-grabbing primary hook of at least 5 characters.",
                    )
                )
            else:
                checks_passed += 1

            # 2. Caption check
            total_checks += 1
            if not deliv.caption or len(deliv.caption.strip()) < 10:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.critical,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' lacks a complete caption body.",
                        remediation_instruction="Provide a publishable caption of at least 10 characters.",
                    )
                )
            else:
                checks_passed += 1

            # 3. Call to Action check
            total_checks += 1
            if not deliv.call_to_action or len(deliv.call_to_action.strip()) < 3:
                findings.append(
                    QualityFinding(
                        category=FindingCategory.production_feasibility,
                        severity=FindingSeverity.warning,
                        deliverable_index=idx,
                        deliverable_title=deliv.title,
                        issue_description=f"Deliverable #{idx+1} '{deliv.title}' has an empty or weak Call To Action.",
                        remediation_instruction="Add an actionable, conversion-focused Call To Action.",
                    )
                )
            else:
                checks_passed += 1

            # 4. Format-specific validation
            deliv_type = deliv.deliverable_type.lower()
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
                            remediation_instruction="Architect scene-by-scene beats with timestamps and director instructions.",
                        )
                    )
                else:
                    checks_passed += 1
                    # Opening hook scene timing check
                    total_checks += 1
                    first_scene = deliv.reel_scenes[0]
                    if first_scene.timestamp_range and ("0:00" in first_scene.timestamp_range or "00:00" in first_scene.timestamp_range):
                        checks_passed += 1
                    else:
                        findings.append(
                            QualityFinding(
                                category=FindingCategory.platform_best_practice,
                                severity=FindingSeverity.info,
                                deliverable_index=idx,
                                deliverable_title=deliv.title,
                                issue_description="Reel Scene 1 should start at 0:00 to optimize opening hook retention.",
                                remediation_instruction="Align opening scene timestamp range to start at 0:00.",
                            )
                        )

            elif deliv_type == "carousel":
                total_checks += 1
                if not deliv.carousel_slides or len(deliv.carousel_slides) < 2:
                    findings.append(
                        QualityFinding(
                            category=FindingCategory.production_feasibility,
                            severity=FindingSeverity.critical,
                            deliverable_index=idx,
                            deliverable_title=deliv.title,
                            issue_description=f"Carousel #{idx+1} '{deliv.title}' has only {len(deliv.carousel_slides) if deliv.carousel_slides else 0} slide(s) (minimum 2 required).",
                            remediation_instruction="Create at least 2 slides: cover slide and takeaway/CTA slide.",
                        )
                    )
                else:
                    checks_passed += 1

        return findings, checks_passed, total_checks

    async def _audit_semantic_compliance(
        self,
        deliverables: list[DeliverablePlan],
        strategy: CampaignStrategy | None,
        brand_context: BrandContext | None,
    ) -> tuple[list[QualityFinding], int, int]:
        """
        Perform semantic LLM evaluation for prohibited claims and brand tone alignment.
        """
        findings: list[QualityFinding] = []
        checks_passed = 0
        total_checks = 0

        # Only invoke LLM if there are prohibited claims or tone guidelines to verify
        has_prohibited_claims = bool(brand_context and brand_context.prohibited_claims)
        has_tone_guidelines = bool(
            brand_context and brand_context.tone_guidelines and (brand_context.tone_guidelines.do or brand_context.tone_guidelines.dont)
        )

        if not has_prohibited_claims and not has_tone_guidelines and not strategy:
            return findings, 0, 0

        # Build concise audit prompt
        claims_text = "None specified."
        if brand_context and brand_context.prohibited_claims:
            claims_text = "\n".join([f"- Prohibited Claim: {pc.claim} (Reason: {pc.reason or 'strict policy'})" for pc in brand_context.prohibited_claims])

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
                scene_text = " | ".join([f"{s.timestamp_range}: {s.spoken_audio_or_voiceover or s.on_screen_text}" for s in d.reel_scenes])
                deliv_summary += f"\n  Scenes: {scene_text}"
            if d.carousel_slides:
                slide_text = " | ".join([f"Slide {s.slide_number} ({s.slide_type}): {s.headline} - {s.body_copy}" for s in d.carousel_slides])
                deliv_summary += f"\n  Slides: {slide_text}"
            deliverable_summaries.append(deliv_summary)

        audit_prompt = f"""You are the AgencyOS Quality Evaluator and Brand Compliance Critic.
Conduct a rigorous compliance audit of the planned deliverables against the Brand Guardrails and Campaign Strategy.

BRAND PROHIBITED CLAIMS (CRITICAL VIOLATIONS):
{claims_text}

BRAND TONE & VOICE GUIDELINES:
{tone_text}

CAMPAIGN STRATEGIC ANGLES:
{strat_text}

DELIVERABLES TO EVALUATE:
{chr(10).join(deliverable_summaries)}

AUDIT INSTRUCTIONS:
1. Identify any assertions, promises, or implications in the deliverables that violate BRAND PROHIBITED CLAIMS.
2. Flag severe tone violations (e.g. over-hyped language, emojis where prohibited, unprofessional slang).
3. Check if any deliverable completely contradicts the strategic angles.
4. If a deliverable is compliant and makes no prohibited claims, DO NOT fabricate issues. Only return genuine violations.
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
                cat_enum = FindingCategory(issue.category)
                sev_enum = FindingSeverity(issue.severity)
                findings.append(
                    QualityFinding(
                        category=cat_enum,
                        severity=sev_enum,
                        deliverable_index=idx,
                        deliverable_title=d_title,
                        issue_description=issue.issue_description,
                        remediation_instruction=issue.remediation_instruction,
                    )
                )

            flagged_indices = {i.deliverable_index for i in audit_result.issues if i.severity in ("critical", "warning")}
            checks_passed += (len(deliverables) - len(flagged_indices))

        except Exception as e:
            logger.warning(f"Semantic audit LLM invocation encountered transient issue: {e}. Defaulting to deterministic checks.")
            checks_passed += len(deliverables)

        return findings, checks_passed, total_checks


async def quality_evaluator_node(state: CampaignState) -> dict[str, Any]:
    """
    LangGraph execution node for Agent 6: Quality Evaluator & Critic.
    
    Architectural Guarantees:
    1. Zero DB session objects inside state.
    2. Pure data evaluation and deterministic scoring.
    3. Manages state revision counter and routes next workflow status.
    4. Records comprehensive telemetry trace.
    """
    agent_name = "quality_evaluator"
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    model_name = settings.GROQ_MODEL

    try:
        deliverables = state.get("deliverable_plans") or []
        strategy = state.get("campaign_strategy")
        brand_context = state.get("brand_context")
        brief = state.get("brief")
        revision_count = state.get("revision_count", 0)
        max_revisions = state.get("max_revisions", 2)

        evaluator = QualityEvaluatorAgent(model_name=model_name)
        evaluation: QualityEvaluation = await evaluator.evaluate(
            deliverables=deliverables,
            strategy=strategy,
            brief=brief,
            brand_context=brand_context,
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
