"use client";

import React, { useState } from "react";
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

export function InteractiveWorkspace() {
  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("dashboard");
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");
  const [cortexQueueCount, setCortexQueueCount] = useState<number>(3);
  const [studioTab, setStudioTab] = useState<"carousel" | "teleprompter">("carousel");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");
  const [copiedLink, setCopiedLink] = useState(false);
  const [replyPublished, setReplyPublished] = useState(false);

  const handleCopy = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <section id="preview" className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-24">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
          Interactive System Preview
        </p>
        <h2 className="text-3xl font-semibold text-[#111114] tracking-tight">
          Explore the Five-Tier AgencyOS Workspace
        </h2>
        <p className="text-xs text-[#6B6A65]">
          Click any section in the sidebar to test our deterministic memory, 6-agent studio, and mobile approval rooms.
        </p>
      </div>

      {/* Main Window Frame */}
      <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.14)] shadow-notion-window overflow-hidden flex flex-col md:flex-row min-h-[620px]">
        {/* Left Sidebar (Our Real 5-Tier Architecture) */}
        <div className="w-full md:w-64 bg-[#FAF9F6] border-r border-[rgba(55,53,47,0.08)] flex flex-col shrink-0">
          {/* Agency Switcher Header */}
          <div className="p-3.5 border-b border-[rgba(55,53,47,0.08)] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                V
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#111114] truncate">Vertex Creative Labs</p>
                <p className="text-[10px] text-[#6B6A65] font-mono">Retainer Fleet: 8 Brands</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-3.5 flex-1 overflow-y-auto text-xs">
            {/* WORKSPACE */}
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9B9A97]">
                WORKSPACE
              </p>
              <button
                onClick={() => setActiveRoute("dashboard")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "dashboard"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#111114]" />
                  Dashboard
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("workspace")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "workspace"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-[#6B6A65]" />
                  My Workspace
                </span>
              </button>
            </div>

            {/* OPERATIONS */}
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9B9A97]">
                OPERATIONS
              </p>
              <button
                onClick={() => setActiveRoute("clients")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "clients"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Clients
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("cortex")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "cortex"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-[#111114]" />
                  Cortex Memory
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold">
                  {cortexQueueCount}
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("tasks")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "tasks"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Tasks
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#F1F1EF] text-[#6B6A65] text-[9px] font-mono font-bold">
                  19
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("approvals")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "approvals"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#9A6700]" />
                  Approvals
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700] text-[9px] font-mono font-bold">
                  2
                </span>
              </button>
            </div>

            {/* CAMPAIGN PIPELINE */}
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9B9A97]">
                CAMPAIGN PIPELINE
              </p>
              <button
                onClick={() => setActiveRoute("studio")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "studio"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D9730D]" />
                  Campaign Studio
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#FAEBDD] text-[#D9730D] text-[9px] font-mono font-bold">
                  AI
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("plans")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "plans"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Campaign Plans
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("calendar")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "calendar"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-[#0F7B6C]" />
                  Content Calendar
                </span>
              </button>
            </div>

            {/* ENGAGEMENT & ROI */}
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9B9A97]">
                ENGAGEMENT & ROI
              </p>
              <button
                onClick={() => setActiveRoute("inbox")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "inbox"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessagesSquare className="w-3.5 h-3.5 text-[#0F7B6C]" />
                  Community Inbox
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[9px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                  Live
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("reports")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "reports"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Reports & ROI
                </span>
              </button>
            </div>

            {/* ADMIN */}
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9B9A97]">
                ADMIN
              </p>
              <button
                onClick={() => setActiveRoute("team")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "team"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Team
                </span>
              </button>

              <button
                onClick={() => setActiveRoute("billing")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "billing"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#111114]" />
                  Billing & Credits
                </span>
                <span className="text-[9px] font-mono text-[#6B6A65]">38k / 50k</span>
              </button>

              <button
                onClick={() => setActiveRoute("settings")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  activeRoute === "settings"
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "text-[#6B6A65] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#6B6A65]" />
                  Settings
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* Right Active Screen Area */}
        <div className="flex-1 bg-white p-6 overflow-y-auto">
          {/* ── 1. DASHBOARD ── */}
          {activeRoute === "dashboard" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Agency Pulse Dashboard</h3>
                  <p className="text-xs text-[#6B6A65]">Live retainer KPIs across active creative accounts</p>
                </div>
                <span className="text-xs font-mono text-[#6B6A65]">3 Active Retainers</span>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <span className="text-[11px] text-[#6B6A65]">Active Retainers</span>
                  <p className="text-2xl font-semibold text-[#111114] mt-1 font-mono">3</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <span className="text-[11px] text-[#6B6A65]">Scheduled Posts</span>
                  <p className="text-2xl font-semibold text-[#0F7B6C] mt-1 font-mono">14</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <span className="text-[11px] text-[#6B6A65]">Pending Reviews</span>
                  <p className="text-2xl font-semibold text-[#9A6700] mt-1 font-mono">2</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <span className="text-[11px] text-[#6B6A65]">Credits Remaining</span>
                  <p className="text-2xl font-semibold text-[#111114] mt-1 font-mono">38,200</p>
                </div>
              </div>

              {/* Active Client Retainers */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#111114]">Active Retainer Pipelines</span>
                <div className="border border-[rgba(55,53,47,0.08)] rounded-xl overflow-hidden divide-y divide-[rgba(55,53,47,0.06)] text-xs">
                  <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                    <div>
                      <p className="font-semibold text-[#111114]">One8 Commune</p>
                      <p className="text-[11px] text-[#6B6A65]">Hospitality & Dining · 8 Cortex Rules Active</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                      Sprint On Schedule
                    </span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                    <div>
                      <p className="font-semibold text-[#111114]">Kaya Botanics</p>
                      <p className="text-[11px] text-[#6B6A65]">Organic Wellness D2C · Carousel Campaign Ready</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-medium">
                      Review Pending
                    </span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between bg-white hover:bg-[#FAF9F6] transition-colors">
                    <div>
                      <p className="font-semibold text-[#111114]">Veridian Roasters</p>
                      <p className="text-[11px] text-[#6B6A65]">Artisanal Coffee Subscription · Teleprompter Video Cut</p>
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">
                    One8 Commune — Living Brand Vault
                  </h3>
                  <p className="text-xs text-[#6B6A65]">
                    Institutional memory rules enforced deterministically on every AI generation run.
                  </p>
                </div>

                <div className="flex items-center bg-[#F1F1EF] rounded-lg p-0.5 text-xs font-mono">
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
                <div className="p-3.5 rounded-xl bg-[#FBF3DB]/60 border border-[rgba(217,115,13,0.24)] flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#9A6700] flex items-center gap-1.5 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-[#9A6700]" />
                      Pending Memory Review ({cortexQueueCount} items extracted from uploaded brief):
                    </p>
                    <p className="text-[#6B6A65] text-[11px]">
                      Extracted Rule: &quot;Never offer percentage discounts on signature sourdough pizza or chef tasting menus.&quot;
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCortexQueueCount((prev) => Math.max(0, prev - 1))}
                      className="px-2.5 py-1 rounded bg-[#111114] text-white text-[10px] font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer"
                    >
                      Approve to Vault
                    </button>
                    <button
                      onClick={() => setCortexQueueCount((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-1 rounded text-[#6B6A65] hover:text-[#111114] text-[10px] transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {cortexViewMode === "cards" ? (
                <div className="space-y-3">
                  {/* Taboo 1 */}
                  <div className="p-4 rounded-xl border border-[rgba(224,62,62,0.22)] bg-[#FAF9F6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo (Hard Boundary)
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">TABOO-01</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never make unverified health or therapeutic benefit claims regarding botanical ingredients.
                    </p>
                    <p className="text-[11px] text-[#6B6A65]">
                      <span className="font-medium text-[#111114]">Rationale:</span> Regulatory compliance breach if cosmetic botanical formulas make medical claims.
                    </p>
                    <p className="text-[11px] text-[#6B6A65]">
                      <span className="font-medium text-[#111114]">Provenance:</span> &quot;We do not claim our elixirs cure ailments. Frame them around daily sensory ritual only.&quot; (Client CMO)
                    </p>
                  </div>

                  {/* Taboo 2 */}
                  <div className="p-4 rounded-xl border border-[rgba(224,62,62,0.22)] bg-[#FAF9F6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo (Hard Boundary)
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">RULE-04</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never mention discounting, coupon promo codes, or cheap rates on signature menu items.
                    </p>
                    <p className="text-[11px] text-[#6B6A65]">
                      <span className="font-medium text-[#111114]">Provenance:</span> &quot;Zero public discounting. We protect premium dining positioning across all channels.&quot; (Founding Partner)
                    </p>
                  </div>

                  {/* Brand Standard */}
                  <div className="p-4 rounded-xl border border-[rgba(15,123,108,0.22)] bg-[#FAF9F6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                        Active Brand Standard
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">STANDARD-02</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      All video scripts and reels must emphasize culinary craft, locally sourced ingredients, and warm hospitality pacing.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] font-mono text-xs text-[#111114] space-y-2">
                  <p className="font-semibold text-sm border-b pb-1">One8 Commune — Living Brand Vault Document</p>
                  <p className="text-[#6B6A65]">Deterministic Lock Active · Last Verified: Today</p>
                  <div className="pt-2 space-y-2 text-[#111114]">
                    <p>1. [TABOO-01]: Never make unverified health or therapeutic claims regarding botanical formulas.</p>
                    <p>2. [RULE-04]: Never mention discounting, promo codes, or cheap rates on signature dishes.</p>
                    <p>3. [STANDARD-02]: All video reels must emphasize culinary craft and locally sourced ingredients.</p>
                    <p>4. [PERSONA-01]: Urban premium diners and evening reservation planners seeking warm hospitality.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. CAMPAIGN STUDIO ── */}
          {activeRoute === "studio" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">
                    Campaign Studio — One8 Commune Brief
                  </h3>
                  <p className="text-xs text-[#6B6A65]">
                    6 Specialized Agents: Strategy, Content, Publishing, Compliance, Analytics, and General Agent.
                  </p>
                </div>

                <div className="flex items-center bg-[#F1F1EF] rounded-lg p-0.5 text-xs font-mono">
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

              {studioTab === "carousel" ? (
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[rgba(55,53,47,0.06)]">
                    <span className="font-semibold text-[#111114]">
                      Deliverable: 5-Slide Instagram Carousel · Weekend Truffle Tasting
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] font-semibold">
                      Compliance Checked: Zero Taboo Violations
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-[#111114]">
                    <div className="p-2.5 rounded-lg bg-white border border-[rgba(55,53,47,0.06)]">
                      <span className="font-semibold text-[#111114]">Slide 1 (Hook):</span> &quot;Why black winter truffles belong over fresh burrata gnocchi.&quot;
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-[rgba(55,53,47,0.06)]">
                      <span className="font-semibold text-[#111114]">Slide 2 (The Craft):</span> Handmade reduction simmered for 48 hours with fresh mountain herbs.
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-[rgba(55,53,47,0.06)]">
                      <span className="font-semibold text-[#111114]">Slide 3 (The Exclusivity):</span> Only 30 portions prepared every Friday evening.
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-[rgba(55,53,47,0.06)]">
                      <span className="font-semibold text-[#111114]">Slide 4 (Atmosphere):</span> Warm copper pan kitchen views and candlelit evening seating.
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-[rgba(55,53,47,0.06)]">
                      <span className="font-semibold text-[#111114]">Slide 5 (Call to Action):</span> &quot;Reserve your Friday tasting table via our bio link.&quot;
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-[#6B6A65]">
                    <span>Clean Executive Formatting Protocol Enforced</span>
                    <button
                      onClick={() => setActiveRoute("plans")}
                      className="px-3 py-1 rounded bg-[#111114] text-white font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer text-xs"
                    >
                      Bundle into Campaign Plan
                    </button>
                  </div>
                </div>
              ) : (
                <TeleprompterPreview
                  clientName="One8 Commune"
                  reelTitle="Chef's Truffle Tasting Reel (60s Short-Form)"
                  wordCount={138}
                />
              )}
            </div>
          )}

          {/* ── 4. CAMPAIGN PLANS ── */}
          {activeRoute === "plans" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Campaign Plans (Rollout Assembly)</h3>
                  <p className="text-xs text-[#6B6A65]">
                    Approved deliverables bundled into phased rollouts ready for calendar scheduling.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
                  Studio → Plans → Calendar
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#111114]">Q4 Hospitality Rollout: Truffle Tasting Sprint</span>
                  <span className="font-mono text-[10px] text-[#6B6A65]">4 Assets Bundled</span>
                </div>

                <div className="space-y-2 text-[#111114]">
                  <div className="p-2.5 rounded bg-white border border-[rgba(55,53,47,0.06)] flex items-center justify-between">
                    <span>1. 5-Slide Instagram Carousel (Truffle Craft Hook)</span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-1.5 py-0.5 rounded">Ready for Calendar</span>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[rgba(55,53,47,0.06)] flex items-center justify-between">
                    <span>2. Talking Head Reel Script (WPM 140 Synced)</span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-1.5 py-0.5 rounded">Ready for Calendar</span>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[rgba(55,53,47,0.06)] flex items-center justify-between">
                    <span>3. Friday VIP Dining Invitation (Email Blast)</span>
                    <span className="text-[10px] font-mono text-[#9A6700] bg-[#FBF3DB] px-1.5 py-0.5 rounded">Review Queue</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    onClick={() => setActiveRoute("calendar")}
                    className="px-3.5 py-1.5 rounded-lg bg-[#111114] text-white text-xs font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer"
                  >
                    Schedule to Content Calendar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. TASKS ── */}
          {activeRoute === "tasks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Dependency-Locked Task Pipeline</h3>
                  <p className="text-xs text-[#6B6A65]">
                    Downstream tasks stay automatically locked until upstream approvals clear.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#6B6A65]">19 Active Tasks</span>
              </div>

              <div className="border border-[rgba(55,53,47,0.08)] rounded-xl overflow-hidden divide-y divide-[rgba(55,53,47,0.06)] text-xs">
                <div className="p-3.5 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-[#0F7B6C]" />
                    <div>
                      <p className="font-semibold text-[#111114]">Extract Brand Rules from Tasting Menu Brief</p>
                      <p className="text-[10px] text-[#6B6A65]">Assignee: Cortex Agent · Status: Completed</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                    Passed Gate
                  </span>
                </div>

                <div className="p-3.5 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-[#9A6700]" />
                    <div>
                      <p className="font-semibold text-[#111114]">Creative Director Review: Truffle Reel Script</p>
                      <p className="text-[10px] text-[#6B6A65]">Assignee: Alex (Human Lead) · In Review</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-medium">
                    Current Gate
                  </span>
                </div>

                <div className="p-3.5 bg-[#FAF9F6] flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#9B9A97]" />
                    <div>
                      <p className="font-semibold text-[#6B6A65]">Auto-Publish Reel to Meta Instagram</p>
                      <p className="text-[10px] text-[#9B9A97]">Locked: Requires client sign-off in Review Room</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#F1F1EF] text-[#9B9A97] text-[10px] font-mono">
                    Dependency Locked
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. APPROVALS ── */}
          {activeRoute === "approvals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Magic-Link Review Room Generator</h3>
                  <p className="text-xs text-[#6B6A65]">Shareable client review links with zero login friction</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-[10px] font-medium">
                  {approvalStatus === "approved" ? "Status: Approved" : "Client Review Pending"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111114]">One8 Commune Truffle Carousel (5 Slides)</span>
                  <span className="text-[10px] font-mono text-[#6B6A65]">Token Expiry: 72 Hours</span>
                </div>

                <p className="text-xs text-[#6B6A65] leading-relaxed">
                  Send this encrypted link to the client. They can review slides on their smartphone and approve in 1 click without an AgencyOS login.
                </p>

                <div className="p-2.5 rounded bg-white border border-[rgba(55,53,47,0.06)] flex items-center justify-between text-xs font-mono text-[#6B6A65]">
                  <span className="truncate">https://agencyos.io/review/o8c-truffle-4182</span>
                  <button
                    onClick={handleCopy}
                    className="ml-2 px-2.5 py-1 rounded bg-[#F1F1EF] text-[#111114] text-[11px] font-sans hover:bg-[#E9E9E7] transition-colors cursor-pointer shrink-0"
                  >
                    {copiedLink ? "Copied Link!" : "Copy Magic Link"}
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#6B6A65] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0F7B6C]" />
                    IP audit logging enabled
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setApprovalStatus(approvalStatus === "approved" ? "pending" : "approved")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        approvalStatus === "approved"
                          ? "bg-[#0F7B6C] text-white"
                          : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                      }`}
                    >
                      {approvalStatus === "approved" ? "Approved for Publication" : "Approve Deliverable"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 7. CONTENT CALENDAR ── */}
          {activeRoute === "calendar" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Omnichannel Content Calendar</h3>
                  <p className="text-xs text-[#6B6A65]">Direct publishing to Instagram, Facebook, and LinkedIn</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-xs font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                  <span>Accounts Healthy · 72h auto-expiry alerts on</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-1.5">
                  <span className="font-mono text-[10px] text-[#9B9A97]">Wednesday · 10:00 AM</span>
                  <p className="font-semibold text-[#111114]">Instagram Carousel: Truffle Craft</p>
                  <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] inline-block font-medium">
                    Scheduled
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-1.5">
                  <span className="font-mono text-[10px] text-[#9B9A97]">Friday · 17:00 PM</span>
                  <p className="font-semibold text-[#111114]">Instagram Reel: Chef Tasting Cut</p>
                  <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] inline-block font-medium">
                    Scheduled
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-1.5">
                  <span className="font-mono text-[10px] text-[#9B9A97]">Sunday · 11:30 AM</span>
                  <p className="font-semibold text-[#111114]">Facebook Post: Weekend Brunch Seating</p>
                  <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-[10px] inline-block font-medium">
                    Internal Review
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── 8. COMMUNITY INBOX ── */}
          {activeRoute === "inbox" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Community Inbox & Social CRM</h3>
                  <p className="text-xs text-[#6B6A65]">Real-time Instagram & LinkedIn comment lead triage</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
                  Live Webhook Sync
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-[#111114]">Priya S.</span>
                    <span className="text-[#9B9A97] ml-2 font-mono text-[11px]">Instagram Comment · 8m ago</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] font-semibold">
                    High-Intent Lead · 94/100
                  </span>
                </div>

                <p className="text-xs text-[#111114] bg-white p-3 rounded-lg border border-[rgba(55,53,47,0.06)] leading-relaxed">
                  &quot;Do you take private group bookings for thirty guests this Friday evening? We are celebrating a milestone dinner.&quot;
                </p>

                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[rgba(55,53,47,0.1)] text-xs text-[#111114] space-y-1.5">
                  <p className="text-[10px] font-mono text-[#0F7B6C] font-medium">
                    Cortex-Verified Draft Reply (Complies with Dining Guidelines):
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    &quot;Hi Priya, we would love to host your celebration! Our dining room accommodates private group seatings with bespoke tasting menus. Please DM us your direct contact or reach our events team via the link in our bio.&quot;
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button className="px-3 py-1 rounded text-xs text-[#6B6A65] hover:text-[#111114] cursor-pointer">
                    Edit Draft
                  </button>
                  <button
                    onClick={() => setReplyPublished(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] cursor-pointer"
                  >
                    {replyPublished ? "Published to Instagram!" : "Approve & Post to Instagram"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 9. BILLING & CREDITS ── */}
          {activeRoute === "billing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Billing & Credits Dashboard</h3>
                  <p className="text-xs text-[#6B6A65]">Usage-based economics: Free human seats, pay only for AI compute</p>
                </div>
                <span className="text-xs font-mono text-[#111114] font-semibold">
                  38,200 / 50,000 Credits
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-2">
                  <span className="font-semibold text-[#0F7B6C] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Always Free (0 Credits)
                  </span>
                  <ul className="space-y-1 text-[#6B6A65] text-[11px]">
                    <li>• Unlimited agency team members & seats</li>
                    <li>• Tasks, boards & calendar scheduling</li>
                    <li>• Magic-Link Review Rooms & client approvals</li>
                    <li>• Manual copy revisions & publishing</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-2">
                  <span className="font-semibold text-[#D9730D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Credit-Burning AI Tasks
                  </span>
                  <ul className="space-y-1 text-[#6B6A65] text-[11px]">
                    <li>• 6-Agent Campaign Studio generation runs</li>
                    <li>• Ingesting PDFs & notes into Cortex Memory</li>
                    <li>• Inbound comment intent triage & scoring</li>
                    <li>• Auto-drafting brand-compliant replies</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── 10. MY WORKSPACE PREVIEW ── */}
          {activeRoute === "workspace" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">My Specialist Workspace</h3>
                  <p className="text-xs text-[#6B6A65]">Personal task queue tailored to your assignments</p>
                </div>
              </div>
              <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] text-xs text-[#6B6A65] space-y-2">
                <p className="font-semibold text-[#111114]">Today&apos;s Focus Deliverables</p>
                <p>1. Review Taboo Scan for One8 Commune Weekend Truffle Tasting Reel</p>
                <p>2. Sync teleprompter scene pacing for Chef keynote video</p>
                <p>3. Dispatch Magic-Link Review Room to client stakeholder</p>
              </div>
            </div>
          )}

          {/* ── 11. CLIENTS PREVIEW ── */}
          {activeRoute === "clients" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Client Directory</h3>
                  <p className="text-xs text-[#6B6A65]">Brand profiles, social connections, and active retainers</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <p className="font-semibold text-[#111114]">One8 Commune</p>
                  <p className="text-[11px] text-[#6B6A65] mt-1">$6,500/mo Retainer</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <p className="font-semibold text-[#111114]">Kaya Botanics</p>
                  <p className="text-[11px] text-[#6B6A65] mt-1">$8,000/mo Retainer</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)]">
                  <p className="font-semibold text-[#111114]">Veridian Roasters</p>
                  <p className="text-[11px] text-[#6B6A65] mt-1">$5,200/mo Retainer</p>
                </div>
              </div>
            </div>
          )}

          {/* ── 12. REPORTS PREVIEW ── */}
          {activeRoute === "reports" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Performance & Attribution Reports</h3>
                  <p className="text-xs text-[#6B6A65]">Client-facing social velocity and ROI summaries</p>
                </div>
              </div>
              <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] text-xs text-[#6B6A65] space-y-2">
                <p className="font-semibold text-[#111114]">November Retainer Velocity</p>
                <p>• 42 Posts Published across Instagram & LinkedIn</p>
                <p>• 18 High-Intent Inbound Leads Triaged in Community Inbox</p>
                <p>• Zero Brand Drift Incidents (100% Cortex Compliance Pass)</p>
              </div>
            </div>
          )}

          {/* ── 13. TEAM & SETTINGS LOCKED PREVIEWS ── */}
          {(activeRoute === "team" || activeRoute === "settings") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h3 className="text-sm font-semibold text-[#111114]">Admin Configuration</h3>
                  <p className="text-xs text-[#6B6A65]">Role-Based Access Control Protected</p>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] text-center space-y-3 max-w-md mx-auto">
                <Lock className="w-6 h-6 text-[#111114] mx-auto" />
                <h4 className="text-xs font-semibold text-[#111114]">
                  Protected Admin Tier Navigation
                </h4>
                <p className="text-xs text-[#6B6A65] leading-relaxed">
                  Team seats, agency billing margins, and Meta webhook API settings are restricted to Agency Owners and Managers. This tier is automatically hidden from freelance specialists.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
