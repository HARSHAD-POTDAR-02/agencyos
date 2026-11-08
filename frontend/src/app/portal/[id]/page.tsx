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
  client_review:    { label: "Awaiting Your Review",  badge: "bg-amber-50 text-amber-700 border-amber-200",       icon: Clock },
  changes_requested:{ label: "Changes Requested",     badge: "bg-rose-50 text-rose-700 border-rose-200",           icon: AlertCircle },
  approved:         { label: "Approved ✓",            badge: "bg-emerald-50 text-emerald-700 border-emerald-200",  icon: CheckCircle2 },
  published:        { label: "Published",             badge: "bg-blue-50 text-blue-700 border-blue-200",           icon: CheckCircle2 },
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading review workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !deliverable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Content Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{error || "This content could not be found in your review queue."}</p>
          <Link href="/portal" className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  const st = STATUS_CONFIG[deliverable.status] || STATUS_CONFIG["client_review"];
  const StatusIcon = st.icon;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-extrabold text-slate-900 tracking-tight">AgencyOS</span>
            <span className="text-slate-300 mx-1">|</span>
            <Link href="/portal" className="text-xs font-semibold text-slate-500 hover:text-purple-600 flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Review Queue
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold text-slate-800 max-w-[200px] truncate">{deliverable.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium hidden sm:block">{user?.full_name || user?.email}</span>
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors">
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
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{deliverable.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${st.badge}`}>
                <StatusIcon className="w-3 h-3" />
                {st.label}
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{deliverable.platform}</span>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{deliverable.deliverable_type}</span>
              {deliverable.client_name && (
                <span className="text-[11px] text-slate-500">for <span className="font-bold">{deliverable.client_name}</span></span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — Media + Caption (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Media Player, PDF Viewer, Document Card, Image, or Empty State */}
            <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center shadow-md">
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
                  <div className="w-full h-full bg-slate-900 flex flex-col">
                    <div className="bg-slate-800/90 px-4 py-2 flex items-center justify-between text-xs text-slate-200 border-b border-slate-700/80">
                      <span className="font-semibold truncate flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-400" />
                        {currentVersion.file_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={mediaUrl}
                          download={currentVersion.file_name}
                          className="text-[11px] bg-white/10 hover:bg-white/20 text-slate-200 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
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
                  <div className="w-full h-full p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/30 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-bold text-white tracking-wide truncate">
                        {currentVersion.file_name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {isTxt ? "Plain Text Script / Notes" : "Word Document (.docx) Script"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Document</span>
                      </a>
                      <a
                        href={mediaUrl}
                        download={currentVersion.file_name}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
                <div className="text-slate-600 flex flex-col items-center gap-3">
                  <Film className="w-16 h-16 opacity-30" />
                  <p className="text-sm text-slate-500">No asset uploaded yet</p>
                </div>
              )}
            </div>

            {/* Meta strip */}
            {currentVersion && (
              <div className="bg-white rounded-xl border border-slate-200/80 px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-2xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Version</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">v{currentVersion.version_number}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">File</span>
                  <span className="font-semibold text-slate-700 text-xs block mt-0.5 truncate">{currentVersion.file_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Size</span>
                  <span className="font-semibold text-slate-700 text-xs block mt-0.5">{formatBytes(currentVersion.file_size_bytes)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">SHA-256</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[80px]">{currentVersion.checksum_sha256}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(currentVersion.checksum_sha256); setCopiedHash(true); setTimeout(() => setCopiedHash(false), 2000); }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Caption */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-900">Approved Caption &amp; Copy</span>
                {currentVersion?.caption && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(currentVersion.caption!); setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {copiedCaption ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Caption</>}
                  </button>
                )}
              </div>
              {currentVersion?.caption ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                  {currentVersion.caption}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No caption has been set for this version yet.</p>
              )}
              {currentVersion?.notes && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Editor Notes</span>
                  <p className="text-xs text-slate-700 bg-amber-50 border border-amber-200/50 rounded-xl p-3">{currentVersion.notes}</p>
                </div>
              )}
            </div>

            {/* Comment Thread */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700"><MessageSquare className="w-4 h-4" /></span>
                <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">Feedback Thread</h3>
                <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{deliverable.comments.length}</span>
              </div>

              {deliverable.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No comments yet. Be the first to leave feedback.</p>
              ) : (
                <div className="space-y-3">
                  {deliverable.comments.map((c) => {
                    const isMe = c.author_id === user?.id;
                    const isClient = c.author_role === "client";
                    return (
                      <div key={c.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${isClient ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                          {(c.author_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                          <span className="text-[10px] font-bold text-slate-500">
                            {c.author_name || (isClient ? "Client" : "Agency")} · {formatDate(c.created_at)}
                          </span>
                          <div className={`text-xs px-3 py-2 rounded-xl leading-relaxed ${isMe ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                            {c.message}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Post comment */}
              <form onSubmit={handlePostComment} className="pt-2 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Leave a comment or feedback..."
                  className="flex-1 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !comment.trim()}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              {commentError && <p className="text-[11px] text-rose-600 font-semibold">{commentError}</p>}
            </div>
          </div>

          {/* RIGHT — Approval + Version History (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Approval Action Card */}
            <div className={`rounded-2xl border p-5 shadow-2xs space-y-4 ${isLocked ? "bg-emerald-50/60 border-emerald-200/80" : "bg-gradient-to-br from-white to-purple-50/40 border-purple-200/80"}`}>
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${isLocked ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">
                  {isLocked ? "Content Approved ✓" : "Review & Decision"}
                </h3>
              </div>

              {isLocked ? (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 leading-relaxed font-medium">
                  This content has been approved and is ready for publishing. No further action required.
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Review the video above carefully — check pacing, audio, branding, and caption copy before deciding.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 block">Revision Notes / Feedback</label>
                    <textarea
                      value={decisionFeedback}
                      onChange={(e) => setDecisionFeedback(e.target.value)}
                      placeholder="Describe what needs to change, or leave blank if approving..."
                      rows={3}
                      className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
                    />
                  </div>

                  {decisionError && (
                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {decisionError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={submittingDecision || !currentVersion}
                      onClick={() => handleDecision("changes_requested")}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors disabled:opacity-40"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Request Changes
                    </button>
                    <button
                      type="button"
                      disabled={submittingDecision || !currentVersion}
                      onClick={() => handleDecision("approved")}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {submittingDecision ? "Submitting…" : "Approve ✓"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Version Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700"><History className="w-4 h-4" /></span>
                  <h3 className="text-xs font-extrabold text-slate-900 tracking-tight">Version History</h3>
                </div>
                <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {deliverable.content_versions.length}
                </span>
              </div>

              {deliverable.content_versions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No assets uploaded yet.</p>
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
                            ? "bg-purple-50 border-purple-200 shadow-xs"
                            : "border-transparent hover:bg-slate-50 hover:border-slate-200"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${isSelected ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {vIsDoc ? <FileText className="w-3.5 h-3.5" /> : vIsVideo ? <Film className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-black ${isSelected ? "text-purple-700" : "text-slate-700"}`}>
                              Version {v.version_number}
                            </span>
                            {isLatest && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">LATEST</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{formatDate(v.created_at)}</p>
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading…</div>}>
      <PortalDeliverableContent />
    </Suspense>
  );
}

