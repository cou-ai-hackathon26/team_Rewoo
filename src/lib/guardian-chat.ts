// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — Guardian chat turn orchestration (server).
//
// Wraps the existing chatWithShieldAgent with the two challenge behaviors:
//
//  1. (Challenge 1) The deterministic incident-state resolver folds the user
//     turns BEFORE the model runs. A stage turn (follow-up question /
//     preventive / recovery) is answered by the deterministic rule flow —
//     never delegated to the model — so the guidance switch is guaranteed
//     even when the AI provider is down. Non-stage turns still use the AI,
//     with the server-resolved state injected into the system prompt.
//
//  2. (Challenge 2) When a reply needs official contacts (recovery stage,
//     or any turn while the user's state is "shared"), the directory is read
//     AFTER the AI call resolves — so a contact that changed while the model
//     was thinking is already reflected in the response. Cards are only ever
//     built from server-validated directory records; the model never sees
//     or produces contact data.
//
// Dependencies (AI call + directory read) are injectable for unit tests.
// ---------------------------------------------------------------------------

import { chatWithShieldAgent, type ChatMessage, type ChatOutcome } from "./shield-agent";
import { resolveIncident, incidentLangOf, type IncidentResolution } from "./incident-state";
import { followUpReply, preventiveReply, recoveryReply, incidentSystemContext } from "./incident-flow";
import { getVerifiedContacts, type ContactDirectorySnapshot } from "./verified-contacts";

export type GuardianEngine = ChatOutcome["engine"] | "incident-rules";

export interface GuardianContacts {
  source: ContactDirectorySnapshot["source"];
  directoryVersion: string;
  policy: { maxAgeDays: number };
  items: ContactDirectorySnapshot["contacts"];
  unavailableNotice: { bn: string; en: string } | null;
}

export interface GuardianTurnResult {
  reply: string;
  engine: GuardianEngine;
  note?: { bn: string; en: string };
  servedModel?: string | null;
  servingProvider?: string | null;
  incident?: {
    state: IncidentResolution["state"];
    stage: IncidentResolution["stage"];
    changed: boolean;
    correction: boolean;
    resolvedBy: "deterministic-rules";
  };
  contacts?: GuardianContacts;
  directory?: "live" | "demo";
}

export interface GuardianChatOptions {
  messages: ChatMessage[];
  model?: string;
  directory?: "live" | "demo";
  /** Injectable for tests: the AI call (defaults to the real gateway chain). */
  aiCall?: typeof chatWithShieldAgent;
  /** Injectable for tests: the directory read (defaults to getVerifiedContacts). */
  directoryRead?: (directory: "live" | "demo") => Promise<ContactDirectorySnapshot>;
}

function contactsOf(snapshot: ContactDirectorySnapshot): GuardianContacts {
  return {
    source: snapshot.source,
    directoryVersion: snapshot.directoryVersion,
    policy: { maxAgeDays: snapshot.policy.maxAgeDays },
    items: snapshot.contacts,
    unavailableNotice: snapshot.unavailableNotice,
  };
}

export async function guardianChatTurn(opts: GuardianChatOptions): Promise<GuardianTurnResult> {
  const aiCall = opts.aiCall ?? chatWithShieldAgent;
  const directoryRead =
    opts.directoryRead ??
    (async (directory: "live" | "demo") => getVerifiedContacts({ directory }));
  const directory = opts.directory === "demo" ? "demo" : "live";

  const userTexts = opts.messages.filter((m) => m.role === "user").map((m) => m.content);
  const lastUser = userTexts[userTexts.length - 1] ?? "";
  const resolution = resolveIncident(userTexts);
  const lang = incidentLangOf(lastUser);

  // ---- Deterministic stage turns (Challenge 1 core) ------------------------
  if (resolution.stage === "follow_up") {
    return {
      reply: followUpReply(lang),
      engine: "incident-rules",
      note: {
        bn: "এই প্রশ্নটি নিয়মভিত্তিক ঘটনা-প্রবাহ থেকে — এআই উত্তর নয়।",
        en: "This question comes from the deterministic incident flow — not an AI reply.",
      },
      incident: incidentOf(resolution),
      directory,
    };
  }

  if (resolution.stage === "preventive") {
    return {
      reply: preventiveReply(lang, resolution.correction),
      engine: "incident-rules",
      note: {
        bn: "এই পরামর্শটি নিয়মভিত্তিক ঘটনা-প্রবাহ থেকে — এআই উত্তর নয়।",
        en: "This guidance comes from the deterministic incident flow — not an AI reply.",
      },
      incident: incidentOf(resolution),
      directory,
    };
  }

  if (resolution.stage === "recovery") {
    // Directory read happens AFTER (trivially) the deterministic reply is
    // built — contacts are always fetched at response time.
    const snapshot = await directoryRead(directory);
    return {
      reply: recoveryReply(lang, resolution.correction),
      engine: "incident-rules",
      note: {
        bn: "কোড শেয়ারের স্বীকৃতি পাওয়া গেছে — পুনরুদ্ধারের পরামর্শ নিয়মভিত্তিক প্রবাহ থেকে।",
        en: "Code-sharing confirmed — recovery guidance from the deterministic flow.",
      },
      incident: incidentOf(resolution),
      contacts: contactsOf(snapshot),
      directory,
    };
  }

  // ---- Normal turns: AI with the server-resolved incident context ----------
  const extraSystem = incidentSystemContext(resolution);
  const outcome = await aiCall(opts.messages, opts.model, extraSystem || undefined);

  // While state is "shared" the user is in recovery — attach CURRENT directory
  // contacts. Read AFTER the AI call: a directory change that happened while
  // the model was processing is already reflected in this response.
  let snapshot: ContactDirectorySnapshot | null = null;
  if (resolution.state === "shared") {
    snapshot = await directoryRead(directory);
  }

  return {
    reply: outcome.reply,
    engine: outcome.engine,
    note: outcome.note,
    servedModel: outcome.servedModel ?? null,
    servingProvider: outcome.servingProvider ?? null,
    incident: incidentOf(resolution),
    contacts: snapshot ? contactsOf(snapshot) : undefined,
    directory,
  };
}

function incidentOf(r: IncidentResolution): NonNullable<GuardianTurnResult["incident"]> {
  return {
    state: r.state,
    stage: r.stage,
    changed: r.changed,
    correction: r.correction,
    resolvedBy: "deterministic-rules",
  };
}
