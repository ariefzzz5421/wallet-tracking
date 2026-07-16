"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SeriesPoint = { timestamp: string; transactions: number; volumeUsd: number; buyers: number; sellers: number };
type X402Data = {
  sourceUrl: string;
  sourceRepo: string;
  fetchedAt: string;
  range: number;
  chain: string;
  stats: { transactions: number; volumeUsd: number; uniqueBuyers: number; uniqueSellers: number; latestAt: string | null };
  series: SeriesPoint[];
  facilitators: Array<{ id: string; name: string; color: string; docsUrl: string; transactions: number; volumeUsd: number; uniqueBuyers: number; uniqueSellers: number; chains: string[] }>;
  transactions: Array<{ id: string; amountUsd: number; sender: string; recipient: string; txHash: string; chain: string; facilitator: string; timestamp: string; explorerUrl: string }>;
};

const rangeOptions = [1, 7, 30] as const;
const chainOptions = [
  { value: "", label: "All networks" },
  { value: "base", label: "Base" },
  { value: "solana", label: "Solana" },
  { value: "polygon", label: "Polygon" },
  { value: "optimism", label: "Optimism" },
];

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function usd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: value >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

function short(value: string) {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function relativeTime(value: string | null) {
  if (!value) return "No recent settlement";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ActivityChart({ points }: { points: SeriesPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const width = 1000;
    const height = 270;
    const values = points.map((point) => point.transactions);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    return {
      width,
      height,
      coords: points.map((point, index) => ({
        x: (index / (points.length - 1)) * width,
        y: height - 18 - ((point.transactions - min) / span) * (height - 42),
      })),
    };
  }, [points]);

  if (!geometry) return <div className="x402-empty">Waiting for enough x402 activity to draw the chart.</div>;
  const activeIndex = hovered ?? points.length - 1;
  const activePoint = points[activeIndex];
  const activeCoord = geometry.coords[activeIndex];
  const polyline = geometry.coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="x402-chart-wrap">
      <div className="x402-chart-readout">
        <strong>{compact(activePoint.transactions)} settlements</strong>
        <span>{usd(activePoint.volumeUsd)} · {new Date(activePoint.timestamp).toLocaleString()}</span>
      </div>
      <svg className="x402-chart" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="x402 settlement activity chart">
        <defs><linearGradient id="x402-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path d={`M 0 ${geometry.height} L ${polyline.replaceAll(" ", " L ")} L ${geometry.width} ${geometry.height} Z`} fill="url(#x402-fill)" />
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <line x1={activeCoord.x} x2={activeCoord.x} y1="0" y2={geometry.height} stroke="currentColor" strokeOpacity=".24" strokeDasharray="7 7" />
        <circle cx={activeCoord.x} cy={activeCoord.y} r="7" fill="var(--lime)" stroke="currentColor" strokeWidth="3" />
        {geometry.coords.map((point, index) => (
          <rect key={points[index].timestamp} x={Math.max(0, point.x - (geometry.width / points.length) / 2)} y="0" width={geometry.width / points.length} height={geometry.height} fill="transparent" onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} tabIndex={0} aria-label={`${compact(points[index].transactions)} settlements`} />
        ))}
      </svg>
    </div>
  );
}

