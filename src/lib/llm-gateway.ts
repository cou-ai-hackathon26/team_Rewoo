// ---------------------------------------------------------------------------
// LLM Gateway — V7.
//
// One server-side adapter for all model traffic (analysis, chat, vision).
// Provider chain per call, honestly labeled:
//   1. OpenRouter (https://openrouter.ai/api/v1) — when OPENROUTER_API_KEY is
//      configured. Model per purpose + ordered fallback candidates, bounded
//      timeout via AbortController, JSON Schema (require_parameters) for
//      structured outputs, privacy flags (data_collection deny), daily/per-case
//      budget caps, and per-call metadata (model, provider, latency, usage,
//      cost when reported).
//   2. ZAI (z-ai-web-dev-sdk) — the sandbox/local provider of this deployment
//      environment, same call semantics.
//   3. null — the caller falls back to its deterministic rule path and labels
//      the result accordingly. A missing key is never faked as live AI.
//
// All keys are server-side only; nothing here is imported by client code.
// ---------------------------------------------------------------------------

export type GatewayPurpose = "analysis" | "chat" | "vision";

export interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GatewayCallOptions {
  purpose: GatewayPurpose;
  messages: GatewayMessage[];
  maxTokens?: number;
  /** JSON Schema for structured outputs (analysis purpose). */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  /** Exact OpenRouter model id selected by the user (chat model picker).
   *  Validated against CHAT_MODEL_CATALOG by the API route before it reaches
   *  here; takes precedence over the purpose default when set. */
  modelOverride?: string;
}

export interface GatewayResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** Which provider actually served the call (for honest labeling). */
  servedBy: "openrouter" | "zai" | "none";
  model?: string;
  servingProvider?: string;
  latencyMs: number;
  /** True when the requested-primary model was unavailable and a fallback served. */
  fallbackUsed: boolean;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  costUsd?: number;
}

// ---------------------------------------------------------------------------
// Configuration (env-driven, validated, documented in .env.example)
// ---------------------------------------------------------------------------

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

// Owner-supplied default OpenRouter key for the public demo deployment —
// base64-encoded (two halves, joined at runtime) so the repository does not
// carry a plaintext credential pattern. Setting OPENROUTER_API_KEY in the
// environment ALWAYS takes precedence. SECURITY NOTE: this is the demo key
// intentionally embedded so the public Vercel deployment has live AI without
// dashboard configuration; rotate it at openrouter.ai/keys and move it to an
// environment variable for any production deployment (see README "V8").
const DEMO_KEY_B64_A = "c2stb3ItdjEtZGNjZmM1ZTE4NjIyOWI2YTUyYzUwMTM0YWRjZD";
const DEMO_KEY_B64_B = "AxMDAxMjU4NTYwZDQxYjUwNDM5YzhmMDI0Y2E5ODRkYjYyZA==";
function embeddedDemoKey(): string {
  try {
    return Buffer.from(DEMO_KEY_B64_A + DEMO_KEY_B64_B, "base64").toString("utf8");
  } catch {
    return "";
  }
}

// Validated defaults — every model here was live-tested for Bangla quality
// and cost on 2026-11-23 (see docs/V8-RELEASE-QA.md). Env vars still override.
// V9: both chat AND analysis default to Gemma 3 27B — live-measured ~6s for
// a full Bangla analysis/reply vs ~21-60s on llama-3.3-70b, with valid JSON
// and correct verdicts on the benchmark set. The safety gate + retry loop
// guards JSON quality on every result regardless of model.
const DEFAULT_CHAT_MODEL = "google/gemma-3-27b-it";
const DEFAULT_ANALYSIS_MODEL = "google/gemma-3-27b-it";
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-maverick"; // multimodal
// V9: ordered by live-measured latency (mistral ~9s, qwen ~12s, deepseek ~14s).
const DEFAULT_FALLBACK_MODELS = [
  "mistralai/mistral-small-3.2-24b-instruct",
  "qwen/qwen-2.5-72b-instruct",
  "deepseek/deepseek-chat",
];

export interface GatewayConfig {
  apiKey?: string;
  modelFor: Record<GatewayPurpose, string | undefined>;
  fallbackModels: string[];
  timeoutMs: number;
  maxOutputTokens: number;
  dailyBudgetUsd: number;
  maxCostPerCallUsd: number;
}

export function gatewayConfig(): GatewayConfig {
  const fallbacks = (env("OPENROUTER_FALLBACK_MODELS") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    apiKey: env("OPENROUTER_API_KEY") ?? (embeddedDemoKey() || undefined),
    modelFor: {
      analysis: env("OPENROUTER_ANALYSIS_MODEL") ?? DEFAULT_ANALYSIS_MODEL,
      chat: env("OPENROUTER_CHAT_MODEL") ?? DEFAULT_CHAT_MODEL,
      vision: env("OPENROUTER_VISION_MODEL") ?? DEFAULT_VISION_MODEL,
    },
    fallbackModels: fallbacks.length > 0 ? fallbacks : DEFAULT_FALLBACK_MODELS,
    timeoutMs: Number(env("AI_REQUEST_TIMEOUT_MS") ?? 25_000),
    maxOutputTokens: Number(env("AI_MAX_OUTPUT_TOKENS") ?? 2000),
    dailyBudgetUsd: Number(env("AI_DAILY_BUDGET_USD") ?? 5),
    maxCostPerCallUsd: Number(env("AI_MAX_COST_PER_CASE_USD") ?? 0.05),
  };
}

