import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-cc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Canonical site URL — set NEXT_PUBLIC_SITE_URL on Vercel to the real domain;
// this default matches the standard Vercel project URL for this repo.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://candle-climber.vercel.app";

const title = "CANDLE CLIMBER — The chart is the level";
const description =
  "A skill platformer where the terrain is real candlestick data. Green candles hold, red candles crumble. One daily chart, every player worldwide. Built for the vibe/vibe ecosystem on Robinhood Chain.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "candle climber",
    "vibe vibe",
    "robinhood chain",
    "web3 game",
    "trading game",
    "daily challenge",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/cc-icon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "CANDLE CLIMBER",
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CANDLE CLIMBER — the chart is the level" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#101214",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://api.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=instrument-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
