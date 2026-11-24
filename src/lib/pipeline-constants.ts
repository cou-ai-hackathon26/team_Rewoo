import type { Bilingual } from "./types";

// Shared limitations appended to every AI-assisted result.
export const LIMIT_FALLBACK_NOTES: Bilingual[] = [
  {
    bn: "এই বিশ্লেষণ প্রদত্ত তথ্যের ভিত্তিতে তৈরি — প্রেরকের প্রকৃত পরিচয় যাচাই করা যায়নি।",
    en: "This analysis is based only on submitted content — the sender's real identity could not be verified.",
  },
  {
    bn: "নিরাপত্তার কারণে বাংলাশিল্ড কোনো লিংক স্বয়ংক্রিয়ভাবে খুলে দেখে না।",
    en: "For safety, BanglaShield never opens links automatically.",
  },
  {
    bn: "কোনো ফলাফলই ভবিষ্যতের নিশ্চয়তা নয় — টাকা বা কোড চাইলে সবসময় স্বাধীনভাবে যাচাই করুন।",
    en: "No result is a guarantee about the future — always verify independently when money or codes are requested.",
  },
];
