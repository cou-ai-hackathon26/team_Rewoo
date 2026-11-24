# BanglaShield AI V7 — judge and engineering review

**Reviewed:** 22 November 2026, Bangladesh time. **Verdict:** promising product/design direction; the current production release has blocking functional and privacy issues. This is a targeted independent review, not a full penetration test or certification. No repository changes were pushed and no deployment was changed.

The user confirmed this release is for a **different competition**, whose name/link has not yet been supplied. YUNet's published criteria were researched as a historical reference only. No official score, current panel, or reasons for a previous result can be inferred. OpenRouter budget is undecided and must remain configurable.

## 1. What was actually examined

- Original complete-context attachment, and V7 ZIP README, system design, route map, navigation patch and gallery structure.
- Supplied 31-screen board, individual full-scroll homepage, chat and trust designs visually inspected. Other screens covered by board/route/spec review, not an individual pixel-by-pixel QA claim.
- GitHub metadata/package via connected GitHub; complete local clone of main at **390a6fc42146aada5ba64ee863bd9deb3502a336**, latest subject: `fix: mount official portals strip on community reports tab`.
- Source for routing, chat, analysis model, multimodal adapters, analysis APIs, sessions, persistence, rate limits and background execution.
- Both supplied sites through the browser; fresh synthetic text submissions, existing Support chatbot, Rahela transcript demo, Shield Lens branch navigation, Recovery routing and Academy interaction.
- Direct API probes using public synthetic demo media and review-created synthetic cases only. No other user's case or analyst credentials were accessed.
- Clean install attempted; lockfile mismatch observed. An inspection-only install without lockfile changes then succeeded. Build/check results are appended separately below.

## 2. Findings and required improvements

| Priority | Finding and evidence | Required task / acceptance |
|---|---|---|
| P0 | Vercel POST `/api/v1/analyses` returned HTTP 500 for a fresh consented message case. Browser submission returned to the input form without a result. | Diagnose logs, database and runtime configuration. A fresh production-like case must create, complete and survive refresh. Cause has not been established; do not blame the model without logs. |
| P0 | Case privacy: source lacks ownership checks on metadata/input/status/result/replay. An ownerless GET of this review's own synthetic voice case returned 200 and its extracted transcript. Status/result/replay also returned 200 without identity for that awaiting-review case. | Shared owner guard and server-issued guest identity on every relevant endpoint. Missing/wrong session must disclose no private case content. Input mutation is source-confirmed risk, not exercised against another user's case. |
| P0 | Voice quality: the preview accepted `Tend, tend, tended...` as `transcriptOk:true`; audio request took **41.2 s**. | Add this exact failure family to regression tests, evaluate better Bangla ASR, require review on poor output. Passing manual fallback is not passing automatic transcription. |
| P0 | Main has no Guardian route, although V7 README describes an existing local integration. Preview `#/guardian` returned 404. | Build Guardian in current main, reuse existing chat/pipeline; do not assume unseen local changes are present. |
| P0 | Vercel chat returned 200 with `engine:rule-based-fallback` through both API and UI; preview chat returned `live-ai`. | Server-side OpenRouter integration, live configured connection tests, bounded fallback and correct model labels. Chat already exists under Help; improve and integrate it. |
| P0 | Vercel Community displayed “feed did not load — retry.” | Repair persistent data/runtime path and exercise feed, posting and moderation in an isolated test deployment. Do not represent static Community design as working backend. |
| P0 | SQLite persistence and in-process job Set in source; returning from request does not guarantee a background promise survives serverless lifecycle. | Supported durable deployment database/job execution, idempotency, cancellation/deletion race protection and restart tests. This is source risk; it is not a proven explanation of the observed 500. |
| P0 | `npm ci` failed: qrcode/@types/qrcode plus transitive dependencies absent from package-lock. Build config ignores TS errors. | Repair selected package-manager lockfile, enforce typecheck and clean production build. |
| P1 | `#/recovery` visibly rendered Community. `/report` has the same source branch. The V7 navigation patch fails `git apply --check` on reviewed main. | Adapt route fixes manually; verify intended Recovery and Report pages with case context, back button and skip link. |
| P1 | General chat passes history directly to provider, then accepts text reply; no deterministic result gate comparable to scam-analysis path. Prompt asks for redaction behavior but outbound history is not redacted in this function. | Redact outbound messages, validate advice/contacts and ground case references server-side. Never trust client-supplied tool history. |
| P1 | Preview's fresh chat response added accident/hospital/legal/payment-app examples absent from input and claimed genuine emergencies would use a known number. | Mark examples as hypothetical; correct identity-verification advice. Unknown number is neither proof of scam nor disproof of emergency. |
| P1 | Image path performs OCR/VLM extraction, not a validated synthetic-image detector. Sample screenshot OCR worked in **31.4 s**. | Separate content-scam findings from authenticity; qualify OCR errors and detector uncertainty, test new images. |
| P1 | Existing design says raw voice/images never stored; source persists redacted extracted text/results with retentionDays=7. Community images have a different storage path. | Rewrite precise consent/data ledger, validate expiry/deletion and third-party policies. Do not equate no raw-media database storage with no processing or retention anywhere. |
| P1 | Help directory displayed checked dates of June 2025. | Recheck official sources and preserve actual verification dates. UI presence is not current validation. |
| P1 | Demo page says offline, while deterministic backend still needs server/API. | Rename as provider-independent synthetic demo, or implement/test true network-independent replay. |
| P2 | Native/device control and action execution remain concepts. | Keep native screens labeled as roadmap/simulation until device tests, permissions and real outcome evidence exist. |

