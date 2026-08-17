import { supabase } from './supabase';
import type {
  AnakRow,
  JadwalMingguanRow,
  LanggananRow,
  OrangTuaRow,
  PembayaranRow,
  PengajuanAbsenRow,
  PengajuanCutiRow,
  PengajuanPerubahanJadwalRow,
  PenggunaRow,
  PenilaianRow,
  PenundaanPembayaranRow,
  PerjalananRow,
  PolaHariJadwal,
  RiwayatPerubahanJadwalMingguanRow,
  SupirRow,
  LaporanKendalaRow
} from '../tipe';
import { kirimNotifikasi, kirimNotifikasiKeAdmin } from './notifikasiLayanan';
import { apakahJendelaAbsensiTerbuka, formatTanggalIndonesiaDenganHari } from '../bantuan/periodeAbsensi';
import { ambilWaktuSekarang, ambilTanggalWibSekarang } from '../bantuan/waktuSimulasi';
import { kompresiGambar, konversiBase64KeBlob } from '../bantuan/kompresiGambar';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// ==========================================
// Profil (pengguna + orang_tua)
// ==========================================

export interface ProfilOrangTuaGabungan {
  pengguna: PenggunaRow;
  orangTua: OrangTuaRow | null;
}

export async function ambilProfilOrangTua(userId: string): Promise<ProfilOrangTuaGabungan> {
  const client = klienWajibAda();

  const { data: pengguna, error: errPengguna } = await client
    .from('pengguna')
    .select('*')
    .eq('id', userId)
    .single();
  if (errPengguna) throw errPengguna;

  const { data: orangTua, error: errOrangTua } = await client
    .from('orang_tua')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (errOrangTua) throw errOrangTua;

  return { pengguna: pengguna as PenggunaRow, orangTua: (orangTua as OrangTuaRow) ?? null };
}

export async function perbaruiProfilOrangTua(params: {
  userId: string;
  namaLengkap: string;
  nomorTelepon: string;
  alamat: string;
  kontakDarurat?: string;
  nomorWhatsapp: string;
  fotoProfil?: string;
}): Promise<void> {
  const client = klienWajibAda();

  const payloadPengguna: Record<string, unknown> = {
    nama_lengkap: params.namaLengkap,
    nomor_telepon: params.nomorTelepon
  };
  if (params.fotoProfil) payloadPengguna.foto_profil = params.fotoProfil;

  const { error: errPengguna } = await client
    .from('pengguna')
    .update(payloadPengguna)
    .eq('id', params.userId);
  if (errPengguna) throw errPengguna;

  const { error: errOrangTua } = await client
    .from('orang_tua')
    .update({
      alamat: params.alamat,
      kontak_darurat: params.kontakDarurat ?? '',
      nomor_whatsapp: params.nomorWhatsapp
    })
    .eq('id', params.userId);
  if (errOrangTua) throw errOrangTua;
}

/**
 * Unggah foto profil pengguna (OPSIONAL) -- kompresi ke JPEG kecil di klien
 * dulu (lihat kompresiGambar), lalu unggah ke bucket 'profile-images' dengan
 * path `{userId}/foto-{timestamp}.jpg`. Nama file SENGAJA diberi suffix
 * timestamp (bukan nama tetap `foto.jpg`) -- kalau nama file selalu sama,
 * URL publiknya juga selalu sama walau isinya baru saja diganti, sehingga
 * browser (yang menyimpan cache berdasarkan URL, apalagi dgn cacheControl
 * di bawah) tetap menampilkan foto LAMA dari cache walau upload & simpan
 * ke database sudah 100% berhasil -- baru hilang kalau pengguna hard
 * refresh. Dengan URL yang selalu baru tiap upload, masalah ini hilang
 * sepenuhnya tanpa perlu trik cache-busting di sisi tampilan.
 */
export async function unggahFotoProfil(userId: string, file: File): Promise<string> {
  const client = klienWajibAda();

  const base64Kecil = await kompresiGambar(file);
  const blob = konversiBase64KeBlob(base64Kecil);
  const pathFile = `${userId}/foto-${Date.now()}.jpg`;

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

  const { data } = client.storage.from('profile-images').getPublicUrl(pathFile);
  if (!data?.publicUrl) throw new Error('Gagal mendapatkan URL publik untuk foto profil yang diunggah.');
  return data.publicUrl;
}

// ==========================================
// Anak
// ==========================================

export async function ambilAnakOrangTua(orangTuaId: string): Promise<AnakRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('anak')
    .select('*, sekolah(nama, alamat, lintang, bujur)')
    .eq('orang_tua_id', orangTuaId)
    .eq('aktif', true)
    .order('dibuat_pada', { ascending: true });
  if (error) throw error;
  return (data as AnakRow[]) ?? [];
}

