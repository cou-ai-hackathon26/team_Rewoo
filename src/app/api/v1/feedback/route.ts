// POST /api/v1/feedback — did the result help? (voluntary, minimal data)
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { redactPII } from "@/lib/redact";

const FeedbackBody = z.object({
  sessionId: z.string().regex(/^BS-[A-Z0-9]{8}$/),
  helpful: z.boolean(),
  followed: z.boolean().optional(),
  outcome: z.enum(["avoided", "lost_money", "shared_code", "reported", "unknown"]).optional(),
  comment: z.string().max(600).optional(),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "feedback"), 20, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const body = await readJson<unknown>(req, 16 * 1024);
  const parsed = FeedbackBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "মতামতের তথ্য গ্রহণযোগ্য নয়।", 422);

  const session = await db.analysisSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session) return fail("not-found", "কেসটি খুঁজে পাওয়া যায়নি।", 404);

  await db.feedback.create({
    data: {
      sessionId: parsed.data.sessionId,
      helpful: parsed.data.helpful,
      followed: parsed.data.followed,
      outcome: parsed.data.outcome,
      comment: parsed.data.comment ? redactPII(parsed.data.comment).text.slice(0, 600) : null,
    },
  });

  return ok({ received: true });
}
