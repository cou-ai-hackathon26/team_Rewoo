# BanglaShield AI 3.0

**বাংলাশিল্ড এআই ৩.০ — প্রতিটি বাংলাদেশির জন্য বাংলা-প্রথম প্রতারণা যাচাই**

BanglaShield AI 3.0 exists to protect people, families and livelihoods from the scams that target ordinary Bangladeshis every day — fake "son in trouble" phone calls, OTP phishing, brand-lookalike links, fake scholarships and overseas-job fee traps. It is a Bangla-first scam-verification service: a person with no technical knowledge can paste a message, upload a call recording or screenshot, or enter a link or QR code, and receive an evidence-based judgment in Bangla before money or personal information is lost. The product principle is simple and constant: **Show the threat. Explain the evidence. Protect the person.** Every result leads with the single most urgent protective action, every claim is grounded in quoted evidence from what the person actually submitted, and every limitation is stated honestly rather than hidden.

---

## 2. What it does

| Capability | Description |
|---|---|
| **Five verification methods** | Verify by (1) SMS/chat message text, (2) voice call — ASR transcription with a mandatory editable-transcript step, (3) screenshot — VLM OCR with a review step, (4) link, and (5) QR code — decoded on-device (jsQR) with the destination displayed, never opened |
| **Evidence-based results, protection first** | The result page leads with the risk state, then the immediate protective action (e.g. "আগে পরিচিত নম্বরে ফোন দিয়ে নিশ্চিত হোন"), then numbered evidence cards (E1, E2 …) quoting the submitted content, then unknowns and honest limitations |
| **Shield Lens 3.0 timeline** | Interactive attack replay built from the validated result: play/pause, prev/next, speed control, scrubbing, clickable evidence cards, and a visualization graph derived from the replay (never a fixed frontend template) with safe/risky decision branches |
| **Voice Safety Lab** | Voice results show the transcript timeline plus an honest AI-voice disclaimer: the analysis reads what was said, and never claims to know whether the voice itself is real or cloned |
| **AI Agent Activity Explorer** | Every result exposes its real pipeline activity log (`agentEvents`) — input acceptance, redaction, rule evaluation, AI provider attempts with durations, Safety Gate outcomes — with genuine timestamps, so users can see exactly how the verdict was produced |
| **Community Threat Watch** | Citizens submit anonymous, auto-redacted reports; human analysts review (approve/reject/split/withdraw with reason, audit-logged) before anything is published as a community alert |
| **ScamAcademy** | 12 bilingual interactive lessons with instant non-contradictory feedback, incorrect-answer review and progress tracking (device-only learner token) |
| **Help Center** | Unified emergency guidance: situation triage, step-by-step recovery checklists, and a verified official-contacts directory (bKash, Nagad, Bangladesh Bank, Police 999, BGD e-GOV CIRT) with source URLs and verification dates |
| **Judge Demo Mode** | A dedicated `/demo` route with a presenter run-sheet and six clearly-labeled synthetic presets (see section 8) |

---

## 3. Architecture

**Stack**: Next.js 16 (App Router) · TypeScript · Tailwind CSS · SQLite via Prisma · z-ai-web-dev-sdk for AI capabilities. The SDK is imported **server-side only** (in `src/lib/agent.ts`, `src/lib/multimodal.ts` and the `/api/v1/tts` route); no AI key or SDK code reaches the client bundle.

**Analysis pipeline** (one pipeline for all modalities):

```
consent ──▶ validate (Zod, size caps, MIME allow-list)
        ──▶ redact (OTPs / PINs / phones / NIDs masked before storage or AI)
        ──▶ deterministic heuristics (BN / Banglish / EN scam indicators → evidence)
        ──▶ LLM analyst (evidence framed as UNTRUSTED data; bounded 25 s timeout; 1 retry)
        ──▶ Safety Gate (schema + policy + template whitelist; application-level)
        ──▶ persist (session, evidence, audit event → SQLite)
        ──▶ versioned V3 result contract (AnalysisResultV3)
```

