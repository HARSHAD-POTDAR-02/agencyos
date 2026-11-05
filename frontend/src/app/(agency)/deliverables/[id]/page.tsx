"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { deliverableApi, approvalApi, API_BASE } from "@/lib/api";
import {
  ArrowLeft,
  Upload,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileVideo,
  FileImage,
  Trash2,
  ExternalLink,
  ShieldCheck,
  History,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  MessageSquare,
  ChevronRight,
  Layers,
  Calendar,
} from "lucide-react";

interface ContentVersion {
  id: string;
  deliverable_id: string;
  version_number: number;
  storage_key: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  checksum_sha256: string;
  caption: string | null;
  notes: string | null;
  uploaded_by_id: string;
  created_at: string;
}

interface DeliverableDetail {
  id: string;
  campaign_id: string;
  scope_item_id: string | null;
  title: string;
  deliverable_type: string;
  platform: string;
  planned_date: string | null;
  status:
    | "not_started"
    | "in_production"
    | "internal_review"
    | "client_review"
    | "changes_requested"
    | "approved"
    | "published"
    | "cancelled";
  created_at: string;
  updated_at: string;
  content_versions: ContentVersion[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function DeliverableDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { activeAgencyId, token } = useAuth();

  const [deliverable, setDeliverable] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected version for preview (defaults to latest)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Upload modal / form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Approval state
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDeliverable = useCallback(async () => {
    if (!activeAgencyId || !token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const res = (await deliverableApi.get(activeAgencyId, id, token)) as DeliverableDetail;
      // Sort versions ascending
      res.content_versions.sort((a, b) => a.version_number - b.version_number);
      setDeliverable(res);

      // Default selected to latest version
      if (res.content_versions.length > 0) {
        setSelectedVersionId(res.content_versions[res.content_versions.length - 1].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deliverable");
    } finally {
      setLoading(false);
    }
  }, [activeAgencyId, token, id]);

  useEffect(() => {
    fetchDeliverable();
  }, [fetchDeliverable]);

  const latestVersion =
    deliverable?.content_versions && deliverable.content_versions.length > 0
      ? deliverable.content_versions[deliverable.content_versions.length - 1]
      : null;

  const currentPreviewVersion =
    deliverable?.content_versions.find((v) => v.id === selectedVersionId) || latestVersion;

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgencyId || !token || !id || !uploadFile) return;

    try {
      setUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadCaption.trim()) formData.append("caption", uploadCaption.trim());
      if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());

      const newVersion = (await deliverableApi.uploadVersion(
        activeAgencyId,
        id,
        formData,
        token
      )) as ContentVersion;

      // Close modal & reset fields
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCaption("");
      setUploadNotes("");

      // Refresh deliverable & select newly uploaded version
      await fetchDeliverable();
      setSelectedVersionId(newVersion.id);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeAgencyId || !token || !id) return;
    try {
      await deliverableApi.updateStatus(activeAgencyId, id, newStatus, token);
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleSubmitApproval = async (decision: "approved" | "changes_requested") => {
    if (!activeAgencyId || !token || !currentPreviewVersion) return;
    try {
      setSubmittingReview(true);
      await approvalApi.submit(
        activeAgencyId,
        currentPreviewVersion.id,
        { decision, comment: reviewComment.trim() || undefined },
        token
      );

      // Also update deliverable status
      const nextDeliverableStatus =
        decision === "approved" ? "approved" : "changes_requested";
      await deliverableApi.updateStatus(activeAgencyId, id, nextDeliverableStatus, token);

      setReviewComment("");
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Approval submission failed");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!activeAgencyId || !token || !id) return;
    if (!confirm("Are you sure you want to delete this version?")) return;
    try {
      await deliverableApi.deleteVersion(activeAgencyId, id, versionId, token);
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete version");
    }
  };

  const handleCopyCaption = () => {
    if (currentPreviewVersion?.caption) {
      navigator.clipboard.writeText(currentPreviewVersion.caption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  const handleCopyChecksum = () => {
    if (currentPreviewVersion?.checksum_sha256) {
      navigator.clipboard.writeText(currentPreviewVersion.checksum_sha256);
      setCopiedChecksum(true);
      setTimeout(() => setCopiedChecksum(false), 2000);
    }
  };

  const getStatusBadge = (status: DeliverableDetail["status"]) => {
    switch (status) {
      case "not_started":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Not Started
          </span>
        );
      case "in_production":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Film className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            In Production
          </span>
        );
      case "internal_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            Internal Review
          </span>
        );
      case "client_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Client Review
          </span>
        );
      case "changes_requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Changes Requested
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Published
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading deliverable workspace & media...</p>
        </div>
      </div>
    );
  }

  if (error || !deliverable) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl inline-block">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Deliverable Not Found</h2>
        <p className="text-xs text-slate-500">{error || "Unable to locate this deliverable record."}</p>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>
      </div>
    );
  }

  const isVideo =
    currentPreviewVersion?.file_type?.startsWith("video/") ||
    currentPreviewVersion?.file_name.endsWith(".mp4") ||
    currentPreviewVersion?.file_name.endsWith(".mov");

  const mediaUrl = currentPreviewVersion
    ? `${API_BASE}/uploads/${currentPreviewVersion.storage_key}`
    : null;

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/tasks" className="hover:text-purple-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Tasks
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-bold truncate max-w-xs">{deliverable.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Quick-Select */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400">Pipeline Status:</span>
            <select
              value={deliverable.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="not_started">Not Started</option>
              <option value="in_production">In Production</option>
              <option value="internal_review">Internal Review</option>
              <option value="client_review">Client Review</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload New Version</span>
          </button>
        </div>
      </div>

      {/* Deliverable Meta Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Film className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {deliverable.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              {deliverable.platform}
            </span>
            <span>&bull;</span>
            <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              {deliverable.deliverable_type}
            </span>
            {deliverable.planned_date && (
              <>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Planned: {deliverable.planned_date}
                </span>
              </>
            )}
            <span>&bull;</span>
            <span>{deliverable.content_versions.length} versions tracked</span>
          </div>
        </div>

        <div>{getStatusBadge(deliverable.status)}</div>
      </div>

      {/* 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Media Player + Caption & Notes */}
        <div className="lg:col-span-8 space-y-6">
          {/* Media Player Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 tracking-tight">
                  Media Preview
                </span>
                {currentPreviewVersion && (
                  <span className="text-[11px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                    Version {currentPreviewVersion.version_number}
                    {currentPreviewVersion.id === latestVersion?.id && " (Latest)"}
                  </span>
                )}
              </div>

              {mediaUrl && (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 font-semibold"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Actual Player or Empty State */}
            {currentPreviewVersion && mediaUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[380px] max-h-[520px]">
                {isVideo ? (
                  <video
                    key={currentPreviewVersion.id}
                    src={mediaUrl}
                    controls
                    playsInline
                    className="w-full max-h-[500px] object-contain rounded-xl"
                  />
                ) : (
                  <img
                    key={currentPreviewVersion.id}
                    src={mediaUrl}
                    alt={currentPreviewVersion.file_name}
                    className="w-full max-h-[500px] object-contain rounded-xl"
                  />
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <FileVideo className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No media uploaded yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Upload your video edit (v1) or creative asset to initiate the internal review pipeline.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload v1 Draft</span>
                </button>
              </div>
            )}

            {/* Asset Metadata Bar */}
            {currentPreviewVersion && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">File Name</span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5">
                    {currentPreviewVersion.file_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">File Size</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {formatBytes(currentPreviewVersion.file_size_bytes)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Uploaded On</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {formatDate(currentPreviewVersion.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">SHA-256 Hash</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[11px] text-slate-600 truncate max-w-[90px]">
                      {currentPreviewVersion.checksum_sha256}
                    </span>
                    <button
                      onClick={handleCopyChecksum}
                      title="Copy full SHA-256 hash"
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                    >
                      {copiedChecksum ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Caption & Post Copy Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900 tracking-tight">
                  Approved Caption & Copy
                </span>
                {currentPreviewVersion?.caption && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Ready to publish
                  </span>
                )}
              </div>
              {currentPreviewVersion?.caption && (
                <button
                  onClick={handleCopyCaption}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {copiedCaption ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Caption
                    </>
                  )}
                </button>
              )}
            </div>

            {currentPreviewVersion?.caption ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                {currentPreviewVersion.caption}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                No caption has been entered for this version yet.
              </div>
            )}

            {/* Revision Notes */}
            {currentPreviewVersion?.notes && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Editor Revision Notes:
                </span>
                <p className="text-xs text-slate-700 bg-amber-50/50 border border-amber-200/50 rounded-xl p-3">
                  {currentPreviewVersion.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Version History Timeline & Review Decision */}
        <div className="lg:col-span-4 space-y-6">
          {/* Approval / Review Action Card */}
          <div className="bg-gradient-to-br from-white to-purple-50/40 rounded-2xl border border-purple-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">
                Review & Approvals
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Verify video pacing, audio loudness, color grading, brand tone, and Indian market suitability before client presentation.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                Review Feedback / Revision Notes
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Optional feedback: e.g. 'Hook looks great! Increase music volume slightly in first 3s.'"
                rows={2}
                className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={submittingReview || !currentPreviewVersion}
                onClick={() => handleSubmitApproval("changes_requested")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors disabled:opacity-50"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Request Changes</span>
              </button>
              <button
                type="button"
                disabled={submittingReview || !currentPreviewVersion}
                onClick={() => handleSubmitApproval("approved")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Cut</span>
              </button>
            </div>
          </div>

          {/* Version History List Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                  <History className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">
                  Version Timeline
                </h3>
              </div>
              <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {deliverable.content_versions.length}
              </span>
            </div>

            {deliverable.content_versions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No versions uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Render versions in reverse order: latest on top */}
                {[...deliverable.content_versions].reverse().map((v) => {
                  const isSelected = v.id === currentPreviewVersion?.id;
                  const isLatest = v.id === latestVersion?.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersionId(v.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "bg-purple-50/60 border-purple-300 ring-2 ring-purple-500/20 shadow-2xs"
                          : "bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              isSelected
                                ? "bg-purple-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            v{v.version_number}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                              Latest
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatBytes(v.file_size_bytes)}
                          </span>
                          {!isLatest && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVersion(v.id);
                              }}
                              title="Delete draft version"
                              className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold text-slate-700 truncate">
                        {v.file_name}
                      </div>

                      {v.notes && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 italic bg-white/80 p-1.5 rounded border border-slate-100">
                          &ldquo;{v.notes}&rdquo;
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                        <span>{formatDate(v.created_at)}</span>
                        {isSelected && (
                          <span className="text-purple-600 font-bold">Active in preview &rarr;</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload New Version Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <Upload className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Upload Version v{(deliverable.content_versions.length || 0) + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadVersion} className="space-y-4">
              {/* File Dropzone / Picker */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select Reel File or Creative Asset *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                    uploadFile
                      ? "border-purple-300 bg-purple-50/40"
                      : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                  }`}
                >
                  {uploadFile ? (
                    <div className="space-y-1">
                      <FileVideo className="w-6 h-6 text-purple-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-900">{uploadFile.name}</p>
                      <p className="text-[11px] text-slate-500">{formatBytes(uploadFile.size)}</p>
                      <span className="text-[10px] text-purple-600 font-semibold underline block pt-1">
                        Click to change file
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        Click to browse or drag video here
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supports MP4, MOV, WEBM, PNG, JPG (up to 500MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Caption & Hashtags (optional)
                </label>
                <textarea
                  rows={3}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Paste Instagram/YouTube caption, hooks, and hashtags..."
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                />
              </div>

              {/* Revision Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Revision Notes (optional)
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. 'Trimmed hook, added Marathi subtitle track and upbeat BGM'"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-xs disabled:opacity-50 transition-all"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading & Hashing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" /> Upload Version
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DeliverableDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">Loading deliverable pipeline...</div>
      }
    >
      <DeliverableDetailContent />
    </Suspense>
  );
}
