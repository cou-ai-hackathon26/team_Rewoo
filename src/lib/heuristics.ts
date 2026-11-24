// ---------------------------------------------------------------------------
// Deterministic scam-indicator detectors (Agent Harness Module 3) — V3.
// Produces evidence BEFORE the language model runs, so every analysis is
// grounded even if the AI provider is unavailable. Bilingual (BN / Banglish /
// EN) pattern matching. All quotes are expected to be pre-redacted.
//
// V3 upgrades:
//   - Negation guard: a message ADVISING users never to share an OTP is
//     recognized as safety advice, not phishing (acceptance test: benign OTP
//     advisory must yield NO_RISK_INDICATORS).
//   - Family impersonation: kinship address + distress/money request +
//     secrecy → family_impersonation (the "Rahela" pattern), with speaker
//     identity context (who claims to be whom, who is addressed, what is
//     requested).
//   - Speaker identity: impersonation evidence distinguishes a CLAIMED
//     identity inside the message from a descriptive mention.
//   - Extended categories: scholarship, investment, romance, marketplace,
//     account takeover, QR phishing.
// ---------------------------------------------------------------------------

import type { Evidence, RiskCategory, Bilingual, SpeakerContext } from "./types";

export interface HeuristicResult {
  evidence: Evidence[];
  urlAssessment?: UrlAssessment;
  riskCategory: RiskCategory;
  scamCategory: string;
  speaker?: SpeakerContext;
}

// V4 (fix): Bangla keyboards emit DECOMPOSED ya-phala (য + ় = U+09AF U+09BC)
// while authored patterns often use the PRECOMPOSED glyph (য় = U+09DF).
// JS RegExp performs no Unicode normalization, so every pattern containing
// য়/যৌ silently failed on real user input. Normalizing BOTH sides to NFC
// makes matching composition-independent. Same for the input text (see
// detectScamIndicators).
const RX = (parts: string[], flags = "i") =>
  new RegExp(parts.map((p) => p.normalize("NFC")).join("|"), flags);

// --- keyword groups ---------------------------------------------------------

const OTP_WORDS = RX([
  "otp", "ওটিপি", "ও\\.টি\\.পি", "one[\\s-]?time", "verification\\s*code",
  "ভেরিফিকেশন\\s*কোড", "ভেরিফিকেশন\\s*কড", "কনফার্মেশন\\s*কোড", "সিক্রেট\\s*কোড",
  "\\bpin\\b", "পিন\\s*নম্বর", "পিন\\s*কোড", "\\bpin\\s*number", "পাসওয়ার্ড", "password",
  "পিন(?:টা|টি|টো)?\\s*(?:বল|দাও|দিন|দিয়ে)", "পিন\\s*দিয়ে\\s*দিন", "পিন\\s*দিয়ে",
  "pin\\s*diye", "pin\\s*die\\b", "pin\\s*dia", "ওটিপি(?:টা|টি)?\\s*(?:বল|দাও|দিন)",
]);

const REQUEST_VERBS = RX([
  "দিন", "দিয়ে\\s*দিন", "পাঠান", "পাঠিয়ে\\s*দিন", "বলুন", "জানান", "শেয়ার\\s*কর",
  "share", "send", "tell\\s*(?:me|us)", "provide", "confirm\\s*কর", "কনফার্ম\\s*কর", "দাও", "পাঠাও", "বলো",
  "diben", "diye\\s*diben", "bolun", "bolen", "rakhen", "pathan", "pathiyen", "dao\\b",
]);

// V3: advisory / negation framing. When these appear in the SAME SENTENCE as
// an OTP-request match, the sentence is safety ADVICE, not a scam request.
const ADVISORY_FRAMING = RX([
  // V4: targeted advisory forms only — generic "verb+না" was intentionally
  // NOT added because scam texts can include pressure negations ("ভুল করবেন না").
  "শেয়ার\\s*কর(?:বেন|ব|তে)\\s*না", "কারও\\s*সাথে\\s*(?:শেয়ার|দিতে)\\s*না",
  "দিতে\\s*পারবেন\\s*না", "পাঠাতে\\s*পারবেন\\s*না",
  // V4: quoted-scam education & institution-behavior education
  "চায়\\s*না", "চাইবে\\s*না", "প্রতারক", "প্রতারণা", "প্রতার", "মনে\\s*রাখ(?:ুন|বেন)",
  "সচেতনতা", "চেতনা(?:-?পাঠ)?", "সচেতন\\s*হোন", "জানিয়ে\\s*দিন",
  "scammer", "awareness", "never\\s+ask", "banks?\\s+never", "does\\s+n[o']t\\s+(?:ask|call|contact)",
  "দেবেন\\s*না", "দিবেন\\s*না", "দেওয়া\\s*নিষেধ", "দেওয়া\\s*যাবে\\s*না", "দেব\\s*না", "দিয়ো\\s*না",
  "কখনোই?\\s*না", "কখনো\\s*না", "না\\s*দিয়ে", "নিষেধ", "সাবধান", "সতর্ক", "বিরত\\s*থাক",
  "শেয়ার\\s*করবেন\\s*না", "শেয়ার\\s*করা\\s*নিষেধ", "চাইলেই\\s*দেবেন\\s*না", "দেখতে\\s*দেবেন\\s*না",
  "গোপন\\s*রাখ", "কারও\\s*সাথে\\s*শেয়ার", "কাউকে\\s*দেবেন\\s*না", "কেউ\\s*জানলে\\s*না", "কেউ\\s*জানবে\\s*না",
  "never\\s+(?:share|give|send|disclose)", "do\\s*n[o']t\\s+(?:share|give|send|disclose)",
  "don't\\s+(?:share|give|send|disclose)", "avoid\\s+sharing", "keep\\s+(?:it\\s+)?(?:secret|private)",
  "beware", "warning", "সতর্কতা", "সতর্ক\\s*হোন", "জানিয়ে\\s*রাখুন", "মনে\\s*রাখুন", "জরুরি\\s*তথ্য",
  "প্রচার\\s*কর", "সবাইকে\\s*জানান", "share\\s+this", "forward\\s+this", "পরিবারের\\s*সবাইকে",
]);

const URGENCY_WORDS = RX([
  "এখনই", "এখুনি", "তাড়াতাড়ি", "অবিলম্বে", "সাথে\\s*সাথে", "সঙ্গে\\s*সঙ্গে", "শেষ\\s*সুযোগ",
  "সাথে\\s*সাথেই", "আর\\s*দেরি\\s*নয়", "urgent", "immediately", "right\\s*now", "asap",
  "মিনিটের\\s*মধ্যে", "ঘণ্টার\\s*মধ্যে", "last\\s*warning", "অবহেলা\\s*করলে", "দেরি\\s*করলে",
  "সাথে\\s*সাথে\\s*না\\s*দিলে", "না\\s*দিলে\\s*(তোমার|আপনার)",
  "nahole", "within\\s*\\d+\\s*(?:hours|minutes|days|day|hour)", "\\d+\\s*hours", "last\\s*chance",
  "ghontar\\s*moddhe", "minit(?:er)?\\s*moddhe", "আজই", "শেষ\\s*সুযোগ\\s*হতে\\s*পারে",
]);

const OFFICIAL_NAMES = RX([
  "bkash", "b-kash", "বিকাশ", "nagad", "নগদ", "rocket", "রকেট", "upay", "উপায়",
  "বাংলাদেশ\\s*ব্যাংক", "bangladesh\\s*bank", "sonali\\s*bank", "সোনালী\\s*ব্যাংক",
  "janata\\s*bank", "জনতা\\s*ব্যাংক", "agrani\\s*bank", "অগ্রণী\\s*ব্যাংক", "rupali",
  "রূপালী\\s*ব্যাংক", "dbbl", "dutch\\s*-?\\s?bangla", "ডাচ্\\s*বাংলা", "ইসলামী\\s*ব্যাংক",
  "city\\s*bank", "সিটি\\s*ব্যাংক", "brac\\s*bank", "ব্র্যাক\\s*ব্যাংক", "পুলিশ", "police",
  "সাইবার\\s*ট্রিব্যুনাল", "cirt", "সিআইআরটি", "গোয়েন্দা", "dbI", "rabi", "rabi\\s*wallet",
  "সরকার", "সরকারি", "govt", "government", "ডাকঘর", "স্বাস্থ্য\\s*অধিদপ্তর", "dghs",
  "বিআরটিসিএ", "btrc", "নির্বাচন\\s*কমিশন", "e-governance", "ই-গভর্নেন্স", "ebdc", "bank\\s*asia",
  "\\bnid\\b", "জাতি\\s*পরিচয়পত্র", "জাতীয়\\s*পরিচয়পত্র", "জাতীয়\\s*আইডি", "national\\s*id", "জন্ম\\s*নিবন্ধন",
  "eastern\\s*bank", "ebl\\b", "teletalk", "টেলিটক", "bcs\\s*tele", "city\\s*bank\\s*লিমিটেড",
  "মন্ত্রণালয়", "শিক্ষা\\s*মন্ত্রণালয়", "শিক্ষা\\s*বোর্ড", "ministry", "education\\s*board",
]);

