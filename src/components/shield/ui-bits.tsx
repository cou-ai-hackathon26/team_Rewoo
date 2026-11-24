"use client";

// Shared BanglaShield UI primitives — built on shadcn/ui + the approved
// warm, natural public-safety palette (ivory / forest / terracotta / amber).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Eye,
  BrainCircuit,
  Cog,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Clock,
  FileWarning,
  Volume2 as AudioIcon,
  Square as SquareIcon,
} from "lucide-react";
import type { RiskCategory, Evidence, ReplayStage } from "@/lib/types";
import { useBi, useT, useLang } from "./i18n";
import { useSettings } from "./store";

// --- Risk presentation ------------------------------------------------------

const RISK_STYLE: Record<RiskCategory, { bg: string; border: string; icon: ReactNode; text: string }> = {
  HIGH_RISK: {
    bg: "bg-[#F4E1DA]",
    border: "border-[#A44435]",
    icon: <ShieldAlert className="h-5 w-5 text-[#A44435]" aria-hidden />,
    text: "text-[#8C382B]",
  },
  CAUTION: {
    bg: "bg-[#F2E8D5]",
    border: "border-[#8A5B28]",
    icon: <AlertTriangle className="h-5 w-5 text-[#8A5B28]" aria-hidden />,
    text: "text-[#8A5B28]",
  },
  INSUFFICIENT_EVIDENCE: {
    bg: "bg-[#F2E8D5]",
    border: "border-[#8A5B28]",
    icon: <HelpCircle className="h-5 w-5 text-[#8A5B28]" aria-hidden />,
    text: "text-[#8A5B28]",
  },
  NO_RISK_INDICATORS: {
    bg: "bg-[#DDE8DF]",
    border: "border-[#2F5746]",
    icon: <ShieldCheck className="h-5 w-5 text-[#2F5746]" aria-hidden />,
    text: "text-[#2F5746]",
  },
};

/** Legacy V2 → V3 normalization for persisted results. */
export function toV3Risk(r: string | null | undefined): RiskCategory {
  if (!r) return "INSUFFICIENT_EVIDENCE";
  if (r === "high") return "HIGH_RISK";
  if (r === "uncertain") return "CAUTION";
  if (r === "none") return "NO_RISK_INDICATORS";
  if (r === "HIGH_RISK" || r === "CAUTION" || r === "INSUFFICIENT_EVIDENCE" || r === "NO_RISK_INDICATORS") return r;
  return "INSUFFICIENT_EVIDENCE";
}

export function RiskBadge({ risk, size = "md" }: { risk: RiskCategory | string; size?: "sm" | "md" | "lg" }) {
  const t = useT();
  const key = toV3Risk(risk);
  const s = RISK_STYLE[key];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 font-semibold",
        s.bg,
        s.border,
        s.text,
        size === "sm" && "px-3 py-0.5 text-sm",
        size === "md" && "px-4 py-1 text-base",
        size === "lg" && "px-5 py-1.5 text-lg"
      )}
    >
      {s.icon}
      {t(`risk.${key}`)}
    </span>
  );
}

export function RiskBanner({ risk, title }: { risk: RiskCategory; title: string }) {
  const s = RISK_STYLE[risk];
  return (
    <div className={cn("flex items-start gap-4 rounded-2xl border-2 p-5 md:p-6", s.bg, s.border)} role="alert">
      <div className="mt-0.5 shrink-0">{s.icon}</div>
      <div>
        <p className={cn("text-xl md:text-2xl font-bold bn-text", s.text)}>{title}</p>
      </div>
    </div>
  );
}

// --- Engine + status tags ------------------------------------------------------