- **Background execution**: the input endpoint returns immediately; the pipeline runs in the background and the client polls real pipeline stages (`validating → redacting → detecting → ai_analyzing → safety_gate → completed`). A double-submit guard prevents duplicate runs of the same case.
- **Cancellation**: `POST /analyses/{id}/cancel` is checked between pipeline stages; a canceled analysis lands in a terminal `canceled` state, never a fake result.
- **Stale-session guard**: a session stuck in `processing` for over 2 minutes with no running job is honestly marked `failed` instead of spinning forever.

**Three analysis modes — always honestly labeled, never mislabeled:**

| Mode | Meaning |
|---|---|
| `LIVE_AI` | The AI analyst's output was produced and passed the Safety Gate |
| `RULE_BASED_FALLBACK` | The AI provider failed/timed out, or the Safety Gate rejected the payload twice — a deterministic rule-based result is shown instead, explicitly labeled |
| `OFFLINE_DEMO` | A synthetic demo preset ran deterministically with no AI call; the result is flagged `synthetic` and labeled in the UI |

**Security controls**: prompt-injection defense (untrusted-evidence framing + injection detector + Safety Gate), SSRF-safe by design (links never fetched), IDOR protection (cancel/delete require the creating visitor token), server-enforced analyst RBAC (signed httpOnly cookie), per-IP rate limits, safe file handling (PNG/JPEG/WebP only, size caps, data-URL validation, in-memory only — images and audio are never stored), privacy-preserving logs, output sanitization (no URLs/phones/long digits in AI text), template-whitelisted recommendations.

**Project layout**:

```
prisma/schema.prisma        # 12-model data layer
prisma/seed.ts              # analyst account + verified resources + labeled synthetic data
src/lib/                    # types, heuristics, agent, safety-gate, pipeline, fallback,
                            # graph, multimodal (ASR/VLM), redact, auth, crypto, rate-limit
src/app/api/v1/             # versioned API (route handlers)
src/app/page.tsx            # SPA entry (single user-visible route, hash-based navigation)
src/components/shield/      # app shell, router, store, citizen + analyst pages, demo presets,
                            # Shield Lens, decision-branch explorer, 12-lesson curriculum
public/demo/                # authorized synthetic demo assets (audio, QR, screenshot)
```

---

## 4. Honesty and AI-safety principles

1. **Four-state risk model — "no indicators" is never "safe".** Every result is exactly one of `HIGH_RISK` / `CAUTION` / `INSUFFICIENT_EVIDENCE` / `NO_RISK_INDICATORS`, and the last state is always presented with its meaning: "পরিচিত প্রতারণার লক্ষণ ধরা পড়েনি — তবে এটি সম্পূর্ণ নিরাপদ প্রমাণ নয়।" The Safety Gate enforces consistency deterministically: "no indicators" cannot stand alongside strong evidence (it is overridden to `CAUTION` or the deterministic verdict), and "high risk" without evidence is demoted to `INSUFFICIENT_EVIDENCE`.
2. **Negation understanding.** A message that *advises* people never to share an OTP is safety education, not phishing. Detectors are negation-guarded: OTP-request and impersonation matches occurring in the same sentence as advisory framing ("দেবেন না", "কখনো চায় না", "never share" …) are skipped, and a speaker-identity guard distinguishes an institution being *named* in advice from an identity being *claimed*. The benign OTP advisory therefore yields `NO_RISK_INDICATORS` with no invented scam.
3. **Family-impersonation detection with honest voice disclaimers.** Kinship address ("মা", "ভাই", romanized "mama", "bhai" …) combined with distress, a money request and/or secrecy ("কাউকে বলো না" / "kauke bolo na") produces strong family-impersonation evidence and, for voice input, the `ai_voice_impersonation` category. The immediate action is `T_VERIFY_FAMILY` (call the previously known number yourself; confirm over video). Because no acoustic deepfake detector exists, every voice result carries the exact disclaimer: **"কণ্ঠটি আসল নাকি এআই দিয়ে তৈরি, তা নিশ্চিত করা যায়নি।"**
4. **Prompt-injection defense.** Submitted content is framed to the LLM as UNTRUSTED data, never instructions; an injection-attempt detector flags manipulation attempts ("ignore previous instructions" …) as evidence, and they are never followed; the Safety Gate enforces policy at the application level, so a manipulated model output still cannot reach a citizen.
5. **Links are never opened.** Link and QR analysis is purely structural (brand lookalikes, suspicious TLDs, credential paths, TLS, shorteners). Every link result states the limitation: the destination page was not inspected.
6. **No fabricated evidence.** Evidence items quote the submitted content; recommendations are drawn from a curated bilingual template whitelist (the only advice wording trusted); "observed" replay stages must reference real evidence keys or are demoted.
7. **Observed / inferred / hypothetical separation.** Every replay stage, graph node and decision branch is typed, so educational hypotheticals (what *could* happen if you comply) are never presented as facts.

