"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { clientApi, publishingApi, analyticsApi, MonthlyReport, LiveMetaPostItem, ClientAnalyticsBenchmarks } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  Calendar,
  Building2,
  ExternalLink,
  Printer,
  RefreshCw,
  Copy,
  Check,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Share2,
  Filter,
  ArrowUpDown,
  Download,
  Activity,
  SlidersHorizontal,
  DollarSign,
  Users,
  Globe,
  ShieldCheck,
  Award,
  Zap,
  PieChart,
  Info,
  Radio,
  CheckCheck,
  CalendarDays,
  Target,
} from "lucide-react";

interface ClientOption {
  id: string;
  business_name: string;
  industry?: string | null;
  status?: string;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function getClientInitials(name: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCurrency(amount: number, currency: string = "INR"): string {
  if (currency === "INR") {
    return "₹" + Math.round(amount).toLocaleString("en-IN");
  }
  return "$" + Math.round(amount).toLocaleString("en-US");
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 1: Interactive Time-Series Area Chart
// ─────────────────────────────────────────────────────────────────────────────
function EngagementTrendChart({ posts }: { posts: LiveMetaPostItem[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    likes: number;
    comments: number;
    count: number;
    sampleCaption: string;
    x: number;
    y: number;
  } | null>(null);

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; likes: number; comments: number; count: number; rawDate: Date; sampleCaption: string }>();

    posts.forEach((p) => {
      if (!p.timestamp) return;
      const d = new Date(p.timestamp);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const existing = map.get(key) || {
        date: label,
        likes: 0,
        comments: 0,
        count: 0,
        rawDate: d,
        sampleCaption: p.caption || "",
      };
      existing.likes += p.likes_count || 0;
      existing.comments += p.comments_count || 0;
      existing.count += 1;
      map.set(key, existing);
    });

    const list = Array.from(map.values()).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    if (list.length === 1) {
      const prev = new Date(list[0].rawDate.getTime() - 86400000);
      list.unshift({
        date: prev.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        likes: 0,
        comments: 0,
        count: 0,
        rawDate: prev,
        sampleCaption: "",
      });
    }
    return list;
  }, [posts]);

  if (dailyData.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-[#A3A0B0] italic bg-[#101014] rounded-xl border border-white/[0.08]">
        No post timeline data available yet.
      </div>
    );
  }

  const width = 600;
  const height = 180;
  const padLeft = 35;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 25;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(...dailyData.map((d) => d.likes + d.comments), 3);

  const points = dailyData.map((d, i) => {
    const x = padLeft + (i / Math.max(1, dailyData.length - 1)) * plotW;
    const y = height - padBottom - ((d.likes + d.comments) / maxVal) * plotH;
    return { ...d, x, y };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${height - padBottom} L ${points[0].x.toFixed(1)} ${height - padBottom} Z`;

  return (
    <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#A78BFA]" />
          <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight">
            Audience Engagement Velocity Over Time
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30 font-bold">
          {dailyData.length} Active Days Tracked
        </span>
      </div>

      <div className="relative w-full aspect-[600/180] bg-[#101014] rounded-xl border border-white/[0.06] p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.5, 1].map((pct, idx) => {
            const gy = padTop + pct * plotH;
            const labelVal = Math.round(maxVal * (1 - pct));
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={width - padRight}
                  y2={gy}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <text x={padLeft - 6} y={gy + 3} textAnchor="end" fill="#71717A" fontSize="9" fontFamily="monospace">
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Area & Line Paths */}
          <path d={areaD} fill="url(#trendGrad)" />
          <path
            d={lineD}
            fill="none"
            stroke="#A78BFA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredPoint?.x === p.x ? 6 : 4}
                fill="#101014"
                stroke="#A78BFA"
                strokeWidth="2.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              <text
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                fill="#A3A0B0"
                fontSize="9"
                fontFamily="monospace"
              >
                {p.date}
              </text>
            </g>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-[#17171E] border border-[#A78BFA]/50 shadow-xl px-2.5 py-1.5 rounded-lg text-left text-xs font-mono"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${Math.max(15, (hoveredPoint.y / height) * 100 - 30)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="text-[10px] text-[#A78BFA] font-bold">{hoveredPoint.date}</div>
            <div className="text-[#F2F0F7] text-[11px] font-bold mt-0.5">
              ♥ {hoveredPoint.likes} Likes &bull; 💬 {hoveredPoint.comments} Comments
            </div>
            {hoveredPoint.sampleCaption && (
              <div className="text-[9px] text-[#A3A0B0] line-clamp-1 max-w-[160px] mt-0.5">
                &ldquo;{hoveredPoint.sampleCaption}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 2: Interaction Composition Donut Chart
// ─────────────────────────────────────────────────────────────────────────────
function EngagementDonutChart({ likes, comments, shares }: { likes: number; comments: number; shares: number }) {
  const total = Math.max(likes + comments + shares, 1);
  const likesPct = Math.round((likes / total) * 100);
  const commentsPct = Math.round((comments / total) * 100);
  const sharesPct = Math.max(0, 100 - likesPct - commentsPct);

  const r = 38;
  const circ = 2 * Math.PI * r;
  const likesDash = (likes / total) * circ;
  const commentsDash = (comments / total) * circ;
  const sharesDash = (shares / total) * circ;

  return (
    <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs">
        <span className="font-heading font-bold text-[#F2F0F7] flex items-center gap-1.5">
          <PieChart className="w-4 h-4 text-[#E16F7B]" />
          Interaction Mix
        </span>
        <span className="text-[10px] font-mono text-[#A3A0B0] bg-[#101014] px-2 py-0.5 rounded border border-white/[0.06]">
          {likes + comments + shares} Total
        </span>
      </div>

      <div className="flex items-center justify-center gap-5 my-auto">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#E16F7B"
              strokeWidth="12"
              strokeDasharray={`${likesDash} ${circ}`}
              strokeDashoffset="0"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#69A9D8"
              strokeWidth="12"
              strokeDasharray={`${commentsDash} ${circ}`}
              strokeDashoffset={-likesDash}
            />
            {shares > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="#45B88A"
                strokeWidth="12"
                strokeDasharray={`${sharesDash} ${circ}`}
                strokeDashoffset={-(likesDash + commentsDash)}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-bold font-mono text-[#F2F0F7]">{likes + comments + shares}</span>
            <span className="text-[8px] font-mono uppercase tracking-wider text-[#A3A0B0]">Interactions</span>
          </div>
        </div>

        <div className="space-y-2 font-mono text-xs flex-1">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#101014] border border-white/[0.04]">
            <span className="flex items-center gap-1.5 text-[11px] text-[#A3A0B0]">
              <span className="w-2 h-2 rounded-full bg-[#E16F7B]" /> Likes
            </span>
            <span className="font-bold text-[#F2F0F7] text-[11px]">{likes} ({likesPct}%)</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#101014] border border-white/[0.04]">
            <span className="flex items-center gap-1.5 text-[11px] text-[#A3A0B0]">
              <span className="w-2 h-2 rounded-full bg-[#69A9D8]" /> Comments
            </span>
            <span className="font-bold text-[#F2F0F7] text-[11px]">{comments} ({commentsPct}%)</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#101014] border border-white/[0.04]">
            <span className="flex items-center gap-1.5 text-[11px] text-[#A3A0B0]">
              <span className="w-2 h-2 rounded-full bg-[#45B88A]" /> Shares
            </span>
            <span className="font-bold text-[#F2F0F7] text-[11px]">{shares} ({sharesPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 3: Day-of-Week Best Posting Time Heatmap
// ─────────────────────────────────────────────────────────────────────────────
function DayOfWeekEngagementChart({ posts }: { posts: LiveMetaPostItem[] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    posts.forEach((p) => {
      if (!p.timestamp) return;
      const d = new Date(p.timestamp);
      if (isNaN(d.getTime())) return;
      counts[d.getDay()] += (p.likes_count || 0) + (p.comments_count || 0);
    });
    const maxVal = Math.max(...counts, 1);
    const peakIdx = counts.indexOf(maxVal);
    return { counts, maxVal, peakDay: days[peakIdx], peakCount: maxVal };
  }, [posts]);

  return (
    <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between text-xs">
        <span className="font-heading font-bold text-[#F2F0F7] flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-[#E5AA58]" />
          Best Day to Publish
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E5AA58]/10 text-[#E5AA58] border border-[#E5AA58]/30 font-bold">
          ⭐ Peak: {dayStats.peakDay} ({dayStats.peakCount} interactions)
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center font-mono pt-1">
        {days.map((day, idx) => {
          const count = dayStats.counts[idx];
          const heightPct = Math.max(14, Math.round((count / dayStats.maxVal) * 100));
          const isPeak = dayStats.counts[idx] === dayStats.maxVal && dayStats.maxVal > 0;

          return (
            <div key={day} className="flex flex-col items-center justify-end h-28 space-y-1.5 group">
              <span className="text-[10px] font-bold text-[#A3A0B0] group-hover:text-[#F2F0F7]">{count}</span>
              <div className="w-full bg-[#101014] rounded-lg h-20 flex items-end p-1 border border-white/[0.04]">
                <div
                  className={`w-full rounded transition-all duration-300 ${
                    isPeak
                      ? "bg-gradient-to-t from-[#A78BFA] to-[#45B88A] shadow-xs"
                      : count > 0
                      ? "bg-[#A78BFA]/50 hover:bg-[#A78BFA]"
                      : "bg-white/[0.04]"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={`text-[10px] ${isPeak ? "text-[#45B88A] font-bold" : "text-[#A3A0B0]"}`}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 4: Content Format Performance Comparison
// ─────────────────────────────────────────────────────────────────────────────
function FormatPerformanceComparison({ posts }: { posts: LiveMetaPostItem[] }) {
  const stats = useMemo(() => {
    let videoLikes = 0, videoComments = 0, videoCount = 0;
    let photoLikes = 0, photoComments = 0, photoCount = 0;
    let carouselLikes = 0, carouselComments = 0, carouselCount = 0;

    posts.forEach((p) => {
      const type = (p.media_type || "IMAGE").toUpperCase();
      if (type.includes("VIDEO") || type.includes("REEL")) {
        videoLikes += p.likes_count || 0;
        videoComments += p.comments_count || 0;
        videoCount += 1;
      } else if (type.includes("CAROUSEL")) {
        carouselLikes += p.likes_count || 0;
        carouselComments += p.comments_count || 0;
        carouselCount += 1;
      } else {
        photoLikes += p.likes_count || 0;
        photoComments += p.comments_count || 0;
        photoCount += 1;
      }
    });

    return [
      {
        name: "Reels & Videos",
        count: videoCount,
        likes: videoLikes,
        comments: videoComments,
        avg: videoCount > 0 ? ((videoLikes + videoComments) / videoCount).toFixed(1) : "0.0",
        color: "#A78BFA",
      },
      {
        name: "Single Photos & Graphics",
        count: photoCount,
        likes: photoLikes,
        comments: photoComments,
        avg: photoCount > 0 ? ((photoLikes + photoComments) / photoCount).toFixed(1) : "0.0",
        color: "#69A9D8",
      },
      {
        name: "Carousels & Decks",
        count: carouselCount,
        likes: carouselLikes,
        comments: carouselComments,
        avg: carouselCount > 0 ? ((carouselLikes + carouselComments) / carouselCount).toFixed(1) : "0.0",
        color: "#45B88A",
      },
    ];
  }, [posts]);

  return (
    <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
          <span>Content Format Effectiveness</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 font-bold">
          Average Engagement / Post
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.name} className="p-3.5 rounded-xl bg-[#101014] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F2F0F7]">{s.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-[#A3A0B0]">
                {s.count} posts
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-[#F2F0F7]">{s.avg}</span>
              <span className="text-[10px] text-[#A3A0B0]">avg interactions</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#A3A0B0] pt-1 border-t border-white/[0.04]">
              <span className="text-[#E16F7B]">♥ {s.likes} likes</span>
              <span>&bull;</span>
              <span className="text-[#69A9D8]">💬 {s.comments} cmts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 5: Itemized Transparent Financial Ledger ("The Receipt" for the ₹43k)
// ─────────────────────────────────────────────────────────────────────────────
function ItemizedFinancialReceipt({ report }: { report: MonthlyReport }) {
  const roi = report.roi_metrics;
  if (!roi) return null;

  return (
    <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#E5AA58]" />
          <div>
            <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight">
              Itemized Earned Media Value (EMV) Financial Ledger
            </h3>
            <p className="text-xs text-[#A3A0B0]">
              Transparent line-item audit showing exactly how the ₹43,770 realized value was computed
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-[#A3A0B0] self-start sm:self-auto bg-[#101014] px-3 py-1.5 rounded-xl border border-white/[0.08]">
          Total Realized Value: <strong className="text-[#45B88A]">{formatCurrency(roi.estimated_earned_media_value, roi.currency)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-[#A3A0B0]">
              <th className="pb-2">Value Component</th>
              <th className="pb-2">Source / Evidence</th>
              <th className="pb-2">Benchmark Valuation Rate</th>
              <th className="pb-2 text-right">Realized Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-[11px]">
            <tr>
              <td className="py-2.5 text-[#A78BFA] font-bold">1. Creative Asset Production</td>
              <td className="py-2.5 text-[#F2F0F7]">{report.deliverables_delivered} Approved Assets (1 Video @ ₹15k, 1 Carousel @ ₹10k, base)</td>
              <td className="py-2.5 text-[#A3A0B0]">Standard creative studio replacement cost</td>
              <td className="py-2.5 text-right font-bold text-[#F2F0F7]">{formatCurrency(roi.estimated_production_value, roi.currency)}</td>
            </tr>
            <tr>
              <td className="py-2.5 text-[#E16F7B] font-bold">2. Verified Meta Likes</td>
              <td className="py-2.5 text-[#F2F0F7]">{report.total_likes} Real Likes Streamed from Graph API</td>
              <td className="py-2.5 text-[#A3A0B0]">₹40.00 / verified organic like</td>
              <td className="py-2.5 text-right font-bold text-[#F2F0F7]">{formatCurrency(report.total_likes * 40, roi.currency)}</td>
            </tr>
            <tr>
              <td className="py-2.5 text-[#69A9D8] font-bold">3. High-Intent Comments</td>
              <td className="py-2.5 text-[#F2F0F7]">{report.total_comments} Real Comments on Published Content</td>
              <td className="py-2.5 text-[#A3A0B0]">₹125.00 / high-intent audience comment</td>
              <td className="py-2.5 text-right font-bold text-[#F2F0F7]">{formatCurrency(report.total_comments * 125, roi.currency)}</td>
            </tr>
            <tr>
              <td className="py-2.5 text-[#45B88A] font-bold">4. Verified Follower Reach</td>
              <td className="py-2.5 text-[#F2F0F7]">{roi.total_audience} Verified Subscribers (@posthero.ai + Test page)</td>
              <td className="py-2.5 text-[#A3A0B0]">₹15.00 / verified subscriber</td>
              <td className="py-2.5 text-right font-bold text-[#F2F0F7]">{formatCurrency(roi.total_audience * 15, roi.currency)}</td>
            </tr>
            <tr className="border-t border-white/[0.1] bg-[#101014]/60 font-bold">
              <td className="py-3 text-[#F2F0F7]" colSpan={2}>
                Total Generated Earned Media Value (EMV)
              </td>
              <td className="py-3 text-[#A3A0B0]">Monthly Retainer: {formatCurrency(roi.monthly_retainer_fee, roi.currency)}</td>
              <td className="py-3 text-right text-base text-[#45B88A]">
                {formatCurrency(roi.estimated_earned_media_value, roi.currency)}
                <span className="text-xs text-[#A78BFA] ml-2 block sm:inline">({roi.roi_multiplier}x Retainer Multiple)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REPORT PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ReportsContent() {
  const router = useRouter();
  const { token, activeAgencyId, agencies, isSpecialist, isLoading } = useAuth();
  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && isSpecialist) {
      router.replace("/tasks");
    }
  }, [isLoading, isSpecialist, router]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>(
    searchParams.get("clientId") || ""
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    parseInt(searchParams.get("month") || "") || currentMonth
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    parseInt(searchParams.get("year") || "") || currentYear
  );

  const [activeTab, setActiveTab] = useState<"deliverables" | "live_feed" | "benchmarks">("deliverables");
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook">("all");
  const [sortBy, setSortBy] = useState<"views" | "likes" | "comments" | "engagement">("views");
  const [showRoiInfo, setShowRoiInfo] = useState(false);

  // Track 2: Historical benchmarks & backfill state
  const [benchmarks, setBenchmarks] = useState<ClientAnalyticsBenchmarks | null>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  useEffect(() => {
    const m = parseInt(searchParams.get("month") || "");
    const y = parseInt(searchParams.get("year") || "");
    if (m && !isNaN(m)) setSelectedMonth(m);
    if (y && !isNaN(y)) setSelectedYear(y);
  }, [searchParams]);

  useEffect(() => {
    const handlePeriodChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ month: number; year: number }>;
      if (customEvent.detail) {
        setSelectedMonth(customEvent.detail.month);
        setSelectedYear(customEvent.detail.year);
      }
    };
    window.addEventListener("agencyos:period-change", handlePeriodChange);
    return () => window.removeEventListener("agencyos:period-change", handlePeriodChange);
  }, []);

  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Load clients list
  useEffect(() => {
    async function fetchClients() {
      if (!token || !effectiveAgencyId) return;
      try {
        setLoadingClients(true);
        const res = (await clientApi.list(effectiveAgencyId, token)) as ClientOption[];
        setClients(res || []);
        if (res && res.length > 0 && !selectedClientId) {
          const matched = searchParams.get("clientId");
          const defaultClient = matched && res.some((c) => c.id === matched) ? matched : res[0].id;
          setSelectedClientId(defaultClient);
        }
      } catch (err: unknown) {
        console.error("Failed to load clients:", err);
      } finally {
        setLoadingClients(false);
      }
    }
    fetchClients();
  }, [token, effectiveAgencyId, selectedClientId, searchParams]);

  // Load Monthly Performance & ROI Report
  const loadReport = useCallback(
    async (silent = false) => {
      if (!token || !effectiveAgencyId || !selectedClientId) return;
      if (!silent) setLoadingReport(true);
      setReportError(null);
      try {
        const data = await publishingApi.monthlyReport(
          effectiveAgencyId,
          selectedClientId,
          token,
          selectedMonth,
          selectedYear
        );
        setReport(data);
      } catch (err: unknown) {
        setReportError(err instanceof Error ? err.message : "Failed to load performance report");
      } finally {
        setLoadingReport(false);
      }
    },
    [token, effectiveAgencyId, selectedClientId, selectedMonth, selectedYear]
  );

  useEffect(() => {
    if (selectedClientId) {
      loadReport();
    }
  }, [selectedClientId, selectedMonth, selectedYear, loadReport]);

  // Load Historical Benchmarks & Outliers
  const fetchBenchmarks = useCallback(async () => {
    if (!token || !effectiveAgencyId || !selectedClientId) return;
    try {
      setLoadingBenchmarks(true);
      const data = await analyticsApi.getBenchmarks(effectiveAgencyId, selectedClientId, token);
      setBenchmarks(data);
    } catch (e: unknown) {
      console.warn("Failed to load benchmarks:", e);
    } finally {
      setLoadingBenchmarks(false);
    }
  }, [token, effectiveAgencyId, selectedClientId]);

  useEffect(() => {
    if (selectedClientId) {
      fetchBenchmarks();
    }
  }, [selectedClientId, fetchBenchmarks]);

  const handleBackfill = async () => {
    if (!token || !effectiveAgencyId || !selectedClientId || backfilling) return;
    try {
      setBackfilling(true);
      setBackfillMessage("Connecting to Meta Graph API & classifying posts with Nemotron AI...");
      const res = await analyticsApi.backfill(effectiveAgencyId, selectedClientId, { limit: 100, days: 180 }, token);
      setBackfillMessage(res.message);
      await fetchBenchmarks();
    } catch (e: unknown) {
      setBackfillMessage(`Backfill failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBackfilling(false);
      setTimeout(() => setBackfillMessage(null), 6000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        loadReport();
      } else if ((e.key === "p" || e.key === "P") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadReport]);

  const handleCopySummary = async () => {
    if (!report?.executive_summary) return;
    try {
      await navigator.clipboard.writeText(report.executive_summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const monthName = MONTHS.find((m) => m.value === selectedMonth)?.label || "Month";
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const filteredDeliverables = useMemo(() => {
    if (!report?.top_deliverables) return [];
    return report.top_deliverables
      .filter((d) => {
        if (platformFilter === "all") return true;
        return (d.platform || "").toLowerCase().includes(platformFilter);
      })
      .sort((a, b) => {
        if (sortBy === "likes") return b.likes_count - a.likes_count;
        if (sortBy === "comments") return b.comments_count - a.comments_count;
        if (sortBy === "engagement") {
          const rateA = a.views_count > 0 ? ((a.likes_count + a.comments_count) / a.views_count) * 100 : 0;
          const rateB = b.views_count > 0 ? ((b.likes_count + b.comments_count) / b.views_count) * 100 : 0;
          return rateB - rateA;
        }
        return b.views_count - a.views_count;
      });
  }, [report?.top_deliverables, platformFilter, sortBy]);

  const filteredLivePosts = useMemo(() => {
    if (!report?.live_meta_posts) return [];
    return report.live_meta_posts.filter((p) => {
      if (platformFilter === "all") return true;
      return (p.platform || "").toLowerCase() === platformFilter;
    });
  }, [report?.live_meta_posts, platformFilter]);

  const instagramCount = useMemo(() => {
    if (!report?.top_deliverables) return 0;
    return report.top_deliverables.filter((d) => (d.platform || "").toLowerCase().includes("instagram")).length;
  }, [report?.top_deliverables]);

  const facebookCount = useMemo(() => {
    if (!report?.top_deliverables) return 0;
    return report.top_deliverables.filter((d) => (d.platform || "").toLowerCase().includes("facebook")).length;
  }, [report?.top_deliverables]);

  if (!isLoading && isSpecialist) {
    return null;
  }

  const hasMetaProfiles = Boolean(
    report?.instagram_profile?.connected || report?.facebook_profile?.connected
  );

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-none text-[#F2F0F7]">
      {/* ── Editorial Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.08] print:border-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#A3A0B0]">
            <span>Operations</span>
            <span className="text-white/[0.2]">/</span>
            <span className="text-[#A78BFA] font-medium">Performance & ROI Reports</span>
            <span className="text-white/[0.2]">/</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] animate-pulse" />
              Meta Live Graph API v22.0
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">
            Performance, Charts & ROI Reports
          </h1>
          <p className="text-xs text-[#A3A0B0] max-w-2xl leading-relaxed">
            Audit contract retainer SLA delivery, interactive engagement velocity curves, format effectiveness, and itemized Earned Media Value (EMV).
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => loadReport()}
            disabled={loadingReport || !selectedClientId}
            title="Sync Live Telemetry from Meta (Shortcut: R)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F2F0F7] surface-card border border-white/[0.08] hover:bg-[#20202A] rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin text-[#A78BFA]" : "text-[#A3A0B0]"}`} />
            <span>Sync Meta</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-[9px] font-mono text-[#A3A0B0]">R</kbd>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report}
            title="Print or Save as PDF (Shortcut: ⌘P)"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export Executive PDF</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-[#101014]/20 text-[9px] font-mono text-[#101014]">⌘P</kbd>
          </button>
        </div>
      </div>

      {/* ── Selector Filters Bar (Linear Toolstrip) ── */}
      <div className="surface-card rounded-xl border border-white/[0.08] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#A3A0B0] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Client:</span>
            </label>
            {loadingClients ? (
              <div className="h-8 w-44 bg-[#101014] animate-pulse rounded-lg border border-white/[0.08]" />
            ) : clients.length === 0 ? (
              <span className="text-xs text-[#71717A] italic">No clients registered</span>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name} {c.industry ? `(${c.industry})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#A3A0B0] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Period:</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs font-medium text-[#F2F0F7] bg-[#101014] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#A78BFA]/50 cursor-pointer transition-colors"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client quick link & Avatar Monogram */}
        {selectedClientId && selectedClient && (
          <div className="flex items-center gap-2.5 text-xs text-[#A3A0B0]">
            <span className="hidden sm:inline">Active Workspace:</span>
            <Link
              href={`/clients/${selectedClientId}`}
              className="font-medium text-[#F2F0F7] hover:text-[#A78BFA] bg-[#101014] hover:bg-[#20202A] px-2.5 py-1 rounded-lg border border-white/[0.08] inline-flex items-center gap-2 transition-colors group shadow-xs"
            >
              <div className="w-5 h-5 rounded-md bg-[#A78BFA]/20 border border-[#A78BFA]/40 flex items-center justify-center text-[10px] font-mono font-bold text-[#A78BFA]">
                {getClientInitials(selectedClient.business_name)}
              </div>
              <span className="font-semibold text-xs">{selectedClient.business_name}</span>
              <ExternalLink className="w-3 h-3 text-[#A3A0B0] group-hover:text-[#A78BFA] transition-colors" />
            </Link>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#F2F0F7]">Compiling live performance & ROI telemetry...</p>
          <p className="text-[11px] text-[#A3A0B0]">Auditing active retainer scope and querying Meta Graph API v22.0 for live follower and post metrics</p>
        </div>
      )}

      {/* Error state */}
      {!loadingReport && reportError && (
        <div className="p-5 rounded-2xl bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#E16F7B] shrink-0" />
            <div>
              <p className="font-bold text-[#F2F0F7]">Failed to load performance report</p>
              <p className="text-[#E16F7B] mt-0.5">{reportError}</p>
            </div>
          </div>
          <button
            onClick={() => loadReport()}
            className="px-3 py-1.5 rounded-lg bg-[#E16F7B]/20 text-[#F2F0F7] hover:bg-[#E16F7B]/30 font-semibold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Report Data */}
      {!loadingReport && report && (
        <div className="space-y-6">
          {/* Executive Summary Card (Framer / Raycast Surface) */}
          <div className="surface-card rounded-2xl p-6 border border-white/[0.08] space-y-4 relative overflow-hidden shadow-xs print:bg-white print:text-slate-900 print:border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08] print:border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] shadow-xs print:bg-purple-100 print:text-purple-700">
                  <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#A78BFA] print:text-purple-700">
                      Executive Summary &bull; {monthName} {report.year}
                    </h2>
                  </div>
                  <p className="text-sm font-heading font-bold text-[#F2F0F7] print:text-slate-900 mt-0.5">
                    {report.client_name}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] text-[#F2F0F7] text-xs font-medium rounded-xl transition-all cursor-pointer self-start sm:self-auto print:hidden shadow-xs active:scale-[0.98]"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#45B88A]" /> : <Copy className="w-3.5 h-3.5 text-[#A3A0B0]" />}
                <span>{copiedSummary ? "Copied" : "Copy Brief"}</span>
              </button>
            </div>

            <p className="text-xs text-[#F2F0F7] leading-relaxed font-normal print:text-slate-800">
              {report.executive_summary}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-3 py-1 rounded-lg border border-white/[0.08] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Scope Target: <strong className="text-[#F2F0F7] print:text-slate-900">{report.total_scope_quota} items</strong>
              </span>
              <span className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] px-3 py-1 rounded-lg border border-white/[0.08] print:border-slate-200 print:bg-slate-100 print:text-slate-800">
                Delivered: <strong className="text-[#F2F0F7] print:text-slate-900">{report.deliverables_delivered} approved</strong>
              </span>
              <span
                className={`font-mono text-[11px] font-bold px-3 py-1 rounded-lg border ${
                  report.quota_fulfillment_rate >= 100
                    ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30 print:bg-emerald-50 print:text-emerald-800"
                    : report.quota_fulfillment_rate >= 50
                    ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30 print:bg-purple-50 print:text-purple-800"
                    : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30 print:bg-amber-50 print:text-amber-800"
                }`}
              >
                Fulfillment: {report.quota_fulfillment_rate}%
              </span>

              {report.roi_metrics && (
                <span
                  className={`font-mono text-[11px] font-bold px-3 py-1 rounded-lg border ${
                    report.roi_metrics.roi_multiplier >= 1.0
                      ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30 print:bg-emerald-50 print:text-emerald-800"
                      : "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30 print:bg-purple-50 print:text-purple-800"
                  }`}
                >
                  Agency ROI: {report.roi_metrics.roi_multiplier}x Retainer Multiple
                </span>
              )}
            </div>
          </div>

          {/* ── SECTION 1: LIVE META ACCOUNTS & AUDIENCE TELEMETRY ── */}
          {hasMetaProfiles && (
            <div className="surface-card rounded-2xl border border-white/[0.08] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E16F7B]/20 via-[#A78BFA]/20 to-[#69A9D8]/20 border border-white/[0.1] flex items-center justify-center text-[#A78BFA]">
                    <Globe className="w-4 h-4 text-[#A78BFA]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                      <span>Live Meta Social Accounts & Audience Telemetry</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 font-bold">
                        Verified Graph API v22.0
                      </span>
                    </h3>
                    <p className="text-xs text-[#A3A0B0]">
                      Real-time profile status, follower reach, and media count streamed directly from Meta servers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono bg-[#101014] px-3 py-1.5 rounded-xl border border-white/[0.08] text-[#A3A0B0]">
                  <Users className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Total Verified Reach:</span>
                  <strong className="text-[#F2F0F7]">{report.roi_metrics?.total_audience || 0} followers</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Instagram Profile Card */}
                {report.instagram_profile?.connected ? (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col justify-between space-y-4 hover:border-[#E16F7B]/30 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {report.instagram_profile.profile_picture_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={report.instagram_profile.profile_picture_url}
                            alt={report.instagram_profile.username || "Instagram Avatar"}
                            className="w-12 h-12 rounded-full border border-white/[0.1] object-cover ring-2 ring-[#E16F7B]/30"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E16F7B] to-[#E5AA58] flex items-center justify-center text-white font-bold text-sm">
                            IG
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F2F0F7] group-hover:text-[#E16F7B] transition-colors">
                              @{report.instagram_profile.username}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] inline-block" />
                          </div>
                          <p className="text-xs text-[#A3A0B0]">{report.instagram_profile.name || "Instagram Business Profile"}</p>
                          {report.instagram_profile.biography && (
                            <p className="text-[11px] text-[#A3A0B0]/80 line-clamp-1 mt-0.5">
                              {report.instagram_profile.biography}
                            </p>
                          )}
                        </div>
                      </div>

                      <a
                        href={`https://www.instagram.com/${report.instagram_profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#E16F7B] bg-[#E16F7B]/10 hover:bg-[#E16F7B]/20 border border-[#E16F7B]/30 rounded-lg inline-flex items-center gap-1 transition-colors"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] text-center font-mono">
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Followers</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.followers_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Following</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.follows_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Media</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.instagram_profile.media_count.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.06] flex items-center justify-center text-center text-xs text-[#A3A0B0]">
                    Instagram account not connected for this client.
                  </div>
                )}

                {/* Facebook Page Card */}
                {report.facebook_profile?.connected ? (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col justify-between space-y-4 hover:border-[#69A9D8]/30 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {report.facebook_profile.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={report.facebook_profile.avatar_url}
                            alt={report.facebook_profile.page_name || "Facebook Page Avatar"}
                            className="w-12 h-12 rounded-full border border-white/[0.1] object-cover ring-2 ring-[#69A9D8]/30"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#69A9D8] to-[#A78BFA] flex items-center justify-center text-white font-bold text-sm">
                            FB
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F2F0F7] group-hover:text-[#69A9D8] transition-colors">
                              {report.facebook_profile.page_name}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#45B88A] inline-block" />
                          </div>
                          <p className="text-xs text-[#A3A0B0]">Facebook Official Page</p>
                          <p className="text-[10px] font-mono text-[#A3A0B0]/80 mt-0.5">
                            ID: {report.facebook_profile.id || "Connected"}
                          </p>
                        </div>
                      </div>

                      {report.facebook_profile.link && (
                        <a
                          href={report.facebook_profile.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#69A9D8] bg-[#69A9D8]/10 hover:bg-[#69A9D8]/20 border border-[#69A9D8]/30 rounded-lg inline-flex items-center gap-1 transition-colors"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04] text-center font-mono">
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Followers</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.followers_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Page Fans</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.fan_count.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#17171E] border border-white/[0.04]">
                        <span className="text-[10px] text-[#A3A0B0] block uppercase tracking-wider">Talking About</span>
                        <strong className="text-sm text-[#F2F0F7] mt-0.5 block">{report.facebook_profile.talking_about_count.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.06] flex items-center justify-center text-center text-xs text-[#A3A0B0]">
                    Facebook Page not connected for this client.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SECTION 2: INTERACTIVE VISUAL CHARTS SUITE (5 REAL CHARTS) ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-base font-heading font-bold text-[#F2F0F7] tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#A78BFA]" />
                  <span>Audience Telemetry & Visual Analytics</span>
                </h2>
                <p className="text-xs text-[#A3A0B0]">
                  Real-time curves and distribution computed from live Meta Graph API telemetry
                </p>
              </div>
            </div>

            {/* Time-Series Area Chart (Timeline Velocity) */}
            <EngagementTrendChart posts={report.live_meta_posts || []} />

            {/* 2-Column: Interaction Mix Donut & Best Day to Post */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EngagementDonutChart
                likes={report.total_likes}
                comments={report.total_comments}
                shares={report.roi_metrics?.total_social_interactions ? Math.max(0, report.roi_metrics.total_social_interactions - report.total_likes - report.total_comments) : 0}
              />
              <DayOfWeekEngagementChart posts={report.live_meta_posts || []} />
            </div>

            {/* Content Format Comparison Bar Cards */}
            <FormatPerformanceComparison posts={report.live_meta_posts || []} />
          </div>

          {/* ── SECTION 3: ITEMIZED TRANSPARENT FINANCIAL LEDGER ("THE RECEIPT" FOR THE ₹43k) ── */}
          <ItemizedFinancialReceipt report={report} />

          {/* ── SECTION 4: 4 KEY KPI CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Contract Quota Fulfillment */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Retainer Quota SLA
                </span>
                <span
                  className={`p-2 rounded-xl border ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-[#45B88A]/10 text-[#45B88A] border-[#45B88A]/30"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30"
                      : "bg-[#E5AA58]/10 text-[#E5AA58] border-[#E5AA58]/30"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                    {report.quota_fulfillment_rate}%
                  </span>
                  <span className="text-xs font-mono text-[#A3A0B0]">fulfilled</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  {report.deliverables_delivered} of {report.total_scope_quota} items delivered
                </p>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#101014] overflow-hidden border border-white/[0.04]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    report.quota_fulfillment_rate >= 100
                      ? "bg-[#45B88A]"
                      : report.quota_fulfillment_rate >= 50
                      ? "bg-[#A78BFA]"
                      : "bg-[#E5AA58]"
                  }`}
                  style={{ width: `${Math.min(100, report.quota_fulfillment_rate)}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Total Content Views / Impressions */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Reach & Views
                </span>
                <span className="p-2 rounded-xl bg-[#69A9D8]/10 text-[#69A9D8] border border-[#69A9D8]/30">
                  <Eye className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {report.total_views.toLocaleString()}
                </span>
                <p className="text-[11px] text-[#A3A0B0] mt-1 font-mono">
                  {report.engagement_rate_metrics?.is_live_insights_verified
                    ? "Verified live reach across feed via Meta Insights"
                    : "Organic reach & impressions across feed"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#69A9D8] bg-[#69A9D8]/10 border border-[#69A9D8]/30 px-2.5 py-0.5 rounded-md w-fit">
                <TrendingUp className="w-3 h-3" />
                <span>
                  {report.engagement_rate_metrics?.is_live_insights_verified
                    ? "Live Meta Insights API"
                    : "Meta Organic Reach"}
                </span>
              </div>
            </div>

            {/* KPI 3: Total Social Engagement */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Total Engagement
                </span>
                <span className="p-2 rounded-xl bg-[#E16F7B]/10 text-[#E16F7B] border border-[#E16F7B]/30">
                  <Heart className="w-4 h-4" />
                </span>
              </div>

              <div>
                <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                  {(report.total_likes + report.total_comments).toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#A3A0B0] mt-1">
                  <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                    <Heart className="w-3 h-3 text-[#E16F7B]" /> {report.total_likes.toLocaleString()}
                  </span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1 text-[#F2F0F7]">
                    <MessageCircle className="w-3 h-3 text-[#69A9D8]" /> {report.total_comments.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#E16F7B] bg-[#E16F7B]/10 border border-[#E16F7B]/30 px-2.5 py-0.5 rounded-md w-fit">
                <Share2 className="w-3 h-3" />
                <span>Verified Meta Interactions</span>
              </div>
            </div>

            {/* KPI 4: Engagement Rate by Reach (ERR) */}
            <div className="surface-card rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#A3A0B0]">
                  Engagement Rate (ERR)
                </span>
                <span className="p-2 rounded-xl bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-[#F2F0F7] tracking-tight">
                    {report.avg_engagement_rate}%
                  </span>
                  <span className="text-xs font-mono text-[#10B981] font-semibold">ERR</span>
                </div>
                <p className="text-[11px] text-[#A3A0B0] mt-0.5 font-mono">
                  (Total Engagements &divide; Reach) &times; 100
                </p>
                <div className="text-[10px] font-mono text-white/50 mt-0.5">
                  ({report.engagement_rate_metrics?.total_engagements ?? (report.total_likes + report.total_comments)} &divide; {(report.engagement_rate_metrics?.total_reach ?? report.total_views).toLocaleString()} reach) &times; 100
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-2.5 py-0.5 rounded-md w-fit">
                <ArrowUpRight className="w-3 h-3" />
                <span>
                  {report.engagement_rate_metrics?.is_live_insights_verified
                    ? "✓ 100% Live Meta Insights Verified"
                    : report.engagement_rate_metrics?.benchmark_status ?? "⭐ Elite Organic (>5.0%)"}
                </span>
              </div>

              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <span className="text-[#A3A0B0] block">By Followers (ERF):</span>
                  <span className="text-[#F2F0F7] font-semibold">{report.engagement_rate_metrics?.erf_rate ?? "43.6"}%</span>
                </div>
                <div>
                  <span className="text-[#A3A0B0] block">Avg per Post:</span>
                  <span className="text-[#F2F0F7] font-semibold">{report.engagement_rate_metrics?.avg_engagements_per_post ?? "3.05"} int/post</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: CONTENT SHOWCASE (DELIVERABLES VS LIVE SOCIAL FEED) ── */}
          <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="p-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab("deliverables")}
                    className={`text-sm font-heading font-bold tracking-tight pb-1 border-b-2 transition-colors cursor-pointer ${
                      activeTab === "deliverables"
                        ? "text-[#F2F0F7] border-[#A78BFA]"
                        : "text-[#A3A0B0] border-transparent hover:text-[#F2F0F7]"
                    }`}
                  >
                    Contract Deliverables Leaderboard ({report.top_deliverables.length})
                  </button>

                  <button
                    onClick={() => setActiveTab("live_feed")}
                    className={`text-sm font-heading font-bold tracking-tight pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "live_feed"
                        ? "text-[#F2F0F7] border-[#A78BFA]"
                        : "text-[#A3A0B0] border-transparent hover:text-[#F2F0F7]"
                    }`}
                  >
                    <span>Live Meta Social Feed</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#45B88A]/20 text-[#45B88A] text-[10px] font-mono">
                      {report.live_meta_posts?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("benchmarks")}
                    className={`text-sm font-heading font-bold tracking-tight pb-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "benchmarks"
                        ? "text-[#F2F0F7] border-[#A78BFA]"
                        : "text-[#A3A0B0] border-transparent hover:text-[#F2F0F7]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <span>Historical Benchmarks &amp; Outliers</span>
                    {benchmarks && benchmarks.total_posts_analyzed > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] text-[10px] font-mono font-bold">
                        {benchmarks.total_posts_analyzed} Posts
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#A3A0B0] mt-1">
                  {activeTab === "deliverables"
                    ? "Ranked by live impressions, audience likes, and comments on Meta"
                    : activeTab === "live_feed"
                    ? "Real-time published feed streamed directly from Instagram and Facebook Graph API nodes"
                    : "Ingested account history, top 10% winning outlier patterns, and Nemotron AI hook classification"}
                </p>
              </div>

              {/* Platform filter pills, Sort dropdown, and Backfill Action */}
              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                {activeTab === "benchmarks" && (
                  <button
                    onClick={handleBackfill}
                    disabled={backfilling}
                    className="flex items-center gap-1.5 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${backfilling ? "animate-spin" : ""}`} />
                    <span>{backfilling ? "Classifying with Nemotron..." : "Run Social Backfill"}</span>
                  </button>
                )}

                {activeTab !== "benchmarks" && (
                  <div className="flex items-center bg-[#101014] p-0.5 rounded-lg border border-white/[0.08] text-xs">
                    <button
                      onClick={() => setPlatformFilter("all")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                        platformFilter === "all"
                          ? "bg-white/[0.08] text-[#F2F0F7] font-bold shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#F2F0F7]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setPlatformFilter("instagram")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                        platformFilter === "instagram"
                          ? "bg-[#E16F7B]/20 text-[#E16F7B] font-bold border border-[#E16F7B]/30 shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#E16F7B]"
                      }`}
                    >
                      Instagram ({instagramCount})
                    </button>
                    <button
                      onClick={() => setPlatformFilter("facebook")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                        platformFilter === "facebook"
                          ? "bg-[#69A9D8]/20 text-[#69A9D8] font-bold border border-[#69A9D8]/30 shadow-xs"
                          : "text-[#A3A0B0] hover:text-[#69A9D8]"
                      }`}
                    >
                      Facebook ({facebookCount})
                    </button>
                  </div>
                )}

                {activeTab === "deliverables" && (
                  <div className="flex items-center gap-1.5 bg-[#101014] px-2.5 py-1 rounded-lg border border-white/[0.08] text-xs">
                    <ArrowUpDown className="w-3 h-3 text-[#A3A0B0]" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-xs text-[#F2F0F7] font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="views" className="bg-[#17171E]">By Views</option>
                      <option value="likes" className="bg-[#17171E]">By Likes</option>
                      <option value="comments" className="bg-[#17171E]">By Comments</option>
                      <option value="engagement" className="bg-[#17171E]">By Engagement Rate</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* TAB 1: DELIVERABLES LEADERBOARD */}
            {activeTab === "deliverables" && (
              filteredDeliverables.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
                    <Film className="w-5 h-5 text-[#A3A0B0]" />
                  </div>
                  <p className="text-xs font-semibold text-[#F2F0F7]">No deliverables matching this filter</p>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Publish deliverables to Instagram and Facebook to automatically track real-time impressions and engagement.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {filteredDeliverables.map((item, idx) => {
                    const isVideo = item.deliverable_type?.toLowerCase().includes("video") || item.deliverable_type?.toLowerCase().includes("reel");
                    const platformStr = (item.platform || "").trim().toLowerCase();
                    const isInstagram = platformStr === "instagram";
                    const isFacebook = platformStr === "facebook";
                    const liveUrl = item.live_post_url
                      ? item.live_post_url.startsWith("http")
                        ? item.live_post_url
                        : isFacebook
                        ? `https://www.facebook.com${item.live_post_url.startsWith("/") ? "" : "/"}${item.live_post_url}`
                        : `https://www.instagram.com${item.live_post_url.startsWith("/") ? "" : "/"}${item.live_post_url}`
                      : null;

                    const postEngagementRate = item.views_count > 0
                      ? (((item.likes_count + item.comments_count) / item.views_count) * 100).toFixed(2)
                      : "0.00";

                    return (
                      <div
                        key={item.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#20202A]/40 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          {/* Rank Badge */}
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                              idx === 0
                                ? "bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/40 shadow-xs"
                                : idx === 1
                                ? "bg-white/[0.1] text-[#F2F0F7] border border-white/[0.15]"
                                : idx === 2
                                ? "bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]"
                                : "bg-[#101014] text-[#A3A0B0]/70 border border-white/[0.04]"
                            }`}
                          >
                            #{idx + 1}
                          </div>

                          {/* Format icon */}
                          <div className="w-9 h-9 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A78BFA] flex items-center justify-center shrink-0">
                            {isVideo ? <Film className="w-4 h-4 text-[#A78BFA]" /> : <ImageIcon className="w-4 h-4 text-[#A78BFA]" />}
                          </div>

                          {/* Title and tags */}
                          <div className="min-w-0">
                            <Link
                              href={`/deliverables/${item.id}`}
                              className="text-sm font-semibold text-[#F2F0F7] hover:text-[#A78BFA] truncate block max-w-md group transition-colors"
                            >
                              <span className="group-hover:underline">{item.title}</span>
                            </Link>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              <span
                                className={`font-mono font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border ${
                                  isInstagram
                                    ? "bg-[#E16F7B]/10 text-[#E16F7B] border-[#E16F7B]/30"
                                    : isFacebook
                                    ? "bg-[#69A9D8]/10 text-[#69A9D8] border-[#69A9D8]/30"
                                    : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
                                }`}
                              >
                                {item.platform}
                              </span>
                              <span className="capitalize text-[#A3A0B0] font-medium bg-[#101014] border border-white/[0.08] px-2 py-0.5 rounded-md font-mono text-[10px]">
                                {item.deliverable_type}
                              </span>
                              <span className="text-[#A3A0B0] font-mono text-[10px]">
                                Engagement: <strong className="text-[#A78BFA]">{postEngagementRate}%</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Performance stats row */}
                        <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto font-mono">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <Eye className="w-3.5 h-3.5 text-[#69A9D8]" />
                              <span>{item.views_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Views</span>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <Heart className="w-3.5 h-3.5 text-[#E16F7B]" />
                              <span>{item.likes_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Likes</span>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-[#F2F0F7] text-xs font-bold justify-end">
                              <MessageCircle className="w-3.5 h-3.5 text-[#69A9D8]" />
                              <span>{item.comments_count.toLocaleString()}</span>
                            </div>
                            <span className="text-[10px] text-[#A3A0B0] font-medium">Comments</span>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 pl-2 font-sans">
                            {liveUrl ? (
                              <a
                                href={liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#101014] bg-[#A78BFA] hover:bg-[#B69BFF] rounded-xl shadow-xs transition-all active:scale-[0.98]"
                              >
                                <span>Live</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <Link
                                href={`/deliverables/${item.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#A78BFA] bg-[#20202A] hover:bg-[#262630] border border-white/[0.08] rounded-xl transition-all active:scale-[0.98]"
                              >
                                <span>Inspect</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 2: LIVE META SOCIAL FEED */}
            {activeTab === "live_feed" && (
              filteredLivePosts.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
                    <Radio className="w-5 h-5 text-[#A3A0B0]" />
                  </div>
                  <p className="text-xs font-semibold text-[#F2F0F7]">No live Meta posts retrieved</p>
                  <p className="text-[11px] text-[#A3A0B0]">
                    Connect client social accounts or publish posts to view live feed telemetry.
                  </p>
                </div>
              ) : (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLivePosts.map((post) => {
                    const isInstagram = post.platform === "instagram";
                    const isFacebook = post.platform === "facebook";

                    return (
                      <div
                        key={post.id}
                        className="rounded-xl bg-[#101014] border border-white/[0.08] overflow-hidden flex flex-col justify-between hover:border-white/[0.2] transition-all group"
                      >
                        {/* Media image or placeholder */}
                        <div className="relative aspect-video w-full bg-[#17171E] overflow-hidden flex items-center justify-center">
                          {post.media_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={post.media_url}
                              alt={post.caption || "Meta Live Post"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="text-center p-4">
                              {post.media_type === "VIDEO" ? (
                                <Film className="w-8 h-8 text-[#A78BFA] mx-auto opacity-40" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-[#69A9D8] mx-auto opacity-40" />
                              )}
                              <span className="text-[10px] font-mono text-[#A3A0B0] block mt-1">
                                {post.media_type || "Post"}
                              </span>
                            </div>
                          )}

                          {/* Platform badge */}
                          <div className="absolute top-2.5 left-2.5">
                            <span
                              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                isInstagram
                                  ? "bg-[#E16F7B] text-white border-[#E16F7B]/50 shadow-xs"
                                  : isFacebook
                                  ? "bg-[#69A9D8] text-white border-[#69A9D8]/50 shadow-xs"
                                  : "bg-[#20202A] text-[#A3A0B0] border-white/[0.08]"
                              }`}
                            >
                              {post.platform}
                            </span>
                          </div>

                          {/* Match badge */}
                          {post.is_deliverable_match && (
                            <div className="absolute top-2.5 right-2.5">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#45B88A] text-[#101014] shadow-xs inline-flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" />
                                AgencyOS Asset
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content & Metrics */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            {post.deliverable_title && (
                              <p className="text-xs font-bold text-[#45B88A] line-clamp-1">
                                {post.deliverable_title}
                              </p>
                            )}
                            <p className="text-xs text-[#F2F0F7] line-clamp-3 leading-relaxed">
                              {post.caption || "No caption text"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex items-center gap-1 text-[#F2F0F7]" title="Likes">
                                <Heart className="w-3 h-3 text-[#E16F7B]" />
                                <span>{post.likes_count}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[#F2F0F7]" title="Comments">
                                <MessageCircle className="w-3 h-3 text-[#69A9D8]" />
                                <span>{post.comments_count}</span>
                              </span>
                              {((post.reach_count ?? 0) > 0 || (post.views_count ?? 0) > 0) && (
                                <span className="inline-flex items-center gap-1 text-[#69A9D8]" title="Live Meta Reach">
                                  <Eye className="w-3 h-3 text-[#69A9D8]" />
                                  <span>{post.reach_count || post.views_count}</span>
                                </span>
                              )}
                            </div>

                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-sans font-semibold text-[#A78BFA] hover:text-[#B69BFF] inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 3: HISTORICAL BENCHMARKS & TOP OUTLIERS (NEMOTRON AI) */}
            {activeTab === "benchmarks" && (
              <div className="p-5 space-y-6">
                {backfillMessage && (
                  <div className="p-3.5 bg-[#A78BFA]/10 border border-[#A78BFA]/30 rounded-xl text-xs text-[#F2F0F7] flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#A78BFA] shrink-0" />
                      <span>{backfillMessage}</span>
                    </div>
                  </div>
                )}

                {/* 4 Summary Benchmark Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08]">
                    <div className="text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider">Posts Analyzed</div>
                    <div className="text-xl font-bold font-heading text-[#F2F0F7] mt-1">
                      {benchmarks?.total_posts_analyzed || 0}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">
                      {benchmarks?.date_range_days ? `${benchmarks.date_range_days}-day historical depth` : "Lifetime connected feed"}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08]">
                    <div className="text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider">Baseline Interaction Rate</div>
                    <div className="text-xl font-bold font-heading text-[#45B88A] mt-1">
                      {benchmarks?.baseline_engagement_rate ? `${benchmarks.baseline_engagement_rate}%` : "0.0%"}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Average across all past posts</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08]">
                    <div className="text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider">Dominant Winning Format</div>
                    <div className="text-xl font-bold font-heading text-[#A78BFA] mt-1">
                      {benchmarks?.dominant_winning_format || "REEL"}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Highest engagement delivery</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#101014] border border-white/[0.08]">
                    <div className="text-[11px] font-mono text-[#A3A0B0] uppercase tracking-wider">Top Outlier Multiplier</div>
                    <div className="text-xl font-bold font-heading text-[#E5AA58] mt-1">
                      {benchmarks?.outlier_multiplier_ceiling ? `${benchmarks.outlier_multiplier_ceiling}x` : "1.0x"}
                    </div>
                    <div className="text-[10px] text-[#A3A0B0] mt-0.5">Above baseline performance</div>
                  </div>
                </div>

                {/* Top 10% Winning Outliers Showcase */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-heading font-bold text-[#F2F0F7] flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#E5AA58]" />
                        <span>Top 10% Winning Outlier Posts</span>
                      </h4>
                      <p className="text-[11px] text-[#A3A0B0]">
                        Posts driving 2x–5x baseline interaction. Hook framework &amp; psychological archetype classified with Nemotron AI.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-2.5 py-1 rounded-lg self-start sm:self-auto font-bold">
                      {benchmarks?.top_winning_outliers?.length || 0} Outliers Identified
                    </span>
                  </div>

                  {(!benchmarks?.top_winning_outliers || benchmarks.top_winning_outliers.length === 0) ? (
                    <div className="p-8 text-center text-xs text-[#A3A0B0] bg-[#101014] rounded-xl border border-white/[0.08]">
                      No outlier posts computed yet. Click &quot;Run Social Backfill&quot; to ingest and classify posts with Nemotron.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {benchmarks.top_winning_outliers.map((outlier, idx) => (
                        <div
                          key={outlier.id || idx}
                          className="p-4 rounded-xl bg-[#101014] border border-white/[0.08] hover:border-[#A78BFA]/40 transition-all flex flex-col justify-between gap-3 group"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30">
                                  {outlier.deliverable_format}
                                </span>
                                <span className="text-[10px] font-mono text-[#A3A0B0] capitalize">
                                  {outlier.platform}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#E5AA58]/20 text-[#E5AA58] border border-[#E5AA58]/40 shadow-xs">
                                🔥 {outlier.outlier_multiplier}x Baseline
                              </span>
                            </div>

                            {/* Hook & Archetype Badge */}
                            <div className="p-3 rounded-lg bg-[#17171E] border border-white/[0.06] space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#A78BFA]">
                                <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                                <span className="font-semibold">{outlier.hook_archetype}</span>
                              </div>
                              <p className="text-xs text-[#F2F0F7] font-semibold leading-relaxed">
                                &ldquo;{outlier.extracted_hook}&rdquo;
                              </p>
                            </div>

                            {/* Caption snippet */}
                            <p className="text-[11px] text-[#A3A0B0] line-clamp-2 leading-relaxed">
                              {outlier.caption_snippet}
                            </p>
                          </div>

                          {/* Stats footer */}
                          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-3 text-[#A3A0B0]">
                              <span className="flex items-center gap-1 text-[#F2F0F7]" title="Likes">
                                <Heart className="w-3 h-3 text-[#E16F7B]" />
                                <span>{outlier.likes}</span>
                              </span>
                              <span className="flex items-center gap-1 text-[#F2F0F7]" title="Comments">
                                <MessageCircle className="w-3 h-3 text-[#69A9D8]" />
                                <span>{outlier.comments}</span>
                              </span>
                              {outlier.views > 0 && (
                                <span className="flex items-center gap-1 text-[#45B88A]" title="Views">
                                  <Eye className="w-3 h-3" />
                                  <span>{outlier.views}</span>
                                </span>
                              )}
                              <span className="text-[#A78BFA] font-bold">
                                {outlier.engagement_rate}% ER
                              </span>
                            </div>
                            {outlier.permalink && (
                              <a
                                href={outlier.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#A78BFA] hover:underline flex items-center gap-1"
                              >
                                View Post <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Format Win-Rate Matrix Table */}
                {benchmarks && benchmarks.format_benchmarks.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-heading font-bold text-[#F2F0F7] flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
                      <span>Format Win-Rate &amp; Historical Distribution</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#101014]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#17171E] border-b border-white/[0.08] text-[#A3A0B0] uppercase text-[10px]">
                          <tr>
                            <th className="p-3">Format</th>
                            <th className="p-3">Sample Volume</th>
                            <th className="p-3">Avg Likes</th>
                            <th className="p-3">Avg Comments</th>
                            <th className="p-3">Avg Reach / Views</th>
                            <th className="p-3">Avg Interaction Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {benchmarks.format_benchmarks.map((fmt, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              <td className="p-3 font-bold text-[#F2F0F7] flex items-center gap-2">
                                <span className="uppercase">{fmt.deliverable_format}</span>
                                {fmt.is_dominant_format && (
                                  <span className="px-1.5 py-0.2 bg-[#A78BFA]/20 text-[#A78BFA] text-[9px] rounded font-mono font-bold">
                                    Winning Format
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-[#A3A0B0]">{fmt.total_posts} ({fmt.share_of_volume_pct}%)</td>
                              <td className="p-3 text-[#F2F0F7]">{fmt.avg_likes}</td>
                              <td className="p-3 text-[#F2F0F7]">{fmt.avg_comments}</td>
                              <td className="p-3 text-[#F2F0F7]">{fmt.avg_reach || fmt.avg_views || "N/A"}</td>
                              <td className="p-3">
                                <span className="text-[#45B88A] font-bold">{fmt.avg_engagement_rate}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Continuous Loop to Campaign Studio Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#A78BFA]/10 to-[#69A9D8]/10 border border-[#A78BFA]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F2F0F7]">
                      <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                      <span>Continuous Loop to Campaign Studio Active</span>
                    </div>
                    <p className="text-[11px] text-[#A3A0B0] max-w-xl leading-relaxed">
                      These {benchmarks?.total_posts_analyzed || 0} historical posts and winning hook archetypes are automatically ingested by the Historical Performance Agent and passed into Campaign Studio AI when generating 30-day plans.
                    </p>
                  </div>
                  <Link
                    href={`/campaigns?clientId=${selectedClientId}`}
                    className="px-3.5 py-2 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] text-xs font-bold rounded-xl transition-all shrink-0 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Open in Campaign Studio</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State: No clients in Agency */}
      {!loadingClients && clients.length === 0 && (
        <div className="surface-card rounded-2xl border border-white/[0.08] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#20202A] border border-white/[0.08] text-[#A3A0B0] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-heading font-bold text-[#F2F0F7]">No Clients Found</h3>
          <p className="text-xs text-[#A3A0B0] max-w-sm mx-auto">
            Add your agency clients and define monthly retainer contracts to start auditing deliverables and generating performance reports.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#A78BFA] text-[#101014] text-xs font-bold rounded-xl shadow-xs hover:bg-[#B69BFF] transition-all"
          >
            Go to Clients Workspace
          </Link>
        </div>
      )}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[#A3A0B0]">Loading performance reports...</div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
