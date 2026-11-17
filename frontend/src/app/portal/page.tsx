"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { portalApi } from "@/lib/api";
import {
  Building2,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
  RefreshCw,
  Check,
  Calendar,
  Layers,
  ExternalLink,
  CheckSquare,
  Square,
  Zap,
} from "lucide-react";

interface PortalClient {
  id: string;
  business_name: string;
  industry: string | null;
}

interface QueueItem {
  id: string;
  title: string;
  client_id: string;
  client_name: string | null;
  campaign_id?: string;
  campaign_name?: string | null;
  deliverable_type: string;
  platform: string;
  status: string;
  planned_date: string | null;
  scheduled_at: string | null;
  scheduled_timezone: string | null;
  live_post_url: string | null;
  publishing_platform: string | null;
  is_auto_scheduled?: boolean;
  updated_at: string;
  content_versions: { id: string; version_number: number; file_name: string }[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  client_review: {
    label: "Awaiting Your Review",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    icon: Clock,
  },
  changes_requested: {
    label: "Changes Requested",
    badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",
    icon: AlertCircle,
  },
  approved: {
    label: "Approved ✓",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    icon: CheckCircle2,
  },
  scheduled: {
    label: "Approved ✓ • Auto-Scheduled",
    badge: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30",
    icon: Calendar,
  },
  publishing: {
    label: "Publishing Live…",
    badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",
    icon: RefreshCw,
  },
  partially_published: {
    label: "Partially Published",
    badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",
    icon: AlertCircle,
  },
  published: {
    label: "Published Live",
    badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",
    icon: CheckCircle2,
  },
};

function getMonogram(name?: string | null): string {
  if (!name || !name.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PortalHomeContent() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<PortalClient[]>([]);
  const [deliverables, setDeliverables] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<"pending" | "approved" | "all">("pending");

  // Multi-item batch approval state
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Protect client portal: redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/login");
    }
  }, [authLoading, token, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const cls = (await portalApi.clients(token)) as PortalClient[];
      setClients(cls || []);

      const delivs = (await portalApi.deliverables(
        token,
        selectedClientId || undefined
      )) as any[];
      setDeliverables(delivs || []);
    } catch (err: any) {
      setError(err.message || "Failed to load your review queue.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedClientId]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  // Client filtering
  const clientFiltered = selectedClientId
    ? deliverables.filter((d) => d.client_id === selectedClientId)
    : deliverables;

  // Status filtering
  const pendingItems = clientFiltered.filter(
    (d) => d.status === "client_review" || d.status === "changes_requested"
  );
  const approvedItems = clientFiltered.filter(
    (d) =>
      d.status === "approved" ||
      d.status === "scheduled" ||
      d.status === "publishing" ||
      d.status === "partially_published" ||
      d.status === "published"
  );

  const displayedItems =
    statusTab === "pending"
      ? pendingItems
      : statusTab === "approved"
      ? approvedItems
      : clientFiltered;

  // Selection handlers
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDeliverableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPending = () => {
    const allPendingIds = new Set(pendingItems.map((d) => d.id));
    setSelectedDeliverableIds(allPendingIds);
  };

  const clearSelection = () => {
    setSelectedDeliverableIds(new Set());
  };

  const handleBatchApprove = async () => {
    if (!token || selectedDeliverableIds.size === 0) return;
    setBatchSubmitting(true);
    setError(null);
    try {
      const ids = Array.from(selectedDeliverableIds);
      const res = await portalApi.batchDecide(
        ids,
        "approved",
        "Batch approved from client sprint portal.",
        token
      );
      setBatchSuccessMessage(
        `Successfully approved ${res.total_processed} deliverable(s)! ${
          res.scheduled_count > 0 ? `(${res.scheduled_count} auto-scheduled for live publishing)` : ""
        }`
      );
      clearSelection();
      await load();
      setTimeout(() => setBatchSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to batch approve deliverables.");
    } finally {
      setBatchSubmitting(false);
    }
  };

  if (authLoading || (loading && deliverables.length === 0 && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101014] text-[#F2F0F7]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#A78BFA] animate-spin" />
          <p className="text-xs font-mono text-[#A3A0B0]">Loading your review workspace…</p>
        </div>
      </div>
    );
  }

  const primaryClient = clients.length > 0 ? clients[0] : null;

  return (
    <div className="min-h-screen bg-[#101014] text-[#F2F0F7] pb-24">
      {/* ── Top Spatial Header ── */}
      <header className="sticky top-0 z-30 bg-[#17171E] border-b border-white/[0.08] shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] shadow-xs">
              <Sparkles className="w-4 h-4 text-[#A78BFA]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-heading font-bold tracking-tight text-[#F2F0F7]">
                {primaryClient ? primaryClient.business_name : "AgencyOS"}
              </span>
              <span className="text-[10px] font-mono font-bold text-[#A78BFA] bg-[#A78BFA]/10 px-2.5 py-0.5 rounded-full border border-[#A78BFA]/30 uppercase">
                Client Review Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 hidden sm:flex">
              <span className="w-6 h-6 rounded-full bg-[#20202A] text-[#A78BFA] text-[10px] font-mono font-bold flex items-center justify-center border border-white/[0.08]">
                {getMonogram(user?.full_name || user?.email)}
              </span>
              <span className="text-xs text-[#A3A0B0] font-medium">
                {user?.full_name || user?.email}
              </span>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#E16F7B] bg-[#20202A] hover:bg-[#E16F7B]/10 border border-white/[0.08] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ── Welcome Banner ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
              Welcome, {user?.full_name?.split(" ")[0] || "Reviewer"} 👋
            </h1>
            <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
              Review, comment on, and approve your upcoming creative deliverables. Approved content is auto-scheduled and published straight to your connected channels.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {statusTab === "pending" && pendingItems.length > 1 && (
              <button
                onClick={
                  selectedDeliverableIds.size === pendingItems.length
                    ? clearSelection
                    : selectAllPending
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A78BFA] bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  {selectedDeliverableIds.size === pendingItems.length
                    ? "Deselect All"
                    : `Select All (${pendingItems.length})`}
                </span>
              </button>
            )}
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F2F0F7] bg-[#17171E] hover:bg-[#20202A] border border-white/[0.08] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#A3A0B0]" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Brand Switcher (if multiple accounts assigned) */}
        {clients.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedClientId(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                !selectedClientId
                  ? "bg-white/[0.08] text-[#F2F0F7] border-white/[0.12] font-semibold shadow-xs"
                  : "surface-card text-[#A3A0B0] border-white/[0.06] hover:text-[#F2F0F7]"
              }`}
            >
              All Brands
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                  selectedClientId === c.id
                    ? "bg-white/[0.08] text-[#F2F0F7] border-white/[0.12] font-semibold shadow-xs"
                    : "surface-card text-[#A3A0B0] border-white/[0.06] hover:text-[#F2F0F7]"
                }`}
              >
                {c.business_name}
              </button>
            ))}
          </div>
        )}

        {/* ── Linear Filter Toolstrip ── */}
        <div className="flex items-center gap-1.5 p-1 surface-card border border-white/[0.08] rounded-xl w-fit shadow-xs">
          <button
            onClick={() => setStatusTab("pending")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusTab === "pending"
                ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#E5AA58]" />
            <span>Pending Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === "pending"
                  ? "bg-[#E5AA58]/20 text-[#E5AA58]"
                  : "bg-[#101014] text-[#71717A]"
              }`}
            >
              {pendingItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("approved")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusTab === "approved"
                ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
            <span>Approved & Scheduled</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === "approved"
                  ? "bg-[#45B88A]/20 text-[#45B88A]"
                  : "bg-[#101014] text-[#71717A]"
              }`}
            >
              {approvedItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("all")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusTab === "all"
                ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <span>All Content ({clientFiltered.length})</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {batchSuccessMessage && (
          <div className="p-4 bg-[#45B88A]/10 border border-[#45B88A]/30 rounded-xl text-xs font-medium text-[#45B88A] flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{batchSuccessMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-[#E16F7B]/10 border border-[#E16F7B]/30 rounded-xl text-xs font-medium text-[#E16F7B] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={load}
              className="px-2.5 py-1 bg-[#17171E] border border-white/[0.08] text-[#F2F0F7] rounded-lg text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Deliverables Grid ── */}
        {displayedItems.length === 0 ? (
          <div className="surface-card rounded-2xl border border-white/[0.08] p-16 text-center shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-[#45B88A] mx-auto mb-3" />
            <h3 className="text-sm font-heading font-semibold text-[#F2F0F7]">
              {statusTab === "pending"
                ? "All caught up! No content pending review."
                : statusTab === "approved"
                ? "No approved content yet."
                : "No content available."}
            </h3>
            <p className="text-xs text-[#A3A0B0] mt-1 max-w-sm mx-auto leading-relaxed">
              {statusTab === "pending" && approvedItems.length > 0 ? (
                <>
                  You have{" "}
                  <span className="font-semibold text-[#F2F0F7]">
                    {approvedItems.length} approved/scheduled deliverable(s)
                  </span>
                  . Switch to the Approved & Scheduled tab to track upcoming publication.
                </>
              ) : (
                "Content submitted by your agency creative team will appear here for your review and sign-off."
              )}
            </p>
            {statusTab === "pending" && approvedItems.length > 0 && (
              <button
                onClick={() => setStatusTab("approved")}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#20202A] text-[#A78BFA] font-semibold text-xs rounded-xl border border-white/[0.08] hover:bg-[#262630] transition-colors cursor-pointer"
              >
                <span>View Approved Deliverables ({approvedItems.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedItems.map((item: any) => {
              const st = STATUS_CONFIG[item.status] || STATUS_CONFIG["client_review"];
              const StatusIcon = st.icon;
              const latestVersion = item.content_versions?.length
                ? [...item.content_versions].sort(
                    (a: any, b: any) => b.version_number - a.version_number
                  )[0]
                : null;
              const isVideo = latestVersion?.file_name?.match(/\.(mp4|mov|webm)$/i);
              const isSelected = selectedDeliverableIds.has(item.id);
              const isPending =
                item.status === "client_review" || item.status === "changes_requested";

              return (
                <Link
                  key={item.id}
                  href={`/portal/${item.id}`}
                  className={`surface-card rounded-2xl border transition-all group flex flex-col overflow-hidden shadow-xs hover:shadow-md ${
                    isSelected
                      ? "border-[#A78BFA] ring-2 ring-[#A78BFA]/20"
                      : "border-white/[0.08] hover:border-white/[0.2]"
                  }`}
                >
                  {/* Media preview card header */}
                  <div className="h-36 bg-[#0D0D12] flex items-center justify-center relative overflow-hidden border-b border-white/[0.06]">
                    {/* Multi-select checkbox on pending items */}
                    {isPending && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(item.id, e)}
                        className="absolute top-3 left-3 z-10 p-1.5 rounded-lg bg-[#17171E]/90 hover:bg-[#20202A] border border-white/[0.12] text-[#F2F0F7] shadow-sm transition-all"
                        title={isSelected ? "Deselect item" : "Select item for batch approval"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#A78BFA]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#71717A] hover:text-[#F2F0F7]" />
                        )}
                      </button>
                    )}

                    <div className="text-[#30303D] group-hover:scale-105 transition-transform duration-300">
                      {isVideo ? (
                        <Film className="w-10 h-10 text-[#A78BFA]/40" />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-[#69A9D8]/40" />
                      )}
                    </div>
                    {latestVersion && (
                      <span className="absolute top-3 right-3 text-[10px] font-mono font-bold text-[#A78BFA] bg-[#17171E] px-2 py-0.5 rounded-full border border-white/[0.08] shadow-xs">
                        v{latestVersion.version_number}
                      </span>
                    )}

                    {/* Auto-scheduled banner inside preview */}
                    {item.status === "scheduled" && item.scheduled_at && (
                      <div className="absolute bottom-2 left-2 right-2 bg-[#17171E]/90 backdrop-blur-xs border border-[#A78BFA]/30 rounded-lg px-2.5 py-1 flex items-center justify-between text-[10px] font-mono text-[#A78BFA]">
                        <span className="flex items-center gap-1 font-bold">
                          <Calendar className="w-3 h-3" /> Auto-Scheduled
                        </span>
                        <span>{formatDate(item.scheduled_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-heading font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-[#71717A] group-hover:text-[#A78BFA] transition-colors shrink-0 mt-0.5" />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${st.badge}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {st.label}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-[#101014] text-[#A3A0B0] border-white/[0.08]">
                        {item.publishing_platform || item.platform}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-[#101014] text-[#A3A0B0] border-white/[0.08]">
                        {item.deliverable_type}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[11px] text-[#A3A0B0]">
                      <span className="font-medium text-[#F2F0F7] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#71717A]" />
                        <span>{item.client_name}</span>
                      </span>
                      {item.live_post_url ? (
                        <a
                          href={item.live_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[#45B88A] hover:underline flex items-center gap-1"
                        >
                          <span>Live Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : item.planned_date ? (
                        <span className="font-mono text-[#71717A] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#71717A]" />
                          <span>Planned: {item.planned_date}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Floating Batch Approval Action Bar ── */}
      {selectedDeliverableIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#17171E] border border-white/[0.14] rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#A78BFA] text-[#101014] font-mono font-bold text-xs flex items-center justify-center">
              {selectedDeliverableIds.size}
            </span>
            <span className="text-xs font-heading font-semibold text-[#F2F0F7]">
              Deliverable{selectedDeliverableIds.size > 1 ? "s" : ""} Selected
            </span>
          </div>

          <div className="h-4 w-px bg-white/[0.1]" />

          <button
            onClick={handleBatchApprove}
            disabled={batchSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#45B88A] hover:bg-[#52c595] text-[#101014] text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {batchSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-[#101014]" />
            )}
            <span>
              {batchSubmitting
                ? "Approving & Scheduling…"
                : `1-Click Approve Selected (${selectedDeliverableIds.size})`}
            </span>
          </button>

          <button
            onClick={clearSelection}
            disabled={batchSubmitting}
            className="text-xs text-[#A3A0B0] hover:text-[#F2F0F7] px-2 py-1 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs font-mono text-[#71717A] bg-[#101014]">
          Loading review portal…
        </div>
      }
    >
      <PortalHomeContent />
    </Suspense>
  );
}