---

## 5. API reference (v1)

Auth levels: **public** (rate-limited, no token) · **visitor** (anonymous `X-Shield-Visitor` token issued by the SPA — no account) · **analyst** (signed httpOnly session cookie via `/api/v1/auth/analyst`).

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/analyses` | visitor | Create an analysis session (explicit consent required) |
| GET | `/api/v1/analyses` | visitor | List own recent sessions (privacy view) |
| POST | `/api/v1/analyses/{id}/input` | public (rate-limited) | Submit content: `text`/`link` analyze now, `audio` ASR, `image` VLM OCR, `confirm` reviewed text; optional `demo` flag runs OFFLINE_DEMO |
| GET | `/api/v1/analyses/{id}` | public (case ID) | Session metadata + full validated result (polling target) |
| GET | `/api/v1/analyses/{id}/status` | public (case ID) | Status + live pipeline stage |
| GET | `/api/v1/analyses/{id}/result` | public (case ID) | The validated V3 result (completed sessions only) |
| GET | `/api/v1/analyses/{id}/replay` | public (case ID) | Shield Lens stages + evidence for the timeline |
| POST | `/api/v1/analyses/{id}/cancel` | visitor (owner) | Cancel an awaiting/processing session → terminal `canceled` |
| DELETE | `/api/v1/analyses/{id}` | visitor (owner) | Soft-delete own case + audit event (IDOR-safe) |
| POST | `/api/v1/reports` | public | Submit an anonymous, auto-redacted community report |
| GET | `/api/v1/reports?ref=RPT-…` | public (reference ID) | Look up a report by its reference ID |
| DELETE | `/api/v1/reports/{id}` | public (reference-ID holder) | Withdraw a report |
| GET | `/api/v1/community/alerts` | public | Published, human-reviewed threat alerts |
| POST | `/api/v1/auth/analyst` | public | Analyst sign-in (email + password) |
| GET | `/api/v1/auth/analyst` | analyst | Current analyst session |
| DELETE | `/api/v1/auth/analyst` | analyst | Sign out |
| GET | `/api/v1/analyst/metrics` | analyst | Live DB-computed fraud-intelligence metrics |
| GET | `/api/v1/analyst/reports` | analyst | Moderation queue (pending reports) |
| POST | `/api/v1/analyst/reviews` | analyst | Review action (approve/reject/split/withdraw/escalate) with reason — audit-logged |
| GET | `/api/v1/analyst/patterns` | analyst | Fraud-pattern registry |
| POST | `/api/v1/analyst/patterns/{id}/withdraw` | analyst | Withdraw a pattern — audit-logged |
| GET | `/api/v1/analyst/graph` | analyst | Relationship graph with evidence-backed edges |
| GET | `/api/v1/analyst/audit` | analyst | Immutable audit log |
| POST · GET | `/api/v1/learn/progress` | learner token | Save / read ScamAcademy progress (device-only) |
| GET | `/api/v1/resources` | public | Verified official resource directory |
| POST | `/api/v1/feedback` | public | Was the result helpful? (helpful / followed / outcome) |
| POST | `/api/v1/tts` | public | Spoken guidance (experimental) |
| GET | `/api/v1/health` | public | Service health check |

---

## 6. Database (Prisma entities)

| Model | Purpose |
|---|---|
| `User` | Analyst/admin accounts (role, password hash, active flag) |
| `AnalysisSession` | One verification case (public case ID `BS-XXXXXXXX`, modality, status incl. `canceled`, stage, redacted text, engine, risk/scam category, full validated result JSON, soft delete) |
| `EvidenceItem` | Per-session evidence cards (key `E1…`, kind, redacted quote, bilingual interpretation, tactic, source module, weight) |
| `ConsentRecord` | Explicit consent records (analysis / retention / reporting) |
| `Feedback` | Was the result helpful / followed / outcome |
| `Report` | Anonymous community report (public reference `RPT-XXXXXXXX`, auto-redacted content, moderation status, `synthetic` flag, moderator-approved alert title/body) |
| `FraudPattern` | Analyst-curated pattern registry (bilingual name/description, category, confidence, supporting report IDs, indicators, expiry) |
| `PatternEdge` | Evidence-backed graph edges between patterns, reports and shared indicators |
| `HumanReview` | Every analyst decision (action, reason, reviewer, expiry) |
| `VerifiedResource` | Official contacts directory with source URL + verification date |
| `AuditEvent` | Immutable audit trail (analyst / system / citizen actions) |
| `LearningProgress` | Per-learner-token ScamAcademy scores (unique per lesson) |

---

## 7. Setup

Prerequisites: Bun ≥ 1.1 (Node.js ≥ 20 for tooling).

```bash
bun install            # install dependencies
cp .env.example .env   # SQLite configuration — no secrets needed
bun run db:push        # create the SQLite schema
bun run db:seed        # same as: bun prisma/seed.ts — analyst account,
                       # verified resources, labeled synthetic demo data
