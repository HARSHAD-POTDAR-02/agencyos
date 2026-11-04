"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Users, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles, 
  Clock, 
  ArrowRight,
  Eye,
  Heart,
  ChevronRight,
  Plus,
  Play
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [metricView, setMetricView] = useState<"views" | "engagement">("views");

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, {user?.full_name?.split(" ")[0] || "Aryan"}! 
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your agency operations today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Client</span>
          </Link>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-purple-500/25 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Plan with AI</span>
          </Link>
        </div>
      </div>

      {/* 4 Essential KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Clients */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-purple-200 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Clients</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">3</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +1 this month
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">1 onboarding, 0 churned</p>
        </div>

        {/* Tasks Pending */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-purple-200 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasks Pending</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">12</span>
            <span className="inline-flex items-center text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              5 high priority
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">4 in review, 8 to-do</p>
        </div>

        {/* Deliverables Done */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-purple-200 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deliverables Done</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">18 / 30</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              60% complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-emerald-500 h-1.5 rounded-full w-[60%]" />
          </div>
        </div>

        {/* Retainer Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-purple-200 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Retainers</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">₹1.2L</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12% MoM
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">3 active retainer contracts</p>
        </div>
      </div>

      {/* Main Section: Performance Chart + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Performance Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Campaign Performance</h2>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  +42% Growth
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Aggregate impressions & engagement across all clients</p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
              <button 
                onClick={() => setMetricView("views")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  metricView === "views" ? "bg-purple-100/70 text-purple-800 font-bold" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                Views (100K)
              </button>
              <button 
                onClick={() => setMetricView("engagement")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  metricView === "engagement" ? "bg-indigo-100/70 text-indigo-800 font-bold" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Engagement (12.8%)
              </button>
            </div>
          </div>

          {/* SVG Spline Chart */}
          <div className="h-56 w-full relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#F1F5F9" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#F1F5F9" strokeDasharray="4 4" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#F1F5F9" strokeDasharray="4 4" />

              {/* Area 1 (Views) */}
              <path
                d="M 0,160 Q 120,120 220,105 T 380,55 T 500,40 L 500,200 L 0,200 Z"
                fill="url(#purpleGradient)"
              />
              <path
                d="M 0,160 Q 120,120 220,105 T 380,55 T 500,40"
                fill="none"
                stroke="#7C3AED"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Area 2 (Engagement) */}
              <path
                d="M 0,180 Q 140,150 250,135 T 390,95 T 500,80 L 500,200 L 0,200 Z"
                fill="url(#indigoGradient)"
              />
              <path
                d="M 0,180 Q 140,150 250,135 T 390,95 T 500,80"
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                strokeLinecap="round"
              />

              {/* Points */}
              <circle cx="220" cy="105" r="4" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="380" cy="55" r="4" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="500" cy="40" r="5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-2 mt-4 pt-3 border-t border-slate-100">
            <span>Week 1</span>
            <span>Week 2</span>
            <span>Week 3</span>
            <span>Week 4</span>
          </div>
        </div>

        {/* Upcoming Deadlines Widget */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Upcoming Deadlines</h2>
              <Link href="/tasks" className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Deadline 1 */}
              <div className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/60 transition-colors border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">Reel for Shorevada</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-600 border border-rose-200 uppercase">
                    Due Tomorrow
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Client: Shorevada Cafe</span>
                  <span className="font-semibold text-slate-600">Reel #18</span>
                </div>
              </div>

              {/* Deadline 2 */}
              <div className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/60 transition-colors border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">Monthly Campaign Report</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    Due in 2 days
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Client: Café Bliss</span>
                  <span className="font-semibold text-slate-600">Analytics PDF</span>
                </div>
              </div>

              {/* Deadline 3 */}
              <div className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/60 transition-colors border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">Client Signoff — Carousel #4</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                    Due in 3 days
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Client: Fitness First Gym</span>
                  <span className="font-semibold text-slate-600">Approval Queue</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
              href="/tasks"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Go to Task Kanban Board</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity + AI Assistant Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900">Recent Agency Activity</h2>
            <Link href="/approvals" className="text-xs font-bold text-purple-600 hover:text-purple-700">
              View Feed
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  Shorevada approved <span className="font-bold text-purple-700">&quot;Monsoon Special Menu Reel&quot;</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Approved by Rahul Sharma • 2 hours ago</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Approved
              </span>
            </div>

            <div className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100">
              <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  AI Campaign Planner generated 30 Reel concepts for <span className="font-bold text-purple-700">Café Bliss</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Saved as monthly draft • 4 hours ago</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                AI Draft
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  New client workspace initialized: <span className="font-bold text-purple-700">Fitness First Gym</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Contract: 30 Reels / month • Yesterday</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Client Active
              </span>
            </div>
          </div>
        </div>

        {/* AI Copilot Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0B0D14] via-[#121526] to-[#1E1538] text-white p-6 border border-purple-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3 h-3 text-purple-400" />
              AI Agent Orchestrator
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              Plan Next Month&apos;s Campaign in Seconds
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Ground your campaign strategy in verified client brand tone, contract quotas, and viral reel hooks without guessing.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
            <Link
              href="/campaigns"
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/40 flex items-center justify-center gap-2 transition-all"
            >
              <span>Launch AI Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
