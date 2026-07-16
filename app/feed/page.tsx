"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FeedEvent } from "../api/feed/route";
import { ChainFilterPicker, type ChainFilterValue } from "../components/ChainFilterPicker";
import { ChainLogo } from "../components/ChainLogo";
import { useRealtime } from "../components/RealtimeProvider";
import { useWatchlist } from "../components/WatchlistProvider";
import { CHAIN_MAP, transactionUrl } from "../lib/chains";

const PREVIEW: FeedEvent[] = [
  { id: "p1", walletId: "p", walletLabel: "Perp Whale", address: "0x00", chain: "hyperliquid", kind: "buy", title: "Bought perp", amount: 42.8, symbol: "HYPE", valueUsd: 1_693, timestamp: "2026-07-14T00:00:00.000Z", source: "Hyperliquid" },
  { id: "p2", walletId: "p", walletLabel: "Fund Alpha", address: "0x00", chain: "ethereum", kind: "swap", title: "Swap USDC → ETH", amount: 6.08, symbol: "ETH", valueUsd: 18_446, timestamp: "2026-07-13T23:30:00.000Z", source: "Zerion", movements: [{ direction: "out", amount: 18_500, symbol: "USDC", valueUsd: 18_500 }, { direction: "in", amount: 6.08, symbol: "ETH", valueUsd: 18_446 }], balanceChangeUsd: -62, feeUsd: 8 },
  { id: "p3", walletId: "p", walletLabel: "Base Scout", address: "0x00", chain: "base", kind: "transfer", title: "receive", amount: 6.2, symbol: "ETH", valueUsd: 20_420, timestamp: "2026-07-13T22:00:00.000Z", source: "Zerion" },
];

function money(value?: number) {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function signedMoney(value?: number) {
  if (value === undefined) return "Unavailable";
  const formatted = money(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
}

function tokenAmount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 6 : 3 }).format(value);
}

function ago(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export default function FeedPage() {
  const { wallets, ready } = useWatchlist();
  const { revision } = useRealtime();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("all");
  const [chain, setChain] = useState<ChainFilterValue>("all");
  const [configured, setConfigured] = useState({ zerion: false, hyperliquid: true });
  const [errorCount, setErrorCount] = useState(0);

  async function refresh() {
    if (!wallets.length) return;
    setLoading(true);
    try {
      const response = await fetch("/api/feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallets }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Feed request failed");
      setEvents(result.events || []);
      setConfigured(result.configured);
      setErrorCount(result.errors?.length || 0);
    } catch {
      setErrorCount(wallets.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready || !wallets.length) return;
    const payload = JSON.stringify({ wallets });
    fetch("/api/feed", { method: "POST", headers: { "content-type": "application/json" }, body: payload })
      .then(async (response) => ({ ok: response.ok, result: await response.json() }))
      .then(({ ok, result }) => { if (ok) { setEvents(result.events || []); setConfigured(result.configured); setErrorCount(result.errors?.length || 0); } })
      .catch(() => setErrorCount(wallets.length));
  }, [ready, revision, wallets]);

  const display = wallets.length ? events : PREVIEW;
  const filtered = useMemo(() => display.filter((event) => (kind === "all" || event.kind === kind) && (chain === "all" || event.chain === chain)), [display, kind, chain]);

  return <main>
    <section className="page-hero shell compact-hero">
      <div><div className="eyebrow"><span /> Watchlist activity</div><h1>Wallet Feed</h1><p>Semua aktivitas terbaru dari wallet yang kamu simpan, digabung dalam satu aliran.</p></div>
      <div className="page-number">/ 03</div>
    </section>
    <section className="shell tool-row">
      <div className="filter-tabs">{["all", "buy", "sell", "swap", "transfer"].map((item) => <button type="button" key={item} className={kind === item ? "active" : ""} onClick={() => setKind(item)}>{item}</button>)}</div>
      <ChainFilterPicker value={chain} onChange={setChain} label="Filter feed by network" />
      <button type="button" className="refresh-button" onClick={refresh} disabled={!wallets.length || loading}>{loading ? "Loading…" : "Refresh feed ↻"}</button>
    </section>
    {!wallets.length && <div className="shell setup-banner"><span>PREVIEW</span><p>Belum ada watchlist. Activity di bawah adalah contoh tampilan.</p><Link href="/">Add your first wallet →</Link></div>}
    {wallets.length > 0 && !configured.zerion && wallets.some((wallet) => wallet.chain !== "hyperliquid") && <div className="shell setup-banner warning"><span>SETUP</span><p>Isi <code>ZERION_API_KEY</code> untuk feed Ethereum, Solana, Base, dan chain EVM yang didukung.</p><a href="/docs/API_SETUP.md">Read guide</a></div>}
    <section className="shell feed-layout">
      <div className="feed-list">
        <div className="feed-header"><span>Latest signals</span><small>{filtered.length} activities {errorCount ? `· ${errorCount} wallet unavailable` : ""}</small></div>
        {filtered.map((event) => {
          const outgoing = event.movements?.find((movement) => movement.direction === "out");
          const incoming = event.movements?.find((movement) => movement.direction === "in");
          return <article className="feed-event" key={event.id}>
            <div className="timeline-mark"><ChainLogo chain={event.chain} size={38} /><i /></div>
            <div className="event-main">
              <div className="event-kicker"><span className={`event-kind ${event.kind}`}>{event.kind}</span><b>{event.walletLabel}</b><small suppressHydrationWarning>{event.id.startsWith("p") ? "preview" : ago(event.timestamp)}</small></div>
              <h3>{event.title}</h3>
              {event.kind === "swap" && (outgoing || incoming) ? (
                <div className="swap-preview" aria-label="Swap token and balance change preview">
                  {outgoing && <span className="swap-leg outgoing"><small>Sent</small><b>−{tokenAmount(outgoing.amount)} {outgoing.symbol}</b>{outgoing.valueUsd !== undefined && <em>{money(outgoing.valueUsd)}</em>}</span>}
                  <i aria-hidden="true">→</i>
                  {incoming && <span className="swap-leg incoming"><small>Received</small><b>+{tokenAmount(incoming.amount)} {incoming.symbol}</b>{incoming.valueUsd !== undefined && <em>{money(incoming.valueUsd)}</em>}</span>}
                </div>
              ) : <p>{event.amount ? `${event.amount.toLocaleString("en-US")} ${event.symbol || "tokens"}` : CHAIN_MAP[event.chain].name}</p>}
            </div>
            <div className="event-value">
              <strong>{event.kind === "swap" ? signedMoney(event.balanceChangeUsd) : money(event.valueUsd)}</strong>
              <small>{event.kind === "swap" ? "Net balance change" : event.source}</small>
              {event.kind === "swap" && event.feeUsd !== undefined && <small>Fee {money(event.feeUsd)} · {event.source}</small>}
              {event.hash && <a href={transactionUrl(event.chain, event.hash)} target="_blank" rel="noreferrer">Explorer ↗</a>}
            </div>
          </article>;
        })}
        {!loading && !filtered.length && <div className="empty-state"><strong>No activity found.</strong><p>Coba filter lain atau refresh setelah provider selesai mengindeks.</p></div>}
      </div>
      <aside className="feed-aside"><span>HOW TO READ</span><h2>Signal first.<br />Context next.</h2><p>Aktivitas besar belum tentu trade bagus. Buka explorer, cek entry price, token liquidity, dan pola wallet sebelum bertindak.</p><div><b>01</b> Verify transaction</div><div><b>02</b> Check wallet history</div><div><b>03</b> Size your own risk</div></aside>
    </section>
  </main>;
}
