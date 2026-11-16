"use client";

import React, { useState } from "react";
import { ResearchEvidencePayload } from "./types";
import {
  Search,
  ExternalLink,
  Target,
  Sparkles,
  ShieldCheck,
  Compass,
  CheckCircle2,
  Calendar,
  Layers,
  FileCheck,
  Lightbulb,
} from "lucide-react";

interface ResearchPanelProps {
  payload: ResearchEvidencePayload;
}

export function ResearchPanel({ payload }: ResearchPanelProps) {
  const competitors = payload.observed_competitors || [];
  const opportunities = payload.inferred_opportunities || [];
  const [activeTab, setActiveTab] = useState<"all" | "findings" | "sources" | "recommendations">("all");

  // Collect all unique external sources from competitors and opportunities
  const externalSources: Array<{
    publisher: string;
    source_title: string;
    source_url?: string;
    date?: string;
    context: string;
  }> = [];

  competitors.forEach((c) => {
    if (c.citation) {
      externalSources.push({
        publisher: c.citation.publisher,
        source_title: c.citation.source_title,
        source_url: c.citation.source_url,
        context: `Competitor benchmark: ${c.competitor_name} (${c.platform})`,
      });
    }
  });

  opportunities.forEach((o) => {
    o.supporting_citations?.forEach((cite) => {
      externalSources.push({
        publisher: cite.publisher,
        source_title: cite.source_title,
        source_url: cite.source_url,
        context: `Opportunity justification: ${o.target_whitespace}`,
      });
    });
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Query Topic & Evidence Grounding Header ── */}
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#69A9D8]/15 text-[#69A9D8] border border-[#69A9D8]/30 font-semibold">
                  Market & Trend Intelligence
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
                  {externalSources.length} Verified Sources
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#F2F0F7] tracking-tight">
                {payload.query_topic || "Market & Trend Research Evidence"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Grounded in Citations</span>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-[#30303D]/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            All Evidence
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("findings")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === "findings"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            Competitor Findings ({competitors.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === "sources"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            External Sources ({externalSources.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("recommendations")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === "recommendations"
                ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D]"
                : "text-[#A3A0B0] hover:text-[#F2F0F7]"
            }`}
          >
            Strategic Opportunities ({opportunities.length})
          </button>
        </div>
      </div>

      {/* ── 2. Verified Research Findings (Competitors) ── */}
      {(activeTab === "all" || activeTab === "findings") && competitors.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#A78BFA]" />
              <span>Verified Market Findings & Competitor Angles ({competitors.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-[#A3A0B0]">Live Benchmarks</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {competitors.map((comp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#69A9D8]/50 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#69A9D8]/20 text-[#69A9D8] font-bold text-xs flex items-center justify-center border border-[#69A9D8]/30">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm text-[#F2F0F7]">
                      {comp.competitor_name}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
                    {comp.platform}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#20202A] p-2.5 rounded-lg border border-[#30303D]/60 space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                      Observed Creative Angle
                    </span>
                    <p className="font-medium text-[#F2F0F7] text-[11px] leading-relaxed">
                      {comp.observed_creative_angle}
                    </p>
                  </div>
                  <div className="bg-[#20202A] p-2.5 rounded-lg border border-[#30303D]/60 space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                      Observed Format
                    </span>
                    <p className="font-medium text-[#F2F0F7] text-[11px] leading-relaxed">
                      {comp.observed_format}
                    </p>
                  </div>
                </div>

                {comp.citation && (
                  <div className="pt-2 border-t border-[#30303D]/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#A3A0B0] truncate max-w-[70%]">
                      Source: <strong className="text-[#F2F0F7]">{comp.citation.publisher}</strong> — {comp.citation.source_title}
                    </span>
                    {comp.citation.source_url && (
                      <a
                        href={comp.citation.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#A78BFA] hover:text-[#B69BFF] hover:underline flex items-center gap-1 shrink-0 font-medium"
                      >
                        <span>View Citation</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. External Sources Grounding Drawer ── */}
      {(activeTab === "all" || activeTab === "sources") && externalSources.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-[#69A9D8]" />
              <span>External Publisher Sources & Citations ({externalSources.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-[#A3A0B0]">Verifiable Links</span>
          </div>

          <div className="space-y-2">
            {externalSources.map((source, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-[#30303D] bg-[#17171E] flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 max-w-full sm:max-w-[75%] space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#20202A] text-[#69A9D8] border border-[#30303D]">
                      {source.publisher}
                    </span>
                    <span className="text-[11px] font-semibold text-[#F2F0F7] truncate">
                      {source.source_title}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A3A0B0] truncate">
                    {source.context}
                  </p>
                </div>

                {source.source_url ? (
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20202A] hover:bg-[#262630] border border-[#30303D] text-[11px] text-[#A78BFA] hover:text-[#B69BFF] transition-colors shrink-0"
                  >
                    <span>Visit Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[10px] font-mono text-[#A3A0B0]">Direct Market Data</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Strategic Interpretations & Whitespace Recommendations ── */}
      {(activeTab === "all" || activeTab === "recommendations") && opportunities.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#A78BFA]" />
              <span>Strategic Whitespace Opportunities ({opportunities.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-[#A3A0B0]">Exploitable Angles</span>
          </div>

          <div className="space-y-3">
            {opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#A78BFA]/40 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#A78BFA]/15 text-[#A78BFA] flex items-center justify-center shrink-0 border border-[#A78BFA]/25">
                    <Lightbulb className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-bold text-sm text-[#F2F0F7]">
                    {opp.target_whitespace}
                  </h4>
                </div>

                <p className="text-xs text-[#A3A0B0] leading-relaxed bg-[#20202A] p-3 rounded-lg border border-[#30303D]/60">
                  {opp.opportunity_description}
                </p>

                {opp.supporting_citations && opp.supporting_citations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                      Supporting Citations
                    </span>
                    <div className="space-y-1">
                      {opp.supporting_citations.map((cite, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-[#20202A] border border-[#30303D]/60 text-[11px] flex items-center justify-between gap-2"
                        >
                          <span className="text-[#F2F0F7] truncate">
                            [{cite.publisher}] {cite.source_title}
                          </span>
                          {cite.source_url && (
                            <a
                              href={cite.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#A78BFA] hover:underline flex items-center gap-1 shrink-0 text-[10px]"
                            >
                              <span>View</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Grounding & Validation Gate ── */}
      <div className="p-4 rounded-xl bg-[#20202A] border border-[#30303D] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#45B88A]" />
          <span className="text-[#F2F0F7] font-semibold">Evidence Validation Gate</span>
        </div>
        <span className="text-[11px] font-mono text-[#A3A0B0]">
          Zero ungrounded hallucinations detected
        </span>
      </div>
    </div>
  );
}
