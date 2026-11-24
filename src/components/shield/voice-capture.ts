// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 1: reusable voice capture controller.
//
// The SAME technique the voice-verification tab has used since V4/V8:
// MediaRecorder for the audio + a parallel bn-BD browser SpeechRecognition
// for live Bangla text. Controller form so Guardian chat (and any future
// surface) can reuse it without duplicating browser logic.
// ---------------------------------------------------------------------------

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function mediaRecorderSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined";
}

export function voiceCaptureSupported(): boolean {
  return mediaRecorderSupported();
}

export type CaptureStart =
  | { ok: true }
  | { ok: false; error: "permission-denied" | "unsupported" };

export class VoiceCapture {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private liveText = "";
  private recognition: { stop: () => void } | null = null;
  private stream: MediaStream | null = null;
  private mime = "";

  get liveTranscript(): string {
    return this.liveText;
  }

  async start(): Promise<CaptureStart> {
    if (!voiceCaptureSupported()) return { ok: false, error: "unsupported" };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return { ok: false, error: "permission-denied" };
    }
    try {
      this.mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      this.recorder = this.mime
        ? new MediaRecorder(this.stream, { mimeType: this.mime })
        : new MediaRecorder(this.stream);
      this.chunks = [];
      this.liveText = "";
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start();
      this.startLiveRecognition();
      return { ok: true };
    } catch {
      this.releaseStream();
      return { ok: false, error: "unsupported" };
    }
  }

  /** Stops capture and resolves the recorded blob (null when nothing usable). */
  stop(): Blob | null {
    this.stopLiveRecognition();
    let blob: Blob | null = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
        blob = new Blob(this.chunks, { type: this.mime || "audio/webm" });
      } catch {
        blob = null;
      }
    }
    this.releaseStream();
    this.recorder = null;
    if (blob && blob.size < 1200) return null; // too short — treat as unusable
    return blob;
  }

  dispose(): void {
    this.stopLiveRecognition();
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* already stopped */
    }
    this.releaseStream();
    this.recorder = null;
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  // Parallel Bangla live recognition (best-effort, like the Verify voice tab).
  private startLiveRecognition(): void {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = "bn-BD";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        this.liveText = (finalText + " " + interim).trim();
      };
      rec.start();
      this.recognition = { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
    } catch {
      /* unsupported/mic conflict — recorder alone still works */
    }
  }

  private stopLiveRecognition(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}
