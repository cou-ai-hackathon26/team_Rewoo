"use client";

// Community member session store (client). Mirrors the httpOnly-cookie
// session on the server — the client only ever sees the public profile
// (publicId, name, username), never roles or secrets.

import { create } from "zustand";
import { api } from "./api";

export interface MemberInfo {
  publicId: string;
  name: string;
  username: string;
}

interface MemberState {
  member: MemberInfo | null;
  ready: boolean;
  init: () => Promise<void>;
  setMember: (m: MemberInfo | null) => void;
  logout: () => Promise<void>;
}

export const useMember = create<MemberState>((set) => ({
  member: null,
  ready: false,
  init: async () => {
    try {
      const res = await api.get<{ member: MemberInfo }>("/api/v1/auth/me");
      set({ member: res.member, ready: true });
    } catch {
      set({ member: null, ready: true });
    }
  },
  setMember: (member) => set({ member, ready: true }),
  logout: async () => {
    try {
      await api.post("/api/v1/auth/logout", {});
    } catch {
      /* cookie cleared server-side best-effort */
    }
    set({ member: null });
  },
}));

/** Deterministic warm avatar color for a member id. */
const AVATAR_COLORS = ["#2F5746", "#8A5B28", "#A44435", "#4A6B5A", "#6B4A3A"];
export function avatarColor(publicId: string): string {
  let h = 0;
  for (let i = 0; i < publicId.length; i++) h = (h * 31 + publicId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
