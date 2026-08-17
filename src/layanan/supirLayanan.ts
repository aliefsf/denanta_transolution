import { supabase } from './supabase';
import type { StatusPerjalanan } from '../tipe';
import { ambilTanggalAktifAbsensi } from './kalenderLayanan';
import { ambilTanggalWibSekarang, ambilWaktuSekarang } from '../bantuan/waktuSimulasi';
import { useAuth } from '../komposabel/useAuth';
import { kirimNotifikasi, kirimNotifikasiKeAdmin } from './notifikasiLayanan';
import { kompresiGambar, konversiBase64KeBlob } from '../bantuan/kompresiGambar';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// SEBELUMNYA memanggil client.auth.getUser() -- round-trip network ke
// Supabase Auth SETIAP kali dipanggil, padahal fungsi ini dipanggil di
// hampir SEMUA fungsi berkas ini (12+ titik). useAuth() (komposabel
// singleton, lihat catatan "Singleton composable pattern" di CLAUDE.md)
// sudah menyimpan currentUser di memori sejak login/pemulihan sesi
// (authStore.periksaLogin() saat app dimuat) -- baca dari situ langsung
// (instan, tanpa network) alih-alih menembak ulang API tiap panggilan.
// Ini akar penyebab halaman Supir (Dashboard/Tugas/Absensi/dst, yang
// masing-masing memanggil fungsi berkas ini saat mount) terasa lambat --
// beberapa panggilan auth.getUser() yang tumpang tindih SALING MENUNGGU
// satu sama lain lewat antrean lock di supabase.ts, bukan berjalan paralel.
function idSupirWajibAda(): string {
  const { currentUser } = useAuth();
  const id = currentUser.value?.id;
  if (!id) throw new Error('Sesi supir tidak ditemukan, silakan login ulang.');
  return id;
}

/**
 * Anak yang langganannya BENAR-BENAR AKTIF pada `tanggal` tertentu (baris
 * langganan sudah_dibayar=true DAN tanggal_berakhir >= tanggal) -- cerminan
 * dari fungsi bernama sama di adminLayanan.ts (dipertahankan terpisah,
 * bukan diimpor lintas domain, mengikuti pola "satu file per domain" yang
 * dipakai proyek ini). Dipakai ambilTugasHariIni() supaya anak yang belum
 * lunas/sudah kedaluwarsa tidak pernah tampil di daftar tugas supir, meski
 * baris perjalanan-nya sudah terlanjur ada di database.
 */
async function ambilAnakIdBerlanggananAktif(
  client: NonNullable<typeof supabase>,
  anakIds: string[],
  tanggal: string
): Promise<Set<string>> {
  if (anakIds.length === 0) return new Set();
  const { data, error } = await client
    .from('langganan')
    .select('anak_id')
    .in('anak_id', anakIds)
    .eq('sudah_dibayar', true)
    .gte('tanggal_berakhir', tanggal);
  if (error) throw error;
  return new Set((data ?? []).map((l: any) => l.anak_id));
}

// ==========================================
// UC-S01: Mengatur Status Kehadiran (tri-state; BEBAS diisi kapan saja
// dalam satu periode -- tanggal aktifnya melompati Sabtu/Minggu/hari libur
// Admin otomatis & "reset" begitu pukul 17:00 WIB pada tanggal aktif saat
// ini terlewati (periode pengisian D-1 17:00 WIB s.d. D 06:30 WIB), lihat
// hitungTanggalAktifAbsensi() di src/bantuan/periodeAbsensi.ts)
// ==========================================

export type StatusKehadiran = 'belum_diisi' | 'siap' | 'tidak_siap';

/**
 * Supir tipe 'sementara' hanya diberi akses selama rentang
 * tanggal_mulai_kerja..tanggal_selesai_kerja (lihat migrasi "RENTANG
 * TANGGAL KERJA SUPIR SEMENTARA" di skema_database.sql) -- kalau
 * tanggal_selesai_kerja sudah lewat KALENDER hari ini, masa kerjanya
 * dianggap berakhir. Dipakai untuk mengunci tombol aksi Absensi Harian
 * (bukan menyembunyikan halamannya) supaya supir masih bisa melihat
 * riwayat/statusnya, hanya tidak bisa mengubah apa pun lagi.
 */
function apakahMasaKerjaSementaraBerakhir(tipeSupir: string | null, tanggalSelesaiKerja: string | null): boolean {
  if (tipeSupir !== 'sementara' || !tanggalSelesaiKerja) return false;
  const hariIni = ambilTanggalWibSekarang();
  return hariIni > tanggalSelesaiKerja;
}

async function bacaStatusKehadiranTerkini(
  client: NonNullable<typeof supabase>,
  supirId: string
): Promise<{ status: StatusKehadiran; diperbaruiPada: string | null; tanggalAktif: string; masaKerjaBerakhir: boolean }> {
  const tanggalAktif = await ambilTanggalAktifAbsensi();

  // .maybeSingle() (BUKAN .single()) -- .single() melempar error PostgREST
  // 406 "no rows"/"multiple rows" kalau baris supir utk id ini tidak
  // ditemukan (mis. akun pengguna.peran='supir' yang baris `supir`-nya
  // belum/gagal dibuat, lihat backfill_pengguna.sql), lalu tertangkap
  // sebagai error jaringan generik ("Periksa koneksi internet Anda") di
  // AbsensiSupir.vue -- padahal akar masalahnya data akun yang hilang,
  // bukan koneksi. Dengan maybeSingle(), kasus itu ditangani eksplisit di
  // bawah dengan pesan yang jelas.
  const { data, error } = await client
    .from('supir')
    .select('status_kehadiran, status_kehadiran_diperbarui_pada, status_kehadiran_untuk_tanggal, tipe_supir, tanggal_selesai_kerja')
    .eq('id', supirId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Baris tidak kembali bisa berarti dua hal yang tidak bisa dibedakan dari
    // sisi klien: (1) baris `supir` memang belum/tidak ada, ATAU (2) sesi
    // login sedang tidak valid sehingga RLS menyaring baris ini seolah tidak
    // ada -- pesan generik di bawah sengaja tidak mengklaim salah satu.
    throw new Error('Gagal memuat data akun supir Anda. Coba muat ulang halaman atau login ulang; jika masih gagal, hubungi Admin.');
  }

  const masaKerjaBerakhir = apakahMasaKerjaSementaraBerakhir(data?.tipe_supir ?? null, data?.tanggal_selesai_kerja ?? null);

  const statusKedaluwarsa = data?.status_kehadiran_untuk_tanggal !== tanggalAktif;

  if (statusKedaluwarsa) {
    // Reset OTOMATIS oleh sistem (periode berpindah), BUKAN tindakan supir --
    // status_kehadiran_diperbarui_pada sengaja TIDAK ditulis ulang di sini,
    // supaya kartu "Waktu Pengisian" di AbsensiSupir.vue tidak keliru
    // menampilkan jam reset otomatis seolah-olah supir baru saja mengisi.
    await client
      .from('supir')
      .update({ status_kehadiran: 'belum_diisi', status_kehadiran_untuk_tanggal: tanggalAktif })
      .eq('id', supirId);
    return { status: 'belum_diisi', diperbaruiPada: null, tanggalAktif, masaKerjaBerakhir };
  }

  const status = (data?.status_kehadiran as StatusKehadiran) ?? 'belum_diisi';
  return {
    status,
    // 'belum_diisi' berarti belum ada tindakan nyata dari supir utk periode
    // ini -- jam yang tersimpan di kolom (kalau ada) adalah sisa reset
    // otomatis sebelumnya, bukan waktu pengisian sungguhan, jadi diabaikan.
    diperbaruiPada: status === 'belum_diisi' ? null : (data?.status_kehadiran_diperbarui_pada ?? null),
    tanggalAktif,
    masaKerjaBerakhir
  };
}

