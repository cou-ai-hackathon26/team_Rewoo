// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 1 core: deterministic incident-state resolver.
//
// Determines, from the user's own words (Bangla / Banglish / English), whether
// they (a) mention a verification code (OTP/PIN/password) without saying they
// shared it, (b) deny sharing it, (c) affirm sharing it — including
// corrections of an earlier statement ("আসলে আমি দিয়ে ফেলেছি" / "actually I
// did share it"). The latest explicit statement always wins.
//
// Pure functions only — no I/O, fully unit-testable. The Guardian chat route
// folds the resolver over the conversation's user turns; its output drives
// BOTH the AI system-prompt context AND the deterministic stage replies, so
// the behavior does not depend on the model obeying a prompt.
// ---------------------------------------------------------------------------

export type IncidentState = "unknown" | "not_shared" | "shared";

export type IncidentStage = "follow_up" | "preventive" | "recovery" | null;

export interface IncidentSignal {
  /** The message mentions a verification code / OTP / PIN / password topic. */
  mentionsCode: boolean;
  /** The user's own statement about sharing it: affirmed / denied / absent. */
  shareStatement: "affirmed" | "denied" | null;
  /** Correction markers ("আসলে", "actually", "wait", "ভুল করেছি"…). */
  isCorrection: boolean;
  /** A bare negative answer ("না", "no") usable only in an open code topic. */
  bareNegative: boolean;
}

export interface IncidentResolution {
  /** State after folding every user turn. */
  state: IncidentState;
  /** Stage for THIS turn: follow-up question / preventive / recovery advice. */
  stage: IncidentStage;
  /** True when THIS turn changed the state (drives the guidance switch). */
  changed: boolean;
  /** True when this turn corrected a previous statement (or a correction marker). */
  correction: boolean;
  /** Any prior or current turn mentioned a code topic. */
  codeTopicSeen: boolean;
}

// --- pattern tables ---------------------------------------------------------

const CODE_TOPIC_PATTERNS: RegExp[] = [
  /ওটিপি/,
  /ও\s*টি\s*পি/,
  /ভেরিফিকেশন\s*কোড/,
  /ভেরিফিকেশন\s*পিন/,
  /সিক্রেট\s*কোড/,
  /গোপন\s*কোড/,
  /কোড/,
  /পিন/,
  /পাসওয়ার্ড/,
  /\bOTP\b/i,
  /\bOTPI\b/i,
  /\bodtp\b/i,
  /\bone[-\s]?time\s+(code|password|pin)\b/i,
  /\bverification\s+code\b/i,
  /\bverification\s+pin\b/i,
  /\bsecret\s+code\b/i,
  /\bpasscode\b/i,
  /\bpassword\b/i,
  /\bpin\b/i,
  /\bcode\b/i,
];

// Statements where the user says they DID share the code.
// Index of the match is recorded: the LATEST explicit statement in a mixed
// message ("না দিইনি… মানে হ্যাঁ দিয়ে ফেলেছি") is the one that counts.
const AFFIRM_PATTERNS: RegExp[] = [
  /দিয়ে\s*ফেলেছি/,
  /দিয়ে\s*ফেলেছিলাম/,
  /দিয়ে\s*দিয়েছি/,
  /দিয়ে\s*দিলাম/,
  /দিয়ে\s*বসে\s*আছি/,
  /দিয়ে\s*ফেলছি/,
  /দিয়েছি/,
  /দিইয়েছি/,
  /দিয়া\s*ফেলে\s*গেছি/,
  /পাঠিয়ে\s*দিয়েছি/,
  /পাঠিয়ে\s*ফেলেছি/,
  /পাঠাই\s*দিয়েছি/,
  /শেয়ার\s*করে\s*ফেলেছি/,
  /শেয়ার\s*করে\s*দিয়েছি/,
  /শেয়ার\s*করেছি/,
  /বলে\s*দিয়েছি/,
  /জানিয়ে\s*দিয়েছি/,
  /\bdiye\s*(fellam|felam|fellesi|diyeche|dilam)\b/i,
  /\b(di|de)chilam\b/i,
  /\bdiyechi\b/i,
  /\bdiyeche\b/i,
  /\bdilam\b/i,
  /\bdiye\s*dilam\b/i,
  /\bdiye\s*fel\b/i,
  /\bdieche\b/i,
  /\b(i|we|ami|amra|she)\s+(have\s+|already\s+|just\s+)?(shared|given|gave|sent|told|provided|passed)\b/i,
  /\b(shared|gave|given|sent|told)\s+(the\s+|my\s+|that\s+)?(otp|code|pin|password)\b/i,
];

// Statements where the user says they did NOT share it.
const DENY_PATTERNS: RegExp[] = [
  /দিই\s*নাই/,
  /দিইনি/,
  /দেই\s*নাই/,
  /দেইনি/,
  /দিই\s*নেই/,
  /দিচ্ছি\s*না/,
  /দিলাম\s*না/,
  /দিয়ে\s*ফেলিনি/,
  /দিয়ে\s*ফেলি\s*নাই/,
  /ফেলিনি/,
  /পাঠাই\s*নাই/,
  /পাঠাইনি/,
  /পাঠিয়ে\s*নাই/,
  /করি\s*নাই/,
  /করিনি/,
  /দিয়েছি\s*না(?!\S)/,
  /দিলাম\s*না(?!\S)/,
  /\b(did|do|have|had)\s*not\s+(share|give|gave|send|sent|tell|told)\b/i,
  /\b(didn'?t|haven'?t|hasn'?t|don'?t)\s+(share|give|gave|send|sent|tell|told)\b/i,
  /\bnot\s+shared\b/i,
  /\bnever\s+(shared|gave|sent|told)\b/i,
  /\bdini\b/i,
  /\bdieni\b/i,
  /\bdeini\b/i,
  /\bdiye\s*(feli\s*)?nai\b/i,
  /\bkori\s*nai\b/i,
  /\bkorini\b/i,
  /\bpathai\s*nai\b/i,
  /\bpathaini\b/i,
];

