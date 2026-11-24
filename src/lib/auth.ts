// ---------------------------------------------------------------------------
// Session helpers (server-enforced role-based authorization).
// Signed httpOnly cookies — no client-trustable role flags.
// Two independent cookie scopes:
//   - bs_analyst  → analyst/admin console access
//   - bs_member   → community member access (posting, commenting, tracking)
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import { signSession, verifySession } from "./crypto";
import { db } from "./db";

export const ANALYST_COOKIE = "bs_analyst";
export const MEMBER_COOKIE = "bs_member";

export interface AnalystSession {
  userId: string;
  role: string;
  name?: string;
  email?: string;
}

export interface MemberSession {
  userId: string;
  publicId: string;
  name: string;
  username: string;
}

export async function getAnalystSession(): Promise<AnalystSession | null> {
  const store = await cookies();
  const token = store.get(ANALYST_COOKIE)?.value;
  const verified = verifySession(token);
  if (!verified || (verified.role !== "analyst" && verified.role !== "admin")) return null;
  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.active) return null;
  return { userId: user.id, role: user.role, name: user.name ?? undefined, email: user.email ?? undefined };
}

export async function createAnalystCookie(userId: string, role: string) {
  const store = await cookies();
  store.set(ANALYST_COOKIE, signSession(userId, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearAnalystCookie() {
  const store = await cookies();
  store.delete(ANALYST_COOKIE);
}

// --- Community member sessions -------------------------------------------

export async function getMemberSession(): Promise<MemberSession | null> {
  const store = await cookies();
  const token = store.get(MEMBER_COOKIE)?.value;
  const verified = verifySession(token);
  if (!verified || verified.role !== "citizen") return null;
  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.active || user.role !== "citizen") return null;
  return {
    userId: user.id,
    publicId: user.publicId ?? "",
    name: user.name ?? user.username ?? "সদস্য",
    username: user.username ?? "",
  };
}

export async function createMemberCookie(userId: string) {
  const store = await cookies();
  store.set(MEMBER_COOKIE, signSession(userId, "citizen", 30 * 24 * 60 * 60 * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearMemberCookie() {
  const store = await cookies();
  store.delete(MEMBER_COOKIE);
}