/**
 * Absensi periode aktif dikunci begitu supir sudah mendapat SATU SAJA
 * penugasan (baris `perjalanan`) untuk tanggal aktif absensi -- tanpa
 * kolom flag terpisah, supaya statusnya tidak pernah bisa "nyangkut" tidak
 * sinkron dengan penugasan asli. Lock ini otomatis lepas lagi setelah
 * periode berpindah ke tanggal aktif berikutnya (lihat
 * hitungTanggalAktifAbsensi() -- berpindah begitu jam 17:00 WIB tanggal
 * aktif saat ini terlewati).
 */
async function hitungTugasUntukTanggalAktif(client: NonNullable<typeof supabase>, supirId: string, tanggalAktif: string): Promise<number> {
  // .neq('status', 'dibatalkan') WAJIB sama dengan filter di ambilTugasHariIni()
  // di bawah -- tanpa ini, penugasan yang sudah dibatalkan Admin (baris
  // `perjalanan` tidak dihapus, cuma statusnya diubah jadi 'dibatalkan')
  // tetap terhitung sebagai "sudah dapat tugas" dan mengunci absensi
  // selamanya, padahal halaman "Tugas Hari Ini" sudah benar menampilkan
  // kosong untuk baris yang sama.
  const { data, error } = await client
    .from('perjalanan')
    .select('id, anak_id, anak(aktif)')
    .eq('supir_id', supirId)
    .eq('tanggal_perjalanan', tanggalAktif)
    .neq('status', 'dibatalkan');
  if (error) throw error;

  // Saring anak yang sudah tidak aktif ATAU langganannya belum lunas/sudah
  // kedaluwarsa -- WAJIB sama persis dengan penyaringan di
  // ambilTugasHariIni() (bawah) dan ambilPenugasanHariIni() (adminLayanan.ts).
  // Tanpa ini, baris `perjalanan` "yatim" yang terlanjur ada sebelum anaknya
  // dinonaktifkan/langganannya berakhir tetap terhitung "sudah dapat tugas"
  // dan mengunci absensi selamanya -- padahal halaman "Tugas Hari Ini" dan
  // Penugasan Admin sudah benar-benar menyembunyikannya sebagai kosong,
  // sehingga supir terjebak "terkunci" tanpa tugas yang benar-benar terlihat
  // di mana pun.
  const barisMentah = (data ?? []) as any[];
  const anakAktifMentah = barisMentah.filter((p) => p.anak?.aktif === true);
  const anakIds = Array.from(new Set(anakAktifMentah.map((p) => p.anak_id)));
  const anakIdBerlangganan = await ambilAnakIdBerlanggananAktif(client, anakIds, tanggalAktif);
  return anakAktifMentah.filter((p) => anakIdBerlangganan.has(p.anak_id)).length;
}

export async function ambilStatusKehadiran(): Promise<StatusKehadiran> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { status } = await bacaStatusKehadiranTerkini(client, supirId);
  return status;
}

/**
 * Akun supir yang dinonaktifkan Admin (togglAktifSupir() di adminLayanan.ts)
 * cuma boleh mengakses menu "Profil Saya" -- lihat gerbang tabAktif di
 * HalamanSupir.vue. Dicek terpisah dari ambilProfilSupirLengkap() (bukan
 * ditambahkan ke situ) supaya HalamanSupir.vue bisa tahu status ini SEBELUM
 * memutuskan komponen tab mana yang boleh dirender, tanpa perlu memuat
 * seluruh data profil (dokumen, rating, dst) lebih dulu.
 */
export async function ambilStatusAktifSupir(): Promise<boolean> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { data, error } = await client.from('supir').select('aktif').eq('id', supirId).maybeSingle();
  if (error) throw error;
  if (!data) {
    // Baris tidak kembali bisa berarti dua hal yang tidak bisa dibedakan dari
    // sisi klien: (1) baris `supir` memang belum/tidak ada, ATAU (2) sesi
    // login sedang tidak valid sehingga RLS menyaring baris ini seolah tidak
    // ada -- pesan generik di bawah sengaja tidak mengklaim salah satu.
    throw new Error('Gagal memuat data akun supir Anda. Coba muat ulang halaman atau login ulang; jika masih gagal, hubungi Admin.');
  }
  return data.aktif !== false;
}

export interface RingkasanAbsensiHarian {
  status: StatusKehadiran;
  diperbaruiPada: string | null;
  tanggalAktif: string;
  sudahDapatTugas: boolean;
  // Terkunci karena sudah ada penugasan Admin utk periode aktif.
  terkunci: boolean;
  // Terkunci karena akun supir SEMENTARA ini rentang tanggal kerjanya
  // (tanggal_selesai_kerja) sudah lewat -- menu/halaman absensi tetap bisa
  // dibuka & dilihat, hanya tombol aksinya yang dikunci. Lihat
  // apakahMasaKerjaSementaraBerakhir() di atas.
  masaKerjaBerakhir: boolean;
}

export async function ambilRingkasanAbsensiHarian(): Promise<RingkasanAbsensiHarian> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { status, diperbaruiPada, tanggalAktif, masaKerjaBerakhir } = await bacaStatusKehadiranTerkini(client, supirId);
  const jumlahTugas = await hitungTugasUntukTanggalAktif(client, supirId, tanggalAktif);

  return {
    status,
    diperbaruiPada,
    tanggalAktif,
    sudahDapatTugas: jumlahTugas > 0,
    terkunci: jumlahTugas > 0,
    masaKerjaBerakhir
  };
}

