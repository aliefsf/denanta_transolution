<script setup lang="ts">
import TataLetakTamu from './tataletak/TataLetakTamu.vue';
import KartuUtama from '../komponen/umum/KartuUtama.vue';
import { Target, ShieldCheck, MapPin, Award, BookOpen } from 'lucide-vue-next';
</script>

<template>
  <TataLetakTamu>
    <div class="space-y-16 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-slate-100">
      
      <!-- Header -->
      <div class="text-center space-y-4 max-w-2xl mx-auto">
        <div class="inline-flex items-center gap-1 bg-warnaAksen/30 border border-warnaAksen/50 px-3 py-1 rounded-full text-xs text-warnaTombol">
          <BookOpen class="w-4 h-4" />
          Profil Platform
        </div>
        <h1 class="text-4xl font-extrabold text-white tracking-tight">Tentang Denanta TranSolution</h1>
        <p class="text-slate-400 text-sm leading-relaxed">
          Kenali visi kami dalam menyediakan sistem transportasi sekolah yang aman, terpantau, dan nyaman bagi generasi masa depan.
        </p>
      </div>

      <!-- Grid Sejarah & Visi Misi -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Sejarah -->
        <KartuUtama judul="Sejarah Kami" subjudul="Mulai dari solusi sederhana hingga ekosistem digital">
          <div class="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              Denanta TranSolution didirikan atas dasar keprihatinan bersama mengenai keselamatan anak sekolah selama dalam perjalanan. Banyaknya hambatan komunikasi antara orang tua dan supir bus sekolah sering kali menimbulkan kecemasan yang tidak perlu.
            </p>
            <p>
              Di era transformasi digital ini, kami berinisiatif menghadirkan platform manajemen dan pelacakan rute armada sekolah berbasis GPS real-time. Dengan mengintegrasikan sistem pelaporan supir, notifikasi WhatsApp otomatis, dan verifikasi profil yang ketat, kami berhasil menciptakan ekosistem transportasi yang dapat diandalkan oleh ribuan keluarga.
            </p>
          </div>
        </KartuUtama>

        <!-- Visi Misi -->
        <KartuUtama judul="Visi & Misi" subjudul="Komitmen kami untuk transportasi sekolah">
          <div class="space-y-6">
            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-xl bg-warnaAksen flex items-center justify-center text-warnaTombol flex-shrink-0">
                <Target class="w-5 h-5" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wide">Visi Utama</h4>
                <p class="text-xs text-slate-400 leading-relaxed mt-1">
                  Menjadi penyedia platform transportasi sekolah digital terdepan di Indonesia yang dipercaya karena jaminan keselamatan, keakuratan data, dan kenyamanan perjalanan anak-anak.
                </p>
              </div>
            </div>

            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-xl bg-warnaAksen flex items-center justify-center text-warnaTombol flex-shrink-0">
                <Award class="w-5 h-5" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wide">Misi Kami</h4>
                <ul class="list-disc pl-4 text-xs text-slate-400 leading-relaxed mt-1 space-y-1">
                  <li>Menghadirkan fitur pelacakan GPS real-time yang mudah diakses kapan saja.</li>
                  <li>Melakukan standardisasi dan verifikasi ketat terhadap kredibilitas pengemudi armada.</li>
                  <li>Memudahkan sistem administrasi sekolah dan billing pembayaran bulanan orang tua secara transparan.</li>
                </ul>
              </div>
            </div>
          </div>
        </KartuUtama>
      </div>

      <!-- Area Layanan & Legalitas -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Area Layanan -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-6 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="p-3 bg-warnaAksen/20 rounded-xl text-warnaTombol w-fit">
              <MapPin class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-bold text-white">Area Layanan Operasional</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Saat ini, seluruh armada terverifikasi Denanta TranSolution melayani rute perjalanan di area **Kota Padang, Sumatra Barat**. Kami mencakup sekolah-sekolah di kecamatan Padang Barat, Padang Timur, Padang Utara, Kuranji, dan sekitarnya.
            </p>
          </div>
        </div>

        <!-- Legalitas -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-6 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="p-3 bg-warnaAksen/20 rounded-xl text-warnaTombol w-fit">
              <ShieldCheck class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-bold text-white">Legalitas & Komitmen Usaha</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Denanta TranSolution merupakan platform resmi di bawah naungan badan hukum berizin. Kami berkomitmen menjaga kepercayaan Anda dengan mematuhi regulasi transportasi anak sekolah setempat dan menyertakan asuransi perjalanan pelindung di setiap armada aktif.
            </p>
          </div>
        </div>
      </div>

      <!-- Komitmen Keamanan -->
      <section class="bg-gradient-to-r from-warnaSekunder to-warnaUtama border border-warnaAksen/30 rounded-2xl p-8 md:p-12 text-center space-y-6">
        <h3 class="text-2xl font-bold text-white">Komitmen Keamanan & Keselamatan</h3>
        <p class="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Setiap armada diwajibkan melewati pengecekan fisik berkala, dan supir wajib mengunggah SIM, STNK, serta Surat Keterangan Catatan Kepolisian (SKCK) aktif sebelum diverifikasi oleh tim administrasi kami.
        </p>
        <div class="flex flex-wrap justify-center gap-6 pt-4 text-xs font-semibold text-slate-300">
          <span class="flex items-center gap-1.5"><ShieldCheck class="w-4 h-4 text-warnaTombol" /> Verifikasi SKCK Supir</span>
          <span class="flex items-center gap-1.5"><ShieldCheck class="w-4 h-4 text-warnaTombol" /> Cek Fisik Berkala Armada</span>
          <span class="flex items-center gap-1.5"><ShieldCheck class="w-4 h-4 text-warnaTombol" /> Proteksi Asuransi Perjalanan</span>
        </div>
      </section>
    </div>
  </TataLetakTamu>
</template>