bun run dev            # start on http://localhost:3000
```

**`.env`** (see `.env.example`):

```
# SQLite file path. Prisma resolves it relative to prisma/schema.prisma,
# so this example points at <repo>/db/custom.db.
DATABASE_URL="file:../db/custom.db"

# Optional in development: HMAC key for analyst session cookies.
# Set a long random value (openssl rand -hex 32) in production.
SESSION_SECRET="change-me-in-production"
```

No AI API keys are needed in `.env` or the client bundle — the AI provider (`z-ai-web-dev-sdk`) is configured by the runtime environment.

**Analyst demo login** (seeded, demo-only — change before any real deployment): `analyst@banglashield.org` / `Shield#2025`, at `/#/analyst`.

### Deploying to Vercel

The repo ships a fully pinned, Vercel-specific build pipeline, so importing
the repo into Vercel works with zero configuration:

- `vercel.json` forces the exact toolchain: `bun install` (uses the committed
  `bun.lock`, so dependency versions — including TypeScript and `@types/*` —
  are byte-identical to the validated build) and `npm run vercel-build` as the
  build command.
- `.nvmrc` pins Node.js 22 (Next.js 16 requires ≥ 20.9).
- `package.json` pins `packageManager: bun@1.3.14` and `engines.node`, and its
  `postinstall` runs `prisma generate` so the Prisma client is always built
  before `next build`, regardless of installer.
- `vercel-build` generates the client, best-effort provisions the database
  schema (`prisma db push` — non-fatal; a warning is printed if the database
  is unreachable), and runs `next build`. The sandbox-only standalone-bundle
  copy steps are never used on Vercel, and `next.config.ts` disables
  `output: "standalone"` there (the `VERCEL` env var is set by Vercel).
- The database schema is provisioned automatically at build time if you set a
  `DATABASE_URL` environment variable in your Vercel project (`prisma db push`
  is best-effort and non-fatal). Note: the demo schema uses the SQLite
  provider (`prisma/schema.prisma`), so a SQLite `file:` URL is expected. To
  deploy against a hosted PostgreSQL (SQLite files cannot persist across
  serverless instances), flip `provider = "postgresql"` in the schema — it is
  provider-portable (no enums; `Json` fields are supported on both) — and set
  a matching `DATABASE_URL`. Without a durable database, the deployment still
  builds and serves the static experience, but database-backed APIs (analysis
  history, community, analyst tools) cannot persist.

To get a fully functional Vercel deployment: create a hosted database (Neon,
Supabase, Vercel Postgres, …), flip the schema provider to `postgresql`, set
`DATABASE_URL` (and a strong `SESSION_SECRET`) in the Vercel project's
environment variables, and redeploy.

