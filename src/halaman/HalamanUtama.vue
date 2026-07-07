<script setup lang="ts">
import { ref } from 'vue';
import TataLetakTamu from './tataletak/TataLetakTamu.vue';
import KalkulatorBiaya from '../komponen/umum/KalkulatorBiaya.vue';
import TombolUtama from '../komponen/umum/TombolUtama.vue';
import { 
  ShieldCheck, MapPin, Clock, CreditCard, 
  Smile, UserCheck, ArrowRight, 
  HelpCircle, ChevronDown, Phone, Mail, Instagram, Facebook 
} from 'lucide-vue-next';

// Data Keunggulan
const keunggulan = [
  {
    judul: 'Lacak Langsung Real-time',
    deskripsi: 'Pantau posisi bus jemputan anak Anda secara real-time pada peta interaktif Leaflet.',
    ikon: MapPin,
  },
  {
    judul: 'Supir Terverifikasi',
    deskripsi: 'Seluruh supir kami melewati pemeriksaan latar belakang dan verifikasi SIM/STNK resmi.',
    ikon: ShieldCheck,
  },
  {
    judul: 'Notifikasi Instan via WA',
    deskripsi: 'Terima peringatan otomatis keberangkatan dan ketibaan anak Anda langsung di WhatsApp.',
    ikon: Clock,
  },
  {
    judul: 'Pembayaran Online Aman',
    deskripsi: 'Kelola pembayaran secara aman melalui gerbang pembayaran terintegrasi Midtrans.',
    ikon: CreditCard,
  },
];

// Data Manfaat
const manfaat = [
  {
    judul: 'Efisiensi Waktu Orang Tua',
    deskripsi: 'Orang tua tidak perlu lagi menunggu cemas di pinggir jalan karena jadwal kedatangan armada sangat presisi.',
    ikon: Clock
  },
  {
    judul: 'Rasa Aman yang Hakiki',
    deskripsi: 'Dengan pelacakan GPS live, orang tua selalu tahu keberadaan anak mereka dalam perjalanan pulang atau pergi sekolah.',
    ikon: Smile
  },
  {
    judul: 'Transparansi Tarif & Rute',
    deskripsi: 'Sistem billing yang jelas tanpa biaya tersembunyi, dihitung transparan berdasarkan jarak rute tempuh.',
    ikon: UserCheck
  }
];

// Data Cara Kerja
const langkahCaraKerja = [
  { nomor: '01', judul: 'Daftar Akun', deskripsi: 'Buat akun Anda secara gratis di portal web Denanta TranSolution.' },
  { nomor: '02', judul: 'Input Data Anak', deskripsi: 'Lengkapi informasi anak, sekolah, dan tentukan titik penjemputan di peta.' },
  { nomor: '03', judul: 'Pilih Langganan & Bayar', deskripsi: 'Pilih paket bulanan/harian lalu bayar aman lewat Midtrans.' },
  { nomor: '04', judul: 'Pantau Real-time', deskripsi: 'Selesai! Mulai pantau perjalanan antar-jemput anak Anda setiap hari.' }
];

// Data Testimoni
const testimoni = [
  {
    nama: 'Bunda Sarah',
    peran: 'Orang Tua Rafi (SD N 01 Padang)',
    ulasan: 'Sangat terbantu sejak pakai Denanta TS! Dulu sering cemas nunggu bus jemputan datang terlambat, sekarang tinggal pantau dari HP sambil kerja.',
    foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces'
  },
  {
    nama: 'Pak Ridwan',
    peran: 'Orang Tua Aisyah (SMP N 1 Padang)',
    ulasan: 'Fitur notifikasi WhatsApp-nya luar biasa! Saya langsung tahu begitu anak saya sampai di gerbang sekolah dengan aman.',
    foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces'
  },
  {
    nama: 'Ibu Ningsih',
    peran: 'Orang Tua Dafa (SMA N 2 Padang)',
    ulasan: 'Sistem pembayaran bulanannya sangat transparan. Ditambah supirnya terverifikasi dan ramah, bikin anak saya betah selama di perjalanan.',
    foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=faces'
  }
];

