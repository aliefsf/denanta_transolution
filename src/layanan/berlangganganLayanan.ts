import { supabase } from './supabase';
import type { AnakRow, LanggananRow, PembayaranRow, SekolahRow } from '../tipe';
import { ambilWaktuSekarang, ambilTanggalWibSekarang, tanggalWibDariDate } from '../bantuan/waktuSimulasi';
import { kompresiGambar, konversiBase64KeBlob } from '../bantuan/kompresiGambar';
import { kirimNotifikasi, kirimNotifikasiKeAdmin } from './notifikasiLayanan';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

export async function ambilDaftarSekolah(): Promise<SekolahRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('sekolah')
    .select('*, kelas_sekolah(nama_kelas)')
    .order('nama', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as any[]).map((s) => ({
    ...s,
    kelasTersedia: (s.kelas_sekolah ?? []).map((k: any) => k.nama_kelas)
  })) as SekolahRow[];
}

export interface DataAnakBaru {
  orangTuaId: string;
  namaLengkap: string;
  sekolahId: string;
  kelas: string;
  golonganDarah?: string;
  alergi?: string;
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  jenisLayanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
  jenisLangganan: 'bulanan' | 'harian';
}

export async function buatAnakBaru(data: DataAnakBaru): Promise<AnakRow> {
  const client = klienWajibAda();
  const { data: row, error } = await client
    .from('anak')
    .insert({
      orang_tua_id: data.orangTuaId,
      sekolah_id: data.sekolahId,
      nama_lengkap: data.namaLengkap,
      kelas: data.kelas,
      golongan_darah: data.golonganDarah || null,
      alergi: data.alergi || null,
      alamat_jemput: data.alamatJemput,
      lintang_jemput: data.lintangJemput,
      bujur_jemput: data.bujurJemput,
      alamat_antar: data.alamatJemput,
      lintang_antar: data.lintangJemput,
      bujur_antar: data.bujurJemput,
      jenis_layanan: data.jenisLayanan,
      jenis_langganan: data.jenisLangganan,
      aktif: true
    })
    .select('*, sekolah(nama, alamat)')
    .single();
  if (error) throw error;
  return row as AnakRow;
}

export async function perbaruiAnak(
  anakId: string,
  perubahan: Partial<{
    jenisLayanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
    jenisLangganan: 'bulanan' | 'harian';
    urlFoto: string;
  }>
): Promise<void> {
  const client = klienWajibAda();
  const payload: Record<string, unknown> = {};
  if (perubahan.jenisLayanan) payload.jenis_layanan = perubahan.jenisLayanan;
  if (perubahan.jenisLangganan) payload.jenis_langganan = perubahan.jenisLangganan;
  if (perubahan.urlFoto) payload.url_foto = perubahan.urlFoto;
  if (Object.keys(payload).length === 0) return;

  const { error } = await client.from('anak').update(payload).eq('id', anakId);
  if (error) throw error;
}

/**
 * Unggah foto profil anak (OPSIONAL -- fitur ini boleh dilewati sepenuhnya
 * oleh orang tua). Mengikuti pola bucket profile-images (kompresi ke JPEG
 * kecil di klien dulu via canvas, lihat src/bantuan/kompresiGambar.ts) tapi
 * folder root path-nya `{orang_tua_id}` (BUKAN anak_id) -- anak tidak
 * punya akun auth sendiri untuk dicocokkan RLS `auth.uid()`, lihat
 * tambah_bucket_foto_anak.sql. Cuma meng-upload & mengembalikan URL publik;
 * PEMANGGIL yang bertanggung jawab menyimpannya ke kolom anak.url_foto
 * (lewat perbaruiAnak({ urlFoto }) atau disertakan langsung di payload
 * insert/update masing-masing, supaya fungsi ini tetap satu tanggung jawab).
 * Nama file diberi suffix timestamp (bukan `{anakId}.jpg` tetap) -- lihat
 * catatan lengkap di unggahFotoProfil() (orangTuaLayanan.ts): nama file
 * yang selalu sama membuat URL publiknya juga selalu sama walau isinya
 * baru diganti, sehingga browser tetap menampilkan foto LAMA dari cache
 * meski unggahan baru & simpan ke database sudah 100% berhasil.
 */
