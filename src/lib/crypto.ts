import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Public-facing reference IDs (unguessable, human-readable)
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars

function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newCaseId(): string {
  return `BS-${randomCode(8)}`; // ~40 bits entropy, shown to user
}

export function newReportId(): string {
  return `RPT-${randomCode(8)}`;
}

export function newMemberPublicId(): string {
  return `BSA-${randomCode(6)}`;
}

export function newPostRef(): string {
  return `CPT-${randomCode(8)}`;
}

export function newVisitorToken(): string {
  return randomBytes(24).toString("base64url");
}

// ---------------------------------------------------------------------------
// Report withdrawal receipt (F-03, V8)
// ---------------------------------------------------------------------------

/** One-time withdrawal receipt token — shown to the submitter exactly once. */
export function newWithdrawToken(): string {
  return randomBytes(20).toString("base64url"); // ~160 bits entropy
}

/** sha256 hex digest (used to store the withdrawal token, never in clear). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newLearnerToken(): string {
  return randomBytes(16).toString("base64url");
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt — no external dependency)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(":");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signed session tokens for analyst access (HMAC, httpOnly cookie value)
// ---------------------------------------------------------------------------

function hmacKey(): string {
  // Falls back to an ephemeral key when env is not configured (dev only);
  // sessions then reset on server restart, which is acceptable for this demo.
  return (
    process.env.SESSION_SECRET ||
    process.env.ANALYST_SESSION_SECRET ||
    "banglashield-dev-session-key"
  );
}

export function signSession(userId: string, role: string, ttlMs = 12 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${role}.${exp}`;
  const sig = createHmac("sha256", hmacKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined | null): { userId: string; role: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, role, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !role || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac("sha256", hmacKey())
    .update(`${userId}.${role}.${expStr}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, role };
}
