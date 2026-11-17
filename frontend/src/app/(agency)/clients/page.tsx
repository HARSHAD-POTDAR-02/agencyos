"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { clientApi } from "@/lib/api";
import { 
  Users, 
  Plus, 
  Search, 
  ExternalLink, 
  Building2, 
  Mail, 
  MapPin, 
  ChevronRight,
  Sparkles,
  Trash2,
  LayoutList,
  LayoutGrid,
  ArrowRight,
  X,
  Globe,
  Phone,
  Briefcase
} from "lucide-react";

interface ClientScopeProgress {
  contracts_count: number;
  monthly_scope_text: string;
  total_contracted: number;
  total_completed: number;
  total_published: number;
  total_approved: number;
  total_in_progress: number;
  total_planned: number;
  progress_percent: number;
}

interface Client {
  id: string;
  agency_id: string;
  business_name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "active" | "onboarding" | "paused" | "offboarded";
  created_at: string;
  scope_progress?: ClientScopeProgress | null;
}

export default function ClientsPage() {
  const router = useRouter();
  const { token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const loadClients = useCallback(async () => {
    if (!token || !effectiveAgencyId || isSpecialist) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = (await clientApi.list(effectiveAgencyId, token)) as Client[];
      setClients(data);
    } catch (err: any) {
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, isSpecialist]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Keyboard navigation & modal shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setClientToDelete(null);
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setShowModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("You must be logged in to create a client.");
      return;
    }
    if (!effectiveAgencyId) {
      setError("No active agency found. Please create or select an agency workspace first.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await clientApi.create(
        effectiveAgencyId,
        {
          business_name: businessName,
          industry: industry || undefined,
          website: website || undefined,
          location: location || undefined,
          contact_person: contactPerson || undefined,
          contact_email: contactEmail || undefined,
          contact_phone: contactPhone || undefined,
        },
        token
      );

      setBusinessName("");
      setIndustry("");
      setWebsite("");
      setLocation("");
      setContactPerson("");
      setContactEmail("");
      setContactPhone("");
      setShowModal(false);

      await loadClients();
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete || !effectiveAgencyId || !token) return;
    setDeleting(true);
    setError("");
    try {
      await clientApi.delete(effectiveAgencyId, clientToDelete.id, token);
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setClientToDelete(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete client");
    } finally {
      setDeleting(false);
    }
  };

  const activeClientsCount = clients.filter((c) => c.status !== "offboarded").length;
  const offboardedClientsCount = clients.filter((c) => c.status === "offboarded").length;
  const onboardingCount = clients.filter((c) => c.status === "onboarding").length;
  const pausedCount = clients.filter((c) => c.status === "paused").length;
  const strictlyActiveCount = clients.filter((c) => c.status === "active").length;

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.industry && client.industry.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.location && client.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === "all"
        ? client.status !== "offboarded"
        : client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Client["status"]) => {
    const configs = {
      active: {
        bg: "bg-[rgba(69,184,138,0.12)] text-[#45B88A] border-[#45B88A]/25",
        dot: "bg-[#45B88A]",
        label: "Active"
      },
      onboarding: {
        bg: "bg-[rgba(105,169,216,0.12)] text-[#69A9D8] border-[#69A9D8]/25",
        dot: "bg-[#69A9D8]",
        label: "Onboarding"
      },
      paused: {
        bg: "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/25",
        dot: "bg-[#E5AA58]",
        label: "Paused"
      },
      offboarded: {
        bg: "bg-white/[0.04] text-[#A3A0B0] border-white/[0.08]",
        dot: "bg-[#6E6D7A]",
        label: "Offboarded"
      },
    };
    const c = configs[status] || configs.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium border ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span>{c.label}</span>
      </span>
    );
  };

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ──────────────────────────────────────────────
          1. Header & Quick Action Dock
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider mb-1">
            <span>AgencyOS</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] inline-block" />
              Client Directory
            </span>
          </div>
          <h1 className="font-heading text-xl md:text-2xl font-semibold text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
            <span>Client Workspaces</span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/25 shadow-xs">
              {statusFilter === "offboarded" ? `${offboardedClientsCount} Archived` : `${activeClientsCount} Active`}
            </span>
          </h1>
          <p className="text-xs text-[#A3A0B0] mt-0.5">
            Dedicated client operational environments, brand intelligence repositories, and retainer delivery quotas.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] hover:shadow-[0_2px_14px_rgba(167,139,250,0.45)] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[#101014]" />
          <span>Onboard Client</span>
          <span className="kbd-pill text-[9px] bg-[#101014]/20 text-[#101014] border-black/20 hidden sm:inline-flex">C</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[rgba(225,111,123,0.12)] border border-[#E16F7B]/30 text-[#E16F7B] text-xs">
          {error}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          2. Linear Integrated Filter, Search & View Dock
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-2.5 rounded-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        {/* Search Input with Clear Button */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#A3A0B0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by client name, industry, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/60 pl-8.5 pr-8 py-1.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A3A0B0] hover:text-[#F2F0F7] p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter Tabs with Counts */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#101014] rounded-xl border border-white/[0.08] text-xs font-medium shrink-0">
            {[
              { id: "all", label: "All Active", count: activeClientsCount },
              { id: "active", label: "Active", count: strictlyActiveCount },
              { id: "onboarding", label: "Onboarding", count: onboardingCount },
              { id: "paused", label: "Paused", count: pausedCount },
              { id: "offboarded", label: "Offboarded", count: offboardedClientsCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all inline-flex items-center gap-1.5 text-xs cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1 py-0.2 rounded font-mono text-[9.5px] ${
                  statusFilter === tab.id 
                    ? "bg-white/[0.1] text-[#F2F0F7]" 
                    : "bg-white/[0.04] text-[#A3A0B0]"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#101014] rounded-xl border border-white/[0.08] shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "list" ? "bg-[#20202A] text-[#F2F0F7] shadow-xs border border-white/[0.08]" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
              title="Table Directory View"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-[#20202A] text-[#F2F0F7] shadow-xs border border-white/[0.08]" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          3. Client Directory Content
      ────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#A3A0B0] surface-card rounded-2xl border border-white/[0.08]">
          <div className="w-6 h-6 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Loading client workspaces...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="w-10 h-10 rounded-xl bg-[#20202A] text-[#A78BFA] flex items-center justify-center mx-auto mb-3 border border-white/[0.08] shadow-[0_0_12px_rgba(167,139,250,0.15)]">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-[#F2F0F7] mb-1">No clients found</h3>
          <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? "No clients match your filter criteria. Try clearing your search term."
              : "Onboard your first retainer client to initialize automated campaigns, reviews, and delivery."}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#101014]" />
            <span>Onboard First Client</span>
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* ── Linear-Style Structured Table Directory ── */
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#121217]/90 text-[#A3A0B0] text-[10.5px] font-mono uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Client Workspace</th>
                  <th className="py-3 px-4 font-semibold">Industry & Location</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Retainer Scope</th>
                  <th className="py-3 px-4 w-48 font-semibold">Delivery SLA</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredClients.map((client) => {
                  const percent = client.scope_progress?.progress_percent ?? 0;
                  return (
                    <tr 
                      key={client.id}
                      className="hover:bg-white/[0.035] transition-colors group h-12"
                    >
                      {/* Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#262630] to-[#17171E] text-[#F2F0F7] font-mono font-bold text-xs flex items-center justify-center border border-white/[0.1] shadow-inner shrink-0 group-hover:border-[#A78BFA]/40 transition-colors">
                            {client.business_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link 
                              href={`/clients/${client.id}`}
                              className="font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors text-xs"
                            >
                              {client.business_name}
                            </Link>
                            {client.website ? (
                              <p className="text-[10.5px] text-[#A3A0B0] truncate max-w-[180px] font-mono flex items-center gap-1 mt-0.5">
                                <Globe className="w-2.5 h-2.5 text-[#A3A0B0]/60 shrink-0" />
                                <span>{client.website.replace(/^https?:\/\//, "")}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-[#A3A0B0]/50 font-mono mt-0.5">Workspace Active</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Industry / Location */}
                      <td className="py-3 px-4 text-[#A3A0B0]">
                        <div className="font-medium text-[#F2F0F7]/90 text-xs">{client.industry || "General Industry"}</div>
                        <div className="text-[10.5px] text-[#A3A0B0] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-[#A3A0B0]/60 shrink-0" />
                          <span>{client.location || "Location unassigned"}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(client.status)}
                      </td>

                      {/* Scope */}
                      <td className="py-3 px-4 text-[#A3A0B0]">
                        <div className="font-medium text-[#F2F0F7] text-xs">
                          {client.scope_progress?.monthly_scope_text || "No active scope"}
                        </div>
                        <div className="text-[10.5px] font-mono text-[#A3A0B0] mt-0.5">
                          {client.scope_progress?.contracts_count ?? 0} active contract(s)
                        </div>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10.5px] font-mono">
                            <span className="text-[#A3A0B0]">
                              {client.scope_progress?.total_completed ?? 0} / {client.scope_progress?.total_contracted ?? 0} Done
                            </span>
                            <span className="text-[#45B88A] font-semibold tabular-nums">{percent}%</span>
                          </div>
                          <div className="w-full bg-[#101014] rounded-full h-1.5 overflow-hidden border border-white/[0.06]">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                percent >= 100 ? "bg-[#45B88A]" : percent > 0 ? "bg-[#A78BFA]" : "bg-white/[0.1]"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(percent > 0 ? 5 : 0, percent))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/campaigns?clientId=${client.id}`}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#A78BFA] transition-colors"
                            title="Plan Campaign with AI"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setClientToDelete(client)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#A3A0B0] hover:text-[#E16F7B] transition-colors cursor-pointer"
                            title="Delete Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/clients/${client.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#F2F0F7] hover:text-[#A78BFA] px-2.5 py-1 rounded-lg surface-card surface-card-hover border border-white/[0.08] transition-colors"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3 text-[#A78BFA]" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Directory Summary Footer */}
          <div className="p-3 px-5 border-t border-white/[0.06] bg-[#121217]/50 flex items-center justify-between text-xs text-[#A3A0B0]">
            <span className="font-mono text-[11px]">
              Showing {filteredClients.length} of {clients.length} workspaces
            </span>
            <span className="text-[11px] text-[#A3A0B0]">
              Press <span className="kbd-pill font-mono text-[9px]">C</span> to onboard new client
            </span>
          </div>
        </div>
      ) : (
        /* ── Cards Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="surface-card surface-card-hover rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between group shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#262630] to-[#17171E] text-[#F2F0F7] font-mono font-bold text-sm flex items-center justify-center border border-white/[0.1] shadow-inner shrink-0 group-hover:border-[#A78BFA]/40 transition-colors">
                      {client.business_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/clients/${client.id}`}>
                        <h3 className="font-heading text-sm font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors cursor-pointer">
                          {client.business_name}
                        </h3>
                      </Link>
                      <p className="text-[11px] text-[#A3A0B0]">
                        {client.industry || "General Industry"}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(client.status)}
                </div>

                {/* Scope Progress Box */}
                <div className="bg-[#101014] rounded-xl p-3.5 border border-white/[0.06] mb-4 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A3A0B0] text-[11px]">Monthly Scope</span>
                    <span className="font-medium text-[#F2F0F7] text-xs">
                      {client.scope_progress?.monthly_scope_text || "No active scope"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] font-mono">
                    <span className="text-[#A3A0B0]/70">Delivery Progress</span>
                    <span className="text-[#45B88A] font-semibold">
                      {client.scope_progress?.total_completed ?? 0} / {client.scope_progress?.total_contracted ?? 0} Done
                    </span>
                  </div>
                  <div className="w-full bg-[#17171E] rounded-full h-1.5 overflow-hidden border border-white/[0.06]">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        (client.scope_progress?.progress_percent || 0) >= 100
                          ? "bg-[#45B88A]"
                          : (client.scope_progress?.progress_percent || 0) > 0
                          ? "bg-[#A78BFA]"
                          : "bg-white/[0.1]"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            (client.scope_progress?.progress_percent || 0) > 0 ? 5 : 0,
                            client.scope_progress?.progress_percent || 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Metadata List */}
                <div className="space-y-1.5 text-xs text-[#A3A0B0] mb-4">
                  {client.location && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <MapPin className="w-3 h-3 text-[#A3A0B0]/60 shrink-0" />
                      <span className="truncate">{client.location}</span>
                    </div>
                  )}
                  {client.contact_email && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Mail className="w-3 h-3 text-[#A3A0B0]/60 shrink-0" />
                      <span className="truncate">{client.contact_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/campaigns?clientId=${client.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A78BFA] hover:text-[#B69BFF]"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Plan</span>
                  </Link>
                  <button
                    onClick={() => setClientToDelete(client)}
                    className="p-1 text-[#A3A0B0] hover:text-[#E16F7B] rounded transition-colors cursor-pointer"
                    title={`Delete ${client.business_name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <Link
                  href={`/clients/${client.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#F2F0F7] hover:text-[#A78BFA]"
                >
                  <span>Workspace</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          4. Raycast Elevated "Onboard Client" Modal
      ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171E] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] max-w-lg w-full p-6 border border-white/[0.1] scale-in-95 duration-150">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#20202A] text-[#A78BFA] flex items-center justify-center border border-white/[0.08] shadow-inner">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-heading text-sm font-semibold text-[#F2F0F7]">Onboard Client Workspace</h2>
                  <p className="text-[11px] text-[#A3A0B0]">Set up client brand profile & key stakeholder contacts</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-xs p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-mono font-semibold text-[#A3A0B0] uppercase tracking-wider mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-mono font-semibold text-[#A3A0B0] uppercase tracking-wider mb-1.5">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Industry or domain"
                    className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-mono font-semibold text-[#A3A0B0] uppercase tracking-wider mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://brand.com"
                    className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono font-semibold text-[#A3A0B0] uppercase tracking-wider mb-1.5">
                  Location / Territory
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bandra West, Mumbai"
                  className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                />
              </div>

              <div className="border-t border-white/[0.08] pt-3.5">
                <p className="text-xs font-medium text-[#F2F0F7] mb-2.5">Primary Client Reviewer (Approvals)</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Key contact name (e.g. Rahul Sharma)"
                    className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="reviewer@brand.com"
                      className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                    />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98200..."
                      className="w-full px-3 py-2 bg-[#101014] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="surface-card surface-card-hover px-3.5 py-1.5 text-xs text-[#A3A0B0] hover:text-[#F2F0F7] font-medium rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-xl transition-all shadow-[0_1px_8px_rgba(167,139,250,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Initializing..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          5. Raycast Elevated Delete Confirmation Modal
      ────────────────────────────────────────────── */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171E] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] max-w-md w-full p-6 border border-white/[0.1] scale-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-[rgba(225,111,123,0.12)] text-[#E16F7B] flex items-center justify-center mb-3 border border-[#E16F7B]/30 shadow-inner">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="font-heading text-sm font-semibold text-[#F2F0F7] mb-1">
              Delete Client Workspace?
            </h3>
            <p className="text-xs text-[#A3A0B0] mb-5 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[#F2F0F7]">{clientToDelete.business_name}</span>? This will permanently remove all associated brand parameters, campaigns, and deliverable contracts.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
                className="surface-card surface-card-hover px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-medium bg-[#E16F7B] hover:bg-[#E16F7B]/90 text-white rounded-xl transition-all shadow-[0_1px_8px_rgba(225,111,123,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
