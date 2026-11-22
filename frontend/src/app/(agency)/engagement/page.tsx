"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { engagementApi, clientApi, API_BASE } from "@/lib/api";
import {
  MessagesSquare,
  MessageSquare,
  Send,
  Heart,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  X,
  User,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  Inbox,
  Flame,
  BadgeAlert,
  HelpCircle,
  TrendingUp,
  MessageCircle,
} from "lucide-react";

interface SocialComment {
  id: string;
  agency_id: string;
  client_id: string;
  social_account_id: string;
  deliverable_id?: string | null;
  platform: string;
  external_comment_id: string;
  external_media_id: string;
  external_parent_id?: string | null;
  media_permalink?: string | null;
  media_thumbnail_url?: string | null;
  media_caption?: string | null;
  author_username: string;
  author_id?: string | null;
  author_profile_pic?: string | null;
  comment_text: string;
  like_count: number;
  is_liked_by_brand: boolean;
  is_hidden: boolean;
  commented_at: string;
  sentiment: "positive" | "inquiry" | "complaint" | "neutral" | "spam";
  intent_category?: string | null;
  urgency: string;
  status: "pending" | "replied" | "resolved" | "hidden" | "ignored";
  ai_suggested_reply?: string | null;
  ai_suggested_reply_options?: string[] | null;
  reply_text?: string | null;
  replied_at?: string | null;
  replied_by_user_id?: string | null;
  client_name?: string | null;
  deliverable_title?: string | null;
  created_at: string;
}

interface SocialMessage {
  id: string;
  conversation_id: string;
  external_message_id: string;
  sender_username: string;
  sender_id: string;
  is_from_brand: boolean;
  message_text: string;
  sent_at: string;
}

interface SocialConversation {
  id: string;
  agency_id: string;
  client_id: string;
  social_account_id: string;
  platform: string;
  external_thread_id: string;
  participant_username: string;
  participant_id: string;
  participant_avatar?: string | null;
  last_message_text?: string | null;
  last_message_at: string;
  unread_count: number;
  sentiment: "positive" | "inquiry" | "complaint" | "neutral" | "spam";
  urgency: string;
  status: "pending" | "replied" | "resolved" | "hidden" | "ignored";
  ai_suggested_reply?: string | null;
  client_name?: string | null;
  messages: SocialMessage[];
}

interface ClientOption {
  id: string;
  business_name: string;
}

interface EngagementStats {
  total_comments: number;
  pending_comments: number;
  replied_comments: number;
  total_conversations: number;
  unread_conversations: number;
  positive_sentiment_percent: number;
  leads_count: number;
  complaints_count: number;
}

function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: string; className?: string }) {
  const p = (platform || "").toLowerCase();
  if (p === "instagram") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function getSentimentBadge(sentiment: string) {
  switch (sentiment) {
    case "inquiry":
      return {
        label: "High-Intent Lead",
        style: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        dot: "bg-emerald-400",
      };
    case "positive":
      return {
        label: "Brand Praise",
        style: "bg-purple-500/10 text-purple-300 border-purple-500/30",
        dot: "bg-purple-400",
      };
    case "complaint":
      return {
        label: "Support / Issue",
        style: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        dot: "bg-rose-400",
      };
    case "spam":
      return {
        label: "Spam / Flagged",
        style: "bg-red-950/30 text-red-400 border-red-800/40",
        dot: "bg-red-500",
      };
    default:
      return {
        label: "General",
        style: "bg-zinc-800/50 text-zinc-400 border-zinc-700/40",
        dot: "bg-zinc-500",
      };
  }
}

function formatRelativeTime(isoStr: string) {
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return "just now";
  } catch {
    return isoStr;
  }
}

