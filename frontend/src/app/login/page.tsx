"use client";
/**
 * Login screen. Authenticates via the API (Sanctum token), stored by the auth
 * context, then routes into the app. This is the page the API client redirects
 * to on any 401, so it must exist for the whole SPA to be usable.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Warehouse, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@wms.test");
  const [password, setPassword] = useState("Password123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Already signed in? Skip straight to the app.
  useEffect(() => {
    if (!loading && user) router.replace("/console");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
      router.replace("/console");
    } catch (err: any) {
      setError(err?.message === "Unauthorized" || err?.status === 401
        ? "Invalid email or password."
        : (err?.message ?? "Login failed. Is the API running on :8000?"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white">
            <Warehouse size={24} />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Warehouse Management System</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
              required
            />
          </label>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
              required
            />
          </label>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Sign in
          </button>
        </form>

        <div className="mt-4 rounded-lg bg-white/60 p-3 text-center text-xs text-slate-500">
          <span className="font-medium text-slate-600">Demo logins</span> — admin@wms.test ·
          abdullah@wms.test · arsum@wms.test · jawed@wms.test<br />password: <code>Password123</code>
        </div>
      </div>
    </div>
  );
}
