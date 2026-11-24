"use client";

// ---------------------------------------------------------------------------
// Decision Branch Explorer — Shield Lens 2.0 flagship component.
//
// Transforms the final "decision" replay stage into an animated, evidence-
// grounded comparison of the two possible paths:
//   protective path: stop -> verify independently -> keep secrets -> harm avoided
//   unsafe path:     share -> access risk -> potential loss
//
// Honesty rules:
//   - Every step on both paths is labeled HYPOTHETICAL (সম্ভাব্য) — these are
//     possible consequences, never predictions or observed events.
//   - The unsafe path's first step is grounded in the case's actual evidence
//     quote when available (labeled প্রত্যক্ষ/pr OBSERVED for the quote itself).
//   - No outcome is guaranteed — the protective outcome says risk "drops",
//     the unsafe outcome says loss "could" happen.
//   - Reduced-motion users get the same content with animations disabled.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  Hand,
  ShieldCheck,
  PhoneCall,
  KeyRound,
  Share2,
  UserX,
  Wallet,
  ShieldAlert,
  Landmark,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bilingual, Evidence } from "@/lib/types";
import { useLang } from "./i18n";

export interface BranchIntervention {
  question: Bilingual;
  safe: Bilingual;
  unsafe: Bilingual;
}

interface Step {
  icon: React.ReactNode;
  title: Bilingual;
  detail: Bilingual;
  /** Evidence key grounding this step (shown as a chip). */
  evidenceKey?: string;
}

