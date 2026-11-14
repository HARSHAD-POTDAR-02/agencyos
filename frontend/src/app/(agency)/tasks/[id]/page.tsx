"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, agencyApi, API_BASE } from "@/lib/api";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Film,
  PenTool,
  Scissors,
  ShieldCheck,
  UploadCloud,
  FileText,
  FileVideo,
  Download,
  Eye,
  MessageSquare,
  Building2,
  User,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RefreshCw,
  Send,
  ExternalLink,
  Play
} from "lucide-react";

interface SubmissionVersion {
  id: string;
  deliverable_id: string;
  task_id: string | null;
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
  url?: string;
  approval_status?: "approved" | "changes_requested" | string | null;
  approval_notes?: string | null;
}

interface ReviewComment {
  id: string;
  deliverable_id: string;
  content_version_id?: string | null;
  author_id: string;
  author_name?: string | null;
  author_role?: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
}

interface TaskDetail {
  id: string;
  deliverable_id: string;
  title: string;
  task_type: string | null;
  assignee_id: string | null;
  assignee_name?: string | null;
  assignee_role?: string | null;
  status:
    | "backlog"
    | "todo"
    | "in_progress"
    | "internal_review"
    | "client_review"
    | "changes_requested"
    | "approved"
    | "done"
    | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  blocked_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_id?: string;
  client_name?: string;
  campaign_id?: string;
  campaign_title?: string;
  campaign_objective?: string;
  deliverable_title: string;
  deliverable_type: string;
  platform: string;
  brand_voice?: string | null;
  target_audience: string[];
  storyboard_text?: string | null;
  submissions: SubmissionVersion[];
  review_comments: ReviewComment[];
}

