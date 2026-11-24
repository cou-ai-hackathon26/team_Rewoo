"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Languages,
  Type,
  Accessibility,
  Volume2,
  Wifi,
  Database,
  Trash2,
  Loader2,
  EyeOff,
  Lock,
  AlertTriangle,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, ShieldApiError } from "../api";
import { useLang, useT } from "../i18n";
import { Link } from "../router";
import { useSettings } from "../store";
import { RiskBadge, InfoNote } from "../ui-bits";
import { SCAM_CATEGORIES } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SessionSummary {
  id: string;
  modality: string;
  status: string;
  riskCategory: "high" | "uncertain" | "none" | null;
  scamCategory: string | null;
  engine: string | null;
  createdAt: string;
  hasReport: boolean;
  reportStatus: string | null;
}

export default function PrivacyPage({ tab }: { tab: string }) {
  const bn = useLang() === "bn";
  const t = useT();
  const [view, setView] = useState<"settings" | "data">(tab === "privacy" ? "data" : "settings");
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: SessionSummary[] }>("/api/v1/analyses");
      setSessions(res.sessions);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "data") loadSessions();
  }, [view, loadSessions]);

  const deleteSession = async (id: string) => {
    try {
      await api.del(`/api/v1/analyses/${id}`);
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
      loadSessions();
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 md:py-12 space-y-8">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2F5746]">
          <ShieldCheck className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "গোপনীয়তা ও সেটিংস কেন্দ্র" : "Privacy & Settings"}
          </h1>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "ভাষা, সহজলভ্যতা ও আপনার তথ্যের নিয়ন্ত্রণ — সব এক জায়গায়।"
              : "Language, accessibility, and control over your data — all in one place."}
          </p>
        </div>
      </div>

      {/* view switch */}
      <div className="inline-flex rounded-xl border border-[#D8DED5] bg-[#EDEAE1] p-1" role="tablist">
        {(
          [
            ["data", bn ? "আমার তথ্য ও গোপনীয়তা" : "My data & privacy"],
            ["settings", bn ? "সেটিংস" : "Settings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={
              view === key
                ? "rounded-lg bg-[#FFFEFA] px-4 py-2 text-sm font-bold text-[#2F5746] shadow-sm bn-text"
                : "rounded-lg px-4 py-2 text-sm font-medium text-[#59665F] bn-text hover:text-[#202C26]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === "settings" ? (
        <SettingsPanel />
      ) : (
        <>
          {/* privacy promises */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: <EyeOff className="h-5 w-5" aria-hidden />,
                title: bn ? "কী জমা হয় না" : "What is never stored",
                body: bn
                  ? "কাঁচা অডিও নয়, ছবি নয়, আপনার নাম-নম্বর নয়। ওটিপি/পিন বার্তা পাঠানোর আগেই মুছে যায়। ফোন কল কখনোই রেকর্ড বা আড়শোনা হয় না।"
                  : "No raw audio, no images, no name or number. OTPs/PINs are stripped before submission. Calls are never recorded or intercepted.",
              },
              {
                icon: <Lock className="h-5 w-5" aria-hidden />,
                title: bn ? "কে দেখতে পারে" : "Who can see it",
                body: bn
                  ? "ফলাফল শুধু সেই ব্রাউজার-সেশনেই দেখা যায় যেখান থেকে কেসটি তৈরি হয়েছিল — সার্ভার-স্বাক্ষরিত সেশন দিয়ে সুরক্ষিত। শুধু কেস আইডি জানা কারো পক্ষে যথেষ্ট নয়। অ্যানালিস্টরা শুধু আড়ালকৃত রিপোর্ট দেখেন — আপনার পরিচয়সহ কিছু নয়।"
                  : "Results are visible only in the browser session that created the case, protected by a server-signed session. Knowing the case ID alone is not enough. Analysts see only redacted reports — never your identity.",
              },
            ].map((c) => (
              <Card key={c.title} className="border-[#D8DED5] bg-[#FFFEFA]">
                <CardContent className="p-5">
                  <p className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
                    <span className="text-[#2F5746]">{c.icon}</span> {c.title}
                  </p>
                  <p className="mt-2 text-sm text-[#59665F] leading-relaxed bn-text">{c.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* how information flows — tracking transparency (no background monitoring) */}
          <Card className="border-[#D8DED5] bg-[#FFFEFA]">
            <CardContent className="p-5 md:p-6 space-y-4">
              <div>
                <p className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
                  <Radio className="h-5 w-5 text-[#2F5746]" aria-hidden />
                  {bn ? "আপনার তথ্য কীভাবে চলে — স্বচ্ছ হিসাব" : "How your information flows — the transparent ledger"}
                </p>
                <p className="mt-1.5 text-sm text-[#59665F] leading-relaxed bn-text">
                  {bn
                    ? "সবচেয়ে গুরুত্বপূর্ণ কথাটা আগে: বাংলাশিল্ড আপনার ফোনের কল, এসএমএস বা অ্যাপ কোনোভাবেই স্বয়ংক্রিয়ভাবে পড়ে না, রেকর্ড করে না, ট্র্যাক করে না। যা হয় — তা কেবল আপনি নিজে থেকে শেয়ার করলে, সম্মতির পরে।"
                    : "The most important fact first: BanglaShield never automatically reads, records, or tracks your calls, SMS, or apps. Processing happens only when you choose to share something — after consent."}
                </p>
              </div>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8DED5]">
                      <th scope="col" className="py-2 pr-3 text-left font-bold text-[#202C26] bn-text">{bn ? "আপনি যা দেন" : "What you give"}</th>
                      <th scope="col" className="py-2 pr-3 text-left font-bold text-[#202C26] bn-text">{bn ? "কী হয়" : "What happens"}</th>
                      <th scope="col" className="py-2 text-left font-bold text-[#202C26] bn-text">{bn ? "কী জমা থাকে" : "What is kept"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#59665F]">
                    {[
                      {
                        k: bn ? "ভয়েস (মাইক/আপলোড)" : "Voice (mic/upload)",
                        p: bn ? "কথা লেখায় রূপান্তর হয় (স্বয়ংক্রিয় STT), তারপর লেখাটি বিশ্লেষণ হয়" : "Speech is transcribed (automatic STT), then the text is analyzed",
                        s: bn ? "শুধু আড়ালকৃত লেখা — কাঁচা অডিও নয়" : "Only the redacted text — never the raw audio",
                      },
                      {
                        k: bn ? "মেসেজ (পেস্ট করা)" : "Message (pasted)",
                        p: bn ? "ওটিপি/পিন/নম্বর স্বয়ংক্রিয়ভাবে আড়াল হয়, তারপর বিশ্লেষণ" : "OTPs/PINs/numbers are auto-redacted, then analyzed",
                        s: bn ? "আড়ালকৃত লেখা + ফলাফল" : "Redacted text + result",
                      },
                      {
                        k: bn ? "স্ক্রিনশট (আপলোড)" : "Screenshot (upload)",
                        p: bn ? "ছবি থেকে লেখা বের হয় (OCR) — ছবিটি বাদ দিয়ে লেখাটি আপনি দেখেন ও সম্পাদনা করেন" : "Text is extracted (OCR) — you review and edit it; the image is discarded",
                        s: bn ? "শুধু আড়ালকৃত লেখা — ছবি নয়" : "Only the redacted text — never the image",
                      },
                      {
                        k: bn ? "লিংক / কিউআর" : "Link / QR",
                        p: bn ? "লিংক কখনোই খোলা হয় না — শুধু ঠিকানার গঠন পরীক্ষা হয় (ফোনেই কিউআর ডিকোড)" : "The link is never opened — only the address structure is checked (QR decoded on your phone)",
                        s: bn ? "ঠিকানার মূল্যায়ন — ভিজিট নয়" : "The address assessment — no visit",
                      },
                    ].map((row) => (
                      <tr key={row.k} className="border-b border-[#EDEAE1] align-top">
                        <td className="py-2.5 pr-3 font-semibold text-[#202C26] bn-text">{row.k}</td>
                        <td className="py-2.5 pr-3 bn-text">{row.p}</td>
                        <td className="py-2.5 bn-text">{row.s}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <p className="rounded-xl border border-[#8A5B28]/40 bg-[#F2E8D5]/50 px-4 py-3 text-sm text-[#8A5B28] bn-text">
                  {bn
                    ? "সংরক্ষণ (কার্যকর): কেসের আড়ালকৃত লেখা, ফলাফল ও প্রমাণ ৭ দিন পরে স্বয়ংক্রিয়ভাবে মুছে যায় — এটি পড়ার সময়েই কার্যকর হয়, শুধু নীতি-কথা নয়। আপনি যেকোনো সময় নিজেই মুছে ফেলতে পারেন (নিচের তালিকা)। রিপোর্ট দিলে তা বেনামে থাকে।"
                    : "Retention (enforced): a case's redacted text, result and evidence auto-delete after 7 days — enforced on read, not just policy text. You can delete anytime yourself (list below). Reports stay anonymous."}
                </p>
                <p className="rounded-xl border border-[#8A5B28]/40 bg-[#F2E8D5]/50 px-4 py-3 text-sm text-[#8A5B28] bn-text">
                  {bn
                    ? "তৃতীয় পক্ষের প্রক্রিয়াকরণ: বিশ্লেষণের জন্য আড়ালকৃত লেখা এআই প্রদানকারীর কাছে যায়। ভয়েস বা ছবির ক্ষেত্রে লেখা বের করতে কাঁচা অডিও/ছবি সাময়িকভাবে প্রদানকারীর কাছে পাঠানো হয় — আমাদের ডেটাবেসে কখনোই সংরক্ষণ করা হয় না, প্রদানকারীর আচরণ তাদের নীতির অধীন। কমিউনিটিতে আপনি যদি নিজে ছবি যোগ করেন, সেটি আলাদা পথে আপনার সম্মতিতেই সংরক্ষিত হয়।"
                    : "Third-party processing: redacted text goes to AI providers for analysis. For voice and images, the raw audio/image is sent transiently to the extraction provider — never stored in our database; provider handling follows their policies. Images you deliberately attach to community posts are stored separately, with your consent."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* my sessions */}
          <Card className="border-[#D8DED5] bg-[#FFFEFA]">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="flex items-center gap-2 font-bold text-[#202C26] bn-text">
                  <Database className="h-5 w-5 text-[#2F5746]" aria-hidden />
                  {bn ? "আমার যাচাই-কেসগুলো" : "My verification cases"}
                </p>
                <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading} className="border-[#D8DED5] text-[#59665F] gap-1.5">
                  <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
                  {bn ? "রিফ্রেশ" : "Refresh"}
                </Button>
              </div>

              {loading && sessions === null ? (
                <p className="flex items-center gap-2 text-sm text-[#59665F]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("common.loading")}
                </p>
              ) : !sessions || sessions.length === 0 ? (
                <p className="text-sm text-[#59665F] bn-text">
                  {bn
                    ? "এখনো কোনো কেস নেই। যাচাই করলে এখানে তালিকা আসবে।"
                    : "No cases yet. Your verifications will be listed here."}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto scroll-soft pr-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#D8DED5] bg-[#F4F1EB]/50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#202C26] truncate">{s.id}</p>
                        <p className="text-xs text-[#59665F] bn-text">
                          {new Date(s.createdAt).toLocaleString(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                          {s.modality === "voice"
                            ? bn ? "ভয়েস" : "voice"
                            : s.modality === "image"
                              ? bn ? "ছবি" : "image"
                              : s.modality === "link"
                                ? bn ? "লিংক" : "link"
                                : bn ? "মেসেজ" : "message"}
                          {s.scamCategory && ` · ${SCAM_CATEGORIES[s.scamCategory]?.[bn ? "bn" : "en"] ?? s.scamCategory}`}
                        </p>
                        {s.riskCategory && <span className="mt-1 inline-block"><RiskBadge risk={s.riskCategory} size="sm" /></span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm" className="border-[#D8DED5] text-[#2F5746] h-8">
                          <Link to={`/analysis/${s.id}`}>{bn ? "দেখুন" : "View"}</Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 border-[#A44435]/40 text-[#A44435] hover:bg-[#F4E1DA]" aria-label={bn ? "মুছুন" : "Delete"}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#FFFEFA] border-[#D8DED5]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="bn-text">{bn ? "কেস মুছবেন?" : "Delete this case?"}</AlertDialogTitle>
                              <AlertDialogDescription className="bn-text">
                                {bn
                                  ? `${s.id} — ফলাফল ও সংরক্ষিত লেখা স্থায়ীভাবে মুছে যাবে।`
                                  : `${s.id} — the result and stored text will be permanently removed.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bn-text">{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSession(s.id)}
                                className="bg-[#A44435] text-[#FFFEFA] hover:bg-[#8C382B]"
                              >
                                {bn ? "মুছে দিন" : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <InfoNote title={bn ? "সংরক্ষণের নীতি" : "Retention policy"}>
            {bn
              ? "নিয়মিত পরিচ্ছন্নতা-চক্রে পুরোনো কেস স্বয়ংক্রিয়ভাবে মুছে যায়। আগে মুছতে চাইলে উপরের তালিকা থেকে যেকোনো সময় পারেন। রিপোর্ট (RPT-…) আলাদাভাবে রেফারেন্স আইডি দিয়ে প্রত্যাহার করা যায়।"
              : "Old cases are removed automatically in regular cleanup cycles. You can delete sooner from the list above. Community reports (RPT-…) are withdrawn separately via their reference ID."}
          </InfoNote>
        </>
      )}
    </div>
  );
}

function SettingsPanel() {
  const bn = useLang() === "bn";
  const settings = useSettings();

  const rows: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    control: React.ReactNode;
  }[] = [
    {
      icon: <Languages className="h-5 w-5" aria-hidden />,
      title: bn ? "ভাষা" : "Language",
      desc: bn ? "পুরো অ্যাপ বাংলা বা ইংরেজিতে" : "The whole app in Bangla or English",
      control: (
        <div className="inline-flex rounded-lg border border-[#D8DED5] overflow-hidden" role="group" aria-label={bn ? "ভাষা" : "Language"}>
          {(["bn", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => settings.setLang(l)}
              aria-pressed={settings.lang === l}
              className={
                settings.lang === l
                  ? "bg-[#2F5746] px-4 py-1.5 text-sm font-bold text-[#FFFEFA]"
                  : "px-4 py-1.5 text-sm font-medium text-[#59665F] hover:bg-[#F4F1EB]"
              }
            >
              {l === "bn" ? "বাংলা" : "English"}
            </button>
          ))}
        </div>
      ),
    },
    {
      icon: <Type className="h-5 w-5" aria-hidden />,
      title: bn ? "বড় লেখা" : "Large text",
      desc: bn ? "চোখের সুবিধার জন্য সব লেখা বড় হবে" : "Enlarges all text for easier reading",
      control: <Switch checked={settings.largeText} onCheckedChange={settings.setLargeText} aria-label={bn ? "বড় লেখা" : "Large text"} />,
    },
    {
      icon: <Accessibility className="h-5 w-5" aria-hidden />,
      title: bn ? "কম নড়াচড়া" : "Reduced motion",
      desc: bn ? "অ্যানিমেশন বন্ধ হবে (মাথা ঘোরার সমস্যায় সহায়ক)" : "Disables animations (helps motion sensitivity)",
      control: <Switch checked={settings.reduceMotion} onCheckedChange={settings.setReduceMotion} aria-label={bn ? "কম নড়াচড়া" : "Reduced motion"} />,
    },
    {
      icon: <Volume2 className="h-5 w-5" aria-hidden />,
      title: bn ? "ধ্বনি নির্দেশনা (পরীক্ষামূলক)" : "Voice narration (experimental)",
      desc: bn ? "ফলাফল ও Shield Lens পড়ে শোনানো হবে" : "Results and Shield Lens are read aloud",
      control: <Switch checked={settings.narration} onCheckedChange={settings.setNarration} aria-label={bn ? "ধ্বনি" : "Narration"} />,
    },
    {
      icon: <Wifi className="h-5 w-5" aria-hidden />,
      title: bn ? "কম-ব্যান্ডউইথ মোড" : "Low-bandwidth mode",
      desc: bn ? "ছবি/অ্যানিমেশন/ধ্বনি কমিয়ে ডেটা বাঁচায়" : "Saves data by limiting images, animations and audio",
      control: <Switch checked={settings.lowBandwidth} onCheckedChange={settings.setLowBandwidth} aria-label={bn ? "কম ব্যান্ডউইথ" : "Low bandwidth"} />,
    },
  ];

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Card key={r.title} className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[#2F5746]">{r.icon}</span>
              <div>
                <Label className="text-base font-bold text-[#202C26] bn-text">{r.title}</Label>
                <p className="mt-0.5 text-sm text-[#59665F] bn-text">{r.desc}</p>
              </div>
            </div>
            {r.control}
          </CardContent>
        </Card>
      ))}
      <InfoNote title={bn ? "সেটিংস এই ব্রাউজারেই থাকে" : "Settings stay in this browser"}>
        {bn
          ? "আপনার পছন্দ শুধু এই ব্রাউজারের স্টোরেজে সংরক্ষিত হয় — কোনো সার্ভারে আপনার নামে প্রোফাইল তৈরি হয় না।"
          : "Your preferences live only in this browser's storage — no server-side profile is created in your name."}
      </InfoNote>
    </div>
  );
}