// V4 (fix): a mere MENTION of an institution ("কাল বিকাশে টাকা পাঠাবো") is
// not impersonation. The detector now requires a claimed-identity context
// near the institution name (আমি/টিম/থেকে/এজেন্ট...).
const IDENTITY_CLAIMS = RX([
  "আমি", "আমরা", "ইনি", "এই\\s*আমি", "টিম", "থেকে(?:\\s*এসেছি|\\s*পাঠানো)?",
  "পক্ষ(?: থেকে| হইতে)?", "এজেন্ট", "স্টাফ", "প্রতিনিধি", "অফিসার", "ম্যানেজার",
  "বলছি", "বলছে", "বল(?:ে|া)\\s*হচ্ছে", "হতে\\s*পাঠানো", "সাইড\\s*থেকে",
  "i\\s*am", "we\\s*are", "calling\\s*from", "on\\s*behalf", "\\bteam\\b", "\\bagent\\b", "\\bofficer\\b",
  "theke\\s*bolchi", "ami\\s*bolchi", "head\\s*office", "হেড\\s*অফিস(?:ে)?",
  "(?:dear|প্রিয়)\\s*(?:valued\\s*)?(?:customer|গ্রাহক)",
]);

// V4 (fix): "বৃত্তি পরীক্ষার নোটিশ" is a legitimate school notice. The
// scholarship lure must appear with application/fee/winner context.
const SCHOLARSHIP_CONTEXT = RX([
  "আবেদন", "ফরম", "ফি", "অগ্রিম", "টাকা", "জমা", "লিংক", "ক্লিক", "যোগাযোগ",
  "বিজয়ী", "পেয়েছেন", "কনফার্ম", "রেজিস্ট্রেশন", "apply", "\\bfee\\b", "\\blink\\b",
  "winner", "won", "deposit", "\\bcash\\b",
]);

const THREAT_WORDS = RX([
  "গ্রেপ্তার", "হুকুম\\s*দেওয়া\\s*হবে", "মামলা", "আদালত", "চার্জশিট", "সিম\\s*বন্ধ",
  "নম্বর\\s*বন্ধ", "ওয়ারেন্ট", "গুম", "নাম\\s*কেটে\\s*দেওয়া", "অভিযোগ\\s*দেওয়া\\s*হবে",
  "আটক\\s*করা\\s*হবে", "legal\\s*action", "arrest", "warrant", "case\\s*against",
  "number\\s*will\\s*be\\s*(?:blocked|closed)", "তোমাকে\\s*গ্রেপ্তার", "আপনাকে\\s*গ্রেপ্তার",
  // V4: sextortion — recorded/private-video blackmail
  "hacked\\s+(?:your|the)", "recorded\\s+(?:private|your|videos)", "private\\s+video",
  "send\\s+everything", "will\\s+send\\s+(?:everything|this|it)", "সবাইকে\\s*পাঠিয়ে",
  "সব\\s*পরিবারকে", "sobaike?\\s*(?:pathiye|pathabo|pathi)", "sob\\s*family", "viral\\s*(?:kor|kore)",
  "ভাইরাল\\s*(?:কর|হবে)", "ফাঁস\\s*কর(?:ে|ব)",
]);

const MONEY_WORDS = RX([
  "send\\s*money", "ক্যাশ\\s*আউট", "উত্তোলন", "টাকা\\s*পাঠান", "টাকা\\s*দিন",
  "পার্সোনাল\\s*(?:নম্বর|নাম্বার)", "personal\\s*number",
  "(?:নম্বর|নাম্বার)\\s*মোবাইল\\s*রিচার্জ", "মোবাইল\\s*রিচার্জ",
  "\\bরিচার্জ\\s*(?:কর|দাও|দিন)", "(?:নম্বর|নাম্বারে)\\s*রিচার্জ", "টাকা\\s*রিচার্জ",
  "পেমেন্ট\\s*কর", "pay\\s*(?:now|us|the)", "টাকা\\s*লাগবে",
  "অ্যাডভান্স", "advance\\s*(?:payment|fee)", "সেন্ড\\s*মানি", "ক্যাশ\\s*আউট\\s*কর",
  "টাকা\\s*পাঠাও", "টাকা\\s*পাঠিয়ে\\s*দাও",
  "টাকা\\s*পাঠানো\\s*হবে", "(?:নম্বর|নাম্বারে)\\s*টাকা\\s*পাঠান",
  "টাকা\\s*(?:বিকাশ|নগদ|রকেট|উপায়)\\s*কর", "(?:বিকাশ|নগদ|রকেট)\\s*কর(?:ুন|ন|ও|ে\\s*দাও)",
  "টাকা\\s*লেনদেন", "(\\d{3,})\\s*টাকা\\s*(?:বিকাশ|নগদ|পাঠান|দিন)",
  "taka\\s*patha(?:o|n|ben|iyen)", "hazar\\s*taka", "hajar\\s*taka", "taka\\s*dao",
  "(?:send|pay)\\s*[\\d,]{3,}\\s*(?:taka|tk)", "\\d{3,}\\s*(?:taka|tk)\\s*patha",
]);

// V4: classic cash-out scam phrasing — a STRANGER asking you to cash out to
// their "personal number" is nearly always a misappropriation attempt.
const CASHOUT_WORDS = RX([
  "ক্যাশ\\s*আউট\\s*করে\\s*দ(?:িন|াও|েন)",
  "পার্সোনাল\\s*(?:নম্বর|নাম্বারে)\\s*ক্যাশ\\s*আউট",
  "আমার\\s*(?:নম্বর|নাম্বারে)\\s*ক্যাশ\\s*আউট",
  "নিজের\\s*(?:নম্বর|নাম্বার)\\s*থেকে\\s*ক্যাশ\\s*আউট",
]);

// V4: guaranteed / multiplied-return promises (investment fraud hallmark).
const RETURN_WORDS = RX([
  "দ্বিগুণ", "তিন\\s*গুণ", "ডাবল\\s*(?:হবে|রিটার্ন|মানি)", "দ্বিগুণ\\s*ফেরত",
  "গ্যারান্টি", "guaranteed", "নিশ্চিত\\s*(?:লাভ|ফেরত)", "হাল\\s*হাল\\s*মুনাফা",
  "লাভ\\s*নিশ্চিত", "প্রতিদিন\\s*ইনকাম",
]);

// V4: "claim your prize" contact instructions — prize + contact = classic.
const CONTACT_WORDS = RX([
  "(?:কল|ফোন)\\s*কর(?:ুন|ন|তে)\\s*হবে", "এই\\s*(?:নম্বর|নাম্বারে)\\s*(?:কল|ফোন)",
  "এসএমএস\\s*কর(?:ুন|ন)", "এস\\.?এম\\.?এস", "sms\\s*(?:now|us)", "whatsapp\\s*কর",
  "টেলিগ্রাম", "telegram", "click\\s+(?:this|the)\\s+link", "এই\\s*লিংকে\\s*ক্লিক",
  "লিংকে\\s*(?:ক্লিক|গিয়ে)", "যোগাযোগ\\s*কর(?:ুন|ন)", "call\\s*(?:now|this)",
  "(?:নম্বর|নাম্বার)(?:ে|তে)?\\s*(?:কল|মেসেজ|এসএমএস)",
  "নম্বর(?:ে|তে)\\s*(?:কল|ফোন)",
]);

// V4: 419 / inheritance scams — war widow, deceased husband, dollar transfer.
const INHERITANCE_WORDS = RX([
  "বিধবা", "উত্তরাধিকার", "মৃত\\s*(?:স্বামী|স্ত্রী|পিতা)", "মৃত\\s*স্বামীর",
  "মিলিয়ন\\s*(?:ডলার|ডালার|dollar)", "million\\s*dollar", "war\\s*widow",
  "ডলার\\s*(?:ট্রান্সফার|পাঠাতে)", "ডলার\\s*আপনার", "উইল\\s*করে", "unclaimed\\s*fund",
  "অসুরক্ষিত\\s*তহবিল",
]);

// V4: referral / bonus-app income lures (ponzi-app sign-up scams).
const REFERRAL_WORDS = RX([
  "রেফার", "referral", "বোনাস", "bonus", "ফ্রেন্ড\\s*আন(?:লে|লেই)",
  "ইনভাইট\\s*কর(?:লে|লেই)", "sign\\s*up\\s*bonus", "রেজিস্টার\\s*কর(?:লে|লেই)",
  "সাইন\\s*আপ\\s*কর(?:লে|লেই)", "প্রতি\\s*রেফারে", "ক্যাশব্যাক\\s*পাবেন",
  "ফরওয়ার্ড\\s*কর(?:ুন|ন)", "forward\\s*(?:this|to)", "ফ্রেন্ডকে",
]);

// V4: income-claim words used together with referral/job lures.
const INCOME_WORDS = RX([
  "ইনকাম", "আয়\\s*কর", "প্রতিদিন\\s*(?:টাকা|income)", "ক্যাশব্যাক", "cashback",
  "earning", "ঘরে\\s*বসে", "বসে\\s*বসে", "লাইক\\s*কর(?:লে|ে)", "ভিডিও\\s*দেখ(?:লে|ে)",
  "captcha\\s*ফিল", "মাসে\\s*\\d+\\s*হাজার",
]);

// V4: matrimony scams — bogus bride/groom listings that ask for fees.
const MATRIMONY_WORDS = RX([
  "রকম\\s*হয়েছে", "রকম\\s*হইছে", "বিয়ের\\s*জন্য", "পাত্র\\s*দেখ", "পাত্রী\\s*দেখ",
  "বিয়ের\\s*প্রস্তাব", "মুরুব্বি\\s*দেখা", "matrimony",
]);