export async function perbaruiStatusKehadiran(status: StatusKehadiran): Promise<void> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const tanggalAktif = await ambilTanggalAktifAbsensi();

  const { masaKerjaBerakhir } = await bacaStatusKehadiranTerkini(client, supirId);
  if (masaKerjaBerakhir) {
    throw new Error('Masa kerja Anda sebagai supir sementara sudah berakhir, absensi tidak dapat diubah lagi.');
  }

  const jumlahTugas = await hitungTugasUntukTanggalAktif(client, supirId, tanggalAktif);
  if (jumlahTugas > 0) {
    throw new Error(
      'Status kehadiran terkunci karena Anda sudah mendapatkan penugasan untuk periode absensi ini. Perubahan baru bisa dilakukan lagi setelah tanggal aktif berpindah (pukul 17:00 WIB).'
    );
  }

  const { error } = await client
    .from('supir')
    .update({ status_kehadiran: status, status_kehadiran_diperbarui_pada: new Date().toISOString(), status_kehadiran_untuk_tanggal: tanggalAktif })
    .eq('id', supirId);
  if (error) throw error;
}

// ==========================================
// UC-S02: Lihat Daftar Tugas
// ==========================================

export interface TugasAnakSupir {
  perjalananId: string;
  anakId: string;
  nama: string;
  kelas: string;
  foto: string | null;
  sekolah: string;
  lintangSekolah: number;
  bujurSekolah: number;
  jenisPerjalanan: 'pagi' | 'sore';
  status: StatusPerjalanan;
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  alamatAntar: string;
  lintangAntar: number;
  bujurAntar: number;
  diselesaikanPada: string | null;
  // true kalau orang tua mengubah alamat jemput/antar SETELAH penugasan ini
  // dibuat (lihat perbaruiAlamatAnak, orangTuaLayanan.ts) -- penugasan tetap
  // sama, cuma titik lokasinya perlu diperhatikan (sudah beda dari sebelumnya).
  alamatDiperbarui: boolean;
  // Terisi ("HH:MM") kalau anak ini punya pengajuan_perubahan_jadwal yang
  // 'disetujui' untuk tanggal & sesi (pagi->pergi, sore->pulang) yang sama --
  // dipakai memisahkan anak ini dari rute/estimasi waktu utama (mereka
  // dijemput/diantar di jam BERBEDA, tidak boleh dicampur dalam satu
  // perhitungan rute optimal bersama anak berjadwal normal). null = jadwal
  // normal, ikut rute utama seperti biasa.
  waktuKhusus: string | null;
}

const DUA_JAM_MS = 2 * 60 * 60 * 1000;

/**
 * Status "Sampai Tujuan" (tiba) hanya disimpan 2 jam sejak waktu_antar --
 * setelah itu direset otomatis ke 'dijadwalkan' (Sedang di Rumah), lazy-check
 * saat daftar tugas dibaca (tidak ada cron/server di proyek ini).
 * Baris yang sudah ditandai selesai (diselesaikan_pada terisi) dikecualikan --
 * baris itu terkunci permanen dan trigger DB akan menolak update ini.
 *
 * HANYA berlaku utk sesi SORE -- label reset-nya ("Sedang di Rumah")
 * memang mendeskripsikan kepulangan sore. Sesi PAGI sengaja DIKECUALIKAN:
 * 'tiba' di pagi berarti anak sudah diserahterimakan ke sekolah, itu
 * kejadian FINAL utk hari itu -- me-reset paksa balik ke 'dijadwalkan'
 * ("Sedang di Rumah") 2 jam kemudian salah secara semantik (anak jelas
 * TIDAK "kembali ke rumah" begitu saja) dan menimbulkan bug nyata:
 * "Sesi Jemputan Pagi" di DashboardSupir.vue tampak PERMANEN "Belum
 * Selesai" walau supir sudah menandai semua anak 'tiba' di sekolah,
 * hanya karena supir belum sempat/lupa menekan tombol terpisah "Tandai
 * Tugas Hari Ini Telah Selesai" dalam 2 jam.
 */
async function resetStatusTibaKedaluwarsa(client: NonNullable<typeof supabase>, rows: any[]): Promise<void> {
  const sekarang = Date.now();
  const kedaluwarsa = rows.filter(
    (p) =>
      p.jenis_perjalanan === 'sore' &&
      p.status === 'tiba' &&
      p.waktu_antar &&
      !p.diselesaikan_pada &&
      sekarang - new Date(p.waktu_antar).getTime() > DUA_JAM_MS
  );
  if (kedaluwarsa.length === 0) return;

  const ids = kedaluwarsa.map((p) => p.id);
  await client.from('perjalanan').update({ status: 'dijadwalkan', waktu_jemput: null, waktu_antar: null }).in('id', ids);
  await client.from('log_status_perjalanan').insert(
    ids.map((id) => ({ perjalanan_id: id, status: 'dijadwalkan', catatan: 'Reset otomatis setelah 2 jam status Sampai Tujuan' }))
  );

  for (const p of kedaluwarsa) {
    p.status = 'dijadwalkan';
  }
}

