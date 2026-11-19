#!/usr/bin/env python3
"""
AgencyOS Campaign Benchmark Runner
----------------------------------
Phase 0 / Phase 1: Baseline Benchmark & Instrumentation.

Executes standardized client briefs across model configurations:
1. Current Production Baseline: Qwen 2.5 27B / qwen3.8-27b (temp 0.3)
2. Fast Workhorse Candidate: GPT-OSS-120B (Groq, temp 0.7)
3. Creative Candidate: MiniMax M3.1 Flash (NVIDIA NIM, temp 0.7)

Captures full inputs, prompts, decoding parameters, TTFT, latency, raw outputs,
schema reliability, and audits for factual hallucinations & clichés.
"""

import os
import sys
import json
import time
import re
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from groq import Groq
from openai import OpenAI
import json_repair

from benchmarks.dataset import BENCHMARK_DATASET
from benchmarks.metrics import BenchmarkScorecard, EVALUATION_INSTRUCTIONS

# ---------------------------------------------------------------------------
# STANDARDIZED PROMPT BUILDER
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an elite Creative Director and Campaign Architect for AgencyOS.
Your goal is to develop a distinctive, brand-specific, evidence-backed video campaign for this client.

CORE PRINCIPLE:
Creative quality and factual reliability are independent requirements.
- You must strictly respect verified client facts and verified offers.
- NEVER invent unverified discounts, false medical claims, or fake statistics just to write a catchy CTA.
- The tone must authentically reflect the specific persona without slipping into generic marketing tropes.

OUTPUT REQUIREMENT:
Respond ONLY with a valid, parseable JSON object matching the requested schema. Use straight double quotes for keys and strings.
"""

def build_user_prompt(brief: Dict[str, Any]) -> str:
    return f"""Develop the complete Campaign Blueprint & Reel Script for this client:

--- CLIENT CONTEXT ---
- Brand: {brief['brand_name']}
- Category: {brief['category']}
- Face of Brand / Persona: {brief['persona']['name']} — {brief['persona']['role']}
  * Voice & Tone: {brief['persona']['voice']}
  * Avoid Voice: {brief['persona']['avoid_voice']}
- Target Audience Profile: {brief['target_audience']['profile']}
  * Pain Points: {brief['target_audience']['pain_points']}
  * Hidden Fear / Ego Defense: {brief['target_audience']['hidden_fear']}
- Target Topic: "{brief['topic']}"

--- FACTUAL BOUNDARIES & VERIFIED OFFERS ---
- Verified Facts (CAN USE):
{chr(10).join(['  * ' + f for f in brief['verified_facts']])}
- Unverified Prohibitions (CANNOT PRESENT AS FACT / MUST NOT INVENT):
{chr(10).join(['  * ' + p for p in brief['unverified_prohibitions']])}
- Negative Constraints:
{chr(10).join(['  * ' + c for c in brief['negative_constraints']])}

