import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Erendira's Boutique · Shipping Studio",
    template: "%s · Erendira Shipping Studio",
  },
  description:
    "Internal shipping portal for Erendira's Boutique",
  icons: {
    icon: "/favicon.ico",
    apple: "/EB_Logo_Fall BGBLANK.png",
  },
  openGraph: {
    title: "Erendira's Boutique · Shipping Studio",
    description: "Internal shipping portal for Erendira's Boutique.",
    url: siteUrl,
    siteName: "Erendira Shipping Studio",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erendira's Boutique · Shipping Studio",
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
