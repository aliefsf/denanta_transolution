import { supabase } from './supabase';

/**
 * Fungsi Inti: Mendaftarkan subscription realtime Supabase pada tabel tertentu
 */
export function gunakanRealtimeSubscription(
  tabel: string,
  filter: string | null,
  callback: (payload: any) => void
) {
  if (!supabase) {
    console.warn(`Simulasi Realtime Subscription: Supabase client tidak aktif. Melewati tabel ${tabel}`);
    return {
      unsubscribe: () => console.log(`Simulasi Realtime: Berhenti berlangganan tabel ${tabel}`)
    };
  }

  const namaSaluran = `${tabel}_perubahan_${Math.random().toString(36).substring(2, 7)}`;

  const konfigurasiFilter: any = {
    event: '*', // Menangkap INSERT, UPDATE, dan DELETE
    schema: 'public',
    table: tabel
  };

  // Tambahkan filter jika spesifik (contoh: "id=eq.1")
  if (filter) {
    konfigurasiFilter.filter = filter;
  }

  // Batas percobaan sambung ulang -- SEBELUMNYA supabase-js mencoba
  // reconnect TANPA HENTI kalau koneksi/DNS benar-benar putus (mis. project
  // Supabase sedang paused), membanjiri console dengan
  // SUBSCRIBED/CHANNEL_ERROR bergantian selamanya tanpa pernah berhasil.
  // Setelah GAGAL_BERTURUT_MAKS kali berturut-turut, berhenti mencoba &
  // catat SEKALI sebagai warning -- fitur yang bergantung pada realtime ini
  // (badge notifikasi, dst.) tetap jalan lewat fetch awal, cuma tidak lagi
  // auto-update live sampai halaman di-refresh.
  const GAGAL_BERTURUT_MAKS = 5;
  let gagalBerturut = 0;
  let sudahMenyerah = false;

  const saluran = supabase
    .channel(namaSaluran)
    .on('postgres_changes', konfigurasiFilter, (payload) => {
      callback(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        gagalBerturut = 0;
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        gagalBerturut++;
        if (gagalBerturut >= GAGAL_BERTURUT_MAKS && !sudahMenyerah) {
          sudahMenyerah = true;
          console.warn(
            `Realtime [${tabel}] gagal tersambung ${GAGAL_BERTURUT_MAKS}x berturut-turut -- berhenti mencoba. ` +
            `Cek koneksi internet, atau kemungkinan project Supabase sedang paused (biasa terjadi pada tier gratis setelah tidak aktif).`
          );
          saluran.unsubscribe();
        }
      }
    });

  return saluran;
}

/**
 * Use Case 1: Pantau pergerakan rute perjalanan di dashboard Orang Tua & Supir
 */
export function pantauPerjalananRealtime(
  perjalananId: string,
  callback: (payload: any) => void
) {
  return gunakanRealtimeSubscription(
    'perjalanan',
    `id=eq.${perjalananId}`,
    callback
  );
}

/**
 * Use Case 2: Pantau log perubahan status penjemputan anak
 */
export function pantauLogStatusPerjalananRealtime(
  perjalananId: string,
  callback: (payload: any) => void
) {
  return gunakanRealtimeSubscription(
    'log_status_perjalanan',
    `perjalanan_id=eq.${perjalananId}`,
    callback
  );
}

/**
 * Use Case 3: Pantau notifikasi baru yang dikirimkan ke akun orang tua
 */
export function pantauNotifikasiRealtime(
  penggunaId: string,
  callback: (payload: any) => void
) {
  return gunakanRealtimeSubscription(
    'notifikasi',
    `pengguna_id=eq.${penggunaId}`,
    callback
  );
}

/**
 * Use Case 4: Pantau posisi terkini supir (lintang_terkini/bujur_terkini)
 * untuk peta lokasi langsung di dashboard orang tua
 */
export function pantauSupirRealtime(
  supirId: string,
  callback: (payload: any) => void
) {
  return gunakanRealtimeSubscription(
    'supir',
    `id=eq.${supirId}`,
    callback
  );
}

/**
 * Use Case 5: Pantau perubahan status perjalanan (baris `perjalanan`) untuk
 * seluruh anak milik satu akun orang tua sekaligus, supaya status yang
 * diperbarui supir di panel Supir langsung tampil di panel Orang Tua tanpa
 * refresh. Filter `in.(...)` Postgres Changes membatasi event hanya untuk
 * anak_id milik akun yang sedang memantau.
 */
export function pantauPerjalananAnakRealtime(
  anakIds: string[],
  callback: (payload: any) => void
) {
  if (anakIds.length === 0) {
    return { unsubscribe: () => {} };
  }
  return gunakanRealtimeSubscription(
    'perjalanan',
    `anak_id=in.(${anakIds.join(',')})`,
    callback
  );
}

