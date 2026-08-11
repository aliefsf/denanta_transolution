<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import JamRealtime from '../../komponen/umum/JamRealtime.vue';
import ModalUtama from '../../komponen/umum/ModalUtama.vue';
import {
  LayoutDashboard, Users, Calendar, Clock, CreditCard,
  Bell, User, LogOut, Menu, X, ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle
} from 'lucide-vue-next';

interface Props {
  tabAktif: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

const router = useRouter();
const authStore = useAuthStore();
const { profil, anakAktifList, jumlahNotifikasiBelumDibaca, sudahDimuat, muatProfil, muatNotifikasi, hentikanRealtimePerjalanan } = useDataOrangTua();

const namaPengguna = computed(
  () => profil.value?.pengguna.nama_lengkap || authStore.pengguna?.email?.split('@')[0] || 'Orang Tua'
);

onMounted(() => {
  if (!sudahDimuat.value) {
    muatProfil();
    muatNotifikasi();
  }
});

const sidebarTerbuka = ref(true);
const mobileSidebarTerbuka = ref(false);

// Perpindahan tab di dalam panel ini murni ganti state lokal (bukan
// navigasi router), jadi TIDAK ikut kena scrollBehavior global di
// rute/index.ts -- tanpa ini, area konten <main> yang scroll-nya sudah
// jauh ke bawah tetap di posisi bawah begitu pindah tab, karena elemen
// <main>-nya sama persis (tidak di-remount), cuma isinya (v-if) yang
// berganti.
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
    hentikanRealtimePerjalanan();
    await authStore.logout();
    router.push('/login');
  } finally {
    sedangLogout.value = false;
    modalLogoutTampil.value = false;
  }
};

// Menu "Jadwal" (Pengaturan Jadwal & Absensi) hanya relevan utk langganan
// BULANAN -- konsep jadwal_mingguan/kalender hari efektif/cuti berbasis
// pola hari per minggu tidak berlaku utk langganan HARIAN (dibayar & aktif
// per hari, tanpa pola mingguan). Disembunyikan total dari panel akun yang
// SEMUA anaknya berlangganan harian, supaya panel tidak menyamaratakan
// kedua jenis layanan. Begitu ada minimal satu anak berlangganan bulanan
// (termasuk akun dengan campuran harian+bulanan), menu tetap ditampilkan.
const adaAnakLanggananBulanan = computed(() => anakAktifList.value.some((a) => a.jenis_langganan === 'bulanan'));

// Akun "Tidak Aktif" (langganan berakhir -- baik bulanan maupun harian --
// dan belum dilanjutkan pembayarannya) hanya boleh mengakses menu
// Pembayaran, supaya tetap bisa mengaktifkan kembali layanan tanpa bisa
// menyentuh fitur layanan lain (Dashboard, Pantau Anak, Jadwal, Riwayat
// Perjalanan, Notifikasi, Profil). Lihat juga penegakan di sisi tab
// (HalamanOrangTua.vue) yang memaksa tabAktif kembali ke 'pembayaran' kalau
// dicoba diakali lewat query ?tab=.
const akunAktif = computed(() => authStore.sudahBerlangganan);

const menuList = computed(() => {
  const semua = [
    { nama: 'Dashboard', id: 'dashboard', ikon: LayoutDashboard },
    { nama: 'Pantau Anak', id: 'pantau', ikon: Users },
    { nama: 'Jadwal', id: 'jadwal', ikon: Calendar },
    { nama: 'Riwayat Perjalanan', id: 'riwayat', ikon: Clock },
    { nama: 'Pembayaran', id: 'pembayaran', ikon: CreditCard },
    { nama: 'Profil', id: 'profil', ikon: User }
  ];
  if (!akunAktif.value) return semua.filter((m) => m.id === 'pembayaran');
  return adaAnakLanggananBulanan.value ? semua : semua.filter((m) => m.id !== 'jadwal');
});

const setTab = (id: string) => {
  emit('ubah-tab', id);
  mobileSidebarTerbuka.value = false;
};

const kembaliKeBeranda = () => {
  router.push('/');
};
</script>

<template>
  <div class="flex h-screen bg-background text-on-background overflow-hidden">

    <!-- Desktop Sidebar -->
    <aside
      class="hidden md:flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 transition-all duration-300 relative z-30 flex-shrink-0"
      :class="sidebarTerbuka ? 'w-64' : 'w-20'"
    >
      <!-- Logo Header -->
      <div class="h-28 flex items-center border-b border-outline-variant/30" :class="sidebarTerbuka ? 'px-4' : 'px-1.5'">
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
            'bg-primary text-white shadow-md hover:bg-primary hover:text-white': tabAktif === menu.id || (menu.id === 'pantau' && tabAktif === 'detail-anak')
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
            'bg-primary text-white shadow-md': tabAktif === menu.id || (menu.id === 'pantau' && tabAktif === 'detail-anak')
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
              Halo, {{ namaPengguna }}
            </h2>
            <p class="hidden md:block text-[11px] text-on-surface-variant">Portal Orang Tua &mdash; DenantaTS</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Jam Realtime WIB -->
          <JamRealtime tema="terang" />

          <!-- Notification Bell Shortcut -->
          <button
            @click="setTab('notifikasi')"
            class="relative cursor-pointer p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <Bell class="w-5 h-5" />
            <span
              v-if="jumlahNotifikasiBelumDibaca > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary border-2 border-surface-container-lowest text-white text-[9px] font-bold leading-none flex items-center justify-center"
            >{{ jumlahNotifikasiBelumDibaca > 9 ? '9+' : jumlahNotifikasiBelumDibaca }}</span>
          </button>
        </div>
      </header>

      <!-- Banner Akun Tidak Aktif: langganan berakhir & belum dilanjutkan -->
      <div v-if="!akunAktif" class="mx-6 md:mx-8 mt-4 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs">
        <AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Akun Anda Tidak Aktif.</strong> Langganan layanan antar-jemput sudah berakhir. Selesaikan pembayaran pada menu
          <strong>Pembayaran</strong> untuk mengaktifkan kembali seluruh fitur layanan.
        </span>
      </div>

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
        <p class="text-xs text-on-surface-variant leading-relaxed">Sesi login Anda akan diakhiri dan Anda harus masuk kembali untuk mengakses portal ini.</p>
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
