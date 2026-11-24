// GET /api/v1/auth/me — current community member session (or 401).
import { ok, fail } from "@/lib/api";
import { getMemberSession } from "@/lib/auth";

export async function GET() {
  const session = await getMemberSession();
  if (!session) return fail("unauthenticated", "সাইন-ইন করা নেই।", 401);
  return ok({ member: session });
}
