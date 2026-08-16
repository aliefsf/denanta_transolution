<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { useAuth } from '../komposabel/useAuth';
import FooterPublik from '../komponen/umum/FooterPublik.vue';
import { kelasMenuNavbar, kelasMenuNavbarMobile } from '../bantuan/kelasMenuNavbar';
import {
  Menu, X, Bell, User,
  ChevronRight, Eye, Rocket, CheckCircle,
  MapPin, Gavel, ShieldCheck, Shield
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isAuthenticated, userProfile } = useAuth();
const menuTerbuka = ref(false);
const adaNotifikasi = ref(true);

// Lihat catatan yang sama di HalamanUtama.vue.
const kelasMenuBeranda = computed(() => kelasMenuNavbar(route.path === '/'));
const kelasMenuTentang = computed(() => kelasMenuNavbar(route.path === '/tentang'));
const kelasMenuLangganan = computed(() => kelasMenuNavbar(route.path === '/berlangganan'));
const kelasMenuBerandaMobile = computed(() => kelasMenuNavbarMobile(route.path === '/'));
const kelasMenuTentangMobile = computed(() => kelasMenuNavbarMobile(route.path === '/tentang'));
const kelasMenuLangganganMobile = computed(() => kelasMenuNavbarMobile(route.path === '/berlangganan'));

const toggleMenu = () => {
  menuTerbuka.value = !menuTerbuka.value;
};

const navigasiKe = (path: string) => {
  router.push(path);
  menuTerbuka.value = false;
};

const navigasiDashboard = () => {
  if (authStore.apakahAdmin) router.push('/admin');
  else if (authStore.apakahSupir) router.push('/supir');
  else if (authStore.apakahOrangTua) router.push('/orangtua');
  else router.push('/');
  menuTerbuka.value = false;
};

// Lihat catatan yang sama di HalamanUtama.vue.
const bukaNotifikasi = () => {
  if (authStore.apakahAdmin) router.push({ path: '/admin', query: { tab: 'notifikasi' } });
  else if (authStore.apakahSupir) router.push({ path: '/supir', query: { tab: 'notifikasi' } });
  else if (authStore.apakahOrangTua) router.push({ path: '/orangtua', query: { tab: 'notifikasi' } });
  menuTerbuka.value = false;
};

// Menu "Berlangganan"/"Monitoring": label & tujuan mengikuti status
// langganan -- belum berlangganan -> "Berlangganan" (ke halaman pendaftaran),
// sudah berlangganan -> "Monitoring" (ke Dashboard/tab default Panel
// Pengguna, BUKAN langsung ke tab Pantau Anak -- pengguna sendiri yang
// memilih fitur monitoring dari dashboard).
const sudahAktifBerlangganan = computed(() => authStore.sudahLogin && authStore.sudahBerlangganan);
const labelMenuLangganan = computed(() => (sudahAktifBerlangganan.value ? 'Monitoring' : 'Berlangganan'));

const bukaMenuLangganan = () => {
  if (sudahAktifBerlangganan.value) {
    router.push('/orangtua');
  } else {
    router.push('/berlangganan');
  }
  menuTerbuka.value = false;
};

onMounted(() => {
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('opacity-100', 'translate-y-0');
        entry.target.classList.remove('opacity-0', 'translate-y-10');
      }
    });
  }, observerOptions);

  document.querySelectorAll('section').forEach(section => {
    section.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
    observer.observe(section);
  });
});

const namaPengguna = computed(() => {
  return userProfile.value?.nama || 
         authStore.pengguna?.user_metadata?.nama_lengkap || 
         authStore.pengguna?.nama_lengkap || 
         authStore.pengguna?.email?.split('@')[0] || 
         'Pengguna';
});
</script>

