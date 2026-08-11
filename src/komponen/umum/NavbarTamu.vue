<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { useAuth } from '../../komposabel/useAuth';
import { Bus, LogIn, Menu, X, Bell, User } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const { isAuthenticated, userProfile } = useAuth();
const menuTerbuka = ref(false);
const adaNotifikasi = ref(true); // Mock notifikasi aktif untuk demo UI

const toggleMenu = () => {
  menuTerbuka.value = !menuTerbuka.value;
};

const navigasiKe = (path: string) => {
  router.push(path);
  menuTerbuka.value = false;
};

// Satu menu yang label & tujuannya mengikuti status langganan sebenarnya --
// BUKAN sekadar "sudah login atau belum" -- supaya pengguna baru yang belum
// pernah menuntaskan wizard tidak pernah dilempar ke Panel Pengguna:
// - Belum pernah berlangganan (pernahBerlangganan = false, termasuk yang
//   sedang di tengah wizard/belum bayar sama sekali) -> "Berlangganan", ke
//   /berlangganan yang otomatis melanjutkan dari tahap terakhir wizard.
// - Pernah berlangganan tapi sedang tidak aktif (kedaluwarsa/menunggak)
//   -> "Pembayaran", langsung ke tab Pembayaran di Panel Pengguna supaya bisa
//   mengaktifkan kembali layanan (bukan ke wizard, akun ini sudah pernah
//   menyelesaikan pendaftaran anak).
// - Sedang aktif berlangganan -> "Monitoring", ke Dashboard (tab default)
//   supaya pengguna sendiri yang memilih fitur monitoring dari sana --
//   BUKAN langsung dilempar ke tab Pantau Anak.
const sudahAktifBerlangganan = computed(() => authStore.sudahLogin && authStore.sudahBerlangganan);
const pernahBerlangganan = computed(() => authStore.sudahLogin && authStore.pernahBerlangganan);
const labelMenuLangganan = computed(() => {
  if (sudahAktifBerlangganan.value) return 'Monitoring';
  if (pernahBerlangganan.value) return 'Pembayaran';
  return 'Berlangganan';
});

const bukaMenuLangganan = () => {
  if (sudahAktifBerlangganan.value) {
    router.push('/orangtua');
  } else if (pernahBerlangganan.value) {
    router.push({ path: '/orangtua', query: { tab: 'pembayaran' } });
  } else {
    router.push('/berlangganan');
  }
  menuTerbuka.value = false;
};

const namaPengguna = computed(() => {
  return userProfile.value?.nama || 
         authStore.pengguna?.user_metadata?.nama_lengkap || 
         authStore.pengguna?.nama_lengkap || 
         authStore.pengguna?.email?.split('@')[0] || 
         'Pengguna';
});
</script>

