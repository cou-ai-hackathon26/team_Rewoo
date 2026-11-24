# BanglaShield AI V7 — complete implementation prompt

Prepared 22 November 2026, Bangladesh time. Read REVIEW_AND_TASKS.md alongside this prompt and the attached V7 design ZIP. The user is preparing for a DIFFERENT competition; its name/link and rules are pending. Do not call YUNet the current competition. Budget is undecided: make cost limits configurable.

## Your assignment

Act as a principal full-stack engineer, AI reliability engineer and product designer. Upgrade the existing BanglaShield AI application into the V7 release using its existing repository and backend. Implement and verify the product; do not stop at a plan, static gallery, or screenshots. Keep existing user capabilities and data, apply the supplied design to their pages, and add Guardian as one integrated flagship workspace. The latest user request authorizes a visual redesign across the existing product. It supersedes the older handoff's prohibition on redesign, while preserving its requirements for functional continuity and honest capability claims.

Repository: https://github.com/Shamimhasan8/BanglaShield-AI
Production: https://bangla-shield-ai.vercel.app/
Reference preview: https://preview-chat-6d134e14-fe73-42bc-8876-40c7382f2fc7.space-z.ai/

Read these supplied inputs before changing code:
1. This prompt and REVIEW_AND_TASKS.md.
2. BanglaShield_V7_Complete_Design.zip: README, index gallery, all 31 screens, full-scroll homepage, individual SVGs/PNGs, GUARDIAN_SYSTEM_DESIGN.md, navigation-fixes.patch.
3. BanglaShield_AI_Complete_Context(1).md for original features and boundaries.
4. Current repository instructions, README, package.json, both lockfiles, next.config.ts, Prisma schema, .env.example and release audits.

Do not blindly apply the included patch. On reviewed main SHA 390a6fc42146aada5ba64ee863bd9deb3502a336 it failed git apply --check because it assumes a prior Guardian integration absent from main. Reimplement its intended navigation fixes against actual current code. Recheck HEAD; preserve any newer user work. Build on a feature branch. Do not push, merge, publish or deploy without authorization.

## 0. Establish and repair the baseline

Record SHA, git status, runtime/package-manager versions and current routes. Inspect all existing features and APIs. Run the current product before edits with a new isolated local database and random server secret. Never run destructive push/reset/seed against existing data.

Known review findings to reproduce and repair:
- Vercel analysis creation returned HTTP 500. The exact root cause is unknown. Inspect application logs and deployment database/runtime configuration; do not assume an OpenRouter key alone fixes it. Community feed also failed to load in the live browser.
- The production chat endpoint exists but returned rule-based-fallback. The preview chat returned live-ai. Preserve the existing Support chat while moving/reusing its capabilities in Guardian.
- Main has no #/guardian route. The preview returned 404 there. V7's claim of a preexisting local Guardian integration does not describe the reviewed remote main.
- #/recovery goes to Community due to route order. #/report is also routed to Community, although a report component exists. Repair deliberately and preserve Community's reporting tab and case context.
- The skip link uses #main-content, which conflicts with hash routing. Prevent navigation and focus a tabIndex=-1 main landmark.
- npm ci failed because qrcode/@types/qrcode and their dependencies are missing from package-lock. Choose a supported package manager, repair the selected lockfile deliberately, and verify a clean frozen install.
- next.config.ts sets typescript.ignoreBuildErrors=true. Fix type failures and make release type checking enforceable.
- Existing analysis metadata, status, result, replay and input handlers lack a shared owner check. Cancel/delete checking alone is insufficient.
- Submitted Rahela audio returned garbled English syllables but transcriptOk=true. Improve quality validation and ASR, retaining editable fallback.

Build a baseline feature matrix before adding features: UI reachable, API connected, fresh input tested, error tested, label truthful, status and evidence. Do not infer deployed behavior from source presence or prior audits.

## 1. Implement the V7 design as live components

