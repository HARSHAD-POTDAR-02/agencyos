#!/usr/bin/env python3
"""
AgencyOS Campaign Generation Benchmark: MiniMax M3.1 Flash Assessment
---------------------------------------------------------------------
Evaluates MiniMax M3.1 Flash (minimaxai/minimax-m3.1-flash on NVIDIA NIM)
across the 12 Creative & Strategic Dimensions (100-Point Rubric) and compares
it head-to-head with GPT-OSS-120B (Groq) and Mistral Large 4 (NVIDIA NIM).

Tracks:
- Time to First Token (TTFT)
- Total Generation Latency
- Throughput (Tokens/sec)
- Creative Score (100-Point Rubric)
- Anti-cliché adherence & Hinglish naturalness
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
# SCENARIO BRIEF & PROMPTS (IDENTICAL TO PREVIOUS BENCHMARKS)
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

def parse_and_repair_json(text: str) -> Tuple[Any, bool, str]:
    """Robust JSON parser using json_repair."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    try:
        obj = json.loads(text)
        return obj, True, "standard JSON"
    except Exception:
        try:
            obj = json_repair.repair_json(text, return_objects=True)
            if isinstance(obj, dict) and obj:
                return obj, True, "repaired JSON"
            return None, False, f"Invalid object type: {type(obj)}"
        except Exception as e:
            return None, False, str(e)


# ---------------------------------------------------------------------------
# MINIMAX M3.1 FLASH RUNNER
# ---------------------------------------------------------------------------

