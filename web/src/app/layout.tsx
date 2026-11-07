import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WappPay — Everything money, one chat away",
  description:
    "WappPay is your AI financial assistant inside WhatsApp. Send money, pay bills, buy airtime & data, and track spending — no app to download.",
  openGraph: {
    title: "WappPay — Everything money, one chat away",
    description:
      "Send money, pay bills, buy data — all inside WhatsApp with an AI that understands your voice, photos, and Pidgin.",
    type: "website",
    locale: "en_NG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
