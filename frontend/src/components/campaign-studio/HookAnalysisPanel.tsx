"use client";

import React from "react";
import { HookComparisonPayload } from "./types";
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Target,
  Brain,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

interface HookAnalysisPanelProps {
  payload: HookComparisonPayload;
}

export function HookAnalysisPanel({ payload }: HookAnalysisPanelProps) {
  const hooks = payload.hooks || [];
  const recommendedId = payload.recommended_hook_id;

  return (
    <div className="space-y-6">
      {/* ── Topic Banner ── */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {payload.topic || "Hook Comparison & Retention Analysis"}
            </h3>
            {payload.target_audience && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Target className="w-3 h-3 text-primary" />
                <span>Target: {payload.target_audience}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Hook Comparison Grid ── */}
      <div className="space-y-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-primary" />
          <span>Comparative Hook Archetypes ({hooks.length} Variations)</span>
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {hooks.map((hook, idx) => {
            const isRecommended = recommendedId === hook.hook_id || idx === 0;

            return (
              <div
                key={hook.hook_id || idx}
                className={`p-4 rounded-xl border transition-all shadow-xs space-y-3 ${
                  isRecommended
                    ? "bg-card border-sky-500/60 ring-2 ring-sky-500/20"
                    : "bg-card border-border hover:border-border/80"
                }`}
              >
                {/* Header & Framework Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                      #{hook.hook_id || `hook_${idx + 1}`}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {hook.framework || "Direct Value"}
                    </span>
                  </div>

                  {isRecommended && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      <span>Recommended Angle</span>
                    </span>
                  )}
                </div>

                {/* Opening Line Quote */}
                <div className="p-3.5 rounded-lg bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/20 border-l-4 border-l-sky-500">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    &ldquo;{hook.opening_line}&rdquo;
                  </p>
                </div>

                {/* Scoring & Psychology Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Trigger
                    </span>
                    <p className="font-medium text-foreground mt-0.5 text-[11px] truncate">
                      {hook.psychological_trigger || "Curiosity"}
                    </p>
                  </div>

                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Clarity Rating
                    </span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 text-[11px]">
                      {hook.clarity_rating || "High"}
                    </p>
                  </div>

                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Fluff Detection
                    </span>
                    <p className="flex items-center gap-1 font-semibold mt-0.5 text-[11px]">
                      {hook.fluff_detected ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span className="text-amber-600 dark:text-amber-400">Filler Present</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">100% Crisp</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Pros & Cons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      <span>Strengths</span>
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {hook.pros}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <ThumbsDown className="w-3 h-3" />
                      <span>Risks / Trade-offs</span>
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {hook.cons}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
