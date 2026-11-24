"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Siren,
  Banknote,
  KeyRound,
  AppWindow,
  IdCard,
  MessageSquareWarning,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  ExternalLink,
  ArrowRight,
  Loader2,
  Bot,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../api";
import { useLang } from "../i18n";
import { Link, useHashRoute } from "../router";
import { WarnNote } from "../ui-bits";
import { cn } from "@/lib/utils";
import { AgentChat } from "./agent-chat";

interface Resource {
  key: string;
  name: { bn: string; en: string };
  category: string;
  description: { bn: string; en: string };
  guidance: { bn: string; en: string };
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: string;
  /** COU TECHNOVA 2026 (Challenge 2): server-side eligibility from the same
   *  freshness/hostname policy the Guardian uses — undefined = legacy
   *  fallback shape (bundled snapshot). */
  eligible?: boolean;
  exclusionReasons?: string[];
}

type SituationKey = "money" | "otp" | "app" | "info" | "threat";

interface Step {
  title: { bn: string; en: string };
  detail: { bn: string; en: string };
  priority: "now" | "soon";
}

const SITUATIONS: {
  key: SituationKey;
  icon: React.ReactNode;
  question: { bn: string; en: string };
  steps: Step[];
}[] = [
  {
    key: "money",
    icon: <Banknote className="h-6 w-6" aria-hidden />,
    question: {
      bn: "আপনি কি ইতিমধ্যেই কারও কাছে টাকা পাঠিয়ে ফেলেছেন?",
      en: "Have you already sent money to someone?",
    },
    steps: [
      {
        title: { bn: "এখনই ব্যাংক/এমএফএস-এ কল করুন (নিজে থেকে)", en: "Call your bank/MFS provider right now (yourself)" },
        detail: {
          bn: "অ্যাপের ভেতরের হেল্প সেকশন বা কার্ডের পেছনে ছাপা নম্বর থেকে নিজে কল করুন। লেনদেনটি ব্লক বা ফেরতের অনুরোধ (chargeback/withdrawal hold) জানান। যত দ্রুত জানাবেন, থামানোর সম্ভাবনা তত বাড়ে।",
          en: "Call yourself using in-app support or the number printed on your card. Ask them to block or attempt reversal of the transaction. The sooner you report, the better the chance of stopping it.",
        },
        priority: "now",
      },
      {
        title: { bn: "লেনদেনের প্রমাণ সংরক্ষণ করুন", en: "Preserve transaction evidence" },
        detail: {
          bn: "সেন্ড মানির এসএমএস/রসিদ, প্রাপকের নম্বর, সময় ও পরিমাণ লিখে রাখুন বা স্ক্রিনশট নিন। পরে অভিযোগে কাজে লাগবে।",
          en: "Keep the send-money SMS/receipt, recipient number, time and amount — screenshots help the complaint later.",
        },
        priority: "soon",
      },
      {
        title: { bn: "অভিযোগ করুন — ৯৯৯ বা সাইবার ট্রাইব্যুনাল", en: "File a complaint — 999 or the Cyber Tribunal" },
        detail: {
          bn: "বড় ক্ষতি হলে ৯৯৯-এ জানান এবং নিকটবর্তী থানা/সাইবার ট্রাইব্যুনালে লিখিত অভিযোগ করুন। জিডির কপি সংরক্ষণ করুন।",
          en: "For significant loss inform 999 and file a written complaint at your police station or the Cyber Tribunal. Keep a copy of the GD.",
        },
        priority: "soon",
      },
    ],
  },
  {
    key: "otp",
    icon: <KeyRound className="h-6 w-6" aria-hidden />,
    question: {
      bn: "আপনি কি কারও সাথে OTP, PIN বা পাসওয়ার্ড শেয়ার করে ফেলেছেন?",
      en: "Have you shared an OTP, PIN or password with anyone?",
    },
    steps: [
      {
        title: { bn: "এক মিনিটও দেরি নয় — এখনই পিন বদলান", en: "Change your PIN immediately — not a minute later" },
        detail: {
          bn: "নিজের অ্যাপে ঢুকে পিন/পাসওয়ার্ড এখনই পরিবর্তন করুন। কোড দিয়ে দিলে প্রতারক সেটি দিয়ে ঢুকতে পারে — নতুন পিন দিলে পুরনো কোড অচল।",
          en: "Open your own app and change the PIN/password right now. A new PIN invalidates the code you shared.",
        },
        priority: "now",
      },
      {
        title: { bn: "একাউন্টের লেনদেন দেখুন", en: "Check recent transactions" },
        detail: {
          bn: "অ্যাপে ব্যালেন্স ও সাম্প্রতিক লেনদেন দেখুন। অজানা লেনদেন দেখলে সাথে সাথে ব্যাংক/এমএফএস-কে জানান ও একাউন্ট ব্লকের অনুরোধ করুন।",
          en: "Check balance and recent activity. If anything looks unfamiliar, tell your bank/MFS immediately and ask for an account block.",
        },
        priority: "now",
      },
      {
        title: { bn: "সতর্কতা চালু রাখুন", en: "Stay alert for follow-ups" },
        detail: {
          bn: "প্রতারক হয়তো আবার ফোন করে 'সমাধানের নামে' নতুন কোড চাইবে — আর কোনো কোড কাউকে দেবেন না।",
          en: "The scammer may call again posing as 'support' asking for new codes — never share codes again.",
        },
        priority: "soon",
      },
    ],
  },
  {
    key: "app",
    icon: <AppWindow className="h-6 w-6" aria-hidden />,
    question: {
      bn: "আপনি কি কারও বলায় কোনো অ্যাপ ইনস্টল করেছেন বা স্ক্রিন শেয়ার করেছেন?",
      en: "Have you installed an app on someone's request or shared your screen?",
    },
    steps: [
      {
        title: { bn: "অ্যাপটি আনইনস্টল করুন", en: "Uninstall the app" },
        detail: {
          bn: "AnyDesk, TeamViewer বা অজানা APK ইনস্টল করে থাকলে এখনই সরিয়ে ফেলুন। ফোনের সেটিংস → অ্যাপস থেকে অন্যান্য সম্প্রতি-ইনস্টল হওয়া অজানা অ্যাপও দেখুন।",
          en: "Remove AnyDesk, TeamViewer or unknown APKs immediately. Also check Settings → Apps for other recently-installed unknown apps.",
        },
        priority: "now",
      },
      {
        title: { bn: "পরিষ্কার ডিভাইস থেকে পাসওয়ার্ড বদলান", en: "Change passwords from a clean device" },
        detail: {
          bn: "সন্দেহজনক ফোনটি বাদ দিয়ে অন্য বিশ্বস্ত ডিভাইস থেকে ব্যাংক/এমএফএস পাসওয়ার্ড ও পিন পরিবর্তন করুন।",
          en: "From a different trusted device, change your bank/MFS passwords and PINs.",
        },
        priority: "now",
      },
      {
        title: { bn: "অ্যাপ পারমিশন পরীক্ষা করুন", en: "Review app permissions" },
        detail: {
          bn: "অজানা অ্যাপকে দেওয়া অ্যাক্সেসিবিলিটি/স্ক্রিন পারমিশন বাতিল করুন। প্রয়োজনে ফোন রিস্টার্ট করুন।",
          en: "Revoke accessibility/screen permissions granted to unknown apps. Restart the phone if needed.",
        },
        priority: "soon",
      },
    ],
  },
  {
    key: "info",
    icon: <IdCard className="h-6 w-6" aria-hidden />,
    question: {
      bn: "আপনি কি ব্যক্তিগত তথ্য (এনআইডি, ছবি, ঠিকানা) কারও সাথে শেয়ার করেছেন?",
      en: "Have you shared personal information (NID, photos, address) with anyone?",
    },
    steps: [
      {
        title: { bn: "পরবর্তী ঠকলাফাঁদের জন্য প্রস্তুত থাকুন", en: "Prepare for follow-up phishing" },
        detail: {
          bn: "তথ্য হাতে থাকলে প্রতারকরা 'যাচাইয়ের' নামে ফোন/মেসেজ দিয়ে আরও তথ্য বা টাকা চাইবে। ফোনে কেউ তথ্য যাচাইয়ের নামে কিছু চাইলে সেটি ফাঁদই ধরুন।",
          en: "With your data in hand, scammers will call 'to verify' and ask for more. Any verification call asking for data is a trap.",
        },
        priority: "now",
      },
      {
        title: { bn: "প্রতারণামূলক ব্যবহারের জন্য সতর্ক থাকুন", en: "Watch for misuse" },
        detail: {
          bn: "আপনার নামে জাল একাউন্ট বা লেনদেনের খোঁজ পেলে সাথে সাথে সংশ্লিষ্ট প্রতিষ্ঠান ও পুলিশকে জানান।",
          en: "If you learn of fake accounts or transactions in your name, inform the institution and police immediately.",
        },
        priority: "soon",
      },
      {
        title: { bn: "কথোপকথনের প্রমাণ রাখুন", en: "Keep records of the exchange" },
        detail: {
          bn: "কী তথ্য কাকে দিলেন — স্ক্রিনশট বা নোট হিসেবে রেখে দিন।",
          en: "Note down or screenshot exactly what was shared with whom.",
        },
        priority: "soon",
      },
    ],
  },
  {
    key: "threat",
    icon: <MessageSquareWarning className="h-6 w-6" aria-hidden />,
    question: {
      bn: "আপনি কি হুমকি, ব্ল্যাকমেইল বা হয়রানির শিকার হচ্ছেন?",
      en: "Are you experiencing threats, blackmail or harassment?",
    },
    steps: [
      {
        title: { bn: "সাড়া দেবেন না, টাকাও না", en: "Do not respond, do not pay" },
        detail: {
          bn: "হুমকির সাড়া দিলে বা টাকা দিলে হুমকি বাড়ে — একবার দিলে বারবার চাইবে। সংযোগ বন্ধ রাখুন।",
          en: "Responding or paying escalates the threats — one payment invites endless demands. Cut contact.",
        },
        priority: "now",
      },
      {
        title: { bn: "প্রমাণ সংরক্ষণ করে ৯৯৯-এ জানান", en: "Preserve evidence and inform 999" },
        detail: {
          bn: "হুমকির মেসেজ/কলের স্ক্রিনশট, নম্বর ও সময় রাখুন (মুছবেন না) এবং ৯৯৯-এ বা থানায় অভিযোগ করুন। সাইবার হয়রানির জন্য সাইবার ট্রাইব্যুনাল প্রযোজ্য।",
          en: "Screenshot the threats (do not delete), keep numbers and times, and report via 999 or your police station. Cyber harassment falls under the Cyber Tribunal.",
        },
        priority: "now",
      },
      {
        title: { bn: "একা না ভুলে পরিবারকে জানান", en: "Tell your family — do not face it alone" },
        detail: {
          bn: "লজ্জার ভয়ে নীরব থাকবেন না — পরিবারের কারো জানা থাকলে চাপ কমে ও সঠিক পদক্ষেপ নেওয়া সহজ হয়।",
          en: "Do not stay silent out of shame — a family member's support reduces pressure and helps you act correctly.",
        },
        priority: "soon",
      },
    ],
  },
];

