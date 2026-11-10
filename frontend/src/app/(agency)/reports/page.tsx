"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const searchParams = useSearchParams();

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

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 print:border-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 print:hidden">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Performance & Delivery Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit monthly retainer scope fulfillment, delivery status, and Meta social engagement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => loadReport()}
            disabled={loadingReport || !selectedClientId}
            title="Refresh Report Data"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-purple-600" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report}
            title="Print or Save as PDF"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-xs shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Selector Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:border-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Client:</span>
            </label>
            {loadingClients ? (
              <div className="h-9 w-44 bg-slate-100 animate-pulse rounded-xl" />
            ) : clients.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No clients registered</span>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
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
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Period:</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
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
              className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
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
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Viewing:</span>
            <Link
              href={`/clients/${selectedClientId}`}
              className="font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200/60 inline-flex items-center gap-1 transition-colors"
            >
              <span>{selectedClient?.business_name || "Client Details"}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3">
          <div className="w-10 h-10 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Generating monthly delivery report...</p>
          <p className="text-[11px] text-slate-400">Auditing active contracts and aggregating live Meta stats</p>
        </div>
      )}

      {/* Error state */}
      {!loadingReport && reportError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Failed to load report</p>
            <p className="text-rose-600 mt-0.5">{reportError}</p>
          </div>
        </div>
      )}

      {/* Report Data */}
      {!loadingReport && report && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 shadow-lg border border-indigo-500/30 space-y-4 relative overflow-hidden print:bg-white print:text-slate-900 print:border-slate-300 print:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 print:border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 print:bg-purple-100 print:text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-purple-300 print:text-purple-700">
                    Executive Summary &bull; {monthName} {report.year}
                  </h2>
                  <p className="text-xs text-slate-400 print:text-slate-500">{report.client_name}</p>
                </div>
              </div>

              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-auto print:hidden"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                <span>{copiedSummary ? "Copied to Clipboard" : "Copy Summary"}</span>
              </button>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed font-normal print:text-slate-800">
              {report.executive_summary}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="font-bold bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Scope Target: {report.total_scope_quota} items
              </span>
              <span className="font-bold bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Delivered: {report.deliverables_delivered} approved
              </span>
              <span className="font-bold bg-purple-500/30 text-purple-200 px-2.5 py-1 rounded-lg border border-purple-400/30 print:bg-purple-50 print:text-purple-800 print:border-purple-200">
                Fulfillment: {report.quota_fulfillment_rate}%
              </span>
            </div>
          </div>

          {/* 4 Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contract Quota Fulfillment */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Retainer Quota
                </span>
                <span
                  className={`p-2 rounded-xl ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-emerald-50 text-emerald-600"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-amber-50 text-amber-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {report.quota_fulfillment_rate}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">fulfilled</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {report.deliverables_delivered} of {report.total_scope_quota} monthly deliverables delivered
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-emerald-500"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-purple-600"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, report.quota_fulfillment_rate)}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Total Content Views / Impressions */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Impressions
                </span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Eye className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {report.total_views.toLocaleString()}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Views across {report.deliverables_published} published posts
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg w-fit">
                <TrendingUp className="w-3 h-3" />
                <span>Meta Live Reach</span>
              </div>
            </div>

            {/* KPI 3: Total Social Engagement */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Engagement
                </span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <Heart className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {(report.total_likes + report.total_comments).toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-500" /> {report.total_likes.toLocaleString()}
                  </span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-blue-500" /> {report.total_comments.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg w-fit">
                <Share2 className="w-3 h-3" />
                <span>Interactions</span>
              </div>
            </div>

            {/* KPI 4: Average Engagement Rate */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Avg Engagement Rate
                </span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {report.avg_engagement_rate}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">rate</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  (Likes + Comments) &divide; Total Views
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg w-fit">
                <ArrowUpRight className="w-3 h-3" />
                <span>Audience Response</span>
              </div>
            </div>
          </div>

          {/* Delivery & Fulfillment Funnel Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Contract Scope & Delivery Breakdown</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Quota</span>
                <p className="text-xl font-black text-slate-800 mt-1">{report.total_scope_quota}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Contract Retainer Target</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Approved Content</span>
                <p className="text-xl font-black text-emerald-900 mt-1">{report.deliverables_delivered}</p>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">Ready or Published</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Published Live</span>
                <p className="text-xl font-black text-purple-900 mt-1">{report.deliverables_published}</p>
                <p className="text-[11px] text-purple-700/80 mt-0.5">Live on Social Media</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Quota</span>
                <p className="text-xl font-black text-amber-900 mt-1">
                  {Math.max(0, report.total_scope_quota - report.deliverables_delivered)}
                </p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">Remaining this month</p>
              </div>
            </div>
          </div>

          {/* Top Performing Content Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span>Top Performing Content</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by live impressions, audience likes, and comments on Meta
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Top {report.top_deliverables.length} posts
              </span>
            </div>

            {report.top_deliverables.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Film className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">No content published yet for this period</p>
                <p className="text-[11px] text-slate-400">
                  Publish posts to Instagram and Facebook to automatically track real-time impressions and engagement.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
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
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            idx === 0
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : idx === 1
                              ? "bg-slate-200 text-slate-700 border border-slate-300"
                              : idx === 2
                              ? "bg-amber-50 text-amber-900 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          #{idx + 1}
                        </div>

                        {/* Format icon */}
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>

                        {/* Title and tags */}
                        <div className="min-w-0">
                          <Link
                            href={`/deliverables/${item.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-purple-700 truncate block max-w-md group"
                          >
                            <span className="group-hover:underline">{item.title}</span>
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            <span
                              className={`font-extrabold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border ${
                                isInstagram
                                  ? "bg-pink-50 text-pink-700 border-pink-200"
                                  : isFacebook
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {item.platform}
                            </span>
                            <span className="capitalize text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.deliverable_type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Performance stats row */}
                      <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-slate-700 text-xs font-black justify-end">
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{item.views_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Views</span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-slate-700 text-xs font-black justify-end">
                            <Heart className="w-3.5 h-3.5 text-rose-500" />
                            <span>{item.likes_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Likes</span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-slate-700 text-xs font-black justify-end">
                            <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                            <span>{item.comments_count.toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Comments</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pl-2">
                          {liveUrl ? (
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
                                isInstagram
                                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                                  : isFacebook
                                  ? "bg-blue-600 hover:bg-blue-500"
                                  : "bg-indigo-600 hover:bg-indigo-500"
                              }`}
                            >
                              <span>Live</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <Link
                              href={`/deliverables/${item.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-xl transition-colors"
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Clients Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your agency clients and define monthly retainer contracts to start auditing deliverables and generating performance reports.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-purple-500 transition-colors"
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
        <div className="p-8 text-center text-xs text-slate-400">Loading performance reports...</div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
