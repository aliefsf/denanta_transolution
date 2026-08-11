// Override waktu KHUSUS UNTUK DEMO/PENGUJIAN LOKAL -- mengubah jam sistem
// Windows tidak selalu bisa diandalkan (Windows suka otomatis sinkron ulang
// via NTP walau "Set time automatically" sudah dimatikan, apalagi kalau
// "Set time zone automatically" masih aktif). Mekanisme ini murni
// client-side (localStorage, per-browser) supaya alur yang bergantung pada
// waktu (jendela absensi, kuota perubahan jadwal, dst.) bisa didemokan tanpa
// utak-atik jam OS sama sekali.
//
// SENGAJA hanya dipakai fungsi-fungsi yang SUDAH menerima parameter
// `acuan: Date = new Date()` (periodeAbsensi.ts, kalenderLayanan.ts,
// orangTuaLayanan.ts) -- default parameter itu diganti memanggil
// ambilWaktuSekarang() di sini, jadi satu sumber kebenaran waktu "sekarang"
// untuk seluruh logika bisnis yang sensitif terhadap waktu, TANPA perlu
// mengubah setiap pemanggil satu-satu.
//
// TIDAK memengaruhi kolom timestamptz DEFAULT NOW() di database (itu tetap
// waktu server Supabase yang sesungguhnya) -- lihat catatan yang sama di
// percakapan sebelumnya soal batas mengubah jam OS.

const KUNCI_OFFSET = 'denanta_waktu_simulasi_offset_ms';

function ambilOffsetTersimpan(): number {
  try {
    const mentah = localStorage.getItem(KUNCI_OFFSET);
    if (!mentah) return 0;
    const angka = Number(mentah);
    return Number.isFinite(angka) ? angka : 0;
  } catch {
    // localStorage tidak tersedia (mis. mode privat ekstrem) -- anggap
    // tidak ada override, pakai waktu asli.
    return 0;
  }
}

/**
 * Waktu "sekarang" yang dipakai seluruh logika bisnis sensitif-waktu --
 * sama dengan `new Date()` asli kalau tidak ada override aktif, atau waktu
 * hasil geser (offset) kalau demo sedang mengaktifkan simulasi waktu lewat
 * aturWaktuSimulasi().
 */
export function ambilWaktuSekarang(): Date {
  const offset = ambilOffsetTersimpan();
  if (offset === 0) return new Date();
  return new Date(Date.now() + offset);
}

export function apakahWaktuSimulasiAktif(): boolean {
  return ambilOffsetTersimpan() !== 0;
}

/**
 * Menetapkan waktu simulasi ke `waktuTarget` -- offset dihitung SEKALI saat
 * ini (bukan waktu statis beku), jadi jam terus berjalan maju secara wajar
 * dari titik yang dipilih (mis. diset ke "Senin 16:59", lalu beberapa menit
 * kemudian otomatis sudah "Senin 17:0x").
 */
export function aturWaktuSimulasi(waktuTarget: Date): void {
  try {
    localStorage.setItem(KUNCI_OFFSET, String(waktuTarget.getTime() - Date.now()));
  } catch {
    // Biarkan gagal senyap -- fallback ke waktu asli.
  }
}

export function resetWaktuSimulasi(): void {
  try {
    localStorage.removeItem(KUNCI_OFFSET);
  } catch {
    // Biarkan gagal senyap.
  }
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Tanggal kalender WIB hari ini ("YYYY-MM-DD"), MENGGANTIKAN pola
 * `ambilWaktuSekarang().toISOString().slice(0, 10)` yang tersebar di banyak
 * tempat -- pola itu SALAH begitu jam WIB sekarang berada di 00:00-06:59,
 * karena `.toISOString()` mengembalikan tanggal UTC, yang di rentang jam itu
 * masih menunjuk tanggal KEMARIN (UTC = WIB - 7 jam). Bug ini nyata bahkan
 * tanpa simulasi waktu -- pengguna asli yang membuka aplikasi jam 5 pagi WIB
 * akan salah dianggap "kemarin" oleh kode yang memakai pola lama itu
 * (mis. baris `perjalanan`/`langganan` hari ini jadi tidak ketemu).
 * SELALU pakai fungsi ini (bukan `.toISOString().slice(0,10)` langsung)
 * setiap butuh representasi tanggal WIB dari sebuah Date.
 */
export function tanggalWibDariDate(acuan: Date): string {
  return new Date(acuan.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Tanggal WIB "sekarang" (ikut waktu simulasi kalau sedang aktif). */
export function ambilTanggalWibSekarang(): string {
  return tanggalWibDariDate(ambilWaktuSekarang());
}
