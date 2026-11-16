"use client";

import React from "react";
import { CarouselDeckPayload } from "./types";
import {
  Layers,
  Image as ImageIcon,
  Tag,
  Share2,
  Sparkles,
} from "lucide-react";

interface CarouselPanelProps {
  payload: CarouselDeckPayload;
}

export function CarouselPanel({ payload }: CarouselPanelProps) {
  const slides = payload.slides || [];

  return (
    <div className="space-y-6">
      {/* ── Carousel Metadata Header ── */}
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F2F0F7]">
                {payload.deliverable_title || "Educational Carousel Deck"}
              </h3>
              <p className="text-xs text-[#A3A0B0]">
                Slide-by-slide copy & visual composition instructions
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] font-bold text-xs border border-[#A78BFA]/30">
            {slides.length} Slides
          </span>
        </div>
      </div>

      {/* ── Slide Cards ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-[#A78BFA]" />
            <span>Deck Slides Flow</span>
          </h4>
          <span className="text-[11px] font-mono text-[#A3A0B0]">Ordered Cards</span>
        </div>

        <div className="space-y-3">
          {slides.map((slide, idx) => (
            <div
              key={slide.slide_number || idx}
              className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#A78BFA]/40 transition-all shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#30303D]/60">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] font-bold text-xs flex items-center justify-center border border-[#A78BFA]/30">
                    {slide.slide_number || idx + 1}
                  </span>
                  <span className="text-xs font-bold text-[#F2F0F7]">
                    {idx === 0
                      ? "Cover Slide (The Arrest)"
                      : idx === slides.length - 1
                      ? "Closing CTA Slide"
                      : `Content Slide ${idx + 1}`}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
                  {idx === 0 ? "Cover" : idx === slides.length - 1 ? "CTA" : "Content"}
                </span>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-sm text-[#F2F0F7]">
                  {slide.headline}
                </h5>
                <p className="text-xs text-[#A3A0B0] leading-relaxed whitespace-pre-wrap bg-[#20202A] p-3 rounded-lg border border-[#30303D]/60">
                  {slide.body_copy}
                </p>
              </div>

              {slide.visual_layout_note && (
                <div className="text-xs space-y-1 pt-1 border-t border-[#30303D]/60">
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                    Visual Layout & Graphic Guidance
                  </span>
                  <p className="text-xs text-[#F2F0F7] bg-[#20202A] p-2 rounded-lg border border-[#30303D]/60 font-mono text-[11px]">
                    {slide.visual_layout_note}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
