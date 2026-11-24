// ---------------------------------------------------------------------------
// Analysis pipeline (deterministic orchestration) — V7.
// validate → redact → heuristics → LLM analyst → Safety Gate → persist.
// Updates session.stage in the DB so the UI can show REAL progress.
//
// V7 durability model:
//   - Job CLAIMS: every run atomically claims the session row
//     (jobClaimToken + jobAttempts). A surviving in-process promise is an
//     optimization, never the source of truth.
//   - Terminal-state race protection: the final persist is a conditional
//     update (status=processing AND claim held). A canceled/deleted case can
//     never be resurrected by a late provider return.
//   - Recovery: pendingInput (already redacted) is persisted at dispatch; a
//     stale "processing" session with attempts left is re-claimed and
//     re-dispatched by the poll path (client polls drive recovery — the
//     documented pattern for serverless without a separate worker).
//   - Retention: expiresAt is enforced by sweepExpiredSessions on reads.
// ---------------------------------------------------------------------------

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { redactPII } from "@/lib/redact";
import { detectScamIndicators } from "@/lib/heuristics";
import { runAnalystAgent } from "@/lib/agent";
import { runSafetyGate, GateError, REC_TEMPLATES } from "@/lib/safety-gate";
import { buildFallbackResult } from "@/lib/fallback";
import { buildGraph } from "@/lib/graph";
import type {
  AgentEvent,
  AnalysisResultV3,
  Bilingual,
  Evidence,
  Modality,
  PipelineStage,
} from "@/lib/types";
import { LIMIT_FALLBACK_NOTES } from "@/lib/pipeline-constants";

/** Lightweight activity recorder shared by all pipeline runs. */
class ActivityLog {
  private events: AgentEvent[] = [];
  private t0 = Date.now();
  private lastT = Date.now();
  constructor() {
    this.push("input.accepted", { bn: "ইনপুট গৃহীত", en: "Input accepted" });
  }
  push(event: string, label: Bilingual, outcome?: AgentEvent["outcome"], detail?: string) {
    const now = Date.now();
    this.events.push({
      event,
      label,
      t: new Date(now).toISOString(),
      ms: now - this.lastT,
      ...(outcome ? { outcome } : {}),
      ...(detail ? { detail } : {}),
    });
    this.lastT = now;
  }
  finish(event = "result.generated", mode: string) {
    const now = Date.now();
    this.events.push({
      event,
      label: { bn: "ফলাফল তৈরি সম্পন্ন", en: "Result generated" },
      t: new Date(now).toISOString(),
      ms: now - this.lastT,
      outcome: "ok" as const,
      detail: mode,
    });
    this.lastT = now;
  }
  get list(): AgentEvent[] {
    return this.events;
  }
  get totalMs(): number {
    return this.lastT - this.t0;
  }
}

/**
 * Claim-guarded stage update. If the claim was lost (canceled / deleted /
 * superseded by a recovery attempt) this throws PipelineCanceledError so the
 * stale attempt stops immediately instead of writing over a terminal state.
 */
async function setStage(
  sessionId: string,
  claimToken: string,
  stage: PipelineStage,
  patch: Record<string, unknown> = {}
) {
  const res = await db.analysisSession.updateMany({
    where: { id: sessionId, status: "processing", jobClaimToken: claimToken },
    data: { stage, ...patch },
  });
  if (res.count === 0) throw new PipelineCanceledError();
}

async function claimHeld(sessionId: string, claimToken: string): Promise<boolean> {
  const s = await db.analysisSession.findUnique({
    where: { id: sessionId },
    select: { status: true, jobClaimToken: true },
  });
  return s?.status === "processing" && s.jobClaimToken === claimToken;
}

