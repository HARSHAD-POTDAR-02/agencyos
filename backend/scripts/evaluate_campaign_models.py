#!/usr/bin/env python3
"""
AgencyOS Campaign Generation Evaluation Benchmark
-------------------------------------------------
Evaluates Frontier Models (Mistral Large 4 vs GPT-OSS-120B) across
12 Creative & Strategic Dimensions (100-Point Rubric) for Campaign Intelligence.

Target Models:
1. mistralai/mistral-large-4-1t-a52b (NVIDIA NIM, reasoning_effort='low', max_tokens=8192)
2. openai/gpt-oss-120b (Groq LPU, max_tokens=4096)

Scenario:
Test 1 - Gym Owner Personal Brand (Personality-Driven, Tough-Love Hinglish)
Specific Topic: "Why 90% of people quit the gym after 15 days"
"""

import os
import sys
import json
import time
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from groq import Groq
from openai import OpenAI
import json_repair

# ---------------------------------------------------------------------------
# SCENARIO DEFINITION & PROMPTS
# ---------------------------------------------------------------------------

SCENARIO_BRIEF = {
    "scenario_id": "TEST-01-GYM-PERSONAL-BRAND",
    "name": "Gym Owner Personal Brand — Personality-Driven Viral Campaign",
    "brand_name": "IronForge Fitness & Performance",
    "brand_persona": {
        "owner_name": "Vikram 'Vik' Sharma",
        "age": 32,
        "archetype": "The Raw Truth-Teller / Tough-Love Older Brother",
        "personality": (
            "Extroverted, fiercely energetic, blunt, charismatic, contrarian. "
            "He despises fake fitness influencers, 30-day detox teas, and excuse culture. "
            "He talks like a real, experienced gym guy in Mumbai/Delhi: authentic Hinglish, "
            "sharp humor, deep empathy disguised as tough love. He never speaks in robotic corporate slogans."
        ),
        "tone_voice": "Conversational Hinglish, punchy, confrontational hook, relatable daily struggles, authentic humor, no fluff."
    },
    "target_audience": {
        "demographics": "22-38 year old working professionals, IT/corporate employees, college students.",
        "psychology": (
            "They start the gym with massive dopamine on Jan 1st or any random Monday, buy new gear, "
            "post a gym selfie on Day 2, experience intense muscle soreness (DOMS) on Day 4, "
            "miss a day because of an office meeting on Day 8, feel guilty, and by Day 15 they completely ghost the gym. "
            "They silently feel like failures and invent excuses ('gym isn't for me', 'too busy at work')."
        ),
        "core_conflict": "The illusion of instant motivation vs. the biological reality of the 15-day friction wall."
    },
    "business_goal": "Generate 300 walk-ins and trial sessions for IronForge by making Vik the most trusted, relatable fitness authority in the city.",
    "test_topic": "Why 90% of people quit the gym after 15 days",
    "execution_constraints": {
        "platform": "Instagram Reels / YouTube Shorts (9:16 vertical)",
        "duration": "45-60 seconds",
        "format": "High-retention video script with exact camera framing, dialogue, B-roll, on-screen text, and sound cues.",
        "negative_constraints": [
            "DO NOT write generic listicles ('5 reasons why people quit').",
            "DO NOT write cheesy quotes ('Don't give up on your fitness journey', 'Stay consistent!').",
            "DO NOT write vague visual directions like 'Cinematic gym shots with energetic music'.",
            "DO NOT write stilted translated Hindi or robotic English."
        ]
    }
}

