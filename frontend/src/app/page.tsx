"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Brain,
  FileCheck2,
  CalendarDays,
  MessagesSquare,
  Lock,
  Unlock,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  ChevronRight,
  Smartphone,
  Eye,
  Sliders,
  Sparkles,
  Command,
  Laptop,
  CheckCircle2,
  RefreshCw,
  Bell,
  Play,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/landing/Navbar";
import { CommandPalette } from "@/components/landing/CommandPalette";
import { InteractiveWorkspace } from "@/components/landing/InteractiveWorkspace";
import { TeleprompterPreview } from "@/components/landing/TeleprompterPreview";
import { MarginCalculator } from "@/components/landing/MarginCalculator";

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [workspaceRoute, setWorkspaceRoute] = useState<any>("dashboard");
  const [workspaceClient, setWorkspaceClient] = useState<"one8" | "kaya">("one8");

  // Cause-and-Effect Micro-Demo 1: Cortex Violation Injection
  const [violationTriggered, setViolationTriggered] = useState(false);

  // Cause-and-Effect Micro-Demo 2: Magic-Link Mobile Approval & Overlapping Desktop WebSocket Toast
  const [mobileApproved, setMobileApproved] = useState(false);
  const [showDesktopToast, setShowDesktopToast] = useState(false);

  // Cause-and-Effect Micro-Demo 3: Dependency-Locked Pipeline in Operations Bento
  const [upstreamApproved, setUpstreamApproved] = useState(false);

  const isAuthenticated = !isLoading && Boolean(token);

  const handleMobileApprove = () => {
    setMobileApproved(true);
    setShowDesktopToast(true);
  };

  const handleResetApproval = () => {
    setMobileApproved(false);
    setShowDesktopToast(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111114] font-sans antialiased selection:bg-[#EAE7DF] selection:text-[#111114]">
      {/* ⌘K Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectWorkspaceTab={(tab) => setWorkspaceRoute(tab)}
        onSelectClient={(client) => setWorkspaceClient(client)}
      />

      {/* ── Section 1: Sticky Top Navigation ── */}
      <Navbar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

      {/* ── Main Engineered Container with Vertical Guide Rails & Crosshair Intersections ── */}
      <div className="max-w-7xl mx-auto border-x border-[#EAE7DF] relative bg-transparent">
        
        {/* Rail Top-Left / Top-Right Crosshairs */}
        <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
        <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

        {/* ── Section 2: Hero Section (Warm Paper #FAF9F6) ── */}
        <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center relative border-b border-[#EAE7DF]">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs mb-6 text-xs text-[#6B6A65]">
            <span className="font-semibold text-[#111114] font-sans">
              AI-Native Agency Operating System
            </span>
            <span className="text-[#8C8A84]">·</span>
            <span className="font-sans">Built for Social & Creative Agencies</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-[#111114] max-w-4xl mx-auto leading-[1.12] font-sans">
            The Operating System for Modern Marketing Agencies.
          </h1>

          {/* Subheadline */}
          <p className="mt-5 text-base sm:text-lg text-[#6B6A65] max-w-3xl mx-auto leading-relaxed font-sans">
            Run client institutional memory, six specialized AI agents, mobile client approvals, content calendars, and social engagement from one deterministic workspace.
          </p>

          {/* Dual Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all shadow-xs flex items-center gap-2 font-sans"
            >
              <span>{isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#preview"
              className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all shadow-xs flex items-center gap-2 font-sans"
            >
              <span>Try the Live Interface</span>
              <ChevronRight className="w-4 h-4 text-[#8C8A84]" />
            </a>

            {/* Quick ⌘K Shortcut Hint */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-mono text-[#8C8A84] hover:text-[#111114] hover:bg-[#FFFFFF] border border-transparent hover:border-[#EAE7DF] transition-all"
              title="Open Command Palette"
            >
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114]">⌘K</kbd>
              <span>to jump anywhere</span>
            </button>
          </div>

          {/* Trust & Truth Strip (4 Concise Checks) */}
          <div className="mt-14 pt-8 border-t border-[#EAE7DF] max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-[#6B6A65]">
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Unlimited team members & free seats</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Deterministic brand rules & taboos</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Direct Instagram, FB & LinkedIn publishing</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Zero AI model training on client IP</span>
            </div>
          </div>
        </section>

        {/* ── Section 3: Flagship Interactive AgencyOS Workspace (#preview) ── */}
        <section className="py-16 bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          {/* Section Marker */}
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <InteractiveWorkspace
            externalRoute={workspaceRoute}
            externalClient={workspaceClient}
          />
        </section>

        {/* ── Section 4: The Operational Problem (Warm Stone #F3F1EC with Hairline Grid) ── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 border-b border-[#EAE7DF] bg-[#F3F1EC]/60 relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
              The Operational Problem
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight font-sans">
              Disconnected Agency Stack vs. Deterministic Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              When creative agencies patch together five single-purpose SaaS subscriptions, communication drops, brand compliance drifts, and client approvals stall.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Card: Disconnected Agency Stack */}
            <div className="p-8 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs space-y-6">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-mono font-semibold uppercase tracking-wider">
                  Fragmented Status Quo
                </span>
                <h3 className="text-xl font-semibold text-[#111114] font-sans">
                  The Disconnected Agency Stack
                </h3>
              </div>

              <div className="space-y-4 text-xs text-[#6B6A65] font-sans">
                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    $1,200+/mo Seat-Tax Bleed
                  </p>
                  <p className="leading-relaxed">
                    Paying per-seat licenses across Asana, Google Docs, ChatGPT Plus seats, Hootsuite, and WhatsApp business accounts penalizes team expansion.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Brand Voice & Compliance Drift
                  </p>
                  <p className="leading-relaxed">
                    Junior copywriters and generic AI prompts repeatedly forget client taboos, healthcare rules, and pricing guidelines stored in static PDFs.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Approval Gridlock & Scattered Feedback
                  </p>
                  <p className="leading-relaxed">
                    Client feedback is fragmented across WhatsApp voice notes, messy email threads, and buried Google Drive links, causing delayed publishing.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Unified AgencyOS Pipeline */}
            <div className="p-8 rounded-2xl bg-[#FFFFFF] border border-[#111114] shadow-md space-y-6">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold uppercase tracking-wider">
                  The AgencyOS Engine
                </span>
                <h3 className="text-xl font-semibold text-[#111114] font-sans">
                  The Deterministic Agency Pipeline
                </h3>
              </div>

              <div className="space-y-4 text-xs text-[#6B6A65] font-sans">
                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0F7B6C]" />
                    Enforced Institutional Memory
                  </p>
                  <p className="leading-relaxed">
                    Living Brand Vault rules and negative taboos are verified before copy ever reaches internal review or the client.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0F7B6C]" />
                    Zero-Friction Mobile Approvals
                  </p>
                  <p className="leading-relaxed">
                    Clients review and sign off on carousels, teleprompter video cuts, and captions directly from their mobile phone via 1-click tokenized magic links.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-[#111114] flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0F7B6C]" />
                    Dependency-Locked Execution
                  </p>
                  <p className="leading-relaxed">
                    Deliverables flow automatically from Campaign Studio to Phased Campaign Plans to Content Calendar without copy-paste overhead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5: The Three Core Differentiators (Distinct Layouts) ── */}
        <section id="differentiators" className="border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 text-center max-w-3xl mx-auto space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
              Core Differentiators
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight font-sans">
              Three Capabilities Built Specifically for Marketing Retainers
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              Tested against hundreds of client review cycles. Designed to eliminate brand drift, endless WhatsApp sign-offs, and multi-take video production.
            </p>
          </div>

          {/* ── Showcase 1: Cortex Living Brand Vault (Wide Split-Diff Canvas with Violation Injection) ── */}
          <div id="cortex-vault" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-[#EAE7DF] bg-[#FAF9F6]">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-[#0F7B6C] uppercase font-bold tracking-wider">
                    Differentiator 01 · Cortex Living Brand Vault
                  </span>
                  <h3 className="text-2xl font-semibold text-[#111114] font-sans">
                    Deterministic Rule Enforcement, Not Passive Vector Search
                  </h3>
                  <p className="text-xs text-[#6B6A65] font-sans max-w-xl">
                    Unlike passive vector search that hallucinates or forgets negative constraints, Cortex enforces hard negative taboos before copy is generated.
                  </p>
                </div>

                {/* Interactive Cause-and-Effect Toggle */}
                <div className="flex items-center gap-3 bg-[#FFFFFF] p-2 rounded-xl border border-[#EAE7DF] shadow-xs">
                  <span className="text-xs font-sans text-[#6B6A65]">Test Violation Engine:</span>
                  <button
                    onClick={() => setViolationTriggered(!violationTriggered)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer shadow-xs ${
                      violationTriggered
                        ? "bg-red-700 text-white"
                        : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                    }`}
                  >
                    {violationTriggered ? "Reset Clean Draft" : "Inject Rule Violation"}
                  </button>
                </div>
              </div>

              {/* Wide Split-Diff Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#EAE7DF] bg-[#FFFFFF] shadow-md overflow-hidden">
                {/* Left Pane: Brand Vault Rules & Taboo Specification (5 cols) */}
                <div className="lg:col-span-5 p-6 bg-[#FAF9F6] border-r border-[#EAE7DF] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111114] font-sans flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#111114]" />
                      Living Brand Vault · One8 Commune
                    </span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                      Enforced
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-red-200 bg-[#FFFFFF] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                          Negative Taboo
                        </span>
                        <span className="font-mono text-[10px] text-[#8C8A84]">TABOO-04</span>
                      </div>
                      <p className="font-semibold text-[#111114] font-sans">
                        Never make medical or therapeutic health claims.
                      </p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">
                        Provenance: &quot;Brand Bible v2.4, Section 3.1: All culinary descriptions must refrain from medicinal claims.&quot;
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-[#EAE7DF] bg-[#FFFFFF] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-[#9A6700] bg-[#FBF3DB] px-1.5 py-0.5 rounded">
                          Pricing Rule
                        </span>
                        <span className="font-mono text-[10px] text-[#8C8A84]">RULE-01</span>
                      </div>
                      <p className="font-semibold text-[#111114] font-sans">
                        Never offer discounts or mention markdown percentages on signature menu items.
                      </p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">
                        Provenance: Founder Charter: &quot;Preserve premium dining positioning; zero coupons.&quot;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Live Caption Composer with Strikeout & Auto-Rewrite (7 cols) */}
                <div className="lg:col-span-7 p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                    <span className="text-xs font-semibold text-[#111114] font-sans">
                      Live Caption Composer & Compliance Verification
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        violationTriggered
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-[#DDEDEA] text-[#0F7B6C]"
                      }`}
                    >
                      {violationTriggered ? "VIOLATION DETECTED" : "COMPLIANCE PASSED"}
                    </span>
                  </div>

                  {violationTriggered ? (
                    <div className="space-y-4">
                      {/* Inline Strikethrough of Forbidden Copy */}
                      <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-red-700 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Violates TABOO-04 (Medical Claim) & RULE-01 (Discount Prohibition):
                          </span>
                        </div>
                        <p className="text-[#111114] leading-relaxed font-sans line-through decoration-red-600 decoration-2 opacity-80">
                          &quot;Guaranteed 100% cure for inflammation with our wild forest mushroom reduction — 20% discount this weekend only.&quot;
                        </p>
                      </div>

                      {/* Clean Auto-Rewrite by Compliance Agent */}
                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#0F7B6C]/30 space-y-2 text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#0F7B6C] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          Compliance Agent Auto-Rewrite (Verified against Vault):
                        </span>
                        <p className="text-[#111114] leading-relaxed font-sans font-medium">
                          &quot;Crafted with wild forest mushrooms, simmered for forty-eight hours to bring out earthy umami depth and handmade burrata warmth.&quot;
                        </p>
                        <p className="text-[11px] text-[#6B6A65] font-sans">
                          Result: Therapeutic claim replaced with culinary craftsmanship narrative; discount eliminated to preserve signature pricing.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-3 text-xs">
                      <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        Clean Draft Verified by Compliance Agent:
                      </span>
                      <p className="text-[#111114] leading-relaxed font-sans font-medium text-sm">
                        &quot;This is what happens when you shave black winter truffles directly over handmade burrata gnocchi. Freshly harvested, prepared in thirty limited portions this Friday evening.&quot;
                      </p>
                      <p className="text-[11px] text-[#6B6A65] font-sans">
                        Verified against TABOO-04 and RULE-01. Click &quot;Inject Rule Violation&quot; above to see real-time boundary enforcement.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Showcase 2: Magic-Link Review Rooms (Overlapping Desktop + Mobile Frame) ── */}
          <div id="review-room" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-[#EAE7DF] bg-[#FFFFFF]">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="max-w-2xl space-y-1">
                <span className="text-xs font-mono text-[#0F7B6C] uppercase font-bold tracking-wider">
                  Differentiator 02 · Magic-Link Review Rooms
                </span>
                <h3 className="text-2xl font-semibold text-[#111114] font-sans">
                  Zero-Friction Mobile Client Sign-Off with Real-Time WebSockets
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                  Never ask busy founders to download an app or create an account. They open a tokenized mobile link on their phone, swipe through carousels, and tap approve in seconds.
                </p>
              </div>

              {/* Overlapping Desktop + Mobile Frame Container */}
              <div className="relative rounded-2xl border border-[#EAE7DF] bg-[#FAF9F6] p-6 sm:p-10 overflow-hidden min-h-[460px] flex flex-col lg:flex-row items-center justify-between gap-8">
                
                {/* Desktop Agency View (Left Background Area) */}
                <div className="w-full lg:w-1/2 space-y-4">
                  <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#EAE7DF]">
                      <span className="text-xs font-semibold text-[#111114] font-sans">
                        Agency Dashboard · Real-Time Delivery Feed
                      </span>
                      <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#0F7B6C] animate-pulse" />
                        WebSocket Active
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[#6B6A65]">
                        <span>Client:</span>
                        <span className="font-semibold text-[#111114]">One8 Commune</span>
                      </div>
                      <div className="flex items-center justify-between text-[#6B6A65]">
                        <span>Deliverable:</span>
                        <span className="font-semibold text-[#111114]">Weekend Truffle Tasting Deliverable</span>
                      </div>
                      <div className="flex items-center justify-between text-[#6B6A65]">
                        <span>Review Room Link:</span>
                        <span className="font-mono text-[11px] text-[#0F7B6C]">agencyos.app/review/rk_9482bf0e</span>
                      </div>
                      <div className="flex items-center justify-between text-[#6B6A65]">
                        <span>Expiry Guard:</span>
                        <span className="font-mono text-[11px]">72 Hours Auto-Lock</span>
                      </div>
                    </div>
                  </div>

                  {/* Overlapping Real-Time Toast that fires when approved */}
                  {showDesktopToast && (
                    <div className="p-4 rounded-xl bg-[#111114] text-white shadow-xl border border-neutral-700 space-y-1 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          WebSocket Event: Client Approved!
                        </span>
                        <span className="text-[10px] font-mono text-white/50">Just now</span>
                      </div>
                      <p className="text-xs font-sans text-white/90">
                        One8 Commune signed off on Weekend Truffle Tasting Deliverable.
                      </p>
                      <p className="text-[10px] font-mono text-white/60">
                        Automated social dispatch pipeline unlocked for Friday 18:00.
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={handleResetApproval}
                      className="text-xs font-mono text-[#6B6A65] hover:text-[#111114] flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Demo State
                    </button>
                  </div>
                </div>

                {/* Mobile Hardware Frame (Right Foreground Area) */}
                <div className="w-full max-w-[280px] bg-[#FFFFFF] rounded-[32px] border-4 border-[#111114] shadow-2xl p-4 space-y-4">
                  {/* Phone Notch & Header */}
                  <div className="w-20 h-3.5 bg-[#111114] rounded-full mx-auto" />
                  
                  <div className="text-center space-y-0.5">
                    <span className="text-[9px] font-mono text-[#8C8A84] uppercase">One8 Commune Review Room</span>
                    <p className="text-xs font-bold text-[#111114] font-sans">Weekend Truffle Tasting</p>
                  </div>

                  {/* Carousel Slide Card inside Mobile */}
                  <div className="h-36 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] p-3 flex flex-col justify-between text-center">
                    <span className="text-[9px] font-mono text-[#0F7B6C]">Slide 1 of 5</span>
                    <p className="text-[11px] font-semibold text-[#111114] font-sans">
                      Handmade Burrata & Winter Truffle Gnocchi
                    </p>
                    <span className="text-[9px] font-mono text-[#8C8A84]">Compliance: 100%</span>
                  </div>

                  {/* Mobile Interactive Approval Action */}
                  <div className="space-y-2">
                    {mobileApproved ? (
                      <div className="p-2.5 rounded-xl bg-[#DDEDEA] border border-[#0F7B6C]/30 text-center space-y-0.5">
                        <p className="text-xs font-bold text-[#0F7B6C] flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Approved & Signed
                        </p>
                        <p className="text-[9px] font-mono text-[#0F7B6C]">SHA-256 Hash Locked</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleMobileApprove}
                        className="w-full py-2.5 rounded-xl bg-[#111114] text-white text-xs font-medium hover:bg-[#2F2E2B] transition-all shadow-xs cursor-pointer font-sans"
                      >
                        Tap to Approve Deliverable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Showcase 3: Viral Teleprompter Studio (High-Contrast Dark Obsidian #101014 Band) ── */}
          <div id="teleprompter" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#EAE7DF] bg-[#101014] text-white relative">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="max-w-2xl space-y-1">
                <span className="text-xs font-mono text-emerald-400 uppercase font-bold tracking-wider">
                  Differentiator 03 · Viral Teleprompter Studio
                </span>
                <h3 className="text-3xl font-semibold text-white tracking-tight font-sans">
                  Dark Studio Viewport with Live Auto-Scrolling WPM Speed Dial
                </h3>
                <p className="text-xs text-white/70 font-sans leading-relaxed">
                  Turn campaign scripts into high-retention short-form reels. Adjust speaking pace from 110 to 180 words per minute to auto-scroll the script, time visual hooks, and enforce brand rules.
                </p>
              </div>

              {/* Real Auto-Scrolling Teleprompter in Dark Mode */}
              <TeleprompterPreview
                clientName="One8 Commune"
                reelTitle="Executive Chef Truffle Tasting Reel (60s Cut)"
                wordCount={138}
                theme="dark"
              />
            </div>
          </div>
        </section>

        {/* ── Section 6: Daily Operations Bento Grid (Crisp White #FFFFFF) ── */}
        <section id="operations" className="py-24 px-4 sm:px-6 lg:px-8 border-b border-[#EAE7DF] bg-[#FFFFFF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
              Daily Operations
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight font-sans">
              Everything Your Agency Ships Every Single Day
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              From automated social publishing to high-intent comment triage and dependency-locked task pipelines.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Content Calendar & Direct Publishing */}
            <div className="p-7 rounded-2xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-center text-[#0F7B6C]">
                  <CalendarDays className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-medium">
                  Connection Health: Healthy
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#111114] font-sans">
                  Omnichannel Content Calendar & Direct Publishing
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                  Schedule and publish multi-platform campaigns directly to Instagram, Facebook, and LinkedIn with proactive 72-hour token auto-expiry alerts.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#EAE7DF] space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-[#111114] font-semibold">One8 Commune · Friday 18:00</span>
                  <span className="text-[#0F7B6C]">Auto-Publish Armed</span>
                </div>
                <p className="text-[11px] text-[#6B6A65]">Instagram Carousel + Facebook Video Reel</p>
              </div>
            </div>

            {/* Card 2: Community CRM & Social Inbox */}
            <div className="p-7 rounded-2xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-center text-[#0F7B6C]">
                  <MessagesSquare className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-medium">
                  High-Intent Lead: 94/100
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#111114] font-sans">
                  Community CRM & Buying-Intent Triage
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                  Inbound social comments are triaged for purchasing intent. High-intent leads receive Cortex-verified draft replies ready for 1-click publishing.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#EAE7DF] space-y-1.5 text-xs">
                <p className="font-semibold text-[#111114] font-sans">&quot;Do you have private dining availability for 30 this Friday?&quot;</p>
                <p className="text-[11px] text-[#0F7B6C] font-mono">✓ Verified concierge reply prepared</p>
              </div>
            </div>

            {/* Card 3: Real Cause-and-Effect Dependency-Locked Pipeline */}
            <div className="p-7 rounded-2xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-center text-[#111114]">
                  {upstreamApproved ? <Unlock className="w-4 h-4 text-[#0F7B6C]" /> : <Lock className="w-4 h-4 text-[#9A6700]" />}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#EAE7DF] text-[#6B6A65] text-[10px] font-mono">
                  Interactive Micro-Demo
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#111114] font-sans">
                  Dependency-Locked Production Pipeline
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                  Prevent costly rework. Downstream production and publishing cards remain locked until upstream creative brief sign-offs clear.
                </p>
              </div>

              {/* Interactive Upstream -> Downstream Pipeline */}
              <div className="space-y-3 pt-2">
                {/* Upstream Card */}
                <div className="p-3 rounded-xl bg-white border border-[#EAE7DF] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-[#8C8A84]">Upstream Step 1:</span>
                    <p className="font-semibold text-[#111114]">Creative Brief & Taboo Sign-off</p>
                  </div>
                  <button
                    onClick={() => setUpstreamApproved(!upstreamApproved)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      upstreamApproved
                        ? "bg-[#DDEDEA] text-[#0F7B6C]"
                        : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                    }`}
                  >
                    {upstreamApproved ? "✓ Brief Approved" : "Click to Approve Brief"}
                  </button>
                </div>

                {/* Animated Connector Bar */}
                <div className="flex items-center justify-center">
                  <div
                    className={`w-0.5 h-5 transition-colors duration-300 ${
                      upstreamApproved ? "bg-[#0F7B6C]" : "bg-[#EAE7DF]"
                    }`}
                  />
                </div>

                {/* Downstream Card */}
                <div
                  className={`p-3 rounded-xl border transition-all text-xs ${
                    upstreamApproved
                      ? "bg-white border-[#0F7B6C]/40 shadow-xs"
                      : "bg-[#FAF9F6] border-dashed border-[#EAE7DF] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono text-[#8C8A84]">Downstream Step 2:</span>
                      <p className="font-semibold text-[#111114]">Carousel Production & Direct Publishing</p>
                    </div>
                    {upstreamApproved ? (
                      <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-semibold">
                        Unlocked & Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[#8C8A84] bg-[#F3F1EC] px-2 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Role-Based Access Control */}
            <div className="p-7 rounded-2xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-center text-[#111114]">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#EAE7DF] text-[#6B6A65] text-[10px] font-mono">
                  Governance
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#111114] font-sans">
                  Role-Based Access Control & Tenant Isolation
                </h3>
                <p className="text-xs text-[#6B6A65] font-sans leading-relaxed">
                  Protect agency billing margins, private credit allocations, and client spaces. Freelance designers never see internal retainers or financial settings.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#EAE7DF] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#111114]">Agency Owner Tier</span>
                  <span className="text-[#0F7B6C]">Full Billing & Model Access</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#6B6A65]">
                  <span>Specialist / Contractor</span>
                  <span>Deliverables Only (Zero Financials)</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── Section 7: Retainer Margin Calculator & Economics (#pricing) ── */}
        <MarginCalculator />

        {/* ── Section 8: Final Call to Action Banner & Public-Safe Footer ── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 text-center bg-[#FAF9F6] border-t border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#111114] font-sans leading-tight">
              Run Every Client Retainer on One Deterministic System.
            </h2>
            <p className="text-sm sm:text-base text-[#6B6A65] max-w-2xl mx-auto leading-relaxed font-sans">
              Zero brand drift, zero seat taxes, and 1-click mobile client approvals. Join forward-thinking agencies operating with institutional memory.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all shadow-xs flex items-center gap-2 font-sans"
              >
                <span>{isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#preview"
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all shadow-xs font-sans"
              >
                Try the Live Interface
              </a>
            </div>
          </div>
        </section>

        {/* Public-Safe Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#EAE7DF] bg-[#FFFFFF] text-xs text-[#6B6A65]">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold">
                  A
                </div>
                <span className="font-semibold text-sm text-[#111114] font-sans">AgencyOS</span>
              </div>
              <p className="text-[11px] leading-relaxed font-sans">
                The Operating System for Modern Marketing Agencies. Built by Brieva.
              </p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Product</p>
              <p><a href="#preview" className="hover:text-[#111114]">Interactive Preview</a></p>
              <p><a href="#cortex-vault" className="hover:text-[#111114]">Cortex Living Brand Vault</a></p>
              <p><a href="#review-room" className="hover:text-[#111114]">Magic-Link Review Rooms</a></p>
              <p><a href="#teleprompter" className="hover:text-[#111114]">Viral Teleprompter Studio</a></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Workspaces</p>
              <p><a href="#operations" className="hover:text-[#111114]">Content Calendar</a></p>
              <p><a href="#operations" className="hover:text-[#111114]">Community CRM & Inbox</a></p>
              <p><a href="#operations" className="hover:text-[#111114]">Dependency-Locked Tasks</a></p>
              <p><a href="#pricing" className="hover:text-[#111114]">Pricing & Retainer Calculator</a></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Governance</p>
              <p>Unlimited Team Seats</p>
              <p>Zero AI Training on Client Data</p>
              <p>Role-Based Access Control</p>
              <p className="text-[#0F7B6C] font-mono text-[10px] pt-1">All Systems Operational</p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto pt-6 border-t border-[#EAE7DF] flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <span>© 2026 AgencyOS by Brieva. All rights reserved.</span>
            <span>Deterministic Agency Architecture</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
