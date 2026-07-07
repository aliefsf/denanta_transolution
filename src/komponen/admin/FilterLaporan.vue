<script setup lang="ts">
import { ref } from 'vue';
import { Search } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';

const emit = defineEmits<{
  (e: 'terapkan', data: { mulai: string; selesai: string }): void;
}>();

const tanggalMulai = ref('2026-07-01');
const tanggalSelesai = ref('2026-07-31');

const setPreset = (preset: string) => {
  const hariIni = new Date();
  if (preset === 'bulan_ini') {
    tanggalMulai.value = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1).toISOString().split('T')[0];
    tanggalSelesai.value = new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, 0).toISOString().split('T')[0];
  } else if (preset === '3_bulan') {
    tanggalMulai.value = new Date(hariIni.getFullYear(), hariIni.getMonth() - 2, 1).toISOString().split('T')[0];
    tanggalSelesai.value = hariIni.toISOString().split('T')[0];
  }
};

const terapkanFilter = () => {
  emit('terapkan', {
    mulai: tanggalMulai.value,
    selesai: tanggalSelesai.value
  });
};
</script>

<template>
  <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow text-xs">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Start Date -->
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mulai Tanggal:</label>
        <input 
          type="date" 
          v-model="tanggalMulai"
          class="px-3 py-1.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
        />
      </div>

      <!-- End Date -->
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selesai Tanggal:</label>
        <input 
          type="date" 
          v-model="tanggalSelesai"
          class="px-3 py-1.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
        />
      </div>

      <!-- Presets -->
      <div class="flex items-center gap-2 pt-4">
        <button 
          @click="setPreset('bulan_ini')"
          class="px-3 py-1.5 rounded-lg bg-warnaUtama border border-warnaAksen/20 hover:border-warnaTombol text-slate-300 font-semibold cursor-pointer"
        >
          Bulan Ini
        </button>
        <button 
          @click="setPreset('3_bulan')"
          class="px-3 py-1.5 rounded-lg bg-warnaUtama border border-warnaAksen/20 hover:border-warnaTombol text-slate-300 font-semibold cursor-pointer"
        >
          3 Bulan Terakhir
        </button>
      </div>
    </div>

    <!-- Submit -->
    <div class="pt-4 md:pt-0">
      <TombolUtama varian="utama" class="gap-1.5 py-2 text-xs" @click="terapkanFilter">
        <Search class="w-4 h-4" /> Terapkan Filter
      </TombolUtama>
    </div>
  </div>
</template>