export function DecisionBranchExplorer({
  intervention,
  evidence,
  caseId,
}: {
  intervention: BranchIntervention;
  evidence: Evidence[];
  caseId: string;
}) {
  const lang = useLang();
  const bn = lang === "bn";
  const [focused, setFocused] = useState<{ path: "safe" | "unsafe"; idx: number } | null>(null);

  // First strong evidence quote grounds the "share" step in the real message.
  const grounding = evidence.find((e) => e.weight === "strong" && e.quote) ?? evidence.find((e) => e.quote);

  const safeSteps: Step[] = [
    {
      icon: <Hand className="h-5 w-5" aria-hidden />,
      title: { bn: "থেমে যান", en: "Stop" },
      detail: {
        bn: "কোনো কিছু না দিয়ে কথা/চ্যাট শেষ করুন। চাপের মধ্যে সিদ্ধান্ত নেওয়ার দরকার নেই — আসল প্রতিষ্ঠান কখনো তাড়াহুড়ো করতে বলে না।",
        en: "End the call or chat without giving anything. No genuine institution ever rushes you mid-decision.",
      },
    },
    {
      icon: <Landmark className="h-5 w-5" aria-hidden />,
      title: { bn: "নিজে থেকে যাচাই করুন", en: "Verify independently" },
      detail: {
        bn: "বার্তায় দেওয়া নম্বর/লিংক ব্যবহার না করে নিজে অ্যাপ খুলে বা কার্ডে ছাপা হেল্পলাইনে কল করে সত্যতা জেনে নিন।",
        en: "Open the official app yourself or call the helpline printed on your card — never the contact details from the message.",
      },
    },
    {
      icon: <KeyRound className="h-5 w-5" aria-hidden />,
      title: { bn: "কোড ও টাকা গোপন রাখুন", en: "Keep codes & money private" },
      detail: {
        bn: "ওটিপি, পিন, পাসওয়ার্ড কাউকে না বলা এবং যাচাই না হওয়া পর্যন্ত কোনো টাকা না পাঠানোই নিরাপত্তার মূল নিয়ম।",
        en: "Never tell anyone your OTP, PIN or password, and never send money before verification — the core safety rule.",
      },
    },
  ];

  const unsafeSteps: Step[] = [
    {
      icon: <Share2 className="h-5 w-5" aria-hidden />,
      title: { bn: "চাওয়া কোড/তথ্য দিয়ে দেন", en: "Share the requested code/info" },
      detail: {
        bn: "বার্তায় যা চাওয়া হয়েছে তা দিয়ে দিলে প্রতারক আপনার পরিচয় ব্যবহার করতে পারে।",
        en: "Handing over what the message asks for gives the scammer material to act as you.",
      },
      evidenceKey: grounding?.key,
    },
    {
      icon: <UserX className="h-5 w-5" aria-hidden />,
      title: { bn: "অ্যাকাউন্টে অননুমোদিত প্রবেশের ঝুঁকি", en: "Risk of unauthorized account access" },
      detail: {
        bn: "কোড থাকলে অ্যাপে ঢুকে বা লেনদেন করে টাকা সরানো সম্ভব হতে পারে — লগইন পরিবর্তনও হতে পারে।",
        en: "With the code, an attacker may enter your account, transact, or even change your login.",
      },
    },
    {
      icon: <Wallet className="h-5 w-5" aria-hidden />,
      title: { bn: "সম্ভাব্য আর্থিক ক্ষতি", en: "Possible financial loss" },
      detail: {
        bn: "অর্থ উত্তোলন বা অজানা কেনাকাটা হতে পারে — ফেরত পাওয়া কঠিন ও অনিশ্চিত।",
        en: "Cash-out or unknown purchases may follow — recovery is difficult and never guaranteed.",
      },
    },
  ];

  const focusedStep = focused
    ? focused.path === "safe"
      ? safeSteps[focused.idx]
      : unsafeSteps[focused.idx]
    : null;

  return (
    <section
      className="mt-6 rounded-2xl border-2 border-[#8A5B28]/40 bg-[#F4F1EB]/60 p-4 md:p-6"
      aria-label={bn ? "দুটি পথের তুলনা" : "Comparison of the two paths"}
    >
      {/* Decision node */}
      <div className="mx-auto max-w-xl text-center branch-node-anim">
        <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#2F5746] bg-[#FFFEFA] px-4 py-2 text-base md:text-lg font-bold text-[#202C26] bn-text">
          <Info className="h-5 w-5 text-[#2F5746]" aria-hidden />
          {intervention.question[bn ? "bn" : "en"]}
        </p>
        <p className="mt-2 text-xs text-[#59665F] bn-text">
          {bn ? "এই মুহূর্তের সিদ্ধান্ত আপনার হাতে — নিচের দুটি পথ তুলনা করুন" : "The decision is in your hands — compare the two paths below"}
        </p>
      </div>

      {/* SVG fork connector */}
      <div className="mx-auto my-2 max-w-3xl" aria-hidden>
        <svg viewBox="0 0 600 44" className="w-full h-10">
          <path
            d="M300 2 C300 22 150 18 150 42"
            className="branch-path-anim"
            style={{ ["--len" as string]: 60, stroke: "#2F5746", strokeWidth: 2.5, fill: "none" }}
          />
          <path
            d="M300 2 C300 22 450 18 450 42"
            className="branch-path-anim"
            style={{ ["--len" as string]: 60, stroke: "#A44435", strokeWidth: 2.5, fill: "none", strokeDasharray: 60, animationDelay: "0.15s" }}
          />
        </svg>
      </div>

      {/* Two paths */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Protective path */}
        <div className="rounded-xl border-2 border-[#2F5746] bg-[#DDE8DF]/50 p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-[#2F5746] bn-text">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {bn ? "নিরাপদ পথ" : "Protective path"}
            <span className="ml-auto rounded-full bg-[#FFFEFA] border border-[#2F5746]/40 px-2 py-0.5 text-[10px] font-bold">
              {bn ? "সম্ভাব্য ফলাফল" : "Hypothetical"}
            </span>
          </p>
          <ol className="space-y-2.5">
            {safeSteps.map((s, i) => (
              <li key={i} className="branch-node-anim" style={{ animationDelay: `${0.25 + i * 0.28}s` }}>
                <button
                  onClick={() => setFocused(focused?.path === "safe" && focused.idx === i ? null : { path: "safe", idx: i })}
                  aria-pressed={focused?.path === "safe" && focused.idx === i}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border bg-[#FFFEFA] p-3 text-left transition-all hover:border-[#2F5746] focus-ring",
                    focused?.path === "safe" && focused.idx === i ? "border-[#2F5746] ring-2 ring-[#2F5746]/25" : "border-[#D8DED5]"
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDE8DF] text-[#2F5746]" aria-hidden>
                    {s.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#202C26] bn-text">{s.title[bn ? "bn" : "en"]}</span>
                    <span className="mt-0.5 block text-xs text-[#59665F] bn-text">{s.detail[bn ? "bn" : "en"]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div
            className="mt-3 flex items-start gap-2.5 rounded-lg border-2 border-[#2F5746] bg-[#2F5746] p-3 text-[#FFFEFA] branch-node-anim"
            style={{ animationDelay: "1.15s" }}
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-bold">{bn ? "সম্ভাব্য ফলাফল" : "Likely outcome (hypothetical)"}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#DDE8DF]">{intervention.safe[bn ? "bn" : "en"]}</p>
            </div>
          </div>
        </div>

        {/* Unsafe path */}
        <div className="rounded-xl border-2 border-dashed border-[#A44435] bg-[#F4E1DA]/50 p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-[#A44435] bn-text">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            {bn ? "বিপজ্জনক পথ" : "Unsafe path"}
            <span className="ml-auto rounded-full bg-[#FFFEFA] border border-dashed border-[#A44435]/60 px-2 py-0.5 text-[10px] font-bold text-[#A44435]">
              {bn ? "সম্ভাব্য ফলাফল" : "Hypothetical"}
            </span>
          </p>
          <ol className="space-y-2.5">
            {unsafeSteps.map((s, i) => (
              <li key={i} className="branch-node-anim" style={{ animationDelay: `${0.35 + i * 0.28}s` }}>
                <button
                  onClick={() => setFocused(focused?.path === "unsafe" && focused.idx === i ? null : { path: "unsafe", idx: i })}
                  aria-pressed={focused?.path === "unsafe" && focused.idx === i}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border bg-[#FFFEFA] p-3 text-left transition-all hover:border-[#A44435] focus-ring",
                    focused?.path === "unsafe" && focused.idx === i ? "border-[#A44435] ring-2 ring-[#A44435]/25" : "border-[#D8DED5]"
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4E1DA] text-[#A44435]" aria-hidden>
                    {s.icon}
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#202C26] bn-text">
                      {s.title[bn ? "bn" : "en"]}
                      {s.evidenceKey && (
                        <span className="rounded-full border border-[#2F5746]/40 bg-[#DDE8DF] px-2 py-0 text-[10px] font-bold text-[#2F5746]">
                          {bn ? "প্রত্যক্ষ প্রমাণ" : "Observed"} {s.evidenceKey}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#59665F] bn-text">{s.detail[bn ? "bn" : "en"]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div
            className="mt-3 flex items-start gap-2.5 rounded-lg border-2 border-dashed border-[#A44435] bg-[#FFFEFA] p-3 branch-node-anim"
            style={{ animationDelay: "1.25s" }}
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#A44435]" aria-hidden />
            <div>
              <p className="text-sm font-bold text-[#8C382B]">{bn ? "সম্ভাব্য পরিণতি (ভবিষ্যদ্বাণী নয়)" : "Possible consequence (not a prediction)"}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#59665F]">{intervention.unsafe[bn ? "bn" : "en"]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grounding quote */}
      {grounding?.quote && (
        <figure className="mt-4 rounded-xl border border-[#D8DED5] bg-[#FFFEFA] p-4">
          <figcaption className="text-xs font-bold text-[#59665F]">
            {bn ? `যে বার্তা থেকে এই তুলনা তৈরি (${caseId}) — প্রত্যক্ষ প্রমাণ ${grounding.key}:` : `Evidence grounding this comparison (${caseId}) — observed ${grounding.key}:`}
          </figcaption>
          <blockquote className="mt-1.5 border-l-4 border-[#2F5746]/50 pl-3 text-sm text-[#202C26] bn-text">
            “{grounding.quote}”
          </blockquote>
        </figure>
      )}

      {/* Focused step detail (also serves as extra context surface) */}
      {focusedStep && (
        <div className="sr-only" role="status">
          {bn ? "নির্বাচিত ধাপ" : "Selected step"}: {focusedStep.title[bn ? "bn" : "en"]}
        </div>
      )}
    </section>
  );
}
