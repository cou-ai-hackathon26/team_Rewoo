// DELETE /api/v1/reports/{id} — withdraw a community report.
// F-03 fix (V8): the public reference id alone can no longer withdraw a
// report. Withdrawal requires either
//   a) the one-time receipt token issued to the submitter at creation time
//      (sha256-compared against the stored hash), or
//   b) an authenticated member session owning the report (author).
// Legacy reports without a stored hash can only be withdrawn by their author.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { ok, fail } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { getMemberSession } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^RPT-[A-Z0-9]{8}$/.test(id)) return fail("invalid-id", "ভুল রেফারেন্স আইডি।", 400);

  const rl = rateLimit(clientKey(req, "report-withdraw"), 10, 60 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429);

  const report = await db.report.findUnique({ where: { id } });
  if (!report) return fail("not-found", "এই রেফারেন্সে কোনো রিপোর্ট নেই।", 404);
  if (report.status === "withdrawn") return ok({ id, status: "withdrawn", already: true });

  // Authorization: receipt token (submitter) OR member authorship.
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  const tokenOk =
    report.withdrawTokenHash !== null && token.length > 0 && sha256Hex(token) === report.withdrawTokenHash;

  let actor = "";
  if (tokenOk) {
    actor = "receipt-token-holder";
  } else {
    const member = await getMemberSession();
    if (member && report.authorId && member.userId === report.authorId) {
      actor = "member-author";
    } else {
      return fail(
        "not-authorized",
        "প্রত্যাহার করতে জমা দেওয়ার সময় পাওয়া রশিদ-টোকেনটি দিন (বা নিজের সদস্য একাউন্ট থেকে ঢুকে করুন)। শুধু রেফারেন্স আইডি দিয়ে প্রত্যাহার করা যায় না।",
        403
      );
    }
  }

  await db.report.update({
    where: { id },
    data: { status: "withdrawn", reviewedAt: new Date() },
  });
  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      action: "report.withdrawn",
      entityType: "Report",
      entityId: id,
      detail: { by: actor } as unknown as object,
    },
  });

  return ok({ id, status: "withdrawn" });
}
