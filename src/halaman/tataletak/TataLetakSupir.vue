<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../penyimpanan/authStore';
import { useAuth } from '../../komposabel/useAuth';
import JamRealtime from '../../komponen/umum/JamRealtime.vue';
import ModalUtama from '../../komponen/umum/ModalUtama.vue';
import {
  LayoutDashboard, ClipboardList, ClipboardCheck, History, User, LogOut,
  Menu, X, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert, HelpCircle, Bell, Navigation, ArrowLeft, Lock
} from 'lucide-vue-next';
import { useNotifikasiPengguna } from '../../komposabel/useNotifikasiPengguna';
import { useLokasiSupir } from '../../komposabel/useLokasiSupir';

import { perbaruiStatusBertugas, type StatusKehadiran } from '../../layanan/supirLayanan';

interface Props {
  tabAktif: string;
  statusKehadiran: StatusKehadiran;
  akunAktif?: boolean;
}

const props = withDefaults(defineProps<Props>(), { akunAktif: true });

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

const infoStatusHeader = computed(() => {
  switch (props.statusKehadiran) {
    case 'siap':
      return { label: 'Siap Bertugas', kelas: 'bg-emerald-50 border-emerald-500 text-emerald-600', ikon: CheckCircle2 };
    case 'tidak_siap':
      return { label: 'Tidak Bertugas', kelas: 'bg-rose-50 border-rose-400 text-rose-600', ikon: ShieldAlert };
    default:
      return { label: 'Absensi Belum Diisi', kelas: 'bg-amber-50 border-amber-400 text-amber-700', ikon: HelpCircle };
  }
});

const router = useRouter();
const authStore = useAuthStore();
const { userProfile } = useAuth();

const sidebarTerbuka = ref(true);
const mobileSidebarTerbuka = ref(false);

const namaSupir = computed(() => userProfile.value?.nama || authStore.pengguna?.email?.split('@')[0] || 'Supir');

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

// Susunan menu mengikuti skenario use case Supir (UC-S01 s.d. UC-S06) —
// UC-S01 (atur status kehadiran) punya halaman khusus "Absensi Harian" agar
// dapat diakses terpisah dari Dashboard; badge di header cuma menampilkan
// status terkini (read-only) dan mengarahkan ke halaman itu bila diklik.
const menuList = [
  { nama: 'Dashboard', id: 'dashboard', ikon: LayoutDashboard },
  { nama: 'Absensi Harian', id: 'absensi', ikon: ClipboardCheck },
  { nama: 'Tugas Hari Ini', id: 'tugas', ikon: ClipboardList },
  { nama: 'Riwayat Perjalanan', id: 'riwayat', ikon: History },
  { nama: 'Profil Saya', id: 'profil', ikon: User }
];

const setTab = (id: string) => {
  // Akun nonaktif hanya boleh membuka "Profil Saya" -- HalamanSupir.vue
  // sudah menolak juga di level yang lebih otoritatif (ubahTab()), tapi
  // dicegah di sini juga supaya menu lain tidak sempat kelihatan "aktif"
  // sesaat sebelum ditolak, dan tombol yang dikunci memang tidak bisa diklik.
  if (!props.akunAktif && id !== 'profil') return;
  emit('ubah-tab', id);
  mobileSidebarTerbuka.value = false;
};

// Lihat catatan yang sama di TataLetakAdmin.vue -- tombol panah kembali
// di sini coba router.back() dulu (kembali ke halaman sebelumnya beneran),
// dan hanya munculkan konfirmasi logout kalau memang tidak ada riwayat
// sebelumnya di sesi ini (window.history.state.back null, mis. supir baru
// saja login langsung ke dashboard).
const kembaliKeBeranda = () => {
  if (window.history.state?.back) {
    router.back();
  } else {
    modalLogoutTampil.value = true;
  }
};

// Badge lonceng notifikasi -- composable SINGLETON yang sama juga dipakai
// NotifikasiSupir.vue (lihat useNotifikasiPengguna.ts). Keduanya
// membaca/menulis satu instance `notifikasiList` yang sama, jadi begitu
// notifikasi ditandai dibaca di halaman daftar, angka di badge ini ikut
// berubah SEKETIKA lewat reaktivitas Vue biasa -- tidak perlu menunggu
// event realtime bolak-balik ke server.
const { jumlahBelumDibaca: jumlahNotifikasiBelumDibaca, sudahDimuat: notifikasiSudahDimuat, muatNotifikasi: muatNotifikasiPengguna } = useNotifikasiPengguna();

