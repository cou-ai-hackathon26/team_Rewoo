// POST /api/v1/agent/voice — Guardian voice input (COU TECHNOVA 2026,
// Challenge 1). Reuses the existing server-side ASR (transcribeAudio from
// src/lib/multimodal.ts — the same engine that serves the voice-verification
// tab) without requiring an analysis case, so a person can report an
// incident by voice directly inside the Guardian chat.
//
// Rules:
//   - Explicit consent is REQUIRED ("consent": true) before microphone
//     audio is processed. No consent → 403, nothing is processed.
//   - The transcript is privacy-redacted (redactPII inside transcribeAudio)
//     and processed in-memory only — never stored.
//   - Failure is honest: an empty/garbled transcript returns a failure code
//     so the client keeps the editable text path available.
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/multimodal";

export const runtime = "nodejs";
export const maxDuration = 60;

const VoiceBody = z.object({
  audioBase64: z.string().min(64).max(9_000_000),
  mime: z.enum(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac", "audio/mp3"]),
  consent: z.literal(true),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "agent-voice"), 12, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ — কিছুক্ষণ পরে আবার বলুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<unknown>(req, 10 * 1024 * 1024);
  if (!body) return fail("invalid-body", "অডিও পাওয়া যায়নি।", 400);

  const parsed = VoiceBody.safeParse(body);
  if (!parsed.success) {
    const attempted = body as Record<string, unknown>;
    if ("consent" in attempted && attempted.consent !== true) {
      return fail("consent-required", "অডিও প্রসেস করার আগে আপনার স্পষ্ট সম্মতি প্রয়োজন।", 403);
    }
    return fail("invalid-body", "অডিও ফরম্যাট গ্রহণযোগ্য নয়।", 400);
  }

  const result = await transcribeAudio(parsed.data.audioBase64, parsed.data.mime);
  if (!result.ok || !result.text || result.text.trim().length < 2) {
    return fail("transcription-failed", "স্পষ্ট শুনতে পাইনি — আবার বলুন বা লিখে পাঠান।", 422, { asr: "server-asr" });
  }

  return ok({
    transcript: result.text.trim().slice(0, 4000),
    engine: "server-asr",
    note: {
      bn: "লেখ্যুক্তি সার্ভারের ASR দিয়ে তোলা হয়েছে — পাঠানোর আগে ঠিক করতে পারবেন।",
      en: "Transcript produced by server ASR — you can correct it before sending.",
    },
  });
}
