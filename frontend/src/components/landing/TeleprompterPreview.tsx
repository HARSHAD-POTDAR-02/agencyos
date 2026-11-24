"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Smartphone, Sliders, RotateCcw, Eye, Film } from "lucide-react";

interface TeleprompterProps {
  clientName?: string;
  reelTitle?: string;
  wordCount?: number;
  theme?: "light" | "dark";
}

export function TeleprompterPreview({
  clientName = "One8 Commune",
  reelTitle = "Chef's Truffle Tasting Reel (60s Short-Form)",
  wordCount = 138,
  theme = "light",
}: TeleprompterProps) {
  const [speed, setSpeed] = useState<number>(140);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeScene, setActiveScene] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate estimated duration in mm:ss based on WPM
  const totalSeconds = Math.round((wordCount / speed) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedDuration = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isDark = theme === "dark";

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
      directorNote: "Pan across the open kitchen copper pans. Keep speaking tone warm, conversational, and confident.",
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
      directorNote: "Direct point to the camera lens, warm smile, fade to One8 Commune closing signature card.",
    },
  ];

  // Live Auto-Scroll Engine driven by WPM speed
  useEffect(() => {
    let animFrame: number;
    let lastTime = performance.now();

    const scrollContainer = scrollRef.current;
    if (!scrollContainer || !isPlaying) return;

    const step = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Pixels per second scaled by WPM pace
      const pixelsPerSecond = (speed / 140) * 38;
      if (scrollContainer) {
        scrollContainer.scrollTop += pixelsPerSecond * delta;

        // Auto scene selection based on scroll progress
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScroll > 0) {
          const progress = scrollContainer.scrollTop / maxScroll;
          const nextScene = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
          setActiveScene(nextScene);

          // If reached bottom, loop or stop
          if (scrollContainer.scrollTop >= maxScroll - 2) {
            setIsPlaying(false);
          }
        }
      }

      if (isPlaying) {
        animFrame = requestAnimationFrame(step);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, speed, scenes.length]);

  const handleReset = () => {
    setIsPlaying(false);
    setActiveScene(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const jumpToScene = (idx: number) => {
    setActiveScene(idx);
    if (scrollRef.current) {
      const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      const targetScroll = (idx / (scenes.length - 1)) * maxScroll;
      scrollRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-xl ${
        isDark
          ? "bg-[#111114] border-[#26262B] text-white"
          : "bg-[#FFFFFF] border-[#EAE7DF] text-[#111114]"
      }`}
    >
      {/* Top Prompter Header Bar */}
      <div
        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-b ${
          isDark
            ? "bg-[#17171E] border-[#26262B]"
            : "bg-[#FAF9F6] border-[#EAE7DF]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isPlaying ? "bg-[#0F7B6C] animate-pulse" : "bg-[#9A6700]"
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight font-sans">
                {clientName}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isDark ? "bg-[#26262B] text-white/80" : "bg-[#F3F1EC] text-[#6B6A65]"
                }`}
              >
                Viral Teleprompter
              </span>
            </div>
            <p
              className={`text-[11px] font-mono tabular-nums ${
                isDark ? "text-white/60" : "text-[#6B6A65]"
              }`}
            >
              {wordCount} Words · Est. Runtime: {formattedDuration} ({speed} WPM)
            </p>
          </div>
        </div>

        {/* Speed Dial & Run Controls */}
        <div className="flex items-center gap-2.5 font-mono">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-xs ${
              isDark
                ? "bg-[#111114] border-[#26262B] text-white"
                : "bg-[#FFFFFF] border-[#EAE7DF] text-[#111114]"
            }`}
          >
            <Sliders className={`w-3.5 h-3.5 ${isDark ? "text-white/60" : "text-[#6B6A65]"}`} />
            <span className={`text-[11px] ${isDark ? "text-white/60" : "text-[#6B6A65]"}`}>
              Pace:
            </span>
            <span className="text-[11px] font-bold min-w-[58px] tabular-nums">
              {speed} WPM
            </span>
            <input
              type="range"
              min="110"
              max="180"
              step="5"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20 h-1.5 rounded appearance-none cursor-pointer accent-[#0F7B6C] bg-neutral-700"
              aria-label="Adjust Prompter Words Per Minute"
            />
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isPlaying
                ? "bg-[#9A6700] text-white hover:bg-[#7D5300]"
                : "bg-[#0F7B6C] text-white hover:bg-[#0B5C51]"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Prompter</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className={`p-1.5 rounded-lg border hover:bg-neutral-800 transition-colors ${
              isDark ? "border-[#26262B] text-white/60" : "border-[#EAE7DF] text-[#6B6A65] hover:bg-[#F3F1EC]"
            }`}
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prompter Visual Body */}
      <div className="relative p-6">
        {/* Eye-level Reading Guide Overlay */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-between px-4">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0F7B6C]/20 border border-[#0F7B6C]/40 text-[#0F7B6C] text-[10px] font-mono backdrop-blur-xs">
            <Eye className="w-3 h-3" />
            <span>Eyeline Anchor</span>
          </div>
          <div className="h-[1px] flex-1 mx-3 border-b border-dashed border-[#0F7B6C]/30" />
          <span className="text-[10px] font-mono text-[#0F7B6C]">Talent View</span>
        </div>

        {/* Scene Selector Pills */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-4 relative z-20">
          {scenes.map((scene, idx) => (
            <button
              key={scene.marker}
              onClick={() => jumpToScene(idx)}
              className={`px-3 py-1 rounded-full text-[11px] font-mono transition-all cursor-pointer whitespace-nowrap ${
                activeScene === idx
                  ? isDark
                    ? "bg-white text-[#111114] font-semibold shadow-xs"
                    : "bg-[#111114] text-white font-semibold shadow-xs"
                  : isDark
                  ? "bg-[#17171E] text-white/60 hover:bg-[#26262B]"
                  : "bg-[#FAF9F6] text-[#6B6A65] border border-[#EAE7DF] hover:bg-[#F3F1EC]"
              }`}
            >
              Scene {idx + 1}
            </button>
          ))}
        </div>

        {/* Scrolling Script Viewport */}
        <div
          ref={scrollRef}
          className="h-56 overflow-y-auto px-4 py-8 space-y-12 text-center scroll-smooth relative z-0 select-none"
        >
          {scenes.map((scene, idx) => (
            <div
              key={scene.marker}
              className={`transition-opacity duration-300 ${
                activeScene === idx ? "opacity-100 scale-100" : "opacity-40 scale-95"
              }`}
            >
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold mb-3 ${
                  isDark
                    ? "bg-[#26262B] text-amber-300"
                    : "bg-[#FBF3DB] text-[#9A6700]"
                }`}
              >
                {scene.marker} · {scene.cue}
              </span>
              <p
                className={`text-xl sm:text-2xl font-medium leading-relaxed tracking-tight max-w-xl mx-auto ${
                  isDark ? "text-white" : "text-[#111114]"
                }`}
              >
                &quot;{scene.copy}&quot;
              </p>
            </div>
          ))}
        </div>

        {/* Director Cues Footer */}
        <div
          className={`mt-4 p-3.5 rounded-xl border text-left text-xs space-y-1 max-w-xl mx-auto shadow-xs ${
            isDark
              ? "bg-[#17171E] border-[#26262B] text-white/80"
              : "bg-[#FAF9F6] border-[#EAE7DF] text-[#6B6A65]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5 text-[11px] font-sans text-emerald-600 dark:text-emerald-400">
              <Film className="w-3.5 h-3.5" />
              Director Note & Compliance Check:
            </span>
            <span className="text-[10px] font-mono opacity-60">Scene {activeScene + 1} of 4</span>
          </div>
          <p className="text-[11px] leading-relaxed font-sans">
            {scenes[activeScene].directorNote}
          </p>
        </div>
      </div>
    </div>
  );
}
