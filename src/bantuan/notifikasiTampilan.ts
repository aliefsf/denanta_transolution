import {
  Bell, Info, CheckCircle2, XCircle, Car, Home, CalendarCheck,
  ShieldCheck, ShieldAlert, AlertTriangle, Wallet, Clock, ClipboardCheck,
  type LucideIcon
} from 'lucide-vue-next';
import type { NotifikasiRow } from '../tipe';

export type SentimenNotifikasi = 'positif' | 'negatif' | 'netral';

export interface InfoTampilanNotifikasi {
  ikon: LucideIcon;
  kelasIkon: string; // warna latar + ikon (badge bulat di kiri notifikasi)
  // Menentukan warna garis vertikal di kiri kartu notifikasi (lihat
  // warnaGarisNotifikasi() di bawah) -- SENGAJA field terpisah dari
  // kelasIkon (bukan di-parse dari situ), supaya kombinasi warna badge
  // ikon & warna garis bisa diatur independen kalau suatu saat perlu beda.
  // Tanpa ini, SEMUA notifikasi (termasuk yang jelas buruk seperti
  // "Perjalanan dibatalkan"/"Langganan berakhir") tampil dengan garis hijau
  // yang sama seperti kabar baik -- berpotensi bikin pengguna salah paham
  // mengira semua notifikasi itu netral/baik.
  sentimen: SentimenNotifikasi;
}

/**
 * Pemetaan ikon & warna PER KEJADIAN SPESIFIK (tipe_terkait), bukan cuma per
 * kategori umum (tipe: perjalanan/pembayaran/sistem/promo) -- supaya info
 * yang paling penting (mis. supir mengubah status jadi "Penjemputan", atau
 * pengajuan penundaan DITOLAK) langsung menonjol lewat warna & ikon yang
 * beda, bukan seragam satu warna untuk semua notifikasi perjalanan/sistem.
 * Dipakai bersama oleh NotifikasiOrangTua.vue, NotifikasiSupir.vue, dan
 * NotifikasiAdmin.vue supaya konsisten di seluruh peran.
 *
 * `tipe_terkait` diisi oleh trigger/fungsi SQL yang mengirim notifikasi
 * (lihat fungsi_buat_notifikasi_status_perjalanan, laporkan_kendala_perjalanan
 * di skema_database.sql) dan oleh kirimNotifikasi() di layanan TS (adminLayanan.ts,
 * orangTuaLayanan.ts) -- kalau nilainya tidak dikenali di sini (mis. data lama
 * sebelum migrasi ini, atau kategori baru yang belum dipetakan), tampilan
 * otomatis jatuh ke warna generik berdasarkan `tipe`.
 */