/**
 * Use Case 6: Pantau seluruh baris `pembayaran` (INSERT/UPDATE) secara
 * realtime untuk Laporan Keuangan Admin (LaporanAdmin.vue) -- setiap
 * pengguna melakukan/menyelesaikan pembayaran di mana pun (wizard
 * berlangganan, tagihan bulan berikutnya, dst), baris aktivitas baru
 * langsung muncul di laporan tanpa admin perlu refresh halaman. Tanpa
 * filter karena admin memantau SEMUA transaksi, bukan milik satu akun.
 */
export function pantauPembayaranRealtime(callback: (payload: any) => void) {
  return gunakanRealtimeSubscription('pembayaran', null, callback);
}

/**
 * Use Case 7: Pantau tabel `laporan_kendala` (INSERT dari supir, UPDATE
 * status dari Admin) secara realtime untuk tab "Laporan Kendala" di
 * LaporanAdmin.vue -- laporan baru/perubahan status langsung tampil tanpa
 * admin perlu refresh manual, sama seperti pantauPembayaranRealtime() di
 * atas. Tanpa filter karena admin memantau laporan dari SELURUH supir.
 */
export function pantauLaporanKendalaRealtime(callback: (payload: any) => void) {
  return gunakanRealtimeSubscription('laporan_kendala', null, callback);
}

/**
 * Use Case 7b: Versi khusus milik SATU supir (RiwayatSupir.vue -- "Laporan
 * Kendala Saya") -- supir hanya perlu tahu perubahan pada laporannya
 * sendiri, bukan seluruh laporan platform seperti Admin.
 */
export function pantauLaporanKendalaSupirRealtime(supirId: string, callback: (payload: any) => void) {
  return gunakanRealtimeSubscription('laporan_kendala', `supir_id=eq.${supirId}`, callback);
}

/**
 * Use Case 8: Pantau baris `langganan` milik anak-anak satu akun orang tua
 * -- dipakai utk kartu "Status Langganan"/"Sisa Langganan" di Dashboard
 * Orang Tua supaya langsung berubah begitu Admin/webhook Midtrans melunasi
 * pembayaran & memperpanjang tanggal_berakhir, tanpa refresh.
 */
export function pantauLanggananAnakRealtime(anakIds: string[], callback: (payload: any) => void) {
  if (anakIds.length === 0) return { unsubscribe: () => {} };
  return gunakanRealtimeSubscription('langganan', `anak_id=in.(${anakIds.join(',')})`, callback);
}

/**
 * Use Case 9: Pantau baris `pembayaran` milik SATU akun orang tua --
 * dipakai di RiwayatPembayaran.vue supaya status lunas/menunggu langsung
 * berubah begitu webhook Midtrans mengonfirmasi, tanpa refresh. Beda dari
 * pantauPembayaranRealtime() (Admin, tanpa filter/lintas akun).
 */
export function pantauPembayaranOrangTuaRealtime(orangTuaId: string, callback: (payload: any) => void) {
  return gunakanRealtimeSubscription('pembayaran', `orang_tua_id=eq.${orangTuaId}`, callback);
}

/**
 * Use Case 10: Pantau pengajuan (cuti/absen/perubahan jadwal) milik anak-anak
 * satu akun orang tua -- generik, dipakai JadwalOrangTua.vue utk ketiga
 * tabel (pengajuan_cuti, pengajuan_absen, pengajuan_perubahan_jadwal) supaya
 * status persetujuan/perubahan yang disinkronkan sistem langsung tampil,
 * dan JUGA dipakai KelolaJadwalAdmin.vue (tanpa filter anak_id) utk melihat
 * SELURUH pengajuan lintas akun.
 */
export function pantauTabelAnakRealtime(
  tabel: 'pengajuan_cuti' | 'pengajuan_absen' | 'pengajuan_perubahan_jadwal',
  anakIds: string[],
  callback: (payload: any) => void
) {
  if (anakIds.length === 0) return { unsubscribe: () => {} };
  return gunakanRealtimeSubscription(tabel, `anak_id=in.(${anakIds.join(',')})`, callback);
}

/**
 * Use Case 11: Versi Admin (TANPA filter, lintas seluruh akun) dari
 * pengajuan_cuti/pengajuan_absen/pengajuan_perubahan_jadwal/penundaan_pembayaran
 * -- dipakai KelolaJadwalAdmin.vue & LaporanAdmin.vue supaya pengajuan baru
 * dari orang tua mana pun langsung tampil tanpa Admin perlu refresh.
 */
export function pantauTabelAdminRealtime(
  tabel: 'pengajuan_cuti' | 'pengajuan_absen' | 'pengajuan_perubahan_jadwal' | 'penundaan_pembayaran'
    | 'hari_libur' | 'pengaturan_tarif' | 'sekolah' | 'kelas_sekolah' | 'anak' | 'supir' | 'pengguna'
    | 'perjalanan' | 'langganan' | 'laporan_kendala' | 'pembayaran',
  callback: (payload: any) => void
) {
  return gunakanRealtimeSubscription(tabel, null, callback);
}
