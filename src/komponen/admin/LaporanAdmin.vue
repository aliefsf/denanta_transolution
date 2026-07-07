<script setup lang="ts">
import { ref } from 'vue';
import { FileDown, Users, Star, Award, Heart, Printer } from 'lucide-vue-next';
import FilterLaporan from './FilterLaporan.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Sub-tabs: pelanggan, performa, kepuasan
const laporanTab = ref('pelanggan');

// Mock Data
const listPelanggan = ref([
  { bulan: 'Juli 2026', aktif: 120, baru: 15, berhenti: 2 },
  { bulan: 'Juni 2026', aktif: 107, baru: 18, berhenti: 1 },
  { bulan: 'Mei 2026', aktif: 90, baru: 12, berhenti: 3 }
]);

const listPerformaSupir = ref([
  { nama: 'Budi Santoso', ketepatan: '98%', perjalanan: 48, rating: 4.9, komplain: 0 },
  { nama: 'Andi Pratama', ketepatan: '92%', perjalanan: 44, rating: 4.5, komplain: 1 }
]);

const sentimenPositif = ref(94); // Sentiment analysis score
const ulasanTerakhir = ref([
  { wali: 'Orang Tua Aisyah', bintang: 5, ulasan: 'Layanan luar biasa aman, supir sangat sopan.', sentimen: 'Positif' },
  { wali: 'Orang Tua Rafi', bintang: 4, ulasan: 'Armada bersih, penjemputan sangat terjadwal.', sentimen: 'Positif' }
]);

const cetakLaporan = () => {
  picuToast('Mempersiapkan dokumen cetak PDF laporan operasional...', 'info');
};

const eksporCSV = () => {
  picuToast('Mengunduh berkas laporan dalam format spreadsheet .CSV...', 'sukses');
};
</script>