export async function perbaruiAlamatAnak(params: {
  anakId: string;
  namaAnak: string;
  alamatJemput?: string;
  lintangJemput?: number;
  bujurJemput?: number;
  jenisPerubahan?: 'pergi' | 'pulang';
  alamatBaru?: string;
  lintangBaru?: number;
  bujurBaru?: number;
}): Promise<void> {
  const client = klienWajibAda();
  const payload: Record<string, unknown> = {};

  const jenis = params.jenisPerubahan || 'pergi';
  const alamat = params.alamatBaru !== undefined ? params.alamatBaru : params.alamatJemput;
  const lintang = params.lintangBaru !== undefined ? params.lintangBaru : params.lintangJemput;
  const bujur = params.bujurBaru !== undefined ? params.bujurBaru : params.bujurJemput;

  if (jenis === 'pergi') {
    payload.alamat_jemput = alamat;
    payload.lintang_jemput = lintang;
    payload.bujur_jemput = bujur;
  } else {
    payload.alamat_antar = alamat;
    payload.lintang_antar = lintang;
    payload.bujur_antar = bujur;
  }

  const { error } = await client.from('anak').update(payload).eq('id', params.anakId);
  if (error) throw error;

  // Tandai baris `perjalanan` yang SEDANG aktif (hari ini/akan datang,
  // masih 'dijadwalkan') dengan alamat_diperbarui_pada -- SATU-SATUNYA
  // tujuan kolom ini supaya PenugasanAdmin.vue bisa menampilkan indikator
  // "Alamat diperbarui" yang akurat (bukan sekadar menebak dari
  // anak.diperbarui_pada, yang ikut berubah untuk field APAPUN yang
  // diedit, bukan cuma alamat). Perubahan ALAMAT SAJA (fungsi ini) SENGAJA
  // TIDAK membatalkan/mengubah penugasan yang sudah ada -- anak tetap di
  // supir yang sama, cukup titik lokasinya yang diperbarui (beda dari
  // perubahan waktu/hari, lihat sinkronkanPerjalananSetelahPerubahanJadwal()).
  // Best-effort: kegagalan di sini tidak boleh menggagalkan update alamat
  // yang sudah berhasil tersimpan di atas.
  try {
    await client
      .from('perjalanan')
      .update({ alamat_diperbarui_pada: ambilWaktuSekarang().toISOString() })
      .eq('anak_id', params.anakId)
      .eq('jenis_perjalanan', jenis === 'pergi' ? 'pagi' : 'sore')
      .eq('status', 'dijadwalkan')
      .gte('tanggal_perjalanan', ambilTanggalWibSekarang());
  } catch (err) {
    console.error('Gagal menandai alamat_diperbarui_pada pada perjalanan aktif:', err);
  }

  // Beritahu Admin -- alamat baru bisa perlu penyesuaian rute
  // penugasan supir. Best-effort, lihat catatan yang sama di
  // ajukanCuti()/ubahJadwalMingguan()/ajukanPerubahanJadwal().
  try {
    await kirimNotifikasiKeAdmin({
      judul: jenis === 'pergi' ? 'Perubahan Alamat Jemput' : 'Perubahan Alamat Antar',
      pesan: `${params.namaAnak} memperbarui alamat ${jenis === 'pergi' ? 'penjemputan' : 'pengantaran'} menjadi: ${alamat}.`,
      tipe: 'sistem',
      idTerkait: params.anakId,
      tipeTerkait: 'anak'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi perubahan alamat ke admin:', err);
  }
}

/**
 * Perbarui data anak (nama, sekolah/kelas, alamat jemput + titik peta, foto)
 * dari panel Orang Tua (Pantau Anak) -- dipakai untuk mengoreksi data yang
 * salah/berubah SETELAH anak terdaftar, terpisah dari data yang dikunci saat
 * pendaftaran (jenis_layanan/jenis_langganan, lihat perbaruiAnak di
 * berlangganganLayanan.ts, sengaja tidak ikut di sini karena mengubahnya
 * berdampak ke tarif & langganan yang sudah berjalan).
 */
export async function perbaruiDataAnak(params: {
  anakId: string;
  namaLengkap: string;
  sekolahId: string;
  kelas: string;
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  urlFoto?: string;
}): Promise<void> {
  const client = klienWajibAda();
  const payload: Record<string, unknown> = {
    nama_lengkap: params.namaLengkap,
    sekolah_id: params.sekolahId,
    kelas: params.kelas,
    alamat_jemput: params.alamatJemput,
    lintang_jemput: params.lintangJemput,
    bujur_jemput: params.bujurJemput
  };
  if (params.urlFoto) payload.url_foto = params.urlFoto;

  const { error } = await client.from('anak').update(payload).eq('id', params.anakId);
  if (error) throw error;
}


// ==========================================
// Langganan
// ==========================================

export async function ambilLanggananByAnakIds(anakIds: string[]): Promise<LanggananRow[]> {
  if (anakIds.length === 0) return [];
  const client = klienWajibAda();
  const { data, error } = await client
    .from('langganan')
    .select('*')
    .in('anak_id', anakIds)
    .order('tanggal_berakhir', { ascending: true });
  if (error) throw error;
  return (data as LanggananRow[]) ?? [];
}

// ==========================================
// Perjalanan & riwayat + resolusi nama/kontak supir
// ==========================================

export interface PerjalananDenganSupir extends PerjalananRow {
  namaSupir: string | null;
  kontakSupir: string | null;
  fotoSupir?: string | null;
  // Sumber kebenaran TUNGGAL utk kemunculan marker armada di peta Pantau
  // Anak -- SENGAJA disamakan persis dengan yang dipakai Admin
  // (ambilPosisiSupirAktif, adminLayanan.ts: `supir.sedang_bertugas`),
  // BUKAN status kolom `perjalanan`. "Mulai Bertugas" (TugasSupir.vue)
  // cuma meng-UPDATE baris `supir` ini, tidak pernah mengubah status
  // perjalanan sama sekali -- pakai acuan lain (mis. status != 'dijadwalkan')
  // membuat sisi Orang Tua "telat" ketimbang Admin/Supir, atau malah tidak
  // pernah muncul sampai supir sempat mengubah status secara manual.
  supirSedangBertugas: boolean;
  laporan_kendala?: LaporanKendalaRow[];
}

async function lengkapiNamaSupir(perjalananList: PerjalananRow[]): Promise<PerjalananDenganSupir[]> {
  const client = klienWajibAda();
  const supirIds = Array.from(
    new Set(perjalananList.map((p) => p.supir_id).filter((id): id is string => !!id))
  );

  if (supirIds.length === 0) {
    return perjalananList.map((p) => ({ ...p, namaSupir: null, kontakSupir: null, fotoSupir: null, supirSedangBertugas: false }));
  }

  const [{ data: penggunaSupir, error: errPengguna }, { data: supirData, error: errSupir }] = await Promise.all([
    client.from('pengguna').select('id, nama_lengkap, nomor_telepon, foto_profil').in('id', supirIds),
    client.from('supir').select('id, sedang_bertugas, sedang_bertugas_diaktifkan_pada').in('id', supirIds)
  ]);
  if (errPengguna) throw errPengguna;
  if (errSupir) throw errSupir;

  const petaSupir = new Map(
    (penggunaSupir ?? []).map((p: any) => [
      p.id,
      { nama: p.nama_lengkap, telepon: p.nomor_telepon, foto: p.foto_profil }
    ])
  );
  // Sama seperti ambilPosisiSupirAktif() (adminLayanan.ts) -- sedang_bertugas
  // TRUE saja tidak cukup, harus juga diaktifkan HARI INI (WIB). Tanpa syarat
  // ini, marker armada di peta Pantau Anak bisa tetap "nyangkut" aktif
  // melewati pergantian hari kalau supir lupa menandai tugasnya selesai.
  // Dibandingkan sebagai Date (BUKAN string mentah) -- dua representasi
  // timestamptz dengan offset zona berbeda (mis. "...+00:00" dari Postgres
  // vs "...+07:00" di sini) tidak bisa dibandingkan lewat perbandingan
  // string biasa, hasilnya bisa salah walau menunjuk waktu yang sama/dekat.
  const awalHariIniWibMs = new Date(`${ambilTanggalWibSekarang()}T00:00:00+07:00`).getTime();
  const petaBertugas = new Map(
    (supirData ?? []).map((s: any) => [
      s.id,
      !!s.sedang_bertugas && !!s.sedang_bertugas_diaktifkan_pada && new Date(s.sedang_bertugas_diaktifkan_pada).getTime() >= awalHariIniWibMs
    ])
  );

  return perjalananList.map((p) => ({
    ...p,
    namaSupir: p.supir_id ? petaSupir.get(p.supir_id)?.nama ?? null : null,
    kontakSupir: p.supir_id ? petaSupir.get(p.supir_id)?.telepon ?? null : null,
    fotoSupir: p.supir_id ? petaSupir.get(p.supir_id)?.foto ?? null : null,
    supirSedangBertugas: p.supir_id ? petaBertugas.get(p.supir_id) ?? false : false
  }));
}

export async function ambilPerjalananHariIniByAnakIds(anakIds: string[]): Promise<PerjalananDenganSupir[]> {
  if (anakIds.length === 0) return [];
  const client = klienWajibAda();
  const hariIni = ambilTanggalWibSekarang();
  // .neq('status', 'dibatalkan') WAJIB sama dengan filter di
  // ambilTugasHariIni()/hitungTugasUntukTanggalAktif() (supirLayanan.ts) --
  // tanpa ini, baris perjalanan LAMA yang sudah dibatalkan Admin (mis. bekas
  // "batalkan lalu tugaskan ulang") tapi masih nyangkut di database bisa
  // "menutupi" baris aktif yang baru untuk anak & tanggal yang sama --
  // petakanAnakTampilan() memilih baris pertama yang cocok lewat .find(),
  // urutannya tidak dijamin, jadi baris dibatalkan itu bisa terpilih dan
  // badge status anak salah menampilkan "Absen/Libur" walau sebenarnya anak
  // punya penugasan aktif hari itu (terlihat benar di sisi Supir).
  const { data, error } = await client
    .from('perjalanan')
    .select('*, laporan_kendala(*)')
    .in('anak_id', anakIds)
    .eq('tanggal_perjalanan', hariIni)
    .neq('status', 'dibatalkan');
  if (error) throw error;
  const perjalananList = (data as (PerjalananRow & { laporan_kendala?: any[] })[]) ?? [];

  // Laporan "Kendala Perjalanan" (rute) HANYA tersimpan SATU baris per
  // laporan, terikat ke SATU perjalanan_id acuan (anak mana pun yang
  // kebetulan dipakai sistem sebagai acuan saat supir mengirim lewat tombol
  // "Lapor Kendala" -- lihat laporkan_kendala_perjalanan() di
  // skema_database.sql). Join `laporan_kendala(*)` di atas SAJA cuma
  // menangkap laporan itu untuk anak acuan tsb -- anak LAIN yang naik supir
  // sama pada tanggal yang sama tidak akan pernah melihatnya di halaman
  // Pantau Anak/Detail Anak mereka sendiri, padahal notifikasinya sudah
  // benar terkirim ke orang tua mereka juga. Query tambahan ini mengambil
  // SEMUA laporan kendala_perjalanan yang supir_id-nya cocok dengan supir
  // anak-anak akun ini pada tanggal yang sama, lalu ditempelkan ke SETIAP
  // baris perjalanan yang relevan (bukan cuma anak acuannya).
  //
  // PENTING: ditempel HANYA ke baris dengan jenis_perjalanan (sesi) yang
  // SAMA dengan sesi rujukan laporan -- SEBELUMNYA dicocokkan hanya lewat
  // supir_id, jadi kendala yang dilaporkan utk sesi PAGI ikut nempel juga ke
  // baris SORE anak yang sama (dan sebaliknya), padahal kendala rute cuma
  // relevan utk perjalanan yang sedang berlangsung saat itu -- armada sesi
  // sore belum tentu bermasalah hanya karena armada pagi bermasalah.
  const supirIdsUnik = Array.from(new Set(perjalananList.map((p) => p.supir_id).filter((id): id is string => !!id)));
  if (supirIdsUnik.length > 0) {
    const { data: kendalaRute, error: errKendala } = await client
      .from('laporan_kendala')
      .select('*, perjalanan!inner(supir_id, tanggal_perjalanan, jenis_perjalanan)')
      .eq('kategori', 'kendala_perjalanan')
      .in('perjalanan.supir_id', supirIdsUnik)
      .eq('perjalanan.tanggal_perjalanan', hariIni);
    if (!errKendala && kendalaRute) {
      for (const p of perjalananList) {
        const idSudahAda = new Set((p.laporan_kendala ?? []).map((k: any) => k.id));
        const tambahan = (kendalaRute as any[]).filter(
          (k) =>
            k.perjalanan?.supir_id === p.supir_id &&
            k.perjalanan?.jenis_perjalanan === p.jenis_perjalanan &&
            !idSudahAda.has(k.id)
        );
        if (tambahan.length > 0) {
          p.laporan_kendala = [...(p.laporan_kendala ?? []), ...tambahan];
        }
      }
    }
  }

  return lengkapiNamaSupir(perjalananList);
}

export async function ambilRiwayatPerjalanan(anakIds: string[]): Promise<PerjalananDenganSupir[]> {
  if (anakIds.length === 0) return [];
  const client = klienWajibAda();
  const { data, error } = await client
    .from('perjalanan')
    .select('*')
    .in('anak_id', anakIds)
    .order('tanggal_perjalanan', { ascending: false })
    .limit(100);
  if (error) throw error;
  return lengkapiNamaSupir((data as PerjalananRow[]) ?? []);
}

// ==========================================
// Pembayaran & penundaan
// ==========================================

export async function ambilPembayaranOrangTua(orangTuaId: string): Promise<PembayaranRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pembayaran')
    .select('*')
    .eq('orang_tua_id', orangTuaId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;
  return (data as PembayaranRow[]) ?? [];
}

/**
 * Hapus SATU baris faktur/tagihan milik sendiri -- HANYA berlaku untuk
 * tagihan yang BELUM lunas (lihat kebijakan RLS "Pembayaran: Orang tua
 * menghapus tagihan belum lunas miliknya" di skema_database.sql). Tagihan
 * berstatus 'lunas' sengaja tidak bisa dihapus dari sisi klien -- itu bukti
 * pembayaran resmi, RLS akan menolak percobaan menghapusnya (0 baris
 * terhapus, bukan error eksplisit, karena Supabase tidak melempar error
 * saat DELETE tidak mencocokkan baris apa pun akibat RLS).
 */
export async function hapusPembayaran(id: string): Promise<void> {
  const client = klienWajibAda();
  const { error, count } = await client
    .from('pembayaran')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  if (!count) {
    throw new Error('Tagihan yang sudah lunas tidak dapat dihapus.');
  }
}

/**
 * Unggah file bukti (OPSIONAL) utk pengajuan penundaan pembayaran, mis.
 * screenshot mutasi rekening/slip gaji -- dipanggil SEBELUM
 * ajukanPenundaanPembayaran() kalau pengguna melampirkan file, hasilnya
 * (URL publik) diteruskan sbg `buktiUrl`. Path objek WAJIB diawali
 * `{orangTuaId}/` (sama dgn auth.uid() pemanggil) supaya lolos kebijakan
 * RLS storage "Bukti Penundaan: Orang tua mengunggah bukti miliknya sendiri".
 */
export async function unggahBuktiPenundaan(orangTuaId: string, file: File): Promise<string> {
  const client = klienWajibAda();
  const ekstensi = file.name.split('.').pop() || 'jpg';
  const pathFile = `${orangTuaId}/${Date.now()}.${ekstensi}`;

  const { error: errUpload } = await client.storage
    .from('bukti-penundaan')
    .upload(pathFile, file, { cacheControl: '3600', upsert: false });
  if (errUpload) throw new Error(`Gagal mengunggah bukti: ${errUpload.message}`);

  const { data } = client.storage.from('bukti-penundaan').getPublicUrl(pathFile);
  return data.publicUrl;
}

export async function ajukanPenundaanPembayaran(params: {
  pembayaranId: string;
  orangTuaId: string;
  alasan: string;
  buktiUrl?: string | null;
}): Promise<PenundaanPembayaranRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('penundaan_pembayaran')
    .insert({
      pembayaran_id: params.pembayaranId,
      orang_tua_id: params.orangTuaId,
      alasan: params.alasan,
      bukti_url: params.buktiUrl ?? null
    })
    .select('*')
    .single();
  if (error) throw error;

  // Beri tahu Admin -- SEBELUMNYA tidak ada sama sekali, pengajuan hanya
  // terlihat kalau Admin kebetulan cek manual menu Daftar Pengguna/Keuangan.
  // Best-effort: kegagalan kirim notifikasi tidak boleh membuat pengajuan
  // yang sudah tersimpan di atas gagal dilaporkan berhasil.
  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Pengajuan Penundaan Pembayaran Baru',
      pesan: `Pengguna mengajukan penundaan pembayaran. Alasan: ${params.alasan}. Silakan lakukan pemeriksaan.`,
      tipe: 'pembayaran',
      idTerkait: data.id,
      tipeTerkait: 'penundaan_diajukan'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi pengajuan penundaan pembayaran ke admin:', err);
  }

  return data as PenundaanPembayaranRow;
}

