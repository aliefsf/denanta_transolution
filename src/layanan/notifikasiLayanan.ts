import { supabase } from './supabase';
import type { NotifikasiRow } from '../tipe';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

export type TipeNotifikasi = 'perjalanan' | 'pembayaran' | 'sistem' | 'promo';

/**
 * Data-access bersama untuk tabel `notifikasi`, dipakai SEMUA peran
 * (Orang Tua, Supir, Admin) -- sebelumnya fungsi baca/tandai-dibaca hanya
 * ada di orangTuaLayanan.ts (khusus Orang Tua). Dipindah ke sini supaya
 * NotifikasiSupir.vue/NotifikasiAdmin.vue tidak perlu mengimpor dari layanan
 * domain Orang Tua yang tidak relevan bagi mereka.
 *
 * Pengiriman notifikasi LINTAS PENGGUNA (kirimNotifikasi/kirimNotifikasiKeAdmin)
 * WAJIB lewat fungsi SECURITY DEFINER `buat_notifikasi`/`notifikasi_ke_semua_admin`
 * di database (lihat migrasi "NOTIFIKASI LINTAS PERAN GENERIK" di
 * skema_database.sql) -- tabel notifikasi tidak punya kebijakan RLS INSERT
 * untuk peran non-admin sama sekali, jadi INSERT langsung dari klien
 * Orang Tua/Supir akan selalu ditolak.
 */

export async function ambilNotifikasiPengguna(penggunaId: string): Promise<NotifikasiRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('notifikasi')
    .select('*')
    .eq('pengguna_id', penggunaId)
    .order('dibuat_pada', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as NotifikasiRow[]) ?? [];
}

export async function tandaiNotifikasiDibaca(id: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('notifikasi').update({ sudah_dibaca: true }).eq('id', id);
  if (error) throw error;
}

export async function tandaiSemuaNotifikasiDibaca(penggunaId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client
    .from('notifikasi')
    .update({ sudah_dibaca: true })
    .eq('pengguna_id', penggunaId)
    .eq('sudah_dibaca', false);
  if (error) throw error;
}

/**
 * Hapus SATU notifikasi milik pengguna sendiri -- lihat kebijakan RLS
 * "Notifikasi: Menghapus notifikasi mandiri" di skema_database.sql
 * (pengguna_id = auth.uid()), jadi otomatis gagal kalau id yang diberikan
 * bukan milik akun yang sedang login.
 */
export async function hapusNotifikasi(id: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('notifikasi').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Hapus SELURUH notifikasi milik pengguna yang sedang login -- dipakai
 * tombol "Bersihkan Semua" di kotak masuk notifikasi.
 */
export async function hapusSemuaNotifikasi(penggunaId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('notifikasi').delete().eq('pengguna_id', penggunaId);
  if (error) throw error;
}

/**
 * Kirim notifikasi ke SATU pengguna tertentu (id-nya sudah diketahui
 * pengirim, mis. admin mengirim ke orang_tua_id/supir_id yang sudah ada di
 * tangan). Dipakai lintas peran: Admin->Orang Tua, Admin->Supir, dan juga
 * Orang Tua/Supir mengirim notifikasi ke akun sendiri (mis. rekonsiliasi
 * pembayaran).
 */
export async function kirimNotifikasi(params: {
  penggunaId: string;
  judul: string;
  pesan: string;
  tipe: TipeNotifikasi;
  idTerkait?: string;
  tipeTerkait?: string;
}): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.rpc('buat_notifikasi', {
    p_pengguna_id: params.penggunaId,
    p_judul: params.judul,
    p_pesan: params.pesan,
    p_tipe: params.tipe,
    p_id_terkait: params.idTerkait ?? null,
    p_tipe_terkait: params.tipeTerkait ?? null
  });
  if (error) throw error;
}

/**
 * Kirim notifikasi ke SELURUH akun berperan admin -- dipakai pengirim yang
 * TIDAK diizinkan RLS mengetahui id akun admin (Orang Tua, Supir), mis.
 * saat Orang Tua mengajukan perubahan jadwal/cuti yang perlu ditinjau Admin.
 */
export async function kirimNotifikasiKeAdmin(params: {
  judul: string;
  pesan: string;
  tipe: TipeNotifikasi;
  idTerkait?: string;
  tipeTerkait?: string;
}): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.rpc('notifikasi_ke_semua_admin', {
    p_judul: params.judul,
    p_pesan: params.pesan,
    p_tipe: params.tipe,
    p_id_terkait: params.idTerkait ?? null,
    p_tipe_terkait: params.tipeTerkait ?? null
  });
  if (error) throw error;
}