// Data FAQ Accordion
const faqList = ref([
  {
    tanya: 'Di mana saja area layanan Denanta TranSolution?',
    jawab: 'Saat ini layanan armada antar-jemput sekolah Denanta TranSolution beroperasi penuh di seluruh wilayah Kota Padang, Sumatra Barat.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana keamanan data dan privasi anak saya dijamin?',
    jawab: 'Kami mengimplementasikan kebijakan Row-Level Security (RLS) di PostgreSQL Supabase. Data anak Anda hanya bisa diakses oleh Anda sebagai orang tua, supir yang ditugaskan, dan administrator sistem kami.',
    terbuka: false
  },
  {
    tanya: 'Apa metode pembayaran yang didukung?',
    jawab: 'Kami bekerja sama dengan Midtrans, sehingga Anda bisa membayar tagihan menggunakan Transfer Bank (Virtual Account), Kartu Kredit, GoPay, ShopeePay, QRIS, maupun Alfamart/Indomaret.',
    terbuka: false
  },
  {
    tanya: 'Bagaimana jika supir utama berhalangan hadir?',
    jawab: 'Sistem kami menyediakan opsi supir cadangan/sementara yang terdaftar dan terverifikasi untuk menggantikan rute tersebut guna memastikan anak Anda tetap terlayani.',
    terbuka: false
  },
  {
    tanya: 'Apakah saya bisa berhenti berlangganan sewaktu-waktu?',
    jawab: 'Ya, Anda bebas memilih jenis langganan bulanan atau harian, serta menonaktifkan langganan Anda melalui dashboard orang tua kapan saja.',
    terbuka: false
  }
]);

const toggleFaq = (index: number) => {
  faqList.value[index].terbuka = !faqList.value[index].terbuka;
};
</script>

