import { NextResponse } from "next/server";
import { CHAIN_MAP, isChainKey, type ChainKey } from "../../lib/chains";
import { errorMessage, fetchJson, getEnv, numberValue, zerionFetch } from "../../lib/server/providers";

type WalletInput = { id: string; label: string; address: string; chain: ChainKey };
type ZerionTransfer = { value?: unknown; quantity?: unknown | { float?: unknown }; fungible_info?: { symbol?: string }; symbol?: string };
type ZerionAttributes = { operation_type?: string; transfers?: ZerionTransfer[]; mined_at?: string; confirmed_at?: string; hash?: string };
type HyperliquidFill = { side?: string; sz?: string | number; px?: string | number; coin?: string; time?: string | number; tid?: string | number; hash?: string };

export type FeedEvent = {
  id: string;
  walletId: string;
  walletLabel: string;
  address: string;
  chain: ChainKey;
  kind: "buy" | "sell" | "swap" | "transfer" | "deposit" | "withdraw" | "other";
  title: string;
  amount?: number;
  symbol?: string;
  valueUsd?: number;
  timestamp: string;
  hash?: string;
  source: "Zerion" | "Hyperliquid";
};

function normalizeKind(operation: string): FeedEvent["kind"] {
  const value = operation.toLowerCase();
  if (value.includes("trade") || value.includes("swap")) return "swap";
  if (value.includes("deposit")) return "deposit";
  if (value.includes("withdraw")) return "withdraw";
  if (value.includes("send") || value.includes("receive") || value.includes("transfer")) return "transfer";
  return "other";
}

async function zerionEvents(wallet: WalletInput): Promise<FeedEvent[]> {
  const query = new URLSearchParams({ currency: "usd", "page[size]": "20", "filter[trash]": "only_non_trash" });
  if (CHAIN_MAP[wallet.chain].zerionId) query.set("filter[chain_ids]", CHAIN_MAP[wallet.chain].zerionId!);
  const result = await zerionFetch<{ data?: Array<{ id?: string; attributes?: ZerionAttributes }> }>(
    `/v1/wallets/${wallet.address}/transactions/?${query}`,
  );
  return (result.data ?? []).map((item, index) => {
    const attributes = item.attributes ?? {};
    const transfers = Array.isArray(attributes.transfers) ? attributes.transfers : [];
    const primary = [...transfers].sort((a, b) => Math.abs(numberValue(b.value)) - Math.abs(numberValue(a.value)))[0];
    const operation = String(attributes.operation_type || "activity");
    return {
      id: item.id || `${wallet.id}-zerion-${index}`,
      walletId: wallet.id,
      walletLabel: wallet.label,
      address: wallet.address,
      chain: wallet.chain,
      kind: normalizeKind(operation),
      title: operation.replaceAll("_", " "),
      amount: primary ? Math.abs(numberValue(primary.quantity?.float ?? primary.quantity)) : undefined,
      symbol: primary?.fungible_info?.symbol || primary?.symbol,
      valueUsd: primary ? Math.abs(numberValue(primary.value)) : undefined,
      timestamp: attributes.mined_at || attributes.confirmed_at || new Date().toISOString(),
      hash: attributes.hash,
      source: "Zerion" as const,
    };
  });
}

async function hyperliquidEvents(wallet: WalletInput): Promise<FeedEvent[]> {
  const { HYPERLIQUID_API_URL } = getEnv();
  const fills = await fetchJson<HyperliquidFill[]>(`${HYPERLIQUID_API_URL}/info`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "userFills", user: wallet.address, aggregateByTime: true }),
  });
  return (fills ?? []).slice(-30).reverse().map((fill, index) => {
    const side = String(fill.side || "").toUpperCase();
    const kind = side === "B" ? "buy" : side === "A" ? "sell" : "other";
    const amount = Math.abs(numberValue(fill.sz));
    const price = numberValue(fill.px);
    return {
      id: `${wallet.id}-${fill.tid || fill.hash || index}`,
      walletId: wallet.id,
      walletLabel: wallet.label,
      address: wallet.address,
      chain: "hyperliquid",
      kind,
      title: kind === "buy" ? "Bought perp" : kind === "sell" ? "Sold perp" : "Perp fill",
      amount,
      symbol: fill.coin,
      valueUsd: amount * price,
      timestamp: new Date(numberValue(fill.time) || Date.now()).toISOString(),
      hash: fill.hash,
      source: "Hyperliquid" as const,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { wallets?: WalletInput[] };
    const wallets = (body.wallets ?? []).filter((wallet) => wallet?.id && wallet?.address && isChainKey(wallet.chain)).slice(0, 20);
    if (!wallets.length) return NextResponse.json({ events: [], errors: [], configured: { zerion: Boolean(getEnv().ZERION_API_KEY), hyperliquid: true } });

    const errors: Array<{ walletId: string; message: string }> = [];
    const eventGroups = await Promise.all(wallets.map(async (wallet) => {
      try {
        if (wallet.chain === "hyperliquid") return await hyperliquidEvents(wallet);
        if (!getEnv().ZERION_API_KEY) throw new Error("Zerion API key is required for this chain's activity feed.");
        return await zerionEvents(wallet);
      } catch (error) {
        errors.push({ walletId: wallet.id, message: errorMessage(error) });
        return [];
      }
    }));
    const events = eventGroups.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 100);
    return NextResponse.json({ events, errors, configured: { zerion: Boolean(getEnv().ZERION_API_KEY), hyperliquid: true } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
