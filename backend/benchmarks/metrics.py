"""
AgencyOS Benchmark Metrics & Evaluation Rubric
----------------------------------------------
Implements the objective scoring rubric and factual integrity checks
for comparing campaign generations across models and agent versions.
"""

from typing import Dict, Any, List
from pydantic import BaseModel, Field

class BenchmarkScorecard(BaseModel):
    """
    Standardized evaluation scorecard across 7 core dimensions:
    Scores range from 1 (poor/failing) to 5 (world-class agency quality).
    """
    creative_quality: float = Field(ge=1.0, le=5.0, description="Originality, narrative hook tension, absence of formulaic tropes")
    specificity: float = Field(ge=1.0, le=5.0, description="How deeply content reflects THIS specific client vs generic industry filler")
    accuracy_and_factuality: float = Field(ge=1.0, le=5.0, description="Strict adherence to verified facts; zero invented claims or fake stats")
    production_readiness: float = Field(ge=1.0, le=5.0, description="Completeness of camera framing, action, dialogue, B-roll, audio cues")
    repetition_and_cliche_index: float = Field(ge=1.0, le=5.0, description="Absence of repetitive arguments or tired marketing clichés")
    brand_voice_alignment: float = Field(ge=1.0, le=5.0, description="Faithful adaptation to the client's distinct persona and dialect")
    cta_effectiveness: float = Field(ge=1.0, le=5.0, description="Frictionless next step matching the verified business offer")

    # Composite / Weighted Score out of 100
    total_weighted_score: float = Field(ge=0.0, le=100.0, description="Composite score out of 100")
    
    # Factual Integrity Audit
    hallucinated_facts: List[str] = Field(default_factory=list, description="Any invented statistics, offers, or fake customer stories")
    cliche_flags: List[str] = Field(default_factory=list, description="Any detected marketing clichés or banned phrases")
    
    # Qualitative Audit
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    evaluator_verdict: str = Field(default="")

    @classmethod
    def calculate_total_weighted(
        cls,
        creative: float,
        specificity: float,
        accuracy: float,
        production: float,
        repetition: float,
        voice: float,
        cta: float
    ) -> float:
        """
        Weights (Sum to 100):
        - Creative Quality: 25% (max 25)
        - Specificity: 20% (max 20)
        - Accuracy & Factuality: 20% (max 20)
        - Production Readiness: 15% (max 15)
        - Repetition / Cliché: 10% (max 10)
        - Brand Voice: 5% (max 5)
        - CTA Effectiveness: 5% (max 5)
        """
        w_score = (
            (creative / 5.0) * 25.0 +
            (specificity / 5.0) * 20.0 +
            (accuracy / 5.0) * 20.0 +
            (production / 5.0) * 15.0 +
            (repetition / 5.0) * 10.0 +
            (voice / 5.0) * 5.0 +
            (cta / 5.0) * 5.0
        )
        return round(w_score, 1)

EVALUATION_INSTRUCTIONS = """You are an exacting, skeptical Creative Director and Advertising Compliance Auditor.
You evaluate marketing campaign outputs against rigorous professional agency standards.

EVALUATION RUBRIC (Score 1.0 to 5.0 for each):

1. Creative Quality (1.0 to 5.0):
   - 1.0: Cliché listicles, generic slogans ('Believe in yourself', 'Glow like a queen').
   - 3.0: Competent but predictable marketing copy.
   - 5.0: Genuinely fresh, thumb-stopping narrative hook, tension, and memorable payoff.

2. Specificity (1.0 to 5.0):
   - 1.0: Could be swapped with any competitor with zero edits.
   - 3.0: Mentions the brand name, but reasoning remains generic.
   - 5.0: Irreplaceably tied to this exact founder, proprietary process, or client challenge.

3. Accuracy & Factuality (1.0 to 5.0):
   - 1.0: Blatantly fabricates statistics, unapproved discounts, or medical claims.
   - 3.0: Sticks mostly to facts, but invents small unsubstantiated details for drama.
   - 5.0: Strictly respects verified facts; zero unapproved offers or hallucinated data.

4. Production Readiness (1.0 to 5.0):
   - 1.0: Vague directions ('Cinematic shots with nice music').
   - 3.0: Has basic scene descriptions, but leaves camera movement and B-roll to guesswork.
   - 5.0: Production-ready storyboard with exact camera movement, physical action, dialogue, B-roll, on-screen text, and audio cues.

5. Repetition & Cliché Index (1.0 to 5.0):
   - 1.0: Filled with overused tropes ('Are you struggling to...', 'Wait till the end').
   - 3.0: Standard marketing cadence.
   - 5.0: Zero cliché phrases; clean, distinctive pacing.

6. Brand Voice Alignment (1.0 to 5.0):
   - 1.0: Sounds like a standard AI assistant.
   - 5.0: Fully embodies the specific client persona (e.g. calm clinical biochemist vs street-smart gym bro vs soft-spoken biomechanic).

7. CTA Effectiveness (1.0 to 5.0):
   - 1.0: High-friction, vague, or invented offer.
   - 5.0: Low-friction, natural bridge directly tied to the client's verified offer.

CRITICAL INSTRUCTION:
Identify any hallucinated facts or unapproved claims in the 'hallucinated_facts' list.
Respond ONLY with a valid JSON object matching the requested schema.
"""
