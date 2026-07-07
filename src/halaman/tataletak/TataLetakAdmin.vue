<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { 
  LayoutDashboard, Map, Truck, ClipboardCheck, Users, 
  School, BarChart3, Wallet, UserCheck, Megaphone, 
  Settings, LogOut, Menu, X, Bus, ChevronLeft, ChevronRight, Bell, ScrollText
} from 'lucide-vue-next';

interface Props {
  tabAktif: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
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
  { nama: 'Pemantauan Global', id: 'pemantauan', ikon: Map },
  { nama: 'Data Supir', id: 'supir', ikon: Truck },
  { nama: 'Penugasan Supir', id: 'penugasan', ikon: ClipboardCheck },
  { nama: 'Data Anak', id: 'anak', ikon: Users },
  { nama: 'Data Sekolah', id: 'sekolah', ikon: School },
  { nama: 'Laporan Performa', id: 'laporan', ikon: BarChart3 },
  { nama: 'Manajemen Keuangan', id: 'keuangan', ikon: Wallet },
  { nama: 'Daftar Pengguna', id: 'pengguna', ikon: UserCheck },
  { nama: 'Pengumuman Masal', id: 'pengumuman', ikon: Megaphone },
  { nama: 'Log Aktivitas', id: 'log', ikon: ScrollText },
  { nama: 'Pengaturan Sistem', id: 'pengaturan', ikon: Settings }
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

      <!-- Navigation Menu -->
      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all group cursor-pointer"
          :class="{
            'bg-warnaAksen text-white border border-warnaAksen shadow-lg': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
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
          class="w-full flex items-center justify-center text-slate-400 hover:text-warnaTombol px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer hover:bg-red-500/10"
        >
          <LogOut class="w-4.5 h-4.5 flex-shrink-0" />
          <span v-show="sidebarTerbuka" class="ml-3">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Mobile Sidebar Backdrop -->
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

      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          :class="{
            'bg-warnaAksen text-white border border-warnaAksen': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5" />
          <span class="ml-3">{{ menu.nama }}</span>
        </button>
      </nav>

      <div class="p-4 border-t border-warnaAksen/30">
        <button
          @click="handleLogout"
          class="w-full flex items-center justify-center text-slate-400 hover:text-warnaTombol px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer hover:bg-red-500/10"
        >
          <LogOut class="w-4.5 h-4.5" />
          <span class="ml-3">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content wrapper -->
    <div class="flex-grow flex flex-col min-w-0">
      
      <!-- Top header -->
      <header class="h-16 bg-warnaSekunder/90 backdrop-blur-md border-b border-warnaAksen/30 flex items-center justify-between px-6 z-20 flex-shrink-0">
        <div class="flex items-center">
          <button 
            @click="toggleMobileSidebar" 
            class="md:hidden text-slate-400 hover:text-white mr-3 p-1 rounded-lg hover:bg-warnaAksen/20"
          >
            <Menu class="w-6 h-6" />
          </button>
          <h2 class="text-sm md:text-base font-bold text-white tracking-wide">
            Panel Administrator &mdash; DenantaTS
          </h2>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- Notification Bell -->
          <div 
            class="relative cursor-pointer p-2 rounded-lg bg-warnaUtama/50 border border-warnaAksen/20 text-slate-400 hover:text-white transition-colors"
            @click="setTab('log')"
          >
            <Bell class="w-4 h-4" />
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warnaTombol border border-warnaSekunder animate-pulse"></span>
          </div>

          <!-- Halo Greeting -->
          <span class="text-xs text-slate-400 bg-warnaUtama px-2.5 py-1 rounded-lg border border-warnaAksen/20">
            Halo, <strong class="text-warnaTombol text-slate-200">Admin</strong>
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
