// GET    /api/v1/analyses/{id} — session metadata + full validated result (owner only)
// DELETE /api/v1/analyses/{id} — soft-delete (owner only)
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, fail, requireCaseOwner } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { failIfStaleProcessing, sweepExpiredSessions } from "@/lib/pipeline";

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const rl = rateLimit(clientKey(req, `case-read:${id}`), 200, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ। কিছুক্ষণ পরে চেষ্টা করুন।", 429);

  // Opportunistic retention sweep — expiry is enforced by reads too.
  await sweepExpiredSessions();

  const session = await db.analysisSession.findUnique({
    where: { id },
    include: { evidence: true, report: { select: { id: true, status: true } } },
  });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  // V7 owner guard: missing/wrong guest identity discloses no case content.
  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  await failIfStaleProcessing(session);

  return ok({
    id: session.id,
    modality: session.modality,
    status: session.status,
    stage: session.stage,
    engine: session.engine,
    riskCategory: session.riskCategory,
    scamCategory: session.scamCategory,
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt?.toISOString() ?? null,
    result: session.result ?? null,
    extractedText: session.extractedText,
    hasReport: Boolean(session.report),
    report: session.report ? { id: session.report.id, status: session.report.status } : null,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const session = await db.analysisSession.findUnique({ where: { id } });
  if (!session) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  await db.evidenceItem.deleteMany({ where: { sessionId: id } });
  await db.analysisSession.update({
    where: { id },
    data: { deletedAt: new Date(), status: "failed", stage: null, result: Prisma.DbNull, extractedText: null },
  });
  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      action: "analysis.deleted",
      entityType: "AnalysisSession",
      entityId: id,
      detail: { by: "guest-cookie" } as unknown as object,
    },
  });

  return ok({ deleted: true, id });
}
