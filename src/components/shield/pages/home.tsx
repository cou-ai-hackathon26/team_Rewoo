"use client";

// BanglaShield Home V11 — "Human First" homepage (approved exploration).
// Ported from the standalone reference (upload/index.html) into the existing
// app shell. Scope is strictly this page: the global Header / Footer /
// MobileTabBar, router, Guardian and all analysis APIs remain untouched.
// Every sample below is explicitly fictional — never a live detection feed.

import { type ComponentType } from "react";
import { Link } from "../router";
import { useLang } from "../i18n";
import { usePrefersReducedMotion } from "../store";
import "./home-v11.css";

type Bi = { bn: string; en: string };

// ---------------------------------------------------------------------------
// Icons — original V11 strokes (from the approved standalone symbols).
// ---------------------------------------------------------------------------

type IconProps = { size?: number; className?: string };

function ShieldIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16 3.5 27 8v7.4c0 7.2-4.1 11-11 13-6.9-2-11-5.8-11-13V8L16 3.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="m11 16 3.3 3.3 6.6-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessageIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M20 11.2a8.2 8.2 0 0 1-8.2 8.2 9.6 9.6 0 0 1-3.6-.7L4 20l1.2-4.4A8.2 8.2 0 1 1 20 11.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 10h8m-8 4h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m6.5 17 4-4 2.9 2.8 2.1-2 2.1 3.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="m9.3 14.7 5.4-5.4M8.5 10.1l-1.4 0a4.1 4.1 0 0 0 0 8.2h3.6a4.1 4.1 0 0 0 3.8-2.5M15.5 13.9h1.4a4.1 4.1 0 0 0 0-8.2h-3.6a4.1 4.1 0 0 0-3.8 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Content — bilingual (bn default, en via the global header language toggle).
// ---------------------------------------------------------------------------

const HERO = {
  overline: { bn: "প্রতিটি পরিবারের জন্য ডিজিটাল নিরাপত্তা", en: "Digital safety, for every family" },
  h1a: { bn: "ডিজিটাল দুনিয়ায়", en: "In the digital world," },
  h1b: { bn: "নিরাপদ থাকুক প্রতিটি পরিবার।", en: "may every family stay safe." },
  sub: {
    bn: "একটি সন্দেহজনক কল, বার্তা, ছবি বা লিংক? ভয় পাওয়ার আগে বুঝুন। বাংলাশিল্ডের Guardian পাশে আছে—প্রমাণ দেখাতে, ঝুঁকি বোঝাতে, সঠিক সিদ্ধান্ত নিতে।",
    en: "A suspicious call, message, image or link? Understand it before fear takes over. Guardian helps you see the evidence, understand the risk and choose your next step.",
  },
  note: { bn: "সহজ বাংলা · ব্যবহারকারীর নিয়ন্ত্রণে · এআই ভুল করতে পারে", en: "Plain language · You stay in control · AI can be wrong" },
};

const TOOLS_HEAD = {
  label: "THE FIRST STEP",
  h2a: { bn: "কোন বিষয়টি নিয়ে", en: "What are you" },
  h2b: { bn: "দুশ্চিন্তায় আছেন?", en: "worried about?" },
  pLeft: {
    bn: "যা পেয়েছেন, সেটাই দিন। কঠিন প্রযুক্তি জানার দরকার নেই।",
    en: "Submit what you received. You don’t need technical knowledge.",
  },
  pRight: {
    bn: "বাংলাশিল্ডের যাচাই টুল সরাসরি খুলুন। কোনো নতুন অ্যাকাউন্ট ছাড়াও শুরু করা যায়।",
    en: "Open the existing verification tools without an account.",
  },
};

const TOOLS: Array<{ to: string; icon: ComponentType<IconProps>; title: Bi; desc: Bi }> = [
  {
    to: "/check/voice",
    icon: MicIcon,
    title: { bn: "ভয়েস কল", en: "Voice calls" },
    desc: { bn: "অচেনা কণ্ঠ, জরুরি টাকার দাবি বা পরিচয় নিয়ে সন্দেহ।", en: "Unknown voices, urgent demands or impersonation concerns." },
  },
  {
    to: "/check/message",
    icon: MessageIcon,
    title: { bn: "বার্তা", en: "Messages" },
    desc: { bn: "বিকাশ, এসএমএস, WhatsApp বা অনলাইনে আসা মেসেজ।", en: "Suspicious SMS, mobile-banking and chat messages." },
  },
  {
    to: "/check/image",
    icon: ImageIcon,
    title: { bn: "ছবি ও স্ক্রিনশট", en: "Images & screenshots" },
    desc: { bn: "অফার, নোটিশ বা সন্দেহজনক স্ক্রিনশট বুঝুন।", en: "Understand suspicious screenshots, offers and notices." },
  },
  {
    to: "/check/link",
    icon: LinkIcon,
    title: { bn: "লিংক ও QR", en: "Links & QR" },
    desc: { bn: "ক্লিক করার আগে লিংকের সম্ভাব্য ঝুঁকি দেখুন।", en: "Check the potential risk before opening a link." },
  },
];

