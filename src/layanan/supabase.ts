import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// PENTING — akar masalah "loading lalu timeout" yang terbukti lewat debugging:
// GoTrueClient (auth-js@2.67.3, versi yang di-pin di package.json) secara
// default mengunci getSession()/refresh lewat Web Locks API browser
// (navigator.locks, lock bernama `lock:<storageKey>`). Kalau lock itu pernah
// "orphan" (dipegang oleh tab/proses yang sudah mati tapi lock-nya tidak ikut
// terlepas — dibuktikan lewat navigator.locks.query() yang menunjukkan lock
// berstatus "held" tanpa pernah "pending" beres), SEMUA panggilan
// terautentikasi berikutnya (getSession, query tabel, upload storage) ikut
// menggantung selamanya menunggu lock yang sama.
//
// Lock kustom di bawah ini TIDAK memakai navigator.locks sama sekali (jadi
// tidak mungkin "orphan" lintas-tab lagi seperti bug di atas), tapi TETAP
// menyerialkan panggilan lewat antrean promise sederhana di memori (khusus
// tab ini, hilang otomatis tiap reload) -- ini lebih dekat ke perilaku
// yang memang diharapkan GoTrueClient (mencegah operasi yang sama-sama
// mengubah state sesi saling tumpang tindih) dibanding versi no-op murni
// (langsung fn() tanpa antre) yang dipakai sebelumnya.
let antrianLock: Promise<unknown> = Promise.resolve();
function lockAntrianMemori<T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  const hasil = antrianLock.then(fn, fn);

  // Majukan antrean maksimal 6 detik menunggu `hasil`, TERLEPAS dari apakah
  // `hasil` sendiri sudah selesai atau belum -- akar masalah "gagal muat"
  // yang menular ke halaman lain yang tidak berkaitan: setiap query (bukan
  // cuma operasi auth, TERMASUK setup channel realtime -- client Supabase
  // mengambil access token lewat getSession() sebelum tiap request/koneksi)
  // melewati lock ini dulu, jadi SATU operasi yang menggantung/lambat akan
  // menahan SEMUA panggilan berikutnya di tab ini mengantre di belakangnya.
  //
  // 6 detik -- hampir semua fetch di aplikasi ini dibungkus
  // denganBatasWaktu(fn, 20000) (20 detik, dinaikkan dari 10 detik supaya
  // ada jauh lebih banyak jeda toleransi). Batas lock WAJIB tetap jauh di
  // bawah angka itu -- kalau batas lock >= batas fetch, fetch yang
  // kebetulan mengantre PASTI "timeout" (waktu tunggu lock saja sudah
  // menghabiskan jatah fetch sebelum query aslinya sempat mulai). Sejak
  // banyak halaman sekarang membuka beberapa channel realtime sekaligus
  // saat mount (lihat realtimeLayanan.ts), antrean ini jauh lebih sering
  // padat dari sebelumnya -- 6 detik masih menyisakan 14 detik penuh bagi
  // fetch 20-detik utk benar-benar selesai setelah lolos antrean.
  antrianLock = Promise.race([
    hasil.then(
      () => undefined,
      () => undefined
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 6000))
  ]);

  return hasil;
}

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: lockAntrianMemori
      },
      global: {
        fetch: (url, options) => {
          const controller = new AbortController();
          // abort(reason) diberi Error kustom (bukan dipanggil kosong) supaya
          // pesan yang sampai ke err.message di catch block pemanggil adalah
          // pesan ramah ini, bukan "signal is aborted without reason" bawaan
          // browser -- sebelumnya toast menampilkan pesan mentah itu apa
          // adanya karena banyak pemanggilan Supabase di halaman (mis. wizard
          // berlangganan) tidak dibungkus denganBatasWaktu() sendiri.
          //
          // 35 detik (sebelumnya 20) -- terukur lewat instrumentasi diagnosis
          // bahwa updateUser() saat reset kata sandi genuinely bisa butuh
          // ~26 detik di server (kemungkinan Supabase Auth mengirim email
          // notifikasi secara sinkron sebelum membalas), jadi batas 20 detik
          // yang lama berisiko memutus paksa request yang sebenarnya masih
          // berjalan normal dan akan berhasil kalau dikasih waktu lebih.
          const timeout = setTimeout(
            () => controller.abort(new Error('Koneksi ke server lambat/terputus. Silakan periksa internet Anda dan coba lagi.')),
            35000
          );
          return fetch(url, {
            ...options,
            signal: controller.signal
          }).finally(() => clearTimeout(timeout));
        }
      }
    })
  : null;

// Buat client Supabase untuk query database & real-time GPS
export { supabase };
export default supabase;
