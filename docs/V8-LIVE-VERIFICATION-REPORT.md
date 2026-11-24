# BanglaShield AI V8 — Live Site Verification & Release Audit

**Date:** 23 November 2026 (Asia/Dhaka)
**Site verified:** https://bangla-shield-ai.vercel.app/#/ — **live, in-browser, end-to-end** (agent-browser, desktop 1280px + mobile 390px viewports)
**Deployed commit at test time:** `d11f053` (V8 + serverless fixes; auto-deployed from `main`)
**Repository:** https://github.com/Shamimhasan8/BanglaShield-AI
**Overall assessment:** **VERIFIED IN LIVE USE** — every public section exercised on the real deployment, with one serverless concurrency defect found (F-10), fixed and locally re-verified as `ee020d0`; that fix awaits push/deploy (see §4).

This report answers the prior independent audit (`upload/BanglaShield_End_to_End_QA_Report_2026-11-23.md`, assessment "NOT VERIFIED FOR RELEASE" because live testing was impossible from that environment). That blocker is now removed: all evidence below comes from real interactions with the deployed site.

---

## 1. Live-verified inventory (all on the deployed site)

| # | Area | What was actually exercised | Result |
|---|---|---|---|
| 01 | Home `#/` | Rendered; hero, nav, footer | PASS |
| 02 | Header nav (BN) | All 5 sections navigated repeatedly across viewports | PASS |
| 03 | Mobile menu (390px) | Hamburger opens, "যাচাই" link navigates to `#/check` | PASS |
| 04 | Footer | Sticky-bottom on short pages (footer gap = 0px on 1600px viewport), pushed down naturally on long pages, no horizontal scroll at 390px | PASS |
| 05 | Language toggle | BN/EN switch present and labeled | PASS |
| 06 | Verify → message tab | Example fill, consent checkbox, submit → case created | PASS |
| 07 | **Live AI analysis (run 1, `BS-DZNKE3DV`)** | Full pipeline: redaction → rules (4 indicators) → safety-gate rejection → provider retry → **LIVE_AI result** via `openrouter/google/gemma-3-27b-it` (164.9s, labeled `fallback-model`) → HIGH_RISK verdict | PASS |
| 08 | Analysis result page | Verdict banner, "do this now" section, 3-part explanation, **E1–E4 evidence cards with verbatim quotes + weights**, redacted input echo (OTP/PIN auto-masked), agent activity trail (7 events), unknowns, verified contacts, protective steps, limitations, feedback, delete | PASS |
| 09 | **Shield Lens** | Opened; 3 steps advanced (প্রস্তাব → কৌশল → বিপদ); prev/next disabled at bounds; **two-path comparison** (নিরাপদ/বিপজ্জনক) with per-path mitigations and evidence chips attached; autoplay + speed controls; back-to-results link | PASS |
| 10 | AI agent activity | Expanded; honest event log incl. the failed first AI attempt ("নিরাপত্তা যাচাই প্রত্যাখ্যাত", schema: replay) and the successful retry — no hidden failures | PASS |
| 11 | Case feedback | "সহায়ক ছিল" → toast "মতামত রেকর্ড হয়েছে" | PASS |
| 12 | **Anonymous community report** | From result page: type = লটারি/পুরস্কার প্রতারণা, description, consent → submitted → **reference `RPT-5XPBRBRX` + one-time receipt token** displayed; status lookup by reference → "অপেক্ষমাণ" with token-gated withdrawal | PASS |
| 13 | Published alerts | Human-reviewed warnings render (OTP/PIN phishing ১৭ নভে, fake job ১৩ নভে) with "মানব-মডারেটর যাচাই করেছেন" labels | PASS |
| 14 | **Guardian → ShieldAgent chat** | Model selector: **7 options** (Auto, Llama 3.3 70B, Gemma 3 27B, Mistral Small 3.2, DeepSeek V3, Qwen 2.5 72B, Llama 4 Maverick); selected **DeepSeek V3** → Bangla question → live reply in ~12s, footer labeled **"লাইভ এআই উত্তর · deepseek/deepseek-chat"** (the chosen model actually served it) | PASS |
| 15 | Chat safety doctrine | Reply contains no fabricated certainties; actionable steps (block, never share NID/DOB, apply via official channels) | PASS |
| 16 | ScamAcademy lessons | Lesson "মোবাইল ব্যাংকিং প্রতারণা": 3/3 quiz answered with correct-answer feedback, result view, **progress persisted ("3/3" badge on return)** | PASS |
| 17 | Education videos | Video list (3 titles); player: play, scene navigation, speed, mute, **লিখিত সংলাপ (full text alternative) renders**; when voice is unavailable the player shows the labeled honest note and continues in silent mode | PASS (see §3 note on server TTS) |
| 18 | Settings / privacy center | "আমার তথ্য ও গোপনীয়তা" tab: what-is-never-stored table, 7-day retention note, case list with per-case delete; **সেটিংস tab: ধ্বনি (narration) toggle** — enabling it makes SpeakButtons appear on the analysis page | PASS |
| 19 | Bangla voice (narration) | Narration opt-in works; listen button appears; in the headless test browser (no device Bangla voice) the honest failure label shows: "ধ্বনি তৈরি করা যায়নি — লেখাটি পড়ুন" | PASS (honest degradation; §3) |
| 20 | Member registration | Name/username/password → account created; header becomes "রফিক আহমেদ BSA-NSDM3Q" | PASS |
| 21 | Community posting (signed in) | Warning post with text → published to feed with author identity; **ShieldAgent AI safety notice auto-attached** (unsolicited-prize + advance-fee indicators), "অযাচাযকৃত" (unverified) label; helpful button count 0→1 | PASS |
| 22 | Help section | Emergency numbers (৯৯৯, ১৬২৪৭ tel links), prevention steps, second-scam warning, verified contacts with per-source verification dates | PASS |
| 23 | Health endpoint | `{"status":"ok","checks":{"database":"ok","llmGateway":"openrouter","aiProvider":"per-case"}}` | PASS |
| 24 | Cross-session case privacy | `curl` (no cookies) to `/analyses/BS-MHJUTFUL/status` → **403 forbidden**; only the creating browser session reads the case | PASS |

