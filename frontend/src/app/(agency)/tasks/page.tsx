"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useAgencyWebSocket } from "@/lib/websocket-context";
import { taskApi, clientApi, agencyApi, deliverableApi } from "@/lib/api";
import {
  Kanban,
  List,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Film,
  PenTool,
  Scissors,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Briefcase,
  User,
  Calendar,
  X,
  Layers,
  ChevronDown,
  Building2,
  Check,
  Lock,
  Plus,
  Trash2,
  Palette,
  GripVertical,
} from "lucide-react";

interface AgencyMember {
  user_id: string;
  role: string;
  user_full_name?: string | null;
  user_email?: string | null;
}

interface Task {
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
  is_locked?: boolean;
  locked_reason?: string | null;
  created_at: string;
  updated_at?: string;
  client_id?: string;
  client_name?: string;
  campaign_id?: string;
  campaign_title?: string;
  deliverable_title?: string;
  deliverable_type?: string;
}

interface Client {
  id: string;
  business_name: string;
}

interface DeliverableOption {
  id: string;
  title: string;
  deliverable_type?: string;
  platform?: string;
  campaign_id?: string;
}

const KANBAN_COLUMNS = [
  {
    id: "backlog",
    title: "Backlog / Queued",
    color: "bg-[#17171E] text-[#A3A0B0] border-[#30303D]",
    dot: "bg-[#71717A]",
    statuses: ["backlog"],
  },
  {
    id: "todo",
    title: "To Do / Scripting",
    color: "bg-[#17171E] text-[#A78BFA] border-[#A78BFA]/30",
    dot: "bg-[#A78BFA]",
    statuses: ["todo"],
  },
  {
    id: "in_progress",
    title: "In Production / Editing",
    color: "bg-[#17171E] text-[#E5AA58] border-[#E5AA58]/30",
    dot: "bg-[#E5AA58]",
    statuses: ["in_progress"],
  },
  {
    id: "review",
    title: "Review & Approvals",
    color: "bg-[#17171E] text-[#69A9D8] border-[#69A9D8]/30",
    dot: "bg-[#69A9D8]",
    statuses: ["internal_review", "client_review", "changes_requested"],
  },
  {
    id: "done",
    title: "Done / Approved",
    color: "bg-[#17171E] text-[#45B88A] border-[#45B88A]/30",
    dot: "bg-[#45B88A]",
    statuses: ["approved", "done"],
  },
];

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

