import { supabase } from './supabase';
import type { HariLiburRow } from '../tipe';
import { tanggalLiburKeSet } from '../bantuan/kalenderJadwal';
import { hitungTanggalAktifAbsensi } from '../bantuan/periodeAbsensi';
import { ambilWaktuSekarang } from '../bantuan/waktuSimulasi';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// ==========================================
// Kelola Jadwal (UC-A Admin): kalender hari libur (nasional/cuti
// bersama/libur sekolah/khusus) yang jadi referensi perhitungan hari
// efektif sekolah -- lihat tanggalLiburKeSet() di src/bantuan/kalenderJadwal.ts
// ==========================================

export async function ambilHariLiburRentang(dariTanggal: string, sampaiTanggal: string): Promise<HariLiburRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('hari_libur')
    .select('*')
    .gte('tanggal', dariTanggal)
    .lte('tanggal', sampaiTanggal)
    .order('tanggal', { ascending: true });
  if (error) throw error;
  return (data as HariLiburRow[]) ?? [];
}

// Menghasilkan daftar tanggal ISO ("YYYY-MM-DD") dari tanggalMulai s.d.
// tanggalSelesai inklusif -- dipakai tambahHariLibur() saat admin mengisi
// "Tanggal Berakhir" untuk libur yang berlangsung beberapa hari (mis. cuti
// bersama Lebaran), supaya tidak perlu menambah satu-satu per tanggal.
function rentangTanggalIso(tanggalMulai: string, tanggalSelesai: string): string[] {
  const hasil: string[] = [];
  const mulai = new Date(tanggalMulai + 'T00:00:00');
  const selesai = new Date(tanggalSelesai + 'T00:00:00');
  for (let d = mulai; d <= selesai; d.setDate(d.getDate() + 1)) {
    hasil.push(d.toISOString().slice(0, 10));
  }
  return hasil;
}

export async function tambahHariLibur(params: {
  tanggal: string;
  tanggalSelesai?: string;
  nama: string;
  jenis: HariLiburRow['jenis'];
  sekolahId?: string | null;
  keterangan?: string;
  dibuatOleh?: string;
}): Promise<HariLiburRow[]> {
  const client = klienWajibAda();
  const daftarTanggal =
    params.tanggalSelesai && params.tanggalSelesai > params.tanggal
      ? rentangTanggalIso(params.tanggal, params.tanggalSelesai)
      : [params.tanggal];

  const { data, error } = await client
    .from('hari_libur')
    .insert(
      daftarTanggal.map((tanggal) => ({
        tanggal,
        nama: params.nama,
        jenis: params.jenis,
        sekolah_id: params.sekolahId ?? null,
        keterangan: params.keterangan ?? null,
        dibuat_oleh: params.dibuatOleh ?? null,
        sumber: 'manual'
      }))
    )
    .select('*');
  if (error) throw error;
  return (data as HariLiburRow[]) ?? [];
}

export async function hapusHariLibur(id: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('hari_libur').delete().eq('id', id);
  if (error) throw error;
}

export interface HasilSinkronHariLibur {
  tahunDiproses: number[];
  totalDiperiksa: number;
  totalDitambah: number;
  totalDiperbarui: number;
  totalDilewati: number;
  kegagalanPerTahun?: Record<string, string>;
}

/**
 * Memicu Edge Function `sinkron-hari-libur` (tombol "Sinkronkan dari API"
 * di KelolaJadwalAdmin.vue) -- mengambil kalender hari libur nasional dari
 * API eksternal untuk tahun berjalan + tahun berikutnya, lalu
 * menambah/memperbarui baris `hari_libur` bersumber 'api'. Baris manual
 * Admin (sumber='manual') TIDAK PERNAH disentuh -- lihat catatan lengkap di
 * supabase/functions/sinkron-hari-libur/index.ts.
 */
export async function sinkronkanHariLiburDariApi(): Promise<HasilSinkronHariLibur> {
  const client = klienWajibAda();
  const { data, error } = await client.functions.invoke('sinkron-hari-libur', { body: {} });
  if (error) throw error;
  return data as HasilSinkronHariLibur;
}

/**
 * Varian ASYNC dari hitungTanggalAktifAbsensi() (src/bantuan/periodeAbsensi.ts)
 * yang ikut menyaring tanggal libur/cuti bersama NASIONAL yang ditetapkan
 * Admin (baris hari_libur dengan sekolah_id = NULL -- absensi supir/anak
 * tidak terikat satu sekolah tertentu, jadi hanya libur nasional yang
 * relevan, bukan libur khusus satu sekolah). Dipakai di seluruh tempat yang
 * menghitung "tanggal aktif absensi" dan BISA async (supirLayanan.ts,
 * adminLayanan.ts, komponen Vue via onMounted) -- pemanggil yang benar-benar
 * tidak bisa async boleh tetap memakai versi sinkron tanpa parameter kedua,
 * tapi konsekuensinya cuti bersama Admin tidak ikut tersaring di situ.
 *
 * Jendela pencarian dibatasi 45 hari ke depan dari `acuan` -- cukup lebar
 * utk cuti bersama terpanjang (mis. Lebaran), sekaligus membatasi ukuran
 * query supaya tidak perlu mengambil seluruh isi tabel hari_libur.
 */
export async function ambilTanggalAktifAbsensi(acuan: Date = ambilWaktuSekarang()): Promise<string> {
  const dari = acuan.toISOString().slice(0, 10);
  const sampaiDate = new Date(acuan.getTime() + 45 * 24 * 60 * 60 * 1000);
  const sampai = sampaiDate.toISOString().slice(0, 10);

  let daftarLibur: HariLiburRow[] = [];
  try {
    daftarLibur = await ambilHariLiburRentang(dari, sampai);
  } catch {
    // Kalau gagal memuat (mis. offline), tetap kembalikan hasil versi
    // sinkron (skip Sabtu/Minggu saja) drpd melempar error dan mengunci
    // total fitur absensi.
    return hitungTanggalAktifAbsensi(acuan);
  }

  const tanggalLiburNasional = tanggalLiburKeSet(daftarLibur, null);
  return hitungTanggalAktifAbsensi(acuan, tanggalLiburNasional);
}
