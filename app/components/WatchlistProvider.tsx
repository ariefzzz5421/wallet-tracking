"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChainKey } from "../lib/chains";

export type WalletSyncStatus = "idle" | "syncing" | "live" | "partial" | "testnet" | "error";

export type WatchedWallet = {
  id: string;
  label: string;
  address: string;
  chain: ChainKey;
  balanceUsd: number | null;
  nativeAmount?: number;
  nativeSymbol?: string;
  assetCount: number;
  coverage: string;
  warning?: string;
  status: WalletSyncStatus;
  refreshedAt?: string;
  error?: string;
};

type WatchlistContextValue = {
  wallets: WatchedWallet[];
  ready: boolean;
  addWallet: (wallet: Pick<WatchedWallet, "label" | "address" | "chain">) => WatchedWallet;
  updateWallet: (id: string, patch: Partial<WatchedWallet>) => void;
  removeWallet: (id: string) => void;
};

const STORAGE_KEY = "huntlist-watchlist-v1";
const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export const SAMPLE_WALLETS: WatchedWallet[] = [
  { id: "sample-1", label: "Fund Alpha", address: "0x71c0000000000000000000000000000000009a20", chain: "ethereum", balanceUsd: 2_480_320, assetCount: 18, coverage: "Sample portfolio", status: "live" },
  { id: "sample-2", label: "Fresh Buyer", address: "7Wk9L3uEzTqKfNZw6xQy9N2mV7pA8eF1cG4hJ6sKeN2p", chain: "solana", balanceUsd: 184_250, assetCount: 7, coverage: "Sample portfolio", status: "partial" },
  { id: "sample-3", label: "Perp Whale", address: "0xb2400000000000000000000000000000000081d9", chain: "hyperliquid", balanceUsd: 82_640, assetCount: 5, coverage: "Sample HyperCore", status: "live" },
  { id: "sample-4", label: "Base Scout", address: "0x43d00000000000000000000000000000000070aa", chain: "base", balanceUsd: 12_870, assetCount: 11, coverage: "Sample portfolio", status: "live" },
];

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WatchedWallet[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let nextWallets: WatchedWallet[] = [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WatchedWallet[];
        if (Array.isArray(parsed)) nextWallets = parsed.slice(0, 50);
      }
    } catch {
      // Ignore damaged device-local state and start with a clean watchlist.
    }
    queueMicrotask(() => {
      setWallets(nextWallets);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  }, [wallets, ready]);

  const value = useMemo<WatchlistContextValue>(() => ({
    wallets,
    ready,
    addWallet(input) {
      const wallet: WatchedWallet = {
        ...input,
        id: crypto.randomUUID(),
        balanceUsd: null,
        assetCount: 0,
        coverage: "Waiting for first scan",
        status: "idle",
      };
      setWallets((current) => [wallet, ...current].slice(0, 50));
      return wallet;
    },
    updateWallet(id, patch) {
      setWallets((current) => current.map((wallet) => wallet.id === id ? { ...wallet, ...patch } : wallet));
    },
    removeWallet(id) {
      setWallets((current) => current.filter((wallet) => wallet.id !== id));
    },
  }), [wallets, ready]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return context;
}
