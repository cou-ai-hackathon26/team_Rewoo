// GET /api/v1/community/mine — the signed-in member's dashboard data:
// their posts (with tracking refs + statuses) and their official reports.
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { getMemberSession } from "@/lib/auth";

export async function GET() {
  const session = await getMemberSession();
  if (!session) return fail("unauthenticated", "সাইন-ইন করা নেই।", 401);

  const [posts, reports] = await Promise.all([
    db.communityPost.findMany({
      where: { authorId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        ref: true,
        kind: true,
        body: true,
        status: true,
        aiRisk: true,
        helpfulCount: true,
        commentCount: true,
        createdAt: true,
      },
    }),
    db.report.findMany({
      where: { authorId: session.userId },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: { id: true, category: true, status: true, submittedAt: true, synthetic: true },
    }),
  ]);

  return ok({
    member: {
      publicId: session.publicId,
      name: session.name,
      username: session.username,
    },
    posts: posts.map((p) => ({
      id: p.id,
      ref: p.ref,
      kind: p.kind,
      body: p.body,
      status: p.status,
      aiRisk: p.aiRisk,
      helpfulCount: p.helpfulCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt.toISOString(),
    })),
    reports: reports.map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
      submittedAt: r.submittedAt.toISOString(),
      synthetic: r.synthetic,
    })),
  });
}
