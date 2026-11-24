// GET /api/v1/community/posts/{id}/image — serve the post image as raw bytes
// (keeps the feed payload light; the browser caches and lazy-loads this).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(clientKey(req, "post-image"), 200, 60_000);
  if (!rl.ok) return fail("rate-limited", "Too many requests.", 429);

  const { id } = await params;
  const post = await db.communityPost.findUnique({
    where: { id },
    select: { imageData: true, status: true },
  });
  if (!post?.imageData || post.status === "hidden") return fail("not-found", "Image not found.", 404);

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/.exec(post.imageData);
  if (!match) return fail("not-found", "Image not found.", 404);

  const bytes = Buffer.from(match[2], "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
