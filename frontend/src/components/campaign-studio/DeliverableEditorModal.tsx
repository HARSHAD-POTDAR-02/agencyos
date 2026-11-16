"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Video,
  Layers2,
  Clock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Check,
  Film,
  Type,
  Volume2,
  AlertCircle,
  Wand2,
  MessageSquare,
} from "lucide-react";
import { campaignApi } from "@/lib/api";

export interface ReelSceneItem {
  scene_number: number;
  timestamp_range: string;
  visual_action: string;
  on_screen_text?: string;
  spoken_audio_or_voiceover?: string;
  b_roll_notes?: string;
  shot_type?: string;
  audio_sfx_cue?: string;
}

export interface CarouselSlideItem {
  slide_number: number;
  headline: string;
  body_copy: string;
  visual_layout: string;
  slide_type: "cover" | "content" | "takeaway" | "cta";
}

export interface DeliverableItem {
  day_number: number;
  scheduled_date?: string;
  date_label?: string;
  title?: string;
  deliverable_type: string;
  platform: string;
  pillar?: string;
  hook?: string;
  primary_hook?: string;
  visual_concept?: string;
  caption?: string;
  cta?: string;
  call_to_action?: string;
  audio_vibe?: string;
  hashtags?: string[];
  hook_options?: string[];
  production_notes?: string;
  reel_scenes?: ReelSceneItem[];
  carousel_slides?: CarouselSlideItem[];
}

interface DeliverableEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverable: DeliverableItem | null;
  campaignId: string;
  clientId: string;
  agencyId: string;
  token: string;
  onDeliverableUpdated: (updated: DeliverableItem) => void;
}

