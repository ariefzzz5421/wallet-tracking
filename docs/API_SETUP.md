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

## 3. Realtime wallet alerts

Realtime listener langsung aktif ketika ada wallet di watchlist dan website sedang terbuka. Tidak ada private key atau API key yang dikirim ke browser.

- Ethereum, Base, Tempo, dan Arc memakai subscription WebSocket standar EVM;
- Solana memakai `logsSubscribe` untuk alamat wallet;
- Hyperliquid memakai `userFills` dan `userNonFundingLedgerUpdates`;
- Robinhood Chain memakai polling public RPC setiap 10 detik karena WebSocket JSON-RPC resminya membutuhkan provider key.

Jika WebSocket EVM terputus berulang kali, aplikasi otomatis beralih ke RPC polling dan mencoba menyambung kembali. Browser notification harus diaktifkan sekali oleh user dari tombol realtime di kanan atas. Toast di dalam website tetap aktif tanpa permission.

## 4. Key opsional

```env
JUPITER_API_KEY=
BLOCKSCOUT_API_KEY=
```

Kedua key ini belum wajib untuk MVP. Jupiter disiapkan untuk pricing SPL token yang lebih lengkap. Blockscout disiapkan bila nanti memakai plan/indexing ber-key.

## 5. Cara menjalankan

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Setelah mengubah ENV, restart server. Untuk deployment, simpan ENV lewat pengaturan hosting dan jangan commit `.env.local`.

## 6. Coverage saat ini

| Chain | Balance | Feed | PnL | Realtime |
|---|---|---|---|---|
| Ethereum | Zerion; Blockscout fallback | Zerion | Zerion | WebSocket + RPC fallback |
| Solana | Zerion; native SOL fallback | Zerion | Zerion | WebSocket |
| Hyperliquid | HyperCore API | Hyperliquid fills | Hyperliquid portfolio history | WebSocket |
| Base | Zerion; Blockscout fallback | Zerion | Zerion | WebSocket + RPC fallback |
| Tempo | Native testnet balance | Not ranked | Not ranked | Testnet WebSocket + RPC fallback |
| Arc | Native testnet balance | Not ranked | Not ranked | Testnet WebSocket + RPC fallback |
| Robinhood Chain | RPC / explorer fallback | Provider coverage pending | Provider coverage pending | RPC polling |

Saldo dan PnL bisa tidak lengkap jika token belum memiliki harga, provider belum mengindeks transaksi, atau posisi berada di protokol yang tidak tercakup.
