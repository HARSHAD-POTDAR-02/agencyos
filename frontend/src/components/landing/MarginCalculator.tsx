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
    <div className="border border-[#EAE7DF] bg-[#FFFFFF] divide-y divide-[#EAE7DF]">
      {/* Top Tier: Swiss Architectural P&L Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE7DF]">
        {/* Left Ledger: Agency Base Plan (4 cols) */}
        <div className="lg:col-span-4 p-7 sm:p-8 flex flex-col justify-between space-y-6 bg-[#FAF9F6]/60">
          <div className="space-y-3">
            <span className="inline-block px-2.5 py-0.5 rounded bg-[#DDEDEA] text-[#0F7B6C] text-[10px] font-mono font-semibold uppercase tracking-wider">
              Agency Base Plan
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-heading font-bold text-[#111114] tracking-tight tabular-nums">$50</span>
              <span className="text-xs text-[#6B6A65] font-mono">/ month</span>
            </div>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Includes 50,000 shared monthly credits and unlimited agency seats. Expand headcount without paying extra license fees.
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#111114] pt-4 border-t border-[#EAE7DF] font-sans">
            {[
              "Unlimited team members & specialist seats",
              "Cortex Living Brand Vaults",
              "6-Agent Campaign Intelligence Studio",
              "Magic-Link Review Rooms",
              "Darkroom Teleprompter Suite",
              "Direct Instagram, Facebook & LinkedIn dispatch",
            ].map((feat) => (
              <p key={feat} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
                <span>{feat}</span>
              </p>
            ))}
          </div>

          <Link
            href="/signup"
            className="w-full py-2.5 rounded-full text-xs font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-colors text-center flex items-center justify-center gap-1.5 font-sans"
          >
            <span>Start Agency Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Right Ledger: Always Free vs Computational AI Credits (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE7DF]">
          {/* Always Free Operations */}
          <div className="p-7 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center font-bold text-xs font-mono">
                0
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                  Always Free (0 Credits)
                </h3>
                <p className="text-[11px] text-[#6B6A65] font-sans">Human coordination costs zero credits</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-[#6B6A65] font-sans">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Unlimited team seats and contractor accounts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>DAG task boards and dependency locking</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Dispatching Magic-Link Review Rooms to clients</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Client sign-offs, comments, and audit logs</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0F7B6C] mt-0.5 shrink-0" />
                <span>Manual copy editing and scheduled publishing</span>
              </li>
            </ul>
          </div>

          {/* Credit-Burning AI Tasks */}
          <div className="p-7 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#FBF3DB] text-[#9A6700] flex items-center justify-center font-bold text-xs font-mono">
                AI
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#111114] uppercase tracking-wide font-mono">
                  Credit-Burning AI Tasks
                </h3>
                <p className="text-[11px] text-[#6B6A65] font-sans">Pay strictly for machine execution</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-[#6B6A65] font-sans">
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>6-Agent Campaign Studio generation pipelines</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Extracting rules from client PDFs into Cortex</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Inbound comment intent scoring & triage</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#9A6700] mt-0.5 shrink-0" />
                <span>Drafting brand-verified concierge replies</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Middle Tier: Zero-Lockout Safety Nets Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EAE7DF] bg-[#FAF9F6]/50">
        <div className="p-6 flex items-start gap-3.5">
          <RefreshCw className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-heading font-semibold text-[#111114]">Instant Rollover Top-Ups</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Add top-up packs mid-month at the flat rate of $1 per 1,000 credits with zero overage markup. Rollover credits never expire.
            </p>
          </div>
        </div>

        <div className="p-6 flex items-start gap-3.5">
          <ShieldCheck className="w-4 h-4 text-[#0F7B6C] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-heading font-semibold text-[#111114]">Soft Degradation at Zero Credits</h4>
            <p className="text-xs text-[#6B6A65] leading-relaxed font-sans">
              Reaching zero credits never locks your agency out. It pauses only new AI runs while task boards, approvals, and scheduled posts continue uninterrupted.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Tier: Interactive Retainer Capacity & Margin Fader */}
      <div className="p-7 sm:p-10 space-y-8 bg-[#FFFFFF]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-heading font-bold text-[#111114] tracking-tight">
              Retainer Capacity & Margin Ledger
            </h3>
            <p className="text-xs text-[#6B6A65] font-sans">
              Adjust active client retainers to calculate monthly specialist time and redundant SaaS license elimination.
            </p>
          </div>

          <div className="w-full md:w-80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6B6A65]">
              <span className="tabular-nums">3</span>
              <span className="font-semibold text-[#111114] tabular-nums">{retainers} Active Retainers</span>
              <span className="tabular-nums">50</span>
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#EAE7DF] divide-y sm:divide-y-0 sm:divide-x divide-[#EAE7DF] bg-[#FAF9F6]">
          <div className="p-5 space-y-1">
            <span className="text-2xl sm:text-3xl font-heading font-bold text-[#111114] tracking-tight tabular-nums">
              {hoursSavedPerMonth} hrs
            </span>
            <p className="text-xs font-medium text-[#111114] font-sans">Monthly Specialist Hours Saved</p>
            <p className="text-[11px] text-[#6B6A65] font-sans">Eliminates manual brief copying</p>
          </div>

          <div className="p-5 space-y-1">
            <span className="text-2xl sm:text-3xl font-heading font-bold text-[#0F7B6C] tracking-tight tabular-nums">
              ${saasSavedPerMonth.toLocaleString()}
            </span>
            <p className="text-xs font-medium text-[#111114] font-sans">Seat-Tax Overhead Eliminated</p>
            <p className="text-[11px] text-[#6B6A65] font-sans">Consolidates fragmented subscriptions</p>
          </div>

          <div className="p-5 space-y-1">
            <span className="text-2xl sm:text-3xl font-heading font-bold text-[#9A6700] tracking-tight tabular-nums">
              +{extraRetainers} Retainers
            </span>
            <p className="text-xs font-medium text-[#111114] font-sans">Added Monthly Client Capacity</p>
            <p className="text-[11px] text-[#6B6A65] font-sans">Scale delivery without linear hiring</p>
          </div>
        </div>
      </div>
    </div>
  );
}
