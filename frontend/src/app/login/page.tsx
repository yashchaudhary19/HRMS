"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.auth.login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 text-brand-text overflow-hidden">
      {/* Background ambient glow mesh */}
      <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none z-0"></div>

      <div className="relative z-10 w-full max-w-md rounded-2xl glass-panel p-8 shadow-2xl hover-glow">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-black text-2xl shadow-lg shadow-brand-primary/20">
            HR
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
            HRMS Portal
          </h1>
          <p className="mt-2 text-xs text-brand-muted font-medium tracking-wide">
            Sign in to manage attendance and leaves
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-3 text-xs font-semibold text-brand-danger text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/40 px-4 py-3 text-sm text-brand-text placeholder-brand-muted/40 outline-none transition-all duration-300 focus:border-brand-primary/60 focus:bg-brand-sidebar/60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/40 px-4 py-3 text-sm text-brand-text placeholder-brand-muted/40 outline-none transition-all duration-300 focus:border-brand-primary/60 focus:bg-brand-sidebar/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
