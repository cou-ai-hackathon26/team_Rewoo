// POST /api/v1/analyst/patterns/{id}/withdraw — revoke an approved pattern.
// Withdrawn patterns immediately stop being trusted intelligence.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, requireAnalyst } from "@/lib/api";

const Body = z.object({
  reason: z.string().min(10).max(1200),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;
  const { id } = await params;

  const body = await readJson<unknown>(req, 8 * 1024);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "প্রত্যাহারের কারণ অন্তত ১০ অক্ষরে দিন।", 422);

  const pattern = await db.fraudPattern.findUnique({ where: { id } });
  if (!pattern) return fail("not-found", "প্যাটার্নটি পাওয়া যায়নি।", 404);

  const now = new Date();
  const review = await db.humanReview.create({
    data: {
      patternId: pattern.id,
      reviewerId: session.userId,
      action: "withdraw",
      reason: parsed.data.reason,
    },
  });
  await db.fraudPattern.update({
    where: { id: pattern.id },
    data: { status: "withdrawn", expiresAt: now, reviewedAt: now },
  });
  await db.auditEvent.create({
    data: {
      actorType: "analyst",
      actorId: session.userId,
      action: "pattern.withdraw",
      entityType: "FraudPattern",
      entityId: pattern.code,
      detail: { reason: parsed.data.reason, reviewId: review.id } as unknown as object,
    },
  });

  return ok({ id: pattern.id, status: "withdrawn" });
}
