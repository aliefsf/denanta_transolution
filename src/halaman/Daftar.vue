<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../komposabel/useAuth';
import { useAuthStore } from '../penyimpanan/authStore';
import { supabase } from '../layanan/supabase';
import { kompresiGambar } from '../bantuan/kompresiGambar';
import {
  Mail, KeyRound, User, Phone,
  AlertTriangle, Loader2, Camera,
  Eye, EyeOff
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const authStore = useAuthStore();

// Jika halaman ini dibuka lewat redirect guard /berlangganan (lihat rute/index.ts),
// lanjutkan ke wizard berlangganan setelah berhasil daftar. Jika dibuka langsung
// lewat tombol "Daftar" di navbar/hero, kembalikan ke landing page.
const tujuanSetelahDaftar = route.query.lanjut === 'berlangganan' ? '/berlangganan' : '/';

const namaLengkap = ref('');
const email = ref('');
const nomorTelepon = ref('');
const peran = 'orangtua' as const;
const kataSandi = ref('');
const konfirmasiSandi = ref('');

const errorPesan = ref<string | null>(null);
const sedangLoading = ref(false);

const tunjukkanSandi = ref(false);
const tunjukkanKonfirmasiSandi = ref(false);

// Foto profil (OPSIONAL) -- dikompresi jadi JPEG kecil (base64) di klien
// lewat kompresiGambar() lalu dikirim sebagai metadata signUp() (lihat
// auth.daftar() di useAuth.ts). BELUM bisa diunggah ke Storage bucket biasa
// di titik ini karena akun belum punya sesi aktif (konfirmasi email/OTP
// masih tertunda) -- trigger database yang menyimpannya ke pengguna.foto_profil.
const fotoProfil = ref('');
const inputFotoProfil = ref<HTMLInputElement | null>(null);
const errorFotoProfil = ref('');

const pilihFotoProfil = async (e: Event) => {
  errorFotoProfil.value = '';
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) return;

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    errorFotoProfil.value = 'Format foto harus PNG atau JPG.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    errorFotoProfil.value = 'Ukuran foto maksimal 5 MB.';
    return;
  }

  try {
    fotoProfil.value = await kompresiGambar(file);
  } catch {
    errorFotoProfil.value = 'Gagal memproses foto, silakan coba foto lain.';
  }
};

const hapusFotoProfil = () => {
  fotoProfil.value = '';
  if (inputFotoProfil.value) inputFotoProfil.value.value = '';
};

const tanganiDaftar = async () => {
  if (!namaLengkap.value || !email.value || !kataSandi.value || !konfirmasiSandi.value) {
    errorPesan.value = 'Silakan lengkapi seluruh kolom yang tersedia';
    return;
  }

  if (kataSandi.value !== konfirmasiSandi.value) {
    errorPesan.value = 'Kata sandi dan konfirmasi kata sandi tidak cocok';
    return;
  }

  if (kataSandi.value.length < 6) {
    errorPesan.value = 'Kata sandi minimal harus 6 karakter';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    const client = supabase;
    if (!client) {
      // Perilaku Simulasi Lokal/Mock jika Supabase tidak dikonfigurasi
      await new Promise(resolve => setTimeout(resolve, 1500));
      authStore.sudahLogin = true;
      authStore.peran = 'orangtua';
      // replace, bukan push -- supaya tombol back tidak balik ke form Daftar
      // yang sudah tidak relevan setelah akun langsung aktif (sama seperti
      // alasan replace di Login.vue).
      router.replace(tujuanSetelahDaftar);
      return;
    }

    // Konfirmasi email WAJIB aktif di pengaturan Supabase Auth (Confirm email
    // = ON, autoconfirm dimatikan) supaya signUp() TIDAK langsung membuat
    // sesi aktif -- akun baru harus lewat verifikasi kode OTP dulu (lihat
    // VerifikasiOtp.vue) sebelum benar-benar bisa dipakai untuk login.
    await auth.daftar(
      email.value,
      kataSandi.value,
      namaLengkap.value,
      peran,
      nomorTelepon.value,
      fotoProfil.value
    );
    router.push({
      path: '/verifikasi-otp',
      query: {
        email: email.value,
        ...(route.query.lanjut === 'berlangganan' ? { lanjut: 'berlangganan' } : {})
      }
    });
  } catch (err: any) {
    errorPesan.value = err.message || 'Terjadi kesalahan saat mendaftar';
  } finally {
    sedangLoading.value = false;
  }
};

const loginDenganGoogle = async () => {
  sedangLoading.value = true;
  errorPesan.value = null;
  try {
    const client = supabase;
    if (client) {
      const { error: errGoogle } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (errGoogle) throw errGoogle;
    } else {
      await new Promise(resolve => setTimeout(resolve, 1500));
      authStore.sudahLogin = true;
      authStore.peran = 'orangtua';
      router.replace('/');
    }
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal masuk dengan Google';
  } finally {
    sedangLoading.value = false;
  }
};

</script>

