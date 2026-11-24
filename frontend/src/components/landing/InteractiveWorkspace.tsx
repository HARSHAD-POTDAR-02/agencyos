"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Brain,
  CheckSquare,
  FileCheck2,
  Sparkles,
  Layers,
  CalendarDays,
  MessagesSquare,
  BarChart3,
  UserCheck,
  CreditCard,
  Settings,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  Copy,
  ChevronsUpDown,
  PanelLeftClose,
  Command,
  Search,
  Calendar,
  Bell,
  Activity,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Cpu,
  Layers2,
  ArrowRight,
  ChevronRight,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Send,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { TeleprompterPreview, TeleprompterClientKey } from "./TeleprompterPreview";

export type WorkspaceRoute =
  | "dashboard"
  | "workspace"
  | "clients"
  | "cortex"
  | "tasks"
  | "approvals"
  | "studio"
  | "plans"
  | "calendar"
  | "inbox"
  | "reports"
  | "team"
  | "billing"
  | "settings";

export type ClientKey = TeleprompterClientKey;

interface InteractiveWorkspaceProps {
  externalRoute?: WorkspaceRoute;
  externalClient?: ClientKey;
  onTriggerCommandPalette?: () => void;
}

const ROUTE_TITLES: Record<WorkspaceRoute, string> = {
  dashboard: "Dashboard",
  workspace: "Workspace",
  clients: "Clients",
  cortex: "Cortex Memory",
  tasks: "Tasks",
  approvals: "Approvals",
  studio: "Campaign Studio",
  plans: "Campaign Plans",
  calendar: "Content Calendar",
  inbox: "Community Inbox",
  reports: "Analytics",
  team: "Team",
  billing: "Billing & Credits",
  settings: "Settings",
};

const NAV_GROUPS: {
  group: string;
  items: { id: WorkspaceRoute; name: string }[];
}[] = [
  {
    group: "WORKSPACE",
    items: [
      { id: "dashboard", name: "Dashboard" },
      { id: "workspace", name: "My Workspace" },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      { id: "clients", name: "Clients" },
      { id: "cortex", name: "Cortex Memory" },
      { id: "tasks", name: "Tasks" },
      { id: "approvals", name: "Approvals" },
    ],
  },
  {
    group: "CAMPAIGN PIPELINE",
    items: [
      { id: "studio", name: "Campaign Studio" },
      { id: "plans", name: "Campaign Plans" },
      { id: "calendar", name: "Content Calendar" },
    ],
  },
  {
    group: "ENGAGEMENT & ROI",
    items: [
      { id: "inbox", name: "Community Inbox" },
      { id: "reports", name: "Reports & ROI" },
    ],
  },
  {
    group: "ADMIN",
    items: [
      { id: "team", name: "Team" },
      { id: "billing", name: "Billing & Credits" },
      { id: "settings", name: "Settings" },
    ],
  },
];