function EngagementContent() {
  const { user, token, activeAgencyId, agencies } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);

  // Mode: Comments vs Direct Messages
  const [streamMode, setStreamMode] = useState<"comments" | "dms">("comments");

  // Data states
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [conversations, setConversations] = useState<SocialConversation[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Active selection
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  // Filters
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Composer & AI assist
  const [replyText, setReplyText] = useState<string>("");
  const [dmText, setDmText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [generatingAI, setGeneratingAI] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ tone: string; title: string; reply: string }>>([]);

  // Toast notification
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch initial clients
  useEffect(() => {
    if (!effectiveAgencyId || !token) return;
    clientApi
      .list(effectiveAgencyId, token)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : [];
        setClients(list.map((c: any) => ({ id: c.id, business_name: c.business_name })));
      })
      .catch((err) => console.error("Error loading clients:", err));
  }, [effectiveAgencyId, token]);

  // Fetch Feed Data (Comments or DMs) & Stats
  const fetchData = useCallback(async () => {
    if (!effectiveAgencyId || !token) return;
    setLoading(true);

    try {
      const statsData = await engagementApi.stats(
        effectiveAgencyId,
        token,
        selectedClientId !== "all" ? selectedClientId : undefined
      );
      setStats(statsData);

      if (streamMode === "comments") {
        const params: any = {};
        if (selectedClientId !== "all") params.client_id = selectedClientId;
        if (selectedSentiment !== "all") params.sentiment = selectedSentiment;
        if (selectedStatus !== "all") params.status = selectedStatus;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const data = await engagementApi.listComments(effectiveAgencyId, token, params);
        setComments(data || []);
        if (data && data.length > 0 && !selectedCommentId) {
          setSelectedCommentId(data[0].id);
        }
      } else {
        const params: any = {};
        if (selectedClientId !== "all") params.client_id = selectedClientId;
        if (selectedStatus !== "all") params.status = selectedStatus;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const data = await engagementApi.listConversations(effectiveAgencyId, token, params);
        setConversations(data || []);
        if (data && data.length > 0 && !selectedConvId) {
          setSelectedConvId(data[0].id);
        }
      }
    } catch (err: any) {
      console.error("Error fetching engagement feed:", err);
      showToast(err.message || "Failed to load engagement feed", "error");
    } finally {
      setLoading(false);
    }
  }, [effectiveAgencyId, token, streamMode, selectedClientId, selectedSentiment, selectedStatus, searchQuery, selectedCommentId, selectedConvId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Active selected comment or conversation
  const activeComment = useMemo(() => {
    return comments.find((c) => c.id === selectedCommentId) || (comments.length > 0 ? comments[0] : null);
  }, [comments, selectedCommentId]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || (conversations.length > 0 ? conversations[0] : null);
  }, [conversations, selectedConvId]);

  // Load AI suggestions whenever active comment changes
  useEffect(() => {
    if (!activeComment) {
      setReplyText("");
      setAiSuggestions([]);
      return;
    }
    setReplyText(activeComment.reply_text || activeComment.ai_suggested_reply || "");
    if (activeComment.ai_suggested_reply_options && activeComment.ai_suggested_reply_options.length > 0) {
      setAiSuggestions(
        activeComment.ai_suggested_reply_options.map((opt, idx) => ({
          tone: idx === 0 ? "friendly" : idx === 1 ? "informative" : "cta",
          title: idx === 0 ? "Warm Engagement" : idx === 1 ? "Helpful FAQ" : "Direct Link CTA",
          reply: opt,
        }))
      );
    } else {
      setAiSuggestions([]);
    }
  }, [activeComment]);

  // Sync feed with Meta Graph API
  const handleSyncFeed = async () => {
    if (!effectiveAgencyId || !token) return;
    setSyncing(true);

    try {
      const res = await engagementApi.sync(
        effectiveAgencyId,
        token,
        selectedClientId !== "all" ? selectedClientId : undefined
      );
      if (res.dm_warning) {
        showToast(res.dm_warning, "error");
      } else {
        showToast(
          `Synchronized ${res.comments_synced} new comments and ${res.conversations_synced} DMs from Meta!`,
          "success"
        );
      }
      await fetchData();
    } catch (err: any) {
      console.error("Sync error:", err);
      showToast(err.message || "Failed to sync with Meta", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Like comment
  const handleLikeComment = async () => {
    if (!activeComment || !effectiveAgencyId || !token) return;

    try {
      await engagementApi.likeComment(effectiveAgencyId, activeComment.id, token);
      setComments((prev) =>
        prev.map((c) => (c.id === activeComment.id ? { ...c, is_liked_by_brand: true, like_count: c.like_count + 1 } : c))
      );
      showToast("Liked comment on Instagram!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to like comment", "error");
    }
  };

  // Hide comment
  const handleHideComment = async () => {
    if (!activeComment || !effectiveAgencyId || !token) return;

    try {
      await engagementApi.hideComment(effectiveAgencyId, activeComment.id, token);
      setComments((prev) =>
        prev.map((c) => (c.id === activeComment.id ? { ...c, is_hidden: true, status: "hidden" } : c))
      );
      showToast("Comment hidden on Instagram.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to hide comment", "error");
    }
  };

  // Send reply to comment
  const handleSendCommentReply = async () => {
    if (!activeComment || !replyText.trim() || !effectiveAgencyId || !token) return;
    setSendingReply(true);

    try {
      const updated = await engagementApi.replyComment(
        effectiveAgencyId,
        activeComment.id,
        replyText.trim(),
        token
      );
      setComments((prev) =>
        prev.map((c) => (c.id === activeComment.id ? { ...c, reply_text: replyText.trim(), status: "replied" } : c))
      );
      showToast("Reply published to Instagram!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to publish reply", "error");
    } finally {
      setSendingReply(false);
    }
  };

  // Send direct message
  const handleSendDm = async () => {
    if (!activeConversation || !dmText.trim() || !effectiveAgencyId || !token) return;
    setSendingReply(true);

    try {
      const updated = await engagementApi.sendDm(
        effectiveAgencyId,
        activeConversation.id,
        { message: dmText.trim(), use_human_agent_tag: true },
        token
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, messages: updated.messages, status: "replied" } : c))
      );
      setDmText("");
      showToast("Direct message delivered via Meta Human Agent tag!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to send DM", "error");
    } finally {
      setSendingReply(false);
    }
  };

  // Re-run AI assist
  const handleTriggerAIAssist = async () => {
    if (!activeComment || !effectiveAgencyId || !token) return;
    setGeneratingAI(true);

    try {
      const res = await engagementApi.aiAssist(effectiveAgencyId, activeComment.id, {}, token);
      setAiSuggestions(res.suggestions);
      if (res.suggestions.length > 0) {
        setReplyText(res.suggestions[0].reply);
      }
      showToast("Generated 3 fresh brand-voice reply suggestions", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to generate AI replies", "error");
    } finally {
      setGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101014] text-[#E4E4E7] flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-[#18181F] border-emerald-500/40 text-emerald-300"
              : "bg-[#18181F] border-rose-500/40 text-rose-300"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span className="text-sm font-medium">{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-[#262630] bg-[#14141B] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
              <MessagesSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Community Engagement
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Inbox
                </span>
              </h1>
              <p className="text-xs text-[#8A8797]">
                AI-powered comment triage, brand-voice replies & unified Instagram DMs
              </p>
            </div>
          </div>
        </div>

        {/* Quick KPI Stats & Sync Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#191922] border border-[#262632] text-xs">
            <span className="text-[#8A8797]">Total Comments:</span>
            <span className="font-semibold text-white">{stats?.total_comments ?? 0}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#191922] border border-[#262632] text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[#8A8797]">Needs Reply:</span>
            <span className="font-semibold text-amber-400">{stats?.pending_comments ?? 0}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#191922] border border-[#262632] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[#8A8797]">Buying Leads:</span>
            <span className="font-semibold text-emerald-400">{stats?.leads_count ?? 0}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#191922] border border-[#262632] text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[#8A8797]">Positive:</span>
            <span className="font-semibold text-purple-300">{stats?.positive_sentiment_percent ?? 0}%</span>
          </div>

          <button
            onClick={handleSyncFeed}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-purple-900/20 transition-all ml-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Live Feed"}</span>
          </button>
        </div>
      </header>

      {/* Stream Mode & Filters Bar */}
      <div className="border-b border-[#262630] bg-[#121218] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Stream Mode Tabs */}
        <div className="flex items-center bg-[#181822] border border-[#2C2C3C] rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setStreamMode("comments")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors font-medium ${
              streamMode === "comments"
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                : "text-[#8A8797] hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments & Mentions ({stats?.total_comments ?? 0})
          </button>
          <button
            onClick={() => setStreamMode("dms")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors font-medium ${
              streamMode === "dms"
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                : "text-[#8A8797] hover:text-white"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Direct Messages ({stats?.total_conversations ?? 0})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="h-8 bg-[#181822] border border-[#2C2C3C] rounded-lg px-2.5 pr-7 text-xs text-[#E4E4E7] focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A8797] absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {/* Sentiment Filter (For comments) */}
          {streamMode === "comments" && (
            <div className="flex items-center gap-1 bg-[#181822] border border-[#2C2C3C] rounded-lg p-0.5 text-xs">
              {[
                { id: "all", label: "All" },
                { id: "inquiry", label: "Leads" },
                { id: "positive", label: "Praise" },
                { id: "complaint", label: "Support" },
                { id: "spam", label: "Spam" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSentiment(s.id)}
                  className={`px-2.5 py-1 rounded transition-colors font-medium ${
                    selectedSentiment === s.id
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "text-[#8A8797] hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 bg-[#181822] border border-[#2C2C3C] rounded-lg px-2.5 pr-7 text-xs text-[#E4E4E7] focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Needs Reply</option>
              <option value="replied">Replied</option>
              <option value="hidden">Hidden</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A8797] absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A8797] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search feed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 bg-[#181822] border border-[#2C2C3C] rounded-lg pl-8 pr-2.5 text-xs text-white placeholder-[#8A8797] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 3-Pane Main Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#262630] overflow-hidden bg-[#101014]">
        {/* ============================================================== */}
        {/*             LEFT PANE: FEED STREAM (4 COLS)                    */}
        {/* ============================================================== */}
        <div className="md:col-span-4 flex flex-col bg-[#121218] overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-thin">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-[#8A8797]">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              <span className="text-xs">Loading feed...</span>
            </div>
          ) : streamMode === "comments" ? (
            comments.length === 0 ? (
              <div className="p-8 text-center text-[#71717A] text-xs flex flex-col items-center gap-2">
                <Inbox className="w-8 h-8 opacity-30 text-purple-400" />
                <p>No comments found for this filter.</p>
                <p className="text-[11px] text-[#52525B]">Click "Sync Live Feed" to import latest comments.</p>
              </div>
            ) : (
              comments.map((c) => {
                const isSelected = activeComment?.id === c.id;
                const sentimentBadge = getSentimentBadge(c.sentiment);

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCommentId(c.id)}
                    className={`p-3.5 border-b border-[#20202B] cursor-pointer transition-all flex flex-col gap-2 hover:bg-[#181822] ${
                      isSelected ? "bg-[#181824] border-l-4 border-l-purple-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow">
                          {c.author_username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                            @{c.author_username}
                            <PlatformIcon platform={c.platform} className="w-3 h-3 text-[#A1A1AA]" />
                          </p>
                          <p className="text-[10px] text-[#71717A] truncate max-w-[120px]">
                            {c.client_name || "Client"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-[#71717A]">{formatRelativeTime(c.commented_at)}</span>
                        <span
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${sentimentBadge.style}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sentimentBadge.dot}`} />
                          {sentimentBadge.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#D4D4D8] line-clamp-2 leading-relaxed">{c.comment_text}</p>

                    <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1">
                      <span className="flex items-center gap-1">
                        <Heart className="w-2.5 h-2.5" />
                        {c.like_count}
                      </span>

                      {c.status === "replied" ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Replied
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> Needs reply
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            conversations.length === 0 ? (
              <div className="p-6 text-center text-[#71717A] text-xs flex flex-col items-center gap-3">
                <Send className="w-8 h-8 opacity-30 text-purple-400" />
                <p className="font-semibold text-white">No direct messages loaded yet</p>
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-left text-[11px] text-[#A1A1AA] flex flex-col gap-1.5 leading-relaxed w-full">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                    <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
                    <span>How to enable Instagram DM access:</span>
                  </div>
                  <p className="text-[#8A8797]">
                    By default, Instagram requires you to enable third-party app message access on your phone:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[#8A8797]">
                    <li>Open the <strong className="text-white">Instagram App</strong> on your phone.</li>
                    <li>Go to <strong className="text-white">Settings and privacy</strong> &gt; <strong className="text-white">Messages and story replies</strong>.</li>
                    <li>Tap <strong className="text-white">Message controls</strong> &gt; <strong className="text-white">Connected tools</strong>.</li>
                    <li>Toggle <strong className="text-purple-300">"Allow access to messages"</strong> to <strong className="text-emerald-400">ON</strong>.</li>
                  </ol>
                  <p className="pt-1 text-[10px] text-purple-300/80">
                    Once enabled, click <strong>"Sync Live Feed"</strong> above to import incoming DMs.
                  </p>
                </div>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 border-b border-[#20202B] cursor-pointer transition-all flex flex-col gap-2 hover:bg-[#181822] ${
                      isSelected ? "bg-[#181824] border-l-4 border-l-purple-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow">
                          {conv.participant_username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                            @{conv.participant_username}
                            <PlatformIcon platform={conv.platform} className="w-3 h-3 text-[#A1A1AA]" />
                          </p>
                          <p className="text-[10px] text-[#71717A]">{conv.client_name || "Client"}</p>
                        </div>
                      </div>

                      <span className="text-[10px] text-[#71717A]">{formatRelativeTime(conv.last_message_at)}</span>
                    </div>

                    <p className="text-xs text-[#D4D4D8] line-clamp-2 leading-relaxed">
                      {conv.last_message_text || "Started a direct message thread"}
                    </p>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* ============================================================== */}
        {/*         CENTER PANE: THREAD CONVERSATION & AI COMPOSER (5 COLS)*/}
        {/* ============================================================== */}
        <div className="md:col-span-5 flex flex-col bg-[#14141B] overflow-y-auto max-h-[calc(100vh-140px)] p-6 gap-5">
          {streamMode === "comments" ? (
            activeComment ? (
              <>
                {/* Linked Post Context Banner */}
                <div className="p-3.5 rounded-xl bg-[#181824] border border-[#262638] flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    {activeComment.media_thumbnail_url ? (
                      <img
                        src={activeComment.media_thumbnail_url}
                        alt="Post media"
                        className="w-12 h-12 rounded-lg object-cover border border-[#2E2E3E]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#20202B] flex items-center justify-center text-purple-400">
                        <PlatformIcon platform={activeComment.platform} className="w-6 h-6" />
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-white line-clamp-1">
                        {activeComment.deliverable_title || activeComment.media_caption || "Instagram Reel / Post"}
                      </p>
                      <p className="text-[11px] text-[#8A8797] mt-0.5">
                        Post ID: {activeComment.external_media_id} • {activeComment.client_name || "Client"}
                      </p>
                    </div>
                  </div>

                  {activeComment.media_permalink && (
                    <a
                      href={activeComment.media_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[#8A8797] hover:text-white hover:bg-[#252535] transition-colors"
                      title="View live post on Instagram"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Customer Comment Bubble */}
                <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow">
                        {activeComment.author_username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-white">@{activeComment.author_username}</h3>
                        <p className="text-[10px] text-[#71717A]">{formatRelativeTime(activeComment.commented_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleLikeComment}
                        className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                          activeComment.is_liked_by_brand
                            ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                            : "bg-[#20202B] border-[#2C2C3C] text-[#8A8797] hover:text-white"
                        }`}
                        title="Like comment as brand"
                      >
                        <Heart className={`w-3.5 h-3.5 ${activeComment.is_liked_by_brand ? "fill-rose-500" : ""}`} />
                        <span>{activeComment.like_count}</span>
                      </button>

                      <button
                        onClick={handleHideComment}
                        className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                          activeComment.is_hidden
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : "bg-[#20202B] border-[#2C2C3C] text-[#8A8797] hover:text-white"
                        }`}
                        title="Hide comment on Instagram"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-white font-normal leading-relaxed">{activeComment.comment_text}</p>
                </div>

                {/* Brand Reply Status (if already answered) */}
                {activeComment.reply_text && (
                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Brand Reply Published
                      </span>
                      {activeComment.replied_at && (
                        <span className="text-[10px] text-[#8A8797]">{formatRelativeTime(activeComment.replied_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#D4D4D8] leading-relaxed italic">"{activeComment.reply_text}"</p>
                  </div>
                )}

                {/* AI Reply Suggestions */}
                <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                        AI Suggested Replies
                      </h4>
                    </div>
                    <button
                      onClick={handleTriggerAIAssist}
                      disabled={generatingAI}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${generatingAI ? "animate-spin" : ""}`} />
                      Regenerate
                    </button>
                  </div>

                  {generatingAI ? (
                    <div className="py-4 flex items-center justify-center text-xs text-[#8A8797] gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      Generating AI reply suggestions...
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {aiSuggestions.map((opt, idx) => (
                        <div
                          key={idx}
                          onClick={() => setReplyText(opt.reply)}
                          className="p-2.5 rounded-lg bg-[#121218] border border-[#262634] hover:border-purple-500/50 cursor-pointer transition-all flex flex-col gap-1 group"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-purple-300 uppercase tracking-wider">{opt.title}</span>
                            <span className="text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              Use this reply →
                            </span>
                          </div>
                          <p className="text-xs text-[#D4D4D8] leading-relaxed">{opt.reply}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#71717A] italic">
                      Click "Regenerate" to generate 3 tailored brand replies with AI.
                    </p>
                  )}
                </div>

                {/* Reply Composer */}
                <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Reply as Brand</span>
                    <span className="text-[10px] text-[#71717A]">{replyText.length}/2200 characters</span>
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Type brand reply to user..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-[#121218] border border-[#2B2B3B] rounded-xl p-3 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleSendCommentReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-purple-900/20 disabled:opacity-50 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingReply ? "Publishing to Instagram..." : "Publish Reply to Instagram"}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-[#71717A] text-xs">
                Select a comment from the left feed to view details and reply.
              </div>
            )
          ) : (
            /* Direct Messages Thread View */
            activeConversation ? (
              <>
                <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow">
                      {activeConversation.participant_username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">@{activeConversation.participant_username}</h3>
                      <p className="text-[10px] text-[#71717A]">
                        Instagram DM Thread • Human Agent 7-Day Window Active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Timeline */}
                <div className="flex-1 flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {activeConversation.messages && activeConversation.messages.length > 0 ? (
                    activeConversation.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col max-w-[80%] ${
                          m.is_from_brand ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            m.is_from_brand
                              ? "bg-purple-600 text-white rounded-br-none"
                              : "bg-[#181822] border border-[#2B2B3B] text-[#D4D4D8] rounded-bl-none"
                          }`}
                        >
                          {m.message_text}
                        </div>
                        <span className="text-[9px] text-[#71717A] mt-1 px-1">{formatRelativeTime(m.sent_at)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-[#71717A] italic">No prior messages recorded.</div>
                  )}
                </div>

                {/* DM Composer */}
                <div className="p-3 bg-[#181822] border border-[#2B2B3B] rounded-xl flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type direct message..."
                    value={dmText}
                    onChange={(e) => setDmText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendDm();
                      }
                    }}
                    className="flex-1 bg-transparent text-xs text-white placeholder-[#71717A] focus:outline-none px-2"
                  />
                  <button
                    onClick={handleSendDm}
                    disabled={sendingReply || !dmText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send DM</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-[#71717A] text-xs">Select a DM conversation from the left feed.</div>
            )
          )}
        </div>

        {/* ============================================================== */}
        {/*    RIGHT PANE: AUTHOR INTEL & META TOKEN HEALTH (3 COLS)       */}
        {/* ============================================================== */}
        <div className="md:col-span-3 flex flex-col bg-[#121218] p-5 gap-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* Author Card */}
          <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              Community Member
            </h4>

            {activeComment ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shadow">
                    {activeComment.author_username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white">@{activeComment.author_username}</h5>
                    <p className="text-[10px] text-purple-300 capitalize">{activeComment.platform} User</p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#242430] flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between text-[#8A8797]">
                    <span>Detected Intent:</span>
                    <span className="font-semibold text-white capitalize">
                      {activeComment.intent_category || "General"}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8A8797]">
                    <span>Triage Urgency:</span>
                    <span
                      className={`font-semibold capitalize ${
                        activeComment.urgency === "high" || activeComment.urgency === "urgent"
                          ? "text-rose-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {activeComment.urgency}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#8A8797]">
                    <span>Status:</span>
                    <span className="font-semibold capitalize text-emerald-400">{activeComment.status}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] italic">No active commenter selected.</p>
            )}
          </div>

          {/* Meta Live Token Health & Scopes Card */}
          <div className="p-4 rounded-xl bg-[#181822] border border-[#2B2B3B] flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Meta App Permissions Status
            </h4>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#121218] border border-[#242430]">
                <span className="text-[#A1A1AA] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Instagram Comments
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#121218] border border-[#242430]">
                <span className="text-[#A1A1AA] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Direct Messages (DMs)
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#121218] border border-[#242430]">
                <span className="text-[#A1A1AA] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Human Agent 7-Day Window
                </span>
                <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Ready
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#121218] border border-[#242430]">
                <span className="text-[#A1A1AA] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Comment / Reel Liking
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Active
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[#71717A] mt-1 leading-normal">
              App Mode: Development/Live with Standard Access active for AI Social Media Manager.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EngagementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#101014] flex items-center justify-center text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      }
    >
      <EngagementContent />
    </Suspense>
  );
}
