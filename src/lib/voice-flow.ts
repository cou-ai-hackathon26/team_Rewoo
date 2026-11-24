// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 1: the Guardian voice-input flow state
// machine (pure, client-shared).
//
// Visible states, exactly as required:
//   awaiting-consent → recording (listening) → processing → review
//   (transcript review/correction) → sending → idle.
//
// Failure paths are first-class: consent denied, microphone permission
// denied, unsupported browser, and an unusable transcript all land back on
// the text-input path — the typed channel is ALWAYS available.
// ---------------------------------------------------------------------------

export type VoicePhase =
  | "idle"
  | "awaiting-consent"
  | "recording"
  | "processing"
  | "review"
  | "sending";

export type VoiceEvent =
  | "request-mic"
  | "consent-granted"
  | "consent-denied"
  | "stop"
  | "capture-ready"
  | "capture-failed"
  | "send"
  | "sent"
  | "cancel"
  | "permission-denied"
  | "mic-unsupported";

const TRANSITIONS: Record<VoicePhase, Partial<Record<VoiceEvent, VoicePhase>>> = {
  idle: {
    "request-mic": "awaiting-consent",
    "mic-unsupported": "idle",
  },
  "awaiting-consent": {
    "consent-granted": "recording",
    "consent-denied": "idle",
    cancel: "idle",
    "permission-denied": "idle",
    "mic-unsupported": "idle",
  },
  recording: {
    stop: "processing",
    cancel: "idle",
    "permission-denied": "idle",
    "mic-unsupported": "idle",
  },
  processing: {
    "capture-ready": "review",
    "capture-failed": "review", // keep the editable transcript step
    cancel: "idle",
  },
  review: {
    send: "sending",
    cancel: "idle",
  },
  sending: {
    sent: "idle",
    cancel: "idle",
  },
};

export function nextVoicePhase(phase: VoicePhase, event: VoiceEvent): VoicePhase {
  return TRANSITIONS[phase][event] ?? phase;
}

/**
 * Transcript quality gate (before the review step offers it as usable):
 * at least 3 characters and at least 2 letters (Bangla or Latin) —
 * punctuation/digit-only garbage or a single stammered syllable is
 * treated as an unclear transcription, NOT as an incident statement.
 */
export function transcriptUsable(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 3) return false;
  const letters = (t.match(/[\u0980-\u09FFa-zA-Z]/g) ?? []).length;
  return letters >= 2;
}
