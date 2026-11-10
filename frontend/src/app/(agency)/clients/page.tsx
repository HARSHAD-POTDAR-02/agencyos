"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi } from "@/lib/api";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  ChevronRight,
  Sparkles,
  FileText,
  CalendarCheck,
  Trash2
} from "lucide-react";

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
}

export default function ClientsPage() {
  const { token, activeAgencyId, agencies } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const loadClients = useCallback(async () => {
    if (!token || !effectiveAgencyId) {
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
  }, [token, effectiveAgencyId]);

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
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      },
      onboarding: {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      },
      paused: {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      },
      offboarded: {
        bg: "bg-slate-50 text-slate-600 border-slate-200",
        dot: "bg-slate-400",
      },
    };
    const c = configs[status] || configs.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <main className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Client Workspaces</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {statusFilter === "offboarded" ? `${offboardedClientsCount} Offboarded` : `${activeClientsCount} Active Retainers`}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Brand profiles, contract quotas, deliverable counters and client access controls.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm shadow-purple-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Client</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, industry, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          {["all", "active", "onboarding", "paused", "offboarded"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all inline-flex items-center gap-1.5 ${
                statusFilter === tab
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <span>{tab === "all" ? "All Active" : tab}</span>
              {tab === "offboarded" && offboardedClientsCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  statusFilter === "offboarded" ? "bg-purple-800 text-purple-200" : "bg-slate-200 text-slate-700"
                }`}>
                  {offboardedClientsCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Cards Grid */}
      {loading ? (
        <div className="p-16 text-center text-sm font-medium text-slate-400">Loading workspaces...</div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-purple-50/50">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No clients found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            {searchQuery
              ? "No clients match your search query. Try clearing the filter."
              : "Onboard your first retainer client to unlock automated monthly campaigns and approvals."}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Client</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                {/* Card Header: Avatar + Status */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 text-white font-extrabold text-base flex items-center justify-center shadow-sm shadow-purple-500/20 shrink-0">
                      {client.business_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/clients/${client.id}`}>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors cursor-pointer">
                          {client.business_name}
                        </h3>
                      </Link>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {client.industry || "General Industry"}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(client.status)}
                </div>

                {/* Scope Quota Snapshot */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Monthly Scope</span>
                    <span className="font-bold text-slate-800">30 Reels / month</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Delivery Progress</span>
                    <span className="text-purple-600 font-bold">18 / 30 Done</span>
                  </div>
                  <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-purple-600 h-1.5 rounded-full w-[60%]" />
                  </div>
                </div>

                {/* Metadata List */}
                <div className="space-y-2 text-xs text-slate-600 mb-4">
                  {client.location && (
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.location}</span>
                    </div>
                  )}
                  {client.contact_person && (
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.contact_person}</span>
                    </div>
                  )}
                  {client.contact_email && (
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.contact_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/campaigns?clientId=${client.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 py-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Plan</span>
                  </Link>
                  <button
                    onClick={() => setClientToDelete(client)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title={`Delete ${client.business_name} permanently`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Link
                  href={`/clients/${client.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-purple-700 py-1"
                >
                  <span>Workspace</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 scale-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Onboard Retainer Client</h2>
                  <p className="text-xs text-slate-400">Set up workspace, brand details & primary contact</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Shorevada Cafe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Restaurant & Food"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://shorevada.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Location / City
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Bandra West, Mumbai"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-800 mb-2">Primary Client Contact (Reviewer)</p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Contact person name (e.g. Rahul Sharma)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email for approvals"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                    />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="WhatsApp phone"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/30 transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Client Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 scale-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 ring-8 ring-rose-50/50">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Permanently Delete Client?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800">{clientToDelete.business_name}</span>? This will permanently remove all their brand profiles, campaigns, deliverables, reviewer portal accounts, and contracts.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setClientToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
