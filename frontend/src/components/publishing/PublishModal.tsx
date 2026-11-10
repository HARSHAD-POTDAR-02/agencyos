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

  // Scheduling state
  const userTimezone = typeof Intl !== "undefined" && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

  // Default to 10 hours from now (the user's scenario) or current scheduled time
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(() => {
    if (currentScheduledAt) {
      try {
        return formatLocalDateTime(new Date(currentScheduledAt));
      } catch {
        // fallback
      }
    }
    const defaultDate = new Date(Date.now() + 10 * 3600 * 1000);
    return formatLocalDateTime(defaultDate);
  });

  useEffect(() => {
    if (caption) setCaptionText(caption);
  }, [caption]);

  useEffect(() => {
    if (isRescheduling) {
      setActionIntent("schedule");
    } else if (initialIntent) {
      setActionIntent(initialIntent);
    }
  }, [initialIntent, isRescheduling, isOpen]);

  // Sync selectedPlatform with deliverable's platform prop if valid
  useEffect(() => {
    if (platform) {
      const p = platform.toLowerCase();
      if (p === "both" || p === "all") {
        setSelectedPlatform("both");
      } else if (p.includes("facebook") || p === "fb") {
        setSelectedPlatform("facebook");
      } else if (p.includes("instagram") || p === "ig") {
        setSelectedPlatform("instagram");
      }
    }
  }, [platform, isOpen]);

  useEffect(() => {
    if (isOpen && effectiveAgencyId && clientId && token) {
      setLoadingAccounts(true);
      setError(null);
      socialApi
        .list(effectiveAgencyId, clientId, token)
        .then((data) => {
          setAccounts(data);
          const hasIg = data.some((a) => a.platform === "instagram" && a.is_active);
          const hasFb = data.some((a) => a.platform === "facebook" && a.is_active);

          const p = (platform || "").toLowerCase();
          if (p === "both" && hasIg && hasFb) {
            setSelectedPlatform("both");
            setMode("automated");
          } else if (p.includes("facebook") && hasFb) {
            setSelectedPlatform("facebook");
            setMode("automated");
          } else if (p.includes("instagram") && hasIg) {
            setSelectedPlatform("instagram");
            setMode("automated");
          } else if (hasIg) {
            setSelectedPlatform("instagram");
            setMode("automated");
          } else if (hasFb) {
            setSelectedPlatform("facebook");
            setMode("automated");
          } else {
            setMode("manual");
          }
        })
        .catch((err) => {
          console.error("Error loading social accounts:", err);
        })
        .finally(() => setLoadingAccounts(false));
    }
  }, [isOpen, effectiveAgencyId, clientId, token, platform]);

  if (!isOpen) return null;

  const igAccount = accounts.find((a) => a.platform === "instagram" && a.is_active);
  const fbAccount = accounts.find((a) => a.platform === "facebook" && a.is_active);
  const isBoth = selectedPlatform === "both";
  const currentAccount = isBoth ? (igAccount || fbAccount) : (selectedPlatform === "facebook" ? fbAccount : igAccount);
  const isVideoOrReel = deliverableType.toLowerCase().includes("reel") || deliverableType.toLowerCase().includes("video");

  // Calculate live countdown text & AM/PM detection
  let countdownText = "";
  let isPastTime = false;
  let amPmSuggestion: string | null = null;
  let targetPMString: string | null = null;

  try {
    const target = parseLocalDateTime(scheduledDateTime);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    const formattedTarget = target.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (diffMs < 60000) {
      isPastTime = true;
      if (diffMs <= 0) {
        // Check if user chose AM instead of PM
        const targetPM = new Date(target.getTime() + 12 * 3600 * 1000);
        if (targetPM.getTime() - now.getTime() >= 60000 && target.getHours() < 12) {
          amPmSuggestion = targetPM.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
          targetPMString = formatLocalDateTime(targetPM);
          countdownText = `Selected time (${formattedTarget}) has already passed. Did you mean ${amPmSuggestion}?`;
        } else {
          countdownText = `Selected time (${formattedTarget}) is in the past. Must be at least 1 minute in the future.`;
        }
      } else {
        const secs = Math.ceil(diffMs / 1000);
        countdownText = `Selected time is in ${secs}s. Must be at least 1 minute in the future.`;
      }
    } else {
      if (diffMs < 3600 * 1000) {
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        const diffSeconds = Math.floor((diffMs % (60 * 1000)) / 1000);
        countdownText = `Will publish on ${formattedTarget} (in ${diffMinutes}m ${diffSeconds}s) [${userTimezone}]`;
      } else {
        const diffHours = Math.floor(diffMs / (3600 * 1000));
        const diffMinutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        countdownText = `Will publish on ${formattedTarget} (in ${diffHours}h ${diffMinutes}m) [${userTimezone}]`;
      }
    }
  } catch {
    countdownText = "";
  }

  // Quick preset helper
  const applyPreset = (preset: "2m" | "5m" | "15m" | "1h" | "2h" | "10h" | "tomorrow9am" | "tomorrow6pm") => {
    const now = new Date();
    let target = new Date();
    if (preset === "2m") {
      target = new Date(now.getTime() + 2 * 60 * 1000);
    } else if (preset === "5m") {
      target = new Date(now.getTime() + 5 * 60 * 1000);
    } else if (preset === "15m") {
      target = new Date(now.getTime() + 15 * 60 * 1000);
    } else if (preset === "1h") {
      target = new Date(now.getTime() + 3600 * 1000);
    } else if (preset === "2h") {
      target = new Date(now.getTime() + 2 * 3600 * 1000);
    } else if (preset === "10h") {
      target = new Date(now.getTime() + 10 * 3600 * 1000);
    } else if (preset === "tomorrow9am") {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (preset === "tomorrow6pm") {
      target.setDate(target.getDate() + 1);
      target.setHours(18, 0, 0, 0);
    }
    setScheduledDateTime(formatLocalDateTime(target));
    setError(null);
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;

    setError(null);
    setPublishing(true);

    try {
      // 1. SCHEDULE FOR LATER
      if (actionIntent === "schedule") {
        const targetDate = parseLocalDateTime(scheduledDateTime);
        if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now() + 60000) {
          setError("Scheduled time must be at least 1 minute in the future.");
          setPublishing(false);
          return;
        }

        setPublishProgress("Setting up automated publication schedule...");

        if (isRescheduling) {
          const res = await publishingApi.reschedule(
            effectiveAgencyId,
            deliverableId,
            {
              new_scheduled_at: targetDate.toISOString(),
              scheduled_timezone: userTimezone,
            },
            token
          );
          onSuccess(res);
          onClose();
        } else {
          const res = await publishingApi.schedule(
            effectiveAgencyId,
            deliverableId,
            {
              scheduled_at: targetDate.toISOString(),
              scheduled_timezone: userTimezone,
              platform: selectedPlatform,
              caption_override: captionText.trim() || undefined,
              share_to_feed: shareToFeed,
            },
            token
          );
          onSuccess(res);
          onClose();
        }
        return;
      }

      // 2. IMMEDIATE PUBLISH (AUTOMATED OR MANUAL)
      if (mode === "automated") {
        if (selectedPlatform === "both") {
          setPublishProgress("Publishing to Instagram and Facebook Page simultaneously...");
        } else if (selectedPlatform === "facebook") {
          setPublishProgress(
            isVideoOrReel 
              ? "Step 1/2: Uploading video to Facebook Page..." 
              : "Step 1/2: Publishing post to Facebook Page..."
          );
        } else {
          setPublishProgress("Step 1/3: Preparing media upload to Instagram...");
          await new Promise((r) => setTimeout(r, 400));

          if (isVideoOrReel) {
            setPublishProgress("Step 2/3: Streaming video directly to Meta upload servers...");
          } else {
            setPublishProgress("Step 2/3: Verifying media container with Meta...");
          }
        }

        const res = await publishingApi.publish(
          effectiveAgencyId,
          deliverableId,
          {
            mode: "automated",
            platform: selectedPlatform,
            caption_override: captionText,
            media_url_override: mediaUrlOverride.trim() || undefined,
            share_to_feed: shareToFeed,
          },
          token
        );

        if (selectedPlatform === "both" && res.platform_results) {
          const ig = res.platform_results.instagram;
          const fb = res.platform_results.facebook;
          if (ig?.success && fb?.success) {
            setPublishProgress("Successfully published to both Instagram and Facebook Page!");
          } else if (fb?.success && !ig?.success) {
            alert(`Facebook: Published successfully!\nInstagram: Failed (${ig?.error || "Error"})\n\nThe deliverable is now marked as published.`);
          } else if (ig?.success && !fb?.success) {
            alert(`Instagram: Published successfully!\nFacebook: Failed (${fb?.error || "Error"})\n\nThe deliverable is now marked as published.`);
          }
        } else {
          setPublishProgress(
            selectedPlatform === "facebook"
              ? "Step 2/2: Published successfully to Facebook Page!"
              : "Step 3/3: Published successfully to Instagram!"
          );
        }
        onSuccess(res);
        onClose();
      } else {
        if (!manualUrl.trim()) {
          setError("Please paste the live post URL.");
          setPublishing(false);
          return;
        }

        const res = await publishingApi.publish(
          effectiveAgencyId,
          deliverableId,
          {
            mode: "manual",
            platform: selectedPlatform,
            live_post_url: manualUrl.trim(),
          },
          token
        );
        onSuccess(res);
        onClose();
      }
    } catch (err: any) {
      console.error("Publishing error:", err);
      setError(err?.message || "Failed to process request.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {actionIntent === "schedule" ? (
              <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-xs shadow-indigo-600/30">
                <Clock className="w-4 h-4" />
              </div>
            ) : selectedPlatform === "both" ? (
              <div className="p-2 bg-gradient-to-tr from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl shadow-xs shadow-purple-600/30 flex items-center gap-1">
                <InstagramIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">+</span>
                <FacebookIcon className="w-3.5 h-3.5" />
              </div>
            ) : selectedPlatform === "facebook" ? (
              <div className="p-2 bg-gradient-to-tr from-blue-700 to-sky-500 text-white rounded-xl shadow-xs shadow-blue-600/30">
                <FacebookIcon className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-xl shadow-xs shadow-purple-600/30">
                <InstagramIcon className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
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
              <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
                {deliverableTitle} &bull; {clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={publishing}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Action Intent Switcher (Publish Now vs. Schedule for Later) */}
        {!isRescheduling && (
          <div className="px-6 pt-4 pb-0">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActionIntent("publish")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionIntent === "publish"
                    ? "bg-white text-purple-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-purple-600" />
                <span>Publish Now</span>
              </button>
              <button
                type="button"
                onClick={() => setActionIntent("schedule")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  actionIntent === "schedule"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Schedule for Later</span>
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleAction} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SCHEDULE MODE SPECIFIC CONTROLS */}
          {actionIntent === "schedule" && (
            <div className="space-y-3.5 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Scheduled Publication Time</span>
                </label>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  {userTimezone}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Presets
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset("2m")}
                    className="py-1.5 px-2 text-center text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    ⚡ +2 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("5m")}
                    className="py-1.5 px-2 text-center text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    ⚡ +5 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("15m")}
                    className="py-1.5 px-2 text-center text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    +15 Min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1h")}
                    className="py-1.5 px-2 text-center text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("10h")}
                    className="py-1.5 px-2 text-center text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    +10 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("tomorrow9am")}
                    className="py-1.5 px-2 text-center text-xs font-semibold bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-2xs transition-all cursor-pointer"
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
                  className="w-full text-xs font-bold text-slate-800 p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                />
              </div>

              {/* Dynamic countdown, timezone confirmation, and AM/PM switch suggestion banner */}
              {countdownText && (
                <div className={`p-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-between gap-2 ${
                  isPastTime
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : "bg-indigo-100/80 text-indigo-900 border border-indigo-200"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                    <span className="truncate">{countdownText}</span>
                  </div>
                  {isPastTime && amPmSuggestion && targetPMString && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledDateTime(targetPMString!);
                        setError(null);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
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
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode("automated")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "automated"
                    ? "bg-white text-purple-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Direct Meta API</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "manual"
                    ? "bg-white text-purple-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Manual Tracking</span>
              </button>
            </div>
          )}

          {/* Platform Selector (Automated or Schedule mode) */}
          {(actionIntent === "schedule" || mode === "automated") && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Target Platform
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* Instagram Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("instagram")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                    selectedPlatform === "instagram"
                      ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-1.5 rounded-lg text-white shrink-0 ${
                        selectedPlatform === "instagram"
                          ? "bg-gradient-to-tr from-purple-600 to-pink-500 shadow-xs shadow-purple-500/30"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <InstagramIcon className="w-3.5 h-3.5" />
                    </div>
                    {igAccount && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-slate-900 block truncate">Instagram</span>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
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
                      ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-1.5 rounded-lg text-white shrink-0 ${
                        selectedPlatform === "facebook"
                          ? "bg-gradient-to-tr from-blue-600 to-sky-500 shadow-xs shadow-blue-500/30"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <FacebookIcon className="w-3.5 h-3.5" />
                    </div>
                    {fbAccount && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-slate-900 block truncate">Facebook</span>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
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
                      ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-1.5 rounded-lg text-white shrink-0 flex items-center gap-0.5 ${
                        selectedPlatform === "both"
                          ? "bg-gradient-to-tr from-purple-600 via-pink-600 to-blue-600 shadow-xs shadow-indigo-500/30"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <InstagramIcon className="w-3 h-3" />
                      <FacebookIcon className="w-3 h-3" />
                    </div>
                    {igAccount && fbAccount && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="min-w-0 w-full">
                    <span className="text-xs font-bold text-slate-900 block truncate">Both (IG + FB)</span>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
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
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Connected Profile ({clientName})
                </div>

                {loadingAccounts ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    <span>Checking connected client accounts...</span>
                  </div>
                ) : selectedPlatform === "both" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-md bg-gradient-to-tr from-purple-600 to-pink-500 text-white">
                              <InstagramIcon className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">Instagram</span>
                          </div>
                          {igAccount ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Missing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                          {igAccount ? (igAccount.account_handle || igAccount.account_name || "Connected") : "No account connected"}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-md bg-gradient-to-tr from-blue-600 to-sky-500 text-white">
                              <FacebookIcon className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">Facebook Page</span>
                          </div>
                          {fbAccount ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Missing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                          {fbAccount ? (fbAccount.account_name || "Connected") : "No page connected"}
                        </p>
                      </div>
                    </div>

                    {(!igAccount || !fbAccount) && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold text-xs">
                          {igAccount.account_handle ? igAccount.account_handle[1]?.toUpperCase() : "IG"}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                            {igAccount.account_handle || igAccount.account_name || "Instagram Account"}
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Business ID: {igAccount.instagram_business_id} &bull; Connected
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center font-bold text-xs">
                          {fbAccount.account_name ? fbAccount.account_name[0]?.toUpperCase() : "FB"}
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                            {fbAccount.account_name || "Facebook Page"}
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Page ID: {fbAccount.facebook_page_id} &bull; Connected
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>
                    {selectedPlatform === "facebook" ? "Facebook Post Message / Caption" : "Approved Caption & Tags"}
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    Snapshotted for scheduled execution
                  </span>
                </label>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={4}
                  placeholder="Enter caption with #hashtags..."
                  className="w-full text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
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
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="share_to_feed" className="text-xs font-medium text-slate-700 cursor-pointer">
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
                <label className="text-xs font-bold text-slate-700">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-800 p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
                >
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Live Post URL</label>
                <input
                  type="url"
                  required
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="w-full text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* Progress Banner */}
          {publishing && (
            <div className="p-3.5 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-800 flex items-center gap-2.5 text-xs font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-indigo-600" />
              <span>{publishProgress || "Processing..."}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`inline-flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer ${
                actionIntent === "schedule"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30"
                  : selectedPlatform === "both"
                  ? "bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:opacity-90 shadow-indigo-600/30"
                  : selectedPlatform === "facebook"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 shadow-blue-600/30"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30"
              }`}
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
