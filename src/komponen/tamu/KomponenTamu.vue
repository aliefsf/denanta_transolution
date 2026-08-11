<script setup lang="ts">
import { ShieldCheck, MapPin, Clock, Smartphone } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import KartuUtama from '../umum/KartuUtama.vue';

const keunggulan = [
  {
    judul: 'Pelacakan Real-time',
    deskripsi: 'Pantau posisi armada jemputan anak Anda secara real-time di peta interaktif.',
    ikon: MapPin,
  },
  {
    judul: 'Keamanan Ekstra',
    deskripsi: 'Sistem otentikasi ketat dan verifikasi supir resmi terdaftar untuk keamanan optimal.',
    ikon: ShieldCheck,
  },
  {
    judul: 'Notifikasi Instan',
    deskripsi: 'Terima notifikasi status keberangkatan, ketibaan, dan keterlambatan langsung di aplikasi.',
    ikon: Clock,
  },
  {
    judul: 'Akses Mobile-Friendly',
    deskripsi: 'Tampilan antarmuka responsif yang nyaman diakses melalui smartphone di mana saja.',
    ikon: Smartphone,
  },
];
</script>

<template>
  <div class="space-y-16 py-8">
    <!-- Hero Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
      <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warnaAksen/40 border border-warnaAksen text-xs text-slate-300">
        <span class="w-2 h-2 rounded-full bg-warnaTombol animate-ping"></span>
        Transportasi Sekolah Masa Kini
      </div>
      <h1 class="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
        Solusi Aman Transportasi <br />
        <span class="bg-gradient-to-r from-warnaTombol to-pink-500 bg-clip-text text-transparent">
          Anak Sekolah Terintegrasi
        </span>
      </h1>
      <p class="max-w-2xl mx-auto text-base md:text-lg text-slate-400">
        Menghubungkan orang tua, supir, dan admin dalam satu ekosistem digital untuk menjamin ketepatan waktu serta keselamatan armada penjemputan anak sekolah.
      </p>
      <div class="flex flex-wrap justify-center gap-4 pt-4">
        <router-link to="/orangtua">
          <TombolUtama varian="utama" ukuran="besar">
            Coba Portal Orang Tua
          </TombolUtama>
        </router-link>
        <router-link to="/supir">
          <TombolUtama varian="garis-luar" ukuran="besar">
            Portal Supir
          </TombolUtama>
        </router-link>
      </div>
    </section>

    <!-- Features Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      <div class="text-center space-y-2">
        <h2 class="text-3xl font-bold text-white">Mengapa Memilih Denanta TranSolution?</h2>
        <p class="text-slate-400 text-sm max-w-xl mx-auto">
          Fitur-fitur unggulan kami dirancang khusus untuk mempermudah pemantauan perjalanan harian anak sekolah secara terpercaya.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KartuUtama
          v-for="fitur in keunggulan"
          :key="fitur.judul"
          class="flex flex-col h-full"
        >
          <div class="p-3 bg-warnaAksen/30 border border-warnaAksen/50 rounded-lg w-fit text-warnaTombol mb-4">
            <component :is="fitur.ikon" class="w-6 h-6" />
          </div>
          <h3 class="text-lg font-bold text-white mb-2">{{ fitur.judul }}</h3>
          <p class="text-sm text-slate-400 flex-grow">{{ fitur.deskripsi }}</p>
        </KartuUtama>
      </div>
    </section>

    <!-- Call to Action (Mockup Image Demo) -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-gradient-to-r from-warnaSekunder to-warnaUtama border border-warnaAksen/30 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
        <div class="space-y-4 max-w-xl">
          <h3 class="text-2xl md:text-3xl font-extrabold text-white">Ingin bergabung menjadi mitra transportasi sekolah kami?</h3>
          <p class="text-slate-400 text-sm leading-relaxed">
            Daftarkan armada jemputan Anda dan nikmati manajemen rute yang lebih efisien serta transparansi info ke orang tua siswa.
          </p>
          <div class="pt-2">
            <router-link to="/admin">
              <TombolUtama varian="aksen">
                Hubungi Admin
              </TombolUtama>
            </router-link>
          </div>
        </div>
        <div class="w-full md:w-1/3 flex justify-center">
          <div class="w-48 h-48 rounded-full bg-warnaAksen/20 border-4 border-warnaAksen flex items-center justify-center text-warnaTombol text-8xl font-black">
            D
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
