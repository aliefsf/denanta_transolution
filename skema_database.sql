-- ==========================================
-- SKEMA DATABASE DENANTA TRANSOLUTION
-- Target: Supabase PostgreSQL
-- Warna Brand: #1a1a2e, #16213e, #0f3460, #e94560
-- ==========================================

-- Aktifkan Ekstensi yang Dibutuhkan
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PEMBUATAN TABEL-TABEL UTAMA
-- ==========================================

-- Tabel Pengguna (Menghubungkan ke auth.users bawaan Supabase)
CREATE TABLE pengguna (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  peran text NOT NULL CHECK (peran IN ('tamu', 'orangtua', 'supir', 'admin')) DEFAULT 'tamu',
  nama_lengkap text NOT NULL,
  nomor_telepon text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Orang Tua
CREATE TABLE orang_tua (
  id uuid PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
  alamat text NOT NULL,
  kontak_darurat text,
  nomor_whatsapp text NOT NULL,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Sekolah
CREATE TABLE sekolah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  alamat text NOT NULL,
  lintang double precision NOT NULL,
  bujur double precision NOT NULL,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Anak
CREATE TABLE anak (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orang_tua_id uuid NOT NULL REFERENCES orang_tua(id) ON DELETE CASCADE,
  sekolah_id uuid NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
  nama_lengkap text NOT NULL,
  kelas text NOT NULL,
  url_foto text,
  golongan_darah text,
  alergi text,
  alamat_jemput text NOT NULL,
  lintang_jemput double precision NOT NULL,
  bujur_jemput double precision NOT NULL,
  alamat_antar text NOT NULL,
  lintang_antar double precision NOT NULL,
  bujur_antar double precision NOT NULL,
  jenis_layanan text NOT NULL CHECK (jenis_layanan IN ('antar_jemput', 'antar_saja', 'jemput_saja')),
  jenis_langganan text NOT NULL CHECK (jenis_langganan IN ('bulanan', 'harian')),
  aktif boolean DEFAULT true NOT NULL,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Supir
CREATE TABLE supir (
  id uuid PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
  jenis_kendaraan text NOT NULL,
  nomor_plat text NOT NULL,
  tipe_supir text NOT NULL CHECK (tipe_supir IN ('tetap', 'sementara')),
  aktif boolean DEFAULT false NOT NULL,
  status_verifikasi text NOT NULL CHECK (status_verifikasi IN ('menunggu', 'terverifikasi', 'ditolak')) DEFAULT 'menunggu',
  url_sim text,
  url_stnk text,
  url_surat_kepolisian text,
  lintang_terkini double precision,
  bujur_terkini double precision,
  tersedia boolean DEFAULT true NOT NULL,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Langganan
CREATE TABLE langganan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  tanggal_mulai date NOT NULL,
  tanggal_berakhir date NOT NULL,
  biaya_bulanan decimal(12,2) NOT NULL,
  sudah_dibayar boolean DEFAULT false NOT NULL,
  tanggal_jatuh_tempo date NOT NULL,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Perjalanan
CREATE TABLE perjalanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  supir_id uuid REFERENCES supir(id) ON DELETE SET NULL,
  tanggal_perjalanan date NOT NULL,
  jenis_perjalanan text NOT NULL CHECK (jenis_perjalanan IN ('pagi', 'sore')),
  jenis_layanan text NOT NULL CHECK (jenis_layanan IN ('antar_jemput', 'antar_saja', 'jemput_saja')),
  status text NOT NULL CHECK (status IN ('dijadwalkan', 'penjemputan', 'menuju_sekolah', 'di_sekolah', 'pengantaran', 'tiba', 'dibatalkan')) DEFAULT 'dijadwalkan',
  waktu_jemput timestamptz,
  waktu_antar timestamptz,
  jarak_km double precision,
  biaya_tambahan decimal(12,2) DEFAULT 0.00 NOT NULL,
  catatan text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Log Status Perjalanan (Audit Trail)
CREATE TABLE log_status_perjalanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perjalanan_id uuid NOT NULL REFERENCES perjalanan(id) ON DELETE CASCADE,
  status text NOT NULL,
  lintang double precision,
  bujur double precision,
  catatan text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Pembayaran
CREATE TABLE pembayaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  langganan_id uuid REFERENCES langganan(id) ON DELETE SET NULL,
  perjalanan_id uuid REFERENCES perjalanan(id) ON DELETE SET NULL,
  orang_tua_id uuid NOT NULL REFERENCES orang_tua(id) ON DELETE CASCADE,
  jumlah decimal(12,2) NOT NULL,
  tipe_pembayaran text NOT NULL CHECK (tipe_pembayaran IN ('bulanan', 'harian', 'tambahan', 'pembatalan')),
  status text NOT NULL CHECK (status IN ('menunggu', 'lunas', 'gagal', 'kedaluwarsa')) DEFAULT 'menunggu',
  id_pesanan_midtrans text UNIQUE NOT NULL,
  id_transaksi_midtrans text,
  tanggal_pembayaran timestamptz,
  url_invoice text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Penundaan Pembayaran
CREATE TABLE penundaan_pembayaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pembayaran_id uuid NOT NULL REFERENCES pembayaran(id) ON DELETE CASCADE,
  orang_tua_id uuid NOT NULL REFERENCES orang_tua(id) ON DELETE CASCADE,
  alasan text NOT NULL,
  status text NOT NULL CHECK (status IN ('menunggu', 'disetujui', 'ditolak')) DEFAULT 'menunggu',
  disetujui_oleh uuid REFERENCES pengguna(id) ON DELETE SET NULL,
  disetujui_pada timestamptz,
  tanggal_baru date,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL,
  diperbarui_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Notifikasi
CREATE TABLE notifikasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengguna_id uuid NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  judul text NOT NULL,
  pesan text NOT NULL,
  tipe text NOT NULL CHECK (tipe IN ('perjalanan', 'pembayaran', 'sistem', 'promo')),
  sudah_dibaca boolean DEFAULT false NOT NULL,
  id_terkait uuid,
  tipe_terkait text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL
);

-- Tabel Penilaian (Ulasan Driver)
CREATE TABLE penilaian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orang_tua_id uuid NOT NULL REFERENCES orang_tua(id) ON DELETE CASCADE,
  supir_id uuid NOT NULL REFERENCES supir(id) ON DELETE CASCADE,
  perjalanan_id uuid NOT NULL REFERENCES perjalanan(id) ON DELETE CASCADE,
  bintang integer NOT NULL CHECK (bintang BETWEEN 1 AND 5),
  komentar text,
  dibuat_pada timestamptz DEFAULT NOW() NOT NULL
);

-- ==========================================
-- 2. INDEKS UNTUK OPTIMALISASI QUERY
-- ==========================================
CREATE INDEX idx_pengguna_peran ON pengguna(peran);
CREATE INDEX idx_anak_orang_tua ON anak(orang_tua_id);
CREATE INDEX idx_anak_sekolah ON anak(sekolah_id);
CREATE INDEX idx_supir_aktif ON supir(aktif, tersedia);
CREATE INDEX idx_langganan_anak ON langganan(anak_id);
CREATE INDEX idx_perjalanan_anak ON perjalanan(anak_id);
CREATE INDEX idx_perjalanan_supir ON perjalanan(supir_id);
CREATE INDEX idx_perjalanan_tanggal ON perjalanan(tanggal_perjalanan);
CREATE INDEX idx_pembayaran_orang_tua ON pembayaran(orang_tua_id);
CREATE INDEX idx_pembayaran_midtrans ON pembayaran(id_pesanan_midtrans);
CREATE INDEX idx_notifikasi_pengguna_belum_dibaca ON notifikasi(pengguna_id, sudah_dibaca);
CREATE INDEX idx_penilaian_supir ON penilaian(supir_id);

-- ==========================================
-- 3. FUNGSI PEMBANTU DATABASE (STORED FUNCTIONS)
-- ==========================================

-- Fungsi pembantu RLS untuk mendapatkan peran tanpa menimbulkan rekursi tak terbatas
CREATE OR REPLACE FUNCTION dapatkan_peran_pengguna(user_id uuid)
RETURNS text AS $$
DECLARE
  v_peran text;
BEGIN
  SELECT peran INTO v_peran FROM pengguna WHERE id = user_id;
  RETURN COALESCE(v_peran, 'tamu');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fungsi 1: Hitung Jarak geografis dalam km (PostGIS)
CREATE OR REPLACE FUNCTION hitung_jarak(
  lintang1 double precision,
  bujur1 double precision,
  lintang2 double precision,
  bujur2 double precision
) RETURNS double precision AS $$
BEGIN
  IF lintang1 IS NULL OR bujur1 IS NULL OR lintang2 IS NULL OR bujur2 IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Konversi titik koordinat ke sistem 4326 (WGS84) lalu hitung jarak dalam meter, bagi 1000 untuk km
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(bujur1, lintang1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(bujur2, lintang2), 4326)::geography
  ) / 1000.0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fungsi 2: Hitung Biaya Bulanan berdasarkan jenis layanan dan jumlah hari kerja
CREATE OR REPLACE FUNCTION hitung_biaya_bulanan(
  jenis_layanan text,
  jumlah_hari integer DEFAULT 20
) RETURNS decimal AS $$
DECLARE
  tarif_harian decimal;
BEGIN
  IF jenis_layanan = 'antar_jemput' THEN
    tarif_harian := 25000.00;
  ELSIF jenis_layanan IN ('antar_saja', 'jemput_saja') THEN
    tarif_harian := 15000.00;
  ELSE
    tarif_harian := 10000.00;
  END IF;
  
  RETURN tarif_harian * COALESCE(jumlah_hari, 20);
END;
$$ LANGUAGE plpgsql;

-- Fungsi 3: Hitung Biaya Harian berdasarkan jarak tempuh
CREATE OR REPLACE FUNCTION hitung_biaya_harian(
  jarak_km double precision
) RETURNS decimal AS $$
DECLARE
  tarif_dasar decimal := 10000.00;
  tarif_per_km decimal := 3000.00;
BEGIN
  IF jarak_km IS NULL OR jarak_km < 0 THEN
    RETURN tarif_dasar;
  END IF;
  
  RETURN tarif_dasar + (tarif_per_km * jarak_km::decimal);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. FUNGSI TRIGGER & BINDING TRIGGER
-- ==========================================

-- Trigger A: Pembaruan Kolom 'diperbarui_pada' Otomatis
CREATE OR REPLACE FUNCTION fungsi_perbarui_waktu()
RETURNS TRIGGER AS $$
BEGIN
  NEW.diperbarui_pada = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ikat trigger pembaruan waktu ke semua tabel yang memilikinya
CREATE TRIGGER trg_perbarui_pengguna BEFORE UPDATE ON pengguna FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_orang_tua BEFORE UPDATE ON orang_tua FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_sekolah BEFORE UPDATE ON sekolah FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_anak BEFORE UPDATE ON anak FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_supir BEFORE UPDATE ON supir FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_langganan BEFORE UPDATE ON langganan FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_perjalanan BEFORE UPDATE ON perjalanan FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_pembayaran BEFORE UPDATE ON pembayaran FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
CREATE TRIGGER trg_perbarui_penundaan BEFORE UPDATE ON penundaan_pembayaran FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();

-- Trigger B: Pembuatan Langganan Otomatis saat Siswa/Anak baru ditambahkan
CREATE OR REPLACE FUNCTION fungsi_buat_langganan_otomatis()
RETURNS TRIGGER AS $$
DECLARE
  v_biaya decimal;
BEGIN
  v_biaya := hitung_biaya_bulanan(NEW.jenis_layanan, 20);
  
  INSERT INTO langganan (
    id,
    anak_id,
    tanggal_mulai,
    tanggal_berakhir,
    biaya_bulanan,
    sudah_dibayar,
    tanggal_jatuh_tempo,
    dibuat_pada,
    diperbarui_pada
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    v_biaya,
    false,
    CURRENT_DATE + INTERVAL '5 days',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_buat_langganan_otomatis
  AFTER INSERT ON anak
  FOR EACH ROW
  EXECUTE FUNCTION fungsi_buat_langganan_otomatis();

-- Trigger C: Pembuatan Notifikasi Otomatis untuk Perubahan Status Perjalanan
CREATE OR REPLACE FUNCTION fungsi_buat_notifikasi_status_perjalanan()
RETURNS TRIGGER AS $$
DECLARE
  v_orang_tua_id uuid;
  v_nama_anak text;
  v_judul text;
  v_pesan text;
BEGIN
  -- Jalankan hanya jika status berubah
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT orang_tua_id, nama_lengkap INTO v_orang_tua_id, v_nama_anak
    FROM anak
    WHERE id = NEW.anak_id;
    
    IF v_orang_tua_id IS NOT NULL THEN
      v_judul := 'Update Perjalanan: ' || v_nama_anak;
      
      CASE NEW.status
        WHEN 'dijadwalkan' THEN
          v_pesan := 'Jadwal armada antar jemput untuk ' || v_nama_anak || ' telah diatur hari ini.';
        WHEN 'penjemputan' THEN
          v_pesan := 'Supir armada penjemputan sedang menuju lokasi penjemputan ' || v_nama_anak || '.';
        WHEN 'menuju_sekolah' THEN
          v_pesan := 'Ananda ' || v_nama_anak || ' telah naik ke armada dan sedang menuju ke sekolah.';
        WHEN 'di_sekolah' THEN
          v_pesan := 'Alhamdulillah, ' || v_nama_anak || ' telah sampai di sekolah dengan selamat.';
        WHEN 'pengantaran' THEN
          v_pesan := 'Armada penjemputan pulang sekolah sedang berjalan mengantar ' || v_nama_anak || '.';
        WHEN 'tiba' THEN
          v_pesan := 'Alhamdulillah, ' || v_nama_anak || ' telah tiba kembali di rumah dengan selamat.';
        WHEN 'dibatalkan' THEN
          v_pesan := 'Perjalanan armada sekolah untuk ' || v_nama_anak || ' hari ini dibatalkan.';
        ELSE
          v_pesan := 'Status penjemputan ' || v_nama_anak || ' diperbarui menjadi: ' || NEW.status || '.';
      END CASE;
      
      INSERT INTO notifikasi (
        id,
        pengguna_id,
        judul,
        pesan,
        tipe,
        sudah_dibaca,
        id_terkait,
        tipe_terkait,
        dibuat_pada
      ) VALUES (
        gen_random_uuid(),
        v_orang_tua_id,
        v_judul,
        v_pesan,
        'perjalanan',
        false,
        NEW.id,
        'perjalanan',
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_buat_notifikasi_status_perjalanan
  AFTER INSERT OR UPDATE OF status ON perjalanan
  FOR EACH ROW
  EXECUTE FUNCTION fungsi_buat_notifikasi_status_perjalanan();

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Aktifkan RLS di setiap tabel
ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;
ALTER TABLE orang_tua ENABLE ROW LEVEL SECURITY;
ALTER TABLE sekolah ENABLE ROW LEVEL SECURITY;
ALTER TABLE anak ENABLE ROW LEVEL SECURITY;
ALTER TABLE supir ENABLE ROW LEVEL SECURITY;
ALTER TABLE langganan ENABLE ROW LEVEL SECURITY;
ALTER TABLE perjalanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_status_perjalanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE penundaan_pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE penilaian ENABLE ROW LEVEL SECURITY;

-- Kebijakan A: Tabel Pengguna
CREATE POLICY "Pengguna: Admin memiliki akses penuh"
  ON pengguna FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Pengguna: Melihat data profil mandiri"
  ON pengguna FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Pengguna: Mengubah data profil mandiri"
  ON pengguna FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kebijakan B: Tabel Orang Tua
CREATE POLICY "Orang Tua: Admin memiliki akses penuh"
  ON orang_tua FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Orang Tua: Melihat profil mandiri"
  ON orang_tua FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Orang Tua: Mengubah profil mandiri"
  ON orang_tua FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kebijakan C: Tabel Sekolah
CREATE POLICY "Sekolah: Admin memiliki akses penuh"
  ON sekolah FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Sekolah: Seluruh pengguna terautentikasi dapat melihat daftar sekolah"
  ON sekolah FOR SELECT TO authenticated
  USING (true);

-- Kebijakan D: Tabel Anak
CREATE POLICY "Anak: Admin memiliki akses penuh"
  ON anak FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Anak: Orang tua melihat & mengelola data anak sendiri"
  ON anak FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

CREATE POLICY "Anak: Orang tua mengubah data anak sendiri"
  ON anak FOR UPDATE TO authenticated
  USING (orang_tua_id = auth.uid())
  WITH CHECK (orang_tua_id = auth.uid());

CREATE POLICY "Anak: Supir melihat data anak yang ditugaskan ke perjalanannya"
  ON anak FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perjalanan
      WHERE perjalanan.anak_id = anak.id AND perjalanan.supir_id = auth.uid()
    )
  );

-- Kebijakan E: Tabel Supir
CREATE POLICY "Supir: Admin memiliki akses penuh"
  ON supir FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Supir: Melihat profil mandiri"
  ON supir FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Supir: Mengubah profil mandiri"
  ON supir FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Supir: Orang tua melihat profil supir penjemput anak"
  ON supir FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perjalanan
      JOIN anak ON anak.id = perjalanan.anak_id
      WHERE perjalanan.supir_id = supir.id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan F: Tabel Langganan
CREATE POLICY "Langganan: Admin memiliki akses penuh"
  ON langganan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Langganan: Orang tua melihat langganan anaknya"
  ON langganan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = langganan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan G: Tabel Perjalanan
CREATE POLICY "Perjalanan: Admin memiliki akses penuh"
  ON perjalanan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Perjalanan: Supir melihat perjalanannya sendiri"
  ON perjalanan FOR SELECT TO authenticated
  USING (supir_id = auth.uid());

CREATE POLICY "Perjalanan: Supir memperbarui status perjalanan miliknya"
  ON perjalanan FOR UPDATE TO authenticated
  USING (supir_id = auth.uid())
  WITH CHECK (supir_id = auth.uid());

CREATE POLICY "Perjalanan: Orang tua melihat perjalanan anaknya"
  ON perjalanan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan H: Tabel Log Status Perjalanan
CREATE POLICY "Log Perjalanan: Admin memiliki akses penuh"
  ON log_status_perjalanan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Log Perjalanan: Supir membuat log untuk perjalanannya"
  ON log_status_perjalanan FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perjalanan
      WHERE perjalanan.id = perjalanan_id AND perjalanan.supir_id = auth.uid()
    )
  );

