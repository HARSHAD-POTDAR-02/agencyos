"use client";

import React, { useState, useEffect } from "react";
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  Link2,
  Clock,
  Calendar,
  Check
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { socialApi, publishingApi, SocialAccount, PublishResult, ScheduleResponse } from "@/lib/api";

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalDateTime(dtStr: string): Date {
  const [datePart, timePart] = dtStr.split("T");
  if (!datePart || !timePart) return new Date(dtStr);
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverableId: string;
  deliverableTitle: string;
  deliverableType: string;
  platform: string;
  caption?: string | null;
  clientId: string;
  clientName: string;
  onSuccess: (result: PublishResult | ScheduleResponse | any) => void;
  initialIntent?: "publish" | "schedule";
  currentScheduledAt?: string | null;
  isRescheduling?: boolean;
}

export default function PublishModal({
  isOpen,
  onClose,
  deliverableId,
  deliverableTitle,
  deliverableType,
  platform,
  caption = "",
  clientId,
  clientName,
  onSuccess,
  initialIntent = "publish",
  currentScheduledAt = null,
  isRescheduling = false,
}: PublishModalProps) {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  // Intent: Publish Now vs. Schedule for Later
  const [actionIntent, setActionIntent] = useState<"publish" | "schedule">(
    isRescheduling ? "schedule" : initialIntent
  );

  const [mode, setMode] = useState<"automated" | "manual">("automated");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [captionText, setCaptionText] = useState<string>(caption || "");
  const [shareToFeed, setShareToFeed] = useState<boolean>(true);
  const [mediaUrlOverride, setMediaUrlOverride] = useState<string>("");
  const [manualUrl, setManualUrl] = useState<string>("");
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishProgress, setPublishProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Scheduling State
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(() => {
    if (currentScheduledAt) {
      return formatLocalDateTime(new Date(currentScheduledAt));
    }
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    return formatLocalDateTime(defaultTime);
  });

  const [userTimezone, setUserTimezone] = useState<string>("");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(tz || "Local Time");
    } catch {
      setUserTimezone("Local Time");
    }
  }, []);

  useEffect(() => {
    const p = (platform || "").toLowerCase();
    if (p.includes("facebook") || p.includes("fb")) {
      setSelectedPlatform("facebook");
    } else {
      setSelectedPlatform("instagram");
    }
  }, [platform]);

  useEffect(() => {
    async function fetchAccounts() {
      if (!token || !effectiveAgencyId || !clientId) return;
      setLoadingAccounts(true);
      try {
        const list = (await socialApi.list(
          effectiveAgencyId,
          clientId,
          token
        )) as SocialAccount[];
        setAccounts(list || []);
      } catch (err: any) {
        console.error("Failed to load connected social accounts:", err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    if (isOpen) {
      fetchAccounts();
    }
  }, [token, effectiveAgencyId, clientId, isOpen]);

  if (!isOpen) return null;

  const isVideoOrReel =
    deliverableType?.toLowerCase().includes("video") ||
    deliverableType?.toLowerCase().includes("reel");

  const igAccount = accounts.find((a) => a.platform === "instagram" && a.instagram_business_id);
  const fbAccount = accounts.find((a) => a.platform === "facebook" && a.facebook_page_id);

  const currentAccount =
    selectedPlatform === "both"
      ? igAccount || fbAccount
      : selectedPlatform === "facebook"
      ? fbAccount
      : igAccount;

  // Preset button helper
  const applyPreset = (preset: "2m" | "5m" | "15m" | "1h" | "10h" | "tomorrow9am") => {
    const now = new Date();
    let target = new Date();
    if (preset === "2m") {
      target = new Date(now.getTime() + 2 * 60 * 1000);
    } else if (preset === "5m") {
      target = new Date(now.getTime() + 5 * 60 * 1000);
    } else if (preset === "15m") {
      target = new Date(now.getTime() + 15 * 60 * 1000);
    } else if (preset === "1h") {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (preset === "10h") {
      target = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    } else if (preset === "tomorrow9am") {
      target.setDate(now.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    }
    setScheduledDateTime(formatLocalDateTime(target));
    setError(null);
  };

  // Compute live relative countdown string
  let countdownText = "";
  let isPastTime = false;
  let amPmSuggestion: string | null = null;
  let targetPMString: string | null = null;

  if (scheduledDateTime) {
    const selectedDate = parseLocalDateTime(scheduledDateTime);
    const now = new Date();
    const diffMs = selectedDate.getTime() - now.getTime();
    if (diffMs <= 0) {
      isPastTime = true;
      const hoursAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
      countdownText = `Selected time has already passed (${hoursAgo}h ago). Pick a future time.`;

      // Smart AM -> PM suggestion
      if (selectedDate.getHours() < 12) {
        const pmCandidate = new Date(selectedDate.getTime() + 12 * 60 * 60 * 1000);
        if (pmCandidate.getTime() > now.getTime()) {
          amPmSuggestion = pmCandidate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          targetPMString = formatLocalDateTime(pmCandidate);
        }
      }
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(diffMins / 60);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const remMins = diffMins % 60;

      if (days > 0) {
        countdownText = `Fires in ${days}d ${remHours}h ${remMins}m from now`;
      } else if (hours > 0) {
        countdownText = `Fires in ${hours}h ${remMins}m from now`;
      } else {
        countdownText = `Fires in ${diffMins} minute${diffMins === 1 ? "" : "s"} from now`;
      }
    }
  }

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;

    setError(null);
    setPublishing(true);

    try {
      if (actionIntent === "schedule") {
        const selectedDate = parseLocalDateTime(scheduledDateTime);
        if (selectedDate.getTime() <= Date.now()) {
          throw new Error("Scheduled time must be in the future.");
        }

        const scheduledIso = selectedDate.toISOString();

        setPublishProgress("Setting up scheduled queue entry...");
        const result = (await publishingApi.schedule(
          effectiveAgencyId,
          deliverableId,
          {
            platform: selectedPlatform,
            scheduled_at: scheduledIso,
            share_to_feed: shareToFeed,
            caption_override: captionText.trim() || undefined,
          },
          token
        )) as ScheduleResponse;

        onSuccess(result);
        onClose();
        return;
      }

      // PUBLISH NOW LOGIC
      if (mode === "automated") {
        setPublishProgress("Checking Meta API connection...");
        const result = (await publishingApi.publish(
          effectiveAgencyId,
          deliverableId,
          {
            mode: "automated",
            platform: selectedPlatform,
            share_to_feed: shareToFeed,
            media_url_override: mediaUrlOverride.trim() || undefined,
            caption_override: captionText.trim() || undefined,
          },
          token
        )) as PublishResult;

        if (result.status === "failed") {
          throw new Error(result.message || "Meta API returned a publishing error");
        }

        onSuccess(result);
        onClose();
      } else {
        // Manual mode
        setPublishProgress("Recording live post link...");
        const result = await publishingApi.publish(
          effectiveAgencyId,
          deliverableId,
          {
            mode: "manual",
            live_post_url: manualUrl.trim(),
            platform: selectedPlatform,
          },
          token
        );
        onSuccess(result);
        onClose();
      }
    } catch (err: any) {
      console.error("Publishing error:", err);
      setError(err.message || "Failed to complete action");
    } finally {
      setPublishing(false);
      setPublishProgress("");
    }
  };

  const isSubmitDisabled =
    publishing ||
    (actionIntent === "schedule" && (isPastTime || !currentAccount)) ||
    (actionIntent === "publish" && mode === "automated" && !currentAccount) ||
    (actionIntent === "publish" && mode === "manual" && !manualUrl.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#17171E] rounded-2xl shadow-2xl border border-[#30303D] w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] text-[#F2F0F7]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30303D] flex items-center justify-between bg-[#101014]">
          <div className="flex items-center gap-2.5">
            {actionIntent === "schedule" ? (
              <div className="p-2 bg-[#20202A] text-[#A78BFA] border border-[#30303D] rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
            ) : selectedPlatform === "both" ? (
              <div className="p-2 bg-[#20202A] text-[#A78BFA] border border-[#30303D] rounded-xl flex items-center gap-1">
                <InstagramIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">+</span>
                <FacebookIcon className="w-3.5 h-3.5" />
              </div>
            ) : selectedPlatform === "facebook" ? (
              <div className="p-2 bg-[#20202A] text-[#69A9D8] border border-[#30303D] rounded-xl">
                <FacebookIcon className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-2 bg-[#20202A] text-[#E16F7B] border border-[#30303D] rounded-xl">
                <InstagramIcon className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight">
                {actionIntent === "schedule"
                  ? isRescheduling
                    ? "Reschedule Content"
                    : "Schedule for Later"
                  : mode === "automated"
                  ? `Publish to ${
                      selectedPlatform === "both"
                        ? "Both Platforms (IG & FB)"
                        : selectedPlatform === "facebook"
                        ? "Facebook Page"
                        : "Instagram"
                    }`
                  : "Publish Deliverable"}
              </h2>
              <p className="text-[11px] text-[#A3A0B0] truncate max-w-[280px]">
                {deliverableTitle} &bull; {clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={publishing}
            className="text-[#71717A] hover:text-[#F2F0F7] text-lg leading-none p-1 rounded-lg hover:bg-[#20202A] cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Action Intent Switcher (Publish Now vs. Schedule for Later) */}
        {!isRescheduling && (
          <div className="px-6 pt-4 pb-0">
            <div className="flex items-center gap-1.5 p-1 bg-[#101014] border border-[#30303D] rounded-xl">
              <button
                type="button"
                onClick={() => setActionIntent("publish")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionIntent === "publish"
                    ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Publish Now</span>
              </button>
              <button
                type="button"
                onClick={() => setActionIntent("schedule")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionIntent === "schedule"
                    ? "bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Schedule for Later</span>
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleAction} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#E16F7B] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SCHEDULE MODE SPECIFIC CONTROLS */}
          {actionIntent === "schedule" && (
            <div className="space-y-3.5 p-4 bg-[#101014] rounded-2xl border border-[#30303D]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Scheduled Publication Time</span>
                </label>
                <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#20202A] px-2 py-0.5 rounded border border-[#30303D]">
                  {userTimezone}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block">
                  Quick Presets
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset("2m")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-bold bg-[#E5AA58]/10 border border-[#E5AA58]/30 text-[#E5AA58] hover:bg-[#E5AA58]/20 rounded-lg transition-all cursor-pointer"
                  >
                    ⚡ +2 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("5m")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-bold bg-[#E5AA58]/10 border border-[#E5AA58]/30 text-[#E5AA58] hover:bg-[#E5AA58]/20 rounded-lg transition-all cursor-pointer"
                  >
                    ⚡ +5 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("15m")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-semibold bg-[#20202A] border border-[#30303D] hover:border-[#A78BFA] text-[#A3A0B0] hover:text-[#F2F0F7] rounded-lg transition-all cursor-pointer"
                  >
                    +15 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1h")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-semibold bg-[#20202A] border border-[#30303D] hover:border-[#A78BFA] text-[#A3A0B0] hover:text-[#F2F0F7] rounded-lg transition-all cursor-pointer"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("10h")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-semibold bg-[#20202A] border border-[#30303D] hover:border-[#A78BFA] text-[#A3A0B0] hover:text-[#F2F0F7] rounded-lg transition-all cursor-pointer"
                  >
                    +10 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("tomorrow9am")}
                    className="py-1.5 px-2 text-center text-xs font-mono font-semibold bg-[#20202A] border border-[#30303D] hover:border-[#A78BFA] text-[#A3A0B0] hover:text-[#F2F0F7] rounded-lg transition-all cursor-pointer"
                  >
                    Tmrw 9 AM
                  </button>
                </div>
              </div>

              {/* Exact Datetime Input */}
              <div className="space-y-1">
                <input
                  type="datetime-local"
                  required
                  value={scheduledDateTime}
                  onChange={(e) => {
                    setScheduledDateTime(e.target.value);
                    setError(null);
                  }}
                  className="w-full text-xs font-mono font-bold text-[#F2F0F7] p-2.5 rounded-xl border border-[#30303D] bg-[#17171E] focus:outline-none focus:border-[#A78BFA] cursor-pointer"
                />
              </div>

              {/* Dynamic countdown banner */}
              {countdownText && (
                <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center justify-between gap-2 border ${
                  isPastTime
                    ? "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30"
                    : "bg-[#20202A] text-[#A3A0B0] border-[#30303D]"
                }`}>
                  <div className="flex items-center gap-2 min-w-0 font-mono">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-[#A78BFA]" />
                    <span className="truncate">{countdownText}</span>
                  </div>
                  {isPastTime && amPmSuggestion && targetPMString && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledDateTime(targetPMString!);
                        setError(null);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold bg-[#E5AA58] text-[#101014] rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Switch to {amPmSuggestion}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode Switcher (only in Publish Now mode) */}
          {actionIntent === "publish" && (
            <div className="flex items-center gap-2 p-1 bg-[#101014] border border-[#30303D] rounded-xl">
              <button
                type="button"
                onClick={() => setMode("automated")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "automated"
                    ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Direct Meta API</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "manual"
                    ? "bg-[#20202A] text-[#A78BFA] border border-[#30303D] font-bold"
                    : "text-[#71717A] hover:text-[#F2F0F7]"
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Manual Tracking</span>
              </button>
            </div>
          )}

          {/* Platform Selector (Automated or Schedule mode) */}
          {(actionIntent === "schedule" || mode === "automated") && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#A3A0B0] uppercase tracking-wider block">
                Target Platform
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* Instagram Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("instagram")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                    selectedPlatform === "instagram"
                      ? "border-[#A78BFA] bg-[#A78BFA]/10 ring-2 ring-[#A78BFA]/20 shadow-xs"
                      : "border-[#30303D] bg-[#101014] hover:bg-[#20202A]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="p-1.5 rounded-lg bg-[#20202A] border border-[#30303D] text-[#E16F7B]">
                      <InstagramIcon className="w-3.5 h-3.5" />
                    </div>
                    {igAccount && <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A] shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-[#F2F0F7] block truncate">Instagram</span>
                    <p className="text-[10px] text-[#71717A] truncate mt-0.5">
                      {igAccount ? (igAccount.account_handle || "Connected") : "Not connected"}
                    </p>
                  </div>
                </button>

                {/* Facebook Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("facebook")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                    selectedPlatform === "facebook"
                      ? "border-[#69A9D8] bg-[#69A9D8]/10 ring-2 ring-[#69A9D8]/20 shadow-xs"
                      : "border-[#30303D] bg-[#101014] hover:bg-[#20202A]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="p-1.5 rounded-lg bg-[#20202A] border border-[#30303D] text-[#69A9D8]">
                      <FacebookIcon className="w-3.5 h-3.5" />
                    </div>
                    {fbAccount && <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A] shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-[#F2F0F7] block truncate">Facebook</span>
                    <p className="text-[10px] text-[#71717A] truncate mt-0.5">
                      {fbAccount ? (fbAccount.account_name || "Connected") : "Not connected"}
                    </p>
                  </div>
                </button>

                {/* Both Platforms Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("both")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                    selectedPlatform === "both"
                      ? "border-[#A78BFA] bg-[#A78BFA]/10 ring-2 ring-[#A78BFA]/20 shadow-xs"
                      : "border-[#30303D] bg-[#101014] hover:bg-[#20202A]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="p-1.5 rounded-lg bg-[#20202A] border border-[#30303D] text-[#A78BFA] flex items-center gap-0.5">
                      <InstagramIcon className="w-3 h-3" />
                      <FacebookIcon className="w-3 h-3" />
                    </div>
                    {igAccount && fbAccount && <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A] shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-[#F2F0F7] block truncate">Both (IG + FB)</span>
                    <p className="text-[10px] text-[#71717A] truncate mt-0.5">
                      {igAccount && fbAccount ? "Both ready" : igAccount || fbAccount ? "1 connected" : "None"}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Connected Profile Details */}
          {(actionIntent === "schedule" || mode === "automated") && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-[#30303D] bg-[#101014]">
                <div className="text-[11px] font-semibold text-[#A3A0B0] uppercase tracking-wider mb-2">
                  Connected Profile ({clientName})
                </div>

                {loadingAccounts ? (
                  <div className="text-xs text-[#71717A] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A78BFA]" />
                    <span>Checking connected client accounts...</span>
                  </div>
                ) : selectedPlatform === "both" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-3 bg-[#17171E] rounded-xl border border-[#30303D] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-md bg-[#20202A] text-[#E16F7B]">
                              <InstagramIcon className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-semibold text-[#F2F0F7]">Instagram</span>
                          </div>
                          {igAccount ? (
                            <span className="text-[10px] font-mono font-bold text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-2 py-0.5 rounded-full">
                              Missing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#A3A0B0] truncate font-medium">
                          {igAccount ? (igAccount.account_handle || igAccount.account_name || "Connected") : "No account connected"}
                        </p>
                      </div>

                      <div className="p-3 bg-[#17171E] rounded-xl border border-[#30303D] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-md bg-[#20202A] text-[#69A9D8]">
                              <FacebookIcon className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-semibold text-[#F2F0F7]">Facebook Page</span>
                          </div>
                          {fbAccount ? (
                            <span className="text-[10px] font-mono font-bold text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-[#E5AA58] bg-[#E5AA58]/10 border border-[#E5AA58]/30 px-2 py-0.5 rounded-full">
                              Missing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#A3A0B0] truncate font-medium">
                          {fbAccount ? (fbAccount.account_name || "Connected") : "No page connected"}
                        </p>
                      </div>
                    </div>

                    {(!igAccount || !fbAccount) && (
                      <p className="text-[11px] text-[#E5AA58] bg-[#E5AA58]/10 p-2.5 rounded-xl border border-[#E5AA58]/30 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#E5AA58]" />
                        <span>
                          {igAccount && !fbAccount && "Facebook Page is not connected. This will post to Instagram only."}
                          {!igAccount && fbAccount && "Instagram account is not connected. This will post to Facebook Page only."}
                          {!igAccount && !fbAccount && "Neither account is connected. Connect them in the client workspace."}
                        </span>
                      </p>
                    )}
                  </div>
                ) : selectedPlatform === "instagram" ? (
                  igAccount ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#20202A] border border-[#30303D] text-[#E16F7B] flex items-center justify-center font-bold text-xs">
                          {igAccount.account_handle ? igAccount.account_handle[1]?.toUpperCase() : "IG"}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#F2F0F7] flex items-center gap-1">
                            {igAccount.account_handle || igAccount.account_name || "Instagram Account"}
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
                          </div>
                          <div className="text-[10px] text-[#71717A] font-mono">
                            Business ID: {igAccount.instagram_business_id} &bull; Connected
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-[#E5AA58] bg-[#E5AA58]/10 p-2.5 rounded-lg border border-[#E5AA58]/30">
                        <AlertCircle className="w-4 h-4 text-[#E5AA58] shrink-0 mt-0.5" />
                        <span>
                          No Instagram Business account connected for <strong>{clientName}</strong>.
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  fbAccount ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#20202A] border border-[#30303D] text-[#69A9D8] flex items-center justify-center font-bold text-xs">
                          {fbAccount.account_name ? fbAccount.account_name[0]?.toUpperCase() : "FB"}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#F2F0F7] flex items-center gap-1">
                            {fbAccount.account_name || "Facebook Page"}
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
                          </div>
                          <div className="text-[10px] text-[#71717A] font-mono">
                            Page ID: {fbAccount.facebook_page_id} &bull; Connected
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#45B88A] bg-[#45B88A]/10 border border-[#45B88A]/30 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-[#E5AA58] bg-[#E5AA58]/10 p-2.5 rounded-lg border border-[#E5AA58]/30">
                        <AlertCircle className="w-4 h-4 text-[#E5AA58] shrink-0 mt-0.5" />
                        <span>
                          No Facebook Page connected for <strong>{clientName}</strong>.
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Caption & Feed Option */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#A3A0B0] flex items-center justify-between">
                  <span>
                    {selectedPlatform === "facebook" ? "Facebook Post Message / Caption" : "Approved Caption & Tags"}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A]">
                    Snapshotted for scheduled execution
                  </span>
                </label>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={4}
                  placeholder="Enter caption with #hashtags..."
                  className="w-full text-xs text-[#F2F0F7] p-3 rounded-xl border border-[#30303D] bg-[#101014] focus:outline-none focus:border-[#A78BFA] resize-none font-mono"
                />
              </div>

              {/* Instagram specific options */}
              {(selectedPlatform === "instagram" || selectedPlatform === "both") && isVideoOrReel && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="share_to_feed"
                    checked={shareToFeed}
                    onChange={(e) => setShareToFeed(e.target.checked)}
                    className="w-4 h-4 rounded text-[#A78BFA] bg-[#101014] border-[#30303D] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="share_to_feed" className="text-xs font-medium text-[#A3A0B0] cursor-pointer">
                    Share Reel to main Profile Grid (recommended)
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode Details (Only in publish now mode) */}
          {actionIntent === "publish" && mode === "manual" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#A3A0B0]">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full text-xs font-medium text-[#F2F0F7] p-2.5 rounded-xl border border-[#30303D] bg-[#101014] focus:outline-none focus:border-[#A78BFA] cursor-pointer"
                >
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#A3A0B0]">Live Post URL</label>
                <input
                  type="url"
                  required
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="w-full text-xs text-[#F2F0F7] p-2.5 rounded-xl border border-[#30303D] bg-[#101014] focus:outline-none focus:border-[#A78BFA]"
                />
              </div>
            </div>
          )}

          {/* Progress Banner */}
          {publishing && (
            <div className="p-3.5 rounded-xl border bg-[#101014] border-[#30303D] text-[#A78BFA] flex items-center gap-2.5 text-xs font-medium">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-[#A78BFA]" />
              <span>{publishProgress || "Processing..."}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#30303D] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="px-4 py-2 text-xs font-semibold text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex items-center gap-2 text-[#101014] text-xs font-bold px-5 py-2.5 rounded-xl bg-[#A78BFA] hover:bg-[#B69BFF] shadow-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              {actionIntent === "schedule" ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isRescheduling ? "Update Schedule" : "Schedule Post"}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {mode === "automated"
                      ? selectedPlatform === "both"
                        ? "Publish to Both Platforms"
                        : selectedPlatform === "facebook"
                        ? "Publish to Facebook Page"
                        : "Publish to Instagram"
                      : "Save as Published"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}