const CORRECTION_PATTERNS: RegExp[] = [
  /আসলে/,
  /মানে/,
  /ভুল/,
  /সরি/,
  /ঠিক\s*কর/,
  /বরং/,
  /কিন্তু\s+আসলে/,
  /\bactually\b/i,
  /\bwait\b/i,
  /\bsorry\b/i,
  /\bi\s+mean\b/i,
  /\bno\s+wait\b/i,
  /\bcorrection\b/i,
  /\bmistake\b/i,
];

const BARE_NEGATIVE = /^(না|নাই|না\.|no|no\.|nope|nah)(\s|$|[।,!?])/i;
const BARE_AFFIRM = /^(হ্যাঁ|হ্যাঁ\.|yes|ha|haa)(\s|$|[।,!?])/i;

interface Matched {
  kind: "affirmed" | "denied";
  index: number;
}

function firstMatch(text: string, patterns: RegExp[]): { index: number } | null {
  let best: { index: number } | null = null;
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      if (best === null || m.index < best.index) best = { index: m.index };
    }
  }
  return best;
}

/**
 * Analyze ONE user message. `codeTopicAlready` lets pronoun-level statements
 * ("আমি দিয়ে ফেলেছি" with no code word) count when the conversation already
 * concerns a code, mirroring how the incident conversation actually unfolds.
 */
export function analyzeMessage(text: string, codeTopicAlready: boolean): IncidentSignal {
  const t = text ?? "";
  const mentionsCode = CODE_TOPIC_PATTERNS.some((p) => p.test(t));
  const topic = mentionsCode || codeTopicAlready;

  const affirm = firstMatch(t, AFFIRM_PATTERNS);
  const deny = firstMatch(t, DENY_PATTERNS);

  // The LATEST statement in the message is the one that counts. When a
  // message both denies and affirms ("না দিইনি… আসলে দিয়ে ফেলেছি"), the
  // right-most match is the user's final position.
  let shareStatement: "affirmed" | "denied" | null = null;
  if (affirm || deny) {
    if (!affirm) shareStatement = "denied";
    else if (!deny) shareStatement = "affirmed";
    else shareStatement = affirm.index > deny.index ? "affirmed" : "denied";
  }
  // A share statement only counts when the conversation is actually about a
  // verification code (this message or an earlier one).
  if (shareStatement !== null && !topic) shareStatement = null;

  return {
    mentionsCode,
    shareStatement,
    isCorrection: CORRECTION_PATTERNS.some((p) => p.test(t)),
    bareNegative: BARE_NEGATIVE.test(t.trim()) && t.trim().length <= 6,
  };
}

/**
 * Fold the conversation's user turns into the incident resolution for the
 * LAST turn. Deterministic: same input, same output — no model involved.
 */
export function resolveIncident(userMessages: string[]): IncidentResolution {
  let state: IncidentState = "unknown";
  let codeTopicSeen = false;
  let correction = false;
  let changed = false;

  const texts = userMessages.filter((m) => typeof m === "string" && m.trim().length > 0);
  const signals: IncidentSignal[] = [];

  for (const text of texts) {
    const signal = analyzeMessage(text, codeTopicSeen);
    signals.push(signal);
    if (signal.mentionsCode) codeTopicSeen = true;
    changed = false;
    if (signal.shareStatement === "denied") {
      if (state !== "not_shared") changed = true;
      // correcting an earlier "shared" admission (or using correction words)
      correction = correction || signal.isCorrection || state === "shared";
      state = "not_shared";
    } else if (signal.shareStatement === "affirmed") {
      if (state !== "shared") changed = true;
      // correcting an earlier denial (or using correction words)
      correction = correction || signal.isCorrection || state === "not_shared";
      state = "shared";
    }
  }

  // A bare "না / no" only means "not shared" as an answer INSIDE an open code
  // topic with an unresolved state (the flow's follow-up question pending).
  const last = signals[signals.length - 1];
  if (last && last.shareStatement === null && last.bareNegative && codeTopicSeen && state === "unknown") {
    state = "not_shared";
    changed = true;
  }
  // Symmetric bare "হ্যাঁ / yes" as an answer to the pending follow-up.
  if (
    last &&
    last.shareStatement === null &&
    BARE_AFFIRM.test((texts[texts.length - 1] ?? "").trim()) &&
    (texts[texts.length - 1] ?? "").trim().length <= 6 &&
    codeTopicSeen &&
    state === "unknown"
  ) {
    state = "shared";
    changed = true;
    correction = true;
  }

  // Stage for the FINAL turn only.
  let stage: IncidentStage = null;
  if (last) {
    if (last.shareStatement === "denied" && changed) stage = "preventive";
    else if (last.shareStatement === "affirmed" && changed) stage = "recovery";
    else if (last.shareStatement === null && last.mentionsCode && state === "unknown") stage = "follow_up";
  }

  return { state, stage, changed, correction, codeTopicSeen };
}

/** Server-side reply language selection (same heuristic as shield-agent). */
export function incidentLangOf(text: string): "bn" | "en" {
  return /[\u0980-\u09FF]/.test(text) || !/[a-zA-Z]/.test(text) ? "bn" : "en";
}
