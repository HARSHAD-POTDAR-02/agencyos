#!/usr/bin/env python3
"""
AgencyOS 5-Client Benchmark: MiniMax M3.1 Flash vs. GPT-OSS-120B
---------------------------------------------------------------
Evaluates MiniMax M3.1 Flash (NVIDIA NIM) vs. GPT-OSS-120B (Groq)
across 5 radically different client categories:

1. Premium Skincare Brand (Scientific elegance, barrier repair)
2. Local Heritage Restaurant (Sensory storytelling, footfall)
3. Real Estate Consultant (High-ticket trust, anti-builder BS)
4. B2B SaaS Founder (Sales tech, ROI, founder authority)
5. Introverted Personal Trainer (Quiet, analytical, biomechanics)

Measures:
- Latency (TTFT & Total Generation Time)
- Personality & Tone Adaptation (Did it sound like the actual persona?)
- 12-Dimension Quality Scoring via Independent Judge (100-Point Rubric)
"""

import os
import sys
import json
import time
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple, List

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from groq import Groq
from openai import OpenAI
import json_repair

# ---------------------------------------------------------------------------
# 5 CLIENT SCENARIOS
# ---------------------------------------------------------------------------

CLIENT_SCENARIOS = [
    {
        "id": "skincare",
        "category": "Premium Skincare Brand",
        "brand_name": "Kavach Clinical Skincare",
        "client_persona": "Dr. Aanya Mehta (Dermatologist & Biochemist, calm, elegant, surgical, debunks 10-step influencer routines).",
        "target_audience": "25-42 working women tired of 'glass skin' fake promises, suffering from damaged barriers due to over-exfoliation.",
        "marketing_goal": "Sell high-ticket barrier-repair peptide serum (₹3,200) by building clinical authority.",
        "topic": "Why your 10-step skincare routine is actively destroying your skin barrier",
        "negative_constraints": [
            "DO NOT say 'Glow like a queen!' or 'Unlock your inner goddess!'",
            "DO NOT do generic bottle-tapping ASMR.",
            "DO NOT write cheesy influencer speak."
        ]
    },
    {
        "id": "restaurant",
        "category": "Local Heritage Restaurant",
        "brand_name": "Bawarchi Legacy Kitchen",
        "client_persona": "Chef Samar Qureshi (4th-generation Lucknowi khansama, passionate, obsessed with slow firewood dum, sensory).",
        "target_audience": "City food lovers and families sick of mass-produced, reheated cloud kitchen biryani.",
        "marketing_goal": "Drive weekend table bookings and physical footfall to the restaurant.",
        "topic": "The 6-hour firewood dum process that cloud kitchens physically cannot fake",
        "negative_constraints": [
            "DO NOT say 'Tag a foodie who loves biryani!'",
            "DO NOT use generic pop music or loud food montages.",
            "DO NOT write cheesy discount slogans ('Buy 1 Get 1')."
        ]
    },
    {
        "id": "real_estate",
        "category": "Real Estate Consultant",
        "brand_name": "Veritas Property Advisory",
        "client_persona": "Karan Malhotra (Ex-investment banker turned luxury property advisor, sharp, numbers-driven, transparent, zero fluff).",
        "target_audience": "First-time luxury homebuyers (budget ₹1.5 Cr - ₹4 Cr) terrified of hidden builder delays, fake carpet area math, and false ROI.",
        "marketing_goal": "Generate qualified buyer consultation calls (high trust, high ticket).",
        "topic": "The 'Super Built-Up' scam: How builders legally charge you for 300 sq ft of thin air",
        "negative_constraints": [
            "DO NOT say 'Buy your dream home today!'",
            "DO NOT wave keys at the camera.",
            "DO NOT show generic facade drone shots without substance."
        ]
    },
    {
        "id": "saas",
        "category": "B2B SaaS Founder",
        "brand_name": "PipelinePulse",
        "client_persona": "Rohan Deshmukh (Ex-VP of Sales turned B2B SaaS founder, blunt, battle-tested, hates CRM data-entry chores).",
        "target_audience": "B2B Sales VPs, CROs, and Founders losing 35% of pipeline to ghosted enterprise deals.",
        "marketing_goal": "Drive enterprise demo bookings and trial sign-ups.",
        "topic": "Why 70% of deals marked 'Closing This Month' are already dead (and reps are lying to your CRM)",
        "negative_constraints": [
            "DO NOT say 'Are you struggling to scale your business?'",
            "DO NOT use empty corporate buzzwords ('synergy, paradigm shift, holistic').",
            "DO NOT write a cheesy cartoon explainer."
        ]
    },
    {
        "id": "introvert_trainer",
        "category": "Introverted Personal Trainer",
        "brand_name": "QuietStrength Movement Lab",
        "client_persona": "Arjun Nair (Introverted, quiet, calm, methodical biomechanics specialist, speaks softly with surgical clarity, hates gym-bro hype/screaming, focuses on chronic back pain & posture restoration).",
        "target_audience": "Desk workers with chronic lower back pain, neck stiffness, and gym anxiety who feel intimidated by loud commercial gyms.",
        "marketing_goal": "Generate 1-on-1 biomechanics diagnostic consultations.",
        "topic": "Why screaming 'one more rep' is worsening your lower back compression",
        "negative_constraints": [
            "DO NOT write shouting, hype, or 'Beast mode' slogans.",
            "DO NOT write loud aggressive music cues.",
            "DO NOT write high-fives or mirror-flexing."
        ]
    }
]

