import { ref } from 'vue';
import { usePenyimpananUtama } from '../penyimpanan/penyimpananUtama';
import { Pengguna } from '../tipe';

export function useAutentikasi() {
  const penyimpanan = usePenyimpananUtama();
  const error = ref<string | null>(null);
  const loading = ref(false);

  async function masuk(surel: string, sandi: string) {
    loading.value = true;
    error.value = null;
    try {
      // Mock login process
      if (surel && sandi) {
        let peran: 'orangtua' | 'supir' | 'admin' = 'orangtua';
        if (surel.includes('admin')) peran = 'admin';
        else if (surel.includes('supir')) peran = 'supir';

        const mockPengguna: Pengguna = {
          id: `usr-${Math.random().toString(36).substr(2, 9)}`,
          nama: surel.split('@')[0].toUpperCase(),
          surel,
          peran
        };
        penyimpanan.setPengguna(mockPengguna);
      } else {
        throw new Error('Surel dan kata sandi wajib diisi');
      }
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat masuk';
    } finally {
      loading.value = false;
    }
  }

  function keluar() {
    penyimpanan.keluar();
  }

  return {
    error,
    loading,
    masuk,
    keluar
  };
}
