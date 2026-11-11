"use client";

import React from "react";
import { CompliancePayload } from "./types";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  GitCompare,
  Sparkles,
} from "lucide-react";

interface CompliancePanelProps {
  payload: CompliancePayload;
}

export function CompliancePanel({ payload }: CompliancePanelProps) {
  const checks = payload.checks || [];
  const hasBlocking = payload.has_blocking_violations;

  const passCount = checks.filter((c) => c.verdict === "PASS").length;
  const failCount = checks.filter((c) => c.verdict === "FAIL").length;
  const reviewCount = checks.filter((c) => c.verdict === "NEEDS_REVIEW").length;

  return (
    <div className="space-y-6">
      {/* ── Verdict Summary Header ── */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg border ${
                hasBlocking
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}
            >
              {hasBlocking ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Brand Guideline & Compliance Audit
              </h3>
              <p className="text-xs text-muted-foreground">
                Deterministic guardrail evaluation & semantic risk review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {passCount} Pass
            </span>
            {reviewCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {reviewCount} Review
              </span>
            )}
            {failCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                {failCount} Fail
              </span>
            )}
          </div>
        </div>

        {/* Blocking violation warning banner */}
        {hasBlocking && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Blocking Violation Detected:</span> Content cannot be exported to production until prohibited terms or claims are corrected.
            </div>
          </div>
        )}
      </div>

      {/* ── Detailed Checklist ── */}
      <div className="space-y-3.5">
        <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-primary" />
          <span>Compliance Checks Checklist ({checks.length} Audited)</span>
        </h4>

        {checks.map((item, idx) => {
          const isPass = item.verdict === "PASS";
          const isFail = item.verdict === "FAIL";

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all shadow-xs space-y-2.5 ${
                isFail
                  ? "bg-rose-500/5 border-rose-500/30"
                  : isPass
                  ? "bg-card border-border/80"
                  : "bg-amber-500/5 border-amber-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPass ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : isFail ? (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="font-bold text-xs text-foreground">
                    {item.check_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                    {item.check_type === "deterministic" ? "Rule Engine" : "Semantic AI"}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isPass
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : isFail
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {item.verdict}
                  </span>
                </div>
              </div>

              {item.flagged_snippet && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Flagged Snippet
                  </span>
                  <p className="font-mono text-[11px] bg-rose-500/10 text-rose-700 dark:text-rose-300 p-2 rounded-lg border border-rose-500/20">
                    &ldquo;{item.flagged_snippet}&rdquo;
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.explanation}
              </p>

              {item.suggested_correction && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span>Compliant Alternative</span>
                  </span>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300 text-[11px]">
                    {item.suggested_correction}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Red / Green Unified Diff ── */}
      {payload.proposed_diff && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5 text-primary" />
            <span>Proposed Copy Diff</span>
          </h4>
          <pre className="p-3 rounded-lg bg-muted/60 text-xs font-mono whitespace-pre-wrap overflow-x-auto border border-border leading-relaxed text-foreground">
            {payload.proposed_diff}
          </pre>
        </div>
      )}
    </div>
  );
}
