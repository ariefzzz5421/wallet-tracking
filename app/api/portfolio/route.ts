import { address, createSolanaRpc } from "@solana/kit";
import { createPublicClient, formatEther, http } from "viem";
import { NextResponse } from "next/server";
import { CHAIN_MAP, isChainKey, isWalletAddress, type ChainKey } from "../../lib/chains";
import { errorMessage, fetchJson, getEnv, numberValue, zerionFetch } from "../../lib/server/providers";

type PortfolioResult = {
  balanceUsd: number | null;
  nativeAmount?: number;
  nativeSymbol?: string;
  assetCount: number;
  coverage: string;
  warning?: string;
  status: "live" | "partial" | "testnet";
  refreshedAt: string;
};
type HyperPerpsState = { marginSummary?: { accountValue?: string | number }; assetPositions?: unknown[] };
type HyperSpotState = { balances?: Array<{ coin?: string; total?: string | number }> };

const BLOCKSCOUT: Partial<Record<ChainKey, string>> = {
  ethereum: "https://eth.blockscout.com",
  base: "https://base.blockscout.com",
  robinhood: "https://explorer-mainnet.rpc.r0ar.io",
};

async function fromZerion(walletAddress: string, chain: ChainKey): Promise<PortfolioResult> {
  const chainId = CHAIN_MAP[chain].zerionId;
  const query = new URLSearchParams({
    currency: "usd",
    "filter[trash]": "only_non_trash",
    sort: "-value",
  });
  if (chainId) query.set("filter[chain_ids]", chainId);
  const body = await zerionFetch<{ data?: Array<{ attributes?: { value?: number | string; quantity?: { float?: number }; fungible_info?: { symbol?: string } } }> }>(
    `/v1/wallets/${walletAddress}/positions/?${query}`,
  );
  const positions = body.data ?? [];
  return {
    balanceUsd: positions.reduce((sum, item) => sum + numberValue(item.attributes?.value), 0),
    assetCount: positions.length,
    coverage: `Zerion portfolio · ${CHAIN_MAP[chain].name}`,
    status: "live",
    refreshedAt: new Date().toISOString(),
  };
}

async function fromBlockscout(walletAddress: string, chain: ChainKey): Promise<PortfolioResult> {
  const host = BLOCKSCOUT[chain];
  if (!host) throw new Error("No Blockscout provider configured");
  const [account, tokens] = await Promise.all([
    fetchJson<{ coin_balance?: string; exchange_rate?: string }>(`${host}/api/v2/addresses/${walletAddress}`),
    fetchJson<Array<{ value?: string; token?: { decimals?: string; exchange_rate?: string } }>>(`${host}/api/v2/addresses/${walletAddress}/token-balances`).catch(() => []),
  ]);
  const nativeAmount = Number(formatEther(BigInt(account.coin_balance || "0")));
  const nativeUsd = nativeAmount * numberValue(account.exchange_rate);
  const tokenUsd = tokens.reduce((sum, holding) => {
    const decimals = Number(holding.token?.decimals || 0);
    const amount = numberValue(holding.value) / (10 ** decimals || 1);
    return sum + amount * numberValue(holding.token?.exchange_rate);
  }, 0);
  return {
    balanceUsd: nativeUsd + tokenUsd,
    nativeAmount,
    nativeSymbol: chain === "ethereum" || chain === "base" ? "ETH" : "RHC",
    assetCount: tokens.length + (nativeAmount > 0 ? 1 : 0),
    coverage: `Blockscout indexed portfolio · ${CHAIN_MAP[chain].name}`,
    warning: "DeFi positions and unpriced tokens may be excluded.",
    status: "partial",
    refreshedAt: new Date().toISOString(),
  };
}

