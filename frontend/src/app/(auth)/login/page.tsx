"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authApi.login({ email, password });
      const authResult = await login(res.access_token);
      if (authResult?.user?.is_client) {
        router.push("/portal");
      } else if (authResult?.isSpecialist) {
        router.push("/tasks");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101014] px-4 relative overflow-hidden select-none">
      {/* Background radial ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#A78BFA]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#69A9D8]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full surface-card rounded-3xl border border-white/[0.08] p-8 shadow-2xl relative z-10 space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#20202A] border border-white/[0.08] flex items-center justify-center text-[#A78BFA] font-heading font-extrabold text-xl shadow-xs mx-auto ring-1 ring-[#A78BFA]/20">
            A
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F2F0F7] tracking-tight">AgencyOS</h1>
          <p className="text-xs text-[#A3A0B0] max-w-xs mx-auto">
            Operating system for creative social media agencies
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-[#E16F7B]/10 border border-[#E16F7B]/30 text-[#E16F7B] text-xs rounded-xl font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono font-medium text-[#A3A0B0] uppercase tracking-wider mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A3A0B0] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#101014] hover:bg-[#13131A] focus:bg-[#17171E] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#A78BFA]/50 transition-all font-mono"
                placeholder="aryan@elevatesocial.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-[#A3A0B0] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A3A0B0] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#101014] hover:bg-[#13131A] focus:bg-[#17171E] border border-white/[0.08] rounded-xl text-xs text-[#F2F0F7] placeholder:text-[#A3A0B0]/50 pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#A78BFA]/50 transition-all font-mono"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[#A78BFA] hover:bg-[#B69BFF] text-[#101014] font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign in to Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#101014]" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-white/[0.08] text-center">
          <p className="text-xs text-[#A3A0B0]">
            Need an agency workspace?{" "}
            <Link href="/register" className="text-[#A78BFA] hover:text-[#B69BFF] font-semibold transition-colors">
              Create one in 30 seconds &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
