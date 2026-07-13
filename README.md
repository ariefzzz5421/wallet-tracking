# Huntlist Wallet Tracker

Read-only multi-chain watchlist untuk Ethereum, Solana, Hyperliquid, Base, Tempo, Arc, dan Robinhood Chain.

## Routes

- `/` — balance watchlist dan tier $5K / $10K / $100K / $1M
- `/feed` — gabungan aktivitas wallet watchlist
- `/profitable-wallets` — leaderboard historical PnL per timeframe

## Start

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Lihat [docs/API_SETUP.md](docs/API_SETUP.md) untuk key dan coverage per chain.

## Main SDKs

- `viem` for EVM RPC access and unit handling
- `@solana/kit` for official Solana RPC access
- `zod` for environment validation
- Zerion REST API for indexed portfolio, transactions, and PnL
- Hyperliquid Info API for fills and portfolio history
