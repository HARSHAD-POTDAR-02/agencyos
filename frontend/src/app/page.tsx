"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  CalendarDays,
  MessagesSquare,
  Lock,
  Unlock,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Eye,
  EyeOff,
  Film,
  Layers,
  Cpu,
  Smartphone,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/landing/Navbar";
import { CommandPalette } from "@/components/landing/CommandPalette";
import { InteractiveWorkspace, ClientKey } from "@/components/landing/InteractiveWorkspace";
import { AgentSwarmShowcase } from "@/components/landing/AgentSwarmShowcase";
import { TeleprompterPreview } from "@/components/landing/TeleprompterPreview";
import { MarginCalculator } from "@/components/landing/MarginCalculator";

// Subtle 2% archival SVG noise texture for stone (#F3F1EC) surfaces
const STONE_GRAIN_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.025'/%3E%3C/svg%3E")`,
};

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [workspaceRoute, setWorkspaceRoute] = useState<any>("dashboard");
  const [workspaceClient, setWorkspaceClient] = useState<ClientKey>("solis");

  // Stage 1: Hero Multi-Client Dispatch Queue
  const [selectedHeroClient, setSelectedHeroClient] = useState<ClientKey>("solis");

  // Stage 5: Cortex Violation Injection & Pocket Sign-Off Studio
  const [violationTriggered, setViolationTriggered] = useState(false);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [mobileApproved, setMobileApproved] = useState(false);
  const [showDesktopToast, setShowDesktopToast] = useState(false);

  // Stage 6: Operations & Production 4-Quadrant Controls
  const [upstreamApproved, setUpstreamApproved] = useState(false);
  const [crmReplied, setCrmReplied] = useState(false);
  const [rbacRole, setRbacRole] = useState<"owner" | "freelancer">("owner");

  const isAuthenticated = !isLoading && Boolean(token);

  useEffect(() => {
    const openListener = () => setIsCommandPaletteOpen(true);
    window.addEventListener("agencyos:open-command-palette", openListener);
    return () => window.removeEventListener("agencyos:open-command-palette", openListener);
  }, []);

  const triggerApproval = () => {
    setSlideProgress(100);
    setMobileApproved(true);
    setShowDesktopToast(true);
  };

  const handleSlideChange = (val: number) => {
    setSlideProgress(val);
    if (val >= 90) {
      triggerApproval();
    }
  };

  const handleResetApproval = () => {
    setSlideProgress(0);
    setMobileApproved(false);
    setShowDesktopToast(false);
  };

  const heroQueue: {
    key: ClientKey;
    client: string;
    vertical: string;
    campaign: string;
    stage: string;
    rule: string;
    channel: string;
    image: string;
    statusTone: "emerald" | "amber";
  }[] = [
    {
      key: "solis",
      client: "Osteria Solis",
      vertical: "Hospitality",
      campaign: "Winter Truffle Tasting Launch",
      stage: "Magic-Link Armed · Ready for Sign-Off",
      rule: "TABOO-04 PASSED",
      channel: "IG 4:5 Carousel",
      image: "/landing/solis-truffle.jpg",
      statusTone: "emerald",
    },
    {
      key: "linden",
      client: "Linden & Clay",
      vertical: "D2C Skincare",
      campaign: "Botanical Elixir Batch 09",
      stage: "Quality Gate 98/100 · Auto-QA Verified",
      rule: "RULE-05 PASSED",
      channel: "IG Reel + Carousel",
      image: "/landing/linden-elixir.jpg",
      statusTone: "emerald",
    },
    {
      key: "cairn",
      client: "Cairn Roasters",
      vertical: "Specialty Coffee",
      campaign: "Anaerobic Highland Micro-Lot",
      stage: "Scheduled · Fri 09:00 Dispatch",
      rule: "RULE-03 PASSED",
      channel: "IG + LinkedIn",
      image: "/landing/cairn-coffee.jpg",
      statusTone: "amber",
    },
  ];

  const activeHeroRow = heroQueue.find((r) => r.key === selectedHeroClient) ?? heroQueue[0];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111114] font-sans antialiased selection:bg-[#EAE7DF] selection:text-[#111114]">
      {/* ⌘K Editorial Index Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectWorkspaceTab={(tab) => setWorkspaceRoute(tab)}
        onSelectClient={(client) => setWorkspaceClient(client)}
      />

      {/* Sticky Top Navigation */}
      <Navbar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

      {/* Main Engineered Container with Vertical Guide Rails & Crosshair Intersections */}
      <div className="max-w-7xl mx-auto border-x border-[#EAE7DF] relative">
        <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
        <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 1: MASTHEAD HERO (3-Second Clarity Architecture + Proof Specimen)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="hero" className="border-b border-[#EAE7DF] bg-[#FAF9F6] relative">
          <div className="px-6 sm:px-10 lg:px-12 pt-14 pb-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Agency Thesis */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8A84]">
                  01 // MASTHEAD
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#EAE7DF] text-xs sm:text-sm font-heading font-semibold text-[#111114] tracking-tight">
                  The AI-Native Agency Operating System
                </span>
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-[-0.04em] text-[#111114] leading-[1.04]">
                Run the work behind every client.
              </h1>

              <p className="text-base sm:text-lg text-[#6B6A65] max-w-xl leading-relaxed font-sans">
                Your clients&apos; brand rules hold the standard. Six specialist AI agents build the campaign. Mobile sign-off and direct publishing ship it without tool sprawl or seat taxes.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/waitlist"
                  className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all flex items-center gap-2 font-sans"
                >
                  <span>Join Waitlist</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#preview"
                  className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all flex items-center gap-2 font-sans"
                >
                  <span>Explore Real UI</span>
                  <ChevronRight className="w-4 h-4 text-[#8C8A84]" />
                </a>

                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#8C8A84] hover:text-[#111114] transition-colors cursor-pointer"
                >
                  <kbd className="px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114]">⌘K</kbd>
                  <span>Index</span>
                </button>
              </div>
            </div>

            {/* Right Column: 3-Layer Stack Specimen (Memory -> 6 Agents -> Approved Asset) */}
            <div className="lg:col-span-6 space-y-3">
              {/* Layer 1 + Layer 2 Quick System Stack */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="#cortex"
                  className="p-3.5 bg-[#FFFFFF] border border-[#EAE7DF] hover:border-[#111114]/40 transition-colors flex items-start gap-3"
                >
                  <span className="w-7 h-7 rounded bg-[#F3F1EC] flex items-center justify-center text-[#111114] shrink-0">
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-[#0F7B6C] font-semibold uppercase">
                      Layer 01 · Brand Judgment
                    </p>
                    <p className="font-heading font-semibold text-xs text-[#111114] mt-0.5">
                      Cortex Memory Vault
                    </p>
                    <p className="text-[11px] text-[#6B6A65] mt-0.5 leading-snug">
                      PDF taboos & voice locked before drafting
                    </p>
                  </div>
                </a>

                <a
                  href="#intelligence"
                  className="p-3.5 bg-[#111114] text-white border border-[#111114] hover:bg-[#1D1D22] transition-colors flex items-start gap-3"
                >
                  <span className="w-7 h-7 rounded bg-[#22222B] flex items-center justify-center text-emerald-400 shrink-0">
                    <Cpu className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-emerald-400 font-semibold uppercase">
                      Layer 02 · Execution Swarm
                    </p>
                    <p className="font-heading font-semibold text-xs text-white mt-0.5">
                      6 Specialist AI Agents
                    </p>
                    <p className="text-[11px] text-white/65 mt-0.5 leading-snug">
                      Parallel research, strategy & auto-QA loop
                    </p>
                  </div>
                </a>
              </div>

              {/* Layer 3: Multi-Client Agency Dispatch Queue (Software-First 500ms Read) */}
              <div className="relative bg-[#FFFFFF] border border-[#EAE7DF] shadow-[0_20px_50px_-15px_rgba(17,17,20,0.10)]">
                <span className="absolute -top-2 -left-2 font-mono text-[10px] text-[#8C8A84] select-none">┌</span>
                <span className="absolute -top-2 -right-2 font-mono text-[10px] text-[#8C8A84] select-none">┐</span>
                <span className="absolute -bottom-2 -left-2 font-mono text-[10px] text-[#8C8A84] select-none">└</span>
                <span className="absolute -bottom-2 -right-2 font-mono text-[10px] text-[#8C8A84] select-none">┘</span>

                {/* Queue Header */}
                <div className="px-4 py-3 border-b border-[#EAE7DF] bg-[#FAF9F6] flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#111114] font-semibold uppercase tracking-wider">
                    Layer 03 · Active Client Dispatch (3 Retainers)
                  </span>
                  <span className="text-[#0F7B6C] font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C] animate-pulse" />
                    ALL PIPELINES LIVE
                  </span>
                </div>

                {/* 3 Concurrent Client Retainer Rows */}
                <div className="divide-y divide-[#EAE7DF]">
                  {heroQueue.map((row) => {
                    const isSelected = row.key === selectedHeroClient;
                    return (
                      <button
                        key={row.key}
                        onClick={() => setSelectedHeroClient(row.key)}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected ? "bg-[#FAF9F6]" : "bg-[#FFFFFF] hover:bg-[#FAF9F6]/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={row.image}
                            alt={row.campaign}
                            className="w-10 h-10 rounded-lg object-cover border border-[#EAE7DF] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-semibold text-xs text-[#111114] truncate">
                                {row.client}
                              </span>
                              <span className="text-[9px] font-mono text-[#8C8A84] uppercase">
                                {row.vertical}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6B6A65] truncate mt-0.5">
                              {row.campaign}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-semibold ${
                              row.statusTone === "emerald"
                                ? "bg-[#DDEDEA] text-[#0F7B6C]"
                                : "bg-[#FBF3DB] text-[#9A6700]"
                            }`}
                          >
                            {row.rule}
                          </span>
                          <p className="text-[10px] font-mono text-[#8C8A84] hidden sm:block">
                            {row.channel}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Focused Retainer Action Bar */}
                <div className="px-4 py-2.5 border-t border-[#EAE7DF] bg-[#FAF9F6] flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-[#6B6A65] truncate flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
                    <span className="truncate">{activeHeroRow.stage}</span>
                  </span>
                  <a
                    href="#preview"
                    onClick={() => setWorkspaceClient(activeHeroRow.key)}
                    className="text-[#111114] font-semibold hover:text-[#0F7B6C] transition-colors shrink-0 inline-flex items-center gap-1"
                  >
                    <span>Open {activeHeroRow.client.split(" ")[0]}</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Masthead Segmented Bottom Truth Rail */}
          <div className="border-t border-[#EAE7DF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE7DF] bg-[#FFFFFF]/60 text-xs text-[#6B6A65]">
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Unlimited seats — zero per-user tax</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Brand guidelines checked pre-draft</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">10-second mobile client approvals</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Zero AI training on client IP</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 2: WHY AGENCIES STALL (Problem Framing BEFORE Workspace)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section
          id="problem"
          style={STONE_GRAIN_STYLE}
          className="bg-[#F3F1EC] border-b border-[#EAE7DF] relative"
        >
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="px-6 sm:px-10 lg:px-12 pt-16 pb-8 border-b border-[#EAE7DF]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              02 // AGENCY ECONOMICS
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114] mt-2 max-w-3xl">
              Why patched-together agency tools break at ten retainers.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EAE7DF]">
            <div className="p-8 sm:p-10 space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#C93B2B] font-semibold">
                  Old Agency Stack · Margin Leak
                </span>
                <span className="font-mono text-xs text-[#C93B2B] tabular-nums">$1,200+/mo Seat Tax</span>
              </div>

              <div className="space-y-4 text-sm">
                <div className="pb-3.5 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Five separate logins per specialist</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Disconnected task boards, shared folders, per-seat AI subscriptions, schedulers, and endless chat threads shrink margin every time you hire.
                  </p>
                </div>

                <div className="pb-3.5 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Brand rules buried in unread PDFs</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Account coordinators and generic prompts forget client taboos and offer boundaries the moment deadlines tighten.
                  </p>
                </div>

                <div>
                  <p className="font-heading font-semibold text-[#111114]">Client approvals stuck in screenshots & emails</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Clients refuse to log into heavy portals, stalling final sign-off until Friday afternoon and holding up production schedules.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-10 space-y-5 bg-[#FFFFFF]/70">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F7B6C] font-semibold">
                  AgencyOS · Compounding Retainers
                </span>
                <span className="font-mono text-xs text-[#0F7B6C] tabular-nums">Unlimited Seats Included</span>
              </div>

              <div className="space-y-4 text-sm">
                <div className="pb-3.5 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Zero per-seat tax as your team grows</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Add strategists, copywriters, video editors, and freelancers freely. Pay strictly for actual AI campaign runs.
                  </p>
                </div>

                <div className="pb-3.5 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Every client rule enforces itself pre-draft</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Cortex blocks prohibited claims and forbidden discounts before any human spends a minute reviewing weak copy.
                  </p>
                </div>

                <div>
                  <p className="font-heading font-semibold text-[#111114]">One-tap phone sign-off triggers delivery</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Clients open a secure review link from their phone with zero passwords, approve in seconds, and unlock the publishing calendar automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 3: FLAGSHIP WORKSPACE (Authentic 14-Route Real UI Copy)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="preview" className="py-18 px-6 sm:px-10 lg:px-12 bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
                03 // LIVE APPLICATION PREVIEW
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                Touch the actual system across 14 agency screens.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#6B6A65] max-w-md font-sans leading-relaxed">
              Not a static screenshot. Switch between Osteria Solis, Linden & Clay, and Cairn Roasters or click any sidebar module to test the real AgencyOS interface.
            </p>
          </div>

          <InteractiveWorkspace
            externalRoute={workspaceRoute}
            externalClient={workspaceClient}
            onTriggerCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 4: SIX-AGENT CREATIVE SWARM (The Obsidian #101014 Centerpiece)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="intelligence" className="py-24 px-6 sm:px-10 lg:px-12 bg-[#101014] text-white border-b border-[#26262B] relative">
          <div className="space-y-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  04 // SIX-AGENT CREATIVE SWARM
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.035em] text-white leading-[1.08]">
                  Six specialists chained like an actual creative department.
                </h2>
                <p className="text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Generic prompts guess in one blind pass. AgencyOS grounds Brand Intelligence first, runs Market Research and Historical Performance in parallel, locks one Strategy, drafts deliverables, and self-heals rule violations in an automated Quality Gate loop.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#16161C] border border-[#26262B] text-[11px] font-mono text-white/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>AUTONOMOUS ORCHESTRATION · AUTO-QA LOOP</span>
              </div>
            </div>

            <AgentSwarmShowcase />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 5: BRAND SAFETY & POCKET CLIENT SIGN-OFF (Unified Trust Bookends)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="cortex" className="py-20 px-6 sm:px-10 lg:px-12 bg-[#FAF9F6] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          {/* Part A: Cortex Proofreader Canvas */}
          <div className="space-y-8 pb-16 border-b border-[#EAE7DF]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
                  05A // CORTEX BRAND MEMORY
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                  Brand guidelines that enforce themselves.
                </h2>
                <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
                  Upload client brand books once. Cortex extracts forbidden claims and pricing rules with source page citations, catching violations live before drafts reach review.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#EAE7DF] shadow-xs">
                <span className="text-xs font-mono text-[#6B6A65]">Live Test:</span>
                <button
                  onClick={() => setViolationTriggered(!violationTriggered)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    violationTriggered
                      ? "bg-[#C93B2B] text-white"
                      : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                  }`}
                >
                  {violationTriggered ? "Restore Clean Proof" : "Inject Rule Violation"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#EAE7DF] bg-[#FFFFFF] shadow-sm overflow-hidden">
              {/* Left: Source Rules */}
              <div className="lg:col-span-5 p-6 bg-[#FAF9F6] border-b lg:border-b-0 lg:border-r border-[#EAE7DF] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111114] flex items-center gap-2 font-sans">
                    <Brain className="w-4 h-4 text-[#111114]" />
                    Osteria Solis · Brand Vault
                  </span>
                  <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                    Human-Verified
                  </span>
                </div>

                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl border bg-[#FFFFFF] space-y-1.5 text-xs transition-all ${
                      violationTriggered ? "border-[#C93B2B] ring-1 ring-[#C93B2B]/20" : "border-[#C93B2B]/25"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#C93B2B] bg-red-50 px-1.5 py-0.5 rounded">
                        Negative Taboo
                      </span>
                      <span className="font-mono text-[10px] text-[#8C8A84] tabular-nums">TABOO-04</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never make medical or therapeutic health claims.
                    </p>
                    <p className="text-[11px] text-[#6B6A65] leading-relaxed">
                      Source Citation: &quot;Brand Charter v2.4, p. 11: Frame all ingredients around hearth craft, never medicinal cures.&quot;
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-xl border bg-[#FFFFFF] space-y-1.5 text-xs transition-all ${
                      violationTriggered ? "border-[#C93B2B] ring-1 ring-[#C93B2B]/20" : "border-[#EAE7DF]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#9A6700] bg-[#FBF3DB] px-1.5 py-0.5 rounded">
                        Pricing Boundary
                      </span>
                      <span className="font-mono text-[10px] text-[#8C8A84] tabular-nums">RULE-01</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never publish percentage discounts on signature tasting dishes.
                    </p>
                    <p className="text-[11px] text-[#6B6A65] leading-relaxed">
                      Source Citation: &quot;Owner Notes: Preserve dining positioning; zero coupon percentages.&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Proofreader Diff & Clean Rewrite */}
              <div className="lg:col-span-7 p-6 sm:p-8 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                    <span className="text-xs font-semibold text-[#111114]">
                      Live Proofreader & Compliance Rewrite
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        violationTriggered
                          ? "bg-red-50 text-[#C93B2B] border border-[#C93B2B]/30"
                          : "bg-[#DDEDEA] text-[#0F7B6C]"
                      }`}
                    >
                      {violationTriggered ? "VIOLATION CAUGHT" : "ALL RULES PASSED"}
                    </span>
                  </div>

                  {violationTriggered ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-red-50/50 border border-[#C93B2B]/30 space-y-2 text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#C93B2B] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Blocked Draft · Matched Against Vault (TABOO-04 & RULE-01):
                        </span>
                        <p className="text-[#111114] text-sm leading-relaxed line-through decoration-[#C93B2B] decoration-2 opacity-80">
                          &quot;Guaranteed 100% cure for inflammation with our wild mushroom reduction — 20% discount this Friday only.&quot;
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#0F7B6C]/35 space-y-2 text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#0F7B6C] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          Compliant Rewrite Ready for Review:
                        </span>
                        <p className="text-[#111114] text-sm leading-relaxed font-medium">
                          &quot;Crafted with wild forest mushrooms, simmered forty-eight hours over oak fire for deep umami richness. Thirty tables served each Friday evening.&quot;
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-3">
                      <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        Clean Production Copy · Ready for Carousel Slide 1
                      </span>
                      <p className="text-[#111114] text-base leading-relaxed font-medium">
                        &quot;Shaved black winter truffles over handmade burrata gnocchi. Thirty limited portions prepared fresh every Friday evening.&quot;
                      </p>
                      <p className="text-xs text-[#6B6A65]">
                        Click &quot;Inject Rule Violation&quot; above to see Cortex block banned phrases against exact PDF citations.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#EAE7DF] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8C8A84]">
                  <span>Source-cited from client PDFs</span>
                  <span>Human-approved vault before every run</span>
                </div>
              </div>
            </div>
          </div>

          {/* Part B: Pocket Sign-Off Studio */}
          <div id="signoff" className="pt-16">
            <div className="max-w-3xl space-y-2 mb-10">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
                05B // POCKET CLIENT SIGN-OFF
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                Clients approve from their phone in ten seconds.
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
                Zero logins or portal passwords. Send a tokenized review room link; slide to sign off on the phone frame and watch the agency desktop update live.
              </p>
            </div>

            <div className="relative flex flex-col lg:flex-row items-center lg:items-stretch justify-center">
              <div className="w-full lg:w-[58%] rounded-2xl border border-[#EAE7DF] bg-[#FFFFFF] p-6 sm:p-10 lg:pr-24 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-3.5">
                    <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                      <span className="text-xs font-semibold text-[#111114]">
                        Agency Desktop · Approval Receiver
                      </span>
                      <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0F7B6C] animate-pulse" />
                        Live Sync Connected
                      </span>
                    </div>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#8C8A84]">Client Brand</span>
                        <span className="text-[#111114] font-semibold">Linden & Clay</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8C8A84]">Review Link</span>
                        <span className="text-[#0F7B6C]">agencyos.app/review/rk_52b19a</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8C8A84]">Audit Trail</span>
                        <span className="text-[#111114]">72h Auto-Lock · Signed Receipt</span>
                      </div>
                    </div>
                  </div>

                  {showDesktopToast ? (
                    <div className="p-4 rounded-xl bg-[#111114] text-white shadow-xl border border-neutral-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Client Approved · Calendar Unlocked
                        </span>
                        <span className="text-white/50">Just now</span>
                      </div>
                      <p className="text-xs text-white/90">
                        Linden & Clay signed off on Botanical Elixir Batch 09 Carousel.
                      </p>
                      <p className="text-[10px] font-mono text-white/60">
                        SHA-256: 7c4a1d...9e3f · Scheduled for Thursday 17:30 dispatch.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-[#EAE7DF] text-xs font-mono text-[#8C8A84]">
                      Slide the sign-off bar on the phone preview to trigger live desktop confirmation...
                    </div>
                  )}
                </div>

                {mobileApproved && (
                  <div>
                    <button
                      onClick={handleResetApproval}
                      className="text-xs font-mono text-[#6B6A65] hover:text-[#111114] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Sign-Off Demo
                    </button>
                  </div>
                )}
              </div>

              {/* Overlapping Mobile Hardware Frame */}
              <div className="w-full max-w-[290px] lg:-ml-14 -mt-6 lg:mt-4 lg:mb-4 z-10 bg-[#FFFFFF] rounded-[34px] border-4 border-[#111114] shadow-[0_24px_60px_-15px_rgba(17,17,20,0.20)] p-4 space-y-3.5">
                <div className="w-20 h-3 bg-[#111114] rounded-full mx-auto" />

                <div className="text-center space-y-0.5">
                  <span className="text-[9px] font-mono text-[#8C8A84] uppercase">Review Room · Linden & Clay</span>
                  <p className="text-xs font-heading font-bold text-[#111114]">Botanical Elixir Batch 09</p>
                </div>

                <div className="relative aspect-[4/4.6] w-full rounded-xl overflow-hidden border border-[#EAE7DF]">
                  <img
                    src="/landing/linden-elixir.jpg"
                    alt="Linden and Clay Botanical Elixir Proof"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#111114]/80 text-white text-[9px] font-mono">
                    SLIDE 1 / 5
                  </div>
                  <div className="absolute bottom-2 inset-x-2 p-2 rounded-lg bg-[#111114]/85 text-white text-[10px] leading-snug">
                    Cold-pressed squalane poured into 100% recyclable amber glass.
                  </div>
                </div>

                {mobileApproved ? (
                  <div className="p-3 rounded-xl bg-[#DDEDEA] border border-[#0F7B6C]/35 text-center space-y-0.5">
                    <p className="text-xs font-bold text-[#0F7B6C] flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Approved & Signed
                    </p>
                    <p className="text-[9px] font-mono text-[#0F7B6C]">Receipt Logged · Ready to Publish</p>
                  </div>
                ) : (
                  <div className="relative h-10 rounded-xl bg-[#F3F1EC] border border-[#EAE7DF] flex items-center px-1 overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[#0F7B6C]/15 transition-all duration-75"
                      style={{ width: `${slideProgress}%` }}
                    />
                    <span className="w-full text-center text-[11px] font-mono text-[#6B6A65] pointer-events-none select-none z-0">
                      Slide or Click to Sign Off →
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={slideProgress}
                      onChange={(e) => handleSlideChange(Number(e.target.value))}
                      onClick={() => {
                        if (slideProgress < 20) triggerApproval();
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      aria-label="Slide to Approve Deliverable"
                    />
                    <div
                      className="w-8 h-8 rounded-lg bg-[#111114] text-white flex items-center justify-center shadow-xs pointer-events-none transition-all z-10 shrink-0"
                      style={{ transform: `translateX(${Math.round((slideProgress / 100) * 192)}px)` }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 6: PRODUCTION & DAILY OPERATIONS (Proportional 2x2 Matrix)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="operations" className="bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="px-6 sm:px-10 lg:px-12 pt-18 pb-10 border-b border-[#EAE7DF]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              06 // PRODUCTION & DAILY DISPATCH
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114] mt-2 max-w-2xl">
              Everything from shoot day to live publish, connected.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE7DF]">
            {/* Quadrant 1: Dependency-Locked Production Tasks */}
            <div className="p-8 sm:p-10 space-y-5 bg-[#FAF9F6]/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#111114] font-semibold flex items-center gap-2">
                  {upstreamApproved ? <Unlock className="w-4 h-4 text-[#0F7B6C]" /> : <Lock className="w-4 h-4 text-[#9A6700]" />}
                  AUTO-UNLOCKED WORKFLOWS
                </span>
                <span className="text-[10px] font-mono text-[#8C8A84]">Task Dependencies</span>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  No Design Starts Before the Brief Clears
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Downstream editing and scheduling tasks stay paused until upstream sign-off lands, ending wasted studio hours.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-[#8C8A84]">STEP 01 · UPSTREAM</span>
                    <p className="font-semibold text-[#111114]">Creative Brief & Compliance Sign-Off</p>
                  </div>
                  <button
                    onClick={() => setUpstreamApproved(!upstreamApproved)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      upstreamApproved ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                    }`}
                  >
                    {upstreamApproved ? "✓ Approved" : "Approve Brief"}
                  </button>
                </div>

                <div className="flex justify-center">
                  <div className={`w-0.5 h-4 transition-colors duration-300 ${upstreamApproved ? "bg-[#0F7B6C]" : "bg-[#EAE7DF]"}`} />
                </div>

                <div
                  className={`p-3.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                    upstreamApproved
                      ? "bg-[#FFFFFF] border-[#0F7B6C]/40 shadow-xs"
                      : "bg-[#F3F1EC] border-dashed border-[#EAE7DF] opacity-65"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-mono text-[#8C8A84]">STEP 02 · DOWNSTREAM</span>
                    <p className="font-semibold text-[#111114]">Carousel Design & Calendar Queue</p>
                  </div>
                  {upstreamApproved ? (
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-semibold">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#8C8A84] bg-[#FFFFFF] px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quadrant 2: Compact Studio Teleprompter (Properly Scoped Production Utility) */}
            <div id="darkroom" className="p-8 sm:p-10 space-y-4 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#0F7B6C] font-semibold flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  SHOOT-DAY TELEPROMPTER
                </span>
                <span className="text-[10px] font-mono text-[#8C8A84]">110–180 WPM · Live Cues</span>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Record Approved Scripts in One Take
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Scripts generated by the Content Architect load straight into a paced teleprompter with scene markers and on-set director cues.
                </p>
              </div>

              <TeleprompterPreview clientKey="solis" theme="light" compact />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE7DF] border-t border-[#EAE7DF]">
            {/* Quadrant 3: Community CRM & Direct Channel Publishing Health */}
            <div className="p-8 sm:p-10 space-y-5 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#0F7B6C] font-semibold flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4" />
                  COMMUNITY INBOX & CHANNEL HEALTH
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#0F7B6C] text-[10px] font-mono font-semibold tabular-nums">
                  Lead Intent: 94/100
                </span>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Convert Hot Comments & Guard Live Publishing
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  High-intent buyers get prioritized concierge replies, while background monitors flag expiring Instagram, Facebook, and LinkedIn connections 72 hours early.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-3 text-xs">
                <div className="flex items-center justify-between font-mono text-[10px] text-[#8C8A84]">
                  <span>@rohan_mehta · Instagram Comment</span>
                  <span>4m ago</span>
                </div>
                <p className="font-semibold text-[#111114]">
                  &quot;Do you take private group bookings for 28 guests next Friday evening?&quot;
                </p>
                <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6B6A65]">
                    Suggested: &quot;Our private hearth dining room is open Friday—concierge DM sent.&quot;
                  </span>
                  <button
                    onClick={() => setCrmReplied(!crmReplied)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium cursor-pointer transition-colors ${
                      crmReplied ? "bg-[#DDEDEA] text-[#0F7B6C]" : "bg-[#111114] text-white"
                    }`}
                  >
                    {crmReplied ? "✓ Sent" : "1-Click Reply"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EAE7DF]">
                  <p className="text-[#111114] font-semibold">Instagram</p>
                  <p className="text-[#0F7B6C] text-[10px] tabular-nums">Healthy · 54d</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EAE7DF]">
                  <p className="text-[#111114] font-semibold">Facebook</p>
                  <p className="text-[#0F7B6C] text-[10px] tabular-nums">Healthy · 54d</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EAE7DF]">
                  <p className="text-[#111114] font-semibold">LinkedIn</p>
                  <p className="text-[#9A6700] text-[10px] tabular-nums">Renew in 48h</p>
                </div>
              </div>
            </div>

            {/* Quadrant 4: Role Permissions & Retainer Margin Shielding */}
            <div className="p-8 sm:p-10 space-y-5 bg-[#FAF9F6]/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#111114] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  CONTRACTOR MARGIN SHIELD
                </span>

                <div className="flex items-center bg-[#FFFFFF] border border-[#EAE7DF] rounded-lg p-0.5 text-[10px] font-mono">
                  <button
                    onClick={() => setRbacRole("owner")}
                    className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                      rbacRole === "owner" ? "bg-[#111114] text-white font-semibold" : "text-[#6B6A65]"
                    }`}
                  >
                    Agency Owner
                  </button>
                  <button
                    onClick={() => setRbacRole("freelancer")}
                    className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                      rbacRole === "freelancer" ? "bg-[#111114] text-white font-semibold" : "text-[#6B6A65]"
                    }`}
                  >
                    Freelance Editor
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Keep Retainers & Margins Private from Contractors
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Invite outside editors or strategists into client deliverables while hiding billing ledgers, margins, and sibling retainers automatically.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] pb-2.5 border-b border-[#EAE7DF]">
                  <span className="text-[#6B6A65]">Monthly Retainer Fee</span>
                  {rbacRole === "owner" ? (
                    <span className="text-[#111114] font-semibold tabular-nums flex items-center gap-1.5">
                      <Eye className="w-3 h-3 text-[#0F7B6C]" /> $4,800 / mo (68% Margin)
                    </span>
                  ) : (
                    <span className="text-[#C93B2B] bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
                      <EyeOff className="w-3 h-3" /> [HIDDEN · OWNER ONLY]
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pb-2.5 border-b border-[#EAE7DF]">
                  <span className="text-[#6B6A65]">Other Agency Clients</span>
                  {rbacRole === "owner" ? (
                    <span className="text-[#111114] font-semibold">12 Active Retainers Visible</span>
                  ) : (
                    <span className="text-[#C93B2B] bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
                      <EyeOff className="w-3 h-3" /> [ISOLATED TO SOLIS ONLY]
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6A65]">Assigned Shoot Queue</span>
                  <span className="text-[#0F7B6C] font-semibold">Winter Tasting Reel Cut · Due Fri</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8C8A84]">
                <CalendarDays className="w-3.5 h-3.5 text-[#0F7B6C]" />
                <span>Synced directly with Omnichannel Calendar & ROI Reporting</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 7: PRICING ECONOMICS & CLOSING SIGN-OFF
           ═══════════════════════════════════════════════════════════════════════ */}
        <section
          id="pricing"
          style={STONE_GRAIN_STYLE}
          className="py-20 px-6 sm:px-10 lg:px-12 bg-[#F3F1EC] border-b border-[#EAE7DF] relative"
        >
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl space-y-2 mb-10">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              07 // AGENCY ECONOMICS
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
              Scale retainers without seat penalties.
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              One base workspace with unlimited team members and clients. Model your monthly margin savings against multi-tool seat subscriptions below.
            </p>
          </div>

          <MarginCalculator />
        </section>

        {/* Closing Sign-Off */}
        <section id="closing" className="py-20 px-6 sm:px-10 lg:px-12 text-center bg-[#FAF9F6] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl mx-auto space-y-6">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              AGENCYOS BY BRIEVA
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.035em] text-[#111114] leading-[1.08]">
              Run every client on one brand brain and six specialist agents.
            </h2>
            <p className="text-sm sm:text-base text-[#6B6A65] max-w-2xl mx-auto leading-relaxed font-sans">
              Stop losing margin to disconnected software and slow approvals. Launch your workspace in minutes with unlimited seats included.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/waitlist"
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all flex items-center gap-2 font-sans"
              >
                <span>Join Waitlist</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#intelligence"
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all font-sans"
              >
                Inspect 6-Agent Graph
              </a>
            </div>
          </div>
        </section>

        {/* Architectural Footer */}
        <footer className="py-12 px-6 sm:px-10 lg:px-12 border-t border-[#EAE7DF] bg-[#FFFFFF] text-xs text-[#6B6A65]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#111114] text-white flex items-center justify-center font-mono text-xs font-bold">
                  A
                </div>
                <span className="font-heading font-bold text-sm text-[#111114]">AgencyOS</span>
              </div>
              <p className="text-[11px] leading-relaxed font-sans">
                The Operating System for Modern Marketing Agencies. Built by Brieva.
              </p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Platform</p>
              <p><a href="#preview" className="hover:text-[#111114]">Live Workspace (14 Screens)</a></p>
              <p><a href="#intelligence" className="hover:text-[#111114]">6-Agent Creative Swarm</a></p>
              <p><a href="#cortex" className="hover:text-[#111114]">Cortex Brand Memory</a></p>
              <p><a href="#signoff" className="hover:text-[#111114]">Pocket Client Sign-Off</a></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Operations</p>
              <p><a href="#operations" className="hover:text-[#111114]">Task Dependencies & CRM</a></p>
              <p><a href="#darkroom" className="hover:text-[#111114]">Shoot-Day Teleprompter</a></p>
              <p><a href="#pricing" className="hover:text-[#111114]">Agency Economics</a></p>
              <p><Link href="/login" className="hover:text-[#111114]">Agency Sign In</Link></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Governance</p>
              <p>Unlimited Team Seats</p>
              <p>Zero AI Training on Client IP</p>
              <p>Contractor Margin Isolation</p>
              <p className="text-[#0F7B6C] font-mono text-[10px] pt-1">All Systems Operational</p>
            </div>
          </div>

          <div className="pt-6 border-t border-[#EAE7DF] flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <span>© 2026 AgencyOS by Brieva. All rights reserved.</span>
            <span>AI-Native Agency Infrastructure</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
