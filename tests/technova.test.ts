/// <reference types="bun-types" />
// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — automated challenge tests (Team 35 — Rewoo).
// Run: bun run test:challenges   (bun test tests/)
//
// Covers the required scenarios:
//   Challenge 1: OTP mention without sharing → follow-up; "not shared" →
//   preventive; later admission → recovery; corrections; Banglish/English;
//   unclear transcription; microphone permission denied; AI provider
//   timeout/fallback (deterministic flow still works).
//   Challenge 2: Contact A→B transition; A inactive; expired details;
//   directory unavailable (fallback labeling); malicious lookalike domain;
//   user-submitted fake contact; contact changes while the AI request is
//   processing.
// ---------------------------------------------------------------------------

import { test, expect, beforeEach } from "bun:test";
import { analyzeMessage, resolveIncident, incidentLangOf } from "../src/lib/incident-state";
import { followUpReply, preventiveReply, recoveryReply } from "../src/lib/incident-flow";
import { nextVoicePhase, transcriptUsable } from "../src/lib/voice-flow";
import {
  assessContact,
  fallbackSnapshot,
  snapshotFromRecords,
  type DirectoryRecord,
} from "../src/lib/verified-contacts";
import { applyDemoDirectoryAction, readDemoRecords } from "../src/lib/demo-directory";
import { guardianChatTurn } from "../src/lib/guardian-chat";
import { getVerifiedContacts } from "../src/lib/verified-contacts";
import { chatWithShieldAgent, type ChatOutcome } from "../src/lib/shield-agent";

type AiCall = typeof chatWithShieldAgent;

// --- helpers ----------------------------------------------------------------

const aiFail: AiCall = async (): Promise<ChatOutcome> => ({
  reply: "rule-based stub",
  engine: "rule-based-fallback",
});

const aiOk: AiCall = async (): Promise<ChatOutcome> => ({
  reply: "ai stub reply",
  engine: "live-ai",
});

const demoRead = async () => getVerifiedContacts({ directory: "demo" });

// --- Challenge 1: incident-state resolver -----------------------------------

test("C1: OTP mention WITHOUT sharing → state unknown, stage follow_up", () => {
  const r = resolveIncident(["একজন ফোন করে আমার বিকাশের OTP চাইছে।"]);
  expect(r.state).toBe("unknown");
  expect(r.stage).toBe("follow_up");
  expect(r.changed).toBe(false);
  expect(r.codeTopicSeen).toBe(true);
});

test("C1: user says NOT shared → state not_shared, stage preventive", () => {
  const r = resolveIncident(["একজন ফোন করে আমার বিকাশের OTP চাইছে।", "না, দিইনি।"]);
  expect(r.state).toBe("not_shared");
  expect(r.stage).toBe("preventive");
  expect(r.changed).toBe(true);
});

test("C1: later admits shared → state shared, stage recovery, correction detected", () => {
  const r = resolveIncident([
    "একজন ফোন করে আমার বিকাশের OTP চাইছে।",
    "না, দিইনি।",
    "আসলে আমি কোডটা দিয়ে ফেলেছি।",
  ]);
  expect(r.state).toBe("shared");
  expect(r.stage).toBe("recovery");
  expect(r.changed).toBe(true);
  expect(r.correction).toBe(true);
});

test("C1: correction BACK from shared to not_shared also switches guidance", () => {
  const r = resolveIncident(["ami otp diye dilam", "ভুল বলেছিলাম — আমি দেইনি"]);
  expect(r.state).toBe("not_shared");
  expect(r.stage).toBe("preventive");
  expect(r.correction).toBe(true);
});

test("C1: Banglish equivalents resolve the same way", () => {
  expect(resolveIncident(["someone called asking for my bKash OTP"]).stage).toBe("follow_up");
  expect(resolveIncident(["ami otp diye dilam"]).state).toBe("shared");
  expect(resolveIncident(["I did not share the OTP"]).state).toBe("not_shared");
  expect(resolveIncident(["I already shared the code with him"]).state).toBe("shared");
});

