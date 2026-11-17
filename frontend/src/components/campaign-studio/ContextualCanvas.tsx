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
  GitBranch,
  Edit3,
} from "lucide-react";

interface ContextualCanvasProps {
  artifact: ActiveArtifactData | null;
  versions?: any[];
  pinnedEntities?: string[];
  discoveredEntities?: string[];
  onTogglePinEntity?: (entity: string) => void;
  onAddCustomEntity?: (entity: string) => void;
  onSelectVersion?: (versionNumber: number) => void;
  onApproveVersion?: (artifactId: string, versionNumber: number) => Promise<void>;
  onReviseArtifact?: (
    artifactId: string,
    revisedPayload: Record<string, any>,
    changeSummary?: string
  ) => Promise<void>;
  onExportClick?: (artifact: ActiveArtifactData) => void;
  onSelectPrompt?: (agentId: string, promptText: string) => void;
  onCloseCanvas?: () => void;
}

export function ContextualCanvas({
  artifact,
  versions = [],
  pinnedEntities = [],
  discoveredEntities = [],
  onTogglePinEntity,
  onAddCustomEntity,
  onSelectVersion,
  onApproveVersion,
  onReviseArtifact,
  onExportClick,
  onSelectPrompt,
  onCloseCanvas,
}: ContextualCanvasProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState("");
  const [isSavingRevision, setIsSavingRevision] = useState(false);
  const [customEntityInput, setCustomEntityInput] = useState("");

  const renderHeroEntityTray = () => (
    <div className="surface-card p-4 rounded-2xl border border-white/[0.08] shadow-xs space-y-3 bg-[#13131A]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#E5AA58]/15 text-[#E5AA58] border border-[#E5AA58]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold font-heading text-[#F2F0F7] tracking-tight">
                Hero Entity Tray
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/30 font-semibold">
                {pinnedEntities.length} Pinned Focus
              </span>
            </div>
            <p className="text-[11px] text-[#A3A0B0]">
              Pinned hero items ground all agents, video scripts, and sprint tasks into verified dishes &amp; products.
            </p>
          </div>
        </div>

        {/* Quick Add Custom Entity */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={customEntityInput}
            onChange={(e) => setCustomEntityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customEntityInput.trim()) {
                onAddCustomEntity?.(customEntityInput.trim());
                setCustomEntityInput("");
              }
            }}
            placeholder="+ Add custom hero item..."
            className="px-2.5 py-1 rounded-lg bg-[#101014] border border-white/[0.1] text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#E5AA58] w-40 sm:w-48"
          />
          <button
            type="button"
            disabled={!customEntityInput.trim()}
            onClick={() => {
              if (customEntityInput.trim()) {
                onAddCustomEntity?.(customEntityInput.trim());
                setCustomEntityInput("");
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-[#E5AA58] hover:bg-[#F0B865] text-[#101014] font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      {/* Chips Area */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {/* Pinned Items */}
        {pinnedEntities.map((entity) => (
          <button
            key={`pinned-${entity}`}
            type="button"
            onClick={() => onTogglePinEntity?.(entity)}
            title="Click to unpin from hero focus"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/50 text-xs font-mono font-semibold hover:bg-[#E5AA58]/30 transition-all cursor-pointer shadow-xs group"
          >
            <Sparkles className="w-3 h-3 text-[#E5AA58]" />
            <span>{entity}</span>
            <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Discovered / Unpinned Candidates */}
        {discoveredEntities
          .filter((e) => !pinnedEntities.includes(e))
          .map((entity) => (
            <button
              key={`disc-${entity}`}
              type="button"
              onClick={() => onTogglePinEntity?.(entity)}
              title="Click to pin as hero item"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1C1C26] hover:bg-white/[0.08] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08] hover:border-white/[0.2] text-xs font-mono transition-all cursor-pointer group"
            >
              <span className="text-white/40 group-hover:text-[#E5AA58] font-bold">+</span>
              <span>{entity}</span>
            </button>
          ))}

        {pinnedEntities.length === 0 && discoveredEntities.length === 0 && (
          <span className="text-[11px] text-[#A3A0B0] italic py-0.5">
            No hero entities identified yet. Type a signature dish or offering above to pin.
          </span>
        )}
      </div>
    </div>
  );

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

  const handleSaveRevision = async () => {
    if (!artifact || !onReviseArtifact) return;
    setIsSavingRevision(true);
    try {
      await onReviseArtifact(
        artifact.id,
        artifact.payload,
        revisionSummary || `Revision v${(artifact.version || 1) + 1}`
      );
      setIsRevisionModalOpen(false);
      setRevisionSummary("");
    } catch (err) {
      console.error("Failed to save revision", err);
    } finally {
      setIsSavingRevision(false);
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
          {renderHeroEntityTray()}

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
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#17171E] border border-white/[0.1] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between px-2 py-0.5 border-b border-white/[0.06] pb-1">
                      <span className="text-[10px] font-mono font-bold text-[#A3A0B0] uppercase">
                        Revision History
                      </span>
                      <span className="text-[10px] font-mono text-[#A78BFA]">
                        {versions.length} {versions.length === 1 ? "Version" : "Versions"}
                      </span>
                    </div>
                    {versions.map((v) => {
                      const isCurrent = v.version_number === artifact.version;
                      return (
                        <button
                          key={v.version_number}
                          type="button"
                          onClick={() => {
                            onSelectVersion?.(v.version_number);
                            setIsVersionDropdownOpen(false);
                          }}
                          className={`w-full flex items-start justify-between p-2 rounded-lg text-xs font-mono transition-colors text-left gap-2 ${
                            isCurrent
                              ? "bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30"
                              : "hover:bg-white/[0.04] text-[#A3A0B0] hover:text-[#F2F0F7] border border-transparent"
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">v{v.version_number}</span>
                              {v.actor_type && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-white/[0.06] text-[#A3A0B0]">
                                  {v.actor_type === "user" ? "User" : (v.actor_id || "Agent")}
                                </span>
                              )}
                            </div>
                            {v.change_summary && (
                              <span className="text-[10px] text-[#A3A0B0]/80 truncate max-w-[150px] font-sans mt-0.5">
                                {v.change_summary}
                              </span>
                            )}
                          </div>
                          {v.is_approved && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#45B88A]/20 text-[#45B88A] font-semibold shrink-0">
                              Approved
                            </span>
                          )}
                        </button>
                      );
                    })}
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
          {onReviseArtifact && (
            <button
              type="button"
              onClick={() => setIsRevisionModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202A] hover:bg-white/[0.08] text-[#F2F0F7] border border-white/[0.1] font-semibold text-xs transition-all shadow-xs cursor-pointer font-sans"
              title="Save a new revision snapshot without affecting production deliverables"
            >
              <GitBranch className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Revise (v{(artifact.version || 1) + 1})</span>
            </button>
          )}

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
        {renderHeroEntityTray()}

        {artifact.type === "storyboard" && (
          <StoryboardPanel
            payload={artifact.payload as any}
            pinnedEntities={pinnedEntities}
          />
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

      {/* ── Save New Revision Modal ── */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md surface-card rounded-2xl border border-white/[0.12] p-5 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#A78BFA]/15 text-[#A78BFA]">
                  <GitBranch className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#F2F0F7] font-heading">
                    Create Revision Snapshot
                  </h3>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Advances version from <span className="font-mono text-[#A78BFA]">v{artifact.version}</span> to{" "}
                    <span className="font-mono text-[#45B88A]">v{(artifact.version || 1) + 1}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/[0.08] text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#F2F0F7] block mb-1">
                  Change Summary / Changelog Note
                </label>
                <input
                  type="text"
                  value={revisionSummary}
                  onChange={(e) => setRevisionSummary(e.target.value)}
                  placeholder="e.g. Tightened 3-second hook, added voiceover beat"
                  className="w-full px-3 py-2 rounded-xl bg-[#101014] border border-white/[0.1] text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA]"
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-xl bg-[#101014]/60 border border-white/[0.06] text-[11px] text-[#A3A0B0] space-y-1">
                <p className="font-semibold text-[#F2F0F7] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#45B88A]" />
                  <span>Draft Immutability Guarantee</span>
                </p>
                <p>
                  This stores an immutable snapshot in SQLite/Postgres. Previous versions (v1, v2) remain preserved and switchable. The production <code className="text-[#A78BFA]">deliverables</code> and <code className="text-[#A78BFA]">tasks</code> tables are not touched.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={isSavingRevision}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingRevision ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Save Revision v{(artifact.version || 1) + 1} ✨</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
