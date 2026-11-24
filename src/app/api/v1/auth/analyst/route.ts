// POST   /api/v1/auth/analyst — sign in (email + password, signed httpOnly cookie)
// GET    /api/v1/auth/analyst — current session
// DELETE /api/v1/auth/analyst — sign out
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { ok, fail, readJson } from "@/lib/api";
import { createAnalystCookie, clearAnalystCookie, getAnalystSession } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const LoginBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "analyst-login"), 10, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<unknown>(req, 8 * 1024);
  const parsed = LoginBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "ইমেইল ও পাসওয়ার্ড দিন।", 422);

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Constant-ish response: same message for unknown email and wrong password.
  if (!user || !user.active || !["analyst", "admin"].includes(user.role) || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return fail("invalid-credentials", "ইমেইল বা পাসওয়ার্ড সঠিক নয়।", 401);
  }

  await createAnalystCookie(user.id, user.role);
  await db.auditEvent.create({
    data: {
      actorType: "analyst",
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
    },
  });

  return ok({ session: { userId: user.id, role: user.role, name: user.name, email: user.email } });
}

export async function GET() {
  const session = await getAnalystSession();
  if (!session) return ok({ session: null });
  return ok({ session });
}

export async function DELETE() {
  const session = await getAnalystSession();
  if (session) {
    await db.auditEvent.create({
      data: {
        actorType: "analyst",
        actorId: session.userId,
        action: "auth.logout",
        entityType: "User",
        entityId: session.userId,
      },
    });
  }
  await clearAnalystCookie();
  return ok({ signedOut: true });
}
