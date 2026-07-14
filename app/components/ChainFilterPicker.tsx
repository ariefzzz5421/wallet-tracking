"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHAINS, CHAIN_MAP, type ChainKey } from "../lib/chains";
import { ChainLogo } from "./ChainLogo";

export type ChainFilterValue = "all" | ChainKey;

type ChainFilterPickerProps = {
  value: ChainFilterValue;
  onChange: (chain: ChainFilterValue) => void;
  label: string;
};

const OPTIONS: ChainFilterValue[] = ["all", ...CHAINS.map((chain) => chain.key)];

function AllNetworksMark() {
  return <span className="all-networks-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export function ChainFilterPicker({ value, onChange, label }: ChainFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOnFocusOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOnFocusOutside);
    };
  }, [open]);

  function focusOption(index: number) {
    setOpen(true);
    window.setTimeout(() => optionRefs.current[index]?.focus(), 0);
  }

  function select(next: ChainFilterValue) {
    onChange(next);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  const selectedName = value === "all" ? "All networks" : CHAIN_MAP[value].name;

  return (
    <div className="chain-picker chain-filter-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="chain-picker-trigger"
        aria-label={`${label}: ${selectedName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const current = OPTIONS.indexOf(value);
            focusOption(event.key === "ArrowDown" ? (current + 1) % OPTIONS.length : (current - 1 + OPTIONS.length) % OPTIONS.length);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="chain-picker-value">
          {value === "all" ? <AllNetworksMark /> : <ChainLogo chain={value} size={30} decorative />}
          <strong>{selectedName}</strong>
        </span>
        <span className="chain-picker-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="chain-picker-menu" id={listId} role="listbox" aria-label={label}>
          {OPTIONS.map((option, index) => {
            const isAll = option === "all";
            return (
              <button
                key={option}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={option === value}
                className="chain-picker-option"
                onClick={() => select(option)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    optionRefs.current[(index + direction + OPTIONS.length) % OPTIONS.length]?.focus();
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    optionRefs.current[event.key === "Home" ? 0 : OPTIONS.length - 1]?.focus();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
              >
                {isAll ? <AllNetworksMark /> : <ChainLogo chain={option} size={32} decorative />}
                <span><strong>{isAll ? "All networks" : CHAIN_MAP[option].name}</strong><small>{isAll ? `${CHAINS.length} supported chains` : CHAIN_MAP[option].layer}</small></span>
                {option === value && <b aria-hidden="true">✓</b>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
