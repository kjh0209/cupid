import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<{ workspaceId: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.auth.me();
      setUser(r.user);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (email: string, password: string) => {
    const r = await api.auth.login(email, password);
    setUser(r.user);
  };

  const signup = async (email: string, password: string) => {
    const r = await api.auth.signup(email, password);
    setUser(r.user);
    return { workspaceId: r.workspaceId };
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, refresh, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
