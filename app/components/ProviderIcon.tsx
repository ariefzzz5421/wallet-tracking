import Image from "next/image";

export type MetricProvider = "CoinGecko" | "DefiLlama";

export function ProviderIcon({ source }: { source: MetricProvider }) {
  if (source === "DefiLlama") {
    return (
      <span className="provider-icon provider-icon-defillama" aria-hidden="true">
        <Image unoptimized src="/providers/defillama.png" alt="" width={101} height={133} sizes="24px" />
      </span>
    );
  }

  return <span className="provider-icon provider-icon-coingecko" aria-hidden="true">CG</span>;
}
