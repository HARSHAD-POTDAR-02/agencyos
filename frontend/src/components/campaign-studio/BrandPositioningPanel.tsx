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
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {payload.brand_name || "Brand Intelligence & Truth Classification"}
            </h3>
            <p className="text-xs text-muted-foreground">
              4-tier epistemology: Verified Facts vs Inferences vs Hypotheses vs Missing Data
            </p>
          </div>
        </div>
      </div>

      {/* ── 4-Tier Truth Sections ── */}
      <div className="space-y-4">
        {/* Tier 1: Verified Facts */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tier 1: Verified Facts ({verified.length})</span>
          </h4>
          <div className="space-y-2">
            {verified.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    {item.attribute_key}
                  </span>
                  {item.source_ref && (
                    <span className="text-[10px] text-muted-foreground">
                      Source: {item.source_ref}
                    </span>
                  )}
                </div>
                <p className="text-foreground text-[11px] leading-relaxed">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 2: Inferred Patterns */}
        {inferred.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Tier 2: Inferred Patterns ({inferred.length})</span>
            </h4>
            <div className="space-y-2">
              {inferred.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 text-xs space-y-1"
                >
                  <span className="font-bold text-sky-800 dark:text-sky-300">
                    {item.attribute_key}
                  </span>
                  <p className="text-foreground text-[11px] leading-relaxed">
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
            <h4 className="text-xs uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Tier 3: Strategic Hypotheses ({hypotheses.length})</span>
            </h4>
            <div className="space-y-2">
              {hypotheses.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1"
                >
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    {item.attribute_key}
                  </span>
                  <p className="text-foreground text-[11px] leading-relaxed">
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
            <h4 className="text-xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Tier 4: Missing Critical Data ({missing.length})</span>
            </h4>
            <div className="space-y-2">
              {missing.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs space-y-1"
                >
                  <span className="font-bold text-rose-800 dark:text-rose-300">
                    {item.attribute_key}
                  </span>
                  <p className="text-foreground text-[11px] leading-relaxed">
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
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2.5">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <QuestionIcon className="w-3.5 h-3.5 text-primary" />
            <span>Clarifying Questions for Client</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-foreground">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                <span className="font-bold text-primary">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
