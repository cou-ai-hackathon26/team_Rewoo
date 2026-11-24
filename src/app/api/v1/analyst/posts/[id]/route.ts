// PATCH /api/v1/analyst/posts/{id} — moderate a community post (analyst auth).
// action: "hide" | "restore" — every action is audit-logged.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson, requireAnalyst } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const { id } = await params;
  const payload = await readJson<{ action?: string; reason?: string }>(req, 8 * 1024);
  const action = payload?.action;
  if (action !== "hide" && action !== "restore") return fail("invalid-action", "action must be hide|restore", 400);

  const post = await db.communityPost.findUnique({ where: { id } });
  if (!post) return fail("not-found", "Post not found.", 404);

  const nextStatus = action === "hide" ? "hidden" : "active";
  if (post.status === nextStatus) return ok({ id, status: nextStatus, already: true });

  await db.communityPost.update({ where: { id }, data: { status: nextStatus } });
  await db.auditEvent.create({
    data: {
      actorType: "analyst",
      actorId: session.userId,
      action: `post.${action}`,
      entityType: "CommunityPost",
      entityId: id,
      detail: { reason: (payload?.reason ?? "").slice(0, 300) || "(no reason)", ref: post.ref } as unknown as object,
    },
  });

  return ok({ id, status: nextStatus });
}
