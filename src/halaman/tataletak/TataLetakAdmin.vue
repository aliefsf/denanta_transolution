<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import JamRealtime from '../../komponen/umum/JamRealtime.vue';
import ModalUtama from '../../komponen/umum/ModalUtama.vue';
import {
  LayoutDashboard, Map, Truck, ClipboardCheck, Users,
  School, BarChart3, Wallet, UserCheck, CalendarDays,
  LogOut, Menu, X, ChevronLeft, ChevronRight, Bell, ArrowLeft
} from 'lucide-vue-next';
import { useNotifikasiPengguna } from '../../komposabel/useNotifikasiPengguna';

interface Props {
  tabAktif: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

const router = useRouter();
const authStore = useAuthStore();

const sidebarTerbuka = ref(true);
const mobileSidebarTerbuka = ref(false);

// Lihat catatan yang sama di TataLetakOrangTua.vue -- ganti tab di panel ini
// murni state lokal, bukan navigasi router, jadi perlu reset scroll manual.
const kontenUtama = ref<HTMLElement | null>(null);
watch(
  () => props.tabAktif,
  () => {
    kontenUtama.value?.scrollTo({ top: 0 });
  }
);

const toggleSidebar = () => {
  sidebarTerbuka.value = !sidebarTerbuka.value;
};

const toggleMobileSidebar = () => {
  mobileSidebarTerbuka.value = !mobileSidebarTerbuka.value;
};

const modalLogoutTampil = ref(false);
const sedangLogout = ref(false);

const konfirmasiLogout = async () => {
  sedangLogout.value = true;
  try {
    await authStore.logout();
    router.push('/login');
  } finally {
    sedangLogout.value = false;
    modalLogoutTampil.value = false;
  }
};

// Susunan menu mengikuti skenario use case Admin (UC-A01 s.d. UC-A09) —
// UC-A07 (persetujuan penundaan pembayaran) sengaja tidak jadi menu
// terpisah, karena alurnya ada di dalam detail pengguna pada menu
// "Daftar Pengguna".
const menuList = [
  { nama: 'Dashboard', id: 'dashboard', ikon: LayoutDashboard },
  { nama: 'Monitoring Supir', id: 'pemantauan', ikon: Map },
  { nama: 'Data Supir', id: 'supir', ikon: Truck },
  { nama: 'Daftar Pengguna', id: 'pengguna', ikon: UserCheck },
  { nama: 'Data Anak', id: 'anak', ikon: Users },
  { nama: 'Data Sekolah', id: 'sekolah', ikon: School },
  { nama: 'Penugasan Supir', id: 'penugasan', ikon: ClipboardCheck },
  { nama: 'Kelola Tarif', id: 'tarif', ikon: Wallet },
  { nama: 'Kelola Jadwal', id: 'jadwal', ikon: CalendarDays },
  { nama: 'Kelola Laporan', id: 'laporan', ikon: BarChart3 }
];

const setTab = (id: string) => {
  emit('ubah-tab', id);
  mobileSidebarTerbuka.value = false;
};

// Tombol panah kembali di sebelah logo -- BEDA dari TataLetakOrangTua.vue
// (yang selalu lompat ke landing page): di sini benar-benar coba kembali ke
// halaman SEBELUMNYA (router.back()), karena Admin/Supir biasanya login
// langsung ke dashboard-nya tanpa pernah "mampir" ke landing page dulu.
// `window.history.state.back` adalah properti yang diisi vue-router
// (createWebHistory) di tiap entri riwayat -- null berarti tidak ada
// halaman sebelumnya di riwayat sesi ini (mis. baru saja login), jadi
// daripada nyasar keluar dari app (atau diam saja), munculkan konfirmasi
// logout -- perilaku yang jauh lebih masuk akal buat Admin/Supir daripada
// dilempar ke landing page publik.
const kembaliKeBeranda = () => {
  if (window.history.state?.back) {
    router.back();
  } else {
    modalLogoutTampil.value = true;
  }
};

// Badge lonceng notifikasi -- composable SINGLETON yang sama juga dipakai
// NotifikasiAdmin.vue (lihat useNotifikasiPengguna.ts). Keduanya
// membaca/menulis satu instance `notifikasiList` yang sama, jadi begitu
// notifikasi ditandai dibaca di halaman daftar, angka di badge ini ikut
// berubah SEKETIKA lewat reaktivitas Vue biasa -- tidak perlu menunggu
// event realtime bolak-balik ke server.
const { jumlahBelumDibaca: jumlahNotifikasiBelumDibaca, sudahDimuat: notifikasiSudahDimuat, muatNotifikasi: muatNotifikasiPengguna } = useNotifikasiPengguna();

onMounted(() => {
  if (!notifikasiSudahDimuat.value) muatNotifikasiPengguna();
});
</script>

<template>
  <div class="flex h-screen bg-background text-on-background overflow-hidden">

    <!-- Desktop Sidebar -->
    <aside
      class="hidden md:flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 transition-all duration-300 relative z-30 flex-shrink-0"
      :class="sidebarTerbuka ? 'w-64' : 'w-20'"
    >
      <!-- Logo Header -->
      <div class="h-28 flex items-center px-4 border-b border-outline-variant/30 justify-between">
        <div v-show="sidebarTerbuka" class="flex items-center gap-2">
          <button
            @click="kembaliKeBeranda"
            class="cursor-pointer p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex-shrink-0"
            title="Kembali ke Beranda"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-28 w-auto" />
        </div>
        <div v-show="!sidebarTerbuka" class="w-full flex items-center justify-center gap-1">
          <button
            @click="kembaliKeBeranda"
            class="cursor-pointer p-1 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex-shrink-0"
            title="Kembali ke Beranda"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
          </button>
          <img src="/logo-denanta-icon.png" alt="Denanta TranSolution" class="h-6 w-auto" />
        </div>
      </div>

