import { NextResponse } from "next/server";
import { CHAINS } from "../../../lib/chains";
import { getChainMetrics } from "../../../lib/server/chain-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("fresh") === "1";
  const chains = await Promise.all(CHAINS.map((chain) => getChainMetrics(chain.key, force)));

  return NextResponse.json({ updatedAt: new Date().toISOString(), chains }, {
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
