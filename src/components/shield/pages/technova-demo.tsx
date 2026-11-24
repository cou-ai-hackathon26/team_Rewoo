"use client";

// ---------------------------------------------------------------------------
// COU TECHNOVA 2026 — the ISOLATED judge-demo environment (Team 35 — Rewoo).
//
// Challenge 2 demonstration: dynamic verified official contacts.
//   - A separate, fictional demo directory (TEST DATA — never the real one).
//   - The Guardian chat below reads contacts from THAT directory through the
//     same eligibility pipeline; when the directory changes mid-conversation,
//     the next response uses the updated contact and old cards stop being
//     actionable.
//   - The same chat also demonstrates Challenge 1's voice incident flow.
//
// Route: #/technova-demo — completely isolated from the real app pages.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Database, ShieldCheck, AlertTriangle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "../router";
import { useLang } from "../i18n";
import { api } from "../api";
import { AgentChat } from "./agent-chat";

interface DemoRecord {
  key: string;
  name: { bn: string; en: string };
  category: string;
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: string;
  active: boolean;
  demo: boolean;
}

interface DemoSnapshot {
  source: string;
  directoryVersion: string;
  policy: { maxAgeDays: number };
  contacts: { key: string; name: { bn: string; en: string }; phone: string | null; source: string }[];
  rejected: { key: string; reasons: string[] }[];
  unavailableNotice: { bn: string; en: string } | null;
}

interface DemoState {
  testdata: boolean;
  records: DemoRecord[];
  snapshot: DemoSnapshot;
  actions: string[];
}

const REASON_LABEL: Record<string, string> = {
  inactive: "নিষ্ক্রিয় (deactivated)",
  "stale-verification": "যাচাঈকৃত-তারিখ পুরনো (expired)",
  "future-verification": "ভবিষ্যতের তারিখ",
  "invalid-url": "অবৈধ URL",
  "hostname-mismatch": "সোর্স-হোস্ট মিলছে না",
  "unofficial-hostname": "অফিসিয়াল-নয় হোস্ট",
  "lookalike-hostname": "নকল একই-নামের ডোমেইন (lookalike)",
};

