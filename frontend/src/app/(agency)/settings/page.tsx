"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings,
  Building2,
  Cpu,
  ShieldAlert,
  Webhook,
  CheckCircle2,
  Save,
  Globe,
  Clock,
  DollarSign,
  AlertCircle,
  Key,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { currentRole, isOwnerOrManager, agencies, activeAgencyId } = useAuth();
  const currentAgency = agencies.find((a) => a.agency_id === activeAgencyId) || agencies[0];

  const [agencyName, setAgencyName] = useState(currentAgency?.agency_name || "AgencyOS Workspace");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD ($)");
  const [primaryModel, setPrimaryModel] = useState("claude-3-5-sonnet");
  const [strictBrandEnforcement, setStrictBrandEnforcement] = useState(true);
  const [autoFlagTaboos, setAutoFlagTaboos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // RBAC guard
  if (!isOwnerOrManager) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#101014] text-[#191919] dark:text-[#F2F0F7] flex items-center justify-center p-6">
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 max-w-md w-full text-center space-y-4 shadow-sm bg-white dark:bg-[#17171E]">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-bold text-base">Restricted Settings Area</h2>
          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] leading-relaxed">
            Workspace configuration, API keys, and model parameters are restricted to Agency Owners and Production Managers.
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#101014] text-[#191919] dark:text-[#F2F0F7] p-6 lg:p-8 space-y-8 max-w-5xl">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-[#A78BFA] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              Administration
            </span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">•</span>
            <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] font-mono">Global Configuration</span>
          </div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-[#191919] dark:text-[#F2F0F7] flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-purple-600 dark:text-[#A78BFA]" />
            <span>Workspace Settings</span>
          </h1>
          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] mt-1">
            Configure agency details, AI pipeline default models, Cortex brand compliance, and integration keys.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Workspace settings saved successfully!</span>
        </div>
      )}

      {/* ── Section 1: General Workspace Profile ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs bg-white dark:bg-[#17171E] space-y-4">
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
          <h3 className="font-heading font-bold text-sm text-[#191919] dark:text-[#F2F0F7]">
            Agency Identity &amp; Region
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Agency Business Name
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014] px-3 text-xs text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Primary Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014] px-3 text-xs text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-purple-500"
            >
              <option value="USD ($)">USD ($)</option>
              <option value="EUR (€)">EUR (€)</option>
              <option value="GBP (£)">GBP (£)</option>
              <option value="INR (₹)">INR (₹)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Default Operational Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014] px-3 text-xs text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-purple-500"
            >
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="America/New_York">Eastern Time (America/New_York)</option>
              <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
              <option value="Europe/London">Greenwich / BST (Europe/London)</option>
              <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Tenant Isolation Mode
            </label>
            <div className="h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-3 flex items-center text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Strict Multi-Tenant Row Security (Active)
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: AI Pipeline & Intelligence Defaults ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs bg-white dark:bg-[#17171E] space-y-4">
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
          <h3 className="font-heading font-bold text-sm text-[#191919] dark:text-[#F2F0F7]">
            AI Pipeline &amp; Model Routing
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Primary Creative Model
            </label>
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014] px-3 text-xs text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-purple-500"
            >
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Directorial &amp; Strategic Pacing)</option>
              <option value="gpt-4o">OpenAI GPT-4o (High-Throughput Generalist)</option>
              <option value="gemini-1-5-pro">Google Gemini 1.5 Pro (Multimodal Long-Context)</option>
              <option value="nvidia-nemotron">NVIDIA Nemotron 70B (High-Speed Local Inference)</option>
            </select>
            <p className="text-[10px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1">
              Applied automatically across Campaign Studio and Viral Scriptwriter.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-[#6B6A65] dark:text-[#A3A0B0] uppercase tracking-wider mb-1">
              Deterministic Output Filtering
            </label>
            <div className="h-9 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-3 flex items-center text-xs text-purple-600 dark:text-[#A78BFA] font-medium">
              Zero-Markdown-Clutter Active (No asterisks/emojis)
            </div>
            <p className="text-[10px] text-[#6B6A65] dark:text-[#A3A0B0] mt-1">
              Guarantees executive presentation formatting across all client deliverables.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 3: Brand Safety & Cortex Guardrails ── */}
      <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs bg-white dark:bg-[#17171E] space-y-4">
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-[#A78BFA]" />
          <h3 className="font-heading font-bold text-sm text-[#191919] dark:text-[#F2F0F7]">
            Cortex Memory &amp; Brand Compliance Guardrails
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014]">
            <div>
              <p className="font-semibold text-[#191919] dark:text-[#F2F0F7]">
                Deterministic Negative Taboo Pre-Check
              </p>
              <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-0.5">
                Automatically rejects generated copy containing prohibited legal phrases or forbidden claims before client review.
              </p>
            </div>
            <button
              onClick={() => setStrictBrandEnforcement(!strictBrandEnforcement)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                strictBrandEnforcement ? "bg-purple-600" : "bg-black/[0.2] dark:bg-white/[0.2]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  strictBrandEnforcement ? "left-4.5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#FBFBFA] dark:bg-[#101014]">
            <div>
              <p className="font-semibold text-[#191919] dark:text-[#F2F0F7]">
                Proactive Flagging on Task Submission
              </p>
              <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] mt-0.5">
                Alerts video editors and copywriters in real-time when submitting assets with unverified facts.
              </p>
            </div>
            <button
              onClick={() => setAutoFlagTaboos(!autoFlagTaboos)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                autoFlagTaboos ? "bg-purple-600" : "bg-black/[0.2] dark:bg-white/[0.2]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoFlagTaboos ? "left-4.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