export async function ambilPenundaanPembayaran(orangTuaId: string): Promise<PenundaanPembayaranRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('penundaan_pembayaran')
    .select('*')
    .eq('orang_tua_id', orangTuaId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;
  return (data as PenundaanPembayaranRow[]) ?? [];
}

function buatIdPesananBulanBerikutnya(): string {
  return `ORDER-DNT-ADV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * "Bayar Bulan Berikutnya" (Revisi Panel Pengguna #7): membuat baris
 * pembayaran untuk periode BULAN DEPAN, ditandai lewat kolom periode_bulan
 * supaya tidak tercampur dengan tagihan bulan berjalan. Idempoten -- kalau
 * baris untuk langganan+periode ini sudah ada, dikembalikan apa adanya
 * (tidak membuat duplikat setiap kali tombol diklik ulang).
 */
export async function buatPembayaranBulanBerikutnya(params: {
  langgananId: string;
  orangTuaId: string;
  jumlah: number;
  periodeBulan: string; // format 'YYYY-MM-01'
}): Promise<PembayaranRow> {
  const client = klienWajibAda();

  const { data: existing, error: errCek } = await client
    .from('pembayaran')
    .select('*')
    .eq('langganan_id', params.langgananId)
    .eq('periode_bulan', params.periodeBulan)
    .maybeSingle();
  if (errCek) throw errCek;
  if (existing) return existing as PembayaranRow;

  const { data, error } = await client
    .from('pembayaran')
    .insert({
      langganan_id: params.langgananId,
      orang_tua_id: params.orangTuaId,
      jumlah: params.jumlah,
      tipe_pembayaran: 'bulanan',
      status: 'menunggu',
      id_pesanan_midtrans: buatIdPesananBulanBerikutnya(),
      periode_bulan: params.periodeBulan
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PembayaranRow;
}

/**
 * Menandai pembayaran periode berikutnya lunas SEKALIGUS memperpanjang
 * `langganan` (tanggal_mulai/tanggal_berakhir/tanggal_jatuh_tempo) --
 * SEBELUMNYA sengaja tidak menyentuh langganan sama sekali, tapi itu
 * membuat pembayaran lebih awal jadi percuma: begitu tanggal_berakhir
 * periode LAMA lewat, akun tetap terbaca kedaluwarsa walau sudah bayar
 * duluan, memaksa pengguna membayar ULANG lewat alur "Lanjutkan Langganan".
 * Basis perpanjangan HARUS tanggal_berakhir yang SUDAH ADA (bukan waktu
 * pembayaran sekarang), supaya periode baru menyambung PERSIS dari akhir
 * periode berjalan, tidak memotong sisa hari yang sudah dibayar sebelumnya
 * (mis. dibayar tanggal 24 Agustus utk periode berikutnya harus tetap
 * dihitung mulai dari 31 Agustus, bukan dari 24 Agustus). Ini mencerminkan
 * logika yang sama di midtrans-webhook/index.ts untuk baris `periode_bulan`.
 * Dipakai HANYA sebagai fallback simulasi lokal (Supabase tidak
 * dikonfigurasi) -- alur produksi sungguhan (Midtrans nyata) diproses lewat
 * webhook itu.
 */
export async function konfirmasiPembayaranBulanBerikutnya(pembayaranId: string, langgananId: string): Promise<void> {
  const client = klienWajibAda();

  const { data: langgananSaatIni, error: errBaca } = await client
    .from('langganan')
    .select('tanggal_berakhir')
    .eq('id', langgananId)
    .single();
  if (errBaca) throw errBaca;

  const basisMulai = new Date(langgananSaatIni.tanggal_berakhir);
  const berakhir = new Date(basisMulai);
  berakhir.setDate(berakhir.getDate() + 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { error: errPembayaran } = await client
    .from('pembayaran')
    .update({ status: 'lunas', tanggal_pembayaran: ambilWaktuSekarang().toISOString() })
    .eq('id', pembayaranId);
  if (errPembayaran) throw errPembayaran;

  const { error: errLangganan } = await client
    .from('langganan')
    .update({
      sudah_dibayar: true,
      tanggal_mulai: fmt(basisMulai),
      tanggal_berakhir: fmt(berakhir),
      tanggal_jatuh_tempo: fmt(berakhir)
    })
    .eq('id', langgananId);
  if (errLangganan) throw errLangganan;
}

// Fungsi baca/tandai-dibaca notifikasi DIPINDAH ke notifikasiLayanan.ts --
// dipakai bersama oleh Orang Tua, Supir, dan Admin (sebelumnya cuma di sini,
// khusus Orang Tua). Lihat juga kirimNotifikasi/kirimNotifikasiKeAdmin di
// sana untuk mengirim notifikasi lintas peran.

// ==========================================
// Penilaian Supir
// ==========================================

export async function ambilPenilaianOrangTua(orangTuaId: string): Promise<PenilaianRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('penilaian')
    .select('*')
    .eq('orang_tua_id', orangTuaId);
  if (error) throw error;
  return (data as PenilaianRow[]) ?? [];
}

export async function ambilPenilaianUntukPerjalanan(
  orangTuaId: string,
  perjalananId: string
): Promise<PenilaianRow | null> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('penilaian')
    .select('*')
    .eq('orang_tua_id', orangTuaId)
    .eq('perjalanan_id', perjalananId)
    .maybeSingle();
  if (error) throw error;
  return (data as PenilaianRow) ?? null;
}

export async function kirimPenilaian(params: {
  orangTuaId: string;
  supirId: string;
  perjalananId: string;
  bintang: number;
  komentar?: string;
}): Promise<PenilaianRow> {
  const client = klienWajibAda();

  const existing = await ambilPenilaianUntukPerjalanan(params.orangTuaId, params.perjalananId);
  if (existing) return existing;

  const { data, error } = await client
    .from('penilaian')
    .insert({
      orang_tua_id: params.orangTuaId,
      supir_id: params.supirId,
      perjalanan_id: params.perjalananId,
      bintang: params.bintang,
      komentar: params.komentar ?? null
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PenilaianRow;
}

// ==========================================
// Supir (untuk peta lokasi langsung)
// ==========================================

export async function ambilSupirById(supirId: string): Promise<SupirRow | null> {
  const client = klienWajibAda();
  const { data, error } = await client.from('supir').select('*').eq('id', supirId).maybeSingle();
  if (error) throw error;
  return (data as SupirRow) ?? null;
}

// ==========================================
// Jadwal Mingguan / Absen / Cuti / Perubahan Jadwal
// ==========================================

export async function ambilJadwalMingguan(anakId: string): Promise<JadwalMingguanRow | null> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('jadwal_mingguan')
    .select('*')
    .eq('anak_id', anakId)
    .maybeSingle();
  if (error) throw error;
  return (data as JadwalMingguanRow) ?? null;
}

export async function simpanJadwalMingguan(params: {
  anakId: string;
  senin: boolean;
  selasa: boolean;
  rabu: boolean;
  kamis: boolean;
  jumat: boolean;
  sabtu: boolean;
  minggu: boolean;
}): Promise<JadwalMingguanRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('jadwal_mingguan')
    .upsert(
      {
        anak_id: params.anakId,
        senin: params.senin,
        selasa: params.selasa,
        rabu: params.rabu,
        kamis: params.kamis,
        jumat: params.jumat,
        sabtu: params.sabtu,
        minggu: params.minggu
      },
      { onConflict: 'anak_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as JadwalMingguanRow;
}

// ==========================================
// Perubahan Jadwal Mingguan TERKENDALI (batas 2x/minggu + jendela waktu +
// riwayat + notifikasi) -- BERBEDA dari simpanJadwalMingguan() polos di
// atas, yang TETAP dipakai apa adanya oleh wizard pendaftaran/reaktivasi
// (HalamanBerlangganan.vue) karena penyetelan jadwal PERTAMA KALI bukan
// "perubahan" dan tidak boleh terkena kuota/jendela waktu. Fungsi di bawah
// ini KHUSUS dipakai tombol "Simpan Perubahan Jadwal" di JadwalOrangTua.vue
// (mengubah jadwal akun yang SUDAH aktif berlangganan).
// ==========================================

const BATAS_PERUBAHAN_JADWAL_PER_MINGGU = 2;

export interface KuotaPerubahanJadwal {
  sudahDipakai: number;
  batas: number;
  sisa: number;
}

const NAMA_HARI_POLA: (keyof PolaHariJadwal)[] = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const LABEL_HARI_POLA: Record<keyof PolaHariJadwal, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu'
};

/**
 * Rentang minggu kalender (Senin 00:00 WIB s.d. Senin berikutnya 00:00 WIB)
 * yang memuat `acuan`, dikembalikan sbg ISO timestamp UTC supaya bisa
 * langsung dipakai filter .gte()/.lt() pada kolom timestamptz.
 *
 * SENGAJA default ke `new Date()` (waktu ASLI), BUKAN `ambilWaktuSekarang()`
 * (waktu simulasi) -- fungsi ini dipakai ambilKuotaPerubahanJadwal() untuk
 * membatasi query terhadap kolom `dibuat_pada`, yaitu timestamp SERVER
 * Supabase yang sungguhan dan tidak bisa dipengaruhi simulasi waktu di
 * klien. Kalau default-nya waktu simulasi, begitu simulasi bergeser ke
 * minggu kalender yang beda dari minggu ASLI saat baris riwayat baru saja
 * disimpan (dibuat_pada = waktu server asli), rentang minggu yang dihitung
 * di sini tidak lagi memuat baris tsb -- count kembali ke 0 dan "sisa kuota"
 * di UI terlihat seolah tidak berkurang meski perubahan baru saja berhasil
 * disimpan.
 */
function rentangMingguIniWib(acuan: Date = new Date()): { mulai: string; selesai: string } {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wib = new Date(acuan.getTime() + WIB_OFFSET_MS);
  const hari = wib.getUTCDay(); // 0 = Minggu .. 6 = Sabtu
  const jarakKeSenin = hari === 0 ? 6 : hari - 1;
  const seninWib = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - jarakKeSenin));
  const seninUtc = new Date(seninWib.getTime() - WIB_OFFSET_MS);
  const seninBerikutnyaUtc = new Date(seninUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { mulai: seninUtc.toISOString(), selesai: seninBerikutnyaUtc.toISOString() };
}

export async function ambilKuotaPerubahanJadwal(anakId: string): Promise<KuotaPerubahanJadwal> {
  const client = klienWajibAda();
  const { mulai, selesai } = rentangMingguIniWib();
  const { count, error } = await client
    .from('riwayat_perubahan_jadwal_mingguan')
    .select('*', { count: 'exact', head: true })
    .eq('anak_id', anakId)
    .gte('dibuat_pada', mulai)
    .lt('dibuat_pada', selesai);
  if (error) throw error;
  const sudahDipakai = count ?? 0;
  return {
    sudahDipakai,
    batas: BATAS_PERUBAHAN_JADWAL_PER_MINGGU,
    sisa: Math.max(0, BATAS_PERUBAHAN_JADWAL_PER_MINGGU - sudahDipakai)
  };
}

export async function ambilRiwayatPerubahanJadwalMingguan(anakId: string): Promise<RiwayatPerubahanJadwalMingguanRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('riwayat_perubahan_jadwal_mingguan')
    .select('*')
    .eq('anak_id', anakId)
    .order('dibuat_pada', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as RiwayatPerubahanJadwalMingguanRow[]) ?? [];
}

// Kalimat ringkas perbedaan dua pola hari, mis. "Sabtu: Tidak Aktif -> Aktif"
// -- dipakai isi notifikasi & (opsional) tampilan riwayat. Kalau tidak ada
// hari yang berubah sama sekali, kembalikan string kosong (caller
// menganggap ini "tidak ada perubahan nyata").
function ringkasPerubahanPolaHari(sebelum: PolaHariJadwal, sesudah: PolaHariJadwal): string {
  const perubahan: string[] = [];
  for (const hari of NAMA_HARI_POLA) {
    if (sebelum[hari] !== sesudah[hari]) {
      perubahan.push(`${LABEL_HARI_POLA[hari]}: ${sebelum[hari] ? 'Aktif' : 'Tidak Aktif'} -> ${sesudah[hari] ? 'Aktif' : 'Tidak Aktif'}`);
    }
  }
  return perubahan.join(', ');
}

export async function ubahJadwalMingguan(params: {
  anakId: string;
  namaAnak: string;
  senin: boolean;
  selasa: boolean;
  rabu: boolean;
  kamis: boolean;
  jumat: boolean;
  sabtu: boolean;
  minggu: boolean;
}): Promise<{ kuota: KuotaPerubahanJadwal; adaPerubahan: boolean }> {
  const client = klienWajibAda();

  // Jendela waktu SAMA dengan jendela pengisian absensi (17:00 WIB H-1 s.d.
  // 06:30 WIB hari-H) -- SENGAJA dibalik maknanya di sini: perubahan jadwal
  // justru DIBLOKIR selagi jendela absensi terbuka (periode itu supir/admin
  // sedang aktif menyiapkan penugasan hari berikutnya), supaya tidak
  // mengacaukan absensi yang sedang berjalan (lihat requirement #5).
  if (apakahJendelaAbsensiTerbuka()) {
    throw new Error(
      'Perubahan jadwal tidak dapat dilakukan mendekati waktu absensi (17:00 WIB s.d. 06:30 WIB) supaya tidak mengganggu absensi yang sedang berjalan. Silakan coba lagi setelah pukul 06:30 WIB.'
    );
  }

  const kuota = await ambilKuotaPerubahanJadwal(params.anakId);
  if (kuota.sisa <= 0) {
    throw new Error(
      'Batas perubahan jadwal minggu ini sudah mencapai maksimal 2 kali. Silakan lakukan perubahan kembali pada minggu berikutnya.'
    );
  }

  const jadwalSesudah: PolaHariJadwal = {
    senin: params.senin, selasa: params.selasa, rabu: params.rabu, kamis: params.kamis,
    jumat: params.jumat, sabtu: params.sabtu, minggu: params.minggu
  };

  const jadwalLama = await ambilJadwalMingguan(params.anakId);
  const jadwalSebelum: PolaHariJadwal = jadwalLama
    ? {
        senin: jadwalLama.senin, selasa: jadwalLama.selasa, rabu: jadwalLama.rabu, kamis: jadwalLama.kamis,
        jumat: jadwalLama.jumat, sabtu: jadwalLama.sabtu, minggu: jadwalLama.minggu
      }
    : { senin: true, selasa: true, rabu: true, kamis: true, jumat: true, sabtu: false, minggu: false };

  const ringkasan = ringkasPerubahanPolaHari(jadwalSebelum, jadwalSesudah);
  if (!ringkasan) {
    // Tidak ada hari yang benar-benar berubah -- tidak perlu proses apa pun
    // (kuota, riwayat, notifikasi TIDAK terpakai untuk "perubahan" kosong).
    return { kuota, adaPerubahan: false };
  }

  await simpanJadwalMingguan({ anakId: params.anakId, ...jadwalSesudah });

  const { error: errRiwayat } = await client.from('riwayat_perubahan_jadwal_mingguan').insert({
    anak_id: params.anakId,
    jadwal_sebelum: jadwalSebelum,
    jadwal_sesudah: jadwalSesudah
  });
  if (errRiwayat) throw errRiwayat;

  // Notifikasi HANYA dikirim setelah berhasil disimpan (bukan saat checkbox
  // berubah) -- ke Admin (selalu) dan ke supir yang sedang punya penugasan
  // mendatang utk anak ini (kalau ada), supaya keduanya tahu pola jadwal
  // baru sebelum sempat menyusun/menjalankan rute berikutnya. Kegagalan
  // kirim notifikasi (mis. migrasi SQL notifikasi belum dijalankan) TIDAK
  // BOLEH membatalkan perubahan jadwal yang sudah tersimpan di atas --
  // notifikasi ini best-effort, dibungkus try/catch sendiri-sendiri.
  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Perubahan Jadwal Mingguan',
      pesan: `${params.namaAnak}: ${ringkasan}`,
      tipe: 'sistem',
      idTerkait: params.anakId,
      tipeTerkait: 'jadwal_mingguan_diubah'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi perubahan jadwal mingguan ke admin:', err);
  }

  try {
    const hariIni = ambilTanggalWibSekarang();
    const { data: perjalananMendatang } = await client
      .from('perjalanan')
      .select('supir_id')
      .eq('anak_id', params.anakId)
      .eq('status', 'dijadwalkan')
      .gte('tanggal_perjalanan', hariIni);
    const supirIds = Array.from(new Set((perjalananMendatang ?? []).map((p: any) => p.supir_id).filter(Boolean)));
    for (const supirId of supirIds) {
      await kirimNotifikasi({
        penggunaId: supirId,
        judul: 'Perubahan Jadwal Mingguan Anak',
        pesan: `${params.namaAnak}: ${ringkasan}`,
        tipe: 'perjalanan',
        idTerkait: params.anakId,
        tipeTerkait: 'jadwal_mingguan_diubah'
      });
    }
  } catch {
    // Kegagalan mengirim notifikasi ke supir TIDAK boleh membatalkan
    // perubahan jadwal yang sudah tersimpan -- cukup dilewati.
  }

  const kuotaBaru = await ambilKuotaPerubahanJadwal(params.anakId);
  return { kuota: kuotaBaru, adaPerubahan: true };
}

export async function ajukanAbsenHarian(params: {
  anakId: string;
  tanggal: string;
  status: 'masuk' | 'tidak_masuk';
}): Promise<PengajuanAbsenRow> {
  // Penegakan sisi server (bukan cuma disable tombol di UI) -- konsisten
  // dengan perbaruiStatusKehadiran() milik supir di supirLayanan.ts, supaya
  // pengajuan tidak bisa "diselundupkan" lewat panggilan API langsung di
  // luar jendela 17:00 WIB (H-1) s.d. 06:30 WIB (hari-H).
  if (!apakahJendelaAbsensiTerbuka()) {
    throw new Error(
      'Pengisian absensi hanya dibuka pukul 17:00 WIB (H-1) sampai 06:30 WIB (hari-H). Silakan isi kembali setelah pukul 17:00 WIB.'
    );
  }

  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_absen')
    .upsert(
      { anak_id: params.anakId, tanggal: params.tanggal, status: params.status },
      { onConflict: 'anak_id,tanggal' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as PengajuanAbsenRow;
}

export async function ambilRiwayatAbsen(anakId: string): Promise<PengajuanAbsenRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_absen')
    .select('*')
    .eq('anak_id', anakId)
    .order('tanggal', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as PengajuanAbsenRow[]) ?? [];
}

/**
 * Membatalkan (status 'dibatalkan') baris `perjalanan` anak yang masih
 * 'dijadwalkan' dan jatuh di dalam rentang tanggal cuti -- supaya cuti yang
 * diajukan/diubah SETELAH admin sempat membuat penugasan untuk tanggal itu
 * tetap benar-benar mengeluarkan anak dari daftar jemputan supir (bukan
 * cuma mencegah penugasan BARU). Tidak menyentuh baris yang sudah berjalan
 * (status selain 'dijadwalkan') -- supir yang sedang di tengah perjalanan
 * tidak boleh tiba-tiba dibatalkan oleh perubahan data cuti.
 */
async function batalkanPerjalananDalamRentangCuti(
  client: NonNullable<typeof supabase>,
  anakId: string,
  tanggalMulai: string,
  tanggalSelesai: string
): Promise<void> {
  const { error } = await client
    .from('perjalanan')
    .update({ status: 'dibatalkan' })
    .eq('anak_id', anakId)
    .eq('status', 'dijadwalkan')
    .gte('tanggal_perjalanan', tanggalMulai)
    .lte('tanggal_perjalanan', tanggalSelesai);
  if (error) throw error;
}

export async function ajukanCuti(params: {
  anakId: string;
  namaAnak: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
}): Promise<PengajuanCutiRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_cuti')
    .insert({
      anak_id: params.anakId,
      tanggal_mulai: params.tanggalMulai,
      tanggal_selesai: params.tanggalSelesai,
      alasan: params.alasan
    })
    .select('*')
    .single();
  if (error) throw error;
  await batalkanPerjalananDalamRentangCuti(client, params.anakId, params.tanggalMulai, params.tanggalSelesai);

  // Beritahu Admin -- cuti mengubah anak mana yang tersedia utk ditugaskan
  // pada rentang tanggal ini (lihat saringAnakTersediaUntukTanggal di
  // adminLayanan.ts), jadi Admin perlu tahu tanpa harus rutin mengecek
  // menu Kelola Jadwal. Best-effort: kegagalan kirim notifikasi (mis.
  // migrasi SQL notifikasi belum dijalankan) TIDAK BOLEH membuat pengajuan
  // cuti yang sudah tersimpan di atas gagal dikembalikan ke pemanggil.
  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Pengajuan Cuti Baru',
      pesan: `${params.namaAnak} mengajukan cuti ${params.tanggalMulai} s/d ${params.tanggalSelesai}. Alasan: ${params.alasan}.`,
      tipe: 'sistem',
      idTerkait: data.id,
      tipeTerkait: 'pengajuan_cuti'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi pengajuan cuti ke admin:', err);
  }

  return data as PengajuanCutiRow;
}

/**
 * Ubah tanggal/alasan pengajuan cuti yang SUDAH tersimpan -- rentang BARU
 * langsung dipakai untuk membatalkan penugasan yang mungkin sudah dibuat
 * di tanggal barunya (lihat batalkanPerjalananDalamRentangCuti()). Tanggal
 * LAMA yang sudah tidak termasuk rentang baru sengaja TIDAK memulihkan
 * baris `perjalanan` yang mungkin sudah dibatalkan sebelumnya -- Admin
 * perlu membuat penugasan baru secara manual untuk tanggal itu, sama
 * seperti alur normal "anak baru tersedia lagi" setelah cuti dihapus.
 */
export async function perbaruiCuti(
  cutiId: string,
  params: { anakId: string; tanggalMulai: string; tanggalSelesai: string; alasan: string }
): Promise<PengajuanCutiRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_cuti')
    .update({
      tanggal_mulai: params.tanggalMulai,
      tanggal_selesai: params.tanggalSelesai,
      alasan: params.alasan
    })
    .eq('id', cutiId)
    .select('*')
    .single();
  if (error) throw error;
  await batalkanPerjalananDalamRentangCuti(client, params.anakId, params.tanggalMulai, params.tanggalSelesai);
  return data as PengajuanCutiRow;
}

/**
 * Hapus pengajuan cuti -- begitu baris ini hilang, saringAnakTersediaUntukTanggal()
 * di adminLayanan.ts otomatis tidak lagi mengecualikan anak ini pada tanggal
 * tersebut, sehingga anak kembali tersedia untuk penugasan Admin berikutnya
 * ("kembali ke jadwal normal" sesuai permintaan) tanpa perlu memulihkan
 * baris `perjalanan` yang mungkin sudah dibatalkan secara manual.
 *
 * `.select('id')` WAJIB ada di sini: kalau RLS diam-diam menolak (mis.
 * migrasi kebijakan UPDATE/DELETE pengajuan_cuti belum dijalankan di
 * Supabase), PostgREST TIDAK melempar error untuk DELETE yang tidak
 * mengenai baris apa pun -- ia cuma mengembalikan array kosong dengan
 * status sukses. Tanpa pengecekan panjang array ini, UI akan optimis
 * menghapus baris dari daftar lokal padahal baris di database masih ada,
 * sehingga tetap muncul di panel Admin.
 */
export async function hapusCuti(cutiId: string): Promise<void> {
  const client = klienWajibAda();
  const { data, error } = await client.from('pengajuan_cuti').delete().eq('id', cutiId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'Pengajuan cuti tidak berhasil dihapus di database (kemungkinan izin akses belum diperbarui). Silakan hubungi admin/developer untuk menjalankan migrasi terbaru.'
    );
  }
}

export async function ambilRiwayatCuti(anakId: string): Promise<PengajuanCutiRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_cuti')
    .select('*')
    .eq('anak_id', anakId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;
  return (data as PengajuanCutiRow[]) ?? [];
}

function buatIdPesananPerubahanJadwal(): string {
  return `ORDER-DNT-JDW-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Setelah pengajuan PERUBAHAN WAKTU/HARI tersimpan, sinkronkan ke tabel
 * `perjalanan` operasional (yang dipakai Admin "Penugasan Supir -> Jadwal
 * Jemput" & Supir "Tugas Hari Ini").
 *
 * ATURAN BISNIS: perubahan waktu/hari SELALU membatalkan penugasan yang
 * sudah diberikan Admin (kalau ada) -- anak WAJIB ditugaskan ulang secara
 * manual oleh Admin sesuai jadwal terbaru, TIDAK PERNAH dipertahankan diam-
 * diam dengan supir yang sama (beda dari perubahan ALAMAT SAJA, yang
 * ditangani terpisah lewat perbaruiAlamatAnak() -- tidak pernah lewat
 * fungsi ini sama sekali, karena alamat saja tidak mempengaruhi jam/hari
 * operasional, jadi anak boleh tetap di penugasan yang sama). Baris lama
 * ditandai 'dibatalkan' (BUKAN dihapus -- tetap tersimpan sbg histori),
 * supirnya (kalau sudah ditugaskan) diberi tahu. Sengaja TIDAK PERNAH
 * otomatis menyambung ke/membuat baris baru untuk tanggal barunya --
 * notifikasi ke Admin (dikirim pemanggil) sudah cukup memberi tahu supaya
 * anak ini di-assign ulang saat Admin membuat penugasan berikutnya.
 */
async function sinkronkanPerjalananSetelahPerubahanJadwal(
  client: NonNullable<typeof supabase>,
  params: {
    anakId: string;
    namaAnak: string;
    jenisPerubahan: 'pergi' | 'pulang';
    tanggalBaru: string;
    waktuBaru: string;
    alamatBaru: string;
  }
): Promise<{ perjalananLamaId: string | null }> {
  const jenisSesi = params.jenisPerubahan === 'pergi' ? 'pagi' : 'sore';

  const { data: perjalananTerdekat } = await client
    .from('perjalanan')
    .select('id, tanggal_perjalanan, supir_id')
    .eq('anak_id', params.anakId)
    .eq('jenis_perjalanan', jenisSesi)
    .eq('status', 'dijadwalkan')
    .gte('tanggal_perjalanan', ambilTanggalWibSekarang())
    .order('tanggal_perjalanan', { ascending: true })
    .limit(1)
    .maybeSingle();

  let perjalananLamaId: string | null = null;
  if (perjalananTerdekat) {
    perjalananLamaId = perjalananTerdekat.id;
    await client
      .from('perjalanan')
      .update({
        status: 'dibatalkan',
        catatan: `Dibatalkan otomatis -- orang tua mengajukan perubahan jadwal (waktu/hari) ${params.jenisPerubahan === 'pergi' ? 'berangkat' : 'pulang'} menjadi pukul ${params.waktuBaru} tanggal ${formatTanggalIndonesiaDenganHari(params.tanggalBaru)}. Menunggu penugasan ulang oleh Admin.`
      })
      .eq('id', perjalananTerdekat.id);

    if (perjalananTerdekat.supir_id) {
      try {
        await kirimNotifikasi({
          penggunaId: perjalananTerdekat.supir_id,
          judul: 'Penjemputan/Pengantaran Dibatalkan',
          pesan: `${params.namaAnak} mengajukan perubahan jadwal -- penjemputan/pengantaran tanggal ${formatTanggalIndonesiaDenganHari(perjalananTerdekat.tanggal_perjalanan)} DIBATALKAN, menunggu penugasan ulang dari Admin.`,
          tipe: 'perjalanan',
          idTerkait: perjalananTerdekat.id,
          tipeTerkait: 'penugasan_dibatalkan'
        });
      } catch (err) {
        console.error('Gagal kirim notifikasi penjemputan/pengantaran dibatalkan ke supir:', err);
      }
    }
  }

  return { perjalananLamaId };
}

/**
 * Sinkronkan ke tabel `perjalanan` operasional & beritahu Admin -- dipanggil
 * SETELAH pengajuan berstatus 'disetujui' (langsung, kalau tidak ada biaya
 * tambahan; atau setelah pembayaran lunas, lihat
 * konfirmasiPembayaranPerubahanJadwal()). Dipisah dari transisi status itu
 * sendiri supaya pemanggil bisa memilih perlu-tidaknya UPDATE status
 * (baris yang di-insert langsung sbg 'disetujui' tidak perlu di-UPDATE lagi
 * ke nilai yang sama -- RLS Orang Tua hanya mengizinkan transisi
 * 'menunggu' -> 'disetujui', bukan 'disetujui' -> 'disetujui').
 */
async function sinkronDanBeritahuAdminPerubahanJadwal(
  client: NonNullable<typeof supabase>,
  pengajuanId: string,
  params: {
    anakId: string;
    namaAnak: string;
    jenisPerubahan: 'pergi' | 'pulang';
    tanggal: string;
    waktuBaru: string;
    alamatBaru: string;
  }
): Promise<void> {
  // Sinkronkan ke tabel perjalanan operasional -- lihat catatan lengkap di
  // sinkronkanPerjalananSetelahPerubahanJadwal(). Best-effort: kegagalan di
  // sini TIDAK BOLEH membatalkan pengajuan yang sudah tersimpan, karena
  // bagaimanapun Admin masih diberi tahu lewat notifikasi di bawah.
  try {
    const { perjalananLamaId } = await sinkronkanPerjalananSetelahPerubahanJadwal(client, {
      anakId: params.anakId,
      namaAnak: params.namaAnak,
      jenisPerubahan: params.jenisPerubahan,
      tanggalBaru: params.tanggal,
      waktuBaru: params.waktuBaru,
      alamatBaru: params.alamatBaru
    });
    // Simpan referensi baris perjalanan yang terdampak -- WAJIB utk
    // rollback presisi kalau pengajuan ini nanti diedit/dibatalkan lewat
    // editPengajuanPerubahanJadwalAktif()/batalkanPengajuanPerubahanJadwalAktif().
    // perjalanan_baru_id SELALU null sekarang -- perubahan waktu/hari tidak
    // pernah otomatis menyambung ke baris baru, lihat catatan fungsi di atas.
    await client
      .from('pengajuan_perubahan_jadwal')
      .update({ perjalanan_lama_id: perjalananLamaId, perjalanan_baru_id: null })
      .eq('id', pengajuanId);
  } catch {
    // Biarkan gagal senyap -- lihat catatan di atas.
  }

  // Beritahu Admin -- perubahan jadwal ini otomatis berlaku (tidak ada alur
  // persetujuan terpisah), dan penugasan lama (kalau ada) sudah otomatis
  // dibatalkan (lihat sinkronkanPerjalananSetelahPerubahanJadwal) -- Admin
  // WAJIB menugaskan ulang anak ini sesuai jadwal terbaru. Best-effort,
  // lihat catatan yang sama di ajukanCuti()/ubahJadwalMingguan().
  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Pengajuan Perubahan Jadwal -- Perlu Penugasan Ulang',
      pesan: `${params.namaAnak} mengajukan perubahan jadwal ${params.jenisPerubahan === 'pergi' ? 'Pergi' : 'Pulang'} tanggal ${formatTanggalIndonesiaDenganHari(params.tanggal)} menjadi pukul ${params.waktuBaru}. Alamat ${params.jenisPerubahan === 'pergi' ? 'penjemputan' : 'pengantaran'} baru: ${params.alamatBaru}. Penugasan lama (kalau ada) sudah dibatalkan otomatis -- mohon tugaskan ulang.`,
      tipe: 'sistem',
      idTerkait: pengajuanId,
      tipeTerkait: 'pengajuan_perubahan_jadwal'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi pengajuan perubahan jadwal ke admin:', err);
  }
}

/**
 * Lempar error kalau supir SUDAH mulai menjalankan penjemputan/pengantaran
 * anak (baris `perjalanan` sesi pagi/sore tanggal tsb sudah lewat status
 * 'dijadwalkan') -- dipakai baik saat mengajukan baru maupun
 * mengedit/membatalkan pengajuan yang sudah 'disetujui'.
 */
async function pastikanBelumDijalankanSupir(
  client: NonNullable<typeof supabase>,
  anakId: string,
  jenisPerubahan: 'pergi' | 'pulang',
  tanggal: string
): Promise<void> {
  const jenisSesi = jenisPerubahan === 'pergi' ? 'pagi' : 'sore';
  const { data: perjalananBerjalan } = await client
    .from('perjalanan')
    .select('status')
    .eq('anak_id', anakId)
    .eq('jenis_perjalanan', jenisSesi)
    .eq('tanggal_perjalanan', tanggal)
    .neq('status', 'dijadwalkan')
    .neq('status', 'dibatalkan')
    .maybeSingle();
  if (perjalananBerjalan) {
    throw new Error(
      `Jadwal ${jenisPerubahan === 'pergi' ? 'keberangkatan' : 'kepulangan'} tanggal ${formatTanggalIndonesiaDenganHari(tanggal)} tidak dapat diubah lagi karena sudah digunakan dalam operasional (supir sudah mulai menjalankan penjemputan/pengantaran).`
    );
  }
}

/**
 * Ajukan perubahan jadwal jemput/antar khusus (di luar jadwal normal langganan
 * bulanan anak) -- biaya tambahannya dihitung berbasis jarak lewat
 * hitungBiayaPerubahanJadwal() (tarifLayanan.ts, parameter
 * biaya_minimal_perubahan_jadwal terpisah dari biaya_minimal_harian).
 *
 * Kalau ada biaya tambahan (> 0), pengajuan disimpan dgn status 'menunggu'
 * beserta baris `pembayaran` berstatus 'menunggu' (BELUM lunas) -- pemanggil
 * (JadwalOrangTua.vue) WAJIB mengarahkan pengguna ke gerbang pembayaran
 * (simulator Midtrans Snap) dan baru memanggil
 * konfirmasiPembayaranPerubahanJadwal() setelah pembayaran itu selesai.
 * Sinkronisasi ke tabel `perjalanan` operasional & notifikasi ke Admin BARU
 * dijalankan di titik itu (bukan di sini), supaya jadwal tidak dianggap
 * berlaku sebelum benar-benar dibayar.
 *
 * Kalau tidak ada biaya tambahan (jarak 0/dalam radius gratis), pengajuan
 * langsung berlaku efektif tanpa perlu ke gerbang pembayaran sama sekali.
 */
export async function ajukanPerubahanJadwal(params: {
  anakId: string;
  namaAnak: string;
  orangTuaId: string;
  tanggal: string;
  waktuBaru: string;
  biayaTambahan: number;
  jenisPerubahan: 'pergi' | 'pulang';
  alamatBaru: string;
  lintangBaru: number;
  bujurBaru: number;
}): Promise<{
  pengajuan: PengajuanPerubahanJadwalRow;
  perluBayar: boolean;
  pembayaranId: string | null;
  idPesananMidtrans: string | null;
}> {
  if (params.tanggal < ambilTanggalWibSekarang()) {
    throw new Error('Tanggal perubahan jadwal tidak boleh sebelum hari ini.');
  }

  const client = klienWajibAda();

  // Kalau supir SUDAH mulai menjalankan penjemputan/pengantaran (sesi
  // pagi/sore yang bersangkutan sudah lewat status 'dijadwalkan'), jadwal
  // itu tidak boleh diubah lagi -- terlepas dari jendela waktu 00:00-15:00
  // WIB di atas masih terbuka atau tidak.
  await pastikanBelumDijalankanSupir(client, params.anakId, params.jenisPerubahan, params.tanggal);

  // Satu jadwal (anak + tanggal + jenis pergi/pulang) hanya boleh punya SATU
  // pengajuan aktif ('menunggu' atau 'disetujui') pada satu waktu --
  // SEBELUMNYA tidak ada pengecekan ini sama sekali, jadi pengguna yang
  // mengulang klik "Ajukan Perubahan" (mis. karena gerbang pembayaran
  // Midtrans terasa lambat/gagal) bisa membuat banyak baris duplikat untuk
  // jadwal yang sama persis, membanjiri Riwayat Pengajuan Perubahan dengan
  // entri "Dibatalkan" berulang. Kalau pengajuan aktif sudah ada, arahkan
  // pengguna mengedit yang itu (fitur edit sudah ada di JadwalOrangTua.vue),
  // bukan membuat baris baru lagi.
  const { data: pengajuanAktif, error: errCekAktif } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('id, status, pembayaran_id')
    .eq('anak_id', params.anakId)
    .eq('tanggal', params.tanggal)
    .eq('jenis_perubahan', params.jenisPerubahan)
    .in('status', ['menunggu', 'disetujui']);
  if (errCekAktif) throw errCekAktif;

  if (pengajuanAktif && pengajuanAktif.length > 0) {
    const aktif = pengajuanAktif[0];
    if (aktif.status === 'disetujui') {
      throw new Error(
        `Sudah ada pengajuan perubahan jadwal ${params.jenisPerubahan === 'pergi' ? 'berangkat' : 'pulang'} untuk tanggal ini. Silakan edit pengajuan yang sudah ada di Riwayat Pengajuan Perubahan, bukan mengajukan baru.`
      );
    } else if (aktif.status === 'menunggu') {
      // Hapus pengajuan lama yang belum dibayar agar pengguna bisa mengajukan & membayar kembali
      const { error: errDelPengajuan } = await client
        .from('pengajuan_perubahan_jadwal')
        .delete()
        .eq('id', aktif.id);
      if (errDelPengajuan) throw errDelPengajuan;

      if (aktif.pembayaran_id) {
        const { error: errDelPembayaran } = await client
          .from('pembayaran')
          .delete()
          .eq('id', aktif.pembayaran_id);
        if (errDelPembayaran) throw errDelPembayaran;
      }
    }
  }

  const perluBayar = params.biayaTambahan > 0;

  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .insert({
      anak_id: params.anakId,
      tanggal: params.tanggal,
      waktu_baru: params.waktuBaru,
      biaya_tambahan: params.biayaTambahan,
      jenis_perubahan: params.jenisPerubahan,
      alamat_baru: params.alamatBaru,
      lintang_baru: params.lintangBaru,
      bujur_baru: params.bujurBaru,
      status: perluBayar ? 'menunggu' : 'disetujui'
    })
    .select('*')
    .single();
  if (error) throw error;

  if (!perluBayar) {
    // Baris sudah di-insert langsung sbg 'disetujui' -- tidak perlu UPDATE
    // status lagi, tinggal sinkronkan & beritahu Admin.
    await sinkronDanBeritahuAdminPerubahanJadwal(client, data.id, params);
    return { pengajuan: data as PengajuanPerubahanJadwalRow, perluBayar: false, pembayaranId: null, idPesananMidtrans: null };
  }

  const { data: pembayaran, error: errBayar } = await client
    .from('pembayaran')
    .insert({
      orang_tua_id: params.orangTuaId,
      jumlah: params.biayaTambahan,
      tipe_pembayaran: 'tambahan',
      status: 'menunggu',
      id_pesanan_midtrans: buatIdPesananPerubahanJadwal()
    })
    .select('id, id_pesanan_midtrans')
    .single();
  if (errBayar) throw errBayar;

  // Tempelkan pembayaran_id ke pengajuan (status TETAP 'menunggu', diizinkan
  // policy UPDATE yang sama) -- WAJIB supaya hapusPengajuanPerubahanJadwal()
  // tahu baris `pembayaran` mana yang harus ikut dibatalkan kalau pengajuan
  // ini dihapus sebelum dibayar (tanpa link ini, baris pembayaran 'menunggu'
  // akan jadi yatim & keliru terpakai fitur "Ajukan Penundaan Pembayaran" di
  // RiwayatPembayaran.vue, yang mencari SEMBARANG baris berstatus
  // 'menunggu' milik akun tsb).
  await client.from('pengajuan_perubahan_jadwal').update({ pembayaran_id: pembayaran.id }).eq('id', data.id);

  return {
    pengajuan: { ...data, pembayaran_id: pembayaran.id } as PengajuanPerubahanJadwalRow,
    perluBayar: true,
    pembayaranId: pembayaran.id,
    idPesananMidtrans: pembayaran.id_pesanan_midtrans
  };
}

/**
 * Dipanggil SETELAH prosesPembayaranMidtrans() (midtransLayanan.ts)
 * mengonfirmasi baris `pembayaran` terkait sudah 'lunas' -- lunasnya
 * pembayaran itu sendiri SUDAH ditetapkan oleh webhook Midtrans yang
 * berwenang (lihat supabase/functions/midtrans-webhook/index.ts), BUKAN di
 * sini, jadi fungsi ini tidak lagi menyentuh status `pembayaran` (dulu
 * ditulis langsung dari client sebagai simulasi, sebelum integrasi
 * Midtrans Snap sungguhan dipasang di alur ini). Yang dilakukan di sini
 * murni menandai pengajuan berlaku, menyinkronkan tabel `perjalanan`, dan
 * memberi tahu Admin.
 */
export async function konfirmasiPembayaranPerubahanJadwal(params: {
  pengajuanId: string;
  pembayaranId: string;
  anakId: string;
  namaAnak: string;
  jenisPerubahan: 'pergi' | 'pulang';
  tanggal: string;
  waktuBaru: string;
  alamatBaru: string;
}): Promise<PengajuanPerubahanJadwalRow> {
  const client = klienWajibAda();

  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .update({ status: 'disetujui' })
    .eq('id', params.pengajuanId)
    .select('*')
    .single();
  if (error) throw error;

  await sinkronDanBeritahuAdminPerubahanJadwal(client, params.pengajuanId, params);

  return data as PengajuanPerubahanJadwalRow;
}

/**
 * Perbaikan mandiri (self-healing) untuk pengajuan perubahan jadwal yang
 * "nyangkut" di status 'menunggu' padahal baris `pembayaran` terkait
 * SUDAH 'lunas' -- bisa terjadi kalau tab ditutup/koneksi terputus TEPAT di
 * antara Midtrans mengonfirmasi lunas dan konfirmasiPembayaranPerubahanJadwal()
 * sempat dipanggil (lihat bayarPerubahanJadwalMidtrans() di
 * JadwalOrangTua.vue) -- webhook Midtrans hanya melunaskan baris
 * `pembayaran`, TIDAK pernah menyentuh `pengajuan_perubahan_jadwal.status`
 * sama sekali, jadi tanpa langkah lanjutan itu kedua tabel bisa selamanya
 * tidak sinkron: pembayaran tercatat lunas tapi perubahan jadwalnya tidak
 * pernah benar-benar diterapkan/terlihat "Menunggu" di panel Admin. Dipanggil
 * best-effort setiap kali daftar pengajuan dimuat (Orang Tua maupun Admin).
 */
export async function rekonsiliasiPengajuanPerubahanJadwal(): Promise<void> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('id, anak_id, jenis_perubahan, tanggal, waktu_baru, alamat_baru, pembayaran_id, anak(nama_lengkap), pembayaran(status)')
    .eq('status', 'menunggu')
    .not('pembayaran_id', 'is', null);
  if (error) throw error;

  const perluDisinkron = ((data ?? []) as any[]).filter((p) => p.pembayaran?.status === 'lunas');
  for (const p of perluDisinkron) {
    try {
      await konfirmasiPembayaranPerubahanJadwal({
        pengajuanId: p.id,
        pembayaranId: p.pembayaran_id,
        anakId: p.anak_id,
        namaAnak: p.anak?.nama_lengkap ?? '-',
        jenisPerubahan: p.jenis_perubahan,
        tanggal: p.tanggal,
        waktuBaru: p.waktu_baru,
        alamatBaru: p.alamat_baru
      });
    } catch (err) {
      console.error('Gagal merekonsiliasi pengajuan perubahan jadwal', p.id, err);
    }
  }
}

