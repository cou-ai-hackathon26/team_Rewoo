# BanglaShield AI — Evaluation & Benchmark Report

- **Generated:** 2026-11-24T06:54:46+00:00
- **Framework:** BanglaShield Evaluation Framework v1.0.0
- **Command:** `python3 evaluation/run_evaluation.py`
- **Git commit:** `9765f6a89ed2d1c46c2746946d4aefe35718843e` (branch `main`, dirty=True)
- **Application under test:** http://localhost:3000
- **Run duration:** 201.5 s

**Overall score: 100.00% (excellent)**

Grading bands: **95%+ excellent · 90%+ strong · 80%+ baseline · below 80% below-baseline**.

## Suite summary

| Suite | Weight | Score | Band | Passed | Failed | Skipped |
|---|---|---|---|---|---|---|
| Repository & toolchain integrity | 0.10 | 100.00% | excellent | 10 | 0 | 0 |
| Frontend served bundle verification | 0.10 | 100.00% | excellent | 5 | 0 | 0 |
| Backend API functionality & reliability | 0.15 | 100.00% | excellent | 10 | 0 | 0 |
| AI detection accuracy benchmark | 0.30 | 100.00% | excellent | 17 | 0 | 0 |
| End-to-end workflow completion | 0.15 | 100.00% | excellent | 7 | 0 | 0 |
| Security & edge-case handling | 0.15 | 100.00% | excellent | 14 | 0 | 0 |
| Response latency & error budgets | 0.05 | 100.00% | excellent | 6 | 0 | 1 |

## Detection accuracy (frozen benchmark dataset)

Dataset: `src/lib/evaluation/dataset.ts` — 120 labeled samples (40 scam / 40 benign / 40 ambiguous across bn / banglish / en).

### Track A — deterministic rules baseline (full dataset, product runner)

- Run IDs: `EVAL-MPMCEGAQ, EVAL-DLPMBBPJ`
- Confusion matrix: TP=40 FP=2 FN=0 TN=38 · abstained=0 · ambiguous held=40
- **Precision 95.24% · Recall 100.00% · F1 97.56% · FPR 5.00% · FNR 0.00%**

### Track B — live production path (stratified subset, citizen API)

| Case | Language | Label | Predicted | Engine | Outcome |
|---|---|---|---|---|---|
| S001 | bn | scam | HIGH_RISK | rule_based | correct |
| S015 | banglish | scam | HIGH_RISK | ai_assisted | correct |
| S028 | en | scam | HIGH_RISK | ai_assisted | correct |
| S041 | bn | benign | NO_RISK_INDICATORS | ai_assisted | correct |
| S055 | banglish | benign | NO_RISK_INDICATORS | ai_assisted | correct |
| S068 | en | benign | NO_RISK_INDICATORS | ai_assisted | correct |
| S081 | bn | ambiguous | INSUFFICIENT_EVIDENCE | ai_assisted | held |
| S095 | banglish | ambiguous | CAUTION | ai_assisted | held |
| S108 | en | ambiguous | CAUTION | ai_assisted | held |

- Confusion matrix: TP=3 FP=0 FN=0 TN=3 · abstained=0 · ambiguous held=3
- **Accuracy 100.00% · Precision 100.00% · Recall 100.00% · F1 100.00%**

## Latency (raw samples recorded in results.json)

| Endpoint | Samples | p50 | p95 | Max | Budget |
|---|---|---|---|---|---|
| Root page (HTML shell) | 5 | 20 ms | 61 ms | 61 ms | 3000 ms |
| Health endpoint | 5 | 7 ms | 11 ms | 11 ms | 2000 ms |
| Resources directory | 5 | 5 ms | 5 ms | 5 ms | 2000 ms |
| Evaluation runs (read model) | 5 | 5 ms | 5 ms | 5 ms | 2000 ms |
| Guardian stage reply (deterministic) | 3 | 4 ms | 5 ms | 5 ms | 3000 ms |
| Guardian live-AI reply | 3 | 3992 ms | 10327 ms | 10327 ms | 40000 ms |

## Check detail

### Repository & toolchain integrity

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| RI-01 | TypeScript typecheck passes with zero errors | PASS | 0 | 0 |
| RI-02 | ESLint passes with zero errors | PASS | 0 | 0 |
| RI-03 | Existing regression suite passes (tests/technova.test.ts) | PASS | 26 | 26 |
| RI-04 | Prisma schema validates | PASS | — | — |
| RI-05 | Core data models present in Prisma schema | PASS | 17 | 17 |
| RI-06 | API routes follow the versioned /api/v1 convention | PASS | 41 | 41 |
| RI-07 | AI SDK imported only by server-side code | PASS | 0 | 0 |
| RI-08 | TypeScript strict mode enabled | PASS | — | — |
| RI-09 | No tracked secrets (.env untracked; no plaintext provider keys) | PASS | 0 | 0 |
| RI-10 | SPA shell module imports resolve on disk | PASS | 0 | 0 |

