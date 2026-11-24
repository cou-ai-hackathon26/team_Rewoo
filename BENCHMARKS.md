# BENCHMARKS

BanglaShield AI — benchmark definitions, targets and grading bands. Measured
values live in `evaluation/report.md` / `evaluation/results.json` (regenerated
by every run); **this file defines what is measured and what "good" means —
it never states results, which are always measured live.**

## Performance grading bands

| Band | Threshold | Meaning |
|---|---|---|
| Excellent | ≥ 95% | Production-grade across the measured dimension |
| Strong | ≥ 90% | High quality with minor gaps |
| Baseline | ≥ 80% | Acceptable; improvement opportunities identified |
| Below-baseline | < 80% | Needs remediation before release |

Applied to the weighted overall score and to every suite score
(`evaluation/config.yaml: thresholds`).

## Suite benchmark targets

### detection (weight 0.30) — AI scam-detection accuracy

Frozen dataset: the product's own `src/lib/evaluation/dataset.ts` —
120 labeled samples, 40 scam / 40 benign / 40 ambiguous, balanced across
Bengali script (bn), Romanized Bengali (banglish) and English (en).
Labels frozen before any run; the rules engine and prompts predate the
dataset (no tuning on it).

| Track | Subject | Scope | Targets |
|---|---|---|---|
| A | Deterministic rules baseline (`rules:v7`) | full 120 samples, via the product's analyst-authorized runner, run twice (determinism proof) | precision ≥ 0.90 · recall ≥ 0.90 · F1 ≥ 0.90 · FPR ≤ 0.10 · FNR ≤ 0.10 · coverage ≥ 0.95 |
| B | Live production path (LLM gateway + safety gate + honest fallback) | stratified subset 9 samples (3 languages × scam/benign/ambiguous), via the public citizen API | completion ≥ 0.80 · accuracy ≥ 0.70 · F1 ≥ 0.70 · every verdict engine-labeled |

Scoring semantics (mirrors the product's runner `src/lib/evaluation/runner.ts`):
binary on scam/benign, flagged = `HIGH_RISK`/`CAUTION`; ambiguous held out;
`INSUFFICIENT_EVIDENCE` = abstention. Product-reported metrics are
cross-verified by external recomputation (DET-04).

### backend_api (0.15) — functional reliability

10 live contract checks: readiness, honest gateway labeling without secrets,
verified-contact eligibility fields, frozen-dataset contract echo, signed
httpOnly guest identity, honest 401s, 404 routing, engine-labeled chat,
analyst auth gate, feedback acknowledgment.

### e2e (0.15) — end-to-end workflows

Golden paths: citizen submit → verdict → feedback → history; result-contract
completeness; Guardian incident-state machine (unknown → not_shared → shared
with correction; deterministic engine labels); recovery contact cards with
policy applied; dynamic directory lifecycle (A deactivated → B verified →
B deactivated → explicit unavailability notice) driven by directory data.

### security (0.15) — security & edge cases

14 checks: malformed JSON, consent gates (analysis + voice), oversized
input, XSS payload safety, SQL-injection resilience, case-id format vs
unknown-id uniform 404, cross-guest 403, uniform login failure, rate-limit
429, 405 method handling, no stack traces in any error body.

### repo_integrity (0.10) — code quality & architecture

10 checks: `tsc --noEmit` zero errors, ESLint zero errors, existing 26-test
regression suite passing, Prisma schema valid + all 17 core models present,
versioned `/api/v1` route convention, AI SDK server-only import rule,
TypeScript strict mode, no tracked secrets, SPA module imports resolve.

### frontend (0.10) — served bundle verification

5 checks over HTTP: HTML shell + metadata, all initial script chunks resolve,
chunk-graph references resolve, core page markers present in served JS.

### latency (0.05) — response budgets

Warm sequential sampling; nearest-rank percentiles from raw recorded
samples. Budgets (p95): page 3000 ms · health 2000 ms · resources 2000 ms ·
evaluation reads 2000 ms · deterministic chat 3000 ms · live-AI chat 40000 ms
(product's own documented 36 s gateway chain budget + 4 s tolerance) · full
analysis pipeline 120000 ms (75 s chain budget + margin).

## Measurement integrity

- **Deterministic where possible:** Track A, repo, frontend, security and
  contract checks are fully deterministic (verified: Track A double-run
  identity check DET-03). Live-AI turns (Track B, LAT-06) are nondeterministic
  and raw samples are recorded per run.
- **Reproducible environment:** fixed base URL, per-suite virtual client IPs
  (recorded in results.json) isolating rate-limit buckets, idempotent seed
  (`bun run db:seed` skips when seeded), frozen dataset with recorded
  sha256 extraction digest.
- **Independent validation:** `evaluation/validate_results.py` recomputes
  every suite score, confusion matrix, metric, percentile and grade from raw
  recorded data — plus semantic consistency (a check marked PASS must
  actually satisfy its target under recomputation).
- **Transparent errors:** failed and skipped checks are recorded with
  evidence strings and printed; the report's honesty section lists untested
  components and limitations (see `evaluation/report.md`).

## Run it

```bash
python3 evaluation/run_evaluation.py                      # full pipeline
python3 evaluation/run_evaluation.py --quick              # reduced live-AI budget
python3 evaluation/run_evaluation.py --only detection latency   # subset
python3 evaluation/validate_results.py evaluation/results.json  # re-validate
```
