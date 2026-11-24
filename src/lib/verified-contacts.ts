// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 2 core: dynamic verified-contact directory.
//
// Every Guardian recommendation of an official contact MUST come from a
// server-side directory read performed at response time:
//   - Prisma `VerifiedResource` is the authoritative source (live mode).
//   - An isolated, clearly-labeled in-memory demo directory (demo mode, see
//     src/lib/demo-directory.ts) drives the judge demonstration — through
//     this SAME eligibility pipeline, never a hardcoded demo response.
//
// Freshness / trust policy (documented, deterministic):
//   1. `active` must be true (an analyst deactivated the record → never
//      recommend it again).
//   2. `verifiedAt` must be within CONTACT_MAX_AGE_DAYS (180 days) — a
//      record whose verification has aged out is "stale-verification" and is
//      not presented as currently verified.
//   3. `verifiedAt` in the future beyond CLOCK_SKEW_DAYS (2 days) is rejected
//      as "future-verification".
//   4. `url` and `sourceUrl` must be https and their hostnames must match the
//      official host allowlist for the record's mode (live official domains
//      or the fictional demo domains) — lookalike domains that embed a real
//      brand token ("verify-bkash.com") are rejected as lookalikes.
//   5. User-provided or LLM-generated numbers are NEVER used: cards are built
//      exclusively from these directory records on the server.
//
// When the authoritative directory is unavailable, the bundled fallback
// snapshot may keep the Emergency Help page working — but fallback entries
// are marked `verified: false / actionable: false` so they are never
// presented as CURRENTLY verified inside Guardian conversations.
// ---------------------------------------------------------------------------

import { db } from "./db";
import { BUNDLED_RESOURCES } from "./resources-fallback";

/** A record is "fresh" for this many days after its verification date. */
export const CONTACT_MAX_AGE_DAYS = 180;
/** verifiedAt may be at most this far in the future (clock skew tolerance). */
export const CONTACT_SKEW_DAYS = 2;

/** Official hostnames for live records (subdomains included). */
export const OFFICIAL_HOSTS = [
  "bkash.com",
  "nagad.com.bd",
  "bb.org.bd",
  "police.gov.bd",
  "cirt.gov.bd",
  "gov.bd",
];

/** Fictional hostnames reserved for the isolated demo directory (TEST DATA). */
export const DEMO_HOSTS = ["test-bank-a.example.com", "test-bank-b.example.com"];

export type ExclusionReason =
  | "inactive"
  | "stale-verification"
  | "future-verification"
  | "invalid-url"
  | "hostname-mismatch"
  | "unofficial-hostname"
  | "lookalike-hostname";

export interface DirectoryRecord {
  key: string;
  name: { bn: string; en: string };
  category: string;
  description: { bn: string; en: string };
  guidance: { bn: string; en: string };
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: Date | string;
  active: boolean;
  /** True only for clearly-labeled fictional demo-directory records. */
  demo?: boolean;
}

export interface ContactAssessment {
  record: DirectoryRecord;
  eligible: boolean;
  reasons: ExclusionReason[];
}

export interface ContactCard {
  key: string;
  name: { bn: string; en: string };
  category: string;
  phone: string | null;
  url: string;
  guidance: { bn: string; en: string };
  verifiedAt: string;
  /** "directory" (live DB) | "fallback" (bundled snapshot) | "demo" (test data). */
  source: "directory" | "fallback" | "demo";
  /** Only server-validated directory/demo records are actionable. */
  actionable: boolean;
  /** Fictional demo-directory record — always labeled TEST DATA. */
  demo: boolean;
}

export interface ContactDirectorySnapshot {
  source: "database" | "bundled-fallback" | "demo-directory";
  directoryAvailable: boolean;
  policy: { maxAgeDays: number; skewDays: number; checkedAt: string };
  directoryVersion: string;
  contacts: ContactCard[];
  rejected: { key: string; reasons: ExclusionReason[] }[];
  /** Set when no eligible contact exists — guidance without fabrication. */
  unavailableNotice: { bn: string; en: string } | null;
}

// --- hostname checks --------------------------------------------------------

