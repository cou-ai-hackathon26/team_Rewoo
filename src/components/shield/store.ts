"use client";

// BanglaShield client settings store (Zustand + persist).
// Accessibility + language + privacy preferences, plus anonymous tokens
// (visitor token for case ownership; learner token for ScamAcademy progress).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "bn" | "en";

function makeToken(len = 32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length])
    .slice(0, len)
    .join("");
}

export interface ShieldSettings {
  lang: Lang;
  largeText: boolean;
  reduceMotion: boolean;
  narration: boolean;
  lowBandwidth: boolean;
  visitorToken: string;
  learnerToken: string;
  setLang: (l: Lang) => void;
  setLargeText: (v: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  setNarration: (v: boolean) => void;
  setLowBandwidth: (v: boolean) => void;
}

export const useSettings = create<ShieldSettings>()(
  persist(
    (set) => ({
      lang: "bn",
      largeText: false,
      reduceMotion: false,
      narration: false,
      lowBandwidth: false,
      visitorToken: makeToken(32),
      learnerToken: makeToken(24),
      setLang: (lang) => set({ lang }),
      setLargeText: (largeText) => set({ largeText }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setNarration: (narration) => set({ narration }),
      setLowBandwidth: (lowBandwidth) => set({ lowBandwidth }),
    }),
    {
      name: "banglashield-settings",
      version: 1,
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Partial<ShieldSettings>;
        return {
          ...p,
          visitorToken:
            typeof p.visitorToken === "string" && p.visitorToken.length >= 16
              ? p.visitorToken
              : makeToken(32),
          learnerToken:
            typeof p.learnerToken === "string" && p.learnerToken.length >= 16
              ? p.learnerToken
              : makeToken(24),
        };
      },
      partialize: (s) => ({
        lang: s.lang,
        largeText: s.largeText,
        reduceMotion: s.reduceMotion,
        narration: s.narration,
        lowBandwidth: s.lowBandwidth,
        visitorToken: s.visitorToken,
        learnerToken: s.learnerToken,
      }),
    }
  )
);

export function usePrefersReducedMotion(): boolean {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  if (typeof window !== "undefined" && window.matchMedia) {
    return reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return reduceMotion;
}