const PRIZE_WORDS = RX([
  "লটারি", "জিতেছেন", "জিতে\\s*গেছেন", "বিজয়ী", "পুরস্কার", "প্রাইজ", "lottery",
  "you\\s*(?:have\\s*)?won", "prize", "winner", "ক্যাশব্যাক\\s*জিতে", "gift\\s*পেয়েছেন",
  "বোনাস\\s*পেয়েছেন", "কুপন\\s*জিতেছেন", "লাকি\\s*ড্র", "lucky\\s*draw",
  "নির্বাচিত\\s*হয়েছে", "ভাউচার", "voucher", "নির্বাচিত", "selected",
]);

const FEE_WORDS = RX([
  "রেজিস্ট্রেশন\\s*ফি", "প্রসেসিং\\s*ফি", "processing\\s*fee", "registration\\s*fee",
  "কমিশন\\s*দিতে\\s*হবে", "ফি\\s*দিতে\\s*হবে", "ফর্ম\\s*ফিলাপ\\s*টাকা", "সার্ভিস\\s*চার্জ\\s*পাঠান",
  "ডেলিভারি\\s*চার্জ", "কুরিয়ার\\s*চার্জ", "unlock\\s*fee", "claim\\s*fee", "টাকা\\s*পাঠালে\\s*পাবেন",
]);

const JOB_WORDS = RX([
  "চাকরি", "চাকুরি", "নিয়োগ\\s*বিজ্ঞপ্তি", "job\\s*offer", "part[\\s-]?time\\s*job",
  "অফিস\\s*সহায়ক", "ডাটা\\s*এন্ট্রি", "data\\s*entry", "টাইপিং\\s*জব", "typing\\s*job",
  "form\\s*filling", "ফর্ম\\s*ফিল", "বেতন\\s*মাসে", "salary", "লাইভ\\s*চাকরি", "ভাইসা\\s*চাকরি",
  "ভিসা\\s*চাকরি", "বিদেশে\\s*চাকরি", "দুবাই\\s*চাকরি", "সৌদি\\s*চাকরি", "মালয়েশিয়া\\s*চাকরি",
  "work\\s*permit", "ওয়ার্ক\\s*পার্মিট", "বিদেশযাত্রা", "ভিসা\\s*ফি",
  "ঘরে\\s*বসে", "অনলাইন(?:ে)?\\s*বসে", "পার্ট\\s*টাইম", "part[\\s-]?time", "অনলাইন\\s*ইনকাম",
  "লাইক\\s*কর(?:লে|ে)", "ভিডিও\\s*দেখ(?:লে|ে)", "captcha", "ক্যাপচা",
  "মাসে\\s*\\d+\\s*হাজার", "বেতন\\s*\\d+\\s*হাজার", "সাইন\\s*আপ\\s*বোনাস",
  "work\\s*from\\s*home", "online\\s*job", "job\\s*opportunit", "online\\s*income",
  "liking\\s+(?:youtube|facebook|tiktok)", "daily\\s*\\d+\\s*(?:taka|\\$)", "earn\\s+\\d",
]);

// V3: scholarship / education fraud
const SCHOLARSHIP_WORDS = RX([
  "বৃত্তি", "স্কলারশিপ", "scholarship", "শিক্ষা\\s*বৃত্তি", "অনলাইন\\s*বৃত্তি",
  "ভর্তি\\s*ফি", "টিউশন\\s*ফি\\s*ছাড়", "শিক্ষা\\s*ঋণ", "বিশ্ববিদ্যালয়ে\\s*ভর্তি",
  "কোটা\\s*ভর্তি", "মেধা\\s*বৃত্তি", "পুরস্কার\\s*টাকা\\s*শিক্ষা",
  "study\\s*abroad", "স্টাডি\\s*অ্যাব্রড", "বিদেশে\\s*পড়াশোনা",
]);

// V3: investment fraud (separate from romance)
const INVESTMENT_WORDS = RX([
  "বিনিয়োগ", "ইনভেস্ট", "invest", "মার্কেটে\\s*লগ\\s*কর", "trading", "ফরেক্স", "forex",
  "প্রফিট\\s*ডাবল", "guaranteed\\s*return", "নিশ্চিত\\s*লাভ", "লাভ\\s*নিশ্চিত",
  "দ্বিগুণ\\s*টাকা", "ডাবল\\s*হবে", "roi", "আপনার\\s*টাকা\\s*বাড়বে", "প্যাসিভ\\s*ইনকাম",
  "crypto", "ক্রিপ্টো", "usdt", "binance\\s*প্রফিট", "টাকা\\s*বিনিয়োগ\\s*কর",
  "শেয়ার\\s*মার্কেটে\\s*লাভ", "সুদ\\s*মাসে\\s*মাসে", "চান্দি\\s*মাসে",
]);

const REMOTE_WORDS = RX([
  "anydesk", "team\\s*viewer", "teamviewer", "স্ক্রিন\\s*শেয়ার", "screen\\s*share",
  "screen\\s*sharing", "এই\\s*অ্যাপটি\\s*ইনস্টল", "অ্যাপ\\s*ডাউনলোড\\s*করুন", "apk\\s*ডাউনলোড",
  "download\\s*this\\s*app", "install\\s*the\\s*app", "লিংকে\\s*ক্লিক\\s*করে\\s*অ্যাপ",
  "settings\\s*এ\\s*যান", "সেটিংসে\\s*যান", "access\\s*code", "রিমোট",
]);

const NEW_NUMBER_WORDS = RX([
  "নতুন\\s*নম্বর", "এই\\s*নম্বরটি\\s*সেভ", "নম্বরটা\\s*সেভ\\s*কর", "save\\s*this\\s*number",
  "আমার\\s*ফোন\\s*হারিয়ে\\s*গেছে", "পুরনো\\s*নম্বরটি\\s*বন্ধ", "old\\s*number\\s*(?:is\\s*)?(?:lost|closed)",
  "এখন\\s*থেকে\\s*এই\\s*নম্বরে", "আমি\\s*তোমার\\s*(?:ভাই|বোন|মামা|চাচা|বন্ধু)",
  "i\\s*am\\s*your", "আমি\\s*(?:তোমার|আপনার)\\s*(?:ভাই|বোন|মামা|চাচা)",
]);

// V3: family impersonation — kinship address + distress/money + secrecy.
const KINSHIP_ADDRESS = RX([
  "মা\\b", "আম্মু", "আম্মা", "আব্বু", "আব্বা", "বাবা", "ভাই\\b", "ভাইয়া", "আপু", "দিদি",
  "মামা", "চাচা", "চাচী", "খালা", "খালু", "ফুফু", "ভাবী", "শালি", "ননদ",
  "ছেলে", "মেয়ে", "বেটা", "বেটি", "son", "mom", "mum", "mother", "dad", "father", "brother", "sister",
  // Banglish (romanized) kinship
  "\\bmama\\b", "\\babbu\\b", "\\bammu\\b", "\\bamma\\b", "\\bbhai\\b", "\\bbhaiya\\b", "\\bapu\\b", "\\bdidi\\b",
  "\\bchacha\\b", "\\bbaba\\b", "\\bmaa\\b", "\\bchele\\b", "\\bmeye\\b",
]);

const KINSHIP_CLAIM = RX([
  "আমি\\s*তোমার\\s*(?:ছেলে|ভাই|ভাইয়া|বোন|আপু|মামা|চাচা|খালা|বন্ধু)",
  "এই\\s*দিকে\\s*(?:তোমার|আপনার)\\s*(?:ছেলে|ভাই|বোন)",
  "আমি\\s*(?:তোমার|আপনার)\\s*ছেলে\\s*বলছি", "তোমার\\s*ছেলে\\s*বলছি",
  "আমি\\s*তোমার\\s*(?:son|brother)", "এটা\\s*(?:আমি|তোমার)\\s*ছেলে",
]);

const DISTRESS_WORDS = RX([
  "বিপদে\\s*পড়েছি", "বিপদ", "দুর্ঘটনা", "হাসপাতালে", "হাসপাতাল", "গ্রেপ্তার\\s*হয়েছি",
  "থানায়", "জেলে", "মারধোর", "অপহরণ", "কান্না", "কাঁদছি", "কাঁদতে\\s*কাঁদতে",
  "সাহায্য\\s*কর", "বাঁচাও", "জরুরি\\s*ভিত্তিতে", "প্রাণ\\s*বিপদা", "পুলিশে\\s*ধরেছে",
  "ছেলেটা\\s*অসুস্থ", "অসুস্থ", "i\\s*am\\s*in\\s*(?:trouble|danger|hospital)", "help\\s*me\\s*mom",
  // Banglish / romanized distress
  "\\bbipode\\b", "\\bbipod\\b", "\\bdanger\\b", "\\baccident\\b", "\\bhospital\\b",
  "\\bthana\\b", "\\bjela\\b", "\\bkando\\b",
]);