<template>
  <div class="space-y-6">
    <!-- Toast Alert -->
    <NotifikasiUtama 
      :tampil="toastTampil" 
      :pesan="toastPesan" 
      :tipe="toastTipe" 
      @tutup="toastTampil = false" 
    />

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Laporan & Analisis Data</h1>
        <p class="text-xs text-slate-400">Tinjau performa ketepatan waktu armada dan pertumbuhan nasabah.</p>
      </div>

      <div class="flex gap-2">
        <button 
          @click="eksporCSV"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaSekunder hover:bg-opacity-95 text-slate-200 cursor-pointer border border-warnaAksen/30"
        >
          <FileDown class="w-4 h-4 text-warnaTombol" /> Ekspor CSV
        </button>

        <button 
          @click="cetakLaporan"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaAksen hover:bg-opacity-95 text-white cursor-pointer border border-warnaAksen"
        >
          <Printer class="w-4 h-4 text-warnaTombol fill-warnaTombol" /> Cetak PDF
        </button>
      </div>
    </div>

    <!-- Filter Component -->
    <FilterLaporan @terapkan="picuToast('Rentang periode laporan berhasil diperbarui!', 'info')" />

    <!-- Tabs Navigation -->
    <div class="flex border-b border-warnaAksen/20 text-xs">
      <button 
        @click="laporanTab = 'pelanggan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'pelanggan' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Users class="w-4 h-4" /> Pelanggan Aktif
      </button>
      <button 
        @click="laporanTab = 'performa'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'performa' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Award class="w-4 h-4" /> Performa Driver
      </button>
      <button 
        @click="laporanTab = 'kepuasan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'kepuasan' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Heart class="w-4 h-4" /> Kepuasan Wali
      </button>
    </div>

    <!-- Tab Contents -->
    <div class="space-y-6">
      
      <!-- 1. Laporan Pelanggan -->
      <div v-if="laporanTab === 'pelanggan'" class="space-y-6">
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Grafik Pertumbuhan Pelanggan Aktif</h3>
          
          <div class="w-full h-44">
            <svg viewBox="0 0 500 120" class="w-full h-full text-warnaTombol">
              <defs>
                <linearGradient id="laporanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#e94560" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#e94560" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path d="M 50 100 L 50 70 L 250 50 L 450 20 L 450 100 Z" fill="url(#laporanGrad)" />
              <path d="M 50 70 L 250 50 L 450 20" fill="none" stroke="#e94560" stroke-width="3" stroke-linecap="round" />
              <circle cx="50" cy="70" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
              <circle cx="250" cy="50" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
              <circle cx="450" cy="20" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>

              <text x="50" y="115" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Mei</text>
              <text x="250" y="115" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Juni</text>
              <text x="450" y="115" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Juli</text>
            </svg>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px] py-3">
                <th class="py-3 px-4">Periode Bulan</th>
                <th class="py-3 px-4">Total Pelanggan Aktif</th>
                <th class="py-3 px-4">Pelanggan Baru</th>
                <th class="py-3 px-4">Berhenti Berlangganan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
              <tr v-for="pel in listPelanggan" :key="pel.bulan" class="hover:bg-warnaUtama/20 transition-colors">
                <td class="py-3.5 px-4 font-bold">{{ pel.bulan }}</td>
                <td class="py-3.5 px-4 font-mono font-bold">{{ pel.aktif }} Wali Murid</td>
                <td class="py-3.5 px-4 font-mono text-emerald-400 font-semibold">+{{ pel.baru }}</td>
                <td class="py-3.5 px-4 font-mono text-rose-400 font-semibold">-{{ pel.berhenti }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. Laporan Performa Driver -->
      <div v-else-if="laporanTab === 'performa'" class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px] py-3">
              <th class="py-3 px-4">Nama Driver</th>
              <th class="py-3 px-4">Rasio Ketepatan Waktu</th>
              <th class="py-3 px-4">Total Sesi Perjalanan</th>
              <th class="py-3 px-4">Rata-rata Rating Wali</th>
              <th class="py-3 px-4">Jumlah Komplain</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="sup in listPerformaSupir" :key="sup.nama" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-semibold text-white">{{ sup.nama }}</td>
              <td class="py-4 px-4 font-mono text-emerald-400 font-bold">{{ sup.ketepatan }}</td>
              <td class="py-4 px-4 font-mono">{{ sup.perjalanan }} Trip</td>
              <td class="py-4 px-4 font-mono font-bold text-amber-400 flex items-center gap-1">
                <Star class="w-3.5 h-3.5 fill-current" /> {{ sup.rating }}
              </td>
              <td class="py-4 px-4 font-mono font-bold" :class="sup.komplain > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'">
                {{ sup.komplain }} Kasus
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. Laporan Kepuasan -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sentiment meter -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-center flex flex-col justify-center items-center">
          <p class="text-[10px] text-slate-500 font-bold uppercase">Analisis Sentimen Kepuasan</p>
          <div class="relative w-28 h-28 flex items-center justify-center">
            <!-- Circular Progress SVG mockup -->
            <svg class="w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="44" stroke="#16213e" stroke-width="8" fill="transparent" />
              <circle cx="56" cy="56" r="44" stroke="#e94560" stroke-width="8" fill="transparent" stroke-dasharray="276" stroke-dashoffset="16" />
            </svg>
            <span class="absolute text-2xl font-black text-white font-mono">{{ sentimenPositif }}%</span>
          </div>
          <p class="text-xs text-emerald-400 font-bold">Mayoritas wali merasa sangat terbantu & aman</p>
        </div>

        <!-- Feedback review list -->
        <div class="lg:col-span-2 bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-xs">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Ulasan & Kritik Pelanggan Terakhir</h3>
          <div class="space-y-3">
            <div 
              v-for="(ul, idx) in ulasanTerakhir" 
              :key="idx"
              class="border-b border-warnaAksen/10 pb-3 last:border-b-0 space-y-1.5"
            >
              <div class="flex justify-between items-center text-[10px]">
                <span class="font-bold text-slate-400">{{ ul.wali }}</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase text-[9px]">{{ ul.sentimen }}</span>
              </div>
              <p class="text-[11px] text-slate-200 italic">"{{ ul.ulasan }}"</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
