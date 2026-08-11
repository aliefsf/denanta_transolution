-- Jalankan manual di Supabase SQL Editor.
--
-- Menambahkan kolom `waktu_klien_transaksi` pada tabel `pembayaran`, dipakai
-- supaya Edge Function midtrans-webhook bisa menghitung tanggal_berakhir
-- langganan mengikuti fitur "waktu simulasi" demo (src/bantuan/waktuSimulasi.ts)
-- alih-alih waktu server sungguhan -- webhook dipanggil langsung oleh
-- Midtrans (server-to-server), jadi tidak pernah tahu localStorage klien
-- kecuali nilainya dititipkan lewat kolom ini saat transaksi dibuat.

ALTER TABLE pembayaran
  ADD COLUMN IF NOT EXISTS waktu_klien_transaksi timestamptz;