const SECRECY_WORDS = RX([
  "কাউকে\\s*বলো\\s*না", "কাউকে\\s*বলিস\\s*না", "কাউকে\\s*বলবে\\s*না", "কাউকে\\s*জানিও\\s*না",
  "কাউকে\\s*জানাবে\\s*না", "কাউকে\\s*কিছু\\s*বলো\\s*না", "গোপন\\s*রাখ", "পরে\\s*জানাবো",
  "কথাটা\\s*ফাঁস\\s*কর", "একা\\s*এসো", "don't\\s*tell\\s*(?:anyone|mom|anybody)",
  "tell\\s*no\\s*one", "keep\\s*this\\s*(?:secret|between)",
  // Banglish secrecy
  "kauke\\s*(?:bolo|bolbo|bolen|bolis|janio|janabe)\\s*na",
  "keu\\s*jane\\s*na",
]);

const INJECTION_WORDS = RX([
  "ignore\\s+(?:all\\s+)?(?:previous|prior|above)\\s+instructions",
  "disregard\\s+(?:all\\s+)?(?:previous|prior)\\s+instructions",
  "system\\s*prompt", "you\\s+are\\s+now", "নতুন\\s+নির্দেশনা", "আগের\\s+নির্দেশনা\\s*উপেক্ষা",
  "forget\\s+(?:everything|your\\s+instructions)", "developer\\s+mode", "jailbreak",
]);

const EMOTION_WORDS = RX([
  "ভালোবাসি", "বিশ্বাস\\s*করুন", "বিশ্বাস\\s*কর", "trust\\s*me", "আপনার\\s*ভালোর\\s*জন্য",
  "আমি\\s*ক্ষতি\\s*করব\\s*না", "কথা\\s*দিচ্ছি", "i\\s*promise", "দোয়া\\s*করবেন", "please\\s*bhai",
  "ভাইয়া\\s*বিশ্বাস\\s*করুন",
]);

const PARCEL_WORDS = RX([
  "পার্সেল", "কুরিয়ার", "শার্টের\\s*প্যাকেট", "courier", "parcel", "ডেলিভারি\\s*ম্যান",
  "প্যাকেজ\\s*এসেছে", "সানগ্লাস", "ঘড়ি\\s*প্যাকেট", "gift\\s*প্যাকেট", "শপিং\\s*করেছেন",
]);

const SHOPPING_WORDS = RX([
  "অর্ডার\\s*কনফার্ম", "অর্ডার\\s*কর", "বুক\\s*করা", "ক্যাশ\\s*অন\\s*ডেলিভারি",
  "cash\\s*on\\s*delivery", "cod", "ডিসকাউন্ট\\s*অফার", "ফেসবুক\\s*পেজ\\s*থেকে",
  "half\\s*price", "অর্ধেক\\s*দামে", "শুধু\\s*আজ", "আজই\\s*শেষ\\s*দিন",
]);

const LOAN_WORDS = RX([
  "লোন", "ঋণ", "loan", "তাৎক্ষণিক\\s*লোন", "instant\\s*loan", "E\\s*মিনিটে\\s*লোন",
  "ক্রেডিট\\s*স্কোর\\s*ছাড়া", "no\\s*credit\\s*check", "লোন\\s*সহজ\\s*শর্তে",
]);

const ROMANCE_WORDS = RX([
  "বিদেশে\\s*আছি", "বিয়ের\\s*প্রস্তাব", "প্রেম\\s*করি", "marry\\s*you",
  "প্রেম\\s*করি\\s*তোমাকে", "ভালোবাসি\\s*তোমাকে", "গার্লফ্রেন্ড", "বয়ফ্রেন্ড",
  "পরিচিত\\s*হই", "চ্যাট\\s*করি\\s*কিছুদিন", "সম্পর্কে\\s*আসা",
]);

// V3: account takeover — credential harvest / account change instructions
const ACCOUNT_TAKEOVER_WORDS = RX([
  "একাউন্টের\\s*পাসওয়ার্ড\\s*বদল", "পাসওয়ার্ড\\s*দিয়ে\\s*দাও", "আপনার\\s*লগইন\\s*দাও",
  "আইডি\\s*পাসওয়ার্ড\\s*চাই", "একাউন্ট\\s*ভেরিফাই\\s*করতে\\s*লগইন",
  "sim\\s*swap", "সিম\\s*বদলানো", "নম্বর\\s*ট্রান্সফার", "নম্বরের\\s*ওনারশিপ\\s*চেঞ্জ",
  "your\\s*login", "account\\s*password", "sign\\s*in\\s*with\\s*your\\s*credentials",
  "গুগল\\s*ভেরিফিকেশন\\s*কোড\\s*দাও", "জিমেইল\\s*কোড",
]);

// V3: QR phishing — QR-based payment/app tricks
const QR_PHISHING_WORDS = RX([
  "কিউআর\\s*স্ক্যান\\s*কর", "qr\\s*scan", "কিউ\\s*আর\\s*কোডে\\s*টাকা",
  "স্ক্যান\\s*করে\\s*পেমেন্ট", "কিউআর\\s*দিয়ে\\s*পেমেন্ট\\s*কর", "qr\\s*payment",
  "স্ক্যান\\s*করলেই\\s*ক্যাশব্যাক", "বিকাশ\\s*কিউআর\\s*স্ক্যান", "নগদ\\s*কিউআর",
]);

// --- URL reputation ---------------------------------------------------------

const SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "rb.gy", "shorturl.at",
  "rebrand.ly", "tiny.cc", "ow.ly", "buff.ly", "goo.gl", "s.id", "linktr.ee/redirect",
];

const BRAND_TOKENS = [
  "bkash", "nagad", "rocket", "dbbl", "bangladeshbank", "police", "btrc", "sonali",
  "janata", "agrani", "rupali", "islamibank", "bracbank", "citybank",
  "ebl", "easternbank", "teletalk", "trustbank", "mtb", "ucb", "primebank",
];

const OFFICIAL_DOMAINS = [
  "bkash.com", "nagad.com.bd", "rocketbd.com.bd", "dbbl.com", "bb.org.bd",
  "police.gov.bd", "cirt.gov.bd", "btrc.gov.bd", "sonalibank.com.bd",
];

const CRED_WORDS_IN_PATH = RX([
  "login", "signin", "verify", "verification", "otp", "kyc", "update", "account",
  "password", "confirm", "secure", "auth", "wallet", "unlimited", "gift", "reward", "claim",
]);

const SUSPICIOUS_TLDS = ["xyz", "top", "club", "online", "site", "buzz", "icu", "cfd", "rest", "shop", "win", "live", "click", "space", "website"];

export interface UrlAssessment {
  input: string;
  normalized: string;
  host: string;
  href: string | null;
  properties: Evidence[];
  risk: "high" | "moderate" | "low";
}

