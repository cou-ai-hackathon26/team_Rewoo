// GET /api/v1/community/alerts — public, published, human-reviewed community
// alerts. Only sufficiently anonymized, moderator-approved reports appear
// here. No personal data, no AI-generated accusations.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "community-alerts"), 60, 60_000);
  if (!rl.ok) return ok({ alerts: [] }, { status: 429 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 50);

  const reports = await db.report.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      title: true,
      alertBody: true,
      synthetic: true,
      publishedAt: true,
    },
  });

  return ok({
    alerts: reports.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title ?? "সতর্কতা",
      body: r.alertBody ?? "",
      synthetic: r.synthetic, // demo seed data stays clearly labeled
      publishedAt: (r.publishedAt ?? r.publishedAt)?.toISOString() ?? null,
    })),
    note: "প্রকাশিত সতর্কতাগুলো মানব-রিভিউ হয়েছে এবং ব্যক্তিগত তথ্য থেকে মুক্ত।",
  });
}
