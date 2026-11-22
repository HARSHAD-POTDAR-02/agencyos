"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  reviewApi,
  PublicReviewRoom,
  PublicContentVersion,
  ReviewComment,
  API_BASE,
} from "@/lib/api";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Sparkles,
  Send,
  Calendar,
  RefreshCw,
  Eye,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  Share2,
} from "lucide-react";

function getMonogram(name?: string | null): string {
  if (!name || !name.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STATUS_MAP: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  client_review: {
    label: "Awaiting Your Review",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    icon: Clock,
  },
  changes_requested: {
    label: "Revisions In Progress",
    badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
    icon: AlertCircle,
  },
  approved: {
    label: "Approved ✓",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    icon: CheckCircle2,
  },
  scheduled: {
    label: "Approved ✓ • Scheduled for Launch",
    badge: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30",
    icon: Calendar,
  },
  published: {
    label: "Published Live ✓",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    icon: CheckCircle2,
  },
};

export default function MagicLinkReviewRoomPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [room, setRoom] = useState<PublicReviewRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Video Timestamp Tracker
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [pinnedTimestamp, setPinnedTimestamp] = useState<number | null>(null);

  // Comment Box State
  const [reviewerName, setReviewerName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<"approved" | "changes_requested">("approved");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Toast / Notification
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Remember reviewer name across visits
  useEffect(() => {
    const savedName = localStorage.getItem("agencyos_reviewer_name");
    if (savedName) {
      setReviewerName(savedName);
    }
  }, []);

  const loadRoom = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reviewApi.getPublicRoom(token);
      setRoom(data);
      if (data.content_versions && data.content_versions.length > 0) {
        setActiveVersionId(data.content_versions[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load review room:", err);
      setError(err?.message || "Failed to load review room. Link may have expired or been revoked.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // Video time tracking
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentVideoTime(videoRef.current.currentTime);
    }
  };

  const jumpToTimestamp = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !reviewerName.trim()) {
      setNotification({ type: "error", text: "Please enter your name and a comment." });
      return;
    }

    // Save name to localStorage
    localStorage.setItem("agencyos_reviewer_name", reviewerName.trim());

    setPostingComment(true);
    try {
      const newComment = await reviewApi.postComment(token, {
        author_name: reviewerName.trim(),
        message: commentText.trim(),
        content_version_id: activeVersionId || undefined,
        timestamp_seconds: pinnedTimestamp !== null ? pinnedTimestamp : undefined,
      });

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              comments: [...prev.comments, newComment],
            }
          : prev
      );

      setCommentText("");
      setPinnedTimestamp(null);
      setNotification({ type: "success", text: "Feedback posted to the creative team!" });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to post comment." });
    } finally {
      setPostingComment(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!reviewerName.trim()) {
      setNotification({ type: "error", text: "Please provide your full name for sign-off." });
      return;
    }

    if (selectedDecision === "changes_requested" && !feedbackNotes.trim()) {
      setNotification({ type: "error", text: "Please describe what changes are needed." });
      return;
    }

    localStorage.setItem("agencyos_reviewer_name", reviewerName.trim());
    setSubmittingDecision(true);
    try {
      const updated = await reviewApi.submitDecision(token, {
        decision: selectedDecision,
        reviewer_name: reviewerName.trim(),
        feedback_notes: feedbackNotes.trim() || undefined,
      });

      setRoom(updated);
      setDecisionModalOpen(false);
      setFeedbackNotes("");
      setNotification({
        type: "success",
        text:
          selectedDecision === "approved"
            ? "Deliverable Approved! The agency team has been notified."
            : "Revision request dispatched to the production team.",
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to submit decision." });
    } finally {
      setSubmittingDecision(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090D] flex items-center justify-center p-6 text-[#F2F0F7]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#A3A0B0]">Opening Secure Client Review Room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#09090D] flex items-center justify-center p-6 text-[#F2F0F7]">
        <div className="max-w-md w-full bg-[#14141A] border border-[#E16F7B]/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 flex items-center justify-center mx-auto text-[#E16F7B]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-heading font-bold text-[#F2F0F7]">Review Link Expired or Invalid</h2>
            <p className="text-xs text-[#A3A0B0] leading-relaxed">
              {error || "This review link is no longer accessible. It may have been completed, expired, or revoked by the agency team."}
            </p>
          </div>
          <p className="text-[11px] font-mono text-[#71717A]">
            Please contact your agency account manager to receive a new active review link.
          </p>
        </div>
      </div>
    );
  }

  const activeVersion =
    room.content_versions.find((v) => v.id === activeVersionId) ||
    room.content_versions[0];

  const isVideo =
    activeVersion?.file_type?.includes("video") ||
    activeVersion?.file_name.endsWith(".mp4") ||
    activeVersion?.file_name.endsWith(".mov");

  const isImage =
    activeVersion?.file_type?.includes("image") ||
    activeVersion?.file_name.endsWith(".png") ||
    activeVersion?.file_name.endsWith(".jpg") ||
    activeVersion?.file_name.endsWith(".jpeg");

  const isApproved = ["approved", "scheduled", "published"].includes(room.status);
  const statusCfg = STATUS_MAP[room.status] || STATUS_MAP.client_review;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="min-h-screen bg-[#09090D] text-[#F2F0F7] flex flex-col selection:bg-[#A78BFA]/30">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="border-b border-white/[0.08] bg-[#101014]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Client Brand Monogram & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#A78BFA] to-[#69A9D8] text-[#101014] font-heading font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
            {getMonogram(room.client_name)}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#A78BFA] uppercase tracking-wider">
                {room.client_name}
              </span>
              <span className="text-white/[0.2] text-xs">/</span>
              <span className="text-xs font-heading font-bold text-[#F2F0F7] truncate max-w-[200px] sm:max-w-xs">
                {room.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#A3A0B0] hidden sm:block">
              Client Review Room • Campaign: {room.campaign_name}
            </p>
          </div>
        </div>

        {/* Status Pill & Share Button */}
        <div className="flex items-center gap-2.5">
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 shadow-xs ${statusCfg.badge}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusCfg.label}</span>
          </div>

          <button
            onClick={copyShareLink}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#171720] hover:bg-[#20202A] border border-white/[0.08] text-xs font-mono text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Copy Review Room Link"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-[#45B88A]" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#A78BFA]" />
            )}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
          </button>
        </div>
      </header>

      {/* ── NOTIFICATION TOAST ── */}
      {notification && (
        <div className="fixed top-16 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3">
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 shadow-xl ${
              notification.type === "success"
                ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30 backdrop-blur-md"
                : "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30 backdrop-blur-md"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.text}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-[#A3A0B0] hover:text-[#F2F0F7] ml-2 cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-28">
        {/* Version Switcher Bar (if > 1 version) */}
        {room.content_versions.length > 1 && (
          <div className="flex items-center justify-between bg-[#121217] p-2 rounded-xl border border-white/[0.06] text-xs font-mono">
            <span className="text-[#A3A0B0] px-2">Asset Versions:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {room.content_versions.map((ver) => (
                <button
                  key={ver.id}
                  onClick={() => setActiveVersionId(ver.id)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeVersion?.id === ver.id
                      ? "bg-[#A78BFA] text-[#101014] font-bold shadow-xs"
                      : "bg-[#171720] hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.04]"
                  }`}
                >
                  V{ver.version_number} {ver.version_number === room.content_versions[0].version_number && "(Latest)"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN: MEDIA PLAYER / SCRIPT READER (Col 8) ── */}
          <div className="lg:col-span-8 space-y-4">
            {/* Visual Canvas Card */}
            <div className="bg-[#121218] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
              {activeVersion?.url && isVideo ? (
                /* High-Res Video Player */
                <div className="relative aspect-video sm:aspect-[16/9] bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={activeVersion.url.startsWith("http") ? activeVersion.url : `${API_BASE}${activeVersion.url}`}
                    controls
                    playsInline
                    onTimeUpdate={handleTimeUpdate}
                    className="w-full h-full object-contain max-h-[580px]"
                  />
                </div>
              ) : activeVersion?.url && isImage ? (
                /* Static Image Post Viewer */
                <div className="relative bg-[#0d0d12] p-4 flex items-center justify-center min-h-[380px]">
                  <img
                    src={activeVersion.url.startsWith("http") ? activeVersion.url : `${API_BASE}${activeVersion.url}`}
                    alt={room.title}
                    className="max-h-[540px] w-auto rounded-xl object-contain shadow-md"
                  />
                </div>
              ) : room.script_blocks && room.script_blocks.length > 0 ? (
                /* Structured Script Beat Teleprompter Card */
                <div className="p-6 space-y-4 bg-gradient-to-b from-[#14141c] to-[#101014]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                      <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">
                        Approved Scene Dialogue & Teleprompter Beats
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#20202A] px-2 py-0.5 rounded-md border border-white/[0.06]">
                      {room.script_blocks.length} Scenes
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {room.script_blocks.map((block, idx) => (
                      <div
                        key={block.id || idx}
                        className="bg-[#0D0D12] p-4 rounded-xl border border-white/[0.06] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-[#A78BFA]">
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span>{block.title}</span>
                          </span>
                          {block.duration_seconds && (
                            <span className="text-[10px] font-normal text-[#A3A0B0]">
                              ~{block.duration_seconds}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-[#F2F0F7] leading-relaxed select-text">
                          {block.spoken_words || "(No dialogue written)"}
                        </p>
                        {block.visual_cue && (
                          <p className="text-[11px] font-mono text-[#69A9D8] pt-1">
                            🎬 Visual: {block.visual_cue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Placeholder if no media uploaded yet */
                <div className="p-12 text-center space-y-2 text-[#A3A0B0]">
                  <Film className="w-8 h-8 text-[#A78BFA]/50 mx-auto" />
                  <p className="text-xs font-mono">No video cut uploaded for this version yet.</p>
                </div>
              )}

              {/* Caption & Post Details Bar */}
              {(activeVersion?.caption || activeVersion?.notes) && (
                <div className="p-4 border-t border-white/[0.08] bg-[#0E0E14] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[#A3A0B0]">
                    <span className="font-semibold text-[#F2F0F7]">Post Caption & Accompanying Copy</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeVersion.caption || "");
                        setNotification({ type: "success", text: "Caption copied to clipboard!" });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#A78BFA] hover:text-[#c4b5fd] transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <p className="text-xs text-[#F2F0F7] leading-relaxed whitespace-pre-wrap font-sans bg-[#14141C] p-3 rounded-xl border border-white/[0.04] select-text">
                    {activeVersion.caption || activeVersion.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Deliverable Meta Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#121218] p-3 rounded-xl border border-white/[0.06] space-y-1 font-mono text-xs">
                <span className="text-[10px] text-[#A3A0B0] block uppercase">Platform</span>
                <span className="font-bold text-[#F2F0F7] uppercase">{room.platform}</span>
              </div>
              <div className="bg-[#121218] p-3 rounded-xl border border-white/[0.06] space-y-1 font-mono text-xs">
                <span className="text-[10px] text-[#A3A0B0] block uppercase">Format</span>
                <span className="font-bold text-[#F2F0F7] capitalize">{room.deliverable_type}</span>
              </div>
              <div className="bg-[#121218] p-3 rounded-xl border border-white/[0.06] space-y-1 font-mono text-xs">
                <span className="text-[10px] text-[#A3A0B0] block uppercase">Target Date</span>
                <span className="font-bold text-[#F2F0F7]">
                  {room.planned_date ? formatDate(room.planned_date) : "TBD"}
                </span>
              </div>
              <div className="bg-[#121218] p-3 rounded-xl border border-white/[0.06] space-y-1 font-mono text-xs">
                <span className="text-[10px] text-[#A3A0B0] block uppercase">Review Stage</span>
                <span className="font-bold text-[#45B88A]">{statusCfg.label}</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: DISCUSSION & FEEDBACK FEED (Col 4) ── */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#121218] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#A78BFA]" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F2F0F7]">
                    Feedback & Notes ({room.comments.length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#71717A]">Real-time sync</span>
              </div>

              {/* Comments Scroll Feed */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {room.comments.length === 0 ? (
                  <div className="text-center py-8 space-y-2 text-[#71717A] font-mono text-xs">
                    <p>No feedback comments left yet.</p>
                    <p className="text-[10px]">Type below to send a note to your creative team.</p>
                  </div>
                ) : (
                  room.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`p-3 rounded-xl border space-y-1.5 text-xs transition-colors ${
                        comment.author_role === "client"
                          ? "bg-[#171722] border-[#A78BFA]/20 text-[#F2F0F7]"
                          : "bg-[#14141A] border-white/[0.06] text-[#A3A0B0]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#F2F0F7]">
                            {comment.author_name}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold ${
                              comment.author_role === "client"
                                ? "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30"
                                : "bg-white/[0.06] text-[#A3A0B0]"
                            }`}
                          >
                            {comment.author_role}
                          </span>
                        </div>

                        {/* Timestamp Button (if timestamped comment) */}
                        {comment.timestamp_seconds !== null && comment.timestamp_seconds !== undefined && (
                          <button
                            type="button"
                            onClick={() => jumpToTimestamp(comment.timestamp_seconds!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                            title="Jump to video timestamp"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>{formatTime(comment.timestamp_seconds)}</span>
                          </button>
                        )}
                      </div>

                      <p className="leading-relaxed whitespace-pre-wrap select-text text-[11px]">
                        {comment.message}
                      </p>

                      <span className="text-[9px] font-mono text-[#71717A] block pt-0.5">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Add Feedback Input Box */}
              <form onSubmit={handlePostComment} className="space-y-2.5 pt-3 border-t border-white/[0.06]">
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    placeholder="Your Name (e.g. Sarah Jenkins)"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    required
                    className="w-full bg-[#0D0D12] text-xs text-[#F2F0F7] placeholder:text-[#71717A] px-3 py-2 rounded-xl border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    placeholder="Type feedback, suggestions, or change notes..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    required
                    className="w-full bg-[#0D0D12] text-xs text-[#F2F0F7] placeholder:text-[#71717A] p-3 rounded-xl border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none resize-none leading-relaxed"
                  />

                  {/* Video Timestamp Pin Button */}
                  {isVideo && (
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          if (pinnedTimestamp === null) {
                            setPinnedTimestamp(currentVideoTime);
                          } else {
                            setPinnedTimestamp(null);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          pinnedTimestamp !== null
                            ? "bg-[#A78BFA] text-[#101014] font-bold border-transparent"
                            : "bg-[#171720] text-[#A3A0B0] hover:text-[#F2F0F7] border-white/[0.08]"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {pinnedTimestamp !== null
                            ? `Pinned at ${formatTime(pinnedTimestamp)} (Click to clear)`
                            : `Tag Video at ${formatTime(currentVideoTime)}`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={postingComment || !commentText.trim() || !reviewerName.trim()}
                  className="w-full py-2 rounded-xl bg-[#20202A] hover:bg-[#2c2c3b] text-[#A78BFA] hover:text-[#c4b5fd] border border-white/[0.08] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {postingComment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Post Feedback</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* ── STICKY ONE-TAP CLIENT DECISION ACTION BAR ── */}
      <footer className="fixed bottom-0 inset-x-0 bg-[#0E0E14]/90 backdrop-blur-md border-t border-white/[0.1] p-4 sm:px-8 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#A3A0B0]">Deliverable Sign-Off:</span>
            <span className="font-bold text-[#F2F0F7]">{room.title}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isApproved ? (
              <div className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] text-xs font-bold font-mono flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Deliverable Approved ✓</span>
              </div>
            ) : (
              <>
                {/* Request Revisions Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDecision("changes_requested");
                    setDecisionModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#E5AA58]/10 hover:bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/30 text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Request Revisions</span>
                </button>

                {/* One-Tap Approve Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDecision("approved");
                    setDecisionModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#45B88A] hover:bg-[#52c595] text-[#101014] text-xs font-bold transition-all cursor-pointer shadow-lg shadow-[#45B88A]/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Approve Deliverable</span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* ── DECISION CONFIRMATION MODAL ── */}
      {decisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-card bg-[#14141A] border border-white/[0.12] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  selectedDecision === "approved"
                    ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                    : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30"
                }`}
              >
                {selectedDecision === "approved" ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-[#F2F0F7]">
                  {selectedDecision === "approved"
                    ? "Confirm Deliverable Approval"
                    : "Submit Revision Request"}
                </h3>
                <p className="text-xs text-[#A3A0B0]">
                  {selectedDecision === "approved"
                    ? "This will advance the deliverable and lock in scheduling."
                    : "Your feedback will be dispatched directly to the production team."}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                  Your Full Name & Role <span className="text-[#E16F7B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins (Head of Growth)"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  required
                  className="w-full bg-[#0D0D12] text-xs text-[#F2F0F7] px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                  {selectedDecision === "approved"
                    ? "Sign-Off Notes (Optional)"
                    : "Specific Revision Instructions (Required) *"}
                </label>
                <textarea
                  rows={4}
                  placeholder={
                    selectedDecision === "approved"
                      ? "Looks fantastic! Approved for posting."
                      : "Please tighten the intro hook and update the color grade on Scene 2."
                  }
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  required={selectedDecision === "changes_requested"}
                  className="w-full bg-[#0D0D12] text-xs text-[#F2F0F7] p-3 rounded-xl border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#2c2c3b] text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitDecision}
                disabled={
                  submittingDecision ||
                  !reviewerName.trim() ||
                  (selectedDecision === "changes_requested" && !feedbackNotes.trim())
                }
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                  selectedDecision === "approved"
                    ? "bg-[#45B88A] hover:bg-[#52c595] text-[#101014]"
                    : "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                }`}
              >
                {submittingDecision ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : selectedDecision === "approved" ? (
                  "Confirm Sign-Off"
                ) : (
                  "Send Revision Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
