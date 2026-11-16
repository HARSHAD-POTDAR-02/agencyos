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
  const { token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<"brand" | "contracts" | "campaigns" | "reviewers" | "social" | "reports">("brand");
  const [loading, setLoading] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDeleteClient = async () => {
    if (!token || !effectiveAgencyId || !clientId) return;
    setDeletingClient(true);
    try {
      await clientApi.delete(effectiveAgencyId, clientId, token);
      router.push("/clients");
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to delete client workspace." });
      setDeletingClient(false);
      setShowDeleteModal(false);
    }
  };

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
    if (!token || !effectiveAgencyId || !clientId || isSpecialist) {
      setLoading(false);
      return;
    }
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

  if (!isLoading && isSpecialist) {
    return null;
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#A3A0B0]">Loading client workspace...</p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto">
        <div className="bg-[#17171E] rounded-2xl border border-[#30303D] p-8 text-center max-w-md mx-auto shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#F2F0F7]">Client Not Found</h2>
          <p className="text-xs text-[#A3A0B0] mt-1 mb-4">
            The requested client workspace does not exist or you do not have permission to access it.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold px-4 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clients</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
        <Link href="/clients" className="hover:text-[#A78BFA] flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Clients</span>
        </Link>
        <span className="text-white/[0.2]">/</span>
        <span className="text-[#F2F0F7] font-semibold">{client.business_name}</span>
      </div>

      {/* Client Header Card with Arc Spatial Identity */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.1),transparent_70%)] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#262630] to-[#17171E] border border-white/[0.1] text-[#F2F0F7] font-mono font-bold text-lg flex items-center justify-center shrink-0 shadow-inner">
              {client.business_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold text-[#F2F0F7] tracking-tight">{client.business_name}</h1>
                <select
                  value={client.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value as Client["status"])}
                  className="text-[10px] font-mono font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-md border cursor-pointer focus:outline-none bg-[#101014] text-[#F2F0F7] border-white/[0.1]"
                  title="Click to change client status"
                >
                  <option value="onboarding">🔵 Onboarding</option>
                  <option value="active">🟢 Active</option>
                  <option value="paused">🟡 Paused</option>
                  <option value="offboarded">⚪ Offboarded</option>
                </select>
                {isConfirmed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[rgba(69,184,138,0.12)] text-[#45B88A] border border-[#45B88A]/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Brand Locked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A3A0B0] font-normal mt-1 flex items-center gap-2">
                <span>{client.industry || "General Industry"}</span>
                <span className="text-white/[0.2]">&bull;</span>
                <span>{client.location || "Location not set"}</span>
                {client.website && (
                  <>
                    <span className="text-white/[0.2]">&bull;</span>
                    <a
                      href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#A78BFA] hover:text-[#B69BFF] font-medium font-mono text-[11px]"
                    >
                      <span>Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#E16F7B] bg-[rgba(225,111,123,0.1)] hover:bg-[rgba(225,111,123,0.18)] border border-[#E16F7B]/30 transition-all cursor-pointer"
              title="Permanently delete this client workspace"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Client</span>
            </button>
            <Link
              href={`/campaigns?clientId=${client.id}`}
              className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-[0_1px_8px_rgba(167,139,250,0.3)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#101014]" />
              <span>AI Plan</span>
            </Link>
          </div>
        </div>

        {/* Offboarded Banner */}
        {client.status === "offboarded" && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#A3A0B0]" />
                <span className="text-xs font-medium text-[#F2F0F7]">Client Workspace is Offboarded</span>
              </div>
              <p className="text-[11px] text-[#A3A0B0]">
                Retainer services ended. You can reactivate or permanently delete this workspace.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleUpdateStatus("active")}
                disabled={updatingStatus}
                className="px-3 py-1 text-xs font-medium bg-[#17171E] border border-white/[0.08] text-[#F2F0F7] hover:bg-[#262630] rounded-lg transition-all cursor-pointer"
              >
                Reactivate Workspace
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[#E16F7B] hover:bg-[#E16F7B]/90 text-white rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Onboarding Checklist Banner (shown while in onboarding) */}
        {client.status === "onboarding" && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#69A9D8]" />
                <span className="text-xs font-semibold text-[#F2F0F7]">Client Onboarding in Progress</span>
              </div>
              <p className="text-[11px] text-[#A3A0B0]">
                Complete milestones to activate automated retainer delivery.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                <span className="flex items-center gap-1 font-medium text-[#45B88A]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" />
                  Profile Details
                </span>
                <span className={`flex items-center gap-1 font-medium ${isConfirmed ? "text-[#45B88A]" : "text-[#A3A0B0]/60"}`}>
                  {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" /> : <Clock className="w-3.5 h-3.5 text-[#A3A0B0]/60" />}
                  Brand Guidelines Locked
                </span>
                <span className={`flex items-center gap-1 font-medium ${contracts.length > 0 ? "text-[#45B88A]" : "text-[#A3A0B0]/60"}`}>
                  {contracts.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" /> : <Clock className="w-3.5 h-3.5 text-[#A3A0B0]/60" />}
                  Contract & Quotas ({contracts.length})
                </span>
                <span className={`flex items-center gap-1 font-medium ${campaigns.length > 0 ? "text-[#45B88A]" : "text-[#A3A0B0]/60"}`}>
                  {campaigns.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#45B88A]" /> : <Clock className="w-3.5 h-3.5 text-[#A3A0B0]/60" />}
                  First Campaign ({campaigns.length})
                </span>
              </div>
            </div>

            <button
              onClick={() => handleUpdateStatus("active")}
              disabled={updatingStatus}
              className="inline-flex items-center justify-center gap-1.5 bg-[#45B88A] hover:bg-[#45B88A]/90 text-[#101014] text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer shadow-[0_1px_8px_rgba(69,184,138,0.3)]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Onboarding</span>
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mt-5 border-t border-white/[0.08] pt-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("brand")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "brand"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Brand Voice & Guidelines</span>
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "contracts"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#69A9D8]" />
            <span>Retainer Contracts & Quotas ({contracts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "campaigns"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#E5AA58]" />
            <span>Campaign Plans ({campaigns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reviewers")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "reviewers"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-[#45B88A]" />
            <span>Client Reviewers ({reviewers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("social")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "social"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Social & Publishing ({socialAccounts.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              fetchMonthlyReport();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "reports"
                ? "bg-[#20202A] text-[#F2F0F7] border border-white/[0.1] shadow-xs font-semibold"
                : "text-[#A3A0B0] hover:bg-white/[0.04] hover:text-[#F2F0F7]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#69A9D8]" />
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
        <div className="space-y-5">
          <div className="bg-[rgba(167,139,250,0.08)] border border-[#A78BFA]/20 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-[#F2F0F7]">Brand Guidelines in AgencyOS</h4>
              <p className="text-[11px] text-[#A3A0B0] mt-0.5 leading-relaxed">
                When confirmed and locked, AgencyOS injects these rules directly into the Multi-Agent Campaign Strategist and Content Evaluator. Prohibited claims or off-brand phrases are automatically flagged during pipeline generation.
              </p>
            </div>
          </div>

          <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5 shadow-2xs space-y-5">
            {/* Brand Voice */}
            <div>
              <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                Brand Voice & Personality <span className="text-[#A78BFA]">*</span>
              </label>
              <p className="text-[11px] text-[#A3A0B0] mb-2">
                Describe how the brand speaks to its audience (e.g. &quot;Authoritative yet approachable, relatable Hinglish blend, witty hook-driven&quot;).
              </p>
              <textarea
                rows={3}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. Confident, modern Indian conversational tone with smart humor and zero corporate jargon."
                className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-3 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all"
              />
            </div>

            {/* Tone Examples */}
            <div>
              <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Tone & Copy Examples (1 per line)</label>
              <p className="text-[11px] text-[#A3A0B0] mb-2">Sample sentences or caption hooks that capture the brand vibe perfectly.</p>
              <textarea
                rows={3}
                value={toneExamplesText}
                onChange={(e) => setToneExamplesText(e.target.value)}
                placeholder={"\"Chai isn't just tea, it's our 4 PM therapy session.\"\n\"No fake promises, only pure organic brew.\""}
                className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-3 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all font-mono"
              />
            </div>

            {/* 2-Column Grid: Content Pillars & Target Audience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Content Pillars (1 per line)</label>
                <p className="text-[11px] text-[#A3A0B0] mb-2">The key themes repeated in 30-day sprints.</p>
                <textarea
                  rows={4}
                  value={contentPillarsText}
                  onChange={(e) => setContentPillarsText(e.target.value)}
                  placeholder={"Industry Insights & Busting Myths\nRelatable Work Humor & Trends\nBehind The Scenes\nCustomer Transformation Stories\nQuick Tips & Frameworks"}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-3 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Target Audience</label>
                <p className="text-[11px] text-[#A3A0B0] mb-2">Who are we talking to? Demographics, geography, pain points.</p>
                <textarea
                  rows={4}
                  value={targetAudienceText}
                  onChange={(e) => setTargetAudienceText(e.target.value)}
                  placeholder={"Urban Indian professionals aged 22-38 in tier 1 & 2 cities\nInterested in fitness, premium lifestyle, and productivity\nActive primarily on Instagram Reels & LinkedIn"}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-3 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA] transition-all"
                />
              </div>
            </div>

            {/* 2-Column Grid: Prohibited Claims & Approved Phrases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[rgba(225,111,123,0.06)] p-4 rounded-lg border border-[#E16F7B]/20">
                <div className="flex items-center gap-1.5 text-[#E16F7B] font-semibold text-xs mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Prohibited Claims & Forbidden Words (1 per line)</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mb-2">AgencyOS will flag and block any draft containing these.</p>
                <textarea
                  rows={3}
                  value={prohibitedClaimsText}
                  onChange={(e) => setProhibitedClaimsText(e.target.value)}
                  placeholder={"100% guaranteed results\nCheapest in India\nInstant cure\nUnverified clinical claims"}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-2.5 rounded-lg border border-[#E16F7B]/30 focus:outline-none focus:border-[#E16F7B] transition-all"
                />
              </div>

              <div className="bg-[rgba(69,184,138,0.06)] p-4 rounded-lg border border-[#45B88A]/20">
                <div className="flex items-center gap-1.5 text-[#45B88A] font-semibold text-xs mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approved Taglines & Required Phrases</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mb-2">Mandatory disclaimers or client-approved slogans.</p>
                <textarea
                  rows={3}
                  value={approvedPhrasesText}
                  onChange={(e) => setApprovedPhrasesText(e.target.value)}
                  placeholder={"Brewed with Real Passion\nAvailable exclusively at artisanstores.in\nT&C Apply"}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] placeholder-[#6E6D7A] p-2.5 rounded-lg border border-[#45B88A]/30 focus:outline-none focus:border-[#45B88A] transition-all"
                />
              </div>
            </div>

            {/* Save Action Buttons */}
            <div className="pt-4 border-t border-[#30303D] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confirmCheck"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="rounded border-[#30303D] bg-[#101014] text-[#A78BFA] focus:ring-[#A78BFA]"
                />
                <label htmlFor="confirmCheck" className="text-xs font-medium text-[#F2F0F7] cursor-pointer">
                  Mark as Confirmed by Client
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={savingBrand}
                  onClick={() => handleSaveBrandProfile(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] rounded-lg transition-all"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={savingBrand}
                  onClick={() => handleSaveBrandProfile(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-lg transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingBrand ? "Saving..." : "Lock & Confirm Guidelines"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACTS & SCOPE QUOTAS */}
      {activeTab === "contracts" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#30303D]/60">
            <div>
              <h3 className="text-sm font-semibold text-[#F2F0F7]">Retainer Contracts & Monthly Deliverable Quotas</h3>
              <p className="text-xs text-[#A3A0B0] mt-0.5">
                AgencyOS enforces hard caps on deliverables so your agency never executes out-of-scope work for free.
              </p>
            </div>
            <button
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Retainer Contract</span>
            </button>
          </div>

          {contracts.length === 0 ? (
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-12 text-center">
              <Layers className="w-8 h-8 text-[#6E6D7A] mx-auto mb-3" />
              <h4 className="text-sm font-medium text-[#F2F0F7]">No active contracts</h4>
              <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mt-1 mb-5">
                Create a retainer contract defining the monthly retainer fee and contracted deliverables (e.g. 30 Reels / month).
              </p>
              <button
                onClick={() => setShowContractModal(true)}
                className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Contract</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map((ct) => (
                <div key={ct.id} className="bg-[#17171E] rounded-xl border border-[#30303D] p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#30303D]">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-sm font-semibold text-[#F2F0F7]">{ct.name}</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-[rgba(69,184,138,0.12)] text-[#45B88A] border border-[#45B88A]/20">
                          {ct.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#A3A0B0] mt-1">
                        Effective from {ct.start_date} &bull; {ct.revision_allowance} Revisions Included
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-[#6E6D7A]">Monthly Retainer Fee</div>
                      <div className="text-lg font-bold text-[#F2F0F7] tabular-nums">
                        ₹{(ct.monthly_fee_inr || 0).toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-[#A3A0B0]"> / mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Scope Items Breakdown */}
                  <div className="pt-4">
                    <h5 className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-2.5">
                      Contracted Deliverables & Quota Cap
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {ct.scope_items && ct.scope_items.length > 0 ? (
                        ct.scope_items.map((item, idx) => (
                          <div key={idx} className="bg-[#20202A] rounded-lg p-3 border border-[#30303D] flex items-center justify-between">
                            <div>
                              <div className="text-xs font-medium text-[#F2F0F7] capitalize">
                                {item.deliverable_type}s
                              </div>
                              <div className="text-[10px] text-[#A3A0B0] uppercase">{item.platform}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-bold text-[#A78BFA] tabular-nums">{item.monthly_quantity}</span>
                              <span className="text-[10px] text-[#6E6D7A] block">/ month</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[#A3A0B0]">Standard 30 reels/month active.</div>
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
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#30303D]/60">
            <div>
              <h3 className="text-sm font-semibold text-[#F2F0F7]">Campaign Sprints for {client.business_name}</h3>
              <p className="text-xs text-[#A3A0B0] mt-0.5">
                Every month has an AI-generated plan containing 30 day-by-day deliverables and hooks.
              </p>
            </div>
            <Link
              href={`/campaigns?clientId=${client.id}`}
              className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Generate Sprint</span>
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-12 text-center">
              <Calendar className="w-8 h-8 text-[#6E6D7A] mx-auto mb-3" />
              <h4 className="text-sm font-medium text-[#F2F0F7]">No campaigns created yet</h4>
              <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mt-1 mb-5">
                Generate your first 30-day content calendar using Groq AI. All reels will be mapped to the brand tone.
              </p>
              <Link
                href={`/campaigns?clientId=${client.id}`}
                className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Plan with AI</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <div key={camp.id} className="bg-[#17171E] rounded-xl border border-[#30303D] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-[#A78BFA] uppercase tracking-wider">
                        {camp.period_month && camp.period_year ? `${camp.period_month}/${camp.period_year}` : "Sprint"}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium uppercase bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
                        {camp.status}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#F2F0F7] mb-1">{camp.name}</h4>
                    <p className="text-xs text-[#A3A0B0] line-clamp-2">{camp.objective || "Standard monthly content sprint."}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#30303D] flex items-center justify-between">
                    <span className="text-[10px] text-[#6E6D7A]">Created {new Date(camp.created_at).toLocaleDateString()}</span>
                    <Link
                      href={`/campaigns?campaignId=${camp.id}`}
                      className="text-xs font-medium text-[#A78BFA] hover:text-[#B69BFF] flex items-center gap-1"
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
          <div className="flex items-center justify-between pb-2 border-b border-[#30303D]/60">
            <div>
              <h3 className="text-sm font-semibold text-[#F2F0F7]">Client Reviewers</h3>
              <p className="text-xs text-[#A3A0B0] mt-0.5">
                Reviewers log into <span className="text-[#A78BFA] font-medium">/portal</span> to preview deliverables, comment, and sign off.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invite Reviewer</span>
            </button>
          </div>

          {reviewers.length === 0 ? (
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-12 text-center">
              <UserCheck className="w-8 h-8 text-[#6E6D7A] mx-auto mb-3" />
              <h4 className="text-sm font-medium text-[#F2F0F7]">No reviewers yet</h4>
              <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mt-1 mb-5">
                Invite your client point-of-contact to review and approve content in a clean, distraction-free portal.
              </p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite First Reviewer</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] overflow-hidden">
              <div className="divide-y divide-[#30303D]/60">
                {reviewers.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 hover:bg-[#20202A]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-[#20202A] text-[#F2F0F7] border border-[#30303D] font-semibold text-xs flex items-center justify-center shrink-0">
                        {(r.full_name || r.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#F2F0F7]">{r.full_name || "—"}</p>
                        <p className="text-[11px] text-[#A3A0B0] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#6E6D7A]" />
                          {r.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[rgba(167,139,250,0.12)] text-[#A78BFA] border border-[#A78BFA]/20">
                        <UserCheck className="w-3 h-3" />
                        Client Reviewer
                      </span>
                      <a
                        href="/portal"
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#A3A0B0] hover:text-[#F2F0F7] bg-[#20202A] hover:bg-[#262630] border border-[#30303D] rounded-lg transition-colors"
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
        <div className="space-y-5">
          <div className="bg-[rgba(167,139,250,0.08)] border border-[#A78BFA]/20 rounded-xl p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Share2 className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-[#F2F0F7]">Multi-Client Social Publishing Integration</h4>
                <p className="text-[11px] text-[#A3A0B0] mt-0.5 leading-relaxed">
                  Connect Instagram Business and Facebook accounts strictly for <strong>{client?.business_name}</strong>.
                  All credentials and access tokens are isolated per client.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSocialAccountName(client?.business_name || "");
                setVerifyResult(null);
                setShowConnectModal(true);
              }}
              className="inline-flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Account</span>
            </button>
          </div>

          {socialAccounts.length === 0 ? (
            <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-12 text-center">
              <InstagramIcon className="w-8 h-8 text-[#6E6D7A] mx-auto mb-3" />
              <h4 className="text-sm font-medium text-[#F2F0F7]">No Social Accounts Connected</h4>
              <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto mt-1 mb-5">
                Connect {client?.business_name}&apos;s Instagram Business Account or Facebook Page to enable automated 1-click publishing.
              </p>
              <button
                onClick={() => {
                  setSocialAccountName(client?.business_name || "");
                  setVerifyResult(null);
                  setShowConnectModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.12)] hover:bg-[rgba(167,139,250,0.2)] text-[#A78BFA] border border-[#A78BFA]/30 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect Social Account</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {socialAccounts.map((account) => {
                const isIg = account.platform === "instagram";
                return (
                  <div key={account.id} className="bg-[#17171E] rounded-xl border border-[#30303D] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white border border-[#30303D] ${
                            isIg ? "bg-gradient-to-tr from-purple-600 to-pink-500" : "bg-blue-600"
                          }`}>
                            {isIg ? <InstagramIcon className="w-4 h-4" /> : <FacebookIcon className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-[#F2F0F7] flex items-center gap-1.5">
                              {account.account_handle || account.account_name || "Connected Profile"}
                              <CheckCircle2 className="w-3 h-3 text-[#45B88A]" />
                            </h4>
                            <p className="text-[10px] text-[#A3A0B0] capitalize">
                              {account.platform} Business Account
                            </p>
                          </div>
                        </div>

                        <span className="text-[9px] font-medium text-[#45B88A] bg-[rgba(69,184,138,0.12)] border border-[#45B88A]/20 px-2 py-0.5 rounded uppercase">
                          Active
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-[#A3A0B0] pt-2 border-t border-[#30303D]">
                        {account.instagram_business_id && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#6E6D7A]">Instagram Business ID:</span>
                            <span className="font-mono text-[#F2F0F7]">{account.instagram_business_id}</span>
                          </div>
                        )}
                        {account.facebook_page_id && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#6E6D7A]">Facebook Page ID:</span>
                            <span className="font-mono text-[#F2F0F7]">{account.facebook_page_id}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#6E6D7A]">Tenant Client:</span>
                          <span className="text-[#A78BFA]">{client?.business_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#30303D] flex items-center justify-between">
                      <span className="text-[10px] text-[#6E6D7A]">
                        Token securely stored
                      </span>
                      <button
                        onClick={() => handleDeleteSocial(account.id)}
                        className="text-xs font-medium text-[#E16F7B] hover:underline cursor-pointer"
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
        <div className="space-y-5">
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F2F0F7] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
                Monthly Campaign Delivery Report
              </h3>
              <p className="text-xs text-[#A3A0B0] mt-0.5">
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
                className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none"
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
                className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>

              <button
                onClick={() => fetchMonthlyReport()}
                className="p-1.5 text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg border border-[#30303D] transition-colors"
                title="Refresh Report"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-[#A78BFA]" : ""}`} />
              </button>
            </div>
          </div>

          {loadingReport ? (
            <div className="py-12 text-center text-[#A3A0B0] text-xs flex flex-col items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-[#A78BFA] mb-2" />
              <span>Generating monthly performance audit...</span>
            </div>
          ) : monthlyReport ? (
            <div className="space-y-4">
              {/* 4 Metric Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#17171E] p-4 rounded-xl border border-[#30303D]">
                  <span className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider">Contract Quota</span>
                  <div className="text-xl font-bold text-[#F2F0F7] mt-1 tabular-nums">
                    {monthlyReport.deliverables_delivered} / {monthlyReport.total_scope_quota}
                  </div>
                  <span className="text-[10px] text-[#45B88A] font-medium mt-0.5 inline-block">
                    {monthlyReport.quota_fulfillment_rate}% fulfilled
                  </span>
                </div>

                <div className="bg-[#17171E] p-4 rounded-xl border border-[#30303D]">
                  <span className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider">Published Live</span>
                  <div className="text-xl font-bold text-[#A78BFA] mt-1 tabular-nums">
                    {monthlyReport.deliverables_published}
                  </div>
                  <span className="text-[10px] text-[#A3A0B0] mt-0.5 inline-block">
                    With public links
                  </span>
                </div>

                <div className="bg-[#17171E] p-4 rounded-xl border border-[#30303D]">
                  <span className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider">Total Impressions</span>
                  <div className="text-xl font-bold text-[#F2F0F7] mt-1 tabular-nums">
                    {monthlyReport.total_views > 0 ? monthlyReport.total_views.toLocaleString("en-IN") : "—"}
                  </div>
                  <span className="text-[10px] text-[#A3A0B0] mt-0.5 inline-block">
                    {monthlyReport.total_likes.toLocaleString("en-IN")} total likes
                  </span>
                </div>

                <div className="bg-[#17171E] p-4 rounded-xl border border-[#30303D]">
                  <span className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider">Engagement Rate</span>
                  <div className="text-xl font-bold text-[#45B88A] mt-1 tabular-nums">
                    {monthlyReport.avg_engagement_rate}%
                  </div>
                  <span className="text-[10px] text-[#A3A0B0] mt-0.5 inline-block">
                    Likes & comments ratio
                  </span>
                </div>
              </div>

              {/* Executive Summary Card */}
              <div className="bg-[#17171E] border border-[#30303D] p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <h4 className="text-[10px] font-semibold text-[#A78BFA] uppercase tracking-wider">
                    Executive Delivery Wrap-Up
                  </h4>
                </div>
                <p className="text-xs text-[#F2F0F7] leading-relaxed">
                  {monthlyReport.executive_summary}
                </p>
              </div>

              {/* Top Deliverables Table */}
              <div className="bg-[#17171E] rounded-xl border border-[#30303D] p-5">
                <h4 className="text-xs font-semibold text-[#F2F0F7] mb-3">Top Performing Content Assets</h4>
                {monthlyReport.top_deliverables.length === 0 ? (
                  <p className="text-xs text-[#A3A0B0] py-4 text-center">No deliverables published yet for this period.</p>
                ) : (
                  <div className="divide-y divide-[#30303D]/60">
                    {monthlyReport.top_deliverables.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#F2F0F7] truncate">{item.title}</p>
                          <p className="text-[10px] text-[#A3A0B0] capitalize">
                            {item.deliverable_type} &bull; {item.platform}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          {item.views_count > 0 && (
                            <span className="text-[#A3A0B0] font-medium">{item.views_count.toLocaleString("en-IN")} views</span>
                          )}
                          {item.live_post_url ? (
                            <a
                              href={item.live_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#A78BFA] hover:text-[#B69BFF] font-medium inline-flex items-center gap-1 bg-[#20202A] px-2 py-1 rounded border border-[#30303D]"
                            >
                              View Live <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[#6E6D7A] text-[10px]">Approved</span>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D] mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[#F2F0F7]">Connect Social Account</h3>
                <p className="text-xs text-[#A3A0B0]">Configure Meta Graph API credentials for {client?.business_name}.</p>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-[#6E6D7A] hover:text-[#F2F0F7] p-1 rounded hover:bg-[#20202A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSocial} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Platform</label>
                <select
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value as "instagram" | "facebook")}
                  className="w-full text-xs text-[#F2F0F7] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 cursor-pointer focus:outline-none focus:border-[#A78BFA]"
                >
                  <option value="instagram">Instagram Professional / Business</option>
                  <option value="facebook">Facebook Page</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Account Handle / Name</label>
                <input
                  type="text"
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="@hotelshauryawada"
                  className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              {socialPlatform === "instagram" ? (
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                    Instagram Business Account ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={igBusinessId}
                    onChange={(e) => setIgBusinessId(e.target.value)}
                    placeholder="e.g. 17841400012345"
                    className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA] font-mono"
                  />
                  <p className="text-[10px] text-[#A3A0B0] mt-1">Found in your Meta App Dashboard or Graph API Explorer.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">
                    Facebook Page ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    placeholder="e.g. 1052300012345"
                    className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA] font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider">Access Token (User or Page) *</label>
                  <button
                    type="button"
                    onClick={() => setShowTokenHelper(!showTokenHelper)}
                    className="text-[11px] text-[#A78BFA] hover:text-[#B69BFF] font-medium"
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
                  className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA] font-mono resize-none"
                />
              </div>

              {/* 60-Day Token Exchange Accordion */}
              {showTokenHelper && (
                <div className="p-3.5 rounded-lg bg-[#20202A] border border-[#30303D] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F2F0F7]">
                    <Key className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>60-Day Long-Lived Token Exchange</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Meta App ID"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="text-xs p-2 rounded-lg bg-[#101014] text-[#F2F0F7] border border-[#30303D]"
                    />
                    <input
                      type="password"
                      placeholder="Meta App Secret"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      className="text-xs p-2 rounded-lg bg-[#101014] text-[#F2F0F7] border border-[#30303D]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short-Lived User Token (from Graph API Explorer)"
                    value={shortToken}
                    onChange={(e) => setShortToken(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[#101014] text-[#F2F0F7] border border-[#30303D] font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleExchangeToken}
                    disabled={exchangingToken}
                    className="w-full py-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-semibold rounded-lg transition-colors"
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
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A78BFA] bg-[#20202A] hover:bg-[#262630] px-3 py-1.5 rounded-lg border border-[#30303D] transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${verifyingToken ? "animate-spin" : ""}`} />
                    <span>Test & Verify with Meta</span>
                  </button>
                  {verifyResult && (
                    <span className="text-[11px] font-medium text-[#45B88A] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified @{verifyResult.username}
                    </span>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-[#30303D] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingSocial}
                  className="px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-lg shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D] mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[#F2F0F7]">Invite Client Reviewer</h3>
                <p className="text-xs text-[#A3A0B0]">Create a secure login for your client to review and approve content.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-[#6E6D7A] hover:text-[#F2F0F7] p-1 rounded hover:bg-[#20202A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteReviewer} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Reviewer Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="raj@clientbrand.com"
                  className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Full Name (optional)</label>
                <input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Raj Mehta"
                  className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Temporary password"
                  className="w-full text-xs text-[#F2F0F7] placeholder-[#6E6D7A] bg-[#101014] border border-[#30303D] rounded-lg p-2.5 focus:outline-none focus:border-[#A78BFA]"
                />
                <p className="text-[11px] text-[#A3A0B0] mt-1">Share this with your client. They'll use it to log into the review portal.</p>
              </div>

              <div className="pt-3 border-t border-[#30303D] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-lg shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17171E] rounded-xl border border-[#30303D] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#30303D] mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[#F2F0F7]">New Retainer Contract</h3>
                <p className="text-xs text-[#A3A0B0]">Define the monthly retainer fee and deliverable quota cap.</p>
              </div>
              <button onClick={() => setShowContractModal(false)} className="text-[#6E6D7A] hover:text-[#F2F0F7] p-1 rounded hover:bg-[#20202A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Contract Name</label>
                <input
                  type="text"
                  required
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2.5 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Monthly Fee (₹ INR)</label>
                  <input
                    type="number"
                    required
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2.5 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2.5 rounded-lg border border-[#30303D] focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>
              </div>

              {/* Scope Quota Inputs */}
              <div className="bg-[#20202A] p-3.5 rounded-lg border border-[#30303D] space-y-2.5">
                <span className="text-[10px] font-semibold text-[#6E6D7A] uppercase tracking-wider block">Deliverable Scope Quota</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-[#A3A0B0] mb-1">Type</label>
                    <select
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value)}
                      className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2 rounded-lg border border-[#30303D]"
                    >
                      <option value="reel">Reel / Video</option>
                      <option value="carousel">Carousel</option>
                      <option value="static_post">Static Post</option>
                      <option value="story">Story</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-[#A3A0B0] mb-1">Platform</label>
                    <select
                      value={scopePlatform}
                      onChange={(e) => setScopePlatform(e.target.value)}
                      className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2 rounded-lg border border-[#30303D]"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-[#A3A0B0] mb-1">Qty / Month</label>
                    <input
                      type="number"
                      min="1"
                      value={scopeQuantity}
                      onChange={(e) => setScopeQuantity(e.target.value)}
                      className="w-full bg-[#101014] text-xs text-[#F2F0F7] p-2 rounded-lg border border-[#30303D]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#30303D] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingContract}
                  className="px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-lg shadow-xs"
                >
                  {creatingContract ? "Activating..." : "Activate Retainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171E] rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#30303D] scale-in-95 duration-150">
            <div className="w-9 h-9 rounded-md bg-[rgba(225,111,123,0.12)] text-[#E16F7B] flex items-center justify-center mb-3 border border-[#E16F7B]/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#F2F0F7] mb-1">
              Delete Client Workspace?
            </h3>
            <p className="text-xs text-[#A3A0B0] mb-4 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-[#F2F0F7]">{client.business_name}</span>?
              This will remove all associated campaigns, deliverables, brand profiles, client reviewers, and contracts from your agency space. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingClient}
                className="px-3.5 py-1.5 text-xs font-medium text-[#A3A0B0] hover:text-[#F2F0F7] hover:bg-[#20202A] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deletingClient}
                className="px-4 py-1.5 text-xs font-semibold bg-[#E16F7B] hover:bg-[#E16F7B]/90 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deletingClient ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
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
