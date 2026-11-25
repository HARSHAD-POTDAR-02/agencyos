"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, Command } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NavbarProps {
  onOpenCommandPalette?: () => void;
}

export function Navbar({ onOpenCommandPalette }: NavbarProps) {
  const { token, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !isLoading && Boolean(token);

  const triggerPalette = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      window.dispatchEvent(new CustomEvent("agencyos:open-command-palette"));
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/92 backdrop-blur-md border-b border-[#EAE7DF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-md bg-[#111114] flex items-center justify-center text-white font-mono text-sm font-bold transition-transform group-hover:scale-105">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-base tracking-tight text-[#111114] leading-tight">
                AgencyOS
              </span>
              <span className="text-[10px] font-mono text-[#6B6A65] tracking-wider uppercase">
                by Brieva
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#6B6A65]">
            <a href="#preview" className="hover:text-[#111114] transition-colors">
              Workspace
            </a>
            <a href="#intelligence" className="hover:text-[#111114] transition-colors">
              6-Agent Swarm
            </a>
            <a href="#cortex" className="hover:text-[#111114] transition-colors">
              Brand & Sign-Off
            </a>
            <a href="#operations" className="hover:text-[#111114] transition-colors">
              Operations
            </a>
            <a href="#pricing" className="hover:text-[#111114] transition-colors">
              Economics
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={triggerPalette}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#EAE7DF] bg-[#FFFFFF] hover:bg-[#F3F1EC] text-[#6B6A65] hover:text-[#111114] transition-all text-xs font-medium"
            title="Open Index (⌘K or Ctrl+K)"
          >
            <Command className="w-3.5 h-3.5 text-[#8C8A84]" />
            <span className="font-sans text-[11px] text-[#8C8A84]">Index</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#FAF9F6] border border-[#EAE7DF] rounded text-[#8C8A84]">
              ⌘K
            </kbd>
          </button>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[#6B6A65] hover:text-[#111114] hover:bg-[#F3F1EC] transition-colors font-sans"
            >
              Sign In
            </Link>

            <Link
              href="/waitlist"
              className="px-4 py-2 rounded-full text-xs font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all flex items-center gap-1.5 font-sans"
            >
              <span>Join Waitlist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-[#6B6A65] hover:text-[#111114] hover:bg-[#F3F1EC] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#EAE7DF] bg-[#FAF9F6] px-4 pt-2 pb-4 space-y-2 text-xs font-medium text-[#6B6A65]">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              triggerPalette();
            }}
            className="w-full flex items-center justify-between py-2 text-left hover:text-[#111114] font-sans"
          >
            <span>Open Stage Index</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#FFFFFF] border border-[#EAE7DF] rounded text-[#8C8A84]">
              ⌘K
            </kbd>
          </button>
          <a href="#preview" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#111114]">
            Workspace
          </a>
          <a href="#intelligence" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#111114]">
            6-Agent Swarm
          </a>
          <a href="#cortex" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#111114]">
            Brand & Sign-Off
          </a>
          <a href="#operations" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#111114]">
            Operations
          </a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 hover:text-[#111114]">
            Economics
          </a>
          <div className="pt-3 border-t border-[#EAE7DF] flex flex-col gap-2">
            <Link href="/login" className="py-2 text-center text-xs font-medium text-[#6B6A65] hover:text-[#111114]">
              Sign In
            </Link>
            <Link
              href="/waitlist"
              className="py-2 rounded-full text-xs font-medium bg-[#111114] text-white text-center"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
