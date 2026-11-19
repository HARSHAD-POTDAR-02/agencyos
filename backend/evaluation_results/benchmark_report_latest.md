# 🎯 Campaign Generation Evaluation Benchmark Report
**AgencyOS Creative Intelligence Engine — Frontier Model Assessment**
*Generated: 2026-11-19 01:34:15*

---

## 1. Executive Summary

| Metric / Dimension | Model A: Mistral Large 4 | Model B: GPT-OSS-120B |
| :--- | :--- | :--- |
| **Model ID** | `mistralai/mistral-large-4-1t-a52b` | `openai/gpt-oss-120b` |
| **Provider** | NVIDIA NIM | Groq LPU |
| **Generation Latency** | 218.43s | 6.41s |
| **Reasoning Captured** | 1681 chars | 1319 chars |
| **JSON Adherence** | ✅ Valid JSON | ✅ Valid JSON |
| **Total Benchmark Score** | **88 / 100** | **83 / 100** |

> ### 🏆 Final Benchmark Verdict
> **Winner:** **Model A**  
> **Key Finding:** Model A outperforms Model B with a higher total score (88 vs 83) thanks to a more disruptive hook, richer visual blueprint, and tighter, more authentic Hinglish cadence. While Model B offers a solid CTA, Model A’s strategic depth and execution detail make it the superior choice for driving walk‑ins for Vik’s IronForge gym. AgencyOS should adopt Model A’s script, tighten the CTA to a direct “Swipe/Scan now” prompt, and keep the detailed shot list for a seamless phone‑only production.

---

## 2. 12-Dimension Weighted Scorecard (100-Point Rubric)

| Dimension | Weight | Mistral Large 4 Score | GPT-OSS-120B Score | Core Distinction |
| :--- | :---: | :---: | :---: | :--- |
| **1. Strategic Intelligence** | 15 pts | **13** | **13** | Owner personality as moat & walk-in strategy |
| **2. Creative Originality** | 15 pts | **12** | **11** | Anti-cliché angles vs recycled fitness tropes |
| **3. Hook Quality** | 10 pts | **9** | **8** | 0-3s pattern interrupt & thumb-stopping tension |
| **4. Storytelling** | 10 pts | **9** | **8** | Progression, conflict, tension, payoff |
| **5. Script Quality** | 10 pts | **9** | **8** | Natural spoken Hinglish cadence & humor |
| **6. Visual Direction** | 10 pts | **9** | **8** | Camera angles, B-roll, movement vs vague filler |
| **7. Audience Psychology** | 10 pts | **9** | **8** | DOMS soreness, silent excuses, dopamine drop |
| **8. Campaign Diversity & Sequencing** | 8 pts | **7** | **7** | 7-day arc avoiding repetition |
| **9. Brand Voice Consistency** | 5 pts | **5** | **5** | Extroverted brother persona retention |
| **10. CTA Effectiveness** | 3 pts | **2** | **3** | Frictionless walk-in conversion bridge |
| **11. Production Feasibility** | 2 pts | **2** | **2** | 45-min gym phone shoot practicality |
| **12. Structured Output Reliability** | 2 pts | **2** | **2** | Schema compliance and JSON validity |
| **TOTAL** | **100 pts** | **88 / 100** | **83 / 100** | |

---

## 3. Side-by-Side Creative Face-Off

### A. The 0–3 Second Hook
**Model A (Mistral Large 4):**
> *"Tera gym ka safar 15 din ka hai. Uske baad tu gayab ho jata hai."*

**Model B (GPT-OSS-120B):**
> *"Gym chod diya? Sun, yeh 15 din ka dhokha sabko pakad leta hai!"*

**Judge Verdict on Hooks:**
> Model A wins. Its hook slams a stark, curiosity‑driving statement that flips the viewer’s self‑image in the first two seconds, creating a stronger pattern‑interrupt than Model B’s more conversational opener.

---

