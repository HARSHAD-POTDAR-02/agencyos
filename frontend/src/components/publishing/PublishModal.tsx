"use client";

import React, { useState, useEffect } from "react";
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Sparkles, 
  RefreshCw, 
  Link2,
  Clock
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { socialApi, publishingApi, SocialAccount, PublishResult } from "@/lib/api";

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
  onSuccess: (result: PublishResult) => void;
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
}: PublishModalProps) {
  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

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

  useEffect(() => {
    if (caption) setCaptionText(caption);
  }, [caption]);

  // Sync selectedPlatform with deliverable's platform prop if valid
  useEffect(() => {
    if (platform) {
      const p = platform.toLowerCase();
      if (p.includes("facebook") || p === "fb") {
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
          if (p.includes("facebook") && hasFb) {
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
  const currentAccount = selectedPlatform === "facebook" ? fbAccount : igAccount;
  const isVideoOrReel = deliverableType.toLowerCase().includes("reel") || deliverableType.toLowerCase().includes("video");

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;

    setError(null);
    setPublishing(true);

    try {
      if (mode === "automated") {
        if (selectedPlatform === "facebook") {
          setPublishProgress(
            isVideoOrReel 
              ? "Step 1/2: Uploading video to Facebook Page..." 
              : "Step 1/2: Publishing post to Facebook Page..."
          );
        } else {
          setPublishProgress("Step 1/3: Creating media container on Meta servers...");
          await new Promise((r) => setTimeout(r, 600));

          if (isVideoOrReel) {
            setPublishProgress("Step 2/3: Polling Instagram Reel transcoding status...");
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

        setPublishProgress(
          selectedPlatform === "facebook"
            ? "Step 2/2: Published successfully to Facebook Page!"
            : "Step 3/3: Published successfully to Instagram!"
        );
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
      setError(err?.message || "Failed to publish deliverable.");
    } finally {
      setPublishing(false);
      setPublishProgress("");
    }
  };

  const isSubmitDisabled =
    publishing ||
    (mode === "automated" && !currentAccount) ||
    (mode === "manual" && !manualUrl.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {selectedPlatform === "facebook" ? (
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
                {mode === "automated"
                  ? `Publish to ${selectedPlatform === "facebook" ? "Facebook Page" : "Instagram"}`
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
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded-lg hover:bg-slate-100"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handlePublish} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode("automated")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === "manual"
                  ? "bg-white text-purple-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Manual Tracking</span>
            </button>
          </div>

          {/* Platform Selector in Automated Mode */}
          {mode === "automated" && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Target Platform
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Instagram Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("instagram")}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPlatform === "instagram"
                      ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg text-white shrink-0 ${
                      selectedPlatform === "instagram"
                        ? "bg-gradient-to-tr from-purple-600 to-pink-500 shadow-xs shadow-purple-500/30"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <InstagramIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <span>Instagram</span>
                      {igAccount && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {igAccount ? (igAccount.account_handle || "Connected") : "Not connected"}
                    </p>
                  </div>
                </button>

                {/* Facebook Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("facebook")}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPlatform === "facebook"
                      ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg text-white shrink-0 ${
                      selectedPlatform === "facebook"
                        ? "bg-gradient-to-tr from-blue-600 to-sky-500 shadow-xs shadow-blue-500/30"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    <FacebookIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <span>Facebook</span>
                      {fbAccount && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {fbAccount ? (fbAccount.account_name || "Connected") : "Not connected"}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Automated Mode Details */}
          {mode === "automated" && (
            <div className="space-y-4">
              {/* Target Profile Verification */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Connected Profile ({clientName})
                </div>

                {loadingAccounts ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    <span>Checking connected client accounts...</span>
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
                      <p className="text-[11px] text-slate-500">
                        Select <strong>Facebook</strong> above, switch to <strong>Manual Tracking</strong>, or add Instagram credentials in the client workspace.
                      </p>
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
                            Page ID: {fbAccount.facebook_page_id} &bull; Connected {fbAccount.account_handle ? `(${fbAccount.account_handle})` : ""}
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
                      <p className="text-[11px] text-slate-500">
                        Select <strong>Instagram</strong> above, switch to <strong>Manual Tracking</strong>, or connect Facebook Page credentials in the client workspace.
                      </p>
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
                    {selectedPlatform === "facebook" ? "Sent to Facebook Page" : "Sent to Instagram"}
                  </span>
                </label>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={4}
                  placeholder={
                    selectedPlatform === "facebook"
                      ? "Enter message for your Facebook Page post..."
                      : "Enter caption with #hashtags..."
                  }
                  className="w-full text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                />
              </div>

              {/* Public Media URL Override (for local dev or external CDNs) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">
                    Public Media URL (Optional Override)
                  </label>
                  <span className="text-[10px] text-slate-400">Public HTTPS link</span>
                </div>
                <input
                  type="url"
                  value={mediaUrlOverride}
                  onChange={(e) => setMediaUrlOverride(e.target.value)}
                  placeholder="Defaults to uploaded file (or paste any public HTTPS video/image link)"
                  className="w-full text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Meta servers require a public link. In local development with a tunnel, this defaults to the media file automatically.
                </p>
              </div>

              {/* Instagram specific options */}
              {selectedPlatform === "instagram" && isVideoOrReel && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="share_to_feed"
                    checked={shareToFeed}
                    onChange={(e) => setShareToFeed(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="share_to_feed" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Share Reel to main Profile Grid (recommended)
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode Details */}
          {mode === "manual" && (
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
                  placeholder={
                    selectedPlatform === "facebook"
                      ? "https://www.facebook.com/..."
                      : "https://www.instagram.com/reel/..."
                  }
                  className="w-full text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-400">
                  Paste the public link from the social platform after publishing.
                </p>
              </div>
            </div>
          )}

          {/* Progress Banner */}
          {publishing && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
              selectedPlatform === "facebook"
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-purple-50 border-purple-200 text-purple-800"
            }`}>
              <RefreshCw className={`w-4 h-4 animate-spin shrink-0 ${
                selectedPlatform === "facebook" ? "text-blue-600" : "text-purple-600"
              }`} />
              <span>{publishProgress || "Publishing to social network..."}</span>
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
                selectedPlatform === "facebook"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 shadow-blue-600/30"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {mode === "automated"
                  ? selectedPlatform === "facebook"
                    ? "Publish to Facebook Page"
                    : "Publish to Instagram"
                  : "Save as Published"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
