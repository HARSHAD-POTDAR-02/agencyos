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
  History,
  Check,
} from "lucide-react";

interface ContextualCanvasProps {
  artifact: ActiveArtifactData | null;
  versions?: any[];
  onSelectVersion?: (versionNumber: number) => void;
  onApproveVersion?: (artifactId: string, versionNumber: number) => Promise<void>;
  onExportClick?: (artifact: ActiveArtifactData) => void;
  onSelectPrompt?: (agentId: string, promptText: string) => void;
  onCloseCanvas?: () => void;
}

export function ContextualCanvas({
  artifact,
  versions = [],
  onSelectVersion,
  onApproveVersion,
  onExportClick,
  onSelectPrompt,
  onCloseCanvas,
}: ContextualCanvasProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);

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
      <div className="h-full flex flex-col bg-[#101014] framer-canvas-grid overflow-hidden">
        {/* ── Artboard Top Control Strip ── */}
        <div className="p-3 border-b border-white/[0.08] bg-[#17171E]/90 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            <span className="text-xs font-semibold text-[#F2F0F7] tracking-tight font-heading">
              Creative Artboard Studio
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]">
              Framer Canvas
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-[#A3A0B0] hidden sm:inline">
              Preview Mode:
            </span>
            <div className="flex items-center p-0.5 bg-[#101014] rounded-lg border border-white/[0.08]">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#20202A] text-[#F2F0F7] border border-white/[0.1]">
                📱 9:16 Reel
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono text-[#A3A0B0]">
                🖼️ 1:1 Deck
              </span>
            </div>
          </div>
        </div>

        {/* ── Interactive Artboard Viewport ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Studio Welcome & Sprint Launcher */}
          <div className="surface-card rounded-2xl p-5 border border-white/[0.08] relative overflow-hidden shadow-xs">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.12),transparent_70%)] pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20">
                    Interactive Creative Studio
                  </span>
                  <span className="text-xs text-[#A3A0B0]">
                    · 6 Autonomous Agents Synced
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#F2F0F7] tracking-tight font-heading">
                  Campaign Storyboard &amp; Architecture Artboard
                </h3>
                <p className="text-xs text-[#A3A0B0] max-w-xl leading-relaxed">
                  Generate high-arrest video cuts, slide decks, and competitive gap analyses. Select an architectural prompt below to draft in real time:
                </p>
              </div>

              {/* 1-Click Launch Button */}
              <button
                type="button"
                onClick={() =>
                  onSelectPrompt?.(
                    "content_architect",
                    "Draft an arresting 25-second Instagram Reel storyboard with 3-second hook"
                  )
                }
                className="bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] shrink-0 cursor-pointer font-sans"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
                <span>Draft New Reel Storyboard</span>
              </button>
            </div>

            {/* Quick Agent Starter Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-2.5 pt-4 mt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() =>
                  onSelectPrompt?.(
                    "content_architect",
                    "Architect a 20-second Reel storyboard with timestamped beats & B-roll directions"
                  )
                }
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#A78BFA]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA]">
                  <Film className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                  <span className="truncate">Video Storyboard</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  9:16 vertical Reel scene breakdown &amp; camera cues
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectPrompt?.(
                    "content_architect",
                    "Design a 7-slide educational carousel deck with hook slide and swipe triggers"
                  )
                }
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#A78BFA]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA]">
                  <Layers className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                  <span className="truncate">Carousel Deck</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  1:1 authority slides with retention copy
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectPrompt?.(
                    "market_research",
                    "What competitor whitespace and viral hooks can we capitalize on right now?"
                  )
                }
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#69A9D8]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#69A9D8]">
                  <Search className="w-3.5 h-3.5 text-[#69A9D8] shrink-0" />
                  <span className="truncate">Market Intelligence</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  Live trending formats &amp; audience whitespace
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectPrompt?.(
                    "quality_evaluator",
                    "Audit our campaign concepts for weak hooks, clichés, or compliance risks"
                  )
                }
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#E55353]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#E55353]">
                  <FileCheck className="w-3.5 h-3.5 text-[#E55353] shrink-0" />
                  <span className="truncate">Quality Gate Audit</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  Pre-flight claim verification &amp; retention scoring
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isExported = artifact.status === "exported";
  const isApproved = artifact.status === "approved" || isExported;

  return (
    <div className="h-full flex flex-col bg-[#101014]">
      {/* ── Canvas Fixed Header Strip ── */}
      <div className="p-3 border-b border-white/[0.08] bg-[#17171E] shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Version Selector Pill */}
          <div className="relative">
            {versions && versions.length > 1 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] hover:border-[#A78BFA]/50 transition-colors cursor-pointer"
                >
                  <History className="w-3 h-3 text-[#A78BFA]" />
                  <span>v{artifact.version}</span>
                  <span className="text-[10px] text-[#A3A0B0]">({versions.length})</span>
                </button>

                {isVersionDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#17171E] border border-white/[0.1] rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                    <span className="text-[9.5px] font-mono text-[#A3A0B0] uppercase px-2 py-0.5 block">
                      Version History
                    </span>
                    {versions.map((v) => (
                      <button
                        key={v.version_number}
                        type="button"
                        onClick={() => {
                          onSelectVersion?.(v.version_number);
                          setIsVersionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs font-mono transition-colors text-left ${
                          v.version_number === artifact.version
                            ? "bg-[#A78BFA]/15 text-[#A78BFA] font-bold"
                            : "hover:bg-white/[0.04] text-[#A3A0B0] hover:text-[#F2F0F7]"
                        }`}
                      >
                        <span>Version {v.version_number}</span>
                        {v.is_approved && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#45B88A]/20 text-[#45B88A]">
                            Approved
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#20202A] text-[#F2F0F7] border border-white/[0.08]">
                v{artifact.version}
              </span>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isExported
                ? "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30"
                : isApproved
                ? "bg-[#45B88A]/15 text-[#45B88A] border-[#45B88A]/30"
                : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
            }`}
          >
            {isExported ? "In Production" : isApproved ? "Approved" : artifact.status}
          </span>

          <h3 className="font-bold text-sm text-[#F2F0F7] truncate max-w-[200px] sm:max-w-[320px] font-heading">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#45B88A] hover:bg-[#45B88A]/90 text-[#101014] font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer font-sans"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 font-semibold text-xs hover:bg-[#A78BFA]/25 transition-colors font-mono"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>In Production</span>
            </Link>
          )}

          {onExportClick && (
            <button
              type="button"
              onClick={() => onExportClick(artifact)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-xs transition-all shadow-xs cursor-pointer font-sans"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isExported ? "Re-export" : "Export to Production"}</span>
            </button>
          )}

          {onCloseCanvas && (
            <button
              type="button"
              onClick={onCloseCanvas}
              title="Close Canvas"
              className="p-1.5 rounded-lg hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
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
        {![
          "storyboard",
          "hook_comparison",
          "carousel_deck",
          "compliance_review",
          "research_evidence",
          "campaign_blueprint",
          "brand_positioning",
        ].includes(artifact.type) && (
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#17171E] space-y-3">
            <h4 className="font-bold text-sm text-[#F2F0F7]">
              {artifact.title} ({artifact.type})
            </h4>
            <pre className="p-3 rounded-lg bg-[#101014] text-xs font-mono text-[#A3A0B0] overflow-x-auto border border-white/[0.06]">
              {JSON.stringify(artifact.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
