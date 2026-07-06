import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Pengguna, Kordinat } from '../tipe';

export const usePenyimpananUtama = defineStore('utama', () => {
  // State
  const penggunaAktif = ref<Pengguna | null>({
    id: 'usr-001',
    nama: 'Alief Fadhillah',
    surel: 'alief@denantats.co.id',
    peran: 'orangtua',
    noTelepon: '+6281234567890'
  });
  
  const statusLoading = ref(false);
  const kordinatDriver = ref<Kordinat>({ lat: -6.3725, lng: 106.8294 });

  // Getters
  const isMasuk = computed(() => penggunaAktif.value !== null);
  const peranPengguna = computed(() => penggunaAktif.value?.peran || 'tamu');

  // Actions
  function setPengguna(pengguna: Pengguna | null) {
    penggunaAktif.value = pengguna;
  }

  function setLoading(loading: boolean) {
    statusLoading.value = loading;
  }

  function perbaruiLokasiDriver(lat: number, lng: number) {
    kordinatDriver.value = { lat, lng };
  }

  function keluar() {
    penggunaAktif.value = null;
  }

  return {
    penggunaAktif,
    statusLoading,
    kordinatDriver,
    isMasuk,
    peranPengguna,
    setPengguna,
    setLoading,
    perbaruiLokasiDriver,
    keluar
  };
});