export function EngineTag({ engine }: { engine: string }) {
  const t = useT();
  const ai = engine === "ai_assisted";
  return (
    <Badge variant="outline" className={cn("gap-1.5 py-1 px-2.5", ai ? "border-[#2F5746]/40 text-[#2F5746]" : "border-[#8A5B28]/50 text-[#8A5B28]")}>
      {ai ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : <Cog className="h-3.5 w-3.5" aria-hidden />}
      {ai ? t("engine.ai") : t("engine.rule")}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    // V3 lifecycle: pending → under_review → published / rejected / withdrawn
    pending: { label: "অপেক্ষমাণ", cls: "bg-[#F2E8D5] text-[#8A5B28] border-[#8A5B28]/40" },
    under_review: { label: "রিভিউ চলছে", cls: "bg-[#DDE8DF] text-[#2F5746] border-[#2F5746]/40" },
    published: { label: "প্রকাশিত", cls: "bg-[#2F5746] text-[#FFFEFA] border-[#2F5746]" },
    approved: { label: "অনুমোদিত", cls: "bg-[#2F5746] text-[#FFFEFA] border-[#2F5746]" },
    rejected: { label: "বাতিল", cls: "bg-[#F4E1DA] text-[#A44435] border-[#A44435]/40" },
    withdrawn: { label: "প্রত্যাহৃত", cls: "bg-[#EDEAE1] text-[#59665F] border-[#D8DED5]" },
    // Legacy V2 statuses (persisted rows)
    submitted: { label: "জমা", cls: "bg-[#F2E8D5] text-[#8A5B28] border-[#8A5B28]/40" },
    candidate: { label: "প্রার্থী", cls: "bg-[#F2E8D5] text-[#8A5B28] border-[#8A5B28]/40" },
  };
  const s = map[status] ?? { label: status, cls: "bg-[#EDEAE1] text-[#59665F] border-[#D8DED5]" };
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}

export function SyntheticTag() {
  const t = useT();
  return (
    <Badge variant="outline" className="border-dashed border-[#8A5B28]/60 text-[#8A5B28] gap-1">
      <FileWarning className="h-3.5 w-3.5" aria-hidden /> {t("common.synthetic")}
    </Badge>
  );
}

// --- Section headings ------------------------------------------------------

export function SectionTitle({
  icon,
  title,
  desc,
  id,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  id?: string;
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="flex items-center gap-2.5 text-xl md:text-2xl font-bold text-[#202C26] bn-text">
        {icon && <span className="text-[#2F5746]">{icon}</span>}
        {title}
      </h2>
      {desc && <p className="mt-1.5 text-[#59665F] leading-relaxed bn-text">{desc}</p>}
    </div>
  );
}

// --- Evidence card ----------------------------------------------------------

export function EvidenceCard({
  evidence,
  highlight = false,
  compact = false,
  onSelect,
}: {
  evidence: Evidence;
  highlight?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const b = useBi();
  const kindIcon = (kind: Evidence["kind"]) => {
    switch (kind) {
      case "quoted_text":
        return <Eye className="h-4 w-4" aria-hidden />;
      case "url_property":
        return <FileWarning className="h-4 w-4" aria-hidden />;
      case "visual":
        return <Eye className="h-4 w-4" aria-hidden />;
      case "context":
        return <Info className="h-4 w-4" aria-hidden />;
      default:
        return <BrainCircuit className="h-4 w-4" aria-hidden />;
    }
  };
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border-2 bg-[#FFFEFA] p-4 transition-all",
        highlight ? "border-[#8A5B28] shadow-[0_0_0_3px_#F2E8D5]" : "border-[#D8DED5] hover:border-[#2F5746]/50",
        onSelect && "cursor-pointer focus-ring"
      )}
      aria-pressed={highlight}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F5746]">
          {kindIcon(evidence.kind)} {evidence.key}
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold rounded-full px-2 py-0.5",
            evidence.weight === "strong" && "bg-[#F4E1DA] text-[#A44435]",
            evidence.weight === "moderate" && "bg-[#F2E8D5] text-[#8A5B28]",
            evidence.weight === "weak" && "bg-[#EDEAE1] text-[#59665F]"
          )}
        >
          {evidence.weight === "strong" ? "শক্তিশালী" : evidence.weight === "moderate" ? "মাঝারি" : "দুর্বল"}
        </span>
      </div>
      {evidence.quote && !compact && (
        <p className="mb-2 rounded-lg bg-[#F4F1EB] px-3 py-2 text-sm text-[#202C26] italic line-clamp-3 bn-text">
          “{evidence.quote}”
        </p>
      )}
      <p className="text-sm text-[#59665F] leading-relaxed bn-text">{b(evidence.interpretation)}</p>
    </button>
  );
}

// --- Replay stage type chip --------------------------------------------------

