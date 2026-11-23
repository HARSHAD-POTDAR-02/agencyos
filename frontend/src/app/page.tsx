"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  CalendarDays,
  FileCheck2,
  MessagesSquare,
  BarChart3,
  Users,
  Lock,
  Globe,
  Clock,
  ChevronRight,
  Play,
  Check,
  AlertTriangle,
  Flame,
  Search,
  Command,
  Sliders,
  ExternalLink,
  ShieldAlert,
  Brain,
  Video,
  Mic,
  Activity,
  Terminal,
} from "lucide-react";

export default function LandingPage() {
  const [signalCount, setSignalCount] = useState(1482890);
  const [activeTab, setActiveTab] = useState<"cortex" | "campaigns" | "teleprompter" | "reviews" | "meta" | "community">("cortex");
  const [clientsCount, setClientsCount] = useState(12);

  // Live signal counter ticker (simulates active stream)
  useEffect(() => {
    const timer = setInterval(() => {
      setSignalCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBF9] dark:bg-[#0B0F15] text-[#1F2B33] dark:text-[#E2E8F0] font-sans antialiased selection:bg-[#0D4A32] selection:text-white">
      {/* ── Top Minimalist Sticky Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FBFBF9]/80 dark:bg-[#0B0F15]/80 border-b border-black/[0.06] dark:border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Live Status Pill */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0D4A32] to-[#1F6E4E] dark:from-[#10B981] dark:to-[#059669] flex items-center justify-center text-white shadow-xs">
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-base tracking-tight text-[#1F2B33] dark:text-white">
                AgencyOS
              </span>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#0D4A32]/10 text-[#0D4A32] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0D4A32]/20 dark:border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v2.4 System Live
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            <a href="#architecture" className="hover:text-[#1F2B33] dark:hover:text-white transition-colors">
              Agency Brain
            </a>
            <a href="#comparison" className="hover:text-[#1F2B33] dark:hover:text-white transition-colors">
              The Old Way vs OS
            </a>
            <a href="#modules" className="hover:text-[#1F2B33] dark:hover:text-white transition-colors">
              Six Modules
            </a>
            <a href="#calculator" className="hover:text-[#1F2B33] dark:hover:text-white transition-colors">
              ROI Calculator
            </a>
            <a href="#security" className="hover:text-[#1F2B33] dark:hover:text-white transition-colors">
              Security
            </a>
          </nav>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-[#1F2B33] dark:text-white hover:text-[#0D4A32] dark:hover:text-emerald-400 transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#0D4A32] hover:bg-[#083322] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-[#061A12] shadow-xs transition-all transform hover:-translate-y-0.5"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION: THE AI-NATIVE AGENCY OPERATING SYSTEM ── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden border-b border-black/[0.06] dark:border-white/[0.06]">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-emerald-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-6 text-center space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-[#F4F3ED] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-[#64748B] dark:text-[#94A3B8] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>The AI-Native Operating System for Enterprise Marketing Agencies</span>
          </div>

          {/* Main Headline with Tight Negative Tracking */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-heading font-black tracking-[-0.03em] leading-[1.05] text-[#1F2B33] dark:text-white max-w-4xl mx-auto">
            One autonomous system for everything your agency delivers.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] max-w-2xl mx-auto leading-relaxed font-normal">
            Institutional brand memory, 6-agent campaign intelligence, short-form teleprompter scripting, and frictionless review rooms — running on everything your client knows.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-[#0D4A32] hover:bg-[#093524] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-[#061A12] shadow-md transition-all transform hover:-translate-y-0.5"
            >
              <span>Start 14-Day Agency Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#architecture"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-white dark:bg-white/[0.06] hover:bg-[#F4F3ED] dark:hover:bg-white/[0.1] text-[#1F2B33] dark:text-white border border-black/[0.1] dark:border-white/[0.15] shadow-2xs transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>See the System Run</span>
            </a>
          </div>

          {/* Micro Trust Proof */}
          <div className="pt-2 flex items-center justify-center gap-6 text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Zero Brand Drift
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Meta Graph API Verified
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Free Client Reviewers
            </span>
          </div>

          {/* ── THE LIVE AGENCY BRAIN ARCHITECTURE NODE DIAGRAM (ZOCKET STYLE) ── */}
          <div id="architecture" className="pt-12 sm:pt-16 max-w-5xl mx-auto">
            <div className="relative rounded-3xl border border-black/[0.1] dark:border-white/[0.1] bg-[#F4F3ED]/80 dark:bg-[#0E1520]/80 backdrop-blur-md p-6 sm:p-10 shadow-2xl overflow-hidden">
              {/* Concentric Pulsing Radar Rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-96 sm:h-96 rounded-full border border-emerald-500/20 animate-pulse-ring-1 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-[480px] sm:h-[480px] rounded-full border border-emerald-500/15 animate-pulse-ring-2 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 sm:w-[600px] sm:h-[600px] rounded-full border border-emerald-500/10 animate-pulse-ring-3 pointer-events-none" />

              {/* Streaming Data Ingestion Pill Bar (Top) */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {[
                  "Instagram Business",
                  "Facebook Pages",
                  "Client Brand Vaults",
                  "Negative Legal Taboos",
                  "Historical CTR Benchmarks",
                  "Review Audio Transcripts",
                ].map((src, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-[#64748B] dark:text-[#94A3B8] shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {src}
                  </span>
                ))}
              </div>

              {/* Center Architecture: Central Cortex Node + 4 Radiating Agent Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center relative z-10">
                {/* Left Radiating Agent Cards */}
                <div className="space-y-4">
                  {/* Agent 1 */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#151D2A] border border-black/[0.08] dark:border-white/[0.1] text-left shadow-xs hover:border-[#0D4A32] dark:hover:border-emerald-500 transition-colors group">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-[#0D4A32] dark:text-emerald-400">Agent 01 · Brand Strategist</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        98% Match
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#1F2B33] dark:text-white">
                      "What angles resonate with enterprise VP buyers?"
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
                      → 5 egress cost predictability hooks proposed
                    </p>
                  </div>

                  {/* Agent 2 */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#151D2A] border border-black/[0.08] dark:border-white/[0.1] text-left shadow-xs hover:border-[#0D4A32] dark:hover:border-emerald-500 transition-colors group">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-[#0D4A32] dark:text-emerald-400">Agent 02 · Script Director</span>
                      <span className="text-[10px] text-purple-600 dark:text-[#A78BFA] bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">
                        30s Teleprompter
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#1F2B33] dark:text-white">
                      "Paced scene dialogue with visual camera cuts"
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
                      → Word count locked at 72 words (~28s read)
                    </p>
                  </div>
                </div>

                {/* Central Brain Node */}
                <div className="p-6 rounded-3xl bg-[#061A12] text-white border-2 border-emerald-500/30 text-center space-y-4 shadow-2xl relative overflow-hidden">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
                    <Brain className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Central Cortex
                    </span>
                    <h3 className="text-lg font-heading font-bold text-white">
                      Agency Brain Vault
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Deterministic institutional memory graph with zero brand drift.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                    <span className="text-emerald-400 font-bold block text-sm">
                      {signalCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      Active Institutional Rules &amp; Signals
                    </span>
                  </div>
                </div>

                {/* Right Radiating Agent Cards */}
                <div className="space-y-4">
                  {/* Agent 3 */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#151D2A] border border-black/[0.08] dark:border-white/[0.1] text-left shadow-xs hover:border-[#0D4A32] dark:hover:border-emerald-500 transition-colors group">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-[#0D4A32] dark:text-emerald-400">Agent 03 · Taboo Guardian</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                        Rule 677cdaeb
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#1F2B33] dark:text-white">
                      "Never claim FedRAMP High; SOC-2 Type II only"
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
                      → Scanned 12 deliverables: 100% compliant
                    </p>
                  </div>

                  {/* Agent 4 */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#151D2A] border border-black/[0.08] dark:border-white/[0.1] text-left shadow-xs hover:border-[#0D4A32] dark:hover:border-emerald-500 transition-colors group">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-[#0D4A32] dark:text-emerald-400">Agent 04 · Engagement Sentinel</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
                        11s SLA
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#1F2B33] dark:text-white">
                      "Autonomous replies to Instagram &amp; Facebook comments"
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
                      → 78% answered on-brand without human review
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE CLIENT MARQUEE TICKER ── */}
      <section className="py-8 bg-white dark:bg-[#080B10] border-b border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 text-center mb-4">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Powering Next-Gen Social &amp; Digital Agencies Worldwide
          </p>
        </div>
        <div className="relative w-full overflow-hidden">
          <div className="animate-marquee-track flex items-center gap-12 sm:gap-20 text-sm font-heading font-extrabold text-[#64748B]/60 dark:text-[#94A3B8]/40 tracking-wider uppercase">
            <span>Elevate Media</span>
            <span>HyperScale Digital</span>
            <span>Vertex Cloud Labs</span>
            <span>Pulse Growth</span>
            <span>Northline Creative</span>
            <span>Omnia Studios</span>
            <span>Horizon Media</span>
            <span>Elevate Media</span>
            <span>HyperScale Digital</span>
            <span>Vertex Cloud Labs</span>
            <span>Pulse Growth</span>
            <span>Northline Creative</span>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE OLD AGENCY WAY VS WITH AGENCYOS ── */}
      <section id="comparison" className="py-20 md:py-28 max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0D4A32] dark:text-emerald-400 bg-[#0D4A32]/10 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
            Paradigm Shift
          </span>
          <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-[-0.02em] text-[#1F2B33] dark:text-white">
            Stop stitching together six fragmented tools.
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Creative agencies waste 35% of their working hours copying text between Google Docs, Asana, Frame.io, and scheduling spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* The Old Way Card */}
          <div className="rounded-3xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F4F3ED] dark:bg-white/[0.02] p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                The Fragmented Agency Stack
              </span>
              <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">High Friction</span>
            </div>

            <div className="space-y-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
              {[
                { title: "Six separate SaaS subscriptions", desc: "Asana, Google Docs, ChatGPT, Frame.io, Buffer, and spreadsheets." },
                { title: "Constant brand drift", desc: "Freelance copywriters violate negative client rules and legal taboos." },
                { title: "Feedback lost in WhatsApp & email", desc: "Client revisions scattered across messy threads and lost attachments." },
                { title: "Manual teleprompter & video cutting", desc: "Video creators waste hours pacing lines and recalculating durations." },
                { title: "Token expirations break publishing", desc: "Posts fail silently when social OAuth tokens expire without warnings." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                    ✕
                  </div>
                  <div>
                    <strong className="text-[#1F2B33] dark:text-white block font-semibold">{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* With AgencyOS Card */}
          <div className="rounded-3xl border-2 border-emerald-500/30 bg-[#061A12] text-white p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.1]">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                With AgencyOS
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">+400% Velocity</span>
            </div>

            <div className="space-y-4 text-xs text-[#94A3B8]">
              {[
                { title: "One unified agentic operating system", desc: "Everything from client onboarding to live Meta analytics in a single platform." },
                { title: "Deterministic Cortex brand vault", desc: "Zero brand drift. Institutional rules halt violations before client review." },
                { title: "Frictionless magic-link review rooms", desc: "Clients review and approve deliverables in one click without login credentials." },
                { title: "Integrated teleprompter & scriptwriter", desc: "Scene-by-scene speaking durations and full-screen prompter recording." },
                { title: "Automated publishing & 24/7 community loop", desc: "Scheduled post rollout with proactive Meta token health warnings." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: THE AUTONOMOUS AGENT LOOP & LIVE EXECUTION TRACE ── */}
      <section className="py-20 bg-white dark:bg-[#0E1520] border-y border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0D4A32] dark:text-emerald-400 bg-[#0D4A32]/10 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
              State Machine Engineering
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-[-0.02em] text-[#1F2B33] dark:text-white">
              The Agent Loop: 10s Autonomous Cycles
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
              Every deliverable runs through a 5-stage deterministic state machine with strict human review gates.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* 5-Stage Step Flow (Left 5 cols) */}
            <div className="lg:col-span-5 space-y-3 font-mono text-xs">
              {[
                { step: "01", name: "Read Context", badge: "Graph Read", desc: "Loads active institutional facts, tone, and negative taboos from Cortex." },
                { step: "02", name: "Coordinate Agents", badge: "Multi-Agent", desc: "6 specialized agents architect strategy, hooks, scenes, and visual prompts." },
                { step: "03", name: "Script & Prompter", badge: "Production", desc: "Transforms concept into timed speech dialogue blocks for video creators." },
                { step: "04", name: "Check Gates", badge: "Human Gate", desc: "Deterministic safety pre-check + magic-link client reviewer sign-off." },
                { step: "05", name: "Publish & Learn", badge: "Graph Write", desc: "Deploys to Meta Graph API and ingests real engagement CTR telemetry." },
              ].map((st, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBF9] dark:bg-white/[0.02] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {st.step}
                    </span>
                    <div>
                      <span className="font-bold text-[#1F2B33] dark:text-white block font-sans text-xs">
                        {st.name}
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                        {st.desc}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-[#64748B] dark:text-[#94A3B8] shrink-0 font-mono">
                    {st.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Live Terminal Telemetry Trace (Right 7 cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-black/[0.1] dark:border-white/[0.1] bg-[#061A12] text-white p-6 shadow-2xl font-mono text-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.1] text-[11px]">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    RUN #4,182: VERTEX CLOUD Q4 SPRINT
                  </span>
                  <span className="text-[#94A3B8]">STATUS: COMPLETED</span>
                </div>

                <div className="space-y-2 text-[#94A3B8] text-[11px] leading-relaxed">
                  <p>
                    <span className="text-emerald-400 font-bold">[READ 0.4s]</span> Loaded 6 verified Cortex rules.
                    Rule 677cdaeb active: &quot;Never claim FedRAMP High&quot;.
                  </p>
                  <p>
                    <span className="text-emerald-400 font-bold">[PLAN 4 steps]</span> Concept: 5-slide carousel spotlighting egress cost variance.
                  </p>
                  <p>
                    <span className="text-emerald-400 font-bold">[ACT 38.2s]</span> Generated 5 visual storyboard cards &amp; directorial hooks. Zero markdown clutter applied.
                  </p>
                  <p>
                    <span className="text-purple-400 font-bold">[HUMAN GATE]</span> Magic-link review room #rev_83b. Approved by A. Menon (Client VP).
                  </p>
                  <p>
                    <span className="text-emerald-400 font-bold">[SHIP]</span> Scheduled to Instagram Business. Token valid for 58 days.
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.1] flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400">● RUN #4,183 QUEUED</span>
                  <span className="text-[#94A3B8]">STARTS SMARTER THAN #4,182</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: SIX CORE MODULES (BENTO GRID WITH GIANT NUMERALS) ── */}
      <section id="modules" className="py-20 md:py-28 max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0D4A32] dark:text-emerald-400 bg-[#0D4A32]/10 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
            The Product Suite
          </span>
          <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-[-0.02em] text-[#1F2B33] dark:text-white">
            Six engines. One cohesive workspace.
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Built specifically to eradicate tool hopping and ensure strict adherence to client guidelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              num: "01",
              title: "Cortex Living Brand Vault",
              tag: "Deterministic Rules",
              desc: "Autonomous ingestion of client contracts and brand voice. Enforces negative taboos and facts deterministically across all outputs.",
            },
            {
              num: "02",
              title: "6-Agent Campaign Studio",
              tag: "Parallel AI Pipeline",
              desc: "Coordinated intelligence engine with Brand Strategist, Persona Architect, Content Planner, Creative Director, Copywriter, and Scheduler.",
            },
            {
              num: "03",
              title: "Viral Teleprompter Studio",
              tag: "Pacing & Speech Sync",
              desc: "Scene-by-scene script beats with target speaking duration timers, hook rewrites, and full-screen auto-scrolling presenter view.",
            },
            {
              num: "04",
              title: "Magic-Link Review Rooms",
              tag: "Zero-Login Client Sign-off",
              desc: "Shareable client portals with time-stamped video comments, side-by-side asset comparison, and single-click approval gates.",
            },
            {
              num: "05",
              title: "Native Meta Publishing",
              tag: "Proactive Token Alerts",
              desc: "Direct scheduling to Instagram Reels and Facebook Pages with automatic 60-day OAuth token health monitoring and expiration warnings.",
            },
            {
              num: "06",
              title: "Community Inbox & CRM",
              tag: "24/7 Autonomous Moderation",
              desc: "Real-time Instagram and Facebook comment triage with sentiment analysis and AI-drafted replies grounded in brand guidelines.",
            },
          ].map((m, i) => (
            <div
              key={i}
              className="relative p-6 rounded-3xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#0E1520] shadow-xs hover:border-[#0D4A32] dark:hover:border-emerald-500 transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Giant Translucent Numeral Watermark */}
              <span className="absolute -bottom-4 -right-2 text-7xl font-heading font-black text-black/[0.03] dark:text-white/[0.03] select-none pointer-events-none transition-transform group-hover:scale-105">
                {m.num}
              </span>

              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {m.tag}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#64748B] dark:text-[#94A3B8]">
                    {m.num}
                  </span>
                </div>

                <h3 className="text-base font-heading font-bold text-[#1F2B33] dark:text-white">
                  {m.title}
                </h3>

                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  {m.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-black/[0.06] dark:border-white/[0.06] relative z-10">
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-[#0D4A32] dark:text-emerald-400 flex items-center gap-1 group-hover:gap-1.5 transition-all"
                >
                  <span>Explore module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 6: INTERACTIVE ROI & CAPACITY CALCULATOR ── */}
      <section id="calculator" className="py-20 bg-[#F4F3ED] dark:bg-[#080B10] border-y border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0D4A32] dark:text-emerald-400 bg-[#0D4A32]/10 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
              Economic Model
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-[-0.02em] text-[#1F2B33] dark:text-white">
              Calculate your agency savings
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              See how consolidating onto AgencyOS impacts your monthly retainer margins.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white dark:bg-[#0E1520] border border-black/[0.08] dark:border-white/[0.08] shadow-xl space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold text-[#1F2B33] dark:text-white">Active Client Retainers</span>
                <span className="text-base font-heading font-extrabold text-[#0D4A32] dark:text-emerald-400">
                  {clientsCount} Brands
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="50"
                value={clientsCount}
                onChange={(e) => setClientsCount(Number(e.target.value))}
                className="w-full accent-[#0D4A32] dark:accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-1">
                <span>3 Boutique</span>
                <span>25 Growth Agency</span>
                <span>50+ Enterprise Scale</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] text-center">
              <div className="p-4 rounded-2xl bg-[#FBFBF9] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-2xl font-heading font-extrabold text-[#1F2B33] dark:text-white block">
                  {(clientsCount * 14).toLocaleString()} hrs
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Monthly Hours Saved on Copy &amp; Admin
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBF9] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400 block">
                  ${(clientsCount * 65).toLocaleString()}
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Eliminated SaaS Subscriptions / Mo
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBF9] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-2xl font-heading font-extrabold text-purple-600 dark:text-[#A78BFA] block">
                  +{Math.round(clientsCount * 0.45)} Retainers
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Capacity Growth Without Extra Staff
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: ENTERPRISE SECURITY & GOVERNANCE ── */}
      <section id="security" className="py-20 bg-[#0C1626] text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Enterprise Governance
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-[-0.02em] text-white">
              Built for strict client confidentiality
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              Every client's credentials, vector embeddings, and media are cryptographically isolated with zero cross-tenant contamination.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: "Row-Level Multi-Tenancy",
                desc: "Strict agency_id isolation across PostgreSQL tables. Clients never see sibling tenant records.",
              },
              {
                title: "Zero AI Model Training",
                desc: "Your client's brand secrets, transcripts, and hooks are never used to train foundation models.",
              },
              {
                title: "Meta OAuth Token Health",
                desc: "Continuous proactive monitoring of 60-day token lifespans with instant 1-click renewal alerts.",
              },
              {
                title: "Role-Based Access Control",
                desc: "Owners, Managers, and Specialists have distinct granular permissions to safeguard billing and settings.",
              },
            ].map((sec, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2.5 shadow-inner"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  0{i + 1}
                </div>
                <h4 className="text-sm font-heading font-bold text-white">{sec.title}</h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{sec.desc}</p>
              </div>
            ))}
          </div>

          {/* Live SIEM Audit Log Ticker */}
          <div className="mt-10 p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-[#94A3B8] flex-wrap gap-2">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AUDIT LOG: 214 AUTONOMOUS ACTIONS · 0 BRAND TABOO BREACHES · 100% ISOLATED
            </span>
            <span className="text-white/60">SIEM · CSV · API EXPORTABLE</span>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: BOTTOM CELESTIAL HORIZON CTA (ZOCKET STYLE) ── */}
      <section className="py-24 bg-[#061A12] text-white relative overflow-hidden text-center">
        {/* Amber / Golden Horizon Arc */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-amber-500/25 via-emerald-500/10 to-transparent rounded-[100%] blur-2xl pointer-events-none" />

        <div className="max-w-3xl mx-auto px-6 relative z-10 space-y-6">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            A New Operational Standard
          </span>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black tracking-tight text-white leading-tight">
            Bring your client guidelines.
            <br />
            Leave with your autonomous engine running.
          </h2>

          <p className="text-xs sm:text-sm text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Eliminate six fragmented tools and scale your monthly brand retainers with zero brand drift.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#061A12] shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              <span>Launch Agency Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.15] shadow-xs transition-all"
            >
              <span>Sign In to Existing Agency</span>
            </Link>
          </div>

          <div className="pt-4 flex items-center justify-center gap-6 text-[11px] font-mono text-[#94A3B8]">
            <span>14-DAY RISK-FREE TRIAL</span>
            <span>•</span>
            <span>NO CREDIT CARD REQUIRED</span>
            <span>•</span>
            <span>INSTANT SETUP</span>
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE FOOTER WITH TELEMETRY TICKER ── */}
      <footer className="bg-[#05130D] text-[#94A3B8] border-t border-white/[0.08] text-xs py-12">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          {/* Telemetry Ticker Strip */}
          <div className="pb-6 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4 font-mono text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SYSTEM LIVE · {signalCount.toLocaleString()} BRAND SIGNALS IN GRAPH · 44 DATA HOOKS</span>
            </div>
            <div className="text-[#94A3B8]/60">
              NEXT SPRINT CYCLE: 8:00 AM UTC
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Col 1: Brand & Bio */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center text-[#061A12]">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <span className="font-heading font-extrabold text-sm text-white">AgencyOS</span>
              </div>
              <p className="text-xs text-[#94A3B8] max-w-sm leading-relaxed">
                The AI-native operating system for modern social, creative, and digital marketing agencies.
              </p>
              <p className="text-[11px] font-mono text-[#94A3B8]/60">
                &copy; {new Date().getFullYear()} AgencyOS Inc. All rights reserved.
              </p>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-2">
              <h5 className="font-heading font-bold text-white text-xs uppercase tracking-wider font-mono">
                Product
              </h5>
              <ul className="space-y-1.5 text-xs">
                <li><Link href="/cortex" className="hover:text-white transition-colors">Cortex Memory</Link></li>
                <li><Link href="/campaigns" className="hover:text-white transition-colors">Campaign Studio</Link></li>
                <li><Link href="/tasks" className="hover:text-white transition-colors">Teleprompter Studio</Link></li>
                <li><Link href="/approvals" className="hover:text-white transition-colors">Review Rooms</Link></li>
                <li><Link href="/calendar" className="hover:text-white transition-colors">Content Calendar</Link></li>
              </ul>
            </div>

            {/* Col 3: Operations */}
            <div className="space-y-2">
              <h5 className="font-heading font-bold text-white text-xs uppercase tracking-wider font-mono">
                Workspaces
              </h5>
              <ul className="space-y-1.5 text-xs">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Agency Dashboard</Link></li>
                <li><Link href="/workspace" className="hover:text-white transition-colors">My Daily Workbench</Link></li>
                <li><Link href="/clients" className="hover:text-white transition-colors">Client Workspaces</Link></li>
                <li><Link href="/engagement" className="hover:text-white transition-colors">Community Inbox</Link></li>
                <li><Link href="/reports" className="hover:text-white transition-colors">Reports &amp; ROI</Link></li>
              </ul>
            </div>

            {/* Col 4: Administration */}
            <div className="space-y-2">
              <h5 className="font-heading font-bold text-white text-xs uppercase tracking-wider font-mono">
                Admin
              </h5>
              <ul className="space-y-1.5 text-xs">
                <li><Link href="/team" className="hover:text-white transition-colors">Team &amp; Seats</Link></li>
                <li><Link href="/billing" className="hover:text-white transition-colors">Billing &amp; Credits</Link></li>
                <li><Link href="/settings" className="hover:text-white transition-colors">Workspace Config</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Agency Login</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