export function analyzeUrl(raw: string, keyPrefix = "E"): { assessment: UrlAssessment; nextKey: () => string } {
  let keyN = 1;
  const nextKey = () => `${keyPrefix}${keyN++}`;
  const props: Evidence[] = [];
  const input = raw.trim();

  let url: URL | null = null;
  let normalized = input;
  try {
    normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    url = new URL(normalized);
  } catch {
    url = null;
  }

  if (!url) {
    props.push({
      key: nextKey(),
      kind: "url_property",
      quote: input.slice(0, 120),
      interpretation: {
        bn: "এটি একটি বৈধ ওয়েব ঠিকানা নয় — লিঙ্কটি ভাঙা বা ইচ্ছাকৃতভাবে বিকৃত।",
        en: "This is not a valid web address — the link is broken or deliberately obfuscated.",
      },
      tactic: "obfuscation",
      source: "heuristic:url-invalid",
      weight: "moderate",
    });
    return { assessment: { input, normalized, host: "", href: null, properties: props, risk: "moderate" }, nextKey };
  }

  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  const domain = labels.slice(-2).join(".");
  const subdomain = labels.slice(0, -2).join(".");
  let risk: "high" | "moderate" | "low" = "low";

  // Punycode — almost always brand spoofing
  if (host.includes("xn--")) {
    props.push(mkUrlProp(nextKey(), host, {
      bn: "ঠিকানাটিতে punycode (xn--) আছে — এটি প্রায় সবসময় পরিচিত ব্র্যান্ডের নাম নকল করার কৌশল।",
      en: "The address uses punycode (xn--) — almost always used to imitate a well-known brand.",
    }, "lookalike_domain", "strong"));
    risk = "high";
  }

  // IP host
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    props.push(mkUrlProp(nextKey(), host, {
      bn: "লিংকটি সরাসরি একটি আইপি ঠিকানায় যায় — বৈধ আর্থিক প্রতিষ্ঠান কখনোই এমন ঠিকানা ব্যবহার করে না।",
      en: "The link points directly to a raw IP address — legitimate financial services never do this.",
    }, "ip_host", "strong"));
    risk = "high";
  }

  // Shortener
  if (SHORTENERS.includes(domain)) {
    props.push(mkUrlProp(nextKey(), domain, {
      bn: "এটি একটি লিংক সংক্ষেপকারী (shortener) — চূড়ান্ত গন্তব্য আড়াল করা আছে, তাই আগে দেখে নেওয়া যাচ্ছে না।",
      en: "This is a URL shortener — the true destination is hidden and cannot be pre-inspected safely.",
    }, "shortener", "moderate"));
    if (risk === "low") risk = "moderate";
  }

  // Brand lookalike in subdomain or domain but not the official domain
  const brandHit = BRAND_TOKENS.find((b) => host.replace(/-/g, "").includes(b));
  const isOfficial = OFFICIAL_DOMAINS.includes(domain) || (domain === "com.bd" && OFFICIAL_DOMAINS.includes(labels.slice(-3).join(".")));
  if (brandHit && !isOfficial) {
    props.push(mkUrlProp(nextKey(), host, {
      bn: `ঠিকানাটিতে “${brandHit}” নামটি আছে, কিন্তু এটি ${brandHit} এর অফিসিয়াল ডোমেইন নয় — ব্র্যান্ডের ছদ্মবেশ হতে পারে।`,
      en: `The address contains “${brandHit}” but is not the official ${brandHit} domain — possible brand impersonation.`,
    }, "lookalike_domain", "strong"));
    risk = "high";
  }

  // Credential keywords in path
  const pathWords = CRED_WORDS_IN_PATH.test(`${url.pathname} ${url.search}`);
  if (pathWords) {
    props.push(mkUrlProp(nextKey(), `${url.pathname}${url.search}`.slice(0, 100), {
      bn: "লিংকের পথে লগইন/ভেরিফিকেশন/OTP-এর মতো শব্দ আছে — শংসাপত্র বা কোড চাওয়ার পৃষ্ঠা হতে পারে।",
      en: "The link path contains login/verification/OTP-type words — likely a credential or code harvesting page.",
    }, "credential_path", "moderate"));
    if (risk === "low") risk = "moderate";
  }

  // Suspicious TLD
  const tld = labels[labels.length - 1];
  if (SUSPICIOUS_TLDS.includes(tld)) {
    props.push(mkUrlProp(nextKey(), domain, {
      bn: "অস্বাভাবিক টপ-লেভেল ডোমেইন (.xyz/.top জাতীয়) — স্বল্পমেয়াদি প্রতারণা সাইটে এগুলো বেশি দেখা যায়।",
      en: "Unusual top-level domain (.xyz/.top family) — commonly used by short-lived scam sites.",
    }, "suspicious_tld", "moderate"));
    if (risk === "low") risk = "moderate";
  }

  // http (no TLS)
  if (url.protocol === "http:") {
    props.push(mkUrlProp(nextKey(), url.protocol, {
      bn: "লিংকটি এনক্রিপ্টেড নয় (http) — আর্থিক প্রতিষ্ঠানের সাইট সবসময় https ব্যবহার করে।",
      en: "The link is not encrypted (http) — financial service sites always use https.",
    }, "no_tls", "moderate"));
    if (risk === "low") risk = "moderate";
  }

  // Excessive hyphens
  const hyphens = (host.match(/-/g) || []).length;
  if (hyphens >= 2) {
    props.push(mkUrlProp(nextKey(), host, {
      bn: "ডোমেইনে অনেকগুলো হাইফেন আছে — বৈধ প্রতিষ্ঠানের ঠিকানায় এমনটি বিরল।",
      en: "The domain has many hyphens — rare on legitimate institutional addresses.",
    }, "hyphenated_domain", "weak"));
  }

  return { assessment: { input, normalized, host, href: url.href, properties: props, risk }, nextKey };
}

function mkUrlProp(
  key: string,
  quote: string,
  interpretation: Bilingual,
  tactic: string,
  weight: "strong" | "moderate" | "weak"
): Evidence {
  return {
    key,
    kind: "url_property",
    quote: quote.slice(0, 140),
    interpretation,
    tactic,
    source: `heuristic:url-${tactic}`,
    weight,
  };
}

// --- V3: sentence utilities ---------------------------------------------------