export async function ambilTugasHariIni(tanggal: string): Promise<TugasAnakSupir[]> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { data, error } = await client
    .from('perjalanan')
    .select(`
      id, jenis_perjalanan, status, waktu_antar, diselesaikan_pada, alamat_diperbarui_pada,
      anak (
        id, nama_lengkap, kelas, url_foto, aktif,
        alamat_jemput, lintang_jemput, bujur_jemput,
        alamat_antar, lintang_antar, bujur_antar,
        sekolah ( nama, lintang, bujur )
      )
    `)
    .eq('supir_id', supirId)
    .eq('tanggal_perjalanan', tanggal)
    // Admin "menghapus" penugasan (batalkanPenugasan di adminLayanan.ts)
    // sebenarnya cuma soft-cancel (UPDATE status='dibatalkan'), bukan DELETE
    // baris -- tanpa filter ini, tugas yang sudah dibatalkan Admin tetap
    // muncul di dashboard Supir walau sudah hilang dari daftar Admin
    // (ambilPenugasanHariIni sudah menyaring status ini, tapi query ini
    // sebelumnya tidak, sehingga kedua sisi tidak sinkron).
    .neq('status', 'dibatalkan');
  if (error) throw error;

  const daftar = (data ?? []) as any[];
  await resetStatusTibaKedaluwarsa(client, daftar);

  // Baris perjalanan bisa saja sudah terlanjur dibuat SEBELUM anak dihapus
  // (anak.aktif=false) atau SEBELUM langganannya kedaluwarsa/belum lunas --
  // buatPenugasan() di adminLayanan.ts sudah mencegah baris BARU terbuat
  // untuk kondisi begini, tapi baris LAMA yang sudah ada tetap harus
  // disaring lagi di sini supaya anak yang sudah tidak aktif/tidak
  // berlangganan tidak pernah tampil di daftar tugas supir, terlepas kapan
  // baris perjalanan-nya dibuat.
  const anakAktifList = daftar.filter((p: any) => p.anak?.aktif === true);
  const anakIds = Array.from(new Set(anakAktifList.map((p: any) => p.anak.id)));
  const anakIdBerlangganan = await ambilAnakIdBerlanggananAktif(client, anakIds, tanggal);

  // Anak dengan pengajuan_perubahan_jadwal 'disetujui' utk tanggal & sesi
  // yang sama HARUS dipisahkan dari rute utama (waktu jemput/antarnya
  // beda, tidak boleh ikut dihitung dalam satu rute optimal bersama anak
  // berjadwal normal) -- lihat waktuKhusus di TugasAnakSupir. jenis_perubahan
  // 'pergi' <-> sesi 'pagi', 'pulang' <-> sesi 'sore' (sama seperti
  // ajukanPerubahanJadwal, orangTuaLayanan.ts).
  const waktuKhususByAnakSesi = new Map<string, string>();
  if (anakIds.length > 0) {
    const { data: pengajuanList } = await client
      .from('pengajuan_perubahan_jadwal')
      .select('anak_id, jenis_perubahan, waktu_baru')
      .in('anak_id', anakIds)
      .eq('tanggal', tanggal)
      .eq('status', 'disetujui');
    for (const pj of (pengajuanList ?? []) as any[]) {
      const sesi = pj.jenis_perubahan === 'pergi' ? 'pagi' : 'sore';
      waktuKhususByAnakSesi.set(`${pj.anak_id}|${sesi}`, String(pj.waktu_baru).slice(0, 5));
    }
  }

  return anakAktifList
    .filter((p: any) => anakIdBerlangganan.has(p.anak.id))
    .map((p: any) => ({
      perjalananId: p.id,
      anakId: p.anak.id,
      nama: p.anak.nama_lengkap,
      kelas: p.anak.kelas,
      foto: p.anak.url_foto,
      sekolah: p.anak.sekolah?.nama ?? '-',
      lintangSekolah: p.anak.sekolah?.lintang ?? -0.9320,
      bujurSekolah: p.anak.sekolah?.bujur ?? 100.3800,
      jenisPerjalanan: p.jenis_perjalanan,
      status: p.status,
      alamatJemput: p.anak.alamat_jemput,
      lintangJemput: p.anak.lintang_jemput,
      bujurJemput: p.anak.bujur_jemput,
      alamatAntar: p.anak.alamat_antar,
      lintangAntar: p.anak.lintang_antar,
      bujurAntar: p.anak.bujur_antar,
      diselesaikanPada: p.diselesaikan_pada,
      alamatDiperbarui: !!p.alamat_diperbarui_pada,
      waktuKhusus: waktuKhususByAnakSesi.get(`${p.anak.id}|${p.jenis_perjalanan}`) ?? null
    }));
}

/**
 * UC-S03 (tombol "Tandai Tugas Hari Ini Telah Selesai"): mengunci satu
 * kelompok rute (semua perjalanan pada sesi + sekolah yang sedang
 * ditampilkan) supaya tidak bisa diubah lagi. Trigger `trg_jaga_penyelesaian_perjalanan`
 * di database menolak permintaan ini kalau ada baris yang belum berstatus
 * 'tiba', jadi validasi di UI hanyalah lapisan pertama (UX), bukan satu-satunya.
 */
export async function selesaikanRuteHariIni(perjalananIds: string[]): Promise<void> {
  if (perjalananIds.length === 0) return;
  const client = klienWajibAda();
  const { error } = await client
    .from('perjalanan')
    .update({ diselesaikan_pada: new Date().toISOString() })
    .in('id', perjalananIds);
  if (error) throw error;
}

// ==========================================
// UC-S03: Update Status Perjalanan
// ==========================================

export async function perbaruiStatusPerjalanan(perjalananId: string, statusBaru: StatusPerjalanan): Promise<void> {
  const client = klienWajibAda();
  const perubahan: Record<string, any> = { status: statusBaru };

  // waktu_jemput merekam titik KEBERANGKATAN armada dari checkpoint asalnya
  // -- utk sesi pagi itu status "Penjemputan" (armada baru berangkat dari
  // rumah menuju rumah anak), BUKAN "Menuju Sekolah" (anak sudah naik).
  // Sebelumnya dipicu oleh 'menuju_sekolah', sehingga jam "Penjemputan
  // Armada (Pagi)" di GarisWaktuPerjalanan.vue keliru merekam momen anak
  // SUDAH dijemput, bukan momen armada berangkat -- kalau supir mengubah
  // status berturut-turut dengan cepat, jam checkpoint ini jadi terlihat
  // sama dengan jam "Tiba di Sekolah" (waktu_antar). Utk sesi sore,
  // "Pengantaran Pulang" tetap seperti semula.
  if (statusBaru === 'penjemputan' || statusBaru === 'pengantaran') {
    perubahan.waktu_jemput = new Date().toISOString();
  } else if (statusBaru === 'di_sekolah' || statusBaru === 'tiba') {
    perubahan.waktu_antar = new Date().toISOString();
  } else if (statusBaru === 'dijadwalkan') {
    perubahan.waktu_jemput = null;
    perubahan.waktu_antar = null;
  }

  // `.select('id')` WAJIB ada di sini -- lihat catatan yang sama di
  // hapusCuti()/hapusPengajuanPerubahanJadwal() (orangTuaLayanan.ts) soal
  // RLS yang gagal senyap pada UPDATE/DELETE: Supabase TIDAK melempar error
  // kalau kebijakan RLS ("Perjalanan: Supir memperbarui status perjalanan
  // miliknya", supir_id = auth.uid()) menolak/tidak mencocokkan baris apa
  // pun -- update-nya cuma diam-diam mengubah 0 baris, sedangkan tanpa
  // `.select()` panggilan ini tetap terlihat "sukses" dari sisi supir
  // (padahal status di database sama sekali belum berubah). Sebelumnya
  // bug ini menyebabkan status yang tampil di halaman pengguna terlihat
  // "tidak pernah ter-update", bahkan setelah refresh -- karena datanya
  // sendiri memang tidak pernah tersimpan, bukan soal cache/realtime.
  const { data: barisTerupdate, error: errPerjalanan } = await client
    .from('perjalanan')
    .update(perubahan)
    .eq('id', perjalananId)
    .select('id');
  if (errPerjalanan) throw errPerjalanan;
  if (!barisTerupdate || barisTerupdate.length === 0) {
    throw new Error('Gagal memperbarui status perjalanan -- perjalanan ini mungkin bukan/tidak lagi ditugaskan ke akun Anda. Muat ulang halaman lalu coba lagi.');
  }

  const { error: errLog } = await client
    .from('log_status_perjalanan')
    .insert({ perjalanan_id: perjalananId, status: statusBaru });
  if (errLog) throw errLog;
}

