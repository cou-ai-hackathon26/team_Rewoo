// POST /api/v1/analyses/{id}/cancel — cancel a processing/awaiting session.
// Ownership enforced server-side via the signed guest cookie. Lands in a
// terminal "canceled" state; the pipeline checks between stages and stops,
// and the claim-guarded persist step can never resurrect a canceled case.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireCaseOwner } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const CASE_ID_RX = /^BS-[A-Z0-9]{8}$/;

const CANCELABLE = new Set(["awaiting_input", "awaiting_review", "processing"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CASE_ID_RX.test(id)) return fail("invalid-id", "ভুল কেস আইডি।", 400);

  const rl = rateLimit(clientKey(req, `case-cancel:${id}`), 10, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ। কিছুক্ষণ পরে চেষ্টা করুন।", 429);

  const session = await db.analysisSession.findUnique({ where: { id } });
  if (!session || session.deletedAt) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  // V7 owner guard: signed guest cookie (never the legacy header alone).
  const auth = requireCaseOwner(req, session);
  if (!auth.ok) return auth.response;

  if (!CANCELABLE.has(session.status)) {
    return fail("not-cancelable", "কেসটি আগেই শেষ হয়ে গেছে — বাতিল করা যাবে না।", 409, {
      currentStatus: session.status,
    });
  }

  await db.analysisSession.update({
    where: { id },
    data: { status: "canceled", stage: null, error: null, completedAt: new Date() },
  });
  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      action: "analysis.canceled",
      entityType: "AnalysisSession",
      entityId: id,
      detail: { by: "guest-cookie" } as unknown as object,
    },
  });

  return ok({ id, status: "canceled" });
}
