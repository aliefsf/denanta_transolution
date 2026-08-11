-- Jalankan manual di Supabase SQL Editor.
--
-- Fitur Pembayaran Gabungan Multi-Anak: order_id Midtrans yang sama kini
-- boleh muncul di lebih dari satu baris `pembayaran` (satu transaksi Snap
-- melunasi tagihan beberapa anak sekaligus). Kolom id_pesanan_midtrans
-- sebelumnya UNIQUE, itu harus dihapus dulu supaya insert/update tidak
-- ditolak database.

ALTER TABLE pembayaran DROP CONSTRAINT IF EXISTS pembayaran_id_pesanan_midtrans_key;