// ==========================================
// UC-S04: Melaporkan Kendala Perjalanan
// ==========================================

export type KategoriKendala = 'kendala_perjalanan' | 'kendala_anak';

export async function laporkanKendala(
  perjalananId: string,
  kategori: KategoriKendala,
  catatan: string,
  anakId?: string
): Promise<void> {
  const client = klienWajibAda();
  // p_dibuat_pada: waktu simulasi klien (BUKAN NOW() server) -- lihat
  // catatan lengkap di migrasi laporkan_kendala_perjalanan() (skema_database.sql),
  // supaya kolom WAKTU di tabel "Laporan Kendala" (LaporanAdmin.vue) ikut
  // "Waktu Disimulasikan" seperti bagian lain aplikasi ini.
  const { error } = await client.rpc('laporkan_kendala_perjalanan', {
    p_perjalanan_id: perjalananId,
    p_kategori: kategori,
    p_catatan: catatan,
    p_anak_id: anakId ?? null,
    p_dibuat_pada: ambilWaktuSekarang().toISOString()
  });
  if (error) throw error;
}

export interface LaporanKendalaSupir {
  id: string;
  kategori: KategoriKendala;
  deskripsi: string;
  status: 'baru' | 'ditindak' | 'selesai';
  dibuatPada: string;
  diperbaruiPada: string | null;
  namaAnak: string | null;
  jenisPerjalanan: 'pagi' | 'sore' | null;
  tanggalPerjalanan: string | null;
}

/** Daftar laporan kendala milik supir yang sedang login sendiri (bukan punya supir lain). */
export async function ambilLaporanKendalaSupir(): Promise<LaporanKendalaSupir[]> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { data, error } = await client
    .from('laporan_kendala')
    .select('id, kategori, deskripsi, status, dibuat_pada, diperbarui_pada, anak(nama_lengkap), perjalanan(jenis_perjalanan, tanggal_perjalanan)')
    .eq('supir_id', supirId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as any[]).map((l) => ({
    id: l.id,
    kategori: l.kategori,
    deskripsi: l.deskripsi,
    status: l.status,
    dibuatPada: l.dibuat_pada,
    diperbaruiPada: l.diperbarui_pada,
    namaAnak: l.anak?.nama_lengkap ?? null,
    jenisPerjalanan: l.perjalanan?.jenis_perjalanan ?? null,
    tanggalPerjalanan: l.perjalanan?.tanggal_perjalanan ?? null
  }));
}

/**
 * Ubah status laporan kendala MILIK SENDIRI ('baru' -> 'ditindak' ->
 * 'selesai') + catat transisinya ke riwayat_laporan_kendala -- pola sama
 * persis dengan perbaruiStatusLaporanKendala() (adminLayanan.ts), yang
 * sekarang sudah dilepas dari sisi Admin (Admin hanya melihat, read-only).
 * Supir sendiri yang paling tahu kapan kendalanya benar-benar ditindak-
 * lanjuti/selesai (mis. ban bocor sudah diganti), bukan Admin.
 */