/** Split text into sentences (Bengali danda + Latin punctuation). */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[।.!?\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** V4 (fix): raw (untrimmed) split segments so index math stays exact. */
function sentenceSegments(text: string): { start: number; end: number; raw: string; trimmed: string }[] {
  const segs: { start: number; end: number; raw: string; trimmed: string }[] = [];
  let acc = 0;
  for (const raw of text.split(/(?<=[\u0964.!?\n])/)) {
    segs.push({ start: acc, end: acc + raw.length, raw, trimmed: raw.trim() });
    acc += raw.length;
  }
  return segs;
}

/**
 * Negation guard (V3): does the sentence containing `matchIndex` carry
 * advisory/negation framing? A message ADVISING someone never to share an
 * OTP ("ব্যাংক কখনো ওটিপি চায় না — কাউকে দেবেন না") is safety education,
 * not a phishing request. Detectors may override with a narrower pattern
 * (e.g. impersonation only skips when the institution is DESCRIBED, not
 * claimed: "চায় না" framing).
 */
function isAdvisorySentence(text: string, matchIndex: number, matchLength: number, advisoryRx?: RegExp): boolean {
  const rx = advisoryRx ?? ADVISORY_FRAMING;
  // V4 (fix): position math now uses raw (untrimmed) segments — the old
  // implementation trimmed sentences, drifting indices and silently breaking
  // the guard on multi-sentence messages.
  for (const seg of sentenceSegments(text)) {
    if (matchIndex >= seg.start && matchIndex <= seg.end) {
      if (seg.trimmed.length > 0 && rx.test(seg.trimmed)) return true;
    }
  }
  // fallback: window around the match
  const win = text.slice(Math.max(0, matchIndex - 120), matchIndex + matchLength + 120);
  return rx.test(win);
}

// --- text detectors -----------------------------------------------------------

interface DetectorDef {
  id: string;
  pattern: RegExp;
  tactic: string;
  weight: "strong" | "moderate" | "weak";
  interpretation: Bilingual;
  /** V3: if true, the negation guard applies (advisory sentences are skipped). */
  negationGuarded?: boolean;
  /** Narrower advisory pattern for this detector (default: ADVISORY_FRAMING). */
  advisoryRx?: RegExp;
  speaker?: SpeakerContext;
}

const DETECTORS: DetectorDef[] = [
  {
    id: "otp-request",
    pattern: combineNear(OTP_WORDS, REQUEST_VERBS, 60),
    tactic: "otp_request",
    weight: "strong",
    negationGuarded: true,
    interpretation: {
      bn: "বার্তায় ওটিপি/পিন/পাসওয়ার্ড চাওয়া হয়েছে — কোনো বৈধ প্রতিষ্ঠান কখনোই এসব চায় না।",
      en: "The message asks for an OTP/PIN/password — no legitimate institution ever asks for these.",
    },
    speaker: {
      requestedAction: { bn: "ওটিপি/পিন/পাসওয়ার্ড চাওয়া", en: "Requesting an OTP/PIN/password" },
    },
  },
  {
    id: "urgency",
    pattern: URGENCY_WORDS,
    tactic: "urgency",
    weight: "moderate",
    // V4: guarded — advisories say "report immediately", which is education.
    negationGuarded: true,
    interpretation: {
      bn: "অতিরিক্ত তাড়াহুড়ো বা চাপ তৈরি করা হয়েছে — ভুয়া সনাক্তকরণের সময় না দিয়ে দ্রুত সিদ্ধান্ত নিতে বাধ্য করার কৌশল।",
      en: "Extreme urgency or pressure — a tactic to force a quick decision before you can verify.",
    },
  },
  {
    id: "impersonation",
    // V4: institution + claimed-identity context (mere mentions excluded).
    pattern: combineNear(OFFICIAL_NAMES, IDENTITY_CLAIMS, 60),
    tactic: "impersonation",
    weight: "strong",
    // V3 speaker-identity guard: an advisory ABOUT an institution
    // ("ব্যাংক কখনো ওটিপি চায় না") is education, not a claimed identity.
    negationGuarded: true,
    advisoryRx: RX([
      "চায়\\s*না", "কখনোই?\\s*না", "কখনো\\s*না", "চাইবে\\s*না", "না\\s*চায়",
      "never\\s+(?:asks?|calls?|contacts?)", "does\\s*n[o']t\\s+ask",
    ]),
    interpretation: {
      bn: "বার্তায় কোনো পরিচিত সরকারি/আর্থিক প্রতিষ্ঠানের নাম ব্যবহার করা হয়েছে — বার্তাটি যদি সেই প্রতিষ্ঠানের ভান করে আসে, তবে প্রেরকের আসল পরিচয় এখনো যাচাই হয়নি।",
      en: "A well-known government/financial institution is named — if the message claims to come from it, the sender's identity remains unverified.",
    },
    speaker: {
      claimedIdentity: { bn: "পরিচিত সরকারি/আর্থিক প্রতিষ্ঠানের প্রতিনিধি দাবি", en: "Claims to represent a known institution" },
    },
  },
  {
    id: "authority-threat",
    pattern: THREAT_WORDS,
    tactic: "intimidation",
    weight: "strong",
    interpretation: {
      bn: "গ্রেপ্তার, মামলা বা সেবা বন্ধের হুমকি দেওয়া হয়েছে — ভয় দেখিয়ে বশ করার কৌশল।",
      en: "Threats of arrest, legal cases, or service suspension — an intimidation tactic.",
    },
  },
  {
    id: "money-transfer",
    pattern: MONEY_WORDS,
    tactic: "money_request",
    weight: "strong",
    // V4: guarded — legitimate bill reminders say "pay yourself in the app".
    negationGuarded: true,
    advisoryRx: RX([
      "নিজে\\s*(?:অ্যাপ|এপ|অ্যাপে|এপে|থেকে)", "শেষ\\s*তারিখ", "বিল\\s*পরিশোধ", "due\\s*date",
      "bill\\s*(?:is\\s*)?due", "বিদ্যুৎ\\s*বিল", "গ্যাস\\s*বিল", "পানি\\s*বিল", "ইন্টারনেট\\s*বিল",
      "autopay", "স্বয়ংক্রিয়", "রিকারিং", "installment\\s*due", "কিস্তি",
    ]),
    interpretation: {
      bn: "টাকা পাঠানোর অনুরোধ করা হয়েছে — বিশেষত কারও 'পার্সোনাল নম্বর' পাঠানোর বার্তা সর্বদা সন্দেহজনক।",
      en: "A money transfer is requested — especially to a 'personal number', which is always suspicious.",
    },
    speaker: {
      requestedAction: { bn: "টাকা পাঠানোর অনুরোধ", en: "Requesting a money transfer" },
    },
  },
  {
    id: "prize-lottery",
    pattern: PRIZE_WORDS,
    tactic: "false_reward",
    weight: "strong",
    // V4: guarded — quoted-scam education mentions lottery/prize words.
    negationGuarded: true,
    interpretation: {
      bn: "অযাচিত পুরস্কার/লটারি জেতার দাবি — যারা প্রতিযোগিতায় অংশ নেননি, তাদের 'জেতা' প্রায় সবসময়ই প্রতারণা।",
      en: "Unsolicited prize/lottery claims — if you never entered, 'winning' is almost always a scam.",
    },
  },
  {
    id: "job-fee",
    pattern: JOB_WORDS,
    tactic: "fake_job",
    weight: "moderate",
    interpretation: {
      bn: "চাকরি/ভিসার প্রস্তাব দেওয়া হয়েছে — বৈধ নিয়োগকর্তা চাকরি দেওয়ার আগে কখনোই টাকা চায় না, তাই এটি যাচাই করা জরুরি।",
      en: "A job/visa offer is mentioned — legitimate employers never ask for money first, so verify carefully.",
    },
    speaker: {
      claimedIdentity: { bn: "চাকরি দাতা/রিক্রুটার দাবি", en: "Claims to be a recruiter/employer" },
    },
  },
  {
    id: "scholarship",
    // V4: scholarship + application/fee/winner context (school notices excluded).
    pattern: combineNear(SCHOLARSHIP_WORDS, SCHOLARSHIP_CONTEXT, 70),
    tactic: "scholarship_lure",
    weight: "moderate",
    interpretation: {
      bn: "বৃত্তি/শিক্ষা-সুবিধার প্রস্তাব দেওয়া হয়েছে — আবেদন ছাড়া 'নিশ্চিত বৃত্তি' বা আগে ফি চাওয়া প্রস্তাব প্রায় সবসময়ই প্রতারণা।",
      en: "A scholarship/education benefit is offered — 'guaranteed scholarships' without application, or upfront fees, are almost always fraud.",
    },
    speaker: {
      claimedIdentity: { bn: "শিক্ষা প্রতিষ্ঠান/বৃত্তি দাতা দাবি", en: "Claims to represent an educational body" },
    },
  },
  {
    id: "investment",
    pattern: INVESTMENT_WORDS,
    tactic: "investment_lure",
    weight: "moderate",
    interpretation: {
      bn: "বিনিয়োগ করে দ্রুত/নিশ্চিত লাভের প্রস্তাব — 'নিশ্চিত লাভ' বলে টাকা সংগ্রহ করা বাংলাদেশে নিয়ন্ত্রিত ও বেআইনি কার্যক্রম।",
      en: "Fast/guaranteed investment returns are offered — collecting money promising 'guaranteed profit' is unregulated and illegal in Bangladesh.",
    },
  },
  {
    id: "romance",
    pattern: ROMANCE_WORDS,
    tactic: "romance_lure",
    weight: "moderate",
    interpretation: {
      bn: "ঘনিষ্ঠতা/সম্পর্কের প্রস্তাব আছে — অপরিচিত কেউ দ্রুত সম্পর্ক তৈরি করে পরে টাকা চাইলে সেটি প্রেম প্রতারণার প্রচলিত ধরন।",
      en: "Intimacy/relationship talk is present — strangers building quick rapport and later asking for money is the classic romance-scam pattern.",
    },
  },
  {
    id: "account-takeover",
    pattern: ACCOUNT_TAKEOVER_WORDS,
    tactic: "account_takeover",
    weight: "strong",
    interpretation: {
      bn: "লগইন তথ্য, পাসওয়ার্ড বা সিম/নম্বর বদলানোর নির্দেশ চাওয়া হয়েছে — এই তথ্য দিলে আপনার পুরো অ্যাকাউন্ট দখলে চলে যেতে পারে।",
      en: "Login credentials or SIM/number-transfer instructions are requested — sharing these can hand over your entire account.",
    },
  },
  {
    id: "qr-phishing",
    pattern: QR_PHISHING_WORDS,
    tactic: "qr_phishing",
    weight: "strong",
    interpretation: {
      bn: "কিউআর কোড স্ক্যান করে পেমেন্ট/পুরস্কারের কথা বলা হয়েছে — কারও পাঠানো কিউআর স্ক্যান করলে টাকা প্রতারকের কাছে চলে যেতে পারে।",
      en: "You are told to scan a QR for payment/rewards — scanning a stranger's QR can send money straight to a scammer.",
    },
  },
  {
    id: "advance-fee",
    pattern: FEE_WORDS,
    tactic: "advance_fee",
    weight: "strong",
    interpretation: {
      bn: "পুরস্কার/সেবা পেতে আগে ফি বা চার্জ পাঠাতে বলা হয়েছে — অগ্রিম ফি চাওয়া প্রতারণার সুস্পষ্ট লক্ষণ।",
      en: "You are asked to pay a fee first to receive a reward/service — a clear advance-fee scam marker.",
    },
  },
  {
    id: "remote-control",
    pattern: REMOTE_WORDS,
    tactic: "device_control",
    weight: "strong",
    interpretation: {
      bn: "অ্যাপ ইনস্টল, স্ক্রিন শেয়ার বা রিমোট অ্যাক্সেসের কথা বলা হয়েছে — এর মাধ্যমে আপনার অ্যাকাউন্ট সম্পূর্ণ নিয়ন্ত্রণে নেওয়া হতে পারে।",
      en: "App installation, screen sharing or remote access is requested — this can hand full control of your account to a stranger.",
    },
  },
  {
    id: "new-number",
    pattern: NEW_NUMBER_WORDS,
    tactic: "identity_switch",
    weight: "moderate",
    interpretation: {
      bn: "'নতুন নম্বর' বা পরিচিতির ছদ্মবেশ — পরিচিত কারও নামে আসা অচেনা নম্বর আগে যাচাই করা উচিত।",
      en: "A 'new number' or familiar-person pretence — an unknown number claiming to be a contact should be verified first.",
    },
    speaker: {
      claimedIdentity: { bn: "পরিচিত ব্যক্তি দাবি", en: "Claims to be a known contact" },
    },
  },
  {
    id: "injection-attempt",
    pattern: INJECTION_WORDS,
    tactic: "prompt_injection",
    weight: "moderate",
    interpretation: {
      bn: "বার্তায় সিস্টেমকে বিভ্রান্ত করার নির্দেশনা পাওয়া গেছে (prompt injection) — এই নির্দেশনা কখনোই অনুসরণ করা হয় না, কেবল সনাক্ত করা হয়।",
      en: "The content contains instructions attempting to manipulate the analyzer (prompt injection) — these are never followed, only flagged.",
    },
  },
  {
    id: "emotional-pressure",
    pattern: EMOTION_WORDS,
    tactic: "emotional_pressure",
    weight: "weak",
    interpretation: {
      bn: "আবেগ বা বিশ্বাসের অনুরোধ করা হয়েছে — সিদ্ধান্তের আগে বিশ্বাসের চেয়ে যাচাই বেশি জরুরি।",
      en: "Emotional appeals or demands of trust — verification matters more than trust before acting.",
    },
  },
  {
    id: "parcel",
    pattern: PARCEL_WORDS,
    // V4: guarded — genuine courier/delivery notifications are common.
    negationGuarded: true,
    advisoryRx: RX([
      "out\\s*for\\s*delivery", "আউট\\s*ফর\\s*ডেলিভারি", "পৌঁছে\\s*দেওয়া\\s*হবে",
      "will\\s*arrive", "ডেলিভারি\\s*ম্যান\\s*আসার\\s*আগে", "courier\\s*will\\s*call",
      "অর্ডার\\s*#", "order\\s*#", "has\\s*been\\s*shipped",
      "ট্র্যাক\\s*কর", "track\\s*(?:your|the)", "delivery\\s*(?:is|will\\s*be)\\s*(?:scheduled|on)",
    ]),
    tactic: "parcel_lure",
    weight: "moderate",
    interpretation: {
      bn: "অপ্রত্যাশিত পার্সেল/কুরিয়ারের কথা বলা হয়েছে — আপনি কিছু অর্ডার না করে থাকলে এটি সন্দেহজনক।",
      en: "An unexpected parcel/courier is mentioned — suspicious if you never ordered anything.",
    },
  },
  {
    id: "shopping-offer",
    pattern: SHOPPING_WORDS,
    tactic: "shopping_lure",
    weight: "moderate",
    interpretation: {
      bn: "অস্বাভাবিক ছাড়ের অফার বা অর্ডার কনফার্মেশনের কথা আছে — অতিরিক্ত সস্তা অফার প্রায়ই ভুয়া পেজের ফাঁদ।",
      en: "An unusually cheap offer or order confirmation is mentioned — extreme discounts are often fake-page bait.",
    },
  },
  {
    id: "loan",
    pattern: LOAN_WORDS,
    tactic: "loan_lure",
    weight: "moderate",
    interpretation: {
      bn: "সহজ শর্তে ঋণের প্রস্তাব — অনুমোদিত নয় এমন সব 'লোন' প্রস্তাব যাচাই ছাড়া বিশ্বাস করা বিপজ্জনক।",
      en: "An easy-loan offer — unverified 'instant loan' propositions are dangerous without verification.",
    },
  },
  // ---- V4 detectors (Bangla-first scam coverage) ---------------------------
  {
    id: "cashout-request",
    pattern: CASHOUT_WORDS,
    tactic: "cashout_request",
    weight: "strong",
    interpretation: {
      bn: "অচেনা কেউ নিজের 'পার্সোনাল নাম্বারে' ক্যাশ আউট করতে বলেছে — বাংলাদেশে এটি টাকা আত্মসাৎএর অন্যতম প্রধান কৌশল।",
      en: "A stranger asks for a cash-out to their 'personal number' — one of the most common money-misappropriation tactics in Bangladesh.",
    },
    speaker: {
      requestedAction: { bn: "নিজের নম্বরে ক্যাশ আউট চাওয়া", en: "Requesting a cash-out to their own number" },
    },
  },
  {
    id: "guaranteed-return",
    pattern: RETURN_WORDS,
    tactic: "guaranteed_return",
    weight: "strong",
    interpretation: {
      bn: "নিশ্চিত/দ্বিগুণ লাভের প্রতিশ্রুতি — বৈধ বিনিয়োগে লাভ কখনো 'গ্যারান্টি' হয় না।",
      en: "A guaranteed/doubled-return promise — legitimate investment returns are never 'guaranteed'.",
    },
  },
  {
    id: "contact-lure",
    pattern: CONTACT_WORDS,
    tactic: "contact_request",
    weight: "moderate",
    // V4: guarded — advisories legitimately say "call 999 / report now".
    negationGuarded: true,
    interpretation: {
      bn: "যোগাযোগ করতে বলা হয়েছে (কল/এসএমএস/লিংকে ক্লিক) — পুরস্কার বা অফারের সাথে মিলে গেলে এটি প্রতারণার শক্ত লক্ষণ।",
      en: "The message asks you to make contact (call/SMS/click a link) — combined with a prize or offer this is a strong scam signal.",
    },
  },
  {
    id: "inheritance",
    pattern: INHERITANCE_WORDS,
    tactic: "inheritance_lure",
    weight: "strong",
    interpretation: {
      bn: "মৃত আত্মীয়ের সম্পদ/মিলিয়ন ডলার ট্রান্সফারের গল্প — এই 'উত্তরাধিকার' গল্প বিশ্বজুড়ে পরিচিত প্রতারণা।",
      en: "A deceased relative's estate / million-dollar transfer story — this classic '419' inheritance tale is a globally known fraud.",
    },
  },
  {
    id: "referral-income",
    pattern: REFERRAL_WORDS,
    tactic: "referral_lure",
    weight: "moderate",
    interpretation: {
      bn: "রেফার/বোনাসে ইনকামের প্রস্তাব — বেনামি অ্যাপে এ ধরনের 'পিরামিড' প্রস্তাব প্রায়ই প্রতারণা।",
      en: "A referral/bonus income offer — such 'pyramid' offers on anonymous apps are frequently fraud.",
    },
  },
  {
    id: "matrimony",
    pattern: MATRIMONY_WORDS,
    tactic: "matrimony_lure",
    weight: "moderate",
    interpretation: {
      bn: "বিয়ে/রকম সংক্রান্ত প্রস্তাব — অর্থ চেয়ে এমন প্রস্তাব দেওয়া হলে সেটি প্রতারণার প্রচলিত ধরন।",
      en: "A marriage/matrimony proposal — when it asks for money it is a well-known scam pattern.",
    },
  },
];

/** Build a regex that fires when two patterns occur within `window` chars of each other. */
function combineNear(a: RegExp, b: RegExp, window: number): RegExp {
  const aSrc = a.source;
  const bSrc = b.source;
  return new RegExp(`(?:${aSrc})[\\s\\S]{0,${window}}?(?:${bSrc})|(?:${bSrc})[\\s\\S]{0,${window}}?(?:${aSrc})`, "i");
}

/** Extract quoted context around a match, on a single line when possible. */
function quoteAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + len + 40);
  let quote = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) quote = "…" + quote;
  if (end < text.length) quote = quote + "…";
  return quote.slice(0, 160);
}

