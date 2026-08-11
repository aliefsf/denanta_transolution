-- Jalankan manual di Supabase SQL Editor.
--
-- 1. Membuat fungsi trigger hitung_jarak_perjalanan
CREATE OR REPLACE FUNCTION hitung_jarak_perjalanan()
RETURNS TRIGGER AS $$
DECLARE
  v_lintang_jemput double precision;
  v_bujur_jemput double precision;
  v_lintang_sekolah double precision;
  v_bujur_sekolah double precision;
BEGIN
  -- Ambil koordinat jemput anak, dan koordinat sekolah dari tabel sekolah
  SELECT a.lintang_jemput, a.bujur_jemput, s.lintang, s.bujur
  INTO v_lintang_jemput, v_bujur_jemput, v_lintang_sekolah, v_bujur_sekolah
  FROM anak a
  JOIN sekolah s ON s.id = a.sekolah_id
  WHERE a.id = NEW.anak_id;

  -- Jika koordinat sekolah tidak ditemukan, coba ambil dari lintang_antar/bujur_antar anak
  IF v_lintang_sekolah IS NULL OR v_bujur_sekolah IS NULL THEN
    SELECT lintang_antar, bujur_antar INTO v_lintang_sekolah, v_bujur_sekolah
    FROM anak
    WHERE id = NEW.anak_id;
  END IF;

  -- Hitung jarak menggunakan fungsi hitung_jarak yang sudah ada dan simpan ke NEW.jarak_km
  NEW.jarak_km := hitung_jarak(v_lintang_jemput, v_bujur_jemput, v_lintang_sekolah, v_bujur_sekolah);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Membuat trigger pada tabel perjalanan sebelum INSERT atau UPDATE
DROP TRIGGER IF EXISTS trg_hitung_jarak_perjalanan ON perjalanan;
CREATE TRIGGER trg_hitung_jarak_perjalanan
BEFORE INSERT OR UPDATE ON perjalanan
FOR EACH ROW
EXECUTE FUNCTION hitung_jarak_perjalanan();

-- 3. Backfill data jarak_km untuk perjalanan yang sudah ada (yang masih kosong)
UPDATE perjalanan
SET jarak_km = hitung_jarak(a.lintang_jemput, a.bujur_jemput, COALESCE(s.lintang, a.lintang_antar), COALESCE(s.bujur, a.bujur_antar))
FROM anak a
LEFT JOIN sekolah s ON s.id = a.sekolah_id
WHERE perjalanan.anak_id = a.id AND perjalanan.jarak_km IS NULL;
