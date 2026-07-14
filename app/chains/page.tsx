"use client";

import Link from "next/link";
import { ChainLogo } from "../components/ChainLogo";
import { useTrackedChains } from "../components/TrackedChainsProvider";
import { CHAINS } from "../lib/chains";

export default function ChainsPage() {
  const { trackedChains, isTracked, toggleChain } = useTrackedChains();

  return (
    <main>
      <section className="page-hero shell chains-hero">
        <div className="eyebrow"><span /> Chain intelligence</div>
        <div className="compact-hero">
          <div>
            <h1>Choose your<br />networks.</h1>
            <p>Pilih chain yang ingin dipantau. Setiap halaman memiliki harga aset, market cap, TVL, revenue, dan earnings dengan fallback yang jujur saat data belum tersedia.</p>
          </div>
          <div className="tracked-counter"><strong>{trackedChains.length}</strong><span>of {CHAINS.length}<br />tracked</span></div>
        </div>
      </section>

      <section className="shell chain-directory" aria-label="Available chains">
        {CHAINS.map((chain, index) => {
          const tracked = isTracked(chain.key);
          return (
            <article className={`chain-directory-card ${tracked ? "tracked" : ""}`} key={chain.key}>
              <div className="chain-card-top">
                <span className="chain-index">{String(index + 1).padStart(2, "0")}</span>
                <ChainLogo chain={chain.key} size={58} />
                <button
                  type="button"
                  className="track-toggle"
                  aria-pressed={tracked}
                  onClick={() => toggleChain(chain.key)}
                >
                  {tracked ? "Tracking" : "Track"}
                </button>
              </div>
              <div className="chain-card-copy">
                <div><span>{chain.layer}</span><i className={`status-dot ${chain.status}`} /> <small>{chain.status}</small></div>
                <h2>{chain.name}</h2>
                <p>{chain.description}</p>
              </div>
              <div className="chain-card-foot">
                <span>{chain.marketAsset ? `${chain.marketAsset.symbol} ${chain.marketAsset.role} asset` : "No market-valued native token"}</span>
                <Link href={`/chains/${chain.key}`}>Open metrics <b>↗</b></Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
