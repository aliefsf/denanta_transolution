<script setup lang="ts">
import { ref } from 'vue';
import { Users, Truck, Navigation, Wallet, AlertTriangle } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

// Mock Statistics
const anakAktif = ref(120);
const supirBertugas = ref(8);
const perjalananBerlangsung = ref(2);
const perjalananSelesai = ref(6);
const pendapatanBulanIni = ref(475000 * 120); // 57,000,000

// Mock Obstacle Warnings
const kendalaTerakhir = ref([
  { id: 'k-1', waktu: '07:05 WIB', supir: 'Budi Santoso', kendaraan: 'HiAce BA 1024 TA', tipe: 'macet', pesan: 'Kemacetan parah di depan Jln. Prof. M. Yamin, rute SD N 01 Padang terlambat 15 menit.' },
  { id: 'k-2', waktu: '06:50 WIB', supir: 'Andi Pratama', kendaraan: 'Elf BA 9931 OP', tipe: 'absen_lokasi', pesan: 'Siswa Rafi Alief tidak ada di gerbang lokasi penjemputan.' }
]);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Dashboard Administrator</h1>
      <p class="text-xs text-slate-400">Ringkasan status operasional armada dan rekonsiliasi billing harian.</p>
    </div>

    <!-- 4 Widgets Row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. Anak Aktif -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-5 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Siswa Aktif</span>
          <Users class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white font-mono">{{ anakAktif }}</p>
        <p class="text-[10px] text-slate-500">Terdaftar di 4 sekolah mitra Kota Padang</p>
      </div>

      <!-- 2. Supir Bertugas -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-5 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Supir Bertugas</span>
          <Truck class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white font-mono">{{ supirBertugas }}</p>
        <p class="text-[10px] text-slate-500">Semua armada berstatus Siap Bertugas</p>
      </div>

      <!-- 3. Status Perjalanan -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-5 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Status Rute Sesi Pagi</span>
          <Navigation class="w-4 h-4 text-warnaTombol" />
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-white font-mono">{{ perjalananBerlangsung }}</span>
          <span class="text-xs text-slate-500">Berlangsung</span>
          <span class="text-slate-400 font-mono">/</span>
          <span class="text-2xl font-black text-white font-mono">{{ perjalananSelesai }}</span>
          <span class="text-xs text-slate-500">Selesai</span>
        </div>
        <p class="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          75% Rute Selesai Diantar
        </p>
      </div>

      <!-- 4. Pendapatan Bulan Ini -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-5 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Pemasukan Bulan Ini</span>
          <Wallet class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-xl md:text-2xl font-black text-white font-mono text-warnaTombol">
          {{ formatMataUang(pendapatanBulanIni) }}
        </p>
        <p class="text-[10px] text-emerald-400 font-semibold">Lunas & Rekonsiliasi Midtrans</p>
      </div>
    </div>

    <!-- Alert / Kendala Banner -->
    <div v-if="kendalaTerakhir.length > 0" class="space-y-3">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle class="w-4.5 h-4.5 text-warnaTombol" />
        Laporan Kendala Jalan Terbaru
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="k in kendalaTerakhir" 
          :key="k.id"
          class="bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 relative text-xs text-slate-300"
        >
          <span class="absolute right-3 top-3 font-mono text-[9px] text-slate-500">{{ k.waktu }}</span>
          <AlertTriangle class="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div class="space-y-1">
            <h4 class="font-bold text-white uppercase text-[10px]">Driver: {{ k.supir }} ({{ k.kendaraan }})</h4>
            <p class="leading-relaxed text-[11px]">{{ k.pesan }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Analytics Charts Row (Using Pure SVGs for extreme lightweight compatibility & aesthetics) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Chart 1: Pelanggan Tren (Line Chart) -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Tren Pertumbuhan Pelanggan (6 Bulan Terakhir)</h3>
        <div class="w-full h-48 relative pt-2">
          <!-- SVG Line Chart representation -->
          <svg viewBox="0 0 500 150" class="w-full h-full text-warnaTombol">
            <defs>
              <linearGradient id="gradientLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#e94560" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#e94560" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <!-- Grid Lines -->
            <line x1="50" y1="20" x2="450" y2="20" stroke="#16213e" stroke-width="1"/>
            <line x1="50" y1="70" x2="450" y2="70" stroke="#16213e" stroke-width="1"/>
            <line x1="50" y1="120" x2="450" y2="120" stroke="#16213e" stroke-width="1"/>
            
            <!-- Area Path -->
            <path d="M 50 120 L 50 90 L 130 80 L 210 60 L 290 50 L 370 30 L 450 20 L 450 120 Z" fill="url(#gradientLine)" />
            
            <!-- Line Path -->
            <path d="M 50 90 L 130 80 L 210 60 L 290 50 L 370 30 L 450 20" fill="none" stroke="#e94560" stroke-width="3" stroke-linecap="round" />
            
            <!-- Points -->
            <circle cx="50" cy="90" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
            <circle cx="130" cy="80" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
            <circle cx="210" cy="60" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
            <circle cx="290" cy="50" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
            <circle cx="370" cy="30" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>
            <circle cx="450" cy="20" r="4" fill="#fff" stroke="#e94560" stroke-width="2"/>

            <!-- Axes Text labels -->
            <text x="50" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Feb</text>
            <text x="130" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Mar</text>
            <text x="210" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Apr</text>
            <text x="290" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Mei</text>
            <text x="370" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Jun</text>
            <text x="450" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Jul</text>
          </svg>
        </div>
      </div>

      <!-- Chart 2: Pendapatan Bulanan (Bar Chart) -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Pemasukan Bulanan (Juta Rupiah)</h3>
        <div class="w-full h-48 relative pt-2">
          <!-- SVG Bar Chart -->
          <svg viewBox="0 0 500 150" class="w-full h-full">
            <!-- Grid Lines -->
            <line x1="50" y1="20" x2="450" y2="20" stroke="#16213e" stroke-width="1"/>
            <line x1="50" y1="70" x2="450" y2="70" stroke="#16213e" stroke-width="1"/>
            <line x1="50" y1="120" x2="450" y2="120" stroke="#16213e" stroke-width="1"/>

            <!-- Bars -->
            <!-- Feb: 30 Juta -->
            <rect x="70" y="70" width="24" height="50" rx="3" fill="#0f3460" class="hover:fill-warnaTombol transition-colors duration-200" />
            <!-- Mar: 35 Juta -->
            <rect x="140" y="60" width="24" height="60" rx="3" fill="#0f3460" class="hover:fill-warnaTombol transition-colors duration-200" />
            <!-- Apr: 42 Juta -->
            <rect x="210" y="50" width="24" height="70" rx="3" fill="#0f3460" class="hover:fill-warnaTombol transition-colors duration-200" />
            <!-- Mei: 46 Juta -->
            <rect x="280" y="45" width="24" height="75" rx="3" fill="#0f3460" class="hover:fill-warnaTombol transition-colors duration-200" />
            <!-- Jun: 52 Juta -->
            <rect x="350" y="35" width="24" height="85" rx="3" fill="#0f3460" class="hover:fill-warnaTombol transition-colors duration-200" />
            <!-- Jul: 57 Juta -->
            <rect x="420" y="25" width="24" height="95" rx="3" fill="#e94560" class="hover:fill-opacity-95 transition-colors duration-200" />

            <!-- Axes text -->
            <text x="82" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">30 Jt</text>
            <text x="152" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">35 Jt</text>
            <text x="222" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">42 Jt</text>
            <text x="292" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">46 Jt</text>
            <text x="362" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">52 Jt</text>
            <text x="432" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold" class="fill-warnaTombol">57 Jt</text>
          </svg>
        </div>
      </div>

    </div>
  </div>
</template>
