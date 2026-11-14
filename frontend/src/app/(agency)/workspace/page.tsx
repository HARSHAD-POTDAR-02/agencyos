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

  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
  }, []);

  const loadMyTasks = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    setLoading(true);
    try {
      const myTaskList = (await taskApi.list(effectiveAgencyId, token, {
        my_tasks: true,
        limit: "100",
      })) as TaskItem[];
      setTasks(myTaskList || []);
    } catch (err) {
      console.error("Failed to load employee tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId]);

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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <PenTool className="w-3.5 h-3.5 text-purple-600" />
          <span>Scriptwriting</span>
        </span>
      );
    }
    if (type.includes("edit") || type.includes("video")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Scissors className="w-3.5 h-3.5 text-blue-600" />
          <span>Video Editing</span>
        </span>
      );
    }
    if (type.includes("shoot") || type.includes("film")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Film className="w-3.5 h-3.5 text-amber-600" />
          <span>Footage Shoot</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Review / QA</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 uppercase">Urgent</span>;
      case "high":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase">High</span>;
      case "low":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase">Low</span>;
      default:
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase">Medium</span>;
    }
  };

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner Card (White bg, slate-200/80 border, matching Dashboard style) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  Welcome back, {user?.full_name?.split(" ")[0] || "Team Member"}!
                  <span className="text-xl">👋</span>
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200 capitalize">
                  {currentMembership?.role || "Team Member"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Focused operational workspace for your creative assignments, script drafts, and asset submissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMyTasks}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : "text-slate-400"}`} />
            <span>Sync Tasks</span>
          </button>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-purple-500/25 transition-all"
          >
            <span>Agency Kanban</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-200" />
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards (Styled exactly like Dashboard Cards: White bg, slate-200/80 border, soft shadow-2xs) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Active Tasks */}
        <div 
          onClick={() => setActiveTab("action_required")}
          className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all cursor-pointer group ${
            activeTab === "action_required" 
              ? "border-purple-400 ring-2 ring-purple-500/20 shadow-md" 
              : "border-slate-200/80 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">
              Active Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeTasks.length}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              To Execute
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Ready to work on</p>
        </div>

        {/* Pending Revisions */}
        <div 
          onClick={() => setActiveTab("revisions")}
          className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all cursor-pointer group ${
            activeTab === "revisions" 
              ? "border-amber-400 ring-2 ring-amber-500/20 shadow-md" 
              : "border-slate-200/80 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">
              Pending Revisions
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {pendingRevisions.length}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Needs Update
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Manager feedback waiting</p>
        </div>

        {/* Awaiting Review */}
        <div 
          onClick={() => setActiveTab("in_review")}
          className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all cursor-pointer group ${
            activeTab === "in_review" 
              ? "border-blue-400 ring-2 ring-blue-500/20 shadow-md" 
              : "border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
              Awaiting Review
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {awaitingReview.length}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              In Inspection
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Submitted to manager</p>
        </div>

        {/* Due Today / Overdue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Deadlines
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${overdue.length > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${overdue.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {dueToday.length + overdue.length}
            </span>
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${
              overdue.length > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-600 bg-slate-50 border-slate-200"
            }`}>
              {overdue.length > 0 ? `${overdue.length} Overdue` : "On Track"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {overdue.length > 0 ? `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}` : `${dueToday.length} due today`}
          </p>
        </div>

        {/* Completed / Approved */}
        <div 
          onClick={() => setActiveTab("completed")}
          className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all cursor-pointer group ${
            activeTab === "completed" 
              ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-md" 
              : "border-slate-200/80 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
              Approved
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {completed.length}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Passed QA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Client ready</p>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar (White Card, Slate Outline, Shadow-2xs) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("action_required")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "action_required"
                ? "bg-white text-purple-700 shadow-2xs font-extrabold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Action Required ({activeTasks.length + pendingRevisions.length})
          </button>
          <button
            onClick={() => setActiveTab("revisions")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "revisions"
                ? "bg-white text-amber-700 shadow-2xs font-extrabold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Revisions ({pendingRevisions.length})
          </button>
          <button
            onClick={() => setActiveTab("in_review")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "in_review"
                ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            In Review ({awaitingReview.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "completed"
                ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Approved ({completed.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Assigned ({tasks.length})
          </button>
        </div>

        {/* Search and Role Filter */}
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
            />
          </div>

          <select
            value={selectedTaskType}
            onChange={(e) => setSelectedTaskType(e.target.value)}
            className="bg-slate-50 text-xs font-semibold text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
          >
            <option value="all">All Roles</option>
            <option value="script">Scriptwriting</option>
            <option value="edit">Video Editing</option>
            <option value="shoot">Shooting</option>
            <option value="design">Design</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid (Dashboard-style White Cards) */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Loading your assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 border-dashed p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No tasks matching this view</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activeTab === "revisions"
              ? "Great job! You have zero revision requests pending."
              : activeTab === "action_required"
              ? "All clear! You have no tasks waiting for execution right now."
              : "No tasks found with the selected filters."}
          </p>
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
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 transition-all flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-purple-300 hover:-translate-y-0.5"
              >
                {/* Card Top: Badges & Deadline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getTaskTypeBadge(t.task_type)}
                      {getPriorityBadge(t.priority)}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {t.due_date ? (
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          t.due_date < todayStr && !isApproved
                            ? "text-rose-600 font-bold"
                            : t.due_date === todayStr && !isApproved
                            ? "text-amber-600 font-bold"
                            : "text-slate-500"
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.due_date}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No deadline</span>
                      )}
                    </div>
                  </div>

                  {/* Client & Campaign Context */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>{t.client_name || "Client"}</span>
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[220px] text-slate-500 font-medium">
                      {t.campaign_title || "Campaign"}
                    </span>
                  </div>

                  {/* Task Title */}
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block text-base font-extrabold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-1"
                  >
                    {t.title}
                  </Link>

                  {/* Context Note preview */}
                  {t.notes && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-mono text-[11px]">
                      {t.notes.slice(0, 160)}...
                    </p>
                  )}

                  {/* Feedback / Status Alert Pill */}
                  {isRevision && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Manager requested changes.</span> Click below to view review notes and resubmit your revised draft.
                      </div>
                    </div>
                  )}

                  {isInReview && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-900 text-xs font-semibold">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Submitted for internal review. Awaiting manager approval.</span>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Approved internally. Ready for client review & scheduling.</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Open Task Action */}
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Status: <span className="text-slate-800 font-bold">{t.status.replace("_", " ")}</span>
                  </span>

                  <Link
                    href={`/tasks/${t.id}`}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      isRevision
                        ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                        : isInReview
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                        : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20 hover:scale-[1.02]"
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
