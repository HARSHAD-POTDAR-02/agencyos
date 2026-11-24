"use client";

import React, { useState } from "react";
import { Play, Pause, Smartphone, Sliders, RotateCcw } from "lucide-react";

interface TeleprompterProps {
  clientName?: string;
  reelTitle?: string;
  wordCount?: number;
}

export function TeleprompterPreview({
  clientName = "One8 Commune",
  reelTitle = "Chef's Truffle Tasting Reel (60s Short-Form)",
  wordCount = 138,
}: TeleprompterProps) {
  const [speed, setSpeed] = useState<number>(140);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeScene, setActiveScene] = useState<number>(0);

  // Calculate estimated duration in mm:ss based on WPM
  const totalSeconds = Math.round((wordCount / speed) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedDuration = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const scenes = [
    {
      marker: "Scene 1 · [00:00 - 00:12]",
      cue: "Visual Hook & Entrance",
      copy: "This is what happens when you shave black winter truffles directly over handmade burrata gnocchi.",
      directorNote: "Elena (Video Producer): Hold eye contact on the word 'burrata'. Cut to tabletop slow-mo shaving at second 3.",
    },
    {
      marker: "Scene 2 · [00:13 - 00:28]",
      cue: "Sensory Detail & Kitchen Atmosphere",
      copy: "Our executive chef simmered this reduction for forty-eight hours with imported European butter and fresh mountain thyme.",
      directorNote: "Pan across the open kitchen copper pans. Keep speaking tone warm and confident.",
    },
    {
      marker: "Scene 3 · [00:29 - 00:46]",
      cue: "Limited Retainer Special & Menu Rule",
      copy: "We only prepare thirty portions every Friday evening. Once the daily harvest clears the kitchen, it is gone until next week.",
      directorNote: "Enforces RULE-04: Never mention discounting. Emphasize culinary rarity and daily harvest limits.",
    },
    {
      marker: "Scene 4 · [00:47 - 00:58]",
      cue: "Call to Action",
      copy: "Reserve your tasting table through the link in our bio before Friday seating closes out.",
      directorNote: "Direct point to the camera, smile, fade to One8 Commune closing card.",
    },
  ];

  return (
    <div className="rounded-xl border border-[rgba(55,53,47,0.12)] bg-[#FAF9F6] shadow-xs overflow-hidden">
      {/* Top Prompter Bar */}
      <div className="bg-[#F1F1EF] border-b border-[rgba(55,53,47,0.08)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-[#0F7B6C] animate-pulse" : "bg-[#9A6700]"}`} />
          <div>
            <p className="font-semibold text-[#111114]">{clientName} · {reelTitle}</p>
            <p className="text-[10px] text-[#6B6A65] font-mono">
              {wordCount} Words · Est. Runtime: {formattedDuration}
            </p>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-md border border-[rgba(55,53,47,0.08)] shadow-xs">
            <Sliders className="w-3 h-3 text-[#6B6A65]" />
            <span className="text-[11px] text-[#6B6A65]">Pace:</span>
            <span className="text-[11px] font-bold text-[#111114] min-w-[50px]">{speed} WPM</span>
            <input
              type="range"
              min="110"
              max="180"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20 h-1 bg-[#E9E9E7] rounded appearance-none cursor-pointer accent-[#111114]"
              aria-label="Adjust Prompter Words Per Minute"
            />
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 rounded-md bg-[#111114] text-white font-sans font-medium text-[11px] hover:bg-[#2F2E2B] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Run Prompter</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Prompter Visual Body */}
      <div className="p-6 text-center max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
          {scenes.map((scene, idx) => (
            <button
              key={scene.marker}
              onClick={() => setActiveScene(idx)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                activeScene === idx
                  ? "bg-[#111114] text-white font-semibold"
                  : "bg-white text-[#6B6A65] border border-[rgba(55,53,47,0.08)] hover:bg-[#F1F1EF]"
              }`}
            >
              Scene {idx + 1}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded bg-[#FBF3DB] text-[#9A6700] text-[10px] font-mono font-semibold">
            {scenes[activeScene].marker} · {scenes[activeScene].cue}
          </span>

          <p className="text-xl sm:text-2xl font-medium text-[#111114] leading-relaxed tracking-tight px-4">
            &quot;{scenes[activeScene].copy}&quot;
          </p>
        </div>

        {/* Director Note */}
        <div className="p-3.5 rounded-lg bg-white border border-[rgba(55,53,47,0.08)] shadow-xs text-left text-xs text-[#6B6A65] space-y-1 max-w-xl mx-auto">
          <p className="font-semibold text-[#111114] flex items-center gap-1.5 text-[11px]">
            <Smartphone className="w-3.5 h-3.5 text-[#0F7B6C]" />
            Director Cues & Compliance Check:
          </p>
          <p className="text-[11px] leading-relaxed">
            {scenes[activeScene].directorNote}
          </p>
        </div>
      </div>
    </div>
  );
}
