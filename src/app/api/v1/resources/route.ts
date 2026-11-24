// GET /api/v1/resources — verified resource directory (trusted contacts only)
// Reads from the database; falls back to a bundled snapshot when the DB is
// empty or unreachable so the emergency directory ALWAYS works.
//
// COU TECHNOVA 2026 (Challenge 2, additive fields only — the response shape
// stays backward compatible): every record now carries `eligible` +
// `exclusionReasons` from the same documented freshness/hostname policy the
// Guardian uses (active + verifiedAt age + official hostname). The Emergency
// Help page keeps working exactly as before — these fields let callers
// (e.g. the help-page one-tap card) avoid recommending a stale or
// deactivated contact, and `contactPolicy` documents the freshness rule.
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { BUNDLED_RESOURCES } from "@/lib/resources-fallback";
import { assessContact, CONTACT_MAX_AGE_DAYS, CONTACT_SKEW_DAYS, type DirectoryRecord } from "@/lib/verified-contacts";

export async function GET() {
  let rows: Awaited<ReturnType<typeof fetchResources>> | null = null;
  try {
    rows = await fetchResources();
  } catch {
    rows = null; // DB unreachable → bundled fallback below
  }

  const policy = { maxAgeDays: CONTACT_MAX_AGE_DAYS, skewDays: CONTACT_SKEW_DAYS };

  if (!rows || rows.length === 0) {
    return ok({
      resources: BUNDLED_RESOURCES.map((r) => ({ ...r, eligible: false, exclusionReasons: ["fallback-snapshot"] })),
      source: "bundled-fallback",
      contactPolicy: policy,
    });
  }

  const now = new Date();
  return ok({
    resources: rows.map((r) => {
      const record: DirectoryRecord = {
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
      };
      const assessment = assessContact(record, now);
      return {
        key: r.key,
        name: r.name,
        category: r.category,
        description: r.description,
        guidance: r.guidance,
        url: r.url,
        phone: r.phone,
        sourceUrl: r.sourceUrl,
        verifiedAt: r.verifiedAt.toISOString(),
        eligible: assessment.eligible,
        exclusionReasons: assessment.reasons,
      };
    }),
    source: "database",
    contactPolicy: policy,
  });
}

function fetchResources() {
  return db.verifiedResource.findMany({
    where: { active: true },
    orderBy: { sort: "asc" },
  });
}
