"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Flag,
  EyeOff,
  CheckCircle2,
  Loader2,
  Trash2,
  Search,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ShieldApiError } from "../api";
import { useLang, useT } from "../i18n";
import { Link } from "../router";
import { InfoNote, StatusBadge, CopyButton } from "../ui-bits";
import { SCAM_CATEGORIES } from "@/lib/types";

const CATEGORY_KEYS = Object.keys(SCAM_CATEGORIES).filter((k) => !["no_indicators"].includes(k));

export default function ReportPage({ initialCase, embedded = false }: { initialCase?: string; embedded?: boolean }) {
  const bn = useLang() === "bn";
  const t = useT();
  const params = typeof window !== "undefined" ? new URLSearchParams((window.location.hash.split("?")[1] ?? "")) : null;
  const caseParam = initialCase ?? params?.get("case") ?? "";

  const [caseId, setCaseId] = useState(caseParam);
  const [category, setCategory] = useState<string>("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; withdrawToken: string } | null>(null);

  // withdrawal lookup
  const [lookupId, setLookupId] = useState("");
  const [found, setFound] = useState<{ id: string; status: string; submittedAt: string } | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [withdrawToken, setWithdrawToken] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const submit = async () => {
    if (!category || content.trim().length < 10 || !consent) {
      toast.error(bn ? "শ্রেণি, বিবরণ ও সম্মতি — তিনটিই দরকার" : "Category, description and consent are all required");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ id: string; withdrawToken: string }>("/api/v1/reports", {
        category,
        content,
        consentReport: true,
        consentContact: contactConsent,
        ...(caseId.trim() ? { sessionId: caseId.trim().toUpperCase() } : {}),
      });
      setResult({ id: res.id, withdrawToken: res.withdrawToken });
      toast.success(bn ? "রিপোর্ট জমা হয়েছে — রশিদ-টোকেনটি এখনই সংরক্ষণ করুন!" : "Report submitted — save your receipt token now!");
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const lookup = async () => {
    if (!/^RPT-[A-Z0-9]{8}$/.test(lookupId.trim().toUpperCase())) {
      toast.error(bn ? "সঠিক রেফারেন্স আইডি দিন (RPT-XXXXXXXX)" : "Enter a valid reference (RPT-XXXXXXXX)");
      return;
    }
    setLookupBusy(true);
    try {
      const res = await api.get<{ id: string; status: string; submittedAt: string }>(
        `/api/v1/reports?ref=${lookupId.trim().toUpperCase()}`
      );
      setFound(res);
    } catch (err) {
      setFound(null);
      toast.error(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    } finally {
      setLookupBusy(false);
    }
  };

  const withdraw = async () => {
    if (!found) return;
    if (withdrawToken.trim().length < 8) {
      setWithdrawError(
        bn
          ? "জমা দেওয়ার সময় পাওয়া রশিদ-টোকেনটি লিখুন — শুধু রেফারেন্স আইডি দিয়ে প্রত্যাহার করা যায় না (নিরাপত্তা নিয়ম)।"
          : "Enter the receipt token you received at submission — a reference ID alone cannot withdraw a report (security rule)."
      );
      return;
    }
    setWithdrawBusy(true);
    setWithdrawError("");
    try {
      await api.del(`/api/v1/reports/${found.id}?token=${encodeURIComponent(withdrawToken.trim())}`);
      toast.success(bn ? "রিপোর্টটি প্রত্যাহার করা হয়েছে" : "Report withdrawn");
      setFound({ ...found, status: "withdrawn" });
    } catch (err) {
      setWithdrawError(err instanceof ShieldApiError ? err.apiError.message : t("common.error"));
    } finally {
      setWithdrawBusy(false);
    }
  };

  // ------- shared withdrawal lookup card (shown in both views) -------
  const withdrawCard = (
    <Card className="border-[#D8DED5] bg-[#FFFEFA]">
      <CardContent className="p-5 md:p-6 space-y-4">
        <p className="font-bold text-[#202C26] flex items-center gap-2 bn-text">
          <Trash2 className="h-5 w-5 text-[#A44435]" aria-hidden />
          {bn ? "নিজের রিপোর্ট খুঁজুন / প্রত্যাহার করুন" : "Find / withdraw your report"}
        </p>
        <div className="flex gap-2">
          <Input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value.toUpperCase())}
            placeholder="RPT-XXXXXXXX"
            className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] uppercase flex-1"
            aria-label={bn ? "রেফারেন্স আইডি" : "Reference ID"}
          />
          <Button onClick={lookup} disabled={lookupBusy} variant="outline" className="border-[#2F5746]/50 text-[#2F5746] gap-1.5">
            {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
            {bn ? "খুঁজুন" : "Find"}
          </Button>
        </div>
        {found && (
          <div className="rounded-xl border border-[#D8DED5] bg-[#F4F1EB] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-[#202C26]">{found.id}</p>
                <p className="text-sm text-[#59665F]">
                  <StatusBadge status={found.status} />
                </p>
              </div>
              {found.status !== "withdrawn" && (
                <Button onClick={withdraw} disabled={withdrawBusy} variant="outline" size="sm" className="border-[#A44435]/50 text-[#A44435] hover:bg-[#F4E1DA] gap-1.5">
                  {withdrawBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />} {bn ? "প্রত্যাহার করুন" : "Withdraw"}
                </Button>
              )}
            </div>
            {found.status !== "withdrawn" && (
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-token" className="text-xs font-semibold text-[#59665F] bn-text">
                  {bn ? "প্রত্যাহারের রশিদ-টোকেন" : "Withdrawal receipt token"}
                </Label>
                <Input
                  id="withdraw-token"
                  value={withdrawToken}
                  onChange={(e) => setWithdrawToken(e.target.value)}
                  placeholder={bn ? "জমা দেওয়ার সময় পাওয়া টোকেন" : "token from your submission receipt"}
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] font-mono text-sm"
                  autoComplete="off"
                />
              </div>
            )}
            {withdrawError && <p className="text-xs text-[#A44435] bn-text">{withdrawError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ------- submitted confirmation view -------
  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <Card className="border-[#2F5746]/50 bg-[#FFFEFA]">
          <CardContent className="p-8 text-center space-y-4">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DDE8DF]">
              <CheckCircle2 className="h-8 w-8 text-[#2F5746]" aria-hidden />
            </span>
            <h1 className="text-2xl font-bold text-[#202C26] bn-text">
              {bn ? "রিপোর্ট জমা হয়েছে" : "Report submitted"}
            </h1>
            <p className="text-[#59665F] leading-relaxed bn-text">
              {bn
                ? "আপনার রিপোর্ট বেনামে সংরক্ষিত হয়েছে — কোনো নাম, নম্বর বা ব্যক্তিগত তথ্য ছাড়াই। বিশ্লেষকরা প্যাটার্ন যাচাই করে সম্প্রদায়কে সতর্ক করবেন।"
                : "Your report is stored anonymously — no name, number, or personal data. Analysts verify patterns to alert the community."}
            </p>
            <div className="rounded-xl border border-[#D8DED5] bg-[#F4F1EB] p-4 space-y-3">
              <div>
                <p className="text-xs text-[#59665F]">{bn ? "আপনার রেফারেন্স আইডি" : "Your reference ID"}</p>
                <p className="text-2xl font-bold tracking-wider text-[#2F5746]">{result.id}</p>
                <div className="mt-2 flex justify-center">
                  <CopyButton value={result.id} label={bn ? "কপি করুন" : "Copy"} />
                </div>
              </div>
              <div className="rounded-lg border-2 border-dashed border-[#8A5B28]/60 bg-[#F2E8D5]/60 p-3 text-left">
                <p className="text-xs font-bold text-[#8A5B28] bn-text">
                  {bn ? "প্রত্যাহারের রশিদ-টোকেন — এখনই সংরক্ষণ করুন (আর দেখানো হবে না)" : "Withdrawal receipt token — save it now (shown only once)"}
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[#202C26]">{result.withdrawToken}</p>
                <div className="mt-2 flex justify-start">
                  <CopyButton value={result.withdrawToken} label={bn ? "টোকেন কপি করুন" : "Copy token"} />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#59665F] bn-text">
                  {bn
                    ? "নিরাপত্তার জন্য: শুধু রেফারেন্স আইডি দিয়ে রিপোর্ট প্রত্যাহার করা যায় না — এই টোকেনটি লাগবে। হারিয়ে ফেললে সদস্য একাউন্ট থেকে ঢুকে প্রত্যাহার করতে পারবেন।"
                    : "For security: the reference ID alone cannot withdraw a report — this token is required. If lost, sign in with your member account to withdraw."}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#59665F] bn-text">
              {bn
                ? "রেফারেন্স আইডি দিয়ে নিচের অংশে অবস্থা দেখতে পারবেন; প্রত্যাহারে টোকেনটি লাগবে।"
                : "Use the reference ID below to check status; the token is needed to withdraw."}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button asChild variant="outline" className="border-[#2F5746]/50 text-[#2F5746] gap-2">
                <Link to="/learn">{bn ? "স্ক্যামএকাডেমিতে যান" : "Go to ScamAcademy"}</Link>
              </Button>
              <Button asChild className="bg-[#2F5746] text-[#FFFEFA] gap-2">
                <Link to="/check">
                  {bn ? "আরেকটি যাচাই" : "Another check"} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {withdrawCard}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 md:py-12 space-y-8">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2F5746]">
          <Flag className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#202C26] bn-text">
            {bn ? "সম্প্রদায়ের রিপোর্ট" : "Community report"}
          </h1>
          <p className="mt-1 text-[#59665F] leading-relaxed bn-text">
            {bn
              ? "প্রতারণার চেষ্টাটি জানিয়ে অন্যদের সাবধান করুন। সম্পূর্ণ বেনামে — আপনার নাম-পরিচয় কিছুই জমা হয় না।"
              : "Warn others by reporting the scam attempt. Fully anonymous — no identity is stored."}
          </p>
        </div>
      </div>

      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-5 md:p-6 space-y-5">
          <div>
            <Label htmlFor="report-case" className="text-sm font-semibold text-[#59665F]">
              {bn ? "সংশ্লিষ্ট কেস আইডি (ঐচ্ছিক — যাচাই করে থাকলে)" : "Related case ID (optional — if you ran a check)"}
            </Label>
            <Input
              id="report-case"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value.toUpperCase())}
              placeholder="BS-XXXXXXXX"
              className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] uppercase"
            />
          </div>

          <div>
            <Label htmlFor="report-category" className="text-sm font-semibold text-[#59665F]">
              {bn ? "কোন ধরনের প্রতারণা?" : "What type of scam?"}
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="report-category" className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus:ring-[#2F5746]">
                <SelectValue placeholder={bn ? "শ্রেণি বাছাই করুন…" : "Pick a category…"} />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
                {CATEGORY_KEYS.map((k) => (
                  <SelectItem key={k} value={k} className="bn-text focus:bg-[#DDE8DF]">
                    {SCAM_CATEGORIES[k][bn ? "bn" : "en"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="report-content" className="text-sm font-semibold text-[#59665F]">
              {bn ? "কী হয়েছিল — সংক্ষেপে লিখুন" : "What happened — briefly"}
            </Label>
            <Textarea
              id="report-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={
                bn
                  ? "যেমন: 'বিকাশ টিম বলে ফোন এলো, একাউন্ট বন্ধের ভয় দেখিয়ে ওটিপি চাইলো। নম্বরটা ছিল 017XXXXXXXX…'"
                  : "e.g. 'A caller posed as the bKash team, threatened account closure and asked for an OTP. The number was 017XXXXXXXX…'"
              }
              className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] bn-text"
            />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#59665F] bn-text">
              <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {bn
                ? "জমা দেওয়ার আগে ওটিপি-পিন স্বয়ংক্রিয়ভাবে আড়াল হবে, নম্বরের শেষ ৪ ডিজিট ছাড়া বাকি সব মুছে যাবে।"
                : "Before saving, OTPs/PINs are auto-redacted and phone numbers are trimmed to the last 4 digits."}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-dashed border-[#8A5B28]/50 bg-[#F2E8D5]/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5 border-[#8A5B28] data-[state=checked]:bg-[#2F5746]"
              />
              <span className="text-sm text-[#59665F] leading-relaxed bn-text">
                {bn ? (
                  <>
                    আমি সম্মত হচ্ছি: আমার দেওয়া <strong>আড়ালকৃত</strong> বিবরণ প্রতারণা-প্যাটার্ন যাচাইয়ে ব্যবহার ও সংরক্ষিত হবে। আমার নাম-ঠিকানা কিছুই সংরক্ষণ হচ্ছে না।
                  </>
                ) : (
                  <>
                    I consent: my <strong>redacted</strong> description will be stored and used for fraud-pattern analysis. My name and identity are never stored.
                  </>
                )}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={contactConsent}
                onCheckedChange={(v) => setContactConsent(v === true)}
                className="mt-0.5 border-[#8A5B28] data-[state=checked]:bg-[#2F5746]"
              />
              <span className="text-sm text-[#59665F] leading-relaxed bn-text">
                {bn
                  ? "(ঐচ্ছিক) গুরুত্বপূর্ণ বিষয়ে যোগাযোগের অনুমতি দিচ্ছি — তবু এখন কোনো যোগাযোগের তথ্য দিচ্ছি না।"
                  : "(Optional) I allow follow-up contact on important matters — no contact data is collected at this step."}
              </span>
            </label>
          </div>

          <InfoNote title={bn ? "পুলিশ/ব্যাংকে অভিযোগ আলাদা" : "Police/bank complaints are separate"}>
            {bn
              ? "এটি সম্প্রদায়ের সতর্কতামূলক রিপোর্ট — পুলিশ বা ব্যাংকে আনুষ্ঠানিক অভিযোগের বিকল্প নয়। জরুরি ক্ষতির জন্য 'জরুরি সহায়তা' দেখুন; বাংলাশিল্ড কখনোই নিজে থেকে আপনার তথ্য বাইরের সংস্থায় পাঠায় না।"
              : "This is a community alert — not a formal police/bank complaint. For urgent harm see Emergency guidance; BanglaShield never forwards your data to external organizations automatically."}
          </InfoNote>

          <Button
            onClick={submit}
            disabled={busy || !consent || !category || content.trim().length < 10}
            className="w-full h-13 py-3.5 text-lg font-bold bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] rounded-xl gap-2"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
            {bn ? "বেনামে রিপোর্ট জমা দিন" : "Submit anonymous report"}
          </Button>
        </CardContent>
      </Card>

      {/* withdrawal */}
      {withdrawCard}
    </div>
  );
}