export interface RunPipelineArgs {
  sessionId: string;
  modality: Modality;
  /** Redacted text under review (already privacy-scrubbed). */
  redactedText: string;
  /** Raw URL for link modality (never visited). */
  url?: string;
  /** Sanitized visual observations from VLM (image modality). */
  visualNotes?: string[];
  /** OFFLINE_DEMO preset runs skip the AI call and are labeled synthetic. */
  demo?: boolean;
  detectedLanguage?: "bn" | "en" | "mixed" | "unknown";
}

export class PipelineCanceledError extends Error {
  constructor() {
    super("canceled");
  }
}

export async function runAnalysisPipeline(args: RunPipelineArgs & { claimToken: string }): Promise<AnalysisResultV3> {
  const { sessionId, modality, claimToken } = args;
  const activity = new ActivityLog();

  await setStage(sessionId, claimToken, "validating", { status: "processing" });
  if (!args.redactedText.trim() && !args.url) {
    throw new PipelineError("empty-input", "No analyzable content was provided.");
  }

  // Re-run redaction as defence in depth (input should already be redacted).
  await setStage(sessionId, claimToken, "redacting");
  const { text: redactedText } = redactPII(args.redactedText);
  activity.push("privacy.redaction", { bn: "গোপনীয় তথ্য আড়ালীকরণ সম্পন্ন", en: "Redaction completed" });

  await setStage(sessionId, claimToken, "detecting");
  const heuristic = detectScamIndicators(redactedText, args.url, modality);
  const evidence: Evidence[] = heuristic.evidence;
  activity.push("rules.evaluated", { bn: "নিরাধারণী নিয়ম মূল্যায়ন সম্পন্ন", en: "Deterministic rules evaluated" }, "ok", `${evidence.length} সূচক`);

  if (!(await claimHeld(sessionId, claimToken))) throw new PipelineCanceledError();

  // ---- AI analyst attempt (max 2 tries, bounded timeout) -----------------
  let result: AnalysisResultV3 | null = null;
  let gateFeedback: string | undefined;
  let lastGateIssues: string[] = [];
  let providerFailed = false;

  if (args.demo) {
    // OFFLINE_DEMO: deterministic, clearly labeled, no AI call at all.
    activity.push("ai.provider", { bn: "এআই প্রদানকারী", en: "AI provider" }, "skipped", "OFFLINE_DEMO");
    result = buildFallbackResult({
      caseId: sessionId,
      modality,
      riskCategory: heuristic.riskCategory,
      scamCategory: heuristic.scamCategory,
      evidence,
      reason: "offline-demo",
      startedAt: Date.now() - activity.totalMs,
      detectedLanguage: args.detectedLanguage,
    });
  } else {
    await setStage(sessionId, claimToken, "ai_analyzing");
    const aiStart = Date.now();
    // F-10 heartbeat: live AI calls run for minutes with no DB writes, which
    // made a healthy run look "stale" to polls landing on other serverless
    // instances (updatedAt went quiet) — those polls re-claimed and re-ran the
    // case while the original was still working, and the collision surfaced
    // to users as "recovery-failed". This claim-guarded beat refreshes
    // jobClaimedAt every 30s so staleness detection (which now also checks
    // claim age) can only ever fire for genuinely dead runs.
    const beat = setInterval(() => {
      void db.analysisSession
        .updateMany({
          where: { id: sessionId, status: "processing", jobClaimToken: claimToken },
          data: { jobClaimedAt: new Date() },
        })
        .catch(() => {
          /* best-effort beat — the claim guards below handle real loss */
        });
    }, 30_000);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await runAnalystAgent(
          {
            evidence,
            redactedText,
            modality,
            urlHost: heuristic.urlAssessment?.host,
            visualNotes: args.visualNotes,
          },
          gateFeedback
        );
        if (!outcome.ok) {
          providerFailed = true;
          activity.push("ai.provider", { bn: "এআই প্রদানকারী", en: "AI provider" }, "failed", `${outcome.error ?? "failed"} · ${outcome.servedBy ?? "unknown"}${outcome.model ? ` · ${outcome.model}` : ""}`);
          break;
        }
        if (attempt > 0) {
          activity.push("ai.provider", { bn: "এআই প্রদানকারী (পুনঃচেষ্টা সফল)", en: "AI provider (retry succeeded)" }, "ok", `LIVE_AI, attempt ${attempt + 1}`);
        }
        await setStage(sessionId, claimToken, "safety_gate");
        try {
          const payload = runSafetyGate(outcome.payload, { evidence, modality });
          activity.push("ai.provider", { bn: "এআই বিশ্লেষণ সম্পন্ন", en: "AI analysis completed" }, "ok", `LIVE_AI · ${outcome.servedBy ?? "?"}${outcome.model ? `/${outcome.model}` : ""} · ${Date.now() - aiStart}ms${outcome.fallbackUsed ? " · fallback-model" : ""}`);
          activity.push("safety.validation", { bn: "নিরাপত্তা যাচাই সম্পন্ন", en: "Safety validation completed" });
          result = assembleResult(sessionId, modality, payload, evidence, heuristic.urlAssessment?.host, activity, args.detectedLanguage);
          break;
        } catch (err) {
          if (err instanceof GateError) {
            lastGateIssues = err.issues;
            gateFeedback = err.issues.join("; ");
            activity.push("safety.validation", { bn: "নিরাপত্তা যাচাই প্রত্যাখ্যাত", en: "Safety validation rejected" }, "failed", err.issues.join("; "));
            continue; // retry once with feedback
          }
          providerFailed = true;
          break;
        }
      }
    } finally {
      clearInterval(beat);
    }
  }

  if (!(await claimHeld(sessionId, claimToken))) throw new PipelineCanceledError();

  if (!result) {
    // Deterministic, honestly-labeled fallback — never fake AI output.
    const reason = providerFailed ? "provider-unavailable" : "gate-rejected";
    if (providerFailed) {
      activity.push("safety.validation", { bn: "নিরাপত্তা যাচাই সম্পন্ন (নিয়মভিত্তিক পথ)", en: "Safety validation completed (rule path)" });
    }
    result = buildFallbackResult({
      caseId: sessionId,
      modality,
      riskCategory: heuristic.riskCategory,
      scamCategory: heuristic.scamCategory,
      evidence,
      reason,
      startedAt: Date.now() - activity.totalMs,
      detectedLanguage: args.detectedLanguage,
    });
    // Merge real activity into the fallback result (keep genuine timing).
    result = { ...result, agentEvents: activity.list };
  }

  // ---- Persist (claim-guarded: a canceled/deleted case can never be
  // resurrected by a late provider return or a superseded attempt) --------
  const persisted = await db.analysisSession.updateMany({
    where: { id: sessionId, status: "processing", jobClaimToken: claimToken, deletedAt: null },
    data: {
      status: "completed",
      stage: "completed",
      engine: result.engine,
      riskCategory: result.riskCategory,
      scamCategory: result.scamCategory,
      result: result as unknown as object,
      extractedText: redactedText.slice(0, 8000),
      completedAt: new Date(),
      error: null,
      pendingInput: Prisma.DbNull, // terminal state — recovery payload no longer needed
    },
  });
  if (persisted.count === 0) throw new PipelineCanceledError();

  // Persist evidence items (sanitized quotes only) — claim still held here.
  await db.evidenceItem.deleteMany({ where: { sessionId } });
  for (const e of result.evidence) {
    await db.evidenceItem.create({
      data: {
        sessionId,
        key: e.key,
        kind: e.kind,
        quote: e.quote?.slice(0, 400) ?? null,
        interpretation: e.interpretation as unknown as object,
        tactic: e.tactic ?? null,
        source: e.source,
        weight: e.weight,
      },
    });
  }

  await db.auditEvent.create({
    data: {
      actorType: "system",
      action: "analysis.completed",
      entityType: "AnalysisSession",
      entityId: sessionId,
      detail: {
        engine: result.engine,
        analysisMode: result.analysisMode,
        risk: result.riskCategory,
        category: result.scamCategory,
        gateIssues: lastGateIssues.length ? lastGateIssues : undefined,
      } as unknown as object,
    },
  });

  return result;
}

