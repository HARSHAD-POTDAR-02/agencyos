"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Compass, Laptop, Building2, CornerDownLeft, X } from "lucide-react";

export interface CommandItem {
  id: string;
  category: "10-Stage Index" | "Workspace Views" | "Client Fleet";
  title: string;
  subtitle: string;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspaceTab?: (tab: string) => void;
  onSelectClient?: (client: "one8" | "kaya") => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectWorkspaceTab,
  onSelectClient,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          window.dispatchEvent(new CustomEvent("agencyos:open-command-palette"));
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: "stage-02",
      category: "10-Stage Index",
      title: "02 · Flagship Workspace",
      subtitle: "One system across the agency — interactive 5-tier preview",
      badge: "Stage 02",
      action: () => {
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-03",
      category: "10-Stage Index",
      title: "03 · Fragmented Chaos vs. Deterministic System",
      subtitle: "The operational problem AgencyOS eliminates",
      badge: "Stage 03",
      action: () => {
        document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-04",
      category: "10-Stage Index",
      title: "04 · Cortex — Proofreader Canvas",
      subtitle: "Brand intelligence, negative taboos, PDF provenance, red-ink diff",
      badge: "Stage 04",
      action: () => {
        document.getElementById("cortex")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-05",
      category: "10-Stage Index",
      title: "05 · Campaign Intelligence",
      subtitle: "Six specialist agents collaborating from brief to delivery",
      badge: "Stage 05",
      action: () => {
        document.getElementById("intelligence")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-06",
      category: "10-Stage Index",
      title: "06 · Darkroom Production Suite",
      subtitle: "Video production, live auto-scroll teleprompter, WPM speed dial",
      badge: "Stage 06",
      action: () => {
        document.getElementById("darkroom")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-07",
      category: "10-Stage Index",
      title: "07 · Daily Operations",
      subtitle: "DAG execution, OAuth monitoring, community CRM and RBAC",
      badge: "Stage 07",
      action: () => {
        document.getElementById("operations")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-08",
      category: "10-Stage Index",
      title: "08 · Pocket Sign-Off Studio",
      subtitle: "Mobile Magic-Link approval interface and WebSocket receipts",
      badge: "Stage 08",
      action: () => {
        document.getElementById("signoff")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "stage-09",
      category: "10-Stage Index",
      title: "09 · Publishing & Economics",
      subtitle: "Omnichannel calendar, analytics, credits, and margin ledger",
      badge: "Stage 09",
      action: () => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-cortex",
      category: "Workspace Views",
      title: "Open Cortex Memory in Workspace",
      subtitle: "Inspect taboo enforcement and review queue inside Stage 02",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("cortex");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-studio",
      category: "Workspace Views",
      title: "Open Campaign Studio in Workspace",
      subtitle: "Inspect multi-agent deliverables and carousel proofs",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("studio");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-inbox",
      category: "Workspace Views",
      title: "Open Community Inbox in Workspace",
      subtitle: "Inspect Instagram high-intent buyer triage (94/100)",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("inbox");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "client-one8",
      category: "Client Fleet",
      title: "Switch Client to One8 Commune",
      subtitle: "Hospitality & Dining — candlelit amber moodboard & menu rules",
      badge: "Hospitality",
      action: () => {
        onSelectClient?.("one8");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "client-kaya",
      category: "Client Fleet",
      title: "Switch Client to Kaya Botanics",
      subtitle: "D2C Clean Skincare — travertine stone moodboard & eco packaging",
      badge: "D2C Skincare",
      action: () => {
        onSelectClient?.("kaya");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
  ], [onClose, onSelectWorkspaceTab, onSelectClient]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.subtitle.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        (c.badge && c.badge.toLowerCase().includes(lower))
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-[#111114]/45 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#FFFFFF] rounded-xl border border-[#EAE7DF] shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-[#EAE7DF] gap-3 bg-[#FAF9F6]">
          <Search className="w-4 h-4 text-[#8C8A84] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to stage, workspace screen, or client brand..."
            className="w-full text-sm font-sans bg-transparent text-[#111114] placeholder-[#8C8A84] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-[#8C8A84] hover:text-[#111114] p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono text-[#8C8A84] bg-[#FFFFFF] border border-[#EAE7DF] rounded">
              ESC
            </kbd>
          )}
        </div>

        <div className="overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs font-sans text-[#8C8A84]">
              No matching destinations found for &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((command, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={command.id}
                  onClick={() => command.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected ? "bg-[#111114] text-[#FFFFFF]" : "text-[#111114] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-white/10 text-white" : "bg-[#FAF9F6] border border-[#EAE7DF] text-[#6B6A65]"
                      }`}
                    >
                      {command.category === "10-Stage Index" && <Compass className="w-3.5 h-3.5" />}
                      {command.category === "Workspace Views" && <Laptop className="w-3.5 h-3.5" />}
                      {command.category === "Client Fleet" && <Building2 className="w-3.5 h-3.5" />}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium font-sans truncate">{command.title}</div>
                      <div
                        className={`text-[11px] truncate ${
                          isSelected ? "text-white/70" : "text-[#6B6A65]"
                        }`}
                      >
                        {command.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {command.badge && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                          isSelected
                            ? "bg-white/15 text-white"
                            : "bg-[#F3F1EC] text-[#6B6A65] border border-[#EAE7DF]"
                        }`}
                      >
                        {command.badge}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/80" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#EAE7DF] bg-[#FAF9F6] flex items-center justify-between text-[11px] font-sans text-[#8C8A84]">
          <div className="flex items-center gap-2">
            <span>Navigate:</span>
            <span className="font-mono bg-[#FFFFFF] px-1 py-0.5 rounded border border-[#EAE7DF]">↑</span>
            <span className="font-mono bg-[#FFFFFF] px-1 py-0.5 rounded border border-[#EAE7DF]">↓</span>
            <span>Open:</span>
            <span className="font-mono bg-[#FFFFFF] px-1.5 py-0.5 rounded border border-[#EAE7DF]">↵</span>
          </div>
          <span className="font-mono text-[10px]">AgencyOS Editorial Index</span>
        </div>
      </div>
    </div>
  );
}
