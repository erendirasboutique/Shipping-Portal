import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Erendira Shipping Studio",
    template: "%s · Erendira Shipping Studio",
  },
  description:
    "Internal shipping portal for Erendira's Boutique — labels, orders, customers, returns, and batch printing.",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo2.png",
  },
  openGraph: {
    title: "Erendira Shipping Studio",
    description: "Internal shipping portal for Erendira's Boutique.",
    url: siteUrl,
    siteName: "Erendira Shipping Studio",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erendira Shipping Studio",
    description: "Internal shipping portal for Erendira's Boutique.",
    images: ["/og.png"],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