onMounted(() => {
  if (!notifikasiSudahDimuat.value) muatNotifikasiPengguna();
});

// Live Tracking GPS -- TIDAK otomatis mulai dari sini lagi. Sekarang harus
// dipicu eksplisit oleh supir lewat tombol "Mulai Bertugas" per sesi di
// halaman Tugas Hari Ini (lihat TugasSupir.vue -> useLokasiSupir singleton
// yang sama, jadi indikator di header ini otomatis ikut ter-update). Di
// sini cuma menyediakan indikator status + jaring pengaman: kalau supir
// menandai dirinya "Tidak Bertugas", tracking dipaksa berhenti walau lupa
// belum menandai tugas selesai.
const { sedangMelacak, errorLacak, hentikanLacak } = useLokasiSupir();
watch(
  () => props.statusKehadiran,
  (status) => {
    if (status === 'tidak_siap') {
      hentikanLacak();
      perbaruiStatusBertugas(false).catch(() => {});
    }
  }
);
onUnmounted(() => {
  hentikanLacak();
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
          :disabled="!akunAktif && menu.id !== 'profil'"
          :title="!akunAktif && menu.id !== 'profil' ? 'Akun dinonaktifkan -- hanya Profil Saya yang bisa diakses' : undefined"
          class="w-full flex items-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface px-3 py-2 rounded-full text-xs font-semibold transition-all group cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          :class="{
            'bg-primary text-white shadow-md hover:bg-primary hover:text-white': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <span v-show="sidebarTerbuka" class="ml-3 transition-opacity duration-300 flex items-center gap-1.5">
            {{ menu.nama }}
            <Lock v-if="!akunAktif && menu.id !== 'profil'" class="w-3 h-3" />
          </span>
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
          :disabled="!akunAktif && menu.id !== 'profil'"
          class="w-full flex items-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          :class="{
            'bg-primary text-white shadow-md': tabAktif === menu.id
          }"
        >
          <component :is="menu.ikon" class="w-4.5 h-4.5" />
          <span class="ml-3 flex items-center gap-1.5">
            {{ menu.nama }}
            <Lock v-if="!akunAktif && menu.id !== 'profil'" class="w-3 h-3" />
          </span>
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

      <!-- Top header with status kehadiran toggle -->
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
              Halo, {{ namaSupir }}
            </h2>
            <p class="hidden md:block text-[11px] text-on-surface-variant">Panel Kemudi Supir &mdash; DenantaTS</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Indikator Live Tracking GPS -- cuma tampil setelah supir menekan
               "Mulai Bertugas" di halaman Tugas Hari Ini (lihat TugasSupir.vue).
               Titik hijau berdenyut = lokasi aktif terkirim; kalau errorLacak
               terisi (mis. izin lokasi ditolak), ganti jadi ikon kuning
               dengan pesan di title. -->
          <div
            v-if="sedangMelacak || errorLacak"
            class="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold"
            :class="errorLacak ? 'text-amber-600' : 'text-emerald-600'"
            :title="errorLacak || 'Live tracking GPS aktif -- lokasi Anda terlihat orang tua yang dijemput.'"
          >
            <Navigation class="w-3.5 h-3.5" />
            <span class="relative flex h-2 w-2">
              <span
                v-if="sedangMelacak"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2"
                :class="errorLacak ? 'bg-amber-500' : 'bg-emerald-500'"
              ></span>
            </span>
          </div>

          <!-- Jam Realtime WIB -->
          <JamRealtime tema="terang" />

          <!-- Notification Bell -->
          <button
            @click="emit('ubah-tab', 'notifikasi')"
            class="relative cursor-pointer p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <Bell class="w-5 h-5" />
            <span
              v-if="jumlahNotifikasiBelumDibaca > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary border-2 border-surface-container-lowest text-white text-[9px] font-bold leading-none flex items-center justify-center"
            >{{ jumlahNotifikasiBelumDibaca > 9 ? '9+' : jumlahNotifikasiBelumDibaca }}</span>
          </button>

          <!-- Badge Status Kehadiran (read-only, UC-S01) -- klik untuk buka halaman Absensi Harian -->
          <button
            @click="emit('ubah-tab', 'absensi')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer hover:opacity-80"
            :class="infoStatusHeader.kelas"
            title="Buka halaman Absensi Harian"
          >
            <component :is="infoStatusHeader.ikon" class="w-3.5 h-3.5 flex-shrink-0" />
            <span>{{ infoStatusHeader.label }}</span>
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
