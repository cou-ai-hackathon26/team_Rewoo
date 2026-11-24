"use client";

// Client API wrapper: JSON fetch with the anonymous visitor header,
// consistent error shape, and no absolute URLs (gateway-safe).

import { useSettings } from "./store";

export interface ApiError {
  code: string;
  message: string;
  retryAfterSec?: number;
}

export class ShieldApiError extends Error {
  apiError: ApiError;
  status: number;
  constructor(err: ApiError, status: number) {
    super(err.message);
    this.apiError = err;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown; raw?: boolean }): Promise<T> {
  const visitor = useSettings.getState().visitorToken;
  const headers: Record<string, string> = { "X-Shield-Visitor": visitor, ...(init?.headers as Record<string, string>) };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body, cache: "no-store" });
  if (init?.raw) return res as unknown as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: ApiError })?.error ?? { code: "unknown", message: "Network or server error" };
    throw new ShieldApiError(err, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, json: unknown) => request<T>(path, { method: "POST", json }),
  patch: <T>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postRaw: async <T>(path: string, json: unknown) => {
    const visitor = useSettings.getState().visitorToken;
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shield-Visitor": visitor },
      body: JSON.stringify(json),
    });
    if (!res.ok) {
      let err: ApiError = { code: "tts-failed", message: "Audio generation failed" };
      try {
        const data = await res.json();
        err = data.error ?? err;
      } catch {
        /* keep default */
      }
      throw new ShieldApiError(err, res.status);
    }
    return res;
  },
};
