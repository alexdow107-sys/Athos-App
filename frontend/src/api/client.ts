import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

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
