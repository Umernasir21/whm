"use client";
/**
 * Page shell: dark Sidebar + a sticky top bar (global search, theme toggle,
 * notifications, user menu) + the page content.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, LogOut, Bell, ChevronDown, UserRound } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { endpoints } from "@/lib/api";

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function AppLayout({ current, children }: { current: string; children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endpoints.v1.notifications(true).then((r: any) => setUnread(r?.unread_count ?? 0)).catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  async function handleLogout() { await logout(); router.replace("/login"); }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar current={current} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/85 px-6 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/75">
          <div className="hidden flex-1 md:block"><GlobalSearch /></div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggle}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={() => router.push("/console?m=notifications")}
              title="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-2xs font-semibold text-white ring-2 ring-white dark:ring-slate-950">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {user && (
              <div ref={menuRef} className="relative ml-1.5">
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-2xs font-semibold text-white">{initials(user.name)}</div>
                  <div className="hidden text-left leading-tight sm:block">
                    <div className="text-sm font-medium tracking-tight">{user.name}</div>
                    <div className="text-2xs capitalize text-slate-400">{user.role?.replace(/_/g, " ")}</div>
                  </div>
                  <ChevronDown size={15} className="text-slate-400" />
                </button>

                {menu && (
                  <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-overlay animate-scale-in dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-slate-400">{user.email}</div>
                    </div>
                    <button onClick={() => { setMenu(false); router.push("/console?m=settings"); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                      <UserRound size={15} /> Account settings
                    </button>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-slate-800 dark:hover:bg-red-500/10">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 px-6 py-6 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
