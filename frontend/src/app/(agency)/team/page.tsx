"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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

export default function TeamManagementPage() {
  const router = useRouter();
  const { user, token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentMembership = agencies.find((a) => a.agency_id === effectiveAgencyId);
  const isManagerOrOwner = ["owner", "manager", "account_manager"].includes(currentMembership?.role || "owner");

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

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
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load team members
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
    } catch (err: any) {
      setError(err?.message || "Failed to load agency members");
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, isSpecialist]);

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

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* HEADER CARD */}
      <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">Team & Production Specialists</h1>
              <p className="text-xs text-[#A3A0B0] max-w-2xl mt-0.5">
                Add your scriptwriters, video editors, and designers. When AI generates campaign tasks, they are automatically assigned directly to the registered specialist on your team.
              </p>
            </div>
          </div>
        </div>

        {isManagerOrOwner && (
          <button
            onClick={() => {
              setModalError(null);
              setCreatedCredentials(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Specialist / Employee</span>
          </button>
        )}
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#A3A0B0] uppercase tracking-wider">Total Members</p>
            <h3 className="text-3xl font-bold font-mono text-[#F2F0F7] mt-1">{members.length}</h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">Active team roster</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#20202A] border border-[#30303D] text-[#A78BFA] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#A3A0B0] uppercase tracking-wider">Creative Specialists</p>
            <h3 className="text-3xl font-bold font-mono text-[#F2F0F7] mt-1">{specialistsCount}</h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">Writers, Editors & Designers</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#20202A] border border-[#30303D] text-[#69A9D8] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#A3A0B0] uppercase tracking-wider">Management & Strategy</p>
            <h3 className="text-3xl font-bold font-mono text-[#F2F0F7] mt-1">{managersCount}</h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">Owners, Managers & Strategists</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#20202A] border border-[#30303D] text-[#45B88A] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] border border-[#30303D] rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-[#F2F0F7] placeholder-[#71717A] focus:outline-none focus:border-[#A78BFA]"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                roleFilter === tab.id
                  ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                  : "text-[#71717A] hover:text-[#F2F0F7]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TEAM MEMBERS TABLE / CARDS */}
      <div className="bg-[#17171E] rounded-xl border border-[#30303D] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#71717A] text-xs">
            <div className="w-6 h-6 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading agency members...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center mx-auto text-[#71717A]">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">No members match your criteria</h3>
            <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
              Add your scriptwriter, video editor, or designer so AgencyOS can auto-route production tasks.
            </p>
            {isManagerOrOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#A78BFA] text-[#101014] rounded-xl text-xs font-bold hover:bg-[#B69BFF] transition-all shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Specialist Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#20202A] border-b border-[#30303D] text-[#A3A0B0] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-4">Role & Specialization</th>
                  <th className="py-3 px-4">Automatic Task Assignment</th>
                  <th className="py-3 px-4">Joined</th>
                  {isManagerOrOwner && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30303D]/60">
                {filteredMembers.map((m) => {
                  const roleMeta = ROLE_CONFIG[m.role] || {
                    label: m.role,
                    description: "Agency Team Member",
                    icon: User,
                    color: "text-[#A3A0B0]",
                    bg: "bg-[#20202A] border-[#30303D]",
                  };
                  const RoleIcon = roleMeta.icon;
                  const isSelf = user?.email === m.user_email;

                  return (
                    <tr key={m.id} className="hover:bg-[#20202A]/40 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA] font-bold text-xs shrink-0 font-mono">
                            {m.user_full_name?.charAt(0).toUpperCase() || m.user_email?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#F2F0F7]">
                                {m.user_full_name || m.user_email?.split("@")[0]}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 text-[10px] font-mono font-bold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#71717A] block font-mono">{m.user_email}</span>
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
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:border-[#A78BFA] ${roleMeta.bg} ${roleMeta.color}`}
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
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${roleMeta.bg} ${roleMeta.color}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span>{roleMeta.label}</span>
                          </div>
                        )}
                      </td>

                      {/* Auto Assignment Description */}
                      <td className="py-4 px-4">
                        <span className="text-[#A3A0B0] text-xs">
                          {roleMeta.description}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 text-[#71717A] text-xs font-mono">
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
                              className="p-1.5 rounded-lg text-[#71717A] hover:text-[#E16F7B] hover:bg-[#E16F7B]/10 transition-colors"
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
      <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#A78BFA]" />
          <h2 className="text-sm font-heading font-bold text-[#F2F0F7]">How Automatic Specialist Routing Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#101014] border border-[#30303D] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#A78BFA]">
              <PenTool className="w-4 h-4 text-[#A78BFA]" />
              <span>Scriptwriter (`writer`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              When a campaign is exported or 30-day deliverables are converted, all <strong>Scripting</strong> and <strong>Copywriting</strong> tasks are automatically routed to your registered writer.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101014] border border-[#30303D] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#69A9D8]">
              <Video className="w-4 h-4 text-[#69A9D8]" />
              <span>Video Editor (`editor`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              All <strong>Video Editing</strong>, cutting, pacing, and <strong>Filming</strong> tasks are automatically routed to your video editor so they can start post-production immediately.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101014] border border-[#30303D] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#45B88A]">
              <Palette className="w-4 h-4 text-[#45B88A]" />
              <span>Graphic Designer (`designer`)</span>
            </div>
            <p className="text-[#A3A0B0] text-[11px] leading-relaxed">
              All thumbnail creation, carousel slide designs, static graphic ads, and visual overlays are routed directly to your designer.
            </p>
          </div>
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#17171E] rounded-3xl max-w-lg w-full p-6 border border-[#30303D] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#A78BFA]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-heading font-bold text-[#F2F0F7]">Add Team Specialist</h3>
                  <p className="text-xs text-[#A3A0B0]">Add an employee to receive automatic task assignments</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71717A] hover:text-[#F2F0F7] text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {createdCredentials ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-2xl bg-[#45B88A]/10 border border-[#45B88A]/30 text-[#45B88A] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#45B88A]" />
                    <span>Specialist Added Successfully!</span>
                  </div>
                  <p className="text-xs text-[#A3A0B0]">
                    Share these credentials with your team member so they can log in to their workspace:
                  </p>
                  <div className="bg-[#101014] rounded-xl p-3 text-xs font-mono space-y-1 border border-[#30303D] text-[#F2F0F7]">
                    <div><strong className="text-[#A3A0B0]">Email:</strong> {createdCredentials.email}</div>
                    <div><strong className="text-[#A3A0B0]">Password:</strong> {createdCredentials.pass}</div>
                    <div><strong className="text-[#A3A0B0]">Role:</strong> {createdCredentials.role}</div>
                    <div><strong className="text-[#A3A0B0]">Login URL:</strong> {window.location.origin}/login</div>
                  </div>
                  <button
                    onClick={handleCopyCredentials}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#45B88A] hover:bg-[#52c595] text-[#101014] rounded-xl text-xs font-bold transition-all shadow-xs"
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
                    className="px-4 py-2 bg-[#20202A] text-[#F2F0F7] text-xs font-semibold rounded-xl hover:bg-[#262630] border border-[#30303D] transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4 pt-4">
                {modalError && (
                  <div className="p-3 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                    <input
                      type="text"
                      placeholder="e.g. Liam Vance"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#101014] border border-[#30303D] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#F2F0F7] placeholder-[#71717A] focus:outline-none focus:border-[#A78BFA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. liam.editor@agency.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#101014] border border-[#30303D] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#F2F0F7] placeholder-[#71717A] focus:outline-none focus:border-[#A78BFA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Specialist Role *
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-[#101014] border border-[#30303D] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#F2F0F7] focus:outline-none focus:border-[#A78BFA] cursor-pointer"
                  >
                    <option value="editor">Video Editor (Filming, Editing, Motion Graphics)</option>
                    <option value="writer">Scriptwriter / Copywriter (Hooks, Scripts, Captions)</option>
                    <option value="designer">Graphic Designer (Thumbnails, Carousels, Static Ads)</option>
                    <option value="strategist">Content Strategist (Roadmaps & Research)</option>
                    <option value="account_manager">Account Manager (Client Relations)</option>
                    <option value="manager">Production Manager (Task Supervision)</option>
                  </select>
                  <p className="text-[11px] text-[#71717A] mt-1">
                    Tasks requiring this specialty will be automatically assigned to this employee.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A0B0] mb-1">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#101014] border border-[#30303D] rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono text-[#F2F0F7] focus:outline-none focus:border-[#A78BFA]"
                    />
                  </div>
                  <p className="text-[11px] text-[#71717A] mt-1">
                    If this employee does not have an account yet, one will be created with this password.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30303D]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#A3A0B0] hover:text-[#F2F0F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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