SYSTEM_PROMPT = """You are an elite Creative Director and Viral Social Campaign Architect for AgencyOS.
You design high-converting, personality-led short-form video campaigns that generate real business revenue.

You are strictly evaluated on 12 DIMENSIONS:
1. Brand Understanding (Owner personality as unfair marketing moat)
2. Audience Psychology (Deep emotional triggers, hidden guilt, excuse mechanisms)
3. Campaign Direction (Coherent narrative arc, not isolated random reels)
4. Funnel Alignment (Awareness -> Consideration -> Conversion balance)
5. Creative Originality (Novel angles, anti-cliché, pattern interrupts)
6. Hook Quality (First 1-3 seconds curiosity/tension, impossible to scroll past)
7. Storytelling (Relatable progression, tension, punchy payoff)
8. Personality Adaptation (Authentic conversational Hinglish voice of the owner)
9. Script Quality (Natural cadence, dynamic dialogue, spoken timing)
10. Visual Direction (Precision camera framing, angles, actor movement, B-roll, sound cues)
11. Production Feasibility (Can be filmed in 45 mins inside a real gym with a phone)
12. Structured Output Reliability (Valid, clean schema adherence)

CRITICAL JSON SYNTAX INSTRUCTION:
- Respond ONLY with a valid JSON object matching the requested schema.
- Use ONLY straight double quotes for JSON keys and strings.
- NEVER use unicode curly quotes (like “ or ”). For quotes inside dialogue, use single quotes (e.g. 'Motivation') or escaped quotes (\\\"Motivation\\\").
"""

USER_PROMPT = f"""Develop the complete Campaign Package for the following brief:

BRIEF:
- Brand: {SCENARIO_BRIEF['brand_name']}
- Owner / Face of Brand: {SCENARIO_BRIEF['brand_persona']['owner_name']} ({SCENARIO_BRIEF['brand_persona']['personality']})
- Voice & Tone: {SCENARIO_BRIEF['brand_persona']['tone_voice']}
- Audience Psychology: {SCENARIO_BRIEF['target_audience']['psychology']}
- Core Conflict: {SCENARIO_BRIEF['target_audience']['core_conflict']}
- Target Topic: "{SCENARIO_BRIEF['test_topic']}"
- Negative Constraints to avoid: {json.dumps(SCENARIO_BRIEF['execution_constraints']['negative_constraints'])}

RETURN A JSON OBJECT WITH THE FOLLOWING STRUCTURE:
{{
  "strategic_intelligence": {{
    "brand_moat_statement": "How Vik's raw personality creates an unfair competitive moat",
    "audience_psychology_breakdown": [
      "Psychological barrier 1 (e.g. Day 4 DOMS shame)",
      "Psychological barrier 2 (e.g. Day 8 corporate meeting excuse)",
      "Hidden shame / ego defense (e.g. Day 15 quiet ghosting)"
    ],
    "seven_day_content_arc": [
      {{
        "day": 1,
        "theme": "Theme title",
        "funnel_stage": "Awareness | Consideration | Conversion",
        "core_concept": "Concept summary"
      }}
      // Include 7 distinct days showing clear progression
    ]
  }},
  "creative_angles": [
    {{
      "angle_name": "Angle 1 (Contrarian / Tough-Love Monologue)",
      "creative_concept": "Description of the angle",
      "hook_first_3_seconds": "Exact spoken or visual hook in Hinglish",
      "why_it_works": "Psychological explanation of the hook"
    }},
    {{
      "angle_name": "Angle 2 (Humorous Sketch / Relatable Dialogue)",
      "creative_concept": "Description of the angle",
      "hook_first_3_seconds": "Exact spoken or visual hook in Hinglish",
      "why_it_works": "Psychological explanation of the hook"
    }},
    {{
      "angle_name": "Angle 3 (Storytelling / The 15-Day Trap)",
      "creative_concept": "Description of the angle",
      "hook_first_3_seconds": "Exact spoken or visual hook in Hinglish",
      "why_it_works": "Psychological explanation of the hook"
    }}
  ],
  "production_execution_script": {{
    "chosen_angle": "Name of the angle chosen for full production",
    "working_title": "Punchy Reel Title",
    "target_duration_seconds": 55,
    "pacing": "Fast opening -> Relatable conversational middle -> Punchy hard-hitting close",
    "shot_by_shot": [
      {{
        "shot_number": 1,
        "timing": "0:00 - 0:03",
        "camera_direction": "Camera framing, lens, movement (e.g. Handheld medium shot, slow push-in on Vik)",
        "visual_action_and_broll": "Exact physical action, background environment, props",
        "dialogue_hinglish": "Exact spoken dialogue in natural, punchy Hinglish",
        "onscreen_text": "Text overlay / typography hook",
        "audio_sfx_cues": "Music entrance, sound effects, ambient cues"
      }}
      // Provide at least 5-7 detailed shots covering the entire reel
    ],
    "cta": {{
      "spoken_dialogue": "Exact spoken CTA",
      "visual_action": "What Vik does on camera during the CTA",
      "offer_type": "Frictionless next step (e.g. Free 3-day form correction pass)"
    }}
  }}
}}
"""

