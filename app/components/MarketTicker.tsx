"use client";

import { useCallback, useEffect, useState } from "react";

type TickerItem = {
  id: string;
  symbol: string;
  priceUsd: number;
  change24h: number | null;
  source: "Yahoo Finance" | "CoinGecko";
  sourceUrl: string;
};

type TickerResponse = { items?: TickerItem[] };

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  const loadTicker = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/market-ticker", { signal });
      const result = await response.json() as TickerResponse;
      if (response.ok && result.items?.length) setItems(result.items);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Keep the last successful tape visible when a free provider is rate-limited.
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void loadTicker(controller.signal), 0);
    const timer = window.setInterval(() => void loadTicker(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      controller.abort();
    };
  }, [loadTicker]);

  const tapeItems = items.length ? items : [
    { id: "eth-loading", symbol: "ETH", priceUsd: 0, change24h: null, source: "Yahoo Finance" as const, sourceUrl: "https://finance.yahoo.com/quote/ETH-USD" },
    { id: "sol-loading", symbol: "SOL", priceUsd: 0, change24h: null, source: "Yahoo Finance" as const, sourceUrl: "https://finance.yahoo.com/quote/SOL-USD" },
    { id: "hype-loading", symbol: "HYPE", priceUsd: 0, change24h: null, source: "Yahoo Finance" as const, sourceUrl: "https://finance.yahoo.com/quote/HYPE32196-USD" },
  ];
  return (
    <div className="market-ticker" aria-label="Live token market ticker">
      <div className="ticker-track">
        {[0, 1].map((setIndex) => (
          <div className="ticker-set" aria-hidden={setIndex === 1} key={setIndex}>
            {tapeItems.map((item, itemIndex) => {
              const change = item.change24h;
              return (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={`Data from ${item.source}`} className="ticker-item" key={`${setIndex}-${itemIndex}-${item.id}`}>
                  <strong>{item.symbol}</strong>
                  <span>{items.length ? `$${formatPrice(item.priceUsd)}` : "SYNC"}</span>
                  <b className={change == null ? "muted" : change >= 0 ? "positive" : "negative"}>
                    {change == null ? "·" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%`}
                  </b>
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
