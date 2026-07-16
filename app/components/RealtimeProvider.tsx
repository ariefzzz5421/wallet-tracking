"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHAINS, CHAIN_MAP, type ChainKey } from "../lib/chains";
import { REALTIME_NETWORKS, TRANSFER_TOPIC, addressTopic, topicAddress } from "../lib/realtime";
import { useWatchlist, type WatchedWallet } from "./WatchlistProvider";

type RealtimeWallet = Pick<WatchedWallet, "id" | "label" | "address" | "chain">;

export type RealtimeConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "fallback" | "error";

export type RealtimeChainStatus = {
  state: RealtimeConnectionState;
  detail: string;
  lastSignalAt?: string;
};

export type RealtimeSignal = {
  id: string;
  walletId: string;
  walletLabel: string;
  address: string;
  chain: ChainKey;
  title: string;
  summary: string;
  hash?: string;
  timestamp: string;
  source: "WebSocket" | "RPC polling";
};

type RealtimeContextValue = {
  statuses: Record<ChainKey, RealtimeChainStatus>;
  alerts: RealtimeSignal[];
  revision: number;
  watchedChainCount: number;
  liveChainCount: number;
  browserPermission: NotificationPermission | "unsupported";
  enableBrowserNotifications: () => Promise<void>;
  dismissAlert: (id: string) => void;
};

const NOTIFICATION_KEY = "huntlist-browser-notifications-v1";
const EMPTY_STATUS = Object.fromEntries(CHAINS.map((chain) => [chain.key, { state: "idle", detail: "No wallet watched" }])) as Record<ChainKey, RealtimeChainStatus>;
const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function walletsByChain(wallets: RealtimeWallet[]) {
  const grouped = new Map<ChainKey, RealtimeWallet[]>();
  for (const wallet of wallets) grouped.set(wallet.chain, [...(grouped.get(wallet.chain) ?? []), wallet]);
  return grouped;
}

function byAddress(wallets: RealtimeWallet[]) {
  return new Map(wallets.map((wallet) => [wallet.address.toLowerCase(), wallet]));
}

