"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { endpoints, setToken } from "./api";

interface AuthUser {
  id: number; name: string; email: string;
  role: string; is_admin: boolean; permissions: string[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    endpoints
      .me()
      .then((u: any) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await endpoints.login(email, password);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await endpoints.logout().catch(() => {});
    setToken(null);
    setUser(null);
  }

  const can = (p: string) => user?.permissions.includes(p) ?? false;
  const isAdmin = user?.is_admin ?? false;

  return <Ctx.Provider value={{ user, loading, login, logout, can, isAdmin }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
