"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi } from "@/lib/api";
import { 
  DeliverableEditorModal, 
  type DeliverableItem, 
  type ReelSceneItem, 
  type CarouselSlideItem 
} from "@/components/campaign-studio/DeliverableEditorModal";
import {
  CalendarDays,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  List,
  Grid,
  ChevronDown,
  ChevronUp,
  Volume2,
  Eye,
  Hash,
  Send,
  Kanban,
  FileText,
  Building2,
  RefreshCw,
  Trash2,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Video,
  Layers2,
  Check,
  Search,
  FileCheck,
  Cpu,
  ChevronRight,
  ArrowRight,
  Loader2,
  Copy,
} from "lucide-react";

interface Client {
  id: string;
  business_name: string;
  industry: string | null;
}

interface QualityFindingItem {
  category: string;
  severity: string;
  deliverable_title?: string;
  issue_description: string;
  remediation_instruction: string;
}

interface QualityEvaluationItem {
  is_approved_for_human_review: boolean;
  compliance_score: number;
  findings: QualityFindingItem[];
  revision_required: boolean;
}

interface BrandContextSummary {
  business_name?: string;
  industry?: string;
  confirmed_facts_count?: number;
  verified_offers?: string[];
  prohibited_terms?: string[];
  prohibited_claims?: string[];
  conflicts?: string[];
}

interface MarketResearchSummary {
  evidence_count?: number;
  top_topics?: string[];
  competitor_angles?: string[];
}

interface PerformanceSummary {
  deliverables_analyzed?: number;
  fatigue_signals?: Array<{
    platform: string;
    deliverable_type: string;
    dropoff_percentage: number;
    recommended_action: string;
  }>;
  recommended_formats?: string[];
}

interface AiPlanDraft {
  campaign_name: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  objective?: string;
  brand_voice?: string;
  content_pillars?: string[];
  total_deliverables_planned: number;
  generator?: string;
  deliverables: DeliverableItem[];
  strategy?: {
    campaign_theme?: string;
    primary_objective?: string;
    target_audience_definition?: string;
    pacing_and_cadence?: string;
  };
  quality_evaluation?: QualityEvaluationItem;
  brand_context_summary?: BrandContextSummary;
  market_research_summary?: MarketResearchSummary;
  performance_summary?: PerformanceSummary;
  pipeline_agents_executed?: string[];
  workflow_status?: string;
  revision_count?: number;
}

interface Campaign {
  id: string;
  client_id: string;
  name: string;
  period_month: number | null;
  period_year: number | null;
  objective: string | null;
  status: string;
  ai_plan_draft: AiPlanDraft | null;
  created_at: string;
}

function CampaignPlansContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialClientId = searchParams.get("clientId") || "";
  const initialCampaignId = searchParams.get("campaignId") || "";

  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedPillarFilter, setSelectedPillarFilter] = useState<string>("all");
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [expandedReelDay, setExpandedReelDay] = useState<number | null>(null);
  const [expandedCarouselDay, setExpandedCarouselDay] = useState<number | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<DeliverableItem | null>(null);

  const handleDeliverableUpdated = (updated: DeliverableItem) => {
    if (!selectedCampaign || !selectedCampaign.ai_plan_draft) return;
    const draft = { ...selectedCampaign.ai_plan_draft };
    const delivs = [...(draft.deliverables || [])];
    const idx = delivs.findIndex(
      (d: any) => (d.planned_day || d.day_number) === updated.day_number
    );
    if (idx !== -1) {
      delivs[idx] = { ...delivs[idx], ...updated };
    } else if (updated.day_number <= delivs.length) {
      delivs[updated.day_number - 1] = { ...delivs[updated.day_number - 1], ...updated };
    }
    draft.deliverables = delivs;
    const updatedCampaign = { ...selectedCampaign, ai_plan_draft: draft };
    setSelectedCampaign(updatedCampaign);
    setCampaigns((prev) =>
      prev.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c))
    );
    setNotification({
      type: "success",
      text: `Updated Day ${updated.day_number} in campaign plan!`,
    });
  };

  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedHookDay, setCopiedHookDay] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load clients
  useEffect(() => {
    if (!token || !effectiveAgencyId) return;
    clientApi
      .list(effectiveAgencyId, token)
      .then((data: any) => {
        const list = data as Client[];
        setClients(list);
        if (!selectedClientId && list.length > 0) {
          setSelectedClientId(list[0].id);
        }
      })
      .catch((err) => console.error("Failed to load clients", err));
  }, [token, effectiveAgencyId, selectedClientId]);

  // Load campaigns for selected client
  const loadCampaigns = useCallback(
    async (clientId: string) => {
      if (!token || !effectiveAgencyId || !clientId) return;
      try {
        const data = (await campaignApi.list(effectiveAgencyId, clientId, token)) as Campaign[];
        setCampaigns(data);

        if (initialCampaignId) {
          const match = data.find((c) => c.id === initialCampaignId);
          if (match) {
            setSelectedCampaign(match);
            return;
          }
        }
        if (data.length > 0) {
          setSelectedCampaign(data[0]);
        } else {
          setSelectedCampaign(null);
        }
      } catch (err) {
        console.error("Failed to load campaigns", err);
      }
    },
    [token, effectiveAgencyId, initialCampaignId]
  );

  useEffect(() => {
    if (selectedClientId) {
      loadCampaigns(selectedClientId);
    }
  }, [selectedClientId, loadCampaigns]);

  // Convert AI plan to concrete tasks & deliverables
  const handleConvertToTasks = async () => {
    if (!token || !effectiveAgencyId || !selectedCampaign) return;
    setConverting(true);
    setNotification(null);

    try {
      const res: any = await campaignApi.convertToTasks(
        effectiveAgencyId,
        selectedCampaign.id,
        token
      );
      setNotification({
        type: "success",
        text: `Approved! Created ${res.deliverables_created} deliverables and ${res.tasks_created} production tasks.`,
      });
      // Refresh campaign status
      await loadCampaigns(selectedClientId);
    } catch (err: any) {
      setNotification({
        type: "error",
        text: err.message || "Failed to convert plan to tasks.",
      });
    } finally {
      setConverting(false);
    }
  };

  // Delete campaign with working error handling (no "Failed to fetch")
  const handleDeleteCampaign = async () => {
    if (!token || !effectiveAgencyId || !selectedCampaign) return;
    setDeleting(true);
    setNotification(null);

    try {
      await campaignApi.delete(effectiveAgencyId, selectedCampaign.id, token);
      setShowDeleteConfirm(false);
      setNotification({
        type: "success",
        text: `Campaign "${selectedCampaign.name}" deleted successfully.`,
      });
      // Refresh list
      await loadCampaigns(selectedClientId);
    } catch (err: any) {
      setNotification({
        type: "error",
        text: err.message || "Failed to delete campaign.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, dayNum: number) => {
    navigator.clipboard.writeText(text);
    setCopiedHookDay(dayNum);
    setTimeout(() => setCopiedHookDay(null), 2000);
  };

  const draft = selectedCampaign?.ai_plan_draft;
  const deliverables = draft?.deliverables || [];
  const pillars = draft?.content_pillars || [];
  const quality = draft?.quality_evaluation;
  const strategy = draft?.strategy;

  const filteredDeliverables =
    selectedPillarFilter === "all"
      ? deliverables
      : deliverables.filter((d) => (d.pillar || "").toLowerCase() === selectedPillarFilter.toLowerCase());

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4 text-[#F2F0F7]">
      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all shadow-xs ${
            notification.type === "success"
              ? "bg-[#45B88A]/10 border-[#45B88A]/30 text-[#45B88A]"
              : "bg-[#E16F7B]/10 border-[#E16F7B]/30 text-[#E16F7B]"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium text-xs">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#20202A] text-[#A78BFA] border border-white/[0.08] flex items-center justify-center shadow-xs">
              <CalendarDays className="w-4 h-4 text-[#A78BFA]" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
                <span>Operations</span>
                <span className="text-white/[0.2]">/</span>
                <span className="text-[#A78BFA] font-medium">Campaign Plans</span>
              </div>
              <h1 className="text-xl font-heading font-bold tracking-tight text-[#F2F0F7]">Campaign Plans Archive</h1>
              <p className="text-xs text-[#A3A0B0]">
                Review, calibrate, and push AI campaign sprints into production tasks
              </p>
            </div>
          </div>
        </div>

        {/* Client & Campaign Selectors (Linear Toolstrip) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Client Select */}
          <div className="flex items-center gap-2 bg-[#101014] px-3 py-1.5 rounded-lg border border-white/[0.08] shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#F2F0F7] focus:outline-none cursor-pointer"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#17171E] text-[#F2F0F7]">
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Sprint Select */}
          {campaigns.length > 0 && (
            <div className="flex items-center gap-2 bg-[#101014] px-3 py-1.5 rounded-lg border border-white/[0.08] shadow-xs">
              <select
                value={selectedCampaign?.id || ""}
                onChange={(e) => {
                  const match = campaigns.find((c) => c.id === e.target.value);
                  if (match) setSelectedCampaign(match);
                }}
                className="bg-transparent text-xs font-medium text-[#F2F0F7] focus:outline-none cursor-pointer max-w-[200px] truncate font-mono"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#17171E] text-[#F2F0F7]">
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Studio Link Button */}
          <Link
            href={selectedClientId ? `/campaigns?clientId=${selectedClientId}` : "/campaigns"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] shadow-xs transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Sprint in Studio</span>
          </Link>
        </div>
      </header>

      {/* Main Campaign Plan View */}
      {!selectedCampaign ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-white/[0.08] rounded-2xl surface-card shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#20202A] text-[#A78BFA] border border-white/[0.08] flex items-center justify-center mb-4 shadow-xs">
            <Sparkles className="w-7 h-7 text-[#A78BFA]" />
          </div>
          <h2 className="text-base font-heading font-bold text-[#F2F0F7]">No Campaign Sprint Found</h2>
          <p className="text-xs text-[#A3A0B0] mt-1 max-w-md leading-relaxed">
            There are no campaigns generated for this client yet. Launch Campaign Studio to chat with the AI Co-Director and architect your first 30-day sprint.
          </p>
          <Link
            href={selectedClientId ? `/campaigns?clientId=${selectedClientId}` : "/campaigns"}
            className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A78BFA] text-[#101014] text-xs font-bold hover:bg-[#B69BFF] transition-all shadow-xs active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Go to Campaign Studio</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action & Strategy Header Banner */}
          <div className="p-6 rounded-2xl surface-card border border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-heading font-bold text-[#F2F0F7]">{selectedCampaign.name}</h2>
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md border ${
                      selectedCampaign.status === "in_production"
                        ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                        : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30"
                    }`}
                  >
                    {selectedCampaign.status === "in_production" ? "In Production" : "AI Draft • Pending Approval"}
                  </span>

                  {quality && (
                    <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30">
                      🛡️ {quality.compliance_score <= 1 ? Math.round(quality.compliance_score * 100) : Math.round(quality.compliance_score)}% Brand Compliant
                    </span>
                  )}
                </div>
                {strategy?.campaign_theme && (
                  <p className="text-xs text-[#A3A0B0] mt-1 leading-relaxed">
                    Theme: <span className="text-[#F2F0F7] font-semibold">&ldquo;{strategy.campaign_theme}&rdquo;</span>
                    {strategy.target_audience_definition && (
                      <span className="font-mono text-[11px]"> • Target: {strategy.target_audience_definition}</span>
                    )}
                  </p>
                )}
                {draft?.start_date && draft?.end_date && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#A78BFA] font-mono font-bold">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Sprint Timeline: {draft.start_date} to {draft.end_date} ({draft.duration_days || deliverables.length} Days)</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedCampaign.status !== "in_production" ? (
                  <button
                    onClick={handleConvertToTasks}
                    disabled={converting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#45B88A] hover:bg-[#52c998] text-[#101014] font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                  >
                    {converting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Convert to Tasks 🚀</span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href="/tasks"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 text-xs font-semibold hover:bg-[#45B88A]/20 transition-all shadow-xs"
                  >
                    <Kanban className="w-3.5 h-3.5" />
                    <span>View in Production Kanban →</span>
                  </Link>
                )}

                {/* Delete Campaign Button */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  title="Delete Campaign Sprint"
                  className="p-2 rounded-xl border border-white/[0.08] bg-[#101014] hover:bg-[#E16F7B]/10 hover:border-[#E16F7B]/30 text-[#A3A0B0] hover:text-[#E16F7B] transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Strategic Pillars Pills */}
            {pillars.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.08] text-xs">
                <span className="text-[#A3A0B0] font-medium">Core Content Pillars:</span>
                {pillars.map((pillar, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-lg bg-[#101014] border border-white/[0.08] font-mono text-[11px] font-medium text-[#F2F0F7]"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
              <div className="surface-card border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-[#E16F7B]">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="font-heading font-bold text-base text-[#F2F0F7]">Delete Campaign Sprint?</h3>
                </div>
                <p className="text-xs text-[#A3A0B0] leading-relaxed">
                  Are you sure you want to delete <strong>&ldquo;{selectedCampaign.name}&rdquo;</strong>?
                  This will permanently remove the AI draft, deliverables, and associated pipeline tasks.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3.5 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold hover:bg-[#20202A] text-[#F2F0F7] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E16F7B] hover:bg-[#e8818c] text-[#101014] text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Confirm Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Agent Research Insights Drawers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Brand Intelligence Drawer */}
            <div className="p-4 rounded-2xl surface-card border border-white/[0.08] text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-[#F2F0F7]">
                <ShieldCheck className="w-4 h-4 text-[#45B88A]" />
                <span className="font-heading">Agent 1: Brand Intelligence</span>
              </div>
              <p className="text-[#A3A0B0] text-[11px]">
                Brand Voice: <span className="text-[#F2F0F7] font-medium">{draft?.brand_voice || "Authentic & Professional"}</span>
              </p>
              {draft?.brand_context_summary?.verified_offers && (
                <div className="text-[11px] text-[#A3A0B0] font-mono">
                  <span className="font-medium text-[#F2F0F7]">Verified Offers:</span>{" "}
                  {draft.brand_context_summary.verified_offers.join(", ")}
                </div>
              )}
            </div>

            {/* Market & Trend Research Drawer */}
            <div className="p-4 rounded-2xl surface-card border border-white/[0.08] text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-[#F2F0F7]">
                <Search className="w-4 h-4 text-[#69A9D8]" />
                <span className="font-heading">Agent 2: Market Evidence</span>
              </div>
              <p className="text-[#A3A0B0] text-[11px]">
                Analyzed live web signals & competitor angles for {draft?.brand_context_summary?.industry || "industry"}.
              </p>
              {draft?.market_research_summary?.top_topics && (
                <div className="text-[11px] text-[#A3A0B0] truncate font-mono">
                  <span className="font-medium text-[#F2F0F7]">Trending Topics:</span>{" "}
                  {draft.market_research_summary.top_topics.slice(0, 2).join(", ")}
                </div>
              )}
            </div>

            {/* Historical Performance Drawer */}
            <div className="p-4 rounded-2xl surface-card border border-white/[0.08] text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-[#F2F0F7]">
                <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
                <span className="font-heading">Agent 3: Retention Calibrator</span>
              </div>
              <p className="text-[#A3A0B0] text-[11px]">
                Applied short-form video retention weights and carousel pacing to avoid content fatigue.
              </p>
              {draft?.performance_summary?.recommended_formats && (
                <div className="text-[11px] text-[#A3A0B0] font-mono">
                  <span className="font-medium text-[#F2F0F7]">Preferred Formats:</span>{" "}
                  {draft.performance_summary.recommended_formats.join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Deliverables Section Controls (Linear Toolstrip) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-heading font-bold text-[#F2F0F7] flex items-center gap-2">
                <span>Planned Deliverables</span>
                <span className="px-2 py-0.2 rounded-full bg-white/[0.06] text-[10px] font-mono font-bold text-[#A78BFA]">
                  {filteredDeliverables.length}
                </span>
              </h3>

              {/* Pillar Filter */}
              <select
                value={selectedPillarFilter}
                onChange={(e) => setSelectedPillarFilter(e.target.value)}
                className="text-xs font-mono font-medium bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[#F2F0F7] cursor-pointer shadow-xs focus:outline-none focus:border-[#A78BFA]/50"
              >
                <option value="all">All Content Pillars</option>
                {pillars.map((p, i) => (
                  <option key={i} value={p}>
                    Pillar: {p}
                  </option>
                ))}
              </select>
            </div>

            {/* View Switcher (Calendar vs List) */}
            <div className="flex items-center bg-[#101014] rounded-lg p-0.5 border border-white/[0.08]">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-white/[0.08] text-[#A78BFA] shadow-xs border border-white/[0.08]"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>30-Day Calendar</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white/[0.08] text-[#A78BFA] shadow-xs border border-white/[0.08]"
                    : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Detailed List</span>
              </button>
            </div>
          </div>

          {/* 30-Day Calendar Grid View */}
          {viewMode === "calendar" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {filteredDeliverables.map((item) => {
                const isReel = item.deliverable_type.toLowerCase().includes("reel") || item.deliverable_type.toLowerCase().includes("video");
                const isCarousel = item.deliverable_type.toLowerCase().includes("carousel");
                const isExpanded = expandedDay === item.day_number;

                return (
                  <div
                    key={item.day_number}
                    className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all text-xs surface-card shadow-xs ${
                      isExpanded
                        ? "border-[#A78BFA] ring-1 ring-[#A78BFA]/30"
                        : "border-white/[0.08] hover:border-white/[0.18]"
                    }`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between gap-1 pb-2 border-b border-white/[0.06]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-heading font-bold text-[#F2F0F7] text-xs">Day {item.day_number}</span>
                          {item.date_label && (
                            <span className="text-[10px] text-[#A78BFA] font-mono font-semibold truncate">
                              {item.date_label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeliverable(item);
                            }}
                            className="p-1 rounded-md text-[#A3A0B0] hover:text-[#A78BFA] hover:bg-[#A78BFA]/10 cursor-pointer transition-all"
                            title={`Deep Dive & Edit Day ${item.day_number} with Scriptwriter AI`}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                          </button>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                              isReel
                                ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30"
                                : isCarousel
                                ? "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30"
                                : "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                            }`}
                          >
                            {item.deliverable_type}
                          </span>
                        </div>
                      </div>

                      {/* Hook & Pillar */}
                      <div className="mt-2.5 space-y-1.5">
                        <span className="text-[10px] font-mono font-medium text-[#A3A0B0] block truncate">
                          🎯 {item.pillar}
                        </span>
                        <p className="font-semibold text-[#F2F0F7] text-xs leading-snug line-clamp-2">
                          &ldquo;{item.hook}&rdquo;
                        </p>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 text-[11px]">
                          <div>
                            <span className="font-medium text-[#A3A0B0]">Visual Concept:</span>
                            <p className="text-[#F2F0F7] mt-0.5 leading-normal">{item.visual_concept}</p>
                          </div>
                          <div>
                            <span className="font-medium text-[#A3A0B0]">Caption:</span>
                            <p className="text-[#F2F0F7] mt-0.5 leading-normal italic line-clamp-3 bg-[#101014] p-2 rounded-lg border border-white/[0.04]">
                              {item.caption}
                            </p>
                          </div>
                          {item.cta && (
                            <div>
                              <span className="font-medium text-[#A3A0B0]">Call to Action:</span>
                              <p className="text-[#45B88A] font-medium mt-0.5">{item.cta}</p>
                            </div>
                          )}

                          {/* Deep Dive & Edit with Scriptwriter AI Button */}
                          <button
                            onClick={() => setEditingDeliverable(item)}
                            className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 text-[#A78BFA] border border-[#A78BFA]/30 text-[10px] font-bold cursor-pointer transition-all shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                            <span>Deep Dive & Edit with Scriptwriter AI</span>
                          </button>

                          {/* Reel Beats Director Button */}
                          {isReel && item.reel_scenes && item.reel_scenes.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedReelDay(
                                  expandedReelDay === item.day_number ? null : item.day_number
                                )
                              }
                              className="w-full mt-2 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] text-[10px] font-semibold cursor-pointer border border-[#A78BFA]/20"
                            >
                              <Video className="w-3 h-3" />
                              <span>{expandedReelDay === item.day_number ? "Hide Scene Script" : `View ${item.reel_scenes.length} Scene Beats`}</span>
                            </button>
                          )}

                          {/* Carousel Slides Button */}
                          {isCarousel && item.carousel_slides && item.carousel_slides.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedCarouselDay(
                                  expandedCarouselDay === item.day_number ? null : item.day_number
                                )
                              }
                              className="w-full mt-2 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#69A9D8]/10 hover:bg-[#69A9D8]/20 text-[#69A9D8] text-[10px] font-semibold cursor-pointer border border-[#69A9D8]/20"
                            >
                              <Layers2 className="w-3 h-3" />
                              <span>{expandedCarouselDay === item.day_number ? "Hide Slides" : `View ${item.carousel_slides.length} Slide Deck`}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Toggle */}
                    <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <button
                        onClick={() => copyToClipboard(item.hook || "", item.day_number)}
                        className="text-[10px] text-[#A3A0B0] hover:text-[#F2F0F7] flex items-center gap-1 cursor-pointer font-mono"
                      >
                        {copiedHookDay === item.day_number ? (
                          <Check className="w-3 h-3 text-[#45B88A]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedHookDay === item.day_number ? "Copied" : "Copy Hook"}</span>
                      </button>

                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : item.day_number)}
                        className="text-[10px] font-medium text-[#A78BFA] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? "Collapse" : "Expand"}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Detailed List View */
            <div className="space-y-4">
              {filteredDeliverables.map((item) => {
                const isReel = item.deliverable_type.toLowerCase().includes("reel") || item.deliverable_type.toLowerCase().includes("video");
                const isCarousel = item.deliverable_type.toLowerCase().includes("carousel");

                return (
                  <div
                    key={item.day_number}
                    className="p-5 rounded-2xl border border-white/[0.08] surface-card shadow-xs space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                          D{item.day_number}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-sm text-[#F2F0F7]">
                              {item.title || (item.hook ? `Day ${item.day_number}: ${item.hook.slice(0, 45)}...` : `Day ${item.day_number}`)}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#101014] text-[#A3A0B0] border border-white/[0.08]">
                              {item.platform} • {item.deliverable_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#A3A0B0] mt-0.5 font-mono">
                            {item.date_label && (
                              <span className="font-semibold text-[#A78BFA] flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {item.date_label}
                              </span>
                            )}
                            {item.date_label && <span>•</span>}
                            <span>Pillar: {item.pillar}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingDeliverable(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span>Deep Dive & Edit with AI</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(item.hook || "", item.day_number)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#101014] hover:bg-[#20202A] text-[#F2F0F7] transition-colors cursor-pointer text-xs font-mono shadow-xs"
                        >
                          {copiedHookDay === item.day_number ? (
                            <Check className="w-3.5 h-3.5 text-[#45B88A]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedHookDay === item.day_number ? "Copied" : "Copy Hook"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-mono uppercase text-[10px] tracking-wider text-[#A3A0B0] block mb-1">
                          Hook & Opening Angle
                        </span>
                        <p className="font-semibold text-[#F2F0F7] text-sm">&ldquo;{item.hook}&rdquo;</p>
                        <p className="text-[#A3A0B0] mt-2 leading-relaxed">
                          <strong className="text-[#F2F0F7]">Visual Concept:</strong> {item.visual_concept}
                        </p>
                      </div>

                      <div>
                        <span className="font-mono uppercase text-[10px] tracking-wider text-[#A3A0B0] block mb-1">
                          Caption & CTA
                        </span>
                        <p className="text-[#F2F0F7] leading-relaxed italic whitespace-pre-line bg-[#101014] p-3 rounded-xl border border-white/[0.06]">
                          {item.caption}
                        </p>
                        {item.cta && (
                          <p className="mt-2 text-[#45B88A] font-semibold text-xs">
                            Call to Action: {item.cta}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reel Scene Director Breakdown */}
                    {isReel && item.reel_scenes && item.reel_scenes.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-mono font-bold text-[#A78BFA] text-xs flex items-center gap-1.5">
                            <Video className="w-4 h-4" />
                            <span>Scene-by-Scene Reel Director Script ({item.reel_scenes.length} Beats)</span>
                          </span>
                          <button
                            onClick={() => setEditingDeliverable(item)}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] font-semibold text-[11px] cursor-pointer transition-all border border-[#A78BFA]/20"
                          >
                            <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                            <span>Edit Scenes with AI</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {item.reel_scenes.map((scene) => (
                            <div
                              key={scene.scene_number}
                              className="p-3 rounded-xl bg-[#101014] border border-white/[0.08] text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-[#F2F0F7]">
                                <span className="font-mono text-xs">Scene {scene.scene_number}</span>
                                <span className="font-mono text-[#A3A0B0] text-[10px]">{scene.timestamp_range}</span>
                              </div>
                              <p className="text-[#F2F0F7]">
                                <strong className="text-[#A3A0B0]">Visual:</strong> {scene.visual_action}
                              </p>
                              {scene.on_screen_text && (
                                <p className="text-[#69A9D8] font-medium">
                                  <strong>Text Overlay:</strong> &ldquo;{scene.on_screen_text}&rdquo;
                                </p>
                              )}
                              <p className="text-[#A3A0B0] italic">
                                <strong>Voiceover:</strong> &ldquo;{scene.spoken_audio_or_voiceover}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Carousel Slides Breakdown */}
                    {isCarousel && item.carousel_slides && item.carousel_slides.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/[0.06]">
                        <span className="font-mono font-bold text-[#69A9D8] text-xs flex items-center gap-1.5 mb-2.5">
                          <Layers2 className="w-4 h-4" />
                          <span>Carousel Slide Deck ({item.carousel_slides.length} Slides)</span>
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {item.carousel_slides.map((slide) => (
                            <div
                              key={slide.slide_number}
                              className="p-3 rounded-xl bg-[#101014] border border-white/[0.08] text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-[#F2F0F7]">
                                <span className="font-mono text-xs">Slide {slide.slide_number}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#20202A] text-[#A3A0B0] border border-white/[0.08] font-mono font-semibold">
                                  {slide.slide_type}
                                </span>
                              </div>
                              <p className="font-bold text-[#F2F0F7]">&ldquo;{slide.headline}&rdquo;</p>
                              <p className="text-[#A3A0B0] leading-normal">{slide.body_copy}</p>
                              <p className="text-[#69A9D8] text-[10px] font-mono">
                                <strong>Layout:</strong> {slide.visual_layout}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Deep-Dive Deliverable & Scene Editor Modal with Scriptwriter AI */}
      <DeliverableEditorModal
        isOpen={Boolean(editingDeliverable)}
        onClose={() => setEditingDeliverable(null)}
        deliverable={editingDeliverable}
        campaignId={selectedCampaign?.id || ""}
        clientId={selectedClientId || selectedCampaign?.client_id || ""}
        agencyId={effectiveAgencyId || ""}
        token={token || ""}
        onDeliverableUpdated={handleDeliverableUpdated}
      />
    </div>
  );
}

export default function CampaignPlansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <CampaignPlansContent />
    </Suspense>
  );
}

