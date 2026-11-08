"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { taskApi, clientApi } from "@/lib/api";
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
} from "lucide-react";

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
    color: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    statuses: ["backlog"],
  },
  {
    id: "todo",
    title: "To Do / Scripting",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    statuses: ["todo"],
  },
  {
    id: "in_progress",
    title: "In Production / Editing",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    statuses: ["in_progress"],
  },
  {
    id: "review",
    title: "Review & Approvals",
    color: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    statuses: ["internal_review", "client_review", "changes_requested"],
  },
  {
    id: "done",
    title: "Done / Approved",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    statuses: ["approved", "done"],
  },
];

function TasksContent() {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load clients and tasks
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

      // 2. Fetch all agency tasks (up to 200)
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
      const updated = (await taskApi.update(
        effectiveAgencyId,
        taskId,
        { status: newStatus },
        token
      )) as Task;

      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update task status." });
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <PenTool className="w-3 h-3 text-purple-600" />
            <span>Scripting</span>
          </span>
        );
      case "filming":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Film className="w-3 h-3 text-blue-600" />
            <span>Shooting</span>
          </span>
        );
      case "editing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            <Scissors className="w-3 h-3 text-amber-600" />
            <span>Editing</span>
          </span>
        );
      case "approval":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Review</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
            {type || "General"}
          </span>
        );
    }
  };

  const getPriorityBadge = (p: Task["priority"]) => {
    switch (p) {
      case "urgent":
        return <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">URGENT</span>;
      case "high":
        return <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">HIGH</span>;
      case "medium":
        return <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">MED</span>;
      default:
        return <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">LOW</span>;
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
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Kanban className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Production Tasks & Kanban Pipeline</h1>
          </div>
          <p className="text-xs text-slate-500">
            Actionable breakdown of all monthly deliverables across Scripting, Footage Prep, Video Editing, and Approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Generate Next Sprint ✨</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Remaining</span>
            <span className="text-[10px] font-semibold text-slate-400">{totalCount} total</span>
          </div>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{remainingCount}</span>
        </div>
        <div className="bg-white rounded-2xl border border-purple-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-purple-50/30">
          <span className="text-[11px] font-bold text-purple-600 block uppercase tracking-wider">Ready to Script</span>
          <span className="text-xl font-black text-purple-700 mt-0.5 block">{todoCount}</span>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
          <span className="text-[11px] font-bold text-amber-700 block uppercase tracking-wider">In Production</span>
          <span className="text-xl font-black text-amber-800 mt-0.5 block">{inProgressCount}</span>
        </div>
        <div className="bg-white rounded-2xl border border-blue-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-blue-50/30">
          <span className="text-[11px] font-bold text-blue-700 block uppercase tracking-wider">In Review</span>
          <span className="text-xl font-black text-blue-800 mt-0.5 block">{reviewCount}</span>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
          <span className="text-[11px] font-bold text-emerald-700 block uppercase tracking-wider">Done & Approved</span>
          <span className="text-xl font-black text-emerald-700 mt-0.5 block">{doneCount}</span>
        </div>
      </div>

      {/* Filter and View Toggles Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by reel or task name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {["all", "scripting", "filming", "editing", "approval"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  selectedStage === st
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
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
              className="bg-slate-50 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none"
            >
              <option value="all">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View Switcher: Kanban vs List */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === "kanban" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === "list" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
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
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center text-sm font-semibold text-slate-400">Loading production pipeline...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-purple-50/50">
            <Kanban className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No tasks in pipeline</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            Tasks are automatically generated when you approve a 30-day AI campaign sprint.
          </p>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Open Campaign Planner &rarr;</span>
          </Link>
        </div>
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => col.statuses.includes(t.status));
            return (
              <div key={col.id} className="bg-slate-100/70 rounded-2xl p-3 border border-slate-200/60 min-h-[500px] flex flex-col">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3 className="text-xs font-bold text-slate-800">{col.title}</h3>
                  </div>
                  <span className="text-[11px] font-black text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-2xs">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-10 text-[11px] font-medium text-slate-400">
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          {getStageBadge(t.task_type)}
                          {getPriorityBadge(t.priority)}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                          {t.title}
                        </h4>

                        {t.deliverable_id && (
                          <Link
                            href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline pt-0.5"
                          >
                            <Film className="w-3 h-3" />
                            <span>Media & Versions &rarr;</span>
                          </Link>
                        )}

                        {/* Status Transition Selector */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">Move stage:</span>
                          <select
                            value={t.status}
                            disabled={updatingTaskId === t.id}
                            onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                            className="text-[10px] font-bold bg-slate-50 text-slate-700 px-2 py-1 rounded-md border border-slate-200 focus:outline-none focus:border-purple-600"
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
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Transition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block">{t.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400">ID: {t.id.slice(0, 8)}</span>
                      {t.deliverable_id && (
                        <Link
                          href={`/deliverables/${t.deliverable_id}?task_id=${t.id}&from=tasks`}
                          className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline inline-flex items-center gap-1"
                        >
                          <Film className="w-2.5 h-2.5" /> Media &rarr;
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">{getStageBadge(t.task_type)}</td>
                  <td className="py-3 px-4">{getPriorityBadge(t.priority)}</td>
                  <td className="py-3 px-4">
                    <span className="capitalize font-bold text-slate-700">{t.status.replace("_", " ")}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={t.status}
                      disabled={updatingTaskId === t.id}
                      onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                      className="text-xs font-bold bg-slate-50 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200"
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading task pipeline...</div>}>
      <TasksContent />
    </Suspense>
  );
}
