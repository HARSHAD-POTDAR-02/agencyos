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
      <div className="h-full flex flex-col bg-[#101014] framer-canvas-grid overflow-hidden">
        {/* ── Artboard Top Control Strip ── */}
        <div className="p-3 border-b border-white/[0.08] bg-[#17171E]/90 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            <span className="text-xs font-semibold text-[#F2F0F7] tracking-tight">Creative Artboard Studio</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]">
              Framer Canvas 100%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-[#A3A0B0] hidden sm:inline">Preview Mode:</span>
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
          <div className="surface-card rounded-2xl p-5 border border-white/[0.08] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.12),transparent_70%)] pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20">
                    Interactive Creative Studio
                  </span>
                  <span className="text-xs text-[#A3A0B0]">· 6 Autonomous Agents Synced</span>
                </div>
                <h3 className="text-base font-semibold text-[#F2F0F7] tracking-tight">
                  Campaign Storyboard &amp; Architecture Artboard
                </h3>
                <p className="text-xs text-[#A3A0B0] max-w-xl leading-relaxed">
                  Generate high-arrest video cuts, slide decks, and competitive gap analyses. Select an architectural prompt below to draft in real time:
                </p>
              </div>

              {/* 1-Click Launch Button */}
              <button
                type="button"
                onClick={() => onSelectPrompt?.("content_architect", "Draft an arresting 25-second Solapuri cuisine Instagram Reel storyboard with 3-second hook")}
                className="bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
                <span>Draft New Reel Storyboard</span>
              </button>
            </div>

            {/* Quick Agent Starter Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-2.5 pt-4 mt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => onSelectPrompt?.("content_architect", "Architect a 20-second Reel storyboard with timestamped beats & B-roll directions")}
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
                onClick={() => onSelectPrompt?.("content_architect", "Design a 7-slide educational carousel deck with hook slide and swipe triggers")}
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
                onClick={() => onSelectPrompt?.("market_research", "What competitor whitespace and viral hooks can we capitalize on right now?")}
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#69A9D8]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#69A9D8]">
                  <Search className="w-3.5 h-3.5 text-[#69A9D8] shrink-0" />
                  <span className="truncate">Market Evidence</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  Live web trends &amp; competitor gap audits
                </p>
              </button>

              <button
                type="button"
                onClick={() => onSelectPrompt?.("quality_evaluator", "Audit our latest campaign concepts for prohibited claims and brand compliance")}
                className="p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#E16F7B]/40 transition-all text-left group cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] group-hover:text-[#E16F7B]">
                  <FileCheck className="w-3.5 h-3.5 text-[#E16F7B] shrink-0" />
                  <span className="truncate">Compliance Gate</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 line-clamp-2">
                  Pre-flight brand safety audit &amp; risk scoring
                </p>
              </button>
            </div>
          </div>

          {/* ── Visual Editorial Storyboard Wireframe Canvas (Framer Reference) ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A3A0B0] flex items-center gap-2">
                <Film className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Editorial Storyboard Filmstrip (Framer Canvas)</span>
              </span>
              <span className="text-[10px] font-mono text-[#A3A0B0]">
                4 Production Scenes · 30s Target Runtime
              </span>
            </div>

            {/* Horizontal Filmstrip Rail with minimum card width so cues are never cramped */}
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin">
              {/* Scene 1: The Arresting Hook */}
              <div className="min-w-[240px] max-w-[280px] flex-1 surface-card rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#A78BFA]/40 transition-all shadow-xs shrink-0">
                {/* 9:16 Mock Viewport */}
                <div className="aspect-[9/12] bg-[#101014] p-4 flex flex-col justify-between relative border-b border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-transparent to-transparent opacity-80" />
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      0:00 – 0:03s
                    </span>
                    <span className="text-[9px] font-mono text-[#A3A0B0]">Hook Arrest</span>
                  </div>
                  <div className="z-10 space-y-1">
                    <span className="text-[9px] font-mono uppercase text-[#A78BFA] tracking-wider">On-Screen Text</span>
                    <p className="text-xs font-bold text-[#F2F0F7] leading-tight">
                      &ldquo;Stop eating 3-day old frozen mutton in Pune.&rdquo;
                    </p>
                  </div>
                </div>
                {/* Director Notes */}
                <div className="p-3.5 bg-[#17171E] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A3A0B0]">
                    <span>Camera: ECU Crash Zoom</span>
                    <span className="text-[#A78BFA]">Beat #1</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0] line-clamp-2">
                    Extreme close up of sizzling Solapuri masala pot with steam. High sensory arrest.
                  </p>
                </div>
              </div>

              {/* Scene 2: The Agitation & Kitchen Craft */}
              <div className="min-w-[240px] max-w-[280px] flex-1 surface-card rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#A78BFA]/40 transition-all shadow-xs shrink-0">
                {/* 9:16 Mock Viewport */}
                <div className="aspect-[9/12] bg-[#101014] p-4 flex flex-col justify-between relative border-b border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-transparent to-transparent opacity-80" />
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      0:03 – 0:10s
                    </span>
                    <span className="text-[9px] font-mono text-[#A3A0B0]">Problem Core</span>
                  </div>
                  <div className="z-10 space-y-1">
                    <span className="text-[9px] font-mono uppercase text-amber-400 tracking-wider">Voiceover Beat</span>
                    <p className="text-xs font-bold text-[#F2F0F7] leading-tight">
                      &ldquo;Here is how authentic solapuri masala is ground fresh every morning.&rdquo;
                    </p>
                  </div>
                </div>
                {/* Director Notes */}
                <div className="p-3.5 bg-[#17171E] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A3A0B0]">
                    <span>Camera: Dynamic Pan</span>
                    <span className="text-amber-400">Beat #2</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0] line-clamp-2">
                    Head chef pounding fresh spices in traditional stone mortar. High authenticity cues.
                  </p>
                </div>
              </div>

              {/* Scene 3: Proof & Demonstration */}
              <div className="min-w-[240px] max-w-[280px] flex-1 surface-card rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#A78BFA]/40 transition-all shadow-xs shrink-0">
                {/* 9:16 Mock Viewport */}
                <div className="aspect-[9/12] bg-[#101014] p-4 flex flex-col justify-between relative border-b border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-transparent to-transparent opacity-80" />
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      0:10 – 0:22s
                    </span>
                    <span className="text-[9px] font-mono text-[#A3A0B0]">Demonstration</span>
                  </div>
                  <div className="z-10 space-y-1">
                    <span className="text-[9px] font-mono uppercase text-sky-400 tracking-wider">Sensory Drop</span>
                    <p className="text-xs font-bold text-[#F2F0F7] leading-tight">
                      &ldquo;Meat falling right off the bone in rich tambda rassa.&rdquo;
                    </p>
                  </div>
                </div>
                {/* Director Notes */}
                <div className="p-3.5 bg-[#17171E] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A3A0B0]">
                    <span>Camera: 60fps Slow-Mo</span>
                    <span className="text-sky-400">Beat #3</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0] line-clamp-2">
                    Slow motion pour of authentic Solapuri rassa over steaming bhakri.
                  </p>
                </div>
              </div>

              {/* Scene 4: High-Conversion CTA */}
              <div className="min-w-[240px] max-w-[280px] flex-1 surface-card rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#A78BFA]/40 transition-all shadow-xs shrink-0">
                {/* 9:16 Mock Viewport */}
                <div className="aspect-[9/12] bg-[#101014] p-4 flex flex-col justify-between relative border-b border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-transparent to-transparent opacity-80" />
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      0:22 – 0:30s
                    </span>
                    <span className="text-[9px] font-mono text-[#A3A0B0]">Conversion CTA</span>
                  </div>
                  <div className="z-10 space-y-1.5">
                    <div className="px-2.5 py-1 rounded-lg bg-[#A78BFA] text-[#101014] text-[10px] font-bold text-center">
                      Comment &ldquo;SOLAPUR&rdquo;
                    </div>
                    <p className="text-[11px] font-semibold text-[#F2F0F7] text-center leading-tight">
                      Get 15% VIP discount code &amp; table link in DM
                    </p>
                  </div>
                </div>
                {/* Director Notes */}
                <div className="p-3.5 bg-[#17171E] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#A3A0B0]">
                    <span>Camera: End-card Graphic</span>
                    <span className="text-emerald-400">Beat #4</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0] line-clamp-2">
                    Restaurant location pin, phone number, and reservation handle with animated cursor.
                  </p>
                </div>
              </div>
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
