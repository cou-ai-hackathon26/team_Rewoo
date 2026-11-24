// Community posts — GET feed (public) + POST create (member auth).
// Posts are Facebook-style: alert / help-request / experience, text + image.
// Every post is auto-assessed by ShieldAgent (labeled, unverified) and help
// requests get an immediate AI first response while humans reply.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { getMemberSession } from "@/lib/auth";
import { newPostRef } from "@/lib/crypto";
import { redactCodesAndIds } from "@/lib/redact";
import { assessCommunityPost, agentHelpFirstReply } from "@/lib/shield-agent";

const KINDS = ["alert", "help", "experience"] as const;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 1.6 * 1024 * 1024; // ~1.2 MB decoded

function postView(p: {
  id: string;
  ref: string;
  kind: string;
  body: string;
  imageData: string | null;
  aiRisk: string;
  aiSignals: unknown;
  aiSummary: unknown;
  aiEngine: string | null;
  status: string;
  synthetic: boolean;
  helpfulCount: number;
  commentCount: number;
  createdAt: Date;
  author: { publicId: string | null; name: string | null; username: string | null } | null;
}, markedHelpful: boolean) {
  return {
    id: p.id,
    ref: p.ref,
    kind: p.kind,
    body: p.body,
    hasImage: Boolean(p.imageData), // full image fetched on demand from /posts/{id}/image
    aiRisk: p.aiRisk,
    aiSignals: p.aiSignals ?? [],
    aiSummary: p.aiSummary,
    aiEngine: p.aiEngine,
    status: p.status,
    synthetic: p.synthetic,
    helpfulCount: p.helpfulCount,
    commentCount: p.commentCount,
    createdAt: p.createdAt.toISOString(),
    author: {
      publicId: p.author?.publicId ?? "BSA-??????",
      name: p.author?.name ?? "সদস্য",
      username: p.author?.username ?? null,
    },
    markedHelpful,
  };
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "community-feed"), 90, 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি অনুরোধ।", 429, { retryAfterSec: rl.retryAfterSec });

  const url = req.nextUrl;
  const kind = url.searchParams.get("kind") ?? "all";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 120);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30) || 30, 50);

  const where: Record<string, unknown> = { status: { in: ["active", "under_review"] } };
  if (KINDS.includes(kind as (typeof KINDS)[number])) where.kind = kind;
  if (q) where.body = { contains: q }; // SQLite contains is case-insensitive for ASCII

  const [posts, session] = await Promise.all([
    db.communityPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { publicId: true, name: true, username: true } } },
    }),
    getMemberSession(),
  ]);

  let markedSet = new Set<string>();
  if (session && posts.length > 0) {
    const marks = await db.helpfulMark.findMany({
      where: { userId: session.userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    markedSet = new Set(marks.map((m) => m.postId));
  }

  return ok({
    posts: posts.map((p) => postView(p, markedSet.has(p.id))),
    me: session ? { publicId: session.publicId } : null,
  });
}

interface CreateBody {
  kind?: string;
  body?: string;
  imageData?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return fail("unauthenticated", "পোস্ট করতে সাইন-ইন করুন।", 401);

  const rl = rateLimit(`community-post:${session.userId}`, 5, 60 * 60_000);
  if (!rl.ok) return fail("rate-limited", "ঘণ্টায় সর্বোচ্চ ৫টি পোস্ট। কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const payload = await readJson<CreateBody>(req, 2.2 * 1024 * 1024);
  if (!payload) return fail("invalid-body", "অনুরোধটি বোঝা যায়নি (খুব বড় হতে পারে)।", 400);

  const kind = payload.kind ?? "";
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return fail("invalid-kind", "পোস্টের ধরন বোঝা যায়নি।", 400);

  const rawBody = (payload.body ?? "").trim();
  if (rawBody.length < 5) return fail("empty-body", "পোস্টে আরেকটু লিখুন (কমপক্ষে ৫ অক্ষর)।", 400);
  if (rawBody.length > 2000) return fail("too-long", "পোস্ট সর্বোচ্চ ২০০০ অক্ষরের হতে পারে।", 400);

  let imageData: string | null = null;
  if (payload.imageData) {
    if (!IMAGE_RE.test(payload.imageData)) return fail("invalid-image", "ছবিটি গ্রহণযোগ্য নয় (JPEG/PNG/WebP)।", 400);
    if (payload.imageData.length > MAX_IMAGE_CHARS) return fail("image-too-large", "ছবিটি খুব বড় (সর্বোচ্চ ~১.২ মেগাবাইট)।", 400);
    imageData = payload.imageData;
  }

  // Light public redaction: OTP codes & ID numbers are masked (protects the
  // author); scammer phone numbers stay — they are the warning value.
  const body = redactCodesAndIds(rawBody);

  const assessment = await assessCommunityPost(body, kind);

  const post = await db.communityPost.create({
    data: {
      ref: newPostRef(),
      authorId: session.userId,
      kind,
      body,
      imageData,
      aiRisk: assessment.risk,
      aiSignals: assessment.signals as unknown as object,
      aiSummary: assessment.summary as unknown as object,
      aiEngine: assessment.engine,
      status: "active",
    },
  });

  // Help requests immediately get a labeled ShieldAgent first response.
  if (kind === "help") {
    const agent = await agentHelpFirstReply(body);
    // The system "shield_agent" account (seeded) authors agent replies.
    const agentUser =
      (await db.user.findUnique({ where: { username: "shield_agent" }, select: { id: true } })) ??
      (await db.user.findFirst({ where: { role: "admin" }, select: { id: true } }));
    if (agentUser) {
      await db.comment.create({
        data: { postId: post.id, authorId: agentUser.id, isAgent: true, body: agent.reply },
      });
      await db.communityPost.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
    }
  }

  await db.auditEvent.create({
    data: {
      actorType: "citizen",
      actorId: session.userId,
      action: "post.created",
      entityType: "CommunityPost",
      entityId: post.id,
      detail: { kind, aiRisk: assessment.risk, engine: assessment.engine } as unknown as object,
    },
  });

  const view = await db.communityPost.findUnique({
    where: { id: post.id },
    include: { author: { select: { publicId: true, name: true, username: true } } },
  });

  return ok({ post: view ? postView(view, false) : null, ref: post.ref });
}
