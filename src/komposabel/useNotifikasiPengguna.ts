import { computed, ref } from 'vue';
import { useAuthStore } from '../penyimpanan/authStore';
import type { NotifikasiRow } from '../tipe';
import {
  ambilNotifikasiPengguna,
  tandaiNotifikasiDibaca,
  tandaiSemuaNotifikasiDibaca,
  hapusNotifikasi,
  hapusSemuaNotifikasi
} from '../layanan/notifikasiLayanan';
import { pantauNotifikasiRealtime } from '../layanan/realtimeLayanan';

// Singleton module-scope state (pola sama seperti useDataOrangTua.ts) --
// dipakai BERSAMA oleh Admin (TataLetakAdmin.vue + NotifikasiAdmin.vue) dan
// Supir (TataLetakSupir.vue + NotifikasiSupir.vue). SEBELUMNYA badge lonceng
// di header dan daftar notifikasi masing-masing menyimpan `notifikasiList`
// terpisah (dua instance data berbeda) -- begitu satu notifikasi ditandai
// dibaca di halaman daftar, badge di header BARU ikut berubah setelah
// kanal realtime-nya sendiri menerima event UPDATE dan fetch ulang (ada
// jeda round-trip, dan kalau realtime gagal/telat, badge-nya nyangkut
// salah). Sekarang keduanya membaca/menulis instance `notifikasiList` yang
// SAMA PERSIS, jadi begitu satu notifikasi ditandai dibaca, `jumlahBelumDibaca`
// (computed dari list yang sama) langsung berubah SEKETIKA lewat reaktivitas
// Vue biasa -- tidak menunggu apa pun. Realtime tetap dipasang di sini
// (bukan dihapus) supaya notifikasi BARU dari aksi peran lain tetap muncul
// otomatis tanpa reload.
const notifikasiList = ref<NotifikasiRow[]>([]);
const sedangMemuat = ref(false);
const error = ref<string | null>(null);
const sudahDimuat = ref(false);
let saluranNotifikasi: { unsubscribe: () => void } | null = null;

/**
 * WAJIB dipanggil saat logout (lihat authStore.ts) -- tanpa ini, akun lain
 * yang login berikutnya di tab/sesi SPA yang sama akan mewarisi notifikasi
 * akun sebelumnya sebelum fetch pertamanya sendiri selesai.
 */
export function resetNotifikasiPengguna() {
  saluranNotifikasi?.unsubscribe();
  saluranNotifikasi = null;
  notifikasiList.value = [];
  sedangMemuat.value = false;
  error.value = null;
  sudahDimuat.value = false;
}

export function useNotifikasiPengguna() {
  const authStore = useAuthStore();
  const penggunaId = computed(() => authStore.pengguna?.id ?? null);

  // Dihitung dari LIST YANG SAMA yang dipakai badge maupun daftar --
  // otomatis benar begitu status sudah_dibaca berubah di mana pun, tanpa
  // query COUNT terpisah yang bisa tidak sinkron dengan apa yang sedang
  // ditampilkan di layar.
  const jumlahBelumDibaca = computed(() => notifikasiList.value.filter((n) => !n.sudah_dibaca).length);

  async function muatNotifikasi() {
    if (!penggunaId.value) return;
    sedangMemuat.value = true;
    try {
      notifikasiList.value = await ambilNotifikasiPengguna(penggunaId.value);
      error.value = null;
    } catch (err: any) {
      error.value = err.message || 'Gagal memuat notifikasi.';
    } finally {
      sedangMemuat.value = false;
      sudahDimuat.value = true;
    }

    if (!saluranNotifikasi && penggunaId.value) {
      saluranNotifikasi = pantauNotifikasiRealtime(penggunaId.value, () => {
        muatNotifikasi();
      });
    }
  }

  async function tandaiSatuDibaca(id: string) {
    await tandaiNotifikasiDibaca(id);
    const item = notifikasiList.value.find((n) => n.id === id);
    if (item) item.sudah_dibaca = true;
  }

  async function tandaiSemuaDibaca() {
    if (!penggunaId.value) return;
    await tandaiSemuaNotifikasiDibaca(penggunaId.value);
    notifikasiList.value.forEach((n) => (n.sudah_dibaca = true));
  }

  async function hapusSatu(id: string) {
    await hapusNotifikasi(id);
    notifikasiList.value = notifikasiList.value.filter((n) => n.id !== id);
  }

  async function hapusSemua() {
    if (!penggunaId.value) return;
    await hapusSemuaNotifikasi(penggunaId.value);
    notifikasiList.value = [];
  }

  return {
    notifikasiList,
    sedangMemuat,
    error,
    sudahDimuat,
    penggunaId,
    jumlahBelumDibaca,
    muatNotifikasi,
    tandaiSatuDibaca,
    tandaiSemuaDibaca,
    hapusSatu,
    hapusSemua
  };
}
