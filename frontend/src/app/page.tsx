"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  BarChart3,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/landing/Navbar";
import { CommandPalette } from "@/components/landing/CommandPalette";
import { InteractiveWorkspace, ClientKey } from "@/components/landing/InteractiveWorkspace";
import { TeleprompterPreview } from "@/components/landing/TeleprompterPreview";
import { MarginCalculator } from "@/components/landing/MarginCalculator";

// Subtle 2% archival SVG noise texture for stone (#F3F1EC) surfaces
const STONE_GRAIN_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.025'/%3E%3C/svg%3E")`,
};

const AGENT_PIPELINE = [
  {
    num: "01",
    role: "Strategy Agent",
    tag: "Positioning & Hooks",
    desc: "Analyzes seasonal client briefs, audience segment insights, and conversion angles.",
    solisOutput: "Angle: Artisanal Friday rarity (30 portions nightly). Target: Private dining & culinary patrons.",
    lindenOutput: "Angle: Clean moisture barrier calm. Target: Sensitive-skin ritual buyers seeking gentle botanicals.",
  },
  {
    num: "02",
    role: "Content Architect",
    tag: "Carousels & Scripts",
    desc: "Drafts 5-slide visual carousel narratives, caption hooks, and scene-timed reel scripts.",
    solisOutput: "Slide 1 Hook: 'Shaved black winter truffles over handmade burrata gnocchi—thirty tables only.'",
    lindenOutput: "Slide 1 Hook: 'Three cold-pressed drops over damp linen-toweled skin. Formulated for reactive barriers.'",
  },
  {
    num: "03",
    role: "Compliance Evaluator",
    tag: "Cortex Gatekeeper",
    desc: "Audits every draft word-for-word against Cortex taboos, provenance rules, and legal boundaries.",
    solisOutput: "Passed TABOO-01 (No health claims) and RULE-04 (Zero discount percentages on hearth menu).",
    lindenOutput: "Passed TABOO-02 (No synthetic disparagement) and RULE-05 (Recyclable amber glass callout present).",
  },
  {
    num: "04",
    role: "Publishing Agent",
    tag: "Channel Formatting",
    desc: "Formats 4:5 portrait crops, 9:16 reel safe zones, hashtag sets, and optimal dispatch windows.",
    solisOutput: "Crops locked to 4:5 safe area · Scheduled for Friday 18:00 Instagram Carousel + Facebook Reel.",
    lindenOutput: "Crops locked to 4:5 safe area · Scheduled for Thursday 17:30 Instagram Ritual + LinkedIn Note.",
  },
  {
    num: "05",
    role: "Analytics Agent",
    tag: "Historical Lift",
    desc: "Reads past post engagement data to calibrate hook pacing, format mix, and retainer cadence.",
    solisOutput: "Projected Save Rate: 6.8% based on prior 90-day candlelit culinary carousels.",
    lindenOutput: "Projected Save Rate: 8.2% based on prior ingredient-education botanical reels.",
  },
  {
    num: "06",
    role: "Orchestrator",
    tag: "Artifact Assembly",
    desc: "Bundles approved outputs into structured Campaign Plans ready for client sign-off and scheduling.",
    solisOutput: "Artifact Locked -> Pushed to Winter Tasting Campaign Plan & Magic-Link Review Queue.",
    lindenOutput: "Artifact Locked -> Pushed to Batch 09 Launch Plan & Mobile Sign-Off Room.",
  },
];

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [workspaceRoute, setWorkspaceRoute] = useState<any>("dashboard");
  const [workspaceClient, setWorkspaceClient] = useState<ClientKey>("solis");

  // Stage 1: Hero Specimen client preview tab
  const [heroSpecimen, setHeroSpecimen] = useState<"solis" | "cairn">("solis");

  // Stage 4: Cortex Violation Injection
  const [violationTriggered, setViolationTriggered] = useState(false);

  // Stage 5: Interactive 6-Agent Brief Trace
  const [activeBrief, setActiveBrief] = useState<"solis" | "linden">("solis");
  const [activeAgentIdx, setActiveAgentIdx] = useState<number>(2);

  // Stage 7: DAG Dependency Pipeline, Community CRM, & RBAC Role Switcher
  const [upstreamApproved, setUpstreamApproved] = useState(false);
  const [crmReplied, setCrmReplied] = useState(false);
  const [rbacRole, setRbacRole] = useState<"owner" | "freelancer">("owner");

  // Stage 8: Pocket Sign-Off Studio (Slide-to-Approve + Desktop WebSocket Toast)
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [mobileApproved, setMobileApproved] = useState(false);
  const [showDesktopToast, setShowDesktopToast] = useState(false);

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

  const heroSpecimens = {
    solis: {
      client: "OSTERIA SOLIS",
      title: "Winter Truffle Tasting Launch",
      meta: "6 Agents · Magic-Link Armed",
      badge: "4:5 CAROUSEL · HEARTH MENU",
      rule: "TABOO-04 VERIFIED",
      image: "/landing/solis-truffle.jpg",
      swatches: ["#1C1917", "#9A6700", "#D6CFC2"],
    },
    cairn: {
      client: "CAIRN ROASTERS",
      title: "Anaerobic Highland Micro-Lot",
      meta: "6 Agents · Roast Batch Verified",
      badge: "4:5 CAROUSEL · SINGLE ORIGIN",
      rule: "RULE-03 VERIFIED",
      image: "/landing/cairn-coffee.jpg",
      swatches: ["#3B2820", "#8C7A6B", "#FAF9F6"],
    },
  };

  const currentHeroSpec = heroSpecimens[heroSpecimen];
  const currentAgent = AGENT_PIPELINE[activeAgentIdx];

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
            STAGE 1: MASTHEAD HERO (Asymmetric Split + Interactive Proof Specimen)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="hero" className="border-b border-[#EAE7DF] bg-[#FAF9F6] relative">
          <div className="px-6 sm:px-10 lg:px-12 pt-16 pb-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Editorial Thesis */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
                <span className="text-[#111114] font-semibold">01 // MASTHEAD</span>
                <span className="text-[#EAE7DF]">|</span>
                <span>AI-Native Agency Operating System</span>
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-[-0.04em] text-[#111114] leading-[1.04]">
                Run the work behind every client.
              </h1>

              <p className="text-base sm:text-lg text-[#6B6A65] max-w-xl leading-relaxed font-sans">
                Institutional brand memory, six specialized AI agents, mobile client approvals, dependency-locked production, and omnichannel publishing inside one deterministic workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={isAuthenticated ? "/dashboard" : "/signup"}
                  className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all flex items-center gap-2 font-sans"
                >
                  <span>{isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#preview"
                  className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all flex items-center gap-2 font-sans"
                >
                  <span>Explore the System</span>
                  <ChevronRight className="w-4 h-4 text-[#8C8A84]" />
                </a>

                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#8C8A84] hover:text-[#111114] transition-colors cursor-pointer"
                >
                  <kbd className="px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114]">⌘K</kbd>
                  <span>Stage Index</span>
                </button>
              </div>
            </div>

            {/* Right Column: Interactive Brand Proof Specimen Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative p-4 sm:p-5 bg-[#FFFFFF] border border-[#EAE7DF] shadow-[0_20px_50px_-15px_rgba(17,17,20,0.12)]">
                <span className="absolute -top-2 -left-2 font-mono text-[10px] text-[#8C8A84] select-none">┌</span>
                <span className="absolute -top-2 -right-2 font-mono text-[10px] text-[#8C8A84] select-none">┐</span>
                <span className="absolute -bottom-2 -left-2 font-mono text-[10px] text-[#8C8A84] select-none">└</span>
                <span className="absolute -bottom-2 -right-2 font-mono text-[10px] text-[#8C8A84] select-none">┘</span>

                {/* Specimen Header with Live Specimen Switcher */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EAE7DF] text-[10px] font-mono text-[#6B6A65]">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setHeroSpecimen("solis")}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        heroSpecimen === "solis" ? "bg-[#111114] text-white" : "hover:bg-[#F3F1EC]"
                      }`}
                    >
                      FIG 1.0 · SOLIS
                    </button>
                    <button
                      onClick={() => setHeroSpecimen("cairn")}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        heroSpecimen === "cairn" ? "bg-[#111114] text-white" : "hover:bg-[#F3F1EC]"
                      }`}
                    >
                      FIG 1.1 · CAIRN
                    </button>
                  </div>
                  <span className="text-[#0F7B6C] font-semibold">COMPLIANCE PASSED</span>
                </div>

                {/* Editorial Photography Frame */}
                <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#EAE7DF] mb-3.5 bg-[#1C1917]">
                  <img
                    src={currentHeroSpec.image}
                    alt={currentHeroSpec.title}
                    className="w-full h-full object-cover transition-opacity duration-200"
                  />
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#111114]/85 text-white text-[9px] font-mono tracking-wider">
                    {currentHeroSpec.badge}
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-[#0F7B6C] text-white text-[9px] font-mono font-semibold">
                    {currentHeroSpec.rule}
                  </div>
                </div>

                {/* Specimen Metadata Footer */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-heading font-semibold text-[#111114] text-xs">
                      {currentHeroSpec.title}
                    </p>
                    <p className="text-[11px] font-mono text-[#8C8A84]">
                      {currentHeroSpec.client} · {currentHeroSpec.meta}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" title="Approved Brand Palette">
                    {currentHeroSpec.swatches.map((hex) => (
                      <span
                        key={hex}
                        className="w-3.5 h-3.5 rounded-full border border-[#EAE7DF]"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Masthead Segmented Bottom Truth Rail */}
          <div className="border-t border-[#EAE7DF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE7DF] bg-[#FFFFFF]/60 text-xs text-[#6B6A65]">
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Unlimited team members & free seats</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Deterministic brand rules & taboos</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Direct Instagram, FB & LinkedIn publishing</span>
            </div>
            <div className="px-6 py-3.5 flex items-center gap-2.5">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Zero AI model training on client IP</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 2: FLAGSHIP WORKSPACE (One system across the agency)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="preview" className="py-20 px-6 sm:px-10 lg:px-12 bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
                02 // FLAGSHIP WORKSPACE
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                One system across the agency.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#6B6A65] max-w-md font-sans leading-relaxed">
              Switch between Osteria Solis, Linden & Clay, and Cairn Roasters in the top-left client switcher, or test all 13 live screens.
            </p>
          </div>

          <InteractiveWorkspace
            externalRoute={workspaceRoute}
            externalClient={workspaceClient}
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 3: FRAGMENTED CHAOS VS. DETERMINISTIC SYSTEM (Stone + 2% Grain)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section
          id="problem"
          style={STONE_GRAIN_STYLE}
          className="bg-[#F3F1EC] border-b border-[#EAE7DF] relative"
        >
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="px-6 sm:px-10 lg:px-12 pt-20 pb-10 border-b border-[#EAE7DF]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              03 // OPERATIONAL CONTRAST
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114] mt-2 max-w-3xl">
              Why patched-together tools break at ten retainers.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EAE7DF]">
            {/* Left Broadsheet Column: Fragmented Chaos (Zero Competitor/Tool Brand Names) */}
            <div className="p-8 sm:p-12 space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#C93B2B] font-semibold">
                  Legacy Stack · Unstructured Noise
                </span>
                <span className="font-mono text-xs text-[#C93B2B] tabular-nums">$1,200+/mo Seat Tax</span>
              </div>

              <div className="space-y-5 text-sm">
                <div className="pb-4 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Five disconnected subscriptions per specialist</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Separate task boards, static document folders, per-seat AI prompts, standalone schedulers, and endless messaging threads bleed agency margin every time you hire.
                  </p>
                </div>

                <div className="pb-4 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Brand guidelines buried in unread PDFs</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Junior strategists and generic prompts forget regulatory taboos and pricing boundaries the moment campaign deadlines accelerate.
                  </p>
                </div>

                <div>
                  <p className="font-heading font-semibold text-[#111114]">Client sign-offs trapped in chat threads</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Clients refuse to remember passwords for heavy agency portals, leaving approvals scattered across screenshots, voice notes, and email chains.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Broadsheet Column: Deterministic System */}
            <div className="p-8 sm:p-12 space-y-6 bg-[#FFFFFF]/65">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F7B6C] font-semibold">
                  AgencyOS · Deterministic Pipeline
                </span>
                <span className="font-mono text-xs text-[#0F7B6C] tabular-nums">Unlimited Seats Included</span>
              </div>

              <div className="space-y-5 text-sm">
                <div className="pb-4 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Zero per-seat tax across your entire team</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Add account directors, copywriters, video editors, and freelancers freely. Pay strictly for actual AI generation runs.
                  </p>
                </div>

                <div className="pb-4 border-b border-[#EAE7DF]">
                  <p className="font-heading font-semibold text-[#111114]">Institutional memory enforced pre-draft</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Cortex blocks prohibited health claims and forbidden discounts automatically before a single deliverable ever enters internal review.
                  </p>
                </div>

                <div>
                  <p className="font-heading font-semibold text-[#111114]">1-click mobile sign-off with cryptographic audit</p>
                  <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                    Tokenized review rooms open instantly on any client phone, locking signed assets directly into your omnichannel publishing calendar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 4: CORTEX — PROOFREADER CANVAS
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="cortex" className="py-20 px-6 sm:px-10 lg:px-12 bg-[#FAF9F6] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
                04 // CORTEX PROOFREADER CANVAS
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                Deterministic brand rules, taboos, and provenance.
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
                Cortex extracts hard boundaries from client PDFs into a human-reviewed vault. Test what happens when draft copy breaks a client boundary.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#EAE7DF] shadow-xs">
              <span className="text-xs font-mono text-[#6B6A65]">Proofreader Test:</span>
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
            {/* Left: Living Brand Vault Source Rules */}
            <div className="lg:col-span-5 p-6 bg-[#FAF9F6] border-b lg:border-b-0 lg:border-r border-[#EAE7DF] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111114] flex items-center gap-2 font-sans">
                  <Brain className="w-4 h-4 text-[#111114]" />
                  Osteria Solis · Brand Vault
                </span>
                <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                  Strict Lock
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
                    PDF Provenance: &quot;Brand Charter v2.4, p. 11: Frame all ingredients around hearth craft, never medicinal cures.&quot;
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
                    PDF Provenance: &quot;Owner Notes: Preserve dining positioning; zero coupon percentages.&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Live Red-Ink Markup & Corrective Rewrite */}
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                  <span className="text-xs font-semibold text-[#111114]">
                    Compliance Diff & Auto-Correction Stream
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      violationTriggered
                        ? "bg-red-50 text-[#C93B2B] border border-[#C93B2B]/30"
                        : "bg-[#DDEDEA] text-[#0F7B6C]"
                    }`}
                  >
                    {violationTriggered ? "VIOLATION INTERCEPTED" : "ALL RULES PASSED"}
                  </span>
                </div>

                {violationTriggered ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-red-50/50 border border-[#C93B2B]/30 space-y-2 text-xs">
                      <span className="text-[10px] font-mono font-bold text-[#C93B2B] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Blocked Draft · Matched Against Left Vault (TABOO-04 & RULE-01):
                      </span>
                      <p className="text-[#111114] text-sm leading-relaxed line-through decoration-[#C93B2B] decoration-2 opacity-80">
                        &quot;Guaranteed 100% cure for inflammation with our wild mushroom reduction — 20% discount this Friday only.&quot;
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#0F7B6C]/35 space-y-2 text-xs">
                      <span className="text-[10px] font-mono font-bold text-[#0F7B6C] flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Deterministic Compliance Rewrite:
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
                      Click &quot;Inject Rule Violation&quot; above to watch Cortex highlight prohibited claims against the exact source PDF rules.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#EAE7DF] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8C8A84]">
                <span>Human-in-the-Loop Queue: 3 Pending PDF Rules</span>
                <span>Zero Passive Vector Hallucinations</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 5: CAMPAIGN INTELLIGENCE (Interactive 6-Agent Brief Trace)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="intelligence" className="py-20 px-6 sm:px-10 lg:px-12 bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
                05 // CAMPAIGN INTELLIGENCE
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
                Six specialist agents, chained like an actual creative department.
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
                Click any agent step or toggle the sample brief to inspect how strategy, copy, compliance, and analytics hand off verified artifacts.
              </p>
            </div>

            <div className="flex items-center bg-[#F3F1EC] p-1 rounded-xl border border-[#EAE7DF] text-xs font-mono">
              <button
                onClick={() => setActiveBrief("solis")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeBrief === "solis" ? "bg-[#111114] text-white font-semibold" : "text-[#6B6A65] hover:text-[#111114]"
                }`}
              >
                Brief: Osteria Solis
              </button>
              <button
                onClick={() => setActiveBrief("linden")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeBrief === "linden" ? "bg-[#111114] text-white font-semibold" : "text-[#6B6A65] hover:text-[#111114]"
                }`}
              >
                Brief: Linden & Clay
              </button>
            </div>
          </div>

          <div className="border border-[#EAE7DF] bg-[#FAF9F6]">
            {/* 6 Interactive Agent Cells */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE7DF]">
              {AGENT_PIPELINE.map((agent, i) => {
                const isSelected = activeAgentIdx === i;
                return (
                  <button
                    key={agent.num}
                    onClick={() => setActiveAgentIdx(i)}
                    className={`p-6 text-left transition-all cursor-pointer relative ${
                      i >= 3 ? "lg:border-t border-[#EAE7DF]" : ""
                    } ${isSelected ? "bg-[#FFFFFF]" : "bg-[#FAF9F6]/70 hover:bg-[#FFFFFF]/80"}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="active-agent-highlight"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="absolute inset-x-0 top-0 h-0.5 bg-[#111114]"
                      />
                    )}
                    <div className="flex items-center justify-between text-[10px] font-mono mb-3">
                      <span className={isSelected ? "text-[#111114] font-bold" : "text-[#8C8A84]"}>
                        AGENT {agent.num}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          isSelected
                            ? "bg-[#111114] text-white border-[#111114]"
                            : "bg-[#FFFFFF] border-[#EAE7DF] text-[#6B6A65]"
                        }`}
                      >
                        {agent.tag}
                      </span>
                    </div>
                    <h3 className="font-heading text-base font-bold text-[#111114] mb-1.5">
                      {agent.role}
                    </h3>
                    <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
                      {agent.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Live Handoff Artifact Bar */}
            <div className="border-t border-[#EAE7DF] bg-[#111114] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                  <span>HANDOFF PAYLOAD · AGENT {currentAgent.num} ({currentAgent.role.toUpperCase()})</span>
                </div>
                <p className="text-xs sm:text-sm font-sans text-white/90">
                  {activeBrief === "solis" ? currentAgent.solisOutput : currentAgent.lindenOutput}
                </p>
              </div>
              <button
                onClick={() => setActiveAgentIdx((prev) => (prev + 1) % AGENT_PIPELINE.length)}
                className="px-3.5 py-2 rounded-lg bg-[#26262B] hover:bg-[#34343B] text-white text-xs font-mono shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Next Agent Step</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 6: DARKROOM PRODUCTION SUITE (Obsidian #101014 Band)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="darkroom" className="py-24 px-6 sm:px-10 lg:px-12 bg-[#101014] text-white border-b border-[#26262B] relative">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  06 // DARKROOM PRODUCTION SUITE
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
                  Studio teleprompter and short-form video delivery.
                </h2>
                <p className="text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Turn approved scripts into single-take reels. Dial speaking pace from 110 to 180 words per minute to govern live auto-scroll speed, scene hooks, and director cues.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#17171E] border border-[#26262B] text-[11px] font-mono text-white/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>9:16 REEL SUITE · 24FPS</span>
              </div>
            </div>

            <TeleprompterPreview clientKey="solis" theme="dark" />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 7: DAILY OPERATIONS (Edge-to-Edge Swiss Structural Matrix)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="operations" className="bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="px-6 sm:px-10 lg:px-12 pt-20 pb-10 border-b border-[#EAE7DF]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              07 // DAILY OPERATIONS
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114] mt-2 max-w-2xl">
              Daily dispatch, without the group-chat circus.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE7DF]">
            {/* Cell 1: DAG Execution & Dependency-Locked Pipeline */}
            <div className="p-8 sm:p-10 space-y-6 bg-[#FAF9F6]/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#111114] font-semibold flex items-center gap-2">
                  {upstreamApproved ? <Unlock className="w-4 h-4 text-[#0F7B6C]" /> : <Lock className="w-4 h-4 text-[#9A6700]" />}
                  DAG TASK ENGINE
                </span>
                <span className="text-[10px] font-mono text-[#8C8A84]">Interactive Circuit</span>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Dependency-Locked Production Pipeline
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Downstream design and social publishing cards stay frosted and locked until upstream creative brief sign-offs clear.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-[#8C8A84]">STEP 01 · UPSTREAM</span>
                    <p className="font-semibold text-[#111114]">Creative Brief & Taboo Sign-off</p>
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
                  <div className={`w-0.5 h-5 transition-colors duration-300 ${upstreamApproved ? "bg-[#0F7B6C]" : "bg-[#EAE7DF]"}`} />
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
                    <p className="font-semibold text-[#111114]">Carousel Production & Direct Publishing</p>
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

            {/* Cell 2: Community CRM & Buying-Intent Triage */}
            <div className="p-8 sm:p-10 space-y-6 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#0F7B6C] font-semibold flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4" />
                  COMMUNITY CRM INBOX
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#0F7B6C] text-[10px] font-mono font-semibold tabular-nums">
                  Lead Intent: 94/100
                </span>
              </div>

              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Real-Time Comment Triage & Verified Replies
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Inbound Meta and LinkedIn comments are scored for buying intent and paired with Cortex-verified concierge replies.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-3 text-xs">
                <div className="flex items-center justify-between font-mono text-[10px] text-[#8C8A84]">
                  <span>@rohan_mehta · Instagram</span>
                  <span>4m ago</span>
                </div>
                <p className="font-semibold text-[#111114]">
                  &quot;Do you take private group bookings for 28 guests next Friday evening?&quot;
                </p>
                <div className="p-3 rounded-lg bg-[#FFFFFF] border border-[#EAE7DF] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6B6A65]">
                    Draft: &quot;Our private hearth dining room is open Friday—concierge DM sent.&quot;
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
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE7DF] border-t border-[#EAE7DF]">
            {/* Cell 3: OAuth Monitoring & Connection Health */}
            <div className="p-8 sm:p-10 space-y-5 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#111114] font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#0F7B6C]" />
                  OAUTH HEALTH MONITOR
                </span>
                <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                  72h Expiry Guard Active
                </span>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-[#111114]">
                  Proactive Token Alerts Before Posts Fail
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Background monitors inspect Meta Graph and LinkedIn OAuth tokens continuously, alerting account managers 72 hours prior to expiration.
                </p>
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

            {/* Cell 4: Interactive RBAC & Tenant Isolation Matrix */}
            <div className="p-8 sm:p-10 space-y-5 bg-[#FAF9F6]/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#111114] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  RBAC & TENANT ISOLATION
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
                  Isolate Freelancers from Agency Margins
                </h3>
                <p className="text-xs text-[#6B6A65] mt-1 leading-relaxed">
                  Toggle the role above to inspect live field-level access shielding across contracts, billing ledgers, and deliverables.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6A65]">Monthly Retainer Fee</span>
                  {rbacRole === "owner" ? (
                    <span className="text-[#111114] font-semibold tabular-nums flex items-center gap-1.5">
                      <Eye className="w-3 h-3 text-[#0F7B6C]" /> $4,800 / mo (68% Margin)
                    </span>
                  ) : (
                    <span className="text-[#C93B2B] bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
                      <EyeOff className="w-3 h-3" /> [REDACTED · OWNER TIER]
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6A65]">Assigned Creative Queue</span>
                  <span className="text-[#0F7B6C] font-semibold">Winter Tasting Reel Cut · Due Fri</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 8: POCKET SIGN-OFF STUDIO (Overlapping Hardware + Slide-to-Approve)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="signoff" className="py-20 px-6 sm:px-10 lg:px-12 bg-[#FFFFFF] border-b border-[#EAE7DF] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl space-y-2 mb-12">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
              08 // POCKET SIGN-OFF STUDIO
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
              Clients approve from their phone in two seconds.
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              No logins or app installs. Dispatch a 72-hour tokenized Magic Link for Linden & Clay; slide to sign off on mobile and watch the desktop workspace update live over WebSockets.
            </p>
          </div>

          <div className="relative flex flex-col lg:flex-row items-center lg:items-stretch justify-center">
            {/* Desktop Receiver Panel (Left Recessed Studio Pane) */}
            <div className="w-full lg:w-[58%] rounded-2xl border border-[#EAE7DF] bg-[#FAF9F6] p-6 sm:p-10 lg:pr-24 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
                    <span className="text-xs font-semibold text-[#111114]">
                      Agency Desktop · Approval Receiver
                    </span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0F7B6C] animate-pulse" />
                      WebSocket Listening
                    </span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#8C8A84]">Client Brand</span>
                      <span className="text-[#111114] font-semibold">Linden & Clay</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8C8A84]">Magic Link</span>
                      <span className="text-[#0F7B6C]">agencyos.app/review/rk_52b19a</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8C8A84]">Security</span>
                      <span className="text-[#111114]">72h Auto-Lock · SHA-256</span>
                    </div>
                  </div>
                </div>

                {showDesktopToast ? (
                  <div className="p-4 rounded-xl bg-[#111114] text-white shadow-xl border border-neutral-800 space-y-1.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        WebSocket Event: Client Approved
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
                    Slide the mobile sign-off bar on the phone frame to fire live WebSocket confirmation...
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

            {/* Overlapping Mobile Hardware Frame (Linden & Clay Visual Proof) */}
            <div className="w-full max-w-[300px] lg:-ml-14 -mt-6 lg:mt-6 lg:mb-6 z-10 bg-[#FFFFFF] rounded-[34px] border-4 border-[#111114] shadow-[0_24px_60px_-15px_rgba(17,17,20,0.22)] p-4 space-y-4">
              <div className="w-20 h-3.5 bg-[#111114] rounded-full mx-auto" />

              <div className="text-center space-y-0.5">
                <span className="text-[9px] font-mono text-[#8C8A84] uppercase">Review Room · Linden & Clay</span>
                <p className="text-xs font-heading font-bold text-[#111114]">Botanical Elixir Batch 09</p>
              </div>

              <div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden border border-[#EAE7DF]">
                <img
                  src="/landing/linden-elixir.jpg"
                  alt="Linden and Clay Botanical Elixir Proof"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#111114]/80 text-white text-[9px] font-mono">
                  SLIDE 1 / 5
                </div>
                <div className="absolute bottom-2 inset-x-2 p-2 rounded-lg bg-[#111114]/85 text-white backdrop-blur-xs text-[10px] leading-snug">
                  Cold-pressed squalane poured into 100% recyclable amber glass.
                </div>
              </div>

              {mobileApproved ? (
                <div className="p-3 rounded-xl bg-[#DDEDEA] border border-[#0F7B6C]/35 text-center space-y-0.5">
                  <p className="text-xs font-bold text-[#0F7B6C] flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Approved & Signed
                  </p>
                  <p className="text-[9px] font-mono text-[#0F7B6C]">SHA-256 Hash Locked</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Tactile Slide-to-Approve Track */}
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
                      style={{ transform: `translateX(${Math.round((slideProgress / 100) * 200)}px)` }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 9: PUBLISHING & ECONOMICS (Stone + 2% Grain + Swiss Ledger)
           ═══════════════════════════════════════════════════════════════════════ */}
        <section
          id="pricing"
          style={STONE_GRAIN_STYLE}
          className="py-20 px-6 sm:px-10 lg:px-12 bg-[#F3F1EC] border-b border-[#EAE7DF] relative"
        >
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl space-y-2 mb-12">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              09 // PUBLISHING & ECONOMICS
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#111114]">
              Omnichannel publishing and zero per-seat penalties.
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65] font-sans leading-relaxed">
              Approved assets dispatch directly to Instagram, Facebook, and LinkedIn via distributed worker queues, while unlimited team seats protect your agency margins as you scale retainers.
            </p>
          </div>

          {/* Publishing & Analytics Pillar Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-[#EAE7DF] divide-y md:divide-y-0 md:divide-x divide-[#EAE7DF] bg-[#FFFFFF] mb-10">
            <div className="p-6 space-y-2">
              <div className="flex items-center gap-2 text-xs font-heading font-semibold text-[#111114]">
                <CalendarDays className="w-4 h-4 text-[#0F7B6C]" />
                <span>Omnichannel Calendar</span>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Monthly and weekly grids syncing directly from Phased Campaign Plans with drag-and-drop rescheduling.
              </p>
            </div>
            <div className="p-6 space-y-2">
              <div className="flex items-center gap-2 text-xs font-heading font-semibold text-[#111114]">
                <Send className="w-4 h-4 text-[#0F7B6C]" />
                <span>Direct Meta & LinkedIn Dispatch</span>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Distributed publication workers with lease locking prevent duplicate posts and handle retries automatically.
              </p>
            </div>
            <div className="p-6 space-y-2">
              <div className="flex items-center gap-2 text-xs font-heading font-semibold text-[#111114]">
                <BarChart3 className="w-4 h-4 text-[#0F7B6C]" />
                <span>Retainer ROI Analytics</span>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Automated metric workers track organic lift, impressions, and specialist time saved across client accounts.
              </p>
            </div>
          </div>

          <MarginCalculator />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 10: CLOSING SIGN-OFF & ARCHITECTURAL FOOTER
           ═══════════════════════════════════════════════════════════════════════ */}
        <section id="closing" className="py-24 px-6 sm:px-10 lg:px-12 text-center bg-[#FAF9F6] relative">
          <div className="absolute -top-2.5 -left-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>
          <div className="absolute -top-2.5 -right-2.5 select-none font-mono text-xs text-[#8C8A84] pointer-events-none">+</div>

          <div className="max-w-3xl mx-auto space-y-6">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65]">
              10 // CLOSING SIGN-OFF
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.035em] text-[#111114] leading-[1.08]">
              Run every client retainer on one deterministic system.
            </h2>
            <p className="text-sm sm:text-base text-[#6B6A65] max-w-2xl mx-auto leading-relaxed font-sans">
              Zero brand drift, zero seat taxes, and 1-click mobile client approvals. Built for agencies that refuse to ship mediocre work.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all flex items-center gap-2 font-sans"
              >
                <span>{isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#preview"
                className="px-6 py-3 rounded-full text-sm font-medium bg-[#FFFFFF] border border-[#EAE7DF] text-[#111114] hover:bg-[#F3F1EC] transition-all font-sans"
              >
                Return to Live Workspace
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
              <p className="font-semibold text-[#111114]">Architecture</p>
              <p><a href="#preview" className="hover:text-[#111114]">Flagship Workspace</a></p>
              <p><a href="#cortex" className="hover:text-[#111114]">Cortex Proofreader Canvas</a></p>
              <p><a href="#intelligence" className="hover:text-[#111114]">Campaign Intelligence</a></p>
              <p><a href="#darkroom" className="hover:text-[#111114]">Darkroom Production Suite</a></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Operations</p>
              <p><a href="#operations" className="hover:text-[#111114]">DAG Task Engine & CRM</a></p>
              <p><a href="#signoff" className="hover:text-[#111114]">Pocket Sign-Off Studio</a></p>
              <p><a href="#pricing" className="hover:text-[#111114]">Publishing & Economics</a></p>
              <p><Link href="/login" className="hover:text-[#111114]">Agency Sign In</Link></p>
            </div>

            <div className="space-y-1.5 font-sans">
              <p className="font-semibold text-[#111114]">Governance</p>
              <p>Unlimited Team Seats</p>
              <p>Zero AI Training on Client Data</p>
              <p>Role-Based Access Control</p>
              <p className="text-[#0F7B6C] font-mono text-[10px] pt-1">All Systems Operational</p>
            </div>
          </div>

          <div className="pt-6 border-t border-[#EAE7DF] flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <span>© 2026 AgencyOS by Brieva. All rights reserved.</span>
            <span>Deterministic Agency Architecture</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
