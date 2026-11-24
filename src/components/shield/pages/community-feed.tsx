"use client";

// Community feed — Facebook-style posts: alerts, help requests, experiences.
// Composer (text + image), AI safety notice, helpful marks, comments,
// and post reporting. Guests browse; members interact.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  HandHeart,
  BookOpen,
  Image as ImageIcon,
  X,
  Loader2,
  Send,
  ThumbsUp,
  MessageSquare,
  Flag,
  MoreHorizontal,
  Bot,
  EyeOff,
  Search,
  BadgeCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ShieldApiError } from "../api";
import { useLang } from "../i18n";
import { useMember, avatarColor } from "../member";
import { AuthDialog } from "../auth-panel";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

export interface FeedPost {
  id: string;
  ref: string;
  kind: string; // alert | help | experience
  body: string;
  hasImage: boolean;
  aiRisk: "pending" | "none" | "caution" | "high";
  aiSignals: { id: string; label: { bn: string; en: string } }[];
  aiSummary: { bn: string; en: string } | null;
  aiEngine: string | null;
  status: string; // active | under_review | hidden
  synthetic: boolean;
  helpfulCount: number;
  commentCount: number;
  createdAt: string;
  author: { publicId: string; name: string; username: string | null };
  markedHelpful: boolean;
}

