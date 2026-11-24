// POST /api/v1/tts — spoken Bengali guidance (narration support).
//
// V9 (fix): the previous implementation proxied the sandbox ZAI voice
// ("tongtong" & friends), which CANNOT speak Bangla — Bangla text came out
// as "tong-tong-tong" gibberish that users perceived as Chinese. The route
// now synthesizes GENUINE Bangla speech via Google Translate's bn voice,
// server-proxied (CORS-blocked for browsers) and chunked to the provider's
// ~200-char limit. Bengali-script input maps to tl=bn, anything else to
// tl=en. The client always prefers the device's own Bangla voice first
// (browser speechSynthesis) — this route is the fallback for devices
// without one.
//
// Text is capped at 1024 chars per the route contract. Audio is streamed
// back and never stored.
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { redactPII } from "@/lib/redact";

const TtsBody = z.object({
  text: z.string().min(2).max(1024),
  speed: z.number().min(0.5).max(2).default(1),
});

/** Google Translate TTS caps each request at ~200 chars. Split on sentence
 *  boundaries (danda, ., !, ?, newline), falling back to word boundaries. */
function chunkText(text: string, max = 190): string[] {
  const sentences = text
    .split(/(?<=[।.!?\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const s of sentences) {
    if (s.length > max) {
      // Oversized sentence: hard-split on word boundaries.
      push();
      let words = s.split(/\s+/);
      while (words.length) {
        const piece: string[] = [];
        while (words.length && (piece.join(" ") + " " + words[0]).trim().length <= max) {
          piece.push(words.shift()!);
        }
        if (piece.length) chunks.push(piece.join(" "));
      }
      continue;
    }
    if ((cur + " " + s).trim().length > max) push();
    cur = cur ? `${cur} ${s}` : s;
  }
  push();
  return chunks;
}

const TTS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchChunk(chunk: string, lang: string, speed: number, idx: number, total: number): Promise<Buffer> {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
    `&q=${encodeURIComponent(chunk)}&tl=${lang}&ttsspeed=${speed}` +
    `&idx=${idx}&total=${total}&textlen=${chunk.length}`;
  const res = await fetch(url, {
    headers: { "User-Agent": TTS_UA, Referer: "https://translate.google.com/" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`gtts-http-${res.status}`);
  const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
  if (buf.length < 200) throw new Error("gtts-empty");
  return buf;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "tts"), 20, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const body = await readJson<unknown>(req, 8 * 1024);
  const parsed = TtsBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "ধ্বনি তৈরির অনুরোধ গ্রহণযোগ্য নয়।", 422);

  try {
    const { text } = redactPII(parsed.data.text); // never speak sensitive digits
    const clean = text.trim().slice(0, 1024);
    // Bengali script -> Bangla voice; otherwise the English voice.
    const lang = /[\u0980-\u09FF]/.test(clean) ? "bn" : "en";
    const speed = Math.min(1.5, Math.max(0.5, parsed.data.speed));
    const chunks = chunkText(clean);
    if (chunks.length === 0) return fail("invalid-input", "ধ্বনি তৈরির অনুরোধ গ্রহণযোগ্য নয়।", 422);

    const parts = await Promise.all(
      chunks.map((c, i) => fetchChunk(c, lang, speed, i, chunks.length))
    );
    // MP3 frames are self-contained; sequential concatenation plays fine.
    const audio = Buffer.concat(parts);

    return new Response(audio as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(
      "tts-failed",
      "ধ্বনি তৈরি করা যায়নি — লেখা সংস্করণটি ব্যবহার করুন।",
      503,
      { detail: err instanceof Error ? err.message : "unknown" }
    );
  }
}