const GUARDIAN = {
  label: "MEET YOUR GUARDIAN",
  h2a: { bn: "শুধু উত্তর নয়।", en: "Not just answers." },
  h2b: { bn: "পাশে থাকার মতো সাহায্য।", en: "Guidance that stays with you." },
  quote: {
    bn: "কিছু বুঝতে পারছেন না? Guardian-কে নিজের ভাষায় বলুন। এটি প্রশ্ন বুঝে, সন্দেহের কারণ ব্যাখ্যা করে, পরের নিরাপদ পদক্ষেপ সাজিয়ে দেয়।",
    en: "Unsure what is happening? Talk to Guardian in your own words. It helps explain the concern and suggests safer next steps.",
  },
  bullets: [
    { bn: "আপনার ভাষায় কথা বলে—সহজ বাংলা অথবা ইংরেজিতে।", en: "Speak in plain Bangla or English." },
    { bn: "কী জানা গেছে আর কী জানা যায়নি, আলাদা করে দেখায়।", en: "See what is known and what remains uncertain." },
    { bn: "অনুমতি ছাড়া আপনার ফোন নিয়ন্ত্রণের দাবি করে না।", en: "No claim of controlling your phone without permission." },
  ],
  cta: { bn: "Guardian খুলুন", en: "Open Guardian" },
  chatSub: { bn: "আপনার ডিজিটাল নিরাপত্তা সহায়ক", en: "Your personal safety companion" },
  chatBadge: { bn: "সংলাপের উদাহরণ", en: "Example chat" },
  userMsg: {
    bn: "আমাকে একজন ফোন করে বলল, সে আমার ছেলের বন্ধু। জরুরিভাবে টাকা চাচ্ছে। কী করব?",
    en: "Someone claiming to be my son’s friend called and urgently requested money. What should I do?",
  },
  agentMsg: {
    bn: "প্রথমে টাকা পাঠাবেন না। আপনার ছেলেকে তার পরিচিত নম্বরে যোগাযোগ করুন। অপরিচিত নম্বরের দাবিকে যাচাই ছাড়া বিশ্বাস করবেন না।",
    en: "First, don’t send money. Call your son at his known number. Verify claims from unknown callers independently.",
  },
  evidenceWhy: { bn: "কেন সতর্কতা?", en: "Why caution?" },
  evidenceKey: { bn: "জরুরি টাকা + তৃতীয় ব্যক্তির পরিচয় দাবি", en: "Urgent money + unverified identity" },
  evidenceTail: { bn: "— এগুলো প্রতারণার সম্ভাব্য কৌশল।", en: "— these can be scam tactics." },
  footNote: { bn: "শিক্ষামূলক উদাহরণ · লাইভ চ্যাট নয়", en: "Illustration · not a live chat" },
  footLink: { bn: "Guardian-এ যান", en: "Go to Guardian" },
};

const STORY = {
  label: "THE REASON WE EXIST",
  h2a: { bn: "একটি ভুল সিদ্ধান্তের মূল্য", en: "One wrong decision can" },
  h2b: { bn: "পুরো পরিবারের জীবন।", en: "change a family’s life." },
  p: {
    bn: "রাহেলার ছেলে বিদেশে কাজ করে। এক রাতে ছেলের মতো কণ্ঠে ফোন এলো—“মা, এখনই টাকা পাঠাও।” গল্পটি কাল্পনিক, কিন্তু ভয় আর চাপের অনুভূতিটা বাস্তব। আমরা চাই, প্রতিটি রাহেলা যেন সিদ্ধান্তের আগে একবার থেমে যাচাই করতে পারেন।",
    en: "Rahela’s son works abroad. One night, someone sounds like him and asks for money. This story is fictional, but the pressure is familiar. We want every Rahela to pause and verify first.",
  },
  link: { bn: "রাহেলার উদাহরণটি দেখুন", en: "Explore Rahela’s example" },
  bubbleSmall: { bn: "অচেনা নম্বর • কাল্পনিক কল", en: "Unknown number · fictional call" },
  bubbleL1: { bn: "“মা, আমি বিপদে আছি।", en: "“Mom, I’m in trouble." },
  bubbleL2: { bn: "এখনই টাকা পাঠাও।”", en: "Send money now.”" },
  bubbleTip: {
    bn: "Guardian পরামর্শ: আগে নিজের পরিচিত নম্বরে যোগাযোগ করুন।",
    en: "Guardian tip: independently contact a known number.",
  },
};