<template>
  <TataLetakTamu>
    <div class="space-y-24 py-8 overflow-hidden">
      <!-- 1. Hero Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-12 pt-8">
        <div class="space-y-6 max-w-2xl text-center lg:text-left">
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warnaAksen/40 border border-warnaAksen text-xs text-slate-300">
            <span class="w-2 h-2 rounded-full bg-warnaTombol animate-ping"></span>
            Kini Hadir di Kota Padang
          </div>
          <h1 class="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Layanan Antar Jemput <br />
            Anak Sekolah <br />
            <span class="bg-gradient-to-r from-warnaTombol to-pink-500 bg-clip-text text-transparent">
              Aman & Terpercaya
            </span>
          </h1>
          <p class="text-base md:text-lg text-slate-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
            Pantau perjalanan harian anak Anda secara real-time dengan sistem monitoring GPS terintegrasi langsung ke ponsel pintar Anda.
          </p>
          <div class="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
            <router-link to="/berlangganan">
              <TombolUtama varian="utama" ukuran="besar" class="gap-2">
                Mulai Berlangganan
                <ArrowRight class="w-5 h-5" />
              </TombolUtama>
            </router-link>
            <router-link to="/tentang">
              <TombolUtama varian="garis-luar" ukuran="besar">
                Pelajari Selengkapnya
              </TombolUtama>
            </router-link>
          </div>
        </div>

        <!-- Hero graphic mock -->
        <div class="w-full lg:w-1/2 flex justify-center">
          <div class="relative w-80 h-80 sm:w-96 sm:h-96 rounded-3xl bg-gradient-to-tr from-warnaSekunder to-warnaAksen/20 border border-warnaAksen/30 shadow-2xl flex items-center justify-center overflow-hidden">
            <div class="absolute inset-0 bg-[linear-gradient(to_right,#0f3460_1px,transparent_1px),linear-gradient(to_bottom,#0f3460_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-25"></div>
            
            <!-- Simulated GPS bus icon -->
            <div class="w-56 h-56 rounded-full bg-warnaAksen/30 border border-warnaAksen/60 flex items-center justify-center relative animate-pulse">
              <div class="w-36 h-36 rounded-full bg-warnaTombol/10 border border-warnaTombol/40 flex items-center justify-center">
                <Bus class="w-16 h-16 text-warnaTombol" />
              </div>
              <!-- Floating user marker mockup -->
              <div class="absolute top-8 right-8 w-10 h-10 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg">
                <UserCheck class="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Keunggulan Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-extrabold text-white">Keunggulan Denanta TS</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Kami menjamin standardisasi mutu dan keselamatan dalam setiap perjalanan anak Anda.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            v-for="item in keunggulan" 
            :key="item.judul"
            class="bg-warnaSekunder/40 backdrop-blur-md border border-warnaAksen/20 rounded-2xl p-6 transition-all duration-300 hover:border-warnaAksen/50 hover:shadow-xl group"
          >
            <div class="w-12 h-12 rounded-xl bg-warnaAksen/30 border border-warnaAksen/40 flex items-center justify-center text-warnaTombol mb-4 group-hover:scale-110 transition-transform">
              <component :is="item.ikon" class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-bold text-white mb-2">{{ item.judul }}</h3>
            <p class="text-sm text-slate-400 leading-relaxed">{{ item.deskripsi }}</p>
          </div>
        </div>
      </section>

      <!-- 3. Manfaat Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-warnaSekunder/20 border border-warnaAksen/20 rounded-3xl py-12 px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1 space-y-4">
          <h2 class="text-3xl font-extrabold text-white leading-snug">Manfaat untuk Ketenangan Keluarga</h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Menghilangkan rasa khawatir, merapikan rutinitas pagi hari, dan memberikan rasa aman bagi tumbuh kembang si kecil.
          </p>
        </div>
        <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="m in manfaat" :key="m.judul" class="space-y-3">
            <component :is="m.ikon" class="w-8 h-8 text-warnaTombol" />
            <h4 class="text-base font-bold text-white">{{ m.judul }}</h4>
            <p class="text-xs text-slate-400 leading-relaxed">{{ m.deskripsi }}</p>
          </div>
        </div>
      </section>

      <!-- 4. Cara Kerja Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-extrabold text-white">Bagaimana Cara Kerjanya?</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Hanya butuh 4 langkah mudah untuk mulai menikmati layanan perlindungan transportasi kami.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          <div 
            v-for="step in langkahCaraKerja" 
            :key="step.nomor"
            class="relative bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-6 shadow-md"
          >
            <span class="absolute top-4 right-4 text-3xl font-black text-warnaAksen/40">{{ step.nomor }}</span>
            <h3 class="text-lg font-bold text-white mb-2 pt-4">{{ step.judul }}</h3>
            <p class="text-sm text-slate-400 leading-relaxed">{{ step.deskripsi }}</p>
          </div>
        </div>
      </section>

      <!-- 5. Estimasi Biaya & Kalkulator -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div class="space-y-6">
          <div class="space-y-2">
            <h2 class="text-3xl font-extrabold text-white">Transparansi Tarif Layanan</h2>
            <p class="text-slate-400 text-sm">
              Kami menawarkan sistem paket hemat bulanan maupun bayar harian fleksibel.
            </p>
          </div>

          <!-- Pricing Table -->
          <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-300 font-bold text-xs uppercase">
                  <th class="py-3 px-4">Paket Layanan</th>
                  <th class="py-3 px-4 text-right">Tarif Bulanan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
                <tr>
                  <td class="py-4 px-4 font-semibold text-white">Antar Jemput (Pagi & Sore)</td>
                  <td class="py-4 px-4 text-right font-bold text-warnaTombol">Rp 475.000 <span class="text-[10px] text-slate-400">/ bln</span></td>
                </tr>
                <tr>
                  <td class="py-4 px-4 font-semibold text-white">Antar Saja (Pagi)</td>
                  <td class="py-4 px-4 text-right font-bold text-warnaTombol">Rp 275.000 <span class="text-[10px] text-slate-400">/ bln</span></td>
                </tr>
                <tr>
                  <td class="py-4 px-4 font-semibold text-white">Jemput Saja (Sore)</td>
                  <td class="py-4 px-4 text-right font-bold text-warnaTombol">Rp 275.000 <span class="text-[10px] text-slate-400">/ bln</span></td>
                </tr>
              </tbody>
            </table>
            <div class="bg-warnaUtama/30 p-4 border-t border-warnaAksen/20 text-center text-[10px] text-slate-400">
              *Tarif harian alternatif tersedia mulai dari <strong>Rp 20.000 / trip</strong> tergantung jarak.
            </div>
          </div>

          <div class="pt-2 flex justify-center lg:justify-start">
            <router-link to="/berlangganan">
              <TombolUtama varian="utama" class="gap-1">
                Daftar & Berlangganan Sekarang
                <ArrowRight class="w-4 h-4" />
              </TombolUtama>
            </router-link>
          </div>
        </div>

        <!-- Kalkulator Interaktif -->
        <div>
          <KalkulatorBiaya />
        </div>
      </section>

      <!-- 6. Testimoni Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-extrabold text-white">Ulasan Orang Tua</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Dengarkan tanggapan nyata dari para bunda dan ayah yang telah mempercayakan perjalanan anaknya bersama kami.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            v-for="t in testimoni" 
            :key="t.nama"
            class="bg-warnaSekunder/40 backdrop-blur-md border border-warnaAksen/20 rounded-2xl p-6 shadow-md flex flex-col justify-between"
          >
            <p class="text-sm text-slate-300 italic leading-relaxed mb-6">"{{ t.ulasan }}"</p>
            <div class="flex items-center gap-3">
              <img :src="t.foto" :alt="t.nama" class="w-10 h-10 rounded-full object-cover border border-warnaAksen/30" />
              <div>
                <p class="text-sm font-bold text-white">{{ t.nama }}</p>
                <p class="text-[10px] text-slate-400">{{ t.peran }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. Tanya Jawab (FAQ) Accordion -->
      <section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-extrabold text-white">Tanya Jawab Umum</h2>
          <p class="text-slate-400 text-sm">
            Temukan jawaban cepat atas pertanyaan yang sering diajukan.
          </p>
        </div>

        <div class="space-y-4">
          <div 
            v-for="(faq, index) in faqList" 
            :key="index"
            class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden"
          >
            <button 
              @click="toggleFaq(index)" 
              class="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
            >
              <span class="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle class="w-4 h-4 text-warnaTombol" />
                {{ faq.tanya }}
              </span>
              <ChevronDown 
                class="w-5 h-5 text-slate-400 transition-transform duration-300"
                :class="{ 'rotate-180 text-warnaTombol': faq.terbuka }" 
              />
            </button>
            
            <div 
              v-show="faq.terbuka" 
              class="px-6 pb-5 pt-1 text-xs text-slate-400 leading-relaxed border-t border-warnaAksen/10 bg-warnaUtama/20"
            >
              {{ faq.jawab }}
            </div>
          </div>
        </div>
      </section>

      <!-- 8. Kontak Section -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-gradient-to-r from-warnaSekunder to-warnaUtama border border-warnaAksen/30 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div class="space-y-4 max-w-xl">
            <h2 class="text-2xl md:text-3xl font-extrabold text-white">Butuh informasi lebih lanjut?</h2>
            <p class="text-slate-400 text-sm leading-relaxed">
              Tim customer support kami siap melayani Anda. Silakan hubungi kami melalui saluran berikut.
            </p>
            <div class="pt-2 space-y-2.5">
              <div class="flex items-center gap-3 text-sm text-slate-300">
                <Phone class="w-5 h-5 text-warnaTombol" />
                <span>WhatsApp: <strong>+62 812-3456-7890</strong></span>
              </div>
              <div class="flex items-center gap-3 text-sm text-slate-300">
                <Mail class="w-5 h-5 text-warnaTombol" />
                <span>Email: <strong>info@denanta.com</strong></span>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col gap-3 w-full md:w-fit">
            <a href="https://wa.me/6281234567890" target="_blank" class="w-full">
              <TombolUtama varian="utama" class="w-full gap-2">
                Hubungi via WhatsApp
              </TombolUtama>
            </a>
            <div class="flex gap-4 justify-center md:justify-start pt-2">
              <a href="#" class="text-slate-400 hover:text-white transition-colors">
                <Instagram class="w-6 h-6" />
              </a>
              <a href="#" class="text-slate-400 hover:text-white transition-colors">
                <Facebook class="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </TataLetakTamu>
</template>
