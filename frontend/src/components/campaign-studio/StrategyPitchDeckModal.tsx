"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Presentation,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Printer,
  Calendar,
  Target,
  ShieldCheck,
  Layers,
  Film,
  CheckCircle2,
  TrendingUp,
  Award,
  Maximize2,
  Minimize2,
  Star,
  Quote,
  Building2,
  Clock,
  ArrowRight,
  Compass,
} from "lucide-react";

interface StrategicAngle {
  angle_name: string;
  angle_premise: string;
  target_audience_segment?: string;
  estimated_impact?: string;
  rationale?: string;
  aligned_content_pillar?: string;
}

interface MessagingPillar {
  pillar_name: string;
  core_message: string;
  proof_points?: string[];
  primary_call_to_action?: string;
}

interface DeliverableItem {
  day_number?: number;
  planned_day?: number;
  title: string;
  deliverable_type: string;
  platform: string;
  hero_entity?: string | null;
  hero_focus?: string[];
  primary_hook?: string;
  caption?: string;
  call_to_action?: string;
}

interface CampaignStrategy {
  campaign_theme?: string;
  primary_objective?: string;
  target_audience_definition?: string;
  strategic_angles?: StrategicAngle[];
  messaging_pillars?: MessagingPillar[];
  platform_distribution_strategy?: Record<string, string>;
  pacing_and_cadence?: string;
  budget_allocation?: Record<string, number>;
  success_benchmarks?: Record<string, string>;
  assumptions_and_risks?: string[];
}

interface QualityEvaluation {
  compliance_score: number;
  is_approved_for_human_review: boolean;
  findings?: Array<{
    category: string;
    severity: string;
    issue_description: string;
  }>;
}

interface CampaignPlanDraft {
  campaign_name?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  objective?: string;
  brand_voice?: string;
  content_pillars?: string[];
  total_deliverables_planned?: number;
  strategy?: CampaignStrategy;
  deliverables?: DeliverableItem[];
  quality_evaluation?: QualityEvaluation;
}

interface CampaignData {
  id: string;
  name: string;
  period_month?: number | null;
  period_year?: number | null;
  objective?: string | null;
  status: string;
  ai_plan_draft?: CampaignPlanDraft | null;
  created_at?: string;
}

interface ClientData {
  id: string;
  business_name: string;
  industry?: string | null;
}

interface StrategyPitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignData | null;
  client: ClientData | null;
}

