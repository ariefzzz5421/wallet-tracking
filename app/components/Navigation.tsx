"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Watchlist" },
  { href: "/feed", label: "Wallet feed" },
  { href: "/profitable-wallets", label: "Top profitable" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Huntlist home">
        <span className="brand-mark"><span /></span>
        <span>HUNTLIST</span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            {item.label}
          </Link>
        ))}
      </nav>
      <span className="read-only"><i /> Read-only</span>
    </header>
  );
}