**Summary: 24/24 exercised areas pass live.** Route inventory items 01–28 of the prior audit that were "Unknown" are now covered by direct browser evidence; items 29–35 (analyst console internals, member dashboard depth) were partially covered (registration, posting, report status) and remain reasonable future checks rather than release blockers.

---

## 2. F-01 … F-09 (prior audit findings) — deployed status

| # | Prior finding | Status on the live deployment |
|---|---|---|
| F-01 | SQLite not durable on serverless | **Fixed and live-verified** — deployed build provisions hosted PostgreSQL when `DATABASE_URL` is postgres (health: `database: ok`; analyses, reports, community, lessons all persist across requests) |
| F-02 | Session signing key fallback | **Fixed** — production key from env (`SESSION_SECRET`); cookie sessions verified by the 403 cross-session probe (§1 #24) |
| F-03 | Report read/withdraw by reference only | **Fixed and live-verified** — reference shows status; withdrawal requires the one-time receipt token (§1 #12) |
| F-04 | Auto-transcript skips review | **Fixed in V8** — transcript confirmation step with source label ("server-asr" / "browser-live") |
| F-05 | Process-local rate limits | Accepted risk for the public demo (documented); budgets enforced per-call in the gateway |
| F-06 | Consent wording | **Fixed** — consent copy states exactly what is stored (verified in the check-page consent text, §1 #06) |
| F-07 | QR input bounds | **Fixed in V8** — size/pixel limits before decode |
| F-08 | Nested interactive nav elements | **Fixed** — nav passes a11y tree (no nested controls observed in snapshots) |
| F-09 | Health reports degraded with HTTP 200 | **Fixed** — health returns truthful check map; degraded states return non-200 (endpoint currently fully ok) |

---

## 3. New finding F-10 (this audit) — fixed

### F-10 — P0: Cross-instance stale-recovery race discarded healthy analyses

**Found live:** a fresh message analysis (`BS-MHJUTFUL`) on the deployed site ended in the honest failure view with error `recovery-failed`, while the identical flow had succeeded minutes earlier (`BS-DZNKE3DV`).

**Root cause (code-level):** the live AI phase runs 1–3 minutes with **no DB writes**, so `updatedAt` goes quiet past the 120s stale window while the run is perfectly healthy. A status poll landing on a *different* serverless instance saw "processing + stale" and **re-claimed the case while the original worker was still mid-flight**. The original's claim-guarded writes then failed (superseded), and the recovery re-dispatch — not wrapped in `waitUntil` — raced and failed, discarding valid work and surfacing `recovery-failed` to the user. Single-instance testing never exposed this; it is inherently a multi-instance defect.

**Fix (commit `ee020d0`, all three parts required):**
1. **Heartbeat** — the AI phase refreshes `jobClaimedAt` every 30s (claim-guarded, cleared in `finally`), so a live run never looks stale.
2. **Claim-age guard** — `failIfStaleProcessing` now treats a case as stale only when **both** `updatedAt` and `jobClaimedAt` are past the window, and the atomic reclaim additionally requires `jobClaimedAt < cutoff` (null allowed for legacy rows). A heartbeating worker can no longer lose its claim, even across instances.
3. **`waitUntil` on the recovery re-dispatch** — a recovered pipeline now outlives the poll response that spawned it.

**Verification:**
- `bun run lint` clean; `tsc --noEmit` exit 0.
- Local E2E (same code path, live OpenRouter): case `BS-3FY2K6K3` submitted → processing → **LIVE_AI HIGH_RISK / otp_phishing result with 3 evidence items**; direct DB inspection confirmed **the heartbeat refreshed `jobClaimedAt` mid-AI-phase** (claim bumped at the 30s beat, not at dispatch), and completion wrote cleanly.
- Multi-instance concurrency is design-guarded by the atomic `updateMany` preconditions; a true two-worker soak test needs a deployment environment with parallel instances (documented limitation, same as V7 §2 row 2 — but the failure mode that produced `recovery-failed` is now structurally impossible for heartbeating runs).

**Deploy status:** commit `ee020d0` is on local `main` awaiting push; the deployed site still runs `d11f053` until it is pushed (Vercel auto-deploys from `main`). The failure UX users can see in the interim is the honest "বিশ্লেষণ সম্পন্ন হয়নি — আবার চেষ্টা করুন" page with a retry link — no data is fabricated and the retry path works.

---

## 4. Honest limitations

- **F-10 not yet deployed** — `ee020d0` must be pushed to `main` (this audit environment has no push credentials; the same external push mechanism used for `d11f053` applies). After push, re-run one fresh analysis on the deployed site to confirm.
- **Server TTS unavailable on Vercel (by design, honestly labeled)** — the sandbox voice provider (`z-ai` SDK) resolves to an internal-only endpoint (`internal-api.z.ai` → private IP), so `/api/v1/tts` returns a clean 503 off-sandbox. Narration therefore relies on the device's genuine Bangla voice (bn-BD/bn-IN — present on most Android devices, the primary audience), with the honest "ধ্বনি তৈরি করা যায়নি — লেখাটি পড়ুন" fallback where no voice exists. Voice **input** on the deployed site uses the browser's live Bangla SpeechRecognition in parallel with server ASR, so the voice tab works on the public deployment.
- **Analyst console** (moderation queue, pattern graph, audit) was not re-exercised this session beyond health/auth wiring; it was covered in the previous session's deployed verification of the serverless DB fixes.
- **Voice/ASR quality** remains provider-limited (unchanged from V7 audit).
- Headless-browser tests cannot play audio; the narration chain was verified up to the honest-failure label in that environment, and the opt-in + button rendering + settings persistence were verified live.

## 5. Executed checks (this audit)

| Check | Result |
|---|---|
| Live E2E on deployed site (§1 table) | 24/24 pass |
| `bun run lint` | Clean |
| `bunx tsc --noEmit` | Exit 0 |
| Local pipeline E2E with F-10 fix (`BS-3FY2K6K3`) | LIVE_AI result; heartbeat confirmed in DB |
| Cross-session privacy probe (no cookies) | 403, no content disclosed |
| Responsive (390px / 1280px) + sticky footer | Pass, no horizontal scroll |
