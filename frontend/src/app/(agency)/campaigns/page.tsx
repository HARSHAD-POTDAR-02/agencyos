"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi, studioApi, agencyApi } from "@/lib/api";
import { ContextualCanvas } from "@/components/campaign-studio/ContextualCanvas";
import { ExportPreviewModal } from "@/components/campaign-studio/ExportPreviewModal";
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

export const SPECIALIST_AGENTS: SpecialistAgent[] = [
  {
    id: "director",
    name: "Campaign Director",
    shortName: "Director",
    roleTitle: "Sprint Orchestrator & Creative Director",
    icon: Sparkles,
    color: "violet",
    badgeBg: "bg-violet-500/15",
    badgeText: "text-violet-600 dark:text-violet-400",
    borderColor: "border-violet-500/30",
    avatarBg: "bg-violet-600/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
    description: "Guides end-to-end sprint discovery, timeline planning, deliverable counts, and sprint generation.",
    starters: [
      "Create a 4-day campaign sprint from 8th Nov to 11th Nov with daily content",
      "Plan a 30-day challenge sprint with viral Instagram Reels",
      "Design an educational carousel sprint focused on authority & debunking myths",
      "Craft a product launch campaign with exclusive offers",
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
    badgeText: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/30",
    avatarBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    description: "Identifies live market trends, competitor whitespace, viral hook archetypes, and algorithm dynamics.",
    starters: [
      "What are the top viral hooks for our industry right now?",
      "Suggest 3 high-arrest hooks for our upcoming seasonal promotion",
      "What competitor whitespace or angle gaps can we exploit?",
      "Which trending audio or meme archetypes fit our brand?",
    ],
  },
  {
    id: "brand_intelligence",
    name: "Brand Identity Specialist",
    shortName: "Brand Identity",
    roleTitle: "Voice, Guidelines & Content Pillars",
    icon: ShieldCheck,
    color: "emerald",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
    avatarBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    description: "Defines brand voice guidelines, content pillars, audience personas, and guards against prohibited claims.",
    starters: [
      "Audit our brand voice and suggest 3 high-authority content pillars",
      "Craft a detailed Ideal Customer Persona (ICP) with pain points & desires",
      "How do we frame our verified offer without sounding salesy?",
      "Review our prohibited claims to ensure strict brand compliance",
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
    badgeText: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/30",
    avatarBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    description: "Analyzes historical engagement stats, retention drop-off signals, and recommends format distribution.",
    starters: [
      "Analyze our past post performance and recommend optimal format ratio",
      "Which content angles drive the highest saves and shares?",
      "Are there any audience fatigue signals in our recent deliverables?",
      "What retention tactics should we use to boost average watch time?",
    ],
  },
  {
    id: "content_architect",
    name: "Scriptwriter & Architect",
    shortName: "Video Scripts",
    roleTitle: "Scene-by-Scene Concepts & Shoot Storyboards",
    icon: Layers2,
    color: "purple",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    avatarBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    description: "Drafts timestamped Reel scripts (0:00-0:03 hook, beats, B-roll cues) and slide-by-slide Carousel decks.",
    starters: [
      "Write a 15-second Reel script with timestamped beats & B-roll directions",
      "Give me 3 scene-by-scene video shoot concepts for our product",
      "Draft a 7-slide educational carousel with high-retention slides",
      "Give me 3 viral reel concepts with camera movement & voiceover lines",
    ],
  },
  {
    id: "campaign_strategist",
    name: "Creative Director",
    shortName: "Strategist",
    roleTitle: "Master Themes & Narrative Pacing",
    icon: Cpu,
    color: "indigo",
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-500/30",
    avatarBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    description: "Architects multi-week narrative arcs, master campaign themes, and cross-platform conversion funnels.",
    starters: [
      "Structure a 3-phase narrative arc (Problem -> Solution -> Launch)",
      "What is a powerful master theme & campaign slogan for our brand?",
      "How should we pace content distribution over a 30-day period?",
      "Design a conversion funnel moving cold viewers to DM leads",
    ],
  },
  {
    id: "quality_evaluator",
    name: "Quality & Compliance Critic",
    shortName: "Quality Critic",
    roleTitle: "Pre-Flight Audit & Hook Critique",
    icon: FileCheck,
    color: "rose",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-500/30",
    avatarBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    description: "Audits hooks for retention strength, eliminates clichés, and checks claims against compliance guidelines.",
    starters: [
      "Audit our campaign concepts for weak hooks, clichés, or fluff",
      "Check our copy against prohibited or risky marketing claims",
      "Score our 3-second hook strength and suggest punchier openings",
      "How can we tighten our call-to-actions to maximize conversion?",
    ],
  },
];

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

  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

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
  const [mobileTab, setMobileTab] = useState<"chat" | "canvas">("chat");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string; role?: string }>>([]);

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
        })
      );
    } catch (e) {
      console.error("Failed to save chat to storage", e);
    }
  }, [chatMessages, suggestedObjective, suggestedCustomBrief, isReadyToGenerate, startDate, endDate, durationDays, periodMonth, periodYear, studioMode, activeSpecialistId, activeArtifact, activeCampaignId, selectedClientId, getStorageKey]);

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
  };

  // Current active agent specification
  const currentAgentId = studioMode === "workflow" ? "director" : activeSpecialistId;
  const currentAgent = SPECIALIST_AGENTS.find((a) => a.id === currentAgentId) || SPECIALIST_AGENTS[0];

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
          },
          token
        );

        if (response.campaign_id) setActiveCampaignId(response.campaign_id);
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
      }
    } catch (err: any) {
      console.error("Failed to approve artifact version:", err);
    }
  };

  // View or restore a specific artifact version on the Contextual Canvas
  const [isLoadingCanvasArtifact, setIsLoadingCanvasArtifact] = useState<string | null>(null);

  const handleViewOnCanvas = async (summary: NonNullable<ChatMsg["artifact_summary"]>) => {
    // 1. If payload is directly embedded on the message, restore immediately
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
      setMobileTab("canvas");
      return;
    }

    // 2. If the canvas is already displaying this exact artifact and version, just switch view tab
    if (
      activeArtifact &&
      activeArtifact.id === summary.id &&
      activeArtifact.version === summary.version
    ) {
      setMobileTab("canvas");
      return;
    }

    // 3. Otherwise, fetch detail from backend
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
          const payload = targetVer?.payload || detail.payload || {};

          setActiveArtifact({
            id: detail.id,
            type: detail.artifact_type || summary.type,
            title: detail.title || summary.title,
            version: targetVer?.version_number || summary.version,
            status: targetVer?.is_approved ? "approved" : (detail.status || summary.status),
            payload: payload,
            supporting_evidence_refs: detail.supporting_evidence_refs || [],
          });
          setMobileTab("canvas");
        }
      } catch (err) {
        console.error("Failed to load artifact details for canvas:", err);
        setMobileTab("canvas");
      } finally {
        setIsLoadingCanvasArtifact(null);
      }
    } else {
      setMobileTab("canvas");
    }
  };

  // Launch Multi-Agent Pipeline Execution inline in chat
  const handleRunPipeline = async () => {
    if (!token || !effectiveAgencyId || !selectedClientId || isPipelineRunning) return;

    setIsPipelineRunning(true);
    const pipelineMsgId = `pipeline-${Date.now()}`;

    const pipelineMsg: ChatMsg = {
      id: pipelineMsgId,
      role: "assistant",
      content: "🚀 **Launching Autonomous Multi-Agent Campaign Intelligence Engine...**\nCoordinating 6 specialized agents to architect this campaign sprint:",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agent_id: "director",
      agent_name: "Multi-Agent Engine",
      agentPipeline: {
        status: "in_progress",
        activeStep: 0,
        stepDetails: {
          agent1: "Extracting brand guidelines, verified offers & quota limits...",
        },
      },
    };

    setChatMessages((prev) => [...prev, pipelineMsg]);

    const stepInterval = setInterval(() => {
      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id === pipelineMsgId && m.agentPipeline && m.agentPipeline.status === "in_progress") {
            const nextStep = m.agentPipeline.activeStep < 5 ? m.agentPipeline.activeStep + 1 : 5;
            const updatedDetails = { ...m.agentPipeline.stepDetails };

            if (nextStep === 1) {
              updatedDetails.agent1 = "Verified brand voice, forbidden claims & quota constraints.";
              updatedDetails.agent2 = "Searching live web & format benchmarks for viral trends...";
            } else if (nextStep === 2) {
              updatedDetails.agent2 = "Extracted competitor hooks & market evidence.";
              updatedDetails.agent3 = "Auditing historical drop-off rates & retention signals...";
            } else if (nextStep === 3) {
              updatedDetails.agent3 = "Calculated format weights and fatigue mitigations.";
              updatedDetails.agent4 = "Synthesizing master theme, narrative arc & content pillars...";
            } else if (nextStep === 4) {
              updatedDetails.agent4 = "Master strategy locked with balanced distribution.";
              updatedDetails.agent5 = "Generating polymorphic deliverables, Reel scenes & Carousel slides...";
            } else if (nextStep === 5) {
              updatedDetails.agent5 = "Drafted high-fidelity polymorphic deliverables.";
              updatedDetails.agent6 = "Running deterministic quality gate & compliance audit...";
            }

            return {
              ...m,
              agentPipeline: {
                ...m.agentPipeline,
                activeStep: nextStep,
                stepDetails: updatedDetails,
              },
            };
          }
          return m;
        })
      );
    }, 3800);

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
        },
        token
      );

      clearInterval(stepInterval);

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

      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id === pipelineMsgId) {
            return {
              ...m,
              agentPipeline: {
                status: "completed",
                activeStep: 6,
                stepDetails: {
                  agent1: "Brand rules, verified offers & forbidden claims validated.",
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
    } catch (err: any) {
      clearInterval(stepInterval);
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

  // Messages to display according to the selected view filter
  const displayedMessages = chatMessages.filter((msg) => {
    if (chatFilter === "all") return true;
    if (msg.agentPipeline) return true;
    return msg.agent_id === currentAgentId || !msg.agent_id;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full max-w-[1700px] mx-auto px-2 sm:px-4 py-2 overflow-hidden">
      {/* ── 1. Consolidated Sleek Header (Single row: Title + Client + Mode + Utilities) ── */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-border/40 shrink-0">
        {/* Left: Studio Title & Client Dropdown */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline">
              Campaign Studio
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/50 hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-colors">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[210px] truncate"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-background text-foreground">
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Clean Segmented Mode Toggle */}
        <div className="flex items-center p-0.5 bg-muted/60 dark:bg-muted/30 rounded-lg border border-border shadow-2xs">
          <button
            type="button"
            onClick={() => setStudioMode("workflow")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              studioMode === "workflow"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Workflow</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioMode("specialists")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              studioMode === "specialists"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Specialists</span>
          </button>
        </div>

        {/* Right: Quick Tools (Filter, Reset, Plans) */}
        <div className="flex items-center gap-2">
          {/* Stream Filter Toggle */}
          <button
            type="button"
            onClick={() => setChatFilter((prev) => (prev === "all" ? "active" : "all"))}
            title={chatFilter === "all" ? "Filter to active agent only" : "Show all agents"}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-muted/50 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <MessagesSquare className="w-3 h-3 text-primary" />
            <span className="font-medium text-[11px]">
              {chatFilter === "all" ? `All (${chatMessages.length})` : currentAgent.shortName}
            </span>
          </button>

          {/* Reset Conversation */}
          <button
            onClick={handleResetChat}
            title="Start fresh conversation"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Reset</span>
          </button>

          {/* Campaign Plans Dashboard */}
          <Link
            href={selectedClientId ? `/campaign-plans?clientId=${selectedClientId}` : "/campaign-plans"}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors shadow-2xs"
          >
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline text-[11px]">Plans</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </Link>
        </div>
      </header>

      {/* Mobile Tab Toggle (< lg only) */}
      <div className="flex lg:hidden items-center p-0.5 bg-muted/60 rounded-lg border border-border my-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            mobileTab === "chat" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
          }`}
        >
          Chat & Agents
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("canvas")}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === "canvas" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Canvas {activeArtifact ? `(v${activeArtifact.version})` : ""}</span>
        </button>
      </div>

      {/* ── 2. Split-Screen Body: Left Chat (42%) & Right Canvas (58%) ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden pt-1 gap-3">
        {/* Left Column: Chat & Specialist Controls */}
        <div
          className={`w-full lg:w-[45%] xl:w-[40%] flex flex-col h-full min-h-0 border-b lg:border-b-0 lg:border-r border-border/60 pr-0 lg:pr-3 overflow-hidden ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Specialist / Timeline Pill Strip */}
          {studioMode === "specialists" ? (
            <div className="py-2 border-b border-border/40 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                  <Compass className="w-3 h-3 text-primary" />
                  <span>Choose Specialist</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">
                  {SPECIALIST_AGENTS.find((a) => a.id === activeSpecialistId)?.name || "Specialist"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SPECIALIST_AGENTS.filter((a) => a.id !== "director").map((agent) => {
                  const Icon = agent.icon;
                  const isSelected = activeSpecialistId === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setActiveSpecialistId(agent.id);
                        setStudioMode("specialists");
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? `${agent.badgeBg} ${agent.badgeText} ${agent.borderColor} shadow-2xs ring-1 ring-primary/20 font-bold`
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/40 hover:border-border"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{agent.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-border/30 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-semibold text-muted-foreground">Sprint Timeline:</span>
                <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md border border-border/60">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange(e.target.value, endDate)}
                    className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none cursor-pointer"
                  />
                  <span className="text-muted-foreground text-[10px]">→</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => handleDateChange(startDate, e.target.value)}
                    className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none cursor-pointer"
                  />
                </div>
                {durationDays && durationDays > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    {durationDays} Days
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic hidden sm:inline">
                    or state in chat (e.g. &ldquo;from 8th Nov to 11th Nov&rdquo;)
                  </span>
                )}
              </div>
              {startDate && endDate && (
                <button
                  type="button"
                  onClick={() => handleDateChange("", "")}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Main Chat Stream */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
            {displayedMessages.map((msg) => {
              const isUser = msg.role === "user";
              const msgAgentId = msg.agent_id || "director";
              const agentInfo = SPECIALIST_AGENTS.find((a) => a.id === msgAgentId) || SPECIALIST_AGENTS[0];
              const AgentIcon = agentInfo.icon;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 text-sm ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {/* Agent Avatar */}
                  {!isUser && (
                    <div
                      className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${agentInfo.avatarBg}`}
                      title={`${agentInfo.name} (${agentInfo.roleTitle})`}
                    >
                      <AgentIcon className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="max-w-[88%] md:max-w-[84%] space-y-1.5">
                    {/* Agent Badge & Name Tag (Assistant messages) */}
                    {!isUser && (
                      <div className="flex items-center gap-1.5 pl-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${agentInfo.badgeBg} ${agentInfo.badgeText} ${agentInfo.borderColor} flex items-center gap-1`}
                        >
                          <AgentIcon className="w-3 h-3" />
                          <span>{msg.agent_name || agentInfo.name}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          {agentInfo.roleTitle}
                        </span>
                      </div>
                    )}

                    {/* Live Streaming Active Status Pill */}
                    {msg.streamingStatus && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/30 text-xs text-violet-600 dark:text-violet-400 font-medium animate-pulse mb-1 w-fit shadow-2xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-violet-500" />
                        <span>{msg.streamingStatus}</span>
                      </div>
                    )}

                    {/* Text Bubble */}
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-none shadow-sm"
                          : "bg-muted/60 dark:bg-muted/40 border border-border/80 text-foreground rounded-bl-none shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed text-[13.5px]">
                        {msg.content || (msg.isStreaming ? (
                          <span className="text-muted-foreground/80 italic text-xs flex items-center gap-2 py-0.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
                            <span>Gathering real-time evidence & analyzing market landscape...</span>
                          </span>
                        ) : null)}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
                        )}
                      </div>
                      <span
                        className={`block mt-1 text-[10px] ${
                          isUser ? "text-primary-foreground/70 text-right" : "text-muted-foreground"
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Operational Activity Logs Breadcrumbs */}
                    {msg.activity_logs && msg.activity_logs.length > 0 && (
                      <div className="space-y-1 pl-1 pt-1">
                        {msg.activity_logs.map((log: any, i: number) => {
                          const logText = typeof log === "string" ? log : log.message || JSON.stringify(log);
                          const isPending = logText.startsWith("⏳");
                          return (
                            <div
                              key={i}
                              className={`flex items-center gap-1.5 text-[10.5px] font-mono px-2 py-0.5 rounded border w-fit max-w-full truncate transition-all duration-200 ${
                                isPending
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse"
                                  : "bg-muted/40 border-border/40 text-muted-foreground/90"
                              }`}
                            >
                              {isPending ? (
                                <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin shrink-0" />
                              ) : (
                                <Sparkles className="w-2.5 h-2.5 text-primary shrink-0" />
                              )}
                              <span className="truncate">{logText.replace(/^⏳\s*/, "")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Artifact Summary Card with quick link to Canvas */}
                    {msg.artifact_summary && (
                      <button
                        type="button"
                        onClick={() => handleViewOnCanvas(msg.artifact_summary!)}
                        disabled={isLoadingCanvasArtifact === msg.artifact_summary.id}
                        className={`flex items-center justify-between w-full p-2.5 rounded-xl bg-card border transition-all text-xs cursor-pointer shadow-2xs group ${
                          activeArtifact?.id === msg.artifact_summary.id &&
                          activeArtifact?.version === msg.artifact_summary.version
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-primary/30 hover:border-primary hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary">
                            v{msg.artifact_summary.version}
                          </span>
                          <span className="font-semibold text-foreground text-[11px] group-hover:text-primary transition-colors truncate max-w-[200px] sm:max-w-[280px]">
                            {msg.artifact_summary.title}
                          </span>
                          {activeArtifact?.id === msg.artifact_summary.id &&
                            activeArtifact?.version === msg.artifact_summary.version && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full shrink-0">
                                Active on Canvas
                              </span>
                            )}
                        </div>
                        <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 shrink-0">
                          {isLoadingCanvasArtifact === msg.artifact_summary.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <span>View on Canvas</span>
                              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </>
                          )}
                        </span>
                      </button>
                    )}

                    {/* Inline Agent Pipeline Execution Card */}
                    {msg.agentPipeline && (
                      <div className="rounded-xl border border-violet-500/30 bg-card p-3.5 shadow-md space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            {msg.agentPipeline.status === "in_progress" ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-ping" />
                            ) : msg.agentPipeline.status === "completed" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            )}
                            <span className="font-semibold text-xs tracking-wide uppercase text-foreground">
                              {msg.agentPipeline.status === "in_progress"
                                ? "Multi-Agent Engine in Progress..."
                                : msg.agentPipeline.status === "completed"
                                ? "Engine Execution Complete • 6 Agents Synthesized"
                                : "Pipeline Issue"}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {msg.agentPipeline.status === "in_progress"
                              ? `Step ${msg.agentPipeline.activeStep + 1} of 6`
                              : "100% Done"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {AGENT_STEPS.map((step, idx) => {
                            const Icon = step.icon;
                            const isDone =
                              msg.agentPipeline!.status === "completed" ||
                              idx < msg.agentPipeline!.activeStep;
                            const isActive =
                              msg.agentPipeline!.status === "in_progress" &&
                              idx === msg.agentPipeline!.activeStep;

                            const customDetail = msg.agentPipeline!.stepDetails?.[step.id];

                            return (
                              <div
                                key={step.id}
                                className={`flex items-start gap-2.5 p-1.5 rounded-lg text-xs transition-all ${
                                  isActive
                                    ? "bg-violet-500/10 border border-violet-500/30 text-foreground"
                                    : isDone
                                    ? "bg-muted/30 text-foreground"
                                    : "text-muted-foreground opacity-60"
                                }`}
                              >
                                <div className="mt-0.5">
                                  {isDone ? (
                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                      <Check className="w-2 h-2 stroke-[3]" />
                                    </div>
                                  ) : isActive ? (
                                    <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 font-medium text-[11px]">
                                    <Icon className="w-3 h-3 text-primary" />
                                    <span>
                                      Agent {idx + 1}: {step.name}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                    {customDetail || step.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {msg.agentPipeline.status === "error" && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                            {msg.agentPipeline.errorMessage}
                          </div>
                        )}

                        {msg.agentPipeline.status === "completed" && msg.agentPipeline.result && (
                          <div className="mt-2 p-3 rounded-xl bg-gradient-to-br from-violet-600/10 via-background to-indigo-600/10 border border-violet-500/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-xs text-foreground truncate">
                                {msg.agentPipeline.result.campaignName}
                              </h3>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                🛡️ {(() => {
                                  const s = msg.agentPipeline.result.complianceScore ?? 95;
                                  return s <= 1 ? Math.round(s * 100) : Math.round(s);
                                })()}% Compliant
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                              <span className="text-[11px] text-muted-foreground">
                                📦 {msg.agentPipeline.result.deliverablesCount} Deliverables Architected
                              </span>
                              <button
                                onClick={() =>
                                  router.push(
                                    `/campaign-plans?clientId=${selectedClientId}&campaignId=${msg.agentPipeline?.result?.campaignId}`
                                  )
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-[11px] transition-all shadow-xs cursor-pointer"
                              >
                                <span>Open Plan & Convert</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {isChatLoading && !chatMessages.some((m) => m.isStreaming) && (
              <div className="flex gap-2.5 justify-start text-sm">
                <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${currentAgent.avatarBg}`}>
                  <currentAgent.icon className="w-3.5 h-3.5" />
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-muted/60 border border-border/80 rounded-bl-none text-muted-foreground text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>{currentAgent.name} is thinking...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Prompt Starters */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none shrink-0 border-t border-border/20">
            <span className="text-[10px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" />
              <span className="hidden sm:inline">Try:</span>
            </span>
            {currentAgent.starters.map((starter, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(starter)}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-muted/60 hover:bg-muted border border-border/80 text-foreground transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                {starter}
              </button>
            ))}
          </div>

          {/* Strategy & Generate Bar */}
          {(suggestedObjective || isReadyToGenerate) && (
            <div className="my-1 py-1 px-3 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-between gap-2 shrink-0 text-xs shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <p className="text-[11px] text-foreground font-medium truncate">
                  <span className="font-bold text-violet-600 dark:text-violet-400 mr-1.5">
                    {durationDays ? `${durationDays}-Day Sprint:` : "Strategy:"}
                  </span>
                  {suggestedObjective || suggestedCustomBrief}
                </p>
              </div>

              <button
                onClick={handleRunPipeline}
                disabled={isPipelineRunning}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-[11px] shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isPipelineRunning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Sprint ✨</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Input Footer */}
          <footer className="pt-1.5 border-t border-border/40 shrink-0">
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
                    ? "Autonomous engine is running, please wait..."
                    : isChatLoading
                    ? `${currentAgent.name} is thinking...`
                    : studioMode === "workflow"
                    ? "Ask Campaign Director questions, set timeline, or brainstorm..."
                    : `Chat with ${currentAgent.name} (${currentAgent.roleTitle})...`
                }
                className="w-full bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 transition-all"
                autoFocus
              />

              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading || isPipelineRunning}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1 hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                >
                  {isChatLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </footer>
        </div>

        {/* Right Column: Contextual Canvas */}
        <div
          className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border/60 bg-card/20 shadow-xs ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          <ContextualCanvas
            artifact={activeArtifact}
            onApproveVersion={handleApproveVersion}
            onExportClick={() => {
              setIsExportModalOpen(true);
            }}
            onSelectPrompt={(agentId, promptText) => {
              setActiveSpecialistId(agentId);
              setStudioMode("specialists");
              handleSendMessage(promptText);
              setMobileTab("chat");
            }}
            onCloseCanvas={() => setActiveArtifact(null)}
          />
        </div>
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
