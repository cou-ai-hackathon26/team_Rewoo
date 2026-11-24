// ---------------------------------------------------------------------------
// Chat model catalog — client-safe (NO secrets here).
//
// Single source of truth for the ShieldAgent model selector. The API route
// validates every user selection against this list; llm-gateway only accepts
// ids that passed validation. Every model was live-tested for Bangla quality
// and cost on 2026-11-23 (docs/V8-RELEASE-QA.md).
// ---------------------------------------------------------------------------

export interface ChatModelInfo {
  id: string;
  label: string;
  labelBn: string;
  /** One-line honest note shown in the selector (English). */
  note: string;
}

export const CHAT_MODEL_CATALOG: ChatModelInfo[] = [
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", labelBn: "লামা ৩.৩ ৭০বি", note: "Balanced default — strong Bangla, reliable JSON" },
  { id: "google/gemma-3-27b-it", label: "Gemma 3 27B", labelBn: "জেমা ৩ ২৭বি", note: "Fast and cheapest per call" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small 3.2", labelBn: "মিস্ট্রাল স্মল ৩.২", note: "Compact and quick" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", labelBn: "ডিপসিক ভি৩", note: "Good Bangla explanations" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", labelBn: "কুয়েন ২.৫ ৭২বি", note: "Strongest Bangla phrasing" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", labelBn: "লামা ৪ মাভেরিক", note: "Most advanced — multimodal" },
];

export function isSelectableChatModel(id: string | undefined | null): boolean {
  return Boolean(id) && CHAT_MODEL_CATALOG.some((m) => m.id === id);
}
