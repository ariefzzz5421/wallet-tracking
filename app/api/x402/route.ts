import { NextResponse } from "next/server";

const X402SCAN_API = "https://www.x402scan.com/api/trpc";
const ALLOWED_RANGES = new Set([1, 7, 30]);
const ALLOWED_CHAINS = new Set(["base", "solana", "polygon", "optimism"]);

type Overall = {
  total_transactions?: number;
  total_amount?: number;
  unique_buyers?: number;
  unique_sellers?: number;
  latest_block_timestamp?: string | null;
};

type Bucket = {
  bucket_start?: string;
  total_transactions?: number;
  total_amount?: number;
  unique_buyers?: number;
  unique_sellers?: number;
};

type Transfer = {
  id?: string;
  amount?: number;
  decimals?: number;
  sender?: string;
  recipient?: string;
  tx_hash?: string;
  chain?: string;
  facilitator_id?: string;
  block_timestamp?: string;
};

type Facilitator = {
  facilitator_id?: string;
  tx_count?: number;
  total_amount?: number;
  unique_buyers?: number;
  unique_sellers?: number;
  chains?: string[];
  facilitator?: { name?: string; docsUrl?: string; color?: string };
};

type TrpcEnvelope<T> = {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string } };
};

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function amountUsd(value: unknown, decimals = 6) {
  return finite(value) / (10 ** decimals);
}

async function x402Query<T>(procedure: string, input: Record<string, unknown>) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetch(`${X402SCAN_API}/${procedure}?input=${encoded}`, {
    headers: { accept: "application/json", "user-agent": "Huntlist/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`x402scan returned HTTP ${response.status}`);
  const envelope = await response.json() as TrpcEnvelope<T>;
  const data = envelope.result?.data?.json;
  if (data === undefined) throw new Error(envelope.error?.json?.message || "x402scan returned no data");
  return data;
}

function explorerUrl(chain: string, hash: string) {
  if (chain === "solana") return `https://solscan.io/tx/${hash}`;
  if (chain === "polygon") return `https://polygonscan.com/tx/${hash}`;
  if (chain === "optimism") return `https://optimistic.etherscan.io/tx/${hash}`;
  return `https://basescan.org/tx/${hash}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedRange = Number(url.searchParams.get("range") || "30");
  const range = ALLOWED_RANGES.has(requestedRange) ? requestedRange : 30;
  const requestedChain = url.searchParams.get("chain") || "";
  const chain = ALLOWED_CHAINS.has(requestedChain) ? requestedChain : undefined;
  const baseInput = { timeframe: range, ...(chain ? { chain } : {}) };

  try {
    const [overall, buckets, transferPage, facilitatorPage] = await Promise.all([
      x402Query<Overall>("public.stats.overall", baseInput),
      x402Query<Bucket[]>("public.stats.bucketed", { ...baseInput, numBuckets: range === 1 ? 24 : 48 }),
      x402Query<{ items?: Transfer[] }>("public.transfers.list", {
        ...baseInput,
        sorting: { id: "block_timestamp", desc: true },
        pagination: { page_size: 12, page: 0 },
      }),
      x402Query<{ items?: Facilitator[] }>("public.facilitators.list", {
        ...baseInput,
        sorting: { id: "tx_count", desc: true },
        pagination: { page_size: 5, page: 0 },
      }),
    ]);

    const transactions = (transferPage.items || []).map((item, index) => {
      const hash = item.tx_hash || "";
      const itemChain = item.chain || chain || "base";
      return {
        id: item.id || `${hash}-${index}`,
        amountUsd: amountUsd(item.amount, finite(item.decimals) || 6),
        sender: item.sender || "",
        recipient: item.recipient || "",
        txHash: hash,
        chain: itemChain,
        facilitator: item.facilitator_id || "Unknown",
        timestamp: item.block_timestamp || "",
        explorerUrl: hash ? explorerUrl(itemChain, hash) : "https://www.x402scan.com/transactions",
      };
    });

    const facilitators = (facilitatorPage.items || []).map((item) => ({
      id: item.facilitator_id || "unknown",
      name: item.facilitator?.name || item.facilitator_id || "Unknown",
      color: item.facilitator?.color || "#8b8b83",
      docsUrl: item.facilitator?.docsUrl || "https://www.x402scan.com/facilitators",
      transactions: finite(item.tx_count),
      volumeUsd: amountUsd(item.total_amount),
      uniqueBuyers: finite(item.unique_buyers),
      uniqueSellers: finite(item.unique_sellers),
      chains: item.chains || [],
    }));

    return NextResponse.json({
      source: "x402scan",
      sourceUrl: "https://www.x402scan.com",
      sourceRepo: "https://github.com/ariefzzz5421/x402scan",
      range,
      chain: chain || "all",
      fetchedAt: new Date().toISOString(),
      stats: {
        transactions: finite(overall.total_transactions),
        volumeUsd: amountUsd(overall.total_amount),
        uniqueBuyers: finite(overall.unique_buyers),
        uniqueSellers: finite(overall.unique_sellers),
        latestAt: overall.latest_block_timestamp || null,
      },
      series: buckets.map((bucket) => ({
        timestamp: bucket.bucket_start || "",
        transactions: finite(bucket.total_transactions),
        volumeUsd: amountUsd(bucket.total_amount),
        buyers: finite(bucket.unique_buyers),
        sellers: finite(bucket.unique_sellers),
      })),
      facilitators,
      transactions,
    }, {
      headers: { "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "x402 dashboard is temporarily unavailable",
    }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
