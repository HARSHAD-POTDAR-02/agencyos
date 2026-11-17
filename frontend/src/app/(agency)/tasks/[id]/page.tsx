"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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

interface AgencyMember {
  user_id: string;
  role: string;
  user_full_name?: string | null;
  user_email?: string | null;
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

function TaskWorkspaceContent() {
  const params = useParams();
  const taskId = (params?.id as string) || "";
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
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [reassigning, setReassigning] = useState(false);

  // Preview State
  const [activePreviewVersion, setActivePreviewVersion] = useState<SubmissionVersion | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadTask = useCallback(async () => {
    if (!token || !effectiveAgencyId || !taskId) return;
    setLoading(true);
    setError(null);
    try {
      try {
        const memberList = (await agencyApi.listMembers(effectiveAgencyId, token)) as AgencyMember[];
        setMembers(memberList || []);
      } catch (e) {
        // ignore
      }

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

  const handleReassign = async (newAssigneeId: string | null) => {
    if (!token || !effectiveAgencyId || !task) return;
    setReassigning(true);
    try {
      await taskApi.update(
        effectiveAgencyId,
        task.id,
        { assignee_id: newAssigneeId || null },
        token
      );
      const selectedMember = members.find((m) => m.user_id === newAssigneeId);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              assignee_id: newAssigneeId,
              assignee_name: selectedMember?.user_full_name || selectedMember?.user_email?.split("@")[0] || null,
              assignee_role: selectedMember?.role || null,
            }
          : prev
      );
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setError(err?.message || "Failed to reassign task");
    } finally {
      setReassigning(false);
    }
  };

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
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#71717A]">Loading task workspace...</p>
        </div>
      </main>
    );
  }

