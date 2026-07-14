"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CHAINS, isChainKey, type ChainKey } from "../lib/chains";

type TrackedChainsContextValue = {
  trackedChains: ChainKey[];
  ready: boolean;
  isTracked: (chain: ChainKey) => boolean;
  toggleChain: (chain: ChainKey) => void;
};

const STORAGE_KEY = "huntlist-tracked-chains-v1";
const DEFAULT_CHAINS: ChainKey[] = ["ethereum", "solana", "hyperliquid", "base"];
const TrackedChainsContext = createContext<TrackedChainsContextValue | null>(null);

export function TrackedChainsProvider({ children }: { children: React.ReactNode }) {
  const [trackedChains, setTrackedChains] = useState<ChainKey[]>(DEFAULT_CHAINS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let next = DEFAULT_CHAINS;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown[];
        if (Array.isArray(parsed)) next = parsed.filter(isChainKey);
      }
    } catch {
      // Ignore damaged device-local settings.
    }
    queueMicrotask(() => {
      setTrackedChains(next);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedChains));
  }, [ready, trackedChains]);

  const value = useMemo<TrackedChainsContextValue>(() => ({
    trackedChains,
    ready,
    isTracked: (chain) => trackedChains.includes(chain),
    toggleChain(chain) {
      setTrackedChains((current) => current.includes(chain)
        ? current.filter((item) => item !== chain)
        : CHAINS.filter((item) => item.key === chain || current.includes(item.key)).map((item) => item.key));
    },
  }), [ready, trackedChains]);

  return <TrackedChainsContext.Provider value={value}>{children}</TrackedChainsContext.Provider>;
}

export function useTrackedChains() {
  const context = useContext(TrackedChainsContext);
  if (!context) throw new Error("useTrackedChains must be used inside TrackedChainsProvider");
  return context;
}
