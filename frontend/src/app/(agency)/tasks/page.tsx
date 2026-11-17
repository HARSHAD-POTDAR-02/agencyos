"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { taskApi, clientApi, agencyApi } from "@/lib/api";
import {
  Kanban,
  List,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Film,
  PenTool,
  Scissors,
  ShieldCheck,
  ChevronDown,
  Layers,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Briefcase,
  User,
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
}

interface Client {
  id: string;
  business_name: string;
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

function TasksContent() {
  const { user, token, activeAgencyId, agencies, currentRole, isSpecialist, isOwnerOrManager } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Set default assignee filter to current user for specialists
  useEffect(() => {
    if (isSpecialist && user?.id && selectedAssigneeId === "all") {
      setSelectedAssigneeId(user.id);
    }
  }, [isSpecialist, user?.id, selectedAssigneeId]);

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

      // 3. Fetch all agency tasks (up to 200)
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

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, assignee_id: newAssigneeId } : t))
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

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    // Stage filter
    if (selectedStage !== "all") {
      if ((t.task_type || "").toLowerCase() !== selectedStage.toLowerCase()) {
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
      if (!matchTitle && !matchType) return false;
    }
    return true;
  });

  const getStageBadge = (type: string | null) => {
    switch (type) {
      case "scripting":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
            <PenTool className="w-3 h-3 text-[#A78BFA]" />
            <span>Scripting</span>
          </span>
        );
      case "filming":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20">
            <Film className="w-3 h-3 text-[#69A9D8]" />
            <span>Shooting</span>
          </span>
        );
      case "editing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/20">
            <Scissors className="w-3 h-3 text-[#E5AA58]" />
            <span>Editing</span>
          </span>
        );
      case "approval":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/20">
            <ShieldCheck className="w-3 h-3 text-[#45B88A]" />
            <span>Review</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
            {type || "General"}
          </span>
        );
    }
  };

  const getPriorityBadge = (p: Task["priority"]) => {
    switch (p) {
      case "urgent":
        return <span className="text-[10px] font-mono font-bold text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-1.5 py-0.5 rounded">URGENT</span>;
      case "high":
        return <span className="text-[10px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-1.5 py-0.5 rounded">HIGH</span>;
      case "medium":
        return <span className="text-[10px] font-mono font-medium text-[#A3A0B0] bg-[#20202A] border border-[#30303D] px-1.5 py-0.5 rounded">MED</span>;
      default:
        return <span className="text-[10px] font-mono font-medium text-[#71717A] bg-[#17171E] border border-[#30303D] px-1.5 py-0.5 rounded">LOW</span>;
    }
  };

  // Stats calculation
  const totalCount = tasks.length;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const reviewCount = tasks.filter((t) => ["internal_review", "client_review"].includes(t.status)).length;
  const doneCount = tasks.filter((t) => ["approved", "done"].includes(t.status)).length;
  const remainingCount = tasks.filter((t) => !["approved", "done"].includes(t.status)).length;

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Production Tasks</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Production Tasks & Pipeline
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Actionable breakdown of all monthly deliverables across Scripting, Footage Prep, Video Editing, and Client Approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 bg-[#17171E] hover:bg-[#20202A] text-[#F2F0F7] text-xs font-medium px-3.5 py-2 rounded-xl border border-white/[0.08] transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>My Workbench</span>
          </Link>
          {!isSpecialist && (
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
              <span>Generate Sprint</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Specialist Focus Banner (Subtle & Contextual) ── */}
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
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.2 rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
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

      {/* ── 5-Segment Editorial Telemetry Strip (Linear Style) ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-4 shadow-sm grid grid-cols-2 sm:grid-cols-5 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        {/* Metric 1 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 first:px-0">
          <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Remaining</span>
            <span className="text-[10px] font-mono text-[#A3A0B0]/60">{totalCount} total</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#F2F0F7]">{remainingCount}</span>
            <span className="text-[10px] text-[#A3A0B0] font-mono">in progress</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-[#A78BFA] text-[11px] font-medium uppercase tracking-wider">
            <span>Ready to Script</span>
            <PenTool className="w-3.5 h-3.5 text-[#A78BFA]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#A78BFA]">{todoCount}</span>
            <span className="text-[10px] text-[#A3A0B0] font-mono">stage: todo</span>
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
            <span className="text-[10px] text-[#45B88A] font-mono font-medium">ready to publish</span>
          </div>
        </div>
      </div>

      {/* ── Filter and View Toggles Bar (Linear Toolstrip) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#A3A0B0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter tasks by title or deliverable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 pl-8.5 pr-3 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20 transition-all"
            />
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-1 bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs font-medium">
            {["all", "scripting", "filming", "editing", "approval"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                className={`px-2 py-1 rounded-md text-[11px] capitalize transition-all cursor-pointer ${
                  selectedStage === st
                    ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                {st === "filming" ? "Shooting" : st}
              </button>
            ))}
          </div>

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
                  {m.user_id === user?.id ? `⚡ ${m.user_full_name || m.user_email?.split("@")[0]} (Me)` : `${m.user_full_name || m.user_email?.split("@")[0]} (${m.role})`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View Switcher: Kanban vs List */}
        <div className="flex items-center bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] self-start md:self-auto">
          <button
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              viewMode === "kanban" ? "bg-white/[0.08] text-[#F2F0F7] shadow-xs font-semibold" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              viewMode === "list" ? "bg-white/[0.08] text-[#F2F0F7] shadow-xs font-semibold" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List Table</span>
          </button>
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
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer">
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
        /* ── KANBAN BOARD VIEW (Linear / Raycast Style) ── */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => col.statuses.includes(t.status));
            return (
              <div key={col.id} className="bg-[#121217] rounded-xl p-3 border border-white/[0.06] min-h-[500px] flex flex-col">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                    <h3 className="text-xs font-semibold text-[#F2F0F7]">{col.title}</h3>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-[#A3A0B0] bg-[#20202A] px-1.5 py-0.2 rounded border border-white/[0.06]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-10 text-[11px] text-[#A3A0B0]/60">
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="surface-card rounded-xl border border-white/[0.08] hover:border-white/[0.18] p-3 transition-all space-y-2 shadow-xs group"
                      >
                        <div className="flex items-center justify-between gap-1">
                          {getStageBadge(t.task_type)}
                          {getPriorityBadge(t.priority)}
                        </div>

                        <Link
                          href={`/tasks/${t.id}`}
                          className="text-xs font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors leading-snug line-clamp-2 block"
                        >
                          {t.title}
                        </Link>

                        <div className="flex items-center justify-between pt-0.5 text-[10px] text-[#A3A0B0]">
                          <Link
                            href={`/tasks/${t.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-[#A78BFA] hover:text-[#B69BFF]"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Workbench &rarr;</span>
                          </Link>
                          {t.deliverable_id && (
                            <Link
                              href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                              className="text-[#A3A0B0] hover:text-[#F2F0F7] flex items-center gap-0.5"
                            >
                              <Film className="w-2.5 h-2.5" /> Media
                            </Link>
                          )}
                        </div>

                        {/* Assignee & Status Transition Selectors */}
                        <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-[#A3A0B0] flex items-center gap-1">
                              <User className="w-2.5 h-2.5 text-[#A3A0B0] shrink-0" />
                              <span>Assign:</span>
                            </span>
                            <select
                              value={t.assignee_id || ""}
                              disabled={updatingTaskId === t.id}
                              onChange={(e) => handleUpdateAssignee(t.id, e.target.value || null)}
                              className="text-[10px] font-medium bg-[#101014] text-[#F2F0F7] px-1.5 py-0.5 rounded border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[125px] truncate cursor-pointer"
                            >
                              <option value="">Unassigned</option>
                              {members.map((m) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-[#A3A0B0]">Move stage:</span>
                            <select
                              value={t.status}
                              disabled={updatingTaskId === t.id}
                              onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                              className="text-[10px] font-medium bg-[#101014] text-[#F2F0F7] px-1.5 py-0.5 rounded border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[125px] cursor-pointer"
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
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST TABLE VIEW (Linear Density 38px rows) ── */
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121217] text-[#A3A0B0] font-mono text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Task Deliverable</th>
                <th className="py-2.5 px-4 font-medium">Stage</th>
                <th className="py-2.5 px-4 font-medium">Priority</th>
                <th className="py-2.5 px-4 font-medium">Assignee</th>
                <th className="py-2.5 px-4 font-medium">Status LED</th>
                <th className="py-2.5 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-[#F2F0F7]">
              {filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-2.5 px-4">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors block leading-snug"
                    >
                      {t.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#A3A0B0]">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-0.5 font-medium"
                      >
                        Workbench &rarr;
                      </Link>
                      {t.deliverable_id && (
                        <Link
                          href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                          className="hover:text-[#F2F0F7] inline-flex items-center gap-1"
                        >
                          <Film className="w-2.5 h-2.5" /> Media
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">{getStageBadge(t.task_type)}</td>
                  <td className="py-2.5 px-4">{getPriorityBadge(t.priority)}</td>
                  <td className="py-2.5 px-4">
                    <select
                      value={t.assignee_id || ""}
                      disabled={updatingTaskId === t.id}
                      onChange={(e) => handleUpdateAssignee(t.id, e.target.value || null)}
                      className="text-[11px] font-medium bg-[#101014] text-[#F2F0F7] px-2 py-1 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 max-w-[150px] truncate cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_full_name || m.user_email?.split("@")[0]} ({m.role})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        ["approved", "done"].includes(t.status)
                          ? "bg-[#45B88A]"
                          : ["internal_review", "client_review"].includes(t.status)
                          ? "bg-[#69A9D8]"
                          : t.status === "in_progress"
                          ? "bg-[#E5AA58]"
                          : "bg-[#71717A]"
                      }`} />
                      <span className="capitalize text-xs font-medium text-[#F2F0F7]">{t.status.replace("_", " ")}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <select
                      value={t.status}
                      disabled={updatingTaskId === t.id}
                      onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                      className="text-[11px] font-medium bg-[#101014] text-[#F2F0F7] px-2 py-1 rounded-lg border border-white/[0.08] cursor-pointer focus:outline-none focus:border-[#A78BFA]/50"
                    >
                      <option value="backlog">Backlog</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="internal_review">Internal Review</option>
                      <option value="client_review">Client Review</option>
                      <option value="approved">Approved</option>
                      <option value="done">Done</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#71717A]">Loading task pipeline...</div>}>
      <TasksContent />
    </Suspense>
  );
}