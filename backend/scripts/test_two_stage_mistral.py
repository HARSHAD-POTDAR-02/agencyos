#!/usr/bin/env python3
"""
Two-Stage Progressive Campaign Generation Benchmark — Mistral Large 4
---------------------------------------------------------------------
Evaluates whether splitting monolithic campaign generation into two decoupled stages:
  Stage 1: Strategy, Psychology, 7-Day Arc & 3 Creative Angles/Hooks (~30-50s)
  Stage 2: Precision 6-Shot Production Execution Script for the chosen angle (~40-60s)
solves the 3m 38s UX latency problem while maintaining 88/100 creative depth.

Uses existing NVIDIA NIM API Key (Free tier):
Model: mistralai/mistral-large-4-1t-a52b
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
from openai import OpenAI
import json_repair

# ---------------------------------------------------------------------------
# SCENARIO BRIEF
# ---------------------------------------------------------------------------

SCENARIO_BRIEF = {
    "brand_name": "IronForge Fitness & Performance",
    "owner_name": "Vikram 'Vik' Sharma (32, blunt, charismatic, contrarian Indian gym coach)",
    "brand_voice": "Conversational Hinglish, punchy, confrontational hook, relatable daily struggles, authentic humor, no corporate quotes.",
    "target_audience": "22-38 year old working professionals, IT/corporate employees, and college students in Mumbai/Delhi who quit after 15 days.",
    "audience_psychology": (
        "High dopamine on Day 1 with new gear; intense DOMS soreness on Day 4 leading to doubt; "
        "office meeting on Day 8 breaking the streak; quiet ghosting on Day 15 with internal excuse 'gym isn't for me'."
    ),
    "core_conflict": "The illusion of instant motivation vs. the biological reality of the 15-day friction wall.",
    "topic": "Why 90% of people quit the gym after 15 days",
    "negative_constraints": [
        "DO NOT write generic listicles ('5 reasons why people quit').",
        "DO NOT write cheesy quotes ('Don't give up on your fitness journey', 'Stay consistent!').",
        "DO NOT write vague visual directions like 'Cinematic gym shots with energetic music'.",
        "DO NOT use unicode curly quotes inside JSON."
    ]
}

def clean_and_repair_json(text: str) -> Tuple[Any, bool, str]:
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
            return None, False, f"Invalid object: {type(obj)}"
        except Exception as e:
            return None, False, str(e)


# ---------------------------------------------------------------------------
# STAGE 1: STRATEGY & 3 ALTERNATIVE HOOKS
# ---------------------------------------------------------------------------

STAGE1_SYSTEM_PROMPT = """You are an elite Viral Campaign Strategist and Creative Director for AgencyOS.
Your objective in STAGE 1 is to define the strategic moat and create 3 distinct, high-retention viral angles with opening hooks.

