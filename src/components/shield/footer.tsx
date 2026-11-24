"use client";

// Footer — minimal single band (per approved home design): privacy link with a
// lock glyph, two essential links, and the GUARDIAN V7 brand mark right-aligned.
// The footer stays glued to the bottom via the app's min-h-screen flex column
// + mt-auto. The mobile bottom tab bar (app-like navigation) stays unchanged.

import { Lock, Home, ShieldQuestion, BookOpen, Users, LifeBuoy } from "lucide-react";
import { Link, useHashRoute } from "./router";
import { useT, useLang } from "./i18n";

export function Footer() {
  const t = useT();
  const bn = useLang() === "bn";

  return (
    <footer className="mt-auto border-t border-[#E3E1D4] bg-[#F7F6EF] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <nav
            aria-label={bn ? "ফুটার লিংক" : "Footer links"}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
          >
            <Link
              to="/privacy"
              className="inline-flex items-center gap-1.5 font-semibold text-[#202C26] hover:underline focus-ring bn-text"
            >
              <Lock className="h-4 w-4 text-[#2E5B3C]" aria-hidden />
              {bn ? "গোপনীয়তা ও সেটিংস" : "Privacy & settings"}
            </Link>
            <Link to="/help" className="font-medium text-[#59665F] hover:text-[#202C26] hover:underline focus-ring bn-text">
              {t("nav.help")}
            </Link>
            <Link to="/" className="font-medium text-[#59665F] hover:text-[#202C26] hover:underline focus-ring bn-text">
              {t("nav.home")}
            </Link>
          </nav>
          <p className="text-[13px] font-bold uppercase tracking-wide text-[#202C26]" aria-label="BanglaShield AI Guardian V7">
            BanglaShield AI · Guardian V7
          </p>
        </div>
        <p className="mt-3 text-center sm:text-left text-[11px] leading-relaxed text-[#7A8478] bn-text">
          © {new Date().getFullYear()} BanglaShield AI — {t("footer.copyright")} · {t("footer.privacyNote")}
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom tab bar — app-like primary navigation (hidden on lg+).
// ---------------------------------------------------------------------------

export function MobileTabBar() {
  const bn = useLang() === "bn";
  const { path } = useHashRoute();

  const tabs = [
    { to: "/", icon: Home, bn: "হোম", en: "Home" },
    { to: "/check", icon: ShieldQuestion, bn: "যাচাই", en: "Verify" },
    { to: "/learn", icon: BookOpen, bn: "শিখুন", en: "Learn" },
    { to: "/community", icon: Users, bn: "কমিউনিটি", en: "Community" },
    { to: "/help", icon: LifeBuoy, bn: "সহায়তা", en: "Support" },
  ];

  return (
    <nav
      aria-label={bn ? "মোবাইল নেভিগেশন" : "Mobile navigation"}
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-[#E3E1D4] bg-[#FEFDF8]/97 backdrop-blur supports-[backdrop-filter]:bg-[#FEFDF8]/92 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.to === "/" ? path === "/" : path.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors ${
                active ? "text-[#153E32]" : "text-[#8A9B90] hover:text-[#59665F]"
              }`}
              ariaCurrent={active}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-semibold bn-text leading-none">{bn ? tab.bn : tab.en}</span>
              <span
                className={`h-1 w-6 rounded-full transition-colors ${active ? "bg-[#153E32]" : "bg-transparent"}`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
