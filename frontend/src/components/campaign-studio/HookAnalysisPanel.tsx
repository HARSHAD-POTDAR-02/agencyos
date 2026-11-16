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
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#F2F0F7]">
              {payload.topic || "Hook Comparison & Retention Analysis"}
            </h3>
            {payload.target_audience && (
              <p className="text-xs text-[#A3A0B0] flex items-center gap-1.5 mt-0.5">
                <Target className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Audience Target: {payload.target_audience}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Hook Comparison Grid ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-[#A78BFA]" />
            <span>Comparative Hook Archetypes ({hooks.length} Variations)</span>
          </h4>
          <span className="text-[11px] font-mono text-[#A3A0B0]">Arrest Analysis</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {hooks.map((hook, idx) => {
            const isRecommended = recommendedId === hook.hook_id || idx === 0;

            return (
              <div
                key={hook.hook_id || idx}
                className={`p-5 rounded-2xl border transition-all shadow-sm space-y-3.5 ${
                  isRecommended
                    ? "bg-[#17171E] border-[#A78BFA] ring-1 ring-[#A78BFA]/20"
                    : "bg-[#17171E] border-[#30303D] hover:border-[#30303D]/80"
                }`}
              >
                {/* Header & Framework Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#20202A] text-[#F2F0F7] border border-[#30303D]">
                      #{hook.hook_id || `hook_${idx + 1}`}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/20">
                      {hook.framework || "Direct Value"}
                    </span>
                  </div>

                  {isRecommended && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30 text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      <span>Recommended Angle</span>
                    </span>
                  )}
                </div>

                {/* Hook Text Phrase */}
                <div className="p-3.5 rounded-xl bg-[#20202A] border border-[#30303D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                    Opening Spoken Line / Hook
                  </span>
                  <p className="text-sm font-bold text-[#F2F0F7] leading-relaxed">
                    &ldquo;{hook.opening_line}&rdquo;
                  </p>
                </div>

                {/* Psychological Rationale */}
                <div className="text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                    Psychological Driver
                  </span>
                  <p className="text-xs text-[#A3A0B0] leading-relaxed">
                    {hook.psychological_trigger}
                  </p>
                </div>

                {/* Pros and Cons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  {hook.pros && (
                    <div className="p-2.5 rounded-xl bg-[#45B88A]/5 border border-[#45B88A]/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#45B88A] tracking-wider flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        <span>Strengths</span>
                      </span>
                      <p className="text-[#A3A0B0] leading-relaxed text-[11px]">{hook.pros}</p>
                    </div>
                  )}

                  {hook.cons && (
                    <div className="p-2.5 rounded-xl bg-[#E16F7B]/5 border border-[#E16F7B]/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#E16F7B] tracking-wider flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3" />
                        <span>Risks / Weaknesses</span>
                      </span>
                      <p className="text-[#A3A0B0] leading-relaxed text-[11px]">{hook.cons}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
