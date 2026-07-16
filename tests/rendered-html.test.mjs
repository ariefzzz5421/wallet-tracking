import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

async function render(path) {
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

for (const [path, expected] of [
  ["/", "Find wallets"],
  ["/chains", "Choose your"],
  ["/chains/ethereum", "Ethereum"],
  ["/chains/solana", "Solana"],
  ["/chains/hyperliquid", "Hyperliquid"],
  ["/chains/base", "Base"],
  ["/chains/tempo", "Tempo"],
  ["/chains/arc", "Arc Chain"],
  ["/chains/robinhood", "Robinhood Chain"],
  ["/feed", "Wallet Feed"],
  ["/profitable-wallets", "Top Profitable"],
  ["/x402", "x402 Network"],
]) {
  test(`server-renders ${path}`, async () => {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, new RegExp(expected, "i"));
    assert.doesNotMatch(html, /Your site is taking shape|Codex is working|react-loading-skeleton/i);
  });
}
