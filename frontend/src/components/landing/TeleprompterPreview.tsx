"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Sliders, RotateCcw, Eye, Film } from "lucide-react";

export type TeleprompterClientKey = "solis" | "linden" | "cairn";

interface SceneItem {
  marker: string;
  cue: string;
  copy: string;
  directorNote: string;
}

interface ClientScriptPreset {
  clientName: string;
  reelTitle: string;
  wordCount: number;
  scenes: SceneItem[];
}

const SCRIPT_PRESETS: Record<TeleprompterClientKey, ClientScriptPreset> = {
  solis: {
    clientName: "Osteria Solis",
    reelTitle: "Winter Truffle Tasting Reel (60s Short-Form)",
    wordCount: 138,
    scenes: [
      {
        marker: "Scene 1 · [00:00 - 00:12]",
        cue: "Visual Hook & Entrance",
        copy: "This is what happens when you shave black winter truffles directly over handmade burrata gnocchi.",
        directorNote: "Elena (Video Producer): Hold eye contact on the word 'burrata'. Cut to tabletop slow-mo shaving at second 3.",
      },
      {
        marker: "Scene 2 · [00:13 - 00:28]",
        cue: "Sensory Detail & Kitchen Atmosphere",
        copy: "Our executive chef simmered this reduction for forty-eight hours with cultured Normandy butter and fresh mountain thyme.",
        directorNote: "Pan across the wood-fired hearth copper pans. Keep speaking cadence warm and unhurried.",
      },
      {
        marker: "Scene 3 · [00:29 - 00:46]",
        cue: "Limited Harvest & Signature Rule",
        copy: "We only prepare thirty portions every Friday evening. Once the kitchen clears the nightly harvest, it is gone until next week.",
        directorNote: "Enforces RULE-04: Never mention markdowns or discounts. Emphasize culinary rarity and seasonal allocation.",
      },
      {
        marker: "Scene 4 · [00:47 - 00:58]",
        cue: "Call to Action",
        copy: "Reserve your tasting table through the link in our bio before Friday seating closes out.",
        directorNote: "Direct gesture to the camera lens, warm smile, fade to Osteria Solis closing emblem.",
      },
    ],
  },
  linden: {
    clientName: "Linden & Clay",
    reelTitle: "Botanical Elixir Morning Ritual (60s Reel)",
    wordCount: 126,
    scenes: [
      {
        marker: "Scene 1 · [00:00 - 00:10]",
        cue: "Morning Light Visual Hook",
        copy: "Three drops on damp linen-toweled skin is the entire morning routine we spent two years formulating.",
        directorNote: "Marco (Director): Macro shot of single amber glass pipette drop against travertine sunlight.",
      },
      {
        marker: "Scene 2 · [00:11 - 00:26]",
        cue: "Botanical Texture & Craft",
        copy: "Cold-pressed squalane paired with wild rosemary distillate sinks cleanly into the moisture barrier without any heavy residue.",
        directorNote: "Enforces TABOO-02: Zero comparison against synthetic chemicals. Keep tone serene and educational.",
      },
      {
        marker: "Scene 3 · [00:27 - 00:44]",
        cue: "Packaging & Provenance",
        copy: "Every bottle is poured in small batches into 100 percent recyclable amber glass to protect delicate active botanicals.",
        directorNote: "Enforces RULE-05: Recyclable amber glass sustainability callout is mandatory for all launch reels.",
      },
      {
        marker: "Scene 4 · [00:45 - 00:56]",
        cue: "Call to Action",
        copy: "Explore Batch 09 in our digital apothecary via the link below while the spring press remains open.",
        directorNote: "Slow pan to unlabelled stoneware dish and fresh rosemary sprig; hold 2 seconds on closing slate.",
      },
    ],
  },
  cairn: {
    clientName: "Cairn Roasters",
    reelTitle: "Single-Origin Pour-Over Dial-In (55s Reel)",
    wordCount: 132,
    scenes: [
      {
        marker: "Scene 1 · [00:00 - 00:11]",
        cue: "Acoustic Bloom Hook",
        copy: "Listen closely to the first twenty seconds of a fresh anaerobic roast hitting ninety-three-degree spring water.",
        directorNote: "Hold boom mic near ceramic dripper during bloom; sharp audio cut to walnut bar overhead.",
      },
      {
        marker: "Scene 2 · [00:12 - 00:27]",
        cue: "Origin & Altitude Story",
        copy: "Grown at nineteen hundred meters by a three-family cooperative, this lot finishes with candied bergamot and dark cacao.",
        directorNote: "Superimpose harvest elevation coordinates cleanly in lower third safe area.",
      },
      {
        marker: "Scene 3 · [00:28 - 00:42]",
        cue: "Roast Date Standard",
        copy: "Every subscription bag ships within forty-eight hours of resting so your home bar pours at peak crema clarity.",
        directorNote: "Enforces RULE-03: Stamp exact roast date visibly on frame; never promise generic shelf-life windows.",
      },
      {
        marker: "Scene 4 · [00:43 - 00:55]",
        cue: "Call to Action",
        copy: "Lock your bi-weekly micro-lot cadence at Cairn Roasters before Thursday's drum schedule closes.",
        directorNote: "Natural smile to lens while lifting matte black espresso cup; fade on steady steam plume.",
      },
    ],
  },
};

interface TeleprompterProps {
  clientKey?: TeleprompterClientKey;
  clientName?: string;
  reelTitle?: string;
  wordCount?: number;
  theme?: "light" | "dark";
  compact?: boolean;
}

