"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Sparkles,
  Video,
  PenTool,
  Palette,
  Compass,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Key,
  Mail,
  User,
  Clock,
  Search,
  Check,
  Copy,
  X,
  Layers,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { agencyApi, taskApi } from "@/lib/api";

interface MemberItem {
  id: string;
  user_id: string;
  agency_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_full_name?: string | null;
  user_email?: string | null;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; description: string; icon: any; color: string; bg: string }
> = {
  owner: {
    label: "Agency Owner",
    description: "Full control over agency, billing, and all client workspaces",
    icon: ShieldCheck,
    color: "text-[#A78BFA]",
    bg: "bg-[#A78BFA]/10 border-[#A78BFA]/30",
  },
  manager: {
    label: "Production Manager",
    description: "Supervises workflows, reviews submissions, and manages tasks",
    icon: ShieldCheck,
    color: "text-[#69A9D8]",
    bg: "bg-[#69A9D8]/10 border-[#69A9D8]/30",
  },
  writer: {
    label: "Scriptwriter / Copywriter",
    description: "Auto-assigned to scripting, captions, and hook development",
    icon: PenTool,
    color: "text-[#A78BFA]",
    bg: "bg-[#A78BFA]/10 border-[#A78BFA]/30",
  },
  editor: {
    label: "Video Editor",
    description: "Auto-assigned to video cutting, sound sync, and filming tasks",
    icon: Video,
    color: "text-[#69A9D8]",
    bg: "bg-[#69A9D8]/10 border-[#69A9D8]/30",
  },
  designer: {
    label: "Graphic Designer",
    description: "Auto-assigned to visual carousels, thumbnails, and graphic assets",
    icon: Palette,
    color: "text-[#45B88A]",
    bg: "bg-[#45B88A]/10 border-[#45B88A]/30",
  },
  strategist: {
    label: "Content Strategist",
    description: "Builds campaign roadmaps, audience hooks, and competitive angles",
    icon: Compass,
    color: "text-[#E5AA58]",
    bg: "bg-[#E5AA58]/10 border-[#E5AA58]/30",
  },
  account_manager: {
    label: "Account Manager",
    description: "Coordinates with client reviewers and manages timeline approvals",
    icon: Briefcase,
    color: "text-[#69A9D8]",
    bg: "bg-[#69A9D8]/10 border-[#69A9D8]/30",
  },
};

