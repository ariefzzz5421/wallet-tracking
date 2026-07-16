import { NextResponse } from "next/server";
import { isChainKey, type ChainKey } from "../../../lib/chains";
import { errorMessage, fetchJson, getEnv } from "../../../lib/server/providers";
import { TRANSFER_TOPIC, addressTopic, topicAddress } from "../../../lib/realtime";

type WalletInput = { id: string; label: string; address: string; chain: ChainKey };
type RpcResponse<T> = { result?: T; error?: { message?: string } };
type EvmTransaction = { hash?: string; from?: string; to?: string | null };
type EvmBlock = { number?: string; timestamp?: string; transactions?: EvmTransaction[] };
type EvmLog = { transactionHash?: string; topics?: string[] };

export type RealtimePollEvent = {
  id: string;
  walletId: string;
  walletLabel: string;
  address: string;
  chain: ChainKey;
  title: string;
  summary: string;
  hash?: string;
  timestamp: string;
  source: "RPC polling";
};

const DEFAULT_RPC: Partial<Record<ChainKey, string>> = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  base: "https://mainnet.base.org",
  tempo: "https://rpc.moderato.tempo.xyz",
  arc: "https://rpc.testnet.arc.network",
  robinhood: "https://rpc.mainnet.chain.robinhood.com",
};

function rpcUrls(chain: ChainKey) {
  const env = getEnv();
  const configured: Partial<Record<ChainKey, string | undefined>> = {
    ethereum: env.ETHEREUM_RPC_URL,
    base: env.BASE_RPC_URL,
    tempo: env.TEMPO_RPC_URL,
    arc: env.ARC_RPC_URL,
    robinhood: env.ROBINHOOD_RPC_URL,
  };
  return [...new Set([configured[chain], DEFAULT_RPC[chain]].filter((value): value is string => Boolean(value)))];
}

async function rpc<T>(url: string, method: string, params: unknown[]) {
  const response = await fetchJson<RpcResponse<T>>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, 10_000);
  if (response.error) throw new Error(response.error.message || `${method} failed`);
  return response.result;
}

function uniqueEvents(events: RealtimePollEvent[]) {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

async function pollEvm(chain: ChainKey, wallets: WalletInput[], cursor?: string) {
  const candidates = rpcUrls(chain);
  if (!candidates.length) throw new Error(`No public RPC configured for ${chain}`);
  let url = candidates[0];
  let latest: string | undefined;
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      latest = await rpc<string>(candidate, "eth_blockNumber", []);
      url = candidate;
      if (latest) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!latest && lastError) throw lastError;
  if (!latest) throw new Error("RPC did not return the latest block");
  if (!cursor) return { cursor: latest, events: [] as RealtimePollEvent[] };

  const latestNumber = Number.parseInt(latest, 16);
  const cursorNumber = Number.parseInt(cursor, 16);
  const fromNumber = Math.max(cursorNumber + 1, latestNumber - 5);
  if (!Number.isFinite(cursorNumber) || fromNumber > latestNumber) return { cursor: latest, events: [] as RealtimePollEvent[] };

  const walletByAddress = new Map(wallets.map((wallet) => [wallet.address.toLowerCase(), wallet]));
  const walletTopics = wallets.map((wallet) => addressTopic(wallet.address));
  const fromBlock = `0x${fromNumber.toString(16)}`;
  const [blocks, outgoingLogs, incomingLogs] = await Promise.all([
    Promise.all(Array.from({ length: latestNumber - fromNumber + 1 }, (_, index) =>
      rpc<EvmBlock>(url, "eth_getBlockByNumber", [`0x${(fromNumber + index).toString(16)}`, true]))),
    rpc<EvmLog[]>(url, "eth_getLogs", [{ fromBlock, toBlock: latest, topics: [TRANSFER_TOPIC, walletTopics] }]).catch(() => []),
    rpc<EvmLog[]>(url, "eth_getLogs", [{ fromBlock, toBlock: latest, topics: [TRANSFER_TOPIC, null, walletTopics] }]).catch(() => []),
  ]);

  const events: RealtimePollEvent[] = [];
  for (const block of blocks) {
    const timestamp = block?.timestamp ? new Date(Number.parseInt(block.timestamp, 16) * 1_000).toISOString() : new Date().toISOString();
    for (const transaction of block?.transactions ?? []) {
      const matches = new Map<string, { wallet: WalletInput; direction: "sent" | "received" }>();
      const from = transaction.from?.toLowerCase();
      const to = transaction.to?.toLowerCase();
      if (from && walletByAddress.has(from)) matches.set(walletByAddress.get(from)!.id, { wallet: walletByAddress.get(from)!, direction: "sent" });
      if (to && walletByAddress.has(to)) matches.set(walletByAddress.get(to)!.id, { wallet: walletByAddress.get(to)!, direction: "received" });
      for (const { wallet, direction } of matches.values()) {
        events.push({
          id: `${chain}:${transaction.hash}:${wallet.id}`,
          walletId: wallet.id,
          walletLabel: wallet.label,
          address: wallet.address,
          chain,
          title: direction === "sent" ? "Transaction sent" : "Transaction received",
          summary: "Native or contract activity detected onchain.",
          hash: transaction.hash,
          timestamp,
          source: "RPC polling",
        });
      }
    }
  }

  for (const log of [...(outgoingLogs ?? []), ...(incomingLogs ?? [])]) {
    const addresses = [topicAddress(log.topics?.[1]), topicAddress(log.topics?.[2])];
    for (const address of addresses) {
      const wallet = walletByAddress.get(address);
      if (!wallet) continue;
      events.push({
        id: `${chain}:${log.transactionHash}:${wallet.id}`,
        walletId: wallet.id,
        walletLabel: wallet.label,
        address: wallet.address,
        chain,
        title: "Token transfer detected",
        summary: "A token balance may have changed. Wallet Feed is refreshing.",
        hash: log.transactionHash,
        timestamp: new Date().toISOString(),
        source: "RPC polling",
      });
    }
  }
  return { cursor: latest, events: uniqueEvents(events) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { chain?: unknown; wallets?: WalletInput[]; cursor?: string };
    if (!isChainKey(body.chain) || !["ethereum", "base", "tempo", "arc", "robinhood"].includes(body.chain)) {
      return NextResponse.json({ error: "Unsupported realtime polling chain" }, { status: 400 });
    }
    const wallets = (body.wallets ?? [])
      .filter((wallet) => wallet?.id && wallet?.address && wallet.chain === body.chain && /^0x[a-fA-F0-9]{40}$/.test(wallet.address))
      .slice(0, 20);
    if (!wallets.length) return NextResponse.json({ cursor: body.cursor, events: [] });
    return NextResponse.json(await pollEvm(body.chain, wallets, body.cursor));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
