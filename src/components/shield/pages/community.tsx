"use client";

// Community — the Facebook-inspired citizen hub:
//   Feed (posts with AI notices) · Help board · Reports & published alerts
//   (official portals) · My dashboard (post + report tracking).
// Guests can browse everything; members post, comment, mark helpful.

import { useEffect, useState } from "react";
import {
  Users,
  Megaphone,
  Flag,
  BadgeCheck,
  EyeOff,
  ShieldCheck,
  Clock,
  Search,
  HandHeart,
  LayoutDashboard,
  ExternalLink,
  PhoneCall,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang, useBi } from "../i18n";
import { Link, useHashRoute } from "../router";
import { InfoNote } from "../ui-bits";
import { SCAM_CATEGORIES } from "@/lib/types";
import ReportPage from "./report";
import { CommunityFeed } from "./community-feed";
import { MyDashboard } from "./community-mine";

// ---------------------------------------------------------------------------
// Published alerts (human-reviewed) — from the analyst-approved report feed
// ---------------------------------------------------------------------------

interface CommunityAlert {
  id: string;
  category: string;
  title: string;
  body: string;
  synthetic: boolean;
  publishedAt: string | null;
}

function AlertsFeed() {
  const bn = useLang() === "bn";
  const [alerts, setAlerts] = useState<CommunityAlert[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/community/alerts?limit=30")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setAlerts(d.alerts ?? []);
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setAlerts([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (alerts === null) {
    return (
      <div className="grid gap-4" aria-busy>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-[#EDEAE1] animate-pulse" />
        ))}
      </div>
    );
  }

  const visible = alerts.filter(
    (a) =>
      !filter.trim() ||
      a.title.toLowerCase().includes(filter.toLowerCase()) ||
      a.body.toLowerCase().includes(filter.toLowerCase()) ||
      (SCAM_CATEGORIES[a.category]?.[bn ? "bn" : "en"] ?? a.category).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={bn ? "সতর্কতায় খুঁজুন (যেমন: ওটিপি, বৃত্তি)…" : "Search alerts (e.g. OTP, scholarship)…"}
          className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
          aria-label={bn ? "সতর্কতা অনুসন্ধান" : "Search alerts"}
        />
      </div>

      {error && (
        <InfoNote title={bn ? "সতর্কতা লোড হয়নি" : "Alerts failed to load"}>
          {bn ? "নেটওয়ার্ক সমস্যায় সতর্কতাগুলো আনা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।" : "A network issue prevented loading. Please retry shortly."}
        </InfoNote>
      )}

      {visible.length === 0 && !error && (
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-8 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-[#8A9B90]" aria-hidden />
            <p className="mt-3 font-semibold text-[#202C26] bn-text">
              {bn ? "এখনো কোনো প্রকাশিত সতর্কতা নেই" : "No published alerts yet"}
            </p>
            <p className="mt-1 text-sm text-[#59665F] bn-text">
              {bn
                ? "মানব-রিভিউ হওয়ার পরেই রিপোর্ট প্রকাশিত হয় — নিচের ফর্ম থেকে আপনিও রিপোর্ট করতে পারেন।"
                : "Reports publish only after human review — you can submit one below."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {visible.map((a) => {
          const cat = SCAM_CATEGORIES[a.category];
          return (
            <Card key={a.id} className="border-[#D8DED5] bg-[#FFFEFA]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4E1DA] text-[#A44435]">
                      <Megaphone className="h-4.5 w-4.5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-bold text-[#202C26] bn-text leading-snug">{a.title}</p>
                      <p className="text-xs text-[#8A9B90] flex items-center gap-1.5">
                        <Clock className="h-3 w-3" aria-hidden />
                        {a.publishedAt
                          ? new Date(a.publishedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {cat && (
                      <Badge variant="outline" className="border-[#2F5746]/40 text-[#2F5746] bn-text text-[11px]">
                        {cat[bn ? "bn" : "en"]}
                      </Badge>
                    )}
                    {a.synthetic && (
                      <Badge variant="outline" className="border-[#8A5B28]/50 text-[#8A5B28] text-[11px]">
                        {bn ? "ডেমো ডেটা" : "Demo data"}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[15px] text-[#59665F] leading-relaxed bn-text">{a.body}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-[#7D9C8B]">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  {bn
                    ? "মানব-মডারেটর যাচাই করেছেন · ব্যক্তিগত তথ্য থেকে মুক্ত"
                    : "Human-moderated · free of personal data"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Official portals strip (task: direct connection to official reporting)
// ---------------------------------------------------------------------------

const PORTALS = [
  {
    name: { bn: "বাংলাদেশ পুলিশ — ৯৯৯", en: "Bangladesh Police — 999" },
    desc: {
      bn: "জরুরি প্রয়োজনে সরাসরি ৯৯৯-এ কল করুন (ফ্রি, সারাদিন)।",
      en: "Call 999 directly in emergencies (free, 24/7).",
    },
    href: "tel:999",
    phone: true,
  },
  {
    name: { bn: "সাইবার ট্রাইব্যুনাল / পুলিশ সাইবার সাপোর্ট", en: "Cyber Tribunal / Police cyber support" },
    desc: {
      bn: "অনলাইন প্রতারণার লিখিত অভিযোগ police.gov.bd-তে।",
      en: "File written cyber-fraud complaints at police.gov.bd.",
    },
    href: "https://www.police.gov.bd/",
    phone: false,
  },
  {
    name: { bn: "বিজিডি ই-গভ সিআইআরটি", en: "BGD e-GOV CIRT" },
    desc: {
      bn: "ফিশিং লিংক বা সাইবার ঘটনা জানান cirt.gov.bd-তে।",
      en: "Report phishing links and cyber incidents at cirt.gov.bd.",
    },
    href: "https://www.cirt.gov.bd/",
    phone: false,
  },
];

function OfficialPortals() {
  const bn = useLang() === "bn";
  const bi = useBi();
  return (
    <section aria-labelledby="portals-h">
      <h3 id="portals-h" className="flex items-center gap-2 text-lg font-bold text-[#202C26] mb-1 bn-text">
        <Landmark className="h-5 w-5 text-[#2F5746]" aria-hidden />
        {bn ? "সরকারি পোর্টালে সরাসরি জানান" : "Report directly through official portals"}
      </h3>
      <p className="text-sm text-[#59665F] mb-3 bn-text">
        {bn
          ? "বাংলাশিল্ড সচেতনতা-সহায়তা দেয় — আইনি প্রতিকার চাইলে নিচের সরকারি চ্যানেলেই অভিযোগ করুন।"
          : "BanglaShield provides awareness support — for legal remedy, file through these government channels."}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {PORTALS.map((p) => (
          <a
            key={p.href}
            href={p.href}
            target={p.phone ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="group rounded-xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-4 transition-all hover:border-[#2F5746]/50 focus-ring"
          >
            <span className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
              {p.phone ? (
                <PhoneCall className="h-4.5 w-4.5 text-[#A44435]" aria-hidden />
              ) : (
                <ExternalLink className="h-4 w-4 text-[#2F5746]" aria-hidden />
              )}
              {bi(p.name)}
            </span>
            <span className="mt-1.5 block text-sm text-[#59665F] leading-relaxed bn-text">{bi(p.desc)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TAB_KEYS = ["feed", "help", "reports", "mine"] as const;

export default function CommunityPage() {
  const bn = useLang() === "bn";
  const { path } = useHashRoute();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.split("?")[1] ?? "") : null;
  const reportCase = params?.get("report") ?? params?.get("case") ?? "";
  const tabParam = params?.get("tab") ?? "";
  const initialTab = (TAB_KEYS as readonly string[]).includes(tabParam)
    ? tabParam
    : reportCase
      ? "reports"
      : "feed";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {/* header */}
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2F5746]">
          <Users className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "কমিউনিটি" : "Community"}
          </h1>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "একসাথে সাবধান হই — সদস্যদের সতর্কতা, সাহায্যের বোর্ড ও যাচাইকৃত অভিযোগ এক জায়গায়। পড়তে কেউ নিবন্ধন লাগে না; পোস্ট ও মন্তব্যের জন্য একটি সদস্য আইডি নিন।"
              : "Stay alert together — member alerts, a help board and reviewed reports in one place. Reading needs no account; posting needs a free member ID."}
          </p>
        </div>
      </div>

      {/* community hero image */}
      <div className="rounded-2xl overflow-hidden border border-[#D8DED5]">
        { }
        <img
          src="/img/community-hero.png"
          alt={bn
            ? "একত্রিত মানুষজন একসাথে ফোনে কী দেখছে তা পরীক্ষা করছে — কমিউনিটির ভাবমূর্তি"
            : "People gathered checking something on a phone together — the spirit of community"}
          className="w-full h-40 sm:h-52 object-cover"
          loading="lazy"
        />
      </div>

      {/* trust strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#D8DED5] bg-[#DDE8DF]/40 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm text-[#2F5746] font-semibold bn-text">
          <EyeOff className="h-4 w-4" aria-hidden />
          {bn ? "ন্যূনতম তথ্য (নাম ছাড়া কিছুই নয়)" : "Minimal data (no phone, no email)"}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#2F5746] font-semibold bn-text">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {bn ? "প্রতিটি পোস্টে এআই নোটিশ + মডারেশন" : "AI notice + moderation on every post"}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#2F5746] font-semibold bn-text">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {bn ? "সতর্কতা প্রকাশে মানব-রিভিউ বাধ্যতামূলক" : "Nothing publishes without human review"}
        </span>
      </div>

      <Tabs defaultValue={initialTab} key={initialTab} className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4 bg-[#EDEAE1] p-1.5 rounded-xl">
          {(
            [
              { v: "feed", icon: <Megaphone className="h-4 w-4" aria-hidden />, bn: "ফিড", en: "Feed" },
              { v: "help", icon: <HandHeart className="h-4 w-4" aria-hidden />, bn: "সাহায্য বোর্ড", en: "Help board" },
              { v: "reports", icon: <Flag className="h-4 w-4" aria-hidden />, bn: "রিপোর্ট ও সতর্কতা", en: "Reports & alerts" },
              { v: "mine", icon: <LayoutDashboard className="h-4 w-4" aria-hidden />, bn: "আমার ড্যাশবোর্ড", en: "My dashboard" },
            ] as const
          ).map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-lg py-2.5 px-2 text-[13px] sm:text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
            >
              {t.icon}
              {bn ? t.bn : t.en}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="feed">
          <CommunityFeed />
        </TabsContent>

        <TabsContent value="help" className="space-y-5">
          <InfoNote title={bn ? "সাহায্য কীভাবে কাজ করে" : "How the help board works"}>
            {bn
              ? "আপনার ঘটনা লিখে পোস্ট করুন — শিল্ডএজেন্ট সাথে সাথে একটি লেবেলকৃত প্রাথমিক নিরাপত্তা-উত্তর দেবে, এরপর কমিউনিটির সদস্যরা নিজেদের অভিজ্ঞতা দিয়ে সাহায্য করবেন। জরুরি বিপদে বক্সটি দেখুন।"
              : "Post what happened — ShieldAgent replies immediately with a labeled initial safety response, then members help with their experience. For urgent danger see the box below."}
          </InfoNote>
          <div className="rounded-xl border-2 border-[#A44435]/40 bg-[#F4E1DA]/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#A44435] font-semibold bn-text">
              {bn
                ? "এখনই টাকা গেছে বা কোড দিয়ে ফেলেছেন? — জরুরি ধাপগুলো আগে দেখুন।"
                : "Already lost money or shared a code? — See the emergency steps first."}
            </p>
            <Button asChild className="bg-[#A44435] text-[#FFFEFA] hover:bg-[#8C382B] h-11 font-bold rounded-xl">
              <Link to="/help">{bn ? "জরুরি সহায়তা" : "Emergency help"}</Link>
            </Button>
          </div>
          <CommunityFeed forcedKind="help" />
        </TabsContent>

        <TabsContent value="reports" className="space-y-8">
          <ReportPage initialCase={reportCase} embedded />
          <div>
            <h3 className="text-lg font-bold text-[#202C26] mb-3 bn-text">
              {bn ? "প্রকাশিত সতর্কতা (মানব-রিভিউকৃত)" : "Published alerts (human-reviewed)"}
            </h3>
            <AlertsFeed />
          </div>
          <OfficialPortals />
        </TabsContent>

        <TabsContent value="mine">
          <MyDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
