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
  Camera,
  Maximize2,
  Play,
} from "lucide-react";

interface StoryboardPanelProps {
  payload: StoryboardPayload;
  pinnedEntities?: string[];
}

export function StoryboardPanel({ payload, pinnedEntities = [] }: StoryboardPanelProps) {
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState<number>(0);

  const handleCopyPrompt = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptIdx(idx);
    setTimeout(() => setCopiedPromptIdx(null), 2000);
  };

  const scenes = payload.scenes || [];
  const hookText =
    scenes[0]?.voiceover_script ||
    scenes[0]?.on_screen_text ||
    "Stop scrolling right now.";

  return (
    <div className="space-y-6">
      {/* ── 1. Editorial Storyboard Header ── */}
      <div className="surface-card p-5 rounded-2xl border border-white/[0.08] relative overflow-hidden shadow-xs space-y-4">
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
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#20202A] text-[#A3A0B0] border border-white/[0.08]">
                  9:16 Vertical Video
                </span>
                {payload.target_duration_seconds && (
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#20202A] text-[#F2F0F7] border border-white/[0.08]">
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
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#45B88A]/10 text-[#45B88A] border border-[#45B88A]/30 text-xs font-semibold font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{scenes.length} Scenes Sequenced</span>
            </span>
          </div>
        </div>

        {/* The 0–3s Arresting Hook Section */}
        <div className="p-3.5 rounded-xl bg-[#101014] border border-white/[0.08] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A78BFA] flex items-center gap-1.5 font-mono">
              <Flame className="w-3.5 h-3.5 text-[#E5AA58]" />
              <span>0:00–0:03 Arresting Hook</span>
            </span>
            <span className="text-[10px] font-mono text-[#A3A0B0]">
              Peak Attention Gate
            </span>
          </div>
          <p className="text-sm font-semibold text-[#F2F0F7] leading-relaxed italic">
            &ldquo;{hookText}&rdquo;
          </p>
        </div>
      </div>

      {/* ── 2. Horizontal Storyboard Filmstrip Track ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#A78BFA]" />
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#F2F0F7] font-mono">
              9:16 Video Storyboard Filmstrip
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#A3A0B0] border border-white/[0.08]">
              {scenes.length} Frames
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#A3A0B0] hidden sm:inline">
            Scroll horizontally →
          </span>
        </div>

        {/* Filmstrip Track */}
        <div className="overflow-x-auto flex gap-4 pb-4 pt-1 px-1 scrollbar-thin">
          {scenes.map((scene, idx) => {
            const isSelected = selectedSceneIdx === idx;
            const sceneEntities = Array.from(
              new Set([
                ...(scene.hero_focus || []),
                ...pinnedEntities.filter((e) => {
                  const q = e.toLowerCase();
                  return (
                    scene.visual_action?.toLowerCase().includes(q) ||
                    scene.voiceover_script?.toLowerCase().includes(q) ||
                    scene.on_screen_text?.toLowerCase().includes(q) ||
                    scene.ai_visual_prompt?.toLowerCase().includes(q)
                  );
                }),
              ])
            );
            const isHeroScene = sceneEntities.length > 0;

            return (
              <div
                key={scene.scene_number || idx}
                onClick={() => setSelectedSceneIdx(idx)}
                className={`w-72 sm:w-80 shrink-0 surface-card rounded-2xl border transition-all cursor-pointer flex flex-col justify-between p-4 space-y-3.5 relative overflow-hidden ${
                  isSelected
                    ? "border-[#A78BFA] shadow-[0_0_16px_rgba(167,139,250,0.15)] ring-1 ring-[#A78BFA]/50"
                    : isHeroScene
                    ? "border-[#E5AA58]/60 shadow-[0_0_14px_rgba(229,170,88,0.12)] hover:border-[#E5AA58]"
                    : "border-white/[0.08] hover:border-white/[0.18]"
                }`}
              >
                {/* Scene Card Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] font-mono font-bold text-xs flex items-center justify-center border border-[#A78BFA]/30">
                      {scene.scene_number || idx + 1}
                    </span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#101014] text-[#F2F0F7] border border-white/[0.08]">
                      {scene.timestamp_range || "0:00 - 0:03"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-[#A78BFA] bg-[#A78BFA]/10 px-2 py-0.5 rounded-full border border-[#A78BFA]/20">
                    {scene.shot_type || "Talking Head"}
                  </span>
                </div>

                {/* Hero Focus Badge Banner */}
                {isHeroScene && (
                  <div className="flex items-center gap-1.5 flex-wrap -mt-1">
                    {sceneEntities.map((ent) => (
                      <span
                        key={ent}
                        className="flex items-center gap-1 text-[9.5px] font-mono px-2 py-0.5 rounded-md bg-[#E5AA58]/15 text-[#E5AA58] border border-[#E5AA58]/30 font-semibold"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-[#E5AA58]" />
                        <span>Hero: {ent}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* 9:16 Viewfinder Visual Mockup Frame */}
                <div className="relative aspect-[9/16] w-full max-h-56 rounded-xl bg-[#101014] border border-white/[0.08] flex flex-col justify-between p-3 overflow-hidden group">
                  {/* Viewfinder Corners */}
                  <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[#A78BFA]/60" />
                  <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-[#A78BFA]/60" />
                  <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-[#A78BFA]/60" />
                  <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[#A78BFA]/60" />

                  {/* Top indicator: Camera / Framing Tag */}
                  <div className="flex items-center justify-between z-10">
                    <span className="flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 text-[#A3A0B0] backdrop-blur-xs border border-white/[0.06]">
                      <Camera className="w-2.5 h-2.5 text-[#A78BFA]" />
                      <span>{scene.shot_type || "Frame"}</span>
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/60 text-white/70">
                      9:16
                    </span>
                  </div>

                  {/* Center: Visual Action Summary */}
                  <div className="my-auto z-10 px-1 text-center">
                    <p className="text-xs text-[#F2F0F7] font-medium leading-snug line-clamp-4">
                      {scene.visual_action}
                    </p>
                  </div>

                  {/* Bottom: On-Screen Text Overlay Mockup */}
                  {scene.on_screen_text ? (
                    <div className="z-10 bg-black/80 backdrop-blur-md p-1.5 rounded-lg border border-white/[0.1] text-center">
                      <span className="text-[8.5px] uppercase font-mono text-[#E5AA58] block tracking-wide">
                        Overlay Text
                      </span>
                      <p className="text-[11px] font-bold text-white leading-tight">
                        &ldquo;{scene.on_screen_text}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="z-10 text-center">
                      <span className="text-[9px] font-mono text-[#6E6D7A]">
                        [No text overlay]
                      </span>
                    </div>
                  )}
                </div>

                {/* Spoken Voiceover Script */}
                {scene.voiceover_script && (
                  <div className="space-y-1">
                    <span className="text-[9.5px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1 font-mono">
                      <Volume2 className="w-3 h-3 text-[#A78BFA]" />
                      <span>Voiceover Script</span>
                    </span>
                    <p className="text-xs text-[#F2F0F7] italic bg-[#A78BFA]/5 p-2.5 rounded-lg border border-[#A78BFA]/20 border-l-2 border-l-[#A78BFA] font-medium leading-relaxed">
                      &ldquo;{scene.voiceover_script}&rdquo;
                    </p>
                  </div>
                )}

                {/* Audio SFX Cue */}
                {scene.audio_sfx_cue && (
                  <div className="bg-[#101014] p-2 rounded-lg border border-white/[0.06] text-xs">
                    <span className="text-[9.5px] uppercase font-bold text-[#A3A0B0] tracking-wider flex items-center gap-1 font-mono">
                      <Volume2 className="w-3 h-3 text-[#E5AA58]" />
                      <span>Audio Beat Cue</span>
                    </span>
                    <p className="text-[#A3A0B0] mt-0.5 text-[11px]">
                      {scene.audio_sfx_cue}
                    </p>
                  </div>
                )}

                {/* AI Visual Prompt Copy */}
                {scene.ai_visual_prompt && (
                  <div className="pt-2 border-t border-white/[0.08] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] uppercase font-bold text-[#A78BFA] tracking-wider flex items-center gap-1 font-mono">
                        <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                        <span>Flux / Midjourney</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrompt(scene.ai_visual_prompt!, idx);
                        }}
                        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#101014] hover:bg-white/[0.06] text-[#A3A0B0] hover:text-[#F2F0F7] border border-white/[0.08] transition-colors cursor-pointer"
                      >
                        {copiedPromptIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 text-[#45B88A]" />
                            <span className="text-[#45B88A] font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] bg-[#101014] text-[#A3A0B0] p-2 rounded-lg border border-white/[0.06] select-all break-words leading-relaxed line-clamp-3">
                      {scene.ai_visual_prompt}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Distribution Copy, Hashtags & Off-Ramp CTA ── */}
      {(payload.full_caption || payload.call_to_action) && (
        <div className="surface-card p-5 rounded-2xl border border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-bold tracking-wider text-[#A3A0B0] flex items-center gap-1.5 font-mono">
              <Share2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Distribution Caption &amp; Off-Ramp</span>
            </h3>
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
