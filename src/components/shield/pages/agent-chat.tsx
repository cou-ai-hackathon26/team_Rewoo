"use client";

// ShieldAgent chat — the citizen-facing AI assistant. Every reply is labeled
// live-AI, rule-based fallback or deterministic incident-flow (never faked);
// guidance is grounded in the same safety doctrine as the analysis pipeline.
//
// COU TECHNOVA 2026 additions:
//  - VOICE INPUT (Challenge 1): a microphone button inside the chat with
//    explicit consent → listening → processing → transcript review/correction
//    → sending states. Reuses the app's MediaRecorder + bn-BD
//    SpeechRecognition technique (voice-capture.ts) and the server ASR
//    endpoint (/api/v1/agent/voice). Typed input always remains available.
//  - INCIDENT STATE (Challenge 1): the server's deterministic resolver state
//    (unknown / not_shared / shared) is shown as a small badge per reply.
//  - VERIFIED CONTACTS (Challenge 2): replies may carry server-validated
//    directory contact cards. When the directory changes mid-conversation,
//    older cards are re-rendered as outdated and stop being actionable.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Send,
  Loader2,
  User,
  ShieldQuestion,
  ChevronDown,
  ChevronRight,
  Cpu,
  Mic,
  Square,
  X,
  RotateCcw,
  PhoneCall,
  ExternalLink,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ShieldApiError } from "../api";
import { useLang } from "../i18n";
import { CHAT_MODEL_CATALOG } from "@/lib/chat-models";
import { cn } from "@/lib/utils";
import { nextVoicePhase, transcriptUsable, type VoicePhase } from "@/lib/voice-flow";
import { VoiceCapture, voiceCaptureSupported } from "../voice-capture";

// --- shared payload types (server-validated) --------------------------------

interface ContactCardItem {
  key: string;
  name: { bn: string; en: string };
  category: string;
  phone: string | null;
  url: string;
  guidance: { bn: string; en: string };
  verifiedAt: string;
  source: "directory" | "fallback" | "demo";
  actionable: boolean;
  demo: boolean;
}

interface ContactsPayload {
  source: "database" | "bundled-fallback" | "demo-directory";
  directoryVersion: string;
  policy: { maxAgeDays: number };
  items: ContactCardItem[];
  unavailableNotice: { bn: string; en: string } | null;
}

interface IncidentInfo {
  state: "unknown" | "not_shared" | "shared";
  stage: string | null;
  changed: boolean;
  correction: boolean;
  resolvedBy: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  engine?: string; // assistant messages
  servedModel?: string | null; // OpenRouter model that served the reply
  incident?: IncidentInfo | null;
  contacts?: ContactsPayload | null;
}

const QUICK_PROMPTS = [
  {
    bn: "একজন ফোন করে আমার বিকাশের OTP চাইছে।",
    en: "Someone called asking for my bKash OTP.",
  },
  {
    bn: "এই মেসেজটা কি প্রতারণা? “আপনার বিকাশ একাউন্ট সাসপেন্ড হবে, ওটিপি দিন”",
    en: "Is this a scam? “Your bKash account will be suspended, send the OTP”",
  },
  {
    bn: "ভুয়া চাকরির বিজ্ঞপ্তি চেনার উপায় কী?",
    en: "How do I recognize fake job circulars?",
  },
  {
    bn: "টাকা পাঠিয়ে ফেলেছি — এখন কী করবো?",
    en: "I already sent money — what should I do now?",
  },
  {
    bn: "বাবা-মাকে সতর্ক করার সহজ উপায় বলুন",
    en: "Easy ways to warn my parents about scams",
  },
];

const MODEL_STORAGE_KEY = "banglashield.chat.model";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("read-failed"));
    r.readAsDataURL(blob);
  });
}

// --- verified-contact cards (Challenge 2) -----------------------------------

