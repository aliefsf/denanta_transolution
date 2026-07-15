<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../komposabel/useAuth';
import { useAuthStore } from '../penyimpanan/authStore';
import { supabase } from '../layanan/supabase';
import { 
  Bus, Mail, KeyRound, User, Phone, CheckCircle, 
  AlertTriangle, Loader2, Users, ShieldAlert,
  Eye, EyeOff, MailCheck, ChevronLeft
} from 'lucide-vue-next';

const router = useRouter();
const auth = useAuth();
const authStore = useAuthStore();

const namaLengkap = ref('');
const email = ref('');
const nomorTelepon = ref('');
const peran = ref<'orangtua' | 'supir'>('orangtua');
const kataSandi = ref('');
const konfirmasiSandi = ref('');

const errorPesan = ref<string | null>(null);
const suksesDaftar = ref(false);
const sedangLoading = ref(false);

const tunjukkanSandi = ref(false);
const tunjukkanKonfirmasiSandi = ref(false);

// OTP Verification State
const otpInputs = ref<any[]>([]);
const otpCodes = ref<string[]>(['', '', '', '', '', '']);
const verifikasiSukses = ref(false);

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
      suksesDaftar.value = true;
      return;
    }

    await auth.daftar(
      email.value,
      kataSandi.value,
      namaLengkap.value,
      peran.value,
      nomorTelepon.value
    );
    suksesDaftar.value = true;
  } catch (err: any) {
    errorPesan.value = err.message || 'Terjadi kesalahan saat mendaftar';
  } finally {
    sedangLoading.value = false;
  }
};

const tanganiOtpInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  otpCodes.value[index] = value;
  
  if (value.length === 1 && index < 5) {
    // Pindah fokus ke input berikutnya
    otpInputs.value[index + 1]?.focus();
  }
};

const tanganiOtpKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && otpCodes.value[index] === '' && index > 0) {
    // Hapus dan pindah fokus ke input sebelumnya
    otpInputs.value[index - 1]?.focus();
  }
};

const tanganiVerifikasiOtp = async () => {
  const token = otpCodes.value.join('');
  if (token.length < 6) {
    errorPesan.value = 'Silakan masukkan 6 digit kode OTP';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    const client = supabase;
    if (client && email.value) {
      const { error: errVerify } = await client.auth.verifyOtp({
        email: email.value,
        token: token,
        type: 'signup'
      });
      if (errVerify) throw errVerify;
    } else {
      // Simulasi Mock lokal
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    
    verifikasiSukses.value = true;
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  } catch (err: any) {
    errorPesan.value = err.message || 'Kode verifikasi OTP salah atau kedaluwarsa';
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
      router.push('/orangtua');
    }
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal masuk dengan Google';
  } finally {
    sedangLoading.value = false;
  }
};

const kirimUlangOtp = () => {
  errorPesan.value = null;
  otpCodes.value = ['', '', '', '', '', ''];
  alert('Kode verifikasi baru telah dikirimkan ke email Anda.');
};

// Masking email helper
const sensorEmail = (val: string) => {
  if (!val) return 'user@example.com';
  const split = val.split('@');
  if (split.length < 2) return val;
  const name = split[0];
  const domain = split[1];
  if (name.length <= 3) {
    return `${name.substring(0, 1)}***@${domain}`;
  }
  return `${name.substring(0, 3)}***@${domain}`;
};
</script>