export function X402DashboardClient() {
  const [range, setRange] = useState<(typeof rangeOptions)[number]>(30);
  const [chain, setChain] = useState("");
  const [data, setData] = useState<X402Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ range: String(range) });
      if (chain) params.set("chain", chain);
      const response = await fetch(`/api/x402?${params}`, { signal, cache: "no-store" });
      const result = await response.json() as X402Data & { error?: string };
      if (!response.ok || result.error) throw new Error(result.error || "x402 data is unavailable");
      setData(result);
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "x402 data is unavailable");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [chain, range]);

  useEffect(() => {
    const controller = new AbortController();
    const firstLoad = window.setTimeout(() => void load(controller.signal), 0);
    const timer = window.setInterval(() => void load(controller.signal, true), 30_000);
    return () => { controller.abort(); window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [load]);

  return (
    <main className="x402-page">
      <section className="shell x402-hero">
        <div>
          <span className="eyebrow"><i /> LIVE · READ-ONLY</span>
          <h1>x402 Network<br />Intelligence</h1>
          <p>Track autonomous payment settlements, buyers, sellers, and facilitators across the public x402 network.</p>
        </div>
        <div className="x402-source-card">
          <span>DATA SOURCE</span>
          <strong>x402scan</strong>
          <small>Public analytics · refreshes every 30 seconds</small>
          <div><a href={data?.sourceUrl || "https://www.x402scan.com"} target="_blank" rel="noreferrer">Open dashboard ↗</a><a href={data?.sourceRepo || "https://github.com/ariefzzz5421/x402scan"} target="_blank" rel="noreferrer">Source ↗</a></div>
        </div>
      </section>

      <section className="x402-toolbar">
        <div className="shell">
          <label>NETWORK<select value={chain} onChange={(event) => setChain(event.target.value)}>{chainOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}</select></label>
          <div className="x402-ranges" aria-label="Time range">{rangeOptions.map((option) => <button key={option} className={range === option ? "active" : ""} onClick={() => setRange(option)}>{option}D</button>)}</div>
          <span className="x402-updated">{data ? `Updated ${relativeTime(data.fetchedAt)}` : "Connecting…"}</span>
          <button className="x402-refresh" onClick={() => void load()} disabled={loading}>{loading ? "LOADING" : "REFRESH"}</button>
        </div>
      </section>

      <div className="shell x402-content">
        {error ? <div className="metric-alert warning"><strong>Feed issue</strong><span>{error}. The last successful snapshot stays visible.</span></div> : null}
        <section className="x402-stat-grid" aria-busy={loading && !data}>
          {[
            ["Settlements", data ? compact(data.stats.transactions) : "—", "HTTP 402 payments observed"],
            ["Volume", data ? usd(data.stats.volumeUsd) : "—", "Settled stablecoin value"],
            ["Unique buyers", data ? compact(data.stats.uniqueBuyers) : "—", "Distinct payment senders"],
            ["Unique sellers", data ? compact(data.stats.uniqueSellers) : "—", data ? `Latest ${relativeTime(data.stats.latestAt)}` : "Distinct recipients"],
          ].map(([label, value, note], index) => <article key={label} className={index === 0 ? "lime" : ""}><span>0{index + 1} · {label}</span><strong>{value}</strong><small>{note}</small></article>)}
        </section>

        <section className="x402-panel x402-activity-panel">
          <header><div><span>NETWORK PULSE</span><h2>Settlement activity</h2></div><small>Hover or focus the chart to inspect a bucket</small></header>
          {data ? <ActivityChart points={data.series} /> : <div className="x402-empty">Loading live x402 activity…</div>}
        </section>

        <section className="x402-panel">
          <header><div><span>PROCESSING LAYER</span><h2>Top facilitators</h2></div><small>Ranked by settlements in selected period</small></header>
          <div className="x402-facilitators">
            {data?.facilitators.map((item, index) => <a key={item.id} href={item.docsUrl} target="_blank" rel="noreferrer"><i style={{ background: item.color }} /><span>0{index + 1}</span><div><strong>{item.name}</strong><small>{item.chains.join(" · ") || "Network agnostic"}</small></div><b>{compact(item.transactions)}</b><em>{usd(item.volumeUsd)}</em></a>)}
            {!data ? <div className="x402-empty">Loading facilitator rankings…</div> : null}
          </div>
        </section>

        <section className="x402-panel x402-transactions-panel">
          <header><div><span>LIVE SETTLEMENTS</span><h2>Latest transactions</h2></div><small>Read-only public ledger activity</small></header>
          <div className="x402-table-wrap"><table className="x402-table"><thead><tr><th>Network</th><th>Amount</th><th>Buyer</th><th>Seller</th><th>Facilitator</th><th>Age</th><th /></tr></thead><tbody>
            {data?.transactions.map((item) => <tr key={item.id}><td><span className={`x402-chain x402-chain-${item.chain}`}>{item.chain}</span></td><td><strong>{usd(item.amountUsd)}</strong></td><td><code title={item.sender}>{short(item.sender)}</code></td><td><code title={item.recipient}>{short(item.recipient)}</code></td><td>{item.facilitator}</td><td>{relativeTime(item.timestamp)}</td><td><a href={item.explorerUrl} target="_blank" rel="noreferrer" aria-label="Open transaction in explorer">↗</a></td></tr>)}
          </tbody></table>{data && !data.transactions.length ? <div className="x402-empty">No settlements in this filter yet.</div> : null}</div>
        </section>

        <aside className="x402-note"><strong>WHAT IS x402?</strong><p>x402 uses the HTTP 402 Payment Required flow so software and AI agents can pay an API per request with stablecoins. Huntlist only observes public settlements; it never signs or executes a payment.</p></aside>
      </div>
    </main>
  );
}
