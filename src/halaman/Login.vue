<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { useAuth } from '../komposabel/useAuth';
import { supabase } from '../layanan/supabase';
import { 
  KeyRound, Mail, AlertTriangle, Loader2,
  Eye, EyeOff, Key, ArrowLeft, CheckCircle 
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const auth = useAuth();

// Form Mode: 'login' | 'lupaSandi'
const mode = ref<'login' | 'lupaSandi'>('login');

// Login State
const email = ref('');
const kataSandi = ref('');
const tunjukkanSandi = ref(false);

// Reset Password State
const emailReset = ref('');

const errorPesan = ref<string | null>(null);
const suksesPesan = ref<string | null>(null);
const sedangLoading = ref(false);

const tanganiLogin = async () => {
  if (!email.value || !kataSandi.value) {
    errorPesan.value = 'Silakan isi email dan kata sandi Anda';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    await authStore.login(email.value, kataSandi.value);
    if (authStore.apakahAdmin) {
      router.push('/admin');
    } else if (authStore.apakahSupir) {
      router.push('/supir');
    } else if (authStore.apakahOrangTua) {
      // Landing page setelah login harus Dashboard Panel Pengguna, bukan
      // halaman publik '/' -- guard router (rute/index.ts) otomatis
      // mengalihkan ke /berlangganan dulu kalau akun belum punya langganan
      // aktif, jadi push ke /orangtua ini sudah benar utk kedua kondisi.
      router.push('/orangtua');
    } else {
      router.push('/');
    }
  } catch (err: any) {
    errorPesan.value = err.message || 'Surel atau kata sandi Anda salah';
  } finally {
    sedangLoading.value = false;
  }
};

const tanganiResetSandi = async () => {
  if (!emailReset.value) {
    errorPesan.value = 'Silakan isi email Anda terlebih dahulu';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;
  suksesPesan.value = null;

  try {
    const client = supabase;
    if (client) {
      await auth.aturUlangKataSandi(emailReset.value);
    } else {
      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    suksesPesan.value = 'Tautan reset kata sandi telah dikirimkan ke email Anda!';
    emailReset.value = '';
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal mengirim email reset kata sandi';
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
      // Mock login
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

const ubahMode = (tujuanMode: 'login' | 'lupaSandi') => {
  mode.value = tujuanMode;
  errorPesan.value = null;
  suksesPesan.value = null;
};
</script>

<template>
  <div class="bg-pattern-radial min-h-screen text-on-surface font-body-md antialiased relative flex flex-col items-center justify-center p-6 md:p-8">
    
    <!-- Background Gradient Pattern (Frame Style) -->
    <div class="fixed top-0 left-0 w-full h-full z-0 pointer-events-none bg-pattern-radial-gradient"></div>

    <main class="relative z-10 w-full max-w-[400px]">
      
      <!-- MODE 1: Login Form (Default & Error State) -->
      <div v-if="mode === 'login'" class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden text-left">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Menghubungkan Sesi...</p>
          </div>
        </div>

        <!-- Logo Header -->
        <div class="flex flex-col gap-2">
          <h1 class="font-headline-md text-headline-md text-on-surface">Selamat Datang Kembali</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">Masuk untuk memantau perjalanan anak kamu</p>
        </div>

        <!-- Alert Error Banner (Frame 2 style) -->
        <div v-if="errorPesan" class="bg-[#FCEBEB] text-[#E24B4A] p-3.5 rounded-[12px] border border-solid border-[#F8C6C6] flex items-start gap-2.5 font-body-md text-body-md">
          <AlertTriangle class="w-5 h-5 text-[#E24B4A] flex-shrink-0 mt-0.5" />
          <p class="leading-normal">{{ errorPesan }}</p>
        </div>

        <!-- Form Login -->
        <form class="flex flex-col gap-4" @submit.prevent="tanganiLogin">
          
          <!-- Email Input -->
          <div class="flex flex-col gap-2">
            <label class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Email</label>
            <div class="relative">
              <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5" :class="errorPesan ? 'text-[#E24B4A]' : 'text-slate-500'" />
              <input 
                v-model="email"
                required
                class="w-full bg-surface-bright border border-solid rounded-[12px] py-3 pl-11 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 transition-all" 
                :class="errorPesan ? 'border-[#E24B4A] bg-[#FDF4F4] focus:border-[#E24B4A] focus:ring-[#E24B4A]/10' : 'border-outline-variant focus:border-primary-container focus:ring-primary-container/10'"
                placeholder="Contoh: budi@email.com" 
                type="email"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div class="flex flex-col gap-2">
            <label class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Password</label>
            <div class="relative">
              <KeyRound class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5" :class="errorPesan ? 'text-[#E24B4A]' : 'text-slate-500'" />
              <input 
                v-model="kataSandi"
                required
                :type="tunjukkanSandi ? 'text' : 'password'"
                class="w-full bg-surface-bright border border-solid rounded-[12px] py-3 pl-11 pr-11 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 transition-all" 
                :class="errorPesan ? 'border-[#E24B4A] bg-[#FDF4F4] focus:border-[#E24B4A] focus:ring-[#E24B4A]/10' : 'border-outline-variant focus:border-primary-container focus:ring-primary-container/10'"
                placeholder="Masukkan password kamu"
              />
              <button 
                type="button" 
                class="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors bg-transparent border-0 cursor-pointer p-0"
                :class="errorPesan ? 'text-[#E24B4A] hover:text-[#E24B4A]/80' : 'text-outline hover:text-on-surface'"
                @click="tunjukkanSandi = !tunjukkanSandi"
              >
                <EyeOff v-if="tunjukkanSandi" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Forgot Password Link -->
          <div class="flex justify-end">
            <a 
              class="font-label-md text-label-md text-primary-container hover:text-primary transition-colors cursor-pointer"
              @click="ubahMode('lupaSandi')"
            >
              Lupa Password?
            </a>
          </div>

          <button 
            type="submit" 
            class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors mt-2 cursor-pointer border-0 shadow-sm"
          >
            Masuk
          </button>
        </form>

        <div class="flex items-center gap-4 my-1">
          <div class="flex-1 h-px bg-outline-variant opacity-50"></div>
          <span class="font-body-md text-body-md text-outline">atau</span>
          <div class="flex-1 h-px bg-outline-variant opacity-50"></div>
        </div>

        <!-- Google OAuth Button -->
        <button 
          type="button" 
          @click="loginDenganGoogle"
          class="w-full bg-surface-container-lowest border border-solid border-outline-variant hover:bg-surface-container-low text-on-surface rounded-[12px] py-3 flex items-center justify-center gap-3 transition-colors cursor-pointer font-semibold"
        >
          <svg class="w-5 h-5" fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.8 15.72 17.58V20.35H19.28C21.36 18.43 22.56 15.61 22.56 12.25Z" fill="#4285F4"></path>
            <path d="M12 23C14.97 23 17.46 22.02 19.28 20.35L15.72 17.58C14.74 18.24 13.48 18.64 12 18.64C9.13 18.64 6.7 16.71 5.84 14.11H2.17V16.96C3.98 20.57 7.69 23 12 23Z" fill="#34A853"></path>
            <path d="M5.84 14.11C5.62 13.46 5.5 12.75 5.5 12C5.5 11.25 5.62 10.54 5.84 9.89V7.04H2.17C1.43 8.52 1 10.2 1 12C1 13.8 1.43 15.48 2.17 16.96L5.84 14.11Z" fill="#FBBC05"></path>
            <path d="M12 5.36C13.62 5.36 15.07 5.92 16.21 7.01L19.36 3.86C17.45 2.08 14.96 1 12 1C7.69 1 3.98 3.43 2.17 7.04L5.84 9.89C6.7 7.29 9.13 5.36 12 5.36Z" fill="#EA4335"></path>
          </svg>
          <span class="font-body-md text-body-md">Masuk dengan Google</span>
        </button>

        <p class="font-body-md text-body-md text-center text-on-surface-variant">
          Belum punya akun? <router-link class="text-primary-container font-semibold hover:text-primary transition-colors hover:underline" to="/register">Daftar di sini</router-link>
        </p>
      </div>

      <!-- MODE 2: Forgot Password Form -->
      <div v-else class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden text-left">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Mengirim Tautan...</p>
          </div>
        </div>

        <!-- Success/Reset confirmation inner overlay -->
        <div v-if="suksesPesan" class="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 z-30 text-center gap-4">
          <div class="inline-flex items-center justify-center p-4 bg-emerald-100 text-emerald-600 rounded-full border border-solid border-emerald-300">
            <CheckCircle class="w-12 h-12" />
          </div>
          <h3 class="text-xl font-bold text-on-surface">Tautan Terkirim!</h3>
          <p class="text-sm text-slate-500 max-w-xs leading-relaxed">
            {{ suksesPesan }}
          </p>
          <button 
            type="button" 
            class="bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-2.5 px-6 font-semibold text-sm transition-all border-0 shadow-sm cursor-pointer mt-2"
            @click="ubahMode('login')"
          >
            Kembali ke Masuk
          </button>
        </div>

        <div class="flex flex-col items-center text-center gap-4">
          <!-- Lock Icon Container -->
          <div class="w-16 h-16 bg-[#e6f7f4] rounded-full flex items-center justify-center text-primary-container mb-2">
            <Key class="w-8 h-8 text-primary-container" />
          </div>
          <h1 class="font-headline-md text-headline-md text-on-surface">Lupa Password?</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Masukkan email terdaftar, kami akan mengirimkan tautan untuk reset password
          </p>
        </div>

        <!-- Alert Error inside Reset -->
        <div v-if="errorPesan" class="bg-[#FCEBEB] text-[#E24B4A] p-3.5 rounded-[12px] border border-solid border-[#F8C6C6] flex items-start gap-2.5 font-body-md text-body-md">
          <AlertTriangle class="w-5 h-5 text-[#E24B4A] flex-shrink-0 mt-0.5" />
          <p class="leading-normal">{{ errorPesan }}</p>
        </div>

        <form class="flex flex-col gap-6" @submit.prevent="tanganiResetSandi">
          
          <!-- Email input for reset -->
          <div class="flex flex-col gap-2">
            <label class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Email</label>
            <div class="relative">
              <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                v-model="emailReset"
                required
                class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[12px] py-3 pl-11 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors" 
                placeholder="Contoh: budi@email.com" 
                type="email"
              />
            </div>
          </div>

          <button 
            type="submit" 
            class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors cursor-pointer border-0 shadow-sm"
          >
            Kirim Tautan Reset
          </button>
        </form>

        <div class="flex justify-center mt-2">
          <a 
            class="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant hover:text-primary-container transition-colors cursor-pointer"
            @click="ubahMode('login')"
          >
            <ArrowLeft class="w-4 h-4" />
            <span>Kembali ke Masuk</span>
          </a>
        </div>
      </div>

    </main>

  </div>
</template>

<style scoped>
/* Latar belakang radial tosca khas login flow */
.bg-pattern-radial-gradient {
  background-color: #F5FBFA;
  background-image: 
    radial-gradient(circle at 15% 20%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%),
    radial-gradient(circle at 85% 80%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%);
}
</style>