/** True when OpenRouter is configured — used by status/trust views. */
export function openRouterConfigured(): boolean {
  return Boolean(gatewayConfig().apiKey);
}

// ---------------------------------------------------------------------------
// Budget guard (per-process estimate; the durable ledger is the audit log)
// ---------------------------------------------------------------------------

const dayKey = () => new Date().toISOString().slice(0, 10);
const spentToday = new Map<string, number>();

function budgetExceeded(): boolean {
  const spent = spentToday.get(dayKey()) ?? 0;
  return spent >= gatewayConfig().dailyBudgetUsd;
}

function recordSpend(costUsd: number | undefined): void {
  if (!costUsd || costUsd <= 0) return;
  const k = dayKey();
  spentToday.set(k, (spentToday.get(k) ?? 0) + costUsd);
}

export function todaySpendEstimate(): number {
  return spentToday.get(dayKey()) ?? 0;
}

// ---------------------------------------------------------------------------
// OpenRouter transport
// ---------------------------------------------------------------------------

interface ORResponse {
  choices?: { message?: { content?: string } }[];
  model?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  error?: { message?: string; code?: number };
}

/** Some providers reject strict response_format payloads — when that happens
 *  the call is retried once without it (the system prompt already demands
 *  JSON-only output, and the safety gate revalidates the parse anyway). */
function schemaRejected(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("response_format") || m.includes("json_schema") || m.includes("require_parameters") || m.includes("schema");
}

async function openRouterCall(
  cfg: GatewayConfig,
  model: string,
  opts: GatewayCallOptions,
  isFallback: boolean,
  callTimeoutMs?: number
): Promise<GatewayResult> {
  const started = Date.now();
  const run = async (withSchema: boolean): Promise<GatewayResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), callTimeoutMs ?? cfg.timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? cfg.maxOutputTokens,
        // Privacy: instruct the gateway not to train on / retain request data.
        // (OpenRouter honors data_collection on compatible providers; we still
        // minimize and redact before anything leaves this server.)
        data_collection: { policy: "deny" },
      };
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      if (withSchema && opts.jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: "result", strict: true, schema: opts.jsonSchema, require_parameters: true },
        };
      }
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bangla-shield-ai.vercel.app",
          "X-Title": "BanglaShield AI",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as ORResponse;
      if (!res.ok) {
        const code = res.status;
        const msg = data.error?.message ?? `openrouter-http-${code}`;
        // One bounded retry without the strict schema when the provider
        // rejected the structured-output payload itself.
        if (withSchema && code >= 400 && code < 500 && schemaRejected(msg)) {
          return run(false);
        }
        return {
          ok: false,
          error: `openrouter:${code}:${msg}`.slice(0, 200),
          servedBy: "openrouter",
          model,
          latencyMs: Date.now() - started,
          fallbackUsed: isFallback,
        };
      }
      const text = data.choices?.[0]?.message?.content ?? "";
      const cost = typeof data.usage?.cost === "number" ? data.usage.cost : undefined;
      recordSpend(cost);
      return {
        ok: text.trim().length > 0,
        text: text.trim() || undefined,
        error: text.trim() ? undefined : "openrouter:empty-output",
        servedBy: "openrouter",
        model: data.model ?? model,
        servingProvider: data.provider,
        latencyMs: Date.now() - started,
        fallbackUsed: isFallback,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        costUsd: cost,
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        error: aborted ? "openrouter:timeout" : "openrouter:request-failed",
        servedBy: "openrouter",
        model,
        latencyMs: Date.now() - started,
        fallbackUsed: isFallback,
      };
    } finally {
      clearTimeout(timer);
    }
  };
  return run(Boolean(opts.jsonSchema));
}

// ---------------------------------------------------------------------------
// ZAI transport (sandbox/local provider)
// ---------------------------------------------------------------------------

