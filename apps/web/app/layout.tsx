import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const title = "SIMBridge — Your SIM. Your Messages. Anywhere.";
const description =
  "SIMBridge securely relays SMS from your home SIM to your trusted phone, with real-time delivery, background operation, multi-SIM routing and offline synchronization.";

export const metadata: Metadata = {
  metadataBase: new URL("https://simbridge.app"),
  title,
  description,
  openGraph: {
    title,
    description: "Stay connected to your home SIM wherever you go.",
    type: "website",
    siteName: "SIMBridge",
    images: [{ url: "/logo.png", width: 970, height: 969, alt: "SIMBridge — Your SIM. Your messages. Anywhere." }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "Stay connected to your home SIM wherever you go.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F4D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}