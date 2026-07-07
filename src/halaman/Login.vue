<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { Bus, KeyRound, Mail, AlertTriangle, Loader2 } from 'lucide-vue-next';
import TombolUtama from '../komponen/umum/TombolUtama.vue';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const kataSandi = ref('');
const errorPesan = ref<string | null>(null);
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
    
    // Arahkan pengguna ke portal masing-masing setelah login sukses
    if (authStore.apakahAdmin) {
      router.push('/admin');
    } else if (authStore.apakahSupir) {
      router.push('/supir');
    } else if (authStore.apakahOrangTua) {
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
</script>

<template>
  <div class="min-h-screen bg-warnaUtama flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="inline-flex items-center justify-center p-3 bg-warnaSekunder rounded-2xl border border-warnaAksen/30 shadow-lg">
        <Bus class="h-10 w-10 text-warnaTombol" />
      </div>
      <h2 class="mt-6 text-3xl font-extrabold text-white tracking-tight">
        Masuk ke Denanta<span class="text-warnaTombol">TS</span>
      </h2>
      <p class="mt-2 text-sm text-slate-400">
        Kelola transportasi penjemputan anak sekolah dalam satu genggaman
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-warnaSekunder border border-warnaAksen/30 py-8 px-4 shadow-2xl rounded-2xl sm:px-10 relative overflow-hidden">
        
        <!-- Loading overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-warnaTombol animate-spin mx-auto" />
            <p class="text-xs text-slate-300">Menghubungkan Sesi...</p>
          </div>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="mb-4 bg-red-900/30 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-red-300">{{ errorPesan }}</div>
        </div>

        <form class="space-y-6" @submit.prevent="tanganiLogin">
          <!-- Email Field -->
          <div>
            <label for="email" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Alamat Surel (Email)
            </label>
            <div class="mt-2 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail class="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                v-model="email"
                placeholder="nama@email.com"
                class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <!-- Password Field -->
          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Kata Sandi
              </label>
              <div class="text-xs">
                <router-link to="/lupa-kata-sandi" class="font-semibold text-warnaTombol hover:underline">
                  Lupa kata sandi?
                </router-link>
              </div>
            </div>
            <div class="mt-2 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound class="w-4 h-4" />
              </div>
              <input
                id="password"
                type="password"
                required
                v-model="kataSandi"
                placeholder="••••••••"
                class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <div>
            <TombolUtama varian="utama" tipe="submit" class="w-full py-2.5 text-sm font-bold">
              Masuk Sesi
            </TombolUtama>
          </div>
        </form>

        <div class="mt-6 text-center text-sm">
          <span class="text-slate-400">Belum punya akun? </span>
          <router-link to="/daftar" class="font-bold text-warnaTombol hover:underline">
            Daftar Sekarang
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
