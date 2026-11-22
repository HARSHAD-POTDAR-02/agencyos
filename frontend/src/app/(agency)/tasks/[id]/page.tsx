"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi, agencyApi, API_BASE, ScriptBlock, TaskChecklistItem } from "@/lib/api";
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
  Download,
  Eye,
  Building2,
  User,
  Calendar,
  Layers,
  Check,
  X,
  RefreshCw,
  Send,
  ExternalLink,
  Copy,
  ChevronRight,
  Lock,
  Trash2,
  Bot,
  Wand2,
  CornerDownLeft,
  Mic,
  Play,
  Pause,
  RotateCcw,
  ListChecks,
  Plus,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Timer,
  Flame,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCheck,
  AlertCircle,
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
  is_locked?: boolean;
  locked_reason?: string | null;
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
  script_blocks?: ScriptBlock[];
  checklists?: TaskChecklistItem[];
  target_duration_seconds?: number;
  speaking_duration_seconds?: number;
  total_word_count?: number;
  hook_word_count?: number;
  hook_warning?: string | null;
}

function getMonogram(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

function getSlaStatus(dueDate: string | null) {
  if (!dueDate) return null;
  const target = new Date(dueDate);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)}d overdue`,
      tone: "critical" as const,
      isOverdue: true,
    };
  } else if (diffDays === 0) {
    return {
      text: "Due today",
      tone: "urgent" as const,
      isOverdue: false,
    };
  } else if (diffDays === 1) {
    return {
      text: "Due tomorrow",
      tone: "warning" as const,
      isOverdue: false,
    };
  } else if (diffDays <= 3) {
    return {
      text: `Due in ${diffDays}d`,
      tone: "warning" as const,
      isOverdue: false,
    };
  } else {
    return {
      text: `Due in ${diffDays}d`,
      tone: "neutral" as const,
      isOverdue: false,
    };
  }
}

// 5-Stage Linear Lifecycle Stepper
const PRODUCTION_STAGES = [
  { id: "backlog", label: "Backlog", statuses: ["backlog"] },
  { id: "todo", label: "Scripting / Prep", statuses: ["todo"] },
  { id: "in_progress", label: "In Production", statuses: ["in_progress"] },
  { id: "review", label: "Review & Quality", statuses: ["internal_review", "client_review", "changes_requested"] },
  { id: "done", label: "Approved / Done", statuses: ["approved", "done"] },
];

function parseScriptIntoSceneBlocks(
  text: string,
  existingBlocks: ScriptBlock[],
  primaryHook?: string
): ScriptBlock[] {
  const defaultSceneTemplates = [
    { title: "Scene 1: The Hook (0s–5s)", visual_cue: "Close-up direct address to camera", audio_notes: "High-energy beat drop / cutoff" },
    { title: "Scene 2: Friction & Agitation (5s–12s)", visual_cue: "Dynamic visual problem agitation", audio_notes: "Subtle tension synth" },
    { title: "Scene 3: Proof & Solution (12s–22s)", visual_cue: "Step-by-step mechanism or product demo", audio_notes: "Uptempo rhythm" },
    { title: "Scene 4: Call to Action (22s–30s)", visual_cue: "High-contrast end card callout", audio_notes: "Audio brand signature sting" },
  ];

  const cleanSceneLine = (t: string) => {
    return t
      .replace(/^(?:\[?Scene\s*\d+[^\]\n]*\]?|\*\*Scene\s*\d+[^\*]*\*\*|Scene\s*\d+[:\-]?)\s*[:\-]?\s*/i, "")
      .replace(/^(?:\[[^\]]+\]|\*\*[^\*]+\*\*)\s*[:\-]?\s*/, "")
      .trim();
  };

  const cleanBody = text.trim();
  const lines = cleanBody.split("\n").map((l) => l.trim()).filter(Boolean);
  let sceneEntries: string[] = [];

  const hasSceneHeaders = lines.some((l) =>
    /^(?:\[?Scene\s*\d+|\*\*Scene\s*\d+|Scene\s*\d+)/i.test(l)
  );

  if (hasSceneHeaders) {
    let currentEntry: string[] = [];
    for (const l of lines) {
      if (/^(?:\[?Scene\s*\d+|\*\*Scene\s*\d+|Scene\s*\d+)/i.test(l)) {
        if (currentEntry.length > 0) {
          sceneEntries.push(currentEntry.join(" "));
          currentEntry = [];
        }
      }
      const cleaned = cleanSceneLine(l);
      if (cleaned) currentEntry.push(cleaned);
    }
    if (currentEntry.length > 0) {
      sceneEntries.push(currentEntry.join(" "));
    }
  } else {
    const paras = cleanBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const candidate = paras.length <= 1 && lines.length > 1 ? lines : paras;
    sceneEntries = candidate.map(cleanSceneLine).filter(Boolean);
  }

  const baseCount = Math.max(existingBlocks.length, sceneEntries.length, 4);
  const updated: ScriptBlock[] = [];

  for (let i = 0; i < baseCount; i++) {
    const existing = existingBlocks[i];
    const template = defaultSceneTemplates[i] || {
      title: `Scene ${i + 1}: Take / B-Roll (${Math.max(20, (i + 1) * 7)}s)`,
      visual_cue: "B-Roll cutaway or visual proof",
      audio_notes: "Background riser or sound effect",
    };

    let spoken = existing?.spoken_words || "";
    if (sceneEntries[i]) {
      spoken = sceneEntries[i];
    }
    // If Scene 1 and explicit primaryHook provided, prioritize it
    if (i === 0 && primaryHook && primaryHook.trim()) {
      spoken = primaryHook.trim();
    }

    const words = spoken ? spoken.trim().split(/\s+/).filter(Boolean).length : 0;
    const duration = Math.max(2, Math.round((words / 140) * 60));

    updated.push({
      id: existing?.id || `scene-${i + 1}-${Date.now()}`,
      scene_number: i + 1,
      title: existing?.title || template.title,
      spoken_words: spoken,
      visual_cue: existing?.visual_cue || template.visual_cue,
      audio_notes: existing?.audio_notes || template.audio_notes,
      duration_seconds: duration || 5,
    });
  }

  return updated;
}

function TaskWorkspaceContent() {
  const params = useParams();
  const taskId = (params?.id as string) || "";

  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [updatingMetadata, setUpdatingMetadata] = useState(false);

  // Preview State
  const [activePreviewVersion, setActivePreviewVersion] = useState<SubmissionVersion | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedStoryboard, setCopiedStoryboard] = useState(false);

  // AI Specialist Drawer State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    agent_name: string;
    critique: string;
    recommended_hook: string;
    recommended_script: string;
    hook_variations: string[];
  } | null>(null);

  // ── Track 4: Creative Specialist Tooling State ──
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [checklists, setChecklists] = useState<TaskChecklistItem[]>([]);
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [savingScript, setSavingScript] = useState(false);
  const [syncingStudio, setSyncingStudio] = useState(false);
  const [teleprompterModalOpen, setTeleprompterModalOpen] = useState(false);
  const [teleprompterPlaying, setTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState<number>(1);
  const [checklistFilter, setChecklistFilter] = useState<"all" | "scripting" | "editing">("all");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newChecklistStage, setNewChecklistStage] = useState<"scripting" | "editing">("scripting");
  const teleprompterRef = useRef<HTMLDivElement>(null);

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

      if (data.script_blocks && data.script_blocks.length > 0) {
        setScriptBlocks(data.script_blocks);
      }
      if (data.checklists && data.checklists.length > 0) {
        setChecklists(data.checklists);
      }
      if (data.target_duration_seconds) {
        setTargetDuration(data.target_duration_seconds);
      }

      // Determine default submission mode based on task_type
      const ttype = (data.task_type || "").toLowerCase();
      if (
        ttype.includes("edit") ||
        ttype.includes("video") ||
        ttype.includes("film") ||
        ttype.includes("shoot") ||
        ttype.includes("design")
      ) {
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

  // Keyboard shortcut listener: ESC closes modal, Cmd+Enter submits
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (reviewModalOpen) {
          setReviewModalOpen(false);
        } else if (activePreviewVersion) {
          setActivePreviewVersion(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewModalOpen, activePreviewVersion]);

  // ── Track 4: Real-time Script Pacing & Metrics ──
  const liveTotalWords = scriptBlocks.reduce(
    (acc, b) => acc + (b.spoken_words ? b.spoken_words.trim().split(/\s+/).filter(Boolean).length : 0),
    0
  );
  // ~140 words per minute speaking pace for Reels/TikToks (~2.33 words/sec)
  const liveSpeakingSec = Math.round((liveTotalWords / 140) * 60);
  const liveHookWords =
    scriptBlocks.length > 0 && scriptBlocks[0].spoken_words
      ? scriptBlocks[0].spoken_words.trim().split(/\s+/).filter(Boolean).length
      : 0;
  const liveHookWarning =
    liveHookWords > 15
      ? `Opening hook has ${liveHookWords} words (exceeds 15-word threshold). High risk of 3-second viewer drop-off. Trim to under 12 words for optimal retention.`
      : liveHookWords >= 12
      ? `Hook has ${liveHookWords} words (borderline). Consider tightening for punchier impact.`
      : null;
  const pacingRatio = targetDuration > 0 ? liveSpeakingSec / targetDuration : 1;
  const pacingLabel =
    liveTotalWords === 0
      ? "No Dialogue Yet"
      : pacingRatio < 0.75
      ? "Short & Snappy"
      : pacingRatio <= 1.15
      ? "Optimal Viral Pace"
      : pacingRatio <= 1.35
      ? "Borderline Extended"
      : "Extended Reel (Risk of Drop-off)";

  // Auto-scroll loop for Fullscreen Teleprompter Presenter Mode
  useEffect(() => {
    let interval: any;
    if (teleprompterPlaying && teleprompterModalOpen) {
      interval = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += 2 * teleprompterSpeed;
        }
      }, 35);
    }
    return () => clearInterval(interval);
  }, [teleprompterPlaying, teleprompterModalOpen, teleprompterSpeed]);

  const handleUpdateScene = (id: string, field: keyof ScriptBlock, value: any) => {
    setScriptBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const updated = { ...block, [field]: value };
        if (field === "spoken_words") {
          const w = (value as string).trim().split(/\s+/).filter(Boolean).length;
          updated.duration_seconds = Math.max(2, Math.round((w / 140) * 60));
        }
        return updated;
      })
    );
  };

  const handleAddScene = () => {
    const nextNum = scriptBlocks.length + 1;
    const newBlock: ScriptBlock = {
      id: `scene-${Date.now()}`,
      scene_number: nextNum,
      title: `Scene ${nextNum}: Extra Take / B-Roll (${Math.max(20, nextNum * 7)}s)`,
      spoken_words: "",
      visual_cue: "B-Roll cutaway or close-up demonstration",
      audio_notes: "Background riser or sound effect",
      duration_seconds: 5,
    };
    setScriptBlocks((prev) => [...prev, newBlock]);
  };

  const handleDeleteScene = (id: string) => {
    setScriptBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSaveScriptBlocks = async () => {
    if (!token || !effectiveAgencyId || !task) return;
    setSavingScript(true);
    try {
      await taskApi.update(
        effectiveAgencyId,
        task.id,
        {
          script_blocks: scriptBlocks,
          target_duration_seconds: targetDuration,
        },
        token
      );
      setNotification({
        type: "success",
        text: "Teleprompter script & scene blocks saved successfully.",
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to save script blocks." });
    } finally {
      setSavingScript(false);
    }
  };

  const handleToggleChecklist = async (id: string) => {
    const updated = checklists.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c));
    setChecklists(updated);
    if (!token || !effectiveAgencyId || !task) return;
    try {
      await taskApi.update(effectiveAgencyId, task.id, { checklists: updated }, token);
    } catch (err) {
      console.error("Failed to persist checklist toggle", err);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now()}`,
      text: newChecklistText.trim(),
      completed: false,
      stage: newChecklistStage,
    };
    const updated = [...checklists, newItem];
    setChecklists(updated);
    setNewChecklistText("");
    if (!token || !effectiveAgencyId || !task) return;
    try {
      await taskApi.update(effectiveAgencyId, task.id, { checklists: updated }, token);
    } catch (err) {
      console.error("Failed to add checklist item", err);
    }
  };

  const handleSyncToStudio = async () => {
    if (!token || !effectiveAgencyId || !task) return;
    setSyncingStudio(true);
    try {
      const firstSceneWords = scriptBlocks.length > 0 ? scriptBlocks[0].spoken_words : "";
      const lastSceneWords = scriptBlocks.length > 1 ? scriptBlocks[scriptBlocks.length - 1].spoken_words : "";
      const res = await taskApi.syncStudio(
        effectiveAgencyId,
        task.id,
        {
          hook: firstSceneWords || undefined,
          cta: lastSceneWords || undefined,
          visual_concept: scriptBlocks[0]?.visual_cue || undefined,
          audio_vibe: scriptBlocks[0]?.audio_notes || undefined,
          script_blocks: scriptBlocks,
        },
        token
      );
      setNotification({
        type: "success",
        text: res.message || "Script and visual directives synced to Campaign Studio!",
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to sync with Campaign Studio." });
    } finally {
      setSyncingStudio(false);
    }
  };

  // Handle reassigning task
  const handleReassign = async (newAssigneeId: string | null) => {
    if (!token || !effectiveAgencyId || !task) return;
    setUpdatingMetadata(true);
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
              assignee_name:
                selectedMember?.user_full_name || selectedMember?.user_email?.split("@")[0] || null,
              assignee_role: selectedMember?.role || null,
            }
          : prev
      );
      setNotification({
        type: "success",
        text: newAssigneeId ? "Task reassigned successfully." : "Task marked as unassigned.",
      });
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to reassign task" });
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Handle updating status
  const handleUpdateStatus = async (newStatus: TaskDetail["status"]) => {
    if (!token || !effectiveAgencyId || !task) return;
    setUpdatingMetadata(true);
    try {
      await taskApi.update(effectiveAgencyId, task.id, { status: newStatus }, token);
      setTask((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setNotification({
        type: "success",
        text: `Task status updated to ${newStatus.replace("_", " ")}.`,
      });
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to update status." });
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Handle updating priority
  const handleUpdatePriority = async (newPriority: TaskDetail["priority"]) => {
    if (!token || !effectiveAgencyId || !task) return;
    setUpdatingMetadata(true);
    try {
      await taskApi.update(effectiveAgencyId, task.id, { priority: newPriority }, token);
      setTask((prev) => (prev ? { ...prev, priority: newPriority } : prev));
      setNotification({
        type: "success",
        text: `Task priority set to ${newPriority.toUpperCase()}.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to update priority." });
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Load preview content if text
  const openPreview = async (sub: SubmissionVersion) => {
    setActivePreviewVersion(sub);
    const isText =
      sub.file_type?.includes("text") ||
      sub.file_name.endsWith(".txt") ||
      sub.file_name.endsWith(".md");
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

  // Copy helper
  const copyToClipboard = (text: string, type: "brief" | "storyboard") => {
    navigator.clipboard.writeText(text);
    if (type === "brief") {
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2000);
    } else {
      setCopiedStoryboard(true);
      setTimeout(() => setCopiedStoryboard(false), 2000);
    }
  };

  // AI Specialist Assistant Runner
  const handleRunAIAssist = async (overridePrompt?: string) => {
    if (!token || !effectiveAgencyId || !taskId) return;
    const promptToUse = (overridePrompt || aiInstruction).trim();
    if (!promptToUse) {
      setNotification({
        type: "error",
        text: "Please enter an instruction or click a prompt chip.",
      });
      return;
    }
    setAiLoading(true);
    try {
      const res = await taskApi.aiAssist(
        effectiveAgencyId,
        taskId,
        {
          instruction: promptToUse,
          current_hook: hook || undefined,
          current_script: scriptBody || undefined,
          task_type: task?.task_type || undefined,
        },
        token
      );
      setAiResult(res);
      setAiDrawerOpen(true);
      setNotification({
        type: "success",
        text: `AI Specialist (${res.agent_name}) generated creative recommendations!`,
      });
    } catch (err: any) {
      console.error("AI Specialist assist failed:", err);
      setNotification({
        type: "error",
        text: err?.message || "Failed to generate AI specialist suggestions.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyHook = async (selectedHook: string) => {
    setHook(selectedHook);
    if (submissionMode !== "script") {
      setSubmissionMode("script");
    }

    // Direct Dual Insert: Update Scene 1 in scriptBlocks immediately
    let updated: ScriptBlock[] = [];
    if (scriptBlocks.length > 0) {
      updated = scriptBlocks.map((b, idx) => {
        if (idx === 0) {
          const w = selectedHook.trim().split(/\s+/).filter(Boolean).length;
          return {
            ...b,
            spoken_words: selectedHook,
            duration_seconds: Math.max(2, Math.round((w / 140) * 60)),
          };
        }
        return b;
      });
    } else {
      updated = parseScriptIntoSceneBlocks("", [], selectedHook);
    }
    setScriptBlocks(updated);

    // Auto-save to backend task so Teleprompter Presenter view & database reflect it instantly
    if (token && effectiveAgencyId && taskId) {
      try {
        await taskApi.update(effectiveAgencyId, taskId, { script_blocks: updated }, token);
      } catch (err) {
        console.error("Failed to auto-persist hook to script_blocks:", err);
      }
    }

    setNotification({
      type: "success",
      text: "Inserted recommended hook into Scene 1 & submission draft (saved to teleprompter)!",
    });
  };

  const handleApplyScript = async (selectedScript: string) => {
    setScriptBody(selectedScript);
    if (submissionMode !== "script") {
      setSubmissionMode("script");
    }

    // Direct Dual Insert: Parse script into structured teleprompter scene blocks
    const updated = parseScriptIntoSceneBlocks(selectedScript, scriptBlocks, hook || undefined);
    setScriptBlocks(updated);

    // Auto-save to backend task so Teleprompter Presenter view & database reflect it instantly
    if (token && effectiveAgencyId && taskId) {
      try {
        await taskApi.update(effectiveAgencyId, taskId, { script_blocks: updated }, token);
      } catch (err) {
        console.error("Failed to auto-persist script to script_blocks:", err);
      }
    }

    setNotification({
      type: "success",
      text: "Inserted script dialogue into Teleprompter scenes & submission draft (saved to teleprompter)!",
    });
  };

  const handleCopyScenesToSubmission = () => {
    if (scriptBlocks.length === 0) return;
    const scene1Words = scriptBlocks[0]?.spoken_words || "";
    const remainingScenes = scriptBlocks.slice(1);
    const bodyText = remainingScenes
      .filter((s) => s.spoken_words.trim().length > 0)
      .map((s) => `${s.title}:\n${s.spoken_words}`)
      .join("\n\n");

    if (scene1Words) setHook(scene1Words);
    if (bodyText) setScriptBody(bodyText);
    setSubmissionMode("script");
    setNotification({
      type: "success",
      text: "Copied Teleprompter scenes into submission draft below!",
    });
  };

  const handleSyncFromTeleprompter = () => {
    if (scriptBlocks.length === 0) {
      setNotification({
        type: "error",
        text: "No Teleprompter scenes found to sync.",
      });
      return;
    }
    const scene1Words = scriptBlocks[0]?.spoken_words || "";
    const remainingScenes = scriptBlocks.slice(1);
    const bodyText = remainingScenes
      .filter((s) => s.spoken_words.trim().length > 0)
      .map((s) => `${s.title}:\n${s.spoken_words}`)
      .join("\n\n");

    if (scene1Words) setHook(scene1Words);
    if (bodyText) setScriptBody(bodyText);
    setNotification({
      type: "success",
      text: "Synced submission draft with latest Teleprompter scenes!",
    });
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
      await taskApi.review(
        effectiveAgencyId,
        taskId,
        {
          decision: reviewDecision,
          feedback_notes: feedbackNotes.trim() || undefined,
        },
        token
      );

      setReviewModalOpen(false);
      setFeedbackNotes("");
      setNotification({
        type: "success",
        text:
          reviewDecision === "approved"
            ? "Submission approved! The deliverable has advanced."
            : "Revision request dispatched to the assigned specialist.",
      });
      await loadTask();
    } catch (err: any) {
      console.error("Review failed:", err);
      setError(err?.message || "Failed to submit review decision");
    } finally {
      setReviewing(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!token || !effectiveAgencyId || !task) return;
    setDeleting(true);
    try {
      await taskApi.delete(effectiveAgencyId, task.id, token);
      window.location.href = "/tasks";
    } catch (err: any) {
      setError(err?.message || "Failed to delete task.");
      setShowDeleteModal(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-[#A78BFA] animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#A3A0B0]">Loading task execution workspace...</p>
        </div>
      </main>
    );
  }

  if (error && !task) {
    return (
      <main className="flex-1 p-8 max-w-4xl mx-auto space-y-4">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#A3A0B0] hover:text-[#A78BFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Task Pipeline
        </Link>
        <div className="bg-[#E16F7B]/10 border border-[#E16F7B]/30 rounded-2xl p-6 text-[#E16F7B]">
          <h2 className="text-base font-heading font-bold text-[#F2F0F7]">Task Error</h2>
          <p className="text-xs mt-1 text-[#E16F7B]">{error}</p>
        </div>
      </main>
    );
  }

  if (!task) return null;

  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(
    currentMembership?.role || "owner"
  );
  const isInternalReview = task.status === "internal_review";
  const isRevisionRequested = task.status === "changes_requested";
  const isApproved = ["approved", "done"].includes(task.status);
  const sla = getSlaStatus(task.due_date);

  // Stepper active index
  const currentStageIndex = PRODUCTION_STAGES.findIndex((stage) =>
    stage.statuses.includes(task.status)
  );

  return (
    <div className="min-h-full w-full bg-[#101014] text-[#F2F0F7] pb-16">
      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* ── Breadcrumb Navigation & Top Action Bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0] flex-wrap">
              <Link
                href="/tasks"
                className="hover:text-[#A78BFA] flex items-center gap-1 text-[#A78BFA] transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5" /> Tasks
              </Link>
              <span className="text-white/[0.2]">/</span>
              {task.client_name && (
                <>
                  <Link
                    href={task.client_id ? `/clients/${task.client_id}` : "/clients"}
                    className="hover:text-[#F2F0F7] text-[#A3A0B0] transition-colors"
                  >
                    {task.client_name}
                  </Link>
                  <span className="text-white/[0.2]">/</span>
                </>
              )}
              <span className="truncate max-w-[200px] text-[#A3A0B0]">{task.campaign_title || "Campaign"}</span>
            </div>

            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
                {task.title}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  task.status === "changes_requested"
                    ? "bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30"
                    : task.status === "internal_review"
                    ? "bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30"
                    : isApproved
                    ? "bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30"
                    : "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30"
                }`}
              >
                {task.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {sla && (
              <div
                className={`surface-card border rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-xs font-mono ${
                  sla.tone === "critical"
                    ? "border-[#E16F7B]/40 text-[#E16F7B] bg-[#E16F7B]/10 font-bold"
                    : sla.tone === "urgent" || sla.tone === "warning"
                    ? "border-[#E5AA58]/40 text-[#E5AA58] bg-[#E5AA58]/10 font-medium"
                    : "border-white/[0.08] text-[#A3A0B0]"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{sla.text}</span>
              </div>
            )}

            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] text-xs font-medium text-[#F2F0F7] transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Tasks</span>
            </Link>
          </div>
        </div>

        {/* ── Notification Banner ── */}
        {notification && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
              notification.type === "success"
                ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                : "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* ── Linear Lifecycle Progress Stepper ── */}
        <div className="surface-card rounded-2xl border border-white/[0.08] p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            {PRODUCTION_STAGES.map((st, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <div key={st.id} className="flex items-center gap-2 flex-1 min-w-[120px]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                        isPast
                          ? "bg-[#45B88A] text-[#101014]"
                          : isCurrent
                          ? "bg-[#A78BFA] text-[#101014] ring-4 ring-[#A78BFA]/20"
                          : "bg-[#20202A] text-[#71717A] border border-white/[0.08]"
                      }`}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs whitespace-nowrap font-medium ${
                        isCurrent
                          ? "text-[#F2F0F7] font-semibold"
                          : isPast
                          ? "text-[#A3A0B0]"
                          : "text-[#71717A]"
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                  {idx < PRODUCTION_STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-[2px] mx-2 rounded-full hidden sm:block ${
                        isPast ? "bg-[#45B88A]/60" : "bg-white/[0.08]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Manager Review Action Banner (Active during internal_review) ── */}
        {isInternalReview && isManagerOrOwner && (
          <div className="surface-card border border-[#A78BFA]/40 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#A78BFA] font-heading font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
                <span>Internal Review Gate Required</span>
              </div>
              <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
                The assigned specialist has submitted a version for this task. Review the deliverables below and either approve to unlock the next production stage or request specific revisions.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => {
                  setReviewDecision("changes_requested");
                  setReviewModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E5AA58]/10 hover:bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#E5AA58]" />
                <span>Request Revision</span>
              </button>

              <button
                onClick={() => {
                  setReviewDecision("approved");
                  setReviewModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#45B88A] hover:bg-[#52c595] text-[#101014] text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Approve Submission</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Revision Requested Notice (For specialist) ── */}
        {isRevisionRequested && (
          <div className="bg-[#17171E] border border-[#E5AA58]/40 rounded-2xl p-5 space-y-3 text-[#E5AA58] shadow-sm">
            <div className="flex items-center gap-2 text-[#E5AA58] font-heading font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-[#E5AA58]" />
              <span>Revisions Requested by Manager</span>
            </div>
            <p className="text-xs text-[#A3A0B0] leading-relaxed">
              Please review the feedback below, make the necessary modifications to your script or media asset, and submit a new version.
            </p>
            {task.review_comments.length > 0 && (
              <div className="bg-[#101014] p-3.5 rounded-xl border border-white/[0.08] text-xs font-mono text-[#F2F0F7] leading-relaxed">
                <span className="text-[#A3A0B0] block text-[10px] uppercase font-semibold mb-1">
                  Manager Feedback:
                </span>
                {task.review_comments[task.review_comments.length - 1].message}
              </div>
            )}
          </div>
        )}

        {/* ── Linear 2-Column Execution Workspace ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Column (Main Workspace, 8 cols) ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Creative Brief Card */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider">
                    Creative Brief & Context
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 uppercase">
                    {task.platform} • {task.deliverable_type}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Campaign: ${task.campaign_title}\nObjective: ${task.campaign_objective}\nBrand Voice: ${task.brand_voice}`,
                        "brief"
                      )
                    }
                    className="p-1 rounded-md text-[#71717A] hover:text-[#F2F0F7] transition-colors"
                    title="Copy brief to clipboard"
                  >
                    {copiedBrief ? (
                      <Check className="w-3.5 h-3.5 text-[#45B88A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[#A3A0B0] block font-medium mb-1">Campaign Objective</span>
                  <p className="text-[#F2F0F7] leading-relaxed bg-[#101014] p-3 rounded-xl border border-white/[0.06]">
                    {task.campaign_objective ||
                      "Promote campaign deliverables and drive target audience engagement."}
                  </p>
                </div>

                {task.brand_voice && (
                  <div>
                    <span className="text-[#A3A0B0] block font-medium mb-1">
                      Brand Voice & Guidelines
                    </span>
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
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-[#20202A] border border-white/[0.06] text-[#A3A0B0] text-[11px] font-mono"
                        >
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
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider">
                    Storyboard & Script Directions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#A3A0B0]">Architect Specs</span>
                  {task.storyboard_text && (
                    <button
                      onClick={() => copyToClipboard(task.storyboard_text || "", "storyboard")}
                      className="p-1 rounded-md text-[#71717A] hover:text-[#F2F0F7] transition-colors"
                      title="Copy storyboard"
                    >
                      {copiedStoryboard ? (
                        <Check className="w-3.5 h-3.5 text-[#45B88A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {task.storyboard_text ? (
                <div className="space-y-2">
                  <div className="max-h-[380px] overflow-y-auto bg-[#0D0D12] p-4 rounded-xl border border-white/[0.08] font-mono text-xs text-[#F2F0F7] leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                    {task.storyboard_text}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#71717A] italic py-3 font-mono">
                  No formal storyboard attached to this deliverable.
                </p>
              )}
            </div>

            {/* ── TRACK 4: VIRAL TELEPROMPTER & SCRIPT PRECISION STUDIO ── */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-5 shadow-xs bg-gradient-to-b from-[#14141A] to-[#101014]">
              {/* Studio Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center shrink-0">
                      <Mic className="w-3.5 h-3.5 text-[#A78BFA]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold text-[#F2F0F7] flex items-center gap-2">
                        <span>Viral Teleprompter & Script Studio</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 uppercase">
                          Precision Pacing
                        </span>
                      </h3>
                      <p className="text-[11px] text-[#A3A0B0]">
                        Structured scene beats, speaking duration pacing & bi-directional Campaign Studio synchronization.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Target Duration Selector */}
                  <div className="flex items-center gap-1.5 bg-[#20202A] px-2.5 py-1.5 rounded-xl border border-white/[0.08] text-xs font-mono">
                    <Timer className="w-3.5 h-3.5 text-[#A3A0B0]" />
                    <span className="text-[11px] text-[#A3A0B0]">Target:</span>
                    <select
                      value={targetDuration}
                      onChange={(e) => setTargetDuration(Number(e.target.value))}
                      className="bg-transparent text-[#F2F0F7] font-bold text-xs focus:outline-none cursor-pointer"
                    >
                      <option value={15} className="bg-[#20202A]">15s (Flash)</option>
                      <option value={30} className="bg-[#20202A]">30s (Standard)</option>
                      <option value={45} className="bg-[#20202A]">45s (Extended)</option>
                      <option value={60} className="bg-[#20202A]">60s (Long)</option>
                    </select>
                  </div>

                  {/* Fullscreen Teleprompter Button */}
                  <button
                    onClick={() => {
                      setTeleprompterPlaying(false);
                      setTeleprompterModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202A] hover:bg-[#2a2a38] text-[#F2F0F7] text-xs font-semibold border border-white/[0.08] transition-all cursor-pointer"
                    title="Open Fullscreen Teleprompter for Recording"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>Teleprompter Mode</span>
                  </button>

                  {/* Sync to Campaign Studio */}
                  <button
                    onClick={handleSyncToStudio}
                    disabled={syncingStudio}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    title="Push updated script & hook back to Campaign Studio plan"
                  >
                    {syncingStudio ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>Sync to Studio</span>
                  </button>

                  {/* Copy Scenes to Submission Draft Form */}
                  <button
                    onClick={handleCopyScenesToSubmission}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202A] hover:bg-[#2c2c3b] text-[#69A9D8] border border-[#69A9D8]/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    title="Populate submission draft form below with current teleprompter scenes"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>Copy to Draft</span>
                  </button>

                  {/* Save Script */}
                  <button
                    onClick={handleSaveScriptBlocks}
                    disabled={savingScript}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#A78BFA] hover:bg-[#906fe7] text-[#101014] text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {savingScript ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>Save Script</span>
                  </button>
                </div>
              </div>

              {/* ── Live Speaking Duration & Word-Count Meter Bar ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total Words & Speaking Speed */}
                <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-mono">
                    <span>Word Count & Pacing</span>
                    <span className="text-[#A78BFA] font-bold">~140 WPM</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-heading font-extrabold text-[#F2F0F7]">{liveTotalWords}</span>
                    <span className="text-xs text-[#A3A0B0]">spoken words</span>
                  </div>
                  <p className="text-[10px] text-[#71717A] font-mono">
                    Standard viral short-form pace: ~2.3 words/sec
                  </p>
                </div>

                {/* Estimated Duration vs Target Gauge */}
                <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-mono">
                    <span>Duration vs Target</span>
                    <span className={`font-bold ${liveSpeakingSec > targetDuration ? "text-[#E16F7B]" : "text-[#45B88A]"}`}>
                      {liveSpeakingSec}s / {targetDuration}s
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-[#20202A] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        liveSpeakingSec > targetDuration
                          ? "bg-[#E16F7B]"
                          : liveSpeakingSec >= targetDuration * 0.8
                          ? "bg-[#45B88A]"
                          : "bg-[#69A9D8]"
                      }`}
                      style={{ width: `${Math.min(100, targetDuration > 0 ? (liveSpeakingSec / targetDuration) * 100 : 0)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#A3A0B0]">{pacingLabel}</span>
                    <span className="text-[#71717A]">
                      {targetDuration - liveSpeakingSec >= 0 ? `${targetDuration - liveSpeakingSec}s remaining` : `${liveSpeakingSec - targetDuration}s over target`}
                    </span>
                  </div>
                </div>

                {/* Hook Retention Score */}
                <div className={`border rounded-xl p-3.5 space-y-1 ${
                  liveHookWords > 15
                    ? "bg-[#E16F7B]/10 border-[#E16F7B]/30"
                    : liveHookWords >= 12
                    ? "bg-[#E5AA58]/10 border-[#E5AA58]/30"
                    : "bg-[#45B88A]/10 border-[#45B88A]/30"
                }`}>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-semibold flex items-center gap-1">
                      <Flame className={`w-3.5 h-3.5 ${liveHookWords > 15 ? "text-[#E16F7B]" : liveHookWords >= 12 ? "text-[#E5AA58]" : "text-[#45B88A]"}`} />
                      <span>Hook Retention</span>
                    </span>
                    <span className={`font-bold ${liveHookWords > 15 ? "text-[#E16F7B]" : liveHookWords >= 12 ? "text-[#E5AA58]" : "text-[#45B88A]"}`}>
                      {liveHookWords} words (Scene 1)
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#F2F0F7] pt-0.5">
                    {liveHookWords === 0
                      ? "No hook written yet"
                      : liveHookWords <= 12
                      ? "✓ High 3s Retention (<12 words)"
                      : liveHookWords <= 15
                      ? "⚠ Borderline Retention (12–15 words)"
                      : "🚨 High Drop-Off Risk (>15 words)"}
                  </p>
                  <p className="text-[10px] text-[#A3A0B0] leading-tight">
                    {liveHookWords <= 12 ? "Viewers make stay/swipe decisions in 1.5s." : "Hooks over 15 words suffer ~40% viewer drop-off."}
                  </p>
                </div>
              </div>

              {/* Hook Warning Banner (Alert if exceeds 15 words) */}
              {liveHookWarning && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  liveHookWords > 15
                    ? "bg-[#E16F7B]/10 border-[#E16F7B]/30 text-[#E16F7B]"
                    : "bg-[#E5AA58]/10 border-[#E5AA58]/30 text-[#E5AA58]"
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Hook Length Warning (Viewer Retention Guardrail):</span>
                    <p className="text-[#F2F0F7] leading-relaxed">{liveHookWarning}</p>
                  </div>
                </div>
              )}

              {/* ── Scene-by-Scene Structured Teleprompter Blocks ── */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#A3A0B0] uppercase tracking-wider">
                    Structured Scene Beats ({scriptBlocks.length} Scenes)
                  </span>
                  <button
                    onClick={handleAddScene}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-[#A78BFA] hover:text-[#c4b5fd] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Scene Take
                  </button>
                </div>

                <div className="space-y-3">
                  {scriptBlocks.map((block, idx) => {
                    const sceneWords = block.spoken_words.trim().split(/\s+/).filter(Boolean).length;
                    const sceneDuration = Math.max(2, Math.round((sceneWords / 140) * 60));

                    return (
                      <div
                        key={block.id}
                        className="bg-[#101014] border border-white/[0.08] hover:border-[#A78BFA]/30 rounded-xl p-4 space-y-3 transition-colors shadow-xs"
                      >
                        {/* Scene Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/[0.04] pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#20202A] text-[#A78BFA] font-mono font-bold text-xs flex items-center justify-center border border-white/[0.06]">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) => handleUpdateScene(block.id, "title", e.target.value)}
                              className="bg-transparent text-xs font-bold text-[#F2F0F7] focus:outline-none hover:border-b border-white/[0.2] py-0.5"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#20202A] px-2 py-0.5 rounded-md border border-white/[0.06]">
                              {sceneWords} words • ~{sceneDuration}s
                            </span>
                            {scriptBlocks.length > 1 && (
                              <button
                                onClick={() => handleDeleteScene(block.id)}
                                className="p-1 rounded-md text-[#71717A] hover:text-[#E16F7B] transition-colors cursor-pointer"
                                title="Delete Scene"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scene Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {/* Spoken Dialogue (Col 7) */}
                          <div className="md:col-span-7 space-y-1">
                            <label className="text-[10px] font-mono text-[#A3A0B0] uppercase font-semibold flex items-center gap-1">
                              <Mic className="w-3 h-3 text-[#A78BFA]" />
                              <span>Spoken Words / Voiceover</span>
                            </label>
                            <textarea
                              rows={3}
                              value={block.spoken_words}
                              onChange={(e) => handleUpdateScene(block.id, "spoken_words", e.target.value)}
                              placeholder="What the creator / voiceover actually says word-for-word..."
                              className="w-full bg-[#0D0D12] text-xs text-[#F2F0F7] font-mono p-3 rounded-lg border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none resize-y leading-relaxed placeholder-[#71717A]"
                            />
                          </div>

                          {/* Visual Directive & Audio Notes (Col 5) */}
                          <div className="md:col-span-5 space-y-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-[#A3A0B0] uppercase font-semibold flex items-center gap-1">
                                <Film className="w-3 h-3 text-[#69A9D8]" />
                                <span>Visual Cue & B-Roll</span>
                              </label>
                              <input
                                type="text"
                                value={block.visual_cue || ""}
                                onChange={(e) => handleUpdateScene(block.id, "visual_cue", e.target.value)}
                                placeholder="Camera angle, split screen, graphic overlay..."
                                className="w-full bg-[#0D0D12] text-[11px] text-[#F2F0F7] px-3 py-1.5 rounded-lg border border-white/[0.08] focus:border-[#69A9D8] focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-[#A3A0B0] uppercase font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#E5AA58]" />
                                <span>Audio & SFX Notes</span>
                              </label>
                              <input
                                type="text"
                                value={block.audio_notes || ""}
                                onChange={(e) => handleUpdateScene(block.id, "audio_notes", e.target.value)}
                                placeholder="Tension build, riser, chime, upbeat rhythm..."
                                className="w-full bg-[#0D0D12] text-[11px] text-[#F2F0F7] px-3 py-1.5 rounded-lg border border-white/[0.08] focus:border-[#E5AA58] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── IN-TASK PRODUCTION CHECKLISTS / SUBTASKS ── */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              {/* Checklist Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-[#A78BFA]" />
                  <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider">
                    Production Checklists & Quality Subtasks
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-[#20202A] p-0.5 rounded-xl border border-white/[0.06] text-xs">
                  {(["all", "scripting", "editing"] as const).map((stage) => (
                    <button
                      key={stage}
                      onClick={() => setChecklistFilter(stage)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize cursor-pointer ${
                        checklistFilter === stage
                          ? "bg-[#A78BFA] text-[#101014] font-bold shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                      }`}
                    >
                      {stage === "all" ? "All Stages" : stage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              {checklists.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A3A0B0]">
                      Completed: {checklists.filter((c) => c.completed).length} / {checklists.length} Subtasks
                    </span>
                    <span className="font-bold text-[#A78BFA]">
                      {Math.round((checklists.filter((c) => c.completed).length / checklists.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#20202A] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#A78BFA] to-[#45B88A] h-full transition-all duration-300"
                      style={{
                        width: `${(checklists.filter((c) => c.completed).length / checklists.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Checklist Items List */}
              <div className="space-y-2">
                {checklists
                  .filter((c) => checklistFilter === "all" || c.stage === checklistFilter)
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        item.completed
                          ? "bg-[#101014]/60 border-white/[0.04] opacity-70"
                          : "bg-[#101014] border-white/[0.08] hover:border-[#A78BFA]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors border ${
                            item.completed
                              ? "bg-[#45B88A] border-[#45B88A] text-[#101014]"
                              : "bg-[#20202A] border-white/[0.12] text-transparent hover:border-[#A78BFA]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span
                          className={`text-xs ${
                            item.completed
                              ? "line-through text-[#71717A]"
                              : "text-[#F2F0F7] font-medium"
                          }`}
                        >
                          {item.text}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#20202A] text-[#A3A0B0] border border-white/[0.06]">
                        {item.stage}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Add Custom Subtask Form */}
              <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Add a new production subtask (e.g. Export 9:16 vertical crop)..."
                  className="flex-1 bg-[#101014] text-xs text-[#F2F0F7] px-3.5 py-2 rounded-xl border border-white/[0.08] focus:border-[#A78BFA] focus:outline-none"
                />
                <select
                  value={newChecklistStage}
                  onChange={(e) => setNewChecklistStage(e.target.value as any)}
                  className="bg-[#20202A] text-[#A3A0B0] text-xs font-mono px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none cursor-pointer"
                >
                  <option value="scripting">Scripting</option>
                  <option value="editing">Editing</option>
                  <option value="qa">QA Review</option>
                </select>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#20202A] hover:bg-[#A78BFA] hover:text-[#101014] text-xs font-bold text-[#F2F0F7] border border-white/[0.08] transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

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
                <div className="p-8 text-center border border-dashed border-white/[0.08] rounded-2xl space-y-2 bg-[#101014]/60">
                  <FileText className="w-8 h-8 text-[#71717A] mx-auto" />
                  <p className="text-xs font-semibold text-[#F2F0F7]">No versions submitted yet.</p>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Use the submission form below to deliver the first version.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {task.submissions.map((sub) => {
                    const isApprovedVer = sub.approval_status === "approved";
                    const isChangesReq = sub.approval_status === "changes_requested";

                    return (
                      <div
                        key={sub.id}
                        className="bg-[#101014] border border-white/[0.08] rounded-xl p-4 space-y-3 transition-colors hover:border-[#A78BFA]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-[#20202A] text-[#A78BFA] border border-white/[0.08] font-mono font-bold text-xs flex items-center justify-center">
                              v{sub.version_number}
                            </span>
                            <div>
                              <span className="text-xs font-semibold text-[#F2F0F7] block">
                                {sub.file_name}
                              </span>
                              <span className="text-[10px] font-mono text-[#71717A]">
                                {new Date(sub.created_at).toLocaleString()} •{" "}
                                {sub.file_size_bytes
                                  ? `${Math.round(sub.file_size_bytes / 1024)} KB`
                                  : "Asset"}
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
                                <AlertTriangle className="w-3 h-3 text-[#E5AA58]" /> Revision Needed
                              </span>
                            )}

                            <button
                              onClick={() => openPreview(sub)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20202A] hover:bg-[#262630] text-xs font-semibold text-[#F2F0F7] border border-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#A78BFA]" />
                              <span>Preview</span>
                            </button>

                            {sub.url && (
                              <a
                                href={sub.url.startsWith("http") ? sub.url : `${API_BASE}${sub.url}`}
                                download
                                className="p-1 rounded-lg bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08] transition-colors"
                                title="Download Asset"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Approval / Feedback Note attached to version */}
                        {sub.approval_notes && (
                          <div className="bg-[#17171E] p-3 rounded-lg border border-white/[0.08] text-xs text-[#F2F0F7]">
                            <span className="font-semibold text-[#71717A] block text-[10px] uppercase font-mono">
                              Reviewer Feedback:
                            </span>
                            <p className="mt-0.5 font-medium text-[#A3A0B0] leading-relaxed">
                              {sub.approval_notes}
                            </p>
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
              <div className="surface-card border border-[#A78BFA]/50 rounded-2xl p-5 space-y-3 shadow-md animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span className="text-xs font-semibold text-[#F2F0F7]">
                      Preview: {activePreviewVersion.file_name} (Version{" "}
                      {activePreviewVersion.version_number})
                    </span>
                  </div>
                  <button
                    onClick={() => setActivePreviewVersion(null)}
                    className="p-1 rounded-lg hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {previewLoading ? (
                  <div className="py-8 text-center text-xs text-[#A3A0B0] flex items-center justify-center gap-2 font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A78BFA]" /> Loading asset
                    preview...
                  </div>
                ) : activePreviewVersion.file_type?.includes("video") ||
                  activePreviewVersion.file_name.endsWith(".mp4") ||
                  activePreviewVersion.file_name.endsWith(".mov") ? (
                  <div className="space-y-2">
                    <video
                      src={
                        activePreviewVersion.url?.startsWith("http")
                          ? activePreviewVersion.url
                          : `${API_BASE}${activePreviewVersion.url}`
                      }
                      controls
                      className="w-full max-h-[380px] rounded-xl bg-black border border-white/[0.08]"
                    />
                  </div>
                ) : previewContent ? (
                  <div className="max-h-[320px] overflow-y-auto bg-[#0D0D12] p-4 rounded-xl border border-white/[0.08] font-mono text-xs text-[#F2F0F7] whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                    {previewContent}
                  </div>
                ) : (
                  <p className="text-xs text-[#A3A0B0]/60 italic py-3">
                    Preview not available for this file type. Please download to inspect.
                  </p>
                )}
              </div>
            )}

            {/* Submission Action Workspace (For Employee / Specialist) */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
                <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="w-3.5 h-3.5 text-[#A78BFA]" /> Submit Deliverable Work
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAiDrawerOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      aiDrawerOpen
                        ? "bg-[#A78BFA]/20 text-[#A78BFA] border-[#A78BFA]/50 shadow-xs"
                        : "bg-[#20202A] text-[#F2F0F7] border-white/[0.08] hover:border-[#A78BFA]/30"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>{aiDrawerOpen ? "Close AI Copilot" : "AI Specialist Copilot"}</span>
                  </button>

                  {/* Mode Toggle */}
                  <div className="flex items-center gap-1 bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setSubmissionMode("script")}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                        submissionMode === "script"
                          ? "bg-white/[0.08] text-[#A78BFA] font-semibold shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                      }`}
                    >
                      Text Script
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionMode("media")}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                        submissionMode === "media"
                          ? "bg-white/[0.08] text-[#A78BFA] font-semibold shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                      }`}
                    >
                      Media File
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Specialist Assistant Drawer */}
              {aiDrawerOpen && (
                <div className="surface-card border border-[#A78BFA]/40 bg-[#121218] rounded-2xl p-4.5 space-y-4 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#A78BFA]/20 text-[#A78BFA] flex items-center justify-center border border-[#A78BFA]/30">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#F2F0F7] flex items-center gap-1.5">
                          <span>In-Task AI Specialist</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 uppercase">
                            {aiResult?.agent_name || (task?.task_type?.toLowerCase().includes("video") || task?.task_type?.toLowerCase().includes("film") ? "Creative Director & Storyboard Lead" : "Lead Content Architect")}
                          </span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiDrawerOpen(false)}
                      className="p-1 rounded-lg hover:bg-white/[0.06] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
                      title="Close drawer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Action Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#A3A0B0] uppercase block">
                      Quick Action Prompts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Audit Hook for Retention", icon: "🎯", prompt: "Audit the current hook against high-retention social benchmarks and critique drop-off risks." },
                        { label: "Generate 3 Punchy Hook Variations", icon: "⚡", prompt: "Generate 3 punchy, scroll-stopping hook variations for this deliverable format." },
                        { label: "Check Brand Voice Compliance", icon: "🛡️", prompt: "Analyze tone and ensure strict compliance with client brand voice and audience personas." },
                        { label: "Expand 3-Scene Storyboard Dialogue", icon: "🎬", prompt: "Expand full scene-by-scene script dialogue and visual directions based on storyboard specs." },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          disabled={aiLoading}
                          onClick={() => {
                            setAiInstruction(chip.prompt);
                            handleRunAIAssist(chip.prompt);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a24] hover:bg-[#252533] border border-white/[0.08] hover:border-[#A78BFA]/40 text-[11px] text-[#F2F0F7] font-medium transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span>{chip.icon}</span>
                          <span>{chip.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Instruction Box */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Or type custom prompt (e.g. 'Make the hook more confrontational', 'Add a 3s visual gag')..."
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleRunAIAssist();
                          }
                        }}
                        disabled={aiLoading}
                        className="flex-1 bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleRunAIAssist()}
                        disabled={aiLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#b69bff] text-[#101014] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {aiLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Thinking...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Run AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* AI Results Section */}
                  {aiResult && (
                    <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                      {/* Critique */}
                      <div className="bg-[#171720] p-3 rounded-xl border border-white/[0.08] space-y-1">
                        <span className="text-[10px] font-mono font-bold text-[#A78BFA] uppercase tracking-wider block">
                          Specialist Critique & Creative Direction
                        </span>
                        <p className="text-xs text-[#F2F0F7] leading-relaxed">
                          {aiResult.critique}
                        </p>
                      </div>

                      {/* Primary Recommended Hook */}
                      {aiResult.recommended_hook && (
                        <div className="bg-[#101014] p-3 rounded-xl border border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#45B88A] uppercase">
                              Recommended Primary Hook (0-3s)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplyHook(aiResult.recommended_hook)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#45B88A]/10 hover:bg-[#45B88A]/20 text-[#45B88A] border border-[#45B88A]/30 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              <CornerDownLeft className="w-3 h-3" />
                              <span>Insert Hook</span>
                            </button>
                          </div>
                          <p className="text-xs text-[#F2F0F7] font-medium italic">
                            "{aiResult.recommended_hook}"
                          </p>
                        </div>
                      )}

                      {/* Hook Variations */}
                      {aiResult.hook_variations && aiResult.hook_variations.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-[#A3A0B0] uppercase block">
                            Alternative Hook Variations
                          </span>
                          <div className="space-y-1.5">
                            {aiResult.hook_variations.map((hVar, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 bg-[#101014] px-3 py-2 rounded-xl border border-white/[0.06] text-xs text-[#F2F0F7]"
                              >
                                <span className="truncate flex-1 font-sans text-[11px]">
                                  {idx + 1}. "{hVar}"
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleApplyHook(hVar)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#20202A] hover:bg-[#2c2c3b] text-[#A78BFA] border border-white/[0.08] text-[10px] font-semibold transition-all cursor-pointer shrink-0"
                                >
                                  <span>Use</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Script */}
                      {aiResult.recommended_script && (
                        <div className="bg-[#101014] p-3 rounded-xl border border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#69A9D8] uppercase">
                              Recommended Dialogue & Scene Breakdown
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplyScript(aiResult.recommended_script)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#69A9D8]/10 hover:bg-[#69A9D8]/20 text-[#69A9D8] border border-[#69A9D8]/30 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              <CornerDownLeft className="w-3 h-3" />
                              <span>Insert Script</span>
                            </button>
                          </div>
                          <pre className="text-xs text-[#F2F0F7] font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-[#0d0d12] p-2.5 rounded-lg border border-white/[0.04]">
                            {aiResult.recommended_script}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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

              {task.is_locked && (
                <div className="surface-card border border-[#E5AA58]/40 bg-[#17171E] rounded-2xl p-4 space-y-2 text-[#E5AA58] shadow-sm mb-4">
                  <div className="flex items-center gap-2 font-heading font-bold text-xs">
                    <Lock className="w-4 h-4 text-[#E5AA58] shrink-0" />
                    <span>Task Is Locked — Upstream Prerequisite Pending</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0] leading-relaxed">
                    {task.locked_reason ||
                      "Upstream tasks for this deliverable must be completed and approved before work can be submitted for this stage."}
                  </p>
                </div>
              )}

              <form onSubmit={handleWorkSubmit} className="space-y-3.5">
                {submissionMode === "script" ? (
                  /* Writer Script Submission Form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
                      <span className="text-[11px] font-mono text-[#A3A0B0]">
                        Scriptwriter Review Submission Draft
                      </span>
                      <button
                        type="button"
                        onClick={handleSyncFromTeleprompter}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#20202A] hover:bg-[#2c2c3b] text-[#A78BFA] border border-white/[0.08] text-[11px] font-semibold transition-all cursor-pointer"
                        title="Pull latest dialogue from the Teleprompter Studio above"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Sync from Teleprompter Scenes</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                        Script Draft Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Q4 Growth Sprint Hook & Scene Script"
                        value={scriptTitle}
                        disabled={task.is_locked}
                        onChange={(e) => setScriptTitle(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-[#A3A0B0]">
                          Hook / Opening Line (First 3 Seconds)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDrawerOpen(true);
                            handleRunAIAssist("Generate 3 punchy, scroll-stopping hook variations for this deliverable format.");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] hover:text-[#b69bff] transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>AI Hook Generator</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Stop scrolling if you want to scale your results this month!"
                        value={hook}
                        disabled={task.is_locked}
                        onChange={(e) => setHook(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-[#A3A0B0]">
                          Scene Breakdown, Dialogue & Visual Directions
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDrawerOpen(true);
                            handleRunAIAssist("Expand full scene-by-scene script dialogue and visual directions based on storyboard specs.");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] hover:text-[#b69bff] transition-colors cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Expand Dialogue with AI</span>
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        placeholder={`Scene 1 (0-3s): Dynamic hook visual introducing core challenge...\nScene 2 (3-8s): Product / service feature demonstration...\nScene 3 (8-15s): Customer proof & key call to action...`}
                        value={scriptBody}
                        disabled={task.is_locked}
                        onChange={(e) => setScriptBody(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-mono transition-all leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                        required={!task.is_locked}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                        Suggested Caption & Hashtags
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Caption copy to accompany the post..."
                        value={caption}
                        disabled={task.is_locked}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ) : (
                  /* Video Editor / Designer File Upload Form */
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                        Upload Media Asset (.mp4, .mov, .png, .jpg)
                      </label>
                      <div
                        className={`border border-dashed border-white/[0.12] rounded-2xl p-6 text-center transition-colors bg-[#101014] group ${
                          task.is_locked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:border-[#A78BFA] cursor-pointer"
                        }`}
                      >
                        <input
                          type="file"
                          id="task-file-upload"
                          disabled={task.is_locked}
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="hidden"
                          accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg"
                        />
                        <label
                          htmlFor={task.is_locked ? undefined : "task-file-upload"}
                          className={`space-y-2 block ${task.is_locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <UploadCloud
                            className={`w-8 h-8 mx-auto transition-transform ${
                              task.is_locked ? "text-[#71717A]" : "text-[#A78BFA] group-hover:scale-105"
                            }`}
                          />
                          <span className="text-xs font-semibold text-[#F2F0F7] block">
                            {task.is_locked
                              ? "Upload Disabled — Task is Locked"
                              : selectedFile
                              ? selectedFile.name
                              : "Click to select or drag and drop render file"}
                          </span>
                          <span className="text-[10px] text-[#71717A] block font-mono">
                            {task.is_locked
                              ? "Complete upstream deliverables to unlock this stage"
                              : selectedFile
                              ? `${Math.round(selectedFile.size / (1024 * 1024))} MB`
                              : "Supports MP4, MOV, WebM, PNG up to 100MB"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                        Production Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Exported 1080x1920 60fps render with color-graded footage"
                        value={notes}
                        disabled={task.is_locked}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || task.is_locked || (submissionMode === "media" && !selectedFile)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all ${
                    task.is_locked
                      ? "bg-white/[0.05] text-[#71717A] border border-white/[0.08] cursor-not-allowed opacity-60"
                      : "bg-[#A78BFA] hover:bg-[#B69BFF] disabled:opacity-40 text-[#101014] cursor-pointer"
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading & Submitting...</span>
                    </>
                  ) : task.is_locked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#E5AA58]" />
                      <span className="text-[#E5AA58]">Task Locked — Upstream Incomplete</span>
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

          {/* ── Right Column (Sticky Contextual Inspector, 4 cols) ── */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
            {/* Task Controls & Metadata Inspector */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-xs font-semibold text-[#F2F0F7] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Task Inspector</span>
                </span>
                {updatingMetadata && (
                  <RefreshCw className="w-3.5 h-3.5 text-[#A78BFA] animate-spin" />
                )}
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Status Switcher */}
                <div>
                  <label className="text-[11px] font-mono text-[#A3A0B0] uppercase block mb-1.5">
                    Lifecycle Status
                  </label>
                  <select
                    value={task.status}
                    disabled={updatingMetadata || task.is_locked}
                    onChange={(e) => handleUpdateStatus(e.target.value as TaskDetail["status"])}
                    className={`w-full bg-[#101014] text-xs font-medium text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-colors ${
                      task.is_locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <option value="backlog">Backlog / Queued</option>
                    <option value="todo">To Do / Scripting</option>
                    <option value="in_progress">In Production / Editing</option>
                    <option value="internal_review">Internal Review</option>
                    <option value="client_review">Client Review</option>
                    <option value="changes_requested">Changes Requested</option>
                    <option value="approved">Approved</option>
                    <option value="done">Done / Published</option>
                  </select>
                  {task.is_locked && (
                    <p className="text-[10px] text-[#E5AA58] mt-1.5 flex items-center gap-1 font-mono">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>Locked until upstream tasks are approved</span>
                    </p>
                  )}
                </div>

                {/* Priority Switcher */}
                <div>
                  <label className="text-[11px] font-mono text-[#A3A0B0] uppercase block mb-1.5">
                    Priority Tier
                  </label>
                  <select
                    value={task.priority}
                    disabled={updatingMetadata}
                    onChange={(e) => handleUpdatePriority(e.target.value as TaskDetail["priority"])}
                    className="w-full bg-[#101014] text-xs font-medium text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">🚨 Urgent Priority</option>
                  </select>
                </div>

                {/* Assignee Selector */}
                <div>
                  <label className="text-[11px] font-mono text-[#A3A0B0] uppercase block mb-1.5">
                    Assigned Specialist
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#20202A] text-[#A78BFA] text-[10px] font-mono font-bold flex items-center justify-center border border-white/[0.08] shrink-0">
                      {getMonogram(task.assignee_name, task.assignee_id)}
                    </span>
                    {isManagerOrOwner ? (
                      <select
                        value={task.assignee_id || ""}
                        disabled={updatingMetadata}
                        onChange={(e) => handleReassign(e.target.value || null)}
                        className="w-full bg-[#101014] text-xs font-medium text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium text-[#F2F0F7] bg-[#101014] px-3 py-2 rounded-xl border border-white/[0.08] flex-1 truncate">
                        {task.assignee_name || "Unassigned"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Deadline & SLA */}
                <div>
                  <label className="text-[11px] font-mono text-[#A3A0B0] uppercase block mb-1.5">
                    Delivery Deadline
                  </label>
                  <div className="bg-[#101014] p-3 rounded-xl border border-white/[0.08] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#A3A0B0]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-mono text-[#F2F0F7]">
                        {task.due_date || "No date set"}
                      </span>
                    </div>
                    {sla && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          sla.tone === "critical"
                            ? "bg-[#E16F7B]/10 text-[#E16F7B] border border-[#E16F7B]/30"
                            : "bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30"
                        }`}
                      >
                        {sla.text}
                      </span>
                    )}
                  </div>
                </div>

                {isManagerOrOwner && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full py-2 rounded-xl border border-[#E16F7B]/30 hover:border-[#E16F7B] bg-[#E16F7B]/10 hover:bg-[#E16F7B]/20 text-[#E16F7B] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Task</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Deliverable Association Card */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <span className="text-[11px] font-mono uppercase text-[#A3A0B0] font-medium flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-[#A78BFA]" />
                  <span>Deliverable Output</span>
                </span>
                <span className="text-[10px] font-mono text-[#71717A] uppercase">
                  {task.platform}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#F2F0F7] leading-snug">
                  {task.deliverable_title}
                </h4>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#101014] px-2 py-0.5 rounded border border-white/[0.06]">
                    {task.deliverable_type}
                  </span>
                  {task.deliverable_id && (
                    <Link
                      href={`/deliverables/${task.deliverable_id}?task_id=${task.id}&from=tasks`}
                      className="text-xs font-semibold text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Media Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Client Account Card */}
            {task.client_name && (
              <div className="surface-card rounded-2xl border border-white/[0.08] p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <span className="text-[11px] font-mono uppercase text-[#A3A0B0] font-medium flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-[#A78BFA]" />
                    <span>Client Account</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#20202A] text-[#A78BFA] font-mono font-bold text-xs flex items-center justify-center border border-white/[0.08]">
                      {getMonogram(task.client_name)}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#F2F0F7] leading-snug">
                        {task.client_name}
                      </h4>
                      <span className="text-[10px] font-mono text-[#71717A]">Active Client</span>
                    </div>
                  </div>

                  {task.client_id && (
                    <Link
                      href={`/clients/${task.client_id}`}
                      className="text-xs font-semibold text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Raycast Manager Review Decision Modal ── */}
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card border border-white/[0.1] rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                  className="p-1 rounded-md text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer transition-colors"
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
                  {reviewDecision === "approved"
                    ? "Approval Notes (Optional)"
                    : "Detailed Revision Instructions (Required)"}
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
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all leading-relaxed"
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
                  disabled={
                    reviewing || (reviewDecision === "changes_requested" && !feedbackNotes.trim())
                  }
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                    reviewDecision === "approved"
                      ? "bg-[#45B88A] hover:bg-[#52c595] text-[#101014]"
                      : "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                  }`}
                >
                  {reviewing
                    ? "Processing Decision..."
                    : reviewDecision === "approved"
                    ? "Confirm Approval"
                    : "Send Revision Request"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card bg-[#14141A] border border-white/[0.12] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3 text-[#E16F7B]">
                <div className="w-10 h-10 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-[#E16F7B]" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">Delete Task</h3>
                  <p className="text-xs text-[#A3A0B0]">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-[#F2F0F7] leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-[#F2F0F7]">"{task?.title}"</strong>? Any associated submissions and review comments will also be removed.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#2a2a38] text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteTask}
                  className="px-4 py-2 rounded-xl bg-[#E16F7B] hover:bg-[#F27885] text-xs font-bold text-[#101014] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FULLSCREEN TELEPROMPTER PRESENTER MODAL ── */}
        {teleprompterModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#09090D] flex flex-col justify-between p-6 sm:p-10 select-none">
            {/* Prompter Controls Header */}
            <div className="flex items-center justify-between border-b border-white/[0.1] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <div>
                  <h2 className="text-base font-heading font-bold text-[#F2F0F7]">
                    Presenter Teleprompter Studio
                  </h2>
                  <p className="text-xs font-mono text-[#A3A0B0]">
                    {liveTotalWords} words • ~{liveSpeakingSec}s estimated duration • Target: {targetDuration}s
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Speed Controls */}
                <div className="flex items-center gap-2 bg-[#17171E] px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-mono">
                  <span className="text-[#A3A0B0]">Scroll Speed:</span>
                  {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setTeleprompterSpeed(spd)}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        teleprompterSpeed === spd
                          ? "bg-[#A78BFA] text-[#101014] font-bold"
                          : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Play / Pause Toggle */}
                <button
                  onClick={() => setTeleprompterPlaying(!teleprompterPlaying)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                    teleprompterPlaying
                      ? "bg-[#E5AA58] hover:bg-[#d89b47] text-[#101014]"
                      : "bg-[#45B88A] hover:bg-[#3ca379] text-[#101014]"
                  }`}
                >
                  {teleprompterPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Auto-Scroll</span>
                    </>
                  )}
                </button>

                {/* Reset Scroll */}
                <button
                  onClick={() => {
                    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
                    setTeleprompterPlaying(false);
                  }}
                  className="p-2 rounded-xl bg-[#17171E] hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08] transition-colors cursor-pointer"
                  title="Reset to Top"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    setTeleprompterPlaying(false);
                    setTeleprompterModalOpen(false);
                  }}
                  className="p-2 rounded-xl bg-[#17171E] hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08] transition-colors cursor-pointer"
                  title="Close Teleprompter"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrolling Text Window */}
            <div
              ref={teleprompterRef}
              className="flex-1 overflow-y-auto my-6 px-4 sm:px-16 scroll-smooth space-y-12 max-w-4xl mx-auto w-full"
            >
              {scriptBlocks.map((block, idx) => (
                <div key={block.id} className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#A78BFA] uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-md bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{block.title}</span>
                    {block.visual_cue && (
                      <span className="text-[#69A9D8] font-normal normal-case">
                        — [🎬 {block.visual_cue}]
                      </span>
                    )}
                  </div>
                  <p className="text-3xl sm:text-4xl font-heading font-medium text-[#F2F0F7] leading-relaxed tracking-normal select-text">
                    {block.spoken_words || "(No dialogue written for this scene)"}
                  </p>
                </div>
              ))}
            </div>

            {/* Prompter Footer Guide */}
            <div className="border-t border-white/[0.1] pt-3 flex items-center justify-between text-xs font-mono text-[#71717A]">
              <span>💡 Pro Tip: Read at a steady, conversational pace (~140 WPM). Stand 3–5 feet back from camera.</span>
              <span>ESC closes presenter mode</span>
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
        <div className="p-8 text-center text-xs font-mono text-[#71717A]">
          Loading task workspace...
        </div>
      }
    >
      <TaskWorkspaceContent />
    </Suspense>
  );
}
