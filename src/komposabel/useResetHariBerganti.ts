import { onMounted, onUnmounted } from 'vue';
import { ambilTanggalWibSekarang } from '../bantuan/waktuSimulasi';

/**
 * Memanggil `callback` otomatis begitu tanggal WIB berganti (termasuk lewat
 * offset "Waktu Disimulasikan", bukan cuma jam sistem sungguhan) SELAGI
 * komponen tetap terbuka -- dipakai halaman/panel Supir yang menampilkan
 * "tugas hari ini" (DashboardSupir.vue, TugasSupir.vue).
 *
 * Tanpa ini, daftar tugas yang sudah terlanjur dimuat sebelum tengah malam
 * tetap "menempel" di layar sampai pengguna reload manual/ada event
 * realtime yang kebetulan lewat -- padahal query ke database SUDAH berbasis
 * tanggal (ambilTugasHariIni(tanggal)), jadi begitu di-fetch ULANG hasilnya
 * otomatis benar (tugas kemarin tidak ikut terbawa, TIDAK ada tugas baru
 * yang otomatis dibuat -- cuma query utk tanggal baru yang bisa saja kosong
 * sampai Admin membuat penugasan). Masalahnya murni TIDAK ADA yang memicu
 * fetch ulang itu pada pukul 00:00 WIB kalau halaman tidak di-mount ulang.
 *
 * Interval cek 30 detik dipilih supaya reset terasa "tepat pukul 00:00"
 * (telat maksimal 30 detik) tanpa membebani apa pun -- ini cuma
 * membandingkan string tanggal di memori, TIDAK ada query ke server tiap
 * kali cek (beda dari polling data sungguhan yang dilarang di proyek ini).
 */
export function useResetHariBerganti(callback: () => void) {
  let tanggalTerakhir = ambilTanggalWibSekarang();
  let idInterval: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    idInterval = setInterval(() => {
      const tanggalSekarang = ambilTanggalWibSekarang();
      if (tanggalSekarang !== tanggalTerakhir) {
        tanggalTerakhir = tanggalSekarang;
        callback();
      }
    }, 30000);
  });

  onUnmounted(() => {
    if (idInterval !== null) clearInterval(idInterval);
  });
}
