import { supabase } from './supabase';
import type { SekolahRow, JadwalMingguanRow } from '../tipe';
import { namaHariDariTanggalIso } from '../bantuan/kalenderJadwal';
import { kirimNotifikasi } from './notifikasiLayanan';
import { ambilTanggalAktifAbsensi } from './kalenderLayanan';
import { ambilWaktuSekarang, ambilTanggalWibSekarang, tanggalWibDariDate } from '../bantuan/waktuSimulasi';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// ==========================================
// UC-A01 / Dashboard: Ringkasan & Monitoring Global
// ==========================================

export interface RingkasanDashboard {
  anakAktif: number;
  supirBertugas: number;
  perjalananBerlangsung: number;
  perjalananSelesai: number;
  pendapatanBulanIni: number;
}

export async function ambilRingkasanDashboard(): Promise<RingkasanDashboard> {
  const client = klienWajibAda();
  const hariIni = ambilTanggalWibSekarang();
  const awalBulanStr = hariIni.slice(0, 7) + '-01';

  const [anakAktifRes, supirBertugasRes, perjalananHariIniRes, pembayaranBulanIniRes] = await Promise.all([
    client.from('anak').select('id', { count: 'exact', head: true }).eq('aktif', true),
    client.from('supir').select('id', { count: 'exact', head: true }).eq('aktif', true).eq('tersedia', true),
    client.from('perjalanan').select('status').eq('tanggal_perjalanan', hariIni),
    client.from('pembayaran').select('jumlah').eq('status', 'lunas').gte('tanggal_pembayaran', awalBulanStr)
  ]);

  if (anakAktifRes.error) throw anakAktifRes.error;
  if (supirBertugasRes.error) throw supirBertugasRes.error;
  if (perjalananHariIniRes.error) throw perjalananHariIniRes.error;
  if (pembayaranBulanIniRes.error) throw pembayaranBulanIniRes.error;

  const perjalananList = perjalananHariIniRes.data ?? [];
  const selesaiSet = new Set(['tiba', 'dibatalkan']);
  const perjalananSelesai = perjalananList.filter((p: any) => selesaiSet.has(p.status)).length;
  const perjalananBerlangsung = perjalananList.length - perjalananSelesai;

  const pendapatanBulanIni = (pembayaranBulanIniRes.data ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.jumlah),
    0
  );

  return {
    anakAktif: anakAktifRes.count ?? 0,
    supirBertugas: supirBertugasRes.count ?? 0,
    perjalananBerlangsung,
    perjalananSelesai,
    pendapatanBulanIni
  };
}

export interface PosisiSupirPeta {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  status: 'aktif' | 'offline';
  sekolahTujuan: string | null;
  statusPerjalanan: string | null;
  destLat: number | null;
  destLng: number | null;
}

/**
 * Posisi seluruh supir yang SEDANG BERTUGAS (kolom `sedang_bertugas`, lihat
 * catatan lengkap di skema_database.sql), dipakai untuk Monitoring Global
 * (UC-A01) dan Pemantauan Armada. Marker muncul sejak supir menekan "Mulai
 * Bertugas" (TugasSupir.vue) sampai seluruh tugas sesi itu ditandai selesai
 * -- BUKAN lagi dari status baris `perjalanan` (penjemputan/menuju_sekolah/
 * dst), karena itu tidak mencerminkan kapan supir benar-benar mengaktifkan
 * GPS-nya (mis. supir sudah "Mulai Bertugas" tapi anak pertama belum
 * diubah dari status "Sedang di Rumah").
 */
export async function ambilPosisiSupirAktif(): Promise<PosisiSupirPeta[]> {
  const client = klienWajibAda();
  const hariIni = ambilTanggalWibSekarang();

  const { data: supirData, error: errSupir } = await client
    .from('supir')
    .select('id, lintang_terkini, bujur_terkini, tersedia')
    .eq('sedang_bertugas', true);
  if (errSupir) throw errSupir;

  const supirIds = (supirData ?? []).map((s: any) => s.id);
  if (supirIds.length === 0) return [];

  // Sekolah tujuan cuma info tambahan buat ditampilkan di popup peta -- BUKAN
  // syarat kemunculan marker lagi, jadi diambil terpisah dan tidak dipakai
  // untuk memfilter apa pun di bawah.
  const [{ data: perjalananHariIni, error: errPerjalanan }, { data: penggunaData, error: errPengguna }] = await Promise.all([
    client
      .from('perjalanan')
      .select('supir_id, status, anak(lintang_jemput, bujur_jemput, sekolah(nama, lintang, bujur))')
      .eq('tanggal_perjalanan', hariIni)
      .neq('status', 'dibatalkan')
      .in('supir_id', supirIds),
    client.from('pengguna').select('id, nama_lengkap').in('id', supirIds)
  ]);
  if (errPerjalanan) throw errPerjalanan;
  if (errPengguna) throw errPengguna;

  const namaSupirById = new Map((penggunaData ?? []).map((p: any) => [p.id, p.nama_lengkap]));
  const sekolahBySupirId = new Map<string, string>();
  const statusBySupirId = new Map<string, string>();
  const koordinatTujuanBySupirId = new Map<string, { lat: number; lng: number }>();

  for (const p of (perjalananHariIni ?? []) as any[]) {
    const nama = p.anak?.sekolah?.nama;
    if (nama && !sekolahBySupirId.has(p.supir_id)) sekolahBySupirId.set(p.supir_id, nama);

    // Tentukan status perjalanan teraktif untuk supir ini
    const stat = p.status;
    const currentMax = statusBySupirId.get(p.supir_id);
    const getWeight = (s: string) => {
      if (s === 'penjemputan') return 5;
      if (s === 'menuju_sekolah' || s === 'pengantaran') return 4;
      if (s === 'di_sekolah') return 3;
      if (s === 'dijadwalkan') return 2;
      if (s === 'tiba') return 1;
      return 0;
    };
    if (!currentMax || getWeight(stat) > getWeight(currentMax)) {
      statusBySupirId.set(p.supir_id, stat);
    }

    // Tentukan koordinat tujuan aktif supir berdasarkan status perjalanannya
    const anak = p.anak;
    const sekolah = anak?.sekolah;
    let destLat = sekolah?.lintang;
    let destLng = sekolah?.bujur;

    if (stat === 'penjemputan' || stat === 'pengantaran') {
      if (anak?.lintang_jemput != null && anak?.bujur_jemput != null) {
        destLat = anak.lintang_jemput;
        destLng = anak.bujur_jemput;
      }
    }

    if (destLat != null && destLng != null) {
      koordinatTujuanBySupirId.set(p.supir_id, { lat: Number(destLat), lng: Number(destLng) });
    }
  }

  return (supirData ?? [])
    .filter((s: any) => s.lintang_terkini != null && s.bujur_terkini != null)
    .map((s: any) => ({
      id: s.id,
      nama: namaSupirById.get(s.id) ?? 'Supir',
      lat: Number(s.lintang_terkini),
      lng: Number(s.bujur_terkini),
      status: s.tersedia ? 'aktif' : 'offline',
      sekolahTujuan: sekolahBySupirId.get(s.id) ?? null,
      statusPerjalanan: statusBySupirId.get(s.id) ?? null,
      destLat: koordinatTujuanBySupirId.get(s.id)?.lat ?? null,
      destLng: koordinatTujuanBySupirId.get(s.id)?.lng ?? null
    }));
}

// ==========================================
// UC-A02: Kelola Data Supir
// ==========================================

export interface SupirDenganPengguna {
  id: string;
  nama_lengkap: string;
  email: string;
  nomor_telepon: string | null;
  jenis_kendaraan: string;
  nomor_plat: string;
  tipe_supir: 'tetap' | 'sementara';
  aktif: boolean;
  status_verifikasi: 'menunggu' | 'terverifikasi' | 'ditolak';
  url_ktp: string | null;
  url_sim: string | null;
  url_stnk: string | null;
  tersedia: boolean;
  tanggalMulaiKerja: string | null;
  tanggalSelesaiKerja: string | null;
  fotoProfil: string | null;
}

/**
 * Nonaktifkan (lazy, write-on-read) seluruh akun supir 'sementara' yang
 * tanggal_selesai_kerja-nya sudah lewat -- dipanggil di awal
 * ambilDaftarSupir() & ambilSupirTersedia() supaya "akun hanya aktif
 * selama rentang tanggal kerja yang diatur" benar-benar berlaku tanpa
 * memerlukan cron/job terjadwal (tidak tersedia di environment ini).
 * Konsisten dengan pola lazy-reset yang sudah dipakai utk periode absensi
 * (lihat hitungTanggalAktifAbsensi di src/bantuan/periodeAbsensi.ts).
 */
async function nonaktifkanSupirSementaraKedaluwarsa(client: NonNullable<typeof supabase>): Promise<void> {
  const hariIni = ambilTanggalWibSekarang();
  const { error } = await client
    .from('supir')
    .update({ aktif: false })
    .eq('tipe_supir', 'sementara')
    .eq('aktif', true)
    .lt('tanggal_selesai_kerja', hariIni);
  if (error) throw error;
}

export async function ambilDaftarSupir(): Promise<SupirDenganPengguna[]> {
  const client = klienWajibAda();
  await nonaktifkanSupirSementaraKedaluwarsa(client);

  const { data, error } = await client
    .from('supir')
    .select('*, pengguna(nama_lengkap, email, nomor_telepon, foto_profil)')
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    id: s.id,
    nama_lengkap: s.pengguna?.nama_lengkap ?? '(akun tidak ditemukan)',
    email: s.pengguna?.email ?? '-',
    nomor_telepon: s.pengguna?.nomor_telepon ?? null,
    jenis_kendaraan: s.jenis_kendaraan,
    nomor_plat: s.nomor_plat,
    tipe_supir: s.tipe_supir,
    aktif: s.aktif,
    status_verifikasi: s.status_verifikasi,
    url_ktp: s.url_ktp,
    url_sim: s.url_sim,
    url_stnk: s.url_stnk,
    tersedia: s.tersedia,
    tanggalMulaiKerja: s.tanggal_mulai_kerja,
    tanggalSelesaiKerja: s.tanggal_selesai_kerja,
    fotoProfil: s.pengguna?.foto_profil ?? null
  }));
}

