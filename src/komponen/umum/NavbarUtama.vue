<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Shield, User, Car, Bus, LogOut, Menu, X } from 'lucide-vue-next';

const router = useRouter();
const menuTerbuka = ref(false);

const navigasi = [
  { nama: 'Halaman Utama', path: '/', ikon: Bus },
  { nama: 'Orang Tua', path: '/orangtua', ikon: User },
  { nama: 'Supir', path: '/supir', ikon: Car },
  { nama: 'Admin Portal', path: '/admin', ikon: Shield },
];

const toggleMenu = () => {
  menuTerbuka.value = !menuTerbuka.value;
};

const navigasiKe = (path: string) => {
  router.push(path);
  menuTerbuka.value = false;
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
        <div class="hidden md:flex items-center space-x-4">
          <router-link
            v-for="nav in navigasi"
            :key="nav.path"
            :to="nav.path"
            class="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
            active-class="bg-warnaAksen text-white border border-warnaAksen"
          >
            <component :is="nav.ikon" class="w-4 h-4" />
            {{ nav.nama }}
          </router-link>
          
          <button
            class="text-slate-400 hover:text-white transition-colors duration-200 ml-4 cursor-pointer"
            title="Keluar"
          >
            <LogOut class="w-5 h-5 hover:text-warnaTombol transition-colors duration-200" />
          </button>
        </div>

        <!-- Mobile Menu Button -->
        <div class="flex md:hidden">
          <button
            @click="toggleMenu"
            class="text-slate-400 hover:text-white focus:outline-none p-2 rounded-md hover:bg-warnaAksen/30 cursor-pointer"
          >
            <Menu v-if="!menuTerbuka" class="w-6 h-6" />
            <X v-else class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-show="menuTerbuka" class="md:hidden bg-warnaSekunder border-b border-warnaAksen/30 py-2 transition-all duration-300">
      <div class="px-2 space-y-1">
        <router-link
          v-for="nav in navigasi"
          :key="nav.path"
          :to="nav.path"
          @click="menuTerbuka = false"
          class="text-slate-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2"
          active-class="bg-warnaAksen text-white"
        >
          <component :is="nav.ikon" class="w-5 h-5" />
          {{ nav.nama }}
        </router-link>
      </div>
    </div>
  </nav>
</template>
