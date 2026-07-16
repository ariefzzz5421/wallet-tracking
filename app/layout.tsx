import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Navigation } from "./components/Navigation";
import { RealtimeProvider } from "./components/RealtimeProvider";
import { TrackedChainsProvider } from "./components/TrackedChainsProvider";
import { WatchlistProvider } from "./components/WatchlistProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const title = "Huntlist — Multi-chain wallet intelligence";
const description = "Track wallet balances, activity feeds, and verified PnL rankings across seven crypto networks.";
const themeScript = `(function(){try{var saved=localStorage.getItem('huntlist-theme-v1');var theme=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch(e){}})()`;

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1731, height: 909, alt: "Huntlist wallet signal board" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WatchlistProvider>
          <RealtimeProvider>
            <TrackedChainsProvider>
              <Navigation />
              {children}
            </TrackedChainsProvider>
          </RealtimeProvider>
        </WatchlistProvider>
      </body>
    </html>
  );
}