### B. Visual Direction & Camera Work
**Model A (Mistral Large 4):**
> *"Provides a granular shot‑by‑shot plan: handheld medium close‑up with low angle, tracking walk through equipment zones, precise on‑screen text cues, timed SFX (bass drops, record‑scratch, piano note). Every beat is mapped to a camera move, making the shoot executable with a phone and minimal crew."*

**Model B (GPT-OSS-120B):**
> *"Also offers a shot list but leans on broader descriptors ("static close‑up", "wide static shot", "over‑the‑shoulder handheld") and fewer concrete SFX timings. While doable, it leaves more interpretive gaps for the crew."*

**Judge Verdict on Visual Direction:**
> Model A’s visual direction is more detailed and production‑ready, thus more executable in a 45‑minute phone shoot.

---

### C. Spoken Dialogue & Hinglish Cadence
**Judge Verdict on Script Realism:**
> Model A sounds more authentic to Mumbai/Delhi gym banter and maintains a tighter cadence that better holds short‑form attention.

---

## 4. Strengths & Critical Weaknesses

### Model A: Mistral Large 4
- **Key Strengths:**
  - Laser‑sharp strategic framing that ties Vik’s personality directly to conversion.
  - Highly detailed visual and audio cues that are phone‑friendly.
  - Hook that instantly disrupts the scroll and creates curiosity.
- **Critical Weaknesses:**
  - CTA relies on “link in bio” which is a step removed; could be more immediate.
  - Slightly longer dialogue blocks risk overrunning the 55‑second slot if not trimmed.

### Model B: GPT-OSS-120B
- **Key Strengths:**
  - Very clear, low‑friction CTA with QR code and free 3‑day pass.
  - Strong brand moat statement and consistent tough‑love voice.
  - Well‑structured 7‑day funnel that ends with a concrete offer.
