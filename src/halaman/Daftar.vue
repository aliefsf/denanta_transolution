<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../komposabel/useAuth';
import { 
  Bus, Mail, KeyRound, User, Phone, CheckCircle, 
  AlertTriangle, Loader2, Users, ShieldAlert 
} from 'lucide-vue-next';
import TombolUtama from '../komponen/umum/TombolUtama.vue';

const auth = useAuth();

const namaLengkap = ref('');
const email = ref('');
const nomorTelepon = ref('');
const peran = ref<'orangtua' | 'supir'>('orangtua');
const kataSandi = ref('');
const konfirmasiSandi = ref('');

const errorPesan = ref<string | null>(null);
const suksesDaftar = ref(false);
const sedangLoading = ref(false);

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
</script>

<template>
  <div class="min-h-screen bg-warnaUtama flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="inline-flex items-center justify-center p-3 bg-warnaSekunder rounded-2xl border border-warnaAksen/30 shadow-lg">
        <Bus class="h-10 w-10 text-warnaTombol" />
      </div>
      <h2 class="mt-6 text-3xl font-extrabold text-white tracking-tight">
        Registrasi Akun Baru
      </h2>
      <p class="mt-2 text-sm text-slate-400">
        Bergabung dengan portal armada sekolah terpadu Denanta TS
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Success State -->
      <div v-if="suksesDaftar" class="bg-warnaSekunder border border-emerald-500/30 p-8 shadow-2xl rounded-2xl text-center space-y-4">
        <div class="inline-flex items-center justify-center p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          <CheckCircle class="w-12 h-12" />
        </div>
        <h3 class="text-xl font-bold text-white">Registrasi Berhasil!</h3>
        <p class="text-sm text-slate-400 leading-relaxed">
          Tautan verifikasi email telah dikirimkan ke <strong class="text-slate-200">{{ email }}</strong>. Silakan periksa kotak masuk/spam email Anda untuk melakukan konfirmasi sebelum masuk.
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
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-warnaTombol animate-spin mx-auto" />
            <p class="text-xs text-slate-300">Memproses Pendaftaran...</p>
          </div>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="mb-4 bg-red-900/30 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-red-300">{{ errorPesan }}</div>
        </div>

        <form class="space-y-4" @submit.prevent="tanganiDaftar">
          <!-- Role Selector -->
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Daftar Sebagai
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="peran = 'orangtua'"
                class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
                :class="peran === 'orangtua' ? 'bg-warnaTombol border-warnaTombol text-white' : 'bg-warnaUtama border-warnaAksen/30 text-slate-400 hover:text-white'"
              >
                <Users class="w-4 h-4" />
                Orang Tua
              </button>
              <button
                type="button"
                @click="peran = 'supir'"
                class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
                :class="peran === 'supir' ? 'bg-warnaTombol border-warnaTombol text-white' : 'bg-warnaUtama border-warnaAksen/30 text-slate-400 hover:text-white'"
              >
                <ShieldAlert class="w-4 h-4" />
                Supir / Driver
              </button>
            </div>
          </div>

          <!-- Full Name -->
          <div>
            <label for="namaLengkap" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Nama Lengkap
            </label>
            <div class="mt-1.5 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User class="w-4 h-4" />
              </div>
              <input
                id="namaLengkap"
                type="text"
                required
                v-model="namaLengkap"
                placeholder="Rafi Alief"
                class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Alamat Surel (Email)
            </label>
            <div class="mt-1.5 relative">
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

          <!-- Phone Number -->
          <div>
            <label for="nomorTelepon" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Nomor Telepon / WhatsApp
            </label>
            <div class="mt-1.5 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone class="w-4 h-4" />
              </div>
              <input
                id="nomorTelepon"
                type="tel"
                v-model="nomorTelepon"
                placeholder="0812XXXXXXXX"
                class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Kata Sandi
            </label>
            <div class="mt-1.5 relative">
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

          <!-- Confirm Password -->
          <div>
            <label for="konfirmasiSandi" class="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Konfirmasi Kata Sandi
            </label>
            <div class="mt-1.5 relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound class="w-4 h-4" />
              </div>
              <input
                id="konfirmasiSandi"
                type="password"
                required
                v-model="konfirmasiSandi"
                placeholder="••••••••"
                class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div class="pt-2">
            <TombolUtama varian="utama" tipe="submit" class="w-full py-2.5 text-sm font-bold">
              Buat Akun Sekarang
            </TombolUtama>
          </div>
        </form>

        <div class="mt-6 text-center text-sm">
          <span class="text-slate-400">Sudah memiliki akun? </span>
          <router-link to="/login" class="font-bold text-warnaTombol hover:underline">
            Masuk Sesi
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