**V8 — live AI on the public demo (OpenRouter).** The deployment ships with an
owner-supplied OpenRouter key embedded as a server-side default
(`src/lib/llm-gateway.ts`) so the public demo has live AI without any dashboard
configuration. Everything remains env-overridable:

- Set `OPENROUTER_API_KEY` in the Vercel project settings to replace the
  embedded demo key (recommended before any real production use — rotate the
  embedded key at openrouter.ai/keys once you do).
- Model defaults are live-tested Bangla-capable choices; per-purpose overrides:
  `OPENROUTER_CHAT_MODEL`, `OPENROUTER_ANALYSIS_MODEL`,
  `OPENROUTER_VISION_MODEL`, `OPENROUTER_FALLBACK_MODELS`.
- The ShieldAgent chat has a **model selector** (Auto / Llama 3.3 70B /
  Gemma 3 27B / Mistral Small 3.2 / DeepSeek V3 / Qwen 2.5 72B /
  Llama 4 Maverick) — the catalog lives in `src/lib/chat-models.ts` (client-safe,
  no secrets) and every reply is labeled with the model that actually served it.
- **Bangla voice**: narration uses the device's genuine Bangla voice
  (browser speechSynthesis, bn-BD preferred) first and the server TTS as
  fallback; the engine actually used is labeled on screen. Voice input runs
  live Bangla recognition (Web Speech API, `bn-BD`) in parallel with the
  server ASR, so the voice tab works on the public deployment too.
- **Report withdrawal** now requires a one-time receipt token issued at
  submission (or a signed-in author account) — the public reference ID alone
  can no longer withdraw a report (V8 security fix).

**Known serverless limitation (documented honestly):** with the default SQLite
provider, database-backed data is per-instance and does not persist across
serverless cold starts; rate limits and the AI daily-budget ledger are
per-process. For a durable production deployment use hosted PostgreSQL as
described above.

---

## 8. Judge Demo Mode

The `/demo` route (`/#/demo`) is a presenter-friendly walkthrough: no account, no microphone permission, no real personal data. It includes a six-step presenter run-sheet (Rahela voice case → benign OTP advisory → scholarship screenshot → link/QR → result-page anatomy → community moderation) and six presets, all original synthetic assets clearly labeled:

| Preset | Kind | Asset / input | What it demonstrates |
|---|---|---|---|
| Rahela's case — a call in her son's voice | voice transcript | transcript text + sample TTS audio `public/demo/rahela-call.wav` | Family + AI-voice impersonation: `HIGH_RISK`, `T_VERIFY_FAMILY` immediate action, honest "voice cannot be verified" disclaimer |
| Benign OTP advisory | message | advisory text | Negation understanding: `NO_RISK_INDICATORS`, no invented scam |
| Fake scholarship screenshot | image | `public/demo/scholarship-scam.png` | Real VLM OCR extraction with verbatim evidence quotes |
| Harmless demo QR code | link/QR | `public/demo/demo-qr.png` → `https://example.com/banglashield-demo` | Client-side jsQR decode; destination displayed, never auto-opened |
| Inert example phishing URL | link | `http://bkash-verify-account.top/login` | Brand-lookalike + suspicious TLD + no TLS → `phishing_link`, with the "never opened" limitation |
| Fictional overseas job scam | message | fake "free visa-job in Dubai" text | Advance-fee + urgency → `HIGH_RISK` fake job/visa |

Text and link presets run deterministically in `OFFLINE_DEMO` mode (no AI call), so the demo survives AI-provider outages and always behaves identically; the screenshot preset uses the real OCR service. Demo results are flagged `synthetic` and labeled in the UI.

---

## COU TECHNOVA 2026 — assigned challenges (Team 35 — Rewoo, Nov 24 2026)

Two hackathon challenges were implemented **inside the existing application** with the smallest safe changes; all prior features (verification routes, result pages, Guardian navigation, model selection, ScamAcademy, community, Shield Lens, emergency help, homepage) are preserved. New API fields are additive — old clients keep working.

