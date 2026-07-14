"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChainLogo } from "../components/ChainLogo";
import { useTrackedChains } from "../components/TrackedChainsProvider";
import { CHAINS, CHAIN_MAP, type ChainKey } from "../lib/chains";
import type { ChainMetrics } from "../lib/server/chain-metrics";

type OverviewResponse = { updatedAt: string; chains: ChainMetrics[]; error?: string };
type SortKey = "tvl" | "marketCap" | "revenue";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null | undefined) {
  return value == null ? "—" : moneyFormatter.format(value);
}

function formatChange(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function metricValue(metrics: ChainMetrics, sort: SortKey) {
  if (sort === "marketCap") return metrics.asset?.marketCapUsd ?? -1;
  if (sort === "revenue") return metrics.revenue?.values["1m"] ?? -1;
  return metrics.tvl?.currentUsd ?? -1;
}

function MiniTvlChart({ points }: { points: Array<{ date: number; value: number }> }) {
  const chart = points.slice(-90);
  if (chart.length < 2) return <div className="chain-preview-empty">TVL history belum tersedia.</div>;
  const values = chart.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = chart.map((point, index) => {
    const x = (index / (chart.length - 1)) * 100;
    const y = 43 - ((point.value - min) / range) * 37;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg className="chain-preview-chart" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="90-day TVL trend">
      <path className="chain-preview-grid" d="M0,12 H100 M0,24 H100 M0,36 H100" />
      <path className="chain-preview-area" d={`${path} L100,48 L0,48 Z`} />
      <path className="chain-preview-line" d={path} />
    </svg>
  );
}

export default function ChainsPage() {
  const { trackedChains, isTracked, toggleChain } = useTrackedChains();
  const [metrics, setMetrics] = useState<ChainMetrics[]>([]);
  const [selected, setSelected] = useState<ChainKey | null>(null);
  const [sort, setSort] = useState<SortKey>("tvl");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadOverview = useCallback(async (fresh = false, signal?: AbortSignal) => {
    if (fresh) setRefreshing(true);
    try {
      const response = await fetch(`/api/chains/overview${fresh ? "?fresh=1" : ""}`, { signal });
      const result = await response.json() as OverviewResponse;
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
      setMetrics(result.chains);
      setUpdatedAt(result.updatedAt);
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Chain metrics are unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void loadOverview(false, controller.signal), 0);
    const timer = window.setInterval(() => void loadOverview(false), 60_000);
    return () => {
      window.clearTimeout(initial);
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadOverview]);

  const sorted = useMemo(() => [...metrics].sort((a, b) => metricValue(b, sort) - metricValue(a, sort)), [metrics, sort]);
  const preview = selected ? metrics.find((item) => item.chain === selected) ?? null : null;

  return (
    <main>
      <section className="page-hero shell chains-hero">
        <div className="eyebrow"><span /> Chain intelligence</div>
        <div className="compact-hero">
          <div>
            <h1>Choose your<br />networks.</h1>
            <p>Bandingkan TVL, tren, market cap, revenue, dan earnings dari setiap network.</p>
          </div>
          <div className="tracked-counter"><strong>{trackedChains.length}</strong><span>of {CHAINS.length}<br />tracked</span></div>
        </div>
      </section>

      <section className="chain-market-section" aria-labelledby="chain-market-title">
        <div className="shell chain-market-toolbar">
          <div>
            <span className="live-indicator"><i /> Live overview</span>
            <h2 id="chain-market-title">Chain market board</h2>
          </div>
          <div className="chain-sort-controls" aria-label="Sort chain ranking">
            <span>Rank by</span>
            {(["tvl", "marketCap", "revenue"] as const).map((key) => (
              <button type="button" key={key} className={sort === key ? "active" : ""} onClick={() => setSort(key)}>
                {key === "marketCap" ? "Market cap" : key}
              </button>
            ))}
            <button type="button" className="chain-refresh" disabled={refreshing} onClick={() => void loadOverview(true)}>
              {refreshing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="shell chain-table-shell">
          {error && <div className="chain-table-error" role="alert"><strong>Data feed interrupted.</strong> {error}. Cached or unavailable values are shown honestly.</div>}
          <div className="chain-table-scroll">
            <table className="chain-market-table">
              <thead>
                <tr>
                  <th aria-label="Track" />
                  <th># Chain</th>
                  <th>Protocols</th>
                  <th>TVL</th>
                  <th>1D</th>
                  <th>1W</th>
                  <th>1M</th>
                  <th>Market cap</th>
                  <th>Revenue 30D</th>
                  <th>Earnings 30D</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 7 }, (_, index) => (
                  <tr className="chain-skeleton-row" key={index}><td colSpan={11}><span /></td></tr>
                ))}
                {!loading && sorted.map((item, index) => {
                  const chain = CHAIN_MAP[item.chain];
                  const tracked = isTracked(item.chain);
                  const expanded = selected === item.chain;
                  const defiLlamaUrl = chain.defiLlamaSlug ? `https://defillama.com/chain/${chain.defiLlamaSlug}` : null;
                  return (
                    <tr className={expanded ? "selected" : ""} key={item.chain}>
                      <td>
                        <button type="button" className="chain-bookmark" aria-label={`${tracked ? "Stop tracking" : "Track"} ${chain.name}`} aria-pressed={tracked} onClick={() => toggleChain(item.chain)}>{tracked ? "★" : "☆"}</button>
                      </td>
                      <td>
                        <div className="chain-rank-identity">
                          <b>{index + 1}</b><ChainLogo chain={item.chain} size={36} />
                          <span><strong>{chain.name}</strong><small>{chain.layer} · {chain.status}</small></span>
                        </div>
                      </td>
                      <td>{item.revenue?.protocolCount ?? "—"}</td>
                      <td><strong>{formatMoney(item.tvl?.currentUsd)}</strong></td>
                      {(["1d", "1w", "1m"] as const).map((period) => {
                        const value = item.tvl?.changes[period];
                        return <td className={value == null ? "muted" : value >= 0 ? "positive" : "negative"} key={period}>{formatChange(value)}</td>;
                      })}
                      <td>{formatMoney(item.asset?.marketCapUsd)}</td>
                      <td>{formatMoney(item.revenue?.values["1m"])}</td>
                      <td>{formatMoney(item.earnings?.values["1m"])}</td>
                      <td>
                        <div className="chain-row-actions">
                          <button type="button" className="chain-icon-button" aria-label={`${expanded ? "Close" : "Open"} ${chain.name} summary`} title={`${expanded ? "Close" : "Open"} summary`} aria-expanded={expanded} onClick={() => setSelected(expanded ? null : item.chain)}>{expanded ? "×" : "◎"}</button>
                          {defiLlamaUrl && <a className="chain-source-button" href={defiLlamaUrl} target="_blank" rel="noreferrer" aria-label={`Open ${chain.name} on DefiLlama`} title="DefiLlama"><span className="provider-icon provider-icon-defillama">DL</span></a>}
                          <Link className="chain-icon-button" href={`/chains/${item.chain}`} aria-label={`Open ${chain.name} metrics`} title="Huntlist metrics">↗</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {preview && (
            <article className="chain-row-preview" aria-live="polite">
              <div className="chain-preview-heading">
                <ChainLogo chain={preview.chain} size={56} />
                <div><h3>{CHAIN_MAP[preview.chain].name}</h3><p>{CHAIN_MAP[preview.chain].description}</p></div>
              </div>
              <div className="chain-preview-visual">
                <div><span>TVL · last 90 days</span><strong>{formatMoney(preview.tvl?.currentUsd)}</strong></div>
                <MiniTvlChart points={preview.tvl?.chart ?? []} />
              </div>
              <div className="chain-preview-metrics">
                <span><small>Asset price</small><strong>{formatMoney(preview.asset?.priceUsd)}</strong></span>
                <span><small>TVL 1Y</small><strong className={(preview.tvl?.changes["1y"] ?? 0) >= 0 ? "positive" : "negative"}>{formatChange(preview.tvl?.changes["1y"])}</strong></span>
                <span><small>Revenue 1Y</small><strong>{formatMoney(preview.revenue?.values["1y"])}</strong></span>
                <span><small>Earnings 1Y</small><strong>{formatMoney(preview.earnings?.values["1y"])}</strong></span>
              </div>
              <Link className="chain-preview-link" href={`/chains/${preview.chain}`} aria-label={`Open ${CHAIN_MAP[preview.chain].name} full metrics`} title="Open full metrics"><b>↗</b></Link>
            </article>
          )}

          <footer className="chain-table-footer">
            <span className="chain-footer-sources">
              <a href="https://www.coingecko.com" target="_blank" rel="noreferrer" aria-label="CoinGecko" title="CoinGecko"><i className="provider-icon provider-icon-coingecko">CG</i></a>
              <a href="https://defillama.com/chains" target="_blank" rel="noreferrer" aria-label="DefiLlama" title="DefiLlama"><i className="provider-icon provider-icon-defillama">DL</i></a>
            </span>
            <span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting to data feeds"}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
