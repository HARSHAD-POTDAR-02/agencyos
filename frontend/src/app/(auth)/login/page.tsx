"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail } from "lucide-react";

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
      await login(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090A0F] px-4 relative overflow-hidden select-none">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-purple-600/20 via-indigo-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-[#11131C] rounded-3xl border border-white/10 p-8 shadow-2xl relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-purple-600/30 mx-auto mb-4 ring-1 ring-white/20">
            A
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">AgencyOS</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in to your agency workflow operations workspace
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                placeholder="aryan@elevatesocial.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign in to Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
          <p className="text-xs text-slate-400">
            Need an agency workspace?{" "}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold transition-colors">
              Create one in 30 seconds →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
