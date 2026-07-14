# Huntlist API & environment setup

Huntlist bersifat **read-only**. Aplikasi hanya membaca alamat publik; tidak ada private key, seed phrase, atau fungsi sign transaction.

## 1. Minimum agar fitur utama aktif

Buat `.env.local` dari `.env.example`, lalu isi:

```env
ZERION_API_KEY=your_server_side_key
```

Ambil key dari Zerion Developer Dashboard. Key ini dipakai untuk:

- portfolio USD dan token positions pada Ethereum, Base, dan Solana;
- wallet transaction feed;
- FIFO PnL untuk halaman Top Profitable.

Jangan memakai nama `NEXT_PUBLIC_ZERION_API_KEY`. Key harus tetap di server.

## 2. RPC per chain

Untuk penggunaan stabil di production, buat endpoint RPC dari provider pilihanmu dan isi:

```env
ETHEREUM_RPC_URL=https://...
BASE_RPC_URL=https://...
SOLANA_RPC_URL=https://...
ROBINHOOD_RPC_URL=https://...
```

Rekomendasi praktis:

- Ethereum / Base / Robinhood Chain: Alchemy atau QuickNode;
- Solana: Helius atau QuickNode;
- Hyperliquid: tidak membutuhkan API key untuk Info API;
- Tempo dan Arc: saat ini memakai public testnet RPC bawaan.

Public RPC cocok untuk development, tetapi dapat terkena rate limit. Production sebaiknya memakai endpoint milik akunmu.

## 3. Key opsional

```env
COINGECKO_API_KEY=
JUPITER_API_KEY=
BLOCKSCOUT_API_KEY=
```

Harga ETH, SOL, dan HYPE memakai endpoint publik CoinGecko, jadi key tidak wajib. Isi `COINGECKO_API_KEY` dengan Demo API key bila membutuhkan rate limit lebih tinggi. TVL, revenue, dan earnings memakai endpoint publik DefiLlama tanpa key.

Jupiter disiapkan untuk pricing SPL token yang lebih lengkap. Blockscout disiapkan bila nanti memakai plan/indexing ber-key.

## 4. Cara menjalankan

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Setelah mengubah ENV, restart server. Untuk deployment, simpan ENV lewat pengaturan hosting dan jangan commit `.env.local`.

## 5. Coverage saat ini

| Chain | Balance | Feed / PnL | Market asset | TVL / Revenue |
|---|---|---|---|---|
| Ethereum | Zerion; Blockscout fallback | Zerion | ETH via CoinGecko | DefiLlama |
| Solana | Zerion; native SOL fallback | Zerion | SOL via CoinGecko | DefiLlama |
| Hyperliquid | HyperCore API | Hyperliquid | HYPE via CoinGecko | DefiLlama |
| Base | Zerion; Blockscout fallback | Zerion | ETH gas asset via CoinGecko | DefiLlama |
| Tempo | Native testnet balance | Not ranked | No native token | Not indexed |
| Arc | Native testnet balance | Not ranked | Testnet USDC is not priced | Not indexed |
| Robinhood Chain | RPC / explorer fallback | Coverage pending | ETH gas asset via CoinGecko | DefiLlama |

Robinhood Stock Tokens tidak diberi market cap buatan. Halaman chain hanya menampilkan aset yang punya mapping harga dan market cap yang dapat diverifikasi oleh provider publik.

Saldo dan PnL bisa tidak lengkap jika token belum memiliki harga, provider belum mengindeks transaksi, atau posisi berada di protokol yang tidak tercakup.
