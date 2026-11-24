// GET /api/v1/analyst/audit — immutable audit trail (analyst-only)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAnalyst } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "100"), 300);
  const events = await db.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok({
    events: events.map((e) => ({
      id: e.id,
      actorType: e.actorType,
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