export function detectScamIndicators(redactedText: string, rawUrl?: string, modality?: string): HeuristicResult {
  // V4 (fix): NFC-normalize so decomposed keyboard input matches patterns
  // regardless of ya-phala composition (see RX above).
  redactedText = redactedText.normalize("NFC");
  const evidence: Evidence[] = [];
  let n = 1;
  const nextKey = () => `E${n++}`;
  const advisoryHits: string[] = [];

  for (const det of DETECTORS) {
    const rx = new RegExp(det.pattern.source, det.pattern.flags.includes("g") ? det.pattern.flags : det.pattern.flags + "g");
    let m: RegExpExecArray | null;
    let emitted = false;
    while ((m = rx.exec(redactedText)) !== null) {
      if (det.negationGuarded && isAdvisorySentence(redactedText, m.index, m[0].length, det.advisoryRx)) {
        // V3 negation guard: this hit is inside a safety-advisory sentence.
        if (!emitted) advisoryHits.push(det.id);
        break;
      }
      if (!emitted) {
        evidence.push({
          key: nextKey(),
          kind: det.id === "injection-attempt" ? "context" : "heuristic",
          quote: quoteAround(redactedText, m.index, m[0].length),
          interpretation: det.interpretation,
          tactic: det.tactic,
          source: `heuristic:${det.id}`,
          weight: det.weight,
          ...(det.speaker ? { speaker: det.speaker } : {}),
        });
        emitted = true;
      }
      break; // one evidence item per detector
    }
  }

  // ---- V3: family impersonation (the "Rahela" pattern) ----------------------
  const kin = KINSHIP_ADDRESS.exec(redactedText);
  const kinClaim = KINSHIP_CLAIM.exec(redactedText);
  const distress = DISTRESS_WORDS.exec(redactedText);
  const secrecy = SECRECY_WORDS.exec(redactedText);
  const moneyInText = MONEY_WORDS.test(redactedText) || /৳\s?\d|টাকা\s*\d|\d{4,}\s*টাকা|[\d,]{5,}\s*টাকা/.test(redactedText);
  const amountMatch = redactedText.match(/(?:৳\s?([\d,]+)|([\d,]+)\s*টাকা)/);

  const kinScore = (kin ? 1 : 0) + (distress ? 1 : 0) + (moneyInText ? 1 : 0) + (secrecy ? 1 : 0) + (kinClaim ? 1 : 0);
  if (kin && kinScore >= 2 && (moneyInText || distress)) {
    const quoteIdx = kinClaim?.index ?? distress?.index ?? kin.index;
    const quoteLen = (kinClaim ?? distress ?? kin)![0].length;
    const speaker: SpeakerContext = {
      claimedIdentity: kinClaim
        ? { bn: "পরিবারের সদস্য (ছেলে/ভাই/আপু প্রভৃতি) দাবি", en: "Claims to be a family member (son/brother/sister etc.)" }
        : { bn: "পরিবারের সদস্য সাজা", en: "Posing as a family member" },
      addressedAs: kin ? { bn: "পরিবারের কাছে 'মা/আব্বু/ভাই' সম্বোধন", en: "Addresses the recipient as a family member (mom/dad/brother)" } : undefined,
      requestedAction: moneyInText
        ? { bn: `জরুরি টাকা পাঠানোর অনুরোধ${amountMatch ? "" : ""}`, en: "Urgent request to send money" }
        : { bn: "জরুরি সাহায্য/অর্থ চাওয়া", en: "Urgent appeal for help/money" },
    };
    evidence.push({
      key: nextKey(),
      kind: "quoted_text",
      quote: quoteAround(redactedText, quoteIdx, quoteLen),
      interpretation: {
        bn: [
          "অচেনা নম্বর/কণ্ঠ নিজেকে পরিবারের সদস্য হিসেবে উপস্থাপন করেছে",
          distress ? "এবং বিপদের কথা বলে আবেগ ও তাড়া তৈরি করেছে" : "",
          moneyInText ? "এবং টাকা পাঠাতে বলেছে" : "",
          secrecy ? "এবং 'কাউকে বলো না' বলে গোপনীয়তা চেয়েছে — যা যাচাই আটকানোর কৌশল" : "",
        ]
          .filter(Boolean)
          .join(", ")
          .concat("।"),
        en: [
          "An unknown number/voice presents itself as a family member",
          distress ? "creates urgency with a distress story" : "",
          moneyInText ? "asks for money" : "",
          secrecy ? "demands secrecy ('don't tell anyone') — a tactic to prevent verification" : "",
        ]
          .filter(Boolean)
          .join(", ")
          .concat("."),
      },
      tactic: "family_impersonation",
      source: "heuristic:family-impersonation",
      weight: "strong",
      speaker,
    });
  }

  let urlAssessment: UrlAssessment | undefined;
  if (rawUrl && rawUrl.trim()) {
    const res = analyzeUrl(rawUrl, "");
    urlAssessment = res.assessment;
    for (const p of urlAssessment.properties) {
      p.key = nextKey();
      evidence.push(p);
    }
  } else {
    // Also scan for embedded URLs in text
    // V4: bare domains (dbbl-atm.xyz) are scanned too — scam links usually
    // arrive in SMS without any scheme prefix.
    const urlMatches = redactedText.match(
      /https?:\/\/[^\s]+|(?:^|\s)www\.[^\s]+|(?:^|\s)[a-z0-9][a-z0-9-]{1,30}\.(?:com|net|org|xyz|top|win|live|click|link|space|website|online|site|shop|buzz|icu|cfd|rest|club|info|pro|app)(?:\/[^\s]*)?/gi
    ) || [];
    for (const u of urlMatches.slice(0, 3)) {
      const res = analyzeUrl(u.trim(), "");
      urlAssessment = urlAssessment ?? res.assessment;
      for (const p of res.assessment.properties) {
        p.key = nextKey();
        evidence.push(p);
      }
    }
  }

  // Build speaker context summary for the result contract.
  const speakerContext = buildSpeakerContext(evidence, redactedText);

  return {
    evidence,
    urlAssessment,
    speaker: speakerContext,
    ...assessRisk(evidence, modality),
  };
}

