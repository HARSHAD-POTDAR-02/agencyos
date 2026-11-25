"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  TrendingUp,
  BarChart2,
  Compass,
  PenTool,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  GitBranch,
  ChevronRight,
} from "lucide-react";

export type SwarmClientKey = "solis" | "linden" | "cairn";

interface ClientArtifact {
  inputSummary: string;
  outputSummary: string;
  revisionNote?: string;
  latency: string;
}

interface AgentNodeSpec {
  id: string;
  num: string;
  name: string;
  stageLabel: string;
  headline: string;
  inputsRead: string[];
  responsibility: string;
  icon: React.ComponentType<{ className?: string }>;
  artifacts: Record<SwarmClientKey, ClientArtifact>;
}

const CLIENT_OPTIONS: { key: SwarmClientKey; name: string; campaign: string }[] = [
  { key: "solis", name: "Osteria Solis", campaign: "Winter Truffle Tasting Launch" },
  { key: "linden", name: "Linden & Clay", campaign: "Botanical Elixir Batch 09" },
  { key: "cairn", name: "Cairn Roasters", campaign: "Highland Anaerobic Micro-Lot" },
];

const AGENT_NODES: AgentNodeSpec[] = [
  {
    id: "brand",
    num: "01",
    name: "Brand Intelligence",
    stageLabel: "Entry Node · Grounding",
    headline: "Loads the client's real rules before any research begins.",
    inputsRead: ["Cortex Brand Guidelines", "Forbidden Taboo Rules", "Verified Menu / SKU Catalog"],
    responsibility:
      "Distills brand voice, banned phrases, legal boundaries, and verified pricing into a strict grounding brief so downstream agents cannot invent off-brand claims.",
    icon: Brain,
    artifacts: {
      solis: {
        inputSummary: "14 Cortex rules · Winter hearth menu catalog",
        outputSummary:
          "Enforced TABOO-01 (no health/therapeutic food claims) and RULE-04 (never discount wood-fired tasting tables). Locked warm, unhurried hospitality voice.",
        latency: "1.4s",
      },
      linden: {
        inputSummary: "18 Cortex rules · Batch 09 apothecary sheet",
        outputSummary:
          "Enforced TABOO-02 (no synthetic-brand attacks) and RULE-05 (recyclable amber glass callout required on every launch asset).",
        latency: "1.3s",
      },
      cairn: {
        inputSummary: "11 Cortex rules · Roast harvest ledger",
        outputSummary:
          "Enforced RULE-03 (exact roast window within 48h of dispatch) and banned generic freshness slogans across all captions.",
        latency: "1.2s",
      },
    },
  },
  {
    id: "market",
    num: "02",
    name: "Market & Trend Research",
    stageLabel: "Parallel Lane A · Live Context",
    headline: "Scans category hooks and visual pacing in parallel.",
    inputsRead: ["Brand Intelligence Brief", "Category Hook Benchmarks", "Current Format Velocity"],
    responsibility:
      "Runs concurrently with Historical Performance to pinpoint what captures attention in the client's niche right now without copying generic competitor tropes.",
    icon: TrendingUp,
    artifacts: {
      solis: {
        inputSummary: "Fine dining short-form hooks · Q4 hospitality shifts",
        outputSummary:
          "Identified 0–3s sensory table-side truffle shave reveal outperforming spoken chef intros by 2.4x in early retention.",
        latency: "2.1s",
      },
      linden: {
        inputSummary: "Clean skincare ritual visuals · Morning routine hooks",
        outputSummary:
          "Pinpointed quiet sunlit glass-dropper macros winning saves over fast-cut clinical ingredient breakdowns.",
        latency: "2.0s",
      },
      cairn: {
        inputSummary: "Specialty coffee ASMR & origin storytelling",
        outputSummary:
          "Identified acoustic kettle-bloom close-ups + cooperative elevation coordinates driving strongest bookmark share.",
        latency: "1.9s",
      },
    },
  },
  {
    id: "performance",
    num: "03",
    name: "Historical Performance",
    stageLabel: "Parallel Lane B · Account Proof",
    headline: "Audits what actually converted on this client's past posts.",
    inputsRead: ["Brand Intelligence Brief", "90-Day Post Metrics", "Save & Format Fatigue Curves"],
    responsibility:
      "Runs in parallel with Market Research to extract past winners, detect format fatigue, and lock the highest-converting publish windows for this specific account.",
    icon: BarChart2,
    artifacts: {
      solis: {
        inputSummary: "42 historical Osteria Solis posts",
        outputSummary:
          "4:5 tactile carousels on Thursday 18:30 achieved 6.8% save rate; mid-week text quotes dropped 41% below baseline.",
        latency: "1.8s",
      },
      linden: {
        inputSummary: "36 historical Linden & Clay posts",
        outputSummary:
          "Ingredient ritual reels paired with calm 5-slide FAQ carousels held 8.2% save velocity and generated 3x profile clicks.",
        latency: "1.7s",
      },
      cairn: {
        inputSummary: "29 historical Cairn Roasters posts",
        outputSummary:
          "Dial-in recipe carousels published Friday mornings drove 54% more subscription link taps than roast-bag studio stills.",
        latency: "1.6s",
      },
    },
  },
  {
    id: "strategist",
    num: "04",
    name: "Campaign Strategist",
    stageLabel: "Barrier Merge · Decision Node",
    headline: "Waits for all three upstream packets, then locks one unified plan.",
    inputsRead: ["Brand Intelligence", "Market Research (Lane A)", "Historical Performance (Lane B)"],
    responsibility:
      "Acts as the synchronization barrier: resolves conflicts between trend opportunity and account reality, selecting a single Hero Entity and rollout structure.",
    icon: Compass,
    artifacts: {
      solis: {
        inputSummary: "All 3 upstream packets converged",
        outputSummary:
          "Selected Hero Entity: Friday Winter Truffle Burrata Gnocchi (30 covers). Locked 2-wave launch: Thursday sensory teaser + Friday evening table drop.",
        latency: "2.3s",
      },
      linden: {
        inputSummary: "All 3 upstream packets converged",
        outputSummary:
          "Selected Hero Entity: Botanical Elixir Batch 09 (100% recyclable amber glass). Locked 14-day morning barrier ritual arc.",
        latency: "2.2s",
      },
      cairn: {
        inputSummary: "All 3 upstream packets converged",
        outputSummary:
          "Selected Hero Entity: Huila Highland Anaerobic Lot (1,900m). Locked acoustic pour-over hook + 48h roast guarantee angle.",
        latency: "2.0s",
      },
    },
  },
  {
    id: "architect",
    num: "05",
    name: "Content Architect",
    stageLabel: "Execution · Deliverable Build",
    headline: "Turns the locked strategy into complete carousels, captions, and reel beats.",
    inputsRead: ["Locked Campaign Strategy", "Brand Taboo Guardrails", "Deliverable Templates"],
    responsibility:
      "Drafts slide-by-slide copy, visual shot directions, captions, and shoot-day script beats in one coherent creative package.",
    icon: PenTool,
    artifacts: {
      solis: {
        inputSummary: "Winter Truffle strategy + 4:5 carousel spec",
        outputSummary:
          "Slide 1: 'Shaved black winter truffles over handmade burrata gnocchi. Thirty limited portions every Friday evening.' + complete 4-scene shoot cue sheet.",
        revisionNote:
          "Auto-Revision 1/2 applied: Removed flagged phrase 'lowest Friday pricing' -> replaced with 'thirty limited seasonal portions'.",
        latency: "3.1s",
      },
      linden: {
        inputSummary: "Batch 09 ritual strategy + carousel/reel spec",
        outputSummary:
          "Slide 1: 'Three cold-pressed drops over damp linen-toweled skin. Poured into 100% recyclable amber glass.' + tactile lighting direction.",
        revisionNote:
          "Auto-Revision 1/2 applied: Removed flagged word 'dermatologically cures' -> replaced with 'calms visible morning dryness'.",
        latency: "2.9s",
      },
      cairn: {
        inputSummary: "Huila micro-lot strategy + pour-over spec",
        outputSummary:
          "Slide 1: 'Roasted Tuesday, resting 48 hours, poured Friday at ninety-three degrees.' + coop elevation lower-third cues.",
        revisionNote:
          "Auto-Revision 1/2 applied: Added mandatory exact roast-rest window per RULE-03 verification.",
        latency: "2.8s",
      },
    },
  },
  {
    id: "evaluator",
    num: "06",
    name: "Quality Evaluator",
    stageLabel: "Self-Healing Gate · Approval Filter",
    headline: "Catches guideline violations and loops back automatically before humans review.",
    inputsRead: ["Drafted Deliverables", "Cortex Negative Taboos", "Quality & Voice Rubric"],
    responsibility:
      "Audits every word against brand rules. If a deliverable fails or violates a taboo, it routes straight back to Content Architect for autonomous rewrite (up to 2 revisions).",
    icon: ShieldCheck,
    artifacts: {
      solis: {
        inputSummary: "5-slide carousel + reel script audited",
        outputSummary:
          "97/100 Compliance Pass · Zero banned discount or health claims · Promoted to agency review and client Magic Link.",
        revisionNote:
          "Catch Triggered: Flagged TABOO-04 violation -> Returned to Agent 05 -> Re-audited Revision 1/2 at 97/100 PASS.",
        latency: "1.5s",
      },
      linden: {
        inputSummary: "Carousel + bottle ritual script audited",
        outputSummary:
          "98/100 Compliance Pass · Verified RULE-05 amber glass attribution and zero banned clinical claims · Ready for client sign-off.",
        revisionNote:
          "Catch Triggered: Flagged TABOO-01 medical verb -> Returned to Agent 05 -> Re-audited Revision 1/2 at 98/100 PASS.",
        latency: "1.4s",
      },
      cairn: {
        inputSummary: "Micro-lot deck + caption set audited",
        outputSummary:
          "96/100 Compliance Pass · Roast window and origin coordinates verified · Routed to Friday launch queue.",
        revisionNote:
          "Catch Triggered: Missing RULE-03 roast window stamp -> Returned to Agent 05 -> Re-audited Revision 1/2 at 96/100 PASS.",
        latency: "1.3s",
      },
    },
  },
];

