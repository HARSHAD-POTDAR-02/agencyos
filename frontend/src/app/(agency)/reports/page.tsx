"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { clientApi, publishingApi, MonthlyReport, LiveMetaPostItem } from "@/lib/api";
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
  Filter,
  ArrowUpDown,
  Download,
  Activity,
  SlidersHorizontal,
  DollarSign,
  Users,
  Globe,
  ShieldCheck,
  Award,
  Zap,
  PieChart,
  Info,
  Radio,
  CheckCheck,
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

function getClientInitials(name: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCurrency(amount: number, currency: string = "INR"): string {
  if (currency === "INR") {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  }
  return "$" + Math.round(amount).toLocaleString("en-US");
}

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

  const [activeTab, setActiveTab] = useState<"deliverables" | "live_feed">("deliverables");
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook">("all");
  const [sortBy, setSortBy] = useState<"views" | "likes" | "comments" | "engagement">("views");
  const [showRoiInfo, setShowRoiInfo] = useState(false);

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

  // Load Monthly Performance & ROI Report
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

  // Keyboard Shortcuts: R to refresh, P to print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        loadReport();
      } else if ((e.key === "p" || e.key === "P") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadReport]);

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

  // Filter and sort top deliverables
  const filteredDeliverables = useMemo(() => {
    if (!report?.top_deliverables) return [];
    return report.top_deliverables
      .filter((d) => {
        if (platformFilter === "all") return true;
        return (d.platform || "").toLowerCase().includes(platformFilter);
      })
      .sort((a, b) => {
        if (sortBy === "likes") return b.likes_count - a.likes_count;
        if (sortBy === "comments") return b.comments_count - a.comments_count;
        if (sortBy === "engagement") {
          const rateA = a.views_count > 0 ? ((a.likes_count + a.comments_count) / a.views_count) * 100 : 0;
          const rateB = b.views_count > 0 ? ((b.likes_count + b.comments_count) / b.views_count) * 100 : 0;
          return rateB - rateA;
        }
        return b.views_count - a.views_count;
      });
  }, [report?.top_deliverables, platformFilter, sortBy]);

  // Filter live meta posts
  const filteredLivePosts = useMemo(() => {
    if (!report?.live_meta_posts) return [];
    return report.live_meta_posts.filter((p) => {
      if (platformFilter === "all") return true;
      return (p.platform || "").toLowerCase() === platformFilter;
    });
  }, [report?.live_meta_posts, platformFilter]);

  const instagramCount = useMemo(() => {
    if (!report?.top_deliverables) return 0;
    return report.top_deliverables.filter((d) => (d.platform || "").toLowerCase().includes("instagram")).length;
  }, [report?.top_deliverables]);

  const facebookCount = useMemo(() => {
    if (!report?.top_deliverables) return 0;
    return report.top_deliverables.filter((d) => (d.platform || "").toLowerCase().includes("facebook")).length;
  }, [report?.top_deliverables]);

  if (!isLoading && isSpecialist) {
    return null;
  }

  const hasMetaProfiles = Boolean(
    report?.instagram_profile?.connected || report?.facebook_profile?.connected
  );

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-none text-[#F2F0F7]">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.08] print:border-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Performance & ROI Reports</span>
            <span className="text-white/[0.2]">/</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] animate-pulse" />
              Meta Live Graph API v22.0
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Performance & Agency ROI Reports
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Audit contract retainer SLA delivery, live Instagram & Facebook audience metrics, and economic Earned Media Value (EMV).
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => loadReport()}
            disabled={loadingReport || !selectedClientId}
            title="Sync Live Telemetry from Meta (Shortcut: R)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F2F0F7] surface-card border border-white/[0.08] hover:bg-[#20202A] rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`} />
            <span>Sync Meta</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-[9px] font-mono text-[#A3A0B0]">R</kbd>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report}
            title="Print or Save as PDF (Shortcut: ⌘P)"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export Executive PDF</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-[#101014]/20 text-[9px] font-mono text-[#101014]">⌘P</kbd>
          </button>
        </div>
      </div>

      {/* ── Selector Filters Bar (Linear Toolstrip) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#A3A0B0] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Client:</span>
            </label>
            {loadingClients ? (
              <div className="h-8 w-44 bg-[#101014] animate-pulse rounded-lg border border-white/[0.08]" />
            ) : clients.length === 0 ? (
              <span className="text-xs text-[#71717A] italic">No clients registered</span>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name} {c.industry ? `(${c.industry})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#A3A0B0] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Period:</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
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
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client quick link & Avatar Monogram */}
        {selectedClientId && selectedClient && (
          <div className="flex items-center gap-2.5 text-xs text-[#A3A0B0]">
            <span className="hidden sm:inline">Active Workspace:</span>
            <Link
              href={`/clients/${selectedClientId}`}
              className="font-medium text-[#F2F0F7] hover:text-[#A78BFA] bg-[#101014] hover:bg-[#20202A] px-2.5 py-1 rounded-lg border border-white/[0.08] inline-flex items-center gap-2 transition-colors group shadow-xs"
            >
              <div className="w-5 h-5 rounded-md bg-[#A78BFA]/20 border border-[#A78BFA]/40 flex items-center justify-center text-[10px] font-mono font-bold text-[#A78BFA]">
                {getClientInitials(selectedClient.business_name)}
              </div>
              <span className="font-semibold text-xs">{selectedClient.business_name}</span>
              <ExternalLink className="w-3 h-3 text-[#A3A0B0] group-hover:text-[#A78BFA] transition-colors" />
            </Link>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#F2F0F7]">Compiling live performance & ROI telemetry...</p>
          <p className="text-[11px] text-[#A3A0B0]">Auditing active retainer scope and querying Meta Graph API v22.0 for live follower and post metrics</p>
        </div>
      )}

      {/* Error state */}
      {!loadingReport && reportError && (
        <div className="p-5 rounded-2xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#E16F7B] shrink-0" />
            <div>
              <p className="font-bold text-[#F2F0F7]">Failed to load performance report</p>
              <p className="text-[#E16F7B] mt-0.5">{reportError}</p>
            </div>
          </div>
          <button
            onClick={() => loadReport()}
            className="px-3 py-1.5 rounded-lg bg-[#E16F7B]/20 text-[#F2F0F7] hover:bg-[#E16F7B]/30 font-semibold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Report Data */}
      {!loadingReport && report && (
        <div className="space-y-6">
          {/* Executive Summary Card (Framer / Raycast Surface) */}
          <div className="surface-card rounded-2xl p-6 border border-white/[0.08] space-y-4 relative overflow-hidden shadow-xs print:bg-white print:text-slate-900 print:border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08] print:border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] shadow-xs print:bg-purple-100 print:text-purple-700">
                  <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#A78BFA] print:text-purple-700">
                      Executive Summary &bull; {monthName} {report.year}
                    </h2>
                  </div>
                  <p className="text-sm font-heading font-bold text-[#F2F0F7] print:text-slate-900 mt-0.5">
                    {report.client_name}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] text-[#F2F0F7] text-xs font-medium rounded-xl transition-all cursor-pointer self-start sm:self-auto print:hidden shadow-xs active:scale-[0.98]"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#45B88A]" /> : <Copy className="w-3.5 h-3.5 text-[#A3A0B0]" />}
                <span>{copiedSummary ? "Copied" : "Copy Brief"}</span>
              </button>
            </div>

            <p className="text-xs text-[#F2F0F7] leading-relaxed font-normal print:text-slate-800">
              {report.executive_summary}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-3 py-1 rounded-lg border border-white/[0.08] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Scope Target: <strong className="text-[#F2F0F7] print:text-slate-900">{report.total_scope_quota} items</strong>
              </span>
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-3 py-1 rounded-lg border border-white/[0.08] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Delivered: <strong className="text-[#F2F0F7] print:text-slate-900">{report.deliverables_delivered} approved</strong>
              </span>
              <span className={`font-mono text-[11px] font-bold px-3 py-1 rounded-lg border ${
                report.quota_fulfillment_rate >= 100
                  ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30 print:bg-emerald-50 print:text-emerald-800"
                  : report.quota_fulfillment_rate >= 50
                  ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30 print:bg-purple-50 print:text-purple-800"
                  : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30 print:bg-amber-50 print:text-amber-800"
              }`}>
                Fulfillment: {report.quota_fulfillment_rate}%
              </span>

              {report.roi_metrics && (
                <span className={`font-mono text-[11px] font-bold px-3 py-1 rounded-lg border ${
                  report.roi_metrics.roi_multiplier >= 1.0
                    ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30 print:bg-emerald-50 print:text-emerald-800"
                    : "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30 print:bg-purple-50 print:text-purple-800"
                }`}>
                  Agency ROI: {report.roi_metrics.roi_multiplier}x Retainer Multiple
                </span>
              )}
            </div>
          </div>

          {/* ── SECTION 1: LIVE META ACCOUNTS & AUDIENCE TELEMETRY ── */}
          {hasMetaProfiles && (
            <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E16F7B]/20 via-[#A78BFA]/20 to-[#69A9D8]/20 border border-white/[0.1] flex items-center justify-center text-[#A78BFA]">
                    <Globe className="w-4 h-4 text-[#A78BFA]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                      <span>Live Meta Social Accounts & Audience Telemetry</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 font-bold">
                        Verified Graph API v22.0
                      </span>
                    </h3>
                    <p className="text-xs text-[#A3A0B0]">
                      Real-time profile status, follower reach, and media count streamed directly from Meta servers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono bg-[#101014] px-3 py-1.5 rounded-xl border border-white/[0.08] text-[#A3A0B0]">
                  <Users className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Total Verified Reach:</span>
                  <strong className="text-[#F2F0F7]">{report.roi_metrics?.total_audience || 0} followers</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Instagram Profile Card */}
                {report.instagram_profile?.connected ? (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col justify-between space-y-4 hover:border-[#E16F7B]/30 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {report.instagram_profile.profile_picture_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={report.instagram_profile.profile_picture_url}
                            alt={report.instagram_profile.username || "Instagram Avatar"}
                            className="w-12 h-12 rounded-full border border-white/[0.1] object-cover ring-2 ring-[#E16F7B]/30"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E16F7B] to-[#E5AA58] flex items-center justify-center text-white font-bold text-sm">
                            IG
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F2F0F7] group-hover:text-[#E16F7B] transition-colors">
                              @{report.instagram_profile.username}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] inline-block" />
                          </div>
                          <p className="text-xs text-[#A3A0B0]">{report.instagram_profile.name || "Instagram Business Profile"}</p>
                          {report.instagram_profile.biography && (
                            <p className="text-[11px] text-[#A3A0B0]/80 line-clamp-1 mt-0.5">
                              {report.instagram_profile.biography}
                            </p>
                          )}
                        </div>
                      </div>

                      <a
                        href={`https://www.instagram.com/${report.instagram_profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#E16F7B] bg-[#E16F7B]/10 hover:bg-[#E16F7B]/20 border border-[#E16F7B]/30 rounded-lg inline-flex items-center gap-1 transition-colors"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] text-center font-mono">
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Followers</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.followers_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Following</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.follows_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Media</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.media_count.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.06] flex items-center justify-center text-center text-xs text-[#A3A0B0]">
                    Instagram account not connected for this client.
                  </div>
                )}

                {/* Facebook Page Card */}
                {report.facebook_profile?.connected ? (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col justify-between space-y-4 hover:border-[#69A9D8]/30 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {report.facebook_profile.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={report.facebook_profile.avatar_url}
                            alt={report.facebook_profile.page_name || "Facebook Page Avatar"}
                            className="w-12 h-12 rounded-full border border-white/[0.1] object-cover ring-2 ring-[#69A9D8]/30"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#69A9D8] to-[#A78BFA] flex items-center justify-center text-white font-bold text-sm">
                            FB
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F2F0F7] group-hover:text-[#69A9D8] transition-colors">
                              {report.facebook_profile.page_name}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] inline-block" />
                          </div>
                          <p className="text-xs text-[#A3A0B0]">Facebook Official Page</p>
                          <p className="text-[10px] font-mono text-[#A3A0B0]/80 mt-0.5">
                            ID: {report.facebook_profile.id || "Connected"}
                          </p>
                        </div>
                      </div>

                      {report.facebook_profile.link && (
                        <a
                          href={report.facebook_profile.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#69A9D8] bg-[#69A9D8]/10 hover:bg-[#69A9D8]/20 border border-[#69A9D8]/30 rounded-lg inline-flex items-center gap-1 transition-colors"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] text-center font-mono">
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Followers</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.followers_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Page Fans</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.fan_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Talking About</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.talking_about_count.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.06] flex items-center justify-center text-center text-xs text-[#A3A0B0]">
                    Facebook Page not connected for this client.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SECTION 2: AGENCY FINANCIAL REALIZATION & RETAINER ROI DASHBOARD ── */}
          {report.roi_metrics && (
            <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30 flex items-center justify-center text-[#45B88A]">
                    <DollarSign className="w-4 h-4 text-[#45B88A]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                      <span>Agency Financial Realization & Retainer ROI</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 font-bold">
                        Earned Media Value (EMV)
                      </span>
                    </h3>
                    <p className="text-xs text-[#A3A0B0]">
                      Comparing client monthly retainer fee against creative production value and organic social engagement
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowRoiInfo(!showRoiInfo)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#A78BFA] hover:text-[#B69BFF] transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{showRoiInfo ? "Hide Methodology" : "View ROI Methodology"}</span>
                </button>
              </div>

              {showRoiInfo && (
                <div className="p-4 rounded-xl bg-[#101014] border border-[#A78BFA]/20 text-xs text-[#A3A0B0] space-y-2 leading-relaxed animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-[#A78BFA] font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>How AgencyOS Calculates Earned Media Value (EMV) & Retainer ROI</span>
                  </div>
                  <p>
                    Rather than relying solely on vanity reach, our Financial Realization Engine combines:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    <li><strong className="text-[#F2F0F7]">Creative Asset Production Value:</strong> Direct commercial replacement value for approved deliverables (Videos @ ₹15,000, Carousels @ ₹10,000, Static Graphics @ ₹6,000).</li>
                    <li><strong className="text-[#F2F0F7]">Organic Social Engagement Valuation:</strong> Verified post interactions evaluated at standard digital media benchmarks (₹40/like, ₹125/comment, ₹250/share).</li>
                    <li><strong className="text-[#F2F0F7]">Audience Reach Value:</strong> ₹15 per 100 active verified followers.</li>
                    <li><strong className="text-[#F2F0F7]">Retainer ROI Multiplier:</strong> Calculated as <code className="bg-[#17171E] px-1 py-0.5 rounded font-mono text-[#A78BFA]">Total EMV ÷ Monthly Contract Retainer</code>.</li>
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* ROI Card 1: Retainer vs EMV */}
                <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">
                      Monthly Retainer
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
                      Active Contract
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold font-mono text-[#F2F0F7]">
                      {formatCurrency(report.roi_metrics.monthly_retainer_fee, report.roi_metrics.currency)}
                    </span>
                    <p className="text-[11px] text-[#A3A0B0] mt-0.5 font-mono">
                      Contractual Client Fee / Mo
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#A3A0B0] pt-1 border-t border-white/[0.04]">
                    Target Scope: <strong className="text-[#F2F0F7]">{report.total_scope_quota} assets</strong>
                  </div>
                </div>

                {/* ROI Card 2: Generated EMV */}
                <div className="p-4 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#45B88A]">
                      Earned Media Value (EMV)
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#45B88A]/20 text-[#45B88A] border border-[#45B88A]/40">
                      Total Generated
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold font-mono text-[#45B88A]">
                      {formatCurrency(report.roi_metrics.estimated_earned_media_value, report.roi_metrics.currency)}
                    </span>
                    <p className="text-[11px] text-[#45B88A]/80 mt-0.5 font-mono">
                      Assets Produced + Social Value
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#45B88A]/90 pt-1 border-t border-[#45B88A]/20">
                    Retainer Multiple: <strong className="text-[#F2F0F7] font-bold">{report.roi_metrics.roi_multiplier}x ROI</strong>
                  </div>
                </div>

                {/* ROI Card 3: Cost Per Approved Deliverable */}
                <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">
                      Cost Per Approved Asset
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]">
                      Unit Cost
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold font-mono text-[#F2F0F7]">
                      {formatCurrency(report.roi_metrics.cost_per_approved_asset, report.roi_metrics.currency)}
                    </span>
                    <p className="text-[11px] text-[#A3A0B0] mt-0.5 font-mono">
                      {report.deliverables_delivered} approved items delivered
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#A3A0B0] pt-1 border-t border-white/[0.04]">
                    Effective Cost / Asset
                  </div>
                </div>

                {/* ROI Card 4: Organic Social Engagement Value */}
                <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">
                      Production Value
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
                      Asset Benchmark
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold font-mono text-[#A78BFA]">
                      {formatCurrency(report.roi_metrics.estimated_production_value, report.roi_metrics.currency)}
                    </span>
                    <p className="text-[11px] text-[#A3A0B0] mt-0.5 font-mono">
                      Creative asset replacement value
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#A3A0B0] pt-1 border-t border-white/[0.04]">
                    Plus social engagement value
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 3: KEY PERFORMANCE KPIS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contract Quota Fulfillment */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Retainer Quota SLA
                </span>
                <span
                  className={`p-2 rounded-xl border ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30"
                      : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30"
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
              <div className="w-full h-1.5 rounded-full bg-[#101014] overflow-hidden border border-white/[0.04]">
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
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Impressions
                </span>
                <span className="p-2 rounded-xl bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30">
                  <Eye className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {report.total_views.toLocaleString()}
                </span>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  Views & reach across published posts
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-2.5 py-0.5 rounded-md w-fit">
                <TrendingUp className="w-3 h-3" />
                <span>Meta Live Reach</span>
              </div>
            </div>

            {/* KPI 3: Total Social Engagement */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Engagement
                </span>
                <span className="p-2 rounded-xl bg-[#E16F7B]/10 text-[#E16F7B] border border-[#E16F7B]/30">
                  <Heart className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {(report.total_likes + report.total_comments).toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0] mt-1">
                  <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                    <Heart className="w-3 h-3 text-[#E16F7B]" /> {report.total_likes.toLocaleString()}
                  </span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                    <MessageCircle className="w-3 h-3 text-[#69A9D8]" /> {report.total_comments.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-2.5 py-0.5 rounded-md w-fit">
                <Share2 className="w-3 h-3" />
                <span>Verified Meta Interactions</span>
              </div>
            </div>

            {/* KPI 4: Average Engagement Rate */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Avg Engagement Rate
                </span>
                <span className="p-2 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                    {report.avg_engagement_rate}%
                  </span>
                  <span className="text-xs font-mono text-[#A3A0B0]">rate</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  (Likes + Comments) &divide; Audience
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-2.5 py-0.5 rounded-md w-fit">
                <ArrowUpRight className="w-3 h-3" />
                <span>Audience Response</span>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: CONTENT FORMAT & CONTRACT DELIVERY BREAKDOWN ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Format Distribution Card */}
            {report.format_distribution && (
              <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#A78BFA]" />
                    <span>Content Format Distribution</span>
                  </h3>
                  <span className="text-[11px] font-mono text-[#A3A0B0]">
                    Total Media Assets: {report.format_distribution.videos_count + report.format_distribution.images_count + report.format_distribution.carousels_count + report.format_distribution.other_count}
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-[#A3A0B0] text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-[#F2F0F7]">
                        <Film className="w-3.5 h-3.5 text-[#A78BFA]" /> Videos & Reels
                      </span>
                      <span>{report.format_distribution.videos_count} assets</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#101014] overflow-hidden">
                      <div
                        className="h-full bg-[#A78BFA] rounded-full"
                        style={{
                          width: `${
                            ((report.format_distribution.videos_count /
                              Math.max(
                                1,
                                report.format_distribution.videos_count +
                                  report.format_distribution.images_count +
                                  report.format_distribution.carousels_count +
                                  report.format_distribution.other_count
                              )) *
                              100)
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#A3A0B0] text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-[#F2F0F7]">
                        <ImageIcon className="w-3.5 h-3.5 text-[#69A9D8]" /> Single Photos & Graphics
                      </span>
                      <span>{report.format_distribution.images_count} assets</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#101014] overflow-hidden">
                      <div
                        className="h-full bg-[#69A9D8] rounded-full"
                        style={{
                          width: `${
                            ((report.format_distribution.images_count /
                              Math.max(
                                1,
                                report.format_distribution.videos_count +
                                  report.format_distribution.images_count +
                                  report.format_distribution.carousels_count +
                                  report.format_distribution.other_count
                              )) *
                              100)
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#A3A0B0] text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-[#F2F0F7]">
                        <Layers className="w-3.5 h-3.5 text-[#45B88A]" /> Carousels & Decks
                      </span>
                      <span>{report.format_distribution.carousels_count} assets</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#101014] overflow-hidden">
                      <div
                        className="h-full bg-[#45B88A] rounded-full"
                        style={{
                          width: `${
                            ((report.format_distribution.carousels_count /
                              Math.max(
                                1,
                                report.format_distribution.videos_count +
                                  report.format_distribution.images_count +
                                  report.format_distribution.carousels_count +
                                  report.format_distribution.other_count
                              )) *
                              100)
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Funnel Overview */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#A78BFA]" />
                  <span>Contract Scope & Delivery Breakdown</span>
                </h3>
                <span className="text-[11px] font-mono text-[#A3A0B0]">
                  Target: {report.total_scope_quota} items
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#101014] border border-white/[0.08]">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">Monthly Quota</span>
                  <p className="text-xl font-bold font-mono text-[#F2F0F7] mt-1">{report.total_scope_quota}</p>
                  <p className="text-[10px] text-[#A3A0B0] mt-0.5 font-mono">Contract Target</p>
                </div>
                <div className="p-3 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#45B88A]">Approved Content</span>
                  <p className="text-xl font-bold font-mono text-[#45B88A] mt-1">{report.deliverables_delivered}</p>
                  <p className="text-[10px] text-[#45B88A]/80 mt-0.5 font-mono">Ready or Live</p>
                </div>
                <div className="p-3 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A78BFA]">Published Live</span>
                  <p className="text-xl font-bold font-mono text-[#A78BFA] mt-1">{report.deliverables_published}</p>
                  <p className="text-[10px] text-[#A78BFA]/80 mt-0.5 font-mono">Live on Meta</p>
                </div>
                <div className="p-3 rounded-xl bg-[#E5AA58]/10 border border-[#E5AA58]/30">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#E5AA58]">Pending Quota</span>
                  <p className="text-xl font-bold font-mono text-[#E5AA58] mt-1">
                    {Math.max(0, report.total_scope_quota - report.deliverables_delivered)}
                  </p>
                  <p className="text-[10px] text-[#E5AA58]/80 mt-0.5 font-mono">Remaining</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: CONTENT SHOWCASE (DUAL TABS: DELIVERABLES VS LIVE SOCIAL FEED) ── */}
          <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="p-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab("deliverables")}
                    className={`text-sm font-heading font-bold tracking-tight pb-1 border-b-2 transition-colors cursor-pointer ${
                      activeTab === "deliverables"
                        ? "text-[#F2F0F7] border-[#A78BFA]"
                        : "text-[#A3A0B0] border-transparent hover:text-[#F2F0F7]"
                    }`}
                  >
                    Contract Deliverables Leaderboard ({report.top_deliverables.length})
                  </button>

                  <button
                    onClick={() => setActiveTab("live_feed")}
                    className={`text-sm font-heading font-bold tracking-tight pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "live_feed"
                        ? "text-[#F2F0F7] border-[#A78BFA]"
                        : "text-[#A3A0B0] border-transparent hover:text-[#F2F0F7]"
                    }`}
                  >
                    <span>Live Meta Social Feed</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#45B88A]/20 text-[#45B88A] text-[10px] font-mono">
                      {report.live_meta_posts?.length || 0}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-[#A3A0B0] mt-1">
                  {activeTab === "deliverables"
                    ? "Ranked by live impressions, audience likes, and comments on Meta"
                    : "Real-time published feed streamed directly from Instagram and Facebook Graph API nodes"}
                </p>
              </div>

              {/* Platform filter pills & Sort dropdown */}
              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <div className="flex items-center bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs">
                  <button
                    onClick={() => setPlatformFilter("all")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      platformFilter === "all"
                        ? "bg-white/[0.08] text-[#F2F0F7] font-bold shadow-xs"
                        : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPlatformFilter("instagram")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      platformFilter === "instagram"
                        ? "bg-[#E16F7B]/20 text-[#E16F7B] font-bold border border-[#E16F7B]/30 shadow-xs"
                        : "text-[#A3A0B0] hover:text-[#E16F7B]"
                    }`}
                  >
                    Instagram ({instagramCount})
                  </button>
                  <button
                    onClick={() => setPlatformFilter("facebook")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                      platformFilter === "facebook"
                        ? "bg-[#69A9D8]/20 text-[#69A9D8] font-bold border border-[#69A9D8]/30 shadow-xs"
                        : "text-[#A3A0B0] hover:text-[#69A9D8]"
                    }`}
                  >
                    Facebook ({facebookCount})
                  </button>
                </div>

                {activeTab === "deliverables" && (
                  <div className="flex items-center gap-1.5 bg-[#101014] px-2.5 py-1 rounded-lg border border-white/[0.08] text-xs">
                    <ArrowUpDown className="w-3 h-3 text-[#A3A0B0]" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-xs text-[#F2F0F7] font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="views" className="bg-[#17171E]">By Views</option>
                      <option value="likes" className="bg-[#17171E]">By Likes</option>
                      <option value="comments" className="bg-[#17171E]">By Comments</option>
                      <option value="engagement" className="bg-[#17171E]">By Engagement Rate</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* TAB 1: DELIVERABLES LEADERBOARD */}
            {activeTab === "deliverables" && (
              filteredDeliverables.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
                    <Film className="w-5 h-5 text-[#A3A0B0]" />
                  </div>
                  <p className="text-xs font-semibold text-[#F2F0F7]">No deliverables matching this filter</p>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Publish deliverables to Instagram and Facebook to automatically track real-time impressions and engagement.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {filteredDeliverables.map((item, idx) => {
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

                    const postEngagementRate = item.views_count > 0
                      ? (((item.likes_count + item.comments_count) / item.views_count) * 100).toFixed(2)
                      : "0.00";

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
                                ? "bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/40 shadow-xs"
                                : idx === 1
                                ? "bg-white/[0.1] text-[#F2F0F7] border border-white/[0.15]"
                                : idx === 2
                                ? "bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]"
                                : "bg-[#101014] text-[#A3A0B0]/70 border border-white/[0.04]"
                            }`}
                          >
                            #{idx + 1}
                          </div>

                          {/* Format icon */}
                          <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A78BFA] flex items-center justify-center shrink-0">
                            {isVideo ? <Film className="w-4 h-4 text-[#A78BFA]" /> : <ImageIcon className="w-4 h-4 text-[#A78BFA]" />}
                          </div>

                          {/* Title and tags */}
                          <div className="min-w-0">
                            <Link
                              href={`/deliverables/${item.id}`}
                              className="text-sm font-semibold text-[#F2F0F7] hover:text-[#A78BFA] truncate block max-w-md group transition-colors"
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
                                    : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
                                }`}
                              >
                                {item.platform}
                              </span>
                              <span className="capitalize text-[#A3A0B0] font-medium bg-[#101014] border border-white/[0.08] px-2 py-0.5 rounded-md font-mono text-[10px]">
                                {item.deliverable_type}
                              </span>
                              <span className="text-[#A3A0B0] font-mono text-[10px]">
                                Engagement: <strong className="text-[#A78BFA]">{postEngagementRate}%</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Performance stats row */}
                        <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto font-mono">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <Eye className="w-3.5 h-3.5 text-[#69A9D8]" />
                              <span>{item.views_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Views</span>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <Heart className="w-3.5 h-3.5 text-[#E16F7B]" />
                              <span>{item.likes_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Likes</span>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <MessageCircle className="w-3.5 h-3.5 text-[#69A9D8]" />
                              <span>{item.comments_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Comments</span>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 pl-2 font-sans">
                            {liveUrl ? (
                              <a
                                href={liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-all active:scale-[0.98]"
                              >
                                <span>Live</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <Link
                                href={`/deliverables/${item.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#A78BFA] bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] rounded-xl transition-all active:scale-[0.98]"
                              >
                                <span>Inspect</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 2: LIVE META SOCIAL FEED */}
            {activeTab === "live_feed" && (
              filteredLivePosts.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
                    <Radio className="w-5 h-5 text-[#A3A0B0]" />
                  </div>
                  <p className="text-xs font-semibold text-[#F2F0F7]">No live Meta posts retrieved</p>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Connect client social accounts or publish posts to view live feed telemetry.
                  </p>
                </div>
              ) : (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLivePosts.map((post) => {
                    const isInstagram = post.platform === "instagram";
                    const isFacebook = post.platform === "facebook";
                    const formattedDate = post.timestamp
                      ? new Date(post.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Recent";

                    return (
                      <div
                        key={post.id}
                        className="rounded-xl bg-[#101014] border border-white/[0.08] overflow-hidden flex flex-col justify-between hover:border-white/[0.2] transition-all group"
                      >
                        {/* Media image or placeholder */}
                        <div className="relative aspect-video w-full bg-[#17171E] overflow-hidden flex items-center justify-center">
                          {post.media_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={post.media_url}
                              alt={post.caption || "Meta Live Post"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Hide broken images and show fallback icon
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="text-center p-4">
                              {post.media_type === "VIDEO" ? (
                                <Film className="w-8 h-8 text-[#A78BFA] mx-auto opacity-40" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-[#69A9D8] mx-auto opacity-40" />
                              )}
                              <span className="text-[10px] font-mono text-[#A3A0B0] block mt-1">
                                {post.media_type || "Post"}
                              </span>
                            </div>
                          )}

                          {/* Platform badge */}
                          <div className="absolute top-2.5 left-2.5">
                            <span
                              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                isInstagram
                                  ? "bg-[#E16F7B] text-white border-[#E16F7B]/50 shadow-xs"
                                  : isFacebook
                                  ? "bg-[#69A9D8] text-white border-[#69A9D8]/50 shadow-xs"
                                  : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
                              }`}
                            >
                              {post.platform}
                            </span>
                          </div>

                          {/* Match badge */}
                          {post.is_deliverable_match && (
                            <div className="absolute top-2.5 right-2.5">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#45B88A] text-[#101014] shadow-xs inline-flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" />
                                AgencyOS Asset
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content & Metrics */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            {post.deliverable_title && (
                              <p className="text-xs font-bold text-[#45B88A] line-clamp-1">
                                {post.deliverable_title}
                              </p>
                            )}
                            <p className="text-xs text-[#F2F0F7] line-clamp-3 leading-relaxed">
                              {post.caption || "No caption text"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                                <Heart className="w-3 h-3 text-[#E16F7B]" />
                                <span>{post.likes_count}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                                <MessageCircle className="w-3 h-3 text-[#69A9D8]" />
                                <span>{post.comments_count}</span>
                              </span>
                            </div>

                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-sans font-semibold text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Empty State: No clients in Agency */}
      {!loadingClients && clients.length === 0 && (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">No Clients Found</h3>
          <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
            Add your agency clients and define monthly retainer contracts to start auditing deliverables and generating performance reports.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] text-[#101014] text-xs font-bold rounded-xl shadow-xs hover:bg-[#B69BFF] transition-all"
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
        <div className="p-8 text-center text-xs text-[#A3A0B0]">Loading performance reports...</div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