const PREVENTION: Step[] = [
  {
    title: { bn: "কোনো কোড বা পিন কাউকে দেবেন না", en: "Never share codes or PINs with anyone" },
    detail: {
      bn: "ব্যাংক, বিকাশ, নগদ, পুলিশ — কেউই কখনো চায় না। চাইলেই সেটি প্রতারণা।",
      en: "Banks, bKash, Nagad, police — nobody legitimate ever asks. Anyone who does is a scammer.",
    },
    priority: "now",
  },
  {
    title: { bn: "টাকার বিষয়ে স্বাধীনভাবে যাচাই করুন", en: "Verify independently before any money moves" },
    detail: {
      bn: "নিজে অ্যাপ খুলে বা অফিসিয়াল নম্বরে কল করে দাবিটি যাচাই করুন — বার্তার নম্বরে নয়।",
      en: "Open the app yourself or call the official number — never a number from the message.",
    },
    priority: "now",
  },
  {
    title: { bn: "অজানা লিংক/অ্যাপ থেকে দূরে থাকুন", en: "Avoid unknown links and apps" },
    detail: {
      bn: "লগইন/ভেরিফাই চায় এমন লিংকে ক্লিক করবেন না; কারও বলায় অ্যাপ ইনস্টল বা স্ক্রিন শেয়ার করবেন না।",
      en: "Never click links asking for logins; never install apps or share screens on request.",
    },
    priority: "soon",
  },
];

