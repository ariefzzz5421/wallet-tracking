# Huntlist agent safety policy

Huntlist is a read-only wallet intelligence product.

- Never request, store, transmit, or use a seed phrase or wallet private key.
- Never execute swaps, orders, limit orders, stop-losses, or take-profit transactions.
- GMGN skills may only be used for read-only research with `GMGN_API_KEY`.
- Allowed GMGN modules: `gmgn-market`, `gmgn-token`, `gmgn-portfolio`, and `gmgn-track`.
- Do not use `portfolio holdings` or `track follow-wallet` when they require private-key signing.
- Public market, token, wallet stats/activity, KOL, and Smart Money queries are allowed.
- Keep all API keys server-side. Never expose them through a `NEXT_PUBLIC_` variable.
