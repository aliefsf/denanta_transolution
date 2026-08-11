// Dipakai bersama oleh src/layanan/supirLayanan.ts (lazy-reset status
// kehadiran supir), src/layanan/adminLayanan.ts (filter ketersediaan supir
// saat admin membuat penugasan), src/komponen/supir/AbsensiSupir.vue
// (judul dinamis "Laporan Absensi Tanggal ..."), dan
// src/komponen/orangtua/JadwalOrangTua.vue (tanggal aktif absen anak)
// supaya definisi "tanggal aktif absensi" konsisten di semua tempat.
import { ambilWaktuSekarang } from './waktuSimulasi';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const JAM_BUKA_WIB = 17; // Jendela akses "Ajukan Perubahan Jadwal"/cuti orang tua, lihat apakahJendelaAbsensiTerbuka()
const JAM_TUTUP_WIB = 6;
const MENIT_TUTUP_WIB = 30;

/**
 * Hari operasional layanan = Senin s.d. Jumat DAN bukan termasuk tanggal
 * libur/cuti bersama yang ditetapkan Admin (`tanggalLiburTambahan`, diisi
 * caller dari tabel `hari_libur` -- lihat ambilTanggalAktifAbsensi() di
 * src/layanan/kalenderLayanan.ts). Sabtu & Minggu SELALU non-operasional
 * apa pun isi `tanggalLiburTambahan`-nya.
 */
function apakahHariOperasional(tanggalUtcTengahMalam: Date, tanggalLiburTambahan: Set<string>): boolean {
  const hari = tanggalUtcTengahMalam.getUTCDay(); // 0 = Minggu, 6 = Sabtu
  if (hari === 0 || hari === 6) return false;
  const iso = tanggalUtcTengahMalam.toISOString().slice(0, 10);
  return !tanggalLiburTambahan.has(iso);
}

/**
 * Tanggal aktif absensi (D) = tanggal operasional (bukan Sabtu/Minggu,
 * bukan tanggal di `tanggalLiburTambahan`) TERDEKAT, dengan periode
 * pengisian D-1 pukul 17:00 WIB s.d. D pukul 06:30 WIB (lihat migrasi
 * "PERIODE ABSENSI SUPIR" di skema_database.sql) -- BUKAN reset di tengah
 * malam. Begitu jam sudah >= 17:00 WIB pada tanggal kalender WIB berjalan,
 * D langsung dianggap sudah berpindah ke tanggal berikutnya (periode utk
 * tanggal kalender itu sendiri sudah tutup), baru dari situ melompati
 * Sabtu/Minggu/hari libur Admin otomatis kalau D jatuh di tanggal
 * non-operasional. Dipakai bersama oleh AbsensiSupir.vue (absensi harian
 * supir), JadwalOrangTua.vue (Laporan Absensi Anak orang tua), dan
 * PenugasanAdmin.vue/adminLayanan.ts (tanggal default penugasan & filter
 * ketersediaan supir) supaya definisi "tanggal aktif absensi" konsisten di
 * semua tempat.
 *
 * `tanggalLiburTambahan` default kosong (Set<string>()) supaya fungsi ini
 * tetap bisa dipanggil SINKRON tanpa akses database (dipakai beberapa
 * tempat yang belum/tidak bisa async) -- pemanggil yang butuh ikut
 * menyaring hari_libur Admin WAJIB pakai ambilTanggalAktifAbsensi() (async,
 * src/layanan/kalenderLayanan.ts) yang mengisi parameter ini dari database,
 * bukan memanggil fungsi ini langsung.
 *
 * Contoh (kalender Jumat aktif, Sabtu & Minggu libur, Senin aktif):
 * - Jumat 00:00-16:59 WIB -> D = Jumat.
 * - Jumat 17:00-23:59 WIB -> periode Jumat sudah tutup, D melompati
 *   Sabtu/Minggu (non-operasional) langsung ke Senin.
 * - Sabtu / Minggu kapan pun -> D = Senin (Sabtu & Minggu sendiri tidak
 *   pernah valid sbg D).
 * - Senin ditetapkan Admin sebagai cuti bersama -> D melompati Senin juga,
 *   lanjut ke Selasa (atau tanggal operasional berikutnya).
 */