export async function ambilRiwayatPerubahanJadwal(anakId: string): Promise<PengajuanPerubahanJadwalRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('*')
    .eq('anak_id', anakId)
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;
  return (data as PengajuanPerubahanJadwalRow[]) ?? [];
}

/**
 * Ubah pengajuan perubahan jadwal yang MASIH 'menunggu' (belum dibayar,
 * belum berlaku/disinkronkan) -- RLS menolak kalau baris sudah 'disetujui'
 * (lihat migrasi "PENGAJUAN PERUBAHAN JADWAL DIGERBANG PEMBAYARAN"). Kalau
 * biaya tambahan berubah, baris `pembayaran` yang sudah ditempelkan turut
 * diperbarui jumlahnya supaya konsisten dgn yang ditampilkan di gerbang
 * pembayaran. Status TETAP 'menunggu' -- sinkronisasi ke jadwal supir &
 * notifikasi Admin baru terjadi setelah pembayaran dikonfirmasi ulang.
 */
export async function perbaruiPengajuanPerubahanJadwal(
  pengajuanId: string,
  params: {
    anakId: string;
    tanggal: string;
    waktuBaru: string;
    biayaTambahan: number;
    jenisPerubahan: 'pergi' | 'pulang';
    alamatBaru: string;
    lintangBaru: number;
    bujurBaru: number;
  }
): Promise<PengajuanPerubahanJadwalRow> {
  if (params.tanggal < ambilTanggalWibSekarang()) {
    throw new Error('Tanggal perubahan jadwal tidak boleh sebelum hari ini.');
  }

  const client = klienWajibAda();
  await pastikanBelumDijalankanSupir(client, params.anakId, params.jenisPerubahan, params.tanggal);
  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .update({
      tanggal: params.tanggal,
      waktu_baru: params.waktuBaru,
      biaya_tambahan: params.biayaTambahan,
      jenis_perubahan: params.jenisPerubahan,
      alamat_baru: params.alamatBaru,
      lintang_baru: params.lintangBaru,
      bujur_baru: params.bujurBaru
    })
    .eq('id', pengajuanId)
    .select('*')
    .single();
  if (error) throw error;

  const pengajuan = data as PengajuanPerubahanJadwalRow;
  if (pengajuan.pembayaran_id) {
    await client.from('pembayaran').update({ jumlah: params.biayaTambahan }).eq('id', pengajuan.pembayaran_id);
  }

  return pengajuan;
}

