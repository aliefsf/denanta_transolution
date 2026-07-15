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

      // Membuat profil pada public.pengguna dan tabel spesifik peran jika user berhasil terdaftar
      if (data?.user) {
        // Cek duplikasi untuk menghindari error duplicate key
        const { data: profilSama } = await client
          .from('pengguna')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profilSama) {
          const { error: errInsert } = await client
            .from('pengguna')
            .insert({
              id: data.user.id,
              email: email,
              peran: peran,
              nama_lengkap: namaLengkap,
              nomor_telepon: nomorTelepon
            });

          if (errInsert) {
            throw new Error(`Gagal menyimpan profil pengguna ke database: ${errInsert.message}`);
          }

          // Buat baris awal di tabel peran spesifik (orang_tua atau supir)
          if (peran === 'orangtua') {
            const { error: errOrangTua } = await client
              .from('orang_tua')
              .insert({
                id: data.user.id,
                alamat: '',
                kontak_darurat: '',
                nomor_whatsapp: nomorTelepon
              });
            if (errOrangTua) {
              throw new Error(`Gagal menyimpan profil orang tua ke database: ${errOrangTua.message}`);
            }
          } else if (peran === 'supir') {
            const { error: errSupir } = await client
              .from('supir')
              .insert({
                id: data.user.id,
                jenis_kendaraan: '',
                nomor_plat: '',
                tipe_supir: 'tetap',
                aktif: false,
                status_verifikasi: 'menunggu'
              });
            if (errSupir) {
              throw new Error(`Gagal menyimpan profil supir ke database: ${errSupir.message}`);
            }
          }
        }
      }

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
      const client = harusAdaSupabase();
      const { data, error: errPeran } = await client
        .from('pengguna')
        .select('peran')
        .eq('id', uid)
        .single();
      
      if (!errPeran && data) return data.peran;

      // Skenario Pemulihan: Jika profil tidak ditemukan, sinkronisasikan ulang dari Supabase Auth metadata
      const { data: { user } } = await client.auth.getUser();
      if (user && user.id === uid) {
        const metadata = user.user_metadata || {};
        const email = user.email || '';
        const peran = (metadata.peran as string) || 'orangtua';
        const namaLengkap = (metadata.nama_lengkap as string) || 'Pengguna Baru';
        const nomorTelepon = (metadata.nomor_telepon as string) || '';

        // Cek kembali duplikasi profil
        const { data: cekProfil } = await client
          .from('pengguna')
          .select('id')
          .eq('id', uid)
          .maybeSingle();

        if (!cekProfil) {
          const { error: errInsert } = await client
            .from('pengguna')
            .insert({
              id: uid,
              email: email,
              peran: peran,
              nama_lengkap: namaLengkap,
              nomor_telepon: nomorTelepon
            });

          if (!errInsert) {
            if (peran === 'orangtua') {
              await client.from('orang_tua').insert({
                id: uid,
                alamat: '',
                kontak_darurat: '',
                nomor_whatsapp: nomorTelepon
              });
            } else if (peran === 'supir') {
              await client.from('supir').insert({
                id: uid,
                jenis_kendaraan: '',
                nomor_plat: '',
                tipe_supir: 'tetap',
                aktif: false,
                status_verifikasi: 'menunggu'
              });
            }
            return peran;
          }
        }
      }

      return 'tamu';
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
