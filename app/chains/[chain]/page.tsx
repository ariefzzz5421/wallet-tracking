import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChainDetailClient } from "../../components/ChainDetailClient";
import { CHAINS, CHAIN_MAP, isChainKey } from "../../lib/chains";

export function generateStaticParams() {
  return CHAINS.map((chain) => ({ chain: chain.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ chain: string }> }): Promise<Metadata> {
  const { chain } = await params;
  if (!isChainKey(chain)) return {};
  return {
    title: `${CHAIN_MAP[chain].name} metrics — Huntlist`,
    description: `Track live market data, TVL, revenue, and earnings for ${CHAIN_MAP[chain].name}.`,
  };
}

export default async function ChainPage({ params }: { params: Promise<{ chain: string }> }) {
  const { chain } = await params;
  if (!isChainKey(chain)) notFound();
  return <ChainDetailClient chain={CHAIN_MAP[chain]} />;
}
