import { ref } from 'vue';
import { perbaruiLokasiSupir } from '../layanan/supirLayanan';

// Interval minimum antar penulisan ke database -- navigator.geolocation
// bisa memanggil callback tiap detik (kadang lebih sering), sementara posisi
// supir tidak perlu se-presisi itu untuk peta live tracking. Menulis tiap
// perubahan akan membanjiri quota Supabase (realtime + database write) tanpa
// manfaat nyata bagi orang tua yang memantau.
const INTERVAL_TULIS_MS = 8000;

const sedangMelacak = ref(false);
const errorLacak = ref('');
// Posisi TERBARU device -- diperbarui setiap callback watchPosition (TIDAK
// ikut throttle INTERVAL_TULIS_MS di atas, itu cuma membatasi penulisan ke
// database). Dipakai komponen peta (mis. PetaRuteOptimal.vue) untuk
// menampilkan marker posisi supir sendiri secara instan, tanpa perlu
// menunggu round-trip ke Supabase Realtime.
const posisiSaatIni = ref<{ lat: number; lng: number } | null>(null);

// Simulasi pergerakan (khusus demo, mis. sidang tugas akhir -- tidak
// mungkin jalan kaki sungguhan sambil presentasi). Menginterpolasi titik
// demi titik sepanjang rute tugas hari ini, lalu menulis posisinya lewat
// jalur yang SAMA PERSIS dengan GPS sungguhan (perbaruiLokasiSupir), jadi
// dari sisi peta Orang Tua/Admin tidak ada bedanya sama sekali dengan
// tracking asli.
const sedangSimulasi = ref(false);
let idIntervalSimulasi: ReturnType<typeof setInterval> | null = null;

let idPengawasan: number | null = null;
let waktuTulisTerakhir = 0;

/**
 * Live Tracking GPS sisi Supir: membungkus navigator.geolocation.watchPosition
 * dan menulis posisi terbaru ke kolom lintang_terkini/bujur_terkini (throttle
 * tiap INTERVAL_TULIS_MS) supaya peta lokasi langsung Orang Tua
 * (PetaLokasiLangsung.vue, via Supabase Realtime) bisa mengikuti pergerakan
 * supir. SENGAJA tidak otomatis dimulai di sini -- pemanggil (mis.
 * TataLetakSupir.vue) yang menentukan kapan tracking aktif, supaya tidak
 * melacak device supir terus-menerus tanpa alasan (baterai/kuota data).
 */
export function useLokasiSupir() {
  const mulaiLacak = () => {
    hentikanSimulasi(); // GPS asli & simulasi tidak boleh jalan bersamaan
    if (idPengawasan !== null) return; // sudah berjalan
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      errorLacak.value = 'Perangkat ini tidak mendukung layanan lokasi.';
      return;
    }

    errorLacak.value = '';
    idPengawasan = navigator.geolocation.watchPosition(
      (posisi) => {
        sedangMelacak.value = true;
        errorLacak.value = '';
        posisiSaatIni.value = { lat: posisi.coords.latitude, lng: posisi.coords.longitude };

        const sekarang = Date.now();
        if (sekarang - waktuTulisTerakhir < INTERVAL_TULIS_MS) return;
        waktuTulisTerakhir = sekarang;

        perbaruiLokasiSupir(posisi.coords.latitude, posisi.coords.longitude).catch(() => {
          // Biarkan gagal senyap -- percobaan penulisan berikutnya (interval
          // selanjutnya) akan otomatis mencoba lagi, tidak perlu mengganggu
          // supir dengan toast error tiap kali satu titik gagal terkirim.
        });
      },
      (err) => {
        sedangMelacak.value = false;
        errorLacak.value = err.code === err.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi browser untuk mengaktifkan live tracking.'
          : 'Gagal mengambil lokasi perangkat. Periksa GPS/koneksi Anda.';
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const hentikanSimulasi = () => {
    if (idIntervalSimulasi !== null) {
      clearInterval(idIntervalSimulasi);
      idIntervalSimulasi = null;
    }
    sedangSimulasi.value = false;
  };

  const hentikanLacak = () => {
    if (idPengawasan !== null) {
      navigator.geolocation.clearWatch(idPengawasan);
      idPengawasan = null;
    }
    hentikanSimulasi();
    sedangMelacak.value = false;
  };

  /**
   * Mulai simulasi pergerakan sepanjang `titikRute` (mis. urutan titik
   * jemput + sekolah tujuan tugas hari ini) selama `durasiMs`, dipakai
   * KHUSUS untuk demo (mis. sidang) -- lihat catatan di atas sedangSimulasi.
   */
  const mulaiSimulasiPergerakan = (titikRute: { lat: number; lng: number }[], durasiMs = 60000) => {
    if (titikRute.length < 2) return;
    hentikanLacak(); // pastikan GPS asli tidak ikut menimpa posisi simulasi

    sedangSimulasi.value = true;
    sedangMelacak.value = true;
    errorLacak.value = '';

    const totalSegmen = titikRute.length - 1;
    const waktuMulai = Date.now();

    idIntervalSimulasi = setInterval(() => {
      const progres = Math.min((Date.now() - waktuMulai) / durasiMs, 1);
      const posisiSegmen = progres * totalSegmen;
      const idxSegmen = Math.min(Math.floor(posisiSegmen), totalSegmen - 1);
      const t = posisiSegmen - idxSegmen;
      const awal = titikRute[idxSegmen];
      const akhir = titikRute[idxSegmen + 1];
      const lat = awal.lat + (akhir.lat - awal.lat) * t;
      const lng = awal.lng + (akhir.lng - awal.lng) * t;

      posisiSaatIni.value = { lat, lng };
      perbaruiLokasiSupir(lat, lng).catch(() => {
        // Biarkan gagal senyap, sama seperti alur GPS asli di atas.
      });

      if (progres >= 1) hentikanSimulasi();
    }, 2500);
  };

  return {
    sedangMelacak,
    errorLacak,
    posisiSaatIni,
    sedangSimulasi,
    mulaiLacak,
    hentikanLacak,
    mulaiSimulasiPergerakan,
    hentikanSimulasi
  };
}
