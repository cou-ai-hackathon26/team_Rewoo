// ---------------------------------------------------------------------------
// Bangla narration helper (client-side).
//
// Voice chain, honestly labeled:
//   1. Browser speechSynthesis with a GENUINE Bangla voice (bn-BD preferred,
//      then bn-IN, then any bn-*) — device-native, offline, zero cost. This is
//      the primary path on the public Vercel deployment.
//   2. Server /api/v1/tts (V9: genuine Bangla speech via Google Translate's
//      bn voice, proxied server-side) — used when the device has no Bangla
//      voice installed. The old ZAI sandbox voice could not speak Bangla.
//   3. Failure — the caller keeps the written text available (never fake).
// ---------------------------------------------------------------------------

export type SpeechEngine = "browser-bangla" | "server-tts" | "failed";

export function pickBanglaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const isBn = (v: SpeechSynthesisVoice) => v.lang?.toLowerCase().startsWith("bn");
  const bnVoices = voices.filter(isBn);
  if (!bnVoices.length) return null;
  // Prefer Bangladeshi Bangla, then local (offline) voices, then Indian Bangla.
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang?.toLowerCase().startsWith("bn-bd") ? 4 : 0) + (v.localService ? 2 : 0);
  return [...bnVoices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** True when a Bangla speech engine is (or will be) available. Voices load
 *  asynchronously in some browsers — the callback fires once they do. */
export function banglaVoiceAvailable(onChange?: (available: boolean) => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const now = pickBanglaVoice() !== null;
  if (onChange) {
    window.speechSynthesis.addEventListener("voiceschanged", () => onChange(pickBanglaVoice() !== null), { once: true });
  }
  return now;
}

function speakWithBrowser(text: string, speed: number, voice: SpeechSynthesisVoice, onDone: (ok: boolean) => void): boolean {
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // stop anything previously playing
    const utter = new SpeechSynthesisUtterance(text.slice(0, 1500));
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = Math.min(2, Math.max(0.5, speed));
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      onDone(ok);
    };
    utter.onend = () => finish(true);
    utter.onerror = () => finish(false);
    // Safety net: some engines never fire onend — cap at ~2s per 10 chars.
    const capMs = Math.min(90_000, 4_000 + text.length * 160);
    window.setTimeout(() => finish(true), capMs);
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

/** Stop any narration currently playing (browser engine). */
export function stopBanglaSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Narrate Bangla text through the voice chain. Resolves with the engine that
 * actually served the audio (for honest labeling), or "failed".
 */
export async function speakBangla(
  text: string,
  opts: { speed?: number; onDone?: (engine: SpeechEngine) => void } = {}
): Promise<SpeechEngine> {
  const clean = text.trim();
  if (!clean) return "failed";
  const speed = opts.speed ?? 1;

  // 1. Browser Bangla voice (genuine bn-BD/bn-IN device voice).
  const voice = pickBanglaVoice();
  if (voice) {
    const started = await new Promise<boolean>((resolve) => {
      const ok = speakWithBrowser(clean, speed, voice, resolve);
      if (!ok) resolve(false);
    });
    if (ok_or(started)) {
      opts.onDone?.("browser-bangla");
      return "browser-bangla";
    }
  }

  // 2. Server TTS (V9: Google Translate bn voice; returns audio/mpeg).
  try {
    const { api } = await import("./api");
    const res = await api.postRaw("/api/v1/tts", { text: clean.slice(0, 1024), speed });
    if (!res.ok) throw new Error("tts-http");
    const blob = await res.blob();
    if (!blob.type.startsWith("audio") || blob.size < 200) throw new Error("tts-empty");
    const url = URL.createObjectURL(blob);
    const played = await new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
    URL.revokeObjectURL(url);
    if (played) {
      opts.onDone?.("server-tts");
      return "server-tts";
    }
  } catch {
    /* fall through to failure */
  }

  opts.onDone?.("failed");
  return "failed";
}

// Tiny alias kept local for readability of the success check above.
function ok_or(v: boolean): boolean {
  return v === true;
}