export async function perbaruiStatusLaporanKendalaSupir(
  laporanId: string,
  status: 'ditindak' | 'selesai',
  statusSebelum: 'baru' | 'ditindak' | 'selesai',
  catatan?: string | null
): Promise<void> {
  const client = klienWajibAda();
  const supirId = idSupirWajibAda();

  const { data: laporan } = await client
    .from('laporan_kendala')
    .select('kategori, anak_id, perjalanan_id')
    .eq('id', laporanId)
    .maybeSingle();

  const sekarangIso = ambilWaktuSekarang().toISOString();
  const { error } = await client
    .from('laporan_kendala')
    .update({ status, diperbarui_pada: sekarangIso })
    .eq('id', laporanId);
  if (error) throw error;

  const { error: errRiwayat } = await client.from('riwayat_laporan_kendala').insert({
    laporan_id: laporanId,
    status_sebelum: statusSebelum,
    status_sesudah: status,
    catatan: catatan ?? null,
    diubah_oleh: supirId,
    nama_pengubah: null,
    dibuat_pada: sekarangIso
  });
  if (errRiwayat) throw errRiwayat;

  // Beritahu Admin -- supaya tetap tahu perkembangan penanganan kendala
  // meski sekarang bukan lagi pihak yang menandainya. Best-effort.
  try {
    await kirimNotifikasiKeAdmin({
      judul: status === 'ditindak' ? 'Laporan Kendala Ditindak Supir' : 'Laporan Kendala Diselesaikan Supir',
      pesan:
        status === 'ditindak'
          ? 'Supir menandai laporan kendalanya sedang ditindaklanjuti.'
          : 'Supir menandai laporan kendalanya sudah selesai.',
      tipe: 'sistem',
      idTerkait: laporanId,
      tipeTerkait: status === 'ditindak' ? 'kendala_ditindak' : 'kendala_selesai'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi status laporan kendala ke admin:', err);
  }

  // Kendala kategori kendala_anak menyasar satu anak spesifik -- orang tuanya
  // juga menunggu kabar (sudah diberi tahu saat laporan DIBUAT lewat trigger
  // laporkan_kendala_perjalanan). Best-effort.
  if (laporan?.kategori === 'kendala_anak' && laporan.anak_id) {
    try {
      const { data: anak } = await client.from('anak').select('orang_tua_id, nama_lengkap').eq('id', laporan.anak_id).maybeSingle();
      if (anak?.orang_tua_id) {
        await kirimNotifikasi({
          penggunaId: anak.orang_tua_id,
          judul: status === 'ditindak' ? 'Laporan Kendala Sedang Ditindak' : 'Laporan Kendala Selesai',
          pesan:
            status === 'ditindak'
              ? `Laporan kendala terkait ${anak.nama_lengkap} sedang ditindaklanjuti supir.`
              : `Laporan kendala terkait ${anak.nama_lengkap} sudah diselesaikan supir.`,
          tipe: 'sistem',
          idTerkait: laporanId,
          tipeTerkait: status === 'ditindak' ? 'kendala_ditindak' : 'kendala_selesai'
        });
      }
    } catch (err) {
      console.error('Gagal kirim notifikasi status laporan kendala ke orang tua:', err);
    }
  }

  // Kendala kategori kendala_perjalanan berdampak ke SEMUA anak dalam rute
  // supir pada tanggal yang sama (bukan cuma satu anak acuan) -- samakan
  // cakupan penerima dengan notifikasi saat laporan DIBUAT (lihat
  // laporkan_kendala_perjalanan di skema_database.sql) dan visibilitas RLS
  // "Orang tua melihat laporan kendala terkait anaknya". Best-effort.
  if (laporan?.kategori === 'kendala_perjalanan' && laporan.perjalanan_id) {
    try {
      const { data: perjalananAcuan } = await client
        .from('perjalanan')
        .select('supir_id, tanggal_perjalanan')
        .eq('id', laporan.perjalanan_id)
        .maybeSingle();
      if (perjalananAcuan?.supir_id) {
        const { data: perjalananRute } = await client
          .from('perjalanan')
          .select('anak(orang_tua_id)')
          .eq('supir_id', perjalananAcuan.supir_id)
          .eq('tanggal_perjalanan', perjalananAcuan.tanggal_perjalanan);
        const orangTuaIdUnik = Array.from(
          new Set(
            ((perjalananRute ?? []) as any[])
              .map((p) => p.anak?.orang_tua_id)
              .filter((id): id is string => !!id)
          )
        );
        await Promise.all(
          orangTuaIdUnik.map((penggunaId) =>
            kirimNotifikasi({
              penggunaId,
              judul: status === 'ditindak' ? 'Laporan Kendala Sedang Ditindak' : 'Laporan Kendala Selesai',
              pesan:
                status === 'ditindak'
                  ? 'Kendala perjalanan pada rute anak Anda sedang ditindaklanjuti supir.'
                  : 'Kendala perjalanan pada rute anak Anda sudah diselesaikan supir.',
              tipe: 'sistem',
              idTerkait: laporanId,
              tipeTerkait: status === 'ditindak' ? 'kendala_ditindak' : 'kendala_selesai'
            })
          )
        );
      }
    } catch (err) {
      console.error('Gagal kirim notifikasi status laporan kendala perjalanan ke orang tua:', err);
    }
  }
}

/**
 * Hapus laporan kendala MILIK SENDIRI dari daftar "Laporan Kendala Saya"
 * (RiwayatSupir.vue) -- murni membersihkan tampilan riwayat supir, TIDAK
 * mengirim notifikasi apa pun (beda dari perbaruiStatusLaporanKendalaSupir).
 * `riwayat_laporan_kendala` ikut terhapus otomatis lewat ON DELETE CASCADE
 * (skema_database.sql). RLS memastikan hanya baris supir_id = auth.uid()
 * yang bisa dihapus -- lihat migrasi "SUPIR MENGHAPUS LAPORAN KENDALA
 * MILIKNYA SENDIRI" di skema_database.sql.
 */
export async function hapusLaporanKendalaSupir(laporanId: string): Promise<void> {
  const client = klienWajibAda();
  // `.select('id')` WAJIB ada -- RLS yang menolak DELETE tidak melempar
  // error, cuma diam-diam menghapus 0 baris (pola sama seperti catatan di
  // perbaruiStatusPerjalanan, supirLayanan.ts).
  const { data: barisTerhapus, error } = await client.from('laporan_kendala').delete().eq('id', laporanId).select('id');
  if (error) throw error;
  if (!barisTerhapus || barisTerhapus.length === 0) {
    throw new Error('Gagal menghapus laporan -- laporan ini mungkin bukan milik akun Anda.');
  }
}

// ==========================================
// UC-S05: Lihat Riwayat Perjalanan
// ==========================================

export interface RiwayatPerjalananSupir {
  tanggal: string;
  anak: string;
  sekolah: string;
  jenisPerjalanan: 'pagi' | 'sore';
  status: StatusPerjalanan;
  jarakKm: number;
  waktuJemput: string | null;
  waktuAntar: string | null;
}

export async function ambilRiwayatPerjalanan(filterTanggal?: string): Promise<RiwayatPerjalananSupir[]> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  let query = client
    .from('perjalanan')
    .select('tanggal_perjalanan, jenis_perjalanan, status, jarak_km, waktu_jemput, waktu_antar, anak ( nama_lengkap, sekolah ( nama ) )')
    .eq('supir_id', supirId)
    .in('status', ['tiba', 'dibatalkan'])
    .order('tanggal_perjalanan', { ascending: false });

  if (filterTanggal) {
    query = query.eq('tanggal_perjalanan', filterTanggal);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    tanggal: p.tanggal_perjalanan,
    anak: p.anak?.nama_lengkap ?? '-',
    sekolah: p.anak?.sekolah?.nama ?? '-',
    jenisPerjalanan: p.jenis_perjalanan,
    status: p.status,
    jarakKm: p.jarak_km ?? 0,
    waktuJemput: p.waktu_jemput,
    waktuAntar: p.waktu_antar
  }));
}

// ==========================================
// UC-S06: Edit Profil (Data Pribadi + Kendaraan)
// ==========================================

export interface ProfilSupirLengkap {
  namaLengkap: string;
  email: string;
  nomorTelepon: string | null;
  jenisKendaraan: string;
  nomorPlat: string;
  tipeSupir: 'tetap' | 'sementara';
  statusVerifikasi: 'menunggu' | 'terverifikasi' | 'ditolak';
  urlKtp: string | null;
  urlSim: string | null;
  urlStnk: string | null;
}

export async function ambilProfilSupirLengkap(): Promise<ProfilSupirLengkap> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { data, error } = await client
    .from('supir')
    .select('jenis_kendaraan, nomor_plat, tipe_supir, status_verifikasi, url_ktp, url_sim, url_stnk, pengguna ( nama_lengkap, email, nomor_telepon )')
    .eq('id', supirId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Baris tidak kembali bisa berarti dua hal yang tidak bisa dibedakan dari
    // sisi klien: (1) baris `supir` memang belum/tidak ada, ATAU (2) sesi
    // login sedang tidak valid sehingga RLS menyaring baris ini seolah tidak
    // ada -- pesan generik di bawah sengaja tidak mengklaim salah satu.
    throw new Error('Gagal memuat data akun supir Anda. Coba muat ulang halaman atau login ulang; jika masih gagal, hubungi Admin.');
  }

  const p: any = data;
  return {
    namaLengkap: p.pengguna?.nama_lengkap ?? '-',
    email: p.pengguna?.email ?? '-',
    nomorTelepon: p.pengguna?.nomor_telepon ?? null,
    jenisKendaraan: p.jenis_kendaraan,
    nomorPlat: p.nomor_plat,
    tipeSupir: p.tipe_supir,
    statusVerifikasi: p.status_verifikasi,
    urlKtp: p.url_ktp,
    urlSim: p.url_sim,
    urlStnk: p.url_stnk
  };
}

