// POST /api/v1/community/posts/{id}/report — flag a post for moderation.
// One report is enough to move it to "under_review" (kept visible with a
// badge until a human moderator decides — Facebook's reported-posts model).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rl = rateLimit(clientKey(req, "post-report"), 10, 60 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const post = await db.communityPost.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!post) return fail("not-found", "পোস্টটি পাওয়া যায়নি।", 404);
  if (post.status === "hidden") return ok({ status: "hidden", already: true });

  const payload = (await readJson<{ reason?: string }>(req, 8 * 1024)) ?? {};
  const reason = (payload.reason ?? "").slice(0, 300);

  if (post.status === "active") {
    await db.communityPost.update({ where: { id }, data: { status: "under_review" } });
  }

  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      action: "post.reported",
      entityType: "CommunityPost",
      entityId: id,
      detail: { reason: reason || "(no reason given)", status: "under_review" } as unknown as object,
    },
  });

  return ok({ status: "under_review" });
}
