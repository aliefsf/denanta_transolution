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

  const adaKendala = perjalananAnak.some((p) => p.laporan_kendala && p.laporan_kendala.length > 0);

  // Marker/lacak posisi supir HANYA boleh tampil begitu supir benar-benar
  // memulai perjalanannya (status bukan lagi 'dijadwalkan' -- itu cuma
  // berarti Admin sudah membuat penugasan, bukan supir sudah berangkat),
  // dan berhenti lagi begitu sesi itu selesai ('tiba') atau dibatalkan.
  // Sebelumnya supirId ikut terisi begitu ada baris perjalanan APAPUN
  // statusnya, jadi marker & fallback posisi (di titik Rumah) sudah muncul
  // padahal supir belum menekan "Mulai Bertugas" sama sekali di sisi Supir
  // (TugasSupir.vue) -- pengguna seolah bisa "melacak" supir yang belum
  // jalan.
  const supirSedangBertugas = !!perjalananTerbaru && !['dijadwalkan', 'dibatalkan', 'tiba'].includes(perjalananTerbaru.status);

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
    adaKendalaHariIni: adaKendala
  };
}
