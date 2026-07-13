"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChainLogo } from "../components/ChainLogo";
import { useWatchlist } from "../components/WatchlistProvider";
import { CHAIN_MAP } from "../lib/chains";
import type { ProfitRow } from "../api/profitability/route";

type Timeframe = "day" | "week" | "month" | "allTime";
const PERIODS: Array<{ key: Timeframe; label: string }> = [{ key: "day", label: "24H" }, { key: "week", label: "7D" }, { key: "month", label: "30D" }, { key: "allTime", label: "ALL" }];
const PREVIEW: ProfitRow[] = [
  { walletId: "p1", label: "Fund Alpha", address: "0x71c0000000000000000000000000000000009a20", chain: "ethereum", totalPnl: 184_620, roi: 18.4, realizedPnl: 128_400, unrealizedPnl: 56_220, fees: 4210, invested: 1_003_000, source: "Zerion", measuredAt: new Date().toISOString() },
  { walletId: "p2", label: "Perp Whale", address: "0xb2400000000000000000000000000000000081d9", chain: "hyperliquid", totalPnl: 72_880, roi: 31.2, realizedPnl: null, unrealizedPnl: null, fees: null, invested: 233_500, source: "Hyperliquid", measuredAt: new Date().toISOString() },
  { walletId: "p3", label: "Base Scout", address: "0x43d00000000000000000000000000000000070aa", chain: "base", totalPnl: 18_430, roi: 11.7, realizedPnl: 14_110, unrealizedPnl: 4320, fees: 690, invested: 157_500, source: "Zerion", measuredAt: new Date().toISOString() },
];

function money(value: number | null) { if (value === null) return "—"; const sign = value > 0 ? "+" : ""; return `${sign}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)}`; }
function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }

export default function ProfitableWalletsPage() {
  const { wallets, ready } = useWatchlist();
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState(0);
  const [zerionConfigured, setZerionConfigured] = useState(false);

  async function refresh() {
    if (!wallets.length) return;
    setLoading(true);
    try {
      const response = await fetch("/api/profitability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallets, timeframe }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "PnL request failed");
      setRows(result.rows || []); setErrors(result.errors?.length || 0); setZerionConfigured(Boolean(result.configured?.zerion));
    } finally { setLoading(false); }
  }
  useEffect(() => {
    if (!ready || !wallets.length) return;
    const payload = JSON.stringify({ wallets, timeframe });
    fetch("/api/profitability", { method: "POST", headers: { "content-type": "application/json" }, body: payload })
      .then(async (response) => ({ ok: response.ok, result: await response.json() }))
      .then(({ ok, result }) => { if (ok) { setRows(result.rows || []); setErrors(result.errors?.length || 0); setZerionConfigured(Boolean(result.configured?.zerion)); } })
      .catch(() => setErrors(wallets.length));
  }, [ready, wallets, timeframe]);
  const displayRows = wallets.length ? rows : PREVIEW;
  const stats = useMemo(() => {
    const total = displayRows.reduce((sum, row) => sum + row.totalPnl, 0);
    const rois = displayRows.map((row) => row.roi).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const median = rois.length ? rois[Math.floor(rois.length / 2)] : null;
    return { total, median, winners: displayRows.filter((row) => row.totalPnl > 0).length };
  }, [displayRows]);

  return <main>
    <section className="page-hero shell compact-hero profit-hero"><div><div className="eyebrow"><span /> Performance intelligence</div><h1>Top Profitable<br />Wallets</h1><p>Rank wallet berdasarkan PnL pada periode yang sama—bukan sekadar siapa yang punya saldo paling besar.</p></div><div className="page-number">/ 04</div></section>
    <section className="period-bar"><div className="shell"><span>TIMEFRAME</span><div className="period-tabs">{PERIODS.map((period) => <button key={period.key} className={timeframe === period.key ? "active" : ""} onClick={() => setTimeframe(period.key)}>{period.label}</button>)}</div><button className="refresh-button dark" onClick={refresh} disabled={!wallets.length || loading}>{loading ? "Calculating…" : "Recalculate ↻"}</button></div></section>
    {!wallets.length && <div className="shell setup-banner"><span>PREVIEW</span><p>Ranking di bawah adalah contoh tampilan, bukan hasil wallet nyata.</p><Link href="/">Build your watchlist →</Link></div>}
    {wallets.length > 0 && !zerionConfigured && wallets.some((wallet) => wallet.chain !== "hyperliquid") && <div className="shell setup-banner warning"><span>SETUP</span><p><code>ZERION_API_KEY</code> dibutuhkan untuk historical PnL selain Hyperliquid.</p><a href="/docs/API_SETUP.md">Read guide</a></div>}
    <section className="shell profit-stats"><div><span>NET PNL</span><strong className={stats.total >= 0 ? "positive" : "negative"}>{money(stats.total)}</strong></div><div><span>MEDIAN ROI</span><strong>{stats.median === null ? "—" : `${stats.median > 0 ? "+" : ""}${stats.median.toFixed(1)}%`}</strong></div><div><span>PROFITABLE</span><strong>{stats.winners}<small> / {displayRows.length}</small></strong></div><div><span>UNMEASURED</span><strong>{wallets.length ? errors : 0}</strong></div></section>
    <section className="shell leaderboard">
      <div className="leader-head"><span>Rank / Wallet</span><span>Net PnL</span><span>ROI</span><span>Realized / Unrealized</span><span>Source</span></div>
      {displayRows.map((row, index) => <article className={`leader-row ${index === 0 ? "winner" : ""}`} key={row.walletId}>
        <div className="rank-wallet"><b>{String(index + 1).padStart(2, "0")}</b><ChainLogo chain={row.chain} size={42} /><div><strong>{row.label}</strong><code>{shortAddress(row.address)} · {CHAIN_MAP[row.chain].short}</code></div></div>
        <strong className={row.totalPnl >= 0 ? "positive" : "negative"}>{money(row.totalPnl)}</strong>
        <strong>{row.roi === null ? "—" : `${row.roi > 0 ? "+" : ""}${row.roi.toFixed(1)}%`}</strong>
        <div className="split-pnl"><span>{money(row.realizedPnl)}</span><small>{money(row.unrealizedPnl)}</small></div>
        <div className="source-cell"><b>{row.source}</b><small>{timeframe}</small></div>
      </article>)}
      {!loading && !displayRows.length && <div className="empty-state"><strong>No measurable PnL yet.</strong><p>Isi API key, tambahkan wallet yang didukung, lalu hitung ulang.</p></div>}
    </section>
    <section className="shell methodology"><span>METHODOLOGY</span><p>Zerion memakai FIFO PnL untuk transaksi yang terindeks. Hyperliquid memakai portfolio PnL history per periode. Hasil bisa tidak lengkap untuk token tanpa harga, bridge, transfer internal, atau chain yang belum didukung.</p></section>
  </main>;
}
