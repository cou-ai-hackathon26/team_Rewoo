// GET /api/v1/analyst/reports — review queue with redacted evidence.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAnalyst } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "queue"; // queue = pending + legacy submitted/candidate + under_review
  const category = sp.get("category") ?? "all";
  const q = (sp.get("q") ?? "").toLowerCase().slice(0, 80);

  const statusWhere =
    status === "all"
      ? {}
      : status === "queue"
        ? { status: { in: ["pending", "submitted", "candidate", "under_review"] } }
        : { status };

  const reports = await db.report.findMany({
    where: {
      ...statusWhere,
      ...(category !== "all" ? { category } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: { session: { select: { id: true, riskCategory: true, scamCategory: true, engine: true } } },
  });

  const filtered = q
    ? reports.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.contentRedacted.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      )
    : reports;

  return ok({
    reports: filtered.map((r) => ({
      id: r.id,
      category: r.category,
      riskCategory: r.riskCategory ?? r.session?.riskCategory ?? null,
      status: r.status,
      synthetic: r.synthetic,
      submittedAt: r.submittedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      contentRedacted: r.contentRedacted,
      indicators: r.indicators,
      linkedCase: r.session
        ? { id: r.session.id, scamCategory: r.session.scamCategory, engine: r.session.engine }
        : null,
    })),
  });
}
