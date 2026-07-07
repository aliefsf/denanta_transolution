<script setup lang="ts">
import { ref } from 'vue';
import { ClipboardList, UserCheck, Play, Bell, AlertTriangle } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

interface Props {
  siapKerja: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
  (e: 'ubah-siap', status: boolean): void;
}>();

// Mock metrics
const jmpPagiCount = ref(3);
const jmpSoreCount = ref(3);

const tugasPagiSelesai = ref(false);
const tugasSoreSelesai = ref(false);

const adaNotifTugasBaru = ref(true);

const mulaiBertugas = () => {
  emit('ubah-siap', true);
  emit('ubah-tab', 'tugas');
};
</script>

<template>
  <div class="space-y-6">
    <!-- Pop-up Alert Tugas Baru (whatsapp integrated simulation) -->
    <div 
      v-if="adaNotifTugasBaru" 
      class="bg-warnaSekunder border border-warnaTombol/40 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg text-xs relative overflow-hidden"
    >
      <div class="absolute left-0 top-0 bottom-0 w-1 bg-warnaTombol"></div>
      <div class="flex items-start gap-3">
        <Bell class="w-8 h-8 text-warnaTombol flex-shrink-0 animate-swing" />
        <div class="space-y-1 text-slate-300">
          <h4 class="font-bold text-white text-sm">Pemberitahuan Tugas Baru Diterima!</h4>
          <p class="leading-relaxed">
            Anda menerima penugasan jemputan baru untuk sesi <strong>Pagi SD N 01 Padang</strong>. Rute optimal telah diperbarui otomatis.
          </p>
        </div>
      </div>
      <div class="flex gap-2 w-full md:w-auto">
        <TombolUtama varian="garis-luar" class="text-[11px] py-1.5 w-full md:w-auto" @click="adaNotifTugasBaru = false">
          Tutup
        </TombolUtama>
        <TombolUtama varian="utama" class="text-[11px] py-1.5 w-full md:w-auto" @click="emit('ubah-tab', 'tugas')">
          Lihat Tugas
        </TombolUtama>
      </div>
    </div>

    <!-- Summary Indicators -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- 1. Jemput Pagi -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Jumlah Siswa Jemput Pagi</span>
          <ClipboardList class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white tracking-wide">
          {{ jmpPagiCount }}
          <span class="text-xs font-normal text-slate-400">anak</span>
        </p>
        <p class="text-[10px] text-slate-500">Tujuan: SD N 01 Padang & SMP N 1 Padang</p>
      </div>

      <!-- 2. Antar Sore -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Jumlah Siswa Antar Sore</span>
          <ClipboardList class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white tracking-wide">
          {{ jmpSoreCount }}
          <span class="text-xs font-normal text-slate-400">anak</span>
        </p>
        <p class="text-[10px] text-slate-500">Penjemputan sekolah mulai jam 13:00</p>
      </div>

      <!-- 3. Status Kehadiran -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Status Kehadiran</span>
          <UserCheck class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-lg font-bold" :class="siapKerja ? 'text-emerald-400' : 'text-rose-400'">
          {{ siapKerja ? 'SIAP BERTUGAS' : 'TIDAK AKTIF' }}
        </p>
        <div class="pt-0.5">
          <button 
            @click="emit('ubah-siap', !siapKerja)" 
            class="text-[10px] font-bold text-warnaTombol hover:underline"
          >
            Ubah Status Kehadiran
          </button>
        </div>
      </div>
    </div>

    <!-- Sessions Summary Cards -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Pagi Sesi -->
      <KartuUtama judul="Sesi Jemputan Pagi (06:00 - 07:15)" subjudul="Sekolah Tujuan: SD N 01 Padang">
        <div class="space-y-4 text-xs">
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">Total Rute Titik Jemput:</span>
            <span class="text-white font-bold">3 Rumah Kediaman</span>
          </div>
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">Status Sesi Hari Ini:</span>
            <span class="font-bold uppercase" :class="tugasPagiSelesai ? 'text-emerald-400' : 'text-amber-400'">
              {{ tugasPagiSelesai ? 'Lengkap Selesai' : 'Belum Mulai' }}
            </span>
          </div>
          
          <div v-if="!siapKerja" class="flex gap-2 text-[10px] text-rose-300 bg-rose-950/20 p-3 rounded-lg border border-rose-500/20">
            <AlertTriangle class="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>Aktifkan status siap bertugas Anda terlebih dahulu sebelum memulai navigasi jemputan anak.</span>
          </div>
          
          <div class="pt-2 flex justify-end">
            <TombolUtama varian="utama" class="gap-1.5 text-xs py-2" @click="mulaiBertugas">
              <Play class="w-3.5 h-3.5" />
              Mulai Tugas Pagi
            </TombolUtama>
          </div>
        </div>
      </KartuUtama>

      <!-- Sore Sesi -->
      <KartuUtama judul="Sesi Jemputan Sore (12:45 - 14:15)" subjudul="Sekolah Asal: SD N 01 Padang & SMP N 1 Padang">
        <div class="space-y-4 text-xs">
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">Total Rute Titik Antar:</span>
            <span class="text-white font-bold">3 Siswa</span>
          </div>
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">Status Sesi Hari Ini:</span>
            <span class="font-bold uppercase" :class="tugasSoreSelesai ? 'text-emerald-400' : 'text-amber-400'">
              {{ tugasSoreSelesai ? 'Lengkap Selesai' : 'Belum Mulai' }}
            </span>
          </div>

          <div class="pt-2 flex justify-end">
            <TombolUtama 
              varian="utama" 
              class="gap-1.5 text-xs py-2" 
              @click="mulaiBertugas"
            >
              <Play class="w-3.5 h-3.5" />
              Mulai Tugas Sore
            </TombolUtama>
          </div>
        </div>
      </KartuUtama>

    </div>
  </div>
</template>
