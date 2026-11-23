"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  AlertCircle,
  Film,
  PenTool,
  Scissors,
  CheckSquare,
  Activity,
  Zap,
  Filter
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { agencyApi, taskApi, clientApi, DashboardStats } from "@/lib/api";

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
  const router = useRouter();
  const { user, token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, string>>({});
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [tasksLoading, setTasksLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "review" | "in_progress" | "done">("all");

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const fetchStats = useCallback(async () => {
    if (!token || !effectiveAgencyId || isSpecialist) return;
    try {
      const [statsData, taskList, membersList, clientsList] = await Promise.all([
        agencyApi.dashboardStats(effectiveAgencyId, token),
        taskApi.list(effectiveAgencyId, token, { limit: 25 }),
        agencyApi.listMembers(effectiveAgencyId, token).catch(() => []),
        clientApi.list(effectiveAgencyId, token).catch(() => []),
      ]);
      setStats(statsData);
      setTasks(taskList || []);
      
      const mObj: Record<string, string> = {};
      if (Array.isArray(membersList)) {
        membersList.forEach((m: any) => {
          mObj[m.user_id] = m.user_full_name || m.user_email?.split("@")[0] || "Specialist";
        });
      }
      setMembersMap(mObj);

      const cObj: Record<string, string> = {};
      if (Array.isArray(clientsList)) {
        clientsList.forEach((c: any) => {
          cObj[c.id] = c.business_name;
        });
      }
      setClientsMap(cObj);

      setError(null);
    } catch (err: any) {
      console.error("Failed to load dashboard stats:", err);
      setError(err?.message || "Could not load dashboard data");
    } finally {
      setLoading(false);
      setTasksLoading(false);
    }
  }, [token, effectiveAgencyId, isSpecialist]);

  useEffect(() => {
    setLoading(true);
    fetchStats();

    const interval = setInterval(fetchStats, 30000);
    const handleRefresh = () => fetchStats();
    window.addEventListener("agencyos:badge-refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("agencyos:badge-refresh", handleRefresh);
    };
  }, [fetchStats]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setLoading(true);
        fetchStats();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        router.push("/clients");
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        router.push("/campaigns");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fetchStats, router]);

  const deliverablePercent = stats && stats.deliverables_total > 0
    ? Math.round((stats.deliverables_done / stats.deliverables_total) * 100)
    : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "all") return true;
    if (taskFilter === "review") return t.status === "client_review" || t.status === "internal_review" || t.status === "changes_requested";
    if (taskFilter === "in_progress") return t.status === "in_progress" || t.status === "todo";
    if (taskFilter === "done") return t.status === "done" || t.status === "approved";
    return true;
  });

  // Calculate real-time counts for filter tabs
  const allTasksCount = tasks.length;
  const reviewTasksCount = tasks.filter((t) => t.status === "client_review" || t.status === "internal_review" || t.status === "changes_requested").length;
  const inProgressTasksCount = tasks.filter((t) => t.status === "in_progress" || t.status === "todo").length;
  const doneTasksCount = tasks.filter((t) => t.status === "done" || t.status === "approved").length;

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ──────────────────────────────────────────────
          1. Operational Header & Quick Action Dock
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider mb-1">
            <span>AgencyOS</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] animate-pulse inline-block" />
              Live Operations
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#191919] dark:text-white" />
            <span>Agency Command Centre</span>
          </h1>
          <p className="text-xs text-[#A3A0B0] mt-0.5">
            Operational telemetry across client retainers, deliverable velocity, and specialist pipelines.
          </p>
        </div>

        {/* Action Command Bar with Keyboard Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            title="Sync live metrics (R)"
            className="surface-card surface-card-hover text-[#A3A0B0] hover:text-[#F2F0F7] text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`} />
            <span className="hidden sm:inline">Sync</span>
            <span className="kbd-pill hidden md:inline-flex">R</span>
          </button>

          <Link
            href="/clients"
            className="surface-card surface-card-hover text-[#F2F0F7] text-xs font-medium px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <Plus className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>New Client</span>
            <span className="kbd-pill hidden md:inline-flex">C</span>
          </Link>

          <Link
            href="/campaigns"
            className="bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] hover:shadow-[0_2px_14px_rgba(167,139,250,0.45)] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
            <span>Plan with AI</span>
            <span className="kbd-pill text-[9px] bg-[#101014]/20 text-[#101014] border-black/20 hidden sm:inline-flex">⌘P</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[rgba(225,111,123,0.12)] border border-[#E16F7B]/30 text-[#E16F7B] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading live dashboard metrics: {error}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          2. Linear Coherent Telemetry Strip
             Single unified surface with hairline dividers
      ────────────────────────────────────────────── */}
      <div className="surface-card rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] divide-y sm:divide-y-0 sm:divide-x divide-[#E5E5E2] dark:divide-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        {/* Metric 1: Active Retainers */}
        <Link 
          href="/clients"
          className="p-4.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.025] transition-all duration-150 block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] group-hover:text-[#2383E2] dark:group-hover:text-[#A78BFA] transition-colors flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA]" />
              Active Retainers
            </span>
            <span className="text-[9px] font-mono text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 dark:text-[#45B88A] dark:bg-[rgba(69,184,138,0.12)] px-1.5 py-0.5 rounded font-semibold">
              100% SLA
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-semibold text-[#191919] dark:text-[#F2F0F7] tracking-tight tabular-nums font-mono">
              {loading ? "—" : (stats?.clients_active ?? 0)}
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">Accounts</span>
          </div>
          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1.5 truncate">
            {loading ? "Loading clients..." : `${stats?.clients_onboarding ?? 0} onboarding · ${stats?.clients_offboarded ?? 0} offboarded`}
          </p>
        </Link>

        {/* Metric 2: Production Pipeline */}
        <Link
          href="/tasks"
          className="p-4.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.025] transition-all duration-150 block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] group-hover:text-[#0B6E99] dark:group-hover:text-[#69A9D8] transition-colors flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0B6E99] dark:text-[#69A9D8]" />
              Production Pipeline
            </span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold border ${
              (stats?.tasks_high_priority ?? 0) > 0 
                ? "text-rose-700 bg-rose-500/10 border-rose-500/30 dark:text-[#E16F7B] dark:bg-[rgba(225,111,123,0.12)]" 
                : "text-emerald-700 bg-emerald-500/10 border-emerald-500/25 dark:text-[#45B88A] dark:bg-[rgba(69,184,138,0.12)]"
            }`}>
              {loading ? "—" : `${stats?.tasks_high_priority ?? 0} Urgent`}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-semibold text-[#191919] dark:text-[#F2F0F7] tracking-tight tabular-nums font-mono">
              {loading ? "—" : (stats?.tasks_remaining ?? 0)}
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">Active tasks</span>
          </div>
          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1.5 truncate">
            {loading ? "Calculating..." : `${stats?.tasks_in_review ?? 0} in review · ${stats?.tasks_todo ?? 0} backlog`}
          </p>
        </Link>

        {/* Metric 3: Pending Approvals */}
        <Link
          href="/approvals"
          className="p-4.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.025] transition-all duration-150 block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] group-hover:text-[#D97706] dark:group-hover:text-[#E5AA58] transition-colors flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#D97706] dark:text-[#E5AA58]" />
              Review Queue
            </span>
            <span className="text-[9px] font-mono text-[#191919] bg-black/[0.06] border border-black/[0.08] dark:text-[#A78BFA] dark:bg-[rgba(167,139,250,0.12)] dark:border-[#A78BFA]/25 px-1.5 py-0.5 rounded font-semibold">
              Quality Gate
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-semibold text-[#191919] dark:text-[#F2F0F7] tracking-tight tabular-nums font-mono">
              {loading ? "—" : ((stats?.deliverables_by_status?.client_review ?? 0) + (stats?.deliverables_by_status?.internal_review ?? 0) + (stats?.deliverables_by_status?.changes_requested ?? 0))}
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">In review</span>
          </div>
          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1.5 truncate">
            {loading ? "Loading queue..." : `${stats?.deliverables_by_status?.changes_requested ?? 0} changes requested · ${stats?.deliverables_by_status?.client_review ?? 0} client sign-off`}
          </p>
        </Link>

        {/* Metric 4: Scheduled Releases & MRR */}
        <Link
          href="/reports"
          className="p-4.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.025] transition-all duration-150 block group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] group-hover:text-[#0F7B6C] dark:group-hover:text-[#45B88A] transition-colors flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#0F7B6C] dark:text-[#45B88A]" />
              Monthly Delivery
            </span>
            <span className="text-[9px] font-mono text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 dark:text-[#45B88A] dark:bg-[rgba(69,184,138,0.12)] px-1.5 py-0.5 rounded font-semibold">
              {deliverablePercent}% Target
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-semibold text-[#191919] dark:text-[#F2F0F7] tracking-tight tabular-nums font-mono">
              {loading ? "—" : `${stats?.deliverables_done ?? 0}/${stats?.deliverables_total ?? 0}`}
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">Delivered</span>
          </div>
          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1.5 truncate font-mono">
            {loading ? "Fetching MRR..." : `${formatCurrencyINR(stats?.total_monthly_retainer_inr ?? 0)}/mo contracted`}
          </p>
        </Link>
      </div>

      {/* ──────────────────────────────────────────────
          3. Dual-Pane Operational Matrix
             Left: Linear Production Pipeline (Hero)
             Right: Deadlines Radar & Audit Streams (Secondary)
      ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── PRIMARY OPERATIONAL HERO: Linear Production Pipeline (8 cols) ── */}
        <div className="lg:col-span-8 space-y-6">
          <div className="surface-card rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-white/[0.08]">
            {/* Table Header Controls */}
            <div className="p-4 md:px-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-sm font-semibold text-[#F2F0F7] tracking-tight">
                    Production Pipeline
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-white/[0.04] text-[#A78BFA] border border-white/[0.08] inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
                    Live Flow
                  </span>
                </div>
                <p className="text-xs text-[#A3A0B0] mt-0.5">
                  Real-time deliverable velocity across assignees, production gates, and priority SLAs.
                </p>
              </div>

              {/* Segmented Filter Pills with live counts */}
              <div className="flex items-center p-0.5 bg-[#101014] rounded-xl border border-white/[0.08] text-xs font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setTaskFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    taskFilter === "all" 
                      ? "bg-[#20202A] text-[#F2F0F7] shadow-xs font-semibold border border-white/[0.08]" 
                      : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                  }`}
                >
                  <span>All</span>
                  <span className="font-mono text-[10px] text-[#A3A0B0]">{allTasksCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("review")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    taskFilter === "review" 
                      ? "bg-[#20202A] text-[#F2F0F7] shadow-xs font-semibold border border-white/[0.08]" 
                      : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                  }`}
                >
                  <span>Review</span>
                  <span className="font-mono text-[10px] text-[#E5AA58]">{reviewTasksCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("in_progress")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    taskFilter === "in_progress" 
                      ? "bg-[#20202A] text-[#F2F0F7] shadow-xs font-semibold border border-white/[0.08]" 
                      : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                  }`}
                >
                  <span>Active</span>
                  <span className="font-mono text-[10px] text-[#69A9D8]">{inProgressTasksCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter("done")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    taskFilter === "done" 
                      ? "bg-[#20202A] text-[#F2F0F7] shadow-xs font-semibold border border-white/[0.08]" 
                      : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                  }`}
                >
                  <span>Done</span>
                  <span className="font-mono text-[10px] text-[#45B88A]">{doneTasksCount}</span>
                </button>
              </div>
            </div>

            {/* Structured Table */}
            {tasksLoading ? (
              <div className="h-48 flex flex-col items-center justify-center text-[#A3A0B0] text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-[#A78BFA] mb-2" />
                <span>Loading active production pipeline...</span>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#A3A0B0] space-y-2">
                <CheckSquare className="w-8 h-8 mx-auto text-[#A3A0B0]/40 mb-1" />
                <p className="font-semibold text-[#F2F0F7] text-sm">No tasks matching this filter</p>
                <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
                  All deliverables in this category are completed or currently unassigned.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.08] dark:border-white/[0.08] bg-[#F7F6F3] dark:bg-[#121217]/90 text-[#6B6A65] dark:text-[#A3A0B0] text-[10.5px] font-mono uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">Deliverable / Task</th>
                      <th className="py-2.5 px-4 font-semibold">Client</th>
                      <th className="py-2.5 px-4 font-semibold">Assignee</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Priority</th>
                      <th className="py-2.5 px-4 font-semibold">Due</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.08] dark:divide-white/[0.05]">
                    {filteredTasks.slice(0, 10).map((t) => {
                      const isDone = t.status === "done" || t.status === "approved";
                      const isReview = t.status === "client_review" || t.status === "internal_review" || t.status === "changes_requested";
                      const isChanges = t.status === "changes_requested";
                      const isUrgent = t.priority === "urgent" || t.priority === "high";

                      return (
                        <tr 
                          key={t.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.035] transition-colors group cursor-pointer h-10"
                        >
                          {/* Task / Deliverable Title */}
                          <td className="py-2.5 px-4">
                            <Link href={`/tasks/${t.id}`} className="flex items-center gap-2.5 min-w-0">
                              {t.task_type === "video_editing" ? (
                                <Film className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA] shrink-0" />
                              ) : t.task_type === "scriptwriting" ? (
                                <PenTool className="w-3.5 h-3.5 text-[#0B6E99] dark:text-[#69A9D8] shrink-0" />
                              ) : (
                                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-[#45B88A] shrink-0" />
                              )}
                              <span className="font-medium text-[#191919] dark:text-[#F2F0F7] group-hover:text-[#2383E2] dark:group-hover:text-[#A78BFA] transition-colors truncate max-w-[200px] sm:max-w-[260px]">
                                {t.title}
                              </span>
                            </Link>
                          </td>

                          {/* Client */}
                          <td className="py-2.5 px-4 text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] truncate max-w-[120px]">
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <span className="w-3.5 h-3.5 rounded bg-black/[0.06] dark:bg-white/[0.06] text-[9px] font-mono font-semibold flex items-center justify-center shrink-0 text-[#191919] dark:text-[#F2F0F7]">
                                {(clientsMap[t.client_id] || "C").charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate">{clientsMap[t.client_id] || "Client Account"}</span>
                            </span>
                          </td>

                          {/* Assignee */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#262630] to-[#17171E] border border-white/[0.1] text-[#F2F0F7] font-mono text-[9px] font-semibold flex items-center justify-center shrink-0 shadow-inner">
                                {t.assignee_id ? (membersMap[t.assignee_id]?.charAt(0).toUpperCase() || "S") : "—"}
                              </span>
                              <span className="text-[11px] text-[#A3A0B0] truncate max-w-[80px]">
                                {t.assignee_id ? (membersMap[t.assignee_id] || "Assigned") : "Unassigned"}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                              {isDone ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] shrink-0" />
                              ) : isChanges ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E16F7B] shrink-0" />
                              ) : isReview ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E5AA58] shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] shrink-0" />
                              )}
                              <span className={isDone ? "text-[#45B88A]" : isChanges ? "text-[#E16F7B]" : isReview ? "text-[#E5AA58]" : "text-[#A78BFA]"}>
                                {t.status.replace(/_/g, " ")}
                              </span>
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="py-2.5 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase font-semibold border ${
                              t.priority === "urgent"
                                ? "bg-[rgba(225,111,123,0.12)] text-[#E16F7B] border-[#E16F7B]/30"
                                : t.priority === "high"
                                ? "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/30"
                                : "bg-white/[0.04] text-[#A3A0B0] border-white/[0.08]"
                            }`}>
                              {t.priority}
                            </span>
                          </td>

                          {/* Due Date */}
                          <td className="py-2.5 px-4 text-[11px] font-mono text-[#A3A0B0] whitespace-nowrap">
                            {t.due_date ? formatRelativeTime(t.due_date) : "No SLA"}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-4 text-right">
                            <Link
                              href={`/tasks/${t.id}`}
                              className="p-1 rounded-md hover:bg-white/[0.08] text-[#A3A0B0] group-hover:text-[#A78BFA] transition-colors inline-block group-hover:translate-x-0.5"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer summary bar */}
            <div className="p-3 px-5 border-t border-white/[0.06] bg-[#121217]/50 flex items-center justify-between text-xs text-[#A3A0B0]">
              <span className="font-mono text-[11px]">
                Showing {Math.min(10, filteredTasks.length)} of {filteredTasks.length} active deliverables
              </span>
              <Link 
                href="/tasks" 
                className="font-medium text-[#A78BFA] hover:text-[#B69BFF] flex items-center gap-1 transition-colors text-xs"
              >
                <span>View Complete Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── CONTEXTUAL SECONDARY PANE: Deadlines Radar & Audit (4 cols) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming Deadlines Radar */}
          <div className="surface-card rounded-2xl p-5 space-y-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-white/[0.08]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h2 className="font-heading text-sm font-semibold text-[#F2F0F7] tracking-tight">Deadlines Radar</h2>
                <p className="text-[11px] text-[#A3A0B0]">Next 48h critical deliverables</p>
              </div>
              <Link href="/tasks" className="text-xs font-mono text-[#A78BFA] hover:text-[#B69BFF] flex items-center gap-0.5 transition-colors">
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-[#A3A0B0] text-xs">
                Scanning milestone dates...
              </div>
            ) : stats?.upcoming_deadlines && stats.upcoming_deadlines.length > 0 ? (
              <div className="space-y-2">
                {stats.upcoming_deadlines.map((deadline) => {
                  let badgeText = `${deadline.days_remaining}d rem`;
                  let badgeClass = "bg-white/[0.04] text-[#69A9D8] border-white/[0.08]";
                  let borderStyle = "border-l-2 border-l-[#69A9D8]";

                  if (deadline.days_remaining < 0) {
                    badgeText = "Overdue";
                    badgeClass = "bg-[rgba(225,111,123,0.12)] text-[#E16F7B] border-[#E16F7B]/30";
                    borderStyle = "border-l-2 border-l-[#E16F7B] bg-[rgba(225,111,123,0.05)]";
                  } else if (deadline.days_remaining === 0) {
                    badgeText = "Today";
                    badgeClass = "bg-[rgba(225,111,123,0.12)] text-[#E16F7B] border-[#E16F7B]/30";
                    borderStyle = "border-l-2 border-l-[#E16F7B]";
                  } else if (deadline.days_remaining === 1) {
                    badgeText = "Tomorrow";
                    badgeClass = "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/30";
                    borderStyle = "border-l-2 border-l-[#E5AA58]";
                  }

                  return (
                    <Link 
                      href="/tasks"
                      key={deadline.id}
                      className={`p-3 rounded-xl bg-[#101014] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-colors block cursor-pointer group ${borderStyle}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-[#F2F0F7] truncate group-hover:text-[#A78BFA] transition-colors">
                          {deadline.title}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border uppercase shrink-0 font-semibold ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#A3A0B0]">
                        <span className="truncate">{deadline.client_name}</span>
                        <span className="text-[10px] font-mono text-[#A3A0B0] shrink-0">
                          {deadline.task_type || "Task"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-3 rounded-xl border border-dashed border-white/[0.08] text-center">
                <Calendar className="w-5 h-5 text-[#A3A0B0] mx-auto mb-1.5" />
                <p className="text-xs font-medium text-[#F2F0F7]">All Milestones on Schedule</p>
                <p className="text-[11px] text-[#A3A0B0] mt-0.5">
                  No overdue tasks or imminent SLA breaches detected.
                </p>
              </div>
            )}
          </div>

          {/* Operational Audit Stream */}
          <div className="surface-card rounded-2xl p-5 space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-white/[0.08]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h2 className="font-heading text-sm font-semibold text-[#F2F0F7] tracking-tight">Operational Audit Feed</h2>
                <p className="text-xs text-[#A3A0B0] mt-0.5">Continuous event log from specialist workflows.</p>
              </div>
              <Link href="/approvals" className="text-xs font-mono text-[#A78BFA] hover:text-[#B69BFF] transition-colors flex items-center gap-1">
                <span>All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-[#A3A0B0] text-xs">
                Syncing audit stream...
              </div>
            ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {stats.recent_activity.slice(0, 5).map((item) => {
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
                      className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/[0.035] transition-colors group cursor-pointer"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-xs shadow-inner ${
                        isApproved 
                          ? "bg-[rgba(69,184,138,0.12)] text-[#45B88A] border-[#45B88A]/20" 
                          : isReview 
                          ? "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/20" 
                          : "bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border-[#A78BFA]/20"
                      }`}>
                        {isApproved ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isReview ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#F2F0F7] truncate group-hover:text-[#A78BFA] transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-[#A3A0B0] truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-[#A3A0B0]">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-3 rounded-xl border border-dashed border-white/[0.08] text-center">
                <p className="text-xs font-medium text-[#F2F0F7]">No recent activity</p>
                <p className="text-[11px] text-[#A3A0B0] mt-0.5">Telemetry logs stream as tasks progress.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