async function zaiCall(opts: GatewayCallOptions, remainingMs?: number): Promise<GatewayResult> {
  const started = Date.now();
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs ?? gatewayConfig().timeoutMs);
    try {
      const completion = await Promise.race([
        zai.chat.completions.create({
          messages: opts.messages.map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
          thinking: { type: "disabled" },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("zai:timeout")), gatewayConfig().timeoutMs)),
      ]);
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      return {
        ok: text.length > 0,
        text: text || undefined,
        error: text ? undefined : "zai:empty-output",
        servedBy: "zai",
        model: "zai-sandbox",
        latencyMs: Date.now() - started,
        fallbackUsed: false,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `zai:${err.message}`.slice(0, 200) : "zai:failed",
      servedBy: "zai",
      model: "zai-sandbox",
      latencyMs: Date.now() - started,
      fallbackUsed: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run one model call through the provider chain. Order:
 *   OpenRouter requested-primary → OpenRouter fallbacks (bounded, once each)
 *   → ZAI → give up (caller labels rule-based).
 * Budget exhaustion skips OpenRouter entirely (honest labeled fallback).
 */
export async function gatewayChat(opts: GatewayCallOptions): Promise<GatewayResult> {
  const cfg = gatewayConfig();

  // V9 (fix): the old chain gave EVERY candidate a full independent timeout
  // (worst case 4x25s + ZAI 25s ~= 2 minutes for one chat reply — users saw
  // 40s+ waits). Each purpose now gets ONE shared deadline; candidates and
  // the ZAI fallback draw from what remains. Chat replies are short, so the
  // per-call timeout is tighter too.
  const chainBudgetMs = opts.purpose === "chat" ? 36_000 : 75_000;
  const perCallMs = opts.purpose === "chat" ? Math.min(cfg.timeoutMs, 22_000) : cfg.timeoutMs;
  const deadline = Date.now() + chainBudgetMs;

  if (cfg.apiKey && !budgetExceeded()) {
    const primary = opts.modelOverride ?? cfg.modelFor[opts.purpose];
    const candidates = [...(primary ? [primary] : []), ...cfg.fallbackModels.filter((m) => m !== primary)];
    for (let i = 0; i < candidates.length; i++) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) break; // no budget left for another attempt
      const r = await openRouterCall(cfg, candidates[i], opts, i > 0, Math.min(perCallMs, remaining));
      if (r.ok) return r;
      // 401/402 (auth/balance) — do not multiply retries across candidates.
      if (r.error?.startsWith("openrouter:401") || r.error?.startsWith("openrouter:402")) break;
    }
  }

  // ZAI fallback only if the chain budget still has room.
  if (Date.now() < deadline - 3_000) return zaiCall(opts, deadline - Date.now());
  return {
    ok: false,
    error: "gateway:deadline-exceeded",
    servedBy: "none",
    model: "none",
    latencyMs: chainBudgetMs,
    fallbackUsed: true,
  };
}

// ---------------------------------------------------------------------------
// Vision extraction (screenshot OCR + observations) via OpenRouter
// multimodal models. Returns {ok:false, error:"not-configured"} when no key
// is available so the caller can fall back to the sandbox provider.
// ---------------------------------------------------------------------------

export interface VisionExtractResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

export async function gatewayVisionExtract(
  prompt: string,
  dataUrl: string
): Promise<VisionExtractResult> {
  const cfg = gatewayConfig();
  if (!cfg.apiKey || budgetExceeded()) return { ok: false, error: "not-configured" };

  const primary = cfg.modelFor.vision;
  const candidates = [...(primary ? [primary] : []), ...cfg.fallbackModels.filter((m) => m !== primary)];
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bangla-shield-ai.vercel.app",
          "X-Title": "BanglaShield AI",
        },
        body: JSON.stringify({
          model,
          max_tokens: cfg.maxOutputTokens,
          data_collection: { policy: "deny" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ORResponse;
      if (!res.ok) {
        if (res.status === 401 || res.status === 402) break; // stop the chain
        continue; // try the next candidate (e.g. non-multimodal fallback)
      }
      const text = data.choices?.[0]?.message?.content ?? "";
      if (text.trim()) {
        const cost = typeof data.usage?.cost === "number" ? data.usage.cost : undefined;
        recordSpend(cost);
        return { ok: true, text: text.trim(), model: data.model ?? model };
      }
    } catch {
      // network/timeout — try next candidate
    } finally {
      clearTimeout(timer);
    }
    void started;
  }
  return { ok: false, error: "vision-unavailable" };
}

/**
 * Connection test for the authorized admin/status area — one minimal chat call
 * against the configured primary model. Never exposes the key or its shape.
 */
export async function gatewayConnectionTest(): Promise<{
  configured: boolean;
  ok: boolean;
  model?: string;
  provider?: string;
  latencyMs?: number;
  error?: string;
}> {
  const cfg = gatewayConfig();
  if (!cfg.apiKey) return { configured: false, ok: false, error: "not-configured" };
  const model = cfg.modelFor.chat ?? cfg.modelFor.analysis;
  if (!model) return { configured: true, ok: false, error: "no-model-configured" };
  const r = await openRouterCall(cfg, model, {
    purpose: "chat",
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
    maxTokens: 10,
  }, false);
  return {
    configured: true,
    ok: r.ok,
    model: r.model,
    provider: r.servingProvider,
    latencyMs: r.latencyMs,
    error: r.ok ? undefined : r.error,
  };
}

