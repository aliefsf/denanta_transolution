<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import { useAuth } from '../komposabel/useAuth';
import FooterPublik from '../komponen/umum/FooterPublik.vue';
import ModalUtama from '../komponen/umum/ModalUtama.vue';
import { ambilPengaturanTarif, type PengaturanTarifRow } from '../layanan/tarifLayanan';
import { formatMataUang } from '../bantuan/formatMataUang';
import { kelasMenuNavbar, kelasMenuNavbarMobile } from '../bantuan/kelasMenuNavbar';
import {
  Menu, X, Bell, User, LogOut,
  ShieldCheck, MapPin, Clock, Check,
  HelpCircle, ChevronDown
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { isAuthenticated, userProfile } = useAuth();
const menuTerbuka = ref(false);
const adaNotifikasi = ref(true);

// Navbar transparan MENYATU dengan background hero -- HANYA berlaku di
// mobile (di-override balik solid lewat class md: di template) dan HANYA
// selagi scroll masih berada di area hero (background image + overlay
// gelap-nya cuma setinggi hero, lihat tinggiHeroMobile di bawah). Begitu
// discroll melewati hero, latar di baliknya berubah putih (section
// Keunggulan dst) -- navbar WAJIB balik solid di titik itu juga, kalau
// tidak logo/ikon putih jadi tidak kebaca di atas latar putih.
const scrollY = ref(0);
const tanganiScroll = () => { scrollY.value = window.scrollY; };
onMounted(() => {
  window.addEventListener('scroll', tanganiScroll, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener('scroll', tanganiScroll);
});
// Sedikit lebih pendek dari tinggi background hero mobile (lihat
// min-h-[580px] pada <section> Hero) supaya transisi ke solid terjadi
// SEBELUM tepi bawah gambar (yang sudah memudar ke warna background lewat
// overlay gradien) sempat terlihat berbenturan dengan navbar solid.
const navMasihTransparan = computed(() => scrollY.value < 470);

// Efek "pill" aktif pada menu navbar mengikuti rute yang sedang dibuka --
// dinamis lewat useRoute() (bukan ditulis statis per halaman) supaya kalau
// suatu saat menu ini ditambah/route berubah, status aktifnya tidak perlu
// disetel manual satu-satu dan otomatis benar begitu pengguna berpindah
// halaman.
const kelasMenuBeranda = computed(() => kelasMenuNavbar(route.path === '/'));
const kelasMenuTentang = computed(() => kelasMenuNavbar(route.path === '/tentang'));
const kelasMenuLangganan = computed(() => kelasMenuNavbar(route.path === '/berlangganan'));
const kelasMenuBerandaMobile = computed(() => kelasMenuNavbarMobile(route.path === '/'));
const kelasMenuTentangMobile = computed(() => kelasMenuNavbarMobile(route.path === '/tentang'));
const kelasMenuLangganganMobile = computed(() => kelasMenuNavbarMobile(route.path === '/berlangganan'));

// Kartu harga "Estimasi Biaya" di landing page -- SEBELUMNYA angka statis
// tertulis langsung di teks ("Rp 475.000"/"Rp 275.000"), tidak ikut berubah
// kalau Admin mengubah tarif lewat Kelola Tarif. Sekarang dibaca live dari
// pengaturan_tarif (sama seperti KalkulatorBiaya.vue/wizard berlangganan)
// supaya harga yang ditampilkan ke calon pelanggan selalu sesuai konfigurasi
// terbaru. Fallback ke nilai default lama bila gagal dimuat (mis. offline).
const tarifPublik = ref<PengaturanTarifRow | null>(null);
const hargaAntarJemput = computed(() => formatMataUang(tarifPublik.value?.tarif_antar_jemput ?? 475000));
const hargaAntarSaja = computed(() => formatMataUang(tarifPublik.value?.tarif_antar_saja ?? 275000));

onMounted(async () => {
  try {
    tarifPublik.value = await ambilPengaturanTarif();
  } catch {
    // Biarkan tampil harga default (fallback di atas) bila gagal dimuat
  }
});

// Carousel gambar Hero -- bergantian tiap 10 detik dengan transisi fade
// (lihat <Transition name="fade-hero"> di template). File disalin ke
// public/aset/ (nama file tanpa spasi) supaya bisa diakses langsung sebagai
// URL statis oleh Vite, tanpa perlu di-import satu-satu.
const gambarHero = ['/aset/gambar-1.png', '/aset/gambar-2.png', '/aset/gambar-3.png', '/aset/gambar-4.png'];
const indeksGambarHero = ref(0);
let timerGambarHero: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timerGambarHero = setInterval(() => {
    indeksGambarHero.value = (indeksGambarHero.value + 1) % gambarHero.length;
  }, 10000);
});