export function AgentSwarmShowcase() {
  const [selectedClient, setSelectedClient] = useState<SwarmClientKey>("solis");
  const [selectedAgentIdx, setSelectedAgentIdx] = useState<number>(3);
  const [simulateSelfHeal, setSimulateSelfHeal] = useState<boolean>(false);

  const activeNode = AGENT_NODES[selectedAgentIdx];
  const artifact = activeNode.artifacts[selectedClient];
  const clientMeta = CLIENT_OPTIONS.find((c) => c.key === selectedClient) ?? CLIENT_OPTIONS[0];
  const ActiveIcon = activeNode.icon;

  const renderNodeCard = (nodeIdx: number, compactLane?: string) => {
    const node = AGENT_NODES[nodeIdx];
    const Icon = node.icon;
    const isSelected = selectedAgentIdx === nodeIdx;
    const isLoopTarget = simulateSelfHeal && (nodeIdx === 4 || nodeIdx === 5);

    return (
      <button
        key={node.id}
        onClick={() => setSelectedAgentIdx(nodeIdx)}
        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer relative ${
          isSelected
            ? "bg-[#1C1C24] border-emerald-400/70 shadow-[0_0_24px_-6px_rgba(16,185,129,0.28)]"
            : isLoopTarget
            ? "bg-[#1A1612] border-amber-400/50 hover:border-amber-400"
            : "bg-[#16161C] border-[#26262B] hover:border-[#3A3A44]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center ${
                isSelected
                  ? "bg-emerald-400 text-[#101014]"
                  : isLoopTarget
                  ? "bg-amber-400/20 text-amber-300"
                  : "bg-[#22222B] text-white/75"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="font-mono text-[10px] text-white/50">AGENT {node.num}</span>
          </div>

          {compactLane ? (
            <span className="px-1.5 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 font-mono text-[9px]">
              {compactLane}
            </span>
          ) : isLoopTarget && nodeIdx === 5 ? (
            <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono text-[9px]">
              ↺ REV 1/2
            </span>
          ) : (
            <span className="font-mono text-[10px] text-white/40 tabular-nums">
              {node.artifacts[selectedClient].latency}
            </span>
          )}
        </div>

        <p className="font-heading font-semibold text-sm text-white leading-snug">
          {node.name}
        </p>
        <p className="text-[11px] text-white/55 mt-1 leading-relaxed line-clamp-2">
          {node.headline}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* Controls Row: Client Selector + Self-Healing Loop Simulator */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#26262B]">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#16161C] p-1 rounded-xl border border-[#26262B]">
          {CLIENT_OPTIONS.map((client) => (
            <button
              key={client.key}
              onClick={() => setSelectedClient(client.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                selectedClient === client.key
                  ? "bg-white text-[#101014] font-semibold"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {client.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            const next = !simulateSelfHeal;
            setSimulateSelfHeal(next);
            setSelectedAgentIdx(next ? 5 : 3);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-mono border transition-all cursor-pointer flex items-center gap-2 ${
            simulateSelfHeal
              ? "bg-amber-400/15 border-amber-400/50 text-amber-300"
              : "bg-[#16161C] border-[#26262B] text-white/80 hover:border-white/40"
          }`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${simulateSelfHeal ? "text-amber-300" : "text-emerald-400"}`} />
          <span>
            {simulateSelfHeal
              ? "Self-Healing Catch Active: Revision 1/2 -> Passed"
              : "Simulate Taboo Catch -> Auto-Rewrite Loop"}
          </span>
        </button>
      </div>

      {/* True LangGraph Orchestration Topology */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-white/45 uppercase tracking-wider">
          <span>Orchestration Topology · Click any node to inspect inputs & deliverables</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <GitBranch className="w-3 h-3" />
            Parallel Fan-Out + Self-Healing Quality Gate
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Step 1: Entry Node */}
          <div className="lg:col-span-2">{renderNodeCard(0)}</div>

          {/* Connector 1 -> Parallel Split */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center">
              <div className="h-px flex-1 bg-[#2E2E36]" />
              <div className="w-2 h-16 border-y border-l border-[#2E2E36] rounded-l-md" />
            </div>
          </div>

          {/* Step 2: Parallel Fan-Out Stack */}
          <div className="lg:col-span-3 space-y-2.5 p-2.5 rounded-2xl border border-dashed border-[#2C2C36] bg-[#131318]">
            <div className="flex items-center justify-between px-1 text-[9px] font-mono text-emerald-400 uppercase tracking-wider">
              <span>Concurrent Fan-Out</span>
              <span>2x Parallel</span>
            </div>
            {renderNodeCard(1, "LANE A")}
            {renderNodeCard(2, "LANE B")}
          </div>

          {/* Connector Parallel Merge -> Strategist */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center">
              <div className="w-2 h-16 border-y border-r border-[#2E2E36] rounded-r-md" />
              <div className="h-px flex-1 bg-[#2E2E36]" />
            </div>
          </div>

          {/* Step 3 -> 4 -> 5 Chain */}
          <div className="lg:col-span-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {renderNodeCard(3)}
              {renderNodeCard(4)}
              {renderNodeCard(5)}
            </div>

            {/* Conditional Self-Healing Feedback Loop Indicator */}
            <div
              className={`px-3.5 py-2 rounded-xl border text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 transition-colors ${
                simulateSelfHeal
                  ? "bg-amber-400/10 border-amber-400/40 text-amber-200"
                  : "bg-[#15151B] border-[#26262B] text-white/55"
              }`}
            >
              <span className="flex items-center gap-2">
                <RotateCcw className={`w-3.5 h-3.5 ${simulateSelfHeal ? "text-amber-300" : "text-emerald-400"}`} />
                {simulateSelfHeal
                  ? "Gate Intercepted Violation -> Returned Agent 06 to Agent 05 (Revision 1 of 2) -> Score 97/100 PASS"
                  : "Quality Gate Loop: Rejects rule violations back to Agent 05 automatically (up to 2 self-healing passes)"}
              </span>
              <span className="text-[10px] text-emerald-400">Zero Bad Drafts Shipped</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Agent Dossier Inspector */}
      <motion.div
        key={`${activeNode.id}-${selectedClient}-${simulateSelfHeal}`}
        initial={{ opacity: 0.7, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl border border-[#26262B] bg-[#16161C] p-6 sm:p-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Role Definition */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <ActiveIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  Agent {activeNode.num} · {activeNode.stageLabel}
                </p>
                <h3 className="font-heading text-xl font-bold text-white">
                  {activeNode.name}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/75 leading-relaxed font-sans">
              {activeNode.responsibility}
            </p>

            <div className="space-y-1.5 pt-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                Inputs Read Automatically
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeNode.inputsRead.map((item) => (
                  <span
                    key={item}
                    className="px-2.5 py-1 rounded-md bg-[#101014] border border-[#26262B] text-[11px] font-mono text-white/75"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live Client Trace Output */}
          <div className="lg:col-span-7 rounded-xl bg-[#101014] border border-[#26262B] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#26262B]">
              <div className="text-[11px] font-mono">
                <span className="text-white/45">CAMPAIGN BRIEF: </span>
                <span className="text-white font-semibold">
                  {clientMeta.name} — {clientMeta.campaign}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Artifact Verified · {artifact.latency}
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                Context Loaded
              </p>
              <p className="text-xs font-mono text-white/70">{artifact.inputSummary}</p>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                Handoff Output Produced
              </p>
              <p className="text-sm text-white leading-relaxed font-sans">
                {artifact.outputSummary}
              </p>
            </div>

            {simulateSelfHeal && artifact.revisionNote && (
              <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="font-mono text-[11px] leading-relaxed">{artifact.revisionNote}</p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-[#26262B]">
              <span className="text-[11px] font-mono text-white/45">
                Node {selectedAgentIdx + 1} of {AGENT_NODES.length} in execution graph
              </span>
              <button
                onClick={() => setSelectedAgentIdx((prev) => (prev + 1) % AGENT_NODES.length)}
                className="px-3.5 py-1.5 rounded-lg bg-[#22222B] hover:bg-[#2E2E38] text-white text-xs font-mono inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Inspect Next Agent</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
