# 🎯 Campaign Generation Evaluation Benchmark Report
**AgencyOS Creative Intelligence Engine — Frontier Model Assessment**
*Generated: 2026-11-19 01:26:28*

---

## 1. Executive Summary

| Metric / Dimension | Model A: Mistral Large 4 | Model B: GPT-OSS-120B |
| :--- | :--- | :--- |
| **Model ID** | `mistralai/mistral-large-4-1t-a52b` | `openai/gpt-oss-120b` |
| **Provider** | NVIDIA NIM | Groq LPU |
| **Generation Latency** | 224.75s | 6.14s |
| **Reasoning Captured** | 14979 chars | 1415 chars |
| **JSON Adherence** | ❌ Invalid | ❌ Invalid |
| **Total Benchmark Score** | **0 / 100** | **85 / 100** |

> ### 🏆 Final Benchmark Verdict
> **Winner:** **Model B**  
> **Key Finding:** Model B provides a fully fleshed‑out 7‑day Instagram campaign that leverages Vik Sharma's tough‑love, Hinglish voice, and the psychological pain points of the 15‑day quitter. Its hooks, storytelling arc, and visual blueprint are concrete and conversion‑focused, earning it a decisive lead despite a technical JSON formatting error. Recommendation for AgencyOS: adopt Model B's creative framework, correct the JSON syntax (replace curly quotes with straight quotes), and streamline the shoot to a single‑camera phone setup with one extra actor to stay within the 45‑minute production window.

---

## 2. 12-Dimension Weighted Scorecard (100-Point Rubric)

| Dimension | Weight | Mistral Large 4 Score | GPT-OSS-120B Score | Core Distinction |
| :--- | :---: | :---: | :---: | :--- |
| **1. Strategic Intelligence** | 15 pts | **0** | **13** | Owner personality as moat & walk-in strategy |
| **2. Creative Originality** | 15 pts | **0** | **12** | Anti-cliché angles vs recycled fitness tropes |
| **3. Hook Quality** | 10 pts | **0** | **8** | 0-3s pattern interrupt & thumb-stopping tension |
| **4. Storytelling** | 10 pts | **0** | **9** | Progression, conflict, tension, payoff |
| **5. Script Quality** | 10 pts | **0** | **9** | Natural spoken Hinglish cadence & humor |
| **6. Visual Direction** | 10 pts | **0** | **9** | Camera angles, B-roll, movement vs vague filler |
| **7. Audience Psychology** | 10 pts | **0** | **9** | DOMS soreness, silent excuses, dopamine drop |
| **8. Campaign Diversity & Sequencing** | 8 pts | **0** | **7** | 7-day arc avoiding repetition |
| **9. Brand Voice Consistency** | 5 pts | **0** | **5** | Extroverted brother persona retention |
| **10. CTA Effectiveness** | 3 pts | **0** | **3** | Frictionless walk-in conversion bridge |
| **11. Production Feasibility** | 2 pts | **0** | **1** | 45-min gym phone shoot practicality |
| **12. Structured Output Reliability** | 2 pts | **0** | **0** | Schema compliance and JSON validity |
| **TOTAL** | **100 pts** | **0 / 100** | **85 / 100** | |

---

## 3. Side-by-Side Creative Face-Off

### A. The 0–3 Second Hook
**Model A (Mistral Large 4):**
> *"No hook provided."*

**Model B (GPT-OSS-120B):**
> *""Rohit ne gym join ki, aur 15 din baad… *silence*" – a cliff‑hanger that forces the brain to stay, plus two alternative 3‑second hooks that attack motivation myths and swap office tea for kettlebells."*

**Judge Verdict on Hooks:**
> Model B wins. Its hook creates immediate curiosity and pattern‑interrupt, whereas Model A offers nothing.

---

### B. Visual Direction & Camera Work
**Model A (Mistral Large 4):**
> *"No visual direction supplied."*

**Model B (GPT-OSS-120B):**
> *"Detailed shot‑by‑shot plan: handheld push‑in, over‑the‑shoulder tracking, static wide with slow‑zoom, dolly‑in on chalkboard, fast cuts, and final slow‑motion close‑up. Each shot includes camera movement, on‑screen text, SFX cues and specific actions."*

**Judge Verdict on Visual Direction:**
> Model B is far more executable; the instructions are concrete enough to be filmed with a phone and minimal crew.

