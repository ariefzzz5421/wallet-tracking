import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

type AssetDefinition = {
  id: string;
  symbol: string;
  yahooSymbol: string;
  coingeckoId: string;
};

type TickerItem = {
  id: string;
  symbol: string;
  priceUsd: number;
  change24h: number | null;
  updatedAt: string | null;
  source: "Yahoo Finance" | "CoinGecko";
  sourceUrl: string;
};

const ASSETS: AssetDefinition[] = [
  { id: "ethereum", symbol: "ETH", yahooSymbol: "ETH-USD", coingeckoId: "ethereum" },
  { id: "solana", symbol: "SOL", yahooSymbol: "SOL-USD", coingeckoId: "solana" },
  { id: "hyperliquid", symbol: "HYPE", yahooSymbol: "HYPE32196-USD", coingeckoId: "hyperliquid" },
];

type YahooResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
  };
};

type CoinGeckoResponse = Record<string, {
  usd?: number;
  usd_24h_change?: number;
  last_updated_at?: number;
}>;

let tickerCache: { expiresAt: number; value: Promise<TickerItem[]> } | null = null;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 7_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 Huntlist/1.0", ...init.headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fromYahoo(asset: AssetDefinition): Promise<TickerItem> {
  const payload = await fetchJson<YahooResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?interval=1d&range=5d`,
  );
  const meta = payload.chart?.result?.[0]?.meta;
  const priceUsd = finite(meta?.regularMarketPrice);
  const previous = finite(meta?.chartPreviousClose) ?? finite(meta?.previousClose);
  if (priceUsd === null) throw new Error("Yahoo Finance returned no price");
  const timestamp = finite(meta?.regularMarketTime);
  return {
    id: asset.id,
    symbol: asset.symbol,
    priceUsd,
    change24h: previous && previous > 0 ? ((priceUsd - previous) / previous) * 100 : null,
    updatedAt: timestamp ? new Date(timestamp * 1_000).toISOString() : null,
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(asset.yahooSymbol)}`,
  };
}

async function fromCoinGecko(assets: AssetDefinition[]): Promise<TickerItem[]> {
  if (!assets.length) return [];
  const params = new URLSearchParams({
    ids: assets.map((asset) => asset.coingeckoId).join(","),
    vs_currencies: "usd",
    include_24hr_change: "true",
    include_last_updated_at: "true",
  });
  const demoKey = process.env.COINGECKO_API_KEY;
  const payload = await fetchJson<CoinGeckoResponse>(
    `https://api.coingecko.com/api/v3/simple/price?${params}`,
    demoKey ? { headers: { "x-cg-demo-api-key": demoKey } } : {},
  );
  return assets.flatMap((asset) => {
    const value = payload[asset.coingeckoId];
    const priceUsd = finite(value?.usd);
    if (priceUsd === null) return [];
    const timestamp = finite(value?.last_updated_at);
    return [{
      id: asset.id,
      symbol: asset.symbol,
      priceUsd,
      change24h: finite(value?.usd_24h_change),
      updatedAt: timestamp ? new Date(timestamp * 1_000).toISOString() : null,
      source: "CoinGecko" as const,
      sourceUrl: `https://www.coingecko.com/en/coins/${asset.coingeckoId}`,
    }];
  });
}

async function getTicker(force = false) {
  if (!force && tickerCache && tickerCache.expiresAt > Date.now()) return tickerCache.value;
  const value = (async () => {
    const yahooResults = await Promise.allSettled(ASSETS.map(fromYahoo));
    const yahooItems = yahooResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const covered = new Set(yahooItems.map((item) => item.id));
    const fallback = await fromCoinGecko(ASSETS.filter((asset) => !covered.has(asset.id))).catch(() => []);
    const combined = new Map([...fallback, ...yahooItems].map((item) => [item.id, item]));
    return ASSETS.flatMap((asset) => {
      const item = combined.get(asset.id);
      return item ? [item] : [];
    });
  })().catch((error) => {
    tickerCache = null;
    throw error;
  });
  tickerCache = { expiresAt: Date.now() + 30_000, value };
  return value;
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("fresh") === "1";
  const items = await getTicker(force);
  return NextResponse.json({ items, updatedAt: new Date().toISOString() }, {
    headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
