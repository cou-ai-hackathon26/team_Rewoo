// ---------------------------------------------------------------------------
// Trust & Evaluation — runner.
//
// Executes the frozen benchmark against a subject and persists versioned,
// honest metrics. Subjects:
//   - "rules:v7"            : the deterministic heuristics baseline (instant)
//   - a model (via gateway)  : the production analysis path (gateway + safety
//                              gate), batched because of request time limits
//
// Scoring (binary, computed ONLY on scam/benign labels):
//   flagged  = predicted HIGH_RISK or CAUTION
//   clear    = predicted NO_RISK_INDICATORS
//   abstain  = predicted INSUFFICIENT_EVIDENCE (counted separately, never
//              silently dropped)
//   ambiguous-label samples are held out of binary scoring and reported as
//   ambiguousHeld.
// Denominators: precision=TP/(TP+FP); recall=TP/(TP+FN); FPR=FP/(FP+TN);
// coverage=decided/eligible. Latency percentiles over decided items.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { redactPII } from "@/lib/redact";
import { detectScamIndicators } from "@/lib/heuristics";
import { runAnalystAgent } from "@/lib/agent";
import { runSafetyGate, GateError } from "@/lib/safety-gate";
import { BENCH_SAMPLES, DATASET_VERSION, type BenchSample } from "./dataset";
import { ALPHABET } from "./ids";

export interface RunProgress {
  runId: string;
  processed: number;
  total: number;
  done: boolean;
}

function datasetHash(): string {
  return createHash("sha256").update(JSON.stringify(BENCH_SAMPLES)).digest("hex").slice(0, 16);
}

function newRunRef(): string {
  let out = "";
  const bytes = randomUUID().replace(/-/g, "");
  for (let i = 0; i < 8; i++) out += ALPHABET[parseInt(bytes[i], 16) % ALPHABET.length];
  return `EVAL-${out}`;
}

type Predicted = "HIGH_RISK" | "CAUTION" | "INSUFFICIENT_EVIDENCE" | "NO_RISK_INDICATORS" | null;

function scorePrediction(label: BenchSample["label"], predicted: Predicted, failure?: string) {
  if (failure) {
    return {
      predicted: null,
      correct: null as boolean | null,
      abstained: label !== "ambiguous" ? 1 : 0,
      failed: 1,
    };
  }
  if (!predicted) {
    return { predicted: null, correct: null as boolean | null, abstained: 0, failed: 1 };
  }
  if (label === "ambiguous") {
    return { predicted, correct: null as boolean | null, abstained: 0, failed: 0 };
  }
  const flagged = predicted === "HIGH_RISK" || predicted === "CAUTION";
  if (predicted === "INSUFFICIENT_EVIDENCE") {
    return { predicted, correct: null as boolean | null, abstained: 1, failed: 0 };
  }
  const correct = label === "scam" ? flagged : !flagged;
  return { predicted, correct, abstained: 0, failed: 0 };
}