export function StrategyPitchDeckModal({
  isOpen,
  onClose,
  campaign,
  client,
}: StrategyPitchDeckModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const draft = campaign?.ai_plan_draft;
  const strategy = draft?.strategy;
  const deliverables = draft?.deliverables || [];
  const complianceScore = draft?.quality_evaluation
    ? Math.round(
        draft.quality_evaluation.compliance_score <= 1
          ? draft.quality_evaluation.compliance_score * 100
          : draft.quality_evaluation.compliance_score
      )
    : 92;

  // Derive unique hero entities from deliverables
  const heroEntities = Array.from(
    new Set(
      deliverables
        .map((d) => d.hero_entity)
        .filter((h): h is string => Boolean(h && h.trim().length > 0))
    )
  );

  // Group deliverables by week (7 days per week)
  const deliverablesByWeek: Record<number, DeliverableItem[]> = {};
  deliverables.forEach((d) => {
    const day = d.planned_day || d.day_number || 1;
    const week = Math.min(4, Math.floor((day - 1) / 7) + 1);
    if (!deliverablesByWeek[week]) deliverablesByWeek[week] = [];
    deliverablesByWeek[week].push(d);
  });

  // Calculate format counts
  const reelCount = deliverables.filter((d) =>
    d.deliverable_type.toLowerCase().includes("reel")
  ).length;
  const carouselCount = deliverables.filter((d) =>
    d.deliverable_type.toLowerCase().includes("carousel")
  ).length;
  const staticCount = deliverables.length - reelCount - carouselCount;

  // Slide list definition
  const slideTitles = [
    "Executive Overview",
    "Audience & Positioning",
    "Messaging Architecture",
    "Strategic Angles",
    "Hero Offerings",
    "Media Mix & Cadence",
    "Content Calendar Matrix",
    "Governance & ROI",
  ];
  const totalSlides = slideTitles.length;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextSlide, prevSlide, onClose]);

  // Reset slide on open
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0E]/95 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          TOP CONTROL BAR (Screen Only)
      ───────────────────────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-[#101014]/80 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex items-center justify-center text-[#A78BFA]">
            <Presentation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0]">
              <span className="text-[#A78BFA] font-semibold">{client?.business_name || "Client"}</span>
              <span>/</span>
              <span className="truncate max-w-[220px]">{campaign.name}</span>
            </div>
            <h1 className="text-sm font-heading font-bold text-[#F2F0F7] flex items-center gap-2">
              <span>{slideTitles[currentSlide]}</span>
              <span className="text-[10px] font-mono text-[#A3A0B0] font-normal">
                ({currentSlide + 1} of {totalSlides})
              </span>
            </h1>
          </div>
        </div>

        {/* Slide Progress Dots */}
        <div className="hidden md:flex items-center gap-1.5 bg-[#17171E] px-3 py-1.5 rounded-full border border-white/[0.06]">
          {slideTitles.map((title, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              title={`${idx + 1}. ${title}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentSlide
                  ? "w-6 bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.5)]"
                  : "w-2 bg-white/[0.15] hover:bg-white/[0.3]"
              }`}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#17171E] hover:bg-[#20202A] text-xs font-semibold text-[#F2F0F7] transition-all cursor-pointer shadow-xs"
            title="Print or Save Presentation as PDF (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl border border-white/[0.08] bg-[#17171E] hover:bg-[#20202A] text-[#A3A0B0] hover:text-[#F2F0F7] transition-all cursor-pointer shadow-xs"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-white/[0.08] bg-[#17171E] hover:bg-[#E16F7B]/10 hover:border-[#E16F7B]/30 text-[#A3A0B0] hover:text-[#E16F7B] transition-all cursor-pointer shadow-xs"
            title="Close Presentation (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN SLIDE VIEWPORT (Responsive Slide Deck)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-6xl aspect-[16/9] min-h-[540px] max-h-[85vh] rounded-3xl surface-card border border-white/[0.1] shadow-[0_12px_48px_rgba(0,0,0,0.6)] p-6 md:p-10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#13131A] via-[#101014] to-[#0D0D12]">
          
          {/* Subtle Ambient Brand Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#A78BFA]/10 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[#69A9D8]/10 blur-[100px] pointer-events-none" />

          {/* =========================================================
              SLIDE 0: TITLE & EXECUTIVE SUMMARY
          ========================================================= */}
          {currentSlide === 0 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[10.5px] font-mono font-bold uppercase tracking-wider bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30">
                    Campaign Strategy Deck
                  </span>
                  <span className="px-3 py-1 rounded-full text-[10.5px] font-mono font-bold uppercase tracking-wider bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{complianceScore}% Brand Compliant</span>
                  </span>
                </div>
                <div className="text-right text-xs font-mono text-[#A3A0B0]">
                  <span>AgencyOS Creative Suite</span>
                </div>
              </div>

              <div className="my-auto space-y-4 max-w-4xl">
                <div className="flex items-center gap-2 text-xs font-mono text-[#A78BFA] font-medium tracking-wide uppercase">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{client?.business_name}</span>
                  {client?.industry && (
                    <>
                      <span>•</span>
                      <span className="text-[#A3A0B0]">{client.industry}</span>
                    </>
                  )}
                </div>

                <h1 className="text-3xl md:text-5xl font-heading font-extrabold tracking-tight text-[#F2F0F7] leading-tight">
                  {campaign.name}
                </h1>

                {strategy?.campaign_theme && (
                  <p className="text-base md:text-xl font-heading font-medium text-[#A78BFA] italic leading-snug">
                    &ldquo;{strategy.campaign_theme}&rdquo;
                  </p>
                )}

                <div className="p-4.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs md:text-sm text-[#A3A0B0] leading-relaxed max-w-3xl">
                  <span className="text-[#F2F0F7] font-semibold">Primary Strategic Directive: </span>
                  {strategy?.primary_objective ||
                    draft?.objective ||
                    campaign.objective ||
                    "Accelerate customer acquisition and brand authority through data-grounded social content."}
                </div>
              </div>

              {/* Stat Footer Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/[0.08]">
                <div>
                  <span className="block text-[10.5px] font-mono uppercase text-[#A3A0B0] tracking-wider">
                    Sprint Duration
                  </span>
                  <span className="text-base font-bold text-[#F2F0F7] font-heading">
                    {draft?.duration_days || deliverables.length || 30} Days
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] font-mono uppercase text-[#A3A0B0] tracking-wider">
                    Total Deliverables
                  </span>
                  <span className="text-base font-bold text-[#A78BFA] font-heading">
                    {deliverables.length} Planned
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] font-mono uppercase text-[#A3A0B0] tracking-wider">
                    Media Formats
                  </span>
                  <span className="text-base font-bold text-[#F2F0F7] font-heading">
                    {reelCount} Reels • {carouselCount} Carousels
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] font-mono uppercase text-[#A3A0B0] tracking-wider">
                    Hero Focus Items
                  </span>
                  <span className="text-base font-bold text-[#E5AA58] font-heading flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-[#E5AA58]" />
                    <span>{heroEntities.length > 0 ? `${heroEntities.length} Pinned Offerings` : "Active Brand Focus"}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 1: AUDIENCE & STRATEGIC POSITIONING
          ========================================================= */}
          {currentSlide === 1 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#A78BFA] tracking-wider">
                  01 / Strategic Positioning
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Target Audience & Brand Persona
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                {/* Target Audience Profile */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5">
                  <div className="flex items-center gap-2.5 text-[#69A9D8] font-semibold text-sm">
                    <Target className="w-4 h-4" />
                    <span className="font-heading">Target Customer Architecture</span>
                  </div>
                  <p className="text-xs md:text-sm text-[#F2F0F7] leading-relaxed">
                    {strategy?.target_audience_definition ||
                      "Modern, discerning consumers and professional buyers prioritizing verifiable performance, transparency, and high craft over generic promises."}
                  </p>
                  <div className="pt-2 border-t border-white/[0.06] text-xs text-[#A3A0B0]">
                    <span className="font-mono text-[10.5px] uppercase block mb-1 text-[#A3A0B0]/70">
                      Core Motivation
                    </span>
                    Driven by clear differentiation, authentic customer proof, and zero corporate fluff.
                  </div>
                </div>

                {/* Brand Voice & Tone Persona */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5">
                  <div className="flex items-center gap-2.5 text-[#A78BFA] font-semibold text-sm">
                    <Quote className="w-4 h-4" />
                    <span className="font-heading">Brand Voice & Calibration</span>
                  </div>
                  <p className="text-xs md:text-sm text-[#F2F0F7] leading-relaxed font-mono">
                    {draft?.brand_voice ||
                      "Authoritative yet approachable, conversational tone with smart hooks and zero corporate jargon."}
                  </p>
                  <div className="pt-2 border-t border-white/[0.06] text-xs text-[#A3A0B0]">
                    <span className="font-mono text-[10.5px] uppercase block mb-1 text-[#A3A0B0]/70">
                      Compliance Guardrail
                    </span>
                    Multi-agent compliance validator enforces 0 ungrounded claims, zero fluff words, and mandatory value delivery.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex items-center justify-between text-xs text-[#A78BFA]">
                <span className="font-medium">
                  Objective: {strategy?.primary_objective || campaign.objective || "Accelerate brand authority"}
                </span>
                <span className="font-mono text-[10.5px]">Validated against active brand guidelines</span>
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 2: MESSAGING ARCHITECTURE & CONTENT PILLARS
          ========================================================= */}
          {currentSlide === 2 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#A78BFA] tracking-wider">
                  02 / Messaging Architecture
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Core Narrative Pillars & Proof Points
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-auto">
                {(strategy?.messaging_pillars && strategy.messaging_pillars.length > 0
                  ? strategy.messaging_pillars.slice(0, 3)
                  : (draft?.content_pillars || ["Brand Authority", "Feature Showcase", "Customer Transformation"]).map(
                      (p) => ({
                        pillar_name: p,
                        core_message: "Deliver consistent value and establish undeniable domain superiority.",
                        proof_points: ["Verifiable quality standards", "Transparent execution"],
                        primary_call_to_action: "Explore full solution",
                      })
                    )
                ).map((pillar, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-[#A78BFA]/30 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#A78BFA] uppercase tracking-wider block mb-1">
                        Pillar 0{idx + 1}
                      </span>
                      <h3 className="font-heading font-bold text-sm text-[#F2F0F7]">
                        {pillar.pillar_name}
                      </h3>
                      <p className="text-xs text-[#A3A0B0] mt-2 leading-relaxed">
                        {pillar.core_message}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] space-y-2">
                      {pillar.proof_points && pillar.proof_points.length > 0 && (
                        <div>
                          <span className="text-[9.5px] font-mono uppercase text-[#A3A0B0]/60 block mb-0.5">
                            Proof Anchor
                          </span>
                          <span className="text-[11px] text-[#45B88A] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{pillar.proof_points[0]}</span>
                          </span>
                        </div>
                      )}
                      {pillar.primary_call_to_action && (
                        <div>
                          <span className="text-[9.5px] font-mono uppercase text-[#A3A0B0]/60 block mb-0.5">
                            Call To Action
                          </span>
                          <span className="text-[11px] text-[#E5AA58] font-mono truncate block">
                            👉 {pillar.primary_call_to_action}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center text-xs text-[#A3A0B0] font-mono">
                Pillars rotate predictably across weekly content sprints to maintain continuous audience engagement.
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 3: STRATEGIC ANGLES
          ========================================================= */}
          {currentSlide === 3 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#A78BFA] tracking-wider">
                  03 / Tactical Angles
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  High-Impact Content Angles
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto">
                {(strategy?.strategic_angles && strategy.strategic_angles.length > 0
                  ? strategy.strategic_angles.slice(0, 4)
                  : [
                      {
                        angle_name: "The Transparency Teardown",
                        angle_premise: "Demystify common industry misconceptions by revealing our rigorous process.",
                        target_audience_segment: "Analytical Buyers",
                        estimated_impact: "High Reach",
                        rationale: "Builds deep trust and immediate social proof.",
                      },
                      {
                        angle_name: "The Problem & Proof Showcase",
                        angle_premise: "Contrast legacy alternatives against our verified core feature benchmarks.",
                        target_audience_segment: "Active Searchers",
                        estimated_impact: "High Conversion",
                        rationale: "Triggers immediate consideration and link-in-bio clicks.",
                      },
                    ]
                ).map((angle, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-[#69A9D8]/30 transition-all flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading font-bold text-sm text-[#F2F0F7] truncate">
                        {angle.angle_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30 shrink-0">
                        {angle.estimated_impact || "High Impact"}
                      </span>
                    </div>

                    <p className="text-xs text-[#A3A0B0] leading-relaxed">
                      {angle.angle_premise}
                    </p>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#A3A0B0] font-mono">
                      <span>Segment: {angle.target_audience_segment || "Core Audience"}</span>
                      {angle.aligned_content_pillar && (
                        <span className="text-[#A78BFA]">{angle.aligned_content_pillar}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between text-xs text-[#A3A0B0]">
                <span>All angles are mapped into specific 0–3 second attention-retention video hooks.</span>
                <span className="font-mono text-[#45B88A]">✓ Hook Variety Calibrated</span>
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 4: HERO OFFERINGS & PINNED FEATURES
          ========================================================= */}
          {currentSlide === 4 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#E5AA58] tracking-wider flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-[#E5AA58]" />
                  <span>04 / Pinned Hero Offerings</span>
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Core Offerings Grounding the Sprint
                </h2>
              </div>

              <div className="my-auto space-y-4">
                {heroEntities.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {heroEntities.slice(0, 3).map((entity, idx) => {
                      const count = deliverables.filter((d) => d.hero_entity === entity).length;
                      return (
                        <div
                          key={idx}
                          className="p-6 rounded-2xl bg-gradient-to-b from-[#E5AA58]/10 to-transparent border border-[#E5AA58]/30 shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#E5AA58] mb-1">
                              <Star className="w-3.5 h-3.5 fill-[#E5AA58]" />
                              <span>Hero Entity 0{idx + 1}</span>
                            </div>
                            <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                              {entity}
                            </h3>
                            <p className="text-xs text-[#A3A0B0] mt-2">
                              Positioned across video hooks and multi-slide carousel breakdowns.
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#E5AA58]/20 flex items-center justify-between text-xs">
                            <span className="font-mono text-[11px] text-[#F2F0F7]">
                              {count > 0 ? `Featured in ${count} deliverables` : "Primary Showcase"}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5AA58]/20 text-[#E5AA58]">
                              Grounded
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center max-w-xl mx-auto space-y-2">
                    <Compass className="w-8 h-8 text-[#A78BFA] mx-auto mb-2" />
                    <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                      Dynamic Brand Focus Active
                    </h3>
                    <p className="text-xs text-[#A3A0B0]">
                      Content generation is anchored directly in verified brand profile offers and client positioning statements.
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#A3A0B0] flex items-center justify-between">
                  <span>
                    Hero grounding guarantees real offerings are highlighted without speculative hallucinations or off-brand claims.
                  </span>
                  <span className="font-mono text-[#E5AA58] font-bold">100% Grounded</span>
                </div>
              </div>

              <div className="text-center text-xs text-[#A3A0B0] font-mono">
                AgencyOS Grounded Intelligence Protocol
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 5: MEDIA MIX & CADENCE
          ========================================================= */}
          {currentSlide === 5 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#A78BFA] tracking-wider">
                  05 / Media Mix & Distribution
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Format Allocation & Publishing Cadence
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto">
                {/* Reels Format Card */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center">
                      <Film className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#A78BFA]">
                      {Math.round((reelCount / (deliverables.length || 1)) * 100)}%
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                    Short-Form Reels ({reelCount})
                  </h3>
                  <p className="text-xs text-[#A3A0B0] leading-relaxed">
                    Designed for discovery and algorithmic reach with high-retention 0–3s opening hooks and cinematic b-roll direction.
                  </p>
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[#A78BFA]/15 text-[#A78BFA]">
                    Instagram Reels & TikTok
                  </span>
                </div>

                {/* Carousels Format Card */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#69A9D8]/10 text-[#69A9D8] flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#69A9D8]">
                      {Math.round((carouselCount / (deliverables.length || 1)) * 100)}%
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                    Carousel Decks ({carouselCount})
                  </h3>
                  <p className="text-xs text-[#A3A0B0] leading-relaxed">
                    Multi-slide educational breakdowns built for bookmarks, shares, and high comment engagement rates.
                  </p>
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[#69A9D8]/15 text-[#69A9D8]">
                    Instagram & LinkedIn Decks
                  </span>
                </div>

                {/* Cadence & Strategy Card */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#45B88A]/10 text-[#45B88A] flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#45B88A]">Cadence</span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                    Pacing & Schedule
                  </h3>
                  <p className="text-xs text-[#A3A0B0] leading-relaxed">
                    {strategy?.pacing_and_cadence ||
                      "Consistent 3–4 high-impact touchpoints per week, avoiding audience fatigue while sustaining algorithmic momentum."}
                  </p>
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[#45B88A]/15 text-[#45B88A]">
                    Automated Scheduler Ready
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between text-xs text-[#A3A0B0]">
                <span>Total Assets Planned: {deliverables.length} production-ready deliverables</span>
                <span className="font-mono text-[#F2F0F7]">Meta Publishing Ready</span>
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 6: 30-DAY CALENDAR MATRIX
          ========================================================= */}
          {currentSlide === 6 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#A78BFA] tracking-wider">
                  06 / Sprint Roadmap
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Scheduled Deliverables Matrix
                </h2>
              </div>

              <div className="my-auto overflow-y-auto max-h-[340px] pr-2 space-y-4">
                {Object.keys(deliverablesByWeek).map((weekNum) => {
                  const weekItems = deliverablesByWeek[Number(weekNum)] || [];
                  return (
                    <div key={weekNum} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#A78BFA] uppercase tracking-wider">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Week 0{weekNum} Schedule ({weekItems.length} Deliverables)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {weekItems.map((item, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                              <span className="text-[#A78BFA] font-bold">
                                Day {item.planned_day || item.day_number || i + 1}
                              </span>
                              <span className="text-[#A3A0B0] uppercase truncate">
                                {item.deliverable_type}
                              </span>
                            </div>
                            <h4 className="text-xs font-semibold text-[#F2F0F7] line-clamp-1">
                              {item.title}
                            </h4>
                            {item.hero_entity && (
                              <span className="inline-block text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/20 truncate max-w-full">
                                ⭐ {item.hero_entity}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#A3A0B0] pt-2 border-t border-white/[0.08]">
                <span>Deliverables convert directly into operational tasks with assigned roles on the Kanban board.</span>
                <span className="font-mono text-[#A78BFA] font-semibold">{deliverables.length} Total Days Mapped</span>
              </div>
            </div>
          )}

          {/* =========================================================
              SLIDE 7: SUCCESS BENCHMARKS & GOVERNANCE
          ========================================================= */}
          {currentSlide === 7 && (
            <div className="flex-1 flex flex-col justify-between py-2 animate-in fade-in duration-300">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase text-[#45B88A] tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>07 / Governance & Benchmarks</span>
                </span>
                <h2 className="text-2xl md:text-3xl font-heading font-bold text-[#F2F0F7] mt-1">
                  Expected ROI & Production Sign-Off
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                {/* Governance Card */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                  <div className="flex items-center gap-2.5 text-[#45B88A] font-semibold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-heading">Automated Brand Compliance</span>
                  </div>
                  <div className="space-y-2 text-xs text-[#A3A0B0]">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Brand Voice Alignment</span>
                      <span className="text-[#45B88A] font-mono font-bold">100% Calibrated</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Prohibited Claims Check</span>
                      <span className="text-[#45B88A] font-mono font-bold">Zero Violations</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Hero Entity Grounding</span>
                      <span className="text-[#E5AA58] font-mono font-bold">Verified Direct</span>
                    </div>
                  </div>
                </div>

                {/* Target Milestones */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                  <div className="flex items-center gap-2.5 text-[#A78BFA] font-semibold text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-heading">Sprint Performance Milestones</span>
                  </div>
                  <div className="space-y-2 text-xs text-[#A3A0B0]">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Phase 1 (Days 1–7)</span>
                      <span className="text-[#F2F0F7] font-medium">Algorithmic Reach & Awareness</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Phase 2 (Days 8–18)</span>
                      <span className="text-[#F2F0F7] font-medium">Feature Depth & Community Shares</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span>Phase 3 (Days 19–30)</span>
                      <span className="text-[#F2F0F7] font-medium">Social Proof & Conversion CTAs</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Sign-off Callout */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#A78BFA]/10 to-[#45B88A]/10 border border-white/[0.1] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#F2F0F7]">
                    Ready to Approve Sprint for Execution?
                  </h4>
                  <p className="text-xs text-[#A3A0B0] mt-0.5">
                    Click &ldquo;Approve & Convert to Tasks&rdquo; on the Campaign Plans page to hand off to writers and video editors.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  Return to Campaign Plan →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM CONTROLLER / SLIDE FOOTER (Screen Only)
      ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between gap-4 bg-[#101014]/80 shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-[#17171E] hover:bg-[#20202A] text-xs font-semibold text-[#F2F0F7] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard Hints */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-[#A3A0B0]">
          <span>
            Use <kbd className="px-1.5 py-0.5 rounded bg-[#17171E] border border-white/[0.1] text-white">←</kbd> /{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#17171E] border border-white/[0.1] text-white">→</kbd> to navigate
          </span>
          <span>•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#17171E] border border-white/[0.1] text-white">Esc</kbd> to exit
          </span>
        </div>

        <div className="text-right text-xs font-mono text-[#A78BFA] font-bold">
          {Math.round(((currentSlide + 1) / totalSlides) * 100)}% Complete
        </div>
      </footer>
    </div>
  );
}
