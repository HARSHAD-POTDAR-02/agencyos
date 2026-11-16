"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { deliverableApi, approvalApi, publishingApi, API_BASE } from "@/lib/api";
import PublishModal from "@/components/publishing/PublishModal";
import {
  ArrowLeft,
  Upload,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileVideo,
  FileImage,
  FileText,
  Download,
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
  Send,
  BarChart2,
  Heart,
  Eye,
  Share2,
  Undo2,
} from "lucide-react";

interface Comment {
  id: string;
  author_id: string;
  author_name: string | null;
  author_role: string | null;
  message: string;
  is_internal: boolean;
  content_version_id: string | null;
  created_at: string;
}

interface TaskItem {
  id: string;
  deliverable_id: string;
  title: string;
  task_type: string | null;
  status: string;
  priority: string;
}

interface ContentVersion {
  id: string;
  deliverable_id: string;
  task_id?: string | null;
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
  client_id?: string | null;
  client_name?: string | null;
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
    | "scheduled"
    | "publishing"
    | "partially_published"
    | "published"
    | "failed"
    | "needs_reconnection"
    | "ambiguous"
    | "cancelled";
  scheduled_at?: string | null;
  scheduled_timezone?: string | null;
  published_at?: string | null;
  live_post_url?: string | null;
  external_post_id?: string | null;
  publishing_platform?: string | null;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  created_at: string;
  updated_at: string;
  content_versions: ContentVersion[];
  tasks?: TaskItem[];
  comments?: Comment[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const hasTimezone = iso.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(iso);
  const normalized = hasTimezone ? iso : `${iso.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(iso) : d;
}

function formatDate(iso: string): string {
  try {
    return parseDate(iso).toLocaleDateString("en-IN", {
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
  const searchParams = useSearchParams();
  const { activeAgencyId, token, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const fromParam = searchParams.get("from");
  const tabParam = searchParams.get("tab");
  const taskIdParam = searchParams.get("task_id");

  const [deliverable, setDeliverable] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected stage/task filter & version for preview
  const [selectedTaskId, setSelectedTaskId] = useState<string | "all">(taskIdParam || "all");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Upload modal / form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTaskId, setUploadTaskId] = useState<string>(taskIdParam || "none");
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

  // Comments state
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Publishing & Scheduling state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishModalIntent, setPublishModalIntent] = useState<"publish" | "schedule">("publish");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

  const handleCancelSchedule = async () => {
    if (!effectiveAgencyId || !token || !id || !deliverable) return;
    const ok = window.confirm(
      `Cancel the scheduled publication for "${deliverable.title}"? The deliverable will return to Approved status.`
    );
    if (!ok) return;
    try {
      setCancellingSchedule(true);
      await publishingApi.cancelSchedule(effectiveAgencyId, id, token);
      await fetchDeliverable();
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel scheduled publication");
    } finally {
      setCancellingSchedule(false);
    }
  };

  // Metrics update modal state
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsViews, setMetricsViews] = useState(0);
  const [metricsLikes, setMetricsLikes] = useState(0);
  const [metricsComments, setMetricsComments] = useState(0);
  const [metricsShares, setMetricsShares] = useState(0);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [syncingMetrics, setSyncingMetrics] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const fetchDeliverable = useCallback(async () => {
    if (!effectiveAgencyId || !token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const res = (await deliverableApi.get(effectiveAgencyId, id, token)) as DeliverableDetail;
      // Sort versions ascending
      res.content_versions.sort((a, b) => a.version_number - b.version_number);
      setDeliverable(res);

      // Default selected to latest version
      if (res.content_versions.length > 0) {
        setSelectedVersionId(res.content_versions[res.content_versions.length - 1].id);
      }

      // If published with external Meta ID, auto-sync latest metrics in background
      if (res.status === "published" && res.external_post_id) {
        publishingApi
          .syncMetrics(effectiveAgencyId, id, token)
          .then((synced) => {
            setDeliverable((prev) =>
              prev
                ? {
                    ...prev,
                    views_count: synced.views_count,
                    likes_count: synced.likes_count,
                    comments_count: synced.comments_count,
                    shares_count: synced.shares_count,
                  }
                : prev
            );
          })
          .catch((e) => console.log("Background live metrics sync:", e));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deliverable");
    } finally {
      setLoading(false);
    }
  }, [effectiveAgencyId, token, id]);

  const handleSyncLiveMetrics = async () => {
    if (!effectiveAgencyId || !token || !id) return;
    try {
      setSyncingMetrics(true);
      const synced = await publishingApi.syncMetrics(effectiveAgencyId, id, token);
      if (synced.post_deleted) {
        alert("This post was deleted on Meta (Facebook/Instagram). It has been removed from Published Live and returned to Ready to Publish.");
        await fetchDeliverable();
        window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
      } else {
        setDeliverable((prev) =>
          prev
            ? {
                ...prev,
                views_count: synced.views_count,
                likes_count: synced.likes_count,
                comments_count: synced.comments_count,
                shares_count: synced.shares_count,
              }
            : prev
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sync metrics from Meta");
    } finally {
      setSyncingMetrics(false);
    }
  };

  const handleUnpublish = async () => {
    if (!effectiveAgencyId || !token || !id || !deliverable) return;
    const ok = window.confirm(
      `Remove "${deliverable.title}" from Published Live? This deliverable will be moved back to Ready to Publish.`
    );
    if (!ok) return;
    try {
      await publishingApi.unpublish(effectiveAgencyId, id, token);
      await fetchDeliverable();
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unpublish deliverable");
    }
  };

  useEffect(() => {
    fetchDeliverable();
  }, [fetchDeliverable]);

  useEffect(() => {
    if (taskIdParam) {
      setSelectedTaskId(taskIdParam);
      setUploadTaskId(taskIdParam);
    }
  }, [taskIdParam]);

  // Production Stage / Task Scoping
  const tasksList = deliverable?.tasks || [];
  const activeTask = tasksList.find((t) => t.id === selectedTaskId);

  const filteredVersions = deliverable
    ? selectedTaskId === "all"
      ? deliverable.content_versions
      : deliverable.content_versions.filter((v) => v.task_id === selectedTaskId)
    : [];

  const latestVersion =
    filteredVersions.length > 0
      ? filteredVersions[filteredVersions.length - 1]
      : null;

  const currentPreviewVersion =
    filteredVersions.find((v) => v.id === selectedVersionId) || latestVersion;

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAgencyId || !token || !id || !uploadFile) return;

    try {
      setUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadCaption.trim()) formData.append("caption", uploadCaption.trim());
      if (uploadNotes.trim()) formData.append("notes", uploadNotes.trim());
      if (uploadTaskId && uploadTaskId !== "none") {
        formData.append("task_id", uploadTaskId);
      }

      const newVersion = (await deliverableApi.uploadVersion(
        effectiveAgencyId,
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
    if (!effectiveAgencyId || !token || !id) return;
    try {
      await deliverableApi.updateStatus(effectiveAgencyId, id, newStatus, token);
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAgencyId || !token || !id || !newComment.trim()) return;
    try {
      setSubmittingComment(true);
      await deliverableApi.postComment(
        effectiveAgencyId,
        id,
        {
          message: newComment.trim(),
          content_version_id: selectedVersionId,
          is_internal: false,
        },
        token
      );
      setNewComment("");
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmittingComment(false);
      setTimeout(() => commentInputRef.current?.focus(), 10);
    }
  };

  const handleSubmitApproval = async (decision: "approved" | "changes_requested") => {
    if (!effectiveAgencyId || !token || !currentPreviewVersion) return;
    try {
      setSubmittingReview(true);
      await approvalApi.submit(
        effectiveAgencyId,
        currentPreviewVersion.id,
        { decision, comment: reviewComment.trim() || undefined },
        token
      );

      // Also update deliverable status
      const nextDeliverableStatus =
        decision === "approved" ? "approved" : "changes_requested";
      await deliverableApi.updateStatus(effectiveAgencyId, id, nextDeliverableStatus, token);

      setReviewComment("");
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Approval submission failed");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!effectiveAgencyId || !token || !id) return;
    if (!confirm("Are you sure you want to delete this version?")) return;
    try {
      await deliverableApi.deleteVersion(effectiveAgencyId, id, versionId, token);
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete version");
    }
  };

  const openMetricsModal = () => {
    setMetricsViews(deliverable?.views_count || 0);
    setMetricsLikes(deliverable?.likes_count || 0);
    setMetricsComments(deliverable?.comments_count || 0);
    setMetricsShares(deliverable?.shares_count || 0);
    setShowMetricsModal(true);
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAgencyId || !token || !id) return;
    try {
      setSavingMetrics(true);
      await publishingApi.updateMetrics(
        effectiveAgencyId,
        id,
        {
          views_count: Number(metricsViews),
          likes_count: Number(metricsLikes),
          comments_count: Number(metricsComments),
          shares_count: Number(metricsShares),
        },
        token
      );
      setShowMetricsModal(false);
      await fetchDeliverable();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update metrics");
    } finally {
      setSavingMetrics(false);
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
            <Clock className="w-3.5 h-3.5 text-[#A3A0B0]" />
            Not Started
          </span>
        );
      case "in_production":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Film className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            In Production
          </span>
        );
      case "internal_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A78BFA]" />
            Internal Review
          </span>
        );
      case "client_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            Client Review
          </span>
        );
      case "changes_requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Changes Requested
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Approved
          </span>
        );
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Published
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#101014]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#A78BFA] mx-auto" />
          <p className="text-xs font-bold text-[#A3A0B0]">Loading deliverable workspace & media...</p>
        </div>
      </div>
    );
  }

  const getBackLink = () => {
    if (fromParam === "tasks") {
      return { href: "/tasks", label: "Tasks" };
    }
    if (tabParam) {
      return { href: `/approvals?tab=${tabParam}`, label: "Approvals Queue" };
    }
    if (deliverable?.status === "published") {
      return { href: "/approvals?tab=published", label: "Approvals Queue" };
    }
    if (deliverable?.status === "approved") {
      return { href: "/approvals?tab=approved", label: "Approvals Queue" };
    }
    if (deliverable?.status === "changes_requested") {
      return { href: "/approvals?tab=changes_requested", label: "Approvals Queue" };
    }
    return { href: "/approvals", label: "Approvals Queue" };
  };

  const backLink = getBackLink();

  if (error || !deliverable) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-[#101014] text-[#F2F0F7] min-h-[60vh] flex flex-col items-center justify-center">
        <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl inline-block">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-[#F2F0F7]">Deliverable Not Found</h2>
        <p className="text-xs text-[#A3A0B0]">{error || "Unable to locate this deliverable record."}</p>
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {backLink.label}
        </Link>
      </div>
    );
  }

  const previewFileName = currentPreviewVersion?.file_name?.toLowerCase() || "";
  const previewFileType = currentPreviewVersion?.file_type?.toLowerCase() || "";

  const isVideo =
    previewFileType.startsWith("video/") ||
    previewFileName.endsWith(".mp4") ||
    previewFileName.endsWith(".mov") ||
    previewFileName.endsWith(".webm");

  const isPdf =
    previewFileType === "application/pdf" ||
    previewFileName.endsWith(".pdf");

  const isDoc =
    previewFileType.includes("word") ||
    previewFileType.includes("officedocument") ||
    previewFileName.endsWith(".docx") ||
    previewFileName.endsWith(".doc");

  const isTxt =
    previewFileType.startsWith("text/") ||
    previewFileName.endsWith(".txt");

  const isDocument = isPdf || isDoc || isTxt;

  const mediaUrl = currentPreviewVersion
    ? `${API_BASE}/uploads/${currentPreviewVersion.storage_key}`
    : null;

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6 bg-[#101014] text-[#F2F0F7] min-h-screen">
      {/* Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[#A3A0B0]">
          <Link href={backLink.href} className="hover:text-[#A78BFA] flex items-center gap-1 font-semibold transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {backLink.label}
          </Link>
          <ChevronRight className="w-3 h-3 text-[#30303D]" />
          <span className="text-[#F2F0F7] font-bold truncate max-w-xs">{deliverable.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Quick-Select */}
          <div className="flex items-center gap-1.5 bg-[#17171E] border border-[#30303D] rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-[#A3A0B0]">Pipeline Status:</span>
            <select
              value={deliverable.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className="text-xs font-bold text-[#F2F0F7] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="not_started" className="bg-[#17171E] text-[#F2F0F7]">Not Started</option>
              <option value="in_production" className="bg-[#17171E] text-[#F2F0F7]">In Production</option>
              <option value="internal_review" className="bg-[#17171E] text-[#F2F0F7]">Internal Review</option>
              <option value="client_review" className="bg-[#17171E] text-[#F2F0F7]">Client Review</option>
              <option value="changes_requested" className="bg-[#17171E] text-[#F2F0F7]">Changes Requested</option>
              <option value="approved" className="bg-[#17171E] text-[#F2F0F7]">Approved</option>
              <option value="scheduled" className="bg-[#17171E] text-[#F2F0F7]">Scheduled</option>
              <option value="publishing" className="bg-[#17171E] text-[#F2F0F7]">Publishing...</option>
              <option value="partially_published" className="bg-[#17171E] text-[#F2F0F7]">Partially Published</option>
              <option value="published" className="bg-[#17171E] text-[#F2F0F7]">Published</option>
              <option value="needs_reconnection" className="bg-[#17171E] text-[#F2F0F7]">Needs Reconnection</option>
              <option value="ambiguous" className="bg-[#17171E] text-[#F2F0F7]">Reconciling</option>
            </select>
          </div>

          {/* Action buttons based on status */}
          {(deliverable.status === "approved" || deliverable.status === "partially_published") && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPublishModalIntent("schedule");
                  setIsRescheduling(false);
                  setShowPublishModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#F2F0F7] text-xs font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>{deliverable.status === "partially_published" ? "Schedule Remaining" : "Schedule Post"}</span>
              </button>
              <button
                onClick={() => {
                  setPublishModalIntent("publish");
                  setIsRescheduling(false);
                  setShowPublishModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{deliverable.status === "partially_published" ? "Publish Remaining Live" : "Publish Live"}</span>
              </button>
            </div>
          )}

          {deliverable.status === "scheduled" && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPublishModalIntent("schedule");
                  setIsRescheduling(true);
                  setShowPublishModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#20202A] border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => {
                  setPublishModalIntent("publish");
                  setIsRescheduling(false);
                  setShowPublishModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish Now</span>
              </button>
              <button
                onClick={handleCancelSchedule}
                disabled={cancellingSchedule}
                className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-rose-500/10 text-[#A3A0B0] hover:text-rose-400 border border-[#30303D] text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-[#A3A0B0]" />
                <span>{cancellingSchedule ? "Cancelling..." : "Cancel"}</span>
              </button>
            </div>
          )}

          {/* View Live Post (when published) */}
          {deliverable.status === "published" && deliverable.live_post_url && (
            <a
              href={deliverable.live_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#20202A] hover:bg-[#262630] border border-indigo-500/40 text-indigo-300 text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Post</span>
            </a>
          )}

          {/* Unpublish Button (when published or partially published) */}
          {(deliverable.status === "published" || deliverable.status === "partially_published") && (
            <button
              onClick={handleUnpublish}
              title="Remove from Published Live"
              className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-rose-500/15 text-rose-400 border border-[#30303D] text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Unpublish</span>
            </button>
          )}

          {/* Upload Button */}
          <button
            onClick={() => {
              setUploadTaskId(selectedTaskId !== "all" ? selectedTaskId : "none");
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload New Version</span>
          </button>
        </div>
      </div>

      {/* Deliverable Meta Header */}
      <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
              <Film className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-[#F2F0F7] tracking-tight">
              {deliverable.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#A3A0B0]">
            {deliverable.client_name && (
              <>
                <span className="font-bold text-[#A78BFA] bg-[#A78BFA]/10 px-2.5 py-0.5 rounded-md border border-[#A78BFA]/30">
                  {deliverable.client_name}
                </span>
                <span>&bull;</span>
              </>
            )}
            <span className="capitalize font-semibold text-[#F2F0F7] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-md">
              {deliverable.platform}
            </span>
            <span>&bull;</span>
            <span className="capitalize font-semibold text-[#F2F0F7] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-md">
              {deliverable.deliverable_type}
            </span>
            {deliverable.planned_date && (
              <>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-[#A3A0B0]">
                  <Calendar className="w-3 h-3 text-[#A3A0B0]" />
                  Planned: {deliverable.planned_date}
                </span>
              </>
            )}
            <span>&bull;</span>
            <span className="text-[#A3A0B0]">{deliverable.content_versions.length} versions tracked</span>
          </div>
        </div>

        <div>{getStatusBadge(deliverable.status)}</div>
      </div>

      {/* Live Publishing & Performance Banner (when published or partially published) */}
      {(deliverable.status === "published" || deliverable.status === "partially_published") && (
        <div className="bg-[#17171E] text-white rounded-2xl p-5 border border-indigo-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30303D]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-wider ${deliverable.status === "partially_published" ? "text-amber-400" : "text-emerald-400"} flex items-center gap-1.5`}>
                    <span className={`w-2 h-2 rounded-full ${deliverable.status === "partially_published" ? "bg-amber-400" : "bg-emerald-400 animate-ping"} inline-block`} />
                    {deliverable.status === "partially_published" ? "Partially Published Live" : "Published Live"}
                  </span>
                  <span className="text-xs text-[#A3A0B0]">&bull;</span>
                  <span className="text-xs text-indigo-300 capitalize font-medium">
                    {deliverable.publishing_platform || deliverable.platform}
                  </span>
                  {deliverable.published_at && (
                    <>
                      <span className="text-xs text-[#A3A0B0]">&bull;</span>
                      <span className="text-xs text-[#A3A0B0] font-mono">
                        {formatDate(deliverable.published_at)}
                      </span>
                    </>
                  )}
                </div>
                {deliverable.external_post_id && (
                  <p className="text-[11px] text-[#A3A0B0] font-mono mt-0.5">
                    Post ID: {deliverable.external_post_id}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {deliverable.external_post_id && (
                <button
                  onClick={handleSyncLiveMetrics}
                  disabled={syncingMetrics}
                  title="Query Meta Graph API for real-time likes, views, comments"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-300 ${syncingMetrics ? "animate-spin" : ""}`} />
                  <span>{syncingMetrics ? "Syncing..." : "Sync Live Stats"}</span>
                </button>
              )}
              <button
                onClick={openMetricsModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#F2F0F7] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Edit Manual</span>
              </button>
              <button
                onClick={handleUnpublish}
                title="Remove deliverable from Published Live"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-rose-300" />
                <span>Unpublish</span>
              </button>
              {deliverable.live_post_url && (
                <a
                  href={deliverable.live_post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Live Post</span>
                </a>
              )}
            </div>
          </div>

          {/* Metrics summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-[#101014] border border-[#30303D] rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[#A3A0B0] text-[10px] font-bold uppercase tracking-wider">
                <Eye className="w-3 h-3 text-indigo-300" /> Views
              </div>
              <p className="text-lg font-black text-[#F2F0F7] mt-1">
                {(deliverable.views_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#101014] border border-[#30303D] rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[#A3A0B0] text-[10px] font-bold uppercase tracking-wider">
                <Heart className="w-3 h-3 text-rose-400" /> Likes
              </div>
              <p className="text-lg font-black text-[#F2F0F7] mt-1">
                {(deliverable.likes_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#101014] border border-[#30303D] rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[#A3A0B0] text-[10px] font-bold uppercase tracking-wider">
                <MessageSquare className="w-3 h-3 text-amber-400" /> Comments
              </div>
              <p className="text-lg font-black text-[#F2F0F7] mt-1">
                {(deliverable.comments_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#101014] border border-[#30303D] rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[#A3A0B0] text-[10px] font-bold uppercase tracking-wider">
                <Share2 className="w-3 h-3 text-emerald-400" /> Shares
              </div>
              <p className="text-lg font-black text-[#F2F0F7] mt-1">
                {(deliverable.shares_count || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#101014] border border-[#30303D] rounded-xl p-3 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-[#A3A0B0] text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#A78BFA]" /> Engagement
              </div>
              <p className="text-lg font-black text-[#A78BFA] mt-1">
                {(((deliverable.likes_count || 0) + (deliverable.comments_count || 0) + (deliverable.shares_count || 0)) /
                  Math.max(deliverable.views_count || 1, 1) *
                  100).toFixed(1)}
                %
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Production Stage & Task Isolation Switcher */}
      {tasksList.length > 0 && (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
            <span className="text-[11px] font-bold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Production Stage &amp; Task Media Scoping</span>
            </span>
            <span className="text-[11px] text-[#A3A0B0]">
              Each task has its own isolated assets so stages don&apos;t mix
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* All Deliverable Versions */}
            <button
              type="button"
              onClick={() => {
                setSelectedTaskId("all");
                if (deliverable.content_versions.length > 0) {
                  setSelectedVersionId(deliverable.content_versions[deliverable.content_versions.length - 1].id);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTaskId === "all"
                  ? "bg-[#A78BFA] text-[#101014]"
                  : "bg-[#20202A] text-[#A3A0B0] hover:bg-[#262630] hover:text-[#F2F0F7] border border-[#30303D]"
              }`}
            >
              <span>All Versions</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedTaskId === "all" ? "bg-[#8B5CF6] text-white" : "bg-[#17171E] text-[#A3A0B0]"
                }`}
              >
                {deliverable.content_versions.length}
              </span>
            </button>

            {/* Per-Task Stage Tabs */}
            {tasksList.map((t) => {
              const count = deliverable.content_versions.filter((v) => v.task_id === t.id).length;
              const isSelected = selectedTaskId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(t.id);
                    const taskVers = deliverable.content_versions.filter((v) => v.task_id === t.id);
                    if (taskVers.length > 0) {
                      setSelectedVersionId(taskVers[taskVers.length - 1].id);
                    } else {
                      setSelectedVersionId(null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#A78BFA] text-[#101014]"
                      : "bg-[#20202A] text-[#A3A0B0] hover:bg-[#262630] hover:text-[#F2F0F7] border border-[#30303D]"
                  }`}
                >
                  <span className="truncate max-w-[170px]">{t.title.split("(")[0].trim()}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? "bg-[#8B5CF6] text-white" : "bg-[#17171E] text-[#A3A0B0]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Media Player + Caption & Notes */}
        <div className="lg:col-span-8 space-y-6">
          {/* Media Player Card */}
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#F2F0F7] tracking-tight">
                  Media Preview
                </span>
                {currentPreviewVersion && (
                  <span className="text-[11px] font-black text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-2 py-0.5 rounded-full">
                    Version {currentPreviewVersion.version_number}
                    {currentPreviewVersion.id === latestVersion?.id && " (Latest)"}
                  </span>
                )}
                {activeTask && (
                  <span className="text-[10px] font-bold text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-full">
                    Stage: {activeTask.title.split("(")[0].trim()}
                  </span>
                )}
              </div>

              {mediaUrl && (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#A3A0B0] hover:text-[#A78BFA] flex items-center gap-1 font-semibold"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Actual Player, Document Viewer, Image, or Empty State */}
            {currentPreviewVersion && mediaUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-[#101014] border border-[#30303D] flex items-center justify-center min-h-[380px] max-h-[560px]">
                {isVideo ? (
                  <video
                    key={currentPreviewVersion.id}
                    src={mediaUrl}
                    controls
                    playsInline
                    className="w-full max-h-[500px] object-contain rounded-xl"
                  />
                ) : isPdf ? (
                  <div className="w-full h-[520px] bg-[#101014] rounded-xl overflow-hidden flex flex-col">
                    <div className="bg-[#20202A] px-4 py-2 flex items-center justify-between text-xs text-[#F2F0F7] border-b border-[#30303D]">
                      <span className="font-semibold truncate flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#A78BFA]" />
                        {currentPreviewVersion.file_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={mediaUrl}
                          download={currentPreviewVersion.file_name}
                          className="text-[11px] bg-[#17171E] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border border-[#30303D]"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Open in New Tab
                        </a>
                      </div>
                    </div>
                    <iframe
                      src={mediaUrl}
                      className="w-full flex-1 bg-white border-0"
                      title={currentPreviewVersion.file_name}
                    />
                  </div>
                ) : isDoc || isTxt ? (
                  <div className="w-full min-h-[380px] p-8 bg-[#101014] rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex items-center justify-center text-[#A78BFA] shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-bold text-[#F2F0F7] tracking-wide truncate">
                        {currentPreviewVersion.file_name}
                      </h4>
                      <p className="text-xs text-[#A3A0B0]">
                        {isTxt ? "Plain Text Script / Notes" : "Word Document (.docx) Script"} &bull; {formatBytes(currentPreviewVersion.file_size_bytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Document</span>
                      </a>
                      <a
                        href={mediaUrl}
                        download={currentPreviewVersion.file_name}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-[#30303D] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
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
              <div className="border border-dashed border-[#30303D] rounded-2xl p-10 text-center space-y-3 bg-[#101014]">
                <div className="w-12 h-12 rounded-2xl bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center mx-auto border border-[#A78BFA]/20">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#F2F0F7]">
                  {activeTask
                    ? `No assets uploaded for "${activeTask.title.split("(")[0].trim()}"`
                    : "No assets uploaded yet"}
                </h3>
                <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
                  {activeTask
                    ? `This task has no files attached. Upload a script (.txt/.docx/.pdf) or media asset for the ${activeTask.task_type || "task"} stage.`
                    : "Upload your video cut, script, or creative asset to initiate the review pipeline."}
                </p>
                <button
                  onClick={() => {
                    setUploadTaskId(selectedTaskId !== "all" ? selectedTaskId : "none");
                    setShowUploadModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {activeTask
                      ? `Upload File for ${activeTask.title.split("(")[0].trim()}`
                      : "Upload v1 Draft"}
                  </span>
                </button>
              </div>
            )}

            {/* Asset Metadata Bar */}
            {currentPreviewVersion && (
              <div className="pt-3 border-t border-[#30303D] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">File Name</span>
                  <span className="font-semibold text-[#F2F0F7] truncate block mt-0.5">
                    {currentPreviewVersion.file_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">File Size</span>
                  <span className="font-semibold text-[#F2F0F7] block mt-0.5">
                    {formatBytes(currentPreviewVersion.file_size_bytes)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">Uploaded On</span>
                  <span className="font-semibold text-[#F2F0F7] block mt-0.5">
                    {formatDate(currentPreviewVersion.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">SHA-256 Hash</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[11px] text-[#A3A0B0] truncate max-w-[90px]">
                      {currentPreviewVersion.checksum_sha256}
                    </span>
                    <button
                      onClick={handleCopyChecksum}
                      title="Copy full SHA-256 hash"
                      className="p-1 hover:bg-[#20202A] rounded text-[#A3A0B0] hover:text-[#F2F0F7]"
                    >
                      {copiedChecksum ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Caption & Post Copy Card */}
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#F2F0F7] tracking-tight">
                  Approved Caption & Copy
                </span>
                {currentPreviewVersion?.caption && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Ready to publish
                  </span>
                )}
              </div>
              {currentPreviewVersion?.caption && (
                <button
                  onClick={handleCopyCaption}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-[#B69BFF] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] px-2.5 py-1 rounded-lg transition-colors"
                >
                  {copiedCaption ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
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
              <div className="bg-[#101014] rounded-xl p-4 border border-[#30303D] text-xs text-[#F2F0F7] font-mono whitespace-pre-wrap leading-relaxed">
                {currentPreviewVersion.caption}
              </div>
            ) : (
              <div className="text-xs text-[#A3A0B0] italic py-2">
                No caption has been entered for this version yet.
              </div>
            )}

            {/* Revision Notes */}
            {currentPreviewVersion?.notes && (
              <div className="pt-3 border-t border-[#30303D]">
                <span className="text-[11px] font-bold text-[#A3A0B0] uppercase tracking-wider block mb-1">
                  Editor Revision Notes:
                </span>
                <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  {currentPreviewVersion.notes}
                </p>
              </div>
            )}
          </div>

          {/* Feedback & Collaboration Thread Card */}
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#20202A] text-[#A78BFA] border border-[#30303D]">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-extrabold text-[#F2F0F7] tracking-tight">
                  Client & Team Feedback
                </h3>
              </div>
              <span className="text-[11px] font-black text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-full">
                {deliverable.comments?.length || 0}
              </span>
            </div>

            {(!deliverable.comments || deliverable.comments.length === 0) ? (
              <p className="text-xs text-[#A3A0B0] italic text-center py-4">
                No feedback recorded yet. Client review comments and revisions will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {deliverable.comments.map((c) => {
                  const isClient = c.author_role === "client";
                  return (
                    <div key={c.id} className="flex gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          isClient
                            ? "bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30"
                            : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"
                        }`}
                      >
                        {(c.author_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#F2F0F7]">
                            {c.author_name || "Reviewer"}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                              isClient
                                ? "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20"
                                : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"
                            }`}
                          >
                            {isClient ? "Client" : "Agency Team"}
                          </span>
                          <span className="text-[10px] text-[#A3A0B0]">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                        <div className="text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 leading-relaxed mt-0.5">
                          {c.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Post comment */}
            <form onSubmit={handlePostComment} className="pt-2 border-t border-[#30303D] flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Reply to client or add internal note..."
                className="flex-1 text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] placeholder-[#A3A0B0]/60"
              />
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (4 cols): Version History Timeline & Review Decision */}
        <div className="lg:col-span-4 space-y-6">
          {/* Approval / Review Action Card */}
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-extrabold text-[#F2F0F7] tracking-tight">
                Review & Approvals
              </h3>
            </div>

            <p className="text-xs text-[#A3A0B0] leading-relaxed">
              Verify video pacing, audio loudness, color grading, brand tone, and Indian market suitability before client presentation.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#F2F0F7] block">
                Review Feedback / Revision Notes
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Optional feedback: e.g. 'Hook looks great! Increase music volume slightly in first 3s.'"
                rows={2}
                className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl p-2.5 focus:outline-none focus:border-[#A78BFA] placeholder-[#A3A0B0]/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={submittingReview || !currentPreviewVersion}
                onClick={() => handleSubmitApproval("changes_requested")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Request Changes</span>
              </button>
              <button
                type="button"
                disabled={submittingReview || !currentPreviewVersion}
                onClick={() => handleSubmitApproval("approved")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Cut</span>
              </button>
            </div>

            {/* If approved, show Publish and Schedule triggers */}
            {deliverable.status === "approved" && (
              <div className="pt-3 border-t border-[#30303D] space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Approved & Ready for Delivery</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] leading-tight">
                  This deliverable has passed review. Publish now or set an automated schedule.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPublishModalIntent("schedule");
                      setIsRescheduling(false);
                      setShowPublishModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#F2F0F7] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>Schedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPublishModalIntent("publish");
                      setIsRescheduling(false);
                      setShowPublishModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* If scheduled, show active schedule details card */}
            {deliverable.status === "scheduled" && (
              <div className="pt-3 border-t border-[#30303D] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Scheduled for Publication</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    Queued
                  </span>
                </div>
                <div className="p-2.5 bg-[#101014] rounded-xl border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{deliverable.scheduled_at ? formatDate(deliverable.scheduled_at) : "Target time set"}</span>
                  </div>
                  <div className="text-[10px] text-[#A3A0B0]">
                    Timezone: {deliverable.scheduled_timezone || "UTC"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPublishModalIntent("schedule");
                      setIsRescheduling(true);
                      setShowPublishModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#20202A] border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reschedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSchedule}
                    disabled={cancellingSchedule}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#20202A] hover:bg-rose-500/10 text-[#A3A0B0] hover:text-rose-400 border border-[#30303D] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-[#A3A0B0]" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Version History List Card */}
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#20202A] text-[#A78BFA] border border-[#30303D]">
                  <History className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-extrabold text-[#F2F0F7] tracking-tight">
                  Version Timeline
                </h3>
              </div>
              <span className="text-[11px] font-black text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-full">
                {filteredVersions.length}
              </span>
            </div>

            {filteredVersions.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#A3A0B0]">
                {activeTask
                  ? `No versions uploaded for "${activeTask.title.split("(")[0].trim()}" yet.`
                  : "No versions uploaded yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Render versions in reverse order: latest on top */}
                {[...filteredVersions].reverse().map((v) => {
                  const isSelected = v.id === currentPreviewVersion?.id;
                  const isLatest = v.id === latestVersion?.id;
                  const taskObj = tasksList.find((t) => t.id === v.task_id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersionId(v.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "bg-[#20202A] border-[#A78BFA] ring-1 ring-[#A78BFA]/50"
                          : "bg-[#101014] border-[#30303D] hover:bg-[#20202A]/50 hover:border-[#404050]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              isSelected
                                ? "bg-[#A78BFA] text-[#101014]"
                                : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"
                            }`}
                          >
                            v{v.version_number}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] font-bold text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-1.5 py-0.2 rounded">
                              Latest
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#A3A0B0] font-medium">
                            {formatBytes(v.file_size_bytes)}
                          </span>
                          {!isLatest && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVersion(v.id);
                              }}
                              title="Delete draft version"
                              className="p-1 hover:bg-rose-500/10 rounded text-[#A3A0B0] hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold text-[#F2F0F7] truncate flex items-center gap-1.5">
                        {v.file_name?.match(/\.(pdf|docx|doc|txt)$/i) || v.file_type?.startsWith("text/") || v.file_type?.includes("word") || v.file_type?.includes("pdf") ? (
                          <FileText className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                        ) : v.file_name?.match(/\.(mp4|mov|webm)$/i) || v.file_type?.startsWith("video/") ? (
                          <Film className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <FileImage className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{v.file_name}</span>
                      </div>

                      {/* Task association badge */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {v.task_id ? (
                          <span className="text-[10px] font-bold text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5 text-[#A78BFA]" />
                            <span>{taskObj ? taskObj.title.split("(")[0].trim() : "Task Asset"}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-md">
                            Deliverable Asset
                          </span>
                        )}
                      </div>

                      {v.notes && (
                        <p className="text-[11px] text-[#A3A0B0] line-clamp-2 italic bg-[#101014] p-1.5 rounded border border-[#30303D]">
                          &ldquo;{v.notes}&rdquo;
                        </p>
                      )}

                      <div className="text-[10px] text-[#A3A0B0] flex items-center justify-between pt-1">
                        <span>{formatDate(v.created_at)}</span>
                        {isSelected && (
                          <span className="text-[#A78BFA] font-bold">Active in preview &rarr;</span>
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
        <div className="fixed inset-0 z-50 bg-[#101014]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 text-[#F2F0F7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                  <Upload className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-extrabold text-[#F2F0F7]">
                  Upload Version v{(deliverable.content_versions.length || 0) + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-xs font-bold p-1 rounded-lg hover:bg-[#20202A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadVersion} className="space-y-4">
              {/* Task Scope Selector */}
              <div>
                <label className="text-xs font-bold text-[#F2F0F7] block mb-1.5">
                  Attach to Stage / Task (optional)
                </label>
                <select
                  value={uploadTaskId}
                  onChange={(e) => setUploadTaskId(e.target.value)}
                  className="w-full text-xs font-semibold text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#A78BFA] cursor-pointer"
                >
                  <option value="none">Deliverable Master Asset (General)</option>
                  {tasksList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.task_type || "task"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#A3A0B0] mt-1">
                  Tagging a specific task isolates this media to that stage so other tasks won&apos;t share it.
                </p>
              </div>

              {/* File Dropzone / Picker */}
              <div>
                <label className="text-xs font-bold text-[#F2F0F7] block mb-1.5">
                  Select Reel File, Script, or Creative Asset *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp,.pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
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
                      ? "border-[#A78BFA] bg-[#A78BFA]/10"
                      : "border-[#30303D] hover:border-[#A78BFA]/60 bg-[#101014]"
                  }`}
                >
                  {uploadFile ? (
                    <div className="space-y-1">
                      {uploadFile.name.match(/\.(pdf|docx|doc|txt)$/i) || uploadFile.type.startsWith("text/") || uploadFile.type.includes("pdf") || uploadFile.type.includes("word") ? (
                        <FileText className="w-6 h-6 text-[#A78BFA] mx-auto" />
                      ) : uploadFile.type.startsWith("image/") || uploadFile.name.match(/\.(png|jpe?g|webp|gif)$/i) ? (
                        <FileImage className="w-6 h-6 text-[#A78BFA] mx-auto" />
                      ) : (
                        <FileVideo className="w-6 h-6 text-[#A78BFA] mx-auto" />
                      )}
                      <p className="text-xs font-bold text-[#F2F0F7]">{uploadFile.name}</p>
                      <p className="text-[11px] text-[#A3A0B0]">{formatBytes(uploadFile.size)}</p>
                      <span className="text-[10px] text-[#A78BFA] font-semibold underline block pt-1">
                        Click to change file
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-[#A3A0B0] mx-auto" />
                      <p className="text-xs font-bold text-[#F2F0F7]">
                        Click to browse or drop file here
                      </p>
                      <p className="text-[11px] text-[#A3A0B0]">
                        Supports MP4, MOV, WEBM, PNG, JPG, PDF, DOCX, TXT (up to 500MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs font-bold text-[#F2F0F7] block mb-1.5">
                  Caption & Hashtags (optional)
                </label>
                <textarea
                  rows={3}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Paste Instagram/YouTube caption, hooks, and hashtags..."
                  className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl p-3 focus:outline-none focus:border-[#A78BFA] font-mono placeholder-[#A3A0B0]/60"
                />
              </div>

              {/* Revision Notes */}
              <div>
                <label className="text-xs font-bold text-[#F2F0F7] block mb-1.5">
                  Revision Notes (optional)
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. 'Trimmed hook, added Marathi subtitle track and upbeat BGM'"
                  className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] placeholder-[#A3A0B0]/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30303D]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
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

      {/* Metrics Modal */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 bg-[#101014]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 text-[#F2F0F7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <BarChart2 className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-extrabold text-[#F2F0F7]">
                  Update Performance Metrics
                </h3>
              </div>
              <button
                onClick={() => setShowMetricsModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-xs font-bold p-1 rounded-lg hover:bg-[#20202A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMetrics} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#F2F0F7] block mb-1">
                    Views / Impressions
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricsViews}
                    onChange={(e) => setMetricsViews(Number(e.target.value))}
                    className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#F2F0F7] block mb-1">
                    Likes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricsLikes}
                    onChange={(e) => setMetricsLikes(Number(e.target.value))}
                    className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#F2F0F7] block mb-1">
                    Comments
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricsComments}
                    onChange={(e) => setMetricsComments(Number(e.target.value))}
                    className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#F2F0F7] block mb-1">
                    Shares
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricsShares}
                    onChange={(e) => setMetricsShares(Number(e.target.value))}
                    className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30303D]">
                <button
                  type="button"
                  onClick={() => setShowMetricsModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMetrics}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {savingMetrics ? "Saving..." : "Save Metrics"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish & Schedule Modal */}
      {showPublishModal && deliverable && (
        <PublishModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false);
            setIsRescheduling(false);
          }}
          deliverableId={deliverable.id}
          deliverableTitle={deliverable.title}
          deliverableType={deliverable.deliverable_type}
          platform={deliverable.platform}
          caption={currentPreviewVersion?.caption || undefined}
          clientId={deliverable.client_id || ""}
          clientName={deliverable.client_name || "Client Account"}
          initialIntent={publishModalIntent}
          currentScheduledAt={deliverable.scheduled_at}
          isRescheduling={isRescheduling}
          onSuccess={async () => {
            await fetchDeliverable();
            window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
          }}
        />
      )}
    </main>
  );
}

export default function DeliverableDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[#A3A0B0] bg-[#101014] min-h-screen">Loading deliverable pipeline...</div>
      }
    >
      <DeliverableDetailContent />
    </Suspense>
  );
}
