"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  CheckSquare
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

export default function EmployeeWorkspacePage() {
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

  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(currentMembership?.role || "");

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
  }, []);

  const loadMyTasks = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = { limit: "100" };
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

  // Calculations for KPI Cards
  const activeTasks = tasks.filter((t) => ["todo", "in_progress"].includes(t.status));
  const dueToday = tasks.filter((t) => t.due_date && t.due_date === todayStr && !["approved", "done"].includes(t.status));
  const overdue = tasks.filter((t) => t.due_date && t.due_date < todayStr && !["approved", "done"].includes(t.status));
  const pendingRevisions = tasks.filter((t) => t.status === "changes_requested");
  const awaitingReview = tasks.filter((t) => t.status === "internal_review");
  const completed = tasks.filter((t) => ["approved", "done"].includes(t.status));

  // Filtering based on active tab
  const filteredTasks = tasks.filter((t) => {
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
      if (!matchTitle && !matchClient && !matchCamp && !matchDeliv) return false;
    }

    return true;
  });

  const getTaskTypeBadge = (taskType: string | null) => {
    const type = (taskType || "").toLowerCase();
    if (type.includes("script") || type.includes("copy")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
          <PenTool className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span>Scriptwriting</span>
        </span>
      );
    }
    if (type.includes("edit") || type.includes("video")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20">
          <Scissors className="w-3.5 h-3.5 text-[#69A9D8]" />
          <span>Video Editing</span>
        </span>
      );
    }
    if (type.includes("shoot") || type.includes("film")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/20">
          <Film className="w-3.5 h-3.5 text-[#E5AA58]" />
          <span>Footage Shoot</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/20">
        <ShieldCheck className="w-3.5 h-3.5 text-[#45B88A]" />
        <span>Review / QA</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E16F7B]/10 text-[#E16F7B] border border-[#E16F7B]/30 uppercase">Urgent</span>;
      case "high":
        return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30 uppercase">High</span>;
      case "low":
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#17171E] text-[#71717A] border border-[#30303D] uppercase">Low</span>;
      default:
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#20202A] text-[#A3A0B0] border border-[#30303D] uppercase">Medium</span>;
    }
  };

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner Card */}
      <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                  Welcome back, {user?.full_name?.split(" ")[0] || "Team Member"}!
                  <span className="text-xl">👋</span>
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 capitalize">
                  {currentMembership?.role || "Team Member"}
                </span>
              </div>
              <p className="text-sm text-[#A3A0B0] mt-1">
                Focused operational workspace for your creative assignments, script drafts, and asset submissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isManagerOrOwner && (
            <div className="flex items-center gap-1 bg-[#101014] p-1 rounded-xl border border-[#30303D] text-xs font-semibold">
              <button
                onClick={() => setViewScope("my")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewScope === "my"
                    ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setViewScope("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewScope === "all"
                    ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                All Agency Tasks
              </button>
            </div>
          )}

          <button
            onClick={loadMyTasks}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-[#20202A] hover:bg-[#262630] text-[#F2F0F7] text-xs font-semibold px-3.5 py-2 rounded-xl border border-[#30303D] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#A78BFA]" : "text-[#71717A]"}`} />
            <span>Sync Tasks</span>
          </button>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
          >
            <span>Agency Kanban</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#101014]" />
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Active Tasks */}
        <div 
          onClick={() => setActiveTab("action_required")}
          className={`bg-[#17171E] rounded-xl p-5 border transition-all cursor-pointer group ${
            activeTab === "action_required" 
              ? "border-[#A78BFA] ring-2 ring-[#A78BFA]/20 shadow-md" 
              : "border-[#30303D] hover:border-[#A78BFA]/40 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A3A0B0] uppercase tracking-wider group-hover:text-[#A78BFA] transition-colors">
              Active Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#20202A] text-[#A78BFA] border border-[#30303D] flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
              {activeTasks.length}
            </span>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#A78BFA] bg-[#A78BFA]/10 px-2 py-0.5 rounded-full border border-[#A78BFA]/30">
              To Execute
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-2">Ready to work on</p>
        </div>

        {/* Pending Revisions */}
        <div 
          onClick={() => setActiveTab("revisions")}
          className={`bg-[#17171E] rounded-xl p-5 border transition-all cursor-pointer group ${
            activeTab === "revisions" 
              ? "border-[#E5AA58] ring-2 ring-[#E5AA58]/20 shadow-md" 
              : "border-[#30303D] hover:border-[#E5AA58]/40 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A3A0B0] uppercase tracking-wider group-hover:text-[#E5AA58] transition-colors">
              Pending Revisions
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#20202A] text-[#E5AA58] border border-[#30303D] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
              {pendingRevisions.length}
            </span>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#E5AA58] bg-[#E5AA58]/10 px-2 py-0.5 rounded-full border border-[#E5AA58]/30">
              Needs Update
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-2">Manager feedback waiting</p>
        </div>

        {/* Awaiting Review */}
        <div 
          onClick={() => setActiveTab("in_review")}
          className={`bg-[#17171E] rounded-xl p-5 border transition-all cursor-pointer group ${
            activeTab === "in_review" 
              ? "border-[#69A9D8] ring-2 ring-[#69A9D8]/20 shadow-md" 
              : "border-[#30303D] hover:border-[#69A9D8]/40 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A3A0B0] uppercase tracking-wider group-hover:text-[#69A9D8] transition-colors">
              Awaiting Review
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#20202A] text-[#69A9D8] border border-[#30303D] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
              {awaitingReview.length}
            </span>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#69A9D8] bg-[#69A9D8]/10 px-2 py-0.5 rounded-full border border-[#69A9D8]/30">
              In Inspection
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-2">Submitted to manager</p>
        </div>

        {/* Due Today / Overdue */}
        <div className="bg-[#17171E] rounded-xl p-5 border border-[#30303D]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A3A0B0] uppercase tracking-wider">
              Deadlines
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-[#30303D] ${overdue.length > 0 ? "bg-[#E16F7B]/10 text-[#E16F7B]" : "bg-[#20202A] text-[#71717A]"}`}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono tracking-tight ${overdue.length > 0 ? "text-[#E16F7B]" : "text-[#F2F0F7]"}`}>
              {dueToday.length + overdue.length}
            </span>
            <span className={`inline-flex items-center text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              overdue.length > 0 ? "text-[#E16F7B] bg-[#E16F7B]/10 border-[#E16F7B]/30" : "text-[#71717A] bg-[#20202A] border-[#30303D]"
            }`}>
              {overdue.length > 0 ? `${overdue.length} Overdue` : "On Track"}
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-2">
            {overdue.length > 0 ? `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}` : `${dueToday.length} due today`}
          </p>
        </div>

        {/* Completed / Approved */}
        <div 
          onClick={() => setActiveTab("completed")}
          className={`bg-[#17171E] rounded-xl p-5 border transition-all cursor-pointer group ${
            activeTab === "completed" 
              ? "border-[#45B88A] ring-2 ring-[#45B88A]/20 shadow-md" 
              : "border-[#30303D] hover:border-[#45B88A]/40 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A3A0B0] uppercase tracking-wider group-hover:text-[#45B88A] transition-colors">
              Approved
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#20202A] text-[#45B88A] border border-[#30303D] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
              {completed.length}
            </span>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#45B88A] bg-[#45B88A]/10 px-2 py-0.5 rounded-full border border-[#45B88A]/30">
              Passed QA
            </span>
          </div>
          <p className="text-[11px] text-[#71717A] mt-2">Client ready</p>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#101014] rounded-lg border border-[#30303D] text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("action_required")}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "action_required"
                ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold"
                : "text-[#71717A] hover:text-[#F2F0F7]"
            }`}
          >
            Action Required ({activeTasks.length + pendingRevisions.length})
          </button>
          <button
            onClick={() => setActiveTab("revisions")}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "revisions"
                ? "bg-[#20202A] text-[#E5AA58] border border-[#30303D] font-bold"
                : "text-[#71717A] hover:text-[#F2F0F7]"
            }`}
          >
            Revisions ({pendingRevisions.length})
          </button>
          <button
            onClick={() => setActiveTab("in_review")}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "in_review"
                ? "bg-[#20202A] text-[#69A9D8] border border-[#30303D] font-bold"
                : "text-[#71717A] hover:text-[#F2F0F7]"
            }`}
          >
            In Review ({awaitingReview.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "completed"
                ? "bg-[#20202A] text-[#45B88A] border border-[#30303D] font-bold"
                : "text-[#71717A] hover:text-[#F2F0F7]"
            }`}
          >
            Approved ({completed.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                : "text-[#71717A] hover:text-[#F2F0F7]"
            }`}
          >
            All Assigned ({tasks.length})
          </button>
        </div>

        {/* Search and Role Filter */}
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#71717A] pl-8 pr-3 py-1.5 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all"
            />
          </div>

          <select
            value={selectedTaskType}
            onChange={(e) => setSelectedTaskType(e.target.value)}
            className="bg-[#101014] text-xs font-medium text-[#F2F0F7] px-3 py-1.5 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all"
          >
            <option value="all">All Roles</option>
            <option value="script">Scriptwriting</option>
            <option value="edit">Video Editing</option>
            <option value="shoot">Shooting</option>
            <option value="design">Design</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#71717A]">Loading your assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] border-dashed p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center mx-auto text-[#45B88A]">
            <CheckCircle2 className="w-6 h-6 text-[#45B88A]" />
          </div>
          <h3 className="text-base font-heading font-bold text-[#F2F0F7]">No tasks matching this view</h3>
          <p className="text-xs text-[#A3A0B0] max-w-md mx-auto">
            {viewScope === "my" && tasks.length === 0 && isManagerOrOwner
              ? "You currently have 0 tasks assigned directly to your account. Switch to 'All Agency Tasks' or assign tasks to yourself on the Kanban board."
              : activeTab === "revisions"
              ? "Great job! You have zero revision requests pending."
              : activeTab === "action_required"
              ? "All clear! You have no tasks waiting for execution right now."
              : "No tasks found with the selected filters."}
          </p>
          {viewScope === "my" && tasks.length === 0 && isManagerOrOwner && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setViewScope("all")}
                className="px-4 py-2 rounded-xl bg-[#20202A] hover:bg-[#262630] text-[#A78BFA] font-semibold text-xs border border-[#30303D] transition-colors"
              >
                View All Agency Tasks
              </button>
              <Link
                href="/tasks"
                className="px-4 py-2 rounded-xl bg-[#17171E] hover:bg-[#20202A] text-[#F2F0F7] font-semibold text-xs border border-[#30303D] transition-colors"
              >
                Go to Kanban Board
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTasks.map((t) => {
            const isRevision = t.status === "changes_requested";
            const isInReview = t.status === "internal_review";
            const isApproved = ["approved", "done"].includes(t.status);

            return (
              <div
                key={t.id}
                className="group relative bg-[#17171E] rounded-xl border border-[#30303D] p-5 transition-all flex flex-col justify-between hover:border-[#A78BFA]/40 hover:-translate-y-0.5"
              >
                {/* Card Top: Badges & Deadline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getTaskTypeBadge(t.task_type)}
                      {getPriorityBadge(t.priority)}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#71717A]">
                      {t.due_date ? (
                        <span className={`inline-flex items-center gap-1 font-mono font-semibold ${
                          t.due_date < todayStr && !isApproved
                            ? "text-[#E16F7B] font-bold"
                            : t.due_date === todayStr && !isApproved
                            ? "text-[#E5AA58] font-bold"
                            : "text-[#71717A]"
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.due_date}</span>
                        </span>
                      ) : (
                        <span className="text-[#71717A] text-[11px]">No deadline</span>
                      )}
                    </div>
                  </div>

                  {/* Client & Campaign Context */}
                  <div className="flex items-center gap-2 text-xs text-[#71717A] pt-0.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#F2F0F7]">
                      <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span>{t.client_name || "Client"}</span>
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[220px] text-[#A3A0B0] font-medium">
                      {t.campaign_title || "Campaign"}
                    </span>
                  </div>

                  {/* Task Title */}
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block text-base font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors line-clamp-1"
                  >
                    {t.title}
                  </Link>

                  {/* Context Note preview */}
                  {t.notes && (
                    <p className="text-xs text-[#A3A0B0] line-clamp-2 leading-relaxed bg-[#101014] p-2.5 rounded-lg border border-[#30303D] font-mono text-[11px]">
                      {t.notes.slice(0, 160)}...
                    </p>
                  )}

                  {/* Feedback / Status Alert Pill */}
                  {isRevision && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#E5AA58]/10 border border-[#E5AA58]/30 text-[#E5AA58] text-xs">
                      <AlertTriangle className="w-4 h-4 text-[#E5AA58] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Manager requested changes.</span> Click below to view review notes and resubmit your revised draft.
                      </div>
                    </div>
                  )}

                  {isInReview && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#69A9D8]/10 border border-[#69A9D8]/30 text-[#69A9D8] text-xs">
                      <Clock className="w-4 h-4 text-[#69A9D8] shrink-0" />
                      <span>Submitted for internal review. Awaiting manager approval.</span>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] text-xs">
                      <CheckCircle2 className="w-4 h-4 text-[#45B88A] shrink-0" />
                      <span>Approved internally. Ready for client review & scheduling.</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Open Task Action */}
                <div className="pt-3.5 mt-3.5 border-t border-[#30303D] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
                    Status: <span className="text-[#F2F0F7] font-semibold">{t.status.replace("_", " ")}</span>
                  </span>

                  <Link
                    href={`/tasks/${t.id}`}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      isRevision
                        ? "bg-[#E5AA58] hover:bg-[#f0b560] text-[#101014]"
                        : isInReview
                        ? "bg-[#69A9D8] hover:bg-[#7bb3dc] text-[#101014]"
                        : "bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014]"
                    }`}
                  >
                    <span>{isRevision ? "Address Feedback & Resubmit" : "Open Workspace"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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