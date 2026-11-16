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
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                hasBlocking
                  ? "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/20"
                  : "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/20"
              }`}
            >
              {hasBlocking ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F2F0F7]">
                Brand Guideline & Compliance Audit
              </h3>
              <p className="text-xs text-[#A3A0B0]">
                Deterministic guardrail evaluation & semantic risk review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30">
              {passCount} Pass
            </span>
            {reviewCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-[#E5AA58]/15 text-[#E5AA58] border border-[#E5AA58]/30">
                {reviewCount} Review
              </span>
            )}
            {failCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-[#E16F7B]/15 text-[#E16F7B] border border-[#E16F7B]/30">
                {failCount} Fail
              </span>
            )}
          </div>
        </div>

        {/* Global Summary Note */}
        {(payload.proposed_diff || payload.original_text) && (
          <p className="text-xs text-[#A3A0B0] bg-[#20202A] p-3 rounded-xl border border-[#30303D] leading-relaxed">
            {payload.proposed_diff || payload.original_text}
          </p>
        )}
      </div>

      {/* ── Rule Evaluation Checks ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#A78BFA]" />
            <span>Policy Checks ({checks.length})</span>
          </h4>
          <span className="text-[11px] font-mono text-[#A3A0B0]">Deterministic Audit</span>
        </div>

        <div className="space-y-3">
          {checks.map((chk, idx) => {
            const isPass = chk.verdict === "PASS";
            const isFail = chk.verdict === "FAIL";

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all shadow-sm space-y-3 ${
                  isFail
                    ? "bg-[#17171E] border-[#E16F7B]/50"
                    : isPass
                    ? "bg-[#17171E] border-[#30303D]"
                    : "bg-[#17171E] border-[#E5AA58]/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isPass ? (
                      <CheckCircle2 className="w-4 h-4 text-[#45B88A]" />
                    ) : isFail ? (
                      <XCircle className="w-4 h-4 text-[#E16F7B]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#E5AA58]" />
                    )}
                    <span className="font-bold text-sm text-[#F2F0F7]">
                      {chk.check_name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-bold ${
                      isPass
                        ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/20"
                        : isFail
                        ? "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/20"
                        : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/20"
                    }`}
                  >
                    {chk.verdict}
                  </span>
                </div>

                <p className="text-xs text-[#A3A0B0] leading-relaxed">
                  {chk.explanation}
                </p>

                {chk.suggested_correction && (
                  <div className="p-3 rounded-lg bg-[#20202A] border border-[#30303D] space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#A78BFA] tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                      <span>Suggested Compliant Revision</span>
                    </span>
                    <p className="text-xs text-[#F2F0F7] italic">
                      &ldquo;{chk.suggested_correction}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
