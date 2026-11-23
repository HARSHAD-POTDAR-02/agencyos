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
  Play,
  Pause,
  Sliders,
  ExternalLink,
  MessageCircle,
  ThumbsUp,
  Key,
  Shield,
  Award,
} from "lucide-react";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cortex" | "fleet" | "teleprompter" | "review" | "calendar" | "crm">("cortex");
  const [prompterSpeed, setPrompterSpeed] = useState<number>(138);
  const [retainerCount, setRetainerCount] = useState<number>(12);
  const [activeTimelineStep, setActiveTimelineStep] = useState<number>(0);
  const [cortexViewMode, setCortexViewMode] = useState<"cards" | "document">("cards");

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

            <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-[#6B6A65]">
              <a href="#feature-cortex" className="hover:text-[#37352F] transition-colors">
                Cortex Memory
              </a>
              <a href="#feature-studio" className="hover:text-[#37352F] transition-colors">
                6-Agent Studio
              </a>
              <a href="#feature-teleprompter" className="hover:text-[#37352F] transition-colors">
                Viral Prompter
              </a>
              <a href="#feature-review" className="hover:text-[#37352F] transition-colors">
                Review Rooms
              </a>
              <a href="#feature-calendar" className="hover:text-[#37352F] transition-colors">
                Meta Calendar
              </a>
              <a href="#feature-inbox" className="hover:text-[#37352F] transition-colors">
                Community CRM
              </a>
              <a href="#timeline" className="hover:text-[#37352F] transition-colors">
                Overnight Retainer
              </a>
              <a href="#pricing" className="hover:text-[#37352F] transition-colors">
                Pricing
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
          <span className="font-semibold text-[#37352F]">The Complete Agency Operating System</span>
          <span className="text-[#C7C6C2]">|</span>
          <span>From SOW to Automated Client Delivery</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9B9A97]" />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-[#37352F] max-w-4xl mx-auto leading-[1.12]">
          The Autonomous Operating System for High-Output Marketing Agencies
        </h1>

        <p className="mt-5 text-base sm:text-lg text-[#6B6A65] max-w-3xl mx-auto leading-relaxed">
          Competitor tools stop at task lists. AgencyOS delivers end-to-end creative execution: institutional brand memory that deterministically blocks compliance drift, a 6-agent collaborative studio, mobile magic-link client review rooms, a built-in viral teleprompter, and direct Meta Graph API publishing.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Start Free Agency Trial (50,000 Credits Included)</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <a
            href="#timeline"
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-sm font-medium bg-white text-[#37352F] hover:bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4 text-[#6B6A65]" />
            <span>View Overnight Retainer Delivery (00:00 to 08:15 AM)</span>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#9B9A97]">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Instant client workspace spin-up
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Meta & LinkedIn Graph verified
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Strict zero AI model training on client IP
          </span>
        </div>
      </section>

      {/* ── Enterprise Client Marquee ── */}
      <section className="border-y border-[rgba(55,53,47,0.08)] bg-white py-6 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Trusted by modern marketing agencies managing 200+ active brand retainers
          </p>
        </div>

        <div className="relative w-full overflow-hidden">
          <div className="animate-marquee-track flex items-center gap-12 text-sm font-semibold tracking-wide text-[#6B6A65]">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#9B9A97]" /> OMNIA STUDIOS
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9B9A97]" /> HORIZON MEDIA GROUP
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#9B9A97]" /> ELEVATE AGENCY
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#9B9A97]" /> HYPERSCALE DIGITAL
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#9B9A97]" /> VERTEX CLOUD LABS
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#9B9A97]" /> PULSE GROWTH PARTNERS
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#9B9A97]" /> ALTURA BRANDS
            </span>
            <span className="text-[#C7C6C2]">•</span>
            {/* Infinite Loop Duplicates */}
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#9B9A97]" /> OMNIA STUDIOS
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9B9A97]" /> HORIZON MEDIA GROUP
            </span>
            <span className="text-[#C7C6C2]">•</span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#9B9A97]" /> ELEVATE AGENCY
            </span>
          </div>
        </div>
      </section>

      {/* ── FEATURE 01: CORTEX LIVING BRAND VAULT ── */}
      <section id="feature-cortex" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#DDEBF1] text-[#0B6E99] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <Brain className="w-3.5 h-3.5" />
            <span>Feature 01 · Institutional Brand Memory</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Cortex Brand Vault: Deterministic Enforcement vs Passive Document Search
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            While competitor tools merely search through messy past documents, AgencyOS actively enforces Negative Taboos and Brand Standards at the model layer. Junior copywriters and AI prompts can never accidentally claim an uncertified accreditation or promise an unauthorized promo code.
          </p>
        </div>

        {/* Real Cortex UI Mockup */}
        <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                V
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#37352F]">Vertex Cloud Technologies — Living Brand Vault</h3>
                <p className="text-[10px] text-[#6B6A65]">Active Retainer · 6 Institutional Rules Compiled · Zero Drift</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-lg border border-[rgba(55,53,47,0.1)] p-0.5 text-[11px] font-mono">
                <button
                  onClick={() => setCortexViewMode("cards")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    cortexViewMode === "cards" ? "bg-[#191919] text-white font-medium" : "text-[#6B6A65]"
                  }`}
                >
                  Cards View
                </button>
                <button
                  onClick={() => setCortexViewMode("document")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    cortexViewMode === "document" ? "bg-[#191919] text-white font-medium" : "text-[#6B6A65]"
                  }`}
                >
                  Clean Document
                </button>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] font-medium">
                Deterministic Lock: ON
              </span>
            </div>
          </div>

          <div className="p-6 bg-[#FBFBF9] space-y-4">
            {cortexViewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rule 1: Taboo */}
                <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.22)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                      Negative Taboo (Hard Boundary)
                    </span>
                    <span className="text-[10px] font-mono text-[#9B9A97]">Rule 677cdaeb</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#37352F]">
                    Never claim FedRAMP High certification; only state SOC-2 Type II certification.
                  </h4>
                  <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1.5 border-t border-[rgba(55,53,47,0.06)]">
                    <p><strong className="text-[#37352F]">Rationale:</strong> Legal breach occurs if FedRAMP High is claimed incorrectly.</p>
                    <p><strong className="text-[#37352F]">Enforced Channels:</strong> Sales pitches, marketing collateral, website copy, LinkedIn carousels.</p>
                    <p><strong className="text-[#37352F]">Provenance Quote:</strong> &quot;Never claim we are FedRAMP High certified yet. We are SOC-2 Type II only.&quot; (Speaker 2, Client VP)</p>
                  </div>
                </div>

                {/* Rule 2: Taboo */}
                <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.22)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                      Negative Taboo (Hard Boundary)
                    </span>
                    <span className="text-[10px] font-mono text-[#9B9A97]">Rule 39475d4e</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#37352F]">
                    Do not mention pricing, cheap rates, or percentage-off promo codes in public LinkedIn or Instagram posts.
                  </h4>
                  <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1.5 border-t border-[rgba(55,53,47,0.06)]">
                    <p><strong className="text-[#37352F]">Rationale:</strong> Maintains premium brand positioning and avoids discount perception.</p>
                    <p><strong className="text-[#37352F]">Provenance Quote:</strong> &quot;Absolutely no public discounting. We never mention pricing or promo codes.&quot; (Client VP Marketing)</p>
                  </div>
                </div>

                {/* Rule 3: Quality Standard */}
                <div className="p-4 rounded-xl bg-white border border-[rgba(15,123,108,0.22)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                      Active Brand Standard
                    </span>
                    <span className="text-[10px] font-mono text-[#9B9A97]">Rule e66615b1</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#37352F]">
                    All technical case studies must include actual multi-region failover benchmarks that are under 50 milliseconds.
                  </h4>
                  <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1.5 border-t border-[rgba(55,53,47,0.06)]">
                    <p><strong className="text-[#37352F]">Rationale:</strong> Ensures factual performance claims and maintains technical credibility with enterprise buyers.</p>
                  </div>
                </div>

                {/* Rule 4: Target Persona */}
                <div className="p-4 rounded-xl bg-white border border-[rgba(35,131,226,0.22)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#DDEBF1] text-[#0B6E99] text-[10px] font-mono font-semibold">
                      Target Audience Persona
                    </span>
                    <span className="text-[10px] font-mono text-[#9B9A97]">Persona 01</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#37352F]">
                    VP of Engineering or Cloud Infrastructure Directors managing multi-region Kubernetes clusters.
                  </h4>
                  <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1.5 border-t border-[rgba(55,53,47,0.06)]">
                    <p><strong className="text-[#37352F]">Focus Messaging:</strong> Egress cost predictability, deterministic failover latency, and SLA uptime guarantees.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] space-y-4 font-mono text-xs text-[#37352F]">
                <p className="font-semibold text-sm border-b pb-2">Vertex Cloud Technologies — Living Brand Vault Document</p>
                <div className="space-y-2 text-[#6B6A65]">
                  <p>1. Negative Taboo [Rule 677cdaeb]: Never claim FedRAMP High certification; only state SOC-2 Type II certification.</p>
                  <p>2. Negative Taboo [Rule 39475d4e]: Do not mention pricing, cheap rates, or percentage-off promo codes in public posts.</p>
                  <p>3. Brand Standard [Rule e66615b1]: All technical case studies must cite actual multi-region failover benchmarks under 50ms.</p>
                  <p>4. Positioning [Rule 39c54c7d]: Focus messaging on architecture value and uptime rather than price for enterprise buyers.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#E03E3E]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Deterministic Model Injection</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Hard boundaries are loaded deterministically into every AI pipeline run. Copy that breaks rules is rejected automatically before humans see it.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Clock className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Instant Transcript Provenance</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Every rule links back to exact executive quotes and kickoff call transcripts with hyperlinked timestamps, eliminating client debate.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Award className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Zero Brand Drift Guarantee</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Scale from 5 to 50 retainers with 100% brand consistency. No more late-night client WhatsApp panics over an unapproved post.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE 02: 6-AGENT CAMPAIGN STUDIO ── */}
      <section id="feature-studio" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FAEBDD] text-[#D9730D] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Feature 02 · Collaborative Campaign Production</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            6-Agent Studio: A Fleet of Specialized Agency Hires
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Instead of a single generic chatbot window, AgencyOS deploys a team of 6 specialist agents with clear job descriptions. They debate angles, structure multi-slide carousels, script video reels, and audit copy in parallel.
          </p>
        </div>

        {/* Real Campaign Studio UI Mockup */}
        <div className="bg-[#FBFBF9] rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#37352F]">Run #4,182: Vertex Cloud Q4 LinkedIn Sprint</span>
              <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px]">
                Taboo Guardian: Approved
              </span>
            </div>
            <span className="text-xs font-mono text-[#6B6A65]">Duration: 38.2s · 4 Agents Active</span>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Roster */}
            <div className="space-y-3 lg:col-span-1">
              <span className="text-[11px] font-mono uppercase text-[#9B9A97] tracking-wider">
                Autonomous Agent Roster
              </span>
              <div className="p-3 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#DDEBF1] text-[#0B6E99] text-xs font-mono font-bold flex items-center justify-center">1</span>
                  <span className="text-xs font-semibold text-[#37352F]">Brand Strategist</span>
                </div>
                <p className="text-[11px] text-[#6B6A65]">Calibrates hook to enterprise cloud egress pain</p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#EBF3FB] text-[#2383E2] text-xs font-mono font-bold flex items-center justify-center">2</span>
                  <span className="text-xs font-semibold text-[#37352F]">Persona Architect</span>
                </div>
                <p className="text-[11px] text-[#6B6A65]">Targets VP Engineering Kubernetes cluster directors</p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#FAEBDD] text-[#D9730D] text-xs font-mono font-bold flex items-center justify-center">3</span>
                  <span className="text-xs font-semibold text-[#37352F]">Script & Carousel Director</span>
                </div>
                <p className="text-[11px] text-[#6B6A65]">Structures 5-slide pacing with visual callout cues</p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[rgba(15,123,108,0.22)] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-xs font-mono font-bold flex items-center justify-center">4</span>
                  <span className="text-xs font-semibold text-[#37352F]">Taboo Guardian</span>
                </div>
                <p className="text-[11px] text-[#0F7B6C]">Scans copy: Confirms SOC-2, verifies sub-50ms SLA</p>
              </div>
            </div>

            {/* Generated Deliverable */}
            <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                <div>
                  <h4 className="text-xs font-semibold text-[#37352F]">Sprint Deliverable: 5-Slide LinkedIn Carousel</h4>
                  <p className="text-[10px] text-[#6B6A65]">Clean Executive Formatting · Zero Markdown Clutter</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px] font-medium">
                  Compliance Passed
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-[#37352F]">
                <div className="p-3 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                  <span className="font-semibold text-[#191919]">Slide 1 (Hook):</span> &quot;Stop guessing your cross-region egress bill across Kubernetes clusters.&quot;
                </div>
                <div className="p-3 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                  <span className="font-semibold text-[#191919]">Slide 2 (The Enterprise Pain):</span> Real-world cost variance breakdown showing unexpected 40% spikes during cross-region failovers.
                </div>
                <div className="p-3 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                  <span className="font-semibold text-[#191919]">Slide 3 (Architecture Solution):</span> Vertex Cloud predictive routing model with deterministic latency under 50 milliseconds.
                </div>
                <div className="p-3 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                  <span className="font-semibold text-[#191919]">Slide 4 (Verification Standard):</span> Certified SOC-2 Type II infrastructure reliability. Zero unverified claims.
                </div>
                <div className="p-3 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                  <span className="font-semibold text-[#191919]">Slide 5 (Call to Action):</span> &quot;Download the Multi-Region Cloud Cost Predictability Architecture Guide.&quot;
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(55,53,47,0.08)] flex items-center justify-between text-xs text-[#6B6A65]">
                <span>Human Review Gate: Alex (Creative Director)</span>
                <button className="px-4 py-1.5 rounded-lg bg-[#191919] text-white font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer shadow-xs">
                  Send to Client Review Room
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Cpu className="w-5 h-5 text-[#D9730D]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Parallel Multi-Asset Assembly</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Generate 30 days of carousels, talking-head reels, ad copy, and email sequences in a single collaborative session.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <FileText className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Executive Formatting Protocol</h4>
            <p className="text-[11px] text-[#6B6A65]">
              All generated outputs follow structured, clean typography without asterisks, hashtags, or markdown clutter.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <CheckCircle2 className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Human Sign-Off Gate</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Agents propose, humans review. Your agency creative directors maintain 100% judgment and strategic control.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE 03: VIRAL TELEPROMPTER STUDIO ── */}
      <section id="feature-teleprompter" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Feature 03 · Video Creator & Founder Suite</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Viral Teleprompter Studio: From Script to One-Take Reels
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Give your client founders, creators, and agency talent a mobile-optimized teleprompter synced directly to script scene timing. With real-time WPM pace controls, visual hook markers, and zero friction.
          </p>
        </div>

        {/* Real Teleprompter UI Mockup */}
        <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#E03E3E] animate-pulse" />
              <div>
                <h3 className="text-xs font-semibold text-[#37352F]">Teleprompter: 60-Second Cloud Architecture Reel</h3>
                <p className="text-[10px] text-[#6B6A65]">Pacing Target: 138 WPM · Estimated Run: 00:58</p>
              </div>
            </div>

            {/* Prompter Controls */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[#6B6A65]">Pace:</span>
                <span className="font-semibold text-[#37352F]">{prompterSpeed} WPM</span>
                <input
                  type="range"
                  min="110"
                  max="180"
                  value={prompterSpeed}
                  onChange={(e) => setPrompterSpeed(Number(e.target.value))}
                  className="w-24 h-1.5 bg-[#E9E9E7] rounded appearance-none cursor-pointer accent-[#191919]"
                />
              </div>

              <button className="px-3 py-1 rounded bg-[#191919] text-white font-medium flex items-center gap-1.5 cursor-pointer">
                <Play className="w-3 h-3" />
                <span>Start Prompter</span>
              </button>
            </div>
          </div>

          <div className="p-8 bg-[#FBFBF9] text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-[#FBF3DB] text-[#9A6700] text-xs font-mono font-semibold">
              Scene 1 of 4 · [00:00 - 00:14] · Visual Hook
            </div>

            <p className="text-2xl sm:text-3xl font-medium text-[#37352F] leading-relaxed tracking-tight">
              &quot;Stop guessing what your cross-region cloud egress bill will be next month.&quot;
            </p>

            <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs max-w-xl mx-auto text-left text-xs text-[#6B6A65] space-y-1.5">
              <p className="font-semibold text-[#37352F] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#D9730D]" /> Director Note (Elena, Video Producer):
              </p>
              <p>Hold direct eye contact on the word &apos;guessing&apos;. Cut to multi-region diagram overlay at second 4.</p>
            </div>
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Smartphone className="w-5 h-5 text-[#9A6700]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Mobile Smartphone Optimized</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Client founders can shoot directly on their iPhones with prompter overlays placed right next to the camera lens.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Clock className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Dynamic Pacing Engine</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Speed slider recalculates run times in real-time, ensuring talking-head videos hit the exact 60-second limit for reels.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Sliders className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Scene Cue Timing Markers</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Built-in pauses, emotional inflection marks, and B-roll cues ensure client executives deliver confident, one-take recordings.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE 04: MAGIC-LINK REVIEW ROOMS ── */}
      <section id="feature-review" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Feature 04 · Frictionless Client Sign-offs</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Magic-Link Review Rooms: Say Goodbye to Cluttered Slack Threads
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Disro forces clients into noisy Slack channels where approvals get buried under conversational chatter. AgencyOS dispatches branded, encrypted magic-link review rooms where client VPs approve full multi-asset campaigns on their phone in 1 click. Zero client password setup.
          </p>
        </div>

        {/* Real Review Room UI Mockup */}
        <div className="max-w-3xl mx-auto bg-[#FBFBF9] rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                V
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#37352F]">Vertex Cloud Review Queue · For Sarah (Client VP Marketing)</h3>
                <p className="text-[10px] text-[#6B6A65]">Prepared by Omnia Studios · Magic Token Expiry: 72 Hours</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2.5 py-1 rounded font-medium">
              Mobile Review Active
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#37352F]">
                  Asset: Q4 Multi-Region Egress Carousel (5 Slides)
                </span>
                <span className="text-[10px] font-mono text-[#9B9A97]">Format: LinkedIn 1080x1350</span>
              </div>
              <p className="text-xs text-[#6B6A65] leading-relaxed">
                Highlights cloud cost predictability for VP Engineering personas. Cites SOC-2 Type II certification and sub-50ms multi-region failover benchmarks. Zero public discounting claims.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#6B6A65]">
                <ShieldCheck className="w-4 h-4 text-[#0F7B6C]" />
                <span>Tamper-proof audit trail enabled with IP timestamp</span>
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

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Key className="w-5 h-5 text-[#9A6700]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Zero Password Barrier</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Clients never need to create an account, download software, or remember logins. 1 click from their email or text opens the room instantly.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Smartphone className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Mobile-First Visual Swiping</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Client executives can swipe through full carousels and watch video cuts on their phones while commuting between meetings.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Shield className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Tamper-Proof Audit Trail</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Every client approval records an exact cryptographic timestamp, client IP, and approved copy version for legal certainty.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE 05: OMNICHANNEL CONTENT CALENDAR & META DISPATCH ── */}
      <section id="feature-calendar" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Feature 05 · Omnichannel Publishing & Delivery</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Omnichannel Calendar with Proactive Token Health Monitoring
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Approved campaigns auto-schedule directly to Meta (Instagram, Facebook) and LinkedIn via native Graph APIs. With built-in smartphone preview modals and automated token health alerts so client campaigns never fail silently.
          </p>
        </div>

        {/* Real Content Calendar & Token Health UI Mockup */}
        <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-[#0F7B6C]" />
              <span className="text-xs font-semibold text-[#37352F]">Omnichannel Content Calendar · November 2026</span>
            </div>

            {/* Token Health Widget */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#0F7B6C]">
                <span className="w-2 h-2 rounded-full bg-[#0F7B6C]" />
                <span>Meta Graph API: Connected (Expires 58d)</span>
              </span>
              <span className="text-[#C7C6C2]">•</span>
              <span className="flex items-center gap-1.5 text-[#0B6E99]">
                <span className="w-2 h-2 rounded-full bg-[#0B6E99]" />
                <span>LinkedIn Marketing API: 100% Health</span>
              </span>
            </div>
          </div>

          <div className="p-6 bg-[#FBFBF9] grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#9B9A97]">Wednesday, Nov 26 · 09:30 AM</span>
                <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px]">Scheduled</span>
              </div>
              <h4 className="text-xs font-semibold text-[#37352F]">LinkedIn Carousel: Egress Cost Predictability</h4>
              <p className="text-[11px] text-[#6B6A65]">Target: Technical engineering directors. Enforces Rule 677cdaeb.</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#9B9A97]">Friday, Nov 28 · 14:00 PM</span>
                <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px]">Scheduled</span>
              </div>
              <h4 className="text-xs font-semibold text-[#37352F]">Instagram Reel: CEO Talking Head Keynote</h4>
              <p className="text-[11px] text-[#6B6A65]">Recorded via Viral Teleprompter Studio (138 WPM pace).</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[rgba(35,131,226,0.2)] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#0B6E99]">Smartphone Feed Preview</span>
                <Eye className="w-3.5 h-3.5 text-[#0B6E99]" />
              </div>
              <p className="text-[11px] text-[#37352F]">
                Pixel-perfect iPhone Instagram and LinkedIn preview verified before dispatch.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Share2 className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Direct Native Publishing</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Publish directly to Meta Instagram, Facebook Pages, and LinkedIn without exporting CSVs to Buffer or Hootsuite.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Activity className="w-5 h-5 text-[#E03E3E]" />
            <h4 className="text-xs font-semibold text-[#37352F]">72-Hour Token Expiry Sentinel</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Proactively audits client OAuth tokens daily. Alerts account managers 72 hours before a client token expires.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Smartphone className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Smartphone Preview Modals</h4>
            <p className="text-[11px] text-[#6B6A65]">
              View exact iPhone feed simulations for carousels and reels before scheduling, ensuring visual crops are flawless.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE 06: COMMUNITY INBOX & SOCIAL CRM ── */}
      <section id="feature-inbox" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#DDEBF1] text-[#0B6E99] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
            <MessagesSquare className="w-3.5 h-3.5" />
            <span>Feature 06 · Lead Triage & Social CRM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Community Inbox: Turn Post Comments into Qualified Inbound Leads
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Live webhook ingestion from Instagram and LinkedIn comments. Nemotron 8B AI triages buying intent, flags high-value prospects, and drafts Cortex-verified replies for one-click human dispatch.
          </p>
        </div>

        {/* Real Community Inbox UI Mockup */}
        <div className="max-w-3xl mx-auto bg-[#FBFBF9] rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden mb-8">
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessagesSquare className="w-4 h-4 text-[#0B6E99]" />
              <span className="text-xs font-semibold text-[#37352F]">Unified Community Inbox · Meta & LinkedIn Live</span>
            </div>
            <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
              Nemotron 8B Triage Active
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#0B6E99] text-white flex items-center justify-center font-bold text-xs">
                    in
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#37352F]">David K. (Staff DevOps Engineer)</h4>
                    <p className="text-[10px] text-[#9B9A97]">on LinkedIn Post #841 · 12 minutes ago</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded bg-[#DDEDEA] text-[#0F7B6C] text-xs font-mono font-semibold">
                  High Intent Lead (94/100)
                </span>
              </div>

              <p className="text-xs text-[#37352F] bg-[#FBFBF9] p-3 rounded-lg border border-[rgba(55,53,47,0.06)] leading-relaxed">
                &quot;Does your egress predictability model support multi-cloud GCP + AWS clusters or just single-region AWS setups? We have 14 clusters across Frankfurt and Virginia.&quot;
              </p>

              <div className="p-3.5 rounded-lg bg-[#DDEBF1]/30 border border-[rgba(35,131,226,0.15)] space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#0B6E99] font-medium">
                  <span>Cortex-Verified Draft Reply</span>
                  <span>Enforcing Rule e66615b1 (Sub-50ms Benchmark Cited)</span>
                </div>
                <p className="text-xs text-[#37352F] leading-relaxed">
                  &quot;Hi David, yes, our predictive routing is multi-cloud across AWS, GCP, and Azure with deterministic cross-region failover under 50ms. I can share the technical topology whitepaper with your team if helpful.&quot;
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button className="px-3 py-1 rounded text-xs text-[#6B6A65] hover:text-[#37352F] transition-colors cursor-pointer">
                  Edit Draft
                </button>
                <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Send className="w-3 h-3" />
                  <span>Approve & Post to LinkedIn</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <Zap className="w-5 h-5 text-[#0B6E99]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Automated Lead Triage</h4>
            <p className="text-[11px] text-[#6B6A65]">
              AI scores every incoming comment from 0 to 100, separating qualified enterprise buyers from casual social praise.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Cortex-Enforced Replies</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Replies automatically reference verified facts and never promise unauthorized discount codes or non-existent features.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs space-y-2">
            <TrendingUp className="w-5 h-5 text-[#D9730D]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Direct Inbound Pipeline</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Turn your clients&apos; social channels into active pipeline generation engines that drive high-ticket sales conversations.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE OVERNIGHT RETAINER TIMELINE ── */}
      <section id="timeline" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
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

      {/* ── 8 CONTINUOUS SIGNAL STREAMS INTO CORTEX ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Knowledge Ingestion
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            8 Continuous Signal Streams Ingested into Cortex
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            AgencyOS bridges the gap between scattered client communications and deterministic agent execution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Brand Guidelines & Tokens</h4>
            <p className="text-[11px] text-[#6B6A65]">
              PDF brand bibles, typography scales, tone guidelines, and exact hex color palettes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Zoom & Meet Transcripts</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Kickoff call recordings, executive quotes, and client terminology captured with timestamps.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FBE4E4] text-[#E03E3E] flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Negative Taboos & Blacklists</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Legal redlines, forbidden discount claims, and unapproved product roadmaps.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Meta & LinkedIn Ad Data</h4>
            <p className="text-[11px] text-[#6B6A65]">
              ROAS, click-through rates, and creative fatigue metrics ingested directly via Graph APIs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FAEBDD] text-[#D9730D] flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Target Audience ICP Rules</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Buyer pain points, technical vocabulary, and job title specific objection handling.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-bold text-xs">
              06
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Historical Winning Hooks</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Top 10% performing organic posts and carousels indexed as stylistic benchmarks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#EBF3FB] text-[#2383E2] flex items-center justify-center font-bold text-xs">
              07
            </div>
            <h4 className="text-xs font-semibold text-[#37352F]">Client Feedback History</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Previous review room comments and revision logs that update agent preferences permanently.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
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

      {/* ── INTERACTIVE MARGIN & CAPACITY CALCULATOR ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
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

      {/* ── TRANSPARENT PRICING GRID ── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[rgba(55,53,47,0.08)]">
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

      {/* ── HIGH-CONVERTING BOTTOM CTA ── */}
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

      {/* ── DEEP ENTERPRISE FOOTER ── */}
      <footer className="border-t border-[rgba(55,53,47,0.08)] bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-xs text-[#6B6A65]">
          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Platform Core</p>
            <ul className="space-y-2">
              <li><a href="#feature-cortex" className="hover:text-[#37352F]">Cortex Brand Vault</a></li>
              <li><a href="#feature-studio" className="hover:text-[#37352F]">6-Agent Production Studio</a></li>
              <li><a href="#feature-teleprompter" className="hover:text-[#37352F]">Viral Teleprompter</a></li>
              <li><a href="#feature-review" className="hover:text-[#37352F]">Magic-Link Review Rooms</a></li>
              <li><a href="#feature-calendar" className="hover:text-[#37352F]">Meta Content Calendar</a></li>
              <li><a href="#feature-inbox" className="hover:text-[#37352F]">Community Inbox & CRM</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Workflows</p>
            <ul className="space-y-2">
              <li><a href="#timeline" className="hover:text-[#37352F]">Overnight Retainer Delivery</a></li>
              <li><a href="#timeline" className="hover:text-[#37352F]">8 Continuous Signal Streams</a></li>
              <li><a href="#pricing" className="hover:text-[#37352F]">Agency Margin Expansion</a></li>
              <li><a href="#pricing" className="hover:text-[#37352F]">Credit-Based Pricing</a></li>
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
              The autonomous operating system powering high-output marketing agencies with institutional brand memory and multi-agent execution.
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
            <span>PostgreSQL Schema v2.4 · API Latency: 42ms · Zero Drift Enforced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
