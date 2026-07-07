<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { 
  LayoutDashboard, ClipboardList, History, User, LogOut, 
  Menu, X, Bus, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert
} from 'lucide-vue-next';

interface Props {
  tabAktif: string;
  siapKerja: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
  (e: 'ubah-siap', status: boolean): void;
}>();

const router = useRouter();
const authStore = useAuthStore();

const sidebarTerbuka = ref(true);
const mobileSidebarTerbuka = ref(false);

const toggleSidebar = () => {
  sidebarTerbuka.value = !sidebarTerbuka.value;
};

const toggleMobileSidebar = () => {
  mobileSidebarTerbuka.value = !mobileSidebarTerbuka.value;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const menuList = [
  { nama: 'Dashboard', id: 'dashboard', ikon: LayoutDashboard },
  { nama: 'Tugas Hari Ini', id: 'tugas', ikon: ClipboardList },
  { nama: 'Riwayat Perjalanan', id: 'riwayat', ikon: History },
  { nama: 'Profil Saya', id: 'profil', ikon: User }
];

const setTab = (id: string) => {
  emit('ubah-tab', id);
  mobileSidebarTerbuka.value = false;
};
</script>

<template>
  <div class="flex h-screen bg-warnaUtama text-slate-100 overflow-hidden">
    
    <!-- Desktop Sidebar -->
    <aside 
      class="hidden md:flex flex-col bg-warnaSekunder border-r border-warnaAksen/30 transition-all duration-300 relative z-30 flex-shrink-0"
      :class="sidebarTerbuka ? 'w-64' : 'w-20'"
    >
      <!-- Logo Header -->
      <div class="h-16 flex items-center px-4 border-b border-warnaAksen/30 justify-between">
        <div v-show="sidebarTerbuka" class="flex items-center">
          <Bus class="h-7 w-7 text-warnaTombol mr-2" />
          <span class="text-lg font-extrabold text-white tracking-wider">
            Denanta<span class="text-warnaTombol">TS</span>
          </span>
        </div>
        <div v-show="!sidebarTerbuka" class="w-full flex justify-center">
          <Bus class="h-7 w-7 text-warnaTombol animate-pulse" />
        </div>
      </div>

      <!-- User Info Card -->
      <div class="p-4 border-b border-warnaAksen/20" v-show="sidebarTerbuka">
        <div class="flex items-center space-x-3 bg-warnaUtama/50 p-2.5 rounded-xl border border-warnaAksen/20">
          <div class="w-10 h-10 rounded-lg bg-warnaTombol/20 flex items-center justify-center text-warnaTombol">
            <User class="w-5 h-5" />
          </div>
          <div class="overflow-hidden">
            <h4 class="text-xs font-bold text-white truncate">Budi Santoso</h4>
            <p class="text-[10px] text-slate-400 capitalize">{{ authStore.peran }}</p>
          </div>
        </div>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-slate-300 hover:text-white px-3 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer"
          :class="{
            'bg-warnaAksen text-white border border-warnaAksen shadow-lg': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <span v-show="sidebarTerbuka" class="ml-3 transition-opacity duration-300">{{ menu.nama }}</span>
        </button>
      </nav>

      <!-- Collapse Trigger Button -->
      <button 
        @click="toggleSidebar" 
        class="absolute bottom-20 -right-3 bg-warnaTombol hover:bg-opacity-95 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-warnaUtama cursor-pointer"
      >
        <ChevronLeft v-if="sidebarTerbuka" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Logout Button -->
      <div class="p-4 border-t border-warnaAksen/30">
        <button
          @click="handleLogout"
          class="w-full flex items-center justify-center text-slate-400 hover:text-warnaTombol px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer hover:bg-red-500/10"
        >
          <LogOut class="w-5 h-5 flex-shrink-0" />
          <span v-show="sidebarTerbuka" class="ml-3">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Mobile Sidebar Drawer Backdrop -->
    <div 
      v-if="mobileSidebarTerbuka" 
      @click="toggleMobileSidebar" 
      class="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
    ></div>

    <!-- Mobile Sidebar Drawer -->
    <aside 
      class="md:hidden fixed top-0 bottom-0 left-0 w-64 bg-warnaSekunder z-50 border-r border-warnaAksen/30 flex flex-col transition-transform duration-300"
      :class="mobileSidebarTerbuka ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center px-4 border-b border-warnaAksen/30 justify-between">
        <div class="flex items-center">
          <Bus class="h-7 w-7 text-warnaTombol mr-2" />
          <span class="text-lg font-extrabold text-white tracking-wider">
            Denanta<span class="text-warnaTombol">TS</span>
          </span>
        </div>
        <button @click="toggleMobileSidebar" class="text-slate-400 hover:text-white p-1">
          <X class="w-6 h-6" />
        </button>
      </div>

      <div class="p-4 border-b border-warnaAksen/20">
        <div class="flex items-center space-x-3 bg-warnaUtama/50 p-2.5 rounded-xl border border-warnaAksen/20">
          <div class="w-10 h-10 rounded-lg bg-warnaTombol/20 flex items-center justify-center text-warnaTombol">
            <User class="w-5 h-5" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">Budi Santoso</h4>
            <p class="text-[10px] text-slate-400 capitalize">{{ authStore.peran }}</p>
          </div>
        </div>
      </div>

      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-slate-300 hover:text-white px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
          :class="{
            'bg-warnaAksen text-white border border-warnaAksen': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-5 h-5" />
          <span class="ml-3">{{ menu.nama }}</span>
        </button>
      </nav>

      <div class="p-4 border-t border-warnaAksen/30">
        <button
          @click="handleLogout"
          class="w-full flex items-center justify-center text-slate-400 hover:text-warnaTombol px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer hover:bg-red-500/10"
        >
          <LogOut class="w-5 h-5" />
          <span class="ml-3">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content wrapper -->
    <div class="flex-grow flex flex-col min-w-0">
      
      <!-- Top header with status kehadiran toggle -->
      <header class="h-16 bg-warnaSekunder/90 backdrop-blur-md border-b border-warnaAksen/30 flex items-center justify-between px-6 z-20 flex-shrink-0">
        <div class="flex items-center">
          <button 
            @click="toggleMobileSidebar" 
            class="md:hidden text-slate-400 hover:text-white mr-3 p-1 rounded-lg hover:bg-warnaAksen/20"
          >
            <Menu class="w-6 h-6" />
          </button>
          <h2 class="text-sm md:text-base font-bold text-white tracking-wide">
            Panel Kemudi Supir &mdash; DenantaTS
          </h2>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- Availability Kehadiran Toggle -->
          <button
            @click="emit('ubah-siap', !siapKerja)"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
            :class="siapKerja ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400' : 'bg-rose-950/20 border-rose-500 text-rose-400'"
          >
            <CheckCircle2 v-if="siapKerja" class="w-3.5 h-3.5" />
            <ShieldAlert v-else class="w-3.5 h-3.5" />
            <span>{{ siapKerja ? 'Siap Bertugas' : 'Tidak Siap' }}</span>
          </button>

          <!-- Halo Greeting -->
          <span class="hidden sm:inline-block text-xs text-slate-400 bg-warnaUtama px-2.5 py-1 rounded-lg border border-warnaAksen/20">
            Halo, <strong class="text-warnaTombol text-slate-200">Budi Santoso</strong>
          </span>
        </div>
      </header>

      <!-- Page Content Slot -->
      <main class="flex-grow overflow-y-auto p-6 md:p-8 bg-warnaUtama relative">
        <slot />
      </main>

    </div>
  </div>
</template>