const MORE = {
  label: "BEYOND CHECKING",
  h2: { bn: "যাচাইয়ের পরেও আমরা আছি।", en: "We are here after the check, too." },
  p: {
    bn: "ঝুঁকি বোঝা প্রথম ধাপ। সঠিক সিদ্ধান্ত নেওয়া, শেখা এবং বিপদে সহায়তা পাওয়াও সমান জরুরি।",
    en: "Understanding risk is only the start. Learning and recovery matter too.",
  },
  cards: [
    {
      to: "/learn",
      cap: { bn: "01 / শেখা", en: "01 / Learn" },
      title: { bn: "ScamAcademy", en: "ScamAcademy" },
      desc: {
        bn: "বাস্তবসম্মত কাল্পনিক পরিস্থিতিতে ভুল ও সঠিক সিদ্ধান্তের পার্থক্য শিখুন।",
        en: "Practice safer decisions in fictional real-world situations.",
      },
    },
    {
      to: "/community",
      cap: { bn: "02 / কমিউনিটি", en: "02 / Community" },
      title: { bn: "সবার সতর্কতা", en: "Community warnings" },
      desc: {
        bn: "পর্যালোচিত প্রতারণার ধরন সম্পর্কে জানুন। নিজের অভিজ্ঞতাও জানাতে পারেন।",
        en: "Learn from reviewed scam patterns and community warnings.",
      },
    },
    {
      to: "/help",
      cap: { bn: "03 / সহায়তা", en: "03 / Help" },
      title: { bn: "বিপদে কী করবেন?", en: "Need help?" },
      desc: {
        bn: "টাকা বা তথ্য দিয়ে ফেললে কীভাবে দ্রুত নিরাপদ পদক্ষেপ নেবেন, জানুন।",
        en: "Learn what to do after sharing money or personal information.",
      },
    },
  ],
};

const END = {
  label: "BANGLASHIELD AI",
  h2: { bn: "সন্দেহ হলে, একা নন।", en: "If you’re unsure, you’re not alone." },
  p: {
    bn: "একটি প্রশ্ন, একটি যাচাই—হতে পারে পরিবারের জন্য সবচেয়ে জরুরি সিদ্ধান্ত।",
    en: "One question and one check can make an important difference.",
  },
  cta: { bn: "Guardian-এর সাথে কথা বলুন", en: "Talk to Guardian" },
};

// ---------------------------------------------------------------------------
// Decorative art — the soft aura strokes.
// ---------------------------------------------------------------------------

function Aura({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 340 400" aria-hidden="true">
      <path d="M250-10C345 78 82 126 200 212S342 355 90 415" stroke="#6bbf8e" strokeWidth="46" fill="none" opacity=".13" />
      <path d="M265-10C361 80 98 139 222 222S347 344 105 414" stroke="#1f9662" strokeWidth="2" fill="none" opacity=".28" />
    </svg>
  );
}

const STORY_WAVE_HEIGHTS = [10, 17, 26, 38, 20, 47, 30, 21, 35, 16, 27, 12];

// ---------------------------------------------------------------------------
// Home page (V11).
// ---------------------------------------------------------------------------

