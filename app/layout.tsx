import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Navigation } from "./components/Navigation";
import { WatchlistProvider } from "./components/WatchlistProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const title = "Huntlist — Multi-chain wallet intelligence";
const description = "Track wallet balances, activity feeds, and verified PnL rankings across seven crypto networks.";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1731, height: 909, alt: "Huntlist wallet signal board" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WatchlistProvider>
          <Navigation />
          {children}
        </WatchlistProvider>
      </body>
    </html>
  );
}
