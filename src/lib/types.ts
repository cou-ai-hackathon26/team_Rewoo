// ---------------------------------------------------------------------------
// BanglaShield shared type contracts — Version 3.
// Validated data contracts shared between the agent harness, API and UI.
// V3 changes:
//   - Four-state risk model (HIGH_RISK / CAUTION / INSUFFICIENT_EVIDENCE /
//     NO_RISK_INDICATORS) — a "no indicators" result is NEVER a safety proof.
//   - Extended scam categories (family/voice impersonation, AI social
//     engineering, scholarship, investment, romance, marketplace, account
//     takeover, QR phishing).
//   - Versioned result contract with analysis mode, agent activity events,
//     visualization graph and an explicit immediate protective action.
// ---------------------------------------------------------------------------

export type Bilingual = { bn: string; en: string };

/** Four-state risk model (V3). "No indicators" is not proof of safety. */
export type RiskCategory =
  | "HIGH_RISK"
  | "CAUTION"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_RISK_INDICATORS";

/** How the result was produced — must be honestly labeled everywhere. */
export type AnalysisMode = "LIVE_AI" | "RULE_BASED_FALLBACK" | "OFFLINE_DEMO";

/** @deprecated Use AnalysisMode. Kept for migration of older persisted results. */
export type AnalysisEngine = "ai_assisted" | "rule_based";

export type Modality = "voice" | "message" | "image" | "link";

export type EvidenceKind =
  | "quoted_text"
  | "heuristic"
  | "visual"
  | "url_property"
  | "context";

/** What the evidence tells us about who is speaking / being addressed (V3). */
export interface SpeakerContext {
  /** Identity the sender/caller CLAIMS (e.g. "son", "bKash team") — always unverified. */
  claimedIdentity?: Bilingual;
  /** Person the message is addressed to (e.g. "mother", "customer"). */
  addressedAs?: Bilingual;
  /** The action the speaker requests (e.g. "send money", "share OTP"). */
  requestedAction?: Bilingual;
}

export interface Evidence {
  key: string; // E1, E2 ... referenced by replay stages and graph nodes
  kind: EvidenceKind;
  quote?: string; // redacted excerpt (never contains unredacted PII)
  interpretation: Bilingual;
  tactic?: string;
  source: string; // producing module id
  weight: "strong" | "moderate" | "weak";
  speaker?: SpeakerContext;
}

export interface Recommendation {
  id: string;
  templateId: string; // curated template library id (safety-gate whitelisted)
  title: Bilingual;
  detail: Bilingual;
  priority: "now" | "soon" | "know";
  evidenceRefs?: string[];
}

export interface Intervention {
  question: Bilingual;
  safe: Bilingual;
  unsafe: Bilingual;
}

export type ReplayNodeType = "observed" | "inferred" | "hypothetical" | "action";

export interface ReplayStage {
  id: string;
  index: number;
  type: ReplayNodeType;
  title: Bilingual;
  description: Bilingual;
  evidenceRefs: string[];
  intervention?: Intervention;
}

// --- Visualization graph (Shield Lens 3.0) ----------------------------------
// Derived from the validated replay — never a fixed frontend template.

export type GraphNodeKind = "stage" | "safe_branch" | "risky_branch";

export interface GraphNode {
  id: string; // mirrors the replay stage id, or "BR-SAFE-n" / "BR-RISK-n"
  kind: GraphNodeKind;
  label: Bilingual;
  /** observed | inferred | hypothetical — branches inherit "hypothetical". */
  nature: ReplayNodeType;
  evidenceRefs: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: "next" | "safe_path" | "risky_path";
}

export interface VisualizationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- Agent activity events (AI Agent Activity Explorer) -----------------------

export interface AgentEvent {
  /** Monotonic event code, e.g. input.accepted, media.extracted, rules.evaluated */
  event: string;
  label: Bilingual;
  /** Wall-clock timestamp (ISO). */
  t: string;
  /** Duration of this step in ms (omit for instantaneous events). */
  ms?: number;
  outcome?: "ok" | "skipped" | "failed";
  detail?: string; // non-sensitive, e.g. "LIVE_AI", "retry 1"
}

// --- The versioned result contract (V3) --------------------------------------