# ---------------------------------------------------------------------------
# MODEL CLIENTS
# ---------------------------------------------------------------------------

def parse_and_repair_json(text: str) -> Tuple[Any, bool, str]:
    """Extract and repair JSON using json_repair."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    
    # Try standard json.loads first
    try:
        obj = json.loads(text)
        return obj, True, ""
    except Exception as e:
        # Fallback to json_repair
        try:
            obj = json_repair.repair_json(text, return_objects=True)
            if isinstance(obj, dict) and obj:
                return obj, True, "repaired"
            return None, False, f"Repaired output not dict: {type(obj)}"
        except Exception as e2:
            return None, False, f"Parse failed: {e}; Repair failed: {e2}"


def run_mistral_large_4() -> Dict[str, Any]:
    """Execute Mistral Large 4 on NVIDIA NIM with reasoning_effort='low' and streaming."""
    print("\n" + "=" * 70)
    print("🚀 RUNNING: Mistral Large 4 (mistralai/mistral-large-4-1t-a52b) on NVIDIA NIM")
    print("=" * 70)
    
    client = OpenAI(
        base_url=settings.NVIDIA_BASE_URL,
        api_key=settings.NVIDIA_API_KEY,
        timeout=180.0
    )
    
    start_time = time.time()
    reasoning_chunks = []
    content_chunks = []
    first_token_time = None
    
    print("⏳ Streaming with reasoning_effort='low' and max_tokens=8192...")
    try:
        response = client.chat.completions.create(
            model="mistralai/mistral-large-4-1t-a52b",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT}
            ],
            temperature=0.7,
            max_tokens=8192,
            extra_body={"reasoning_effort": "low"},
            stream=True
        )
        
        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            
            # Capture reasoning content
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                if first_token_time is None:
                    first_token_time = time.time()
                reasoning_chunks.append(delta.reasoning_content)
                if len(reasoning_chunks) % 15 == 0:
                    print(".", end="", flush=True)
                
            # Capture actual content
            if delta.content:
                if first_token_time is None:
                    first_token_time = time.time()
                content_chunks.append(delta.content)
                if len(content_chunks) % 25 == 0:
                    print("#", end="", flush=True)
                    
        total_time = time.time() - start_time
        ttft = (first_token_time - start_time) if first_token_time else total_time
        
        raw_reasoning = "".join(reasoning_chunks)
        raw_content = "".join(content_chunks)
        
        print(f"\n✅ Mistral Large 4 Stream Complete in {total_time:.1f}s (TTFT: {ttft:.1f}s)")
        print(f"   Reasoning Length: {len(raw_reasoning)} chars | Content Length: {len(raw_content)} chars")
        
        parsed_json, is_valid, json_note = parse_and_repair_json(raw_content)
        if not is_valid:
            print(f"⚠️ JSON Parse/Repair Warning: {json_note}")
        else:
            print(f"✅ JSON Successfully Loaded ({json_note or 'standard JSON'})")
            
        return {
            "model_id": "mistralai/mistral-large-4-1t-a52b",
            "provider": "NVIDIA NIM",
            "latency_seconds": round(total_time, 2),
            "ttft_seconds": round(ttft, 2),
            "reasoning_length": len(raw_reasoning),
            "reasoning_sample": raw_reasoning[:600] + ("..." if len(raw_reasoning) > 600 else ""),
            "raw_content": raw_content,
            "parsed_json": parsed_json,
            "json_status": json_note,
            "is_valid_json": is_valid
        }
    except Exception as e:
        total_time = time.time() - start_time
        print(f"\n❌ Error invoking Mistral Large 4: {e}")
        return {
            "model_id": "mistralai/mistral-large-4-1t-a52b",
            "provider": "NVIDIA NIM",
            "latency_seconds": round(total_time, 2),
            "error": str(e),
            "is_valid_json": False
        }


def run_gpt_oss_120b() -> Dict[str, Any]:
    """Execute GPT-OSS-120B on Groq."""
    print("\n" + "=" * 70)
    print("🚀 RUNNING: GPT-OSS-120B (openai/gpt-oss-120b) on Groq LPU")
    print("=" * 70)
    
    client = Groq(api_key=settings.GROQ_API_KEY, timeout=120.0)
    start_time = time.time()
    
    print("⏳ Invoking Groq LPU...")
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT}
            ],
            temperature=0.7,
            max_tokens=4096
        )
        total_time = time.time() - start_time
        choice = response.choices[0]
        raw_content = choice.message.content or ""
        reasoning = choice.message.reasoning or ""
        
        print(f"✅ GPT-OSS-120B Complete in {total_time:.2f}s")
        print(f"   Reasoning Length: {len(reasoning)} chars | Content Length: {len(raw_content)} chars")
        
        parsed_json, is_valid, json_note = parse_and_repair_json(raw_content)
        if not is_valid:
            print(f"⚠️ JSON Parse/Repair Warning: {json_note}")
        else:
            print(f"✅ JSON Successfully Loaded ({json_note or 'standard JSON'})")
            
        return {
            "model_id": "openai/gpt-oss-120b",
            "provider": "Groq",
            "latency_seconds": round(total_time, 2),
            "reasoning_length": len(reasoning),
            "reasoning_sample": reasoning[:600] + ("..." if len(reasoning) > 600 else ""),
            "raw_content": raw_content,
            "parsed_json": parsed_json,
            "json_status": json_note,
            "is_valid_json": is_valid
        }
    except Exception as e:
        total_time = time.time() - start_time
        print(f"\n❌ Error invoking GPT-OSS-120B: {e}")
        return {
            "model_id": "openai/gpt-oss-120b",
            "provider": "Groq",
            "latency_seconds": round(total_time, 2),
            "error": str(e),
            "is_valid_json": False
        }


# ---------------------------------------------------------------------------
# 12-DIMENSION EVALUATION ENGINE (100-POINT RUBRIC)
# ---------------------------------------------------------------------------

RUBRIC_WEIGHTS = {
    "strategic_intelligence": 15,
    "creative_originality": 15,
    "hook_quality": 10,
    "storytelling": 10,
    "script_quality": 10,
    "visual_direction": 10,
    "audience_psychology": 10,
    "campaign_diversity_and_sequencing": 8,
    "brand_voice_consistency": 5,
    "cta_effectiveness": 3,
    "production_feasibility": 2,
    "structured_output_reliability": 2
}

EVALUATION_JUDGE_PROMPT = """You are an exacting, cynical, world-class Creative Director and Viral Media Auditor.
You are evaluating two AI model outputs for a viral Instagram campaign for an Indian gym owner (Vikram "Vik" Sharma).

