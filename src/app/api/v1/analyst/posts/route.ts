// GET /api/v1/analyst/posts — moderation list of community posts (analyst auth).
// Facebook-style reported-posts management: every post with its status,
// AI assessment and report counts, filterable by status.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireAnalyst } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const rl = rateLimit(`analyst-posts:${session.userId}`, 60, 60_000);
  if (!rl.ok) return fail("rate-limited", "Too many requests.", 429);

  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const where = ["active", "under_review", "hidden"].includes(status) ? { status } : {};

  const posts = await db.communityPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { author: { select: { publicId: true, name: true, username: true } } },
  });

  const reported = await db.auditEvent.findMany({
    where: { entityType: "CommunityPost", action: "post.reported" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { entityId: true, createdAt: true, detail: true },
  });
  const reportCounts = new Map<string, number>();
  for (const r of reported) {
    if (r.entityId) reportCounts.set(r.entityId, (reportCounts.get(r.entityId) ?? 0) + 1);
  }

  return ok({
    posts: posts.map((p) => ({
      id: p.id,
      ref: p.ref,
      kind: p.kind,
      body: p.body.slice(0, 300),
      status: p.status,
      aiRisk: p.aiRisk,
      aiEngine: p.aiEngine,
      synthetic: p.synthetic,
      helpfulCount: p.helpfulCount,
      commentCount: p.commentCount,
      reportCount: reportCounts.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
      author: {
        publicId: p.author?.publicId ?? "—",
        name: p.author?.name ?? "—",
        username: p.author?.username ?? "—",
      },
    })),
  });
}
