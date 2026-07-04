"use client";
/**
 * Shared top strip for the standalone module pages — a way back to the console
 * and a logout, so users are never stranded without navigation.
 */
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function AppBar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="mb-4 flex items-center justify-between">
      <button
        onClick={() => router.push("/console")}
        className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft size={15} /> Console
      </button>
      {user && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
