// GET/POST /api/v1/learn/progress — anonymous lesson progress (learner token)
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const ProgressBody = z.object({
  learnerToken: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  lessonId: z.string().min(2).max(60),
  score: z.number().int().min(0).max(100),
  total: z.number().int().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "learn"), 60, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const body = await readJson<unknown>(req, 8 * 1024);
  const parsed = ProgressBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "প্রগ্রেস ডেটা গ্রহণযোগ্য নয়।", 422);

  await db.learningProgress.upsert({
    where: {
      learnerToken_lessonId: {
        learnerToken: parsed.data.learnerToken,
        lessonId: parsed.data.lessonId,
      },
    },
    create: {
      learnerToken: parsed.data.learnerToken,
      lessonId: parsed.data.lessonId,
      score: parsed.data.score,
      total: parsed.data.total,
    },
    update: {
      score: parsed.data.score,
      total: parsed.data.total,
      completedAt: new Date(),
    },
  });

  return ok({ saved: true });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("learnerToken");
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return ok({ progress: [] });
  }
  const rows = await db.learningProgress.findMany({ where: { learnerToken: token } });
  return ok({
    progress: rows.map((r) => ({
      lessonId: r.lessonId,
      score: r.score,
      total: r.total,
      completedAt: r.completedAt.toISOString(),
    })),
  });
}