- **Critical Weaknesses:**
  - Creative angles feel a touch generic; less contrarian spark than Model A.
  - Visual direction lacks the granular timing that guarantees a smooth shoot.

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
{
  "strategic_intelligence": {
    "brand_moat_statement": "Vik's unfair moat is his refusal to play the 'inspiration porn' game. While every other trainer sells dopamine and detox teas, Vik sells biological truth wrapped in Mumbai street-smart tough love. His blunt Hinglish honesty acts as a trust filter\u2014only people ready for reality stick around, creating a high-intent community that converts because they feel seen, not sold to.",
    "audience_psychology_breakdown": [
      "Day 4 DOMS shame: The physical pain of delayed onset muscle soreness triggers panic that they are 'not built for this', creating immediate ego threat",
      "Day 8 corporate excuse: The first missed session due to office work creates a 'broken streak' narrative that justifies further absence",
      "Day 15 silent ghosting: The shame of quitting quietly without telling anyone, accompanied by the lie 'gym is not for me' to protect self-image"
    ],
    "seven_day_content_arc": [
      {
        "day": 1,
        "theme": "The Motivation Scam Exposed",
        "funnel_stage": "Awareness",
        "core_concept": "Vik confronts the viewer about why January 1st energy is fake dopamine, not discipline"
      },
      {
        "day": 2,
        "theme": "Day 4 Reality Check",
        "funnel_stage": "Awareness",
        "core_concept": "Raw talk about DOMS being normal, not a sign to quit"
      },
      {
        "day": 3,
        "theme": "The Office Meeting Lie",
        "funnel_stage": "Consideration",
        "core_concept": "Calling out how one skipped day becomes the excuse for ten more"
      },
      {
        "day": 4,
        "theme": "Why Gear Doesn't Matter",
        "funnel_stage": "Consideration",
        "core_concept": "Contrarian take that new shoes and selfies are procrastination, not progress"
      },
      {
        "day": 5,
        "theme": "The 15-Day Wall Explained",
        "funnel_stage": "Consideration",
        "core_concept": "Biological explanation of habit friction and why Day 15 is the danger zone"
      },
      {
        "day": 6,
        "theme": "Ghosting is Not Failure",
        "funnel_stage": "Consideration",
        "core_concept": "Empathetic reframe of quitting as data, not character flaw"
      },
      {
        "day": 7,
        "theme": "The IronForge Protocol",
        "funnel_stage": "Conversion",
        "core_concept": "Direct offer of the 15-day friction-breaking system with low-barrier entry"
      }
    ]
  },
  "creative_angles": [
    {
      "angle_name": "Angle 1 (Contrarian / Tough-Love Monologue)",
      "creative_concept": "Vik standing in gym, direct to camera, dismantling the motivation myth in real-time while pacing",
      "hook_first_3_seconds": "Bhai, tera motivation ek scam hai. Sunega ya nahi?",
      "why_it_works": "Pattern interrupts the 'you got this' positivity with a confrontational truth that triggers curiosity and slight defensiveness, forcing a stop-scroll"
    },
    {
      "angle_name": "Angle 2 (Humorous Sketch / Relatable Dialogue)",
      "creative_concept": "Vik plays both the excited newbie and the guilty quitter in a quick back-and-forth dialogue",
      "hook_first_3_seconds": "Day 1: 'Aaj se pakka!' Day 15: *phone on silent*",
      "why_it_works": "Visualizes the exact emotional journey the viewer recognizes in themselves, creating instant relatability through humor rather than shame"
    },
    {
      "angle_name": "Angle 3 (Storytelling / The 15-Day Trap)",
      "creative_concept": "Vik walks through gym zones representing Day 1, Day 4, Day 8, and Day 15, narrating the psychological drop-off",
      "hook_first_3_seconds": "Tera gym ka safar 15 din ka hai. Uske baad tu gayab ho jata hai.",
      "why_it_works": "Creates narrative tension by framing the gym journey as a ticking clock, leveraging loss aversion to make the viewer fear the Day 15 outcome"
    }
  ],
  "production_execution_script": {
    "chosen_angle": "Angle 3 (Storytelling / The 15-Day Trap)",
    "working_title": "The 15-Day Ghost Protocol",
    "target_duration_seconds": 55,
    "pacing": "Fast confrontational opening -> Walking narrative middle with escalating tension -> Hard-hitting static close with CTA",
    "shot_by_shot": [
      {
        "shot_number": 1,
        "timing": "0:00 - 0:04",
        "camera_direction": "Handheld medium close-up, slight low angle, Vik walking toward camera then stopping",
        "visual_action_and_broll": "Vik in black IronForge tee, gym floor background blurred, dumbbells rack visible behind",
        "dialogue_hinglish": "Tera gym ka safar exactly 15 din ka hai. Uske baad tu silently gayab ho jata hai.",
        "onscreen_text": "15 DIN. PHIR GHOST.",
        "audio_sfx_cues": "Hard bass drop on '15 din', gym ambient clanking in background"
      },
      {
        "shot_number": 2,
        "timing": "0:04 - 0:12",
        "camera_direction": "Static medium shot, Vik at squat rack area, direct eye contact",
        "visual_action_and_broll": "Vik leaning on rack, gesturing with hands, energetic but controlled",
        "dialogue_hinglish": "Day 1 pe tu aata hai, naya gear kharidta hai, selfie daalta hai. Sab bolte hain 'badhiya bhai!'",
        "onscreen_text": "DAY 1: GEAR + SELFIE = DOPAMINE",
        "audio_sfx_cues": "Camera shutter sound effect on 'selfie', upbeat trending audio snippet"
      },
      {
        "shot_number": 3,
        "timing": "0:12 - 0:22",
        "camera_direction": "Vik walks to treadmill area, camera follows in tracking shot",
        "visual_action_and_broll": "Walking past equipment, pointing at different zones, movement creates momentum",
        "dialogue_hinglish": "Day 4 pe DOMS maar raha hai. Tu sochta hai 'main nahi bana hoon gym ke liye.' Yehi pe tera pehla jhooth shuru hota hai.",
        "onscreen_text": "DAY 4: DOMS = PEHLA JHOOTH",
        "audio_sfx_cues": "Record scratch sound on 'jhooth', tension-building bass"
      },
      {
        "shot_number": 4,
        "timing": "0:22 - 0:32",
        "camera_direction": "Vik stops near bench press, turns back to camera, intense close-up",
        "visual_action_and_broll": "Hand on bench, leaning in, voice dropping lower for emphasis",
        "dialogue_hinglish": "Day 8 pe ek office meeting aa gaya. Ek din chhoot gaya. Ab tu sochta hai streak toot gayi, toh kya fayda? Yeh excuse mechanism hai.",
        "onscreen_text": "DAY 8: EK MISS = EXCUSE BAN GAYA",
        "audio_sfx_cues": "Dramatic sting on 'excuse mechanism', phone notification sound"
      },
      {
        "shot_number": 5,
        "timing": "0:32 - 0:42",
        "camera_direction": "Vik walks to empty corner of gym, slows down, camera static medium shot",
        "visual_action_and_broll": "Vik standing alone, looking at empty floor, quieter tone, empathetic but firm",
        "dialogue_hinglish": "Day 15 pe tu kuch nahi bolta. Kisi ko nahi batata. Bas gayab. Aur phir bolta hai 'gym mere liye nahi hai.' Yehi sabse bada jhooth hai.",
        "onscreen_text": "DAY 15: SILENT GHOSTING",
        "audio_sfx_cues": "Music drops to half volume, single piano note, silence beat"
      },
      {
        "shot_number": 6,
        "timing": "0:42 - 0:50",
        "camera_direction": "Vik turns back to camera, steps closer, medium close-up, direct address",
        "visual_action_and_broll": "Vik pointing at camera, intense eye contact, gym equipment behind",
        "dialogue_hinglish": "Lekin sun, 15 din ka wall biological hai, tere character ka test nahi. Tu fail nahi hua, system galat tha.",
        "onscreen_text": "15 DIN = BIOLOGY, NOT FAILURE",
        "audio_sfx_cues": "Music builds back up, hopeful but gritty beat"
      },
      {
        "shot_number": 7,
        "timing": "0:50 - 0:55",
        "camera_direction": "Static medium shot, Vik holding phone or pointing down, final push",
        "visual_action_and_broll": "Vik gestures to lower third, confident smile, ready stance",
        "dialogue_hinglish": "IronForge pe hum is 15-day trap ko todte hain. Link in bio. Aaj se nahi, abhi shuru kar.",
        "onscreen_text": "IRONFORGE 15-DAY PROTOCOL - LINK IN BIO",
        "audio_sfx_cues": "Final bass hit, 'link in bio' vocal chop"
      }
    ],
    "cta": {
      "spoken_dialogue": "IronForge pe hum is 15-day trap ko todte hain. Link in bio. Aaj se nahi, abhi shuru kar.",
      "visual_action": "Vik points down toward bio link area, then gives thumbs up while maintaining eye contact",
      "offer_type": "Free 15-Day Friction-Breaker Assessment (low-commitment diagnostic that leads to paid program)"
    }
  }
}
```

### Model B: GPT-OSS-120B Script
```json
{
  "strategic_intelligence": {
    "brand_moat_statement": "Vik ka raw, no\u2011filter Hinglish aur contrarian swagger ek aisa DNA banata hai jo fake influencers ko bhagata hai, isliye log sirf IronForge ko \u2018real\u2019 ke liye yaad rakhte hain \u2013 yeh emotional moat competitors ko copy karna mushkil banata hai.",
    "audience_psychology_breakdown": [
      "Day 4 DOMS shame \u2013 pehle din ka high ke baad muscle pain aata hai, log sochte hain 'main weak hoon' aur self\u2011doubt hota hai.",
      "Day 8 corporate meeting excuse \u2013 kaam ka pressure aata hai, gym ko 'time waste' label milta hai, guilt aur procrastination ka combo.",
      "Day 15 quiet ghosting \u2013 internal voice kehti hai 'gym mere liye nahi', ego defence ke roop mein self\u2011labeling as a failure."
    ],
    "seven_day_content_arc": [
      {
        "day": 1,
        "theme": "Kick\u2011off Shock \u2013 Why the hype dies fast",
        "funnel_stage": "Awareness",
        "core_concept": "Vik confronts the viewer with the brutal truth that motivation spikes are a trap."
      },
      {
        "day": 2,
        "theme": "DOMS Reality Check",
        "funnel_stage": "Awareness",
        "core_concept": "Show the pain of Day\u202f4, debunk the myth that soreness = failure."
      },
      {
        "day": 3,
        "theme": "Excuse Anatomy \u2013 Corporate vs. Gym",
        "funnel_stage": "Consideration",
        "core_concept": "Break down the Day\u202f8 meeting excuse and replace it with a micro\u2011habit hack."
      },
      {
        "day": 4,
        "theme": "Social Proof Flip \u2013 Real vs. Insta\u2011Fit",
        "funnel_stage": "Consideration",
        "core_concept": "Vik exposes fake influencers and shows why real results need grit, not filters."
      },
      {
        "day": 5,
        "theme": "15\u2011Day Trap Map",
        "funnel_stage": "Consideration",
        "core_concept": "Visual timeline of the friction wall, positioning IronForge as the only guide through it."
      },
      {
        "day": 6,
        "theme": "Tough\u2011Love Mini\u2011Challenge",
        "funnel_stage": "Conversion",
        "core_concept": "Invite audience to a 3\u2011day form\u2011correction sprint, low barrier, high payoff."
      },
      {
        "day": 7,
        "theme": "Conversion Close \u2013 Join the IronForge Tribe",
        "funnel_stage": "Conversion",
        "core_concept": "Vik delivers a hard\u2011hitting CTA that flips guilt into pride."
      }
    ]
  },
  "creative_angles": [
    {
      "angle_name": "Contrarian Tough\u2011Love Monologue",
      "creative_concept": "Vik stands in the middle of the gym, raw lighting, delivering a 45\u2011second rant that smashes the 'motivation' myth and forces viewers to own their excuses.",
      "hook_first_3_seconds": "Gym chod diya? Sun, yeh 15 din ka dhokha sabko pakad leta hai!",
      "why_it_works": "Immediate challenge triggers reactance; viewers feel personally called out, which spikes attention and makes the brain seek resolution."
    },
    {
      "angle_name": "Humorous Sketch: Excuse Buster",
      "creative_concept": "Two actors \u2013 'Office Vik' and 'Gym Vik' \u2013 argue over a calendar. The sketch uses exaggerated office props and gym gear to mock common excuses, ending with Vik\u2019s blunt punchline.",
      "hook_first_3_seconds": "Boss ne bola \u2018meeting\u2019? Gym ka time kaun chhodega?",
      "why_it_works": "Relatable comedy lowers defenses, while the contrast between office and gym visualizes the excuse, making the pain point memorable."
    },
    {
      "angle_name": "Storytelling: The 15\u2011Day Trap",
      "creative_concept": "A mini\u2011narrative follows a nameless newbie from Day\u202f1 hype to Day\u202f15 ghosting, narrated by Vik in voice\u2011over, intercut with real\u2011time gym footage.",
      "hook_first_3_seconds": "Kal se gym, aaj tak koi progress? Yeh 15\u2011din ka jaal tumhe khud hi pakad lega.",
      "why_it_works": "Story arcs create emotional transport; viewers see themselves in the protagonist, increasing empathy and readiness to act."
    }
  ],
  "production_execution_script": {
    "chosen_angle": "Contrarian Tough\u2011Love Monologue",
    "working_title": "15\u2011Din Ka Dhokha \u2013 Vik Ka Real Talk",
    "target_duration_seconds": 55,
    "pacing": "Fast opening -> Relatable conversational middle -> Punchy hard\u2011hitting close",
    "shot_by_shot": [
      {
        "shot_number": 1,
        "timing": "0:00 - 0:03",
        "camera_direction": "Handheld medium shot, slight push\u2011in on Vik's face, low\u2011key gym lighting, background of empty racks.",
        "visual_action_and_broll": "Vik stares straight at camera, sweat glistening, drops a dumbbell that clatters.",
        "dialogue_hinglish": "Gym chod diya? Sun, yeh 15 din ka dhokha sabko pakad leta hai!",
        "onscreen_text": "15\u2011Din Ka Dhokha?",
        "audio_sfx_cues": "Sharp metal clang, bass\u2011heavy beat drops at 0:02"
      },
      {
        "shot_number": 2,
        "timing": "0:04 - 0:12",
        "camera_direction": "Cut to wide static shot, Vik walks past a row of mirrors, camera follows from side.",
        "visual_action_and_broll": "Vik gestures to his reflection, B\u2011roll of a newbie flexing and then grimacing in pain (Day\u202f4 DOMS).",
        "dialogue_hinglish": "Pehle din ka high, phir 4 din baad ki dard bhari reality \u2013 'main weak hoon' ka chorus repeat hota hai.",
        "onscreen_text": "Day\u202f4: DOMS = Doubt",
        "audio_sfx_cues": "Subtle heartbeat thump, faint gym ambience"
      },
      {
        "shot_number": 3,
        "timing": "0:13 - 0:22",
        "camera_direction": "Over\u2011the\u2011shoulder handheld, Vik pulls a calendar off a wall, flips to Day\u202f8.",
        "visual_action_and_broll": "Close\u2011up of calendar with a red circle on a meeting icon, cut to a laptop screen with a Zoom call overlay.",
        "dialogue_hinglish": "Day\u202f8 \u2013 boss ne bola 'meeting', aur tum gym ko 'busy' label de dete ho. Yeh excuse kaam nahi karta, bhai!",
        "onscreen_text": "Excuse #1: Corporate Meeting",
        "audio_sfx_cues": "Notification ping, slight sigh"
      },
      {
        "shot_number": 4,
        "timing": "0:23 - 0:35",
        "camera_direction": "Static close\u2011up on Vik, slight dolly out to reveal a whiteboard titled '15\u2011Din Trap'.",
        "visual_action_and_broll": "Vik draws a simple timeline: 1\ufe0f\u20e3 hype \u2192 4\ufe0f\u20e3 pain \u2192 8\ufe0f\u20e3 excuse \u2192 15\ufe0f\u20e3 ghost. B\u2011roll of a phone with no new gym posts.",
        "dialogue_hinglish": "Aur Day\u202f15? Ghost mode activate. Log sochte hain 'gym mere liye nahi', par asal mein wo sirf apni comfort zone mein phas gaye hain.",
        "onscreen_text": "Day\u202f15: Ghosting",
        "audio_sfx_cues": "Low rumble, ticking clock"
      },
      {
        "shot_number": 5,
        "timing": "0:36 - 0:45",
        "camera_direction": "Handheld low angle, Vik steps onto a squat rack, grabs a bar, lifts slightly.",
        "visual_action_and_broll": "Quick cut to a member getting form\u2011corrected by Vik, high\u2011energy smile.",
        "dialogue_hinglish": "Solution? Chhote micro\u2011habits, form correction, aur sirf 3 din ka free pass. No hype, sirf hard work.",
        "onscreen_text": "Free 3\u2011Day Form Fix",
        "audio_sfx_cues": "Clank of plates, upbeat drum loop"
      },
      {
        "shot_number": 6,
        "timing": "0:46 - 0:55",
        "camera_direction": "Static front shot, Vik faces camera, eyes locked, slight zoom at 0:50.",
        "visual_action_and_broll": "Vik points to a QR code on screen, background shows IronForge logo lit neon.",
        "dialogue_hinglish": "Abhi swipe karo, free pass le lo, aur 15\u2011din ka dhokha tod do. Real results, no filter.",
        "onscreen_text": "Swipe \u279c Free 3\u2011Day Pass",
        "audio_sfx_cues": "Music peaks, whoosh as QR appears"
      }
    ],
    "cta": {
      "spoken_dialogue": "Bas ek click, free 3\u2011din ka form correction pass \u2013 abhi le lo, aur apni kahani ko phir se likho!",
      "visual_action": "Vik holds up his phone, taps the screen, and points to the QR code while nodding confidently.",
      "offer_type": "Free 3\u2011day form correction pass (no credit card required)"
    }
  }
}
```
