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
  Plus,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Cpu,
  Layers2,
  Image as ImageIcon,
  MessageSquare,
  Send,
  LogOut,
  Sun,
  Moon,
  Building2,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Columns,
  PenTool,
  Scissors,
  Film,
  AlertTriangle,
  UserPlus,
  PieChart,
  Save,
  Presentation,
  Bot,
  User,
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
  const [appDarkChrome, setAppDarkChrome] = useState(false);

  // Dashboard state
  const [dashTaskFilter, setDashTaskFilter] = useState<"all" | "review" | "in_progress" | "done">("all");

  // My Workspace state (mirrors workspace/page.tsx)
  const [workspaceTab, setWorkspaceTab] = useState<"all" | "action_required" | "revisions" | "in_review" | "completed">("action_required");
  const [workspaceStageFilter, setWorkspaceStageFilter] = useState<string>("all");
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>({ c1: true, c2: false, c3: false });

  // Clients directory state (mirrors clients/page.tsx)
  const [clientsViewMode, setClientsViewMode] = useState<"list" | "grid">("list");
  const [clientsStatusFilter, setClientsStatusFilter] = useState<string>("all");
  const [clientsSearch, setClientsSearch] = useState("");

  // Cortex state (mirrors cortex/page.tsx)
  const [cortexTab, setCortexTab] = useState<"queue" | "vault" | "ingest" | "ask">("vault");
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");
  const [cortexQueueCount, setCortexQueueCount] = useState<number>(3);

  // Tasks state (mirrors tasks/page.tsx)
  const [tasksViewMode, setTasksViewMode] = useState<"kanban" | "list">("kanban");

  // Approvals state (mirrors approvals/page.tsx)
  const [approvalFilter, setApprovalFilter] = useState<"all" | "client_review" | "approved" | "published">("all");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");
  const [copiedLink, setCopiedLink] = useState(false);

  // Campaign Studio state (mirrors campaigns/page.tsx + ContextualCanvas)
  const [studioTab, setStudioTab] = useState<"carousel" | "storyboard" | "compliance">("carousel");
  const [pinnedEntities, setPinnedEntities] = useState<string[]>(["Winter Truffle Gnocchi", "Chef Table (30 Guests)"]);

  // Campaign Plans state (mirrors campaign-plans/page.tsx)
  const [plansPillarFilter, setPlansPillarFilter] = useState<string>("all");
  const [plansPushed, setPlansPushed] = useState<boolean>(false);

  // Calendar state (mirrors calendar/page.tsx)
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");

  // Engagement state (mirrors engagement/page.tsx)
  const [engagementStream, setEngagementStream] = useState<"comments" | "dms">("comments");
  const [engagementSentiment, setEngagementSentiment] = useState<string>("all");
  const [replyPublished, setReplyPublished] = useState(false);

  // Team state (mirrors team/page.tsx)
  const [teamRoleFilter, setTeamRoleFilter] = useState<string>("all");

  // Billing state (mirrors billing/page.tsx)
  const [selectedTopUp, setSelectedTopUp] = useState<number>(25000);
  const [autoRecharge, setAutoRecharge] = useState<boolean>(true);
  const [topUpSuccess, setTopUpSuccess] = useState<boolean>(false);

  // Settings state (mirrors settings/page.tsx)
  const [strictTaboos, setStrictTaboos] = useState<boolean>(true);
  const [proactiveFlagging, setProactiveFlagging] = useState<boolean>(true);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

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
      city: "Mumbai · Bandra",
      status: "active" as const,
      activeAccounts: 8,
      activeTasks: 19,
      reviewQueue: 2,
      deliveredRatio: "28/32",
      deliveredPercent: 88,
      mrr: "$4,800/mo",
      engagementLift: "+44%",
      saveRate: "6.8%",
      hoursReclaimed: "18.5 hrs",
      campaignTitle: "Winter Truffle & Aperitivo Release",
      campaignTheme: "Craft hearth scarcity without discounting signature plates",
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
      planDays: [
        { day: 1, pillar: "Craftsmanship", format: "Instagram Reel", title: "Truffle Shave Hearth Hook", status: "in_production" },
        { day: 2, pillar: "Culinary Heritage", format: "4:5 Carousel", title: "Handmade Burrata Origin Story", status: "in_production" },
        { day: 3, pillar: "Private Dining", format: "Instagram Story", title: "Friday 30-Cover Table Reveal", status: "draft" },
        { day: 4, pillar: "Cellar Notes", format: "LinkedIn Post", title: "Chef Autumn Sourcing Essay", status: "draft" },
      ],
    },
    linden: {
      initial: "L",
      name: "Linden & Clay",
      industry: "D2C Botanical Skincare",
      city: "Bengaluru · Indiranagar",
      status: "active" as const,
      activeAccounts: 6,
      activeTasks: 14,
      reviewQueue: 1,
      deliveredRatio: "21/24",
      deliveredPercent: 87,
      mrr: "$3,900/mo",
      engagementLift: "+39%",
      saveRate: "8.2%",
      hoursReclaimed: "14.2 hrs",
      campaignTitle: "Cold-Pressed Botanical Serum Launch",
      campaignTheme: "Quiet botanical barrier ritual anchored in recyclable amber glass",
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
      planDays: [
        { day: 1, pillar: "Morning Ritual", format: "Instagram Reel", title: "3-Drop Damp Skin Routine", status: "in_production" },
        { day: 2, pillar: "Formulation", format: "4:5 Carousel", title: "Bio-Fermented Squalane Guide", status: "in_production" },
        { day: 3, pillar: "Sustainability", format: "LinkedIn Post", title: "Amber Glass Refill Engineering", status: "draft" },
        { day: 4, pillar: "Conversion", format: "Instagram Story", title: "Batch 09 Apothecary Restock", status: "draft" },
      ],
    },
    cairn: {
      initial: "C",
      name: "Cairn Roasters",
      industry: "Specialty Micro-Lot Coffee",
      city: "New Delhi · Mehrauli",
      status: "onboarding" as const,
      activeAccounts: 4,
      activeTasks: 11,
      reviewQueue: 1,
      deliveredRatio: "18/20",
      deliveredPercent: 90,
      mrr: "$2,800/mo",
      engagementLift: "+51%",
      saveRate: "7.4%",
      hoursReclaimed: "11.8 hrs",
      campaignTitle: "Anaerobic Washed Highland Release",
      campaignTheme: "Roast-date transparency & 1,900m washed clarity for home bars",
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
      planDays: [
        { day: 1, pillar: "Brew Science", format: "Instagram Reel", title: "93C Acoustic Pour-Over Bloom", status: "in_production" },
        { day: 2, pillar: "Origin Trace", format: "4:5 Carousel", title: "1,900m Cooperative Harvest", status: "in_production" },
        { day: 3, pillar: "Freshness", format: "Instagram Story", title: "48h Rested Drum Dispatch", status: "draft" },
        { day: 4, pillar: "Wholesale", format: "LinkedIn Post", title: "Direct-Trade Farm Economics", status: "draft" },
      ],
    },
  };

  const currentClient = clientData[selectedClient];

  const filteredDashboardRows = currentClient.pipelineRows.filter((row) => {
    if (dashTaskFilter === "all") return true;
    return row.status === dashTaskFilter;
  });

  const allClientsList = (["solis", "linden", "cairn"] as ClientKey[])
    .map((key) => ({ key, ...clientData[key] }))
    .filter((c) => {
      const matchStatus = clientsStatusFilter === "all" || c.status === clientsStatusFilter;
      const matchSearch =
        !clientsSearch.trim() ||
        c.name.toLowerCase().includes(clientsSearch.toLowerCase()) ||
        c.industry.toLowerCase().includes(clientsSearch.toLowerCase());
      return matchStatus && matchSearch;
    });

  const teamMembers = [
    { name: "Harshad Potdar", email: "owner@brieva.studio", role: "owner", label: "Owner", tasks: 2 },
    { name: "Mira Kapoor", email: "mira@brieva.studio", role: "writer", label: "Scriptwriter", tasks: 6 },
    { name: "Elena Vance", email: "elena@brieva.studio", role: "editor", label: "Video Editor", tasks: 5 },
    { name: "Arjun Nair", email: "arjun@brieva.studio", role: "designer", label: "Designer", tasks: 4 },
    { name: "Rohan Verma", email: "rohan@brieva.studio", role: "strategist", label: "Strategist", tasks: 2 },
  ].filter((m) => {
    if (teamRoleFilter === "all") return true;
    if (teamRoleFilter === "specialists") return ["writer", "editor", "designer"].includes(m.role);
    if (teamRoleFilter === "management") return ["owner", "strategist"].includes(m.role);
    return m.role === teamRoleFilter;
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

  // Explicit surface tokens matching AgencyOS Notion Light & Obsidian Dark (Zero Purple)
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
      <motion.div
        style={{ rotateX, transformPerspective: 1200 }}
        className={`rounded-2xl border shadow-[0_24px_60px_-15px_rgba(17,17,20,0.14)] overflow-hidden flex flex-col md:flex-row min-h-[680px] transition-colors duration-200 ${shellBg}`}
      >
        {/* Mobile Client + Route Rail (< md) */}
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

          <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto text-xs">
            {NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider opacity-65">
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
            RIGHT MAIN PANE: TOP HEADER BAR + ALL 14 REAL SCREENS
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Exact Top App Header Bar (components/layout/Header.tsx h-14) */}
          <header className={`h-14 border-b px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 ${headerBg}`}>
            <div className="flex items-center gap-1.5 text-xs font-mono min-w-0 shrink-0">
              <span className={`hidden sm:inline ${mutedTxt}`}>Workspace /</span>
              <button
                onClick={() => setClientDropdownOpen((p) => !p)}
                className={`font-semibold truncate max-w-[110px] hover:underline cursor-pointer ${headingTxt}`}
              >
                {currentClient.name}
              </button>
              <span className="opacity-40">/</span>
              <span className={`font-bold tracking-wide truncate ${headingTxt}`}>
                {ROUTE_TITLES[activeRoute]}
              </span>
            </div>

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
              SCROLLABLE APP CANVAS — 14 EXACT AGENCYOS SCREENS
             ═════════════════════════════════════════════════════════════════════ */}
          <div className={`flex-1 p-5 sm:p-6 overflow-y-auto ${appDarkChrome ? "bg-[#101014]" : "bg-[#FFFFFF]"}`}>
            {/* ── 1. DASHBOARD (dashboard/page.tsx) ── */}
            {activeRoute === "dashboard" && (
              <div className="space-y-5 animate-in fade-in duration-150">
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
                      <span>New Client</span>
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

                {/* 4-Column Linear Telemetry Strip */}
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

                {/* Dual-Pane Operational Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
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

            {/* ── 2. MY WORKSPACE (Exact mirror of workspace/page.tsx) ── */}
            {activeRoute === "workspace" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Welcome Cockpit Banner Card */}
                <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${cardBg}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${recessedBg}`}>
                      <Briefcase className={`w-4 h-4 ${headingTxt}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-base font-heading font-bold tracking-tight ${headingTxt}`}>
                          Welcome back, Harshad
                        </h3>
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${inputBg}`}>
                          Owner
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded-full font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C] animate-pulse" />
                          Active Cockpit
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${mutedTxt}`}>
                        Focused operational workspace for creative assignments, script drafts, and asset submissions.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveRoute("tasks")}
                    className="px-3 py-1.5 rounded-lg bg-[#191919] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Agency Kanban</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 5-Segment Editorial Execution Strip (workspace/page.tsx lines 381-495) */}
                <div className={`rounded-xl border p-3 grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x ${hairline} ${cardBg}`}>
                  {[
                    { id: "action_required", label: "To Execute", count: "6", sub: "ready to work", icon: CheckSquare },
                    { id: "revisions", label: "Needs Update", count: "1", sub: "feedback", icon: AlertTriangle },
                    { id: "in_review", label: "In Inspection", count: "2", sub: "QA gate", icon: ShieldCheck },
                    { id: "all", label: "Due Today", count: "3", sub: "high SLA", icon: Bell },
                    { id: "completed", label: "Delivered", count: "14", sub: "archived", icon: CheckCircle2 },
                  ].map((metric) => {
                    const Icon = metric.icon;
                    const active = workspaceTab === metric.id;
                    return (
                      <button
                        key={metric.id}
                        onClick={() => setWorkspaceTab(metric.id as any)}
                        className="px-3 py-1 text-left cursor-pointer group"
                      >
                        <div className={`flex items-center justify-between text-[10px] font-mono uppercase ${active ? headingTxt : mutedTxt}`}>
                          <span>{metric.label}</span>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className={`text-xl font-bold font-mono tabular-nums ${active ? headingTxt : mutedTxt}`}>{metric.count}</span>
                          <span className={`text-[10px] font-mono ${mutedTxt}`}>{metric.sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* STAGE_PILLS Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  {[
                    { id: "all", label: "All Stages", icon: Layers },
                    { id: "script", label: "Scriptwriting", icon: PenTool },
                    { id: "edit", label: "Video Editing", icon: Scissors },
                    { id: "design", label: "Graphic Design", icon: Sparkles },
                    { id: "shoot", label: "Shooting", icon: Film },
                  ].map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.id}
                        onClick={() => setWorkspaceStageFilter(pill.id)}
                        className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          workspaceStageFilter === pill.id ? "bg-[#191919] text-white border-[#191919]" : `${cardBg} ${mutedTxt}`
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{pill.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Actionable Assignment Cards */}
                <div className="space-y-2 text-xs">
                  {[
                    { id: "c1", task: `Verify ${currentClient.rules[0].id} across ${currentClient.campaignTitle}`, stage: "Scriptwriting", badge: "High" },
                    { id: "c2", task: `Send Magic-Link for ${currentClient.deliverable}`, stage: "Graphic Design", badge: "Urgent" },
                    { id: "c3", task: `Lock teleprompter pace (140 WPM) for ${currentClient.name}`, stage: "Video Editing", badge: "Medium" },
                  ].map((row) => (
                    <button
                      key={row.id}
                      onClick={() => setCompletedChecklist((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                      className={`w-full p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer ${cardBg}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            completedChecklist[row.id] ? "bg-[#0F7B6C] border-[#0F7B6C] text-white" : hairline
                          }`}
                        >
                          {completedChecklist[row.id] && <Check className="w-3 h-3" />}
                        </div>
                        <span className={completedChecklist[row.id] ? "line-through opacity-50" : `font-medium ${headingTxt}`}>
                          {row.task}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded border ${recessedBg} ${mutedTxt}`}>{row.stage}</span>
                        <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] font-semibold uppercase">{row.badge}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. CLIENTS (Exact mirror of clients/page.tsx) ── */}
            {activeRoute === "clients" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider ${mutedTxt}`}>
                      <span>AgencyOS</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Client Directory</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold flex items-center gap-2 mt-0.5 ${headingTxt}`}>
                      <Building2 className="w-4 h-4" />
                      <span>Client Workspaces</span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono rounded-md border ${inputBg}`}>
                        3 Active
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-[#191919] text-white text-xs font-semibold flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Onboard Client</span>
                    </span>
                  </div>
                </div>

                {/* Linear Search, Status Filter Tabs & List/Grid Switcher */}
                <div className={`p-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${cardBg}`}>
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${mutedTxt}`} />
                    <input
                      type="text"
                      value={clientsSearch}
                      onChange={(e) => setClientsSearch(e.target.value)}
                      placeholder="Filter by client name, industry, city..."
                      className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none ${recessedBg} ${headingTxt}`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border text-[11px] ${recessedBg}`}>
                      {[
                        { id: "all", label: "All" },
                        { id: "active", label: "Active" },
                        { id: "onboarding", label: "Onboarding" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setClientsStatusFilter(t.id)}
                          className={`px-2.5 py-1 rounded cursor-pointer ${
                            clientsStatusFilter === t.id ? "bg-[#191919] text-white font-semibold" : mutedTxt
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${recessedBg}`}>
                      <button
                        onClick={() => setClientsViewMode("list")}
                        className={`p-1 rounded cursor-pointer ${clientsViewMode === "list" ? "bg-[#191919] text-white" : mutedTxt}`}
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setClientsViewMode("grid")}
                        className={`p-1 rounded cursor-pointer ${clientsViewMode === "grid" ? "bg-[#191919] text-white" : mutedTxt}`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {clientsViewMode === "list" ? (
                  <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b text-[10px] font-mono uppercase tracking-wider ${recessedBg} ${mutedTxt}`}>
                          <th className="py-2.5 px-3.5 font-semibold">Client Workspace</th>
                          <th className="py-2.5 px-3 font-semibold">Industry & City</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Delivery SLA</th>
                          <th className="py-2.5 px-3 text-right font-semibold">Context</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${hairline}`}>
                        {allClientsList.map((c) => (
                          <tr key={c.key} className="h-12">
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-lg bg-[#191919] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                  {c.initial}
                                </span>
                                <span className={`font-semibold ${headingTxt}`}>{c.name}</span>
                              </div>
                            </td>
                            <td className={`py-2.5 px-3 ${mutedTxt}`}>
                              <div>{c.industry}</div>
                              <div className="text-[10px] font-mono">{c.city}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold capitalize ${
                                  c.status === "active"
                                    ? "bg-[#DDEDEA] text-[#0F7B6C]"
                                    : "bg-[#FBF3DB] text-[#9A6700]"
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
                                  <div className="h-full bg-[#0F7B6C]" style={{ width: `${c.deliveredPercent}%` }} />
                                </div>
                                <span className="font-mono text-[10px] tabular-nums">{c.deliveredPercent}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setSelectedClient(c.key)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono cursor-pointer ${
                                  selectedClient === c.key ? "bg-[#0F7B6C] text-white font-semibold" : `${inputBg}`
                                }`}
                              >
                                {selectedClient === c.key ? "Active" : "Switch"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {allClientsList.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setSelectedClient(c.key)}
                        className={`p-3 rounded-xl border text-left cursor-pointer space-y-2.5 ${cardBg} ${
                          selectedClient === c.key ? "ring-1 ring-[#191919]" : ""
                        }`}
                      >
                        <div className="aspect-[16/10] rounded-lg overflow-hidden border border-[rgba(55,53,47,0.1)]">
                          <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className={`font-semibold text-xs font-heading ${headingTxt}`}>{c.name}</p>
                          <p className={`text-[11px] ${mutedTxt}`}>{c.industry}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 4. CORTEX MEMORY (cortex/page.tsx) ── */}
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
                      Drop client Brand Bibles or onboarding transcripts here. Cortex proposes verifiable rules with provenance citations into your review queue.
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

            {/* ── 5. TASKS (Exact mirror of tasks/page.tsx Kanban + List) ── */}
            {activeRoute === "tasks" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex flex-wrap items-center justify-between gap-2 ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${mutedTxt}`}>
                      <span>Operations</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Production Tasks</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Production Tasks & Pipeline</h3>
                  </div>

                  <div className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${recessedBg}`}>
                    <button
                      onClick={() => setTasksViewMode("kanban")}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                        tasksViewMode === "kanban" ? "bg-[#191919] text-white font-semibold" : mutedTxt
                      }`}
                    >
                      <LayoutGrid className="w-3 h-3" />
                      <span>Kanban</span>
                    </button>
                    <button
                      onClick={() => setTasksViewMode("list")}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                        tasksViewMode === "list" ? "bg-[#191919] text-white font-semibold" : mutedTxt
                      }`}
                    >
                      <LayoutList className="w-3 h-3" />
                      <span>List</span>
                    </button>
                  </div>
                </div>

                {/* 5-Segment Telemetry Strip */}
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

                {tasksViewMode === "kanban" ? (
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
                ) : (
                  <div className={`rounded-xl border divide-y text-xs ${cardBg} ${hairline}`}>
                    {currentClient.pipelineRows.map((row) => (
                      <div key={row.title} className="p-3 flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${headingTxt}`}>{row.title}</p>
                          <p className={`text-[10px] font-mono ${mutedTxt}`}>{row.assignee} · Due {row.due}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase ${inputBg}`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 6. APPROVALS (Exact mirror of approvals/page.tsx) ── */}
            {activeRoute === "approvals" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${mutedTxt}`}>
                      <span>Operations</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Approvals Queue</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Approvals & Publishing Queue</h3>
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

            {/* ── 7. CAMPAIGN STUDIO (Exact mirror of campaigns/page.tsx + ContextualCanvas) ── */}
            {activeRoute === "studio" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${hairline}`}>
                  <div>
                    <h3 className={`text-base font-heading font-bold ${headingTxt}`}>
                      Campaign Studio · {currentClient.name}
                    </h3>
                    <p className={`text-xs ${mutedTxt}`}>
                      AI Co-Director brief discovery paired with live Contextual Canvas artifacts.
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
                      Teleprompter
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
                      Compliance Gate
                    </button>
                  </div>
                </div>

                {/* Co-Director Brief Bubble + Hero Entity Tray */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className={`lg:col-span-5 p-3.5 rounded-xl border space-y-2.5 text-xs ${recessedBg}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-[#191919] text-white flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5" />
                      </span>
                      <span className={`font-heading font-bold ${headingTxt}`}>Campaign Director</span>
                    </div>
                    <p className={`leading-relaxed text-[11px] ${mutedTxt}`}>
                      Synced {currentClient.rules.length} Cortex rules and pinned Hero Entities for {currentClient.name}. Ready to review 5-slide cover copy and 60s Teleprompter cues.
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono pt-1">
                      {["Brand Intel", "Trend Res.", "Hist. Lift", "Strategist", "Architect", "QA Gate"].map((name) => (
                        <div key={name} className={`p-1.5 rounded border text-center ${cardBg}`}>
                          <p className={`font-semibold truncate ${headingTxt}`}>{name}</p>
                          <p className="text-[#0F7B6C]">Ready</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`lg:col-span-7 p-3.5 rounded-xl border space-y-2.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-heading font-bold ${headingTxt}`}>Hero Entity Tray</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-semibold tabular-nums">
                        {pinnedEntities.length} Pinned Focus
                      </span>
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
                </div>

                {studioTab === "carousel" && (
                  <div className={`p-4 rounded-xl border ${recessedBg}`}>
                    <div className={`grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-3.5 rounded-xl border ${cardBg}`}>
                      <div className="sm:col-span-4 relative aspect-[4/5] max-h-40 w-full rounded-lg overflow-hidden border border-[rgba(55,53,47,0.1)]">
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
                          Verified deterministically against {currentClient.rules[0].id} and {currentClient.rules[1].id}.
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
                        Quality Evaluator & Gate Passed (100%)
                      </span>
                      <span className={`font-mono text-[10px] ${mutedTxt}`}>Agent 06 Gate</span>
                    </div>
                    <p className={mutedTxt}>
                      All negative taboos and brand packaging mandates verified for {currentClient.name}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── 8. CAMPAIGN PLANS (Exact mirror of campaign-plans/page.tsx) ── */}
            {activeRoute === "plans" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${mutedTxt}`}>
                      <span>Operations</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Campaign Plans</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Campaign Plans Archive</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveRoute("studio")}
                      className="px-3 py-1.5 rounded-lg bg-[#191919] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>New Sprint in Studio</span>
                    </button>
                  </div>
                </div>

                {/* Strategy Header Banner matching campaign-plans/page.tsx line 545 */}
                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm font-heading font-bold ${headingTxt}`}>{currentClient.campaignTitle}</h4>
                        <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-bold uppercase">
                          {plansPushed ? "In Production" : "AI Draft"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-bold">
                          98% Brand Compliant
                        </span>
                      </div>
                      <p className={`text-xs ${mutedTxt}`}>Theme: &quot;{currentClient.campaignTheme}&quot;</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveRoute("studio")}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${recessedBg} ${headingTxt}`}
                      >
                        <Presentation className="w-3.5 h-3.5" />
                        <span>Pitch Deck</span>
                      </button>
                      <button
                        onClick={() => setPlansPushed(!plansPushed)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          plansPushed ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#0F7B6C] text-white"
                        }`}
                      >
                        {plansPushed ? "✓ Pushed to Kanban" : "Push Sprint to Tasks"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Deliverable Day Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {currentClient.planDays.map((d) => (
                    <div key={d.day} className={`p-3 rounded-xl border space-y-2 ${cardBg}`}>
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className={mutedTxt}>DAY 0{d.day}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold">
                          {d.format}
                        </span>
                      </div>
                      <p className={`font-semibold leading-snug ${headingTxt}`}>{d.title}</p>
                      <p className={`text-[10px] font-mono ${mutedTxt}`}>Pillar: {d.pillar}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 9. CONTENT CALENDAR (Exact mirror of calendar/page.tsx 7-Column Grid) ── */}
            {activeRoute === "calendar" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex flex-wrap items-center justify-between gap-2 ${hairline}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#191919] text-white flex items-center justify-center">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`text-base font-heading font-bold flex items-center gap-2 ${headingTxt}`}>
                        <span>Content Calendar</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${inputBg}`}>v2.0 Schedule</span>
                      </h3>
                      <p className={`text-[11px] ${mutedTxt}`}>Visual multi-platform staging & token health alerts</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-1 rounded bg-[#DDEDEA] text-[#0F7B6C] font-semibold">Scheduled: 14</span>
                    <span className="px-2 py-1 rounded bg-[#FBF3DB] text-[#9A6700] font-semibold">In Prod: 4</span>
                  </div>
                </div>

                {/* Control Bar (< Today > + November 2026 + Month/Week) */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center border rounded-lg p-0.5 ${cardBg}`}>
                      <span className="p-1"><ChevronLeft className="w-3.5 h-3.5" /></span>
                      <span className="px-2 font-medium text-[11px]">Today</span>
                      <span className="p-1"><ChevronRight className="w-3.5 h-3.5" /></span>
                    </div>
                    <span className={`font-heading font-bold text-sm ${headingTxt}`}>November 2026</span>
                  </div>

                  <div className={`flex items-center border rounded-lg p-0.5 text-[11px] ${recessedBg}`}>
                    <button
                      onClick={() => setCalendarView("month")}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                        calendarView === "month" ? "bg-[#191919] text-white font-semibold" : mutedTxt
                      }`}
                    >
                      <LayoutGrid className="w-3 h-3" /> Month
                    </button>
                    <button
                      onClick={() => setCalendarView("week")}
                      className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                        calendarView === "week" ? "bg-[#191919] text-white font-semibold" : mutedTxt
                      }`}
                    >
                      <Columns className="w-3 h-3" /> Week
                    </button>
                  </div>
                </div>

                {/* 7-Column Calendar Grid matching calendar/page.tsx */}
                <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
                  <div className={`grid grid-cols-7 border-b text-[10px] font-mono text-center py-1.5 ${recessedBg} ${mutedTxt}`}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className={`grid grid-cols-7 divide-x divide-y text-[10px] ${hairline}`}>
                    {[
                      { day: 22, post: null },
                      { day: 23, post: { title: "Teaser Hook", net: "IG", status: "Published" } },
                      { day: 24, post: null },
                      { day: 25, today: true, post: { title: currentClient.carouselTopic, net: "IG", status: "Scheduled" } },
                      { day: 26, post: { title: currentClient.campaignTitle, net: "FB", status: "In Prod" } },
                      { day: 27, post: { title: "Executive Note", net: "LI", status: "Review" } },
                      { day: 28, post: null },
                    ].map((cell) => (
                      <div key={cell.day} className="min-h-[82px] p-1.5 space-y-1">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded font-mono text-[10px] tabular-nums ${
                            cell.today ? "bg-[#191919] text-white font-bold" : mutedTxt
                          }`}
                        >
                          {cell.day}
                        </span>
                        {cell.post && (
                          <div className={`p-1.5 rounded border text-[9px] space-y-0.5 ${recessedBg}`}>
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold">{cell.post.net}</span>
                              <span className="text-[#0F7B6C]">{cell.post.status}</span>
                            </div>
                            <p className={`truncate font-medium ${headingTxt}`}>{cell.post.title}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 10. COMMUNITY INBOX (engagement/page.tsx) ── */}
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

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`flex items-center p-0.5 rounded-lg border text-[11px] ${recessedBg}`}>
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

                  <div className={`flex items-center gap-1 p-0.5 rounded-lg border text-[10px] font-mono ${recessedBg}`}>
                    {["all", "leads", "praise"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setEngagementSentiment(s)}
                        className={`px-2 py-1 rounded capitalize cursor-pointer ${
                          engagementSentiment === s ? "bg-[#191919] text-white" : mutedTxt
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
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

            {/* ── 11. REPORTS & ROI (Exact mirror of reports/page.tsx SVG Charts) ── */}
            {activeRoute === "reports" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b flex items-center justify-between ${hairline}`}>
                  <div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Reports & Agency ROI · {currentClient.name}</h3>
                    <p className={`text-xs ${mutedTxt}`}>Engagement velocity, interaction composition, and peak publishing heatmap.</p>
                  </div>
                  <span className="text-[10px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-2 py-0.5 rounded font-semibold">14 Active Days</span>
                </div>

                {/* Chart 1: Audience Engagement Velocity Line/Area Chart + Chart 2: Interaction Mix Donut */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className={`lg:col-span-7 p-4 rounded-xl border space-y-3 ${cardBg}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-heading font-bold flex items-center gap-1.5 ${headingTxt}`}>
                        <Activity className="w-3.5 h-3.5 text-[#0F7B6C]" />
                        Audience Engagement Velocity
                      </span>
                      <span className="text-[10px] font-mono text-[#0F7B6C] font-semibold">{currentClient.engagementLift} Lift</span>
                    </div>
                    <div className={`h-32 rounded-lg border p-2 flex items-end ${recessedBg}`}>
                      <svg viewBox="0 0 320 90" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0F7B6C" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#0F7B6C" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 72 L 45 58 L 90 64 L 135 42 L 180 46 L 225 26 L 270 32 L 315 12 L 315 90 L 0 90 Z"
                          fill="url(#velGrad)"
                        />
                        <path
                          d="M 0 72 L 45 58 L 90 64 L 135 42 L 180 46 L 225 26 L 270 32 L 315 12"
                          fill="none"
                          stroke="#0F7B6C"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Chart 2: Interaction Mix Donut Chart matching reports/page.tsx line 277 */}
                  <div className={`lg:col-span-5 p-4 rounded-xl border space-y-3 ${cardBg}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-heading font-bold flex items-center gap-1.5 ${headingTxt}`}>
                        <PieChart className="w-3.5 h-3.5 text-[#9A6700]" />
                        Interaction Mix
                      </span>
                      <span className={`text-[10px] font-mono ${mutedTxt}`}>1,420 Total</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90 shrink-0">
                        <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(55,53,47,0.08)" strokeWidth="12" />
                        <circle cx="50" cy="50" r="36" fill="none" stroke="#191919" strokeWidth="12" strokeDasharray="145 226" />
                        <circle cx="50" cy="50" r="36" fill="none" stroke="#0F7B6C" strokeWidth="12" strokeDasharray="55 226" strokeDashoffset="-145" />
                      </svg>
                      <div className="space-y-1.5 text-[10px] font-mono flex-1">
                        <div className="flex justify-between"><span>Likes (64%)</span><span className="font-bold">910</span></div>
                        <div className="flex justify-between text-[#0F7B6C]"><span>Saves (24%)</span><span className="font-bold">342</span></div>
                        <div className="flex justify-between text-[#9A6700]"><span>Comments (12%)</span><span className="font-bold">168</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart 3: Best Day to Publish Heatmap Strip matching reports/page.tsx line 372 */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${cardBg}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-heading font-bold ${headingTxt}`}>Best Day to Publish Heatmap</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] font-semibold">Peak: Friday</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px]">
                    {[
                      ["Sun", 42],
                      ["Mon", 55],
                      ["Tue", 61],
                      ["Wed", 68],
                      ["Thu", 82],
                      ["Fri", 96],
                      ["Sat", 74],
                    ].map(([day, val]) => (
                      <div key={String(day)} className={`p-2 rounded-lg border ${recessedBg}`}>
                        <p className={mutedTxt}>{day}</p>
                        <p className={`font-bold mt-1 tabular-nums ${Number(val) > 90 ? "text-[#0F7B6C]" : headingTxt}`}>{val}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 12. TEAM (Exact mirror of team/page.tsx) ── */}
            {activeRoute === "team" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${hairline}`}>
                  <div>
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${mutedTxt}`}>
                      <span>Organization</span>
                      <span>/</span>
                      <span className="text-[#0F7B6C] font-semibold">Specialist Roster</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Team & Production Specialists</h3>
                  </div>

                  <span className="px-3 py-1.5 rounded-lg bg-[#191919] text-white text-xs font-semibold flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Specialist</span>
                  </span>
                </div>

                {/* 4-Segment Linear Telemetry Strip matching team/page.tsx line 363 */}
                <div className={`rounded-xl border p-3 grid grid-cols-2 sm:grid-cols-4 divide-x ${hairline} ${cardBg}`}>
                  <div>
                    <p className={`text-[9px] font-mono uppercase ${mutedTxt}`}>Total Members</p>
                    <p className={`text-lg font-bold font-mono tabular-nums ${headingTxt}`}>5</p>
                  </div>
                  <div className="px-2.5">
                    <p className={`text-[9px] font-mono uppercase ${mutedTxt}`}>Specialists</p>
                    <p className={`text-lg font-bold font-mono tabular-nums ${headingTxt}`}>3</p>
                  </div>
                  <div className="px-2.5">
                    <p className={`text-[9px] font-mono uppercase ${mutedTxt}`}>Management</p>
                    <p className={`text-lg font-bold font-mono tabular-nums ${headingTxt}`}>2</p>
                  </div>
                  <div className="px-2.5">
                    <p className={`text-[9px] font-mono uppercase ${mutedTxt}`}>Auto-Routing</p>
                    <p className="text-xs font-bold font-mono text-[#0F7B6C] mt-1">ACTIVE</p>
                  </div>
                </div>

                {/* Role Filters */}
                <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                  {[
                    { id: "all", label: "All Members (5)" },
                    { id: "specialists", label: "Specialists (3)" },
                    { id: "management", label: "Management (2)" },
                    { id: "writer", label: "Writers" },
                    { id: "editor", label: "Editors" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTeamRoleFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap ${
                        teamRoleFilter === tab.id ? "bg-[#191919] text-white font-semibold" : `${cardBg} ${mutedTxt}`
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className={`rounded-xl border divide-y text-xs ${cardBg} ${hairline}`}>
                  {teamMembers.map((m) => (
                    <div key={m.email} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                          {m.name.charAt(0)}
                        </span>
                        <div>
                          <p className={`font-semibold ${headingTxt}`}>{m.name}</p>
                          <p className={`text-[10px] font-mono ${mutedTxt}`}>{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono ${mutedTxt} tabular-nums`}>{m.tasks} active tasks</span>
                        <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                          {m.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 13. BILLING & CREDITS (Exact mirror of billing/page.tsx) ── */}
            {activeRoute === "billing" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`pb-3 border-b ${hairline}`}>
                  <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Billing & Computational Credits</h3>
                  <p className={`text-xs ${mutedTxt}`}>Base plan credits, unlimited seats, and flat rollover top-up packs.</p>
                </div>

                {/* 3 Overview Cards matching billing/page.tsx lines 110-204 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className={`p-4 rounded-xl border space-y-2 ${cardBg}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${mutedTxt}`}>Available Credits</span>
                      <span className="font-mono text-[#0F7B6C] font-semibold tabular-nums">38.2k / 50k</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
                      <div className="w-[76%] h-full bg-[#191919] rounded-full" />
                    </div>
                    <p className={`text-[10px] font-mono ${mutedTxt}`}>~480 credits/day · 24d runway</p>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-1.5 ${cardBg}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${mutedTxt}`}>Subscription</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[9px] font-bold">Base Plan</span>
                    </div>
                    <p className={`text-base font-heading font-bold ${headingTxt}`}>$50 / month</p>
                    <p className={`text-[10px] font-mono ${mutedTxt}`}>Next cycle: Dec 1, 2026</p>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-1.5 ${cardBg}`}>
                    <span className={`text-[11px] font-semibold ${mutedTxt}`}>Staff Seat Capacity</span>
                    <p className={`text-base font-heading font-bold ${headingTxt}`}>Unlimited Seats</p>
                    <p className="text-[10px] font-mono text-[#0F7B6C] font-semibold">$0 per additional user</p>
                  </div>
                </div>

                {/* Instant Rollover Top-Up Packs matching billing/page.tsx line 207 */}
                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className={`font-heading font-bold ${headingTxt}`}>Instant Rollover Credit Packs ($1 / 1k Flat)</p>
                      <p className={`text-[10px] ${mutedTxt}`}>Roll over indefinitely without month-end expiration.</p>
                    </div>
                    <button
                      onClick={() => setAutoRecharge(!autoRecharge)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono cursor-pointer ${
                        autoRecharge ? "bg-[#DDEDEA] text-[#0F7B6C] border-[#0F7B6C]/30" : `${recessedBg} ${mutedTxt}`
                      }`}
                    >
                      Auto-Recharge: {autoRecharge ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    {[
                      { credits: 10000, price: "$10", desc: "Light campaign burst" },
                      { credits: 25000, price: "$25", desc: "Multi-brand launch sprint" },
                      { credits: 50000, price: "$50", desc: "Full retainer month expansion" },
                    ].map((pack) => (
                      <button
                        key={pack.credits}
                        onClick={() => {
                          setSelectedTopUp(pack.credits);
                          setTopUpSuccess(true);
                          setTimeout(() => setTopUpSuccess(false), 2000);
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          selectedTopUp === pack.credits ? "border-[#191919] ring-1 ring-[#191919]/15" : ""
                        } ${recessedBg}`}
                      >
                        <p className={`font-heading font-bold ${headingTxt}`}>+{pack.credits.toLocaleString()} Credits</p>
                        <p className="font-mono text-sm font-bold text-[#0F7B6C] mt-0.5 tabular-nums">{pack.price}</p>
                        <p className={`text-[10px] mt-1 ${mutedTxt}`}>{pack.desc}</p>
                      </button>
                    ))}
                  </div>
                  {topUpSuccess && (
                    <p className="text-[11px] font-mono text-[#0F7B6C]">
                      ✓ Simulated +{selectedTopUp.toLocaleString()} rollover pack previewed.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── 14. SETTINGS (Exact mirror of settings/page.tsx) ── */}
            {activeRoute === "settings" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${hairline}`}>
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-mono mb-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] font-bold uppercase">Administration</span>
                      <span className={mutedTxt}>Global Configuration</span>
                    </div>
                    <h3 className={`text-lg font-heading font-bold ${headingTxt}`}>Workspace Settings</h3>
                  </div>

                  <button
                    onClick={() => {
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 2500);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#191919] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{settingsSaved ? "✓ Saved Settings" : "Save Settings"}</span>
                  </button>
                </div>

                {/* Agency Identity & AI Pipeline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={`p-4 rounded-xl border space-y-2 ${cardBg}`}>
                    <p className={`font-heading font-bold flex items-center gap-1.5 ${headingTxt}`}>
                      <Building2 className="w-3.5 h-3.5 text-[#0F7B6C]" />
                      Agency Identity & Region
                    </p>
                    <div className={`p-2 rounded-lg border font-mono text-[11px] ${recessedBg}`}>Brieva Studio · USD ($) · UTC</div>
                    <p className="text-[10px] font-mono text-[#0F7B6C] font-semibold">Strict Multi-Tenant Row Security (Active)</p>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-2 ${cardBg}`}>
                    <p className={`font-heading font-bold flex items-center gap-1.5 ${headingTxt}`}>
                      <Cpu className="w-3.5 h-3.5 text-[#0F7B6C]" />
                      AI Pipeline & Compliance Gate
                    </p>
                    <div className={`p-2 rounded-lg border font-mono text-[11px] ${recessedBg}`}>Flagship Strategist Routing</div>
                    <p className="text-[10px] font-mono text-[#0F7B6C] font-semibold">Deterministic Clean Formatting (Active)</p>
                  </div>
                </div>

                {/* Cortex Compliance Toggles matching settings/page.tsx line 217 */}
                <div className={`p-4 rounded-xl border space-y-3 text-xs ${cardBg}`}>
                  <p className={`font-heading font-bold flex items-center gap-1.5 ${headingTxt}`}>
                    <ShieldAlert className="w-3.5 h-3.5 text-[#9A6700]" />
                    Cortex Memory & Brand Compliance Guardrails
                  </p>

                  <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${recessedBg}`}>
                    <div>
                      <p className={`font-semibold ${headingTxt}`}>Deterministic Negative Taboo Pre-Check</p>
                      <p className={`text-[10px] ${mutedTxt}`}>Rejects prohibited claims automatically before client review.</p>
                    </div>
                    <button
                      onClick={() => setStrictTaboos(!strictTaboos)}
                      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                        strictTaboos ? "bg-[#0F7B6C]" : "bg-black/20"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${strictTaboos ? "left-4.5" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${recessedBg}`}>
                    <div>
                      <p className={`font-semibold ${headingTxt}`}>Proactive Flagging on Task Submission</p>
                      <p className={`text-[10px] ${mutedTxt}`}>Alerts specialists in real time when assets contain unverified terms.</p>
                    </div>
                    <button
                      onClick={() => setProactiveFlagging(!proactiveFlagging)}
                      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                        proactiveFlagging ? "bg-[#0F7B6C]" : "bg-black/20"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${proactiveFlagging ? "left-4.5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
