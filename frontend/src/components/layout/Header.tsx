"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  AlertCircle,
  Film,
  CheckSquare,
  Users,
  Layers,
  ArrowRight,
  FileCheck2,
  Share2,
  Check,
  ExternalLink,
  Clock,
  Briefcase
} from "lucide-react";
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
  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  // ──────────────────────────────────────────────
  // Period Selector State
  // ──────────────────────────────────────────────
  const [currentMonthNum, setCurrentMonthNum] = useState<number>(11);
  const [currentYearNum, setCurrentYearNum] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [showPeriodModal, setShowPeriodModal] = useState<boolean>(false);
  const periodRef = useRef<HTMLDivElement>(null);

  // Initialize actual current date and loaded period from localStorage on mount
  useEffect(() => {
    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();
    setCurrentMonthNum(curM);
    setCurrentYearNum(curY);

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agencyos_selected_period");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.month && parsed.year) {
            setSelectedMonth(parsed.month);
            setSelectedYear(parsed.year);
            return;
          }
        }
      } catch {
        // Ignore parse error
      }
    }
    setSelectedMonth(curM);
    setSelectedYear(curY);
  }, []);

  const handleSelectPeriod = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    if (typeof window !== "undefined") {
      localStorage.setItem("agencyos_selected_period", JSON.stringify({ month, year }));
      window.dispatchEvent(
        new CustomEvent("agencyos:period-change", { detail: { month, year } })
      );
    }
    setShowPeriodModal(false);
  };

  const isCurrentMonthActive = selectedMonth === currentMonthNum && selectedYear === currentYearNum;

  // ──────────────────────────────────────────────
  // Global Search State
  // ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global hotkey: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setShowNotifications(false);
        setShowPeriodModal(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  // Load read notification IDs from localStorage
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
      // Ignore parse error
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

  // ──────────────────────────────────────────────
  // Click outside listener for all popovers
  // ──────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (periodRef.current && !periodRef.current.contains(target)) {
        setShowPeriodModal(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quick navigation shortcuts when query is empty
  const quickShortcuts = [
    { label: "Clients Directory", href: "/clients", icon: Users, desc: "Active & onboarding workspaces" },
    { label: "AI Campaign Studio", href: "/campaigns", icon: Sparkles, desc: "Autonomous multi-agent strategist" },
    { label: "Approvals Queue", href: "/approvals", icon: FileCheck2, desc: "Review client revisions & sign-offs" },
    { label: "Tasks & Operations", href: "/tasks", icon: CheckSquare, desc: "Deliverable workflows & assignments" },
    { label: "Performance Reports", href: "/reports", icon: Film, desc: "Monthly live delivery and social ROI" },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative z-30">
      {/* ──────────────────────────────────────────────
          Global Search Bar (Linear / Raycast Style)
      ────────────────────────────────────────────── */}
      <div ref={searchContainerRef} className="relative w-80 md:w-96">
        <div className="relative w-full">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin absolute left-3.5 top-1/2 -translate-y-1/2" />
          ) : (
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          )}

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search clients, deliverables, tasks..."
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 pl-9 pr-14 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Global Search Results Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 top-full mt-2 w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
            {searchQuery.trim().length === 0 ? (
              // Empty search query: show quick shortcuts & recent
              <div className="p-3">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Quick Navigation</span>
                  <span className="text-[10px] font-normal text-slate-400">Press ↑↓ to navigate</span>
                </div>
                <div className="space-y-1 mt-1">
                  {quickShortcuts.map((sc) => {
                    const Icon = sc.icon;
                    return (
                      <button
                        key={sc.href}
                        onClick={() => {
                          setIsSearchOpen(false);
                          router.push(sc.href);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-purple-100 text-slate-600 group-hover:text-purple-700 flex items-center justify-center transition-colors">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 group-hover:text-purple-900 transition-colors">
                              {sc.label}
                            </p>
                            <p className="text-[11px] text-slate-400">{sc.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Recent Resources
                    </p>
                    <div className="space-y-1">
                      {searchResults.slice(0, 4).map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => handleSearchResultClick(item)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.category === "client" && <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                            {item.category === "deliverable" && <Film className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {item.category === "campaign" && <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                            {item.category === "task" && <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">{item.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          {item.badge && (
                            <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isSearching ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Searching your agency workspace...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100">
                {/* Group results */}
                {["client", "deliverable", "campaign", "task"].map((cat) => {
                  const items = searchResults.filter((r) => r.category === cat);
                  if (items.length === 0) return null;

                  const catLabels: Record<string, { label: string; icon: any; color: string }> = {
                    client: { label: "Clients", icon: Users, color: "text-purple-600 bg-purple-50" },
                    deliverable: { label: "Deliverables & Posts", icon: Film, color: "text-emerald-600 bg-emerald-50" },
                    campaign: { label: "Campaign Sprints", icon: Sparkles, color: "text-indigo-600 bg-indigo-50" },
                    task: { label: "Tasks", icon: CheckSquare, color: "text-blue-600 bg-blue-50" },
                  };
                  const meta = catLabels[cat];
                  const Icon = meta.icon;

                  return (
                    <div key={cat} className="py-2 first:pt-1 last:pb-1">
                      <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Icon className="w-3 h-3 text-slate-400" />
                        <span>{meta.label}</span>
                        <span className="text-slate-300">({items.length})</span>
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
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${
                                isSelected ? "bg-purple-50/80 text-purple-950" : "hover:bg-slate-50 text-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-7 h-7 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate leading-snug">{item.title}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                                </div>
                              </div>
                              {item.badge && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                                  isSelected ? "bg-purple-200/80 text-purple-800" : "bg-slate-100 text-slate-600"
                                }`}>
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
                <Search className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No results found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Try searching for a client name, deliverable title, or task keyword.
                </p>
              </div>
            )}

            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Use <kbd className="font-mono bg-white border border-slate-200 px-1 rounded">↵</kbd> to select</span>
              <span><kbd className="font-mono bg-white border border-slate-200 px-1 rounded">ESC</kbd> to close</span>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────
          Header Actions
      ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* ── Period Selector ("This Month") ── */}
        <div ref={periodRef} className="relative">
          <button
            onClick={() => {
              setShowPeriodModal(!showPeriodModal);
              setShowNotifications(false);
              setIsSearchOpen(false);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isCurrentMonthActive
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                : "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100"
            }`}
            title="Click to change reporting & sprint period"
          >
            <Calendar className={`w-3.5 h-3.5 ${isCurrentMonthActive ? "text-slate-400" : "text-purple-600"}`} />
            <span>
              {isCurrentMonthActive ? "This Month" : `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showPeriodModal ? "rotate-180 text-purple-600" : "text-slate-400"}`} />
          </button>

          {/* Period Selection Popover */}
          {showPeriodModal && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">Period & Reporting</span>
                <span className="text-[10px] text-slate-400">Sprints & Delivery</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                <button
                  type="button"
                  onClick={() => handleSelectPeriod(currentMonthNum, currentYearNum)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedMonth === currentMonthNum && selectedYear === currentYearNum
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedMonth === (currentMonthNum === 1 ? 12 : currentMonthNum - 1) &&
                    selectedYear === (currentMonthNum === 1 ? currentYearNum - 1 : currentYearNum)
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
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
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedMonth === (currentMonthNum === 12 ? 1 : currentMonthNum + 1) &&
                    selectedYear === (currentMonthNum === 12 ? currentYearNum + 1 : currentYearNum)
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  Next Month
                </button>
              </div>

              {/* Year Navigation */}
              <div className="flex items-center justify-between mt-3 px-1">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-800">{selectedYear}</span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
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
                      className={`py-1.5 text-xs rounded-xl font-medium transition-all relative ${
                        isSelected
                          ? "bg-purple-600 text-white font-bold shadow-xs"
                          : isCurrent
                          ? "bg-purple-50 text-purple-700 font-semibold border border-purple-200"
                          : "hover:bg-slate-100 text-slate-600"
                      }`}
                    >
                      {mShort}
                      {isCurrent && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct Quick Links */}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
                <Link
                  href={`/reports?month=${selectedMonth}&year=${selectedYear}`}
                  onClick={() => setShowPeriodModal(false)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-purple-50/70 text-purple-700 font-semibold transition-colors group"
                >
                  <span>Open Delivery Report ({MONTH_SHORT[selectedMonth - 1]})</span>
                  <ExternalLink className="w-3.5 h-3.5 text-purple-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href={`/campaigns?month=${selectedMonth}&year=${selectedYear}`}
                  onClick={() => setShowPeriodModal(false)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors group"
                >
                  <span>Plan Sprint for {MONTH_SHORT[selectedMonth - 1]}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* AI Action CTA */}
        <Link
          href="/campaigns"
          className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>AI Planner</span>
        </Link>

        {/* ── Notifications Popover ── */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowPeriodModal(false);
              setIsSearchOpen(false);
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white animate-in zoom-in-75">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Activity Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-semibold cursor-pointer transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="py-2 max-h-[360px] overflow-y-auto space-y-1.5 text-xs">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                    <span>Loading activity...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">All caught up!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">No pending notifications at this time.</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isRead = readIds.has(notif.id);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-3 relative ${
                          !isRead
                            ? "bg-purple-50/60 hover:bg-purple-50 border border-purple-100/60"
                            : "hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.category === "approval" && (
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                              <FileCheck2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "publish" && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Share2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "task" && (
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <CheckSquare className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.category === "client" && (
                            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-slate-900 truncate text-xs">{notif.title}</p>
                            {notif.is_urgent && (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded-full border border-rose-100 shrink-0">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.description}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatRelativeTime(notif.timestamp)}</span>
                          </p>
                        </div>

                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-purple-600 ring-2 ring-purple-100 shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* User Monogram Avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-purple-100">
            {user?.full_name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">
              {user?.full_name || "Harshad Potdar"}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1 leading-none">
              Agency Owner
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
