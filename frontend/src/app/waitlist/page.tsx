"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { API_BASE } from "@/lib/api";

const ROLE_OPTIONS = [
  "Agency Founder / Owner",
  "Creative Director",
  "Head of Operations / PM",
  "Account Director",
  "Boutique / Solo Studio",
];

const TEAM_SIZE_OPTIONS = ["1–3", "4–10", "11–25", "26–50", "50+"];
const RETAINER_OPTIONS = ["1–5", "6–15", "16–30", "30+"];

export default function WaitlistPage() {
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [teamSize, setTeamSize] = useState("4–10");
  const [activeRetainers, setActiveRetainers] = useState("6–15");
  const [biggestBottleneck, setBiggestBottleneck] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          work_email: workEmail.trim(),
          agency_name: agencyName.trim(),
          role,
          team_size: teamSize,
          active_retainers: activeRetainers,
          biggest_bottleneck: biggestBottleneck.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Could not submit waitlist request.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join waitlist.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111114] font-sans antialiased">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#6B6A65] hover:text-[#111114] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to AgencyOS</span>
          </Link>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAE7DF] shadow-[0_20px_50px_-15px_rgba(17,17,20,0.08)] p-6 sm:p-10">
          {submitted ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-[#DDEDEA] text-[#0F7B6C] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
                  Waitlist Confirmed
                </p>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#111114]">
                  You&apos;re on the early access list, {fullName.split(" ")[0]}.
                </h1>
                <p className="text-sm text-[#6B6A65] max-w-md mx-auto leading-relaxed">
                  We&apos;ve logged <span className="font-semibold text-[#111114]">{agencyName}</span> ({teamSize} team members, {activeRetainers} retainers) under <span className="font-mono text-xs">{workEmail}</span>. We&apos;ll reach out when your onboarding cohort opens.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#111114] text-white text-xs font-medium hover:bg-[#2F2E2B] transition-colors"
                >
                  <span>Return to Overview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2 pb-6 border-b border-[#EAE7DF]">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#0F7B6C] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Early Access Application
                </span>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#111114]">
                  Join the AgencyOS Waitlist.
                </h1>
                <p className="text-xs sm:text-sm text-[#6B6A65] leading-relaxed">
                  Tell us about your agency, team size, and client volume so we can onboard your workspace in the right cohort.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-[#C93B2B]/30 text-xs text-[#C93B2B] font-mono">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] text-sm text-[#111114] placeholder-[#8C8A84] focus:outline-none focus:border-[#111114]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="alex@youragency.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] text-sm text-[#111114] placeholder-[#8C8A84] focus:outline-none focus:border-[#111114]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      Agency / Studio Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Northlight Creative"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] text-sm text-[#111114] placeholder-[#8C8A84] focus:outline-none focus:border-[#111114]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      Who are you? (Role) *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] text-sm text-[#111114] focus:outline-none focus:border-[#111114]"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      How many people work at your agency? *
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {TEAM_SIZE_OPTIONS.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setTeamSize(size)}
                          className={`py-2 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                            teamSize === size
                              ? "bg-[#111114] text-white border-[#111114] font-semibold"
                              : "bg-[#FAF9F6] text-[#6B6A65] border-[#EAE7DF] hover:border-[#111114]/40"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#111114]">
                      Active Client Retainers *
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {RETAINER_OPTIONS.map((ret) => (
                        <button
                          key={ret}
                          type="button"
                          onClick={() => setActiveRetainers(ret)}
                          className={`py-2 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                            activeRetainers === ret
                              ? "bg-[#111114] text-white border-[#111114] font-semibold"
                              : "bg-[#FAF9F6] text-[#6B6A65] border-[#EAE7DF] hover:border-[#111114]/40"
                          }`}
                        >
                          {ret}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#111114]">
                    What is your biggest bottleneck right now? (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={biggestBottleneck}
                    onChange={(e) => setBiggestBottleneck(e.target.value)}
                    placeholder="e.g., slow client approvals, off-brand drafts from junior hires, too many disconnected tools..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#EAE7DF] bg-[#FAF9F6] text-sm text-[#111114] placeholder-[#8C8A84] focus:outline-none focus:border-[#111114]"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-[11px] font-mono text-[#8C8A84]">
                    Unlimited seats included · Zero AI training on client IP
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 rounded-full text-sm font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] disabled:opacity-50 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>{submitting ? "Submitting..." : "Request Early Access"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
