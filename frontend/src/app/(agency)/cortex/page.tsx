"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  clientApi,
  cortexApi,
  Client,
  CortexFactItem,
  CortexVaultResponse,
  CortexAskResponse,
} from "@/lib/api";
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Layers,
  AlertTriangle,
  History,
  FileCheck,
  UserCheck,
  Flame,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";

export default function CortexMemoryPage() {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : "");

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"queue" | "vault" | "ingest" | "ask">("queue");

  // State
  const [reviewQueue, setReviewQueue] = useState<CortexFactItem[]>([]);
  const [vaultData, setVaultData] = useState<CortexVaultResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [vaultViewMode, setVaultViewMode] = useState<"cards" | "document">("cards");

  // Ingestion form state
  const [ingestMode, setIngestMode] = useState<"document" | "transcript">("document");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [callDate, setCallDate] = useState("");
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCallDate(new Date().toISOString().slice(0, 10));
  }, []);

  // Ask Brain state
  const [askQuery, setAskQuery] = useState("");
  const [askingBrain, setAskingBrain] = useState(false);
  const [askResult, setAskResult] = useState<CortexAskResponse | null>(null);

  // Load clients
  useEffect(() => {
    if (!token || !effectiveAgencyId) return;
    clientApi
      .list(effectiveAgencyId, token)
      .then((res: any) => {
        const clientList = Array.isArray(res) ? res : res.data || [];
        setClients(clientList);
        if (clientList.length > 0 && !selectedClientId) {
          setSelectedClientId(clientList[0].id);
        }
      })
      .catch((err) => console.error("Failed to load clients for Cortex:", err));
  }, [token, effectiveAgencyId]);

  // Load Cortex data when client changes
  useEffect(() => {
    if (!token || !selectedClientId) return;
    loadCortexData();
  }, [token, selectedClientId]);

  const loadCortexData = async () => {
    if (!token || !selectedClientId) return;
    setLoading(true);
    try {
      const [queue, vault] = await Promise.all([
        cortexApi.getReviewQueue(selectedClientId, token).catch(() => []),
        cortexApi.getLivingVault(selectedClientId, token).catch(() => null),
      ]);
      setReviewQueue(queue || []);
      setVaultData(vault);
    } catch (err) {
      console.error("Error loading Cortex data:", err);
    } finally {
      setLoading(false);
    }
  };

  const taboos = useMemo(() => {
    return (vaultData?.active_facts || []).filter((f) => f.fact_type === "taboo");
  }, [vaultData]);

  const guardrails = useMemo(() => {
    return (vaultData?.active_facts || []).filter((f) => f.fact_type === "guardrail");
  }, [vaultData]);

  const personas = useMemo(() => {
    return (vaultData?.active_facts || []).filter((f) => f.fact_type === "persona");
  }, [vaultData]);

  const winningPatterns = useMemo(() => {
    return (vaultData?.active_facts || []).filter((f) => f.fact_type === "winning_pattern");
  }, [vaultData]);

  const handleReviewDecision = async (
    factId: string,
    action: "approve" | "supersede_existing" | "reject",
    targetSupersededId?: string
  ) => {
    if (!token) return;
    setActionLoading(factId);
    try {
      await cortexApi.reviewFact(
        factId,
        {
          action,
          target_superseded_fact_id: targetSupersededId,
        },
        token
      );
      // Reload queue & vault
      await loadCortexData();
    } catch (err) {
      console.error("Failed to execute review decision:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedClientId || !docContent.trim() || !docTitle.trim()) return;
    setActionLoading("ingest");
    setIngestSuccess(null);
    try {
      if (ingestMode === "document") {
        await cortexApi.ingestDocument(
          {
            client_id: selectedClientId,
            title: docTitle,
            content: docContent,
          },
          token
        );
      } else {
        await cortexApi.ingestTranscript(
          {
            client_id: selectedClientId,
            call_title: docTitle,
            transcript_text: docContent,
            call_date: callDate,
          },
          token
        );
      }
      setIngestSuccess(
        `Successfully ingested "${docTitle}". Vector indexed in pgvector & LangGraph extraction pipeline triggered!`
      );
      setDocTitle("");
      setDocContent("");
      // Switch to Review Queue and poll to display newly extracted candidate rules
      setActiveTab("queue");
      setTimeout(loadCortexData, 1000);
      setTimeout(loadCortexData, 3000);
      setTimeout(loadCortexData, 6000);
    } catch (err: any) {
      alert(err?.message || "Failed to ingest material");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAskBrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedClientId || !askQuery.trim()) return;
    setAskingBrain(true);
    setAskResult(null);
    try {
      const res = await cortexApi.askBrain(
        {
          client_id: selectedClientId,
          query: askQuery,
        },
        token
      );
      setAskResult(res);
    } catch (err: any) {
      alert(err?.message || "Ask Agency Brain query failed");
    } finally {
      setAskingBrain(false);
    }
  };

  const handleCopyVault = () => {
    if (!vaultData?.compiled_markdown) return;
    navigator.clipboard.writeText(vaultData.compiled_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <main className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#6B6A65] dark:text-[#A3A0B0]">
            <span>System</span>
            <span className="text-black/[0.2] dark:text-white/[0.2]">/</span>
            <span className="text-[#2383E2] dark:text-[#A78BFA] font-medium">Institutional Memory</span>
            <span className="px-1.5 py-0.2 rounded bg-black/[0.06] dark:bg-white/[0.06] text-[10px] font-bold text-[#191919] dark:text-white">
              v2.0 Cortex
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#191919] dark:text-[#F2F0F7] tracking-tight flex items-center gap-2.5">
            <Brain className="w-6 h-6 text-[#191919] dark:text-white" />
            AgencyOS Cortex
          </h1>
          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] max-w-2xl leading-relaxed">
            Deterministic brand guardrails, negative taboo enforcement, and pgvector semantic playbooks.
            Ensures zero brand drift across multi-agent campaign generation.
          </p>
        </div>

        {/* Client Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-[#6B6A65] dark:text-[#A3A0B0] hidden sm:inline">
            Active Brand:
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-white dark:bg-[#181822] text-xs font-medium text-[#191919] dark:text-[#F2F0F7] px-3 py-2 rounded-xl border border-black/[0.1] dark:border-white/[0.08] focus:outline-none focus:border-[#2383E2] shadow-2xs cursor-pointer min-w-[200px]"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name} ({c.industry || "General"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Navigation Tabs Toolstrip ── */}
      <div className="surface-card rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-1.5 flex items-center justify-between gap-2 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("queue")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "queue"
                ? "bg-[#191919] text-white dark:bg-white/[0.08] dark:text-[#F2F0F7] shadow-xs font-semibold"
                : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Memory Review Queue</span>
            {reviewQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold font-mono">
                {reviewQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("vault")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "vault"
                ? "bg-[#191919] text-white dark:bg-white/[0.08] dark:text-[#F2F0F7] shadow-xs font-semibold"
                : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Living Brand Vault</span>
            {vaultData && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/[0.06] dark:bg-white/[0.06] text-[10px] font-mono font-bold text-[#191919] dark:text-white">
                {vaultData.total_active_rules} rules
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ingest")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ingest"
                ? "bg-[#191919] text-white dark:bg-white/[0.08] dark:text-[#F2F0F7] shadow-xs font-semibold"
                : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#2383E2]" />
            <span>Ingest Knowledge</span>
          </button>

          <button
            onClick={() => setActiveTab("ask")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ask"
                ? "bg-[#191919] text-white dark:bg-white/[0.08] dark:text-[#F2F0F7] shadow-xs font-semibold"
                : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Ask Agency Brain</span>
          </button>
        </div>

        <button
          onClick={loadCortexData}
          disabled={loading}
          title="Refresh Cortex state"
          className="p-1.5 rounded-lg text-[#6B6A65] hover:text-[#191919] hover:bg-black/[0.04] dark:text-[#A3A0B0] dark:hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── TAB 1: MEMORY REVIEW QUEUE ── */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#191919] dark:text-[#F2F0F7] flex items-center gap-2">
              <span>Proposed Facts & Extracted Rules</span>
              <span className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] font-normal">
                (Human-in-the-loop Memory Gate)
              </span>
            </h2>
            <span className="text-xs font-mono text-[#6B6A65] dark:text-[#A3A0B0]">
              {reviewQueue.length} pending candidate{reviewQueue.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] py-16 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2383E2] mx-auto" />
              <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">Loading Memory Review Queue...</p>
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] border-dashed p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#191919] dark:text-white font-heading">
                All Memory Facts Reviewed
              </h3>
              <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] max-w-md mx-auto">
                No proposed facts are pending approval. Ingest new brand PDFs, call transcripts, or approve
                task revision triples to automatically extract fresh institutional knowledge.
              </p>
              <button
                onClick={() => setActiveTab("ingest")}
                className="px-3.5 py-1.5 rounded-xl bg-[#191919] hover:bg-[#2F2E2B] text-white text-xs font-medium transition cursor-pointer"
              >
                Ingest New Material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reviewQueue.map((fact) => {
                const hasConflict = Boolean(fact.conflicting_fact);
                return (
                  <div
                    key={fact.id}
                    className={`surface-card rounded-2xl border p-5 shadow-xs transition-all ${
                      hasConflict
                        ? "border-amber-500/30 bg-amber-500/[0.02]"
                        : "border-black/[0.08] dark:border-white/[0.08]"
                    }`}
                  >
                    {/* Header meta badge strip */}
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                            fact.fact_type === "taboo"
                              ? "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400"
                              : fact.fact_type === "guardrail"
                              ? "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400"
                              : fact.fact_type === "persona"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                              : "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400"
                          }`}
                        >
                          {fact.fact_type}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.05] text-[#6B6A65] dark:text-[#A3A0B0]">
                          Scope: {fact.scope}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.05] text-[#6B6A65] dark:text-[#A3A0B0]">
                          Channels: {fact.channels?.join(", ") || "all"}
                        </span>

                        <span className="text-[10px] font-mono text-[#6B6A65] dark:text-[#A3A0B0]">
                          Confidence: {Math.round(fact.confidence_score * 100)}%
                        </span>
                      </div>

                      {hasConflict && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Rule Conflict Detected
                        </span>
                      )}
                    </div>

                    {/* Conflict Diff Card Rendering */}
                    {hasConflict && fact.conflicting_fact ? (
                      <div className="mb-4 p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Currently Active Contradictory Rule */}
                        <div className="p-3 rounded-lg bg-white dark:bg-[#181822] border border-red-500/30 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-red-600 dark:text-red-400">
                            <span>CURRENTLY ACTIVE RULE</span>
                            <span>STATUS: ACTIVE</span>
                          </div>
                          <p className="text-xs font-semibold text-[#191919] dark:text-white">
                            {fact.conflicting_fact.statement}
                          </p>
                          {fact.conflicting_fact.rationale && (
                            <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                              {fact.conflicting_fact.rationale}
                            </p>
                          )}
                        </div>

                        {/* Proposed New Rule */}
                        <div className="p-3 rounded-lg bg-white dark:bg-[#181822] border border-emerald-500/30 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            <span>PROPOSED REPLACEMENT</span>
                            <span>STATUS: PROPOSED</span>
                          </div>
                          <p className="text-xs font-semibold text-[#191919] dark:text-white">
                            {fact.statement}
                          </p>
                          {fact.rationale && (
                            <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                              {fact.rationale}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Normal Statement Display */
                      <div className="space-y-1.5 mb-4">
                        <h3 className="text-sm font-semibold text-[#191919] dark:text-[#F2F0F7] leading-snug">
                          {fact.statement}
                        </h3>
                        {fact.rationale && (
                          <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] leading-relaxed">
                            {fact.rationale}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Provenance Quote & Citation */}
                    {fact.provenance_quote && (
                      <div className="p-2.5 rounded-lg bg-[#F7F6F3] dark:bg-[#121218] border border-black/[0.06] dark:border-white/[0.04] text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] italic mb-4">
                        <span>"{fact.provenance_quote}"</span>
                        {fact.provenance_location && (
                          <span className="not-italic font-mono text-[10px] ml-2 text-[#9B9A97]">
                            [{fact.provenance_location}]
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.04]">
                      <button
                        onClick={() => handleReviewDecision(fact.id, "reject")}
                        disabled={actionLoading === fact.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-500/10 dark:text-rose-400 transition cursor-pointer"
                      >
                        Reject Fact
                      </button>

                      {hasConflict && fact.conflicting_fact ? (
                        <button
                          onClick={() =>
                            handleReviewDecision(
                              fact.id,
                              "supersede_existing",
                              fact.conflicting_fact?.id
                            )
                          }
                          disabled={actionLoading === fact.id}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Supersede Active Rule</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReviewDecision(fact.id, "approve")}
                          disabled={actionLoading === fact.id}
                          className="px-3.5 py-1.5 rounded-lg bg-[#191919] hover:bg-[#2F2E2B] text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Rule</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: LIVING BRAND VAULT (STRICTLY READ-ONLY) ── */}
      {activeTab === "vault" && (
        <div className="space-y-4">
          <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase text-[#6B6A65] dark:text-[#A3A0B0]">
                  Living Brand Document
                </span>
                <span className="text-sm font-bold text-[#191919] dark:text-white">
                  {selectedClient?.business_name || vaultData?.client_name || "Brand Brain"}
                </span>
              </div>

              <div className="h-6 w-[1px] bg-black/[0.08] dark:bg-white/[0.08] hidden sm:block" />

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-mono font-bold">
                  {vaultData?.taboos_count || 0} Taboos
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-mono font-bold">
                  {vaultData?.guardrails_count || 0} Guardrails
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-mono font-bold">
                  {vaultData?.personas_count || 0} Personas
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold">
                  {vaultData?.winning_patterns_count || 0} Patterns
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-[#F7F6F3] dark:bg-[#101014] rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setVaultViewMode("cards")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    vaultViewMode === "cards"
                      ? "bg-white dark:bg-[#181822] text-[#191919] dark:text-white shadow-xs font-semibold"
                      : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Interactive Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVaultViewMode("document")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    vaultViewMode === "document"
                      ? "bg-white dark:bg-[#181822] text-[#191919] dark:text-white shadow-xs font-semibold"
                      : "text-[#6B6A65] dark:text-[#A3A0B0] hover:text-[#191919] dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Clean Document</span>
                </button>
              </div>

              <button
                onClick={handleCopyVault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFEFED] hover:bg-[#E5E5E2] text-[#191919] text-xs font-medium border border-black/[0.08] dark:bg-[#181822] dark:hover:bg-[#20202B] dark:text-white dark:border-white/[0.08] transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied Markdown" : "Copy Vault"}</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE: DOCUMENT */}
          {vaultViewMode === "document" && (
            <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06] text-xs text-[#6B6A65] dark:text-[#A3A0B0]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2383E2]" />
                  <span>Executive Compiled Brief — Loaded deterministically into all AI generation pipelines</span>
                </div>
                <span className="font-mono text-[11px] text-[#8C8B85] dark:text-[#8E8B9E]">
                  Last compiled: {vaultData?.last_recompiled_at ? new Date(vaultData.last_recompiled_at).toLocaleString() : "Just now"}
                </span>
              </div>
              <MarkdownRenderer content={vaultData?.compiled_markdown || "No active institutional facts recorded for this brand yet."} />
            </div>
          )}

          {/* VIEW MODE: INTERACTIVE CARDS */}
          {vaultViewMode === "cards" && (
            <>
              {(!vaultData || vaultData.total_active_rules === 0) ? (
                <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center mx-auto text-[#6B6A65] dark:text-[#A3A0B0]">
                    <Brain className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#191919] dark:text-white">
                    No Active Institutional Rules Yet
                  </h3>
                  <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] max-w-md mx-auto">
                    Ingest meeting transcripts or brand documents in the &ldquo;Ingest Knowledge&rdquo; tab and approve proposed facts in the &ldquo;Review Queue&rdquo; to populate the Living Brand Vault.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Category 1: Negative Boundaries & Hard Taboos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#191919] dark:text-white">
                            Negative Boundaries & Hard Taboos
                          </h3>
                          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                            Deterministic hard constraints enforced to prevent legal risk and brand drift
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-mono font-bold">
                        {taboos.length} Rules Enforced
                      </span>
                    </div>

                    {taboos.length === 0 ? (
                      <p className="text-xs text-[#8C8B85] dark:text-[#8E8B9E] italic py-2">
                        No active negative boundaries recorded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {taboos.map((fact) => (
                          <div
                            key={fact.id}
                            className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] dark:border-rose-500/30 space-y-2.5 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300">
                                  Rule {fact.id.slice(0, 8)}
                                </span>
                                {fact.channels && fact.channels.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {fact.channels.map((ch, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] text-[#4A4944] dark:text-[#D1CFD7]"
                                      >
                                        {ch}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <p className="text-xs font-semibold text-[#191919] dark:text-white leading-relaxed">
                                {fact.statement}
                              </p>

                              {fact.rationale && (
                                <div className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] flex items-start gap-1.5">
                                  <span className="font-semibold text-[#191919] dark:text-white shrink-0">Rationale:</span>
                                  <span>{fact.rationale}</span>
                                </div>
                              )}
                            </div>

                            {fact.provenance_quote && (
                              <div className="text-[11px] italic bg-white/70 dark:bg-black/30 p-2.5 rounded-lg border-l-2 border-rose-500 text-[#4A4944] dark:text-[#D1CFD7] mt-2">
                                &ldquo;{fact.provenance_quote}&rdquo;
                                {fact.provenance_location && (
                                  <span className="block mt-1 not-italic font-mono text-[9px] text-[#8C8B85] dark:text-[#8E8B9E]">
                                    Verified Citation: {fact.provenance_location}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category 2: Brand Guardrails & Quality Standards */}
                  <div className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#191919] dark:text-white">
                            Active Brand Guardrails & Quality Standards
                          </h3>
                          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                            Prescribed brand voice guidelines, performance metrics, and messaging standards
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-mono font-bold">
                        {guardrails.length} Standards Active
                      </span>
                    </div>

                    {guardrails.length === 0 ? (
                      <p className="text-xs text-[#8C8B85] dark:text-[#8E8B9E] italic py-2">
                        No active guardrails recorded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {guardrails.map((fact) => (
                          <div
                            key={fact.id}
                            className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.02] dark:bg-blue-500/[0.04] dark:border-blue-500/30 space-y-2.5 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
                                  Rule {fact.id.slice(0, 8)}
                                </span>
                                {fact.channels && fact.channels.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {fact.channels.map((ch, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] text-[#4A4944] dark:text-[#D1CFD7]"
                                      >
                                        {ch}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <p className="text-xs font-semibold text-[#191919] dark:text-white leading-relaxed">
                                {fact.statement}
                              </p>

                              {fact.rationale && (
                                <div className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] flex items-start gap-1.5">
                                  <span className="font-semibold text-[#191919] dark:text-white shrink-0">Rationale:</span>
                                  <span>{fact.rationale}</span>
                                </div>
                              )}
                            </div>

                            {fact.provenance_quote && (
                              <div className="text-[11px] italic bg-white/70 dark:bg-black/30 p-2.5 rounded-lg border-l-2 border-blue-500 text-[#4A4944] dark:text-[#D1CFD7] mt-2">
                                &ldquo;{fact.provenance_quote}&rdquo;
                                {fact.provenance_location && (
                                  <span className="block mt-1 not-italic font-mono text-[9px] text-[#8C8B85] dark:text-[#8E8B9E]">
                                    Verified Citation: {fact.provenance_location}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category 3: Target Audience Personas */}
                  <div className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#191919] dark:text-white">
                            Target Audience Personas
                          </h3>
                          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                            Verified buyer roles, decision-maker profiles, and ICP criteria
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-mono font-bold">
                        {personas.length} Personas
                      </span>
                    </div>

                    {personas.length === 0 ? (
                      <p className="text-xs text-[#8C8B85] dark:text-[#8E8B9E] italic py-2">
                        No active personas recorded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {personas.map((fact) => (
                          <div
                            key={fact.id}
                            className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/[0.02] dark:bg-purple-500/[0.04] dark:border-purple-500/30 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300">
                                Persona {fact.id.slice(0, 8)}
                              </span>
                              {fact.channels && fact.channels.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {fact.channels.map((ch, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] text-[#4A4944] dark:text-[#D1CFD7]"
                                    >
                                      {ch}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="text-xs font-semibold text-[#191919] dark:text-white leading-relaxed">
                              {fact.statement}
                            </p>

                            {fact.rationale && (
                              <div className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] flex items-start gap-1.5">
                                <span className="font-semibold text-[#191919] dark:text-white shrink-0">Profile Detail:</span>
                                <span>{fact.rationale}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category 4: Proven Winning Patterns & Playbooks */}
                  <div className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#191919] dark:text-white">
                            Proven Winning Patterns & Playbooks
                          </h3>
                          <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0]">
                            Validated high-converting messaging frameworks and channel strategies
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold">
                        {winningPatterns.length} Playbooks
                      </span>
                    </div>

                    {winningPatterns.length === 0 ? (
                      <p className="text-xs text-[#8C8B85] dark:text-[#8E8B9E] italic py-2">
                        No active winning patterns recorded.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {winningPatterns.map((fact) => (
                          <div
                            key={fact.id}
                            className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] dark:border-emerald-500/30 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                Playbook {fact.id.slice(0, 8)}
                              </span>
                              {fact.channels && fact.channels.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {fact.channels.map((ch, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] text-[#4A4944] dark:text-[#D1CFD7]"
                                    >
                                      {ch}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="text-xs font-semibold text-[#191919] dark:text-white leading-relaxed">
                              {fact.statement}
                            </p>

                            {fact.rationale && (
                              <div className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] flex items-start gap-1.5">
                                <span className="font-semibold text-[#191919] dark:text-white shrink-0">Mechanics:</span>
                                <span>{fact.rationale}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 3: INGEST KNOWLEDGE ── */}
      {activeTab === "ingest" && (
        <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#191919] dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-[#2383E2]" />
              Zero-OAuth Institutional Ingestion
            </h2>
            <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">
              Ingest raw brand documents, strategy notes, or speaker-diarized call transcripts.
              The LangGraph pipeline chunks and indexes content into pgvector, extracts facts, and queues them for human review.
            </p>
          </div>

          {/* Ingestion Mode Toggle */}
          <div className="flex items-center gap-2 p-1 bg-[#F7F6F3] dark:bg-[#101014] rounded-xl border border-black/[0.08] dark:border-white/[0.08] w-fit">
            <button
              type="button"
              onClick={() => setIngestMode("document")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                ingestMode === "document"
                  ? "bg-white dark:bg-[#181822] text-[#191919] dark:text-white shadow-xs font-semibold"
                  : "text-[#6B6A65] dark:text-[#A3A0B0]"
              }`}
            >
              📄 Brand Document / PDF / Markdown
            </button>
            <button
              type="button"
              onClick={() => setIngestMode("transcript")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                ingestMode === "transcript"
                  ? "bg-white dark:bg-[#181822] text-[#191919] dark:text-white shadow-xs font-semibold"
                  : "text-[#6B6A65] dark:text-[#A3A0B0]"
              }`}
            >
              🎙️ Call Transcript / Meeting Notes
            </button>
          </div>

          {ingestSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{ingestSuccess}</span>
            </div>
          )}

          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#191919] dark:text-white mb-1.5">
                {ingestMode === "document" ? "Document Title" : "Call Title / Meeting Name"}
              </label>
              <input
                type="text"
                required
                placeholder={
                  ingestMode === "document"
                    ? "e.g. Acme Q4 Product & Brand Positioning Guidelines"
                    : "e.g. Client Strategy Kickoff Call (Founder & VP Marketing)"
                }
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full bg-white dark:bg-[#121218] border border-black/[0.1] dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#191919] dark:text-white placeholder:text-[#9B9A97] focus:outline-none focus:border-[#2383E2]"
              />
            </div>

            {ingestMode === "transcript" && (
              <div>
                <label className="block text-xs font-medium text-[#191919] dark:text-white mb-1.5">
                  Call Date
                </label>
                <input
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  className="bg-white dark:bg-[#121218] border border-black/[0.1] dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-[#191919] dark:text-white focus:outline-none focus:border-[#2383E2]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#191919] dark:text-white mb-1.5">
                {ingestMode === "document" ? "Raw Document Text (Markdown)" : "Diarized Transcript Text"}
              </label>
              <textarea
                rows={10}
                required
                placeholder={
                  ingestMode === "document"
                    ? "Paste brand guidelines, tone rules, audience notes, or value propositions here..."
                    : "[00:00] Client: We never want to compare our pricing against AWS...\n[01:15] Agency: Got it, we will highlight enterprise security and SOC-2 compliance..."
                }
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="w-full bg-white dark:bg-[#121218] border border-black/[0.1] dark:border-white/[0.08] rounded-xl p-3.5 text-xs text-[#191919] dark:text-white placeholder:text-[#9B9A97] focus:outline-none focus:border-[#2383E2] font-mono leading-relaxed resize-y"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading === "ingest" || !docContent.trim() || !docTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[#191919] hover:bg-[#2F2E2B] text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading === "ingest" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>Run Ingestion & Extraction DAG</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 4: ASK AGENCY BRAIN ── */}
      {activeTab === "ask" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#191919] dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                Ask Agency Brain (Hybrid Semantic & Deterministic Q&A)
              </h2>
              <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0]">
                Queries active SQL rules and pgvector knowledge chunks simultaneously with exact source citations.
              </p>
            </div>

            <form onSubmit={handleAskBrain} className="relative flex items-center">
              <input
                type="text"
                placeholder="Ask about brand guardrails, taboo words, competitor rules, or winning hooks..."
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                className="w-full bg-[#F7F6F3] dark:bg-[#121218] border border-black/[0.1] dark:border-white/[0.08] rounded-xl px-4 py-3 pr-28 text-xs text-[#191919] dark:text-white placeholder:text-[#9B9A97] focus:outline-none focus:border-[#2383E2] shadow-2xs"
              />
              <button
                type="submit"
                disabled={askingBrain || !askQuery.trim()}
                className="absolute right-2 px-3.5 py-1.5 rounded-lg bg-[#191919] hover:bg-[#2F2E2B] text-white text-xs font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {askingBrain ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                <span>Query</span>
              </button>
            </form>
          </div>

          {/* Ask Brain Results */}
          {askResult && (
            <div className="surface-card rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] mb-2">
                  Institutional Answer
                </h3>
                <div className="p-4 rounded-xl bg-[#F7F6F3] dark:bg-[#14141B] border border-black/[0.06] dark:border-white/[0.04] text-xs">
                  <MarkdownRenderer content={askResult.answer} />
                </div>
              </div>

              {/* Active Guardrails Enforced */}
              {askResult.active_guardrails_applied && askResult.active_guardrails_applied.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Active Rules Enforced (Deterministic Recall)</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {askResult.active_guardrails_applied.map((rule, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[11px]"
                      >
                        ✓ {rule}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cited Sources from pgvector */}
              {askResult.cited_sources && askResult.cited_sources.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#2383E2]" />
                    <span>Cited Knowledge Chunks (HNSW Similarity)</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {askResult.cited_sources.map((src, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-white dark:bg-[#181822] border border-black/[0.08] dark:border-white/[0.08] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="font-bold text-[#191919] dark:text-white truncate">
                            {src.title}
                          </span>
                          <span className="text-[#2383E2] font-semibold">
                            {Math.round(src.similarity_score * 100)}% match
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6A65] dark:text-[#A3A0B0] line-clamp-3 italic">
                          "{src.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
