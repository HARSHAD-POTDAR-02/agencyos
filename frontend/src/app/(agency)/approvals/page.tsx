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
  AlertTriangle,
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
  Building2,
  Calendar,
  Sparkles,
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

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string; icon: React.ElementType }
> = {
  client_review: {
    label: "Awaiting Client Review",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    dot: "bg-[#E5AA58]",
    icon: Clock,
  },
  internal_review: {
    label: "Internal Review",
    badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
    dot: "bg-[#69A9D8]",
    icon: FileCheck2,
  },
  changes_requested: {
    label: "Changes Requested",
    badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
    dot: "bg-[#E16F7B]",
    icon: AlertCircle,
  },
  approved: {
    label: "Approved",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    dot: "bg-[#45B88A]",
    icon: CheckCircle2,
  },
  scheduled: {
    label: "Scheduled",
    badge: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30",
    dot: "bg-[#A78BFA]",
    icon: Clock,
  },
  publishing: {
    label: "Publishing...",
    badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
    dot: "bg-[#69A9D8]",
    icon: RefreshCw,
  },
  partially_published: {
    label: "Partially Published",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    dot: "bg-[#E5AA58]",
    icon: AlertCircle,
  },
  published: {
    label: "Published Live",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    dot: "bg-[#45B88A]",
    icon: Send,
  },
  needs_reconnection: {
    label: "Auth Needed",
    badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
    dot: "bg-[#E16F7B]",
    icon: AlertCircle,
  },
  ambiguous: {
    label: "Reconciling",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    dot: "bg-[#E5AA58]",
    icon: AlertCircle,
  },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
  youtube: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
  facebook: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
  linkedin: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
  tiktok: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30",
};

