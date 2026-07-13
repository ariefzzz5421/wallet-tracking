import { NextResponse } from "next/server";
import { CHAIN_MAP, isChainKey, type ChainKey } from "../../lib/chains";
import { errorMessage, fetchJson, getEnv, numberValue, zerionFetch } from "../../lib/server/providers";

type Timeframe = "day" | "week" | "month" | "allTime";
type WalletInput = { id: string; label: string; address: string; chain: ChainKey };

export type ProfitRow = {
  walletId: string;
  label: string;
  address: string;
  chain: ChainKey;
  totalPnl: number;
  roi: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  fees: number | null;
  invested: number | null;
  source: "Zerion" | "Hyperliquid";
  measuredAt: string;
};

function sinceFor(timeframe: Timeframe) {
  const now = new Date();
  if (timeframe === "day") now.setUTCDate(now.getUTCDate() - 1);
  if (timeframe === "week") now.setUTCDate(now.getUTCDate() - 7);
  if (timeframe === "month") now.setUTCMonth(now.getUTCMonth() - 1);
  return timeframe === "allTime" ? null : now.toISOString();
}

async function zerionPnl(wallet: WalletInput, timeframe: Timeframe): Promise<ProfitRow> {
  const query = new URLSearchParams({ currency: "usd" });
  const since = sinceFor(timeframe);
  if (since) query.set("filter[since]", since);
  if (CHAIN_MAP[wallet.chain].zerionId) query.set("filter[chain_ids]", CHAIN_MAP[wallet.chain].zerionId!);
  const result = await zerionFetch<{ data?: { attributes?: Record<string, unknown> } }>(`/v1/wallets/${wallet.address}/pnl?${query}`);
  const attributes = result.data?.attributes ?? {};
  const totalPnl = numberValue(attributes.total_gain);
  const relative = numberValue(attributes.relative_total_gain_percentage);
  return {
    walletId: wallet.id,
    label: wallet.label,
    address: wallet.address,
    chain: wallet.chain,
    totalPnl,
    roi: Number.isFinite(relative) ? relative : null,
    realizedPnl: numberValue(attributes.realized_gain),
    unrealizedPnl: numberValue(attributes.unrealized_gain),
    fees: numberValue(attributes.total_fee ?? attributes.fees),
    invested: numberValue(attributes.invested ?? attributes.total_invested),
    source: "Zerion",
    measuredAt: new Date().toISOString(),
  };
}

async function hyperliquidPnl(wallet: WalletInput, timeframe: Timeframe): Promise<ProfitRow> {
  const { HYPERLIQUID_API_URL } = getEnv();
  const portfolio = await fetchJson<Array<[Timeframe, { accountValueHistory?: Array<[number, string]>; pnlHistory?: Array<[number, string]>; vlm?: string }]>>(
    `${HYPERLIQUID_API_URL}/info`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "portfolio", user: wallet.address }) },
  );
  const data = portfolio.find(([period]) => period === timeframe)?.[1];
  if (!data) throw new Error(`Hyperliquid has no ${timeframe} portfolio history for this wallet.`);
  const history = data.pnlHistory ?? [];
  const totalPnl = numberValue(history.at(-1)?.[1]);
  const accountHistory = data.accountValueHistory ?? [];
  const startingValue = numberValue(accountHistory[0]?.[1]);
  return {
    walletId: wallet.id,
    label: wallet.label,
    address: wallet.address,
    chain: "hyperliquid",
    totalPnl,
    roi: startingValue > 0 ? (totalPnl / startingValue) * 100 : null,
    realizedPnl: null,
    unrealizedPnl: null,
    fees: null,
    invested: startingValue || null,
    source: "Hyperliquid",
    measuredAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { wallets?: WalletInput[]; timeframe?: Timeframe };
    const timeframe: Timeframe = ["day", "week", "month", "allTime"].includes(body.timeframe || "") ? body.timeframe! : "week";
    const wallets = (body.wallets ?? []).filter((wallet) => wallet?.id && wallet?.address && isChainKey(wallet.chain)).slice(0, 30);
    const errors: Array<{ walletId: string; message: string }> = [];
    const rows = (await Promise.all(wallets.map(async (wallet) => {
      try {
        if (wallet.chain === "hyperliquid") return await hyperliquidPnl(wallet, timeframe);
        if (!getEnv().ZERION_API_KEY) throw new Error("Zerion API key is required for historical PnL.");
        if (!CHAIN_MAP[wallet.chain].zerionId) throw new Error(`${CHAIN_MAP[wallet.chain].name} PnL is not supported by the configured provider.`);
        return await zerionPnl(wallet, timeframe);
      } catch (error) {
        errors.push({ walletId: wallet.id, message: errorMessage(error) });
        return null;
      }
    }))).filter((row): row is ProfitRow => row !== null).sort((a, b) => b.totalPnl - a.totalPnl);
    return NextResponse.json({ rows, errors, timeframe, configured: { zerion: Boolean(getEnv().ZERION_API_KEY), hyperliquid: true } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