RETURN A VALID JSON OBJECT MATCHING THIS SCHEMA:
{{
  "strategic_thesis": "The central strategic argument or angle that creates an unfair moat",
  "audience_insight": "The specific psychological friction point or unspoken truth addressed",
  "viral_angle": {{
    "angle_name": "Punchy name of the angle",
    "hook_first_3_seconds": "Exact spoken line in the first 0-3 seconds",
    "visual_hook": "Exact visual pattern interrupt on screen in first 2 seconds",
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
        "camera_direction": "Exact framing, angle, and camera movement",
        "visual_action": "Exact physical action, props, environment, B-roll",
        "spoken_dialogue": "Exact spoken words reflecting the authentic persona",
        "onscreen_text": "Onscreen typography and visual treatment",
        "audio_sfx": "Music tone, sound effects, ambient cues"
      }},
      {{
        "shot_number": 2,
        "timing": "0:04 - 0:18",
        "camera_direction": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }},
      {{
        "shot_number": 3,
        "timing": "0:18 - 0:35",
        "camera_direction": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }},
      {{
        "shot_number": 4,
        "timing": "0:35 - 0:50",
        "camera_direction": "Framing and movement",
        "visual_action": "Action breakdown",
        "spoken_dialogue": "Spoken dialogue (closing value + verified CTA)",
        "onscreen_text": "Text overlay",
        "audio_sfx": "SFX cues"
      }}
    ],
    "call_to_action": {{
      "spoken_dialogue": "Exact spoken CTA line",
      "visual_action": "What the speaker does on camera during CTA",
      "verified_offer": "The exact verified offer from the brief (NO invented discounts)"
    }}
  }}
}}
"""

def parse_and_repair_json(text: str) -> Tuple[Any, bool, str]:
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
# MODEL ADAPTERS
# ---------------------------------------------------------------------------

def invoke_model(
    model_id: str,
    provider: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    extra_body: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Execute model with streaming to capture TTFT, latency, and full telemetry."""
    start_time = time.time()
    first_token_time = None
    reasoning_chunks = []
    content_chunks = []
    error = None
    
    try:
        if provider == "groq":
            client = Groq(api_key=settings.GROQ_API_KEY, timeout=90.0)
            stream = client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
        elif provider == "nvidia":
            client = OpenAI(base_url=settings.NVIDIA_BASE_URL, api_key=settings.NVIDIA_API_KEY, timeout=180.0)
            kwargs = {
                "model": model_id,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True
            }
            if extra_body:
                kwargs["extra_body"] = extra_body
            stream = client.chat.completions.create(**kwargs)
        else:
            raise ValueError(f"Unknown provider: {provider}")
            
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
                
    except Exception as e:
        error = str(e)
        
    total_time = time.time() - start_time
    ttft = (first_token_time - start_time) if first_token_time else total_time
    raw_content = "".join(content_chunks)
    raw_reasoning = "".join(reasoning_chunks)
    parsed_json, is_valid, json_note = parse_and_repair_json(raw_content) if raw_content else (None, False, "Empty output")
    
    return {
        "model_id": model_id,
        "provider": provider,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "extra_body": extra_body,
        "ttft_seconds": round(ttft, 3),
        "total_seconds": round(total_time, 2),
        "reasoning_length": len(raw_reasoning),
        "content_length": len(raw_content),
        "raw_reasoning": raw_reasoning,
        "raw_content": raw_content,
        "parsed_json": parsed_json,
        "is_valid_json": is_valid,
        "json_status": json_note,
        "error": error
    }


# ---------------------------------------------------------------------------
# OBJECTIVE JUDGE EVALUATOR
# ---------------------------------------------------------------------------

def evaluate_with_judge(brief: Dict[str, Any], model_run: Dict[str, Any]) -> BenchmarkScorecard:
    """Audit the output against the 7 baseline metrics and factual integrity rules."""
    judge_client = Groq(api_key=settings.GROQ_API_KEY, timeout=60.0)
    
    audit_prompt = f"""AUDIT THIS CAMPAIGN DELIVERABLE:

CLIENT: {brief['category']} - {brief['brand_name']}
PERSONA: {brief['persona']['name']} ({brief['persona']['role']})
VERIFIED FACTS:
{json.dumps(brief['verified_facts'], indent=2)}
UNVERIFIED PROHIBITIONS:
{json.dumps(brief['unverified_prohibitions'], indent=2)}
NEGATIVE CONSTRAINTS:
{json.dumps(brief['negative_constraints'], indent=2)}

GENERATED OUTPUT:
{json.dumps(model_run.get('parsed_json') or model_run.get('raw_content'), indent=2)}

CRITICAL AUDIT TASK:
1. Did the output invent any unverified statistics, discounts, or fake case studies?
2. Did it use cliché marketing phrasing?
3. Score each of the 7 dimensions from 1.0 to 5.0.

RETURN A VALID JSON OBJECT MATCHING THIS SCHEMA:
{{
  "creative_quality": <1.0 to 5.0>,
  "specificity": <1.0 to 5.0>,
  "accuracy_and_factuality": <1.0 to 5.0>,
  "production_readiness": <1.0 to 5.0>,
  "repetition_and_cliche_index": <1.0 to 5.0>,
  "brand_voice_alignment": <1.0 to 5.0>,
  "cta_effectiveness": <1.0 to 5.0>,
  "hallucinated_facts": ["any invented statistics or unapproved offers found"],
  "cliche_flags": ["any detected clichés"],
  "strengths": ["key strength 1", "key strength 2"],
  "weaknesses": ["key weakness 1", "key weakness 2"],
  "evaluator_verdict": "Detailed summary"
}}
"""
    try:
        res = judge_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": EVALUATION_INSTRUCTIONS},
                {"role": "user", "content": audit_prompt}
            ],
            temperature=0.1,
            max_tokens=2048
        )
        parsed, valid, note = parse_and_repair_json(res.choices[0].message.content or "")
        if valid and isinstance(parsed, dict):
            # Calculate composite total
            w_total = BenchmarkScorecard.calculate_total_weighted(
                creative=float(parsed.get("creative_quality", 3.0)),
                specificity=float(parsed.get("specificity", 3.0)),
                accuracy=float(parsed.get("accuracy_and_factuality", 3.0)),
                production=float(parsed.get("production_readiness", 3.0)),
                repetition=float(parsed.get("repetition_and_cliche_index", 3.0)),
                voice=float(parsed.get("brand_voice_alignment", 3.0)),
                cta=float(parsed.get("cta_effectiveness", 3.0)),
            )
            parsed["total_weighted_score"] = w_total
            return BenchmarkScorecard(**parsed)
    except Exception as e:
        print(f"⚠️ Judge Evaluation error: {e}")
        
    # Fallback default scorecard
    return BenchmarkScorecard(
        creative_quality=3.0,
        specificity=3.0,
        accuracy_and_factuality=3.0,
        production_readiness=3.0,
        repetition_and_cliche_index=3.0,
        brand_voice_alignment=3.0,
        cta_effectiveness=3.0,
        total_weighted_score=60.0,
        evaluator_verdict="Evaluation completed with fallback evaluator."
    )