/**
 * Hapus pengajuan perubahan jadwal yang MASIH 'menunggu' -- membatalkan
 * juga baris `pembayaran` yang sudah ditempelkan (status -> 'gagal', BUKAN
 * dihapus, supaya tetap ada jejak) supaya tidak jadi baris 'menunggu' yatim
 * yang keliru terpakai fitur "Ajukan Penundaan Pembayaran" di
 * RiwayatPembayaran.vue (fitur itu mencari SEMBARANG baris 'menunggu' milik
 * akun, tanpa membedakan tipe_pembayaran).
 *
 * `.select('id')` WAJIB ada di sini -- lihat catatan yang sama di
 * hapusCuti() soal RLS yang gagal senyap pada DELETE.
 */
export async function hapusPengajuanPerubahanJadwal(pengajuanId: string): Promise<void> {
  const client = klienWajibAda();

  const { data: pengajuan, error: errBaca } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('pembayaran_id')
    .eq('id', pengajuanId)
    .single();
  if (errBaca) throw errBaca;

  const { data, error } = await client.from('pengajuan_perubahan_jadwal').delete().eq('id', pengajuanId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'Pengajuan tidak berhasil dihapus di database (kemungkinan izin akses belum diperbarui, atau pengajuan sudah berlaku sehingga tidak bisa dihapus lagi). Silakan hubungi admin/developer untuk menjalankan migrasi terbaru.'
    );
  }

  if (pengajuan?.pembayaran_id) {
    try {
      await client.from('pembayaran').update({ status: 'gagal' }).eq('id', pengajuan.pembayaran_id);
    } catch {
      // Biarkan gagal senyap -- pengajuan sudah berhasil terhapus di atas,
      // baris pembayaran yang gagal dibersihkan bukan alasan membatalkan itu.
    }
  }
}

