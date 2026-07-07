<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { Bus, LogIn, Menu, X, LayoutDashboard, Bell } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const menuTerbuka = ref(false);
const adaNotifikasi = ref(true); // Mock notifikasi aktif untuk demo UI

const toggleMenu = () => {
  menuTerbuka.value = !menuTerbuka.value;
};

const navigasiKe = (path: string) => {
  router.push(path);
  menuTerbuka.value = false;
};

const getDashboardPath = () => {
  if (authStore.apakahAdmin) return '/admin';
  if (authStore.apakahSupir) return '/supir';
  if (authStore.apakahOrangTua) return '/orangtua';
  return '/';
};
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
          <router-link to="/berlangganan" class="text-slate-300 hover:text-white text-sm font-medium transition-colors" active-class="text-warnaTombol font-semibold">Berlangganan</router-link>
          
          <!-- Notifikasi Icon -->
          <div v-if="authStore.sudahLogin" class="relative cursor-pointer text-slate-400 hover:text-white transition-colors">
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warnaTombol border border-warnaSekunder"></span>
          </div>

          <div v-if="authStore.sudahLogin" class="flex items-center space-x-4">
            <router-link
              :to="getDashboardPath()"
              class="bg-warnaAksen hover:bg-opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5"
            >
              <LayoutDashboard class="w-4 h-4" />
              Dashboard
            </router-link>
          </div>
          <div v-else class="flex items-center space-x-4">
            <router-link to="/login" class="text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1">
              <LogIn class="w-4 h-4" />
              Masuk
            </router-link>
            <router-link
              to="/berlangganan"
              class="bg-warnaTombol hover:bg-opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Mulai Berlangganan
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
      <router-link to="/berlangganan" @click="menuTerbuka = false" class="block text-slate-300 hover:text-white text-base font-medium">Berlangganan</router-link>
      
      <div v-if="authStore.sudahLogin" class="pt-2 border-t border-warnaAksen/20">
        <router-link
          :to="getDashboardPath()"
          @click="menuTerbuka = false"
          class="w-full bg-warnaAksen hover:bg-opacity-90 text-white py-2 rounded-lg text-center font-semibold flex items-center justify-center gap-2"
        >
          <LayoutDashboard class="w-4 h-4" />
          Dashboard
        </router-link>
      </div>
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
          to="/berlangganan"
          @click="menuTerbuka = false"
          class="w-full bg-warnaTombol hover:bg-opacity-90 text-white py-2 rounded-lg text-center font-semibold block"
        >
          Mulai Berlangganan
        </router-link>
      </div>
    </div>
  </nav>
</template>