export interface PerubahanProfilSupir {
  namaLengkap: string;
  nomorTelepon: string;
  jenisKendaraan: string;
  nomorPlat: string;
  fotoProfil?: string;
}

/**
 * Live Tracking GPS: menulis posisi device supir saat ini ke kolom
 * lintang_terkini/bujur_terkini. Dipanggil berkala oleh useLokasiSupir.ts
 * (composable yang membungkus navigator.geolocation.watchPosition) --
 * begitu baris ini ter-UPDATE, Supabase Realtime (lihat pantauSupirRealtime
 * di realtimeLayanan.ts, tabel `supir` WAJIB terdaftar ke publication
 * supabase_realtime, lihat tambah_supir_ke_realtime.sql) langsung
 * menyiarkannya ke peta lokasi langsung di dashboard Orang Tua.
 */
export async function perbaruiLokasiSupir(lintang: number, bujur: number): Promise<void> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();

  const { error } = await client
    .from('supir')
    .update({ lintang_terkini: lintang, bujur_terkini: bujur })
    .eq('id', supirId);
  if (error) throw error;
}

/**
 * Live Tracking GPS: menandai supir "sedang bertugas" (true sejak "Mulai
 * Bertugas" ditekan, false setelah seluruh tugas sesi itu selesai atau
 * supir menandai diri "Tidak Bertugas") -- inilah syarat yang dibaca
 * ambilPosisiSupirAktif() di adminLayanan.ts untuk menampilkan marker
 * supir di peta Pemantauan Global Admin. Terpisah dari `tersedia` (itu
 * cerminan status_kehadiran/absensi harian untuk kelayakan penugasan,
 * bukan untuk kapan marker peta muncul).
 */
export async function perbaruiStatusBertugas(sedangBertugas: boolean): Promise<void> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();

  // sedang_bertugas_diaktifkan_pada dicatat HANYA saat diaktifkan (true) --
  // dibaca ambilPosisiSupirAktif()/orangTuaLayanan.ts untuk memastikan
  // marker peta otomatis dianggap tidak aktif lagi begitu tanggal WIB
  // berganti, sekalipun supir lupa/tidak sempat menandai tugasnya selesai.
  // Pakai ambilWaktuSekarang() (BUKAN new Date() polos) supaya konsisten
  // ikut waktu simulasi kalau sedang dipakai demo.
  const payload: { sedang_bertugas: boolean; sedang_bertugas_diaktifkan_pada?: string } = {
    sedang_bertugas: sedangBertugas
  };
  if (sedangBertugas) {
    payload.sedang_bertugas_diaktifkan_pada = ambilWaktuSekarang().toISOString();
  }

  const { error } = await client
    .from('supir')
    .update(payload)
    .eq('id', supirId);
  if (error) throw error;
}

export async function perbaruiProfilSupir(data: PerubahanProfilSupir): Promise<void> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();

  const payloadPengguna: Record<string, unknown> = {
    nama_lengkap: data.namaLengkap,
    nomor_telepon: data.nomorTelepon
  };
  if (data.fotoProfil) payloadPengguna.foto_profil = data.fotoProfil;

  const [resPengguna, resSupir] = await Promise.all([
    client.from('pengguna').update(payloadPengguna).eq('id', supirId),
    client.from('supir').update({ jenis_kendaraan: data.jenisKendaraan, nomor_plat: data.nomorPlat }).eq('id', supirId)
  ]);
  if (resPengguna.error) throw resPengguna.error;
  if (resSupir.error) throw resSupir.error;
}

/**
 * Unggah foto profil supir (OPSIONAL) -- pola identik dengan
 * unggahFotoProfil di orangTuaLayanan.ts (kompresi via kompresiGambar, lalu
 * upload ke bucket 'profile-images' path `{userId}/foto-{timestamp}.jpg`).
 * Suffix timestamp WAJIB -- lihat catatan lengkap di unggahFotoProfil()
 * (orangTuaLayanan.ts): nama file tetap bikin browser terus menampilkan
 * foto lama dari cache walau upload baru sudah berhasil. Sengaja
 * diduplikasi di sini (bukan diimpor lintas domain dari orangTuaLayanan.ts)
 * mengikuti pola "satu file per domain" proyek ini -- fungsi generiknya
 * identik utk semua peran karena cuma keyed oleh user id, bukan peran.
 */
