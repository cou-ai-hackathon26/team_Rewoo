// GET /api/v1/analyses/{id}/result — the full validated AnalysisResult (owner only)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireCaseOwner } from "@/lib/api";

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const session = await db.analysisSession.findUnique({
    where: { id },
    include: { report: { select: { id: true, status: true } } },
  });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  if (session.status !== "completed") {
    return ok({ id, status: session.status, stage: session.stage, result: null });
  }

  return ok({
    id: session.id,
    status: session.status,
    engine: session.engine,
    result: session.result,
    report: session.report ? { id: session.report.id, status: session.report.status } : null,
  });
}