onUnmounted(() => {
  if (timerGambarHero) clearInterval(timerGambarHero);
});

const toggleMenu = () => {
  menuTerbuka.value = !menuTerbuka.value;
};

const navigasiKe = (path: string) => {
  router.push(path);
  menuTerbuka.value = false;
};

const modalLogoutTampil = ref(false);
const sedangLogout = ref(false);

const bukaKonfirmasiLogout = () => {
  menuTerbuka.value = false;
  modalLogoutTampil.value = true;
};

const konfirmasiLogoutMobile = async () => {
  sedangLogout.value = true;
  try {
    await authStore.logout();
    modalLogoutTampil.value = false;
    router.push('/');
  } finally {
    sedangLogout.value = false;
  }
};

// Ikon lonceng notifikasi navbar publik -- arahkan ke tab "Notifikasi" di
// dashboard sesuai peran pengguna yang sedang login (bukan halaman
// tersendiri, notifikasi memang cuma ada sebagai tab di masing-masing
// panel dashboard, lihat TataLetakOrangTua.vue/TataLetakSupir.vue/
// TataLetakAdmin.vue).
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

// Tombol CTA utama Hero -- 3 kondisi mengikuti status akun: belum login ->
// "Daftar Sekarang" (ke /daftar), sudah login tapi belum ada anak
// berlangganan aktif -> "Berlangganan Sekarang" (ke /berlangganan), sudah
// ada anak berlangganan aktif -> "Pantau Sekarang" (langsung ke tab Pantau
// Anak di dashboard, bukan cuma dashboard umum -- beda dari
// bukaMenuLangganan di navbar yang sengaja berhenti di dashboard). Ketiganya
// reaktif terhadap authStore.sudahLogin/sudahBerlangganan (di-refresh oleh
// authStore.periksaStatusBerlangganan() setelah login/logout/pembayaran),
// jadi label & tujuan otomatis berubah tanpa reload halaman.
const labelTombolHero = computed(() => {
  if (!authStore.sudahLogin) return 'Daftar Sekarang';
  return sudahAktifBerlangganan.value ? 'Pantau Sekarang' : 'Berlangganan Sekarang';
});

const bukaTombolHero = () => {
  if (!authStore.sudahLogin) {
    router.push('/daftar');
  } else if (sudahAktifBerlangganan.value) {
    router.push({ path: '/orangtua', query: { tab: 'pantau' } });
  } else {
    router.push('/berlangganan');
  }
};

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
    jawab: 'Data posisi dan identitas anak Anda dijaga ketat dan hanya bisa diakses oleh Anda, supir yang ditugaskan, dan administrator resmi -- tidak pernah dibagikan ke pihak lain.',
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

const namaPengguna = computed(() => {
  return userProfile.value?.nama || 
         authStore.pengguna?.user_metadata?.nama_lengkap || 
         authStore.pengguna?.nama_lengkap || 
         authStore.pengguna?.email?.split('@')[0] || 
         'Pengguna';
});
</script>

