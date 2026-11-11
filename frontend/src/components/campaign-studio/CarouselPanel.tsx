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
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {payload.deliverable_title || "Educational Carousel Deck"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Slide-by-slide copy & visual composition instructions
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-500/20">
            {slides.length} Slides
          </span>
        </div>
      </div>

      {/* ── Slide Cards ── */}
      <div className="space-y-3.5">
        <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span>Deck Slides Flow</span>
        </h4>

        {slides.map((slide, idx) => (
          <div
            key={slide.slide_number || idx}
            className="p-4 rounded-xl border border-border bg-card hover:border-indigo-500/40 transition-all shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                  {slide.slide_number || idx + 1}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {idx === 0 ? "Cover Slide (The Arrest)" : idx === slides.length - 1 ? "Closing CTA Slide" : `Content Slide ${idx + 1}`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h5 className="font-bold text-sm text-foreground">
                {slide.headline}
              </h5>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                {slide.body_copy}
              </p>
            </div>

            {slide.visual_layout_note && (
              <div className="text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Visual Composition / Illustration</span>
                </span>
                <p className="text-[11px] font-mono bg-muted/60 text-muted-foreground p-2 rounded-lg border border-border">
                  {slide.visual_layout_note}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Caption & CTA ── */}
      {(payload.full_caption || payload.call_to_action) && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-primary" />
            <span>Post Copy</span>
          </h4>

          {payload.full_caption && (
            <p className="text-xs text-foreground bg-muted/30 p-3 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
              {payload.full_caption}
            </p>
          )}

          {payload.hashtags && payload.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {payload.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-primary border border-border/80"
                >
                  #{tag.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}

          {payload.call_to_action && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                CTA
              </span>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {payload.call_to_action}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
