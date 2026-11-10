"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { approvalApi, publishingApi } from "@/lib/api";
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
  Send,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Undo2,
  Check,
} from "lucide-react";
import PublishModal from "@/components/publishing/PublishModal";

interface QueueItem {
  deliverable_id: string;
  deliverable_title: string;
  deliverable_type: string;
  platform: string;
  publishing_platform?: string | null;
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
  live_post_url?: string | null;
  views_count?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  client_review:    { label: "Awaiting Client Review", badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: Clock },
  internal_review:  { label: "Internal Review",        badge: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500",   icon: FileCheck2 },
  changes_requested:{ label: "Changes Requested",      badge: "bg-rose-50 text-rose-700 border-rose-200",      dot: "bg-rose-500",   icon: AlertCircle },
  approved:         { label: "Approved",               badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
  scheduled:        { label: "Scheduled",              badge: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", icon: Clock },
  publishing:       { label: "Publishing...",          badge: "bg-sky-50 text-sky-700 border-sky-200",         dot: "bg-sky-500",    icon: RefreshCw },
  partially_published: { label: "Partially Published", badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: AlertCircle },
  published:        { label: "Published Live",         badge: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500", icon: Send },
  needs_reconnection: { label: "Auth Needed",          badge: "bg-rose-50 text-rose-700 border-rose-200",      dot: "bg-rose-500",   icon: AlertCircle },
  ambiguous:        { label: "Reconciling",            badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: AlertCircle },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  youtube:   "bg-red-50 text-red-700 border-red-200",
  facebook:  "bg-blue-50 text-blue-700 border-blue-200",
  linkedin:  "bg-sky-50 text-sky-700 border-sky-200",
};

function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const hasTimezone = iso.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(iso);
  const normalized = hasTimezone ? iso : `${iso.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(iso) : d;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - parseDate(iso).getTime();
  if (diff < 0) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ApprovalsContent() {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as "all" | "client_review" | "changes_requested" | "approved" | "scheduled" | "published" | null;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "client_review" | "changes_requested" | "approved" | "scheduled" | "published">(() => {
    if (tabParam && ["all", "client_review", "changes_requested", "approved", "scheduled", "published"].includes(tabParam)) {
      return tabParam;
    }
    return "all";
  });
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
  const [publishingItem, setPublishingItem] = useState<QueueItem | null>(null);

  useEffect(() => {
    if (tabParam && ["all", "client_review", "changes_requested", "approved", "scheduled", "published"].includes(tabParam)) {
      setFilter(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: "all" | "client_review" | "changes_requested" | "approved" | "scheduled" | "published") => {
    setFilter(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (newTab === "all") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", newTab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const load = useCallback(async (silent = false) => {
    if (!token || !effectiveAgencyId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = (await approvalApi.queue(effectiveAgencyId, token)) as QueueItem[];
      setItems(data || []);
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      setError(err.message || "Failed to load approvals queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => { load(); }, [load]);

  const handleSyncMetrics = async (item: QueueItem) => {
    if (!token || !effectiveAgencyId) return;
    setSyncingId(item.deliverable_id);
    setStatusNotification(null);
    try {
      const res = await publishingApi.syncMetrics(effectiveAgencyId, item.deliverable_id, token);
      if (res.post_deleted) {
        setStatusNotification(
          `Post "${item.deliverable_title}" was deleted on ${item.publishing_platform || "Meta"}. It has been removed from Published Live and returned to Ready to Publish.`
        );
        await load(true);
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.deliverable_id === item.deliverable_id
              ? {
                  ...it,
                  views_count: res.views_count,
                  likes_count: res.likes_count,
                  comments_count: res.comments_count,
                  shares_count: res.shares_count,
                }
              : it
          )
        );
      }
    } catch (err: any) {
      console.error("Failed to sync metrics:", err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleUnpublish = async (item: QueueItem) => {
    if (!token || !effectiveAgencyId) return;
    const ok = window.confirm(
      `Remove "${item.deliverable_title}" from Published Live? This deliverable will be moved back to Ready to Publish.`
    );
    if (!ok) return;

    setUnpublishingId(item.deliverable_id);
    setStatusNotification(null);
    try {
      await publishingApi.unpublish(effectiveAgencyId, item.deliverable_id, token);
      setStatusNotification(`"${item.deliverable_title}" has been unpublished and moved back to Ready to Publish.`);
      await load(true);
      window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
    } catch (err: any) {
      alert(err.message || "Failed to unpublish deliverable.");
    } finally {
      setUnpublishingId(null);
    }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const counts = {
    all: items.length,
    client_review: items.filter((i) => i.status === "client_review").length,
    changes_requested: items.filter((i) => i.status === "changes_requested").length,
    approved: items.filter((i) => i.status === "approved").length,
    scheduled: items.filter((i) => i.status === "scheduled" || i.status === "publishing").length,
    published: items.filter((i) => i.status === "published").length,
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
            Review client feedback, approved deliverables, and live published posts across your agency.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors self-start sm:self-auto disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {statusNotification && (
        <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button
            onClick={() => setStatusNotification(null)}
            className="text-purple-600 hover:text-purple-900 text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => handleTabChange("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === "all" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => handleTabChange("client_review")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "client_review" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          In Review ({counts.client_review})
        </button>
        <button
          onClick={() => handleTabChange("changes_requested")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "changes_requested" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Changes ({counts.changes_requested})
        </button>
        <button
          onClick={() => handleTabChange("approved")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "approved" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Ready to Publish ({counts.approved})
        </button>
        <button
          onClick={() => handleTabChange("scheduled")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "scheduled" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Scheduled ({counts.scheduled})
        </button>
        <button
          onClick={() => handleTabChange("published")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "published" ? "bg-white text-purple-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Published Live ({counts.published})
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">Queue is clear</h3>
          <p className="text-xs text-slate-500">
            {filter === "all" ? "No deliverables currently in the approvals queue." : `No items with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const st = STATUS_CONFIG[item.status] || STATUS_CONFIG["client_review"];
              const StatusIcon = st.icon;
              const displayPlatform = (item.publishing_platform || item.platform || "instagram").toLowerCase();
              const platformColor = PLATFORM_COLORS[displayPlatform] || "bg-slate-50 text-slate-700 border-slate-200";
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
                        href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                        className="text-sm font-bold text-slate-900 hover:text-purple-700 truncate max-w-[260px] group-hover:underline"
                      >
                        {item.deliverable_title}
                      </Link>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${st.badge}`}>
                        <StatusIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${platformColor}`}>
                        {displayPlatform}
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

                    {/* Published Performance Metrics */}
                    {(item.status === "published" || item.status === "partially_published") && (
                      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>{item.views_count?.toLocaleString() || 0} views</span>
                        </span>
                        <span className="flex items-center gap-1 text-pink-700 bg-pink-50 border border-pink-200/60 px-2 py-0.5 rounded-md">
                          <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
                          <span>{item.likes_count?.toLocaleString() || 0} likes</span>
                        </span>
                        <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                          <MessageCircle className="w-3 h-3 text-indigo-500" />
                          <span>{item.comments_count?.toLocaleString() || 0} comments</span>
                        </span>
                        {item.shares_count !== undefined && item.shares_count !== null && (
                          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                            <Share2 className="w-3 h-3 text-emerald-500" />
                            <span>{item.shares_count?.toLocaleString() || 0} shares</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Last comment */}
                    {item.last_comment && item.status !== "published" && (
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

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {item.status === "scheduled" && (
                      <Link
                        href={`/deliverables/${item.deliverable_id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <Clock className="w-3 h-3 text-indigo-600" />
                        <span>Manage Schedule</span>
                      </Link>
                    )}

                    {item.status === "approved" && (
                      <button
                        onClick={() => setPublishingItem(item)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-3 py-1.5 rounded-lg shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Publish</span>
                      </button>
                    )}

                    {(item.status === "published" || item.status === "partially_published") && (
                      <>
                        <button
                          onClick={() => handleSyncMetrics(item)}
                          disabled={syncingId === item.deliverable_id}
                          title="Sync live likes, comments, and views from Meta"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingId === item.deliverable_id ? "animate-spin text-purple-600" : "text-slate-500"}`} />
                          <span className="hidden sm:inline">{syncingId === item.deliverable_id ? "Syncing..." : "Sync Stats"}</span>
                        </button>

                        {item.live_post_url && (
                          <a
                            href={
                              item.live_post_url.startsWith("http")
                                ? item.live_post_url
                                : `https://www.facebook.com${item.live_post_url}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                            <span className="hidden sm:inline">Live Post</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleUnpublish(item)}
                          disabled={unpublishingId === item.deliverable_id}
                          title="Remove from Published Live"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Undo2 className={`w-3 h-3 ${unpublishingId === item.deliverable_id ? "animate-spin text-rose-600" : "text-slate-500"}`} />
                          <span className="hidden sm:inline">{unpublishingId === item.deliverable_id ? "Removing..." : "Unpublish"}</span>
                        </button>
                      </>
                    )}

                    <Link
                      href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      View
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PUBLISH MODAL */}
      {publishingItem && (
        <PublishModal
          isOpen={true}
          onClose={() => setPublishingItem(null)}
          deliverableId={publishingItem.deliverable_id}
          deliverableTitle={publishingItem.deliverable_title}
          deliverableType={publishingItem.deliverable_type}
          platform={publishingItem.publishing_platform || publishingItem.platform}
          clientId={publishingItem.client_id}
          clientName={publishingItem.client_name}
          onSuccess={(result) => {
            load(true);
            window.dispatchEvent(new CustomEvent("agencyos:badge-refresh"));
          }}
        />
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
