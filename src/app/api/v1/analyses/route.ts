// POST /api/v1/analyses — create an analysis session (no account required)
// GET  /api/v1/analyses — list the caller's own sessions (privacy view)
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newCaseId } from "@/lib/crypto";
import { ok, fail, guest, okForGuest, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const CreateBody = z.object({
  modality: z.enum(["voice", "message", "image", "link"]),
  language: z.enum(["bn", "en"]).default("bn"),
  consentAnalysis: z.literal(true), // explicit consent to process content
  consentRetention: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "analyses"), 10, 10 * 60_000);
  if (!rl.ok)
    return fail(
      "rate-limited",
      "অনেক বেশি অনুরোধ এসেছে, কিছুক্ষণ পরে চেষ্টা করুন।",
      429,
      { retryAfterSec: rl.retryAfterSec }
    );

  // V7: server-issued signed guest identity (httpOnly cookie).
  const identity = guest(req);

  const body = await readJson<unknown>(req, 64 * 1024);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return okForGuest(identity, { error: { code: "invalid-input", message: "অনুরোধটি গ্রহণযোগ্য নয়। সম্মতিসহ আবার চেষ্টা করুন।" } }, { status: 422 });
  }

  const id = newCaseId();
  const now = new Date();
  await db.analysisSession.create({
    data: {
      id,
      visitorId: identity.id,
      modality: parsed.data.modality,
      language: parsed.data.language,
      status: "awaiting_input",
      stage: "created",
      // Retention clock starts at creation and is enforced by the expiry sweep.
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await db.consentRecord.create({
    data: {
      sessionId: id,
      purpose: "analysis",
      granted: true,
    },
  });
  if (parsed.data.consentRetention) {
    await db.consentRecord.create({
      data: { sessionId: id, purpose: "retention", granted: true },
    });
  }

  return okForGuest(identity, { id, status: "awaiting_input" }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const identity = guest(req);
  const sessions = await db.analysisSession.findMany({
    where: { visitorId: identity.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { report: { select: { id: true, status: true } } },
  });

  return okForGuest(identity, {
    sessions: sessions.map((s) => ({
      id: s.id,
      modality: s.modality,
      status: s.status,
      riskCategory: s.riskCategory,
      scamCategory: s.scamCategory,
      engine: s.engine,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      hasReport: Boolean(s.report),
      reportStatus: s.report?.status ?? null,
    })),
  });
}
