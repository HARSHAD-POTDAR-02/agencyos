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

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  client_review:    { label: "Awaiting Your Review",  badge: "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30",   icon: Clock },
  changes_requested:{ label: "Changes Requested",     badge: "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30",   icon: AlertCircle },
  approved:         { label: "Approved",              badge: "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30",   icon: CheckCircle2 },
  published:        { label: "Published",             badge: "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30",   icon: CheckCircle2 },
};

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

      const delivs = (await portalApi.deliverables(token, selectedClientId || undefined)) as any[];
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
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#71717A]">Loading your review queue…</p>
        </div>
      </div>
    );
  }

  const primaryClient = clients.length > 0 ? clients[0] : null;

  return (
    <div className="min-h-screen bg-[#101014] text-[#F2F0F7]">
      {/* Top Nav (Client Specific) */}
      <header className="sticky top-0 z-30 bg-[#17171E] border-b border-[#30303D]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
              <Sparkles className="w-4 h-4 text-[#A78BFA]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-[#F2F0F7]">
                  {primaryClient ? primaryClient.business_name : "AgencyOS"}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#A78BFA] bg-[#A78BFA]/10 px-2 py-0.5 rounded-full border border-[#A78BFA]/30">
                  Client Review Portal
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#A3A0B0] font-medium hidden sm:block">
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A3A0B0] hover:text-[#E16F7B] bg-[#20202A] hover:bg-[#E16F7B]/10 border border-[#30303D] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome Banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
              Welcome, {user?.full_name?.split(" ")[0] || "Reviewer"} 👋
            </h1>
            <p className="text-xs text-[#A3A0B0] mt-1 font-medium">
              Review and approve your upcoming social media content before it gets published.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F2F0F7] bg-[#17171E] hover:bg-[#20202A] border border-[#30303D] px-3 py-2 rounded-xl self-start sm:self-auto transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#71717A]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Brand Switcher (if multiple clients assigned) */}
        {clients.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedClientId(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                !selectedClientId
                  ? "bg-[#20202A] text-[#F2F0F7] border-[#30303D] font-bold"
                  : "bg-[#17171E] text-[#71717A] border-[#30303D] hover:text-[#F2F0F7]"
              }`}
            >
              All Brands
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  selectedClientId === c.id
                    ? "bg-[#20202A] text-[#F2F0F7] border-[#30303D] font-bold"
                    : "bg-[#17171E] text-[#71717A] border-[#30303D] hover:text-[#F2F0F7]"
                }`}
              >
                {c.business_name}
              </button>
            ))}
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-[#30303D] pb-3">
          <button
            onClick={() => setStatusTab("pending")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusTab === "pending"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                : "bg-[#17171E] text-[#71717A] border border-[#30303D] hover:text-[#F2F0F7]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === "pending"
                  ? "bg-[#101014] text-[#A78BFA]"
                  : "bg-[#101014] text-[#71717A]"
              }`}
            >
              {pendingItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("approved")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusTab === "approved"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                : "bg-[#17171E] text-[#71717A] border border-[#30303D] hover:text-[#F2F0F7]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved & Ready</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === "approved"
                  ? "bg-[#101014] text-[#45B88A]"
                  : "bg-[#101014] text-[#71717A]"
              }`}
            >
              {approvedItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("all")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusTab === "all"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                : "bg-[#17171E] text-[#71717A] border border-[#30303D] hover:text-[#F2F0F7]"
            }`}
          >
            <span>All Content ({clientFiltered.length})</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#E16F7B]/10 border border-[#E16F7B]/30 rounded-xl text-xs font-medium text-[#E16F7B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={load}
              className="px-2.5 py-1 bg-[#17171E] border border-[#30303D] text-[#F2F0F7] rounded-lg text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Deliverables Grid */}
        {displayedItems.length === 0 ? (
          <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-14 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#45B88A] mx-auto mb-4" />
            <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">
              {statusTab === "pending"
                ? "All caught up! No content pending review."
                : statusTab === "approved"
                ? "No approved content yet."
                : "No content available."}
            </h3>
            <p className="text-xs text-[#A3A0B0] mt-1 max-w-sm mx-auto">
              {statusTab === "pending" && approvedItems.length > 0 ? (
                <>
                  You have{" "}
                  <span className="font-semibold text-[#F2F0F7]">
                    {approvedItems.length} approved deliverable(s)
                  </span>
                  . Switch to the Approved tab to view them.
                </>
              ) : (
                "Content submitted by your agency team will appear here for your review and sign-off."
              )}
            </p>
            {statusTab === "pending" && approvedItems.length > 0 && (
              <button
                onClick={() => setStatusTab("approved")}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#20202A] text-[#A78BFA] font-semibold text-xs rounded-xl border border-[#30303D] hover:bg-[#262630] transition-colors"
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
                  className="bg-[#17171E] rounded-2xl border border-[#30303D] hover:border-[#A78BFA]/40 transition-all group flex flex-col overflow-hidden"
                >
                  {/* Media preview area */}
                  <div className="h-32 bg-[#101014] rounded-t-2xl flex items-center justify-center relative overflow-hidden">
                    <div className="text-[#30303D]">
                      {isVideo ? <Film className="w-12 h-12" /> : <ImageIcon className="w-12 h-12" />}
                    </div>
                    {latestVersion && (
                      <span className="absolute top-3 right-3 text-[10px] font-mono font-bold text-[#A78BFA] bg-[#17171E] px-2 py-0.5 rounded-full border border-[#30303D]">
                        v{latestVersion.version_number}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-[#71717A] group-hover:text-[#A78BFA] transition-colors shrink-0 mt-0.5" />
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${st.badge}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {st.label}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-[#101014] text-[#A3A0B0] border-[#30303D]">
                        {item.platform}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-[#101014] text-[#A3A0B0] border-[#30303D]">
                        {item.deliverable_type}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-[#30303D]">
                      <span className="text-[11px] text-[#A3A0B0] font-medium flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#71717A]" />
                        {item.client_name}
                      </span>
                      {item.planned_date && (
                        <span className="text-[11px] font-mono text-[#71717A]">
                          📅 {item.planned_date}
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
        <div className="min-h-screen flex items-center justify-center text-xs text-[#71717A] bg-[#101014]">
          Loading…
        </div>
      }
    >
      <PortalHomeContent />
    </Suspense>
  );
}