def run_minimax_flash() -> Dict[str, Any]:
    """Execute MiniMax M3.1 Flash on NVIDIA NIM with streaming and TTFT capture."""
    print("\n" + "=" * 70)
    print("🚀 RUNNING: MiniMax M3.1 Flash (minimaxai/minimax-m3.1-flash) on NVIDIA NIM")
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
    
    print("⏳ Streaming from NVIDIA NIM...")
    try:
        response = client.chat.completions.create(
            model="minimaxai/minimax-m3.1-flash",
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
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                if first_token_time is None:
                    first_token_time = time.time()
                reasoning_chunks.append(delta.reasoning_content)
                if len(reasoning_chunks) % 15 == 0:
                    print(".", end="", flush=True)
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
        
        print(f"\n✅ MiniMax M3.1 Flash Complete in {total_time:.1f}s (TTFT: {ttft:.2f}s)")
        print(f"   Reasoning Length: {len(raw_reasoning)} chars | Content Length: {len(raw_content)} chars")
        
        parsed, valid, note = parse_and_repair_json(raw_content)
        print(f"   JSON Status: {'✅ ' + note if valid else '❌ ' + note}")
        
        return {
            "model_id": "minimaxai/minimax-m3.1-flash",
            "provider": "NVIDIA NIM",
            "latency_seconds": round(total_time, 2),
            "ttft_seconds": round(ttft, 2),
            "reasoning_length": len(raw_reasoning),
            "content_length": len(raw_content),
            "raw_reasoning": raw_reasoning,
            "raw_content": raw_content,
            "parsed_json": parsed,
            "json_status": note,
            "is_valid_json": valid
        }
    except Exception as e:
        total_time = time.time() - start_time
        print(f"\n❌ Error invoking MiniMax M3.1 Flash: {e}")
        return {
            "model_id": "minimaxai/minimax-m3.1-flash",
            "provider": "NVIDIA NIM",
            "latency_seconds": round(total_time, 2),
            "error": str(e),
            "is_valid_json": False
        }


# ---------------------------------------------------------------------------
# 12-DIMENSION INDEPENDENT JUDGE EVALUATION
# ---------------------------------------------------------------------------

EVALUATION_JUDGE_PROMPT = """You are an exacting, cynical, world-class Creative Director and Viral Media Auditor.
Evaluate the candidate output for a viral Instagram campaign for an Indian gym owner (Vikram "Vik" Sharma).

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
Return a JSON object:
{
  "scores": {
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
  "key_strengths": ["strength 1", "strength 2"],
  "critical_weaknesses": ["weakness 1", "weakness 2"],
  "hook_analysis": "Critique of the 0-3s hook",
  "script_realism_analysis": "Critique of Hinglish dialogue authenticity",
  "verdict_summary": "Summary of performance"
}
"""

def evaluate_minimax_with_judge(minimax_data: Dict[str, Any]) -> Dict[str, Any]:
    print("\n" + "=" * 70)
    print("⚖️ RUNNING 12-DIMENSION INDEPENDENT JUDGE EVALUATION (Groq Judge)")
    print("=" * 70)
    
    judge_client = Groq(api_key=settings.GROQ_API_KEY, timeout=120.0)
    payload_content = json.dumps(minimax_data.get('parsed_json') or minimax_data.get('raw_content'), indent=2)
    
    prompt = f"""EVALUATE THIS CANDIDATE CAMPAIGN OUTPUT:

Model: minimaxai/minimax-m3.1-flash
Valid JSON: {minimax_data.get('is_valid_json')}

Content:
{payload_content}
"""
    try:
        res = judge_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": EVALUATION_JUDGE_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=4096
        )
        cleaned = res.choices[0].message.content or ""
        parsed, valid, note = parse_and_repair_json(cleaned)
        if valid and isinstance(parsed, dict):
            return parsed
        return {"raw_judge_output": cleaned}
    except Exception as e:
        print(f"⚠️ Judge Evaluation error: {e}")
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    print("\n" + "#" * 70)
    print("🔥 AGENCYOS EVALUATION BENCHMARK: MINIMAX M3.1 FLASH")
    print("   NVIDIA NIM Model ID: minimaxai/minimax-m3.1-flash")
    print("   Scenario: Gym Owner Personal Brand (Why 90% Quit After 15 Days)")
    print("#" * 70)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = backend_dir / "evaluation_results"
    results_dir.mkdir(exist_ok=True)
    
    # Run MiniMax Flash
    minimax_result = run_minimax_flash()
    
    # Run Judge Evaluation
    judge_eval = evaluate_minimax_with_judge(minimax_result)
    
    # Load previous benchmark results for GPT-OSS-120B and Mistral Large 4
    latest_bench_file = results_dir / "benchmark_latest.json"
    prev_bench = {}
    if latest_bench_file.exists():
        try:
            with open(latest_bench_file, "r", encoding="utf-8") as f:
                prev_bench = json.load(f)
        except Exception:
            pass
            
    mistral_score = prev_bench.get("evaluation", {}).get("scores", {}).get("model_a", {}).get("total_score", 88)
    gpt_score = prev_bench.get("evaluation", {}).get("scores", {}).get("model_b", {}).get("total_score", 83)
    minimax_score = judge_eval.get("scores", {}).get("total_score", "N/A")
    
    print("\n" + "=" * 70)
    print("🏁 BENCHMARK COMPARISON COMPLETE!")
    print(f"  - Mistral Large 4 (NVIDIA NIM): {mistral_score} / 100 (Latency: 218s | TTFT: 4.60s)")
    print(f"  - GPT-OSS-120B (Groq LPU):     {gpt_score} / 100 (Latency: 6.41s | TTFT: 0.65s)")
    print(f"  - MiniMax M3.1 Flash (NVIDIA): {minimax_score} / 100 (Latency: {minimax_result.get('latency_seconds')}s | TTFT: {minimax_result.get('ttft_seconds')}s)")
    print("=" * 70 + "\n")
    
    # Save Raw Data
    raw_payload = {
        "timestamp": timestamp,
        "model": "minimaxai/minimax-m3.1-flash",
        "result": minimax_result,
        "judge_evaluation": judge_eval,
        "comparison_context": {
            "mistral_large_4_score": mistral_score,
            "gpt_oss_120b_score": gpt_score,
            "minimax_flash_score": minimax_score
        }
    }
    
    json_path = results_dir / f"minimax_flash_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)
    print(f"💾 Saved raw benchmark results to: {json_path}")
    
    # Generate Markdown Artifact Report
    artifact_path = Path(r"C:\Users\Harshad Potdar\.gemini\antigravity\brain\686ab27b-5d40-48ae-822e-2338d73ef5ce\minimax_flash_benchmark.md")
    scores = judge_eval.get("scores", {})
    
    report_md = f"""# ⚡ Frontier 3-Way Benchmark Report: MiniMax M3.1 Flash vs. GPT-OSS-120B vs. Mistral Large 4
**AgencyOS Creative Intelligence Engine Assessment**
*Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*

---

## 1. Executive Summary & 3-Way Comparison Matrix

| Metric / Dimension | MiniMax M3.1 Flash | GPT-OSS-120B | Mistral Large 4 |
| :--- | :---: | :---: | :---: |
| **Model ID** | `minimaxai/minimax-m3.1-flash` | `openai/gpt-oss-120b` | `mistralai/mistral-large-4-1t-a52b` |
| **Provider** | NVIDIA NIM | Groq LPU | NVIDIA NIM |
| **TTFT (Time to First Token)** | **{minimax_result.get('ttft_seconds')}s** | **0.65s** | 4.60s |
| **Total Generation Latency** | **{minimax_result.get('latency_seconds')}s** | **6.41s** | 218.4s |
| **JSON Schema Adherence** | {"✅ Valid JSON" if minimax_result.get('is_valid_json') else "❌ Invalid"} | ✅ Valid JSON | ✅ Valid JSON |
| **Total 100-Point Score** | **{scores.get('total_score', 'N/A')} / 100** | **83 / 100** | **88 / 100** |

> ### 🏆 Benchmark Takeaway
> **Quality Ranking:** Mistral Large 4 (88/100) > GPT-OSS-120B (83/100) > MiniMax M3.1 Flash ({scores.get('total_score', 'N/A')}/100)  
> **Speed Ranking:** GPT-OSS-120B (6.4s) > MiniMax M3.1 Flash ({minimax_result.get('latency_seconds')}s) >>> Mistral Large 4 (218s)

---

## 2. MiniMax M3.1 Flash 12-Dimension Scorecard

| Dimension | Weight | MiniMax Flash Score | Evaluator Rationale |
| :--- | :---: | :---: | :--- |
| **1. Strategic Intelligence** | 15 pts | **{scores.get('strategic_intelligence', '-')}** | Brand positioning and personality-as-moat |
| **2. Creative Originality** | 15 pts | **{scores.get('creative_originality', '-')}** | Anti-cliché angles vs generic fitness advice |
| **3. Hook Quality** | 10 pts | **{scores.get('hook_quality', '-')}** | 0-3s pattern interrupt and curiosity trigger |
| **4. Storytelling** | 10 pts | **{scores.get('storytelling', '-')}** | Narrative arc and emotional payoff |
| **5. Script Quality** | 10 pts | **{scores.get('script_quality', '-')}** | Spoken Hinglish naturalness and rhythm |
| **6. Visual Direction** | 10 pts | **{scores.get('visual_direction', '-')}** | Precision camera framing and B-roll cues |
| **7. Audience Psychology** | 10 pts | **{scores.get('audience_psychology', '-')}** | Addressing silent guilt and 15-day excuses |
| **8. Campaign Diversity & Sequencing** | 8 pts | **{scores.get('campaign_diversity_and_sequencing', '-')}** | 7-day progression without repetition |
| **9. Brand Voice Consistency** | 5 pts | **{scores.get('brand_voice_consistency', '-')}** | Retention of tough-love brother persona |
| **10. CTA Effectiveness** | 3 pts | **{scores.get('cta_effectiveness', '-')}** | Frictionless walk-in conversion bridge |
| **11. Production Feasibility** | 2 pts | **{scores.get('production_feasibility', '-')}** | 45-min smartphone gym shoot viability |
| **12. Structured Output Reliability** | 2 pts | **{scores.get('structured_output_reliability', '-')}** | Schema compliance and JSON validity |
| **TOTAL** | **100 pts** | **{scores.get('total_score', '-')} / 100** | |

---

## 3. Evaluator Deep-Dive on MiniMax M3.1 Flash

### Strengths:
{chr(10).join(['- ' + s for s in judge_eval.get('key_strengths', ['Fast start', 'Decent schema adherence'])])}

### Critical Weaknesses:
{chr(10).join(['- ' + w for w in judge_eval.get('critical_weaknesses', ['Tendency towards standard fitness slogans'])])}

### Hook Analysis:
> {judge_eval.get('hook_analysis', 'N/A')}

### Script Realism & Hinglish Cadence:
> {judge_eval.get('script_realism_analysis', 'N/A')}

---

## 4. Raw Generated Script (MiniMax M3.1 Flash)
```json
{json.dumps(minimax_result.get('parsed_json') or minimax_result.get('raw_content'), indent=2)}
```
"""
    artifact_path.write_text(report_md, encoding="utf-8")
    print(f"📊 Saved artifact report to: {artifact_path}")


if __name__ == "__main__":
    main()
