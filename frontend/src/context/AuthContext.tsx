import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "@/src/api/client";

export interface AthoUser {
  user_id: string;
  username: string;
  display_name: string;
  profile_picture?: string | null;
  bio?: string;
  is_private?: boolean;
  is_premium?: boolean;
  followers_count?: number;
  following_count?: number;
  workouts_count?: number;
  currently_working_out?: boolean;
  hide_followers?: boolean;
  show_workout_status?: boolean;
  auth_provider?: string;
  needs_setup?: boolean;
  height_unit?: string;
  weight_unit?: string;
  height?: number | null;
  weight?: number | null;
  onboarded?: boolean;
  seen_welcome_tour?: boolean;
  training_days_per_week?: number | null;
  main_goal?: string | null;
  weight_goal?: string | null;
  experience_level?: string | null;
  plan_preferences?: any;
}

interface AuthCtx {
  user: AthoUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; username: string; display_name: string }) => Promise<void>;
  googleSession: (session_id: string) => Promise<void>;
  googleCompleteSetup: (data: { username: string; password: string }) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AthoUser | null) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AthoUser | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) {
        setUser(null);
        return;
      }
      const r = await api<{ user: AthoUser }>("/auth/me");
      setUser(r.user);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: AthoUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
  };

  const register = async (data: { email: string; password: string; username: string; display_name: string }) => {
    const r = await api<{ token: string; user: AthoUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
  };

  const googleSession = async (session_id: string) => {
    const r = await api<{ token: string; user: AthoUser }>("/auth/google/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
  };

  const googleCompleteSetup = async (data: { username: string; password: string }) => {
    const r = await api<{ user: AthoUser }>("/auth/google/complete-setup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setUser(r.user);
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, googleSession, googleCompleteSetup, refresh, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