export async function unggahFotoProfilSupir(supirId: string, file: File): Promise<string> {
  const client = klienWajibAda();

  const base64Kecil = await kompresiGambar(file);
  const blob = konversiBase64KeBlob(base64Kecil);
  const pathFile = `${supirId}/foto-${Date.now()}.jpg`;

  const { error: uploadErr } = await client.storage
    .from('profile-images')
    .upload(pathFile, blob, { cacheControl: '3600', contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    const pesan = (uploadErr.message || '').toLowerCase();
    if (pesan.includes('bucket not found') || pesan.includes('does not exist')) {
      throw new Error('Bucket penyimpanan "profile-images" belum dibuat di Supabase Storage. Harap buat bucket publik bernama "profile-images" terlebih dahulu.');
    }
    if (pesan.includes('row-level security') || pesan.includes('permission') || pesan.includes('policy')) {
      throw new Error('Tidak memiliki izin untuk mengunggah foto profil (kebijakan storage RLS membatasi akses).');
    }
    throw new Error(`Gagal mengunggah foto profil: ${uploadErr.message}`);
  }

  const { data: dataUrl } = client.storage.from('profile-images').getPublicUrl(pathFile);
  if (!dataUrl?.publicUrl) throw new Error('Gagal mendapatkan URL publik untuk foto profil yang diunggah.');
  return dataUrl.publicUrl;
}

/**
 * Edit Dokumen Legalitas (UC-S06, alur re-verifikasi): supir mengunggah
 * ulang KTP/SIM/STNK miliknya sendiri. Trigger `trg_jaga_status_verifikasi_supir`
 * di database otomatis mengubah status_verifikasi baris supir ini menjadi
 * 'menunggu' begitu salah satu URL dokumen berubah -- tidak perlu di-set
 * manual dari klien. Kalau status saat ini masih 'menunggu' (dokumen
 * sebelumnya belum diputuskan Admin), kebijakan RLS storage akan menolak
 * upload ini dan melempar error yang diterjemahkan di bawah.
 */
export type JenisDokumenLegalitas = 'ktp' | 'sim' | 'stnk';

export async function unggahDokumenLegalitas(jenis: JenisDokumenLegalitas, file: File): Promise<void> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();

  const ekstensi = file.name.split('.').pop() || 'jpg';
  const pathFile = `${supirId}/${jenis}.${ekstensi}`;

  const { error: errUpload } = await client.storage
    .from('dokumen-supir')
    .upload(pathFile, file, { cacheControl: '3600', upsert: true });
  if (errUpload) {
    // Kebijakan storage TIDAK LAGI membatasi upload berdasar status_verifikasi
    // (lihat migrasi "SUPIR BOLEH GANTI DOKUMEN LEGALITAS KAPAN SAJA" di
    // skema_database.sql) -- supir boleh mengganti dokumen kapan saja,
    // termasuk selagi pengajuan sebelumnya masih 'menunggu'. Kalau tetap
    // ada error RLS/policy di sini, penyebabnya bukan lagi status
    // verifikasi (mis. folder path tidak cocok auth.uid()), jadi pesannya
    // tidak lagi mengklaim alasan yang sudah tidak berlaku.
    throw new Error(`Gagal mengunggah dokumen: ${errUpload.message}`);
  }

  const { data: dataUrl } = client.storage.from('dokumen-supir').getPublicUrl(pathFile);
  const kolom = jenis === 'ktp' ? 'url_ktp' : jenis === 'sim' ? 'url_sim' : 'url_stnk';

  // Query param `?v=` (timestamp) WAJIB ditempel -- path file deterministik
  // ("{supirId}/{jenis}.{ekstensi}") berarti getPublicUrl() menghasilkan
  // string IDENTIK setiap kali dokumen jenis yang sama diganti (selama
  // ekstensinya sama), walau isi filenya sudah ditimpa (upsert) di storage.
  // Trigger trg_jaga_status_verifikasi_supir (skema_database.sql) mendeteksi
  // "dokumen berubah" murni dari NEW.url_ktp IS DISTINCT FROM OLD.url_ktp --
  // tanpa pembeda ini, UPDATE dengan nilai yang SAMA PERSIS membuat trigger
  // menganggap tidak ada perubahan sama sekali, sehingga status_verifikasi
  // tidak pernah berpindah ke 'menunggu' walau dokumennya sungguhan sudah
  // diganti. Bonus: juga mencegah browser menampilkan gambar lama dari cache
  // di tautan "Lihat" (URL lama & baru sekarang selalu beda).
  const urlDenganVersi = `${dataUrl.publicUrl}?v=${Date.now()}`;

  // status_verifikasi: 'menunggu' diset EKSPLISIT di sini (bukan cuma
  // mengandalkan trigger trg_jaga_status_verifikasi_supir di database) --
  // jaring pengaman kalau migrasi trigger itu ternyata belum/tidak sempat
  // dijalankan di database, perubahan status tetap pasti terjadi dari sisi
  // client. Aman dilakukan di sini (bukan di unggahDokumenSupir()/adminLayanan.ts)
  // karena fungsi ini KHUSUS dipanggil supir mengunggah dokumennya SENDIRI --
  // upload oleh admin tidak boleh ikut memicu status 'menunggu'.
  // `.select()` WAJIB ada di sini -- lihat catatan yang sama di
  // hapusCuti()/perbaruiStatusPerjalanan() soal RLS yang gagal senyap:
  // Supabase TIDAK melempar error kalau kebijakan RLS menolak/tidak
  // mencocokkan baris apa pun, update-nya cuma diam-diam mengubah 0 baris.
  const { data: barisTerupdate, error: errUpdate } = await client
    .from('supir')
    .update({ [kolom]: urlDenganVersi, status_verifikasi: 'menunggu' })
    .eq('id', supirId)
    .select('id, status_verifikasi');
  if (errUpdate) throw errUpdate;
  if (!barisTerupdate || barisTerupdate.length === 0) {
    throw new Error('Dokumen berhasil diunggah ke penyimpanan, tapi gagal memperbarui data di database (0 baris berubah). Coba muat ulang halaman.');
  }

  // Beri tahu Admin bahwa ada dokumen baru yang perlu diperiksa/diverifikasi
  // -- SEBELUMNYA tidak ada sama sekali, Admin cuma bisa tahu lewat cek
  // manual berkala di menu Data Supir. Best-effort: kegagalan kirim
  // notifikasi tidak boleh membuat upload dokumen yang sudah berhasil
  // tersimpan di atas gagal dilaporkan berhasil.
  try {
    const { userProfile } = useAuth();
    const namaSupir = userProfile.value?.nama ?? 'Seorang supir';
    const labelJenis = jenis === 'ktp' ? 'KTP' : jenis === 'sim' ? 'SIM' : 'STNK';
    await kirimNotifikasiKeAdmin({
      judul: 'Pengajuan Verifikasi Dokumen Supir',
      pesan: `${namaSupir} mengunggah/mengubah dokumen ${labelJenis}. Silakan lakukan pemeriksaan dan verifikasi dokumen.`,
      tipe: 'sistem',
      idTerkait: supirId,
      tipeTerkait: 'verifikasi_supir'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi pengajuan verifikasi dokumen supir:', err);
  }
}

// ==========================================
// UC-P12 (sisi Supir): Melihat Rating & Ulasan Diri
// ==========================================

export interface UlasanSupir {
  bintang: number;
  komentar: string | null;
}

export interface RingkasanRatingSupir {
  rataRating: number;
  jumlahUlasan: number;
  ulasan: UlasanSupir[];
}

// Ulasan sengaja TIDAK menyertakan identitas pengirim (nama anak/orang tua)
// -- ProfilSupir.vue hanya menampilkan rating rata-rata & jumlah penilaian
// secara anonim, supir tidak perlu tahu siapa yang memberi nilai berapa.
export async function ambilRatingSupir(): Promise<RingkasanRatingSupir> {
  const client = klienWajibAda();
  const supirId = await idSupirWajibAda();
  const { data, error } = await client
    .from('penilaian')
    .select('bintang, komentar, dibuat_pada')
    .eq('supir_id', supirId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  const daftar = (data ?? []) as any[];
  const ulasan: UlasanSupir[] = daftar.map((d) => ({
    bintang: d.bintang,
    komentar: d.komentar
  }));

  const rataRating = daftar.length > 0
    ? Number((daftar.reduce((sum, d) => sum + d.bintang, 0) / daftar.length).toFixed(1))
    : 0;

  return { rataRating, jumlahUlasan: daftar.length, ulasan };
}