CREATE POLICY "Log Perjalanan: Supir melihat log perjalanannya sendiri"
  ON log_status_perjalanan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perjalanan
      WHERE perjalanan.id = perjalanan_id AND perjalanan.supir_id = auth.uid()
    )
  );

CREATE POLICY "Log Perjalanan: Orang tua melihat log perjalanan anak"
  ON log_status_perjalanan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perjalanan
      JOIN anak ON anak.id = perjalanan.anak_id
      WHERE perjalanan.id = perjalanan_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan I: Tabel Pembayaran
CREATE POLICY "Pembayaran: Admin memiliki akses penuh"
  ON pembayaran FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Pembayaran: Orang tua melihat pembayaran miliknya sendiri"
  ON pembayaran FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

CREATE POLICY "Pembayaran: Orang tua menginisiasi baris pembayaran baru"
  ON pembayaran FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

-- Kebijakan J: Tabel Penundaan Pembayaran
CREATE POLICY "Penundaan Pembayaran: Admin memiliki akses penuh"
  ON penundaan_pembayaran FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Penundaan Pembayaran: Orang tua melihat riwayat pengajuannya"
  ON penundaan_pembayaran FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

CREATE POLICY "Penundaan Pembayaran: Orang tua mengajukan permohonan baru"
  ON penundaan_pembayaran FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

-- Kebijakan K: Tabel Notifikasi
CREATE POLICY "Notifikasi: Admin memiliki akses penuh"
  ON notifikasi FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Notifikasi: Melihat notifikasi mandiri"
  ON notifikasi FOR SELECT TO authenticated
  USING (pengguna_id = auth.uid());

CREATE POLICY "Notifikasi: Menandai notifikasi mandiri sudah dibaca"
  ON notifikasi FOR UPDATE TO authenticated
  USING (pengguna_id = auth.uid())
  WITH CHECK (pengguna_id = auth.uid());

-- Kebijakan L: Tabel Penilaian
CREATE POLICY "Penilaian: Admin memiliki akses penuh"
  ON penilaian FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

CREATE POLICY "Penilaian: Orang tua melihat riwayat penilaian yang diberikannya"
  ON penilaian FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

CREATE POLICY "Penilaian: Orang tua membuat penilaian baru"
  ON penilaian FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

CREATE POLICY "Penilaian: Supir melihat ulasan penilaian untuk dirinya"
  ON penilaian FOR SELECT TO authenticated
  USING (supir_id = auth.uid());
