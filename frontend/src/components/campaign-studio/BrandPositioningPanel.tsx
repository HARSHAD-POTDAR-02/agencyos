"use client";

import React from "react";
import { BrandPositioningPayload } from "./types";
import {
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  AlertCircle,
  HelpCircle as QuestionIcon,
} from "lucide-react";

interface BrandPositioningPanelProps {
  payload: BrandPositioningPayload;
}

export function BrandPositioningPanel({ payload }: BrandPositioningPanelProps) {
  const items = payload.truth_tier_items || [];
  const questions = payload.clarifying_questions || [];

  const verified = items.filter((i) => i.tier === "verified_fact");
  const inferred = items.filter((i) => i.tier === "inferred_pattern");
  const hypotheses = items.filter((i) => i.tier === "hypothesis");
  const missing = items.filter((i) => i.tier === "missing_critical_info");

  return (
    <div className="space-y-6">
      {/* ── Brand Header ── */}
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#F2F0F7]">
              {payload.brand_name || "Brand Intelligence & Truth Classification"}
            </h3>
            <p className="text-xs text-[#A3A0B0]">
              4-tier epistemology: Verified Facts vs Inferences vs Hypotheses vs Missing Data
            </p>
          </div>
        </div>
      </div>

      {/* ── 4-Tier Truth Sections ── */}
      <div className="space-y-4">
        {/* Tier 1: Verified Facts */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#45B88A] flex items-center gap-1.5 px-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tier 1: Verified Facts ({verified.length})</span>
          </h4>
          <div className="space-y-2">
            {verified.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#17171E] border border-[#45B88A]/30 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#45B88A]">
                    {item.attribute_key}
                  </span>
                  {item.source_ref && (
                    <span className="text-[10px] text-[#A3A0B0]">
                      Source: {item.source_ref}
                    </span>
                  )}
                </div>
                <p className="text-[#F2F0F7] text-[11px] leading-relaxed">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 2: Inferred Patterns */}
        {inferred.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#69A9D8] flex items-center gap-1.5 px-1">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Tier 2: Inferred Patterns ({inferred.length})</span>
            </h4>
            <div className="space-y-2">
              {inferred.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#17171E] border border-[#69A9D8]/30 text-xs space-y-1"
                >
                  <span className="font-bold text-[#69A9D8]">
                    {item.attribute_key}
                  </span>
                  <p className="text-[#F2F0F7] text-[11px] leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 3: Hypotheses */}
        {hypotheses.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#E5AA58] flex items-center gap-1.5 px-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Tier 3: Strategic Hypotheses ({hypotheses.length})</span>
            </h4>
            <div className="space-y-2">
              {hypotheses.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#17171E] border border-[#E5AA58]/30 text-xs space-y-1"
                >
                  <span className="font-bold text-[#E5AA58]">
                    {item.attribute_key}
                  </span>
                  <p className="text-[#F2F0F7] text-[11px] leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 4: Missing Critical Info */}
        {missing.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#E16F7B] flex items-center gap-1.5 px-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Tier 4: Missing Critical Data ({missing.length})</span>
            </h4>
            <div className="space-y-2">
              {missing.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#17171E] border border-[#E16F7B]/30 text-xs space-y-1"
                >
                  <span className="font-bold text-[#E16F7B]">
                    {item.attribute_key}
                  </span>
                  <p className="text-[#F2F0F7] text-[11px] leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Clarifying Questions ── */}
      {questions.length > 0 && (
        <div className="p-4 rounded-xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-2.5">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <QuestionIcon className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Clarifying Questions for Client</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-[#F2F0F7]">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 bg-[#20202A] p-2.5 rounded-lg border border-[#30303D]/60">
                <span className="font-bold text-[#A78BFA]">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
