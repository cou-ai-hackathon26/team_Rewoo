"use client";

// ---------------------------------------------------------------------------
// Judge Demo Mode (V3 §22) — a dedicated, presenter-friendly walkthrough.
// Every preset loads into the REAL verification flow. No credentials, no
// microphone permission, no sensitive information needed. Offline presets
// run deterministically (OFFLINE_DEMO) so the demo survives provider outages.
// ---------------------------------------------------------------------------

import {
  Play,
  Mic,
  MessageSquareText,
  ImageIcon,
  Link2,
  ShieldCheck,
  Clock,
  Eye,
  AlertTriangle,
  Wand2,
  Users,
  BarChart3,
  WifiOff,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "../router";
import { useLang, useBi } from "../i18n";
import { DEMO_PRESETS } from "../demo-presets";

const KIND_ICON = {
  text: <MessageSquareText className="h-5 w-5" aria-hidden />,
  link: <Link2 className="h-5 w-5" aria-hidden />,
  image: <ImageIcon className="h-5 w-5" aria-hidden />,
  audio: <Mic className="h-5 w-5" aria-hidden />,
};

const MODALITY_TAB = {
  voice: "voice",
  message: "message",
  image: "image",
  link: "link",
} as const;

// Presenter run-sheet — the order to walk judges through the product.
const RUN_SHEET = [
  { icon: <Play className="h-4 w-4" aria-hidden />, bn: "১. রাহেলার ঘটনা — ভয়েস ট্রান্সক্রিপ্ট বিশ্লেষণ (উচ্চ ঝুঁকি, পারিবারিক ছদ্মবেশ)", en: "1. Rahela's case — voice transcript analysis (HIGH_RISK, family impersonation)" },
  { icon: <ShieldCheck className="h-4 w-4" aria-hidden />, bn: "২. নিরীহ ওটিপি সতর্কবার্তা — নেতিবাচকতা বোঝা (ঝুঁকির প্রমাণ পাওয়া যায়নি)", en: "2. Benign OTP advisory — negation understanding (NO_RISK_INDICATORS)" },
  { icon: <ImageIcon className="h-4 w-4" aria-hidden />, bn: "৩. ভুয়া বৃত্তির স্ক্রিনশট — আসল OCR নিষ্কাশন ও প্রমাণ", en: "3. Fake scholarship screenshot — real OCR extraction & evidence" },
  { icon: <Link2 className="h-4 w-4" aria-hidden />, bn: "৪. ফিশিং লিংক / কিউআর — কাঠামোগত বিশ্লেষণ, গন্তব্য কখনো খোলা হয় না", en: "4. Phishing link / QR — structural analysis, destination never opened" },
  { icon: <Eye className="h-4 w-4" aria-hidden />, bn: "৫. ফলাফল পাতা — ঝুঁকি → তাৎক্ষণিক পদক্ষেপ → প্রমাণ → Shield Lens → এজেন্ট কার্যক্রম", en: "5. Result page — risk → immediate action → evidence → Shield Lens → agent activity" },
  { icon: <Users className="h-4 w-4" aria-hidden />, bn: "৬. কমিউনিটি — রিপোর্ট জমা → মডারেশন → প্রকাশিত সতর্কতা (অ্যানালিস্ট ডেমো: analyst@banglashield.org / Shield#2025)", en: "6. Community — report → moderation → published alert (analyst demo: analyst@banglashield.org / Shield#2025)" },
];

export default function DemoPage() {
  const bn = useLang() === "bn";
  const bi = useBi();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 md:py-12 space-y-10">
      {/* header */}
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2F5746]">
          <Wand2 className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
              {bn ? "জাজ ডেমো মোড" : "Judge Demo Mode"}
            </h1>
            <Badge variant="outline" className="border-[#8A5B28]/60 text-[#8A5B28]">
              {bn ? "সব সম্পদ কাল্পনিক ও স্পষ্টভাবে চিহ্নিত" : "All assets fictional & clearly labeled"}
            </Badge>
          </div>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text max-w-2xl">
            {bn
              ? "নিচের যেকোনো নমুনা এক ক্লিকে আসল যাচাই-পাইপলাইনে চলে — কোনো অ্যাকাউন্ট, আসল তথ্য বা মাইক্রোফোন অনুমতি ছাড়াই। টেক্সট ও লিংক নমুনাগুলো এআই-প্রদানকারী ছাড়াই নিয়মভিত্তিকভাবে চলে (সিন্থেটিক ডেমো), তাই এআই সেবা বন্ধ থাকলেও প্রদর্শনী কাজ করে; ছবির নমুনা আসল OCR সেবা ব্যবহার করে। সব নমুনাই কাল্পনিক ও লেবেলকৃত।"
              : "Any sample below launches into the REAL verification pipeline in one click — no account, real data, or microphone permission needed. Text and link samples run deterministically without any AI provider (synthetic demo), so the walkthrough survives provider outages; the screenshot sample uses the real OCR service. All samples are fictional and labeled as such."}
          </p>
        </div>
      </div>

      {/* run sheet */}
      <Card className="border-[#2F5746]/30 bg-[#FFFEFA]">
        <CardContent className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#202C26] bn-text">
            <BarChart3 className="h-5 w-5 text-[#2F5746]" aria-hidden />
            {bn ? "প্রেজেন্টারের রান-শিট" : "Presenter run-sheet"}
          </h2>
          <ol className="mt-4 space-y-2.5">
            {RUN_SHEET.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] text-[#59665F] bn-text">
                <span className="mt-0.5 text-[#2F5746]">{step.icon}</span>
                <span>{bn ? step.bn : step.en}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* presets */}
      <section aria-labelledby="demo-presets">
        <h2 id="demo-presets" className="text-2xl font-bold text-[#202C26] bn-text">
          {bn ? "ডেমো নমুনা" : "Demo samples"}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {DEMO_PRESETS.map((p) => (
            <Card key={p.id} className="border-[#D8DED5] bg-[#FFFEFA] flex flex-col overflow-hidden">
              <CardContent className="p-5 flex flex-col h-full gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DDE8DF] text-[#2F5746]">
                      {KIND_ICON[p.kind]}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#202C26] bn-text leading-snug">{bi(p.title)}</h3>
                      <p className="text-[11px] text-[#8A9B90] flex items-center gap-1 mt-0.5">
                        {p.kind === "image" ? (
                          <><Clock className="h-3 w-3" aria-hidden />{bn ? "আসল OCR সেবা" : "Real OCR service"}</>
                        ) : (
                          <><WifiOff className="h-3 w-3" aria-hidden />{bn ? "এআই ছাড়া নিয়মভিত্তিক ডেমো" : "Rule-based demo (no AI)"}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#59665F] leading-relaxed bn-text flex-1">{bi(p.description)}</p>
                <div className="rounded-xl bg-[#F2E8D5]/50 border border-[#8A5B28]/25 px-3.5 py-2.5">
                  <p className="text-xs font-bold text-[#8A5B28] bn-text mb-0.5">{bn ? "কী দেখাবে:" : "Watch for:"}</p>
                  <p className="text-xs text-[#59665F] leading-relaxed bn-text">{bi(p.watchFor)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.audioSrc && (
                    <audio controls src={p.audioSrc} className="h-9 flex-1 min-w-0" aria-label={bn ? "নমুনা কণ্ঠ শুনুন" : "Listen to the sample"} />
                  )}
                  <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] gap-2 font-bold">
                    <Link to={`/check/${MODALITY_TAB[p.modality]}?demo=${p.id}`} className="shrink-0">
                      <Play className="h-4 w-4" aria-hidden />
                      {bn ? "চালান" : "Run"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* offline resilience note */}
      <Card className="border-dashed-2 border-[#8A5B28]/50 bg-[#F2E8D5]/40">
        <CardContent className="p-5 md:p-6">
          <h3 className="flex items-center gap-2 font-bold text-[#8A5B28] bn-text">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            {bn ? "সংযোগ বা সেবা ব্যর্থ হলে" : "If connectivity or a service fails"}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-[#59665F] leading-relaxed bn-text">
            <li>
              {bn
                ? "টেক্সট ও লিংক নমুনা এআই প্রদানকারীর প্রয়োজন ছাড়াই নিয়মভিত্তিকভাবে চলে — তবে সার্ভার-এপিআই লাগেই; ফলাফল “সিন্থেটিক ডেমো / নিয়মভিত্তিক” হিসেবে সৎভাবে চিহ্নিত হয়। এগুলো নেটওয়ার্ক-বিচ্ছিন্ন ব্যবহারের প্রমাণ নয়।"
                : "Text and link samples run deterministically WITHOUT any AI provider — but the server API is still required; results are honestly labeled \"synthetic demo / rule-based\". They are not proof of network-independent use."}
            </li>
            <li>
              {bn
                ? "ছবির OCR ব্যর্থ হলে অ্যাপ নিজেই হাতে লেখার বিকল্প দেখায় — সৎ ব্যর্থতা বার্তাসহ, কখনো বানানো ফলাফল নয়।"
                : "If OCR fails, the app offers manual text entry with an honest failure message — never a fabricated result."}
            </li>
            <li>
              {bn
                ? "লাইভ এআই ব্যর্থ হলে পাইপলাইন সীমিত সময়ের টাইমআউট ও পুনঃচেষ্টার পর নিয়মভিত্তিক ফলব্যাকে যায় — এজেন্ট কার্যক্রম প্যানেলে প্রকৃত ঘটনাগুলো দেখা যায়।"
                : "If the live AI fails, the pipeline times out, retries once, then falls back to rule-based — the agent activity panel shows the genuine events."}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to="/check" className="group rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-5 hover:border-[#2F5746]/50 transition-all focus-ring">
          <p className="font-bold text-[#202C26] bn-text flex items-center gap-2">
            {bn ? "নিজে যাচাই করুন" : "Verify your own"}
            <ArrowRight className="h-4 w-4 text-[#2F5746] transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
          <p className="mt-1 text-sm text-[#59665F] bn-text">{bn ? "মাইক, মেসেজ, ছবি বা লিংক" : "Mic, message, image or link"}</p>
        </Link>
        <Link to="/community" className="group rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-5 hover:border-[#2F5746]/50 transition-all focus-ring">
          <p className="font-bold text-[#202C26] bn-text flex items-center gap-2">
            {bn ? "কমিউনিটি ও মডারেশন" : "Community & moderation"}
            <ArrowRight className="h-4 w-4 text-[#2F5746] transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
          <p className="mt-1 text-sm text-[#59665F] bn-text">{bn ? "রিপোর্ট লাইফসাইকেল দেখুন" : "See the report lifecycle"}</p>
        </Link>
        <Link to="/learn" className="group rounded-2xl border-2 border-[#D8DED5] bg-[#FFFEFA] p-5 hover:border-[#2F5746]/50 transition-all focus-ring">
          <p className="font-bold text-[#202C26] bn-text flex items-center gap-2">
            {bn ? "স্ক্যামএকাডেমি" : "ScamAcademy"}
            <ArrowRight className="h-4 w-4 text-[#2F5746] transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
          <p className="mt-1 text-sm text-[#59665F] bn-text">{bn ? "১২টি ইন্টারঅ্যাক্টিভ পাঠ" : "12 interactive lessons"}</p>
        </Link>
      </div>
    </div>
  );
}
