"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHAINS, CHAIN_MAP, transactionUrl } from "../lib/chains";
import { ChainLogo } from "./ChainLogo";
import { useRealtime } from "./RealtimeProvider";

const STATE_LABEL = {
  idle: "Idle",
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  fallback: "Polling",
  error: "Unavailable",
} as const;

export function RealtimeCenter() {
  const { statuses, alerts, watchedChainCount, liveChainCount, browserPermission, enableBrowserNotifications, dismissAlert } = useRealtime();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeChains = CHAINS.filter((chain) => statuses[chain.key].state !== "idle");

  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  return (
    <>
      <div className="realtime-center" ref={panelRef}>
        <button
          type="button"
          className={`realtime-trigger ${liveChainCount ? "connected" : ""}`}
          onClick={() => setOpen((value) => !value)}
          aria-label="Open realtime wallet alerts"
          aria-expanded={open}
          title="Realtime wallet alerts"
        >
          <span aria-hidden="true">♢</span>
          {liveChainCount > 0 && <i />}
        </button>
        {open && <section className="realtime-panel" aria-label="Realtime wallet alert status">
          <header>
            <div><small>REALTIME ALERTS</small><strong>{watchedChainCount ? `${liveChainCount}/${watchedChainCount} networks active` : "No wallet watched"}</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close realtime alerts">×</button>
          </header>
          <div className="realtime-network-list">
            {activeChains.map((chain) => {
              const status = statuses[chain.key];
              return <div className="realtime-network" key={chain.key}>
                <ChainLogo chain={chain.key} size={28} />
                <span><b>{chain.name}</b><small>{status.detail}</small></span>
                <em className={`realtime-state ${status.state}`}><i />{STATE_LABEL[status.state]}</em>
              </div>;
            })}
            {!activeChains.length && <p className="realtime-empty">Add a wallet to start chain listeners automatically.</p>}
          </div>
          <footer>
            <button type="button" onClick={enableBrowserNotifications} disabled={browserPermission === "granted" || browserPermission === "unsupported"}>
              {browserPermission === "granted" ? "Browser alerts enabled" : browserPermission === "denied" ? "Notifications blocked" : browserPermission === "unsupported" ? "Browser alerts unsupported" : "Enable browser alerts"}
            </button>
            <small>Realtime alerts work while Huntlist is open.</small>
          </footer>
        </section>}
      </div>

      <div className="realtime-toasts" aria-live="polite" aria-label="Realtime wallet notifications">
        {alerts.map((alert) => <article className="realtime-toast" key={alert.id}>
          <ChainLogo chain={alert.chain} size={34} />
          <div><small>{CHAIN_MAP[alert.chain].name} · {alert.source}</small><strong>{alert.title}</strong><p>{alert.walletLabel} — {alert.summary}</p>
            <span>{alert.hash ? <a href={transactionUrl(alert.chain, alert.hash)} target="_blank" rel="noreferrer">Explorer ↗</a> : null}<Link href="/feed">Open feed →</Link></span>
          </div>
          <button type="button" onClick={() => dismissAlert(alert.id)} aria-label="Dismiss notification">×</button>
        </article>)}
      </div>
    </>
  );
}
