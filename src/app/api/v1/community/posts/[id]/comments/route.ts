// Post comments — GET list (public) + POST add (member auth).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { getMemberSession } from "@/lib/auth";
import { redactCodesAndIds } from "@/lib/redact";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rl = rateLimit(clientKey(req, "post-comments"), 120, 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const post = await db.communityPost.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!post || post.status === "hidden") return fail("not-found", "পোস্টটি পাওয়া যায়নি।", 404);

  const comments = await db.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { author: { select: { publicId: true, name: true, username: true } } },
  });

  return ok({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      isAgent: c.isAgent,
      createdAt: c.createdAt.toISOString(),
      author: {
        publicId: c.author?.publicId ?? "BSA-??????",
        name: c.author?.name ?? "সদস্য",
        username: c.author?.username ?? null,
      },
    })),
  });
}

interface AddBody {
  body?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) return fail("unauthenticated", "মন্তব্য করতে সাইন-ইন করুন।", 401);

  const { id } = await params;
  const rl = rateLimit(`post-comment:${session.userId}`, 30, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি মন্তব্য — কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const post = await db.communityPost.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!post || post.status !== "active") return fail("not-found", "এই পোস্টে এখন মন্তব্য করা যাবে না।", 404);

  const payload = await readJson<AddBody>(req, 64 * 1024);
  const raw = (payload?.body ?? "").trim();
  if (raw.length < 1) return fail("empty-body", "মন্তব্যটি লিখুন।", 400);
  if (raw.length > 1000) return fail("too-long", "মন্তব্য সর্বোচ্চ ১০০০ অক্ষরের হতে পারে।", 400);

  const body = redactCodesAndIds(raw);

  const comment = await db.comment.create({
    data: { postId: id, authorId: session.userId, isAgent: false, body },
  });
  await db.communityPost.update({ where: { id }, data: { commentCount: { increment: 1 } } });

  return ok({
    comment: {
      id: comment.id,
      body: comment.body,
      isAgent: false,
      createdAt: comment.createdAt.toISOString(),
      author: { publicId: session.publicId, name: session.name, username: session.username },
    },
  });
}
