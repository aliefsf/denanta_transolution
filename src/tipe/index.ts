export interface Kordinat {
  lat: number;
  lng: number;
}

export interface Pengguna {
  id: string;
  nama: string;
  surel: string;
  peran: 'tamu' | 'orangtua' | 'supir' | 'admin';
  noTelepon?: string;
}

export interface Anak {
  id: string;
  nama: string;
  idOrangTua: string;
  alamatJemput: string;
  statusJemput: 'Belum Dijemput' | 'Sudah Dijemput' | 'Tiba di Sekolah';
}

export interface Supir {
  id: string;
  nama: string;
  noPolisi: string;
  jenisKendaraan: string;
  lokasiTerkini?: Kordinat;
  aktif: boolean;
}

export interface Tagihan {
  id: string;
  bulan: string;
  total: number;
  status: 'Belum Dibayar' | 'Lunas';
  idOrangTua: string;
}

// ==========================================
// Tipe baris database (mengikuti kolom skema_database.sql apa adanya)
// Digunakan oleh lapisan layanan Supabase (src/layanan/orangTuaLayanan.ts)
// ==========================================

export interface PenggunaRow {
  id: string;
  email: string;
  peran: 'tamu' | 'orangtua' | 'supir' | 'admin';
  nama_lengkap: string;
  nomor_telepon: string | null;
  foto_profil: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface OrangTuaRow {
  id: string;
  alamat: string;
  kontak_darurat: string | null;
  nomor_whatsapp: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface SekolahRow {
  id: string;
  nama: string;
  alamat: string;
  lintang: number;
  bujur: number;
  dibuat_pada: string;
  diperbarui_pada: string;
  // Daftar nama kelas yang didaftarkan Admin untuk sekolah ini (tabel
  // kelas_sekolah) -- dipakai mengisi dropdown kelas pada form anak.
  kelasTersedia?: string[];
}

export interface AnakRow {
  id: string;
  orang_tua_id: string;
  sekolah_id: string;
  nama_lengkap: string;
  kelas: string;
  url_foto: string | null;
  golongan_darah: string | null;
  alergi: string | null;
  alamat_jemput: string;
  lintang_jemput: number;
  bujur_jemput: number;
  alamat_antar: string;
  lintang_antar: number;
  bujur_antar: number;
  jenis_layanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
  jenis_langganan: 'bulanan' | 'harian';
  aktif: boolean;
  dibuat_pada: string;
  diperbarui_pada: string;
  sekolah?: Pick<SekolahRow, 'nama' | 'alamat' | 'lintang' | 'bujur'>;
}

export interface SupirRow {
  id: string;
  jenis_kendaraan: string;
  nomor_plat: string;
  tipe_supir: 'tetap' | 'sementara';
  aktif: boolean;
  status_verifikasi: 'menunggu' | 'terverifikasi' | 'ditolak';
  status_kehadiran: 'belum_diisi' | 'siap' | 'tidak_siap';
  status_kehadiran_diperbarui_pada: string;
  tanggal_mulai_kerja: string | null;
  tanggal_selesai_kerja: string | null;
  url_sim: string | null;
  url_stnk: string | null;
  lintang_terkini: number | null;
  bujur_terkini: number | null;
  tersedia: boolean;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface LanggananRow {
  id: string;
  anak_id: string;
  tanggal_mulai: string;
  tanggal_berakhir: string;
  biaya_bulanan: number;
  sudah_dibayar: boolean;
  tanggal_jatuh_tempo: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export type StatusPerjalanan =
  | 'dijadwalkan'
  | 'penjemputan'
  | 'menuju_sekolah'
  | 'di_sekolah'
  | 'pengantaran'
  | 'tiba'
  | 'dibatalkan';

export interface PerjalananRow {
  id: string;
  anak_id: string;
  supir_id: string | null;
  tanggal_perjalanan: string;
  jenis_perjalanan: 'pagi' | 'sore';
  jenis_layanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
  status: StatusPerjalanan;
  waktu_jemput: string | null;
  waktu_antar: string | null;
  jarak_km: number | null;
  biaya_tambahan: number;
  catatan: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface LogStatusPerjalananRow {
  id: string;
  perjalanan_id: string;
  status: string;
  lintang: number | null;
  bujur: number | null;
  catatan: string | null;
  dibuat_pada: string;
}

export interface PembayaranRow {
  id: string;
  langganan_id: string | null;
  perjalanan_id: string | null;
  orang_tua_id: string;
  jumlah: number;
  tipe_pembayaran: 'bulanan' | 'harian' | 'tambahan' | 'pembatalan';
  status: 'menunggu' | 'lunas' | 'gagal' | 'kedaluwarsa';
  id_pesanan_midtrans: string;
  id_transaksi_midtrans: string | null;
  tanggal_pembayaran: string | null;
  url_invoice: string | null;
  periode_bulan: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface PenundaanPembayaranRow {
  id: string;
  pembayaran_id: string;
  orang_tua_id: string;
  alasan: string;
  bukti_url: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  disetujui_oleh: string | null;
  disetujui_pada: string | null;
  tanggal_baru: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface NotifikasiRow {
  id: string;
  pengguna_id: string;
  judul: string;
  pesan: string;
  tipe: 'perjalanan' | 'pembayaran' | 'sistem' | 'promo';
  sudah_dibaca: boolean;
  id_terkait: string | null;
  tipe_terkait: string | null;
  dibuat_pada: string;
}

export interface LaporanKendalaRow {
  id: string;
  perjalanan_id: string;
  supir_id: string;
  anak_id: string | null;
  kategori: 'kendala_perjalanan' | 'kendala_anak';
  deskripsi: string;
  status: 'baru' | 'ditindak' | 'selesai';
  status_perjalanan: string | null;
  dibuat_pada: string;
}

export interface PenilaianRow {
  id: string;
  orang_tua_id: string;
  supir_id: string;
  perjalanan_id: string;
  bintang: number;
  komentar: string | null;
  dibuat_pada: string;
}

export interface JadwalMingguanRow {
  id: string;
  anak_id: string;
  senin: boolean;
  selasa: boolean;
  rabu: boolean;
  kamis: boolean;
  jumat: boolean;
  sabtu: boolean;
  minggu: boolean;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface PolaHariJadwal {
  senin: boolean;
  selasa: boolean;
  rabu: boolean;
  kamis: boolean;
  jumat: boolean;
  sabtu: boolean;
  minggu: boolean;
}

export interface RiwayatPerubahanJadwalMingguanRow {
  id: string;
  anak_id: string;
  jadwal_sebelum: PolaHariJadwal;
  jadwal_sesudah: PolaHariJadwal;
  dibuat_pada: string;
}

export interface PengajuanAbsenRow {
  id: string;
  anak_id: string;
  tanggal: string;
  status: 'masuk' | 'tidak_masuk';
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface PengajuanCutiRow {
  id: string;
  anak_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface HariLiburRow {
  id: string;
  tanggal: string;
  nama: string;
  jenis: 'nasional' | 'cuti_bersama' | 'libur_sekolah' | 'khusus';
  sekolah_id: string | null;
  keterangan: string | null;
  dibuat_oleh: string | null;
  dibuat_pada: string;
  sumber: 'manual' | 'api';
}

export interface PengajuanPerubahanJadwalRow {
  id: string;
  anak_id: string;
  hari: string | null;
  tanggal: string;
  waktu_baru: string;
  biaya_tambahan: number;
  jenis_perubahan: 'pergi' | 'pulang';
  alamat_baru: string | null;
  lintang_baru: number | null;
  bujur_baru: number | null;
  pembayaran_id: string | null;
  perjalanan_lama_id: string | null;
  perjalanan_baru_id: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  dibuat_pada: string;
  diperbarui_pada: string;
}

// ==========================================
// Model tampilan (view-model) untuk komponen dashboard orang tua.
// Dipetakan dari AnakRow + PerjalananDenganSupir hari ini oleh
// src/bantuan/petakanAnak.ts, mengikuti kosakata field yang sudah
// dipakai template (bukan nama kolom database mentah).
// ==========================================

export interface AnakTampilan {
  id: string;
  nama: string;
  sekolah: string;
  // Koordinat sekolah ANAK INI SENDIRI (dari anak.sekolah_id -> sekolah,
  // BUKAN sekolah lain) -- dipakai PetaLokasiLangsung.vue di DetailAnak.vue
  // supaya penanda lokasi sekolah pada peta selalu benar-benar mengarah ke
  // sekolah yang tertulis di atas, bukan diam-diam jatuh ke koordinat
  // default generik yang bisa kebetulan lebih dekat ke sekolah lain.
  lintangSekolah: number | null;
  bujurSekolah: number | null;
  kelas: string;
  layanan: string;
  status: import('../bantuan/statusPerjalanan').StatusAnakUI;
  namaSupir: string | null;
  kontakSupir: string | null;
  fotoSupir: string | null;
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  foto: string | null;
  golonganDarah: string | null;
  alergi: string | null;
  perjalananId: string | null;
  supirId: string | null;
  // 'aktif' = ada laporan kendala hari ini yang BELUM 'selesai', 'selesai' =
  // semua laporan kendala hari ini sudah ditandai selesai, null/undefined =
  // tidak ada laporan kendala sama sekali hari ini.
  statusKendalaHariIni?: 'aktif' | 'selesai' | null;
}