interface FeedComment {
  id: string;
  body: string;
  isAgent: boolean;
  createdAt: string;
  author: { publicId: string; name: string; username: string | null };
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBn(n: number | string): string {
  return String(n)
    .split("")
    .map((d) => (/\d/.test(d) ? BN_DIGITS[Number(d)] : d))
    .join("");
}

export function timeAgo(iso: string, bn: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return bn ? "এইমাত্র" : "just now";
  if (m < 60) return bn ? `${toBn(m)} মিনিট আগে` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return bn ? `${toBn(h)} ঘণ্টা আগে` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return bn ? `${toBn(d)} দিন আগে` : `${d}d ago`;
  const date = new Date(iso).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  return date;
}

export function Avatar({ name, publicId, size = 40 }: { name: string; publicId: string; size?: number }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-[#FFFEFA] bn-text select-none"
      style={{ width: size, height: size, background: avatarColor(publicId), fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** Re-encode an image client-side: strip EXIF, cap at 1280px, JPEG q0.85. */
async function processImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const KIND_META: Record<string, { icon: React.ReactNode; bn: string; en: string }> = {
  alert: { icon: <Megaphone className="h-4 w-4" aria-hidden />, bn: "সতর্কতা", en: "Alert" },
  help: { icon: <HandHeart className="h-4 w-4" aria-hidden />, bn: "সাহায্য চাই", en: "Need help" },
  experience: { icon: <BookOpen className="h-4 w-4" aria-hidden />, bn: "অভিজ্ঞতা", en: "Experience" },
};

export function Composer({ defaultKind = "alert", onPosted }: { defaultKind?: string; onPosted: (p: FeedPost) => void }) {
  const bn = useLang() === "bn";
  const member = useMember((s) => s.member);
  const [authOpen, setAuthOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!member) {
    return (
      <>
        <Card className="border-dashed border-[#D8DED5] bg-[#F4F1EB]">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <p className="text-[15px] text-[#59665F] bn-text text-center sm:text-left">
              {bn
                ? "নিজের সতর্কতা বা অভিজ্ঞতা সবার সাথে ভাগ করুন, কিংবা সাহায্য চান — প্রথমে একটি সদস্য আইডি নিন (১ মিনিটই লাগে)।"
                : "Share your alert or experience, or ask for help — first create a member ID (takes a minute)."}
            </p>
            <Button
              onClick={() => setAuthOpen(true)}
              className="h-12 px-6 shrink-0 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] rounded-xl font-bold"
            >
              {bn ? "সদস্য আইডি নিন" : "Get a member ID"}
            </Button>
          </CardContent>
        </Card>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  const pickImage = async (f: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error(bn ? "শুধু PNG / JPG / WebP ছবি গ্রহণযোগ্য" : "Only PNG / JPG / WebP accepted");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error(bn ? "ছবিটি খুব বড়" : "Image too large");
      return;
    }
    try {
      const dataUrl = await processImage(f);
      if (dataUrl.length > 1.4 * 1024 * 1024) {
        toast.error(bn ? "ছবিটি এখনো খুব বড় — ছোট ছবি দিন" : "Image still too large after compression");
        return;
      }
      setImage(dataUrl);
    } catch {
      toast.error(bn ? "ছবিটি পড়া যায়নি" : "Could not read the image");
    }
  };

  const submit = async () => {
    if (body.trim().length < 5) {
      toast.error(bn ? "আরেকটু লিখুন (কমপক্ষে ৫ অক্ষর)" : "Write a bit more (at least 5 characters)");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ post: FeedPost }>("/api/v1/community/posts", {
        kind,
        body,
        imageData: image,
      });
      onPosted(res.post);
      setBody("");
      setImage(null);
      toast.success(
        kind === "help"
          ? bn ? "সাহায্যের অনুরোধ পোস্ট হয়েছে — শিল্ডএজেন্ট এখনই প্রাথমিক উত্তর দিচ্ছে" : "Posted — ShieldAgent is preparing an initial reply"
          : bn ? "পোস্ট হয়েছে" : "Posted"
      );
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
      else toast.error(bn ? "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন" : "Network problem — please retry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-[#D8DED5] bg-[#FFFEFA]">
      <CardContent className="p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={member.name} publicId={member.publicId} />
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                kind === "help"
                  ? bn
                    ? "কী ঘটেছে লিখুন — কমিউনিটি ও শিল্ডএজেন্ট সাহায্য করবে…"
                    : "Describe what happened — the community and ShieldAgent will help…"
                  : bn
                    ? "সতর্কতা বা অভিজ্ঞতা লিখুন… (নিজের নম্বর বা ওটিপি কখনোই লিখবেন না)"
                    : "Write your alert or experience… (never post your own number or OTP)"
              }
              className="bg-[#F4F1EB] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text text-[15px]"
              aria-label={bn ? "পোস্ট লেখা" : "Post text"}
            />
            <div className="mt-1 text-right text-xs text-[#8A9B90] tabular-nums">{toBn(body.length)}/{bn ? "২০০০" : "2000"}</div>
          </div>
        </div>

        {image && (
          <div className="relative ml-11 inline-block">
            { }
            <img src={image} alt={bn ? "সংযুক্ত ছবির প্রিভিউ" : "Attached image preview"} className="h-28 rounded-xl border border-[#D8DED5] object-cover" />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#A44435] text-[#FFFEFA] focus-ring"
              aria-label={bn ? "ছবি সরান" : "Remove image"}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 ml-11">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={bn ? "পোস্টের ধরন" : "Post type"}>
            {(["alert", "help", "experience"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-ring bn-text",
                  kind === k
                    ? "border-[#2F5746] bg-[#DDE8DF] text-[#2F5746]"
                    : "border-[#D8DED5] bg-[#FFFEFA] text-[#59665F] hover:border-[#8A9B90]"
                )}
                aria-pressed={kind === k}
              >
                {KIND_META[k].icon}
                {bn ? KIND_META[k].bn : KIND_META[k].en}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickImage(f);
                e.currentTarget.value = "";
              }}
              aria-label={bn ? "ছবি সংযুক্ত করুন" : "Attach image"}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileRef.current?.click()}
              className="h-11 w-11 border-[#D8DED5] text-[#2F5746] hover:bg-[#DDE8DF]"
              aria-label={bn ? "ছবি যোগ করুন" : "Add image"}
            >
              <ImageIcon className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              onClick={submit}
              disabled={busy || body.trim().length < 5}
              className="h-11 px-5 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] rounded-xl font-bold gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {busy ? (bn ? "পোস্ট হচ্ছে…" : "Posting…") : bn ? "পোস্ট করুন" : "Post"}
            </Button>
          </div>
        </div>

        <p className="ml-11 flex items-start gap-1.5 text-xs text-[#8A9B90] bn-text">
          <Bot className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          {bn
            ? "পোস্ট করলে শিল্ডএজেন্ট স্বয়ংক্রিয়ভাবে একটি “এআই নিরাপত্তা নোটিশ” যোগ করবে — সবাই দেখতে পাবে, এটি অযাচাইকৃত এআই মতামত।"
            : "When you post, ShieldAgent adds a visible \"AI safety notice\" — clearly labeled, unverified AI assessment."}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------

export function PostCard({ post, onChange }: { post: FeedPost; onChange: (p: FeedPost) => void }) {
  const bn = useLang() === "bn";
  const member = useMember((s) => s.member);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [helpfulBusy, setHelpfulBusy] = useState(false);

  const kindMeta = KIND_META[post.kind] ?? KIND_META.experience;
  const summary = post.aiSummary ? (bn ? post.aiSummary.bn : post.aiSummary.en) : null;

  const toggleHelpful = async () => {
    if (!member) {
      setAuthMode("register");
      setAuthOpen(true);
      return;
    }
    setHelpfulBusy(true);
    try {
      const res = await api.post<{ marked: boolean }>(`/api/v1/community/posts/${post.id}/helpful`, {});
      onChange({
        ...post,
        markedHelpful: res.marked,
        helpfulCount: post.helpfulCount + (res.marked ? 1 : -1),
      });
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
    } finally {
      setHelpfulBusy(false);
    }
  };

  const report = async (reason: string) => {
    try {
      await api.post(`/api/v1/community/posts/${post.id}/report`, { reason });
      toast.success(bn ? "মডারেটরদের কাছে পৌঁছে গেছে — পোস্টটি এখন রিভিউতে আছে" : "Sent to moderators — the post is now under review");
      onChange({ ...post, status: "under_review" });
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
    }
  };

  return (
    <Card className={cn("border-[#D8DED5] bg-[#FFFEFA]", post.status === "under_review" && "border-[#8A5B28]/40")}>
      <CardContent className="p-4 md:p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={post.author.name} publicId={post.author.publicId} />
            <div className="min-w-0">
              <p className="font-bold text-[#202C26] bn-text leading-tight truncate">{post.author.name}</p>
              <p className="text-xs text-[#8A9B90] flex items-center gap-1.5 flex-wrap">
                <span className="font-mono">{post.author.publicId}</span>
                <span aria-hidden>·</span>
                <time dateTime={post.createdAt}>{timeAgo(post.createdAt, bn)}</time>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={cn(
                "bn-text text-[11px] gap-1",
                post.kind === "alert" && "border-[#8A5B28]/50 text-[#8A5B28]",
                post.kind === "help" && "border-[#2F5746]/50 text-[#2F5746]",
                post.kind === "experience" && "border-[#59665F]/40 text-[#59665F]"
              )}
            >
              {kindMeta.icon}
              {bn ? kindMeta.bn : kindMeta.en}
            </Badge>
            {post.synthetic && (
              <Badge variant="outline" className="border-[#8A9B90]/50 text-[#8A9B90] text-[11px]">
                {bn ? "ডেমো" : "Demo"}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[#59665F]"
                  aria-label={bn ? "পোস্ট মেনু" : "Post menu"}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[#D8DED5] bg-[#FFFEFA]">
                <DropdownMenuItem
                  onClick={() =>
                    report(
                      bn
                        ? "ভুয়া / বিভ্রান্তিকর তথ্য (fake or misleading information)"
                        : "Fake or misleading information"
                    )
                  }
                  className="bn-text gap-2"
                >
                  <Flag className="h-4 w-4" aria-hidden />
                  {bn ? "ভুয়া তথ্য বলে জানান" : "Report misleading info"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    report(
                      bn ? "কারও ক্ষতি বা হয়রানির আশঙ্কা (possible harm or harassment)" : "Possible harm or harassment"
                    )
                  }
                  className="bn-text gap-2"
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                  {bn ? "ক্ষতিকর বলে জানান" : "Report harmful content"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => report(bn ? "অন্যান্য কারণ" : "Other reason")}
                  className="bn-text gap-2"
                >
                  <Info className="h-4 w-4" aria-hidden />
                  {bn ? "অন্য কারণে জানান" : "Report other issue"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* body */}
        <p className="mt-3 text-[15px] text-[#202C26] leading-relaxed whitespace-pre-wrap break-words bn-text">{post.body}</p>

        {post.hasImage && (
          <a
            href={`/api/v1/community/posts/${post.id}/image`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-xl overflow-hidden border border-[#D8DED5] focus-ring"
            aria-label={bn ? "সংযুক্ত ছবি দেখুন" : "View attached image"}
          >
            { }
            <img
              src={`/api/v1/community/posts/${post.id}/image`}
              alt={bn ? "পোস্টে সংযুক্ত ছবি" : "Image attached to the post"}
              loading="lazy"
              className="w-full max-h-96 object-cover bg-[#F4F1EB]"
            />
          </a>
        )}

        {/* AI safety notice */}
        {(post.aiRisk !== "none" || (post.aiSignals?.length ?? 0) > 0 || summary) && (
          <div
            className={cn(
              "mt-3 rounded-xl border p-3",
              post.aiRisk === "high" && "border-[#A44435]/40 bg-[#F4E1DA]/40",
              post.aiRisk === "caution" && "border-[#8A5B28]/40 bg-[#F2E8D5]/50",
              post.aiRisk === "none" && "border-[#2F5746]/25 bg-[#DDE8DF]/40",
              post.aiRisk === "pending" && "border-[#D8DED5] bg-[#F4F1EB]"
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold bn-text">
              <Bot
                className={cn(
                  "h-3.5 w-3.5",
                  post.aiRisk === "high" && "text-[#A44435]",
                  post.aiRisk === "caution" && "text-[#8A5B28]",
                  post.aiRisk === "none" && "text-[#2F5746]"
                )}
                aria-hidden
              />
              {bn ? "শিল্ডএজেন্ট এআই নিরাপত্তা নোটিশ" : "ShieldAgent AI safety notice"}
              <span className="font-normal text-[#8A9B90]">· {bn ? "অযাচাইকৃত" : "unverified"}</span>
            </p>
            {summary && <p className="mt-1.5 text-sm text-[#59665F] leading-relaxed bn-text">{summary}</p>}
            {post.aiRisk === "high" && !summary && (
              <p className="mt-1.5 text-sm text-[#A44435] font-semibold bn-text">
                {bn
                  ? "সতর্কতা: এই পোস্টে পাঠকদের জন্য ঝুঁকিপূর্ণ নির্দেশনা থাকতে পারে — যাচাই না করে কোনো নম্বরে কল বা টাকা পাঠাবেন না।"
                  : "Caution: this post may direct readers toward danger — never call numbers or send money without independent verification."}
              </p>
            )}
            {post.aiSignals?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {post.aiSignals.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-start gap-1.5 text-xs text-[#59665F] bn-text">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-[#8A5B28]" aria-hidden />
                    {bn ? s.label.bn : s.label.en}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {post.status === "under_review" && (
          <p className="mt-3 rounded-lg bg-[#F2E8D5]/60 border border-[#8A5B28]/30 px-3 py-2 text-xs text-[#8A5B28] font-semibold bn-text">
            {bn
              ? "রিভিউতে আছে: কেউ এই পোস্টটি রিপোর্ট করেছে — মডারেটর দেখে সিদ্ধান্ত দেবেন।"
              : "Under review: someone reported this post — a moderator will decide."}
          </p>
        )}

        {/* actions */}
        <div className="mt-3 pt-3 border-t border-[#EDEAE1] flex items-center gap-1">
          <button
            onClick={toggleHelpful}
            disabled={helpfulBusy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-ring bn-text",
              post.markedHelpful ? "text-[#2F5746] bg-[#DDE8DF]" : "text-[#59665F] hover:bg-[#F4F1EB]"
            )}
            aria-pressed={post.markedHelpful}
            aria-label={bn ? "কাজে লাগলো চিহ্ন" : "Mark helpful"}
          >
            {helpfulBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ThumbsUp className={cn("h-4 w-4", post.markedHelpful && "fill-current")} aria-hidden />
            )}
            {bn ? "কাজে লাগলো" : "Helpful"} {toBn(post.helpfulCount)}
          </button>
          <button
            onClick={() => setCommentsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#59665F] hover:bg-[#F4F1EB] transition-colors focus-ring bn-text"
            aria-expanded={commentsOpen}
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            {bn ? "মন্তব্য" : "Comments"} {toBn(post.commentCount)}
          </button>
        </div>

        {commentsOpen && <CommentsSection post={post} onChange={onChange} />}
      </CardContent>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsSection({ post, onChange }: { post: FeedPost; onChange: (p: FeedPost) => void }) {
  const bn = useLang() === "bn";
  const member = useMember((s) => s.member);
  const [authOpen, setAuthOpen] = useState(false);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ comments: FeedComment[] }>(`/api/v1/community/posts/${post.id}/comments`);
      setComments(res.comments);
    } catch {
      setComments([]);
    }
  }, [post.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (body.trim().length < 1) return;
    setBusy(true);
    try {
      const res = await api.post<{ comment: FeedComment }>(`/api/v1/community/posts/${post.id}/comments`, { body });
      setComments((c) => [...(c ?? []), res.comment]);
      setBody("");
      onChange({ ...post, commentCount: post.commentCount + 1 });
    } catch (err) {
      if (err instanceof ShieldApiError) toast.error(err.apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#EDEAE1] space-y-3" aria-label={bn ? "মন্তব্যসমূহ" : "Comments"}>
      {comments === null ? (
        <div className="space-y-2" aria-busy>
          <div className="h-12 rounded-xl bg-[#EDEAE1] animate-pulse" />
          <div className="h-12 rounded-xl bg-[#EDEAE1] animate-pulse" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[#8A9B90] bn-text">
          {bn ? "এখনো কোনো মন্তব্য নেই — প্রথম মন্তব্যটি আপনিই করুন।" : "No comments yet — be the first to reply."}
        </p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.isAgent ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F5746]">
                  <Bot className="h-4 w-4 text-[#DDE8DF]" aria-hidden />
                </span>
              ) : (
                <Avatar name={c.author.name} publicId={c.author.publicId} size={32} />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="font-bold text-[#202C26] bn-text">{c.isAgent ? "ShieldAgent" : c.author.name}</span>
                  {c.isAgent && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-[#2F5746]/40 text-[#2F5746]">
                      {bn ? "এআই · লেবেলকৃত" : "AI · labeled"}
                    </Badge>
                  )}
                  <span className="text-[#8A9B90]">{timeAgo(c.createdAt, bn)}</span>
                </p>
                <div
                  className={cn(
                    "mt-1 rounded-xl px-3 py-2 text-sm leading-relaxed bn-text whitespace-pre-wrap break-words",
                    c.isAgent ? "bg-[#DDE8DF]/50 border border-[#2F5746]/20 text-[#202C26]" : "bg-[#F4F1EB] text-[#202C26]"
                  )}
                >
                  {c.body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {member ? (
        <div className="flex items-start gap-2.5">
          <Avatar name={member.name} publicId={member.publicId} size={32} />
          <div className="flex-1 flex gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={bn ? "সহানুভূতিশীল মন্তব্য লিখুন…" : "Write a kind, helpful reply…"}
              className="bg-[#F4F1EB] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text text-sm"
              aria-label={bn ? "নতুন মন্তব্য" : "New comment"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
            <Button
              onClick={submit}
              disabled={busy || body.trim().length < 1}
              size="icon"
              className="h-11 w-11 shrink-0 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]"
              aria-label={bn ? "মন্তব্য পাঠান" : "Send comment"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAuthOpen(true)}
          className="w-full rounded-xl border border-dashed border-[#D8DED5] bg-[#F4F1EB] px-4 py-3 text-sm font-semibold text-[#2F5746] hover:border-[#2F5746]/50 focus-ring bn-text"
        >
          {bn ? "মন্তব্য করতে সাইন-ইন করুন →" : "Sign in to comment →"}
        </button>
      )}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed (list + search + filter)
// ---------------------------------------------------------------------------

export function CommunityFeed({ forcedKind }: { forcedKind?: "alert" | "help" | "experience" }) {
  const bn = useLang() === "bn";
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<string>(forcedKind ?? "all");
  const [reloadKey, setReloadKey] = useState(0);

  // Feed loading: setState only in promise callbacks (external-system sync).
  useEffect(() => {
    let alive = true;
    const kindParam = forcedKind ?? kindFilter;
    api
      .get<{ posts: FeedPost[] }>(`/api/v1/community/posts?limit=30${kindParam !== "all" ? `&kind=${kindParam}` : ""}`)
      .then((res) => {
        if (alive) {
          setPosts(res.posts);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setPosts([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [forcedKind, kindFilter, reloadKey]);

  const visible = (posts ?? []).filter(
    (p) =>
      !filter.trim() || p.body.toLowerCase().includes(filter.toLowerCase()) || p.author.name.toLowerCase().includes(filter.toLowerCase())
  );

  const updatePost = (next: FeedPost) => {
    setPosts((ps) => (ps ?? []).map((p) => (p.id === next.id ? next : p)));
  };

  return (
    <div className="space-y-4">
      {!forcedKind && (
        <Composer onPosted={(p) => setPosts((ps) => [p, ...(ps ?? [])])} />
      )}
      {forcedKind === "help" && <Composer defaultKind="help" onPosted={(p) => setPosts((ps) => [p, ...(ps ?? [])])} />}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9B90]" aria-hidden />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={bn ? "পোস্টে খুঁজুন (যেমন: ওটিপি, নগদ)…" : "Search posts (e.g. OTP, Nagad)…"}
            className="pl-9 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
            aria-label={bn ? "পোস্ট অনুসন্ধান" : "Search posts"}
          />
        </div>
        {!forcedKind && (
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label={bn ? "ধরন অনুসারে ছাঁকনি" : "Filter by kind"}>
            {[
              { k: "all", bn: "সব", en: "All" },
              { k: "alert", bn: "সতর্কতা", en: "Alerts" },
              { k: "help", bn: "সাহায্য", en: "Help" },
              { k: "experience", bn: "অভিজ্ঞতা", en: "Experiences" },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setKindFilter(f.k)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors focus-ring bn-text",
                  kindFilter === f.k
                    ? "border-[#2F5746] bg-[#DDE8DF] text-[#2F5746]"
                    : "border-[#D8DED5] bg-[#FFFEFA] text-[#59665F] hover:border-[#8A9B90]"
                )}
                aria-pressed={kindFilter === f.k}
              >
                {bn ? f.bn : f.en}
              </button>
            ))}
          </div>
        )}
      </div>

      {posts === null && (
        <div className="space-y-4" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#EDEAE1] animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-[#A44435]/40 bg-[#FFFEFA]">
          <CardContent className="p-6 text-center">
            <p className="font-semibold text-[#A44435] bn-text">
              {bn ? "ফিড লোড হয়নি — আবার চেষ্টা করুন" : "Feed failed to load — please retry"}
            </p>
            <Button onClick={() => setReloadKey((k) => k + 1)} variant="outline" className="mt-3 border-[#2F5746]/40 text-[#2F5746]">
              {bn ? "আবার চেষ্টা" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      )}

      {posts !== null && visible.length === 0 && !error && (
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-8 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-[#8A9B90]" aria-hidden />
            <p className="mt-3 font-semibold text-[#202C26] bn-text">
              {bn ? "এখানে এখনো কিছু নেই" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-sm text-[#59665F] bn-text">
              {bn ? "প্রথম পোস্টটি আপনিই করুন — আপনার সতর্কতা অন্য কাউকে বাঁচাতে পারে।" : "Be the first to post — your warning could protect someone."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visible.map((p) => (
          <PostCard key={p.id} post={p} onChange={updatePost} />
        ))}
      </div>

      {posts !== null && (posts ?? []).length > 0 && visible.length === 0 && (
        <p className="text-center text-sm text-[#8A9B90] bn-text">
          {bn ? "এই খোঁজায় কিছু মেলেনি।" : "No matches for this search."}
        </p>
      )}
    </div>
  );
}
