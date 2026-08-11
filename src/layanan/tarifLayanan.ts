import { supabase } from './supabase';
import { bulatkanKeRatusan } from '../bantuan/formatMataUang';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

export interface PengaturanTarifRow {
  id: number;
  tarif_antar_jemput: number;
  tarif_antar_saja: number;
  tarif_jemput_saja: number;
  tarif_per_km: number;
  biaya_minimal_harian: number;
  biaya_minimal_perubahan_jadwal: number;
  jarak_dasar_km: number;
  potongan_hari_pendek_persen: number;
  ambang_hari_pendek: number;
  diperbarui_pada: string;
}

// Dibaca publik (wizard berlangganan & kalkulator estimasi di landing page
// bisa diakses tanpa login) -- lihat kebijakan RLS "Pengaturan Tarif: Siapa
// saja dapat membaca" di skema_database.sql.
export async function ambilPengaturanTarif(): Promise<PengaturanTarifRow> {
  const client = klienWajibAda();
  const { data, error } = await client.from('pengaturan_tarif').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as PengaturanTarifRow;
}

export async function perbaruiPengaturanTarif(
  perubahan: Partial<Omit<PengaturanTarifRow, 'id' | 'diperbarui_pada'>>
): Promise<PengaturanTarifRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengaturan_tarif')
    .update(perubahan)
    .eq('id', 1)
    .select('*')
    .single();
  if (error) throw error;
  return data as PengaturanTarifRow;
}

/**
 * Biaya bulanan flat sesuai jenis layanan. Kalau `jumlahHariAktif` (jumlah
 * tanggal aktif bulan berjalan hasil pemetaan pola hari, lihat "Tentukan
 * jadwal pilihan anda!" di wizard berlangganan) diberikan dan <= ambang_hari_pendek,
 * biaya dipotong potongan_hari_pendek_persen% -- mencerminkan hitung_biaya_bulanan()
 * di SQL (trigger langganan otomatis). Tanpa parameter ini (dipakai kalkulator
 * publik di landing page), biaya tetap flat tanpa diskon.
 */
export function hitungBiayaBulanan(
  tarif: PengaturanTarifRow,
  jenisLayanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja',
  jumlahHariAktif?: number
): number {
  let biaya: number;
  if (jenisLayanan === 'antar_jemput') biaya = tarif.tarif_antar_jemput;
  else if (jenisLayanan === 'antar_saja') biaya = tarif.tarif_antar_saja;
  else biaya = tarif.tarif_jemput_saja;

  if (jumlahHariAktif !== undefined && jumlahHariAktif <= tarif.ambang_hari_pendek) {
    biaya *= 1 - tarif.potongan_hari_pendek_persen / 100;
    // Dibulatkan ke kelipatan Rp100 -- potongan persentase bisa menghasilkan
    // nominal desimal/ganjil (mis. tarif Rp450.000 x diskon 15% = Rp382.500,
    // tapi persentase lain bisa menyisakan satuan aneh).
    biaya = bulatkanKeRatusan(biaya);
  }

  return biaya;
}

export function hitungBiayaHarian(tarif: PengaturanTarifRow, jarakKm: number): number {
  if (jarakKm <= tarif.jarak_dasar_km) return tarif.biaya_minimal_harian;
  return bulatkanKeRatusan(tarif.biaya_minimal_harian + tarif.tarif_per_km * (jarakKm - tarif.jarak_dasar_km));
}

/**
 * Biaya tambahan pengajuan perubahan jadwal (UC-P revisi #2): tarif dasar
 * untuk jarak_dasar_km pertama, ditambah tarif_per_km untuk tiap kilometer
 * berikutnya -- default pengaturan_tarif menghasilkan Rp15.000 (s.d. 3,5 km)
 * + Rp4.200/km selanjutnya. Mencerminkan hitung_biaya_perubahan_jadwal() di SQL.
 */
export function hitungBiayaPerubahanJadwal(tarif: PengaturanTarifRow, jarakKm: number): number {
  if (jarakKm <= tarif.jarak_dasar_km) return tarif.biaya_minimal_perubahan_jadwal;
  const biaya = tarif.biaya_minimal_perubahan_jadwal + tarif.tarif_per_km * (jarakKm - tarif.jarak_dasar_km);
  // Dibulatkan ke kelipatan Rp100 terdekat supaya nominal akhir tidak
  // menampilkan angka satuan/puluhan ganjil (mis. Rp17.350 -> Rp17.400).
  return bulatkanKeRatusan(biaya);
}
