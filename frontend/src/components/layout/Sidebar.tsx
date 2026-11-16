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
    <aside className="w-[240px] shrink-0 bg-[#17171E] text-[#A3A0B0] border-r border-[#30303D] flex flex-col h-screen select-none relative z-30">
      {/* Brand & Agency Selector */}
      <div className="p-3 border-b border-[#30303D]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[#20202A] border border-[#30303D] flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-[#A78BFA] font-bold text-xs tracking-wider">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#F2F0F7] text-xs tracking-tight truncate">
                  {currentAgency?.agency_name || "Select Workspace"}
                </span>
                <ShieldCheck className="w-3 h-3 text-[#A78BFA] shrink-0 opacity-80" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isSpecialist ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                    {currentRole === "writer" ? "⚡ Scriptwriter" : currentRole === "editor" ? "🎬 Video Editor" : "🎨 Designer"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-white/[0.06] text-[#F2F0F7] border border-white/10">
                    👑 {currentRole || "Owner"}
                  </span>
                )}
                <span className="text-[10px] text-[#6C697D] font-mono">
                  {isSpecialist ? "Ops" : "Exec"}
                </span>
              </div>
            </div>
          </div>

          {!isSpecialist && (
            <button
              onClick={() => setShowAgencyModal(true)}
              title="Create New Agency Workspace"
              className="p-1 rounded-md bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Agency Switcher if multiple */}
        {agencies.length > 1 && (
          <div className="mt-2.5">
            <select
              value={activeAgencyId || ""}
              onChange={(e) => setActiveAgencyId(e.target.value)}
              className="w-full text-[11px] font-medium bg-[#101014] hover:bg-[#20202A] border border-[#30303D] rounded-lg py-1.5 px-2 text-[#F2F0F7] focus:outline-none focus:border-[#A78BFA] transition-colors"
            >
              {agencies.map((agency) => (
                <option key={agency.agency_id} value={agency.agency_id} className="bg-[#17171E] text-[#F2F0F7]">
                  {agency.agency_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {agencies.length === 0 && !isSpecialist && (
          <button
            onClick={() => setShowAgencyModal(true)}
            className="mt-2.5 w-full py-1.5 px-2.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Agency Workspace</span>
          </button>
        )}
      </div>

      {/* Navigation Group Header */}
      <div className="px-3 pt-3.5 pb-1">
        <p className="px-2 text-[10px] font-mono font-medium text-[#6C697D] uppercase tracking-wider flex items-center justify-between">
          <span>{isSpecialist ? "Specialist Workbench" : "Agency Operations"}</span>
          {isSpecialist && (
            <span className="text-[9px] text-amber-400 font-mono font-semibold uppercase bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
              Tasks
            </span>
          )}
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
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
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors group relative",
                isActive
                  ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                  : "text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A]/60"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-[#A78BFA]" : "text-[#6C697D] group-hover:text-[#A3A0B0]"
                  )}
                />
                <span className="truncate">{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 text-[10px] font-mono font-medium rounded tracking-wide transition-colors shrink-0",
                    item.badge === "AI"
                      ? "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20"
                      : item.name === "Approvals" && Number(item.badge) > 0
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "bg-[#20202A] text-[#A3A0B0] border border-[#30303D]"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Compact Contextual AI Studio Entry (Linear/Raycast style - replaces oversized promotional card) */}
      {!isSpecialist && (
        <div className="px-2.5 py-2 border-t border-[#30303D]">
          <Link
            href="/campaigns"
            className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#20202A]/70 hover:bg-[#20202A] border border-[#30303D] text-xs transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span className="font-medium text-[#F2F0F7]">Campaign Studio</span>
            </div>
            <span className="text-[10px] font-mono text-[#6C697D] group-hover:text-[#A3A0B0] bg-[#17171E] px-1.5 py-0.5 rounded border border-[#30303D]">
              AI
            </span>
          </Link>
        </div>
      )}

      {/* User profile & actions */}
      <div className="p-2.5 border-t border-[#30303D] bg-[#14141A]">
        {user ? (
          <div className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-[#20202A] transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-[#20202A] border border-[#30303D] flex items-center justify-center text-[#F2F0F7] font-semibold text-xs shrink-0">
                {user.full_name?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F2F0F7] truncate">{user.full_name}</p>
                <p className="text-[10px] font-mono text-[#6C697D] truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1 text-[#6C697D] hover:text-[#E16F7B] hover:bg-[#E16F7B]/10 rounded-md transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-1.5 px-3 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-lg shadow-xs transition-all"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Create Agency Modal */}
      {showAgencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#20202A] text-[#F2F0F7] rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-[#30303D]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F2F0F7]">Create Agency Workspace</h3>
              <button
                onClick={() => setShowAgencyModal(false)}
                className="text-[#6C697D] hover:text-[#F2F0F7] text-xs"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAgency} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-medium text-[#A3A0B0] uppercase tracking-wider mb-1.5">
                  Agency Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elevate Social"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  className="w-full bg-[#17171E] border border-[#30303D] rounded-lg px-3 py-2 text-xs text-[#F2F0F7] placeholder:text-[#6C697D] focus:outline-none focus:border-[#A78BFA]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30303D]">
                <button
                  type="button"
                  onClick={() => setShowAgencyModal(false)}
                  className="px-3 py-1.5 text-xs text-[#A3A0B0] hover:text-[#F2F0F7] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAgency}
                  className="px-3.5 py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50"
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
