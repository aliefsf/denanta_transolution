import type { AnakRow, AnakTampilan } from '../tipe';
import type { PerjalananDenganSupir } from '../layanan/orangTuaLayanan';
import { mapStatusPerjalananKeUI } from './statusPerjalanan';

export const LABEL_LAYANAN: Record<string, string> = {
  antar_jemput: 'Antar Jemput (PP)',
  antar_saja: 'Antar Saja (Pagi)',
  jemput_saja: 'Jemput Saja (Sore)'
};

/**
 * Memetakan baris `anak` (+ perjalanan hari ini bila ada) ke bentuk
 * AnakTampilan yang dipakai oleh template dashboard orang tua.
 */
export function petakanAnakTampilan(
  anak: AnakRow,
  perjalananHariIni: PerjalananDenganSupir[]
): AnakTampilan {
  // Pilih sesi yang paling mencerminkan kondisi anak SAAT INI: sesi sore
  // hanya diprioritaskan begitu benar-benar sudah berjalan (status-nya
  // bukan lagi 'dijadwalkan' bawaan) -- selama sore masih di titik awal,
  // status sesi pagi (termasuk setelah 'tiba' di sekolah, menunggu
  // dijemput sore) tetap yang paling relevan ditampilkan. Tanpa ini,
  // begitu anak punya kedua sesi (antar_jemput), badge status selalu
  // "macet" di status sore yang belum tersentuh walau supir sudah
  // mengubah status sesi pagi.
  const perjalananAnak = perjalananHariIni.filter((p) => p.anak_id === anak.id);
  const perjalananPagi = perjalananAnak.find((p) => p.jenis_perjalanan === 'pagi') ?? null;
  const perjalananSore = perjalananAnak.find((p) => p.jenis_perjalanan === 'sore') ?? null;
  const perjalananTerbaru =
    (perjalananSore && perjalananSore.status !== 'dijadwalkan' ? perjalananSore : null) ??
    perjalananPagi ??
    perjalananSore ??
    null;

  const semuaKendalaHariIni = perjalananAnak.flatMap((p) => p.laporan_kendala ?? []);
  const statusKendala: AnakTampilan['statusKendalaHariIni'] =
    semuaKendalaHariIni.length === 0
      ? null
      : semuaKendalaHariIni.some((k: any) => k.status !== 'selesai')
      ? 'aktif'
      : 'selesai';

  // Marker/lacak posisi supir HANYA boleh tampil begitu supir benar-benar
  // menekan "Mulai Bertugas" -- acuannya `supirSedangBertugas` (dari kolom
  // `supir.sedang_bertugas`), SAMA PERSIS dengan yang dipakai Admin
  // (ambilPosisiSupirAktif, adminLayanan.ts), BUKAN status kolom
  // `perjalanan`. "Mulai Bertugas" (TugasSupir.vue) cuma meng-UPDATE baris
  // `supir`, tidak pernah menyentuh status perjalanan -- pakai status
  // perjalanan sebagai acuan (versi sebelumnya) membuat marker di sisi Orang
  // Tua telat muncul dibanding Admin/Supir, kadang malah tidak pernah
  // muncul sampai supir sempat ganti status secara manual lewat dropdown.
  const supirSedangBertugas = !!perjalananTerbaru && perjalananTerbaru.supirSedangBertugas === true;

  return {
    id: anak.id,
    nama: anak.nama_lengkap,
    sekolah: anak.sekolah?.nama ?? '-',
    lintangSekolah: anak.sekolah?.lintang ?? null,
    bujurSekolah: anak.sekolah?.bujur ?? null,
    kelas: anak.kelas,
    layanan: LABEL_LAYANAN[anak.jenis_layanan] ?? anak.jenis_layanan,
    // Belum ada baris perjalanan hari ini (mis. Admin belum membuat
    // penugasan) bukan berarti anak "Absen/Libur" -- default-nya harus
    // netral seolah anak tetap masuk seperti biasa ('terjadwal' -> badge
    // "Sedang di Rumah"), bukan menyimpulkan absen tanpa dasar.
    status: perjalananTerbaru
      ? mapStatusPerjalananKeUI(perjalananTerbaru.status, perjalananTerbaru.jenis_perjalanan, perjalananTerbaru.waktu_antar)
      : 'terjadwal',
    namaSupir: perjalananTerbaru?.namaSupir ?? null,
    kontakSupir: perjalananTerbaru?.kontakSupir ?? null,
    fotoSupir: perjalananTerbaru?.fotoSupir ?? null,
    alamatJemput: anak.alamat_jemput,
    lintangJemput: anak.lintang_jemput,
    bujurJemput: anak.bujur_jemput,
    foto: anak.url_foto,
    golonganDarah: anak.golongan_darah,
    alergi: anak.alergi,
    perjalananId: perjalananTerbaru?.id ?? null,
    supirId: supirSedangBertugas ? perjalananTerbaru!.supir_id : null,
    statusKendalaHariIni: statusKendala
  };
}
