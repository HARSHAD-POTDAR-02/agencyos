"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
  Send,
  Eye,
  Plus,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
  ArrowRight,
  Sliders,
  Copy,
  ChevronDown,
} from "lucide-react";
import { TeleprompterPreview } from "./TeleprompterPreview";

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

type ClientKey = "one8" | "kaya";

interface InteractiveWorkspaceProps {
  externalRoute?: WorkspaceRoute;
  externalClient?: ClientKey;
}

export function InteractiveWorkspace({
  externalRoute,
  externalClient,
}: InteractiveWorkspaceProps) {
  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("dashboard");
  const [selectedClient, setSelectedClient] = useState<ClientKey>("one8");
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");
  const [cortexQueueCount, setCortexQueueCount] = useState<number>(3);
  const [studioTab, setStudioTab] = useState<"carousel" | "teleprompter">("carousel");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");
  const [copiedLink, setCopiedLink] = useState(false);
  const [replyPublished, setReplyPublished] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);

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
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const clientData = {
    one8: {
      name: "One8 Commune",
      industry: "Hospitality & Dining",
      activeBrands: "8 Retainers",
      scheduledPosts: "32 Posts Scheduled",
      complianceScore: "100%",
      campaignTitle: "Summer Truffle & Craft Cocktail Launch",
      carouselTopic: "Signature Handmade Burrata & Winter Truffle Gnocchi",
      pendingRule: "Never offer percentage discounts on signature sourdough pizza or chef tasting menus.",
      pendingDoc: "Extracted from Summer Truffle Tasting Menu PDF (p. 4)",
      rules: [
        {
          id: "TABOO-01",
          type: "Negative Taboo (Hard Boundary)",
          title: "Never make unverified health or therapeutic benefit claims.",
          rationale: "Dining brand positioning must focus on culinary sensory experience, not medicine.",
          provenance: "We do not claim our elixirs cure ailments. Frame them around hospitality craft only. (Client VP)",
        },
        {
          id: "RULE-04",
          type: "Brand Pricing Rule",
          title: "Never discount signature dishes or publish markdown percentages.",
          rationale: "Discounting erodes fine-dining premium positioning across high-tier guests.",
          provenance: "Brand Guidelines v2.4, Section 3.1: Strict prohibition on coupon codes and sales terminology.",
        },
        {
          id: "RULE-02",
          type: "Aesthetic Guideline",
          title: "Warm amber evening dining lighting only; no clinical white flash.",
          rationale: "Visual identity centers on intimacy and bespoke dining ambiance.",
          provenance: "Creative Director Brief: Preserve amber shadows and table candlelight depth in every carousel.",
        },
      ],
      deliverable: "Weekend Truffle Tasting Deliverable",
      image: "/landing/one8-truffle.jpg",
      swatches: ["#1C1917", "#9A6700", "#D6CFC2"],
      inboundComment: "Do you take private group bookings for 30 guests this Friday evening?",
      draftReply: "We would love to host your group at One8 Commune. Our private dining room is available this Friday—our guest concierge has sent a direct message with our curated group tasting menu.",
    },
    kaya: {
      name: "Kaya Botanics",
      industry: "D2C Clean Skincare",
      activeBrands: "6 Retainers",
      scheduledPosts: "24 Posts Scheduled",
      complianceScore: "100%",
      campaignTitle: "Cold-Pressed Botanical Elixir Launch",
      carouselTopic: "Bio-Fermented Squalane & Wild Rosemary Facial Nectar",
      pendingRule: "Mandatory callout of 100% recyclable amber glass bottle on all secondary packaging copy.",
      pendingDoc: "Extracted from Kaya Formulation & Packaging Sheet v3.1 PDF (p. 2)",
      rules: [
        {
          id: "TABOO-02",
          type: "Negative Taboo (Hard Boundary)",
          title: "Never compare formulas against synthetic chemicals or use fear-based marketing.",
          rationale: "Kaya advocates clean botanicals through scientific rigor without disparaging competitors.",
          provenance: "Founder Charter: Speak with grounded botanical expertise. Never publish fearmongering copy.",
        },
        {
          id: "RULE-05",
          type: "Packaging & Sustainability Rule",
          title: "Eco-friendly recyclable amber glass packaging callout is mandatory in all product launch assets.",
          rationale: "B-Corp audit compliance requirement for all primary packaging narratives.",
          provenance: "Sustainability Handbook 2026: Include carbon-neutral shipping stamp on every launch carousel.",
        },
        {
          id: "RULE-06",
          type: "Visual Identity Guideline",
          title: "Minimalist earthy palettes: sage, linen, raw stone, and soft botanical sunlight.",
          rationale: "Maintains serene Scandinavian-inspired clean aesthetic.",
          provenance: "Visual Guidelines: Keep typography airy with generous white space and natural light refractions.",
        },
      ],
      deliverable: "Cold-Pressed Botanical Elixir Deliverable",
      image: "/landing/kaya-elixir.jpg",
      swatches: ["#2D4A3E", "#C8B8A2", "#F3F1EC"],
      inboundComment: "Is the bio-fermented squalane suitable for hyper-sensitive rosacea-prone skin?",
      draftReply: "Yes. Our bio-fermented squalane is 100% plant-derived, non-comedogenic, and fragrance-free, clinically tested for sensitive skin barriers. We recommend doing a 24-hour patch test before full application.",
    },
  };

  const currentClient = clientData[selectedClient];

  return (
    <div className="w-full">
      {/* Main Window Frame with 3D Perspective Flatten */}
      <div className="relative group [perspective:1200px]">
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE7DF] shadow-[0_24px_60px_-15px_rgba(17,17,20,0.12)] overflow-hidden flex flex-col md:flex-row min-h-[640px] transition-transform duration-500 ease-out">
          
          {/* Left Sidebar (Our Real 5-Tier Architecture) */}
          <div className="w-full md:w-64 bg-[#FAF9F6] border-r border-[#EAE7DF] flex flex-col shrink-0">
            
            {/* Agency & Client Switcher Header */}
            <div className="p-3.5 border-b border-[#EAE7DF] relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {selectedClient === "one8" ? "O" : "K"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111114] truncate font-sans">
                      {currentClient.name}
                    </p>
                    <p className="text-[10px] text-[#6B6A65] font-mono">
                      {currentClient.industry}
                    </p>
                  </div>
                </div>

                {/* Client Dropdown Switcher Button */}
                <button
                  onClick={() => setClientMenuOpen(!clientMenuOpen)}
                  className="p-1 rounded-md border border-[#EAE7DF] bg-[#FFFFFF] hover:bg-[#F3F1EC] text-[#6B6A65] transition-colors"
                  title="Switch Active Client Retainer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Client Switcher Flyout */}
              {clientMenuOpen && (
                <div className="absolute top-full left-2 right-2 mt-1 z-30 bg-[#FFFFFF] rounded-xl border border-[#EAE7DF] shadow-lg p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[10px] font-mono text-[#8C8A84] uppercase tracking-wider">
                    Switch Client Retainer
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClient("one8");
                      setClientMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      selectedClient === "one8"
                        ? "bg-[#111114] text-white font-medium"
                        : "text-[#111114] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <div>
                      <div className="font-sans font-medium text-xs">One8 Commune</div>
                      <div className={`text-[10px] ${selectedClient === "one8" ? "text-white/70" : "text-[#6B6A65]"}`}>
                        Hospitality & Dining
                      </div>
                    </div>
                    {selectedClient === "one8" && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedClient("kaya");
                      setClientMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      selectedClient === "kaya"
                        ? "bg-[#111114] text-white font-medium"
                        : "text-[#111114] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <div>
                      <div className="font-sans font-medium text-xs">Kaya Botanics</div>
                      <div className={`text-[10px] ${selectedClient === "kaya" ? "text-white/70" : "text-[#6B6A65]"}`}>
                        D2C Organic Skincare
                      </div>
                    </div>
                    {selectedClient === "kaya" && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Links with Framer Motion Spring Layout */}
            <nav className="p-2 space-y-3.5 flex-1 overflow-y-auto text-xs">
              {/* WORKSPACE */}
              <div className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  WORKSPACE
                </p>
                <button
                  onClick={() => setActiveRoute("dashboard")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "dashboard"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "dashboard" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5 text-[#111114]" />
                    Dashboard
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("workspace")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "workspace"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "workspace" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-[#6B6A65]" />
                    My Workspace
                  </span>
                </button>
              </div>

              {/* OPERATIONS */}
              <div className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  OPERATIONS
                </p>
                <button
                  onClick={() => setActiveRoute("clients")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "clients"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "clients" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Clients
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("cortex")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "cortex"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "cortex" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-[#111114]" />
                    Cortex Memory
                  </span>
                  <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold tabular-nums">
                    {cortexQueueCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("tasks")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "tasks"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "tasks" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Tasks
                  </span>
                  <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#F3F1EC] text-[#6B6A65] text-[9px] font-mono font-bold tabular-nums">
                    19
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("approvals")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "approvals"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "approvals" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#9A6700]" />
                    Approvals
                  </span>
                  <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold tabular-nums">
                    2
                  </span>
                </button>
              </div>

              {/* CAMPAIGN PIPELINE */}
              <div className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  CAMPAIGN PIPELINE
                </p>
                <button
                  onClick={() => setActiveRoute("studio")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "studio"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "studio" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#9A6700]" />
                    Campaign Studio
                  </span>
                  <span className="relative z-10 px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold">
                    AI
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("plans")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "plans"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "plans" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Campaign Plans
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("calendar")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "calendar"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "calendar" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-[#0F7B6C]" />
                    Content Calendar
                  </span>
                </button>
              </div>

              {/* ENGAGEMENT & ROI */}
              <div className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  ENGAGEMENT & ROI
                </p>
                <button
                  onClick={() => setActiveRoute("inbox")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "inbox"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "inbox" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <MessagesSquare className="w-3.5 h-3.5 text-[#0F7B6C]" />
                    Community Inbox
                  </span>
                  <span className="relative z-10 flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[9px] font-mono font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                    Live
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("reports")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "reports"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "reports" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Reports & ROI
                  </span>
                </button>
              </div>

              {/* ADMIN */}
              <div className="space-y-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#8C8A84]">
                  ADMIN
                </p>
                <button
                  onClick={() => setActiveRoute("team")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "team"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "team" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Team
                  </span>
                </button>

                <button
                  onClick={() => setActiveRoute("billing")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "billing"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "billing" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-[#111114]" />
                    Billing & Credits
                  </span>
                  <span className="relative z-10 text-[9px] font-mono text-[#6B6A65] tabular-nums">38k / 50k</span>
                </button>

                <button
                  onClick={() => setActiveRoute("settings")}
                  className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeRoute === "settings"
                      ? "text-[#111114] font-semibold"
                      : "text-[#6B6A65] hover:bg-white/60"
                  }`}
                >
                  {activeRoute === "settings" && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 bg-[#FFFFFF] rounded-lg border border-[#EAE7DF] shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-[#6B6A65]" />
                    Settings
                  </span>
                </button>
              </div>
            </nav>
          </div>

          {/* Right Active Screen Area */}
          <div className="flex-1 bg-[#FFFFFF] p-6 overflow-y-auto">
            {/* ── 1. DASHBOARD ── */}
            {activeRoute === "dashboard" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
                      {currentClient.name} Pulse Dashboard
                    </h3>
                    <p className="text-xs text-[#6B6A65] font-sans">
                      Retainer health, upcoming deliverables, and deterministic compliance verification.
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                    All Systems Live
                  </span>
                </div>

                {/* Retainer Health Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Active Retainers</span>
                    <p className="text-2xl font-bold text-[#111114] font-mono tabular-nums">{currentClient.activeBrands}</p>
                    <p className="text-[11px] text-[#0F7B6C] font-mono font-medium">100% Retainer Health</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Scheduled Deliverables</span>
                    <p className="text-2xl font-bold text-[#111114] font-mono tabular-nums">{currentClient.scheduledPosts}</p>
                    <p className="text-[11px] text-[#6B6A65] font-mono">Synced to Meta & LinkedIn</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#6B6A65]">Compliance Pass Rate</span>
                    <p className="text-2xl font-bold text-[#0F7B6C] font-mono tabular-nums">{currentClient.complianceScore}</p>
                    <p className="text-[11px] text-[#0F7B6C] font-mono font-medium">0 Brand Drift Incidents</p>
                  </div>
                </div>

                {/* Pipeline Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                    Live Production Pipeline · {currentClient.name}
                  </h4>
                  <div className="rounded-xl border border-[#EAE7DF] divide-y divide-[#EAE7DF] overflow-hidden text-xs">
                    <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                      <div>
                        <p className="font-semibold text-[#111114] font-sans">{currentClient.deliverable}</p>
                        <p className="text-[11px] text-[#6B6A65] font-sans">Multi-Slide Carousel · Awaiting Client Sign-off</p>
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

            {/* ── 2. CORTEX MEMORY ── */}
            {activeRoute === "cortex" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#EAE7DF] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
                      {currentClient.name} — Living Brand Vault
                    </h3>
                    <p className="text-xs text-[#6B6A65] font-sans">
                      Institutional memory rules enforced deterministically on every AI generation run.
                    </p>
                  </div>

                  <div className="flex items-center bg-[#F3F1EC] rounded-lg p-0.5 text-xs font-mono">
                    <button
                      onClick={() => setCortexViewMode("cards")}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        cortexViewMode === "cards" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                      }`}
                    >
                      Cards View
                    </button>
                    <button
                      onClick={() => setCortexViewMode("document")}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        cortexViewMode === "document" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                      }`}
                    >
                      Clean Document
                    </button>
                  </div>
                </div>

                {/* Memory Review Queue Banner */}
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
                          rule.id.startsWith("TABOO")
                            ? "border-red-200"
                            : "border-[#EAE7DF]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              rule.id.startsWith("TABOO")
                                ? "bg-red-50 text-red-700"
                                : "bg-[#DDEDEA] text-[#0F7B6C]"
                            }`}
                          >
                            {rule.type}
                          </span>
                          <span className="text-[10px] font-mono text-[#8C8A84] tabular-nums">{rule.id}</span>
                        </div>
                        <p className="font-semibold text-[#111114] font-sans">
                          {rule.title}
                        </p>
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
                      <span className="text-[#8C8A84]"># {currentClient.name.toUpperCase()} BRAND RULES SPECIFICATION</span>
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

            {/* ── 3. CAMPAIGN STUDIO ── */}
            {activeRoute === "studio" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#EAE7DF] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
                      {currentClient.name} — Campaign Studio
                    </h3>
                    <p className="text-xs text-[#6B6A65] font-sans">
                      6 specialized agents collaborating deterministically on brand briefs.
                    </p>
                  </div>

                  {/* Deliverable View Toggle */}
                  <div className="flex items-center bg-[#F3F1EC] rounded-lg p-0.5 text-xs font-mono">
                    <button
                      onClick={() => setStudioTab("carousel")}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        studioTab === "carousel" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                      }`}
                    >
                      Tab A · 5-Slide Carousel
                    </button>
                    <button
                      onClick={() => setStudioTab("teleprompter")}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        studioTab === "teleprompter" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                      }`}
                    >
                      Tab B · Viral Teleprompter
                    </button>
                  </div>
                </div>

                {/* 6 Collaborative Agents Bar */}
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2">
                  <span className="text-[10px] font-mono text-[#8C8A84] uppercase tracking-wider">
                    Active Multi-Agent Swarm (6 Agents):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px] font-medium font-sans">
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Strategy</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Brief Synced</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Content</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Copy Written</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Compliance</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Rules Verified</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Publishing</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Ready to Post</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Analytics</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Pacing Tracked</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#EAE7DF] text-[#111114]">
                      <p className="font-semibold">Orchestrator</p>
                      <p className="text-[9px] text-[#0F7B6C] font-mono">Locked</p>
                    </div>
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
                              title={`Brand Palette ${hex}`}
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
                  <TeleprompterPreview clientName={currentClient.name} theme="light" />
                )}
              </div>
            )}

            {/* ── 4. CAMPAIGN PLANS ── */}
            {activeRoute === "plans" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF]">
                  <h3 className="text-sm font-semibold text-[#111114] font-sans">
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
                      3 Instagram Reels featuring behind-the-scenes prep + 1 educational carousel.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#111114] font-sans">Phase 2: Product Drop & VIP Table Bookings</span>
                      <span className="text-[10px] font-mono text-[#9A6700] bg-[#FBF3DB] px-2 py-0.5 rounded">In Review</span>
                    </div>
                    <p className="text-xs text-[#6B6A65] font-sans">
                      Story countdown sticker + multi-slide tasting menu carousel + WhatsApp booking broadcast.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── 5. TASKS ── */}
            {activeRoute === "tasks" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
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

            {/* ── 6. APPROVALS ── */}
            {activeRoute === "approvals" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
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
                      <span>{copiedLink ? "✓ Copied Magic Link!" : "Copy Magic Link"}</span>
                    </button>
                  </div>

                  {/* Interactive Review Box */}
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

            {/* ── 7. CONTENT CALENDAR ── */}
            {activeRoute === "calendar" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
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

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <span className="font-mono text-[10px] text-[#6B6A65]">Thu · 18:00</span>
                    <div className="p-2 rounded bg-white border border-[#EAE7DF] space-y-1">
                      <span className="text-[9px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-1 rounded">Instagram</span>
                      <p className="font-semibold text-[11px] text-[#111114]">Teaser Reel & Scent Notes</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <span className="font-mono text-[10px] text-[#6B6A65]">Fri · 12:00</span>
                    <div className="p-2 rounded bg-white border border-[#EAE7DF] space-y-1">
                      <span className="text-[9px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-1 rounded">Instagram</span>
                      <p className="font-semibold text-[11px] text-[#111114]">{currentClient.carouselTopic}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <span className="font-mono text-[10px] text-[#6B6A65]">Sat · 10:00</span>
                    <div className="p-2 rounded bg-white border border-[#EAE7DF] space-y-1">
                      <span className="text-[9px] font-mono bg-[#F3F1EC] text-[#6B6A65] px-1 rounded">LinkedIn</span>
                      <p className="font-semibold text-[11px] text-[#111114]">Founder Craftsmanship Essay</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] space-y-2">
                    <span className="font-mono text-[10px] text-[#6B6A65]">Sun · 16:00</span>
                    <div className="p-2 rounded bg-white border border-[#EAE7DF] space-y-1">
                      <span className="text-[9px] font-mono bg-[#DDEDEA] text-[#0F7B6C] px-1 rounded">Facebook</span>
                      <p className="font-semibold text-[11px] text-[#111114]">Weekend Harvest Highlights</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 8. COMMUNITY INBOX ── */}
            {activeRoute === "inbox" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111114] font-sans">
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
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono font-semibold">
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
                          replyPublished
                            ? "bg-[#DDEDEA] text-[#0F7B6C]"
                            : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                        }`}
                      >
                        {replyPublished ? "✓ Published to Instagram" : "1-Click Publish Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 9. BILLING & CREDITS ── */}
            {activeRoute === "billing" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF]">
                  <h3 className="text-sm font-semibold text-[#111114] font-sans">
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

            {/* ── 10. MY WORKSPACE ── */}
            {activeRoute === "workspace" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF]">
                  <h3 className="text-sm font-semibold text-[#111114] font-sans">My Workspace Agenda</h3>
                  <p className="text-xs text-[#6B6A65] font-sans">Personal assigned deliverables and client sign-offs.</p>
                </div>
                <div className="p-6 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] text-center space-y-2">
                  <p className="font-semibold text-xs text-[#111114] font-sans">All Personal Deliverables On Track</p>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    You have 2 pending client reviews and 0 overdue compliance tasks.
                  </p>
                </div>
              </div>
            )}

            {/* ── 11. CLIENTS ── */}
            {activeRoute === "clients" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF]">
                  <h3 className="text-sm font-semibold text-[#111114] font-sans">Client Retainer Fleet</h3>
                  <p className="text-xs text-[#6B6A65] font-sans">Active client brand spaces and contract scopes.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSelectedClient("one8")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedClient === "one8" ? "bg-[#FFFFFF] border-[#111114] shadow-sm" : "bg-[#FAF9F6] border-[#EAE7DF]"
                    }`}
                  >
                    <p className="font-semibold text-xs text-[#111114] font-sans">One8 Commune</p>
                    <p className="text-[11px] text-[#6B6A65] font-sans">Hospitality & Dining · 8 Active Retainers</p>
                    <span className="mt-2 inline-block text-[10px] font-mono text-[#0F7B6C]">100% Brand Compliance</span>
                  </div>
                  <div
                    onClick={() => setSelectedClient("kaya")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedClient === "kaya" ? "bg-[#FFFFFF] border-[#111114] shadow-sm" : "bg-[#FAF9F6] border-[#EAE7DF]"
                    }`}
                  >
                    <p className="font-semibold text-xs text-[#111114] font-sans">Kaya Botanics</p>
                    <p className="text-[11px] text-[#6B6A65] font-sans">D2C Clean Skincare · 6 Active Retainers</p>
                    <span className="mt-2 inline-block text-[10px] font-mono text-[#0F7B6C]">100% Brand Compliance</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 12. REPORTS & ROI ── */}
            {activeRoute === "reports" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="pb-3 border-b border-[#EAE7DF]">
                  <h3 className="text-sm font-semibold text-[#111114] font-sans">Reports & Agency ROI</h3>
                  <p className="text-xs text-[#6B6A65] font-sans">Client performance metrics, reach, and margin gains.</p>
                </div>
                <div className="p-6 rounded-xl border border-[#EAE7DF] bg-[#FAF9F6] text-center space-y-2">
                  <p className="font-semibold text-xs text-[#111114] font-sans">
                    +42% Average Organic Engagement Lift
                  </p>
                  <p className="text-xs text-[#6B6A65] font-sans">
                    Measured across 8 active hospitality and D2C retainers over the past 90 days.
                  </p>
                </div>
              </div>
            )}

            {/* ── 13. TEAM & SETTINGS (LOCKED ADMIN TIER) ── */}
            {(activeRoute === "team" || activeRoute === "settings") && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 animate-in fade-in duration-150">
                <div className="w-10 h-10 rounded-full bg-[#FAF9F6] border border-[#EAE7DF] flex items-center justify-center text-[#6B6A65]">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-[#111114] font-sans">
                    Protected Admin Tier (Available inside live workspace)
                  </p>
                  <p className="text-xs text-[#6B6A65] max-w-sm font-sans">
                    Tenant isolation and Role-Based Access Control protect agency billing margins from external freelancers and clients.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
