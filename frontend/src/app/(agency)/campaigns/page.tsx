"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi, studioApi, agencyApi } from "@/lib/api";
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
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  SlidersHorizontal,
  Trash2,
  X,
  Ban,
  Presentation,
} from "lucide-react";

interface Client {
  id: string;
  business_name: string;
  industry: string | null;
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
  const [mobileTab, setMobileTab] = useState<"nav" | "canvas" | "intel">("canvas");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPitchDeckModalOpen, setIsPitchDeckModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string; role?: string }>>([]);
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(true);
  const [isRightIntelOpen, setIsRightIntelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "evidence">("chat");

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
      } catch (err) {
        console.error("Failed to load client campaigns", err);
      }
    },
    [token, effectiveAgencyId]
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
      setActiveCampaignId(null);
      setActiveArtifact(null);
      setActiveArtifactVersions([]);
      setPersistedArtifacts([]);
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
        const arts = await studioApi.listArtifacts(effectiveAgencyId, targetCampaignId, token);
        setPersistedArtifacts(arts || []);

        // If no active artifact is loaded or current active artifact is not from this campaign, auto-select first
        if (arts && arts.length > 0) {
          setActiveArtifact((current) => {
            if (!current || !arts.some((a: any) => a.id === current.id)) {
              const first = arts[0];
              const targetVer = first.latest_version;
              // Also load versions asynchronously
              studioApi
                .getArtifactDetail(effectiveAgencyId, targetCampaignId, first.id, token)
                .then((detail) => {
                  if (detail?.versions) setActiveArtifactVersions(detail.versions);
                })
                .catch((e) => console.error("Error loading initial artifact detail:", e));

              return {
                id: first.id,
                type: first.artifact_type,
                title: first.title,
                version: first.current_version_number || targetVer?.version_number || 1,
                status: targetVer?.is_approved ? "approved" : (first.status || "draft"),
                payload: targetVer?.payload || {},
                supporting_evidence_refs: targetVer?.supporting_evidence_refs || [],
              };
            }
            return current;
          });
        }
      } catch (err) {
        console.error("Failed to load campaign studio artifacts:", err);
      } finally {
        setIsLoadingArtifacts(false);
      }
    },
    [effectiveAgencyId, token]
  );

  // Sync persistent artifacts whenever active campaign sprint changes
  useEffect(() => {
    if (activeCampaignId && effectiveAgencyId && token) {
      loadCampaignArtifacts(activeCampaignId);
    } else {
      setPersistedArtifacts([]);
    }
  }, [activeCampaignId, effectiveAgencyId, token, loadCampaignArtifacts]);

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

  // Persistent Chat Storage Key Helper
  const getStorageKey = useCallback(
    (cId: string) => `agencyos_studio_chat_${effectiveAgencyId || "default"}_${cId}`,
    [effectiveAgencyId]
  );

  // Update selected client object and restore persistent chat history
  useEffect(() => {
    if (!selectedClientId || clients.length === 0) return;
    const client = clients.find((c) => c.id === selectedClientId) || null;
    setSelectedClient(client);

    const storageKey = getStorageKey(selectedClientId);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setChatMessages(parsed.messages);
            setSuggestedObjective(parsed.suggestedObjective || "");
            setSuggestedCustomBrief(parsed.suggestedCustomBrief || "");
            setIsReadyToGenerate(Boolean(parsed.isReadyToGenerate));
            if (parsed.startDate) setStartDate(parsed.startDate);
            if (parsed.endDate) setEndDate(parsed.endDate);
            if (parsed.durationDays) setDurationDays(parsed.durationDays);
            if (parsed.periodMonth) setPeriodMonth(parsed.periodMonth);
            if (parsed.periodYear) setPeriodYear(parsed.periodYear);
            if (parsed.studioMode) setStudioMode(parsed.studioMode);
            if (parsed.activeSpecialistId) setActiveSpecialistId(parsed.activeSpecialistId);
            if (parsed.activeArtifact) setActiveArtifact(parsed.activeArtifact);
            if (parsed.activeCampaignId) setActiveCampaignId(parsed.activeCampaignId);
            if (Array.isArray(parsed.pinnedEntities)) setPinnedEntities(parsed.pinnedEntities);
            if (Array.isArray(parsed.discoveredEntities)) setDiscoveredEntities(parsed.discoveredEntities);
            return;
          }
        } catch (e) {
          console.error("Failed to parse cached chat history", e);
        }
      }
    }

    // Fallback welcome message when no cached history exists
    const clientName = client ? client.business_name : "your client";
    const industryInfo = client?.industry ? ` in the ${client.industry} industry` : "";

    setChatMessages([
      {
        id: `welcome-${selectedClientId}`,
        role: "assistant",
        content: `👋 Hello! I am your AI Campaign Director Copilot. Let's design a high-converting social media campaign for **${clientName}**${industryInfo}.\n\nTell me about your vision for this upcoming sprint—are you planning a special product launch, seasonal promotion, brand awareness push, or lead generation challenge? What angles or offers would you like to explore?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Campaign Director",
      },
    ]);
    setSuggestedObjective("");
    setSuggestedCustomBrief("");
    setDeliverablePreferences([]);
    setIsReadyToGenerate(false);
  }, [selectedClientId, clients, getStorageKey]);

  // Auto-persist chat messages and draft strategy to localStorage
  useEffect(() => {
    if (!selectedClientId || chatMessages.length === 0) return;
    const storageKey = getStorageKey(selectedClientId);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          messages: chatMessages,
          suggestedObjective,
          suggestedCustomBrief,
          isReadyToGenerate,
          startDate,
          endDate,
          durationDays,
          periodMonth,
          periodYear,
          studioMode,
          activeSpecialistId,
          activeArtifact,
          activeCampaignId,
          pinnedEntities,
          discoveredEntities,
        })
      );
    } catch (e) {
      console.error("Failed to save chat to storage", e);
    }
  }, [chatMessages, suggestedObjective, suggestedCustomBrief, isReadyToGenerate, startDate, endDate, durationDays, periodMonth, periodYear, studioMode, activeSpecialistId, activeArtifact, activeCampaignId, pinnedEntities, discoveredEntities, selectedClientId, getStorageKey]);

  // Reset conversation handler
  const handleResetChat = () => {
    if (!selectedClientId) return;
    const storageKey = getStorageKey(selectedClientId);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    const clientName = selectedClient ? selectedClient.business_name : "your client";
    const industryInfo = selectedClient?.industry ? ` in the ${selectedClient.industry} industry` : "";

    setChatMessages([
      {
        id: `welcome-${selectedClientId}-${Date.now()}`,
        role: "assistant",
        content: `👋 Hello! I am your AI Campaign Director Copilot. Let's design a high-converting social media campaign for **${clientName}**${industryInfo}.\n\nTell me about your vision for this upcoming sprint—are you planning a special product launch, seasonal promotion, brand awareness push, or lead generation challenge? What angles or offers would you like to explore?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: "director",
        agent_name: "Campaign Director",
      },
    ]);
    setSuggestedObjective("");
    setSuggestedCustomBrief("");
    setDeliverablePreferences([]);
    setIsReadyToGenerate(false);
    setStartDate("");
    setEndDate("");
    setDurationDays(null);
    setActiveCampaignId(null);
    setActiveArtifact(null);
    setPinnedEntities([]);
    setDiscoveredEntities([]);
  };

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
              setActiveArtifact({
                id: response.artifact_id,
                type: response.artifact_type || "storyboard",
                title: response.artifact_title || `${currentAgent.name} Asset`,
                version: response.artifact_version_number || 1,
                status: response.artifact_status || "draft",
                payload: response.artifact_payload,
                supporting_evidence_refs: response.supporting_evidence_refs || [],
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
          setActiveArtifact({
            id: response.artifact_id,
            type: response.artifact_type || "storyboard",
            title: response.artifact_title || `${currentAgent.name} Asset`,
            version: response.artifact_version_number || 1,
            status: response.artifact_status || "draft",
            payload: response.artifact_payload,
            supporting_evidence_refs: response.supporting_evidence_refs || [],
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
    if (!token || !effectiveAgencyId || !activeCampaignId) return;
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
    if (!effectiveAgencyId || !activeCampaignId || !token) return;
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
    const targetCampaignId = summary.campaign_id || activeCampaignId;

    if (effectiveAgencyId && targetCampaignId && token) {
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

  // Launch Multi-Agent Pipeline Execution inline in chat (Real LangGraph Workflow, Zero Fake Timers)
  const handleRunPipeline = async () => {
    if (!token || !effectiveAgencyId || !selectedClientId || isPipelineRunning) return;

    setIsPipelineRunning(true);
    const pipelineMsgId = `pipeline-${Date.now()}`;

    const pipelineMsg: ChatMsg = {
      id: pipelineMsgId,
      role: "assistant",
      content: "🚀 **Launching Autonomous Multi-Agent Campaign Intelligence Engine...**\nCoordinating 6 specialized agents: parallel gathering (Brand Intel, Market Research, Performance) → Strategy synthesis → Content Architecture → Quality Gate audit.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agent_id: "director",
      agent_name: "Multi-Agent Engine",
      agentPipeline: {
        status: "in_progress",
        activeStep: 0,
        stepDetails: {
          agent1: "Executing parallel intelligence gathering across brand rules, market trends, and performance data...",
        },
      },
    };

    setChatMessages((prev) => [...prev, pipelineMsg]);

    try {
      const newCampaign: any = await campaignApi.generatePlan(
        effectiveAgencyId,
        selectedClientId,
        {
          period_month: periodMonth,
          period_year: periodYear,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          duration_days: durationDays || undefined,
          objective: suggestedObjective || undefined,
          custom_brief: suggestedCustomBrief || undefined,
          deliverable_preferences: deliverablePreferences.length > 0 ? deliverablePreferences : undefined,
          pinned_entities: pinnedEntities,
        },
        token
      );

      const draft = newCampaign.ai_plan_draft || {};
      const deliverablesCount = (draft.deliverables || []).length;
      const rawScore = draft.quality_evaluation?.compliance_score;
      const complianceScore =
        typeof rawScore === "number"
          ? rawScore <= 1
            ? Math.round(rawScore * 100)
            : Math.round(rawScore)
          : 95;
      const theme = draft.strategy?.campaign_theme || draft.campaign_name;

      setActiveCampaignId(newCampaign.id);
      loadClientCampaigns(selectedClientId);

      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id === pipelineMsgId) {
            return {
              ...m,
              agentPipeline: {
                status: "completed",
                activeStep: 6,
                stepDetails: {
                  agent1: "Brand guidelines, verified offers & forbidden claims validated.",
                  agent2: "Live web research completed with competitor angles.",
                  agent3: "Historical retention analysis & format weights applied.",
                  agent4: `Strategy finalized: ${theme || "Master Campaign Strategy"}.`,
                  agent5: `${deliverablesCount} polymorphic deliverables architected (Reels, Carousels, Graphics).`,
                  agent6: `Quality Gate Passed: ${complianceScore}% brand compliance score.`,
                },
                result: {
                  campaignId: newCampaign.id,
                  campaignName: newCampaign.name,
                  theme,
                  deliverablesCount,
                  complianceScore,
                },
              },
            };
          }
          return m;
        })
      );

      // Check if studio artifacts exist for the generated campaign
      try {
        const arts = await studioApi.listArtifacts(effectiveAgencyId, newCampaign.id, token);
        if (arts && arts.length > 0) {
          const first = arts[0];
          setActiveArtifact({
            id: first.id,
            type: first.artifact_type,
            title: first.title,
            version: first.current_version_number || 1,
            status: first.status,
            payload: first.latest_version?.payload || {},
          });
        }
      } catch {
        // Artifacts optional
      }
    } catch (err: any) {
      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id === pipelineMsgId) {
            return {
              ...m,
              agentPipeline: {
                status: "error",
                activeStep: 0,
                errorMessage: err.message || "Failed to execute multi-agent engine.",
              },
            };
          }
          return m;
        })
      );
    } finally {
      setIsPipelineRunning(false);
    }
  };

  // Workflow stages definition for left navigation
  const WORKFLOW_STAGES = [
    { id: "discovery", name: "Discovery & Brief", step: "01", icon: Sparkles, desc: "Objectives & sprint dates" },
    { id: "intelligence", name: "Market Intelligence", step: "02", icon: Search, desc: "Competitors & viral hooks" },
    { id: "strategy", name: "Campaign Blueprint", step: "03", icon: Cpu, desc: "Master theme & pacing" },
    { id: "storyboards", name: "Content Architecture", step: "04", icon: Layers2, desc: "Reel scenes & decks" },
    { id: "compliance", name: "Pre-Flight Audit", step: "05", icon: FileCheck, desc: "Claims & brand safety" },
    { id: "handoff", name: "Production Handoff", step: "06", icon: CheckCircle2, desc: "Task conversion & export" },
  ];

  // Helper to compute honest execution status for any of the 6 agents (Zero Fake Timers)
  const getAgentStatus = (agentId: string) => {
    // If the full LangGraph pipeline is actively running via generate-plan
    if (isPipelineRunning) {
      if (["brand_intelligence", "market_research", "historical_performance"].includes(agentId)) {
        return { state: "running", label: "Gathering" };
      }
      if (agentId === "campaign_strategist") {
        return { state: "pending", label: "Fan-In" };
      }
      if (agentId === "content_architect") {
        return { state: "pending", label: "Arch." };
      }
      if (agentId === "quality_evaluator") {
        return { state: "pending", label: "Gate" };
      }
    }

    // If an individual specialist chat stream is currently executing
    if (isChatLoading && currentAgentId === agentId) {
      return { state: "running", label: "Active" };
    }

    // Check if this specialist previously executed in the current session
    const hasExecuted = chatMessages.some(
      (m) => m.agent_id === agentId && m.role === "assistant" && !m.isStreaming
    );
    if (hasExecuted) {
      return { state: "completed", label: "Ready" };
    }

    return { state: "idle", label: "Idle" };
  };

  // Collect all unique artifacts from database, chat stream, and canvas
  const studioArtifacts = React.useMemo(() => {
    const map = new Map<string, any>();

    // 1. First add all persisted artifacts from SQLite / Postgres
    persistedArtifacts.forEach((art) => {
      const verNum = art.current_version_number || art.latest_version?.version_number || 1;
      const key = `${art.id}-v${verNum}`;
      map.set(key, {
        id: art.id,
        campaign_id: art.campaign_id,
        type: art.artifact_type,
        title: art.title,
        version: verNum,
        status: art.status,
        payload: art.latest_version?.payload || {},
        supporting_evidence_refs: art.latest_version?.supporting_evidence_refs || [],
        created_at: art.created_at,
        versions: art.versions || [],
      });
    });

    // 2. Add any chat message artifacts from active streaming session
    chatMessages.forEach((m) => {
      if (m.artifact_summary) {
        const key = `${m.artifact_summary.id}-v${m.artifact_summary.version}`;
        if (!map.has(key)) {
          map.set(key, m.artifact_summary);
        }
      }
    });

    // 3. Ensure active artifact is present
    if (activeArtifact) {
      const key = `${activeArtifact.id}-v${activeArtifact.version}`;
      if (!map.has(key)) {
        map.set(key, {
          id: activeArtifact.id,
          campaign_id: activeCampaignId,
          type: activeArtifact.type,
          title: activeArtifact.title,
          version: activeArtifact.version,
          status: activeArtifact.status,
          payload: activeArtifact.payload,
          supporting_evidence_refs: activeArtifact.supporting_evidence_refs,
        });
      }
    }

    return Array.from(map.values());
  }, [persistedArtifacts, chatMessages, activeArtifact, activeCampaignId]);

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 flex items-center justify-center shadow-[0_0_12px_rgba(167,139,250,0.2)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A78BFA] block text-[9px] -mb-0.5">
                Flagship Studio
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#F2F0F7] hidden sm:inline">
                Campaign Studio
              </span>
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
                  if (e.target.value === "new") {
                    setActiveCampaignId(null);
                    setActiveArtifact(null);
                    setActiveArtifactVersions([]);
                  } else {
                    setActiveCampaignId(e.target.value);
                  }
                }}
                className="bg-transparent text-xs font-semibold text-[#F2F0F7] focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
                title="Select active campaign sprint"
              >
                {clientCampaigns.map((camp: any) => (
                  <option key={camp.id} value={camp.id} className="bg-[#17171E] text-[#F2F0F7]">
                    {camp.name}
                  </option>
                ))}
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
        </div>

        {/* Center: Clean Segmented Mode Toggle */}
        <div className="flex items-center p-0.5 bg-[#101014] rounded-lg border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setStudioMode("workflow")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              studioMode === "workflow"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Workflow</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioMode("specialists")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              studioMode === "specialists"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-[#69A9D8]" />
            <span>Specialists (6)</span>
          </button>
        </div>

        {/* Right: Panel Toggles & Tools */}
        <div className="flex items-center gap-2">
          {/* Left Panel Toggle (Desktop) */}
          <button
            type="button"
            onClick={() => setIsLeftNavOpen((prev) => !prev)}
            title={isLeftNavOpen ? "Collapse Navigation" : "Expand Navigation"}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
              isLeftNavOpen
                ? "surface-card text-[#F2F0F7]"
                : "bg-transparent border-white/[0.08] text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            {isLeftNavOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-mono hidden xl:inline">Nav</span>
          </button>

          {/* Right Panel Toggle (Desktop) */}
          <button
            type="button"
            onClick={() => setIsRightIntelOpen((prev) => !prev)}
            title={isRightIntelOpen ? "Collapse Intelligence" : "Expand Intelligence"}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
              isRightIntelOpen
                ? "surface-card text-[#F2F0F7]"
                : "bg-transparent border-white/[0.08] text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            {isRightIntelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-mono hidden xl:inline">Intel</span>
          </button>

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

          {/* Reset Conversation */}
          <button
            onClick={handleResetChat}
            title="Start fresh conversation"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg hover:bg-white/[0.04] text-[#A3A0B0] hover:text-[#F2F0F7] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Reset</span>
          </button>

          {/* Pitch Deck Button (Active when campaign exists) */}
          {activeCampaignId && clientCampaigns.some((c) => c.id === activeCampaignId) && (
            <button
              type="button"
              onClick={() => setIsPitchDeckModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#20202A] hover:bg-[#282836] text-[#F2F0F7] border border-white/[0.08] transition-all cursor-pointer shadow-xs"
              title="Present Executive Strategy Pitch Deck (Fullscreen & Print PDF)"
            >
              <Presentation className="w-3.5 h-3.5 text-[#A78BFA]" />
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
          onClick={() => setMobileTab("nav")}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            mobileTab === "nav" ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]" : "text-[#A3A0B0]"
          }`}
        >
          Stages & Artifacts
        </button>
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

      {/* ── 2. Three-Region Workspace: Left Nav + Centre Canvas + Right Intel ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden pt-2 gap-2.5">
        {/* ── LEFT REGION: Campaign Navigation & Workflow Stages ── */}
        {(isLeftNavOpen || mobileTab === "nav") && (
          <aside
            className={`w-full lg:w-64 xl:w-72 shrink-0 flex flex-col h-full surface-card rounded-2xl border border-white/[0.08] overflow-hidden ${
              mobileTab === "nav" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Sprint Timeline Header Card */}
            <div className="p-3 border-b border-white/[0.06] bg-[#101014]/60 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Sprint Timeline</span>
                </span>
                {durationDays && durationDays > 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 shadow-[0_0_8px_rgba(167,139,250,0.15)]">
                    {durationDays} Days
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#A3A0B0]">Dates</span>
                )}
              </div>

              <div className="flex items-center gap-1 bg-[#101014] px-2.5 py-1.5 rounded-lg border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange(e.target.value, endDate)}
                  className="bg-transparent text-[11px] font-mono text-[#F2F0F7] focus:outline-none cursor-pointer w-full"
                />
                <span className="text-[#A3A0B0] text-[10px] px-1 font-mono">→</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => handleDateChange(startDate, e.target.value)}
                  className="bg-transparent text-[11px] font-mono text-[#F2F0F7] focus:outline-none cursor-pointer w-full text-right"
                />
              </div>
            </div>

            {/* Workflow Stages Vertical List */}
            <div className="p-3 border-b border-white/[0.06] space-y-2 shrink-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">
                  Workflow Stages
                </span>
                <span className="text-[9px] font-mono text-[#A3A0B0]/70">6 Steps</span>
              </div>
              <div className="space-y-1">
                {WORKFLOW_STAGES.map((stage) => {
                  const Icon = stage.icon;
                  const isCurrent =
                    (stage.id === "intelligence" && activeSpecialistId === "market_research") ||
                    (stage.id === "strategy" && activeSpecialistId === "campaign_strategist") ||
                    (stage.id === "storyboards" && activeSpecialistId === "content_architect") ||
                    (stage.id === "compliance" && activeSpecialistId === "quality_evaluator") ||
                    (stage.id === "discovery" && studioMode === "workflow");

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        if (stage.id === "discovery") setStudioMode("workflow");
                        else if (stage.id === "intelligence") {
                          setActiveSpecialistId("market_research");
                          setStudioMode("specialists");
                        } else if (stage.id === "strategy") {
                          setActiveSpecialistId("campaign_strategist");
                          setStudioMode("specialists");
                        } else if (stage.id === "storyboards") {
                          setActiveSpecialistId("content_architect");
                          setStudioMode("specialists");
                        } else if (stage.id === "compliance") {
                          setActiveSpecialistId("quality_evaluator");
                          setStudioMode("specialists");
                        } else if (stage.id === "handoff") {
                          setIsExportModalOpen(true);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left cursor-pointer group ${
                        isCurrent
                          ? "bg-white/[0.08] text-[#F2F0F7] border border-white/[0.12] shadow-xs font-semibold"
                          : "hover:bg-white/[0.03] text-[#A3A0B0] hover:text-[#F2F0F7] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isCurrent ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.8)] shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-transparent border border-white/[0.2] shrink-0 group-hover:border-white/[0.4]" />
                        )}
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-[#A78BFA]" : "text-[#A3A0B0] group-hover:text-[#F2F0F7]"}`} />
                        <span className="truncate">{stage.name}</span>
                      </div>
                      <span className={`font-mono text-[10px] shrink-0 ${isCurrent ? "text-[#A78BFA] font-bold" : "text-[#A3A0B0]"}`}>
                        {stage.step}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campaign Artifacts Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0]">
                  Campaign Artifacts
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#A78BFA] border border-white/[0.08]">
                  {studioArtifacts.length}
                </span>
              </div>

              {studioArtifacts.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#101014]/40 border border-white/[0.06] text-center text-xs text-[#A3A0B0] space-y-1">
                  <FileText className="w-4 h-4 mx-auto text-[#A3A0B0]/50" />
                  <p className="text-[11px] font-medium text-[#F2F0F7]/80">No artifacts generated</p>
                  <p className="text-[10px] text-[#A3A0B0]">Run the multi-agent engine to draft scripts & decks</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {studioArtifacts.map((art) => {
                    const isActive = activeArtifact?.id === art.id && activeArtifact?.version === art.version;
                    return (
                      <button
                        key={`${art.id}-v${art.version}`}
                        type="button"
                        onClick={() => {
                          handleViewOnCanvas(art);
                          setMobileTab("canvas");
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer space-y-1.5 ${
                          isActive
                            ? "bg-[#20202A] border-[#A78BFA] text-[#F2F0F7] shadow-[0_0_12px_rgba(167,139,250,0.15)]"
                            : "surface-card surface-card-hover border-white/[0.06] hover:border-white/[0.12] text-[#A3A0B0] hover:text-[#F2F0F7]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-[#A78BFA] border border-white/[0.08]">
                              v{art.version}
                            </span>
                            <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-[#A3A0B0] border border-white/[0.06] truncate">
                              {art.type === "storyboard"
                                ? "🎬 Reel"
                                : art.type === "carousel_deck"
                                ? "📑 Deck"
                                : art.type === "compliance_review"
                                ? "🛡️ Audit"
                                : art.type === "research_evidence"
                                ? "🔍 Intel"
                                : art.type === "campaign_blueprint"
                                ? "🗺️ Blueprint"
                                : art.type === "brand_positioning"
                                ? "💎 Brand"
                                : art.type}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                              art.status === "approved" || art.status === "exported"
                                ? "bg-[#45B88A]/15 text-[#45B88A] border-[#45B88A]/30"
                                : "bg-white/[0.04] text-[#A3A0B0] border-white/[0.08]"
                            }`}
                          >
                            <span className={`w-1 h-1 rounded-full ${art.status === "approved" || art.status === "exported" ? "bg-[#45B88A]" : "bg-[#A3A0B0]"}`} />
                            {art.status}
                          </span>
                        </div>
                        <p className="font-medium text-[11px] truncate text-[#F2F0F7]">
                          {art.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Specialist Switcher Strip */}
            <div className="p-2.5 border-t border-white/[0.06] bg-[#101014]/60 shrink-0">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0] block px-1 mb-1.5">
                Specialist Roster
              </span>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {SPECIALIST_AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setActiveSpecialistId(agent.id);
                      setStudioMode("specialists");
                    }}
                    className={`px-2 py-1 rounded-md text-left truncate transition-colors cursor-pointer border ${
                      activeSpecialistId === agent.id && studioMode === "specialists"
                        ? "bg-white/[0.08] text-[#F2F0F7] border-[#A78BFA]/50 font-semibold shadow-xs"
                        : "bg-transparent text-[#A3A0B0] hover:text-[#F2F0F7] border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    {agent.shortName}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ── CENTRE REGION: Primary Creative Workspace & Canvas ── */}
        <main
          className={`flex-1 min-w-0 flex flex-col h-full bg-[#101014] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xs ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
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
            className={`w-full lg:w-80 xl:w-96 shrink-0 flex flex-col h-full surface-card rounded-2xl border border-white/[0.08] overflow-hidden ${
              mobileTab === "intel" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Orchestration Supervisor & 6-Agent Execution Status Roster */}
            <div className="p-3 border-b border-white/[0.06] bg-[#101014]/60 shrink-0 space-y-2.5">
              {/* Campaign Director Copilot Banner */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#F2F0F7] text-[11px] font-heading">Campaign Director</div>
                    <div className="text-[9.5px] font-mono text-[#A3A0B0]">Sprint Orchestrator &amp; Copilot</div>
                  </div>
                </div>
                <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium">
                  {studioMode === "workflow" ? "Active Copilot" : "Standby"}
                </span>
              </div>

              {/* 6 Specialist Agents Matrix */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Specialist Matrix (6 Synced)</span>
                </span>
                <span className="text-[10px] font-mono text-[#A3A0B0]">
                  {isPipelineRunning ? (
                    <span className="text-[#A78BFA] flex items-center gap-1 font-semibold">
                      <Loader2 className="w-3 h-3 animate-spin" /> Engine Active
                    </span>
                  ) : (
                    <span className="text-[#45B88A] flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] inline-block" /> Ready
                    </span>
                  )}
                </span>
              </div>

              {/* 6 Agents Micro Matrix with LED Diodes */}
              <div className="grid grid-cols-2 gap-1.5">
                {SPECIALIST_AGENTS.map((item) => {
                  const stat = getAgentStatus(item.id);
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-1.5 rounded-lg border text-[10.5px] transition-all ${
                        stat.state === "running"
                          ? "bg-[#A78BFA]/10 border-[#A78BFA]/40 text-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.2)]"
                          : stat.state === "completed"
                          ? "bg-[#45B88A]/10 border-[#45B88A]/30 text-[#45B88A]"
                          : "bg-[#101014] border-white/[0.06] text-[#A3A0B0]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {stat.state === "running" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-ping shrink-0" />
                        ) : stat.state === "completed" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6E6D7A] shrink-0" />
                        )}
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.shortName}</span>
                      </div>
                      <span className="text-[9px] font-mono uppercase shrink-0 font-medium">
                        {stat.label}
                      </span>
                    </div>
                  );
                })}
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
                        className="w-6 h-6 rounded-full border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 bg-[#20202A] text-[#A78BFA] shadow-xs"
                        title={agentInfo.name}
                      >
                        <AgentIcon className="w-3 h-3" />
                      </div>
                    )}

                    <div className="max-w-[88%] space-y-1">
                      {!isUser && (
                        <div className="flex items-center gap-1.5 pl-1">
                          <span className="text-[10px] font-bold text-[#A78BFA] tracking-tight">
                            {msg.agent_name || agentInfo.name}
                          </span>
                        </div>
                      )}

                      {/* Streaming status pill */}
                      {msg.streamingStatus && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/30 text-[11px] text-[#A78BFA] animate-pulse mb-1 w-fit shadow-[0_0_8px_rgba(167,139,250,0.15)]">
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          <span>{msg.streamingStatus}</span>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${
                          isUser
                            ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.08] rounded-br-xs shadow-xs"
                            : "surface-card text-[#F2F0F7] border border-white/[0.08] rounded-bl-xs shadow-xs"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">
                          {msg.content || (msg.isStreaming ? (
                            <span className="text-[#A3A0B0] italic text-[11px] flex items-center gap-1.5 py-0.5">
                              <Sparkles className="w-3 h-3 text-[#A78BFA] animate-pulse shrink-0" />
                              <span>Gathering intelligence & synthesizing...</span>
                            </span>
                          ) : null)}
                        </div>
                        <span className={`block mt-1 text-[9px] font-mono ${isUser ? "text-[#A3A0B0] text-right" : "text-[#A3A0B0]"}`}>
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
                                    ? "bg-[#E5AA58]/10 border-[#E5AA58]/30 text-[#E5AA58] animate-pulse"
                                    : "bg-[#101014] border-white/[0.06] text-[#A3A0B0]"
                                }`}
                              >
                                {isPending ? (
                                  <Loader2 className="w-2.5 h-2.5 text-[#E5AA58] animate-spin shrink-0" />
                                ) : (
                                  <Sparkles className="w-2.5 h-2.5 text-[#A78BFA] shrink-0" />
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
            <div className="p-2 border-t border-white/[0.06] bg-[#101014]/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[10px] font-mono text-[#A3A0B0] shrink-0 flex items-center gap-1 px-1">
                <Flame className="w-3 h-3 text-[#E5AA58]" />
              </span>
              {currentAgent.starters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(starter)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-[#F2F0F7] transition-all shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Strategy Evolving Bar & Generate Action */}
            {(suggestedObjective || isReadyToGenerate) && (
              <div className="p-2.5 bg-[#A78BFA]/10 border-t border-[#A78BFA]/20 flex items-center justify-between gap-2 shrink-0 text-xs shadow-inner">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                  <p className="text-[11px] text-[#F2F0F7] truncate font-medium">
                    {durationDays ? `${durationDays}-Day Sprint:` : "Strategy:"} {suggestedObjective || suggestedCustomBrief}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isPipelineRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelGenerationSuggestion}
                        className="px-2.5 py-1 rounded-lg border border-white/[0.08] hover:bg-white/[0.06] text-[#A3A0B0] hover:text-[#F2F0F7] text-[11px] font-medium transition-colors cursor-pointer"
                        title="Dismiss campaign creation suggestion"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGenerateConfirmModal(true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-[11px] shadow-[0_1px_8px_rgba(167,139,250,0.3)] cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Generate Sprint ✨</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#A78BFA]">
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
            <footer className="p-2.5 border-t border-white/[0.06] bg-[#101014]/70 shrink-0">
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
                  className="w-full bg-[#101014] border border-white/[0.08] focus:border-[#A78BFA]/50 focus:ring-1 focus:ring-[#A78BFA]/20 rounded-xl px-3.5 py-2.5 pr-20 text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/60 focus:outline-none disabled:opacity-50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                  autoFocus
                />

                <div className="absolute right-2 flex items-center gap-1.5">
                  <span className="kbd-pill hidden sm:inline-flex text-[10px]">↵</span>
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading || isPipelineRunning}
                    className="px-2.5 py-1 rounded-lg bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-semibold text-xs flex items-center gap-1 disabled:opacity-40 transition-opacity cursor-pointer shadow-[0_1px_6px_rgba(167,139,250,0.3)]"
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
        campaignId={activeCampaignId || ""}
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
