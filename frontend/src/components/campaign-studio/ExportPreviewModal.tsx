"use client";

import React, { useState, useEffect } from "react";
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

  // Initialize defaults whenever modal opens or active artifact changes
  useEffect(() => {
    if (isOpen && artifact) {
      const defaultName =
        artifact.payload?.deliverable_title ||
        artifact.title ||
        "Creative Deliverable";
      setDeliverableName(defaultName);

      const fmt =
        artifact.payload?.format_type ||
        (artifact.type === "storyboard"
          ? "reel_storyboard"
          : artifact.type === "carousel_deck"
          ? "carousel"
          : artifact.type);
      setTargetFormat(fmt);

      const plat = artifact.payload?.platform || "instagram";
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
  }, [isOpen, artifact]);

  if (!isOpen || !artifact) return null;

  const isApproved =
    artifact.status === "approved" ||
    artifact.status === "exported" ||
    artifact.payload?.is_approved === true ||
    (artifact as any).latest_version?.is_approved === true;

  // Task notes preview
  let taskNotesPreview = "Production asset ready for execution.";
  if (artifact.payload?.scenes && Array.isArray(artifact.payload.scenes)) {
    taskNotesPreview = `Storyboard with ${artifact.payload.scenes.length} scenes ready for shoot.`;
  } else if (artifact.payload?.slides && Array.isArray(artifact.payload.slides)) {
    taskNotesPreview = `Carousel deck with ${artifact.payload.slides.length} slides ready for design.`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="font-bold text-base text-foreground">
                Export to Production Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Convert approved studio draft v{artifact.version} into production Deliverable & Tasks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {exportResult ? (
            /* Success View */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-bold text-lg text-foreground">
                  {exportResult.is_replay ? "Export Recovered (Idempotent Replay)" : "Successfully Exported to Production!"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {exportResult.is_replay
                    ? "An identical export request was already processed. Existing production records were retrieved safely without creating duplicates."
                    : "The creative draft was locked, the audit record was created, and production work items were spawned."}
                </p>
              </div>

              {/* Records Mapping Card */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 text-left space-y-3 max-w-lg mx-auto">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                  <span className="text-muted-foreground font-medium">Production Deliverable</span>
                  <span className="font-semibold text-foreground truncate max-w-[240px]">
                    {exportResult.deliverable_title}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                  <span className="text-muted-foreground font-medium">Production Task</span>
                  <span className="font-semibold text-foreground truncate max-w-[240px]">
                    {exportResult.task_title}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Audit Export ID</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(exportResult.export_id || exportResult.deliverable_id || "").substring(0, 8)}...
                  </span>
                </div>
              </div>

              {/* Navigation CTAs */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {exportResult.deliverable_id && (
                  <Link
                    href={`/deliverables/${exportResult.deliverable_id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow-2xs"
                  >
                    <span>View Deliverable & Script</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Link
                  href="/tasks"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors shadow-2xs"
                >
                  <span>Go to Production Tasks</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground font-medium text-xs transition-colors cursor-pointer"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          ) : (
            /* Export Form */
            <form onSubmit={handleConfirmExport} className="space-y-5">
              {/* Approval status banner */}
              {isApproved ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Artifact v{artifact.version} is <strong>Approved</strong> and eligible for production export.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>This artifact version is currently in <strong>Draft</strong> status. Approval is mandatory prior to export.</span>
                  </div>
                  {onApproveVersion && (
                    <button
                      type="button"
                      onClick={handleApproveInline}
                      disabled={isApproving}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Approve v{artifact.version}</span>
                    </button>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Deliverable Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliverableName}
                    onChange={(e) => setDeliverableName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="e.g. Hero Pour ASMR Reel"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Target Format
                    </label>
                    <select
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                    >
                      <option value="reel_storyboard">Reel Storyboard / Short-Form Video</option>
                      <option value="carousel">Carousel Slide Deck</option>
                      <option value="single_image">Static Graphic / Single Image</option>
                      <option value="hook_comparison">Hook Testing Sprint</option>
                      <option value="campaign_blueprint">Sprint Blueprint</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Platform Channel
                    </label>
                    <select
                      value={targetPlatform}
                      onChange={(e) => setTargetPlatform(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
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
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Planned Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Production Assignee
                    </label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
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

              {/* Task Preview Card */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Film className="w-3.5 h-3.5 text-primary" />
                  <span>Production Task Preview</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium text-foreground">Title: </span>
                    Produce: {deliverableName || "Untitled"}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Type: </span>
                    creative_production &bull; <span className="font-medium text-foreground">Status: </span>
                    To Do &bull; <span className="font-medium text-foreground">Priority: </span>
                    Medium
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Production Notes: </span>
                    {taskNotesPreview}
                  </div>
                </div>
              </div>

              {/* Footer controls */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Key: {idempotencyKey.substring(0, 16)}...
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExporting || !isApproved || !deliverableName.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Confirm & Export</span>
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