/**
 * Kembalikan tabel `perjalanan` ke kondisi SEBELUM pengajuan perubahan
 * jadwal `pengajuan` disinkronkan (lihat sinkronkanPerjalananSetelahPerubahanJadwal())
 * -- dipakai baik saat mengedit maupun membatalkan pengajuan yang SUDAH
 * 'disetujui', supaya jadwal anak benar-benar kembali seperti semula
 * (bukan menyisakan baris 'dibatalkan' yang seharusnya masih aktif, atau
 * catatan perubahan yang seharusnya sudah tidak berlaku):
 *
 * - `perjalanan_lama_id` (kalau ada): baris yang tadinya dibatalkan
 *   otomatis -- dikembalikan ke status 'dijadwalkan', catatannya dibersihkan,
 *   supirnya (kalau ada) diberi tahu jadwal itu aktif kembali.
 * - `perjalanan_baru_id` (kalau ada): baris yang tadinya diperbarui
 *   catatannya -- catatan itu dikosongkan lagi, supirnya (kalau ada) diberi
 *   tahu perubahan itu dibatalkan.
 */
async function rollbackSinkronisasiPerjalanan(
  client: NonNullable<typeof supabase>,
  pengajuan: PengajuanPerubahanJadwalRow,
  namaAnak: string
): Promise<void> {
  if (pengajuan.perjalanan_lama_id) {
    const { data: perjalananLama } = await client
      .from('perjalanan')
      .select('id, tanggal_perjalanan, supir_id, status')
      .eq('id', pengajuan.perjalanan_lama_id)
      .maybeSingle();
    if (perjalananLama && perjalananLama.status === 'dibatalkan') {
      await client.from('perjalanan').update({ status: 'dijadwalkan', catatan: null }).eq('id', perjalananLama.id);
      if (perjalananLama.supir_id) {
        try {
          await kirimNotifikasi({
            penggunaId: perjalananLama.supir_id,
            judul: 'Penjemputan/Pengantaran Aktif Kembali',
            pesan: `${namaAnak}: pengajuan perubahan jadwal dibatalkan -- penjemputan/pengantaran tanggal ${formatTanggalIndonesiaDenganHari(perjalananLama.tanggal_perjalanan)} AKTIF KEMBALI seperti semula.`,
            tipe: 'perjalanan',
            idTerkait: perjalananLama.id,
            tipeTerkait: 'jadwal_mingguan_diubah'
          });
        } catch (err) {
          console.error('Gagal kirim notifikasi penjemputan/pengantaran aktif kembali ke supir:', err);
        }
      }
    }
  }

  if (pengajuan.perjalanan_baru_id) {
    const { data: perjalananBaru } = await client
      .from('perjalanan')
      .select('id, supir_id, status')
      .eq('id', pengajuan.perjalanan_baru_id)
      .maybeSingle();
    if (perjalananBaru && perjalananBaru.status !== 'dibatalkan') {
      await client.from('perjalanan').update({ catatan: null }).eq('id', perjalananBaru.id);
      if (perjalananBaru.supir_id) {
        try {
          await kirimNotifikasi({
            penggunaId: perjalananBaru.supir_id,
            judul: 'Perubahan Jadwal Dibatalkan',
            pesan: `${namaAnak}: pengajuan perubahan jadwal dibatalkan, jadwal jemput/antar kembali seperti semula.`,
            tipe: 'perjalanan',
            idTerkait: perjalananBaru.id,
            tipeTerkait: 'jadwal_mingguan_diubah'
          });
        } catch (err) {
          console.error('Gagal kirim notifikasi perubahan jadwal dibatalkan ke supir:', err);
        }
      }
    }
  }
}

