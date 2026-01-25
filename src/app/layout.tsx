import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PageTracker } from "@/components/PageTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://funmotips.com"),
  title: {
    default: "Funmo Tips | Premium Football Analytics & Predictions",
    template: "%s | Funmo Tips"
  },
  description: "AI-powered football predictions and statistical analysis. We provide data-driven betting tips, probability modeling, and risk assessment for serious bettors.",
  keywords: ["football tips", "soccer predictions", "betting analytics", "AI football analysis", "sports data", "betting odds", "funmo tips", "kenya betting"],
  authors: [{ name: "Funmo Analytics Team" }],
  creator: "Funmo Analytics",
  publisher: "Funmo Tips",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://funmotips.com",
    siteName: "Funmo Tips",
    title: "Funmo Tips | Premium AI Football Analysis",
    description: "Stop guessing. Start investing. Data-driven football analytics with a transparent history of wins and losses.",
    images: [
      {
        url: "/og-image.png", // We will need to ensure this exists or use a default
        width: 1200,
        height: 630,
        alt: "Funmo Tips Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Funmo Tips | AI Betting Intelligence",
    description: "Premium football analytics and risk management for smart bettors.",
    images: ["/og-image.png"],
    creator: "@funmotips", // Update if there is a real handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Funmo Tips",
  "url": "https://funmotips.com",
  "logo": "https://funmotips.com/icon.png",
  "sameAs": [
    "https://twitter.com/funmotips",
    "https://facebook.com/funmotips"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+254700000000", // Update with real info if available
    "contactType": "customer service",
    "areaServed": "KE"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AuthProvider>
          <PageTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
