// GET /api/v1/analyst/patterns — pattern registry with review state
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAnalyst } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const patterns = await db.fraudPattern.findMany({
    where: status !== "all" ? { status } : {},
    orderBy: { lastSeen: "desc" },
    include: { reviews: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  const now = new Date();
  return ok({
    patterns: patterns.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      category: p.category,
      status: p.status,
      synthetic: p.synthetic,
      confidence: p.confidence,
      reportIds: p.reportIds,
      indicators: p.indicators,
      firstSeen: p.firstSeen.toISOString(),
      lastSeen: p.lastSeen.toISOString(),
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      expired: p.expiresAt ? p.expiresAt < now : false,
      reviews: p.reviews.map((r) => ({
        id: r.id,
        action: r.action,
        reason: r.reason,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        reviewerId: r.reviewerId,
      })),
    })),
  });
}
