import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuth } from '../komposabel/useAuth';
import { supabase } from '../layanan/supabase';

export const useAuthStore = defineStore('authStore', () => {
  // State
  const pengguna = ref<any | null>(null);
  const peran = ref<string>('tamu');
  const sudahLogin = ref(false);
  const sedangMemuat = ref(false);
  const sudahBerlangganan = ref(false);

  const auth = useAuth();

  // Getters
  const apakahOrangTua = computed(() => peran.value === 'orangtua');
  const apakahSupir = computed(() => peran.value === 'supir');
  const apakahAdmin = computed(() => peran.value === 'admin');

  // Actions
  async function periksaStatusBerlangganan(uid: string) {
    // 1. Cek dari LocalStorage terlebih dahulu (berguna untuk mock/testing)
    const mockBerlangganan = localStorage.getItem(`langganan_${uid}`);
    if (mockBerlangganan === 'true') {
      sudahBerlangganan.value = true;
      return;
    }

    // 2. Cek ke database Supabase nyata jika terhubung
    const db = supabase;
    if (db && uid && uid !== 'usr-mock') {
      try {
        const { count, error } = await db
          .from('anak')
          .select('*', { count: 'exact', head: true })
          .eq('orang_tua_id', uid);
        if (!error && count !== null && count > 0) {
          sudahBerlangganan.value = true;
          localStorage.setItem(`langganan_${uid}`, 'true');
          return;
        }
      } catch {
        // Abaikan error
      }
    }
    sudahBerlangganan.value = false;
  }

  function setSudahBerlangganan(status: boolean) {
    sudahBerlangganan.value = status;
    if (pengguna.value?.id) {
      localStorage.setItem(`langganan_${pengguna.value.id}`, status ? 'true' : 'false');
    }
  }

  async function ambilPeranPengguna(uid: string) {
    const hasilPeran = await auth.ambilPeran(uid);
    peran.value = hasilPeran;
    
    if (hasilPeran === 'orangtua') {
      await periksaStatusBerlangganan(uid);
    } else {
      sudahBerlangganan.value = false;
    }
  }

  async function periksaLogin() {
    sedangMemuat.value = true;
    try {
      const user = await auth.ambilPengguna();
      if (user) {
        pengguna.value = user;
        sudahLogin.value = true;
        await ambilPeranPengguna(user.id);
      } else {
        pengguna.value = null;
        peran.value = 'tamu';
        sudahLogin.value = false;
        sudahBerlangganan.value = false;
      }
    } catch {
      pengguna.value = null;
      peran.value = 'tamu';
      sudahLogin.value = false;
      sudahBerlangganan.value = false;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function login(email: string, kataSandi: string) {
    sedangMemuat.value = true;
    try {
      const data = await auth.masuk(email, kataSandi);
      if (data?.user) {
        pengguna.value = data.user;
        sudahLogin.value = true;
        await ambilPeranPengguna(data.user.id);
      }
      return data;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function logout() {
    sedangMemuat.value = true;
    try {
      await auth.keluar();
      pengguna.value = null;
      peran.value = 'tamu';
      sudahLogin.value = false;
      sudahBerlangganan.value = false;
    } finally {
      sedangMemuat.value = false;
    }
  }

  return {
    pengguna,
    peran,
    sudahLogin,
    sedangMemuat,
    sudahBerlangganan,
    apakahOrangTua,
    apakahSupir,
    apakahAdmin,
    login,
    logout,
    periksaLogin,
    ambilPeranPengguna,
    setSudahBerlangganan,
    periksaStatusBerlangganan
  };
});
