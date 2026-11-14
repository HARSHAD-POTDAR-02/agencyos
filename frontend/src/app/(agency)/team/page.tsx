"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
  Copy
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

const ROLE_CONFIG: Record<string, { label: string; description: string; icon: any; color: string; bg: string }> = {
  owner: {
    label: "Agency Owner",
    description: "Full control over agency, billing, and all client workspaces",
    icon: ShieldCheck,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
  manager: {
    label: "Production Manager",
    description: "Supervises workflows, reviews submissions, and manages tasks",
    icon: ShieldCheck,
    color: "text-indigo-700",
    bg: "bg-indigo-50 border-indigo-200",
  },
  writer: {
    label: "Scriptwriter / Copywriter",
    description: "Auto-assigned to scripting, captions, and hook development",
    icon: PenTool,
    color: "text-fuchsia-700",
    bg: "bg-fuchsia-50 border-fuchsia-200",
  },
  editor: {
    label: "Video Editor",
    description: "Auto-assigned to video cutting, sound sync, and filming tasks",
    icon: Video,
    color: "text-sky-700",
    bg: "bg-sky-50 border-sky-200",
  },
  designer: {
    label: "Graphic Designer",
    description: "Auto-assigned to visual carousels, thumbnails, and graphic assets",
    icon: Palette,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  strategist: {
    label: "Content Strategist",
    description: "Builds campaign roadmaps, audience hooks, and competitive angles",
    icon: Compass,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  account_manager: {
    label: "Account Manager",
    description: "Coordinates with client reviewers and manages timeline approvals",
    icon: Briefcase,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
};

export default function TeamManagementPage() {
  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);
  const isManagerOrOwner = ["owner", "manager"].includes(currentMembership?.role || "");

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [password, setPassword] = useState("AgencyPass123!");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load team members
  const loadMembers = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await agencyApi.listMembers(effectiveAgencyId, token)) as MemberItem[];
      setMembers(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load agency members");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

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
      if (roleFilter === "management") return ["owner", "manager", "strategist", "account_manager"].includes(m.role);
      return m.role === roleFilter;
    });
  }, [members, searchQuery, roleFilter]);

  // Specialist counts
  const specialistsCount = members.filter((m) => ["writer", "editor", "designer"].includes(m.role)).length;
  const managersCount = members.filter((m) => ["owner", "manager", "strategist", "account_manager"].includes(m.role)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Team & Production Specialists</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Add your scriptwriters, video editors, and designers. When AI generates campaign tasks, they are automatically assigned directly to the registered specialist on your team.
          </p>
        </div>

        {isManagerOrOwner && (
          <button
            onClick={() => {
              setModalError(null);
              setCreatedCredentials(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Specialist / Employee</span>
          </button>
        )}
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Members</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{members.length}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Active team roster</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Creative Specialists</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{specialistsCount}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Writers, Editors & Designers</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Management & Strategy</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{managersCount}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Owners, Managers & Strategists</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-600"
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: "all", label: "All Members" },
            { id: "specialists", label: "Creative Specialists" },
            { id: "management", label: "Management" },
            { id: "writer", label: "Writers" },
            { id: "editor", label: "Editors" },
            { id: "designer", label: "Designers" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                roleFilter === tab.id
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TEAM MEMBERS TABLE / CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading agency members...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No members match your criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your scriptwriter, video editor, or designer so AgencyOS can auto-route production tasks.
            </p>
            {isManagerOrOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Specialist Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-4">Role & Specialization</th>
                  <th className="py-3 px-4">Automatic Task Assignment</th>
                  <th className="py-3 px-4">Joined</th>
                  {isManagerOrOwner && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => {
                  const roleMeta = ROLE_CONFIG[m.role] || {
                    label: m.role,
                    description: "Agency Team Member",
                    icon: User,
                    color: "text-slate-700",
                    bg: "bg-slate-100 border-slate-200",
                  };
                  const RoleIcon = roleMeta.icon;
                  const isSelf = user?.email === m.user_email;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                            {m.user_full_name?.charAt(0).toUpperCase() || m.user_email?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {m.user_full_name || m.user_email?.split("@")[0]}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-black uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">{m.user_email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector / Badge */}
                      <td className="py-4 px-4">
                        {isManagerOrOwner && !isSelf && m.role !== "owner" ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${roleMeta.bg} ${roleMeta.color}`}
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
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold ${roleMeta.bg} ${roleMeta.color}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span>{roleMeta.label}</span>
                          </div>
                        )}
                      </td>

                      {/* Auto Assignment Description */}
                      <td className="py-4 px-4">
                        <span className="text-slate-500 text-xs">
                          {roleMeta.description}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 text-slate-400 text-xs">
                        {new Date(m.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      {isManagerOrOwner && (
                        <td className="py-4 px-4 text-right">
                          {!isSelf && m.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.user_email || "member")}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Remove from agency"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* HOW IT WORKS / ROLES EXPLANATION CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-slate-900">How Automatic Specialist Routing Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-purple-900">
              <PenTool className="w-4 h-4 text-purple-600" />
              <span>Scriptwriter (`writer`)</span>
            </div>
            <p className="text-purple-800/80 text-[11px] leading-relaxed">
              When a campaign is exported or 30-day deliverables are converted, all <strong>Scripting</strong> and <strong>Copywriting</strong> tasks are automatically routed to your registered writer.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-100 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sky-900">
              <Video className="w-4 h-4 text-sky-600" />
              <span>Video Editor (`editor`)</span>
            </div>
            <p className="text-sky-800/80 text-[11px] leading-relaxed">
              All <strong>Video Editing</strong>, cutting, pacing, and <strong>Filming</strong> tasks are automatically routed to your video editor so they can start post-production immediately.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <Palette className="w-4 h-4 text-emerald-600" />
              <span>Graphic Designer (`designer`)</span>
            </div>
            <p className="text-emerald-800/80 text-[11px] leading-relaxed">
              All thumbnail creation, carousel slide designs, static graphic ads, and visual overlays are routed directly to your designer.
            </p>
          </div>
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Team Specialist</h3>
                  <p className="text-xs text-slate-400">Add an employee to receive automatic task assignments</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {createdCredentials ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Specialist Added Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Share these credentials with your team member so they can log in to their workspace:
                  </p>
                  <div className="bg-white/80 rounded-xl p-3 text-xs font-mono space-y-1 border border-emerald-200/60">
                    <div><strong>Email:</strong> {createdCredentials.email}</div>
                    <div><strong>Password:</strong> {createdCredentials.pass}</div>
                    <div><strong>Role:</strong> {createdCredentials.role}</div>
                    <div><strong>Login URL:</strong> {window.location.origin}/login</div>
                  </div>
                  <button
                    onClick={handleCopyCredentials}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy Login Credentials"}</span>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setCreatedCredentials(null);
                      setShowAddModal(false);
                    }}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Liam Vance"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. liam.editor@agency.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Specialist Role *
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-600 cursor-pointer"
                  >
                    <option value="editor">Video Editor (Filming, Editing, Motion Graphics)</option>
                    <option value="writer">Scriptwriter / Copywriter (Hooks, Scripts, Captions)</option>
                    <option value="designer">Graphic Designer (Thumbnails, Carousels, Static Ads)</option>
                    <option value="strategist">Content Strategist (Roadmaps & Research)</option>
                    <option value="account_manager">Account Manager (Client Relations)</option>
                    <option value="manager">Production Manager (Task Supervision)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tasks requiring this specialty will be automatically assigned to this employee.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    If this employee does not have an account yet, one will be created with this password.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Adding..." : "Add to Team"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
