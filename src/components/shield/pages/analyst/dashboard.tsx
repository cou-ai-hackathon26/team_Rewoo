"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  GitBranch,
  CheckCircle2,
  ShieldCheck,
  FileWarning,
  Users,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "../../api";
import { useLang } from "../../i18n";
import { MetricCard } from "../../ui-bits";
import { SCAM_CATEGORIES } from "@/lib/types";

interface Metrics {
  reports: {
    total: number;
    byStatus: Record<string, number>;
    queueDepth: number;
    syntheticCount: number;
    citizenCount: number;
  };
  patterns: { total: number; approved: number; candidate: number; rejected: number; withdrawn: number; trustedActive: number };
  reviews: { total: number; outcomes: { action: string; count: number }[] };
  audit: { total: number };
  trend: { date: string; count: number; synthetic: number; citizen: number }[];
  categories: { category: string; count: number }[];
  computedAt: string;
}

const PIE_COLORS = ["#2F5746", "#A44435", "#8A5B28", "#7D9C8B", "#59665F", "#C9A36A"];

export default function AnalystDashboard() {
  const bn = useLang() === "bn";
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<Metrics>("/api/v1/analyst/metrics")
      .then(setM)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-[#A44435] bn-text">{bn ? "মেট্রিক্স লোড করা যায়নি।" : "Failed to load metrics."}</p>;
  if (!m)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#EDEAE1] animate-pulse" />
        ))}
      </div>
    );

  const trendData = m.trend.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short" }),
  }));

  const outcomeData = m.reviews.outcomes.filter((o) => o.count > 0);
  const catData = m.categories.slice(0, 7).map((c) => ({
    name: SCAM_CATEGORIES[c.category]?.[bn ? "bn" : "en"] ?? c.category,
    count: c.count,
  }));

  return (
    <div className="space-y-6">
      {/* metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={bn ? "মোট রিপোর্ট" : "Total reports"} value={m.reports.total} icon={<ClipboardList className="h-5 w-5" aria-hidden />} hint={`${m.reports.citizenCount} ${bn ? "নাগরিক" : "citizen"} · ${m.reports.syntheticCount} ${bn ? "সিন্থেটিক" : "synthetic"}`} />
        <MetricCard label={bn ? "রিভিউ-কিউ" : "Review queue"} value={m.reports.queueDepth} icon={<Layers className="h-5 w-5" aria-hidden />} tone="warn" hint={bn ? "জমা + প্রার্থী + চলমান" : "submitted + candidate + under review"} />
        <MetricCard label={bn ? "প্যাটার্ন (মোট/প্রার্থী)" : "Patterns (total/candidate)"} value={`${m.patterns.total} / ${m.patterns.candidate}`} icon={<GitBranch className="h-5 w-5" aria-hidden />} />
        <MetricCard label={bn ? "সক্রিয় বিশ্বস্ত ইন্টেলিজেন্স" : "Active trusted intelligence"} value={m.patterns.trustedActive} icon={<ShieldCheck className="h-5 w-5" aria-hidden />} tone="good" hint={bn ? "অনুমোদিত ও অ-মেয়াদোত্তীর্ণ" : "approved & non-expired"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={bn ? "অনুমোদিত প্যাটার্ন" : "Approved patterns"} value={m.patterns.approved} icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} />
        <MetricCard label={bn ? "বাতিল প্যাটার্ন" : "Rejected patterns"} value={m.patterns.rejected} icon={<FileWarning className="h-5 w-5" aria-hidden />} />
        <MetricCard label={bn ? "মানব-রিভিউ" : "Human reviews"} value={m.reviews.total} icon={<Users className="h-5 w-5" aria-hidden />} />
        <MetricCard label={bn ? "অডিট ইভেন্ট" : "Audit events"} value={m.audit.total} icon={<Layers className="h-5 w-5" aria-hidden />} />
      </div>

      {/* trend + outcomes */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-5">
            <p className="mb-4 font-bold text-[#202C26] bn-text">
              {bn ? "রিপোর্ট ট্রেন্ড (১৪ দিন)" : "Report trend (14 days)"}
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="gCitizen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2F5746" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2F5746" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gSynthetic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A36A" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#C9A36A" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE1" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#59665F" }} tickLine={false} axisLine={{ stroke: "#D8DED5" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#59665F" }} tickLine={false} axisLine={{ stroke: "#D8DED5" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFEFA",
                      border: "1px solid #D8DED5",
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="citizen" name={bn ? "নাগরিক রিপোর্ট" : "Citizen reports"} stackId="1" stroke="#2F5746" fill="url(#gCitizen)" />
                  <Area type="monotone" dataKey="synthetic" name={bn ? "সিন্থেটিক (ডেমো)" : "Synthetic (demo)"} stackId="1" stroke="#C9A36A" fill="url(#gSynthetic)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-5">
            <p className="mb-4 font-bold text-[#202C26] bn-text">{bn ? "রিভিউয়ের ফলাফল" : "Review outcomes"}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData.map((o) => ({
                      name:
                        o.action === "approve" ? (bn ? "অনুমোদন" : "Approve")
                        : o.action === "reject" ? (bn ? "বাতিল" : "Reject")
                        : o.action === "split" ? (bn ? "বিভাজন" : "Split")
                        : o.action === "withdraw" ? (bn ? "প্রত্যাহার" : "Withdraw")
                        : o.action,
                      value: o.count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {outcomeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#FFFEFA", border: "1px solid #D8DED5", borderRadius: 10, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* category distribution */}
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5">
          <p className="mb-4 font-bold text-[#202C26] bn-text">{bn ? "প্রতারণার শ্রেণিবিন্যাস" : "Scam categories"}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE1" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#59665F" }} tickLine={false} axisLine={{ stroke: "#D8DED5" }} interval={0} angle={-18} textAnchor="end" height={58} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#59665F" }} tickLine={false} axisLine={{ stroke: "#D8DED5" }} />
                <Tooltip contentStyle={{ background: "#FFFEFA", border: "1px solid #D8DED5", borderRadius: 10, fontSize: 13 }} />
                <Bar dataKey="count" name={bn ? "রিপোর্ট" : "reports"} fill="#2F5746" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* reported offences list — Facebook-style management view (task: every
          reported incident visible, filterable, trackable from the dashboard) */}
      <ReportedOffencesList />

      {/* community posts moderation (reported posts → review → hide/restore) */}
      <CommunityPostsModeration />

      <p className="text-xs text-[#7D9C8B] bn-text">
        {bn ? "সব সংখ্যা ডেটাবেজ থেকে সরাসরি গণনাকৃত —" : "All figures are computed live from the database —"}{" "}
        {new Date(m.computedAt).toLocaleString(bn ? "bn-BD" : "en-GB")}.{" "}
        {bn ? "সিন্থেটিক ডেটা স্পষ্টভাবে চিহ্নিত (ডেমো সিমুলেশন)।" : "Synthetic data is clearly labeled (demo simulation)."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reported offences list — every report with its status (like Facebook's
// reported-posts section): who needs to act, what has been decided.
// ---------------------------------------------------------------------------

interface AdminReport {
  id: string;
  category: string;
  riskCategory: string | null;
  status: string;
  synthetic: boolean;
  submittedAt: string;
  contentRedacted: string;
}

const REPORT_STATUS: Record<string, { bn: string; en: string; cls: string }> = {
  pending: { bn: "অপেক্ষমাণ", en: "Pending", cls: "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50" },
  submitted: { bn: "জমা", en: "Submitted", cls: "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50" },
  candidate: { bn: "প্রার্থী", en: "Candidate", cls: "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50" },
  under_review: { bn: "রিভিউ চলছে", en: "Under review", cls: "border-[#2F5746]/50 text-[#2F5746] bg-[#DDE8DF]/50" },
  approved: { bn: "অনুমোদিত", en: "Approved", cls: "border-[#2F5746]/50 text-[#2F5746] bg-[#DDE8DF]/50" },
  published: { bn: "প্রকাশিত", en: "Published", cls: "border-[#7D9C8B]/50 text-[#7D9C8B] bg-[#EDEAE1]" },
  rejected: { bn: "বাতিল", en: "Rejected", cls: "border-[#A44435]/50 text-[#A44435] bg-[#F4E1DA]/50" },
  withdrawn: { bn: "প্রত্যাহৃত", en: "Withdrawn", cls: "border-[#59665F]/40 text-[#59665F] bg-[#EDEAE1]" },
};

function ReportedOffencesList() {
  const bn = useLang() === "bn";
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ reports: AdminReport[] }>("/api/v1/analyst/reports?status=all")
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]));
  };

  useEffect(load, []);

  if (reports === null) {
    return (
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5">
          <div className="h-40 rounded-xl bg-[#EDEAE1] animate-pulse" aria-busy />
        </CardContent>
      </Card>
    );
  }

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="border-[#D8DED5] bg-[#FFFEFA]">
      <CardContent className="p-5 space-y-4">
        <p className="font-bold text-[#202C26] bn-text">
          {bn ? "রিপোর্টকৃত ঘটনার তালিকা — সব অবস্থাসহ" : "Reported offences — every report, every status"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { k: "all", bn: `সব (${reports.length})`, en: `All (${reports.length})` },
            { k: "pending", bn: `অপেক্ষমাণ (${counts.pending ?? 0})`, en: `Pending (${counts.pending ?? 0})` },
            { k: "under_review", bn: `রিভিউ চলছে (${counts.under_review ?? 0})`, en: `Under review (${counts.under_review ?? 0})` },
            { k: "published", bn: `প্রকাশিত (${counts.published ?? 0})`, en: `Published (${counts.published ?? 0})` },
            { k: "rejected", bn: `বাতিল (${counts.rejected ?? 0})`, en: `Rejected (${counts.rejected ?? 0})` },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-ring bn-text ${
                filter === f.k ? "border-[#2F5746] bg-[#DDE8DF] text-[#2F5746]" : "border-[#D8DED5] bg-[#FFFEFA] text-[#59665F] hover:border-[#8A9B90]"
              }`}
              aria-pressed={filter === f.k}
            >
              {bn ? f.bn : f.en}
            </button>
          ))}
        </div>
        <div className="max-h-96 overflow-y-auto scroll-soft divide-y divide-[#EDEAE1] border border-[#D8DED5] rounded-xl">
          {visible.length === 0 && (
            <p className="p-4 text-sm text-[#8A9B90] bn-text">{bn ? "এই অবস্থায় কোনো রিপোর্ট নেই।" : "No reports with this status."}</p>
          )}
          {visible.slice(0, 50).map((r) => {
            const st = REPORT_STATUS[r.status] ?? REPORT_STATUS.pending;
            return (
              <div key={r.id}>
                <button
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F4F1EB]/60 focus-ring"
                  aria-expanded={openId === r.id}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#2F5746]">{r.id}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold bn-text ${st.cls}`}>
                        {bn ? st.bn : st.en}
                      </span>
                      {r.synthetic && (
                        <span className="rounded-full border border-[#8A9B90]/50 px-2 py-0.5 text-[10px] text-[#8A9B90]">
                          {bn ? "ডেমো" : "Demo"}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#59665F] bn-text">
                      {SCAM_CATEGORIES[r.category]?.[bn ? "bn" : "en"] ?? r.category} ·{" "}
                      {new Date(r.submittedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-[#2F5746] shrink-0" aria-hidden>
                    {openId === r.id ? "▲" : "▼"}
                  </span>
                </button>
                {openId === r.id && (
                  <div className="bg-[#F4F1EB]/50 px-4 py-3">
                    <p className="text-xs text-[#59665F] leading-relaxed bn-text">{r.contentRedacted.slice(0, 400)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Community posts moderation — the reported-posts queue for the feed.
// ---------------------------------------------------------------------------

interface AdminPost {
  id: string;
  ref: string;
  kind: string;
  body: string;
  status: string;
  aiRisk: string;
  reportCount: number;
  helpfulCount: number;
  commentCount: number;
  createdAt: string;
  author: { publicId: string; name: string; username: string };
}

function CommunityPostsModeration() {
  const bn = useLang() === "bn";
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ posts: AdminPost[] }>("/api/v1/analyst/posts")
      .then((r) => setPosts(r.posts))
      .catch(() => setPosts([]));
  };

  useEffect(load, []);

  const moderate = async (id: string, action: "hide" | "restore") => {
    setBusyId(id);
    try {
      await api.patch(`/api/v1/analyst/posts/${id}`, { action });
      load();
    } catch {
      /* handled by api layer */
    } finally {
      setBusyId(null);
    }
  };

  if (posts === null) {
    return (
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5">
          <div className="h-32 rounded-xl bg-[#EDEAE1] animate-pulse" aria-busy />
        </CardContent>
      </Card>
    );
  }

  const reported = posts.filter((p) => p.reportCount > 0 || p.status === "under_review");

  return (
    <Card className="border-[#D8DED5] bg-[#FFFEFA]">
      <CardContent className="p-5 space-y-4">
        <p className="font-bold text-[#202C26] bn-text">
          {bn ? "কমিউনিটি পোস্ট মডারেশন" : "Community posts moderation"}
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-[#8A9B90] bn-text">{bn ? "এখনো কোনো পোস্ট নেই।" : "No posts yet."}</p>
        ) : (
          <>
            {reported.length > 0 && (
              <p className="rounded-lg border border-[#8A5B28]/40 bg-[#F2E8D5]/50 px-3 py-2 text-sm text-[#8A5B28] bn-text">
                {bn
                  ? `${reported.length} টি পোস্ট রিপোর্ট হয়েছে / রিভিউতে আছে — নিচে সিদ্ধান্ত দিন।`
                  : `${reported.length} post(s) reported / under review — decide below.`}
              </p>
            )}
            <div className="max-h-96 overflow-y-auto scroll-soft divide-y divide-[#EDEAE1] border border-[#D8DED5] rounded-xl">
              {posts.slice(0, 40).map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[#8A9B90]">{p.ref}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          p.status === "active"
                            ? "border-[#2F5746]/40 text-[#2F5746]"
                            : p.status === "under_review"
                              ? "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50"
                              : "border-[#A44435]/50 text-[#A44435] bg-[#F4E1DA]/50"
                        }`}
                      >
                        {p.status === "active" ? (bn ? "সচল" : "Active") : p.status === "under_review" ? (bn ? "রিভিউতে" : "Under review") : bn ? "লুকানো" : "Hidden"}
                      </span>
                      {p.reportCount > 0 && (
                        <span className="rounded-full bg-[#A44435] px-2 py-0.5 text-[10px] font-bold text-[#FFFEFA]">
                          {bn ? `${p.reportCount} রিপোর্ট` : `${p.reportCount} reports`}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-[#202C26] bn-text line-clamp-2">{p.body}</p>
                    <p className="mt-0.5 text-[11px] text-[#8A9B90]">
                      {p.author.name} · {p.author.publicId} · {bn ? "এআই ঝুঁকি:" : "AI risk:"} {p.aiRisk}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {p.status === "hidden" ? (
                      <button
                        onClick={() => moderate(p.id, "restore")}
                        disabled={busyId === p.id}
                        className="rounded-lg border border-[#2F5746]/50 px-3 py-1.5 text-xs font-bold text-[#2F5746] hover:bg-[#DDE8DF] focus-ring bn-text disabled:opacity-50"
                      >
                        {bn ? "ফিরিয়ে আনুন" : "Restore"}
                      </button>
                    ) : (
                      <button
                        onClick={() => moderate(p.id, "hide")}
                        disabled={busyId === p.id}
                        className="rounded-lg border border-[#A44435]/50 px-3 py-1.5 text-xs font-bold text-[#A44435] hover:bg-[#F4E1DA] focus-ring bn-text disabled:opacity-50"
                      >
                        {bn ? "লুকান" : "Hide"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
