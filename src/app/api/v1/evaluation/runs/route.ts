// GET  /api/v1/evaluation/runs — public read-only evaluation metrics.
//       Every metric shown anywhere in the product must be backed by one of
//       these rows; no credentials or prompts are exposed.
// POST /api/v1/evaluation/runs — analyst-authorized evaluation runner.
//       { mode: "rules" } runs the deterministic baseline (single request).
//       { mode: "ai", batchSize: n } runs the next batch of the model path
//       (repeat until done). Results are always honest, versioned records.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, requireAnalyst } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { runRulesBaseline, runModelBatch } from "@/lib/evaluation/runner";
import { SAMPLE_COUNT, DATASET_VERSION } from "@/lib/evaluation/dataset";
import { openRouterConfigured } from "@/lib/llm-gateway";

export async function GET() {
  const runs = await db.evaluationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { _count: { select: { items: true } } },
  });

  const precision = (tp: number, fp: number) => (tp + fp === 0 ? null : tp / (tp + fp));
  const recall = (tp: number, fn: number) => (tp + fn === 0 ? null : tp / (tp + fn));
  const fpr = (fp: number, tn: number) => (fp + tn === 0 ? null : fp / (fp + tn));

  return ok({
    dataset: { version: DATASET_VERSION, sampleCount: SAMPLE_COUNT },
    openRouterConfigured: openRouterConfigured(),
    runs: runs.map((r) => ({
      runId: r.runId,
      kind: r.kind,
      subject: r.subject,
      servingProvider: r.servingProvider,
      datasetVersion: r.datasetVersion,
      datasetHash: r.datasetHash,
      sampleCount: r.sampleCount,
      itemsRecorded: r._count.items,
      completed: r.completedAt !== null,
      decided: r.decided,
      abstained: r.abstained,
      ambiguousHeld: r.ambiguousHeld,
      tp: r.tp,
      fp: r.fp,
      fn: r.fn,
      tn: r.tn,
      precision: precision(r.tp, r.fp),
      recall: recall(r.tp, r.fn),
      falsePositiveRate: fpr(r.fp, r.tn),
      coverage:
        r.tp + r.fp + r.fn + r.tn + r.abstained === 0
          ? null
          : (r.tp + r.fp + r.fn + r.tn) / Math.max(1, r.tp + r.fp + r.fn + r.tn + r.abstained),
      schemaFailures: r.schemaFailures,
      requestFailures: r.requestFailures,
      p50LatencyMs: r.p50LatencyMs,
      p95LatencyMs: r.p95LatencyMs,
      costUsd: r.costUsd,
      costBasis: r.costBasis,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  });
}

const RunBody = z.object({
  mode: z.enum(["rules", "ai"]),
  batchSize: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAnalyst();
  if (!auth.session) return auth.response;

  const rl = rateLimit(clientKey(req, "evaluation-run"), 5, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "Too many evaluation runs. Wait a few minutes.", 429);

  const body = await readJson<unknown>(req, 4 * 1024);
  const parsed = RunBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "mode must be 'rules' or 'ai'.", 422);

  if (parsed.data.mode === "rules") {
    const runId = await runRulesBaseline();
    return ok({ runId, mode: "rules", done: true });
  }
  const progress = await runModelBatch(parsed.data.batchSize ?? 3);
  return ok({ mode: "ai", ...progress });
}
