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
  Sliders,
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
} from "lucide-react";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"cortex" | "studio" | "review" | "inbox">("cortex");
  const [retainerCount, setRetainerCount] = useState<number>(12);

  const hoursSavedPerMonth = retainerCount * 14;
  const saasSavedPerMonth = Math.round(retainerCount * 65);
  const extraRetainerCapacity = Math.floor(retainerCount * 0.45);

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#37352F] font-sans antialiased selection:bg-[#E9E9E7] selection:text-[#37352F]">
      {/* ── Sticky Top Header ── */}
      <header className="sticky top-0 z-50 bg-[#FBFBF9]/90 backdrop-blur-md border-b border-[rgba(55,53,47,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#191919] flex items-center justify-center text-white font-mono text-sm font-bold shadow-xs transition-transform group-hover:scale-105">
                A
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-base tracking-tight text-[#37352F]">AgencyOS</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F1F1EF] text-[#6B6A65] border border-[rgba(55,53,47,0.08)]">
                  v2.4
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#6B6A65]">
              <a href="#demo" className="hover:text-[#37352F] transition-colors">
                Interactive Workspace
              </a>
              <a href="#comparison" className="hover:text-[#37352F] transition-colors">
                Old Stack vs OS
              </a>
              <a href="#workflow" className="hover:text-[#37352F] transition-colors">
                5-Stage Engine
              </a>
              <a href="#modules" className="hover:text-[#37352F] transition-colors">
                Core Modules
              </a>
              <a href="#calculator" className="hover:text-[#37352F] transition-colors">
                Capacity Calculator
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
        {/* Release Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[rgba(55,53,47,0.12)] shadow-xs mb-6 text-xs text-[#6B6A65]">
          <span className="font-semibold text-[#37352F]">Zero Brand Drift</span>
          <span className="text-[#C7C6C2]">|</span>
          <span>Deterministic memory for client campaigns</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9B9A97]" />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-[#37352F] max-w-4xl mx-auto leading-[1.12]">
          The Operating System for High-Output Marketing Agencies
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-[#6B6A65] max-w-2xl mx-auto leading-relaxed">
          Scale client retainers without scaling headcount. AgencyOS unifies institutional brand memory, multi-agent campaign production, and frictionless client approvals in one calm, deterministic workspace.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Start Free Agency Trial</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <a
            href="#demo"
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-sm font-medium bg-white text-[#37352F] hover:bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <span>Explore Live Workspace Demo</span>
          </a>
        </div>

        {/* Trust Points */}
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
            Meta & LinkedIn Graph API verified
          </span>
        </div>
      </section>

      {/* ── Interactive AgencyOS Workspace Window Demo ── */}
      <section id="demo" className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-24">
        <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-window overflow-hidden">
          {/* Top Window Bar (macOS / Notion Header) */}
          <div className="bg-[#F7F6F3] border-b border-[rgba(55,53,47,0.08)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#E03E3E]/70 border border-[#E03E3E]" />
              <span className="w-3 h-3 rounded-full bg-[#9A6700]/70 border border-[#9A6700]" />
              <span className="w-3 h-3 rounded-full bg-[#0F7B6C]/70 border border-[#0F7B6C]" />
              <span className="ml-2 text-xs font-mono text-[#6B6A65]">
                agencyos.io/app/vertex-cloud
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6B6A65]">
              <span className="px-2 py-0.5 rounded bg-white border border-[rgba(55,53,47,0.08)] font-mono text-[11px]">
                Retainer: Vertex Cloud Technologies
              </span>
              <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] border border-[rgba(15,123,108,0.2)] font-mono text-[11px]">
                6 Rules Active
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
              <span>1. Cortex Memory Vault</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F1F1EF] text-[#6B6A65]">
                6 Rules
              </span>
            </button>

            <button
              onClick={() => setActiveTab("studio")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "studio"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#D9730D]" />
              <span>2. Campaign Studio</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FAEBDD] text-[#D9730D]">
                6-Agent
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
              <span>3. Client Review Room</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FBF3DB] text-[#9A6700]">
                Magic-Link
              </span>
            </button>

            <button
              onClick={() => setActiveTab("inbox")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === "inbox"
                  ? "border-[#191919] text-[#37352F]"
                  : "border-transparent text-[#6B6A65] hover:text-[#37352F]"
              }`}
            >
              <MessagesSquare className="w-4 h-4 text-[#0F7B6C]" />
              <span>4. Community Inbox</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#DDEDEA] text-[#0F7B6C]">
                Live Meta
              </span>
            </button>
          </div>

          {/* Interactive Tab Body */}
          <div className="p-6 bg-[#FBFBF9] min-h-[440px]">
            {/* ── TAB 1: CORTEX MEMORY VAULT ── */}
            {activeTab === "cortex" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Living Institutional Brand Vault & Hard Boundaries
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Deterministic rules injected into every AI generation run to prevent brand drift and compliance errors.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B6A65] self-start sm:self-auto">
                    Compiled: 2026-11-23 20:07 UTC
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Negative Taboo Rule 1 */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.2)] shadow-xs space-y-2">
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
                        <span className="font-medium text-[#37352F]">Rationale:</span> Legal breach occurs if FedRAMP High is claimed prematurely.
                      </p>
                      <p>
                        <span className="font-medium text-[#37352F]">Provenance Quote:</span> &quot;Never claim we are FedRAMP High certified yet. We are SOC-2 Type II only.&quot; (Client VP)
                      </p>
                    </div>
                  </div>

                  {/* Negative Taboo Rule 2 */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(224,62,62,0.2)] shadow-xs space-y-2">
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
                        <span className="font-medium text-[#37352F]">Rationale:</span> Maintains premium enterprise positioning and avoids discount perception.
                      </p>
                      <p>
                        <span className="font-medium text-[#37352F]">Provenance Quote:</span> &quot;Absolutely no public discounting.&quot; (Client VP Marketing)
                      </p>
                    </div>
                  </div>

                  {/* Brand Guardrail Rule 3 */}
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
                        <span className="font-medium text-[#37352F]">Enforced Channels:</span> Technical whitepapers, sales case studies, LinkedIn carousels.
                      </p>
                    </div>
                  </div>

                  {/* Target Audience Persona Rule 4 */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(35,131,226,0.2)] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#DDEBF1] text-[#0B6E99] text-[10px] font-mono font-semibold">
                        Target Audience Persona
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">Role: VP Eng</span>
                    </div>
                    <p className="text-xs font-semibold text-[#37352F] leading-snug">
                      VP of Engineering or Cloud Infrastructure Directors managing multi-region Kubernetes clusters.
                    </p>
                    <div className="text-[11px] text-[#6B6A65] space-y-1 pt-1 border-t border-[rgba(55,53,47,0.06)]">
                      <p>
                        <span className="font-medium text-[#37352F]">Focus Area:</span> Egress predictability, deterministic latency, and uptime SLA.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: CAMPAIGN STUDIO ── */}
            {activeTab === "studio" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      6-Agent Campaign Production Workspace
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Specialist agents debate, script, and verify multi-asset rollouts under human supervision.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] font-mono text-[10px]">
                      Taboo Guardian: Verified
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Agent Roster */}
                  <div className="space-y-2 lg:col-span-1">
                    <span className="text-[11px] font-mono uppercase text-[#9B9A97] tracking-wider">
                      Collaborative Agent Roster
                    </span>
                    <div className="p-3 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center font-mono text-xs font-bold">
                        1
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-[#37352F]">Brand Strategist</p>
                        <p className="text-[10px] text-[#6B6A65]">Formulates core messaging angle</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-[#FAEBDD] text-[#D9730D] flex items-center justify-center font-mono text-xs font-bold">
                        2
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-[#37352F]">Script & Carousel Director</p>
                        <p className="text-[10px] text-[#6B6A65]">Structures 5-slide visual pacing</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-[rgba(15,123,108,0.2)] flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-mono text-xs font-bold">
                        3
                      </div>
                      <div className="text-xs">
                        <p className="font-medium text-[#37352F]">Taboo Guardian</p>
                        <p className="text-[10px] text-[#0F7B6C]">Scans against negative boundaries</p>
                      </div>
                    </div>
                  </div>

                  {/* Generated Campaign Artifact */}
                  <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3 lg:col-span-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[rgba(55,53,47,0.06)]">
                      <span className="text-xs font-semibold text-[#37352F]">
                        Sprint Deliverable: 5-Slide LinkedIn Carousel
                      </span>
                      <span className="text-[10px] font-mono text-[#0F7B6C] px-2 py-0.5 rounded bg-[#DDEDEA]">
                        Compliant with Rule 677cdaeb & 39475d4e
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-[#6B6A65]">
                      <div className="p-2.5 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                        <span className="font-semibold text-[#37352F]">Slide 1 (Hook):</span> &quot;Stop guessing your egress bill across multi-region clusters.&quot;
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                        <span className="font-semibold text-[#37352F]">Slide 2 (The Enterprise Pain):</span> Real-world cost variance breakdown showing unexpected cross-region egress spikes.
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                        <span className="font-semibold text-[#37352F]">Slide 3 (Architecture Solution):</span> Vertex Cloud predictive routing model with deterministic latency under 50ms.
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FBFBF9] border border-[rgba(55,53,47,0.06)]">
                        <span className="font-semibold text-[#37352F]">Slide 4 (Verification Standard):</span> Certified SOC-2 Type II infrastructure reliability. Zero unverified claims.
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs text-[#6B6A65]">
                      <span>Human Review Gate: Ready for Agency Director Sign-off</span>
                      <button className="px-3 py-1 rounded bg-[#191919] text-white font-medium hover:bg-[#2F2E2B] transition-colors cursor-pointer">
                        Send to Client Room
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: CLIENT REVIEW ROOM ── */}
            {activeTab === "review" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Magic-Link Client Review Room (No Client Sign-in Required)
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Send clients a secure, branded link to review copy, scripts, and media with 1-click approvals on mobile or desktop.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono">
                    Token Expiry: 72 Hours
                  </span>
                </div>

                <div className="max-w-2xl mx-auto p-5 rounded-xl bg-white border border-[rgba(55,53,47,0.12)] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#191919] text-white flex items-center justify-center font-mono text-xs font-bold">
                        V
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#37352F]">Vertex Cloud Review Queue</p>
                        <p className="text-[10px] text-[#6B6A65]">Prepared by Omnia Digital Agency</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded">
                      Client Review Pending
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-[#37352F]">
                      Asset: Q4 Cross-Region Egress Carousel (5 Slides)
                    </span>
                    <p className="text-xs text-[#6B6A65] leading-relaxed">
                      This campaign highlights architecture value and egress cost predictability for enterprise engineering directors, referencing SOC-2 Type II standards and sub-50ms failovers.
                    </p>
                  </div>

                  {/* Client Action Buttons */}
                  <div className="pt-3 border-t border-[rgba(55,53,47,0.08)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#6B6A65]">
                      <ShieldCheck className="w-4 h-4 text-[#0F7B6C]" />
                      <span>Tamper-proof audit trail enabled</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#F1F1EF] text-[#37352F] hover:bg-[#E9E9E7] transition-colors cursor-pointer">
                        Request Copy Tweak
                      </button>
                      <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#0F7B6C] text-white hover:bg-[#0B6558] transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer">
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve for Publication</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: COMMUNITY INBOX ── */}
            {activeTab === "inbox" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)] gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#37352F]">
                      Unified Social CRM & Meta Comment Triage
                    </h3>
                    <p className="text-xs text-[#6B6A65]">
                      Real-time webhook ingestion from LinkedIn & Instagram with AI intent classification and on-brand draft replies.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono">
                    Meta Graph API Connected
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.1)] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#0B6E99] text-white flex items-center justify-center text-[10px] font-bold">
                        in
                      </div>
                      <span className="text-xs font-semibold text-[#37352F]">David K. (Staff DevOps Engineer)</span>
                      <span className="text-[10px] text-[#9B9A97]">on LinkedIn Post #841</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold">
                      High Intent Lead (94/100)
                    </span>
                  </div>

                  <p className="text-xs text-[#37352F] bg-[#FBFBF9] p-2.5 rounded-lg border border-[rgba(55,53,47,0.06)]">
                    &quot;Does your egress predictability model support multi-cloud GCP + AWS or just single-region AWS setups? We have 14 clusters across Frankfurt and Virginia.&quot;
                  </p>

                  <div className="p-3 rounded-lg bg-[#DDEBF1]/30 border border-[rgba(35,131,226,0.15)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#0B6E99] font-medium">
                      <span>Cortex-Verified Draft Reply</span>
                      <span>Enforces Rule e66615b1 & Sub-50ms Benchmark</span>
                    </div>
                    <p className="text-xs text-[#37352F]">
                      &quot;Hi David, yes, our predictive routing is multi-cloud across AWS, GCP, and Azure with deterministic cross-region failover under 50ms. I can share the technical whitepaper with the multi-cloud topology if helpful.&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button className="px-3 py-1 rounded text-xs text-[#6B6A65] hover:text-[#37352F] transition-colors cursor-pointer">
                      Edit Draft
                    </button>
                    <button className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#191919] text-white hover:bg-[#2F2E2B] transition-colors flex items-center gap-1.5 cursor-pointer">
                      <Send className="w-3 h-3" />
                      <span>Approve & Post to LinkedIn</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Enterprise Client Ticker ── */}
      <section className="border-y border-[rgba(55,53,47,0.08)] bg-white py-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Trusted by modern marketing agencies managing 200+ brand retainers
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
            {/* Duplicate for infinite loop */}
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
          </div>
        </div>
      </section>

      {/* ── The Fragmented Stack vs AgencyOS ── */}
      <section id="comparison" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
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

      {/* ── 5-Stage Agent Production Engine ── */}
      <section id="workflow" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-white border-y border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Deterministic Architecture
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            The 5-Stage Closed-Loop Production Engine
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            How AgencyOS takes a campaign brief from institutional memory to scheduled client delivery with mathematical rigor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <span className="text-xs font-mono font-bold text-[#2383E2]">01</span>
            <h4 className="text-sm font-semibold text-[#37352F]">Context Ingestion</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Cortex compiles negative taboos, verified facts, past top-performing hooks, and target persona rules.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <span className="text-xs font-mono font-bold text-[#D9730D]">02</span>
            <h4 className="text-sm font-semibold text-[#37352F]">Agent Coordination</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Brand Strategist and Persona Architect debate angles, hooks, and channel-specific pacing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <span className="text-xs font-mono font-bold text-[#6941C6]">03</span>
            <h4 className="text-sm font-semibold text-[#37352F]">Multi-Asset Scripting</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Script Director and Copywriter draft carousels, video scripts, ad copy, and teleprompter cues in parallel.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <span className="text-xs font-mono font-bold text-[#E03E3E]">04</span>
            <h4 className="text-sm font-semibold text-[#37352F]">Taboo Gate Check</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Deterministic guardian scans all copy against certified legal boundaries before human review.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[rgba(55,53,47,0.09)] space-y-2">
            <span className="text-xs font-mono font-bold text-[#0F7B6C]">05</span>
            <h4 className="text-sm font-semibold text-[#37352F]">Publish & Learn</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Client approves via magic-link. Campaign auto-schedules directly to Meta and LinkedIn.
            </p>
          </div>
        </div>
      </section>

      {/* ── Six Core Product Modules (Bento Grid) ── */}
      <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Full Suite Capabilities
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight">
            Everything your agency needs under one roof
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65]">
            Built specifically for marketing agencies, creative directors, and performance marketers managing high-value retainers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module 1 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#DDEBF1] text-[#0B6E99] flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 01</span>
            <h3 className="text-base font-semibold text-[#37352F]">Cortex Living Brand Vault</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Store client voice rules, negative taboos, and approved claims. Injected deterministically so AI never breaks compliance.
            </p>
          </div>

          {/* Module 2 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAEBDD] text-[#D9730D] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 02</span>
            <h3 className="text-base font-semibold text-[#37352F]">6-Agent Campaign Studio</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Formulate 30-day omnichannel campaign plans, carousels, video scripts, and ad angles in minutes with specialized AI roles.
            </p>
          </div>

          {/* Module 3 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 03</span>
            <h3 className="text-base font-semibold text-[#37352F]">Viral Teleprompter Studio</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Give your creators and client executives a mobile-optimized prompter with scene pacing, timer sync, and hook emphasis.
            </p>
          </div>

          {/* Module 4 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 04</span>
            <h3 className="text-base font-semibold text-[#37352F]">Magic-Link Review Rooms</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Frictionless client approvals with zero password setup. Clean visual previews, one-click sign-offs, and clear revision logs.
            </p>
          </div>

          {/* Module 5 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F1F1EF] text-[#37352F] flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 05</span>
            <h3 className="text-base font-semibold text-[#37352F]">Omnichannel Calendar & Dispatch</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Direct Meta Graph API and LinkedIn API publishing. Drag-and-drop rescheduling with automatic token health verification.
            </p>
          </div>

          {/* Module 6 */}
          <div className="p-6 rounded-2xl bg-white border border-[rgba(55,53,47,0.09)] shadow-xs hover:border-[rgba(55,53,47,0.18)] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#DDEBF1] text-[#2383E2] flex items-center justify-center">
              <MessagesSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-[#9B9A97]">Module 06</span>
            <h3 className="text-base font-semibold text-[#37352F]">Community Inbox & Social CRM</h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Turn post comments and DMs into qualified leads. Automatic intent triage, sentiment scoring, and 1-click on-brand replies.
            </p>
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

      {/* ── Enterprise Governance & Security ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9B9A97]">
            Enterprise Trust
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-[#37352F]">
            Built for client confidentiality and data integrity
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] space-y-2">
            <Database className="w-5 h-5 text-[#2383E2]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Row-Level Tenant Isolation</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Every client agency has strictly isolated Postgres schemas. No cross-client data bleeding.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] space-y-2">
            <Lock className="w-5 h-5 text-[#0F7B6C]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Zero AI Model Training</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Client guidelines, proprietary copy, and voice rules are never used to train public or foundation models.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#D9730D]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Meta Graph API Partner</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Direct token health monitoring and automated alerts if client permissions or page tokens expire.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[rgba(55,53,47,0.08)] space-y-2">
            <CheckCircle2 className="w-5 h-5 text-[#6941C6]" />
            <h4 className="text-xs font-semibold text-[#37352F]">Role-Based Access Control</h4>
            <p className="text-[11px] text-[#6B6A65]">
              Hide agency billing, credit burn rates, and financial margins from freelancers and junior writers.
            </p>
          </div>
        </div>
      </section>

      {/* ── High-Converting Bottom CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#F7F6F3] border border-[rgba(55,53,47,0.12)] text-center space-y-6">
          <span className="px-3 py-1 rounded-full bg-white border border-[rgba(55,53,47,0.09)] text-xs font-mono text-[#6B6A65]">
            Instant Workspace Activation
          </span>

          <h2 className="text-3xl sm:text-4xl font-semibold text-[#37352F] tracking-tight max-w-xl mx-auto">
            Ready to run your agency on a modern operating system?
          </h2>

          <p className="text-sm sm:text-base text-[#6B6A65] max-w-lg mx-auto">
            Join forward-thinking agencies scaling retainers with zero brand drift and frictionless client approvals.
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
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Product</p>
            <ul className="space-y-2">
              <li><a href="#demo" className="hover:text-[#37352F]">Cortex Memory Vault</a></li>
              <li><a href="#demo" className="hover:text-[#37352F]">6-Agent Campaign Studio</a></li>
              <li><a href="#demo" className="hover:text-[#37352F]">Magic-Link Review Rooms</a></li>
              <li><a href="#demo" className="hover:text-[#37352F]">Viral Teleprompter</a></li>
              <li><a href="#demo" className="hover:text-[#37352F]">Community Inbox</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Solutions</p>
            <ul className="space-y-2">
              <li><span className="hover:text-[#37352F] cursor-pointer">For Performance Agencies</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">For Creative Studios</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">For Social Media Teams</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">For Fractional CMOs</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">Security & Legal</p>
            <ul className="space-y-2">
              <li><span className="hover:text-[#37352F] cursor-pointer">SOC-2 Type II Certified</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">Meta Graph API Compliance</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">GDPR & Tenant Privacy</span></li>
              <li><span className="hover:text-[#37352F] cursor-pointer">Zero Model Training Policy</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#37352F] uppercase tracking-wider font-mono text-[11px]">AgencyOS</p>
            <p className="text-xs text-[#9B9A97] leading-relaxed">
              The operating system powering modern marketing agencies with institutional memory and multi-agent production.
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
            <span>PostgreSQL Schema v2.4 · API Latency: 42ms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
