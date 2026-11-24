// POST /api/v1/auth/register — create a community member account.
// Minimal data by design: display name + username + password. No phone,
// no email, no personal identifiers. Returns the unique public member ID.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { hashPassword, newMemberPublicId } from "@/lib/crypto";
import { createMemberCookie } from "@/lib/auth";

interface RegisterBody {
  name?: string;
  username?: string;
  password?: string;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// Bengali digits mapped to ASCII so users can type ০-৯ usernames naturally.
const BN_DIGITS: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "auth-register"), 5, 60 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেকবার চেষ্টা করা হয়েছে — এক ঘণ্টা পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<RegisterBody>(req, 32 * 1024);
  if (!body) return fail("invalid-body", "অনুরোধটি বোঝা যায়নি।", 400);

  const name = (body.name ?? "").trim().slice(0, 40);
  const username = (body.username ?? "").toLowerCase().replace(/[০-৯]/g, (d) => BN_DIGITS[d] ?? d).trim();
  const password = body.password ?? "";

  if (name.length < 2) return fail("invalid-name", "নামটি আরেকটু বড় করে লিখুন (কমপক্ষে ২ অক্ষর)।", 400);
  if (!USERNAME_RE.test(username))
    return fail("invalid-username", "ইউজারনেমে ৩-২০টি ছোট হাতের ইংরেজি অক্ষর, সংখ্যা বা _ ব্যবহার করুন।", 400);
  if (password.length < 8) return fail("weak-password", "পাসওয়ার্ডে কমপক্ষে ৮ অক্ষর দিন।", 400);

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return fail("username-taken", "এই ইউজারনেমটি আগে থেকেই আছে — অন্যটি বেছে নিন।", 409);

  // Public IDs are short and human-readable; retry on the (unlikely) clash.
  let publicId = newMemberPublicId();
  for (let i = 0; i < 3; i++) {
    const clash = await db.user.findUnique({ where: { publicId } });
    if (!clash) break;
    publicId = newMemberPublicId();
  }

  const user = await db.user.create({
    data: {
      name,
      username,
      publicId,
      role: "citizen",
      passwordHash: hashPassword(password),
    },
  });

  await createMemberCookie(user.id);
  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      actorId: user.id,
      action: "member.registered",
      entityType: "User",
      entityId: user.id,
      detail: { publicId } as unknown as object,
    },
  });

  return ok({
    member: {
      publicId: user.publicId,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
