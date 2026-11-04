"use client";

import React from "react";
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
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navigation = [
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
    name: "Campaigns",
    href: "/campaigns",
    icon: CalendarDays,
    badge: "AI",
  },
  {
    name: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    badge: "12",
  },
  {
    name: "Approvals",
    href: "/approvals",
    icon: FileCheck2,
    badge: "3",
  },
  {
    name: "Analytics",
    href: "/reports",
    icon: BarChart3,
    badge: null,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeAgencyId, agencies, setActiveAgencyId, logout } = useAuth();

  const currentAgency = agencies.find((a) => a.agency_id === activeAgencyId);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 shrink-0 bg-[#0B0D14] text-slate-300 border-r border-white/[0.08] flex flex-col h-screen select-none">
      {/* Brand & Agency Selector */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/25 ring-1 ring-white/20">
            <span className="text-white font-extrabold text-base tracking-wider">A</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm tracking-tight truncate">
                {currentAgency?.agency_name || "AgencyOS"}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 font-medium capitalize flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-500" />
              {currentAgency?.role ? `${currentAgency.role}` : "Agency Workspace"}
            </p>
          </div>
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
      </div>

      {/* Main Navigation */}
      <div className="px-3 pt-4 pb-2">
        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Main Menu
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
                    "px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider",
                    item.badge === "AI"
                      ? "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/30"
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
    </aside>
  );
}
