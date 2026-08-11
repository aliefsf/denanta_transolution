-- =====================================================================
-- Backfill: isi ulang baris public.pengguna / orang_tua / supir yang
-- hilang karena trigger trg_pengguna_baru gagal (silent) saat signup.
--
-- Jalankan di Supabase SQL Editor. Aman dijalankan berkali-kali
-- (idempotent) karena pakai ON CONFLICT DO NOTHING.
--
-- Langkah 0 (opsional tapi disarankan): pastikan dulu trigger yang
-- sebenarnya sudah sinkron dengan skema_database.sql, supaya user baru
-- ke depannya tidak mengalami masalah yang sama:
--
--   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_pengguna_baru';
--
-- Kalau tidak ada baris/hasilnya kosong, jalankan ulang blok
-- CREATE OR REPLACE FUNCTION fungsi_sinkronisasi_pengguna_baru() ...
-- dan CREATE TRIGGER trg_pengguna_baru ... dari skema_database.sql
-- (baris 297-349) sebelum menjalankan backfill di bawah ini.
-- =====================================================================

-- 1. Backfill public.pengguna dari auth.users yang belum punya baris
INSERT INTO public.pengguna (id, email, peran, nama_lengkap, nomor_telepon, foto_profil)
SELECT
  u.id,
  u.email,
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'peran', 'orangtua') IN ('tamu', 'orangtua', 'supir', 'admin')
      THEN u.raw_user_meta_data->>'peran'
    ELSE 'orangtua'
  END,
  COALESCE(u.raw_user_meta_data->>'nama_lengkap', 'Pengguna Baru'),
  COALESCE(u.raw_user_meta_data->>'nomor_telepon', ''),
  u.raw_user_meta_data->>'foto_profil'
FROM auth.users u
LEFT JOIN public.pengguna p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Backfill public.orang_tua untuk pengguna berperan 'orangtua' yang
--    belum punya baris (mengikuti data yang baru saja/ sudah ada di pengguna)
INSERT INTO public.orang_tua (id, alamat, kontak_darurat, nomor_whatsapp)
SELECT
  p.id,
  '',
  '',
  COALESCE(p.nomor_telepon, '')
FROM public.pengguna p
LEFT JOIN public.orang_tua ot ON ot.id = p.id
WHERE p.peran = 'orangtua'
  AND ot.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Backfill public.supir untuk pengguna berperan 'supir' yang belum
--    punya baris
INSERT INTO public.supir (id, jenis_kendaraan, nomor_plat, tipe_supir, aktif, status_verifikasi)
SELECT
  p.id,
  '',
  '',
  'tetap',
  false,
  'menunggu'
FROM public.pengguna p
LEFT JOIN public.supir s ON s.id = p.id
WHERE p.peran = 'supir'
  AND s.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Cek hasil: user yang masih tidak sinkron antara auth.users dan
--    public.pengguna (harusnya kosong setelah query di atas dijalankan)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.pengguna p ON p.id = u.id
WHERE p.id IS NULL;
