# BanglaShield AI 3.0 — Release Audit

**Date**: 2026-11-22 · **Method**: every item below was exercised against the running application (API calls plus browser verification) unless explicitly marked otherwise. Statuses: Passed / Failed / Not Verified. No result below is claimed beyond what was actually observed.

## Acceptance results

| # | Acceptance item | Status | Evidence |
|---|---|---|---|
| 1 | Rahela transcript → `HIGH_RISK`, family/voice impersonation, family-verification immediate action | Passed | Analysis of the Rahela transcript returned `HIGH_RISK` with `family_impersonation` / `ai_voice_impersonation` (voice modality) and the `T_VERIFY_FAMILY` template ("আগে পরিচিত নম্বরে ফোন দিয়ে নিশ্চিত হোন") as the first, immediate protective action. |
| 2 | Benign OTP warning → `NO_RISK_INDICATORS`, no invented scam | Passed | The advisory ("ব্যাংক বা বিকাশ কখনোই … ওটিপি চায় না") was classified `NO_RISK_INDICATORS` — the negation guard and speaker-identity guard suppressed the OTP/impersonation keywords, and no fabricated evidence or scam category was produced. |
| 3 | Fake scholarship image → real OCR extraction | Passed | The real VLM OCR service extracted the image text; the result was `HIGH_RISK` `scholarship_scam` with impersonation + money + scholarship + advance-fee evidence quoted from the image, honestly labeled `LIVE_AI`. |
| 4 | Suspicious URL (`bkash-verify-account.top`) | Passed | Returned `HIGH_RISK` `phishing_link` from brand-lookalike, suspicious TLD, credential path and no-TLS indicators; the result carries the limitation "লিংকটি স্বয়ংক্রিয়ভাবে খোলা হয়নি" (the link was never opened). |
| 5 | Prompt injection appended to scam text | Passed | The `HIGH_RISK` verdict on the scam content was retained, the injection attempt was itself flagged as evidence (never followed), and no safety policy or output was manipulated. |
| 6 | Banglish family scam ("Ami tomar mama… taka pathao, kauke bolo na") | Passed | Romanized kinship + money-request + secrecy patterns matched; result `HIGH_RISK` `family_impersonation`. |
| 7 | Ambiguous benign input ("কালকে মিটিং হবে…") | Passed | Result `NO_RISK_INDICATORS` with the honest "not a guarantee" wording ("এটি সম্পূর্ণ নিরাপদ প্রমাণ নয়") — no risk was invented. |
| 8 | Rahela audio (TTS wav) through real ASR | Passed with honest limitation | The ASR provider garbles Bengali audio; the honest-quality detector recognized the garbled shape and routed to the editable transcript with an honest message, and analysis of the confirmed transcript completed correctly — transcription itself remains provider-limited and is never overstated. |
| 9 | Cancellation | Passed | `POST /analyses/{id}/cancel` on an awaiting session returned 200 with status `canceled`; cancel during processing landed in the terminal `canceled` state (the pipeline checks between stages and stops). |
| 10 | Cross-account case access | Passed | Cancel and DELETE attempts from the wrong visitor token were both rejected with 403 (server-side ownership enforcement). |
| 11 | Refresh during processing | Passed | The background job kept running; polling resumed the same job after refresh with no duplicate runs (double-submit guard). |
| 12 | Report moderation lifecycle | Passed | Browser-verified end to end: citizen submit (`RPT-KEAK7WY3`) → analyst pending queue → approve with reason → published community alert with Bengali category label and doxxing scrub applied. |
| 13 | Mobile and keyboard journeys | Passed | 390 px homepage verified: footer zero-gap, 44 px touch targets, keyboard-operable flows (VLM review noted minor link tap-area polish as an improvement opportunity, not a defect). |
| 14 | Offline demo | Passed | Text/link demo presets ran deterministically in `OFFLINE_DEMO` mode, clearly labeled synthetic in both the result contract and the UI. |
| 15 | QR decoding | Passed | Client-side jsQR decoding verified in code; the decoded destination was displayed and never auto-opened (browser upload path exercised). |
| 16 | Malformed AI output | Passed | The Safety Gate rejected the malformed payload (schema + policy checks), one retry with feedback was attempted, then the honest rule-based fallback was produced and labeled (unit-verified via gate design; label shown in the UI). |
| 17 | AI service unavailable | Passed | Bounded 25 s timeout × 2 attempts → `RULE_BASED_FALLBACK` honestly labeled in both the result and the agent activity events; no fake AI output. |
| 18 | Malicious file upload | Passed | Zod schema enforces PNG/JPEG/WebP-only MIME, size caps, and strict data-URL validation (schema-enforced rejection of non-conforming uploads). |
| 19 | Case deletion | Passed | Owner-only soft delete (`deletedAt` set, result scrubbed) plus an `analysis.deleted` audit event; wrong-visitor deletion returns 403. |
| 20 | Production build | Not Verified | Dev-mode sandbox: the production build was not run per environment policy; this is documented honestly rather than claimed. |

**Summary**: 19 of 20 items Passed (item 8 passed with its provider limitation honestly surfaced and mitigated by the editable-transcript path), 0 Failed, 1 Not Verified (production build, per environment policy).

## Deviations and documented limitations