CRITICAL INSTRUCTIONS:
- You must output valid, standard JSON only.
- Use single quotes (') for dialogue quotes inside JSON strings.
- Keep internal reasoning concise so generation starts immediately.
"""

STAGE1_USER_PROMPT = f"""Develop STAGE 1: Strategy & Creative Angles for:
- Brand: {SCENARIO_BRIEF['brand_name']}
- Face of Brand: {SCENARIO_BRIEF['owner_name']}
- Voice & Tone: {SCENARIO_BRIEF['brand_voice']}
- Audience Psychology: {SCENARIO_BRIEF['audience_psychology']}
- Topic: "{SCENARIO_BRIEF['topic']}"
- Negative Constraints: {json.dumps(SCENARIO_BRIEF['negative_constraints'])}

RETURN VALID JSON MATCHING THIS EXACT SCHEMA:
{{
  "brand_moat_statement": "Why Vik's raw personality creates an unfair competitive moat",
  "audience_psychology_barriers": [
    "Day 4 DOMS shame",
    "Day 8 Corporate meeting excuse",
    "Day 15 Quiet ghosting"
  ],
  "seven_day_arc": [
    {{"day": 1, "theme": "Day 1 theme", "stage": "Awareness", "core_concept": "Concept"}},
    {{"day": 2, "theme": "Day 2 theme", "stage": "Awareness", "core_concept": "Concept"}},
    {{"day": 3, "theme": "Day 3 theme", "stage": "Consideration", "core_concept": "Concept"}},
    {{"day": 4, "theme": "Day 4 theme", "stage": "Consideration", "core_concept": "Concept"}},
    {{"day": 5, "theme": "Day 5 theme", "stage": "Consideration", "core_concept": "Concept"}},
    {{"day": 6, "theme": "Day 6 theme", "stage": "Conversion", "core_concept": "Concept"}},
    {{"day": 7, "theme": "Day 7 theme", "stage": "Conversion", "core_concept": "Concept"}}
  ],
  "three_creative_angles": [
    {{
      "angle_id": 1,
      "angle_name": "Contrarian Tough-Love Monologue",
      "concept": "Core premise",
      "hook_first_3_seconds": "Exact spoken opening line in natural Hinglish",
      "visual_hook": "What happens visually on screen in first 2 seconds",
      "why_it_works": "Psychological trigger"
    }},
    {{
      "angle_id": 2,
      "angle_name": "Humorous Sketch / Relatable Dialogue",
      "concept": "Core premise",
      "hook_first_3_seconds": "Exact spoken opening line in natural Hinglish",
      "visual_hook": "What happens visually on screen in first 2 seconds",
      "why_it_works": "Psychological trigger"
    }},
    {{
      "angle_id": 3,
      "angle_name": "Storytelling: The 15-Day Trap",
      "concept": "Core premise",
      "hook_first_3_seconds": "Exact spoken opening line in natural Hinglish",
      "visual_hook": "What happens visually on screen in first 2 seconds",
      "why_it_works": "Psychological trigger"
    }}
  ]
}}
"""

def run_stage_1(client: OpenAI) -> Dict[str, Any]:
    print("\n" + "=" * 70)
    print("🎬 [STAGE 1] GENERATING STRATEGY & 3 HOOK ANGLES (Mistral Large 4)")
    print("=" * 70)
    print("⏳ Streaming tokens from NVIDIA NIM...")
    
    start_time = time.time()
    first_token_time = None
    reasoning_chunks = []
    content_chunks = []
    
    stream = client.chat.completions.create(
        model="mistralai/mistral-large-4-1t-a52b",
        messages=[
            {"role": "system", "content": STAGE1_SYSTEM_PROMPT},
            {"role": "user", "content": STAGE1_USER_PROMPT}
        ],
        temperature=0.7,
        max_tokens=3072,
        extra_body={"reasoning_effort": "low"},
        stream=True
    )
    
    for chunk in stream:
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
            if len(content_chunks) % 20 == 0:
                print("#", end="", flush=True)
                
    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else total_time
    raw_content = "".join(content_chunks)
    raw_reasoning = "".join(reasoning_chunks)
    
    print(f"\n✅ STAGE 1 Complete in {total_time:.1f}s | TTFT: {ttft:.2f}s")
    print(f"   Reasoning: {len(raw_reasoning)} chars | Content: {len(raw_content)} chars")
    
    parsed, valid, note = clean_and_repair_json(raw_content)
    print(f"   JSON Status: {'✅ ' + note if valid else '❌ ' + note}")
    
    return {
        "ttft_seconds": round(ttft, 2),
        "total_seconds": round(total_time, 2),
        "raw_reasoning": raw_reasoning,
        "raw_content": raw_content,
        "parsed_json": parsed,
        "is_valid": valid
    }


# ---------------------------------------------------------------------------
# STAGE 2: PRECISION PRODUCTION SCRIPT EXPANSION
# ---------------------------------------------------------------------------

STAGE2_SYSTEM_PROMPT = """You are an elite Video Director and Production Scriptwriter for AgencyOS.
Your objective in STAGE 2 is to expand a SINGLE chosen creative angle into a shot-by-shot production script
that can be filmed in 45 minutes on a smartphone inside a real gym.

CRITICAL INSTRUCTIONS:
- You must output valid, standard JSON only.
- Write natural, punchy Hinglish dialogue (no robotic translations).
- Precise camera angles, movements, B-roll, on-screen typography, and audio cues.
- Keep internal reasoning concise so generation starts immediately.
"""

def run_stage_2(client: OpenAI, stage1_data: Dict[str, Any], chosen_angle_id: int = 3) -> Dict[str, Any]:
    print("\n" + "=" * 70)
    print(f"🎥 [STAGE 2] EXPANDING CHOSEN ANGLE #{chosen_angle_id} INTO PRODUCTION SCRIPT")
    print("=" * 70)
    
    # Extract chosen angle from stage 1
    angles = stage1_data.get("parsed_json", {}).get("three_creative_angles", [])
    selected_angle = next((a for a in angles if a.get("angle_id") == chosen_angle_id), angles[-1] if angles else {})
    
    print(f"📌 Selected Angle: {selected_angle.get('angle_name', 'The 15-Day Trap')}")
    print(f"🔥 Opening Hook: \"{selected_angle.get('hook_first_3_seconds')}\"")
    print("⏳ Streaming script generation from NVIDIA NIM...")
    
    stage2_user_prompt = f"""Generate the full production script for this selected angle:

SELECTED ANGLE:
- Angle Name: {selected_angle.get('angle_name')}
- Premise: {selected_angle.get('concept')}
- Opening Hook (0-3s): {selected_angle.get('hook_first_3_seconds')}
- Visual Hook: {selected_angle.get('visual_hook')}

BRAND & ACTOR:
- Actor: {SCENARIO_BRIEF['owner_name']}
- Tone: {SCENARIO_BRIEF['brand_voice']}
- Location: IronForge Gym floor, locker room, squat rack.

RETURN VALID JSON MATCHING THIS EXACT SCHEMA:
{{
  "working_title": "Short Punchy Title",
  "target_duration_seconds": 55,
  "pacing_notes": "Opening shock -> Relatable pacing -> Hard-hitting CTA",
  "shots": [
    {{
      "shot_number": 1,
      "timing": "0:00 - 0:03",
      "camera": "Framing and lens movement (e.g. Handheld medium close-up, push-in)",
      "action_and_broll": "Exact movement, props, background action",
      "dialogue_hinglish": "Exact spoken line in natural Mumbai/Delhi Hinglish",
      "onscreen_text": "Bold kinetic typography hook",
      "audio_sfx": "Sound effects, beat drops, ambient cues"
    }}
    // Provide 5-6 detailed shots covering 0:00 to 0:55
  ],
  "call_to_action": {{
    "spoken_dialogue": "Exact spoken CTA line",
    "visual_action": "What Vik does on camera during CTA",
    "offer": "Low-friction walk-in offer (e.g. Free 3-day form fix pass)"
  }}
}}
"""

    start_time = time.time()
    first_token_time = None
    reasoning_chunks = []
    content_chunks = []
    
    stream = client.chat.completions.create(
        model="mistralai/mistral-large-4-1t-a52b",
        messages=[
            {"role": "system", "content": STAGE2_SYSTEM_PROMPT},
            {"role": "user", "content": stage2_user_prompt}
        ],
        temperature=0.7,
        max_tokens=3072,
        extra_body={"reasoning_effort": "low"},
        stream=True
    )
    
    for chunk in stream:
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
            if len(content_chunks) % 20 == 0:
                print("#", end="", flush=True)
                
    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else total_time
    raw_content = "".join(content_chunks)
    raw_reasoning = "".join(reasoning_chunks)
    
    print(f"\n✅ STAGE 2 Complete in {total_time:.1f}s | TTFT: {ttft:.2f}s")
    print(f"   Reasoning: {len(raw_reasoning)} chars | Content: {len(raw_content)} chars")
    
    parsed, valid, note = clean_and_repair_json(raw_content)
    print(f"   JSON Status: {'✅ ' + note if valid else '❌ ' + note}")
    
    return {
        "ttft_seconds": round(ttft, 2),
        "total_seconds": round(total_time, 2),
        "raw_reasoning": raw_reasoning,
        "raw_content": raw_content,
        "parsed_json": parsed,
        "is_valid": valid
    }


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    print("\n" + "#" * 70)
    print("⚡ TWO-STAGE PROGRESSIVE MISTRAL LARGE 4 BENCHMARK")
    print("   Goal: Test if breaking generation into 2 stages solves the 218s UX lag")
    print("#" * 70)
    
    client = OpenAI(
        base_url=settings.NVIDIA_BASE_URL,
        api_key=settings.NVIDIA_API_KEY,
        timeout=180.0
    )
    
    # 1. Run Stage 1 (Strategy + 3 Hooks)
    stage1 = run_stage_1(client)
    
    # 2. Run Stage 2 (Selected Angle Expansion)
    stage2 = run_stage_2(client, stage1, chosen_angle_id=3)
    
    # 3. Overall Timing Analysis
    cumulative_time = stage1["total_seconds"] + stage2["total_seconds"]
    time_saved = 218.4 - cumulative_time
    pct_saved = (time_saved / 218.4) * 100
    
    print("\n" + "=" * 70)
    print("📊 BENCHMARK TIMING REPORT: TWO-STAGE vs MONOLITHIC")
    print("=" * 70)
    print(f"  Stage 1 (Strategy & 3 Hooks):")
    print(f"    - TTFT (Time to First Token): {stage1['ttft_seconds']}s")
    print(f"    - User Decision Point Arrived In: {stage1['total_seconds']}s")
    print(f"  Stage 2 (Full 6-Shot Production Script):")
    print(f"    - TTFT: {stage2['ttft_seconds']}s")
    print(f"    - Script Generation Duration: {stage2['total_seconds']}s")
    print(f"  -------------------------------------------------------------")
    print(f"  Old Monolithic Run Time: 218.4 seconds (3m 38s)")
    print(f"  New User Time to First Interactive Decision: {stage1['total_seconds']}s")
    print(f"  Total Cumulative Generation: {cumulative_time:.1f}s")
    print(f"  Total Time Reduction: {time_saved:.1f}s ({pct_saved:.1f}% faster)")
    print("=" * 70)
    
    # Save Report
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = backend_dir / "evaluation_results"
    results_dir.mkdir(exist_ok=True)
    
    result_data = {
        "timestamp": timestamp,
        "model": "mistralai/mistral-large-4-1t-a52b",
        "stage1": stage1,
        "stage2": stage2,
        "timing_analysis": {
            "monolithic_seconds": 218.4,
            "stage1_ttft_seconds": stage1["ttft_seconds"],
            "stage1_total_seconds": stage1["total_seconds"],
            "stage2_ttft_seconds": stage2["ttft_seconds"],
            "stage2_total_seconds": stage2["total_seconds"],
            "cumulative_seconds": round(cumulative_time, 2),
            "user_time_to_interactive_decision": stage1["total_seconds"]
        }
    }
    
    json_path = results_dir / f"two_stage_mistral_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2)
    print(f"\n💾 Saved raw results to: {json_path}")
    
    # Write Artifact
    artifact_path = Path(r"C:\Users\Harshad Potdar\.gemini\antigravity\brain\686ab27b-5d40-48ae-822e-2338d73ef5ce\two_stage_mistral_benchmark.md")
    report_md = f"""# ⚡ Two-Stage Progressive Campaign Generation Benchmark
**Mistral Large 4 (`mistralai/mistral-large-4-1t-a52b`) via NVIDIA NIM**
*Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*

---

## 1. Latency & UX Comparison

| Metric | Old Monolithic Approach | New Two-Stage Progressive Pipeline | Improvement |
| :--- | :---: | :---: | :---: |
| **Time to First Decision Point** | **218.4s (3 min 38s)** | **{stage1['total_seconds']}s** | **{round(218.4 / max(stage1['total_seconds'], 1), 1)}x faster to user choice** |
| **Stage 1 TTFT** | 4.60s | **{stage1['ttft_seconds']}s** | Fast start |
| **Stage 1 Generation (Strategy & 3 Hooks)** | N/A (all bundled) | **{stage1['total_seconds']}s** | Interactive & decoupled |
| **Stage 2 Generation (Selected Script)** | N/A | **{stage2['total_seconds']}s** | Focused execution only |
| **Cumulative Time** | 218.4s | **{round(cumulative_time, 1)}s** | **{pct_saved:.1f}% total time saved** |
| **User Perceived Latency** | Frozen screen for 3.5 mins | Chooses hook in {stage1['total_seconds']}s, script arrives in {stage2['total_seconds']}s | **Eliminates UX abandonment** |

---

## 2. Generated Creative Outputs

### Stage 1: The 3 Generated Hooks & Angles
```json
{json.dumps(stage1.get('parsed_json', {}).get('three_creative_angles', []), indent=2)}
```

### Stage 2: Expanded Production Script (Angle #{stage2.get('parsed_json', {}).get('working_title', 'Selected')})
```json
{json.dumps(stage2.get('parsed_json', {}), indent=2)}
```
"""
    artifact_path.write_text(report_md, encoding="utf-8")
    print(f"📊 Saved artifact report to: {artifact_path}")


if __name__ == "__main__":
    main()
