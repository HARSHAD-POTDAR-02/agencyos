"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { deliverableApi, clientApi, campaignApi, API_BASE } from "@/lib/api";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileVideo,
  FileImage,
  Layers,
  Film,
  ExternalLink,
  Copy,
  Check,
  X,
  GripVertical,
  SlidersHorizontal,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  Play,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Send,
  Building2,
  Plus,
  Sliders,
  CalendarDays,
  CheckSquare,
  Square,
  LayoutGrid,
  Columns,
} from "lucide-react";

// --- Types ---
interface CalendarDeliverable {
  id: string;
  campaign_id: string;
  scope_item_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  campaign_title?: string | null;
  title: string;
  deliverable_type: string;
  platform: string;
  planned_date: string | null;
  status:
    | "not_started"
    | "in_production"
    | "internal_review"
    | "client_review"
    | "changes_requested"
    | "approved"
    | "scheduled"
    | "publishing"
    | "partially_published"
    | "published"
    | "failed"
    | "needs_reconnection"
    | "ambiguous"
    | "cancelled";
  scheduled_at?: string | null;
  scheduled_timezone?: string | null;
  published_at?: string | null;
  live_post_url?: string | null;
  latest_caption?: string | null;
  latest_asset_url?: string | null;
  latest_file_type?: string | null;
  tasks_count: number;
  tasks_completed_count: number;
  created_at: string;
  updated_at: string;
}

interface ClientOption {
  id: string;
  business_name: string;
}

interface CampaignOption {
  id: string;
  name: string;
  client_id: string;
}

interface SiblingTask {
  id: string;
  title: string;
  task_type: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id?: string | null;
}

interface DeliverableDetailData extends CalendarDeliverable {
  tasks?: SiblingTask[];
  content_versions?: Array<{
    id: string;
    version_number: number;
    storage_key: string;
    file_name: string;
    file_type: string | null;
    caption: string | null;
    created_at: string;
  }>;
}

// --- Platform Visuals & Icons ---
function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: string; className?: string }) {
  const p = (platform || "").toLowerCase();

  if (p === "instagram") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (p === "facebook") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  if (p === "linkedin") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    );
  }
  return <Film className={className} />;
}

function getPlatformBadge(platform: string) {
  const p = (platform || "").toLowerCase();
  if (p === "instagram") return "bg-gradient-to-r from-pink-500/15 via-rose-500/15 to-amber-500/15 text-pink-500 border-pink-500/30";
  if (p === "facebook") return "bg-blue-600/15 text-blue-500 border-blue-500/30";
  if (p === "linkedin") return "bg-sky-500/10 text-sky-500 border-sky-500/30";
  return "bg-black/[0.04] text-[#37352F] border-black/[0.08] dark:bg-white/[0.06] dark:text-[#A3A0B0]";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        color: "bg-[#EDF6ED] text-[#285E34] border-[#CCE3CC] dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
        dot: "bg-emerald-500",
      };
    case "published":
      return {
        label: "Published",
        color: "bg-[#EEF3F8] text-[#1E568A] border-[#C5D8E8] dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
        dot: "bg-blue-500",
      };
    case "in_production":
      return {
        label: "In Production",
        color: "bg-[#FDF5E8] text-[#8F4F00] border-[#F0D5A8] dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
        dot: "bg-amber-500",
      };
    case "internal_review":
    case "client_review":
      return {
        label: "Review",
        color: "bg-[#EEF3F8] text-[#1E568A] border-[#C5D8E8] dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30",
        dot: "bg-[#2383E2] dark:bg-purple-500",
      };
    case "changes_requested":
      return {
        label: "Changes Req.",
        color: "bg-[#FAECEC] text-[#932F2F] border-[#E8C2C2] dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30",
        dot: "bg-rose-500",
      };
    case "approved":
      return {
        label: "Approved",
        color: "bg-[#EDF6ED] text-[#285E34] border-[#CCE3CC] dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
        dot: "bg-emerald-500",
      };
    default:
      return {
        label: "Draft",
        color: "bg-[#F1F1EF] text-[#6B6A65] border-black/[0.08] dark:bg-white/[0.06] dark:text-[#A3A0B0] dark:border-white/[0.08]",
        dot: "bg-[#9B9A97]",
      };
  }
}

