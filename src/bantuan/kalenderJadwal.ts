// Dipakai bersama oleh JadwalOrangTua.vue (Konfigurasi Jadwal Bulanan),
// HalamanBerlangganan.vue (Tahap 3: "Tentukan jadwal pilihan anda!") dan
// KelolaJadwalAdmin.vue supaya logika pemetaan pola hari -> tanggal kalender
// bulan berjalan tidak terduplikasi di beberapa tempat.
import { ambilWaktuSekarang } from './waktuSimulasi';

export const HARI_BERDASAR_INDEKS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export type NamaHari = (typeof HARI_BERDASAR_INDEKS)[number];

export interface SelKalenderJadwal {
  tanggal: number;
  aktif: boolean;
  hariIni: boolean;
  // true jika tanggal ini terdaftar di hari_libur -- ditandai terlepas dari
  // apakah hari itu termasuk pola jadwal aktif atau tidak, sama seperti
  // kalender pada umumnya menandai tanggal merah tanpa peduli jadwal
  // pribadi pengguna (lihat KelolaJadwalAdmin, JadwalOrangTua, HalamanBerlangganan).
  libur: boolean;
  // true jika tanggal ini sudah lewat relatif terhadap waktu simulasi
  // (`acuan`, lihat waktuSimulasi.ts) -- bulan yang ditampilkan selalu bulan
  // berjalan sesuai waktu simulasi, jadi cukup dibandingkan terhadap
  // acuan.getDate(). Dipakai JadwalOrangTua.vue/HalamanBerlangganan.vue untuk
  // menonaktifkan/memudarkan tanggal yang sudah lewat pada visualisasi
  // kalender jadwal mingguan, supaya tidak terkesan masih bisa dipilih.
  lewat: boolean;
}

export function formatTanggalIso(tahun: number, bulan: number, tanggal: number): string {
  return `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(tanggal).padStart(2, '0')}`;
}

/**
 * Membangun grid kalender bulan berjalan (Senin sebagai kolom pertama),
 * dengan `null` untuk sel kosong sebelum tanggal 1, menandai `aktif` pada
 * tanggal yang hari-nya ada di `polaAktif` (mis. { Senin: true, ... }) dan
 * BUKAN termasuk `tanggalLibur` (set tanggal ISO "YYYY-MM-DD" hasil
 * tanggalLiburKeSet()) -- hari libur mengecualikan tanggal itu dari hari
 * efektif meski hari-nya termasuk pola aktif.
 */
export function buatKalenderBulanIni(
  polaAktif: Record<string, boolean>,
  acuan: Date = ambilWaktuSekarang(),
  tanggalLibur: Set<string> = new Set()
): (SelKalenderJadwal | null)[] {
  const tahun = acuan.getFullYear();
  const bulan = acuan.getMonth();
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate();
  const hariPertama = new Date(tahun, bulan, 1).getDay();
  const offset = (hariPertama + 6) % 7;

  const sel: (SelKalenderJadwal | null)[] = [];
  for (let i = 0; i < offset; i++) sel.push(null);
  for (let d = 1; d <= jumlahHari; d++) {
    const namaHari = HARI_BERDASAR_INDEKS[new Date(tahun, bulan, d).getDay()];
    const jadwalAktif = !!polaAktif[namaHari];
    const kenaLibur = tanggalLibur.has(formatTanggalIso(tahun, bulan, d));
    sel.push({
      tanggal: d,
      aktif: jadwalAktif && !kenaLibur,
      hariIni: d === acuan.getDate(),
      libur: kenaLibur,
      lewat: d < acuan.getDate()
    });
  }
  return sel;
}

export function hitungJumlahHariAktifBulanIni(
  polaAktif: Record<string, boolean>,
  acuan: Date = ambilWaktuSekarang(),
  tanggalLibur: Set<string> = new Set()
): number {
  return buatKalenderBulanIni(polaAktif, acuan, tanggalLibur).filter((s) => s?.aktif).length;
}

