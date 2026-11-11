"use client";

import React, { useState } from "react";
import { StoryboardPayload } from "./types";
import {
  Film,
  Clock,
  Video,
  Copy,
  Check,
  Sparkles,
  Volume2,
  Type,
  Layers,
  Tag,
  Share2,
} from "lucide-react";

interface StoryboardPanelProps {
  payload: StoryboardPayload;
}

export function StoryboardPanel({ payload }: StoryboardPanelProps) {
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);

  const handleCopyPrompt = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptIdx(idx);
    setTimeout(() => setCopiedPromptIdx(null), 2000);
  };

  const scenes = payload.scenes || [];

  return (
    <div className="space-y-6">
      {/* ── Storyboard Metadata Header ── */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {payload.deliverable_title || "Reel Storyboard"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Scene-by-scene shoot script & Flux visual prompts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {payload.target_duration_seconds && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border border-border font-medium">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>{payload.target_duration_seconds}s</span>
              </span>
            )}
            {payload.strategic_pillar && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-semibold">
                <Layers className="w-3.5 h-3.5" />
                <span>{payload.strategic_pillar}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Scene Timeline Cards ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Video className="w-4 h-4 text-primary" />
            <span>Shot Breakdown ({scenes.length} Scenes)</span>
          </h4>
          <span className="text-[11px] text-muted-foreground">Sequential Timeline</span>
        </div>

        <div className="space-y-3.5">
          {scenes.map((scene, idx) => (
            <div
              key={scene.scene_number || idx}
              className="p-4 rounded-xl border border-border bg-card hover:border-purple-500/40 transition-all shadow-xs space-y-3"
            >
              {/* Scene Top Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/30">
                    {scene.scene_number || idx + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    {scene.timestamp_range || "0:00 - 0:03"}
                  </span>
                </div>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {scene.shot_type || "Talking Head"}
                </span>
              </div>

              {/* Visual Action & Camera Movement */}
              <div className="text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Visual Action & Camera Cue
                </span>
                <p className="text-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  {scene.visual_action}
                </p>
              </div>

              {/* Spoken Voiceover */}
              {scene.voiceover_script && (
                <div className="text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-primary" />
                    <span>Voiceover / Spoken Line</span>
                  </span>
                  <p className="text-foreground italic bg-purple-500/5 dark:bg-purple-950/20 p-2.5 rounded-lg border border-purple-500/20 border-l-4 border-l-purple-500 font-medium">
                    &ldquo;{scene.voiceover_script}&rdquo;
                  </p>
                </div>
              )}

              {/* On-Screen Text & Audio Cue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {scene.on_screen_text && (
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <Type className="w-3 h-3 text-primary" />
                      <span>On-Screen Overlay</span>
                    </span>
                    <p className="font-semibold text-foreground mt-0.5 text-[11px]">
                      {scene.on_screen_text}
                    </p>
                  </div>
                )}
                {scene.audio_sfx_cue && (
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-primary" />
                      <span>Audio / Beat Cue</span>
                    </span>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {scene.audio_sfx_cue}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Visual Prompt (Flux / Midjourney) */}
              {scene.ai_visual_prompt && (
                <div className="pt-2 border-t border-border/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>Flux / Midjourney Render Prompt</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(scene.ai_visual_prompt!, idx)}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                    >
                      {copiedPromptIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] bg-muted/60 text-muted-foreground p-2 rounded-lg border border-border select-all break-words leading-relaxed">
                    {scene.ai_visual_prompt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Publishable Caption, Hashtags & CTA ── */}
      {(payload.full_caption || payload.call_to_action) && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-primary" />
            <span>Post Copy & Off-Ramp</span>
          </h4>

          {payload.full_caption && (
            <div className="space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Caption
              </span>
              <p className="text-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border whitespace-pre-wrap">
                {payload.full_caption}
              </p>
            </div>
          )}

          {payload.hashtags && payload.hashtags.length > 0 && (
            <div className="space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-primary" />
                <span>Targeted Hashtags</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {payload.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-primary border border-border/80"
                  >
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {payload.call_to_action && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                Call to Action
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