async function fromEvmRpc(walletAddress: string, chain: ChainKey): Promise<PortfolioResult> {
  const env = getEnv();
  const urls: Partial<Record<ChainKey, string | undefined>> = {
    ethereum: env.ETHEREUM_RPC_URL,
    base: env.BASE_RPC_URL,
    tempo: env.TEMPO_RPC_URL,
    arc: env.ARC_RPC_URL,
    robinhood: env.ROBINHOOD_RPC_URL,
  };
  const rpcUrl = urls[chain];
  if (!rpcUrl) throw new Error(`${chain.toUpperCase()} RPC URL is not configured`);
  const client = createPublicClient({ transport: http(rpcUrl) });
  const raw = await client.getBalance({ address: walletAddress as `0x${string}` });
  return {
    balanceUsd: null,
    nativeAmount: Number(formatEther(raw)),
    nativeSymbol: chain === "tempo" ? "USD" : chain === "arc" ? "USDC" : "ETH",
    assetCount: raw > 0n ? 1 : 0,
    coverage: `${CHAIN_MAP[chain].name} native balance only`,
    warning: "No reliable USD token pricing is configured for this network.",
    status: CHAIN_MAP[chain].status === "testnet" ? "testnet" : "partial",
    refreshedAt: new Date().toISOString(),
  };
}

async function fromSolana(walletAddress: string): Promise<PortfolioResult> {
  const { SOLANA_RPC_URL } = getEnv();
  const rpc = createSolanaRpc(SOLANA_RPC_URL as `https://${string}`);
  const result = await rpc.getBalance(address(walletAddress), { commitment: "confirmed" }).send();
  const nativeAmount = Number(result.value) / 1_000_000_000;
  return {
    balanceUsd: null,
    nativeAmount,
    nativeSymbol: "SOL",
    assetCount: nativeAmount > 0 ? 1 : 0,
    coverage: "Solana native balance via official SDK",
    warning: "Add Zerion to include SPL tokens and USD valuation.",
    status: "partial",
    refreshedAt: new Date().toISOString(),
  };
}

async function fromHyperliquid(walletAddress: string): Promise<PortfolioResult> {
  const { HYPERLIQUID_API_URL } = getEnv();
  const post = <T,>(type: string) => fetchJson<T>(`${HYPERLIQUID_API_URL}/info`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, user: walletAddress }),
  });
  const [perps, spot] = await Promise.all([post<HyperPerpsState>("clearinghouseState"), post<HyperSpotState>("spotClearinghouseState")]);
  const perpsValue = numberValue(perps?.marginSummary?.accountValue);
  const spotBalances = Array.isArray(spot?.balances) ? spot.balances : [];
  const spotUsdc = spotBalances
    .filter((item) => item.coin === "USDC" || item.coin === "USDT0")
    .reduce((sum, item) => sum + numberValue(item.total), 0);
  const assetCount = (perps?.assetPositions?.length ?? 0) + spotBalances.filter((item) => numberValue(item.total) > 0).length;
  return {
    balanceUsd: perpsValue + spotUsdc,
    assetCount,
    coverage: "HyperCore perps account value + stable spot balance",
    warning: "Non-stable spot assets are excluded until a price provider is configured.",
    status: "partial",
    refreshedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { address?: string; chain?: string };
    if (!isChainKey(body.chain) || !body.address || !isWalletAddress(body.chain, body.address)) {
      return NextResponse.json({ error: "Valid chain and wallet address are required." }, { status: 400 });
    }
    const chain = body.chain;
    let result: PortfolioResult;
    if (chain === "hyperliquid") {
      result = await fromHyperliquid(body.address);
    } else if ((chain === "ethereum" || chain === "base" || chain === "solana") && getEnv().ZERION_API_KEY) {
      result = await fromZerion(body.address, chain);
    } else if (chain === "solana") {
      result = await fromSolana(body.address);
    } else if (BLOCKSCOUT[chain]) {
      result = await fromBlockscout(body.address, chain).catch(() => fromEvmRpc(body.address!, chain));
    } else {
      result = await fromEvmRpc(body.address, chain);
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