Use ivory #F4F1EB, forest #2F5746, sage #DDE8DF, clay #A44435 and readable ink/secondary text, reconciled with current CSS. Preserve Bangla-first bilingual settings, Noto Sans Bengali or the established Bengali font, accessible large text and reduced motion. Convert SVG designs to semantic React components and responsive layout; never ship each screen as a giant image or iframe gallery.

Map and implement all web views:
- 01 and full-scroll homepage: Guardian CTA, verification choices, Rahela story, learn/community/help access.
- 02–06: verification hub and message, voice, image, link/QR input.
- 07–08: evidence results and Shield Lens replay, using actual case data.
- 09–15: Guardian overview, chat, investigation, device capability status, proposals, trust/evaluation, recovery. Keep secondary views within the same original application shell. Use progressive disclosure; ordinary citizens should not navigate seven technical dashboards to check a message.
- 16–17: existing Academy and interactive lessons, video and simulation modes.
- 18–19: existing Community feed/help/reports/member dashboard and private report form.
- 20–22: emergency/help, privacy/history/deletion and accessibility settings.
- 23: clear synthetic demo entry.
- 24: existing authorized analyst dashboard, moderation/review, graph and audit.
- 25: actual loading, timeout, retry, permission unavailable, empty, offline and 404 states.
- 26–27: responsive web. Do not replace desktop screens with native mockups on small viewports.
- 28–31: native concepts only until independently implemented and tested. Label them as roadmap or simulation; never display paired/live protection for an unconnected browser.

Resolve design inconsistencies intentionally:
- The full homepage includes a cartoon family whereas the existing release audit says cartoon imagery was removed following feedback. Default to the current documentary photograph or a restrained neutral illustration-free story panel; record the choice.
- Replace repeated large decorative shield panels with task-relevant evidence or compact explanation where they crowd mobile content.
- The trust screen's equal-length colored capability bars are statuses, not numeric performance. Prefer labeled status rows; calculate any counts from the same actual capability registry.
- Differentiate 'কল ও ভয়েস' as user-submitted audio, and device review as guided/self-reported until native pairing exists.
- Keep full sample conversations, demo badges and sample capability counts confined to simulation mode. Fresh real conversations begin empty.

At 320, 390, 768 and desktop widths: no horizontal overflow, hidden primary action, clipped Bangla, footer overlap or inaccessible dialogs. Check keyboard, visible focus, screen reader names, contrast, zoom, reduced motion, 44px primary touch targets and recording announcements. WCAG AA is an acceptance target, not a certification claim.

## 2. Build one useful Guardian agent and real chatbot

Add #/guardian and compact translated desktop/mobile navigation. Reuse existing agent-chat UI/backend logic and scam-analysis contracts instead of creating unrelated systems. Existing Support entry must still work, either through the shared component or a clear deep link.

Provide text composer, contextual consent, microphone, selected attachments, conversation history, cancel/retry and four quick actions. Support Bangla, Banglish and English. Maintain follow-up context within an authorized session. Let the user ask about a completed case without trusting client-supplied evidence or another user's case ID.

Implement bounded orchestration:
user request -> classify intent -> select allowlisted specialist -> obtain actual tool result -> validate evidence and recommendations -> concise reply and result card.
Use existing heuristics, pipeline, redaction, graph and safety gate. Text Q&A, scam analysis, submitted audio, screenshot OCR and safe URL parsing are bounded tools. No unrestricted shell/device/network tool. Never treat uploaded OCR/transcripts as instructions. Model output cannot grant permission or approve its own action.

Show actual activity events and timestamps, source/model mode, relevant quoted evidence, observed/inferred/hypothetical findings, unknowns and the next protective step. Publish concise operation summaries; do not expose hidden reasoning or chain-of-thought. Keep scam categories separate from input modality and execution mode.