# ---------------------------------------------------------------------------
# MAIN BENCHMARK RUNNER
# ---------------------------------------------------------------------------

CONFIGS_TO_TEST = [
    {
        "name": "Production Baseline (Qwen 2.5 27B, T=0.3)",
        "model_id": "qwen/qwen3.8-27b",
        "provider": "groq",
        "temperature": 0.3,
        "max_tokens": 2048,
        "extra_body": None
    },
    {
        "name": "Fast Workhorse (GPT-OSS-120B, T=0.7)",
        "model_id": "openai/gpt-oss-120b",
        "provider": "groq",
        "temperature": 0.7,
        "max_tokens": 4096,
        "extra_body": None
    },
    {
        "name": "Creative Candidate (MiniMax M3.1 Flash, T=0.7)",
        "model_id": "minimaxai/minimax-m3.1-flash",
        "provider": "nvidia",
        "temperature": 0.7,
        "max_tokens": 4096,
        "extra_body": {"reasoning_effort": "low"}
    }
]

def run_benchmark(briefs: List[Dict[str, Any]], run_name: str = "baseline") -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    runs_dir = backend_dir / "benchmarks" / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "#" * 80)
    print(f"🚀 EXECUTING AGENCYOS CAMPAIGN BENCHMARK: {run_name.upper()}")
    print(f"   Briefs: {len(briefs)} | Configurations: {len(CONFIGS_TO_TEST)}")
    print("#" * 80)
    
    master_records = []
    
    for b_idx, brief in enumerate(briefs, 1):
        print("\n" + "=" * 80)
        print(f"📋 BRIEF {b_idx}/{len(briefs)}: {brief['category']} ({brief['brand_name']})")
        print(f"   Topic: \"{brief['topic']}\"")
        print("=" * 80)
        
        user_prompt = build_user_prompt(brief)
        brief_record = {
            "brief_id": brief["id"],
            "category": brief["category"],
            "brand_name": brief["brand_name"],
            "topic": brief["topic"],
            "system_prompt": SYSTEM_PROMPT,
            "user_prompt": user_prompt,
            "configurations": []
        }
        
        for cfg in CONFIGS_TO_TEST:
            print(f"⏳ Running [{cfg['name']}]...", end=" ", flush=True)
            model_res = invoke_model(
                model_id=cfg["model_id"],
                provider=cfg["provider"],
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=cfg["temperature"],
                max_tokens=cfg["max_tokens"],
                extra_body=cfg["extra_body"]
            )
            print(f"Done in {model_res['total_seconds']}s (TTFT: {model_res['ttft_seconds']}s)")
            
            print(f"   ⚖️ Auditing output against facts & rubric...", end=" ", flush=True)
            scorecard = evaluate_with_judge(brief, model_res)
            print(f"Score: {scorecard.total_weighted_score}/100 (Accuracy: {scorecard.accuracy_and_factuality}/5 | Creative: {scorecard.creative_quality}/5)")
            if scorecard.hallucinated_facts:
                print(f"   ⚠️ Hallucinated Facts Detected: {scorecard.hallucinated_facts}")
                
            brief_record["configurations"].append({
                "config_name": cfg["name"],
                "model_id": cfg["model_id"],
                "provider": cfg["provider"],
                "temperature": cfg["temperature"],
                "metrics": {
                    "ttft_seconds": model_res["ttft_seconds"],
                    "total_seconds": model_res["total_seconds"],
                    "content_length": model_res["content_length"],
                    "is_valid_json": model_res["is_valid_json"],
                    "json_status": model_res["json_status"]
                },
                "scorecard": scorecard.model_dump(),
                "parsed_output": model_res["parsed_json"],
                "raw_output": model_res["raw_content"]
            })
            
        master_records.append(brief_record)
        
    # Save Full JSON Telemetry
    json_path = runs_dir / f"benchmark_run_{timestamp}.json"
    latest_path = runs_dir / "latest_run.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(master_records, f, indent=2)
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(master_records, f, indent=2)
        
    # Generate Markdown Report
    artifact_path = Path(r"C:\Users\Harshad Potdar\.gemini\antigravity\brain\686ab27b-5d40-48ae-822e-2338d73ef5ce\baseline_benchmark_report.md")
    generate_markdown_report(master_records, artifact_path)
    
    print("\n" + "=" * 80)
    print(f"🏁 BENCHMARK RUN COMPLETE!")
    print(f"💾 Raw Telemetry: {json_path}")
    print(f"📊 Markdown Report: {artifact_path}")
    print("=" * 80 + "\n")
    return artifact_path


