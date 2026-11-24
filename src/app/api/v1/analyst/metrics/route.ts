// GET /api/v1/analyst/metrics — validated metrics computed from the database.
// Analyst-only. No fabricated numbers: every figure is a real COUNT from SQL.
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireAnalyst } from "@/lib/api";

export async function GET() {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const [
    totalReports,
    submitted,
    candidate,
    underReview,
    approvedReports,
    rejectedReports,
    withdrawnReports,
    patternsTotal,
    patternsApproved,
    patternsCandidate,
    patternsRejected,
    patternsWithdrawn,
    reviewCount,
    auditCount,
  ] = await Promise.all([
    db.report.count(),
    db.report.count({ where: { status: "submitted" } }),
    db.report.count({ where: { status: "candidate" } }),
    db.report.count({ where: { status: "under_review" } }),
    db.report.count({ where: { status: "approved" } }),
    db.report.count({ where: { status: "rejected" } }),
    db.report.count({ where: { status: "withdrawn" } }),
    db.fraudPattern.count(),
    db.fraudPattern.count({ where: { status: "approved" } }),
    db.fraudPattern.count({ where: { status: "candidate" } }),
    db.fraudPattern.count({ where: { status: "rejected" } }),
    db.fraudPattern.count({ where: { status: "withdrawn" } }),
    db.humanReview.count(),
    db.auditEvent.count(),
  ]);

  // 14-day trend of report submissions
  const allReports = await db.report.findMany({
    select: { submittedAt: true, category: true, synthetic: true, status: true },
  });
  const trend: { date: string; count: number; synthetic: number; citizen: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now - i * DAY);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const inDay = allReports.filter((r) => r.submittedAt >= dayStart && r.submittedAt < dayEnd);
    trend.push({
      date: dayStart.toISOString().slice(0, 10),
      count: inDay.length,
      synthetic: inDay.filter((r) => r.synthetic).length,
      citizen: inDay.filter((r) => !r.synthetic).length,
    });
  }

  // Category distribution
  const catMap = new Map<string, number>();
  for (const r of allReports) catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
  const categories = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Review outcomes
  const reviews = await db.humanReview.findMany({ select: { action: true, createdAt: true } });
  const outcomes = ["approve", "reject", "split", "withdraw", "escalate"].map((action) => ({
    action,
    count: reviews.filter((r) => r.action === action).length,
  }));

  // Approved, non-expired patterns are the only trusted intelligence
  const trustedPatterns = await db.fraudPattern.count({
    where: { status: "approved", expiresAt: { gt: new Date() } },
  });

  return ok({
    reports: {
      total: totalReports,
      byStatus: { submitted, candidate, underReview, approved: approvedReports, rejected: rejectedReports, withdrawn: withdrawnReports },
      queueDepth: submitted + candidate + underReview,
      syntheticCount: allReports.filter((r) => r.synthetic).length,
      citizenCount: allReports.filter((r) => !r.synthetic).length,
    },
    patterns: {
      total: patternsTotal,
      approved: patternsApproved,
      candidate: patternsCandidate,
      rejected: patternsRejected,
      withdrawn: patternsWithdrawn,
      trustedActive: trustedPatterns,
    },
    reviews: { total: reviewCount, outcomes },
    audit: { total: auditCount },
    trend,
    categories,
    computedAt: new Date().toISOString(),
  });
}
