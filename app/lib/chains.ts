export type ChainKey =
  | "ethereum"
  | "solana"
  | "hyperliquid"
  | "base"
  | "tempo"
  | "arc"
  | "robinhood";

export type ChainDefinition = {
  key: ChainKey;
  name: string;
  short: string;
  logo: string;
  status: "live" | "partial" | "testnet";
  zerionId?: string;
  explorer: string;
  layer: string;
  description: string;
  defiLlamaSlug?: string;
  defiLlamaName?: string;
  marketAsset?: {
    coingeckoId: string;
    name: string;
    symbol: string;
    role: "native" | "gas";
    note: string;
  };
};

export const CHAINS: ChainDefinition[] = [
  {
    key: "ethereum",
    name: "Ethereum",
    short: "ETH",
    logo: "/chains/ethereum.png",
    status: "live",
    zerionId: "ethereum",
    explorer: "https://eth.blockscout.com",
    layer: "Layer 1",
    description: "Settlement layer and the largest smart-contract ecosystem by secured value.",
    defiLlamaSlug: "ethereum",
    defiLlamaName: "Ethereum",
    marketAsset: {
      coingeckoId: "ethereum",
      name: "Ether",
      symbol: "ETH",
      role: "native",
      note: "Native asset of Ethereum.",
    },
  },
  {
    key: "solana",
    name: "Solana",
    short: "SOL",
    logo: "/chains/solana.png",
    status: "partial",
    zerionId: "solana",
    explorer: "https://solscan.io",
    layer: "Layer 1",
    description: "High-throughput execution layer with a broad trading and consumer-app ecosystem.",
    defiLlamaSlug: "solana",
    defiLlamaName: "Solana",
    marketAsset: {
      coingeckoId: "solana",
      name: "Solana",
      symbol: "SOL",
      role: "native",
      note: "Native asset of Solana.",
    },
  },
  {
    key: "hyperliquid",
    name: "Hyperliquid",
    short: "HYPE",
    logo: "/chains/hyperliquid.png",
    status: "live",
    explorer: "https://app.hyperliquid.xyz/explorer",
    layer: "Layer 1",
    description: "Trading-focused chain spanning HyperCore markets and HyperEVM applications.",
    defiLlamaSlug: "hyperliquid-l1",
    defiLlamaName: "Hyperliquid L1",
    marketAsset: {
      coingeckoId: "hyperliquid",
      name: "Hyperliquid",
      symbol: "HYPE",
      role: "native",
      note: "Native ecosystem asset of Hyperliquid.",
    },
  },
  {
    key: "base",
    name: "Base",
    short: "BASE",
    logo: "/chains/base.png",
    status: "live",
    zerionId: "base",
    explorer: "https://base.blockscout.com",
    layer: "Layer 2",
    description: "OP Stack rollup using Ethereum for settlement and ETH for network fees.",
    defiLlamaSlug: "base",
    defiLlamaName: "Base",
    marketAsset: {
      coingeckoId: "ethereum",
      name: "Ether",
      symbol: "ETH",
      role: "gas",
      note: "Base has no separate native token; ETH is its gas asset.",
    },
  },
  {
    key: "tempo",
    name: "Tempo",
    short: "TEMPO",
    logo: "/chains/tempo.png",
    status: "testnet",
    explorer: "https://explore.tempo.xyz",
    layer: "Payments L1",
    description: "Stablecoin-first payments chain where supported USD stablecoins pay network fees.",
  },
  {
    key: "arc",
    name: "Arc Chain",
    short: "ARC",
    logo: "/chains/arc.jpg",
    status: "testnet",
    explorer: "https://testnet.arcscan.app",
    layer: "Stablecoin L1",
    description: "Circle-built EVM chain using USDC for gas; current tracker coverage is testnet-only.",
  },
  {
    key: "robinhood",
    name: "Robinhood Chain",
    short: "RHC",
    logo: "/chains/robinhood.png",
    status: "live",
    explorer: "https://robinhoodchain.blockscout.com",
    layer: "Layer 2",
    description: "Arbitrum-based network for tokenized real-world and digital assets.",
    defiLlamaSlug: "robinhood-chain",
    defiLlamaName: "Robinhood Chain",
    marketAsset: {
      coingeckoId: "ethereum",
      name: "Ether",
      symbol: "ETH",
      role: "gas",
      note: "Robinhood Chain uses ETH for gas; this is not the HOOD company stock.",
    },
  },
];

export const CHAIN_MAP = Object.fromEntries(
  CHAINS.map((chain) => [chain.key, chain]),
) as Record<ChainKey, ChainDefinition>;

export function isChainKey(value: unknown): value is ChainKey {
  return typeof value === "string" && value in CHAIN_MAP;
}

export function isWalletAddress(chain: ChainKey, value: string) {
  if (chain === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function transactionUrl(chain: ChainKey, hash: string) {
  if (!hash) return CHAIN_MAP[chain].explorer;
  if (chain === "solana") return `${CHAIN_MAP[chain].explorer}/tx/${hash}`;
  if (chain === "hyperliquid") return `${CHAIN_MAP[chain].explorer}/tx/${hash}`;
  return `${CHAIN_MAP[chain].explorer}/tx/${hash}`;
}
