// POST /api/v1/analyses/{id}/input
// kind=text    → analyze text immediately (message modality / confirmed transcript)
// kind=link    → analyze URL/QR destination (never visited)
// kind=audio   → ASR extraction → returns editable transcript (awaiting_review)
// kind=image   → VLM extraction → returns editable OCR text (awaiting_review)
// kind=confirm → run the full pipeline on reviewed/edited text
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, requireCaseOwner } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { redactPII } from "@/lib/redact";
import { runPipelineInBackground, failIfStaleProcessing } from "@/lib/pipeline";
import { transcribeAudio, extractImageContent } from "@/lib/multimodal";

export const runtime = "nodejs";
export const maxDuration = 60;

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

const TextBody = z.object({
  kind: z.literal("text"),
  text: z.string().min(4).max(8000),
  demo: z.boolean().optional(), // OFFLINE_DEMO preset — labeled synthetic
});
const ConfirmBody = z.object({
  kind: z.literal("confirm"),
  text: z.string().min(1).max(8000),
  visualNotes: z.array(z.string().max(400)).max(8).optional(),
});
const LinkBody = z.object({
  kind: z.literal("link"),
  url: z.string().min(3).max(500),
  note: z.string().max(1000).optional(), // where the link came from (optional context)
  demo: z.boolean().optional(), // OFFLINE_DEMO preset — labeled synthetic
});
const AudioBody = z.object({
  kind: z.literal("audio"),
  audioBase64: z.string().min(64).max(9_000_000), // ~6.5MB audio
  mime: z.enum(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac", "audio/mp3"]),
});
const ImageBody = z.object({
  kind: z.literal("image"),
  imageDataUrl: z.string().refine(
    (v) => /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 7_500_000,
    "unsupported-or-too-large"
  ),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const rl = rateLimit(clientKey(req, "analyses-input"), 20, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ, কিছুক্ষণ পরে চেষ্টা করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  let session = await db.analysisSession.findUnique({ where: { id } });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  // V7 owner guard: only the creating guest may submit input to this case.
  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  // Resolve stale processing first (recovery or honest failure) so a crashed
  // run never permanently blocks new input on this case.
  await failIfStaleProcessing(session);
  if (session.status === "processing") {
    const fresh = await db.analysisSession.findUnique({ where: { id } });
    if (!fresh || fresh.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);
    session = fresh;
  }
  if (session.status === "processing") return fail("busy", "এই কেসের বিশ্লেষণ এখনো চলছে।", 409);

  const body = await readJson<unknown>(req, 12 * 1024 * 1024);
  if (!body) return fail("invalid-body", "অনুরোধটি পড়া যায়নি বা খুব বড়।", 413);

  // ---- 1. Audio → transcript (user reviews before analysis) ---------------
  const audio = AudioBody.safeParse(body);
  if (audio.success) {
    if (session.modality !== "voice") return fail("wrong-modality", "এই কেসে ভয়েস গ্রহণযোগ্য নয়।", 409);
    await db.analysisSession.update({ where: { id }, data: { status: "processing", stage: "redacting" } });
    const t = await transcribeAudio(audio.data.audioBase64, audio.data.mime);
    if (!t.ok || !t.text || t.text.trim().length < 2) {
      await db.analysisSession.update({
        where: { id },
        data: {
          status: "awaiting_review",
          stage: null,
          error: t.error ?? "empty-transcript",
        },
      });
      return ok({
        status: "awaiting_review",
        transcriptOk: false,
        message:
          "কথাগুলো স্পষ্টভাবে শনাক্ত করা যায়নি। অনুগ্রহ করে নিচের ঘরে নিজের ভাষায় লিখে দিন (বাংলা বা বাংলিশ)।",
      });
    }
    // V3 honest-quality guard: the ASR service sometimes "hallucinates" highly
    // repetitive filler for Bengali audio (a known provider limitation). Detect
    // that shape and route the user to the editable transcript with a warning
    // instead of presenting garbage as a usable transcript.
    const looksGarbled = isLikelyGarbledTranscript(t.text);
    await db.analysisSession.update({
      where: { id },
      data: {
        status: "awaiting_review",
        stage: null,
        extractedText: looksGarbled ? null : t.text.slice(0, 8000),
        ...(looksGarbled ? { error: "low-quality-transcript" } : {}),
      },
    });
    if (looksGarbled) {
      return ok({
        status: "awaiting_review",
        transcriptOk: false,
        message:
          "রেকর্ডিং শোনা গেছে, কিন্তু কথাগুলো নিশ্চিতভাবে লেখায় আনা যায়নি (বাংলা উচ্চারণ চেনার সীমাবদ্ধতা)। নিচের ঘরে শোনা কথাগুলো নিজে লিখে দিন — বাংলা বা বাংলিশ দুটোই চলবে।",
      });
    }
    return ok({ status: "awaiting_review", transcriptOk: true, transcript: t.text });
  }

  // ---- 2. Image → OCR text (user reviews before analysis) ------------------
  const image = ImageBody.safeParse(body);
  if (image.success) {
    if (session.modality !== "image") return fail("wrong-modality", "এই কেসে ছবি গ্রহণযোগ্য নয়।", 409);
    await db.analysisSession.update({ where: { id }, data: { status: "processing", stage: "redacting" } });
    const ex = await extractImageContent(image.data.imageDataUrl);
    if (!ex.ok || !ex.extractedText || ex.extractedText.trim().length < 2) {
      await db.analysisSession.update({
        where: { id },
        data: { status: "awaiting_review", stage: null, error: ex.error ?? "ocr-empty" },
      });
      return ok({
        status: "awaiting_review",
        ocrOk: false,
        message: "ছবি থেকে লেখা পড়া যায়নি। বার্তার লেখাটুকু নিজে টাইপ করে দিন, বা আরও পরিষ্কার ছবি দিন।",
      });
    }
    // Do NOT persist the image itself. Only redacted text is retained.
    await db.analysisSession.update({
      where: { id },
      data: { status: "awaiting_review", stage: null, extractedText: ex.extractedText.slice(0, 8000) },
    });
    return ok({
      status: "awaiting_review",
      ocrOk: true,
      extractedText: ex.extractedText,
      visualNotes: ex.visualNotes ?? [],
    });
  }

  // ---- 3. Link → analyze in background (client polls for progress) -----
  const link = LinkBody.safeParse(body);
  if (link.success) {
    if (session.modality !== "link") return fail("wrong-modality", "এই কেসে লিংক গ্রহণযোগ্য নয়।", 409);
    const rawNote = link.data.note ? redactPII(link.data.note).text : "";
    const display = `${rawNote ? rawNote + "\n\n" : ""}(জমা দেওয়া লিংক: ${link.data.url})`;
    const reason = validateLinkInput(link.data.url);
    if (reason) return fail("invalid-input", reason, 422);
    runPipelineInBackground({
      sessionId: id,
      modality: "link",
      redactedText: display,
      url: link.data.url,
      demo: link.data.demo === true,
    });
    return ok({ status: "processing" });
  }

  // ---- 4. Direct text → analyze in background ----------------------------
  const text = TextBody.safeParse(body);
  if (text.success) {
    if (session.modality !== "message" && !(text.data.demo && session.modality === "voice"))
      return fail("wrong-modality", "এই কেসে টেক্সট গ্রহণযোগ্য নয়।", 409);
    runPipelineInBackground({
      sessionId: id,
      modality: session.modality === "voice" ? "voice" : "message",
      redactedText: redactPII(text.data.text).text,
      demo: text.data.demo === true,
    });
    return ok({ status: "processing" });
  }

  // ---- 5. Confirmed (reviewed/edited) text → analyze in background --------
  const confirm = ConfirmBody.safeParse(body);
  if (confirm.success) {
    if (!["voice", "image"].includes(session.modality))
      return fail("wrong-modality", "নিশ্চিতকরণ শুধু ভয়েস/ছবি কেসে প্রযোজ্য।", 409);
    const visualNotes = (confirm.data.visualNotes ?? []).map((n) => redactPII(n).text);
    runPipelineInBackground({
      sessionId: id,
      modality: session.modality as "voice" | "image",
      redactedText: redactPII(confirm.data.text).text,
      visualNotes,
    });
    return ok({ status: "processing" });
  }

  return fail("invalid-input", "অনুরোধের ধরন বোঝা যায়নি।", 422);
}

/** Basic URL-shape validation before the pipeline runs (never visits it). */
function validateLinkInput(raw: string): string | null {
  const url = raw.trim();
  if (/\s/.test(url)) return "লিংকে ফাঁকা জায়গা রাখা যাবে না — পুরো লিংকটি দিন।";
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !/^[\w-]+(\.[\w-]+)+/.test(url))
    return "এটি দেখতে লিংক/ডোমেইনের মতো নয় — আবার দেখে নিন।";
  if (/^(javascript|data|file|vbscript):/i.test(url))
    return "এই ধরনের ঠিকানা গ্রহণযোগ্য নয়।";
  return null;
}

/**
 * V7 honest-quality guard for ASR output: detect the "hallucinated filler"
 * shape (one short token repeated over and over, no Bengali script, no real
 * sentence structure) that Bengali audio sometimes produces. Returns true →
 * route the citizen to the editable transcript instead of trusting garbage.
 *
 * Regression fixtures (observed provider failures — must route to review):
 *   "Tend, tend, tended..."      → 3 words, top token 2/3  → garbled
 *   "Thank you. Thank you. Thank" → 5 words, top token 3/5  → garbled
 *   "থ্যাংক থ্যাংক থ্যাংক"          → 3 words, top token 3/3  → garbled
 * Legitimate short utterances (distinct words) must still pass through.
 */
function isLikelyGarbledTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  const hasBengali = /[\u0980-\u09FF]/.test(trimmed);
  const words = trimmed
    .split(/[\s,.:;!?।…-]+/)
    .filter(Boolean)
    .map((w) => (hasBengali ? w : w.toLowerCase()));
  if (words.length < 3) return false; // too short to judge either way
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const distinct = counts.size;
  // Pathological repetition at ANY length: one token dominating the output.
  if (distinct === 1) return true;
  if (maxCount / words.length >= 0.6) return true;
  // Longer filler streams with low vocabulary diversity.
  if (words.length >= 6 && distinct / words.length < 0.5) return true;
  return false;
}
