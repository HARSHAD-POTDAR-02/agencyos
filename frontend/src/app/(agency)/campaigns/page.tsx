"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { clientApi, campaignApi } from "@/lib/api";
import {
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  List,
  Grid,
  ChevronDown,
  ChevronUp,
  Volume2,
  Eye,
  Hash,
  Send,
  Kanban,
  FileText,
  Building2,
  RefreshCw,
} from "lucide-react";

interface Client {
  id: string;
  business_name: string;
  industry: string | null;
}

interface DeliverableItem {
  day_number: number;
  title?: string;
  deliverable_type: string;
  platform: string;
  pillar: string;
  hook: string;
  visual_concept: string;
  caption: string;
  cta: string;
  audio_vibe: string;
  hashtags: string[];
}

interface AiPlanDraft {
  campaign_name: string;
  objective?: string;
  brand_voice?: string;
  content_pillars?: string[];
  total_deliverables_planned: number;
  generator?: string;
  deliverables: DeliverableItem[];
}

interface Campaign {
  id: string;
  client_id: string;
  name: string;
  period_month: number | null;
  period_year: number | null;
  objective: string | null;
  status: string;
  ai_plan_draft: AiPlanDraft | null;
  created_at: string;
}

function CampaignsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialClientId = searchParams.get("clientId") || "";
  const initialCampaignId = searchParams.get("campaignId") || "";

  const { token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Generator form inputs
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [objective, setObjective] = useState("");
  const [customBrief, setCustomBrief] = useState("");

  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [selectedPillarFilter, setSelectedPillarFilter] = useState<string>("all");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load clients
  useEffect(() => {
    if (!token || !effectiveAgencyId) return;
    clientApi
      .list(effectiveAgencyId, token)
      .then((data: any) => {
        const list = data as Client[];
        setClients(list);
        if (!selectedClientId && list.length > 0) {
          setSelectedClientId(list[0].id);
        }
      })
      .catch((err) => console.error("Failed to load clients", err));
  }, [token, effectiveAgencyId, selectedClientId]);

  // Load campaigns when client changes
  const loadCampaigns = useCallback(
    async (clientId: string) => {
      if (!token || !effectiveAgencyId || !clientId) return;
      try {
        const data = (await campaignApi.list(effectiveAgencyId, clientId, token)) as Campaign[];
        setCampaigns(data);

        if (initialCampaignId) {
          const match = data.find((c) => c.id === initialCampaignId);
          if (match) {
            setSelectedCampaign(match);
            return;
          }
        }
        if (data.length > 0) {
          setSelectedCampaign(data[0]);
        } else {
          setSelectedCampaign(null);
        }
      } catch (err) {
        console.error("Failed to load campaigns", err);
      }
    },
    [token, effectiveAgencyId, initialCampaignId]
  );

  useEffect(() => {
    if (selectedClientId) {
      loadCampaigns(selectedClientId);
    }
  }, [selectedClientId, loadCampaigns]);

  // Trigger AI plan generation
  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveAgencyId || !selectedClientId) {
      setNotification({ type: "error", text: "Please select a client to generate a plan." });
      return;
    }

    setGenerating(true);
    setNotification(null);

    try {
      const newCampaign = (await campaignApi.generatePlan(
        effectiveAgencyId,
        selectedClientId,
        {
          period_month: periodMonth,
          period_year: periodYear,
          objective: objective || undefined,
          custom_brief: customBrief || undefined,
        },
        token
      )) as Campaign;

      setCampaigns((prev) => [newCampaign, ...prev]);
      setSelectedCampaign(newCampaign);
      setNotification({
        type: "success",
        text: `Successfully generated 30-day content plan for ${newCampaign.name}!`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to generate campaign plan." });
    } finally {
      setGenerating(false);
    }
  };

  // Convert AI plan to tasks
  const handleConvertToTasks = async () => {
    if (!token || !effectiveAgencyId || !selectedCampaign) return;
    setConverting(true);
    setNotification(null);

    try {
      const res = (await campaignApi.convertToTasks(
        effectiveAgencyId,
        selectedCampaign.id,
        token
      )) as { deliverables_created: number; tasks_created: number; status: string };

      setSelectedCampaign({
        ...selectedCampaign,
        status: "in_production",
      });

      setNotification({
        type: "success",
        text: `Plan converted! Created ${res.deliverables_created} deliverables and ${res.tasks_created} team tasks across Scripting, Filming, Editing, and Approval.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to convert plan to tasks." });
    } finally {
      setConverting(false);
    }
  };

  const plan = selectedCampaign?.ai_plan_draft;
  const deliverables = plan?.deliverables || [];
  const pillars = Array.from(new Set(deliverables.map((d) => d.pillar).filter(Boolean)));
  const filteredDeliverables =
    selectedPillarFilter === "all"
      ? deliverables
      : deliverables.filter((d) => d.pillar === selectedPillarFilter);

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">AI Campaign Planner</h1>
          </div>
          <p className="text-xs text-slate-500">
            Generate 30-day content calendar sprints with hooks, visual concepts, captions, and audio vibes respecting confirmed brand voice.
          </p>
        </div>

        {/* Client Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 shrink-0">Client Workspace:</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-white text-xs font-bold text-slate-900 px-3 py-2 rounded-xl border border-slate-200/90 shadow-2xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 focus:outline-none"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name} ({c.industry || "General"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
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

      {/* Sprint Generator Configuration Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Configure New 30-Day Sprint</h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Powered by Groq LLM & AgencyOS Core</span>
        </div>

        <form onSubmit={handleGeneratePlan} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Sprint Month</label>
            <select
              value={periodMonth}
              onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Sprint Year</label>
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Sprint Campaign Objective</label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Double organic reel views and drive 200 high-intent leads"
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Specific Creative Brief / Focus (Optional)</label>
            <input
              type="text"
              value={customBrief}
              onChange={(e) => setCustomBrief(e.target.value)}
              placeholder="e.g. Focus on 3-second scroll-stopping hooks, relatable team humor, and Diwali gifting themes"
              className="w-full bg-slate-50 text-xs font-medium text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs shadow-purple-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{generating ? "Strategizing..." : "Generate Sprint ✨"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sprints Switcher Bar */}
      {campaigns.length > 0 && (
        <div className="flex items-center justify-between overflow-x-auto pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Generated Plans:</span>
            {campaigns.map((camp) => (
              <button
                key={camp.id}
                onClick={() => setSelectedCampaign(camp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCampaign?.id === camp.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                <span>{camp.name}</span>
                <span className={`ml-2 text-[10px] px-1.5 py-0.2 rounded-full uppercase ${
                  camp.status === "in_production" ? "bg-emerald-500/20 text-emerald-300" : "bg-purple-500/20 text-purple-300"
                }`}>
                  {camp.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Campaign Detail & Calendar Content */}
      {selectedCampaign && plan ? (
        <div className="space-y-6">
          {/* Plan Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-slate-900">{plan.campaign_name}</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                    {selectedCampaign.status}
                  </span>
                  {plan.generator && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      {plan.generator}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">{plan.objective}</p>
              </div>

              {/* Convert to Kanban Tasks CTA */}
              <div className="flex items-center gap-3">
                {selectedCampaign.status === "in_production" ? (
                  <Link
                    href="/tasks"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all"
                  >
                    <Kanban className="w-4 h-4" />
                    <span>View in Kanban Tasks &rarr;</span>
                  </Link>
                ) : (
                  <button
                    onClick={handleConvertToTasks}
                    disabled={converting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>{converting ? "Creating Tasks..." : "Approve & Convert to Tasks 🚀"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter and View Toggles */}
            <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Content Pillars Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
                <span className="text-slate-400 text-[11px] font-medium mr-1">Pillars:</span>
                <button
                  onClick={() => setSelectedPillarFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    selectedPillarFilter === "all"
                      ? "bg-purple-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All ({deliverables.length})
                </button>
                {pillars.map((pil) => (
                  <button
                    key={pil}
                    onClick={() => setSelectedPillarFilter(pil)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all whitespace-nowrap ${
                      selectedPillarFilter === pil
                        ? "bg-purple-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {pil} ({deliverables.filter((d) => d.pillar === pil).length})
                  </button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "calendar" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>30-Day Grid</span>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "list" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Detailed List</span>
                </button>
              </div>
            </div>
          </div>

          {/* CALENDAR GRID VIEW */}
          {viewMode === "calendar" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredDeliverables.map((item) => (
                <div
                  key={item.day_number}
                  onClick={() => setExpandedDay(expandedDay === item.day_number ? null : item.day_number)}
                  className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer flex flex-col justify-between hover:border-purple-400 hover:shadow-md ${
                    expandedDay === item.day_number
                      ? "ring-2 ring-purple-500/20 border-purple-500"
                      : "border-slate-200/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[11px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                        Day {item.day_number < 10 ? `0${item.day_number}` : item.day_number}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {item.deliverable_type}
                      </span>
                    </div>

                    <div className="text-[10px] font-bold text-slate-500 line-clamp-1 mb-1.5">
                      {item.pillar}
                    </div>

                    <p className="text-xs font-extrabold text-slate-900 leading-snug line-clamp-3 mb-3">
                      &quot;{item.hook}&quot;
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 truncate max-w-[120px]">
                      <Volume2 className="w-3 h-3 text-purple-500 shrink-0" />
                      <span className="truncate">{item.audio_vibe}</span>
                    </span>
                    <span className="text-purple-600 font-bold hover:underline">
                      {expandedDay === item.day_number ? "Close" : "Brief"}
                    </span>
                  </div>

                  {/* Expanded Detail inside card if selected */}
                  {expandedDay === item.day_number && (
                    <div className="mt-3 pt-3 border-t border-purple-100 text-xs space-y-2 animate-in fade-in duration-150">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Visual Shot List:</span>
                        <p className="text-[11px] text-slate-700 mt-0.5">{item.visual_concept}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Caption:</span>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-3 whitespace-pre-line">{item.caption}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-purple-600 block uppercase">CTA:</span>
                        <p className="text-[11px] font-bold text-slate-800">{item.cta}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* DETAILED LIST VIEW */
            <div className="space-y-4">
              {filteredDeliverables.map((item) => (
                <div
                  key={item.day_number}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:border-purple-300 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 font-black text-sm flex items-center justify-center shrink-0 border border-purple-100">
                        D{item.day_number < 10 ? `0${item.day_number}` : item.day_number}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                            {item.pillar}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 uppercase">
                            {item.deliverable_type} &bull; {item.platform}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          Hook: &quot;{item.hook}&quot;
                        </h4>
                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-800">Visual Concept:</strong> {item.visual_concept}
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line">
                          {item.caption}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 pt-1">
                          <span className="text-purple-700 font-bold">CTA: {item.cta}</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <Volume2 className="w-3.5 h-3.5 text-purple-500" />
                            {item.audio_vibe}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-2xs">
          <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Content Plan Selected</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Click &quot;Generate Sprint ✨&quot; above to create a full 30-day reel calendar with hooks, visual shot lists, and captions tailored to this client&apos;s brand guidelines.
          </p>
        </div>
      )}
    </main>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading campaign planner...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
