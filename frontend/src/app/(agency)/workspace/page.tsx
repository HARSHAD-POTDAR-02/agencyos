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
  const todayStr = new Date().toISOString().split("T")[0];
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/30">
          <PenTool className="w-3.5 h-3.5 text-purple-400" />
          <span>Scriptwriting</span>
        </span>
      );
    }
    if (type.includes("edit") || type.includes("video")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-500/30">
          <Scissors className="w-3.5 h-3.5 text-blue-400" />
          <span>Video Editing</span>
        </span>
      );
    }
    if (type.includes("shoot") || type.includes("film")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/30">
          <Film className="w-3.5 h-3.5 text-amber-400" />
          <span>Footage Shoot</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Review / QA</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-500/40 uppercase">Urgent</span>;
      case "high":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-500/40 uppercase">High</span>;
      case "low":
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase">Low</span>;
      default:
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-950/90 text-blue-300 border border-blue-500/40 uppercase">Medium</span>;
    }
  };

  return (
    <div className="min-h-full w-full bg-[#0B0D14] text-slate-100 pb-16">
      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Personalized Header (Solid Purple-Black Theme, Zero White Bleed) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#121626] via-[#1D1333] to-[#121626] border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {user?.full_name ? `Welcome back, ${user.full_name}` : "My Execution Workspace"}
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40 capitalize">
                    {currentMembership?.role || "Team Member"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Focused operational workspace for your creative assignments, script drafts, and asset submissions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadMyTasks}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A2035] hover:bg-[#222A45] border border-white/10 text-xs font-semibold text-slate-200 transition-all hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
              <span>Sync Tasks</span>
            </button>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all"
            >
              <span>Agency Kanban</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* KPI Overview Cards (Solid, Non-Transparent Surfaces) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div 
            onClick={() => setActiveTab("action_required")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "action_required" 
                ? "bg-[#1A1530] border-purple-500/60 shadow-lg shadow-purple-950/60 ring-1 ring-purple-500/40" 
                : "bg-[#121626] border-white/10 hover:border-white/20 hover:bg-[#161B2E]"
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Active Tasks</span>
              <CheckSquare className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white">{activeTasks.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready to execute</p>
          </div>

          <div 
            onClick={() => setActiveTab("revisions")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "revisions" 
                ? "bg-[#251710] border-amber-500/60 shadow-lg shadow-amber-950/60 ring-1 ring-amber-500/40" 
                : "bg-[#121626] border-white/10 hover:border-white/20 hover:bg-[#161B2E]"
            }`}
          >
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pending Revisions</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{pendingRevisions.length}</div>
            <p className="text-[11px] text-amber-400/80 mt-0.5">Requires update</p>
          </div>

          <div 
            onClick={() => setActiveTab("in_review")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "in_review" 
                ? "bg-[#101C30] border-blue-500/60 shadow-lg shadow-blue-950/60 ring-1 ring-blue-500/40" 
                : "bg-[#121626] border-white/10 hover:border-white/20 hover:bg-[#161B2E]"
            }`}
          >
            <div className="flex items-center justify-between text-blue-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Review</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">{awaitingReview.length}</div>
            <p className="text-[11px] text-blue-400/80 mt-0.5">Internal inspection</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121626] border border-white/10">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Due Today / Overdue</span>
              <Calendar className={`w-4 h-4 ${overdue.length > 0 ? "text-rose-400" : "text-slate-400"}`} />
            </div>
            <div className={`text-2xl font-black ${overdue.length > 0 ? "text-rose-400" : "text-white"}`}>
              {dueToday.length + overdue.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{overdue.length > 0 ? `${overdue.length} overdue` : "On schedule"}</p>
          </div>

          <div 
            onClick={() => setActiveTab("completed")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              activeTab === "completed" 
                ? "bg-[#0F261E] border-emerald-500/60 shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-500/40" 
                : "bg-[#121626] border-white/10 hover:border-white/20 hover:bg-[#161B2E]"
            }`}
          >
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Approved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{completed.length}</div>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">Client ready</p>
          </div>
        </div>

        {/* Filter and Tab Navigation Bar */}
        <div className="bg-[#121626] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Controls */}
          <div className="flex items-center gap-1.5 bg-[#0B0D14] p-1 rounded-xl border border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("action_required")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "action_required"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Action Required ({activeTasks.length + pendingRevisions.length})
            </button>
            <button
              onClick={() => setActiveTab("revisions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "revisions"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Revisions ({pendingRevisions.length})
            </button>
            <button
              onClick={() => setActiveTab("in_review")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "in_review"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              In Review ({awaitingReview.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "completed"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Approved ({completed.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[#252C48] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Assigned ({tasks.length})
            </button>
          </div>

          {/* Search and Stage Selector */}
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0B0D14] text-xs text-white pl-8 pr-3 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={selectedTaskType}
              onChange={(e) => setSelectedTaskType(e.target.value)}
              className="bg-[#0B0D14] text-xs font-semibold text-slate-200 px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="script">Scriptwriting</option>
              <option value="edit">Video Editing</option>
              <option value="shoot">Shooting</option>
              <option value="design">Design</option>
            </select>
          </div>
        </div>

        {/* Task List / Workspace Grid */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-400">Loading your assigned tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-[#121626] border border-white/10 border-dashed rounded-3xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white">No tasks matching this view</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {activeTab === "revisions"
                ? "Great job! You have zero revision requests pending."
                : activeTab === "action_required"
                ? "All clear! You have no tasks waiting for execution right now."
                : "No tasks found with the selected filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((t) => {
              const isRevision = t.status === "changes_requested";
              const isInReview = t.status === "internal_review";
              const isApproved = ["approved", "done"].includes(t.status);

              return (
                <div
                  key={t.id}
                  className={`group relative rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                    isRevision
                      ? "bg-gradient-to-br from-[#241510] via-[#121626] to-[#121626] border-amber-500/50 hover:border-amber-400"
                      : isInReview
                      ? "bg-gradient-to-br from-[#101B2E] via-[#121626] to-[#121626] border-blue-500/50 hover:border-blue-400"
                      : isApproved
                      ? "bg-[#121626] border-emerald-500/40 hover:border-emerald-500/60"
                      : "bg-[#121626] border-white/10 hover:border-purple-500/50 hover:bg-[#151A2E] shadow-xl"
                  }`}
                >
                  {/* Card Top: Badges & Client */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getTaskTypeBadge(t.task_type)}
                        {getPriorityBadge(t.priority)}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        {t.due_date ? (
                          <span className={`inline-flex items-center gap-1 font-semibold ${
                            t.due_date < todayStr && !isApproved
                              ? "text-rose-400"
                              : t.due_date === todayStr && !isApproved
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{t.due_date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No deadline</span>
                        )}
                      </div>
                    </div>

                    {/* Client & Campaign Context */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>{t.client_name || "Client"}</span>
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[220px] text-slate-300">
                        {t.campaign_title || "Campaign"}
                      </span>
                    </div>

                    {/* Task Title */}
                    <Link
                      href={`/tasks/${t.id}`}
                      className="block text-base font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-1"
                    >
                      {t.title}
                    </Link>

                    {/* Context Note preview */}
                    {t.notes && (
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-[#0B0D14] p-2.5 rounded-xl border border-white/10 font-mono text-[11px]">
                        {t.notes.slice(0, 160)}...
                      </p>
                    )}

                    {/* Feedback / Status Alert Pill */}
                    {isRevision && (
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-300">Manager requested changes.</span> Click below to view review notes and resubmit your revised draft.
                        </div>
                      </div>
                    )}

                    {isInReview && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-950/80 border border-blue-500/40 text-blue-200 text-xs font-semibold">
                        <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Submitted for internal review. Awaiting manager approval.</span>
                      </div>
                    )}

                    {isApproved && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Approved internally. Ready for client review & scheduling.</span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Open Task Action */}
                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Status: <span className="text-slate-200 font-bold">{t.status.replace("_", " ")}</span>
                    </span>

                    <Link
                      href={`/tasks/${t.id}`}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                        isRevision
                          ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                          : isInReview
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
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
    </div>
  );
}