function assembleResult(
  caseId: string,
  modality: Modality,
  payload: ReturnType<typeof runSafetyGate>,
  evidence: Evidence[],
  urlHost: string | undefined,
  activity: ActivityLog,
  detectedLanguage: "bn" | "en" | "mixed" | "unknown" = "bn"
): AnalysisResultV3 {
  const limitations = [...LIMIT_FALLBACK_NOTES];
  if (modality === "link") {
    limitations.push({
      bn: "লিংকটি স্বয়ংক্রিয়ভাবে খোলা হয়নি — ঠিকানার কাঠামো থেকে প্রাপ্ত সিদ্ধান্ত, গন্তব্য পৃষ্ঠার বাস্তব অবস্থা নয়।",
      en: "The link was never opened — findings come from the address structure, not the destination page.",
    });
  }
  if (modality === "image") {
    limitations.push({
      bn: "ছবিটি আসল নাকি ছেঁড়া-পাল্টানো (সিন্থেটিক/ম্যানিপুলেটেড) তা যাচাই করার কোনো প্রমাণিত ফরেনসিক পরীক্ষা এই প্রবাহে নেই — ফলাফল শুধুমাত্র ছবিতে লেখা কনটেন্টের প্রতারণা-ঝুঁকির সিদ্ধান্ত। ছবির সত্যতা নিয়ে কোনো দাবি করা হয়নি।",
      en: "No validated image-authenticity (synthetic/manipulation) detector runs in this flow — the result is a scam-risk judgment of the text content only. No claim is made about whether the image itself is genuine.",
    });
  }
  const resources = Array.from(
    new Set(payload.recommendations.flatMap((r) => REC_TEMPLATES[r.templateId]?.resourceKeys ?? []))
  );

  // Immediate action = the highest-priority "now" recommendation (first wins).
  const nowRec = payload.recommendations.find((r) => r.priority === "now") ?? payload.recommendations[0];
  const immediateAction = nowRec
    ? { ...nowRec, id: "R0" }
    : {
        id: "R0",
        templateId: "T_STAY_ALERT",
        title: REC_TEMPLATES.T_STAY_ALERT.title,
        detail: REC_TEMPLATES.T_STAY_ALERT.detail,
        priority: "know" as const,
      };

  return {
    schemaVersion: 3,
    caseId,
    modality,
    analysisMode: "LIVE_AI",
    engine: "ai_assisted",
    inputType: modality,
    detectedLanguage,
    generatedAt: new Date().toISOString(),
    riskCategory: payload.riskCategory,
    scamCategory: payload.scamCategory,
    summary: payload.summary,
    why: payload.why,
    immediateAction,
    evidence,
    unknowns: payload.unknowns,
    recommendations: payload.recommendations,
    replay: payload.replay,
    graph: buildGraph(payload.replay),
    agentEvents: activity.list,
    limitations,
    policy: {
      validated: true,
      checks: ["schema", "template-whitelist", "evidence-grounding", "forbidden-content", "no-contact-leak"],
    },
    resources,
  };
}