Route all chat turns through privacy preprocessing and an output safety check. Current live chat sends history directly to the provider and relies mainly on its prompt. Redact every outbound turn, including client-supplied assistant history, and avoid trusting fabricated client messages as tool outcomes. Filter fabricated contacts and unsupported certainty. Correct advice such as 'a genuine emergency will come from a known number': legitimate people can use unfamiliar phones, and caller ID can be spoofed. Recommend independent verification rather than number-based certainty. Do not routinely send non-emergency scam questions to an emergency number; use verified situation-appropriate guidance.

## 3. OpenRouter gateway and model selection

OpenRouter is the requested primary model gateway. Keep the API key server-side, never NEXT_PUBLIC, browser storage or chat. Use documented HTTPS endpoint https://openrouter.ai/api/v1/chat/completions with Bearer authentication or a current compatible SDK. Verify current docs and model metadata before implementation.

Suggested environment configuration (implement validation and document actual names):
OPENROUTER_API_KEY
OPENROUTER_CHAT_MODEL
OPENROUTER_ANALYSIS_MODEL
OPENROUTER_VISION_MODEL
OPENROUTER_FALLBACK_MODELS
AI_REQUEST_TIMEOUT_MS
AI_MAX_OUTPUT_TOKENS
AI_DAILY_BUDGET_USD
AI_MAX_COST_PER_CASE_USD
ASR_PROVIDER / ASR_MODEL and credentials if separate
DATABASE_URL / SESSION_SECRET / supported durable-worker configuration

These are configuration proposals, not proof credentials exist. Never ask the user to paste keys into chat. Create .env.example placeholders and safe setup instructions. Continue building testable adapters and labeled fallbacks when a key is absent; mark live-model acceptance blocked until a configured call succeeds.

Discover model architecture/input modalities, supported parameters, context limits, availability and current pricing from the models API. Keep a server-controlled allowlist by task. 'Any API model' means pluggable compatible adapters; a text-only model cannot automatically transcribe audio or provide image forensics. Fail clearly for incompatible selections. Avoid hardcoded assertions that a specific model is best for Bangla safety.

Separate model failover from provider routing. Configure fallback candidates through the documented models mechanism or one explicit application retry policy; avoid multiplied retry loops. Record the actual returned model and serving provider when available, request ID, timeout, latency, usage and exact/estimated cost status. Automatic fallback must preserve required modality/schema/privacy constraints. Do not count a fallback as success for the requested primary model.

For structured analyses use JSON Schema on compatible endpoints and require_parameters=true where supported; validate again with Zod and the independent safety gate. Schema compliance is not factual correctness. Bound retries and total case budget. Handle 401/402/429/5xx, unavailable model, malformed output, empty output, stream interruption and client cancellation. Use AbortController or SDK cancellation, not Promise.race alone. Do not stream unvalidated high-impact recommendations directly into an actionable result card.

Privacy policy: minimize/redact submissions; use data_collection=deny and appropriate zdr/account/guardrail settings where supported and required. Check OpenRouter's current Safety Retention exceptions and caching rules. Never loosen privacy silently to find a fallback or claim 'no storage anywhere' from one setting. Describe what our application stores versus third-party processing. Missing privacy-compatible endpoint -> explicit unavailability or local rules.

Choose at least three currently available, task-compatible candidates across low-cost, balanced and higher-capability tiers for the benchmark when credentials and budget permit. Pin exact IDs and settings for evaluation; select defaults from measured task quality/latency/cost. Keep customer UI simple; model administration and live connection tests belong to an authorized admin area. The public Trust view is read-only and exposes no credentials or private prompts.

## 4. Voice, image, link and QR

Voice: consent -> record/stop -> playback -> real ASR -> quality check -> review/edit -> scam semantics -> evidence. Waveform must derive from actual audio. Stop tracks on unmount, revoke and cancel. Test denied permission, unsupported MediaRecorder MIME, empty audio, silence, noisy Bengali, Banglish and English. Compare multilingual ASR alternatives on a reference corpus; do not assume OpenRouter chat audio support equals a qualified Bangla transcription service. The reviewed garbled output must be an explicit regression fixture. Do not auto-analyze low-quality output. Semantic scam detection cannot prove voice cloning.

