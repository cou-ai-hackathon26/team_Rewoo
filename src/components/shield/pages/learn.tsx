"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Smartphone,
  KeyRound,
  Briefcase,
  Link2,
  Landmark,
  UserCheck,
  AudioLines,
  ShoppingBag,
  Loader2,
  RotateCcw,
  ListChecks,
  Award,
  Play,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "../api";
import { useLang } from "../i18n";
import { useSettings } from "../store";
import { LESSONS, type Lesson, type QuizQuestion } from "../data/lessons";
import { SimulationLab } from "./simulation";
import { ScamVideoPlayer, VideoGallery, SCAM_VIDEOS, type ScamVideo } from "./scam-videos";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  Smartphone: <Smartphone className="h-7 w-7" aria-hidden />,
  KeyRound: <KeyRound className="h-7 w-7" aria-hidden />,
  Briefcase: <Briefcase className="h-7 w-7" aria-hidden />,
  Link2: <Link2 className="h-7 w-7" aria-hidden />,
  Landmark: <Landmark className="h-7 w-7" aria-hidden />,
  UserCheck: <UserCheck className="h-7 w-7" aria-hidden />,
  AudioLines: <AudioLines className="h-7 w-7" aria-hidden />,
  ShoppingBag: <ShoppingBag className="h-7 w-7" aria-hidden />,
};

interface ProgressMap {
  [lessonId: string]: { score: number; total: number };
}

