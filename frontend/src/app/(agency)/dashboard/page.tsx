"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Users, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles, 
  Clock, 
  ArrowRight,
  ChevronRight,
  Plus,
  Layers,
  FileCheck,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { agencyApi, DashboardStats } from "@/lib/api";

function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const hasTimezone = iso.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(iso);
  const normalized = hasTimezone ? iso : `${iso.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(iso) : d;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = parseDate(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatCurrencyINR(amount: number): string {
  if (!amount || amount === 0) return "₹0";
  if (amount >= 100000) {
    const inLakhs = amount / 100000;
    return `₹${inLakhs % 1 === 0 ? inLakhs.toFixed(0) : inLakhs.toFixed(1)}L`;
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const { user, token, activeAgencyId, agencies } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineView, setPipelineView] = useState<"deliverables" | "tasks">("deliverables");

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const fetchStats = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    try {
      const data = await agencyApi.dashboardStats(effectiveAgencyId, token);
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load dashboard stats:", err);
      setError(err?.message || "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => {
    setLoading(true);
    fetchStats();

    // Auto-poll every 30s
    const interval = setInterval(fetchStats, 30000);

    // Listen for custom agencyos badge & status updates
    const handleRefresh = () => fetchStats();
    window.addEventListener("agencyos:badge-refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("agencyos:badge-refresh", handleRefresh);
    };
  }, [fetchStats]);

  const deliverablePercent = stats && stats.deliverables_total > 0
    ? Math.round((stats.deliverables_done / stats.deliverables_total) * 100)
    : 0;

  const tasksPercent = stats && stats.tasks_total > 0
    ? Math.round(((stats.tasks_total - stats.tasks_remaining) / stats.tasks_total) * 100)
    : 0;

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, {user?.full_name?.split(" ")[0] || "there"}! 
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time operational metrics across your clients, tasks, and deliverable pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            title="Refresh dashboard data"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Client</span>
          </Link>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-purple-500/25 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Plan with AI</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>Error loading live dashboard metrics: {error}</span>
        </div>
      )}

      {/* 4 Essential KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Clients */}
        <Link 
          href="/clients"
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">Active Clients</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? "..." : (stats?.clients_active ?? 0)}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> View Clients
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {loading ? (
              "Loading clients..."
            ) : (
              `${stats?.clients_onboarding ?? 0} onboarding, ${stats?.clients_offboarded ?? 0} offboarded`
            )}
          </p>
        </Link>

        {/* Tasks Pending */}
        <Link
          href="/tasks"
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Tasks Pending</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? "..." : (stats?.tasks_remaining ?? 0)}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              {loading ? "..." : `${stats?.tasks_high_priority ?? 0} high priority`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {loading ? (
              "Calculating..."
            ) : (
              `${stats?.tasks_in_review ?? 0} in review, ${stats?.tasks_todo ?? 0} to-do`
            )}
          </p>
        </Link>

        {/* Deliverables Done */}
        <Link
          href="/approvals"
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Deliverables Done</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? "..." : `${stats?.deliverables_done ?? 0} / ${stats?.deliverables_total ?? 0}`}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {deliverablePercent}% complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-600 to-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${deliverablePercent}%` }}
            />
          </div>
        </Link>

        {/* Retainer Revenue */}
        <Link
          href="/clients"
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-violet-600 transition-colors">Monthly Retainers</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? "..." : formatCurrencyINR(stats?.total_monthly_retainer_inr ?? 0)}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Contracts
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {loading ? (
              "Fetching contracts..."
            ) : (
              `${stats?.active_contracts_count ?? 0} active retainer contract${(stats?.active_contracts_count ?? 0) === 1 ? "" : "s"}`
            )}
          </p>
        </Link>
      </div>

      {/* Main Section: Pipeline Production Overview + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Production Pipeline Breakdown (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Operations & Production Pipeline</h2>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Live Status
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actual progress breakdown of deliverables and task workflows across all active clients
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
                <button 
                  onClick={() => setPipelineView("deliverables")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    pipelineView === "deliverables" 
                      ? "bg-white text-purple-700 font-bold shadow-2xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Deliverables ({stats?.deliverables_total ?? 0})
                </button>
                <button 
                  onClick={() => setPipelineView("tasks")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    pipelineView === "tasks" 
                      ? "bg-white text-purple-700 font-bold shadow-2xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Tasks ({stats?.tasks_total ?? 0})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                <span>Aggregating production data...</span>
              </div>
            ) : pipelineView === "deliverables" ? (
              /* Deliverables Pipeline Details */
              <div className="space-y-6">
                {/* Visual Status Segments Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Production Completion</span>
                    <span className="text-purple-600 font-bold">{deliverablePercent}% Done</span>
                  </div>
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    {/* Approved / Published */}
                    <div 
                      title={`Approved: ${stats?.deliverables_done ?? 0}`}
                      style={{ width: `${deliverablePercent}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-500"
                    />
                    {/* In Review */}
                    <div 
                      title={`Client / Internal Review: ${(stats?.deliverables_by_status?.client_review ?? 0) + (stats?.deliverables_by_status?.internal_review ?? 0)}`}
                      style={{ 
                        width: stats && stats.deliverables_total > 0 
                          ? `${Math.round((((stats.deliverables_by_status?.client_review ?? 0) + (stats.deliverables_by_status?.internal_review ?? 0) + (stats.deliverables_by_status?.changes_requested ?? 0)) / stats.deliverables_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-amber-400 h-full transition-all duration-500"
                    />
                    {/* In Production */}
                    <div 
                      title={`In Production: ${stats?.deliverables_by_status?.in_production ?? 0}`}
                      style={{ 
                        width: stats && stats.deliverables_total > 0 
                          ? `${Math.round(((stats.deliverables_by_status?.in_production ?? 0) / stats.deliverables_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-purple-500 h-full transition-all duration-500"
                    />
                  </div>
                </div>

                {/* Status Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <Link 
                    href="/approvals"
                    className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider group-hover:text-emerald-900 transition-colors">Approved / Live</div>
                    <div className="text-xl font-extrabold text-emerald-950 mt-1">
                      {stats?.deliverables_done ?? 0}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">Ready for broadcast →</div>
                  </Link>

                  <Link 
                    href="/approvals"
                    className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider group-hover:text-amber-900 transition-colors">In Client Review</div>
                    <div className="text-xl font-extrabold text-amber-950 mt-1">
                      {(stats?.deliverables_by_status?.client_review ?? 0) + (stats?.deliverables_by_status?.changes_requested ?? 0)}
                    </div>
                    <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Awaiting portal signoff →</div>
                  </Link>

                  <Link 
                    href="/campaigns"
                    className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 hover:border-purple-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider group-hover:text-purple-900 transition-colors">In Production</div>
                    <div className="text-xl font-extrabold text-purple-950 mt-1">
                      {(stats?.deliverables_by_status?.in_production ?? 0) + (stats?.deliverables_by_status?.internal_review ?? 0)}
                    </div>
                    <div className="text-[10px] text-purple-600 mt-0.5 font-medium">Assets being created →</div>
                  </Link>

                  <Link 
                    href="/campaigns"
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-800 transition-colors">Not Started</div>
                    <div className="text-xl font-extrabold text-slate-800 mt-1">
                      {stats?.deliverables_by_status?.not_started ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Queued in campaign →</div>
                  </Link>
                </div>
              </div>
            ) : (
              /* Tasks Pipeline Details */
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-700">Tasks Completion</span>
                    <span className="text-purple-600 font-bold">{tasksPercent}% Resolved</span>
                  </div>
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      title={`Completed / Approved: ${(stats?.tasks_total ?? 0) - (stats?.tasks_remaining ?? 0)}`}
                      style={{ width: `${tasksPercent}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-500"
                    />
                    <div 
                      title={`In Review: ${stats?.tasks_in_review ?? 0}`}
                      style={{ 
                        width: stats && stats.tasks_total > 0 
                          ? `${Math.round(((stats.tasks_in_review ?? 0) / stats.tasks_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-amber-400 h-full transition-all duration-500"
                    />
                    <div 
                      title={`To-Do & In Progress: ${(stats?.tasks_todo ?? 0) + (stats?.tasks_by_status?.in_progress ?? 0)}`}
                      style={{ 
                        width: stats && stats.tasks_total > 0 
                          ? `${Math.round((((stats.tasks_todo ?? 0) + (stats.tasks_by_status?.in_progress ?? 0)) / stats.tasks_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-blue-500 h-full transition-all duration-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <Link 
                    href="/tasks"
                    className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider group-hover:text-emerald-900 transition-colors">Done & Approved</div>
                    <div className="text-xl font-extrabold text-emerald-950 mt-1">
                      {(stats?.tasks_by_status?.done ?? 0) + (stats?.tasks_by_status?.approved ?? 0)}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">Finished work items →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 hover:border-blue-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider group-hover:text-blue-900 transition-colors">In Progress</div>
                    <div className="text-xl font-extrabold text-blue-950 mt-1">
                      {stats?.tasks_by_status?.in_progress ?? 0}
                    </div>
                    <div className="text-[10px] text-blue-600 mt-0.5 font-medium">Actively working →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider group-hover:text-amber-900 transition-colors">Under Review</div>
                    <div className="text-xl font-extrabold text-amber-950 mt-1">
                      {stats?.tasks_in_review ?? 0}
                    </div>
                    <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Internal & client checks →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5 transition-all block cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-800 transition-colors">To-Do / Backlog</div>
                    <div className="text-xl font-extrabold text-slate-800 mt-1">
                      {(stats?.tasks_todo ?? 0) + (stats?.tasks_by_status?.backlog ?? 0)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Awaiting execution →</div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-4 mt-6 border-t border-slate-100">
            <span>Production status synced across all campaigns</span>
            <Link href="/approvals" className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1">
              Review Pending Approvals <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Upcoming Deadlines Widget */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Upcoming Deadlines</h2>
              <Link href="/tasks" className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Checking task deadlines...
              </div>
            ) : stats?.upcoming_deadlines && stats.upcoming_deadlines.length > 0 ? (
              <div className="space-y-3.5">
                {stats.upcoming_deadlines.map((deadline) => {
                  let badgeText = `Due in ${deadline.days_remaining}d`;
                  let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                  if (deadline.days_remaining < 0) {
                    badgeText = "Overdue";
                    badgeClass = "bg-rose-50 text-rose-600 border-rose-200";
                  } else if (deadline.days_remaining === 0) {
                    badgeText = "Due Today";
                    badgeClass = "bg-rose-50 text-rose-600 border-rose-200";
                  } else if (deadline.days_remaining === 1) {
                    badgeText = "Due Tomorrow";
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  return (
                    <Link 
                      href="/tasks"
                      key={deadline.id}
                      className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 hover:border-slate-300 hover:shadow-2xs transition-all border border-slate-100 block cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-purple-700 transition-colors">
                          {deadline.title}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase shrink-0 ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Client: {deadline.client_name}</span>
                        <span className="font-semibold text-slate-600">
                          {deadline.task_type || "Task"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* Clean Empty State */
              <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-700">No upcoming deadlines scheduled</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  All active tasks are either completed or don&apos;t have a scheduled due date.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
              href="/tasks"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Go to Task Kanban Board</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity + AI Assistant Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Agency Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Live updates from your team and client portal</p>
            </div>
            <Link href="/approvals" className="text-xs font-bold text-purple-600 hover:text-purple-700">
              View Approvals
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Loading recent activity...
            </div>
          ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_activity.map((item) => {
                const isApproved = item.status.toLowerCase().includes("approved") || item.status.toLowerCase().includes("done");
                const isReview = item.status.toLowerCase().includes("review");
                const linkHref = 
                  item.kind === "task_update" 
                    ? "/tasks" 
                    : item.kind === "client_created" 
                    ? "/clients" 
                    : "/approvals";

                return (
                  <Link 
                    href={linkHref}
                    key={item.id} 
                    className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100 last:border-b-0 last:pb-0 hover:bg-slate-50/80 -mx-2 px-2 py-1.5 rounded-xl transition-all group cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform ${
                      isApproved 
                        ? "bg-emerald-50 text-emerald-600" 
                        : isReview 
                        ? "bg-amber-50 text-amber-600" 
                        : "bg-purple-50 text-purple-600"
                    }`}>
                      {isApproved ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isReview ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.subtitle} • {formatRelativeTime(item.timestamp)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      isApproved 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : isReview 
                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {item.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-700">No recent activity recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Activity will appear here as deliverables, tasks, and client approvals progress.
              </p>
            </div>
          )}
        </div>

        {/* AI Copilot Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0B0D14] via-[#121526] to-[#1E1538] text-white p-6 border border-purple-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3 h-3 text-purple-400" />
              AI Agent Orchestrator
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              Plan Next Month&apos;s Campaign in Seconds
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Ground your campaign strategy in verified client brand tone, contract quotas, and viral reel hooks without guessing.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
            <Link
              href="/campaigns"
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/40 flex items-center justify-center gap-2 transition-all"
            >
              <span>Launch AI Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
