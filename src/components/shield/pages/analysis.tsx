"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  HelpCircle as UnknownIcon,
  ListChecks,
  AlertTriangle,
  ShieldHalf,
  ArrowRight,
  Trash2,
  Siren,
  Flag,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Info,
  Landmark,
  Siren as EmergencyIcon,
  AudioLines,
  ChevronDown,
  Activity,
  Clock,
  CheckCircle2,
  X as XIcon,
  ShieldCheck,
  EyeOff,
  Ban,
  Play,
  Pause,
  Mic,
  PhoneCall,
  MessageSquareText,
  ImageIcon,
  Link2,
  Loader2,
  CircleStop,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api, ShieldApiError } from "../api";
import { useLang, useT } from "../i18n";
import { Link, useHashRoute } from "../router";
import { RiskBadge, RiskBanner, EngineTag, EvidenceCard, SectionTitle, InfoNote, SpeakButton, CopyButton, StageTypeChip, toV3Risk } from "../ui-bits";
import {
  SCAM_CATEGORIES,
  STAGE_LABELS,
  RISK_STATES,
  type AnalysisResultV3,
  type AgentEvent,
  type PipelineStage,
  type SessionStatus,
  type Bilingual,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Accept both V3 results and legacy persisted V2 results.
type AnyResult = AnalysisResultV3 & {
  immediateAction?: AnalysisResultV3["immediateAction"];
  agentEvents?: AgentEvent[];
  analysisMode?: string;
  detectedLanguage?: string;
  synthetic?: boolean;
};

interface CaseData {
  id: string;
  modality: string;
  status: SessionStatus;
  stage: string | null;
  engine: string | null;
  riskCategory: string | null;
  createdAt: string;
  completedAt: string | null;
  result: AnyResult | null;
  extractedText: string | null;
  hasReport: boolean;
  report: { id: string; status: string } | null;
}

const STAGE_ORDER: PipelineStage[] = ["validating", "redacting", "detecting", "ai_analyzing", "safety_gate", "completed"];

// ---------------------------------------------------------------------------
// AI Agent Activity Explorer — genuine pipeline events, never fabricated.
// ---------------------------------------------------------------------------
function ActivityExplorer({ events, lang }: { events: AgentEvent[]; lang: string }) {
  const bn = lang === "bn";
  const [open, setOpen] = useState(false);
  if (!events?.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-0">
          <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus-ring rounded-t-xl">
            <span className="flex items-center gap-2.5 font-bold text-[#202C26]">
              <Activity className="h-5 w-5 text-[#2F5746]" aria-hidden />
              {bn ? "এআই এজেন্ট কার্যক্রম" : "AI agent activity"}
              <Badge variant="outline" className="border-[#D8DED5] text-[#59665F] text-[11px]">
                {events.length} {bn ? "ঘটনা" : "events"}
              </Badge>
            </span>
            <ChevronDown className={cn("h-5 w-5 text-[#59665F] transition-transform", open && "rotate-180")} aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="border-t border-[#D8DED5] px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
              {events.map((ev, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      ev.outcome === "failed" ? "bg-[#A44435]" : ev.outcome === "skipped" ? "bg-[#C9A96A]" : "bg-[#2F5746]"
                    )}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-[#202C26] bn-text">{ev.label[bn ? "bn" : "en"]}</span>
                      {ev.outcome === "failed" && (
                        <Badge variant="outline" className="border-[#A44435]/50 text-[#A44435] text-[10px] py-0">{bn ? "ব্যর্থ" : "failed"}</Badge>
                      )}
                      {ev.outcome === "skipped" && (
                        <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] text-[10px] py-0">{bn ? "বাদ দেওয়া" : "skipped"}</Badge>
                      )}
                      {ev.ms !== undefined && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8A9B90]">
                          <Clock className="h-3 w-3" aria-hidden />
                          {ev.ms}ms
                        </span>
                      )}
                    </div>
                    {ev.detail && <p className="text-xs text-[#59665F] bn-text break-words">{ev.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-[#8A9B90] tabular-nums">
                    {new Date(ev.t).toLocaleTimeString(bn ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t border-[#D8DED5] bg-[#F4F1EB]/60 px-5 py-3 text-xs text-[#8A9B90] bn-text rounded-b-xl">
              {bn
                ? "এই ঘটনাগুলো সার্ভারে রেকর্ড করা প্রকৃত পাইপলাইন অবস্থা — লুকানো যুক্তি বা সংবেদনশীল তথ্য দেখানো হয় না।"
                : "These are genuine server-recorded pipeline events — hidden reasoning and sensitive data are never shown."}
            </p>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Voice Safety Lab (V3 §13) — transcript timeline + honest AI-voice disclaimer
// ---------------------------------------------------------------------------
function VoiceSafetyLab({ transcript, evidence, lang }: { transcript: string; evidence: { key: string; quote?: string; interpretation: Bilingual }[]; lang: string }) {
  const bn = lang === "bn";
  const segments = useMemo(
    () => transcript.split(/(?<=[।.!?\n])/).map((s) => s.trim()).filter(Boolean).slice(0, 14),
    [transcript]
  );
  const [activeSeg, setActiveSeg] = useState<number | null>(null);

  return (
    <Card className="border-2 border-[#2F5746]/25 bg-[#FFFEFA]">
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#202C26] bn-text">
            <AudioLines className="h-5 w-5 text-[#2F5746]" aria-hidden />
            {bn ? "ভয়েস সেফটি ল্যাব" : "Voice Safety Lab"}
          </h3>
          <Badge variant="outline" className="border-[#D8DED5] text-[#59665F]">
            {bn ? "ট্রান্সক্রিপ্ট টাইমলাইন" : "Transcript timeline"}
          </Badge>
        </div>

        {/* transcript timeline */}
        <div className="space-y-2">
          {segments.map((seg, i) => {
            const hit = evidence.find((e) => e.quote && seg.includes(e.quote.replace(/…/g, "").slice(2, 24)));
            return (
              <button
                key={i}
                onClick={() => setActiveSeg(activeSeg === i ? null : i)}
                className={cn(
                  "w-full rounded-xl border px-4 py-2.5 text-left transition-colors focus-ring",
                  hit
                    ? "border-[#A44435]/50 bg-[#F4E1DA]/60 hover:bg-[#F4E1DA]"
                    : "border-[#D8DED5] bg-[#F4F1EB] hover:bg-[#EDEAE1]"
                )}
                aria-pressed={activeSeg === i}
              >
                <span className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-[11px] font-bold text-[#8A9B90] tabular-nums shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-[#202C26] leading-relaxed bn-text">{seg}</span>
                  {hit && (
                    <Badge variant="outline" className="ml-auto shrink-0 border-[#A44435]/50 text-[#A44435] text-[10px] py-0">
                      {hit.key}
                    </Badge>
                  )}
                </span>
                {activeSeg === i && hit && (
                  <span className="mt-2 block border-t border-[#A44435]/20 pt-2 text-xs text-[#8C382B] bn-text">
                    {bn ? "কারণ: " : "Why: "}{hit.interpretation[bn ? "bn" : "en"]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* honest disclaimer — REQUIRED exact wording from the spec */}
        <div className="rounded-xl border-2 border-dashed border-[#8A5B28]/50 bg-[#F2E8D5]/70 p-4">
          <p className="flex items-start gap-2.5 text-sm font-semibold text-[#8A5B28] leading-relaxed bn-text">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {bn
              ? "কণ্ঠটি আসল নাকি এআই দিয়ে তৈরি, তা নিশ্চিত করা যায়নি।"
              : "It could not be confirmed whether the voice is real or AI-generated."}
          </p>
          <p className="mt-2 text-xs text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "লেখায় পরিবর্তন করে শুধু কী বলা হয়েছে তা যাচাই হয় — গলাটি আসল কিনা তা নয়। তাই কণ্ঠ শুনে বিশ্বাস না করে পরিবারের সদস্যের আগের পরিচিত নম্বরে নিজে ফোন দিয়ে নিশ্চিত হোন। বাংলাশিল্ড আপনার ফোনের কল বা অ্যাপ স্বয়ংক্রিয়ভাবে কখনোই শোনে বা দেখে না।"
              : "Transcription verifies what was said — not whether the voice is genuine. Never trust the voice alone; call the family member's previously known number yourself. BanglaShield never monitors your calls or apps."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Result page — V3 §11 order: risk → immediate action → explanation →
// evidence → Shield Lens → unknowns → resources → report/learn.
// ---------------------------------------------------------------------------
export default function AnalysisPage({ caseId }: { caseId: string }) {
  const bn = useLang() === "bn";
  const t = useT();
  const prefersReduced = useReducedMotion();
  const { navigate } = useHashRoute();
  const [data, setData] = useState<CaseData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<CaseData>(`/api/v1/analyses/${caseId}`);
      setData(res);
      setLoadError(null);
      return res;
    } catch (err) {
      setLoadError(
        err instanceof ShieldApiError ? err.apiError.message : "Network or server error"
      );
      return null;
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for real progress while the pipeline runs (any non-terminal status).
  useEffect(() => {
    if (!data || data.status === "completed" || data.status === "failed" || data.status === "canceled" || data.status === "expired") return;
    let stopped = false;
    const id = setInterval(async () => {
      if (stopped) return;
      const res = await load();
      if (!res || res.status === "completed" || res.status === "failed" || res.status === "canceled" || res.status === "expired") {
        stopped = true;
        clearInterval(id);
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [data, load]);

  const deleteCase = async () => {
    try {
      await api.del(`/api/v1/analyses/${caseId}`);
      toast.success(bn ? "কেসটি মুছে ফেলা হয়েছে" : "Case deleted");
      navigate("/privacy");
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    }
  };

  const cancelCase = async () => {
    setCanceling(true);
    try {
      await api.post(`/api/v1/analyses/${caseId}/cancel`, {});
      toast.success(bn ? "বিশ্লেষণ বাতিল করা হয়েছে" : "Analysis canceled");
      await load();
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    } finally {
      setCanceling(false);
    }
  };

  const sendFeedback = async (helpful: boolean) => {
    try {
      await api.post("/api/v1/feedback", { sessionId: caseId, helpful });
      setFeedbackSent(true);
      toast.success(bn ? "ধন্যবাদ! মতামত রেকর্ড হয়েছে" : "Thank you! Feedback recorded");
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-[#A44435]/40 bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="mx-auto h-10 w-10 text-[#A44435]" aria-hidden />
            <h1 className="text-xl font-bold text-[#202C26] bn-text">{bn ? "কেসটি খুঁজে পাওয়া যায়নি" : "Case not found"}</h1>
            <p className="text-[#59665F] bn-text">{loadError}</p>
            <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]">
              <Link to="/check">{bn ? "নতুন যাচাই শুরু করুন" : "Start a new check"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-4" aria-busy>
        <div className="h-24 rounded-2xl bg-[#EDEAE1] animate-pulse" />
        <div className="h-40 rounded-2xl bg-[#EDEAE1] animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#EDEAE1] animate-pulse" />
      </div>
    );
  }

  // -------- canceled view --------
  if (data.status === "canceled") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-4">
            <Ban className="mx-auto h-10 w-10 text-[#8A5B28]" aria-hidden />
            <h1 className="text-xl font-bold text-[#202C26] bn-text">{bn ? "বিশ্লেষণ বাতিল হয়েছে" : "Analysis canceled"}</h1>
            <p className="text-[#59665F] bn-text">
              {bn ? "আপনার অনুরোধে এই কেসটি বাতিল করা হয়েছে।" : "This case was canceled at your request."}
            </p>
            <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]">
              <Link to="/check">{bn ? "নতুন যাচাই শুরু করুন" : "Start a new check"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- expired view (retention) --------
  if (data.status === "expired") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <History className="mx-auto h-12 w-12 text-[#7A756A]" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-[#202C26] bn-text">
          {bn ? "কেসটির সংরক্ষণের মেয়াদ শেষ" : "This case has expired"}
        </h1>
        <p className="mt-2 text-[#59665F] bn-text">
          {bn
            ? "আমাদের গোপনীয়তা নীতি অনুযায়ী বিশ্লেষণের লেখা ও ফলাফল স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়েছে (৭ দিনের সংরক্ষণ)। নতুন কিছু পরীক্ষা করতে চাইলে যাচাই করুন-পাতায় যান।"
            : "Per our privacy policy, the stored text and result were automatically deleted after the 7-day retention window. To check something new, go to the Verify page."}
        </p>
        <button
          onClick={() => navigate("/check")}
          className="mt-6 rounded-xl bg-[#2F5746] px-5 py-3 text-sm font-bold text-[#FFFEFA] hover:bg-[#24453A]"
        >
          {bn ? "নতুন যাচাই শুরু করুন" : "Start a new check"}
        </button>
      </div>
    );
  }

  // -------- failed view --------
  if (data.status === "failed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-[#A44435]/40 bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="mx-auto h-10 w-10 text-[#A44435]" aria-hidden />
            <h1 className="text-xl font-bold text-[#202C26] bn-text">{bn ? "বিশ্লেষণ সম্পন্ন হয়নি" : "Analysis could not complete"}</h1>
            <p className="text-[#59665F] bn-text">
              {bn
                ? "দুঃখিত — কারিগরি সমস্যায় বিশ্লেষণটি থেমে গেছে। কোনো তথ্য বানানো হয়নি। আবার চেষ্টা করুন।"
                : "Sorry — a technical issue stopped this analysis. Nothing was fabricated. Please try again."}
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]">
                <Link to="/check">{bn ? "আবার চেষ্টা করুন" : "Try again"}</Link>
              </Button>
              <Button asChild variant="outline" className="border-[#D8DED5]">
                <Link to="/help">{bn ? "সহায়তা" : "Help"}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- processing view (with cancel + activity) --------
  if (data.status !== "completed") {
    const stageIdx = Math.max(0, STAGE_ORDER.indexOf((data.stage ?? "validating") as PipelineStage));
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[#202C26] text-center bn-text">
            {bn ? "বিশ্লেষণ চলছে…" : "Analysis in progress…"}
          </h1>
        </div>
        <p className="mt-2 text-center text-[#59665F] bn-text">
          {bn ? `কেস আইডি: ${data.id}` : `Case ID: ${data.id}`}
        </p>
        <Card className="mt-8 border border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-6 md:p-8 space-y-6">
            <ol className="space-y-1" aria-live="polite">
              {STAGE_ORDER.map((stage, i) => {
                const done = i < stageIdx;
                const active = i === stageIdx;
                const label = STAGE_LABELS[stage][bn ? "bn" : "en"];
                return (
                  <li key={stage} className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        done && "border-[#2F5746] bg-[#2F5746] text-[#FFFEFA]",
                        active && "border-[#2F5746] text-[#2F5746]",
                        !done && !active && "border-[#D8DED5] text-[#C4CFC7]"
                      )}
                      aria-hidden
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "text-[15px] bn-text",
                        done ? "text-[#2F5746] font-medium" : active ? "text-[#202C26] font-bold" : "text-[#8A9B90]"
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-[#8A9B90] text-center bn-text">
              {bn
                ? "এই অগ্রগতি প্রকৃত পাইপলাইন অবস্থা দেখায় — সাজানো অ্যানিমেশন নয়। পাতাটি খুলে রাখুন, রিফ্রেশ করলেও কাজ হারায় না।"
                : "This progress reflects the real pipeline state — not a staged animation. Keep the page open; a refresh won't lose your job."}
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={cancelCase}
                disabled={canceling}
                className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA] gap-2"
              >
                {canceling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CircleStop className="h-4 w-4" aria-hidden />}
                {bn ? "বাতিল করুন" : "Cancel analysis"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data.result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-lg font-bold text-[#202C26] bn-text">{bn ? "ফলাফল প্রস্তুত হচ্ছে…" : "Preparing result…"}</p>
      </div>
    );
  }

  // ================= COMPLETED — V3 ordered result =================
  const r = data.result;
  const risk = toV3Risk(r.riskCategory as string);
  const riskMeta = RISK_STATES[risk];
  const catLabel = SCAM_CATEGORIES[r.scamCategory]?.[bn ? "bn" : "en"] ?? r.scamCategory;
  const isVoice = data.modality === "voice";
  const immediate = r.immediateAction;
  const analysisMode = r.analysisMode ?? (r.engine === "ai_assisted" ? "LIVE_AI" : "RULE_BASED_FALLBACK");
  const modeLabel = t(`mode.${analysisMode}`) ?? analysisMode;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#59665F] uppercase">
            {bn ? "কেস আইডি" : "Case ID"} · {data.id}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "আপনার যাচাইয়ের ফলাফল" : "Your verification result"}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "border px-3 py-1 text-xs font-semibold",
              analysisMode === "LIVE_AI" && "border-[#2F5746]/50 text-[#2F5746] bg-[#DDE8DF]/50",
              analysisMode === "RULE_BASED_FALLBACK" && "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50",
              analysisMode === "OFFLINE_DEMO" && "border-dashed border-[#8A5B28]/60 text-[#8A5B28] bg-[#F2E8D5]/40"
            )}
          >
            {modeLabel}
            {r.synthetic ? (bn ? " · সিন্থেটিক" : " · synthetic") : ""}
          </Badge>
          <CopyButton value={data.id} label={bn ? "আইডি কপি" : "Copy ID"} />
        </div>
      </div>

      {/* 1. RISK STATUS — first thing seen */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label={bn ? "ঝুঁকির অবস্থা" : "Risk status"}
      >
        <RiskBanner risk={risk} title={riskMeta.label[bn ? "bn" : "en"]} />
        <p className="mt-2 text-[15px] text-[#59665F] leading-relaxed bn-text">{riskMeta.meaning[bn ? "bn" : "en"]}</p>
      </motion.section>

      {/* 2. IMMEDIATE PROTECTIVE ACTION — never buried */}
      {immediate && (
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          aria-labelledby="q-action"
          className="rounded-2xl border-2 border-[#2F5746] bg-[#2F5746] text-[#FFFEFA] overflow-hidden"
        >
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-[#DDE8DF]">
              <Siren className="h-4 w-4" aria-hidden />
              {bn ? "এখনই যা করবেন" : "Do this now"}
            </div>
            <h2 id="q-action" className="mt-2 text-xl md:text-2xl font-bold bn-text">
              {immediate.title[bn ? "bn" : "en"]}
            </h2>
            <p className="mt-2 text-[#E7EFE9] leading-relaxed bn-text">{immediate.detail[bn ? "bn" : "en"]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SpeakButton text={`${immediate.title[bn ? "bn" : "en"]}. ${immediate.detail[bn ? "bn" : "en"]}`} />
            </div>
          </div>
        </motion.section>
      )}

      {/* 3. SIMPLE EXPLANATION */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-labelledby="q-what"
      >
        <SectionTitle id="q-what" icon={<Info className="h-5 w-5" aria-hidden />} title={bn ? "কী হয়েছে ও কেন" : "What happened & why"} />
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-5 space-y-3">
            <p className="text-[17px] text-[#202C26] leading-relaxed bn-text">{r.summary[bn ? "bn" : "en"]}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] bn-text">
                {catLabel}
              </Badge>
              {isVoice && (
                <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] bn-text">
                  {bn ? "ভয়েস কেস" : "Voice case"}
                </Badge>
              )}
            </div>
            <p className="text-[15px] text-[#59665F] leading-relaxed bn-text">{r.why[bn ? "bn" : "en"]}</p>
            <div className="pt-1">
              <SpeakButton text={`${r.summary[bn ? "bn" : "en"]}. ${r.why[bn ? "bn" : "en"]}`} />
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* 3b. VOICE SAFETY LAB — voice cases get the dedicated experience */}
      {isVoice && data.extractedText && (
        <VoiceSafetyLab transcript={data.extractedText} evidence={r.evidence} lang={bn ? "bn" : "en"} />
      )}

      {/* 4. HIGHLIGHTED EVIDENCE */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        aria-labelledby="q-evidence"
      >
        <SectionTitle
          id="q-evidence"
          icon={<ListChecks className="h-5 w-5" aria-hidden />}
          title={bn ? "কোন প্রমাণ এই সিদ্ধান্তের ভিত্তি?" : "What evidence supports this?"}
        />
        <p className="mb-3 -mt-2 text-sm text-[#59665F] bn-text">
          {bn
            ? "প্রতিটি সূচক আপনার দেওয়া বিষয়বস্তু থেকেই নেওয়া — কোনো বানানো তথ্য নয়।"
            : "Every indicator comes from what you submitted — nothing is invented."}
        </p>
        {r.evidence.length === 0 ? (
          <InfoNote title={bn ? "প্রমাণ পাওয়া যায়নি" : "No indicators found"}>
            {bn
              ? "বার্তায় প্রতারণার পরিচিত লক্ষণগুলো ধরা পড়েনি। এটি নিরাপত্তার নিশ্চয়তা নয় — ভবিষ্যতে টাকা বা কোড চাইলে যাচাই করবেন।"
              : "No known scam markers were detected. This is not a safety guarantee — verify future requests for money or codes."}
          </InfoNote>
        ) : (
          <div className="space-y-3">
            {r.evidence.map((e) => (
              <EvidenceCard key={e.key} evidence={e} />
            ))}
          </div>
        )}
        {/* Redacted source */}
        {data.extractedText && (
          <Card className="mt-4 border-[#D8DED5] bg-[#F4F1EB]">
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8A9B90] mb-2">
                {bn ? "আপনার জমা দেওয়া বার্তা (আড়ালকৃত সংস্করণ)" : "Your submitted content (redacted version)"}
              </p>
              <p className="whitespace-pre-wrap text-[15px] text-[#202C26] leading-relaxed bn-text">{data.extractedText}</p>
              <p className="mt-2 text-xs text-[#8A9B90] flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                {bn ? "ওটিপি-পিন-নম্বর স্বয়ংক্রিয়ভাবে আড়াল করা হয়েছে" : "OTPs, PINs and numbers were auto-redacted"}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.section>

      {/* 5. INTERACTIVE SHIELD LENS */}
      {r.replay?.length > 0 && (
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          aria-labelledby="q-lens"
        >
          <SectionTitle
            id="q-lens"
            icon={<ShieldHalf className="h-5 w-5" aria-hidden />}
            title={bn ? "Shield Lens — ঘটনাটি ধাপে ধাপে দেখুন" : "Shield Lens — see it step by step"}
          />
          <Link
            to={`/shield-lens/${caseId}`}
            className="group block rounded-2xl border-2 border-[#2F5746]/25 bg-[#FFFEFA] p-5 transition-all hover:border-[#2F5746]/60 hover:shadow-md focus-ring"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2F5746] text-[#FFFEFA]">
                  <Play className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-bold text-[#202C26] bn-text">{bn ? "Shield Lens খুলুন" : "Open Shield Lens"}</p>
                  <p className="text-sm text-[#59665F] bn-text">
                    {bn
                      ? `আক্রমণের সময়রেখা — ${r.replay.length} ধাপ, প্রমাণ-সংযুক্ত, দুটি পথের তুলনা`
                      : `Attack timeline — ${r.replay.length} stages, evidence-linked, two-path comparison`}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-[#2F5746] transition-transform group-hover:translate-x-1" aria-hidden />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.replay.slice(0, 4).map((s) => (
                <StageTypeChip key={s.id} type={s.type} />
              ))}
            </div>
          </Link>
        </motion.section>
      )}

      {/* 5b. AI AGENT ACTIVITY EXPLORER */}
      {r.agentEvents?.length ? <ActivityExplorer events={r.agentEvents} lang={bn ? "bn" : "en"} /> : null}

      {/* 6. UNKNOWN INFORMATION */}
      {r.unknowns?.length > 0 && (
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          aria-labelledby="q-unknown"
        >
          <SectionTitle
            id="q-unknown"
            icon={<UnknownIcon className="h-5 w-5" aria-hidden />}
            title={bn ? "এখনো কী কী অজানা?" : "What remains unknown?"}
          />
          <Card className="border-[#D8DED5] bg-[#FFFEFA]">
            <CardContent className="p-5">
              <ul className="space-y-2.5">
                {r.unknowns.map((u, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#59665F] bn-text">
                    <HelpCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#8A5B28]" aria-hidden />
                    {u[bn ? "bn" : "en"]}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* 7. INDEPENDENT VERIFICATION RESOURCES */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        aria-labelledby="q-verify"
      >
        <SectionTitle
          id="q-verify"
          icon={<Landmark className="h-5 w-5" aria-hidden />}
          title={bn ? "নিজে যাচাই করুন — প্রতিষ্ঠানের আসল ঠিকানায়" : "Verify independently — official channels"}
        />
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-5">
            <p className="text-sm text-[#59665F] bn-text">
              {bn
                ? "বার্তায় আসা নম্বরে নয় — এই যাচাইকৃত ঠিকানাগুলো থেকে নিজে যোগাযোগ করুন:"
                : "Not the number in the message — contact institutions yourself through verified channels:"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Button asChild variant="outline" size="sm" className="border-[#2F5746]/40 text-[#2F5746] hover:bg-[#DDE8DF] gap-1.5">
                <Link to="/help" className="inline-flex">
                  <Landmark className="h-4 w-4" aria-hidden />
                  {bn ? "যাচাইকৃত যোগাযোগ তালিকা" : "Verified contact list"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA] gap-1.5">
                <Link to="/help" className="inline-flex">
                  <EmergencyIcon className="h-4 w-4" aria-hidden />
                  {bn ? "ক্ষতি হলে জরুরি ধাপ" : "Emergency steps if harmed"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* 8. MORE PROTECTIVE ACTIONS (remaining recommendations) */}
      {r.recommendations?.filter((rec) => rec.id !== immediate?.id).length > 0 && (
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          aria-labelledby="q-more"
        >
          <SectionTitle
            id="q-more"
            icon={<ListChecks className="h-5 w-5" aria-hidden />}
            title={bn ? "আরও সুরক্ষামূলক পদক্ষেপ" : "More protective steps"}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {r.recommendations
              .filter((rec) => rec.id !== immediate?.id)
              .map((rec) => (
                <Card key={rec.id} className="border-[#D8DED5] bg-[#FFFEFA] h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] py-0",
                          rec.priority === "now" && "border-[#A44435]/50 text-[#A44435]",
                          rec.priority === "soon" && "border-[#8A5B28]/50 text-[#8A5B28]",
                          rec.priority === "know" && "border-[#2F5746]/40 text-[#2F5746]"
                        )}
                      >
                        {rec.priority === "now" ? (bn ? "এখনই" : "Now") : rec.priority === "soon" ? (bn ? "শীঘ্রই" : "Soon") : bn ? "জেনে রাখুন" : "Know"}
                      </Badge>
                      <p className="font-semibold text-[15px] text-[#202C26] bn-text leading-snug">{rec.title[bn ? "bn" : "en"]}</p>
                    </div>
                    <p className="mt-2 text-sm text-[#59665F] leading-relaxed bn-text">{rec.detail[bn ? "bn" : "en"]}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </motion.section>
      )}

      {/* 9. LIMITATIONS (progressive disclosure) */}
      <motion.section initial={prefersReduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Collapsible>
          <Card className="border-[#D8DED5] bg-[#F4F1EB]/60">
            <CardContent className="p-0">
              <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus-ring rounded-xl">
                <span className="flex items-center gap-2 text-sm font-bold text-[#59665F]">
                  <Info className="h-4 w-4" aria-hidden />
                  {bn ? "এই বিশ্লেষণের সীমাবদ্ধতা" : "Limitations of this analysis"}
                </span>
                <ChevronDown className="h-4 w-4 text-[#59665F]" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="border-t border-[#D8DED5] px-5 py-4 space-y-2">
                  {r.limitations?.map((lim, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#59665F] bn-text">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A5B28]" aria-hidden />
                      {lim[bn ? "bn" : "en"]}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      </motion.section>

      {/* 10. OPTIONAL: REPORT & LEARN */}
      <motion.section
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="grid sm:grid-cols-2 gap-4"
        aria-label={bn ? "ঐচ্ছিক পরবর্তী ধাপ" : "Optional next steps"}
      >
        <Link
          to={data.hasReport ? "/community" : `/community?report=${caseId}`}
          className="group rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-5 transition-all hover:border-[#2F5746]/50 focus-ring"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DDE8DF] text-[#2F5746]">
              <Flag className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-[#202C26] bn-text">
                {data.hasReport ? (bn ? "রিপোর্ট জমা হয়েছে" : "Report submitted") : bn ? "অন্যদের বাঁচাতে রিপোর্ট করুন" : "Report to protect others"}
              </p>
              <p className="mt-0.5 text-sm text-[#59665F] bn-text">
                {data.hasReport
                  ? bn ? "অবস্থা কমিউনিটি পাতায় দেখুন।" : "Check its status on the Community page."
                  : bn ? "বেনামে · ঐচ্ছিক" : "Anonymous · optional"}
              </p>
            </div>
          </div>
        </Link>
        <Link
          to="/learn"
          className="group rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-5 transition-all hover:border-[#2F5746]/50 focus-ring"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DDE8DF] text-[#2F5746]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-[#202C26] bn-text">{bn ? "স্ক্যামএকাডেমিতে শিখুন" : "Learn at ScamAcademy"}</p>
              <p className="mt-0.5 text-sm text-[#59665F] bn-text">
                {bn ? "এই ধরনের ফাঁদ থেকে বাঁচার কৌশল" : "Tactics to avoid this kind of trap"}
              </p>
            </div>
          </div>
        </Link>
      </motion.section>

      {/* footer actions: feedback + delete */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#D8DED5]">
        <div className="flex items-center gap-2">
          {!feedbackSent ? (
            <>
              <span className="text-sm text-[#59665F] bn-text">{bn ? "ফলাফলটি কি কাজে এলো?" : "Was this helpful?"}</span>
              <Button variant="ghost" size="icon" onClick={() => sendFeedback(true)} aria-label={bn ? "সহায়ক ছিল" : "Helpful"} className="h-9 w-9 text-[#2F5746] hover:bg-[#DDE8DF]">
                <ThumbsUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => sendFeedback(false)} aria-label={bn ? "সহায়ক ছিল না" : "Not helpful"} className="h-9 w-9 text-[#8A5B28] hover:bg-[#F2E8D5]">
                <ThumbsDown className="h-4 w-4" aria-hidden />
              </Button>
            </>
          ) : (
            <span className="text-sm font-semibold text-[#2F5746] bn-text">{bn ? "ধন্যবাদ!" : "Thanks!"}</span>
          )}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-[#D8DED5] text-[#59665F] hover:text-[#A44435] hover:border-[#A44435]/40 gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {bn ? "এই কেসটি মুছে ফেলুন" : "Delete this case"}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#FFFEFA] border-[#D8DED5]">
            <DialogHeader>
              <DialogTitle className="bn-text">{bn ? "কেস মুছে ফেলবেন?" : "Delete this case?"}</DialogTitle>
              <DialogDescription className="bn-text">
                {bn
                  ? "ফলাফল ও সংরক্ষিত লেখা স্থায়ীভাবে মুছে যাবে (রিপোর্ট জমা থাকলে সেটি বহাল থাকবে)।"
                  : "The result and stored text will be permanently removed (a submitted report, if any, remains)."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="border-[#D8DED5]">
                {t("common.cancel")}
              </Button>
              <Button onClick={deleteCase} className="bg-[#A44435] text-[#FFFEFA] hover:bg-[#8C382B]">
                {bn ? "হ্যাঁ, মুছে দিন" : "Yes, delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function HelpCircleIcon({ className, ...rest }: { className?: string; [k: string]: unknown }) {
  return <UnknownIcon className={className} {...rest} />;
}