export default function RecoveryPage() {
  const bn = useLang() === "bn";
  const prefersReduced = useReducedMotion();
  const { path } = useHashRoute();
  const tabParam = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("tab") : null;
  const defaultTab = tabParam === "agent" || tabParam === "faq" ? tabParam : "emergency";
  const [answers, setAnswers] = useState<Record<SituationKey, boolean>>({
    money: false,
    otp: false,
    app: false,
    info: false,
    threat: false,
  });
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);

  useEffect(() => {
    api
      .get<{ resources: Resource[] }>('/api/v1/resources')
      .then((r) => setResources(r.resources))
      .catch(() => setResources([]))
      .finally(() => setLoadingRes(false));
  }, []);

  const anyYes = Object.values(answers).some(Boolean);

  // COU TECHNOVA 2026 (Challenge 2): the second one-tap card used to be a
  // HARDCODED bKash 16247 number, which could contradict the directory if it
  // changes. It now renders the currently-ELIGIBLE mfs contact straight from
  // the verified directory (fallback snapshot is never shown as actionable).
  const eligibleMfs = resources.find((r) => r.category === "mfs" && r.phone && r.eligible !== false && (r.exclusionReasons ?? []).length === 0);

  const checklist = anyYes
    ? SITUATIONS.filter((s) => answers[s.key]).flatMap((s) => s.steps)
    : PREVENTION;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {/* header — one Support home: emergency + AI assistant + FAQ */}
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#A44435]">
          <Siren className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "সহায়তা" : "Support"}
          </h1>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "জরুরি ধাপ, এআই সহকারী ও সাধারণ প্রশ্ন — সব এক জায়গায়। বিপদে হলে নিচের নম্বরগুলো এখনই কাজে লাগবে।"
              : "Emergency steps, the AI assistant and common questions — all in one place."}
          </p>
        </div>
      </div>

      {/* one-tap emergency numbers — always visible, above the tabs */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="tel:999"
          className="rounded-xl border-2 border-[#A44435] bg-[#FFFEFA] px-4 py-3.5 flex items-center gap-3 hover:bg-[#F4E1DA] transition-colors focus-ring"
        >
          <PhoneCall className="h-6 w-6 text-[#A44435] shrink-0" aria-hidden />
          <span>
            <span className="block text-xl font-bold text-[#A44435] bn-text">৯৯৯</span>
            <span className="block text-xs text-[#59665F] bn-text">{bn ? "জাতীয় জরুরি সেবা" : "National emergency"}</span>
          </span>
        </a>
        {eligibleMfs && eligibleMfs.phone ? (
          <a
            href={`tel:${eligibleMfs.phone}`}
            className="rounded-xl border-2 border-[#2F5746]/40 bg-[#FFFEFA] px-4 py-3.5 flex items-center gap-3 hover:bg-[#DDE8DF] transition-colors focus-ring"
            aria-label={bn ? `${eligibleMfs.name.bn} — নিজে কল করুন (ডিরেক্টরি থেকে)` : `${eligibleMfs.name.en} — call yourself (from the directory)`}
          >
            <ShieldCheck className="h-6 w-6 text-[#2F5746] shrink-0" aria-hidden />
            <span>
              <span className="block text-xl font-bold text-[#2F5746] bn-text">{eligibleMfs.phone}</span>
              <span className="block text-xs text-[#59665F] bn-text">
                {bn ? `${eligibleMfs.name.bn} (নিজে কল করুন · ডিরেক্টরির বর্তমান যাচাঈকৃত)` : `${eligibleMfs.name.en} (call yourself · current verified directory)`}
              </span>
            </span>
          </a>
        ) : (
          <div
            className="rounded-xl border-2 border-[#C9C2B2] bg-[#F4F1EB] px-4 py-3.5 flex items-center gap-3"
            aria-live="polite"
          >
            <ShieldCheck className="h-6 w-6 text-[#7A756A] shrink-0" aria-hidden />
            <span>
              <span className="block text-base font-bold text-[#59665F] bn-text">
                {bn ? "এমএফএস হেল্পলাইন — বর্তমান যাচাঈকৃত তথ্য নেই" : "MFS helpline — no current verified entry"}
              </span>
              <span className="block text-xs text-[#7A756A] bn-text">
                {bn
                  ? "নম্বর বানিয়ে দেওয়া হয় না — নিজে অ্যাপের ভেতরের হেল্প বা কার্ডে ছাপা নম্বর থেকে যোগাযোগ করুন।"
                  : "We will not fabricate a number — use in-app support or the number printed on your card."}
              </span>
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-3 bg-[#EDEAE1] p-1.5 rounded-xl">
          <TabsTrigger
            value="emergency"
            className="rounded-lg py-2.5 px-2 text-[13px] sm:text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
          >
            <Siren className="h-4 w-4" aria-hidden />
            {bn ? "জরুরি ধাপ" : "Emergency"}
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="rounded-lg py-2.5 px-2 text-[13px] sm:text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
          >
            <Bot className="h-4 w-4" aria-hidden />
            {bn ? "শিল্ডএজেন্ট" : "AI assistant"}
          </TabsTrigger>
          <TabsTrigger
            value="faq"
            className="rounded-lg py-2.5 px-2 text-[13px] sm:text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
            {bn ? "সাধারণ প্রশ্ন" : "FAQ"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emergency" className="space-y-8">
      {/* triage */}
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5 md:p-6 space-y-3">
          <p className="font-bold text-[#202C26] bn-text">{bn ? "আপনার পরিস্থিতি বলুন:" : "Tell us your situation:"}</p>
          {SITUATIONS.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                "rounded-xl border-2 p-4 transition-colors",
                answers[s.key] ? "border-[#A44435] bg-[#F4E1DA]/60" : "border-[#D8DED5] bg-[#FFFEFA] hover:border-[#8A5B28]/40"
              )}
            >
              <label className="flex items-start gap-4 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={answers[s.key]}
                  onClick={() => setAnswers((a) => ({ ...a, [s.key]: !a[s.key] }))}
                  className={cn(
                    "mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors focus-ring",
                    answers[s.key] ? "border-[#A44435] bg-[#A44435]" : "border-[#D8DED5] bg-[#EDEAE1]"
                  )}
                >
                  <span
                    className={cn(
                      "ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      answers[s.key] && "translate-x-5"
                    )}
                  />
                </button>
                <span className="flex items-start gap-3">
                  <span className={cn("shrink-0", answers[s.key] ? "text-[#A44435]" : "text-[#2F5746]")}>{s.icon}</span>
                  <span className={cn("font-medium bn-text", answers[s.key] ? "text-[#8C382B]" : "text-[#202C26]")}>
                    {s.question[bn ? "bn" : "en"]}
                  </span>
                </span>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* checklist */}
      <section aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="flex items-center gap-2.5 text-xl md:text-2xl font-bold text-[#202C26] bn-text">
          <ShieldCheck className="h-6 w-6 text-[#2F5746]" aria-hidden />
          {anyYes
            ? bn ? "আপনার জন্য জরুরি পদক্ষেপ" : "Your emergency steps"
            : bn ? "প্রতিরোধের ধাপগুলো" : "Prevention steps"}
        </h2>
        <div className="mt-4 space-y-3">
          {checklist.map((step, i) => (
            <motion.div
              key={i}
              initial={prefersReduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
            >
              <Card className={cn("border-2 bg-[#FFFEFA]", step.priority === "now" ? "border-[#A44435]/60" : "border-[#D8DED5]")}>
                <CardContent className="p-4 md:p-5 flex gap-4">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      step.priority === "now" ? "bg-[#A44435] text-[#FFFEFA]" : "bg-[#DDE8DF] text-[#2F5746]"
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-[#202C26] bn-text">
                      {step.title[bn ? "bn" : "en"]}
                      {step.priority === "now" && (
                        <Badge className="ml-2 bg-[#F4E1DA] text-[#A44435] hover:bg-[#F4E1DA] border-0 bn-text">
                          {bn ? "এখনই" : "Now"}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-1 text-[15px] text-[#59665F] leading-relaxed bn-text">{step.detail[bn ? "bn" : "en"]}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* recovery scam warning */}
      <WarnNote title={bn ? "দ্বিতীয় প্রতারণার সতর্কতা" : "Recovery-scam warning"}>
        {bn
          ? "ক্ষতির পর কেউ যদি বলে 'টাকা ফেরত পাইয়ে দেবো, আগে ফি/কমিশন দাও' — সেটি প্রায় নিশ্চিতভাবেই দ্বিতীয় প্রতারণা। বাংলাশিল্ড বা কোনো বৈধ প্রতিষ্ঠান টাকা ফেরতের নিশ্চয়তা দেয় না। কেউ 'হ্যাকার' বা 'সাইবার এক্সপার্ট' পরিচয়ে ফি চাইলে সরাসরি প্রত্যাখ্যান করুন।"
          : "If someone offers to 'recover your money for a fee' — that is almost certainly a second scam. Neither BanglaShield nor any legitimate institution guarantees fund recovery. Reject anyone posing as a 'hacker' or 'cyber expert' asking for fees."}
      </WarnNote>

      {/* verified resources */}
      <section aria-labelledby="contacts-heading">
        <h2 id="contacts-heading" className="text-xl md:text-2xl font-bold text-[#202C26] bn-text">
          {bn ? "যাচাইকৃত অফিসিয়াল যোগাযোগ" : "Verified official contacts"}
        </h2>
        <p className="mt-1 text-sm text-[#59665F] bn-text">
          {bn
            ? "নিচের ঠিকানা/নম্বরগুলো প্রতিষ্ঠানের অফিসিয়াল উৎস থেকে সংগৃহীত ও তারিখসহ যাচাইকৃত।"
            : "The following contacts come from each institution's official source, with verification dates."}
        </p>
        {loadingRes ? (
          <div className="mt-4 flex items-center gap-2 text-[#59665F]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {bn ? "লোড হচ্ছে…" : "Loading…"}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {resources.map((r) => (
              <Card key={r.key} className="border-[#D8DED5] bg-[#FFFEFA]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#202C26] bn-text">{r.name[bn ? "bn" : "en"]}</p>
                    <CheckCircle2 className="h-4 w-4 text-[#2F5746] shrink-0" aria-label={bn ? "যাচাইকৃত" : "Verified"} />
                  </div>
                  <p className="mt-1 text-sm text-[#59665F] leading-relaxed bn-text">{r.guidance[bn ? "bn" : "en"]}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {r.phone && (
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F5746] px-3 py-1.5 text-sm font-bold text-[#FFFEFA] hover:bg-[#24453A] focus-ring"
                      >
                        <PhoneCall className="h-3.5 w-3.5" aria-hidden /> {r.phone}
                      </a>
                    )}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8DED5] px-3 py-1.5 text-sm font-semibold text-[#2F5746] hover:bg-[#DDE8DF] focus-ring"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {bn ? "ওয়েবসাইট" : "Website"}
                    </a>
                  </div>
                  <p className="mt-2 text-[11px] text-[#7D9C8B]">
                    {bn ? "যাচাই:" : "Verified:"} {new Date(r.verifiedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")} · {r.sourceUrl.replace(/^https?:\/\//, "").slice(0, 42)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* next: report */}
      <Card className="border-2 border-[#2F5746]/40 bg-[#FFFEFA]">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-[#202C26] bn-text">
              {bn ? "ঘটনাটি রিপোর্ট করে অন্যদের সতর্ক করুন" : "Report the incident to warn others"}
            </p>
            <p className="text-sm text-[#59665F] bn-text">
              {bn ? "বেনামে, ঐচ্ছিক — আপনার দেওয়া তথ্য থেকে অন্য মানুষ সাবধান হতে পারবে।" : "Anonymous, optional — your report helps others stay alert."}
            </p>
          </div>
          <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2 font-bold">
            <Link to="/community">
              {bn ? "রিপোর্ট করুন" : "Report now"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="agent">
          <AgentChat />
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          {FAQS.map((f, i) => (
            <Card key={i} className="border-[#D8DED5] bg-[#FFFEFA]">
              <CardContent className="p-4 md:p-5">
                <p className="font-bold text-[#202C26] bn-text">{f.q[bn ? "bn" : "en"]}</p>
                <p className="mt-2 text-[15px] text-[#59665F] leading-relaxed bn-text">{f.a[bn ? "bn" : "en"]}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="border-[#D8DED5] bg-[#DDE8DF]/30">
            <CardContent className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <p className="flex-1 text-sm text-[#59665F] bn-text">
                {bn
                  ? "আরও প্রশ্ন? শিল্ডএজেন্টকে জিজ্ঞেস করুন বা কমিউনিটির সাহায্য বোর্ডে লিখুন।"
                  : "More questions? Ask ShieldAgent or post on the community help board."}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="outline" className="border-[#2F5746]/40 text-[#2F5746] hover:bg-[#DDE8DF] h-11 gap-1.5 font-semibold">
                  <Link to="/help?tab=agent">
                    <Bot className="h-4 w-4" aria-hidden /> {bn ? "এআই সহকারী" : "AI assistant"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-[#2F5746]/40 text-[#2F5746] hover:bg-[#DDE8DF] h-11 font-semibold">
                  <Link to="/community?tab=help">{bn ? "কমিউনিটি" : "Community"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const FAQS: { q: { bn: string; en: string }; a: { bn: string; en: string } }[] = [
  {
    q: {
      bn: "বাংলাশিল্ড কি আমার ফোনের কল বা মেসেজ নিজে থেকে পড়ে?",
      en: "Does BanglaShield automatically read my calls or messages?",
    },
    a: {
      bn: "না — কখনোই না। বাংলাশিল্ড আপনার ফোনের কিছু ট্র্যাক করে না, কোনো অ্যাপে ঢুকে মেসেজ পড়ে না। আপনি নিজে থেকে যা শেয়ার করেন (বার্তা পেস্ট, অডিও, স্ক্রিনশট বা লিংক) শুধু সেটাই প্রক্রিয়া হয় — সম্মতি দেওয়ার পরে। কণ্ঠস্বর ও ছবি সার্ভারে সংরক্ষণও হয় না।",
      en: "No — never. BanglaShield tracks nothing on your phone and reads no apps. Only what YOU choose to share (a pasted message, audio, screenshot or link) is processed, after you consent. Voice and images are never stored either.",
    },
  },
  {
    q: {
      bn: "ফলাফল কি ১০০% নির্ভরযোগ্য?",
      en: "Are the results 100% reliable?",
    },
    a: {
      bn: "না। বিশ্লেষণ সহায়তামাত্র — প্রতিটি ফলাফলে প্রমাণের উদ্ধৃতি দেওয়া থাকে আর কী জানা যায়নি সেটাও লেখা থাকে। চূড়ান্ত সিদ্ধান্ত নেওয়ার আগে প্রতিষ্ঠানের আসল নম্বরে নিজে যাচাই করুন।",
      en: "No. Analyses are decision support — every result quotes its evidence and states what remains unknown. Verify independently through the institution's real number before acting.",
    },
  },
  {
    q: {
      bn: "রিপোর্ট দিলে কী হয়? কে দেখেন?",
      en: "What happens to my report? Who reviews it?",
    },
    a: {
      bn: "রিপোর্ট প্রথমে বিশ্লেষকদের রিভিউ-কিউতে যায়। একজন মানব-মডারেটর যাচাই করে অনুমোদিত হলে সতর্কতা হিসেবে প্রকাশ পায় (ব্যক্তিগত তথ্য বাদ দিয়ে)। আপনি রেফারেন্স আইডি দিয়ে যেকোনো সময় অবস্থা দেখতে পারেন বা প্রত্যাহার করতে পারেন।",
      en: "Reports enter the analyst review queue. A human moderator verifies; approved ones publish as alerts (personal data removed). You can track status or withdraw anytime using your reference ID.",
    },
  },
  {
    q: {
      bn: "টাকা হারিয়ে ফেলেছি — বাংলাশিল্ড কি ফেরত দেবে?",
      en: "I lost money — will BanglaShield recover it?",
    },
    a: {
      bn: "না, বাংলাশিল্ড টাকা ফেরতের নিশ্চয়তা দেয় না — এমন দাবি করলেই সেটি দ্বিতীয় প্রতারণা। তবে “জরুরি ধাপ” ট্যাবের ধাপগুলো দ্রুত অনুসরণ করলে থামানোর সম্ভাবনা বাড়ে: এখনই ব্যাংক/এমএফএস-কে নিজে জানান, প্রমাণ রাখুন, ৯৯৯/সাইবার ট্রাইব্যুনালে অভিযোগ করুন।",
      en: "No — BanglaShield never guarantees recovery; anyone claiming so is running a second scam. But the Emergency tab steps raise the odds: notify your bank/MFS yourself immediately, preserve evidence, and file with 999 / the Cyber Tribunal.",
    },
  },
  {
    q: {
      bn: "অ্যাকাউন্ট খুলতে কী কী তথ্য লাগে?",
      en: "What information do you need to open an account?",
    },
    a: {
      bn: "শুধু একটি নাম, ইউজারনেম ও পাসওয়ার্ড — ফোন নম্বর, ইমেইল বা ঠিকানা লাগে না। প্রত্যেক সদস্য একটি ইউনিক আইডি পান (যেমন BSA-7F3K9Q), যা আপনার পাবলিক পরিচয়।",
      en: "Just a name, username and password — no phone, email or address. Each member gets a unique ID (e.g. BSA-7F3K9Q) that serves as your public identity.",
    },
  },
];
