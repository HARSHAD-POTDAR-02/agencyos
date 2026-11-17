"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { taskApi } from "@/lib/api";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Film,
  PenTool,
  Scissors,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Layers,
  ArrowRight,
  AlertTriangle,
  User,
  Building2,
  CheckSquare,
  LayoutGrid,
  List as ListIcon,
  X,
  Eye,
  SlidersHorizontal,
} from "lucide-react";

interface TaskItem {
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
  updated_at: string;
  client_id?: string;
  client_name?: string;
  campaign_id?: string;
  campaign_title?: string;
  deliverable_title?: string;
  deliverable_type?: string;
  assignee_name?: string;
  assignee_role?: string;
}

function getClientInitials(name?: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRelativeDueDate(dueDateStr: string | null, todayStr: string): { label: string; tone: "overdue" | "today" | "upcoming" | "none" } {
  if (!dueDateStr) return { label: "No due date", tone: "none" };
  if (dueDateStr < todayStr) {
    const diffDays = Math.round((new Date(todayStr).getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24));
    return { label: `Overdue by ${diffDays}d`, tone: "overdue" };
  }
  if (dueDateStr === todayStr) {
    return { label: "Due today", tone: "today" };
  }
  const diffDays = Math.round((new Date(dueDateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
  return { label: diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays}d`, tone: "upcoming" };
}

export default function EmployeeWorkspacePage() {
  const router = useRouter();
  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"action_required" | "revisions" | "in_review" | "completed" | "all">("action_required");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState<string>("all");
  const [todayStr, setTodayStr] = useState<string>("");
  const [viewScope, setViewScope] = useState<"my" | "all">("my");
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");

  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(currentMembership?.role || "");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
  }, []);

  const loadMyTasks = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = { limit: "150" };
      if (viewScope === "my") {
        params.my_tasks = true;
      }
      const myTaskList = (await taskApi.list(effectiveAgencyId, token, params)) as TaskItem[];
      setTasks(myTaskList || []);
    } catch (err) {
      console.error("Failed to load employee tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, viewScope]);

  useEffect(() => {
    loadMyTasks();
  }, [loadMyTasks]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setViewMode("list");
      } else if (e.key === "c" || e.key === "C" || e.key === "v" || e.key === "V") {
        e.preventDefault();
        setViewMode("cards");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        loadMyTasks();
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("workspace-search-input");
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadMyTasks]);

  // Calculations for KPI Cards
  const activeTasks = useMemo(() => tasks.filter((t) => ["todo", "in_progress"].includes(t.status)), [tasks]);
  const dueToday = useMemo(() => tasks.filter((t) => t.due_date && t.due_date === todayStr && !["approved", "done"].includes(t.status)), [tasks, todayStr]);
  const overdue = useMemo(() => tasks.filter((t) => t.due_date && t.due_date < todayStr && !["approved", "done"].includes(t.status)), [tasks, todayStr]);
  const pendingRevisions = useMemo(() => tasks.filter((t) => t.status === "changes_requested"), [tasks]);
  const awaitingReview = useMemo(() => tasks.filter((t) => t.status === "internal_review"), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => ["approved", "done"].includes(t.status)), [tasks]);

  // Filtering based on active tab and search
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeTab === "action_required") {
        if (!["todo", "in_progress", "changes_requested"].includes(t.status)) return false;
      } else if (activeTab === "revisions") {
        if (t.status !== "changes_requested") return false;
      } else if (activeTab === "in_review") {
        if (t.status !== "internal_review") return false;
      } else if (activeTab === "completed") {
        if (!["approved", "done"].includes(t.status)) return false;
      }

      if (selectedTaskType !== "all") {
        const type = (t.task_type || "").toLowerCase();
        if (!type.includes(selectedTaskType)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchClient = (t.client_name || "").toLowerCase().includes(q);
        const matchCamp = (t.campaign_title || "").toLowerCase().includes(q);
        const matchDeliv = (t.deliverable_title || "").toLowerCase().includes(q);
        const matchNotes = (t.notes || "").toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchCamp && !matchDeliv && !matchNotes) return false;
      }

      return true;
    });
  }, [tasks, activeTab, selectedTaskType, searchQuery]);

  const getTaskTypeBadge = (taskType: string | null) => {
    const type = (taskType || "").toLowerCase();
    if (type.includes("script") || type.includes("copy")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
          <PenTool className="w-3 h-3 text-[#A78BFA]" />
          <span>Scriptwriting</span>
        </span>
      );
    }
    if (type.includes("edit") || type.includes("video")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20">
          <Scissors className="w-3 h-3 text-[#69A9D8]" />
          <span>Video Editing</span>
        </span>
      );
    }
    if (type.includes("shoot") || type.includes("film")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/20">
          <Film className="w-3 h-3 text-[#E5AA58]" />
          <span>Footage Shoot</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/20">
        <ShieldCheck className="w-3 h-3 text-[#45B88A]" />
        <span>Review / QA</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#E16F7B]/10 text-[#E16F7B] border border-[#E16F7B]/30 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E16F7B] animate-pulse" />
            Urgent
          </span>
        );
      case "high":
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30 uppercase">
            High
          </span>
        );
      case "low":
        return (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#17171E] text-[#A3A0B0]/60 border border-white/[0.08] uppercase">
            Low
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#20202A] text-[#A3A0B0] border border-white/[0.08] uppercase">
            Medium
          </span>
        );
    }
  };

  return (
    <main className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-[#F2F0F7]">
      {/* ── Welcome Cockpit Banner Card ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] shadow-xs">
              <Briefcase className="w-5 h-5 text-[#A78BFA]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
                  Welcome back, {user?.full_name?.split(" ")[0] || "Specialist"}!
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 capitalize">
                  {currentMembership?.role?.replace("_", " ") || "Specialist"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] animate-pulse" />
                  Active Cockpit
                </span>
              </div>
              <p className="text-xs text-[#A3A0B0] mt-0.5">
                Focused operational workspace for your creative assignments, script drafts, and asset submissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isManagerOrOwner && (
            <div className="flex items-center gap-1 bg-[#101014] p-1 rounded-xl border border-white/[0.08] text-xs font-semibold">
              <button
                onClick={() => setViewScope("my")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewScope === "my"
                    ? "bg-[#20202A] text-[#A78BFA] border border-white/[0.08] font-bold shadow-xs"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setViewScope("all")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewScope === "all"
                    ? "bg-[#20202A] text-[#A78BFA] border border-white/[0.08] font-bold shadow-xs"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                All Agency Tasks
              </button>
            </div>
          )}

          <button
            onClick={loadMyTasks}
            disabled={loading}
            title="Sync Tasks (Shortcut: R)"
            className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-[#262630] text-[#F2F0F7] text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`} />
            <span>Sync</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-[9px] font-mono text-[#A3A0B0]">R</kbd>
          </button>

          <Link
            href="/tasks"
            title="Agency Kanban Board (Shortcut: K)"
            className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <span>Agency Kanban</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#101014]" />
          </Link>
        </div>
      </div>

      {/* ── 5-Segment Editorial Execution Strip (Linear Telemetry) ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-4 shadow-xs grid grid-cols-2 sm:grid-cols-5 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        {/* Metric 1: To Execute */}
        <div 
          onClick={() => setActiveTab("action_required")}
          className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 first:px-0 cursor-pointer transition-all group"
        >
          <div className={`flex items-center justify-between text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === "action_required"
              ? "text-[#C4B5FD] font-bold"
              : activeTab === "all"
              ? "text-[#A78BFA]/60 group-hover:text-[#A78BFA] font-medium"
              : "text-[#A78BFA]/20 group-hover:text-[#A78BFA]/60 font-medium"
          }`}>
            <span>To Execute</span>
            <CheckSquare className={`w-3.5 h-3.5 transition-colors ${
              activeTab === "action_required"
                ? "text-[#A78BFA]"
                : activeTab === "all"
                ? "text-[#A78BFA]/60 group-hover:text-[#A78BFA]"
                : "text-[#A78BFA]/20 group-hover:text-[#A78BFA]/60"
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-mono transition-all ${
              activeTab === "action_required"
                ? "text-3xl font-extrabold text-white drop-shadow-[0_0_12px_rgba(167,139,250,0.4)]"
                : activeTab === "all"
                ? "text-2xl font-bold text-[#A78BFA]/75 group-hover:text-[#A78BFA]"
                : "text-2xl font-bold text-[#A78BFA]/25 group-hover:text-[#A78BFA]/60"
            }`}>
              {activeTasks.length}
            </span>
            <span className={`text-[10px] font-mono transition-colors ${
              activeTab === "action_required"
                ? "text-[#C4B5FD] font-semibold"
                : activeTab === "all"
                ? "text-[#A78BFA]/50 group-hover:text-[#A78BFA]/80"
                : "text-[#A78BFA]/20 group-hover:text-[#A78BFA]/50"
            }`}>
              ready to work
            </span>
          </div>
        </div>

        {/* Metric 2: Needs Update / Revisions */}
        <div 
          onClick={() => setActiveTab("revisions")}
          className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 cursor-pointer transition-all group"
        >
          <div className={`flex items-center justify-between text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === "revisions"
              ? "text-[#FBBF24] font-bold"
              : activeTab === "all"
              ? "text-[#E5AA58]/60 group-hover:text-[#E5AA58] font-medium"
              : "text-[#E5AA58]/20 group-hover:text-[#E5AA58]/60 font-medium"
          }`}>
            <span>Needs Update</span>
            <AlertTriangle className={`w-3.5 h-3.5 transition-colors ${
              activeTab === "revisions"
                ? "text-[#FBBF24]"
                : activeTab === "all"
                ? "text-[#E5AA58]/60 group-hover:text-[#E5AA58]"
                : "text-[#E5AA58]/20 group-hover:text-[#E5AA58]/60"
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-mono transition-all ${
              activeTab === "revisions"
                ? "text-3xl font-extrabold text-[#FDE68A] drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                : activeTab === "all"
                ? "text-2xl font-bold text-[#E5AA58]/75 group-hover:text-[#E5AA58]"
                : "text-2xl font-bold text-[#E5AA58]/25 group-hover:text-[#E5AA58]/60"
            }`}>
              {pendingRevisions.length}
            </span>
            <span className={`text-[10px] font-mono transition-colors ${
              activeTab === "revisions"
                ? "text-[#FBBF24] font-semibold"
                : activeTab === "all"
                ? "text-[#E5AA58]/50 group-hover:text-[#E5AA58]/80"
                : "text-[#E5AA58]/20 group-hover:text-[#E5AA58]/50"
            }`}>
              manager feedback
            </span>
          </div>
        </div>

        {/* Metric 3: Awaiting Review */}
        <div 
          onClick={() => setActiveTab("in_review")}
          className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 cursor-pointer transition-all group"
        >
          <div className={`flex items-center justify-between text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === "in_review"
              ? "text-[#93C5FD] font-bold"
              : activeTab === "all"
              ? "text-[#69A9D8]/60 group-hover:text-[#69A9D8] font-medium"
              : "text-[#69A9D8]/20 group-hover:text-[#69A9D8]/60 font-medium"
          }`}>
            <span>In Inspection</span>
            <Clock className={`w-3.5 h-3.5 transition-colors ${
              activeTab === "in_review"
                ? "text-[#93C5FD]"
                : activeTab === "all"
                ? "text-[#69A9D8]/60 group-hover:text-[#69A9D8]"
                : "text-[#69A9D8]/20 group-hover:text-[#69A9D8]/60"
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-mono transition-all ${
              activeTab === "in_review"
                ? "text-3xl font-extrabold text-[#DBEAFE] drop-shadow-[0_0_12px_rgba(147,197,253,0.4)]"
                : activeTab === "all"
                ? "text-2xl font-bold text-[#69A9D8]/75 group-hover:text-[#69A9D8]"
                : "text-2xl font-bold text-[#69A9D8]/25 group-hover:text-[#69A9D8]/60"
            }`}>
              {awaitingReview.length}
            </span>
            <span className={`text-[10px] font-mono transition-colors ${
              activeTab === "in_review"
                ? "text-[#93C5FD] font-semibold"
                : activeTab === "all"
                ? "text-[#69A9D8]/50 group-hover:text-[#69A9D8]/80"
                : "text-[#69A9D8]/20 group-hover:text-[#69A9D8]/50"
            }`}>
              submitted
            </span>
          </div>
        </div>

        {/* Metric 4: Deadlines */}
        <div className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 transition-all group">
          <div className="flex items-center justify-between text-[#E16F7B]/40 group-hover:text-[#E16F7B]/70 text-[11px] font-mono font-medium uppercase tracking-wider transition-colors">
            <span>Deadlines</span>
            <Calendar className={`w-3.5 h-3.5 transition-colors ${overdue.length > 0 ? "text-[#E16F7B]" : "text-[#E16F7B]/40"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono transition-colors ${overdue.length > 0 ? "text-[#E16F7B]" : "text-[#E16F7B]/35 group-hover:text-[#E16F7B]/60"}`}>
              {dueToday.length + overdue.length}
            </span>
            <span className="text-[10px] text-[#E16F7B]/30 group-hover:text-[#E16F7B]/60 font-mono transition-colors">
              {overdue.length > 0 ? `${overdue.length} overdue` : "on track"}
            </span>
          </div>
        </div>

        {/* Metric 5: Passed QA */}
        <div 
          onClick={() => setActiveTab("completed")}
          className="flex flex-col justify-between pt-2 sm:pt-0 sm:px-3 cursor-pointer transition-all group"
        >
          <div className={`flex items-center justify-between text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === "completed"
              ? "text-[#6EE7B7] font-bold"
              : activeTab === "all"
              ? "text-[#45B88A]/60 group-hover:text-[#45B88A] font-medium"
              : "text-[#45B88A]/20 group-hover:text-[#45B88A]/60 font-medium"
          }`}>
            <span>Passed QA</span>
            <CheckCircle2 className={`w-3.5 h-3.5 transition-colors ${
              activeTab === "completed"
                ? "text-[#6EE7B7]"
                : activeTab === "all"
                ? "text-[#45B88A]/60 group-hover:text-[#45B88A]"
                : "text-[#45B88A]/20 group-hover:text-[#45B88A]/60"
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-mono transition-all ${
              activeTab === "completed"
                ? "text-3xl font-extrabold text-[#D1FAE5] drop-shadow-[0_0_12px_rgba(110,231,183,0.4)]"
                : activeTab === "all"
                ? "text-2xl font-bold text-[#45B88A]/75 group-hover:text-[#45B88A]"
                : "text-2xl font-bold text-[#45B88A]/25 group-hover:text-[#45B88A]/60"
            }`}>
              {completed.length}
            </span>
            <span className={`text-[10px] font-mono transition-colors ${
              activeTab === "completed"
                ? "text-[#6EE7B7] font-semibold"
                : activeTab === "all"
                ? "text-[#45B88A]/50 group-hover:text-[#45B88A]/80"
                : "text-[#45B88A]/20 group-hover:text-[#45B88A]/50"
            }`}>
              ready to publish
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter and Tab Navigation Bar (Linear Toolstrip) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Tab Controls */}
        <div className="flex items-center gap-1 p-0.5 bg-[#101014] rounded-lg border border-white/[0.08] text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("action_required")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "action_required"
                ? "bg-white/[0.08] text-[#A78BFA] font-bold shadow-xs border border-white/[0.08]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <span>Action Required</span>
            <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono font-bold text-[#A78BFA]">
              {activeTasks.length + pendingRevisions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("revisions")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "revisions"
                ? "bg-white/[0.08] text-[#E5AA58] font-bold shadow-xs border border-[#E5AA58]/30"
                : "text-[#A3A0B0] hover:text-[#E5AA58]"
            }`}
          >
            <span>Revisions</span>
            <span className="px-1.5 py-0.2 rounded bg-[#E5AA58]/10 text-[10px] font-mono font-bold text-[#E5AA58]">
              {pendingRevisions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("in_review")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "in_review"
                ? "bg-white/[0.08] text-[#69A9D8] font-bold shadow-xs border border-[#69A9D8]/30"
                : "text-[#A3A0B0] hover:text-[#69A9D8]"
            }`}
          >
            <span>In Review</span>
            <span className="px-1.5 py-0.2 rounded bg-[#69A9D8]/10 text-[10px] font-mono font-bold text-[#69A9D8]">
              {awaitingReview.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "completed"
                ? "bg-white/[0.08] text-[#45B88A] font-bold shadow-xs border border-[#45B88A]/30"
                : "text-[#A3A0B0] hover:text-[#45B88A]"
            }`}
          >
            <span>Approved</span>
            <span className="px-1.5 py-0.2 rounded bg-[#45B88A]/10 text-[10px] font-mono font-bold text-[#45B88A]">
              {completed.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "all"
                ? "bg-white/[0.08] text-[#F2F0F7] font-bold shadow-xs border border-white/[0.08]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <span>All Assigned</span>
            <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono font-bold text-[#F2F0F7]">
              {tasks.length}
            </span>
          </button>
        </div>

        {/* Search, Specialty Selector & View Mode Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#A3A0B0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="workspace-search-input"
              type="text"
              placeholder="Search tasks... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 pl-8.5 pr-8 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Specialty Dropdown */}
          <select
            value={selectedTaskType}
            onChange={(e) => setSelectedTaskType(e.target.value)}
            className="bg-[#101014] text-xs font-mono font-medium text-[#F2F0F7] px-2.5 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 transition-all cursor-pointer"
          >
            <option value="all">All Specialties</option>
            <option value="script">Scriptwriting</option>
            <option value="edit">Video Editing</option>
            <option value="shoot">Shooting</option>
            <option value="design">Design</option>
          </select>

          {/* View Mode Toggle: Cards vs List */}
          <div className="flex items-center bg-[#101014] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setViewMode("cards")}
              title="Grid Cards View (Shortcut: C)"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white/[0.08] text-[#A78BFA] shadow-xs"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="Linear Compact List View (Shortcut: L)"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white/[0.08] text-[#A78BFA] shadow-xs"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Task Content */}
      {loading ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#F2F0F7]">Loading your assigned tasks...</p>
          <p className="text-[11px] text-[#A3A0B0]">Synchronizing production pipeline and delivery queue</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] border-dashed p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center mx-auto text-[#45B88A]">
            <CheckCircle2 className="w-6 h-6 text-[#45B88A]" />
          </div>
          <h3 className="text-base font-heading font-bold text-[#F2F0F7]">No tasks matching this view</h3>
          <p className="text-xs text-[#A3A0B0] max-w-md mx-auto leading-relaxed">
            {viewScope === "my" && tasks.length === 0 && isManagerOrOwner
              ? "You currently have 0 tasks assigned directly to your account. Switch to 'All Agency Tasks' or assign tasks to yourself on the Kanban board."
              : activeTab === "revisions"
              ? "Outstanding work! You have zero revision requests pending from managers."
              : activeTab === "action_required"
              ? "All clear! You have no tasks waiting for execution right now."
              : activeTab === "in_review"
              ? "No tasks currently submitted for internal review."
              : "No tasks found with the selected filters."}
          </p>
          {viewScope === "my" && tasks.length === 0 && isManagerOrOwner && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setViewScope("all")}
                className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#262630] text-[#A78BFA] font-semibold text-xs border border-white/[0.08] transition-colors cursor-pointer"
              >
                View All Agency Tasks
              </button>
              <Link
                href="/tasks"
                className="px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-bold text-xs transition-colors shadow-xs"
              >
                Go to Kanban Board
              </Link>
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        /* ── Compact Linear 38px Table View ── */
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#101014]/60 text-[10px] font-mono uppercase tracking-wider text-[#A3A0B0]">
                  <th className="py-2.5 px-4 w-12 text-center">Priority</th>
                  <th className="py-2.5 px-4">Task & Creative</th>
                  <th className="py-2.5 px-4">Client / Campaign</th>
                  <th className="py-2.5 px-4">Specialty</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredTasks.map((t) => {
                  const isRevision = t.status === "changes_requested";
                  const isInReview = t.status === "internal_review";
                  const isApproved = ["approved", "done"].includes(t.status);
                  const dueInfo = formatRelativeDueDate(t.due_date, todayStr);

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-[#20202A]/40 transition-colors group h-[40px]"
                    >
                      {/* Priority Dot */}
                      <td className="py-2 px-4 text-center">
                        {t.priority === "urgent" ? (
                          <span className="w-2 h-2 rounded-full bg-[#E16F7B] inline-block ring-2 ring-[#E16F7B]/30 animate-pulse" title="Urgent Priority" />
                        ) : t.priority === "high" ? (
                          <span className="w-2 h-2 rounded-full bg-[#E5AA58] inline-block" title="High Priority" />
                        ) : t.priority === "low" ? (
                          <span className="w-2 h-2 rounded-full bg-white/[0.15] inline-block" title="Low Priority" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#A3A0B0] inline-block" title="Medium Priority" />
                        )}
                      </td>

                      {/* Task Title */}
                      <td className="py-2 px-4 min-w-[240px]">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors truncate block max-w-sm"
                        >
                          {t.title}
                        </Link>
                      </td>

                      {/* Client & Campaign */}
                      <td className="py-2 px-4 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[8px] font-mono font-bold text-[#A78BFA] shrink-0">
                            {getClientInitials(t.client_name)}
                          </span>
                          <span className="truncate max-w-[140px] text-[#F2F0F7] font-medium text-[11px]">
                            {t.client_name || "Client"}
                          </span>
                        </div>
                      </td>

                      {/* Specialty */}
                      <td className="py-2 px-4 whitespace-nowrap">
                        {getTaskTypeBadge(t.task_type)}
                      </td>

                      {/* Due Date */}
                      <td className="py-2 px-4 whitespace-nowrap font-mono text-[11px]">
                        <span className={`${
                          dueInfo.tone === "overdue" && !isApproved
                            ? "text-[#E16F7B] font-bold"
                            : dueInfo.tone === "today" && !isApproved
                            ? "text-[#E5AA58] font-bold"
                            : "text-[#A3A0B0]"
                        }`}>
                          {dueInfo.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold border ${
                          isRevision
                            ? "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30"
                            : isInReview
                            ? "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30"
                            : isApproved
                            ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                            : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
                        }`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/tasks/${t.id}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                            isRevision
                              ? "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                              : isInReview
                              ? "bg-[#69A9D8] hover:bg-[#7bb3dc] text-[#101014]"
                              : "bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014]"
                          }`}
                        >
                          <span>{isRevision ? "Address Feedback" : "Workbench"}</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Framer Elevated Grid Cards View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((t) => {
            const isRevision = t.status === "changes_requested";
            const isInReview = t.status === "internal_review";
            const isApproved = ["approved", "done"].includes(t.status);
            const dueInfo = formatRelativeDueDate(t.due_date, todayStr);

            return (
              <div
                key={t.id}
                className="group relative surface-card rounded-2xl border border-white/[0.08] hover:border-white/[0.18] p-5 transition-all flex flex-col justify-between shadow-xs"
              >
                {/* Card Top: Badges & Deadline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getTaskTypeBadge(t.task_type)}
                      {getPriorityBadge(t.priority)}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#A3A0B0]">
                      <Clock className="w-3 h-3 text-[#A3A0B0]" />
                      <span className={`font-mono text-[11px] ${
                        dueInfo.tone === "overdue" && !isApproved
                          ? "text-[#E16F7B] font-bold"
                          : dueInfo.tone === "today" && !isApproved
                          ? "text-[#E5AA58] font-bold"
                          : "text-[#A3A0B0]"
                      }`}>
                        {dueInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Client & Campaign Context with Monogram */}
                  <div className="flex items-center gap-2 text-[11px] text-[#A3A0B0]">
                    <div className="w-5 h-5 rounded-md bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[9px] font-mono font-bold text-[#A78BFA] shrink-0">
                      {getClientInitials(t.client_name)}
                    </div>
                    <span className="font-semibold text-[#F2F0F7] truncate max-w-[160px]">
                      {t.client_name || "Client"}
                    </span>
                    <span className="text-white/[0.2]">&bull;</span>
                    <span className="truncate max-w-[200px] text-[#A3A0B0] font-mono">
                      {t.campaign_title || "Campaign"}
                    </span>
                  </div>

                  {/* Task Title */}
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block text-sm font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors line-clamp-1"
                  >
                    {t.title}
                  </Link>

                  {/* Context Note preview */}
                  {t.notes && (
                    <p className="text-[11px] text-[#A3A0B0] line-clamp-2 leading-relaxed bg-[#101014] p-2.5 rounded-lg border border-white/[0.06] font-mono">
                      {t.notes.slice(0, 160)}...
                    </p>
                  )}

                  {/* Feedback / Status Alert Pill */}
                  {isRevision && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#E5AA58]/10 border border-[#E5AA58]/30 text-[#E5AA58] text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#E5AA58] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Manager requested changes.</span> Click below to review feedback and resubmit your revised draft.
                      </div>
                    </div>
                  )}

                  {isInReview && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#69A9D8]/10 border border-[#69A9D8]/30 text-[#69A9D8] text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-[#69A9D8] shrink-0" />
                      <span>Submitted for internal review. Awaiting manager sign-off.</span>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A] shrink-0" />
                      <span>Approved internally. Ready for client review & scheduling.</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Open Task Action */}
                <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#A3A0B0] uppercase tracking-wider">
                    Status: <span className="text-[#F2F0F7] font-medium">{t.status.replace("_", " ")}</span>
                  </span>

                  <Link
                    href={`/tasks/${t.id}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-[0.98] ${
                      isRevision
                        ? "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                        : isInReview
                        ? "bg-[#69A9D8] hover:bg-[#7bb3dc] text-[#101014]"
                        : "bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014]"
                    }`}
                  >
                    <span>{isRevision ? "Address Feedback" : "Open Workbench"}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