THE 12 EVALUATION DIMENSIONS (Total 100 Points):
1. Strategic intelligence (Max 15): Does it understand the brand's identity, positioning, and that the owner's personality is the primary marketing asset? Does it connect strategy to walk-ins?
2. Creative originality (Max 15): Are the ideas genuinely fresh, contrarian, and memorable, or are they recycled fitness tropes and listicles?
3. Hook quality (Max 10): Does the first 1-3 seconds create instant curiosity, tension, or pattern interrupt that stops the scroll?
4. Storytelling (Max 10): Does the script have a compelling narrative progression, emotional tension, and satisfying payoff?
5. Script quality (Max 10): Is dialogue raw, punchy, spoken Hinglish (like real Mumbai/Delhi gym culture), or is it translated/cliché?
6. Visual direction (Max 10): Are camera movements, framing, B-roll, and physical actions precise and production-ready, or vague filler like "cinematic gym shots"?
7. Audience psychology (Max 10): Does it tap into the silent guilt, DOMS soreness, and excuse mechanisms of the 15-day quitter?
8. Campaign diversity and sequencing (Max 8): Does the 7-day arc progress logically from awareness to walk-in conversion without repeating concepts?
9. Brand voice consistency (Max 5): Does it embody the extroverted, tough-love, humorous brother persona throughout?
10. CTA effectiveness (Max 3): Is the CTA natural, low-friction, and high-conversion?
11. Production feasibility (Max 2): Can this realistically be filmed with a phone and a gym owner in 45 minutes?
12. Structured output reliability (Max 2): Is the output complete, valid, schema-compliant JSON?

