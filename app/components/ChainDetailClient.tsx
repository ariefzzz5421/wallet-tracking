"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
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

const PERIOD_SECONDS: Record<MetricPeriod, number> = {
  "1d": 86_400,
  "1w": 7 * 86_400,
  "1m": 30 * 86_400,
  "1y": 365 * 86_400,
};

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp * 1_000));
}

function InteractiveTvlChart({ points, period }: { points: Array<{ date: number; value: number }>; period: MetricPeriod }) {
  const [hoveredDate, setHoveredDate] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const filteredPoints = useMemo(() => {
    const latest = points.at(-1);
    if (!latest) return [];
    const visible = points.filter((point) => point.date >= latest.date - PERIOD_SECONDS[period]);
    return visible.length >= 2 ? visible : points.slice(-2);
  }, [period, points]);

  const geometry = useMemo(() => {
    if (filteredPoints.length < 2) return null;
    const width = 1_000;
    const height = 250;
    const minDate = filteredPoints[0].date;
    const maxDate = filteredPoints.at(-1)?.date ?? minDate + 1;
    const values = filteredPoints.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.max(1, maxValue - minValue);
    const dateRange = Math.max(1, maxDate - minDate);
    const coordinates = filteredPoints.map((point) => {
      const x = ((point.date - minDate) / dateRange) * width;
      const y = height - ((point.value - minValue) / valueRange) * (height - 28) - 14;
      return { x, y };
    });
    const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const last = line.split(" ").at(-1) ?? `${width},${height}`;
    return { width, height, line, coordinates, area: `0,${height} ${line} ${last.split(",")[0]},${height}` };
  }, [filteredPoints]);

  const requestedDate = hoveredDate ?? selectedDate;
  const requestedIndex = requestedDate === null ? -1 : filteredPoints.findIndex((point) => point.date === requestedDate);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : Math.max(0, filteredPoints.length - 1);
  const activePoint = filteredPoints[activeIndex];
  const previousPoint = filteredPoints[Math.max(0, activeIndex - 1)];
  const activeChange = activePoint && previousPoint?.value > 0
    ? ((activePoint.value - previousPoint.value) / previousPoint.value) * 100
    : null;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!geometry) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const index = Math.round(ratio * (filteredPoints.length - 1));
    setHoveredDate(filteredPoints[index]?.date ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!filteredPoints.length) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = activeIndex;
    if (event.key === "ArrowLeft") nextIndex = Math.max(0, activeIndex - 1);
    if (event.key === "ArrowRight") nextIndex = Math.min(filteredPoints.length - 1, activeIndex + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = filteredPoints.length - 1;
    setSelectedDate(filteredPoints[nextIndex].date);
  }

  if (!geometry) return <div className="chart-unavailable">TVL history is not long enough to chart.</div>;
  const activeCoordinate = geometry.coordinates[activeIndex];
  return (
    <div className="interactive-chart">
      <div className="chart-live-preview" aria-live="polite">
        <div><span><i /> LIVE TVL</span><strong>{compactUsd(activePoint?.value ?? null)}</strong></div>
        <div><small>{activePoint ? dateLabel(activePoint.date) : "—"}</small><b className={(activeChange ?? 0) >= 0 ? "positive" : "negative"}>{percent(activeChange)} vs prior point</b></div>
      </div>
      <svg
        className="tvl-chart"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="img"
        tabIndex={0}
        aria-label={`Interactive TVL chart for ${period.toUpperCase()}. Use left and right arrow keys to inspect points.`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredDate(null)}
        onClick={() => setSelectedDate(activePoint?.date ?? null)}
        onKeyDown={handleKeyDown}
      >
        <defs>
          <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dfff59" stopOpacity=".62" />
            <stop offset="1" stopColor="#dfff59" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="62.5" x2={geometry.width} y2="62.5" className="chart-grid-line" />
        <line x1="0" y1="125" x2={geometry.width} y2="125" className="chart-grid-line" />
        <line x1="0" y1="187.5" x2={geometry.width} y2="187.5" className="chart-grid-line" />
        <polygon points={geometry.area} fill="url(#tvlFill)" />
        <polyline points={geometry.line} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {activeCoordinate && <>
          <line x1={activeCoordinate.x} y1="0" x2={activeCoordinate.x} y2={geometry.height} className="chart-cursor-line" />
          <circle cx={activeCoordinate.x} cy={activeCoordinate.y} r="7" className="chart-active-point" />
        </>}
      </svg>
      <div className="chart-axis"><span>{dateLabel(filteredPoints[0].date)}</span><span>{period.toUpperCase()} · daily source points</span><span>{dateLabel(filteredPoints.at(-1)?.date ?? filteredPoints[0].date)}</span></div>
    </div>
  );
}

function ProviderIcon({ source }: { source: "CoinGecko" | "DefiLlama" }) {
  return <span className={`provider-icon provider-icon-${source.toLowerCase()}`} aria-hidden="true">{source === "CoinGecko" ? "CG" : "DL"}</span>;
}

function MetricStatus({ source }: { source: "CoinGecko" | "DefiLlama" }) {
  return <span className="metric-source"><ProviderIcon source={source} /> {source}</span>;
}

export function ChainDetailClient({ chain }: { chain: ChainDefinition }) {
  const [metrics, setMetrics] = useState<ChainMetrics | null>(null);
  const [period, setPeriod] = useState<MetricPeriod>("1d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isTracked, toggleChain } = useTrackedChains();
  const tracked = isTracked(chain.key);

  const loadMetrics = useCallback(async (signal?: AbortSignal, force = false) => {
    try {
      const response = await fetch(`/api/chains/${chain.key}/metrics${force ? "?fresh=1" : ""}`, { signal });
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
    void loadMetrics(undefined, true);
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
          <div className="metric-feed-status"><span><i /> Auto-refresh 60s</span><small>{metrics ? `Updated ${new Date(metrics.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for providers"}</small></div>
          <div className="metric-provider-list"><MetricStatus source="CoinGecko" /><MetricStatus source="DefiLlama" /></div>
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
              <p>{metrics.asset.note}{metrics.asset.providerUpdatedAt ? ` Provider update ${new Date(metrics.asset.providerUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : ""}</p>
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
          <header><div><span>TVL HISTORY</span><h2>Liquidity trend · {period.toUpperCase()}</h2></div><div className="chart-source"><MetricStatus source="DefiLlama" /><small>Latest provider data</small></div></header>
          {metrics?.tvl?.chart ? <InteractiveTvlChart points={metrics.tvl.chart} period={period} /> : <div className="chart-unavailable">DefiLlama has not indexed usable TVL history for this network.</div>}
        </article>

        <div className="chain-method-note">
          <span>METHOD</span>
          <p>Harga dan market cap berasal dari CoinGecko. TVL, revenue, dan earnings berasal dari DefiLlama. “Earnings” memakai holder revenue, bukan laba bersih perusahaan. Chain testnet atau chain yang belum diindeks tidak diberi angka buatan.</p>
        </div>
      </section>
    </main>
  );
}
