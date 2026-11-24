// ---------------------------------------------------------------------------
// Shared API helpers: JSON responses, validation errors, guest identity,
// analyst authorization guard. Server-only.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAnalystSession } from "./auth";
import { resolveGuest, attachGuest, checkCaseOwner, type GuestIdentity } from "./guest-auth";
import type { NextRequest } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * @deprecated V7: guest identity is the server-issued signed cookie
 * (src/lib/guest-auth.ts). This header-only reader remains only for
 * non-authoritative uses (rate-limit scoping) — never for ownership.
 */
export function getVisitor(req: Request): string | null {
  const v = req.headers.get("x-shield-visitor");
  return v && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

/** Resolve the caller's guest identity, minting a signed cookie if needed. */
export function guest(req: NextRequest): GuestIdentity {
  return resolveGuest(req);
}

/** JSON response with the guest cookie attached when freshly minted. */
export function okForGuest(g: GuestIdentity, data: unknown, init?: ResponseInit) {
  return attachGuest(NextResponse.json(data, init), g);
}

/**
 * Case-ownership guard for analysis endpoints. Returns the guest identity on
 * success or a 403/404 NextResponse that discloses no private case content.
 */
export function requireCaseOwner(
  req: NextRequest,
  session: { visitorId: string | null } | null
): { ok: true; guestId: string; identity: GuestIdentity } | { ok: false; response: NextResponse } {
  const identity = resolveGuest(req);
  const check = checkCaseOwner(session, identity.id);
  if (!check.ok) {
    // Uniform denial: never reveal whether the case exists for someone else.
    const response = NextResponse.json(
      { error: { code: "forbidden", message: "এই কেসটি দেখার অনুমতি আপনার নেই।" } },
      { status: 403 }
    );
    return { ok: false, response: attachGuest(response, identity) };
  }
  return { ok: true, guestId: check.guestId, identity };
}

export async function requireAnalyst() {
  const session = await getAnalystSession();
  if (!session) return { session: null, response: fail("unauthorized", "Analyst authentication required.", 401) };
  return { session, response: null };
}

export async function readJson<T>(req: Request, maxBytes = 12 * 1024 * 1024): Promise<T | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