function TasksContent() {
  const { user, token, activeAgencyId, agencies, currentRole, isSpecialist } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Deliverables & Manual Task Creation State
  const [deliverables, setDeliverables] = useState<DeliverableOption[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDeliverableId, setNewDeliverableId] = useState("");
  const [newTaskType, setNewTaskType] = useState("scripting");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newStatus, setNewStatus] = useState<"todo" | "backlog" | "in_progress">("todo");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Delete Task Confirmation State
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingTaskTitle, setDeletingTaskTitle] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Set default assignee filter to current user for specialists
  useEffect(() => {
    if (isSpecialist && user?.id && selectedAssigneeId === "all") {
      setSelectedAssigneeId(user.id);
    }
  }, [isSpecialist, user?.id, selectedAssigneeId]);

  // Keyboard navigation: 'k' for kanban, 'l' for list, '/' for search, ESC to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        return;
      }

      if (!isInput && (e.key === "k" || e.key === "K")) {
        setViewMode("kanban");
      } else if (!isInput && (e.key === "l" || e.key === "L")) {
        setViewMode("list");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load clients, members and tasks
  const loadData = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    setLoading(true);
    try {
      // 1. Fetch clients for filtering
      try {
        const clientList = (await clientApi.list(effectiveAgencyId, token)) as Client[];
        setClients(clientList || []);
      } catch (e) {
        // ignore
      }

      // 2. Fetch agency members for assigning
      try {
        const memberList = (await agencyApi.listMembers(effectiveAgencyId, token)) as AgencyMember[];
        setMembers(memberList || []);
      } catch (e) {
        console.error("Failed to load agency members", e);
      }

      // 3. Fetch deliverables for modal selection
      try {
        const delivList = (await deliverableApi.list(effectiveAgencyId, token)) as DeliverableOption[];
        setDeliverables(delivList || []);
      } catch (e) {
        // ignore
      }

      // 4. Fetch all agency tasks (up to 200)
      const params: Record<string, string> = { limit: "200" };
      if (selectedClientId !== "all") {
        params.client_id = selectedClientId;
      }
      const data = (await taskApi.list(effectiveAgencyId, token, params)) as Task[];
      setTasks(data || []);
    } catch (err: any) {
      console.error("Failed to load tasks", err);
      setNotification({ type: "error", text: err.message || "Failed to load tasks." });
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, selectedClientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Silent background reload of tasks without unmounting or triggering full-page spinner
  const reloadTasksSilently = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    try {
      const params: Record<string, string> = { limit: "200" };
      if (selectedClientId !== "all") {
        params.client_id = selectedClientId;
      }
      const data = (await taskApi.list(effectiveAgencyId, token, params)) as Task[];
      setTasks(data || []);
    } catch (err) {
      console.error("Silent task reload failed:", err);
    }
  }, [token, effectiveAgencyId, selectedClientId]);

  // Real-Time WebSocket subscription: instant in-memory patch (<16ms) + silent background re-sync
  useAgencyWebSocket(
    "*",
    (envelope) => {
      if (envelope.event === "TASK_UPDATED" && envelope.data?.task_id) {
        const { task_id, status: newStatus, priority, assignee_id, title, deleted } = envelope.data;
        if (deleted) {
          setTasks((prev) => prev.filter((t) => t.id !== task_id));
          return;
        }
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === task_id);
          if (exists) {
            return prev.map((t) =>
              t.id === task_id
                ? {
                    ...t,
                    status: newStatus || t.status,
                    title: title || t.title,
                    priority: priority || t.priority,
                    assignee_id: assignee_id !== undefined ? assignee_id : t.assignee_id,
                  }
                : t
            );
          } else {
            // Newly created task from another client or worker -> silent background reload
            reloadTasksSilently();
            return prev;
          }
        });
      } else if (
        [
          "PIPELINE_STAGE_UNLOCKED",
          "DELIVERABLE_REVIEW_DECISION",
          "DELIVERABLE_STATUS_CHANGED",
        ].includes(envelope.event)
      ) {
        reloadTasksSilently();
      }
    },
    reloadTasksSilently
  );

  // Create manual task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;
    if (!newTitle.trim()) {
      setNotification({ type: "error", text: "Task title is required." });
      return;
    }
    if (!newDeliverableId) {
      setNotification({ type: "error", text: "Please select a deliverable for this task." });
      return;
    }

    setCreatingTask(true);
    try {
      await taskApi.create(
        effectiveAgencyId,
        {
          title: newTitle.trim(),
          deliverable_id: newDeliverableId,
          task_type: newTaskType || null,
          assignee_id: newAssigneeId || null,
          status: newStatus,
          priority: newPriority,
          due_date: newDueDate || null,
          notes: newNotes.trim() || null,
        },
        token
      );

      setNotification({ type: "success", text: `Task "${newTitle}" created successfully!` });
      setShowNewModal(false);
      setNewTitle("");
      setNewDeliverableId("");
      setNewTaskType("scripting");
      setNewAssigneeId("");
      setNewPriority("medium");
      setNewStatus("todo");
      setNewDueDate("");
      setNewNotes("");

      await loadData();
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to create task." });
    } finally {
      setCreatingTask(false);
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!token || !effectiveAgencyId || !deletingTaskId) return;
    setIsDeleting(true);
    try {
      await taskApi.delete(effectiveAgencyId, deletingTaskId, token);
      setTasks((prev) => prev.filter((t) => t.id !== deletingTaskId));
      setNotification({ type: "success", text: `Task "${deletingTaskTitle}" deleted successfully.` });
      setDeletingTaskId(null);
      setDeletingTaskTitle("");
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to delete task." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Update task status
  const handleUpdateStatus = async (taskId: string, newStatus: Task["status"]) => {
    if (!token || !effectiveAgencyId) return;
    setUpdatingTaskId(taskId);
    try {
      await taskApi.update(
        effectiveAgencyId,
        taskId,
        { status: newStatus },
        token
      );

      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
      setNotification({ type: "success", text: `Task status updated to ${newStatus.replace("_", " ")}.` });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update task status." });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Reassign task
  const handleUpdateAssignee = async (taskId: string, newAssigneeId: string | null) => {
    if (!token || !effectiveAgencyId) return;
    setUpdatingTaskId(taskId);
    try {
      await taskApi.update(
        effectiveAgencyId,
        taskId,
        { assignee_id: newAssigneeId },
        token
      );

      const matchedMember = members.find((m) => m.user_id === newAssigneeId);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                assignee_id: newAssigneeId,
                assignee_name: matchedMember?.user_full_name || matchedMember?.user_email?.split("@")[0] || null,
                assignee_role: matchedMember?.role || null,
              }
            : t
        )
      );
      setNotification({
        type: "success",
        text: newAssigneeId ? "Task reassigned successfully." : "Task marked as unassigned.",
      });
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update assignee." });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Kanban Drag and Drop Handler
  const handleCardDrop = async (targetColId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColId(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId || !effectiveAgencyId || !token) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Map column ID to default TaskStatus
    const statusMap: Record<string, Task["status"]> = {
      backlog: "backlog",
      todo: "todo",
      in_progress: "in_progress",
      review: "internal_review",
      done: "done",
    };
    const targetStatus = statusMap[targetColId];
    if (!targetStatus) return;

    // If task is already in this column, do nothing
    const currentTargetCol = KANBAN_COLUMNS.find((c) => c.statuses.includes(task.status));
    if (currentTargetCol?.id === targetColId) return;

    // Lock enforcement: locked tasks cannot be moved to in_progress, review, or done
    if (task.is_locked && !["backlog", "todo"].includes(targetColId)) {
      setNotification({
        type: "error",
        text: `Cannot move locked task "${task.title}": ${task.locked_reason || "upstream prerequisite tasks are pending"}.`,
      });
      return;
    }

    // Role enforcement: specialists cannot approve or close tasks into done
    if (isSpecialist && ["done"].includes(targetColId)) {
      setNotification({
        type: "error",
        text: "Specialists cannot approve tasks directly. A manager review is required.",
      });
      return;
    }

    // Role enforcement: specialists can only drag tasks assigned to them
    if (isSpecialist && task.assignee_id && task.assignee_id !== user?.id) {
      setNotification({
        type: "error",
        text: "You can only update tasks assigned to you.",
      });
      return;
    }

    // Optimistic UI update
    const previousStatus = task.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );
    setUpdatingTaskId(taskId);

    try {
      await taskApi.update(effectiveAgencyId, taskId, { status: targetStatus }, token);
      setNotification({
        type: "success",
        text: `Task "${task.title}" moved to ${targetColId.replace("_", " ")}.`,
      });
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      console.error("Failed to update task status via drop:", err);
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
      );
      setNotification({
        type: "error",
        text: err?.message || "Failed to update task status.",
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    // Stage filter
    if (selectedStage !== "all") {
      if ((t.task_type || "").toLowerCase() !== selectedStage.toLowerCase()) {
        return false;
      }
    }
    // Priority filter
    if (selectedPriority !== "all") {
      if (t.priority !== selectedPriority) {
        return false;
      }
    }
    // Assignee filter
    if (selectedAssigneeId !== "all") {
      if (selectedAssigneeId === "unassigned") {
        if (t.assignee_id) return false;
      } else {
        if (t.assignee_id !== selectedAssigneeId) return false;
      }
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchType = (t.task_type || "").toLowerCase().includes(q);
      const matchClient = (t.client_name || "").toLowerCase().includes(q);
      const matchDeliverable = (t.deliverable_title || "").toLowerCase().includes(q);
      if (!matchTitle && !matchType && !matchClient && !matchDeliverable) return false;
    }
    return true;
  });

  const getStageBadge = (type: string | null) => {
    switch ((type || "").toLowerCase()) {
      case "scripting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
            <PenTool className="w-2.5 h-2.5 text-[#A78BFA]" />
            <span>Scripting</span>
          </span>
        );
      case "copywriting":
      case "copy":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F472B6]/10 text-[#F472B6] border border-[#F472B6]/20">
            <PenTool className="w-2.5 h-2.5 text-[#F472B6]" />
            <span>Copywriting</span>
          </span>
        );
      case "filming":
      case "shooting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20">
            <Film className="w-2.5 h-2.5 text-[#69A9D8]" />
            <span>Shooting</span>
          </span>
        );
      case "design":
      case "graphic":
      case "graphics":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20">
            <Palette className="w-2.5 h-2.5 text-[#22D3EE]" />
            <span>Design</span>
          </span>
        );
      case "editing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/20">
            <Scissors className="w-2.5 h-2.5 text-[#E5AA58]" />
            <span>Editing</span>
          </span>
        );
      case "qa":
      case "quality":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#C084FC]/10 text-[#C084FC] border border-[#C084FC]/20">
            <ShieldCheck className="w-2.5 h-2.5 text-[#C084FC]" />
            <span>QA</span>
          </span>
        );
      case "approval":
      case "review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/20">
            <ShieldCheck className="w-2.5 h-2.5 text-[#45B88A]" />
            <span>Review</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]">
            <Layers className="w-2.5 h-2.5 text-[#71717A]" />
            <span>{type || "General"}</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (p: Task["priority"]) => {
    switch (p) {
      case "urgent":
        return (
          <span className="text-[10px] font-mono font-bold text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E16F7B] animate-pulse" />
            <span>URGENT</span>
          </span>
        );
      case "high":
        return (
          <span className="text-[10px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5AA58]" />
            <span>HIGH</span>
          </span>
        );
      case "medium":
        return (
          <span className="text-[10px] font-mono font-medium text-[#A3A0B0] bg-[#20202A] border border-white/[0.08] px-1.5 py-0.5 rounded">
            MED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-medium text-[#71717A] bg-[#17171E] border border-white/[0.06] px-1.5 py-0.5 rounded">
            LOW
          </span>
        );
    }
  };

  // Stats calculation
  const totalCount = tasks.length;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const reviewCount = tasks.filter((t) => ["internal_review", "client_review", "changes_requested"].includes(t.status)).length;
  const doneCount = tasks.filter((t) => ["approved", "done"].includes(t.status)).length;
  const remainingCount = tasks.filter((t) => !["approved", "done"].includes(t.status)).length;

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Linear Editorial Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Production Tasks</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-[#191919] dark:text-white" />
            <span>Production Tasks & Pipeline</span>
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Actionable breakdown of all monthly deliverables across Scripting, Footage Prep, Video Editing, and Client Approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 bg-[#17171E] hover:bg-[#20202A] text-[#F2F0F7] text-xs font-medium px-3.5 py-2 rounded-xl border border-white/[0.08] transition-colors shadow-xs"
          >
            <Briefcase className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>My Workbench</span>
          </Link>
          {!isSpecialist && (
            <>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-[#2a2a38] text-[#F2F0F7] text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/[0.08] transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>New Task</span>
              </button>
              <Link
                href="/campaigns"
                className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
                <span>Generate Sprint</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Specialist Execution Mode Banner (Contextual) ── */}
      {isSpecialist && (
        <div className="surface-card border border-[#A78BFA]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] text-base shrink-0 font-mono">
              {currentRole === "writer" ? "⚡" : currentRole === "editor" ? "🎬" : "🎨"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-heading font-semibold text-[#F2F0F7] tracking-tight">
                  Specialist Execution Mode
                </h2>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
                  {currentRole === "writer" ? "Scriptwriter" : currentRole === "editor" ? "Video Editor" : currentRole === "designer" ? "Designer" : currentRole}
                </span>
              </div>
              <p className="text-[11px] text-[#A3A0B0] mt-0.5">
                Viewing assigned deliverables. Review scripts, audio cues, and submit versions for manager sign-off.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#101014] p-1 rounded-xl border border-white/[0.08] shrink-0 self-stretch sm:self-auto">
            <button
              onClick={() => setSelectedAssigneeId(user?.id || "all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedAssigneeId === user?.id
                  ? "bg-[#A78BFA] text-[#101014] font-semibold shadow-xs"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <span>⚡ My Assigned Tasks</span>
              {user && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#101014]/60 font-mono font-bold">
                  {tasks.filter((t) => t.assignee_id === user.id).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSelectedAssigneeId("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedAssigneeId === "all"
                  ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.08] shadow-xs"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <span>👥 All Team Tasks</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#101014] text-[#A3A0B0] font-mono font-bold">
                {tasks.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── 5-Segment Linear Telemetry Strip ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-4 shadow-sm grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.08] dark:divide-white/[0.06]">
        {/* Metric 1 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 first:px-0">
          <div className="flex items-center justify-between text-[#6B6A65] dark:text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Remaining</span>
            <span className="text-[10px] font-mono text-[#9B9A97] dark:text-[#A3A0B0]/60">{totalCount} total</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#191919] dark:text-[#F2F0F7]">{remainingCount}</span>
            <span className="text-[10px] text-[#6B6A65] dark:text-[#A3A0B0] font-mono">in progress</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-[#2383E2] dark:text-[#A78BFA] text-[11px] font-medium uppercase tracking-wider">
            <span>Ready to Script</span>
            <PenTool className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#2383E2] dark:text-[#A78BFA]">{todoCount}</span>
            <span className="text-[10px] text-[#6B6A65] dark:text-[#A3A0B0] font-mono">stage: todo</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-[#E5AA58] text-[11px] font-medium uppercase tracking-wider">
            <span>In Production</span>
            <Scissors className="w-3.5 h-3.5 text-[#E5AA58]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#E5AA58]">{inProgressCount}</span>
            <span className="text-[10px] text-[#A3A0B0] font-mono">cutting/editing</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-[#69A9D8] text-[11px] font-medium uppercase tracking-wider">
            <span>In Review</span>
            <Clock className="w-3.5 h-3.5 text-[#69A9D8]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#69A9D8]">{reviewCount}</span>
            <span className="text-[10px] text-[#A3A0B0] font-mono">manager queue</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-[#45B88A] text-[11px] font-medium uppercase tracking-wider">
            <span>Done & Approved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#45B88A]">{doneCount}</span>
            <span className="text-[10px] text-[#45B88A] font-mono font-medium">ready to deliver</span>
          </div>
        </div>
      </div>

      {/* ── Linear Filter Toolstrip ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input with Keyboard Shortcut Badge */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#6B6A65] dark:text-[#A3A0B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter tasks... (Press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F7F6F3] dark:bg-[#101014] text-xs text-[#191919] dark:text-[#F2F0F7] placeholder:text-[#6B6A65] dark:placeholder:text-[#A3A0B0]/50 pl-8.5 pr-8 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-[#2383E2] dark:focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#2383E2]/20 dark:focus:ring-[#A78BFA]/20 transition-all font-sans"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F2F0F7] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08] pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Stage Filter Pills */}
          <div className="flex items-center gap-1 bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs font-medium overflow-x-auto">
            {[
              { id: "all", label: "All" },
              { id: "scripting", label: "Scripting" },
              { id: "copywriting", label: "Copywriting" },
              { id: "filming", label: "Shooting" },
              { id: "design", label: "Design" },
              { id: "editing", label: "Editing" },
              { id: "qa", label: "QA" },
              { id: "approval", label: "Review" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStage(st.id)}
                className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                  selectedStage === st.id
                    ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#101014] text-xs font-medium text-[#F2F0F7] px-2.5 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Client Filter */}
          {clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-[#101014] text-xs font-medium text-[#F2F0F7] px-2.5 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
            >
              <option value="all">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          )}

          {/* Assignee Filter */}
          {members.length > 0 && (
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="bg-[#101014] text-xs font-medium text-[#F2F0F7] px-2.5 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
            >
              <option value="all">All Assignees ({members.length})</option>
              <option value="unassigned">Unassigned Only</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === user?.id
                    ? `⚡ ${m.user_full_name || m.user_email?.split("@")[0]} (Me)`
                    : `${m.user_full_name || m.user_email?.split("@")[0]} (${m.role})`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View Switcher: Kanban (K) vs List (L) */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-[#71717A] mr-1 hidden sm:inline">
            {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center bg-[#101014] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setViewMode("kanban")}
              title="Kanban view (Press K)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white/[0.08] text-[#F2F0F7] shadow-xs font-semibold"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
              <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">K</kbd>
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List table view (Press L)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white/[0.08] text-[#F2F0F7] shadow-xs font-semibold"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List Table</span>
              <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">L</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#A3A0B0]">
          <RefreshCw className="w-5 h-5 text-[#A78BFA] animate-spin mx-auto mb-2" />
          <span>Syncing production pipeline...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#20202A] text-[#A78BFA] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
            <Kanban className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-heading font-semibold text-[#F2F0F7] mb-1">No tasks in pipeline</h3>
          <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mb-5">
            Tasks are automatically generated when you approve a 30-day AI campaign sprint.
          </p>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
            <span>Open Campaign Planner &rarr;</span>
          </Link>
        </div>
      ) : viewMode === "kanban" ? (
        /* ── KANBAN BOARD VIEW (Linear / Raycast Precision Standard) ── */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => col.statuses.includes(t.status));
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverColId !== col.id) setDragOverColId(col.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverColId === col.id) setDragOverColId(null);
                }}
                onDrop={(e) => handleCardDrop(col.id, e)}
                className={`bg-[#121217] rounded-xl p-3 border min-h-[520px] flex flex-col shadow-xs transition-all ${
                  dragOverColId === col.id
                    ? "border-[#A78BFA] bg-[#161622] ring-1 ring-[#A78BFA]/30"
                    : "border-white/[0.06]"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3 className="text-xs font-semibold text-[#F2F0F7] tracking-tight">{col.title}</h3>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-[#37352F] dark:text-[#A3A0B0] bg-[#EFEFED] dark:bg-[#1a1a22] px-1.5 py-0.5 rounded border border-black/[0.08] dark:border-white/[0.06]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-12 text-[11px] text-[#71717A] italic font-mono">
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map((t) => {
                      const sla = getSlaStatus(t.due_date);
                      const isChangesReq = t.status === "changes_requested";
                      const isReview = t.status === "internal_review";

                      return (
                        <div
                          key={t.id}
                          draggable={!t.is_locked}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedTaskId(t.id);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColId(null);
                          }}
                          className={`surface-card rounded-xl border p-3 transition-all space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] group relative select-none ${
                            draggedTaskId === t.id
                              ? "opacity-30 border-dashed border-[#A78BFA]"
                              : "border-white/[0.08] hover:border-white/[0.18]"
                          } ${t.is_locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                        >
                          {/* Top Badges Row */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {!t.is_locked && (
                                <GripVertical className="w-3 h-3 text-[#71717A] opacity-0 group-hover:opacity-60 transition-opacity shrink-0 pointer-events-none" />
                              )}
                              {getStageBadge(t.task_type)}
                              {t.is_locked && (
                                <span
                                  title={t.locked_reason || "Upstream tasks pending"}
                                  className="text-[9px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-1.5 py-0.2 rounded uppercase flex items-center gap-1 shrink-0"
                                >
                                  <Lock className="w-2.5 h-2.5 text-[#E5AA58]" />
                                  <span>Locked</span>
                                </span>
                              )}
                              {isChangesReq && (
                                <span className="text-[9px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-1.5 py-0.2 rounded uppercase">
                                  Revision Needed
                                </span>
                              )}
                              {isReview && (
                                <span className="text-[9px] font-mono font-bold text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-1.5 py-0.2 rounded uppercase">
                                  In Review
                                </span>
                              )}
                            </div>
                            {getPriorityBadge(t.priority)}
                          </div>

                          {/* Client Tag */}
                          {t.client_name && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-[#A3A0B0] truncate">
                              <Building2 className="w-2.5 h-2.5 text-[#71717A] shrink-0" />
                              <span className="truncate">{t.client_name}</span>
                            </div>
                          )}

                          {/* Task Title */}
                          <Link
                            href={`/tasks/${t.id}`}
                            className="text-xs font-heading font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors leading-snug line-clamp-2 block"
                          >
                            {t.title}
                          </Link>

                          {/* SLA / Due Date & Quick Links */}
                          <div className="flex items-center justify-between text-[10px] text-[#A3A0B0] pt-0.5">
                            {sla ? (
                              <span
                                className={`font-mono text-[10px] flex items-center gap-1 ${
                                  sla.tone === "critical"
                                    ? "text-[#E16F7B] font-bold"
                                    : sla.tone === "urgent" || sla.tone === "warning"
                                    ? "text-[#E5AA58] font-medium"
                                    : "text-[#A3A0B0]"
                                }`}
                              >
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{sla.text}</span>
                              </span>
                            ) : (
                              <span className="text-[#71717A] font-mono text-[9px]">No deadline</span>
                            )}

                            <div className="flex items-center gap-2">
                              {t.deliverable_id && (
                                <Link
                                  href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                                  className="text-[#71717A] hover:text-[#F2F0F7] flex items-center gap-0.5 transition-colors"
                                  title="View connected deliverable media"
                                >
                                  <Film className="w-2.5 h-2.5" />
                                  <span>Media</span>
                                </Link>
                              )}
                              <Link
                                href={`/tasks/${t.id}`}
                                className="inline-flex items-center gap-0.5 font-medium text-[#A78BFA] hover:text-[#B69BFF] transition-colors"
                              >
                                <span>Workbench</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                              {!isSpecialist && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeletingTaskId(t.id);
                                    setDeletingTaskTitle(t.title);
                                  }}
                                  title="Delete task"
                                  className="text-[#71717A] hover:text-[#E16F7B] p-0.5 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Assignee & Status Transition Selectors */}
                          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                            {/* Assignee Row */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-[#A3A0B0] flex items-center gap-1 shrink-0">
                                <span className="w-4 h-4 rounded-full bg-[#20202A] text-[#A78BFA] text-[8px] font-mono font-bold flex items-center justify-center border border-white/[0.08]">
                                  {getMonogram(t.assignee_name, t.assignee_id)}
                                </span>
                                <span className="text-[#71717A]">Assign:</span>
                              </span>
                              <select
                                value={t.assignee_id || ""}
                                disabled={updatingTaskId === t.id}
                                onChange={(e) => handleUpdateAssignee(t.id, e.target.value || null)}
                                className="text-[10px] font-medium bg-[#101014] text-[#F2F0F7] px-1.5 py-0.5 rounded border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[125px] truncate cursor-pointer transition-colors"
                              >
                                <option value="">Unassigned</option>
                                {members.map((m) => (
                                  <option key={m.user_id} value={m.user_id}>
                                    {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Move Stage Row */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-[#71717A]">Move:</span>
                              <select
                                value={t.status}
                                disabled={updatingTaskId === t.id || t.is_locked}
                                onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                                className={`text-[10px] font-medium bg-[#101014] text-[#F2F0F7] px-1.5 py-0.5 rounded border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[125px] transition-colors ${
                                  t.is_locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                }`}
                              >
                                <option value="backlog">Backlog</option>
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="internal_review">Internal Review</option>
                                <option value="client_review">Client Review</option>
                                <option value="approved">Approved</option>
                                <option value="done">Done</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST TABLE VIEW (Linear Density 38-40px rows) ── */
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121217] text-[#A3A0B0] font-mono text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Task & Deliverable</th>
                <th className="py-2.5 px-4 font-medium">Stage</th>
                <th className="py-2.5 px-4 font-medium">Priority</th>
                <th className="py-2.5 px-4 font-medium">Assignee</th>
                <th className="py-2.5 px-4 font-medium">SLA / Deadline</th>
                <th className="py-2.5 px-4 font-medium">Status LED</th>
                <th className="py-2.5 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-[#F2F0F7]">
              {filteredTasks.map((t) => {
                const sla = getSlaStatus(t.due_date);
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {t.client_name && (
                          <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#1a1a22] px-1.5 py-0.5 rounded border border-white/[0.06] shrink-0">
                            {t.client_name}
                          </span>
                        )}
                        {t.is_locked && (
                          <span
                            title={t.locked_reason || "Upstream tasks pending"}
                            className="text-[9px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-1.5 py-0.2 rounded uppercase inline-flex items-center gap-1 shrink-0"
                          >
                            <Lock className="w-2.5 h-2.5 text-[#E5AA58]" />
                            <span>Locked</span>
                          </span>
                        )}
                        <Link
                          href={`/tasks/${t.id}`}
                          className="font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors leading-snug line-clamp-1"
                        >
                          {t.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#71717A]">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-0.5 font-medium transition-colors"
                        >
                          Workbench &rarr;
                        </Link>
                        {t.deliverable_id && (
                          <Link
                            href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                            className="hover:text-[#F2F0F7] inline-flex items-center gap-1 transition-colors"
                          >
                            <Film className="w-2.5 h-2.5" /> Media
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">{getStageBadge(t.task_type)}</td>
                    <td className="py-2.5 px-4">{getPriorityBadge(t.priority)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#20202A] text-[#A78BFA] text-[9px] font-mono font-bold flex items-center justify-center border border-white/[0.08] shrink-0">
                          {getMonogram(t.assignee_name, t.assignee_id)}
                        </span>
                        <select
                          value={t.assignee_id || ""}
                          disabled={updatingTaskId === t.id}
                          onChange={(e) => handleUpdateAssignee(t.id, e.target.value || null)}
                          className="text-[11px] font-medium bg-[#101014] text-[#F2F0F7] px-2 py-1 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[140px] truncate cursor-pointer transition-colors"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {sla ? (
                        <span
                          className={`font-mono text-xs flex items-center gap-1 ${
                            sla.tone === "critical"
                              ? "text-[#E16F7B] font-bold"
                              : sla.tone === "urgent" || sla.tone === "warning"
                              ? "text-[#E5AA58] font-medium"
                              : "text-[#A3A0B0]"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{sla.text}</span>
                        </span>
                      ) : (
                        <span className="text-[#71717A] font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            ["approved", "done"].includes(t.status)
                              ? "bg-[#45B88A]"
                              : ["internal_review", "client_review"].includes(t.status)
                              ? "bg-[#69A9D8]"
                              : t.status === "changes_requested"
                              ? "bg-[#E5AA58]"
                              : t.status === "in_progress"
                              ? "bg-[#E5AA58]"
                              : "bg-[#71717A]"
                          }`}
                        />
                        <span className="capitalize text-xs font-medium text-[#F2F0F7] whitespace-nowrap">
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <select
                          value={t.status}
                          disabled={updatingTaskId === t.id || t.is_locked}
                          onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                          className={`text-[11px] font-medium bg-[#101014] text-[#F2F0F7] px-2 py-1 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-colors ${
                            t.is_locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <option value="backlog">Backlog</option>
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="internal_review">Internal Review</option>
                          <option value="client_review">Client Review</option>
                          <option value="approved">Approved</option>
                          <option value="done">Done</option>
                        </select>
                        {!isSpecialist && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingTaskId(t.id);
                              setDeletingTaskTitle(t.title);
                            }}
                            title="Delete task"
                            className="p-1 rounded hover:bg-white/[0.06] text-[#71717A] hover:text-[#E16F7B] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Create New Task Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="surface-card bg-[#14141A] border border-white/[0.12] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">Create New Task</h3>
                  <p className="text-[11px] text-[#A3A0B0]">Manually dispatch an ad-hoc or operational task</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                  Task Title <span className="text-[#E16F7B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dynamic Sound Sync & Beat Cutting"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#F7F6F3] dark:bg-[#101014] text-xs text-[#191919] dark:text-[#F2F0F7] placeholder:text-[#6B6A65] dark:placeholder:text-[#A3A0B0]/50 px-3.5 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-[#2383E2] dark:focus:border-[#A78BFA]/50 font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B6A65] dark:text-[#A3A0B0] mb-1">
                  Deliverable Output <span className="text-[#E16F7B]">*</span>
                </label>
                <select
                  required
                  value={newDeliverableId}
                  onChange={(e) => setNewDeliverableId(e.target.value)}
                  className="w-full bg-[#F7F6F3] dark:bg-[#101014] text-xs text-[#191919] dark:text-[#F2F0F7] px-3.5 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-[#2383E2] dark:focus:border-[#A78BFA]/50 font-medium transition-all cursor-pointer"
                >
                  <option value="">Select Target Deliverable...</option>
                  {deliverables.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.deliverable_type || "asset"} &bull; {d.platform || "general"})
                    </option>
                  ))}
                </select>
                {deliverables.length === 0 && (
                  <p className="text-[10px] text-[#E5AA58] mt-1 font-mono">
                    No deliverables found. Create a campaign plan first to associate tasks.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Stage / Task Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all cursor-pointer"
                  >
                    <option value="scripting">Scripting / Concept</option>
                    <option value="copywriting">Copywriting</option>
                    <option value="filming">Video Filming / Footage</option>
                    <option value="design">Graphic Design</option>
                    <option value="editing">Video Editing / Sound</option>
                    <option value="qa">QA / Format Check</option>
                    <option value="approval">Review & Sign-Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Priority Tier
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">🚨 Urgent Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Assigned Specialist
                  </label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-medium transition-all cursor-pointer"
                  >
                    <option value="todo">To Do (Ready to start)</option>
                    <option value="backlog">Backlog (Queued)</option>
                    <option value="in_progress">In Production</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                  Delivery Deadline
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                  Creative Brief / Production Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Guidelines, references, audio sync directions..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#F7F6F3] dark:bg-[#101014] text-xs text-[#191919] dark:text-[#F2F0F7] placeholder:text-[#6B6A65] dark:placeholder:text-[#A3A0B0]/50 p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-[#2383E2] dark:focus:border-[#A78BFA]/50 font-medium transition-all leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#2a2a38] text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-xs font-bold text-[#101014] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {creatingTask ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Task...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingTaskId && (
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
              Are you sure you want to permanently delete <strong className="text-[#F2F0F7]">"{deletingTaskTitle}"</strong>? Any associated submissions and review comments will also be removed.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingTaskId(null);
                  setDeletingTaskTitle("");
                }}
                className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#2a2a38] text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteTask}
                className="px-4 py-2 rounded-xl bg-[#E16F7B] hover:bg-[#F27885] text-xs font-bold text-[#101014] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
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
    </main>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-[#71717A]">
          Loading task pipeline...
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