export function InteractiveWorkspace({
  externalRoute,
  externalClient,
  onTriggerCommandPalette,
}: InteractiveWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [4, 0]);

  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("dashboard");
  const [selectedClient, setSelectedClient] = useState<ClientKey>("solis");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Dashboard interactive filter
  const [dashTaskFilter, setDashTaskFilter] = useState<"all" | "review" | "in_progress" | "done">("all");

  // Cortex interactive state (mirrors cortex/page.tsx tabs + view mode)
  const [cortexTab, setCortexTab] = useState<"queue" | "vault" | "ingest" | "ask">("vault");
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");
  const [cortexQueueCount, setCortexQueueCount] = useState<number>(3);

  // Studio interactive state (mirrors campaigns/page.tsx + ContextualCanvas)
  const [studioTab, setStudioTab] = useState<"carousel" | "storyboard" | "compliance">("carousel");
  const [pinnedEntities, setPinnedEntities] = useState<string[]>([
    "Winter Truffle Gnocchi",
    "Chef Table (30 Guests)",
  ]);

  // Approvals interactive filter (mirrors approvals/page.tsx filter toolstrip)
  const [approvalFilter, setApprovalFilter] = useState<"all" | "client_review" | "approved" | "published">("all");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");
  const [copiedLink, setCopiedLink] = useState(false);

  // Engagement interactive state (mirrors engagement/page.tsx)
  const [engagementStream, setEngagementStream] = useState<"comments" | "dms">("comments");
  const [replyPublished, setReplyPublished] = useState(false);

  // Workspace checklist
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>({
    c1: true,
    c2: false,
    c3: false,
  });

  // Preview dark/light chrome toggle matching real Header.tsx sun/moon switcher (zero purple)
  const [appDarkChrome, setAppDarkChrome] = useState(false);

  useEffect(() => {
    if (externalRoute) setActiveRoute(externalRoute);
  }, [externalRoute]);

  useEffect(() => {
    if (externalClient) {
      setSelectedClient(externalClient);
      if (externalClient === "solis") {
        setPinnedEntities(["Winter Truffle Gnocchi", "Chef Table (30 Guests)"]);
      } else if (externalClient === "linden") {
        setPinnedEntities(["Cold-Pressed Squalane", "Recyclable Amber Glass"]);
      } else {
        setPinnedEntities(["1,900m Washed Micro-Lot", "48h Post-Roast Shipping"]);
      }
    }
  }, [externalClient]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("https://agencyos.app/review/rk_9482bf0e").catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const clientData = {
    solis: {
      initial: "O",
      name: "Osteria Solis",
      industry: "Wood-Fired Hospitality",
      activeAccounts: 8,
      activeTasks: 19,
      reviewQueue: 2,
      deliveredRatio: "28/32",
      deliveredPercent: 88,
      mrr: "$38,400/mo",
      engagementLift: "+44%",
      saveRate: "6.8%",
      hoursReclaimed: "18.5 hrs",
      campaignTitle: "Winter Truffle & Aperitivo Release",
      carouselTopic: "Handmade Burrata & Shaved Winter Truffle Gnocchi",
      pendingRule: "Never publish percentage discounts on signature hearth plates or seasonal tasting menus.",
      pendingDoc: "Extracted from Winter Tasting Menu Specification PDF (p. 4)",
      deliverable: "Winter Truffle Tasting Deliverable",
      image: "/landing/solis-truffle.jpg",
      swatches: ["#1C1917", "#9A6700", "#D6CFC2"],
      inboundComment: "Do you take private dining group bookings for 28 guests next Friday evening?",
      draftReply: "We would be delighted to host your party at Osteria Solis. Our private hearth dining room is open next Friday—our concierge just sent our seasonal group menu via direct message.",
      pipelineRows: [
        { title: "Winter Truffle 5-Slide Carousel", client: "Osteria Solis", assignee: "M. Kapoor", status: "review", priority: "high", due: "Today" },
        { title: "Hearth Chef Reel Teleprompter Cut", client: "Osteria Solis", assignee: "E. Vance", status: "in_progress", priority: "medium", due: "Tomorrow" },
        { title: "Aperitivo Cocktail Pour Copy", client: "Osteria Solis", assignee: "A. Nair", status: "done", priority: "medium", due: "Done" },
        { title: "Sunday Supper Cellar Newsletter", client: "Osteria Solis", assignee: "M. Kapoor", status: "review", priority: "high", due: "In 2d" },
      ],
      rules: [
        {
          id: "TABOO-01",
          type: "Negative Taboo (Hard Boundary)",
          title: "Never make unverified health or therapeutic claims about ingredients.",
          rationale: "Hospitality positioning centers on culinary craft and cellar heritage, never wellness cures.",
          provenance: "Brand Charter v2.4: Frame every seasonal harvest strictly around flavor, origin, and craft.",
        },
        {
          id: "RULE-04",
          type: "Brand Pricing Rule",
          title: "Never offer promotional discounts on signature wood-fired dishes.",
          rationale: "Markdown percentages undermine fine-dining positioning across private dining clientele.",
          provenance: "Owner Notes, Section 3.1: Strict prohibition on coupon codes or seasonal discount copy.",
        },
        {
          id: "RULE-02",
          type: "Visual Guideline",
          title: "Warm amber evening candlelight only; avoid clinical white flash.",
          rationale: "Preserves intimate evening dining room atmosphere across all Instagram carousels.",
          provenance: "Creative Director Brief: Keep shadows deep and copper warmth consistent across every crop.",
        },
      ],
      schedule: [
        { day: "Thu · Nov 26", net: "Instagram", title: "Truffle Hearth Teaser Reel", status: "Scheduled" },
        { day: "Fri · Nov 27", net: "Instagram", title: "Handmade Burrata Carousel", status: "Approved" },
        { day: "Sat · Nov 28", net: "LinkedIn", title: "Executive Chef Seasonal Essay", status: "Review" },
        { day: "Sun · Nov 29", net: "Facebook", title: "Sunday Supper Cellar Pairings", status: "In Production" },
      ],
    },
    linden: {
      initial: "L",
      name: "Linden & Clay",
      industry: "D2C Botanical Skincare",
      activeAccounts: 6,
      activeTasks: 14,
      reviewQueue: 1,
      deliveredRatio: "21/24",
      deliveredPercent: 87,
      mrr: "$26,200/mo",
      engagementLift: "+39%",
      saveRate: "8.2%",
      hoursReclaimed: "14.2 hrs",
      campaignTitle: "Cold-Pressed Botanical Serum Launch",
      carouselTopic: "Bio-Fermented Squalane & Wild Rosemary Facial Nectar",
      pendingRule: "Mandatory mention of 100% recyclable amber glass vessel on all product launch carousels.",
      pendingDoc: "Extracted from Linden Formulation & Packaging Guide v3.1 PDF (p. 2)",
      deliverable: "Botanical Elixir Batch 09 Deliverable",
      image: "/landing/linden-elixir.jpg",
      swatches: ["#2D4A3E", "#C8B8A2", "#F3F1EC"],
      inboundComment: "Is the wild rosemary nectar formulated cleanly for ultra-sensitive skin barriers?",
      draftReply: "Yes. Our bio-fermented squalane nectar is 100% plant-derived, essential-oil-free, and clinically patch-tested for reactive skin barriers. We always recommend testing on the inner wrist for 24 hours first.",
      pipelineRows: [
        { title: "Botanical Elixir Batch 09 Carousel", client: "Linden & Clay", assignee: "R. Verma", status: "review", priority: "high", due: "Today" },
        { title: "3-Drop Morning Ritual Teleprompter", client: "Linden & Clay", assignee: "E. Vance", status: "in_progress", priority: "high", due: "Tomorrow" },
        { title: "Recyclable Amber Glass Sustainability Slide", client: "Linden & Clay", assignee: "A. Nair", status: "done", priority: "medium", due: "Done" },
        { title: "Sensitive Skin FAQ Story Sequence", client: "Linden & Clay", assignee: "R. Verma", status: "in_progress", priority: "medium", due: "In 3d" },
      ],
      rules: [
        {
          id: "TABOO-02",
          type: "Negative Taboo (Hard Boundary)",
          title: "Never disparage clinical ingredients or publish fear-based chemical messaging.",
          rationale: "Linden & Clay educates with grounded formulation chemistry rather than fearmongering.",
          provenance: "Founder Manifesto: Speak clearly on botanical efficacy; never attack competing formulas.",
        },
        {
          id: "RULE-05",
          type: "Sustainability Mandate",
          title: "Recyclable amber glass packaging must be cited in every hero launch deliverable.",
          rationale: "Required across all primary campaign copy for annual environmental compliance audits.",
          provenance: "Packaging Guidelines 2026: Highlight UV-protective amber glass and refillable caps.",
        },
        {
          id: "RULE-06",
          type: "Visual Guideline",
          title: "Natural travertine, raw linen shadows, and warm directional morning sun.",
          rationale: "Maintains calm minimalist aesthetic across social feeds.",
          provenance: "Art Direction Spec: Leave generous linen margin around serif overlays.",
        },
      ],
      schedule: [
        { day: "Thu · Nov 26", net: "Instagram", title: "3-Drop Morning Ritual Reel", status: "Scheduled" },
        { day: "Fri · Nov 27", net: "Instagram", title: "Squalane Lipid Barrier Carousel", status: "Approved" },
        { day: "Sat · Nov 28", net: "LinkedIn", title: "Amber Glass Refill Engineering", status: "Review" },
        { day: "Sun · Nov 29", net: "Facebook", title: "Batch 09 Apothecary Restock", status: "In Production" },
      ],
    },
    cairn: {
      initial: "C",
      name: "Cairn Roasters",
      industry: "Specialty Micro-Lot Coffee",
      activeAccounts: 4,
      activeTasks: 11,
      reviewQueue: 1,
      deliveredRatio: "18/20",
      deliveredPercent: 90,
      mrr: "$17,800/mo",
      engagementLift: "+51%",
      saveRate: "7.4%",
      hoursReclaimed: "11.8 hrs",
      campaignTitle: "Anaerobic Washed Highland Release",
      carouselTopic: "1,900m Elevation Single-Origin Pour-Over Calibration",
      pendingRule: "Always display exact roast batch date; never promise generic 12-month pantry freshness.",
      pendingDoc: "Extracted from Cairn Roasting Standards Handbook PDF (p. 6)",
      deliverable: "Highland Harvest Micro-Lot Deliverable",
      image: "/landing/cairn-coffee.jpg",
      swatches: ["#3B2820", "#8C7A6B", "#FAF9F6"],
      inboundComment: "Do you offer a whole-bean bi-weekly cadence for commercial espresso bars?",
      draftReply: "We do. Cairn wholesale partners receive dialed-in single-origin drums roasted to order every Tuesday morning. Our roastery coordinator just sent wholesale minimums to your inbox.",
      pipelineRows: [
        { title: "1,900m Cooperative Origin Carousel", client: "Cairn Roasters", assignee: "M. Kapoor", status: "review", priority: "high", due: "Today" },
        { title: "93C Pour-Over Bloom Audio Reel", client: "Cairn Roasters", assignee: "E. Vance", status: "done", priority: "medium", due: "Done" },
        { title: "Direct-Trade Farm Margin Report", client: "Cairn Roasters", assignee: "A. Nair", status: "in_progress", priority: "medium", due: "In 2d" },
        { title: "Tuesday Roast Window Reminder", client: "Cairn Roasters", assignee: "M. Kapoor", status: "done", priority: "low", due: "Done" },
      ],
      rules: [
        {
          id: "TABOO-03",
          type: "Negative Taboo (Hard Boundary)",
          title: "Never exaggerate tasting notes with artificial flavoring terminology.",
          rationale: "Specialty buyers expect honest sensory transparency tied strictly to origin and fermentation.",
          provenance: "Roaster Quality Charter: Describe bergamot and cacao strictly as washed harvest traits.",
        },
        {
          id: "RULE-03",
          type: "Roast Transparency Rule",
          title: "Stamp exact roast date on every subscription bag and video slate.",
          rationale: "Freshness guarantees rest on verifiable roast batch timestamps, never vague adjectives.",
          provenance: "Operations Manual, Section 2: Ship all subscriptions within 48 hours of resting.",
        },
        {
          id: "RULE-07",
          type: "Visual Guideline",
          title: "Raw walnut countertops, matte stoneware cups, and crisp morning window glare.",
          rationale: "Builds tactile continuity across brewing guides and retail packaging.",
          provenance: "Visual Spec: Keep natural grain visible without artificial color saturation.",
        },
      ],
      schedule: [
        { day: "Thu · Nov 26", net: "Instagram", title: "93C Bloom Extraction Reel", status: "Scheduled" },
        { day: "Fri · Nov 27", net: "Instagram", title: "1,900m Cooperative Carousel", status: "Approved" },
        { day: "Sat · Nov 28", net: "LinkedIn", title: "Direct-Trade Farm Report", status: "Review" },
        { day: "Sun · Nov 29", net: "Facebook", title: "Tuesday Roast Pre-Order", status: "In Production" },
      ],
    },
  };

  const currentClient = clientData[selectedClient];

  const filteredDashboardRows = currentClient.pipelineRows.filter((row) => {
    if (dashTaskFilter === "all") return true;
    return row.status === dashTaskFilter;
  });

  const renderNavIcon = (id: WorkspaceRoute, isActive: boolean) => {
    const colorCls = isActive
      ? appDarkChrome
        ? "text-white"
        : "text-[#191919]"
      : appDarkChrome
      ? "text-[#A3A0B0]"
      : "text-[#6B6A65]";
    const cls = `w-3.5 h-3.5 shrink-0 transition-colors ${colorCls}`;
    switch (id) {
      case "dashboard":
        return <LayoutDashboard className={cls} />;
      case "workspace":
        return <Briefcase className={cls} />;
      case "clients":
        return <Users className={cls} />;
      case "cortex":
        return <Brain className={cls} />;
      case "tasks":
        return <CheckSquare className={cls} />;
      case "approvals":
        return <FileCheck2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? colorCls : "text-[#9A6700]"}`} />;
      case "studio":
        return <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isActive ? colorCls : "text-[#9A6700]"}`} />;
      case "plans":
        return <Layers className={cls} />;
      case "calendar":
        return <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isActive ? colorCls : "text-[#0F7B6C]"}`} />;
      case "inbox":
        return <MessagesSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? colorCls : "text-[#0F7B6C]"}`} />;
      case "reports":
        return <BarChart3 className={cls} />;
      case "team":
        return <UserCheck className={cls} />;
      case "billing":
        return <CreditCard className={cls} />;
      case "settings":
        return <Settings className={cls} />;
    }
  };

  // Explicit surface classes mirroring real Sidebar/Header/AgencyLayout Light & Obsidian modes (zero purple)
  const shellBg = appDarkChrome ? "bg-[#101014] text-[#F2F0F7] border-[#262630]" : "bg-[#FFFFFF] text-[#37352F] border-[rgba(55,53,47,0.14)]";
  const sidebarBg = appDarkChrome ? "bg-[#17171E] border-[#262630] text-[#A3A0B0]" : "bg-[#F7F6F3] border-[rgba(55,53,47,0.1)] text-[#6B6A65]";
  const headerBg = appDarkChrome ? "bg-[#17171E] border-[#262630]" : "bg-[#F7F6F3] border-[rgba(55,53,47,0.1)]";
  const cardBg = appDarkChrome ? "bg-[#17171E] border-white/[0.08]" : "bg-[#FFFFFF] border-[rgba(55,53,47,0.09)] shadow-[0_1px_2px_rgba(15,15,15,0.04)]";
  const recessedBg = appDarkChrome ? "bg-[#121217] border-white/[0.08]" : "bg-[#F7F6F3] border-[rgba(55,53,47,0.09)]";
  const inputBg = appDarkChrome ? "bg-[#20202A] border-white/[0.08] text-[#F2F0F7]" : "bg-[#EFEFED] border-[rgba(55,53,47,0.08)] text-[#37352F]";
  const headingTxt = appDarkChrome ? "text-[#F2F0F7]" : "text-[#191919]";
  const mutedTxt = appDarkChrome ? "text-[#A3A0B0]" : "text-[#6B6A65]";
  const hairline = appDarkChrome ? "border-white/[0.08]" : "border-[rgba(55,53,47,0.09)]";

  return (
    <div ref={containerRef} className="w-full">
      {/* Main App Window Frame Mirroring Real AgencyLayout (Sidebar + Top Header + Canvas) */}
      <motion.div
        style={{ rotateX, transformPerspective: 1200 }}
        className={`rounded-2xl border shadow-[0_24px_60px_-15px_rgba(17,17,20,0.14)] overflow-hidden flex flex-col md:flex-row min-h-[670px] transition-colors duration-200 ${shellBg}`}
      >
        {/* Mobile Client + Route Strip (< md) */}
        <div className={`md:hidden border-b ${sidebarBg}`}>
          <div className={`p-3 flex items-center justify-between border-b ${hairline}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                B
              </div>
              <div>
                <p className={`text-xs font-semibold ${headingTxt}`}>Brieva Studio</p>
                <p className={`text-[10px] font-mono ${mutedTxt}`}>Client: {currentClient.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedClient(key)}
                  className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer ${
                    selectedClient === key ? "bg-[#191919] text-white font-semibold" : "bg-white border border-[rgba(55,53,47,0.1)] text-[#6B6A65]"
                  }`}
                >
                  {clientData[key].initial}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 text-xs">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveRoute(item.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap text-[11px] font-medium cursor-pointer ${
                  activeRoute === item.id ? "bg-[#191919] text-white" : "bg-white border border-[rgba(55,53,47,0.1)] text-[#6B6A65]"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — EXACT MIRROR OF components/layout/Sidebar.tsx
           ═══════════════════════════════════════════════════════════════════════ */}
        <aside className={`hidden md:flex w-[238px] border-r flex-col shrink-0 select-none ${sidebarBg}`}>
          {/* Top Agency / Brand Context Header (h-14 matching Sidebar.tsx) */}
          <div className={`h-14 border-b px-3 flex items-center justify-between gap-2 relative ${hairline}`}>
            <button
              onClick={() => setClientDropdownOpen((p) => !p)}
              className={`flex items-center gap-2.5 min-w-0 flex-1 rounded-lg p-1 -m-1 text-left transition-colors cursor-pointer ${
                appDarkChrome ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.04]"
              }`}
              title="Switch Client Retainer Workspace"
            >
              <div className="w-7 h-7 rounded-lg bg-[#191919] text-white border border-black/10 flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                B
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-semibold text-xs tracking-tight truncate ${headingTxt}`}>
                    Brieva Studio
                  </span>
                  <ChevronsUpDown className="w-3 h-3 opacity-60 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span>{currentClient.name}</span>
                  <span className="opacity-40">&bull;</span>
                  <span className="text-[#0F7B6C] font-semibold">Online</span>
                </div>
              </div>
            </button>

            <PanelLeftClose className="w-3.5 h-3.5 opacity-60 shrink-0" />

            {/* Client Retainer Context Switcher Popover */}
            {clientDropdownOpen && (
              <div className={`absolute left-3 right-3 top-full mt-1 rounded-xl border shadow-xl p-1.5 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-100 ${cardBg}`}>
                <div className={`px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider ${mutedTxt}`}>
                  Active Client Retainer
                </div>
                {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => {
                  const item = clientData[key];
                  const isSelected = selectedClient === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedClient(key);
                        setClientDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? appDarkChrome
                            ? "bg-white/[0.08] text-white font-semibold"
                            : "bg-[#EFEFED] text-[#191919] font-semibold"
                          : `${mutedTxt} hover:bg-black/[0.04]`
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded bg-[#191919] text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                          {item.initial}
                        </span>
                        <div className="truncate">
                          <div className="truncate">{item.name}</div>
                          <div className="text-[9px] opacity-70 truncate">{item.industry}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5-Tier Grouped Navigation Links matching Sidebar.tsx */}
          <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto text-xs">
            {NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-0.5">
                <p className={`px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider opacity-65`}>
                  {grp.group}
                </p>
                {grp.items.map((item) => {
                  const isActive = activeRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveRoute(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all relative cursor-pointer ${
                        isActive
                          ? appDarkChrome
                            ? "bg-white/[0.08] text-[#F2F0F7] font-semibold"
                            : "bg-[#FFFFFF] text-[#191919] font-semibold shadow-[0_1px_2px_rgba(15,15,15,0.04)]"
                          : `${mutedTxt} ${appDarkChrome ? "hover:bg-white/[0.04] hover:text-white" : "hover:bg-black/[0.03] hover:text-[#191919]"}`
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="real-ui-sidebar-pill"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r ${
                            appDarkChrome ? "bg-[#0F7B6C]" : "bg-[#191919]"
                          }`}
                        />
                      )}
                      <span className="flex items-center gap-2 min-w-0">
                        {renderNavIcon(item.id, isActive)}
                        <span className="truncate">{item.name}</span>
                      </span>

                      {item.id === "cortex" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] border border-[#9A6700]/20 text-[9px] font-mono font-bold tabular-nums">
                          {cortexQueueCount}
                        </span>
                      )}
                      {item.id === "tasks" && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tabular-nums ${inputBg}`}>
                          {currentClient.activeTasks}
                        </span>
                      )}
                      {item.id === "approvals" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] border border-[#9A6700]/25 text-[9px] font-mono font-bold tabular-nums">
                          {currentClient.reviewQueue}
                        </span>
                      )}
                      {item.id === "studio" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] border border-[#9A6700]/25 text-[9px] font-mono font-bold">
                          AI
                        </span>
                      )}
                      {item.id === "inbox" && (
                        <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] border border-[#0F7B6C]/25 text-[9px] font-mono font-bold">
                          Live
                        </span>
                      )}
                      {item.id === "billing" && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono tabular-nums ${inputBg}`}>
                          38k / 50k
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom Command Menu Launcher & Profile Footer (Exact copy of Sidebar.tsx bottom) */}
          <div className={`px-2.5 py-2 border-t ${hairline}`}>
            <button
              onClick={() =>
                onTriggerCommandPalette
                  ? onTriggerCommandPalette()
                  : window.dispatchEvent(new CustomEvent("agencyos:open-command-palette"))
              }
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${cardBg}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Command className={`w-3.5 h-3.5 shrink-0 ${appDarkChrome ? "text-emerald-400" : "text-[#191919]"}`} />
                <span className={`font-medium truncate text-[11px] ${headingTxt}`}>Command Menu</span>
              </span>
              <kbd className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-semibold ${inputBg}`}>
                ⌘K
              </kbd>
            </button>
          </div>

          <div className={`border-t p-2.5 flex items-center justify-between gap-2 ${hairline}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#191919] text-white flex items-center justify-center font-semibold text-xs shrink-0 font-mono">
                H
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate leading-tight ${headingTxt}`}>Harshad Potdar</p>
                <p className={`text-[10px] font-mono truncate ${mutedTxt}`}>owner@brieva.studio</p>
              </div>
            </div>
            <LogOut className={`w-3.5 h-3.5 shrink-0 ${mutedTxt}`} />
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT MAIN PANE: TOP HEADER BAR + SCROLLABLE ACTIVE ROUTE
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Exact Top App Header Bar (components/layout/Header.tsx h-14) */}
          <header className={`h-14 border-b px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 ${headerBg}`}>
            {/* Left: Compact Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs font-mono min-w-0 shrink-0">
              <span className={`hidden sm:inline ${mutedTxt}`}>Workspace /</span>
              <button
                onClick={() => setClientDropdownOpen((p) => !p)}
                className={`font-semibold truncate max-w-[110px] hover:underline cursor-pointer ${headingTxt}`}
                title="Click to switch active client retainer"
              >
                {currentClient.name}
              </button>
              <span className={`opacity-40`}>/</span>
              <span className={`font-bold tracking-wide truncate ${headingTxt}`}>
                {ROUTE_TITLES[activeRoute]}
              </span>
            </div>

            {/* Center: Command Bar Trigger */}
            <button
              onClick={() =>
                onTriggerCommandPalette
                  ? onTriggerCommandPalette()
                  : window.dispatchEvent(new CustomEvent("agencyos:open-command-palette"))
              }
              className={`hidden sm:flex flex-1 max-w-xs items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                appDarkChrome
                  ? "bg-[#101014] border-white/[0.08] text-[#A3A0B0]"
                  : "bg-[#FFFFFF] border-[rgba(55,53,47,0.12)] text-[#6B6A65] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[11px]">Search or jump to...</span>
              </span>
              <kbd className={`px-1.5 py-0.2 rounded border text-[9px] font-mono ${inputBg}`}>⌘K</kbd>
            </button>

            {/* Right: Period Pill, Notifications, Theme Preview Toggle & Avatar */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${inputBg}`}>
                <Calendar className="w-3 h-3" />
                <span>This Month</span>
              </div>

              <div className="relative p-1.5 rounded-lg">
                <Bell className={`w-3.5 h-3.5 ${mutedTxt}`} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
              </div>

              <button
                onClick={() => setAppDarkChrome((prev) => !prev)}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${inputBg}`}
                title={appDarkChrome ? "Switch preview to Notion Light Mode" : "Switch preview to Obsidian Dark Mode"}
              >
                {appDarkChrome ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-[#37352F]" />}
              </button>

              <div className="w-7 h-7 rounded-lg bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-semibold">
                H
              </div>
            </div>
          </header>

          {/* ═════════════════════════════════════════════════════════════════════
              SCROLLABLE APP CANVAS — REAL PAGE LAYOUTS
             ═════════════════════════════════════════════════════════════════════ */}
          <div className={`flex-1 p-5 sm:p-6 overflow-y-auto ${appDarkChrome ? "bg-[#101014]" : "bg-[#FFFFFF]"}`}>
            {/* ── 1. DASHBOARD (Exact mirror of dashboard/page.tsx) ── */}
            {activeRoute === "dashboard" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Operational Header & Quick Action Dock */}
                <div className={`flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b ${hairline}`}>
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider mb-1">
                      <span className={mutedTxt}>AgencyOS</span>
                      <span className="opacity-30">/</span>
                      <span className="text-[#0F7B6C] flex items-center gap-1.5 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C] animate-pulse" />
                        Live Operations
                      </span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold tracking-tight flex items-center gap-2 ${headingTxt}`}>
                      <Activity className="w-4 h-4" />
                      <span>Agency Command Centre · {currentClient.name}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium">
                    <button
                      onClick={() => setActiveRoute("clients")}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 cursor-pointer ${cardBg}`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Client</span>
                    </button>
                    <button
                      onClick={() => setActiveRoute("studio")}
                      className="px-3 py-1.5 rounded-lg bg-[#191919] text-white flex items-center gap-1.5 cursor-pointer font-semibold"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Plan with AI</span>
                      <span className="text-[9px] font-mono opacity-75">⌘P</span>
                    </button>
                  </div>
                </div>

                {/* 4-Column Coherent Telemetry Strip */}
                <div className={`rounded-xl border overflow-hidden divide-y sm:divide-y-0 sm:divide-x ${hairline} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${cardBg}`}>
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                      <span className={mutedTxt}>Active Retainers</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold">100% SLA</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold font-mono tabular-nums ${headingTxt}`}>{currentClient.activeAccounts}</span>
                      <span className={`text-[11px] ${mutedTxt}`}>Accounts</span>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                      <span className={mutedTxt}>Production Pipeline</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold">0 Urgent</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold font-mono tabular-nums ${headingTxt}`}>{currentClient.activeTasks}</span>
                      <span className={`text-[11px] ${mutedTxt}`}>Active tasks</span>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                      <span className={mutedTxt}>Review Queue</span>
                      <span className={`px-1.5 py-0.2 rounded font-semibold ${inputBg}`}>Quality Gate</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold font-mono tabular-nums ${headingTxt}`}>{currentClient.reviewQueue}</span>
                      <span className={`text-[11px] ${mutedTxt}`}>In review</span>
                    </div>
                  </div>

                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                      <span className={mutedTxt}>Monthly Delivery</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold tabular-nums">
                        {currentClient.deliveredPercent}% Target
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold font-mono tabular-nums ${headingTxt}`}>{currentClient.deliveredRatio}</span>
                      <span className={`text-[11px] font-mono ${mutedTxt}`}>{currentClient.mrr}</span>
                    </div>
                  </div>
                </div>

                {/* Dual-Pane Operational Matrix (Table + Deadlines Radar) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left 8 cols: Linear Production Pipeline Table */}
                  <div className={`lg:col-span-8 rounded-xl border overflow-hidden ${cardBg}`}>
                    <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${hairline}`}>
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs font-heading font-semibold ${headingTxt}`}>Production Pipeline</h4>
                        <span className={`px-1.5 py-0.2 text-[9px] font-mono rounded border ${recessedBg} text-[#0F7B6C]`}>
                          Live Flow
                        </span>
                      </div>

                      <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-mono ${recessedBg}`}>
                        {(["all", "review", "in_progress", "done"] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setDashTaskFilter(tab)}
                            className={`px-2 py-0.5 rounded cursor-pointer capitalize ${
                              dashTaskFilter === tab
                                ? appDarkChrome
                                  ? "bg-[#20202A] text-white font-semibold"
                                  : "bg-white text-[#191919] font-semibold shadow-xs"
                                : mutedTxt
                            }`}
                          >
                            {tab === "in_progress" ? "Active" : tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`border-b text-[10px] font-mono uppercase tracking-wider ${recessedBg} ${mutedTxt}`}>
                            <th className="py-2 px-3.5 font-semibold">Deliverable / Task</th>
                            <th className="py-2 px-3 font-semibold">Assignee</th>
                            <th className="py-2 px-3 font-semibold">Status</th>
                            <th className="py-2 px-3 text-right font-semibold">Due</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${hairline}`}>
                          {filteredDashboardRows.map((row) => (
                            <tr key={row.title} className="h-10">
                              <td className={`py-2 px-3.5 font-medium ${headingTxt}`}>{row.title}</td>
                              <td className={`py-2 px-3 text-[11px] font-mono ${mutedTxt}`}>{row.assignee}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase ${
                                    row.status === "done"
                                      ? "bg-[#DDEDEA] text-[#0F7B6C]"
                                      : row.status === "review"
                                      ? "bg-[#FBF3DB] text-[#9A6700]"
                                      : `${inputBg}`
                                  }`}
                                >
                                  {row.status === "in_progress" ? "Active" : row.status}
                                </span>
                              </td>
                              <td className={`py-2 px-3 text-right text-[10px] font-mono tabular-nums ${mutedTxt}`}>
                                {row.due}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right 4 cols: Deadlines Radar matching dashboard/page.tsx */}
                  <div className={`lg:col-span-4 rounded-xl border p-3.5 space-y-2.5 ${cardBg}`}>
                    <div className={`flex items-center justify-between pb-2 border-b ${hairline}`}>
                      <div>
                        <h4 className={`text-xs font-heading font-semibold ${headingTxt}`}>Deadlines Radar</h4>
                        <p className={`text-[10px] ${mutedTxt}`}>Next 48h critical SLA</p>
                      </div>
                      <button
                        onClick={() => setActiveRoute("tasks")}
                        className="text-[10px] font-mono text-[#0F7B6C] cursor-pointer hover:underline"
                      >
                        View All
                      </button>
                    </div>

                    <div className={`p-2.5 rounded-lg border border-l-2 border-l-[#9A6700] space-y-1 ${recessedBg}`}>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className={`font-semibold truncate ${headingTxt}`}>{currentClient.deliverable}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-semibold">
                          Today
                        </span>
                      </div>
                      <p className={`text-[10px] font-mono ${mutedTxt}`}>{currentClient.name} · Magic-Link Gate</p>
                    </div>

                    <div className={`p-2.5 rounded-lg border border-l-2 border-l-[#0F7B6C] space-y-1 ${recessedBg}`}>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className={`font-semibold truncate ${headingTxt}`}>{currentClient.campaignTitle}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[9px] font-mono font-semibold">
                          Tomorrow
                        </span>
                      </div>
                      <p className={`text-[10px] font-mono ${mutedTxt}`}>{currentClient.name} · Auto-Schedule</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. CORTEX MEMORY (Exact mirror of cortex/page.tsx) ── */}
            {activeRoute === "cortex" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${mutedTxt}`}>
                      <span>System</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Institutional Memory</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold ${inputBg}`}>v2.0 Cortex</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold flex items-center gap-2 mt-0.5 ${headingTxt}`}>
                      <Brain className="w-4 h-4" />
                      <span>AgencyOS Cortex · {currentClient.name}</span>
                    </h3>
                  </div>

                  <div className={`flex items-center rounded-lg p-0.5 border text-[11px] font-mono ${recessedBg}`}>
                    <button
                      onClick={() => setCortexViewMode("cards")}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        cortexViewMode === "cards"
                          ? appDarkChrome
                            ? "bg-[#20202A] text-white font-semibold"
                            : "bg-white text-[#191919] font-semibold shadow-xs"
                          : mutedTxt
                      }`}
                    >
                      Cards View
                    </button>
                    <button
                      onClick={() => setCortexViewMode("document")}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        cortexViewMode === "document"
                          ? appDarkChrome
                            ? "bg-[#20202A] text-white font-semibold"
                            : "bg-white text-[#191919] font-semibold shadow-xs"
                          : mutedTxt
                      }`}
                    >
                      Clean Document
                    </button>
                  </div>
                </div>

                {/* Cortex Toolstrip (4 real tabs matching cortex/page.tsx lines 266-325) */}
                <div className={`p-1 rounded-xl border flex items-center gap-1 overflow-x-auto text-xs ${cardBg}`}>
                  {[
                    { id: "queue", label: "Memory Review Queue", count: cortexQueueCount, icon: ShieldAlert },
                    { id: "vault", label: "Living Brand Vault", count: 12, icon: FileCheck },
                    { id: "ingest", label: "Ingest Knowledge", icon: UploadCloud },
                    { id: "ask", label: "Ask Agency Brain", icon: Brain },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = cortexTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setCortexTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer font-medium transition-colors ${
                          active ? "bg-[#191919] text-white font-semibold" : `${mutedTxt} hover:opacity-100`
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold tabular-nums">
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Pending Queue Banner */}
                {cortexQueueCount > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FBF3DB]/75 border border-[#9A6700]/30 flex flex-wrap items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-[#9A6700] flex items-center gap-1.5 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Pending Memory Review ({cortexQueueCount} extracted rules awaiting human verification)
                      </p>
                      <p className="text-[#37352F] text-[11px] font-medium">&quot;{currentClient.pendingRule}&quot;</p>
                      <p className="text-[10px] font-mono text-[#6B6A65]">{currentClient.pendingDoc}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCortexQueueCount((p) => Math.max(0, p - 1))}
                        className="px-2.5 py-1 rounded-lg bg-[#191919] text-white text-[10px] font-semibold cursor-pointer"
                      >
                        Approve to Vault
                      </button>
                      <button
                        onClick={() => setCortexQueueCount((p) => Math.max(0, p - 1))}
                        className="px-2 py-1 rounded-lg text-[#6B6A65] hover:text-[#191919] text-[10px] cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {cortexTab === "ingest" ? (
                  <div className={`p-6 rounded-xl border space-y-2 text-xs ${recessedBg}`}>
                    <p className={`font-semibold ${headingTxt}`}>PDF & Call Transcript Extraction Ready</p>
                    <p className={mutedTxt}>
                      Drop client Brand Bibles or onboarding transcripts here. Cortex proposes verifiable rules with provenance citations into your human review queue.
                    </p>
                  </div>
                ) : cortexTab === "ask" ? (
                  <div className={`p-5 rounded-xl border space-y-3 text-xs ${recessedBg}`}>
                    <p className={`font-semibold ${headingTxt}`}>Semantic Brand Vault Query ({currentClient.name})</p>
                    <div className={`p-3 rounded-lg border ${cardBg}`}>
                      <p className="font-mono text-[10px] text-[#0F7B6C] mb-1">Query: &quot;Can we promote a weekend coupon code?&quot;</p>
                      <p className={headingTxt}>
                        Blocked by {currentClient.rules[1].id}: {currentClient.rules[1].title}
                      </p>
                    </div>
                  </div>
                ) : cortexViewMode === "cards" ? (
                  <div className="space-y-2.5">
                    {currentClient.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`p-3.5 rounded-xl border space-y-1 text-xs ${cardBg} ${
                          rule.id.startsWith("TABOO") ? "border-red-300/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              rule.id.startsWith("TABOO") ? "bg-[#FBE4E4] text-[#C93B2B]" : "bg-[#DDEDEA] text-[#0F7B6C]"
                            }`}
                          >
                            {rule.type}
                          </span>
                          <span className={`text-[10px] font-mono tabular-nums ${mutedTxt}`}>{rule.id}</span>
                        </div>
                        <p className={`font-semibold ${headingTxt}`}>{rule.title}</p>
                        <p className={`text-[11px] ${mutedTxt}`}>
                          <span className={`font-medium ${headingTxt}`}>Provenance:</span> &quot;{rule.provenance}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`p-5 rounded-xl border space-y-3 text-xs font-mono leading-relaxed ${recessedBg}`}>
                    <div className={`pb-2 border-b flex items-center justify-between ${hairline}`}>
                      <span className={mutedTxt}>{currentClient.name.toUpperCase()} BRAND SPECIFICATION</span>
                      <span className="text-[#0F7B6C]">STRICT COMPLIANCE LOCK</span>
                    </div>
                    {currentClient.rules.map((rule) => (
                      <div key={rule.id} className="space-y-0.5">
                        <p className={`font-bold ${headingTxt}`}>[{rule.id}] {rule.title}</p>
                        <p className={`pl-3 ${mutedTxt}`}>&gt; Provenance: {rule.provenance}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 3. CAMPAIGN STUDIO (Exact mirror of campaigns/page.tsx + ContextualCanvas) ── */}
            {activeRoute === "studio" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>
                      Campaign Studio · {currentClient.name}
                    </h3>
                    <p className={`text-xs ${mutedTxt}`}>
                      6 exact specialist agents collaborating alongside Contextual Canvas artifacts.
                    </p>
                  </div>

                  <div className={`flex items-center rounded-lg p-0.5 border text-[11px] font-mono ${recessedBg}`}>
                    <button
                      onClick={() => setStudioTab("carousel")}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        studioTab === "carousel"
                          ? appDarkChrome
                            ? "bg-[#20202A] text-white font-semibold"
                            : "bg-white text-[#191919] font-semibold shadow-xs"
                          : mutedTxt
                      }`}
                    >
                      Carousel Deck
                    </button>
                    <button
                      onClick={() => setStudioTab("storyboard")}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        studioTab === "storyboard"
                          ? appDarkChrome
                            ? "bg-[#20202A] text-white font-semibold"
                            : "bg-white text-[#191919] font-semibold shadow-xs"
                          : mutedTxt
                      }`}
                    >
                      Storyboard & Teleprompter
                    </button>
                    <button
                      onClick={() => setStudioTab("compliance")}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        studioTab === "compliance"
                          ? appDarkChrome
                            ? "bg-[#20202A] text-white font-semibold"
                            : "bg-white text-[#191919] font-semibold shadow-xs"
                          : mutedTxt
                      }`}
                    >
                      Compliance Panel
                    </button>
                  </div>
                </div>

                {/* Hero Entity Tray matching ContextualCanvas.tsx lines 77-146 */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${cardBg}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-heading font-bold">Hero Entity Tray</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-semibold tabular-nums">
                        {pinnedEntities.length} Pinned Focus
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono ${mutedTxt}`}>Grounds all 6 specialist agents</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pinnedEntities.map((item) => (
                      <span
                        key={item}
                        className="px-2.5 py-1 rounded-lg bg-[#FBF3DB]/80 text-[#9A6700] border border-[#9A6700]/30 text-[11px] font-mono font-semibold inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Exact 6 Real Specialist Agents Bar matching campaigns/page.tsx AGENT_STEPS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-[10px]">
                  {[
                    { name: "Brand Intelligence", icon: ShieldCheck },
                    { name: "Market & Trends", icon: Search },
                    { name: "Hist. Performance", icon: BarChart3 },
                    { name: "Campaign Strategist", icon: Cpu },
                    { name: "Content Architect", icon: Layers2 },
                    { name: "Quality Gate", icon: FileCheck },
                  ].map((ag) => {
                    const Icon = ag.icon;
                    return (
                      <div key={ag.name} className={`p-2 rounded-lg border space-y-1 ${recessedBg}`}>
                        <Icon className="w-3.5 h-3.5 mx-auto text-[#0F7B6C]" />
                        <p className={`font-semibold leading-tight ${headingTxt}`}>{ag.name}</p>
                        <p className="text-[9px] font-mono text-[#0F7B6C]">Verified</p>
                      </div>
                    );
                  })}
                </div>

                {studioTab === "carousel" && (
                  <div className={`p-4 rounded-xl border space-y-3 ${recessedBg}`}>
                    <div className={`grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-3.5 rounded-xl border ${cardBg}`}>
                      <div className="sm:col-span-4 relative aspect-[4/5] max-h-44 w-full rounded-lg overflow-hidden border border-[rgba(55,53,47,0.1)]">
                        <img src={currentClient.image} alt={currentClient.name} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#191919]/85 text-white font-mono text-[9px]">
                          4:5 COVER
                        </div>
                      </div>
                      <div className="sm:col-span-8 space-y-2 text-left">
                        <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                          {currentClient.name} · Slide 1 of 5
                        </span>
                        <h4 className={`text-sm font-heading font-bold ${headingTxt}`}>{currentClient.carouselTopic}</h4>
                        <p className={`text-xs leading-relaxed ${mutedTxt}`}>
                          Synthesized from Hero Entity Tray and verified deterministically against {currentClient.rules[0].id} and {currentClient.rules[1].id}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {studioTab === "storyboard" && (
                  <TeleprompterPreview clientKey={selectedClient} theme={appDarkChrome ? "dark" : "light"} />
                )}

                {studioTab === "compliance" && (
                  <div className={`p-4 rounded-xl border space-y-2 text-xs ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0F7B6C] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Quality Evaluator & Compliance Audit Passed (100%)
                      </span>
                      <span className={`font-mono text-[10px] ${mutedTxt}`}>Agent 06 Gate</span>
                    </div>
                    <p className={mutedTxt}>
                      Checked against all active negative taboos and visual guidelines for {currentClient.name}. Zero violations found.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── 4. CAMPAIGN PLANS ── */}
            {activeRoute === "plans" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b ${hairline}`}>
                  <h3 className={`text-base font-heading font-bold ${headingTxt}`}>
                    {currentClient.name} — Phased Campaign Plans
                  </h3>
                  <p className={`text-xs ${mutedTxt}`}>Approved Studio deliverables scheduled into multi-week rollout waves.</p>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className={`p-4 rounded-xl border space-y-1.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${headingTxt}`}>Wave 1: Teaser & Organic Hook Sequence</span>
                      <span className="text-[10px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-2 py-0.5 rounded font-semibold">Scheduled</span>
                    </div>
                    <p className={mutedTxt}>3 vertical video cuts with director teleprompter timings + 1 hero carousel.</p>
                  </div>
                  <div className={`p-4 rounded-xl border space-y-1.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${headingTxt}`}>Wave 2: Primary Launch & Client Sign-off</span>
                      <span className="text-[10px] font-mono bg-[#FBF3DB] text-[#9A6700] px-2 py-0.5 rounded font-semibold">In Review</span>
                    </div>
                    <p className={mutedTxt}>Cross-channel drop coordinated across Instagram, Facebook, and LinkedIn.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── 5. TASKS (Exact mirror of tasks/page.tsx telemetry strip + kanban) ── */}
            {activeRoute === "tasks" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>Production Tasks & Pipeline</h3>
                    <p className={`text-xs ${mutedTxt}`}>DAG dependency pipeline across Scripting, Editing, Review, and Dispatch.</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${inputBg} tabular-nums`}>
                    {currentClient.activeTasks} Active
                  </span>
                </div>

                {/* 5-Segment Linear Telemetry Strip matching tasks/page.tsx line 822 */}
                <div className={`rounded-xl border p-3 grid grid-cols-2 sm:grid-cols-5 divide-x ${hairline} ${cardBg}`}>
                  {[
                    ["Remaining", String(currentClient.activeTasks)],
                    ["Ready to Script", "4"],
                    ["In Production", "7"],
                    ["Client Review", String(currentClient.reviewQueue)],
                    ["Approved", "6"],
                  ].map(([lbl, num]) => (
                    <div key={lbl} className="px-2.5 first:pl-1">
                      <p className={`text-[9px] font-mono uppercase ${mutedTxt}`}>{lbl}</p>
                      <p className={`text-base font-bold font-mono tabular-nums ${headingTxt}`}>{num}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className={`p-3 rounded-xl border space-y-2 ${recessedBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${headingTxt}`}>1. In Production</span>
                      <Unlock className="w-3.5 h-3.5 text-[#0F7B6C]" />
                    </div>
                    <div className={`p-2.5 rounded-lg border space-y-1 ${cardBg}`}>
                      <p className={`font-semibold text-[11px] ${headingTxt}`}>{currentClient.carouselTopic}</p>
                      <span className="text-[9px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-1.5 py-0.2 rounded">Unlocked</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2 ${recessedBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${headingTxt}`}>2. Client Sign-off</span>
                      <Unlock className="w-3.5 h-3.5 text-[#9A6700]" />
                    </div>
                    <div className={`p-2.5 rounded-lg border space-y-1 ${cardBg}`}>
                      <p className={`font-semibold text-[11px] ${headingTxt}`}>{currentClient.deliverable}</p>
                      <span className="text-[9px] font-mono bg-[#FBF3DB] text-[#9A6700] px-1.5 py-0.2 rounded">Magic-Link Sent</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2 opacity-80 ${recessedBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${headingTxt}`}>3. Social Dispatch</span>
                      <Lock className="w-3.5 h-3.5 text-[#8C8A84]" />
                    </div>
                    <div className={`p-2.5 rounded-lg border border-dashed space-y-1 ${cardBg}`}>
                      <p className={`font-semibold text-[11px] ${mutedTxt}`}>Publish to Instagram & Facebook</p>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded inline-flex items-center gap-1 ${inputBg}`}>
                        <Lock className="w-2.5 h-2.5" /> Locked by Upstream
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 6. APPROVALS (Exact mirror of approvals/page.tsx filter toolstrip & queue) ── */}
            {activeRoute === "approvals" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>Approvals & Publishing Queue</h3>
                    <p className={`text-xs ${mutedTxt}`}>Review client feedback, Magic-Link tokens, and signed social releases.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-bold tabular-nums">
                    {currentClient.reviewQueue} Pending
                  </span>
                </div>

                <div className={`flex flex-wrap items-center gap-1 p-1 border rounded-xl w-fit text-[11px] ${cardBg}`}>
                  {[
                    { id: "all", label: "All (4)" },
                    { id: "client_review", label: "In Review (2)" },
                    { id: "approved", label: "Ready to Publish (1)" },
                    { id: "published", label: "Published Live (1)" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setApprovalFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                        approvalFilter === tab.id ? "bg-[#191919] text-white font-semibold" : mutedTxt
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className={`rounded-xl border p-4 space-y-3 ${cardBg}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${recessedBg}`}>
                        <ImageIcon className="w-4 h-4 text-[#0F7B6C]" />
                      </div>
                      <div>
                        <p className={`font-semibold text-xs ${headingTxt}`}>{currentClient.deliverable}</p>
                        <p className={`text-[10px] font-mono ${mutedTxt}`}>agencyos.app/review/rk_9482bf0e · 72h Token</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer ${recessedBg} ${headingTxt}`}
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedLink ? "Copied Link" : "Copy Magic Link"}</span>
                      </button>
                      <button
                        onClick={() => setApprovalStatus(approvalStatus === "pending" ? "approved" : "pending")}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          approvalStatus === "approved" ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#191919] text-white"
                        }`}
                      >
                        {approvalStatus === "approved" ? "✓ Approved (SHA-256)" : "Simulate Client Sign-Off"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 7. CONTENT CALENDAR (Exact mirror of calendar/page.tsx) ── */}
            {activeRoute === "calendar" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex flex-wrap items-center justify-between gap-2 ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>
                      {currentClient.name} — Content Calendar
                    </h3>
                    <p className={`text-xs ${mutedTxt}`}>Direct publishing schedule with real-time OAuth connection monitoring.</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                    Meta & LinkedIn Healthy · 72h Token Guard
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {currentClient.schedule.map((slot) => (
                    <div key={slot.day} className={`p-3 rounded-xl border space-y-2 ${recessedBg}`}>
                      <span className={`font-mono text-[10px] tabular-nums ${mutedTxt}`}>{slot.day}</span>
                      <div className={`p-2.5 rounded-lg border space-y-1.5 ${cardBg}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${inputBg}`}>{slot.net}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                              slot.status === "Scheduled" || slot.status === "Approved"
                                ? "bg-[#DDEDEA] text-[#0F7B6C]"
                                : "bg-[#FBF3DB] text-[#9A6700]"
                            }`}
                          >
                            {slot.status}
                          </span>
                        </div>
                        <p className={`font-semibold text-[11px] leading-snug ${headingTxt}`}>{slot.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 8. COMMUNITY INBOX (Exact mirror of engagement/page.tsx) ── */}
            {activeRoute === "inbox" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${hairline}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#191919] text-white flex items-center justify-center shrink-0">
                      <MessagesSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`text-base font-heading font-bold flex items-center gap-2 ${headingTxt}`}>
                        <span>Community Engagement</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] font-semibold">
                          Live Inbox
                        </span>
                      </h3>
                      <p className={`text-[11px] ${mutedTxt}`}>AI comment triage, brand-verified replies & direct messages</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className={`px-2 py-1 rounded border ${inputBg}`}>Needs Reply: 4</span>
                    <span className="px-2 py-1 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold">Buying Leads: 3</span>
                  </div>
                </div>

                {/* Stream Mode Switcher matching engagement/page.tsx lines 555-580 */}
                <div className={`flex items-center p-0.5 rounded-lg border w-fit text-[11px] ${recessedBg}`}>
                  <button
                    onClick={() => setEngagementStream("comments")}
                    className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer font-medium ${
                      engagementStream === "comments" ? "bg-[#191919] text-white" : mutedTxt
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Comments & Mentions (18)</span>
                  </button>
                  <button
                    onClick={() => setEngagementStream("dms")}
                    className={`px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer font-medium ${
                      engagementStream === "dms" ? "bg-[#191919] text-white" : mutedTxt
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    <span>Direct Messages (6)</span>
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 text-xs ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold tabular-nums">
                      High-Intent Lead · 94/100
                    </span>
                    <span className={`text-[10px] font-mono ${mutedTxt}`}>Instagram · 4m ago</span>
                  </div>
                  <p className={`font-semibold ${headingTxt}`}>&quot;{currentClient.inboundComment}&quot;</p>
                  <div className={`p-3 rounded-lg border space-y-2 ${recessedBg}`}>
                    <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1 font-semibold">
                      <Check className="w-3 h-3" /> Cortex Brand-Rule Verified Reply:
                    </span>
                    <p className={mutedTxt}>&quot;{currentClient.draftReply}&quot;</p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setReplyPublished(!replyPublished)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          replyPublished ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#191919] text-white"
                        }`}
                      >
                        {replyPublished ? "✓ Published Live" : "1-Click Publish Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 9. BILLING & CREDITS ── */}
            {activeRoute === "billing" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b ${hairline}`}>
                  <h3 className={`text-base font-heading font-bold ${headingTxt}`}>Billing & Computational Credits</h3>
                  <p className={`text-xs ${mutedTxt}`}>Unlimited team seats included. Pay only for AI generation volume.</p>
                </div>
                <div className={`p-4 rounded-xl border space-y-3 ${recessedBg}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${headingTxt}`}>Monthly Shared Credits</span>
                    <span className={`font-mono tabular-nums ${mutedTxt}`}>38,200 / 50,000 used</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/[0.08] overflow-hidden">
                    <div className="w-[76%] h-full bg-[#191919] rounded-full" />
                  </div>
                  <p className={`text-[11px] ${mutedTxt}`}>
                    Instant rollover top-ups available at $1 per 1,000 credits flat rate. Soft degradation never locks team boards.
                  </p>
                </div>
              </div>
            )}

            {/* ── 10. MY WORKSPACE ── */}
            {activeRoute === "workspace" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>My Workbench · {currentClient.name}</h3>
                    <p className={`text-xs ${mutedTxt}`}>Personal assigned tasks and sign-off actions.</p>
                  </div>
                  <span className="text-[10px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-2 py-0.5 rounded font-semibold">On Schedule</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { id: "c1", task: `Verify ${currentClient.rules[0].id} across launch brief`, meta: "Compliance" },
                    { id: "c2", task: `Dispatch Magic-Link for ${currentClient.deliverable}`, meta: "Due Today" },
                    { id: "c3", task: `Lock teleprompter pace for ${currentClient.campaignTitle}`, meta: "Darkroom" },
                  ].map((row) => (
                    <button
                      key={row.id}
                      onClick={() => setCompletedChecklist((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left cursor-pointer ${cardBg}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            completedChecklist[row.id] ? "bg-[#0F7B6C] border-[#0F7B6C] text-white" : hairline
                          }`}
                        >
                          {completedChecklist[row.id] && <Check className="w-3 h-3" />}
                        </div>
                        <span className={completedChecklist[row.id] ? "line-through opacity-50" : headingTxt}>
                          {row.task}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono ${mutedTxt}`}>{row.meta}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── 11. CLIENTS ── */}
            {activeRoute === "clients" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b ${hairline}`}>
                  <h3 className={`text-base font-heading font-bold ${headingTxt}`}>Client Retainer Fleet</h3>
                  <p className={`text-xs ${mutedTxt}`}>Click any client card to switch active workspace rules and deliverables.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => {
                    const item = clientData[key];
                    const active = selectedClient === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedClient(key)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all space-y-2.5 ${
                          active ? "border-[#191919] ring-1 ring-[#191919]/15" : ""
                        } ${cardBg}`}
                      >
                        <div className="aspect-[16/10] rounded-lg overflow-hidden border border-[rgba(55,53,47,0.1)]">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className={`font-semibold text-xs font-heading ${headingTxt}`}>{item.name}</p>
                          <p className={`text-[11px] ${mutedTxt}`}>{item.industry}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#0F7B6C]">
                          <span>{item.activeAccounts} Accounts</span>
                          <span>{item.deliveredPercent}% SLA</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 12. REPORTS & ROI ── */}
            {activeRoute === "reports" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>Reports & Agency ROI · {currentClient.name}</h3>
                    <p className={`text-xs ${mutedTxt}`}>Organic reach lift, save velocity, and production hours reclaimed.</p>
                  </div>
                  <span className="text-[10px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-2 py-0.5 rounded font-semibold">90-Day Audit</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`p-4 rounded-xl border space-y-1 ${recessedBg}`}>
                    <span className={`text-[10px] font-mono uppercase ${mutedTxt}`}>Organic Reach Lift</span>
                    <p className="text-2xl font-bold font-mono text-[#0F7B6C] tabular-nums">{currentClient.engagementLift}</p>
                  </div>
                  <div className={`p-4 rounded-xl border space-y-1 ${recessedBg}`}>
                    <span className={`text-[10px] font-mono uppercase ${mutedTxt}`}>Carousel Save Rate</span>
                    <p className={`text-2xl font-bold font-mono tabular-nums ${headingTxt}`}>{currentClient.saveRate}</p>
                  </div>
                  <div className={`p-4 rounded-xl border space-y-1 ${recessedBg}`}>
                    <span className={`text-[10px] font-mono uppercase ${mutedTxt}`}>Hours Reclaimed</span>
                    <p className="text-2xl font-bold font-mono text-[#9A6700] tabular-nums">{currentClient.hoursReclaimed}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── 13. TEAM & SETTINGS ── */}
            {(activeRoute === "team" || activeRoute === "settings") && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 animate-in fade-in duration-150">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${recessedBg} ${mutedTxt}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className={`font-semibold text-sm font-heading ${headingTxt}`}>
                    Protected Admin Tier (Available inside live workspace)
                  </p>
                  <p className={`text-xs max-w-sm ${mutedTxt}`}>
                    Tenant isolation and Role-Based Access Control shield agency billing margins and owner credentials from freelance contractor views.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
