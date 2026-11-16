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
  client_review:    { label: "Awaiting Client Review", badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",   dot: "bg-[#E5AA58]",  icon: Clock },
  internal_review:  { label: "Internal Review",        badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",   dot: "bg-[#69A9D8]",  icon: FileCheck2 },
  changes_requested:{ label: "Changes Requested",      badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",   dot: "bg-[#E16F7B]",  icon: AlertCircle },
  approved:         { label: "Approved",               badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",   dot: "bg-[#45B88A]",  icon: CheckCircle2 },
  scheduled:        { label: "Scheduled",              badge: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30",   dot: "bg-[#A78BFA]",  icon: Clock },
  publishing:       { label: "Publishing...",          badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",   dot: "bg-[#69A9D8]",  icon: RefreshCw },
  partially_published: { label: "Partially Published", badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",   dot: "bg-[#E5AA58]",  icon: AlertCircle },
  published:        { label: "Published Live",         badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",   dot: "bg-[#45B88A]",  icon: Send },
  needs_reconnection: { label: "Auth Needed",          badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",   dot: "bg-[#E16F7B]",  icon: AlertCircle },
  ambiguous:        { label: "Reconciling",            badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",   dot: "bg-[#E5AA58]",  icon: AlertCircle },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
  youtube:   "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
  facebook:  "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
  linkedin:  "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
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
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#71717A]">Loading approvals queue...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-[#20202A] text-[#A78BFA] border border-[#30303D] rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </span>
            Approvals Queue
          </h1>
          <p className="text-sm text-[#A3A0B0] mt-1">
            Review client feedback, approved deliverables, and live published posts across your agency.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F2F0F7] bg-[#17171E] border border-[#30303D] hover:bg-[#20202A] rounded-xl transition-colors self-start sm:self-auto disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#A78BFA]" : "text-[#71717A]"}`} />
          <span>Refresh</span>
        </button>
      </div>

      {statusNotification && (
        <div className="mb-6 p-4 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[#A78BFA] text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#A78BFA] shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button
            onClick={() => setStatusNotification(null)}
            className="text-[#A78BFA] hover:text-[#B69BFF] text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#E16F7B] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-1 bg-[#17171E] border border-[#30303D] rounded-xl w-fit">
        <button
          onClick={() => handleTabChange("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filter === "all" ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => handleTabChange("client_review")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "client_review" ? "bg-[#20202A] text-[#E5AA58] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#E5AA58]" />
          In Review ({counts.client_review})
        </button>
        <button
          onClick={() => handleTabChange("changes_requested")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "changes_requested" ? "bg-[#20202A] text-[#E16F7B] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#E16F7B]" />
          Changes ({counts.changes_requested})
        </button>
        <button
          onClick={() => handleTabChange("approved")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "approved" ? "bg-[#20202A] text-[#45B88A] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#45B88A]" />
          Ready to Publish ({counts.approved})
        </button>
        <button
          onClick={() => handleTabChange("scheduled")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "scheduled" ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
          Scheduled ({counts.scheduled})
        </button>
        <button
          onClick={() => handleTabChange("published")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "published" ? "bg-[#20202A] text-[#45B88A] border border-[#30303D] font-bold" : "text-[#71717A] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#45B88A]" />
          Published Live ({counts.published})
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-[#30303D] text-[#45B88A] flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-[#45B88A]" />
          </div>
          <h3 className="text-sm font-heading font-bold text-[#F2F0F7] mb-1">Queue is clear</h3>
          <p className="text-xs text-[#A3A0B0]">
            {filter === "all" ? "No deliverables currently in the approvals queue." : `No items with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] overflow-hidden">
          <div className="divide-y divide-[#30303D]/60">
            {filtered.map((item) => {
              const st = STATUS_CONFIG[item.status] || STATUS_CONFIG["client_review"];
              const StatusIcon = st.icon;
              const displayPlatform = (item.publishing_platform || item.platform || "instagram").toLowerCase();
              const platformColor = PLATFORM_COLORS[displayPlatform] || "bg-[#20202A] text-[#A3A0B0] border-[#30303D]";
              const isVideo = item.latest_file_name?.match(/\.(mp4|mov|webm)$/i);

              return (
                <div key={item.deliverable_id} className="flex items-start gap-4 p-5 hover:bg-[#20202A]/40 transition-colors group">
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0 w-9 h-9 rounded-xl bg-[#20202A] border border-[#30303D] text-[#A3A0B0] flex items-center justify-center">
                    {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                        className="text-sm font-semibold text-[#F2F0F7] hover:text-[#A78BFA] truncate max-w-[260px] group-hover:underline"
                      >
                        {item.deliverable_title}
                      </Link>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${st.badge}`}>
                        <StatusIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${platformColor}`}>
                        {displayPlatform}
                      </span>
                      {item.latest_version_number && (
                        <span className="text-[10px] font-mono font-bold text-[#71717A]">v{item.latest_version_number}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A3A0B0]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#71717A]" />
                        {item.client_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-[#71717A]" />
                        {item.campaign_name}
                      </span>
                      {item.planned_date && (
                        <span className="flex items-center gap-1 font-mono">
                          📅 {item.planned_date}
                        </span>
                      )}
                      <span className="text-[#71717A]">Updated {formatRelativeTime(item.updated_at)}</span>
                    </div>

                    {/* Published Performance Metrics */}
                    {(item.status === "published" || item.status === "partially_published") && (
                      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-[#30303D]/60 text-[11px] font-mono font-semibold">
                        <span className="flex items-center gap-1 text-[#A3A0B0] bg-[#101014] border border-[#30303D] px-2 py-0.5 rounded-md">
                          <Eye className="w-3 h-3 text-[#71717A]" />
                          <span>{item.views_count?.toLocaleString() || 0} views</span>
                        </span>
                        <span className="flex items-center gap-1 text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-2 py-0.5 rounded-md">
                          <Heart className="w-3 h-3 text-[#E16F7B] fill-[#E16F7B]" />
                          <span>{item.likes_count?.toLocaleString() || 0} likes</span>
                        </span>
                        <span className="flex items-center gap-1 text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-2 py-0.5 rounded-md">
                          <MessageCircle className="w-3 h-3 text-[#69A9D8]" />
                          <span>{item.comments_count?.toLocaleString() || 0} comments</span>
                        </span>
                        {item.shares_count !== undefined && item.shares_count !== null && (
                          <span className="flex items-center gap-1 text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-md">
                            <Share2 className="w-3 h-3 text-[#45B88A]" />
                            <span>{item.shares_count?.toLocaleString() || 0} shares</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Last comment */}
                    {item.last_comment && item.status !== "published" && (
                      <div className="mt-2 flex items-start gap-1.5 max-w-lg">
                        <span className="text-[11px] font-semibold text-[#71717A] shrink-0">
                          {item.last_comment_author || "Client"}:
                        </span>
                        <p className="text-[11px] text-[#A3A0B0] italic line-clamp-1">
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
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#A78BFA] bg-[#101014] hover:bg-[#20202A] border border-[#30303D] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Clock className="w-3 h-3 text-[#A78BFA]" />
                        <span>Manage Schedule</span>
                      </Link>
                    )}

                    {item.status === "approved" && (
                      <button
                        onClick={() => setPublishingItem(item)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
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
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingId === item.deliverable_id ? "animate-spin text-[#A78BFA]" : "text-[#71717A]"}`} />
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
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3 text-[#71717A]" />
                            <span className="hidden sm:inline">Live Post</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleUnpublish(item)}
                          disabled={unpublishingId === item.deliverable_id}
                          title="Remove from Published Live"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E16F7B] bg-[#20202A] hover:bg-[#E16F7B]/20 border border-[#30303D] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Undo2 className={`w-3 h-3 ${unpublishingId === item.deliverable_id ? "animate-spin text-[#E16F7B]" : "text-[#71717A]"}`} />
                          <span className="hidden sm:inline">{unpublishingId === item.deliverable_id ? "Removing..." : "Unpublish"}</span>
                        </button>
                      </>
                    )}

                    <Link
                      href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] hover:text-[#B69BFF] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#71717A]">Loading approvals...</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}