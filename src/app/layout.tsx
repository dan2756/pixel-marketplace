import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/constants";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_TAGLINE,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "A public mosaic on one 720p frame. 921,600 pixels, sold once. Not ads. Not an NFT. Pay with Stripe or Link.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#FBFAF7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
