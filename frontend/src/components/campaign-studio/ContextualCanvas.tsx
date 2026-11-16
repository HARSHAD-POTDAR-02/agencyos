"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  Compass,
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
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#101014]">
        <div className="w-16 h-16 rounded-2xl bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-8 h-8 text-[#A78BFA]" />
        </div>
        <h3 className="font-bold text-lg text-[#F2F0F7] mb-1 tracking-tight">
          Contextual Creative Canvas
        </h3>
        <p className="text-xs text-[#A3A0B0] max-w-sm mb-6 leading-relaxed">
          Structured creative assets appear here in real-time as you collaborate with specialist agents. Select an agent prompt to start drafting:
        </p>

        <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          <button
            type="button"
            onClick={() => onSelectPrompt?.("content_architect", "Draft a 20-second Reel storyboard with timestamped beats & B-roll directions")}
            className="p-3.5 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#A78BFA]/60 hover:bg-[#20202A] transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA]">
              <Film className="w-4 h-4 text-[#A78BFA]" />
              <span>Video Scripts</span>
            </div>
            <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2 leading-relaxed">
              Architect timestamped Reel storyboards & visual camera cues
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("market_research", "What competitor whitespace and viral hooks can we capitalize on right now?")}
            className="p-3.5 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#69A9D8]/60 hover:bg-[#20202A] transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-[#F2F0F7] group-hover:text-[#69A9D8]">
              <Search className="w-4 h-4 text-[#69A9D8]" />
              <span>Market Research</span>
            </div>
            <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2 leading-relaxed">
              Audit live competitor angles & search evidence citations
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("quality_evaluator", "Audit our latest campaign brief and concepts for weak hooks, fluff, and prohibited claims")}
            className="p-3.5 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#E16F7B]/60 hover:bg-[#20202A] transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-[#F2F0F7] group-hover:text-[#E16F7B]">
              <FileCheck className="w-4 h-4 text-[#E16F7B]" />
              <span>Quality & Compliance</span>
            </div>
            <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2 leading-relaxed">
              Pre-flight compliance score & prohibited claims check
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPrompt?.("campaign_strategist", "Design a 3-stage narrative campaign arc with 30-day pacing")}
            className="p-3.5 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#A78BFA]/60 hover:bg-[#20202A] transition-all text-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA]">
              <Cpu className="w-4 h-4 text-[#A78BFA]" />
              <span>Campaign Strategist</span>
            </div>
            <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2 leading-relaxed">
              Synthesize multi-phase story sprints & format distribution
            </p>
          </button>
        </div>
      </div>
    );
  }

  const isExported = artifact.status === "exported";
  const isApproved = artifact.status === "approved" || isExported;

  return (
    <div className="h-full flex flex-col bg-[#101014]">
      {/* ── Canvas Fixed Header ── */}
      <div className="p-3.5 border-b border-[#30303D] bg-[#17171E] shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#20202A] text-[#F2F0F7] border border-[#30303D]">
            v{artifact.version}
          </span>

          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isExported
                ? "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30"
                : isApproved
                ? "bg-[#45B88A]/15 text-[#45B88A] border-[#45B88A]/30"
                : "bg-[#20202A] text-[#A3A0B0] border-[#30303D]"
            }`}
          >
            {isExported ? "In Production" : isApproved ? "Approved" : artifact.status}
          </span>

          <h3 className="font-bold text-sm text-[#F2F0F7] truncate max-w-[200px] sm:max-w-[320px]">
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
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#45B88A] hover:bg-[#45B88A]/90 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Approve v{artifact.version}</span>
            </button>
          )}

          {isExported && (
            <Link
              href="/tasks"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 font-semibold text-xs hover:bg-[#A78BFA]/25 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>In Production</span>
            </Link>
          )}

          {onExportClick && (
            <button
              type="button"
              onClick={() => onExportClick(artifact)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isExported ? "Re-export" : "Export to Tasks"}</span>
            </button>
          )}

          {onCloseCanvas && (
            <button
              type="button"
              onClick={onCloseCanvas}
              title="Close Canvas"
              className="p-1 rounded-lg hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
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
          <div className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] space-y-3">
            <h4 className="font-bold text-sm text-[#F2F0F7]">
              {artifact.title} ({artifact.type})
            </h4>
            <pre className="p-3 rounded-lg bg-[#101014] text-xs font-mono text-[#A3A0B0] overflow-x-auto border border-[#30303D]">
              {JSON.stringify(artifact.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