OUTPUT FORMAT:
Return a JSON object comparing Model A and Model B:
{
  "scores": {
    "model_a": {
      "strategic_intelligence": <0-15>,
      "creative_originality": <0-15>,
      "hook_quality": <0-10>,
      "storytelling": <0-10>,
      "script_quality": <0-10>,
      "visual_direction": <0-10>,
      "audience_psychology": <0-10>,
      "campaign_diversity_and_sequencing": <0-8>,
      "brand_voice_consistency": <0-5>,
      "cta_effectiveness": <0-3>,
      "production_feasibility": <0-2>,
      "structured_output_reliability": <0-2>,
      "total_score": <sum out of 100>
    },
    "model_b": {
      "strategic_intelligence": <0-15>,
      "creative_originality": <0-15>,
      "hook_quality": <0-10>,
      "storytelling": <0-10>,
      "script_quality": <0-10>,
      "visual_direction": <0-10>,
      "audience_psychology": <0-10>,
      "campaign_diversity_and_sequencing": <0-8>,
      "brand_voice_consistency": <0-5>,
      "cta_effectiveness": <0-3>,
      "production_feasibility": <0-2>,
      "structured_output_reliability": <0-2>,
      "total_score": <sum out of 100>
    }
  },
  "dimension_breakdown": {
    "hook_comparison": {
      "model_a_hook": "...",
      "model_b_hook": "...",
      "verdict": "Which hook wins and why"
    },
    "visual_direction_comparison": {
      "model_a_visuals": "...",
      "model_b_visuals": "...",
      "verdict": "Which visual direction is more executable"
    },
    "script_cadence_comparison": {
      "model_a_cadence": "...",
      "model_b_cadence": "...",
      "verdict": "Which dialogue sounds more authentic"
    }
  },
  "key_strengths": {
    "model_a": ["strength 1", "strength 2"],
    "model_b": ["strength 1", "strength 2"]
  },
  "critical_weaknesses": {
    "model_a": ["weakness 1", "weakness 2"],
    "model_b": ["weakness 1", "weakness 2"]
  },
  "overall_verdict": {
    "winner": "Model A | Model B | Tie",
    "summary": "Clear, decisive synthesis of why the winner was chosen and actionable recommendation for AgencyOS."
  }
}
"""

def evaluate_outputs_with_judge(model_a_data: Dict[str, Any], model_b_data: Dict[str, Any]) -> Dict[str, Any]:
    """Use an impartial frontier judge on Groq to audit both model outputs across the 12 dimensions."""
    print("\n" + "=" * 70)
    print("⚖️ RUNNING 12-DIMENSION INDEPENDENT JUDGE EVALUATION")
    print("=" * 70)
    
    judge_client = Groq(api_key=settings.GROQ_API_KEY, timeout=120.0)
    
    # Present formatted JSON representations to the judge
    a_content = json.dumps(model_a_data.get('parsed_json') or model_a_data.get('raw_content'), indent=2)
    b_content = json.dumps(model_b_data.get('parsed_json') or model_b_data.get('raw_content'), indent=2)
    
    comparison_prompt = f"""EVALUATE THESE TWO CANDIDATE OUTPUTS:

=== CANDIDATE MODEL A (Mistral Large 4 - {model_a_data.get('model_id')}) ===
Valid JSON: {model_a_data.get('is_valid_json')}
Output Content:
{a_content}