<template>
  <div class="bg-pattern min-h-screen text-on-surface font-body-md antialiased overflow-x-hidden relative flex flex-col items-center justify-center py-12 px-margin-mobile md:px-margin-desktop">
    
    <!-- Background Accents -->
    <div class="fixed top-0 left-0 w-64 h-64 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-[0.05] -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"></div>
    <div class="fixed bottom-0 right-0 w-96 h-96 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-[0.05] translate-x-1/4 translate-y-1/4 z-0 pointer-events-none"></div>

    <main class="relative z-10 w-full max-w-md mx-auto">
      
      <!-- STEP 1: Buat Akun (Form Pendaftaran) -->
      <div v-if="!suksesDaftar" class="bg-surface-container-lowest rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col relative overflow-hidden text-left">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Memproses Pendaftaran...</p>
          </div>
        </div>

        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-1.5 mb-6 text-on-surface hover:text-primary transition-colors inline-flex w-fit">
          <Bus class="h-6 w-6 text-primary-container" />
          <span class="font-title-lg text-title-lg font-bold">Denanta</span>
        </router-link>

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
          <!-- Role Selection (Required by DB) -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Daftar Sebagai
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="peran = 'orangtua'"
                class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-solid transition-all cursor-pointer"
                :class="peran === 'orangtua' ? 'bg-primary-container border-primary-container text-white' : 'bg-surface-bright border-outline-variant text-on-surface-variant hover:text-primary-container'"
              >
                <Users class="w-4 h-4" />
                Orang Tua
              </button>
              <button
                type="button"
                @click="peran = 'supir'"
                class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-solid transition-all cursor-pointer"
                :class="peran === 'supir' ? 'bg-primary-container border-primary-container text-white' : 'bg-surface-bright border-outline-variant text-on-surface-variant hover:text-primary-container'"
              >
                <ShieldAlert class="w-4 h-4" />
                Supir / Driver
              </button>
            </div>
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
              placeholder="Nomor Telepon / WhatsApp" 
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

      <!-- STEP 2: Verifikasi Email (Kode OTP) -->
      <div v-else class="bg-surface-container-lowest rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Memverifikasi OTP...</p>
          </div>
        </div>

        <!-- Success Alert Inner -->
        <div v-if="verifikasiSukses" class="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 z-30 text-center gap-4">
          <div class="inline-flex items-center justify-center p-4 bg-emerald-100 text-emerald-600 rounded-full border border-solid border-emerald-300">
            <CheckCircle class="w-12 h-12" />
          </div>
          <h3 class="text-xl font-bold text-on-surface">Verifikasi Berhasil!</h3>
          <p class="text-sm text-slate-500 max-w-xs leading-relaxed">
            Email Anda telah berhasil diverifikasi. Mengalihkan Anda ke halaman login...
          </p>
        </div>

        <button 
          type="button"
          class="absolute left-4 top-4 text-on-surface-variant hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-2 flex items-center gap-1 text-xs"
          @click="suksesDaftar = false"
        >
          <ChevronLeft class="w-4 h-4" />
          Kembali
        </button>

        <div class="w-16 h-16 bg-secondary-fixed rounded-full flex items-center justify-center mb-6 text-primary-container mt-6">
          <MailCheck class="w-8 h-8" />
        </div>

        <div class="mb-6 w-full">
          <h2 class="font-headline-md text-headline-md text-on-surface mb-2">Verifikasi Email Kamu</h2>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Kami telah mengirimkan kode OTP ke email<br/>
            <strong class="text-on-surface font-semibold">{{ sensorEmail(email) }}</strong>
          </p>
        </div>

        <!-- Alert Error inside OTP -->
        <div v-if="errorPesan" class="mb-4 bg-error-container/20 border border-solid border-error p-3.5 rounded-xl flex items-start gap-2.5 w-full text-left">
          <AlertTriangle class="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <div class="text-xs text-error leading-normal">{{ errorPesan }}</div>
        </div>

        <div class="flex gap-2 justify-center mb-6 w-full">
          <input 
            v-for="(_, index) in otpCodes" 
            :key="index"
            :ref="(el: any) => { if (el) otpInputs[index] = el }"
            v-model="otpCodes[index]"
            maxlength="1" 
            type="text"
            class="w-12 h-14 bg-surface-bright border border-solid rounded-[10px] text-center font-headline-md text-headline-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container transition-colors"
            :class="otpCodes[index] !== '' ? 'border-primary-container ring-1 ring-primary-container' : 'border-outline-variant'"
            @input="tanganiOtpInput(index, $event)"
            @keydown="tanganiOtpKeydown(index, $event)"
          />
        </div>

        <button 
          type="button"
          class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-label-md text-label-md transition-colors mb-6 cursor-pointer border-0 shadow-sm"
          @click="tanganiVerifikasiOtp"
        >
          Verifikasi
        </button>

        <p class="font-body-md text-body-md text-outline">
          Belum menerima kode?<br/>
          <a class="text-primary-container font-semibold hover:underline mt-1 inline-block cursor-pointer" @click="kirimUlangOtp">Kirim Ulang Kode</a>
        </p>
      </div>

    </main>

  </div>
</template>
