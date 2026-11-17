"use client";

import React, { useState } from "react";
import { CarouselDeckPayload } from "./types";
import {
  Layers,
  Image as ImageIcon,
  Tag,
  Share2,
  Sparkles,
  ChevronRight,
  Maximize2,
  CheckCircle2,
} from "lucide-react";

interface CarouselPanelProps {
  payload: CarouselDeckPayload;
}

export function CarouselPanel({ payload }: CarouselPanelProps) {
  const slides = payload.slides || [];
  const [selectedSlideIdx, setSelectedSlideIdx] = useState<number>(0);

  return (
    <div className="space-y-6">
      {/* ── 1. Carousel Metadata Header ── */}
      <div className="surface-card p-5 rounded-2xl border border-white/[0.08] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 font-semibold">
                  Instagram / LinkedIn Carousel
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]">
                  1:1 Square Deck
                </span>
              </div>
              <h3 className="font-bold text-base text-[#F2F0F7] tracking-tight">
                {payload.deliverable_title || "Educational Carousel Deck"}
              </h3>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#45B88A]/10 text-[#45B88A] font-semibold text-xs border border-[#45B88A]/30 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{slides.length} Slides Sequenced</span>
          </span>
        </div>
      </div>

      {/* ── 2. Horizontal Slide Deck Track ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#A78BFA]" />
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#F2F0F7] font-mono">
              1:1 Carousel Slide Deck Flow
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]">
              {slides.length} Slides
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#A3A0B0] hidden sm:inline">
            Scroll horizontally →
          </span>
        </div>

        {/* Slide Deck Horizontal Scroll Track */}
        <div className="overflow-x-auto flex gap-4 pb-4 pt-1 px-1 scrollbar-thin">
          {slides.map((slide, idx) => {
            const isSelected = selectedSlideIdx === idx;
            const isCover = idx === 0;
            const isClosing = idx === slides.length - 1;
            const archetype = isCover
              ? "Cover (The Arrest)"
              : isClosing
              ? "Closing CTA"
              : `Content Slide ${idx + 1}`;

            return (
              <div
                key={slide.slide_number || idx}
                onClick={() => setSelectedSlideIdx(idx)}
                className={`w-80 shrink-0 surface-card rounded-2xl border transition-all cursor-pointer flex flex-col justify-between p-4 space-y-3 relative overflow-hidden ${
                  isSelected
                    ? "border-[#A78BFA] shadow-[0_0_16px_rgba(167,139,250,0.15)] ring-1 ring-[#A78BFA]/50"
                    : "border-white/[0.08] hover:border-white/[0.18]"
                }`}
              >
                {/* Slide Card Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] font-mono font-bold text-xs flex items-center justify-center border border-[#A78BFA]/30">
                      {slide.slide_number || idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#F2F0F7] font-heading">
                      {archetype}
                    </span>
                  </div>
                  <span
                    className={`text-[9.5px] font-mono uppercase px-2 py-0.5 rounded-full font-medium ${
                      isCover
                        ? "bg-[#E5AA58]/15 text-[#E5AA58] border border-[#E5AA58]/30"
                        : isClosing
                        ? "bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30"
                        : "bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]"
                    }`}
                  >
                    {isCover ? "Hook Cover" : isClosing ? "Save & Share" : "Value"}
                  </span>
                </div>

                {/* 1:1 Aspect Ratio Canvas Frame */}
                <div className="aspect-square w-full rounded-xl bg-[#101014] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#A3A0B0] uppercase tracking-wider">
                      Slide {idx + 1}/{slides.length}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/70">
                      1:1 Square
                    </span>
                  </div>

                  {/* Main Headline & Copy in Center */}
                  <div className="my-auto space-y-2 py-2">
                    <h5 className="font-bold text-sm text-[#F2F0F7] font-heading leading-snug">
                      {slide.headline}
                    </h5>
                    <p className="text-xs text-[#A3A0B0] font-sans leading-relaxed line-clamp-4">
                      {slide.body_copy}
                    </p>
                  </div>

                  {/* Slide Footer */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-[#6E6D7A]">
                    <span>Swipe next</span>
                    <ChevronRight className="w-3 h-3 text-[#A78BFA]" />
                  </div>
                </div>

                {/* Visual Layout & Composition Notes */}
                {slide.visual_layout_note && (
                  <div className="text-xs space-y-1 pt-1 border-t border-white/[0.08]">
                    <span className="text-[9.5px] uppercase font-bold text-[#A3A0B0] tracking-wider font-mono">
                      Design &amp; Layout Guidance
                    </span>
                    <p className="text-[11px] text-[#F2F0F7] bg-[#101014] p-2.5 rounded-lg border border-white/[0.06] font-mono leading-relaxed line-clamp-3">
                      {slide.visual_layout_note}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Caption & Off-Ramp ── */}
      {(payload.full_caption || payload.call_to_action) && (
        <div className="surface-card p-5 rounded-2xl border border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5 font-mono">
              <Share2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Carousel Caption &amp; Hashtags</span>
            </h4>
            <span className="text-[10px] font-mono text-[#A3A0B0]">
              Post Assets
            </span>
          </div>

          {payload.full_caption && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider font-mono">
                Full Caption
              </span>
              <p className="text-xs text-[#F2F0F7] leading-relaxed bg-[#101014] p-3 rounded-xl border border-white/[0.08] whitespace-pre-wrap">
                {payload.full_caption}
              </p>
            </div>
          )}

          {payload.hashtags && payload.hashtags.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1 font-mono">
                <Tag className="w-3 h-3 text-[#A78BFA]" />
                <span>Targeted Hashtags</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {payload.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#101014] text-[#A78BFA] border border-white/[0.08]"
                  >
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {payload.call_to_action && (
            <div className="p-3 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/20">
              <span className="text-[10px] uppercase font-bold text-[#45B88A] tracking-wider font-mono">
                Primary Call to Action (CTA)
              </span>
              <p className="font-semibold text-xs text-[#F2F0F7] mt-0.5">
                {payload.call_to_action}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