export function StageTypeChip({ type }: { type: ReplayStage["type"] }) {
  const map: Record<ReplayStage["type"], { bn: string; en: string; cls: string }> = {
    observed: { bn: "প্রত্যক্ষ প্রমাণ", en: "Observed", cls: "bg-[#DDE8DF] text-[#2F5746] border-[#2F5746]/40" },
    inferred: { bn: "অনুমিত", en: "Inferred", cls: "bg-[#F2E8D5] text-[#8A5B28] border-[#8A5B28]/40" },
    hypothetical: { bn: "সম্ভাব্য", en: "Hypothetical", cls: "bg-[#F4E1DA] text-[#A44435] border-[#A44435]/40 border-dashed" },
    action: { bn: "সুরক্ষা-পদক্ষেপ", en: "Protective action", cls: "bg-[#DDE8DF] text-[#2F5746] border-[#2F5746]/40" },
  };
  const s = map[type];
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      {s.bn} / {s.en}
    </span>
  );
}

// --- Notes --------------------------------------------------------------

export function InfoNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Alert className="border-[#D8DED5] bg-[#F2E8D5]/60">
      <Info className="h-4 w-4 text-[#8A5B28]" aria-hidden />
      <AlertTitle className="text-[#8A5B28] text-base bn-text">{title}</AlertTitle>
      <AlertDescription className="text-[#59665F] leading-relaxed bn-text">{children}</AlertDescription>
    </Alert>
  );
}

export function WarnNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Alert className="border-[#A44435]/40 bg-[#F4E1DA]/70">
      <AlertTriangle className="h-4 w-4 text-[#A44435]" aria-hidden />
      <AlertTitle className="text-[#A44435] text-base bn-text">{title}</AlertTitle>
      <AlertDescription className="text-[#59665F] leading-relaxed bn-text">{children}</AlertDescription>
    </Alert>
  );
}