export function DeliverableEditorModal({
  isOpen,
  onClose,
  deliverable,
  campaignId,
  clientId,
  agencyId,
  token,
  onDeliverableUpdated,
}: DeliverableEditorModalProps) {
  const [current, setCurrent] = useState<DeliverableItem | null>(null);
  const [history, setHistory] = useState<DeliverableItem[]>([]);
  const [aiInstruction, setAiInstruction] = useState("");
  const [isRevisingAI, setIsRevisingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize editable state when deliverable opens
  useEffect(() => {
    if (deliverable) {
      // Normalize deliverable fields
      const normalized: DeliverableItem = {
        ...deliverable,
        title: deliverable.title || `Day ${deliverable.day_number} Deliverable`,
        hook: deliverable.primary_hook || deliverable.hook || "",
        primary_hook: deliverable.primary_hook || deliverable.hook || "",
        caption: deliverable.caption || "",
        cta: deliverable.call_to_action || deliverable.cta || "",
        call_to_action: deliverable.call_to_action || deliverable.cta || "",
        reel_scenes: deliverable.reel_scenes ? JSON.parse(JSON.stringify(deliverable.reel_scenes)) : [],
        carousel_slides: deliverable.carousel_slides ? JSON.parse(JSON.stringify(deliverable.carousel_slides)) : [],
      };
      setCurrent(normalized);
      setHistory([]);
      setAiInstruction("");
      setAiExplanation(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [deliverable]);

  if (!isOpen || !current) return null;

  const isReel = current.deliverable_type.toLowerCase().includes("reel") || current.deliverable_type.toLowerCase().includes("video");
  const isCarousel = current.deliverable_type.toLowerCase().includes("carousel");

  // Push snapshot to undo history before applying change
  const pushHistory = (stateToSave: DeliverableItem) => {
    setHistory((prev) => [...prev.slice(-4), JSON.parse(JSON.stringify(stateToSave))]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setCurrent(last);
    setAiExplanation("Reverted to previous revision.");
  };

  // ── Manual Scene Editing Handlers ──
  const handleSceneChange = (idx: number, field: keyof ReelSceneItem, value: any) => {
    if (!current.reel_scenes) return;
    const updatedScenes = [...current.reel_scenes];
    updatedScenes[idx] = { ...updatedScenes[idx], [field]: value };
    setCurrent({ ...current, reel_scenes: updatedScenes });
  };

  const handleAddScene = () => {
    const scenes = current.reel_scenes || [];
    const nextNum = scenes.length + 1;
    const newScene: ReelSceneItem = {
      scene_number: nextNum,
      timestamp_range: `0:${String((nextNum - 1) * 8).padStart(2, "0")} - 0:${String(nextNum * 8).padStart(2, "0")}`,
      visual_action: "Camera focuses on hero subject with dynamic movement.",
      on_screen_text: "Key Highlight",
      spoken_audio_or_voiceover: "Authentic experience crafted to perfection.",
      shot_type: "Medium Shot",
    };
    pushHistory(current);
    setCurrent({ ...current, reel_scenes: [...scenes, newScene] });
  };

  const handleDeleteScene = (idx: number) => {
    if (!current.reel_scenes || current.reel_scenes.length <= 1) return;
    pushHistory(current);
    const updated = current.reel_scenes
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, scene_number: i + 1 }));
    setCurrent({ ...current, reel_scenes: updated });
  };

  // ── Manual Slide Editing Handlers ──
  const handleSlideChange = (idx: number, field: keyof CarouselSlideItem, value: any) => {
    if (!current.carousel_slides) return;
    const updatedSlides = [...current.carousel_slides];
    updatedSlides[idx] = { ...updatedSlides[idx], [field]: value };
    setCurrent({ ...current, carousel_slides: updatedSlides });
  };

  const handleAddSlide = () => {
    const slides = current.carousel_slides || [];
    const nextNum = slides.length + 1;
    const newSlide: CarouselSlideItem = {
      slide_number: nextNum,
      headline: `Step ${nextNum}: Core Takeaway`,
      body_copy: "Engaging insight backed by real results and clear execution.",
      visual_layout: "Clean typography with supporting graphic",
      slide_type: "content",
    };
    pushHistory(current);
    setCurrent({ ...current, carousel_slides: [...slides, newSlide] });
  };

  const handleDeleteSlide = (idx: number) => {
    if (!current.carousel_slides || current.carousel_slides.length <= 1) return;
    pushHistory(current);
    const updated = current.carousel_slides
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, slide_number: i + 1 }));
    setCurrent({ ...current, carousel_slides: updated });
  };

  // ── AI Revision Handler ──
  const handleReviseAI = async (customText?: string) => {
    const instructionToSend = (customText || aiInstruction).trim();
    if (!instructionToSend || isRevisingAI) return;

    setIsRevisingAI(true);
    setErrorMsg(null);
    setAiExplanation(null);

    try {
      pushHistory(current);
      const res = await campaignApi.reviseDeliverableAI(
        agencyId,
        clientId,
        campaignId,
        current.day_number,
        {
          instruction: instructionToSend,
          current_deliverable: current as Record<string, unknown>,
        },
        token
      );

      const revised = res.revised_deliverable as DeliverableItem;
      setCurrent({
        ...current,
        title: revised.title || current.title,
        hook: revised.primary_hook || revised.hook || current.hook,
        primary_hook: revised.primary_hook || revised.hook || current.primary_hook,
        caption: revised.caption || current.caption,
        cta: revised.call_to_action || revised.cta || current.cta,
        call_to_action: revised.call_to_action || revised.cta || current.call_to_action,
        reel_scenes: revised.reel_scenes || current.reel_scenes,
        carousel_slides: revised.carousel_slides || current.carousel_slides,
      });

      setAiExplanation(res.explanation || "Surgically updated deliverable scenes based on your instruction.");
      setAiInstruction("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to revise deliverable with AI.");
    } finally {
      setIsRevisingAI(false);
    }
  };

  // ── Save Changes to Plan Handler ──
  const handleSaveToPlan = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payloadToSave = {
        ...current,
        primary_hook: current.hook || current.primary_hook,
        call_to_action: current.cta || current.call_to_action,
      };

      await campaignApi.updateDeliverable(
        agencyId,
        clientId,
        campaignId,
        current.day_number,
        { deliverable: payloadToSave as Record<string, unknown> },
        token
      );

      onDeliverableUpdated(payloadToSave);
      setSuccessMsg("Deliverable saved to campaign plan!");
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save changes to campaign plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const samplePrompts = isReel
    ? [
        "Rewrite scene 2 to focus on traditional clay oven craft",
        "Make the hook more aggressive and punchy for local foodies",
        "Adjust timing so the total reel is 30 to 45 seconds",
        "Add a behind-the-scenes chef prep scene before the reveal",
      ]
    : [
        "Make slide 2 focus on customer testimonials",
        "Sharpen the cover hook headline for higher saves",
        "Add a final takeaway CTA slide",
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[92vh] bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* ── Modal Top Header ── */}
        <div className="px-5 py-3.5 border-b border-border/60 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
              {isReel ? <Film className="w-5 h-5" /> : <Layers2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide border border-primary/20">
                  Day {current.day_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase border border-border">
                  {current.platform}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase border border-border">
                  {current.deliverable_type}
                </span>
              </div>
              <input
                type="text"
                value={current.title || ""}
                onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                className="font-bold text-sm text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-hidden px-0.5 py-0.5 mt-0.5 w-full max-w-md truncate"
                placeholder="Deliverable Title"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Undo last change"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Status Banners ── */}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Modal Body: 2-Column Split View ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Visual Scene / Content Editor (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-border/60 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Hook & Objective Card */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Opening Hook (0–3s Retention)</span>
              </label>
              <textarea
                value={current.hook || current.primary_hook || ""}
                onChange={(e) =>
                  setCurrent({
                    ...current,
                    hook: e.target.value,
                    primary_hook: e.target.value,
                  })
                }
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                placeholder="The scroll-stopping hook phrase..."
              />
            </div>

            {/* Reel Scenes Section */}
            {isReel && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-500" />
                    <h3 className="font-bold text-xs uppercase tracking-wide text-foreground">
                      Director Scene Breakdown ({current.reel_scenes?.length || 0} Scenes)
                    </h3>
                  </div>
                  <button
                    onClick={handleAddScene}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Scene</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(current.reel_scenes || []).map((scene, idx) => (
                    <div
                      key={scene.scene_number || idx}
                      className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-purple-500/40 transition-all shadow-2xs space-y-3 text-xs"
                    >
                      {/* Scene Bar */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-[10px] flex items-center justify-center border border-purple-500/30">
                            {scene.scene_number || idx + 1}
                          </span>
                          <input
                            type="text"
                            value={scene.timestamp_range}
                            onChange={(e) => handleSceneChange(idx, "timestamp_range", e.target.value)}
                            className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted/80 border border-border text-foreground w-24 text-center focus:outline-hidden focus:ring-1 focus:ring-primary"
                            placeholder="0:00 - 0:03"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={scene.shot_type || "Medium Shot"}
                            onChange={(e) => handleSceneChange(idx, "shot_type", e.target.value)}
                            className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 w-32 focus:outline-hidden"
                            placeholder="Shot Type"
                          />
                          {(current.reel_scenes?.length || 0) > 1 && (
                            <button
                              onClick={() => handleDeleteScene(idx)}
                              className="text-muted-foreground hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition-all"
                              title="Delete Scene"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual Action */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Film className="w-3 h-3 text-muted-foreground" />
                          <span>Visual Camera & Talent Action</span>
                        </label>
                        <textarea
                          value={scene.visual_action}
                          onChange={(e) => handleSceneChange(idx, "visual_action", e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 rounded-lg bg-muted/30 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                        />
                      </div>

                      {/* Text Overlay & Spoken Voiceover */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Type className="w-3 h-3 text-muted-foreground" />
                            <span>On-Screen Text Overlay</span>
                          </label>
                          <input
                            type="text"
                            value={scene.on_screen_text || ""}
                            onChange={(e) => handleSceneChange(idx, "on_screen_text", e.target.value)}
                            className="w-full text-xs p-1.5 rounded-lg bg-muted/30 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                            placeholder='e.g. "Slow Cooked for 8 Hours"'
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Volume2 className="w-3 h-3 text-muted-foreground" />
                            <span>Spoken Dialogue / Voiceover</span>
                          </label>
                          <input
                            type="text"
                            value={scene.spoken_audio_or_voiceover || ""}
                            onChange={(e) => handleSceneChange(idx, "spoken_audio_or_voiceover", e.target.value)}
                            className="w-full text-xs p-1.5 rounded-lg bg-muted/30 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                            placeholder='e.g. "Here is how we bring this feast to life..."'
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carousel Slides Section */}
            {isCarousel && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers2 className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-xs uppercase tracking-wide text-foreground">
                      Carousel Slide Deck ({current.carousel_slides?.length || 0} Slides)
                    </h3>
                  </div>
                  <button
                    onClick={handleAddSlide}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slide</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(current.carousel_slides || []).map((slide, idx) => (
                    <div
                      key={slide.slide_number || idx}
                      className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-indigo-500/40 transition-all shadow-2xs space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center border border-indigo-500/30">
                            {slide.slide_number || idx + 1}
                          </span>
                          <span>Slide {slide.slide_number || idx + 1}</span>
                        </span>
                        {(current.carousel_slides?.length || 0) > 1 && (
                          <button
                            onClick={() => handleDeleteSlide(idx)}
                            className="text-muted-foreground hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={slide.headline}
                        onChange={(e) => handleSlideChange(idx, "headline", e.target.value)}
                        className="w-full font-semibold text-xs p-1.5 rounded-lg bg-muted/40 border border-border text-foreground"
                        placeholder="Slide Headline"
                      />
                      <textarea
                        value={slide.body_copy}
                        onChange={(e) => handleSlideChange(idx, "body_copy", e.target.value)}
                        rows={2}
                        className="w-full text-xs p-2 rounded-lg bg-muted/30 border border-border text-foreground resize-none"
                        placeholder="Slide Body Copy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Caption & Call to Action */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Social Media Caption
                </label>
                <textarea
                  value={current.caption || ""}
                  onChange={(e) => setCurrent({ ...current, caption: e.target.value })}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                  placeholder="Post caption text..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Call to Action (CTA)
                </label>
                <input
                  type="text"
                  value={current.cta || current.call_to_action || ""}
                  onChange={(e) =>
                    setCurrent({
                      ...current,
                      cta: e.target.value,
                      call_to_action: e.target.value,
                    })
                  }
                  className="w-full text-xs p-2 rounded-lg bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Reserve your table via link in bio"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Content Architect Scriptwriter AI Copilot (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col bg-muted/20 p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* AI Agent Header Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-500/10 via-card to-indigo-500/10 border border-purple-500/30 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <span>Scriptwriter & Content Architect AI</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase">
                      Specialist
                    </span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Surgically revise scene beats, hooks, or timing in natural language.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Explanation / Activity Banner */}
            {aiExplanation && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-foreground space-y-1">
                <div className="font-bold text-purple-600 dark:text-purple-400 text-[11px] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Revision Summary</span>
                </div>
                <p className="leading-relaxed text-muted-foreground">{aiExplanation}</p>
              </div>
            )}

            {/* Quick Inspiration Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Quick Prompts
              </span>
              <div className="flex flex-wrap gap-1.5">
                {samplePrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleReviseAI(p)}
                    disabled={isRevisingAI}
                    className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom AI Instruction Bar */}
            <div className="space-y-2 mt-auto pt-3 border-t border-border/50">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Tell the Scriptwriter what to change</span>
              </label>
              <textarea
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                rows={3}
                disabled={isRevisingAI}
                className="w-full text-xs p-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-1 focus:ring-purple-500 leading-relaxed resize-none disabled:opacity-50"
                placeholder='e.g., "I don&apos;t like scene 2. Make it focus on slow cooking in the clay oven, extend scene 3 to 15 seconds, and make the hook bolder."'
              />

              <button
                onClick={() => handleReviseAI()}
                disabled={!aiInstruction.trim() || isRevisingAI}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isRevisingAI ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Scriptwriter is rewriting scenes...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Revise Deliverable with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            💾 Changes will only update <strong>Day {current.day_number}</strong>. All other days in this campaign stay intact.
          </p>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveToPlan}
              disabled={isSaving}
              className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to Campaign Plan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