/**
 * Edit pengajuan perubahan jadwal yang SUDAH 'disetujui' (berlaku, sudah
 * disinkronkan ke jadwal supir) -- BEDA dari perbaruiPengajuanPerubahanJadwal()
 * yang hanya utk baris 'menunggu' pembayaran. Alurnya: validasi jadwal LAMA
 * (yang sedang berlaku) maupun BARU (yang diajukan) belum dijalankan supir,
 * rollback sinkronisasi lama, simpan detail baru, lalu sinkronkan ulang &
 * beri tahu Admin -- status TETAP 'disetujui' (tidak perlu bayar ulang;
 * lihat catatan penyederhanaan biaya di JadwalOrangTua.vue).
 */
export async function editPengajuanPerubahanJadwalAktif(
  pengajuanId: string,
  params: {
    anakId: string;
    namaAnak: string;
    tanggal: string;
    waktuBaru: string;
    biayaTambahan: number;
    jenisPerubahan: 'pergi' | 'pulang';
    alamatBaru: string;
    lintangBaru: number;
    bujurBaru: number;
  }
): Promise<PengajuanPerubahanJadwalRow> {
  if (params.tanggal < ambilTanggalWibSekarang()) {
    throw new Error('Tanggal perubahan jadwal tidak boleh sebelum hari ini.');
  }

  const client = klienWajibAda();

  const { data: pengajuanLama, error: errBaca } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('*')
    .eq('id', pengajuanId)
    .single();
  if (errBaca) throw errBaca;
  const pengajuanSebelum = pengajuanLama as PengajuanPerubahanJadwalRow;

  // Pastikan baik jadwal yang SEDANG berlaku maupun jadwal BARU yang
  // diajukan belum ada yang dijalankan supir.
  await pastikanBelumDijalankanSupir(client, params.anakId, pengajuanSebelum.jenis_perubahan, pengajuanSebelum.tanggal);
  await pastikanBelumDijalankanSupir(client, params.anakId, params.jenisPerubahan, params.tanggal);

  await rollbackSinkronisasiPerjalanan(client, pengajuanSebelum, params.namaAnak);

  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .update({
      tanggal: params.tanggal,
      waktu_baru: params.waktuBaru,
      biaya_tambahan: params.biayaTambahan,
      jenis_perubahan: params.jenisPerubahan,
      alamat_baru: params.alamatBaru,
      lintang_baru: params.lintangBaru,
      bujur_baru: params.bujurBaru,
      status: 'disetujui',
      perjalanan_lama_id: null,
      perjalanan_baru_id: null
    })
    .eq('id', pengajuanId)
    .select('*')
    .single();
  if (error) throw error;

  if (pengajuanSebelum.pembayaran_id && params.biayaTambahan !== Number(pengajuanSebelum.biaya_tambahan)) {
    try {
      await client.from('pembayaran').update({ jumlah: params.biayaTambahan }).eq('id', pengajuanSebelum.pembayaran_id);
    } catch {
      // Biarkan gagal senyap -- perubahan jadwal tetap tersimpan meski
      // catatan nominal pembayaran lama gagal disesuaikan.
    }
  }

  await sinkronDanBeritahuAdminPerubahanJadwal(client, pengajuanId, params);

  return data as PengajuanPerubahanJadwalRow;
}

