<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { 
  Bus, Menu, X, Bell, User,
  ChevronRight, Eye, Rocket, CheckCircle, 
  MapPin, Gavel, ShieldCheck, Shield,
  Mail, Phone
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
</script>

<template>
  <div class="bg-background text-on-surface font-body-md overflow-x-hidden min-h-screen pt-20">
    
    <!-- TopNavBar -->
    <nav class="w-full top-0 sticky z-50 bg-surface dark:bg-surface-container-lowest border-b border-solid border-outline-variant dark:border-outline shadow-none">
      <div class="flex justify-between items-center px-margin-desktop py-4 max-w-[1280px] mx-auto">
        <!-- Logo -->
        <div class="font-headline-md text-headline-md font-bold text-primary dark:text-on-surface flex items-center cursor-pointer" @click="navigasiKe('/')">
          <Bus class="h-7 w-7 text-primary mr-2 animate-pulse" />
          <span>Denanta<span class="text-[#0D7A68]">TS</span></span>
        </div>
        
        <!-- Desktop Menu -->
        <div class="hidden md:flex gap-xl items-center">
          <router-link to="/" class="text-secondary dark:text-on-secondary-fixed-variant font-body-md text-body-md hover:text-primary dark:hover:text-on-surface transition-colors cursor-pointer">Beranda</router-link>
          <router-link to="/tentang" class="text-primary dark:text-on-surface font-bold border-b-2 border-primary font-body-md text-body-md transition-colors cursor-pointer">Tentang Kami</router-link>
          <router-link to="/berlangganan" class="text-secondary dark:text-on-secondary-fixed-variant font-body-md text-body-md hover:text-primary dark:hover:text-on-surface transition-colors cursor-pointer">Berlangganan</router-link>
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
              class="bg-primary-container text-on-primary py-2 px-6 rounded-xl font-label-md hover:brightness-90 transition-all cursor-pointer border-0"
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
              class="bg-primary-container text-on-primary py-2 px-6 rounded-xl font-label-md hover:brightness-90 transition-all cursor-pointer text-center"
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
        <router-link to="/" @click="menuTerbuka = false" class="block text-on-surface-variant hover:text-primary py-1.5">Beranda</router-link>
        <router-link to="/tentang" @click="menuTerbuka = false" class="block text-primary font-semibold py-1.5">Tentang Kami</router-link>
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
              class="w-full bg-primary text-white py-2.5 rounded-xl text-center font-semibold block border-0"
            >
              Daftar / Berlangganan
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Page Header Banner -->
    <header class="relative bg-secondary-container py-16 px-margin-desktop overflow-hidden">
      <div class="max-w-[1280px] mx-auto relative z-10 text-left">
        <nav class="mb-4 flex items-center gap-2 text-label-md text-primary font-label-md">
          <router-link to="/" class="hover:underline">Beranda</router-link>
          <ChevronRight class="w-3.5 h-3.5" />
          <span class="text-secondary font-normal">Tentang Kami</span>
        </nav>
        <h1 class="font-display-lg text-display-lg text-on-surface mb-4">Tentang Kami</h1>
        <p class="font-body-lg text-body-lg text-secondary max-w-2xl leading-relaxed">
          Solusi transportasi sekolah modern yang mengedepankan keamanan, transparansi, dan kenyamanan bagi anak-anak serta ketenangan pikiran bagi orang tua di Kota Padang.
        </p>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="max-w-[1280px] mx-auto px-margin-desktop py-20 space-y-32">
      
      <!-- Section: Sejarah -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-20 items-center relative text-left">
        <div class="relative">
          <div class="dotted-curve w-full h-full absolute -bottom-8 -right-8 opacity-20"></div>
          <div class="aspect-square rounded-2xl overflow-hidden soft-shadow relative z-10">
            <img 
              class="w-full h-full object-cover" 
              alt="Denanta Team" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzDcWkThecrEpyY4wd-GfNzM8AaM0hRlOpVknugsrCHCAzHaoWxpMEgURSkzC7yHpcidiHz9G1n6Dm0EOTysgukqVNm_l_kyVDCuqtSbXfZQTXSDJ2JyDt_H9It5NpAZh4k0bOSxzOrExb_QI9YgZw8Q93JBXqNlvFHWns25Po9PtuigtWFieOtcezIboRHJMbfuI3h-U2FrNC5JfAUErgWEVtVE9Bno7BureFC1bIa3Rk3Q-jZqi5wRTxA5ffC4_iuSxiCEEUPkA"
            >
          </div>
        </div>
        <div class="space-y-6">
          <span class="text-primary font-label-md uppercase tracking-widest block">Perjalanan Kami</span>
          <h2 class="font-headline-lg text-headline-lg text-on-surface">Sejarah Kami</h2>
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
      <section class="grid grid-cols-1 md:grid-cols-2 gap-gutter text-left">
        <!-- Visi Card -->
        <div class="bg-surface-container-lowest p-10 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-start gap-6 transition-transform hover:-translate-y-1 duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center text-primary">
            <Eye class="w-8 h-8" />
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface">Visi</h3>
          <p class="text-body-lg text-secondary leading-relaxed">
            Menjadi standar emas transportasi anak yang paling terpercaya dan inovatif di Sumatera Barat, menciptakan ekosistem perjalanan sekolah yang tanpa hambatan, aman secara mutlak, dan ramah bagi perkembangan anak.
          </p>
        </div>
        <!-- Misi Card -->
        <div class="bg-surface-container-lowest p-10 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-start gap-6 transition-transform hover:-translate-y-1 duration-300">
          <div class="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center text-primary">
            <Rocket class="w-8 h-8" />
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface">Misi</h3>
          <ul class="space-y-4 text-body-lg text-secondary list-none p-0 m-0">
            <li class="flex gap-3 items-start">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Menyediakan armada transportasi yang selalu dalam kondisi prima dan memenuhi standar keamanan tertinggi.</span>
            </li>
            <li class="flex gap-3 items-start">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Memberikan transparansi penuh kepada orang tua melalui integrasi teknologi pelacakan canggih.</span>
            </li>
            <li class="flex gap-3 items-start">
              <CheckCircle class="text-primary w-6 h-6 shrink-0 mt-0.5" />
              <span>Merekrut dan melatih pengemudi yang tidak hanya ahli berkendara, tetapi juga memiliki etika dan keramahan tinggi.</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Section: Area Layanan -->
      <section class="text-center space-y-12">
        <div class="space-y-2">
          <h2 class="font-headline-lg text-headline-lg text-on-surface">Area Layanan</h2>
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
          <span class="px-6 py-2 bg-secondary-container text-primary rounded-full font-label-md border border-solid border-primary/10">Koto Tangah</span>
          <span class="px-6 py-2 bg-secondary-container text-primary rounded-full font-label-md border border-solid border-primary/10">Padang Utara</span>
          <span class="px-6 py-2 bg-secondary-container text-primary rounded-full font-label-md border border-solid border-primary/10">Padang Barat</span>
          <span class="px-6 py-2 bg-secondary-container text-primary rounded-full font-label-md border border-solid border-primary/10">Lubuk Begalung</span>
          <span class="px-6 py-2 bg-secondary-container text-primary rounded-full font-label-md border border-solid border-primary/10">Nanggalo</span>
        </div>
      </section>

      <!-- Section: Legalitas & Keamanan -->
      <section class="space-y-12">
        <div class="text-center">
          <h2 class="font-headline-lg text-headline-lg text-on-surface">Komitmen Keamanan &amp; Legalitas</h2>
          <p class="text-body-lg text-secondary mt-2">Kepercayaan Anda adalah prioritas tertinggi kami.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter text-center">
          <div class="bg-surface-container-lowest p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center text-primary mb-2">
              <Gavel class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Legalitas Usaha</h4>
            <p class="text-body-md text-secondary leading-relaxed">Terdaftar secara resmi sebagai entitas bisnis transportasi legal dengan seluruh izin operasional yang lengkap sesuai regulasi.</p>
          </div>
          <div class="bg-surface-container-lowest p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center text-primary mb-2">
              <ShieldCheck class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Verifikasi Driver</h4>
            <p class="text-body-md text-secondary leading-relaxed">Seluruh pengemudi melewati seleksi ketat, pemeriksaan latar belakang kriminal, dan tes kesehatan berkala untuk menjamin keselamatan.</p>
          </div>
          <div class="bg-surface-container-lowest p-8 rounded-2xl soft-shadow border border-solid border-outline-variant/30 flex flex-col items-center space-y-4">
            <div class="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center text-primary mb-2">
              <Shield class="w-8 h-8" />
            </div>
            <h4 class="font-title-lg text-title-lg text-on-surface">Asuransi Perjalanan</h4>
            <p class="text-body-md text-secondary leading-relaxed">Setiap perjalanan dilindungi oleh asuransi pihak ketiga untuk memberikan perlindungan finansial dan medis yang komprehensif.</p>
          </div>
        </div>
      </section>

      <!-- CTA Banner -->
      <section class="bg-primary-container rounded-[40px] px-margin-desktop py-20 relative overflow-hidden text-center text-on-primary">
        <div class="max-w-2xl mx-auto relative z-10 space-y-8">
          <h2 class="font-display-lg text-display-lg text-white">Bergabung Sekarang</h2>
          <p class="text-body-lg text-white/90 leading-relaxed max-w-lg mx-auto">
            Mari berikan yang terbaik untuk masa depan buah hati Anda dengan transportasi sekolah yang aman dan terpercaya. Konsultasikan kebutuhan antar-jemput Anda hari ini.
          </p>
          <div class="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <router-link to="/daftar">
              <button class="bg-white text-primary px-8 py-4 rounded-xl font-label-md text-lg hover:bg-surface transition-all shadow-lg active:scale-95 border-0 cursor-pointer">
                Mulai Sekarang
              </button>
            </router-link>
            <a href="https://wa.me/6281234567890" target="_blank">
              <button class="border-2 border-solid border-white text-white px-8 py-4 rounded-xl font-label-md text-lg hover:bg-white/10 transition-all active:scale-95 bg-transparent cursor-pointer">
                Hubungi Sales
              </button>
            </a>
          </div>
        </div>
      </section>

    </main>

    <!-- Footer -->
    <footer class="w-full mt-auto bg-surface-container-low dark:bg-surface-container-high border-t border-solid border-outline-variant dark:border-outline py-0">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-desktop py-12 max-w-[1280px] mx-auto text-left">
        <div class="col-span-1 md:col-span-1 space-y-4">
          <div class="text-headline-md font-headline-md font-bold text-primary dark:text-on-surface flex items-center">
            <Bus class="w-6 h-6 text-primary mr-2" />
            Denanta TranSolution
          </div>
          <p class="text-on-surface dark:text-on-surface-variant font-label-sm text-label-sm leading-relaxed max-w-xs">
            Pelopor solusi transportasi sekolah aman dan cerdas di Kota Padang. Membangun masa depan yang lebih baik melalui mobilitas yang terjamin.
          </p>
        </div>
        <div class="space-y-4">
          <h5 class="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">Perusahaan</h5>
          <ul class="space-y-2 text-on-surface dark:text-on-surface-variant font-label-sm text-label-sm list-none p-0 m-0">
            <li><router-link to="/" class="hover:underline transition-all cursor-pointer">Beranda</router-link></li>
            <li><router-link to="/tentang" class="text-primary font-bold hover:underline transition-all cursor-pointer">Tentang Kami</router-link></li>
            <li><a href="/#cara-kerja" class="hover:underline transition-all cursor-pointer">Cara Kerja</a></li>
            <li><a href="/#kontak" class="hover:underline transition-all cursor-pointer">Kontak</a></li>
          </ul>
        </div>
        <div class="space-y-4">
          <h5 class="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">Legal &amp; Support</h5>
          <ul class="space-y-2 text-on-surface dark:text-on-surface-variant font-label-sm text-label-sm list-none p-0 m-0">
            <li><a href="/#faq" class="hover:underline transition-all cursor-pointer">FAQ</a></li>
            <li><a class="hover:underline transition-all cursor-pointer" href="#">Kebijakan Privasi</a></li>
            <li><a class="hover:underline transition-all cursor-pointer" href="#">Syarat &amp; Ketentuan</a></li>
          </ul>
        </div>
        <div class="space-y-4">
          <h5 class="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">Kontak Kami</h5>
          <div class="space-y-3 text-on-surface dark:text-on-surface-variant font-label-sm text-label-sm">
            <div class="flex items-start gap-2">
              <MapPin class="text-primary w-4 h-4 shrink-0 mt-0.5" />
              <span>Jl. Khatib Sulaiman No. 123, Padang, Sumatera Barat</span>
            </div>
            <div class="flex items-center gap-2">
              <Mail class="text-primary w-4 h-4 shrink-0" />
              <span>info@denantatrans.com</span>
            </div>
            <div class="flex items-center gap-2">
              <Phone class="text-primary w-4 h-4 shrink-0" />
              <span>+62 751 123 4567</span>
            </div>
          </div>
        </div>
      </div>
      <div class="max-w-[1280px] mx-auto px-margin-desktop py-6 border-t border-solid border-outline-variant/30 text-center">
        <p class="text-on-surface dark:text-on-surface-variant font-label-sm text-label-sm">
          © {{ new Date().getFullYear() }} Denanta TranSolution. All rights reserved.
        </p>
      </div>
    </footer>

  </div>
</template>
