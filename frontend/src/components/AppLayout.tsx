"use client";
/**
 * Page shell: left Sidebar + a top bar (global search, theme toggle, user +
 * logout) + the page content. Used by every authenticated page so navigation
 * and controls are consistent everywhere.
 */
import { useRouter } from "next/navigation";
import { Search, Sun, Moon, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function AppLayout({ current, children }: { current: string; children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar current={current} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="relative hidden md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Global search…"
              className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              title="Toggle theme"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                <div className="text-right leading-tight">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-[11px] capitalize text-slate-400">{user.role?.replace(/_/g, " ")}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
