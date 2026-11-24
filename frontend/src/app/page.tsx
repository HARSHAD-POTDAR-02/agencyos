"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Brain,
  FileCheck2,
  CalendarDays,
  MessagesSquare,
  Lock,
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/landing/Navbar";
import { InteractiveWorkspace } from "@/components/landing/InteractiveWorkspace";
import { TeleprompterPreview } from "@/components/landing/TeleprompterPreview";
import { MarginCalculator } from "@/components/landing/MarginCalculator";

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const [copiedDiffLink, setCopiedDiffLink] = useState(false);
  const [differentiatorDocView, setDifferentiatorDocView] = useState<"cards" | "document">("cards");
  const [differentiatorApproval, setDifferentiatorApproval] = useState<"pending" | "approved">("pending");

  const isAuthenticated = !isLoading && Boolean(token);

  const handleCopyDiff = () => {
    setCopiedDiffLink(true);
    setTimeout(() => setCopiedDiffLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111114] font-sans antialiased selection:bg-[#E9E9E7] selection:text-[#111114]">
      {/* ── Section 1: Sticky Navigation ── */}
      <Navbar />

      {/* ── Section 2: Hero Section ── */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[rgba(55,53,47,0.12)] shadow-xs mb-6 text-xs text-[#6B6A65]">
          <span className="font-semibold text-[#111114]">AI-Native Agency Operating System</span>
          <span className="text-[#C7C6C2]">·</span>
          <span>Built for Social & Creative Agencies</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] text-[#111114] max-w-4xl mx-auto leading-[1.12]">
          The Operating System for Modern Marketing Agencies.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-[#6B6A65] max-w-3xl mx-auto leading-relaxed">
          Run client institutional memory, six specialized AI agents, mobile client approvals, content calendars, and social engagement from one deterministic workspace.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Start Agency Workspace</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <a
            href="#preview"
            className="w-full sm:w-auto px-5 py-3 rounded-full text-sm font-medium bg-white text-[#111114] hover:bg-[#F1F1EF] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <span>Try the Live Interface</span>
          </a>
        </div>

        {/* Trust & Truth Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#6B6A65]">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Unlimited team members & free human collaboration
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Deterministic brand rules & taboo enforcement
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Direct Instagram, Facebook & LinkedIn publishing
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Zero AI model training on client IP
          </span>
        </div>
      </section>

      {/* ── Section 3: Flagship Interactive AgencyOS Workspace ── */}
      <InteractiveWorkspace />

      {/* ── Section 4: Operational Problem (Fragmented Stack vs AgencyOS) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
            Operational Stack Breakdown
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight">
            Stop stitching together five disconnected tools for every client
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Marketing agencies lose dozens of hours every month managing fragmented handoffs between generic copy generators, spreadsheets, and chat threads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Disconnected Stack */}
          <div className="p-7 rounded-2xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.12)] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
              <div>
                <h3 className="text-sm font-semibold text-[#111114]">Disconnected Agency Stack</h3>
                <p className="text-xs text-[#6B6A65]">Asana + Google Docs + ChatGPT + Hootsuite + WhatsApp</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-xs font-mono font-medium">
                Fragile Handoffs
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#6B6A65]">
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">$1,200+/mo seat-tax bleed:</strong> Paying per-user fees across task tools, document software, and social schedulers.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">Brand voice drift:</strong> Junior specialists and generic prompts repeatedly forget client compliance boundaries and hard negative taboos.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">Approval gridlock:</strong> Client feedback stays buried across WhatsApp voice notes, email threads, and shared Drive folders.
                </span>
              </li>
            </ul>
          </div>

          {/* Unified AgencyOS Pipeline */}
          <div className="p-7 rounded-2xl bg-white border border-[rgba(55,53,47,0.14)] shadow-notion-card space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(55,53,47,0.08)]">
              <div>
                <h3 className="text-sm font-semibold text-[#111114]">Unified AgencyOS Pipeline</h3>
                <p className="text-xs text-[#0F7B6C]">One Deterministic Agency Operating System</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-xs font-mono font-medium">
                Deterministic
              </span>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#6B6A65]">
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">Enforced institutional memory:</strong> Client brand rules and taboos are loaded deterministically before copy ever reaches review.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">Zero-friction mobile approvals:</strong> Clients review and sign off on carousels and reels from their phone via 1-click magic links.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111114]">Dependency-locked execution:</strong> Approved work flows cleanly from Campaign Studio to Campaign Plans to the Content Calendar.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 5: The Three Core Differentiators ── */}
      <section id="differentiators" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-20 border-t border-[rgba(55,53,47,0.08)]">
        {/* Showcase 1: Cortex Living Brand Vault */}
        <div className="space-y-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FAF9F6] text-[#111114] border border-[rgba(55,53,47,0.12)] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
              <Brain className="w-3.5 h-3.5" />
              <span>Differentiator 01 · Institutional Memory</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight">
              Cortex Living Brand Vault: Deterministic Enforcement, Not Passive Search
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
              Static brand PDFs and passive vector search still let generic AI hallucinate off-brand copy. Cortex loads verified client boundaries and negative taboos directly into every model generation run.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-card overflow-hidden">
            <div className="bg-[#FAF9F6] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-xs text-[#111114]">One8 Commune · Brand Vault</span>
                <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
                  Deterministic Lock Active
                </span>
              </div>

              <div className="flex items-center bg-[#F1F1EF] rounded-lg p-0.5 text-xs font-mono">
                <button
                  onClick={() => setDifferentiatorDocView("cards")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    differentiatorDocView === "cards" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                  }`}
                >
                  Cards View
                </button>
                <button
                  onClick={() => setDifferentiatorDocView("document")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    differentiatorDocView === "document" ? "bg-white text-[#111114] font-semibold shadow-xs" : "text-[#6B6A65]"
                  }`}
                >
                  Clean Document
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {differentiatorDocView === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[rgba(224,62,62,0.22)] bg-[#FAF9F6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">TABOO-01</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never claim unverified medicinal or therapeutic benefits regarding botanical ingredients.
                    </p>
                    <p className="text-[11px] text-[#6B6A65]">
                      <span className="font-medium text-[#111114]">Source Provenance:</span> &quot;We do not claim our drinks cure ailments. Frame them around hospitality ritual only.&quot; (Client CMO)
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[rgba(224,62,62,0.22)] bg-[#FAF9F6] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#FBE4E4] text-[#E03E3E] text-[10px] font-mono font-semibold">
                        Negative Taboo
                      </span>
                      <span className="text-[10px] font-mono text-[#9B9A97]">RULE-04</span>
                    </div>
                    <p className="font-semibold text-[#111114]">
                      Never mention discounting, coupon promo codes, or cheap rates on signature menu dishes.
                    </p>
                    <p className="text-[11px] text-[#6B6A65]">
                      <span className="font-medium text-[#111114]">Source Provenance:</span> &quot;Zero public discounting. We protect premium dining positioning across all channels.&quot; (Founding Partner)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] font-mono text-xs text-[#111114] space-y-2">
                  <p className="font-semibold text-sm border-b pb-1">One8 Commune — Living Institutional Memory</p>
                  <p className="text-[#6B6A65]">Compiled Fact Count: 8 Active Rules · Zero Drift Enforced</p>
                  <div className="pt-2 space-y-1.5 text-[#111114]">
                    <p>1. [TABOO-01]: Never claim unverified health or therapeutic benefits regarding botanical formulas.</p>
                    <p>2. [RULE-04]: Never mention discounting, promo codes, or cheap rates on signature dishes.</p>
                    <p>3. [STANDARD-02]: All video reels must emphasize culinary craft and locally sourced ingredients.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Showcase 2: Magic-Link Review Rooms */}
        <div className="space-y-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Differentiator 02 · Frictionless Client Approvals</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight">
              Magic-Link Review Rooms: 1-Click Mobile Approvals, Not Noisy Chat Threads
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
              Clients refuse to create logins for complex project management software and scatter feedback across WhatsApp and email. AgencyOS dispatches branded, tokenized review rooms where clients approve carousels and reels on their phone with zero password friction.
            </p>
          </div>

          <div className="max-w-3xl bg-white rounded-2xl border border-[rgba(55,53,47,0.12)] shadow-notion-card overflow-hidden">
            <div className="bg-[#FAF9F6] border-b border-[rgba(55,53,47,0.08)] px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#111114]">One8 Commune · Weekend Truffle Tasting Deliverable</h3>
                <p className="text-[10px] text-[#6B6A65]">Encrypted Magic Token (72hr Expiry) · Zero Password Required</p>
              </div>
              <span className="text-[10px] font-mono text-[#0F7B6C] bg-[#DDEDEA] px-2 py-0.5 rounded font-medium">
                {differentiatorApproval === "approved" ? "Approved for Publication" : "Pending Sign-off"}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.08)] space-y-2 text-xs">
                <span className="font-semibold text-[#111114]">Instagram 5-Slide Carousel Preview</span>
                <p className="text-[#6B6A65] leading-relaxed">
                  Highlights chef culinary craft, black winter truffle reduction, and Friday evening seating reservations. Verified compliant with RULE-04 (zero discounting).
                </p>
              </div>

              <div className="p-2.5 rounded bg-white border border-[rgba(55,53,47,0.08)] flex items-center justify-between text-xs font-mono text-[#6B6A65]">
                <span className="truncate">https://agencyos.io/review/o8c-truffle-4182</span>
                <button
                  onClick={handleCopyDiff}
                  className="ml-2 px-2.5 py-1 rounded bg-[#F1F1EF] text-[#111114] text-[11px] font-sans hover:bg-[#E9E9E7] transition-colors cursor-pointer shrink-0"
                >
                  {copiedDiffLink ? "Copied!" : "Copy Magic Link"}
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#6B6A65] flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F7B6C]" />
                  Cryptographic IP audit trail recorded upon approval
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setDifferentiatorApproval(differentiatorApproval === "approved" ? "pending" : "approved")
                    }
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      differentiatorApproval === "approved"
                        ? "bg-[#0F7B6C] text-white"
                        : "bg-[#111114] text-white hover:bg-[#2F2E2B]"
                    }`}
                  >
                    {differentiatorApproval === "approved" ? "Approved" : "Approve Deliverable (1-Click)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Showcase 3: Viral Teleprompter Studio */}
        <div className="space-y-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#FBF3DB] text-[#9A6700] font-mono text-xs font-semibold uppercase tracking-wider mb-3">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Differentiator 03 · Video Creator & Founder Suite</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight">
              Viral Teleprompter Studio: Built-In Video Execution, Not Disconnected Script Docs
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
              Agencies write video scripts in Google Docs and leave talent guessing pacing, hooks, and delivery. AgencyOS syncs approved scripts directly into a live teleprompter with speaking rate controls, scene hook cues, and runtime estimators.
            </p>
          </div>

          <TeleprompterPreview
            clientName="One8 Commune"
            reelTitle="Chef's Truffle Tasting Reel (60s Short-Form)"
            wordCount={138}
          />
        </div>
      </section>

      {/* ── Section 6: Daily Operations Bento Grid ── */}
      <section id="operations" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[rgba(55,53,47,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
            Daily Operations & Governance
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight">
            Complete Post-Approval Execution Under One Roof
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6B6A65] leading-relaxed">
            Everything that happens after sign-off—publishing, engagement, task delegation, and access security—is automated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bento 1: Content Calendar & Publishing */}
          <div className="p-7 rounded-2xl bg-white border border-[rgba(55,53,47,0.12)] shadow-notion-card space-y-4">
            <div className="w-9 h-9 rounded-xl bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-bold text-xs">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[#111114]">
              Omnichannel Content Calendar & Direct Publishing
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Drag-and-drop scheduling across Instagram, Facebook, and LinkedIn. Preview exact smartphone feed simulations before posting, with proactive 72-hour alerts before any client connection token expires.
            </p>
          </div>

          {/* Bento 2: Community Inbox & Social CRM */}
          <div className="p-7 rounded-2xl bg-white border border-[rgba(55,53,47,0.12)] shadow-notion-card space-y-4">
            <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] text-[#111114] border border-[rgba(55,53,47,0.1)] flex items-center justify-center font-bold text-xs">
              <MessagesSquare className="w-4 h-4 text-[#0F7B6C]" />
            </div>
            <h3 className="text-base font-semibold text-[#111114]">
              Community Inbox & Social CRM
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Live comment and DM streams triaged by automated buying-intent scoring (High-Intent Lead · 94/100). Draft replies cite verified brand rules and can be approved and published to social in 1 click.
            </p>
          </div>

          {/* Bento 3: Dependency-Locked Pipeline */}
          <div className="p-7 rounded-2xl bg-white border border-[rgba(55,53,47,0.12)] shadow-notion-card space-y-4">
            <div className="w-9 h-9 rounded-xl bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-bold text-xs">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[#111114]">
              Dependency-Locked Production Pipeline
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Downstream production, filming, and publishing tasks stay locked until upstream strategy and compliance sign-offs clear, preventing unapproved assets from shipping prematurely.
            </p>
          </div>

          {/* Bento 4: Role-Based Access Control */}
          <div className="p-7 rounded-2xl bg-white border border-[rgba(55,53,47,0.12)] shadow-notion-card space-y-4">
            <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] text-[#111114] border border-[rgba(55,53,47,0.1)] flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-[#111114]" />
            </div>
            <h3 className="text-base font-semibold text-[#111114]">
              Role-Based Access Control (RBAC)
            </h3>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              Clean tenant isolation per client. The Admin tier (Team, Billing & Credits, Settings) is strictly hidden from freelance copywriters and junior specialists, protecting agency financial margins.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 7: Fair Agency Credit Economics & Margin Calculator ── */}
      <MarginCalculator />

      {/* ── Section 8: Bottom CTA & Public-Safe Footer ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#FAF9F6] border border-[rgba(55,53,47,0.12)] text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight max-w-xl mx-auto">
            Run every client retainer on one deterministic system.
          </h2>

          <p className="text-sm sm:text-base text-[#6B6A65] max-w-lg mx-auto">
            Zero brand drift, zero seat taxes, and 1-click mobile client approvals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>Start Agency Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-5 py-3 rounded-full text-sm font-medium bg-white text-[#111114] hover:bg-[#F1F1EF] border border-[rgba(55,53,47,0.12)] transition-all shadow-xs"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(55,53,47,0.08)] bg-white py-12 px-4 sm:px-6 lg:px-8 text-xs text-[#6B6A65]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <p className="font-semibold text-[#111114] uppercase tracking-wider font-mono text-[11px]">Product</p>
            <ul className="space-y-2">
              <li><a href="#preview" className="hover:text-[#111114]">Interactive Preview</a></li>
              <li><a href="#differentiators" className="hover:text-[#111114]">Cortex Memory Vault</a></li>
              <li><a href="#differentiators" className="hover:text-[#111114]">Magic-Link Reviews</a></li>
              <li><a href="#differentiators" className="hover:text-[#111114]">Viral Teleprompter</a></li>
              <li><a href="#operations" className="hover:text-[#111114]">Daily Operations</a></li>
              <li><a href="#pricing" className="hover:text-[#111114]">Pricing & Credits</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#111114] uppercase tracking-wider font-mono text-[11px]">Workspaces</p>
            <ul className="space-y-2">
              <li><Link href="/login" className="hover:text-[#111114]">Sign In</Link></li>
              <li><Link href="/signup" className="hover:text-[#111114]">Create Workspace</Link></li>
              <li><Link href="/dashboard" className="hover:text-[#111114]">Agency Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#111114] uppercase tracking-wider font-mono text-[11px]">Governance</p>
            <ul className="space-y-2">
              <li><span className="text-[#6B6A65]">Tenant Data Isolation</span></li>
              <li><span className="text-[#6B6A65]">Meta Graph API Partner</span></li>
              <li><span className="text-[#6B6A65]">Zero Model Training Policy</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-[#111114] uppercase tracking-wider font-mono text-[11px]">AgencyOS by Brieva</p>
            <p className="text-xs text-[#6B6A65] leading-relaxed">
              The autonomous operating system powering creative and social media agencies with institutional memory and multi-agent execution.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-[rgba(55,53,47,0.06)] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#6B6A65] gap-3">
          <div>
            <span>&copy; 2026 AgencyOS by Brieva. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-2 text-[#0F7B6C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C]" />
            <span>All Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