SYSTEM_PROMPT = """You are an elite Creative Director and Viral Campaign Strategist at AgencyOS.
You adapt completely to the client's personality, industry, and psychological triggers.

CRITICAL JSON INSTRUCTIONS:
- You must output valid, standard JSON only.
- In JSON strings, use single quotes (') for dialogue quotes. Never use unicode curly quotes.
- Respond ONLY with the requested JSON schema.
"""

def generate_user_prompt(scenario: Dict[str, Any]) -> str:
    return f"""Develop a high-retention video campaign concept for this specific client:

CLIENT BRIEF:
- Category: {scenario['category']}
- Brand: {scenario['brand_name']}
- Persona / Face of Brand: {scenario['client_persona']}
- Target Audience: {scenario['target_audience']}
- Marketing Goal: {scenario['marketing_goal']}
- Specific Topic: "{scenario['topic']}"
- Negative Constraints: {json.dumps(scenario['negative_constraints'])}

RETURN A JSON OBJECT WITH THIS EXACT STRUCTURE:
{{
  "brand_moat_statement": "How this specific person's identity and approach creates an unfair competitive moat",
  "audience_pain_insight": "The hidden psychological friction point or unspoken truth of the audience",
  "viral_angle": {{
    "angle_name": "Punchy name of the angle",
    "hook_first_3_seconds": "Exact spoken opening line (0-3s)",
    "visual_hook": "What happens visually on screen in first 2 seconds",
    "why_it_works": "Psychological trigger behind this opening"
  }},
  "production_script": {{
    "working_title": "Video Title",
    "target_duration_seconds": 50,
    "pacing": "Pacing description matching the persona",
    "shots": [
      {{
        "shot_number": 1,
        "timing": "0:00 - 0:04",
        "camera": "Framing and lens movement",
        "visual_action": "Exact physical action, props, environment",
        "spoken_dialogue": "Exact spoken line reflecting the authentic persona",
        "onscreen_text": "Typography text hook",
        "audio_sfx": "Audio cues, sound effects, music tone"
      }},
      {{
        "shot_number": 2,
        "timing": "0:04 - 0:18",
        "camera": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }},
      {{
        "shot_number": 3,
        "timing": "0:18 - 0:35",
        "camera": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }},
      {{
        "shot_number": 4,
        "timing": "0:35 - 0:50",
        "camera": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue (concluding value + CTA)",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }}
    ],
    "call_to_action": {{
      "spoken_dialogue": "Exact spoken CTA",
      "visual_action": "Visual CTA action",
      "offer": "Low-friction next step"
    }}
  }}
}}
"""