export default function LearnPage() {
  const bn = useLang() === "bn";
  const prefersReduced = useReducedMotion();
  const learnerToken = useSettings((s) => s.learnerToken);
  const [active, setActive] = useState<Lesson | null>(null);
  const [activeVideo, setActiveVideo] = useState<ScamVideo | null>(null);
  const [mode, setMode] = useState<"lessons" | "videos" | "lab">(() => {
    if (typeof window === "undefined") return "lessons";
    const tab = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("tab");
    return tab === "videos" || tab === "lab" ? tab : "lessons";
  });
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    api
      .get<{ progress: { lessonId: string; score: number; total: number }[] }>(
        `/api/v1/learn/progress?learnerToken=${learnerToken}`
      )
      .then((r) => {
        const map: ProgressMap = {};
        for (const p of r.progress) map[p.lessonId] = { score: p.score, total: p.total };
        setProgress(map);
      })
      .catch(() => {
        /* offline — localStorage fallback below */
        try {
          const raw = localStorage.getItem("bs-learn-progress");
          if (raw) setProgress(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      });
  }, [learnerToken]);

  const persist = (map: ProgressMap) => {
    setProgress(map);
    try {
      localStorage.setItem("bs-learn-progress", JSON.stringify(map));
    } catch {
      /* ignore */
    }
  };

  const totalScore = useMemo(
    () => Object.values(progress).reduce((sum, p) => sum + p.score, 0),
    [progress]
  );
  const doneCount = Object.keys(progress).length;

  const onComplete = (lesson: Lesson, score: number) => {
    persist({ ...progress, [lesson.id]: { score, total: lesson.questions.length } });
    api
      .post("/api/v1/learn/progress", {
        learnerToken,
        lessonId: lesson.id,
        score,
        total: lesson.questions.length,
      })
      .catch(() => {
        /* offline fallback already saved locally */
      });
  };

  // Simulation completion — device-only by design (stated in the lab notice).
  const onSimComplete = (simId: string, score: number, total: number) => {
    persist({ ...progress, [simId]: { score, total } });
  };

  // ---------------- lesson player ----------------
  if (active) {
    return (
      <LessonPlayer
        lesson={active}
        onExit={() => setActive(null)}
        onFinish={(score) => onComplete(active, score)}
        prefersReduced={prefersReduced}
      />
    );
  }

  // ---------------- animated educational video ----------------
  if (activeVideo) {
    return <ScamVideoPlayer video={activeVideo} onExit={() => setActiveVideo(null)} />;
  }

  // ---------------- header + mode toggle ----------------
  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#8A5B28]">
            <GraduationCap className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#202C26]">ScamAcademy</h1>
            <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
              {bn
                ? "ছোট ছোট বাস্তব পরিস্থিতিতে নিজের সিদ্ধান্ত ঝালাই করুন — ভুল হলে সাথে সাথে ব্যাখ্যা পাবেন। প্রতিটি পাঠ ৩-৬ মিনিটের।"
                : "Sharpen your judgment in small realistic scenarios — with instant feedback on every choice. Each lesson takes 3-6 minutes."}
            </p>
          </div>
        </div>
        {doneCount > 0 && (
          <Card className="border-[#2F5746]/50 bg-[#DDE8DF] min-w-40">
            <CardContent className="p-4 text-center">
              <Award className="mx-auto h-6 w-6 text-[#2F5746]" aria-hidden />
              <p className="mt-1 text-2xl font-bold text-[#2F5746] tabular-nums">
                {totalScore}
                <span className="text-sm text-[#59665F]">/{Object.values(progress).reduce((s, p) => s + p.total, 0)}</span>
              </p>
              <p className="text-xs text-[#59665F] bn-text">{bn ? "মোট সঠিক উত্তর" : "total correct"}</p>
            </CardContent>
          </Card>
        )}
      </div>
  );

  // ---------------- mode toggle (shared) ----------------
  const modeToggle = (accent: string) => (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[#EDEAE1] p-1.5 w-fit" role="tablist" aria-label={bn ? "মোড" : "Mode"}>
      {(
        [
          { v: "lessons", bn: "পাঠসমূহ", en: "Lessons", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
          { v: "videos", bn: "শিক্ষা ভিডিও", en: "Videos", icon: <Play className="h-4 w-4" aria-hidden /> },
          { v: "lab", bn: "সিমুলেশন ল্যাব", en: "Simulation lab", icon: <FlaskConical className="h-4 w-4" aria-hidden /> },
        ] as const
      ).map((m) => {
        const selected = mode === m.v;
        return (
          <button
            key={m.v}
            role="tab"
            aria-selected={selected}
            onClick={() => setMode(m.v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold focus-ring bn-text",
              selected ? "bg-[#FFFEFA] shadow-sm" : "text-[#59665F] hover:bg-[#FFFEFA]/70"
            )}
            style={selected ? { color: accent } : undefined}
          >
            {m.icon}
            {bn ? m.bn : m.en}
          </button>
        );
      })}
    </div>
  );

  // ---------------- simulation lab ----------------
  if (mode === "lab") {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-6">
        {header}
        {modeToggle("#8A5B28")}
        <SimulationLab onFinish={onSimComplete} completed={progress} />
      </div>
    );
  }

  // ---------------- animated videos ----------------
  if (mode === "videos") {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-6">
        {header}
        {modeToggle("#A44435")}
        <p className="text-sm text-[#59665F] bn-text">
          {bn
            ? "অ্যানিমেটেড শিক্ষা ভিডিও — ফোনের পর্দায় প্রতারণার দৃশ্য দেখুন, বাংলা কণ্ঠে ব্যাখ্যা শুনুন। সব ঘটনা কাল্পনিক ও স্পষ্টভাবে লেবেলকৃত।"
            : "Animated educational videos — watch scam scenes play out on a phone screen with Bengali narration. All cases are fictional and clearly labeled."}
        </p>
        <VideoGallery onPlay={setActiveVideo} />
      </div>
    );
  }

  // ---------------- lesson grid ----------------
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {modeToggle("#2F5746")}
        <p className="text-xs text-[#7D9C8B] bn-text">
          {bn ? "অ্যাকাউন্ট লাগে না · প্রগতি এই ডিভাইসেই থাকে" : "No account needed · progress stays on this device"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LESSONS.map((lesson, i) => {
          const p = progress[lesson.id];
          const complete = Boolean(p);
          return (
            <motion.button
              key={lesson.id}
              initial={prefersReduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              onClick={() => setActive(lesson)}
              className={cn(
                "text-left rounded-2xl focus-ring border-2 transition-all group",
                complete
                  ? "border-[#2F5746]/60 bg-[#FFFEFA]"
                  : "border-[#D8DED5] bg-[#FFFEFA] hover:border-[#2F5746]/50 hover:shadow-md"
              )}
            >
              <Card className="h-full border-0 bg-transparent shadow-none">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        complete ? "bg-[#2F5746] text-[#FFFEFA]" : "bg-[#DDE8DF] text-[#2F5746]"
                      )}
                    >
                      {ICONS[lesson.icon] ?? <BookOpen className="h-7 w-7" aria-hidden />}
                    </span>
                    {complete && (
                      <Badge className="bg-[#DDE8DF] text-[#2F5746] hover:bg-[#DDE8DF] border-0 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {p.score}/{p.total}
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#202C26] bn-text">{lesson.title[bn ? "bn" : "en"]}</h2>
                  <p className="mt-1 text-sm text-[#59665F] leading-relaxed bn-text">{lesson.summary[bn ? "bn" : "en"]}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#2F5746]">
                    {bn ? "শুরু করুন" : "Start"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    <span className="ml-2 font-medium text-[#59665F]">· {lesson.minutes} {bn ? "মিনিট" : "min"}</span>
                  </p>
                </CardContent>
              </Card>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson player: sequential scenarios with instant feedback
// ---------------------------------------------------------------------------

function LessonPlayer({
  lesson,
  onExit,
  onFinish,
  prefersReduced,
}: {
  lesson: Lesson;
  onExit: () => void;
  onFinish: (score: number) => void;
  prefersReduced: boolean | null;
}) {
  const bn = useLang() === "bn";
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  // Review mode (2.0): remember every pick so the result screen can show
  // exactly which decisions were unsafe and why.
  const [mistakes, setMistakes] = useState<Array<{ q: QuizQuestion; pickedId: string }>>([]);
  const [showReview, setShowReview] = useState(false);

  const q: QuizQuestion | undefined = lesson.questions[qIndex];

  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    if (id === q!.correct) setScore((s) => s + 1);
    else setMistakes((m) => [...m, { q: q!, pickedId: id }]);
  };

  const next = () => {
    if (qIndex + 1 >= lesson.questions.length) {
      setFinished(true);
      onFinish(score);
    } else {
      setQIndex((i) => i + 1);
      setPicked(null);
    }
  };

  if (finished || !q) {
    const pct = Math.round((score / lesson.questions.length) * 100);
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <motion.div initial={prefersReduced ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-2 border-[#2F5746]/50 bg-[#FFFEFA]">
            <CardContent className="p-8 text-center space-y-5">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#DDE8DF]">
                <Award className="h-10 w-10 text-[#2F5746]" aria-hidden />
              </span>
              <h1 className="text-2xl font-bold text-[#202C26] bn-text">
                {pct >= 67
                  ? bn ? "দুর্দান্ত! আপনি প্রস্তুত" : "Excellent! You are prepared"
                  : bn ? "ভালো চেষ্টা — আরেকবার দেখুন" : "Good try — review once more"}
              </h1>
              <p className="text-lg text-[#59665F] bn-text">
                {bn ? "সঠিক সিদ্ধান্ত" : "Correct decisions"}: <strong className="text-[#2F5746]">{score}</strong> / {lesson.questions.length} ({pct}%)
              </p>

              {/* Review of incorrect answers (ScamAcademy 2.0) */}
              {mistakes.length > 0 && (
                <div className="rounded-xl border-2 border-dashed border-[#8A5B28]/50 bg-[#F2E8D5]/50 p-4 text-left">
                  <button
                    onClick={() => setShowReview((v) => !v)}
                    aria-expanded={showReview}
                    className="flex w-full items-center justify-between gap-2 rounded-lg focus-ring px-1 py-0.5"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-[#8A5B28] bn-text">
                      <ListChecks className="h-4 w-4" aria-hidden />
                      {bn
                        ? `যে ${mistakes.length} টি সিদ্ধান্তে ভুল হয়েছিল — দেখে নিন`
                        : `Review the ${mistakes.length} decision(s) you got wrong`}
                    </span>
                    <ArrowRight className={cn("h-4 w-4 text-[#8A5B28] transition-transform", showReview && "rotate-90")} aria-hidden />
                  </button>
                  {showReview && (
                    <ol className="mt-3 space-y-4">
                      {mistakes.map((m, i) => {
                        const chosen = m.q.options.find((o) => o.id === m.pickedId);
                        const right = m.q.options.find((o) => o.id === m.q.correct);
                        return (
                          <li key={i} className="rounded-lg border border-[#D8DED5] bg-[#FFFEFA] p-3">
                            <p className="text-sm text-[#202C26] leading-relaxed bn-text">
                              <strong>{bn ? "পরিস্থিতি: " : "Scenario: "}</strong>{m.q.scenario[bn ? "bn" : "en"]}
                            </p>
                            <p className="mt-1.5 text-sm text-[#A44435] bn-text">
                              <strong>{bn ? "আপনার উত্তর: " : "Your answer: "}</strong>{chosen?.text[bn ? "bn" : "en"]}
                            </p>
                            <p className="mt-1 text-sm text-[#2F5746] bn-text">
                              <strong>{bn ? "নিরাপদ উত্তর: " : "Safe answer: "}</strong>{right?.text[bn ? "bn" : "en"]}
                            </p>
                            <p className="mt-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                              <strong>{bn ? "কারণ: " : "Why: "}</strong>{m.q.explanation[bn ? "bn" : "en"]}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
              <div className="rounded-xl bg-[#F4F1EB] p-4 text-left">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#202C26]">
                  <ListChecks className="h-4 w-4 text-[#2F5746]" aria-hidden />
                  {bn ? "মনে রাখার নিয়মগুলো:" : "Rules to remember:"}
                </p>
                <ul className="space-y-1.5">
                  {lesson.keyPoints.map((k, i) => (
                    <li key={i} className="text-sm text-[#59665F] leading-relaxed bn-text">
                      • {k[bn ? "bn" : "en"]}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQIndex(0);
                    setPicked(null);
                    setScore(0);
                    setFinished(false);
                    setMistakes([]);
                    setShowReview(false);
                  }}
                  className="border-[#2F5746]/50 text-[#2F5746] gap-2"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> {bn ? "আবার" : "Retry"}
                </Button>
                <Button onClick={onExit} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2">
                  {bn ? "সব পাঠে ফিরুন" : "All lessons"} <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const isCorrect = picked === q.correct;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 md:py-10 space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onExit} className="text-[#59665F] gap-1.5 focus-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {bn ? "পাঠসমূহ" : "Lessons"}
        </Button>
        <p className="text-sm font-semibold text-[#59665F] tabular-nums">
          {bn ? "প্রশ্ন" : "Question"} {qIndex + 1}/{lesson.questions.length}
        </p>
      </div>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#202C26] bn-text">{lesson.title[bn ? "bn" : "en"]}</h1>
        <Progress
          value={((qIndex + (picked ? 1 : 0)) / lesson.questions.length) * 100}
          className="mt-3 h-2 bg-[#EDEAE1] [&>div]:bg-[#2F5746]"
          aria-label={bn ? "অগ্রগতি" : "Progress"}
        />
      </div>

      {/* scenario */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Card className="border-[#D8DED5] bg-[#F4F1EB]">
            <CardContent className="p-5">
              <p className="text-[17px] text-[#202C26] leading-relaxed bn-text">{q.scenario[bn ? "bn" : "en"]}</p>
            </CardContent>
          </Card>

          <div className="space-y-2.5" role="radiogroup" aria-label={bn ? "আপনার সিদ্ধান্ত" : "Your decision"}>
            {q.options.map((opt) => {
              const isPicked = picked === opt.id;
              const correct = opt.id === q.correct;
              return (
                <button
                  key={opt.id}
                  role="radio"
                  aria-checked={isPicked}
                  disabled={Boolean(picked)}
                  onClick={() => pick(opt.id)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-4 transition-all focus-ring bn-text",
                    !picked && "border-[#D8DED5] bg-[#FFFEFA] hover:border-[#2F5746]/60",
                    picked && correct && "border-[#2F5746] bg-[#DDE8DF]",
                    picked && !correct && isPicked && "border-[#A44435] bg-[#F4E1DA]",
                    picked && !correct && !isPicked && "border-[#D8DED5] bg-[#FFFEFA] opacity-60"
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        picked && correct && "border-[#2F5746] bg-[#2F5746] text-[#FFFEFA]",
                        picked && !correct && isPicked && "border-[#A44435] bg-[#A44435] text-[#FFFEFA]",
                        (!picked || (picked && !correct && !isPicked)) && "border-[#D8DED5] text-[#59665F]"
                      )}
                      aria-hidden
                    >
                      {picked && correct ? <CheckCircle2 className="h-4 w-4" /> : picked && isPicked ? <XCircle className="h-4 w-4" /> : opt.id.toUpperCase()}
                    </span>
                    <span className="text-[15px] leading-relaxed text-[#202C26]">{opt.text[bn ? "bn" : "en"]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* feedback */}
          <AnimatePresence>
            {picked && (
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl border-2 p-4",
                  isCorrect ? "border-[#2F5746]/50 bg-[#DDE8DF]/60" : "border-[#8A5B28]/50 bg-[#F2E8D5]/70"
                )}
                role="status"
              >
                <p className="flex items-center gap-2 font-bold bn-text">
                  {isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-[#2F5746]" aria-hidden />
                  ) : (
                    <XCircle className="h-5 w-5 text-[#8A5B28]" aria-hidden />
                  )}
                  {isCorrect ? (bn ? "সঠিক সিদ্ধান্ত!" : "Correct!") : bn ? "ভেবে দেখুন আবার" : "Think again"}
                </p>
                {!isCorrect && (
                  <p className="mt-1 text-[15px] font-semibold text-[#2F5746] bn-text">
                    {bn ? "নিরাপদ উত্তর: " : "The safe answer: "}
                    {q.options.find((o) => o.id === q.correct)?.text[bn ? "bn" : "en"]}
                  </p>
                )}
                <p className="mt-1.5 text-[15px] text-[#202C26] leading-relaxed bn-text">{q.explanation[bn ? "bn" : "en"]}</p>
                <Button onClick={next} className="mt-3 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2 font-bold">
                  {qIndex + 1 >= lesson.questions.length
                    ? bn ? "ফলাফল দেখুন" : "See result"
                    : bn ? "পরের প্রশ্ন" : "Next question"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {!picked && (
            <p className="flex items-center gap-2 text-xs text-[#59665F]">
              <Loader2 className="h-3 w-3 animate-spin opacity-0" aria-hidden />
              {bn ? "একটি বিকল্প বাছাই করুন।" : "Choose one option to continue."}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
