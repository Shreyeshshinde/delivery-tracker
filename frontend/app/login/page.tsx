"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display font-extrabold text-2xl tracking-tight text-ink">
            WAYBILL
          </div>
          <div className="font-[family-name:var(--font-plex-mono)] text-[10px] text-slate uppercase tracking-widest mt-1">
            Delivery Ops Console
          </div>
        </div>

        <div className="bg-white border border-line rounded-sm shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-signal" />

          <div className="p-8">
            <h1 className="font-display font-bold text-lg text-ink mb-1">Sign in</h1>
            <p className="text-sm text-slate mb-6">Access your delivery account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ink text-paper rounded-sm py-2.5 text-sm font-medium hover:bg-ink-light transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>

          <div className="border-t border-dashed border-line px-8 py-4 bg-paper/50">
            <p className="text-sm text-slate text-center">
              No account?{" "}
              <Link href="/register" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}