// Format date helper: YYYY-MM-DD string to clean human label
function formatCleanDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Format time string (e.g. 14:30) or ISO string into AM/PM
function formatTime(isoOrTime?: string | null): string {
  if (!isoOrTime) return "";
  try {
    if (isoOrTime.includes("T") || isoOrTime.includes("Z")) {
      const d = new Date(isoOrTime);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return isoOrTime;
  } catch {
    return isoOrTime;
  }
}

function CalendarContent() {
  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  // Data State
  const [deliverables, setDeliverables] = useState<CalendarDeliverable[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drag and drop state
  const [draggedDeliverableId, setDraggedDeliverableId] = useState<string | null>(null);
  const [dragOverDayStr, setDragOverDayStr] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  // Modal State
  const [activeDeliverableId, setActiveDeliverableId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DeliverableDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [editPlannedDate, setEditPlannedDate] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [savingModalChanges, setSavingModalChanges] = useState<boolean>(false);

  // Unscheduled Drawer Toggle
  const [showUnscheduledDrawer, setShowUnscheduledDrawer] = useState<boolean>(false);

  // Notifications
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch initial clients and campaigns
  useEffect(() => {
    if (!effectiveAgencyId || !token) return;

    clientApi
      .list(effectiveAgencyId, token)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : [];
        setClients(list.map((c: any) => ({ id: c.id, business_name: c.business_name })));
      })
      .catch((err) => {
        console.error("Failed to load clients for calendar", err);
      });
  }, [effectiveAgencyId, token]);

  // Fetch deliverables when month/year/filters change
  const fetchDeliverables = useCallback(async () => {
    if (!effectiveAgencyId || !token) return;
    setLoading(true);

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const params: Record<string, any> = {
        month,
        year,
      };
      if (selectedClientId !== "all") params.client_id = selectedClientId;
      if (selectedCampaignId !== "all") params.campaign_id = selectedCampaignId;
      if (selectedPlatform !== "all") params.platform = selectedPlatform;
      if (selectedStatus !== "all") params.status = selectedStatus;

      const data = await deliverableApi.list(effectiveAgencyId, token, params);
      setDeliverables(data || []);
    } catch (err: any) {
      console.error("Error loading deliverables for calendar:", err);
      showToast(err.message || "Failed to load calendar deliverables", "error");
    } finally {
      setLoading(false);
    }
  }, [effectiveAgencyId, token, currentDate, selectedClientId, selectedCampaignId, selectedPlatform, selectedStatus, showToast]);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  // Also fetch campaigns if a client is selected
  useEffect(() => {
    if (!effectiveAgencyId || !token) return;
    if (selectedClientId === "all") {
      setCampaigns([]);
      return;
    }

    campaignApi
      .list(effectiveAgencyId, selectedClientId, token)
      .then((camps: any) => {
        const list = Array.isArray(camps) ? camps : [];
        setCampaigns(list.map((c: any) => ({ id: c.id, name: c.name, client_id: selectedClientId })));
      })
      .catch((err) => console.error("Failed to fetch campaigns for calendar:", err));
  }, [effectiveAgencyId, token, selectedClientId]);

  // Detailed Modal Loader
  useEffect(() => {
    if (!activeDeliverableId || !effectiveAgencyId || !token) {
      setActiveDetail(null);
      return;
    }

    // Initialize with whatever we have in the list immediately
    const found = deliverables.find((d) => d.id === activeDeliverableId);
    if (found) {
      setActiveDetail(found);
      setEditPlannedDate(found.planned_date || "");
      setEditStatus(found.status || "not_started");
    }

    setLoadingDetail(true);
    deliverableApi
      .get(effectiveAgencyId, activeDeliverableId, token)
      .then((fullData: any) => {
        setActiveDetail(fullData as DeliverableDetailData);
        setEditPlannedDate(fullData.planned_date || "");
        setEditStatus(fullData.status || "not_started");
      })
      .catch((err) => {
        console.error("Failed to fetch full deliverable details:", err);
      })
      .finally(() => {
        setLoadingDetail(false);
      });
  }, [activeDeliverableId, effectiveAgencyId, token, deliverables]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, deliverableId: string) => {
    e.dataTransfer.setData("text/plain", deliverableId);
    setDraggedDeliverableId(deliverableId);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    if (dragOverDayStr !== dateStr) {
      setDragOverDayStr(dateStr);
    }
  };

  const handleDragLeave = (e: React.DragEvent, dateStr: string) => {
    if (dragOverDayStr === dateStr) {
      setDragOverDayStr(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDayStr(null);
    const delivId = draggedDeliverableId || e.dataTransfer.getData("text/plain");
    setDraggedDeliverableId(null);

    if (!delivId || !effectiveAgencyId || !token) return;

    const deliv = deliverables.find((d) => d.id === delivId);
    if (!deliv) return;
    if (deliv.planned_date === targetDateStr) return; // Unchanged

    const originalPlannedDate = deliv.planned_date;

    // Optimistic UI update
    setDeliverables((prev) =>
      prev.map((item) => (item.id === delivId ? { ...item, planned_date: targetDateStr } : item))
    );

    setIsRescheduling(true);
    try {
      await deliverableApi.update(
        effectiveAgencyId,
        delivId,
        { planned_date: targetDateStr },
        token
      );
      showToast(`Rescheduled "${deliv.title}" to ${formatCleanDate(targetDateStr)}`, "success");
    } catch (err: any) {
      console.error("Failed to reschedule deliverable:", err);
      // Rollback
      setDeliverables((prev) =>
        prev.map((item) => (item.id === delivId ? { ...item, planned_date: originalPlannedDate } : item))
      );
      showToast(err.message || "Failed to reschedule deliverable", "error");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Save Modal Changes (Date or Status)
  const handleSaveModalChanges = async () => {
    if (!activeDetail || !effectiveAgencyId || !token) return;
    setSavingModalChanges(true);

    try {
      const updated = await deliverableApi.update(
        effectiveAgencyId,
        activeDetail.id,
        {
          planned_date: editPlannedDate || null,
          status: editStatus,
        },
        token
      );

      setDeliverables((prev) =>
        prev.map((item) =>
          item.id === activeDetail.id
            ? { ...item, planned_date: editPlannedDate || null, status: editStatus as any }
            : item
        )
      );
      setActiveDetail((prev) => (prev ? { ...prev, planned_date: editPlannedDate || null, status: editStatus as any } : null));
      showToast("Deliverable updated successfully", "success");
    } catch (err: any) {
      console.error("Failed to update deliverable:", err);
      showToast(err.message || "Failed to update deliverable", "error");
    } finally {
      setSavingModalChanges(false);
    }
  };

  // Copy Caption to Clipboard
  const handleCopyCaption = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Filter deliverables in memory by search query
  const filteredDeliverables = useMemo(() => {
    if (!searchQuery.trim()) return deliverables;
    const q = searchQuery.toLowerCase();
    return deliverables.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.campaign_title && d.campaign_title.toLowerCase().includes(q)) ||
        (d.client_name && d.client_name.toLowerCase().includes(q)) ||
        (d.latest_caption && d.latest_caption.toLowerCase().includes(q))
    );
  }, [deliverables, searchQuery]);

  // Separate scheduled deliverables from unscheduled deliverables
  const { scheduledMap, unscheduledList } = useMemo(() => {
    const map = new Map<string, CalendarDeliverable[]>();
    const unscheduled: CalendarDeliverable[] = [];

    for (const d of filteredDeliverables) {
      if (d.planned_date) {
        const key = d.planned_date.slice(0, 10);
        const list = map.get(key) || [];
        list.push(d);
        map.set(key, list);
      } else {
        unscheduled.push(d);
      }
    }
    return { scheduledMap: map, unscheduledList: unscheduled };
  }, [filteredDeliverables]);

  // Month Grid Calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based indexing: Mon = 0, Sun = 6
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Leading padding days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, "0");
      const d = String(prevDate.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      days.push({
        dateStr,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Days in current month
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    for (let i = 1; i <= totalDaysInMonth; i++) {
      const curDate = new Date(year, month, i);
      const y = curDate.getFullYear();
      const m = String(curDate.getMonth() + 1).padStart(2, "0");
      const d = String(curDate.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing padding days to fill 35 or 42 grid cells
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(year, month + 1, i);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, "0");
      const d = String(nextDate.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentDate]);

  // Week Grid Calculation (Monday to Sunday)
  const weekDays = useMemo(() => {
    const cur = new Date(currentDate);
    const dayOfWeek = (cur.getDay() + 6) % 7; // Mon = 0
    cur.setDate(cur.getDate() - dayOfWeek); // Move to Monday

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dayNum}`;
      days.push({
        dateObj: d,
        dateStr,
        dayNumber: d.getDate(),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate]);

  // KPI calculations
  const totalDeliverablesCount = deliverables.length;
  const scheduledCount = deliverables.filter((d) => d.status === "scheduled" || d.status === "published").length;
  const inProductionCount = deliverables.filter((d) => d.status === "in_production").length;
  const reviewCount = deliverables.filter((d) => d.status === "internal_review" || d.status === "client_review").length;

  return (
    <div className="min-h-screen bg-[#101014] text-[#E4E4E7] flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-[#18181F] border-emerald-500/40 text-emerald-300"
              : "bg-[#18181F] border-rose-500/40 text-rose-300"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span className="text-sm font-medium">{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-black/[0.08] dark:border-[#262630] bg-[#F7F6F3] dark:bg-[#14141B] px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#191919] dark:bg-[#A78BFA]/15 text-white dark:text-[#A78BFA] flex items-center justify-center shadow-xs shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
                Content Calendar
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.06] dark:bg-white/[0.06] text-[#191919] dark:text-white border border-black/[0.08] dark:border-white/[0.1] font-bold">
                  v2.0 Schedule
                </span>
              </h1>
              <p className="text-xs text-[#6B6A65] dark:text-[#8A8797] mt-0.5">
                Visual publishing schedule, multi-platform staging & cross-team pipeline tracking
              </p>
            </div>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#E3E2DE] dark:border-white/[0.08] text-xs shadow-2xs">
            <span className="text-[#6B6A65] dark:text-[#8A8797]">Total Posts:</span>
            <span className="font-semibold text-[#191919] dark:text-white">{totalDeliverablesCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#E3E2DE] dark:border-white/[0.08] text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[#6B6A65] dark:text-[#8A8797]">Scheduled:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{scheduledCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#E3E2DE] dark:border-white/[0.08] text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-[#6B6A65] dark:text-[#8A8797]">In Prod:</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{inProductionCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-[#E3E2DE] dark:border-white/[0.08] text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#2383E2] dark:bg-purple-400"></span>
            <span className="text-[#6B6A65] dark:text-[#8A8797]">Review:</span>
            <span className="font-semibold text-[#2383E2] dark:text-purple-400">{reviewCount}</span>
          </div>

          <Link
            href="/campaigns"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2383E2] hover:bg-[#1D6FBF] dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] text-white dark:text-[#101014] text-xs font-semibold shadow-2xs transition-all ml-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Sprint</span>
          </Link>
        </div>
      </header>

      {/* Control and Filter Bar */}
      <div className="border-b border-black/[0.08] dark:border-[#262630] bg-[#F7F6F3] dark:bg-[#121218] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Date Navigator & View Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg p-0.5">
            <button
              onClick={handlePrev}
              title="Previous"
              className="p-1.5 hover:bg-black/[0.04] dark:hover:bg-[#252535] rounded text-[#6B6A65] hover:text-[#191919] dark:text-[#A3A0B0] dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium text-[#37352F] hover:bg-black/[0.04] dark:text-[#D4D4D8] dark:hover:bg-[#252535] rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              title="Next"
              className="p-1.5 hover:bg-black/[0.04] dark:hover:bg-[#252535] rounded text-[#6B6A65] hover:text-[#191919] dark:text-[#A3A0B0] dark:hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Period Label */}
          <div className="text-base font-semibold text-[#191919] dark:text-white tracking-tight flex items-center gap-2 min-w-[170px]">
            {viewMode === "month" ? (
              currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
            ) : (
              <span>
                {weekDays[0].dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
                {weekDays[6].dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-[#EFEFED] dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors font-medium ${
                viewMode === "month"
                  ? "bg-white dark:bg-purple-600/30 text-[#191919] dark:text-purple-300 border border-black/[0.1] dark:border-purple-500/30 shadow-xs"
                  : "text-[#6B6A65] dark:text-[#8A8797] hover:text-[#191919] dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors font-medium ${
                viewMode === "week"
                  ? "bg-white dark:bg-purple-600/30 text-[#191919] dark:text-purple-300 border border-black/[0.1] dark:border-purple-500/30 shadow-xs"
                  : "text-[#6B6A65] dark:text-[#8A8797] hover:text-[#191919] dark:hover:text-white"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Week
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedCampaignId("all");
              }}
              className="h-8 bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg px-2.5 pr-7 text-xs text-[#191919] dark:text-[#E4E4E7] focus:outline-none focus:border-[#2383E2] dark:focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B6A65] dark:text-[#8A8797] absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {/* Campaign Filter (if client selected) */}
          {selectedClientId !== "all" && campaigns.length > 0 && (
            <div className="relative">
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="h-8 bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg px-2.5 pr-7 text-xs text-[#191919] dark:text-[#E4E4E7] focus:outline-none focus:border-[#2383E2] dark:focus:border-purple-500 appearance-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B6A65] dark:text-[#8A8797] absolute right-2 top-2.5 pointer-events-none" />
            </div>
          )}

          {/* Platform Filter Pills */}
          <div className="flex items-center gap-1 bg-[#EFEFED] dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg p-0.5 text-xs">
            {["all", "instagram", "facebook", "linkedin"].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-2.5 py-1 rounded capitalize transition-colors font-medium flex items-center gap-1 ${
                  selectedPlatform === p
                    ? "bg-white dark:bg-purple-600/30 text-[#191919] dark:text-purple-300 border border-black/[0.1] dark:border-purple-500/30 shadow-xs"
                    : "text-[#6B6A65] dark:text-[#8A8797] hover:text-[#191919] dark:hover:text-white"
                }`}
              >
                {p !== "all" && <PlatformIcon platform={p} className="w-3 h-3" />}
                {p}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B6A65] dark:text-[#8A8797] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-40 bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2C2C3C] rounded-lg pl-8 pr-2.5 text-xs text-[#191919] dark:text-white placeholder:text-[#9B9A97] dark:placeholder-[#8A8797] focus:outline-none focus:border-[#2383E2] dark:focus:border-purple-500"
            />
          </div>

          {/* Unscheduled Tray Button */}
          <button
            onClick={() => setShowUnscheduledDrawer(!showUnscheduledDrawer)}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showUnscheduledDrawer || unscheduledList.length > 0
                ? "bg-white dark:bg-[#1C1C26] border-black/[0.15] dark:border-purple-500/40 text-[#191919] dark:text-purple-300 shadow-xs"
                : "bg-white dark:bg-[#181822] border-black/[0.08] dark:border-[#2C2C3C] text-[#6B6A65] dark:text-[#8A8797] hover:text-[#191919] dark:hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Unscheduled ({unscheduledList.length})</span>
          </button>
        </div>
      </div>

      {/* Main Grid & Body */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#8A8797]">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span className="text-sm font-medium">Synchronizing agency calendar schedule...</span>
          </div>
        ) : viewMode === "month" ? (
          /* ============================================================== */
          /*                       MONTH VIEW GRID                          */
          /* ============================================================== */
          <div className="flex-1 flex flex-col bg-white dark:bg-[#14141B] border border-black/[0.08] dark:border-[#262630] rounded-xl overflow-hidden shadow-xs">
            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 border-b border-black/[0.08] dark:border-[#262630] bg-[#F7F6F3] dark:bg-[#181822] text-xs font-semibold text-[#6B6A65] dark:text-[#8A8797]">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                <div key={dayName} className="py-2.5 px-3 text-center border-r border-black/[0.08] dark:border-[#262630] last:border-r-0">
                  {dayName}
                </div>
              ))}
            </div>

            {/* 7-column calendar day grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-black/[0.08] dark:divide-[#262630] bg-[#F7F6F3] dark:bg-[#101014]">
              {monthDays.map((day) => {
                const dayDeliverables = scheduledMap.get(day.dateStr) || [];
                const isDragTarget = dragOverDayStr === day.dateStr;

                return (
                  <div
                    key={day.dateStr}
                    onDragOver={(e) => handleDragOver(e, day.dateStr)}
                    onDragLeave={(e) => handleDragLeave(e, day.dateStr)}
                    onDrop={(e) => handleDrop(e, day.dateStr)}
                    className={`min-h-[110px] p-2 flex flex-col transition-colors relative group ${
                      day.isCurrentMonth ? "bg-white dark:bg-[#121217]" : "bg-[#F7F6F3]/80 dark:bg-[#0D0D11]/60 text-zinc-400 dark:text-zinc-600"
                    } ${isDragTarget ? "bg-[#2383E2]/10 ring-2 ring-[#2383E2] dark:bg-purple-900/25 dark:ring-purple-500/80 ring-inset" : ""}`}
                  >
                    {/* Day number header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          day.isToday
                            ? "bg-[#191919] text-white font-bold shadow-xs dark:bg-purple-600 dark:shadow-purple-900/50"
                            : day.isCurrentMonth
                            ? "text-[#37352F] dark:text-[#D4D4D8]"
                            : "text-[#9B9A97] dark:text-[#52525B]"
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {dayDeliverables.length > 0 && (
                        <span className="text-[10px] font-medium text-[#6B6A65] dark:text-[#71717A] px-1.5 rounded bg-[#EFEFED] dark:bg-[#1C1C26]">
                          {dayDeliverables.length} {dayDeliverables.length === 1 ? "post" : "posts"}
                        </span>
                      )}
                    </div>

                    {/* Deliverable Cards Stack */}
                    <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[130px] pr-0.5 scrollbar-thin">
                      {dayDeliverables.map((deliv) => {
                        const statusStyle = getStatusBadge(deliv.status);
                        const platformClass = getPlatformBadge(deliv.platform);

                        return (
                          <div
                            key={deliv.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, deliv.id)}
                            onClick={() => setActiveDeliverableId(deliv.id)}
                            className={`p-2 rounded-lg bg-[#F7F6F3] dark:bg-[#181822] border border-black/[0.08] dark:border-[#2B2B3B] hover:border-black/[0.2] dark:hover:border-purple-500/60 transition-all cursor-pointer shadow-2xs hover:shadow-xs group/card relative select-none ${
                              draggedDeliverableId === deliv.id ? "opacity-40 scale-95" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${platformClass}`}
                              >
                                <PlatformIcon platform={deliv.platform} className="w-2.5 h-2.5" />
                                <span className="capitalize">{deliv.deliverable_type || deliv.platform}</span>
                              </span>

                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} title={statusStyle.label} />
                                {deliv.scheduled_at && (
                                  <span className="text-[10px] text-[#6B6A65] dark:text-[#A1A1AA] flex items-center gap-0.5 font-mono">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatTime(deliv.scheduled_at)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-xs font-medium text-[#191919] dark:text-white line-clamp-1 group-hover/card:text-[#2383E2] dark:group-hover/card:text-purple-300 transition-colors">
                              {deliv.title}
                            </p>

                            <div className="flex items-center justify-between mt-1 text-[10px] text-[#6B6A65] dark:text-[#8A8797]">
                              <span className="truncate max-w-[90px]">{deliv.client_name || "Client"}</span>
                              {deliv.tasks_count > 0 && (
                                <span
                                  className={`flex items-center gap-0.5 ${
                                    deliv.tasks_completed_count === deliv.tasks_count ? "text-emerald-600 dark:text-emerald-400" : "text-[#6B6A65] dark:text-[#8A8797]"
                                  }`}
                                >
                                  <CheckSquare className="w-2.5 h-2.5" />
                                  {deliv.tasks_completed_count}/{deliv.tasks_count}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /*                        WEEK VIEW GRID                          */
          /* ============================================================== */
          <div className="flex-1 flex flex-col bg-white dark:bg-[#14141B] border border-black/[0.08] dark:border-[#262630] rounded-xl overflow-hidden shadow-xs">
            {/* Week Columns Header */}
            <div className="grid grid-cols-7 border-b border-black/[0.08] dark:border-[#262630] bg-[#F7F6F3] dark:bg-[#181822]">
              {weekDays.map((w) => (
                <div
                  key={w.dateStr}
                  className={`py-3 px-3 text-center border-r border-black/[0.08] dark:border-[#262630] last:border-r-0 flex flex-col items-center gap-1 ${
                    w.isToday ? "bg-[#EFEFED] dark:bg-purple-950/20" : ""
                  }`}
                >
                  <span className="text-xs font-semibold text-[#6B6A65] dark:text-[#8A8797] uppercase tracking-wider">{w.dayName}</span>
                  <span
                    className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                      w.isToday ? "bg-[#191919] text-white shadow-xs dark:bg-purple-600 dark:shadow-purple-900/50" : "text-[#191919] dark:text-white"
                    }`}
                  >
                    {w.dayNumber}
                  </span>
                </div>
              ))}
            </div>

            {/* Week Columns Day Feed */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-black/[0.08] dark:divide-[#262630] bg-[#F7F6F3] dark:bg-[#101014] overflow-y-auto">
              {weekDays.map((w) => {
                const dayDeliverables = scheduledMap.get(w.dateStr) || [];
                const isDragTarget = dragOverDayStr === w.dateStr;

                return (
                  <div
                    key={w.dateStr}
                    onDragOver={(e) => handleDragOver(e, w.dateStr)}
                    onDragLeave={(e) => handleDragLeave(e, w.dateStr)}
                    onDrop={(e) => handleDrop(e, w.dateStr)}
                    className={`p-3 flex flex-col gap-2.5 transition-colors ${
                      w.isToday ? "bg-white dark:bg-purple-950/10" : "bg-white dark:bg-[#121217]"
                    } ${isDragTarget ? "bg-[#2383E2]/10 ring-2 ring-[#2383E2] dark:bg-purple-900/25 dark:ring-purple-500/80 ring-inset" : ""}`}
                  >
                    {dayDeliverables.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-black/[0.1] dark:border-[#262632] rounded-xl p-4 text-center text-[#9B9A97] dark:text-[#52525B]">
                        <CalendarIcon className="w-5 h-5 mb-1.5 opacity-40" />
                        <span className="text-xs">No posts scheduled</span>
                        <span className="text-[10px] mt-0.5 text-[#9B9A97] dark:text-[#3F3F46]">Drag a post here</span>
                      </div>
                    ) : (
                      dayDeliverables.map((deliv) => {
                        const statusStyle = getStatusBadge(deliv.status);
                        const platformClass = getPlatformBadge(deliv.platform);

                        return (
                          <div
                            key={deliv.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, deliv.id)}
                            onClick={() => setActiveDeliverableId(deliv.id)}
                            className={`p-3.5 rounded-xl bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2B2B3B] hover:border-black/[0.2] dark:hover:border-purple-500/60 transition-all cursor-pointer shadow-xs hover:shadow-sm flex flex-col gap-2 group/weekcard ${
                              draggedDeliverableId === deliv.id ? "opacity-40 scale-95" : ""
                            }`}
                          >
                            {/* Platform badge & status */}
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${platformClass}`}
                              >
                                <PlatformIcon platform={deliv.platform} className="w-3 h-3" />
                                <span className="capitalize">{deliv.deliverable_type || deliv.platform}</span>
                              </span>

                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusStyle.color}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                {statusStyle.label}
                              </span>
                            </div>

                            {/* Title & Campaign info */}
                            <div>
                              <h4 className="text-xs font-semibold text-[#191919] dark:text-white group-hover/weekcard:text-[#2383E2] dark:group-hover/weekcard:text-purple-300 transition-colors line-clamp-2">
                                {deliv.title}
                              </h4>
                              <p className="text-[11px] text-[#6B6A65] dark:text-[#8A8797] mt-0.5 truncate">
                                {deliv.client_name} {deliv.campaign_title ? `• ${deliv.campaign_title}` : ""}
                              </p>
                            </div>

                            {/* Caption preview snippet */}
                            {deliv.latest_caption && (
                              <p className="text-[11px] text-[#6B6A65] dark:text-[#A1A1AA] line-clamp-2 bg-[#F7F6F3] dark:bg-[#121218] p-2 rounded-lg border border-black/[0.08] dark:border-[#22222E] italic">
                                "{deliv.latest_caption}"
                              </p>
                            )}

                            {/* Footer: tasks progress & scheduled time */}
                            <div className="flex items-center justify-between text-[11px] text-[#6B6A65] dark:text-[#8A8797] pt-1.5 border-t border-black/[0.08] dark:border-[#22222E]">
                              {deliv.tasks_count > 0 ? (
                                <span
                                  className={`flex items-center gap-1 ${
                                    deliv.tasks_completed_count === deliv.tasks_count ? "text-emerald-600 dark:text-emerald-400" : "text-[#6B6A65] dark:text-[#8A8797]"
                                  }`}
                                >
                                  <CheckSquare className="w-3 h-3" />
                                  {deliv.tasks_completed_count}/{deliv.tasks_count} tasks
                                </span>
                              ) : (
                                <span className="text-[#9B9A97] dark:text-[#52525B]">No tasks</span>
                              )}

                              {deliv.scheduled_at && (
                                <span className="flex items-center gap-1 text-[#6B6A65] dark:text-purple-300 font-mono">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(deliv.scheduled_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Unscheduled Deliverables Tray */}
        {showUnscheduledDrawer && (
          <div className="mt-4 p-4 bg-[#14141B] border border-purple-500/30 rounded-xl shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-[#262632] pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Unscheduled Deliverables ({unscheduledList.length})
                </h3>
                <span className="text-xs text-[#8A8797]">
                  Drag any post into a calendar day slot to immediately schedule it.
                </span>
              </div>
              <button
                onClick={() => setShowUnscheduledDrawer(false)}
                className="text-[#8A8797] hover:text-white p-1 hover:bg-[#20202B] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {unscheduledList.length === 0 ? (
              <p className="text-xs text-[#8A8797] italic py-2">
                All posts for the current selection have planned dates assigned!
              </p>
            ) : (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {unscheduledList.map((deliv) => {
                  const statusStyle = getStatusBadge(deliv.status);
                  const platformClass = getPlatformBadge(deliv.platform);

                  return (
                    <div
                      key={deliv.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deliv.id)}
                      onClick={() => setActiveDeliverableId(deliv.id)}
                      className="min-w-[220px] max-w-[260px] p-3 rounded-xl bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-[#2B2B3B] hover:border-black/[0.2] dark:hover:border-purple-500/60 cursor-grab active:cursor-grabbing transition-all flex flex-col gap-1.5 shadow-2xs group select-none"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${platformClass}`}
                        >
                          <PlatformIcon platform={deliv.platform} className="w-2.5 h-2.5" />
                          <span className="capitalize">{deliv.deliverable_type || deliv.platform}</span>
                        </span>
                        <GripVertical className="w-3.5 h-3.5 text-[#9B9A97] dark:text-[#52525B] group-hover:text-[#191919] dark:group-hover:text-purple-400" />
                      </div>
                      <p className="text-xs font-semibold text-[#191919] dark:text-white line-clamp-1 group-hover:text-[#2383E2] dark:group-hover:text-purple-300">
                        {deliv.title}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[#6B6A65] dark:text-[#8A8797]">
                        <span className="truncate">{deliv.client_name || "Client"}</span>
                        <span className={`px-1.5 py-0.5 rounded ${statusStyle.color}`}>{statusStyle.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/*         SOCIAL POST PREVIEW & OPERATIONAL INSPECTOR MODAL       */}
      {/* ============================================================== */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#14141B] border border-[#2E2E3E] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Top Bar */}
            <div className="px-6 py-4 border-b border-[#262630] flex items-center justify-between bg-[#181822]">
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-lg border ${getPlatformBadge(activeDetail.platform)}`}>
                  <PlatformIcon platform={activeDetail.platform} className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    {activeDetail.title}
                  </h3>
                  <p className="text-xs text-[#8A8797]">
                    {activeDetail.client_name || "Client"} • {activeDetail.campaign_title || "Campaign"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/deliverables/${activeDetail.id}`}
                  className="px-3 py-1.5 rounded-lg bg-[#22222E] hover:bg-[#2C2C3C] text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Deliverable Studio</span>
                </Link>
                <button
                  onClick={() => setActiveDeliverableId(null)}
                  className="p-1.5 rounded-lg text-[#8A8797] hover:text-white hover:bg-[#22222E] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Phone Mockup (Left) + Operational Inspector (Right) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
              {/* Left Column: Social Device Mockup (5 cols) */}
              <div className="md:col-span-5 bg-[#0D0D12] p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#262630]">
                {/* Smartphone Device Frame */}
                <div className="w-[280px] rounded-[36px] border-4 border-[#2C2C3C] bg-[#09090C] overflow-hidden shadow-2xl flex flex-col">
                  {/* Dynamic Island / Notch */}
                  <div className="h-6 bg-[#09090C] flex items-center justify-center relative">
                    <div className="w-20 h-3.5 bg-black rounded-full border border-[#22222E]"></div>
                  </div>

                  {/* Social Post Header */}
                  <div className="px-3.5 py-2 flex items-center justify-between border-b border-[#1C1C24]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow">
                        {(activeDetail.client_name || "A").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-white leading-tight">
                          {(activeDetail.client_name || "client").toLowerCase().replace(/\s+/g, "_")}
                        </p>
                        <p className="text-[9px] text-[#71717A] capitalize">{activeDetail.platform} Original</p>
                      </div>
                    </div>
                    <PlatformIcon platform={activeDetail.platform} className="w-3.5 h-3.5 text-[#A1A1AA]" />
                  </div>

                  {/* Media Viewport */}
                  <div className="w-full aspect-[9/12] bg-[#121218] flex items-center justify-center relative overflow-hidden group">
                    {activeDetail.latest_asset_url ? (
                      activeDetail.latest_file_type && activeDetail.latest_file_type.startsWith("video/") ? (
                        <video
                          src={`${API_BASE}${activeDetail.latest_asset_url}`}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={`${API_BASE}${activeDetail.latest_asset_url}`}
                          alt={activeDetail.title}
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-6 text-[#52525B]">
                        <div className="w-12 h-12 rounded-2xl bg-[#1C1C26] flex items-center justify-center mb-2 text-purple-400">
                          {activeDetail.deliverable_type === "reel" ? (
                            <Film className="w-6 h-6" />
                          ) : (
                            <Layers className="w-6 h-6" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-[#A1A1AA]">Asset in Production</span>
                        <span className="text-[10px] text-[#71717A] mt-1 capitalize">
                          Format: {activeDetail.deliverable_type}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Social Action Bar */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between border-t border-[#1C1C24] text-[#D4D4D8]">
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4 hover:text-rose-500 cursor-pointer transition-colors" />
                      <MessageSquare className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                      <Share2 className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                    </div>
                    <Bookmark className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                  </div>

                  {/* Social Caption Snippet */}
                  <div className="px-3.5 pb-3 text-[10px] text-[#A1A1AA] line-clamp-3">
                    <span className="font-semibold text-white mr-1.5">
                      {(activeDetail.client_name || "client").toLowerCase().replace(/\s+/g, "_")}
                    </span>
                    {activeDetail.latest_caption || "Directorial hook and social copy will be generated here."}
                  </div>
                </div>
              </div>

              {/* Right Column: Operational Controls & Tasks (7 cols) */}
              <div className="md:col-span-7 p-6 flex flex-col gap-5 bg-[#14141B]">
                {/* Reschedule & Status Controls */}
                <div className="bg-[#181822] border border-[#262632] rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-purple-400" />
                    Publishing Schedule & Workflow Stage
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#8A8797] font-medium block mb-1">Planned Date</label>
                      <input
                        type="date"
                        value={editPlannedDate}
                        onChange={(e) => setEditPlannedDate(e.target.value)}
                        className="w-full h-8 bg-[#121218] border border-[#2B2B3B] rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-[#8A8797] font-medium block mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full h-8 bg-[#121218] border border-[#2B2B3B] rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="not_started">Draft / Not Started</option>
                        <option value="in_production">In Production</option>
                        <option value="internal_review">Internal Review</option>
                        <option value="client_review">Client Review</option>
                        <option value="changes_requested">Changes Requested</option>
                        <option value="approved">Approved</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSaveModalChanges}
                      disabled={savingModalChanges}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      {savingModalChanges ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save Updates
                    </button>
                  </div>
                </div>

                {/* Caption Inspector & Copy */}
                <div className="bg-[#181822] border border-[#262632] rounded-xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <FileVideo className="w-3.5 h-3.5 text-purple-400" />
                      Social Caption & Hashtags
                    </h4>
                    {activeDetail.latest_caption && (
                      <button
                        onClick={() => handleCopyCaption(activeDetail.latest_caption || "")}
                        className="text-[11px] font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        {copiedCaption ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedCaption ? "Copied!" : "Copy Caption"}
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#121218] border border-[#242430] text-xs text-[#D4D4D8] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {activeDetail.latest_caption ? (
                      activeDetail.latest_caption.split(" ").map((word, idx) =>
                        word.startsWith("#") ? (
                          <span key={idx} className="text-purple-400 font-medium">
                            {word}{" "}
                          </span>
                        ) : (
                          word + " "
                        )
                      )
                    ) : (
                      <span className="text-[#52525B] italic">
                        No caption has been generated or uploaded for this deliverable yet.
                      </span>
                    )}
                  </div>
                </div>

                {/* Pipeline Tasks Checklist */}
                <div className="bg-[#181822] border border-[#262632] rounded-xl p-4 flex flex-col gap-2.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                      Pipeline Tasks & Deadlines (
                      {activeDetail.tasks_completed_count || 0}/{activeDetail.tasks_count || 0})
                    </h4>
                    <Link
                      href="/tasks"
                      className="text-[11px] text-[#8A8797] hover:text-purple-300 flex items-center gap-1"
                    >
                      <span>Task Board</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {loadingDetail ? (
                    <div className="py-4 flex items-center justify-center text-xs text-[#8A8797] gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Loading linked pipeline tasks...
                    </div>
                  ) : activeDetail.tasks && activeDetail.tasks.length > 0 ? (
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {activeDetail.tasks.map((task) => {
                        const isDone = task.status === "approved" || task.status === "done";
                        return (
                          <div
                            key={task.id}
                            className="p-2 rounded-lg bg-[#121218] border border-[#242430] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                              )}
                              <span className={isDone ? "text-[#71717A] line-through" : "text-white font-medium"}>
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#8A8797] capitalize px-1.5 py-0.5 rounded bg-[#1C1C26]">
                                {task.task_type || "task"}
                              </span>
                              {task.due_date && (
                                <span className="text-[10px] font-mono text-[#A1A1AA]">
                                  {formatCleanDate(task.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-[#121218] border border-[#242430] text-xs text-[#71717A] italic text-center">
                      No discrete sub-tasks linked yet. Tasks can be generated via Campaign Studio.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#101014] flex items-center justify-center text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}
