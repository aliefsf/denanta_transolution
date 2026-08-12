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
  foto_profil text,
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
  -- Live Tracking GPS: true SEJAK supir menekan "Mulai Bertugas" (sesi
  -- pagi/sore) di TugasSupir.vue, sampai seluruh tugas pada sesi itu
  -- ditandai selesai (atau supir menandai diri "Tidak Bertugas"). BEDA dari
  -- `tersedia` di atas (itu murni cerminan status_kehadiran/absensi harian,
  -- dipakai utk kelayakan PENUGASAN oleh Admin) -- kolom ini menentukan
  -- kapan marker supir MUNCUL di peta Pemantauan Global Admin
  -- (ambilPosisiSupirAktif, adminLayanan.ts), sedangkan lintang_terkini/
  -- bujur_terkini tetap terisi walau kolom ini false (tidak dihapus).
  sedang_bertugas boolean DEFAULT false NOT NULL,
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
  -- BUKAN lagi UNIQUE (lihat migrasi "HAPUS UNIQUE id_pesanan_midtrans" di
  -- bawah) -- pembayaran gabungan (mis. checkout wizard 2+ anak sekaligus)
  -- sengaja menaruh order_id Midtrans yang SAMA di beberapa baris
  -- `pembayaran` (satu per anak) supaya satu transaksi Snap bisa melunasi
  -- semuanya sekaligus; midtrans-webhook mencari SEMUA baris dengan
  -- id_pesanan_midtrans itu, bukan cuma satu.
  id_pesanan_midtrans text NOT NULL,
  id_transaksi_midtrans text,
  tanggal_pembayaran timestamptz,
  url_invoice text,
  -- Waktu "sekarang" versi klien (bisa digeser lewat fitur waktu simulasi
  -- demo, lihat src/bantuan/waktuSimulasi.ts) SAAT transaksi Midtrans
  -- dibuat. Edge Function midtrans-webhook memakai nilai ini (kalau
  -- terisi) sebagai basis hitung tanggal_berakhir langganan alih-alih
  -- NOW() server -- soalnya webhook dipanggil langsung oleh Midtrans
  -- (server-to-server), tidak pernah tahu localStorage klien.
  waktu_klien_transaksi timestamptz,
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

