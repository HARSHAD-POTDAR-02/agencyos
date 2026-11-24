"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

export function MarginCalculator() {
  const [retainers, setRetainers] = useState<number>(12);

  const hoursSavedPerMonth = retainers * 14;
  const saasSavedPerMonth = Math.round(retainers * 65);
  const extraRetainers = Math.floor(retainers * 0.45);

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#EAE7DF] bg-[#F3F1EC]/40">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-[#6B6A65]">
          Transparent Economics
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-[#111114] tracking-tight font-sans">
          Fair Pricing with Zero Per-Seat Penalties
        </h2>
        <p className="text-xs sm:text-sm text-[#6B6A65] leading-relaxed font-sans">
          Traditional agency software penalizes hiring by charging $30 to $50 every month for each team member. AgencyOS includes unlimited team seats on every plan and charges only for computational AI work.
        </p>
      </div>

      {/* Base Plan Card + Action Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Core Base Plan Card */}
        <div className="p-7 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-md flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="px-2.5 py-0.5 rounded-full bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold uppercase tracking-wider">
              Agency Base Plan
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold text-[#111114] tracking-tight tabular-nums font-mono">$50</span>
              <span className="text-xs text-[#6B6A65] font-mono">/ month</span>
            </div>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Includes 50,000 shared monthly credits and unlimited agency seats. Never pay extra just because your team grows.
            </p>
          </div>

          <div className="space-y-2.5 text-xs text-[#111114] pt-4 border-t border-[#EAE7DF]">
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Unlimited team members & seats</span>
            </p>
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Cortex Living Brand Vaults</span>
            </p>
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">6-Agent Campaign Studio</span>
            </p>
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Magic-Link Review Rooms</span>
            </p>
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Viral Teleprompter Studio</span>
            </p>
            <p className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
              <span className="font-sans">Instagram, Facebook & LinkedIn Publishing</span>
            </p>
          </div>

          <Link
            href="/signup"
            className="w-full py-2.5 rounded-xl text-xs font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-colors text-center shadow-xs flex items-center justify-center gap-1.5 font-sans"
          >
            <span>Start Agency Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Action Breakdown: Free vs Credit Tasks */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Always Free Operations */}
          <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-bold text-xs font-mono">
                0
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                  Always Free (0 Credits)
                </h3>
                <p className="text-[11px] text-[#6B6A65] font-sans">Human coordination never costs credits</p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-[#6B6A65] font-sans">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Unlimited team seats and specialist accounts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Managing tasks, boards, and calendar scheduling</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Dispatching Magic-Link Review Rooms to clients</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Client approvals, feedback forms, and audit logs</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Manual copy editing and approved post publishing</span>
              </li>
            </ul>
          </div>

          {/* Credit-Burning AI Tasks */}
          <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-bold text-xs font-mono">
                AI
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                  Credit-Burning AI Tasks
                </h3>
                <p className="text-[11px] text-[#6B6A65] font-sans">Pay only for actual machine execution</p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-[#6B6A65] font-sans">
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>6-Agent Campaign Studio generation runs</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Extracting rules from client PDFs and transcripts into Cortex</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Inbound social comment intent scoring & lead triage</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Drafting brand-verified replies in Community Inbox</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Zero-Lockout Safety Nets Callout Strip */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-xs mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3.5">
          <RefreshCw className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-[#111114] font-sans">Instant Rollover Top-Ups</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Need more credits mid-month? Add top-up packs at the exact same flat unit rate of $1 per 1,000 credits with zero overage markup. Top-up credits roll over indefinitely and never expire at month-end.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <ShieldCheck className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-[#111114] font-sans">Soft Degradation at Zero Credits</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Exhausting credits never locks your agency out. It only pauses new AI runs. Your team can continue managing task boards, running client review rooms, and publishing already-scheduled posts without interruption.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Margin & Capacity Slider */}
      <div className="p-8 sm:p-10 rounded-2xl bg-[#FFFFFF] border border-[#EAE7DF] shadow-sm space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <h3 className="text-2xl font-semibold text-[#111114] tracking-tight font-sans">
            Agency Margin & Retainer Capacity Calculator
          </h3>
          <p className="text-xs text-[#6B6A65] font-sans">
            Drag the slider to your current active client retainers to calculate your agency margin expansion.
          </p>
        </div>

        {/* Retainer Range Slider */}
        <div className="max-w-md mx-auto space-y-3 text-center">
          <div className="flex items-center justify-between text-xs font-mono text-[#6B6A65]">
            <span className="tabular-nums">3 Retainers</span>
            <span className="text-base font-semibold text-[#111114] tabular-nums font-mono">{retainers} Active Client Retainers</span>
            <span className="tabular-nums">50 Retainers</span>
          </div>
          <input
            type="range"
            min="3"
            max="50"
            value={retainers}
            onChange={(e) => setRetainers(Number(e.target.value))}
            className="w-full h-1.5 bg-[#EAE7DF] rounded appearance-none cursor-pointer accent-[#111114]"
            aria-label="Adjust Client Retainer Count"
          />
        </div>

        {/* Unlocked Value Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] text-center space-y-1">
            <span className="text-2xl sm:text-3xl font-semibold text-[#111114] tracking-tight font-mono tabular-nums">
              {hoursSavedPerMonth} hrs
            </span>
            <p className="text-xs font-medium text-[#6B6A65] font-sans">Monthly Specialist Hours Saved</p>
            <p className="text-[10px] text-[#8C8A84] font-sans">Eliminates manual copy-pasting</p>
          </div>

          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] text-center space-y-1">
            <span className="text-2xl sm:text-3xl font-semibold text-[#0F7B6C] tracking-tight font-mono tabular-nums">
              ${saasSavedPerMonth.toLocaleString()}
            </span>
            <p className="text-xs font-medium text-[#6B6A65] font-sans">Redundant SaaS Seat-Taxes Cut</p>
            <p className="text-[10px] text-[#8C8A84] font-sans">Replaces 5 single-purpose tools</p>
          </div>

          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] text-center space-y-1">
            <span className="text-2xl sm:text-3xl font-semibold text-[#9A6700] tracking-tight font-mono tabular-nums">
              +{extraRetainers} Retainers
            </span>
            <p className="text-xs font-medium text-[#6B6A65] font-sans">Added Client Capacity</p>
            <p className="text-[10px] text-[#8C8A84] font-sans">Scale revenue without hiring</p>
          </div>
        </div>
      </div>
    </section>
  );
}
