import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  ZERION_API_KEY: z.string().optional(),
  ETHEREUM_RPC_URL: optionalUrl,
  BASE_RPC_URL: optionalUrl,
  SOLANA_RPC_URL: optionalUrl,
  HYPERLIQUID_API_URL: optionalUrl,
  TEMPO_RPC_URL: optionalUrl,
  ARC_RPC_URL: optionalUrl,
  ROBINHOOD_RPC_URL: optionalUrl,
});

export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return {
    ...parsed.data,
    SOLANA_RPC_URL: parsed.data.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    HYPERLIQUID_API_URL: parsed.data.HYPERLIQUID_API_URL || "https://api.hyperliquid.xyz",
    TEMPO_RPC_URL: parsed.data.TEMPO_RPC_URL || "https://rpc.moderato.tempo.xyz",
    ARC_RPC_URL: parsed.data.ARC_RPC_URL || "https://rpc.testnet.arc.network",
  };
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function zerionFetch<T>(path: string): Promise<T> {
  const { ZERION_API_KEY } = getEnv();
  if (!ZERION_API_KEY) throw new Error("ZERION_API_KEY is not configured");
  const credential = Buffer.from(`${ZERION_API_KEY}:`).toString("base64");
  return fetchJson<T>(`https://api.zerion.io${path}`, {
    headers: { accept: "application/json", authorization: `Basic ${credential}` },
  });
}

export function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}
