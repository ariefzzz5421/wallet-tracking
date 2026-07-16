# Huntlist Wallet Tracker

Read-only multi-chain watchlist untuk Ethereum, Solana, Hyperliquid, Base, Tempo mainnet, Arc testnet, dan Robinhood Chain.

Route `/x402` menyediakan dashboard live untuk settlement, volume, buyer, seller, facilitator, dan transaksi x402. Data dibaca melalui endpoint public server-side dari [x402scan](https://github.com/ariefzzz5421/x402scan); Huntlist tidak menandatangani atau mengeksekusi pembayaran.

## Routes

- `/` — balance watchlist dan tier $5K / $10K / $100K / $1M
- `/chains` — pilih chain yang ingin dipantau
- `/chains/[chain]` — harga, market cap, TVL, revenue, dan earnings per chain
- `/feed` — gabungan aktivitas wallet watchlist
- `/profitable-wallets` — leaderboard historical PnL per timeframe

Saat website terbuka, Huntlist otomatis memasang listener realtime untuk wallet di watchlist. Aktivitas baru memunculkan toast, dapat diteruskan sebagai browser notification, dan menyegarkan `/feed` tanpa tombol refresh.

## Start

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Lihat [API_SETUP.md](public/docs/API_SETUP.md) untuk key dan coverage per chain.

## Main SDKs

- `viem` for EVM RPC access and unit handling
- `@solana/kit` for official Solana RPC access
- `zod` for environment validation
- Zerion REST API for indexed portfolio, transactions, and PnL
- Hyperliquid Info API for fills and portfolio history
- Native browser WebSocket listeners for onchain wallet activity

## Agent skills

Read-only GMGN research skills are installed under `.agents/skills`: market discovery, token due diligence, wallet portfolio analysis, and Smart Money/KOL tracking. See [docs/GMGN_SKILLS.md](docs/GMGN_SKILLS.md). Trading and private-key operations are explicitly excluded.