const PETA_TIPE_TERKAIT: Record<string, InfoTampilanNotifikasi> = {
  // Status perjalanan (supir -> orang tua)
  dijadwalkan: { ikon: CalendarCheck, kelasIkon: 'bg-sky-50 text-sky-600', sentimen: 'positif' },
  penjemputan: { ikon: Car, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },
  menuju_sekolah: { ikon: Car, kelasIkon: 'bg-primary-container/20 text-primary', sentimen: 'netral' },
  di_sekolah: { ikon: CheckCircle2, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },
  pengantaran: { ikon: Car, kelasIkon: 'bg-primary-container/20 text-primary', sentimen: 'netral' },
  tiba: { ikon: Home, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },
  dibatalkan: { ikon: XCircle, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },

  // Laporan kendala (supir -> admin/orang tua, admin -> supir)
  kendala_anak: { ikon: AlertTriangle, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  kendala_perjalanan: { ikon: AlertTriangle, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  kendala_ditindak: { ikon: Clock, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },
  kendala_selesai: { ikon: CheckCircle2, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },

  // Penundaan pembayaran (admin -> orang tua)
  penundaan_disetujui: { ikon: CheckCircle2, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },
  penundaan_ditolak: { ikon: XCircle, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  penundaan_diajukan: { ikon: Clock, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },

  // Penugasan rute (admin -> supir, admin -> orang tua)
  penugasan_baru: { ikon: ClipboardCheck, kelasIkon: 'bg-primary-container/20 text-primary', sentimen: 'netral' },
  penugasan_dibatalkan: { ikon: XCircle, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  penugasan_dialihkan: { ikon: Info, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },

  // Verifikasi & pengelolaan akun supir (admin -> supir)
  akun_terverifikasi: { ikon: ShieldCheck, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },
  akun_ditolak: { ikon: ShieldAlert, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  akun_diaktifkan: { ikon: ShieldCheck, kelasIkon: 'bg-emerald-50 text-emerald-600', sentimen: 'positif' },
  akun_dinonaktifkan: { ikon: ShieldAlert, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },
  verifikasi_supir: { ikon: ShieldAlert, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },
  profil_diperbarui_admin: { ikon: Info, kelasIkon: 'bg-blue-50 text-blue-600', sentimen: 'netral' },

  // Langganan (orang tua berhenti/berakhir -> orang tua & admin)
  langganan: { ikon: ShieldAlert, kelasIkon: 'bg-rose-50 text-rose-600', sentimen: 'negatif' },

  // Pengajuan orang tua (orang tua -> admin)
  pengajuan_cuti: { ikon: CalendarCheck, kelasIkon: 'bg-sky-50 text-sky-600', sentimen: 'netral' },
  pengajuan_perubahan_jadwal: { ikon: Clock, kelasIkon: 'bg-sky-50 text-sky-600', sentimen: 'netral' },
  jadwal_mingguan_diubah: { ikon: CalendarCheck, kelasIkon: 'bg-sky-50 text-sky-600', sentimen: 'netral' },
  alamat_jemput_diubah: { ikon: Home, kelasIkon: 'bg-sky-50 text-sky-600', sentimen: 'netral' }
};

const PETA_TIPE_UMUM: Record<NotifikasiRow['tipe'], InfoTampilanNotifikasi> = {
  perjalanan: { ikon: Bell, kelasIkon: 'bg-primary-container/20 text-primary', sentimen: 'netral' },
  pembayaran: { ikon: Wallet, kelasIkon: 'bg-amber-50 text-amber-600', sentimen: 'netral' },
  sistem: { ikon: Info, kelasIkon: 'bg-blue-50 text-blue-600', sentimen: 'netral' },
  promo: { ikon: Info, kelasIkon: 'bg-blue-50 text-blue-600', sentimen: 'netral' }
};

/**
 * Warna garis vertikal di kiri kartu notifikasi -- hijau utk kabar baik,
 * merah utk kabar buruk, warna primer (netral) utk sisanya. Dipakai
 * bersama oleh NotifikasiOrangTua.vue, NotifikasiSupir.vue, dan
 * NotifikasiAdmin.vue supaya konsisten di seluruh peran.
 */
export function warnaGarisNotifikasi(sentimen: SentimenNotifikasi): string {
  if (sentimen === 'positif') return 'bg-emerald-500';
  if (sentimen === 'negatif') return 'bg-rose-500';
  return 'bg-primary';
}

export function infoTampilanNotifikasi(
  tipe: NotifikasiRow['tipe'],
  tipeTerkait: string | null
): InfoTampilanNotifikasi {
  if (tipeTerkait && PETA_TIPE_TERKAIT[tipeTerkait]) return PETA_TIPE_TERKAIT[tipeTerkait];
  return PETA_TIPE_UMUM[tipe] ?? PETA_TIPE_UMUM.sistem;
}

/**
 * Kategori tab "Kotak Masuk Notifikasi" milik ADMIN (NotifikasiAdmin.vue)
 * -- Admin cuma butuh tahu "ini dari Pengguna (Orang Tua) atau dari Supir?",
 * bukan tipe umum perjalanan/pembayaran/sistem seperti panel Orang
 * Tua/Supir. Dipetakan dari `tipe_terkait` (satu-satunya nilai yang
 * membedakan pengirim, karena `tipe_terkait` unik per kejadian) --
 * DAFTAR INI HARUS DIPERBARUI setiap kali ada notifikasi BARU yang
 * dikirim ke Admin (lihat kirimNotifikasiKeAdmin() di orangTuaLayanan.ts/
 * supirLayanan.ts, dan insert langsung ke Admin di midtrans-webhook &
 * laporkan_kendala_perjalanan/skema_database.sql), supaya tidak pernah
 * jatuh diam-diam ke 'lainnya'.
 */
const PETA_PENGIRIM_ADMIN: Record<string, 'pengguna' | 'supir'> = {
  // Orang Tua (Pengguna) -> Admin
  alamat_jemput_diubah: 'pengguna',
  jadwal_mingguan_diubah: 'pengguna',
  pengajuan_cuti: 'pengguna',
  pengajuan_perubahan_jadwal: 'pengguna',
  penundaan_diajukan: 'pengguna',
  pembayaran_diterima: 'pengguna',

  // Supir -> Admin
  verifikasi_supir: 'supir',
  kendala_anak: 'supir',
  kendala_perjalanan: 'supir'
};

export function kategoriPengirimNotifikasiAdmin(tipeTerkait: string | null): 'pengguna' | 'supir' | 'lainnya' {
  if (!tipeTerkait) return 'lainnya';
  return PETA_PENGIRIM_ADMIN[tipeTerkait] ?? 'lainnya';
}
