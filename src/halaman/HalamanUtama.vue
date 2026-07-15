<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { 
  Bus, Menu, X, Bell, User,
  ShieldCheck, MapPin, Clock, Check,
  HelpCircle, ChevronDown, Phone, Mail, Send, Loader2, CheckCircle,
  Instagram, Facebook, Share
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const menuTerbuka = ref(false);
const adaNotifikasi = ref(true);

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

const profilePath = computed(() => {
  if (authStore.apakahAdmin) return { path: '/admin', query: { tab: 'profil' } };
  if (authStore.apakahSupir) return { path: '/supir', query: { tab: 'profil' } };
  if (authStore.apakahOrangTua) return { path: '/orangtua', query: { tab: 'profil' } };
  return { path: '/' };
});

// Data FAQ Accordion
const faqList = ref([
  {
    tanya: 'Wilayah mana saja yang dicakup Denanta?',
    jawab: 'Kami saat ini melayani hampir seluruh wilayah di Kota Padang, Sumatra Barat, termasuk Kuranji, Padang Barat, Padang Timur, Padang Utara, Nanggalo, dan sekitarnya.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana protokol keamanan jika anak sakit?',
    jawab: 'Orang tua dapat menandai ketidakhadiran anak di aplikasi sebelum jadwal penjemputan. Supir akan mendapatkan notifikasi real-time dan rute akan otomatis dioptimalkan.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana metode pembayarannya?',
    jawab: 'Pembayaran dikelola aman secara online melalui Midtrans. Kami mendukung Transfer Bank (Virtual Account), Kartu Kredit, GoPay, ShopeePay, QRIS, serta pembayaran ritel di Alfamart/Indomaret.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana keamanan data dan privasi anak saya dijamin?',
    jawab: 'Kami menerapkan kebijakan Row-Level Security (RLS) di database PostgreSQL Supabase. Data posisi dan identitas anak Anda hanya bisa diakses oleh Anda, supir yang ditugaskan, dan administrator resmi.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana jika supir utama berhalangan hadir?',
    jawab: 'Sistem kami menyediakan opsi supir cadangan yang terdaftar dan terverifikasi untuk menggantikan rute tersebut guna memastikan anak Anda tetap terjemput tepat waktu.',
    terbuka: false
  },
  {
    tanya: 'Apakah saya bisa berhenti berlangganan sewaktu-waktu?',
    jawab: 'Ya, Anda bebas memilih paket bulanan atau harian, serta menonaktifkan atau mengubah status langganan Anda melalui dashboard orang tua kapan saja.',
    terbuka: false
  }
]);

const toggleFaq = (index: number) => {
  faqList.value[index].terbuka = !faqList.value[index].terbuka;
};

// Form Kontak
const namaForm = ref('');
const emailForm = ref('');
const pesanForm = ref('');
const sedangMengirim = ref(false);
const berhasilKirim = ref(false);

const tanganiKirimPesan = () => {
  if (!namaForm.value || !emailForm.value || !pesanForm.value) return;
  sedangMengirim.value = true;
  
  setTimeout(() => {
    sedangMengirim.value = false;
    berhasilKirim.value = true;
    namaForm.value = '';
    emailForm.value = '';
    pesanForm.value = '';
    
    setTimeout(() => {
      berhasilKirim.value = false;
    }, 5000);
  }, 1200);
};
</script>

<template>
  <div class="bg-background text-on-background font-body-md relative overflow-x-hidden min-h-screen pt-20">
    
    <!-- TopNavBar -->
    <nav class="bg-surface-container-lowest dark:bg-surface-dim border-b border-outline-variant/30 shadow-sm fixed top-0 left-0 w-full z-50">
      <div class="flex justify-between items-center px-margin-desktop py-4 max-w-[1280px] mx-auto">
        <!-- Logo -->
        <div class="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed flex items-center cursor-pointer" @click="navigasiKe('/')">
          <Bus class="h-7 w-7 text-primary mr-2 animate-pulse" />
          <span>Denanta<span class="text-[#0D7A68]">TS</span></span>
        </div>
        
        <!-- Desktop Menu -->
        <div class="hidden md:flex gap-6 items-center">
          <a @click="navigasiKe('/')" class="text-primary font-semibold border-b-2 border-primary pb-1 font-body-md text-body-md cursor-pointer">Beranda</a>
          <router-link to="/tentang" class="text-on-surface-variant font-medium font-body-md text-body-md hover:text-primary transition-colors duration-200 cursor-pointer">Tentang Kami</router-link>
          <router-link to="/berlangganan" class="text-on-surface-variant font-medium font-body-md text-body-md hover:text-primary transition-colors duration-200 cursor-pointer">Berlangganan</router-link>
        </div>

        <!-- Right Actions -->
        <div class="hidden md:flex items-center gap-4">
          <div v-if="authStore.sudahLogin" class="flex items-center gap-3">
            <!-- Notifikasi -->
            <div class="relative cursor-pointer text-slate-500 hover:text-primary transition-colors mr-2">
              <Bell class="w-5 h-5" />
              <span v-if="adaNotifikasi" class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-error"></span>
            </div>
            <!-- Profile Link -->
            <router-link
              :to="profilePath"
              class="p-2 rounded-full bg-brand-tosca-light hover:bg-[#D5F0EB] text-primary transition-colors flex items-center justify-center cursor-pointer"
              title="Edit Profil"
            >
              <User class="w-5 h-5" />
            </router-link>
            <!-- Dashboard Button -->
            <button 
              @click="navigasiDashboard" 
              class="bg-primary hover:bg-[#0D7A68] text-on-primary font-label-md text-label-md rounded-full px-5 py-2.5 transition-colors shadow-sm cursor-pointer border-0"
            >
              Dashboard
            </button>
          </div>
          <div v-else class="flex items-center gap-4">
            <router-link to="/login" class="text-on-surface-variant font-semibold hover:text-primary text-sm transition-colors">
              Masuk
            </router-link>
            <router-link 
              to="/daftar" 
              class="bg-primary hover:bg-[#0D7A68] text-on-primary font-label-md text-label-md rounded-full px-5 py-2.5 transition-colors shadow-sm cursor-pointer"
            >
              Daftar / Berlangganan
            </router-link>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <div class="md:hidden flex items-center gap-2">
          <!-- Notifikasi Mobile if logged in -->
          <div v-if="authStore.sudahLogin" class="relative cursor-pointer text-slate-500 hover:text-primary transition-colors p-2">
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
          </div>
          <button @click="toggleMenu" class="text-on-surface-variant hover:text-primary p-2 cursor-pointer border-0 bg-transparent">
            <Menu v-if="!menuTerbuka" class="w-6 h-6" />
            <X v-else class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Mobile Menu Drawer -->
      <div v-show="menuTerbuka" class="md:hidden bg-surface-container-lowest border-b border-outline-variant/30 py-4 px-margin-mobile space-y-3 shadow-md">
        <a @click="menuTerbuka = false" class="block text-primary font-semibold py-1.5 cursor-pointer">Beranda</a>
        <router-link to="/tentang" @click="menuTerbuka = false" class="block text-on-surface-variant hover:text-primary py-1.5">Tentang Kami</router-link>
        <router-link to="/berlangganan" @click="menuTerbuka = false" class="block text-on-surface-variant hover:text-primary py-1.5">Berlangganan</router-link>
        
        <div class="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
          <div v-if="authStore.sudahLogin" class="flex flex-col gap-2">
            <router-link
              :to="profilePath"
              @click="menuTerbuka = false"
              class="w-full bg-brand-tosca-light hover:bg-[#D5F0EB] text-primary py-2.5 rounded-xl text-center font-semibold flex items-center justify-center gap-2"
            >
              <User class="w-4 h-4" />
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
              to="/daftar"
              @click="menuTerbuka = false"
              class="w-full bg-primary hover:bg-[#0D7A68] text-white py-2.5 rounded-xl text-center font-semibold block"
            >
              Daftar / Berlangganan
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Background Accents -->
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary rounded-full opacity-[0.05] blur-3xl"></div>
      <div class="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-primary-container rounded-full opacity-[0.08] blur-3xl"></div>
      <div class="absolute top-[40%] right-[10%] opacity-10">
        <svg fill="none" height="100" viewbox="0 0 100 100" width="100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="2" cy="2" fill="#006b5a" r="2"></circle>
          <circle cx="2" cy="22" fill="#006b5a" r="2"></circle>
          <circle cx="2" cy="42" fill="#006b5a" r="2"></circle>
          <circle cx="22" cy="2" fill="#006b5a" r="2"></circle>
          <circle cx="22" cy="22" fill="#006b5a" r="2"></circle>
          <circle cx="22" cy="42" fill="#006b5a" r="2"></circle>
          <circle cx="42" cy="2" fill="#006b5a" r="2"></circle>
          <circle cx="42" cy="22" fill="#006b5a" r="2"></circle>
          <circle cx="42" cy="42" fill="#006b5a" r="2"></circle>
        </svg>
      </div>
    </div>

    <!-- Hero Section -->
    <section class="max-w-[1280px] mx-auto px-margin-desktop py-xl md:py-[80px] flex flex-col md:flex-row items-center gap-gutter relative z-10">
      <div class="md:w-1/2 flex flex-col gap-6 z-10 text-left">
        <h1 class="font-display-lg text-display-lg text-on-background tracking-tight leading-tight">
          Pantau Perjalanan Anak dengan <span class="text-primary">Aman &amp; Nyata</span> di Padang.
        </h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant max-w-lg leading-relaxed">
          Memberikan ketenangan pikiran bagi orang tua dengan layanan antar jemput sekolah yang profesional, terpantau secara real-time, dan mengutamakan keselamatan.
        </p>
        <div class="flex flex-wrap gap-4 mt-2">
          <router-link to="/daftar">
            <button class="bg-primary hover:bg-[#0D7A68] text-on-primary font-label-md text-label-md rounded-xl px-6 py-3 transition-colors shadow-md border-0 cursor-pointer">
              Daftar Sekarang
            </button>
          </router-link>
          <router-link to="/tentang">
            <button class="border-2 border-solid border-primary text-primary font-label-md text-label-md rounded-xl px-6 py-3 hover:bg-brand-tosca-light transition-colors bg-transparent cursor-pointer">
              Pelajari Lebih Lanjut
            </button>
          </router-link>
        </div>
      </div>
      <div class="md:w-1/2 relative">
        <div class="absolute inset-0 bg-primary-container rounded-full opacity-[0.05] blur-xl transform scale-110"></div>
        <img 
          alt="Sekolah van aman" 
          class="w-full h-auto object-contain relative z-10 rounded-xl soft-shadow" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAe-ugMKVt9E5FgbxlUMYfMaz-UFiNVbiOZuTjCV4X1dGYqb5ByvrgT0hag9gW446L6IVjK2wgVNd7t0PWMhfG3d89eR_ZiuwzPqDj9eFh1o7qDlRaaxJ9dt4QLXGwJcz03KNarEdJLJUmsfDDLMwgvkp4ZTz0M5Z0KF1DM3-2od3j7f4ElpW9sO1gLFeojDf6P7OerFUNqDh9cRdLT7kgYiWs-nxyQBPAVvvAVRkj919aLDNuGoYBatRP-7qjEpqpo24wpxko8cvE"
        />
      </div>
    </section>

    <!-- Keunggulan Section -->
    <section class="max-w-[1280px] mx-auto px-margin-desktop py-xl relative z-10">
      <div class="text-center mb-12">
        <h2 class="font-headline-lg text-headline-lg text-on-background mb-4">Mengapa Memilih Denanta?</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">Kami mengutamakan keamanan dan kenyamanan anak Anda dengan standar pelayanan terbaik.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mb-6 text-primary">
            <MapPin class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Live Tracking</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Pantau lokasi kendaraan secara langsung kapan saja di peta interaktif.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mb-6 text-primary">
            <ShieldCheck class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Driver Terverifikasi</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Pengemudi profesional dan terlatih melalui seleksi SKCK &amp; SIM yang ketat.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mb-6 text-primary">
            <Bell class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Notifikasi Real-time</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Terima pemberitahuan instan otomatis via WhatsApp saat anak dijemput &amp; sampai.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mb-6 text-primary">
            <Clock class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Tepat Waktu</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Jadwal penjemputan terencana dan optimal untuk efisiensi waktu perjalanan.</p>
        </div>
      </div>
    </section>

    <!-- Manfaat Section -->
    <section class="w-full bg-[#E6F7F4] py-24 relative z-10">
      <div class="max-w-[1280px] mx-auto px-margin-desktop grid grid-cols-1 md:grid-cols-2 items-center gap-16">
        <div class="order-2 md:order-1">
          <img 
            alt="Manfaat Layanan" 
            class="w-full h-auto rounded-xl soft-shadow" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAV33hEk4QkjvS09aHH3ExKDxjBuaz8vMVO0gS4820Uigj7gSpaJs_9yeFEOijSrqz3KnmvnQO12Ro3-oiWsdCLgBTda6Bji0A4Ji4r08bOKkwZj2XSA5ldyU13NapM3bOXEwUfW4Vbt4N5IeLIgZyscb2dHmwBzGD2ug8j-jIQwIcEeMKD80e6hQVpQVHILlOQ7I0JTA09pnqmIqI_w5NOaoVNRwdmWNZxcCf9D7vNhewz-KNaWiaTSvs2JBXxjrRblBAypMWpMj8"
          />
        </div>
        <div class="flex flex-col gap-8 order-1 md:order-2 text-left">
          <h2 class="font-headline-lg text-headline-lg text-on-background">Manfaat Utama Layanan Kami</h2>
          <div class="flex flex-col gap-6">
            <div class="flex items-start gap-4">
              <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 text-on-primary">
                <Check class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-title-lg text-title-lg text-on-background">Aman &amp; Terpercaya</h4>
                <p class="font-body-md text-on-surface-variant leading-relaxed">Kendaraan yang rutin diservis berkala dan pengemudi yang sudah melalui verifikasi latar belakang.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 text-on-primary">
                <Check class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-title-lg text-title-lg text-on-background">Tepat Waktu</h4>
                <p class="font-body-md text-on-surface-variant leading-relaxed">Rute perjalanan yang dioptimalkan secara cerdas memastikan anak Anda sampai di sekolah tepat waktu.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 text-on-primary">
                <Check class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-title-lg text-title-lg text-on-background">Mudah Dipantau</h4>
                <p class="font-body-md text-on-surface-variant leading-relaxed">Gunakan dashboard khusus untuk melihat posisi anak Anda dalam perjalanan secara langsung dan akurat.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Cara Kerja Section -->
    <span id="cara-kerja" class="block relative -top-24"></span>
    <section class="max-w-[1280px] mx-auto px-margin-desktop py-24 relative overflow-hidden z-10">
      <div class="text-center mb-20">
        <h2 class="font-headline-lg text-headline-lg mb-4 text-on-background">Cara Kerja Kami</h2>
        <p class="font-body-lg text-on-surface-variant">Langkah mudah untuk memulai layanan antar jemput Denanta.</p>
      </div>
      <div class="relative flex flex-col md:flex-row justify-between items-start gap-12 md:gap-0">
        <!-- Connector Line -->
        <div class="hidden md:block absolute top-10 left-[10%] right-[10%] border-t-2 border-dashed border-primary/30 z-0"></div>
        <!-- Step 1 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg border-4 border-solid border-white">1</div>
          <h4 class="font-title-lg mb-2 text-on-background">Pendaftaran</h4>
          <p class="font-body-md text-on-surface-variant px-4">Lengkapi formulir pendaftaran dan tentukan lokasi penjemputan di peta.</p>
        </div>
        <!-- Step 2 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg border-4 border-solid border-white">2</div>
          <h4 class="font-title-lg mb-2 text-on-background">Penjadwalan</h4>
          <p class="font-body-md text-on-surface-variant px-4">Tim kami akan mengatur rute dan mencocokkan jadwal supir terdekat.</p>
        </div>
        <!-- Step 3 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg border-4 border-solid border-white">3</div>
          <h4 class="font-title-lg mb-2 text-on-background">Penjemputan</h4>
          <p class="font-body-md text-on-surface-variant px-4">Driver menjemput anak Anda sesuai jadwal dengan armada resmi dan aman.</p>
        </div>
        <!-- Step 4 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg border-4 border-solid border-white">4</div>
          <h4 class="font-title-lg mb-2 text-on-background">Pantau Real-time</h4>
          <p class="font-body-md text-on-surface-variant px-4">Terima notifikasi WhatsApp dan pantau perjalanan anak lewat web maps.</p>
        </div>
      </div>
    </section>

    <!-- Estimasi Biaya Section -->
    <section class="max-w-[1280px] mx-auto px-margin-desktop py-24 relative z-10">
      <div class="text-center mb-16">
        <h2 class="font-headline-lg text-headline-lg mb-4 text-on-background">Estimasi Biaya</h2>
        <p class="font-body-lg text-on-surface-variant">Pilih paket layanan yang sesuai dengan kebutuhan Anda.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-4xl mx-auto items-stretch">
        <!-- Card 1 -->
        <div class="bg-surface-container-lowest border border-solid border-outline-variant rounded-xl p-6 flex flex-col soft-shadow justify-between text-left">
          <div>
            <h3 class="font-headline-md text-headline-md mb-2 text-on-background">Antar Jemput (PP)</h3>
            <div class="flex items-baseline gap-1 mb-6">
              <span class="text-3xl font-bold text-primary">Rp 450.000</span>
              <span class="text-on-surface-variant text-sm">/bulan</span>
            </div>
            <ul class="flex flex-col gap-3 mb-6">
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Antar pagi &amp; Jemput siang/sore</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Laporan perjalanan harian</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Asuransi perlindungan jiwa</span>
              </li>
            </ul>
          </div>
          <router-link to="/berlangganan">
            <button class="w-full border-2 border-solid border-primary text-primary font-label-md py-3 rounded-xl hover:bg-brand-tosca-light transition-colors bg-transparent cursor-pointer">
              Pilih Paket
            </button>
          </router-link>
        </div>

        <!-- Card 2 -->
        <div class="bg-primary text-on-primary rounded-xl p-6 flex flex-col shadow-xl relative z-10 justify-between text-left">
          <div class="absolute -top-4 right-6 bg-warnaTombol text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">POPULER</div>
          <div>
            <h3 class="font-headline-md text-headline-md mb-2 text-white">Antar / Jemput Saja</h3>
            <div class="flex items-baseline gap-1 mb-6">
              <span class="text-3xl font-bold text-white">Rp 250.000</span>
              <span class="opacity-80 text-sm">/bulan</span>
            </div>
            <ul class="flex flex-col gap-3 mb-6">
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Hanya Antar atau Hanya Jemput</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Notifikasi real-time via WA</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Layanan darurat 24/7</span>
              </li>
            </ul>
          </div>
          <router-link to="/berlangganan">
            <button class="w-full bg-white text-primary font-label-md py-3 rounded-xl hover:bg-surface-container-low transition-colors shadow-md border-0 cursor-pointer">
              Pilih Paket
            </button>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Testimoni Section -->
    <section class="max-w-[1280px] mx-auto px-margin-desktop py-24 relative z-10">
      <div class="text-center mb-16">
        <h2 class="font-headline-lg text-headline-lg mb-4 text-on-background">Apa Kata Orang Tua</h2>
        <p class="font-body-lg text-on-surface-variant">Kisah nyata kenyamanan dan ketenangan dari pengguna setia kami.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <!-- Testi 1 -->
        <div class="bg-surface-container-lowest p-8 rounded-xl soft-shadow border border-solid border-outline-variant/30 italic flex flex-col justify-between text-left">
          <p class="font-body-md mb-6 text-on-background">"Sangat terbantu dengan Denanta. Sekarang tidak perlu khawatir lagi kalau saya lembur kerja, karena posisi anak bisa dipantau lewat aplikasi secara real-time."</p>
          <div class="flex items-center gap-4 not-italic">
            <img alt="Bunda Sarah" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAS7Fl4QeGHQHhLEMakUJ-rh-JdwWnkXYpbdMOcr6CIMWZi1qg_v9Up5D9SqXRmSX14w8jHvnj5UaG5LOjoB1CpcFbQOuSwDk8fcdA3f12RGlM_q62zD1TfAVkQl-C4bBkXGqsqRB9kPwY80rdzhXjFSBo_RwiOaK8hxPOcluFJnDrO8U3HWkQ6PMmew0xI1T5iAn3_z9-HI_hli5JCPNSBNgxdR4UAuP4dtwZncnu8XXPR6cfWRHFWiAlep9jv1D40XSZQKW0tA2Q"/>
            <div>
              <p class="font-label-md font-bold text-on-background">Ibu Sarah</p>
              <p class="text-[11px] text-on-surface-variant">Orang Tua Murid (SD N 01 Padang)</p>
            </div>
          </div>
        </div>
        <!-- Testi 2 -->
        <div class="bg-surface-container-lowest p-8 rounded-xl soft-shadow border border-solid border-outline-variant/30 italic flex flex-col justify-between text-left">
          <p class="font-body-md mb-6 text-on-background">"Driver-nya ramah dan mobilnya selalu bersih. Anak saya jadi selalu semangat berangkat sekolah tepat waktu setiap pagi tanpa drama."</p>
          <div class="flex items-center gap-4 not-italic">
            <img alt="Pak Budi" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYST3mOceaUuJu4u9SdaUTAH0MtOehHzBjG2RYzAVlJiuLfB00-TnpkqT6AfGPLIlBW1a_Bpejj2j6Nowtrd13viZJBPOIRnaFEYVdjZ9tcHAhl1W3o0syyaq_GQxtVAOw5UE5mA-QYJiWESl255E5LsscRzzu0ORH1Ni8L3Ldk270i4BRR1Bkc6sEfM4tkVPeRV4dQGHkj62K7zrYLyHD96CCOZP3r9sJsfnlNABS-YtKSIp9d-7lSBmMXCc6uPkHeofwXdLQ510"/>
            <div>
              <p class="font-label-md font-bold text-on-background">Bapak Budi</p>
              <p class="text-[11px] text-on-surface-variant">Orang Tua Murid (SMP N 1 Padang)</p>
            </div>
          </div>
        </div>
        <!-- Testi 3 -->
        <div class="bg-surface-container-lowest p-8 rounded-xl soft-shadow border border-solid border-outline-variant/30 italic flex flex-col justify-between text-left">
          <p class="font-body-md mb-6 text-on-background">"Cucu saya aman terjaga perjalanannya. Tim admin Denanta sangat kooperatif memberi informasi cepat jika ada kendala cuaca di jalan."</p>
          <div class="flex items-center gap-4 not-italic">
            <img alt="Oma Dewi" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuANMJx6HBT0cmmTHDqH5XO7tJvWRPO53Iqj_TEjwg84_DKZrEKEecnfDdvB5AUykmK1SMXXGYyreehpISI4zooPlL3515umtPyzEd5lXm7xI4q5Rj17X4IqpI_lVefFNF5FGiwZ9lSwe4XYCav8xUCwLAOg6qGN47cUFLxkm15E6q9LQ4iyE-1Y5jFE-L0NXZpQYXloxyvYyUXM0ZFIJfamYIoIMfWL9g-bDtb712wy-4IFkIuzl9JI_LMH9kWpp6CpdUS-ANaPqc8"/>
            <div>
              <p class="font-label-md font-bold text-on-background">Oma Dewi</p>
              <p class="text-[11px] text-on-surface-variant">Keluarga Murid (SMA N 2 Padang)</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <span id="faq" class="block relative -top-24"></span>
    <section class="max-w-[800px] mx-auto px-margin-desktop py-24 relative z-10">
      <div class="text-center mb-12">
        <h2 class="font-headline-lg text-headline-lg text-on-background">Pertanyaan Umum (FAQ)</h2>
        <p class="text-on-surface-variant font-body-md mt-2">Dapatkan jawaban instan terkait layanan dan teknis Denanta.</p>
      </div>
      <div class="flex flex-col gap-4">
        <!-- FAQ Loop -->
        <div 
          v-for="(faq, index) in faqList" 
          :key="index"
          class="border-b border-solid border-outline-variant py-4 text-left"
        >
          <div 
            @click="toggleFaq(index)" 
            class="flex justify-between items-center cursor-pointer group"
          >
            <h4 class="font-title-lg text-on-background group-hover:text-primary transition-colors flex items-center gap-2">
              <HelpCircle class="w-5 h-5 text-primary shrink-0" />
              {{ faq.tanya }}
            </h4>
            <ChevronDown 
              class="text-primary w-5 h-5 transition-transform duration-300"
              :class="{ 'rotate-180': faq.terbuka }"
            />
          </div>
          <div 
            v-show="faq.terbuka" 
            class="mt-3 text-on-surface-variant font-body-md pl-7 leading-relaxed bg-[#E6F7F4]/30 p-3 rounded-lg border border-solid border-brand-tosca-light"
          >
            {{ faq.jawab }}
          </div>
        </div>
      </div>
    </section>

    <!-- Kontak Section -->
    <span id="kontak" class="block relative -top-24"></span>
    <section class="w-full bg-[#E6F7F4] py-24 relative z-10">
      <div class="max-w-[1280px] mx-auto px-margin-desktop grid grid-cols-1 md:grid-cols-2 gap-16">
        <!-- Kirim Pesan Form -->
        <div class="bg-surface-container-lowest p-8 md:p-10 rounded-xl shadow-lg border border-solid border-white text-left relative overflow-hidden">
          <h2 class="font-headline-md text-headline-md mb-8 text-on-background">Kirim Pesan</h2>
          
          <!-- Success Notification -->
          <div v-if="berhasilKirim" class="mb-6 bg-emerald-50 border border-solid border-emerald-300 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold text-emerald-800 text-sm">Pesan Terkirim!</p>
              <p class="text-xs text-emerald-700 mt-0.5">Terima kasih. Tim kami akan segera merespons pesan Anda via email.</p>
            </div>
          </div>

          <form class="flex flex-col gap-6" @submit.prevent="tanganiKirimPesan">
            <div>
              <label class="font-label-md block mb-2 text-on-background">Nama Lengkap</label>
              <input 
                v-model="namaForm"
                required
                placeholder="Masukkan nama Anda"
                class="w-full border border-solid border-outline-variant rounded-xl p-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white text-on-background" 
                type="text"
              />
            </div>
            <div>
              <label class="font-label-md block mb-2 text-on-background">Email</label>
              <input 
                v-model="emailForm"
                required
                placeholder="nama@email.com"
                class="w-full border border-solid border-outline-variant rounded-xl p-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white text-on-background" 
                type="email"
              />
            </div>
            <div>
              <label class="font-label-md block mb-2 text-on-background">Pesan</label>
              <textarea 
                v-model="pesanForm"
                required
                placeholder="Tulis pesan atau pertanyaan Anda di sini..."
                class="w-full border border-solid border-outline-variant rounded-xl p-3 h-32 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white text-on-background"
              ></textarea>
            </div>
            <button 
              type="submit"
              :disabled="sedangMengirim"
              class="bg-primary text-on-primary font-label-md py-4 rounded-xl shadow-md hover:bg-[#0D7A68] transition-colors border-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <Loader2 v-if="sedangMengirim" class="w-5 h-5 animate-spin" />
              <Send v-else class="w-4 h-4" />
              <span>{{ sedangMengirim ? 'Mengirim...' : 'Kirim Pesan' }}</span>
            </button>
          </form>
        </div>

        <!-- Hubungi Kami Info -->
        <div class="flex flex-col gap-10 text-left justify-center">
          <div>
            <h2 class="font-headline-md text-headline-md mb-4 text-on-background">Hubungi Kami</h2>
            <p class="font-body-lg text-on-surface-variant leading-relaxed">Tim customer support kami selalu siap membantu Anda memberikan solusi antar jemput anak sekolah terbaik.</p>
          </div>
          <div class="flex flex-col gap-6">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary soft-shadow shrink-0">
                <Phone class="w-6 h-6" />
              </div>
              <div>
                <p class="text-label-md text-on-surface-variant">WhatsApp Kami</p>
                <a href="https://wa.me/6281234567890" target="_blank" class="font-title-lg text-on-background hover:text-primary transition-colors">+62 812-3456-7890</a>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary soft-shadow shrink-0">
                <Mail class="w-6 h-6" />
              </div>
              <div>
                <p class="text-label-md text-on-surface-variant">Email Resmi</p>
                <a href="mailto:halo@denanta.com" class="font-title-lg text-on-background hover:text-primary transition-colors">halo@denanta.com</a>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary soft-shadow shrink-0">
                <Share class="w-6 h-6 text-primary" />
              </div>
              <div class="flex gap-4 items-center">
                <a class="text-on-surface-variant hover:text-primary transition-colors cursor-pointer" href="#"><Instagram class="w-6 h-6" /></a>
                <a class="text-on-surface-variant hover:text-primary transition-colors cursor-pointer" href="#"><Facebook class="w-6 h-6" /></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-surface-container-lowest dark:bg-surface-dim border-t border-solid border-outline-variant/30 w-full py-16 relative z-10">
      <div class="flex flex-col md:flex-row justify-between items-start px-margin-desktop gap-gutter max-w-[1280px] mx-auto text-left">
        <div class="flex flex-col gap-4">
          <span class="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed flex items-center">
            <Bus class="h-6 w-6 text-primary mr-2" />
            Denanta TranSolution
          </span>
          <span class="font-body-md text-body-md text-on-surface-variant max-w-sm leading-relaxed">Memberikan solusi mobilitas yang aman, cerdas, dan terpercaya bagi generasi masa depan di Padang.</span>
          <span class="font-body-md text-body-md text-on-surface-variant mt-4">© {{ new Date().getFullYear() }} Denanta TranSolution. All rights reserved.</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-12">
          <div class="flex flex-col gap-4">
            <h5 class="font-label-md font-bold text-on-background">Perusahaan</h5>
            <router-link to="/tentang" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Tentang Kami</router-link>
            <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors cursor-pointer" href="#">Karir</a>
            <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors cursor-pointer" href="#">Mitra</a>
          </div>
          <div class="flex flex-col gap-4">
            <h5 class="font-label-md font-bold text-on-background">Layanan</h5>
            <router-link to="/berlangganan" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Antar Jemput</router-link>
            <router-link to="/berlangganan" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Aplikasi Ortu</router-link>
            <router-link to="/berlangganan" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Rute</router-link>
          </div>
          <div class="flex flex-col gap-4">
            <h5 class="font-label-md font-bold text-on-background">Bantuan</h5>
            <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors" href="#faq">FAQ</a>
            <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors" href="#kontak">Kontak</a>
            <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors cursor-pointer" href="#">Privasi</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
