"use client";
/**
 * Page shell: left Sidebar + a sticky top bar (global search, theme toggle,
 * user avatar + logout) + the page content.
 */
import { useRouter } from "next/navigation";
import { Sun, Moon, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
          <div className="hidden flex-1 md:block"><GlobalSearch /></div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggle}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {user && (
              <div className="flex items-center gap-2.5 border-l border-slate-200/80 pl-3 dark:border-slate-800">
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-sm font-medium tracking-tight">{user.name}</div>
                  <div className="text-2xs capitalize text-slate-400">{user.role?.replace(/_/g, " ")}</div>
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-2xs font-semibold text-white dark:from-slate-600 dark:to-slate-800">
                  {initials(user.name)}
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 px-6 py-6 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
