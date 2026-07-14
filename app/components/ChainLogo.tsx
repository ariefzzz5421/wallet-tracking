import Image from "next/image";
import { CHAIN_MAP, type ChainKey } from "../lib/chains";

export function ChainLogo({ chain, size = 30, decorative = false }: { chain: ChainKey; size?: number; decorative?: boolean }) {
  const item = CHAIN_MAP[chain];
  return (
    <span className={`chain-logo chain-logo-${chain}`} style={{ width: size, height: size }}>
      <Image unoptimized src={item.logo} alt={decorative ? "" : `${item.name} logo`} width={size} height={size} sizes={`${size}px`} />
    </span>
  );
}
