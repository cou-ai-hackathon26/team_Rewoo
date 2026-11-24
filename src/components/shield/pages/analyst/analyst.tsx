"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldHalf,
  LogOut,
  LayoutDashboard,
  Network,
  ClipboardList,
  Search,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ShieldApiError } from "../../api";
import { useLang } from "../../i18n";
import { cn } from "@/lib/utils";
import { SyntheticTag } from "../../ui-bits";
import AnalystDashboard from "./dashboard";
import AnalystGraph from "./graph";
import AnalystReview from "./review";
import AnalystAudit from "./audit";

interface Session {
  userId: string;
  role: string;
  name?: string;
  email?: string;
}

const TABS = [
  { key: "dashboard", icon: <LayoutDashboard className="h-4 w-4" aria-hidden />, bn: "ড্যাশবোর্ড", en: "Dashboard" },
  { key: "graph", icon: <Network className="h-4 w-4" aria-hidden />, bn: "সম্পর্ক-গ্রাফ", en: "Graph" },
  { key: "review", icon: <ClipboardList className="h-4 w-4" aria-hidden />, bn: "রিভিউ কিউ", en: "Review queue" },
  { key: "audit", icon: <Search className="h-4 w-4" aria-hidden />, bn: "অডিট লগ", en: "Audit log" },
] as const;

export default function AnalystPage({ tab }: { tab: string }) {
  const bn = useLang() === "bn";
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const activeTab = TABS.some((t) => t.key === tab) ? tab : "dashboard";

  useEffect(() => {
    api
      .get<{ session: Session | null }>("/api/v1/auth/analyst")
      .then((r) => setSession(r.session))
      .catch(() => setSession(null));
  }, []);

  const signOut = async () => {
    try {
      await fetch("/api/v1/auth/analyst", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setSession(null);
  };

  if (session === "loading") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-[#59665F]" role="status">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!session) return <AnalystLogin onSuccess={(s) => setSession(s)} />;

  return (
    <div className="min-h-[70vh]">
      <div className="border-b border-[#D8DED5] bg-[#EDEAE1]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2F5746]">
              <ShieldHalf className="h-5 w-5 text-[#FFFEFA]" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-[#202C26] bn-text">
                {bn ? "ফ্রড ইন্টেলিজেন্স ওয়ার্কস্পেস" : "Fraud Intelligence Workspace"}
              </p>
              <p className="text-xs text-[#59665F]">
                {session.email} · {session.role}
              </p>
            </div>
            <SyntheticTag />
          </div>
          <Button onClick={signOut} variant="outline" size="sm" className="border-[#D8DED5] text-[#59665F] gap-1.5">
            <LogOut className="h-4 w-4" aria-hidden /> {bn ? "সাইন-আউট" : "Sign out"}
          </Button>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-3 flex gap-1 overflow-x-auto scroll-soft" role="tablist">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`#/analyst/${t.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-ring bn-text",
                activeTab === t.key ? "bg-[#2F5746] text-[#FFFEFA]" : "text-[#59665F] hover:bg-[#FFFEFA]"
              )}
              role="tab"
              aria-selected={activeTab === t.key}
            >
              {t.icon}
              {bn ? t.bn : t.en}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-8">
        {activeTab === "dashboard" && <AnalystDashboard />}
        {activeTab === "graph" && <AnalystGraph />}
        {activeTab === "review" && <AnalystReview />}
        {activeTab === "audit" && <AnalystAudit />}
      </div>
    </div>
  );
}

function AnalystLogin({ onSuccess }: { onSuccess: (s: Session) => void }) {
  const bn = useLang() === "bn";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ session: Session }>("/api/v1/auth/analyst", { email, password });
      toast.success(bn ? "স্বাগতম!" : "Welcome!");
      onSuccess(res.session);
    } catch (err) {
      toast.error(err instanceof ShieldApiError ? err.apiError.message : bn ? "সাইন-ইন ব্যর্থ" : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <Card className="border-[#D8DED5] bg-[#FFFEFA]">
        <CardContent className="p-6 md:p-8 space-y-5">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2F5746]">
              <Lock className="h-7 w-7 text-[#FFFEFA]" aria-hidden />
            </span>
            <h1 className="mt-3 text-xl font-bold text-[#202C26] bn-text">
              {bn ? "অ্যানালিস্ট প্রবেশ" : "Analyst sign-in"}
            </h1>
            <p className="mt-1 text-sm text-[#59665F] bn-text">
              {bn
                ? "সার্ভার-স্তরে ভূমিকা-যাচাইকৃত সুরক্ষিত এলাকা"
                : "Server-enforced role-based secure area"}
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <div>
              <Label htmlFor="analyst-email" className="bn-text">{bn ? "ইমেইল" : "Email"}</Label>
              <Input
                id="analyst-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746]"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="analyst-password" className="bn-text">{bn ? "পাসওয়ার্ড" : "Password"}</Label>
              <Input
                id="analyst-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746]"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] font-bold gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {bn ? "প্রবেশ করুন" : "Sign in"}
            </Button>
          </form>
          <p className="rounded-lg bg-[#F2E8D5]/60 border border-dashed border-[#8A5B28]/40 px-3 py-2.5 text-xs text-[#8A5B28] bn-text">
            {bn
              ? "অনুমোদিত কর্মীদের জন্য সুরক্ষিত এলাকা — বৈধ অ্যাকাউন্ট ছাড়া প্রবেশ সম্ভব নয়। ডেমো পরিবেশের বিচারক-অ্যাকাউন্ট প্রকল্পের README-তে নথিভুক্ত।"
              : "Restricted area for authorized staff — access requires valid credentials. Judge/demo credentials are documented in the project README, never displayed here."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
