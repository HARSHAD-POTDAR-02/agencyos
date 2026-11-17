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
  deliverable_type: string;
  platform: string;
  status: string;
  planned_date: string | null;
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

function PortalHomeContent() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<PortalClient[]>([]);
  const [deliverables, setDeliverables] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<"pending" | "approved" | "all">("pending");

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
    (d) => d.status === "approved" || d.status === "published"
  );

  const displayedItems =
    statusTab === "pending"
      ? pendingItems
      : statusTab === "approved"
      ? approvedItems
      : clientFiltered;

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
    <div className="min-h-screen bg-[#101014] text-[#F2F0F7]">
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
              Review, comment on, and approve your upcoming creative deliverables before they go live on social channels.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F2F0F7] bg-[#17171E] hover:bg-[#20202A] border border-white/[0.08] px-3 py-1.5 rounded-xl self-start sm:self-auto transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#A3A0B0]" />
            <span>Refresh</span>
          </button>
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
            <span>Approved & Ready</span>
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
                    {approvedItems.length} approved deliverable(s)
                  </span>
                  . Switch to the Approved tab to view them.
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

              return (
                <Link
                  key={item.id}
                  href={`/portal/${item.id}`}
                  className="surface-card rounded-2xl border border-white/[0.08] hover:border-white/[0.2] transition-all group flex flex-col overflow-hidden shadow-xs hover:shadow-md"
                >
                  {/* Media preview card header */}
                  <div className="h-36 bg-[#0D0D12] flex items-center justify-center relative overflow-hidden border-b border-white/[0.06]">
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
                        {item.platform}
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
                      {item.planned_date && (
                        <span className="font-mono text-[#71717A] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#71717A]" />
                          <span>{item.planned_date}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
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
