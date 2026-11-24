// GET /api/v1/analyses/{id}/replay — Shield Lens stage data (owner only)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireCaseOwner } from "@/lib/api";

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const session = await db.analysisSession.findUnique({
    where: { id },
    select: { id: true, status: true, result: true, deletedAt: true, visitorId: true },
  });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  if (session.status !== "completed" || !session.result) {
    return ok({ id, ready: false, replay: [], evidence: [] });
  }

  const result = session.result as {
    replay?: unknown[];
    evidence?: { key: string; kind: string; quote?: string; interpretation: { bn: string; en: string }; weight: string; source: string }[];
    riskCategory?: string;
    summary?: { bn: string; en: string };
  };

  return ok({
    id: session.id,
    ready: true,
    riskCategory: result.riskCategory,
    summary: result.summary,
    replay: result.replay ?? [],
    evidence: result.evidence ?? [],
  });
}
