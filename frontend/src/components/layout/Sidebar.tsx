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
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Command
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load and persist sidebar collapse state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agencyos_sidebar_collapsed");
      if (saved === "true") setIsCollapsed(true);
    } catch {
      // Ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("agencyos_sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Keyboard shortcut: [ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Grouped navigation structure (Linear / Arc reference)
  const navGroups = isSpecialist
    ? [
        {
          group: "My Workbench",
          items: [
            {
              name: "Tasks",
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
              name: "Approvals",
              href: "/approvals",
              icon: FileCheck2,
              badge: approvalCount !== null ? String(approvalCount) : null,
            },
          ],
        },
        {
          group: "Campaigns & Briefs",
          items: [
            {
              name: "Campaign Plans",
              href: "/campaign-plans",
              icon: CalendarDays,
              badge: null,
            },
          ],
        },
      ]
    : [
        {
          group: "Operations",
          items: [
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
              name: "Team",
              href: "/team",
              icon: UserCheck,
              badge: null,
            },
          ],
        },
        {
          group: "Creative Studio",
          items: [
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
              name: "Reports & ROI",
              href: "/reports",
              icon: BarChart3,
              badge: null,
            },
          ],
        },
        {
          group: "Personal",
          items: [
            {
              name: "My Workspace",
              href: "/workspace",
              icon: Briefcase,
              badge: null,
            },
          ],
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
    <aside 
      className={cn(
        "shrink-0 bg-[#17171E] text-[#A3A0B0] border-r border-white/[0.08] flex flex-col h-screen select-none relative z-30 transition-all duration-200 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* ── Brand & Workspace Context Header ── */}
      <div className={cn("border-b border-white/[0.08] p-3 flex flex-col justify-center", isCollapsed ? "h-14 items-center px-2" : "h-14")}>
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Agency Monogram & Identity */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#262630] to-[#17171E] border border-white/[0.1] shadow-inner flex items-center justify-center shrink-0">
              <span className="text-[#A78BFA] font-bold text-xs tracking-wider font-mono">
                {currentAgency?.agency_name?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-[#F2F0F7] text-xs tracking-tight truncate">
                    {currentAgency?.agency_name || "Workspace"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#A3A0B0] font-mono">
                  <span>{isSpecialist ? currentRole : "Owner"}</span>
                  <span className="text-white/[0.2]">&bull;</span>
                  <span className="text-[#45B88A]">Online</span>
                </div>
              </div>
            )}
          </div>

          {/* Collapse Toggle Trigger */}
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand Sidebar ([)" : "Collapse Sidebar ([)"}
            className="p-1 rounded-md text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04] transition-colors cursor-pointer shrink-0"
          >
            {isCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Grouped Navigation Links (Linear Style) ── */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto scrollbar-none">
        {navGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            {!isCollapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]/60">
                {grp.group}
              </p>
            )}

            <div className="space-y-0.5">
              {grp.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-xs font-medium transition-all group relative cursor-pointer",
                      isCollapsed 
                        ? "justify-center p-2" 
                        : "justify-between px-2.5 py-1.5",
                      isActive
                        ? "bg-white/[0.08] text-[#F2F0F7] font-semibold shadow-xs"
                        : "text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Active Left Pill */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[#A78BFA]" />
                    )}

                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isActive ? "text-[#A78BFA]" : "text-[#A3A0B0] group-hover:text-[#F2F0F7]"
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={cn(
                          "px-1.5 py-0.2 text-[9px] font-mono font-bold rounded tracking-wide transition-colors shrink-0",
                          item.badge === "AI"
                            ? "bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30"
                            : item.name === "Approvals" && Number(item.badge) > 0
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Compact AI Assistant Entry (Raycast Style) ── */}
      {!isSpecialist && !isCollapsed && (
        <div className="px-2.5 py-2 border-t border-white/[0.06] bg-[#101014]/40">
          <Link
            href="/campaigns"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg surface-card surface-card-hover border border-white/[0.08] text-xs transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
              <span className="font-semibold text-[#F2F0F7] truncate text-[11px]">AI Copilot</span>
            </div>
            <span className="kbd-pill text-[9px]">⌘P</span>
          </Link>
        </div>
      )}

      {/* ── User Profile & Sign Out Footer ── */}
      <div className={cn("border-t border-white/[0.08] bg-[#14141A]/60 p-2", isCollapsed ? "flex flex-col items-center" : "")}>
        {user ? (
          <div className={cn("flex items-center rounded-lg p-1 transition-colors w-full", isCollapsed ? "justify-center" : "justify-between gap-2 hover:bg-white/[0.03]")}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#262630] to-[#17171E] border border-white/[0.1] shadow-inner flex items-center justify-center text-[#F2F0F7] font-semibold text-xs shrink-0 font-mono">
                {user.full_name?.charAt(0).toUpperCase() || "A"}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#F2F0F7] truncate leading-tight">{user.full_name}</p>
                  <p className="text-[10px] font-mono text-[#A3A0B0]/70 truncate">{user.email}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1 text-[#A3A0B0] hover:text-[#E16F7B] hover:bg-[#E16F7B]/10 rounded-md transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
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
          <div className="surface-card text-[#F2F0F7] rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-white/[0.1]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F2F0F7]">Create Agency Workspace</h3>
              <button
                onClick={() => setShowAgencyModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-xs cursor-pointer"
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
                  className="w-full bg-[#101014] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 focus:outline-none focus:border-[#A78BFA]/50"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAgencyModal(false)}
                  className="px-3 py-1.5 text-xs text-[#A3A0B0] hover:text-[#F2F0F7] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAgency}
                  className="px-3.5 py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
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
