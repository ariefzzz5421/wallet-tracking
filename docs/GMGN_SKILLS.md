# GMGN skills for Huntlist

Installed from the official `GMGNAI/gmgn-skills` repository:

| Skill | Huntlist use |
|---|---|
| `gmgn-market` | Trending tokens, new launches, hot searches, charts, and early-stage signals |
| `gmgn-token` | Token price, liquidity, holders, traders, Smart Money exposure, and security checks |
| `gmgn-portfolio` | Wallet stats, PnL, win rate, activity, and developer-created tokens |
| `gmgn-track` | Public Smart Money and KOL buy/sell activity |

`gmgn-swap` is intentionally not installed in this repository. Huntlist does not execute transactions.

## Configuration

The skills require GMGN CLI and a personal API key:

```powershell
npm install -g gmgn-cli
gmgn-cli config --check
```

When your GMGN API key is ready, configure it locally through the CLI. For Vercel, add only:

```env
GMGN_API_KEY=your_server_side_key
```

Never add `GMGN_PRIVATE_KEY` to this project, GitHub, or Vercel.

## Current scope

These files make GMGN research workflows available to coding agents working in this repository. They do not automatically expose GMGN data in the browser UI. A separate server-side API integration is required before GMGN signals appear on the deployed website.
