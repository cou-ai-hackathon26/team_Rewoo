// POST /api/v1/analyst/reviews — human evidence review lifecycle actions.
// Every action writes an immutable server-side audit event.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, requireAnalyst } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { SCAM_CATEGORIES } from "@/lib/types";

const ReviewBody = z.object({
  patternId: z.string().uuid().optional(),
  reportId: z.string().regex(/^RPT-[A-Z0-9]{8}$/).optional(),
  action: z.enum(["approve", "reject", "split", "withdraw", "escalate"]),
  reason: z.string().min(10).max(1200),
  expiresDays: z.number().int().min(1).max(365).optional(), // required for approve
  reportIds: z.array(z.string().regex(/^RPT-[A-Z0-9]{8}$/)).max(20).optional(), // for split
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const rl = rateLimit(clientKey(req, "reviews"), 40, 10 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const body = await readJson<unknown>(req, 32 * 1024);
  const parsed = ReviewBody.safeParse(body);
  if (!parsed.success) return fail("invalid-input", "রিভিউ অনুরোধ গ্রহণযোগ্য নয় (কারণ অন্তত ১০ অক্ষরের হতে হবে)।", 422);
  const d = parsed.data;

  // Expiry applies to PATTERN approvals (approved intelligence has a review horizon).
  // Report-level approvals are status changes on evidence and carry no expiry.
  if (d.patternId && d.action === "approve" && !d.expiresDays) {
    return fail("missing-expiry", "প্যাটার্ন অনুমোদনের জন্য মেয়াদ (expiresDays) দিতে হবে।", 422);
  }

  // --- Pattern review ---
  if (d.patternId) {
    const pattern = await db.fraudPattern.findUnique({ where: { id: d.patternId } });
    if (!pattern) return fail("not-found", "প্যাটার্নটি পাওয়া যায়নি।", 404);

    const review = await db.humanReview.create({
      data: {
        patternId: pattern.id,
        reviewerId: session.userId,
        action: d.action,
        reason: d.reason,
        expiresAt:
          d.action === "approve" && d.expiresDays
            ? new Date(Date.now() + d.expiresDays * 24 * 60 * 60 * 1000)
            : null,
      },
    });

    let newStatus = pattern.status;
    switch (d.action) {
      case "approve":
        newStatus = "approved";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "withdraw":
        newStatus = "withdrawn";
        break;
      case "split":
        newStatus = "under_review";
        break;
      case "escalate":
        newStatus = "under_review";
        break;
    }

    const now = new Date();
    await db.fraudPattern.update({
      where: { id: pattern.id },
      data: {
        status: newStatus,
        reviewedAt: now,
        expiresAt:
          d.action === "approve" && d.expiresDays
            ? new Date(Date.now() + d.expiresDays * 24 * 60 * 60 * 1000)
            : d.action === "withdraw"
              ? now
              : pattern.expiresAt,
        // Split: narrow the supporting report set if new reportIds provided
        reportIds:
          d.action === "split" && d.reportIds?.length
            ? (d.reportIds as unknown as object)
            : (pattern.reportIds as unknown as object),
      },
    });

    // Supporting reports follow the pattern decision
    const reportIds = (pattern.reportIds as string[]) ?? [];
    if (d.action === "approve" || d.action === "reject" || d.action === "withdraw") {
      for (const rid of reportIds) {
        await db.report.updateMany({
          where: { id: rid, synthetic: true }, // seeded reports follow decisions
          data: { status: d.action === "approve" ? "approved" : d.action === "reject" ? "rejected" : "withdrawn", reviewedAt: now },
        });
      }
    }

    await db.auditEvent.create({
      data: {
        actorType: "analyst",
        actorId: session.userId,
        action: `pattern.${d.action}`,
        entityType: "FraudPattern",
        entityId: pattern.code,
        detail: {
          reason: d.reason,
          reviewId: review.id,
          expiresDays: d.expiresDays ?? null,
          splitTo: d.reportIds ?? null,
        } as unknown as object,
      },
    });

    return ok({ reviewId: review.id, patternStatus: newStatus });
  }

  // --- Report review (status change on a single report) ---
  if (d.reportId) {
    const report = await db.report.findUnique({ where: { id: d.reportId } });
    if (!report) return fail("not-found", "রিপোর্টটি পাওয়া যায়নি।", 404);

    const map: Record<string, string> = {
      approve: "published", // human-reviewed + anonymized → public community alert
      reject: "rejected",
      split: "under_review",
      withdraw: "withdrawn",
      escalate: "under_review",
    };
    const review = await db.humanReview.create({
      data: {
        reportId: report.id,
        reviewerId: session.userId,
        action: d.action,
        reason: d.reason,
      },
    });

    const newStatus = map[d.action];
    const now = new Date();
    // Publishing derives a public alert from the ALREADY-redacted content.
    // Doxxing guard: never publish phone/identity — only category + pattern.
    const publish = d.action === "approve";
    const alertTitle = publish
      ? `সতর্কতা: ${SCAM_CATEGORIES[report.category]?.bn ?? report.category} ধরনের প্রতারণার চেষ্টা রিপোর্ট হয়েছে`
      : null;
    const alertBody = publish
      ? redactForAlert(report.contentRedacted)
      : null;

    await db.report.update({
      where: { id: report.id },
      data: {
        status: newStatus,
        reviewedAt: now,
        ...(publish
          ? {
              publishedAt: now,
              title: alertTitle,
              alertBody,
            }
          : {}),
      },
    });
    await db.auditEvent.create({
      data: {
        actorType: "analyst",
        actorId: session.userId,
        action: `report.${d.action}`,
        entityType: "Report",
        entityId: report.id,
        detail: {
          reason: d.reason,
          reviewId: review.id,
          published: publish,
        } as unknown as object,
      },
    });
    return ok({ reviewId: review.id, reportStatus: newStatus, published: publish });
  }

  return fail("invalid-input", "patternId বা reportId একটি দিতে হবে।", 422);
}

/**
 * Doxxing guard for public alerts: extra scrub on top of the submission-time
 * redaction — removes digits, URLs and any bracketed redaction markers from
 * the public body so only the pattern/story remains.
 */
function redactForAlert(text: string): string {
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[লিংক সরানো হয়েছে]")
    .replace(/(?<!\d)\d{4,}(?!\d)/g, "[গোপন]")
    .replace(/\[মোবাইল[^\]]*\]/g, "[নম্বর সরানো হয়েছে]")
    .replace(/\[নম্বর[^\]]*\]/g, "[নম্বর সরানো হয়েছে]")
    .slice(0, 400);
}