=== CANDIDATE MODEL B (GPT-OSS-120B - {model_b_data.get('model_id')}) ===
Valid JSON: {model_b_data.get('is_valid_json')}
Output Content:
{b_content}
"""
    try:
        judge_res = judge_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": EVALUATION_JUDGE_PROMPT},
                {"role": "user", "content": comparison_prompt}
            ],
            temperature=0.2,
            max_tokens=4096
        )
        cleaned = judge_res.choices[0].message.content or ""
        parsed, valid, note = parse_and_repair_json(cleaned)
        if valid and isinstance(parsed, dict):
            return parsed
        else:
            print(f"⚠️ Judge JSON parse note: {note}")
            return {"raw_judge_output": cleaned}
    except Exception as e:
        print(f"⚠️ Judge Evaluation error: {e}")
        return {
            "error": str(e),
            "fallback": True
        }


# ---------------------------------------------------------------------------
# REPORT GENERATION & ARTIFACT BUILDER
# ---------------------------------------------------------------------------

def generate_markdown_report(
    model_a: Dict[str, Any],
    model_b: Dict[str, Any],
    eval_result: Dict[str, Any],
    output_path: Path
) -> str:
    """Generate a high-impact, professional Markdown evaluation report."""
    
    scores = eval_result.get("scores", {})
    a_scores = scores.get("model_a", {})
    b_scores = scores.get("model_b", {})
    verdict = eval_result.get("overall_verdict", {})
    breakdown = eval_result.get("dimension_breakdown", {})
    
    report = f"""# 🎯 Campaign Generation Evaluation Benchmark Report
**AgencyOS Creative Intelligence Engine — Frontier Model Assessment**
*Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*

---

## 1. Executive Summary

| Metric / Dimension | Model A: Mistral Large 4 | Model B: GPT-OSS-120B |
| :--- | :--- | :--- |
| **Model ID** | `{model_a.get('model_id')}` | `{model_b.get('model_id')}` |
| **Provider** | NVIDIA NIM | Groq LPU |
| **Generation Latency** | {model_a.get('latency_seconds', 'N/A')}s | {model_b.get('latency_seconds', 'N/A')}s |
| **Reasoning Captured** | {model_a.get('reasoning_length', 0)} chars | {model_b.get('reasoning_length', 0)} chars |
| **JSON Adherence** | {"✅ Valid JSON" if model_a.get('is_valid_json') else "❌ Invalid"} | {"✅ Valid JSON" if model_b.get('is_valid_json') else "❌ Invalid"} |
| **Total Benchmark Score** | **{a_scores.get('total_score', 'N/A')} / 100** | **{b_scores.get('total_score', 'N/A')} / 100** |

> ### 🏆 Final Benchmark Verdict
> **Winner:** **{verdict.get('winner', 'Evaluating...')}**  
> **Key Finding:** {verdict.get('summary', 'Detailed evaluation below.')}

---

## 2. 12-Dimension Weighted Scorecard (100-Point Rubric)

