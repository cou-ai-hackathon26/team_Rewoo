// POST /api/v1/auth/login — community member sign-in (username + password).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/crypto";
import { createMemberCookie } from "@/lib/auth";

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "auth-login"), 10, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেকবার চেষ্টা করা হয়েছে — কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<LoginBody>(req, 32 * 1024);
  if (!body?.username || !body.password) return fail("invalid-body", "ইউজারনেম ও পাসওয়ার্ড দিন।", 400);

  const username = body.username.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { username } });
  if (!user || user.role !== "citizen" || !user.active || !verifyPassword(body.password, user.passwordHash)) {
    return fail("invalid-credentials", "ইউজারনেম বা পাসওয়ার্ড মেলেনি।", 401);
  }

  await createMemberCookie(user.id);
  return ok({
    member: {
      publicId: user.publicId,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
