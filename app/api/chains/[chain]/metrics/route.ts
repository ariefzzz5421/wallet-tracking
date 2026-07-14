import { NextResponse } from "next/server";
import { isChainKey } from "../../../../lib/chains";
import { getChainMetrics } from "../../../../lib/server/chain-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request, context: { params: Promise<{ chain: string }> }) {
  const { chain } = await context.params;
  if (!isChainKey(chain)) {
    return NextResponse.json({ error: "Unsupported chain" }, { status: 404 });
  }

  const force = new URL(request.url).searchParams.get("fresh") === "1";
  const metrics = await getChainMetrics(chain, force);
  return NextResponse.json(metrics, {
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