## 3. Feature verification matrix

**Observed success applies only to the exercised path and version.** A page loading does not prove every control or backend works.

| Capability | Vercel production | Reference preview / source evidence | Release status |
|---|---|---|---|
| Homepage / main navigation | Rendered Bangla homepage | Also rendered | Preserve and redesign |
| Fresh message analysis | Failed creating case: HTTP 500 | Fresh benign OTP warning completed, displayed LIVE_AI and no known risk indicators; case BS-9EM979S7 | Production blocker |
| Existing chatbot | Help -> ShieldAgent reachable; fresh question returned fallback | Fresh Bangla question returned live-ai via API | Improve/integrate; OpenRouter not yet implemented |
| Guardian | No route in reviewed main | `#/guardian` returned 404 | Missing |
| Rahela transcript demo | Not repeated after analysis-create failure | Completed HIGH_RISK with synthetic/OFFLINE_DEMO label, family verification advice; BS-N4VC6Y29 | One transcript demonstration passed |
| Shield Lens | Not independently run on Vercel | Opened completed demo, evidence timeline and final hypothetical branch rendered; selected step 5 | Partial interaction passed; not all playback controls tested |
| Audio submission/ASR | Not tested on Vercel | Public synthetic WAV accepted; garbled output wrongly labeled transcriptOk=true | ASR failed quality expectation |
| Live microphone recording | Not tested | Source/UI controls exist | Unverified, requires permission/device test |
| Screenshot OCR | Not tested on Vercel | Public scholarship PNG returned OCR text and visual notes; phone was redacted | Sample API extraction passed; full fresh-image UI journey unverified |
| Image authenticity | No validated detector found | General VLM extraction only | Unavailable/unvalidated |
| Link structural analysis | Source/UI path exists | Does not visit URL | Fresh end-to-end request not executed in this review |
| QR decoding | Source/UI path exists | jsQR implementation | New QR upload not executed in this review |
| Academy | 12 lessons listed; OTP question accepted choice and rendered feedback | Existing videos/simulation code | One lesson step passed; completion/video/simulation unverified |
| Community | Feed error shown | Source contains member/feed/help/moderation modules | Production blocker; lifecycle not re-tested |
| Recovery/report | Recovery misroutes to Community | Source explains both branch issues | Repair required |
| Help | Emergency steps/directory/chat render | Contacts not independently reverified today | Rendering only; resource accuracy pending |
| Privacy/history/deletion | Source present | Cancel/delete have owner checks; other paths do not | Full lifecycle unverified; cannot claim privacy passed |
| Analyst console | Source present | Prior audits claim checks | Not signed in or independently tested |
| Device pairing/call screening/APK/OS actions | No tested native integration | V7 explicitly labels concepts | Not shipped |
| Model comparison | No versioned benchmark found | V7 has placeholders, not measured accuracy | Implement measurement and honest empty states |

## 4. Judge perspective

The strongest pitch is **helping an ordinary Bangladeshi make a safer decision before sending money or credentials**, demonstrated with understandable evidence. Rahela is a clear human story. Bilingual inputs, evidence-linked replay, benign contrasts and a real conversation are stronger evidence than a large number of screens.

