"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { clientApi, publishingApi, MonthlyReport } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  Calendar,
  Building2,
  ExternalLink,
  Printer,
  RefreshCw,
  Copy,
  Check,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Share2,
} from "lucide-react";

interface ClientOption {
  id: string;
  business_name: string;
  industry?: string | null;
  status?: string;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function ReportsContent() {
  const router = useRouter();
  const { token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>(
    searchParams.get("clientId") || ""
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    parseInt(searchParams.get("month") || "") || currentMonth
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    parseInt(searchParams.get("year") || "") || currentYear
  );

  // Sync when searchParams change or custom period event is fired
  useEffect(() => {
    const m = parseInt(searchParams.get("month") || "");
    const y = parseInt(searchParams.get("year") || "");
    if (m && !isNaN(m)) setSelectedMonth(m);
    if (y && !isNaN(y)) setSelectedYear(y);
  }, [searchParams]);

  useEffect(() => {
    const handlePeriodChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ month: number; year: number }>;
      if (customEvent.detail) {
        setSelectedMonth(customEvent.detail.month);
        setSelectedYear(customEvent.detail.year);
      }
    };
    window.addEventListener("agencyos:period-change", handlePeriodChange);
    return () => window.removeEventListener("agencyos:period-change", handlePeriodChange);
  }, []);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Load clients list for the active agency
  useEffect(() => {
    async function fetchClients() {
      if (!token || !effectiveAgencyId) return;
      try {
        setLoadingClients(true);
        const res = (await clientApi.list(effectiveAgencyId, token)) as ClientOption[];
        setClients(res || []);
        if (res && res.length > 0 && !selectedClientId) {
          // Preselect first client or query param match
          const matched = searchParams.get("clientId");
          const defaultClient = matched && res.some((c) => c.id === matched) ? matched : res[0].id;
          setSelectedClientId(defaultClient);
        }
      } catch (err: unknown) {
        console.error("Failed to load clients:", err);
      } finally {
        setLoadingClients(false);
      }
    }
    fetchClients();
  }, [token, effectiveAgencyId, selectedClientId, searchParams]);

  // Load Monthly Performance Report
  const loadReport = useCallback(
    async (silent = false) => {
      if (!token || !effectiveAgencyId || !selectedClientId) return;
      if (!silent) setLoadingReport(true);
      setReportError(null);
      try {
        const data = await publishingApi.monthlyReport(
          effectiveAgencyId,
          selectedClientId,
          token,
          selectedMonth,
          selectedYear
        );
        setReport(data);
      } catch (err: unknown) {
        setReportError(err instanceof Error ? err.message : "Failed to load performance report");
      } finally {
        setLoadingReport(false);
      }
    },
    [token, effectiveAgencyId, selectedClientId, selectedMonth, selectedYear]
  );

  useEffect(() => {
    if (selectedClientId) {
      loadReport();
    }
  }, [selectedClientId, selectedMonth, selectedYear, loadReport]);