function getMonogram(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export default function TeamManagementPage() {
  const router = useRouter();
  const { user, token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);
  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(
    currentMembership?.role || "owner"
  );

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [taskCountsByMember, setTaskCountsByMember] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [password, setPassword] = useState("AgencyPass123!");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    pass: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load team members and active tasks workload
  const loadMembers = useCallback(async () => {
    if (!token || !effectiveAgencyId || isSpecialist) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = (await agencyApi.listMembers(effectiveAgencyId, token)) as MemberItem[];
      setMembers(data || []);

      // Fetch active task workload counts
      try {
        const taskList = (await taskApi.list(effectiveAgencyId, token, { limit: 200 })) as any[];
        const counts: Record<string, number> = {};
        if (Array.isArray(taskList)) {
          taskList.forEach((t: any) => {
            if (t.assignee_id && !["approved", "done"].includes(t.status)) {
              counts[t.assignee_id] = (counts[t.assignee_id] || 0) + 1;
            }
          });
        }
        setTaskCountsByMember(counts);
      } catch (e) {
        // ignore task workload error
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load agency members");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, isSpecialist]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Keyboard navigation: '/' for search, ESC to clear/close, '1'..'6' for role filters, 'C' to open add modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (showAddModal) {
          setShowAddModal(false);
        } else if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (!isInput) {
        if ((e.key === "c" || e.key === "C" || e.key === "a" || e.key === "A") && isManagerOrOwner) {
          setModalError(null);
          setCreatedCredentials(null);
          setShowAddModal(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal, isManagerOrOwner]);

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;
    if (!email.trim()) {
      setModalError("Email is required.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await agencyApi.inviteMember(
        effectiveAgencyId,
        {
          email: email.trim(),
          role: selectedRole,
          full_name: fullName.trim() || undefined,
          password: password.trim() || "AgencyPass123!",
        },
        token
      );
      setCreatedCredentials({
        email: email.trim(),
        pass: password.trim() || "AgencyPass123!",
        role: selectedRole,
      });
      loadMembers();
      // Reset input fields
      setFullName("");
      setEmail("");
      setSelectedRole("editor");
      setPassword("AgencyPass123!");
    } catch (err: any) {
      setModalError(err?.message || "Failed to add member to agency");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Role Change
  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!token || !effectiveAgencyId) return;
    try {
      await agencyApi.updateMemberRole(effectiveAgencyId, memberId, newRole, token);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update role");
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!token || !effectiveAgencyId) return;
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this agency?`)) return;
    try {
      await agencyApi.removeMember(effectiveAgencyId, memberId, token);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err?.message || "Failed to remove member");
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `AgencyOS Login Credentials:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.pass}\nRole: ${createdCredentials.role}\nLogin: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const name = (m.user_full_name || "").toLowerCase();
      const mail = (m.user_email || "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = name.includes(q) || mail.includes(q);

      if (!matchesSearch) return false;
      if (roleFilter === "all") return true;
      if (roleFilter === "specialists") return ["writer", "editor", "designer"].includes(m.role);
      if (roleFilter === "management")
        return ["owner", "manager", "strategist", "account_manager"].includes(m.role);
      return m.role === roleFilter;
    });
  }, [members, searchQuery, roleFilter]);

  // Specialist counts
  const specialistsCount = members.filter((m) =>
    ["writer", "editor", "designer"].includes(m.role)
  ).length;
  const managersCount = members.filter((m) =>
    ["owner", "manager", "strategist", "account_manager"].includes(m.role)
  ).length;

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Organization</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Specialist Roster</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Team & Production Specialists
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Manage your scriptwriters, video editors, and designers. When AI generates campaign deliverables, tasks are automatically routed directly to the designated specialist.
          </p>
        </div>

        {isManagerOrOwner && (
          <button
            onClick={() => {
              setModalError(null);
              setCreatedCredentials(null);
              setShowAddModal(true);
            }}
            title="Add specialist (Press C)"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Specialist</span>
            <kbd className="text-[9px] font-mono px-1 rounded bg-black/40 text-[#101014]">C</kbd>
          </button>
        )}
      </div>

      {/* ── Linear 4-Segment Telemetry Strip ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
        {/* Metric 1 */}
        <div className="flex flex-col justify-between pt-2 md:pt-0 md:px-3 first:px-0">
          <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Total Members</span>
            <Users className="w-3.5 h-3.5 text-[#A78BFA]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#F2F0F7]">{members.length}</span>
            <span className="text-[11px] text-[#A3A0B0] font-mono">active roster</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex flex-col justify-between pt-2 md:pt-0 md:px-4">
          <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Specialists</span>
            <Sparkles className="w-3.5 h-3.5 text-[#69A9D8]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#F2F0F7]">{specialistsCount}</span>
            <span className="text-[11px] text-[#69A9D8] font-mono font-medium">
              Writers, Editors & Designers
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex flex-col justify-between pt-2 md:pt-0 md:px-4">
          <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Management</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#45B88A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#F2F0F7]">{managersCount}</span>
            <span className="text-[11px] text-[#45B88A] font-mono font-medium">
              Supervision & Strategy
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex flex-col justify-between pt-2 md:pt-0 md:px-4">
          <div className="flex items-center justify-between text-[#A3A0B0] text-[11px] font-medium uppercase tracking-wider">
            <span>Auto-Routing</span>
            <span className="w-2 h-2 rounded-full bg-[#45B88A] ring-2 ring-[#45B88A]/20 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs font-semibold text-[#45B88A] font-mono">ACTIVE</span>
            <span className="text-[11px] text-[#A3A0B0] font-mono">LangGraph pipeline sync</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolstrip (Linear Style) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-2.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Search Input with / Shortcut */}
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A0B0] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter specialists... (Press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] border border-white/[0.08] rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20 transition-all font-sans"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F2F0F7] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08] pointer-events-none">
              /
            </kbd>
          )}
        </div>

        {/* Role Filters with Count Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5">
          {[
            { id: "all", label: "All Members", count: members.length },
            { id: "specialists", label: "Specialists", count: specialistsCount },
            { id: "management", label: "Management", count: managersCount },
            {
              id: "writer",
              label: "Writers",
              count: members.filter((m) => m.role === "writer").length,
            },
            {
              id: "editor",
              label: "Editors",
              count: members.filter((m) => m.role === "editor").length,
            },
            {
              id: "designer",
              label: "Designers",
              count: members.filter((m) => m.role === "designer").length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                roleFilter === tab.id
                  ? "bg-white/[0.08] text-[#F2F0F7] shadow-xs font-semibold"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.03]"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono px-1 rounded bg-black/40 text-[#71717A]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Team Members Table (Linear Density 38-40px rows) ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#A3A0B0] text-xs font-mono">
            <RefreshCw className="w-5 h-5 text-[#A78BFA] animate-spin mx-auto mb-2" />
            Loading agency members & active workloads...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center mx-auto text-[#A3A0B0]">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-heading font-semibold text-[#F2F0F7]">
              No members match your criteria
            </h3>
            <p className="text-[11px] text-[#A3A0B0] max-w-sm mx-auto font-mono">
              Add your scriptwriter, video editor, or designer so AgencyOS can auto-route production tasks.
            </p>
            {isManagerOrOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A78BFA] text-[#101014] rounded-lg text-xs font-semibold hover:bg-[#B69BFF] transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Specialist</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121217] border-b border-white/[0.08] text-[#A3A0B0] font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Member</th>
                  <th className="py-2.5 px-4 font-medium">Role & Specialization</th>
                  <th className="py-2.5 px-4 font-medium">Active Workload</th>
                  <th className="py-2.5 px-4 font-medium">Automatic Task Routing</th>
                  <th className="py-2.5 px-4 font-medium">Joined</th>
                  {isManagerOrOwner && <th className="py-2.5 px-4 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredMembers.map((m) => {
                  const roleMeta = ROLE_CONFIG[m.role] || {
                    label: m.role,
                    description: "Agency Team Member",
                    icon: User,
                    color: "text-[#A3A0B0]",
                    bg: "bg-[#20202A] border-white/[0.08]",
                  };
                  const RoleIcon = roleMeta.icon;
                  const isSelf = user?.email === m.user_email;
                  const activeTasks = taskCountsByMember[m.user_id] || 0;

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] font-bold text-xs shrink-0 font-mono">
                            {getMonogram(m.user_full_name, m.user_email)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[#F2F0F7] truncate">
                                {m.user_full_name || m.user_email?.split("@")[0]}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 text-[9px] font-mono font-bold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-mono truncate block">
                              {m.user_email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector / Badge */}
                      <td className="py-3 px-4">
                        {isManagerOrOwner && !isSelf && m.role !== "owner" ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              className={`text-[11px] font-medium px-2 py-1 rounded-lg border border-white/[0.08] bg-[#101014] cursor-pointer focus:outline-none focus:border-[#A78BFA]/50 transition-colors ${roleMeta.color}`}
                            >
                              <option value="editor">Video Editor</option>
                              <option value="writer">Scriptwriter / Copywriter</option>
                              <option value="designer">Graphic Designer</option>
                              <option value="strategist">Content Strategist</option>
                              <option value="account_manager">Account Manager</option>
                              <option value="manager">Production Manager</option>
                            </select>
                          </div>
                        ) : (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${roleMeta.bg} ${roleMeta.color}`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            <span>{roleMeta.label}</span>
                          </div>
                        )}
                      </td>

                      {/* Workload Pill */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                            activeTasks > 5
                              ? "bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30"
                              : activeTasks > 0
                              ? "bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30"
                              : "bg-white/[0.04] text-[#71717A] border border-white/[0.06]"
                          }`}
                        >
                          <Activity className="w-2.5 h-2.5" />
                          <span>
                            {activeTasks} active task{activeTasks === 1 ? "" : "s"}
                          </span>
                        </span>
                      </td>

                      {/* Auto Assignment Description */}
                      <td className="py-3 px-4">
                        <span className="text-[#A3A0B0] text-xs leading-relaxed block max-w-xs truncate">
                          {roleMeta.description}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-[#A3A0B0] text-[11px] font-mono">
                        {new Date(m.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      {isManagerOrOwner && (
                        <td className="py-3 px-4 text-right">
                          {!isSelf && m.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.user_email || "member")}
                              className="p-1.5 rounded-lg text-[#A3A0B0] hover:text-[#E16F7B] hover:bg-[#E16F7B]/10 transition-colors cursor-pointer"
                              title="Remove from agency"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Automatic Specialist Routing Guide (Cohesive Architecture Reference) ── */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
          <h2 className="text-xs font-heading font-semibold text-[#F2F0F7] uppercase tracking-wider">
            Automatic Specialist Routing Architecture
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#101014] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-2 font-medium text-[#A78BFA]">
              <PenTool className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Scriptwriter (`writer`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              When campaigns are approved, <strong>Scripting</strong> and <strong>Hook development</strong> tasks are routed directly to the writer with brand guidelines pre-attached.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101014] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-2 font-medium text-[#69A9D8]">
              <Video className="w-3.5 h-3.5 text-[#69A9D8]" />
              <span>Video Editor (`editor`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              All <strong>Video Editing</strong>, pacing, audio sync, and <strong>Filming</strong> tasks are routed to the editor with visual storyboards and camera cues.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101014] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-2 font-medium text-[#45B88A]">
              <Palette className="w-3.5 h-3.5 text-[#45B88A]" />
              <span>Graphic Designer (`designer`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              Thumbnails, carousel slides, static banner ads, and visual overlays route directly to the designer with aspect ratios locked.
            </p>
          </div>
        </div>
      </div>

      {/* ── Raycast-Inspired Add Specialist Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="surface-card rounded-2xl max-w-lg w-full p-5 border border-white/[0.1] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA]">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#F2F0F7]">
                    Add Specialist
                  </h3>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Register an employee for autonomous deliverable routing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-sm leading-none p-1 rounded-md transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createdCredentials ? (
              <div className="py-4 space-y-3">
                <div className="p-3.5 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
                    <span>Specialist Added Successfully!</span>
                  </div>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Share these credentials with your team member so they can sign in to their workbench:
                  </p>
                  <div className="bg-[#101014] rounded-lg p-3 text-xs font-mono space-y-1 border border-white/[0.08] text-[#F2F0F7]">
                    <div>
                      <strong className="text-[#A3A0B0]">Email:</strong> {createdCredentials.email}
                    </div>
                    <div>
                      <strong className="text-[#A3A0B0]">Password:</strong> {createdCredentials.pass}
                    </div>
                    <div>
                      <strong className="text-[#A3A0B0]">Role:</strong> {createdCredentials.role}
                    </div>
                    <div>
                      <strong className="text-[#A3A0B0]">Login URL:</strong>{" "}
                      {typeof window !== "undefined" ? window.location.origin : ""}/login
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCredentials}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#45B88A] hover:bg-[#52c595] text-[#101014] rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy Login Credentials"}</span>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => {
                      setCreatedCredentials(null);
                      setShowAddModal(false);
                    }}
                    className="px-3.5 py-1.5 bg-[#20202A] text-[#F2F0F7] text-xs font-medium rounded-lg hover:bg-[#262630] border border-white/[0.08] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-3.5 pt-3.5">
                {modalError && (
                  <div className="p-2.5 rounded-lg bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A0B0]" />
                    <input
                      type="text"
                      placeholder="e.g. Liam Vance"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#101014] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A0B0]" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. liam.editor@agency.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#101014] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                    Specialist Role *
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-[#101014] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-medium text-[#F2F0F7] focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer"
                  >
                    <option value="editor">Video Editor (Filming, Editing, Sound Design)</option>
                    <option value="writer">
                      Scriptwriter / Copywriter (Hooks, Scripts, Captions)
                    </option>
                    <option value="designer">
                      Graphic Designer (Thumbnails, Carousels, Static Ads)
                    </option>
                    <option value="strategist">Content Strategist (Roadmaps & Research)</option>
                    <option value="account_manager">Account Manager (Client Relations)</option>
                    <option value="manager">Production Manager (Task Supervision)</option>
                  </select>
                  <p className="text-[10px] text-[#A3A0B0] mt-1 font-mono">
                    Tasks requiring this specialty will be automatically routed to this specialist.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A3A0B0] mb-1">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A0B0]" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#101014] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-xs font-mono text-[#F2F0F7] focus:outline-none focus:border-[#A78BFA]/50"
                    />
                  </div>
                  <p className="text-[10px] text-[#A3A0B0] mt-1 font-mono">
                    If this specialist does not have an account yet, one will be created with this password.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Adding..." : "Add to Team"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
