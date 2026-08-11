-- =====================================================================
-- Perbaikan: trigger trg_pengguna_baru sebelumnya hanya membaca
-- nama_lengkap/foto_profil custom kita, padahal login Google mengisi
-- raw_user_meta_data dengan field bawaan OAuth (full_name/name,
-- avatar_url/picture) -- akibatnya akun baru dari Google selalu
-- tersimpan dengan nama "Pengguna Baru" dan foto kosong.
--
-- Jalankan seluruh isi file ini di Supabase SQL Editor (aman dijalankan
-- berkali-kali / idempotent).
-- =====================================================================

-- 1. Perbarui fungsi trigger supaya membaca full_name/name/avatar_url/
--    picture sebagai fallback (harus sama persis dengan skema_database.sql)
CREATE OR REPLACE FUNCTION fungsi_sinkronisasi_pengguna_baru()
RETURNS TRIGGER AS $$
DECLARE
  v_peran text;
  v_nama_lengkap text;
  v_nomor_telepon text;
  v_foto_profil text;
BEGIN
  v_peran := COALESCE(NEW.raw_user_meta_data->>'peran', 'orangtua');
  v_nama_lengkap := COALESCE(
    NEW.raw_user_meta_data->>'nama_lengkap',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Pengguna Baru'
  );
  v_nomor_telepon := COALESCE(NEW.raw_user_meta_data->>'nomor_telepon', '');
  v_foto_profil := COALESCE(
    NEW.raw_user_meta_data->>'foto_profil',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  IF v_peran NOT IN ('orangtua', 'supir', 'admin', 'tamu') THEN
    v_peran := 'orangtua';
  END IF;

  INSERT INTO public.pengguna (id, email, peran, nama_lengkap, nomor_telepon, foto_profil)
  VALUES (
    NEW.id,
    NEW.email,
    v_peran,
    v_nama_lengkap,
    v_nomor_telepon,
    v_foto_profil
  );

  IF v_peran = 'orangtua' THEN
    INSERT INTO public.orang_tua (id, alamat, kontak_darurat, nomor_whatsapp)
    VALUES (NEW.id, '', '', v_nomor_telepon);
  ELSIF v_peran = 'supir' THEN
    INSERT INTO public.supir (id, jenis_kendaraan, nomor_plat, tipe_supir, aktif, status_verifikasi)
    VALUES (NEW.id, '', '', 'tetap', false, 'menunggu');
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Perbaiki akun yang SUDAH terlanjur dibuat sebelum trigger diperbaiki
--    (misal akun Google yang tadi keburu tersimpan sebagai "Pengguna Baru").
--    Hanya menimpa baris yang nama_lengkap-nya masih placeholder default
--    ATAU foto_profil masih kosong, dan hanya kalau auth.users memang
--    punya data asli untuk mengisinya -- jadi aman dijalankan berkali-kali.
UPDATE public.pengguna p
SET
  nama_lengkap = COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    p.nama_lengkap
  ),
  foto_profil = COALESCE(
    NULLIF(p.foto_profil, ''),
    NULLIF(u.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(u.raw_user_meta_data->>'picture', '')
  )
FROM auth.users u
WHERE u.id = p.id
  AND p.nama_lengkap = 'Pengguna Baru'
  AND (
    u.raw_user_meta_data->>'full_name' IS NOT NULL
    OR u.raw_user_meta_data->>'name' IS NOT NULL
  );

-- 3. Cek hasilnya
SELECT id, email, nama_lengkap, foto_profil FROM public.pengguna ORDER BY dibuat_pada DESC LIMIT 10;