export default function TechnovaDemoPage() {
  const bn = useLang() === "bn";
  const [state, setState] = useState<DemoState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<DemoState>("/api/v1/demo-directory");
      setState(d);
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (action: string) => {
    setBusyAction(action);
    try {
      const d = await api.post<DemoState>("/api/v1/demo-directory", { action });
      setState(d);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-6">
      {/* header */}
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#8A5B28]">
          <FlaskConical className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
              COU TECHNOVA 2026 — চ্যালেঞ্জ ডেমো
            </h1>
            <Badge variant="outline" className="border-[#A44435]/60 text-[#A44435]">
              {bn ? "বিচ্ছিন্ন পরিবেশ · সব যোগাযোগ কাল্পনিক TEST DATA" : "Isolated · all contacts are fictional TEST DATA"}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "নিচের Guardian চ্যাট ও ডিরেক্টরি সম্পূর্ণ বিচ্ছিন্ন ডেমো পরিবেশ — আসল VerifiedResource টেবিল বা কোনো আসল অফিসিয়াল যোগাযোগ স্পর্শ করা হয় না। ডিরেক্টরি বদলালে পরের Guardian উত্তর তাৎক্ষণিকভাবে নতুন তথ্য ব্যবহার করে; পুরনো কার্ড আর ব্যবহারযোগ্য থাকে না।"
              : "The Guardian chat and directory below run in a fully isolated demo environment — the real VerifiedResource table and genuine official contacts are never touched. When the directory changes, the next Guardian response immediately uses the new data; old cards stop being actionable."}
          </p>
          <p className="mt-1 text-xs text-[#8A9B90] bn-text">
            {bn ? "চ্যালেঞ্জ ১ (ভয়েস ঘটনা-প্রবাহ) একই চ্যাটে প্রদর্শিত হয় — মাইক বোতাম দেখুন।" : "Challenge 1 (voice incident flow) is demonstrated in the same chat — see the mic button."}
          </p>
        </div>
      </div>

      {/* demo directory state */}
      <Card className="border-[#8A5B28]/40 bg-[#FFFEFA]">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#202C26] bn-text">
              <Database className="h-5 w-5 text-[#8A5B28]" aria-hidden />
              {bn ? "ডেমো ডিরেক্টরির বর্তমান অবস্থা" : "Current demo directory state"}
            </h2>
            <Button onClick={() => void load()} variant="outline" size="sm" className="gap-1.5 border-[#C9C2B2]">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {bn ? "রিফ্রেশ" : "Refresh"}
            </Button>
          </div>

          {state === null ? (
            <p className="text-sm text-[#59665F] bn-text" aria-live="polite">
              {bn ? "ডিরেক্টরি লোড হচ্ছে…" : "Loading the directory…"}
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {state.records.map((r) => {
                  const rejected = state.snapshot.rejected.find((x) => x.key === r.key);
                  const eligible = !rejected;
                  return (
                    <div
                      key={r.key}
                      className={`rounded-xl border p-4 ${eligible ? "border-[#2F5746]/40 bg-[#F4F1EB]" : "border-[#A44435]/30 bg-[#F4E1DA]/30"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[#202C26] bn-text">{bn ? r.name.bn : r.name.en}</p>
                        {eligible ? (
                          <Badge className="bg-[#DDE8DF] text-[#2F5746] hover:bg-[#DDE8DF] text-[10px]">
                            <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
                            {bn ? "গ্রহণযোগ্য" : "eligible"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#A44435]/50 text-[#A44435] text-[10px]">
                            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                            {bn ? "বাতিল" : "rejected"}
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-[#A44435]/40 text-[#A44435] text-[9px]">TEST DATA</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#59665F] bn-text">
                        {new URL(r.url).hostname} · {bn ? "যাচাঈকৃত:" : "verified:"}{" "}
                        {new Date(r.verifiedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[#59665F]">
                        active: {String(r.active)}
                      </p>
                      {rejected && (
                        <p className="mt-1 text-[11px] font-semibold text-[#A44435] bn-text">
                          {bn ? "বাতিলের কারণ:" : "reasons:"}{" "}
                          {rejected.reasons.map((x) => REASON_LABEL[x] ?? x).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {state.snapshot.unavailableNotice && (
                <div className="rounded-xl border border-[#A44435]/40 bg-[#F4E1DA]/40 p-3">
                  <p className="text-sm font-bold text-[#A44435] bn-text">
                    {bn ? "বর্তমানে কোনো গ্রহণযোগ্য যোগাযোগ নেই" : "No eligible contact right now"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#7A5548] bn-text">
                    {bn ? state.snapshot.unavailableNotice.bn : state.snapshot.unavailableNotice.en}
                  </p>
                </div>
              )}

              {/* directory actions (drive the transitions) */}
              <div>
                <p className="text-xs font-bold text-[#59665F] bn-text">
                  {bn ? "ডিরেক্টরি পরিবর্তন (ডেমো ক্রম অনুযায়ী চাপুন):" : "Directory actions (press in demo order):"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["deactivate-a", bn ? "১. যোগাযোগ এ নিষ্ক্রিয় করুন" : "1. Deactivate Contact A"],
                      ["verify-b", bn ? "২. যোগাযোগ বি নতুন যাচাঈ করুন" : "2. Verify Contact B"],
                      ["deactivate-b", bn ? "৩. যোগাযোগ বি নিষ্ক্রিয় করুন" : "3. Deactivate Contact B"],
                      ["expire-b", bn ? "৪. যোগাযোগ বি মেয়াদোত্তীর্ণ করুন" : "4. Expire Contact B"],
                      ["restore-a", bn ? "যোগাযোগ এ পুনরুদ্ধার" : "Restore Contact A"],
                      ["reset", bn ? "রিসেট" : "Reset"],
                    ] as const
                  ).map(([action, label]) => (
                    <Button
                      key={action}
                      onClick={() => void apply(action)}
                      disabled={busyAction !== null}
                      variant="outline"
                      size="sm"
                      className="h-9 text-[12px] border-[#8A5B28]/50 text-[#8A5B28] hover:bg-[#F2E8D5]/60"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* the Guardian chat, reading contacts from the demo directory */}
      <AgentChat directory="demo" />

      <p className="text-xs text-[#8A9B90] bn-text">
        {bn
          ? "আসল অ্যাপে এই একই লজিক আসল VerifiedResource টেবিল থেকে চলে — আসল সাইটের Guardian-এ যান।"
          : "In the real app this same logic runs against the real VerifiedResource table — open the site's Guardian."}
        {" "}
        <Link to="/guardian" className="text-[#2F5746] hover:underline">
          {bn ? "Guardian (আসল)" : "Guardian (real)"}
        </Link>
      </p>
    </div>
  );
}