      <!-- Collapse Trigger Button -->
      <button
        @click="toggleSidebar"
        class="absolute top-28 -right-3 bg-primary hover:bg-[#0D7A68] text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md border border-surface-container-lowest cursor-pointer z-10"
      >
        <ChevronLeft v-if="sidebarTerbuka" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Navigation Menu -->
      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto tanpa-scrollbar">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface px-3 py-2 rounded-full text-xs font-semibold transition-all group cursor-pointer"
          :class="{
            'bg-primary text-white shadow-md hover:bg-primary hover:text-white': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <span v-show="sidebarTerbuka" class="ml-3 transition-opacity duration-300">{{ menu.nama }}</span>
        </button>
      </nav>

      <!-- Logout Button -->
      <div class="p-4 border-t border-outline-variant/30">
        <button
          @click="modalLogoutTampil = true"
          class="w-full flex items-center justify-center text-on-surface-variant hover:text-error px-3 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer hover:bg-error-container/20"
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
      class="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    ></div>

    <!-- Mobile Sidebar Drawer -->
    <aside
      class="md:hidden fixed top-0 bottom-0 left-0 w-64 bg-surface-container-lowest z-50 border-r border-outline-variant/30 flex flex-col transition-transform duration-300"
      :class="mobileSidebarTerbuka ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-28 flex items-center px-4 border-b border-outline-variant/30 justify-between">
        <div class="flex items-center gap-2">
          <button
            @click="kembaliKeBeranda"
            class="cursor-pointer p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex-shrink-0"
            title="Kembali ke Beranda"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-28 w-auto" />
        </div>
        <button @click="toggleMobileSidebar" class="text-on-surface-variant hover:text-on-surface p-1">
          <X class="w-6 h-6" />
        </button>
      </div>

      <nav class="flex-grow p-4 space-y-1.5 overflow-y-auto tanpa-scrollbar">
        <button
          v-for="menu in menuList"
          :key="menu.id"
          @click="setTab(menu.id)"
          class="w-full flex items-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
          :class="{
            'bg-primary text-white shadow-md': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5" />
          <span class="ml-3">{{ menu.nama }}</span>
        </button>
      </nav>

      <div class="p-4 border-t border-outline-variant/30">
        <button
          @click="modalLogoutTampil = true"
          class="w-full flex items-center justify-center text-on-surface-variant hover:text-error px-3 py-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer hover:bg-error-container/20"
        >
          <LogOut class="w-4.5 h-4.5" />
          <span class="ml-3">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content wrapper -->
    <div class="flex-grow flex flex-col min-w-0">

      <!-- Top header -->
      <header class="h-16 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-6 z-20 flex-shrink-0">
        <div class="flex items-center">
          <button
            @click="toggleMobileSidebar"
            class="md:hidden text-on-surface-variant hover:text-on-surface mr-3 p-1 rounded-lg hover:bg-surface-container"
          >
            <Menu class="w-6 h-6" />
          </button>
          <div class="flex flex-col">
            <h2 class="text-sm md:text-base font-bold text-on-surface leading-tight">
              Halo, Administrator
            </h2>
            <p class="hidden md:block text-[11px] text-on-surface-variant">Panel Administrator &mdash; DenantaTS</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Jam Realtime WIB -->
          <JamRealtime tema="terang" />

          <!-- Notification Bell -->
          <button
            class="relative cursor-pointer p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            @click="setTab('notifikasi')"
          >
            <Bell class="w-5 h-5" />
            <span
              v-if="jumlahNotifikasiBelumDibaca > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary border-2 border-surface-container-lowest text-white text-[9px] font-bold leading-none flex items-center justify-center"
            >{{ jumlahNotifikasiBelumDibaca > 9 ? '9+' : jumlahNotifikasiBelumDibaca }}</span>
          </button>
        </div>
      </header>

      <!-- Page Content Slot -->
      <main ref="kontenUtama" class="flex-grow overflow-y-auto tanpa-scrollbar p-6 md:p-8 bg-background relative">
        <slot />
      </main>

    </div>

    <!-- Modal Konfirmasi Logout -->
    <ModalUtama
      tema="terang"
      :tampil="modalLogoutTampil"
      judul="Konfirmasi Keluar"
      ukuran="sedang"
      @tutup="modalLogoutTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <LogOut class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">Apakah Anda yakin ingin keluar?</h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">Sesi login Anda akan diakhiri dan Anda harus masuk kembali untuk mengakses panel ini.</p>
      </div>

      <template #footer>
        <button
          type="button"
          class="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold hover:text-on-surface transition-colors bg-transparent border-0 cursor-pointer text-sm"
          :disabled="sedangLogout"
          @click="modalLogoutTampil = false"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-5 py-2.5 rounded-full bg-error hover:bg-error/90 text-white font-semibold transition-colors border-0 cursor-pointer text-sm disabled:opacity-60"
          :disabled="sedangLogout"
          @click="konfirmasiLogout"
        >
          {{ sedangLogout ? 'Memproses...' : 'Ya, Keluar' }}
        </button>
      </template>
    </ModalUtama>
  </div>
</template>