Image: preview a fresh uploaded image, validate bytes and dimensions, extract OCR/visual context and permit review. Separate screenshot scam risk from authenticity. Check provenance/signatures with qualified libraries if possible; absent provenance is not evidence of forgery. If a separately validated synthetic-image/manipulation detector is available, expose its task and limitations; otherwise return insufficient evidence for authenticity. No fabricated heatmap, confidence percentage or forensic verdict from a general VLM opinion. Test new images, benign images, text-free photos and compressed/cropped variants, with MIME signature and decompression/pixel limits. Clearly distinguish OCR errors from analysis errors.

URL/QR: preserve client decoding and preview decoded destinations. Address structure is evidence about the URL, not a scan of the target. Do not automatically visit submitted links. If adding reputation lookup, use controlled providers with provenance/recency, quotas and SSRF-safe interfaces. Unknown/unlisted is not safe. Never submit credentials or execute APKs. Static APK analysis remains later work unless separately implemented and tested in isolation.

## 5. Authorization, privacy and deployment reliability

Introduce a shared server-side case authorization helper and enforce it on metadata/read/input/status/result/replay/events/feedback/report linking/cancel/delete and Guardian attachments. Support guest use with a server-issued signed httpOnly session or strong scoped credentials; do not treat a public case ID or arbitrary x-shield-visitor as authenticated authority. Do not let caller-supplied identities choose another owner. Enforce analyst roles independently. Add same-origin/CSRF protection appropriate to cookie-based writes.

Test two isolated guest sessions, missing credentials, wrong owner, expired/revoked session, deleted case and unauthorized stream/replay. Use only disposable test cases; do not probe real users' data. Fix duplicate submission and state races with transactions/idempotency. A canceled/deleted case must never become completed or reappear when an in-flight provider returns. Deletion must scrub all relevant derived evidence and respect documented audit retention. Implement retention expiry; a retentionDays field alone is not a deletion job.

For Vercel/multiple workers, replace mutable local SQLite and in-process fire-and-forget jobs with a supported persistent database plus durable execution, or a verified bounded synchronous flow that fits deployment limits. Keep SQLite only for a local single-instance demo. Add job recovery/leases, unique idempotency, terminal errors and cancellation. In-memory rate limits do not provide global production limits; use shared limits/quotas. Inspect total latency across ASR, model retries and polling, not just each timeout.

Validate request body bytes before buffering unbounded payloads, real file types, size, duration and image decoding limits. Keep secrets out of logs. Distinguish raw audio/image retention from retained redacted transcripts/results/community images. Repair consent/footer claims accordingly. Reverify resource-directory links and contacts from official sources; retain actual checked dates. Never use model-generated contacts.

## 6. Honest metrics and model comparison

Build a real read-only Trust & Evaluation view under Guardian, based on versioned evaluation records, and an authorized evaluation runner. Empty data displays 'Not evaluated yet', never demo performance as real. Separate operational status/capability availability from model quality and from native protection coverage.

For every model row show: exact model/provider, task, evaluation date/run ID, dataset version/hash, language, sample count, precision, recall, false-positive rate, abstention/coverage, decision accuracy if meaningful, schema failure rate, request failure rate, p50/p95 latency, actual/estimated cost per 100 completed cases, and limitations. Provide model-vs-rules baseline comparisons on the SAME held-out inputs/settings. Keep inference fallback/mixed-provider results in separate rows.

