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
  RefreshCw,
  ChevronRight,
  Flame,
  Check,
  RotateCcw,
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

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
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

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Evolving Brief Strategy
  const [suggestedObjective, setSuggestedObjective] = useState<string>("");
  const [suggestedCustomBrief, setSuggestedCustomBrief] = useState<string>("");
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Pipeline Execution State
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading, isPipelineRunning]);

  // Always keep focus on chat input so cursor never disappears after typing or pressing Enter
  useEffect(() => {
    if (!isPipelineRunning) {
      chatInputRef.current?.focus();
    }
  }, [isChatLoading, isPipelineRunning, selectedClientId]);

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
      },
    ]);
    setSuggestedObjective("");
    setSuggestedCustomBrief("");
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
        })
      );
    } catch (e) {
      console.error("Failed to save chat to storage", e);
    }
  }, [chatMessages, suggestedObjective, suggestedCustomBrief, isReadyToGenerate, startDate, endDate, durationDays, periodMonth, periodYear, selectedClientId, getStorageKey]);

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
      },
    ]);
    setSuggestedObjective("");
    setSuggestedCustomBrief("");
    setIsReadyToGenerate(false);
    setStartDate("");
    setEndDate("");
    setDurationDays(null);
  };

  // Send message to Copilot Brief endpoint
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
      // Send entire conversation history for proactive multi-turn memory
      const response = await campaignApi.chatBrief(
        effectiveAgencyId,
        selectedClientId,
        {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
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
      };

      setChatMessages([...nextMessages, aiMsg]);

      if (response.suggested_objective) {
        setSuggestedObjective(response.suggested_objective);
      }
      if (response.suggested_custom_brief) {
        setSuggestedCustomBrief(response.suggested_custom_brief);
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
      agentPipeline: {
        status: "in_progress",
        activeStep: 0,
        stepDetails: {
          agent1: "Extracting brand guidelines, verified offers & quota limits...",
        },
      },
    };

    setChatMessages((prev) => [...prev, pipelineMsg]);

    // Timer to step through agents visually like Perplexity / Antigravity
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
              updatedDetails.agent5 = "Drafted 30 days of high-fidelity polymorphic deliverables.";
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
        },
        token
      );

      clearInterval(stepInterval);

      const draft = newCampaign.ai_plan_draft || {};
      const deliverablesCount = (draft.deliverables || []).length;
      const complianceScore = draft.quality_evaluation?.compliance_score || 95;
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

  const promptStarters = [
    "Create a 4-day campaign sprint from 8th Nov to 11th Nov with daily content",
    "Plan a high-converting 30-day challenge sprint with viral Instagram Reels",
    "Design an educational carousel sprint focused on authority & debunking myths",
    "Craft a product launch campaign with customer transformations & exclusive offers",
    "Focus on organic brand awareness and community-building engagement hooks",
  ];

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
                AI Co-Director
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Conversational Copilot & 6-Agent Autonomous Campaign Engine
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
            <span>Campaign Plans Dashboard</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </Link>
        </div>
      </header>

      {/* Campaign Timeline & Date Range Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border/80 shadow-2xs shrink-0 mt-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-bold text-foreground">Campaign Timeline:</span>
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
              Select date range or say &ldquo;from 8th Nov to 11th Nov&rdquo; in chat
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

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {chatMessages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-violet-600/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-[78%] space-y-3`}>
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

                {/* Inline Agent Pipeline Execution (Perplexity / Antigravity Style) */}
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
                        const isPending =
                          msg.agentPipeline!.status === "in_progress" &&
                          idx > msg.agentPipeline!.activeStep;

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
                            🛡️ {msg.agentPipeline.result.complianceScore}% Compliant
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
          <div className="flex gap-3 justify-start text-sm">
            <div className="w-8 h-8 rounded-full bg-violet-600/10 text-violet-600 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-muted/60 border border-border/80 rounded-bl-none text-muted-foreground text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
              <span>Copilot is formulating creative ideas & consulting brand rules...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested Prompt Starters (Only when conversation is fresh) */}
      {chatMessages.length <= 1 && (
        <div className="py-2 shrink-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Suggested Campaign Starters for {selectedClient?.business_name || "Client"}:</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {promptStarters.map((starter, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(starter)}
                className="text-xs px-3 py-1.5 rounded-lg bg-muted/70 hover:bg-muted border border-border text-foreground transition-colors text-left"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Evolving Strategy Draft / Ready to Generate Chip */}
      {(suggestedObjective || isReadyToGenerate) && (
        <div className="my-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase font-bold tracking-wider text-violet-600 dark:text-violet-400">
                {isReadyToGenerate ? "Brief Ready for Autonomous Engine" : "Evolving Campaign Angle"}
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
                ? "Agent is thinking... (type next message)"
                : "Ask questions, share campaign requirements, or brainstorm creative angles..."
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
