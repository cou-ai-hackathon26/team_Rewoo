// POST /api/v1/agent/chat — ShieldAgent conversational endpoint.
// History comes from the client (stateless server, privacy-friendly);
// every reply is labeled live-ai, rule-based-fallback or incident-rules —
// never faked. V8: optional `model` selects the OpenRouter chat model
// (validated against the curated catalog); the model that actually served is
// returned so the UI can label every reply honestly.
//
// COU TECHNOVA 2026 additions (backward compatible — optional fields only):
//   - Deterministic incident-state resolver (Challenge 1): stage turns are
//     answered by the rule flow; other turns carry the server-resolved
//     state into the AI system prompt. Response gains `incident`.
//   - Verified-contact lookup (Challenge 2): `contacts` is read from the
//     authoritative directory (Prisma VerifiedResource, or the isolated
//     clearly-labeled demo directory when `directory:"demo"`) at response
//     time — never from the model or the user.
import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/api";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { isSelectableChatModel } from "@/lib/chat-models";
import { guardianChatTurn } from "@/lib/guardian-chat";

interface ChatBody {
  messages?: { role?: string; content?: string }[];
  model?: string;
  /** COU TECHNOVA 2026: "demo" routes contact lookups to the isolated,
   *  clearly-labeled fictional demo directory (never the real one). */
  directory?: "live" | "demo";
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "agent-chat"), 20, 15 * 60_000);
  if (!rl.ok) return fail("rate-limited", "অনেক বেশি বার্তা — কিছুক্ষণ পরে আবার করুন।", 429, { retryAfterSec: rl.retryAfterSec });

  const body = await readJson<ChatBody>(req, 128 * 1024);
  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return fail("invalid-body", "বার্তা পাওয়া যায়নি।", 400);

  // Model selection: only ids from the curated, live-tested catalog pass.
  const model = isSelectableChatModel(body?.model) ? body?.model as string : undefined;

  // Sanitize history: roles, lengths, count.
  const messages = raw
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 6000) }));

  if (messages.length === 0) return fail("invalid-body", "বার্তা পাওয়া যায়নি।", 400);

  const outcome = await guardianChatTurn({
    messages,
    model,
    directory: body?.directory === "demo" ? "demo" : "live",
  });

  return ok({
    reply: outcome.reply,
    engine: outcome.engine,
    note: outcome.note ?? null,
    servedModel: outcome.servedModel ?? null,
    servingProvider: outcome.servingProvider ?? null,
    incident: outcome.incident ?? null,
    contacts: outcome.contacts ?? null,
    directory: outcome.directory ?? "live",
  });
}
