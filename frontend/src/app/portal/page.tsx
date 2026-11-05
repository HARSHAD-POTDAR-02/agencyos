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
  client_review:    { label: "Awaiting Your Review",  badge: "bg-amber-50 text-amber-700 border-amber-200",       icon: Clock },
  changes_requested:{ label: "Changes Requested",     badge: "bg-rose-50 text-rose-700 border-rose-200",           icon: AlertCircle },
  approved:         { label: "Approved",              badge: "bg-emerald-50 text-emerald-700 border-emerald-200",   icon: CheckCircle2 },
  published:        { label: "Published",             badge: "bg-blue-50 text-blue-700 border-blue-200",            icon: CheckCircle2 },
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
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading your review queue…</p>
        </div>
      </div>
    );
  }

  const primaryClient = clients.length > 0 ? clients[0] : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Nav (Client Specific) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight text-slate-900">
                  {primaryClient ? primaryClient.business_name : "AgencyOS"}
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                  Client Review Portal
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-semibold hidden sm:block">
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors"
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Welcome, {user?.full_name?.split(" ")[0] || "Reviewer"} 👋
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Review and approve your upcoming social media content before it gets published.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-2xs self-start sm:self-auto transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Brand Switcher (if multiple clients assigned) */}
        {clients.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedClientId(null)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                !selectedClientId
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
              }`}
            >
              All Brands
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  selectedClientId === c.id
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
                }`}
              >
                {c.business_name}
              </button>
            ))}
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200/80 pb-3">
          <button
            onClick={() => setStatusTab("pending")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusTab === "pending"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusTab === "pending"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {pendingItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("approved")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusTab === "approved"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved & Ready</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusTab === "approved"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {approvedItems.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab("all")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusTab === "all"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            <span>All Content ({clientFiltered.length})</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={load}
              className="px-2.5 py-1 bg-white border border-rose-300 text-rose-800 rounded-lg text-[11px] font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Deliverables Grid */}
        {displayedItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-14 text-center shadow-2xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-slate-800">
              {statusTab === "pending"
                ? "All caught up! No content pending review."
                : statusTab === "approved"
                ? "No approved content yet."
                : "No content available."}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {statusTab === "pending" && approvedItems.length > 0 ? (
                <>
                  You have{" "}
                  <span className="font-bold text-slate-700">
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
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors"
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
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-purple-300/60 transition-all group flex flex-col"
                >
                  {/* Media preview area */}
                  <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200/60 rounded-t-2xl flex items-center justify-center relative overflow-hidden">
                    <div className="text-slate-300">
                      {isVideo ? <Film className="w-12 h-12" /> : <ImageIcon className="w-12 h-12" />}
                    </div>
                    {latestVersion && (
                      <span className="absolute top-3 right-3 text-[10px] font-black text-slate-600 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                        v{latestVersion.version_number}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors shrink-0 mt-0.5" />
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${st.badge}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {st.label}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-50 text-slate-600 border-slate-200">
                        {item.platform}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-50 text-slate-600 border-slate-200">
                        {item.deliverable_type}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {item.client_name}
                      </span>
                      {item.planned_date && (
                        <span className="text-[11px] text-slate-400 font-medium">
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
        <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">
          Loading…
        </div>
      }
    >
      <PortalHomeContent />
    </Suspense>
  );
}