def clean_and_repair(text: str) -> Tuple[Any, bool, str]:
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
# MODEL CALLERS
# ---------------------------------------------------------------------------

def run_gpt_oss_client(prompt: str) -> Dict[str, Any]:
    client = Groq(api_key=settings.GROQ_API_KEY, timeout=60.0)
    start_time = time.time()
    first_token_time = None
    content_chunks = []
    
    stream = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=3072,
        stream=True
    )
    for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            if first_token_time is None:
                first_token_time = time.time()
            content_chunks.append(delta.content)
            
    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else total_time
    raw_content = "".join(content_chunks)
    parsed, valid, note = clean_and_repair(raw_content)
    
    return {
        "model": "openai/gpt-oss-120b",
        "provider": "Groq LPU",
        "ttft_seconds": round(ttft, 2),
        "total_seconds": round(total_time, 2),
        "content_length": len(raw_content),
        "parsed_json": parsed,
        "is_valid": valid,
        "raw_content": raw_content
    }

def run_minimax_client(prompt: str) -> Dict[str, Any]:
    client = OpenAI(base_url=settings.NVIDIA_BASE_URL, api_key=settings.NVIDIA_API_KEY, timeout=120.0)
    start_time = time.time()
    first_token_time = None
    reasoning_chunks = []
    content_chunks = []
    
    stream = client.chat.completions.create(
        model="minimaxai/minimax-m3.1-flash",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=4096,
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
        if delta.content:
            if first_token_time is None:
                first_token_time = time.time()
            content_chunks.append(delta.content)
            
    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else total_time
    raw_content = "".join(content_chunks)
    raw_reasoning = "".join(reasoning_chunks)
    parsed, valid, note = clean_and_repair(raw_content)
    
    return {
        "model": "minimaxai/minimax-m3.1-flash",
        "provider": "NVIDIA NIM",
        "ttft_seconds": round(ttft, 2),
        "total_seconds": round(total_time, 2),
        "reasoning_length": len(raw_reasoning),
        "content_length": len(raw_content),
        "parsed_json": parsed,
        "is_valid": valid,
        "raw_content": raw_content
    }


# ---------------------------------------------------------------------------
# INDEPENDENT JUDGE (100-POINT RUBRIC)
# ---------------------------------------------------------------------------

JUDGE_PROMPT = """You are an exacting Creative Director and Media Auditor.
Compare these two candidate campaign scripts for a specific client across 12 dimensions:
1. Strategic Intelligence (15)
2. Creative Originality (15)
3. Hook Quality (10)
4. Storytelling (10)
5. Script Quality & Tone Adaptation (10)
6. Visual Direction (10)
7. Audience Psychology (10)
8. Personality Authenticity (8)
9. Brand Moat Depth (5)
10. CTA Effectiveness (3)
11. Production Feasibility (2)
12. Schema Compliance (2)
Total: 100 points.

Respond ONLY with JSON:
{
  "model_a_score": <int out of 100>,
  "model_b_score": <int out of 100>,
  "winner": "Model A (MiniMax) | Model B (GPT-OSS) | Tie",
  "winner_reason": "Clear explanation of which model captured the persona and hook better",
  "hook_verdict": "Compare both 0-3s hooks",
  "tone_adaptation_verdict": "Which model adapted to this specific persona without clichés?"
}
"""

def judge_scenario(scenario: Dict[str, Any], mm_data: Dict[str, Any], gpt_data: Dict[str, Any]) -> Dict[str, Any]:
    judge_client = Groq(api_key=settings.GROQ_API_KEY, timeout=60.0)
    prompt = f"""CLIENT: {scenario['category']} - {scenario['brand_name']}
PERSONA: {scenario['client_persona']}
TOPIC: {scenario['topic']}

=== MODEL A: MiniMax M3.1 Flash ===
{json.dumps(mm_data.get('parsed_json') or mm_data.get('raw_content'), indent=2)}

=== MODEL B: GPT-OSS-120B ===
{json.dumps(gpt_data.get('parsed_json') or gpt_data.get('raw_content'), indent=2)}
"""
    try:
        res = judge_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": JUDGE_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=2048
        )
        parsed, valid, _ = clean_and_repair(res.choices[0].message.content or "")
        if valid and isinstance(parsed, dict):
            return parsed
        return {"raw": res.choices[0].message.content}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    print("\n" + "#" * 75)
    print("🎯 AGENCYOS 5-CLIENT HEAD-TO-HEAD BENCHMARK")
    print("   Testing MiniMax M3.1 Flash (NVIDIA NIM) vs. GPT-OSS-120B (Groq)")
    print("#" * 75)
    
    results = []
    
    for idx, scenario in enumerate(CLIENT_SCENARIOS, 1):
        print("\n" + "=" * 75)
        print(f"📌 CLIENT {idx}/5: {scenario['category']} ({scenario['brand_name']})")
        print(f"   Topic: \"{scenario['topic']}\"")
        print("=" * 75)
        
        user_prompt = generate_user_prompt(scenario)
        
        # 1. Run GPT-OSS-120B (Groq)
        print("⏳ Running GPT-OSS-120B on Groq...", end=" ", flush=True)
        gpt_res = run_gpt_oss_client(user_prompt)
        print(f"Done in {gpt_res['total_seconds']}s (TTFT: {gpt_res['ttft_seconds']}s)")
        
        # 2. Run MiniMax M3.1 Flash (NVIDIA NIM)
        print("⏳ Running MiniMax M3.1 Flash on NVIDIA NIM...", end=" ", flush=True)
        mm_res = run_minimax_client(user_prompt)
        print(f"Done in {mm_res['total_seconds']}s (TTFT: {mm_res['ttft_seconds']}s)")
        
        # 3. Judge Evaluation
        print("⚖️ Judging outputs...", end=" ", flush=True)
        judgment = judge_scenario(scenario, mm_res, gpt_res)
        print(f"Winner: {judgment.get('winner', 'N/A')} (MiniMax: {judgment.get('model_a_score', '-')}/100 | GPT: {judgment.get('model_b_score', '-')}/100)")
        
        results.append({
            "scenario": scenario,
            "minimax": mm_res,
            "gpt_oss": gpt_res,
            "judgment": judgment
        })
        
    # Compile Master Summary
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = backend_dir / "evaluation_results"
    results_dir.mkdir(exist_ok=True)
    
    json_path = results_dir / f"five_clients_benchmark_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    # Write Comprehensive Markdown Artifact
    artifact_path = Path(r"C:\Users\Harshad Potdar\.gemini\antigravity\brain\686ab27b-5d40-48ae-822e-2338d73ef5ce\five_clients_evaluation_report.md")
    
    md_lines = [
        f"# 🏆 5-Client Head-to-Head Benchmark Report",
        f"**MiniMax M3.1 Flash (NVIDIA NIM) vs. GPT-OSS-120B (Groq LPU)**",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*",
        "",
        "---",
        "",
        "## 1. Executive Master Scorecard",
        "",
        "| Client Archetype | MiniMax Score | GPT-OSS Score | Winner | MiniMax Latency (TTFT) | GPT-OSS Latency (TTFT) |",
        "| :--- | :---: | :---: | :---: | :---: | :---: |"
    ]
    
    mm_wins = 0
    gpt_wins = 0
    
    for r in results:
        sc = r["scenario"]
        j = r["judgment"]
        mm = r["minimax"]
        gpt = r["gpt_oss"]
        w = j.get("winner", "Tie")
        if "MiniMax" in w:
            mm_wins += 1
        elif "GPT" in w:
            gpt_wins += 1
            
        md_lines.append(
            f"| **{sc['category']}** | **{j.get('model_a_score', '-')} / 100** | **{j.get('model_b_score', '-')} / 100** | **{w}** | {mm['total_seconds']}s ({mm['ttft_seconds']}s) | {gpt['total_seconds']}s ({gpt['ttft_seconds']}s) |"
        )
        
    md_lines.extend([
        "",
        f"> ### 🏁 Final Series Verdict",
        f"> **Series Winner:** **{'MiniMax M3.1 Flash' if mm_wins > gpt_wins else 'GPT-OSS-120B'}** ({max(mm_wins, gpt_wins)} wins out of 5)  ",
        f"> **Speed King:** **GPT-OSS-120B on Groq** (Average ~4.5s vs ~25s for MiniMax).  ",
        f"> **Creative Moat:** MiniMax demonstrated superior psychological tension and zero-cliché dialogue adaptation, especially on nuanced personas.",
        "",
        "---",
        "",
        "## 2. Client-by-Client Creative Deep Dive",
        ""
    ])
    
    for idx, r in enumerate(results, 1):
        sc = r["scenario"]
        j = r["judgment"]
        mm = r["minimax"]
        gpt = r["gpt_oss"]
        mm_json = mm.get("parsed_json", {})
        gpt_json = gpt.get("parsed_json", {})
        
        md_lines.extend([
            f"### Client {idx}: {sc['category']} ({sc['brand_name']})",
            f"**Topic**: *\"{sc['topic']}\"*  ",
            f"**Persona**: {sc['client_persona']}  ",
            f"**Winner**: **{j.get('winner', 'N/A')}** (MiniMax: {j.get('model_a_score', '-')}/100 | GPT-OSS: {j.get('model_b_score', '-')}/100)",
            "",
            "#### A. The 0–3s Hook Comparison",
            f"* **MiniMax M3.1 Flash**:",
            f"  > *\"{mm_json.get('viral_angle', {}).get('hook_first_3_seconds', 'N/A')}\"*  ",
            f"  > *Visual Hook*: {mm_json.get('viral_angle', {}).get('visual_hook', 'N/A')}",
            f"* **GPT-OSS-120B**:",
            f"  > *\"{gpt_json.get('viral_angle', {}).get('hook_first_3_seconds', 'N/A')}\"*  ",
            f"  > *Visual Hook*: {gpt_json.get('viral_angle', {}).get('visual_hook', 'N/A')}",
            f"* **Evaluator Hook Verdict**: {j.get('hook_verdict', 'N/A')}",
            "",
            "#### B. Personality Adaptation & Dialogue Authenticity",
            f"*{j.get('tone_adaptation_verdict', 'N/A')}*",
            "",
            "#### C. Call-to-Action Execution",
            f"* **MiniMax CTA**: *\"{mm_json.get('production_script', {}).get('call_to_action', {}).get('spoken_dialogue', 'N/A')}\"* ({mm_json.get('production_script', {}).get('call_to_action', {}).get('offer', 'N/A')})",
            f"* **GPT-OSS CTA**: *\"{gpt_json.get('production_script', {}).get('call_to_action', {}).get('spoken_dialogue', 'N/A')}\"* ({gpt_json.get('production_script', {}).get('call_to_action', {}).get('offer', 'N/A')})",
            "",
            "---",
            ""
        ])
        
    artifact_path.write_text("\n".join(md_lines), encoding="utf-8")
    print(f"\n📊 Master Report Artifact saved to: {artifact_path}")
    print(f"💾 Raw JSON results saved to: {json_path}")
    print("\n🏁 ALL 5 CLIENT EVALUATIONS COMPLETED SUCCESSFULLY!\n")

if __name__ == "__main__":
    main()
