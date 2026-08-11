import { ref } from 'vue';
import type { PerjalananRow, StatusPerjalanan } from '../tipe';

// Denyut waktu global -- dibaca oleh apakahMasihSampaiTujuan() supaya
// computed manapun yang memanggilnya (mis. daftarAnak di DashboardOrangTua/
// PantauAnak) otomatis ikut menghitung ulang begitu 2 jam terlewati, tanpa
// perlu event realtime baru dari Supabase. Diperbarui tiap menit -- cukup
// sering untuk transisi "Sampai Tujuan" -> "Sedang di Rumah" terasa
// otomatis, tanpa membebani render.
export const denyutWaktuUI = ref(Date.now());
if (typeof window !== 'undefined') {
  setInterval(() => {
    denyutWaktuUI.value = Date.now();
  }, 60000);
}

export type StatusAnakUI = 'terjadwal' | 'penjemputan' | 'menuju_sekolah' | 'sekolah' | 'pulang' | 'sampai_tujuan' | 'rumah' | 'absen';

// Lama status "Sampai Tujuan" dipertahankan sebelum otomatis dianggap
// "Sedang di Rumah" -- dipilih 2 jam sesuai permintaan klien.
export const DURASI_SAMPAI_TUJUAN_MS = 2 * 60 * 60 * 1000;

/**
 * Anak baru dianggap benar-benar "Sedang di Rumah" (dan Live Share Location
 * boleh terkunci) 2 jam setelah checkpoint 'tiba' sore (waktu_antar)
 * tercatat -- sebelum itu statusnya tetap "Sampai Tujuan" agar orang tua
 * masih melihat konfirmasi baru saja tiba, bukan langsung disamakan dengan
 * "belum berangkat sama sekali" (status 'terjadwal').
 */
export function apakahMasihSampaiTujuan(waktuAntarSore: string | null | undefined): boolean {
  if (!waktuAntarSore) return false;
  const waktuTiba = new Date(waktuAntarSore).getTime();
  if (Number.isNaN(waktuTiba)) return false;
  return denyutWaktuUI.value - waktuTiba < DURASI_SAMPAI_TUJUAN_MS;
}

/**
 * Menjembatani enum status milik tabel `perjalanan` (dijadwalkan, penjemputan,
 * menuju_sekolah, di_sekolah, pengantaran, tiba, dibatalkan) ke kosakata status
 * yang dipakai komponen tampilan (BadgeStatusAnak, KartuTugas, dst): terjadwal,
 * penjemputan, menuju_sekolah, sekolah, pulang, rumah, absen -- SATU-KE-SATU
 * dengan status DB (kecuali 'tiba' yang tetap dipecah berdasar sesi pagi/sore)
 * supaya setiap perubahan status yang dipilih supir (mis. "Penjemputan") selalu
 * terlihat beda secara visual di panel Orang Tua maupun panel Supir sendiri --
 * sebelumnya dijadwalkan/penjemputan/menuju_sekolah digabung jadi satu nilai
 * ('berangkat'), jadi mengubah status ke "Penjemputan" tidak mengubah tampilan
 * apa pun.
 */
export function mapStatusPerjalananKeUI(
  status: StatusPerjalanan | string | null | undefined,
  jenisPerjalanan: 'pagi' | 'sore' | string | null | undefined,
  waktuAntar?: string | null
): StatusAnakUI {
  if (!status) return 'absen';

  switch (status) {
    case 'dibatalkan':
      return 'absen';
    case 'dijadwalkan':
      return 'terjadwal';
    case 'penjemputan':
      return 'penjemputan';
    case 'menuju_sekolah':
      return 'menuju_sekolah';
    case 'di_sekolah':
      return 'sekolah';
    case 'pengantaran':
      return 'pulang';
    case 'tiba':
      if (jenisPerjalanan !== 'sore') return 'sekolah';
      return apakahMasihSampaiTujuan(waktuAntar) ? 'sampai_tujuan' : 'rumah';
    default:
      return 'absen';
  }
}

export function formatWaktuTahapan(waktu: string | null | undefined): string {
  if (!waktu) return 'Menunggu';
  const tanggal = new Date(waktu);
  if (Number.isNaN(tanggal.getTime())) return 'Menunggu';
  return tanggal.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

export interface TahapanWaktu {
  waktuPagi: string;
  waktuSekolah: string;
  waktuSore: string;
  waktuRumah: string;
}

/**
 * Menyusun 4 checkpoint waktu (pagi/sekolah/sore/rumah) untuk GarisWaktuPerjalanan
 * dari perjalanan pagi & sore hari ini. Field yang belum tercapai ditampilkan
 * sebagai "Menunggu" alih-alih menebak waktu.
 */
export function susunTahapanWaktu(
  perjalananPagi: PerjalananRow | null | undefined,
  perjalananSore: PerjalananRow | null | undefined
): TahapanWaktu {
  return {
    waktuPagi: formatWaktuTahapan(perjalananPagi?.waktu_jemput),
    waktuSekolah: formatWaktuTahapan(perjalananPagi?.waktu_antar),
    waktuSore: formatWaktuTahapan(perjalananSore?.waktu_jemput),
    waktuRumah: formatWaktuTahapan(perjalananSore?.waktu_antar),
  };
}