function getMonogram(name?: string | null): string {
  if (!name || !name.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

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
  const tabParam = searchParams.get("tab") as
    | "all"
    | "client_review"
    | "changes_requested"
    | "approved"
    | "scheduled"
    | "published"
    | null;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "client_review" | "changes_requested" | "approved" | "scheduled" | "published"
  >(() => {
    if (
      tabParam &&
      ["all", "client_review", "changes_requested", "approved", "scheduled", "published"].includes(
        tabParam
      )
    ) {
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
    if (
      tabParam &&
      ["all", "client_review", "changes_requested", "approved", "scheduled", "published"].includes(
        tabParam
      )
    ) {
      setFilter(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (
    newTab: "all" | "client_review" | "changes_requested" | "approved" | "scheduled" | "published"
  ) => {
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

  const load = useCallback(
    async (silent = false) => {
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
    },
    [token, effectiveAgencyId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keyboard navigation: 'R' to refresh, numbers '1'..'6' for tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        load(true);
      } else if (e.key === "1") {
        handleTabChange("all");
      } else if (e.key === "2") {
        handleTabChange("client_review");
      } else if (e.key === "3") {
        handleTabChange("changes_requested");
      } else if (e.key === "4") {
        handleTabChange("approved");
      } else if (e.key === "5") {
        handleTabChange("scheduled");
      } else if (e.key === "6") {
        handleTabChange("published");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [load]);

  const handleSyncMetrics = async (item: QueueItem) => {
    if (!token || !effectiveAgencyId) return;
    setSyncingId(item.deliverable_id);
    setStatusNotification(null);
    try {
      const res = await publishingApi.syncMetrics(effectiveAgencyId, item.deliverable_id, token);
      if (res.post_deleted) {
        setStatusNotification(
          `Post "${item.deliverable_title}" was deleted on ${
            item.publishing_platform || "Meta"
          }. It has been removed from Published Live and returned to Ready to Publish.`
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
      setStatusNotification(
        `"${item.deliverable_title}" has been unpublished and moved back to Ready to Publish.`
      );
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
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin" />
          <p className="text-xs font-mono text-[#A3A0B0]">Loading approvals queue...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Approvals Queue</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Approvals & Publishing Queue
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Review client feedback, internal inspection queues, and verified live social releases across all agency workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh queue (Press R)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F2F0F7] surface-card border border-white/[0.08] hover:bg-[#20202A] rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`}
            />
            <span>Refresh</span>
            <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">R</kbd>
          </button>
        </div>
      </div>

      {statusNotification && (
        <div className="p-3.5 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[#A78BFA] text-xs font-medium flex items-center justify-between gap-3 shadow-xs">
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
        <div className="p-3.5 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-[#E16F7B] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Linear Filter Toolstrip ── */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 surface-card border border-white/[0.08] rounded-xl w-fit shadow-xs">
        <button
          onClick={() => handleTabChange("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === "all"
              ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span>All ({counts.all})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">1</kbd>
        </button>
        <button
          onClick={() => handleTabChange("client_review")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "client_review"
              ? "bg-white/[0.08] text-[#E5AA58] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5AA58]" />
          <span>In Review ({counts.client_review})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">2</kbd>
        </button>
        <button
          onClick={() => handleTabChange("changes_requested")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "changes_requested"
              ? "bg-white/[0.08] text-[#E16F7B] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#E16F7B]" />
          <span>Changes ({counts.changes_requested})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">3</kbd>
        </button>
        <button
          onClick={() => handleTabChange("approved")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "approved"
              ? "bg-white/[0.08] text-[#45B88A] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A]" />
          <span>Ready to Publish ({counts.approved})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">4</kbd>
        </button>
        <button
          onClick={() => handleTabChange("scheduled")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "scheduled"
              ? "bg-white/[0.08] text-[#A78BFA] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" />
          <span>Scheduled ({counts.scheduled})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">5</kbd>
        </button>
        <button
          onClick={() => handleTabChange("published")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            filter === "published"
              ? "bg-white/[0.08] text-[#45B88A] font-semibold shadow-xs"
              : "text-[#A3A0B0] hover:text-[#F2F0F7]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A]" />
          <span>Published Live ({counts.published})</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#71717A]">6</kbd>
        </button>
      </div>

      {/* ── Deliverables Queue Surface ── */}
      {filtered.length === 0 ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-16 text-center shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#45B88A] flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-5 h-5 text-[#45B88A]" />
          </div>
          <h3 className="text-sm font-heading font-semibold text-[#F2F0F7] mb-1">Queue is clear</h3>
          <p className="text-xs text-[#A3A0B0] font-mono">
            {filter === "all"
              ? "No deliverables currently in the approvals queue."
              : `No items with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs divide-y divide-white/[0.04]">
          {filtered.map((item) => {
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG["client_review"];
            const StatusIcon = st.icon;
            const displayPlatform = (
              item.publishing_platform ||
              item.platform ||
              "instagram"
            ).toLowerCase();
            const platformColor =
              PLATFORM_COLORS[displayPlatform] || "bg-[#20202A] text-[#A3A0B0] border-[#30303D]";
            const isVideo = item.latest_file_name?.match(/\.(mp4|mov|webm)$/i);

            return (
              <div
                key={item.deliverable_id}
                className="flex items-start gap-4 p-5 hover:bg-white/[0.02] transition-colors group relative"
              >
                {/* Type icon / Monogram */}
                <div className="mt-0.5 shrink-0 w-10 h-10 rounded-xl bg-[#101014] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center shadow-xs">
                  {isVideo ? (
                    <Film className="w-4 h-4 text-[#A78BFA]" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-[#69A9D8]" />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                      className="text-sm font-heading font-semibold text-[#F2F0F7] hover:text-[#A78BFA] transition-colors truncate max-w-[320px]"
                    >
                      {item.deliverable_title}
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${st.badge}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {st.label}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${platformColor}`}
                    >
                      {displayPlatform}
                    </span>
                    {item.latest_version_number && (
                      <span className="text-[10px] font-mono font-bold text-[#71717A] bg-[#101014] px-1.5 py-0.5 rounded border border-white/[0.06]">
                        v{item.latest_version_number}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A3A0B0]">
                    <span className="flex items-center gap-1 font-medium text-[#F2F0F7]">
                      <span className="w-4 h-4 rounded-md bg-[#20202A] text-[#A78BFA] text-[8px] font-mono font-bold flex items-center justify-center border border-white/[0.08]">
                        {getMonogram(item.client_name)}
                      </span>
                      <span>{item.client_name}</span>
                    </span>
                    <span className="text-white/[0.2]">·</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#71717A]" />
                      <span className="text-[#A3A0B0]">{item.campaign_name}</span>
                    </span>
                    {item.planned_date && (
                      <>
                        <span className="text-white/[0.2]">·</span>
                        <span className="flex items-center gap-1 font-mono text-[#A3A0B0]">
                          <Calendar className="w-3 h-3 text-[#71717A]" />
                          <span>{item.planned_date}</span>
                        </span>
                      </>
                    )}
                    <span className="text-white/[0.2]">·</span>
                    <span className="text-[#71717A] font-mono">
                      Updated {formatRelativeTime(item.updated_at)}
                    </span>
                  </div>

                  {/* Published Performance Metrics */}
                  {(item.status === "published" || item.status === "partially_published") && (
                    <div className="flex flex-wrap items-center gap-2.5 mt-2 pt-2 border-t border-white/[0.06] text-[11px] font-mono font-semibold">
                      <span className="flex items-center gap-1 text-[#A3A0B0] bg-[#101014] border border-white/[0.08] px-2 py-0.5 rounded-md">
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

                  {/* Last Feedback Snippet */}
                  {item.last_comment && item.status !== "published" && (
                    <div className="mt-2 flex items-start gap-2 bg-[#101014] p-2.5 rounded-xl border border-white/[0.06] max-w-xl">
                      <span className="text-[10px] font-mono font-bold text-[#A78BFA] shrink-0 uppercase">
                        {item.last_comment_author || "Client"}:
                      </span>
                      <p className="text-[11px] text-[#A3A0B0] italic line-clamp-1 leading-snug">
                        "{item.last_comment}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2 self-center">
                  {item.status === "scheduled" && (
                    <Link
                      href={`/deliverables/${item.deliverable_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] bg-[#101014] hover:bg-[#20202A] border border-white/[0.08] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                      <Clock className="w-3 h-3 text-[#A78BFA]" />
                      <span>Schedule</span>
                    </Link>
                  )}

                  {item.status === "approved" && (
                    <button
                      onClick={() => setPublishingItem(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
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
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${
                            syncingId === item.deliverable_id
                              ? "animate-spin text-[#A78BFA]"
                              : "text-[#71717A]"
                          }`}
                        />
                        <span className="hidden sm:inline">
                          {syncingId === item.deliverable_id ? "Syncing..." : "Sync Stats"}
                        </span>
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
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="w-3 h-3 text-[#71717A]" />
                          <span className="hidden sm:inline">Live Post</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleUnpublish(item)}
                        disabled={unpublishingId === item.deliverable_id}
                        title="Remove from Published Live"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#E16F7B] bg-[#20202A] hover:bg-[#E16F7B]/20 border border-white/[0.08] px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Undo2
                          className={`w-3 h-3 ${
                            unpublishingId === item.deliverable_id
                              ? "animate-spin text-[#E16F7B]"
                              : "text-[#71717A]"
                          }`}
                        />
                        <span className="hidden sm:inline">
                          {unpublishingId === item.deliverable_id ? "Removing..." : "Unpublish"}
                        </span>
                      </button>
                    </>
                  )}

                  <Link
                    href={`/deliverables/${item.deliverable_id}?from=approvals&tab=${filter}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#A78BFA] hover:text-[#B69BFF] bg-[#17171E] hover:bg-[#20202A] border border-white/[0.08] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
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
          onSuccess={() => {
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
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-[#71717A]">
          Loading approvals queue...
        </div>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}
