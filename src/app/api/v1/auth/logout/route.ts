// POST /api/v1/auth/logout — clear the community member session cookie.
import { ok } from "@/lib/api";
import { clearMemberCookie } from "@/lib/auth";

export async function POST() {
  await clearMemberCookie();
  return ok({ loggedOut: true });
}