test("C1: negation is distinguished from affirmation in mixed messages", () => {
  // codeTopicAlready=true mirrors a real conversation (an earlier turn
  // already mentioned the OTP, so pronoun-level statements carry meaning)
  expect(analyzeMessage("আমি OTP দিইনি", false).shareStatement).toBe("denied");
  expect(analyzeMessage("আমি OTP দিয়ে ফেলেছি", false).shareStatement).toBe("affirmed");
  // the LAST explicit statement in the message wins
  expect(analyzeMessage("আগে ভেবেছিলাম দিইনি, কিন্তু পরে দিয়ে দিয়েছি", true).shareStatement).toBe("affirmed");
  expect(analyzeMessage("আগে বলেছিলাম দিয়ে ফেলেছি, এখন ঠিক করছি — আমি দেইনি", true).shareStatement).toBe("denied");
  // without a code topic, sharing verbs alone carry no incident meaning
  expect(analyzeMessage("আগে ভেবেছিলাম দিইনি, কিন্তু পরে দিয়ে দিয়েছি", false).shareStatement).toBeNull();
});

test("C1: unclear transcription does not change the state", () => {
  const r = resolveIncident(["একজন ফোন করে আমার বিকাশের OTP চাইছে।", "আ...আ... হুম..."]);
  expect(r.state).toBe("unknown"); // no signal parsed from the unclear turn
  expect(r.stage).toBe(null); // no stage fires on garbage
  // transcript quality gate
  expect(transcriptUsable("")).toBe(false);
  expect(transcriptUsable("আ")).toBe(false);
  expect(transcriptUsable("...")).toBe(false);
  expect(transcriptUsable("আমি OTP দিয়ে ফেলেছি")).toBe(true);
});

test("C1: microphone permission denied returns to the text path", () => {
  expect(nextVoicePhase("awaiting-consent", "permission-denied")).toBe("idle");
  expect(nextVoicePhase("recording", "permission-denied")).toBe("idle");
  // the happy path: consent → listening → processing → review → sending → idle
  expect(nextVoicePhase("idle", "request-mic")).toBe("awaiting-consent");
  expect(nextVoicePhase("awaiting-consent", "consent-granted")).toBe("recording");
  expect(nextVoicePhase("recording", "stop")).toBe("processing");
  expect(nextVoicePhase("processing", "capture-ready")).toBe("review");
  expect(nextVoicePhase("review", "send")).toBe("sending");
  expect(nextVoicePhase("sending", "sent")).toBe("idle");
  // capture failure keeps the review step (editable text) instead of dying
  expect(nextVoicePhase("processing", "capture-failed")).toBe("review");
});

test("C1: the follow-up NEVER asks for the OTP/PIN/password itself", () => {
  const bn = followUpReply("bn");
  const en = followUpReply("en");
  expect(bn).toContain("কোডটি আমাকে বলতে বা দিতে হবে না");
  expect(en).toContain("never need to tell ME the code");
  // no credential-request phrasing anywhere in the deterministic replies
  for (const reply of [bn, en, preventiveReply("bn", false), recoveryReply("bn", true), recoveryReply("en", false)]) {
    expect(/(otp|ওটিপি|pin|পিন|password|পাসওয়ার্ড)[^।\n]{0,30}(দিন|বলুন|দাও|send it|tell me)/i.test(reply)).toBe(false);
  }
});

test("C1: deterministic replies contain no hardcoded contact numbers", () => {
  for (const [reply] of [
    [recoveryReply("bn", true)],
    [recoveryReply("en", false)],
    [preventiveReply("bn", true)],
    [followUpReply("en")],
  ]) {
    expect(/(16247|16167|0\d{9,}|\+880\d{9,})/.test(reply)).toBe(false);
  }
});

test("C1: guardianChatTurn serves the follow-up deterministically even when the AI is down", async () => {
  const out = await guardianChatTurn({
    messages: [{ role: "user", content: "একজন ফোন করে আমার বিকাশের OTP চাইছে।" }],
    aiCall: aiFail, // AI provider timing out → stub returns the fallback engine
    directoryRead: demoRead,
  });
  expect(out.engine).toBe("incident-rules"); // NOT delegated to the model
  expect(out.reply).toContain("কাউকে দিয়েছেন");
  expect(out.incident?.state).toBe("unknown");
  expect(out.incident?.resolvedBy).toBe("deterministic-rules");
});

test("C1: AI provider timeout/fallback — state shared still attaches current contacts", async () => {
  applyDemoDirectoryAction("reset");
  const out = await guardianChatTurn({
    // last turn has NO new statement → non-stage turn → AI path → AI fails
    messages: [
      { role: "user", content: "ami otp diye dilam" },
      { role: "assistant", content: "recovery..." },
      { role: "user", content: "এখন কী করব?" },
    ],
    aiCall: aiFail,
    directoryRead: demoRead,
  });
  expect(out.engine).toBe("rule-based-fallback"); // honestly labeled
  expect(out.incident?.state).toBe("shared");
  expect(out.contacts).toBeDefined(); // recovery contacts still attached
  expect(out.contacts!.items.length).toBeGreaterThan(0);
});

