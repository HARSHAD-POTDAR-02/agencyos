"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi } from "@/lib/api";
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

interface ReelSceneItem {
  scene_number: number;
  timestamp_range: string;
  visual_action: string;
  on_screen_text: string;
  spoken_audio_or_voiceover: string;
  b_roll_notes?: string;
}

interface CarouselSlideItem {
  slide_number: number;
  headline: string;
  body_copy: string;
  visual_layout: string;
  slide_type: "cover" | "content" | "takeaway" | "cta";
}

interface DeliverableItem {
  day_number: number;
  title?: string;
  deliverable_type: string;
  platform: string;
  pillar: string;
  hook: string;
  visual_concept: string;
  caption: string;
  cta: string;
  audio_vibe: string;
  hashtags: string[];
  hook_options?: string[];
  production_notes?: string;
  reel_scenes?: ReelSceneItem[];
  carousel_slides?: CarouselSlideItem[];
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
      : deliverables.filter((d) => d.pillar.toLowerCase() === selectedPillarFilter.toLowerCase());

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4">
      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{notification.text}</span>
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
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Campaign Plans</h1>
              <p className="text-xs text-muted-foreground">
                Review, calibrate, and push AI campaign sprints into production tasks
              </p>
            </div>
          </div>
        </div>

        {/* Client & Campaign Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Select */}
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-background text-foreground">
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Sprint Select */}
          {campaigns.length > 0 && (
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
              <select
                value={selectedCampaign?.id || ""}
                onChange={(e) => {
                  const match = campaigns.find((c) => c.id === e.target.value);
                  if (match) setSelectedCampaign(match);
                }}
                className="bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background text-foreground">
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Studio Link Button */}
          <Link
            href={selectedClientId ? `/campaigns?clientId=${selectedClientId}` : "/campaigns"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Sprint in Studio</span>
          </Link>
        </div>
      </header>

      {/* Main Campaign Plan View */}
      {!selectedCampaign ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border/60 rounded-2xl bg-card">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-foreground">No Campaign Sprint Found</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            There are no campaigns generated for this client yet. Launch Campaign Studio to chat with the AI Co-Director and architect your first 30-day sprint.
          </p>
          <Link
            href={selectedClientId ? `/campaigns?clientId=${selectedClientId}` : "/campaigns"}
            className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            <span>Go to Campaign Studio</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action & Strategy Header Banner */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{selectedCampaign.name}</h2>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      selectedCampaign.status === "in_production"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {selectedCampaign.status === "in_production" ? "In Production" : "AI Draft • Pending Approval"}
                  </span>

                  {quality && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                      🛡️ {quality.compliance_score}% Brand Compliant
                    </span>
                  )}
                </div>
                {strategy?.campaign_theme && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Theme: <span className="text-foreground font-medium">&ldquo;{strategy.campaign_theme}&rdquo;</span>
                    {strategy.target_audience_definition && (
                      <span> • Target: {strategy.target_audience_definition}</span>
                    )}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedCampaign.status !== "in_production" ? (
                  <button
                    onClick={handleConvertToTasks}
                    disabled={converting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
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
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
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
                  className="p-2 rounded-lg border border-border/80 hover:bg-rose-500/10 hover:border-rose-500/30 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Strategic Pillars Pills */}
            {pillars.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
                <span className="text-muted-foreground font-medium">Core Content Pillars:</span>
                {pillars.map((pillar, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-full bg-secondary font-medium text-secondary-foreground"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-rose-500">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="font-bold text-base text-foreground">Delete Campaign Sprint?</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <strong>&ldquo;{selectedCampaign.name}&rdquo;</strong>?
                  This will permanently remove the AI draft, deliverables, and associated pipeline tasks.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
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
            <div className="p-4 rounded-xl bg-card border border-border/60 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Agent 1: Brand Intelligence</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Brand Voice: <span className="text-foreground">{draft?.brand_voice || "Authentic & Professional"}</span>
              </p>
              {draft?.brand_context_summary?.verified_offers && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Verified Offers:</span>{" "}
                  {draft.brand_context_summary.verified_offers.join(", ")}
                </div>
              )}
            </div>

            {/* Market & Trend Research Drawer */}
            <div className="p-4 rounded-xl bg-card border border-border/60 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Search className="w-4 h-4 text-indigo-500" />
                <span>Agent 2: Market Evidence</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Analyzed live web signals & competitor angles for {draft?.brand_context_summary?.industry || "industry"}.
              </p>
              {draft?.market_research_summary?.top_topics && (
                <div className="text-[11px] text-muted-foreground truncate">
                  <span className="font-medium text-foreground">Trending Topics:</span>{" "}
                  {draft.market_research_summary.top_topics.slice(0, 2).join(", ")}
                </div>
              )}
            </div>

            {/* Historical Performance Drawer */}
            <div className="p-4 rounded-xl bg-card border border-border/60 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <BarChart3 className="w-4 h-4 text-violet-500" />
                <span>Agent 3: Retention Calibrator</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Applied short-form video retention weights and carousel pacing to avoid content fatigue.
              </p>
              {draft?.performance_summary?.recommended_formats && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Preferred Formats:</span>{" "}
                  {draft.performance_summary.recommended_formats.join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Deliverables Section Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Planned Deliverables ({filteredDeliverables.length})
              </h3>

              {/* Pillar Filter */}
              <select
                value={selectedPillarFilter}
                onChange={(e) => setSelectedPillarFilter(e.target.value)}
                className="text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1 text-foreground cursor-pointer"
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
            <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>30-Day Calendar</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
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
                    className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all text-xs ${
                      isExpanded
                        ? "bg-card border-primary/50 shadow-md ring-1 ring-primary/30"
                        : "bg-card/70 border-border/70 hover:border-border hover:shadow-xs"
                    }`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between gap-1 pb-2 border-b border-border/40">
                        <span className="font-bold text-foreground text-xs">Day {item.day_number}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              isReel
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : isCarousel
                                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {item.deliverable_type}
                          </span>
                        </div>
                      </div>

                      {/* Hook & Pillar */}
                      <div className="mt-2.5 space-y-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground block truncate">
                          🎯 {item.pillar}
                        </span>
                        <p className="font-semibold text-foreground text-xs leading-snug line-clamp-2">
                          &ldquo;{item.hook}&rdquo;
                        </p>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-[11px]">
                          <div>
                            <span className="font-medium text-muted-foreground">Visual Concept:</span>
                            <p className="text-foreground mt-0.5 leading-normal">{item.visual_concept}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Caption:</span>
                            <p className="text-foreground mt-0.5 leading-normal italic line-clamp-3">
                              {item.caption}
                            </p>
                          </div>
                          {item.cta && (
                            <div>
                              <span className="font-medium text-muted-foreground">Call to Action:</span>
                              <p className="text-primary font-medium mt-0.5">{item.cta}</p>
                            </div>
                          )}

                          {/* Reel Beats Director Button */}
                          {isReel && item.reel_scenes && item.reel_scenes.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedReelDay(
                                  expandedReelDay === item.day_number ? null : item.day_number
                                )
                              }
                              className="w-full mt-2 flex items-center justify-center gap-1 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-semibold cursor-pointer"
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
                              className="w-full mt-2 flex items-center justify-center gap-1 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold cursor-pointer"
                            >
                              <Layers2 className="w-3 h-3" />
                              <span>{expandedCarouselDay === item.day_number ? "Hide Slides" : `View ${item.carousel_slides.length} Slide Deck`}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Toggle */}
                    <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
                      <button
                        onClick={() => copyToClipboard(item.hook, item.day_number)}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        {copiedHookDay === item.day_number ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedHookDay === item.day_number ? "Copied" : "Copy Hook"}</span>
                      </button>

                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : item.day_number)}
                        className="text-[10px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-0.5"
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
                    className="p-5 rounded-xl border border-border/80 bg-card shadow-sm space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                          D{item.day_number}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {item.title || `Day ${item.day_number}: ${item.hook.slice(0, 45)}...`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-secondary text-secondary-foreground">
                              {item.platform} • {item.deliverable_type}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">Pillar: {item.pillar}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => copyToClipboard(item.hook, item.day_number)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border hover:bg-muted text-foreground transition-colors cursor-pointer"
                      >
                        {copiedHookDay === item.day_number ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedHookDay === item.day_number ? "Copied" : "Copy Hook"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide block mb-1">
                          Hook & Opening Angle
                        </span>
                        <p className="font-semibold text-foreground text-sm">&ldquo;{item.hook}&rdquo;</p>
                        <p className="text-muted-foreground mt-2 leading-relaxed">
                          <strong className="text-foreground">Visual Concept:</strong> {item.visual_concept}
                        </p>
                      </div>

                      <div>
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide block mb-1">
                          Caption & CTA
                        </span>
                        <p className="text-foreground leading-relaxed italic whitespace-pre-line">
                          {item.caption}
                        </p>
                        {item.cta && (
                          <p className="mt-2 text-primary font-medium">
                            Call to Action: {item.cta}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reel Scene Director Breakdown */}
                    {isReel && item.reel_scenes && item.reel_scenes.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40">
                        <span className="font-bold text-rose-500 text-xs flex items-center gap-1.5 mb-2.5">
                          <Video className="w-4 h-4" />
                          <span>Scene-by-Scene Reel Director Script ({item.reel_scenes.length} Beats)</span>
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {item.reel_scenes.map((scene) => (
                            <div
                              key={scene.scene_number}
                              className="p-3 rounded-lg bg-muted/40 border border-border/60 text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-foreground">
                                <span>Scene {scene.scene_number}</span>
                                <span className="font-mono text-muted-foreground">{scene.timestamp_range}</span>
                              </div>
                              <p className="text-foreground">
                                <strong>Visual:</strong> {scene.visual_action}
                              </p>
                              {scene.on_screen_text && (
                                <p className="text-primary font-medium">
                                  <strong>Text Overlay:</strong> &ldquo;{scene.on_screen_text}&rdquo;
                                </p>
                              )}
                              <p className="text-muted-foreground italic">
                                <strong>Voiceover:</strong> &ldquo;{scene.spoken_audio_or_voiceover}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Carousel Slides Breakdown */}
                    {isCarousel && item.carousel_slides && item.carousel_slides.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40">
                        <span className="font-bold text-indigo-500 text-xs flex items-center gap-1.5 mb-2.5">
                          <Layers2 className="w-4 h-4" />
                          <span>Carousel Slide Deck ({item.carousel_slides.length} Slides)</span>
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                          {item.carousel_slides.map((slide) => (
                            <div
                              key={slide.slide_number}
                              className="p-3 rounded-lg bg-muted/40 border border-border/60 text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-foreground">
                                <span>Slide {slide.slide_number}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-semibold">
                                  {slide.slide_type}
                                </span>
                              </div>
                              <p className="font-bold text-foreground">&ldquo;{slide.headline}&rdquo;</p>
                              <p className="text-muted-foreground leading-normal">{slide.body_copy}</p>
                              <p className="text-primary text-[10px]">
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

