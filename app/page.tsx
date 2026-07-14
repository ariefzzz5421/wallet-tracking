"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ChainPicker } from "./components/ChainPicker";
import { ChainFilterPicker, type ChainFilterValue } from "./components/ChainFilterPicker";
import { ChainLogo } from "./components/ChainLogo";
import { SAMPLE_WALLETS, useWatchlist, type WatchedWallet } from "./components/WatchlistProvider";
import { CHAINS, CHAIN_MAP, isWalletAddress, type ChainKey } from "./lib/chains";

const TIERS = [5_000, 10_000, 100_000, 1_000_000] as const;

function money(value: number | null) {
  if (value === null) return "Unpriced";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function tierFor(value: number | null) {
  if (value === null) return null;
  return [...TIERS].reverse().find((tier) => value >= tier) ?? null;
}

export default function Home() {
  const { wallets, ready, addWallet, updateWallet, removeWallet } = useWatchlist();
  const [chain, setChain] = useState<ChainKey>("ethereum");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<ChainFilterValue>("all");
  const [minimum, setMinimum] = useState<number>(5_000);
  const [message, setMessage] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);

  async function syncWallet(wallet: WatchedWallet) {
    updateWallet(wallet.id, { status: "syncing", error: undefined });
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: wallet.address, chain: wallet.chain }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Provider scan failed");
      updateWallet(wallet.id, { ...result, error: undefined });
    } catch (error) {
      updateWallet(wallet.id, { status: "error", error: error instanceof Error ? error.message : "Scan failed" });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanAddress = address.trim();
    if (!isWalletAddress(chain, cleanAddress)) {
      setMessage(chain === "solana" ? "Masukkan alamat Solana yang valid." : "Masukkan alamat 0x yang valid.");
      return;
    }
    if (wallets.some((wallet) => wallet.address.toLowerCase() === cleanAddress.toLowerCase() && wallet.chain === chain)) {
      setMessage("Wallet ini sudah ada di watchlist pada chain yang sama.");
      return;
    }
    const wallet = addWallet({ label: label.trim() || `${CHAIN_MAP[chain].short} wallet`, address: cleanAddress, chain });
    setAddress("");
    setLabel("");
    setMessage("Wallet tersimpan di perangkat ini. Sedang mengambil data…");
    await syncWallet(wallet);
    setMessage("");
  }

  async function syncAll() {
    setSyncingAll(true);
    await Promise.all(wallets.map(syncWallet));
    setSyncingAll(false);
  }

  const visible = useMemo(() => wallets
    .filter((wallet) => chainFilter === "all" || wallet.chain === chainFilter)
    .filter((wallet) => `${wallet.label} ${wallet.address}`.toLowerCase().includes(query.toLowerCase()))
    .filter((wallet) => wallet.balanceUsd === null || wallet.balanceUsd >= minimum)
    .sort((a, b) => (b.balanceUsd ?? -1) - (a.balanceUsd ?? -1)), [wallets, chainFilter, query, minimum]);

  const shownWallets = wallets.length ? visible : SAMPLE_WALLETS;
  const totalTracked = wallets.reduce((sum, wallet) => sum + (wallet.balanceUsd ?? 0), 0);
  const qualified = wallets.filter((wallet) => (wallet.balanceUsd ?? 0) >= minimum).length;

  return (
    <main>
      <section className="hero shell">
        <div className="eyebrow"><span /> Multi-chain wallet intelligence</div>
        <div className="hero-grid">
          <div>
            <h1>Find wallets<br />worth watching.</h1>
            <p>Paste any public address, group it by chain, and turn raw on-chain activity into a focused hunting list.</p>
          </div>
          <div className="hero-aside">
            <div className="network-stack" aria-label="Supported networks">
              {CHAINS.map((item) => <Link key={item.key} href={`/chains/${item.key}`} aria-label={`Open ${item.name} metrics`}><ChainLogo chain={item.key} size={44} /></Link>)}
            </div>
            <p><strong>7 networks</strong><br />One watchlist. <Link href="/chains">Choose chains →</Link></p>
          </div>
        </div>
      </section>

      <section className="shell add-panel">
        <div className="section-heading">
          <div><span className="step">01</span><h2>Add a wallet</h2></div>
          <p>Data watchlist tersimpan lokal di browser ini.</p>
        </div>
        <form className="wallet-form" onSubmit={handleSubmit}>
          <div className="wallet-field"><span id="network-field-label">Network</span><ChainPicker value={chain} onChange={setChain} labelId="network-field-label" /></div>
          <label><span>Wallet label</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Smart money #1" maxLength={40} /></label>
          <label className="address-field"><span>Public address</span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={chain === "solana" ? "Solana address" : "0x…"} spellCheck={false} /></label>
          <button className="primary-button" type="submit" disabled={!ready}>Track wallet <span>↗</span></button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
      </section>

      <section className="stats-strip">
        <div className="shell stats-grid">
          <div><span>WATCHED</span><strong>{wallets.length}</strong><small>saved wallets</small></div>
          <div><span>QUALIFIED</span><strong>{qualified}</strong><small>above {money(minimum)}</small></div>
          <div><span>TRACKED VALUE</span><strong>{money(totalTracked)}</strong><small>priced assets only</small></div>
          <div><span>UNPRICED</span><strong>{wallets.filter((wallet) => wallet.balanceUsd === null).length}</strong><small>needs provider coverage</small></div>
        </div>
      </section>

      <section className="shell watchlist-section">
        <div className="section-heading">
          <div><span className="step">02</span><h2>Balance leaderboard</h2>{!wallets.length && <b className="preview-badge">PREVIEW DATA</b>}</div>
          <div className="heading-actions"><button className="text-button" onClick={syncAll} disabled={!wallets.length || syncingAll}>{syncingAll ? "Syncing…" : "Refresh all"}</button><Link href="/feed" className="text-link">Open live feed →</Link></div>
        </div>

        <div className="filter-row">
          <label className="search-control"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search label or address" /></label>
          <ChainFilterPicker value={chainFilter} onChange={setChainFilter} label="Filter watchlist by network" />
          <div className="tier-tabs" aria-label="Minimum balance">{TIERS.map((tier) => <button key={tier} className={minimum === tier ? "active" : ""} onClick={() => setMinimum(tier)}>{money(tier)}+</button>)}</div>
        </div>

        <div className="wallet-table">
          <div className="table-head"><span># / Wallet</span><span>Network</span><span>Coverage</span><span>USD balance</span><span /></div>
          {shownWallets.map((wallet, index) => {
            const tier = tierFor(wallet.balanceUsd);
            return <article className="wallet-row" key={wallet.id}>
              <div className="wallet-identity"><b>{String(index + 1).padStart(2, "0")}</b><ChainLogo chain={wallet.chain} size={38} /><div><strong>{wallet.label}</strong><code>{shortAddress(wallet.address)}</code></div></div>
              <div className="network-cell"><span>{CHAIN_MAP[wallet.chain].name}</span><small>{CHAIN_MAP[wallet.chain].status}</small></div>
              <div className="coverage-cell"><span className={`status-dot ${wallet.status}`} /> <span>{wallet.status === "syncing" ? "Scanning provider…" : wallet.error || wallet.coverage}</span></div>
              <div className="balance-cell"><strong>{money(wallet.balanceUsd)}</strong>{tier ? <small>Tier {money(tier)}+</small> : <small>Not ranked</small>}</div>
              <div className="row-actions">{wallets.length > 0 && <><button onClick={() => syncWallet(wallet)} aria-label={`Refresh ${wallet.label}`}>↻</button><button onClick={() => removeWallet(wallet.id)} aria-label={`Remove ${wallet.label}`}>×</button></>}</div>
            </article>;
          })}
          {wallets.length > 0 && !visible.length && <div className="empty-state"><strong>No wallet matches this filter.</strong><p>Turunkan minimum balance atau pilih network lain.</p></div>}
        </div>
        {!wallets.length && <p className="preview-note">Preview di atas hanya contoh tampilan, bukan wallet atau saldo nyata. Tambahkan wallet untuk mulai.</p>}
      </section>

      <section className="shell onward-grid">
        <Link href="/chains" className="onward-card ink"><span>03</span><div><small>CHAIN INTELLIGENCE</small><h3>Network Metrics</h3><p>Harga, market cap, TVL, revenue, dan earnings per chain.</p></div><b>↗</b></Link>
        <Link href="/feed" className="onward-card"><span>04</span><div><small>WATCHLIST ACTIVITY</small><h3>Wallet Feed</h3><p>Buy, sell, swap, transfer—diurutkan dari aktivitas terbaru.</p></div><b>↗</b></Link>
        <Link href="/profitable-wallets" className="onward-card lime"><span>05</span><div><small>PERFORMANCE</small><h3>Top Profitable</h3><p>Ranking PnL berdasarkan periode, bukan berdasarkan saldo terbesar.</p></div><b>↗</b></Link>
      </section>
    </main>
  );
}
