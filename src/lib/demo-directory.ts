// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Challenge 2: the ISOLATED demo directory.
//
// A separate, in-memory directory of clearly-labeled FICTIONAL contacts
// ("Contact A" / "Contact B"). It never touches the real VerifiedResource
// table, the real Emergency Help page, or any genuine official contact.
//
// The judge demonstration mutates THIS data (deactivate A, verify B, expire
// B…) through /api/v1/demo-directory actions; every Guardian reply in the
// demo environment re-reads it through the SAME eligibility pipeline
// (src/lib/verified-contacts.ts) — the transitions are driven by directory
// data, never by a hardcoded demo response.
//
// In-memory on purpose: per-instance, resettable, no persistence, no
// pollution of any database. TEST DATA only.
// ---------------------------------------------------------------------------

import type { DirectoryRecord } from "./verified-contacts";

interface DemoAction {
  type: "deactivate-a" | "verify-b" | "deactivate-b" | "expire-b" | "restore-a" | "reset";
}

const TEST_TAG = "TEST DATA";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function initialRecords(): DirectoryRecord[] {
  return [
    {
      key: "test-contact-a",
      name: {
        bn: `কাল্পনিক যোগাযোগ এ — “টেস্ট ব্যাংক এ” সহায়তা (${TEST_TAG})`,
        en: `Fictional Contact A — “Test Bank A” support (${TEST_TAG})`,
      },
      category: "bank",
      description: {
        bn: "বিচ্ছিন্ন ডেমো পরিবেশের কাল্পনিক ব্যাংক — সম্পূর্ণ পরীক্ষামূলক তথ্য।",
        en: "Fictional bank of the isolated demo environment — entirely test data.",
      },
      guidance: {
        bn: "নিজে থেকে এই নম্বরে কল করুন (ডেমো নম্বর — বাস্তব নয়)।",
        en: "Call this number yourself (demo number — not real).",
      },
      url: "https://test-bank-a.example.com/support",
      phone: "09000000001",
      sourceUrl: "https://test-bank-a.example.com/support",
      verifiedAt: daysAgo(2),
      active: true,
      demo: true,
    },
    {
      key: "test-contact-b",
      name: {
        bn: `কাল্পনিক যোগাযোগ বি — “টেস্ট ব্যাংক বি” সহায়তা (${TEST_TAG})`,
        en: `Fictional Contact B — “Test Bank B” support (${TEST_TAG})`,
      },
      category: "bank",
      description: {
        bn: "বিচ্ছিন্ন ডেমো পরিবেশের দ্বিতীয় কাল্পনিক ব্যাংক — সম্পূর্ণ পরীক্ষামূলক তথ্য।",
        en: "Second fictional bank of the isolated demo environment — entirely test data.",
      },
      guidance: {
        bn: "নিজে থেকে এই নম্বরে কল করুন (ডেমো নম্বর — বাস্তব নয়)।",
        en: "Call this number yourself (demo number — not real).",
      },
      url: "https://test-bank-b.example.com/support",
      phone: "09000000002",
      sourceUrl: "https://test-bank-b.example.com/support",
      verifiedAt: daysAgo(1),
      active: false, // B starts UNVERIFIED/inactive — A is the initial contact
      demo: true,
    },
  ];
}

// Per-server-instance state (resets on cold start / via the reset action).
const globalForDemo = globalThis as unknown as { __banglashieldDemoDirectory?: DirectoryRecord[] };
if (!globalForDemo.__banglashieldDemoDirectory) {
  globalForDemo.__banglashieldDemoDirectory = initialRecords();
}

function records(): DirectoryRecord[] {
  return globalForDemo.__banglashieldDemoDirectory!;
}

export function readDemoRecords(): DirectoryRecord[] {
  // Return copies so callers can never mutate state without an action.
  return records().map((r) => ({ ...r }));
}

export const DEMO_DIRECTORY_ACTIONS = [
  "deactivate-a",
  "verify-b",
  "deactivate-b",
  "expire-b",
  "restore-a",
  "reset",
] as const;

export function applyDemoDirectoryAction(action: DemoAction["type"]): DirectoryRecord[] {
  const rs = records();
  const byKey = (k: string) => rs.find((r) => r.key === k);
  switch (action) {
    case "deactivate-a": {
      const a = byKey("test-contact-a");
      if (a) a.active = false;
      break;
    }
    case "verify-b": {
      const b = byKey("test-contact-b");
      if (b) {
        b.active = true;
        b.verifiedAt = new Date(); // newly verified NOW
      }
      break;
    }
    case "deactivate-b": {
      const b = byKey("test-contact-b");
      if (b) b.active = false;
      break;
    }
    case "expire-b": {
      const b = byKey("test-contact-b");
      if (b) {
        b.active = true;
        b.verifiedAt = daysAgo(400); // verification aged out → stale
      }
      break;
    }
    case "restore-a": {
      const a = byKey("test-contact-a");
      if (a) {
        a.active = true;
        a.verifiedAt = daysAgo(2);
      }
      break;
    }
    case "reset": {
      globalForDemo.__banglashieldDemoDirectory = initialRecords();
      break;
    }
    default: {
      const never: never = action;
      throw new Error(`unknown-demo-action: ${never}`);
    }
  }
  return readDemoRecords();
}

export function isDemoAction(v: unknown): v is DemoAction["type"] {
  return typeof v === "string" && (DEMO_DIRECTORY_ACTIONS as readonly string[]).includes(v);
}
