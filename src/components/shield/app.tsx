"use client";

import { useEffect, useState } from "react";
import { ShieldHalf } from "lucide-react";
import dynamic from "next/dynamic";
import { useHashRoute } from "./router";
import { Header } from "./header";
import { Footer, MobileTabBar } from "./footer";
import { useSettings } from "./store";
import { useMember } from "./member";
import { Link } from "./router";
import { Button } from "@/components/ui/button";

// Route-level code splitting keeps the first paint fast on low-end phones.
const HomePage = dynamic(() => import("./pages/home"), {
  loading: () => <PageSkeleton />,
});
const CheckPage = dynamic(() => import("./pages/check"), { loading: () => <PageSkeleton /> });
const AnalysisPage = dynamic(() => import("./pages/analysis"), { loading: () => <PageSkeleton /> });
const ShieldLensPage = dynamic(() => import("./pages/shield-lens"), { loading: () => <PageSkeleton /> });
const RecoveryPage = dynamic(() => import("./pages/recovery"), { loading: () => <PageSkeleton /> });
const CommunityPage = dynamic(() => import("./pages/community"), { loading: () => <PageSkeleton /> });
const DemoPage = dynamic(() => import("./pages/demo"), { loading: () => <PageSkeleton /> });
const LearnPage = dynamic(() => import("./pages/learn"), { loading: () => <PageSkeleton /> });
const PrivacyPage = dynamic(() => import("./pages/privacy"), { loading: () => <PageSkeleton /> });
const AnalystPage = dynamic(() => import("./pages/analyst/analyst"), { loading: () => <PageSkeleton /> });
const GuardianPage = dynamic(() => import("./pages/guardian"), { loading: () => <PageSkeleton /> });
const ReportPage = dynamic(() => import("./pages/report"), { loading: () => <PageSkeleton /> });
// COU TECHNOVA 2026 — isolated judge-demo environment (fictional TEST DATA).
const TechnovaDemoPage = dynamic(() => import("./pages/technova-demo"), { loading: () => <PageSkeleton /> });

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-4" aria-hidden>
      <div className="h-8 w-2/3 rounded-lg bg-[#EDEAE1] animate-pulse" />
      <div className="h-4 w-5/6 rounded bg-[#EDEAE1] animate-pulse" />
      <div className="h-4 w-4/6 rounded bg-[#EDEAE1] animate-pulse" />
      <div className="h-40 w-full rounded-2xl bg-[#EDEAE1] animate-pulse" />
    </div>
  );
}

function NotFound() {
  const bn = typeof document !== "undefined" ? document.body.classList.contains("bn-text") : true;
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl font-bold text-[#DDE8DF] bn-text">৪০৪ / 404</p>
      <h1 className="mt-4 text-2xl font-bold text-[#202C26] bn-text">
        {bn ? "পাতাটি খুঁজে পাওয়া যায়নি" : "Page not found"}
      </h1>
      <p className="mt-2 text-[#59665F] bn-text">
        {bn ? "ঠিকানাটি আবার দেখে নিন, কিংবা হোমে ফিরে যান।" : "Please check the address, or return home."}
      </p>
      <Button asChild className="bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A]">
        <Link to="/" className="mt-6 inline-block">{bn ? "হোমে ফিরুন" : "Back home"}</Link>
      </Button>
    </div>
  );
}

function Router({ path, parts }: { path: string; parts: string[] }) {
  if (path === "/" || path === "") return <HomePage />;
  if (parts[0] === "check") return <CheckPage initialTab={parts[1]} />;
  if (parts[0] === "analysis" && parts[1]) return <AnalysisPage caseId={parts[1]} />;
  if (parts[0] === "shield-lens" && parts[1]) return <ShieldLensPage caseId={parts[1]} />;
  // V7 routing repairs: /report and /recovery have their own pages
  // (previously both misrouted to Community). Community's embedded reporting
  // tab (?report=/case=) keeps working unchanged.
  if (parts[0] === "report") return <ReportPage />;
  // key remount: a hash change of the Guardian sub-tab must re-init the tab
  // state (same pattern as the Check page's initialTab fix).
  if (parts[0] === "guardian") return <GuardianPage key={parts[1] ?? "overview"} initialTab={parts[1]} />;
  if (parts[0] === "community") return <CommunityPage />;
  if (parts[0] === "demo") return <DemoPage />;
  // COU TECHNOVA 2026 — isolated judge-demo environment (fictional TEST DATA).
  if (parts[0] === "technova-demo") return <TechnovaDemoPage />;
  if (parts[0] === "learn") return <LearnPage />;
  if (parts[0] === "privacy" || parts[0] === "settings") return <PrivacyPage tab={parts[0]} />;
  // Unified help: emergency triage + recovery checklist + verified directory.
  if (parts[0] === "help" || parts[0] === "recovery") return <RecoveryPage />;
  if (parts[0] === "analyst") return <AnalystPage tab={parts[1] ?? "dashboard"} />;
  return <NotFound />;
}

export default function ShieldApp() {
  const [mounted, setMounted] = useState(false);
  const { path, parts } = useHashRoute();
  const { lang, largeText, reduceMotion } = useSettings();

  // Canonical render-after-mount gate for persisted-store hydration safety.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Resolve the member session once per app load (community features).
  useEffect(() => {
    if (mounted) useMember.getState().init();
  }, [mounted]);

  // Reflect accessibility settings on <html>.
  useEffect(() => {
    if (!mounted) return;
    // Sync external DOM (html attrs) — allowed by the rule via the wrapper below.
    const root = document.documentElement;
    root.lang = lang;
    document.body.classList.toggle("bn-text", lang === "bn");
    root.classList.toggle("text-large", largeText);
    root.classList.toggle("reduce-motion", reduceMotion);
  }, [mounted, lang, largeText, reduceMotion]);

  if (!mounted) {
    // Brief brand splash while persisted settings hydrate (prevents mismatch).
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F6EF]">
        <div className="m-auto flex flex-col items-center gap-4" aria-hidden>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2F5746]">
            <ShieldHalf className="h-8 w-8 text-[#FFFEFA]" />
          </span>
          <p className="text-xl font-bold text-[#202C26] bn-text">বাংলাশিল্ড লোড হচ্ছে… · Loading BanglaShield…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6EF]">
      {/* Skip link: focuses the main landmark WITHOUT touching the hash —
          a #main-content href would corrupt hash-router state. */}
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-[#2F5746] focus:text-[#FFFEFA] focus:px-4 focus:py-2 focus:rounded-lg"
      >
        মূল কন্টেন্টে যান / Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full pb-20 lg:pb-0 focus:outline-none">
        <Router path={path} parts={parts} />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
