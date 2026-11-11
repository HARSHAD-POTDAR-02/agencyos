"use client";

import React from "react";
import { CampaignBlueprintPayload } from "./types";
import {
  Cpu,
  Calendar,
  Layers,
  Sparkles,
  PieChart,
} from "lucide-react";

interface BlueprintPanelProps {
  payload: CampaignBlueprintPayload;
}

export function BlueprintPanel({ payload }: BlueprintPanelProps) {
  const stages = payload.narrative_stages || [];
  const formatRatios = payload.format_mix_ratios || {};

  return (
    <div className="space-y-6">
      {/* ── Campaign Master Theme Header ── */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {payload.campaign_theme || "Strategic Campaign Blueprint"}
            </h3>
            {payload.master_slogan && (
              <p className="text-xs italic text-primary font-medium mt-0.5">
                &ldquo;{payload.master_slogan}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Multi-Stage Narrative Arc ── */}
      <div className="space-y-3.5">
        <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          <span>Sprint Narrative Pacing & Stages ({stages.length} Phases)</span>
        </h4>

        <div className="space-y-3">
          {stages.map((stage, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-xs text-foreground">
                    {stage.stage_name}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                  {stage.days_range}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                {stage.core_message}
              </p>

              {stage.deliverable_focus && stage.deliverable_focus.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                    Deliverables:
                  </span>
                  {stage.deliverable_focus.map((focus, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-medium"
                    >
                      {focus}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Recommended Format Mix ── */}
      {Object.keys(formatRatios).length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-primary" />
            <span>Recommended Deliverable Distribution</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(formatRatios).map(([fmt, pct]) => (
              <div
                key={fmt}
                className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-center"
              >
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  {fmt}
                </span>
                <span className="text-lg font-bold text-foreground">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