export class PipelineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Durable background execution — claim, dispatch, recovery, retention
// ---------------------------------------------------------------------------

/** Sessions currently executing in this process (fast double-submit guard). */
const running = new Set<string>();

const STALE_PROCESSING_MS = 120_000;
const MAX_JOB_ATTEMPTS = 2;

interface PendingInput {
  modality: Modality;
  redactedText: string;
  url?: string;
  visualNotes?: string[];
  demo?: boolean;
}

/**
 * Atomically claim a session awaiting execution and dispatch the pipeline.
 * The claim (updateMany with status preconditions) is the single source of
 * truth: a second dispatcher — same process or another server instance —
 * cannot claim an already-claimed case. pendingInput (redacted) is persisted
 * so a crashed run can be recovered by `failIfStaleProcessing`.
 */
export function runPipelineInBackground(args: RunPipelineArgs): void {
  if (running.has(args.sessionId)) return;
  running.add(args.sessionId);
  const claimToken = randomUUID();
  const pending: PendingInput = {
    modality: args.modality,
    redactedText: args.redactedText.slice(0, 8000),
    ...(args.url ? { url: args.url } : {}),
    ...(args.visualNotes ? { visualNotes: args.visualNotes } : {}),
    ...(args.demo !== undefined ? { demo: args.demo } : {}),
  };
  const task = (async () => {
    try {
      const claim = await db.analysisSession.updateMany({
        where: { id: args.sessionId, deletedAt: null, status: { in: ["awaiting_input", "awaiting_review"] } },
        data: {
          status: "processing",
          stage: "validating",
          jobClaimToken: claimToken,
          jobClaimedAt: new Date(),
          jobAttempts: { increment: 1 },
          pendingInput: pending as unknown as object,
        },
      });
      if (claim.count === 0) return; // already running or terminal — idempotent no-op
      await runAnalysisPipeline({ ...args, claimToken });
    } catch (err) {
      const canceled = err instanceof PipelineCanceledError;
      const reason = canceled ? "canceled-by-user" : err instanceof PipelineError ? err.code : "pipeline-failure";
      try {
        // Best-effort terminal failure record — also claim-guarded so a
        // canceled case keeps its honest canceled status.
        await db.analysisSession.updateMany({
          where: { id: args.sessionId, status: "processing", jobClaimToken: claimToken },
          data: {
            status: canceled ? "canceled" : "failed",
            stage: null,
            error: reason,
            pendingInput: Prisma.DbNull,
            ...(canceled ? { completedAt: new Date() } : {}),
          },
        });
        await db.auditEvent.create({
          data: {
            actorType: "system",
            action: canceled ? "analysis.canceled" : "analysis.failed",
            entityType: "AnalysisSession",
            entityId: args.sessionId,
            detail: { reason } as unknown as object,
          },
        });
      } catch {
        /* best-effort persistence */
      }
    } finally {
      running.delete(args.sessionId);
    }
  })();

  // Serverless keep-alive (V8): on Vercel the function would otherwise freeze
  // the moment the HTTP response is sent, suspending this background work
  // mid-flight (clients saw "processing" forever). waitUntil() keeps the
  // invocation alive until the pipeline settles. Outside Vercel it is a
  // graceful no-op and the promise runs as plain fire-and-forget.
  try {
    waitUntil(task);
  } catch {
    /* not in a Vercel context — the promise is already running */
  }
}

