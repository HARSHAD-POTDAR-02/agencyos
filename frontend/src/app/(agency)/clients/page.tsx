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
  ArrowRight
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
        bg: "bg-[rgba(69,184,138,0.12)] text-[#45B88A] border-[#45B88A]/20",
        dot: "bg-[#45B88A]",
      },
      onboarding: {
        bg: "bg-[rgba(105,169,216,0.12)] text-[#69A9D8] border-[#69A9D8]/20",
        dot: "bg-[#69A9D8]",
      },
      paused: {
        bg: "bg-[rgba(229,170,88,0.12)] text-[#E5AA58] border-[#E5AA58]/20",
        dot: "bg-[#E5AA58]",
      },
      offboarded: {
        bg: "bg-[#20202A] text-[#A3A0B0] border-[#30303D]",
        dot: "bg-[#6E6D7A]",
      },
    };
    const c = configs[status] || configs.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto ambient-glow min-h-screen">
      {/* ──────────────────────────────────────────────
          Top Header
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-semibold text-[#F2F0F7] tracking-tight">
              Client Workspaces
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20 shadow-[0_0_8px_rgba(167,139,250,0.15)]">
              {statusFilter === "offboarded" ? `${offboardedClientsCount} Offboarded` : `${activeClientsCount} Active Retainers`}
            </span>
          </div>
          <p className="text-xs text-[#A3A0B0] mt-1">
            Dedicated client operational environments, brand intelligence, and retainer delivery quotas.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_1px_10px_rgba(167,139,250,0.3)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#101014]" />
          <span>Onboard Client</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[rgba(225,111,123,0.12)] border border-[#E16F7B]/30 text-[#E16F7B] text-xs">
          {error}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          Filter, Search & View Switcher Bar
      ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-2.5 rounded-2xl border border-white/[0.08]">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#A3A0B0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, industry, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/60 pl-8.5 pr-3 py-1.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#101014] rounded-xl border border-white/[0.08] text-xs font-medium">
            {["all", "active", "onboarding", "paused", "offboarded"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg capitalize transition-all inline-flex items-center gap-1.5 text-xs cursor-pointer ${
                  statusFilter === tab
                    ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                <span>{tab === "all" ? "All Active" : tab}</span>
                {tab === "offboarded" && offboardedClientsCount > 0 && (
                  <span className={`px-1 py-0.2 rounded font-mono text-[9px] ${
                    statusFilter === "offboarded" ? "bg-[#262630] text-[#A78BFA]" : "bg-[#20202A] text-[#A3A0B0]"
                  }`}>
                    {offboardedClientsCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#101014] rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "list" ? "bg-[#20202A] text-[#F2F0F7] shadow-xs" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
              title="Table Directory View"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-[#20202A] text-[#F2F0F7] shadow-xs" : "text-[#A3A0B0] hover:text-[#F2F0F7]"
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          Client Directory Content (Linear List or Grid)
      ────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#A3A0B0] surface-card rounded-2xl border border-white/[0.08]">
          Loading client workspaces...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#20202A] text-[#A78BFA] flex items-center justify-center mx-auto mb-3 border border-white/[0.08] shadow-[0_0_12px_rgba(167,139,250,0.15)]">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#F2F0F7] mb-1">No clients found</h3>
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
        <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#121217]/90 text-[#A3A0B0] text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Client Workspace</th>
                  <th className="py-3 px-4 font-semibold">Industry & Location</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Retainer Scope</th>
                  <th className="py-3 px-4 w-44 font-semibold">Delivery SLA</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredClients.map((client) => {
                  const percent = client.scope_progress?.progress_percent ?? 0;
                  return (
                    <tr 
                      key={client.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#262630] to-[#17171E] text-[#F2F0F7] font-mono font-semibold text-xs flex items-center justify-center border border-white/[0.1] shadow-inner shrink-0">
                            {client.business_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link 
                              href={`/clients/${client.id}`}
                              className="font-medium text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors"
                            >
                              {client.business_name}
                            </Link>
                            {client.website && (
                              <p className="text-[10px] text-[#A3A0B0]/70 truncate max-w-[180px] font-mono">
                                {client.website.replace(/^https?:\/\//, "")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Industry / Location */}
                      <td className="py-3 px-4 text-[#A3A0B0]">
                        <div className="font-medium text-[#F2F0F7]/90">{client.industry || "General"}</div>
                        <div className="text-[10px] text-[#A3A0B0]/70">{client.location || "Location not set"}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(client.status)}
                      </td>

                      {/* Scope */}
                      <td className="py-3 px-4 text-[#A3A0B0]">
                        <div className="font-medium text-[#F2F0F7]">
                          {client.scope_progress?.monthly_scope_text || "No active scope"}
                        </div>
                        <div className="text-[10px] font-mono text-[#A3A0B0]/70">
                          {client.scope_progress?.contracts_count ?? 0} contract(s)
                        </div>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-[#A3A0B0]">
                              {client.scope_progress?.total_completed ?? 0} / {client.scope_progress?.total_contracted ?? 0}
                            </span>
                            <span className="text-[#45B88A] font-semibold tabular-nums">{percent}%</span>
                          </div>
                          <div className="w-full bg-[#101014] rounded-full h-1 overflow-hidden border border-white/[0.06]">
                            <div 
                              className={`h-1 rounded-full transition-all duration-500 ${
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
        </div>
      ) : (
        /* ── Cards Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="surface-card surface-card-hover rounded-2xl border border-white/[0.08] p-4.5 flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#262630] to-[#17171E] text-[#F2F0F7] font-mono font-bold text-sm flex items-center justify-center border border-white/[0.1] shadow-inner shrink-0">
                      {client.business_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/clients/${client.id}`}>
                        <h3 className="text-xs font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors cursor-pointer">
                          {client.business_name}
                        </h3>
                      </Link>
                      <p className="text-[10px] text-[#A3A0B0]">
                        {client.industry || "General Industry"}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(client.status)}
                </div>

                {/* Scope Progress Box */}
                <div className="bg-[#101014] rounded-xl p-3 border border-white/[0.06] mb-3.5 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A3A0B0] text-[11px]">Monthly Scope</span>
                    <span className="font-medium text-[#F2F0F7] text-xs">
                      {client.scope_progress?.monthly_scope_text || "No active scope"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#A3A0B0]/70">Delivery Progress</span>
                    <span className="text-[#45B88A] font-semibold">
                      {client.scope_progress?.total_completed ?? 0} / {client.scope_progress?.total_contracted ?? 0} Done
                    </span>
                  </div>
                  <div className="w-full bg-[#17171E] rounded-full h-1 overflow-hidden border border-white/[0.06]">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${
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
                <div className="space-y-1.5 text-xs text-[#A3A0B0] mb-3">
                  {client.location && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <MapPin className="w-3 h-3 text-[#6E6D7A] shrink-0" />
                      <span className="truncate">{client.location}</span>
                    </div>
                  )}
                  {client.contact_email && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Mail className="w-3 h-3 text-[#6E6D7A] shrink-0" />
                      <span className="truncate">{client.contact_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2.5 border-t border-[#30303D] flex items-center justify-between">
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
                    className="p-1 text-[#6E6D7A] hover:text-[#E16F7B] rounded transition-colors"
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
          Add Client Modal
      ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171E] rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#30303D] scale-in-95 duration-150">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#30303D]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#20202A] text-[#A78BFA] flex items-center justify-center border border-[#30303D]">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#F2F0F7]">Onboard Client Workspace</h2>
                  <p className="text-[11px] text-[#A3A0B0]">Set up business profile & primary contact</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#6E6D7A] hover:text-[#F2F0F7] text-xs p-1 rounded hover:bg-[#20202A] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Shorevada Cafe"
                  className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Restaurant & Food"
                    className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://shorevada.com"
                    className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                  Location / City
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Bandra West, Mumbai"
                  className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              <div className="border-t border-[#30303D] pt-3">
                <p className="text-xs font-medium text-[#F2F0F7] mb-2">Primary Client Contact (Reviewer)</p>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Contact person name (e.g. Rahul Sharma)"
                    className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email for approvals"
                      className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                    />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="WhatsApp phone"
                      className="w-full px-3 py-2 bg-[#101014] border border-[#30303D] rounded-lg text-xs text-[#F2F0F7] placeholder-[#6E6D7A] focus:outline-none focus:border-[#A78BFA]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-[#30303D]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-[#A3A0B0] hover:text-[#F2F0F7] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          Delete Confirmation Modal
      ────────────────────────────────────────────── */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171E] rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#30303D] scale-in-95 duration-150">
            <div className="w-9 h-9 rounded-md bg-[rgba(225,111,123,0.12)] text-[#E16F7B] flex items-center justify-center mb-3 border border-[#E16F7B]/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#F2F0F7] mb-1">
              Delete Client Workspace?
            </h3>
            <p className="text-xs text-[#A3A0B0] mb-4 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[#F2F0F7]">{clientToDelete.business_name}</span>? This will remove all associated brand profiles, campaigns, and contracts.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#E16F7B] hover:bg-[#E16F7B]/90 text-white rounded-lg transition-colors disabled:opacity-50"
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