### Frontend served bundle verification

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| FE-01 | Root page serves the HTML shell | PASS | 200 | 200 |
| FE-02 | Document metadata present (title, viewport, lang) | PASS | — | — |
| FE-03 | All initial script chunks resolve (HTTP 200, JS content-type) | PASS | 19 | 19 |
| FE-04 | Chunk-graph references resolve | PASS | 15 | 15 |
| FE-05 | Core page markers present in the served bundle | PASS | 4 | 4 |

### Backend API functionality & reliability

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| BA-01 | Health endpoint reports readiness | PASS | 200 | 200 |
| BA-02 | Health reports configured gateway honestly without secrets | PASS | — | — |
| BA-03 | Verified-resources directory serves eligibility-assessed records | PASS | 5 | 1 |
| BA-04 | Public evaluation endpoint exposes the frozen dataset contract | PASS | 120 | 120 |
| BA-05 | Guest identity minted server-side (signed httpOnly cookie) and honored | PASS | 201 | 201 |
| BA-06 | Unauthenticated member endpoint rejected (401) | PASS | 401 | 401 |
| BA-07 | Unknown API path returns 404 (no 5xx) | PASS | 404 | 404 |
| BA-08 | Guardian chat replies carry an honest engine label | PASS | incident-rules | live-ai|rule-based-fallback|incident-rules |
| BA-09 | Analyst-only endpoints require authentication (401) | PASS | 401 | 401 |
| BA-10 | Citizen feedback accepted and acknowledged | PASS | — | — |

### AI detection accuracy benchmark

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| DET-01 | Frozen benchmark dataset extracted and cross-checked | PASS | 120 | 120 |
| DET-02 | Rules baseline completes over the full frozen dataset (product runner) | PASS | — | — |
| DET-03 | Rules baseline is deterministic (two runs, identical confusion matrix) | PASS | — | — |
| DET-04 | Product-reported precision/recall/FPR cross-verified externally | PASS | — | — |
| DET-05 | Rules precision meets target | PASS | 0.9524 | 0.9 |
| DET-06 | Rules recall meets target | PASS | 1.0000 | 0.9 |
| DET-07 | Rules F1 meets target | PASS | 0.9756 | 0.9 |
| DET-08 | Rules false-positive rate within budget | PASS | 0.0500 | 0.1 |
| DET-09 | Rules false-negative rate within budget | PASS | 0.0000 | 0.1 |
| DET-10 | Ambiguous samples held out of binary scoring | PASS | 40 | 40 |
| DET-11 | Rules decision coverage (no silent abstentions) | PASS | 1.0000 | 0.95 |
| DET-12 | Live production path reaches terminal verdicts | PASS | 1.0000 | 0.8 |
| DET-13 | Live production path accuracy (decided cases) meets target | PASS | 1.0000 | 0.7 |
| DET-14 | Live production path F1 meets target | PASS | 1.0000 | 0.7 |
| DET-15 | Every completed case is engine-labeled (ai_assisted | rule_based) | PASS | ['ai_assisted', 'rule_based'] | — |
| DET-16 | All three languages exercised with decided cases | PASS | — | — |
| DET-17 | Ambiguous subset cases held out of binary scoring | PASS | 3 | 3 |

### End-to-end workflow completion

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| E2E-01 | Citizen journey: submit → verdict → feedback → history | PASS | HIGH_RISK | HIGH_RISK|CAUTION |
| E2E-02 | Analysis result contract completeness (bilingual summary, evidence, action) | PASS | — | — |
| E2E-03 | Guardian: OTP mention → follow-up question (state unknown, deterministic engine) | PASS | — | — |
| E2E-04 | Guardian: denial → preventive guidance (state not_shared) | PASS | — | — |
| E2E-05 | Guardian: admission → recovery with server-verified contact cards (policy applied) | PASS | actionable=5 | >=1 actionable or explicit unavailable notice |
| E2E-07 | Demo directory is clearly-labeled fictional TEST DATA | PASS | — | — |
| E2E-06 | Directory changes drive contact recommendations (A off → B verified → B off → none) | PASS | A-off: ['test-contact-b']; B-off: [] | B only, then none+notice |