// --- States -----------------------------------------------------------

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="border-[#D8DED5] bg-[#FFFEFA]">
      <CardContent className="p-6 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full bg-[#EDEAE1]" />
        ))}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <Card className="border-[#A44435]/40 bg-[#FFFEFA]">
      <CardContent className="p-6 flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6 text-[#A44435]" aria-hidden />
          <p className="text-[#202C26] font-medium bn-text">{message}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="border-[#2F5746] text-[#2F5746] hover:bg-[#DDE8DF]">
            {t("common.retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// --- Copy button -----------------------------------------------------------

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-[#D8DED5] text-[#59665F] hover:text-[#2F5746] hover:border-[#2F5746]/50 gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* clipboard unavailable */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="h-4 w-4 text-[#2F5746]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "কপি হয়েছে" : (label ?? "কপি")}
    </Button>
  );
}

// --- Metric card (analyst dashboard) ------------------------------------------

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <Card
      className={cn(
        "border-[#D8DED5] bg-[#FFFEFA]",
        tone === "good" && "border-[#2F5746]/50",
        tone === "warn" && "border-[#8A5B28]/50",
        tone === "bad" && "border-[#A44435]/50"
      )}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#59665F] font-medium bn-text">{label}</p>
          {icon && <span className="text-[#2F5746]">{icon}</span>}
        </div>
        <p className="mt-2 text-3xl font-bold text-[#202C26] tabular-nums">{value}</p>
        {hint && (
          <p className="mt-1 text-xs text-[#59665F] bn-text">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Narration button ---------------------------------------------------------

export function SpeakButton({ text, label }: { text: string; label?: string }) {
  const { narration, lowBandwidth } = useSettings();
  const lang = useLang();
  const [playing, setPlaying] = useState(false);
  const [engine, setEngine] = useState<"browser-bangla" | "server-tts" | null>(null);
  const [failed, setFailed] = useState(false);
  if (!narration || lowBandwidth) return null;

  const speak = async () => {
    setPlaying(true);
    setFailed(false);
    setEngine(null);
    const { speakBangla, stopBanglaSpeech } = await import("./speech");
    const served = await speakBangla(text, { speed: 1 });
    if (served === "failed") {
      setFailed(true);
    } else {
      setEngine(served);
    }
    setPlaying(false);
  };

  const stop = () => {
    void import("./speech").then(({ stopBanglaSpeech }) => stopBanglaSpeech());
    setPlaying(false);
  };

  return (
    <div className="inline-flex items-center gap-2">
      {playing ? (
        <Button
          variant="outline"
          size="sm"
          onClick={stop}
          className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E7E4] gap-1.5"
          aria-label={lang === "bn" ? "থামান" : "Stop"}
        >
          <SquareIcon className="h-4 w-4" aria-hidden />
          {lang === "bn" ? "থামান" : "Stop"}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={speak}
          className="border-[#2F5746]/40 text-[#2F5746] hover:bg-[#DDE8DF] gap-1.5"
          aria-label={label ?? (lang === "bn" ? "শুনুন" : "Listen")}
        >
          <AudioIcon aria-hidden />
          {label ?? (lang === "bn" ? "শুনুন" : "Listen")}
        </Button>
      )}
      {playing && <span className="text-xs text-[#59665F] bn-text">{lang === "bn" ? "বাংলা ধ্বনি চলছে…" : "Bangla voice playing…"}</span>}
      {engine && !playing && (
        <span className="text-[10px] text-[#8A9B90] bn-text">
          {engine === "browser-bangla"
            ? lang === "bn" ? "ডিভাইসের বাংলা কণ্ঠ" : "device Bangla voice"
            : lang === "bn" ? "সার্ভার ধ্বনি" : "server voice"}
        </span>
      )}
      {failed && <span className="text-xs text-[#A44435] bn-text">{lang === "bn" ? "ধ্বনি তৈরি করা যায়নি — লেখাটি পড়ুন" : "Audio unavailable — please read the text"}</span>}
    </div>
  );
}

// --- Safe reveal animation (v2.0) --------------------------------------------
// Content is ALWAYS visible by default. When the element scrolls into view,
// a one-time CSS keyframe enhancement plays. If JavaScript, IntersectionObserver,
// or the animation runtime fails, nothing is ever hidden (fixes the v1 bug
// where entrance animations temporarily blanked entire sections).

export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const reduceMotionSetting = useSettings((s) => s.reduceMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced || reduceMotionSetting) return;
    if (typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delayMs > 0) el.style.animationDelay = `${delayMs}ms`;
            el.classList.add("reveal-anim");
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -32px 0px", threshold: 0.05 }
    );
    io.observe(el);
    // Safety net: never let content wait more than 1.5s for the observer.
    timer = setTimeout(() => {
      if (!el.classList.contains("reveal-anim")) el.classList.add("reveal-anim");
    }, 1500);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [prefersReduced, reduceMotionSetting, delayMs]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// --- Verified official resources (DB-backed with bundled fallback) ----------

interface VerifiedResourceEntry {
  key: string;
  name: { bn: string; en: string };
  description: { bn: string; en: string };
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: string;
}

export function ResourceList() {
  const lang = useLang();
  const bn = lang === "bn";
  const [resources, setResources] = useState<VerifiedResourceEntry[] | null>(null);
  const [source, setSource] = useState<string>("database");

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/resources")
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setResources(d.resources ?? []);
          setSource(d.source ?? "database");
        }
      })
      .catch(() => {
        if (alive) setResources([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (resources === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-[#EDEAE1] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <Card key={r.key} className="h-full border border-[#D8DED5] bg-[#FFFEFA] hover:border-[#2F5746]/40 transition-colors">
            <CardContent className="p-5 flex flex-col h-full">
              <p className="font-bold text-[#202C26] bn-text">
                {r.name[bn ? "bn" : "en"]}
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="ml-2 rounded bg-[#2F5746] px-1.5 py-0.5 text-[11px] font-bold text-[#FFFEFA] hover:bg-[#24453A]"
                    aria-label={`${bn ? "কল করুন" : "Call"} ${r.phone}`}
                  >
                    {r.phone}
                  </a>
                )}
              </p>
              <p className="mt-1.5 flex-1 text-sm text-[#59665F] leading-relaxed bn-text">
                {r.description[bn ? "bn" : "en"]}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-bold text-[#2F5746] hover:underline focus-ring rounded"
                >
                  {bn ? "অফিসিয়াল সাইট ↗" : "Official site ↗"}
                </a>
                <span className="text-[#7D9C8B]">
                  {bn ? "যাচাই:" : "Verified:"} {new Date(r.verifiedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-[#7D9C8B] bn-text">
        {source === "bundled-fallback"
          ? bn
            ? "এই মুহূর্তে ডেটাবেস থেকে নয় — অ্যাপে সংযুক্ত যাচাইকৃত নমুনা তালিকা দেখানো হচ্ছে।"
            : "Showing the verified list bundled inside the app (database unavailable)."
          : bn
            ? "উৎস: প্রতিষ্ঠানের অফিসিয়াল পাতা — নিয়মিত পুনঃযাচাই করা হয়।"
            : "Sources: the organizations' official pages — re-verified periodically."}
      </p>
    </>
  );
}