/**
 * Stale-processing recovery, driven by the poll path (GET /analyses/{id} and
 * /status). If a session claims "processing" but nothing has progressed for
 * STALE_PROCESSING_MS and this process is not running it:
 *   - attempts left and a persisted pendingInput → re-claim + re-dispatch
 *     (durable recovery; works across server restarts and instances);
 *   - otherwise → honest terminal "failed" (never an eternal spinner).
 *
 * F-10: staleness now requires the CLAIM to be old (jobClaimedAt), not just
 * updatedAt. The pipeline heartbeats jobClaimedAt every 30s during multi-
 * minute AI calls, so a healthy run on another serverless instance can never
 * be mistaken for a dead one (which previously caused a duplicate re-run,
 * superseded writes and spurious "recovery-failed" outcomes).
 */
export async function failIfStaleProcessing(session: {
  id: string;
  status: string;
  updatedAt: Date;
  jobClaimedAt: Date | null;
  jobAttempts: number;
  pendingInput: unknown;
}): Promise<boolean> {
  if (session.status !== "processing") return false;
  if (Date.now() - session.updatedAt.getTime() < STALE_PROCESSING_MS) return false;
  // Claim must ALSO be quiet past the stale window — the heartbeat keeps a
  // live run's claim fresh even while updatedAt rests between stage changes.
  if (session.jobClaimedAt && Date.now() - session.jobClaimedAt.getTime() < STALE_PROCESSING_MS) return false;
  if (running.has(session.id)) return false;

  // Recovery path: bounded re-dispatch from the persisted (redacted) input.
  const attempts = session.jobAttempts ?? 0;
  const pending = session.pendingInput as PendingInput | null;
  if (attempts < MAX_JOB_ATTEMPTS && pending && pending.redactedText) {
    const newToken = randomUUID();
    // Atomic guard: only take the case from a worker whose claim is genuinely
    // stale (or was never claimed — legacy rows). A heartbeating worker can
    // never lose its claim this way, even across instances.
    const claimCutoff = new Date(Date.now() - STALE_PROCESSING_MS);
    const reclaim = await db.analysisSession.updateMany({
      where: {
        id: session.id,
        status: "processing",
        deletedAt: null,
        OR: [{ jobClaimedAt: { lt: claimCutoff } }, { jobClaimedAt: null }],
      },
      data: {
        jobClaimToken: newToken,
        jobClaimedAt: new Date(),
        jobAttempts: { increment: 1 },
        stage: "validating",
        error: null,
      },
    });
    if (reclaim.count === 0) return false; // another worker recovered it first
    await db.auditEvent.create({
      data: {
        actorType: "system",
        action: "analysis.recovered",
        entityType: "AnalysisSession",
        entityId: session.id,
        detail: { attempt: attempts + 1 } as unknown as object,
      },
    });
    running.add(session.id);
    // waitUntil (F-10): on serverless the recovered pipeline must outlive the
    // poll response that spawned it, or it gets frozen mid-run.
    const recovery = (async () => {
      try {
        await runAnalysisPipeline({
          sessionId: session.id,
          modality: pending.modality,
          redactedText: pending.redactedText,
          ...(pending.url ? { url: pending.url } : {}),
          ...(pending.visualNotes ? { visualNotes: pending.visualNotes } : {}),
          ...(pending.demo !== undefined ? { demo: pending.demo } : {}),
          claimToken: newToken,
        });
      } catch {
        try {
          await db.analysisSession.updateMany({
            where: { id: session.id, status: "processing", jobClaimToken: newToken },
            data: { status: "failed", stage: null, error: "recovery-failed", pendingInput: Prisma.DbNull },
          });
        } catch {
          /* best-effort */
        }
      } finally {
        running.delete(session.id);
      }
    })();
    try {
      waitUntil(recovery);
    } catch {
      /* not in a Vercel context — the promise is already running */
    }
    return false; // still processing (recovered) — the caller keeps polling
  }

  try {
    await db.analysisSession.updateMany({
      where: { id: session.id, status: "processing" },
      data: { status: "failed", stage: null, error: "pipeline-stalled", pendingInput: Prisma.DbNull },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Retention expiry sweep — retentionDays is a promise, not a schema comment.
 * Expired sessions are scrubbed (result/extractedText/evidence cleared) and
 * land in a terminal "expired" state. Called opportunistically on case reads.
 */
export async function sweepExpiredSessions(): Promise<number> {
  try {
    const expired = await db.analysisSession.findMany({
      where: { deletedAt: null, expiresAt: { lt: new Date() } },
      select: { id: true },
      take: 100,
    });
    if (expired.length === 0) return 0;
    const ids = expired.map((s) => s.id);
    await db.evidenceItem.deleteMany({ where: { sessionId: { in: ids } } });
    await db.analysisSession.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: {
        deletedAt: new Date(),
        status: "expired",
        stage: null,
        result: Prisma.DbNull,
        extractedText: null,
        pendingInput: Prisma.DbNull,
      },
    });
    await db.auditEvent.create({
      data: {
        actorType: "system",
        action: "analysis.retention-expired",
        entityType: "AnalysisSession",
        entityId: ids[0],
        detail: { count: ids.length } as unknown as object,
      },
    });
    return ids.length;
  } catch {
    return 0;
  }
}
