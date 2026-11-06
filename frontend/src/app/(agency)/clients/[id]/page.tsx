"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, brandProfileApi, contractApi, campaignApi, reviewerApi, socialApi, publishingApi, SocialAccount, MonthlyReport } from "@/lib/api";
import {
  ArrowLeft,
  Building2,
  Sparkles,
  ShieldCheck,
  FileText,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Save,
  Trash2,
  HelpCircle,
  ExternalLink,
  UserCheck,
  Mail,
  X,
  Eye,
  Share2,
  Key,
  BarChart3,
  TrendingUp,
  Send,
  RefreshCw,
} from "lucide-react";

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

interface Client {
  id: string;
  agency_id: string;
  business_name: string;
  industry: string | null;
  website: string | null;
  location: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "active" | "onboarding" | "paused" | "offboarded";
}

interface BrandProfile {
  id?: string;
  brand_voice: string | null;
  tone_examples: string[] | string | null;
  approved_phrases: string[] | string | null;
  prohibited_claims: string[] | string | null;
  target_audience: string[] | string | null;
  content_pillars: string[] | string | null;
  goals: string[] | string | null;
  is_confirmed: boolean;
}

interface ScopeItem {
  id?: string;
  deliverable_type: string;
  platform: string;
  monthly_quantity: number;
}

interface Contract {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  monthly_fee_inr: number | null;
  status: string;
  revision_allowance: number;
  notes: string | null;
  scope_items: ScopeItem[];
}

interface Campaign {
  id: string;
  name: string;
  period_month: number | null;
  period_year: number | null;
  objective: string | null;
  status: string;
  created_at: string;
}

function ClientWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { token, activeAgencyId, agencies } = useAuth();

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<"brand" | "contracts" | "campaigns" | "reviewers" | "social" | "reports">("brand");
  const [loading, setLoading] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Social accounts state (Phase 5)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState<"instagram" | "facebook">("instagram");
  const [socialAccountName, setSocialAccountName] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [igBusinessId, setIgBusinessId] = useState("");
  const [fbPageId, setFbPageId] = useState("");
  const [socialAccessToken, setSocialAccessToken] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ username?: string; name?: string } | null>(null);
  const [connectingSocial, setConnectingSocial] = useState(false);

  // Token exchange helper state
  const [showTokenHelper, setShowTokenHelper] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [shortToken, setShortToken] = useState("");
  const [exchangingToken, setExchangingToken] = useState(false);

  // Monthly Report state (Phase 5)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Reviewer state
  const [reviewers, setReviewers] = useState<{ id: string; email: string; full_name: string | null; user_id: string }[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [invitePassword, setInvitePassword] = useState("ClientPass123!");
  const [inviting, setInviting] = useState(false);

  // Brand Profile State
  const [brandVoice, setBrandVoice] = useState("");
  const [toneExamplesText, setToneExamplesText] = useState("");
  const [targetAudienceText, setTargetAudienceText] = useState("");
  const [contentPillarsText, setContentPillarsText] = useState("");
  const [prohibitedClaimsText, setProhibitedClaimsText] = useState("");
  const [approvedPhrasesText, setApprovedPhrasesText] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Contracts State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractName, setContractName] = useState("Social Media Retainer");
  const [monthlyFee, setMonthlyFee] = useState("65000");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [scopeType, setScopeType] = useState("reel");
  const [scopePlatform, setScopePlatform] = useState("instagram");
  const [scopeQuantity, setScopeQuantity] = useState("30");
  const [creatingContract, setCreatingContract] = useState(false);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const loadData = useCallback(async () => {
    if (!token || !effectiveAgencyId || !clientId) return;
    setLoading(true);
    try {
      // 1. Fetch Client Details
      const c = (await clientApi.get(effectiveAgencyId, clientId, token)) as Client;
      setClient(c);

      // 2. Fetch Brand Profile
      try {
        const bp = (await brandProfileApi.get(effectiveAgencyId, clientId, token)) as BrandProfile | null;
        if (bp) {
          setBrandVoice(bp.brand_voice || "");
          setToneExamplesText(Array.isArray(bp.tone_examples) ? bp.tone_examples.join("\n") : (bp.tone_examples as string) || "");
          setTargetAudienceText(Array.isArray(bp.target_audience) ? bp.target_audience.join("\n") : (bp.target_audience as string) || "");
          setContentPillarsText(Array.isArray(bp.content_pillars) ? bp.content_pillars.join("\n") : (bp.content_pillars as string) || "");
          setProhibitedClaimsText(Array.isArray(bp.prohibited_claims) ? bp.prohibited_claims.join("\n") : (bp.prohibited_claims as string) || "");
          setApprovedPhrasesText(Array.isArray(bp.approved_phrases) ? bp.approved_phrases.join("\n") : (bp.approved_phrases as string) || "");
          setIsConfirmed(bp.is_confirmed || false);
        }
      } catch (e) {
        // profile might not exist yet
      }

      // 3. Fetch Contracts
      try {
        const ctList = (await contractApi.list(effectiveAgencyId, clientId, token)) as Contract[];
        setContracts(ctList || []);
      } catch (e) {
        // ignore
      }

      // 4. Fetch Campaigns
      try {
        const campList = (await campaignApi.list(effectiveAgencyId, clientId, token)) as Campaign[];
        setCampaigns(campList || []);
      } catch (e) {
        // ignore
      }

      // 5. Fetch Reviewers
      try {
        const revList = (await reviewerApi.list(effectiveAgencyId, clientId, token)) as any[];
        setReviewers(revList || []);
      } catch (e) {
        // ignore
      }

      // 6. Fetch Social Accounts (Phase 5)
      try {
        const socList = await socialApi.list(effectiveAgencyId, clientId, token);
        setSocialAccounts(socList || []);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to load client details." });
    } finally {
      setLoading(false);
    }
  }, [token, effectiveAgencyId, clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchMonthlyReport = async (m?: number, y?: number) => {
    if (!token || !effectiveAgencyId || !clientId) return;
    setLoadingReport(true);
    try {
      const data = await publishingApi.monthlyReport(
        effectiveAgencyId,
        clientId,
        token,
        m || reportMonth,
        y || reportYear
      );
      setMonthlyReport(data);
    } catch (err: any) {
      console.error("Failed to load monthly report:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleVerifySocial = async () => {
    if (!token || !effectiveAgencyId || !igBusinessId.trim() || !socialAccessToken.trim()) {
      setNotification({ type: "error", text: "Please provide Instagram Business ID and Access Token to test." });
      return;
    }
    setVerifyingToken(true);
    setVerifyResult(null);
    try {
      const res = await socialApi.verify(effectiveAgencyId, clientId, {
        instagram_business_id: igBusinessId.trim(),
        access_token: socialAccessToken.trim(),
      }, token);
      setVerifyResult(res);
      if (res.username && !socialHandle) {
        setSocialHandle(`@${res.username}`);
      }
      setNotification({ type: "success", text: `Connection verified! Target account: @${res.username || res.id}` });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Meta token verification failed." });
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleExchangeToken = async () => {
    if (!token || !effectiveAgencyId || !appId || !appSecret || !shortToken) {
      setNotification({ type: "error", text: "Please enter App ID, App Secret, and Short-lived Token." });
      return;
    }
    setExchangingToken(true);
    try {
      const res = await socialApi.exchangeToken(effectiveAgencyId, clientId, {
        app_id: appId.trim(),
        app_secret: appSecret.trim(),
        short_lived_token: shortToken.trim(),
      }, token);
      setSocialAccessToken(res.access_token);
      setShowTokenHelper(false);
      setNotification({ type: "success", text: "60-day Long-Lived Token generated and populated successfully!" });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Token exchange failed." });
    } finally {
      setExchangingToken(false);
    }
  };

  const handleConnectSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;
    setConnectingSocial(true);
    setNotification(null);
    try {
      await socialApi.connect(effectiveAgencyId, clientId, {
        platform: socialPlatform,
        account_name: socialAccountName.trim() || client?.business_name,
        account_handle: socialHandle.trim() || undefined,
        instagram_business_id: igBusinessId.trim() || undefined,
        facebook_page_id: fbPageId.trim() || undefined,
        access_token: socialAccessToken.trim(),
      }, token);
      setShowConnectModal(false);
      setNotification({ type: "success", text: `${socialPlatform.toUpperCase()} account connected for ${client?.business_name}!` });
      // Reload social accounts
      const socList = await socialApi.list(effectiveAgencyId, clientId, token);
      setSocialAccounts(socList || []);
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to connect social account." });
    } finally {
      setConnectingSocial(false);
    }
  };

  const handleDeleteSocial = async (accountId: string) => {
    if (!token || !effectiveAgencyId || !confirm("Disconnect this social account?")) return;
    try {
      await socialApi.delete(effectiveAgencyId, clientId, accountId, token);
      setNotification({ type: "success", text: "Social account disconnected." });
      const socList = await socialApi.list(effectiveAgencyId, clientId, token);
      setSocialAccounts(socList || []);
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to disconnect account." });
    }
  };

  const handleSaveBrandProfile = async (confirmProfile = false) => {
    if (!token || !effectiveAgencyId) return;
    setSavingBrand(true);
    setNotification(null);

    const parseLines = (text: string) =>
      text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const payload = {
      brand_voice: brandVoice,
      tone_examples: parseLines(toneExamplesText),
      target_audience: parseLines(targetAudienceText),
      content_pillars: parseLines(contentPillarsText),
      prohibited_claims: parseLines(prohibitedClaimsText),
      approved_phrases: parseLines(approvedPhrasesText),
      is_confirmed: confirmProfile || isConfirmed,
    };

    try {
      await brandProfileApi.upsert(effectiveAgencyId, clientId, payload, token);
      setIsConfirmed(confirmProfile || isConfirmed);
      setNotification({
        type: "success",
        text: confirmProfile
          ? "Brand guidelines successfully locked and confirmed! AI planner and team will strictly follow this."
          : "Brand profile saved successfully.",
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to save brand profile." });
    } finally {
      setSavingBrand(false);
    }
  };

  const handleInviteReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId || !inviteEmail.trim()) return;
    setInviting(true);
    setNotification(null);
    try {
      const r = (await reviewerApi.invite(effectiveAgencyId, clientId, {
        email: inviteEmail.trim(),
        full_name: inviteFullName.trim() || undefined,
        password: invitePassword.trim() || "ClientPass123!",
      }, token)) as any;
      setReviewers((prev) => [...prev, r]);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteFullName("");
      setInvitePassword("ClientPass123!");
      setNotification({ type: "success", text: `${r.email} invited as reviewer. Share the /portal link and their temporary password.` });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to invite reviewer." });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Client["status"]) => {
    if (!token || !effectiveAgencyId || !client) return;
    setUpdatingStatus(true);
    setNotification(null);
    try {
      await clientApi.update(effectiveAgencyId, clientId, { status: newStatus }, token);
      setClient({ ...client, status: newStatus });
      setNotification({
        type: "success",
        text: `Client status successfully updated to ${newStatus.toUpperCase()}.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update client status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId) return;
    setCreatingContract(true);
    setNotification(null);

    try {
      await contractApi.create(
        effectiveAgencyId,
        clientId,
        {
          name: contractName,
          monthly_fee_inr: parseFloat(monthlyFee) || 0,
          start_date: startDate,
          scope_items: [
            {
              deliverable_type: scopeType,
              platform: scopePlatform,
              monthly_quantity: parseInt(scopeQuantity, 10) || 30,
            },
          ],
        },
        token
      );
      setShowContractModal(false);
      setNotification({ type: "success", text: "Retainer contract and scope quotas activated!" });
      loadData();
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to create contract." });
    } finally {
      setCreatingContract(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading client workspace...</p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Client Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            The requested client workspace does not exist or you do not have permission to access it.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clients</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4">
        <Link href="/clients" className="hover:text-purple-600 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Clients</span>
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-bold">{client.business_name}</span>
      </div>

      {/* Client Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 text-white font-black text-xl flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              {client.business_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{client.business_name}</h1>
                <select
                  value={client.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value as Client["status"])}
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                    client.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : client.status === "onboarding"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : client.status === "paused"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                  title="Click to change client status"
                >
                  <option value="onboarding">🔵 Onboarding</option>
                  <option value="active">🟢 Active</option>
                  <option value="paused">🟡 Paused</option>
                  <option value="offboarded">⚪ Offboarded</option>
                </select>
                {isConfirmed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Brand Locked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {client.industry || "General Industry"} &bull; {client.location || "Location not set"}
                {client.website && (
                  <a
                    href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 ml-3 text-purple-600 hover:underline font-semibold"
                  >
                    <span>Website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/campaigns?clientId=${client.id}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Generate AI Plan ✨</span>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist Banner (shown while in onboarding) */}
        {client.status === "onboarding" && (
          <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 border border-blue-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Client Onboarding in Progress</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Complete the milestones below to complete onboarding and activate retainer delivery.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Profile Details
                </span>
                <span className={`flex items-center gap-1 font-semibold ${isConfirmed ? "text-emerald-700" : "text-slate-500"}`}>
                  {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                  Brand Guidelines Locked
                </span>
                <span className={`flex items-center gap-1 font-semibold ${contracts.length > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                  {contracts.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                  Contract & Quotas ({contracts.length})
                </span>
                <span className={`flex items-center gap-1 font-semibold ${campaigns.length > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                  {campaigns.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                  First Campaign ({campaigns.length})
                </span>
              </div>
            </div>

            <button
              onClick={() => handleUpdateStatus("active")}
              disabled={updatingStatus}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs shadow-emerald-600/30 transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Complete Onboarding & Activate 🚀</span>
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={() => setActiveTab("brand")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "brand"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Brand Voice & Guidelines</span>
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "contracts"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Retainer Contracts & Quotas ({contracts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "campaigns"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Campaign Plans ({campaigns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reviewers")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "reviewers"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Client Reviewers ({reviewers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("social")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "social"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Social & Publishing ({socialAccounts.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              fetchMonthlyReport();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "reports"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Delivery Report</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* TAB 1: BRAND GUIDELINES */}
      {activeTab === "brand" && (
        <div className="space-y-6">
          <div className="bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-purple-950">Why Brand Guidelines Matter in AgencyOS</h4>
              <p className="text-[12px] text-purple-800/90 mt-0.5 leading-relaxed">
                When you save and confirm this profile, AgencyOS injects these rules directly into the Groq AI Campaign Planner
                and Content Version approvals. Any prohibited claims or off-brand phrases will be automatically flagged before
                content goes to client review.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            {/* Brand Voice */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Brand Voice & Personality <span className="text-purple-600">*</span>
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Describe how the brand speaks to its audience (e.g. &quot;Authoritative yet approachable, relatable Hinglish blend, witty hook-driven&quot;).
              </p>
              <textarea
                rows={3}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. Confident, modern Indian conversational tone with smart humor and zero corporate jargon."
                className="w-full bg-slate-50 text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
              />
            </div>

            {/* Tone Examples */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Tone & Copy Examples (1 per line)</label>
              <p className="text-[11px] text-slate-400 mb-2">Sample sentences or caption hooks that capture the brand vibe perfectly.</p>
              <textarea
                rows={3}
                value={toneExamplesText}
                onChange={(e) => setToneExamplesText(e.target.value)}
                placeholder={"&quot;Chai isn&apos;t just tea, it&apos;s our 4 PM therapy session.&quot;\n&quot;No fake promises, only pure organic brew.&quot;"}
                className="w-full bg-slate-50 text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all font-mono"
              />
            </div>

            {/* 2-Column Grid: Content Pillars & Target Audience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Content Pillars (1 per line)</label>
                <p className="text-[11px] text-slate-400 mb-2">The key themes repeated in 30-day sprints.</p>
                <textarea
                  rows={4}
                  value={contentPillarsText}
                  onChange={(e) => setContentPillarsText(e.target.value)}
                  placeholder={"Industry Insights & Busting Myths\nRelatable Work Humor & Trends\nBehind The Scenes\nCustomer Transformation Stories\nQuick Tips & Frameworks"}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Target Audience</label>
                <p className="text-[11px] text-slate-400 mb-2">Who are we talking to? Demographics, geography, pain points.</p>
                <textarea
                  rows={4}
                  value={targetAudienceText}
                  onChange={(e) => setTargetAudienceText(e.target.value)}
                  placeholder={"Urban Indian professionals aged 22-38 in tier 1 & 2 cities\nInterested in fitness, premium lifestyle, and productivity\nActive primarily on Instagram Reels & LinkedIn"}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                />
              </div>
            </div>

            {/* 2-Column Grid: Prohibited Claims & Approved Phrases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>Prohibited Claims & Forbidden Words (1 per line)</span>
                </div>
                <p className="text-[11px] text-rose-600/80 mb-2">AgencyOS will flag and block any draft containing these.</p>
                <textarea
                  rows={3}
                  value={prohibitedClaimsText}
                  onChange={(e) => setProhibitedClaimsText(e.target.value)}
                  placeholder={"100% guaranteed results\nCheapest in India\nInstant cure\nUnverified clinical claims"}
                  className="w-full bg-white text-xs text-slate-800 p-3 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved Taglines & Required Phrases</span>
                </div>
                <p className="text-[11px] text-emerald-600/80 mb-2">Mandatory disclaimers or client-approved slogans.</p>
                <textarea
                  rows={3}
                  value={approvedPhrasesText}
                  onChange={(e) => setApprovedPhrasesText(e.target.value)}
                  placeholder={"Brewed with Real Passion\nAvailable exclusively at artisanstores.in\nT&C Apply"}
                  className="w-full bg-white text-xs text-slate-800 p-3 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Save Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confirmCheck"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="confirmCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Mark as Confirmed by Client
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={savingBrand}
                  onClick={() => handleSaveBrandProfile(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={savingBrand}
                  onClick={() => handleSaveBrandProfile(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-xs transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingBrand ? "Saving..." : "Lock & Confirm Guidelines"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACTS & SCOPE QUOTAS */}
      {activeTab === "contracts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Retainer Contracts & Monthly Deliverable Quotas</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                AgencyOS enforces hard caps on deliverables so your agency never executes out-of-scope work for free.
              </p>
            </div>
            <button
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Retainer Contract</span>
            </button>
          </div>

          {contracts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No active contracts</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Create a retainer contract defining the monthly retainer fee and contracted deliverables (e.g. 30 Reels / month).
              </p>
              <button
                onClick={() => setShowContractModal(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Contract</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {contracts.map((ct) => (
                <div key={ct.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-base font-bold text-slate-900">{ct.name}</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ct.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Effective from {ct.start_date} &bull; {ct.revision_allowance} Revisions Included
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-semibold">Monthly Retainer Fee</div>
                      <div className="text-lg font-black text-slate-900">
                        ₹{(ct.monthly_fee_inr || 0).toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-slate-500"> / month</span>
                      </div>
                    </div>
                  </div>

                  {/* Scope Items Breakdown */}
                  <div className="pt-4">
                    <h5 className="text-xs font-bold text-slate-700 mb-3">Contracted Deliverables & Quota Cap</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {ct.scope_items && ct.scope_items.length > 0 ? (
                        ct.scope_items.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-800 capitalize">
                                {item.deliverable_type}s
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold uppercase">{item.platform}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-purple-600">{item.monthly_quantity}</span>
                              <span className="text-[10px] text-slate-400 font-bold block">per month</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400">Standard 30 reels/month active.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Campaign Sprints for {client.business_name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every month has an AI-generated plan containing 30 day-by-day deliverables and hooks.
              </p>
            </div>
            <Link
              href={`/campaigns?clientId=${client.id}`}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>+ Generate New Sprint</span>
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No campaigns created yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Generate your first 30-day content calendar using Groq AI. All reels will be mapped to the brand tone.
              </p>
              <Link
                href={`/campaigns?clientId=${client.id}`}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Plan with AI ✨</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <div key={camp.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                        {camp.period_month && camp.period_year ? `${camp.period_month}/${camp.period_year}` : "Sprint"}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200/50">
                        {camp.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{camp.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{camp.objective || "Standard monthly content sprint."}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Created {new Date(camp.created_at).toLocaleDateString()}</span>
                    <Link
                      href={`/campaigns?campaignId=${camp.id}`}
                      className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <span>View Content Calendar</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REVIEWERS TAB */}
      {activeTab === "reviewers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Client Reviewers</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reviewers can log into <span className="font-semibold text-purple-600">/portal</span> to preview deliverables, leave comments, and approve or request changes.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Invite Reviewer</span>
            </button>
          </div>

          {reviewers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No reviewers yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Invite your client's point-of-contact to review and approve content in a clean, distraction-free portal.
              </p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Invite First Reviewer</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="divide-y divide-slate-100">
                {reviewers.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {(r.full_name || r.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{r.full_name || "—"}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {r.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <UserCheck className="w-3 h-3" />
                        Client Reviewer
                      </span>
                      <a
                        href="/portal"
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-purple-600 bg-slate-100 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Portal
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SOCIAL ACCOUNTS & PUBLISHING */}
      {activeTab === "social" && (
        <div className="space-y-6">
          <div className="bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Share2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-purple-950">Multi-Client Social Publishing Integration</h4>
                <p className="text-[12px] text-purple-800/90 mt-0.5 leading-relaxed">
                  Connect Instagram Business and Facebook accounts strictly for <strong>{client?.business_name}</strong>.
                  All credentials and access tokens are isolated per client. Approved deliverables can be published directly to Meta Graph API or logged with live links.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSocialAccountName(client?.business_name || "");
                setVerifyResult(null);
                setShowConnectModal(true);
              }}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Account</span>
            </button>
          </div>

          {socialAccounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <InstagramIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Social Accounts Connected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Connect {client?.business_name}&apos;s Instagram Business Account or Facebook Page to enable automated 1-click publishing.
              </p>
              <button
                onClick={() => {
                  setSocialAccountName(client?.business_name || "");
                  setVerifyResult(null);
                  setShowConnectModal(true);
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Connect First Social Account</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {socialAccounts.map((account) => {
                const isIg = account.platform === "instagram";
                return (
                  <div key={account.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                            isIg ? "bg-gradient-to-tr from-purple-600 to-pink-500" : "bg-blue-600"
                          }`}>
                            {isIg ? <InstagramIcon className="w-4 h-4" /> : <FacebookIcon className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                              {account.account_handle || account.account_name || "Connected Profile"}
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </h4>
                            <p className="text-[11px] text-slate-400 capitalize">
                              {account.platform} Business Account
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                          Active
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        {account.instagram_business_id && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Instagram Business ID:</span>
                            <span className="font-mono font-semibold text-slate-800">{account.instagram_business_id}</span>
                          </div>
                        )}
                        {account.facebook_page_id && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Facebook Page ID:</span>
                            <span className="font-mono font-semibold text-slate-800">{account.facebook_page_id}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Tenant Client:</span>
                          <span className="font-semibold text-purple-700">{client?.business_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Token securely stored
                      </span>
                      <button
                        onClick={() => handleDeleteSocial(account.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DELIVERY & MONTHLY PERFORMANCE REPORT */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Monthly Campaign Delivery Report
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit contract quota fulfillment and summarize published campaign assets for {client?.business_name}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={reportMonth}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setReportMonth(m);
                  fetchMonthlyReport(m, reportYear);
                }}
                className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2026, m - 1, 1).toLocaleString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>

              <select
                value={reportYear}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setReportYear(y);
                  fetchMonthlyReport(reportMonth, y);
                }}
                className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>

              <button
                onClick={() => fetchMonthlyReport()}
                className="p-2 text-slate-600 hover:text-purple-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                title="Refresh Report"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-purple-600" : ""}`} />
              </button>
            </div>
          </div>

          {loadingReport ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mb-2" />
              <span>Generating monthly performance audit...</span>
            </div>
          ) : monthlyReport ? (
            <div className="space-y-6">
              {/* 4 Metric Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contract Quota</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">
                    {monthlyReport.deliverables_delivered} / {monthlyReport.total_scope_quota}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
                    {monthlyReport.quota_fulfillment_rate}% fulfilled
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Published Live</span>
                  <div className="text-2xl font-extrabold text-purple-700 mt-2">
                    {monthlyReport.deliverables_published}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                    With public permalinks
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Impressions</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">
                    {monthlyReport.total_views > 0 ? monthlyReport.total_views.toLocaleString("en-IN") : "—"}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                    {monthlyReport.total_likes.toLocaleString("en-IN")} total likes
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Engagement Rate</span>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-2">
                    {monthlyReport.avg_engagement_rate}%
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                    Likes & comments ratio
                  </span>
                </div>
              </div>

              {/* Executive Summary Card */}
              <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 border border-purple-200/70 p-6 rounded-2xl shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider">
                    Executive Delivery Wrap-Up
                  </h4>
                </div>
                <p className="text-xs text-purple-900 leading-relaxed font-medium">
                  {monthlyReport.executive_summary}
                </p>
              </div>

              {/* Top Deliverables Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Top Performing Content Assets</h4>
                {monthlyReport.top_deliverables.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No deliverables published yet for this period.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {monthlyReport.top_deliverables.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-400 capitalize">
                            {item.deliverable_type} &bull; {item.platform}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-xs">
                          {item.views_count > 0 && (
                            <span className="text-slate-600 font-semibold">{item.views_count.toLocaleString("en-IN")} views</span>
                          )}
                          {item.live_post_url ? (
                            <a
                              href={item.live_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-700 font-bold inline-flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-lg"
                            >
                              View Live <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Approved</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* CONNECT SOCIAL ACCOUNT MODAL */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Connect Social Account</h3>
                <p className="text-xs text-slate-500">Configure Meta Graph API credentials for {client?.business_name}.</p>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectSocial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Platform</label>
                <select
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value as "instagram" | "facebook")}
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 cursor-pointer focus:outline-none"
                >
                  <option value="instagram">Instagram Professional / Business</option>
                  <option value="facebook">Facebook Page</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Account Handle / Name</label>
                <input
                  type="text"
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="@hotelshauryawada"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {socialPlatform === "instagram" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Instagram Business Account ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={igBusinessId}
                    onChange={(e) => setIgBusinessId(e.target.value)}
                    placeholder="e.g. 17841400012345"
                    className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Found in your Meta App Dashboard or Graph API Explorer.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Facebook Page ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    placeholder="e.g. 1052300012345"
                    className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">Access Token (User or Page) *</label>
                  <button
                    type="button"
                    onClick={() => setShowTokenHelper(!showTokenHelper)}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-bold"
                  >
                    {showTokenHelper ? "Hide Token Helper" : "Generate 60-Day Token?"}
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  value={socialAccessToken}
                  onChange={(e) => setSocialAccessToken(e.target.value)}
                  placeholder="Paste Meta Access Token (EAAG...)"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono resize-none"
                />
              </div>

              {/* 60-Day Token Exchange Accordion */}
              {showTokenHelper && (
                <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    <span>60-Day Long-Lived Token Exchange</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Meta App ID"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="text-xs p-2 rounded-lg bg-white border border-purple-200"
                    />
                    <input
                      type="password"
                      placeholder="Meta App Secret"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      className="text-xs p-2 rounded-lg bg-white border border-purple-200"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short-Lived User Token (from Graph API Explorer)"
                    value={shortToken}
                    onChange={(e) => setShortToken(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-purple-200 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleExchangeToken}
                    disabled={exchangingToken}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {exchangingToken ? "Exchanging..." : "Exchange for 60-Day Token"}
                  </button>
                </div>
              )}

              {/* Verification Button */}
              {socialPlatform === "instagram" && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleVerifySocial}
                    disabled={verifyingToken}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${verifyingToken ? "animate-spin" : ""}`} />
                    <span>Test & Verify with Meta</span>
                  </button>
                  {verifyResult && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified @{verifyResult.username}
                    </span>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingSocial}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-xs"
                >
                  {connectingSocial ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITE REVIEWER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Invite Client Reviewer</h3>
                <p className="text-xs text-slate-500">Create a secure login for your client to review and approve content.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteReviewer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Reviewer Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="raj@clientbrand.com"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Full Name (optional)</label>
                <input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Raj Mehta"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Temporary password"
                  className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Share this with your client. They'll use it to log into the review portal.</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {inviting ? "Inviting..." : "Invite Reviewer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CONTRACT MODAL */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Retainer Contract</h3>
                <p className="text-xs text-slate-500">Define the monthly retainer fee and deliverable quota cap.</p>
              </div>
              <button onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Contract Name</label>
                <input
                  type="text"
                  required
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Monthly Fee (₹ INR)</label>
                  <input
                    type="number"
                    required
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Scope Quota Inputs */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Deliverable Scope Quota</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
                    <select
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value)}
                      className="w-full bg-white text-xs text-slate-800 p-2 rounded-lg border border-slate-200"
                    >
                      <option value="reel">Reel / Video</option>
                      <option value="carousel">Carousel</option>
                      <option value="static_post">Static Post</option>
                      <option value="story">Story</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Platform</label>
                    <select
                      value={scopePlatform}
                      onChange={(e) => setScopePlatform(e.target.value)}
                      className="w-full bg-white text-xs text-slate-800 p-2 rounded-lg border border-slate-200"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Qty / Month</label>
                    <input
                      type="number"
                      min="1"
                      value={scopeQuantity}
                      onChange={(e) => setScopeQuantity(e.target.value)}
                      className="w-full bg-white text-xs text-slate-800 p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingContract}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-xs"
                >
                  {creatingContract ? "Activating..." : "Activate Retainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ClientWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading client workspace...</div>}>
      <ClientWorkspaceContent />
    </Suspense>
  );
}
