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
  CheckCircle2,
  Flame,
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
  const hookText = scenes[0]?.voiceover_script || scenes[0]?.on_screen_text || "Stop scrolling right now.";

  return (
    <div className="space-y-6">
      {/* ── 1. Editorial Storyboard Header ── */}
      <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 font-semibold">
                  Instagram Reel / TikTok
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#20202A] text-[#A3A0B0] border border-[#30303D]">
                  9:16 Vertical Video
                </span>
                {payload.target_duration_seconds && (
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#20202A] text-[#F2F0F7] border border-[#30303D]">
                    <Clock className="w-3 h-3 text-[#A78BFA]" />
                    <span>{payload.target_duration_seconds}s Runtime</span>
                  </span>
                )}
                {payload.strategic_pillar && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30">
                    <Layers className="w-3 h-3" />
                    <span>{payload.strategic_pillar}</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-[#F2F0F7] tracking-tight">
                {payload.deliverable_title || "High-Impact Video Concept"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#45B88A]/15 text-[#45B88A] border border-[#45B88A]/30 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Storyline Locked</span>
            </span>
          </div>
        </div>

        {/* The 0–3s Arresting Hook Section */}
        <div className="p-4 rounded-xl bg-[#20202A] border border-[#30303D] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A78BFA] flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#E5AA58]" />
              <span>0:00–0:03 Arresting Hook</span>
            </span>
            <span className="text-[11px] font-mono text-[#A3A0B0]">High Retention Angle</span>
          </div>
          <p className="text-sm font-semibold text-[#F2F0F7] leading-relaxed italic">
            &ldquo;{hookText}&rdquo;
          </p>
        </div>
      </div>

      {/* ── 2. Scene Timeline Breakdown ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <Video className="w-4 h-4 text-[#A78BFA]" />
            <span>Visual Storyboard Timeline ({scenes.length} Scenes)</span>
          </h3>
          <span className="text-[11px] font-mono text-[#A3A0B0]">Sequence Order</span>
        </div>

        <div className="space-y-3">
          {scenes.map((scene, idx) => (
            <div
              key={scene.scene_number || idx}
              className="p-4 rounded-xl border border-[#30303D] bg-[#17171E] hover:border-[#A78BFA]/50 transition-all shadow-sm space-y-3"
            >
              {/* Scene Top Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-[#30303D]/60">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] font-bold text-xs flex items-center justify-center border border-[#A78BFA]/30">
                    {scene.scene_number || idx + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#20202A] text-[#F2F0F7] border border-[#30303D]">
                    {scene.timestamp_range || "0:00 - 0:03"}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#A78BFA] bg-[#A78BFA]/10 px-2.5 py-0.5 rounded-full border border-[#A78BFA]/20">
                  {scene.shot_type || "Talking Head"}
                </span>
              </div>

              {/* Visual Direction & Camera Movement */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                  Visual Direction & Camera Movement
                </span>
                <p className="text-xs text-[#F2F0F7] leading-relaxed bg-[#20202A] p-2.5 rounded-lg border border-[#30303D]/60">
                  {scene.visual_action}
                </p>
              </div>

              {/* Spoken Voiceover */}
              {scene.voiceover_script && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-[#A78BFA]" />
                    <span>Voiceover / Audio Line</span>
                  </span>
                  <p className="text-xs text-[#F2F0F7] italic bg-[#A78BFA]/5 p-2.5 rounded-lg border border-[#A78BFA]/20 border-l-4 border-l-[#A78BFA] font-medium leading-relaxed">
                    &ldquo;{scene.voiceover_script}&rdquo;
                  </p>
                </div>
              )}

              {/* Overlays & Cues */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {scene.on_screen_text && (
                  <div className="bg-[#20202A] p-2 rounded-lg border border-[#30303D]/60">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1">
                      <Type className="w-3 h-3 text-[#A78BFA]" />
                      <span>On-Screen Overlay</span>
                    </span>
                    <p className="font-semibold text-[#F2F0F7] mt-0.5 text-[11px]">
                      {scene.on_screen_text}
                    </p>
                  </div>
                )}
                {scene.audio_sfx_cue && (
                  <div className="bg-[#20202A] p-2 rounded-lg border border-[#30303D]/60">
                    <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-[#E5AA58]" />
                      <span>Audio / Beat Cue</span>
                    </span>
                    <p className="text-[#A3A0B0] mt-0.5 text-[11px]">
                      {scene.audio_sfx_cue}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Visual Prompt for Flux / Midjourney */}
              {scene.ai_visual_prompt && (
                <div className="pt-2 border-t border-[#30303D]/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#A78BFA] tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                      <span>Flux / Midjourney Visual Prompt</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(scene.ai_visual_prompt!, idx)}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#20202A] hover:bg-[#262630] text-[#A3A0B0] hover:text-[#F2F0F7] border border-[#30303D] transition-colors cursor-pointer"
                    >
                      {copiedPromptIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-[#45B88A]" />
                          <span className="text-[#45B88A] font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] bg-[#101014] text-[#A3A0B0] p-2 rounded-lg border border-[#30303D] select-all break-words leading-relaxed">
                    {scene.ai_visual_prompt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Post Copy, Hashtags & Off-Ramp CTA ── */}
      {(payload.full_caption || payload.call_to_action) && (
        <div className="p-5 rounded-2xl bg-[#17171E] border border-[#30303D] shadow-sm space-y-4">
          <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Distribution Copy & Off-Ramp</span>
          </h3>

          {payload.full_caption && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider">
                Full Caption
              </span>
              <p className="text-xs text-[#F2F0F7] leading-relaxed bg-[#20202A] p-3 rounded-xl border border-[#30303D] whitespace-pre-wrap">
                {payload.full_caption}
              </p>
            </div>
          )}

          {payload.hashtags && payload.hashtags.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#A78BFA]" />
                <span>Targeted Hashtags</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {payload.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#20202A] text-[#A78BFA] border border-[#30303D]"
                  >
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {payload.call_to_action && (
            <div className="p-3 rounded-xl bg-[#45B88A]/10 border border-[#45B88A]/20">
              <span className="text-[10px] uppercase font-bold text-[#45B88A] tracking-wider">
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