export interface DataSupirBaru {
  email: string;
  password: string;
  namaLengkap: string;
  nomorTelepon?: string;
  jenisKendaraan: string;
  nomorPlat: string;
  tipeSupir: 'tetap' | 'sementara';
  tanggalMulaiKerja?: string;
  tanggalSelesaiKerja?: string;
}

/**
 * Memanggil Edge Function "buat-akun-supir" (bukan supabase.auth.signUp()
 * langsung) -- signUp() dari sesi admin yang sedang login akan membajak
 * sesi tersebut dan menggantinya dengan sesi akun supir baru. Edge Function
 * memakai service-role key di server untuk membuat akun tanpa menyentuh
 * sesi browser admin. Lihat supabase/functions/buat-akun-supir/index.ts.
 */
export async function buatAkunSupir(data: DataSupirBaru): Promise<string> {
  const client = klienWajibAda();
  const { data: hasil, error } = await client.functions.invoke('buat-akun-supir', {
    body: {
      email: data.email,
      password: data.password,
      namaLengkap: data.namaLengkap,
      nomorTelepon: data.nomorTelepon ?? '',
      jenisKendaraan: data.jenisKendaraan,
      nomorPlat: data.nomorPlat,
      tipeSupir: data.tipeSupir,
      tanggalMulaiKerja: data.tanggalMulaiKerja ?? null,
      tanggalSelesaiKerja: data.tanggalSelesaiKerja ?? null
    }
  });
  if (error) {
    // FunctionsHttpError menyimpan body respons di error.context (Response) --
    // ambil pesan JSON aslinya dari sana kalau ada, biar toast tidak generik.
    const context = (error as any)?.context;
    let pesanServer: string | null = null;
    if (context?.json) {
      try {
        const body = await context.json();
        pesanServer = body?.error ?? null;
      } catch {
        pesanServer = null;
      }
    }
    throw new Error(pesanServer ?? error.message);
  }
  return hasil.id as string;
}

/**
 * Simpan URL foto profil (hasil unggahFotoProfilSupir, supirLayanan.ts) ke
 * akun supir yang BARU DIBUAT -- terpisah dari perbaruiSupir() karena pada
 * titik ini Admin belum mengisi seluruh data PerubahanSupir (baru saja
 * selesai buatAkunSupir), cukup kolom foto_profil saja yang perlu ditulis.
 */
export async function perbaruiFotoProfilSupir(supirId: string, fotoUrl: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('pengguna').update({ foto_profil: fotoUrl }).eq('id', supirId);
  if (error) throw error;
}

/**
 * Unggah satu dokumen legalitas supir (KTP/SIM/STNK) ke bucket
 * "dokumen-supir" lalu simpan public URL-nya ke kolom terkait di tabel
 * supir. Dipanggil admin dari form Tambah/Edit Supir.
 */
export async function unggahDokumenSupir(
  supirId: string,
  jenis: 'ktp' | 'sim' | 'stnk',
  file: File
): Promise<string> {
  const client = klienWajibAda();
  const ekstensi = file.name.split('.').pop() || 'jpg';
  const pathFile = `${supirId}/${jenis}.${ekstensi}`;

  const { error: errUpload } = await client.storage
    .from('dokumen-supir')
    .upload(pathFile, file, { cacheControl: '3600', upsert: true });
  if (errUpload) {
    const pesanErr = (errUpload.message || '').toLowerCase();
    if (pesanErr.includes('bucket not found') || pesanErr.includes('does not exist')) {
      throw new Error('Bucket penyimpanan "dokumen-supir" belum dibuat di Supabase Storage. Jalankan migrasi SQL "STORAGE: BUCKET DOKUMEN SUPIR" di skema_database.sql terlebih dahulu.');
    }
    if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
      throw new Error('Tidak memiliki izin mengunggah dokumen (kebijakan RLS storage membatasi akses). Pastikan policy bucket "dokumen-supir" sudah dibuat.');
    }
    throw new Error(`Gagal mengunggah dokumen ke penyimpanan: ${errUpload.message}`);
  }

  const { data: dataUrl } = client.storage.from('dokumen-supir').getPublicUrl(pathFile);
  const kolom = jenis === 'ktp' ? 'url_ktp' : jenis === 'sim' ? 'url_sim' : 'url_stnk';

  // Query param `?v=` -- lihat catatan lengkap di unggahDokumenLegalitas()
  // (supirLayanan.ts): path file deterministik membuat getPublicUrl()
  // menghasilkan string identik tiap kali diganti, jadi tanpa pembeda ini
  // trigger trg_jaga_status_verifikasi_supir gagal mendeteksi dokumen
  // sungguhan berubah, dan tautan "Lihat" bisa menampilkan gambar lama dari
  // cache browser.
  const urlDenganVersi = `${dataUrl.publicUrl}?v=${Date.now()}`;

  const { error: errUpdate } = await client.from('supir').update({ [kolom]: urlDenganVersi }).eq('id', supirId);
  if (errUpdate) throw errUpdate;

  return urlDenganVersi;
}

export interface PerubahanSupir {
  namaLengkap: string;
  nomorTelepon: string;
  jenisKendaraan: string;
  nomorPlat: string;
  tipeSupir: 'tetap' | 'sementara';
  aktif: boolean;
  tanggalMulaiKerja?: string | null;
  tanggalSelesaiKerja?: string | null;
  // Opsional -- diisi HANYA kalau Admin memilih foto baru di modal Edit
  // Supir (lihat unggahFotoProfilSupir, supirLayanan.ts, dipanggil dari
  // DataSupirAdmin.vue sebelum perbaruiSupir ini). undefined = foto lama
  // dibiarkan apa adanya (kolom tidak ikut ter-update).
  fotoProfil?: string;
}

/**
 * Perbarui data profil (pengguna) sekaligus data kendaraan (supir) --
 * tidak menyentuh email/kata sandi login, jadi cukup lewat client biasa
 * (tidak perlu Edge Function seperti pembuatan akun baru).
 */
export async function perbaruiSupir(supirId: string, data: PerubahanSupir): Promise<void> {
  const client = klienWajibAda();

  const { error: errPengguna } = await client
    .from('pengguna')
    .update({
      nama_lengkap: data.namaLengkap,
      nomor_telepon: data.nomorTelepon,
      // undefined otomatis dibuang saat di-serialize, jadi aman ditulis
      // selalu -- kolom foto_profil cuma ikut ter-update kalau data.fotoProfil
      // benar-benar diisi (Admin memilih foto baru).
      ...(data.fotoProfil ? { foto_profil: data.fotoProfil } : {})
    })
    .eq('id', supirId);
  if (errPengguna) throw errPengguna;

  const { error: errSupir } = await client
    .from('supir')
    .update({
      jenis_kendaraan: data.jenisKendaraan,
      nomor_plat: data.nomorPlat,
      tipe_supir: data.tipeSupir,
      aktif: data.aktif,
      tanggal_mulai_kerja: data.tipeSupir === 'sementara' ? (data.tanggalMulaiKerja ?? null) : null,
      tanggal_selesai_kerja:
        data.tipeSupir === 'sementara' ? (data.tanggalSelesaiKerja || data.tanggalMulaiKerja || null) : null
    })
    .eq('id', supirId);
  if (errSupir) throw errSupir;

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini. Supir
  // perlu tahu kalau Admin mengubah data profil/kendaraannya sendiri (mis.
  // salah ketik plat nomor yang dikoreksi Admin), bukan cuma perubahan yang
  // dia ajukan sendiri.
  try {
    await kirimNotifikasi({
      penggunaId: supirId,
      judul: 'Profil Anda Diperbarui Admin',
      pesan: `Admin memperbarui data profil/kendaraan Anda: ${data.namaLengkap}, ${data.jenisKendaraan} (${data.nomorPlat}).`,
      tipe: 'sistem',
      tipeTerkait: 'profil_diperbarui_admin'
    });
  } catch (err) {
    // Biarkan gagal senyap -- lihat catatan di atas. Tetap di-log supaya
    // kegagalan RPC (RLS, param, dst.) bisa didiagnosis dari console browser.
    console.error('Gagal kirim notifikasi profil diperbarui admin:', err);
  }
}