export interface AnalysisResultV3 {
  schemaVersion: 3;
  caseId: string;
  modality: Modality;
  analysisMode: AnalysisMode;
  /** Legacy engine field (ai_assisted | rule_based) kept for audit continuity. */
  engine: AnalysisEngine;
  inputType: Modality;
  detectedLanguage: "bn" | "en" | "mixed" | "unknown";
  generatedAt: string;
  riskCategory: RiskCategory;
  scamCategory: string; // key into SCAM_CATEGORIES
  summary: Bilingual; // what happened
  why: Bilingual; // why it may be dangerous
  /** The single most urgent protective action — always shown first. */
  immediateAction: Recommendation;
  evidence: Evidence[];
  unknowns: Bilingual[]; // what is still unknown
  recommendations: Recommendation[];
  replay: ReplayStage[];
  graph: VisualizationGraph;
  agentEvents: AgentEvent[];
  limitations: Bilingual[];
  policy: { validated: boolean; checks: string[] };
  resources: string[]; // VerifiedResource keys
  synthetic?: boolean; // true for OFFLINE_DEMO results
  redactedSource?: string; // the redacted input text (highlight rendering)
}

/** @deprecated Legacy V2 shape — still accepted when reading old sessions. */
export interface AnalysisResult {
  caseId: string;
  modality: Modality;
  engine: AnalysisEngine;
  generatedAt: string;
  riskCategory: RiskCategory | "high" | "uncertain" | "none";
  scamCategory: string;
  summary: Bilingual;
  why: Bilingual;
  evidence: Evidence[];
  unknowns: Bilingual[];
  recommendations: Recommendation[];
  replay: ReplayStage[];
  limitations: Bilingual[];
  policy: { validated: boolean; checks: string[] };
  resources: string[];
  analyzedHost?: string;
}

export type SessionStatus =
  | "awaiting_input"
  | "awaiting_review"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"
  | "expired";

export type PipelineStage =
  | "created"
  | "validating"
  | "redacting"
  | "detecting"
  | "ai_analyzing"
  | "safety_gate"
  | "completed";

export interface SessionSummary {
  id: string;
  modality: Modality;
  status: SessionStatus;
  stage: string | null;
  riskCategory: RiskCategory | null;
  scamCategory: string | null;
  engine: string | null;
  createdAt: string;
  completedAt: string | null;
  hasReport: boolean;
}

// Scam category registry (V3) --------------------------------------------------

export const SCAM_CATEGORIES: Record<string, Bilingual> = {
  // Family & AI voice impersonation
  family_impersonation: { bn: "পরিবারের সদস্যের ছদ্মবেশ", en: "Family member impersonation" },
  ai_voice_impersonation: { bn: "এআই নকল কণ্ঠস্বর", en: "AI voice impersonation" },
  // Social engineering
  ai_social_engineering: { bn: "এআই-সহায়ক সোশ্যাল ইঞ্জিনিয়ারিং", en: "AI-enabled social engineering" },
  otp_phishing: { bn: "ওটিপি/পিন ফিশিং", en: "OTP / PIN phishing" },
  impersonation: { bn: "ভুয়া পরিচয় (সরকারি/ব্র্যান্ড)", en: "Impersonation (official / brand)" },
  // Jobs, education, migration
  fake_job: { bn: "ভুয়া চাকরি/ভিসার ফাঁদ", en: "Fake job / visa scam" },
  scholarship_scam: { bn: "ভুয়া বৃত্তি/শিক্ষা প্রতারণা", en: "Scholarship fraud" },
  // Money-focused fraud
  investment_fraud: { bn: "বিনিয়োগ প্রতারণা", en: "Investment fraud" },
  romance_scam: { bn: "প্রেম প্রতারণা", en: "Romance scam" },
  prize_lottery: { bn: "লটারি/পুরস্কার প্রতারণা", en: "Lottery / prize scam" },
  loan_scam: { bn: "ভুয়া ঋণ/লোন প্রতারণা", en: "Fake loan scam" },
  parcel_scam: { bn: "পার্সেল/কুরিয়ার প্রতারণা", en: "Parcel / courier scam" },
  shopping_scam: { bn: "মার্কেটপ্লেস প্রতারণা", en: "Marketplace fraud" },
  // Account & device
  account_takeover: { bn: "অ্যাকাউন্ট দখল", en: "Account takeover" },
  app_control: { bn: "রিমোট অ্যাপ/স্ক্রিন নিয়ন্ত্রণ", en: "Remote app / screen control" },
  // Links & codes
  phishing_link: { bn: "ক্ষতিকর লিংক", en: "Malicious link" },
  qr_phishing: { bn: "কিউআর কোড ফিশিং", en: "QR code phishing" },
  // Threats
  threat_extortion: { bn: "হুমকি/ভয় দেখানো", en: "Threats / extortion" },
  // Fallbacks
  uncertain_situation: { bn: "নিশ্চিত হওয়া যায়নি", en: "Uncertain situation" },
  no_indicators: { bn: "ঝুঁকির প্রমাণ পাওয়া যায়নি", en: "No risk indicators found" },
};