  if (error && !task) {
    return (
      <main className="flex-1 p-8 max-w-4xl mx-auto space-y-4">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-semibold text-[#A3A0B0] hover:text-[#A78BFA]">
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </Link>
        <div className="bg-[#E16F7B]/10 border border-[#E16F7B]/30 rounded-2xl p-6 text-[#E16F7B]">
          <h2 className="text-base font-heading font-bold text-[#F2F0F7]">Task Error</h2>
          <p className="text-xs mt-1 text-[#E16F7B]">{error}</p>
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
    <div className="min-h-full w-full bg-[#101014] text-[#F2F0F7] pb-16">
      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Breadcrumb Navigation & Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
              <Link href="/workspace" className="hover:text-[#A78BFA] flex items-center gap-1 text-[#A78BFA] transition-colors">
                <Briefcase className="w-3.5 h-3.5" /> Workbench
              </Link>
              <span className="text-white/[0.2]">/</span>
              <span className="text-[#A3A0B0]">{task.client_name}</span>
              <span className="text-white/[0.2]">/</span>
              <span className="truncate max-w-[200px] text-[#A3A0B0]">{task.campaign_title}</span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">{task.title}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                task.status === "changes_requested"
                  ? "bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30"
                  : task.status === "internal_review"
                  ? "bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30"
                  : task.status === "approved" || task.status === "done"
                  ? "bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30"
                  : "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30"
              }`}>
                {task.status.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Top Actions: Assignee, Due Date & Navigation */}
          <div className="flex items-center gap-2.5">
            <div className="surface-card border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-xs">
              <User className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
              <span className="text-[#A3A0B0]">Assigned:</span>
              {isManagerOrOwner ? (
                <select
                  value={task.assignee_id || ""}
                  disabled={reassigning}
                  onChange={(e) => handleReassign(e.target.value || null)}
                  className="bg-[#101014] text-xs font-medium text-[#F2F0F7] px-2 py-0.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-medium text-[#F2F0F7]">{task.assignee_name || "Unassigned"}</span>
              )}
            </div>

            {task.due_date && (
              <div className="surface-card border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-[#A3A0B0]" />
                <span className="text-[#A3A0B0]">Deadline:</span>
                <span className="font-mono font-medium text-[#F2F0F7]">{task.due_date}</span>
              </div>
            )}

            <Link
              href="/workspace"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] text-xs font-medium text-[#F2F0F7] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Workbench</span>
            </Link>
          </div>
        </div>

        {/* Manager Review Action Banner (Active during internal_review) */}
        {isInternalReview && isManagerOrOwner && (
          <div className="surface-card border border-[#A78BFA]/40 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#A78BFA] font-heading font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
                <span>Internal Review Required</span>
              </div>
              <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
                The assigned specialist has submitted work for this task. Review the version below and either approve to unlock the next production stage or request specific revisions.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setReviewDecision("changes_requested");
                  setReviewModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E5AA58]/10 hover:bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/30 text-xs font-medium transition-all cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#E5AA58]" />
                <span>Request Revision</span>
              </button>

              <button
                onClick={() => {
                  setReviewDecision("approved");
                  setReviewModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#45B88A] hover:bg-[#52c595] text-[#101014] text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Submission</span>
              </button>
            </div>
          </div>
        )}

        {/* Revision Requested Notice (For specialist) */}
        {isRevisionRequested && (
          <div className="bg-[#17171E] border border-[#E5AA58]/40 rounded-2xl p-5 space-y-2 text-[#E5AA58]">
            <div className="flex items-center gap-2 text-[#E5AA58] font-heading font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-[#E5AA58]" />
              <span>Revisions Requested by Manager</span>
            </div>
            <p className="text-xs text-[#A3A0B0] leading-relaxed">
              Please review the manager feedback below, update your script or render, and resubmit using the workspace form.
            </p>
            {task.review_comments.length > 0 && (
              <div className="bg-[#101014] p-3.5 rounded-xl border border-[#30303D] text-xs font-mono text-[#F2F0F7]">
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
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" /> Creative Context
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.2 rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 uppercase">
                  {task.platform} • {task.deliverable_type}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#A3A0B0] block font-medium mb-1">Campaign Objective</span>
                  <p className="text-[#F2F0F7] leading-relaxed bg-[#101014] p-3 rounded-xl border border-white/[0.06]">
                    {task.campaign_objective || "Promote campaign deliverables and drive target audience engagement."}
                  </p>
                </div>

                {task.brand_voice && (
                  <div>
                    <span className="text-[#A3A0B0] block font-medium mb-1">Brand Voice & Guidelines</span>
                    <p className="text-[#F2F0F7] leading-relaxed bg-[#101014] p-3 rounded-xl border border-white/[0.06]">
                      {task.brand_voice}
                    </p>
                  </div>
                )}

                {task.target_audience && task.target_audience.length > 0 && (
                  <div>
                    <span className="text-[#A3A0B0] block font-medium mb-1.5">Target Audience</span>
                    <div className="flex flex-wrap gap-1.5">
                      {task.target_audience.map((aud, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-[#20202A] border border-white/[0.06] text-[#A3A0B0] text-[11px]">
                          {aud}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Storyboard & Work Instructions Card */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-[#A78BFA]" /> Storyboard & Instructions
                </span>
                <span className="text-[10px] font-mono text-[#A3A0B0]">Architect Specs</span>
              </div>

              {task.storyboard_text ? (
                <div className="space-y-2">
                  <div className="max-h-[380px] overflow-y-auto bg-[#101014] p-3 rounded-xl border border-white/[0.06] font-mono text-xs text-[#F2F0F7] leading-relaxed whitespace-pre-wrap select-text">
                    {task.storyboard_text}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#A3A0B0]/60 italic">No formal storyboard attached to this deliverable.</p>
              )}
            </div>
          </div>

          {/* Right Column (7 cols): Submissions, Versions & Actions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Version History & Submissions Accordion */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider">
                    Content Versions ({task.submissions.length})
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#A3A0B0]">Immutable Review Pipeline</span>
              </div>

              {task.submissions.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#30303D] rounded-2xl space-y-2 bg-[#101014]/60">
                  <FileText className="w-8 h-8 text-[#71717A] mx-auto" />
                  <p className="text-xs font-semibold text-[#F2F0F7]">No versions submitted yet.</p>
                  <p className="text-[11px] text-[#A3A0B0]">Use the submission form below to deliver the first version.</p>
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
                        className="bg-[#101014] border border-[#30303D] rounded-xl p-4 space-y-3 transition-colors hover:border-[#A78BFA]/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-mono font-bold text-xs flex items-center justify-center">
                              v{sub.version_number}
                            </span>
                            <div>
                              <span className="text-xs font-semibold text-[#F2F0F7] block">{sub.file_name}</span>
                              <span className="text-[10px] font-mono text-[#71717A]">
                                {new Date(sub.created_at).toLocaleString()} • {sub.file_size_bytes ? `${Math.round(sub.file_size_bytes / 1024)} KB` : "Asset"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isApprovedVer && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 uppercase">
                                <CheckCircle2 className="w-3 h-3 text-[#45B88A]" /> Approved
                              </span>
                            )}
                            {isChangesReq && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30 uppercase">
                                <AlertTriangle className="w-3 h-3 text-[#E5AA58]" /> Revisions Needed
                              </span>
                            )}

                            <button
                              onClick={() => openPreview(sub)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20202A] hover:bg-[#262630] text-xs font-semibold text-[#F2F0F7] border border-[#30303D] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#A78BFA]" />
                              <span>Preview</span>
                            </button>

                            {sub.url && (
                              <a
                                href={sub.url.startsWith("http") ? sub.url : `${API_BASE}${sub.url}`}
                                download
                                className="p-1 rounded-lg bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-[#30303D] transition-colors"
                                title="Download Asset"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Approval / Feedback Note attached to version */}
                        {sub.approval_notes && (
                          <div className="bg-[#17171E] p-3 rounded-lg border border-[#30303D] text-xs text-[#F2F0F7]">
                            <span className="font-semibold text-[#71717A] block text-[10px] uppercase">Reviewer Feedback:</span>
                            <p className="mt-0.5 font-medium text-[#A3A0B0]">{sub.approval_notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Interactive Preview Drawer */}
            {activePreviewVersion && (
              <div className="surface-card border border-[#A78BFA]/50 rounded-2xl p-5 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span className="text-xs font-semibold text-[#F2F0F7]">
                      Preview: {activePreviewVersion.file_name} (Version {activePreviewVersion.version_number})
                    </span>
                  </div>
                  <button
                    onClick={() => setActivePreviewVersion(null)}
                    className="p-1 rounded-lg hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {previewLoading ? (
                  <div className="py-8 text-center text-xs text-[#A3A0B0] flex items-center justify-center gap-2 font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A78BFA]" /> Loading asset preview...
                  </div>
                ) : activePreviewVersion.file_type?.includes("video") || activePreviewVersion.file_name.endsWith(".mp4") ? (
                  <div className="space-y-2">
                    <video
                      src={activePreviewVersion.url?.startsWith("http") ? activePreviewVersion.url : `${API_BASE}${activePreviewVersion.url}`}
                      controls
                      className="w-full max-h-[360px] rounded-xl bg-black border border-white/[0.08]"
                    />
                  </div>
                ) : previewContent ? (
                  <div className="max-h-[300px] overflow-y-auto bg-[#101014] p-3.5 rounded-xl border border-white/[0.08] font-mono text-xs text-[#F2F0F7] whitespace-pre-wrap leading-relaxed select-text">
                    {previewContent}
                  </div>
                ) : (
                  <p className="text-xs text-[#A3A0B0]/60 italic">Preview not available for this file type. Please download to inspect.</p>
                )}
              </div>
            )}

            {/* Submission Action Workspace (For Employee / Specialist) */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="w-3.5 h-3.5 text-[#A78BFA]" /> Submit Deliverable Work
                </span>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSubmissionMode("script")}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                      submissionMode === "script" ? "bg-white/[0.08] text-[#A78BFA] font-semibold shadow-xs" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                    }`}
                  >
                    Text Script
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionMode("media")}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                      submissionMode === "media" ? "bg-white/[0.08] text-[#A78BFA] font-semibold shadow-xs" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                    }`}
                  >
                    Media File
                  </button>
                </div>
              </div>

              {submitSuccess && (
                <div className="p-3 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A] shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#E16F7B] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleWorkSubmit} className="space-y-3.5">
                {submissionMode === "script" ? (
                  /* Writer Script Submission Form */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A3A0B0] mb-1">Script Draft Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Hotel Shauryawada Diwali Hook & Scene Script"
                        value={scriptTitle}
                        onChange={(e) => setScriptTitle(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                        Hook / Opening Hook Line (First 3 Seconds)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Puneites, stop scrolling if you love authentic Kolhapuri mutton thali!"
                        value={hook}
                        onChange={(e) => setHook(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                        Scene Breakdown, Dialogue & Visual Directions
                      </label>
                      <textarea
                        rows={6}
                        placeholder={`Scene 1 (0-3s): Close-up of boiling mutton rassa...\nScene 2 (3-8s): Family walking in...\nScene 3 (8-15s): Chef plating the thali...`}
                        value={scriptBody}
                        onChange={(e) => setScriptBody(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-mono transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">Suggested Caption & Hashtags</label>
                      <textarea
                        rows={2}
                        placeholder="Caption copy to accompany the post..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#71717A] p-3 rounded-xl border border-[#30303D] focus:outline-none focus:border-[#A78BFA] font-medium transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  /* Video Editor / Designer File Upload Form */
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">Upload Media Asset (.mp4, .mov, .png, .jpg)</label>
                      <div className="border border-dashed border-[#30303D] hover:border-[#A78BFA] rounded-2xl p-6 text-center transition-colors bg-[#101014]">
                        <input
                          type="file"
                          id="task-file-upload"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="hidden"
                          accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg"
                        />
                        <label htmlFor="task-file-upload" className="cursor-pointer space-y-2 block">
                          <UploadCloud className="w-8 h-8 text-[#A78BFA] mx-auto" />
                          <span className="text-xs font-semibold text-[#F2F0F7] block">
                            {selectedFile ? selectedFile.name : "Click to select or drag and drop render file"}
                          </span>
                          <span className="text-[10px] text-[#71717A] block">
                            {selectedFile ? `${Math.round(selectedFile.size / (1024 * 1024))} MB` : "Supports MP4, MOV, WebM, PNG up to 100MB"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">Production Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Exported 1080x1920 60fps render with color-graded footage"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#71717A] px-3.5 py-2.5 rounded-xl border border-[#30303D] focus:outline-none focus:border-[#A78BFA] font-medium transition-all"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || (submissionMode === "media" && !selectedFile)}
                  className="w-full py-2.5 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] disabled:opacity-40 text-[#101014] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
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

        {/* ── Raycast Manager Review Decision Modal ── */}
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card border border-white/[0.1] rounded-2xl p-5 max-w-lg w-full space-y-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h3 className="text-sm font-heading font-semibold text-[#F2F0F7] flex items-center gap-2">
                  {reviewDecision === "approved" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#45B88A]" />
                      <span>Approve Task Submission</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-[#E5AA58]" />
                      <span>Request Changes & Revisions</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="p-1 rounded-md text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#A3A0B0] leading-relaxed">
                {reviewDecision === "approved"
                  ? "Approving this submission will advance the deliverable and automatically unlock the next production stage (e.g. video editing or client review)."
                  : "Specify what changes the specialist needs to make. The task will be marked as changes_requested and the feedback will appear in their workbench."}
              </p>

              <div>
                <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
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
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all"
                  required={reviewDecision === "changes_requested"}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#20202A] hover:bg-[#262630] text-xs font-medium text-[#A3A0B0] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  disabled={reviewing || (reviewDecision === "changes_requested" && !feedbackNotes.trim())}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    reviewDecision === "approved"
                      ? "bg-[#45B88A] hover:bg-[#52c595] text-[#101014]"
                      : "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                  }`}
                >
                  {reviewing ? "Processing Decision..." : reviewDecision === "approved" ? "Confirm Approval" : "Send Revision Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TaskWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[#71717A]">Loading task workspace...</div>
      }
    >
      <TaskWorkspaceContent />
    </Suspense>
  );
}