export default function HomePage() {
  const bn = useLang() === "bn";
  const still = usePrefersReducedMotion();

  const t = (v: Bi) => (bn ? v.bn : v.en);

  return (
    <div className={still ? "bsh-home bsh-still" : "bsh-home"}>
      {/* ================= HERO — the vision, in two lines ================= */}
      <section className="bsh-hero" aria-labelledby="main-hero-title">
        <Aura className="bsh-aura bsh-aura-left" />
        <Aura className="bsh-aura bsh-aura-right" />
        <div className="bsh-wrap">
          <div className="bsh-hero-copy">
            <span className="bsh-overline">
              <span className="bsh-live-dot" />
              {t(HERO.overline)}
            </span>
            <h1 id="main-hero-title">
              {t(HERO.h1a)}
              <br />
              <strong>{t(HERO.h1b)}</strong>
            </h1>
            <p className="bsh-hero-sub">{t(HERO.sub)}</p>
            <p className="bsh-note">{t(HERO.note)}</p>
          </div>
        </div>
      </section>

      {/* ================= FOUR VERIFICATION DOORS ================= */}
      <section className="bsh-section" aria-labelledby="tools-title">
        <div className="bsh-wrap">
          <div className="bsh-intro">
            <div>
              <span className="bsh-label">{TOOLS_HEAD.label}</span>
              <h2 id="tools-title">
                {t(TOOLS_HEAD.h2a)}
                <br />
                {t(TOOLS_HEAD.h2b)}
              </h2>
              <p>{t(TOOLS_HEAD.pLeft)}</p>
            </div>
            <p>{t(TOOLS_HEAD.pRight)}</p>
          </div>
          <div className="bsh-check-grid">
            {TOOLS.map((m) => {
              const Icon = m.icon;
              return (
                <Link key={m.to} to={m.to} className="bsh-feature-card">
                  <span className="bsh-feature-icon">
                    <Icon size={23} />
                  </span>
                  <h3>{t(m.title)}</h3>
                  <p>{t(m.desc)}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= GUARDIAN STORY — helpful dialogue ================= */}
      <section className="bsh-guardian" aria-labelledby="guardian-title">
        <div className="bsh-wrap">
          <div className="bsh-guardian-grid">
            <div className="bsh-guardian-copy">
              <span className="bsh-label">{GUARDIAN.label}</span>
              <h2 id="guardian-title">
                {t(GUARDIAN.h2a)}
                <br />
                {t(GUARDIAN.h2b)}
              </h2>
              <p className="bsh-quote">{t(GUARDIAN.quote)}</p>
              <div className="bsh-guardian-bullets">
                {GUARDIAN.bullets.map((b, i) => (
                  <div className="bsh-guardian-bullet" key={i}>
                    <span className="bsh-tick" aria-hidden="true">✓</span>
                    <span>{t(b)}</span>
                  </div>
                ))}
              </div>
              <Link to="/guardian" className="bsh-btn bsh-btn-primary">
                {t(GUARDIAN.cta)}
              </Link>
            </div>

            <div className="bsh-chat">
              <div className="bsh-chat-head">
                <span className="bsh-chat-avatar">
                  <ShieldIcon size={21} />
                </span>
                <div>
                  <strong>Guardian</strong>
                  <span>{t(GUARDIAN.chatSub)}</span>
                </div>
                <span
                  style={{
                    marginLeft: "auto",
                    background: "#e4f1e5",
                    color: "#22764f",
                    borderRadius: 20,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "4px 9px",
                  }}
                >
                  {t(GUARDIAN.chatBadge)}
                </span>
              </div>
              <div className="bsh-chat-message user">{t(GUARDIAN.userMsg)}</div>
              <div className="bsh-chat-message agent">{t(GUARDIAN.agentMsg)}</div>
              <div className="bsh-chat-evidence">
                {t(GUARDIAN.evidenceWhy)} <strong>{t(GUARDIAN.evidenceKey)}</strong> {t(GUARDIAN.evidenceTail)}
              </div>
              <div className="bsh-chat-foot">
                <span>{t(GUARDIAN.footNote)}</span>
                <Link to="/guardian" aria-label={bn ? "Guardian পাতায় যান" : "Go to Guardian"}>
                  {t(GUARDIAN.footLink)}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= RAHELA SCENARIO — why we exist ================= */}
      <section className="bsh-story" aria-labelledby="story-title">
        <div className="bsh-wrap">
          <div className="bsh-story-grid">
            <div>
              <span className="bsh-label">{STORY.label}</span>
              <h2 id="story-title">
                {t(STORY.h2a)}
                <br />
                {t(STORY.h2b)}
              </h2>
              <p>{t(STORY.p)}</p>
              <Link to="/check/voice?demo=rahela-voice" className="bsh-story-link">
                {t(STORY.link)}
              </Link>
            </div>
            <div className="bsh-story-art">
              <div className="bsh-message-bubble">
                <small>{t(STORY.bubbleSmall)}</small>
                <p>
                  {t(STORY.bubbleL1)}
                  <br />
                  {t(STORY.bubbleL2)}
                </p>
                <b>{t(STORY.bubbleTip)}</b>
              </div>
              <div className="bsh-story-wave" aria-hidden="true">
                {STORY_WAVE_HEIGHTS.map((h, i) => (
                  <i key={i} style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BEYOND CHECKING ================= */}
      <section className="bsh-more" aria-labelledby="more-title">
        <div className="bsh-wrap">
          <div className="bsh-intro">
            <div>
              <span className="bsh-label">{MORE.label}</span>
              <h2 id="more-title">{t(MORE.h2)}</h2>
            </div>
            <p>{t(MORE.p)}</p>
          </div>
          <div className="bsh-more-grid">
            {MORE.cards.map((c) => (
              <Link key={c.to} to={c.to} className="bsh-more-card">
                <span className="bsh-cap">{t(c.cap)}</span>
                <h3>{t(c.title)}</h3>
                <p>{t(c.desc)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA — quiet, decisive, reassuring ================= */}
      <section className="bsh-end">
        <div className="bsh-wrap">
          <span
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: ".17em",
              color: "#a9d6ba",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            {END.label}
          </span>
          <h2>{t(END.h2)}</h2>
          <p>{t(END.p)}</p>
          <Link to="/guardian" className="bsh-btn">
            {t(END.cta)}
          </Link>
        </div>
      </section>
    </div>
  );
}
