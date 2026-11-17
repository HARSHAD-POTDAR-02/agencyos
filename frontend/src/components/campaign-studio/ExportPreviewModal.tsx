"use client";

import React, { useState, useEffect, useRef } from "react";
import { ActiveArtifactData, ExportPipelineResponse } from "./types";
import { studioApi } from "@/lib/api";
import {
  Share2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Film,
  User,
  ArrowRight,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  Check,
} from "lucide-react";
import Link from "next/link";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: ActiveArtifactData | null;
  agencyId: string;
  campaignId: string;
  token: string;
  teamMembers?: TeamMember[];
  onApproveVersion?: (artifactId: string, versionNumber: number) => Promise<void>;
  onExportSuccess?: (res: ExportPipelineResponse) => void;
}

export function ExportPreviewModal({
  isOpen,
  onClose,
  artifact,
  agencyId,
  campaignId,
  token,
  teamMembers = [],
  onApproveVersion,
  onExportSuccess,
}: ExportPreviewModalProps) {
  // Form state
  const [deliverableName, setDeliverableName] = useState("");
  const [targetFormat, setTargetFormat] = useState("reel_storyboard");
  const [targetPlatform, setTargetPlatform] = useState("instagram");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Execution state
  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportPipelineResponse | null>(null);

  const prevIsOpenRef = useRef(false);
  const prevArtifactKeyRef = useRef("");

  // Keyboard shortcut: ESC to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const artifactKey = artifact ? `${artifact.id}-v${artifact.version}` : "";
    const justOpened = isOpen && !prevIsOpenRef.current;
    const artifactChanged = isOpen && artifactKey !== prevArtifactKeyRef.current;

    if (justOpened || artifactChanged) {
      const defaultName =
        artifact?.payload?.deliverable_title ||
        artifact?.title ||
        "Creative Deliverable";
      setDeliverableName(defaultName);

      const fmt =
        artifact?.payload?.format_type ||
        (artifact?.type === "storyboard"
          ? "reel_storyboard"
          : artifact?.type === "carousel_deck"
          ? "carousel"
          : artifact?.type || "reel_storyboard");
      setTargetFormat(fmt);

      const plat = artifact?.payload?.platform || "instagram";
      setTargetPlatform(plat);

      // Default due date to 7 days in future
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7);
      setDueDate(targetDate.toISOString().split("T")[0]);

      // Generate a fresh idempotency key per modal session
      setIdempotencyKey(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `studio-exp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      );

      setErrorMessage(null);
      setExportResult(null);
    }

    prevIsOpenRef.current = isOpen;
    prevArtifactKeyRef.current = artifactKey;
  }, [isOpen, artifact?.id, artifact?.version]);

  if (!isOpen || !artifact) return null;

  const isApproved =
    artifact.status === "approved" ||
    artifact.status === "exported" ||
    artifact.payload?.is_approved === true ||
    (artifact as any).latest_version?.is_approved === true;

  // Task notes preview
  let taskNotesPreview = "Production asset ready for execution.";
  if (artifact.payload?.scenes && Array.isArray(artifact.payload.scenes)) {
    taskNotesPreview = `Storyboard with ${artifact.payload.scenes.length} scenes ready for production.`;
  } else if (artifact.payload?.slides && Array.isArray(artifact.payload.slides)) {
    taskNotesPreview = `Carousel deck with ${artifact.payload.slides.length} slides ready for production.`;
  }

  const handleApproveInline = async () => {
    if (!onApproveVersion) return;
    setIsApproving(true);
    setErrorMessage(null);
    try {
      await onApproveVersion(artifact.id, artifact.version);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to approve version.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverableName.trim()) {
      setErrorMessage("Deliverable title cannot be empty.");
      return;
    }
    if (!isApproved) {
      setErrorMessage("This artifact version must be approved before exporting.");
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const response = await studioApi.exportToPipeline(
        agencyId,
        campaignId,
        {
          artifact_id: artifact.id,
          expected_version_number: artifact.version,
          assignee_id: assigneeId ? assigneeId : null,
          default_due_date: dueDate ? dueDate : null,
          target_format: targetFormat,
          deliverable_name: deliverableName.trim(),
        },
        idempotencyKey,
        token
      );

      setExportResult(response);
      if (onExportSuccess) {
        onExportSuccess(response);
      }
    } catch (err: any) {
      console.error("Export failed:", err);
      setErrorMessage(err.message || "An unexpected error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#17171E] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-[#101014]/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
                exportResult
                  ? "bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A]"
                  : "bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[#A78BFA]"
              }`}
            >
              {exportResult ? <CheckCircle2 className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="export-modal-title" className="font-bold text-base text-[#F2F0F7] font-heading">
                {exportResult ? "Production Export Complete" : "Export to Production Pipeline"}
              </h2>
              <p className="text-xs text-[#A3A0B0] font-sans">
                {exportResult
                  ? `Artifact v${artifact.version} was exported into Deliverable & Task records.`
                  : `Convert approved studio draft v${artifact.version} into a production Deliverable and Task.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {exportResult ? (
            /* Success View */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-[#45B88A]/10 border border-[#45B88A]/20 text-[#45B88A] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-bold text-lg text-[#F2F0F7] font-heading">
                  {exportResult.is_replay ? "Export Recovered (Idempotent Replay)" : "Successfully Exported to Production!"}
                </h3>
                <p className="text-xs text-[#A3A0B0] max-w-md mx-auto">
                  {exportResult.is_replay
                    ? "An identical export request was already processed. Existing production records were retrieved safely via idempotency key."
                    : "The creative draft was locked, audit record created, and production work items were spawned."}
                </p>
              </div>

              {/* Records Mapping Card */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-[#101014] text-left space-y-3 max-w-lg mx-auto">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
                  <span className="text-[#A3A0B0] font-medium font-mono text-[11px]">Production Deliverable</span>
                  <span className="font-semibold text-[#F2F0F7] truncate max-w-[240px]">
                    {exportResult.deliverable_title}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
                  <span className="text-[#A3A0B0] font-medium font-mono text-[11px]">Production Task</span>
                  <span className="font-semibold text-[#F2F0F7] truncate max-w-[240px]">
                    {exportResult.task_title}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A3A0B0] font-medium font-mono text-[11px]">Audit Export ID</span>
                  <span className="font-mono text-[11px] text-[#A3A0B0]">
                    {String(exportResult.export_id || exportResult.deliverable_id || "").substring(0, 8)}...
                  </span>
                </div>
              </div>

              {/* Navigation CTAs */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {exportResult.deliverable_id && (
                  <Link
                    href={`/deliverables/${exportResult.deliverable_id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-xs transition-colors shadow-2xs font-sans"
                  >
                    <span>View Deliverable</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Link
                  href="/tasks"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#20202A] hover:bg-white/[0.06] border border-white/[0.08] text-[#F2F0F7] font-semibold text-xs transition-colors shadow-2xs font-sans"
                >
                  <span>Go to Production Tasks</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-white/[0.08] hover:bg-[#20202A] text-[#F2F0F7] font-medium text-xs transition-colors cursor-pointer"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          ) : (
            /* Export Proposal Form */
            <form onSubmit={handleConfirmExport} className="space-y-5">
              {/* Approval status banner */}
              {isApproved ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/20 text-[#45B88A] text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 text-[#45B88A] shrink-0" />
                  <span>
                    Artifact v{artifact.version} is <strong>Approved</strong> and verified for production export.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#E5AA58]/10 border border-[#E5AA58]/30 text-[#E5AA58] text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[#E5AA58] shrink-0" />
                    <span>
                      Artifact v{artifact.version} is in <strong>Draft</strong> status. Version approval is required before export.
                    </span>
                  </div>
                  {onApproveVersion && (
                    <button
                      type="button"
                      onClick={handleApproveInline}
                      disabled={isApproving}
                      className="px-3 py-1.5 rounded-lg bg-[#45B88A] hover:bg-[#45B88A]/90 text-[#101014] font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Approve v{artifact.version}</span>
                    </button>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#F2F0F7] mb-1.5">
                    Deliverable Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliverableName}
                    onChange={(e) => setDeliverableName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#101014] text-[#F2F0F7] focus:outline-hidden focus:border-[#A78BFA] transition-all"
                    placeholder="e.g. Hero Pour ASMR Reel"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#F2F0F7] mb-1.5">
                      Target Format
                    </label>
                    <select
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#101014] text-[#F2F0F7] focus:outline-hidden focus:border-[#A78BFA] transition-all cursor-pointer"
                    >
                      <option value="reel_storyboard">Reel Storyboard / Short-Form Video</option>
                      <option value="carousel">Carousel Slide Deck</option>
                      <option value="single_image">Static Graphic / Single Image</option>
                      <option value="hook_comparison">Hook Testing Sprint</option>
                      <option value="campaign_blueprint">Sprint Blueprint</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#F2F0F7] mb-1.5">
                      Platform Channel
                    </label>
                    <select
                      value={targetPlatform}
                      onChange={(e) => setTargetPlatform(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#101014] text-[#F2F0F7] focus:outline-hidden focus:border-[#A78BFA] transition-all cursor-pointer"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="twitter">X / Twitter</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#F2F0F7] mb-1.5">
                      Planned Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#101014] text-[#F2F0F7] focus:outline-hidden focus:border-[#A78BFA] transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#F2F0F7] mb-1.5">
                      Production Assignee
                    </label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-white/[0.08] bg-[#101014] text-[#F2F0F7] focus:outline-hidden focus:border-[#A78BFA] transition-all cursor-pointer"
                    >
                      <option value="">(Unassigned - Team Pool)</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name} ({member.role || "Team"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Proposal Preview Card */}
              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#101014] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F2F0F7] font-mono">
                  <Film className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Production Pipeline Scope</span>
                </div>
                <div className="text-xs text-[#A3A0B0] space-y-1 font-mono text-[11px]">
                  <div>
                    <span className="font-medium text-[#F2F0F7]">Deliverable: </span>
                    {deliverableName || "Untitled"}
                  </div>
                  <div>
                    <span className="font-medium text-[#F2F0F7]">Initial Task: </span>
                    Script &amp; Production Prep &bull; <span className="font-medium text-[#F2F0F7]">Status: </span>
                    To Do
                  </div>
                  <div>
                    <span className="font-medium text-[#F2F0F7]">Scope: </span>
                    {taskNotesPreview}
                  </div>
                </div>
              </div>

              {/* Footer controls */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                <span className="text-[10px] text-[#A3A0B0] font-mono">
                  Idempotency: {idempotencyKey.substring(0, 16)}...
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-[#F2F0F7] font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExporting || !isApproved || !deliverableName.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer font-sans"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Confirm &amp; Export</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
