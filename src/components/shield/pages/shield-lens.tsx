"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldHalf,
  Eye,
  Lightbulb,
  CloudLightning,
  List,
  LayoutGrid,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { api } from "../api";
import { useLang, useT } from "../i18n";
import { Link } from "../router";
import { RiskBadge, StageTypeChip, EvidenceCard, SpeakButton } from "../ui-bits";
import { DecisionBranchExplorer } from "../decision-branch";
import type { AnalysisResult, Evidence, ReplayStage, RiskCategory, Bilingual } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReplayData {
  id: string;
  ready: boolean;
  riskCategory?: RiskCategory;
  summary?: Bilingual;
  replay: ReplayStage[];
  evidence: Evidence[];
}

const SPEEDS = [0.5, 1, 2] as const;

export default function ShieldLensPage({ caseId }: { caseId: string }) {
  const bn = useLang() === "bn";
  const t = useT();
  const prefersReduced = useReducedMotion();
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [listMode, setListMode] = useState(false);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 within current stage

  useEffect(() => {
    api
      .get<ReplayData>(`/api/v1/analyses/${caseId}/replay`)
      .then((d) => setData(d))
      .catch(() => setError(bn ? "কেসটি খুঁজে পাওয়া যায়নি" : "Case not found"));
  }, [caseId, bn]);

  const stages = useMemo(() => data?.replay ?? [], [data]);
  const evidence = useMemo(() => data?.evidence ?? [], [data]);
  const stage = stages[idx];
  const stageDuration = 5000 / speed;

  // Autoplay with per-stage progress
  useEffect(() => {
    if (!playing || listMode || prefersReduced || !stage) return;
    const started = Date.now();
    // Reset progress through the same subscription (no direct setState in the
    // effect body): the first interval tick reports a near-zero value anyway.
    timerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / stageDuration);
      setProgress(p);
      if (p >= 1) {
        setIdx((i) => {
          if (i + 1 >= stages.length) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, idx, speed, stages.length, stageDuration, listMode, prefersReduced, stage]);

  const goTo = useCallback((i: number) => {
    setIdx(Math.max(0, Math.min(i, stages.length - 1)));
    setProgress(0);
  }, [stages.length]);

  const reset = () => {
    setPlaying(false);
    setIdx(0);
    setProgress(0);
    setFocusedEvidence(null);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-[#202C26] bn-text">{error}</p>
        <Button asChild className="bg-[#2F5746] text-[#FFFEFA]">
          <Link to="/check" className="mt-4 inline-block">{bn ? "নতুন যাচাই" : "New check"}</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-4" aria-busy>
        <div className="h-16 rounded-2xl bg-[#EDEAE1] animate-pulse" />
        <div className="h-72 rounded-2xl bg-[#EDEAE1] animate-pulse" />
      </div>
    );
  }

  if (!data.ready || stages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-lg font-bold text-[#202C26] bn-text">
              {bn ? "এই কেসের জন্য রিপ্লে প্রস্তুত নয়" : "Replay is not ready for this case"}
            </p>
            <p className="text-[#59665F] bn-text">
              {bn ? "বিশ্লেষণ সম্পন্ন হলে এখানে সময়রেখা দেখা যাবে।" : "Once the analysis completes, the timeline appears here."}
            </p>
            <Button asChild className="bg-[#2F5746] text-[#FFFEFA]">
              <Link to={`/analysis/${caseId}`}>{bn ? "ফলাফল দেখুন" : "View result"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TYPE_META = {
    observed: { icon: <Eye className="h-5 w-5" aria-hidden />, cls: "border-[#2F5746] bg-[#DDE8DF] text-[#2F5746]", label: bn ? "প্রত্যক্ষ প্রমাণ" : "Observed" },
    inferred: { icon: <Lightbulb className="h-5 w-5" aria-hidden />, cls: "border-[#8A5B28] bg-[#F2E8D5] text-[#8A5B28]", label: bn ? "অনুমিত কৌশল" : "Inferred tactic" },
    hypothetical: { icon: <CloudLightning className="h-5 w-5" aria-hidden />, cls: "border-dashed border-[#A44435] bg-[#F4E1DA] text-[#A44435]", label: bn ? "সম্ভাব্য পরিণতি" : "Hypothetical outcome" },
  } as const;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 md:py-10">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2F5746]">
            <ShieldHalf className="h-6 w-6 text-[#FFFEFA]" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#202C26]">Shield Lens</h1>
            <p className="text-xs text-[#59665F]">
              {bn ? "কেস" : "Case"} {caseId}
              {data.riskCategory && <span className="ml-2"><RiskBadge risk={data.riskCategory} size="sm" /></span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setListMode((m) => !m)}
            className="border-[#D8DED5] text-[#59665F] gap-1.5"
            aria-pressed={listMode}
          >
            {listMode ? <LayoutGrid className="h-4 w-4" aria-hidden /> : <List className="h-4 w-4" aria-hidden />}
            {listMode ? (bn ? "সময়রেখা দেখুন" : "Timeline view") : bn ? "লেখা-তালিকা দেখুন" : "Text list view"}
          </Button>
          <Button asChild variant="outline" size="sm" className="border-[#D8DED5] text-[#59665F] gap-1.5">
            <Link to={`/analysis/${caseId}`}>{bn ? "ফলাফলে ফিরুন" : "Back to result"}</Link>
          </Button>
        </div>
      </div>

      <p className="mb-6 text-sm text-[#59665F] leading-relaxed bn-text">
        {bn
          ? "নিচের সময়রেখাটি আপনার দেওয়া বার্তা থেকে তৈরি একটি ব্যাখ্যামূলক সিমুলেশন — ভবিষ্যদ্বাণী নয়। কোন ধাপ প্রত্যক্ষ প্রমাণ, কোনটি অনুমান, কোনটি সম্ভাব্য পরিণতি — সব আলাদা করে চিহ্নিত।"
          : "This timeline is an explanatory simulation built from your submitted message — not a prediction. Observed evidence, inferred tactics and hypothetical outcomes are clearly distinguished."}
      </p>

      {listMode ? (
        /* ---------- Accessible list alternative ---------- */
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-5 md:p-6">
            <ol className="space-y-5">
              {stages.map((s, i) => (
                <li key={s.id} className="border-l-2 border-[#DDE8DF] pl-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#202C26]">
                      {i + 1}. {s.title[bn ? "bn" : "en"]}
                    </span>
                    <StageTypeChip type={s.type} />
                  </div>
                  <p className="mt-1.5 text-[15px] text-[#59665F] leading-relaxed bn-text">{s.description[bn ? "bn" : "en"]}</p>
                  {s.evidenceRefs.length > 0 && (
                    <p className="mt-1 text-xs text-[#7D9C8B]">প্রমাণ / Evidence: {s.evidenceRefs.join(", ")}</p>
                  )}
                  {s.intervention && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <p className="rounded-lg border border-[#2F5746]/40 bg-[#DDE8DF] px-3 py-2 text-sm text-[#2F5746] bn-text">
                        ✓ {s.intervention.safe[bn ? "bn" : "en"]}
                      </p>
                      <p className="rounded-lg border border-dashed border-[#A44435]/50 bg-[#F4E1DA] px-3 py-2 text-sm text-[#A44435] bn-text">
                        ⚠ {s.intervention.unsafe[bn ? "bn" : "en"]}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <div>
            {/* ---------- Timeline rail ---------- */}
            <Card className="border-[#D8DED5] bg-[#FFFEFA]">
              <CardContent className="p-5 md:p-6">
                {/* stage nodes */}
                <div className="relative mb-2" role="tablist" aria-label={bn ? "আক্রমণ সময়রেখা" : "Attack timeline"}>
                  <div className="absolute left-0 right-0 top-4 h-1.5 rounded bg-[#EDEAE1]" aria-hidden />
                  <div
                    className="absolute top-4 h-1.5 rounded bg-[#2F5746] transition-all"
                    style={{ width: `${idx === 0 ? 0 : (idx / (stages.length - 1)) * 100}%` }}
                    aria-hidden
                  />
                  <div className="relative flex justify-between">
                    {stages.map((s, i) => {
                      const meta = TYPE_META[s.type];
                      return (
                        <button
                          key={s.id}
                          role="tab"
                          aria-selected={i === idx}
                          aria-label={`${i + 1}. ${s.title[bn ? "bn" : "en"]}`}
                          onClick={() => {
                            goTo(i);
                            setPlaying(false);
                          }}
                          className="group flex flex-col items-center gap-1 focus-ring rounded p-1 -mt-1"
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                              i < idx && "border-[#2F5746] bg-[#2F5746] text-[#FFFEFA]",
                              i === idx && cn("border-[#2F5746] bg-[#FFFEFA] text-[#2F5746] scale-110 shadow-md ring-4 ring-[#DDE8DF]"),
                              i > idx && cn("border-[#D8DED5] bg-[#FFFEFA] text-[#59665F]")
                            )}
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          <span
                            className={cn(
                              "hidden sm:block max-w-[86px] text-center text-[10px] leading-tight font-medium bn-text truncate w-[86px]",
                              i === idx ? "text-[#2F5746]" : "text-[#59665F]"
                            )}
                          >
                            {s.title[bn ? "bn" : "en"]}
                          </span>
                          <span className={cn("sm:hidden", i === idx ? "text-[#2F5746]" : "text-transparent")} aria-hidden>•</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* scrubber */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-[#59665F] tabular-nums">
                    {bn ? "ধাপ" : "Stage"} {idx + 1}/{stages.length}
                  </span>
                  <Slider
                    value={[idx + progress]}
                    min={0}
                    max={stages.length - 0.001}
                    step={0.01}
                    onValueChange={(v) => {
                      const target = Math.min(stages.length - 1, Math.floor(v[0]));
                      setIdx(target);
                      setProgress(Math.min(0.99, v[0] - target));
                    }}
                    aria-label={bn ? "সময়রেখা স্ক্রল" : "Timeline scrub"}
                    className="flex-1 data-[slot=slider-track]:bg-[#EDEAE1] [&_[data-slot=slider-range]]:bg-[#2F5746] [&_[data-slot=slider-thumb]]:border-[#2F5746] [&_[data-slot=slider-thumb]]:bg-[#FFFEFA]"
                  />
                </div>

                {/* controls */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => { goTo(idx - 1); setPlaying(false); }} disabled={idx === 0} className="border-[#D8DED5] text-[#2F5746]" aria-label={bn ? "আগের ধাপ" : "Previous stage"}>
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </Button>
                  <Button
                    onClick={() => {
                      if (idx === stages.length - 1 && progress >= 1) {
                        reset();
                        setPlaying(true);
                      } else {
                        setPlaying((p) => !p);
                      }
                    }}
                    className="h-12 w-12 rounded-full bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] shadow"
                    aria-label={playing ? (bn ? "থামান" : "Pause") : bn ? "চালান" : "Play"}
                  >
                    {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5 fill-current" aria-hidden />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => { goTo(idx + 1); setPlaying(false); }} disabled={idx === stages.length - 1} className="border-[#D8DED5] text-[#2F5746]" aria-label={bn ? "পরের ধাপ" : "Next stage"}>
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </Button>
                  <Button variant="outline" size="icon" onClick={reset} className="border-[#D8DED5] text-[#59665F]" aria-label={bn ? "শুরু থেকে" : "Replay from start"}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </Button>
                  <div className="ml-1 flex items-center rounded-lg border border-[#D8DED5] overflow-hidden" role="group" aria-label={bn ? "গতি" : "Speed"}>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={cn(
                          "px-2.5 py-1.5 text-xs font-bold transition-colors focus-ring",
                          speed === s ? "bg-[#2F5746] text-[#FFFEFA]" : "text-[#59665F] hover:bg-[#F4F1EB]"
                        )}
                        aria-pressed={speed === s}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ---------- Current stage card ---------- */}
            <AnimatePresence mode="wait">
              {stage && (
                <motion.div
                  key={stage.id + idx}
                  initial={prefersReduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReduced ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5"
                  role="tabpanel"
                  aria-label={`${idx + 1}. ${stage.title[bn ? "bn" : "en"]}`}
                >
                  <Card
                    className={cn(
                      "border-2 bg-[#FFFEFA] overflow-hidden",
                      stage.type === "observed" && "border-[#2F5746]/50",
                      stage.type === "inferred" && "border-[#8A5B28]/50",
                      stage.type === "hypothetical" && "border-dashed border-[#A44435]/60"
                    )}
                  >
                    <CardContent className="p-5 md:p-7">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl border-2", TYPE_META[stage.type].cls)} aria-hidden>
                          {TYPE_META[stage.type].icon}
                        </span>
                        <div>
                          <StageTypeChip type={stage.type} />
                          <h2 className="mt-1 text-xl md:text-2xl font-bold text-[#202C26] bn-text">
                            {stage.title[bn ? "bn" : "en"]}
                          </h2>
                        </div>
                      </div>
                      <p className="text-[17px] text-[#202C26] leading-relaxed bn-text">
                        {stage.description[bn ? "bn" : "en"]}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {stage.evidenceRefs.map((ref) => {
                          const ev = evidence.find((e) => e.key === ref);
                          return (
                            <button
                              key={ref}
                              onClick={() => setFocusedEvidence(ref)}
                              className="rounded-full border border-[#2F5746]/40 bg-[#DDE8DF] px-3 py-1 text-xs font-bold text-[#2F5746] hover:bg-[#DDE8DF]/70 focus-ring"
                            >
                              {bn ? "প্রমাণ দেখুন" : "Evidence"} {ref}
                              {ev ? ` · ${bn ? "ওজন" : "weight"}: ${ev.weight}` : ""}
                            </button>
                          );
                        })}
                        <SpeakButton text={`${stage.title[bn ? "bn" : "en"]}। ${stage.description[bn ? "bn" : "en"]}`} />
                      </div>

                      {/* intervention branches — animated decision explorer */}
                      {stage.intervention && (
                        <DecisionBranchExplorer
                          intervention={stage.intervention}
                          evidence={evidence}
                          caseId={caseId}
                        />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* next step link at end */}
            {idx === stages.length - 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2 font-bold">
                  <Link to={`/analysis/${caseId}`}>
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {bn ? "সুপারিশকৃত পদক্ষেপ দেখুন" : "See recommended actions"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-[#2F5746]/50 text-[#2F5746] hover:bg-[#DDE8DF] gap-2 font-bold">
                  <Link to={`/report?case=${caseId}`}>
                    {bn ? "অন্যদের বাঁচাতে রিপোর্ট করুন" : "Report to protect others"}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </motion.div>
            )}
          </div>

          {/* ---------- Evidence side panel ---------- */}
          <aside className="space-y-3 lg:sticky lg:top-20">
            <p className="text-sm font-bold text-[#202C26] bn-text">
              {bn ? "প্রমাণের কার্ড (চাপ দিয়ে দেখুন)" : "Evidence cards (tap to inspect)"}
            </p>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto scroll-soft pr-1" aria-label={bn ? "প্রমাণ তালিকা" : "Evidence list"}>
              {evidence.map((e) => (
                <EvidenceCard
                  key={e.key}
                  evidence={e}
                  highlight={focusedEvidence === e.key || (stage?.evidenceRefs ?? []).includes(e.key)}
                  onSelect={() => setFocusedEvidence(e.key === focusedEvidence ? null : e.key)}
                />
              ))}
              {evidence.length === 0 && (
                <p className="text-sm text-[#59665F] bn-text">
                  {bn ? "এই কেসে প্রমাণ-কার্ড নেই।" : "No evidence cards for this case."}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
