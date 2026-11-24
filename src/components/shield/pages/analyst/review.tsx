"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Loader2,
  Search,
  Eye,
  GitBranch,
  CheckCircle2,
  XCircle,
  Split,
  Undo2,
  FileWarning,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ShieldApiError } from "../../api";
import { useLang } from "../../i18n";
import { StatusBadge, SyntheticTag } from "../../ui-bits";
import { SCAM_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReportRow {
  id: string;
  category: string;
  riskCategory: string | null;
  status: string;
  synthetic: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  contentRedacted: string;
  indicators: { phone?: string | null; domain?: string | null; phrases?: string[] };
  linkedCase: { id: string; scamCategory: string | null; engine: string | null } | null;
}
interface PatternRow {
  id: string;
  code: string;
  name: { bn: string; en: string };
  description: { bn: string; en: string };
  category: string;
  status: string;
  synthetic: boolean;
  confidence: string;
  reportIds: string[];
  indicators: { phones?: string[]; domains?: string[]; phrases?: string[] };
  lastSeen: string;
  expiresAt: string | null;
  expired: boolean;
  reviews: { id: string; action: string; reason: string; createdAt: string; reviewerId: string; expiresAt: string | null }[];
}

export default function AnalystReview() {
  const bn = useLang() === "bn";
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [patterns, setPatterns] = useState<PatternRow[] | null>(null);
  const [status, setStatus] = useState("queue");
  const [q, setQ] = useState("");
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [openPattern, setOpenPattern] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [expiresDays, setExpiresDays] = useState("90");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        api.get<{ reports: ReportRow[] }>(`/api/v1/analyst/reports?status=${status}&q=${encodeURIComponent(q)}`),
        api.get<{ patterns: PatternRow[] }>("/api/v1/analyst/patterns"),
      ]);
      setReports(r.reports);
      setPatterns(p.patterns);
    } catch {
      setReports([]);
      setPatterns([]);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const reviewReport = async (reportId: string, action: string) => {
    if (reason.trim().length < 10) {
      toast.error(bn ? "কারণ অন্তত ১০ অক্ষরের হতে হবে" : "Reason must be at least 10 characters");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/v1/analyst/reviews", { reportId, action, reason });
      toast.success(bn ? "রিভিউ রেকর্ড হয়েছে" : "Review recorded");
      setReason("");
      load();
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const reviewPattern = async (patternId: string, action: string) => {
    if (reason.trim().length < 10) {
      toast.error(bn ? "কারণ অন্তত ১০ অক্ষরের হতে হবে" : "Reason must be at least 10 characters");
      return;
    }
    if (action === "approve" && !expiresDays) {
      toast.error(bn ? "মেয়াদ দিন" : "Expiry days required");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/v1/analyst/reviews", {
        patternId,
        action,
        reason,
        ...(action === "approve" ? { expiresDays: Number(expiresDays) } : {}),
      });
      toast.success(bn ? "রিভিউ রেকর্ড হয়েছে" : "Review recorded");
      setReason("");
      load();
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const withdrawPattern = async (pattern: PatternRow) => {
    if (reason.trim().length < 10) {
      toast.error(bn ? "প্রত্যাহারের কারণ অন্তত ১০ অক্ষরের হতে হবে" : "Withdrawal reason must be at least 10 characters");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/v1/analyst/patterns/${pattern.id}/withdraw`, { reason });
      toast.success(bn ? "প্যাটার্ন প্রত্যাহৃত" : "Pattern withdrawn");
      setReason("");
      load();
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ---------- Reports queue ---------- */}
      <section aria-labelledby="queue-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="queue-heading" className="flex items-center gap-2 text-lg font-bold text-[#202C26]">
            <ClipboardList className="h-5 w-5 text-[#2F5746]" aria-hidden />
            {bn ? "রিপোর্ট কিউ" : "Report queue"}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#59665F]" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={bn ? "খুঁজুন…" : "Search…"}
                className="pl-8 w-44 h-9 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746]"
                aria-label={bn ? "অনুসন্ধান" : "Search"}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 bg-[#FFFEFA] border-[#D8DED5] text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
                <SelectItem value="queue">{bn ? "সক্রিয় কিউ" : "Active queue"}</SelectItem>
                <SelectItem value="all">{bn ? "সব" : "All"}</SelectItem>
                <SelectItem value="pending">{bn ? "অপেক্ষমাণ" : "Pending"}</SelectItem>
                <SelectItem value="under_review">{bn ? "রিভিউ চলছে" : "Under review"}</SelectItem>
                <SelectItem value="published">{bn ? "প্রকাশিত" : "Published"}</SelectItem>
                <SelectItem value="rejected">{bn ? "বাতিল" : "Rejected"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {reports === null ? (
          <div className="flex justify-center py-10" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-[#59665F]" aria-hidden />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-[#59665F] bn-text">{bn ? "এই ফিল্টারে কোনো রিপোর্ট নেই।" : "No reports match this filter."}</p>
        ) : (
          <div className="space-y-2.5">
            {reports.map((r) => {
              const open = openReport === r.id;
              return (
                <Card key={r.id} className="border-[#D8DED5] bg-[#FFFEFA]">
                  <button
                    className="w-full text-left p-4 flex items-center gap-3 focus-ring rounded-xl"
                    onClick={() => setOpenReport(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown className="h-4 w-4 text-[#59665F] shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 text-[#59665F] shrink-0" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#202C26]">{r.id}</span>
                        <StatusBadge status={r.status} />
                        {r.synthetic && <SyntheticTag />}
                        <Badge variant="outline" className="border-[#D8DED5] text-[#59665F] bn-text">
                          {SCAM_CATEGORIES[r.category]?.[bn ? "bn" : "en"] ?? r.category}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[#59665F] line-clamp-1 bn-text">{r.contentRedacted}</p>
                    </div>
                    <span className="text-xs text-[#7D9C8B] shrink-0 hidden sm:block">
                      {new Date(r.submittedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
                    </span>
                  </button>

                  {open && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-4 border-t border-[#EDEAE1] mt-1 pt-4">
                      {/* redacted evidence */}
                      <div>
                        <p className="text-xs font-bold text-[#59665F] mb-1.5">{bn ? "আড়ালকৃত বিবরণ:" : "Redacted description:"}</p>
                        <p className="rounded-lg bg-[#F4F1EB] border border-[#D8DED5] p-3 text-sm text-[#202C26] leading-relaxed bn-text">
                          {r.contentRedacted}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[#59665F]">
                        {r.indicators?.phone && <span className="rounded-full bg-[#F2E8D5] px-2.5 py-1 font-semibold">📞 {r.indicators.phone}</span>}
                        {r.indicators?.domain && <span className="rounded-full bg-[#F4E1DA] px-2.5 py-1 font-semibold break-all">🌐 {r.indicators.domain}</span>}
                        {(r.indicators?.phrases ?? []).map((p) => (
                          <span key={p} className="rounded-full bg-[#DDE8DF] px-2.5 py-1 font-semibold">“{p}”</span>
                        ))}
                      </div>
                      {r.linkedCase && (
                        <p className="text-xs text-[#7D9C8B]">
                          {bn ? "সংযুক্ত কেস" : "Linked case"}: {r.linkedCase.id} · {r.linkedCase.scamCategory} · {r.linkedCase.engine}
                        </p>
                      )}

                      {/* review actions */}
                      <div className="rounded-xl border border-[#D8DED5] p-3 space-y-3 bg-[#F4F1EB]/40">
                        <div>
                          <Label htmlFor={`reason-r-${r.id}`} className="text-sm font-bold text-[#202C26] bn-text">
                            {bn ? "রিভিউ-কারণ (অডিটে সংরক্ষিত হবে)" : "Review reason (stored in audit)"}
                          </Label>
                          <Textarea
                            id={`reason-r-${r.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] text-sm"
                            placeholder={bn ? "যেমন: প্রমাণ যথেষ্ট / অপর্যাপ্ত…" : "e.g. evidence sufficient / insufficient…"}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => reviewReport(r.id, "approve")} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-1.5">
                            <CheckCircle2 className="h-4 w-4" aria-hidden /> {bn ? "অনুমোদন" : "Approve"}
                          </Button>
                          <Button size="sm" disabled={busy} variant="outline" onClick={() => reviewReport(r.id, "reject")} className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA] gap-1.5">
                            <XCircle className="h-4 w-4" aria-hidden /> {bn ? "বাতিল" : "Reject"}
                          </Button>
                          <Button size="sm" disabled={busy} variant="outline" onClick={() => reviewReport(r.id, "escalate")} className="border-[#8A5B28]/40 text-[#8A5B28] hover:bg-[#F2E8D5] gap-1.5">
                            <FileWarning className="h-4 w-4" aria-hidden /> {bn ? "উত্তোলন" : "Escalate"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Patterns review ---------- */}
      <section aria-labelledby="patterns-heading">
        <h2 id="patterns-heading" className="flex items-center gap-2 text-lg font-bold text-[#202C26] mb-4">
          <GitBranch className="h-5 w-5 text-[#2F5746]" aria-hidden />
          {bn ? "প্যাটার্ন লাইফসাইকেল রিভিউ" : "Pattern lifecycle review"}
        </h2>
        <p className="mb-4 text-xs text-[#59665F] bn-text">
          {bn
            ? "জীবনচক্র: জমা → প্রার্থী → রিভিউ চলছে → অনুমোদিত / বাতিল / প্রত্যাহৃত। শুধু অনুমোদিত ও অ-মেয়াদোত্তীর্ণ প্যাটার্নই বিশ্বস্ত ইন্টেলিজেন্স হিসেবে গণ্য।"
            : "Lifecycle: submitted → candidate → under review → approved / rejected / withdrawn. Only approved, non-expired patterns count as trusted intelligence."}
        </p>

        {patterns === null ? (
          <div className="flex justify-center py-10" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-[#59665F]" aria-hidden />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {patterns.map((p) => {
              const open = openPattern === p.id;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "bg-[#FFFEFA] border-2",
                    p.status === "approved" && !p.expired ? "border-[#2F5746]/60" : "border-[#D8DED5]"
                  )}
                >
                  <button
                    className="w-full text-left p-4 focus-ring rounded-xl"
                    onClick={() => setOpenPattern(open ? null : p.id)}
                    aria-expanded={open}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-[#202C26]">{p.code}</span>
                      <StatusBadge status={p.status} />
                      {p.expired && (
                        <Badge variant="outline" className="border-[#A44435]/50 text-[#A44435]">
                          {bn ? "মেয়াদোত্তীর্ণ" : "expired"}
                        </Badge>
                      )}
                      {p.synthetic && <SyntheticTag />}
                    </div>
                    <p className="text-sm font-semibold text-[#2F5746] bn-text">{p.name[bn ? "bn" : "en"]}</p>
                    <p className="mt-1 text-xs text-[#59665F] line-clamp-2 bn-text">{p.description[bn ? "bn" : "en"]}</p>
                    <p className="mt-2 text-xs text-[#7D9C8B]">
                      {p.reportIds.length} {bn ? "সমর্থক রিপোর্ট" : "supporting reports"} · {bn ? "আস্থা" : "confidence"}: {p.confidence}
                      {p.expiresAt && ` · ${bn ? "মেয়াদ" : "expires"}: ${new Date(p.expiresAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}`}
                    </p>
                  </button>

                  {open && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-[#EDEAE1] mt-1 pt-4">
                      <div className="text-xs text-[#59665F] space-y-1">
                        <p className="font-bold">{bn ? "ভাগাভাগি সূচক:" : "Shared indicators:"}</p>
                        <p>{[...(p.indicators?.phones ?? []), ...(p.indicators?.domains ?? []), ...(p.indicators?.phrases ?? [])].join(" · ") || "—"}</p>
                      </div>

                      {/* review history */}
                      {p.reviews.length > 0 && (
                        <div className="rounded-lg border border-[#D8DED5] bg-[#F4F1EB]/50 p-3">
                          <p className="text-xs font-bold text-[#59665F] mb-1.5">{bn ? "রিভিউ ইতিহাস:" : "Review history:"}</p>
                          <ul className="space-y-1.5">
                            {p.reviews.map((rv) => (
                              <li key={rv.id} className="text-xs text-[#59665F]">
                                <span className="font-bold text-[#2F5746]">{rv.action}</span> — {rv.reason}{" "}
                                <span className="text-[#7D9C8B]">
                                  ({new Date(rv.createdAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="rounded-xl border border-[#D8DED5] p-3 space-y-3 bg-[#F4F1EB]/40">
                        <div>
                          <Label htmlFor={`reason-p-${p.id}`} className="text-sm font-bold text-[#202C26] bn-text">
                            {bn ? "রিভিউ-কারণ" : "Review reason"}
                          </Label>
                          <Textarea
                            id={`reason-p-${p.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] text-sm"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[#59665F] bn-text">{bn ? "মেয়াদ:" : "Expiry:"}</span>
                          <Select value={expiresDays} onValueChange={setExpiresDays}>
                            <SelectTrigger className="w-28 h-8 bg-[#FFFEFA] border-[#D8DED5] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
                              <SelectItem value="30">30 {bn ? "দিন" : "days"}</SelectItem>
                              <SelectItem value="90">90 {bn ? "দিন" : "days"}</SelectItem>
                              <SelectItem value="180">180 {bn ? "দিন" : "days"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => reviewPattern(p.id, "approve")} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-1.5">
                            <CheckCircle2 className="h-4 w-4" aria-hidden /> {bn ? "অনুমোদন" : "Approve"}
                          </Button>
                          <Button size="sm" disabled={busy} variant="outline" onClick={() => reviewPattern(p.id, "reject")} className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA] gap-1.5">
                            <XCircle className="h-4 w-4" aria-hidden /> {bn ? "বাতিল" : "Reject"}
                          </Button>
                          <Button size="sm" disabled={busy} variant="outline" onClick={() => reviewPattern(p.id, "split")} className="border-[#8A5B28]/40 text-[#8A5B28] hover:bg-[#F2E8D5] gap-1.5">
                            <Split className="h-4 w-4" aria-hidden /> {bn ? "ভাগ করুন" : "Split"}
                          </Button>
                          <Button size="sm" disabled={busy} variant="outline" onClick={() => withdrawPattern(p)} className="border-[#59665F]/40 text-[#59665F] hover:bg-[#EDEAE1] gap-1.5">
                            <Undo2 className="h-4 w-4" aria-hidden /> {bn ? "প্রত্যাহার" : "Withdraw"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
