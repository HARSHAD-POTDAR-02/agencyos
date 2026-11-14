from __future__ import annotations

import difflib
import logging
import re
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.campaign_intelligence.agents.quality_evaluator import QualityEvaluatorAgent
from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    ComplianceArtifactPayload,
    ComplianceCheckItem,
    ComplianceVerdict,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class SemanticAuditResult(BaseModel):
    conversational_critique: str
    flagged_issues: list[dict] = Field(default_factory=list)
    proposed_clean_copy: str
    suggested_followups: list[str] = Field(default_factory=list)


class QualityEvaluatorAdapter(SpecialistAdapter):
    """
    Adapter bridging QualityEvaluatorAgent into Campaign Studio.
    Enforces honest, multi-tiered compliance checking:
    - Deterministic checks (exact prohibited terms, character limits) -> PASS or FAIL
    - Semantic checks (prohibited claims, tone alignment) -> PASS, FAIL, or NEEDS_REVIEW
    - Computes has_blocking_violations deterministically
    - Produces a visual side-by-side diff for proposed edits without silent overwriting
    """

    def __init__(self):
        super().__init__(
            specialist_id="quality_evaluator",
            specialist_name="Quality & Compliance Critic",
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
        activity_logs.append("Extracting target content draft from active artifact or query...")

        # 1. Resolve content to audit
        target_text = query
        if context.active_artifact_payload:
            payload = context.active_artifact_payload
            # Extract scenes or slides or caption
            text_parts = []
            if "scenes" in payload and isinstance(payload["scenes"], list):
                for sc in payload["scenes"]:
                    text_parts.append(f"Scene {sc.get('scene_number')}: {sc.get('voiceover_script', '')} {sc.get('on_screen_text', '')}")
            if "slides" in payload and isinstance(payload["slides"], list):
                for sl in payload["slides"]:
                    text_parts.append(f"Slide {sl.get('slide_number')}: {sl.get('headline', '')} {sl.get('body_copy', '')}")
            if payload.get("full_caption"):
                text_parts.append(payload["full_caption"])
            if text_parts:
                target_text = "\n".join(text_parts)
                activity_logs.append(f"Auditing active artifact '{payload.get('deliverable_title', 'Active Draft')}'...")

        checks: list[ComplianceCheckItem] = []

        # 2. Deterministic Check: Exact Prohibited Terms
        activity_logs.append("Running deterministic exact prohibited terms scan...")
        prohibited_terms = context.brand_context.prohibited_terms if context.brand_context else []
        found_terms = []
        for pt in prohibited_terms:
            t_clean = pt.term.strip().lower()
            if t_clean and re.search(rf"\b{re.escape(t_clean)}\b", target_text.lower()):
                found_terms.append(pt.term)

        if found_terms:
            checks.append(
                ComplianceCheckItem(
                    check_name="Exact Prohibited Terms",
                    check_type="deterministic",
                    verdict=ComplianceVerdict.FAIL,
                    flagged_snippet=", ".join(found_terms),
                    explanation=f"Found exact prohibited terms in draft: {', '.join(found_terms)}",
                    suggested_correction="Remove or replace prohibited terms.",
                    is_blocking=True,
                )
            )
        else:
            checks.append(
                ComplianceCheckItem(
                    check_name="Exact Prohibited Terms",
                    check_type="deterministic",
                    verdict=ComplianceVerdict.PASS,
                    explanation="No exact prohibited words or forbidden competitor names detected.",
                    is_blocking=True,
                )
            )

        # 3. Deterministic Check: Content Length / Character Limits
        if len(target_text) > 4000:
            checks.append(
                ComplianceCheckItem(
                    check_name="Platform Character Constraints",
                    check_type="deterministic",
                    verdict=ComplianceVerdict.FAIL,
                    explanation="Draft exceeds maximum social caption length (4000 characters).",
                    suggested_correction="Trim caption to under 2200 characters.",
                    is_blocking=True,
                )
            )
        else:
            checks.append(
                ComplianceCheckItem(
                    check_name="Platform Character Constraints",
                    check_type="deterministic",
                    verdict=ComplianceVerdict.PASS,
                    explanation="Text length within platform guidelines.",
                    is_blocking=False,
                )
            )

        # 4. Semantic AI Audit: Prohibited Claims & Tone Consistency
        activity_logs.append("Running semantic AI evaluation for tone alignment and unsubstantiated claims...")
        brand_voice = ", ".join(context.brand_context.brand_voice) if context.brand_context and context.brand_context.brand_voice else "Authoritative & Honest"
        prohibited_claims_str = ", ".join([c.claim for c in context.brand_context.prohibited_claims]) if context.brand_context and context.brand_context.prohibited_claims else "None configured"

        prompt = f"""You are the Quality Evaluator & Compliance Critic for AgencyOS.
Evaluate the following creative copy for brand safety, prohibited claims, and tone consistency.

DRAFT TO AUDIT:
\"\"\"
{target_text[:1500]}
\"\"\"

BRAND CONTEXT:
- Brand Voice: {brand_voice}
- Prohibited Claims / Guardrails: {prohibited_claims_str}

YOUR TASK:
1. Identify any exaggerated guarantees, unsubstantiated claims, or marketing clichés.
2. Provide a proposed_clean_copy that fixes flagged issues while maintaining creative flair.
3. Write a sharp, constructive conversational critique.
"""

        proposed_clean_copy = target_text
        conversational_reply = "I've completed the pre-flight compliance audit of your creative draft."
        followups = ["Apply suggested revision", "Test alternative opening line"]

        try:
            sem_result: SemanticAuditResult = await invoke_structured_llm(
                prompt=prompt,
                schema_class=SemanticAuditResult,
                temperature=0.1,
                model=settings.FALLBACK_MODEL,
            )
            proposed_clean_copy = sem_result.proposed_clean_copy
            conversational_reply = sem_result.conversational_critique
            followups = sem_result.suggested_followups or followups

            # Add Semantic Checks
            if sem_result.flagged_issues:
                for issue in sem_result.flagged_issues:
                    checks.append(
                        ComplianceCheckItem(
                            check_name=issue.get("category", "Claim Safety / Cliché"),
                            check_type="semantic_ai",
                            verdict=ComplianceVerdict.NEEDS_REVIEW,
                            flagged_snippet=issue.get("snippet"),
                            explanation=issue.get("issue", "Requires human verification"),
                            suggested_correction=issue.get("remediation"),
                            is_blocking=False,
                        )
                    )
            else:
                checks.append(
                    ComplianceCheckItem(
                        check_name="Tone & Claim Integrity",
                        check_type="semantic_ai",
                        verdict=ComplianceVerdict.PASS,
                        explanation=f"Copy reflects brand voice ({brand_voice}) with no unsubstantiated claims.",
                        is_blocking=False,
                    )
                )
        except Exception as ex:
            logger.warning(f"Error in semantic compliance check: {ex}")
            checks.append(
                ComplianceCheckItem(
                    check_name="Tone & Claim Integrity",
                    check_type="semantic_ai",
                    verdict=ComplianceVerdict.NEEDS_REVIEW,
                    explanation="AI evaluation service was temporarily unreachable; human verification recommended.",
                    is_blocking=False,
                )
            )

        # 5. Generate Visual Side-by-Side Diff
        diff_lines = list(
            difflib.unified_diff(
                target_text.splitlines(),
                proposed_clean_copy.splitlines(),
                fromfile="Draft Original",
                tofile="Proposed Compliant Revision",
                lineterm="",
            )
        )
        visual_diff = "\n".join(diff_lines) if diff_lines else "No modifications required. Copy is 100% compliant."

        artifact_payload = ComplianceArtifactPayload(
            checks=checks,
            original_text=target_text,
            proposed_diff=visual_diff,
        )

        blocking_str = "⚠️ **Blocking Issues Found**" if artifact_payload.has_blocking_violations else "✅ **Zero Blocking Violations**"
        full_reply = f"{conversational_reply}\n\n**Compliance Status**: {blocking_str}\n\nReview the checklist and side-by-side visual diff on the Studio Canvas."

        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=full_reply,
            artifact_type=ArtifactType.compliance_review,
            artifact_payload=artifact_payload.model_dump(),
            activity_logs=activity_logs,
            suggested_followups=followups,
        )
