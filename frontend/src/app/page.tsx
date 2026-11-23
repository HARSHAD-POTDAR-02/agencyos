"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Brain,
  Sparkles,
  FileCheck2,
  MessagesSquare,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  Layers,
  CalendarDays,
  Lock,
  Check,
  Zap,
  BarChart3,
  Globe,
  Building2,
  Send,
  AlertCircle,
  Database,
  Eye,
  FileText,
  CornerDownRight,
  ChevronRight,
  Smartphone,
  Cpu,
  GitBranch,
  Activity,
  CheckSquare,
  Share2,
  Users,
  RefreshCw,
  SlidersHorizontal,
  Workflow,
  TrendingUp,
  Coins,
} from "lucide-react";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cortex" | "fleet" | "queue" | "review" | "publish">("cortex");
  const [activeTimelineStep, setActiveTimelineStep] = useState<number>(0);
  const [retainerCount, setRetainerCount] = useState<number>(12);
  const [selectedAgent, setSelectedAgent] = useState<"strategist" | "persona" | "script" | "guardian" | "prompter" | "sentinel">("guardian");

  const hoursSavedPerMonth = retainerCount * 14;
  const saasSavedPerMonth = Math.round(retainerCount * 65);
  const extraRetainerCapacity = Math.floor(retainerCount * 0.45);

  const timelineSteps = [
    {
      time: "00:00",
      title: "SOW Contract Signed ($18k/mo Retainer)",
      category: "Automated Onboarding",
      detail: "Client executes agreement. AgencyOS webhook triggers instant client workspace provisioning, row-level isolated database schema, and custom invite dispatch.",
      badge: "Automated Setup",
      badgeColor: "bg-[#DDEBF1] text-[#0B6E99]",
    },
    {
      time: "00:08",
      title: "Cortex Signal Ingestion & Brand Dossier Synthesis",
      category: "Institutional Memory",
      detail: "Cortex ingests brand style guidelines, CEO podcast transcripts, past winning carousels, and client onboarding forms. Compiles 6 Negative Taboos and 14 Active Brand Standards.",
      badge: "Zero Drift",
      badgeColor: "bg-[#DDEDEA] text-[#0F7B6C]",
    },
    {
      time: "00:25",
      title: "6-Agent Campaign Studio Deploys 30-Day Rollout",
      category: "Multi-Agent Assembly",
      detail: "Brand Strategist formulates themes. Script Director structures 12 carousels, 8 teleprompter video scripts, and 16 ad angles calibrated to engineering buyer personas.",
      badge: "Parallel Drafting",
      badgeColor: "bg-[#FAEBDD] text-[#D9730D]",
    },
    {
      time: "00:40",
      title: "Taboo Guardian Deterministic Compliance Pass",
      category: "Safety & Legal Gate",
      detail: "Deterministic scan detects zero unverified claims. Confirms SOC-2 Type II citation, enforces sub-50ms benchmark requirement, and blocks any public discount codes.",
      badge: "Audit Passed",
      badgeColor: "bg-[#DDEDEA] text-[#0F7B6C]",
    },
    {
      time: "00:45",
      title: "Magic-Link Review Room Dispatched to Client VP",
      category: "Client Review",
      detail: "A secure, zero-login review room link is emailed and texted to Sarah (Client VP Marketing). Mobile-optimized visual cards display all drafts with side-by-side diffs.",
      badge: "Zero-Login Link",
      badgeColor: "bg-[#FBF3DB] text-[#9A6700]",
    },
    {
      time: "08:15 AM",
      title: "Client Approves on Phone · Automated Social Dispatch",
      category: "Omnichannel Schedule",
      detail: "Client VP clicks Approve All Assets while commuting. Campaign auto-syncs to the Content Calendar and queues direct publishing via Meta Graph API and LinkedIn API.",
      badge: "Published & Queued",
      badgeColor: "bg-[#DDEDEA] text-[#0F7B6C]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#37352F] font-sans antialiased selection:bg-[#E9E9E7] selection:text-[#37352F]">
      {/* ── Sticky Top Header ── */}
      <header className="sticky top-0 z-50 bg-[#FBFBF9]/95 backdrop-blur-md border-b border-[rgba(55,53,47,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#191919] flex items-center justify-center text-white font-mono text-sm font-bold shadow-xs transition-transform group-hover:scale-105">
                A
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-base tracking-tight text-[#37352F]">AgencyOS</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F1F1EF] text-[#6B6A65] border border-[rgba(55,53,47,0.08)]">
                  v2.4 Enterprise
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#6B6A65]">
              <a href="#workbench" className="hover:text-[#37352F] transition-colors">
                Interactive OS
              </a>
              <a href="#timeline" className="hover:text-[#37352F] transition-colors">
                Overnight Retainer
              </a>
              <a href="#cortex-signals" className="hover:text-[#37352F] transition-colors">
                8 Cortex Signals
              </a>
              <a href="#fleet" className="hover:text-[#37352F] transition-colors">
                Agent Fleet
              </a>
              <a href="#queue" className="hover:text-[#37352F] transition-colors">
                Unified Queue
              </a>
              <a href="#calculator" className="hover:text-[#37352F] transition-colors">
                Capacity Engine
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DDEDEA] border border-[rgba(15,123,108,0.2)] text-[11px] font-mono text-[#0F7B6C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C] animate-pulse" />
              <span>SOC-2 Type II Certified</span>
            </div>

            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B6A65] hover:text-[#37352F] hover:bg-[#F1F1EF] transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[rgba(55,53,47,0.12)] shadow-xs mb-6 text-xs text-[#6B6A65]">
          <span className="font-semibold text-[#37352F]">The Next-Generation Agency Stack</span>
          <span className="text-[#C7C6C2]">|</span>
          <span>From SOW to Automated Client Delivery</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9B9A97]" />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-[#37352F] max-w-4xl mx-auto leading-[1.12]">
          The Autonomous Operating System for High-Output Marketing Agencies
        </h1>

        <p className="mt-5 text-base sm:text-lg text-[#6B6A65] max-w-3xl mx-auto leading-relaxed">
          Competitor tools stop at task lists. AgencyOS delivers end-to-end creative execution: institutional brand memory that guarantees zero compliance drift, a 6-agent collaborative studio, 1-click magic-link client review rooms, and direct Meta and LinkedIn publishing.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Start Free Agency Trial (50k Credits Included)</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <a
            href="#timeline"
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-sm font-medium bg-white text-[#37352F] hover:bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4 text-[#6B6A65]" />
            <span>Explore Overnight Retainer Timeline</span>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#9B9A97]">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Instant client workspace provisioning
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Meta Graph API & LinkedIn API verified
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Strict zero AI model training guarantee
          </span>
        </div>
      </section>

      {/* ── Flagship Interactive AgencyOS Product Window ── */}
      <section id="workbench" className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-24">
        <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden">
          {/* Top Window Bar (macOS / Notion Header) */}
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#E03E3E]/70 border border-[#E03E3E]" />
              <span className="w-3 h-3 rounded-full bg-[#9A6700]/70 border border-[#9A6700]" />
              <span className="w-3 h-3 rounded-full bg-[#0F7B6C]/70 border border-[#0F7B6C]" />
              <span className="ml-2 text-xs font-mono text-[#6B6A65]">
                agencyos.io/app/vertex-cloud-technologies
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6B6A65]">
              <span className="px-2 py-0.5 rounded bg-white border border-[rgba(55,53,47,0.08)] font-mono text-[11px]">
                Client Retainer: Vertex Cloud Technologies ($18k/mo)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] border border-[rgba(15,123,108,0.2)] font-mono text-[11px]">
                6 Rules Enforced · 0 Drift
              </span>
            </div>
          </div>

          {/* Interactive Navigation Tab Strip */}
          <div className="bg-white border-b border-[rgba(55,53,47,0.08)] px-4 flex overflow-x-auto scrollbar-none gap-2">
            <button
              onClick={() => setActiveTab("cortex")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "cortex"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <Brain className="w-4 h-4 text-[#2383E2]" />
              <span>1. Cortex Memory & Taboos</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#DDEBF1] text-[#0B6E99]">
                Active Enforcer
              </span>
            </button>

            <button
              onClick={() => setActiveTab("fleet")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "fleet"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <Cpu className="w-4 h-4 text-[#D9730D]" />
              <span>2. 6-Agent Production Fleet</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FAEBDD] text-[#D9730D]">
                Specialized Hires
              </span>
            </button>

            <button
              onClick={() => setActiveTab("queue")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "queue"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <CheckSquare className="w-4 h-4 text-[#6941C6]" />
              <span>3. Human + Agent Task Board</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F9F5FF] text-[#6941C6]">
                Side-by-Side
              </span>
            </button>

            <button
              onClick={() => setActiveTab("review")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "review"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-[#9A6700]" />
              <span>4. Magic-Link Review Room</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700]">
                Zero Login Friction
              </span>
            </button>

            <button
              onClick={() => setActiveTab("publish")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "publish"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <CalendarDays className="w-4 h-4 text-[#0F7B6C]" />
              <span>5. Meta Dispatch & Social CRM</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C]">
                Live Publishing
              </span>
            </button>
          </div>

          {/* Interactive Tab Body */}
          <div className="p-6 bg-[#FBFBF9] min-h-[460px]">
            {/* ── TAB 1: CORTEX ACTIVE ENFORCER ── */}
            {activeTab === "cortex" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Cortex Active Enforcer: Deterministic Boundaries vs Passive Search
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      While competitor tools only search past documents, AgencyOS actively enforces negative taboos to block non-compliant AI copy before humans ever see it.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2.5 py-1 rounded-md self-start sm:self-auto font-medium">
                    Verified Zero Drift Architecture
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Negative Taboo Rule 1 */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.22)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo (Hard Boundary)
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">ID: 677cdaeb</span>
                    </div>
                    <p className="text-xs font-semibold text-[#37352F] leading-snug">
                      Never claim FedRAMP High certification; only state SOC-2 Type II certification.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)]">
                      <p>
                        <span className="font-medium text-[#37352F]">Enforced Channels:</span> Sales decks, LinkedIn carousels, ad copy, web copy.
                      </p>
                      <p>
                        <span className="font-medium text-[#37352F]">Provenance Quote:</span> &quot;Never claim we are FedRAMP High certified yet. We are SOC-2 Type II only.&quot; (Speaker 2, Client VP)
                      </p>
                    </div>
                  </div>

                  {/* Negative Taboo Rule 2 */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.22)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo (Hard Boundary)
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">ID: 39475d4e</span>
                    </div>
                    <p className="text-xs font-semibold text-[#37352F] leading-snug">
                      Do not mention pricing, cheap rates, or percentage-off promo codes in public LinkedIn posts.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)]">
                      <p>
                        <span className="font-medium text-[#37352F]">Rationale:</span> Protects premium enterprise brand positioning.
                      </p>
                      <p>
                        <span className="font-medium text-[#37352F]">Provenance Quote:</span> &quot;Absolutely no public discounting.&quot; (Client VP Marketing)
                      </p>
                    </div>
                  </div>

                  {/* Active Brand Standard */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(15,123,108,0.2)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                        Active Brand Standard
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">ID: e66615b1</span>
                    </div>
                    <p className="text-xs font-semibold text-[#37352F] leading-snug">
                      All technical case studies must include actual multi-region failover benchmarks under 50 milliseconds.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)]">
                      <p>
                        <span className="font-medium text-[#37352F]">Target Persona:</span> VP of Engineering managing multi-region Kubernetes clusters.
                      </p>
                    </div>
                  </div>

                  {/* Proven Winning Patterns */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(35,131,226,0.2)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#DDEBF1] text-[#0B6E99] text-[10px] font-mono font-semibold">
                        Proven Winning Pattern
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">Format: 5-Slide Carousel</span>
                    </div>
                    <p className="text-xs font-semibold text-[#37352F] leading-snug">
                      Problem-to-benchmark architecture: Hook on egress cost predictability, breakdown variance, show sub-50ms SLA.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)]">
                      <p>
                        <span className="font-medium text-[#37352F]">Historical Performance:</span> 4.8x higher inbound demo booking rate on LinkedIn.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: AGENT FLEET & ORG CHART ── */}
            {activeTab === "fleet" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      6-Agent Specialized Fleet: Hires, Not Generic Prompt Boxes
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Every agent has a defined role, strict boundaries, and reporting handoffs supervised by your agency creative director.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#D9730D] bg-[#FAEBDD] px-2.5 py-1 rounded-md font-medium">
                    Fleet Model: GPT-4o + Claude 3.5 Sonnet
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedAgent("strategist")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "strategist"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-mono text-xs font-bold">
                        1
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Brand Strategist</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Formulates 30-day narrative themes and positioning angles based on client ICP.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedAgent("persona")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "persona"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#EBF3FB] text-[#2383E2] flex items-center justify-center font-mono text-xs font-bold">
                        2
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Persona Architect</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Calibrates messaging to technical directors, CTOs, and enterprise buying committees.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedAgent("script")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "script"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#FAEBDD] text-[#D9730D] flex items-center justify-center font-mono text-xs font-bold">
                        3
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Script & Carousel Director</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Structures 5-slide visual pacing, hook drop-off curves, and multi-format copy.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedAgent("guardian")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "guardian"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-mono text-xs font-bold">
                        4
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Taboo Guardian</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Enforces hard legal boundaries, negative taboos, and compliance standards.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedAgent("prompter")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "prompter"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-mono text-xs font-bold">
                        5
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Viral Teleprompter</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Translates scripts into scene-by-scene prompter cues synced to speaking pace.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedAgent("sentinel")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAgent === "sentinel"
                        ? "bg-white border-[#191919] shadow-xs"
                        : "bg-white/60 border-[rgba(55,53,47,0.08)] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-[#F9F5FF] text-[#6941C6] flex items-center justify-center font-mono text-xs font-bold">
                        6
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">Engagement Sentinel</span>
                    </div>
                    <p className="text-[11px] text-[#6B6A65]">
                      Triages post comments and DMs into high-intent inbound sales leads with 1-click replies.
                    </p>
                  </button>
                </div>

                {/* Selected Agent Output Detail */}
                <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[rgba(55,53,47,0.06)]">
                    <span className="text-xs font-semibold text-[#37352F]">
                      Active Execution Snapshot: Taboo Guardian (Rule 677cdaeb Pass)
                    </span>
                    <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                      Zero Taboo Claims Detected
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6A65] leading-relaxed">
                    Guardian evaluated candidate copy for Slide 4: &quot;Certified SOC-2 Type II high-availability infrastructure with sub-50ms multi-region failover.&quot; Scanned against legal blacklist: Zero mentions of FedRAMP High, zero discount promo codes, latency benchmark verified. Gate status: Approved for Agency Director review.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB 3: HUMAN + AGENT TASK BOARD ── */}
            {activeTab === "queue" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Unified Task Board: Humans and AI Agents Side-by-Side
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Familiar project management table where human creative directors supervise agent execution with clear sign-off gates.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B6A65] bg-white border border-[rgba(55,53,47,0.1)] px-2.5 py-1 rounded-md">
                    24 Tasks Active · 16 Agent Driven · 8 Human Gates
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[rgba(55,53,47,0.09)] shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] text-[#6B6A65] font-mono text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Task Deliverable</th>
                        <th className="py-2.5 px-3">Assignee</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Human Review Gate</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(55,53,47,0.06)] text-[#37352F]">
                      <tr>
                        <td className="py-3 px-3 font-medium">
                          Q4 Egress Cost Predictability Carousel (5 Slides)
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAEBDD] text-[#D9730D] text-[10px] font-medium">
                            <Sparkles className="w-3 h-3" /> Script Director
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono">
                            Draft Ready
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6B6A65]">
                          Alex (Creative Director)
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button className="px-2.5 py-1 rounded bg-[#191919] text-white text-[11px] font-medium cursor-pointer">
                            Send to Review
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-3 font-medium">
                          CEO Keynote Teleprompter Script (60s Reel)
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-medium">
                            <Smartphone className="w-3 h-3" /> Teleprompter Agent
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono">
                            Synced 138 WPM
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6B6A65]">
                          Elena (Video Producer)
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button className="px-2.5 py-1 rounded bg-[#F1F1EF] text-[#37352F] text-[11px] font-medium cursor-pointer">
                            Launch Prompter
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 px-3 font-medium">
                          Meta Graph API Inbound Comment Triage (Post #841)
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F9F5FF] text-[#6941C6] text-[10px] font-medium">
                            <MessagesSquare className="w-3 h-3" /> Sentinel Agent
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#DDEBF1] text-[#0B6E99] text-[10px] font-mono">
                            High Intent (94)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6B6A65]">
                          Marcus (Community Mgr)
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button className="px-2.5 py-1 rounded bg-[#0F7B6C] text-white text-[11px] font-medium cursor-pointer">
                            Approve Reply
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4: MAGIC-LINK REVIEW ROOM ── */}
            {activeTab === "review" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Magic-Link Review Rooms vs Cluttered Slack Threads
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      While Disro relies on noisy Slack channels where client feedback gets lost, AgencyOS gives clients a dedicated, branded review room with 1-click approvals and zero login required.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#9A6700] bg-[#FBF3DB] px-2.5 py-1 rounded-md font-medium">
                    Encrypted Magic Token (72hr Expiry)
                  </span>
                </div>

                <div className="max-w-2xl mx-auto p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.12)] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                        V
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#37352F]">Vertex Cloud Technologies Review Queue</p>
                        <p className="text-[10px] text-[#6B6A65]">Prepared by Omnia Digital Agency · For Sarah (Client VP Marketing)</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
                      Mobile Review Active
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-[#37352F]">
                      Campaign Deliverable: Q4 Egress Cost Predictability Carousel (5 Slides)
                    </span>
                    <p className="text-xs text-[#6B6A65] leading-relaxed">
                      Calibrated for engineering directors. Highlighting architecture predictability, verified SOC-2 Type II standards, and sub-50ms multi-region benchmarks. Zero public promo codes.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[rgba(55,53,47,0.08)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#6B6A65]">
                      <ShieldCheck className="w-4 h-4 text-[#0F7B6C]" />
                      <span>Tamper-proof audit log verified</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#F1F1EF] text-[#37352F] hover:bg-[#E9E9E7] transition-colors cursor-pointer">
                        Request Copy Tweak
                      </button>
                      <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#0F7B6C] text-white hover:bg-[#0B6558] transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer">
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve All Assets (1-Click)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 5: AUTOMATED SOCIAL PUBLISHING ── */}
            {activeTab === "publish" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Native Meta Graph API & Social Community CRM
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Direct publishing to Instagram and Facebook with proactive token health monitoring, plus automated inbound lead triage.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2.5 py-1 rounded-md font-medium">
                    Token Health: 100% Operational
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#37352F]">Automated Dispatch Calendar</span>
                      <span className="text-[10px] font-mono text-[#0B6E99] bg-[#DDEBF1] px-2 py-0.5 rounded">
                        Next: Tomorrow 09:30 AM
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6A65]">
                      Approved carousels and reels automatically publish to client accounts with pre-flight token verification. Zero manual Hootsuite or Buffer exporting.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)] font-mono">
                      <p>• Instagram Reel: Scheduled (Tomorrow 09:30 AM)</p>
                      <p>• LinkedIn Carousel: Scheduled (Thursday 14:00 PM)</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#37352F]">Community Inbox Lead Triage</span>
                      <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                        High Intent Lead (94/100)
                      </span>
                    </div>
                    <p className="text-xs text-[#37352F] bg-[#FBFBF9] p-2 rounded border border-[rgba(55,53,47,0.06)]">
                      &quot;Does your predictive model support multi-cloud GCP + AWS clusters?&quot; (David K., DevOps)
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#0F7B6C] font-mono">Cortex-Verified Draft Ready</span>
                      <button className="px-3 py-1 rounded bg-[#191919] text-white text-xs font-medium cursor-pointer">
                        Approve & Post Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── The Overnight Retainer Timeline (00:00 to 08:30 AM) ── */}
      <section id="timeline" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[rgba(55,53,47,0.08)] bg-white">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Operational Velocity
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            The Overnight Retainer: From Signed SOW to Shipped Campaign
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            While traditional agencies take 3 weeks of kickoff meetings and email chains, AgencyOS provisions, writes, verifies, and secures client sign-off while your team sleeps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {timelineSteps.map((step, idx) => (
            <div
              key={step.time}
              onClick={() => setActiveTimelineStep(idx)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                activeTimelineStep === idx
                  ? "bg-[#FBFBF9] border-[#191919] shadow-xs scale-[1.02]"
                  : "bg-white border-[rgba(55,53,47,0.09)] hover:border-[rgba(55,53,47,0.18)]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono font-bold text-[#191919] bg-[#F1F1EF] px-2.5 py-1 rounded">
                  {step.time}
                </span>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${step.badgeColor}`}>
                  {step.badge}
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#9B9A97] uppercase tracking-wider mb-1">
                {step.category}
              </p>
              <h4 className="text-sm font-semibold text-[#37352F] mb-2 leading-snug">
                {step.title}
              </h4>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8 Continuous Signal Streams into Cortex ── */}
      <section id="cortex-signals" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Institutional Knowledge Architecture
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            8 Continuous Signal Streams Ingested into Cortex
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            AgencyOS bridges the gap between scattered client communications and deterministic agent execution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Brand Guidelines & Tokens</h4>
            <p className="text-[11px] text-[#6B6A65]">
              PDF brand bibles, typography scales, tone guidelines, and exact hex color palettes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Zoom & Meet Transcripts</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Kickoff call recordings, executive quotes, and client terminology captured with timestamps.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FBE4E4] text-[#E03E3E] flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Negative Taboos & Blacklists</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Legal redlines, forbidden discount claims, and unapproved product roadmaps.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Meta & LinkedIn Ad Data</h4>
            <p className="text-[11px] text-[#6B6A65]">
              ROAS, click-through rates, and creative fatigue metrics ingested directly via Graph APIs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FAEBDD] text-[#D9730D] flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Target Audience ICP Rules</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Buyer pain points, technical vocabulary, and job title specific objection handling.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-bold text-xs">
              06
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Historical Winning Hooks</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Top 10% performing organic posts and carousels indexed as stylistic benchmarks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#EBF3FB] text-[#2383E2] flex items-center justify-center font-bold text-xs">
              07
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Client Feedback History</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Previous review room comments and revision logs that update agent preferences permanently.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#F9F5FF] text-[#6941C6] flex items-center justify-center font-bold text-xs">
              08
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Community Inbox Ingestion</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Real-world user questions and customer objections scraped from post comment sections.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Fragmented Agency Stack vs With AgencyOS ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Operational Contrast
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Stop stitching together 6 disconnected tools for every client
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            Most agencies lose 15+ hours per retainer per week copy-pasting between Google Docs, Asana, generative AI windows, and email approval threads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* The Old Fragmented Way */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(55,53,47,0.08)]">
              <div>
                <h3 className="text-base font-semibold text-[#37352F]">The Fragmented Agency Stack</h3>
                <p className="text-xs text-[#6B6A65]">Zapier + Asana + ChatGPT + Hootsuite + WhatsApp</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-xs font-mono font-medium">
                Fragile & Manual
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#6B6A65]">
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Brand voice drift:</strong> Junior copywriters and generic AI prompts constantly forget client compliance boundaries and hard taboos.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Approval bottlenecks:</strong> Client feedback is scattered across WhatsApp voice notes, Google Doc comment pings, and email chains.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Expensive software sprawl:</strong> Spending $1,200 to $2,500 every month on redundant single-purpose SaaS seats.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Hiring trap:</strong> You can only take on more client retainers by hiring more account managers and junior writers.
                </span>
              </li>
            </ul>
          </div>

          {/* With AgencyOS */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[rgba(55,53,47,0.14)] shadow-notion-hover space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(55,53,47,0.08)]">
              <div>
                <h3 className="text-base font-semibold text-[#37352F]">With AgencyOS</h3>
                <p className="text-xs text-[#0F7B6C]">One Unified Institutional Operating System</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-xs font-mono font-medium">
                +400% Velocity
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#6B6A65]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Zero brand drift:</strong> The Cortex vault deterministically injects hard negative boundaries and certified facts into every run.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Magic-link review rooms:</strong> Clients approve complete multi-asset campaigns on their phone with 1 click. Zero login barrier.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">All-in-one efficiency:</strong> Strategy, 6-agent drafting, review rooms, teleprompter, social calendar, and community CRM in one tool.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#37352F]">Margin expansion:</strong> Scale from 5 to 25 active retainers with the same core high-performing agency team.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Interactive Retainer Capacity & ROI Calculator ── */}
      <section id="calculator" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-10 rounded-3xl bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
              Interactive Margin Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#37352F]">
              Calculate Your Agency Margin Expansion
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6A65]">
              Drag the slider to match your current active client retainers and see the hours and margin unlocked with AgencyOS.
            </p>
          </div>

          {/* Slider Control */}
          <div className="max-w-md mx-auto space-y-3 text-center">
            <div className="flex items-center justify-between text-xs font-mono text-[#6B6A65]">
              <span>3 Retainers</span>
              <span className="text-base font-semibold text-[#37352F]">{retainerCount} Active Client Retainers</span>
              <span>50 Retainers</span>
            </div>
            <input
              type="range"
              min="3"
              max="50"
              value={retainerCount}
              onChange={(e) => setRetainerCount(Number(e.target.value))}
              className="w-full h-2 bg-[#E9E9E7] rounded-lg appearance-none cursor-pointer accent-[#191919]"
            />
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-semibold text-[#37352F] tracking-tight">
                {hoursSavedPerMonth} hrs
              </span>
              <p className="text-xs font-medium text-[#6B6A65]">Monthly Specialist Hours Reclaimed</p>
              <p className="text-[10px] text-[#9B9A97]">No more manual copy-pasting</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-semibold text-[#0F7B6C] tracking-tight">
                ${saasSavedPerMonth.toLocaleString()}
              </span>
              <p className="text-xs font-medium text-[#6B6A65]">Eliminated Redundant SaaS Spend</p>
              <p className="text-[10px] text-[#9B9A97]">Consolidated 6 tools into 1</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-semibold text-[#2383E2] tracking-tight">
                +{extraRetainerCapacity} Retainers
              </span>
              <p className="text-xs font-medium text-[#6B6A65]">Capacity Growth Without New Hires</p>
              <p className="text-[10px] text-[#9B9A97]">Scale agency margins directly</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Transparent Credit Consumption Pricing ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Usage-Based Economics
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Pay for What Your Agents Do. Zero Per-Seat Penalties.
          </h2>
          <p className="text-xs sm:text-sm text-[#6B6A65]">
            Traditional SaaS penalizes agency growth with per-seat licensing. AgencyOS gives your whole team access and charges only for agent tasks. 1,000 credits = $1.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter Plan */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#37352F]">Starter Agency</h3>
              <p className="text-xs text-[#6B6A65]">For boutique studios managing 1-3 client retainers</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-[#37352F]">$0</span>
              <span className="text-xs text-[#9B9A97]">/ month</span>
            </div>
            <p className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded inline-block">
              50,000 Free Credits Included
            </p>
            <ul className="space-y-2.5 text-xs text-[#6B6A65] pt-2 border-t border-[rgba(55,53,47,0.06)]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Unlimited team members
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Cortex Living Brand Vault
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> 6-Agent Campaign Studio
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Magic-Link Review Rooms
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="w-full py-2 rounded-lg text-xs font-medium bg-[#F1F1EF] text-[#37352F] hover:bg-[#E9E9E7] transition-colors block text-center"
            >
              Start Free
            </Link>
          </div>

          {/* Growth Plan */}
          <div className="p-6 rounded-2xl bg-[#FBFBF9] border-2 border-[#191919] shadow-md space-y-4 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#191919] text-white text-[10px] font-mono uppercase tracking-wider font-semibold">
              Most Popular
            </span>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#37352F]">Growth Agency</h3>
              <p className="text-xs text-[#6B6A65]">For scaling agencies managing 5-20 active retainers</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-[#37352F]">$99</span>
              <span className="text-xs text-[#9B9A97]">/ month</span>
            </div>
            <p className="text-[11px] font-mono text-[#2383E2] bg-[#DDEBF1] px-2 py-0.5 rounded inline-block">
              250,000 Credits / mo + Pay As You Go
            </p>
            <ul className="space-y-2.5 text-xs text-[#6B6A65] pt-2 border-t border-[rgba(55,53,47,0.06)]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Everything in Starter
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Automated Meta Graph API Publishing
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Viral Teleprompter Studio
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Community Inbox Lead Triage
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Role-Based Access Control
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="w-full py-2 rounded-lg text-xs font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-colors block text-center shadow-xs"
            >
              Start 14-Day Trial
            </Link>
          </div>

          {/* Scale Plan */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#37352F]">Scale & Holdings</h3>
              <p className="text-xs text-[#6B6A65]">For agency holding groups managing 50+ retainers</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-[#37352F]">Custom</span>
            </div>
            <p className="text-[11px] font-mono text-[#6941C6] bg-[#F9F5FF] px-2 py-0.5 rounded inline-block">
              Dedicated Infrastructure & BYOK
            </p>
            <ul className="space-y-2.5 text-xs text-[#6B6A65] pt-2 border-t border-[rgba(55,53,47,0.06)]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Custom Credit Volumes & BYOK API Keys
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> Dedicated Postgres Schemas & DPA
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> White-labeled Client Portal
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> 99.99% SLA & Dedicated Slack CSM
              </li>
            </ul>
            <a
              href="mailto:enterprise@agencyos.io"
              className="w-full py-2 rounded-lg text-xs font-medium bg-[#F1F1EF] text-[#37352F] hover:bg-[#E9E9E7] transition-colors block text-center"
            >
              Contact Enterprise
            </a>
          </div>
        </div>
      </section>

      {/* ── High-Converting Bottom CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] text-center space-y-6">
          <span className="px-3 py-1 rounded-full bg-white border border-[rgba(55,53,47,0.09)] text-xs font-mono text-[#6B6A65]">
            Instant Workspace Activation · Zero Waitlist
          </span>

          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight max-w-xl mx-auto">
            Ready to run your agency on a modern operating system?
          </h2>

          <p className="text-sm sm:text-base text-[#6B6A65] max-w-lg mx-auto">
            Join 340+ agency owners scaling client retainers with zero brand drift and frictionless client approvals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>Launch Agency Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-5 py-3 rounded-lg text-sm font-medium bg-white text-[#37352F] hover:bg-[#F1F1EF] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs"
            >
              Sign In to Existing Agency
            </Link>
          </div>
        </div>
      </section>

      {/* ── Deep Enterprise Footer ── */}
      <footer className="border-t border-[rgba(55,53,47,0.08)] bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-xs text-[#6B6A65]">
          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Platform Core</p>
            <ul className="space-y-2">
              <li><a href="#workbench" className="hover:text-[#37352F]">Cortex Memory Vault</a></li>
              <li><a href="#workbench" className="hover:text-[#37352F]">6-Agent Production Fleet</a></li>
              <li><a href="#workbench" className="hover:text-[#37352F]">Magic-Link Review Rooms</a></li>
              <li><a href="#workbench" className="hover:text-[#37352F]">Viral Teleprompter Studio</a></li>
              <li><a href="#workbench" className="hover:text-[#37352F]">Meta Graph API Dispatch</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Workflows</p>
            <ul className="space-y-2">
              <li><a href="#timeline" className="hover:text-[#37352F]">Overnight Retainer Delivery</a></li>
              <li><a href="#cortex-signals" className="hover:text-[#37352F]">8 Continuous Signal Streams</a></li>
              <li><a href="#queue" className="hover:text-[#37352F]">Human + Agent Task Board</a></li>
              <li><a href="#calculator" className="hover:text-[#37352F]">Agency Margin Expansion</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Security & Legal</p>
            <ul className="space-y-2">
              <li><span className="hover:text-[#37352F] cursor-pointer">SOC-2 Type II Certified</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">Meta Graph API Verified</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">Postgres Row-Level Isolation</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">Zero Model Training Policy</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">AgencyOS Inc</p>
            <p className="text-xs text-[#9B9A97] leading-relaxed">
              The autonomous operating system powering high-output marketing agencies with institutional memory and multi-agent execution.
            </p>
            <p className="text-xs text-[#9B9A97]">
              &copy; {new Date().getFullYear()} AgencyOS Inc. All rights reserved.
            </p>
          </div>
        </div>

        {/* Live Monospace Telemetry Strip */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-[rgba(55,53,47,0.06)] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#9B9A97] gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#0F7B6C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
              <span>All Systems Operational</span>
            </span>
            <span>•</span>
            <span>Uptime: 99.98%</span>
            <span>•</span>
            <span>Cluster: us-east-1</span>
          </div>

          <div>
            <span>PostgreSQL Schema v2.4 · API Latency: 42ms · Zero Drift</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
