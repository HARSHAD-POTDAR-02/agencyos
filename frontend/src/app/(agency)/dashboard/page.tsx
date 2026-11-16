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
  const router = useRouter();
  const { user, token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineView, setPipelineView] = useState<"deliverables" | "tasks">("deliverables");

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const fetchStats = useCallback(async () => {
    if (!token || !effectiveAgencyId || isSpecialist) return;
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
  }, [token, effectiveAgencyId, isSpecialist]);

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

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ──────────────────────────────────────────────
          Header & Primary Operational Actions
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30303D]/60">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#F2F0F7] tracking-tight">
            Agency Command Centre
          </h1>
          <p className="text-xs text-[#A3A0B0] mt-1">
            Real-time telemetry across clients, production pipeline, and deliverable SLAs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { setLoading(true); fetchStats(); }}
            title="Refresh dashboard metrics"
            className="inline-flex items-center gap-1.5 bg-[#17171E] hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#30303D] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#A78BFA]" : "text-[#6E6D7A]"}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 bg-[#17171E] hover:bg-[#20202A] text-[#F2F0F7] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#30303D] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#A3A0B0]" />
            <span>Add Client</span>
          </Link>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#A78BFA]/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Plan with AI</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[rgba(225,111,123,0.12)] border border-[#E16F7B]/30 text-[#E16F7B] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading live dashboard metrics: {error}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          4 Linear-Style Operational KPI Cards
      ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Clients */}
        <Link 
          href="/clients"
          className="bg-[#17171E] rounded-xl p-4 border border-[#30303D] hover:border-[#4A4A5A] hover:bg-[#1A1A22] transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#A78BFA] transition-colors">
              Active Clients
            </span>
            <div className="w-7 h-7 rounded-md bg-[#20202A] text-[#A3A0B0] group-hover:text-[#A78BFA] group-hover:bg-[rgba(167,139,250,0.12)] flex items-center justify-center transition-colors border border-[#30303D]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F2F0F7] tracking-tight tabular-nums">
              {loading ? "..." : (stats?.clients_active ?? 0)}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium text-[#45B88A] bg-[rgba(69,184,138,0.12)] px-1.5 py-0.5 rounded border border-[#45B88A]/20">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> View
            </span>
          </div>
          <p className="text-[11px] text-[#A3A0B0] mt-1.5">
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
          className="bg-[#17171E] rounded-xl p-4 border border-[#30303D] hover:border-[#4A4A5A] hover:bg-[#1A1A22] transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#69A9D8] transition-colors">
              Tasks Pending
            </span>
            <div className="w-7 h-7 rounded-md bg-[#20202A] text-[#A3A0B0] group-hover:text-[#69A9D8] group-hover:bg-[rgba(105,169,216,0.12)] flex items-center justify-center transition-colors border border-[#30303D]">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F2F0F7] tracking-tight tabular-nums">
              {loading ? "..." : (stats?.tasks_remaining ?? 0)}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium text-[#E5AA58] bg-[rgba(229,170,88,0.12)] px-1.5 py-0.5 rounded border border-[#E5AA58]/20">
              {loading ? "..." : `${stats?.tasks_high_priority ?? 0} urgent`}
            </span>
          </div>
          <p className="text-[11px] text-[#A3A0B0] mt-1.5">
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
          className="bg-[#17171E] rounded-xl p-4 border border-[#30303D] hover:border-[#4A4A5A] hover:bg-[#1A1A22] transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#45B88A] transition-colors">
              Deliverables Done
            </span>
            <div className="w-7 h-7 rounded-md bg-[#20202A] text-[#A3A0B0] group-hover:text-[#45B88A] group-hover:bg-[rgba(69,184,138,0.12)] flex items-center justify-center transition-colors border border-[#30303D]">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F2F0F7] tracking-tight tabular-nums">
              {loading ? "..." : `${stats?.deliverables_done ?? 0} / ${stats?.deliverables_total ?? 0}`}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium text-[#45B88A] bg-[rgba(69,184,138,0.12)] px-1.5 py-0.5 rounded border border-[#45B88A]/20">
              {deliverablePercent}%
            </span>
          </div>
          {/* Subtle Progress Bar */}
          <div className="w-full bg-[#20202A] rounded-full h-1 mt-2 overflow-hidden border border-[#30303D]/60">
            <div 
              className="bg-[#45B88A] h-1 rounded-full transition-all duration-500" 
              style={{ width: `${deliverablePercent}%` }}
            />
          </div>
        </Link>

        {/* Retainer Revenue */}
        <Link
          href="/clients"
          className="bg-[#17171E] rounded-xl p-4 border border-[#30303D] hover:border-[#4A4A5A] hover:bg-[#1A1A22] transition-all group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#A78BFA] transition-colors">
              Monthly Retainers
            </span>
            <div className="w-7 h-7 rounded-md bg-[#20202A] text-[#A3A0B0] group-hover:text-[#A78BFA] group-hover:bg-[rgba(167,139,250,0.12)] flex items-center justify-center transition-colors border border-[#30303D]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F2F0F7] tracking-tight tabular-nums">
              {loading ? "..." : formatCurrencyINR(stats?.total_monthly_retainer_inr ?? 0)}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium text-[#A78BFA] bg-[rgba(167,139,250,0.12)] px-1.5 py-0.5 rounded border border-[#A78BFA]/20">
              Contracts
            </span>
          </div>
          <p className="text-[11px] text-[#A3A0B0] mt-1.5">
            {loading ? (
              "Fetching contracts..."
            ) : (
              `${stats?.active_contracts_count ?? 0} active retainer contract${(stats?.active_contracts_count ?? 0) === 1 ? "" : "s"}`
            )}
          </p>
        </Link>
      </div>

      {/* ──────────────────────────────────────────────
          Middle: Production Pipeline & Upcoming Deadlines
      ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Pipeline Breakdown (2 cols) */}
        <div className="lg:col-span-2 bg-[#17171E] rounded-xl p-5 border border-[#30303D] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-[#30303D]/60">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#F2F0F7]">Production Pipeline Status</h2>
                  <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20">
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-[#A3A0B0] mt-0.5">
                  Actual progress breakdown across deliverables and team task queues.
                </p>
              </div>

              {/* Segment Toggle */}
              <div className="flex items-center gap-1 p-0.5 bg-[#101014] rounded-lg border border-[#30303D] text-xs font-medium">
                <button 
                  onClick={() => setPipelineView("deliverables")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs ${
                    pipelineView === "deliverables" 
                      ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]" 
                      : "text-[#6E6D7A] hover:text-[#A3A0B0]"
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5 text-[#45B88A]" />
                  Deliverables ({stats?.deliverables_total ?? 0})
                </button>
                <button 
                  onClick={() => setPipelineView("tasks")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs ${
                    pipelineView === "tasks" 
                      ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]" 
                      : "text-[#6E6D7A] hover:text-[#A3A0B0]"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#69A9D8]" />
                  Tasks ({stats?.tasks_total ?? 0})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-44 flex flex-col items-center justify-center text-[#A3A0B0] text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-[#A78BFA] mb-2" />
                <span>Aggregating production telemetry...</span>
              </div>
            ) : pipelineView === "deliverables" ? (
              /* Deliverables Pipeline Details */
              <div className="space-y-5">
                {/* Visual Status Segments Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#A3A0B0]">Deliverables SLA Completion</span>
                    <span className="text-[#45B88A] font-semibold tabular-nums">{deliverablePercent}% Done</span>
                  </div>
                  <div className="h-2 w-full bg-[#101014] rounded-full overflow-hidden flex border border-[#30303D]/60">
                    {/* Approved / Published */}
                    <div 
                      title={`Approved: ${stats?.deliverables_done ?? 0}`}
                      style={{ width: `${deliverablePercent}%` }} 
                      className="bg-[#45B88A] h-full transition-all duration-500"
                    />
                    {/* In Review */}
                    <div 
                      title={`Client / Internal Review: ${(stats?.deliverables_by_status?.client_review ?? 0) + (stats?.deliverables_by_status?.internal_review ?? 0)}`}
                      style={{ 
                        width: stats && stats.deliverables_total > 0 
                          ? `${Math.round((((stats.deliverables_by_status?.client_review ?? 0) + (stats.deliverables_by_status?.internal_review ?? 0) + (stats.deliverables_by_status?.changes_requested ?? 0)) / stats.deliverables_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-[#E5AA58] h-full transition-all duration-500"
                    />
                    {/* In Production */}
                    <div 
                      title={`In Production: ${stats?.deliverables_by_status?.in_production ?? 0}`}
                      style={{ 
                        width: stats && stats.deliverables_total > 0 
                          ? `${Math.round(((stats.deliverables_by_status?.in_production ?? 0) / stats.deliverables_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-[#A78BFA] h-full transition-all duration-500"
                    />
                  </div>
                </div>

                {/* Status Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Link 
                    href="/approvals"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#45B88A] transition-colors">
                      Approved / Live
                    </div>
                    <div className="text-lg font-bold text-[#45B88A] mt-1 tabular-nums">
                      {stats?.deliverables_done ?? 0}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Ready for release →</div>
                  </Link>

                  <Link 
                    href="/approvals"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#E5AA58] transition-colors">
                      In Review
                    </div>
                    <div className="text-lg font-bold text-[#E5AA58] mt-1 tabular-nums">
                      {(stats?.deliverables_by_status?.client_review ?? 0) + (stats?.deliverables_by_status?.changes_requested ?? 0)}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Awaiting sign-off →</div>
                  </Link>

                  <Link 
                    href="/campaigns"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#A78BFA] transition-colors">
                      In Production
                    </div>
                    <div className="text-lg font-bold text-[#A78BFA] mt-1 tabular-nums">
                      {(stats?.deliverables_by_status?.in_production ?? 0) + (stats?.deliverables_by_status?.internal_review ?? 0)}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Creative drafting →</div>
                  </Link>

                  <Link 
                    href="/campaigns"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#F2F0F7] transition-colors">
                      Not Started
                    </div>
                    <div className="text-lg font-bold text-[#F2F0F7] mt-1 tabular-nums">
                      {stats?.deliverables_by_status?.not_started ?? 0}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Sprint queue →</div>
                  </Link>
                </div>
              </div>
            ) : (
              /* Tasks Pipeline Details */
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#A3A0B0]">Tasks Resolved</span>
                    <span className="text-[#69A9D8] font-semibold tabular-nums">{tasksPercent}% Done</span>
                  </div>
                  <div className="h-2 w-full bg-[#101014] rounded-full overflow-hidden flex border border-[#30303D]/60">
                    <div 
                      title={`Completed / Approved: ${(stats?.tasks_total ?? 0) - (stats?.tasks_remaining ?? 0)}`}
                      style={{ width: `${tasksPercent}%` }} 
                      className="bg-[#45B88A] h-full transition-all duration-500"
                    />
                    <div 
                      title={`In Review: ${stats?.tasks_in_review ?? 0}`}
                      style={{ 
                        width: stats && stats.tasks_total > 0 
                          ? `${Math.round(((stats.tasks_in_review ?? 0) / stats.tasks_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-[#E5AA58] h-full transition-all duration-500"
                    />
                    <div 
                      title={`To-Do & In Progress: ${(stats?.tasks_todo ?? 0) + (stats?.tasks_by_status?.in_progress ?? 0)}`}
                      style={{ 
                        width: stats && stats.tasks_total > 0 
                          ? `${Math.round((((stats.tasks_todo ?? 0) + (stats.tasks_by_status?.in_progress ?? 0)) / stats.tasks_total) * 100)}%`
                          : "0%" 
                      }} 
                      className="bg-[#69A9D8] h-full transition-all duration-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Link 
                    href="/tasks"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#45B88A] transition-colors">
                      Done
                    </div>
                    <div className="text-lg font-bold text-[#45B88A] mt-1 tabular-nums">
                      {(stats?.tasks_by_status?.done ?? 0) + (stats?.tasks_by_status?.approved ?? 0)}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Completed items →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#69A9D8] transition-colors">
                      In Progress
                    </div>
                    <div className="text-lg font-bold text-[#69A9D8] mt-1 tabular-nums">
                      {stats?.tasks_by_status?.in_progress ?? 0}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Active execution →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#E5AA58] transition-colors">
                      Under Review
                    </div>
                    <div className="text-lg font-bold text-[#E5AA58] mt-1 tabular-nums">
                      {stats?.tasks_in_review ?? 0}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Quality check →</div>
                  </Link>

                  <Link 
                    href="/tasks"
                    className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#6E6D7A] uppercase tracking-wider group-hover:text-[#F2F0F7] transition-colors">
                      Backlog
                    </div>
                    <div className="text-lg font-bold text-[#F2F0F7] mt-1 tabular-nums">
                      {(stats?.tasks_todo ?? 0) + (stats?.tasks_by_status?.backlog ?? 0)}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Pending assignment →</div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#A3A0B0] pt-4 mt-5 border-t border-[#30303D]">
            <span>Synced automatically across active campaigns</span>
            <Link href="/approvals" className="text-[#A78BFA] hover:text-[#B69BFF] font-medium flex items-center gap-1 transition-colors">
              Review Pending Approvals <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Upcoming Deadlines Widget */}
        <div className="bg-[#17171E] rounded-xl p-5 border border-[#30303D] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30303D]/60">
              <h2 className="text-sm font-semibold text-[#F2F0F7]">Upcoming Deadlines</h2>
              <Link href="/tasks" className="text-xs font-medium text-[#A78BFA] hover:text-[#B69BFF] flex items-center gap-0.5 transition-colors">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-[#A3A0B0] text-xs">
                Checking task milestones...
              </div>
            ) : stats?.upcoming_deadlines && stats.upcoming_deadlines.length > 0 ? (
              <div className="space-y-2.5">
                {stats.upcoming_deadlines.map((deadline) => {
                  let badgeText = `Due in ${deadline.days_remaining}d`;
                  let badgeClass = "bg-[#20202A] text-[#69A9D8] border-[#30303D]";
                  if (deadline.days_remaining < 0) {
                    badgeText = "Overdue";
                    badgeClass = "bg-[rgba(225,111,123,0.12)] text-[#E16F7B] border-[#E16F7B]/30";
                  } else if (deadline.days_remaining === 0) {
                    badgeText = "Due Today";
                    badgeClass = "bg-[rgba(225,111,123,0.12)] text-[#E16F7B] border-[#E16F7B]/30";
                  } else if (deadline.days_remaining === 1) {
                    badgeText = "Due Tomorrow";
                    badgeClass = "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/30";
                  }

                  return (
                    <Link 
                      href="/tasks"
                      key={deadline.id}
                      className="p-3 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] transition-colors block cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#F2F0F7] line-clamp-1 group-hover:text-[#A78BFA] transition-colors">
                          {deadline.title}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded border uppercase shrink-0 ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#A3A0B0]">
                        <span>Client: {deadline.client_name}</span>
                        <span className="text-[#6E6D7A]">
                          {deadline.task_type || "Task"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* Clean Empty State */
              <div className="py-8 px-4 rounded-lg border border-dashed border-[#30303D] text-center flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-md bg-[#20202A] flex items-center justify-center text-[#6E6D7A] mb-2 border border-[#30303D]">
                  <Calendar className="w-4 h-4 text-[#A3A0B0]" />
                </div>
                <p className="text-xs font-medium text-[#F2F0F7]">No urgent deadlines</p>
                <p className="text-[11px] text-[#A3A0B0] mt-1 max-w-[200px]">
                  All tasks are either completed or don&apos;t have an impending due date.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#30303D]">
            <Link
              href="/tasks"
              className="w-full py-1.5 bg-[#20202A] hover:bg-[#262630] text-[#F2F0F7] text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-[#30303D]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Go to Task Board</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          Bottom Section: Recent Activity + AI Assistant
      ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed (2 cols) */}
        <div className="lg:col-span-2 bg-[#17171E] rounded-xl p-5 border border-[#30303D]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30303D]/60">
            <div>
              <h2 className="text-sm font-semibold text-[#F2F0F7]">Recent Activity</h2>
              <p className="text-xs text-[#A3A0B0] mt-0.5">Live operational event stream from team and portal</p>
            </div>
            <Link href="/approvals" className="text-xs font-medium text-[#A78BFA] hover:text-[#B69BFF] transition-colors">
              View Approvals
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#A3A0B0] text-xs">
              Loading recent activity stream...
            </div>
          ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
            <div className="space-y-1">
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
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#20202A] transition-colors group cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
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
                      <p className="text-[11px] text-[#A3A0B0] truncate">
                        {item.subtitle} • {formatRelativeTime(item.timestamp)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${
                      isApproved 
                        ? "bg-[rgba(69,184,138,0.12)] text-[#45B88A] border-[#45B88A]/20" 
                        : isReview 
                        ? "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/20" 
                        : "bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border-[#A78BFA]/20"
                    }`}>
                      {item.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-8 px-4 rounded-lg border border-dashed border-[#30303D] text-center">
              <p className="text-xs font-medium text-[#F2F0F7]">No recent activity recorded yet</p>
              <p className="text-[11px] text-[#A3A0B0] mt-1">
                Activity will appear here as deliverables, tasks, and client approvals progress.
              </p>
            </div>
          )}
        </div>

        {/* Compact AI Strategy Card (Raycast Contextual Style) */}
        <div className="rounded-xl bg-[#17171E] p-5 border border-[#30303D] relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(167,139,250,0.08)] rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20 text-[10px] font-medium uppercase tracking-wider mb-3">
              <Sparkles className="w-3 h-3 text-[#A78BFA]" />
              Campaign Studio
            </div>

            <h3 className="text-sm font-semibold text-[#F2F0F7] tracking-tight">
              AI Multi-Agent Campaign Strategist
            </h3>
            <p className="text-xs text-[#A3A0B0] mt-1.5 leading-relaxed">
              Synthesize client brand tone, market competition, and historical reel hooks with 6 autonomous agents.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-[#30303D]">
            <Link
              href="/campaigns"
              className="w-full py-2 px-3 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] border border-[#A78BFA]/30 font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Launch Campaign Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
