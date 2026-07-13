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
};

export const CHAINS: ChainDefinition[] = [
  {
    key: "ethereum",
    name: "Ethereum L1",
    short: "ETH",
    logo: "/chains/ethereum.png",
    status: "live",
    zerionId: "ethereum",
    explorer: "https://eth.blockscout.com",
  },
  {
    key: "solana",
    name: "Solana",
    short: "SOL",
    logo: "/chains/solana.png",
    status: "partial",
    zerionId: "solana",
    explorer: "https://solscan.io",
  },
  {
    key: "hyperliquid",
    name: "Hyperliquid",
    short: "HYPE",
    logo: "/chains/hyperliquid.png",
    status: "live",
    explorer: "https://app.hyperliquid.xyz/explorer",
  },
  {
    key: "base",
    name: "Base L2",
    short: "BASE",
    logo: "/chains/base.png",
    status: "live",
    zerionId: "base",
    explorer: "https://base.blockscout.com",
  },
  {
    key: "tempo",
    name: "Tempo",
    short: "TEMPO",
    logo: "/chains/tempo.png",
    status: "testnet",
    explorer: "https://explore.tempo.xyz",
  },
  {
    key: "arc",
    name: "Arc Chain",
    short: "ARC",
    logo: "/chains/arc.jpg",
    status: "testnet",
    explorer: "https://testnet.arcscan.app",
  },
  {
    key: "robinhood",
    name: "Robinhood Chain",
    short: "RHC",
    logo: "/chains/robinhood.png",
    status: "live",
    explorer: "https://robinhoodchain.blockscout.com",
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
