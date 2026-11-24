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
  ChevronDown,
} from "lucide-react";
import { TeleprompterPreview, TeleprompterClientKey } from "./TeleprompterPreview";

type WorkspaceRoute =
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
}

const NAV_GROUPS: {
  tier: string;
  items: { id: WorkspaceRoute; label: string; icon: "dashboard" | "workspace" | "clients" | "cortex" | "tasks" | "approvals" | "studio" | "plans" | "calendar" | "inbox" | "reports" | "team" | "billing" | "settings" }[];
}[] = [
  {
    tier: "WORKSPACE",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "workspace", label: "My Workspace", icon: "workspace" },
    ],
  },
  {
    tier: "OPERATIONS",
    items: [
      { id: "clients", label: "Clients", icon: "clients" },
      { id: "cortex", label: "Cortex Memory", icon: "cortex" },
      { id: "tasks", label: "Tasks", icon: "tasks" },
      { id: "approvals", label: "Approvals", icon: "approvals" },
    ],
  },
  {
    tier: "CAMPAIGN PIPELINE",
    items: [
      { id: "studio", label: "Campaign Studio", icon: "studio" },
      { id: "plans", label: "Campaign Plans", icon: "plans" },
      { id: "calendar", label: "Content Calendar", icon: "calendar" },
    ],
  },
  {
    tier: "ENGAGEMENT & ROI",
    items: [
      { id: "inbox", label: "Community Inbox", icon: "inbox" },
      { id: "reports", label: "Reports & ROI", icon: "reports" },
    ],
  },
  {
    tier: "ADMIN",
    items: [
      { id: "team", label: "Team", icon: "team" },
      { id: "billing", label: "Billing & Credits", icon: "billing" },
      { id: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

export function InteractiveWorkspace({
  externalRoute,
  externalClient,
}: InteractiveWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [4, 0]);

  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("dashboard");
  const [selectedClient, setSelectedClient] = useState<ClientKey>("solis");
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");
  const [cortexQueueCount, setCortexQueueCount] = useState<number>(3);
  const [studioTab, setStudioTab] = useState<"carousel" | "teleprompter">("carousel");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");
  const [copiedLink, setCopiedLink] = useState(false);
  const [replyPublished, setReplyPublished] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>({
    c1: true,
    c2: false,
    c3: false,
  });

  useEffect(() => {
    if (externalRoute) {
      setActiveRoute(externalRoute);
    }
  }, [externalRoute]);

  useEffect(() => {
    if (externalClient) {
      setSelectedClient(externalClient);
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
      activeBrands: "8 Retainers",
      scheduledPosts: "32 Scheduled",
      complianceScore: "100%",
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
        { day: "Thu · 18:00", net: "Instagram", title: "Truffle Hearth Teaser Reel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Fri · 12:00", net: "Instagram", title: "Handmade Burrata 5-Slide Carousel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Sat · 10:00", net: "LinkedIn", title: "Executive Chef Seasonal Essay", tag: "bg-[#F3F1EC] text-[#6B6A65]" },
        { day: "Sun · 16:00", net: "Facebook", title: "Sunday Supper Cellar Pairings", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
      ],
    },
    linden: {
      initial: "L",
      name: "Linden & Clay",
      industry: "D2C Botanical Skincare",
      activeBrands: "6 Retainers",
      scheduledPosts: "24 Scheduled",
      complianceScore: "100%",
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
          rationale: "Maintains calm Nordic-inspired visual restraint across social feeds.",
          provenance: "Art Direction Spec: Leave generous linen margin around serif overlays.",
        },
      ],
      schedule: [
        { day: "Thu · 17:30", net: "Instagram", title: "3-Drop Morning Ritual Reel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Fri · 11:00", net: "Instagram", title: "Squalane Lipid Barrier Carousel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Sat · 09:30", net: "LinkedIn", title: "Amber Glass Refill Engineering", tag: "bg-[#F3F1EC] text-[#6B6A65]" },
        { day: "Sun · 18:00", net: "Facebook", title: "Batch 09 Apothecary Restock Alert", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
      ],
    },
    cairn: {
      initial: "C",
      name: "Cairn Roasters",
      industry: "Specialty Micro-Lot Coffee",
      activeBrands: "4 Retainers",
      scheduledPosts: "20 Scheduled",
      complianceScore: "100%",
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
      inboundComment: "Do you offer a whole-bean bi-weekly cadence for commercial La Marzocco bars?",
      draftReply: "We do. Cairn wholesale partners receive dialed-in single-origin drums roasted to order every Tuesday morning. Our roastery coordinator just sent wholesale minimums to your inbox.",
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
        { day: "Thu · 08:30", net: "Instagram", title: "93C Bloom Extraction Acoustic Reel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Fri · 09:00", net: "Instagram", title: "1,900m Cooperative Story Carousel", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
        { day: "Sat · 11:00", net: "LinkedIn", title: "Direct-Trade Farm Margin Report", tag: "bg-[#F3F1EC] text-[#6B6A65]" },
        { day: "Sun · 14:00", net: "Facebook", title: "Tuesday Roast Drum Pre-Order Window", tag: "bg-[#DDEDEA] text-[#0F7B6C]" },
      ],
    },
  };

  const currentClient = clientData[selectedClient];

  const renderIcon = (icon: string, isActive: boolean) => {
    const cls = "w-3.5 h-3.5 shrink-0";
    switch (icon) {
      case "dashboard":
        return <LayoutDashboard className={`${cls} text-[#111114]`} />;
      case "workspace":
        return <Briefcase className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "clients":
        return <Users className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "cortex":
        return <Brain className={`${cls} text-[#111114]`} />;
      case "tasks":
        return <CheckSquare className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "approvals":
        return <FileCheck2 className={`${cls} text-[#9A6700]`} />;
      case "studio":
        return <Sparkles className={`${cls} text-[#9A6700]`} />;
      case "plans":
        return <Layers className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "calendar":
        return <CalendarDays className={`${cls} text-[#0F7B6C]`} />;
      case "inbox":
        return <MessagesSquare className={`${cls} text-[#0F7B6C]`} />;
      case "reports":
        return <BarChart3 className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "team":
        return <UserCheck className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
      case "billing":
        return <CreditCard className={`${cls} text-[#111114]`} />;
      default:
        return <Settings className={`${cls} ${isActive ? "text-[#111114]" : "text-[#6B6A65]"}`} />;
    }
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* Main Window Frame with Live Scroll-Driven Perspective Flatten */}
      <motion.div
        style={{ rotateX, transformPerspective: 1200 }}
        className="bg-[#FFFFFF] rounded-2xl border border-[#EAE7DF] shadow-[0_24px_60px_-15px_rgba(17,17,20,0.12)] overflow-hidden flex flex-col md:flex-row min-h-[640px]"
      >
        {/* Mobile Client Bar + Horizontal Scrollable Route Rail (< md) */}
        <div className="md:hidden border-b border-[#EAE7DF] bg-[#FAF9F6]">
          <div className="p-3 flex items-center justify-between border-b border-[#EAE7DF]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold">
                {currentClient.initial}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111114]">{currentClient.name}</p>
                <p className="text-[10px] font-mono text-[#6B6A65]">{currentClient.industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedClient(key)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                    selectedClient === key
                      ? "bg-[#111114] text-white font-semibold"
                      : "bg-[#FFFFFF] border border-[#EAE7DF] text-[#6B6A65]"
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
                className={`px-2.5 py-1 rounded-md whitespace-nowrap text-[11px] font-medium transition-colors ${
                  activeRoute === item.id
                    ? "bg-[#111114] text-white"
                    : "bg-[#FFFFFF] border border-[#EAE7DF] text-[#6B6A65]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Left Sidebar (Exact 5-Tier Architecture) */}
        <div className="hidden md:flex w-64 bg-[#FAF9F6] border-r border-[#EAE7DF] flex-col shrink-0">
          {/* Client Retainer Switcher Header */}
          <div className="p-3.5 border-b border-[#EAE7DF] relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {currentClient.initial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111114] truncate font-sans">
                    {currentClient.name}
                  </p>
                  <p className="text-[10px] text-[#6B6A65] font-mono truncate">
                    {currentClient.industry}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setClientMenuOpen(!clientMenuOpen)}
                className="p-1 rounded-md border border-[#EAE7DF] bg-[#FFFFFF] hover:bg-[#F3F1EC] text-[#6B6A65] transition-colors cursor-pointer"
                title="Switch Client Retainer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {clientMenuOpen && (
              <div className="absolute top-full left-2 right-2 mt-1 z-30 bg-[#FFFFFF] rounded-xl border border-[#EAE7DF] shadow-lg p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-mono text-[#8C8A84] uppercase tracking-wider">
                  Switch Client Retainer
                </div>
                {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => {
                  const item = clientData[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedClient(key);
                        setClientMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        selectedClient === key
                          ? "bg-[#111114] text-white font-medium"
                          : "text-[#111114] hover:bg-[#FAF9F6]"
                      }`}
                    >
                      <div>
                        <div className="font-sans font-medium text-xs">{item.name}</div>
                        <div className={`text-[10px] ${selectedClient === key ? "text-white/70" : "text-[#6B6A65]"}`}>
                          {item.industry}
                        </div>
                      </div>
                      {selectedClient === key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5-Tier Navigation with Framer Motion Spring Pills */}
          <nav className="p-2 space-y-3.5 flex-1 overflow-y-auto text-xs">
            {NAV_GROUPS.map((group) => (
              <div key={group.tier} className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  {group.tier}
                </p>
                {group.items.map((item) => {
                  const isActive = activeRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveRoute(item.id)}
                      className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        isActive ? "text-[#111114] font-semibold" : "text-[#6B6A65] hover:bg-white/60"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-indicator"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        {renderIcon(item.icon, isActive)}
                        <span>{item.label}</span>
                      </span>

                      {item.id === "cortex" && (
                        <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold tabular-nums">
                          {cortexQueueCount}
                        </span>
                      )}
                      {item.id === "tasks" && (
                        <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#F3F1EC] text-[#6B6A65] text-[9px] font-mono font-bold tabular-nums">
                          19
                        </span>
                      )}
                      {item.id === "approvals" && (
                        <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold tabular-nums">
                          2
                        </span>
                      )}
                      {item.id === "studio" && (
                        <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold">
                          AI
                        </span>
                      )}
                      {item.id === "inbox" && (
                        <span className="relative z-10 flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[9px] font-mono font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                          Live
                        </span>
                      )}
                      {item.id === "billing" && (
                        <span className="relative z-10 text-[9px] font-mono text-[#6B6A65] tabular-nums">
                          38k / 50k
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Right Active Screen Area */}
        <div className="flex-1 bg-[#FFFFFF] p-6 overflow-y-auto">
          {/* 1. DASHBOARD */}
          {activeRoute === "dashboard" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-sm font-heading font-semibold text-[#111114]">
                      {currentClient.name} Pulse Dashboard
                    </h3>
                    <p className="text-xs text-[#6B6A65] font-sans">
                      Retainer health, upcoming deliverables, and deterministic compliance verification.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1 mr-1">
                    {currentClient.swatches.map((hex) => (
                      <span
                        key={hex}
                        className="w-3 h-3 rounded-full border border-[#EAE7DF]"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                    All Systems Live
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Retainer Scope</span>
                  <p className="text-2xl font-bold text-[#111114] font-mono tabular-nums">{currentClient.activeBrands}</p>
                  <p className="text-[11px] text-[#0F7B6C] font-mono font-medium">100% Delivery SLA</p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Publishing Queue</span>
                  <p className="text-2xl font-bold text-[#111114] font-mono tabular-nums">{currentClient.scheduledPosts}</p>
                  <p className="text-[11px] text-[#6B6A65] font-mono">Instagram · FB · LinkedIn</p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Compliance Pass Rate</span>
                  <p className="text-2xl font-bold text-[#0F7B6C] font-mono tabular-nums">{currentClient.complianceScore}</p>
                  <p className="text-[11px] text-[#0F7B6C] font-mono font-medium">0 Brand Drift Incidents</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                  Active Deliverables · {currentClient.name}
                </h4>
                <div className="rounded-xl border border-[#EAE7DF] divide-y divide-[#EAE7DF] overflow-hidden text-xs">
                  <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={currentClient.image}
                        alt={currentClient.name}
                        className="w-10 h-10 rounded-md object-cover border border-[#EAE7DF]"
                      />
                      <div>
                        <p className="font-semibold text-[#111114] font-sans">{currentClient.deliverable}</p>
                        <p className="text-[11px] text-[#6B6A65] font-sans">Multi-Slide Carousel · Awaiting Client Sign-off</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-medium tabular-nums">
                      Magic-Link Active
                    </span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                    <div>
                      <p className="font-semibold text-[#111114] font-sans">{currentClient.campaignTitle}</p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">Viral Reel Teleprompter Cut · Director Notes Ready</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                      Approved
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CORTEX MEMORY */}
          {activeRoute === "cortex" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#EAE7DF] gap-2">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    {currentClient.name} — Living Brand Vault
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Institutional memory rules enforced deterministically on every AI generation run.
                  </p>
                </div>

                <div className="flex items-center bg-[#F3F1EC] rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setCortexViewMode("cards")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      cortexViewMode === "cards" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                    }`}
                  >
                    Cards View
                  </button>
                  <button
                    onClick={() => setCortexViewMode("document")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      cortexViewMode === "document" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                    }`}
                  >
                    Clean Document
                  </button>
                </div>
              </div>

              {cortexQueueCount > 0 && (
                <div className="p-3.5 rounded-xl bg-[#FBF3DB]/70 border border-[#9A6700]/30 flex items-start justify-between gap-3 text-xs shadow-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#9A6700] flex items-center gap-1.5 text-[11px] font-sans">
                      <AlertCircle className="w-3.5 h-3.5 text-[#9A6700]" />
                      Pending Memory Review ({cortexQueueCount} items extracted from uploaded brief):
                    </p>
                    <p className="text-[#6B6A65] text-[11px] font-sans">
                      Extracted Rule: &quot;{currentClient.pendingRule}&quot;
                    </p>
                    <p className="text-[10px] text-[#8C8A84] font-mono">
                      {currentClient.pendingDoc}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCortexQueueCount((prev) => Math.max(0, prev - 1))}
                      className="px-2.5 py-1 rounded-lg bg-[#111114] text-white text-[10px] font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer font-sans"
                    >
                      Approve to Vault
                    </button>
                    <button
                      onClick={() => setCortexQueueCount((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-1 rounded-lg text-[#6B6A65] hover:text-[#111114] text-[10px] transition-colors cursor-pointer font-sans"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {cortexViewMode === "cards" ? (
                <div className="space-y-3">
                  {currentClient.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border bg-[#FAF9F6] space-y-1.5 text-xs ${
                        rule.id.startsWith("TABOO") ? "border-red-200" : "border-[#EAE7DF]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            rule.id.startsWith("TABOO")
                              ? "bg-red-50 text-[#C93B2B]"
                              : "bg-[#DDEDEA] text-[#0F7B6C]"
                          }`}
                        >
                          {rule.type}
                        </span>
                        <span className="text-[10px] font-mono text-[#8C8A84] tabular-nums">{rule.id}</span>
                      </div>
                      <p className="font-semibold text-[#111114] font-sans">{rule.title}</p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">
                        <span className="font-medium text-[#111114]">Rationale:</span> {rule.rationale}
                      </p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">
                        <span className="font-medium text-[#111114]">Provenance:</span> &quot;{rule.provenance}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-4 text-xs font-mono leading-relaxed">
                  <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                    <span className="text-[#8C8A84]">{currentClient.name.toUpperCase()} BRAND RULES SPECIFICATION</span>
                    <span className="text-[#0F7B6C]">DETERMINISTIC COMPLIANCE LEVEL: STRICT</span>
                  </div>
                  {currentClient.rules.map((rule) => (
                    <div key={rule.id} className="space-y-1">
                      <p className="text-[#111114] font-bold">[{rule.id}] {rule.title}</p>
                      <p className="text-[#6B6A65] pl-4">&gt; Scope: {rule.type}</p>
                      <p className="text-[#6B6A65] pl-4">&gt; Provenance: {rule.provenance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. CAMPAIGN STUDIO */}
          {activeRoute === "studio" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#EAE7DF] gap-2">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    {currentClient.name} — Campaign Studio
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    6 specialized agents collaborating deterministically on brand briefs.
                  </p>
                </div>

                <div className="flex items-center bg-[#F3F1EC] rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setStudioTab("carousel")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      studioTab === "carousel" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                    }`}
                  >
                    Tab A · 5-Slide Carousel
                  </button>
                  <button
                    onClick={() => setStudioTab("teleprompter")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      studioTab === "teleprompter" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                    }`}
                  >
                    Tab B · Viral Teleprompter
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2">
                <span className="text-[10px] font-mono text-[#8C8A84] uppercase tracking-wider">
                  Active Multi-Agent Swarm (6 Agents):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px] font-medium font-sans">
                  {[
                    ["Strategy", "Brief Synced"],
                    ["Content", "Copy Written"],
                    ["Compliance", "Rules Verified"],
                    ["Publishing", "Ready to Post"],
                    ["Analytics", "Pacing Tracked"],
                    ["Orchestrator", "Locked"],
                  ].map(([role, status]) => (
                    <div key={role} className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">{role}</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">{status}</p>
                    </div>
                  ))}
                </div>
              </div>

              {studioTab === "carousel" ? (
                <div className="p-5 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#111114] font-sans">
                        Slide 1 of 5 · 4:5 Portrait Cover
                      </span>
                      <div className="flex items-center gap-1">
                        {currentClient.swatches.map((hex) => (
                          <span
                            key={hex}
                            className="w-3 h-3 rounded-full border border-[#EAE7DF]"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                      Deterministic Compliance Passed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-[#EAE7DF]">
                    <div className="sm:col-span-5 relative aspect-[4/5] max-h-48 w-full rounded-lg overflow-hidden border border-[#EAE7DF]">
                      <img
                        src={currentClient.image}
                        alt={currentClient.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#111114]/80 text-white font-mono text-[9px] backdrop-blur-xs">
                        4:5 SAFE ZONE
                      </div>
                    </div>
                    <div className="sm:col-span-7 space-y-2.5 text-left">
                      <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#EAE7DF] text-[10px] font-mono text-[#6B6A65]">
                        {currentClient.name} · Instagram Carousel
                      </span>
                      <h4 className="text-base font-heading font-semibold text-[#111114] leading-snug">
                        {currentClient.carouselTopic}
                      </h4>
                      <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                        Crafted from approved brand palette and verified deterministically against {currentClient.rules[0].id} and {currentClient.rules[1].id}.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <TeleprompterPreview clientKey={selectedClient} theme="light" />
              )}
            </div>
          )}

          {/* 4. CAMPAIGN PLANS */}
          {activeRoute === "plans" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF]">
                <h3 className="text-sm font-heading font-semibold text-[#111114]">
                  {currentClient.name} — Phased Campaign Plan
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans">
                  Campaign Studio deliverables structured into weekly execution phases.
                </p>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114] font-sans">Phase 1: Teaser & Organic Hook</span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">Scheduled</span>
                  </div>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    3 vertical reels featuring behind-the-scenes craft + 1 educational carousel for {currentClient.name}.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114] font-sans">Phase 2: Launch & Community Conversion</span>
                    <span className="text-[10px] font-mono text-[#9A6700] bg-[#FBF3DB] px-2 py-0.5 rounded">In Review</span>
                  </div>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Multi-slide hero drop carousel + Founder engineering story + concierge community replies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. TASKS */}
          {activeRoute === "tasks" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    Dependency-Locked Production Board
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Downstream tasks remain locked until upstream brand approvals clear.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#6B6A65] tabular-nums">19 Active Tasks</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114]">1. In Production</span>
                    <Unlock className="w-3.5 h-3.5 text-[#0F7B6C]" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-[#EAE7DF] text-[11px] space-y-1">
                    <p className="font-semibold text-[#111114]">{currentClient.carouselTopic}</p>
                    <span className="text-[9px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-1.5 py-0.2 rounded">Unlocked</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114]">2. Client Sign-off</span>
                    <Unlock className="w-3.5 h-3.5 text-[#9A6700]" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-[#EAE7DF] text-[11px] space-y-1">
                    <p className="font-semibold text-[#111114]">{currentClient.deliverable}</p>
                    <span className="text-[9px] font-mono text-[#9A6700] bg-[#FBF3DB] px-1.5 py-0.2 rounded">Magic-Link Sent</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2 opacity-85">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114]">3. Social Dispatch</span>
                    <Lock className="w-3.5 h-3.5 text-[#8C8A84]" />
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/70 border border-dashed border-[#EAE7DF] text-[11px] space-y-1">
                    <p className="font-semibold text-[#6B6A65]">Publish to Instagram & Facebook</p>
                    <span className="text-[9px] font-mono text-[#8C8A84] bg-[#F3F1EC] px-1.5 py-0.2 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked by Upstream
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. APPROVALS */}
          {activeRoute === "approvals" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    Magic-Link Review Room Generator
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Zero-friction mobile review links with tokenized 72-hour access and instant sign-off.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#9A6700] bg-[#FBF3DB] px-2 py-0.5 rounded tabular-nums">
                  2 Pending Review
                </span>
              </div>

              <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-xs text-[#111114] font-sans">{currentClient.deliverable}</p>
                    <p className="text-[11px] text-[#6B6A65] font-mono">Token: agencyos.app/review/rk_9482bf0e</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg border border-[#EAE7DF] bg-white hover:bg-[#F3F1EC] text-[#111114] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-sans"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#6B6A65]" />
                    <span>{copiedLink ? "✓ Copied Magic Link" : "Copy Magic Link"}</span>
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-white border border-[#EAE7DF] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-[#8C8A84] uppercase">Mobile Client Status:</span>
                    <p className="font-medium text-[#111114] font-sans">
                      {approvalStatus === "approved" ? "✓ Approved by Client (SHA-256 Signed)" : "Awaiting Client Review"}
                    </p>
                  </div>
                  <button
                    onClick={() => setApprovalStatus(approvalStatus === "pending" ? "approved" : "pending")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
                      approvalStatus === "approved"
                        ? "bg-[#DDEDEA] text-[#0F7B6C] border border-[#0F7B6C]/30"
                        : "bg-[#111114] text-white hover:bg-[#2F2E2B] shadow-xs"
                    }`}
                  >
                    {approvalStatus === "approved" ? "✓ Approved & Locked" : "Click to Simulate Client Approval"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. CONTENT CALENDAR */}
          {activeRoute === "calendar" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    {currentClient.name} — Omnichannel Schedule
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Direct publishing to Instagram, Facebook, and LinkedIn with proactive token health alerts.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                  All Connections Healthy · 72h Token Alert
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {currentClient.schedule.map((slot) => (
                  <div key={slot.day} className="p-3 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <span className="font-mono text-[10px] text-[#6B6A65] tabular-nums">{slot.day}</span>
                    <div className="p-2.5 rounded bg-white border border-[#EAE7DF] space-y-1.5">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded inline-block ${slot.tag}`}>
                        {slot.net}
                      </span>
                      <p className="font-semibold text-[11px] text-[#111114] leading-snug">{slot.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. COMMUNITY INBOX */}
          {activeRoute === "inbox" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    Community CRM & Buying-Intent Triage
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Inbound comments scored for buying intent with brand-rule verified replies.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                  Live Webhook Listener
                </span>
              </div>

              <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#0F7B6C] text-[10px] font-mono font-semibold tabular-nums">
                    High-Intent Lead · 94/100
                  </span>
                  <span className="text-[10px] font-mono text-[#8C8A84]">Instagram Comment · 4m ago</span>
                </div>
                <p className="font-semibold text-[#111114] font-sans">
                  &quot;{currentClient.inboundComment}&quot;
                </p>
                <div className="p-3 rounded-lg bg-white border border-[#EAE7DF] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1 font-semibold">
                      <Check className="w-3 h-3 text-[#0F7B6C]" /> Cortex Verified Draft Reply:
                    </span>
                    <span className="text-[10px] font-mono text-[#8C8A84]">Enforces Rules</span>
                  </div>
                  <p className="text-[#6B6A65] leading-relaxed font-sans">
                    &quot;{currentClient.draftReply}&quot;
                  </p>
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={() => setReplyPublished(!replyPublished)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer font-sans ${
                        replyPublished ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                      }`}
                    >
                      {replyPublished ? "✓ Published to Instagram" : "1-Click Publish Reply"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9. BILLING & CREDITS */}
          {activeRoute === "billing" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF]">
                <h3 className="text-sm font-heading font-semibold text-[#111114]">
                  Billing & Computational Credit Economics
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans">
                  Unlimited team seats on every plan. Pay only for computational machine execution.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111114] font-sans">Monthly Shared Credits</span>
                  <span className="font-mono text-[#6B6A65] tabular-nums">38,200 / 50,000 used</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#EAE7DF] overflow-hidden">
                  <div className="w-[76%] h-full bg-[#111114] rounded-full" />
                </div>
                <p className="text-[11px] text-[#6B6A65] font-sans">
                  Top-ups available at $1 per 1,000 credits flat rate with zero markup. Credits roll over indefinitely.
                </p>
              </div>
            </div>
          )}

          {/* 10. MY WORKSPACE (Interactive Specialist Checklist) */}
          {activeRoute === "workspace" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    My Workspace · {currentClient.name} Queue
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">Personal deliverables and review items awaiting action.</p>
                </div>
                <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">On Schedule</span>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { id: "c1", task: `Verify ${currentClient.rules[0].id} across Q4 brief`, meta: "Compliance" },
                  { id: "c2", task: `Send Magic-Link review room for ${currentClient.deliverable}`, meta: "Due Today" },
                  { id: "c3", task: `Confirm WPM pace lock on ${currentClient.campaignTitle} script`, meta: "Teleprompter" },
                ].map((row) => (
                  <button
                    key={row.id}
                    onClick={() =>
                      setCompletedChecklist((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                    }
                    className="w-full p-3.5 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] hover:bg-[#F3F1EC] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          completedChecklist[row.id]
                            ? "bg-[#0F7B6C] border-[#0F7B6C] text-white"
                            : "bg-white border-[#EAE7DF]"
                        }`}
                      >
                        {completedChecklist[row.id] && <Check className="w-3 h-3" />}
                      </div>
                      <span className={completedChecklist[row.id] ? "line-through text-[#8C8A84]" : "font-medium text-[#111114]"}>
                        {row.task}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B6A65]">{row.meta}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 11. CLIENTS (All 3 Interactive Client Cards with Real Assets) */}
          {activeRoute === "clients" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF]">
                <h3 className="text-sm font-heading font-semibold text-[#111114]">Client Retainer Fleet</h3>
                <p className="text-xs text-[#6B6A65] font-sans">Select any client retainer to dynamically switch workspace rules and creative assets.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["solis", "linden", "cairn"] as ClientKey[]).map((key) => {
                  const item = clientData[key];
                  const active = selectedClient === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedClient(key)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all space-y-3 ${
                        active ? "bg-[#FFFFFF] border-[#111114] shadow-sm" : "bg-[#FAF9F6] border-[#EAE7DF] hover:bg-[#FFFFFF]"
                      }`}
                    >
                      <div className="aspect-[16/10] rounded-lg overflow-hidden border border-[#EAE7DF]">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-[#111114] font-heading">{item.name}</p>
                        <p className="text-[11px] text-[#6B6A65] font-sans">{item.industry}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#0F7B6C]">{item.activeBrands}</span>
                        <div className="flex gap-1">
                          {item.swatches.map((hex) => (
                            <span
                              key={hex}
                              className="w-2.5 h-2.5 rounded-full border border-[#EAE7DF]"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 12. REPORTS & ROI */}
          {activeRoute === "reports" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-[#111114]">
                    Reports & Agency ROI · {currentClient.name}
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans">Client engagement lift, save velocity, and production hours saved.</p>
                </div>
                <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">90-Day Audit</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono text-[#6B6A65] uppercase">Organic Reach Lift</span>
                  <p className="text-2xl font-bold font-mono text-[#0F7B6C] tabular-nums">{currentClient.engagementLift}</p>
                  <p className="text-[11px] text-[#6B6A65]">vs. pre-vault baseline</p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono text-[#6B6A65] uppercase">Carousel Save Rate</span>
                  <p className="text-2xl font-bold font-mono text-[#111114] tabular-nums">{currentClient.saveRate}</p>
                  <p className="text-[11px] text-[#6B6A65]">Top-decile organic signal</p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                  <span className="text-[10px] font-mono text-[#6B6A65] uppercase">Specialist Hours Saved</span>
                  <p className="text-2xl font-bold font-mono text-[#9A6700] tabular-nums">{currentClient.hoursReclaimed}</p>
                  <p className="text-[11px] text-[#6B6A65]">Monthly cycle reclaimed</p>
                </div>
              </div>
            </div>
          )}

          {/* 13. TEAM & SETTINGS */}
          {(activeRoute === "team" || activeRoute === "settings") && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 animate-in fade-in duration-150">
              <div className="w-10 h-10 rounded-full bg-[#FAF9F6] border border-[#EAE7DF] flex items-center justify-center text-[#6B6A65]">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm text-[#111114] font-heading">
                  Protected Admin Tier (Available inside live workspace)
                </p>
                <p className="text-xs text-[#6B6A65] max-w-sm font-sans">
                  Tenant isolation and Role-Based Access Control protect agency billing margins from external freelancers and clients.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
