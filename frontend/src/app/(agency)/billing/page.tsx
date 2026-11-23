"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Sparkles,
  Zap,
  CheckCircle2,
  TrendingUp,
  Download,
  ShieldCheck,
  Users,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function BillingPage() {
  const { currentRole, isOwnerOrManager, agencies, activeAgencyId } = useAuth();
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [selectedTopUp, setSelectedTopUp] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  const currentAgency = agencies.find(
    (a) => a.agency_id === activeAgencyId
  ) || agencies[0];

  // RBAC guard: Non-owners/managers are restricted from financial billing
  if (!isOwnerOrManager) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#101014] text-[#191919] dark:text-[#F2F0F7] flex items-center justify-center p-6">
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 max-w-md w-full text-center space-y-4 shadow-sm bg-white dark:bg-[#17171E]">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-bold text-base">Restricted Financial Area</h2>
          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] leading-relaxed">
            Billing, credit purchases, and invoice management are restricted to Agency Owners and Production Managers.
          </p>
          <div className="pt-2">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-xs"
            >
              Return to My Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleTopUp = () => {
    if (!selectedTopUp) return;
    setPurchasing(true);
    setTimeout(() => {
      setPurchasing(false);
      setTopUpSuccess(true);
      setTimeout(() => setTopUpSuccess(false), 4000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#101014] text-[#191919] dark:text-[#F2F0F7] p-6 lg:p-8 space-y-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-[#A78BFA] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              Administration
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">•</span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] font-mono">
              {currentAgency?.agency_name || "Agency Workspace"}
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-[#191919] dark:text-[#F2F0F7] flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-purple-600 dark:text-[#A78BFA]" />
            <span>Billing, Subscriptions &amp; Credits</span>
          </h1>
          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] mt-1">
            Manage your AI generation credit balance, seat allocation, invoices, and payment methods.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#17171E] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#191919] dark:text-[#F2F0F7] transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6B6A65] dark:text-[#A3A0B0]" />
            <span>Export Statement</span>
          </button>
        </div>
      </div>

      {topUpSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Credits successfully added! Your available balance has been topped up.</span>
        </div>
      )}

      {/* ── Key Metrics Grid: Credits, Plan & Seats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: AI Credits Burn & Balance */}
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5 shadow-xs bg-white dark:bg-[#17171E] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#6B6A65] dark:text-[#A3A0B0] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
              Available AI Credits
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              76.9% Remaining
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-extrabold tracking-tight text-[#191919] dark:text-[#F2F0F7]">
                38,450
              </span>
              <span className="text-xs font-mono text-[#6B6A65] dark:text-[#A3A0B0]">
                / 50,000 monthly
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full"
                style={{ width: "76.9%" }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] pt-1">
            <span>Burn rate: ~480 credits/day</span>
            <span className="font-mono text-purple-600 dark:text-[#A78BFA] font-semibold">~24 days runway</span>
          </div>
        </div>

        {/* Card 2: Subscription Tier */}
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5 shadow-xs bg-white dark:bg-[#17171E] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#6B6A65] dark:text-[#A3A0B0] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Active Subscription
            </span>
            <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-[#A78BFA] bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
              Pro Tier
            </span>
          </div>
          <div>
            <div className="text-xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7]">
              Agency Growth Pro
            </div>
            <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] mt-0.5">
              Billed annually at $299 / month
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <span>Next billing cycle:</span>
            <span className="font-mono text-[#191919] dark:text-[#F2F0F7] font-medium">Dec 1, 2026</span>
          </div>
        </div>

        {/* Card 3: Team Seats */}
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5 shadow-xs bg-white dark:bg-[#17171E] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#6B6A65] dark:text-[#A3A0B0] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#2383E2]" />
              Staff Seat Capacity
            </span>
            <Link
              href="/team"
              className="text-[11px] font-medium text-purple-600 dark:text-[#A78BFA] hover:underline flex items-center gap-1"
            >
              <span>Manage</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-extrabold tracking-tight text-[#191919] dark:text-[#F2F0F7]">
                5
              </span>
              <span className="text-xs font-mono text-[#6B6A65] dark:text-[#A3A0B0]">
                / 10 seats filled
              </span>
            </div>
            <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] mt-1">
              Writers, video editors, designers &amp; account managers.
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <span>Available seat allowance:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">5 free seats</span>
          </div>
        </div>
      </div>

      {/* ── Instant Credit Top-Up Packs & Auto-Recharge ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs bg-white dark:bg-[#17171E] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-[#191919] dark:text-[#F2F0F7] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
              Instant Credit Top-Up Packs
            </h3>
            <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] mt-0.5">
              Credits never expire and roll over indefinitely across all client campaigns.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6B6A65] dark:text-[#A3A0B0]">Auto-Recharge at 5k balance:</span>
            <button
              onClick={() => setAutoRecharge(!autoRecharge)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                autoRecharge ? "bg-purple-600" : "bg-black/[0.2] dark:bg-white/[0.2]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoRecharge ? "left-4.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { credits: 10000, price: "$49", perK: "$4.90 per 1k", desc: "Light monthly burst" },
            { credits: 25000, price: "$99", perK: "$3.96 per 1k", desc: "Most popular for multi-brand sprints", popular: true },
            { credits: 50000, price: "$179", perK: "$3.58 per 1k", desc: "Heavy production volume" },
          ].map((pack) => (
            <div
              key={pack.credits}
              onClick={() => setSelectedTopUp(pack.credits)}
              className={`rounded-2xl border p-4.5 transition-all cursor-pointer flex flex-col justify-between ${
                selectedTopUp === pack.credits
                  ? "border-purple-600 bg-purple-500/[0.04] shadow-xs"
                  : "border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.16] dark:hover:border-white/[0.16]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-heading font-extrabold text-[#191919] dark:text-[#F2F0F7]">
                    +{pack.credits.toLocaleString()} Credits
                  </span>
                  {pack.popular && (
                    <span className="text-[9.5px] font-mono font-bold text-purple-600 dark:text-[#A78BFA] bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                      Best Value
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7]">
                    {pack.price}
                  </span>
                  <span className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] font-mono">
                    one-time
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1">{pack.desc}</p>
              </div>

              <div className="pt-4 mt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-[11px]">
                <span className="text-[#6B6A65] dark:text-[#A3A0B0] font-mono">{pack.perK}</span>
                <span className="font-semibold text-purple-600 dark:text-[#A78BFA]">
                  {selectedTopUp === pack.credits ? "Selected" : "Select"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleTopUp}
            disabled={!selectedTopUp || purchasing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {purchasing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Payment...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>
                  Confirm &amp; Purchase{" "}
                  {selectedTopUp ? `+${selectedTopUp.toLocaleString()} Credits` : ""}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── AI Usage Breakdown ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs bg-white dark:bg-[#17171E] space-y-4">
        <h3 className="font-heading font-bold text-sm text-[#191919] dark:text-[#F2F0F7] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
          Credit Consumption Breakdown (Last 30 Days)
        </h3>

        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06] text-xs">
          {[
            {
              feature: "Campaign Studio Multi-Agent Intelligence",
              desc: "6-agent parallel pipeline generating full campaign angles & deliverables",
              used: "8,200 Credits",
              share: "71%",
            },
            {
              feature: "Viral Teleprompter & Storyboard Scriptwriter",
              desc: "Voiceover script generation, speaking pacing & scene dialogue",
              used: "2,150 Credits",
              share: "19%",
            },
            {
              feature: "Cortex Institutional Memory & Vector RAG",
              desc: "Living brand vault embedding updates, negative taboo checks & fact queries",
              used: "1,200 Credits",
              share: "10%",
            },
          ].map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[#191919] dark:text-[#F2F0F7]">{item.feature}</p>
                <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-0.5">{item.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-[#191919] dark:text-[#F2F0F7]">{item.used}</span>
                <span className="text-[10px] text-[#6B6A65] dark:text-[#A3A0B0] block font-mono">({item.share})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
