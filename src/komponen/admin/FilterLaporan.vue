<script setup lang="ts">
import { ref } from 'vue';
import { Search } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';

const emit = defineEmits<{
  (e: 'terapkan', data: { mulai: string; selesai: string }): void;
}>();

function keTanggalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Default rentang: bulan berjalan (dihitung dari tanggal hari ini, bukan
// literal tanggal tertentu) -- supaya laporan yang memakai filter ini
// (mis. Laporan Keuangan) langsung menampilkan data bulan berjalan begitu
// halaman dibuka, tanpa perlu klik apa pun dulu.
const hariIniAwal = new Date();
const tanggalMulai = ref(keTanggalIso(new Date(hariIniAwal.getFullYear(), hariIniAwal.getMonth(), 1)));
const tanggalSelesai = ref(keTanggalIso(new Date(hariIniAwal.getFullYear(), hariIniAwal.getMonth() + 1, 0)));

const terapkanFilter = () => {
  emit('terapkan', {
    mulai: tanggalMulai.value,
    selesai: tanggalSelesai.value
  });
};

// Preset cepat -- langsung mengisi rentang tanggal DAN menerapkannya
// (sekali klik), tidak perlu menekan "Terapkan Filter" lagi setelahnya.
const pakaiPreset = (preset: 'minggu_ini' | 'bulan_ini' | 'tahun_ini') => {
  const hariIni = new Date();
  if (preset === 'minggu_ini') {
    const hari = hariIni.getDay(); // 0 = Minggu
    const selisihKeSenin = hari === 0 ? 6 : hari - 1;
    const senin = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate() - selisihKeSenin);
    const minggu = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 6);
    tanggalMulai.value = keTanggalIso(senin);
    tanggalSelesai.value = keTanggalIso(minggu);
  } else if (preset === 'bulan_ini') {
    tanggalMulai.value = keTanggalIso(new Date(hariIni.getFullYear(), hariIni.getMonth(), 1));
    tanggalSelesai.value = keTanggalIso(new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, 0));
  } else {
    tanggalMulai.value = keTanggalIso(new Date(hariIni.getFullYear(), 0, 1));
    tanggalSelesai.value = keTanggalIso(new Date(hariIni.getFullYear(), 11, 31));
  }
  terapkanFilter();
};
</script>

<template>
  <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 soft-shadow text-xs">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Start Date -->
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mulai Tanggal:</label>
        <input
          type="date"
          v-model="tanggalMulai"
          class="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
        />
      </div>

      <!-- End Date -->
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Selesai Tanggal:</label>
        <input
          type="date"
          v-model="tanggalSelesai"
          class="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
        />
      </div>

      <!-- Presets (sekali klik, langsung menerapkan) -->
      <div class="flex items-center gap-2 pt-4">
        <button
          @click="pakaiPreset('minggu_ini')"
          class="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 hover:border-primary text-on-surface-variant font-semibold cursor-pointer"
        >
          Minggu Ini
        </button>
        <button
          @click="pakaiPreset('bulan_ini')"
          class="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 hover:border-primary text-on-surface-variant font-semibold cursor-pointer"
        >
          Bulan Ini
        </button>
        <button
          @click="pakaiPreset('tahun_ini')"
          class="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 hover:border-primary text-on-surface-variant font-semibold cursor-pointer"
        >
          Tahun Ini
        </button>
      </div>
    </div>

    <!-- Submit (utk rentang tanggal kustom) -->
    <div class="pt-4 md:pt-0">
      <TombolUtama tema="terang" varian="utama" class="gap-1.5 py-2 text-xs" @click="terapkanFilter">
        <Search class="w-4 h-4" /> Terapkan Filter
      </TombolUtama>
    </div>
  </div>
</template>