export function TeleprompterPreview({
  clientKey = "solis",
  clientName,
  reelTitle,
  wordCount,
  theme = "light",
  compact = false,
}: TeleprompterProps) {
  const preset = SCRIPT_PRESETS[clientKey] ?? SCRIPT_PRESETS.solis;
  const displayClient = clientName ?? preset.clientName;
  const displayTitle = reelTitle ?? preset.reelTitle;
  const displayWords = wordCount ?? preset.wordCount;
  const scenes = preset.scenes;

  const [speed, setSpeed] = useState<number>(140);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeScene, setActiveScene] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset active scene and scroll position cleanly whenever the client switches
  useEffect(() => {
    setIsPlaying(false);
    setActiveScene(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    }
  }, [clientKey]);

  const totalSeconds = Math.round((displayWords / speed) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedDuration = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isDark = theme === "dark";

  // Live Auto-Scroll Engine driven by WPM speed
  useEffect(() => {
    let animFrame: number;
    let lastTime = performance.now();

    const scrollContainer = scrollRef.current;
    if (!scrollContainer || !isPlaying) return;

    const step = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const pixelsPerSecond = (speed / 140) * 38;
      if (scrollContainer) {
        scrollContainer.scrollTop += pixelsPerSecond * delta;

        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScroll > 0) {
          const progress = scrollContainer.scrollTop / maxScroll;
          const nextScene = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
          setActiveScene(nextScene);

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
      const targetScroll = (idx / Math.max(1, scenes.length - 1)) * maxScroll;
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
              <span className="font-heading font-semibold tracking-tight">
                {displayClient}
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
              {displayTitle} · {displayWords} Words · Est. {formattedDuration} ({speed} WPM)
            </p>
          </div>
        </div>

        {/* Speed Dial & Run Controls */}
        <div className="flex items-center gap-2 font-mono">
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
              className="w-20 h-1.5 rounded appearance-none cursor-pointer accent-[#0F7B6C] bg-neutral-400/40"
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
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? "border-[#26262B] text-white/60 hover:bg-[#26262B] hover:text-white"
                : "border-[#EAE7DF] text-[#6B6A65] hover:bg-[#F3F1EC] hover:text-[#111114]"
            }`}
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prompter Visual Body */}
      <div className={compact ? "relative p-3.5 sm:p-4" : "relative p-4 sm:p-6"}>
        {/* Scene Selector Pills */}
        <div className={`flex items-center justify-center gap-1.5 overflow-x-auto relative z-20 ${compact ? "pb-2.5" : "pb-4"}`}>
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

        {/* Scrolling Script Viewport with Margin-Pinned Eyeline Reticle & Top/Bottom Fade Scrims */}
        <div className="relative">
          {/* Outer Margin Eyeline Reticles (Pinned to left/right gutters so text never collides) */}
          {!compact && (
            <div className="hidden md:flex items-center justify-between absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none z-10 px-2">
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border ${
                  isDark
                    ? "bg-[#17171E]/90 border-[#0F7B6C]/40 text-emerald-400"
                    : "bg-[#FAF9F6]/90 border-[#0F7B6C]/30 text-[#0F7B6C]"
                }`}
              >
                <Eye className="w-2.5 h-2.5" />
                <span>EYELINE</span>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                  isDark
                    ? "bg-[#17171E]/90 border-[#26262B] text-white/60"
                    : "bg-[#FAF9F6]/90 border-[#EAE7DF] text-[#6B6A65]"
                }`}
              >
                9:16 CAM
              </div>
            </div>
          )}

          {/* Top & Bottom Fade Scrims */}
          <div
            className={`pointer-events-none absolute top-0 left-0 right-0 ${compact ? "h-6" : "h-10"} z-10 bg-gradient-to-b ${
              isDark ? "from-[#111114] to-transparent" : "from-[#FFFFFF] to-transparent"
            }`}
          />
          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 ${compact ? "h-6" : "h-10"} z-10 bg-gradient-to-t ${
              isDark ? "from-[#111114] to-transparent" : "from-[#FFFFFF] to-transparent"
            }`}
          />

          <div
            ref={scrollRef}
            className={`${compact ? "h-36 px-3 py-5 space-y-6" : "h-56 px-4 md:px-24 py-10 space-y-12"} overflow-y-auto text-center scroll-smooth relative z-0 select-none`}
          >
            {scenes.map((scene, idx) => (
              <div
                key={scene.marker}
                className={`transition-all duration-300 ${
                  activeScene === idx ? "opacity-100 scale-100" : "opacity-40 scale-95"
                }`}
              >
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold ${compact ? "mb-1.5" : "mb-3"} tabular-nums ${
                    isDark
                      ? "bg-[#26262B] text-amber-300"
                      : "bg-[#FBF3DB] text-[#9A6700]"
                  }`}
                >
                  {scene.marker} · {scene.cue}
                </span>
                <p
                  className={`${compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl"} font-medium leading-relaxed tracking-tight max-w-xl mx-auto ${
                    isDark ? "text-white" : "text-[#111114]"
                  }`}
                >
                  &quot;{scene.copy}&quot;
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Director Cues Footer (Explicit isDark styles, zero dark: bleed) */}
        <div
          className={`mt-4 p-3.5 rounded-xl border text-left text-xs space-y-1 max-w-xl mx-auto shadow-xs ${
            isDark
              ? "bg-[#17171E] border-[#26262B] text-white/80"
              : "bg-[#FAF9F6] border-[#EAE7DF] text-[#6B6A65]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-semibold flex items-center gap-1.5 text-[11px] font-sans ${
                isDark ? "text-emerald-400" : "text-[#0F7B6C]"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Director Note & Compliance Check:
            </span>
            <span className="text-[10px] font-mono opacity-65 tabular-nums">
              Scene {activeScene + 1} of {scenes.length}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed font-sans">
            {scenes[activeScene].directorNote}
          </p>
        </div>
      </div>
    </div>
  );
}
