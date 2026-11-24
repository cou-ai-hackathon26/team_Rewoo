// GET /api/v1/health — system health & readiness (no sensitive details).
// V7: also reports which LLM gateway is CONFIGURED (never the key), and runs
// the opportunistic retention sweep so expired cases are enforced by traffic.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { openRouterConfigured } from "@/lib/llm-gateway";
import { sweepExpiredSessions } from "@/lib/pipeline";

export async function GET(_req: NextRequest) {
  const started = Date.now();
  let dbOk = false;
  try {
    await db.verifiedResource.count({ where: { active: true } });
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // Opportunistic retention enforcement (best-effort, never fails health).
  let expired = 0;
  if (dbOk) {
    try {
      expired = await sweepExpiredSessions();
    } catch {
      expired = 0;
    }
  }

  // F-09 fix (V8): a degraded backend must fail HTTP monitoring honestly —
  // 503 when the database is down, 200 only when ready to serve.
  if (!dbOk) {
    return ok(
      {
        status: "degraded",
        checks: {
          database: "fail",
          llmGateway: openRouterConfigured() ? "openrouter" : "sandbox-provider",
          aiProvider: "per-case",
        },
        retention: { expiredSwept: 0 },
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  return ok({
    status: dbOk ? "ok" : "degraded",
    checks: {
      database: dbOk ? "ok" : "fail",
      // The configured gateway is reported (config only, no probing, no
      // secrets); the live model path is exercised per-analysis and honestly
      // labeled on failure.
      llmGateway: openRouterConfigured() ? "openrouter" : "sandbox-provider",
      // AI provider is never probed here (no cost / no secrets).
      aiProvider: "per-case",
    },
    retention: { expiredSwept: expired },
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  });
}
