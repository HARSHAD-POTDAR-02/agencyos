"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { socialApi } from "@/lib/api";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface MetaPage {
  page_id: string;
  page_name: string;
  page_access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  };
}

function SocialCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [connectFb, setConnectFb] = useState(true);
  const [connectIg, setConnectIg] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const metaError = searchParams.get("error_description") || searchParams.get("error");

  // Parse state: "agency_id:client_id"
  const [agencyId, clientId] = (state || "").split(":");

  useEffect(() => {
    if (metaError) {
      setError(metaError);
      setLoading(false);
      return;
    }

    if (!code) {
      setError("No authorization code was returned from Meta.");
      setLoading(false);
      return;
    }

    if (!token) {
      // Wait for auth context to load
      return;
    }

    if (!agencyId || !clientId) {
      setError("Invalid OAuth state: missing agency or client reference.");
      setLoading(false);
      return;
    }

    const resolve = async () => {
      try {
        setLoading(true);
        const redirectUri = window.location.origin + "/social/callback";
        const res = await socialApi.resolveCode(
          agencyId,
          clientId,
          { code, redirect_uri: redirectUri },
          token
        );

        if (!res.pages || res.pages.length === 0) {
          setError(
            "Meta authorization was successful, but no Facebook Pages were found under your account. Ensure you have created a Facebook Page and linked your Instagram Business profile to it."
          );
        } else {
          setPages(res.pages);
          setSelectedPageId(res.pages[0].page_id);
        }
      } catch (err: any) {
        setError(err.message || "Failed to exchange Meta OAuth authorization code.");
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [code, state, metaError, token, agencyId, clientId]);

  const handleConnect = async () => {
    if (!token || !agencyId || !clientId || !selectedPageId) return;
    const selected = pages.find((p) => p.page_id === selectedPageId);
    if (!selected) return;

    setConnecting(true);
    setError(null);
    try {
      await socialApi.connectSelected(
        agencyId,
        clientId,
        {
          page_id: selected.page_id,
          page_name: selected.page_name,
          page_access_token: selected.page_access_token,
          connect_facebook: connectFb,
          connect_instagram: connectIg,
          instagram_business_id: selected.instagram_business_account?.id,
          instagram_username: selected.instagram_business_account?.username,
        },
        token
      );
      setSuccess(true);
      setTimeout(() => {
        router.push(`/clients/${clientId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save selected social accounts.");
      setConnecting(false);
    }
  };

  const selectedPage = pages.find((p) => p.page_id === selectedPageId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Meta Account Authorization</h1>
            <p className="text-xs text-slate-400">Connecting Facebook Pages & Instagram Business</p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-white">Connecting with Meta...</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Exchanging your authorization token and retrieving your managed Facebook Pages & Instagram profiles.
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="py-6">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-rose-300">Connection Failed</h3>
                <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                href={clientId ? `/clients/${clientId}` : "/clients"}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Back to Client Profile
              </Link>
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && !error && success && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Connected Successfully!</h2>
            <p className="text-sm text-slate-400 mt-1">
              Your Meta accounts are now linked. Redirecting back to your client workspace...
            </p>
          </div>
        )}

        {/* Account Selection State */}
        {!loading && !error && !success && pages.length > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-300">
              Select the Facebook Page and Instagram profile you want to link to this client:
            </p>

            <div className="space-y-3">
              {pages.map((p) => {
                const isSelected = p.page_id === selectedPageId;
                return (
                  <div
                    key={p.page_id}
                    onClick={() => setSelectedPageId(p.page_id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500 shadow-md shadow-blue-500/10"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
                          f
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{p.page_name}</div>
                          <div className="text-xs text-slate-400">Page ID: {p.page_id}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="selected_page"
                        checked={isSelected}
                        onChange={() => setSelectedPageId(p.page_id)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    {p.instagram_business_account && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-3">
                        {p.instagram_business_account.profile_picture_url ? (
                          <img
                            src={p.instagram_business_account.profile_picture_url}
                            alt=""
                            className="w-8 h-8 rounded-full border border-pink-500/30"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-xs font-bold text-pink-400">
                            IG
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-pink-300">
                            Linked Instagram: @{p.instagram_business_account.username || "account"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ID: {p.instagram_business_account.id}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedPage && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Link Options
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={connectFb}
                    onChange={(e) => setConnectFb(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Connect Facebook Page ({selectedPage.page_name})</span>
                </label>
                {selectedPage.instagram_business_account ? (
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connectIg}
                      onChange={(e) => setConnectIg(e.target.checked)}
                      className="rounded text-pink-600 focus:ring-pink-500"
                    />
                    <span>
                      Connect Instagram Profile (@{selectedPage.instagram_business_account.username})
                    </span>
                  </label>
                ) : (
                  <div className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                    Notice: This Facebook Page does not have a linked Instagram Business account. Only Facebook publishing will be enabled.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href={clientId ? `/clients/${clientId}` : "/clients"}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                disabled={connecting || (!connectFb && !connectIg)}
                onClick={handleConnect}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Connect</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SocialCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      }
    >
      <SocialCallbackContent />
    </Suspense>
  );
}
