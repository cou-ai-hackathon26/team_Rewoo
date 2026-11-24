"use client";

// "My dashboard" — member profile, post tracking (ref + status + response
// counts) and official-report tracking. Private to the signed-in member.

import { useCallback, useEffect, useState } from "react";
import {
  User,
  FileText,
  Flag,
  Loader2,
  MessageSquare,
  ThumbsUp,
  RefreshCw,
  LogOut,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "../api";
import { useLang } from "../i18n";
import { useMember } from "../member";
import { AuthDialog } from "../auth-panel";
import { toBn, timeAgo, Avatar } from "./community-feed";
import { cn } from "@/lib/utils";

interface MyPost {
  id: string;
  ref: string;
  kind: string;
  body: string;
  status: string;
  aiRisk: string;
  helpfulCount: number;
  commentCount: number;
  createdAt: string;
}

interface MyReport {
  id: string;
  category: string;
  status: string;
  submittedAt: string;
  synthetic: boolean;
}

export function MyDashboard() {
  const bn = useLang() === "bn";
  const member = useMember((s) => s.member);
  const logout = useMember((s) => s.logout);
  const [authOpen, setAuthOpen] = useState(false);
  const [data, setData] = useState<{ posts: MyPost[]; reports: MyReport[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ posts: MyPost[]; reports: MyReport[] }>("/api/v1/community/mine");
      setData({ posts: res.posts, reports: res.reports });
    } catch {
      setData({ posts: [], reports: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (member) load();
  }, [member, load]);

  if (!member) {
    return (
      <Card className="border-dashed border-[#D8DED5] bg-[#F4F1EB]">
        <CardContent className="p-8 text-center space-y-4">
          <User className="mx-auto h-10 w-10 text-[#8A9B90]" aria-hidden />
          <p className="font-semibold text-[#202C26] bn-text">
            {bn ? "আপনার ড্যাশবোর্ড দেখতে সাইন-ইন করুন" : "Sign in to see your dashboard"}
          </p>
          <p className="text-sm text-[#59665F] bn-text">
            {bn
              ? "নিজের পোস্টের অবস্থা, মন্তব্য ও রিপোর্টের ট্র্যাকিং এক জায়গায় পাবেন।"
              : "Track your posts, responses and reports in one place."}
          </p>
          <Button onClick={() => setAuthOpen(true)} className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] h-12 px-6 font-bold rounded-xl">
            {bn ? "সাইন-ইন / আইডি তৈরি" : "Sign in / Create ID"}
          </Button>
        </CardContent>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </Card>
    );
  }

  const totalHelpful = (data?.posts ?? []).reduce((a, p) => a + p.helpfulCount, 0);

  return (
    <div className="space-y-5">
      {/* profile card */}
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar name={member.name} publicId={member.publicId} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#202C26] bn-text">{member.name}</h2>
                <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  <span className="font-mono">{member.publicId}</span>
                </Badge>
              </div>
              <p className="text-sm text-[#8A9B90]">@{member.username}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#59665F] bn-text">
                <span>
                  {bn ? "পোস্ট: " : "Posts: "}
                  <strong className="text-[#202C26]">{toBn(data?.posts.length ?? 0)}</strong>
                </span>
                <span>
                  {bn ? "‘কাজে লাগলো’ পেয়েছেন: " : "Helpful received: "}
                  <strong className="text-[#202C26]">{toBn(totalHelpful)}</strong>
                </span>
                <span>
                  {bn ? "রিপোর্ট: " : "Reports: "}
                  <strong className="text-[#202C26]">{toBn(data?.reports.length ?? 0)}</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={load}
                disabled={loading}
                className="border-[#D8DED5] text-[#2F5746] hover:bg-[#DDE8DF] h-11"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                <span className="sr-only">{bn ? "রিফ্রেশ" : "Refresh"}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => logout()}
                className="border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA] h-11 gap-1.5 font-semibold"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {bn ? "সাইন-আউট" : "Sign out"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* my posts */}
      <section aria-labelledby="my-posts-h">
        <h3 id="my-posts-h" className="flex items-center gap-2 text-lg font-bold text-[#202C26] mb-3 bn-text">
          <FileText className="h-5 w-5 text-[#2F5746]" aria-hidden />
          {bn ? "আমার পোস্টসমূহ" : "My posts"}
          {data && <span className="text-sm font-normal text-[#8A9B90]">({toBn(data.posts.length)})</span>}
        </h3>
        {data === null ? (
          <div className="h-24 rounded-2xl bg-[#EDEAE1] animate-pulse" aria-busy />
        ) : data.posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D8DED5] bg-[#F4F1EB] px-4 py-5 text-sm text-[#59665F] bn-text">
            {bn ? "এখনো কোনো পোস্ট করেননি — ফিডে গিয়ে প্রথম সতর্কতা বা অভিজ্ঞতা শেয়ার করুন।" : "No posts yet — share your first alert or experience from the feed."}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.posts.map((p) => (
              <li key={p.id} className="rounded-xl border border-[#D8DED5] bg-[#FFFEFA] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-[#8A9B90]">{p.ref}</span>
                    <PostStatusBadge status={p.status} bn={bn} />
                  </div>
                  <span className="text-xs text-[#8A9B90]">{timeAgo(p.createdAt, bn)}</span>
                </div>
                <p className="mt-2 text-sm text-[#202C26] bn-text line-clamp-2">{p.body}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-[#59665F] bn-text">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    {toBn(p.helpfulCount)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    {toBn(p.commentCount)} {bn ? "মন্তব্য" : "comments"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* my official reports */}
      <section aria-labelledby="my-reports-h">
        <h3 id="my-reports-h" className="flex items-center gap-2 text-lg font-bold text-[#202C26] mb-3 bn-text">
          <Flag className="h-5 w-5 text-[#2F5746]" aria-hidden />
          {bn ? "আমার রিপোর্টসমূহ" : "My official reports"}
          {data && <span className="text-sm font-normal text-[#8A9B90]">({toBn(data.reports.length)})</span>}
        </h3>
        {data === null ? (
          <div className="h-24 rounded-2xl bg-[#EDEAE1] animate-pulse" aria-busy />
        ) : data.reports.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D8DED5] bg-[#F4F1EB] px-4 py-5 text-sm text-[#59665F] bn-text">
            {bn
              ? "কোনো আনুষ্ঠানিক রিপোর্ট নেই — প্রতারণার ঘটনা «রিপোর্ট» ট্যাব থেকে জানাতে পারেন, অবস্থা এখানেই ট্র্যাক হবে।"
              : "No official reports yet — submit from the Reports tab and track their status here."}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-[#D8DED5] bg-[#FFFEFA] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-[#2F5746]">{r.id}</span>
                  <span className="text-xs text-[#8A9B90]">{timeAgo(r.submittedAt, bn)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ReportStatusBadge status={r.status} bn={bn} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PostStatusBadge({ status, bn }: { status: string; bn: boolean }) {
  const map: Record<string, { bn: string; en: string; cls: string }> = {
    active: { bn: "প্রকাশিত", en: "Live", cls: "border-[#2F5746]/40 text-[#2F5746] bg-[#DDE8DF]/40" },
    under_review: { bn: "রিভিউতে আছে", en: "Under review", cls: "border-[#8A5B28]/50 text-[#8A5B28] bg-[#F2E8D5]/50" },
    hidden: { bn: "মডারেটর সরিয়েছেন", en: "Removed by moderator", cls: "border-[#A44435]/50 text-[#A44435] bg-[#F4E1DA]/50" },
  };
  const m = map[status] ?? map.active;
  return (
    <Badge variant="outline" className={cn("bn-text text-[11px]", m.cls)}>
      {bn ? m.bn : m.en}
    </Badge>
  );
}

function ReportStatusBadge({ status, bn }: { status: string; bn: boolean }) {
  const map: Record<string, { bn: string; en: string }> = {
    pending: { bn: "অপেক্ষমাণ — রিভিউ কিউতে", en: "Pending — in review queue" },
    under_review: { bn: "এখন রিভিউ হচ্ছে", en: "Under review" },
    approved: { bn: "অনুমোদিত", en: "Approved" },
    published: { bn: "প্রকাশিত সতর্কতা", en: "Published as alert" },
    rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected" },
    withdrawn: { bn: "প্রত্যাহার করা হয়েছে", en: "Withdrawn" },
  };
  const m = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] bn-text text-[11px]">
      {bn ? m.bn : m.en}
    </Badge>
  );
}
