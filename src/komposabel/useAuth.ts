import { ref } from 'vue';
import { supabase } from '../layanan/supabase';

function harusAdaSupabase() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

export function useAuth() {
  const sedangMemuat = ref(false);
  const error = ref<string | null>(null);

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
      const client = harusAdaSupabase();
      const { data, error: errSignUp } = await client.auth.signUp({
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

  async function masuk(email: string, kataSandi: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errSignIn } = await client.auth.signInWithPassword({
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

  async function keluar() {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { error: errSignOut } = await client.auth.signOut();
      if (errSignOut) throw errSignOut;
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat keluar';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function aturUlangKataSandi(email: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errReset } = await client.auth.resetPasswordForEmail(email, {
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

  async function perbaruiKataSandi(kataSandiBaru: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errUpdate } = await client.auth.updateUser({
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

  async function ambilPengguna() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async function ambilPeran(uid: string): Promise<string> {
    if (!supabase) return 'tamu';
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
