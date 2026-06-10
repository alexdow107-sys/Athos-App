import { Platform } from "react-native";
import Constants from "expo-constants";

import { storage } from "@/src/utils/storage";

/**
 * Resolve the backend base URL.
 *
 * On a physical device or emulator, "localhost"/"127.0.0.1" point at the device
 * itself — not your dev machine — so a localhost backend URL is unreachable and
 * every request fails. In that case we swap in the Expo dev server's host (the
 * LAN IP that served the JS bundle), keeping the configured port. On web, or
 * when a real host is configured (e.g. production), the URL is used as-is.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";
  if (Platform.OS === "web") return configured;
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configured)) return configured;
  const c: any = Constants;
  const hostUri: string | undefined =
    c.expoConfig?.hostUri ||
    c.expoGoConfig?.hostUri ||
    c.manifest2?.extra?.expoClient?.hostUri ||
    c.manifest?.hostUri;
  const host = hostUri?.split(":")[0];
  if (!host) return configured;
  return configured.replace(/(localhost|127\.0\.0\.1)/i, host);
}

const BASE = resolveBaseUrl();

const TOKEN_KEY = "atho_token";

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, "")) || null;
}

export async function setToken(token: string): Promise<void> {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
}

export interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers || {});
  if (!headers.has("Content-Type") && opts.body) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth !== false) {
    const t = await getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = data?.detail || data?.message || `HTTP ${res.status}`;
    const err: any = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const apiUrl = (path: string) => `${BASE}/api${path}`;
