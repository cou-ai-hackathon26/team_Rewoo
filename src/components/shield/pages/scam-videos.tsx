"use client";

// Animated educational videos — each "video" is a story of animated phone
// scenes with Bengali voice narration (TTS), captions, playback controls
// (play/pause, speed, prev/next), transcript, and a clearly-labeled
// takeaway. Scenes auto-advance as narration ends; if the audio service is
// unavailable the player falls back to timed captions (labeled, never faked).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  PhoneCall,
  PhoneOff,
  MessageSquareText,
  Bell,
  Volume2,
  VolumeX,
  ListOrdered,
  Clock,
  Bot,
  ShieldCheck,
  AlertTriangle,
  BadgeCheck,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "../api";
import { useLang } from "../i18n";
import { Link } from "../router";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Story data — all cases FICTIONAL, labeled as such everywhere.
// ---------------------------------------------------------------------------

type LineFrom = "scammer" | "victim" | "system" | "family";

interface SceneLine {
  from: LineFrom;
  text: string; // bn (phone UI is bn — matches the audience)
  en?: string; // optional EN gloss shown in EN mode
  delay: number; // seconds after scene start
}

interface VideoScene {
  kind: "call" | "chat" | "sms" | "browser" | "verdict";
  caption: { bn: string; en: string };
  narration: { bn: string; en: string };
  lines: SceneLine[];
  meta?: { title: string; sub?: string }; // call-screen / sms / browser chrome
}

export interface ScamVideo {
  id: string;
  title: { bn: string; en: string };
  summary: { bn: string; en: string };
  minutes: number;
  accent: string; // hex
  lessonId?: string; // related quiz lesson
  scenes: VideoScene[];
}