### Challenge 1 — Voice-based contextual incident reporting

A person can now report a scam by voice inside Guardian chat, and the guidance **changes the moment they disclose sharing the verification code**.

**Voice input (Guardian chat):** a microphone button next to the input with an explicit-consent gate → listening → processing → **editable transcript review/correction** → sending. It reuses the app's existing voice stack: `MediaRecorder` + parallel `bn-BD` browser `SpeechRecognition` (the Verify voice-tab technique, factored into `src/components/shield/voice-capture.ts`) and the existing server ASR engine (`transcribeAudio`) behind a new consent-enforced endpoint `POST /api/v1/agent/voice` (403 `consent-required` without explicit consent). Bangla / Banglish / English are supported; when the mic or ASR is unavailable the typed input always remains.

**Deterministic incident state (never prompt-only):** `src/lib/incident-state.ts` is a pure resolver that folds the user's turns into `unknown | not_shared | shared` from Bangla/Banglish/English evidence — distinguishing negation ("না, দিইনি" / "I did not share") from admission ("দিয়ে ফেলেছি" / "I already shared") and detecting corrections ("আসলে…" / "actually…", latest statement wins). `src/lib/guardian-chat.ts` uses it before the model runs: a stage turn (follow-up question / preventive / recovery) is answered by the **deterministic rule flow** (`src/lib/incident-flow.ts`) — engine-labeled `incident-rules` — so the behavior works even when the AI provider is down; other turns still use the AI with the server-resolved state injected into the system prompt. The follow-up asks *whether* the code was shared and explicitly says the code itself is never needed; no reply ever asks for or prints an OTP/PIN/password, and contact numbers appear only from the verified directory (never in reply text). Each reply shows an honest label: `live-ai` / `rule-based-fallback` / `incident-rules` (deterministic) plus an incident-state badge.

### Challenge 2 — Dynamic verified official contacts

Guardian contact recommendations come **only** from a server-side directory read performed at response time.

- **Policy (documented, deterministic):** `src/lib/verified-contacts.ts` checks `active`, applies a freshness policy (`verifiedAt` within **180 days**; future dates beyond a 2-day clock-skew tolerance rejected), and verifies the official source + URL hostnames (https, host allowlist, `sourceUrl` host matches `url` host; lookalike hosts embedding brand tokens like `verify-bkash.com` are rejected).
- **Structured, server-validated data:** eligible contacts are returned as a typed payload (`source`, `directoryVersion`, items with `actionable` flag). Model- or user-generated numbers can never become cards (the deterministic contact filter masks them in replies too).
- **Mid-conversation refresh:** every relevant response re-reads the directory — including *after* the AI call resolves, so a change that happened while the model was processing is already reflected. Responses carry a `directoryVersion`; when it changes, previously displayed cards re-render as **outdated (non-actionable)** and only the current list stays tappable.
- **Fallback honesty:** when the authoritative directory is unreachable, the bundled snapshot is labeled `fallback` / *not currently verified*, with no actionable phone presented, plus a "verify independently" notice; if nothing eligible exists, a clear unavailable/verification-required state is shown and **no number is fabricated**.
- **Preserved & cleaned:** the Emergency Help feature keeps working (`/api/v1/resources` gained only additive `eligible`/`exclusionReasons`/`contactPolicy` fields). The one stale hardcoded recommendation (`tel:16247` one-tap card on the help page) was replaced by the currently-eligible mfs directory record. No genuine official contact was modified for the demonstration.

**Isolated demonstration:** `/#/technova-demo` runs a separate, in-memory **fictional demo directory** (Contact A / Contact B, clearly labeled `TEST DATA`) that never touches the real `VerifiedResource` table. Its transitions (deactivate A → verify B → deactivate/expire B) are real directory mutations flowing through the *same* eligibility pipeline — never a hardcoded demo response.

### Testing and results

```bash
bun run test:challenges   # 26 tests, all required scenarios
bun run typecheck         # tsc --noEmit — pass
bun run lint              # eslint — pass
```

