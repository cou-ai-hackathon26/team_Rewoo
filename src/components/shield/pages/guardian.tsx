"use client";

// ---------------------------------------------------------------------------
// Guardian — one integrated flagship workspace (V7).
//
// Progressive disclosure by design: an ordinary citizen checks a message on
// the Verify page and never needs to come here; Guardian is for people who
// want the fuller picture. Honest defaults everywhere:
//   - No device is connected (native pairing is a labeled roadmap item).
//   - No pending approvals, no sample conversations in live sessions.
//   - Capability rows show AVAILABILITY of an enumerated list — never a
//     protection score, accuracy percentage or safety guarantee.
//   - Trust metrics render only from measured EvaluationRun records;
//     absent data shows "মূল্যায়ন হয়নি / Not evaluated yet".
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useHashRoute } from "../router";
import { useLang } from "../i18n";
import { api } from "../api";
import { AgentChat } from "./agent-chat";
import {
  ShieldHalf,
  MessageSquareText,
  ScanSearch,
  Mic,
  Image as ImageIcon,
  Link2,
  PhoneIncoming,
  Package,
  Settings2,
  ArrowRight,
  Scale,
  History,
  LifeBuoy,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Capability registry — availability statuses, not performance numbers.
// ---------------------------------------------------------------------------

type CapStatus = "web" | "native-roadmap";
interface Capability {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  bn: string;
  en: string;
  noteBn: string;
  noteEn: string;
  status: CapStatus;
}

const CAPABILITIES: Capability[] = [
  {
    id: "text",
    icon: MessageSquareText,
    bn: "টেক্সট / চ্যাট বার্তা",
    en: "Text / chat message",
    noteBn: "বার্তা পেস্ট করে প্রমাণসহ বিশ্লেষণ",
    noteEn: "Paste a message for evidence-linked analysis",
    status: "web",
  },
  {
    id: "voice",
    icon: Mic,
    bn: "জমা দেওয়া ভয়েস",
    en: "Submitted audio",
    noteBn: "রেকর্ডিং/ফাইল জমা দিয়ে লেখায় তুলে পরীক্ষা (সম্মতি লাগে)",
    noteEn: "Record or upload audio, transcribed with consent",
    status: "web",
  },
  {
    id: "image",
    icon: ImageIcon,
    bn: "স্ক্রিনশট / ছবি",
    en: "Screenshot / photo",
    noteBn: "ছবির লেখা বের করে কনটেন্ট-ঝুঁকি যাচাই (ছবির সত্যতা নয়)",
    noteEn: "OCR + content risk (not image authenticity)",
    status: "web",
  },
  {
    id: "link",
    icon: Link2,
    bn: "লিংক / কিউআর",
    en: "Link / QR",
    noteBn: "ঠিকানার কাঠামো বিশ্লেষণ — গন্তব্য কখনো খোলা হয় না",
    noteEn: "Address-structure analysis; destinations are never visited",
    status: "web",
  },
  {
    id: "caller",
    icon: PhoneIncoming,
    bn: "কলার মেটাডেটা",
    en: "Caller metadata",
    noteBn: "নেটিভ কল-স্ক্রিনিং জুড়ে — ওয়েবে নেই",
    noteEn: "Requires native call-screening pairing",
    status: "native-roadmap",
  },
  {
    id: "app",
    icon: Package,
    bn: "অ্যাপ মেটাডেটা ও সেটিংস",
    en: "App metadata & OS settings",
    noteBn: "ডিভাইস জুড়ে নিয়ন্ত্রণ — রোডম্যাপ, এখন নেই",
    noteEn: "Device-level controls are a labeled roadmap item",
    status: "native-roadmap",
  },
];

const WEB_CAPS = CAPABILITIES.filter((c) => c.status === "web").length;

// ---------------------------------------------------------------------------
// Trust & Evaluation view
// ---------------------------------------------------------------------------

interface EvalRun {
  runId: string;
  kind: string;
  subject: string;
  servingProvider?: string | null;
  sampleCount: number;
  itemsRecorded: number;
  completed: boolean;
  decided: number;
  abstained: number;
  ambiguousHeld: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  coverage: number | null;
  schemaFailures: number;
  requestFailures: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  startedAt: string;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

function TrustPanel() {
  const bn = useLang() === "bn";
  const [runs, setRuns] = useState<EvalRun[] | null>(null);
  const [openRouter, setOpenRouter] = useState<boolean | null>(null);
  const [dataset, setDataset] = useState<{ version: string; sampleCount: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ dataset: { version: string; sampleCount: number }; openRouterConfigured: boolean; runs: EvalRun[] }>(
        "/api/v1/evaluation/runs"
      )
      .then((d) => {
        if (!alive) return;
        setRuns(d.runs);
        setOpenRouter(d.openRouterConfigured);
        setDataset(d.dataset);
      })
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, []);

  if (runs === null) {
    return (
      <p className="text-sm text-[#59665F] bn-text" aria-live="polite">
        {bn ? "মূল্যায়নের তথ্য লোড হচ্ছে…" : "Loading evaluation records…"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D8DED5] bg-[#FFFEFA] p-4">
        <h3 className="font-bold text-[#202C26] bn-text flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#2F5746]" aria-hidden />
          {bn ? "সক্ষমতার প্রাপ্যতা" : "Capability availability"}
        </h3>
        <p className="mt-1 text-sm text-[#59665F] bn-text">
          {bn
            ? `ঘোষিত তালিকার ${WEB_CAPS}/${CAPABILITIES.length} সক্ষমতা এখন ওয়েবে সমর্থিত। এটি প্রাপ্যতার হিসাব — নিরাপত্তার মান, নির্ভুলতা বা সুরক্ষা-ছত্রের মাপ নয়।`
            : `${WEB_CAPS}/${CAPABILITIES.length} of the enumerated capabilities are currently available on the web. This is an availability count — not a measure of quality, accuracy or protection.`}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <li
                key={c.id}
                className="flex items-start gap-2.5 rounded-lg border border-[#E5E0D3] bg-[#F4F1EB] p-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2F5746]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#202C26] bn-text">
                    {bn ? c.bn : c.en}
                    <span className="ml-2 align-middle">
                      {c.status === "web" ? (
                        <Badge className="bg-[#DDE8DF] text-[#2F5746] hover:bg-[#DDE8DF] text-[11px]">
                          {bn ? "ওয়েবে আছে" : "On web"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] border-[#C9C2B2] text-[#7A756A]">
                          {bn ? "রোডম্যাপ" : "Roadmap"}
                        </Badge>
                      )}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#59665F] bn-text">{bn ? c.noteBn : c.noteEn}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-[#D8DED5] bg-[#FFFEFA] p-4">
        <h3 className="font-bold text-[#202C26] bn-text">
          {bn ? "মডেল ও নিয়মের মাপা মূল্যায়ন" : "Measured model & rules evaluation"}
        </h3>
        <p className="mt-1 text-sm text-[#59665F] bn-text">
          {bn
            ? "প্রতিটি সংখ্যা একটি সংস্করণযুক্ত, হিমায়িত ডেটাসেটে চালানো পরীক্ষার রেকর্ড থেকে এসেছে। কোনো রেকর্ড না থাকলে সৎভাবে «মূল্যায়ন হয়নি» দেখানো হয় — বানানো সংখ্যা কখনো নয়।"
            : "Every number comes from a versioned run against a frozen dataset. When no run exists, we honestly show \"Not evaluated yet\" — never an invented number."}
        </p>

        {dataset && (
          <p className="mt-2 text-xs text-[#7A756A]">
            {bn ? "ডেটাসেট" : "Dataset"}: {dataset.version} · {dataset.sampleCount}{" "}
            {bn ? "নমুনা" : "samples"} ·{" "}
            {openRouter === null ? "" : openRouter ? "OpenRouter: কনফিগারকৃত" : bn ? "OpenRouter: কনফিগার করা হয়নি (স্যান্ডবক্স প্রদানকারী সক্রিয়)" : "OpenRouter: not configured (sandbox provider active)"}
          </p>
        )}

        <div className="mt-3 space-y-3">
          {runs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#C9C2B2] bg-[#F4F1EB] p-4 text-center">
              <p className="font-semibold text-[#59665F] bn-text">{bn ? "মূল্যায়ন হয়নি" : "Not evaluated yet"}</p>
              <p className="mt-1 text-sm text-[#7A756A] bn-text">
                {bn
                  ? "প্রথম মূল্যায়ন চালানোর পর এখানে প্রকৃত সংখ্যা দেখা যাবে।"
                  : "Real numbers will appear here after the first evaluation run."}
              </p>
            </div>
          ) : (
            runs.map((r) => (
              <div key={r.runId} className="rounded-lg border border-[#E5E0D3] bg-[#F4F1EB] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#202C26]">
                    {r.subject === "rules:v7" ? (bn ? "নিয়মভিত্তিক বেসলাইন" : "Rules baseline") : r.subject}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{r.runId}</Badge>
                    {r.completed ? (
                      <Badge className="bg-[#DDE8DF] text-[#2F5746] hover:bg-[#DDE8DF] text-[11px]">
                        {bn ? "সম্পন্ন" : "Completed"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] border-[#C9A227] text-[#8C6D1F]">
                        {bn ? `চলছে (${r.itemsRecorded}/${r.sampleCount})` : `Running (${r.itemsRecorded}/${r.sampleCount})`}
                      </Badge>
                    )}
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#59665F] sm:grid-cols-4">
                  <div>
                    <dt className="inline font-semibold">{bn ? "নির্ভুলতা" : "Precision"}: </dt>
                    <dd className="inline">{pct(r.precision)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "স্মরণশক্তি" : "Recall"}: </dt>
                    <dd className="inline">{pct(r.recall)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "মিথ্যা-সতর্কতা" : "False-pos. rate"}: </dt>
                    <dd className="inline">{pct(r.falsePositiveRate)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "সিদ্ধান্ত-প্রাপ্যতা" : "Coverage"}: </dt>
                    <dd className="inline">{pct(r.coverage)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "সিদ্ধান্ত" : "Decided"}: </dt>
                    <dd className="inline">{r.decided}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "বিরত" : "Abstained"}: </dt>
                    <dd className="inline">{r.abstained}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">p50/p95: </dt>
                    <dd className="inline">
                      {r.p50LatencyMs}/{r.p95LatencyMs}ms
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{bn ? "ব্যর্থতা" : "Failures"}: </dt>
                    <dd className="inline">
                      {r.requestFailures + r.schemaFailures}
                    </dd>
                  </div>
                </dl>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-[#7A756A] bn-text">
          {bn
            ? "সংজ্ঞা: নির্ভুলতা=TP/(TP+FP), স্মরণশক্তি=TP/(TP+FN), মিথ্যা-সতর্কতা=FP/(FP+TN), প্রাপ্যতা=সিদ্ধান্ত/যোগ্য। অস্পষ্ট-লেবেলের নমুনা বাইনারি হিসাবের বাইরে রাখা হয় এবং আলাদা দেখানো হয়। সময়-অতিক্রান্ত বা ব্যর্থ নমুনা নীরবে বাদ দেওয়া হয় না।"
            : "Definitions: precision=TP/(TP+FP), recall=TP/(TP+FN), FPR=FP/(FP+TN), coverage=decided/eligible. Ambiguous-label samples are held out of binary scoring and reported separately. Timeouts and failures are never silently dropped."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview: honest status + quick actions + recent cases
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string;
  modality: string;
  status: string;
  riskCategory: string | null;
  createdAt: string;
}

function OverviewPanel({ onChat }: { onChat: () => void }) {
  const bn = useLang() === "bn";
  const [cases, setCases] = useState<CaseRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ sessions: CaseRow[] }>("/api/v1/analyses")
      .then((d) => alive && setCases(d.sessions.slice(0, 5)))
      .catch(() => alive && setCases([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Honest status hero */}
      <div className="overflow-hidden rounded-2xl bg-[#2F5746] text-[#FFFEFA]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3D6B57] px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-[#DDE8DF]" aria-hidden />
              {bn ? "ওয়েব সহায়ক সক্রিয় · কোনো ডিভাইস যুক্ত নেই" : "Web assistant active · No device connected"}
            </span>
            <h2 className="mt-3 text-xl font-bold sm:text-2xl">
              {bn ? "আপনার ডিজিটাল নিরাপত্তার সহায়ক কেন্দ্র" : "Your digital-safety assistant"}
            </h2>
            <p className="mt-1.5 text-sm text-[#DDE8DF]">
              {bn
                ? "সন্দেহজনক কিছু পেলে জমা দিন — প্রমাণসহ বিশ্লেষণ পান, তারপর নিজে যাচাই করে সিদ্ধান্ত নিন। ফোন বা অ্যাপে কোনো স্বয়ংক্রিয় নজরদারি নেই এবং তা দাবিও করি না।"
                : "Submit anything suspicious — get evidence-linked analysis, then verify independently. No automatic phone or app monitoring exists, and we never claim it."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              onClick={onChat}
              className="h-11 bg-[#DDE8DF] text-[#2F5746] hover:bg-[#CBDCD0] font-bold rounded-xl"
            >
              <MessageSquareText className="mr-2 h-4 w-4" aria-hidden />
              {bn ? "শিল্ডএজেন্টকে জিজ্ঞাসা করুন" : "Ask ShieldAgent"}
            </Button>
            <Button asChild className="h-11 w-full bg-[#FFFEFA] text-[#2F5746] hover:bg-[#F1EEE5] font-bold rounded-xl">
              <Link to="/check">
                <ScanSearch className="mr-2 h-4 w-4" aria-hidden />
                {bn ? "কনটেন্ট যাচাই করুন" : "Verify content"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* No device connected — honest state */}
      <div className="rounded-xl border border-dashed border-[#C9C2B2] bg-[#F4F1EB] p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7A756A]" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-[#59665F] bn-text">
              {bn ? "ডিভাইস জুড়ে সুরক্ষা — রোডম্যাপ, এখন নয়" : "Device-level protection — roadmap, not now"}
            </p>
            <p className="mt-1 text-sm text-[#7A756A] bn-text">
              {bn
                ? "কল-স্ক্রিনিং, অ্যাপ পরীক্ষা বা সেটিংস নিয়ন্ত্রণের জন্য একটি নেটিভ অ্যাপ জুড়তে হবে। এই ব্রাউজার সেশনে কোনো ডিভাইস যুক্ত নেই — তাই কোনো লাইভ ডিভাইস-সুরক্ষার দাবি এখানে নেই।"
                : "Call screening, app review and settings control need a paired native app. No device is connected in this browser session, so no live device protection is claimed here."}
            </p>
          </div>
        </div>
      </div>

      {/* Recent cases (owner-scoped by the API) */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#202C26] bn-text">
            <History className="h-5 w-5 text-[#2F5746]" aria-hidden />
            {bn ? "আপনার সাম্প্রতিক কেস" : "Your recent cases"}
          </h3>
          <Link to="/privacy" className="text-sm font-semibold text-[#2F5746] hover:underline bn-text">
            {bn ? "সব দেখুন / মুছুন" : "View all / delete"}
          </Link>
        </div>
        {cases === null ? (
          <p className="mt-2 text-sm text-[#59665F] bn-text" aria-live="polite">
            {bn ? "লোড হচ্ছে…" : "Loading…"}
          </p>
        ) : cases.length === 0 ? (
          <p className="mt-2 text-sm text-[#59665F] bn-text">
            {bn
              ? "এখনো কোনো কেস নেই। যাচাই করতে চাইলে একটি বার্তা, ভয়েস, ছবি বা লিংক জমা দিন।"
              : "No cases yet. Submit a message, voice note, image or link to get started."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  to={c.status === "completed" ? `/analysis/${c.id}` : "/privacy"}
                  className="flex items-center justify-between rounded-lg border border-[#E5E0D3] bg-[#FFFEFA] p-3 hover:border-[#2F5746] transition-colors"
                  ariaLabel={`${c.id} — ${c.status}`}
                >
                  <span className="font-mono text-sm font-semibold text-[#202C26]">{c.id}</span>
                  <span className="flex items-center gap-2 text-xs text-[#59665F]">
                    <span className="bn-text">{c.modality}</span>
                    <span className="bn-text">
                      {c.status === "completed"
                        ? c.riskCategory === "high"
                          ? bn ? "উচ্চ ঝুঁকি" : "High risk"
                          : c.riskCategory === "uncertain"
                            ? bn ? "সতর্কতা" : "Caution"
                            : bn ? "সম্পন্ন" : "Completed"
                        : c.status === "processing"
                          ? bn ? "চলছে" : "Processing"
                          : bn ? "অন্যান্য" : c.status}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recovery door */}
      <Link
        to="/recovery"
        className="flex items-center justify-between rounded-xl border-2 border-[#A44435]/40 bg-[#F4E1DA]/40 p-4 hover:border-[#A44435]/70 transition-colors"
      >
        <span className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-[#A44435]" aria-hidden />
          <span>
            <span className="block font-bold text-[#A44435] bn-text">
              {bn ? "ক্ষতি হয়ে গেছে? পুনরুদ্ধারের ধাপগুলো" : "Already harmed? Recovery steps"}
            </span>
            <span className="block text-sm text-[#7A5548] bn-text">
              {bn ? "এখনই যা করতে হবে — ধাপে ধাপে" : "What to do right now — step by step"}
            </span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 text-[#A44435]" aria-hidden />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TAB_KEYS = ["overview", "chat", "trust"] as const;

export default function GuardianPage({ initialTab }: { initialTab?: string }) {
  const bn = useLang() === "bn";
  const { navigate } = useHashRoute();
  const initial = (TAB_KEYS as readonly string[]).includes(initialTab ?? "") ? (initialTab as string) : "overview";
  const [tab, setTab] = useState<string>(initial);

  const tabs = [
    { v: "overview", bn: "ওভারভিউ", en: "Overview" },
    { v: "chat", bn: "শিল্ডএজেন্ট চ্যাট", en: "ShieldAgent chat" },
    { v: "trust", bn: "বিশ্বাস ও মূল্যায়ন", en: "Trust & evaluation" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#7A756A]">Guardian</p>
        <h1 className="mt-1 flex items-center gap-2.5 text-3xl font-bold text-[#202C26] bn-text">
          <ShieldHalf className="h-7 w-7 text-[#2F5746]" aria-hidden />
          {bn ? "গার্ডিয়ান" : "Guardian"}
        </h1>
        <p className="mt-2 max-w-2xl text-[#59665F] bn-text">
          {bn
            ? "একটি সহায়ক কর্মক্ষেত্র — সন্দেহজনক কনটেন্ট যাচাই, শিল্ডএজেন্টের সাথে কথা বলা এবং প্রকৃত মাপা মূল্যায়ন দেখা। ব্যাংক, পুলিশ বা আইন-প্রয়োগকারী সংস্থা নয়; চূড়ান্ত সিদ্ধান্ত সবসময় নিজে যাচাই করে নিন।"
            : "One assistant workspace — verify suspicious content, talk to ShieldAgent, and see real measured evaluation. Not a bank, the police, or law enforcement; always verify important decisions independently."}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto bg-[#EDEAE1] p-1 rounded-xl">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text"
            >
              {bn ? t.bn : t.en}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewPanel onChat={() => { setTab("chat"); navigate("/guardian/chat", { replace: true }); }} />
        </TabsContent>

        <TabsContent value="chat" className="mt-5">
          <AgentChat />
        </TabsContent>

        <TabsContent value="trust" className="mt-5">
          <TrustPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
