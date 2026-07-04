"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Load persisted / system preference once on mount.
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("wms_theme")) as Theme | null;
    const initial: Theme = saved ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    apply(initial);
    setTheme(initial);
  }, []);

  function apply(t: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
  }

  function toggle() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      apply(next);
      localStorage.setItem("wms_theme", next);
      return next;
    });
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
