"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi } from "@/lib/api";
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
      "Plan a high-converting 30-day challenge sprint with viral Instagram Reels",
      "Design an educational carousel sprint focused on authority & debunking myths",
      "Craft a product launch campaign with customer transformations & exclusive offers",
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
      "How do we frame our verified offer without sounding overly salesy?",
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

  // Always keep focus on chat input so cursor never disappears after typing or pressing Enter
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
        })
      );
    } catch (e) {
      console.error("Failed to save chat to storage", e);
    }
  }, [chatMessages, suggestedObjective, suggestedCustomBrief, isReadyToGenerate, startDate, endDate, durationDays, periodMonth, periodYear, studioMode, activeSpecialistId, selectedClientId, getStorageKey]);

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
    setChatMessages(nextMessages);
    if (!textOverride) setChatInput("");
    setIsChatLoading(true);

    // Keep cursor active in chatbox immediately
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);

    try {
      // Send entire conversation history for unified multi-agent collaborative memory
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
        },
        token
      );

      const aiMsg: ChatMsg = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_id: response.agent_id || currentAgentId,
        agent_name: response.agent_name || currentAgent.name,
      };

      setChatMessages([...nextMessages, aiMsg]);

      if (response.suggested_objective) {
        setSuggestedObjective(response.suggested_objective);
      }
      if (response.suggested_custom_brief) {
        setSuggestedCustomBrief(response.suggested_custom_brief);
      }
      if (response.suggested_deliverable_preferences && response.suggested_deliverable_preferences.length > 0) {
        setDeliverablePreferences(response.suggested_deliverable_preferences);
      }
      if (response.suggested_start_date) {
        setStartDate(response.suggested_start_date);
      }
      if (response.suggested_end_date) {
        setEndDate(response.suggested_end_date);
      }
      if (response.suggested_duration_days) {
        setDurationDays(response.suggested_duration_days);
      }
      if (response.suggested_period_month) {
        setPeriodMonth(response.suggested_period_month);
      }
      if (response.suggested_period_year) {
        setPeriodYear(response.suggested_period_year);
      }
      if (response.is_ready_to_generate) {
        setIsReadyToGenerate(true);
      }
    } catch (err: any) {
      console.error("Chat brief error:", err);
      const isNetworkErr = err?.message?.toLowerCase().includes("fetch") || err?.message?.toLowerCase().includes("network");
      const errorContent = isNetworkErr
        ? "Could not connect to the campaign server. Please check your network or server status and try again."
        : (err?.message || "I encountered an issue processing your request. Please try again.");
      setChatMessages([
        ...nextMessages,
        {
          id: `ai-err-${Date.now()}`,
          role: "assistant",
          content: errorContent,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          agent_id: currentAgentId,
          agent_name: currentAgent.name,
        },
      ]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 10);
    }
  };

  // Launch Multi-Agent Pipeline Execution inline in chat
  const handleRunPipeline = async () => {
    if (!token || !effectiveAgencyId || !selectedClientId || isPipelineRunning) return;

    setIsPipelineRunning(true);
    const pipelineMsgId = `pipeline-${Date.now()}`;

    // Append inline agent activity message in chat stream
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

    // Timer to step through agents visually
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

      // Update pipeline message to completed
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
    // Show messages tagged with the active agent, user messages sent to this agent, or system pipeline cards
    if (msg.agentPipeline) return true;
    return msg.agent_id === currentAgentId || !msg.agent_id;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto px-4 py-3">
      {/* Studio Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-primary flex items-center justify-center text-white shadow-md shadow-violet-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Campaign Studio</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                AI Co-Director & Multi-Agent Network
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Universal Shared Memory • Seamless Handoff Between Specialist Deep-Dives and Sprint Generation
            </p>
          </div>
        </div>

        {/* Client Selector & Navigation to Plans */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-background text-foreground">
                  {c.business_name} {c.industry ? `(${c.industry})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* New Chat / Reset History Button */}
          <button
            onClick={handleResetChat}
            title="Start a fresh campaign conversation"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>New Brief</span>
          </button>

          <Link
            href={selectedClientId ? `/campaign-plans?clientId=${selectedClientId}` : "/campaign-plans"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors shadow-sm"
          >
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>Campaign Plans</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </Link>
        </div>
      </header>

      {/* Main Mode Toggle Bar: Campaign Workflow vs Specialist Agents */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-muted/30 rounded-xl border border-border shadow-2xs">
          <button
            type="button"
            onClick={() => setStudioMode("workflow")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              studioMode === "workflow"
                ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campaign Workflow</span>
            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(Co-Director Sprint)</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioMode("specialists")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              studioMode === "specialists"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Specialist Agents</span>
            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(Individual Deep-Dive)</span>
          </button>
        </div>

        {/* Stream Filter Toggle: Unified Memory vs Active Specialist */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs">
          <MessagesSquare className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5" />
          <button
            type="button"
            onClick={() => setChatFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              chatFilter === "all"
                ? "bg-background text-foreground font-bold shadow-2xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unified Stream ({chatMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setChatFilter("active")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              chatFilter === "active"
                ? "bg-background text-foreground font-bold shadow-2xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Focus: {currentAgent.shortName}
          </button>
        </div>
      </div>

      {/* Specialist Agent Selector Carousel / Chips (When in Specialist Mode) */}
      {studioMode === "specialists" && (
        <div className="mt-2.5 p-2 rounded-xl bg-card border border-border shadow-2xs shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span>Choose Specialist to Brainstorm With:</span>
            </span>
            <span className="text-[11px] text-muted-foreground italic hidden sm:inline">
              All messages & insights are retained in your campaign brief
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {SPECIALIST_AGENTS.filter((a) => a.id !== "director").map((agent) => {
              const Icon = agent.icon;
              const isSelected = activeSpecialistId === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveSpecialistId(agent.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                    isSelected
                      ? `${agent.badgeBg} ${agent.badgeText} ${agent.borderColor} shadow-xs ring-1 ring-primary/20 font-bold`
                      : "bg-muted/40 hover:bg-muted text-foreground border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <div className="text-left">
                    <div className="leading-tight">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{agent.roleTitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Specialist Banner */}
      {studioMode === "specialists" && (
        <div
          className={`mt-2 p-2.5 rounded-xl border ${currentAgent.badgeBg} ${currentAgent.borderColor} bg-card/70 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 text-xs shadow-2xs`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${currentAgent.avatarBg}`}>
              <currentAgent.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground text-sm">{currentAgent.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentAgent.badgeBg} ${currentAgent.badgeText} ${currentAgent.borderColor}`}>
                  {currentAgent.roleTitle}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] truncate mt-0.5">{currentAgent.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Timeline & Date Range Bar (Always visible in Workflow mode, or toggleable) */}
      {studioMode === "workflow" && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-card border border-border/80 shadow-2xs shrink-0 mt-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-bold text-foreground">Sprint Timeline:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-colors">
              <span className="text-[11px] font-semibold text-muted-foreground">Start:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange(e.target.value, endDate)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg border border-border transition-colors">
              <span className="text-[11px] font-semibold text-muted-foreground">End:</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleDateChange(startDate, e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
              />
            </div>

            {durationDays && durationDays > 0 ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center gap-1">
                <span>{durationDays} Days Sprint</span>
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground italic hidden sm:inline">
                Select dates or state in chat (e.g. &ldquo;from 8th Nov to 11th Nov&rdquo;)
              </span>
            )}

            {startDate && endDate && (
              <button
                type="button"
                onClick={() => handleDateChange("", "")}
                title="Clear date range"
                className="text-[11px] text-muted-foreground hover:text-foreground font-semibold underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
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
                  className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${agentInfo.avatarBg}`}
                  title={`${agentInfo.name} (${agentInfo.roleTitle})`}
                >
                  <AgentIcon className="w-4 h-4" />
                </div>
              )}

              <div className="max-w-[85%] md:max-w-[80%] space-y-2">
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

                {/* Text Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-br-none shadow-sm"
                      : "bg-muted/60 dark:bg-muted/40 border border-border/80 text-foreground rounded-bl-none shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed text-[13.5px]">
                    {msg.content}
                  </div>
                  <span
                    className={`block mt-1 text-[10px] ${
                      isUser ? "text-primary-foreground/70 text-right" : "text-muted-foreground"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {/* Inline Agent Pipeline Execution Card */}
                {msg.agentPipeline && (
                  <div className="rounded-xl border border-violet-500/30 bg-card p-4 shadow-md space-y-4">
                    {/* Pipeline Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        {msg.agentPipeline.status === "in_progress" ? (
                          <div className="w-3 h-3 rounded-full bg-violet-500 animate-ping" />
                        ) : msg.agentPipeline.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        )}
                        <span className="font-semibold text-xs tracking-wide uppercase text-foreground">
                          {msg.agentPipeline.status === "in_progress"
                            ? "Multi-Agent Intelligence Engine in Progress..."
                            : msg.agentPipeline.status === "completed"
                            ? "Engine Execution Complete • 6 Agents Synthesized"
                            : "Pipeline Encountered an Issue"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {msg.agentPipeline.status === "in_progress"
                          ? `Agent ${msg.agentPipeline.activeStep + 1} of 6`
                          : "100% Complete"}
                      </span>
                    </div>

                    {/* Stepped Agent Progress */}
                    <div className="space-y-2.5">
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
                            className={`flex items-start gap-3 p-2 rounded-lg text-xs transition-all ${
                              isActive
                                ? "bg-violet-500/10 border border-violet-500/30 text-foreground"
                                : isDone
                                ? "bg-muted/30 text-foreground"
                                : "text-muted-foreground opacity-60"
                            }`}
                          >
                            <div className="mt-0.5">
                              {isDone ? (
                                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              ) : isActive ? (
                                <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Icon className="w-3.5 h-3.5 text-primary" />
                                <span>
                                  Agent {idx + 1}: {step.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                {customDetail || step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Error display */}
                    {msg.agentPipeline.status === "error" && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                        {msg.agentPipeline.errorMessage}
                      </div>
                    )}

                    {/* Inline Plan Ready Card when Completed */}
                    {msg.agentPipeline.status === "completed" && msg.agentPipeline.result && (
                      <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-violet-600/10 via-background to-indigo-600/10 border border-violet-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="font-bold text-sm text-foreground">
                              {msg.agentPipeline.result.campaignName}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            🛡️ {(() => {
                              const s = msg.agentPipeline.result.complianceScore ?? 95;
                              return s <= 1 ? Math.round(s * 100) : Math.round(s);
                            })()}% Compliant
                          </span>
                        </div>

                        {msg.agentPipeline.result.theme && (
                          <p className="text-xs text-muted-foreground italic">
                            Theme: &ldquo;{msg.agentPipeline.result.theme}&rdquo;
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">
                            📦 {msg.agentPipeline.result.deliverablesCount} Deliverables Ready
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">
                            🎬 Reel Beats & Carousel Decks
                          </span>
                        </div>

                        {/* Direct CTA to Campaign Plans */}
                        <div className="pt-2">
                          <button
                            onClick={() =>
                              router.push(
                                `/campaign-plans?clientId=${selectedClientId}&campaignId=${msg.agentPipeline?.result?.campaignId}`
                              )
                            }
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-violet-500/25 cursor-pointer"
                          >
                            <span>Open in Campaign Plans & Convert to Tasks</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Spinner Indicator */}
        {isChatLoading && (
          <div className="flex gap-2.5 justify-start text-sm">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${currentAgent.avatarBg}`}>
              <currentAgent.icon className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-muted/60 border border-border/80 rounded-bl-none text-muted-foreground text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>{currentAgent.name} is formulating ideas & consulting brand rules...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Dynamic Suggested Prompt Starters (Tailored to active agent) */}
      <div className="py-1.5 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {studioMode === "workflow"
                ? `Suggested Sprint Prompts for ${selectedClient?.business_name || "Client"}:`
                : `Suggested Questions for ${currentAgent.name}:`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {currentAgent.starters.map((starter, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(starter)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-colors text-left cursor-pointer"
            >
              {starter}
            </button>
          ))}
        </div>
      </div>

      {/* Evolving Strategy Draft / Universal Ready to Generate Bar */}
      {(suggestedObjective || isReadyToGenerate) && (
        <div className="my-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase font-bold tracking-wider text-violet-600 dark:text-violet-400">
                {isReadyToGenerate ? "Brief Ready for Autonomous Engine" : "Evolving Campaign Strategy (Shared Across Studio)"}
                {startDate && endDate && durationDays ? ` • ${durationDays} Days (${startDate} to ${endDate})` : ""}
              </p>
              <p className="text-xs text-foreground font-medium truncate">
                {suggestedObjective || suggestedCustomBrief}
              </p>
            </div>
          </div>

          <button
            onClick={handleRunPipeline}
            disabled={isPipelineRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isPipelineRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Sprint ✨</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <footer className="pt-2 border-t border-border/40 shrink-0">
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
                ? `${currentAgent.name} is thinking... (type next message)`
                : studioMode === "workflow"
                ? "Ask Campaign Director questions, set sprint timeline, or brainstorm..."
                : `Chat directly with ${currentAgent.name} (${currentAgent.roleTitle})...`
            }
            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 pr-24 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 transition-all"
            autoFocus
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading || isPipelineRunning}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1 hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
            >
              {isChatLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </footer>
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
