"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Search, 
  Bell, 
  Sparkles, 
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  CheckCircle2,
  Film,
  CheckSquare,
  Users,
  ArrowRight,
  FileCheck2,
  Share2,
  Check,
  ExternalLink,
  Clock,
  Briefcase,
  UserCheck,
  ChevronsUpDown,
  Command,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { agencyApi, SearchItem, NotificationItem } from "@/lib/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatRelativeTime(dateStr: string): string {
  try {
    if (!dateStr) return "";
    const hasTz = dateStr.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(dateStr);
    const normalized = hasTz ? dateStr : `${dateStr.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, activeAgencyId, agencies, setActiveAgencyId } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentAgency = agencies.find((a) => a.agency_id === (activeAgencyId || effectiveAgencyId));

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  const getPageTitle = (path: string) => {
    if (path === "/dashboard") return "Dashboard";
    if (path.startsWith("/clients")) return "Clients";
    if (path.startsWith("/campaigns")) return "Campaign Studio";
    if (path.startsWith("/campaign-plans")) return "Campaign Plans";
    if (path.startsWith("/tasks")) return "Tasks";
    if (path.startsWith("/approvals")) return "Approvals";
    if (path.startsWith("/team")) return "Team";
    if (path.startsWith("/reports")) return "Analytics";
    if (path.startsWith("/workspace")) return "Workspace";
    return "Operations";
  };
  const currentPageTitle = getPageTitle(pathname || "");

  // ──────────────────────────────────────────────
  // Period Selector State
  // ──────────────────────────────────────────────
  const [currentMonthNum, setCurrentMonthNum] = useState<number>(11);
  const [currentYearNum, setCurrentYearNum] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [showPeriodModal, setShowPeriodModal] = useState<boolean>(false);
  const periodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const actualMonth = now.getMonth() + 1;
    const actualYear = now.getFullYear();
    setCurrentMonthNum(actualMonth);
    setCurrentYearNum(actualYear);

    if (typeof window !== "undefined") {
      try {
        const savedMonth = localStorage.getItem("agencyos_selected_month");
        const savedYear = localStorage.getItem("agencyos_selected_year");
        if (savedMonth && savedYear) {
          const m = parseInt(savedMonth, 10);
          const y = parseInt(savedYear, 10);
          if (m >= 1 && m <= 12 && y >= 2020 && y <= 2030) {
            setSelectedMonth(m);
            setSelectedYear(y);
            return;
          }
        }
      } catch {
        // Ignore parse error
      }
    }
    setSelectedMonth(actualMonth);
    setSelectedYear(actualYear);
  }, []);

  const handleSelectPeriod = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agencyos_selected_month", String(m));
        localStorage.setItem("agencyos_selected_year", String(y));
        window.dispatchEvent(new CustomEvent("agencyos:period-changed", { detail: { month: m, year: y } }));
      } catch {
        // Ignore
      }
    }
    setShowPeriodModal(false);
  };

  const isCurrentMonthActive = selectedMonth === currentMonthNum && selectedYear === currentYearNum;

  // ──────────────────────────────────────────────
  // Global Search / Raycast Command Palette State
  // ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Global hotkey: Cmd+K / Ctrl+K and custom event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => {
          const next = !prev;
          if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
          return next;
        });
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setShowNotifications(false);
        setShowPeriodModal(false);
        setShowWorkspaceMenu(false);
        searchInputRef.current?.blur();
      }
    };

    const handleOpenCommand = () => {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("agencyos:open-command-palette", handleOpenCommand);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("agencyos:open-command-palette", handleOpenCommand);
    };
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!isSearchOpen) return;
    if (!token || !effectiveAgencyId) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await agencyApi.search(effectiveAgencyId, searchQuery.trim(), token);
        setSearchResults(res.results || []);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchOpen, token, effectiveAgencyId]);

  const handleSearchResultClick = (item: SearchItem) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
    router.push(item.url);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1 >= searchResults.length ? 0 : prev + 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 < 0 ? searchResults.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSearchResultClick(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        handleSearchResultClick(searchResults[0]);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  // ──────────────────────────────────────────────
  // Notifications State
  // ──────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("agencyos_read_notifications");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setReadIds(new Set(parsed));
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token || !effectiveAgencyId) return;
    try {
      setLoadingNotifications(true);
      const res = await agencyApi.notifications(effectiveAgencyId, token);
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [token, effectiveAgencyId]);

  useEffect(() => {
    fetchNotifications();

    const handleRefresh = () => fetchNotifications();
    window.addEventListener("agencyos:badge-refresh", handleRefresh);
    const interval = setInterval(fetchNotifications, 20000);

    return () => {
      window.removeEventListener("agencyos:badge-refresh", handleRefresh);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    if (typeof window !== "undefined") {
      localStorage.setItem("agencyos_read_notifications", JSON.stringify(Array.from(allIds)));
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    const updated = new Set(readIds);
    updated.add(notif.id);
    setReadIds(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("agencyos_read_notifications", JSON.stringify(Array.from(updated)));
    }
    setShowNotifications(false);
    if (notif.url) {
      router.push(notif.url);
    }
  };

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (periodRef.current && !periodRef.current.contains(target)) {
        setShowPeriodModal(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(target)) {
        setShowWorkspaceMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quick navigation shortcuts for Command Palette
  const quickShortcuts = [
    { label: "Dashboard", href: "/dashboard", icon: CheckSquare, desc: "Operational metrics & pipeline" },
    { label: "Clients Directory", href: "/clients", icon: Users, desc: "Active & onboarding workspaces" },
    { label: "Campaign Studio", href: "/campaigns", icon: Sparkles, desc: "Autonomous multi-agent strategist" },
    { label: "Approvals Queue", href: "/approvals", icon: FileCheck2, desc: "Review client revisions & sign-offs" },
    { label: "Tasks & Operations", href: "/tasks", icon: CheckSquare, desc: "Deliverable workflows & assignments" },
    { label: "Team & Specialists", href: "/team", icon: UserCheck, desc: "Specialist roster & routing rules" },
    { label: "Performance Reports", href: "/reports", icon: Film, desc: "Monthly live delivery and social ROI" },
    { label: "My Workspace", href: "/workspace", icon: Briefcase, desc: "Personal execution desk & deliverables" },
  ];

  return (
    <header className="h-14 bg-[#17171E] border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 relative z-30">
      {/* ── Left: Compact Breadcrumbs & Workspace Switcher (Arc / Linear Style) ── */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <div ref={workspaceMenuRef} className="relative">
          <button
            onClick={() => setShowWorkspaceMenu((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md text-xs font-mono text-[#F2F0F7] hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Switch Workspace"
          >
            <span className="text-[#A3A0B0]/60 hidden md:inline">Workspace /</span>
            <span className="font-semibold truncate max-w-[120px] sm:max-w-[170px]">
              {currentAgency?.agency_name || "Agency"}
            </span>
            <ChevronsUpDown className="w-3 h-3 text-[#A3A0B0]/60 shrink-0" />
          </button>

          {/* Quick Workspace Switcher Popover */}
          {showWorkspaceMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-60 surface-card rounded-xl shadow-2xl border border-white/[0.1] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]/60 flex items-center justify-between">
                <span>Select Workspace</span>
                <span className="text-[9px] font-mono text-[#A3A0B0]/40">{agencies.length} available</span>
              </div>
              <div className="space-y-0.5 mt-1 max-h-48 overflow-y-auto">
                {agencies.map((agency) => {
                  const isSelected = agency.agency_id === (activeAgencyId || effectiveAgencyId);
                  return (
                    <button
                      key={agency.agency_id}
                      onClick={() => {
                        setActiveAgencyId(agency.agency_id);
                        setShowWorkspaceMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer",
                        isSelected 
                          ? "bg-white/[0.08] text-[#F2F0F7] font-semibold" 
                          : "text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded bg-[#20202A] border border-white/[0.08] flex items-center justify-center font-mono text-[10px] text-[#A78BFA] shrink-0">
                          {agency.agency_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{agency.agency_name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span className="text-white/[0.2] text-xs font-mono">/</span>
        <span className="text-[#A78BFA] text-xs font-medium font-mono truncate">{currentPageTitle}</span>
      </div>

      {/* ── Center: Command Bar Trigger (Linear / Raycast Style) ── */}
      <div className="flex-1 max-w-md mx-2">
        <button
          onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#101014] border border-white/[0.08] hover:border-white/[0.18] text-xs text-[#A3A0B0] hover:text-[#F2F0F7] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-[#A3A0B0] group-hover:text-[#A78BFA] transition-colors shrink-0" />
            <span className="truncate text-xs text-[#A3A0B0]/60 group-hover:text-[#A3A0B0]">
              Search or jump to...
            </span>
          </div>
          <kbd className="kbd-pill text-[9px] shrink-0">⌘K</kbd>
        </button>
      </div>

      {/* ── Right: Global Actions (Period, Notifications, Profile) ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Period Selector ("This Month") */}
        <div ref={periodRef} className="relative">
          <button
            onClick={() => {
              setShowPeriodModal(!showPeriodModal);
              setShowNotifications(false);
              setShowWorkspaceMenu(false);
            }}
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
              isCurrentMonthActive
                ? "border-white/[0.08] bg-[#20202A] text-[#F2F0F7] hover:bg-[#262630]"
                : "border-[#A78BFA]/30 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20"
            )}
            title="Change reporting & sprint period"
          >
            <Calendar className={cn("w-3.5 h-3.5", isCurrentMonthActive ? "text-[#A3A0B0]" : "text-[#A78BFA]")} />
            <span>
              {isCurrentMonthActive ? "This Month" : `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`}
            </span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showPeriodModal && "rotate-180 text-[#A78BFA]")} />
          </button>

          {/* Period Selection Popover */}
          {showPeriodModal && (
            <div className="absolute right-0 mt-2 w-80 surface-card rounded-2xl shadow-2xl border border-white/[0.1] p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <span className="text-xs font-semibold text-[#F2F0F7]">Period & Reporting</span>
                <span className="text-[10px] text-[#A3A0B0]/60 font-mono">Sprints & Delivery</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                <button
                  type="button"
                  onClick={() => handleSelectPeriod(currentMonthNum, currentYearNum)}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    selectedMonth === currentMonthNum && selectedYear === currentYearNum
                      ? "bg-[#A78BFA] text-[#101014] font-bold"
                      : "bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08]"
                  )}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prevMonth = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
                    const prevYear = currentMonthNum === 1 ? currentYearNum - 1 : currentYearNum;
                    handleSelectPeriod(prevMonth, prevYear);
                  }}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    selectedMonth === (currentMonthNum === 1 ? 12 : currentMonthNum - 1) &&
                    selectedYear === (currentMonthNum === 1 ? currentYearNum - 1 : currentYearNum)
                      ? "bg-[#A78BFA] text-[#101014] font-bold"
                      : "bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08]"
                  )}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextMonth = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
                    const nextYear = currentMonthNum === 12 ? currentYearNum + 1 : currentYearNum;
                    handleSelectPeriod(nextMonth, nextYear);
                  }}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    selectedMonth === (currentMonthNum === 12 ? 1 : currentMonthNum + 1) &&
                    selectedYear === (currentMonthNum === 12 ? currentYearNum + 1 : currentYearNum)
                      ? "bg-[#A78BFA] text-[#101014] font-bold"
                      : "bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08]"
                  )}
                >
                  Next Month
                </button>
              </div>

              {/* Year Navigation */}
              <div className="flex items-center justify-between mt-3 px-1">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1 rounded-md hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-[#F2F0F7] font-mono">{selectedYear}</span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1 rounded-md hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
                  title="Next Year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {MONTH_SHORT.map((mShort, idx) => {
                  const mNum = idx + 1;
                  const isSelected = selectedMonth === mNum;
                  const isCurrent = mNum === currentMonthNum && selectedYear === currentYearNum;

                  return (
                    <button
                      key={mShort}
                      type="button"
                      onClick={() => handleSelectPeriod(mNum, selectedYear)}
                      className={cn(
                        "py-1.5 text-xs rounded-lg font-medium transition-all relative cursor-pointer",
                        isSelected
                          ? "bg-[#A78BFA] text-[#101014] font-bold"
                          : isCurrent
                          ? "bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30"
                          : "hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7]"
                      )}
                    >
                      {mShort}
                      {isCurrent && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#A78BFA]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct Quick Links */}
              <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-1 text-xs">
                <Link
                  href={`/reports?month=${selectedMonth}&year=${selectedYear}`}
                  onClick={() => setShowPeriodModal(false)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#20202A] text-[#A78BFA] font-medium transition-colors group cursor-pointer"
                >
                  <span>Open Delivery Report ({MONTH_SHORT[selectedMonth - 1]})</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#A78BFA] group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href={`/campaigns?month=${selectedMonth}&year=${selectedYear}`}
                  onClick={() => setShowPeriodModal(false)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors group cursor-pointer"
                >
                  <span>Plan Sprint for {MONTH_SHORT[selectedMonth - 1]}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#A3A0B0] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Notifications Popover ── */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowPeriodModal(false);
              setShowWorkspaceMenu(false);
            }}
            className="p-2 rounded-lg text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04] relative transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#A78BFA] text-[#101014] font-bold text-[10px] flex items-center justify-center ring-2 ring-[#17171E] animate-in zoom-in-75 font-mono">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 sm:w-96 surface-card rounded-2xl shadow-2xl border border-white/[0.1] p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#F2F0F7]">Activity Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold bg-[#A78BFA]/15 text-[#A78BFA] px-1.5 py-0.2 rounded font-mono">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-[#A78BFA] hover:text-[#B69BFF] font-medium cursor-pointer transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="py-2 max-h-[360px] overflow-y-auto space-y-1.5 text-xs scrollbar-none">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="py-8 text-center text-[#A3A0B0]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#A78BFA]" />
                    <span>Loading activity...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-[#A3A0B0]">
                    <CheckCircle2 className="w-7 h-7 text-[#45B88A] mx-auto mb-2" />
                    <p className="font-semibold text-[#F2F0F7]">All caught up!</p>
                    <p className="text-[11px] text-[#A3A0B0]/70 mt-0.5">No pending notifications at this time.</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isRead = readIds.has(notif.id);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          "p-2.5 rounded-lg transition-all cursor-pointer flex items-start gap-3 relative",
                          !isRead
                            ? "bg-[#20202A] hover:bg-[#262630] border border-white/[0.08]"
                            : "hover:bg-white/[0.04] border border-transparent"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.category === "approval" && (
                            <div className="w-7 h-7 rounded-md bg-[#E5AA58]/10 text-[#E5AA58] flex items-center justify-center border border-[#E5AA58]/20">
                              <FileCheck2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "publish" && (
                            <div className="w-7 h-7 rounded-md bg-[#45B88A]/10 text-[#45B88A] flex items-center justify-center border border-[#45B88A]/20">
                              <Share2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "task" && (
                            <div className="w-7 h-7 rounded-md bg-[#69A9D8]/10 text-[#69A9D8] flex items-center justify-center border border-[#69A9D8]/20">
                              <CheckSquare className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "client" && (
                            <div className="w-7 h-7 rounded-md bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center border border-[#A78BFA]/20">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-[#F2F0F7] truncate text-xs">{notif.title}</p>
                            {notif.is_urgent && (
                              <span className="text-[9px] font-semibold text-[#E16F7B] bg-[#E16F7B]/10 px-1.5 py-0.2 rounded border border-[#E16F7B]/30 shrink-0 font-mono">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#A3A0B0] mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.description}
                          </p>
                          <p className="text-[10px] text-[#A3A0B0]/60 mt-1 flex items-center gap-1 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatRelativeTime(notif.timestamp)}</span>
                          </p>
                        </div>

                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#A78BFA] ring-2 ring-[#A78BFA]/20 shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

        {/* User Monogram Avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#262630] to-[#17171E] border border-white/[0.1] shadow-inner flex items-center justify-center text-[#F2F0F7] font-semibold text-xs font-mono">
            {user?.full_name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-[#F2F0F7] leading-none">
              {user?.full_name || "Harshad Potdar"}
            </p>
            <p className="text-[10px] text-[#A3A0B0]/70 mt-1 leading-none font-mono">
              Agency Owner
            </p>
          </div>
        </div>
      </div>

      {/* ── Elevated Raycast Command Palette Modal (⌘K) ── */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            ref={searchContainerRef}
            className="w-full max-w-xl surface-card rounded-2xl shadow-2xl border border-white/[0.12] overflow-hidden z-50 animate-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]"
          >
            {/* Input Bar */}
            <div className="p-3 border-b border-white/[0.08] flex items-center gap-3 bg-[#101014]/60">
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-[#A78BFA] animate-spin shrink-0" />
              ) : (
                <Search className="w-4 h-4 text-[#A3A0B0] shrink-0" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Type a command, client, deliverable, or task..."
                className="w-full bg-transparent text-sm text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-[#A3A0B0] hover:text-[#F2F0F7] rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="kbd-pill text-[9px] shrink-0">ESC</kbd>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-2 max-h-[50vh] scrollbar-none">
              {searchQuery.trim().length === 0 ? (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-mono font-semibold text-[#A3A0B0]/60 uppercase tracking-wider">
                    Quick Navigation
                  </p>
                  <div className="space-y-0.5 mt-1">
                    {quickShortcuts.map((sc) => {
                      const Icon = sc.icon;
                      return (
                        <button
                          key={sc.href}
                          onClick={() => {
                            setIsSearchOpen(false);
                            router.push(sc.href);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#20202A] border border-white/[0.08] group-hover:border-[#A78BFA]/30 group-hover:text-[#A78BFA] text-[#A3A0B0] flex items-center justify-center transition-colors">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#F2F0F7] group-hover:text-[#A78BFA] transition-colors">
                                {sc.label}
                              </p>
                              <p className="text-[11px] text-[#A3A0B0]/70">{sc.desc}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#A3A0B0]/40 group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : isSearching ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 text-[#A78BFA] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#A3A0B0]">Searching your workspace...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-white/[0.06]">
                  {["client", "deliverable", "campaign", "task"].map((cat) => {
                    const items = searchResults.filter((r) => r.category === cat);
                    if (items.length === 0) return null;

                    const catLabels: Record<string, { label: string; icon: any; color: string }> = {
                      client: { label: "Clients", icon: Users, color: "text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/20" },
                      deliverable: { label: "Deliverables", icon: Film, color: "text-[#45B88A] bg-[#45B88A]/10 border-[#45B88A]/20" },
                      campaign: { label: "Campaigns", icon: Sparkles, color: "text-[#69A9D8] bg-[#69A9D8]/10 border-[#69A9D8]/20" },
                      task: { label: "Tasks", icon: CheckSquare, color: "text-[#E5AA58] bg-[#E5AA58]/10 border-[#E5AA58]/20" },
                    };
                    const meta = catLabels[cat];
                    const Icon = meta.icon;

                    return (
                      <div key={cat} className="py-2 first:pt-1 last:pb-1">
                        <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-mono font-semibold text-[#A3A0B0]/60 uppercase tracking-wider">
                          <Icon className="w-3 h-3" />
                          <span>{meta.label}</span>
                          <span className="text-white/[0.2]">({items.length})</span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {items.map((item) => {
                            const itemGlobalIndex = searchResults.findIndex((x) => x.id === item.id);
                            const isSelected = selectedIndex === itemGlobalIndex;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSearchResultClick(item)}
                                onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer",
                                  isSelected 
                                    ? "bg-white/[0.08] text-[#F2F0F7] border border-white/[0.12]" 
                                    : "hover:bg-white/[0.04] text-[#F2F0F7]"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", meta.color)}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate leading-snug">{item.title}</p>
                                    <p className="text-[10px] font-mono text-[#A3A0B0]/70 truncate">{item.subtitle}</p>
                                  </div>
                                </div>
                                {item.badge && (
                                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded shrink-0 ml-2 bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]">
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search className="w-7 h-7 text-[#A3A0B0]/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#F2F0F7]">No results found for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-[#A3A0B0]/70 mt-1">
                    Try searching for a client name, deliverable title, or task keyword.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Keyboard Footer */}
            <div className="px-4 py-2 bg-[#121217] border-t border-white/[0.08] flex items-center justify-between text-[10px] text-[#A3A0B0]/70 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="kbd-pill text-[9px]">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="kbd-pill text-[9px]">↵</kbd> Select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="kbd-pill text-[9px]">ESC</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
