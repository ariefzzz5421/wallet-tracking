"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketTicker } from "./MarketTicker";
import { RealtimeCenter } from "./RealtimeCenter";
import { ThemeToggle } from "./ThemeToggle";

const items = [
  { href: "/", label: "Watchlist" },
  { href: "/chains", label: "Chains" },
  { href: "/feed", label: "Wallet feed" },
  { href: "/profitable-wallets", label: "Top profitable" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="topbar">
        <Link className="brand" href="/" aria-label="Huntlist home">
          <span className="brand-mark"><span /></span>
          <span>HUNTLIST</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-actions">
          <RealtimeCenter />
          <ThemeToggle />
        </div>
      </div>
      <MarketTicker />
    </header>
  );
}
