/**
 * Membatasi durasi tunggu sebuah promise. Dipakai untuk pemulihan sesi Supabase
 * saat memuat aplikasi — kalau token tersimpan di localStorage sudah kedaluwarsa/rusak,
 * permintaan refresh token bisa menggantung tanpa pernah resolve/reject, yang membuat
 * router guard menunggu selamanya dan aplikasi tampil blank. Dengan batas waktu ini,
 * permintaan yang menggantung akan dianggap gagal setelah `ms` milidetik agar aplikasi
 * tetap bisa lanjut render (dianggap belum login).
 */
export function denganBatasWaktu<T>(promise: PromiseLike<T>, ms = 8000, pesan = 'Waktu permintaan habis'): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(pesan)), ms);
    })
  ]);
}
