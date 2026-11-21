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
  const stages = (payload.narrative_stages && payload.narrative_stages.length > 0)
    ? payload.narrative_stages
    : (payload.stages || []);
  const formatRatios = payload.format_mix_ratios || payload.target_format_mix || {};
  const slogan = payload.master_slogan || payload.slogan || "";

  return (
    <div className="space-y-6">
      {/* ── Campaign Master Theme Header ── */}
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#F2F0F7]">
              {payload.campaign_theme || "Strategic Campaign Blueprint"}
            </h3>
            {slogan && (
              <p className="text-xs italic text-[#A78BFA] font-medium mt-0.5">
                &ldquo;{slogan}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Multi-Stage Narrative Arc ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#A78BFA]" />
            <span>Sprint Narrative Pacing & Stages ({stages.length} Phases)</span>
          </h4>
          <span className="text-[11px] font-mono text-[#A3A0B0]">Pacing Breakdown</span>
        </div>

        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const daysLabel = stage.days_range || stage.day_range || `Phase ${idx + 1}`;
            const messageText = stage.core_message || stage.objective || "";
            const deliverables = stage.deliverable_focus || stage.key_formats || [];

            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] font-bold text-xs flex items-center justify-center border border-[#A78BFA]/30">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm text-[#F2F0F7]">
                      {stage.stage_name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#20202A] text-[#F2F0F7] border border-[#30303D]">
                    {daysLabel}
                  </span>
                </div>

                {messageText && (
                  <p className="text-xs text-[#A3A0B0] leading-relaxed bg-[#20202A] p-2.5 rounded-lg border border-[#30303D]/60">
                    {messageText}
                  </p>
                )}

                {deliverables.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] mr-1">
                      Deliverables:
                    </span>
                    {deliverables.map((focus, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 font-medium"
                      >
                        {focus}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recommended Format Mix ── */}
      {Object.keys(formatRatios).length > 0 && (() => {
        const totalDeliverables = Object.values(formatRatios).reduce(
          (acc, v) => acc + (typeof v === "number" ? v : parseInt(String(v), 10) || 0),
          0
        );
        const isCountBased = totalDeliverables > 0 && totalDeliverables <= 50;

        return (
          <div className="p-4 rounded-xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Recommended Deliverable Distribution</span>
              </h4>
              {isCountBased && (
                <span className="text-[11px] font-mono text-[#A78BFA] bg-[#A78BFA]/10 px-2 py-0.5 rounded border border-[#A78BFA]/20 font-medium">
                  {totalDeliverables} Total Deliverables
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {Object.entries(formatRatios).map(([fmt, val]) => {
                const count = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
                const percentage = totalDeliverables > 0 ? Math.round((count / totalDeliverables) * 100) : 0;

                return (
                  <div
                    key={fmt}
                    className="p-3 rounded-lg bg-[#20202A] border border-[#30303D] text-center space-y-1"
                  >
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] block tracking-wider">
                      {fmt}
                    </span>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-lg font-bold text-[#F2F0F7] font-mono">
                        {isCountBased ? count : `${count}%`}
                      </span>
                      {isCountBased && (
                        <span className="text-xs text-[#A78BFA] font-medium font-mono">
                          ({percentage}%)
                        </span>
                      )}
                    </div>
                    {isCountBased && (
                      <span className="text-[10px] text-[#A3A0B0] block">
                        {count === 1 ? "deliverable" : "deliverables"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
