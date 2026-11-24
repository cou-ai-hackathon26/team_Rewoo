// ---------------------------------------------------------------------------
// Guest identity — V7.
//
// Prior releases trusted a client-generated `X-Shield-Visitor` header as the
// case-owner credential, which any caller could forge (independent review P0).
// V7 replaces this with a server-issued, HMAC-signed httpOnly cookie:
//
//   bs_guest = "<guestId>.<signature>"
//   signature = HMAC-SHA256(guestId, SESSION_SECRET) (base64url)
//
// Migration/continuity: on the FIRST request that arrives with no valid cookie
// but a legacy `X-Shield-Visitor` header, the guest id is minted equal to that
// legacy token value (format-checked, 16–64 url-safe chars). This preserves
// existing users' access to their own pre-V7 cases — knowing a case ID alone
// never granted access; the unguessable 24-byte token did, and continues to.
// After minting, the signed cookie is authoritative and the header is ignored.
//
// SameSite=Lax provides the CSRF posture for cookie-authenticated writes
// (cross-site POSTs do not carry the cookie). Case IDs remain public
// references only — never authority.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "bs_guest";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days
const LEGACY_RX = /^[A-Za-z0-9_-]{16,64}$/;

function hmacKey(): string {
  // F-02 fix (V8): never sign with a KNOWN CONSTANT in production.
  //   dev (local sandbox)  → documented dev fallback, convenient and fine.
  //   production           → SESSION_SECRET when set; otherwise a key derived
  //                          from DATABASE_URL. That derivation is stable
  //                          across instances (cookies keep working) yet not
  //                          guessable by visitors (the env value is never
  //                          exposed client-side). A warning is logged so
  //                          operators set a real SESSION_SECRET.
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length > 0) return secret.trim();
  if (process.env.NODE_ENV === "production") {
    const derived = process.env.DATABASE_URL;
    if (derived && derived.trim().length > 0) {
      // Only warn once per process.
      if (!warned) {
        warned = true;
        console.warn(
          "[banglashield] SESSION_SECRET is not set — using a DATABASE_URL-derived signing key. Set SESSION_SECRET for production."
        );
      }
      return `bs-derived:${derived}`;
    }
    // Last resort: a per-process random key (secure, but sessions do not
    // survive cold starts — still strictly safer than a public constant).
    return `bs-random:${randomBytes(32).toString("hex")}`;
  }
  return "banglashield-dev-session-key";
}

let warned = false;

function sign(id: string): string {
  return createHmac("sha256", hmacKey()).update(id).digest("base64url");
}

function verify(id: string, sig: string): boolean {
  try {
    const expected = Buffer.from(sign(id));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export interface GuestIdentity {
  id: string;
  /** True when a new cookie was minted and must be attached to the response. */
  isNew: boolean;
  /** Set-Cookie header value when isNew; otherwise null. */
  cookie: string | null;
}

/** Read + verify the guest cookie. Returns the guest id or null. */
export function getGuestId(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!id || !sig || !verify(id, sig)) return null;
  return id;
}

function mintCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(`${id}.${sign(id)}`)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * Resolve the caller's guest identity, minting a signed cookie when none is
 * present. The legacy header is honored only at mint time (see module docs).
 */
export function resolveGuest(req: NextRequest): GuestIdentity {
  const existing = getGuestId(req);
  if (existing) return { id: existing, isNew: false, cookie: null };

  // One-time continuity mint from a legacy token (pre-V7 clients).
  const legacy = req.headers.get("x-shield-visitor");
  const id = legacy && LEGACY_RX.test(legacy) ? legacy : `g_${randomBytes(24).toString("base64url")}`;
  return { id, isNew: true, cookie: mintCookie(id) };
}

/** Attach a freshly minted guest cookie to a JSON response. */
export function attachGuest<T extends NextResponse>(res: T, guest: GuestIdentity): T {
  if (guest.isNew && guest.cookie) res.headers.set("Set-Cookie", guest.cookie);
  return res;
}

// ---------------------------------------------------------------------------
// Case ownership guard
// ---------------------------------------------------------------------------

export type OwnerCheck =
  | { ok: true; guestId: string }
  | { ok: false; reason: "no-session" | "not-owner"; guestId: string | null };

/**
 * Server-side case ownership check. A session belongs to its creating guest
 * identity; missing/invalid sessions and non-owners get no private content.
 * Ownerless (null visitorId) sessions cannot exist through the public API and
 * are treated as inaccessible.
 */
export function checkCaseOwner(
  session: { visitorId: string | null } | null,
  guestId: string | null
): OwnerCheck {
  if (!session || !session.visitorId) return { ok: false, reason: "no-session", guestId };
  if (!guestId) return { ok: false, reason: "not-owner", guestId: null };
  if (session.visitorId !== guestId) return { ok: false, reason: "not-owner", guestId };
  return { ok: true, guestId };
}