function percentilize(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

/** Recompute aggregate metrics from stored items and update the run row. */
async function finalizeRun(runId: string) {
  const run = await db.evaluationRun.findUnique({ where: { runId }, include: { items: true } });
  if (!run) return;
  const items = run.items;
  let tp = 0, fp = 0, fn = 0, tn = 0, abstained = 0, ambiguousHeld = 0, decided = 0;
  const failures = { schema: 0, request: 0 };
  const latencies: number[] = [];
  for (const it of items) {
    if (it.label === "ambiguous") {
      ambiguousHeld++;
      continue;
    }
    if (it.failure && it.failure !== "none") {
      if (it.failure === "schema") failures.schema++;
      else failures.request++;
      abstained++;
      continue;
    }
    if (it.predicted === null || it.predicted === "INSUFFICIENT_EVIDENCE") {
      abstained++;
      continue;
    }
    decided++;
    latencies.push(it.latencyMs);
    const flagged = it.predicted === "HIGH_RISK" || it.predicted === "CAUTION";
    if (it.label === "scam") {
      if (flagged) tp++;
      else fn++;
    } else {
      if (flagged) fp++;
      else tn++;
    }
  }
  const done = items.length >= run.sampleCount;
  await db.evaluationRun.update({
    where: { runId },
    data: {
      decided,
      abstained,
      tp,
      fp,
      fn,
      tn,
      ambiguousHeld,
      schemaFailures: failures.schema,
      requestFailures: failures.request,
      p50LatencyMs: percentilize(latencies, 50),
      p95LatencyMs: percentilize(latencies, 95),
      ...(done ? { completedAt: new Date() } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Rules baseline — full dataset, single call, deterministic.
// ---------------------------------------------------------------------------

export async function runRulesBaseline(): Promise<string> {
  const runId = newRunRef();
  const run = await db.evaluationRun.create({
    data: {
      runId,
      kind: "rules-baseline",
      subject: "rules:v7",
      datasetVersion: DATASET_VERSION,
      datasetHash: datasetHash(),
      sampleCount: BENCH_SAMPLES.length,
      startedAt: new Date(),
    },
  });
  for (const sample of BENCH_SAMPLES) {
    const started = Date.now();
    const { text } = redactPII(sample.text);
    const detected = detectScamIndicators(text, undefined, "message");
    const latencyMs = Date.now() - started;
    const s = scorePrediction(sample.label, detected.riskCategory as Predicted);
    await db.evaluationItem.create({
      data: {
        runId: run.id,
        sampleId: sample.id,
        language: sample.language,
        label: sample.label,
        subtype: sample.subtype,
        predicted: s.predicted,
        correct: s.correct,
        latencyMs,
        failure: "none",
      },
    });
  }
  await finalizeRun(runId);
  return runId;
}

// ---------------------------------------------------------------------------
// Model run — the production analysis path (gateway + safety gate), batched.
// ---------------------------------------------------------------------------

export async function runModelBatch(batchSize: number): Promise<RunProgress> {
  // Continue the newest incomplete model run, or start a fresh one.
  let run = await db.evaluationRun.findFirst({
    where: { kind: { in: ["model-primary", "model-fallback"] }, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!run) {
    const runId = newRunRef();
    run = await db.evaluationRun.create({
      data: {
        runId,
        kind: "model-primary",
        // Subject recorded honestly once the first item resolves; before that
        // the gateway has not reported a model.
        subject: "pending-first-result",
        datasetVersion: DATASET_VERSION,
        datasetHash: datasetHash(),
        sampleCount: BENCH_SAMPLES.length,
        startedAt: new Date(),
      },
    });
  }

  const existing = new Set(
    (await db.evaluationItem.findMany({ where: { runId: run.id }, select: { sampleId: true } })).map((i) => i.sampleId)
  );
  const pending = BENCH_SAMPLES.filter((s) => !existing.has(s.id)).slice(0, Math.max(1, Math.min(batchSize, 10)));

  for (const sample of pending) {
    const started = Date.now();
    const { text } = redactPII(sample.text);
    const detected = detectScamIndicators(text, undefined, "message");
    const outcome = await runAnalystAgent({
      evidence: detected.evidence,
      redactedText: text,
      modality: "message",
    });
    const latencyMs = Date.now() - started;

    let predicted: Predicted = null;
    let failure: string | null = null;
    if (!outcome.ok) {
      failure = "request";
      predicted = null;
    } else {
      try {
        const payload = runSafetyGate(outcome.payload, { evidence: detected.evidence, modality: "message" });
        predicted = payload.riskCategory as Predicted;
      } catch (err) {
        failure = err instanceof GateError ? "schema" : "request";
      }
    }

    // Record the actual serving model once, honestly (fallbacks included).
    if (run.subject === "pending-first-result" && outcome.model) {
      await db.evaluationRun.update({
        where: { runId: run.runId },
        data: {
          subject: outcome.model,
          servingProvider: outcome.servedBy ?? undefined,
          ...(outcome.fallbackUsed ? { kind: "model-fallback" } : {}),
        },
      });
      run.subject = outcome.model;
    }

    const s = scorePrediction(sample.label, predicted, failure ?? undefined);
    await db.evaluationItem.create({
      data: {
        runId: run.id,
        sampleId: sample.id,
        language: sample.language,
        label: sample.label,
        subtype: sample.subtype,
        predicted: s.predicted,
        correct: s.correct,
        latencyMs,
        failure: failure ?? "none",
      },
    });
  }

  await finalizeRun(run.runId);
  const total = await db.evaluationItem.count({ where: { runId: run.id } });
  return {
    runId: run.runId,
    processed: total,
    total: BENCH_SAMPLES.length,
    done: total >= BENCH_SAMPLES.length,
  };
}
