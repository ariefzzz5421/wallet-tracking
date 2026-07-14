"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChainMetrics, MetricPeriod } from "../lib/server/chain-metrics";
import { CHAINS, type ChainDefinition } from "../lib/chains";
import { ChainLogo } from "./ChainLogo";
import { useTrackedChains } from "./TrackedChainsProvider";

const PERIODS: Array<{ key: MetricPeriod; label: string }> = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "1y", label: "1Y" },
];

function compactUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 2 : 0,
  }).format(value);
}

function tokenPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function Sparkline({ points }: { points: Array<{ date: number; value: number }> }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const width = 720;
    const height = 210;
    const minDate = points[0].date;
    const maxDate = points.at(-1)?.date ?? minDate + 1;
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(1, maxValue - minValue);
    const dateRange = Math.max(1, maxDate - minDate);
    const line = points.map((point) => {
      const x = ((point.date - minDate) / dateRange) * width;
      const y = height - ((point.value - minValue) / valueRange) * (height - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const last = line.split(" ").at(-1) ?? `${width},${height}`;
    return { width, height, line, area: `0,${height} ${line} ${last.split(",")[0]},${height}` };
  }, [points]);

  if (!geometry) return <div className="chart-unavailable">TVL history is not long enough to chart.</div>;
  return (
    <svg className="tvl-chart" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="TVL history over the last year">
      <defs>
        <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfff59" stopOpacity=".55" />
          <stop offset="1" stopColor="#dfff59" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={geometry.area} fill="url(#tvlFill)" />
      <polyline points={geometry.line} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricStatus({ source }: { source: string }) {
  return <span className="metric-source"><i /> {source}</span>;
}

export function ChainDetailClient({ chain }: { chain: ChainDefinition }) {
  const [metrics, setMetrics] = useState<ChainMetrics | null>(null);
  const [period, setPeriod] = useState<MetricPeriod>("1d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isTracked, toggleChain } = useTrackedChains();
  const tracked = isTracked(chain.key);

  const loadMetrics = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/chains/${chain.key}/metrics`, { signal });
      const result = await response.json() as ChainMetrics & { error?: string };
      if (!response.ok) throw new Error(result.error || "Metrics request failed");
      setMetrics(result);
      setError("");
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Metrics request failed");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [chain.key]);

  useEffect(() => {
    const controller = new AbortController();
    const initialRequest = window.setTimeout(() => void loadMetrics(controller.signal), 0);
    const interval = window.setInterval(() => void loadMetrics(), 60_000);
    return () => {
      controller.abort();
      window.clearTimeout(initialRequest);
      window.clearInterval(interval);
    };
  }, [loadMetrics]);

  function refresh() {
    setLoading(true);
    void loadMetrics();
  }

  const revenue = metrics?.revenue?.values[period] ?? null;
  const earnings = metrics?.earnings?.values[period] ?? null;

  return (
    <main>
      <div className="chain-route-strip">
        <div className="shell chain-route-list">
          {CHAINS.map((item) => (
            <Link key={item.key} href={`/chains/${item.key}`} className={item.key === chain.key ? "active" : ""}>
              <ChainLogo chain={item.key} size={28} /><span>{item.short}</span>
            </Link>
          ))}
        </div>
      </div>

      <section className="shell chain-detail-hero">
        <div className="chain-title-mark"><ChainLogo chain={chain.key} size={86} /></div>
        <div>
          <div className="eyebrow"><span /> {chain.layer} · {chain.status}</div>
          <h1>{chain.name}</h1>
          <p>{chain.description}</p>
        </div>
        <div className="chain-hero-actions">
          <button type="button" className={`track-chain-button ${tracked ? "active" : ""}`} aria-pressed={tracked} onClick={() => toggleChain(chain.key)}>
            {tracked ? "✓ Tracking" : "+ Track chain"}
          </button>
          <a href={chain.explorer} target="_blank" rel="noreferrer">Explorer ↗</a>
        </div>
      </section>

      <section className="chain-metric-toolbar">
        <div className="shell">
          <div className="metric-periods" aria-label="Metric period">
            {PERIODS.map((item) => <button key={item.key} type="button" className={period === item.key ? "active" : ""} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
          </div>
          <span>{metrics ? `Updated ${new Date(metrics.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for providers"}</span>
          <button type="button" className="metric-refresh" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button>
        </div>
      </section>

      <section className="shell chain-metrics">
        {error && <div className="metric-alert"><strong>Live providers are slow.</strong><span>{error}. The page will retry automatically.</span></div>}
        {metrics?.unavailable.length ? <div className="metric-alert warning"><strong>Partial data</strong><span>Unavailable now: {metrics.unavailable.join(", ")}.</span></div> : null}

        <div className="primary-metric-grid">
          {metrics?.asset ? (
            <article className="metric-card asset-card">
              <header><span>{metrics.asset.role === "gas" ? "Gas asset" : "Native token"}</span><MetricStatus source={metrics.asset.source} /></header>
              <div className="asset-symbol"><ChainLogo chain={chain.key} size={44} /><b>{metrics.asset.symbol}</b><small>{metrics.asset.name}</small></div>
              <strong>{tokenPrice(metrics.asset.priceUsd)}</strong>
              <div className="metric-split"><span>24H <b className={(metrics.asset.change24h ?? 0) >= 0 ? "positive" : "negative"}>{percent(metrics.asset.change24h)}</b></span><span>Market cap <b>{compactUsd(metrics.asset.marketCapUsd)}</b></span></div>
              <p>{metrics.asset.note}</p>
            </article>
          ) : metrics?.assetConfigured ? (
            <article className="metric-card unavailable-card"><header><span>Token market</span></header><strong>Unavailable</strong><p>CoinGecko did not return a current price. It will retry automatically.</p></article>
          ) : null}

          <article className="metric-card tvl-summary-card">
            <header><span>Total value locked</span>{metrics?.tvl && <MetricStatus source={metrics.tvl.source} />}</header>
            <strong>{compactUsd(metrics?.tvl?.currentUsd ?? null)}</strong>
            <div className="change-grid">
              {PERIODS.map((item) => {
                const value = metrics?.tvl?.changes[item.key] ?? null;
                return <span key={item.key}><small>{item.label}</small><b className={(value ?? 0) >= 0 ? "positive" : "negative"}>{percent(value)}</b></span>;
              })}
            </div>
          </article>

          <article className="metric-card dimension-card">
            <header><span>Revenue · {period.toUpperCase()}</span>{metrics?.revenue && <MetricStatus source={metrics.revenue.source} />}</header>
            <strong>{compactUsd(revenue)}</strong>
            <p>Gross protocol revenue attributed to applications on this chain by DefiLlama.</p>
          </article>

          <article className="metric-card dimension-card earnings-card">
            <header><span>Earnings* · {period.toUpperCase()}</span>{metrics?.earnings && <MetricStatus source={metrics.earnings.source} />}</header>
            <strong>{compactUsd(earnings)}</strong>
            <p>{metrics?.earnings?.definition ?? "Holder earnings are not indexed for this chain yet."}</p>
          </article>
        </div>

        <article className="tvl-history-card">
          <header><div><span>TVL HISTORY</span><h2>One year liquidity trend</h2></div><small>USD · daily points</small></header>
          {metrics?.tvl?.chart ? <Sparkline points={metrics.tvl.chart} /> : <div className="chart-unavailable">DefiLlama has not indexed usable TVL history for this network.</div>}
        </article>

        <div className="chain-method-note">
          <span>METHOD</span>
          <p>Harga dan market cap berasal dari CoinGecko. TVL, revenue, dan earnings berasal dari DefiLlama. “Earnings” memakai holder revenue, bukan laba bersih perusahaan. Chain testnet atau chain yang belum diindeks tidak diberi angka buatan.</p>
        </div>
      </section>
    </main>
  );
}
