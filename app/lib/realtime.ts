import type { ChainKey } from "./chains";

export type RealtimeNetworkKind = "evm" | "solana" | "hyperliquid" | "polling";

export type RealtimeNetwork = {
  chain: ChainKey;
  kind: RealtimeNetworkKind;
  websocketUrl?: string;
  label: string;
};

export const REALTIME_NETWORKS: Record<ChainKey, RealtimeNetwork> = {
  ethereum: {
    chain: "ethereum",
    kind: "evm",
    websocketUrl: "wss://ethereum-rpc.publicnode.com",
    label: "Ethereum WebSocket",
  },
  solana: {
    chain: "solana",
    kind: "solana",
    websocketUrl: "wss://api.mainnet-beta.solana.com",
    label: "Solana WebSocket",
  },
  hyperliquid: {
    chain: "hyperliquid",
    kind: "hyperliquid",
    websocketUrl: "wss://api.hyperliquid.xyz/ws",
    label: "Hyperliquid WebSocket",
  },
  base: {
    chain: "base",
    kind: "evm",
    websocketUrl: "wss://base-rpc.publicnode.com",
    label: "Base WebSocket",
  },
  tempo: {
    chain: "tempo",
    kind: "evm",
    websocketUrl: "wss://rpc.mainnet.tempo.xyz",
    label: "Tempo mainnet WebSocket",
  },
  arc: {
    chain: "arc",
    kind: "evm",
    websocketUrl: "wss://rpc.testnet.arc.network",
    label: "Arc testnet WebSocket",
  },
  robinhood: {
    chain: "robinhood",
    kind: "polling",
    label: "Robinhood public RPC",
  },
};

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function addressTopic(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

export function topicAddress(topic?: string) {
  if (!topic || topic.length < 42) return "";
  return `0x${topic.slice(-40)}`.toLowerCase();
}
