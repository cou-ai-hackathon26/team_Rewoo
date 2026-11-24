// ---------------------------------------------------------------------------
// Privacy redaction engine.
// Runs BEFORE any content is persisted or sent to the external model provider.
// Sensitive values are masked; quotes stored in the database therefore never
// contain usable OTPs, PINs, full phone numbers, NIDs or card numbers.
// ---------------------------------------------------------------------------

export interface Redaction {
  type: "otp" | "pin" | "phone" | "nid" | "card" | "email";
  preview: string; // safe preview, e.g. "****4521"
}

export interface RedactionResult {
  text: string; // redacted text
  redactions: Redaction[];
}

const PHONE_BN_MOBILE = /(?<!\d)(?:\+?88)?01[3-9]\d{8}(?!\d)/g;
const PHONE_INTL = /(?<!\d)\+?\d[\d\s-]{8,14}\d(?!\d)/g;
const OTP_KEYWORD =
  /(otp|ওটিপি|ও\.টি\.পি|one[\s-]?time(?:\s+password)?|verification\s+code|ভেরিফিকেশন\s*কোড|কনফার্মেশন\s*কোড|সিক্রেট\s*কোড|পিন|pin|password|পাসওয়ার্ড)/i;

function maskDigits(n: string, keepLast = 4): string {
  const tail = n.slice(-keepLast);
  return "•".repeat(Math.max(3, n.length - keepLast)) + tail;
}

/** Redact digit runs that appear near OTP/PIN keywords (within same line). */
function redactOtpLike(text: string, redactions: Redaction[]): string {
  const lines = text.split(/\n/);
  const out = lines.map((line) => {
    const kw = line.match(OTP_KEYWORD);
    if (!kw) return line;
    // redact 4–8 digit runs in that line
    return line.replace(/(?<!\d)\d{4,8}(?!\d)/g, (m) => {
      if (/^\d{4}$/.test(m) && /^(19|20)\d{2}$/.test(m)) return m; // years
      redactions.push({ type: "otp", preview: maskDigits(m, 2) });
      return `[ওটিপি/কোড আড়াল ••${m.slice(-2)}]`;
    });
  });
  return out.join("\n");
}

function redactPhones(text: string, redactions: Redaction[]): string {
  let out = text.replace(PHONE_BN_MOBILE, (m) => {
    redactions.push({ type: "phone", preview: `•••••${m.slice(-4)}` });
    return `[মোবাইল ••••${m.slice(-4)}]`;
  });
  // international-looking numbers that were not already replaced
  out = out.replace(PHONE_INTL, (m) => {
    if (m.includes("[মোবাইল")) return m;
    if (!/\d{6,}/.test(m.replace(/[\s-]/g, ""))) return m;
    redactions.push({ type: "phone", preview: `•••••${m.slice(-4)}` });
    return `[ফোন ••••${m.slice(-4)}]`;
  });
  return out;
}

function redactEmails(text: string, redactions: Redaction[]): string {
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => {
    const [user, domain] = m.split("@");
    redactions.push({ type: "email", preview: `${user[0]}•••@${domain}` });
    return `${user[0]}•••@${domain}`;
  });
}

function redactNid(text: string, redactions: Redaction[]): string {
  return text.replace(/(?<!\d)\d{10}(?:\d{0,7})(?!\d)/g, (m) => {
    // 10–17 digit runs: candidate NID / card numbers — mask fully except last 2
    redactions.push({ type: "nid", preview: maskDigits(m, 2) });
    return `[আইডি নম্বর ••${m.slice(-2)}]`;
  });
}

/**
 * Full pipeline: OTP/PIN → phones → emails → long digit IDs.
 * Order matters: OTP redaction runs first so codes near keywords are not
 * mistaken for phone numbers.
 */
export function redactPII(input: string): RedactionResult {
  const redactions: Redaction[] = [];
  let text = input.slice(0, 20_000); // hard cap
  text = redactOtpLike(text, redactions);
  text = redactPhones(text, redactions);
  text = redactEmails(text, redactions);
  text = redactNid(text, redactions);
  return { text, redactions };
}

/** True when the text still contains digits runs that look sensitive (belt & braces). */
export function containsSensitiveDigits(text: string): boolean {
  const phoneLike = /(?<!\d)01[3-9]\d{8}(?!\d)/.test(text);
  const longDigits = /(?<!\d)\d{12,}(?!\d)/.test(text);
  return phoneLike || longDigits;
}

/**
 * Light redaction for PUBLIC community posts: masks OTP-like codes (self-harm
 * protection — a code visible publicly can be exploited) and long ID/card
 * digit runs, but KEEPS phone numbers — scammer numbers are the core warning
 * value of an alert post, and the composer UI warns authors never to post
 * their own number. Moderation + AI notices cover abuse.
 */
export function redactCodesAndIds(input: string): string {
  const redactions: Redaction[] = [];
  let text = input.slice(0, 4_000);
  text = redactOtpLike(text, redactions);
  text = redactNid(text, redactions);
  return text;
}