<template>
  <div class="bg-background text-on-surface font-body-md overflow-x-hidden min-h-screen pt-24">

    <!-- TopNavBar -->
    <nav
      class="bg-surface-container-lowest dark:bg-surface-dim border-b border-outline-variant/30 shadow-sm fixed top-0 left-0 w-full z-50 transition-transform duration-300"
      :style="{ transform: menuTerbuka ? 'translateX(-18rem)' : 'none' }"
    >
      <div class="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-[1280px] mx-auto">
        <!-- Logo -->
        <div class="flex items-center cursor-pointer" @click="navigasiKe('/')">
          <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-14 md:h-24 w-auto" />
        </div>

        <!-- Desktop Menu -->
        <div class="hidden md:flex gap-2 items-center">
          <router-link to="/" :class="kelasMenuBeranda">Beranda</router-link>
          <router-link to="/tentang" :class="kelasMenuTentang">Tentang Kami</router-link>
          <button type="button" @click="bukaMenuLangganan" :class="[kelasMenuLangganan, 'border-0', route.path === '/berlangganan' ? '' : 'bg-transparent']">
            {{ labelMenuLangganan }}
          </button>
        </div>

        <!-- Right Actions -->
        <div class="hidden md:flex items-center gap-4">
          <!-- Notifikasi -->
          <button
            v-if="isAuthenticated"
            type="button"
            @click="bukaNotifikasi"
            class="relative cursor-pointer text-slate-500 hover:text-primary transition-colors mr-2 p-0 bg-transparent border-0"
            title="Lihat Notifikasi"
          >
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-error"></span>
          </button>

          <!-- Kondisi BELUM LOGIN -->
          <div v-if="!isAuthenticated" class="flex items-center gap-2">
            <router-link
              to="/login"
              class="text-on-surface-variant hover:text-primary font-label-md text-label-md rounded-full px-4 py-2.5 transition-colors cursor-pointer border-0 font-semibold inline-block bg-transparent"
            >
              Masuk
            </router-link>
            <router-link
              to="/register"
              class="bg-primary hover:bg-[#0D7A68] text-on-primary font-label-md text-label-md rounded-full px-5 py-2.5 transition-colors shadow-sm cursor-pointer border-0 font-semibold inline-block"
            >
              Daftar
            </router-link>
          </div>

          <!-- Kondisi SUDAH LOGIN -->
          <div v-else class="flex items-center">
            <router-link
              to="/profile/edit"
              class="flex items-center gap-2 bg-brand-tosca-light hover:bg-[#D5F0EB] text-primary rounded-full px-4 py-2 transition-all shadow-sm cursor-pointer border-0 font-medium font-body-md text-body-md dark:bg-on-surface-variant/10 dark:hover:bg-on-surface-variant/20 dark:text-on-surface"
              :title="'Ubah Profil ' + namaPengguna"
            >
              <img
                v-if="userProfile?.foto_profil"
                :src="userProfile.foto_profil"
                alt="Avatar"
                class="w-5 h-5 rounded-full object-cover"
              />
              <User v-else class="w-5 h-5 text-primary" />
              <span>{{ namaPengguna }}</span>
            </router-link>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <div class="md:hidden flex items-center gap-2">
          <!-- Notifikasi Mobile if logged in -->
          <button
            v-if="authStore.sudahLogin"
            type="button"
            @click="bukaNotifikasi"
            class="relative cursor-pointer text-slate-500 hover:text-primary transition-colors p-2 bg-transparent border-0"
            title="Lihat Notifikasi"
          >
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
          </button>
          <button @click="toggleMenu" class="text-on-surface-variant hover:text-primary p-2 cursor-pointer border-0 bg-transparent">
            <Menu class="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>

    <!-- Backdrop + sidebar di-Teleport ke <body> supaya benar-benar fixed ke
         viewport asli (bukan ancestor yang sekarang punya transform di
         bawah), dan tidak ikut ter-geser saat kontennya bergeser (lihat
         pembungkus "kontenGeser" di bawah, mengikuti pola yang sama seperti
         di HalamanUtama.vue). -->
    <Teleport to="body">
    <!-- Mobile Sidebar Backdrop -->
    <div
      v-if="menuTerbuka"
      @click="toggleMenu"
      class="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    ></div>

    <!-- Mobile Sidebar Drawer -->
    <aside
      class="md:hidden fixed top-0 bottom-0 right-0 w-72 bg-surface-container-lowest z-50 border-l border-outline-variant/30 flex flex-col transition-transform duration-300 shadow-xl"
      :class="menuTerbuka ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="h-20 flex items-center justify-between px-margin-mobile border-b border-outline-variant/30 flex-shrink-0">
        <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-12 w-auto" />
        <button @click="toggleMenu" class="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer border-0 bg-transparent">
          <X class="w-6 h-6" />
        </button>
      </div>

      <nav class="flex-grow overflow-y-auto tanpa-scrollbar px-margin-mobile py-6 flex flex-col gap-3">
        <router-link to="/" @click="menuTerbuka = false" :class="kelasMenuBerandaMobile">Beranda</router-link>
        <router-link to="/tentang" @click="menuTerbuka = false" :class="kelasMenuTentangMobile">Tentang Kami</router-link>
        <button
          type="button"
          @click="bukaMenuLangganan"
          :class="[kelasMenuLangganganMobile, 'w-full text-left border-0', route.path === '/berlangganan' ? '' : 'bg-transparent']"
        >
          {{ labelMenuLangganan }}
        </button>
      </nav>

      <div class="px-margin-mobile py-6 border-t border-outline-variant/20 flex flex-col gap-2 flex-shrink-0">
        <div v-if="isAuthenticated" class="flex flex-col gap-2">
          <router-link
            to="/profile/edit"
            @click="menuTerbuka = false"
            class="w-full bg-brand-tosca-light hover:bg-[#D5F0EB] text-primary py-2.5 rounded-xl text-center font-semibold flex items-center justify-center gap-2"
          >
            <User class="w-4 h-4 text-primary" />
            Edit Profil
          </router-link>
          <button
            @click="navigasiDashboard"
            class="w-full bg-primary hover:bg-[#0D7A68] text-white py-2.5 rounded-xl text-center font-semibold cursor-pointer border-0"
          >
            Dashboard
          </button>
        </div>
        <div v-else class="flex flex-col gap-2">
          <router-link
            to="/login"
            @click="menuTerbuka = false"
            class="w-full text-on-surface-variant hover:text-primary py-2.5 text-center font-semibold block"
          >
            Masuk
          </router-link>
          <router-link
            to="/register"
            @click="menuTerbuka = false"
            class="w-full bg-primary text-white py-2.5 rounded-xl text-center font-semibold block border-0"
          >
            Daftar
          </router-link>
        </div>
      </div>
    </aside>
    </Teleport>

    <!-- Konten geser (Page Header Banner s.d. Footer) -- ikut bergeser ke
         kiri saat sidebar dibuka, sama seperti di HalamanUtama.vue. -->
    <div class="transition-transform duration-300" :style="{ transform: menuTerbuka ? 'translateX(-18rem)' : 'none' }">

    <!-- Page Header Banner -->
    <header class="relative bg-gradient-to-br from-primary via-primary to-[#0a5a4c] py-12 md:py-16 px-margin-mobile md:px-margin-desktop overflow-hidden">
      <div class="absolute -top-16 -right-16 w-72 h-72 bg-tertiary rounded-full opacity-[0.12] blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-20 left-[5%] w-64 h-64 bg-white rounded-full opacity-[0.06] blur-3xl pointer-events-none"></div>
      <div class="max-w-[1280px] mx-auto relative z-10 text-left">
        <nav class="mb-4 flex items-center gap-2 text-label-md text-white/80 font-label-md">
          <router-link to="/" class="hover:underline hover:text-white transition-colors">Beranda</router-link>
          <ChevronRight class="w-3.5 h-3.5" />
          <span class="text-white font-normal">Tentang Kami</span>
        </nav>
        <h1 class="font-headline-lg-mobile text-[clamp(2rem,8vw,2.75rem)] leading-[1.15] md:font-display-lg md:text-display-lg md:leading-[56px] text-white mb-4">Tentang Kami</h1>
        <p class="font-body-lg text-body-lg text-white/85 max-w-2xl leading-relaxed">
          Solusi transportasi sekolah modern yang mengedepankan keamanan, transparansi, dan kenyamanan bagi anak-anak serta ketenangan pikiran bagi orang tua di Kota Padang.
        </p>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-14 md:py-20 space-y-20 md:space-y-32">

      <!-- Section: Sejarah -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center relative text-left">
        <div class="relative">
          <div class="dotted-curve w-full h-full absolute -bottom-8 -right-8 opacity-20"></div>
          <div class="aspect-square rounded-2xl overflow-hidden soft-shadow relative z-10">
            <img 
              class="w-full h-full object-cover" 
              alt="Denanta Team"
              src="/aset/tim-tentang-kami.png"
            >
          </div>
        </div>
        <div class="space-y-6">
          <span class="text-primary font-label-md uppercase tracking-widest block">Perjalanan Kami</span>
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Sejarah Kami</h2>
          <div class="space-y-4 text-body-lg text-secondary leading-relaxed">
            <p>
              Berawal dari keprihatinan kami terhadap tantangan transportasi harian bagi anak-anak sekolah di Kota Padang, Denanta TranSolution lahir dengan misi untuk merevolusi cara anak-anak berangkat dan pulang sekolah. 
            </p>
            <p>
              Kami memahami bahwa bagi orang tua, menitipkan anak pada pihak ketiga bukan sekadar masalah logistik, melainkan masalah kepercayaan mendalam. Itulah mengapa sejak hari pertama, kami membangun sistem yang memadukan keandalan transportasi fisik dengan kecanggihan teknologi pelacakan real-time.
            </p>
            <p>
              Melalui dedikasi bertahun-tahun dalam melayani komunitas di Padang, kami telah berkembang dari layanan armada tunggal menjadi mitra terpercaya bagi ratusan keluarga dan institusi pendidikan.
            </p>
          </div>
        </div>
      </section>

      <!-- Section: Visi & Misi -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-gutter text-center md:text-left">
        <!-- Visi Card -->
        <div class="bg-surface-container-lowest p-6 md:p-10 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center md:items-start gap-6 transition-transform hover:-translate-y-1 duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <Eye class="w-8 h-8" />
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface">Visi</h3>
          <p class="text-body-lg text-secondary leading-relaxed text-left">
            Menjadi standar emas transportasi anak yang paling terpercaya dan inovatif di Sumatera Barat, menciptakan ekosistem perjalanan sekolah yang tanpa hambatan, aman secara mutlak, dan ramah bagi perkembangan anak.
          </p>
        </div>
        <!-- Misi Card -->
        <div class="bg-surface-container-lowest p-6 md:p-10 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center md:items-start gap-6 transition-transform hover:-translate-y-1 duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <Rocket class="w-8 h-8" />
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface">Misi</h3>
          <ul class="space-y-4 text-body-lg text-secondary list-none p-0 m-0 w-full">
            <li class="flex items-start gap-3 text-left w-full">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Menyediakan armada transportasi yang selalu dalam kondisi prima dan memenuhi standar keamanan tertinggi.</span>
            </li>
            <li class="flex items-start gap-3 text-left w-full">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Memberikan transparansi penuh kepada orang tua melalui integrasi teknologi pelacakan canggih.</span>
            </li>
            <li class="flex items-start gap-3 text-left w-full">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Merekrut dan melatih pengemudi yang tidak hanya ahli berkendara, tetapi juga memiliki etika dan keramahan tinggi.</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Section: Area Layanan -->
      <section class="text-center space-y-8 md:space-y-12">
        <div class="space-y-2">
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Area Layanan</h2>
          <p class="text-body-lg text-secondary">Layanan kami saat ini mencakup wilayah strategis di Kota Padang.</p>
        </div>
        <div class="relative max-w-4xl mx-auto rounded-3xl overflow-hidden soft-shadow bg-surface-container-low border border-solid border-outline-variant p-2">
          <div class="relative w-full aspect-[21/9] rounded-2xl overflow-hidden bg-white">
            <div class="w-full h-full bg-[#f0f4f2]">
              <img 
                class="w-full h-full object-cover" 
                alt="Peta Padang" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuANGEhCiJYjsVruh_lgjQgOoL27owFT4hSBAg1asMbW-DQCXdqLF3sNyYf6A4gV20tGDcmV3rcdXfG3eus8CuOgoA4P2o7Fx63UaoVwIsJqx7xc5gvM7UqrecwC0jkaucIUJcgoK7nUVVDc3HmZ34X-2E2TDDEXBa1YGmdvbkqRR1rX-F3Z4KOZp3IhauRalRX2CA6lJGPR22XiXujHSB1ABO_isnCD8AUNybNDkQn98eoA0Rcjt_OufQzRfgt9nFSrM4vNOsz_2YY"
              >
            </div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div class="bg-primary text-white px-4 py-2 rounded-full font-label-md shadow-lg flex items-center gap-2 mb-2 animate-bounce">
                <MapPin class="w-4 h-4" />
                KOTA PADANG
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-4">
          <span class="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-label-md shadow-sm shadow-primary/20 border-0">Koto Tangah</span>
          <span class="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-label-md shadow-sm shadow-primary/20 border-0">Padang Utara</span>
          <span class="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-label-md shadow-sm shadow-primary/20 border-0">Padang Barat</span>
          <span class="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-label-md shadow-sm shadow-primary/20 border-0">Lubuk Begalung</span>
          <span class="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-label-md shadow-sm shadow-primary/20 border-0">Nanggalo</span>
        </div>
      </section>

      <!-- Section: Legalitas & Keamanan -->
      <section class="space-y-8 md:space-y-12">
        <div class="text-center">
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Komitmen Keamanan &amp; Legalitas</h2>
          <p class="text-body-lg text-secondary mt-2">Kepercayaan Anda adalah prioritas tertinggi kami.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter text-center">
          <div class="bg-surface-container-lowest p-6 md:p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 mb-2">
              <Gavel class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Legalitas Usaha</h4>
            <p class="text-body-md text-secondary leading-relaxed text-left">Terdaftar secara resmi sebagai entitas bisnis transportasi legal dengan seluruh izin operasional yang lengkap sesuai regulasi.</p>
          </div>
          <div class="bg-surface-container-lowest p-6 md:p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 mb-2">
              <ShieldCheck class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Verifikasi Driver</h4>
            <p class="text-body-md text-secondary leading-relaxed text-left">Setiap pengemudi wajib mengunggah dokumen KTP, SIM, dan STNK kendaraan yang diverifikasi langsung oleh admin sebelum diizinkan bertugas.</p>
          </div>
          <div class="bg-surface-container-lowest p-6 md:p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 mb-2">
              <Shield class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Keamanan Perjalanan</h4>
            <p class="text-body-md text-secondary leading-relaxed text-left">Setiap perjalanan dipantau secara real-time dan dikendarai oleh pengemudi terverifikasi untuk menjaga keselamatan anak Anda.</p>
          </div>
        </div>
      </section>

      <!-- CTA Banner -->
      <section class="bg-gradient-to-br from-primary-container via-primary to-[#0a5a4c] rounded-3xl md:rounded-[40px] px-margin-mobile md:px-margin-desktop py-14 md:py-20 relative overflow-hidden text-center text-on-primary">
        <div class="max-w-2xl mx-auto relative z-10 space-y-8">
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-display-lg md:text-display-lg text-white">Bergabung Sekarang</h2>
          <p class="text-body-lg text-white/90 leading-relaxed max-w-lg mx-auto">
            Mari berikan yang terbaik untuk masa depan buah hati Anda dengan transportasi sekolah yang aman dan terpercaya. Konsultasikan kebutuhan antar-jemput Anda hari ini.
          </p>
          <div class="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <router-link to="/daftar">
              <button class="bg-white text-primary px-8 py-4 rounded-xl font-label-md text-lg hover:bg-surface transition-all shadow-lg active:scale-95 border-0 cursor-pointer">
                Mulai Sekarang
              </button>
            </router-link>
            <a href="https://wa.me/6281213668215" target="_blank">
              <button class="border-2 border-solid border-white text-white px-8 py-4 rounded-xl font-label-md text-lg hover:bg-white/10 transition-all active:scale-95 bg-transparent cursor-pointer">
                Hubungi Kami
              </button>
            </a>
          </div>
        </div>
      </section>

    </main>

    <FooterPublik />

    </div>

  </div>
</template>