function reconnectDelay(attempt: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

type PublicRpcResponse<T> = { result?: T; error?: { message?: string } };
type PublicEvmBlock = { timestamp?: string; transactions?: Array<{ hash?: string; from?: string; to?: string | null }> };
type PublicEvmLog = { transactionHash?: string; topics?: string[] };

async function robinhoodPublicRpc<T>(method: string, params: unknown[]) {
  const response = await fetch("https://rpc.mainnet.chain.robinhood.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const result = await response.json() as PublicRpcResponse<T>;
  if (!response.ok || result.error) throw new Error(result.error?.message || "Robinhood public RPC unavailable");
  return result.result;
}

async function pollRobinhoodInBrowser(wallets: RealtimeWallet[], cursor?: string) {
  const latest = await robinhoodPublicRpc<string>("eth_blockNumber", []);
  if (!latest) throw new Error("Robinhood RPC did not return a block");
  if (!cursor) return { cursor: latest, events: [] as RealtimeSignal[] };
  const latestNumber = Number.parseInt(latest, 16);
  const cursorNumber = Number.parseInt(cursor, 16);
  const fromNumber = Math.max(cursorNumber + 1, latestNumber - 5);
  if (!Number.isFinite(cursorNumber) || fromNumber > latestNumber) return { cursor: latest, events: [] as RealtimeSignal[] };
  const walletMap = byAddress(wallets);
  const walletTopics = wallets.map((wallet) => addressTopic(wallet.address));
  const fromBlock = `0x${fromNumber.toString(16)}`;
  const [blocks, outgoing, incoming] = await Promise.all([
    Promise.all(Array.from({ length: latestNumber - fromNumber + 1 }, (_, index) => robinhoodPublicRpc<PublicEvmBlock>("eth_getBlockByNumber", [`0x${(fromNumber + index).toString(16)}`, true]))),
    robinhoodPublicRpc<PublicEvmLog[]>("eth_getLogs", [{ fromBlock, toBlock: latest, topics: [TRANSFER_TOPIC, walletTopics] }]).catch(() => []),
    robinhoodPublicRpc<PublicEvmLog[]>("eth_getLogs", [{ fromBlock, toBlock: latest, topics: [TRANSFER_TOPIC, null, walletTopics] }]).catch(() => []),
  ]);
  const events: RealtimeSignal[] = [];
  for (const block of blocks) {
    const timestamp = block?.timestamp ? new Date(Number.parseInt(block.timestamp, 16) * 1_000).toISOString() : new Date().toISOString();
    for (const transaction of block?.transactions ?? []) {
      const matches = new Map<string, { wallet: RealtimeWallet; direction: "sent" | "received" }>();
      const fromWallet = transaction.from ? walletMap.get(transaction.from.toLowerCase()) : undefined;
      const toWallet = transaction.to ? walletMap.get(transaction.to.toLowerCase()) : undefined;
      if (fromWallet) matches.set(fromWallet.id, { wallet: fromWallet, direction: "sent" });
      if (toWallet) matches.set(toWallet.id, { wallet: toWallet, direction: "received" });
      for (const { wallet, direction } of matches.values()) events.push({
        id: `robinhood:${transaction.hash}:${wallet.id}`,
        walletId: wallet.id,
        walletLabel: wallet.label,
        address: wallet.address,
        chain: "robinhood",
        title: direction === "sent" ? "Transaction sent" : "Transaction received",
        summary: "Native or contract activity detected onchain.",
        hash: transaction.hash,
        timestamp,
        source: "RPC polling",
      });
    }
  }
  for (const log of [...(outgoing ?? []), ...(incoming ?? [])]) {
    for (const address of [topicAddress(log.topics?.[1]), topicAddress(log.topics?.[2])]) {
      const wallet = walletMap.get(address);
      if (!wallet) continue;
      events.push({ id: `robinhood:${log.transactionHash}:${wallet.id}`, walletId: wallet.id, walletLabel: wallet.label, address: wallet.address, chain: "robinhood", title: "Token transfer detected", summary: "A token or stock-token balance may have changed.", hash: log.transactionHash, timestamp: new Date().toISOString(), source: "RPC polling" });
    }
  }
  return { cursor: latest, events: [...new Map(events.map((event) => [event.id, event])).values()] };
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { wallets, ready } = useWatchlist();
  const subscriptionPayload = JSON.stringify(wallets.map(({ id, label, address, chain }) => ({ id, label, address, chain })));
  const [statuses, setStatuses] = useState<Record<ChainKey, RealtimeChainStatus>>(EMPTY_STATUS);
  const [alerts, setAlerts] = useState<RealtimeSignal[]>([]);
  const [revision, setRevision] = useState(0);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("default");
  const notificationEnabledRef = useRef(false);
  const seenRef = useRef(new Set<string>());
  const toastTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!("Notification" in window)) {
      queueMicrotask(() => setBrowserPermission("unsupported"));
      return;
    }
    queueMicrotask(() => setBrowserPermission(Notification.permission));
    notificationEnabledRef.current = Notification.permission === "granted" && window.localStorage.getItem(NOTIFICATION_KEY) === "enabled";
  }, []);

  const updateStatus = useCallback((chain: ChainKey, patch: Partial<RealtimeChainStatus>) => {
    setStatuses((current) => ({ ...current, [chain]: { ...current[chain], ...patch } }));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const emitSignal = useCallback((signal: RealtimeSignal) => {
    if (seenRef.current.has(signal.id)) return;
    seenRef.current.add(signal.id);
    if (seenRef.current.size > 600) seenRef.current.delete(seenRef.current.values().next().value as string);
    setAlerts((current) => [signal, ...current].slice(0, 4));
    setRevision((current) => current + 1);
    updateStatus(signal.chain, { lastSignalAt: signal.timestamp });
    window.dispatchEvent(new CustomEvent("huntlist:wallet-activity", { detail: signal }));

    if (notificationEnabledRef.current && Notification.permission === "granted") {
      const notification = new Notification(`${CHAIN_MAP[signal.chain].name}: ${signal.title}`, {
        body: `${signal.walletLabel} — ${signal.summary}`,
        tag: signal.id,
        icon: CHAIN_MAP[signal.chain].logo,
      });
      notification.onclick = () => { window.focus(); window.location.href = "/feed"; };
    }

    const timer = setTimeout(() => {
      setAlerts((current) => current.filter((alert) => alert.id !== signal.id));
      toastTimersRef.current.delete(timer);
    }, 9_000);
    toastTimersRef.current.add(timer);
  }, [updateStatus]);

  const enableBrowserNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    notificationEnabledRef.current = permission === "granted";
    if (permission === "granted") window.localStorage.setItem(NOTIFICATION_KEY, "enabled");
  }, []);

  useEffect(() => {
    if (!ready) return;
    const grouped = walletsByChain(JSON.parse(subscriptionPayload) as RealtimeWallet[]);
    const sockets = new Set<WebSocket>();
    const retryTimers = new Set<ReturnType<typeof setTimeout>>();
    const pollers = new Map<ChainKey, { interval: ReturnType<typeof setInterval>; controller: AbortController }>();
    let stopped = false;

    queueMicrotask(() => {
      if (stopped) return;
      setStatuses(Object.fromEntries(CHAINS.map((chain) => [
        chain.key,
        grouped.has(chain.key)
          ? { state: "connecting", detail: `Connecting to ${REALTIME_NETWORKS[chain.key].label}` }
          : { state: "idle", detail: "No wallet watched" },
      ])) as Record<ChainKey, RealtimeChainStatus>);
    });

    function stopPoller(chain: ChainKey) {
      const poller = pollers.get(chain);
      if (!poller) return;
      clearInterval(poller.interval);
      poller.controller.abort();
      pollers.delete(chain);
    }

    function startEvmPoller(chain: ChainKey, chainWallets: RealtimeWallet[]) {
      if (pollers.has(chain) || stopped) return;
      const controller = new AbortController();
      let cursor: string | undefined;
      let running = false;
      const tick = async () => {
        if (running || stopped) return;
        running = true;
        try {
          let result: { cursor?: string; events?: RealtimeSignal[]; error?: string };
          if (chain === "robinhood") {
            result = await pollRobinhoodInBrowser(chainWallets, cursor);
          } else {
            const response = await fetch("/api/realtime/poll", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ chain, wallets: chainWallets, cursor }),
              signal: controller.signal,
            });
            result = await response.json() as { cursor?: string; events?: RealtimeSignal[]; error?: string };
            if (!response.ok) throw new Error(result.error || "Polling failed");
          }
          cursor = result.cursor;
          for (const event of result.events ?? []) emitSignal(event);
          updateStatus(chain, { state: "fallback", detail: "RPC polling active" });
        } catch (error) {
          if (!controller.signal.aborted) updateStatus(chain, { state: "error", detail: error instanceof Error ? error.message : "RPC polling unavailable" });
        } finally {
          running = false;
        }
      };
      const interval = setInterval(tick, 10_000);
      pollers.set(chain, { interval, controller });
      void tick();
    }

    function connectEvm(chain: ChainKey, chainWallets: RealtimeWallet[]) {
      const endpoint = REALTIME_NETWORKS[chain].websocketUrl;
      if (!endpoint) return startEvmPoller(chain, chainWallets);
      const walletMap = byAddress(chainWallets);
      const walletTopics = chainWallets.map((wallet) => addressTopic(wallet.address));
      let attempt = 0;
      let requestId = 1_000;

      const connect = () => {
        if (stopped) return;
        updateStatus(chain, { state: attempt ? "reconnecting" : "connecting", detail: attempt ? "Reconnecting WebSocket" : `Connecting to ${REALTIME_NETWORKS[chain].label}` });
        const socket = new WebSocket(endpoint);
        sockets.add(socket);

        socket.onopen = () => {
          attempt = 0;
          stopPoller(chain);
          updateStatus(chain, { state: "live", detail: "WebSocket connected" });
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newHeads"] }));
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_subscribe", params: ["logs", { topics: [TRANSFER_TOPIC, walletTopics] }] }));
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_subscribe", params: ["logs", { topics: [TRANSFER_TOPIC, null, walletTopics] }] }));
        };

        socket.onmessage = (message) => {
          try {
            const payload = JSON.parse(String(message.data)) as { id?: number; method?: string; result?: { hash?: string; timestamp?: string; transactions?: Array<{ hash?: string; from?: string; to?: string | null }> }; params?: { result?: { hash?: string; transactionHash?: string; topics?: string[] } } };
            const result = payload.params?.result;
            if (payload.method === "eth_subscription" && result?.transactionHash) {
              const matched = [topicAddress(result.topics?.[1]), topicAddress(result.topics?.[2])]
                .map((address) => walletMap.get(address))
                .filter((wallet): wallet is RealtimeWallet => Boolean(wallet));
              for (const wallet of matched) emitSignal({
                id: `${chain}:${result.transactionHash}:${wallet.id}`,
                walletId: wallet.id,
                walletLabel: wallet.label,
                address: wallet.address,
                chain,
                title: "Token transfer detected",
                summary: "A token balance may have changed. Wallet Feed is refreshing.",
                hash: result.transactionHash,
                timestamp: new Date().toISOString(),
                source: "WebSocket",
              });
              return;
            }
            if (payload.method === "eth_subscription" && result?.hash) {
              socket.send(JSON.stringify({ jsonrpc: "2.0", id: requestId++, method: "eth_getBlockByHash", params: [result.hash, true] }));
              return;
            }
            if (!payload.result?.transactions) return;
            const timestamp = payload.result.timestamp ? new Date(Number.parseInt(payload.result.timestamp, 16) * 1_000).toISOString() : new Date().toISOString();
            for (const transaction of payload.result.transactions) {
              const matches = new Map<string, { wallet: RealtimeWallet; direction: "sent" | "received" }>();
              const fromWallet = transaction.from ? walletMap.get(transaction.from.toLowerCase()) : undefined;
              const toWallet = transaction.to ? walletMap.get(transaction.to.toLowerCase()) : undefined;
              if (fromWallet) matches.set(fromWallet.id, { wallet: fromWallet, direction: "sent" });
              if (toWallet) matches.set(toWallet.id, { wallet: toWallet, direction: "received" });
              for (const { wallet, direction } of matches.values()) emitSignal({
                id: `${chain}:${transaction.hash}:${wallet.id}`,
                walletId: wallet.id,
                walletLabel: wallet.label,
                address: wallet.address,
                chain,
                title: direction === "sent" ? "Transaction sent" : "Transaction received",
                summary: "Native or contract activity detected onchain.",
                hash: transaction.hash,
                timestamp,
                source: "WebSocket",
              });
            }
          } catch {
            // Ignore malformed provider messages and keep the connection alive.
          }
        };

        socket.onerror = () => socket.close();
        socket.onclose = () => {
          sockets.delete(socket);
          if (stopped) return;
          attempt += 1;
          if (attempt >= 3) startEvmPoller(chain, chainWallets);
          const timer = setTimeout(connect, reconnectDelay(attempt));
          retryTimers.add(timer);
        };
      };
      connect();
    }

    function connectSolana(chainWallets: RealtimeWallet[]) {
      const endpoint = REALTIME_NETWORKS.solana.websocketUrl!;
      let attempt = 0;
      const connect = () => {
        if (stopped) return;
        updateStatus("solana", { state: attempt ? "reconnecting" : "connecting", detail: attempt ? "Reconnecting WebSocket" : "Connecting to Solana WebSocket" });
        const socket = new WebSocket(endpoint);
        sockets.add(socket);
        const pending = new Map<number, RealtimeWallet>();
        const subscriptions = new Map<number, RealtimeWallet>();
        socket.onopen = () => {
          attempt = 0;
          updateStatus("solana", { state: "live", detail: "WebSocket connected" });
          chainWallets.forEach((wallet, index) => {
            const id = index + 1;
            pending.set(id, wallet);
            socket.send(JSON.stringify({ jsonrpc: "2.0", id, method: "logsSubscribe", params: [{ mentions: [wallet.address] }, { commitment: "confirmed" }] }));
          });
        };
        socket.onmessage = (message) => {
          try {
            const payload = JSON.parse(String(message.data)) as { id?: number; result?: number; method?: string; params?: { subscription?: number; result?: { value?: { signature?: string; err?: unknown } } } };
            if (payload.id && typeof payload.result === "number" && pending.has(payload.id)) subscriptions.set(payload.result, pending.get(payload.id)!);
            if (payload.method !== "logsNotification" || payload.params?.result?.value?.err) return;
            const signature = payload.params?.result?.value?.signature;
            const subscription = payload.params?.subscription;
            const wallet = subscription === undefined ? undefined : subscriptions.get(subscription);
            if (!signature || !wallet) return;
            emitSignal({ id: `solana:${signature}:${wallet.id}`, walletId: wallet.id, walletLabel: wallet.label, address: wallet.address, chain: "solana", title: "Solana activity detected", summary: "A confirmed transaction mentioned this wallet.", hash: signature, timestamp: new Date().toISOString(), source: "WebSocket" });
          } catch {
            // Ignore malformed provider messages.
          }
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          sockets.delete(socket);
          if (stopped) return;
          attempt += 1;
          updateStatus("solana", { state: "reconnecting", detail: "WebSocket disconnected; reconnecting" });
          const timer = setTimeout(connect, reconnectDelay(attempt));
          retryTimers.add(timer);
        };
      };
      connect();
    }

    function connectHyperliquid(chainWallets: RealtimeWallet[]) {
      const endpoint = REALTIME_NETWORKS.hyperliquid.websocketUrl!;
      const walletMap = byAddress(chainWallets);
      let attempt = 0;
      const connect = () => {
        if (stopped) return;
        updateStatus("hyperliquid", { state: attempt ? "reconnecting" : "connecting", detail: attempt ? "Reconnecting WebSocket" : "Connecting to Hyperliquid WebSocket" });
        const socket = new WebSocket(endpoint);
        sockets.add(socket);
        socket.onopen = () => {
          attempt = 0;
          updateStatus("hyperliquid", { state: "live", detail: "WebSocket connected" });
          for (const wallet of chainWallets) {
            socket.send(JSON.stringify({ method: "subscribe", subscription: { type: "userFills", user: wallet.address } }));
            socket.send(JSON.stringify({ method: "subscribe", subscription: { type: "userNonFundingLedgerUpdates", user: wallet.address } }));
          }
        };
        socket.onmessage = (message) => {
          try {
            const payload = JSON.parse(String(message.data)) as { channel?: string; data?: { isSnapshot?: boolean; user?: string; fills?: Array<{ hash?: string; tid?: number; coin?: string; dir?: string; time?: number }>; nonFundingLedgerUpdates?: Array<{ hash?: string; delta?: { type?: string }; time?: number }> } };
            if (payload.data?.isSnapshot) return;
            const wallet = payload.data?.user ? walletMap.get(payload.data.user.toLowerCase()) : undefined;
            if (!wallet) return;
            if (payload.channel === "userFills") for (const fill of payload.data?.fills ?? []) emitSignal({
              id: `hyperliquid:${fill.hash || fill.tid}:${wallet.id}`,
              walletId: wallet.id,
              walletLabel: wallet.label,
              address: wallet.address,
              chain: "hyperliquid",
              title: fill.dir || "Perp fill detected",
              summary: `${fill.coin || "Market"} execution received from Hyperliquid.`,
              hash: fill.hash,
              timestamp: new Date(fill.time || Date.now()).toISOString(),
              source: "WebSocket",
            });
            if (payload.channel === "userNonFundingLedgerUpdates") for (const entry of payload.data?.nonFundingLedgerUpdates ?? []) emitSignal({
              id: `hyperliquid:${entry.hash || entry.time}:${wallet.id}`,
              walletId: wallet.id,
              walletLabel: wallet.label,
              address: wallet.address,
              chain: "hyperliquid",
              title: entry.delta?.type || "Balance update detected",
              summary: "A deposit, withdrawal, or ledger balance changed.",
              hash: entry.hash,
              timestamp: new Date(entry.time || Date.now()).toISOString(),
              source: "WebSocket",
            });
          } catch {
            // Ignore malformed provider messages.
          }
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          sockets.delete(socket);
          if (stopped) return;
          attempt += 1;
          updateStatus("hyperliquid", { state: "reconnecting", detail: "WebSocket disconnected; reconnecting" });
          const timer = setTimeout(connect, reconnectDelay(attempt));
          retryTimers.add(timer);
        };
      };
      connect();
    }

    for (const [chain, chainWallets] of grouped) {
      const network = REALTIME_NETWORKS[chain];
      if (network.kind === "evm") connectEvm(chain, chainWallets);
      else if (network.kind === "solana") connectSolana(chainWallets);
      else if (network.kind === "hyperliquid") connectHyperliquid(chainWallets);
      else startEvmPoller(chain, chainWallets);
    }

    return () => {
      stopped = true;
      for (const socket of sockets) socket.close();
      for (const timer of retryTimers) clearTimeout(timer);
      for (const chain of pollers.keys()) stopPoller(chain);
    };
  }, [emitSignal, ready, subscriptionPayload, updateStatus]);

  useEffect(() => () => {
    for (const timer of toastTimersRef.current) clearTimeout(timer);
  }, []);

  const watchedChainCount = useMemo(() => new Set(wallets.map((wallet) => wallet.chain)).size, [wallets]);
  const liveChainCount = useMemo(() => Object.values(statuses).filter((status) => status.state === "live" || status.state === "fallback").length, [statuses]);
  const value = useMemo<RealtimeContextValue>(() => ({ statuses, alerts, revision, watchedChainCount, liveChainCount, browserPermission, enableBrowserNotifications, dismissAlert }), [alerts, browserPermission, dismissAlert, enableBrowserNotifications, liveChainCount, revision, statuses, watchedChainCount]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used inside RealtimeProvider");
  return context;
}
