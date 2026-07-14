"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHAINS, CHAIN_MAP, type ChainKey } from "../lib/chains";
import { ChainLogo } from "./ChainLogo";

type ChainPickerProps = {
  value: ChainKey;
  onChange: (chain: ChainKey) => void;
  labelId?: string;
};

export function ChainPicker({ value, onChange, labelId }: ChainPickerProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const valueId = `${listId}-value`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = CHAIN_MAP[value];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openAt(index: number) {
    setOpen(true);
    window.setTimeout(() => optionRefs.current[index]?.focus(), 0);
  }

  function select(chain: ChainKey) {
    onChange(chain);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function moveFocus(index: number, direction: -1 | 1) {
    const next = (index + direction + CHAINS.length) % CHAINS.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div className="chain-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="chain-picker-trigger"
        aria-labelledby={labelId ? `${labelId} ${valueId}` : valueId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const current = CHAINS.findIndex((chain) => chain.key === value);
            openAt(event.key === "ArrowDown" ? current : (current - 1 + CHAINS.length) % CHAINS.length);
          }
        }}
      >
        <span className="chain-picker-value" id={valueId}><ChainLogo chain={value} size={30} decorative /><strong>{selected.name}</strong></span>
        <span className="chain-picker-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="chain-picker-menu" id={listId} role="listbox" aria-labelledby={labelId}>
          {CHAINS.map((chain, index) => (
            <button
              key={chain.key}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={chain.key === value}
              className="chain-picker-option"
              onClick={() => select(chain.key)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(index, event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  optionRefs.current[event.key === "Home" ? 0 : CHAINS.length - 1]?.focus();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
            >
              <ChainLogo chain={chain.key} size={32} decorative />
              <span><strong>{chain.name}</strong><small>{chain.layer}</small></span>
              {chain.key === value && <b aria-hidden="true">✓</b>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
