// GET/POST /api/v1/demo-directory — the ISOLATED demo directory state and
// its transition actions (COU TECHNOVA 2026, Challenge 2 demonstration).
//
// All records are clearly-labeled FICTIONAL test data. Actions mutate the
// in-memory demo directory only — never the real VerifiedResource table and
// never a genuine official contact. The GET response runs the records
// through the SAME eligibility pipeline (assessContact → snapshot) used by
// Guardian replies, so judges can see exactly which contacts are eligible /
// rejected and why at any moment.
import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { applyDemoDirectoryAction, isDemoAction, readDemoRecords, DEMO_DIRECTORY_ACTIONS } from "@/lib/demo-directory";
import { snapshotFromRecords } from "@/lib/verified-contacts";

export async function GET() {
  const snapshot = snapshotFromRecords(readDemoRecords(), "demo-directory");
  return ok({
    testdata: true,
    label: "ISOLATED DEMO DIRECTORY — all contacts are fictional TEST DATA",
    records: readDemoRecords(),
    snapshot,
    actions: DEMO_DIRECTORY_ACTIONS,
  });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "demo-directory"), 40, 5 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ — একটু পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<{ action?: unknown }>(req, 8 * 1024);
  if (!body || !isDemoAction(body.action)) {
    return fail("invalid-action", `অজানা অ্যাকশন। বৈধ: ${DEMO_DIRECTORY_ACTIONS.join(", ")}`, 400);
  }

  const records = applyDemoDirectoryAction(body.action);
  const snapshot = snapshotFromRecords(records, "demo-directory");
  return ok({
    testdata: true,
    applied: body.action,
    records,
    snapshot,
  });
}