export default function TaskWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();

  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission Form State
  const [submissionMode, setSubmissionMode] = useState<"script" | "media">("script");
  const [scriptTitle, setScriptTitle] = useState("");
  const [hook, setHook] = useState("");
  const [scriptBody, setScriptBody] = useState("");
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Review Form State (For Manager)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "changes_requested">("approved");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Preview State
  const [activePreviewVersion, setActivePreviewVersion] = useState<SubmissionVersion | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadTask = useCallback(async () => {
    if (!token || !effectiveAgencyId || !taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await taskApi.get(effectiveAgencyId, taskId, token)) as TaskDetail;
      setTask(data);
      // Determine default submission mode based on task_type
      const ttype = (data.task_type || "").toLowerCase();
      if (ttype.includes("edit") || ttype.includes("video") || ttype.includes("film") || ttype.includes("shoot") || ttype.includes("design")) {
        setSubmissionMode("media");
      } else {
        setSubmissionMode("script");
      }
    } catch (err: any) {
      console.error("Failed to load task:", err);
      setError(err?.message || "Failed to load task details");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Load preview content if text
  const openPreview = async (sub: SubmissionVersion) => {
    setActivePreviewVersion(sub);
    const isText = sub.file_type?.includes("text") || sub.file_name.endsWith(".txt") || sub.file_name.endsWith(".md");
    if (isText && sub.url) {
      setPreviewLoading(true);
      try {
        const fullUrl = sub.url.startsWith("http") ? sub.url : `${API_BASE}${sub.url}`;
        const res = await fetch(fullUrl);
        const text = await res.text();
        setPreviewContent(text);
      } catch (e) {
        setPreviewContent("Failed to load script content.");
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewContent(null);
    }
  };

  // Handle Work Submission
  const handleWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId || !taskId) return;

    setSubmitting(true);
    setSubmitSuccess(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("submission_type", submissionMode);
      if (submissionMode === "script") {
        if (scriptTitle) formData.append("script_title", scriptTitle);
        if (hook) formData.append("hook", hook);
        if (scriptBody) formData.append("script_body", scriptBody);
        if (caption) formData.append("caption", caption);
        if (notes) formData.append("notes", notes);
      } else {
        if (selectedFile) formData.append("file", selectedFile);
        if (caption) formData.append("caption", caption);
        if (notes) formData.append("notes", notes);
      }

      await taskApi.submit(effectiveAgencyId, taskId, formData, token);
      setSubmitSuccess("Work submitted successfully for internal review!");

      // Reset form
      setHook("");
      setScriptBody("");
      setSelectedFile(null);

      // Refresh task details
      await loadTask();
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(err?.message || "Failed to submit work");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Manager Review Decision
  const handleReviewSubmit = async () => {
    if (!token || !effectiveAgencyId || !taskId) return;

    setReviewing(true);
    setError(null);
    try {
      await taskApi.review(effectiveAgencyId, taskId, {
        decision: reviewDecision,
        feedback_notes: feedbackNotes.trim() || undefined,
      }, token);

      setReviewModalOpen(false);
      setFeedbackNotes("");
      await loadTask();
    } catch (err: any) {
      console.error("Review failed:", err);
      setError(err?.message || "Failed to submit review decision");
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-400">Loading task workspace...</p>
        </div>
      </main>
    );
  }

  if (error && !task) {
    return (
      <main className="flex-1 p-8 max-w-4xl mx-auto space-y-4">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </Link>
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-rose-300">
          <h2 className="text-base font-bold text-rose-200">Task Error</h2>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </main>
    );
  }

  if (!task) return null;

  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(currentMembership?.role || "owner");
  const isInternalReview = task.status === "internal_review";
  const isRevisionRequested = task.status === "changes_requested";
  const isApproved = ["approved", "done"].includes(task.status);
  const latestSubmission = task.submissions.length > 0 ? task.submissions[task.submissions.length - 1] : null;

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Navigation & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/workspace" className="hover:text-purple-400 flex items-center gap-1 font-semibold">
              <Briefcase className="w-3.5 h-3.5" /> My Workspace
            </Link>
            <span>/</span>
            <span className="text-slate-300 font-semibold">{task.client_name}</span>
            <span>/</span>
            <span className="truncate max-w-[200px] text-slate-400">{task.campaign_title}</span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <h1 className="text-2xl font-black text-white tracking-tight">{task.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              task.status === "changes_requested"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : task.status === "internal_review"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : task.status === "approved" || task.status === "done"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
            }`}>
              {task.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Top Actions: Assignee, Due Date & Navigation */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Assigned:</span>
            <span className="font-bold text-white">{task.assignee_name || "Unassigned"}</span>
          </div>

          {task.due_date && (
            <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Deadline:</span>
              <span className="font-bold text-white">{task.due_date}</span>
            </div>
          )}

          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </Link>
        </div>
      </div>

      {/* Manager Review Action Banner (Active during internal_review) */}
      {isInternalReview && isManagerOrOwner && (
        <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-300 font-extrabold text-sm">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Internal Review Required</span>
            </div>
            <p className="text-xs text-slate-300">
              The assigned specialist has submitted work for this task. Review the version below and either approve to unlock the next production stage or request specific revisions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setReviewDecision("changes_requested");
                setReviewModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Request Revision</span>
            </button>

            <button
              onClick={() => {
                setReviewDecision("approved");
                setReviewModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Submission</span>
            </button>
          </div>
        </div>
      )}

      {/* Revision Requested Notice (For specialist) */}
      {isRevisionRequested && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Revisions Requested by Manager</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Please review the manager feedback below, update your script or render, and resubmit using the workspace form.
          </p>
          {task.review_comments.length > 0 && (
            <div className="bg-black/30 p-3 rounded-xl border border-amber-500/20 text-xs font-mono text-amber-100">
              {task.review_comments[task.review_comments.length - 1].message}
            </div>
          )}
        </div>
      )}

      {/* 2-Column Production Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Creative Context & Storyboard */}
        <div className="lg:col-span-5 space-y-6">
          {/* Creative Brief Card */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Creative Context
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">
                {task.platform} • {task.deliverable_type}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Campaign Objective</span>
                <p className="text-slate-200 leading-relaxed font-medium bg-black/20 p-2.5 rounded-xl border border-white/5">
                  {task.campaign_objective || "Promote campaign deliverables and drive target audience engagement."}
                </p>
              </div>

              {task.brand_voice && (
                <div>
                  <span className="text-slate-400 block font-semibold mb-0.5">Brand Voice & Guidelines</span>
                  <p className="text-slate-200 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                    {task.brand_voice}
                  </p>
                </div>
              )}

              {task.target_audience && task.target_audience.length > 0 && (
                <div>
                  <span className="text-slate-400 block font-semibold mb-1">Target Audience</span>
                  <div className="flex flex-wrap gap-1.5">
                    {task.target_audience.map((aud, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px]">
                        {aud}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Storyboard & Work Instructions Card */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" /> Storyboard & Instructions
              </span>
              <span className="text-[11px] text-slate-400">Architect Specs</span>
            </div>

            {task.storyboard_text ? (
              <div className="space-y-2">
                <div className="max-h-[380px] overflow-y-auto bg-black/30 p-3.5 rounded-xl border border-white/5 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                  {task.storyboard_text}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No formal storyboard attached to this deliverable.</p>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Submissions, Versions & Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Version History & Submissions Accordion */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Content Versions ({task.submissions.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Immutable Review Pipeline</span>
            </div>

            {task.submissions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-xl space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-400">No versions submitted yet.</p>
                <p className="text-[11px] text-slate-500">Use the submission form below to deliver the first version.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {task.submissions.map((sub) => {
                  const isText = sub.file_type?.includes("text") || sub.file_name.endsWith(".txt");
                  const isVideo = sub.file_type?.includes("video") || sub.file_name.endsWith(".mp4") || sub.file_name.endsWith(".mov");
                  const isApprovedVer = sub.approval_status === "approved";
                  const isChangesReq = sub.approval_status === "changes_requested";

                  return (
                    <div
                      key={sub.id}
                      className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3 transition-colors hover:border-white/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-black text-xs flex items-center justify-center">
                            v{sub.version_number}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">{sub.file_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(sub.created_at).toLocaleString()} • {sub.file_size_bytes ? `${Math.round(sub.file_size_bytes / 1024)} KB` : "Asset"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isApprovedVer && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approved
                            </span>
                          )}
                          {isChangesReq && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> Revisions Needed
                            </span>
                          )}

                          <button
                            onClick={() => openPreview(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-400" />
                            <span>Preview</span>
                          </button>

                          {sub.url && (
                            <a
                              href={sub.url.startsWith("http") ? sub.url : `${API_BASE}${sub.url}`}
                              download
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              title="Download Asset"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Approval / Feedback Note attached to version */}
                      {sub.approval_notes && (
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-white/5 text-xs text-slate-300">
                          <span className="font-bold text-slate-400 block text-[10px] uppercase">Reviewer Feedback:</span>
                          <p className="mt-0.5">{sub.approval_notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Preview Drawer / Modal */}
          {activePreviewVersion && (
            <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-5 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    Preview: {activePreviewVersion.file_name} (Version {activePreviewVersion.version_number})
                  </span>
                </div>
                <button
                  onClick={() => setActivePreviewVersion(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {previewLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Loading asset preview...
                </div>
              ) : activePreviewVersion.file_type?.includes("video") || activePreviewVersion.file_name.endsWith(".mp4") ? (
                <div className="space-y-2">
                  <video
                    src={activePreviewVersion.url?.startsWith("http") ? activePreviewVersion.url : `${API_BASE}${activePreviewVersion.url}`}
                    controls
                    className="w-full max-h-[360px] rounded-xl bg-black"
                  />
                </div>
              ) : previewContent ? (
                <div className="max-h-[300px] overflow-y-auto bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                  {previewContent}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Preview not available for this file type. Please download to inspect.</p>
              )}
            </div>
          )}

          {/* Submission Action Workspace (For Employee / Specialist) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-purple-400" /> Submit Deliverable Work
              </span>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSubmissionMode("script")}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    submissionMode === "script" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Text Script
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionMode("media")}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    submissionMode === "media" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Media File
                </button>
              </div>
            </div>

            {submitSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleWorkSubmit} className="space-y-4">
              {submissionMode === "script" ? (
                /* Writer Script Submission Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Script Draft Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Hotel Shauryawada Diwali Hook & Scene Script"
                      value={scriptTitle}
                      onChange={(e) => setScriptTitle(e.target.value)}
                      className="w-full bg-black/40 text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Hook / Opening Hook Line (First 3 Seconds)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Puneites, stop scrolling if you love authentic Kolhapuri mutton thali!"
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      className="w-full bg-black/40 text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Scene Breakdown, Dialogue & Visual Directions
                    </label>
                    <textarea
                      rows={6}
                      placeholder={`Scene 1 (0-3s): Close-up of boiling mutton rassa...\nScene 2 (3-8s): Family walking in...\nScene 3 (8-15s): Chef plating the thali...`}
                      value={scriptBody}
                      onChange={(e) => setScriptBody(e.target.value)}
                      className="w-full bg-black/40 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Suggested Caption & Hashtags</label>
                    <textarea
                      rows={2}
                      placeholder="Caption copy to accompany the post..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full bg-black/40 text-xs text-white p-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ) : (
                /* Video Editor / Designer File Upload Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Upload Media Asset (.mp4, .mov, .png, .jpg)</label>
                    <div className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-6 text-center transition-colors bg-black/20">
                      <input
                        type="file"
                        id="task-file-upload"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg"
                      />
                      <label htmlFor="task-file-upload" className="cursor-pointer space-y-2 block">
                        <UploadCloud className="w-8 h-8 text-purple-400 mx-auto" />
                        <span className="text-xs font-bold text-white block">
                          {selectedFile ? selectedFile.name : "Click to select or drag and drop render file"}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {selectedFile ? `${Math.round(selectedFile.size / (1024 * 1024))} MB` : "Supports MP4, MOV, WebM, PNG up to 100MB"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Production Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Exported 1080x1920 60fps render with color-graded footage"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-black/40 text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (submissionMode === "media" && !selectedFile)}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Version {task.submissions.length + 1} for Internal Review</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Review Modal for Managers */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                {reviewDecision === "approved" ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Approve Task Submission</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Request Changes & Revisions</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {reviewDecision === "approved"
                ? "Approving this submission will advance the deliverable and automatically unlock the next production stage (e.g. video editing or client review)."
                : "Specify what changes the employee needs to make. The task will be marked as changes_requested and the feedback will be shown in their workspace."}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {reviewDecision === "approved" ? "Approval Notes (Optional)" : "Detailed Revision Instructions (Required)"}
              </label>
              <textarea
                rows={4}
                placeholder={
                  reviewDecision === "approved"
                    ? "Great pacing and hook. Approved for video editing."
                    : "The hook is too slow. Make the first 3 seconds punchier and highlight the spicy Kolhapuri aroma."
                }
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                className="w-full bg-black/40 text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500 font-medium"
                required={reviewDecision === "changes_requested"}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={reviewing || (reviewDecision === "changes_requested" && !feedbackNotes.trim())}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-lg transition-all ${
                  reviewDecision === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                    : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/25"
                }`}
              >
                {reviewing ? "Processing Decision..." : reviewDecision === "approved" ? "Confirm Approval" : "Send Revision Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