export async function unggahFotoAnak(orangTuaId: string, anakId: string, file: File): Promise<string> {
  const client = klienWajibAda();

  const base64Kecil = await kompresiGambar(file);
  const blob = konversiBase64KeBlob(base64Kecil);
  const pathFile = `${orangTuaId}/${anakId}-${Date.now()}.jpg`;

  const { error: uploadErr } = await client.storage
    .from('foto-anak')
    .upload(pathFile, blob, { cacheControl: '3600', contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    const pesan = (uploadErr.message || '').toLowerCase();
    if (pesan.includes('bucket not found') || pesan.includes('does not exist')) {
      throw new Error('Bucket penyimpanan "foto-anak" belum dibuat di Supabase Storage. Harap jalankan tambah_bucket_foto_anak.sql terlebih dahulu.');
    }
    if (pesan.includes('row-level security') || pesan.includes('permission') || pesan.includes('policy')) {
      throw new Error('Tidak memiliki izin untuk mengunggah foto anak (kebijakan storage RLS membatasi akses).');
    }
    throw new Error(`Gagal mengunggah foto anak: ${uploadErr.message}`);
  }

  const { data } = client.storage.from('foto-anak').getPublicUrl(pathFile);
  if (!data?.publicUrl) throw new Error('Gagal mendapatkan URL publik untuk foto anak yang diunggah.');
  return data.publicUrl;
}

export async function hapusAnak(anakId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('anak').delete().eq('id', anakId);
  if (error) throw error;
}

function buatIdPesanan(): string {
  return `ORDER-DNT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export interface HasilLanggananPembayaran {
  langganan: LanggananRow;
  pembayaran: PembayaranRow;
}

/**
 * Upsert satu baris langganan (belum lunas) + satu baris pembayaran (menunggu)
 * untuk satu anak. Idempoten: kalau anak sudah punya langganan/pembayaran yang
 * belum lunas, baris yang sama diperbarui alih-alih membuat duplikat — supaya
 * retry pembayaran tidak menumpuk baris baru.
 */
export async function buatAtauPerbaruiLanggananDanPembayaran(params: {
  anakId: string;
  orangTuaId: string;
  jenisLangganan: 'bulanan' | 'harian';
  biaya: number;
}): Promise<HasilLanggananPembayaran> {
  const client = klienWajibAda();

  const { data: existing, error: errExisting } = await client
    .from('langganan')
    .select('*')
    .eq('anak_id', params.anakId)
    .eq('sudah_dibayar', false)
    .order('dibuat_pada', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errExisting) throw errExisting;

  const hariBerlaku = params.jenisLangganan === 'harian' ? 1 : 30;
  const tanggalMulai = ambilTanggalWibSekarang();
  const tanggalBerakhirDate = ambilWaktuSekarang();
  tanggalBerakhirDate.setDate(tanggalBerakhirDate.getDate() + hariBerlaku);
  const tanggalBerakhir = tanggalWibDariDate(tanggalBerakhirDate);

  let langganan: LanggananRow;
  if (existing) {
    const { data, error } = await client
      .from('langganan')
      .update({
        biaya_bulanan: params.biaya,
        tanggal_mulai: tanggalMulai,
        tanggal_berakhir: tanggalBerakhir,
        tanggal_jatuh_tempo: tanggalBerakhir
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    langganan = data as LanggananRow;
  } else {
    const { data, error } = await client
      .from('langganan')
      .insert({
        anak_id: params.anakId,
        tanggal_mulai: tanggalMulai,
        tanggal_berakhir: tanggalBerakhir,
        biaya_bulanan: params.biaya,
        sudah_dibayar: false,
        tanggal_jatuh_tempo: tanggalBerakhir
      })
      .select('*')
      .single();
    if (error) throw error;
    langganan = data as LanggananRow;
  }

  const { data: pembayaranAda, error: errBayarAda } = await client
    .from('pembayaran')
    .select('*')
    .eq('langganan_id', langganan.id)
    .eq('status', 'menunggu')
    .order('dibuat_pada', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errBayarAda) throw errBayarAda;

  let pembayaran: PembayaranRow;
  if (pembayaranAda) {
    const { data, error } = await client
      .from('pembayaran')
      .update({ jumlah: params.biaya, tipe_pembayaran: params.jenisLangganan })
      .eq('id', pembayaranAda.id)
      .select('*')
      .single();
    if (error) throw error;
    pembayaran = data as PembayaranRow;
  } else {
    const { data, error } = await client
      .from('pembayaran')
      .insert({
        langganan_id: langganan.id,
        orang_tua_id: params.orangTuaId,
        jumlah: params.biaya,
        tipe_pembayaran: params.jenisLangganan,
        status: 'menunggu',
        id_pesanan_midtrans: buatIdPesanan()
      })
      .select('*')
      .single();
    if (error) throw error;
    pembayaran = data as PembayaranRow;
  }

  return { langganan, pembayaran };
}

/**
 * Melunaskan pembayaran & mengaktifkan langganan -- SEKALIGUS menghitung
 * ULANG tanggal_mulai/tanggal_berakhir/tanggal_jatuh_tempo dari SAAT
 * PEMBAYARAN INI DIKONFIRMASI (bukan memakai tanggal lama yang sudah
 * kadung tersimpan di baris `langganan`). WAJIB -- baris `langganan`
 * bisa saja sudah dibuat beberapa hari (simulasi) sebelumnya (mis. wizard
 * ditinggal di Langkah 3 lalu dilanjutkan/dibayar belakangan, atau trigger
 * SQL `trg_buat_langganan_otomatis` yang otomatis membuat baris draft
 * begitu anak didaftarkan, memakai CURRENT_DATE server yang TIDAK
 * mengikuti simulasi client) -- tanpa perhitungan ulang di sini, masa
 * aktif 30/1 hari akan salah dihitung dari tanggal pembuatan DRAFT,
 * bukan dari tanggal PEMBAYARAN sesungguhnya.
 */
export async function konfirmasiPembayaranLunas(
  pembayaranId: string,
  langgananId: string,
  jenisLangganan: 'bulanan' | 'harian'
): Promise<void> {
  const client = klienWajibAda();

  const { error: errBayar } = await client
    .from('pembayaran')
    .update({ status: 'lunas', tanggal_pembayaran: ambilWaktuSekarang().toISOString() })
    .eq('id', pembayaranId);
  if (errBayar) throw errBayar;

  const hariBerlaku = jenisLangganan === 'harian' ? 1 : 30;
  const tanggalMulai = ambilTanggalWibSekarang();
  const tanggalBerakhirDate = ambilWaktuSekarang();
  tanggalBerakhirDate.setDate(tanggalBerakhirDate.getDate() + hariBerlaku);
  const tanggalBerakhir = tanggalWibDariDate(tanggalBerakhirDate);

  const { error: errLangganan } = await client
    .from('langganan')
    .update({
      sudah_dibayar: true,
      tanggal_mulai: tanggalMulai,
      tanggal_berakhir: tanggalBerakhir,
      tanggal_jatuh_tempo: tanggalBerakhir
    })
    .eq('id', langgananId);
  if (errLangganan) throw errLangganan;
}

export interface StatusWizardLangganan {
  status: 'belum_ada_anak' | 'belum_bayar' | 'aktif';
  anakList: AnakRow[];
  langgananByAnakId: Record<string, LanggananRow>;
  pembayaranByLanggananId: Record<string, PembayaranRow>;
}

/**
 * Dipakai saat wizard berlangganan dimuat untuk menentukan tahap awal:
 * belum_ada_anak -> mulai dari Langkah 1/2, belum_bayar -> resume ke
 * Langkah 3/4 dengan data yang sudah ada, aktif -> tidak perlu wizard.
 */
export async function ambilStatusLanggananWizard(orangTuaId: string): Promise<StatusWizardLangganan> {
  const client = klienWajibAda();

  const { data: anakData, error: errAnak } = await client
    .from('anak')
    .select('*, sekolah(nama, alamat)')
    .eq('orang_tua_id', orangTuaId)
    .eq('aktif', true)
    .order('dibuat_pada', { ascending: true });
  if (errAnak) throw errAnak;
  const anakList = (anakData as AnakRow[]) ?? [];

  if (anakList.length === 0) {
    return { status: 'belum_ada_anak', anakList: [], langgananByAnakId: {}, pembayaranByLanggananId: {} };
  }

  const anakIds = anakList.map((a) => a.id);
  const { data: langgananData, error: errLangganan } = await client
    .from('langganan')
    .select('*')
    .in('anak_id', anakIds)
    .order('dibuat_pada', { ascending: false });
  if (errLangganan) throw errLangganan;

  const langgananByAnakId: Record<string, LanggananRow> = {};
  for (const l of (langgananData as LanggananRow[]) ?? []) {
    if (!langgananByAnakId[l.anak_id]) langgananByAnakId[l.anak_id] = l;
  }

  const hariIni = ambilTanggalWibSekarang();
  const adaAktif = Object.values(langgananByAnakId).some(
    (l) => l.sudah_dibayar && l.tanggal_berakhir >= hariIni
  );
  if (adaAktif) {
    return { status: 'aktif', anakList, langgananByAnakId, pembayaranByLanggananId: {} };
  }

  const langgananIds = Object.values(langgananByAnakId).map((l) => l.id);
  const pembayaranByLanggananId: Record<string, PembayaranRow> = {};
  if (langgananIds.length > 0) {
    const { data: pembayaranData, error: errBayar } = await client
      .from('pembayaran')
      .select('*')
      .in('langganan_id', langgananIds)
      .order('dibuat_pada', { ascending: false });
    if (errBayar) throw errBayar;
    for (const p of (pembayaranData as PembayaranRow[]) ?? []) {
      if (p.langganan_id && !pembayaranByLanggananId[p.langganan_id]) pembayaranByLanggananId[p.langganan_id] = p;
    }
  }

  return { status: 'belum_bayar', anakList, langgananByAnakId, pembayaranByLanggananId };
}

/**
 * Versi khusus alur "Tambah Anak" dari halaman Pantau Anak: akun yang
 * memanggil ini SUDAH punya langganan aktif (setidaknya satu anak lunas),
 * jadi tidak bisa memakai ambilStatusLanggananWizard() -- fungsi itu
 * langsung short-circuit ke status 'aktif' begitu ada satu anak aktif, dan
 * TIDAK memuat data anak/langganan yang belum lunas. Fungsi ini murni
 * mengembalikan anak-anak yang BELUM punya langganan aktif (baik yang
 * belum sempat diisi jenis layanan sama sekali, maupun yang baru
 * ditambahkan tapi belum dibayar) supaya wizard bisa resume dari titik yang
 * tepat tanpa menampilkan ulang anak yang sudah lunas.
 */
export async function ambilAnakMenungguPembayaran(orangTuaId: string): Promise<StatusWizardLangganan> {
  const client = klienWajibAda();

  const { data: anakData, error: errAnak } = await client
    .from('anak')
    .select('*, sekolah(nama, alamat)')
    .eq('orang_tua_id', orangTuaId)
    .eq('aktif', true)
    .order('dibuat_pada', { ascending: true });
  if (errAnak) throw errAnak;
  const semuaAnak = (anakData as AnakRow[]) ?? [];

  if (semuaAnak.length === 0) {
    return { status: 'belum_ada_anak', anakList: [], langgananByAnakId: {}, pembayaranByLanggananId: {} };
  }

  const anakIds = semuaAnak.map((a) => a.id);
  const { data: langgananData, error: errLangganan } = await client
    .from('langganan')
    .select('*')
    .in('anak_id', anakIds)
    .order('dibuat_pada', { ascending: false });
  if (errLangganan) throw errLangganan;

  const langgananByAnakId: Record<string, LanggananRow> = {};
  for (const l of (langgananData as LanggananRow[]) ?? []) {
    if (!langgananByAnakId[l.anak_id]) langgananByAnakId[l.anak_id] = l;
  }

  const hariIni = ambilTanggalWibSekarang();
  const anakList = semuaAnak.filter((a) => {
    const l = langgananByAnakId[a.id];
    return !(l && l.sudah_dibayar && l.tanggal_berakhir >= hariIni);
  });

  const langgananIds = anakList.map((a) => langgananByAnakId[a.id]?.id).filter((id): id is string => !!id);
  const pembayaranByLanggananId: Record<string, PembayaranRow> = {};
  if (langgananIds.length > 0) {
    const { data: pembayaranData, error: errBayar } = await client
      .from('pembayaran')
      .select('*')
      .in('langganan_id', langgananIds)
      .order('dibuat_pada', { ascending: false });
    if (errBayar) throw errBayar;
    for (const p of (pembayaranData as PembayaranRow[]) ?? []) {
      if (p.langganan_id && !pembayaranByLanggananId[p.langganan_id]) pembayaranByLanggananId[p.langganan_id] = p;
    }
  }

  return {
    status: anakList.length === 0 ? 'aktif' : 'belum_bayar',
    anakList,
    langgananByAnakId,
    pembayaranByLanggananId
  };
}

// ==========================================
// Hentikan Langganan
// ==========================================

export interface HasilHentikanLangganan {
  jumlahAnakDihentikan: number;
  jumlahPerjalananDibatalkan: number;
}

/**
 * Hentikan SELURUH langganan aktif milik satu akun orang tua (semua anak
 * yang saat ini berstatus aktif), dipicu dari alur "Hentikan Langganan"
 * (RiwayatPembayaran.vue, sudah melalui konfirmasi + verifikasi password di
 * sisi komponen sebelum fungsi ini dipanggil).
 *
 * SENGAJA TIDAK menambah kolom status/enum baru pada `langganan` --
 * mengikuti pola "tampilan setelah dihentikan = tampilan langganan habis"
 * yang diminta: baris langganan aktif cukup di-"kadaluwarsakan" dengan
 * memundurkan tanggal_berakhir ke kemarin, PERSIS kriteria yang sudah
 * dipakai di mana-mana (`sudah_dibayar && tanggal_berakhir >= hariIni`,
 * lihat authStore.periksaStatusBerlangganan, anakAktifList di
 * useDataOrangTua.ts, dan anakPerluDiaktifkan di RiwayatPembayaran.vue) --
 * begitu baris ini diperbarui, SELURUH gating akses (monitoring, live
 * tracking, banner "Layanan Tidak Aktif") otomatis ikut menyesuaikan tanpa
 * perlu logika tampilan baru sama sekali. Kolom dibatalkan_pada (migrasi
 * terpisah di skema_database.sql) tetap dicatat sebagai jejak KAPAN &
 * BAHWA ini penghentian sengaja oleh pengguna, bukan sekadar kedaluwarsa
 * alami -- dipakai isi notifikasi, bukan dipakai logika gating apa pun.
 */
export async function hentikanLangganan(orangTuaId: string): Promise<HasilHentikanLangganan> {
  const client = klienWajibAda();
  const hariIni = ambilTanggalWibSekarang();
  const kemarin = tanggalWibDariDate(new Date(new Date(`${hariIni}T00:00:00+07:00`).getTime() - 24 * 60 * 60 * 1000));
  const sekarangIso = ambilWaktuSekarang().toISOString();

  const { data: anakData, error: errAnak } = await client
    .from('anak')
    .select('id, nama_lengkap')
    .eq('orang_tua_id', orangTuaId)
    .eq('aktif', true);
  if (errAnak) throw errAnak;

  const anakIds = (anakData ?? []).map((a: any) => a.id);
  if (anakIds.length === 0) {
    throw new Error('Tidak ada anak terdaftar pada akun ini untuk dihentikan langganannya.');
  }

  const { data: langgananAktif, error: errLangganan } = await client
    .from('langganan')
    .select('id, anak_id')
    .in('anak_id', anakIds)
    .eq('sudah_dibayar', true)
    .gte('tanggal_berakhir', hariIni);
  if (errLangganan) throw errLangganan;

  if (!langgananAktif || langgananAktif.length === 0) {
    throw new Error('Tidak ada langganan aktif yang dapat dihentikan.');
  }

  const { error: errUpdateLangganan } = await client
    .from('langganan')
    .update({ tanggal_berakhir: kemarin, dibatalkan_pada: sekarangIso })
    .in('id', langgananAktif.map((l: any) => l.id));
  if (errUpdateLangganan) throw errUpdateLangganan;

  // Batalkan seluruh perjalanan yang BELUM berjalan (status masih
  // 'dijadwalkan') milik anak-anak ini -- kebijakan RLS yang mengizinkan
  // transisi dijadwalkan->dibatalkan sudah ada (semula dibuat untuk alur
  // cuti anak), tanpa syarat tambahan selain kepemilikan, jadi aman dipakai
  // ulang di sini.
  const { data: perjalananDibatalkan, error: errPerjalanan } = await client
    .from('perjalanan')
    .update({ status: 'dibatalkan' })
    .in('anak_id', anakIds)
    .eq('status', 'dijadwalkan')
    .select('id');
  if (errPerjalanan) throw errPerjalanan;

  const namaAnakList = (anakData ?? []).map((a: any) => a.nama_lengkap).join(', ');

  // Notifikasi ke akun sendiri (konfirmasi) -- gagal kirim TIDAK boleh
  // membatalkan penghentian yang sudah berhasil tersimpan di atas.
  try {
    await kirimNotifikasi({
      penggunaId: orangTuaId,
      judul: 'Langganan Dihentikan',
      pesan: 'Langganan Anda berhasil dihentikan. Layanan antar jemput saat ini sudah tidak aktif.',
      tipe: 'pembayaran',
      tipeTerkait: 'langganan'
    });
  } catch (err) {
    console.error('Gagal mengirim notifikasi konfirmasi penghentian langganan:', err);
  }

  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Pengguna Menghentikan Langganan',
      pesan: `Pengguna menghentikan layanan langganan untuk: ${namaAnakList}.`,
      tipe: 'pembayaran',
      tipeTerkait: 'langganan'
    });
  } catch (err) {
    console.error('Gagal mengirim notifikasi admin soal penghentian langganan:', err);
  }

  return {
    jumlahAnakDihentikan: langgananAktif.length,
    jumlahPerjalananDibatalkan: perjalananDibatalkan?.length ?? 0
  };
}
