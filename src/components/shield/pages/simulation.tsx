"use client";

// ---------------------------------------------------------------------------
// Interactive Scam Simulation Laboratory (ScamAcademy 2.0).
//
// A safe practice environment: citizens walk through realistic scam scenarios
// and make decisions at each step, immediately seeing the educational
// consequence of their choice. Consequences are always hypothetical — clearly
// labeled — and every step ends with the protective takeaway.
//
// Simulations are COMPLETELY SEPARATE from real reports and investigations:
// nothing here is submitted, stored on the server, or linked to any case.
// Progress is saved locally (device-only) alongside lesson progress.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FlaskConical,
  PhoneCall,
  Briefcase,
  QrCode,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLang } from "../i18n";
import { cn } from "@/lib/utils";
import type { Bilingual } from "@/lib/types";

interface SimOption {
  id: string;
  label: Bilingual;
  safe: boolean;
  consequence: Bilingual; // what could happen next (hypothetical)
  explanation: Bilingual; // protective takeaway
}

interface SimBeat {
  situation: Bilingual;
  options: SimOption[];
}

interface SimScenario {
  id: string;
  title: Bilingual;
  minutes: number;
  icon: React.ReactNode;
  beats: SimBeat[];
}

const HYPOTHetical_NOTE = {
  bn: "পরিণতিগুলো শিক্ষামূলক অনুমান — বাস্তব ঘটনা নয়।",
  en: "Consequences are educational hypotheticals — not real events.",
};