export function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostIsWithin(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

function hostAllowed(host: string, demo: boolean): boolean {
  const list = demo ? DEMO_HOSTS : OFFICIAL_HOSTS;
  return list.some((base) => hostIsWithin(host, base));
}

/** Brand tokens used to catch lookalike domains ("bkash-support.xyz"). */
const BRAND_TOKENS = ["bkash", "nagad", "bangladesh-bank", "bb.org", "police", "cirt"];

function hostIsLookalike(host: string, demo: boolean): boolean {
  if (demo) return false; // fictional demo hosts never embed real brand tokens
  for (const token of BRAND_TOKENS) {
    if (host.includes(token) && !OFFICIAL_HOSTS.some((base) => hostIsWithin(host, base))) {
      return true;
    }
  }
  return false;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Deterministic per-record eligibility check (pure). */
export function assessContact(record: DirectoryRecord, now: Date = new Date()): ContactAssessment {
  const reasons: ExclusionReason[] = [];
  const demo = record.demo === true;

  if (!record.active) reasons.push("inactive");

  const verifiedAt = toDate(record.verifiedAt);
  const ageDays = (now.getTime() - verifiedAt.getTime()) / 86_400_000;
  if (ageDays > CONTACT_MAX_AGE_DAYS) reasons.push("stale-verification");
  if (ageDays < -CONTACT_SKEW_DAYS) reasons.push("future-verification");

  const urlHost = hostOf(record.url);
  const sourceHost = hostOf(record.sourceUrl);
  if (!urlHost || !sourceHost) {
    reasons.push("invalid-url");
  } else {
    if (urlHost !== sourceHost && !hostIsWithin(sourceHost, urlHost) && !hostIsWithin(urlHost, sourceHost)) {
      reasons.push("hostname-mismatch");
    }
    if (!hostAllowed(urlHost, demo) || !hostAllowed(sourceHost, demo)) {
      // A host embedding a real brand token ("verify-bkash.com") is the
      // specific, dangerous lookalike case; generic unknown hosts are simply
      // unofficial.
      if (hostIsLookalike(urlHost, demo) || hostIsLookalike(sourceHost, demo)) {
        reasons.push("lookalike-hostname");
      } else {
        reasons.push("unofficial-hostname");
      }
    }
  }

  return { record, eligible: reasons.length === 0, reasons };
}

/** Filter a record set through the policy — returns ALL assessments. */
export function filterEligibleContacts(records: DirectoryRecord[], now: Date = new Date()): ContactAssessment[] {
  return records.map((r) => assessContact(r, now));
}

/** Stable version token of a directory state (used for card refresh). */
export function directoryVersionFrom(records: DirectoryRecord[], source: string): string {
  const material =
    source +
    "|" +
    [...records]
      .map((r) => `${r.key}:${r.active ? 1 : 0}:${toDate(r.verifiedAt).toISOString()}`)
      .sort()
      .join("|");
  let h1 = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    h1 ^= material.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return `${source}.${h1.toString(16).padStart(8, "0")}`;
}

function cardOf(record: DirectoryRecord, source: "directory" | "fallback" | "demo", actionable: boolean): ContactCard {
  return {
    key: record.key,
    name: record.name,
    category: record.category,
    phone: actionable ? record.phone : null,
    url: record.url,
    guidance: record.guidance,
    verifiedAt: toDate(record.verifiedAt).toISOString(),
    source,
    actionable,
    demo: record.demo === true,
  };
}

const NO_CURRENT_CONTACT = {
  bn: "এখন ডিরেক্টরিতে বর্তমানে যাচাইকৃত কোনো যোগাযোগ নেই। কোনো নম্বর বানিয়ে দেওয়া হবে না — নিজে প্রতিষ্ঠানের অফিসিয়াল অ্যাপ বা মুদ্রিত নথি থেকে যোগাযোগ ঠিকানা যাচাই করে নিন।",
  en: "No currently verified contact exists in the directory right now. We will not fabricate a number — verify the institution's contact yourself from its official app or printed documents.",
};

/** Build a snapshot from already-read records (pure — used by live, demo and tests). */
export function snapshotFromRecords(
  records: DirectoryRecord[],
  source: "database" | "demo-directory",
  now: Date = new Date()
): ContactDirectorySnapshot {
  const assessments = filterEligibleContacts(records, now);
  const eligible = assessments.filter((a) => a.eligible);
  return {
    source,
    directoryAvailable: true,
    policy: { maxAgeDays: CONTACT_MAX_AGE_DAYS, skewDays: CONTACT_SKEW_DAYS, checkedAt: now.toISOString() },
    directoryVersion: directoryVersionFrom(records, source),
    contacts: eligible.map((a) => cardOf(a.record, source === "demo-directory" ? "demo" : "directory", true)),
    rejected: assessments.filter((a) => !a.eligible).map((a) => ({ key: a.record.key, reasons: a.reasons })),
    unavailableNotice: eligible.length === 0 ? NO_CURRENT_CONTACT : null,
  };
}

/** Bundled-fallback snapshot — never presented as currently verified. */
export function fallbackSnapshot(now: Date = new Date()): ContactDirectorySnapshot {
  const records: DirectoryRecord[] = BUNDLED_RESOURCES.map((r) => ({
    key: r.key,
    name: r.name,
    category: r.category,
    description: r.description,
    guidance: r.guidance,
    url: r.url,
    phone: r.phone,
    sourceUrl: r.sourceUrl,
    verifiedAt: r.verifiedAt,
    active: true,
  }));
  return {
    source: "bundled-fallback",
    directoryAvailable: false,
    policy: { maxAgeDays: CONTACT_MAX_AGE_DAYS, skewDays: CONTACT_SKEW_DAYS, checkedAt: now.toISOString() },
    directoryVersion: directoryVersionFrom(records, "bundled-fallback"),
    // Fallback entries: name/domain/guidance only — no actionable phone,
    // explicitly NOT currently verified.
    contacts: records.map((r) => ({ ...cardOf(r, "fallback", false), phone: null })),
    rejected: [],
    unavailableNotice: {
      bn: "ডিরেক্টরি সার্ভার এখন পাওয়া যাচ্ছে না — নিচের তথ্যগুলো পুরনো স্ন্যাপশট, বর্তমানে যাচাইকৃত নয়। নম্বর ডেমো হিসেবে দেওয়া হচ্ছে না; নিজে অফিসিয়াল অ্যাপ/নথি থেকে যাচাই করুন।",
      en: "The verified directory is unreachable right now — the entries below are a bundled snapshot, not currently verified. No numbers are given; verify contacts yourself from the official app or printed documents.",
    },
  };
}

/** Read the live Prisma directory (active rows, eligibility applied). */
export async function readLiveRecords(): Promise<DirectoryRecord[] | null> {
  try {
    const rows = await db.verifiedResource.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
    return rows.map((r) => ({
      key: r.key,
      name: r.name as { bn: string; en: string },
      category: r.category,
      description: r.description as { bn: string; en: string },
      guidance: r.guidance as { bn: string; en: string },
      url: r.url,
      phone: r.phone,
      sourceUrl: r.sourceUrl,
      verifiedAt: r.verifiedAt,
      active: r.active,
    }));
  } catch {
    return null; // DB unreachable — caller must NOT present fallback as verified
  }
}

/**
 * THE lookup used by Guardian responses. `directory: "demo"` reads the
 * isolated demo directory (TEST DATA) through the same pipeline; `"live"`
 * reads Prisma and falls back to the bundled snapshot (labeled
 * not-currently-verified) only when the DB is unavailable.
 */
export async function getVerifiedContacts(
  opts: { directory?: "live" | "demo"; now?: Date } = {}
): Promise<ContactDirectorySnapshot> {
  const now = opts.now ?? new Date();
  if (opts.directory === "demo") {
    const { readDemoRecords } = await import("./demo-directory");
    return snapshotFromRecords(readDemoRecords(), "demo-directory", now);
  }

  const records = await readLiveRecords();
  if (records === null || records.length === 0) {
    return fallbackSnapshot(now);
  }
  return snapshotFromRecords(records, "database", now);
}
