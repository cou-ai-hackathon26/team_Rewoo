"use client";

import { useState } from "react";
import { ShieldHalf, Menu, TriangleAlert, Siren, LogIn, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Link, useHashRoute } from "./router";
import { useT, useLang } from "./i18n";
import { useSettings } from "./store";
import { useMember, avatarColor } from "./member";
import { AuthDialog } from "./auth-panel";

// Primary navigation — six items, one section per concern (Support merged).
// The Guardian entry carries a tiny shield glyph (per approved home design).
const NAV = [
  { to: "/", key: "nav.home", icon: false },
  { to: "/check", key: "nav.check", icon: false },
  { to: "/guardian", key: "nav.guardian", icon: true },
  { to: "/learn", key: "nav.learn", icon: false },
  { to: "/community", key: "nav.community", icon: false },
  { to: "/help", key: "nav.help", icon: false },
];

function LangToggle() {
  const { lang, setLang } = useSettings();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "bn" ? "en" : "bn")}
      className="rounded-full border-[#E3E1D4] bg-[#FEFDF8] text-[#202C26] hover:bg-[#F0EFE4] font-bold h-11 min-w-11 px-4 shadow-sm"
      aria-label={lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
    >
      {lang === "bn" ? "EN" : "বাংলা"}
    </Button>
  );
}

/** One-tap emergency door — red pill in the header (per approved home design). */
function EmergencyPill({ full = false }: { full?: boolean }) {
  const bn = useLang() === "bn";
  return (
    <Link
      to="/help"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#9F3B32] px-4 h-11 text-[15px] font-bold text-[#FEFDF8] transition-colors hover:bg-[#8A3229] focus-ring bn-text shadow-sm",
        full ? "w-full" : "hidden md:inline-flex"
      )}
      ariaLabel={bn ? "জরুরি সহায়তা পাতায় যান" : "Go to emergency help"}
    >
      <TriangleAlert className="h-4 w-4" aria-hidden />
      {bn ? "জরুরি সহায়তা" : "Emergency"}
    </Link>
  );
}

/** Member account button — sign in, or avatar chip → my dashboard. */
function AccountButton({ full = false }: { full?: boolean }) {
  const lang = useLang();
  const bn = lang === "bn";
  const member = useMember((s) => s.member);
  const [authOpen, setAuthOpen] = useState(false);

  if (member) {
    return (
      <Link
        to="/community?tab=mine"
        className={cn(
          "flex items-center gap-2 rounded-full border-2 border-[#D8DED5] bg-[#FFFEFA] pl-1.5 pr-3 py-1 hover:border-[#2F5746]/50 transition-colors focus-ring",
          full && "w-full py-2.5"
        )}
        aria-label={bn ? `আমার ড্যাশবোর্ড — ${member.name}` : `My dashboard — ${member.name}`}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-[#FFFEFA] text-sm bn-text"
          style={{ background: avatarColor(member.publicId) }}
          aria-hidden
        >
          {member.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-left leading-tight">
          <span className="block text-xs font-bold text-[#202C26] bn-text max-w-24 truncate">{member.name}</span>
          <span className="block text-[10px] text-[#8A9B90] font-mono">{member.publicId}</span>
        </span>
        <LayoutDashboard className="h-4 w-4 text-[#8A9B90] ml-1 shrink-0" aria-hidden />
      </Link>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAuthOpen(true)}
        className={cn(
          "rounded-full border-[#E3E1D4] bg-[#FEFDF8] text-[#153E32] hover:bg-[#F0EFE4] gap-1.5 font-semibold h-11 px-4 shadow-sm",
          full && "w-full"
        )}
      >
        <LogIn className="h-4 w-4" aria-hidden />
        {bn ? "সাইন-ইন" : "Sign in"}
      </Button>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}

export function Header() {
  const t = useT();
  const lang = useLang();
  const bn = lang === "bn";
  const { path } = useHashRoute();
  const [open, setOpen] = useState(false);

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E1D4] bg-[#F7F6EF]/95 backdrop-blur supports-[backdrop-filter]:bg-[#F7F6EF]/85">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 focus-ring rounded-lg" ariaLabel="BanglaShield home">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#153E32]">
              <ShieldHalf className="h-5 w-5 text-[#FEFDF8]" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold text-[#202C26] bn-text">বাংলাশিল্ড</span>
              <span className="hidden sm:block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#7A8478]">
                Guardian Intelligence
              </span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[15px] font-medium transition-colors focus-ring bn-text",
                  isActive(item.to)
                    ? "bg-[#DCE7D9] font-semibold text-[#153E32]"
                    : "text-[#59665F] hover:bg-[#EAEEE0] hover:text-[#202C26]"
                )}
                ariaCurrent={isActive(item.to)}
              >
                {item.icon && <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <AccountButton />
            </div>
            <EmergencyPill />
            <LangToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden rounded-full border-[#E3E1D4] bg-[#FEFDF8] text-[#153E32] h-11 w-11 shadow-sm"
                  aria-label={bn ? "মেনু খুলুন" : "Open menu"}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-[#D8DED5] bg-[#FFFEFA] p-0">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <SheetDescription className="sr-only">
                  {bn ? "বাংলাশিল্ডের সব পাতার লিংক" : "Links to all BanglaShield pages"}
                </SheetDescription>
                <nav className="flex flex-col gap-1 p-4 pt-14" aria-label="Mobile navigation">
                  {/* one-tap emergency action (not a separate section — Support page owns it) */}
                  <a
                    href="tel:999"
                    className="mb-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#A44435] px-4 py-3 text-base font-bold text-[#FFFEFA] focus-ring bn-text"
                  >
                    <Siren className="h-5 w-5" aria-hidden />
                    {bn ? "জরুরি: ৯৯৯ এ কল করুন" : "Emergency: call 999"}
                  </a>
                  {NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-full px-4 py-3 text-base font-medium focus-ring bn-text",
                        isActive(item.to) ? "bg-[#DCE7D9] font-semibold text-[#153E32]" : "text-[#59665F] hover:bg-[#F4F1EB]"
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                  <div className="h-px bg-[#D8DED5] my-2" />
                  <div className="px-1 pb-1">
                    <AccountButton full />
                  </div>
                  <div className="px-1 pb-1">
                    <EmergencyPill full />
                  </div>
                  <Link
                    to="/privacy"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-medium text-[#59665F] hover:bg-[#F4F1EB] focus-ring bn-text"
                  >
                    {t("nav.cases")} · {t("nav.privacy")}
                  </Link>
                  <Link
                    to="/demo"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-medium text-[#59665F] hover:bg-[#F4F1EB] focus-ring bn-text"
                  >
                    {t("nav.demo")}
                  </Link>
                  <Link
                    to="/analyst"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-medium text-[#59665F] hover:bg-[#F4F1EB] focus-ring bn-text"
                  >
                    {t("nav.analyst")}
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