---

### C. Spoken Dialogue & Hinglish Cadence
**Judge Verdict on Script Realism:**
> Model B delivers authentic, punchy dialogue that matches the tough‑love brother persona. Model A has none.

---

## 4. Strengths & Critical Weaknesses

### Model A: Mistral Large 4
- **Key Strengths:**

- **Critical Weaknesses:**
  - Complete lack of content – no strategy, script, or visual plan.
  - Invalid JSON (no output at all).

### Model B: GPT-OSS-120B
- **Key Strengths:**
  - Deep strategic alignment with Vik’s personality‑first brand.
  - Clear 7‑day funnel progression from awareness to conversion.
  - Highly specific visual and audio directions ready for phone‑only production.
  - Authentic Hinglish script that captures Mumbai/Delhi gym banter.
- **Critical Weaknesses:**
  - Output contains curly quotes and other non‑JSON characters, making the payload invalid.
  - Production feasibility score reduced because the plan assumes an extra actor (Rohit) and multiple set‑ups that may stretch a 45‑minute shoot.

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
""
```

### Model B: GPT-OSS-120B Script
```json
"{\n  \"strategic_intelligence\": {\n    \"brand_moat_statement\": \"Vik ka unapologetic, no\u2011filter Mumbai\u2011Delhi gym vibe\u2014blunt, sarcastic, tough love\u2014creates a personality moat no fake influencer can copy. His Hinglish swagger makes every IronForge member feel like they\u2019re hanging out with a real gym bro, not a brand mascot, turning loyalty into a cultural badge.\",\n    \"audience_psychology_breakdown\": [\n      \"Day\u20114 DOMS guilt loop \u2013 muscles scream, mind makes excuses.\",\n      \"Day\u20118 \u2018office meeting\u2019 rationalisation \u2013 work > self\u2011care, hidden shame of feeling lazy.\",\n      \"Day\u201115 ghosting \u2013 internal narrative \u2018I\u2019m not cut out for gyms\u2019, protecting ego from failure.\"\n    ],\n    \"seven_day_content_arc\": [\n      {\n        \"day\": 1,\n        \"theme\": \"The First\u2011Day High\",\n        \"funnel_stage\": \"Awareness\",\n        \"core_concept\": \"Show the dopamine rush of buying gear and posting selfies, then smash it with Vik\u2019s \u2018stop pretending you\u2019re a model\u2019 line.\"\n      },\n      {\n        \"day\": 2,\n        \"theme\": \"DOMS Reality Check\",\n        \"funnel_stage\": \"Awareness\",\n        \"core_concept\": \"Vik walks through the gym, pointing out why sore muscles are normal, not a sign to quit.\"\n      },\n      {\n        \"day\": 3,\n        \"theme\": \"Excuse\u2011Busting Myth #1\",\n        \"funnel_stage\": \"Consideration\",\n        \"core_concept\": \"Contrarian take on \u2018I\u2019m too busy\u2019 \u2013 Vik shows a 5\u2011minute micro\u2011workout you can squeeze between meetings.\"\n      },\n      {\n        \"day\": 4,\n        \"theme\": \"The 15\u2011Day Friction Wall\",\n        \"funnel_stage\": \"Consideration\",\n        \"core_concept\": \"Explain the biology of habit formation and why 15 days feels like a wall, with Vik\u2019s tough\u2011love analogy.\"\n      },\n      {\n        \"day\": 5,\n        \"theme\": \"Social Proof \u2013 Real IronForge Stories\",\n        \"funnel_stage\": \"Consideration\",\n        \"core_concept\": \"Quick testimonials from members who smashed the 15\u2011day wall using Vik\u2019s method.\"\n      },\n      {\n        \"day\": 6,\n        \"theme\": \"Free 3\u2011Day Form Fix\",\n        \"funnel_stage\": \"Conversion\",\n        \"core_concept\": \"Offer a zero\u2011cost, on\u2011site form correction pass; Vik demonstrates a common mistake and fixes it.\"\n      },\n      {\n        \"day\": 7,\n        \"theme\": \"Commit\u2011Or\u2011Quit Challenge\",\n        \"funnel_stage\": \"Conversion\",\n        \"core_concept\": \"Launch a 15\u2011day \u201cNo\u2011Excuse\u201d challenge with a leaderboard; Vik calls out procrastinators live.\"\n      }\n    ]\n  },\n  \"creative_angles\": [\n    {\n      \"angle_name\": \"Angle 1 (Contrarian / Tough\u2011Love Monologue)\",\n      \"creative_concept\": \"Vik stands in front of a mirror, looks straight into the camera and rips apart the \u2018gym motivation\u2019 myth, calling out viewers by name with blunt humor.\",\n      \"hook_first_3_seconds\": \"\u201cAaj kal ka sabse bada fitness scam? \u2018Motivation\u2019 ka selfie!\u201d\",\n      \"why_it_works\": \"Triggers reactance by attacking a widely accepted belief, making viewers pause to defend themselves, then pulls them into Vik\u2019s authority.\"\n    },\n    {\n      \"angle_name\": \"Angle 2 (Humorous Sketch / Relatable Dialogue)\",\n      \"creative_concept\": \"Two friends in a office break\u2011room: one bragging about Day\u20112 gym selfie, the other groaning about DOMS. Vik barges in, swaps the coffee for a kettlebell and drops truth bombs.\",\n      \"hook_first_3_seconds\": \"\u201cOffice ki chai ko kettlebell se replace karte hain, bhai!\u201d\",\n      \"why_it_works\": \"Uses comedy to mirror the audience\u2019s daily excuse environment, then injects a vivid visual cue that sticks.\"\n    },\n    {\n      \"angle_name\": \"Angle 3 (Storytelling / The 15\u2011Day Trap)\",\n      \"creative_concept\": \"Mini\u2011narrative: Vik narrates a \u2018day\u2011by\u2011day\u2019 saga of a fictional rookie named \u2018Rohit\u2019 who crashes at Day\u201115, then rewinds to show the exact moment Vik could have saved him.\",\n      \"hook_first_3_seconds\": \"\u201cRohit ne gym join ki, aur 15 din baad\u2026 *silence*\u201d\",\n      \"why_it_works\": \"Creates a cliff\u2011hanger that forces the brain to stay, while the story mirrors the viewer\u2019s own timeline, generating empathy and urgency.\"\n    }\n  ],\n  \"production_execution_script\": {\n    \"chosen_angle\": \"Angle 3 (Storytelling / The 15\u2011Day Trap)\",\n    \"working_title\": \"\u201c15 Din Ka Gym Trap \u2013 Vik Ki Hard Truth\u201d\",\n    \"target_duration_seconds\": 55,\n    \"pacing\": \"Fast opening -> Relatable conversational middle -> Punchy hard\u2011hitting close\",\n    \"shot_by_shot\": [\n      {\n        \"shot_number\": 1,\n        \"timing\": \"0:00 - 0:03\",\n        \"camera_direction\": \"Handheld medium shot, close\u2011up on Vik\u2019s face, slight push\u2011in as he leans forward.\",\n        \"visual_action_and_broll\": \"Vik stands in IronForge\u2019s locker room, neon \u201815\u2011Day Wall\u2019 sign flickering behind him.\",\n        \"dialogue_hinglish\": \"\u201cRohit ne gym join ki, aur 15 din baad\u2026 *silence*\u201d\",\n        \"onscreen_text\": \"\u201c15\u2011Din Ka Gym Trap\u201d in bold, kinetic typography.\",\n        \"audio_sfx_cues\": \"Sharp beat drop, echo of a ticking clock.\"\n      },\n      {\n        \"shot_number\": 2,\n        \"timing\": \"0:04 - 0:10\",\n        \"camera_direction\": \"Cut to over\u2011the\u2011shoulder tracking shot following Rohit (actor) entering the gym, sweaty gym bag swinging.\",\n        \"visual_action_and_broll\": \"Rohit smiles, snaps a selfie, then lifts a barbell with exaggerated effort.\",\n        \"dialogue_hinglish\": \"Vik (voice\u2011over): \u201cDay\u20111 ka high, selfie se start, par body ko reality ka \u2018hello\u2019 milta hai.\u201d\",\n        \"onscreen_text\": \"\u201cDay\u20111: Hype\u201d flashing under the selfie.\",\n        \"audio_sfx_cues\": \"Upbeat synth, camera shutter sound.\"\n      },\n      {\n        \"shot_number\": 3,\n        \"timing\": \"0:11 - 0:20\",\n        \"camera_direction\": \"Static wide shot of the gym floor, slow\u2011zoom on Rohit\u2019s face grimacing during a squat.\",\n        \"visual_action_and_broll\": \"Close\u2011up of quads shaking, sweat droplets, then a quick cut to a calendar flipping to Day\u20114.\",\n        \"dialogue_hinglish\": \"Vik (on\u2011camera, now in the middle of the floor): \u201cDay\u20114 pe DOMS aata hai, aur tum sochte ho \u2018bas, enough!\u2019\u201d\",\n        \"onscreen_text\": \"\u201cDay\u20114: DOMS\u201d in red, shaking effect.\",\n        \"audio_sfx_cues\": \"Heavy bass thump, subtle groan sound.\"\n      },\n      {\n        \"shot_number\": 4,\n        \"timing\": \"0:21 - 0:30\",\n        \"camera_direction\": \"Handheld close\u2011up on Vik\u2019s hand grabbing a phone, scrolling through a meeting invite.\",\n        \"visual_action_and_broll\": \"Vik rolls his eyes, then flips the phone to reveal a 5\u2011minute kettlebell routine on screen.\",\n        \"dialogue_hinglish\": \"Vik: \u201cExcuse #1 \u2013 \u2018office meeting\u2019? Bhai, 5 minute kettlebell se meeting hi tod do.\u201d\",\n        \"onscreen_text\": \"\u201cExcuse #1: Too busy?\u201d with a crossed\u2011out icon.\",\n        \"audio_sfx_cues\": \u201cQuick whoosh, ticking timer.\u201d\n      },\n      {\n        \"shot_number\": 5,\n        \"timing\": \"0:31 - 0:40\",\n        \"camera_direction\": \"Dolly in on Vik standing beside a chalkboard that reads \u201815\u2011Din Wall\u2019 with a cracked line through it.\",\n        \"visual_action_and_broll\": \"Vik draws a simple habit loop diagram while gesturing.\",\n        \"dialogue_hinglish\": \"Vik: \u201cBiology bolti hai \u2013 15 din pe habit formation ka gate lock hota hai. Agar tum uss din nahi push karoge, toh\u2026 *pause* \u2026wall tumhe thok dega.\u201d\",\n        \"onscreen_text\": \u201c\u2018Break the wall\u2019 \u2013 animated hammer smashing the wall graphic.\",\n        \"audio_sfx_cues\": \u201cHammer strike SFX, rising synth.\u201d\n      },\n      {\n        \"shot_number\": 6,\n        \"timing\": \"0:41 - 0:50\",\n        \"camera_direction\": \"Fast cut to Vik holding a sign \u2018FREE 3\u2011Day Form Fix\u2019 while a member does a squat in the background.\",\n        \"visual_action_and_broll\": \"Member\u2019s form is corrected instantly; Vik winks at camera.\",\n        \"dialogue_hinglish\": \"Vik: \u201cAbhi free 3\u2011day form fix le, aur 15\u2011din ka trap se pehle hi nikal ja.\u201d\",\n        \"onscreen_text\": \u201cFree 3\u2011Day Form Fix \u2013 Swipe Up!\u201d in bold neon.\",\n        \"audio_sfx_cues\": \u201cUpbeat climax music, crowd cheer.\u201d\n      },\n      {\n        \"shot_number\": 7,\n        \"timing\": \"0:51 - 0:55\",\n        \"camera_direction\": \"Static close\u2011up on Vik\u2019s face, intense stare, slight slow\u2011motion.\",\n        \"visual_action_and_broll\": \"Vik points directly at the camera, background fades to IronForge logo.\",\n        \"dialogue_hinglish\": \"Vik: \u201cQuit karna asaan hai. Stay hard? Woh tumhara decision hai.\u201d\",\n        \"onscreen_text\": \u201c#NoExcuseChallenge\u201d flashing.\",\n        \"audio_sfx_cues\": \u201cFinal bass hit, then silence.\u201d\n      }\n    ],\n    \"cta\": {\n      \"spoken_dialogue\": \"\u201cComment \u2018READY\u2019 aur DM karo, free 3\u2011day form correction pass claim karne ke liye \u2013 bas aaj hi!\u201d\",\n      \"visual_action\": \"Vik holds up his phone, taps the screen, and the screen shows a quick swipe\u2011up animation.\",\n      \"offer_type\": \"Free 3\u2011day form correction pass (no credit card, instant booking via DM)\"\n    }\n  }\n}"
```
