"use client";

import React, { useState } from "react";
import { ActiveArtifactData } from "./types";
import { StoryboardPanel } from "./StoryboardPanel";
import { HookAnalysisPanel } from "./HookAnalysisPanel";
import { CarouselPanel } from "./CarouselPanel";
import { CompliancePanel } from "./CompliancePanel";
import { ResearchPanel } from "./ResearchPanel";
import { BlueprintPanel } from "./BlueprintPanel";
import { BrandPositioningPanel } from "./BrandPositioningPanel";
import {
  Sparkles,
  CheckCircle2,
  Share2,
  Layers,
  Film,
  Search,
  FileCheck,
  Cpu,
  ShieldCheck,
  Flame,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";

interface ContextualCanvasProps {
  artifact: ActiveArtifactData | null;
  onApproveVersion?: (artifactId: string, versionNumber: number) => Promise<void>;
  onExportClick?: (artifact: ActiveArtifactData) => void;
  onSelectPrompt?: (agentId: string, promptText: string) => void;
  onCloseCanvas?: () => void;
}

export function ContextualCanvas({
  artifact,
  onApproveVersion,
  onExportClick,
  onSelectPrompt,
  onCloseCanvas,
}: ContextualCanvasProps) {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    if (!artifact || !onApproveVersion) return;
    setIsApproving(true);
    try {
      await onApproveVersion(artifact.id, artifact.version);
    } catch (err) {
      console.error("Failed to approve version", err);
    } finally {
      setIsApproving(false);
    }
  };

  if (!artifact) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-card/30">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-bold text-lg text-foreground mb-1">
          Contextual Creative Canvas
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
          Structured creative assets appear here in real-time as you collaborate with specialist agents.
        </p>

        <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          <button
            type="button"
            onClick={() => onSelectPrompt?.("content_architect", "Draft a 20-second Reel storyboard with timestamped beats & B-roll directions")}
            className="p-3 rounded-xl border border-border bg-card/80 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400">
              <Film className="w-4 h-4 text-purple-500" />
              <span>Video Scripts</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              Architect timestamped Reel storyboards & Flux visual prompts
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("market_research", "What competitor whitespace and viral hooks can we capitalize on right now?")}
            className="p-3 rounded-xl border border-border bg-card/80 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400">
              <Search className="w-4 h-4 text-sky-500" />
              <span>Market Research</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              Audit live competitor angles & search evidence citations
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("quality_evaluator", "Audit our latest campaign brief and concepts for weak hooks, fluff, and prohibited claims")}
            className="p-3 rounded-xl border border-border bg-card/80 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400">
              <FileCheck className="w-4 h-4 text-rose-500" />
              <span>Quality & Compliance</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              Pre-flight compliance score & red/green copy diff
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("campaign_strategist", "Design a 3-stage narrative campaign arc with 30-day pacing")}
            className="p-3 rounded-xl border border-border bg-card/80 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>Campaign Strategist</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
              Synthesize multi-phase story sprints & format mix
            </p>
          </button>
        </div>
      </div>
    );
  }

  const isApproved = artifact.status === "approved";

  return (
    <div className="h-full flex flex-col bg-card/40">
      {/* ── Canvas Fixed Header ── */}
      <div className="p-3.5 border-b border-border/80 bg-background/80 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
            v{artifact.version}
          </span>

          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isApproved
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {artifact.status}
          </span>

          <h3 className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-[320px]">
            {artifact.title || "Creative Asset"}
          </h3>
        </div>

        {/* Canvas Quick Actions */}
        <div className="flex items-center gap-2">
          {!isApproved && onApproveVersion && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Approve v{artifact.version}</span>
            </button>
          )}

          {onExportClick && (
            <button
              type="button"
              onClick={() => onExportClick(artifact)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Export to Tasks</span>
            </button>
          )}

          {onCloseCanvas && (
            <button
              type="button"
              onClick={onCloseCanvas}
              title="Close Canvas"
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Canvas Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {artifact.type === "storyboard" && (
          <StoryboardPanel payload={artifact.payload as any} />
        )}

        {artifact.type === "hook_comparison" && (
          <HookAnalysisPanel payload={artifact.payload as any} />
        )}

        {artifact.type === "carousel_deck" && (
          <CarouselPanel payload={artifact.payload as any} />
        )}

        {artifact.type === "compliance_review" && (
          <CompliancePanel payload={artifact.payload as any} />
        )}

        {artifact.type === "research_evidence" && (
          <ResearchPanel payload={artifact.payload as any} />
        )}

        {artifact.type === "campaign_blueprint" && (
          <BlueprintPanel payload={artifact.payload as any} />
        )}

        {artifact.type === "brand_positioning" && (
          <BrandPositioningPanel payload={artifact.payload as any} />
        )}

        {/* Fallback if another artifact type */}
        {!["storyboard", "hook_comparison", "carousel_deck", "compliance_review", "research_evidence", "campaign_blueprint", "brand_positioning"].includes(artifact.type) && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h4 className="font-bold text-sm text-foreground">
              {artifact.title} ({artifact.type})
            </h4>
            <pre className="p-3 rounded-lg bg-muted/60 text-xs font-mono overflow-x-auto">
              {JSON.stringify(artifact.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