<template>
  <!-- Sidebar mobile "mendorong" konten (bukan overlay) -- transform di sini
       PENTING -- pembungkus PALING LUAR ini SENGAJA TIDAK diberi transform
       geser sama sekali (beda dari versi sebelumnya). Alasannya: transform
       pada elemen manapun otomatis menjadikannya containing-block BARU bagi
       seluruh descendant fixed/absolute di dalamnya (aturan CSS) -- kalau
       diterapkan di sini, background+overlay header (absolute, lihat di
       bawah) ikut kena reparenting itu tiap kali sidebar dibuka/ditutup,
       dan pada sebagian browser mobile itu menyebabkan overlay semi-
       transparan sekilas hilang/lebih terang (bug yang dilaporkan). Supaya
       background+overlay ini 100% kebal dari status sidebar, transform
       geser sekarang dipasang TERPISAH: langsung di <nav> (lihat di bawah,
       aman -- nav tidak punya descendant fixed) dan di pembungkus konten
       "kontenGeser" yang membungkus Background Accents s.d. Footer (juga
       aman, tidak ada descendant fixed penting di situ). -->
  <div class="bg-background text-on-background font-body-md relative overflow-x-hidden min-h-screen pt-24">

    <!-- Background image header (HANYA mobile/md:hidden) -- SELALU statis,
         tidak pernah ikut transform apa pun (lihat catatan di atas) --
         inilah yang memastikan overlay gelapnya tidak pernah hilang/berubah
         terang gara-gara sidebar dibuka. Memakai carousel
         & transisi fade yang SAMA PERSIS dengan galeri desktop di Hero
         Section (gambarHero/indeksGambarHero, satu sumber data, bukan aset
         terpisah). Sengaja diletakkan di LUAR <section> Hero (top:0 relatif
         ke pembungkus terluar ini, mengabaikan pt-24 miliknya -- itulah
         kenapa div ini WAJIB anak langsung dari pembungkus ber-position:
         relative di atas, bukan dari <section> yang mulai SETELAH jarak
         pt-24) supaya areanya mencakup navbar (yang fixed, dibuat
         transparan lewat navMasihTransparan) sekaligus, bukan cuma mulai
         dari hero -- navbar & hero jadi terlihat menyatu dalam satu
         background yang sama, bukan ada jeda putih di antara keduanya.
         Tingginya = tinggi navbar (pt-24 = 6rem) + tinggi hero mobile
         (min-h-[580px] pada <section> Hero di bawah). -->
    <div class="md:hidden absolute top-0 left-0 right-0 h-[calc(6rem+580px)] z-0 bg-black">
      <Transition name="fade-hero">
        <img
          :key="indeksGambarHero"
          :src="gambarHero[indeksGambarHero]"
          alt="Denanta TranSolution"
          class="absolute inset-0 w-full h-full object-cover"
        />
      </Transition>
      <!-- Overlay MERATA (bukan cuma menggelapkan bagian bawah) supaya
           tingkat gelap navbar & hero konsisten -- lapisan gelap flat di
           atas seluruh gambar, ditambah gradien halus di tepi bawah saja
           utk transisi mulus ke warna background section berikutnya. -->
      <div class="absolute inset-0 bg-black/45"></div>
      <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"></div>
    </div>

    <!-- TopNavBar -- transform geser dipasang LANGSUNG di sini (bukan
         diwariskan dari ancestor) supaya navbar tetap ikut bergeser saat
         sidebar dibuka TANPA membuat background+overlay di atas ikut
         ter-reparenting (lihat catatan di pembungkus paling luar). -->
    <nav
      class="fixed top-0 left-0 w-full z-50 transition-[background-color,border-color,box-shadow,transform] duration-300 md:bg-surface-container-lowest md:dark:bg-surface-dim md:border-b md:border-outline-variant/30 md:shadow-sm"
      :style="{ transform: menuTerbuka ? 'translateX(-18rem)' : 'none' }"
      :class="navMasihTransparan ? 'bg-transparent border-b border-transparent' : 'bg-surface-container-lowest dark:bg-surface-dim border-b border-outline-variant/30 shadow-sm'"
    >
      <div class="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-[1280px] mx-auto">
        <!-- Logo -- filter invert MENGGANTI logo jadi putih selagi navbar
             transparan di atas foto (tidak ada aset logo putih terpisah,
             lihat catatan di script) -- otomatis balik warna asli begitu
             navbar solid/di desktop. -->
        <div class="flex items-center cursor-pointer" @click="navigasiKe('/')">
          <img
            src="/logo-denanta.png"
            alt="Denanta TranSolution"
            class="h-14 md:h-24 w-auto transition-[filter] duration-300 md:!filter-none"
            :class="navMasihTransparan ? 'brightness-0 invert' : ''"
          />
        </div>
        
        <!-- Desktop Menu -->
        <div class="hidden md:flex gap-2 items-center">
          <a @click="navigasiKe('/')" :class="kelasMenuBeranda">Beranda</a>
          <router-link to="/tentang" :class="kelasMenuTentang">Tentang Kami</router-link>
          <button type="button" @click="bukaMenuLangganan" :class="[kelasMenuLangganan, 'border-0', route.path === '/berlangganan' ? '' : 'bg-transparent']">
            {{ labelMenuLangganan }}
          </button>
        </div>

        <!-- Right Actions -->
        <div class="hidden md:flex items-center gap-4">
          <!-- Notifikasi -- hanya untuk akun yang SEDANG AKTIF berlangganan,
               bukan sekadar sudah login (akun yang belum/tidak lagi
               berlangganan tidak punya dashboard untuk dituju maupun apa
               pun untuk dinotifikasikan). -->
          <button
            v-if="sudahAktifBerlangganan"
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
          <!-- Notifikasi Mobile -- sama seperti versi desktop, cuma untuk
               akun yang sedang aktif berlangganan. -->
          <button
            v-if="sudahAktifBerlangganan"
            type="button"
            @click="bukaNotifikasi"
            class="relative cursor-pointer hover:text-primary transition-colors p-2 bg-transparent border-0"
            :class="navMasihTransparan ? 'text-white' : 'text-slate-500'"
            title="Lihat Notifikasi"
          >
            <Bell class="w-5 h-5" />
            <span v-if="adaNotifikasi" class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>
          </button>
          <button
            @click="toggleMenu"
            class="hover:text-primary p-2 cursor-pointer border-0 bg-transparent transition-colors"
            :class="navMasihTransparan ? 'text-white' : 'text-on-surface-variant'"
          >
            <Menu class="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>

    <!-- Sidebar mobile -- di-Teleport ke <body> supaya BENAR-BENAR fixed ke
         viewport asli (bukan ancestor yang sekarang punya transform di
         atas), bukan overlay penuh layar: begitu dibuka, konten halaman
         (div pembungkus di atas) bergeser ke kiri sejauh lebar sidebar ini
         (18rem, sama persis dengan w-72 di bawah -- max-w-[80vw] SENGAJA
         dihapus supaya lebar sidebar selalu pas dengan jarak geser, tidak
         menyisakan celah di layar sangat sempit). -->
    <Teleport to="body">
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
          <a @click="navigasiKe('/'); menuTerbuka = false" :class="kelasMenuBerandaMobile">Beranda</a>
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
              <User class="w-4 h-4" />
              Edit Profil
            </router-link>
            <button
              @click="bukaKonfirmasiLogout"
              class="w-full bg-transparent hover:bg-error-container/20 text-error py-2.5 rounded-xl text-center font-semibold cursor-pointer border-0 flex items-center justify-center gap-2"
            >
              <LogOut class="w-4 h-4" />
              Keluar
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
              class="w-full bg-primary hover:bg-[#0D7A68] text-white py-2.5 rounded-xl text-center font-semibold block"
            >
              Daftar
            </router-link>
          </div>
        </div>
      </aside>
    </Teleport>

    <!-- Konten geser (Background Accents s.d. Footer) -- transform di sini
         TERPISAH dari nav (lihat catatan di pembungkus terluar), supaya
         seluruh isi halaman tetap ikut bergeser ke kiri saat sidebar
         dibuka, tanpa mempengaruhi background+overlay header yang sengaja
         dibuat statis. -->
    <div class="transition-transform duration-300" :style="{ transform: menuTerbuka ? 'translateX(-18rem)' : 'none' }">
    <!-- Background Accents -- disembunyikan di mobile (hidden md:block).
         Div ini `fixed inset-0`, jadi SELALU menutupi viewport penuh di
         posisi manapun -- termasuk lingkaran blur primary/tosca di pojok
         kanan-atas (top:-10%) yang persis tumpang tindih dengan area hero,
         memberi rona hijau di atas foto+overlay gelap yang sudah ada.
         Cukup jadi aksen dekoratif untuk section-section di bawah hero
         pada desktop; di mobile foto hero sendiri sudah jadi elemen visual
         utama, tidak perlu accent tambahan ini. -->
    <div class="hidden md:block fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary rounded-full opacity-[0.14] blur-3xl"></div>
      <div class="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-primary-container rounded-full opacity-[0.20] blur-3xl"></div>
      <div class="absolute top-[15%] left-[35%] w-[380px] h-[380px] bg-tertiary rounded-full opacity-[0.05] blur-3xl"></div>
      <div class="absolute top-[40%] right-[10%] opacity-20">
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
    <section class="relative overflow-hidden md:overflow-visible min-h-[580px] md:min-h-0 flex items-center md:block">
      <div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-xl md:py-[80px] flex flex-col md:flex-row items-center gap-gutter relative z-10 w-full">
      <div class="md:w-1/2 flex flex-col gap-6 z-10 text-left">
        <!-- Ukuran mobile dinaikkan jadi elemen utama hero (sebelumnya
             cuma 24px/headline-lg-mobile, kalah menonjol dibanding foto
             latar) -- pakai clamp() lewat arbitrary value (bukan mengubah
             token headline-lg-mobile di tailwind.config.js, supaya
             HalamanTentang.vue yang juga memakai token itu tidak ikut
             berubah) supaya tetap responsif mengikuti lebar layar, dibatasi
             maksimal 44px (di bawah ukuran desktop 48px). text-shadow
             menjaga keterbacaan di atas foto. max-w-[90%] mencegah judul
             mepet ke tepi kanan layar. -->
        <h1 class="font-headline-lg-mobile font-bold text-[clamp(1.9rem,7vw,2.75rem)] leading-[1.15] md:font-display-lg md:text-display-lg md:leading-[56px] text-white md:text-on-background tracking-tight max-w-[90%] md:max-w-none [text-shadow:0_2px_10px_rgba(0,0,0,0.35)] md:[text-shadow:none]">
          Pantau Perjalanan Anak dengan <span class="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Aman &amp; Nyata</span> di Padang.
        </h1>
        <p class="font-body-lg text-body-lg text-white/90 md:text-on-surface-variant max-w-lg leading-relaxed">
          Memberikan ketenangan pikiran bagi orang tua dengan layanan antar jemput sekolah yang profesional, terpantau secara real-time, dan mengutamakan keselamatan.
        </p>
        <div class="flex flex-wrap gap-4 mt-2">
          <button
            type="button"
            @click="bukaTombolHero"
            class="bg-primary hover:bg-[#0D7A68] text-on-primary font-label-md text-label-md rounded-xl px-6 py-3 transition-colors shadow-md border-0 cursor-pointer"
          >
            {{ labelTombolHero }}
          </button>
          <router-link to="/tentang">
            <button class="border-2 border-solid border-primary text-primary md:text-primary bg-white/90 md:bg-transparent font-label-md text-label-md rounded-xl px-6 py-3 hover:bg-brand-tosca-light transition-colors cursor-pointer">
              Pelajari Lebih Lanjut
            </button>
          </router-link>
        </div>
      </div>
      <div class="hidden md:block md:w-1/2 relative">
        <div class="absolute inset-0 bg-primary-container rounded-full opacity-[0.15] blur-xl transform scale-110"></div>
        <!-- Bingkai gradien sebagai "border" -- padding pada wrapper luar
             menyisakan celah warna gradien primary di sekeliling kotak
             gambar, dipisah dari kotak dalam (yang aspect-ratio-nya tetap,
             lihat catatan di bawah) supaya bingkainya tidak ikut terpotong
             oleh overflow-hidden si kotak gambar. -->
        <div class="relative z-10 w-full max-w-md mx-auto p-2 rounded-[20px] bg-gradient-to-br from-primary via-emerald-500 to-primary-container shadow-xl shadow-primary/30">
          <!-- Wrapper diberi aspect-ratio tetap supaya kedua gambar (yang
               keluar & yang masuk) bisa ditumpuk absolute selama crossfade --
               tanpa ini, transisi fade biasa (mode default, tanpa out-in)
               akan membuat tinggi kotak "melompat" begitu ukuran gambar
               berikutnya beda dari yang sebelumnya. -->
          <div class="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white">
            <!-- Tanpa mode="out-in" secara SENGAJA -- gambar lama & baru
                 perlu tumpang tindih (sama-sama ada di DOM sesaat) selama
                 transisi supaya hasilnya crossfade mulus, bukan berkedip ke
                 kosong dulu baru muncul. -->
            <Transition name="fade-hero">
              <img
                :key="indeksGambarHero"
                :src="gambarHero[indeksGambarHero]"
                alt="Denanta TranSolution"
                class="absolute inset-0 w-full h-full object-cover"
              />
            </Transition>
          </div>
        </div>
      </div>
      </div>
    </section>

    <!-- Keunggulan Section -->
    <section class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-xl relative z-10">
      <div class="text-center mb-12">
        <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background mb-4">Mengapa Memilih Denanta?</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">Kami mengutamakan keamanan dan kenyamanan anak Anda dengan standar pelayanan terbaik.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center mb-6 text-white shadow-lg shadow-primary/30">
            <MapPin class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Live Tracking</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Pantau lokasi kendaraan secara langsung kapan saja di peta interaktif.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center mb-6 text-white shadow-lg shadow-primary/30">
            <ShieldCheck class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Driver Terverifikasi</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Pengemudi profesional dan terlatih, dokumen KTP &amp; SIM diverifikasi sebelum bertugas.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center mb-6 text-white shadow-lg shadow-primary/30">
            <Bell class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Notifikasi Real-time</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Terima pemberitahuan instan otomatis di aplikasi saat anak dijemput &amp; sampai.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-lg soft-shadow flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
          <div class="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center mb-6 text-white shadow-lg shadow-primary/30">
            <Clock class="w-8 h-8" />
          </div>
          <h3 class="font-title-lg text-title-lg mb-2 text-on-background">Tepat Waktu</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Jadwal penjemputan terencana dan optimal untuk efisiensi waktu perjalanan.</p>
        </div>
      </div>
    </section>

    <!-- Manfaat Section -->
    <section class="w-full bg-gradient-to-br from-brand-tosca-light via-[#CDF2E9] to-[#A8E8D6] py-16 md:py-24 relative z-10">
      <div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-16">
        <div class="order-2 md:order-1">
          <img
            alt="Manfaat Layanan"
            class="w-full h-auto rounded-xl soft-shadow"
            src="/aset/manfaat-layanan.png"
          />
        </div>
        <div class="flex flex-col gap-8 order-1 md:order-2 text-left">
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background">Manfaat Utama Layanan Kami</h2>
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
    <section class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-24 relative overflow-hidden z-10">
      <div class="text-center mb-12 md:mb-20">
        <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg mb-4 text-on-background">Cara Kerja Kami</h2>
        <p class="font-body-lg text-on-surface-variant">Langkah mudah untuk memulai layanan antar jemput Denanta.</p>
      </div>
      <div class="relative flex flex-col md:flex-row justify-between items-start gap-10 md:gap-0">
        <!-- Connector Line -->
        <div class="hidden md:block absolute top-10 left-[10%] right-[10%] border-t-2 border-dashed border-primary/50 z-0"></div>
        <!-- Step 1 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg shadow-primary/40 border-4 border-solid border-white">1</div>
          <h4 class="font-title-lg mb-2 text-on-background">Pendaftaran</h4>
          <p class="font-body-md text-on-surface-variant px-4">Lengkapi formulir pendaftaran dan tentukan lokasi penjemputan di peta.</p>
        </div>
        <!-- Step 2 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg shadow-primary/40 border-4 border-solid border-white">2</div>
          <h4 class="font-title-lg mb-2 text-on-background">Penjadwalan</h4>
          <p class="font-body-md text-on-surface-variant px-4">Tim kami akan mengatur rute dan mencocokkan jadwal supir terdekat.</p>
        </div>
        <!-- Step 3 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg shadow-primary/40 border-4 border-solid border-white">3</div>
          <h4 class="font-title-lg mb-2 text-on-background">Penjemputan</h4>
          <p class="font-body-md text-on-surface-variant px-4">Driver menjemput anak Anda sesuai jadwal dengan armada resmi dan aman.</p>
        </div>
        <!-- Step 4 -->
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-20 h-20 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full flex items-center justify-center font-display-lg text-2xl mb-6 shadow-lg shadow-primary/40 border-4 border-solid border-white">4</div>
          <h4 class="font-title-lg mb-2 text-on-background">Pantau Real-time</h4>
          <p class="font-body-md text-on-surface-variant px-4">Terima notifikasi aplikasi dan pantau perjalanan anak lewat web maps.</p>
        </div>
      </div>
    </section>

    <!-- Estimasi Biaya Section -->
    <section class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-24 relative z-10">
      <div class="text-center mb-10 md:mb-16">
        <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg mb-4 text-on-background">Estimasi Biaya</h2>
        <p class="font-body-lg text-on-surface-variant">Pilih paket layanan yang sesuai dengan kebutuhan Anda.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-4xl mx-auto items-stretch">
        <!-- Card 1 -->
        <div class="bg-primary text-on-primary rounded-xl p-6 flex flex-col shadow-xl relative z-10 justify-between text-left">
          <div class="absolute -top-4 right-6 bg-warnaTombol text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">POPULER</div>
          <div>
            <h3 class="font-headline-md text-headline-md mb-2 text-white">Antar Jemput (PP)</h3>
            <div class="flex items-baseline gap-1 mb-6">
              <span class="text-3xl font-bold text-white">{{ hargaAntarJemput }}</span>
              <span class="opacity-80 text-sm">/bulan</span>
            </div>
            <ul class="flex flex-col gap-3 mb-6">
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Antar pagi &amp; Jemput siang/sore</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Laporan perjalanan harian</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-white w-5 h-5 shrink-0" />
                <span class="font-body-md text-white">Struk &amp; riwayat pembayaran digital</span>
              </li>
            </ul>
          </div>
          <router-link to="/berlangganan">
            <button class="w-full bg-white text-primary font-label-md py-3 rounded-xl hover:bg-surface-container-low transition-colors shadow-md border-0 cursor-pointer">
              Pilih Paket
            </button>
          </router-link>
        </div>

        <!-- Card 2 -->
        <div class="bg-gradient-to-br from-white to-brand-tosca-light border-2 border-solid border-primary/20 rounded-xl p-6 flex flex-col soft-shadow justify-between text-left">
          <div>
            <h3 class="font-headline-md text-headline-md mb-2 text-on-background">Antar / Jemput Saja</h3>
            <div class="flex items-baseline gap-1 mb-6">
              <span class="text-3xl font-bold text-primary">{{ hargaAntarSaja }}</span>
              <span class="text-on-surface-variant text-sm">/bulan</span>
            </div>
            <ul class="flex flex-col gap-3 mb-6">
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Hanya Antar atau Hanya Jemput</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Notifikasi real-time di aplikasi</span>
              </li>
              <li class="flex items-center gap-2">
                <Check class="text-primary w-5 h-5 shrink-0" />
                <span class="font-body-md text-on-background">Pemantauan lokasi GPS langsung</span>
              </li>
            </ul>
          </div>
          <router-link to="/berlangganan">
            <button class="w-full border-2 border-solid border-primary text-primary font-label-md py-3 rounded-xl hover:bg-brand-tosca-light transition-colors bg-transparent cursor-pointer">
              Pilih Paket
            </button>
          </router-link>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <span id="faq" class="block relative -top-24"></span>
    <section class="max-w-[800px] mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-24 relative z-10">
      <div class="text-center mb-12">
        <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background">Pertanyaan Umum (FAQ)</h2>
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
            class="mt-3 text-on-surface-variant font-body-md pl-7 leading-relaxed bg-brand-tosca-light/70 p-3 rounded-lg border border-solid border-primary/25"
          >
            {{ faq.jawab }}
          </div>
        </div>
      </div>
    </section>

    <FooterPublik />
    </div>

    <!-- Modal Konfirmasi Logout (sidebar mobile) -->
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
          @click="konfirmasiLogoutMobile"
        >
          {{ sedangLogout ? 'Memproses...' : 'Ya, Keluar' }}
        </button>
      </template>
    </ModalUtama>
  </div>
</template>

<style scoped>
.fade-hero-enter-active,
.fade-hero-leave-active {
  transition: opacity 1.4s ease-in-out;
}
.fade-hero-enter-from,
.fade-hero-leave-to {
  opacity: 0;
}
</style>