export const SCAM_VIDEOS: ScamVideo[] = [
  {
    id: "otp-call",
    title: { bn: "ওটিপি চাওয়া ফোনকল", en: "The OTP phone call" },
    summary: {
      bn: "“বিকাশ টিম” সেজে আসা কল কীভাবে কোড চায় — এবং থেমে গিয়ে কীভাবে ক্ষতি এড়ানো যায়।",
      en: "How a call impersonating “bKash team” asks for your code — and how pausing prevents the loss.",
    },
    minutes: 3,
    accent: "#A44435",
    lessonId: "otp",
    scenes: [
      {
        kind: "call",
        caption: {
          bn: "সকালবেলা একটি অচেনা নম্বর থেকে কল — নিজেকে “বিকাশ টিম” বলে পরিচয় দিচ্ছে।",
          en: "A morning call from an unknown number — claiming to be the “bKash team”.",
        },
        narration: {
          bn: "সকাল সকাল অচেনা এক নম্বর থেকে ফোন এলো। কলার নিজেকে বিকাশ টিম বলে পরিচয় দিলো। মনে রাখুন — এটি একটি দাবি মাত্র, যাচাই হয়নি।",
          en: "A call comes from an unknown number. The caller claims to be the bKash team. Remember — this is only a claim, not verified.",
        },
        meta: { title: "“বিকাশ টিম”", sub: "01712-345678 · অচেনা নম্বর" },
        lines: [],
      },
      {
        kind: "chat",
        caption: {
          bn: "কলার বলছে: একাউন্ট সাসপেন্ড হবে — তাই এখনই ওটিপি দিতে হবে।",
          en: "The caller says the account will be suspended — so the OTP must be shared now.",
        },
        narration: {
          bn: "কলার ভয় দেখালো — একাউন্ট সাসপেন্ড হয়ে যাবে। তারপর চাইলো এখনই ওটিপি টা দিতে। লক্ষণ দুটো পাশাপাশি: ভয়, আর তাড়াহুড়ো।",
          en: "The caller uses fear — your account will be suspended — then asks for the OTP right now. Two signals side by side: fear and urgency.",
        },
        lines: [
          { from: "scammer", text: "আমি বিকাশ টিম থেকে বলছি, আপনার একাউন্টে সন্দেহজনক লেনদেন হয়েছে।", en: "This is the bKash team — suspicious activity on your account.", delay: 0.4 },
          { from: "scammer", text: "একাউন্ট সাসপেন্ড এড়াতে এখনই আপনার OTP টা দিয়ে দিন।", en: "To avoid suspension, share your OTP right now.", delay: 3.2 },
          { from: "scammer", text: "দেরি করলে নম্বর বন্ধ হয়ে যাবে!", en: "Delay and the number will be blocked!", delay: 6.2 },
        ],
      },
      {
        kind: "sms",
        caption: {
          bn: "একই সময়ে আসল এসএমএস: কোড কখনোই কাউকে দিতে বলা নেই — বরং উল্টো সতর্কতা করা আছে।",
          en: "Meanwhile the real SMS: the code is never to be shared — it even warns you.",
        },
        narration: {
          bn: "একই সময়ে আসল এসএমএস এলো। লক্ষ করুন — কোডটা কাউকে দিতে বলা নেই, বরং লেখা আছে কাউকে দেবেন না। আসল প্রতিষ্ঠান কখনোই কোড চায় না।",
          en: "The real SMS arrives at the same time. Notice — it never asks you to share the code; it says never share it. Real institutions never ask for codes.",
        },
        meta: { title: "bKash", sub: "এই মুহূর্তে" },
        lines: [
          { from: "system", text: "আপনার ওটিপি: ৪৮•••। এই কোড কাউকে দেবেন না — বিকাশ কর্মীরাও চাইবে না।", en: "Your OTP: 48•••. Never share this code — not even with bKash staff.", delay: 0.5 },
        ],
      },
      {
        kind: "chat",
        caption: {
          bn: "নিরাপদ পথ: কল থামিয়ে নিজের অ্যাপ খুলে দেখা — সব ঠিক থাকে, ক্ষতি হয় না।",
          en: "The safe path: hang up, check your own app — everything is fine, no harm done.",
        },
        narration: {
          bn: "নিরাপদ পথটা সহজ — কল থামান। নিজের অ্যাপ খুলে দেখুন। এখানে দেখুন, সব ঠিক আছে। টাকা কোথাও যায়নি। থেমে যাচাই করাই পার্থক্য গড়ে দেয়।",
          en: "The safe path is simple — hang up. Open your own app. Look: everything is fine. No money left the account. Pausing to verify makes all the difference.",
        },
        lines: [
          { from: "victim", text: "এক মিনিট, আমি নিজে অ্যাপে ঢুকে দেখে নিই।", en: "One moment — let me check the app myself.", delay: 0.4 },
          { from: "scammer", text: "স্যার, সময় নেই! এখনই কোডটা…", en: "Sir, no time! The code, now…", delay: 2.6 },
          { from: "system", text: "কল বন্ধ করা হলো ✓  অ্যাপে দেখা গেলো: সব ঠিক আছে ✓", en: "Call ended ✓  App shows: all fine ✓", delay: 4.8 },
        ],
      },
      {
        kind: "verdict",
        caption: {
          bn: "মনে রাখুন: প্রতিষ্ঠান কখনোই ফোনে ওটিপি চায় না। ভয় + তাড়া = থামুন, নিজে যাচাই করুন।",
          en: "Remember: institutions never ask for OTPs on a call. Fear + urgency = stop, verify yourself.",
        },
        narration: {
          bn: "মনে রাখার একটাই কথা — বিকাশ, নগদ, ব্যাংক কেউই ফোনে ওটিপি চায় না। ভয় আর তাড়াহুড়ো দেখলেই থেমে যান, নিজে যাচাই করুন। আপনার এক মিনিট, টাকা বাঁচায়।",
          en: "One thing to remember — bKash, Nagad, no bank ever asks for your OTP on a call. Fear and urgency mean stop and verify. Your one minute saves the money.",
        },
        lines: [],
      },
    ],
  },
  {
    id: "son-voice",
    title: { bn: "ছেলের কণ্ঠে এক ফোন", en: "A call in her son's voice" },
    summary: {
      bn: "এআই দিয়ে নকল করা কণ্ঠে পরিবারের কাছ থেকে টাকা চাওয়া — রাহেলা কীভাবে বাঁচিয়েছেন।",
      en: "Money requested in an AI-cloned family voice — and how Rahela stayed safe.",
    },
    minutes: 3,
    accent: "#8A5B28",
    lessonId: "voice",
    scenes: [
      {
        kind: "call",
        caption: {
          bn: "রাত দুটোয় অচেনা নম্বর — কণ্ঠ শুনতে ঠিক ছেলের মতো। কিন্তু কণ্ঠ পরিচয়ের প্রমাণ নয়।",
          en: "2 AM, unknown number — the voice sounds exactly like her son. But a voice is not proof of identity.",
        },
        narration: {
          bn: "রাত দুটোয় রাহেলার ফোন বাজলো। ওপাশের কণ্ঠ শুনতে হুবহু ছেলের মতো। কিন্তু মনে রাখুন — আজকাল অল্প নমুনা কণ্ঠ থেকেই এআই দিয়ে নকল কণ্ঠ বানানো যায়। কণ্ঠ শোনা যাচাই নয়।",
          en: "At 2 AM Rahela's phone rings. The voice sounds exactly like her son. But today, a short voice sample is enough for AI to clone a voice. Hearing a voice is not verification.",
        },
        meta: { title: "অচেনা নম্বর", sub: "রাত ২টা ০৭ মিনিট" },
        lines: [],
      },
      {
        kind: "chat",
        caption: {
          bn: "“মা, আমি বিপদে — এখনই ৫০ হাজার পাঠাও, কাউকে বলো না।”",
          en: "“Mom, I'm in trouble — send 50,000 now. Don't tell anyone.”",
        },
        narration: {
          bn: "কলার বিপদের গল্প বললো, তারপর চাইলো এখনই পঞ্চাশ হাজার টাকা। আর বললো — কাউকে বলতে নেই। লক্ষণ পরিষ্কার: আবেগ, তাড়াহুড়ো, আর গোপনীয়তার চাপ।",
          en: "The caller tells a distress story, then asks for fifty thousand taka immediately — and says tell no one. The signals are clear: emotion, urgency, and secrecy pressure.",
        },
        lines: [
          { from: "scammer", text: "মা, আমি বিপদে পড়েছি… এখনই ৫০,০০০ টাকা পাঠাতে হবে।", en: "Mom, I'm in trouble… I need 50,000 taka right now.", delay: 0.4 },
          { from: "scammer", text: "অনেক বড় বিপদ — কাউকে কিছু বলো না, প্লিজ।", en: "It's a big problem — please don't tell anyone.", delay: 3.4 },
        ],
      },
      {
        kind: "chat",
        caption: {
          bn: "রাহেলা থামলেন — ছেলের পুরনো, পরিচিত নম্বরে নিজে কল করলেন।",
          en: "Rahela paused — and called her son's old, known number herself.",
        },
        narration: {
          bn: "রাহেলা একটা নিয়ম জানতেন — টাকার আগে এক মুহূর্ত থামা। তিনি ছেলের পুরনো, পরিচিত নম্বরে নিজে কল করলেন। নতুন নম্বরে নয় — যেটা আগে থেকেই জানা।",
          en: "Rahela knew a rule — pause before money. She called her son's old known number herself. Not the new number — the one she already had.",
        },
        lines: [
          { from: "victim", text: "আমি একটু থাকছি — ছেলের পুরনো নম্বরে নিজে কল করে দেখছি।", en: "Hold on — I'll call my son's old number myself.", delay: 0.4 },
        ],
      },
      {
        kind: "call",
        caption: {
          bn: "আসল ছেলে পুরনো নম্বরেই ফোন ধরলো — “মা, আমি তো ঠিক আছি!” টাকা বেঁচে গেলো।",
          en: "The real son answers on the old number — “Mom, I'm fine!” The money is safe.",
        },
        narration: {
          bn: "আসল ছেলে পুরনো নম্বরেই ফোন ধরলো। সে তো ঠিকই আছে। টাকা পাঠানো হয়নি, ক্ষতি হয়নি। শিক্ষা — কণ্ঠ নয়, পরিচিত নম্বরে নিজে যাচাই করাই আসল পরিচয়।",
          en: "The real son answers on his old number. He is fine. No money was sent, no harm done. The lesson — verification through a known number, not a voice, is real identity.",
        },
        meta: { title: "আসল ছেলে", sub: "পুরনো পরিচিত নম্বর ✓" },
        lines: [],
      },
      {
        kind: "verdict",
        caption: {
          bn: "টাকা চাওয়া কলে: আবেগ + তাড়া + গোপনীয়তা = আগে পরিচিত নম্বরে নিজে যাচাই করুন।",
          en: "On money-request calls: emotion + urgency + secrecy = verify first through a known number.",
        },
        narration: {
          bn: "পরিবারের নামে টাকা চাওয়া হলে — যতই আসল কণ্ঠের মতো শোনাক — আগে পরিচিত নম্বরে নিজে কল করুন। এবং পরিবারের সবার সাথে আগেই একটা গোপন প্রশ্ন ঠিক করে রাখুন।",
          en: "When money is requested in a family member's name — however real the voice sounds — first call the known number yourself. And agree on a family safety question beforehand.",
        },
        lines: [],
      },
    ],
  },
  {
    id: "cashback-link",
    title: { bn: "ক্যাশব্যাকের লোভী লিংক", en: "The tempting cashback link" },
    summary: {
      bn: "নগদের নামে নকল লিংক কীভাবে পিন চায় — আসল অ্যাপ আর নকল পাতার পার্থক্য।",
      en: "How a fake Nagad link asks for your PIN — and the real-app difference.",
    },
    minutes: 2,
    accent: "#2F5746",
    lessonId: "link",
    scenes: [
      {
        kind: "sms",
        caption: {
          bn: "এসএমএসে “ক্যাশব্যাক অপেক্ষা করছে” — সাথে একটা লিংক। ব্র্যান্ডের নাম + ফ্রি টাকা + লিংক = পুরনো ফাঁদ।",
          en: "An SMS: “your cashback is waiting” — with a link. Brand name + free money + link = the classic trap.",
        },
        narration: {
          bn: "এসএমএসে এলো — আপনার নগদ ক্যাশব্যাক অপেক্ষা করছে, এখনই ক্লেইম করুন, সাথে একটা লিংক। তিনটা লক্ষণ একসাথে — ব্র্যান্ডের নাম, ফ্রি টাকার লোভ, আর লিংক।",
          en: "An SMS arrives — your Nagad cashback is waiting, claim now, with a link. Three signals together — a brand's name, free-money bait, and a link.",
        },
        meta: { title: "নগদ (নাম লেখা)", sub: "এই মুহূর্তে" },
        lines: [
          { from: "system", text: "অভিনন্দন! আপনার নগদ ক্যাশব্যাক ৩৫০ টাকা অপেক্ষা করছে। এখনই ক্লেইম করুন: nagad-cashback-rewards[.]xyz/claim", en: "Congratulations! Your Nagad cashback of 350 taka is waiting. Claim now: nagad-cashback-rewards[.]xyz/claim", delay: 0.5 },
        ],
      },
      {
        kind: "browser",
        caption: {
          bn: "লিংকের পাতাটা দেখতে আসলের মতো — কিন্তু ঠিকানায় আসল নগদ নেই, আর ওয়েবপাতায় পিন চাওয়া হচ্ছে।",
          en: "The page looks official — but the address is not real Nagad, and a web page is asking for your PIN.",
        },
        narration: {
          bn: "পাতাটা দেখতে হুবহু আসলের মতো। কিন্তু দুটো পার্থক্য ধরুন — ঠিকানায় আসল নগদ ডট কম নেই, আর ওয়েবপাতায় কখনোই পিন বা পাসওয়ার্ড চাওয়া হয় না। পিন শুধু অ্যাপে লাগে।",
          en: "The page looks exactly like the real one. But notice two differences — the address is not the real nagad dot com, and a web page never asks for your PIN. PINs belong inside the app only.",
        },
        meta: { title: "nagad-cashback-rewards.xyz", sub: "🔒 সংযোগ নয় · নকল পাতা" },
        lines: [
          { from: "system", text: "ক্যাশব্যাক পেতে আপনার অ্যাকাউন্ট ভেরিফাই করুন — পিন দিন।", en: "To receive cashback, verify your account — enter your PIN.", delay: 0.6 },
        ],
      },
      {
        kind: "verdict",
        caption: {
          bn: "লিংকে ক্লিক নয় — নিজে অ্যাপ খুলুন। আসল অ্যাপে ক্যাশব্যাক না থাকলে বার্তাটি ভুয়া।",
          en: "Don't click — open the app yourself. If the real app shows no cashback, the message was fake.",
        },
        narration: {
          bn: "নিয়মটা সহজ — বার্তার লিংকে কখনোই ক্লিক করবেন না। নিজে অ্যাপ খুলে দেখুন। আসল অ্যাপে ক্যাশব্যাক না থাকলে বুঝবেন বার্তাটা ভুয়া ছিল। সন্দেহজনক লিংক বাংলাশিল্ডে যাচাই করতে পারেন।",
          en: "The rule is simple — never click links from messages. Open the app yourself. If the real app shows no cashback, the message was fake. You can also check suspicious links with BanglaShield.",
        },
        lines: [],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Video player
// ---------------------------------------------------------------------------

/** Estimated scene duration when audio is unavailable (ms). */
function estimateDuration(narration: string): number {
  return Math.min(14000, Math.max(5000, narration.length * 95));
}

export function ScamVideoPlayer({ video, onExit }: { video: ScamVideo; onExit: () => void }) {
  const bn = useLang() === "bn";
  const prefersReduced = useReducedMotion() ?? false;
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [audioOn, setAudioOn] = useState(true);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within current scene
  const [showTranscript, setShowTranscript] = useState(false);
  const [ended, setEnded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  const scene = video.scenes[sceneIdx];
  const narration = bn ? scene.narration.bn : scene.narration.en;
  const totalScenes = video.scenes.length;

  const cleanupScene = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Stop the browser Bangla narration engine as well (scene switch/pause).
    void import("../speech").then(({ stopBanglaSpeech }) => stopBanglaSpeech());
  }, []);

  // Scene driver: loads narration audio (cached), plays it, advances on end;
  // falls back to a timed advance if the audio service is unavailable.
  const runScene = useCallback(
    async (idx: number, withAudio: boolean, rate: number) => {
      cleanupScene();
      setProgress(0);
      setEnded(false);
      const sc = video.scenes[idx];
      const text = bn ? sc.narration.bn : sc.narration.en;

      const advance = () => {
        if (idx + 1 < totalScenes) setSceneIdx(idx + 1);
        else {
          setPlaying(false);
          setEnded(true);
        }
      };

      if (!withAudio || audioFailed) {
        const dur = estimateDuration(text);
        fallbackRef.current = setTimeout(advance, dur / rate);
        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
          setProgress(Math.min(1, ((Date.now() - startedAt) * rate) / dur));
        }, 120);
        return;
      }

      // V8: narrate through the Bangla voice chain — the device's genuine
      // Bangla voice first (works on the public deployment), the server TTS
      // as fallback. Scene advance + progress are driven by the chain result.
      setAudioBusy(true);
      const { speakBangla, pickBanglaVoice } = await import("../speech");
      const hasBrowserVoice = pickBanglaVoice() !== null;
      if (hasBrowserVoice) {
        setAudioBusy(false);
        const dur = estimateDuration(text);
        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
          setProgress(Math.min(1, ((Date.now() - startedAt) * rate) / dur));
        }, 120);
        const served = await speakBangla(text, { speed: rate });
        if (served !== "failed") {
          advance();
          return;
        }
        // browser engine failed mid-flight → timed fallback below
        const dur2 = estimateDuration(text);
        fallbackRef.current = setTimeout(advance, dur2 / rate);
        return;
      }

      const cacheKey = `${video.id}:${idx}:${bn ? "bn" : "en"}`;
      let url = audioCache.current.get(cacheKey);
      if (!url) {
        try {
          const res = await api.postRaw("/api/v1/tts", { text: text.slice(0, 1000), speed: 1 });
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          audioCache.current.set(cacheKey, url);
        } catch {
          setAudioFailed(true);
          setAudioBusy(false);
          // timed fallback, clearly silent
          const dur = estimateDuration(text);
          fallbackRef.current = setTimeout(advance, dur / rate);
          const startedAt = Date.now();
          timerRef.current = setInterval(() => {
            setProgress(Math.min(1, ((Date.now() - startedAt) * rate) / dur));
          }, 120);
          return;
        }
        setAudioBusy(false);
      } else {
        setAudioBusy(false);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = rate;
      audio.onended = advance;
      audio.ontimeupdate = () => {
        if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      };
      try {
        await audio.play();
      } catch {
        // autoplay blocked → play silently on user gesture (pause state handles it)
        setPlaying(false);
      }
    },
    [audioFailed, bn, cleanupScene, totalScenes, video.id, video.scenes]
  );

  // play/pause + scene changes re-run the scene audio — this effect genuinely
  // synchronizes React state with an EXTERNAL system (the audio element), so
  // the setState calls inside runScene are intentional (app.tsx convention).
  useEffect(() => {
    if (playing) {
      runScene(sceneIdx, audioOn, speed);
    } else {
      cleanupScene();
    }
  }, [playing, sceneIdx]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => cleanupScene, [cleanupScene]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= totalScenes) return;
    setSceneIdx(idx);
    setPlaying(true);
  };

  const replay = () => {
    setSceneIdx(0);
    setPlaying(true);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-5">
      {/* video header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-[#202C26] bn-text">{bn ? video.title.bn : video.title.en}</h2>
            <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] text-[11px]">
              {bn ? "কাল্পনিক উদাহরণ" : "Fictional example"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#59665F] flex items-center gap-1.5 bn-text">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {bn ? `প্রায় ${video.minutes} মিনিট` : `~${video.minutes} min`} ·{" "}
            {bn ? `${totalScenes} দৃশ্য` : `${totalScenes} scenes`}
          </p>
        </div>
        <Button variant="ghost" onClick={onExit} className="text-[#2F5746] font-semibold h-11">
          {bn ? "← ভিডিও তালিকা" : "← All videos"}
        </Button>
      </div>

      {/* player */}
      <Card className="border-2 border-[#D8DED5] bg-[#202C26] overflow-hidden">
        <CardContent className="p-0">
          {/* progress segments */}
          <div className="flex gap-1 px-3 pt-3" aria-hidden>
            {video.scenes.map((s, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-[#3A4A42] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: i < sceneIdx ? "100%" : i === sceneIdx ? `${Math.round(progress * 100)}%` : "0%",
                    background: video.accent === "#202C26" ? "#DDE8DF" : "#DDE8DF",
                  }}
                />
              </div>
            ))}
          </div>

          {/* stage */}
          <div className="p-4 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={sceneIdx}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-5"
              >
                <PhoneStage scene={scene} accent={video.accent} playing={playing} prefersReduced={prefersReduced} />
                {/* caption */}
                <p
                  className={cn(
                    "text-center text-[15px] leading-relaxed rounded-xl px-4 py-3 w-full",
                    "bg-[#2A3630] text-[#EDEAE1] bn-text"
                  )}
                  aria-live="polite"
                >
                  {bn ? scene.caption.bn : scene.caption.en}
                </p>
              </motion.div>
            </AnimatePresence>

            {ended && (
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 rounded-xl border border-[#DDE8DF]/40 bg-[#2A3630] p-5 text-center space-y-3"
                role="status"
              >
                <ShieldCheck className="mx-auto h-8 w-8 text-[#DDE8DF]" aria-hidden />
                <p className="font-bold text-[#FFFEFA] bn-text">
                  {bn ? "ভিডিও শেষ — এক লাইনে শিক্ষাটা" : "Video finished — the one-line lesson"}
                </p>
                <p className="text-sm text-[#EDEAE1] bn-text">
                  {bn ? video.scenes[totalScenes - 1].caption.bn : video.scenes[totalScenes - 1].caption.en}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <Button onClick={replay} variant="outline" className="border-[#DDE8DF]/50 text-[#EDEAE1] hover:bg-[#3A4A42] h-11 gap-1.5">
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {bn ? "আবার দেখুন" : "Watch again"}
                  </Button>
                  <Button asChild className="bg-[#DDE8DF] text-[#202C26] hover:bg-[#CBDCD0] h-11 font-bold">
                    <Link to={`/check`}>{bn ? "নিজের বার্তা যাচাই করুন" : "Check your own message"}</Link>
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#3A4A42] px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(sceneIdx - 1)}
              disabled={sceneIdx === 0}
              className="h-11 w-11 text-[#EDEAE1] hover:bg-[#3A4A42] disabled:opacity-30"
              aria-label={bn ? "আগের দৃশ্য" : "Previous scene"}
            >
              <SkipBack className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              onClick={() => setPlaying((p) => !p)}
              className="h-12 w-12 rounded-full bg-[#DDE8DF] text-[#202C26] hover:bg-[#CBDCD0]"
              aria-label={playing ? (bn ? "বিরতি" : "Pause") : bn ? "চালান" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5 fill-current" aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(sceneIdx + 1)}
              disabled={sceneIdx === totalScenes - 1}
              className="h-11 w-11 text-[#EDEAE1] hover:bg-[#3A4A42] disabled:opacity-30"
              aria-label={bn ? "পরের দৃশ্য" : "Next scene"}
            >
              <SkipForward className="h-5 w-5" aria-hidden />
            </Button>

            <span className="mx-2 h-6 w-px bg-[#3A4A42] hidden sm:block" aria-hidden />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
              className="h-9 px-3 text-[#EDEAE1] hover:bg-[#3A4A42] font-bold tabular-nums"
              aria-label={bn ? "গতি" : "Speed"}
            >
              {speed}x
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setAudioOn((a) => !a);
                if (audioRef.current) audioRef.current.muted = !audioOn;
              }}
              className={cn("h-9 w-9 hover:bg-[#3A4A42]", audioOn ? "text-[#EDEAE1]" : "text-[#8A9B90]")}
              aria-label={audioOn ? (bn ? "শব্দ বন্ধ" : "Mute") : bn ? "শব্দ চালু" : "Unmute"}
            >
              {audioOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTranscript((t) => !t)}
              className={cn("h-9 w-9 hover:bg-[#3A4A42]", showTranscript ? "text-[#DDE8DF]" : "text-[#8A9B90]")}
              aria-label={bn ? "লিখিত সংলাপ" : "Transcript"}
              aria-pressed={showTranscript}
            >
              <ListOrdered className="h-4 w-4" aria-hidden />
            </Button>
            {audioBusy && (
              <span className="flex items-center gap-1.5 text-xs text-[#8A9B90] bn-text" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {bn ? "কণ্ঠ তৈরি হচ্ছে…" : "Preparing narration…"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {audioFailed && (
        <p className="rounded-xl border border-[#8A5B28]/40 bg-[#F2E8D5]/50 px-4 py-3 text-sm text-[#8A5B28] bn-text" role="status">
          {bn
            ? "কণ্ঠস্বর সেবা এখন পাওয়া যাচ্ছে না — সময় অনুযায়ী লেখা দৃশ্য এগিয়ে চলেছে (নীরব মোড, লেবেলকৃত)।"
            : "Narration audio is unavailable — scenes advance on a timer (labeled silent mode)."}
        </p>
      )}

      {/* transcript */}
      {showTranscript && (
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-4 md:p-5 space-y-3">
            <p className="font-bold text-[#202C26] bn-text">{bn ? "সম্পূর্ণ লিখিত সংলাপ ও বর্ণনা" : "Full transcript"}</p>
            <ol className="space-y-3">
              {video.scenes.map((s, i) => (
                <li key={i} className={cn("rounded-lg border px-3 py-2.5", i === sceneIdx ? "border-[#2F5746]/50 bg-[#DDE8DF]/30" : "border-[#D8DED5]")}>
                  <p className="text-xs font-bold text-[#8A9B90] bn-text">
                    {bn ? `দৃশ্য ${i + 1}` : `Scene ${i + 1}`}
                  </p>
                  <p className="mt-1 text-sm text-[#202C26] bn-text">{bn ? s.caption.bn : s.caption.en}</p>
                  {s.lines.map((l, j) => (
                    <p key={j} className="mt-1 text-sm text-[#59665F] bn-text">
                      <span className="font-semibold">{l.from === "scammer" ? (bn ? "প্রেরক: " : "Sender: ") : l.from === "victim" ? (bn ? "গ্রাহক: " : "User: ") : l.from === "family" ? (bn ? "পরিবার: " : "Family: ") : ""}</span>
                      {bn ? l.text : (l.en ?? l.text)}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone stage — animated scene renderer inside a phone mockup
// ---------------------------------------------------------------------------

function PhoneStage({
  scene,
  accent,
  playing,
  prefersReduced,
}: {
  scene: VideoScene;
  accent: string;
  playing: boolean;
  prefersReduced: boolean;
}) {
  return (
    <div
      className="relative w-full max-w-[300px] rounded-[2rem] border-[10px] border-[#141B17] bg-[#FFFEFA] shadow-xl overflow-hidden"
      role="img"
      aria-label={scene.caption.en}
    >
      {/* status bar */}
      <div className="flex items-center justify-between bg-[#202C26] px-4 py-1.5 text-[10px] text-[#EDEAE1]" aria-hidden>
        <span className="tabular-nums">২:০৭</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#DDE8DF]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#DDE8DF]/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#DDE8DF]/30" />
        </span>
      </div>

      <div className="min-h-[380px] flex flex-col">
        {scene.kind === "call" && <CallStage scene={scene} accent={accent} playing={playing} prefersReduced={prefersReduced} />}
        {scene.kind === "chat" && <ChatStage scene={scene} prefersReduced={prefersReduced} />}
        {scene.kind === "sms" && <SmsStage scene={scene} prefersReduced={prefersReduced} />}
        {scene.kind === "browser" && <BrowserStage scene={scene} prefersReduced={prefersReduced} />}
        {scene.kind === "verdict" && <VerdictStage scene={scene} accent={accent} />}
      </div>
    </div>
  );
}

function bubbleVariant(from: LineFrom) {
  switch (from) {
    case "scammer":
      return "bg-[#F4E1DA] text-[#202C26] self-start";
    case "victim":
      return "bg-[#2F5746] text-[#FFFEFA] self-end";
    case "family":
      return "bg-[#DDE8DF] text-[#202C26] self-start";
    default:
      return "bg-[#EDEAE1] text-[#202C26] self-start border border-[#D8DED5]";
  }
}

function fromLabel(from: LineFrom, bn: boolean): string {
  if (from === "scammer") return bn ? "প্রেরক (দাবিকৃত পরিচয়)" : "Sender (claimed)";
  if (from === "victim") return bn ? "গ্রাহক" : "User";
  if (from === "family") return bn ? "পরিবার" : "Family";
  return bn ? "সিস্টেম" : "System";
}

function ChatStage({ scene, prefersReduced }: { scene: VideoScene; prefersReduced: boolean }) {
  return (
    <div className="flex-1 flex flex-col gap-2.5 p-4 justify-end" aria-hidden>
      {scene.lines.map((l, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: l.delay, duration: 0.35 }}
          className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed bn-text shadow-sm", bubbleVariant(l.from))}
        >
          {l.text}
          <span className="mt-1 block text-right text-[9px] opacity-60">{fromLabel(l.from, true)}</span>
        </motion.div>
      ))}
    </div>
  );
}

function CallStage({
  scene,
  accent,
  playing,
  prefersReduced,
}: {
  scene: VideoScene;
  accent: string;
  playing: boolean;
  prefersReduced: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6" aria-hidden>
      <motion.div
        initial={prefersReduced ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: accent, opacity: 0.25 }}
          animate={playing && !prefersReduced ? { scale: [1, 1.5, 1], opacity: [0.3, 0.05, 0.3] } : { scale: 1, opacity: 0.15 }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full text-[#FFFEFA]" style={{ background: accent }}>
          <PhoneCall className="h-9 w-9" />
        </span>
      </motion.div>
      <div className="text-center">
        <p className="text-lg font-bold text-[#202C26] bn-text">{scene.meta?.title}</p>
        {scene.meta?.sub && <p className="text-xs text-[#8A9B90] mt-0.5 bn-text">{scene.meta.sub}</p>}
      </div>
      <div className="flex gap-10 mt-2">
        <span className="flex flex-col items-center gap-1.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A44435] text-[#FFFEFA]">
            <PhoneOff className="h-5 w-5" />
          </span>
          <span className="text-[10px] text-[#59665F] font-semibold bn-text">বন্ধ</span>
        </span>
        <span className="flex flex-col items-center gap-1.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2F5746] text-[#FFFEFA]">
            <PhoneCall className="h-5 w-5" />
          </span>
          <span className="text-[10px] text-[#59665F] font-semibold bn-text">ধরুন</span>
        </span>
      </div>
    </div>
  );
}

function SmsStage({ scene, prefersReduced }: { scene: VideoScene; prefersReduced: boolean }) {
  return (
    <div className="flex-1 flex flex-col justify-center p-4 gap-3" aria-hidden>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-[#8A9B90] bn-text">ইনবক্স</span>
        <Bell className="h-3.5 w-3.5 text-[#8A9B90]" />
      </div>
      {scene.lines.map((l, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? false : { x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: l.delay, type: "spring", stiffness: 220, damping: 22 }}
          className="rounded-2xl border border-[#D8DED5] bg-[#F4F1EB] p-3.5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2F5746] text-[11px] font-bold text-[#FFFEFA] bn-text">
              {scene.meta?.title?.charAt(0) ?? "S"}
            </span>
            <div>
              <p className="text-[13px] font-bold text-[#202C26] bn-text">{scene.meta?.title}</p>
              <p className="text-[10px] text-[#8A9B90] bn-text">{scene.meta?.sub ?? "এই মুহূর্তে"}</p>
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#202C26] bn-text">{l.text}</p>
        </motion.div>
      ))}
    </div>
  );
}

function BrowserStage({ scene, prefersReduced }: { scene: VideoScene; prefersReduced: boolean }) {
  return (
    <div className="flex-1 flex flex-col" aria-hidden>
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-[#D8DED5] bg-[#EDEAE1] px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-[#A44435]/70" />
          <span className="h-2 w-2 rounded-full bg-[#8A5B28]/70" />
          <span className="h-2 w-2 rounded-full bg-[#2F5746]/70" />
        </span>
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 truncate rounded-full border border-[#D8DED5] bg-[#FFFEFA] px-3 py-1 text-[10px] text-[#A44435] font-mono"
        >
          🔒 {scene.meta?.title}
        </motion.div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4E1DA] text-[#A44435]">
          <AlertTriangle className="h-6 w-6" />
        </span>
        {scene.lines.map((l, i) => (
          <motion.div
            key={i}
            initial={prefersReduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: l.delay }}
            className="w-full rounded-xl border border-[#D8DED5] bg-[#F4F1EB] p-3 text-center"
          >
            <p className="text-[13px] text-[#202C26] bn-text">{l.text}</p>
            <div className="mx-auto mt-2 h-8 w-3/4 rounded-lg border-2 border-dashed border-[#A44435]/50 bg-[#FFFEFA]" />
            <p className="mt-1.5 text-[10px] font-bold text-[#A44435] bn-text">
              ⚠ এখানে কিছুই লিখবেন না — এই পাতাটি নকল
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function VerdictStage({ scene, accent }: { scene: VideoScene; accent: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center" aria-hidden>
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: accent }}
      >
        <BadgeCheck className="h-8 w-8 text-[#FFFEFA]" />
      </motion.span>
      <p className="text-sm font-bold text-[#202C26] bn-text px-2 leading-relaxed">{scene.caption.bn}</p>
      <div className="flex items-center gap-1.5 rounded-full bg-[#DDE8DF]/60 px-3 py-1.5">
        <Bot className="h-3.5 w-3.5 text-[#2F5746]" />
        <span className="text-[10px] font-semibold text-[#2F5746] bn-text">শিল্ডএজেন্ট শিক্ষা ভিডিও</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video gallery
// ---------------------------------------------------------------------------

export function VideoGallery({ onPlay }: { onPlay: (v: ScamVideo) => void }) {
  const bn = useLang() === "bn";
  return (
    <div className="space-y-4">
      {SCAM_VIDEOS.map((v) => (
        <button
          key={v.id}
          onClick={() => onPlay(v)}
          className="group w-full text-left rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-4 sm:p-5 flex items-center gap-4 transition-all hover:border-[#2F5746]/50 hover:shadow-md focus-ring"
        >
          <span
            className="relative flex h-16 w-24 shrink-0 items-center justify-center rounded-xl overflow-hidden"
            style={{ background: `${v.accent}18` }}
            aria-hidden
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full transition-transform group-hover:scale-110" style={{ background: v.accent }}>
              <Play className="h-5 w-5 fill-current text-[#FFFEFA]" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#202C26] bn-text">{bn ? v.title.bn : v.title.en}</span>
              <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] text-[10px]">
                {bn ? "কাল্পনিক" : "Fictional"}
              </Badge>
            </span>
            <span className="mt-1 block text-sm text-[#59665F] leading-relaxed bn-text">{bn ? v.summary.bn : v.summary.en}</span>
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8A9B90] bn-text">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {bn ? `~${v.minutes} মিনিট` : `~${v.minutes} min`} ·{" "}
              {bn ? `${v.scenes.length} দৃশ্য · বাংলা কণ্ঠসহ` : `${v.scenes.length} scenes · Bengali narration`}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
