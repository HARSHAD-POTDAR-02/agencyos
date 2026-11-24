"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Compass, Laptop, Building2, ArrowRight, CornerDownLeft, X } from "lucide-react";

export interface CommandItem {
  id: string;
  category: "Navigation" | "Workspace Views" | "Client Fleet";
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
          // Trigger open via custom event if not controlled
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
      id: "nav-preview",
      category: "Navigation",
      title: "Interactive Workspace Preview",
      subtitle: "Jump to Section 3 live software window",
      badge: "Section 3",
      action: () => {
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "nav-cortex",
      category: "Navigation",
      title: "Cortex Living Brand Vault",
      subtitle: "Deterministic taboo and rule enforcement showcase",
      badge: "Showcase 1",
      action: () => {
        const el = document.getElementById("cortex-vault");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "nav-approvals",
      category: "Navigation",
      title: "Magic-Link Review Rooms",
      subtitle: "Mobile client sign-off with real-time WebSocket toast",
      badge: "Showcase 2",
      action: () => {
        const el = document.getElementById("review-room");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "nav-teleprompter",
      category: "Navigation",
      title: "Viral Teleprompter Studio",
      subtitle: "Dark studio viewport with live auto-scroll WPM speed dial",
      badge: "Showcase 3",
      action: () => {
        const el = document.getElementById("teleprompter");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "nav-operations",
      category: "Navigation",
      title: "Daily Operations Bento",
      subtitle: "Calendar, Community CRM, and Dependency-Locked Pipeline",
      badge: "Section 6",
      action: () => {
        const el = document.getElementById("operations");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "nav-pricing",
      category: "Navigation",
      title: "Pricing & Retainer Margin Calculator",
      subtitle: "Interactive retainer slider and credit economics",
      badge: "Section 7",
      action: () => {
        const el = document.getElementById("pricing");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-cortex",
      category: "Workspace Views",
      title: "Cortex Memory & Rules",
      subtitle: "Inspect taboo enforcement and review queue in Section 3",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("cortex");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-studio",
      category: "Workspace Views",
      title: "Campaign Studio & 6 Agents",
      subtitle: "Inspect multi-agent collaboration and deliverables",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("studio");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-calendar",
      category: "Workspace Views",
      title: "Content Calendar & Publishing",
      subtitle: "View omnichannel weekly schedule and token health",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("calendar");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-inbox",
      category: "Workspace Views",
      title: "Community Inbox & CRM",
      subtitle: "View Instagram high-intent buyer triage (94/100)",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("inbox");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "view-billing",
      category: "Workspace Views",
      title: "Billing & Credit Meter",
      subtitle: "Inspect 38k/50k meter and transparent credit tasks",
      badge: "Workspace",
      action: () => {
        onSelectWorkspaceTab?.("billing");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "client-one8",
      category: "Client Fleet",
      title: "Switch Client to One8 Commune",
      subtitle: "Hospitality & Dining: Taboo-01 health claims and signature menu",
      badge: "Hospitality",
      action: () => {
        onSelectClient?.("one8");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
        onClose();
      },
    },
    {
      id: "client-kaya",
      category: "Client Fleet",
      title: "Switch Client to Kaya Botanics",
      subtitle: "D2C Organic Skincare: Eco packaging rules and clean aesthetic",
      badge: "D2C Wellness",
      action: () => {
        onSelectClient?.("kaya");
        const el = document.getElementById("preview");
        el?.scrollIntoView({ behavior: "smooth" });
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-[#111114]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#FFFFFF] rounded-2xl border border-[#EAE7DF] shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#EAE7DF] gap-3 bg-[#FAF9F6]">
          <Search className="w-4 h-4 text-[#8C8A84] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a section, workspace screen, or client name..."
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

        {/* Command List */}
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-[#111114] text-[#FFFFFF]" : "text-[#111114] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-white/10 text-white" : "bg-[#FAF9F6] border border-[#EAE7DF] text-[#6B6A65]"
                      }`}
                    >
                      {command.category === "Navigation" && <Compass className="w-3.5 h-3.5" />}
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

        {/* Footer Guidance */}
        <div className="px-4 py-2 border-t border-[#EAE7DF] bg-[#FAF9F6] flex items-center justify-between text-[11px] font-sans text-[#8C8A84]">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <span className="font-mono bg-[#FFFFFF] px-1 py-0.5 rounded border border-[#EAE7DF]">↑</span>
            <span className="font-mono bg-[#FFFFFF] px-1 py-0.5 rounded border border-[#EAE7DF]">↓</span>
            <span>Select:</span>
            <span className="font-mono bg-[#FFFFFF] px-1.5 py-0.5 rounded border border-[#EAE7DF]">↵</span>
          </div>
          <span className="font-mono text-[10px]">AgencyOS Command Palette</span>
        </div>
      </div>
    </div>
  );
}