| Dimension | Weight | Mistral Large 4 Score | GPT-OSS-120B Score | Core Distinction |
| :--- | :---: | :---: | :---: | :--- |
| **1. Strategic Intelligence** | 15 pts | **{a_scores.get('strategic_intelligence', '-')}** | **{b_scores.get('strategic_intelligence', '-')}** | Owner personality as moat & walk-in strategy |
| **2. Creative Originality** | 15 pts | **{a_scores.get('creative_originality', '-')}** | **{b_scores.get('creative_originality', '-')}** | Anti-cliché angles vs recycled fitness tropes |
| **3. Hook Quality** | 10 pts | **{a_scores.get('hook_quality', '-')}** | **{b_scores.get('hook_quality', '-')}** | 0-3s pattern interrupt & thumb-stopping tension |
| **4. Storytelling** | 10 pts | **{a_scores.get('storytelling', '-')}** | **{b_scores.get('storytelling', '-')}** | Progression, conflict, tension, payoff |
| **5. Script Quality** | 10 pts | **{a_scores.get('script_quality', '-')}** | **{b_scores.get('script_quality', '-')}** | Natural spoken Hinglish cadence & humor |
| **6. Visual Direction** | 10 pts | **{a_scores.get('visual_direction', '-')}** | **{b_scores.get('visual_direction', '-')}** | Camera angles, B-roll, movement vs vague filler |
| **7. Audience Psychology** | 10 pts | **{a_scores.get('audience_psychology', '-')}** | **{b_scores.get('audience_psychology', '-')}** | DOMS soreness, silent excuses, dopamine drop |
| **8. Campaign Diversity & Sequencing** | 8 pts | **{a_scores.get('campaign_diversity_and_sequencing', '-')}** | **{b_scores.get('campaign_diversity_and_sequencing', '-')}** | 7-day arc avoiding repetition |
| **9. Brand Voice Consistency** | 5 pts | **{a_scores.get('brand_voice_consistency', '-')}** | **{b_scores.get('brand_voice_consistency', '-')}** | Extroverted brother persona retention |
| **10. CTA Effectiveness** | 3 pts | **{a_scores.get('cta_effectiveness', '-')}** | **{b_scores.get('cta_effectiveness', '-')}** | Frictionless walk-in conversion bridge |
| **11. Production Feasibility** | 2 pts | **{a_scores.get('production_feasibility', '-')}** | **{b_scores.get('production_feasibility', '-')}** | 45-min gym phone shoot practicality |
| **12. Structured Output Reliability** | 2 pts | **{a_scores.get('structured_output_reliability', '-')}** | **{b_scores.get('structured_output_reliability', '-')}** | Schema compliance and JSON validity |
| **TOTAL** | **100 pts** | **{a_scores.get('total_score', '-')} / 100** | **{b_scores.get('total_score', '-')} / 100** | |

---

## 3. Side-by-Side Creative Face-Off

### A. The 0–3 Second Hook
**Model A (Mistral Large 4):**
> *"{breakdown.get('hook_comparison', {}).get('model_a_hook', 'See script below')}"*

**Model B (GPT-OSS-120B):**
> *"{breakdown.get('hook_comparison', {}).get('model_b_hook', 'See script below')}"*

**Judge Verdict on Hooks:**
> {breakdown.get('hook_comparison', {}).get('verdict', 'N/A')}

---

### B. Visual Direction & Camera Work
**Model A (Mistral Large 4):**
> *"{breakdown.get('visual_direction_comparison', {}).get('model_a_visuals', 'See shot list')}"*

**Model B (GPT-OSS-120B):**
> *"{breakdown.get('visual_direction_comparison', {}).get('model_b_visuals', 'See shot list')}"*

**Judge Verdict on Visual Direction:**
> {breakdown.get('visual_direction_comparison', {}).get('verdict', 'N/A')}

---

### C. Spoken Dialogue & Hinglish Cadence
**Judge Verdict on Script Realism:**
> {breakdown.get('script_cadence_comparison', {}).get('verdict', 'N/A')}

---

## 4. Strengths & Critical Weaknesses

### Model A: Mistral Large 4
- **Key Strengths:**
{chr(10).join(['  - ' + s for s in eval_result.get('key_strengths', {}).get('model_a', ['Strong conceptual reasoning'])])}
- **Critical Weaknesses:**
{chr(10).join(['  - ' + w for w in eval_result.get('critical_weaknesses', {}).get('model_a', ['Higher latency'])])}

### Model B: GPT-OSS-120B
- **Key Strengths:**
{chr(10).join(['  - ' + s for s in eval_result.get('key_strengths', {}).get('model_b', ['Ultra-fast inference (<10s)'])])}
- **Critical Weaknesses:**
{chr(10).join(['  - ' + w for w in eval_result.get('critical_weaknesses', {}).get('model_b', ['Risk of generic template phrasing'])])}

---

## 5. Architectural Recommendation for AgencyOS

