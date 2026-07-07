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

  const saluran = supabase
    .channel(namaSaluran)
    .on('postgres_changes', konfigurasiFilter, (payload) => {
      console.log(`Supabase Realtime [${tabel}] Event Diterima:`, payload);
      callback(payload);
    })
    .subscribe((status) => {
      console.log(`Status realtime kanal [${tabel}]: ${status}`);
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
