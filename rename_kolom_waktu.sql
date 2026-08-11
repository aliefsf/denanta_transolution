-- =====================================================================
-- Rename kolom created_at/updated_at (Inggris, versi skema lama) ke
-- dibuat_pada/diperbarui_pada (Indonesia, dipakai kode aplikasi & trigger
-- fungsi_perbarui_waktu() saat ini).
--
-- Jalankan SEKALI di Supabase SQL Editor. Bukan idempotent (RENAME COLUMN
-- akan error kalau dijalankan dua kali karena created_at/updated_at sudah
-- tidak ada lagi setelah rename pertama) -- itu tandanya sudah berhasil,
-- aman diabaikan.
-- =====================================================================

-- Tabel dengan created_at DAN updated_at
ALTER TABLE pengguna             RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE pengguna             RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE orang_tua            RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE orang_tua            RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE sekolah              RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE sekolah              RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE anak                 RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE anak                 RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE supir                RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE supir                RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE langganan            RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE langganan            RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE perjalanan           RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE perjalanan           RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE pembayaran           RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE pembayaran           RENAME COLUMN updated_at TO diperbarui_pada;

ALTER TABLE penundaan_pembayaran RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE penundaan_pembayaran RENAME COLUMN updated_at TO diperbarui_pada;

-- Tabel yang cuma punya created_at (tidak ada updated_at)
ALTER TABLE log_status_perjalanan RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE notifikasi            RENAME COLUMN created_at TO dibuat_pada;
ALTER TABLE penilaian             RENAME COLUMN created_at TO dibuat_pada;

-- Verifikasi: query ini harus mengembalikan 0 baris kalau semua sudah beres
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('created_at', 'updated_at');