-- Fungsi pembantu RLS untuk memutus rekursi tak terbatas antara tabel `anak`
-- dan `perjalanan` (policy anak mengecek perjalanan, policy perjalanan
-- mengecek anak -> tanpa fungsi SECURITY DEFINER ini, Postgres akan
-- error "infinite recursion detected in policy for relation anak").
CREATE OR REPLACE FUNCTION anak_ditugaskan_ke_supir(p_anak_id uuid, p_supir_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM perjalanan
    WHERE perjalanan.anak_id = p_anak_id AND perjalanan.supir_id = p_supir_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION perjalanan_milik_anak_orang_tua(p_anak_id uuid, p_orang_tua_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM anak
    WHERE anak.id = p_anak_id AND anak.orang_tua_id = p_orang_tua_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Fungsi 1: Hitung Jarak geografis dalam km (Haversine Formula - Pure Math)
CREATE OR REPLACE FUNCTION hitung_jarak(
  lintang1 double precision,
  bujur1 double precision,
  lintang2 double precision,
  bujur2 double precision
) RETURNS double precision AS $$
DECLARE
  r double precision := 6371.0; -- radius bumi dalam km
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lintang1 IS NULL OR bujur1 IS NULL OR lintang2 IS NULL OR bujur2 IS NULL THEN
    RETURN 0.0;
  END IF;
  
  dlat := radians(lintang2 - lintang1);
  dlon := radians(bujur2 - bujur1);
  
  a := sin(dlat/2.0) * sin(dlat/2.0) +
       cos(radians(lintang1)) * cos(radians(lintang2)) *
       sin(dlon/2.0) * sin(dlon/2.0);
       
  c := 2.0 * asin(sqrt(a));
  
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fungsi pembantu: biaya bertingkat berdasarkan jarak (dipakai untuk biaya
-- harian dan biaya tambahan perubahan jadwal jemput/antar) -- minimal
-- `tarif_dasar` untuk `jarak_dasar_km` pertama, lalu `tarif_per_km` per km
-- kelebihannya.
CREATE OR REPLACE FUNCTION hitung_biaya_jarak_bertingkat(
  jarak_km double precision,
  tarif_dasar decimal,
  jarak_dasar_km double precision DEFAULT 3.5,
  tarif_per_km decimal DEFAULT 4200.00
) RETURNS decimal AS $$
BEGIN
  IF jarak_km IS NULL OR jarak_km <= jarak_dasar_km THEN
    RETURN tarif_dasar;
  END IF;

  RETURN tarif_dasar + (tarif_per_km * (jarak_km - jarak_dasar_km)::decimal);
END;
$$ LANGUAGE plpgsql;

-- Fungsi 2: Hitung Biaya Bulanan -- tarif flat per jenis layanan. Jika
-- `jumlah_hari_aktif` (hari sekolah aktif anak bulan berjalan) diketahui dan
-- <= 10 hari, biaya dipotong 40%.
CREATE OR REPLACE FUNCTION hitung_biaya_bulanan(
  jenis_layanan text,
  jumlah_hari_aktif integer DEFAULT NULL
) RETURNS decimal AS $$
DECLARE
  tarif decimal;
BEGIN
  IF jenis_layanan = 'antar_jemput' THEN
    tarif := 475000.00;
  ELSIF jenis_layanan IN ('antar_saja', 'jemput_saja') THEN
    tarif := 275000.00;
  ELSE
    tarif := 0.00;
  END IF;

  IF jumlah_hari_aktif IS NOT NULL AND jumlah_hari_aktif <= 10 THEN
    tarif := tarif * 0.6; -- potongan 40%
  END IF;

  RETURN tarif;
END;
$$ LANGUAGE plpgsql;

-- Fungsi 3: Hitung Biaya Harian -- minimal Rp20.000 untuk 3,5 km pertama,
-- lalu Rp4.200 per km berikutnya.
CREATE OR REPLACE FUNCTION hitung_biaya_harian(
  jarak_km double precision
) RETURNS decimal AS $$
BEGIN
  RETURN hitung_biaya_jarak_bertingkat(jarak_km, 20000.00);
END;
$$ LANGUAGE plpgsql;

-- Fungsi 4: Hitung Biaya Tambahan Perubahan Jadwal (langganan bulanan) --
-- minimal Rp15.000 untuk 3,5 km pertama, lalu Rp4.200 per km berikutnya.
CREATE OR REPLACE FUNCTION hitung_biaya_perubahan_jadwal(
  jarak_km double precision
) RETURNS decimal AS $$
BEGIN
  RETURN hitung_biaya_jarak_bertingkat(jarak_km, 15000.00);
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
DROP TRIGGER IF EXISTS trg_perbarui_pengguna ON pengguna;
CREATE TRIGGER trg_perbarui_pengguna BEFORE UPDATE ON pengguna FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_orang_tua ON orang_tua;
CREATE TRIGGER trg_perbarui_orang_tua BEFORE UPDATE ON orang_tua FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_sekolah ON sekolah;
CREATE TRIGGER trg_perbarui_sekolah BEFORE UPDATE ON sekolah FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_anak ON anak;
CREATE TRIGGER trg_perbarui_anak BEFORE UPDATE ON anak FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_supir ON supir;
CREATE TRIGGER trg_perbarui_supir BEFORE UPDATE ON supir FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_langganan ON langganan;
CREATE TRIGGER trg_perbarui_langganan BEFORE UPDATE ON langganan FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_perjalanan ON perjalanan;
CREATE TRIGGER trg_perbarui_perjalanan BEFORE UPDATE ON perjalanan FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_pembayaran ON pembayaran;
CREATE TRIGGER trg_perbarui_pembayaran BEFORE UPDATE ON pembayaran FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_penundaan ON penundaan_pembayaran;
CREATE TRIGGER trg_perbarui_penundaan BEFORE UPDATE ON penundaan_pembayaran FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();

-- Trigger Baru: Sinkronisasi Pengguna Otomatis dari auth.users ke public.pengguna dan tabel peran spesifik
CREATE OR REPLACE FUNCTION fungsi_sinkronisasi_pengguna_baru()
RETURNS TRIGGER AS $$
DECLARE
  v_peran text;
  v_nama_lengkap text;
  v_nomor_telepon text;
  v_foto_profil text;
BEGIN
  -- Ambil data dari metadata dengan nilai default yang aman. Untuk login
  -- Google, Supabase mengisi raw_user_meta_data dengan field bawaan OAuth
  -- (full_name/name, avatar_url/picture), bukan nama_lengkap/foto_profil
  -- custom kita -- jadi keduanya dicoba sebagai fallback berjenjang.
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

  -- Validasi peran agar sesuai dengan batasan check constraint
  IF v_peran NOT IN ('orangtua', 'supir', 'admin', 'tamu') THEN
    v_peran := 'orangtua';
  END IF;

  -- Masukkan ke tabel pengguna
  INSERT INTO public.pengguna (id, email, peran, nama_lengkap, nomor_telepon, foto_profil)
  VALUES (
    NEW.id,
    NEW.email,
    v_peran,
    v_nama_lengkap,
    v_nomor_telepon,
    v_foto_profil
  );

  -- Masukkan ke tabel peran spesifik
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
    -- Menghindari kegagalan registrasi jika trigger bermasalah
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hapus trigger jika sudah ada sebelumnya
DROP TRIGGER IF EXISTS trg_pengguna_baru ON auth.users;

-- Ikat trigger sinkronisasi pengguna baru ke auth.users
CREATE TRIGGER trg_pengguna_baru
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fungsi_sinkronisasi_pengguna_baru();

-- Trigger B: Pembuatan Langganan Otomatis saat Siswa/Anak baru ditambahkan
CREATE OR REPLACE FUNCTION fungsi_buat_langganan_otomatis()
RETURNS TRIGGER AS $$
DECLARE
  v_biaya decimal;
BEGIN
  -- Jumlah hari sekolah aktif bulan ini belum diketahui saat anak baru
  -- didaftarkan (jadwal mingguan belum diatur), jadi belum ada potongan.
  v_biaya := hitung_biaya_bulanan(NEW.jenis_layanan, NULL);
  
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

DROP TRIGGER IF EXISTS trg_buat_langganan_otomatis ON anak;
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
      -- Judul SEKARANG langsung menyebut status terkini (bukan judul generik
      -- "Update Perjalanan: nama" utk semua status) -- supaya info paling
      -- penting (apa yang sedang terjadi) langsung terlihat di judul tanpa
      -- perlu membuka/membaca isi pesan. tipe_terkait juga diisi status
      -- perjalanan aktualnya (bukan literal 'perjalanan' generik), dipakai
      -- client (src/bantuan/notifikasiTampilan.ts) untuk memilih ikon & warna
      -- aksen yang sesuai per status di daftar notifikasi.
      CASE NEW.status
        WHEN 'dijadwalkan' THEN
          v_judul := 'Jadwal Diatur: ' || v_nama_anak;
          v_pesan := 'Jadwal armada antar jemput untuk ' || v_nama_anak || ' telah diatur hari ini.';
        WHEN 'penjemputan' THEN
          v_judul := 'Penjemputan Dimulai: ' || v_nama_anak;
          v_pesan := 'Supir armada penjemputan sedang menuju lokasi penjemputan ' || v_nama_anak || '.';
        WHEN 'menuju_sekolah' THEN
          v_judul := 'Menuju Sekolah: ' || v_nama_anak;
          v_pesan := 'Ananda ' || v_nama_anak || ' telah naik ke armada dan sedang menuju ke sekolah.';
        WHEN 'di_sekolah' THEN
          v_judul := 'Tiba di Sekolah: ' || v_nama_anak;
          v_pesan := 'Alhamdulillah, ' || v_nama_anak || ' telah sampai di sekolah dengan selamat.';
        WHEN 'pengantaran' THEN
          v_judul := 'Pengantaran Pulang Dimulai: ' || v_nama_anak;
          v_pesan := 'Armada penjemputan pulang sekolah sedang berjalan mengantar ' || v_nama_anak || '.';
        WHEN 'tiba' THEN
          v_judul := 'Tiba di Rumah: ' || v_nama_anak;
          v_pesan := 'Alhamdulillah, ' || v_nama_anak || ' telah tiba kembali di rumah dengan selamat.';
        WHEN 'dibatalkan' THEN
          v_judul := 'Perjalanan Dibatalkan: ' || v_nama_anak;
          v_pesan := 'Perjalanan armada sekolah untuk ' || v_nama_anak || ' hari ini dibatalkan.';
        ELSE
          v_judul := 'Update Perjalanan: ' || v_nama_anak;
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
        NEW.status,
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_buat_notifikasi_status_perjalanan ON perjalanan;
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
DROP POLICY IF EXISTS "Pengguna: Admin memiliki akses penuh" ON pengguna;
CREATE POLICY "Pengguna: Admin memiliki akses penuh"
  ON pengguna FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pengguna: Melihat data profil mandiri" ON pengguna;
CREATE POLICY "Pengguna: Melihat data profil mandiri"
  ON pengguna FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Pengguna: Mengubah data profil mandiri" ON pengguna;
CREATE POLICY "Pengguna: Mengubah data profil mandiri"
  ON pengguna FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kebijakan B: Tabel Orang Tua
DROP POLICY IF EXISTS "Orang Tua: Admin memiliki akses penuh" ON orang_tua;
CREATE POLICY "Orang Tua: Admin memiliki akses penuh"
  ON orang_tua FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Orang Tua: Melihat profil mandiri" ON orang_tua;
CREATE POLICY "Orang Tua: Melihat profil mandiri"
  ON orang_tua FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Orang Tua: Mengubah profil mandiri" ON orang_tua;
CREATE POLICY "Orang Tua: Mengubah profil mandiri"
  ON orang_tua FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Kebijakan C: Tabel Sekolah
DROP POLICY IF EXISTS "Sekolah: Admin memiliki akses penuh" ON sekolah;
CREATE POLICY "Sekolah: Admin memiliki akses penuh"
  ON sekolah FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Sekolah: Seluruh pengguna terautentikasi dapat melihat daftar sekolah" ON sekolah;
CREATE POLICY "Sekolah: Seluruh pengguna terautentikasi dapat melihat daftar sekolah"
  ON sekolah FOR SELECT TO authenticated
  USING (true);

-- Kebijakan D: Tabel Anak
DROP POLICY IF EXISTS "Anak: Admin memiliki akses penuh" ON anak;
CREATE POLICY "Anak: Admin memiliki akses penuh"
  ON anak FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Anak: Orang tua melihat & mengelola data anak sendiri" ON anak;
CREATE POLICY "Anak: Orang tua melihat & mengelola data anak sendiri"
  ON anak FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Anak: Orang tua mengubah data anak sendiri" ON anak;
CREATE POLICY "Anak: Orang tua mengubah data anak sendiri"
  ON anak FOR UPDATE TO authenticated
  USING (orang_tua_id = auth.uid())
  WITH CHECK (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Anak: Orang tua mendaftarkan anak baru" ON anak;
CREATE POLICY "Anak: Orang tua mendaftarkan anak baru"
  ON anak FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Anak: Orang tua menghapus data anak sendiri" ON anak;
CREATE POLICY "Anak: Orang tua menghapus data anak sendiri"
  ON anak FOR DELETE TO authenticated
  USING (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Anak: Supir melihat data anak yang ditugaskan ke perjalanannya" ON anak;
CREATE POLICY "Anak: Supir melihat data anak yang ditugaskan ke perjalanannya"
  ON anak FOR SELECT TO authenticated
  USING (anak_ditugaskan_ke_supir(anak.id, auth.uid()));

-- Kebijakan E: Tabel Supir
DROP POLICY IF EXISTS "Supir: Admin memiliki akses penuh" ON supir;
CREATE POLICY "Supir: Admin memiliki akses penuh"
  ON supir FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Supir: Melihat profil mandiri" ON supir;
CREATE POLICY "Supir: Melihat profil mandiri"
  ON supir FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Supir: Mengubah profil mandiri" ON supir;
CREATE POLICY "Supir: Mengubah profil mandiri"
  ON supir FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Supir: Orang tua melihat profil supir penjemput anak" ON supir;
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
DROP POLICY IF EXISTS "Langganan: Admin memiliki akses penuh" ON langganan;
CREATE POLICY "Langganan: Admin memiliki akses penuh"
  ON langganan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Langganan: Orang tua melihat langganan anaknya" ON langganan;
CREATE POLICY "Langganan: Orang tua melihat langganan anaknya"
  ON langganan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = langganan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Supir perlu membaca status langganan (sudah_dibayar/tanggal_berakhir) anak
-- yang ditugaskan ke rutenya, supaya ambilTugasHariIni() (supirLayanan.ts)
-- bisa menyaring anak yang belum lunas/sudah kedaluwarsa dari daftar
-- tugas/peta rute -- tanpa policy ini, query langganan dari sesi supir
-- hanya menghasilkan 0 baris (bukan error) karena RLS, yang keliru membuat
-- SEMUA anak (termasuk yang langganannya aktif) ikut tersaring habis.
DROP POLICY IF EXISTS "Langganan: Supir melihat langganan anak yang ditugaskan ke perjalanannya" ON langganan;
CREATE POLICY "Langganan: Supir melihat langganan anak yang ditugaskan ke perjalanannya"
  ON langganan FOR SELECT TO authenticated
  USING (anak_ditugaskan_ke_supir(langganan.anak_id, auth.uid()));

DROP POLICY IF EXISTS "Langganan: Orang tua membuat langganan untuk anaknya" ON langganan;
CREATE POLICY "Langganan: Orang tua membuat langganan untuk anaknya"
  ON langganan FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = langganan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Langganan: Orang tua memperbarui langganan anaknya" ON langganan;
CREATE POLICY "Langganan: Orang tua memperbarui langganan anaknya"
  ON langganan FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = langganan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = langganan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan G: Tabel Perjalanan
DROP POLICY IF EXISTS "Perjalanan: Admin memiliki akses penuh" ON perjalanan;
CREATE POLICY "Perjalanan: Admin memiliki akses penuh"
  ON perjalanan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Perjalanan: Supir melihat perjalanannya sendiri" ON perjalanan;
CREATE POLICY "Perjalanan: Supir melihat perjalanannya sendiri"
  ON perjalanan FOR SELECT TO authenticated
  USING (supir_id = auth.uid());

DROP POLICY IF EXISTS "Perjalanan: Supir memperbarui status perjalanan miliknya" ON perjalanan;
CREATE POLICY "Perjalanan: Supir memperbarui status perjalanan miliknya"
  ON perjalanan FOR UPDATE TO authenticated
  USING (supir_id = auth.uid())
  WITH CHECK (supir_id = auth.uid());

DROP POLICY IF EXISTS "Perjalanan: Orang tua melihat perjalanan anaknya" ON perjalanan;
CREATE POLICY "Perjalanan: Orang tua melihat perjalanan anaknya"
  ON perjalanan FOR SELECT TO authenticated
  USING (perjalanan_milik_anak_orang_tua(perjalanan.anak_id, auth.uid()));

-- Kebijakan H: Tabel Log Status Perjalanan
DROP POLICY IF EXISTS "Log Perjalanan: Admin memiliki akses penuh" ON log_status_perjalanan;
CREATE POLICY "Log Perjalanan: Admin memiliki akses penuh"
  ON log_status_perjalanan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Log Perjalanan: Supir membuat log untuk perjalanannya" ON log_status_perjalanan;
CREATE POLICY "Log Perjalanan: Supir membuat log untuk perjalanannya"
  ON log_status_perjalanan FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perjalanan
      WHERE perjalanan.id = perjalanan_id AND perjalanan.supir_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Log Perjalanan: Supir melihat log perjalanannya sendiri" ON log_status_perjalanan;
CREATE POLICY "Log Perjalanan: Supir melihat log perjalanannya sendiri"
  ON log_status_perjalanan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perjalanan
      WHERE perjalanan.id = perjalanan_id AND perjalanan.supir_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Log Perjalanan: Orang tua melihat log perjalanan anak" ON log_status_perjalanan;
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
DROP POLICY IF EXISTS "Pembayaran: Admin memiliki akses penuh" ON pembayaran;
CREATE POLICY "Pembayaran: Admin memiliki akses penuh"
  ON pembayaran FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pembayaran: Orang tua melihat pembayaran miliknya sendiri" ON pembayaran;
CREATE POLICY "Pembayaran: Orang tua melihat pembayaran miliknya sendiri"
  ON pembayaran FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Pembayaran: Orang tua menginisiasi baris pembayaran baru" ON pembayaran;
CREATE POLICY "Pembayaran: Orang tua menginisiasi baris pembayaran baru"
  ON pembayaran FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Pembayaran: Orang tua memperbarui status pembayaran miliknya" ON pembayaran;
CREATE POLICY "Pembayaran: Orang tua memperbarui status pembayaran miliknya"
  ON pembayaran FOR UPDATE TO authenticated
  USING (orang_tua_id = auth.uid())
  WITH CHECK (orang_tua_id = auth.uid());

-- Tombol "Hapus" di Daftar Faktur (RiwayatPembayaran.vue) -- SENGAJA
-- dibatasi hanya utk baris yang BELUM lunas (status != 'lunas'). Baris
-- 'lunas' adalah bukti pembayaran resmi yang sudah selesai, tidak boleh
-- terhapus begitu saja dari sisi klien -- kalau perlu dihapus (mis. data
-- uji coba), Admin tetap bisa lewat kebijakan "akses penuh" di atas.
DROP POLICY IF EXISTS "Pembayaran: Orang tua menghapus tagihan belum lunas miliknya" ON pembayaran;
CREATE POLICY "Pembayaran: Orang tua menghapus tagihan belum lunas miliknya"
  ON pembayaran FOR DELETE TO authenticated
  USING (orang_tua_id = auth.uid() AND status <> 'lunas');

-- Kebijakan J: Tabel Penundaan Pembayaran
DROP POLICY IF EXISTS "Penundaan Pembayaran: Admin memiliki akses penuh" ON penundaan_pembayaran;
CREATE POLICY "Penundaan Pembayaran: Admin memiliki akses penuh"
  ON penundaan_pembayaran FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Penundaan Pembayaran: Orang tua melihat riwayat pengajuannya" ON penundaan_pembayaran;
CREATE POLICY "Penundaan Pembayaran: Orang tua melihat riwayat pengajuannya"
  ON penundaan_pembayaran FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Penundaan Pembayaran: Orang tua mengajukan permohonan baru" ON penundaan_pembayaran;
CREATE POLICY "Penundaan Pembayaran: Orang tua mengajukan permohonan baru"
  ON penundaan_pembayaran FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

-- Kebijakan K: Tabel Notifikasi
DROP POLICY IF EXISTS "Notifikasi: Admin memiliki akses penuh" ON notifikasi;
CREATE POLICY "Notifikasi: Admin memiliki akses penuh"
  ON notifikasi FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Notifikasi: Melihat notifikasi mandiri" ON notifikasi;
CREATE POLICY "Notifikasi: Melihat notifikasi mandiri"
  ON notifikasi FOR SELECT TO authenticated
  USING (pengguna_id = auth.uid());

DROP POLICY IF EXISTS "Notifikasi: Menandai notifikasi mandiri sudah dibaca" ON notifikasi;
CREATE POLICY "Notifikasi: Menandai notifikasi mandiri sudah dibaca"
  ON notifikasi FOR UPDATE TO authenticated
  USING (pengguna_id = auth.uid())
  WITH CHECK (pengguna_id = auth.uid());

-- Tombol "Hapus"/"Bersihkan Semua" di kotak masuk notifikasi (semua peran) --
-- SEBELUMNYA tidak ada kebijakan DELETE utk baris milik sendiri sama sekali
-- (cuma Admin, lewat "Notifikasi: Admin memiliki akses penuh" FOR ALL di
-- atas, yang bisa menghapus notifikasi APAPUN termasuk milik orang lain --
-- itu memang perlu tetap ada, tapi Orang Tua/Supir juga perlu bisa hapus
-- punya sendiri).
DROP POLICY IF EXISTS "Notifikasi: Menghapus notifikasi mandiri" ON notifikasi;
CREATE POLICY "Notifikasi: Menghapus notifikasi mandiri"
  ON notifikasi FOR DELETE TO authenticated
  USING (pengguna_id = auth.uid());

-- Kebijakan L: Tabel Penilaian
DROP POLICY IF EXISTS "Penilaian: Admin memiliki akses penuh" ON penilaian;
CREATE POLICY "Penilaian: Admin memiliki akses penuh"
  ON penilaian FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Penilaian: Orang tua melihat riwayat penilaian yang diberikannya" ON penilaian;
CREATE POLICY "Penilaian: Orang tua melihat riwayat penilaian yang diberikannya"
  ON penilaian FOR SELECT TO authenticated
  USING (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Penilaian: Orang tua membuat penilaian baru" ON penilaian;
CREATE POLICY "Penilaian: Orang tua membuat penilaian baru"
  ON penilaian FOR INSERT TO authenticated
  WITH CHECK (orang_tua_id = auth.uid());

DROP POLICY IF EXISTS "Penilaian: Supir melihat ulasan penilaian untuk dirinya" ON penilaian;
CREATE POLICY "Penilaian: Supir melihat ulasan penilaian untuk dirinya"
  ON penilaian FOR SELECT TO authenticated
  USING (supir_id = auth.uid());

-- ==========================================
-- 6. FITUR JADWAL ANTAR JEMPUT (Tambahan)
-- ==========================================
-- Tabel-tabel berikut mendukung tab "Jadwal" pada dashboard orang tua:
-- konfigurasi hari sekolah mingguan, absen harian, pengajuan cuti, dan
-- pengajuan perubahan jadwal jemput/antar per anak.

CREATE TABLE jadwal_mingguan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL UNIQUE REFERENCES anak(id) ON DELETE CASCADE,
  senin boolean NOT NULL DEFAULT true,
  selasa boolean NOT NULL DEFAULT true,
  rabu boolean NOT NULL DEFAULT true,
  kamis boolean NOT NULL DEFAULT true,
  jumat boolean NOT NULL DEFAULT true,
  sabtu boolean NOT NULL DEFAULT false,
  minggu boolean NOT NULL DEFAULT false,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pengajuan_absen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  tanggal date NOT NULL,
  status text NOT NULL DEFAULT 'masuk' CHECK (status IN ('masuk', 'tidak_masuk')),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anak_id, tanggal)
);

CREATE TABLE pengajuan_cuti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  alasan text NOT NULL,
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pengajuan_perubahan_jadwal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  hari text NOT NULL,
  waktu_baru time NOT NULL,
  biaya_tambahan decimal(12,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jadwal_mingguan_anak ON jadwal_mingguan(anak_id);
CREATE INDEX idx_pengajuan_absen_anak ON pengajuan_absen(anak_id, tanggal);
CREATE INDEX idx_pengajuan_cuti_anak ON pengajuan_cuti(anak_id);
CREATE INDEX idx_pengajuan_perubahan_jadwal_anak ON pengajuan_perubahan_jadwal(anak_id);

DROP TRIGGER IF EXISTS trg_perbarui_jadwal_mingguan ON jadwal_mingguan;
CREATE TRIGGER trg_perbarui_jadwal_mingguan BEFORE UPDATE ON jadwal_mingguan FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_pengajuan_absen ON pengajuan_absen;
CREATE TRIGGER trg_perbarui_pengajuan_absen BEFORE UPDATE ON pengajuan_absen FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_pengajuan_cuti ON pengajuan_cuti;
CREATE TRIGGER trg_perbarui_pengajuan_cuti BEFORE UPDATE ON pengajuan_cuti FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();
DROP TRIGGER IF EXISTS trg_perbarui_pengajuan_perubahan_jadwal ON pengajuan_perubahan_jadwal;
CREATE TRIGGER trg_perbarui_pengajuan_perubahan_jadwal BEFORE UPDATE ON pengajuan_perubahan_jadwal FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();

ALTER TABLE jadwal_mingguan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_absen ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_cuti ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_perubahan_jadwal ENABLE ROW LEVEL SECURITY;

-- Kebijakan M: Tabel Jadwal Mingguan
DROP POLICY IF EXISTS "Jadwal Mingguan: Admin memiliki akses penuh" ON jadwal_mingguan;
CREATE POLICY "Jadwal Mingguan: Admin memiliki akses penuh"
  ON jadwal_mingguan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Jadwal Mingguan: Orang tua melihat jadwal anaknya" ON jadwal_mingguan;
CREATE POLICY "Jadwal Mingguan: Orang tua melihat jadwal anaknya"
  ON jadwal_mingguan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Jadwal Mingguan: Orang tua membuat jadwal anaknya" ON jadwal_mingguan;
CREATE POLICY "Jadwal Mingguan: Orang tua membuat jadwal anaknya"
  ON jadwal_mingguan FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Jadwal Mingguan: Orang tua mengubah jadwal anaknya" ON jadwal_mingguan;
CREATE POLICY "Jadwal Mingguan: Orang tua mengubah jadwal anaknya"
  ON jadwal_mingguan FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan N: Tabel Pengajuan Absen
DROP POLICY IF EXISTS "Pengajuan Absen: Admin memiliki akses penuh" ON pengajuan_absen;
CREATE POLICY "Pengajuan Absen: Admin memiliki akses penuh"
  ON pengajuan_absen FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pengajuan Absen: Orang tua melihat absen anaknya" ON pengajuan_absen;
CREATE POLICY "Pengajuan Absen: Orang tua melihat absen anaknya"
  ON pengajuan_absen FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_absen.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pengajuan Absen: Orang tua mengisi absen anaknya" ON pengajuan_absen;
CREATE POLICY "Pengajuan Absen: Orang tua mengisi absen anaknya"
  ON pengajuan_absen FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_absen.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pengajuan Absen: Orang tua mengubah absen anaknya" ON pengajuan_absen;
CREATE POLICY "Pengajuan Absen: Orang tua mengubah absen anaknya"
  ON pengajuan_absen FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_absen.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_absen.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan O: Tabel Pengajuan Cuti
DROP POLICY IF EXISTS "Pengajuan Cuti: Admin memiliki akses penuh" ON pengajuan_cuti;
CREATE POLICY "Pengajuan Cuti: Admin memiliki akses penuh"
  ON pengajuan_cuti FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pengajuan Cuti: Orang tua melihat pengajuan cuti anaknya" ON pengajuan_cuti;
CREATE POLICY "Pengajuan Cuti: Orang tua melihat pengajuan cuti anaknya"
  ON pengajuan_cuti FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_cuti.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pengajuan Cuti: Orang tua mengajukan cuti anaknya" ON pengajuan_cuti;
CREATE POLICY "Pengajuan Cuti: Orang tua mengajukan cuti anaknya"
  ON pengajuan_cuti FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_cuti.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Kebijakan P: Tabel Pengajuan Perubahan Jadwal
DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Admin memiliki akses penuh" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Admin memiliki akses penuh"
  ON pengajuan_perubahan_jadwal FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua melihat pengajuan anaknya" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Orang tua melihat pengajuan anaknya"
  ON pengajuan_perubahan_jadwal FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua mengajukan perubahan anaknya" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Orang tua mengajukan perubahan anaknya"
  ON pengajuan_perubahan_jadwal FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak
      WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: KOLOM FOTO PROFIL PENGGUNA
-- Aman dijalankan berulang kali (idempotent) pada database yang sudah ada.
-- Tidak menghapus/mengubah data pengguna yang sudah ada; kolom baru bernilai
-- NULL untuk baris lama sampai pengguna mengunggah foto profil.
-- ==========================================
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS foto_profil text;

-- ==========================================
-- STORAGE: BUCKET FOTO PROFIL
-- Jalankan bagian ini secara manual di Supabase SQL Editor.
-- Bucket bersifat public-read (avatar ditampilkan lewat public URL biasa oleh
-- NavbarTamu.vue, HalamanUtama.vue, HalamanTentang.vue, dan HalamanEditProfil.vue
-- via getPublicUrl()) tetapi hanya pemilik akun yang boleh mengunggah/mengubah/
-- menghapus foto miliknya — dijaga lewat kebijakan folder-ownership di bawah.
-- Struktur path objek: profile-images/{user_id}/{nama_file}
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  2097152, -- 2 MB, selaras dengan validasi ukuran di frontend
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Kebijakan Storage: setiap pengguna hanya boleh mengunggah/mengubah/menghapus
-- foto profil miliknya sendiri. Nama folder root objek harus sama dengan
-- auth.uid() pengguna yang login, sesuai struktur profile-images/{user_id}/...
-- Baca (SELECT) dibuka untuk siapa saja karena bucket bersifat public-read.
DROP POLICY IF EXISTS "Foto Profil: Pengguna mengunggah foto miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Profil: Pengguna mengunggah foto miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Profil: Siapa saja dapat melihat foto profil (public-read)" ON storage.objects;
CREATE POLICY "Foto Profil: Siapa saja dapat melihat foto profil (public-read)"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Foto Profil: Pengguna memperbarui foto miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Profil: Pengguna memperbarui foto miliknya sendiri"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Profil: Pengguna menghapus foto miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Profil: Pengguna menghapus foto miliknya sendiri"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- MIGRASI: CONSTRAINT UNIK PERJALANAN PER ANAK/TANGGAL/SESI
-- Diperlukan supaya upsert penugasan supir (UC-A06) tidak membuat baris
-- duplikat kalau admin menugaskan ulang anak yang sama pada tanggal & sesi
-- (pagi/sore) yang sama.
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perjalanan_anak_tanggal_sesi_key'
  ) THEN
    ALTER TABLE perjalanan
      ADD CONSTRAINT perjalanan_anak_tanggal_sesi_key
      UNIQUE (anak_id, tanggal_perjalanan, jenis_perjalanan);
  END IF;
END $$;

-- ==========================================
-- MIGRASI: PENGATURAN TARIF (UC-A09 Kelola Tarif)
-- Baris tunggal (id selalu 1) menyimpan parameter tarif yang sebelumnya
-- hardcoded di kode. Dibaca publik (wizard berlangganan & kalkulator estimasi
-- di landing page dapat diakses tanpa login) tapi hanya admin yang boleh ubah.
-- ==========================================
CREATE TABLE IF NOT EXISTS pengaturan_tarif (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tarif_antar_jemput decimal(12,2) NOT NULL DEFAULT 475000.00,
  tarif_antar_saja decimal(12,2) NOT NULL DEFAULT 275000.00,
  tarif_jemput_saja decimal(12,2) NOT NULL DEFAULT 275000.00,
  tarif_per_km decimal(12,2) NOT NULL DEFAULT 4200.00,
  biaya_minimal_harian decimal(12,2) NOT NULL DEFAULT 20000.00,
  biaya_minimal_perubahan_jadwal decimal(12,2) NOT NULL DEFAULT 15000.00,
  jarak_dasar_km double precision NOT NULL DEFAULT 3.5,
  potongan_hari_pendek_persen integer NOT NULL DEFAULT 40,
  ambang_hari_pendek integer NOT NULL DEFAULT 10,
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pengaturan_tarif (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_perbarui_pengaturan_tarif ON pengaturan_tarif;
CREATE TRIGGER trg_perbarui_pengaturan_tarif BEFORE UPDATE ON pengaturan_tarif FOR EACH ROW EXECUTE FUNCTION fungsi_perbarui_waktu();

ALTER TABLE pengaturan_tarif ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengaturan Tarif: Siapa saja dapat membaca" ON pengaturan_tarif;
CREATE POLICY "Pengaturan Tarif: Siapa saja dapat membaca"
  ON pengaturan_tarif FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Pengaturan Tarif: Admin dapat mengubah" ON pengaturan_tarif;
CREATE POLICY "Pengaturan Tarif: Admin dapat mengubah"
  ON pengaturan_tarif FOR UPDATE TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin')
  WITH CHECK (dapatkan_peran_pengguna(auth.uid()) = 'admin');

-- Perbarui fungsi tarif agar membaca parameter dari pengaturan_tarif, bukan
-- konstanta tertulis di kode -- supaya perubahan tarif oleh admin langsung
-- berlaku tanpa perlu deploy ulang (sesuai postcondition UC-A09).
-- DROP dulu: CREATE OR REPLACE tidak boleh mengubah nama parameter fungsi
-- yang sudah ada (bisa gagal dengan error 42P13 kalau versi lama di database
-- punya nama parameter berbeda, mis. "jumlah_hari" vs "jumlah_hari_aktif").
DROP FUNCTION IF EXISTS hitung_biaya_bulanan(text, integer);
CREATE OR REPLACE FUNCTION hitung_biaya_bulanan(
  jenis_layanan text,
  jumlah_hari_aktif integer DEFAULT NULL
) RETURNS decimal AS $$
DECLARE
  tarif decimal;
  v_potongan_persen integer;
  v_ambang_hari integer;
BEGIN
  SELECT
    CASE jenis_layanan
      WHEN 'antar_jemput' THEN tarif_antar_jemput
      WHEN 'antar_saja' THEN tarif_antar_saja
      WHEN 'jemput_saja' THEN tarif_jemput_saja
      ELSE 0
    END,
    potongan_hari_pendek_persen,
    ambang_hari_pendek
  INTO tarif, v_potongan_persen, v_ambang_hari
  FROM pengaturan_tarif WHERE id = 1;

  IF jumlah_hari_aktif IS NOT NULL AND jumlah_hari_aktif <= v_ambang_hari THEN
    tarif := tarif * (1 - v_potongan_persen / 100.0);
  END IF;

  RETURN tarif;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hitung_biaya_harian(
  jarak_km double precision
) RETURNS decimal AS $$
DECLARE
  v_tarif_dasar decimal;
BEGIN
  SELECT biaya_minimal_harian INTO v_tarif_dasar FROM pengaturan_tarif WHERE id = 1;
  RETURN hitung_biaya_jarak_bertingkat(jarak_km, v_tarif_dasar);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hitung_biaya_perubahan_jadwal(
  jarak_km double precision
) RETURNS decimal AS $$
DECLARE
  v_tarif_dasar decimal;
BEGIN
  SELECT biaya_minimal_perubahan_jadwal INTO v_tarif_dasar FROM pengaturan_tarif WHERE id = 1;
  RETURN hitung_biaya_jarak_bertingkat(jarak_km, v_tarif_dasar);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hitung_biaya_jarak_bertingkat(
  jarak_km double precision,
  tarif_dasar decimal,
  jarak_dasar_km double precision DEFAULT NULL,
  tarif_per_km decimal DEFAULT NULL
) RETURNS decimal AS $$
DECLARE
  v_jarak_dasar double precision;
  v_tarif_per_km decimal;
BEGIN
  SELECT
    COALESCE(jarak_dasar_km, pengaturan_tarif.jarak_dasar_km),
    COALESCE(tarif_per_km, pengaturan_tarif.tarif_per_km)
  INTO v_jarak_dasar, v_tarif_per_km
  FROM pengaturan_tarif WHERE id = 1;

  IF jarak_km IS NULL OR jarak_km <= v_jarak_dasar THEN
    RETURN tarif_dasar;
  END IF;

  RETURN tarif_dasar + (v_tarif_per_km * (jarak_km - v_jarak_dasar)::decimal);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MIGRASI: DOKUMEN LEGALITAS SUPIR (KTP)
-- Kolom url_sim/url_stnk/url_surat_kepolisian sudah ada sejak awal, url_ktp
-- ditambahkan menyusul untuk formulir "Tambah Supir" di panel Admin.
-- ==========================================
ALTER TABLE supir ADD COLUMN IF NOT EXISTS url_ktp text;

-- ==========================================
-- STORAGE: BUCKET DOKUMEN SUPIR (KTP/SIM/STNK)
-- Jalankan bagian ini secara manual di Supabase SQL Editor.
-- Public-read seperti bucket profile-images (konsisten dengan pola yang
-- sudah dipakai di proyek ini) -- hanya admin yang boleh
-- unggah/ubah/hapus karena dokumen ini diunggah admin saat mendaftarkan
-- supir baru lewat panel Admin, bukan oleh supir itu sendiri.
-- Struktur path objek: dokumen-supir/{supir_id}/{ktp|sim|stnk}.{ext}
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dokumen-supir',
  'dokumen-supir',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Dokumen Supir: Admin mengunggah dokumen" ON storage.objects;
CREATE POLICY "Dokumen Supir: Admin mengunggah dokumen"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-supir'
    AND dapatkan_peran_pengguna(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Dokumen Supir: Siapa saja dapat melihat (public-read)" ON storage.objects;
CREATE POLICY "Dokumen Supir: Siapa saja dapat melihat (public-read)"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'dokumen-supir');

DROP POLICY IF EXISTS "Dokumen Supir: Admin memperbarui dokumen" ON storage.objects;
CREATE POLICY "Dokumen Supir: Admin memperbarui dokumen"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dokumen-supir' AND dapatkan_peran_pengguna(auth.uid()) = 'admin')
  WITH CHECK (bucket_id = 'dokumen-supir' AND dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Dokumen Supir: Admin menghapus dokumen" ON storage.objects;
CREATE POLICY "Dokumen Supir: Admin menghapus dokumen"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dokumen-supir' AND dapatkan_peran_pengguna(auth.uid()) = 'admin');

-- ==========================================
-- MIGRASI: NAIKKAN BATAS UKURAN BUCKET DOKUMEN SUPIR KE 10 MB
-- INSERT ... ON CONFLICT DO NOTHING di atas tidak mengubah bucket yang
-- sudah ada, jadi batas ukuran perlu di-update terpisah lewat UPDATE ini.
-- ==========================================
UPDATE storage.buckets SET file_size_limit = 10485760 WHERE id = 'dokumen-supir';

-- ==========================================
-- MIGRASI: HAPUS KOLOM SKCK SUPIR
-- Dokumen legalitas supir disederhanakan jadi KTP/SIM/STNK saja (lihat
-- migrasi url_ktp di atas) -- kolom SKCK yang lama tidak dipakai lagi.
-- ==========================================
ALTER TABLE supir DROP COLUMN IF EXISTS url_surat_kepolisian;

-- ==========================================
-- MIGRASI: TABEL LAPORAN KENDALA SUPIR (UC-S04)
-- Menyimpan record terstruktur tiap laporan kendala (jenis, deskripsi,
-- waktu, supir pelapor, anak terkait khusus kendala_anak, status tindak
-- lanjut) supaya bisa ditinjau & ditindaklanjuti Admin lewat
-- LaporanKendalaAdmin.vue -- sebelumnya kendala hanya tercatat sebagai baris
-- `notifikasi` tanpa record status yang bisa ditelusuri. Insert hanya
-- terjadi lewat fungsi SECURITY DEFINER laporkan_kendala_perjalanan di
-- bawah, jadi supir tidak diberi kebijakan INSERT langsung ke tabel ini.
-- ==========================================
CREATE TABLE IF NOT EXISTS laporan_kendala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perjalanan_id uuid NOT NULL REFERENCES perjalanan(id) ON DELETE CASCADE,
  supir_id uuid NOT NULL REFERENCES supir(id) ON DELETE CASCADE,
  anak_id uuid REFERENCES anak(id) ON DELETE SET NULL,
  kategori text NOT NULL CHECK (kategori IN ('kendala_perjalanan', 'kendala_anak')),
  deskripsi text NOT NULL,
  status text NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'ditindak', 'selesai')),
  status_perjalanan text,
  dibuat_pada timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE laporan_kendala ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Laporan Kendala: Admin memiliki akses penuh" ON laporan_kendala;
CREATE POLICY "Laporan Kendala: Admin memiliki akses penuh"
  ON laporan_kendala FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin')
  WITH CHECK (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Laporan Kendala: Supir melihat laporan miliknya sendiri" ON laporan_kendala;
CREATE POLICY "Laporan Kendala: Supir melihat laporan miliknya sendiri"
  ON laporan_kendala FOR SELECT TO authenticated
  USING (supir_id = auth.uid());

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

-- ==========================================
-- MIGRASI: FUNGSI LAPOR KENDALA PERJALANAN SUPIR (UC-S04)
-- Supir tidak diizinkan SELECT baris pengguna lain (termasuk admin) lewat
-- RLS biasa, jadi pengiriman notifikasi kendala ke admin + orang tua
-- dibungkus fungsi SECURITY DEFINER (pola sama seperti
-- fungsi_buat_notifikasi_status_perjalanan) supaya bisa membaca daftar
-- admin & memasukkan notifikasi lintas pengguna secara aman terkontrol.
-- Kategori 'kendala_anak' mengirim notifikasi ke admin + HANYA orang tua
-- anak yang dipilih supir lewat dropdown (p_anak_id -- boleh berbeda dari
-- anak_id kartu tugas yang dibuka, karena UI mengizinkan memilih anak lain
-- pada rute yang sama). Kategori 'kendala_perjalanan' mengirim ke admin +
-- SELURUH orang tua anak yang dijadwalkan pada rute supir ini (supir_id +
-- tanggal_perjalanan yang sama) -- bukan seluruh platform, karena kendala
-- kendaraan/rute hanya relevan bagi penumpang di rute yang sama hari itu.
-- ==========================================
CREATE OR REPLACE FUNCTION laporkan_kendala_perjalanan(
  p_perjalanan_id uuid,
  p_kategori text,
  p_catatan text,
  p_anak_id uuid DEFAULT NULL
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

  INSERT INTO laporan_kendala (perjalanan_id, supir_id, anak_id, kategori, deskripsi, status_perjalanan)
  VALUES (
    p_perjalanan_id,
    v_supir_id,
    CASE WHEN p_kategori = 'kendala_anak' THEN v_anak_id ELSE NULL END,
    p_kategori,
    v_pesan,
    v_status_perjalanan
  );

  -- Kirim ke seluruh admin
  FOR v_admin_id IN SELECT id FROM pengguna WHERE peran = 'admin' LOOP
    INSERT INTO notifikasi (id, pengguna_id, judul, pesan, tipe, sudah_dibaca, id_terkait, tipe_terkait, dibuat_pada)
    VALUES (gen_random_uuid(), v_admin_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, NOW());
  END LOOP;

  IF p_kategori = 'kendala_anak' THEN
    IF v_orang_tua_id IS NOT NULL THEN
      INSERT INTO notifikasi (id, pengguna_id, judul, pesan, tipe, sudah_dibaca, id_terkait, tipe_terkait, dibuat_pada)
      VALUES (gen_random_uuid(), v_orang_tua_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, NOW());
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
      VALUES (gen_random_uuid(), v_penerima_id, v_judul, v_pesan, 'perjalanan', false, p_perjalanan_id, p_kategori, NOW());
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- MIGRASI: STATUS KEHADIRAN HARIAN SUPIR (tri-state, UC-S01)
-- Kolom `aktif` yang sudah ada dipakai Admin untuk mengaktifkan/menonaktifkan
-- AKUN supir (Kelola Data Supir) -- artinya berbeda dari status kehadiran
-- harian "siap bertugas" yang diisi supir sendiri tiap hari, jadi dipisah ke
-- kolom baru supaya tidak saling menimpa makna.
-- Status di-reset otomatis jadi 'belum_diisi' tiap pukul 00:00 WIB; reset ini
-- dilakukan secara lazy oleh klien (src/layanan/supirLayanan.ts) saat
-- membaca status, dengan membandingkan status_kehadiran_diperbarui_pada
-- terhadap batas hari berjalan (WIB = UTC+7).
-- ==========================================
ALTER TABLE supir ADD COLUMN IF NOT EXISTS status_kehadiran text NOT NULL DEFAULT 'belum_diisi'
  CHECK (status_kehadiran IN ('belum_diisi', 'siap', 'tidak_siap'));
ALTER TABLE supir ADD COLUMN IF NOT EXISTS status_kehadiran_diperbarui_pada timestamptz DEFAULT NOW() NOT NULL;

-- ==========================================
-- MIGRASI: SUPIR EDIT DOKUMEN LEGALITAS -> VERIFIKASI ULANG ADMIN
-- Kebijakan UPDATE "Supir: Mengubah profil mandiri" yang sudah ada
-- mengizinkan supir mengubah kolom apa pun di baris miliknya sendiri
-- (dipakai untuk edit nama/telepon/kendaraan), termasuk status_verifikasi --
-- itu celah kalau dibiarkan, karena supir bisa saja langsung set kolom itu
-- ke 'terverifikasi' sendiri. Trigger BEFORE UPDATE ini menutup celahnya:
--   - Kalau yang mengubah adalah admin: tidak disentuh sama sekali (admin
--     bebas ubah dokumen/status tanpa verifikasi ulang, sesuai desain).
--   - Kalau bukan admin (yaitu supir sendiri): status_verifikasi SELALU
--     dipaksa balik ke nilai lama, KECUALI salah satu kolom url dokumen
--     (url_ktp/url_sim/url_stnk) berubah -- dalam kondisi itu, otomatis
--     diset ke 'menunggu' supaya masuk antrean verifikasi ulang Admin.
-- ==========================================
CREATE OR REPLACE FUNCTION fungsi_jaga_status_verifikasi_supir()
RETURNS TRIGGER AS $$
BEGIN
  IF dapatkan_peran_pengguna(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  NEW.status_verifikasi := OLD.status_verifikasi;

  IF NEW.url_ktp IS DISTINCT FROM OLD.url_ktp
     OR NEW.url_sim IS DISTINCT FROM OLD.url_sim
     OR NEW.url_stnk IS DISTINCT FROM OLD.url_stnk THEN
    NEW.status_verifikasi := 'menunggu';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_jaga_status_verifikasi_supir ON supir;
CREATE TRIGGER trg_jaga_status_verifikasi_supir
  BEFORE UPDATE ON supir
  FOR EACH ROW
  EXECUTE FUNCTION fungsi_jaga_status_verifikasi_supir();

-- Storage: supir diizinkan mengunggah/mengganti dokumen legalitas miliknya
-- SENDIRI (folder harus == auth.uid()), tapi HANYA kalau status_verifikasi
-- saat ini bukan 'menunggu' -- mencegah supir mengganti dokumen lagi selagi
-- pengajuan sebelumnya masih diperiksa Admin. Kebijakan admin yang sudah ada
-- (INSERT/UPDATE/DELETE admin-only) tetap berlaku terpisah untuk alur admin.
DROP POLICY IF EXISTS "Dokumen Supir: Supir mengunggah dokumen miliknya sendiri" ON storage.objects;
CREATE POLICY "Dokumen Supir: Supir mengunggah dokumen miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM supir WHERE supir.id = auth.uid() AND supir.status_verifikasi != 'menunggu'
    )
  );

DROP POLICY IF EXISTS "Dokumen Supir: Supir memperbarui dokumen miliknya sendiri" ON storage.objects;
CREATE POLICY "Dokumen Supir: Supir memperbarui dokumen miliknya sendiri"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM supir WHERE supir.id = auth.uid() AND supir.status_verifikasi != 'menunggu'
    )
  );

-- ==========================================
-- MIGRASI: TANDAI RUTE PERJALANAN SELESAI (UC-S03, tombol "Tandai Tugas
-- Hari Ini Telah Selesai" di kartu Detail Rute Terhitung)
-- Menyimpan waktu supir menandai satu kelompok rute (sesi + sekolah tujuan
-- pada tanggal berjalan) sebagai selesai. Begitu diisi, baris perjalanan
-- terkait TIDAK BOLEH diubah lagi oleh supir (dijaga trigger di bawah),
-- hanya admin yang masih bisa mengubahnya kalau perlu koreksi data.
-- ==========================================
ALTER TABLE perjalanan ADD COLUMN IF NOT EXISTS diselesaikan_pada timestamptz;

CREATE OR REPLACE FUNCTION fungsi_jaga_penyelesaian_perjalanan()
RETURNS TRIGGER AS $$
BEGIN
  IF dapatkan_peran_pengguna(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Sudah pernah ditandai selesai sebelumnya -> supir tidak boleh mengubah apa pun lagi
  IF OLD.diselesaikan_pada IS NOT NULL THEN
    RAISE EXCEPTION 'Tugas perjalanan ini sudah ditandai selesai dan tidak dapat diubah lagi.';
  END IF;

  -- Baru pertama kali ditandai selesai -> wajib berstatus 'tiba' (Sampai Tujuan)
  IF NEW.diselesaikan_pada IS NOT NULL AND NEW.status != 'tiba' THEN
    RAISE EXCEPTION 'Perjalanan hanya dapat ditandai selesai setelah status "Sampai Tujuan".';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_jaga_penyelesaian_perjalanan ON perjalanan;
CREATE TRIGGER trg_jaga_penyelesaian_perjalanan
  BEFORE UPDATE ON perjalanan
  FOR EACH ROW
  EXECUTE FUNCTION fungsi_jaga_penyelesaian_perjalanan();

-- ==========================================
-- MIGRASI: PENGAJUAN PERUBAHAN JADWAL -- JENIS + ALAMAT BARU (Revisi Panel
-- Pengguna #2). Sebelumnya cuma menangani "jadwal pulang" dengan biaya tetap
-- Rp20.000; sekarang mendukung Jadwal Pergi/Pulang, alamat baru (dengan pin
-- koordinat), dan biaya dihitung dari jarak alamat baru ke sekolah lewat
-- hitung_biaya_perubahan_jadwal() yang sudah ada (Rp15.000 dasar s.d. 3.5km,
-- +Rp4.200/km berikutnya -- lihat pengaturan_tarif).
-- ==========================================
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS jenis_perubahan text NOT NULL DEFAULT 'pulang'
  CHECK (jenis_perubahan IN ('pergi', 'pulang'));
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS alamat_baru text;
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS lintang_baru double precision;
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS bujur_baru double precision;

-- ==========================================
-- MIGRASI: PERIODE TAGIHAN PEMBAYARAN (Revisi Panel Pengguna #7, "Bayar
-- Bulan Berikutnya"). Tanpa kolom ini, tagihan bulan depan yang dibuat hari
-- ini akan ikut kehitung sebagai "tagihan bulan ini" (keduanya dibuat pada
-- bulan kalender yang sama) -- periode_bulan menandai bulan LAYANAN yang
-- ditagih, terpisah dari dibuat_pada (kapan baris dibuat).
-- ==========================================
ALTER TABLE pembayaran ADD COLUMN IF NOT EXISTS periode_bulan date;
UPDATE pembayaran SET periode_bulan = date_trunc('month', dibuat_pada)::date WHERE periode_bulan IS NULL;
CREATE INDEX IF NOT EXISTS idx_pembayaran_periode_bulan ON pembayaran(langganan_id, periode_bulan);

-- ==========================================
-- MIGRASI: AKTIFKAN REPLIKASI REALTIME UNTUK TABEL `perjalanan` (Bug Fix:
-- Update Status Realtime Panel Supir -> Panel Orang Tua). Tanpa baris ini,
-- perubahan status yang disimpan supir (perbaruiStatusPerjalanan di
-- supirLayanan.ts) tersimpan ke database dengan benar, tapi event
-- postgres_changes tidak pernah terkirim ke client manapun -- Supabase hanya
-- mem-broadcast perubahan pada tabel yang eksplisit didaftarkan ke publication
-- `supabase_realtime`. `pantauPerjalananAnakRealtime` (realtimeLayanan.ts)
-- berlangganan tabel ini, jadi tabel wajib terdaftar supaya UPDATE status
-- langsung sampai ke dashboard Orang Tua tanpa refresh/polling.
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'perjalanan'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE perjalanan;
  END IF;
END $$;

-- ==========================================
-- MIGRASI: TABEL `hari_libur` (Revisi: Hari Efektif Otomatis + Kelola Jadwal
-- Admin). Sebelumnya hari efektif sekolah hanya dihitung dari pola hari
-- (Senin..Minggu) tanpa pernah mengurangi hari libur nasional/cuti
-- bersama/libur sekolah -- tabel ini jadi referensi admin ("Kelola Jadwal")
-- yang dibaca hitungJumlahHariAktifBulanIni()/buatKalenderBulanIni()
-- (src/bantuan/kalenderJadwal.ts) untuk mengecualikan tanggal libur dari
-- hari efektif & estimasi biaya langganan. `sekolah_id` NULL berarti libur
-- berlaku untuk semua sekolah (nasional/cuti bersama); diisi untuk libur
-- yang spesifik satu sekolah saja.
-- ==========================================
CREATE TABLE IF NOT EXISTS hari_libur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  nama text NOT NULL,
  jenis text NOT NULL CHECK (jenis IN ('nasional', 'cuti_bersama', 'libur_sekolah', 'khusus')),
  sekolah_id uuid REFERENCES sekolah(id) ON DELETE CASCADE,
  keterangan text,
  dibuat_oleh uuid REFERENCES pengguna(id),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tanggal, sekolah_id)
);

-- ==========================================
-- MIGRASI: SUMBER HARI LIBUR (API vs MANUAL)
-- Membedakan baris yang disinkronkan otomatis dari API kalender eksternal
-- (Edge Function sinkron-hari-libur, lihat supabase/functions/) dari baris
-- yang ditambahkan Admin sendiri (libur sekolah tambahan, kegiatan sekolah,
-- cuti bersama internal) -- supaya sinkronisasi ulang TIDAK PERNAH menimpa
-- entri manual Admin yang kebetulan jatuh di tanggal yang sama.
-- ==========================================
ALTER TABLE hari_libur ADD COLUMN IF NOT EXISTS sumber text NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'api'));

CREATE INDEX IF NOT EXISTS idx_hari_libur_tanggal ON hari_libur(tanggal);

ALTER TABLE hari_libur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hari Libur: Pengguna terautentikasi dapat membaca" ON hari_libur;
CREATE POLICY "Hari Libur: Pengguna terautentikasi dapat membaca"
  ON hari_libur FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Hari Libur: Admin memiliki akses penuh" ON hari_libur;
CREATE POLICY "Hari Libur: Admin memiliki akses penuh"
  ON hari_libur FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin')
  WITH CHECK (dapatkan_peran_pengguna(auth.uid()) = 'admin');

-- ==========================================
-- MIGRASI: PERIODE ABSENSI SUPIR (Revisi Sistem Absensi Harian Supir).
-- Sebelumnya status_kehadiran di-reset lazy berdasarkan tanggal KALENDER
-- (WIB) tempat status_kehadiran_diperbarui_pada jatuh, reset tiap 00:00 WIB.
-- Sekarang absensi menargetkan satu TANGGAL LAYANAN tertentu ("tanggal
-- aktif absensi", lihat hitungTanggalAktifAbsensi() di
-- src/bantuan/periodeAbsensi.ts) yang baru berpindah ke tanggal berikutnya
-- setelah lewat pukul 17:00 WIB pada tanggal itu sendiri -- bukan lagi
-- tengah malam. Kolom ini menyimpan tanggal target yang diwakili oleh nilai
-- status_kehadiran yang sedang tersimpan, supaya sistem bisa membedakan
-- "diisi untuk periode tanggal X" dari "diisi untuk periode tanggal Y"
-- kapan pun dalam rentang periode (bukan cuma di titik cutoff-nya).
-- status_kehadiran_diperbarui_pada tetap dipertahankan sebagai info
-- tampilan "Waktu Pengisian" saja, tidak lagi dipakai untuk logika reset.
-- ==========================================
ALTER TABLE supir ADD COLUMN IF NOT EXISTS status_kehadiran_untuk_tanggal date NOT NULL DEFAULT CURRENT_DATE;

-- ==========================================
-- MIGRASI: ORANG TUA DAPAT MEMBACA PROFIL SUPIR YANG DITUGASKAN (Bug Fix:
-- "Supir Bertugas: Belum ditugaskan" padahal admin sudah menugaskan supir).
-- Kebijakan "Pengguna: Melihat data profil mandiri" (baris ~544) hanya
-- mengizinkan SELECT utk baris milik sendiri (id = auth.uid()), jadi saat
-- orang tua join tabel `pengguna` utk mengambil nama/nomor telepon supir
-- (lengkapiNamaSupir() di src/layanan/orangTuaLayanan.ts, dipakai
-- DetailAnak.vue), RLS diam-diam menyaring hasilnya jadi kosong walau
-- kolom perjalanan.supir_id sudah benar terisi -- bukan bug di kode
-- JS/TS, murni RLS yang belum mengizinkan pembacaan lintas peran ini.
-- ==========================================
DROP POLICY IF EXISTS "Pengguna: Orang tua melihat profil supir yang ditugaskan" ON pengguna;
CREATE POLICY "Pengguna: Orang tua melihat profil supir yang ditugaskan"
  ON pengguna FOR SELECT TO authenticated
  USING (
    peran = 'supir' AND EXISTS (
      SELECT 1 FROM perjalanan
      JOIN anak ON anak.id = perjalanan.anak_id
      WHERE perjalanan.supir_id = pengguna.id
        AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: RENTANG TANGGAL KERJA SUPIR SEMENTARA (Penambahan akun supir
-- sementara). Admin sekarang mengatur "Tanggal Mulai Bekerja" (wajib) dan
-- "Tanggal Selesai Bekerja" (opsional) saat mendaftarkan/mengubah supir
-- bertipe 'sementara' -- kalau tanggal selesai tidak diisi, sistem
-- menyamakannya dengan tanggal mulai (akun hanya aktif 1 hari). Kedua kolom
-- NULL untuk supir 'tetap' (tidak berlaku rentang kerja). Enforcement
-- otomatis (nonaktifkan begitu tanggal_selesai_kerja terlewati) dilakukan
-- lazy dari klien -- lihat nonaktifkanSupirSementaraKedaluwarsa() di
-- src/layanan/adminLayanan.ts, dipanggil setiap ambilDaftarSupir()/
-- ambilSupirTersedia() -- konsisten dengan pola lazy-reset periode absensi
-- yang sudah dipakai di kolom status_kehadiran_untuk_tanggal di atas.
-- ==========================================
ALTER TABLE supir ADD COLUMN IF NOT EXISTS tanggal_mulai_kerja date;
ALTER TABLE supir ADD COLUMN IF NOT EXISTS tanggal_selesai_kerja date;

-- ==========================================
-- MIGRASI: AKTIFKAN REPLIKASI REALTIME UNTUK TABEL `pembayaran` (Laporan
-- Keuangan berbasis aktivitas real-time). Sama seperti migrasi realtime
-- `perjalanan` di atas -- tanpa tabel ini terdaftar ke publication
-- `supabase_realtime`, event postgres_changes dari INSERT/UPDATE
-- `pembayaran` tidak pernah terkirim ke client manapun, sehingga
-- pantauPembayaranRealtime() (realtimeLayanan.ts) yang dipakai
-- LaporanAdmin.vue tidak akan menerima aktivitas baru tanpa refresh manual.
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pembayaran'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pembayaran;
  END IF;
END $$;

-- ==========================================
-- MIGRASI: ORANG TUA DAPAT MENGUBAH & MENGHAPUS PENGAJUAN CUTI SENDIRI
-- (Pengelolaan pengajuan cuti/libur oleh pengguna). Sebelumnya orang tua
-- hanya punya kebijakan INSERT + SELECT pada pengajuan_cuti (lihat baris
-- ~990), jadi fitur Edit/Hapus di JadwalOrangTua.vue (perbaruiCuti/hapusCuti
-- di orangTuaLayanan.ts) akan ditolak RLS tanpa dua kebijakan baru ini.
-- Dibatasi ketat: hanya baris milik anak sendiri (lewat anak.orang_tua_id).
-- ==========================================
DROP POLICY IF EXISTS "Pengajuan Cuti: Orang tua mengubah pengajuan cuti anaknya" ON pengajuan_cuti;
CREATE POLICY "Pengajuan Cuti: Orang tua mengubah pengajuan cuti anaknya"
  ON pengajuan_cuti FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_cuti.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_cuti.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pengajuan Cuti: Orang tua menghapus pengajuan cuti anaknya" ON pengajuan_cuti;
CREATE POLICY "Pengajuan Cuti: Orang tua menghapus pengajuan cuti anaknya"
  ON pengajuan_cuti FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_cuti.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: ORANG TUA DAPAT MEMBATALKAN PERJALANAN ANAKNYA KARENA CUTI.
-- Dipakai oleh batalkanPerjalananDalamRentangCuti() (orangTuaLayanan.ts) --
-- begitu orang tua mengajukan/mengubah cuti utk rentang tanggal yang
-- ternyata SUDAH punya penugasan (baris `perjalanan` berstatus
-- 'dijadwalkan') dari Admin, baris itu langsung ditandai 'dibatalkan' agar
-- anak benar-benar tidak masuk daftar jemputan supir pada tanggal cuti.
-- Kebijakan ini SENGAJA sempit: hanya boleh mengubah baris milik anak
-- sendiri, HANYA dari status 'dijadwalkan', dan HANYA menjadi 'dibatalkan'
-- -- tidak membuka celah orang tua mengubah status perjalanan lain
-- (mis. menandai 'tiba' secara curang).
-- ==========================================
DROP POLICY IF EXISTS "Perjalanan: Orang tua membatalkan perjalanan anaknya karena cuti" ON perjalanan;
CREATE POLICY "Perjalanan: Orang tua membatalkan perjalanan anaknya karena cuti"
  ON perjalanan FOR UPDATE TO authenticated
  USING (
    status = 'dijadwalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'dibatalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: MASTER KELAS PER SEKOLAH (Tambah Data Sekolah)
-- Sebelumnya "Kelas" pada form anak (wizard berlangganan & edit profil anak)
-- adalah teks bebas / daftar statis generik ("Kelas 1".."Kelas 12"), tidak
-- terhubung ke sekolah manapun. Tabel ini menyimpan daftar kelas yang
-- didaftarkan Admin per sekolah (mis. "7A", "7B", "Kelas 3 Unggulan") --
-- kelas_sekolah.nama_kelas TETAP disalin sebagai teks bebas ke anak.kelas
-- saat dipilih (tidak diubah jadi FK), supaya data anak lama & fitur yang
-- sudah membaca anak.kelas sebagai string tidak perlu migrasi ulang. Dibaca
-- oleh ambilDaftarSekolah() (berlangganganLayanan.ts) yang menyertakan
-- kelasTersedia per sekolah, dipakai HalamanBerlangganan.vue &
-- HalamanEditProfil.vue untuk mengisi dropdown kelas sesuai sekolah yang
-- dipilih.
-- ==========================================
CREATE TABLE IF NOT EXISTS kelas_sekolah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sekolah_id uuid NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
  nama_kelas text NOT NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (sekolah_id, nama_kelas)
);

ALTER TABLE kelas_sekolah ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kelas Sekolah: Admin memiliki akses penuh" ON kelas_sekolah;
CREATE POLICY "Kelas Sekolah: Admin memiliki akses penuh"
  ON kelas_sekolah FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Kelas Sekolah: Seluruh pengguna terautentikasi dapat melihat daftar kelas" ON kelas_sekolah;
CREATE POLICY "Kelas Sekolah: Seluruh pengguna terautentikasi dapat melihat daftar kelas"
  ON kelas_sekolah FOR SELECT TO authenticated
  USING (true);

-- ==========================================
-- MIGRASI: NOTIFIKASI LINTAS PERAN GENERIK (Admin<->Orang Tua<->Supir)
-- Sebelumnya HANYA dua jalur yang bisa mengirim notifikasi lintas pengguna:
-- trigger status perjalanan (fungsi_buat_notifikasi_status_perjalanan, supir
-- -> orang tua) dan laporkan_kendala_perjalanan (supir -> admin/orang tua).
-- Tabel notifikasi TIDAK punya kebijakan INSERT untuk peran non-admin sama
-- sekali (lihat "Kebijakan K: Tabel Notifikasi") -- klien Orang Tua/Supir
-- yang mencoba INSERT langsung akan selalu ditolak RLS. Dua fungsi
-- SECURITY DEFINER berikut membuka jalur terkontrol yang sama seperti
-- laporkan_kendala_perjalanan, dipakai src/layanan/notifikasiLayanan.ts
-- (kirimNotifikasi/kirimNotifikasiKeAdmin) supaya alur lintas peran lain
-- (persetujuan penundaan pembayaran, penugasan/pembatalan rute, tindak
-- lanjut laporan kendala, verifikasi akun supir, pengajuan perubahan
-- jadwal/cuti dari orang tua) juga bisa mengirim notifikasi in-app tanpa
-- masing-masing perlu kebijakan INSERT terpisah per skenario.
-- ==========================================
CREATE OR REPLACE FUNCTION buat_notifikasi(
  p_pengguna_id uuid,
  p_judul text,
  p_pesan text,
  p_tipe text,
  p_id_terkait uuid DEFAULT NULL,
  p_tipe_terkait text DEFAULT NULL
) RETURNS void AS $$
  INSERT INTO notifikasi (pengguna_id, judul, pesan, tipe, id_terkait, tipe_terkait)
  VALUES (p_pengguna_id, p_judul, p_pesan, p_tipe, p_id_terkait, p_tipe_terkait);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Dipakai saat pengirim (mis. Orang Tua) tidak diizinkan RLS mengetahui id
-- akun Admin sama sekali -- loop di sisi server (mirip blok "Kirim ke
-- seluruh admin" pada laporkan_kendala_perjalanan) menghindari perlunya
-- Orang Tua/Supir SELECT tabel pengguna milik peran lain.
CREATE OR REPLACE FUNCTION notifikasi_ke_semua_admin(
  p_judul text,
  p_pesan text,
  p_tipe text,
  p_id_terkait uuid DEFAULT NULL,
  p_tipe_terkait text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  FOR v_admin_id IN SELECT id FROM pengguna WHERE peran = 'admin' LOOP
    INSERT INTO notifikasi (pengguna_id, judul, pesan, tipe, id_terkait, tipe_terkait)
    VALUES (v_admin_id, p_judul, p_pesan, p_tipe, p_id_terkait, p_tipe_terkait);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- MIGRASI: RIWAYAT PERUBAHAN JADWAL MINGGUAN (batas 2x/minggu)
-- Sebelumnya tabel jadwal_mingguan cuma menyimpan STATE TERKINI (satu baris
-- per anak, di-upsert setiap kali disimpan) -- tidak ada jejak riwayat sama
-- sekali, sehingga tidak mungkin menghitung "berapa kali pengguna sudah
-- mengubah jadwal minggu ini" untuk menegakkan batas 2x/minggu. Tabel ini
-- mencatat SATU baris per event "Simpan Perubahan Jadwal" yang berhasil
-- (bukan per checkbox yang diklik -- checkbox murni draft lokal di
-- JadwalOrangTua.vue, tidak pernah membuat baris di sini sampai tombol
-- Simpan ditekan). Dipakai src/layanan/orangTuaLayanan.ts
-- (ubahJadwalMingguan/ambilKuotaPerubahanJadwal/ambilRiwayatPerubahanJadwalMingguan).
-- ==========================================
CREATE TABLE IF NOT EXISTS riwayat_perubahan_jadwal_mingguan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anak_id uuid NOT NULL REFERENCES anak(id) ON DELETE CASCADE,
  jadwal_sebelum jsonb NOT NULL,
  jadwal_sesudah jsonb NOT NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riwayat_jadwal_mingguan_anak ON riwayat_perubahan_jadwal_mingguan(anak_id, dibuat_pada);

ALTER TABLE riwayat_perubahan_jadwal_mingguan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riwayat Jadwal Mingguan: Admin memiliki akses penuh" ON riwayat_perubahan_jadwal_mingguan;
CREATE POLICY "Riwayat Jadwal Mingguan: Admin memiliki akses penuh"
  ON riwayat_perubahan_jadwal_mingguan FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Riwayat Jadwal Mingguan: Orang tua melihat riwayat anaknya" ON riwayat_perubahan_jadwal_mingguan;
CREATE POLICY "Riwayat Jadwal Mingguan: Orang tua melihat riwayat anaknya"
  ON riwayat_perubahan_jadwal_mingguan FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anak WHERE anak.id = riwayat_perubahan_jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Riwayat Jadwal Mingguan: Orang tua mencatat perubahan jadwal anaknya" ON riwayat_perubahan_jadwal_mingguan;
CREATE POLICY "Riwayat Jadwal Mingguan: Orang tua mencatat perubahan jadwal anaknya"
  ON riwayat_perubahan_jadwal_mingguan FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anak WHERE anak.id = riwayat_perubahan_jadwal_mingguan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: PENGAJUAN PERUBAHAN JADWAL PAKAI TANGGAL SPESIFIK
-- Sebelumnya kolom `hari` hanya menyimpan nama hari (mis. "Senin") tanpa
-- tanggal kalender -- pengguna tidak bisa menentukan MINGGU mana perubahan
-- itu berlaku. Kolom baru `tanggal` (date) menggantikan peran itu; `hari`
-- dibiarkan ada (nullable) supaya baris lama yang sudah tersimpan sebelum
-- migrasi ini tidak perlu dihapus/diubah. Aman dijalankan berulang kali.
-- ==========================================
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS tanggal date;
ALTER TABLE pengajuan_perubahan_jadwal ALTER COLUMN hari DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pengajuan_perubahan_jadwal_tanggal ON pengajuan_perubahan_jadwal(anak_id, tanggal);

-- ==========================================
-- MIGRASI: SINKRONISASI PERJALANAN SAAT PENGAJUAN PERUBAHAN JADWAL
-- ajukanPerubahanJadwal() (orangTuaLayanan.ts) sekarang otomatis: (1)
-- membatalkan baris `perjalanan` LAMA yang tergantikan (status ->
-- 'dibatalkan', policy UPDATE utk orang tua sudah ada sejak migrasi "Orang
-- tua membatalkan perjalanan anaknya karena cuti"), dan (2) memperbarui
-- kolom `catatan` pada baris `perjalanan` di tanggal BARU kalau Admin
-- kebetulan sudah membuatnya lebih dulu -- kasus (2) ini TIDAK mengubah
-- status (tetap 'dijadwalkan'), jadi butuh policy UPDATE terpisah karena
-- policy yang sudah ada mensyaratkan status berubah jadi 'dibatalkan'.
-- Kebijakan ini SENGAJA sempit: hanya baris milik anak sendiri, HANYA yang
-- masih 'dijadwalkan', dan HASILNYA WAJIB tetap 'dijadwalkan' (tidak boleh
-- dipakai utk menyelinapkan perubahan status lain).
-- ==========================================
DROP POLICY IF EXISTS "Perjalanan: Orang tua memperbarui catatan perjalanan anaknya" ON perjalanan;
CREATE POLICY "Perjalanan: Orang tua memperbarui catatan perjalanan anaknya"
  ON perjalanan FOR UPDATE TO authenticated
  USING (
    status = 'dijadwalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'dijadwalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: PENGAJUAN PERUBAHAN JADWAL DIGERBANG PEMBAYARAN
-- ajukanPerubahanJadwal() (orangTuaLayanan.ts) sekarang menyimpan pengajuan
-- dgn status 'menunggu' dulu kalau ada biaya tambahan (menunggu gerbang
-- pembayaran simulasi Midtrans Snap), baru diubah ke 'disetujui' oleh
-- konfirmasiPembayaranPerubahanJadwal() setelah pembayaran lunas -- butuh
-- policy UPDATE baru krn sebelumnya orang tua cuma bisa INSERT+SELECT.
-- Kebijakan ini SENGAJA sempit: hanya baris milik anak sendiri, HANYA dari
-- status 'menunggu', dan HASILNYA HARUS TETAP 'menunggu' (mis. menempelkan
-- pembayaran_id, atau mengedit tanggal/jam/alamat sebelum dibayar -- lihat
-- perbaruiPengajuanPerubahanJadwal()) ATAU berubah jadi 'disetujui' (setelah
-- pembayaran lunas). Tidak membuka celah mengubah ke status lain.
-- ==========================================
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS pembayaran_id uuid REFERENCES pembayaran(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua menandai pengajuannya berlaku" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Orang tua menandai pengajuannya berlaku"
  ON pengajuan_perubahan_jadwal FOR UPDATE TO authenticated
  USING (
    status = 'menunggu' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('menunggu', 'disetujui') AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Hapus HANYA diizinkan selagi masih 'menunggu' (belum dibayar/belum
-- berlaku) -- begitu 'disetujui' (sudah disinkronkan ke jadwal supir &
-- Admin diberi tahu), pengajuan tidak boleh dihapus lagi lewat sini.
DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua menghapus pengajuan yang belum berlaku" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Orang tua menghapus pengajuan yang belum berlaku"
  ON pengajuan_perubahan_jadwal FOR DELETE TO authenticated
  USING (
    status = 'menunggu' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: EDIT/BATALKAN PENGAJUAN PERUBAHAN JADWAL YANG SUDAH BERLAKU
-- Sebelumnya begitu pengajuan berstatus 'disetujui' (sudah disinkronkan ke
-- jadwal supir & Admin diberi tahu), orang tua sama sekali tidak bisa lagi
-- mengedit/membatalkannya. Sekarang diizinkan SELAMA jadwalnya belum masuk
-- periode operasional & belum benar-benar dijalankan supir (divalidasi di
-- kode -- editPengajuanPerubahanJadwalAktif()/batalkanPengajuanPerubahanJadwalAktif()
-- di orangTuaLayanan.ts). Kolom baru menyimpan baris `perjalanan` mana yang
-- terdampak sinkronisasi (dibatalkan / diperbarui catatannya) supaya
-- edit/pembatalan bisa melakukan ROLLBACK yang presisi -- mengembalikan
-- jadwal anak ke kondisi semula -- alih-alih menebak lewat teks catatan.
-- ==========================================
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS perjalanan_lama_id uuid REFERENCES perjalanan(id) ON DELETE SET NULL;
ALTER TABLE pengajuan_perubahan_jadwal ADD COLUMN IF NOT EXISTS perjalanan_baru_id uuid REFERENCES perjalanan(id) ON DELETE SET NULL;

-- Perluas kebijakan UPDATE yang sudah ada: sebelumnya HANYA transisi status
-- 'menunggu' -> ('menunggu'|'disetujui'). Sekarang orang tua juga boleh
-- mengubah baris yang SUDAH 'disetujui' (edit detail, status tetap
-- 'disetujui') ATAU membatalkannya (status -> 'ditolak', dipakai sbg
-- "dibatalkan" -- baris TETAP ada sbg jejak riwayat, tidak dihapus).
DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua menandai pengajuannya berlaku" ON pengajuan_perubahan_jadwal;
DROP POLICY IF EXISTS "Pengajuan Perubahan Jadwal: Orang tua mengelola pengajuannya" ON pengajuan_perubahan_jadwal;
CREATE POLICY "Pengajuan Perubahan Jadwal: Orang tua mengelola pengajuannya"
  ON pengajuan_perubahan_jadwal FOR UPDATE TO authenticated
  USING (
    status IN ('menunggu', 'disetujui') AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('menunggu', 'disetujui', 'ditolak') AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = pengajuan_perubahan_jadwal.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- Rollback perlu mengembalikan baris `perjalanan` yang sempat dibatalkan
-- otomatis (status 'dibatalkan') balik ke 'dijadwalkan' -- kebalikan dari
-- kebijakan "Orang tua membatalkan perjalanan anaknya karena cuti" yang
-- sudah ada (yang hanya mengizinkan arah dijadwalkan->dibatalkan).
DROP POLICY IF EXISTS "Perjalanan: Orang tua memulihkan perjalanan anaknya yang dibatalkan" ON perjalanan;
CREATE POLICY "Perjalanan: Orang tua memulihkan perjalanan anaknya yang dibatalkan"
  ON perjalanan FOR UPDATE TO authenticated
  USING (
    status = 'dibatalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'dijadwalkan' AND EXISTS (
      SELECT 1 FROM anak WHERE anak.id = perjalanan.anak_id AND anak.orang_tua_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: BUKTI FILE (OPSIONAL) PADA PENGAJUAN PENUNDAAN PEMBAYARAN
-- Kolom baru menyimpan URL publik file bukti (mis. screenshot mutasi/slip
-- gaji) yang diunggah orang tua saat mengajukan penundaan pembayaran --
-- SEPENUHNYA OPSIONAL, pengajuan tetap bisa dikirim tanpa lampiran (lihat
-- ajukanPenundaanPembayaran() di orangTuaLayanan.ts).
-- ==========================================
ALTER TABLE penundaan_pembayaran ADD COLUMN IF NOT EXISTS bukti_url text;

-- ==========================================
-- STORAGE: BUCKET BUKTI PENUNDAAN PEMBAYARAN
-- Jalankan bagian ini secara manual di Supabase SQL Editor.
-- Public-read (konsisten dgn pola bucket lain di proyek ini) supaya Admin
-- bisa membuka link buktinya langsung dari panel Persetujuan Penundaan --
-- tapi HANYA orang tua pemilik akun yang boleh mengunggah, ke folder milik
-- auth.uid()-nya sendiri. Struktur path objek: bukti-penundaan/{orang_tua_id}/{nama_file}
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bukti-penundaan',
  'bukti-penundaan',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Bukti Penundaan: Orang tua mengunggah bukti miliknya sendiri" ON storage.objects;
CREATE POLICY "Bukti Penundaan: Orang tua mengunggah bukti miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bukti-penundaan'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Bukti Penundaan: Siapa saja dapat melihat (public-read)" ON storage.objects;
CREATE POLICY "Bukti Penundaan: Siapa saja dapat melihat (public-read)"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'bukti-penundaan');

-- ==========================================
-- MIGRASI: Daftarkan tabel `supir` ke publication `supabase_realtime` (Fitur
-- Live Tracking GPS Supir). Sama seperti catatan di atas soal `perjalanan` --
-- pantauSupirRealtime() di src/layanan/realtimeLayanan.ts berlangganan
-- perubahan kolom lintang_terkini/bujur_terkini pada tabel ini, tapi tanpa
-- didaftarkan ke publication, event UPDATE-nya tidak pernah ter-broadcast ke
-- client manapun walau baris di database benar-benar berubah.
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'supir'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE supir;
  END IF;
END $$;

-- ==========================================
-- STORAGE: BUCKET FOTO ANAK (opsional, diisi orang tua saat tambah/edit
-- data anak). Pola sama seperti bucket profile-images di atas
-- (public-read, hanya pemilik yang boleh unggah/ubah/hapus) -- BEDANYA
-- folder root tetap `{orang_tua_id}` (BUKAN anak_id), karena anak tidak
-- punya akun auth sendiri untuk dicocokkan dengan auth.uid().
-- Struktur path objek: foto-anak/{orang_tua_id}/{anak_id}.jpg
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'foto-anak',
  'foto-anak',
  true,
  2097152, -- 2 MB, selaras dengan validasi ukuran di frontend
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Foto Anak: Orang tua mengunggah foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua mengunggah foto anak miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Anak: Siapa saja dapat melihat (public-read)" ON storage.objects;
CREATE POLICY "Foto Anak: Siapa saja dapat melihat (public-read)"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'foto-anak');

DROP POLICY IF EXISTS "Foto Anak: Orang tua memperbarui foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua memperbarui foto anak miliknya sendiri"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Anak: Orang tua menghapus foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua menghapus foto anak miliknya sendiri"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- MIGRASI: HAPUS UNIQUE constraint pada pembayaran.id_pesanan_midtrans
-- (Fitur Pembayaran Gabungan Multi-Anak). Sebelumnya tiap anak WAJIB punya
-- order_id Midtrans sendiri-sendiri (1 transaksi Snap per anak, harus bayar
-- satu-satu) -- sekarang checkout/renewal 2+ anak sekaligus menaruh order_id
-- yang SAMA di beberapa baris `pembayaran` supaya bisa dilunasi via SATU
-- transaksi Snap untuk totalnya. midtrans-webhook & buat-transaksi-midtrans
-- (Edge Functions) sudah diperbarui untuk menangani banyak baris per
-- order_id -- index pencariannya (idx_pembayaran_midtrans) tetap dipakai,
-- cuma tidak lagi unik.
-- ==========================================
ALTER TABLE pembayaran DROP CONSTRAINT IF EXISTS pembayaran_id_pesanan_midtrans_key;

-- ==========================================
-- MIGRASI: PENYEMPURNAAN KELOLA LAPORAN -- CATATAN ADMIN & RIWAYAT
-- PERUBAHAN LAPORAN KENDALA
-- Sebelumnya perbaruiStatusLaporanKendala() (adminLayanan.ts) hanya
-- menimpa kolom `status` begitu saja -- tidak ada jejak SIAPA yang
-- mengubah, KAPAN, dan APA catatan penyelesaiannya, sehingga Admin lain
-- (atau Admin yang sama di lain waktu) tidak bisa menelusuri riwayat
-- penanganan sebuah laporan kendala. Migrasi ini menambah:
-- 1. Kolom `catatan_admin` & `diperbarui_pada` pada laporan_kendala itu
--    sendiri (mencerminkan catatan & waktu perubahan status TERAKHIR).
-- 2. Tabel `riwayat_laporan_kendala` yang mencatat SETIAP transisi status
--    (status sebelum -> sesudah, catatan admin saat itu, siapa &
--    kapan) sebagai log lengkap -- baris lama tidak pernah ditimpa/dihapus.
-- ==========================================
ALTER TABLE laporan_kendala ADD COLUMN IF NOT EXISTS catatan_admin text;
ALTER TABLE laporan_kendala ADD COLUMN IF NOT EXISTS diperbarui_pada timestamptz;

CREATE TABLE IF NOT EXISTS riwayat_laporan_kendala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id uuid NOT NULL REFERENCES laporan_kendala(id) ON DELETE CASCADE,
  status_sebelum text,
  status_sesudah text NOT NULL,
  catatan text,
  diubah_oleh uuid REFERENCES pengguna(id) ON DELETE SET NULL,
  nama_pengubah text,
  dibuat_pada timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riwayat_laporan_kendala_laporan ON riwayat_laporan_kendala(laporan_id, dibuat_pada);

ALTER TABLE riwayat_laporan_kendala ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riwayat Laporan Kendala: Admin memiliki akses penuh" ON riwayat_laporan_kendala;
CREATE POLICY "Riwayat Laporan Kendala: Admin memiliki akses penuh"
  ON riwayat_laporan_kendala FOR ALL TO authenticated
  USING (dapatkan_peran_pengguna(auth.uid()) = 'admin');

-- Supir boleh melihat riwayat penanganan laporan miliknya sendiri (transparansi
-- tindak lanjut), tapi tidak boleh mengubah/menghapusnya.
DROP POLICY IF EXISTS "Riwayat Laporan Kendala: Supir melihat riwayat laporannya sendiri" ON riwayat_laporan_kendala;
CREATE POLICY "Riwayat Laporan Kendala: Supir melihat riwayat laporannya sendiri"
  ON riwayat_laporan_kendala FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM laporan_kendala
      WHERE laporan_kendala.id = riwayat_laporan_kendala.laporan_id
        AND laporan_kendala.supir_id = auth.uid()
    )
  );

-- Realtime: begitu Admin lain mengubah status laporan kendala, daftar di
-- LaporanAdmin.vue ikut ter-update tanpa perlu reload manual -- pola yang
-- sama seperti pembayaran/perjalanan/supir di atas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'laporan_kendala'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE laporan_kendala;
  END IF;
END $$;

-- ==========================================
-- MIGRASI: AKUN SUPIR BARU DEFAULT AKTIF
-- Kolom `aktif` pada tabel `supir` (lihat CREATE TABLE supir di atas) semula
-- DEFAULT false -- cocok untuk alur pendaftaran mandiri yang butuh
-- verifikasi admin dulu sebelum akun boleh dipakai, tapi TIDAK cocok untuk
-- akun yang dibuat LANGSUNG oleh admin lewat form "Tambah Supir"
-- (DataSupirAdmin.vue -> buatAkunSupir() -> Edge Function
-- "buat-akun-supir"): admin sudah memverifikasi data itu sendiri saat
-- mengisi formulir, jadi seharusnya akun langsung aktif tanpa perlu
-- langkah tambahan "aktifkan" manual di popup Edit Supir setelahnya.
-- Edge Function di atas sudah diperbarui untuk menyetel `aktif: true`
-- eksplisit saat membuat akun (perlu di-deploy ulang manual lewat Supabase
-- Dashboard -> Edge Functions), migrasi ini SEKALIGUS mengubah DEFAULT
-- kolomnya supaya konsisten kalau suatu saat ada jalur insert lain yang
-- tidak menyetelnya secara eksplisit. TIDAK mengubah data akun supir yang
-- SUDAH ADA -- ini murni default untuk baris BARU ke depannya.
-- ==========================================
ALTER TABLE supir ALTER COLUMN aktif SET DEFAULT true;

-- ==========================================
-- MIGRASI: SUPIR BOLEH GANTI DOKUMEN LEGALITAS KAPAN SAJA (bukan cuma saat
-- status_verifikasi != 'menunggu')
-- Kebijakan storage sebelumnya (lihat "Dokumen Supir: Supir mengunggah/
-- memperbarui dokumen miliknya sendiri" di atas) SENGAJA memblokir supir
-- mengunggah dokumen baru selagi status masih 'menunggu' (pengajuan
-- sebelumnya belum diputuskan Admin) -- ternyata ini bikin pengalaman
-- ambigu: badge status tetap terlihat "Terverifikasi" (nilai LAMA sebelum
-- percobaan ganti dokumen), tapi upload-nya ditolak dengan pesan seolah
-- status SUDAH 'menunggu' -- membingungkan karena dua sinyal itu terasa
-- kontradiktif dari sisi supir. Sekarang supir boleh mengganti dokumen
-- kapan saja (tetap wajib folder miliknya sendiri) -- trigger
-- trg_jaga_status_verifikasi_supir tetap otomatis memindahkan status ke
-- 'menunggu' setiap kali salah satu url dokumen berubah, jadi riwayat
-- pengajuan Admin tetap tercatat lengkap tanpa perlu mengunci ulang akses
-- ganti dokumen.
-- ==========================================
DROP POLICY IF EXISTS "Dokumen Supir: Supir mengunggah dokumen miliknya sendiri" ON storage.objects;
CREATE POLICY "Dokumen Supir: Supir mengunggah dokumen miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Dokumen Supir: Supir memperbarui dokumen miliknya sendiri" ON storage.objects;
CREATE POLICY "Dokumen Supir: Supir memperbarui dokumen miliknya sendiri"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'dokumen-supir'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- MIGRASI: SATU JADWAL HANYA BOLEH PUNYA SATU PENGAJUAN PERUBAHAN AKTIF
-- Sebelumnya tidak ada pembatasan sama sekali di database -- orang tua yang
-- mengulang klik "Ajukan Perubahan" (mis. gerbang pembayaran Midtrans
-- terasa lambat) bisa membuat banyak baris pengajuan_perubahan_jadwal
-- duplikat untuk (anak, tanggal, jenis_perubahan) yang SAMA PERSIS,
-- membanjiri "Riwayat Pengajuan Perubahan" dengan entri "Dibatalkan"
-- berulang. Pengecekan di ajukanPerubahanJadwal() (orangTuaLayanan.ts)
-- sudah mencegah ini dari sisi aplikasi, unique index PARSIAL ini jadi
-- lapisan pertahanan terakhir di database (mis. kalau ada race condition
-- klik ganda yang lolos dari pengecekan client) -- hanya berlaku utk baris
-- berstatus 'menunggu'/'disetujui' (BUKAN 'ditolak', supaya pengajuan lama
-- yang sudah dibatalkan/ditolak tidak menghalangi pengajuan baru untuk
-- jadwal yang sama).
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_pengajuan_perubahan_jadwal_satu_aktif
  ON pengajuan_perubahan_jadwal (anak_id, tanggal, jenis_perubahan)
  WHERE status IN ('menunggu', 'disetujui');

-- ==========================================
-- MIGRASI: SUPIR MENANDAI SENDIRI STATUS LAPORAN KENDALA MILIKNYA
-- Sebelumnya hanya Admin yang bisa mengubah status laporan_kendala
-- ('baru' -> 'ditindak' -> 'selesai') lewat LaporanAdmin.vue. Sesuai
-- keputusan produk: yang benar-benar tahu kapan kendalanya sudah
-- ditindaklanjuti/selesai adalah SUPIR pelapor sendiri (mis. ban bocor
-- sudah diganti), bukan Admin -- jadi Admin sekarang hanya MELIHAT
-- (read-only) laporan & statusnya, sementara Supir yang menandainya lewat
-- panel mereka sendiri (lihat perbaruiStatusLaporanKendalaSupir di
-- supirLayanan.ts). Kebijakan UPDATE Admin ("akses penuh") tetap
-- dipertahankan sebagai cadangan administratif, hanya UI-nya yang dilepas.
-- ==========================================
DROP POLICY IF EXISTS "Laporan Kendala: Supir menandai status laporannya sendiri" ON laporan_kendala;
CREATE POLICY "Laporan Kendala: Supir menandai status laporannya sendiri"
  ON laporan_kendala FOR UPDATE TO authenticated
  USING (supir_id = auth.uid())
  WITH CHECK (supir_id = auth.uid() AND status IN ('baru', 'ditindak', 'selesai'));

DROP POLICY IF EXISTS "Riwayat Laporan Kendala: Supir mencatat transisi status laporannya sendiri" ON riwayat_laporan_kendala;
CREATE POLICY "Riwayat Laporan Kendala: Supir mencatat transisi status laporannya sendiri"
  ON riwayat_laporan_kendala FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM laporan_kendala
      WHERE laporan_kendala.id = riwayat_laporan_kendala.laporan_id
        AND laporan_kendala.supir_id = auth.uid()
    )
  );

-- ==========================================
-- MIGRASI: laporkan_kendala_perjalanan() IKUT WAKTU SIMULASI KLIEN
-- Sebelumnya laporan_kendala.dibuat_pada memakai DEFAULT NOW() (jam server
-- SUNGGUHAN) dan ketiga INSERT INTO notifikasi di fungsi ini memakai NOW()
-- literal -- keduanya TIDAK PERNAH mengikuti fitur "Waktu Disimulasikan"
-- (offset client-side, src/bantuan/waktuSimulasi.ts) yang dipakai demo/uji
-- coba proyek ini. Akibatnya kolom WAKTU di tabel "Laporan Kendala"
-- (LaporanAdmin.vue) menampilkan jam sungguhan saat laporan dikirim,
-- bukan jam yang sedang disimulasikan supir saat itu -- sama seperti
-- kelas bug yang sama yang sudah diperbaiki sebelumnya untuk
-- langganan.tanggal_berakhir (lihat konfirmasiPembayaranLunas,
-- berlangganganLayanan.ts). Parameter p_dibuat_pada baru (opsional, default
-- NULL) diisi client dengan ambilWaktuSekarang().toISOString() -- kalau
-- NULL (mis. dipanggil dari tempat lain yang belum diperbarui), tetap jatuh
-- ke NOW() seperti sebelumnya lewat COALESCE, jadi aman dipakai ulang.
-- ==========================================
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

-- ==========================================
-- MIGRASI: HITUNG & SIMPAN JARAK PERJALANAN SECARA OTOMATIS
-- ==========================================
CREATE OR REPLACE FUNCTION hitung_jarak_perjalanan()
RETURNS TRIGGER AS $$
BEGIN
  -- Inisialisasi ke 0 jika NULL saat insert
  IF NEW.jarak_km IS NULL THEN
    NEW.jarak_km := 0.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_hitung_jarak_perjalanan ON perjalanan;
CREATE TRIGGER trg_hitung_jarak_perjalanan
BEFORE INSERT OR UPDATE ON perjalanan
FOR EACH ROW
EXECUTE FUNCTION hitung_jarak_perjalanan();

-- Fungsi trigger untuk melakukan akumulasi jarak dinamis berdasarkan lokasi live supir
CREATE OR REPLACE FUNCTION akumulasi_jarak_perjalanan_supir()
RETURNS TRIGGER AS $$
DECLARE
  v_delta double precision;
  v_hari_ini date := timezone('Asia/Jakarta', now())::date;
BEGIN
  -- Pastikan koordinat lama dan baru valid
  IF OLD.lintang_terkini IS NOT NULL AND OLD.bujur_terkini IS NOT NULL 
     AND NEW.lintang_terkini IS NOT NULL AND NEW.bujur_terkini IS NOT NULL THEN
     
    -- Hitung selisih jarak pergerakan supir
    v_delta := hitung_jarak(OLD.lintang_terkini, OLD.bujur_terkini, NEW.lintang_terkini, NEW.bujur_terkini);
    
    -- Tambahkan ke perjalanan aktif hari ini jika perubahannya masuk akal (kurang dari 2 km per interval)
    -- Ini mencegah lompatan jauh/teleportasi di awal pelacakan.
    IF v_delta > 0.001 AND v_delta < 2.0 THEN
      UPDATE perjalanan
      SET jarak_km = COALESCE(jarak_km, 0.0) + v_delta
      WHERE supir_id = NEW.id
        AND tanggal_perjalanan = v_hari_ini
        -- Akumulasi hanya terjadi saat perjalanan sedang aktif berlangsung
        AND status IN ('penjemputan', 'menuju_sekolah', 'pengantaran');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pasang trigger akumulasi pada tabel supir
DROP TRIGGER IF EXISTS trg_akumulasi_jarak_perjalanan_supir ON supir;
CREATE TRIGGER trg_akumulasi_jarak_perjalanan_supir
BEFORE UPDATE OF lintang_terkini, bujur_terkini ON supir
FOR EACH ROW
EXECUTE FUNCTION akumulasi_jarak_perjalanan_supir();

-- ==========================================
-- MIGRASI: TANDAI PERUBAHAN ALAMAT PADA PENUGASAN AKTIF
-- Aturan bisnis: perubahan ALAMAT SAJA (bukan waktu/hari) tidak boleh
-- membatalkan/menugaskan ulang penugasan yang sudah diberikan Admin -- anak
-- tetap di supir yang sama, cuma titik lokasinya yang berubah (beda dari
-- perubahan waktu/hari, yang WAJIB dibatalkan & di-assign ulang, lihat
-- sinkronkanPerjalananSetelahPerubahanJadwal di orangTuaLayanan.ts). Kolom
-- ini menandai KAPAN alamat anak pada baris penugasan ini terakhir diubah
-- SETELAH penugasan dibuat -- dipakai PenugasanAdmin.vue (badge "Alamat
-- diperbarui") dan KartuTugas.vue (sisi Supir, catatan "Alamat telah
-- diperbarui pengguna") supaya keduanya tahu titik lokasi sudah berubah
-- tanpa perlu menugaskan ulang. Sengaja bukan boolean polos -- timestamp
-- lebih fleksibel kalau suatu saat perlu urutan/expiry.
-- ==========================================
ALTER TABLE perjalanan ADD COLUMN IF NOT EXISTS alamat_diperbarui_pada timestamptz;
