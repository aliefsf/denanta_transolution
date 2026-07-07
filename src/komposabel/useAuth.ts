import { ref } from 'vue';
import { supabase } from '../layanan/supabase';

export function useAuth() {
  const sedangMemuat = ref(false);
  const error = ref<string | null>(null);

  /**
   * Mendaftarkan pengguna baru ke Supabase Auth
   */
  async function daftar(
    email: string,
    kataSandi: string,
    namaLengkap: string,
    peran: 'orangtua' | 'supir' | 'admin',
    nomorTelepon: string = ''
  ) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const { data, error: errSignUp } = await supabase.auth.signUp({
        email,
        password: kataSandi,
        options: {
          data: {
            nama_lengkap: namaLengkap,
            peran: peran,
            nomor_telepon: nomorTelepon
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (errSignUp) throw errSignUp;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat mendaftar';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  /**
   * Masuk menggunakan email & kata sandi
   */
  async function masuk(email: string, kataSandi: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const { data, error: errSignIn } = await supabase.auth.signInWithPassword({
        email,
        password: kataSandi,
      });

      if (errSignIn) throw errSignIn;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Surel atau kata sandi Anda salah';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  /**
   * Keluar dari sesi aktif
   */
  async function keluar() {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const { error: errSignOut } = await supabase.auth.signOut();
      if (errSignOut) throw errSignOut;
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat keluar';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  /**
   * Mengirimkan tautan reset kata sandi ke email pengguna
   */
  async function aturUlangKataSandi(email: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const { data, error: errReset } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/konfirmasi-reset`
      });
      if (errReset) throw errReset;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Gagal mengirim email reset kata sandi';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  /**
   * Memperbarui kata sandi dengan yang baru
   */
  async function perbaruiKataSandi(kataSandiBaru: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const { data, error: errUpdate } = await supabase.auth.updateUser({
        password: kataSandiBaru
      });
      if (errUpdate) throw errUpdate;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Gagal memperbarui kata sandi';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  /**
   * Mengambil sesi pengguna aktif saat ini
   */
  async function ambilPengguna() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Mengambil peran pengguna dari tabel database 'pengguna'
   */
  async function ambilPeran(uid: string): Promise<string> {
    try {
      const { data, error: errPeran } = await supabase
        .from('pengguna')
        .select('peran')
        .eq('id', uid)
        .single();
      
      if (errPeran || !data) return 'tamu';
      return data.peran;
    } catch {
      return 'tamu';
    }
  }

  return {
    sedangMemuat,
    error,
    daftar,
    masuk,
    keluar,
    aturUlangKataSandi,
    perbaruiKataSandi,
    ambilPengguna,
    ambilPeran
  };
}
