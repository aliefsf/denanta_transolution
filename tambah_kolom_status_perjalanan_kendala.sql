-- Jalankan manual di Supabase SQL Editor.
--
-- 1. Menambahkan kolom `status_perjalanan` pada tabel `laporan_kendala`
ALTER TABLE laporan_kendala
  ADD COLUMN IF NOT EXISTS status_perjalanan text;

-- 2. Memperbarui fungsi `laporkan_kendala_perjalanan` untuk merekam status perjalanan saat kendala dilaporkan
CREATE OR REPLACE FUNCTION laporkan_kendala_perjalanan(
  p_perjalanan_id uuid,
  p_kategori text,
  p_catatan text,
  p_anak_id uuid DEFAULT NULL,
  p_dibuat_pada timestamptz DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_supir_id uuid;
  v_anak_id uuid;
  v_tanggal date;
  v_orang_tua_id uuid;
  v_nama_anak text;
  v_judul text;
  v_pesan text;
  v_admin_id uuid;
  v_penerima_id uuid;
  v_waktu timestamptz := COALESCE(p_dibuat_pada, NOW());
  v_status_perjalanan text;
BEGIN
  SELECT supir_id, anak_id, tanggal_perjalanan, status INTO v_supir_id, v_anak_id, v_tanggal, v_status_perjalanan
  FROM perjalanan WHERE id = p_perjalanan_id;

  IF v_supir_id IS NULL OR v_supir_id != auth.uid() THEN
    RAISE EXCEPTION 'Perjalanan tidak ditemukan atau bukan milik supir ini';
  END IF;

  IF p_kategori = 'kendala_anak' THEN
    v_anak_id := COALESCE(p_anak_id, v_anak_id);
  END IF;

  SELECT orang_tua_id, nama_lengkap INTO v_orang_tua_id, v_nama_anak
  FROM anak WHERE id = v_anak_id;

  v_judul := CASE WHEN p_kategori = 'kendala_anak'
    THEN 'Kendala Anak: ' || COALESCE(v_nama_anak, '-')
    ELSE 'Kendala Perjalanan Dilaporkan Supir' END;
  v_pesan := COALESCE(p_catatan, 'Supir melaporkan kendala pada perjalanan ini.');

  INSERT INTO laporan_kendala (perjalanan_id, supir_id, anak_id, kategori, deskripsi, status_perjalanan, dibuat_pada)
  VALUES (
    p_perjalanan_id,
    v_supir_id,
    CASE WHEN p_kategori = 'kendala_anak' THEN v_anak_id ELSE NULL END,
    p_kategori,
    v_pesan,
    v_status_perjalanan,
    v_waktu
  );

  -- Kirim ke seluruh admin
  FOR v_admin_id IN SELECT id FROM pengguna WHERE peran = 'admin' LOOP
    INSERT INTO notifikasi (id, pengguna_id, judul, pesan, tipe, sudah_dibaca, id_terkait, tipe_terkait, dibuat_pada)
    VALUES (gen_random_uuid(), v_admin_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, v_waktu);
  END LOOP;

  IF p_kategori = 'kendala_anak' THEN
    IF v_orang_tua_id IS NOT NULL THEN
      INSERT INTO notifikasi (id, pengguna_id, judul, pesan, tipe, sudah_dibaca, id_terkait, tipe_terkait, dibuat_pada)
      VALUES (gen_random_uuid(), v_orang_tua_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, v_waktu);
    END IF;
  ELSE
    FOR v_penerima_id IN
      SELECT DISTINCT anak.orang_tua_id
      FROM perjalanan
      JOIN anak ON anak.id = perjalanan.anak_id
      WHERE perjalanan.supir_id = v_supir_id
        AND perjalanan.tanggal_perjalanan = v_tanggal
        AND perjalanan.status != 'dibatalkan'
        AND anak.orang_tua_id IS NOT NULL
    LOOP
      INSERT INTO notifikasi (id, pengguna_id, judul, pesan, tipe, sudah_dibaca, id_terkait, tipe_terkait, dibuat_pada)
      VALUES (gen_random_uuid(), v_penerima_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, v_waktu);
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Menambahkan RLS Policy untuk Orang Tua agar dapat membaca laporan kendala yang terkait anaknya/perjalanan anaknya
DROP POLICY IF EXISTS "Laporan Kendala: Orang tua melihat laporan kendala terkait anaknya" ON laporan_kendala;
CREATE POLICY "Laporan Kendala: Orang tua melihat laporan kendala terkait anaknya"
  ON laporan_kendala FOR SELECT TO authenticated
  USING (
    dapatkan_peran_pengguna(auth.uid()) = 'orangtua' AND (
      (kategori = 'kendala_anak' AND EXISTS (
        SELECT 1 FROM anak WHERE anak.id = laporan_kendala.anak_id AND anak.orang_tua_id = auth.uid()
      ))
      OR
      (kategori = 'kendala_perjalanan' AND EXISTS (
        SELECT 1 FROM perjalanan
        JOIN anak ON anak.id = perjalanan.anak_id
        WHERE perjalanan.id = laporan_kendala.perjalanan_id AND anak.orang_tua_id = auth.uid()
      ))
    )
  );
