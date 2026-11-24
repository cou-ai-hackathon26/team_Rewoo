import type { Metadata, Viewport } from "next";
import { DM_Sans, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BanglaShield AI — প্রতিটি বাংলাদেশির জন্য এআই নিরাপত্তা",
  description:
    "BanglaShield AI helps ordinary Bangladeshis verify suspicious calls, messages, links and screenshots before money or personal information is lost. ডিজিটাল প্রতারণা থেকে বাঁচার বিশ্বস্ত সঙ্গী।",
  keywords: [
    "BanglaShield",
    "scam check Bangladesh",
    "bKash fraud",
    "OTP scam",
    "cybersecurity Bengali",
    "প্রতারণা যাচাই",
  ],
  authors: [{ name: "BanglaShield AI" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "BanglaShield AI — AI Safety for Every Bangladeshi",
    description:
      "Verify suspicious calls, messages, links and screenshots before it is too late.",
    siteName: "BanglaShield AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2F5746",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body
        className={cn(
          dmSans.variable,
          hindSiliguri.variable,
          "antialiased bg-background text-foreground min-h-screen"
        )}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