<template>
  <div class="bg-pattern min-h-screen text-on-surface font-body-md antialiased overflow-x-hidden relative flex flex-col items-center justify-center py-12 px-margin-mobile md:px-margin-desktop">
    
    <!-- Background Accents -->
    <div class="fixed top-0 left-0 w-64 h-64 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-[0.05] -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"></div>
    <div class="fixed bottom-0 right-0 w-96 h-96 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-[0.05] translate-x-1/4 translate-y-1/4 z-0 pointer-events-none"></div>

    <main class="relative z-10 w-full max-w-md mx-auto">
      
      <!-- Buat Akun (Form Pendaftaran) -->
      <div class="bg-surface-container-lowest rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col relative overflow-hidden text-left">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Memproses Pendaftaran...</p>
          </div>
        </div>

        <div class="mb-6">
          <h1 class="font-headline-lg text-headline-lg text-on-surface mb-2">Daftar Akun</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">Buat akun untuk mulai berlangganan layanan antar jemput anak sekolah.</p>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="mb-4 bg-error-container/20 border border-solid border-error p-3.5 rounded-xl flex items-start gap-2.5">
          <AlertTriangle class="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <div class="text-xs text-error leading-normal">{{ errorPesan }}</div>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="tanganiDaftar">
          <!-- Foto Profil (Opsional) -->
          <div class="flex flex-col items-center gap-2">
            <button
              type="button"
              class="relative w-20 h-20 rounded-full bg-surface-bright border border-solid border-outline-variant flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-container transition-colors"
              @click="inputFotoProfil?.click()"
            >
              <img v-if="fotoProfil" :src="fotoProfil" alt="Foto profil" class="w-full h-full object-cover" />
              <Camera v-else class="w-6 h-6 text-on-surface-variant" />
            </button>
            <input ref="inputFotoProfil" type="file" accept="image/png,image/jpeg,image/jpg" class="hidden" @change="pilihFotoProfil" />
            <button
              v-if="fotoProfil"
              type="button"
              class="text-[11px] text-error hover:underline bg-transparent border-0 cursor-pointer p-0"
              @click="hapusFotoProfil"
            >
              Hapus Foto
            </button>
            <p v-else class="text-[11px] text-on-surface-variant">Foto Profil (Opsional)</p>
            <p v-if="errorFotoProfil" class="text-[11px] text-error">{{ errorFotoProfil }}</p>
          </div>

          <!-- Full Name (Required by DB) -->
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              v-model="namaLengkap"
              required
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[10px] py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
              placeholder="Nama Lengkap" 
              type="text"
            />
          </div>

          <!-- Phone Number (Required by DB) -->
          <div class="relative">
            <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              v-model="nomorTelepon"
              required
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[10px] py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
              placeholder="Contoh: 08123456789 (Nomor WhatsApp)"
              type="tel"
            />
          </div>

          <!-- Email -->
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              v-model="email"
              required
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[10px] py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
              placeholder="Email" 
              type="email"
            />
          </div>

          <!-- Password -->
          <div class="relative">
            <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              v-model="kataSandi"
              required
              :type="tunjukkanSandi ? 'text' : 'password'"
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[10px] py-3 pl-10 pr-10 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
              placeholder="Kata Sandi"
            />
            <button 
              type="button" 
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary-container transition-colors bg-transparent border-0 cursor-pointer p-0"
              @click="tunjukkanSandi = !tunjukkanSandi"
            >
              <EyeOff v-if="tunjukkanSandi" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>

          <!-- Confirm Password -->
          <div class="relative">
            <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              v-model="konfirmasiSandi"
              required
              :type="tunjukkanKonfirmasiSandi ? 'text' : 'password'"
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[10px] py-3 pl-10 pr-10 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
              placeholder="Konfirmasi Kata Sandi"
            />
            <button 
              type="button" 
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary-container transition-colors bg-transparent border-0 cursor-pointer p-0"
              @click="tunjukkanKonfirmasiSandi = !tunjukkanKonfirmasiSandi"
            >
              <EyeOff v-if="tunjukkanKonfirmasiSandi" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>

          <button 
            type="submit" 
            class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-label-md text-label-md transition-colors mt-2 cursor-pointer border-0 shadow-sm"
          >
            Daftar
          </button>
        </form>

        <div class="flex items-center gap-4 my-5">
          <div class="flex-1 h-px bg-outline-variant opacity-50"></div>
          <span class="font-body-md text-body-md text-outline">atau</span>
          <div class="flex-1 h-px bg-outline-variant opacity-50"></div>
        </div>

        <button 
          type="button" 
          @click="loginDenganGoogle"
          class="w-full bg-surface-container-lowest border border-solid border-outline-variant hover:bg-surface-container-low text-on-surface rounded-[12px] py-3 flex items-center justify-center gap-3 transition-colors mb-6 cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.37 10H12V14.26H17.92C17.66 15.63 16.89 16.79 15.71 17.58V20.35H19.27C21.36 18.43 22.56 15.6 22.56 12.25Z" fill="#4285F4"></path>
            <path d="M12 23C14.97 23 17.46 22.02 19.27 20.35L15.71 17.58C14.73 18.24 13.48 18.63 12 18.63C9.14 18.63 6.7 16.7 5.84 14.12H2.17V16.96C3.98 20.55 7.69 23 12 23Z" fill="#34A853"></path>
            <path d="M5.84 14.12C5.62 13.47 5.49 12.76 5.49 12C5.49 11.24 5.62 10.53 5.84 9.88V7.04H2.17C1.42 8.53 1 10.22 1 12C1 13.78 1.42 15.47 2.17 16.96L5.84 14.12Z" fill="#FBBC05"></path>
            <path d="M12 5.38C13.62 5.38 15.06 5.94 16.2 7.02L19.35 3.87C17.46 2.1 14.97 1 12 1C7.69 1 3.98 3.45 2.17 7.04L5.84 9.88C6.7 7.3 9.14 5.38 12 5.38Z" fill="#EA4335"></path>
          </svg>
          <span class="font-label-md text-label-md">Lanjutkan dengan Google</span>
        </button>

        <p class="font-body-md text-body-md text-center text-on-surface-variant">
          Sudah punya akun? <router-link class="text-primary-container font-bold hover:underline" to="/login">Masuk di sini</router-link>
        </p>
      </div>

    </main>

  </div>
</template>
