import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const USER_KEY = "atho_user";

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
  show_stats?: boolean;
  show_workout_status?: boolean;
  auth_provider?: string;
  needs_setup?: boolean;
  height_unit?: string;
  weight_unit?: string;
  distance_unit?: string;
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
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AthoUser | null) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AthoUser | null>(null);
  const [loading, setLoading] = useState(false);

  // Set the user and persist a copy so the next app launch can render instantly.
  const setUser = useCallback((u: AthoUser | null) => {
    setUserState(u);
    if (u) storage.setItem(USER_KEY, JSON.stringify(u) as any);
    else storage.removeItem(USER_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const r = await api<{ user: AthoUser }>("/auth/me");
      setUser(r.user);
    } catch (e: any) {
      // Only sign out on a real auth failure (invalid/expired token). For network,
      // timeout, or server (5xx) errors — e.g. a cold backend — keep the cached
      // user so the app stays usable and doesn't boot you to the login screen.
      if (e?.status === 401 || e?.status === 403) {
        setUser(null);
        await clearToken();
      }
    }
  }, [setUser]);

  useEffect(() => {
    (async () => {
      // 1. Show the last-known user immediately — no network wait on launch.
      let hadCache = false;
      try {
        const [cached, token] = await Promise.all([
          storage.getItem(USER_KEY, "") as Promise<string>,
          getToken(),
        ]);
        if (token && cached && typeof cached === "string") {
          setUserState(JSON.parse(cached));
          hadCache = true;
        }
      } catch {}
      // Only block on the spinner if there's nothing cached to show.
      if (!hadCache) setLoading(true);
      // 2. Revalidate in the background.
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

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, refresh, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
