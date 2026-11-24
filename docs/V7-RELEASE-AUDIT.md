# BanglaShield AI V7 — Release Audit

**Date:** 22 November 2026 · **Scope:** all P0/P1 items from the independent review (REVIEW_AND_TASKS.md) plus the V7 Guardian/OpenRouter/evaluation work, executed against main `390a6fc`.

## 1. P0 repairs — what changed and the verification evidence

| # | Review finding | Fix | Verified how |
|---|---|---|---|
| 1 | Case privacy: no ownership checks on metadata/input/status/result/replay | New shared guard `requireCaseOwner` (src/lib/api.ts) enforced on **every** case endpoint; guest identity is now a **server-issued, HMAC-signed httpOnly cookie** (`bs_guest`, src/lib/guest-auth.ts) — the client-supplied `X-Shield-Visitor` header is no longer authority (only a one-time migration mint that preserves pre-V7 users' access to their own cases; knowing a case ID alone never suffices) | Two isolated browser sessions: session A created + completed a case (200, LIVE_AI); session B probed metadata/status/result/replay/input/cancel/delete — **all 403, zero content disclosed**, and its case list is empty |
| 2 | SQLite + in-process job Set (fire-and-forget) | Durable job model in the DB: atomic **job claims** (`jobClaimToken`/`jobClaimedAt`/`jobAttempts`), `pendingInput` (redacted) persisted at dispatch, stale-processing **recovery with bounded re-dispatch** (max 2 attempts) driven by the poll path, and a **claim-guarded terminal persist** — a canceled/deleted case can never be resurrected by a late provider return (pipeline.ts) | Code-level: claim preconditions are compare-and-set `updateMany`s; session A's full create→input→complete path ran under claims; sandbox is single-instance so cross-instance recovery is design-verified, not multi-worker-proven (documented limitation) |
| 3 | Retention claimed but not implemented | `expiresAt` set at creation; `sweepExpiredSessions()` enforces expiry on case reads and the health endpoint: result/extractedText/evidence scrubbed, terminal `expired` status; client renders a friendly expired view | Endpoint wired (health reports `retention.expiredSwept`); expiry rendering implemented; a live 7-day-wait verification is obviously not possible today — the mechanism is exercised by the code path on every read |
| 4 | Garbled ASR accepted as `transcriptOk:true` ("Tend, tend, tended…") | Detector rewritten: single-token repetition and ≥0.6 top-token dominance at ANY length, plus low-vocabulary filler detection; exact review fixtures documented inline | Node fixture check: all 7 regression fixtures pass (3 garbled shapes flagged, 4 legitimate short utterances pass) |
| 5 | No `#/guardian` route | Guardian built as one integrated workspace (`#/guardian/:tab`) reusing AgentChat + the case API; overview/chat/trust tabs; honest defaults (no device, no pending approvals, availability rows not performance bars) | Browser: route renders, all 3 tabs render, chat replies live-ai through the gateway |
| 6 | Chat returned rule-based-fallback on Vercel; OpenRouter not implemented | Full **server-side OpenRouter gateway** (src/lib/llm-gateway.ts): per-purpose models, ordered fallbacks, AbortController timeouts, JSON Schema (`require_parameters`) for structured analysis, `data_collection: deny`, daily/per-call budget caps, per-call metadata (model/provider/latency/usage/cost). Provider chain: OpenRouter (when `OPENROUTER_API_KEY` set) → ZAI sandbox → honest rule fallback. Agent activity events now show the actual serving model | Sandbox has no OpenRouter key — the OpenRouter path is code-verified + config-validated only; live verification **blocked pending credentials** (honestly labeled). ZAI path live-verified via chat + analysis (LIVE_AI results) |
| 7 | Vercel POST /analyses 500 + community feed error | Root cause not observable from this environment (no Vercel log access). Most probable cause documented: local SQLite file is not durable across serverless instances. `DATABASE_URL` is env-first and the .env.example + README now mandate a durable DB (e.g. Postgres) for serverless deployment | **Blocked pending deployment access/logs** — no deployment was changed (per handoff instructions); the fix path is documented, not claimed fixed |
| 8 | `npm ci` lockfile mismatch (qrcode + transitive deps missing) | package-lock.json regenerated (`npm install --package-lock-only`); qrcode, @types/qrcode, pngjs, dijkstrajs present; frozen `npm ci` validation executed in a clean temp dir | `npm ci` result below in §3 |
| 9 | `ignoreBuildErrors: true` | Removed; `tsc --noEmit` passes clean and is now a `typecheck` script; types are enforced again | `tsc --noEmit` exit 0 |

## 2. P1 repairs

| Finding | Fix |
|---|---|
| `#/recovery` and `#/report` misrouted to Community | Both have their own pages; Community's embedded reporting tab (`?report=`/`?case=`) unchanged. Browser-verified. |
| Skip link corrupted hash routing | Skip link now `preventDefault` + focuses the `tabIndex=-1` main landmark. Browser-verified: hash preserved, focus on `<main>`. |
| Chat history sent unredacted; client history trusted | Every outbound chat turn (including client-supplied assistant history) is privacy-redacted before leaving the server; deterministic contact filter masks long digit runs and non-allowlisted URLs on replies. |
| Chat hallucinated examples / "known number" certainty | Prompt doctrine rewritten: hypothetical examples must be labeled; unknown numbers are neither scam-proof nor emergency-proof — independent verification is the rule; non-emergencies are not routed to emergency numbers. |
| Image path overclaimed | Image-modality results now carry an explicit limitation: no validated image-authenticity detector runs; result covers text-content risk only. |
| Privacy page claims vs reality | Rewritten: enforced retention described as enforced-on-read; ownership described accurately (signed session, not "case ID secrecy"); third-party processing (ASR/VLM providers, community images) disclosed plainly. |
| Help directory dates June 2025 | All five resources re-verified against official sources (bkash.com, nagad.com.bd, bb.org.bd, police.gov.bd, cirt.gov.bd) via web search on 2026-11-22; `verifiedAt` updated in DB, seed and fallback snapshot. |
| Demo page "offline" overclaim | Renamed to rule-based / provider-independent synthetic demo with an explicit note that the server API is still required — not proof of network-independent use. |

## 3. Executed checks

| Command | Result |
|---|---|
| `bun run lint` | Clean (0 errors) |
| `npx tsc --noEmit` | Exit 0 |
| `bun run db:push` + `db:generate` | OK (schema v7: job fields, pendingInput, EvaluationRun/EvaluationItem) |
| Browser E2E (agent-browser) | Homepage, Guardian (all tabs), routing fixes, skip link, two-session isolation (7 endpoints), analysis create→input→complete (LIVE_AI, HIGH_RISK, evidence E1–E7), ShieldAgent chat (live reply, doctrine respected), trust view with real measured run |
| Rules-baseline evaluation | `EVAL-APADDNLP` vs frozen 120-sample dataset: **precision 72.7%, recall 80.0%, FPR 30.0%, coverage 100%, 0 abstentions** (TP=32 FP=12 FN=8 TN=28; 40 ambiguous held out). Real measured numbers, including an honest false-positive finding on benign quoted-education samples. |
| `npm ci` (frozen install, clean temp dir) | **PASSED** — "added 878 packages in 28s", exit 0 |
| Production build | Not run in this environment (policy); typecheck + lint + dev-server E2E used as gates. Documented, not claimed. |

## 4. Honest limitations and blocked items

- **OpenRouter live verification blocked**: no API key is configured in this environment. The gateway, fallback chain, budgets and structured outputs are implemented and config-validated; a live primary/fallback verification needs `OPENROUTER_API_KEY` (+ optional budget env) in the deployment environment.
- **Vercel 500 / community feed on production**: not diagnosable without deployment logs/access. Suspected: non-durable SQLite on serverless. `DATABASE_URL` is env-first and documented; the deployed database must be migrated to a supported durable DB and re-tested before the production claim can change.
- **Multi-instance job recovery**: the claim/recovery design is durable, but only a single-instance deployment was exercisable here.
- **ASR quality for Bengali remains provider-limited** (unchanged); the garbled-output gate is now stricter and the editable-transcript path remains the honest fallback.
- **Model-primary benchmark run** (120 AI calls) not executed — needs credentials/time budget; the runner (`POST /api/v1/evaluation/runs`, analyst-only) and batched progress are ready, and the public trust view renders only real runs.
- **Native device capabilities**: remain labeled roadmap; no device is paired, claimed or simulated as live.
- **FPR 30% on the rules baseline** is a real finding (benign quoted-scam-education and some transactional SMS get flagged). It is displayed honestly rather than tuned away — prompt tuning on the frozen set is prohibited by the benchmark protocol.

## 5. Changed files (summary)

- **Auth/privacy:** `src/lib/guest-auth.ts` (new), `src/lib/api.ts`, all `src/app/api/v1/analyses/**` routes
- **Durability/retention:** `src/lib/pipeline.ts`, `prisma/schema.prisma` (job fields, pendingInput, expiresAt, EvaluationRun/EvaluationItem)
- **Gateway:** `src/lib/llm-gateway.ts` (new), `src/lib/agent.ts`, `src/lib/shield-agent.ts`
- **Guardian:** `src/components/shield/pages/guardian.tsx` (new), `src/components/shield/app.tsx`, `header.tsx`, `i18n.tsx`, `pages/home.tsx`
- **Evaluation:** `src/lib/evaluation/{dataset,runner,ids}.ts` (new), `src/app/api/v1/evaluation/runs/route.ts` (new)
- **Honesty fixes:** `pages/demo.tsx`, `pages/privacy.tsx`, `pages/analysis.tsx`, `src/lib/resources-fallback.ts`, `prisma/seed.ts`, `src/app/api/v1/health/route.ts`
- **Build integrity:** `next.config.ts` (typecheck enforced), `package.json` (+typecheck), `package-lock.json` (repaired), `.env.example` (full V7 config)

## 6. Setup / env additions

All documented in `.env.example`: `OPENROUTER_API_KEY`, per-purpose models, fallbacks, `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_BUDGET_USD`, `AI_MAX_COST_PER_CASE_USD`, `ASR_PROVIDER`/`ASR_MODEL` (reserved), and the existing `DATABASE_URL`/`SESSION_SECRET` (now also signing guest cookies). Never paste keys into chat; configure them in the protected deployment environment.

**Rollback:** the work is on a feature branch; main remains untouched until review. Schema changes are additive (new nullable/defaulted columns + new tables) — rolling back the code does not break the old schema.

## 7. Feature matrix (tested / blocked / unverified)

| Capability | Status |
|---|---|
| Message analysis (golden path, claims + guest auth) | Tested — live |
| Two-session case isolation (7 endpoints) | Tested — 403 everywhere for non-owner |
| Routing (#/recovery, #/report, #/guardian) + skip link | Tested — browser |
| Guardian workspace (overview/chat/trust) | Tested — browser |
| Rules-baseline evaluation + public trust view | Tested — measured run recorded |
| ShieldAgent chat via gateway (ZAI path) | Tested — live-ai |
| OpenRouter primary path | Blocked — no key in this environment |
| ASR garbled-transcript gate | Unit-fixture tested (7/7); live Bengali ASR remains provider-limited |
| Retention expiry sweep | Implemented, wired to reads/health; 7-day live wait not observable today |
| Durable job recovery (multi-instance) | Design + single-instance tested; multi-worker unverified |
| Production (Vercel) 500 repair | Blocked — needs deployment logs/access |
| Native device features | Roadmap-labeled, unchanged |