export function hitungTanggalAktifAbsensi(
  acuan: Date = ambilWaktuSekarang(),
  tanggalLiburTambahan: Set<string> = new Set()
): string {
  const wib = new Date(acuan.getTime() + WIB_OFFSET_MS);
  let kandidat = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));

  // Periode pengisian utk tanggal kalender WIB hari ini sudah tutup begitu
  // jam mencapai 17:00 WIB -- mulai cari D dari tanggal BESOK, bukan hari ini.
  if (wib.getUTCHours() >= JAM_BUKA_WIB) {
    kandidat = new Date(kandidat.getTime() + 24 * 60 * 60 * 1000);
  }

  for (let i = 0; i < 365; i++) {
    if (apakahHariOperasional(kandidat, tanggalLiburTambahan)) {
      return kandidat.toISOString().slice(0, 10);
    }
    kandidat = new Date(kandidat.getTime() + 24 * 60 * 60 * 1000);
  }
  // Tidak akan pernah tercapai secara wajar -- jaring pengaman saja.
  return kandidat.toISOString().slice(0, 10);
}

/**
 * Jendela akses fitur cuti/perubahan jadwal ORANG TUA (BUKAN absensi
 * supir -- absensi supir kini bebas kapan saja, lihat
 * hitungTanggalAktifAbsensi() di atas): terbuka 17:00 WIB s.d. 06:30 WIB.
 * Dipertahankan sebagai fungsi terpisah krn masih dipakai
 * ubahJadwalMingguan()/ajukanAbsenHarian() di orangTuaLayanan.ts.
 */
export function apakahJendelaAbsensiTerbuka(acuan: Date = ambilWaktuSekarang()): boolean {
  const wib = new Date(acuan.getTime() + WIB_OFFSET_MS);
  const menitSekarang = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const mulaiMenit = JAM_BUKA_WIB * 60; // 17:00
  const tutupMenit = JAM_TUTUP_WIB * 60 + MENIT_TUTUP_WIB; // 06:30
  return menitSekarang >= mulaiMenit || menitSekarang < tutupMenit;
}

/**
 * Jendela akses fitur "Ajukan Perubahan Jadwal" (orang tua) TERBUKA
 * sepanjang pukul 00:00-15:00 WIB hari yang sama, lalu TERKUNCI sepanjang
 * 15:00-23:59 WIB -- beda dari jendela absensi (yang justru terbuka malam
 * hari). Validasi TAMBAHAN (anak yang penjemputan/pengantarannya HARI INI
 * sudah mulai dijalankan supir tidak boleh diubah lagi) dicek terpisah di
 * ajukanPerubahanJadwal() (orangTuaLayanan.ts) lewat status baris
 * `perjalanan`, karena fungsi ini murni cek jendela WAKTU, tidak
 * mengakses database.
 */
export function apakahDalamJendelaAksesPerubahanJadwal(acuan: Date = ambilWaktuSekarang()): boolean {
  const wib = new Date(acuan.getTime() + WIB_OFFSET_MS);
  const menitSekarang = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const berakhirMenit = 15 * 60; // 15:00
  return menitSekarang < berakhirMenit;
}

/**
 * Format tampilan Indonesia panjang dari tanggal ISO ("YYYY-MM-DD"),
 * mis. "2026-07-22" -> "22 Juli 2026" -- dipakai judul dinamis di
 * AbsensiSupir.vue.
 */
export function formatTanggalIndonesia(tanggalIso: string): string {
  const tanggal = new Date(tanggalIso + 'T00:00:00');
  if (Number.isNaN(tanggal.getTime())) return tanggalIso;
  return tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Sama seperti formatTanggalIndonesia(), tapi menyertakan nama hari, mis.
 * "2026-07-23" -> "Kamis, 23 Juli 2026" -- dipakai pada kalimat penjelasan
 * jam reset periode absensi supaya tanggalnya eksplisit, bukan cuma "hari
 * berikutnya".
 */
export function formatTanggalIndonesiaDenganHari(tanggalIso: string): string {
  const tanggal = new Date(tanggalIso + 'T00:00:00');
  if (Number.isNaN(tanggal.getTime())) return tanggalIso;
  return tanggal.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
