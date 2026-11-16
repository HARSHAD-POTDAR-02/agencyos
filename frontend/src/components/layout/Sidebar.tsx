"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  CheckSquare, 
  FileCheck2, 
  BarChart3, 
  Settings, 
  Sparkles, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  Building2,
  Plus,
  Briefcase,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { agencyApi, taskApi, approvalApi } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    token,
    activeAgencyId,
    agencies,
    currentRole,
    isOwnerOrManager,
    isSpecialist,
    setActiveAgencyId,
    createAgency,
    logout,
  } = useAuth();
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [creatingAgency, setCreatingAgency] = useState(false);

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentAgency = agencies.find((a) => a.agency_id === (activeAgencyId || effectiveAgencyId));

  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [approvalCount, setApprovalCount] = useState<number | null>(null);

  const fetchBadgeCounts = useCallback(async () => {
    if (!token || !effectiveAgencyId) {
      setTaskCount(null);
      setApprovalCount(null);
      return;
    }
    try {
      const res = await agencyApi.badgeCounts(effectiveAgencyId, token);
      setTaskCount(res.tasks_active);
      setApprovalCount(res.approvals_count);
    } catch {
      try {
        const [taskList, queue] = await Promise.all([
          taskApi.list(effectiveAgencyId, token, { limit: "200" }) as Promise<any[]>,
          approvalApi.queue(effectiveAgencyId, token) as Promise<any[]>,
        ]);
        const remaining = (taskList || []).filter(
          (t) => t.status !== "done" && t.status !== "approved"
        ).length;
        setTaskCount(remaining);
        const pending = (queue || []).filter(
          (i) => i.status === "client_review" || i.status === "internal_review" || i.status === "changes_requested"
        ).length;
        setApprovalCount(pending);
      } catch (err) {
        console.error("Failed to load badge counts", err);
      }
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => {
    fetchBadgeCounts();
  }, [fetchBadgeCounts, pathname]);

  useEffect(() => {
    const handleRefresh = () => fetchBadgeCounts();
    window.addEventListener("agencyos:badge-refresh", handleRefresh);
    const interval = setInterval(fetchBadgeCounts, 15000);
    return () => {
      window.removeEventListener("agencyos:badge-refresh", handleRefresh);
      clearInterval(interval);
    };
  }, [fetchBadgeCounts]);

  // Dynamic persona navigation based on logged-in role
  const navigation = isSpecialist
    ? [
        {
          name: "My Tasks & Workbench",
          href: "/tasks",
          icon: CheckSquare,
          badge: taskCount !== null ? String(taskCount) : null,
        },
        {
          name: "My Workspace",
          href: "/workspace",
          icon: Briefcase,
          badge: null,
        },
        {
          name: "Campaign Plans & Briefs",
          href: "/campaign-plans",
          icon: CalendarDays,
          badge: null,
        },
        {
          name: "Review Submissions",
          href: "/approvals",
          icon: FileCheck2,
          badge: approvalCount !== null ? String(approvalCount) : null,
        },
      ]
    : [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          badge: null,
        },
        {
          name: "Clients",
          href: "/clients",
          icon: Users,
          badge: null,
        },
        {
          name: "Team & Specialists",
          href: "/team",
          icon: UserCheck,
          badge: null,
        },
        {
          name: "Campaign Studio",
          href: "/campaigns",
          icon: Sparkles,
          badge: "AI",
        },
        {
          name: "Campaign Plans",
          href: "/campaign-plans",
          icon: CalendarDays,
          badge: null,
        },
        {
          name: "My Workspace",
          href: "/workspace",
          icon: Briefcase,
          badge: null,
        },
        {
          name: "Tasks",
          href: "/tasks",
          icon: CheckSquare,
          badge: taskCount !== null ? String(taskCount) : null,
        },
        {
          name: "Approvals",
          href: "/approvals",
          icon: FileCheck2,
          badge: approvalCount !== null ? String(approvalCount) : null,
        },
        {
          name: "Analytics",
          href: "/reports",
          icon: BarChart3,
          badge: null,
        },
      ];


  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgencyName.trim()) return;
    setCreatingAgency(true);
    try {
      await createAgency(newAgencyName.trim());
      setNewAgencyName("");
      setShowAgencyModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingAgency(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 shrink-0 bg-[#0B0D14] text-slate-300 border-r border-white/[0.08] flex flex-col h-screen select-none">
      {/* Brand & Agency Selector */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/25 ring-1 ring-white/20">
              <span className="text-white font-extrabold text-base tracking-wider">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm tracking-tight truncate">
                  {currentAgency?.agency_name || "Select Workspace"}
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isSpecialist ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    {currentRole === "writer" ? "⚡ Scriptwriter" : currentRole === "editor" ? "🎬 Video Editor" : "🎨 Designer"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                    👑 {currentRole || "Owner"}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-medium">
                  {isSpecialist ? "Workbench" : "Executive"}
                </span>
              </div>
            </div>
          </div>

          {!isSpecialist && (
            <button
              onClick={() => setShowAgencyModal(true)}
              title="Create New Agency Workspace"
              className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Agency Switcher if multiple */}
        {agencies.length > 1 && (
          <div className="mt-3">
            <select
              value={activeAgencyId || ""}
              onChange={(e) => setActiveAgencyId(e.target.value)}
              className="w-full text-xs bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-lg py-1.5 px-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
            >
              {agencies.map((agency) => (
                <option key={agency.agency_id} value={agency.agency_id} className="bg-[#121520] text-slate-200">
                  {agency.agency_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {agencies.length === 0 && !isSpecialist && (
          <button
            onClick={() => setShowAgencyModal(true)}
            className="mt-3 w-full py-1.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Agency Workspace</span>
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="px-3 pt-4 pb-2">
        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-between">
          <span>{isSpecialist ? "⚡ Specialist Tools" : "Agency Management"}</span>
          {isSpecialist && (
            <span className="text-[9px] text-amber-400/90 font-mono font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Tasks Only
            </span>
          )}
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative",
                isActive
                  ? "bg-purple-600/15 text-white font-semibold border border-purple-500/30 shadow-sm shadow-purple-950/50"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                    isActive ? "text-purple-400" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors",
                    item.badge === "AI"
                      ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/30"
                      : item.name === "Approvals" && Number(item.badge) > 0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs shadow-amber-500/20"
                      : "bg-white/[0.08] text-slate-300"
                  )}
                >
                  {item.badge}
                </span>
              )}

              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-purple-500 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI Pro Banner */}
      <div className="p-3 mx-3 mb-3 rounded-2xl bg-gradient-to-b from-purple-950/40 via-purple-900/20 to-transparent border border-purple-500/20 relative overflow-hidden group">
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-purple-500/20 rounded-full blur-xl group-hover:bg-purple-500/30 transition-colors" />
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1 rounded-md bg-purple-500/20 text-purple-300">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-white tracking-tight">AI Strategy Copilot</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
          Generate full month reels, hooks & shot lists in 1-click.
        </p>
        <Link
          href="/campaigns"
          className="inline-flex items-center justify-between w-full px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-semibold transition-all shadow-sm shadow-purple-600/30"
        >
          <span>Open AI Planner</span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* User profile & actions */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0E1018]">
        {user ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10 shrink-0">
                {user.full_name?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Create Agency Modal */}
      {showAgencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#11131C] text-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Create Agency Workspace</h3>
              <button
                onClick={() => setShowAgencyModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAgency} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Agency Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elevate Social"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAgencyModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAgency}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {creatingAgency ? "Creating..." : "Create Agency"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