const SCENARIOS: SimScenario[] = [
  {
    id: "sim-otp-call",
    title: { bn: "কল: “আপনার বিকাশ একাউন্ট বন্ধ হচ্ছে”", en: "The call: “Your bKash account is being blocked”" },
    minutes: 3,
    icon: <PhoneCall className="h-7 w-7" aria-hidden />,
    beats: [
      {
        situation: {
          bn: "বিকালে ফোন এলো। প্রেরক: “স্যার, আমি বিকাশ টিম থেকে বলছি। আপনার একাউন্টে সন্দেহজনক লেনদেন হয়েছে, একাউন্ট সাসপেন্ড হবে। এখনই সমস্যাটা ঠিক করতে হবে।” তার কণ্ঠ গম্ভীর, পেছনে কল-সেন্টারের শব্দ। আপনি কী করবেন?",
          en: "An afternoon call. The caller: “Sir, this is the bKash team. A suspicious transaction hit your account and it will be suspended. We must fix this right now.” Serious voice, call-center noise behind. What do you do?",
        },
        options: [
          {
            id: "a",
            safe: false,
            label: { bn: "“হ্যাঁ, ঠিক করুন” — যা বলছে শুনি", en: "“Yes, fix it” — follow the caller's lead" },
            consequence: {
              bn: "প্রতারক ভরসা পেয়ে যাবে; এরপর সে ওটিপি চাইবে (সম্ভাব্য)।",
              en: "The scammer gains trust and will next ask for your OTP (hypothetical).",
            },
            explanation: {
              bn: "আসল প্রতিষ্ঠান কখনো ফোন করে একাউন্ট বন্ধের খবর দিয়ে তাড়াহুড়ো করায় না — এই তাড়াহুড়োই প্রতারণার প্রথম লক্ষণ।",
              en: "Real institutions never call to rush you about account closure — urgency itself is the first scam marker.",
            },
          },
          {
            id: "b",
            safe: true,
            label: { bn: "শান্তভাবে কল কেটে নিজে অ্যাপ খুলে দেখি", en: "Calmly hang up and check the app myself" },
            consequence: {
              bn: "অ্যাপে কোনো সমস্যা দেখা যাবে না — কলটি ভুয়া ছিল (সম্ভাব্য)।",
              en: "The app shows nothing wrong — the call was fake (hypothetical).",
            },
            explanation: {
              bn: "নিজের অ্যাপ খুলে দেখাই সবচেয়ে নির্ভরযোগ্য প্রথম ধাপ; কারও কথায় আতঙ্কিত হওয়ার আগে নিজে যাচাই করুন।",
              en: "Checking your own app is the most reliable first step — verify before you let anyone frighten you.",
            },
          },
          {
            id: "c",
            safe: false,
            label: { bn: "নম্বরটা সেভ করে পরে ফিরিয়ে কল দেই", en: "Save the number and call back later" },
            consequence: {
              bn: "প্রতারকের নম্বরে কল দিলে সে আবার একই ফাঁদে ফেলবে (সম্ভাব্য)।",
              en: "Calling the scammer's number back walks you into the same trap again (hypothetical).",
            },
            explanation: {
              bn: "যে নম্বর থেকে কল এসেছে সেটাই প্রতারণার হাতিয়ার হতে পারে — ফেরত কল নয়, অ্যাপের হেল্পলাইন ব্যবহার করুন।",
              en: "The incoming number itself may be the scammer's tool — use the app's official helpline, never call back.",
            },
          },
        ],
      },
      {
        situation: {
          bn: "কলকারী এখন বলছে: “একাউন্ট বাঁচাতে আপনার যে ওটিপি এসেছে, সেটা আমাকে বলুন — দেরি করলে সব টাকা ফ্রিজ হয়ে যাবে।” ঠিক তখনই আপনার ফোনে একটা কোড এলো। এখন?",
          en: "Now the caller says: “To save the account, tell me the OTP that just arrived — or all your money will be frozen.” A code pops up on your phone at that very moment. Now?",
        },
        options: [
          {
            id: "a",
            safe: false,
            label: { bn: "কোডটা বলে দিই — টাকা তো বাঁচাতে হবে", en: "Read out the code — I must save my money" },
            consequence: {
              bn: "প্রতারক ওই কোড দিয়েই আপনার হয়ে টাকা তুলে নিতে পারে (সম্ভাব্য)।",
              en: "With that code the scammer may transact as you and drain money (hypothetical).",
            },
            explanation: {
              bn: "ওটিপি মানেই আপনার হয়ে লেনদেনের চাবি — কেউ এটা চাইলেই সে প্রতারক, তাড়াহুড়ো যতই থাকুক।",
              en: "An OTP is the key to transact as you — anyone asking for it is a scammer, no matter the urgency.",
            },
          },
          {
            id: "b",
            safe: true,
            label: { bn: "কল কেটে ১৬২৪৭-এ নিজে কল করে জানতে চাই", en: "Hang up and dial 16247 myself to ask" },
            consequence: {
              bn: "বিকাশ জানাবে কোনো সাসপেনশন নেই — কোডটা প্রতারকই পাঠিয়েছিল (সম্ভাব্য)।",
              en: "bKash will confirm there is no suspension — the code itself was scammer-triggered (hypothetical).",
            },
            explanation: {
              bn: "নিজে অফিসিয়াল হেল্পলাইনে কল করাই সঠিক যাচাই; প্রতারকরা আসল লেনদেনের কোড দিয়ে সুযোগ নেয়।",
              en: "Calling the official helpline yourself is the correct verification — scammers abuse codes from real transactions.",
            },
          },
          {
            id: "c",
            safe: false,
            label: { bn: "অর্ধেক বলে দিই — পুরো কোড তো দিলাম না", en: "Give half the code — not the whole thing" },
            consequence: {
              bn: "কোডের যেকোনো অংশও ফাঁদ হিসেবে ব্যবহার হতে পারে (সম্ভাব্য)।",
              en: "Even part of a code can be weaponized (hypothetical).",
            },
            explanation: {
              bn: "আংশিক গোপনীয়তা বলে কিছু নেই — কোডের কোনো অংশই কাউকে বলা নিরাপদ নয়।",
              en: "There is no 'partial secrecy' — no part of a code is safe to share.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "sim-fake-job",
    title: { bn: "চাকরির অফার: “মাসে ২৫,০০০ — শুধু রেজিস্ট্রেশন ফি ৩০০”", en: "Job offer: “Tk 25,000/month — just a Tk 300 registration fee”" },
    minutes: 3,
    icon: <Briefcase className="h-7 w-7" aria-hidden />,
    beats: [
      {
        situation: {
          bn: "ফেসবুক মেসেঞ্জারে একটি “অফিসিয়াল” পেজ থেকে মেসেজ: “সরকারি প্রকল্পে ডাটা এন্ট্রি চাকরি। মাসে ২৫,০০০ টাকা, ঘরে বসে কাজ। আবেদন শেষ আজ রাত ১২টা।” লিংকে ক্লিক করলে একটি ফর্ম, শেষে “রেজিস্ট্রেশন ফি ৩০০ টাকা বিকাশ পার্সোনালে পাঠান।” আপনার প্রথম প্রতিক্রিয়া?",
          en: "A messenger message from an “official” page: “Government data-entry job. Tk 25,000/month, work from home. Applications close tonight at 12.” The link opens a form ending with: “Send the Tk 300 registration fee to this bKash personal number.” Your first reaction?",
        },
        options: [
          {
            id: "a",
            safe: false,
            label: { bn: "৩০০ টাকা তো সামান্য — আবেদন করে ফেলি", en: "Tk 300 is small — just apply" },
            consequence: {
              bn: "টাকা যাওয়ার পর নতুন “ফি” চাওয়া হবে, চাকরি কোথাও আসবে না (সম্ভাব্য)।",
              en: "After payment a new “fee” will be demanded; the job never materializes (hypothetical).",
            },
            explanation: {
              bn: "আসল নিয়োগকর্তা প্রার্থীর কাছ থেকে আগে টাকা চায় না — “আগে ফি, পরে চাকরি” অগ্রিম-ফি প্রতারণার ক্লাসিক নকশা।",
              en: "Legitimate employers never charge candidates first — “fee before job” is the classic advance-fee design.",
            },
          },
          {
            id: "b",
            safe: true,
            label: { bn: "সরকারি হলে এমন পেজে নয় — আসল খবরের সূত্রে খুঁজে দেখি", en: "A government scheme wouldn't be on this page — check genuine news sources" },
            consequence: {
              bn: "খোঁজ নিলে দেখা যাবে এমন কোনো নিয়োগ বিজ্ঞপ্তি নেই (সম্ভাব্য)।",
              en: "A quick search will show no such job circular exists (hypothetical).",
            },
            explanation: {
              bn: "সরকারি নিয়োগ সবসময় অফিসিয়াল ওয়েবসাইট/খবরের কাগজে প্রকাশ পায় — মেসেঞ্জারে “শেষ রাত ১২টা” চাপ দিয়ে টাকা চাওয়া প্রতারণা।",
              en: "Government hiring is published on official sites and newspapers — a midnight deadline in messenger demanding money is fraud.",
            },
          },
          {
            id: "c",
            safe: false,
            label: { bn: "পেজে “ভেরিফায়েড” ব্যাজ আছে — নিশ্চয়ই আসল", en: "The page has a “verified” badge — must be real" },
            consequence: {
              bn: "ভুয়া ভেরিফিকেশন ব্যাজ কিনতে হয় না — ফাঁদই থাকতে পারে (সম্ভাব্য)।",
              en: "Fake verification badges are trivial to obtain — it can still be a trap (hypothetical).",
            },
            explanation: {
              bn: "ব্যাজ প্রমাণ নয়; প্রমাণ হলো অফিসিয়াল ওয়েবসাইটে বিজ্ঞপ্তির অস্তিত্ব ও কোনো অগ্রিম ফি না চাওয়া।",
              en: "Badges are not proof; proof is a circular on the official website and zero advance fees.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "sim-qr-shop",
    title: { bn: "দোকানে কিউআর: “স্ক্যান করে টাকা পাঠান”", en: "The shop QR: “Scan and send the money”" },
    minutes: 3,
    icon: <QrCode className="h-7 w-7" aria-hidden />,
    beats: [
      {
        situation: {
          bn: "মোবাইল সার্ভিসিং শপে ১,২০০ টাকার কাজ। দোকানি বলল: “ক্যাশ নেই ভাই, এই কিউআর স্ক্যান করে পার্সোনালে পাঠান।” কিউআরের নিচে অন্য একটি নাম লেখা। আপনি কী করবেন?",
          en: "At a phone repair shop the bill is Tk 1,200. The shopkeeper says: “No cash, bro — scan this QR and send it personal.” Under the QR is a different person's name. What do you do?",
        },
        options: [
          {
            id: "a",
            safe: false,
            label: { bn: "দোকান তো দোকানই — স্ক্যান করে টাকা পাঠাই", en: "A shop is a shop — scan and pay" },
            consequence: {
              bn: "নাম না মিললে টাকা অন্য অ্যাকাউন্টে যেতে পারে; দাবি প্রমাণ কঠিন (সম্ভাব্য)।",
              en: "A mismatched name may mean the money lands in someone else's account; proving your claim is hard (hypothetical).",
            },
            explanation: {
              bn: "পেমেন্টের আগে প্রাপকের নাম অবশ্যই মিলিয়ে নিন — নাম না মিললে টাকা পাঠাবেন না, ভিন্ন মাধ্যম চান।",
              en: "Always match the recipient name before paying — if the name doesn't match, refuse and ask for another method.",
            },
          },
          {
            id: "b",
            safe: true,
            label: { bn: "নাম না মিলিয়ে টাকা পাঠাই না — মার্চেন্ট/ক্যাশ চাই", en: "Name mismatch — I'll ask for merchant payment or cash" },
            consequence: {
              bn: "সঠিক মার্চেন্ট পেমেন্টে রিসিট ও প্রতারণা-সুরক্ষা পাওয়া যায় (সম্ভাব্য)।",
              en: "A proper merchant payment gives you a receipt and fraud protection (hypothetical).",
            },
            explanation: {
              bn: "মার্চেন্ট পেমেন্টে ট্রানজেকশন রেকর্ড ভালো থাকে ও সহায়তা পাওয়া সহজ; “পার্সোনালে পাঠান” চাপানো নিজেই সতর্কতার লক্ষণ।",
              en: "Merchant payments keep clean records and make support easy; pressure to “send personal” is itself a warning sign.",
            },
          },
          {
            id: "c",
            safe: false,
            label: { bn: "অর্ধেক এখন, বাকি কাজ শেষে", en: "Pay half now, the rest after the work" },
            consequence: {
              bn: "নাম না মিলা অ্যাকাউন্টে অর্ধেকও ফেরত পাওয়া কঠিন (সম্ভাব্য)।",
              en: "Even the half payment is hard to recover from a mismatched account (hypothetical).",
            },
            explanation: {
              bn: "পরিমাণ যা-ই হোক, ভুল প্রাপকে যাওয়া টাকাই ক্ষতি — আগে নাম মিলান, পরে পরিমাণ।",
              en: "Whatever the amount, money to the wrong recipient is a loss — match the name first, amount later.",
            },
          },
        ],
      },
    ],
  },
];

export function SimulationLab({
  onFinish,
  completed,
}: {
  onFinish: (simId: string, score: number, total: number) => void;
  completed: Record<string, { score: number; total: number }>;
}) {
  const bn = useLang() === "bn";
  const [active, setActive] = useState<SimScenario | null>(null);

  if (active) {
    return <SimRunner scenario={active} onExit={() => setActive(null)} onFinish={onFinish} />;
  }

  return (
    <div>
      <div className="rounded-2xl border-2 border-dashed border-[#8A5B28]/50 bg-[#F2E8D5]/50 p-5 mb-6">
        <p className="flex items-start gap-3 text-sm text-[#59665F] leading-relaxed bn-text">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#8A5B28]" aria-hidden />
          <span>
            {bn
              ? "এটি নিরাপদ অনুশীলন পরিবেশ — সব ঘটনা কাল্পনিক ও শিক্ষামূলক। এখানে কোনো কিছু সার্ভারে জমা হয় না, কোনো রিপোর্ট বা তদন্তের সাথে সম্পর্কিত নয়। প্রগতি শুধু আপনার ডিভাইসেই থাকে।"
              : "This is a safe practice environment — all scenarios are fictional and educational. Nothing is submitted to a server, and nothing here is linked to real reports or investigations. Progress stays on your device only."}
          </span>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((s) => {
          const p = completed[s.id];
          return (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className={cn(
                "text-left rounded-2xl focus-ring border-2 transition-all group hover:shadow-md",
                p ? "border-[#2F5746]/60 bg-[#FFFEFA]" : "border-[#D8DED5] bg-[#FFFEFA] hover:border-[#8A5B28]/60"
              )}
            >
              <Card className="h-full border-0 bg-transparent shadow-none">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2E8D5] text-[#8A5B28]">
                      {s.icon}
                    </span>
                    {p && (
                      <Badge className="bg-[#DDE8DF] text-[#2F5746] hover:bg-[#DDE8DF] border-0 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {p.score}/{p.total}
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-3 font-bold text-[#202C26] leading-snug bn-text">{s.title[bn ? "bn" : "en"]}</h3>
                  <p className="mt-1 text-xs text-[#59665F]">{s.minutes} {bn ? "মিনিট" : "min"}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#8A5B28]">
                    {bn ? "অনুশীলন শুরু করুন" : "Start practice"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimRunner({
  scenario,
  onExit,
  onFinish,
}: {
  scenario: SimScenario;
  onExit: () => void;
  onFinish: (simId: string, score: number, total: number) => void;
}) {
  const bn = useLang() === "bn";
  const prefersReduced = useReducedMotion();
  const [beatIdx, setBeatIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const beat = scenario.beats[beatIdx];
  const option = useMemo(() => beat?.options.find((o) => o.id === picked) ?? null, [beat, picked]);

  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    const opt = beat.options.find((o) => o.id === id);
    setAnswers((a) => [...a, Boolean(opt?.safe)]);
  };

  const next = () => {
    if (beatIdx + 1 >= scenario.beats.length) {
      const score = answers.filter(Boolean).length;
      setFinished(true);
      onFinish(scenario.id, score, scenario.beats.length);
    } else {
      setBeatIdx((i) => i + 1);
      setPicked(null);
    }
  };

  if (finished) {
    const score = answers.filter(Boolean).length;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="border-2 border-[#8A5B28]/40 bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-4">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2E8D5]">
              <Award className="h-8 w-8 text-[#8A5B28]" aria-hidden />
            </span>
            <h2 className="text-xl font-bold text-[#202C26] bn-text">{scenario.title[bn ? "bn" : "en"]}</h2>
            <p className="text-[#59665F] bn-text">
              {bn ? "নিরাপদ সিদ্ধান্ত" : "Safe decisions"}: <strong className="text-[#2F5746]">{score}</strong> / {scenario.beats.length}
            </p>
            <ul className="text-left space-y-2">
              {scenario.beats.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {answers[i] ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2F5746]" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#A44435]" aria-hidden />
                  )}
                  <span className="text-[#59665F] bn-text">
                    {bn ? "ধাপ" : "Step"} {i + 1}: {b.options.find((o) => o.safe)?.explanation[bn ? "bn" : "en"]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setBeatIdx(0);
                  setPicked(null);
                  setAnswers([]);
                  setFinished(false);
                }}
                className="border-[#8A5B28]/50 text-[#8A5B28] gap-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> {bn ? "আবার" : "Retry"}
              </Button>
              <Button onClick={onExit} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2">
                {bn ? "ল্যাবে ফিরুন" : "Back to lab"} <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onExit} className="text-[#59665F] gap-1.5 focus-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {bn ? "সিমুলেশন ল্যাব" : "Simulation lab"}
        </Button>
        <p className="text-sm font-semibold text-[#59665F] tabular-nums">
          {bn ? "ধাপ" : "Step"} {beatIdx + 1}/{scenario.beats.length}
        </p>
      </div>
      <Badge className="bg-[#F2E8D5] text-[#8A5B28] hover:bg-[#F2E8D5] border-0 gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        {bn ? "নিরাপদ অনুশীলন — কাল্পনিক ঘটনা" : "Safe practice — fictional scenario"}
      </Badge>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${beatIdx}`}
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Card className="border-[#D8DED5] bg-[#F4F1EB]">
            <CardContent className="p-5">
              <p className="text-[17px] text-[#202C26] leading-relaxed bn-text">{beat.situation[bn ? "bn" : "en"]}</p>
            </CardContent>
          </Card>

          <div className="space-y-2.5" role="radiogroup" aria-label={bn ? "আপনার সিদ্ধান্ত" : "Your decision"}>
            {beat.options.map((o) => {
              const isPicked = picked === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={isPicked}
                  disabled={Boolean(picked)}
                  onClick={() => pick(o.id)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-4 transition-all focus-ring bn-text",
                    !picked && "border-[#D8DED5] bg-[#FFFEFA] hover:border-[#8A5B28]/60",
                    picked && isPicked && o.safe && "border-[#2F5746] bg-[#DDE8DF]",
                    picked && isPicked && !o.safe && "border-[#A44435] bg-[#F4E1DA]",
                    picked && !isPicked && "border-[#D8DED5] bg-[#FFFEFA] opacity-60"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        picked && isPicked && o.safe && "border-[#2F5746] bg-[#2F5746] text-[#FFFEFA]",
                        picked && isPicked && !o.safe && "border-[#A44435] bg-[#A44435] text-[#FFFEFA]",
                        (!picked || !isPicked) && "border-[#D8DED5] text-[#59665F]"
                      )}
                      aria-hidden
                    >
                      {picked && isPicked ? (o.safe ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />) : o.id.toUpperCase()}
                    </span>
                    <span className="text-[15px] leading-relaxed text-[#202C26]">{o.label[bn ? "bn" : "en"]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {option && (
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl border-2 p-4 space-y-2",
                  option.safe ? "border-[#2F5746]/50 bg-[#DDE8DF]/60" : "border-[#8A5B28]/50 bg-[#F2E8D5]/70"
                )}
                role="status"
              >
                <p className="text-xs font-bold text-[#7D9C8B] bn-text">{HYPOTHetical_NOTE[bn ? "bn" : "en"]}</p>
                <p className="text-[15px] text-[#202C26] leading-relaxed bn-text">
                  <strong>{bn ? "সম্ভাব্য ফলাফল: " : "Possible outcome: "}</strong>
                  {option.consequence[bn ? "bn" : "en"]}
                </p>
                <p className="text-sm text-[#59665F] leading-relaxed bn-text">
                  <strong>{bn ? "মনে রাখুন: " : "Remember: "}</strong>
                  {option.explanation[bn ? "bn" : "en"]}
                </p>
                <Button onClick={next} className="mt-1 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2 font-bold">
                  {beatIdx + 1 >= scenario.beats.length ? (bn ? "ফলাফল দেখুন" : "See result") : bn ? "পরের ধাপ" : "Next step"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
