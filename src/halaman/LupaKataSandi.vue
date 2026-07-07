<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../komposabel/useAuth';
import { Bus, Mail, AlertTriangle, CheckCircle, Loader2 } from 'lucide-vue-next';
import TombolUtama from '../komponen/umum/TombolUtama.vue';

const auth = useAuth();

const email = ref('');
const errorPesan = ref<string | null>(null);
const suksesKirim = ref(false);
const sedangLoading = ref(false);

const tanganiReset = async () => {
  if (!email.value) {
    errorPesan.value = 'Silakan isi email Anda terlebih dahulu';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    await auth.aturUlangKataSandi(email.value);
    suksesKirim.value = true;
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal mengirim email reset kata sandi';
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
        Lupa Kata Sandi?
      </h2>
      <p class="mt-2 text-sm text-slate-400">
        Masukkan email Anda untuk menerima tautan pemulihan kata sandi
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Success State -->
      <div v-if="suksesKirim" class="bg-warnaSekunder border border-emerald-500/30 p-8 shadow-2xl rounded-2xl text-center space-y-4">
        <div class="inline-flex items-center justify-center p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          <CheckCircle class="w-12 h-12" />
        </div>
        <h3 class="text-xl font-bold text-white">Email Reset Terkirim!</h3>
        <p class="text-sm text-slate-400 leading-relaxed">
          Tautan pemulihan kata sandi telah dikirim ke <strong class="text-slate-200">{{ email }}</strong>. Silakan cek kotak masuk atau spam email Anda.
        </p>
        <div class="pt-4">
          <router-link to="/login">
            <TombolUtama varian="utama" class="w-full">
              Kembali ke Login
            </TombolUtama>
          </router-link>
        </div>
      </div>

      <!-- Form State -->
      <div v-else class="bg-warnaSekunder border border-warnaAksen/30 py-8 px-4 shadow-2xl rounded-2xl sm:px-10 relative overflow-hidden">
        
        <!-- Loading overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-warnaTombol animate-spin mx-auto" />
            <p class="text-xs text-slate-300">Mengirim tautan reset...</p>
          </div>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="mb-4 bg-red-900/30 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-red-300">{{ errorPesan }}</div>
        </div>

        <form class="space-y-6" @submit.prevent="tanganiReset">
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

          <!-- Submit Button -->
          <div>
            <TombolUtama varian="utama" tipe="submit" class="w-full py-2.5 text-sm font-bold">
              Kirim Link Pemulihan
            </TombolUtama>
          </div>
        </form>

        <div class="mt-6 text-center text-sm">
          <router-link to="/login" class="font-bold text-slate-400 hover:text-white hover:underline">
            Kembali ke Login
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
