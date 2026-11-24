// ---------------------------------------------------------------------------
// Bundled verified-resource fallback.
// The official contact directory must remain available even when the
// database is unreachable or not yet seeded (offline-resilience requirement
// for the emergency recovery center). Values mirror prisma/seed.ts and are
// derived from the organizations' official pages (sourceUrl carries the
// canonical source for independent re-verification).
// ---------------------------------------------------------------------------

export interface BundledResource {
  key: string;
  name: { bn: string; en: string };
  category: string;
  description: { bn: string; en: string };
  guidance: { bn: string; en: string };
  url: string;
  phone: string | null;
  sourceUrl: string;
  verifiedAt: string; // ISO date of the bundled snapshot
}

// Date this bundled snapshot was last reviewed against the source URLs.
// 2026-11-22: all five entries re-checked against their official contact
// pages (bkash.com, nagad.com.bd/en/contact, bb.org.bd, police.gov.bd,
// cirt.gov.bd) via web search from the official domains.
const SNAPSHOT_VERIFIED_AT = "2026-11-22T00:00:00.000Z";

export const BUNDLED_RESOURCES: BundledResource[] = [
  {
    key: "bkash",
    name: { bn: "বিকাশ (bKash)", en: "bKash" },
    category: "mfs",
    description: {
      bn: "বিকাশ সম্পর্কিত জালিয়াতির অভিযোগ, অ্যাকাউন্ট বন্ধ বা সন্দেহজনক লেনদেনের খবর বিকাশের নিজস্ব চ্যানেলে জানান।",
      en: "Report bKash-related fraud, account blocks, or suspicious transactions through bKash's own channels.",
    },
    guidance: {
      bn: "বিকাশ অ্যাপের মেনু থেকে 'হেল্প' বা হেল্পলাইন ১৬২৪৭ (নিজে থেকে কল করুন)। বার্তায় আসা নম্বরে কল করবেন না।",
      en: "Use in-app Help or dial 16247 yourself. Never call numbers that came inside a message.",
    },
    url: "https://www.bkash.com/bn/page/fraud-awareness",
    phone: "16247",
    sourceUrl: "https://www.bkash.com/bn/page/fraud-awareness",
    verifiedAt: SNAPSHOT_VERIFIED_AT,
  },
  {
    key: "nagad",
    name: { bn: "নগদ (Nagad)", en: "Nagad" },
    category: "mfs",
    description: {
      bn: "নগদ সংক্রান্ত প্রতারণা বা সন্দেহজনক কার্যক্রমের অভিযোগ জানানোর অফিসিয়াল চ্যানেল।",
      en: "Official channel for reporting Nagad-related fraud or suspicious activity.",
    },
    guidance: {
      bn: "নগদ অ্যাপের সাপোর্ট সেকশন ব্যবহার করুন বা নিজে হেল্পলাইনে কল করুন।",
      en: "Use the Nagad app support section or call the helpline yourself.",
    },
    url: "https://www.nagad.com.bd/contact/",
    phone: "16167",
    sourceUrl: "https://www.nagad.com.bd/contact/",
    verifiedAt: SNAPSHOT_VERIFIED_AT,
  },
  {
    key: "bangladesh-bank",
    name: { bn: "বাংলাদেশ ব্যাংক", en: "Bangladesh Bank" },
    category: "regulator",
    description: {
      bn: "কেন্দ্রীয় ব্যাংকের যোগাযোগ ও অভিযোগ চ্যানেল — ব্যাংক জালিয়াতি ও আর্থিক প্রতারণার অভিযোগ জানাতে।",
      en: "Central bank contact and complaint channel — for banking fraud and financial scam complaints.",
    },
    guidance: {
      bn: "অভিযোগ বাংলাদেশ ব্যাংকের অফিসিয়াল ওয়েবসাইটের যোগাযোগ পাতা থেকে জানান।",
      en: "File complaints via the contact page on Bangladesh Bank's official website.",
    },
    url: "https://www.bb.org.bd/en/index.php/about/contact",
    phone: null,
    sourceUrl: "https://www.bb.org.bd/en/index.php/about/contact",
    verifiedAt: SNAPSHOT_VERIFIED_AT,
  },
  {
    key: "police",
    name: { bn: "বাংলাদেশ পুলিশ", en: "Bangladesh Police" },
    category: "police",
    description: {
      bn: "সাইবার অপরাধসহ যেকোনো অপরাধমূলক ঘটনার অভিযোগ — জরুরি সেবায় ৯৯৯।",
      en: "Report crimes including cybercrime — emergency service 999.",
    },
    guidance: {
      bn: "জরুরি প্রয়োজনে ৯৯৯-এ কল করুন। অভিযোগ বা তথ্যের জন্য police.gov.bd ব্যবহার করুন।",
      en: "Call 999 in emergencies. Use police.gov.bd for complaints and information.",
    },
    url: "https://www.police.gov.bd/",
    phone: "999",
    sourceUrl: "https://www.police.gov.bd/",
    verifiedAt: SNAPSHOT_VERIFIED_AT,
  },
  {
    key: "cirt",
    name: { bn: "বিজিডি ই-গভর্নমেন্ট সিআইআরটি", en: "BGD e-GOV CIRT" },
    category: "cert",
    description: {
      bn: "জাতীয় সাইবার নিরাপত্তা দল — সাইবার ঘটনা, ম্যালওয়্যার, ফিশিং সাইটের অভিযোগ জানানোর চ্যানেল।",
      en: "National cybersecurity team — channel for reporting cyber incidents, malware, and phishing sites.",
    },
    guidance: {
      bn: "cirt.gov.bd-এর ইনসিডেন্ট রিপোর্টিং চ্যানেল ব্যবহার করুন। ফিশিং লিংক পেলে সেখানে জানান।",
      en: "Use the incident reporting channel at cirt.gov.bd. Report phishing links there.",
    },
    url: "https://www.cirt.gov.bd/",
    phone: null,
    sourceUrl: "https://www.cirt.gov.bd/",
    verifiedAt: SNAPSHOT_VERIFIED_AT,
  },
];