/**
 * Batalkan pengajuan perubahan jadwal yang SUDAH 'disetujui' (berlaku) --
 * BEDA dari hapusPengajuanPerubahanJadwal() yang hard-DELETE baris
 * 'menunggu'. Di sini baris TETAP disimpan (status -> 'ditolak') sbg jejak
 * riwayat aktivitas, dan jadwal anak di-ROLLBACK ke kondisi sebelumnya
 * (lihat rollbackSinkronisasiPerjalanan()). Dana yang sudah dibayarkan
 * TIDAK dikembalikan -- baris `pembayaran` dibiarkan 'lunas' apa adanya,
 * konsisten dgn tidak adanya alur refund di proyek ini.
 */
export async function batalkanPengajuanPerubahanJadwalAktif(pengajuanId: string, namaAnak: string): Promise<PengajuanPerubahanJadwalRow> {
  const client = klienWajibAda();

  const { data: pengajuanRaw, error: errBaca } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('*')
    .eq('id', pengajuanId)
    .single();
  if (errBaca) throw errBaca;
  const pengajuan = pengajuanRaw as PengajuanPerubahanJadwalRow;

  await pastikanBelumDijalankanSupir(client, pengajuan.anak_id, pengajuan.jenis_perubahan, pengajuan.tanggal);

  await rollbackSinkronisasiPerjalanan(client, pengajuan, namaAnak);

  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .update({ status: 'ditolak', perjalanan_lama_id: null, perjalanan_baru_id: null })
    .eq('id', pengajuanId)
    .select('*')
    .single();
  if (error) throw error;

  try {
    await kirimNotifikasiKeAdmin({
      judul: 'Pembatalan Perubahan Jadwal',
      pesan: `${namaAnak}: pengajuan perubahan jadwal ${pengajuan.jenis_perubahan === 'pergi' ? 'Pergi' : 'Pulang'} tanggal ${formatTanggalIndonesiaDenganHari(pengajuan.tanggal)} DIBATALKAN oleh orang tua. Jadwal anak kembali ke jadwal normal.`,
      tipe: 'sistem',
      idTerkait: pengajuanId,
      tipeTerkait: 'pengajuan_perubahan_jadwal'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi pembatalan perubahan jadwal ke admin:', err);
  }

  return data as PengajuanPerubahanJadwalRow;
}