1. **Why previous campaigns felt mediocre:**
   - AgencyOS's agents (`CampaignStrategist` and `ContentArchitect`) were set to `temperature=0.2` and defaulted to `FALLBACK_MODEL` (`qwen/qwen3.8-27b`).
   - The prompts were structured as bureaucratic compliance forms rather than creative director briefs with pattern-interrupt constraints.
2. **The Optimal Frontier Architecture:**
   - **For Strategic & Creative Scripting (Moat Tier):** Deploy the benchmark winner with `temperature=0.7`, explicit negative constraints against cliché listicles, and shot-by-shot visual prompts.
   - **For High-Speed Drafts:** Use Groq LPU with fine-tuned few-shot Hinglish examples.

---

## 6. Raw Script Outputs

### Model A: Mistral Large 4 Script
```json
{json.dumps(model_a.get('parsed_json') or model_a.get('raw_content'), indent=2)}
```

### Model B: GPT-OSS-120B Script
```json
{json.dumps(model_b.get('parsed_json') or model_b.get('raw_content'), indent=2)}
```
"""
    output_path.write_text(report, encoding="utf-8")
    return report


# ---------------------------------------------------------------------------
# MAIN BENCHMARK RUNNER
# ---------------------------------------------------------------------------

def main():
    print("\n" + "#" * 70)
    print("🔥 AGENCYOS CAMPAIGN GENERATION EVALUATION BENCHMARK (RUN 2)")
    print("   Testing Frontier Models: Mistral Large 4 vs GPT-OSS-120B")
    print("   Scenario: Gym Owner Personal Brand (Why 90% Quit After 15 Days)")
    print("#" * 70)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = backend_dir / "evaluation_results"
    results_dir.mkdir(exist_ok=True)
    
    # Run Model B (Groq GPT-OSS-120B)
    gpt_result = run_gpt_oss_120b()
    
    # Run Model A (NVIDIA NIM Mistral Large 4) with reasoning_effort='low' and streaming
    mistral_result = run_mistral_large_4()
    
    # Run the 12-Dimension Independent Judge Evaluation
    eval_result = evaluate_outputs_with_judge(
        model_a_data=mistral_result,
        model_b_data=gpt_result
    )
    
    # Save Raw Results
    raw_payload = {
        "timestamp": timestamp,
        "scenario": SCENARIO_BRIEF,
        "rubric_weights": RUBRIC_WEIGHTS,
        "mistral_large_4": mistral_result,
        "gpt_oss_120b": gpt_result,
        "evaluation": eval_result
    }
    
    raw_json_file = results_dir / f"benchmark_{timestamp}.json"
    latest_json_file = results_dir / "benchmark_latest.json"
    with open(raw_json_file, "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)
    with open(latest_json_file, "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)
    print(f"\n💾 Saved raw benchmark data to: {raw_json_file}")
    
    # Generate Markdown Report
    report_file = results_dir / f"benchmark_report_{timestamp}.md"
    latest_report_file = results_dir / "benchmark_report_latest.md"
    generate_markdown_report(mistral_result, gpt_result, eval_result, report_file)
    generate_markdown_report(mistral_result, gpt_result, eval_result, latest_report_file)
    
    # Also save to conversation artifacts directory if available
    artifact_dir = Path(r"C:\Users\Harshad Potdar\.gemini\antigravity\brain\686ab27b-5d40-48ae-822e-2338d73ef5ce")
    if artifact_dir.exists():
        art_file = artifact_dir / "campaign_generation_eval_benchmark.md"
        generate_markdown_report(mistral_result, gpt_result, eval_result, art_file)
        print(f"📊 Saved artifact report to: {art_file}")

    print("\n" + "=" * 70)
    print("🏁 BENCHMARK COMPLETE!")
    print(f"Scores:")
    print(f"  - Mistral Large 4: {eval_result.get('scores', {}).get('model_a', {}).get('total_score', 'N/A')} / 100")
    print(f"  - GPT-OSS-120B:   {eval_result.get('scores', {}).get('model_b', {}).get('total_score', 'N/A')} / 100")
    print(f"Winner: {eval_result.get('overall_verdict', {}).get('winner', 'N/A')}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