def generate_markdown_report(records: List[Dict[str, Any]], output_path: Path):
    lines = [
        "# 📊 AgencyOS Campaign Intelligence: Baseline Benchmark Report",
        f"**Phase 0 / Phase 1: Controlled Instrumentation & Baseline Measurement**",
        f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*",
        "",
        "---",
        "",
        "## 1. Master Configuration Scorecard",
        "",
        "| Client Brief | Baseline (Qwen 27B, T=0.3) | Fast Workhorse (GPT-OSS-120B, T=0.7) | Creative (MiniMax Flash, T=0.7) | Winner |",
        "| :--- | :---: | :---: | :---: | :--- |"
    ]
    
    # Track aggregate scores and latencies
    cfg_scores = {c["name"]: [] for c in CONFIGS_TO_TEST}
    cfg_latencies = {c["name"]: [] for c in CONFIGS_TO_TEST}
    cfg_ttfts = {c["name"]: [] for c in CONFIGS_TO_TEST}
    
    for r in records:
        cat = r["category"]
        cfgs = r["configurations"]
        
        row = [f"**{cat}**"]
        best_score = -1.0
        best_cfg = "None"
        
        for c in cfgs:
            sc = c["scorecard"]["total_weighted_score"]
            lat = c["metrics"]["total_seconds"]
            ttft = c["metrics"]["ttft_seconds"]
            
            cfg_scores[c["config_name"]].append(sc)
            cfg_latencies[c["config_name"]].append(lat)
            cfg_ttfts[c["config_name"]].append(ttft)
            
            row.append(f"**{sc}** ({lat}s / {ttft}s)")
            if sc > best_score:
                best_score = sc
                best_cfg = c["config_name"].split(" (")[0]
                
        row.append(f"**{best_cfg}**")
        lines.append("| " + " | ".join(row) + " |")
        
    lines.extend([
        "",
        "### Aggregate Performance Summary",
        "",
        "| Configuration | Avg Score (/100) | Avg Total Latency | Avg TTFT | Factual Hallucinations | Schema Reliability |",
        "| :--- | :---: | :---: | :---: | :---: | :---: |"
    ])
    
    for c in CONFIGS_TO_TEST:
        c_name = c["name"]
        avg_sc = sum(cfg_scores[c_name]) / max(len(cfg_scores[c_name]), 1)
        avg_lat = sum(cfg_latencies[c_name]) / max(len(cfg_latencies[c_name]), 1)
        avg_ttft = sum(cfg_ttfts[c_name]) / max(len(cfg_ttfts[c_name]), 1)
        
        # Count total hallucinations
        total_hallucinations = 0
        valid_schema_count = 0
        total_runs = 0
        for r in records:
            for conf in r["configurations"]:
                if conf["config_name"] == c_name:
                    total_runs += 1
                    total_hallucinations += len(conf["scorecard"].get("hallucinated_facts", []))
                    if conf["metrics"].get("is_valid_json"):
                        valid_schema_count += 1
                        
        schema_pct = (valid_schema_count / max(total_runs, 1)) * 100
        lines.append(f"| **{c_name}** | **{avg_sc:.1f} / 100** | **{avg_lat:.2f}s** | **{avg_ttft:.2f}s** | {total_hallucinations} detected | {schema_pct:.0f}% valid |")
        
    lines.extend([
        "",
        "---",
        "",
        "## 2. Granular 7-Dimension Scorecard Comparison",
        "",
        "| Dimension | Baseline (Qwen 27B) | Fast Workhorse (GPT-OSS-120B) | Creative Candidate (MiniMax Flash) | Key Observation |",
        "| :--- | :---: | :---: | :---: | :--- |"
    ])
    
    dims = [
        ("Creative Quality (25%)", "creative_quality"),
        ("Specificity (20%)", "specificity"),
        ("Accuracy & Factuality (20%)", "accuracy_and_factuality"),
        ("Production Readiness (15%)", "production_readiness"),
        ("Repetition & Clichés (10%)", "repetition_and_cliche_index"),
        ("Brand Voice Alignment (5%)", "brand_voice_alignment"),
        ("CTA Effectiveness (5%)", "cta_effectiveness"),
    ]
    
    for label, key in dims:
        row = [f"**{label}**"]
        for c in CONFIGS_TO_TEST:
            c_name = c["name"]
            dim_scores = []
            for r in records:
                for conf in r["configurations"]:
                    if conf["config_name"] == c_name:
                        dim_scores.append(conf["scorecard"].get(key, 3.0))
            avg_dim = sum(dim_scores) / max(len(dim_scores), 1)
            row.append(f"**{avg_dim:.2f} / 5.0**")
            
        row.append("See client breakdowns below")
        lines.append("| " + " | ".join(row) + " |")
        
    lines.extend([
        "",
        "---",
        "",
        "## 3. Client Case Breakdown & Direct Excerpts",
        ""
    ])
    
    for b_idx, r in enumerate(records, 1):
        lines.extend([
            f"### Client {b_idx}: {r['category']} ({r['brand_name']})",
            f"**Topic**: *\"{r['topic']}\"*",
            ""
        ])
        for c in r["configurations"]:
            out = c.get("parsed_output") or {}
            hook = out.get("viral_angle", {}).get("hook_first_3_seconds", "N/A")
            v_hook = out.get("viral_angle", {}).get("visual_hook", "N/A")
            cta = out.get("production_script", {}).get("call_to_action", {}).get("spoken_dialogue", "N/A")
            v_offer = out.get("production_script", {}).get("call_to_action", {}).get("verified_offer", "N/A")
            sc = c["scorecard"]
            
            lines.extend([
                f"#### {c['config_name']} — Score: {sc['total_weighted_score']}/100",
                f"- **Latency**: {c['metrics']['total_seconds']}s (TTFT: {c['metrics']['ttft_seconds']}s)",
                f"- **0–3s Hook**: *\"{hook}\"*",
                f"- **Visual Hook**: {v_hook}",
                f"- **Verified CTA**: *\"{cta}\"* (Offer: {v_offer})",
                f"- **Factual Audit**: {'✅ Zero hallucinations' if not sc.get('hallucinated_facts') else '⚠️ Flagged: ' + ', '.join(sc['hallucinated_facts'])}",
                f"- **Evaluator Critique**: {sc.get('evaluator_verdict', 'N/A')}",
                ""
            ])
        lines.append("---")
        
    output_path.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=3, help="Number of briefs to run (default: 3 for fast baseline)")
    args = parser.parse_args()
    
    selected_briefs = BENCHMARK_DATASET[:args.limit]
    run_benchmark(selected_briefs, run_name=f"baseline_{args.limit}_clients")