Verified results at submission time (local dev server + browser end-to-end):
- **26/26 tests pass** covering: OTP mention without sharing → follow-up; "not shared" → preventive; later admission → recovery; corrections (both directions); Banglish/English equivalents; unclear transcription; microphone permission denied; AI-provider failure (deterministic flow still answers); Contact A→B replacement mid-conversation; A inactive; expired details; directory unavailable (fallback labeling); malicious lookalike domain; user-submitted fake contact; contact changes while the AI request is processing.
- **`bun run build` was not run locally** (sandbox policy); the remote Vercel build of the pushed commit is the build evidence instead.
- End-to-end browser verification: full voice-flow consent gate, the three-stage incident conversation, live-directory contact cards, help-page dynamic card, demo A→B→unavailable transitions, and regression checks (check tabs, homepage, Guardian navigation) all pass.

### Judge demonstration recipes

1. **Voice incident flow (Challenge 1):** open Guardian (`/#/guardian/chat`) → press the mic button → consent → speak (or type the transcript after review) — then run the conversation: "একজন ফোন করে আমার বিকাশের OTP চাইছে।" → Guardian asks whether the code was already shared → "না, দিইনি।" → preventive guidance → "আসলে আমি কোডটা দিয়ে ফেলেছি।" → recovery guidance with current verified contacts. Every reply is labeled; the incident-state badge flips `unknown → not_shared → shared` with "correction detected".
2. **Dynamic contacts (Challenge 2):** open `/#/technova-demo` → send "আসলে আমি ওটিপি দিয়ে ফেলেছি" in its chat → Fictional Contact A is recommended → press "যোগাযোগ এ নিষ্ক্রিয় করুন" then "যোগাযোগ বি নতুন যাচাঈ করুন" → continue the same conversation ("তাহলে এখন কার সাথে যোগাযোগ করবো?") → only Contact B is recommended, the old card is marked outdated and is no longer tappable → press "যোগাযোগ বি নিষ্ক্রিয় করুন" (or expire) → the unavailable/verification-required state appears with no fabricated number. All contacts there are fictional TEST DATA; the real Guardian uses the live `VerifiedResource` directory.

---

## 9. Known limitations (honest)

- **Bengali ASR is provider-limited.** The ASR provider currently garbles Bengali audio. A garbled-output detector recognizes this shape and routes the user to the editable transcript with an honest message; typing the transcript manually (Bangla or Banglish) is always available. Transcription quality is never overstated.
- **OCR can mis-read.** Low-contrast or stylized screenshots can produce extraction errors; the review step lets users correct the text before analysis.
- **No acoustic deepfake detector.** Voice authenticity is never claimed — the disclaimer "কণ্ঠটি আসল নাকি এআই দিয়ে তৈরি, তা নিশ্চিত করা যায়নি।" is always shown; analysis covers what was *said*, not who said it.
- **AI availability.** Analysis is bounded by the AI provider (25 s timeout per attempt, two attempts); when it fails, the deterministic fallback is shown and labeled `RULE_BASED_FALLBACK` — AI output is never faked.
- **Links are never fetched** (by safety design); link verdicts are structural.
- **Demo seed data is synthetic** and labeled everywhere it appears.
- **Single-process deployment**: in-memory rate limiting and the dev session key need shared infrastructure for multi-instance production.
- **TTS narration is experimental**; provider voices are not Bengali-native.
- BanglaShield is **not** a bank, law-enforcement or emergency authority and does not promise fund recovery.

---

## 10. Accessibility

- **WCAG 2.2 AA** is the design target: semantic landmarks, labeled navigation and controls, radiogroups for quiz choices, visible focus states, and copy-to-clipboard / listen buttons with aria-labels.
- **Bilingual bn/en** interface throughout (Hind Siliguri for Bangla, DM Sans for English); every risk state communicates via icon + text, never color alone.
- **Keyboard and screen-reader support**: all interactive flows are operable without a pointer; Shield Lens offers an accessible text-list alternative to the animated timeline.
- **Reduced motion** toggle (plus `prefers-reduced-motion` respect) and a large-text mode; entrance animations never gate content visibility.
- **Responsive from 320 px**: mobile journeys verified at narrow widths with 44 px minimum touch targets and no horizontal overflow.
