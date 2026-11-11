"use client";

import React from "react";
import { ResearchEvidencePayload } from "./types";
import {
  Search,
  ExternalLink,
  Target,
  Sparkles,
  ShieldCheck,
  Compass,
} from "lucide-react";

interface ResearchPanelProps {
  payload: ResearchEvidencePayload;
}

export function ResearchPanel({ payload }: ResearchPanelProps) {
  const competitors = payload.observed_competitors || [];
  const opportunities = payload.inferred_opportunities || [];

  return (
    <div className="space-y-6">
      {/* ── Query Topic Header ── */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {payload.query_topic || "Market & Trend Research Evidence"}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Grounded in verified external publisher citations</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Observed Competitors ── */}
      {competitors.length > 0 && (
        <div className="space-y-3.5">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" />
            <span>Observed Competitor Activity ({competitors.length})</span>
          </h4>

          <div className="space-y-3">
            {competitors.map((comp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">
                    {comp.competitor_name}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    {comp.platform}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Observed Angle
                    </span>
                    <p className="font-medium text-foreground mt-0.5 text-[11px]">
                      {comp.observed_creative_angle}
                    </p>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Observed Format
                    </span>
                    <p className="font-medium text-foreground mt-0.5 text-[11px]">
                      {comp.observed_format}
                    </p>
                  </div>
                </div>

                {comp.citation && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground">
                      Source: {comp.citation.publisher} ({comp.citation.source_title})
                    </span>
                    {comp.citation.source_url && (
                      <a
                        href={comp.citation.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <span>View Source</span>
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

      {/* ── Inferred Whitespace Opportunities ── */}
      {opportunities.length > 0 && (
        <div className="space-y-3.5">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-primary" />
            <span>Inferred Market Whitespace Opportunities ({opportunities.length})</span>
          </h4>

          <div className="space-y-3">
            {opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-sky-500/30 bg-card shadow-xs space-y-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span className="font-bold text-xs text-foreground">
                    Whitespace: {opp.target_whitespace}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  {opp.opportunity_description}
                </p>

                {opp.supporting_citations && opp.supporting_citations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Supporting Evidence Citations
                    </span>
                    {opp.supporting_citations.map((cite, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-muted/40 border border-border/60 text-[11px] flex items-center justify-between"
                      >
                        <span className="text-foreground truncate max-w-[80%]">
                          [{cite.publisher}] {cite.source_title}
                        </span>
                        {cite.source_url && (
                          <a
                            href={cite.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            <span>Link</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