Proposed initial engineering benchmark: 120 text examples: 40 scams, 40 benign, 40 ambiguous; 40 each Bangla/Banglish/English with balanced labels within practical rounding. Include legitimate urgent requests, unknown callers, benign OTP warnings, family/visa/job/scholarship scams, quoted scams in educational messages and prompt injection. This is a smoke benchmark, not field validation. Freeze taxonomy and expected actions before running, manually review labels, and group splits by campaign/template. Do not tune prompts on held-out tests. Report synthetic versus consented real-data provenance. Add separate fixed corpora for ASR and OCR; evaluate image authenticity only with suitable detector/reference data and unseen generator families.

Define denominators explicitly: precision=TP/(TP+FP); recall=TP/(TP+FN); FPR=FP/(FP+TN); coverage=decided/eligible; abstention=abstained/eligible. Separate ambiguous labels and failures from binary scored cases; report end-to-end scam detection coverage including abstentions, and selective performance on decided cases. Never silently drop timeouts. Include confusion counts and confidence intervals for proportions, paired comparison uncertainty when feasible. For ASR show normalized WER/CER, reference conventions, speakers/accents/noise; OCR show CER or field-level accuracy. End-to-end scam performance and transcription accuracy are different measurements.

Do not display an LLM's self-confidence as calibrated probability. Only publish probabilities after held-out calibration and reliability evaluation with appropriate metrics; otherwise use categories and explicit uncertainty. Capability counts derive from named, supported and granted scopes. Website performance cannot establish money saved, device action success or financial-loss prevention. Evaluate user comprehension separately with consented usability tests; do not invent participants.

## 7. Demo and acceptance

Implement V7's animated Rahela flow inside the existing app: labeled simulated incoming call -> play synthetic audio -> actual ASR or explicitly reviewed/fixture transcript -> urgency/payment/secrecy evidence -> warning to stop and verify independently -> user chooses a simulated safe action -> clearly hypothetical consequence and final explanation. It must finish in one run and recover from provider failure without an indefinite spinner. Preserve existing reliable transcript demo as a fallback. If calling something offline replay, test it without network after documented setup; existing server-backed OFFLINE_DEMO is not proof of network-independent use.

Then demonstrate a fresh Bangla follow-up conversation, new message, benign contrast, fresh voice recording/upload, new screenshot/photo, and link/QR. Show actual mode and missing capabilities. Run three consecutive demo completions as a demo reliability check, recording elapsed time; this is not a statistical reliability claim.

Required engineering checks: clean frozen install, lint, enforced tsc --noEmit, meaningful unit/integration tests, production build, production server smoke tests, browser E2E and original workflows regression. Test all web design views and protected analyst flows using an isolated seeded environment. Test errors, provider missing/unavailable, low balance, malformed output, injection, cancellation/deletion races, wrong owner, refresh and idempotency. Test live provider separately from mocks. Do not mark a failed ASR path passed merely because manual entry exists.

Before declaring release ready, produce:
- changed files, migration/setup instructions, env placeholders and rollback notes;
- feature-by-feature tested/failed/unverified/simulated/unavailable matrix;
- executed command results, baseline comparison and production build output;
- browser screenshots showing actual responsive implementation;
- evaluation dataset/run artifacts and metrics with exact provenance;
- OpenRouter connection/primary/fallback verification without exposing secrets;
- remaining blockers and what input or credential resolves each;
- concise judge demonstration script and answers supported by evidence.

Acceptance means the existing product remains functional, V7 web pages are implemented, Guardian gives real configured backend replies, new inputs complete supported analyses, metrics are measured or visibly unevaluated, and every deployed claim matches execution evidence. If a key or native capability is unavailable, finish independent work and identify that precise blocked acceptance item. Never claim 'everything perfect' from screenshots or a mock provider.

Start by reviewing baseline and creating a task checklist. Implement sequentially: reliability/auth -> shared OpenRouter adapter -> Guardian -> voice/image -> V7 public/support views -> evaluation -> regression and production verification. Defer native pairing/actions until the web release gates pass. Do not deploy or push without authorization.