<template>
  <nav class="bg-warnaSekunder/90 backdrop-blur-md border-b border-warnaAksen/30 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center cursor-pointer" @click="navigasiKe('/')">
          <Bus class="h-8 w-8 text-warnaTombol mr-2 animate-pulse" />
          <span class="text-xl font-extrabold text-white tracking-wider">
            Denanta<span class="text-warnaTombol">TS</span>
          </span>
        </div>

        <!-- Desktop Menu -->
        <div class="hidden md:flex items-center space-x-6">
          <router-link to="/" class="text-slate-300 hover:text-white text-sm font-medium transition-colors" active-class="text-warnaTombol font-semibold">Beranda</router-link>
          <router-link to="/tentang" class="text-slate-300 hover:text-white text-sm font-medium transition-colors" active-class="text-warnaTombol font-semibold">Tentang</router-link>
          <button
            type="button"
            @click="bukaMenuLangganan"
            class="text-slate-300 hover:text-white text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer"
          >
            {{ labelMenuLangganan }}
          </button>

          <!-- Notifikasi Icon -- hanya untuk akun yang SEDANG AKTIF
               berlangganan (sudahAktifBerlangganan), karena akun yang belum
               pernah/tidak lagi berlangganan tidak punya apa pun untuk
               dipantau/dinotifikasikan. -->
          <div v-if="sudahAktifBerlangganan" class="relative cursor-pointer text-slate-400 hover:text-white transition-colors mr-2">
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warnaTombol border border-warnaSekunder"></span>
          </div>

          <!-- Kondisi LOADING AUTH -->
          <div v-if="authStore.sedangMemuat" class="flex items-center">
            <div class="w-20 h-8 bg-slate-700/50 animate-pulse rounded-lg flex items-center justify-center">
              <span class="text-[10px] text-slate-400">Memuat...</span>
            </div>
          </div>

          <!-- Kondisi BELUM LOGIN -->
          <div v-else-if="!isAuthenticated" class="flex items-center">
            <router-link 
              to="/register" 
              class="bg-warnaTombol hover:bg-opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Daftar
            </router-link>
          </div>

          <!-- Kondisi SUDAH LOGIN -->
          <div v-else class="flex items-center">
            <router-link 
              to="/profile/edit" 
              class="flex items-center gap-2 bg-warnaAksen hover:bg-opacity-95 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg font-medium text-sm transition-all border border-solid border-warnaAksen"
              :title="'Ubah Profil ' + namaPengguna"
            >
              <img 
                v-if="userProfile?.foto_profil" 
                :src="userProfile.foto_profil" 
                alt="Avatar" 
                class="w-5 h-5 rounded-full object-cover" 
              />
              <User v-else class="w-4 h-4 text-warnaTombol" />
              <span>{{ namaPengguna }}</span>
            </router-link>
          </div>
        </div>

        <!-- Mobile Toggle -->
        <div class="flex md:hidden">
          <button @click="toggleMenu" class="text-slate-400 hover:text-white p-2 rounded-md cursor-pointer">
            <Menu v-if="!menuTerbuka" class="w-6 h-6" />
            <X v-else class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-show="menuTerbuka" class="md:hidden bg-warnaSekunder border-b border-warnaAksen/30 py-3 px-4 space-y-3">
      <router-link to="/" @click="menuTerbuka = false" class="block text-slate-300 hover:text-white text-base font-medium">Beranda</router-link>
      <router-link to="/tentang" @click="menuTerbuka = false" class="block text-slate-300 hover:text-white text-base font-medium">Tentang</router-link>
      <button
        type="button"
        @click="bukaMenuLangganan"
        class="block w-full text-left text-slate-300 hover:text-white text-base font-medium bg-transparent border-0 cursor-pointer"
      >
        {{ labelMenuLangganan }}
      </button>

      <!-- Kondisi LOADING AUTH -->
      <div v-if="authStore.sedangMemuat" class="pt-2 border-t border-warnaAksen/20">
        <div class="w-full bg-warnaAksen/30 text-slate-400 py-2 rounded-lg text-center text-xs animate-pulse font-medium">
          Memuat sesi...
        </div>
      </div>

      <!-- Kondisi SUDAH LOGIN -->
      <div v-else-if="isAuthenticated" class="pt-2 border-t border-warnaAksen/20">
        <router-link
          to="/profile/edit"
          @click="menuTerbuka = false"
          class="w-full bg-warnaAksen hover:bg-opacity-90 text-white py-2 rounded-lg text-center font-semibold flex items-center justify-center gap-2"
        >
          <User class="w-4 h-4 text-warnaTombol" />
          Edit Profil
        </router-link>
      </div>

      <!-- Kondisi BELUM LOGIN -->
      <div v-else class="pt-2 border-t border-warnaAksen/20 space-y-2">
        <router-link
          to="/login"
          @click="menuTerbuka = false"
          class="w-full text-slate-300 hover:text-white py-2 rounded-lg text-center font-semibold flex items-center justify-center gap-1.5"
        >
          <LogIn class="w-4 h-4" />
          Masuk
        </router-link>
        <router-link
          to="/register"
          @click="menuTerbuka = false"
          class="w-full bg-warnaTombol hover:bg-opacity-90 text-white py-2 rounded-lg text-center font-semibold block"
        >
          Daftar
        </router-link>
      </div>
    </div>
  </nav>
</template>
