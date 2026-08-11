-- Jalankan manual di Supabase SQL Editor.
--
-- Tabel `supir` belum terdaftar di publication `supabase_realtime` (baru
-- `perjalanan` dan `pembayaran` yang terdaftar, lihat skema_database.sql).
-- Tanpa ini, event UPDATE pada kolom lintang_terkini/bujur_terkini TIDAK
-- PERNAH terkirim lewat Supabase Realtime -- pantauSupirRealtime() di
-- src/layanan/realtimeLayanan.ts akan diam saja walau baris supir benar-benar
-- ter-update di database.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'supir'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE supir;
  END IF;
END $$;
