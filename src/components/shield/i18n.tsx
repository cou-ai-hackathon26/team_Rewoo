"use client";

// Common bilingual UI strings + helpers.

import type { Bilingual } from "@/lib/types";
import { useSettings, type Lang } from "./store";

export function useLang(): Lang {
  return useSettings((s) => s.lang);
}

/** Pick the active language from a bilingual object. */
export function bi(value: Bilingual | undefined | null, lang: Lang): string {
  if (!value) return "";
  return (lang === "en" ? value.en : value.bn) || value.bn || value.en || "";
}

/** Hook-based bilingual picker. */
export function useBi() {
  const lang = useLang();
  return (value: Bilingual | undefined | null) => bi(value, lang);
}

type Entry = { bn: string; en: string };

export const STRINGS: Record<string, Entry> = {
  "app.name": { bn: "বাংলাশিল্ড", en: "BanglaShield" },
  "app.tagline": { bn: "প্রতিটি বাংলাদেশির জন্য এআই নিরাপত্তা", en: "AI safety for every Bangladeshi" },
  "nav.home": { bn: "হোম", en: "Home" },
  "nav.check": { bn: "যাচাই করুন", en: "Verify" },
  "nav.guardian": { bn: "গার্ডিয়ান", en: "Guardian" },
  "nav.recovery": { bn: "জরুরি সহায়তা", en: "Emergency" },
  "nav.learn": { bn: "স্ক্যামএকাডেমি", en: "ScamAcademy" },
  "nav.report": { bn: "রিপোর্ট", en: "Report" },
  "nav.help": { bn: "সহায়তা", en: "Help" },
  "nav.privacy": { bn: "গোপনীয়তা", en: "Privacy" },
  "nav.settings": { bn: "সেটিংস", en: "Settings" },
  "nav.analyst": { bn: "অ্যানালিস্ট", en: "Analyst" },
  "common.back": { bn: "ফিরে যান", en: "Back" },
  "common.next": { bn: "পরবর্তী", en: "Next" },
  "common.cancel": { bn: "বাতিল", en: "Cancel" },
  "common.confirm": { bn: "নিশ্চিত করুন", en: "Confirm" },
  "common.retry": { bn: "আবার চেষ্টা করুন", en: "Retry" },
  "common.delete": { bn: "মুছে ফেলুন", en: "Delete" },
  "common.close": { bn: "বন্ধ করুন", en: "Close" },
  "common.loading": { bn: "লোড হচ্ছে…", en: "Loading…" },
  "common.copied": { bn: "কপি হয়েছে", en: "Copied" },
  "common.error": { bn: "একটি সমস্যা হয়েছে", en: "Something went wrong" },
  "common.example": { bn: "উদাহরণ", en: "Example" },
  "common.tryIt": { bn: "চেষ্টা করে দেখুন", en: "Try it" },
  "common.viewAll": { bn: "সব দেখুন", en: "View all" },
  "common.synthetic": { bn: "ডেমো ডেটা (সিমুলেশন)", en: "Demo data (simulation)" },
  // V3 four-state risk labels (color never the only signal)
  "risk.HIGH_RISK": { bn: "উচ্চ ঝুঁকি", en: "High risk" },
  "risk.CAUTION": { bn: "সতর্ক থাকুন", en: "Caution" },
  "risk.INSUFFICIENT_EVIDENCE": { bn: "প্রমাণ অপর্যাপ্ত নয়", en: "Insufficient evidence" },
  "risk.NO_RISK_INDICATORS": { bn: "ঝুঁকির প্রমাণ পাওয়া যায়নি", en: "No risk indicators found" },
  // Legacy keys (old persisted results)
  "risk.high": { bn: "উচ্চ ঝুঁকি", en: "High concern" },
  "risk.uncertain": { bn: "নিশ্চিত নয়", en: "Uncertain" },
  "risk.none": { bn: "ঝুঁকির প্রমাণ পাওয়া যায়নি", en: "No risk indicators detected" },
  "engine.ai": { bn: "এআই-সহায়ক বিশ্লেষণ", en: "AI-assisted analysis" },
  "engine.rule": { bn: "নিয়মভিত্তিক বিশ্লেষণ (ফলব্যাক)", en: "Rule-based analysis (fallback)" },
  // V3 analysis modes
  "mode.LIVE_AI": { bn: "লাইভ এআই বিশ্লেষণ", en: "Live AI analysis" },
  "mode.RULE_BASED_FALLBACK": { bn: "নিয়মভিত্তিক বিশ্লেষণ (ফলব্যাক)", en: "Rule-based analysis (fallback)" },
  "mode.OFFLINE_DEMO": { bn: "অফলাইন ডেমো", en: "Offline demo" },
  "nav.community": { bn: "কমিউনিটি", en: "Community" },
  "nav.cases": { bn: "কেস ইতিহাস", en: "Case history" },
  "nav.demo": { bn: "ডেমো দেখুন", en: "Watch demo" },
  "footer.mission": {
    bn: "মানুষ রক্ষা, পরিবার রক্ষা, জীবিকা রক্ষা।",
    en: "Protect people, protect families, protect livelihoods.",
  },
  "footer.disclaimer": {
    bn: "বাংলাশিল্ড একটি সচেতনতামূলক সহায়তা প্ল্যাটফর্ম — এটি ব্যাংক, আইনশৃঙ্খলা সংস্থা বা জরুরি সেবা নয়। টাকা ফেরতের নিশ্চয়তা দেয় না।",
    en: "BanglaShield is an awareness-support platform — not a bank, law-enforcement, or emergency authority. It does not promise fund recovery.",
  },
  "footer.links": { bn: "দ্রুত লিংক", en: "Quick links" },
  "footer.emergency": { bn: "জরুরি নম্বর", en: "Emergency number" },
  "footer.emergencyDesc": {
    bn: "জাতীয় জরুরি সেবা — পুলিশ, অগ্নিনির্বাপণ, স্বাস্থ্য",
    en: "National emergency service — police, fire, health",
  },
  "footer.copyright": {
    bn: "সচেতনতামূলক ওপেন প্ল্যাটফর্ম",
    en: "An open awareness platform",
  },
  "footer.privacyNote": {
    bn: "আপনার কণ্ঠস্বর ও ছবি কখনোই সংরক্ষণ করা হয় না",
    en: "Your voice and images are never stored",
  },
};

export function useT() {
  const lang = useLang();
  return (key: string) => {
    const entry = STRINGS[key];
    if (!entry) return key;
    return lang === "en" ? entry.en : entry.bn;
  };
}
