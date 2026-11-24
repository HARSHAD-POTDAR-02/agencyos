"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { token, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !isLoading && Boolean(token);

  return (
    <header className="sticky top-0 z-50 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[rgba(55,53,47,0.08)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#111114] flex items-center justify-center text-white font-mono text-sm font-bold shadow-xs transition-transform group-hover:scale-105">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight text-[#111114] leading-tight">
                AgencyOS
              </span>
              <span className="text-[10px] font-mono text-[#6B6A65] tracking-wide uppercase">
                by Brieva
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#6B6A65]">
            <a href="#preview" className="hover:text-[#111114] transition-colors">
              Interactive Preview
            </a>
            <a href="#differentiators" className="hover:text-[#111114] transition-colors">
              Core Differentiators
            </a>
            <a href="#operations" className="hover:text-[#111114] transition-colors">
              Daily Operations
            </a>
            <a href="#pricing" className="hover:text-[#111114] transition-colors">
              Pricing & Credits
            </a>
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B6A65] hover:text-[#111114] hover:bg-[#F1F1EF] transition-colors"
          >
            Sign In
          </Link>

          <Link
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-[#111114] text-white hover:bg-[#2F2E2B] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>{isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md text-[#6B6A65] hover:text-[#111114] hover:bg-[#F1F1EF] transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-[rgba(55,53,47,0.08)] bg-[#FAF9F6] px-4 pt-2 pb-4 space-y-2 text-xs font-medium text-[#6B6A65]">
          <a
            href="#preview"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[#111114]"
          >
            Interactive Preview
          </a>
          <a
            href="#differentiators"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[#111114]"
          >
            Core Differentiators
          </a>
          <a
            href="#operations"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[#111114]"
          >
            Daily Operations
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[#111114]"
          >
            Pricing & Credits
          </a>
          <div className="pt-3 border-t border-[rgba(55,53,47,0.08)] flex flex-col gap-2">
            <Link
              href="/login"
              className="py-2 text-center text-xs font-medium text-[#6B6A65] hover:text-[#111114]"
            >
              Sign In
            </Link>
            <Link
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="py-2 rounded-full text-xs font-medium bg-[#111114] text-white text-center shadow-xs"
            >
              {isAuthenticated ? "Open Dashboard" : "Start Agency Workspace"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
