import { CHAIN_MAP, type ChainKey } from "../chains";

export type MetricPeriod = "1d" | "1w" | "1m" | "1y";

export type PeriodValues = Record<MetricPeriod, number | null>;

export type ChainMetrics = {
  chain: ChainKey;
  updatedAt: string;
  assetConfigured: boolean;
  asset: null | {
    name: string;
    symbol: string;
    role: "native" | "gas";
    note: string;
    priceUsd: number;
    marketCapUsd: number | null;
    change24h: number | null;
    source: "CoinGecko";
  };
  tvl: null | {
    currentUsd: number;
    changes: PeriodValues;
    chart: Array<{ date: number; value: number }>;
    source: "DefiLlama";
  };
  revenue: null | {
    values: PeriodValues;
    source: "DefiLlama";
  };
  earnings: null | {
    values: PeriodValues;
    source: "DefiLlama";
    definition: string;
  };
  unavailable: string[];
};

type CacheEntry = { expiresAt: number; value: ChainMetrics };
const metricCache = new Map<ChainKey, CacheEntry>();

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", "user-agent": "Huntlist/1.0", ...init.headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

async function getAsset(chain: ChainKey): Promise<ChainMetrics["asset"]> {
  const asset = CHAIN_MAP[chain].marketAsset;
  if (!asset) return null;

  const params = new URLSearchParams({
    ids: asset.coingeckoId,
    vs_currencies: "usd",
    include_market_cap: "true",
    include_24hr_change: "true",
  });
  const demoKey = process.env.COINGECKO_API_KEY;
  const payload = await fetchJson<Record<string, Record<string, unknown>>>(
    `https://api.coingecko.com/api/v3/simple/price?${params}`,
    demoKey ? { headers: { "x-cg-demo-api-key": demoKey } } : {},
    8_000,
  );
  const market = payload[asset.coingeckoId];
  const priceUsd = finiteNumber(market?.usd);
  if (priceUsd === null) throw new Error("CoinGecko returned no price");

  return {
    name: asset.name,
    symbol: asset.symbol,
    role: asset.role,
    note: asset.note,
    priceUsd,
    marketCapUsd: finiteNumber(market.usd_market_cap),
    change24h: finiteNumber(market.usd_24h_change),
    source: "CoinGecko",
  };
}

type TvlPoint = { date?: string | number; totalLiquidityUSD?: number };

function tvlChange(points: Array<{ date: number; value: number }>, seconds: number) {
  const latest = points.at(-1);
  if (!latest) return null;
  const target = latest.date - seconds;
  const baseline = [...points].reverse().find((point) => point.date <= target);
  if (!baseline || baseline.value <= 0) return null;
  return ((latest.value - baseline.value) / baseline.value) * 100;
}

async function getTvl(chain: ChainKey): Promise<ChainMetrics["tvl"]> {
  const name = CHAIN_MAP[chain].defiLlamaName;
  if (!name) return null;
  const payload = await fetchJson<TvlPoint[]>(`https://api.llama.fi/charts/${encodeURIComponent(name)}`);
  const points = payload
    .map((point) => ({ date: Number(point.date), value: Number(point.totalLiquidityUSD) }))
    .filter((point) => Number.isFinite(point.date) && Number.isFinite(point.value))
    .sort((a, b) => a.date - b.date);
  const latest = points.at(-1);
  if (!latest) throw new Error("DefiLlama returned no TVL history");

  const oneYearAgo = latest.date - 365 * 86_400;
  const recent = points.filter((point) => point.date >= oneYearAgo);
  const step = Math.max(1, Math.ceil(recent.length / 72));
  const chart = recent.filter((_, index) => index % step === 0);
  if (chart.at(-1)?.date !== latest.date) chart.push(latest);

  return {
    currentUsd: latest.value,
    changes: {
      "1d": tvlChange(points, 86_400),
      "1w": tvlChange(points, 7 * 86_400),
      "1m": tvlChange(points, 30 * 86_400),
      "1y": tvlChange(points, 365 * 86_400),
    },
    chart,
    source: "DefiLlama",
  };
}

type DimensionResponse = {
  total24h?: number;
  total7d?: number;
  total30d?: number;
  total1y?: number;
};

async function getDimension(chain: ChainKey, dataType: "dailyRevenue" | "dailyHoldersRevenue") {
  const slug = CHAIN_MAP[chain].defiLlamaSlug;
  if (!slug) return null;
  const query = new URLSearchParams({
    dataType,
    excludeTotalDataChart: "true",
    excludeTotalDataChartBreakdown: "true",
  });
  const payload = await fetchJson<DimensionResponse>(`https://api.llama.fi/overview/fees/${slug}?${query}`);
  return {
    values: {
      "1d": finiteNumber(payload.total24h),
      "1w": finiteNumber(payload.total7d),
      "1m": finiteNumber(payload.total30d),
      "1y": finiteNumber(payload.total1y),
    } satisfies PeriodValues,
    source: "DefiLlama" as const,
  };
}

export async function getChainMetrics(chain: ChainKey): Promise<ChainMetrics> {
  const cached = metricCache.get(chain);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [assetResult, tvlResult, revenueResult, earningsResult] = await Promise.allSettled([
    getAsset(chain),
    getTvl(chain),
    getDimension(chain, "dailyRevenue"),
    getDimension(chain, "dailyHoldersRevenue"),
  ]);
  const unavailable: string[] = [];
  if (assetResult.status === "rejected") unavailable.push("token market data");
  if (tvlResult.status === "rejected") unavailable.push("TVL history");
  if (revenueResult.status === "rejected") unavailable.push("revenue");
  if (earningsResult.status === "rejected") unavailable.push("earnings");

  const value: ChainMetrics = {
    chain,
    updatedAt: new Date().toISOString(),
    assetConfigured: Boolean(CHAIN_MAP[chain].marketAsset),
    asset: assetResult.status === "fulfilled" ? assetResult.value : null,
    tvl: tvlResult.status === "fulfilled" ? tvlResult.value : null,
    revenue: revenueResult.status === "fulfilled" ? revenueResult.value : null,
    earnings: earningsResult.status === "fulfilled" && earningsResult.value ? {
      ...earningsResult.value,
      definition: "Revenue distributed to token holders or liquidity providers, as categorized by DefiLlama. It is not accounting profit.",
    } : null,
    unavailable,
  };
  metricCache.set(chain, { expiresAt: Date.now() + 60_000, value });
  return value;
}
