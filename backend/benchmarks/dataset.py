"""
AgencyOS Campaign Benchmark Dataset
-----------------------------------
10 Fixed Standardized Client Briefs covering diverse industries, audience psychologies,
factual boundaries, and personality archetypes for objective regression benchmarking.
"""

from typing import Dict, Any, List

BENCHMARK_DATASET: List[Dict[str, Any]] = [
    {
        "id": "gym_extrovert",
        "category": "High-Intensity Fitness (Extroverted Personal Brand)",
        "brand_name": "IronForge Fitness & Performance",
        "persona": {
            "name": "Vikram 'Vik' Sharma",
            "role": "Owner & Head Coach (Age 32)",
            "voice": "Extroverted, fiercely energetic, blunt, charismatic, contrarian. Natural Mumbai/Delhi Hinglish, authentic tough-love humor, no corporate slogans.",
            "avoid_voice": "Generic influencer quotes ('Never give up', 'Believe in yourself', 'Stay consistent')."
        },
        "target_audience": {
            "profile": "22-38 year old working professionals, IT employees, desk workers.",
            "pain_points": "High dopamine on Day 1; severe DOMS soreness on Day 4; office meeting on Day 8 breaking streak; quiet ghosting on Day 15 with internal excuse 'gym isn't for me'.",
            "hidden_fear": "Ego defense: Admitting failure feels worse than pretending they are 'too busy'."
        },
        "topic": "Why 90% of people quit the gym after 15 days",
        "verified_facts": [
            "Facility: Functional strength, free weights, Olympic lifting racks, air-conditioned turf.",
            "Actual Offer: Verified 3-Day Form Correction Pass (walk-in trial, form audit, movement diagnostic).",
            "Location: Bandra West, Mumbai."
        ],
        "unverified_prohibitions": [
            "DO NOT invent discounts (e.g. '50% off this week').",
            "DO NOT invent fabricated transformation claims (e.g. 'Lose 10kg in 15 days').",
            "DO NOT invent fictional celebrity clients."
        ],
        "negative_constraints": [
            "No generic listicles ('5 reasons why people quit').",
            "No cheesy motivational quotes.",
            "No vague visual filler ('Cinematic gym shots with energetic music')."
        ]
    },
    {
        "id": "skincare_clinical",
        "category": "Premium Clinical Skincare",
        "brand_name": "Kavach Clinical Skincare",
        "persona": {
            "name": "Dr. Aanya Mehta",
            "role": "Dermatologist & Biochemist",
            "voice": "Calm, elegant, surgical, authoritative. Speaks like a research scientist explaining cellular biology, not a beauty influencer.",
            "avoid_voice": "Influencer hype ('Glow like a goddess', 'Glass skin secret revealed', tapping bottles on microphones)."
        },
        "target_audience": {
            "profile": "25-42 working women with damaged skin barriers caused by layering too many active acids.",
            "pain_points": "Stinging after washing face, sudden breakouts despite 8-step routine, redness, peeling from excessive retinol and AHA/BHA.",
            "hidden_fear": "Wasting money on expensive products that are secretly making their skin worse."
        },
        "topic": "Why your 10-step skincare routine is actively destroying your skin barrier",
        "verified_facts": [
            "Key Product: Barrier Fortify Peptide Serum (Price: ₹3,200 / 30ml).",
            "Key Active Ingredients: 5-Ceramide Complex (1:3:1 ratio), Copper Tripeptide-1, Centella Asiatica.",
            "Verified Claim: Clinically tested to restore lipid barrier integrity in 14 days without comedogenic occlusion.",
            "Actual Offer: Free 2-minute barrier assessment quiz leading to personalized ingredient recommendation."
        ],
        "unverified_prohibitions": [
            "DO NOT claim it cures acne, eczema, or psoriasis (medical claim).",
            "DO NOT invent discounts, free bottles, or BOGO deals."
        ],
        "negative_constraints": [
            "No before/after promises that violate medical advertising ethics.",
            "No tapping bottles, ASMR, or generic beauty aesthetic filler."
        ]
    },
    {
        "id": "restaurant_heritage",
        "category": "Local Heritage Restaurant",
        "brand_name": "Bawarchi Legacy Kitchen",
        "persona": {
            "name": "Chef Samar Qureshi",
            "role": "4th-Generation Lucknowi Khansama",
            "voice": "Deeply passionate, reverent about craft, sensory, proud, hospitable. Speaks with quiet culinary authority and love for slow firewood dum.",
            "avoid_voice": "Food-vlogger clichés ('Foodies assemble!', 'Cheesy pull!', 'Wait till the end!')."
        },
        "target_audience": {
            "profile": "Food connoisseurs, multi-generational families, and weekend diners tired of reheated cloud-kitchen biryani.",
            "pain_points": "Biryani delivered in 15 minutes that is clearly pre-cooked dry chicken mixed with colored rice; lack of genuine aroma and collagen richness.",
            "hidden_fear": "Losing real heritage culinary culture to industrialized shortcuts."
        },
        "topic": "The 6-hour firewood dum process that cloud kitchens physically cannot fake",
        "verified_facts": [
            "Method: Handi sealed with whole wheat dough, slow-cooked over wood and charcoal embers for 6 hours.",
            "Ingredients: Aged long-grain basmati, cold-pressed mustard oil, whole hand-pounded spices, ghee from local dairy.",
            "Location & Capacity: Flagship dining hall in Pune (Koregaon Park), 80 seats, fresh batch unsealed daily at 12:30 PM and 7:30 PM.",
            "Actual Offer: Weekend table reservation via phone or Google Maps."
        ],
        "unverified_prohibitions": [
            "DO NOT invent delivery discounts ('Use code BIRYANI50').",
            "DO NOT claim secret Mughal royal family recipes unless verified."
        ],
        "negative_constraints": [
            "No EDM or fast pop music cues.",
            "No generic food montages without specific culinary actions."
        ]
    },
    {
        "id": "real_estate_advisor",
        "category": "Luxury Real Estate Advisory",
        "brand_name": "Veritas Property Advisory",
        "persona": {
            "name": "Karan Malhotra",
            "role": "Senior Property Wealth Advisor (Ex-Investment Banker)",
            "voice": "Analytical, transparent, numbers-driven, skeptical of builder marketing. Talks like an equity portfolio manager assessing risk.",
            "avoid_voice": "Real estate broker tropes ('Your dream home awaits!', waving keys at camera, luxury hype words)."
        },
        "target_audience": {
            "profile": "First-time luxury homebuyers and senior corporate executives (budget ₹1.5 Cr – ₹4 Cr) in Mumbai & Gurugram.",
            "pain_points": "Confusion between Carpet Area vs Built-Up vs Super Built-Up; fear of hidden builder charges, delayed OC, and phantom amenities.",
            "hidden_fear": "Committing life savings to an illiquid asset with hidden legal or structural flaws."
        },
        "topic": "The 'Super Built-Up' scam: How builders legally charge you for 300 sq ft of thin air",
        "verified_facts": [
            "Service: Independent buyer-side property due diligence, carpet area verification, RERA legal audit.",
            "Fee Structure: Flat fee advisory, zero builder kickbacks or commissions.",
            "Actual Offer: Free 15-Minute Builder Payment Plan Audit via WhatsApp review."
        ],
        "unverified_prohibitions": [
            "DO NOT promise guaranteed capital appreciation percentages.",
            "DO NOT name specific real estate developers as 'fraudulent' (legal liability)."
        ],
        "negative_constraints": [
            "No generic drone shots of glass skyscrapers without analysis.",
            "No emotional appeals about 'family warmth'."
        ]
    },
    {
        "id": "b2b_saas",
        "category": "B2B Enterprise SaaS",
        "brand_name": "PipelinePulse",
        "persona": {
            "name": "Rohan Deshmukh",
            "role": "Founder & CEO (Ex-VP of Enterprise Sales)",
            "voice": "Battle-tested, blunt, pragmatic, empathetic to sales reps. Despises administrative CRM bloat and imaginary pipeline forecasts.",
            "avoid_voice": "SaaS buzzword soup ('Paradigm-shifting AI synergy', 'Empowering seamless workflows')."
        },
        "target_audience": {
            "profile": "B2B Chief Revenue Officers (CROs) and VPs of Sales managing 20+ quota-carrying account executives.",
            "pain_points": "Reps marking deals 'Closing This Month' to avoid weekly forecast grillings; 35% of forecasted pipeline slipping or going dark in the final 10 days.",
            "hidden_fear": "Missing board-level quarterly revenue targets and losing credibility with investors."
        },
        "topic": "Why 70% of deals marked 'Closing This Month' are already dead (and reps are lying to your CRM)",
        "verified_facts": [
            "Product: Autonomous deal telemetry engine that analyzes email engagement, calendar invites, and legal redlines.",
            "Integration: Native bi-directional sync with Salesforce and HubSpot.",
            "Verified Metric: Flags dead deals 18 days earlier than manual rep reporting.",
            "Actual Offer: Live 15-Minute Pipeline Ghost Audit on client's actual CRM data."
        ],
        "unverified_prohibitions": [
            "DO NOT invent customer logos (e.g. 'Used by Microsoft and Google').",
            "DO NOT claim '100% forecast accuracy'."
        ],
        "negative_constraints": [
            "No cartoon explainer animations.",
            "No generic questions ('Are you struggling to hit your sales quota?')."
        ]
    },
    {
        "id": "trainer_introvert",
        "category": "Introverted Personal Trainer (Biomechanics & Posture)",
        "brand_name": "QuietStrength Movement Lab",
        "persona": {
            "name": "Arjun Nair",
            "role": "Biomechanics & Rehabilitation Specialist",
            "voice": "Quiet, surgical, soft-spoken, analytical, empathetic. Hates gym screaming, bro-culture, and mirror flexing. Speaks with anatomical precision.",
            "avoid_voice": "Shouting ('Let's go beast mode!', 'One more rep!', high-fives, aggressive EDM drops)."
        },
        "target_audience": {
            "profile": "Desk workers (software engineers, lawyers, writers) with chronic lower back compression and anterior pelvic tilt.",
            "pain_points": "Chronic dull lower back ache after sitting 8 hours; commercial gym trainers forcing heavy squats/deadlifts that aggravate lumbar pain.",
            "hidden_fear": "Feeling intimidated by loud gym environments and worrying they are permanently damaged."
        },
        "topic": "Why screaming 'one more rep' is worsening your lower back compression",
        "verified_facts": [
            "Facility: Private 1-on-1 movement studio (zero crowded machines, quiet acoustic treatment).",
            "Method: Joint de-rotation, transverse abdominis activation, pelvic re-alignment.",
            "Actual Offer: 1-on-1 Biomechanics & Spinal Compression Diagnostic (in-studio or virtual assessment)."
        ],
        "unverified_prohibitions": [
            "DO NOT claim to cure medical disc herniations without physician oversight.",
            "DO NOT promise 'zero pain in 24 hours'."
        ],
        "negative_constraints": [
            "No loud audio or sudden noise cues.",
            "No aggressive body language or gym-bro posturing."
        ]
    },
    {
        "id": "d2c_apparel",
        "category": "D2C Ethical & Sustainable Apparel",
        "brand_name": "Tantu Sutra",
        "persona": {
            "name": "Meera Sen",
            "role": "Textile Designer & Co-Founder",
            "voice": "Artisanal, thoughtful, tactile, transparent, grounded. Anti-fast-fashion, skeptical of greenwashing certificates, deep respect for handloom weavers.",
            "avoid_voice": "Greenwashing buzzwords ('Eco-friendly miracle', 'Save the planet with a t-shirt', guilt-tripping)."
        },
        "target_audience": {
            "profile": "24-40 urban conscious consumers who love minimalist linen/cotton but distrust fast-fashion 'sustainable collections'.",
            "pain_points": "Buying '100% cotton' shirts that pill, shrink, and tear after 4 washes; seeing synthetic polyester disguised as eco-wear.",
            "hidden_fear": "Being duped by greenwashing marketing while paying premium prices."
        },
        "topic": "Why your '100% organic' cotton t-shirt is mostly microplastics and chemical sizing",
        "verified_facts": [
            "Craft: Rain-fed Kala cotton hand-spun on traditional charkhas in Kutch, Gujarat.",
            "Dyes: 100% botanical plant dyes (madder root, indigo, marigold extract) with zero synthetic azo chemicals.",
            "Longevity: Pre-washed with natural bio-enzymes; guaranteed 50+ wash lifecycle without pilling.",
            "Actual Offer: Sample Fabric Swatch Card & Transparent Production Dossier with first order."
        ],
        "unverified_prohibitions": [
            "DO NOT claim 'Carbon Negative' unless officially certified.",
            "DO NOT invent flash-sale countdown timers."
        ],
        "negative_constraints": [
            "No fast-paced TikTok trend dances.",
            "No preachiness or moral superiority."
        ]
    },
    {
        "id": "fintech_wealth",
        "category": "Fintech & Algorithmic Wealth Advisory",
        "brand_name": "DhanMarg Advisory",
        "persona": {
            "name": "Prateek Bansal",
            "role": "Chartered Financial Analyst (CFA) & Co-Founder",
            "voice": "Pragmatic, disciplined, protective, contrarian. Calls out Telegram stock tip scams and F&O gambling culture with calm mathematical proofs.",
            "avoid_voice": "Get-rich-quick hype ('Make 1 Lakh daily!', 'Secret multibagger stock tip', Lamborghinis)."
        },
        "target_audience": {
            "profile": "23-35 salaried professionals in Tier 1 & Tier 2 cities lured into Futures & Options (F&O) trading who lost money.",
            "pain_points": "Losing ₹50,000 to ₹3 Lakhs chasing FinFluencer option-buying screenshots; anxiety and hidden shame over trading losses.",
            "hidden_fear": "Admitting trading losses to family; fear that disciplined wealth creation takes too long."
        },
        "topic": "Why 93% of retail traders lose money in F&O (and why your FinFluencer is paid to lie to you)",
        "verified_facts": [
            "Credential: SEBI Registered Investment Advisory (RIA).",
            "Core Product: Automated index-based systematic asset allocation portfolios (equity + debt + gold).",
            "SEBI Verified Statistic: Official SEBI study shows 93% of individual retail traders made average net losses of ₹1.25 Lakhs in F&O.",
            "Actual Offer: Free SEBI-Compliant Risk Tolerance & Portfolio Leakage Health Check."
        ],
        "unverified_prohibitions": [
            "DO NOT promise specific annual percentage returns (e.g. 'Guaranteed 25% CAGR').",
            "DO NOT provide individual stock buy/sell tips (regulatory violation)."
        ],
        "negative_constraints": [
            "No screenshots of fake trading profits.",
            "No flashy luxury aesthetic or crypto hype."
        ]
    },
    {
        "id": "pediatric_dental",
        "category": "Specialty Pediatric Dental Clinic",
        "brand_name": "LittleSmile Dental Sanctuary",
        "persona": {
            "name": "Dr. Ritika Roy",
            "role": "Pediatric Dentist & Child Psychology Specialist",
            "voice": "Gentle, reassuring, empathetic, playful yet scientifically rigorous. Speaks to anxious parents with deep compassion and zero judgment.",
            "avoid_voice": "Clinical intimidation, scary dental jargon, parent-shaming ('You ruined your child's teeth')."
        },
        "target_audience": {
            "profile": "First-time parents of toddlers and young children (ages 2–9) facing first cavity or thumb-sucking issues.",
            "pain_points": "Child having screaming meltdowns at dental clinics; parents feeling guilty and embarrassed about early childhood caries.",
            "hidden_fear": "Traumatizing their child for life with a painful dental procedure."
        },
        "topic": "Why telling your child 'the doctor won't hurt you' guarantees a dental meltdown",
        "verified_facts": [
            "Environment: Sensory-adapted clinic with noise-canceling headphones, ceiling cartoon screens, and zero visible needles.",
            "Technique: 'Tell-Show-Do' pediatric behavioral shaping with needle-free computerized wand anesthesia.",
            "Actual Offer: The Gentle First-Visit Discovery Session (zero drills, tour of dental chair, toy reward, parental guidance)."
        ],
        "unverified_prohibitions": [
            "DO NOT invent discounts on medical surgery.",
            "DO NOT promise painless treatment for severe infections without diagnosis."
        ],
        "negative_constraints": [
            "No graphic images of decayed teeth.",
            "No parental guilt-tripping."
        ]
    },
    {
        "id": "industrial_robotics",
        "category": "B2B Industrial Robotics & Warehouse Automation",
        "brand_name": "KineticsWare Robotics",
        "persona": {
            "name": "Vikramaditya Rao",
            "role": "Chief Automation Architect & Mechanical Engineer",
            "voice": "Technical, rigorous, industrial, ROI-driven, uncompromising on safety and throughput metrics. Talks like a seasoned plant manager.",
            "avoid_voice": "Futuristic sci-fi hype ('Robots taking over the world!', flashy tech buzzwords without throughput specs)."
        },
        "target_audience": {
            "profile": "Vice Presidents of Supply Chain, Logistics Directors, and Manufacturing Plant Heads in E-commerce and FMCG.",
            "pain_points": "Warehouse order picking bottlenecks during peak season; high labor turnover; safety incidents with manual forklifts.",
            "hidden_fear": "Spending ₹2 Crore on automated guided vehicles (AGVs) that halt operations due to software bugs."
        },
        "topic": "Why standard AGVs crash during holiday peak volume (and the single payload metric engineers miss)",
        "verified_facts": [
            "Hardware: Heavy-duty Autonomous Mobile Robots (AMRs) with LiDAR + 3D SLAM vision and dynamic obstacle rerouting.",
            "Throughput Spec: 99.98% uptime at 2.2 meters/second carrying up to 1,200 kg payloads.",
            "Deployment: Zero facility infrastructure modifications (no floor magnetic tape, no ceiling QR codes required).",
            "Actual Offer: Free Warehouse Throughput & Bottleneck Simulation Study using client's facility CAD layout."
        ],
        "unverified_prohibitions": [
            "DO NOT claim complete elimination of all human workforce (societal/union sensitivity).",
            "DO NOT invent pricing without custom engineering scoping."
        ],
        "negative_constraints": [
            "No cheesy stock footage of smiling workers with clipboards.",
            "No sci-fi movie sound effects."
        ]
    }
]
