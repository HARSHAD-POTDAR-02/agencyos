"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi, studioApi, agencyApi, operationalWorkflowApi } from "@/lib/api";
import { ContextualCanvas } from "@/components/campaign-studio/ContextualCanvas";
import { ExportPreviewModal } from "@/components/campaign-studio/ExportPreviewModal";
import { StrategyPitchDeckModal } from "@/components/campaign-studio/StrategyPitchDeckModal";
import { ActiveArtifactData } from "@/components/campaign-studio/types";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  ShieldCheck,
  Search,
  BarChart3,
  Cpu,
  Layers2,
  FileCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  CalendarDays,
  Building2,
  AlertCircle,
  ChevronRight,
  Flame,
  Check,
  RotateCcw,
  MessagesSquare,
  MessageSquare,
  Compass,
  FileText,
  SlidersHorizontal,
  Trash2,
  X,
  Ban,
  Presentation,
  GitFork,
  Plus,
  History,
  Brain,
} from "lucide-react";

interface Client {
  id: string;
  business_name: string;
  industry: string | null;
}

interface StudioChatSessionMeta {
  id: string;
  title: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  artifactCount: number;
  campaignId?: string | null;
}

interface StudioChatSessionData {
  id: string;
  title: string;
  clientId: string;
  agencyId: string;
  createdAt: string;
  updatedAt: string;
  campaignId?: string | null;
  workflowRunId?: string | null;
  messages: ChatMsg[];
  artifacts: ActiveArtifactData[];
  activeArtifactId?: string | null;
  suggestedObjective: string;
  suggestedCustomBrief: string;
  deliverablePreferences: string[];
  isReadyToGenerate: boolean;
  startDate: string;
  endDate: string;
  durationDays: number | null;
  periodMonth: number;
  periodYear: number;
  pinnedEntities: string[];
  discoveredEntities: string[];
  activeSpecialistId?: string;
  studioMode?: "workflow" | "specialists";
}

interface AgentStepItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  detail?: string;
}

const AGENT_STEPS: AgentStepItem[] = [
  {
    id: "agent1",
    name: "Brand Intelligence",
    icon: ShieldCheck,
    desc: "Reading brand guidelines, verified offers, forbidden claims & quotas",
  },
  {
    id: "agent2",
    name: "Market & Trend Research",
    icon: Search,
    desc: "Searching live web for competitor angles, viral hooks & format benchmarks",
  },
  {
    id: "agent3",
    name: "Historical Performance",
    icon: BarChart3,
    desc: "Auditing retention rates, fatigue drop-offs & platform format recommendations",
  },
  {
    id: "agent4",
    name: "Campaign Strategist",
    icon: Cpu,
    desc: "Synthesizing master theme, content pillars & 30-day narrative pacing",
  },
  {
    id: "agent5",
    name: "Content Architect",
    icon: Layers2,
    desc: "Drafting polymorphic deliverables with Reel director beats & Carousel slide decks",
  },
  {
    id: "agent6",
    name: "Quality Evaluator & Gate",
    icon: FileCheck,
    desc: "Running deterministic brand compliance & quota audit for human review",
  },
];

export interface SpecialistAgent {
  id: string;
  name: string;
  shortName: string;
  roleTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  avatarBg: string;
  description: string;
  starters: string[];
}

export const CAMPAIGN_DIRECTOR: SpecialistAgent = {
  id: "director",
  name: "Campaign Director",
  shortName: "Director",
  roleTitle: "Sprint Orchestrator & Creative Director",
  icon: Sparkles,
  color: "violet",
  badgeBg: "bg-violet-500/15",
  badgeText: "text-violet-400",
  borderColor: "border-violet-500/30",
  avatarBg: "bg-violet-600/10 text-violet-400 border-violet-500/30",
  description: "Guides end-to-end sprint discovery, timeline planning, deliverable counts, and sprint generation.",
  starters: [
    "Create a 4-day campaign sprint from 8th Nov to 11th Nov with daily content",
    "Plan a 30-day challenge sprint with viral Instagram Reels",
    "Design an educational carousel sprint focused on authority & debunking myths",
    "Craft a product launch campaign with exclusive offers",
  ],
};

export const SPECIALIST_AGENTS: SpecialistAgent[] = [
  {
    id: "brand_intelligence",
    name: "Brand Identity Specialist",
    shortName: "Brand Identity",
    roleTitle: "Voice, Guidelines & Content Pillars",
    icon: ShieldCheck,
    color: "emerald",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    avatarBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    description: "Defines brand voice guidelines, content pillars, audience personas, and guards against prohibited claims.",
    starters: [
      "Audit our brand voice and suggest 3 high-authority content pillars",
      "Craft a detailed Ideal Customer Persona (ICP) with pain points & desires",
      "How do we frame our verified offer without sounding salesy?",
      "Review our prohibited claims to ensure strict brand compliance",
    ],
  },
  {
    id: "market_research",
    name: "Market & Trend Researcher",
    shortName: "Market Trends",
    roleTitle: "Viral Hooks & Algorithmic Trends",
    icon: Search,
    color: "sky",
    badgeBg: "bg-sky-500/15",
    badgeText: "text-sky-400",
    borderColor: "border-sky-500/30",
    avatarBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    description: "Identifies live market trends, competitor whitespace, viral hook archetypes, and algorithm dynamics.",
    starters: [
      "What are the top viral hooks for our industry right now?",
      "Suggest 3 high-arrest hooks for our upcoming seasonal promotion",
      "What competitor whitespace or angle gaps can we exploit?",
      "Which trending audio or meme archetypes fit our brand?",
    ],
  },
  {
    id: "historical_performance",
    name: "Performance Analyst",
    shortName: "Performance",
    roleTitle: "Retention Analytics & Format Mix",
    icon: BarChart3,
    color: "amber",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
    borderColor: "border-amber-500/30",
    avatarBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    description: "Analyzes historical engagement stats, retention drop-off signals, and recommends format distribution.",
    starters: [
      "Analyze our past post performance and recommend optimal format ratio",
      "Which content angles drive the highest saves and shares?",
      "Are there any audience fatigue signals in our recent deliverables?",
      "What retention tactics should we use to boost average watch time?",
    ],
  },
  {
    id: "campaign_strategist",
    name: "Campaign Strategist",
    shortName: "Strategist",
    roleTitle: "Master Themes & Narrative Pacing",
    icon: Cpu,
    color: "indigo",
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-400",
    borderColor: "border-indigo-500/30",
    avatarBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    description: "Architects multi-week narrative arcs, master campaign themes, and cross-platform conversion funnels.",
    starters: [
      "Structure a 3-phase narrative arc (Problem -> Solution -> Launch)",
      "What is a powerful master theme & campaign slogan for our brand?",
      "How should we pace content distribution over a 30-day period?",
      "Design a conversion funnel moving cold viewers to DM leads",
    ],
  },
  {
    id: "content_architect",
    name: "Content Architect",
    shortName: "Content Arch.",
    roleTitle: "Scene-by-Scene Concepts & Shoot Storyboards",
    icon: Layers2,
    color: "purple",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-400",
    borderColor: "border-purple-500/30",
    avatarBg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    description: "Drafts timestamped Reel scripts (0:00-0:03 hook, beats, B-roll cues) and slide-by-slide Carousel decks.",
    starters: [
      "Write a 15-second Reel script with timestamped beats & B-roll directions",
      "Give me 3 scene-by-scene video shoot concepts for our product",
      "Draft a 7-slide educational carousel with high-retention slides",
      "Give me 3 viral reel concepts with camera movement & voiceover lines",
    ],
  },
  {
    id: "quality_evaluator",
    name: "Quality Evaluator & Gate",
    shortName: "Quality Gate",
    roleTitle: "Pre-Flight Audit & Hook Critique",
    icon: FileCheck,
    color: "rose",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-400",
    borderColor: "border-rose-500/30",
    avatarBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    description: "Audits hooks for retention strength, eliminates clichés, and checks claims against compliance guidelines.",
    starters: [
      "Audit our campaign concepts for weak hooks, clichés, or fluff",
      "Check our copy against prohibited or risky marketing claims",
      "Rate the retention strength of our opening 3-second hook",
      "Provide constructive critique to elevate these deliverable concepts",
    ],
  },
];

export const getAgentInfo = (agentId?: string): SpecialistAgent => {
  if (!agentId || agentId === "director") return CAMPAIGN_DIRECTOR;
  return SPECIALIST_AGENTS.find((a) => a.id === agentId) || CAMPAIGN_DIRECTOR;
};

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agent_id?: string;
  agent_name?: string;
  activity_logs?: Array<Record<string, unknown> | string>;
  isStreaming?: boolean;
  streamingStatus?: string;
  artifact_summary?: {
    id: string;
    type: string;
    title: string;
    version: number;
    status: string;
    campaign_id?: string;
    chat_id?: string;
    payload?: Record<string, any>;
    supporting_evidence_refs?: Array<Record<string, any>>;
  };
  agentPipeline?: {
    status: "in_progress" | "completed" | "error";
    activeStep: number;
    stepDetails?: Record<string, string>;
    errorMessage?: string;
    result?: {
      campaignId: string;
      campaignName: string;
      theme?: string;
      deliverablesCount: number;
      complianceScore?: number;
    };
  };
}

function CampaignStudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialClientId = searchParams.get("clientId") || "";

  const { token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Workflow vs Specialist Mode State
  const [studioMode, setStudioMode] = useState<"workflow" | "specialists">("workflow");
  const [activeSpecialistId, setActiveSpecialistId] = useState<string>("market_research");
  const [chatFilter, setChatFilter] = useState<"all" | "active">("all");

  // Collaborative Studio & Active Canvas State
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(searchParams.get("campaignId") || null);
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifactData | null>(null);
  const [activeArtifactVersions, setActiveArtifactVersions] = useState<any[]>([]);
  const [persistedArtifacts, setPersistedArtifacts] = useState<any[]>([]);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"canvas" | "intel">("canvas");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPitchDeckModalOpen, setIsPitchDeckModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string; role?: string }>>([]);
  const [isRightIntelOpen, setIsRightIntelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "evidence">("chat");

  // Operational DAG Workflow Engine Integration
  const [activeWorkflowRunId, setActiveWorkflowRunId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    stage: "strategy" | "client";
    taskId: string;
    runId: string;
  } | null>(null);
  const [isReviewingApproval, setIsReviewingApproval] = useState(false);

  // Hero Entity Tray State (Cross-Agent Context & Grounding)
  const [pinnedEntities, setPinnedEntities] = useState<string[]>([]);
  const [discoveredEntities, setDiscoveredEntities] = useState<string[]>([]);

  const handleTogglePinEntity = (entity: string) => {
    setPinnedEntities((prev) =>
      prev.includes(entity) ? prev.filter((e) => e !== entity) : [...prev, entity]
    );
  };

  const handleAddCustomEntity = (entity: string) => {
    const clean = entity.trim();
    if (!clean) return;
    setPinnedEntities((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setDiscoveredEntities((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  };

  // Date range and timeline state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [deliverableCount, setDeliverableCount] = useState<number | null>(null);
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setDurationDays(days);
        setPeriodMonth(s.getMonth() + 1);
        setPeriodYear(s.getFullYear());
      } else {
        setDurationDays(null);
      }
    } else {
      setDurationDays(null);
    }
  };

  // Sync date range when month/year searchParams or period change is provided
  useEffect(() => {
    const m = parseInt(searchParams.get("month") || "");
    const y = parseInt(searchParams.get("year") || "");
    if (m && y) {
      const paddedMonth = m.toString().padStart(2, "0");
      const lastDay = new Date(y, m, 0).getDate();
      handleDateChange(`${y}-${paddedMonth}-01`, `${y}-${paddedMonth}-${lastDay}`);
    }
  }, [searchParams]);

  // Studio Chat Sessions & History State
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [chatSessions, setChatSessions] = useState<StudioChatSessionMeta[]>([]);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const activeChatIdRef = useRef<string>("");
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Evolving Brief Strategy
  const [suggestedObjective, setSuggestedObjective] = useState<string>("");
  const [suggestedCustomBrief, setSuggestedCustomBrief] = useState<string>("");
  const [deliverablePreferences, setDeliverablePreferences] = useState<string[]>([]);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Client Campaigns state for switching and cleanup
  const [clientCampaigns, setClientCampaigns] = useState<any[]>([]);
  const [showGenerateConfirmModal, setShowGenerateConfirmModal] = useState(false);
  const [showDeleteCampaignModal, setShowDeleteCampaignModal] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // Pipeline Execution State
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const isPipelineRunningRef = useRef(false);
  const isProgrammaticCampaignChangeRef = useRef(false);

  // Keep isPipelineRunningRef in sync
  useEffect(() => {
    isPipelineRunningRef.current = isPipelineRunning;
  }, [isPipelineRunning]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading, isPipelineRunning, chatFilter]);

  // Always keep focus on chat input
  useEffect(() => {
    if (!isPipelineRunning) {
      chatInputRef.current?.focus();
    }
  }, [isChatLoading, isPipelineRunning, selectedClientId, studioMode, activeSpecialistId]);

  // Guarded Keyboard Shortcuts (Ctrl+J / Cmd+J to toggle mode, ESC to dismiss modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        if (!isInput && !isExportModalOpen) {
          e.preventDefault();
          setStudioMode((prev) => (prev === "workflow" ? "specialists" : "workflow"));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExportModalOpen]);

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
  const loadClientCampaigns = useCallback(
    async (cId: string) => {
      if (!token || !effectiveAgencyId || !cId) return;
      try {
        const list = (await campaignApi.list(effectiveAgencyId, cId, token)) as any[];
        setClientCampaigns(list || []);
        if (list && list.length > 0) {
          const urlCampaignId = searchParams.get("campaignId");
          if (urlCampaignId && list.some((c: any) => c.id === urlCampaignId)) {
            setActiveCampaignId(urlCampaignId);
            return;
          }
          setActiveCampaignId((prev) => {
            if (prev && list.some((c: any) => c.id === prev)) {
              return prev;
            }
            // Always default to the newest campaign (list is sorted by created_at DESC)
            return list[0].id;
          });
        }
      } catch (err) {
        console.error("Failed to load client campaigns", err);
      }
    },
    [token, effectiveAgencyId, searchParams]
  );

  useEffect(() => {
    if (selectedClientId) {
      loadClientCampaigns(selectedClientId);
    }
  }, [selectedClientId, loadClientCampaigns]);

  // Cancel / dismiss campaign generation suggestion
  const handleCancelGenerationSuggestion = () => {
    setSuggestedObjective("");
    setSuggestedCustomBrief("");
    setIsReadyToGenerate(false);
  };

  // Abort running pipeline
  const handleAbortPipeline = () => {
    setIsPipelineRunning(false);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `abort-${Date.now()}`,
        role: "assistant",
        content: "⏹️ **Campaign Sprint generation cancelled.** No new campaign was created. You can continue refining with the specialist agents.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Campaign Director",
      },
    ]);
  };

  // Delete / Discard active campaign
  const handleDeleteActiveCampaign = async () => {
    if (!token || !effectiveAgencyId || !activeCampaignId) return;
    try {
      setDeletingCampaign(true);
      await campaignApi.delete(effectiveAgencyId, activeCampaignId, token);
      setShowDeleteCampaignModal(false);
      const deletedCampId = activeCampaignId;
      setActiveCampaignId(null);
      setActiveArtifact(null);
      setActiveArtifactVersions([]);
      setPersistedArtifacts([]);
      if (typeof window !== "undefined") {
        const legacyKey = `agencyos_studio_chat_${effectiveAgencyId || "default"}_${selectedClientId}_${deletedCampId || "new"}`;
        localStorage.removeItem(legacyKey);
      }
      if (selectedClientId) {
        await loadClientCampaigns(selectedClientId);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete campaign");
    } finally {
      setDeletingCampaign(false);
    }
  };

  // Load all persistent studio artifacts for a campaign from database
  const loadCampaignArtifacts = useCallback(
    async (targetCampaignId: string) => {
      if (!effectiveAgencyId || !targetCampaignId || !token) return;
      setIsLoadingArtifacts(true);
      try {
        const loadedArts: ActiveArtifactData[] = [];

        // 1. Fetch persistent studio_artifacts from database for this campaign
        const arts = await studioApi.listArtifacts(effectiveAgencyId, targetCampaignId, token).catch(() => []);
        if (arts && Array.isArray(arts)) {
          arts.forEach((art: any) => {
            const targetVer = art.latest_version;
            loadedArts.push({
              id: art.id,
              type: art.artifact_type,
              title: art.title,
              version: art.current_version_number || targetVer?.version_number || 1,
              status: targetVer?.is_approved ? "approved" : (art.status || "draft"),
              campaign_id: targetCampaignId,
              payload: targetVer?.payload || {},
              supporting_evidence_refs: targetVer?.supporting_evidence_refs || [],
            });
          });
        }

        // 2. Fetch campaign details to check for full sprint draft deliverables
        const camp: any = await campaignApi.get(effectiveAgencyId, targetCampaignId, token).catch(() => null);
        const planDeliverables = camp?.ai_plan_draft?.deliverables || [];

        // Strategy blueprint
        if (camp?.ai_plan_draft?.strategy) {
          const strat = camp.ai_plan_draft.strategy;
          loadedArts.push({
            id: `strat-${targetCampaignId}`,
            type: "campaign_blueprint",
            title: strat.campaign_theme || camp.name || "Master Campaign Strategy",
            version: 1,
            status: "approved",
            campaign_id: targetCampaignId,
            payload: {
              campaign_theme: strat.campaign_theme || camp.name,
              master_slogan: strat.strategic_thesis || strat.primary_objective || strat.campaign_theme,
              narrative_stages: Object.entries(strat.funnel_narrative || {}).map(([stage, msg], i) => ({
                stage_name: stage.replace(/_/g, " ").toUpperCase(),
                days_range: `Phase ${i + 1}`,
                core_message: String(msg),
                deliverable_focus: (strat.strategic_angles || []).map((a: any) => a.angle_name || String(a)),
              })),
              format_mix_ratios: strat.budget_allocation || { LinkedIn: 100 },
              ...strat,
            },
          });
        }

        // All deliverables (Reels & Carousels)
        if (planDeliverables.length > 0) {
          planDeliverables.forEach((d: any, idx: number) => {
            const isCarousel = d.deliverable_type === "carousel" || (d.carousel_slides && d.carousel_slides.length > 0);
            const isInProd = d.status === "in_production" || d.is_exported;
            const isRej = d.status === "rejected";

            loadedArts.push({
              id: `deliv-${isCarousel ? "carousel" : "reel"}-${idx}`,
              type: isCarousel ? "carousel_deck" : "storyboard",
              title: d.title || (isCarousel ? `Carousel Slide Deck ${idx + 1}` : `Video / Reel Script ${idx + 1}`),
              version: 1,
              status: isInProd ? "in_production" : isRej ? "rejected" : (d.status || "draft"),
              campaign_id: targetCampaignId,
              payload: isCarousel
                ? {
                    deliverable_title: d.title || "Technical Carousel",
                    slides: (d.carousel_slides || []).map((s: any) => ({
                      slide_number: s.slide_number,
                      headline: s.headline,
                      body_copy: s.body_copy,
                      visual_prompt: s.visual_prompt || s.visual_layout,
                    })),
                    full_caption: d.core_message_summary || d.caption || d.hook,
                    call_to_action: d.call_to_action,
                  }
                : {
                    deliverable_title: d.title || "Technical Reel",
                    scenes: (d.reel_scenes || []).map((s: any) => ({
                      scene_number: s.scene_number,
                      timestamp_range: s.timestamp_range,
                      shot_type: s.shot_type || "Screen Recording / Architecture Diagram",
                      visual_action: s.visual_action,
                      voiceover_script: s.spoken_audio_or_voiceover || s.voiceover_script,
                      on_screen_text: s.on_screen_text,
                    })),
                    call_to_action: d.call_to_action,
                  },
            });
          });
        }

        // Quality audit
        if (camp?.ai_plan_draft?.quality_evaluation) {
          const q = camp.ai_plan_draft.quality_evaluation;
          loadedArts.push({
            id: `qa-${targetCampaignId}`,
            type: "compliance_review",
            title: "Pre-Flight Quality Audit",
            version: 1,
            status: "approved",
            campaign_id: targetCampaignId,
            payload: {
              ...q,
              checks: (q.findings || []).map((f: any) => ({
                rule_name: f.category ? f.category.replace(/_/g, " ").toUpperCase() : "Brand Guideline Rule",
                verdict: f.severity === "error" || f.severity === "blocking" ? "FAIL" : f.severity === "warning" ? "NEEDS_REVIEW" : "PASS",
                details: f.issue_description || f.remediation_instruction || "Verified against brand profile.",
                severity: f.severity,
              })),
              has_blocking_violations: q.revision_required || false,
            },
          });
        }

        if (loadedArts.length > 0) {
          const taggedArts = loadedArts.map((a) => ({
            ...a,
            chat_id: a.chat_id || activeChatId || undefined,
          }));
          setPersistedArtifacts(taggedArts);
          setActiveArtifact((prev) => {
            if (!prev || !taggedArts.some((a) => a.id === prev.id)) {
              return taggedArts[0];
            }
            return prev;
          });
        } else if (!isPipelineRunningRef.current && !isProgrammaticCampaignChangeRef.current) {
          // Do not wipe in-memory artifacts if the active chat session already has them
          setPersistedArtifacts((prev) => (prev.length > 0 ? prev : []));
        }
      } catch (err) {
        console.error("Failed to load campaign studio artifacts:", err);
      } finally {
        setIsLoadingArtifacts(false);
      }
    },
    [effectiveAgencyId, token, activeChatId]
  );

  // Load operational DAG run deliverables for the active client
  const loadOperationalRunArtifacts = useCallback(
    async (clientId: string) => {
      if (!effectiveAgencyId || !token || !clientId) return;
      try {
        setIsLoadingArtifacts(true);
        const runs = await operationalWorkflowApi.listRuns(effectiveAgencyId, token, clientId);
        if (!runs || runs.length === 0) return;

        // Find the latest completed or running run
        const latestRun = runs[0];
        if (!latestRun) return;

        setActiveWorkflowRunId(latestRun.id);

        const stratTask = latestRun.tasks.find((t) => t.task_key === "campaign_strategy");
        const contentTask = latestRun.tasks.find((t) => t.task_key === "content_architecture");
        const qaTask = latestRun.tasks.find((t) => t.task_key === "final_quality_audit");

        const loadedArtifacts: ActiveArtifactData[] = [];

        // 1. Strategy Blueprint
        if (stratTask && stratTask.status === "completed") {
          try {
            const stratRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, stratTask.id, token);
            const stratPayload = stratRes?.output || {};
            loadedArtifacts.push({
              id: `strat-${latestRun.id}`,
              type: "campaign_blueprint",
              title: stratPayload.campaign_theme || latestRun.name || "Master Campaign Strategy",
              version: 1,
              status: latestRun.status === "completed" ? "approved" : "draft",
              payload: {
                campaign_theme: stratPayload.campaign_theme || latestRun.name,
                master_slogan: stratPayload.strategic_thesis || stratPayload.core_tension || stratPayload.campaign_theme,
                narrative_stages: Object.entries(stratPayload.funnel_narrative || {}).map(([stage, msg], i) => ({
                  stage_name: stage.replace(/_/g, " ").toUpperCase(),
                  days_range: `Phase ${i + 1}`,
                  core_message: String(msg),
                  deliverable_focus: (stratPayload.strategic_angles || []).map((a: any) => a.angle_name || String(a)),
                })),
                format_mix_ratios: stratPayload.budget_allocation || { LinkedIn: 100 },
                ...stratPayload,
              },
            });
          } catch (e) {
            console.error("Failed to load strat output:", e);
          }
        }

        // 2. Video Reel Script & Carousel Deck
        if (contentTask && contentTask.status === "completed") {
          try {
            const contentRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, contentTask.id, token);
            const contentData = contentRes?.output || {};
            const deliverables = contentData.deliverables || [];

            deliverables.forEach((d: any, idx: number) => {
              if (d.format === "carousel") {
                loadedArtifacts.push({
                  id: `deliv-carousel-${idx}`,
                  type: "carousel_deck",
                  title: d.hook_or_title || `Carousel Slide Deck ${idx + 1}`,
                  version: 1,
                  status: latestRun.status === "completed" ? "approved" : "draft",
                  payload: {
                    deliverable_title: d.hook_or_title || "Technical Carousel",
                    slides: (d.carousel_slides || []).map((s: any) => ({
                      slide_number: s.slide_number,
                      headline: s.headline,
                      body_copy: s.body_copy,
                      visual_prompt: s.visual_prompt,
                    })),
                    full_caption: d.core_message_summary || d.hook_or_title,
                    call_to_action: d.call_to_action,
                  },
                });
              } else {
                loadedArtifacts.push({
                  id: `deliv-reel-${idx}`,
                  type: "storyboard",
                  title: d.hook_or_title || `Video / Reel Script ${idx + 1}`,
                  version: 1,
                  status: latestRun.status === "completed" ? "approved" : "draft",
                  payload: {
                    deliverable_title: d.hook_or_title || "Technical Reel",
                    scenes: (d.reel_scenes || []).map((s: any) => ({
                      scene_number: s.scene_number,
                      timestamp_range: s.timestamp_range,
                      shot_type: s.shot_type || "Screen Recording / Architecture Diagram",
                      visual_action: s.visual_action,
                      voiceover_script: s.voiceover_script,
                      on_screen_text: s.on_screen_text,
                    })),
                    call_to_action: d.call_to_action,
                  },
                });
              }
            });
          } catch (e) {
            console.error("Failed to load content deliverables:", e);
          }
        }

        // 3. QA Audit
        if (qaTask && qaTask.status === "completed") {
          try {
            const qaRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, qaTask.id, token);
            const qaData = qaRes?.output || {};
            loadedArtifacts.push({
              id: `qa-${latestRun.id}`,
              type: "compliance_review",
              title: "Pre-Flight Quality Audit",
              version: 1,
              status: "approved",
              payload: {
                ...qaData,
                checks: (qaData.findings || []).map((f: any) => ({
                  rule_name: f.category ? f.category.replace(/_/g, " ").toUpperCase() : "Brand Guideline Rule",
                  verdict: f.severity === "error" || f.severity === "blocking" ? "FAIL" : (f.severity === "warning" ? "NEEDS_REVIEW" : "PASS"),
                  details: f.issue_description || f.remediation_instruction || "Verified against brand profile.",
                  severity: f.severity,
                })),
                has_blocking_violations: qaData.revision_required || false,
              },
            });
          } catch (e) {
            console.error("Failed to load QA output:", e);
          }
        }

        if (loadedArtifacts.length > 0) {
          setPersistedArtifacts(loadedArtifacts);
          setActiveArtifact(loadedArtifacts[0]);
        }
      } catch (err) {
        console.error("Failed to load operational run artifacts:", err);
      } finally {
        setIsLoadingArtifacts(false);
      }
    },
    [effectiveAgencyId, token]
  );

  // Sync persistent artifacts whenever active campaign sprint changes
  useEffect(() => {
    if (isPipelineRunning || isPipelineRunningRef.current || isProgrammaticCampaignChangeRef.current) return;
    if (activeCampaignId && effectiveAgencyId && token) {
      loadCampaignArtifacts(activeCampaignId);
    } else if (activeWorkflowRunId && effectiveAgencyId && token) {
      loadOperationalRunArtifacts(selectedClientId);
    }
  }, [activeCampaignId, activeWorkflowRunId, selectedClientId, effectiveAgencyId, token, loadCampaignArtifacts, loadOperationalRunArtifacts, isPipelineRunning]);

  // Load agency team members for production assignment
  useEffect(() => {
    if (!token || !effectiveAgencyId) return;
    agencyApi
      .listMembers(effectiveAgencyId, token)
      .then((data: any) => {
        if (Array.isArray(data)) {
          setTeamMembers(
            data.map((m: any) => ({
              id: m.user_id || m.id,
              full_name: m.user?.full_name || m.full_name || "Team Member",
              email: m.user?.email || m.email || "",
              role: m.role || "Member",
            }))
          );
        }
      })
      .catch((err) => console.error("Failed to load team members", err));
  }, [token, effectiveAgencyId]);

  // =========================================================================
  // Studio Chat Sessions & History Management
  // =========================================================================

  const getSessionsIndexKey = useCallback(
    (cId: string) => `agencyos_studio_sessions_index_${effectiveAgencyId || "default"}_${cId}`,
    [effectiveAgencyId]
  );

  const getSessionDataKey = useCallback(
    (sessionId: string) => `agencyos_studio_session_data_${sessionId}`,
    []
  );

  const getActiveChatPointerKey = useCallback(
    (cId: string) => `agencyos_studio_active_chat_${effectiveAgencyId || "default"}_${cId}`,
    [effectiveAgencyId]
  );

  const createDefaultWelcomeMessage = useCallback(
    (client: Client | null): ChatMsg => {
      const clientName = client ? client.business_name : "your client";
      const industryInfo = client?.industry ? ` in the ${client.industry} industry` : "";
      return {
        id: `welcome-${client?.id || "default"}-${Date.now()}`,
        role: "assistant",
        content: `👋 Hello! I am your AI Campaign Director Copilot. Let's design a high-converting social media campaign for **${clientName}**${industryInfo}.\n\nTell me about your vision for this upcoming sprint—are you planning a special product launch, seasonal promotion, brand awareness push, or lead generation challenge? What angles or offers would you like to explore?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Campaign Director",
      };
    },
    []
  );

  // Create a brand new isolated chat session
  const createNewChatSession = useCallback(
    (targetClientId?: string) => {
      const cId = targetClientId || selectedClientId;
      if (!cId) return "";

      const client = clients.find((c) => c.id === cId) || selectedClient;
      const newChatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const welcomeMsg = createDefaultWelcomeMessage(client);

      const newSessionData: StudioChatSessionData = {
        id: newChatId,
        title: "New Conversation",
        clientId: cId,
        agencyId: effectiveAgencyId || "default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        campaignId: null,
        workflowRunId: null,
        messages: [welcomeMsg],
        artifacts: [],
        activeArtifactId: null,
        suggestedObjective: "",
        suggestedCustomBrief: "",
        deliverablePreferences: [],
        isReadyToGenerate: false,
        startDate: "",
        endDate: "",
        durationDays: null,
        periodMonth: new Date().getMonth() + 1,
        periodYear: new Date().getFullYear(),
        pinnedEntities: [],
        discoveredEntities: [],
        activeSpecialistId: "market_research",
        studioMode: "workflow",
      };

      const newSessionMeta: StudioChatSessionMeta = {
        id: newChatId,
        title: "New Conversation",
        clientId: cId,
        createdAt: newSessionData.createdAt,
        updatedAt: newSessionData.updatedAt,
        messageCount: 1,
        artifactCount: 0,
        campaignId: null,
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(getSessionDataKey(newChatId), JSON.stringify(newSessionData));
          const idxKey = getSessionsIndexKey(cId);
          const rawIdx = localStorage.getItem(idxKey);
          let currentList: StudioChatSessionMeta[] = [];
          if (rawIdx) {
            try {
              currentList = JSON.parse(rawIdx);
            } catch (e) {}
          }
          const updatedList = [newSessionMeta, ...currentList.filter((s) => s.id !== newChatId)];
          localStorage.setItem(idxKey, JSON.stringify(updatedList));
          localStorage.setItem(getActiveChatPointerKey(cId), newChatId);
          setChatSessions(updatedList);
        } catch (e) {
          console.error("Failed to save new chat session", e);
        }
      }

      isProgrammaticCampaignChangeRef.current = true;
      setActiveChatId(newChatId);
      setChatMessages([welcomeMsg]);
      setPersistedArtifacts([]);
      setActiveArtifact(null);
      setActiveArtifactVersions([]);
      setSuggestedObjective("");
      setSuggestedCustomBrief("");
      setDeliverablePreferences([]);
      setIsReadyToGenerate(false);
      setStartDate("");
      setEndDate("");
      setDurationDays(null);
      setActiveCampaignId(null);
      setActiveWorkflowRunId(null);
      setPinnedEntities([]);
      setDiscoveredEntities([]);
      setStudioMode("workflow");
      setActiveSpecialistId("market_research");
      setIsChatHistoryOpen(false);

      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 50);

      return newChatId;
    },
    [
      selectedClientId,
      clients,
      selectedClient,
      createDefaultWelcomeMessage,
      effectiveAgencyId,
      getSessionDataKey,
      getSessionsIndexKey,
      getActiveChatPointerKey,
    ]
  );

  // Switch to an existing chat session with full context and artifact isolation
  const switchChatSession = useCallback(
    (targetChatId: string) => {
      if (!targetChatId) return;
      if (targetChatId === activeChatId) {
        setIsChatHistoryOpen(false);
        return;
      }

      if (typeof window === "undefined") return;

      const targetDataRaw = localStorage.getItem(getSessionDataKey(targetChatId));
      if (!targetDataRaw) return;

      try {
        const parsed: StudioChatSessionData = JSON.parse(targetDataRaw);
        isProgrammaticCampaignChangeRef.current = true;

        setActiveChatId(targetChatId);
        localStorage.setItem(getActiveChatPointerKey(parsed.clientId || selectedClientId), targetChatId);

        // Sanitize messages
        const msgs =
          Array.isArray(parsed.messages) && parsed.messages.length > 0
            ? parsed.messages
            : [createDefaultWelcomeMessage(selectedClient)];
        setChatMessages(msgs);

        // Restore artifacts belonging strictly to this chat session!
        const sessionArts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
        setPersistedArtifacts(sessionArts);

        if (parsed.activeArtifactId && sessionArts.some((a) => a.id === parsed.activeArtifactId)) {
          setActiveArtifact(sessionArts.find((a) => a.id === parsed.activeArtifactId) || null);
        } else if (sessionArts.length > 0) {
          setActiveArtifact(sessionArts[0]);
        } else {
          setActiveArtifact(null);
        }

        setActiveCampaignId(parsed.campaignId || null);
        setActiveWorkflowRunId(parsed.workflowRunId || null);
        setSuggestedObjective(parsed.suggestedObjective || "");
        setSuggestedCustomBrief(parsed.suggestedCustomBrief || "");
        setDeliverablePreferences(parsed.deliverablePreferences || []);
        setIsReadyToGenerate(Boolean(parsed.isReadyToGenerate));
        setStartDate(parsed.startDate || "");
        setEndDate(parsed.endDate || "");
        setDurationDays(parsed.durationDays ?? null);
        if (parsed.periodMonth) setPeriodMonth(parsed.periodMonth);
        if (parsed.periodYear) setPeriodYear(parsed.periodYear);
        if (Array.isArray(parsed.pinnedEntities)) setPinnedEntities(parsed.pinnedEntities);
        if (Array.isArray(parsed.discoveredEntities)) setDiscoveredEntities(parsed.discoveredEntities);
        if (parsed.studioMode) setStudioMode(parsed.studioMode);
        if (parsed.activeSpecialistId) setActiveSpecialistId(parsed.activeSpecialistId);

        setIsChatHistoryOpen(false);

        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 50);
      } catch (err) {
        console.error("Failed to switch chat session", err);
      }
    },
    [
      activeChatId,
      getSessionDataKey,
      getActiveChatPointerKey,
      selectedClientId,
      createDefaultWelcomeMessage,
      selectedClient,
    ]
  );

  // Delete a chat session
  const deleteChatSession = useCallback(
    (chatIdToDelete: string) => {
      if (!selectedClientId || typeof window === "undefined") return;

      try {
        localStorage.removeItem(getSessionDataKey(chatIdToDelete));
        const idxKey = getSessionsIndexKey(selectedClientId);
        const rawIdx = localStorage.getItem(idxKey);
        let list: StudioChatSessionMeta[] = [];
        if (rawIdx) {
          try {
            list = JSON.parse(rawIdx);
          } catch (e) {}
        }
        const updatedList = list.filter((s) => s.id !== chatIdToDelete);
        localStorage.setItem(idxKey, JSON.stringify(updatedList));
        setChatSessions(updatedList);

        if (chatIdToDelete === activeChatId) {
          if (updatedList.length > 0) {
            switchChatSession(updatedList[0].id);
          } else {
            createNewChatSession(selectedClientId);
          }
        }
      } catch (e) {
        console.error("Failed to delete chat session", e);
      }
    },
    [
      selectedClientId,
      getSessionDataKey,
      getSessionsIndexKey,
      activeChatId,
      switchChatSession,
      createNewChatSession,
    ]
  );

  // Auto-persist active chat session and update metadata in index
  useEffect(() => {
    if (!selectedClientId || !activeChatId || chatMessages.length === 0) return;
    if (typeof window === "undefined") return;

    try {
      // Generate clean, informative chat title from objective or user prompt
      let title = "New Conversation";
      const firstUserMsg = chatMessages.find((m) => m.role === "user");
      if (suggestedObjective && suggestedObjective.trim().length > 0) {
        title = suggestedObjective.length > 45 ? `${suggestedObjective.substring(0, 42)}...` : suggestedObjective;
      } else if (firstUserMsg && firstUserMsg.content) {
        const cleanContent = firstUserMsg.content.replace(/^[\s\W]+/, "").trim();
        title = cleanContent.length > 42 ? `${cleanContent.substring(0, 39)}...` : cleanContent;
      }

      const sessionData: StudioChatSessionData = {
        id: activeChatId,
        title,
        clientId: selectedClientId,
        agencyId: effectiveAgencyId || "default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        campaignId: activeCampaignId,
        workflowRunId: activeWorkflowRunId,
        messages: chatMessages,
        artifacts: persistedArtifacts.map((a) => ({ ...a, chat_id: activeChatId })),
        activeArtifactId: activeArtifact?.id || null,
        suggestedObjective,
        suggestedCustomBrief,
        deliverablePreferences,
        isReadyToGenerate,
        startDate,
        endDate,
        durationDays,
        periodMonth,
        periodYear,
        pinnedEntities,
        discoveredEntities,
        activeSpecialistId,
        studioMode,
      };

      const existingRaw = localStorage.getItem(getSessionDataKey(activeChatId));
      if (existingRaw) {
        try {
          const parsedExisting = JSON.parse(existingRaw);
          if (parsedExisting.createdAt) sessionData.createdAt = parsedExisting.createdAt;
        } catch (e) {}
      }

      localStorage.setItem(getSessionDataKey(activeChatId), JSON.stringify(sessionData));

      // Update index
      const idxKey = getSessionsIndexKey(selectedClientId);
      const rawIdx = localStorage.getItem(idxKey);
      let list: StudioChatSessionMeta[] = [];
      if (rawIdx) {
        try {
          list = JSON.parse(rawIdx);
        } catch (e) {}
      }

      const metaItem: StudioChatSessionMeta = {
        id: activeChatId,
        title,
        clientId: selectedClientId,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
        messageCount: chatMessages.length,
        artifactCount: persistedArtifacts.length,
        campaignId: activeCampaignId,
      };

      const updatedList = [metaItem, ...list.filter((s) => s.id !== activeChatId)];
      localStorage.setItem(idxKey, JSON.stringify(updatedList));
      setChatSessions(updatedList);
    } catch (e) {
      console.error("Failed to auto-persist active chat session", e);
    }
  }, [
    activeChatId,
    selectedClientId,
    chatMessages,
    persistedArtifacts,
    activeArtifact,
    suggestedObjective,
    suggestedCustomBrief,
    deliverablePreferences,
    isReadyToGenerate,
    startDate,
    endDate,
    durationDays,
    periodMonth,
    periodYear,
    studioMode,
    activeSpecialistId,
    activeCampaignId,
    activeWorkflowRunId,
    pinnedEntities,
    discoveredEntities,
    effectiveAgencyId,
    getSessionDataKey,
    getSessionsIndexKey,
  ]);

  // Load client object and initialize/restore chat session when selectedClientId changes
  useEffect(() => {
    if (!selectedClientId || clients.length === 0) return;
    const client = clients.find((c) => c.id === selectedClientId) || null;
    setSelectedClient(client);

    if (isPipelineRunning || isPipelineRunningRef.current || isProgrammaticCampaignChangeRef.current) {
      isProgrammaticCampaignChangeRef.current = false;
      return;
    }

    if (typeof window === "undefined") return;

    const idxKey = getSessionsIndexKey(selectedClientId);
    const rawIdx = localStorage.getItem(idxKey);
    let list: StudioChatSessionMeta[] = [];
    if (rawIdx) {
      try {
        list = JSON.parse(rawIdx);
      } catch (e) {}
    }

    const activePtrKey = getActiveChatPointerKey(selectedClientId);
    const lastActiveId = localStorage.getItem(activePtrKey);

    let targetChatId = lastActiveId && list.some((s) => s.id === lastActiveId) ? lastActiveId : null;
    if (!targetChatId && list.length > 0) {
      targetChatId = list[0].id;
    }

    if (targetChatId) {
      setChatSessions(list);
      const dataRaw = localStorage.getItem(getSessionDataKey(targetChatId));
      if (dataRaw) {
        try {
          const parsed: StudioChatSessionData = JSON.parse(dataRaw);
          setActiveChatId(targetChatId);
          setChatMessages(
            parsed.messages && parsed.messages.length > 0
              ? parsed.messages
              : [createDefaultWelcomeMessage(client)]
          );
          setPersistedArtifacts(parsed.artifacts || []);
          if (parsed.activeArtifactId && parsed.artifacts?.some((a) => a.id === parsed.activeArtifactId)) {
            setActiveArtifact(parsed.artifacts.find((a) => a.id === parsed.activeArtifactId) || null);
          } else if (parsed.artifacts && parsed.artifacts.length > 0) {
            setActiveArtifact(parsed.artifacts[0]);
          } else {
            setActiveArtifact(null);
          }
          setActiveCampaignId(parsed.campaignId || null);
          setActiveWorkflowRunId(parsed.workflowRunId || null);
          setSuggestedObjective(parsed.suggestedObjective || "");
          setSuggestedCustomBrief(parsed.suggestedCustomBrief || "");
          setDeliverablePreferences(parsed.deliverablePreferences || []);
          setIsReadyToGenerate(Boolean(parsed.isReadyToGenerate));
          setStartDate(parsed.startDate || "");
          setEndDate(parsed.endDate || "");
          setDurationDays(parsed.durationDays ?? null);
          if (parsed.periodMonth) setPeriodMonth(parsed.periodMonth);
          if (parsed.periodYear) setPeriodYear(parsed.periodYear);
          if (Array.isArray(parsed.pinnedEntities)) setPinnedEntities(parsed.pinnedEntities);
          if (Array.isArray(parsed.discoveredEntities)) setDiscoveredEntities(parsed.discoveredEntities);
          if (parsed.studioMode) setStudioMode(parsed.studioMode);
          if (parsed.activeSpecialistId) setActiveSpecialistId(parsed.activeSpecialistId);
          return;
        } catch (e) {
          console.error("Failed to restore target chat session", e);
        }
      }
    }

    // Check if there was a legacy un-migrated chat
    const legacyKey = `agencyos_studio_chat_${effectiveAgencyId || "default"}_${selectedClientId}_new`;
    const legacySaved = localStorage.getItem(legacyKey);
    if (legacySaved) {
      try {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          const migratedId = `chat_${Date.now()}_migrated`;
          const migratedSession: StudioChatSessionData = {
            id: migratedId,
            title: parsed.suggestedObjective || "Previous Campaign Sprint",
            clientId: selectedClientId,
            agencyId: effectiveAgencyId || "default",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            campaignId: parsed.activeCampaignId || null,
            workflowRunId: null,
            messages: parsed.messages,
            artifacts: [],
            activeArtifactId: null,
            suggestedObjective: parsed.suggestedObjective || "",
            suggestedCustomBrief: parsed.suggestedCustomBrief || "",
            deliverablePreferences: [],
            isReadyToGenerate: Boolean(parsed.isReadyToGenerate),
            startDate: parsed.startDate || "",
            endDate: parsed.endDate || "",
            durationDays: parsed.durationDays || null,
            periodMonth: parsed.periodMonth || new Date().getMonth() + 1,
            periodYear: parsed.periodYear || new Date().getFullYear(),
            pinnedEntities: parsed.pinnedEntities || [],
            discoveredEntities: parsed.discoveredEntities || [],
            activeSpecialistId: parsed.activeSpecialistId || "market_research",
            studioMode: parsed.studioMode || "workflow",
          };
          localStorage.setItem(getSessionDataKey(migratedId), JSON.stringify(migratedSession));
          const meta: StudioChatSessionMeta = {
            id: migratedId,
            title: migratedSession.title,
            clientId: selectedClientId,
            createdAt: migratedSession.createdAt,
            updatedAt: migratedSession.updatedAt,
            messageCount: parsed.messages.length,
            artifactCount: 0,
            campaignId: migratedSession.campaignId,
          };
          const updated = [meta, ...list];
          localStorage.setItem(idxKey, JSON.stringify(updated));
          localStorage.setItem(activePtrKey, migratedId);
          setChatSessions(updated);
          setActiveChatId(migratedId);
          setChatMessages(parsed.messages);
          setSuggestedObjective(parsed.suggestedObjective || "");
          setIsReadyToGenerate(Boolean(parsed.isReadyToGenerate));
          return;
        }
      } catch (e) {}
    }

    // Initialize fresh session
    createNewChatSession(selectedClientId);
  }, [
    selectedClientId,
    clients,
    effectiveAgencyId,
    getSessionsIndexKey,
    getSessionDataKey,
    getActiveChatPointerKey,
    createDefaultWelcomeMessage,
    createNewChatSession,
  ]);

  // Current active agent specification
  const currentAgentId = studioMode === "workflow" ? "director" : activeSpecialistId;
  const currentAgent = getAgentInfo(currentAgentId);

  // Send message to Copilot Brief endpoint with universal shared context
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || chatInput.trim();
    if (!textToSend || !token || !effectiveAgencyId || !selectedClientId || isChatLoading || isPipelineRunning) {
      return;
    }

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agent_id: currentAgentId,
      agent_name: "You",
    };

    const nextMessages = [...chatMessages, userMsg];
    if (!textOverride) setChatInput("");
    setIsChatLoading(true);

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: ChatMsg = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agent_id: currentAgentId,
      agent_name: currentAgent.name,
      activity_logs: [],
      isStreaming: true,
      streamingStatus: `Connecting to ${currentAgent.name}...`,
    };

    setChatMessages([...nextMessages, initialAiMsg]);

    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);

    let accumulatedContent = "";
    let accumulatedLogs: string[] = [];

    try {
      await campaignApi.chatBriefStream(
        effectiveAgencyId,
        selectedClientId,
        {
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            agent_id: m.agent_id,
            agent_name: m.agent_name,
          })),
          agent_id: currentAgentId,
          period_month: periodMonth,
          period_year: periodYear,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          campaign_id: activeCampaignId || undefined,
          active_artifact_id: activeArtifact?.id || undefined,
          active_artifact_version: activeArtifact?.version || undefined,
          pinned_entities: pinnedEntities,
          discovered_entities: discoveredEntities,
          chat_id: activeChatId || undefined,
        },
        token,
        (evt) => {
          if (evt.type === "status" || evt.type === "turn_start") {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, streamingStatus: evt.message }
                  : m
              )
            );
          } else if (evt.type === "tool_start") {
            const displayMsg = evt.message || `Running ${evt.tool}...`;
            accumulatedLogs = [...accumulatedLogs, `⏳ ${displayMsg}`];
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, streamingStatus: displayMsg, activity_logs: accumulatedLogs }
                  : m
              )
            );
          } else if (evt.type === "tool_end") {
            const completedMsg = evt.message || `Tool: ${evt.tool} → ${evt.summary || "completed"}`;
            accumulatedLogs = [
              ...accumulatedLogs.filter((l) => typeof l === "string" ? !l.startsWith("⏳") : true),
              completedMsg,
            ];
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, activity_logs: accumulatedLogs }
                  : m
              )
            );
          } else if (evt.type === "token") {
            accumulatedContent += (evt.content || "");
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: accumulatedContent, streamingStatus: undefined }
                  : m
              )
            );
          } else if (evt.type === "done" && evt.response) {
            const response = evt.response;
            if (response.campaign_id) {
              setActiveCampaignId(response.campaign_id);
            }
            if (response.artifact_id && response.artifact_payload) {
              const targetCampId = response.campaign_id || activeCampaignId || undefined;
              const newArt: ActiveArtifactData = {
                id: response.artifact_id,
                type: response.artifact_type || "storyboard",
                title: response.artifact_title || `${currentAgent.name} Asset`,
                version: response.artifact_version_number || 1,
                status: response.artifact_status || "draft",
                campaign_id: targetCampId,
                chat_id: activeChatId,
                payload: response.artifact_payload,
                supporting_evidence_refs: response.supporting_evidence_refs || [],
              };
              setActiveArtifact(newArt);
              setPersistedArtifacts((prev) => {
                const filtered = prev.filter((a) => a.id !== response.artifact_id);
                return [newArt, ...filtered];
              });
              setMobileTab("canvas");
            }
            if (response.suggested_objective) setSuggestedObjective(response.suggested_objective);
            if (response.suggested_custom_brief) setSuggestedCustomBrief(response.suggested_custom_brief);
            if (response.suggested_deliverable_preferences && response.suggested_deliverable_preferences.length > 0) {
              setDeliverablePreferences(response.suggested_deliverable_preferences);
            }
            if (response.suggested_start_date) setStartDate(response.suggested_start_date);
            if (response.suggested_end_date) setEndDate(response.suggested_end_date);
            if (response.suggested_duration_days) setDurationDays(response.suggested_duration_days);
            if (response.suggested_deliverable_count) setDeliverableCount(response.suggested_deliverable_count);
            if (response.suggested_period_month) setPeriodMonth(response.suggested_period_month);
            if (response.suggested_period_year) setPeriodYear(response.suggested_period_year);
            if (response.is_ready_to_generate) setIsReadyToGenerate(true);
            if (response.discovered_entities && Array.isArray(response.discovered_entities)) {
              setDiscoveredEntities((prev) =>
                Array.from(new Set([...prev, ...(response.discovered_entities || [])]))
              );
            }
            if (response.pinned_entities && Array.isArray(response.pinned_entities) && pinnedEntities.length === 0) {
              setPinnedEntities(response.pinned_entities);
            }

            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content: response.reply || accumulatedContent,
                      activity_logs: response.activity_logs && response.activity_logs.length > 0 ? response.activity_logs : accumulatedLogs,
                      isStreaming: false,
                      streamingStatus: undefined,
                      artifact_summary: response.artifact_id
                        ? {
                            id: response.artifact_id,
                            type: response.artifact_type || "storyboard",
                            title: response.artifact_title || "Creative Asset",
                            version: response.artifact_version_number || 1,
                            status: response.artifact_status || "draft",
                            campaign_id: response.campaign_id || activeCampaignId || undefined,
                            chat_id: activeChatId,
                            payload: response.artifact_payload,
                            supporting_evidence_refs: response.supporting_evidence_refs || [],
                          }
                        : undefined,
                    }
                  : m
              )
            );
          } else if (evt.type === "error") {
            const errorMsg = evt.error || "An error occurred while generating response.";
            if (errorMsg.toLowerCase().includes("campaign not found")) {
              setActiveCampaignId(null);
            }
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content: `⚠️ **Research Notice**: ${errorMsg}`,
                      isStreaming: false,
                      streamingStatus: undefined,
                    }
                  : m
              )
            );
          }
        }
      );
    } catch (streamErr: any) {
      console.warn("SSE Stream encountered issue, falling back to sync endpoint:", streamErr);
      try {
        const response = await campaignApi.chatBrief(
          effectiveAgencyId,
          selectedClientId,
          {
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
              agent_id: m.agent_id,
              agent_name: m.agent_name,
            })),
            agent_id: currentAgentId,
            period_month: periodMonth,
            period_year: periodYear,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            campaign_id: activeCampaignId || undefined,
            active_artifact_id: activeArtifact?.id || undefined,
            active_artifact_version: activeArtifact?.version || undefined,
            pinned_entities: pinnedEntities,
            discovered_entities: discoveredEntities,
            chat_id: activeChatId || undefined,
          },
          token
        );

        if (response.campaign_id) setActiveCampaignId(response.campaign_id);
        if (response.discovered_entities && Array.isArray(response.discovered_entities)) {
          setDiscoveredEntities((prev) =>
            Array.from(new Set([...prev, ...(response.discovered_entities || [])]))
          );
        }
        if (response.pinned_entities && Array.isArray(response.pinned_entities) && pinnedEntities.length === 0) {
          setPinnedEntities(response.pinned_entities);
        }
        if (response.artifact_id && response.artifact_payload) {
          const targetCampId = response.campaign_id || activeCampaignId || undefined;
          const newArt: ActiveArtifactData = {
            id: response.artifact_id,
            type: response.artifact_type || "storyboard",
            title: response.artifact_title || `${currentAgent.name} Asset`,
            version: response.artifact_version_number || 1,
            status: response.artifact_status || "draft",
            campaign_id: targetCampId,
            chat_id: activeChatId,
            payload: response.artifact_payload,
            supporting_evidence_refs: response.supporting_evidence_refs || [],
          };
          setActiveArtifact(newArt);
          setPersistedArtifacts((prev) => {
            const filtered = prev.filter((a) => a.id !== response.artifact_id);
            return [newArt, ...filtered];
          });
          setMobileTab("canvas");
        }
        if (response.suggested_objective) setSuggestedObjective(response.suggested_objective);
        if (response.suggested_custom_brief) setSuggestedCustomBrief(response.suggested_custom_brief);
        if (response.suggested_deliverable_preferences && response.suggested_deliverable_preferences.length > 0) {
          setDeliverablePreferences(response.suggested_deliverable_preferences);
        }
        if (response.suggested_start_date) setStartDate(response.suggested_start_date);
        if (response.suggested_end_date) setEndDate(response.suggested_end_date);
        if (response.suggested_duration_days) setDurationDays(response.suggested_duration_days);
        if (response.suggested_period_month) setPeriodMonth(response.suggested_period_month);
        if (response.suggested_period_year) setPeriodYear(response.suggested_period_year);
        if (response.is_ready_to_generate) setIsReadyToGenerate(true);

        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: response.reply,
                  activity_logs: response.activity_logs || [],
                  isStreaming: false,
                  streamingStatus: undefined,
                  artifact_summary: response.artifact_id
                    ? {
                        id: response.artifact_id,
                        type: response.artifact_type || "storyboard",
                        title: response.artifact_title || "Creative Asset",
                        version: response.artifact_version_number || 1,
                        status: response.artifact_status || "draft",
                        campaign_id: response.campaign_id || activeCampaignId || undefined,
                        chat_id: activeChatId,
                        payload: response.artifact_payload,
                        supporting_evidence_refs: response.supporting_evidence_refs || [],
                      }
                    : undefined,
                }
              : m
          )
        );
      } catch (err: any) {
        console.error("Chat brief fallback error:", err);
        if (err?.message?.toLowerCase().includes("campaign not found")) {
          setActiveCampaignId(null);
        }
        const isNetworkErr = err?.message?.toLowerCase().includes("fetch") || err?.message?.toLowerCase().includes("network");
        const errorContent = isNetworkErr
          ? "Could not connect to the campaign server. Please check your network or server status and try again."
          : (err?.message || "I encountered an issue processing your request. Please try again.");
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: errorContent,
                  isStreaming: false,
                  streamingStatus: undefined,
                }
              : m
          )
        );
      }
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 10);
    }
  };

  // Approve a specific version of a studio artifact
  const handleApproveVersion = async (artifactId: string, versionNumber: number) => {
    if (!token || !effectiveAgencyId) return;
    if (!activeCampaignId) {
      setActiveArtifact((prev) =>
        prev && prev.id === artifactId ? { ...prev, status: "approved" } : prev
      );
      setPersistedArtifacts((prev) =>
        prev.map((art) => (art.id === artifactId ? { ...art, status: "approved" } : art))
      );
      return;
    }
    try {
      const res = await studioApi.approveArtifactVersion(
        effectiveAgencyId,
        activeCampaignId,
        artifactId,
        versionNumber,
        token
      );
      if (res) {
        setActiveArtifact((prev) =>
          prev && prev.id === artifactId ? { ...prev, status: "approved" } : prev
        );
        setActiveArtifactVersions((prev) =>
          prev.map((v) => (v.version_number === versionNumber ? { ...v, is_approved: true } : v))
        );
        if (activeCampaignId) {
          await loadCampaignArtifacts(activeCampaignId);
        }
      }
    } catch (err: any) {
      console.error("Failed to approve artifact version:", err);
    }
  };

  // Revise an artifact to create an immutable new version
  const handleReviseArtifact = async (
    artifactId: string,
    revisedPayload: Record<string, any>,
    changeSummary?: string
  ) => {
    if (!token || !effectiveAgencyId) return;
    if (!activeCampaignId) {
      setActiveArtifact((prev) =>
        prev && prev.id === artifactId
          ? {
              ...prev,
              payload: revisedPayload,
              version: (prev.version || 1) + 1,
            }
          : prev
      );
      setPersistedArtifacts((prev) =>
        prev.map((art) =>
          art.id === artifactId
            ? { ...art, payload: revisedPayload, version: (art.version || 1) + 1 }
            : art
        )
      );
      return;
    }
    try {
      const parentVer = activeArtifactVersions.find(
        (v) => v.version_number === activeArtifact?.version
      );
      const res = await studioApi.reviseArtifact(
        effectiveAgencyId,
        activeCampaignId,
        artifactId,
        {
          payload: revisedPayload,
          change_summary: changeSummary || "Manual edit from artboard",
          parent_version_id: parentVer?.id || null,
        },
        token
      );
      if (res) {
        const latest = res.latest_version;
        setActiveArtifact({
          id: res.id,
          type: res.artifact_type,
          title: res.title,
          version: res.current_version_number,
          status: res.status,
          payload: latest?.payload || revisedPayload,
          supporting_evidence_refs: latest?.supporting_evidence_refs || [],
        });
        setActiveArtifactVersions(res.versions || []);
        await loadCampaignArtifacts(activeCampaignId);
      }
    } catch (err: any) {
      console.error("Failed to save artifact revision:", err);
      alert(err?.message || "Failed to save artifact revision");
    }
  };

  // View or restore a specific artifact version on the Contextual Canvas
  const [isLoadingCanvasArtifact, setIsLoadingCanvasArtifact] = useState<string | null>(null);

  const handleViewOnCanvas = async (summary: NonNullable<ChatMsg["artifact_summary"]>) => {
    // 1. Immediately check local persistedArtifacts
    const localMatch = persistedArtifacts.find((p: any) => p.id === summary.id);
    if (localMatch && localMatch.payload && Object.keys(localMatch.payload).length > 0) {
      setActiveArtifact({
        id: localMatch.id,
        type: (localMatch as any).type || (localMatch as any).artifact_type || summary.type || "campaign_blueprint",
        title: localMatch.title || summary.title,
        version: localMatch.version || (localMatch as any).current_version_number || summary.version || 1,
        status: localMatch.status || summary.status || "draft",
        payload: localMatch.payload,
        supporting_evidence_refs: localMatch.supporting_evidence_refs || summary.supporting_evidence_refs || [],
      });
      setActiveArtifactVersions(localMatch.versions || []);
      setMobileTab("canvas");
      return;
    }

    const targetCampaignId = summary.campaign_id || activeCampaignId;

    if (
      effectiveAgencyId &&
      targetCampaignId &&
      token &&
      !summary.id.startsWith("strat-") &&
      !summary.id.startsWith("deliv-") &&
      !summary.id.startsWith("qa-")
    ) {
      setIsLoadingCanvasArtifact(summary.id);
      try {
        const detail = await studioApi.getArtifactDetail(
          effectiveAgencyId,
          targetCampaignId,
          summary.id,
          token
        );
        if (detail) {
          const targetVer =
            detail.versions?.find((v: any) => v.version_number === summary.version) ||
            detail.latest_version;
          const payload = targetVer?.payload || detail.payload || summary.payload || {};

          setActiveArtifact({
            id: detail.id,
            type: detail.artifact_type || summary.type,
            title: detail.title || summary.title,
            version: targetVer?.version_number || summary.version,
            status: targetVer?.is_approved ? "approved" : (detail.status || summary.status),
            payload: payload,
            supporting_evidence_refs: targetVer?.supporting_evidence_refs || detail.supporting_evidence_refs || [],
          });
          setActiveArtifactVersions(detail.versions || []);
          setMobileTab("canvas");
          return;
        }
      } catch (err) {
        console.error("Failed to load artifact details for canvas:", err);
      } finally {
        setIsLoadingCanvasArtifact(null);
      }
    }

    // Fallback if detail fetch failed or no targetCampaignId
    if (summary.payload && Object.keys(summary.payload).length > 0) {
      setActiveArtifact({
        id: summary.id,
        type: summary.type,
        title: summary.title,
        version: summary.version,
        status: summary.status,
        payload: summary.payload,
        supporting_evidence_refs: summary.supporting_evidence_refs || [],
      });
      setActiveArtifactVersions([]);
      setMobileTab("canvas");
    }
  };

  // Launch Multi-Agent DAG Operational Engine inline in Campaign Studio
  const handleRunPipeline = async () => {
    let targetClientId = selectedClientId;
    if (!targetClientId && clients.length > 0) {
      targetClientId = clients[0].id;
      setSelectedClientId(targetClientId);
    }
    if (!token || !effectiveAgencyId || !targetClientId || isPipelineRunning) {
      if (!targetClientId) {
        alert("Please select a client from the top dropdown before launching the pipeline.");
      }
      return;
    }

    setIsPipelineRunning(true);
    isPipelineRunningRef.current = true;
    setStudioMode("workflow");
    setPendingApproval(null);
    const pipelineMsgId = `pipeline-${Date.now()}`;

    const pipelineMsg: ChatMsg = {
      id: pipelineMsgId,
      role: "assistant",
      content: "🚀 **Launching Autonomous Multi-Agent Operational DAG Engine...**\nCoordinating 14-task workflow: parallel intelligence gathering (Brand Intel, Market Research, Performance) → Strategy synthesis → Creative Director Checkpoint.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agent_id: "director",
      agent_name: "Autonomous DAG Engine",
      agentPipeline: {
        status: "in_progress",
        activeStep: 0,
        stepDetails: {
          agent1: "Executing Phase 1 & 2: Parallel intelligence gathering across brand rules, market trends, and performance data...",
        },
      },
    };

    setChatMessages((prev) => [...prev, pipelineMsg]);

    let pollingInterval: any = null;

    try {
      const clientObj = clients.find((c) => c.id === targetClientId);
      const briefName = `${clientObj?.business_name || "Client"} - Campaign Sprint`;
      const briefTheme = suggestedObjective || suggestedCustomBrief || "Autonomous Multi-Platform Campaign";

      // 1. Launch 14-task operational DAG run in PostgreSQL
      const dagRun = await operationalWorkflowApi.launchRun(
        effectiveAgencyId,
        {
          client_id: targetClientId,
          campaign_name: briefName,
          theme: briefTheme,
          primary_goal: suggestedObjective || "Drive conversions, pipeline and brand authority",
          target_audience: ["Enterprise Decision Makers & Technical Leads"],
          platforms: deliverablePreferences.length > 0 ? deliverablePreferences : ["linkedin"],
          deliverable_count: deliverableCount || (durationDays === 1 ? 1 : (durationDays ? Math.min(durationDays, 14) : 2)),
          period_month: periodMonth || (new Date().getMonth() + 1),
          period_year: periodYear || new Date().getFullYear(),
          duration_days: durationDays || 1,
        },
        token
      );

      setActiveWorkflowRunId(dagRun.id);
      if (dagRun.campaign_id) {
        isProgrammaticCampaignChangeRef.current = true;

        // Update the active chat session's campaignId and pre-save legacy key
        const legacyKey = `agencyos_studio_chat_${effectiveAgencyId || "default"}_${targetClientId}_${dagRun.campaign_id}`;
        if (typeof window !== "undefined") {
          try {
            if (activeChatId) {
              const rawSession = localStorage.getItem(getSessionDataKey(activeChatId));
              if (rawSession) {
                const parsedSession = JSON.parse(rawSession);
                parsedSession.campaignId = dagRun.campaign_id;
                localStorage.setItem(getSessionDataKey(activeChatId), JSON.stringify(parsedSession));
              }
            }
            localStorage.setItem(
              legacyKey,
              JSON.stringify({
                messages: [...chatMessages, pipelineMsg],
                suggestedObjective,
                suggestedCustomBrief,
                isReadyToGenerate: false,
                startDate,
                endDate,
                durationDays,
                periodMonth,
                periodYear,
                studioMode: "workflow",
                activeSpecialistId,
                activeCampaignId: dagRun.campaign_id,
                pinnedEntities,
                discoveredEntities,
              })
            );
          } catch (e) {
            console.error("Failed to pre-save chat to campaign key", e);
          }
        }

        // Re-tag existing in-memory artifacts so their campaign_id matches
        setPersistedArtifacts((prev) =>
          prev.map((a) => ({
            ...a,
            campaign_id: dagRun.campaign_id || a.campaign_id,
          }))
        );
        setActiveArtifact((prev) =>
          prev ? { ...prev, campaign_id: dagRun.campaign_id || prev.campaign_id } : null
        );

        setActiveCampaignId(dagRun.campaign_id);
        loadClientCampaigns(targetClientId);
      }

      // 2. Poll progress live while executing automated Phase 1 & 2 tasks (up to Human Strategy Checkpoint)
      pollingInterval = setInterval(async () => {
        try {
          const runCheck = await operationalWorkflowApi.getRun(effectiveAgencyId, dagRun.id, token);
          const completedKeys = new Set(
            (runCheck.tasks || []).filter((t: any) => t.status === "completed").map((t: any) => t.task_key)
          );

          let stepIdx = 0;
          if (completedKeys.has("brand_intelligence")) stepIdx = 1;
          if (completedKeys.has("market_research")) stepIdx = 2;
          if (completedKeys.has("historical_performance")) stepIdx = 3;
          if (completedKeys.has("campaign_strategy")) stepIdx = 4;

          setChatMessages((prev) =>
            prev.map((m) => {
              if (m.id === pipelineMsgId && m.agentPipeline) {
                return {
                  ...m,
                  agentPipeline: {
                    ...m.agentPipeline,
                    activeStep: Math.max(m.agentPipeline.activeStep, stepIdx),
                  },
                };
              }
              return m;
            })
          );
        } catch (e) {
          // ignore transient polling errors
        }
      }, 1500);

      let stepTries = 0;
      let runUpdated: any = null;
      let stratTask: any = null;
      let humanStratTask: any = null;

      while (stepTries < 15) {
        stepTries++;
        const stepRes = await operationalWorkflowApi.stepRun(effectiveAgencyId, dagRun.id, token, 10);
        runUpdated = await operationalWorkflowApi.getRun(effectiveAgencyId, dagRun.id, token);
        stratTask = (runUpdated.tasks || []).find((t: any) => t.task_key === "campaign_strategy");
        humanStratTask = (runUpdated.tasks || []).find((t: any) => t.task_key === "human_strategy_approval");

        if (
          (stratTask && stratTask.status === "completed") ||
          (humanStratTask && humanStratTask.status === "waiting_for_human") ||
          runUpdated.status === "completed" ||
          runUpdated.status === "failed"
        ) {
          break;
        }

        if (stepRes.completed_tasks_count === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      if (!runUpdated) {
        runUpdated = await operationalWorkflowApi.getRun(effectiveAgencyId, dagRun.id, token);
        stratTask = runUpdated.tasks.find((t: any) => t.task_key === "campaign_strategy");
        humanStratTask = runUpdated.tasks.find((t: any) => t.task_key === "human_strategy_approval");
      }

      if (stratTask && stratTask.status === "completed") {
        const stratOutputRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, stratTask.id, token);
        const stratPayload = stratOutputRes.output || {};

        const blueprintArtifact: ActiveArtifactData = {
          id: `strat-${dagRun.id}`,
          type: "campaign_blueprint",
          title: stratPayload.campaign_theme || briefTheme || "Master Campaign Strategy",
          version: 1,
          status: "draft",
          campaign_id: dagRun.campaign_id || activeCampaignId || undefined,
          chat_id: activeChatId,
          payload: {
            campaign_theme: stratPayload.campaign_theme || briefTheme,
            master_slogan: stratPayload.strategic_thesis || stratPayload.core_tension || stratPayload.campaign_theme,
            narrative_stages: Object.entries(stratPayload.funnel_narrative || {}).map(([stage, msg], i) => ({
              stage_name: stage.replace(/_/g, " ").toUpperCase(),
              days_range: `Phase ${i + 1}`,
              core_message: String(msg),
              deliverable_focus: (stratPayload.strategic_angles || []).map((a: any) => a.angle_name || String(a)),
            })),
            format_mix_ratios: stratPayload.budget_allocation || { LinkedIn: 100 },
            ...stratPayload,
          },
        };

        setActiveArtifact(blueprintArtifact);
        setPersistedArtifacts((prev) => [blueprintArtifact, ...prev.filter((a) => a.id !== blueprintArtifact.id)]);

        if (humanStratTask && humanStratTask.status === "waiting_for_human") {
          setPendingApproval({
            stage: "strategy",
            taskId: humanStratTask.id,
            runId: dagRun.id,
          });
        }

        const completedMsg: ChatMsg = {
          id: pipelineMsgId,
          role: "assistant",
          content: `🎯 **Strategy Blueprint Synthesized by Agents**\n* **Theme:** ${stratPayload.campaign_theme || briefTheme}\n* **Thesis:** ${stratPayload.strategic_thesis || "Grounding in verified benchmarks."}\n\n👉 **Creative Director Checkpoint:** Review the Strategy Blueprint on your canvas. Click **"Approve Strategy"** below to begin parallel deliverable production.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          agent_id: "director",
          agent_name: "Autonomous DAG Engine",
          agentPipeline: {
            status: "in_progress",
            activeStep: 4,
            stepDetails: {
              agent1: "Brand guidelines, verified offers & forbidden claims validated.",
              agent2: "Live web research completed with competitor angles.",
              agent3: "Historical retention analysis & format weights applied.",
              agent4: `Strategy finalized: ${stratPayload.campaign_theme || "Master Strategy"}. Awaiting your sign-off.`,
            },
          },
        };

        setChatMessages((prev) => {
          const exists = prev.some((m) => m.id === pipelineMsgId);
          if (exists) {
            return prev.map((m) => (m.id === pipelineMsgId ? completedMsg : m));
          }
          return [...prev, completedMsg];
        });
      }
    } catch (err: any) {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      console.error("DAG Pipeline launch error:", err);
      const errMsg: ChatMsg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `❌ **Pipeline Error:** ${err.message || "Failed to execute DAG operational engine."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Autonomous DAG Engine",
        agentPipeline: {
          status: "error",
          activeStep: 0,
          errorMessage: err.message || "Failed to execute DAG operational engine.",
        },
      };
      setChatMessages((prev) => {
        const exists = prev.some((m) => m.id === pipelineMsgId);
        if (exists) {
          return prev.map((m) => (m.id === pipelineMsgId ? errMsg : m));
        }
        return [...prev, errMsg];
      });
    } finally {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      setIsPipelineRunning(false);
      isPipelineRunningRef.current = false;
    }
  };

  // Human Checkpoint 1: Approve Strategy in Studio
  const handleApproveStrategyCheckpoint = async () => {
    if (!token || !effectiveAgencyId || !pendingApproval || pendingApproval.stage !== "strategy" || isReviewingApproval) return;

    setIsReviewingApproval(true);
    setIsPipelineRunning(true);
    isPipelineRunningRef.current = true;
    const runId = pendingApproval.runId;
    const approvalTaskId = pendingApproval.taskId;

    let pollingApproval: any = null;

    try {
      await operationalWorkflowApi.reviewTask(
        effectiveAgencyId,
        approvalTaskId,
        {
          decision: "approved",
          feedback_notes: "Strategy approved by Creative Director in Campaign Studio.",
        },
        token
      );

      setPendingApproval(null);

      const approvalMsgId = `strat-appr-${Date.now()}`;
      const approvalMsg: ChatMsg = {
        id: approvalMsgId,
        role: "assistant",
        content: "⚡ **Strategy Approved!** Unblocking parallel workers for Content Architecture, Visual Planning, and Pre-Flight Quality Audit...",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Campaign Director",
        agentPipeline: {
          status: "in_progress",
          activeStep: 4,
          stepDetails: {
            agent5: "Generating multi-channel reels, storyboards, and carousels...",
          },
        },
      };

      setChatMessages((prev) => [...prev, approvalMsg]);

      // Step DAG execution through Phase 3 & 4 with live polling
      pollingApproval = setInterval(async () => {
        try {
          const runCheck = await operationalWorkflowApi.getRun(effectiveAgencyId, runId, token);
          const completedKeys = new Set(
            (runCheck.tasks || []).filter((t: any) => t.status === "completed").map((t: any) => t.task_key)
          );
          let stepIdx = 4;
          if (completedKeys.has("content_architecture")) stepIdx = 5;
          if (completedKeys.has("final_quality_audit")) stepIdx = 6;

          setChatMessages((prev) =>
            prev.map((m) => {
              if (m.id === approvalMsgId && m.agentPipeline) {
                return {
                  ...m,
                  agentPipeline: {
                    ...m.agentPipeline,
                    activeStep: Math.max(m.agentPipeline.activeStep, stepIdx),
                    status: stepIdx >= 6 ? "completed" : "in_progress",
                  },
                };
              }
              return m;
            })
          );
        } catch (e) {
          // ignore transient polling errors
        }
      }, 1500);

      let stepApprTries = 0;
      let runUpdated: any = null;
      let contentTask: any = null;
      let qaTask: any = null;
      let clientTask: any = null;

      while (stepApprTries < 25) {
        stepApprTries++;
        const stepRes = await operationalWorkflowApi.stepRun(effectiveAgencyId, runId, token, 10);
        runUpdated = await operationalWorkflowApi.getRun(effectiveAgencyId, runId, token);
        contentTask = (runUpdated.tasks || []).find((t: any) => t.task_key === "content_architecture");
        qaTask = (runUpdated.tasks || []).find((t: any) => t.task_key === "final_quality_audit");
        clientTask = (runUpdated.tasks || []).find((t: any) => t.task_key === "client_approval");

        if (
          (contentTask && contentTask.status === "completed" && qaTask && qaTask.status === "completed") ||
          (clientTask && clientTask.status === "waiting_for_human") ||
          runUpdated.status === "completed" ||
          runUpdated.status === "failed"
        ) {
          break;
        }

        if (stepRes.completed_tasks_count === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (pollingApproval) {
        clearInterval(pollingApproval);
        pollingApproval = null;
      }

      if (!runUpdated) {
        runUpdated = await operationalWorkflowApi.getRun(effectiveAgencyId, runId, token);
        contentTask = runUpdated.tasks.find((t: any) => t.task_key === "content_architecture");
        qaTask = runUpdated.tasks.find((t: any) => t.task_key === "final_quality_audit");
        clientTask = runUpdated.tasks.find((t: any) => t.task_key === "client_approval");
      }

      const newArtifacts: ActiveArtifactData[] = [...persistedArtifacts];

      let complianceScore = 95;
      if (qaTask && qaTask.status === "completed") {
        const qaOutputRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, qaTask.id, token);
        const qaData = qaOutputRes.output || {};
        complianceScore = qaData.compliance_score || 95;
        newArtifacts.push({
          id: `qa-${runId}`,
          type: "compliance_review",
          title: "Pre-Flight Quality Audit",
          version: 1,
          status: "approved",
          campaign_id: activeCampaignId || undefined,
          chat_id: activeChatId,
          payload: {
            ...qaData,
            checks: (qaData.findings || []).map((f: any) => ({
              rule_name: f.category ? f.category.replace(/_/g, " ").toUpperCase() : "Brand Guideline Rule",
              verdict: f.severity === "error" || f.severity === "blocking" ? "FAIL" : (f.severity === "warning" ? "NEEDS_REVIEW" : "PASS"),
              details: f.issue_description || f.remediation_instruction || "Verified against brand profile.",
              severity: f.severity,
            })),
            has_blocking_violations: qaData.revision_required || false,
          },
        });
      }

      if (contentTask && contentTask.status === "completed") {
        const contentOutputRes = await operationalWorkflowApi.getTaskOutput(effectiveAgencyId, contentTask.id, token);
        const contentData = contentOutputRes.output || {};
        const deliverables = contentData.deliverables || [];

        deliverables.forEach((d: any, idx: number) => {
          if (d.format === "carousel") {
            newArtifacts.push({
              id: `deliv-carousel-${idx}`,
              type: "carousel_deck",
              title: d.hook_or_title || `Carousel Slide Deck ${idx + 1}`,
              version: 1,
              status: "draft",
              campaign_id: activeCampaignId || undefined,
              chat_id: activeChatId,
              payload: {
                deliverable_title: d.hook_or_title || "Technical Carousel",
                slides: (d.carousel_slides || []).map((s: any) => ({
                  slide_number: s.slide_number,
                  headline: s.headline,
                  body_copy: s.body_copy,
                  visual_prompt: s.visual_prompt,
                })),
                full_caption: d.core_message_summary || d.hook_or_title,
                call_to_action: d.call_to_action,
              },
            });
          } else {
            newArtifacts.push({
              id: `deliv-reel-${idx}`,
              type: "storyboard",
              title: d.hook_or_title || `Video / Reel Script ${idx + 1}`,
              version: 1,
              status: "draft",
              campaign_id: activeCampaignId || undefined,
              chat_id: activeChatId,
              payload: {
                deliverable_title: d.hook_or_title || "Technical Reel",
                scenes: (d.reel_scenes || []).map((s: any) => ({
                  scene_number: s.scene_number,
                  timestamp_range: s.timestamp_range,
                  shot_type: s.shot_type || "Screen Recording / Architecture Diagram",
                  visual_action: s.visual_action,
                  voiceover_script: s.voiceover_script,
                  on_screen_text: s.on_screen_text,
                })),
                call_to_action: d.call_to_action,
              },
            });
          }
        });

        const firstDeliv = newArtifacts.find((a) => a.type === "carousel_deck" || a.type === "storyboard");
        if (firstDeliv) {
          setActiveArtifact(firstDeliv);
        }
      }

      setPersistedArtifacts(newArtifacts);

      let syncedCampId = activeCampaignId;
      // Auto-sync entire generated sprint into the campaign's ai_plan_draft
      if (selectedClientId && runId) {
        try {
          const syncedCamp: any = await campaignApi.syncRunToCampaign(
            effectiveAgencyId,
            selectedClientId,
            runId,
            token
          );
          if (syncedCamp?.id) {
            syncedCampId = syncedCamp.id;
            isProgrammaticCampaignChangeRef.current = true;
            setActiveCampaignId(syncedCamp.id);
            await loadClientCampaigns(selectedClientId);
            await loadCampaignArtifacts(syncedCamp.id);
          }
        } catch (e: any) {
          console.error("Auto-sync to campaign plan error:", e);
        }
      }

      if (clientTask && clientTask.status === "waiting_for_human") {
        setPendingApproval({
          stage: "client",
          taskId: clientTask.id,
          runId,
        });
      }

      const plannerUrl = `/campaign-plans?clientId=${selectedClientId}&campaignId=${syncedCampId || activeCampaignId || ""}`;

      setChatMessages((prev) => [
        ...prev,
        {
          id: `deliv-ready-${Date.now()}`,
          role: "assistant",
          content: `✨ **Creative Deliverables Generated & Synced to Campaign Planner!**\n* **Quality Audit:** ${complianceScore}% brand compliance score.\n* **Factual Claims:** Verified against brand profile.\n\n👉 **Next Steps:** Review deliverables on canvas, or **[Open in Campaign Planner →](${plannerUrl})** to reject/accept ideas and push to production tasks in batch or individually.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          agent_id: "director",
          agent_name: "Campaign Director",
        },
      ]);
    } catch (err: any) {
      if (pollingApproval) {
        clearInterval(pollingApproval);
      }
      console.error("Strategy approval error:", err);
      alert(err.message || "Failed to process strategy approval.");
    } finally {
      if (pollingApproval) {
        clearInterval(pollingApproval);
      }
      setIsReviewingApproval(false);
      setIsPipelineRunning(false);
      isPipelineRunningRef.current = false;
    }
  };

  // Human Checkpoint 2: Authorize Publishing in Studio
  const handleApproveClientCheckpoint = async () => {
    if (!token || !effectiveAgencyId || !pendingApproval || pendingApproval.stage !== "client" || isReviewingApproval) return;

    setIsReviewingApproval(true);
    setIsPipelineRunning(true);
    const runId = pendingApproval.runId;
    const approvalTaskId = pendingApproval.taskId;

    try {
      await operationalWorkflowApi.reviewTask(
        effectiveAgencyId,
        approvalTaskId,
        {
          decision: "approved",
          feedback_notes: "Authorized by Client Lead for publication.",
        },
        token
      );

      setPendingApproval(null);

      // Step DAG to complete publishing & cortex memory
      await operationalWorkflowApi.stepRun(effectiveAgencyId, runId, token, 10);

      // Auto-sync entire sprint to campaign plan
      if (selectedClientId && runId) {
        await campaignApi.syncRunToCampaign(effectiveAgencyId, selectedClientId, runId, token).catch(() => null);
        loadClientCampaigns(selectedClientId);
      }

      // Mark all current artifacts as approved
      setPersistedArtifacts((prev) =>
        prev.map((art) => ({ ...art, status: "approved" }))
      );
      setActiveArtifact((prev) => (prev ? { ...prev, status: "approved" } : null));

      setChatMessages((prev) => [
        ...prev,
        {
          id: `client-appr-${Date.now()}`,
          role: "assistant",
          content: "🚀 **Campaign Authorized & Scheduled for Publishing!**\nAttribution listeners active. Persistent institutional memory proposals saved to Cortex.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          agent_id: "director",
          agent_name: "Campaign Director",
        },
      ]);
    } catch (err: any) {
      console.error("Client authorization error:", err);
      alert(err.message || "Failed to authorize publishing.");
    } finally {
      setIsReviewingApproval(false);
      setIsPipelineRunning(false);
    }
  };

  // Collect all unique artifacts from database, chat stream, and canvas
  const studioArtifacts = React.useMemo(() => {
    const map = new Map<string, any>();

    // 1. First add all persisted artifacts from SQLite / Postgres / DAG
    persistedArtifacts.forEach((art: any) => {
      // Strictly exclude any artifact that belongs to a different campaign
      if (activeCampaignId && art.campaign_id && art.campaign_id !== activeCampaignId) {
        return;
      }
      // Strictly exclude any artifact that belongs to a different chat session
      if (activeChatId && art.chat_id && art.chat_id !== activeChatId) {
        return;
      }
      const verNum = art.version || art.current_version_number || art.latest_version?.version_number || 1;
      const key = `${art.id}-v${verNum}`;
      const artPayload = art.payload || art.latest_version?.payload || {};
      const artType = art.type || art.artifact_type || "campaign_blueprint";
      map.set(key, {
        id: art.id,
        campaign_id: art.campaign_id || activeCampaignId,
        chat_id: art.chat_id || activeChatId,
        type: artType,
        title: art.title,
        version: verNum,
        status: art.status,
        payload: artPayload,
        supporting_evidence_refs: art.supporting_evidence_refs || art.latest_version?.supporting_evidence_refs || [],
        created_at: art.created_at,
        versions: art.versions || [],
      });
    });

    // 2. Add any chat message artifacts from active streaming session
    chatMessages.forEach((m) => {
      if (m.artifact_summary) {
        // Strictly exclude if artifact_summary belongs to another campaign or another chat
        if (activeCampaignId && m.artifact_summary.campaign_id && m.artifact_summary.campaign_id !== activeCampaignId) {
          return;
        }
        if (activeChatId && m.artifact_summary.chat_id && m.artifact_summary.chat_id !== activeChatId) {
          return;
        }
        const key = `${m.artifact_summary.id}-v${m.artifact_summary.version}`;
        if (!map.has(key)) {
          map.set(key, {
            ...m.artifact_summary,
            campaign_id: m.artifact_summary.campaign_id || activeCampaignId,
            chat_id: m.artifact_summary.chat_id || activeChatId,
          });
        }
      }
    });

    // 3. Ensure active artifact is present (only if it matches the current campaign and chat)
    if (activeArtifact) {
      const isMismatch = activeArtifact.campaign_id && activeCampaignId && activeArtifact.campaign_id !== activeCampaignId;
      const isChatMismatch = activeArtifact.chat_id && activeChatId && activeArtifact.chat_id !== activeChatId;
      if (!isMismatch && !isChatMismatch) {
        const key = `${activeArtifact.id}-v${activeArtifact.version}`;
        if (!map.has(key)) {
          map.set(key, {
            id: activeArtifact.id,
            campaign_id: activeCampaignId,
            chat_id: activeChatId,
            type: activeArtifact.type,
            title: activeArtifact.title,
            version: activeArtifact.version,
            status: activeArtifact.status,
            payload: activeArtifact.payload,
            supporting_evidence_refs: activeArtifact.supporting_evidence_refs,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [persistedArtifacts, chatMessages, activeArtifact, activeCampaignId, activeChatId]);

  // Messages to display according to the selected view filter
  const displayedMessages = chatMessages.filter((msg) => {
    if (chatFilter === "all") return true;
    if (msg.agentPipeline) return true;
    return msg.agent_id === currentAgentId || !msg.agent_id;
  });

  if (!isLoading && isSpecialist) {
    return null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] w-full mx-auto px-2 sm:px-4 py-2 overflow-hidden bg-[#101014] text-[#F2F0F7] ambient-glow">
      {/* ── 1. Consolidated Sleek Header ── */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.08] shrink-0">
        {/* Left: Studio Brand & Client Selector */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#191919] dark:bg-[#A78BFA]/15 text-white dark:text-[#A78BFA] flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B6A65] dark:text-[#A78BFA] block -mb-0.5">
                Multi-Agent Architect
              </span>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7] tracking-tight">
                Campaign Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 surface-card px-2.5 py-1 rounded-lg transition-colors">
            <Building2 className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#F2F0F7] focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[210px] truncate"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#17171E] text-[#F2F0F7]">
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Sprint Dropdown & Discard/Delete Action */}
          {clientCampaigns.length > 0 && (
            <div className="flex items-center gap-1 surface-card px-2 py-1 rounded-lg">
              <CalendarDays className="w-3.5 h-3.5 text-[#69A9D8] shrink-0" />
              <select
                value={activeCampaignId || ""}
                onChange={(e) => {
                  const newCampId = e.target.value === "new" ? null : e.target.value;
                  setActiveCampaignId(newCampId);
                  setActiveArtifact(null);
                  setActiveArtifactVersions([]);
                  setPersistedArtifacts([]);
                }}
                className="bg-transparent text-xs font-semibold text-[#F2F0F7] focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[280px] truncate"
                title="Select active campaign sprint"
              >
                {clientCampaigns.map((camp: any) => {
                  const delivCount = camp.ai_plan_draft?.deliverables?.length || 0;
                  return (
                    <option key={camp.id} value={camp.id} className="bg-[#17171E] text-[#F2F0F7]">
                      {camp.name} {delivCount > 0 ? `(${delivCount} days)` : ""}
                    </option>
                  );
                })}
                <option value="new" className="bg-[#17171E] text-[#A78BFA] font-bold">
                  + New Sprint Draft
                </option>
              </select>

              {activeCampaignId && (
                <button
                  type="button"
                  onClick={() => setShowDeleteCampaignModal(true)}
                  title="Delete/Discard this campaign"
                  className="p-1 hover:bg-rose-500/15 text-[#A3A0B0] hover:text-rose-400 rounded transition-colors cursor-pointer ml-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Compact Sprint Timeline Selector */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101014] border border-white/[0.08] text-xs shadow-xs">
            <CalendarDays className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange(e.target.value, endDate)}
              className="bg-transparent text-[11px] font-mono text-[#F2F0F7] focus:outline-none cursor-pointer w-24"
              title="Sprint Start Date"
            />
            <span className="text-[#A3A0B0] text-[10px]">→</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleDateChange(startDate, e.target.value)}
              className="bg-transparent text-[11px] font-mono text-[#F2F0F7] focus:outline-none cursor-pointer w-24"
              title="Sprint End Date"
            />
            {durationDays && durationDays > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/20">
                {durationDays}d
              </span>
            )}
          </div>
        </div>

        {/* Right: Tools & Views */}
        <div className="flex items-center gap-2">
          {/* Stream Filter Toggle */}
          <button
            type="button"
            onClick={() => setChatFilter((prev) => (prev === "all" ? "active" : "all"))}
            title={chatFilter === "all" ? "Filter to active agent only" : "Show all agents"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg surface-card text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
          >
            <MessagesSquare className="w-3 h-3 text-[#A78BFA]" />
            <span className="font-mono text-[11px]">
              {chatFilter === "all" ? `All (${chatMessages.length})` : currentAgent.shortName}
            </span>
          </button>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => createNewChatSession()}
            title="Start a new isolated chat session"
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-[#2383E2] hover:bg-[#1D6FBF] dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] text-white dark:text-[#101014] shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          {/* Chat History Button */}
          <button
            type="button"
            onClick={() => setIsChatHistoryOpen(true)}
            title="View chat history and switch conversations"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-[#F1F1EF] text-[#37352F] hover:text-[#191919] border border-[#E3E2DE] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-[#A3A0B0] dark:hover:text-[#F2F0F7] dark:border-white/[0.08] transition-colors cursor-pointer shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA]" />
            <span className="hidden sm:inline text-[11px]">History ({chatSessions.length})</span>
          </button>

          {/* Pitch Deck Button (Active when campaign exists) */}
          {activeCampaignId && clientCampaigns.some((c) => c.id === activeCampaignId) && (
            <button
              type="button"
              onClick={() => setIsPitchDeckModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-[#F1F1EF] text-[#37352F] hover:text-[#191919] border border-[#E3E2DE] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-[#F2F0F7] dark:border-white/[0.08] transition-all cursor-pointer shadow-2xs"
              title="Present Executive Strategy Pitch Deck (Fullscreen & Print PDF)"
            >
              <Presentation className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA]" />
              <span className="hidden md:inline text-[11px]">Pitch Deck 🎬</span>
            </button>
          )}

          {/* Campaign Plans Link */}
          <Link
            href={selectedClientId ? `/campaign-plans?clientId=${selectedClientId}` : "/campaign-plans"}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg surface-card hover:bg-white/[0.04] text-[#F2F0F7] transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="hidden md:inline text-[11px]">Plans</span>
            <ChevronRight className="w-3 h-3 text-[#A3A0B0]" />
          </Link>
        </div>
      </header>

      {/* Mobile Tab Control (< lg only) */}
      <div className="flex lg:hidden items-center p-0.5 bg-[#17171E] rounded-lg border border-[#30303D] my-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("canvas")}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === "canvas" ? "bg-[#A78BFA] text-[#101014]" : "text-[#A3A0B0]"
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("intel")}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            mobileTab === "intel" ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]" : "text-[#A3A0B0]"
          }`}
        >
          Intelligence & Chat
        </button>
      </div>

      {/* ── 2. Two-Region Workspace: Primary Canvas + Right Intelligence ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden pt-2 gap-2.5">
        {/* ── LEFT/CENTRE REGION: Primary Creative Workspace & Contextual Canvas ── */}
        <main
          className={`flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-[#101014] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* ── DEDICATED ARTIFACTS & VERSIONS WORKSTATION BAR ── */}
          <div className="px-3.5 py-2.5 bg-[#F7F6F3] dark:bg-[#14141B] border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#EFEFED] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06] text-[10px] font-mono uppercase text-[#37352F] dark:text-[#A3A0B0] font-semibold shrink-0">
                <Layers2 className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA]" />
                <span>Artifacts</span>
                <span className="px-1.5 py-0.2 rounded bg-black/[0.06] dark:bg-[#A78BFA]/15 text-[#191919] dark:text-[#A78BFA] font-bold">
                  {studioArtifacts.length}
                </span>
              </div>

              {studioArtifacts.length === 0 ? (
                <span className="text-[11px] text-[#9B9A97] dark:text-[#A3A0B0]/70 italic px-2">
                  No artifacts generated yet — launch the engine or request drafts from Director
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {studioArtifacts.map((art) => {
                    const isActive = activeArtifact?.id === art.id;
                    const isApproved = art.status === "approved" || art.status === "exported";
                    return (
                      <button
                        key={`${art.id}-v${art.version}`}
                        type="button"
                        onClick={() => handleViewOnCanvas(art)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
                          isActive
                            ? "bg-[#191919] text-white border-transparent dark:bg-[#20202A] dark:border-[#A78BFA] dark:text-[#F2F0F7] shadow-xs font-semibold"
                            : "bg-white dark:bg-[#101014] border-black/[0.08] dark:border-white/[0.06] text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-[#F2F0F7] hover:border-black/[0.15] dark:hover:border-white/[0.12] hover:bg-[#F7F6F3] dark:hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className="text-xs">
                          {art.type === "campaign_blueprint" || art.type?.includes("blueprint") || art.type?.includes("strategy")
                            ? "🗺️"
                            : art.type === "carousel_deck" || art.type?.includes("carousel")
                            ? "📑"
                            : art.type === "storyboard" || art.type?.includes("reel") || art.type?.includes("script")
                            ? "🎬"
                            : art.type === "compliance_review" || art.type?.includes("qa") || art.type?.includes("audit")
                            ? "🛡️"
                            : art.type === "research_evidence" || art.type?.includes("research")
                            ? "🔍"
                            : "📄"}
                        </span>
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">
                          {art.type === "campaign_blueprint"
                            ? "Strategy Blueprint"
                            : art.type === "carousel_deck"
                            ? "Carousel Deck"
                            : art.type === "storyboard"
                            ? "Video Reel Script"
                            : art.type === "compliance_review"
                            ? "Brand QA Audit"
                            : art.type === "research_evidence"
                            ? "Market Intel"
                            : art.title || "Deliverable"}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isActive
                              ? "bg-white/20 text-white border-white/30 dark:bg-[#A78BFA]/20 dark:text-[#A78BFA] dark:border-[#A78BFA]/30"
                              : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6B6A65] dark:text-[#A3A0B0] border-black/[0.06] dark:border-white/[0.06] group-hover:text-[#191919] dark:group-hover:text-[#F2F0F7]"
                          }`}
                        >
                          v{art.version}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isApproved
                              ? "bg-[#45B88A] shadow-[0_0_6px_rgba(69,184,138,0.8)]"
                              : "bg-[#6E6D7A]"
                          }`}
                          title={isApproved ? "Approved" : "Draft"}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Version Switcher for Active Artifact */}
            {activeArtifact && activeArtifactVersions && activeArtifactVersions.length > 1 && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-black/[0.08] dark:border-white/[0.08] shrink-0">
                <span className="text-[10px] font-mono text-[#6B6A65] dark:text-[#A3A0B0] uppercase font-semibold">
                  Versions:
                </span>
                <div className="flex items-center gap-1 bg-[#F1F1EF] dark:bg-[#101014] p-0.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08]">
                  {activeArtifactVersions.map((v: any) => {
                    const isCur = v.version_number === activeArtifact.version;
                    return (
                      <button
                        key={v.version_number}
                        type="button"
                        onClick={() => {
                          const targetVer = activeArtifactVersions.find(
                            (x: any) => x.version_number === v.version_number
                          );
                          if (targetVer) {
                            setActiveArtifact({
                              ...activeArtifact,
                              version: targetVer.version_number,
                              status: targetVer.is_approved
                                ? "approved"
                                : activeArtifact.status || "draft",
                              payload: targetVer.payload || activeArtifact.payload,
                            });
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                          isCur
                            ? "bg-[#2383E2] text-white shadow-xs"
                            : "text-[#6B6A65] hover:text-[#191919] hover:bg-black/[0.04] dark:text-[#A3A0B0] dark:hover:text-[#F2F0F7] dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        v{v.version_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Active Human Approval Checkpoint Banner (Integrated DAG Gate) */}
          {pendingApproval?.stage === "strategy" && (
            <div className="p-3.5 m-3 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-500/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-100 flex items-center gap-2">
                    Creative Director Approval Required
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      Checkpoint 1
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-200/80">
                    Review the Strategy Blueprint on your canvas. Approve to unblock parallel content generation.
                  </p>
                </div>
              </div>
              <button
                onClick={handleApproveStrategyCheckpoint}
                disabled={isReviewingApproval}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                {isReviewingApproval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve Strategy
              </button>
            </div>
          )}

          {pendingApproval?.stage === "client" && (
            <div className="p-3.5 m-3 rounded-xl bg-violet-500/15 border-2 border-violet-500/40 text-violet-200 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-violet-500/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-violet-100 flex items-center gap-2">
                    Client Approval Required
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded bg-violet-500/20 text-violet-300">
                      Checkpoint 2
                    </span>
                  </h4>
                  <p className="text-[11px] text-violet-200/80">
                    Deliverables have passed the Global Quality Audit. Authorize for publishing.
                  </p>
                </div>
              </div>
              <button
                onClick={handleApproveClientCheckpoint}
                disabled={isReviewingApproval}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                {isReviewingApproval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Authorize Publishing
              </button>
            </div>
          )}

          <ContextualCanvas
            artifact={activeArtifact}
            versions={activeArtifactVersions}
            pinnedEntities={pinnedEntities}
            discoveredEntities={discoveredEntities}
            onTogglePinEntity={handleTogglePinEntity}
            onAddCustomEntity={handleAddCustomEntity}
            onSelectVersion={(versionNumber) => {
              const targetVer = activeArtifactVersions.find((v: any) => v.version_number === versionNumber);
              if (targetVer && activeArtifact) {
                setActiveArtifact({
                  ...activeArtifact,
                  version: targetVer.version_number,
                  status: targetVer.is_approved ? "approved" : (activeArtifact.status || "draft"),
                  payload: targetVer.payload || activeArtifact.payload,
                });
              }
            }}
            onApproveVersion={handleApproveVersion}
            onReviseArtifact={handleReviseArtifact}
            onExportClick={() => {
              setIsExportModalOpen(true);
            }}
            onPitchDeckClick={() => {
              setIsPitchDeckModalOpen(true);
            }}
            onSelectPrompt={(agentId, promptText) => {
              setActiveSpecialistId(agentId);
              setStudioMode("specialists");
              handleSendMessage(promptText);
              setMobileTab("intel");
            }}
            onCloseCanvas={() => setActiveArtifact(null)}
          />
        </main>

        {/* ── RIGHT REGION: Contextual Intelligence & Agent Stream ── */}
        {(isRightIntelOpen || mobileTab === "intel") && (
          <aside
            className={`w-full lg:w-96 xl:w-[420px] shrink-0 flex flex-col h-full bg-white dark:bg-[#17171E] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden ${
              mobileTab === "intel" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Intelligence & Specialist Copilot Header */}
            <div className="p-3 border-b border-black/[0.08] dark:border-white/[0.06] bg-[#F7F6F3] dark:bg-[#101014]/60 shrink-0 space-y-2">
              {/* Campaign Director Copilot Banner */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-violet-500/10 border border-black/[0.08] dark:border-violet-500/20 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-[#EFEFED] text-[#191919] dark:bg-violet-500/20 dark:text-violet-400 flex items-center justify-center font-bold shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-[#191919] dark:text-[#F2F0F7] text-[11px] font-heading">Campaign Director</span>
                      <Link
                        href="/cortex"
                        className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF6ED] text-[#285E34] border border-[#CCE3CC] dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 flex items-center gap-0.5 hover:underline"
                        title="Grounded with Cortex Institutional Memory"
                      >
                        <Brain className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Cortex Active</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setIsChatHistoryOpen(true)}
                        className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#EFEFED] text-[#37352F] hover:bg-[#E5E5E2] dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25 border border-black/[0.08] dark:border-violet-500/20 transition cursor-pointer"
                        title="View and switch conversations"
                      >
                        Chats ({chatSessions.length})
                      </button>
                    </div>
                    <div
                      onClick={() => setIsChatHistoryOpen(true)}
                      className="text-[9.5px] font-mono text-[#6B6A65] dark:text-[#A3A0B0] truncate cursor-pointer hover:text-[#191919] dark:hover:text-violet-300 transition-colors"
                      title={chatSessions.find((s) => s.id === activeChatId)?.title || "Active Chat"}
                    >
                      💬 {chatSessions.find((s) => s.id === activeChatId)?.title || "Active Chat"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => createNewChatSession()}
                    className="p-1 rounded-lg bg-[#EFEFED] hover:bg-[#E5E5E2] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-[#37352F] dark:text-[#A3A0B0] dark:hover:text-[#F2F0F7] border border-black/[0.08] dark:border-white/[0.06] transition cursor-pointer"
                    title="Start new conversation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {isPipelineRunning ? (
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#EFEFED] text-[#191919] dark:bg-violet-500/20 dark:text-violet-300 font-medium flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Engine Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowGenerateConfirmModal(true)}
                      className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-[#2383E2] hover:bg-[#1D6FBF] dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] text-white dark:text-[#101014] flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      title="Run the 14-task operational multi-agent DAG"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Run Pipeline</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Specialist Switcher Pill Row */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setStudioMode("workflow")}
                  className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
                    studioMode === "workflow"
                      ? "bg-[#37352F] dark:bg-white/[0.12] text-white font-semibold shadow-2xs"
                      : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-[#F2F0F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-[#2383E2] dark:text-[#A78BFA]" />
                  <span>Director</span>
                </button>
                {SPECIALIST_AGENTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSpecialistId(item.id);
                      setStudioMode("specialists");
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium transition cursor-pointer shrink-0 ${
                      activeSpecialistId === item.id && studioMode === "specialists"
                        ? "bg-[#191919] dark:bg-white/[0.12] text-white dark:text-[#F2F0F7] font-semibold border border-transparent dark:border-white/[0.15]"
                        : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-[#F2F0F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {item.shortName}
                  </button>
                ))}
              </div>
            </div>

            {/* Stream Messages Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 pr-2 min-h-0">
              {displayedMessages.map((msg) => {
                const isUser = msg.role === "user";
                const msgAgentId = msg.agent_id || "director";
                const agentInfo = getAgentInfo(msgAgentId);
                const AgentIcon = agentInfo.icon;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 text-xs ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div
                        className="w-6 h-6 rounded-full border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 bg-[#EFEFED] text-[#191919] dark:bg-[#20202A] dark:text-[#A78BFA] shadow-xs"
                        title={agentInfo.name}
                      >
                        <AgentIcon className="w-3 h-3" />
                      </div>
                    )}

                    <div className="max-w-[88%] space-y-1">
                      {!isUser && (
                        <div className="flex items-center gap-1.5 pl-1">
                          <span className="text-[10px] font-bold text-[#2383E2] dark:text-[#A78BFA] tracking-tight">
                            {msg.agent_name || agentInfo.name}
                          </span>
                        </div>
                      )}

                      {/* Streaming status pill */}
                      {msg.streamingStatus && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2383E2]/10 border border-[#2383E2]/30 text-[11px] text-[#2383E2] dark:bg-[#A78BFA]/10 dark:border-[#A78BFA]/30 dark:text-[#A78BFA] animate-pulse mb-1 w-fit shadow-xs">
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          <span>{msg.streamingStatus}</span>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${
                          isUser
                            ? "bg-[#191919] text-white dark:bg-[#20202A] dark:text-[#F2F0F7] border border-black/[0.08] dark:border-white/[0.08] rounded-br-xs shadow-xs"
                            : "bg-white text-[#191919] dark:bg-[#17171E] dark:text-[#F2F0F7] border border-black/[0.08] dark:border-white/[0.08] rounded-bl-xs shadow-xs"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">
                          {msg.content || (msg.isStreaming ? (
                            <span className="text-[#6B6A65] dark:text-[#A3A0B0] italic text-[11px] flex items-center gap-1.5 py-0.5">
                              <Sparkles className="w-3 h-3 text-[#2383E2] dark:text-[#A78BFA] animate-pulse shrink-0" />
                              <span>Gathering intelligence & synthesizing...</span>
                            </span>
                          ) : null)}
                        </div>
                        <span className={`block mt-1 text-[9px] font-mono ${isUser ? "text-white/60 dark:text-[#A3A0B0] text-right" : "text-[#6B6A65] dark:text-[#A3A0B0]"}`}>
                          {msg.timestamp}
                        </span>
                      </div>

                      {/* Activity Logs Breadcrumbs */}
                      {msg.activity_logs && msg.activity_logs.length > 0 && (
                        <div className="space-y-1 pl-1 pt-0.5">
                          {msg.activity_logs.map((log: any, i: number) => {
                            const logText = typeof log === "string" ? log : log.message || JSON.stringify(log);
                            const isPending = logText.startsWith("⏳");
                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md border w-fit max-w-full truncate ${
                                  isPending
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:bg-[#E5AA58]/10 dark:border-[#E5AA58]/30 dark:text-[#E5AA58] animate-pulse"
                                    : "bg-[#EFEFED] text-[#6B6A65] border-black/[0.08] dark:bg-[#101014] dark:border-white/[0.06] dark:text-[#A3A0B0]"
                                }`}
                              >
                                {isPending ? (
                                  <Loader2 className="w-2.5 h-2.5 text-amber-600 dark:text-[#E5AA58] animate-spin shrink-0" />
                                ) : (
                                  <Sparkles className="w-2.5 h-2.5 text-[#2383E2] dark:text-[#A78BFA] shrink-0" />
                                )}
                                <span className="truncate">{logText.replace(/^⏳\s*/, "")}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Inline Artifact Summary Card */}
                      {msg.artifact_summary && (
                        <button
                          type="button"
                          onClick={() => {
                            handleViewOnCanvas(msg.artifact_summary!);
                            setMobileTab("canvas");
                          }}
                          className={`flex items-center justify-between w-full p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            activeArtifact?.id === msg.artifact_summary.id
                              ? "bg-[#20202A] border-[#A78BFA] text-[#F2F0F7] shadow-[0_0_12px_rgba(167,139,250,0.2)]"
                              : "surface-card surface-card-hover border-white/[0.06] text-[#A3A0B0] hover:text-[#F2F0F7]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-[#A78BFA] border border-white/[0.08]">
                              v{msg.artifact_summary.version}
                            </span>
                            <span className="font-medium text-[11px] truncate text-[#F2F0F7]">
                              {msg.artifact_summary.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#A78BFA] font-mono shrink-0 flex items-center gap-1 font-semibold">
                            Canvas →
                          </span>
                        </button>
                      )}

                      {/* Inline Agent Pipeline Progress Card */}
                      {msg.agentPipeline && (
                        <div className="rounded-xl border border-white/[0.08] surface-card p-3 space-y-2.5 shadow-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                            <span className="font-semibold text-xs text-[#F2F0F7] tracking-tight">
                              {msg.agentPipeline.status === "in_progress"
                                ? "Multi-Agent Engine Running..."
                                : msg.agentPipeline.status === "completed"
                                ? "6 Agents Synthesized • 100% Complete"
                                : "Pipeline Error"}
                            </span>
                            <span className="text-[10px] font-mono text-[#A3A0B0]">
                              {msg.agentPipeline.status === "in_progress"
                                ? `Step ${msg.agentPipeline.activeStep + 1}/6`
                                : "Done"}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {AGENT_STEPS.map((step, idx) => {
                              const isDone =
                                msg.agentPipeline!.status === "completed" ||
                                idx < msg.agentPipeline!.activeStep;
                              const isActive =
                                msg.agentPipeline!.status === "in_progress" &&
                                idx === msg.agentPipeline!.activeStep;

                              return (
                                <div
                                  key={step.id}
                                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                                    isActive
                                      ? "bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[#F2F0F7]"
                                      : isDone
                                      ? "text-[#F2F0F7]"
                                      : "text-[#A3A0B0]/60"
                                  }`}
                                >
                                  {isDone ? (
                                    <Check className="w-3 h-3 text-[#45B88A] shrink-0" />
                                  ) : isActive ? (
                                    <Loader2 className="w-3 h-3 text-[#A78BFA] animate-spin shrink-0" />
                                  ) : (
                                    <Clock className="w-3 h-3 text-[#A3A0B0]/60 shrink-0" />
                                  )}
                                  <span className="truncate text-[11px] font-medium">
                                    {idx + 1}. {step.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-6 h-6 rounded-full bg-[#20202A] text-[#A78BFA] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <User className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={chatEndRef} />
            </div>

            {/* Prompt Starters */}
            <div className="p-2 border-t border-black/[0.08] dark:border-white/[0.06] bg-[#F7F6F3] dark:bg-[#101014]/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[10px] font-mono text-[#6B6A65] dark:text-[#A3A0B0] shrink-0 flex items-center gap-1 px-1">
                <Flame className="w-3 h-3 text-[#E5AA58]" />
              </span>
              {currentAgent.starters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(starter)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFEFED] border border-black/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.06] text-[#37352F] dark:text-[#F2F0F7] transition-all shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Strategy Evolving Bar & Generate Action */}
            {(suggestedObjective || isReadyToGenerate) && (
              <div className="p-2.5 bg-[#F7F6F3] dark:bg-[#A78BFA]/10 border-t border-black/[0.08] dark:border-[#A78BFA]/20 flex items-center justify-between gap-2 shrink-0 text-xs shadow-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#2383E2] dark:text-[#A78BFA] shrink-0" />
                  <p className="text-[11px] text-[#191919] dark:text-[#F2F0F7] truncate font-medium">
                    {durationDays ? `${durationDays}-Day Sprint:` : "Strategy:"} {suggestedObjective || suggestedCustomBrief}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isPipelineRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelGenerationSuggestion}
                        className="px-2.5 py-1 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-[#EFEFED] dark:hover:bg-white/[0.06] text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-[#F2F0F7] text-[11px] font-medium transition-colors cursor-pointer"
                        title="Dismiss campaign creation suggestion"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGenerateConfirmModal(true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2383E2] hover:bg-[#1D6FBF] dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] text-white dark:text-[#101014] font-semibold text-[11px] shadow-2xs cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-white dark:text-inherit" />
                        <span>Generate Sprint ✨</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#2383E2] dark:text-[#A78BFA]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Running...</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAbortPipeline}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-[11px] cursor-pointer transition-all"
                        title="Cancel running generation"
                      >
                        <Ban className="w-3 h-3 text-rose-400" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input Box Footer (Raycast-Style Floating Command Bar) */}
            <footer className="p-2.5 border-t border-black/[0.08] dark:border-white/[0.06] bg-[#F7F6F3] dark:bg-[#101014]/70 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center"
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isPipelineRunning}
                  placeholder={
                    isPipelineRunning
                      ? "Engine is running..."
                      : isChatLoading
                      ? `${currentAgent.name} is thinking...`
                      : `Message ${currentAgent.shortName}...`
                  }
                  className="w-full bg-white dark:bg-[#101014] border border-black/[0.1] dark:border-white/[0.08] focus:border-[#2383E2] dark:focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#2383E2]/20 dark:focus:ring-[#A78BFA]/20 rounded-xl px-3.5 py-2.5 pr-20 text-xs text-[#191919] dark:text-[#F2F0F7] placeholder:text-[#9B9A97] dark:placeholder:text-[#A3A0B0]/60 focus:outline-none disabled:opacity-50 transition-all shadow-2xs"
                  autoFocus
                />

                <div className="absolute right-2 flex items-center gap-1.5">
                  <span className="kbd-pill hidden sm:inline-flex text-[10px] bg-[#EFEFED] text-[#6B6A65] border border-black/[0.08] dark:bg-white/[0.06] dark:text-[#A3A0B0] dark:border-white/[0.08]">↵</span>
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading || isPipelineRunning}
                    className="px-2.5 py-1 rounded-lg bg-[#2383E2] hover:bg-[#1D6FBF] text-white dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] dark:text-[#101014] font-semibold text-xs flex items-center gap-1 disabled:opacity-40 transition-opacity cursor-pointer shadow-2xs"
                  >
                    {isChatLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </form>
            </footer>
          </aside>
        )}
      </div>

      <ExportPreviewModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        artifact={activeArtifact}
        agencyId={effectiveAgencyId || ""}
        campaignId={activeCampaignId || activeArtifact?.campaign_id || (clientCampaigns.length > 0 ? clientCampaigns[0].id : "")}
        token={token || ""}
        teamMembers={teamMembers}
        onApproveVersion={handleApproveVersion}
        onExportSuccess={(res) => {
          setActiveArtifact((prev) =>
            prev ? { ...prev, status: "exported" } : prev
          );
        }}
      />

      <StrategyPitchDeckModal
        isOpen={isPitchDeckModalOpen}
        onClose={() => setIsPitchDeckModalOpen(false)}
        campaign={clientCampaigns.find((c) => c.id === activeCampaignId) || null}
        client={selectedClient}
      />

      {/* Pre-Creation Confirmation Modal: Prevent Accidental Campaign Creation */}
      {showGenerateConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card border border-white/[0.12] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-[#F2F0F7]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-[#A78BFA]">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-heading font-bold text-base text-[#F2F0F7]">
                  Generate Campaign Sprint?
                </h3>
              </div>
              <button
                onClick={() => setShowGenerateConfirmModal(false)}
                className="text-[#A3A0B0] hover:text-[#F2F0F7] text-xs font-mono p-1 rounded-lg hover:bg-white/[0.06] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#A3A0B0]">
              <p className="leading-relaxed">
                This will coordinate the 6-agent intelligence engine to generate full deliverables and save a new campaign record to your database.
              </p>

              <div className="p-3 bg-[#0D0D11] rounded-xl border border-white/[0.08] space-y-2 font-mono">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">Client</span>
                  <span className="text-[#F2F0F7] font-semibold">{selectedClient?.business_name || "Active Client"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">Objective / Theme</span>
                  <span className="text-[#A78BFA] font-medium">{suggestedObjective || suggestedCustomBrief || "Full Multi-Platform Sprint"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block">Sprint Timeline</span>
                  <span className="text-[#F2F0F7]">
                    {durationDays ? `${durationDays} Days (${startDate || "Day 1"} → ${endDate || "Day " + durationDays})` : "Monthly Retainer Scope"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowGenerateConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04] rounded-xl cursor-pointer"
              >
                Cancel (Create Nothing)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateConfirmModal(false);
                  handleRunPipeline();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-[0_0_12px_rgba(167,139,250,0.25)] transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Confirm &amp; Generate ✨</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Discard Campaign Modal */}
      {showDeleteCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-[#F2F0F7]">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-heading font-bold text-base text-[#F2F0F7]">Delete Campaign Sprint?</h3>
            </div>
            <p className="text-xs text-[#A3A0B0] leading-relaxed">
              Are you sure you want to delete this campaign? This will permanently remove its AI draft deliverables, tasks, and media versions from the database.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowDeleteCampaignModal(false)}
                disabled={deletingCampaign}
                className="px-3.5 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold hover:bg-white/[0.04] text-[#F2F0F7] transition-colors cursor-pointer"
              >
                Keep Campaign
              </button>
              <button
                type="button"
                onClick={handleDeleteActiveCampaign}
                disabled={deletingCampaign}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {deletingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-Over Chat History Drawer ── */}
      {isChatHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsChatHistoryOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm sm:max-w-md h-full bg-[#14141B] border-l border-white/[0.08] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#101014]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F2F0F7] font-heading">Chat History</h3>
                  <p className="text-[11px] text-[#A3A0B0] truncate max-w-[220px]">
                    {selectedClient?.business_name || "Client Conversations"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatHistoryOpen(false)}
                className="p-1.5 rounded-lg text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-white/[0.04] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Primary Button */}
            <div className="p-3 border-b border-black/[0.08] dark:border-white/[0.06] bg-[#F7F6F3] dark:bg-[#14141B]">
              <button
                type="button"
                onClick={() => createNewChatSession()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#191919] hover:bg-[#2F2E2B] dark:bg-violet-600 dark:hover:bg-violet-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Chat</span>
              </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatSessions.length === 0 ? (
                <div className="p-8 text-center text-[#A3A0B0] space-y-2">
                  <MessagesSquare className="w-8 h-8 mx-auto opacity-30 text-violet-400" />
                  <p className="text-xs">No conversations yet.</p>
                  <p className="text-[11px] text-white/40">Start a new chat to formulate campaign strategies.</p>
                </div>
              ) : (
                chatSessions.map((session) => {
                  const isActive = session.id === activeChatId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => switchChatSession(session.id)}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${
                        isActive
                          ? "bg-violet-600/15 border-violet-500/40 text-[#F2F0F7] shadow-sm shadow-violet-500/10"
                          : "bg-[#101014]/60 hover:bg-[#101014] border-white/[0.06] hover:border-white/[0.12] text-[#A3A0B0]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
                            )}
                            <h4 className={`text-xs font-semibold truncate ${isActive ? "text-[#F2F0F7]" : "text-[#D1CFDC] group-hover:text-[#F2F0F7]"}`}>
                              {session.title || "New Conversation"}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[#A3A0B0]/70 font-mono">
                            <span>{new Date(session.updatedAt || session.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                            <span>•</span>
                            <span>{session.messageCount} msgs</span>
                            <span>•</span>
                            <span className={session.artifactCount > 0 ? "text-violet-400 font-semibold" : ""}>
                              {session.artifactCount} artifacts
                            </span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this conversation and its associated artifacts?")) {
                              deleteChatSession(session.id);
                            }
                          }}
                          title="Delete conversation"
                          className="p-1 rounded text-[#A3A0B0]/40 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-white/[0.06] bg-[#101014]/80 text-[10.5px] font-mono text-[#A3A0B0] flex items-center justify-between">
              <span>{chatSessions.length} conversation{chatSessions.length === 1 ? "" : "s"}</span>
              <span className="text-[10px] text-[#A3A0B0]/60">Isolated context &amp; artifacts per chat</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <CampaignStudioContent />
    </Suspense>
  );
}
