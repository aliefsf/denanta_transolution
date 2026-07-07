import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuth } from '../komposabel/useAuth';

export const useAuthStore = defineStore('authStore', () => {
  // State
  const pengguna = ref<any | null>(null);
  const peran = ref<string>('tamu');
  const sudahLogin = ref(false);
  const sedangMemuat = ref(false);

  const auth = useAuth();

  // Getters
  const apakahOrangTua = computed(() => peran.value === 'orangtua');
  const apakahSupir = computed(() => peran.value === 'supir');
  const apakahAdmin = computed(() => peran.value === 'admin');

  // Actions
  async function ambilPeranPengguna(uid: string) {
    const hasilPeran = await auth.ambilPeran(uid);
    peran.value = hasilPeran;
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
      }
    } catch {
      pengguna.value = null;
      peran.value = 'tamu';
      sudahLogin.value = false;
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
    } finally {
      sedangMemuat.value = false;
    }
  }

  return {
    pengguna,
    peran,
    sudahLogin,
    sedangMemuat,
    apakahOrangTua,
    apakahSupir,
    apakahAdmin,
    login,
    logout,
    periksaLogin,
    ambilPeranPengguna
  };
});
