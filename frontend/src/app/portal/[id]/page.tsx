"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { portalApi, API_BASE } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Send,
  History,
  ChevronRight,
  LogOut,
} from "lucide-react";

interface ContentVersion {
  id: string;
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

interface Comment {
  id: string;
  author_id: string;
  author_name: string | null;
  author_role: string | null;
  message: string;
  content_version_id: string | null;
  created_at: string;
}

interface DeliverableDetail {
  id: string;
  title: string;
  deliverable_type: string;
  platform: string;
  planned_date: string | null;
  status: string;
  client_name: string | null;
  campaign_name: string | null;
  content_versions: ContentVersion[];
  comments: Comment[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  client_review:    { label: "Awaiting Your Review",  badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",   icon: Clock },
  changes_requested:{ label: "Changes Requested",     badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",   icon: AlertCircle },
  approved:         { label: "Approved ✓",            badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",  icon: CheckCircle2 },
  published:        { label: "Published",             badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",   icon: CheckCircle2 },
};

function PortalDeliverableContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, logout, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/login");
    }
  }, [authLoading, token, router]);

  const [deliverable, setDeliverable] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchDeliverable = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const data = (await portalApi.deliverable(id, token)) as DeliverableDetail;
      data.content_versions.sort((a, b) => a.version_number - b.version_number);
      setDeliverable(data);
      if (data.content_versions.length > 0) {
        setSelectedVersionId(data.content_versions[data.content_versions.length - 1].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load deliverable.");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { fetchDeliverable(); }, [fetchDeliverable]);

  const currentVersion = deliverable?.content_versions.find((v) => v.id === selectedVersionId) || null;
  const isLocked = deliverable?.status === "approved" || deliverable?.status === "published";

  const mediaUrl = currentVersion
    ? `${API_BASE}/uploads/${currentVersion.storage_key}`
    : null;

  const vFileName = currentVersion?.file_name?.toLowerCase() || "";
  const vFileType = currentVersion?.file_type?.toLowerCase() || "";

  const isVideo =
    vFileType.startsWith("video/") ||
    vFileName.endsWith(".mp4") ||
    vFileName.endsWith(".mov") ||
    vFileName.endsWith(".webm");

  const isPdf =
    vFileType === "application/pdf" ||
    vFileName.endsWith(".pdf");

  const isDoc =
    vFileType.includes("word") ||
    vFileType.includes("officedocument") ||
    vFileName.endsWith(".docx") ||
    vFileName.endsWith(".doc");

  const isTxt =
    vFileType.startsWith("text/") ||
    vFileName.endsWith(".txt");

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !comment.trim() || !id) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      await portalApi.postComment(id, comment.trim(), token, currentVersion?.id);
      setComment("");
      await fetchDeliverable();
    } catch (err: any) {
      setCommentError(err.message || "Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDecision = async (decision: "approved" | "changes_requested") => {
    if (!token || !currentVersion || !id) return;
    if (decision === "changes_requested" && !decisionFeedback.trim()) {
      setDecisionError("Please explain what changes are needed before requesting.");
      return;
    }
    setSubmittingDecision(true);
    setDecisionError(null);
    try {
      await portalApi.decide(id, currentVersion.id, decision, decisionFeedback.trim() || undefined, token);
      setDecisionFeedback("");
      await fetchDeliverable();
    } catch (err: any) {
      setDecisionError(err.message || "Failed to submit decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101014] text-[#F2F0F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#71717A]">Loading review workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !deliverable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#101014]">
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-10 text-center max-w-md shadow-sm">
          <AlertCircle className="w-10 h-10 text-[#E16F7B] mx-auto mb-3" />
          <h2 className="text-base font-heading font-bold text-[#F2F0F7]">Content Not Found</h2>
          <p className="text-xs text-[#A3A0B0] mt-1 mb-4">{error || "This content could not be found in your review queue."}</p>
          <Link href="/portal" className="inline-flex items-center gap-2 bg-[#A78BFA] text-[#101014] text-xs font-bold px-4 py-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  const st = STATUS_CONFIG[deliverable.status] || STATUS_CONFIG["client_review"];
  const StatusIcon = st.icon;

  return (
    <div className="min-h-screen bg-[#101014] text-[#F2F0F7]">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 bg-[#17171E] border-b border-[#30303D]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
              <Sparkles className="w-4 h-4 text-[#A78BFA]" />
            </div>
            <span className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight">AgencyOS</span>
            <span className="text-[#30303D] mx-1">|</span>
            <Link href="/portal" className="text-xs font-medium text-[#A3A0B0] hover:text-[#A78BFA] flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Review Queue
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#30303D]" />
            <span className="text-xs font-semibold text-[#F2F0F7] max-w-[200px] truncate">{deliverable.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#A3A0B0] font-medium hidden sm:block">{user?.full_name || user?.email}</span>
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A3A0B0] hover:text-[#E16F7B] bg-[#20202A] hover:bg-[#E16F7B]/10 border border-[#30303D] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="text-xl font-heading font-bold text-[#F2F0F7] tracking-tight">{deliverable.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase border ${st.badge}`}>
                <StatusIcon className="w-3 h-3" />
                {st.label}
              </span>
              <span className="text-[11px] font-mono font-bold text-[#A3A0B0] bg-[#17171E] border border-[#30303D] px-2 py-0.5 rounded-full">{deliverable.platform}</span>
              <span className="text-[11px] font-mono font-bold text-[#A3A0B0] bg-[#17171E] border border-[#30303D] px-2 py-0.5 rounded-full">{deliverable.deliverable_type}</span>
              {deliverable.client_name && (
                <span className="text-[11px] text-[#A3A0B0]">for <span className="font-semibold text-[#F2F0F7]">{deliverable.client_name}</span></span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — Media + Caption (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Media Player, PDF Viewer, Document Card, Image, or Empty State */}
            <div className="bg-[#101014] border border-[#30303D] rounded-2xl overflow-hidden aspect-video flex items-center justify-center shadow-md">
              {mediaUrl && currentVersion ? (
                isVideo ? (
                  <video
                    ref={videoRef}
                    key={currentVersion.id}
                    src={mediaUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : isPdf ? (
                  <div className="w-full h-full bg-[#101014] flex flex-col">
                    <div className="bg-[#17171E] px-4 py-2 flex items-center justify-between text-xs text-[#F2F0F7] border-b border-[#30303D]">
                      <span className="font-semibold truncate flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#A78BFA]" />
                        {currentVersion.file_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={mediaUrl}
                          download={currentVersion.file_name}
                          className="text-[11px] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#F2F0F7] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
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
                      title={currentVersion.file_name}
                    />
                  </div>
                ) : isDoc || isTxt ? (
                  <div className="w-full h-full p-8 bg-[#17171E] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-bold text-[#F2F0F7] tracking-wide truncate">
                        {currentVersion.file_name}
                      </h4>
                      <p className="text-xs text-[#A3A0B0]">
                        {isTxt ? "Plain Text Script / Notes" : "Word Document (.docx) Script"}
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
                        download={currentVersion.file_name}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#F2F0F7] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    key={currentVersion.id}
                    src={mediaUrl}
                    alt={currentVersion.file_name}
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="text-[#30303D] flex flex-col items-center gap-3">
                  <Film className="w-16 h-16 opacity-30" />
                  <p className="text-sm text-[#71717A]">No asset uploaded yet</p>
                </div>
              )}
            </div>

            {/* Meta strip */}
            {currentVersion && (
              <div className="bg-[#17171E] rounded-xl border border-[#30303D] px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#71717A] block">Version</span>
                  <span className="font-mono font-bold text-[#F2F0F7] text-sm block mt-0.5">v{currentVersion.version_number}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#71717A] block">File</span>
                  <span className="font-medium text-[#F2F0F7] text-xs block mt-0.5 truncate">{currentVersion.file_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#71717A] block">Size</span>
                  <span className="font-mono text-[#A3A0B0] text-xs block mt-0.5">{formatBytes(currentVersion.file_size_bytes)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#71717A] block">SHA-256</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[10px] text-[#71717A] truncate max-w-[80px]">{currentVersion.checksum_sha256}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(currentVersion.checksum_sha256); setCopiedHash(true); setTimeout(() => setCopiedHash(false), 2000); }}
                      className="p-0.5 hover:bg-[#20202A] rounded text-[#71717A] hover:text-[#F2F0F7]"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-[#45B88A]" /> : <Copy className="w-3 h-3 text-[#71717A]" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Caption */}
            <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#F2F0F7]">Approved Caption &amp; Copy</span>
                {currentVersion?.caption && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(currentVersion.caption!); setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] hover:text-[#B69BFF] bg-[#20202A] px-2.5 py-1 rounded-lg border border-[#30303D] transition-colors"
                  >
                    {copiedCaption ? <><Check className="w-3.5 h-3.5 text-[#45B88A]" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Caption</>}
                  </button>
                )}
              </div>
              {currentVersion?.caption ? (
                <div className="bg-[#101014] rounded-xl p-4 border border-[#30303D] text-xs text-[#F2F0F7] font-mono whitespace-pre-wrap leading-relaxed">
                  {currentVersion.caption}
                </div>
              ) : (
                <p className="text-xs text-[#71717A] italic">No caption has been set for this version yet.</p>
              )}
              {currentVersion?.notes && (
                <div className="mt-3 pt-3 border-t border-[#30303D]">
                  <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">Editor Notes</span>
                  <p className="text-xs text-[#A3A0B0] bg-[#20202A] border border-[#30303D] rounded-xl p-3">{currentVersion.notes}</p>
                </div>
              )}
            </div>

            {/* Comment Thread */}
            <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#20202A] border border-[#30303D] text-[#A78BFA]"><MessageSquare className="w-4 h-4" /></span>
                <h3 className="text-xs font-heading font-bold text-[#F2F0F7] tracking-tight">Feedback Thread</h3>
                <span className="text-[11px] font-mono font-bold text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-full">{deliverable.comments.length}</span>
              </div>

              {deliverable.comments.length === 0 ? (
                <p className="text-xs text-[#71717A] italic text-center py-4">No comments yet. Be the first to leave feedback.</p>
              ) : (
                <div className="space-y-3">
                  {deliverable.comments.map((c) => {
                    const isMe = c.author_id === user?.id;
                    const isClient = c.author_role === "client";
                    return (
                      <div key={c.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${isClient ? "bg-[#A78BFA]/20 text-[#A78BFA]" : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"}`}>
                          {(c.author_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                          <span className="text-[10px] font-medium text-[#71717A]">
                            {c.author_name || (isClient ? "Client" : "Agency")} · {formatDate(c.created_at)}
                          </span>
                          <div className={`text-xs px-3 py-2 rounded-xl leading-relaxed ${isMe ? "bg-[#A78BFA] text-[#101014] font-semibold" : "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"}`}>
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
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Leave a comment or feedback..."
                  className="flex-1 text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl px-3 py-2 focus:outline-none focus:border-[#A78BFA] placeholder-[#71717A]"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !comment.trim()}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              {commentError && <p className="text-[11px] text-[#E16F7B] font-semibold">{commentError}</p>}
            </div>
          </div>

          {/* RIGHT — Approval + Version History (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Approval Action Card */}
            <div className={`rounded-2xl border p-5 space-y-4 ${isLocked ? "bg-[#17171E] border-[#45B88A]/40" : "bg-[#17171E] border-[#30303D]"}`}>
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${isLocked ? "bg-[#45B88A]/20 text-[#45B88A]" : "bg-[#20202A] text-[#A78BFA] border border-[#30303D]"}`}>
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-heading font-bold text-[#F2F0F7] tracking-tight">
                  {isLocked ? "Content Approved ✓" : "Review & Decision"}
                </h3>
              </div>

              {isLocked ? (
                <div className="text-xs text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 rounded-xl p-3 leading-relaxed font-medium">
                  This content has been approved and is ready for publishing. No further action required.
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#A3A0B0] leading-relaxed">
                    Review the video above carefully — check pacing, audio, branding, and caption copy before deciding.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[#A3A0B0] block">Revision Notes / Feedback</label>
                    <textarea
                      value={decisionFeedback}
                      onChange={(e) => setDecisionFeedback(e.target.value)}
                      placeholder="Describe what needs to change, or leave blank if approving..."
                      rows={3}
                      className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-xl p-2.5 focus:outline-none focus:border-[#A78BFA] placeholder-[#71717A] resize-none"
                    />
                  </div>

                  {decisionError && (
                    <p className="text-[11px] text-[#E16F7B] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {decisionError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={submittingDecision || !currentVersion}
                      onClick={() => handleDecision("changes_requested")}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#E16F7B]/10 hover:bg-[#E16F7B]/20 text-[#E16F7B] text-xs font-bold rounded-xl border border-[#E16F7B]/30 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Request Changes
                    </button>
                    <button
                      type="button"
                      disabled={submittingDecision || !currentVersion}
                      onClick={() => handleDecision("approved")}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#45B88A] hover:bg-[#52c595] text-[#101014] text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {submittingDecision ? "Submitting…" : "Approve ✓"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Version Timeline */}
            <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#20202A] text-[#A78BFA] border border-[#30303D]"><History className="w-4 h-4" /></span>
                  <h3 className="text-xs font-heading font-bold text-[#F2F0F7] tracking-tight">Version History</h3>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-2 py-0.5 rounded-full">
                  {deliverable.content_versions.length}
                </span>
              </div>

              {deliverable.content_versions.length === 0 ? (
                <p className="text-xs text-[#71717A] text-center py-4">No assets uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...deliverable.content_versions].reverse().map((v, idx) => {
                    const isSelected = v.id === selectedVersionId;
                    const isLatest = idx === 0;
                    const vIsVideo = v.file_name?.match(/\.(mp4|mov|webm)$/i);
                    const vIsDoc = v.file_name?.match(/\.(pdf|docx|doc|txt)$/i);
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVersionId(v.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                          isSelected
                            ? "bg-[#20202A] border-[#A78BFA]/50"
                            : "bg-[#101014] border-[#30303D] hover:border-[#30303D]"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${isSelected ? "bg-[#A78BFA] text-[#101014]" : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"}`}>
                          {vIsDoc ? <FileText className="w-3.5 h-3.5" /> : vIsVideo ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-bold ${isSelected ? "text-[#A78BFA]" : "text-[#F2F0F7]"}`}>
                              Version {v.version_number}
                            </span>
                            {isLatest && (
                              <span className="text-[9px] font-mono font-bold text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-1.5 py-0.5 rounded-full">LATEST</span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#71717A] truncate font-mono">{formatDate(v.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalDeliverablePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-[#71717A] bg-[#101014]">Loading…</div>}>
      <PortalDeliverableContent />
    </Suspense>
  );
}