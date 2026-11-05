"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { approvalApi } from "@/lib/api";
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Film,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
  Users,
  Layers,
} from "lucide-react";

interface QueueItem {
  deliverable_id: string;
  deliverable_title: string;
  deliverable_type: string;
  platform: string;
  status: string;
  client_id: string;
  client_name: string;
  campaign_id: string;
  campaign_name: string;
  latest_version_number: number | null;
  latest_version_id: string | null;
  latest_file_name: string | null;
  latest_checksum: string | null;
  planned_date: string | null;
  updated_at: string;
  last_comment: string | null;
  last_comment_author: string | null;
  last_comment_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  client_review:    { label: "Awaiting Client Review", badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: Clock },
  internal_review:  { label: "Internal Review",        badge: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500",   icon: FileCheck2 },
  changes_requested:{ label: "Changes Requested",      badge: "bg-rose-50 text-rose-700 border-rose-200",      dot: "bg-rose-500",   icon: AlertCircle },
  approved:         { label: "Approved",               badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  youtube:   "bg-red-50 text-red-700 border-red-200",
  facebook:  "bg-blue-50 text-blue-700 border-blue-200",
  linkedin:  "bg-sky-50 text-sky-700 border-sky-200",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ApprovalsContent() {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "client_review" | "changes_requested" | "approved">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!token || !effectiveAgencyId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = (await approvalApi.queue(effectiveAgencyId, token)) as QueueItem[];
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load approvals queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const counts = {
    all: items.length,
    client_review: items.filter((i) => i.status === "client_review").length,
    changes_requested: items.filter((i) => i.status === "changes_requested").length,
    approved: items.filter((i) => i.status === "approved").length,
  };

  if (loading) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading approvals queue...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </span>
            Approvals Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track client review status, revision requests, and approved content across all campaigns.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: "all",               label: "All Items",           color: "bg-slate-900 text-white" },
          { key: "client_review",     label: "Awaiting Review",     color: "bg-amber-500 text-white" },
          { key: "changes_requested", label: "Changes Requested",   color: "bg-rose-500 text-white" },
          { key: "approved",          label: "Approved",            color: "bg-emerald-500 text-white" },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`p-4 rounded-2xl border text-left transition-all ${
              filter === key
                ? "border-purple-300 bg-purple-50 shadow-sm"
                : "bg-white border-slate-200/80 hover:border-purple-200 hover:bg-purple-50/30"
            }`}
          >
            <div className={`text-2xl font-black mb-1 inline-flex items-center justify-center w-10 h-10 rounded-xl ${color}`}>
              {counts[key as keyof typeof counts]}
            </div>
            <p className="text-xs font-bold text-slate-600 mt-2">{label}</p>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-14 text-center shadow-2xs">
          <FileCheck2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-800">
            {filter === "all" ? "No items in the queue" : `No deliverables with status "${filter.replace("_", " ")}"`}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Deliverables appear here when they are moved to internal review, client review, or approval stages.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const st = STATUS_CONFIG[item.status] || STATUS_CONFIG["client_review"];
              const StatusIcon = st.icon;
              const platformColor = PLATFORM_COLORS[item.platform.toLowerCase()] || "bg-slate-50 text-slate-700 border-slate-200";
              const isVideo = item.latest_file_name?.match(/\.(mp4|mov|webm)$/i);

              return (
                <div key={item.deliverable_id} className="flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-colors group">
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0 w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/deliverables/${item.deliverable_id}`}
                        className="text-sm font-bold text-slate-900 hover:text-purple-700 truncate max-w-[260px] group-hover:underline"
                      >
                        {item.deliverable_title}
                      </Link>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${st.badge}`}>
                        <StatusIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${platformColor}`}>
                        {item.platform}
                      </span>
                      {item.latest_version_number && (
                        <span className="text-[10px] font-black text-slate-400">v{item.latest_version_number}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.client_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {item.campaign_name}
                      </span>
                      {item.planned_date && (
                        <span className="flex items-center gap-1">
                          📅 {item.planned_date}
                        </span>
                      )}
                      <span className="text-slate-400">Updated {formatRelativeTime(item.updated_at)}</span>
                    </div>

                    {/* Last comment */}
                    {item.last_comment && (
                      <div className="mt-2 flex items-start gap-1.5 max-w-lg">
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">
                          {item.last_comment_author || "Client"}:
                        </span>
                        <p className="text-[11px] text-slate-600 italic line-clamp-1">
                          "{item.last_comment}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Link
                    href={`/deliverables/${item.deliverable_id}`}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    View
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading approvals...</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