The central weakness is the gap between ambitious agent/device diagrams and verified release behavior. A judge can follow the public URL, submit a new input and encounter a server error. That outweighs visual polish. The current access-control issue also directly contradicts a protection product's trust promise.

Do not claim a competition score from these targeted tests. YUNet historically weighted user value 12, innovation 12, AI/technical implementation 10, UX/readiness 16 (50 total). Its UX/readiness weight is a useful reminder to demonstrate working journeys, but the new competition's rubric remains unknown.

### Questions a judge should ask you

1. Who is the first user: an elderly parent, a student, or an employee? Can that person reach a useful answer without understanding 'harness', 'fusion' or 'policy gate'?
2. Why choose this over forwarding the message to a general chatbot? Show measured value from Bangla/Banglish handling, verified evidence, privacy, recovery or lower error/cost.
3. Can I upload my own recording or image, change the story, and still get a sensible answer?
4. What exactly detected a scam: rules, ASR, an LLM, a URL check or a forensic detector? Show actual model/tool metadata.
5. What happens when the content is a legitimate urgent request or a benign OTP warning? How many false alarms occur?
6. Does a poor transcript lead to a false confident verdict? Show the garbled-audio failure and repaired path.
7. Can someone read my case by knowing its case ID? Demonstrate two-session isolation.
8. What does the agent actually do after reasoning? Which actions are advisory, simulated, approved or OS-verified?
9. Why do device screens appear if no native device is paired? Show honest unsupported states.
10. Where does submitted data go, how long is it retained, and can the user delete it while a job is still running?
11. How do you know model A is better than model B? Show common dataset, counts, false positives, uncertainty, latency and cost.
12. What is available when the provider is unavailable, quota is exhausted, or the user has slow connectivity?
13. How much does a completed case cost, and who pays? What prevents abusive traffic from exhausting the API budget?
14. Can a real user understand the warning and choose a safer action? Show actual consented usability evidence, or say it has not yet been measured.

### Industry perspectives researched, not attributed opinions

YUNet's published preliminary panel includes software, AI entrepreneurship, education and reliability research roles. Published finale news identifies banking, ML/international development, software engineering, CTO, product and academic judges. These are historical panels, not the confirmed panel for this release. The following are my inferred evaluation lenses, not statements by those people:

| Perspective | Evidence they would reasonably need |
|---|---|
| Banking/fraud | False positives, privacy, escalation quality, no exaggerated money-saved claim |
| ML/reliability | Held-out evaluation, ASR quality, coverage/abstention, unsupported-claim rate |
| Engineering/CTO | Repeatable build, durable jobs/data, auth, cost and real failure recovery |
| Product/business | Clear first user, short successful journey, adoption and operating-cost hypothesis |
| Academic/education | Honest methodology, meaningful innovation, understandable limitations |

## 5. V7 design review

The palette, clear Bangla headings, public verification flows, distinct error states and native labels are useful foundations. The full homepage restores content missing from a Guardian-only dashboard. Keep those strengths.

Prioritize a short public path: **share suspicious content -> understand evidence -> take a safe next step**. The multi-tab Guardian system belongs behind progressive disclosure. Device state, investigation and approval cannot be sample cards in a purported live session. Default to no device connected and no pending approvals.

The full-scroll home uses a cartoon family, conflicting with previous feedback recorded in the current release audit. Preserve the existing documentary photo by default. Large repeated shield illustrations add little information in task views; reduce them on phones. The Trust mockup's colored bars imply measurement despite representing capability states; replace them with explicit availability labels. Native views must not become responsive web screenshots that suggest phone control is active.

No UI should show a risk probability, model-accuracy score or protection percentage without an appropriate measured basis. '2/5 capabilities' is availability of a declared list; it is not protection coverage, quality or a score.

## 6. Model/API recommendation

Use one server-side OpenRouter adapter for compatible chat/analysis/vision tasks, reusing existing safeguards. Keep ASR as an independently evaluated adapter, and authenticity detection as a separately qualified capability. One API format does not make every model support every modality.

Select defaults after comparison on a frozen test set. Record exact model and serving provider, request failures and fallbacks, quality metrics, p50/p95 latency and cost. Separate requested-primary runs from mixed/fallback outcomes. Display 'Not evaluated yet' for absent metrics. Do not show a model's self-rated confidence as accuracy.