export async function perbaruiStatusVerifikasiSupir(
  supirId: string,
  status: 'terverifikasi' | 'ditolak'
): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('supir').update({ status_verifikasi: status }).eq('id', supirId);
  if (error) throw error;

  // Best-effort -- kegagalan kirim notifikasi tidak boleh membuat status
  // verifikasi yang sudah tersimpan di atas gagal dilaporkan berhasil.
  try {
    await kirimNotifikasi({
      penggunaId: supirId,
      judul: status === 'terverifikasi' ? 'Akun Anda Terverifikasi' : 'Verifikasi Akun Ditolak',
      pesan:
        status === 'terverifikasi'
          ? 'Selamat! Akun Anda sudah diverifikasi Admin dan dapat mulai menerima penugasan rute.'
          : 'Verifikasi akun Anda ditolak Admin. Silakan hubungi Admin untuk informasi lebih lanjut.',
      tipe: 'sistem',
      tipeTerkait: status === 'terverifikasi' ? 'akun_terverifikasi' : 'akun_ditolak'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi status verifikasi supir:', err);
  }
}

export async function togglAktifSupir(supirId: string, aktif: boolean): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('supir').update({ aktif }).eq('id', supirId);
  if (error) throw error;

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  try {
    await kirimNotifikasi({
      penggunaId: supirId,
      judul: aktif ? 'Akun Anda Diaktifkan Admin' : 'Akun Anda Dinonaktifkan Admin',
      pesan: aktif
        ? 'Akun Anda telah diaktifkan kembali oleh Admin dan dapat menerima penugasan rute.'
        : 'Akun Anda dinonaktifkan sementara oleh Admin. Hubungi Admin untuk informasi lebih lanjut.',
      tipe: 'sistem',
      tipeTerkait: aktif ? 'akun_diaktifkan' : 'akun_dinonaktifkan'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi status aktif/nonaktif supir:', err);
  }
}

export async function hapusSupir(supirId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('supir').delete().eq('id', supirId);
  if (error) throw error;
}

// ==========================================
// UC-A03 / UC-A07: Kelola Daftar Pengguna + Penundaan Pembayaran
// ==========================================

export interface PenggunaDenganRingkasan {
  id: string;
  nama_lengkap: string;
  email: string;
  nomor_telepon: string | null;
  jumlahAnak: number;
  statusBerlangganan: 'Aktif' | 'Tidak Aktif';
  pengajuanPenundaan: {
    id: string;
    alasan: string;
    buktiUrl: string | null;
    jumlah: number;
    status: 'menunggu' | 'disetujui' | 'ditolak';
    pembayaranId: string;
    langgananId: string | null;
    dibuatPada: string;
    diperbaruiPada: string;
  } | null;
}

export async function ambilDaftarPengguna(): Promise<PenggunaDenganRingkasan[]> {
  const client = klienWajibAda();

  const { data: orangTuaList, error: errPengguna } = await client
    .from('pengguna')
    .select('id, nama_lengkap, email, nomor_telepon')
    .eq('peran', 'orangtua')
    .order('dibuat_pada', { ascending: false });
  if (errPengguna) throw errPengguna;
  if (!orangTuaList || orangTuaList.length === 0) return [];

  const orangTuaIds = orangTuaList.map((p: any) => p.id);

  const { data: anakList, error: errAnak } = await client
    .from('anak')
    .select('id, orang_tua_id')
    .in('orang_tua_id', orangTuaIds)
    .eq('aktif', true);
  if (errAnak) throw errAnak;

  const anakIdsByOrangTua = new Map<string, string[]>();
  for (const a of anakList ?? []) {
    const list = anakIdsByOrangTua.get(a.orang_tua_id) ?? [];
    list.push(a.id);
    anakIdsByOrangTua.set(a.orang_tua_id, list);
  }

  const semuaAnakIds = (anakList ?? []).map((a: any) => a.id);
  const langgananAktifOrangTuaIds = new Set<string>();
  if (semuaAnakIds.length > 0) {
    const hariIni = ambilTanggalWibSekarang();
    const { data: langgananAktif, error: errLangganan } = await client
      .from('langganan')
      .select('anak_id')
      .in('anak_id', semuaAnakIds)
      .eq('sudah_dibayar', true)
      .gte('tanggal_berakhir', hariIni);
    if (errLangganan) throw errLangganan;

    const anakIdKeOrangTua = new Map((anakList ?? []).map((a: any) => [a.id, a.orang_tua_id]));
    for (const l of langgananAktif ?? []) {
      const ortuId = anakIdKeOrangTua.get(l.anak_id);
      if (ortuId) langgananAktifOrangTuaIds.add(ortuId);
    }
  }

  const { data: penundaanList, error: errPenundaan } = await client
    .from('penundaan_pembayaran')
    .select('id, orang_tua_id, alasan, bukti_url, status, pembayaran_id, dibuat_pada, diperbarui_pada, pembayaran(jumlah, langganan_id)')
    .in('orang_tua_id', orangTuaIds)
    .eq('status', 'menunggu')
    .order('dibuat_pada', { ascending: false });
  if (errPenundaan) throw errPenundaan;

  // Acuan "sekarang" WAJIB ikut waktu simulasi (lihat src/bantuan/waktuSimulasi.ts)
  // supaya konsisten dengan seluruh halaman lain yang sudah dibuat
  // waktu-simulasi-aware -- tanpa ini, admin bisa "melihat masa depan" kalau
  // simulasi waktu di browser admin diset lebih lambat dari waktu server
  // sesungguhnya saat pengajuan dibuat. Pengajuan HANYA boleh tampil kalau
  // benar-benar sudah dibuat relatif terhadap acuan waktu ini -- bukan
  // berdasarkan tanggal_baru/periode yang diajukan (itu tanggal target di
  // masa depan, wajar; yang jadi acuan visibilitas adalah dibuat_pada).
  const sekarang = ambilWaktuSekarang().toISOString();
  const penundaanByOrangTua = new Map<string, any>();
  for (const p of penundaanList ?? []) {
    if (p.dibuat_pada > sekarang) continue;
    if (!penundaanByOrangTua.has(p.orang_tua_id)) penundaanByOrangTua.set(p.orang_tua_id, p);
  }

  return orangTuaList.map((p: any) => {
    const penundaan = penundaanByOrangTua.get(p.id);
    return {
      id: p.id,
      nama_lengkap: p.nama_lengkap,
      email: p.email,
      nomor_telepon: p.nomor_telepon,
      jumlahAnak: (anakIdsByOrangTua.get(p.id) ?? []).length,
      statusBerlangganan: langgananAktifOrangTuaIds.has(p.id) ? 'Aktif' : 'Tidak Aktif',
      pengajuanPenundaan: penundaan
        ? {
            id: penundaan.id,
            alasan: penundaan.alasan,
            buktiUrl: penundaan.bukti_url ?? null,
            jumlah: Number(penundaan.pembayaran?.jumlah ?? 0),
            status: penundaan.status,
            pembayaranId: penundaan.pembayaran_id,
            langgananId: penundaan.pembayaran?.langganan_id ?? null,
            dibuatPada: penundaan.dibuat_pada,
            diperbaruiPada: penundaan.diperbarui_pada
          }
        : null
    };
  });
}

/**
 * UC-A07 Alur Alternatif A2: menyetujui memperpanjang tenggat pembayaran.
 * `hariPerpanjangan` dipilih admin sendiri per pengajuan (bukan lagi angka
 * tetap 7 hari) lewat ModalPersetujuan.vue -- lama toleransi bisa berbeda
 * tergantung alasan/kebijakan admin untuk kasus itu.
 *
 * PENTING: memperbarui tanggal_berakhir SEKALIGUS tanggal_jatuh_tempo, tidak
 * cukup salah satu saja. tanggal_jatuh_tempo murni tanggal pengingat
 * (dipakai banner "Batas Pembayaran Bulanan"), sedangkan tanggal_berakhir
 * itulah yang benar-benar menentukan status aktif/tidak aktif akun
 * (authStore.periksaStatusBerlangganan, TataLetakOrangTua.vue akunAktif) --
 * sebelumnya cuma tanggal_jatuh_tempo yang diperpanjang, jadi persetujuan
 * penundaan TIDAK benar-benar membuka kembali akses akun, akun tetap
 * terbaca kedaluwarsa walau pengajuannya sudah disetujui.
 */
export async function setujuiPenundaanPembayaran(params: {
  penundaanId: string;
  langgananId: string | null;
  orangTuaId: string;
  hariPerpanjangan: number;
}): Promise<void> {
  const client = klienWajibAda();
  const tenggatBaru = ambilWaktuSekarang();
  tenggatBaru.setDate(tenggatBaru.getDate() + Math.max(1, Math.round(params.hariPerpanjangan)));
  const tenggatBaruStr = tanggalWibDariDate(tenggatBaru);

  const { error: errPenundaan } = await client
    .from('penundaan_pembayaran')
    .update({ status: 'disetujui', disetujui_pada: new Date().toISOString(), tanggal_baru: tenggatBaruStr })
    .eq('id', params.penundaanId);
  if (errPenundaan) throw errPenundaan;

  if (params.langgananId) {
    const { error: errLangganan } = await client
      .from('langganan')
      .update({ tanggal_jatuh_tempo: tenggatBaruStr, tanggal_berakhir: tenggatBaruStr })
      .eq('id', params.langgananId);
    if (errLangganan) throw errLangganan;
  }

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  try {
    await kirimNotifikasi({
      penggunaId: params.orangTuaId,
      judul: 'Penundaan Pembayaran Disetujui',
      pesan: `Pengajuan penundaan pembayaran Anda disetujui. Masa tenggang diperpanjang hingga ${tenggatBaruStr}.`,
      tipe: 'pembayaran',
      idTerkait: params.penundaanId,
      tipeTerkait: 'penundaan_disetujui'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi penundaan pembayaran disetujui:', err);
  }
}

/**
 * UC-A07 Alur Alternatif A3: menolak otomatis menghentikan langganan --
 * diwujudkan dengan mengakhiri masa berlaku langganan hari ini juga.
 */
export async function tolakPenundaanPembayaran(params: {
  penundaanId: string;
  langgananId: string | null;
  orangTuaId: string;
}): Promise<void> {
  const client = klienWajibAda();

  const { error: errPenundaan } = await client
    .from('penundaan_pembayaran')
    .update({ status: 'ditolak', disetujui_pada: new Date().toISOString() })
    .eq('id', params.penundaanId);
  if (errPenundaan) throw errPenundaan;

  if (params.langgananId) {
    const hariIni = ambilTanggalWibSekarang();
    const { error: errLangganan } = await client
      .from('langganan')
      .update({ tanggal_berakhir: hariIni })
      .eq('id', params.langgananId);
    if (errLangganan) throw errLangganan;
  }

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  try {
    await kirimNotifikasi({
      penggunaId: params.orangTuaId,
      judul: 'Penundaan Pembayaran Ditolak',
      pesan: 'Pengajuan penundaan pembayaran Anda ditolak Admin. Layanan akan dinonaktifkan hari ini juga -- segera selesaikan pembayaran untuk mengaktifkan kembali.',
      tipe: 'pembayaran',
      idTerkait: params.penundaanId,
      tipeTerkait: 'penundaan_ditolak'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi penundaan pembayaran ditolak:', err);
  }
}

// ==========================================
// UC-A04: Kelola Daftar Anak
// ==========================================

export interface AnakDenganRingkasan {
  id: string;
  nama_lengkap: string;
  kelas: string;
  alamat_jemput: string;
  jenis_layanan: string;
  aktif: boolean;
  urlFoto: string | null;
  namaOrangTua: string;
  noWhatsappOrangTua: string | null;
  namaSekolah: string;
  statusBerlangganan: 'Aktif' | 'Tidak Aktif';
}

export async function ambilDaftarAnak(): Promise<AnakDenganRingkasan[]> {
  const client = klienWajibAda();

  const { data, error } = await client
    .from('anak')
    .select(
      'id, nama_lengkap, kelas, alamat_jemput, jenis_layanan, aktif, url_foto, orang_tua_id, sekolah(nama), orang_tua(nomor_whatsapp, pengguna(nama_lengkap))'
    )
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  const anakIds = (data ?? []).map((a: any) => a.id);
  const hariIni = ambilTanggalWibSekarang();
  const anakAktifSet = new Set<string>();
  if (anakIds.length > 0) {
    const { data: langgananAktif, error: errLangganan } = await client
      .from('langganan')
      .select('anak_id')
      .in('anak_id', anakIds)
      .eq('sudah_dibayar', true)
      .gte('tanggal_berakhir', hariIni);
    if (errLangganan) throw errLangganan;
    for (const l of langgananAktif ?? []) anakAktifSet.add(l.anak_id);
  }

  return (data ?? []).map((a: any) => ({
    id: a.id,
    nama_lengkap: a.nama_lengkap,
    kelas: a.kelas,
    alamat_jemput: a.alamat_jemput,
    jenis_layanan: a.jenis_layanan,
    aktif: a.aktif,
    urlFoto: a.url_foto ?? null,
    namaOrangTua: a.orang_tua?.pengguna?.nama_lengkap ?? '-',
    noWhatsappOrangTua: a.orang_tua?.nomor_whatsapp ?? null,
    namaSekolah: a.sekolah?.nama ?? '-',
    statusBerlangganan: anakAktifSet.has(a.id) ? 'Aktif' : 'Tidak Aktif'
  }));
}

export async function hapusAnakAdmin(anakId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('anak').delete().eq('id', anakId);
  if (error) throw error;
}

// ==========================================
// UC-A05: Kelola Data Sekolah
// ==========================================

/**
 * Sinkronkan daftar nama kelas suatu sekolah (tabel kelas_sekolah) dengan
 * `kelasList` yang diinput admin -- pendekatannya replace-all (hapus semua
 * baris lama, insert ulang yang baru) karena UI hanya menyediakan satu
 * daftar utuh per submit form, bukan diff tambah/hapus per baris.
 */
async function sinkronkanKelasSekolah(
  client: NonNullable<typeof supabase>,
  sekolahId: string,
  kelasList: string[]
): Promise<void> {
  const { error: errHapus } = await client.from('kelas_sekolah').delete().eq('sekolah_id', sekolahId);
  if (errHapus) throw errHapus;

  const namaUnik = Array.from(new Set(kelasList.map((k) => k.trim()).filter(Boolean)));
  if (namaUnik.length === 0) return;

  const { error: errInsert } = await client
    .from('kelas_sekolah')
    .insert(namaUnik.map((nama_kelas) => ({ sekolah_id: sekolahId, nama_kelas })));
  if (errInsert) throw errInsert;
}

export async function tambahSekolah(params: {
  nama: string;
  alamat: string;
  lintang: number;
  bujur: number;
  kelasList: string[];
}): Promise<SekolahRow> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('sekolah')
    .insert({ nama: params.nama, alamat: params.alamat, lintang: params.lintang, bujur: params.bujur })
    .select('*')
    .single();
  if (error) throw error;

  await sinkronkanKelasSekolah(client, data.id, params.kelasList);

  return { ...data, kelasTersedia: params.kelasList } as SekolahRow;
}

export async function perbaruiSekolah(
  sekolahId: string,
  perubahan: Partial<{ nama: string; alamat: string; lintang: number; bujur: number; kelasList: string[] }>
): Promise<void> {
  const client = klienWajibAda();
  const { kelasList, ...kolomSekolah } = perubahan;

  if (Object.keys(kolomSekolah).length > 0) {
    const { error } = await client.from('sekolah').update(kolomSekolah).eq('id', sekolahId);
    if (error) throw error;
  }

  if (kelasList) {
    await sinkronkanKelasSekolah(client, sekolahId, kelasList);
  }
}

export async function hapusSekolah(sekolahId: string): Promise<void> {
  const client = klienWajibAda();
  const { error } = await client.from('sekolah').delete().eq('id', sekolahId);
  if (error) throw error;
}

// ==========================================
// UC-A06: Menugaskan Supir
// ==========================================

export interface PenugasanHariIni {
  supirId: string;
  namaSupir: string;
  sekolahList: string[];
  tanggal: string;
  jenisPerjalanan: 'pagi' | 'sore';
  // alamatDiperbarui: true kalau orang tua mengubah alamat jemput/antar anak
  // ini SETELAH penugasan dibuat (lihat perbaruiAlamatAnak, orangTuaLayanan.ts,
  // yang menandai perjalanan.alamat_diperbarui_pada) -- anak TETAP di
  // penugasan yang sama (beda dari perubahan waktu/hari yang membatalkan
  // penugasan), tapi Admin perlu tahu titik lokasinya sudah berubah.
  anakList: { perjalananId: string; nama: string; sekolah: string; alamatDiperbarui: boolean }[];
}

/**
 * Hanya mengembalikan supir yang sudah mengisi absensi dengan status "Siap
 * Bertugas" (status_kehadiran = 'siap') UNTUK PERIODE ABSENSI YANG SEDANG
 * AKTIF (status_kehadiran_untuk_tanggal = tanggal aktif absensi saat ini) --
 * tanpa syarat tanggal ini, status "siap" basi dari periode sebelumnya bisa
 * ikut terhitung tersedia. Lihat ambilTanggalAktifAbsensi() di
 * src/layanan/kalenderLayanan.ts (ikut menyaring cuti bersama Admin) dan
 * src/komponen/supir/AbsensiSupir.vue.
 */
export async function ambilSupirTersedia(): Promise<{ id: string; nama_lengkap: string }[]> {
  const client = klienWajibAda();
  await nonaktifkanSupirSementaraKedaluwarsa(client);

  const { data, error } = await client
    .from('supir')
    .select('id, pengguna(nama_lengkap)')
    .eq('aktif', true)
    .eq('tersedia', true)
    .eq('status_verifikasi', 'terverifikasi')
    .eq('status_kehadiran', 'siap')
    .eq('status_kehadiran_untuk_tanggal', await ambilTanggalAktifAbsensi());
  if (error) throw error;
  return (data ?? []).map((s: any) => ({ id: s.id, nama_lengkap: s.pengguna?.nama_lengkap ?? 'Supir' }));
}

export interface SekolahDenganAnakAktif {
  id: string;
  nama: string;
  jumlahAnak: number;
}

/**
 * Menyaring daftar anak (id + sekolah_id) menjadi hanya yang benar-benar
 * "tersedia" utk ditugaskan pada satu tanggal tertentu -- dipakai bersama
 * oleh ambilSekolahDenganAnakAktif() (supaya daftar sekolah tidak menghitung
 * anak yang sebenarnya tidak akan ditugaskan) dan buatPenugasan() (supaya
 * baris perjalanan yang dibuat konsisten dengan angka yang ditampilkan).
 * Tiga syarat exclude:
 * 1. jadwal_mingguan anak menandai hari dari `tanggal` sebagai TIDAK aktif
 *    (anak yang belum punya baris jadwal_mingguan sama sekali dianggap
 *    tidak dibatasi -- tetap tersedia).
 * 2. pengajuan_absen anak utk tanggal itu berstatus 'tidak_masuk' (orang
 *    tua sudah menandai Absen/Libur) -- ini menang mutlak, tidak peduli
 *    jadwal_mingguan-nya aktif atau tidak.
 * 3. pengajuan_cuti anak yang rentang tanggal_mulai..tanggal_selesai-nya
 *    mencakup `tanggal` DAN belum ditolak ('menunggu' atau 'disetujui')
 *    -- sama seperti pengajuan_absen, tidak ada alur persetujuan admin
 *    terpisah yang benar-benar dipakai di sistem ini, jadi pengajuan cuti
 *    langsung berlaku begitu diajukan orang tua supaya anak tidak salah
 *    ditugaskan/dijemput selama masa cuti.
 */
async function saringAnakTersediaUntukTanggal(
  client: NonNullable<typeof supabase>,
  anakIds: string[],
  tanggal: string
): Promise<Set<string>> {
  if (anakIds.length === 0) return new Set();

  const [{ data: jadwalList, error: errJadwal }, { data: absenList, error: errAbsen }, { data: cutiList, error: errCuti }, { data: perubahanList, error: errPerubahan }] =
    await Promise.all([
      client.from('jadwal_mingguan').select('*').in('anak_id', anakIds),
      client.from('pengajuan_absen').select('anak_id, status').in('anak_id', anakIds).eq('tanggal', tanggal),
      client
        .from('pengajuan_cuti')
        .select('anak_id, status')
        .in('anak_id', anakIds)
        .lte('tanggal_mulai', tanggal)
        .gte('tanggal_selesai', tanggal),
      client
        .from('pengajuan_perubahan_jadwal')
        .select('anak_id')
        .in('anak_id', anakIds)
        .eq('tanggal', tanggal)
        .eq('status', 'disetujui')
    ]);
  if (errJadwal) throw errJadwal;
  if (errAbsen) throw errAbsen;
  if (errCuti) throw errCuti;
  if (errPerubahan) throw errPerubahan;

  const namaHari = namaHariDariTanggalIso(tanggal);
  const kolomHari = namaHari.toLowerCase() as keyof JadwalMingguanRow;
  const jadwalByAnakId = new Map<string, JadwalMingguanRow>(
    ((jadwalList ?? []) as JadwalMingguanRow[]).map((j) => [j.anak_id, j])
  );
  const anakIdTidakMasuk = new Set(
    (absenList ?? []).filter((a: any) => a.status === 'tidak_masuk').map((a: any) => a.anak_id)
  );
  const anakIdCuti = new Set(
    (cutiList ?? []).filter((c: any) => c.status !== 'ditolak').map((c: any) => c.anak_id)
  );
  // Anak dgn pengajuan perubahan jadwal BERLAKU utk tanggal ini SENGAJA
  // DIKECUALIKAN dari batch "Buat Penugasan" biasa (bukan dimasukkan) --
  // jam/alamat jemput-antar mereka beda dari rombongan sekolah normal,
  // jadi tidak boleh ikut tercampur diam-diam ke rute bersama supir yang
  // sama seolah-olah jadwalnya standar. Mereka ditugaskan TERPISAH satu-
  // per-satu lewat tugaskanSupirPerubahanJadwal() (lihat bagian "Anak
  // dengan Perubahan Jadwal" di PenugasanAdmin.vue).
  const anakIdPerubahanJadwal = new Set((perubahanList ?? []).map((p: any) => p.anak_id));

  const tersedia = new Set<string>();
  for (const id of anakIds) {
    if (anakIdPerubahanJadwal.has(id)) continue;
    if (anakIdTidakMasuk.has(id) || anakIdCuti.has(id)) continue;
    const jadwal = jadwalByAnakId.get(id);
    if (!jadwal || jadwal[kolomHari] === true) tersedia.add(id);
  }
  return tersedia;
}

/**
 * Anak yang langganannya BENAR-BENAR AKTIF pada `tanggal` tertentu (baris
 * langganan sudah_dibayar=true DAN tanggal_berakhir >= tanggal) -- dipakai
 * sebagai syarat tambahan sebelum anak ditugaskan ke rute penjemputan/
 * pengantaran. Anak yang belum pernah bayar atau langganannya sudah
 * kedaluwarsa TIDAK BOLEH pernah muncul di daftar penugasan supir, terlepas
 * dari jadwal_mingguan/absen/cuti-nya -- akun tidak aktif tidak berhak atas
 * layanan antar-jemput sampai melunasi kembali (lihat "Lanjutkan Langganan"
 * di RiwayatPembayaran.vue).
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

/**
 * Sekolah yang punya minimal satu anak aktif, BERLANGGANAN AKTIF, DAN
 * tersedia (lolos filter jadwal_mingguan + absen/libur, lihat
 * saringAnakTersediaUntukTanggal) utk tanggal yang dipilih -- dipakai
 * sebagai pilihan "sekolah/rute" pada penugasan supir (UC-A06), supaya
 * admin tidak memilih sekolah yang anaknya ternyata tidak akan ikut
 * ditugaskan sama sekali pada tanggal itu (termasuk yang langganannya
 * kedaluwarsa/belum lunas).
 */
export async function ambilSekolahDenganAnakAktif(tanggal: string): Promise<SekolahDenganAnakAktif[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('anak')
    .select('id, sekolah_id, sekolah(nama)')
    .eq('aktif', true);
  if (error) throw error;

  const anakList = (data ?? []) as any[];
  const anakIds = anakList.map((a) => a.id);
  const [anakIdTersedia, anakIdBerlangganan] = await Promise.all([
    saringAnakTersediaUntukTanggal(client, anakIds, tanggal),
    ambilAnakIdBerlanggananAktif(client, anakIds, tanggal)
  ]);

  const petaSekolah = new Map<string, SekolahDenganAnakAktif>();
  for (const a of anakList) {
    if (!anakIdTersedia.has(a.id) || !anakIdBerlangganan.has(a.id)) continue;
    const existing = petaSekolah.get(a.sekolah_id);
    if (existing) {
      existing.jumlahAnak += 1;
    } else {
      petaSekolah.set(a.sekolah_id, { id: a.sekolah_id, nama: a.sekolah?.nama ?? '-', jumlahAnak: 1 });
    }
  }
  return Array.from(petaSekolah.values());
}

export async function ambilPenugasanHariIni(tanggal: string): Promise<PenugasanHariIni[]> {
  const client = klienWajibAda();
  const { data: dataMentah, error } = await client
    .from('perjalanan')
    .select(
      'id, supir_id, anak_id, jenis_perjalanan, alamat_diperbarui_pada, anak(nama_lengkap, aktif, sekolah(nama))'
    )
    .eq('tanggal_perjalanan', tanggal)
    .not('supir_id', 'is', null)
    .neq('status', 'dibatalkan');
  if (error) throw error;

  // Saring anak yang sudah tidak aktif ATAU langganannya belum lunas/sudah
  // kedaluwarsa -- HARUS sama persis dengan penyaringan di ambilTugasHariIni()
  // (supirLayanan.ts), supaya "Detail Penugasan" yang dilihat Admin tidak
  // menampilkan anak yang sebenarnya SUDAH disembunyikan dari aplikasi Supir
  // (baris perjalanan-nya bisa saja terlanjur dibuat sebelum anak
  // dinonaktifkan/langganannya kedaluwarsa).
  const anakAktifMentah = (dataMentah ?? []).filter((p: any) => p.anak?.aktif === true);
  const anakIds = Array.from(new Set(anakAktifMentah.map((p: any) => p.anak_id)));
  const anakIdBerlangganan = await ambilAnakIdBerlanggananAktif(client, anakIds, tanggal);
  const data = anakAktifMentah.filter((p: any) => anakIdBerlangganan.has(p.anak_id));

  const supirIds = Array.from(new Set((data ?? []).map((p: any) => p.supir_id)));
  const namaSupirById = new Map<string, string>();
  if (supirIds.length > 0) {
    const { data: penggunaData, error: errPengguna } = await client
      .from('pengguna')
      .select('id, nama_lengkap')
      .in('id', supirIds);
    if (errPengguna) throw errPengguna;
    for (const p of penggunaData ?? []) namaSupirById.set(p.id, p.nama_lengkap);
  }

  const kelompok = new Map<string, PenugasanHariIni>();
  const sekolahSetByKey = new Map<string, Set<string>>();
  for (const p of (data ?? []) as any[]) {
    const key = `${p.supir_id}|${p.jenis_perjalanan}`;
    if (!kelompok.has(key)) {
      kelompok.set(key, {
        supirId: p.supir_id,
        namaSupir: namaSupirById.get(p.supir_id) ?? 'Supir',
        sekolahList: [],
        tanggal,
        jenisPerjalanan: p.jenis_perjalanan,
        anakList: []
      });
      sekolahSetByKey.set(key, new Set());
    }
    const namaSekolah = p.anak?.sekolah?.nama ?? '-';
    kelompok.get(key)!.anakList.push({
      perjalananId: p.id,
      nama: p.anak?.nama_lengkap ?? '-',
      sekolah: namaSekolah,
      alamatDiperbarui: !!p.alamat_diperbarui_pada
    });
    if (namaSekolah !== '-') sekolahSetByKey.get(key)!.add(namaSekolah);
  }

  const hasil = Array.from(kelompok.values());
  for (const [key, penugasan] of kelompok) {
    penugasan.sekolahList = Array.from(sekolahSetByKey.get(key) ?? []);
  }
  return hasil;
}

export async function buatPenugasan(params: {
  supirId: string;
  tanggal: string;
  jenisPerjalanan: 'pagi' | 'sore';
  sekolahIds: string[];
}): Promise<{ jumlahDitugaskan: number; jumlahDilewati: number }> {
  const client = klienWajibAda();
  if (params.sekolahIds.length === 0) return { jumlahDitugaskan: 0, jumlahDilewati: 0 };

  const { data: anakList, error: errAnak } = await client
    .from('anak')
    .select('id, jenis_layanan')
    .in('sekolah_id', params.sekolahIds)
    .eq('aktif', true);
  if (errAnak) throw errAnak;
  if (!anakList || anakList.length === 0) return { jumlahDitugaskan: 0, jumlahDilewati: 0 };

  // Saring berdasarkan jadwal_mingguan + absen/libur pada tanggal penugasan
  // (lihat saringAnakTersediaUntukTanggal) DAN status langganan aktif (lihat
  // ambilAnakIdBerlanggananAktif) -- dipakai juga oleh
  // ambilSekolahDenganAnakAktif() supaya angka "jumlah anak" yang admin
  // lihat saat memilih sekolah konsisten dengan yang benar-benar ditugaskan.
  // Anak yang langganannya belum lunas/sudah kedaluwarsa TIDAK BOLEH pernah
  // dibuatkan baris perjalanan, meski jadwal_mingguan-nya aktif.
  const anakIds = anakList.map((a: any) => a.id);
  const [anakIdTersedia, anakIdBerlangganan] = await Promise.all([
    saringAnakTersediaUntukTanggal(client, anakIds, params.tanggal),
    ambilAnakIdBerlanggananAktif(client, anakIds, params.tanggal)
  ]);

  const anakDitugaskan = anakList.filter((a: any) => anakIdTersedia.has(a.id) && anakIdBerlangganan.has(a.id));
  const jumlahDilewati = anakList.length - anakDitugaskan.length;
  if (anakDitugaskan.length === 0) return { jumlahDitugaskan: 0, jumlahDilewati };

  const baris = anakDitugaskan.map((a: any) => ({
    anak_id: a.id,
    supir_id: params.supirId,
    tanggal_perjalanan: params.tanggal,
    jenis_perjalanan: params.jenisPerjalanan,
    jenis_layanan: a.jenis_layanan,
    status: 'dijadwalkan'
  }));

  const { error } = await client
    .from('perjalanan')
    .upsert(baris, { onConflict: 'anak_id,tanggal_perjalanan,jenis_perjalanan' });
  if (error) throw error;

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  try {
    await kirimNotifikasi({
      penggunaId: params.supirId,
      judul: 'Penugasan Rute Baru',
      pesan: `Anda ditugaskan menjemput/mengantar ${anakDitugaskan.length} anak pada sesi ${params.jenisPerjalanan === 'pagi' ? 'Pagi' : 'Sore'} tanggal ${params.tanggal}.`,
      tipe: 'perjalanan',
      tipeTerkait: 'penugasan_baru'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi penugasan rute baru:', err);
  }

  return { jumlahDitugaskan: anakDitugaskan.length, jumlahDilewati };
}

// ==========================================
// Penugasan Anak dgn Perubahan Jadwal -- SENGAJA terpisah dari buatPenugasan()
// (batch per-sekolah) di atas, karena jam/alamat jemput-antar mereka beda
// dari rombongan normal (lihat pengecualian di saringAnakTersediaUntukTanggal()).
// Admin menugaskan supir utk masing-masing anak ini SATU PER SATU lewat
// tugaskanSupirPerubahanJadwal(), bukan tercampur diam-diam ke rute bersama.
// ==========================================

export interface AnakPerubahanJadwalPerluDitugaskan {
  pengajuanId: string;
  anakId: string;
  namaAnak: string;
  namaSekolah: string;
  jenisPerubahan: 'pergi' | 'pulang';
  waktuBaru: string;
  alamatBaru: string | null;
  sudahDitugaskan: boolean;
  namaSupir: string | null;
}

export async function ambilAnakPerubahanJadwalPerluDitugaskan(tanggal: string): Promise<AnakPerubahanJadwalPerluDitugaskan[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('id, anak_id, jenis_perubahan, waktu_baru, alamat_baru, perjalanan_baru_id, anak(nama_lengkap, sekolah(nama))')
    .eq('tanggal', tanggal)
    .eq('status', 'disetujui');
  if (error) throw error;

  const idPerjalananBaru = (data ?? []).map((p: any) => p.perjalanan_baru_id).filter(Boolean);
  const supirByPerjalananId = new Map<string, string>();
  if (idPerjalananBaru.length > 0) {
    const { data: perjalananList } = await client
      .from('perjalanan')
      .select('id, supir(pengguna(nama_lengkap))')
      .in('id', idPerjalananBaru);
    for (const p of (perjalananList ?? []) as any[]) {
      const nama = p.supir?.pengguna?.nama_lengkap;
      if (nama) supirByPerjalananId.set(p.id, nama);
    }
  }

  return (data ?? []).map((p: any) => ({
    pengajuanId: p.id,
    anakId: p.anak_id,
    namaAnak: p.anak?.nama_lengkap ?? '(anak tidak ditemukan)',
    namaSekolah: p.anak?.sekolah?.nama ?? '-',
    jenisPerubahan: p.jenis_perubahan,
    waktuBaru: p.waktu_baru,
    alamatBaru: p.alamat_baru,
    sudahDitugaskan: !!p.perjalanan_baru_id && supirByPerjalananId.has(p.perjalanan_baru_id),
    namaSupir: p.perjalanan_baru_id ? supirByPerjalananId.get(p.perjalanan_baru_id) ?? null : null
  }));
}

export async function tugaskanSupirPerubahanJadwal(params: {
  pengajuanId: string;
  anakId: string;
  namaAnak: string;
  supirId: string;
  tanggal: string;
  jenisPerubahan: 'pergi' | 'pulang';
  waktuBaru: string;
  alamatBaru: string | null;
}): Promise<void> {
  const client = klienWajibAda();

  const { data: anakData, error: errAnak } = await client.from('anak').select('jenis_layanan').eq('id', params.anakId).single();
  if (errAnak) throw errAnak;

  const jenisSesi = params.jenisPerubahan === 'pergi' ? 'pagi' : 'sore';
  const catatan = `Perubahan jadwal disetujui: ${params.jenisPerubahan === 'pergi' ? 'berangkat' : 'pulang'} pukul ${params.waktuBaru}, alamat ${params.jenisPerubahan === 'pergi' ? 'penjemputan' : 'pengantaran'}: ${params.alamatBaru ?? '-'}.`;

  const { data: perjalanan, error } = await client
    .from('perjalanan')
    .upsert(
      {
        anak_id: params.anakId,
        supir_id: params.supirId,
        tanggal_perjalanan: params.tanggal,
        jenis_perjalanan: jenisSesi,
        jenis_layanan: anakData.jenis_layanan,
        status: 'dijadwalkan',
        catatan
      },
      { onConflict: 'anak_id,tanggal_perjalanan,jenis_perjalanan' }
    )
    .select('id')
    .single();
  if (error) throw error;

  await client.from('pengajuan_perubahan_jadwal').update({ perjalanan_baru_id: perjalanan.id }).eq('id', params.pengajuanId);

  try {
    await kirimNotifikasi({
      penggunaId: params.supirId,
      judul: 'Penugasan Perubahan Jadwal',
      pesan: `Anda ditugaskan menjemput/mengantar ${params.namaAnak} (jadwal khusus) -- ${catatan}`,
      tipe: 'perjalanan',
      idTerkait: perjalanan.id,
      tipeTerkait: 'penugasan_baru'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi penugasan perubahan jadwal:', err);
  }
}

export async function batalkanPenugasan(perjalananIds: string[]): Promise<void> {
  if (perjalananIds.length === 0) return;
  const client = klienWajibAda();

  // Ambil supir_id + tanggal/sesi TERLEBIH DAHULU sebelum status diubah --
  // dipakai untuk memberitahu tiap supir yang penugasannya dibatalkan
  // (bisa lebih dari satu supir dalam satu pemanggilan, mis. batal semua
  // penugasan tanggal tertentu dari halaman Penugasan Sopir).
  const { data: perjalananList, error: errBaca } = await client
    .from('perjalanan')
    .select('supir_id, tanggal_perjalanan, jenis_perjalanan')
    .in('id', perjalananIds);
  if (errBaca) throw errBaca;

  const { error } = await client.from('perjalanan').update({ status: 'dibatalkan' }).in('id', perjalananIds);
  if (error) throw error;

  const ringkasanBySupir = new Map<string, { tanggal: string; sesi: string; jumlah: number }>();
  for (const p of (perjalananList ?? []) as any[]) {
    const kunci = `${p.supir_id}|${p.tanggal_perjalanan}|${p.jenis_perjalanan}`;
    const ada = ringkasanBySupir.get(kunci);
    if (ada) ada.jumlah += 1;
    else ringkasanBySupir.set(kunci, { tanggal: p.tanggal_perjalanan, sesi: p.jenis_perjalanan, jumlah: 1 });
  }
  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  for (const [kunci, ringkasan] of ringkasanBySupir) {
    const supirId = kunci.split('|')[0];
    try {
      await kirimNotifikasi({
        penggunaId: supirId,
        judul: 'Penugasan Rute Dibatalkan',
        pesan: `Penugasan Anda untuk ${ringkasan.jumlah} anak pada sesi ${ringkasan.sesi === 'pagi' ? 'Pagi' : 'Sore'} tanggal ${ringkasan.tanggal} telah dibatalkan Admin.`,
        tipe: 'perjalanan',
        tipeTerkait: 'penugasan_dibatalkan'
      });
    } catch (err) {
      console.error('Gagal kirim notifikasi penugasan rute dibatalkan ke supir', supirId, ':', err);
    }
  }
}

// ==========================================
// UC-A08: Kelola Laporan
// ==========================================

// SEBELUMNYA laporan ini selalu dikelompokkan per BULAN kalender (3 bulan
// terakhir, hard-coded) sehingga filter tanggal global (FilterLaporan --
// Minggu Ini/Bulan Ini/Tahun Ini/rentang custom) yang ditampilkan di atas
// tab tidak berpengaruh sama sekali ke tab ini. Sekarang fungsi ini cukup
// mengembalikan SETIAP baris langganan mentah (tanpa pembulatan/bucketing
// bulanan) -- pengelompokan per HARI dan penyaringan rentang tanggal
// dilakukan reaktif di LaporanAdmin.vue (persis pola yang sama dengan
// aktivitasKeuanganTersaring di tab Laporan Keuangan), supaya filter
// "Minggu Ini" dkk. benar-benar berlaku untuk tab ini juga.
export interface LaporanPelangganRow {
  tanggalMulai: string;
  sudahDibayar: boolean;
}

export async function ambilLaporanPelanggan(): Promise<LaporanPelangganRow[]> {
  const client = klienWajibAda();
  const { data, error } = await client.from('langganan').select('tanggal_mulai, sudah_dibayar');
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    tanggalMulai: l.tanggal_mulai,
    sudahDibayar: !!l.sudah_dibayar
  }));
}

export interface LaporanPerformaSupir {
  supirId: string;
  nama: string;
  totalPerjalanan: number;
  rataRataRating: number | null;
}

export async function ambilLaporanPerformaSupir(): Promise<LaporanPerformaSupir[]> {
  const client = klienWajibAda();

  const { data: perjalananSelesai, error: errPerjalanan } = await client
    .from('perjalanan')
    .select('supir_id')
    .eq('status', 'tiba')
    .not('supir_id', 'is', null);
  if (errPerjalanan) throw errPerjalanan;

  const totalBySupir = new Map<string, number>();
  for (const p of perjalananSelesai ?? []) {
    totalBySupir.set(p.supir_id, (totalBySupir.get(p.supir_id) ?? 0) + 1);
  }

  const supirIds = Array.from(totalBySupir.keys());
  if (supirIds.length === 0) return [];

  const [{ data: penggunaData, error: errPengguna }, { data: penilaianData, error: errPenilaian }] = await Promise.all([
    client.from('pengguna').select('id, nama_lengkap').in('id', supirIds),
    client.from('penilaian').select('supir_id, bintang').in('supir_id', supirIds)
  ]);
  if (errPengguna) throw errPengguna;
  if (errPenilaian) throw errPenilaian;

  const namaById = new Map((penggunaData ?? []).map((p: any) => [p.id, p.nama_lengkap]));
  const ratingBySupir = new Map<string, number[]>();
  for (const p of penilaianData ?? []) {
    const list = ratingBySupir.get(p.supir_id) ?? [];
    list.push(p.bintang);
    ratingBySupir.set(p.supir_id, list);
  }

  return supirIds.map((id) => {
    const ratings = ratingBySupir.get(id) ?? [];
    return {
      supirId: id,
      nama: namaById.get(id) ?? 'Supir',
      totalPerjalanan: totalBySupir.get(id) ?? 0,
      rataRataRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
    };
  });
}

export interface AktivitasKeuangan {
  id: string;
  namaOrangTua: string;
  jumlah: number;
  tipePembayaran: 'bulanan' | 'harian' | 'tambahan' | 'pembatalan';
  status: 'menunggu' | 'lunas' | 'gagal' | 'kedaluwarsa';
  // Waktu aktivitas nyata: begitu LUNAS, aktivitas yang tercatat adalah
  // saat pembayaran benar-benar dilunasi (tanggal_pembayaran) -- bukan
  // saat tagihan pertama kali dibuat -- supaya laporan mencerminkan kapan
  // uang benar-benar masuk. Selain lunas, dipakai waktu tagihan dibuat.
  waktuAktivitas: string;
}

/**
 * Laporan Keuangan berbasis AKTIVITAS (satu baris = satu transaksi
 * pembayaran nyata), bukan agregat bulanan -- setiap kali ada pembayaran
 * baru/berubah status, baris baru langsung terlihat di sini (lihat
 * pantauPembayaranRealtime di realtimeLayanan.ts yang dipakai
 * LaporanAdmin.vue utk menambahkan baris secara realtime tanpa refresh).
 */
export async function ambilAktivitasKeuangan(): Promise<AktivitasKeuangan[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pembayaran')
    .select('id, jumlah, tipe_pembayaran, status, dibuat_pada, tanggal_pembayaran, orang_tua_id')
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  const orangTuaIds = Array.from(new Set((data ?? []).map((p: any) => p.orang_tua_id).filter(Boolean)));
  const namaById = new Map<string, string>();
  if (orangTuaIds.length > 0) {
    const { data: penggunaData, error: errPengguna } = await client
      .from('pengguna')
      .select('id, nama_lengkap')
      .in('id', orangTuaIds);
    if (errPengguna) throw errPengguna;
    for (const p of penggunaData ?? []) namaById.set(p.id, p.nama_lengkap);
  }

  const hasil = (data ?? []).map((p: any) => ({
    id: p.id,
    namaOrangTua: namaById.get(p.orang_tua_id) ?? 'Orang Tua',
    jumlah: Number(p.jumlah),
    tipePembayaran: p.tipe_pembayaran,
    status: p.status,
    waktuAktivitas: p.status === 'lunas' && p.tanggal_pembayaran ? p.tanggal_pembayaran : p.dibuat_pada
  }));

  hasil.sort((a, b) => new Date(b.waktuAktivitas).getTime() - new Date(a.waktuAktivitas).getTime());
  return hasil;
}

/**
 * Ambil detail SATU aktivitas keuangan (dipakai saat event realtime hanya
 * membawa payload minimal/tidak lengkap) -- melengkapi nama orang tua dari
 * orang_tua_id sebelum disisipkan ke daftar yang sedang tampil.
 */
export async function ambilAktivitasKeuanganById(pembayaranId: string): Promise<AktivitasKeuangan | null> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pembayaran')
    .select('id, jumlah, tipe_pembayaran, status, dibuat_pada, tanggal_pembayaran, orang_tua_id')
    .eq('id', pembayaranId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let namaOrangTua = 'Orang Tua';
  if (data.orang_tua_id) {
    const { data: pengguna, error: errPengguna } = await client
      .from('pengguna')
      .select('nama_lengkap')
      .eq('id', data.orang_tua_id)
      .maybeSingle();
    if (errPengguna) throw errPengguna;
    if (pengguna?.nama_lengkap) namaOrangTua = pengguna.nama_lengkap;
  }

  return {
    id: data.id,
    namaOrangTua,
    jumlah: Number(data.jumlah),
    tipePembayaran: data.tipe_pembayaran,
    status: data.status,
    waktuAktivitas: data.status === 'lunas' && data.tanggal_pembayaran ? data.tanggal_pembayaran : data.dibuat_pada
  };
}

// ==========================================
// Pengajuan Cuti/Libur Wali (dilihat Admin sebagai informasi operasional --
// anak mana yang tidak perlu dijemput pada tanggal tertentu). Lihat juga
// saringAnakTersediaUntukTanggal() di atas, yang sudah memakai tabel ini
// utk MENGECUALIKAN anak dari penugasan; fungsi ini murni utk TAMPILAN,
// tidak mengubah data apa pun.
// ==========================================

export interface PengajuanCutiAdmin {
  id: string;
  namaOrangTua: string;
  namaAnak: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  diajukanPada: string;
}

export async function ambilPengajuanCutiSemua(): Promise<PengajuanCutiAdmin[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_cuti')
    .select('id, tanggal_mulai, tanggal_selesai, alasan, status, dibuat_pada, anak(nama_lengkap, orang_tua(pengguna(nama_lengkap)))')
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  // Hanya tampilkan pengajuan yang BENAR-BENAR sudah dibuat relatif thd
  // waktu simulasi Admin saat ini -- lihat catatan yang sama di
  // ambilDaftarPengguna() soal dibuat_pada vs tanggal_mulai/tanggal_selesai
  // (yang wajar berada di masa depan, bukan acuan visibilitas).
  const sekarang = ambilWaktuSekarang().toISOString();
  return (data ?? [])
    .filter((p: any) => p.dibuat_pada <= sekarang)
    .map((p: any) => ({
    id: p.id,
    namaOrangTua: p.anak?.orang_tua?.pengguna?.nama_lengkap ?? 'Orang Tua',
    namaAnak: p.anak?.nama_lengkap ?? '(anak tidak ditemukan)',
    tanggalMulai: p.tanggal_mulai,
    tanggalSelesai: p.tanggal_selesai,
    alasan: p.alasan,
    status: p.status,
    diajukanPada: p.dibuat_pada
  }));
}

// ==========================================
// Pengajuan Perubahan Jadwal Jemput/Antar (dilihat Admin sebagai informasi
// operasional -- jam/alamat/tanggal mana yang berubah dari jadwal normal).
// Berlaku otomatis begitu diajukan (lihat ajukanPerubahanJadwal() di
// orangTuaLayanan.ts, yang juga menyinkronkan tabel `perjalanan`), jadi
// fungsi ini murni utk TAMPILAN riwayat, tidak mengubah data apa pun.
// ==========================================

export interface PengajuanPerubahanJadwalAdmin {
  id: string;
  namaOrangTua: string;
  namaAnak: string;
  tanggal: string;
  hari: string | null;
  waktuBaru: string;
  jenisPerubahan: 'pergi' | 'pulang';
  alamatBaru: string | null;
  biayaTambahan: number;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  diajukanPada: string;
}

export async function ambilPengajuanPerubahanJadwalSemua(): Promise<PengajuanPerubahanJadwalAdmin[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('pengajuan_perubahan_jadwal')
    .select('id, tanggal, hari, waktu_baru, jenis_perubahan, alamat_baru, biaya_tambahan, status, dibuat_pada, anak(nama_lengkap, orang_tua(pengguna(nama_lengkap)))')
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  // Sama seperti ambilPengajuanCutiSemua() -- hanya tampilkan pengajuan yang
  // BENAR-BENAR sudah dibuat relatif thd waktu simulasi Admin saat ini.
  const sekarang = ambilWaktuSekarang().toISOString();
  return (data ?? [])
    .filter((p: any) => p.dibuat_pada <= sekarang)
    .map((p: any) => ({
      id: p.id,
      namaOrangTua: p.anak?.orang_tua?.pengguna?.nama_lengkap ?? 'Orang Tua',
      namaAnak: p.anak?.nama_lengkap ?? '(anak tidak ditemukan)',
      tanggal: p.tanggal,
      hari: p.hari,
      waktuBaru: p.waktu_baru,
      jenisPerubahan: p.jenis_perubahan,
      alamatBaru: p.alamat_baru,
      biayaTambahan: Number(p.biaya_tambahan ?? 0),
      status: p.status,
      diajukanPada: p.dibuat_pada
    }));
}

// ==========================================
// UC-A08 (lanjutan): Kelola Laporan Kendala Supir (UC-S04)
// ==========================================

export interface LaporanKendalaAdmin {
  id: string;
  kategori: 'kendala_perjalanan' | 'kendala_anak';
  deskripsi: string;
  status: 'baru' | 'ditindak' | 'selesai';
  dibuatPada: string;
  diperbaruiPada: string | null;
  catatanAdmin: string | null;
  supirId: string;
  namaSupir: string;
  kontakSupir: string | null;
  namaAnak: string | null;
  kontakOrangTua: string | null;
  // Konteks perjalanan tempat kendala dilaporkan -- ditampilkan di detail
  // laporan (LaporanAdmin.vue) supaya Admin tahu ini sesi jemput/antar hari
  // apa, bukan cuma "kapan laporan dikirim" (dibuatPada).
  jenisPerjalanan: 'pagi' | 'sore' | null;
  tanggalPerjalanan: string | null;
}

export async function ambilLaporanKendala(): Promise<LaporanKendalaAdmin[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('laporan_kendala')
    .select(
      'id, kategori, deskripsi, status, dibuat_pada, diperbarui_pada, catatan_admin, supir_id, ' +
      'anak(nama_lengkap, orang_tua(nomor_whatsapp, pengguna(nomor_telepon))), ' +
      'perjalanan(jenis_perjalanan, tanggal_perjalanan)'
    )
    .order('dibuat_pada', { ascending: false });
  if (error) throw error;

  const daftar = (data ?? []) as any[];
  const supirIds = Array.from(new Set(daftar.map((l) => l.supir_id)));
  const supirById = new Map<string, { nama: string; kontak: string | null }>();
  if (supirIds.length > 0) {
    const { data: penggunaData, error: errPengguna } = await client
      .from('pengguna')
      .select('id, nama_lengkap, nomor_telepon')
      .in('id', supirIds);
    if (errPengguna) throw errPengguna;
    for (const p of penggunaData ?? []) supirById.set(p.id, { nama: p.nama_lengkap, kontak: p.nomor_telepon });
  }

  // Sama seperti ambilDaftarPengguna()/ambilPengajuanCutiSemua() -- hanya
  // tampilkan laporan yang benar-benar sudah dibuat relatif thd waktu
  // simulasi Admin saat ini.
  const sekarang = ambilWaktuSekarang().toISOString();
  return daftar
    .filter((l) => l.dibuat_pada <= sekarang)
    .map((l) => ({
    id: l.id,
    kategori: l.kategori,
    deskripsi: l.deskripsi,
    status: l.status,
    dibuatPada: l.dibuat_pada,
    diperbaruiPada: l.diperbarui_pada,
    catatanAdmin: l.catatan_admin,
    supirId: l.supir_id,
    namaSupir: supirById.get(l.supir_id)?.nama ?? 'Supir',
    kontakSupir: supirById.get(l.supir_id)?.kontak ?? null,
    namaAnak: l.anak?.nama_lengkap ?? null,
    // WhatsApp orang tua/wali dari anak yang dilaporkan (khusus kategori
    // kendala_anak) -- nomor_whatsapp di tabel orang_tua diutamakan
    // (kolom itu memang khusus WA, lihat OrangTuaRow), jatuh ke
    // pengguna.nomor_telepon kalau kebetulan kosong.
    kontakOrangTua: l.anak?.orang_tua?.nomor_whatsapp || l.anak?.orang_tua?.pengguna?.nomor_telepon || null,
    jenisPerjalanan: l.perjalanan?.jenis_perjalanan ?? null,
    tanggalPerjalanan: l.perjalanan?.tanggal_perjalanan ?? null
  }));
}

export interface RiwayatLaporanKendala {
  id: string;
  statusSebelum: string | null;
  statusSesudah: string;
  catatan: string | null;
  namaPengubah: string | null;
  dibuatPada: string;
}

/**
 * Riwayat perubahan status satu laporan kendala (log lengkap, bukan cuma
 * status terakhir) -- ditampilkan di modal detail laporan pada
 * LaporanAdmin.vue supaya Admin bisa menelusuri siapa menindaklanjuti apa
 * dan kapan, bukan cuma melihat status final.
 */
export async function ambilRiwayatLaporanKendala(laporanId: string): Promise<RiwayatLaporanKendala[]> {
  const client = klienWajibAda();
  const { data, error } = await client
    .from('riwayat_laporan_kendala')
    .select('id, status_sebelum, status_sesudah, catatan, nama_pengubah, dibuat_pada')
    .eq('laporan_id', laporanId)
    .order('dibuat_pada', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    statusSebelum: r.status_sebelum,
    statusSesudah: r.status_sesudah,
    catatan: r.catatan,
    namaPengubah: r.nama_pengubah,
    dibuatPada: r.dibuat_pada
  }));
}

/**
 * Mengubah status laporan kendala + mencatat transisinya ke
 * riwayat_laporan_kendala (status sebelum/sesudah, catatan admin saat itu,
 * siapa & kapan) -- SEBELUMNYA hanya menimpa kolom `status` tanpa jejak apa
 * pun, jadi tidak bisa ditelusuri riwayat penanganannya. `catatan` opsional
 * (mis. Admin cukup klik "Tandai Selesai" tanpa menulis apa-apa).
 */
export async function perbaruiStatusLaporanKendala(
  laporanId: string,
  status: 'ditindak' | 'selesai',
  supirId: string,
  statusSebelum: 'baru' | 'ditindak' | 'selesai',
  catatan?: string | null
): Promise<void> {
  const client = klienWajibAda();

  const { data: userData } = await client.auth.getUser();
  let namaAdmin: string | null = null;
  if (userData?.user?.id) {
    const { data: profilAdmin } = await client
      .from('pengguna')
      .select('nama_lengkap')
      .eq('id', userData.user.id)
      .single();
    namaAdmin = profilAdmin?.nama_lengkap ?? null;
  }

  // Diambil SEBELUM update -- dipakai buat memutuskan apakah orang tua anak
  // terkait juga perlu diberi tahu (lihat notifikasi tambahan di bawah).
  const { data: laporan } = await client
    .from('laporan_kendala')
    .select('kategori, anak_id')
    .eq('id', laporanId)
    .maybeSingle();

  const sekarangIso = ambilWaktuSekarang().toISOString();
  const { error } = await client
    .from('laporan_kendala')
    .update({ status, catatan_admin: catatan ?? null, diperbarui_pada: sekarangIso })
    .eq('id', laporanId);
  if (error) throw error;

  const { error: errRiwayat } = await client.from('riwayat_laporan_kendala').insert({
    laporan_id: laporanId,
    status_sebelum: statusSebelum,
    status_sesudah: status,
    catatan: catatan ?? null,
    diubah_oleh: userData?.user?.id ?? null,
    nama_pengubah: namaAdmin,
    dibuat_pada: sekarangIso
  });
  if (errRiwayat) throw errRiwayat;

  // Best-effort -- lihat catatan yang sama di fungsi lain berkas ini.
  try {
    await kirimNotifikasi({
      penggunaId: supirId,
      judul: status === 'ditindak' ? 'Laporan Kendala Sedang Ditindak' : 'Laporan Kendala Selesai',
      pesan:
        status === 'ditindak'
          ? 'Laporan kendala yang Anda kirimkan sedang ditindaklanjuti Admin.'
          : 'Laporan kendala yang Anda kirimkan sudah diselesaikan Admin.',
      tipe: 'sistem',
      idTerkait: laporanId,
      tipeTerkait: status === 'ditindak' ? 'kendala_ditindak' : 'kendala_selesai'
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi status laporan kendala:', err);
  }

  // SEBELUMNYA hanya supir pelapor yang diberi tahu -- untuk kategori
  // kendala_anak, orang tua anak yang bersangkutan juga menunggu kabar
  // (mereka sudah diberi tahu saat laporan DIBUAT lewat trigger
  // laporkan_kendala_perjalanan, jadi wajar mereka juga tahu begitu
  // ditindaklanjuti/selesai). Kategori kendala_perjalanan (umum, bisa
  // menyangkut banyak anak sekaligus dalam satu rute) sengaja TIDAK
  // di-fan-out ulang di sini -- lihat laporkan_kendala_perjalanan, audiens
  // "semua orang tua di rute itu" sudah pas untuk notifikasi AWAL, tapi
  // fan-out yang sama utk update status tiap kali bisa berlebihan.
  if (laporan?.kategori === 'kendala_anak' && laporan.anak_id) {
    try {
      const { data: anak } = await client.from('anak').select('orang_tua_id, nama_lengkap').eq('id', laporan.anak_id).maybeSingle();
      if (anak?.orang_tua_id) {
        await kirimNotifikasi({
          penggunaId: anak.orang_tua_id,
          judul: status === 'ditindak' ? 'Laporan Kendala Sedang Ditindak' : 'Laporan Kendala Selesai',
          pesan:
            status === 'ditindak'
              ? `Laporan kendala terkait ${anak.nama_lengkap} sedang ditindaklanjuti Admin.`
              : `Laporan kendala terkait ${anak.nama_lengkap} sudah diselesaikan Admin.`,
          tipe: 'sistem',
          idTerkait: laporanId,
          tipeTerkait: status === 'ditindak' ? 'kendala_ditindak' : 'kendala_selesai'
        });
      }
    } catch (err) {
      console.error('Gagal kirim notifikasi status laporan kendala ke orang tua:', err);
    }
  }
}