/** Risk-state presentation metadata (labels never rely on color alone). */
export const RISK_STATES: Record<
  RiskCategory,
  { label: Bilingual; meaning: Bilingual; tone: "danger" | "warn" | "neutral" | "ok" }
> = {
  HIGH_RISK: {
    label: { bn: "উচ্চ ঝুঁকি", en: "High risk" },
    meaning: {
      bn: "বিপজ্জনক লক্ষণ পাওয়া গেছে — এখনই কোনো টাকা বা কোড দেবেন না।",
      en: "Dangerous indicators found — do not send money or codes now.",
    },
    tone: "danger",
  },
  CAUTION: {
    label: { bn: "সতর্ক থাকুন", en: "Caution" },
    meaning: {
      bn: "কিছু সন্দেহজনক লক্ষণ আছে — যাচাই না করে কিছু দেবেন না।",
      en: "Some suspicious signs — do not share anything before verifying.",
    },
    tone: "warn",
  },
  INSUFFICIENT_EVIDENCE: {
    label: { bn: "প্রমাণ অপর্যাপ্ত নয়", en: "Insufficient evidence" },
    meaning: {
      bn: "প্রাপ্ত তথ্য থেকে নিশ্চিত সিদ্ধান্তে পৌঁছানো যাচ্ছে না — এটি নিরাপত্তার নিশ্চয়তা নয়।",
      en: "The available information is not enough for a firm conclusion — this is not a safety guarantee.",
    },
    tone: "neutral",
  },
  NO_RISK_INDICATORS: {
    label: { bn: "ঝুঁকির প্রমাণ পাওয়া যায়নি", en: "No risk indicators found" },
    meaning: {
      bn: "পরিচিত প্রতারণার লক্ষণ ধরা পড়েনি — তবে এটি সম্পূর্ণ নিরাপদ প্রমাণ নয়।",
      en: "No known scam markers were detected — but this is not proof of safety.",
    },
    tone: "ok",
  },
};

/** Map legacy V2 risk values onto the V3 model (for persisted results). */
export function normalizeRisk(r: string | null | undefined): RiskCategory | null {
  if (!r) return null;
  if (r === "HIGH_RISK" || r === "CAUTION" || r === "INSUFFICIENT_EVIDENCE" || r === "NO_RISK_INDICATORS") return r;
  if (r === "high") return "HIGH_RISK";
  if (r === "uncertain") return "CAUTION";
  if (r === "none") return "NO_RISK_INDICATORS";
  return null;
}

/** Map legacy engine values onto V3 analysis modes. */
export function engineToMode(engine: string | null | undefined, synthetic = false): AnalysisMode {
  if (synthetic) return "OFFLINE_DEMO";
  if (engine === "ai_assisted") return "LIVE_AI";
  return "RULE_BASED_FALLBACK";
}

// Pipeline stage labels (for progress UI)

export const STAGE_LABELS: Record<PipelineStage, Bilingual> = {
  created: { bn: "প্রস্তুত", en: "Ready" },
  validating: { bn: "ইনপুট যাচাই করা হচ্ছে", en: "Validating input" },
  redacting: { bn: "গোপনীয় তথ্য আড়াল করা হচ্ছে", en: "Redacting private data" },
  detecting: { bn: "প্রতারণার চিহ্ন খোঁজা হচ্ছে", en: "Detecting scam indicators" },
  ai_analyzing: { bn: "এআই বিশ্লেষণ চলছে", en: "AI analysis in progress" },
  safety_gate: { bn: "নিরাপত্তা যাচাই (Safety Gate)", en: "Safety Gate validation" },
  completed: { bn: "সম্পন্ন", en: "Completed" },
};
