"use client";

import { useEffect, useState } from "react";
import {
  PhoneCall,
  ExternalLink,
  CheckCircle2,
  Loader2,
  LifeBuoy,
  BookOpen,
  Flag,
  Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "../api";
import { useLang } from "../i18n";
import { Link } from "../router";
import { InfoNote } from "../ui-bits";

interface Resource {
  key: string;
  name: { bn: string; en: string };
  category: string;
  description: { bn: string; en: string };
  guidance: { bn: string; en: string };
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: string;
}

const CATEGORY_LABELS: Record<string, { bn: string; en: string }> = {
  mfs: { bn: "মোবাইল ফাইন্যান্সিয়াল সার্ভিস", en: "Mobile financial services" },
  bank: { bn: "ব্যাংক", en: "Banks" },
  regulator: { bn: "নিয়ন্ত্রক সংস্থা", en: "Regulators" },
  police: { bn: "আইনশৃঙ্খলা", en: "Law enforcement" },
  cert: { bn: "সাইবার নিরাপত্তা দল", en: "Cyber security team" },
  helpline: { bn: "হেল্পলাইন", en: "Helplines" },
};

export default function HelpPage() {
  const bn = useLang() === "bn";
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ resources: Resource[] }>("/api/v1/resources")
      .then((r) => setResources(r.resources))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-12 space-y-10">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2F5746]">
          <LifeBuoy className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "যাচাইকৃত সহায়তা ডিরেক্টরি" : "Verified help directory"}
          </h1>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "এই যোগাযোগগুলো প্রতিষ্ঠানের নিজস্ব অফিসিয়াল পাতা থেকে সংগৃহীত। প্রতিটির সাথে যাচাইয়ের তারিখ ও উৎস দেওয়া আছে।"
              : "These contacts come from each institution's own official pages. Every entry shows its verification date and source."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[#59665F]" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {bn ? "লোড হচ্ছে…" : "Loading…"}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="text-xl font-bold text-[#202C26] mb-3 bn-text">
              {CATEGORY_LABELS[cat]?.[bn ? "bn" : "en"] ?? cat}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((r) => (
                <Card key={r.key} className="border-[#D8DED5] bg-[#FFFEFA]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[#202C26] bn-text">{r.name[bn ? "bn" : "en"]}</p>
                      <CheckCircle2 className="h-4 w-4 text-[#2F5746] shrink-0" aria-label={bn ? "যাচাইকৃত" : "Verified"} />
                    </div>
                    <p className="mt-1.5 text-sm text-[#59665F] leading-relaxed bn-text">{r.description[bn ? "bn" : "en"]}</p>
                    <p className="mt-2 text-sm text-[#2F5746] leading-relaxed bn-text">{r.guidance[bn ? "bn" : "en"]}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F5746] px-3 py-1.5 text-sm font-bold text-[#FFFEFA] hover:bg-[#24453A] focus-ring"
                        >
                          <PhoneCall className="h-3.5 w-3.5" aria-hidden /> {r.phone}
                        </a>
                      )}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8DED5] px-3 py-1.5 text-sm font-semibold text-[#2F5746] hover:bg-[#DDE8DF] focus-ring"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {bn ? "অফিসিয়াল সাইট" : "Official site"}
                      </a>
                    </div>
                    <p className="mt-2.5 text-[11px] text-[#7D9C8B] break-all">
                      {bn ? "উৎস:" : "Source:"} {r.sourceUrl} · {bn ? "যাচাই:" : "Verified:"}{" "}
                      {new Date(r.verifiedAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <InfoNote title={bn ? "কী করবেন বুঝতে অসুবিধা হলে" : "If you are unsure what to do"}>
        {bn ? (
          <>
            সন্দেহজনক কিছু পেলে <Link to="/check" className="font-bold text-[#2F5746] underline">যাচাই করুন</Link> · ক্ষতি হয়ে গেলে{" "}
            <Link to="/recovery" className="font-bold text-[#2F5746] underline">জরুরি সহায়তা</Link> দেখুন · শিখতে{" "}
            <Link to="/learn" className="font-bold text-[#2F5746] underline">স্ক্যামএকাডেমি</Link> পড়ুন।
          </>
        ) : (
          <>
            Received something suspicious? <Link to="/check" className="font-bold text-[#2F5746] underline">Verify it</Link> · Already harmed? See{" "}
            <Link to="/recovery" className="font-bold text-[#2F5746] underline">Emergency guidance</Link> · Learn at{" "}
            <Link to="/learn" className="font-bold text-[#2F5746] underline">ScamAcademy</Link>.
          </>
        )}
      </InfoNote>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/check" className="rounded-2xl focus-ring">
          <Card className="h-full border-[#D8DED5] bg-[#FFFEFA] hover:border-[#2F5746]/50 transition-colors">
            <CardContent className="p-5 text-center">
              <LifeBuoy className="mx-auto h-7 w-7 text-[#2F5746]" aria-hidden />
              <p className="mt-2 font-bold text-[#202C26] bn-text">{bn ? "যাচাই করুন" : "Verify content"}</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/learn" className="rounded-2xl focus-ring">
          <Card className="h-full border-[#D8DED5] bg-[#FFFEFA] hover:border-[#2F5746]/50 transition-colors">
            <CardContent className="p-5 text-center">
              <BookOpen className="mx-auto h-7 w-7 text-[#2F5746]" aria-hidden />
              <p className="mt-2 font-bold text-[#202C26] bn-text">{bn ? "শিখুন" : "Learn"}</p>
            </CardContent>
          </Card>
        </Link>
        <a href="tel:999" className="rounded-2xl focus-ring">
          <Card className="h-full border-2 border-[#A44435] bg-[#FFFEFA] hover:bg-[#F4E1DA] transition-colors">
            <CardContent className="p-5 text-center">
              <Siren className="mx-auto h-7 w-7 text-[#A44435]" aria-hidden />
              <p className="mt-2 font-bold text-[#8C382B]">৯৯৯ {bn ? "জরুরি" : "Emergency"}</p>
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
}