const HARI_SEKOLAH_STANDAR: readonly NamaHari[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

/**
 * Jumlah hari EFEKTIF SEKOLAH bulan berjalan -- dasar aturan potongan biaya
 * bulanan 40% (lihat hitungBiayaBulanan di tarifLayanan.ts). SENGAJA tidak
 * memakai pola jadwal pribadi pengguna (polaAktif/hariAktif) seperti
 * hitungJumlahHariAktifBulanIni() di atas -- hari efektif sekolah murni dari
 * kalender hari sekolah standar (Senin-Jumat) dikurangi tanggalLibur yang
 * ditetapkan Admin. Jadwal yang dipilih pengguna sendiri (mis. cuma pilih
 * 3 hari dari 5 hari sekolah) TIDAK mengurangi biaya -- layanan tetap
 * tersedia penuh selama periode langganan, potongan hanya berlaku kalau
 * sekolahnya sendiri yang memang sedikit hari efektifnya (libur panjang,
 * dsb).
 */
export function hitungHariEfektifSekolahBulanIni(
  acuan: Date = ambilWaktuSekarang(),
  tanggalLibur: Set<string> = new Set()
): number {
  const tahun = acuan.getFullYear();
  const bulan = acuan.getMonth();
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate();
  let total = 0;
  for (let d = 1; d <= jumlahHari; d++) {
    const namaHari = HARI_BERDASAR_INDEKS[new Date(tahun, bulan, d).getDay()];
    if (!HARI_SEKOLAH_STANDAR.includes(namaHari)) continue;
    if (tanggalLibur.has(formatTanggalIso(tahun, bulan, d))) continue;
    total++;
  }
  return total;
}

/**
 * Nama hari (Senin..Minggu) dari tanggal ISO "YYYY-MM-DD" -- parse manual
 * (split + constructor Date lokal Y/M/D) supaya tidak kena masalah
 * timezone dari `new Date("YYYY-MM-DD")` (di-parse sebagai UTC tengah
 * malam, `.getDay()` bisa mundur satu hari tergantung timezone
 * browser/server). Dipakai buatPenugasan() di adminLayanan.ts untuk
 * menyaring anak berdasarkan jadwal_mingguan pada tanggal penugasan.
 */
export function namaHariDariTanggalIso(tanggalIso: string): NamaHari {
  const [tahun, bulan, tanggal] = tanggalIso.split('-').map(Number);
  return HARI_BERDASAR_INDEKS[new Date(tahun, bulan - 1, tanggal).getDay()];
}

/**
 * Menyaring daftar hari_libur menjadi Set tanggal ISO yang berlaku untuk
 * satu sekolah tertentu -- baris dengan sekolah_id NULL berlaku untuk semua
 * sekolah (libur nasional/cuti bersama), baris dengan sekolah_id terisi
 * hanya berlaku untuk sekolah itu (libur_sekolah spesifik).
 */
export function tanggalLiburKeSet(
  daftar: { tanggal: string; sekolah_id: string | null }[],
  sekolahId?: string | null
): Set<string> {
  return new Set(
    daftar.filter((h) => h.sekolah_id === null || h.sekolah_id === sekolahId).map((h) => h.tanggal)
  );
}

/**
 * Meratakan daftar rentang tanggal (mis. pengajuan_cuti { tanggal_mulai,
 * tanggal_selesai }) menjadi Set tanggal ISO harian -- dipakai
 * JadwalOrangTua.vue supaya kalender "Konfigurasi Jadwal Bulanan" langsung
 * menandai tanggal cuti/libur yang diajukan orang tua sendiri (union dengan
 * tanggalLiburKeSet() hasil hari_libur Admin), reaktif terhadap
 * tambah/ubah/hapus pengajuan cuti tanpa perlu memuat ulang halaman.
 */
export function rentangTanggalKeSet(daftar: { tanggal_mulai: string; tanggal_selesai: string }[]): Set<string> {
  const hasil = new Set<string>();
  for (const item of daftar) {
    const [thMulai, blMulai, tgMulai] = item.tanggal_mulai.split('-').map(Number);
    const [thSelesai, blSelesai, tgSelesai] = item.tanggal_selesai.split('-').map(Number);
    let kursor = new Date(thMulai, blMulai - 1, tgMulai);
    const batas = new Date(thSelesai, blSelesai - 1, tgSelesai);
    let pengaman = 0;
    while (kursor.getTime() <= batas.getTime() && pengaman < 366) {
      hasil.add(formatTanggalIso(kursor.getFullYear(), kursor.getMonth(), kursor.getDate()));
      kursor = new Date(kursor.getFullYear(), kursor.getMonth(), kursor.getDate() + 1);
      pengaman++;
    }
  }
  return hasil;
}
