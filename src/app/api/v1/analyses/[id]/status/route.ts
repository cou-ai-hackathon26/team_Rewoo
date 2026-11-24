// GET /api/v1/analyses/{id}/status — polling endpoint for real progress (owner only)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireCaseOwner } from "@/lib/api";
import { failIfStaleProcessing } from "@/lib/pipeline";

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const session = await db.analysisSession.findUnique({
    where: { id },
    select: { id: true, status: true, stage: true, riskCategory: true, error: true, deletedAt: true, updatedAt: true, visitorId: true, jobClaimedAt: true, jobAttempts: true, pendingInput: true },
  });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  await failIfStaleProcessing(session);

  return ok({
    id: session.id,
    status: session.status,
    stage: session.stage,
    riskCategory: session.riskCategory,
    error: session.error,
  });
}