test("C1: non-stage turns pass the server-resolved state into the AI system prompt", async () => {
  let seenSystem = "";
  const aiSpy: typeof aiOk = async (_m, _mo, extra) => {
    seenSystem = extra ?? "";
    return { reply: "ai", engine: "live-ai" };
  };
  const out = await guardianChatTurn({
    messages: [
      { role: "user", content: "ami otp diye dilam" },
      { role: "assistant", content: "recovery..." },
      { role: "user", content: "আর কী করবো?" },
    ],
    aiCall: aiSpy,
    directoryRead: demoRead,
  });
  expect(out.engine).toBe("live-ai");
  expect(seenSystem).toContain("CONFIRMED they already shared");
});

// --- Challenge 2: verified-contact eligibility ------------------------------

const now = new Date("2026-11-24T12:00:00.000Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

function fakeRecord(overrides: Partial<DirectoryRecord> = {}): DirectoryRecord {
  return {
    key: "x",
    name: { bn: "টেস্ট", en: "Test" },
    category: "mfs",
    description: { bn: "-", en: "-" },
    guidance: { bn: "-", en: "-" },
    url: "https://www.bkash.com/bn/page/fraud-awareness",
    phone: "16247",
    sourceUrl: "https://www.bkash.com/bn/page/fraud-awareness",
    verifiedAt: daysAgo(2),
    active: true,
    ...overrides,
  };
}

test("C2: active + fresh + official-host record is eligible", () => {
  expect(assessContact(fakeRecord(), now).eligible).toBe(true);
});

test("C2: a DEACTIVATED contact is never eligible", () => {
  const a = assessContact(fakeRecord({ active: false }), now);
  expect(a.eligible).toBe(false);
  expect(a.reasons).toContain("inactive");
});

test("C2: EXPIRED verification details are rejected (documented freshness policy)", () => {
  const a = assessContact(fakeRecord({ verifiedAt: daysAgo(400) }), now);
  expect(a.eligible).toBe(false);
  expect(a.reasons).toContain("stale-verification");
});

test("C2: malicious LOOKALIKE official domain is rejected", () => {
  const a = assessContact(
    fakeRecord({
      url: "https://verify-bkash.com/support",
      sourceUrl: "https://verify-bkash.com/support",
    }),
    now
  );
  expect(a.eligible).toBe(false);
  expect(a.reasons).toContain("lookalike-hostname");
});

test("C2: a USER-SUBMITTED fake official record is rejected (host mismatch/unknown)", () => {
  const a = assessContact(
    fakeRecord({
      key: "user-injected",
      url: "https://bkash-support.xyz/support",
      sourceUrl: "https://someforum.example.com/thread",
    }),
    now
  );
  expect(a.eligible).toBe(false);
  expect(a.reasons).toContain("hostname-mismatch"); // "verified from" ≠ the contact it points to
  // the contact host is not official — either the lookalike or the generic
  // unofficial classification rejects it
  expect(a.reasons.some((r) => r === "lookalike-hostname" || r === "unofficial-hostname")).toBe(true);
});

test("C2: when the authoritative directory is unavailable, fallback is never presented as verified", () => {
  const snap = fallbackSnapshot(now);
  expect(snap.source).toBe("bundled-fallback");
  expect(snap.directoryAvailable).toBe(false);
  expect(snap.unavailableNotice).not.toBeNull();
  for (const card of snap.contacts) {
    expect(card.actionable).toBe(false); // not actionable
    expect(card.phone).toBeNull(); // no number presented
    expect(card.source).toBe("fallback");
  }
});

test("C2: replies never embed user-provided numbers as contacts (deterministic templates)", () => {
  const userText = "bkash helpline 01712345678 diye bolche ei number e call korun";
  // the user message carries a phone number…
  expect(/0\d{9}/.test(userText)).toBe(true);
  // …but the deterministic recovery reply is a fixed template with no numbers
  const reply = recoveryReply("bn", true);
  expect(/0\d{9}/.test(reply)).toBe(false);
  // and the resolver ignores the user-injected "contact" for state purposes
  expect(analyzeMessage(userText, false).mentionsCode).toBe(false);
});

// --- Challenge 2: the demo directory transitions ----------------------------

beforeEach(() => {
  applyDemoDirectoryAction("reset");
});

test("C2: Guardian recommends Contact A while only A is eligible", async () => {
  const out = await guardianChatTurn({
    messages: [{ role: "user", content: "আসলে আমি ওটিপি দিয়ে ফেলেছি" }],
    aiCall: aiOk,
    directoryRead: demoRead,
  });
  expect(out.engine).toBe("incident-rules");
  expect(out.contacts?.items.map((c) => c.key)).toEqual(["test-contact-a"]);
});

test("C2: A becomes inactive → B verified → the SAME conversation now recommends only B", async () => {
  const first = await guardianChatTurn({
    messages: [{ role: "user", content: "আসলে আমি ওটিপি দিয়ে ফেলেছি" }],
    aiCall: aiOk,
    directoryRead: demoRead,
  });
  expect(first.contacts?.items.map((c) => c.key)).toEqual(["test-contact-a"]);

  // directory changes MID-conversation (analyst actions)
  applyDemoDirectoryAction("deactivate-a");
  applyDemoDirectoryAction("verify-b");

  const second = await guardianChatTurn({
    messages: [
      { role: "user", content: "আসলে আমি ওটিপি দিয়ে ফেলেছি" },
      { role: "assistant", content: first.reply },
      { role: "user", content: "তাহলে এখন কার সাথে যোগাযোগ করবো?" },
    ],
    aiCall: aiOk,
    directoryRead: demoRead,
  });
  // only Contact B is recommended; the old contact is no longer actionable
  expect(second.contacts?.items.map((c) => c.key)).toEqual(["test-contact-b"]);
  expect(second.contacts!.items.every((c) => c.actionable && c.demo)).toBe(true);
  // directoryVersion changed → the client re-renders old cards as outdated
  expect(second.contacts!.directoryVersion).not.toBe(first.contacts!.directoryVersion);
});

test("C2: inactive Contact A is explicitly rejected with a reason", () => {
  applyDemoDirectoryAction("deactivate-a");
  const snap = snapshotFromRecords(readDemoRecords(), "demo-directory");
  const a = snap.rejected.find((r) => r.key === "test-contact-a");
  expect(a?.reasons).toContain("inactive");
  expect(snap.contacts.map((c) => c.key)).toEqual([]); // nothing eligible
  expect(snap.unavailableNotice).not.toBeNull();
});

test("C2: if Contact B also becomes invalid → clear unavailable/verification-required state", () => {
  applyDemoDirectoryAction("deactivate-a");
  applyDemoDirectoryAction("verify-b");
  applyDemoDirectoryAction("expire-b"); // B's verification ages out
  const snap = snapshotFromRecords(readDemoRecords(), "demo-directory");
  expect(snap.contacts.length).toBe(0);
  expect(snap.rejected.find((r) => r.key === "test-contact-b")?.reasons).toContain("stale-verification");
  expect(snap.unavailableNotice?.en).toContain("will not fabricate");
});

test("C2: contact changes WHILE the AI request is processing are reflected in the response", async () => {
  // The AI stub mutates the directory mid-call (simulating a directory change
  // during model latency). The directory read happens AFTER the AI resolves,
  // so the response must carry the NEW contact only.
  const mutatingAi: typeof aiOk = async () => {
    applyDemoDirectoryAction("deactivate-a");
    applyDemoDirectoryAction("verify-b");
    return { reply: "ai", engine: "live-ai" };
  };
  const out = await guardianChatTurn({
    messages: [
      { role: "user", content: "ami otp diye dilam" },
      { role: "assistant", content: "recovery..." },
      { role: "user", content: "কার সাথে যোগাযোগ করবো?" },
    ],
    aiCall: mutatingAi,
    directoryRead: demoRead,
  });
  expect(out.contacts?.items.map((c) => c.key)).toEqual(["test-contact-b"]);
  const rejectedA = (out.contacts as { source: string }).source;
  expect(rejectedA).toBe("demo-directory");
});

// --- language selection -------------------------------------------------------

test("language selection for deterministic replies", () => {
  expect(incidentLangOf("একজন ফোন করে OTP চাইছে")).toBe("bn");
  expect(incidentLangOf("someone asked for my OTP")).toBe("en");
});