/** V3: summarize who claims what, addressing whom, requesting what. */
function buildSpeakerContext(evidence: Evidence[], text: string): SpeakerContext | undefined {
  const ctx: SpeakerContext = {};
  for (const e of evidence) {
    if (e.speaker?.claimedIdentity) ctx.claimedIdentity = e.speaker.claimedIdentity;
    if (e.speaker?.addressedAs) ctx.addressedAs = e.speaker.addressedAs;
    if (e.speaker?.requestedAction) ctx.requestedAction = e.speaker.requestedAction;
  }
  return Object.keys(ctx).length ? ctx : undefined;
}

function has(evidence: Evidence[], tactic: string, sourceId?: string): boolean {
  return evidence.some(
    (e) => e.tactic === tactic && (!sourceId || e.source === `heuristic:${sourceId}`)
  );
}

/**
 * Deterministic risk + category cascade used for rule-based fallback and gate
 * consistency. V3: four-state output; "no indicators" never means "safe".
 */
export function assessRisk(evidence: Evidence[], modality?: string): { riskCategory: RiskCategory; scamCategory: string } {
  const otp = has(evidence, "otp_request");
  const family = has(evidence, "family_impersonation");
  const impersonation = has(evidence, "impersonation");
  const threat = has(evidence, "intimidation");
  const money = has(evidence, "money_request");
  const prize = has(evidence, "false_reward");
  const fee = has(evidence, "advance_fee");
  const job = has(evidence, "fake_job");
  const scholarship = has(evidence, "scholarship_lure");
  const investment = has(evidence, "investment_lure");
  const romance = has(evidence, "romance_lure");
  const accountTakeover = has(evidence, "account_takeover");
  const qrPhish = has(evidence, "qr_phishing");
  const remote = has(evidence, "device_control");
  const lookalike = evidence.some((e) => e.source === "heuristic:url-lookalike_domain" || e.source === "heuristic:url-ip_host" || e.source === "heuristic:url-punycode" || e.source === "heuristic:url-lookalike");
  const linkRisk = evidence.some((e) => e.tactic === "credential_path" || e.tactic === "shortener" || e.tactic === "no_tls" || e.tactic === "suspicious_tld");
  const newNumber = has(evidence, "identity_switch");
  const parcel = has(evidence, "parcel_lure");
  const shopping = has(evidence, "shopping_lure");
  const loan = has(evidence, "loan_lure");
  const urgency = has(evidence, "urgency");
  const cashout = has(evidence, "cashout_request");
  const guaranteedReturn = has(evidence, "guaranteed_return");
  const contact = has(evidence, "contact_request");
  const inheritance = has(evidence, "inheritance_lure");
  const referral = has(evidence, "referral_lure");
  const income = has(evidence, "referral_lure") && INCOME_WORDS.test(evidence.map((e) => e.quote).join(" "));
  const matrimony = has(evidence, "matrimony_lure");
  const secrecy = evidence.some((e) => e.source === "heuristic:family-impersonation" && /গোপন|কাউকে\s*বল/i.test(e.interpretation.bn));

  // Family impersonation (optionally AI-voice flavored for the voice modality)
  if (family && (money || threat || urgency)) {
    return {
      riskCategory: "HIGH_RISK",
      scamCategory: modality === "voice" ? "ai_voice_impersonation" : "family_impersonation",
    };
  }
  if (family) return { riskCategory: "HIGH_RISK", scamCategory: "family_impersonation" };
  if (remote) return { riskCategory: "HIGH_RISK", scamCategory: "app_control" };
  if (accountTakeover) return { riskCategory: "HIGH_RISK", scamCategory: "account_takeover" };
  if (qrPhish) return { riskCategory: "HIGH_RISK", scamCategory: "qr_phishing" };
  if (otp) return { riskCategory: "HIGH_RISK", scamCategory: "otp_phishing" };
  if (threat && (impersonation || urgency)) return { riskCategory: "HIGH_RISK", scamCategory: "threat_extortion" };
  if (prize && (fee || impersonation)) return { riskCategory: "HIGH_RISK", scamCategory: "prize_lottery" };
  if (job && fee) return { riskCategory: "HIGH_RISK", scamCategory: "fake_job" };
  if (scholarship && (fee || impersonation || money)) return { riskCategory: "HIGH_RISK", scamCategory: "scholarship_scam" };
  if (investment && (money || fee)) return { riskCategory: "HIGH_RISK", scamCategory: "investment_fraud" };
  if (romance && (money || fee || investment)) return { riskCategory: "HIGH_RISK", scamCategory: "romance_scam" };
  if (lookalike) return { riskCategory: "HIGH_RISK", scamCategory: "phishing_link" };
  if (linkRisk && (impersonation || contact)) return { riskCategory: "HIGH_RISK", scamCategory: "phishing_link" };
  if (money && (impersonation || urgency || secrecy)) return { riskCategory: "HIGH_RISK", scamCategory: "impersonation" };
  if (money && (parcel || fee)) return { riskCategory: "HIGH_RISK", scamCategory: "parcel_scam" };
  if (shopping && fee) return { riskCategory: "HIGH_RISK", scamCategory: "shopping_scam" };
  if (loan && fee) return { riskCategory: "HIGH_RISK", scamCategory: "loan_scam" };
  // ---- V4 rules (verified against the 2026-11 Bangla scam corpus) ----
  if (cashout) return { riskCategory: "HIGH_RISK", scamCategory: "cashout_scam" };
  if (inheritance) return { riskCategory: "HIGH_RISK", scamCategory: "inheritance_scam" };
  if (investment && (money || fee || guaranteedReturn)) return { riskCategory: "HIGH_RISK", scamCategory: "investment_fraud" };
  if (prize && (contact || fee || impersonation)) return { riskCategory: "HIGH_RISK", scamCategory: "prize_lottery" };
  if (parcel && (fee || money)) return { riskCategory: "HIGH_RISK", scamCategory: "parcel_scam" };
  if (loan && /\u09ac\u09bf\u09a8\u09be\s*\u099c\u09be\u09ae\u09bf\u09a8\u09c7|\u09a4\u09be\u09ce\u0995\u09cd\u09b7\u09a3\u09bf\u0995|instant/i.test(evidence.map((e) => e.quote).join(" "))) return { riskCategory: "HIGH_RISK", scamCategory: "loan_scam" };
  if (matrimony && (money || fee)) return { riskCategory: "HIGH_RISK", scamCategory: "matrimony_scam" };
  if (referral && income) return { riskCategory: "HIGH_RISK", scamCategory: "referral_scam" };
  if (job && (fee || guaranteedReturn || income)) return { riskCategory: "HIGH_RISK", scamCategory: "fake_job" };

  // Weaker combinations → CAUTION
  if (matrimony || referral) return { riskCategory: "CAUTION", scamCategory: matrimony ? "matrimony_scam" : "referral_lure" };
  if (prize || (job && (scholarship || impersonation)) || scholarship) return { riskCategory: "CAUTION", scamCategory: prize ? "prize_lottery" : scholarship ? "scholarship_scam" : "fake_job" };
  if (investment || romance) return { riskCategory: "CAUTION", scamCategory: investment ? "investment_fraud" : "romance_scam" };
  if (money) return { riskCategory: "CAUTION", scamCategory: "uncertain_situation" };
  if (linkRisk) return { riskCategory: "CAUTION", scamCategory: "phishing_link" };
  if (impersonation && urgency) return { riskCategory: "CAUTION", scamCategory: "impersonation" };
  if (newNumber) return { riskCategory: "CAUTION", scamCategory: "impersonation" };
  if (job || loan || parcel || shopping || impersonation || urgency)
    return { riskCategory: "CAUTION", scamCategory: "uncertain_situation" };

  // Nothing detected — but absence of indicators is not proof of safety.
  return { riskCategory: "NO_RISK_INDICATORS", scamCategory: "no_indicators" };
}