function ContactCards({ payload, stale, bn }: { payload: ContactsPayload; stale: boolean; bn: boolean }) {
  const items = payload.items ?? [];
  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-[#D8DED5] bg-[#F4F1EB] p-3 space-y-2",
        stale && "opacity-60"
      )}
      aria-label={bn ? "যাচাইকৃত অফিসিয়াল যোগাযোগ" : "Verified official contacts"}
    >
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#2F5746] bn-text">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        {bn ? "সার্ভার-যাচাইকৃত অফিসিয়াল যোগাযোগ (ডিরেক্টরি থেকে)" : "Server-verified official contacts (from the directory)"}
        <Badge variant="outline" className="ml-1 border-[#8A5B28]/50 text-[#8A5B28] text-[9px]">
          {bn ? `সতেজতা নীতি: ${payload.policy.maxAgeDays} দিন` : `freshness policy: ${payload.policy.maxAgeDays}d`}
        </Badge>
        {payload.source === "demo-directory" && (
          <Badge variant="outline" className="border-[#A44435]/50 text-[#A44435] text-[9px]">TEST DATA</Badge>
        )}
      </p>
      {stale && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A5B28] bn-text">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {bn ? "ডিরেক্টরি বদলে গেছে — এই পুরনো তালিকা আর বর্তমান নয়। সর্বশেষ উত্তরের তালিকা দেখুন।" : "The directory changed — this list is outdated. See the latest reply's list."}
        </p>
      )}
      {items.length === 0 && payload.unavailableNotice && (
        <p className="text-[12px] leading-relaxed text-[#59665F] bn-text">
          {bn ? payload.unavailableNotice.bn : payload.unavailableNotice.en}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((c) => (
          <div
            key={c.key}
            className={cn(
              "rounded-lg border bg-[#FFFEFA] p-2.5",
              c.source === "fallback" ? "border-[#C9C2B2]" : "border-[#2F5746]/25"
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] font-bold text-[#202C26] bn-text">{bn ? c.name.bn : c.name.en}</span>
              {c.demo ? (
                <Badge variant="outline" className="border-[#A44435]/50 text-[#A44435] text-[9px]">TEST DATA</Badge>
              ) : c.source === "directory" ? (
                <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] text-[9px]">
                  {bn ? "যাচাইকৃত" : "verified"}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] text-[9px]">
                  {bn ? "স্ন্যাপশট — বর্তমানে যাচাইকৃত নয়" : "snapshot — not currently verified"}
                </Badge>
              )}
            </div>
            {c.actionable && c.phone ? (
              stale ? (
                <p className="mt-1 text-[13px] font-bold text-[#8A9B90] line-through" aria-label={bn ? "পুরনো নম্বর — আর ব্যবহারযোগ্য নয়" : "outdated number — no longer actionable"}>
                  {c.phone}
                </p>
              ) : (
                <a
                  href={`tel:${c.phone}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2F5746] hover:underline"
                  aria-label={bn ? `${c.name.bn} — নিজে কল করুন` : `${c.name.en} — call yourself`}
                >
                  <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                  {c.phone}
                  <span className="text-[10px] font-medium text-[#8A9B90]">{bn ? "(নিজে থেকে কল করুন)" : "(call it yourself)"}</span>
                </a>
              )
            ) : (
              c.phone === null && (
                <p className="mt-1 text-[11px] text-[#7A756A] bn-text">
                  {bn ? "নম্বর বানানো হয় না — অফিসিয়াল চ্যানেল থেকে নিজে যাচাই করুন" : "No number given — verify the channel yourself"}
                </p>
              )
            )}
            {c.url && stale ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-[#8A9B90] bn-text">
                <ExternalLink className="h-3 w-3" aria-hidden />
                {new URL(c.url).hostname}
              </p>
            ) : (
              c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-[11px] text-[#2F5746] hover:underline bn-text"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  {new URL(c.url).hostname}
                </a>
              )
            )}
            <p className="mt-1 text-[11px] leading-snug text-[#59665F] bn-text">{bn ? c.guidance.bn : c.guidance.en}</p>
            <p className="mt-1 text-[10px] text-[#8A9B90]">
              {bn ? "যাচাই:" : "Verified:"} {new Date(c.verifiedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- incident badge (Challenge 1) --------------------------------------------

const STATE_LABEL = {
  unknown: { bn: "কোড শেয়ার: অজানা", en: "code shared: unknown" },
  not_shared: { bn: "কোড শেয়ার করেননি", en: "code NOT shared" },
  shared: { bn: "কোড শেয়ার করেছেন (নিশ্চিত)", en: "code shared (confirmed)" },
};

function IncidentBadge({ info, bn }: { info: IncidentInfo; bn: boolean }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8A9B90] bn-text">
      <span className="font-bold">{bn ? "ঘটনা-অবস্থা:" : "incident state:"}</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-bold",
          info.state === "shared" ? "bg-[#A44435]/10 text-[#A44435]" : "bg-[#2F5746]/10 text-[#2F5746]"
        )}
      >
        {bn ? STATE_LABEL[info.state].bn : STATE_LABEL[info.state].en}
      </span>
      <span className="text-[#8A9B90]">· {info.resolvedBy}</span>
      {info.correction && (
        <span className="rounded bg-[#8A5B28]/10 px-1.5 py-0.5 font-bold text-[#8A5B28]">
          {bn ? "সংশোধন শনাক্ত" : "correction detected"}
        </span>
      )}
    </p>
  );
}

// --- chat component ---------------------------------------------------------

export function AgentChat({ compact = false, directory = "live" }: { compact?: boolean; directory?: "live" | "demo" }) {
  const bn = useLang() === "bn";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [model, setModel] = useState<string>("auto");

  // ---- voice flow state (Challenge 1) ----
  const micSupported = voiceCaptureSupported();
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState<"browser-live" | "server-asr" | "none">("none");
  const [voiceNote, setVoiceNote] = useState("");
  const captureRef = useRef<VoiceCapture | null>(null);

  // Restore the user's last model selection.
  useEffect(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && (saved === "auto" || CHAT_MODEL_CATALOG.some((m) => m.id === saved))) {
      setModel(saved);
    }
    return () => {
      captureRef.current?.dispose();
    };
  }, []);

  const pickModel = (id: string) => {
    setModel(id);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      /* private mode — selection still applies for this session */
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, voicePhase, transcript]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{
        reply: string;
        engine: string;
        note: { bn: string; en: string } | null;
        servedModel?: string | null;
        incident?: IncidentInfo | null;
        contacts?: ContactsPayload | null;
      }>("/api/v1/agent/chat", {
        messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        model: model === "auto" ? undefined : model,
        directory,
      });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.reply,
          engine: res.engine,
          servedModel: res.servedModel,
          incident: res.incident ?? null,
          contacts: res.contacts ?? null,
        },
      ]);
      if (res.engine === "rule-based-fallback") {
        toast.info(bn ? "লাইভ এআই এখন অফলাইন — নিয়মভিত্তিক উত্তর দেওয়া হলো (লেবেলকৃত)" : "Live AI offline — labeled rule-based reply given");
      }
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
      else toast.error(bn ? "নেটওয়ার্ক সমস্যা" : "Network problem");
    } finally {
      setBusy(false);
    }
  };

  // ---- voice handlers (Challenge 1) ----

  const beginRecording = async () => {
    const cap = new VoiceCapture();
    captureRef.current = cap;
    const started = await cap.start();
    if (!started.ok) {
      captureRef.current = null;
      if (started.error === "permission-denied") {
        setVoicePhase("idle");
        toast.error(
          bn
            ? "মাইক্রোফোন ব্যবহারের অনুমতি পাওয়া যায়নি — নিচের লেখার অপশন ব্যবহার করুন"
            : "Microphone permission denied — use the text option below"
        );
        return;
      }
      toast.error(bn ? "এই ব্রাউজারে ভয়েস রেকর্ডিং সমর্থিত নয় — লিখে পাঠান" : "Voice recording unsupported in this browser — please type");
      setVoicePhase("idle");
      return;
    }
    setVoicePhase("recording");
    setVoiceNote("");
    setTranscript("");
    setTranscriptSource("none");
  };

  const onMicClick = () => {
    if (voicePhase !== "idle" || busy) return;
    if (!micSupported) {
      toast.error(bn ? "এই ব্রাউজারে মাইক নেই — লিখে পাঠান" : "No microphone support here — please type");
      return;
    }
    // Explicit consent gate: the FIRST use each session asks; audio is only
    // captured after the user agrees.
    if (!voiceConsent) {
      setVoicePhase("awaiting-consent");
      return;
    }
    void beginRecording();
  };

  const grantConsent = () => {
    setVoiceConsent(true);
    void beginRecording();
  };

  const denyConsent = () => {
    setVoicePhase("idle");
    setVoiceNote(bn ? "সম্মতি দেওয়া হয়নি — লিখে পাঠান।" : "Consent not given — please type instead.");
  };

  const stopRecording = async () => {
    if (voicePhase !== "recording") return;
    const cap = captureRef.current;
    setVoicePhase("processing");
    const live = cap?.liveTranscript ?? "";
    const blob = cap?.stop() ?? null;
    captureRef.current = null;
    if (transcriptUsable(live)) {
      // Browser bn-BD live recognition produced usable text.
      setTranscript(live);
      setTranscriptSource("browser-live");
      setVoicePhase("review");
      return;
    }
    if (!blob) {
      setVoicePhase("review");
      setTranscript("");
      setTranscriptSource("none");
      setVoiceNote(bn ? "রেকর্ডিং খুব ছোট বা অস্পষ্ট — আবার বলুন বা লিখে পাঠান।" : "Recording too short or unclear — speak again or type.");
      return;
    }
    // Server ASR (existing transcribeAudio engine, consent enforced server-side too).
    try {
      const b64 = await blobToBase64(blob);
      const res = await api.post<{ transcript: string; engine: string }>("/api/v1/agent/voice", {
        audioBase64: b64,
        mime: blob.type || "audio/webm",
        consent: true,
      });
      const t = (res.transcript ?? "").trim();
      if (transcriptUsable(t)) {
        setTranscript(t);
        setTranscriptSource("server-asr");
        setVoiceNote("");
      } else {
        setTranscript("");
        setTranscriptSource("none");
        setVoiceNote(bn ? "স্পষ্ট শুনতে পাইনি — নিচে ঠিক করে লিখুন বা আবার বলুন।" : "Could not hear clearly — correct the text below or speak again.");
      }
      setVoicePhase("review");
    } catch (err) {
      setVoicePhase("review");
      setTranscript("");
      setTranscriptSource("none");
      setVoiceNote(
        err instanceof ShieldApiError
          ? err.apiError.message
          : bn
            ? "লেখায় তোলা ব্যর্থ — নিচে লিখে পাঠান বা আবার চেষ্টা করুন।"
            : "Transcription failed — type below or try again."
      );
    }
  };

  const sendFromReview = async () => {
    const text = transcript.trim();
    if (text.length < 2) return;
    setVoicePhase("sending");
    await send(text);
    setVoicePhase(nextVoicePhase("sending", "sent"));
    setTranscript("");
    setTranscriptSource("none");
    setVoiceNote("");
  };

  const cancelVoice = () => {
    captureRef.current?.dispose();
    captureRef.current = null;
    setVoicePhase("idle");
    setTranscript("");
    setTranscriptSource("none");
    setVoiceNote("");
  };

  // Latest directory version (Challenge 2): the most recent assistant reply
  // that carried contacts defines "current"; older cards render as outdated.
  const latestVersion = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.contacts) return m.contacts.directoryVersion;
    }
    return null;
  })();

  const phaseLabel: Record<VoicePhase, string> = {
    idle: "",
    "awaiting-consent": "",
    recording: bn ? "শুনছি… বলুন (শেষ করতে আবার চাপুন)" : "Listening… speak (press again to stop)",
    processing: bn ? "লেখায় তুলছি…" : "Transcribing…",
    review: bn ? "লেখ্যুক্তি দেখুন — ঠিক করতে পারেন" : "Review the transcript — you can correct it",
    sending: bn ? "পাঠানো হচ্ছে…" : "Sending…",
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className={cn("p-4 md:p-5", compact && "p-4")}>
          {/* chat header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2F5746]">
                <Bot className="h-5 w-5 text-[#DDE8DF]" aria-hidden />
              </span>
              {bn ? "শিল্ডএজেন্ট — এআই সহকারী" : "ShieldAgent — AI assistant"}
            </p>
            <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] text-[11px] bn-text">
              {bn ? "সচেতনতা-সহায়তা · ব্যাংক/পুলিশ নয়" : "Awareness support · not a bank/police"}
            </Badge>
          </div>

          {directory === "demo" && (
            <div className="mt-3 rounded-lg border border-[#A44435]/40 bg-[#F4E1DA]/40 px-3 py-2">
              <p className="text-[12px] font-bold text-[#A44435] bn-text">
                {bn ? "বিচ্ছিন্ন ডেমো পরিবেশ — সব যোগাযোগ কাল্পনিক TEST DATA" : "Isolated demo environment — all contacts are fictional TEST DATA"}
              </p>
            </div>
          )}

          {/* model selection — every reply labels the model that served it */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#59665F] bn-text">
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              {bn ? "এআই মডেল:" : "AI model:"}
            </span>
            <Select value={model} onValueChange={pickModel}>
              <SelectTrigger
                className="h-8 w-auto min-w-[190px] border-[#2F5746]/40 bg-[#FFFEFA] text-[13px] text-[#2F5746] focus:ring-[#2F5746]"
                aria-label={bn ? "চ্যাট মডেল নির্বাচন" : "Chat model selection"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                <SelectItem value="auto" className="text-[13px]">
                  {bn ? "স্বয়ংক্রিয় (প্রস্তাবিত)" : "Auto (recommended)"}
                </SelectItem>
                {CHAT_MODEL_CATALOG.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-[13px]">
                    <span className="flex flex-col items-start py-0.5">
                      <span className="font-semibold bn-text">{bn ? m.labelBn : m.label}</span>
                      <span className="text-[11px] text-[#8A9B90]">{m.note}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {model !== "auto" && (
              <Badge variant="outline" className="border-[#8A5B28]/40 text-[#8A5B28] text-[10px]">
                {bn ? "আপনি বেছে নিয়েছেন" : "your pick"}
              </Badge>
            )}
          </div>

          <p className="mt-2 text-sm text-[#59665F] bn-text">
            {bn
              ? "প্রতারণা নিয়ে যেকোনো প্রশ্ন করুন — বাংলা বা ইংরেজি। সতর্কতা: এআই ভুল করতে পারে; গুরুত্বপূর্ণ সিদ্ধান্ত নিজে যাচাই করে নিন।"
              : "Ask anything about scams — Bangla or English. Caution: AI can be wrong; verify important decisions yourself."}
          </p>

          {/* messages */}
          <div
            ref={scrollRef}
            className={cn("mt-4 space-y-3 overflow-y-auto pr-1", compact ? "max-h-80" : "max-h-96")}
            aria-live="polite"
            aria-label={bn ? "কথোপকথন" : "Conversation"}
          >
            {messages.length === 0 && !busy && (
              <div className="rounded-xl border border-dashed border-[#D8DED5] bg-[#F4F1EB] p-4 space-y-2.5">
                <p className="text-xs font-bold text-[#59665F] bn-text">{bn ? "দিয়ে শুরু করতে পারেন:" : "Try starting with:"}</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(bn ? q.bn : q.en)}
                      className="rounded-full border border-[#2F5746]/30 bg-[#FFFEFA] px-3 py-2 text-left text-[13px] font-medium text-[#2F5746] hover:bg-[#DDE8DF] transition-colors focus-ring bn-text"
                    >
                      {bn ? q.bn : q.en}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-start gap-2.5", m.role === "user" && "justify-end")}>
                {m.role === "assistant" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F5746]">
                    <Bot className="h-4 w-4 text-[#DDE8DF]" aria-hidden />
                  </span>
                )}
                <div className={cn("max-w-[85%]", m.role === "user" && "flex flex-col items-end")}>
                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bn-text",
                      m.role === "user"
                        ? "bg-[#2F5746] text-[#FFFEFA]"
                        : "bg-[#F4F1EB] border border-[#D8DED5] text-[#202C26]"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "assistant" && m.engine && (
                    <p className="mt-1 text-[10px] text-[#8A9B90] bn-text">
                      {m.engine === "live-ai"
                        ? `${bn ? "লাইভ এআই উত্তর" : "Live AI reply"}${m.servedModel ? ` · ${m.servedModel}` : ""}`
                        : m.engine === "incident-rules"
                          ? bn ? "নিয়মভিত্তিক ঘটনা-প্রবাহ (নির্ধারিত — এআই নয়)" : "Deterministic incident flow (rule-based, not AI)"
                          : bn ? "নিয়মভিত্তিক ফলব্যাক (লাইভ এআই নয়)" : "Rule-based fallback (not live AI)"}
                    </p>
                  )}
                  {m.role === "assistant" && m.incident && <IncidentBadge info={m.incident} bn={bn} />}
                  {m.role === "assistant" && m.contacts && (
                    <ContactCards payload={m.contacts} stale={latestVersion !== null && m.contacts.directoryVersion !== latestVersion} bn={bn} />
                  )}
                </div>
                {m.role === "user" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8A9B90]">
                    <User className="h-4 w-4 text-[#FFFEFA]" aria-hidden />
                  </span>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F5746]">
                  <Bot className="h-4 w-4 text-[#DDE8DF]" aria-hidden />
                </span>
                <div className="rounded-xl bg-[#F4F1EB] border border-[#D8DED5] px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2F5746]" aria-hidden />
                  <span className="text-sm text-[#59665F] bn-text">{bn ? "ভাবছি…" : "Thinking…"}</span>
                </div>
              </div>
            )}
          </div>

          {/* ---- voice: consent gate (audio is only captured after explicit consent) ---- */}
          {voicePhase === "awaiting-consent" && (
            <div className="mt-4 rounded-xl border border-[#8A5B28]/40 bg-[#F2E8D5]/50 p-4" role="dialog" aria-label={bn ? "মাইক্রোফোন সম্মতি" : "Microphone consent"}>
              <p className="text-sm font-bold text-[#8A5B28] bn-text">{bn ? "মাইক্রোফোন ব্যবহারের অনুমতি দেবেন?" : "Allow microphone use?"}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#59665F] bn-text">
                {bn
                  ? "আপনার কণ্ঠ শুধু লেখায় তুলে রিপোর্ট বোঝার জন্য প্রসেস করা হবে (সার্ভারের ASR / ব্রাউজারের বাংলা স্বীকৃতি)। অডিও সংরক্ষণ করা হয় না; একবার ব্রাউজার বন্ধ হলেই মুছে যায়। OTP বলতে হবে না।"
                  : "Your voice is processed only to transcribe the report (server ASR / browser Bangla recognition). Audio is never stored and disappears when the browser closes. You never need to say the OTP."}
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={grantConsent} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] h-9 text-[13px]">
                  {bn ? "সম্মত আছি — মাইক চালু করুন" : "I agree — start the mic"}
                </Button>
                <Button onClick={denyConsent} variant="outline" className="h-9 text-[13px] border-[#C9C2B2]">
                  {bn ? "না — লিখে পাঠাবো" : "No — I will type"}
                </Button>
              </div>
            </div>
          )}

          {/* ---- voice: listening / processing indicator ---- */}
          {(voicePhase === "recording" || voicePhase === "processing") && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#A44435]/40 bg-[#F4E1DA]/40 px-4 py-3" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-[#A44435]" aria-hidden />
              <span className="text-sm font-bold text-[#A44435] bn-text">{phaseLabel[voicePhase]}</span>
              {voicePhase === "recording" && (
                <Button
                  onClick={() => void stopRecording()}
                  size="icon"
                  className="ml-auto h-9 w-9 rounded-full bg-[#A44435] text-[#FFFEFA] hover:bg-[#8F382B]"
                  aria-label={bn ? "রেকর্ডিং শেষ করুন" : "Stop recording"}
                >
                  <Square className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          )}

          {/* ---- voice: transcript review & correction ---- */}
          {voicePhase === "review" && (
            <div className="mt-4 rounded-xl border border-[#D8DED5] bg-[#F4F1EB] p-4 space-y-2.5">
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#59665F] bn-text">
                {bn ? "লেখ্যুক্তি দেখুন — ভুল থাকলে ঠিক করে সম্পাদন করুন" : "Review the transcript — correct any mistakes before sending"}
                <Badge variant="outline" className="text-[9px] border-[#2F5746]/40 text-[#2F5746]">
                  {transcriptSource === "browser-live"
                    ? bn ? "ব্রাউজার বাংলা স্বীকৃতি" : "browser Bangla recognition"
                    : transcriptSource === "server-asr"
                      ? bn ? "সার্ভার ASR" : "server ASR"
                      : bn ? "শুনতে পাইনি" : "not heard"}
                </Badge>
              </p>
              {voiceNote && <p className="text-[12px] text-[#A44435] bn-text">{voiceNote}</p>}
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={bn ? "যা বলেছিলেন তা এখানে… বা নিজে লিখুন" : "What you said… or write it yourself"}
                className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
                aria-label={bn ? "লেখ্যুক্তি সম্পাদনা" : "Transcript editing"}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void sendFromReview()}
                  disabled={transcript.trim().length < 2}
                  className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] h-9 text-[13px]"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {bn ? "পাঠান" : "Send"}
                </Button>
                <Button
                  onClick={() => { cancelVoice(); void beginRecording(); }}
                  variant="outline"
                  className="h-9 text-[13px] border-[#C9C2B2]"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {bn ? "আবার বলুন" : "Speak again"}
                </Button>
                <Button onClick={cancelVoice} variant="outline" className="h-9 text-[13px] border-[#C9C2B2]">
                  <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {bn ? "বাতিল" : "Cancel"}
                </Button>
              </div>
            </div>
          )}

          {/* input + mic */}
          <div className="mt-4 flex gap-2 items-stretch">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={
                voicePhase === "sending"
                  ? bn ? "পাঠানো হচ্ছে…" : "Sending…"
                  : bn ? "আপনার প্রশ্ন লিখুন… (Enter চাপলে পাঠাবে)" : "Type your question… (Enter to send)"
              }
              className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
              aria-label={bn ? "শিল্ডএজেন্টকে বার্তা" : "Message to ShieldAgent"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              onClick={onMicClick}
              disabled={busy || voicePhase !== "idle" || !micSupported}
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0",
                voicePhase === "recording"
                  ? "bg-[#A44435] text-[#FFFEFA]"
                  : "bg-[#DDE8DF] text-[#2F5746] hover:bg-[#CBDCD0]"
              )}
              aria-label={bn ? "ভয়েসে বলুন (মাইক্রোফোন সম্মতি লাগবে)" : "Report by voice (mic consent required)"}
              title={micSupported ? undefined : bn ? "এই ব্রাউজারে মাইক নেই — লিখে পাঠান" : "No mic support here — please type"}
            >
              {voicePhase === "recording" ? (
                <Square className="h-4 w-4" aria-hidden />
              ) : voicePhase === "processing" || voicePhase === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mic className="h-5 w-5" aria-hidden />
              )}
            </Button>
            <Button
              onClick={() => send(input)}
              disabled={busy || input.trim().length < 2}
              size="icon"
              className="h-11 w-11 shrink-0 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]"
              aria-label={bn ? "পাঠান" : "Send"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          {!micSupported && (
            <p className="mt-1.5 text-[11px] text-[#8A9B90] bn-text">
              {bn ? "মাইক্রোফোন/ট্রান্সক্রিপশন সেবা এই ব্রাউজারে নেই — লিখে পাঠান।" : "Microphone/transcription is unavailable in this browser — please type."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* how the agent works (task: clearly defined role & workflow) */}
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-4 md:p-5">
          <button
            onClick={() => setHowOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left focus-ring rounded"
            aria-expanded={howOpen}
          >
            <span className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
              <ShieldQuestion className="h-5 w-5 text-[#2F5746]" aria-hidden />
              {bn ? "শিল্ডএজেন্ট কীভাবে কাজ করে" : "How ShieldAgent works"}
            </span>
            {howOpen ? <ChevronDown className="h-5 w-5 text-[#59665F]" aria-hidden /> : <ChevronRight className="h-5 w-5 text-[#59665F]" aria-hidden />}
          </button>
          {howOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "এজেন্টের ভূমিকা" : "The agent's role"}</p>
                <ul className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "ব্যাখ্যা করা — পাওয়া বার্তা/কল কেন সন্দেহজনক হতে পারে",
                        "পরামর্শ দেওয়া — এখন কী করতে হবে (নিরাপদ ডিফল্ট: থামুন → যাচাই করুন)",
                        "শেখানো — কমন কৌশলগুলো চেনা ও এড়ানো",
                      ]
                    : [
                        "Explain — why a message/call may be suspicious",
                        "Advise — what to do now (safe default: pause → verify)",
                        "Teach — recognize and avoid common tactics",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#2F5746] font-bold" aria-hidden>•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "কাজের ধারা (৫ ধাপ)" : "Workflow (5 steps)"}</p>
                <ol className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "আপনার প্রশ্ন ও শেয়ার করা লেখা অবিশ্বস্ত তথ্য হিসেবে গৃহীত হয় — নির্দেশনা হিসেবে নয়",
                        "নিয়ম-ইঞ্জিন আগে নির্ভরযোগ্য সংকেতগুলো বের করে (ওটিপি চাওয়া, ভয় দেখানো, ছদ্মবেশ…)",
                        "এআই মডেল সেই সংকেতের ভিত্তিতে সহজ ভাষায় ব্যাখ্যা তৈরি করে",
                        "নিরাপত্তা-নিয়ম যাচাই করা হয়: কোনো বানানো নম্বর/ঠিকানা নয়, কোনো কোড চাওয়া নয়, নিশ্চয়তা নয়",
                        "উত্তরে লেবেল থাকে — লাইভ এআই নাকি ফলব্যাক, সবসময় স্পষ্ট লেখা থাকে",
                      ]
                    : [
                        "Your question and any shared text are treated as untrusted data — never as instructions",
                        "The rule engine first extracts reliable signals (OTP requests, fear tactics, impersonation…)",
                        "The AI model builds a plain-language explanation grounded in those signals",
                        "Safety rules are enforced: no invented contacts, no code requests, no guarantees",
                        "Every reply is labeled — live AI or fallback, always visibly stated",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F5746] text-[10px] font-bold text-[#FFFEFA]" aria-hidden>
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? "এজেন্ট যা করে না" : "What the agent never does"}</p>
                <ul className="mt-1.5 space-y-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {(bn
                    ? [
                        "কখনোই ওটিপি/পিন/পাসওয়ার্ড চায় না বা গ্রহণ করে না",
                        "বার্তায় আসা নম্বর বা লিংক ‘আসল’ বলে সাজায় না",
                        "“১০০% নিরাপদ” বলে না — নিজে যাচাই করতে বলে",
                        "টাকা, ফি বা রেফান্ড নিয়ে কোনো লেনদেন করে না",
                      ]
                    : [
                        "Never asks for or accepts OTPs, PINs or passwords",
                        "Never presents numbers or links from your message as official",
                        "Never says \"100% safe\" — always advises independent verification",
                        "Never handles money, fees or refunds",
                      ]
                  ).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#A44435] font-bold" aria-hidden>✕</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-[#8A9B90] bn-text">
                {bn
                  ? "কথোপকথন সার্ভারে সংরক্ষণ করা হয় না — ব্রাউজার বন্ধ করলেই মুছে যায়।"
                  : "Conversations are not stored on the server — they disappear when you close the browser."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