### Security & edge-case handling

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| SEC-01 | Malformed JSON body rejected as 4xx (no 5xx) | PASS | 422 | 4xx |
| SEC-02 | Analysis without explicit consent rejected (422) | PASS | 422 | 422 |
| SEC-03 | Oversized input rejected by schema (422) | PASS | 422 | 422 |
| SEC-04 | XSS payload processed safely (JSON responses, no 5xx, terminal verdict) | PASS | — | — |
| SEC-05 | SQL-injection payload handled without server error | PASS | — | — |
| SEC-06 | Invalid case-id format rejected (400); unknown-but-valid id returns 404 | PASS | 400 | 400 |
| SEC-07 | Cross-guest case access denied (403, no private content) | PASS | 403 | 403 |
| SEC-08 | Voice endpoint requires explicit consent (403) | PASS | 403 | 403 |
| SEC-09 | Invalid audio returns honest transcription failure (422, no 5xx) | PASS | 422 | 422 |
| SEC-10 | javascript: link scheme rejected (422) | PASS | 422 | 422 |
| SEC-11 | Analyst login failures are uniform (401, identical message) | PASS | — | — |
| SEC-12 | Rate limiter enforced (429 after quota) | PASS | 21 | 1 |
| SEC-13 | Unsupported method rejected (405) | PASS | 405 | 405 |
| SEC-14 | No stack traces or internal paths leaked in error responses | PASS | 0 | 0 |

### Response latency & error budgets

| ID | Check | Status | Measured | Target |
|---|---|---|---|---|
| LAT-01 | Root page (HTML shell) p95 within budget | PASS | 60.6000 | 3000 |
| LAT-02 | Health endpoint p95 within budget | PASS | 11.4000 | 2000 |
| LAT-03 | Resources directory p95 within budget | PASS | 5.3000 | 2000 |
| LAT-04 | Evaluation runs (read model) p95 within budget | PASS | 4.9000 | 2000 |
| LAT-05 | Guardian deterministic stage reply p95 within budget | PASS | 4.6000 | 3000 |
| LAT-06 | Guardian live-AI reply p95 within budget | PASS | 10326.6000 | 40000 |
| LAT-07 | Full analysis pipeline latency | SKIP | — | — |

## Honesty section

### Not exercised by this framework

- Voice ASR with real microphone audio (POST /api/v1/analyses/{id}/input kind=audio, /api/v1/agent/voice) — no audio fixture was recorded; only the consent gate and invalid-audio paths were exercised.
- Image OCR / VLM analysis path (kind=image) — no image fixture; only route contract knowledge from source.
- TTS synthesis route (POST /api/v1/tts) — not exercised.
- Member authentication (register/login/logout) and analyst review workflows (patterns, reports, graph, audit) — read-only 401 checks only.
- Community feed write APIs (posts, comments, helpful marks) — not exercised (would mutate demo data).
- Report submission and withdrawal flows — not exercised.
- Learning progress tracking — not exercised.
- Production build artifacts (next build) — intentionally not run in this environment; all dynamic checks ran against the Next.js dev server (Turbopack).

### Limitations

- All dynamic measurements were taken against the Next.js dev server (Turbopack, bun runtime) on a single machine; production-build latency and caching behavior will differ.
- Track B (live production path) uses a stratified subset, not all 120 samples — live LLM calls are rate- and budget-bound; the full-dataset figure is Track A (deterministic).
- Live-AI turns are nondeterministic; repeated runs may vary in wording and latency. Track A, repo, frontend, security and contract checks are deterministic.
- Analysis latencies are measured at poll boundaries (4 s interval), so they are quantized upward by up to one interval.
- Rate-limit isolation uses virtual client IPs (X-Forwarded-For), matching the limiter's documented keying (src/lib/rate-limit.ts). The in-memory limiter is single-process.
- The OpenRouter key in this environment is the repository's documented embedded demo key (see src/lib/llm-gateway.ts); model-path availability depends on that key's quota at run time.
- Latency samples are environment-dependent (shared sandbox machine) and are recorded raw in results.json for independent recomputation.

### Methodology notes

- Every metric originates from a live HTTP request, repository scan, or toolchain subprocess executed during this run; nothing is hardcoded.
- Failed checks are recorded and reported — never suppressed or retried into passing.
- Detection scoring: binary on scam/benign; ambiguous samples held out; INSUFFICIENT_EVIDENCE counts as abstain (mirrors src/lib/evaluation/runner.ts).
- Percentiles use the nearest-rank method over raw recorded samples.
- Suite score = passed/(passed+failed); skipped checks are excluded from the denominator; skipped suites drop out of the weighted overall (weights redistributed).
- The independent validator (validate_results.py) recomputes every aggregate from raw data in results.json.

## Independent validation

- Executed: True · Passed: True · exit code: 0

```
validate_results: 421 consistency checks executed
VALID — results.json is internally consistent, complete and independently recomputable.

```

## Reproduction

```bash
# 1. Application: bun run dev        (Next.js dev server on :3000)
# 2. Environment:  bun run db:seed   (idempotent demo data — skips if already seeded)
# 3. Evaluation:
python3 evaluation/run_evaluation.py
# Independent re-validation of any results.json:
python3 evaluation/validate_results.py evaluation/results.json
```
