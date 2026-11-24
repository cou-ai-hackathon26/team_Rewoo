# EVALUATION

BanglaShield AI — Evaluation & Benchmarking Framework. This framework measures
the existing product **without modifying any application functionality, UI, or
business logic** (the only repository change is the `evaluation/` directory,
`EVALUATION.md`, `BENCHMARKS.md`, and this line-count-identical README section
pointer).

## Single command

```bash
# 1. Application:  bun run dev        # Next.js dev server on :3000
# 2. Environment: bun run db:seed    # idempotent demo data (skips if seeded)
# 3. Evaluate:
python3 evaluation/run_evaluation.py
```

That one command executes the complete pipeline, validates the results with an
independent validator, and writes both outputs:

- `evaluation/results.json` — machine-readable, raw samples included
- `evaluation/report.md` — human-readable report

Useful flags: `--quick` (reduced live-AI budget), `--skip/--only SUITE…`,
`--strict-exit` (exit 1 below the 80% baseline band), `--base-url URL`.

Independent re-validation of any results file:

```bash
python3 evaluation/validate_results.py evaluation/results.json
```

## Files

| File | Role |
|---|---|
| `evaluation/config.yaml` | Single source of truth: thresholds, weights, budgets, targets |
| `evaluation/run_evaluation.py` | Pipeline runner (7 suites, report generator) |
| `evaluation/metrics.py` | Pure metric math shared by runner + validator |
| `evaluation/validate_results.py` | Independent validator — recomputes every aggregate |
| `evaluation/results.json` | Measured results of the latest full run |
| `evaluation/report.md` | Human-readable report of the latest full run |

## Suites (weights)

| Suite | Weight | What it measures |
|---|---|---|
| detection | 0.30 | AI detection accuracy — dual-track benchmark (below) |
| backend_api | 0.15 | Live REST contract: health, resources, guest identity, auth, chat |
| e2e | 0.15 | Golden-path journeys incl. Guardian incident state machine, contact-directory lifecycle |
| security | 0.15 | Hostile input, consent gates, authorization, rate limiting, error hygiene |
| repo_integrity | 0.10 | typecheck, lint, existing tests, prisma schema, architecture rules, secrets hygiene |
| frontend | 0.10 | Served HTML shell + chunk graph + page markers over HTTP |
| latency | 0.05 | Warm sequential sampling; p95 vs budgets; raw samples recorded |

Suite score = passed/(passed+failed); skipped checks are excluded from the
denominator. Skipped suites drop out of the weighted overall (weights
redistributed — a skip can never inflate the score).

## Detection benchmark (the core)

Two tracks against the product's own **frozen labeled dataset** (120 samples:
40 scam / 40 benign / 40 ambiguous, balanced across bn / banglish / en —
`src/lib/evaluation/dataset.ts`):

- **Track A — deterministic rules baseline**: the FULL 120-sample dataset runs
  through the product's own analyst-authorized runner
  (`POST /api/v1/evaluation/runs {mode:"rules"}`), twice (determinism proof).
  The reported confusion matrix is cross-verified against external math, and
  the product-reported precision/recall/FPR are cross-checked against a
  recomputation from TP/FP/FN/TN.
- **Track B — live production path**: a stratified subset (bn/banglish/en ×
  scam/benign/ambiguous) goes through the real citizen journey
  (`POST /api/v1/analyses` → input → poll → result), exercising the live LLM
  gateway, safety gate, and the honest rule-based fallback. Per-case engines
  and verdicts are recorded.

Scoring semantics (mirroring the product's runner,
`src/lib/evaluation/runner.ts`): binary scoring only on scam/benign
("flagged" = `HIGH_RISK` or `CAUTION`); ambiguous-label samples are HELD OUT;
`INSUFFICIENT_EVIDENCE` counts as an abstention; precision = TP/(TP+FP),
recall = TP/(TP+FN), FPR = FP/(FP+TN), FNR = FN/(FN+TP).

## Latest full-run results

See `evaluation/report.md` (human) and `evaluation/results.json` (machine).
Every reported number is connected to: the check id in results.json, the raw
recorded data it was computed from, and the live request or subprocess that
produced it.

## Honesty rules (enforced by design)

1. Nothing is hardcoded — every metric comes from a live request, repo scan,
   or subprocess executed during the run.
2. Failed checks are recorded and printed — never suppressed or retried into
   passing.
3. Raw per-case / per-sample data ships in results.json so any aggregate can
   be recomputed by a third party (that is exactly what
   `validate_results.py` does).
4. Skipped ≠ passed: skipped checks/suites are excluded from denominators and
   listed in the report's honesty section.
5. The report explicitly lists untested components and limitations.