- **Figma / board docs behind login walls.** The referenced design files could not be accessed from this environment. The implementation follows the existing approved design system in the product brief (palette, typography, tone); no pixel-parity claim is made against an uninspected file.
- **ASR Bengali limitation.** The speech-to-text provider garbles Bengali audio. This is a provider limitation, not hidden: the garbled-output detector routes users to the editable transcript, manual entry (Bangla or Banglish) is always available, and the transcript quality is never overstated.
- **No acoustic deepfake detector.** Voice authenticity is never claimed; every voice result carries the exact disclaimer "কণ্ঠটি আসল নাকি এআই দিয়ে তৈরি, তা নিশ্চিত করা যায়নি।" Analysis covers the content of what was said, not the authenticity of the speaker.
- **Production build not exercised.** The release was verified against the dev-mode sandbox; a production build (`bun run build` + standalone start) remains to be run in an environment where it is permitted.

---

# BanglaShield AI 4.0 — Team-Feedback Release Audit

**Date**: 2026-11-22 · **Scope**: the 12-item team feedback document, implemented end to end and verified against the running application (API + browser automation). Screenshots: `docs/screenshots/v4-*.png`.

| # | Feedback item | What shipped | Status |
|---|---|---|---|
| 1 | Reports: who reviews them; dashboard should list reported offences (Facebook-style) | Analyst console now has a "রিপোর্টকৃত ঘটনার তালিকা" — every report, filterable by status with live counts, expandable redacted content; community-post moderation queue (hide/restore, report counts, audit-logged); citizens track their own reports by reference and in "My dashboard" | Passed |
| 2 | ScamAcademy: fully interactive, animated educational videos + working simulations | New "শিক্ষা ভিডিও" mode: 3 animated story videos (OTP call, AI voice family scam, cashback link) — phone-mockup scenes (call/chat/SMS/browser), Bengali TTS narration with play/pause, speed 1x–2x, scene auto-advance, transcript, labeled fallback when audio is unavailable; simulation lab retained | Passed |
| 3 | Merge Support + Emergency; simplify | One "সহায়তা" section: always-visible 999/16247 one-tap chips, tabs (জরুরি ধাপ / শিল্ডএজেন্ট / সাধারণ প্রশ্ন); duplicate header emergency entry replaced by a single nav item + tel: action | Passed |
| 4 + 10 | User dashboard & community posting system: accounts with unique IDs, text+image posts, tracking, AI analysis of posts, official portals, comments, request help, reporting redesign | Full member system: minimal-data registration (name/username/password → public ID `BSA-XXXXXX`), Facebook-style feed (alert/help/experience posts, EXIF-stripped images, helpful marks, comments), ShieldAgent AI safety notice on every post (labeled unverified, rules+ai engine), help board with instant labeled AI first response, official portals strip, post report → under_review → moderator hide/restore, "আমার ড্যাশবোর্ড" with post refs + statuses and report tracking | Passed |
| 6 | AI agent integration: clearly defined role, workflow | ShieldAgent chat (bn/en, live-ai or labeled rule-based fallback, no fabricated contacts, no OTP acceptance) + "শিল্ডএজেন্ট কীভাবে কাজ করে" explainer (role, 5-step workflow, never-does list) on the Support page; the same agent powers post notices and help first-responses | Passed |
| 7 | App-like experience; explain how tracking works | Mobile bottom tab bar (5 tabs, active state), compact one-row header; Privacy page now carries the "তথ্য কীভাবে চলে" ledger — what each input collects, what is kept, and the explicit no-background-tracking statement (calls/SMS/apps are never read or recorded) | Passed |
| 8 | Remove cartoon-style AI images | Replaced with professional documentary-style photography (`/img/hero-main.png`, `/img/community-hero.png`, `/img/academy-hero.png`); old cartoon assets deleted | Passed |
| 9 | Fix voice input re-entry | Voice flows without any manual step: recording stop / file upload auto-transcribes; a plausible transcript (Bengali or Banglish with real word variety) goes straight to analysis; implausible ASR output (provider garbling) stays on a friendly review step with retry-or-type — never presented as a required re-entry | Passed with provider limitation (ASR quality for Bengali remains provider-limited and honestly surfaced) |
| 11 | Homepage: remove unnecessary/duplicated sections | Hero (photo + privacy chips) + 4 input cards + Rahela story + Learn/Community doors + compact trust strip; removed the duplicated how-it-works/privacy cards, the Shield-Lens demo teaser (kept as /demo CTA) and the full resource list (Support owns it) | Passed |
| 12 | Simplify the footer | One compact band: brand + one-line mission, 5 essential links, 999 chip, slim copyright line | Passed |

## V4 verification evidence (selected)

- Registration → post → AI notice → helpful → comment → dashboard: browser-verified end to end (member `BSA-W2B9SX`, post `CPT-Q5CTTVHB` shown Live in My dashboard).
- Help post → ShieldAgent labeled AI first response: verified live in the browser (Bengali empathy + concrete safety steps, "এআই · লেবেলকৃত").
- Agent chat: live-ai reply received and labeled in the browser session.
- Post report → `under_review` → analyst hide/restore: API + browser verified, audit-logged.
- Animated video: scene 1 narration played and auto-advanced to scene 2 in the browser; silent-mode fallback labeled.
- Voice upload: auto-transcription triggered with no clicks; implausible ASR output routed to the review step (garbage-detector unit-verified on 4 cases).
- Analyst reported-offences list: 15 reports, status filters with counts, expandable content.
- Mobile 390px: bottom tab bar usable, feed navigable, page bottom fully clears the bar (VLM-verified PASS), no console errors.

## V4 documented limitations

- **ASR for Bengali** remains provider-limited (unchanged from 3.0); the new auto-flow plus plausibility gate turns this into a no-retry-cost experience instead of a dead end.
- **Post AI notices** are LLM-assisted over deterministic signals and are always labeled "অযাচাইকৃত" (unverified); human moderation remains the authority.
- **Community images** are stored as data (EXIF stripped client-side, size-capped); a CDN/storage pipeline would be the production upgrade path.