OpenRouter's official documentation supports model failover, parameter-compatible provider routing and structured outputs on compatible models. Privacy constraints must apply to every fallback, and current Safety Retention/caching qualifications must be understood. Implement deterministic validation even when schema output is enabled. Detailed requirements and benchmark design are in IMPLEMENTATION_PROMPT.md.

## 7. Order of work and handoff

1. Repair production case creation/feed and establish reproducible installation/build.
2. Fix case authorization, guest identity, cancellation/deletion, retention and deployment persistence.
3. Add configurable OpenRouter gateway and live chat verification.
4. Integrate Guardian and repair routing using current main.
5. Repair ASR quality; complete voice/image flows with honest authenticity boundaries.
6. Implement V7 across existing public/support/analyst pages.
7. Add measured model comparison and real operational status.
8. Complete responsive/accessibility/regression tests and a repeatable Rahela + fresh-input demonstration.
9. Only then implement native device features as a separate verified milestone.

Give the next agent the entire handoff ZIP. Read IMPLEMENTATION_PROMPT.md as the task; use the original V7 ZIP as visual reference and original context as historical requirements. Supply secrets through that agent's protected environment. Provide the new competition link and deployment access/logs when available. Nothing in this review establishes deployment permissions or guarantees all provider services are configured.

## 8. Sources

- Repository: https://github.com/Shamimhasan8/BanglaShield-AI (SHA above; source-path evidence in findings).
- Production: https://bangla-shield-ai.vercel.app/
- Preview: https://preview-chat-6d134e14-fe73-42bc-8876-40c7382f2fc7.space-z.ai/
- Historical official rubric/panel: https://yunet-aignite26.devpost.com/
- Historical rules: https://yunet-aignite26.devpost.com/rules
- Finale reporting, 22 November 2026: https://en.sarabangla.net/tech/post-54691/yunet-aignite-buildathon-2026-announces-winners/
- Official OpenRouter structured output: https://openrouter.ai/docs/guides/features/structured-outputs
- Official provider routing: https://openrouter.ai/docs/guides/routing/provider-selection
- Official model fallback: https://openrouter.ai/docs/guides/routing/model-fallbacks
- Official models metadata: https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- Official ZDR qualifications: https://openrouter.ai/docs/guides/features/zdr

All measured timings above are single observations, not latency benchmarks. Existing release-audit claims were treated as historical assertions, not independent proof. Tests did not establish current model accuracy or production-wide reliability.

## 9. Executed local engineering checks

| Command | Actual result | Interpretation |
|---|---|---|
| `git apply --check navigation-fixes.patch` | Failed at app.tsx route context | Included patch assumes code absent from current main. No patch was applied. |
| `npm ci --ignore-scripts --no-audit --no-fund` | Failed, lockfile mismatch | Clean reproducible npm install is a release blocker. |
| `npm install --ignore-scripts --no-package-lock --no-audit --no-fund` | Passed; 883 packages | Inspection-only workaround. It did not fix the lockfile and can resolve newer versions allowed by package ranges. |
| `npm run db:generate` | Passed, Prisma client 6.19.3 | Client generation only; no database reset/push/seed was run. |
| `tsc --noEmit` after Prisma generation | Passed, exit 0 | Earlier attempt before client generation failed on missing generated Prisma exports; resolved by generation. |
| `npm run lint` | Failed, 7 errors | React effect/setState rule errors in analysis, analyst review, community feed, privacy, carousel and mobile hook paths; inspect exact output when fixing. |
| `npm run build` | Passed, exit 0; Next 16.4.6; compile 17.6s | Application compiled and standalone files copied. Next skipped type validation per config, but separate tsc passed. This build used the inspection install, not a repaired frozen lockfile. |
| `git status --short` before production build | Clean | No source/lockfile edits made by review. |

Production server startup/database-backed local smoke tests were not executed. The successful compilation does not establish Vercel API health, live provider availability, or regression coverage. No automated benchmark was run and no model-accuracy values were produced.

The Privacy page was also opened: its data ledger and settings entry rendered, but it says knowing the case ID controls result access and claims automatic seven-day deletion. The source search did not establish a scheduled case-expiry implementation. Replace these assertions with tested ownership and retention behavior; do not infer expiry from a schema field.
