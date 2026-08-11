/**
 * Helper validasi ringan dipakai bersama di seluruh form multi-tahap
 * (wizard berlangganan, tambah anak, pengajuan cuti/perubahan jadwal, dst.)
 * supaya aturan "wajib diisi" konsisten di semua tempat -- bukan cuma cek
 * falsy/kosong, tapi juga menolak input yang cuma berisi spasi.
 */

/** True kalau teks benar-benar terisi (bukan kosong & bukan cuma spasi). */
export function teksTerisi(nilai: string | null | undefined): boolean {
  return !!nilai && nilai.trim().length > 0;
}

/**
 * Nomor telepon/WhatsApp Indonesia yang valid: diawali 08 (lokal) atau 62/+62
 * (internasional), hanya berisi digit setelah dibersihkan dari spasi/strip,
 * panjang wajar (9-15 digit).
 */
export function apakahNomorTeleponValid(nilai: string | null | undefined): boolean {
  if (!teksTerisi(nilai)) return false;
  const bersih = nilai!.replace(/[\s-]/g, '');
  return /^(0|\+?62)8[0-9]{8,13}$/.test(bersih);
}
