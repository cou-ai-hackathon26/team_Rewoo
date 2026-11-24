// ---------------------------------------------------------------------------
// Judge Demo Mode presets (V3 §22) — original, authorized synthetic assets.
// Every preset is clearly labeled synthetic and runs through the REAL
// backend pipeline with analysisMode = "OFFLINE_DEMO" (no AI call needed
// for text presets; media presets use the real extraction services).
// ---------------------------------------------------------------------------

import type { Bilingual } from "@/lib/types";

export type DemoPresetKind = "text" | "link" | "image" | "audio";

export interface DemoPreset {
  id: string;
  kind: DemoPresetKind;
  /** Which modality session to create. */
  modality: "voice" | "message" | "image" | "link";
  title: Bilingual;
  description: Bilingual;
  /** Text presets: transcript / message content (synthetic). */
  text?: string;
  /** Link presets: the (inert) example URL. */
  url?: string;
  /** Image presets: local asset path (public/…). */
  imageSrc?: string;
  /** Audio presets: local asset path (public/…). */
  audioSrc?: string;
  /** Expected teaching point — shown on the demo page as "what to watch". */
  watchFor: Bilingual;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "rahela-voice",
    kind: "text",
    modality: "voice",
    title: { bn: "রাহেলার ঘটনা — ছেলের কণ্ঠে ফোন", en: "Rahela's case — a call in her son's voice" },
    description: {
      bn: "এক রাতে অচেনা নম্বর থেকে ছেলের মতো কণ্ঠে কান্না: “মা, আমি বিপদে পড়েছি, এখনই ৫০,০০০ টাকা পাঠাও — কাউকে বলো না।” (কাল্পনিক নকল কণ্ঠের ট্রান্সক্রিপ্ট)",
      en: "One night an unknown number calls in her son's voice, crying: “Mom, I'm in trouble, send 50,000 taka now — don't tell anyone.” (fictional synthetic-voice transcript)",
    },
    text:
      "অচেনা নম্বর থেকে ফোন এলো। ওপাশে ছেলের মতো কণ্ঠে কান্না — " +
      "“মা, আমি বিপদে পড়েছি। এখনই ৫০,০০০ টাকা পাঠাও। কাউকে বলো না।” " +
      "ছেলে দুবাইয়ে কাজ করে, তার পাঠানো টাকায় সংসার চলে।",
    audioSrc: "/demo/rahela-call.wav",
    watchFor: {
      bn: "পারিবারিক ছদ্মবেশ + বিপদের গল্প + অর্থ চাওয়া + গোপনীয়তার চাপ → উচ্চ ঝুঁকি ও সঠিক শ্রেণিবিন্যাস; কণ্ঠ আসল না এআই-নকল তা নিশ্চিত করা যায়নি বলে সৎ সীমাবদ্ধতা।",
      en: "Family impersonation + distress + money + secrecy → HIGH_RISK with correct category; honest limitation that the voice cannot be verified as AI.",
    },
  },
  {
    id: "benign-otp-advisory",
    kind: "text",
    modality: "message",
    title: { bn: "নিরীহ ওটিপি সতর্কবার্তা", en: "Benign OTP advisory" },
    description: {
      bn: "একটি বৈধ সতর্কবার্তা যা মানুষকে ওটিপি না দিতে বলে — এটি প্রতারণা নয়, নিরাপত্তা-শিক্ষা।",
      en: "A legitimate advisory telling people never to share OTPs — this is safety education, not a scam.",
    },
    text:
      "প্রিয় গ্রাহক, মনে রাখবেন — ব্যাংক বা বিকাশ কখনোই ফোনে বা মেসেজে আপনার ওটিপি চায় না। " +
      "কেউ ওটিপি চাইলেই সেটি প্রতারণা। আপনার কোড কাউকে দিয়ে দিবেন না, নিজের অ্যাপে লিখুন। " +
      "সতর্ক থাকুন, পরিবারকে জানান।",
    watchFor: {
      bn: "ওটিপি শব্দ থাকা সত্ত্বেও পরামর্শমূলক ভাষা চেনা হয়েছে → ঝুঁকির প্রমাণ পাওয়া যায়নি; বানানো প্রতারণা নয়।",
      en: "Despite the word OTP, advisory framing is recognized → NO_RISK_INDICATORS; no invented scam.",
    },
  },
  {
    id: "scholarship-screenshot",
    kind: "image",
    modality: "image",
    title: { bn: "ভুয়া বৃত্তির স্ক্রিনশট", en: "Fake scholarship screenshot" },
    description: {
      bn: "“শিক্ষা মন্ত্রণালয়ের বৃত্তি” নামে অগ্রিম ফি চাওয়া নকল নোটিশের স্ক্রিনশট (মূল সিন্থেটিক ডেমো সম্পদ)।",
      en: "A screenshot of a fake “Ministry of Education scholarship” notice asking for an advance fee (original synthetic demo asset).",
    },
    imageSrc: "/demo/scholarship-scam.png",
    watchFor: {
      bn: "ছবি থেকে আসল লেখা বের হয় (OCR) → বৃত্তি + অগ্রিম ফি শনাক্ত → উচ্চ ঝুঁকি; প্রমাণ হুবহু ছবির লেখা থেকে।",
      en: "Real OCR extraction → scholarship + advance fee detected → HIGH_RISK; evidence quoted verbatim from the image.",
    },
  },
  {
    id: "demo-qr",
    kind: "link",
    modality: "link",
    title: { bn: "নিরীহ ডেমো কিউআর কোড", en: "Harmless demo QR code" },
    description: {
      bn: "ক্ষতি না করা একটি কিউআর ছবি — ফোনেই ডিকোড হয়, গন্তব্য কখনোই খোলা হয় না।",
      en: "A harmless QR image — decoded on-device, the destination is never opened.",
    },
    url: "https://example.com/banglashield-demo",
    watchFor: {
      bn: "কিউআরের ভেতরের লিংক দেখানো হয়, স্বয়ংক্রিয়ভাবে কিছু চালানো হয় না → ঠিকানার গঠন থেকে সৎ বিশ্লেষণ।",
      en: "The QR's link is displayed, nothing auto-executed → honest analysis from address structure only.",
    },
  },
  {
    id: "phishing-url",
    kind: "link",
    modality: "link",
    title: { bn: "উদাহরণ ফিশিং লিংক", en: "Inert example phishing URL" },
    description: {
      bn: "ব্র্যান্ডের ছদ্মবেশধারী একটি নিষ্ক্রিয় উদাহরণ লিংক — কখনো খোলা হয় না, শুধু কাঠামো পরীক্ষা হয়।",
      en: "An inert brand-lookalike example link — never opened, only structurally inspected.",
    },
    url: "http://bkash-verify-account.top/login",
    watchFor: {
      bn: "ব্র্যান্ড নকল + সন্দেহজনক TLD + http → লিংক-নির্দিষ্ট প্রমাণ; “গন্তব্য পরীক্ষা করা হয়নি” সীমাবদ্ধতা স্পষ্ট।",
      en: "Brand lookalike + suspicious TLD + http → link-specific evidence; clear limitation that the destination was not inspected.",
    },
  },
  {
    id: "overseas-job",
    kind: "text",
    modality: "message",
    title: { bn: "কাল্পনিক বিদেশি চাকরির প্রতারণা", en: "Fictional overseas job scam" },
    description: {
      bn: "দুবাইয়ে “বিনা খরচে ভিসা-চাকরি” দেখানো নকল বার্তা যেখানে আগে ফি চাওয়া হয়।",
      en: "A fake “free visa-job in Dubai” message that asks for a fee upfront.",
    },
    text:
      "প্রিয় প্রার্থী, অভিনন্দন! আপনি দুবাইয়ে ফ্রি ভিসাসহ ড্রাইভার চাকরির জন্য নির্বাচিত হয়েছেন। " +
      "বেতন ৪৫,০০০ টাকা। কোনো এজেন্সি ফি লাগবে না, শুধু ভিসা প্রসেসিং ফি ৮,৫০০ টাকা আজই " +
      "পার্সোনাল নম্বরে পাঠিয়ে দিন, নাহলে সিট কেউ নিয়ে নেবে।",
    watchFor: {
      bn: "ভিসা-চাকরির লোভ + অগ্রিম ফি + তাড়া → উচ্চ ঝুঁকি (ভুয়া চাকরি/ভিসা); সুরক্ষা-পরামর্শ সবার আগে।",
      en: "Visa-job bait + advance fee + urgency → HIGH_RISK (fake job/visa); protective action first.",
    },
  },
];

export function getDemoPreset(id: string): DemoPreset | undefined {
  return DEMO_PRESETS.find((p) => p.id === id);
}
