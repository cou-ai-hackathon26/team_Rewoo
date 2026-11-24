// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 1: deterministic incident-flow replies.
//
// Bilingual (bn default, en mirror) stage replies for the Guardian incident
// flow. Pure functions — the Guardian chat route calls them when the
// incident-state resolver produces a stage, and also when the AI provider is
// down, so the flow works with NO model at all.
//
// Doctrine (mirrors the app's safety rules):
//   - Never ask for the actual OTP/PIN/password — only whether it was shared.
//   - Never print a contact number — official contacts arrive exclusively as
//     server-validated directory cards (Challenge 2), never in reply text.
//   - Every deterministic reply is self-labeled as rule-based.
// ---------------------------------------------------------------------------

import type { IncidentResolution } from "./incident-state";

const LABEL_BN = "— শিল্ডএজেন্ট · নিয়মভিত্তিক ঘটনা-প্রবাহ (নির্ধারিত, এআই-নির্ভর নয়)";
const LABEL_EN = "— ShieldAgent · deterministic incident flow (rule-based, not AI)";

export function followUpReply(lang: "bn" | "en"): string {
  const bn = `বুঝলাম — কেউ আপনার একাউন্টের OTP/কোড চাইছে। এটি প্রতারণার সবচেয়ে কমন কৌশল।

আগে একটা প্রশ্ন: আপনি কি ইতিমধ্যে ওই কোডটি কাউকে দিয়েছেন?
(কোডটি আমাকে বলতে বা দিতে হবে না — শুধু দিয়েছেন কি না, সেটা জানা দরকার।)

ততক্ষণে যা করবেন:
• কোড চাওয়া কল/বার্তার সাথে কথা বন্ধ করে দিন
• বার্তায় আসা নম্বরে ফোন দেবেন না — নিজে অ্যাপ খুলে হেল্প থেকে যোগাযোগ করুন
• কেউ অতি জরুরি বলে চাপ দিলে — সেটাই সন্দেহের কারণ

${LABEL_BN}`;
  const en = `Understood — someone is asking for your account OTP/code. This is one of the most common scam tactics.

One question first: have you already shared that code with anyone?
(You never need to tell ME the code — I only need to know whether you shared it.)

Meanwhile:
• Stop talking to whoever asked for the code
• Do not call numbers from the message — contact support yourself inside the official app
• Urgency pressure is itself the warning sign

${LABEL_EN}`;
  return lang === "bn" ? bn : en;
}

export function preventiveReply(lang: "bn" | "en", correction: boolean): string {
  const head = correction
    ? "ধন্যবাদ সংশোধনের জন্য — আপনি কোড দেননি, এটুকুই আসল খবর।"
    : "ভালো — আপনি কোড দেননি। এখন নিজেকে সুরক্ষিত রাখুন:";
  const bn = `${head}
• OTP কখনো কাউকে দেবেন না — প্রতিষ্ঠান কখনো এটি চায় না; চাইলেই প্রতারক
• যোগাযোগের জন্য বার্তার নম্বর নয় — নিজে অ্যাপের ভেতরের হেল্প বা পরিচিত নম্বর ব্যবহার করুন
• যদি আবার ফোন আসে, কথা না বাড়িয়ে কেটে দিন
• বার্তা/কলের প্রমাণ সংরক্ষণ করুন — ভবিষ্যতে অভিযোগে কাজে লাগবে

সন্দেহ হলে Guardian-এর সাথে কথা চালিয়ে যান।

${LABEL_BN}`;
  const en = `Good — you have not shared the code. Keep yourself protected:
• Never share an OTP with anyone — institutions never ask for it; anyone who does is a scammer
• Use in-app support or a known number to contact anyone — never numbers from the message
• If they call again, end the call instead of prolonging it
• Keep evidence of the message/call — it helps a future complaint

If unsure, keep talking here in Guardian.

${LABEL_EN}`;
  return lang === "bn" ? bn : en;
}

export function recoveryReply(lang: "bn" | "en", correction: boolean): string {
  const head = correction
    ? "ঠিক আছে — আপনি কোডটা দিয়ে ফেলেছেন। আতঙ্ক নয়, এখনই নিচের ধাপগুলো চালু করুন:"
    : "আপনি কোডটি দিয়ে ফেলেছেন বলে জানালেন — এখনই প্রথম কয়েকটা ধাপ সবচেয়ে জরুরি:";
  const bn = `${head}

এখনই করুন:
১. নিজের অ্যাপে ঢুকে পিন/পাসওয়ার্ড এখনই বদলান
২. অ্যাপের ভেতরের হেল্প বা সাপোর্টে নিজে যোগাযোগ করে সাম্প্রতিক লেনদেন পর্যালোচনা করুন — অজানা লেনদেন থামানোর অনুরোধ করুন
৩. প্রমাণ সংরক্ষণ করুন: কলের তারিখ-সময়, নম্বর, বার্তার স্ক্রিনশট
৪. বড় অঙ্কের টাকা গেলে আইন-প্রয়োগকারী সংস্থায় অভিযোগ করুন (নিচের যাচাইকৃত তালিকায় নম্বর)

নিচের কার্ডগুলো সার্ভারের যাচাইকৃত ডিরেক্টরি থেকে এখনই পড়ে আনা — নম্বর বানানো নয়। কারও দেওয়া নম্বর বা বার্তায় আসা নম্বরে কল করবেন না; নিজে থেকে কার্ডের নম্বরে কল করুন।

${LABEL_BN}`;
  const en = `You said you already shared the code — the first few steps are the most urgent:

Do this now:
1. Change your PIN/password immediately inside your own app
2. Contact in-app support yourself to review recent transactions and request a stop on unknown ones
3. Preserve evidence: date/time of the call, the number, message screenshots
4. For significant loss, file a complaint with law enforcement (number in the verified list below)

The cards below are fetched from the server's verified directory right now — never fabricated numbers. Do not call numbers someone gave you or that arrived inside messages; call the card numbers yourself.

${LABEL_EN}`;
  return lang === "bn" ? bn : en;
}

/** AI-context block for non-stage turns (deterministic state → prompt). */
export function incidentSystemContext(r: IncidentResolution): string {
  if (r.state === "shared") {
    return "INCIDENT STATE (server-resolved, deterministic): the user has CONFIRMED they already shared a verification code/OTP. Lead with recovery: PIN change in their own app, in-app official support for transaction review, evidence preservation, law enforcement for significant loss. NEVER ask for or accept the OTP/PIN/password itself. NEVER invent contact numbers or URLs — official contacts are shown separately from the platform's server-verified directory.";
  }
  if (r.state === "not_shared") {
    return "INCIDENT STATE (server-resolved, deterministic): the user has CONFIRMED they did NOT share the code. Give preventive guidance (never share OTPs, verify through in-app support, keep evidence). Never treat the incident as resolved-with-harm.";
  }
  if (r.codeTopicSeen) {
    return "INCIDENT STATE (server-resolved, deterministic): the user mentioned a verification code topic but the sharing status is UNKNOWN. If the sharing question has not been answered yet, ask once whether they already shared the code (never ask for the code itself) before giving advice.";
  }
  return "";
}