  const handleCopySummary = async () => {
    if (!report?.executive_summary) return;
    try {
      await navigator.clipboard.writeText(report.executive_summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const monthName = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";

  const years = [currentYear, currentYear - 1, currentYear - 2];

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Header section */}
      {/* ── Editorial Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06] print:border-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Performance Reports</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Performance & Delivery Reports
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Audit monthly retainer scope fulfillment, delivery status, and Meta social reach across client workspaces.
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => loadReport()}
            disabled={loadingReport || !selectedClientId}
            title="Refresh Report Data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F2F0F7] surface-card border border-white/[0.08] hover:bg-[#20202A] rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report}
            title="Print or Save as PDF"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* ── Selector Filters Bar (Linear Toolstrip) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs print:border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#A3A0B0] flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Client:</span>
            </label>
            {loadingClients ? (
              <div className="h-9 w-44 bg-[#101014] animate-pulse rounded-lg border border-[#30303D]" />
            ) : clients.length === 0 ? (
              <span className="text-xs text-[#71717A] italic">No clients registered</span>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name} {c.industry ? `(${c.industry})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#A3A0B0] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Period:</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client quick link */}
        {selectedClientId && (
          <div className="text-xs text-[#A3A0B0] flex items-center gap-2">
            <span>Viewing:</span>
            <Link
              href={`/clients/${selectedClientId}`}
              className="font-medium text-[#A78BFA] hover:text-[#B69BFF] bg-[#20202A] px-2.5 py-1 rounded-lg border border-white/[0.08] inline-flex items-center gap-1 transition-colors"
            >
              <span>{selectedClient?.business_name || "Client Workspace"}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#F2F0F7]">Generating monthly delivery report...</p>
          <p className="text-[11px] text-[#71717A]">Auditing active contracts and aggregating live Meta stats</p>
        </div>
      )}

      {/* Error state */}
      {!loadingReport && reportError && (
        <div className="p-5 rounded-2xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#E16F7B] shrink-0" />
          <div>
            <p className="font-bold text-[#F2F0F7]">Failed to load report</p>
            <p className="text-[#E16F7B] mt-0.5">{reportError}</p>
          </div>
        </div>
      )}

      {/* Report Data */}
      {!loadingReport && report && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="surface-card text-[#F2F0F7] rounded-2xl p-6 border border-white/[0.08] space-y-4 relative overflow-hidden shadow-xs print:bg-white print:text-slate-900 print:border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06] print:border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] print:bg-purple-100 print:text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-heading font-semibold uppercase tracking-wider text-[#A78BFA] print:text-purple-700">
                    Executive Summary &bull; {monthName} {report.year}
                  </h2>
                  <p className="text-xs text-[#A3A0B0] print:text-slate-500">{report.client_name}</p>
                </div>
              </div>

              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] text-[#F2F0F7] text-xs font-medium rounded-xl transition-colors cursor-pointer self-start sm:self-auto print:hidden shadow-xs"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#45B88A]" /> : <Copy className="w-3.5 h-3.5 text-[#A3A0B0]" />}
                <span>{copiedSummary ? "Copied" : "Copy Summary"}</span>
              </button>
            </div>

            <p className="text-xs text-[#F2F0F7] leading-relaxed font-normal print:text-slate-800">
              {report.executive_summary}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-2.5 py-1 rounded-lg border border-white/[0.06] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Scope Target: {report.total_scope_quota} items
              </span>
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-2.5 py-1 rounded-lg border border-white/[0.06] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Delivered: {report.deliverables_delivered} approved
              </span>
              <span className="font-mono text-[11px] font-semibold bg-[#A78BFA]/10 text-[#A78BFA] px-2.5 py-1 rounded-lg border border-[#A78BFA]/30 print:bg-purple-50 print:text-purple-800 print:border-purple-200">
                Fulfillment: {report.quota_fulfillment_rate}%
              </span>
            </div>
          </div>

          {/* 4 Key Metric KPI Cards (Linear Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contract Quota Fulfillment */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Retainer Quota
                </span>
                <span
                  className={`p-2 rounded-xl border border-white/[0.08] ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-[#45B88A]/10 text-[#45B88A]"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-[#E5AA58]/10 text-[#E5AA58]"
                      : "bg-[#A78BFA]/10 text-[#A78BFA]"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                    {report.quota_fulfillment_rate}%
                  </span>
                  <span className="text-xs font-mono text-[#A3A0B0]">fulfilled</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  {report.deliverables_delivered} of {report.total_scope_quota} items delivered
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-[#101014] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-[#45B88A]"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-[#A78BFA]"
                      : "bg-[#E5AA58]"
                  }`}
                  style={{ width: `${Math.min(100, report.quota_fulfillment_rate)}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Total Content Views / Impressions */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Impressions
                </span>
                <span className="p-2 rounded-xl bg-[#20202A] text-[#69A9D8] border border-white/[0.08]">
                  <Eye className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {report.total_views.toLocaleString()}
                </span>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  Views across {report.deliverables_published} published posts
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-2 py-0.5 rounded-md w-fit">
                <TrendingUp className="w-3 h-3" />
                <span>Meta Live Reach</span>
              </div>
            </div>

            {/* KPI 3: Total Social Engagement */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Engagement
                </span>
                <span className="p-2 rounded-xl bg-[#20202A] text-[#E16F7B] border border-white/[0.08]">
                  <Heart className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {(report.total_likes + report.total_comments).toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0] mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3 text-[#E16F7B]" /> {report.total_likes.toLocaleString()}
                  </span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-[#69A9D8]" /> {report.total_comments.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-2.5 py-0.5 rounded-md w-fit">
                <Share2 className="w-3 h-3" />
                <span>Interactions</span>
              </div>
            </div>

            {/* KPI 4: Average Engagement Rate */}
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A3A0B0]">
                  Avg Engagement Rate
                </span>
                <span className="p-2 rounded-xl bg-[#20202A] text-[#A78BFA] border border-[#30303D]">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                    {report.avg_engagement_rate}%
                  </span>
                  <span className="text-xs font-medium text-[#71717A]">rate</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  (Likes + Comments) &divide; Total Views
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-2.5 py-0.5 rounded-md w-fit">
                <ArrowUpRight className="w-3 h-3" />
                <span>Audience Response</span>
              </div>
            </div>
          </div>

          {/* Delivery & Fulfillment Funnel Overview */}
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-6 space-y-4">
            <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#A78BFA]" />
              <span>Contract Scope & Delivery Breakdown</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#101014] border border-[#30303D]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">Monthly Quota</span>
                <p className="text-2xl font-bold font-mono text-[#F2F0F7] mt-1">{report.total_scope_quota}</p>
                <p className="text-[11px] text-[#71717A] mt-0.5">Contract Retainer Target</p>
              </div>
              <div className="p-4 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#45B88A]">Approved Content</span>
                <p className="text-2xl font-bold font-mono text-[#45B88A] mt-1">{report.deliverables_delivered}</p>
                <p className="text-[11px] text-[#45B88A]/80 mt-0.5">Ready or Published</p>
              </div>
              <div className="p-4 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A78BFA]">Published Live</span>
                <p className="text-2xl font-bold font-mono text-[#A78BFA] mt-1">{report.deliverables_published}</p>
                <p className="text-[11px] text-[#A78BFA]/80 mt-0.5">Live on Social Media</p>
              </div>
              <div className="p-4 rounded-xl bg-[#E5AA58]/10 border border-[#E5AA58]/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#E5AA58]">Pending Quota</span>
                <p className="text-2xl font-bold font-mono text-[#E5AA58] mt-1">
                  {Math.max(0, report.total_scope_quota - report.deliverables_delivered)}
                </p>
                <p className="text-[11px] text-[#E5AA58]/80 mt-0.5">Remaining this month</p>
              </div>
            </div>
          </div>

          {/* Top Performing Content Leaderboard */}
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] overflow-hidden">
            <div className="p-5 border-b border-[#30303D] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#A78BFA]" />
                  <span>Top Performing Content</span>
                </h3>
                <p className="text-xs text-[#A3A0B0] mt-0.5">
                  Ranked by live impressions, audience likes, and comments on Meta
                </p>
              </div>
              <span className="text-xs font-mono text-[#71717A]">
                Top {report.top_deliverables.length} posts
              </span>
            </div>

            {report.top_deliverables.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-[#30303D] text-[#71717A] flex items-center justify-center mx-auto">
                  <Film className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#F2F0F7]">No content published yet for this period</p>
                <p className="text-[11px] text-[#71717A]">
                  Publish posts to Instagram and Facebook to automatically track real-time impressions and engagement.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#30303D]/60">
                {report.top_deliverables.map((item, idx) => {
                  const isVideo = item.deliverable_type?.toLowerCase().includes("video") || item.deliverable_type?.toLowerCase().includes("reel");
                  const platformStr = (item.platform || "").trim().toLowerCase();
                  const isInstagram = platformStr === "instagram";
                  const isFacebook = platformStr === "facebook";
                  const liveUrl = item.live_post_url
                    ? item.live_post_url.startsWith("http")
                      ? item.live_post_url
                      : isFacebook
                      ? `https://www.facebook.com${item.live_post_url.startsWith("/") ? "" : "/"}${item.live_post_url}`
                      : `https://www.instagram.com${item.live_post_url.startsWith("/") ? "" : "/"}${item.live_post_url}`
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#20202A]/40 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            idx === 0
                              ? "bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/40"
                              : idx === 1
                              ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                              : idx === 2
                              ? "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"
                              : "bg-[#101014] text-[#71717A]"
                          }`}
                        >
                          #{idx + 1}
                        </div>

                        {/* Format icon */}
                        <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-[#30303D] text-[#A78BFA] flex items-center justify-center shrink-0">
                          {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>

                        {/* Title and tags */}
                        <div className="min-w-0">
                          <Link
                            href={`/deliverables/${item.id}`}
                            className="text-sm font-semibold text-[#F2F0F7] hover:text-[#A78BFA] truncate block max-w-md group"
                          >
                            <span className="group-hover:underline">{item.title}</span>
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            <span
                              className={`font-mono font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border ${
                                isInstagram
                                  ? "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30"
                                  : isFacebook
                                  ? "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30"
                                  : "bg-[#20202A] text-[#A3A0B0] border-[#30303D]"
                              }`}
                            >
                              {item.platform}
                            </span>
                            <span className="capitalize text-[#A3A0B0] font-medium bg-[#101014] border border-[#30303D] px-2 py-0.5 rounded-md font-mono text-[10px]">
                              {item.deliverable_type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Performance stats row */}
                      <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto font-mono">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[#F2F0F7] text-xs font-bold justify-end">
                            <Eye className="w-3.5 h-3.5 text-[#69A9D8]" />
                            <span>{item.views_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-[#71717A] font-medium">Views</span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[#F2F0F7] text-xs font-bold justify-end">
                            <Heart className="w-3.5 h-3.5 text-[#E16F7B]" />
                            <span>{item.likes_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-[#71717A] font-medium">Likes</span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[#F2F0F7] text-xs font-bold justify-end">
                            <MessageCircle className="w-3.5 h-3.5 text-[#69A9D8]" />
                            <span>{item.comments_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-[#71717A] font-medium">Comments</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pl-2 font-sans">
                          {liveUrl ? (
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-colors"
                            >
                              <span>Live</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <Link
                              href={`/deliverables/${item.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#A78BFA] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] rounded-xl transition-colors"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State: No clients in Agency */}
      {!loadingClients && clients.length === 0 && (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-[#30303D] text-[#71717A] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">No Clients Found</h3>
          <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
            Add your agency clients and define monthly retainer contracts to start auditing deliverables and generating performance reports.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] text-[#101014] text-xs font-bold rounded-xl shadow-xs hover:bg-[#B69BFF] transition-colors"
          >
            Go to Clients Workspace
          </Link>
        </div>
      )}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[#71717A]">Loading performance reports...</div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}