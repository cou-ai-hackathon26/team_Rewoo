// POST /api/v1/community/posts/{id}/helpful — toggle the "helpful" mark.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getMemberSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) return fail("unauthenticated", "চিহ্ন দিতে সাইন-ইন করুন।", 401);

  const { id } = await params;
  const rl = rateLimit(`helpful:${session.userId}`, 60, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const post = await db.communityPost.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!post || post.status === "hidden") return fail("not-found", "পোস্টটি পাওয়া যায়নি।", 404);

  const existing = await db.helpfulMark.findUnique({
    where: { postId_userId: { postId: id, userId: session.userId } },
  });

  if (existing) {
    await db.$transaction([
      db.helpfulMark.delete({ where: { id: existing.id } }),
      db.communityPost.update({ where: { id }, data: { helpfulCount: { decrement: 1 } } }),
    ]);
    return ok({ marked: false });
  }

  await db.$transaction([
    db.helpfulMark.create({ data: { postId: id, userId: session.userId } }),
    db.communityPost.update({ where: { id }, data: { helpfulCount: { increment: 1 } } }),
  ]);
  return ok({ marked: true });
}
