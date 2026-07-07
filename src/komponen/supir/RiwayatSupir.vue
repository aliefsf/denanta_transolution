<script setup lang="ts">
import { ref, computed } from 'vue';

// Filter
const filterTanggal = ref('');

// Mock Data Riwayat Supir
const riwayatSupir = ref([
  { tanggal: '2026-07-06', anak: 'Aisyah Putri', sekolah: 'SD N 01 Padang', status: 'Selesai', jarak: 4.6, waktu: '06:15 - 06:40' },
  { tanggal: '2026-07-06', anak: 'Rafi Alief', sekolah: 'SD N 01 Padang', status: 'Selesai', jarak: 3.8, waktu: '06:20 - 06:45' },
  { tanggal: '2026-07-03', anak: 'Aisyah Putri', sekolah: 'SD N 01 Padang', status: 'Selesai', jarak: 4.6, waktu: '06:15 - 06:42' },
  { tanggal: '2026-07-02', anak: 'Aisyah Putri', sekolah: 'SD N 01 Padang', status: 'Selesai', jarak: 4.6, waktu: '06:15 - 06:38' }
]);

const riwayatTerfilter = computed(() => {
  return riwayatSupir.value.filter(item => {
    return !filterTanggal.value || item.tanggal === filterTanggal.value;
  });
});

const totalPerjalanan = computed(() => riwayatTerfilter.value.length);
const totalJarak = computed(() => {
  const sum = riwayatTerfilter.value.reduce((sum, item) => sum + item.jarak, 0);
  return sum.toFixed(1);
});
const totalAnakDilayani = computed(() => {
  const setAnak = new Set(riwayatTerfilter.value.map(item => item.anak));
  return setAnak.size;
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Riwayat Perjalanan & Tugas</h1>
      <p class="text-xs text-slate-400">Tinjau rangkuman produktivitas dan kilometer tempuh armada Anda.</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl max-w-sm shadow text-xs">
      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Tanggal Perjalanan:</label>
      <input 
        type="date" 
        v-model="filterTanggal"
        class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol font-mono"
      />
    </div>

    <!-- Summary Widgets Grid -->
    <div class="grid grid-cols-3 gap-4">
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-1 text-center shadow">
        <p class="text-[10px] text-slate-500 font-bold uppercase">Total Perjalanan</p>
        <p class="text-2xl font-black text-white font-mono">{{ totalPerjalanan }}</p>
      </div>
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-1 text-center shadow">
        <p class="text-[10px] text-slate-500 font-bold uppercase">Total Jarak Tempuh</p>
        <p class="text-2xl font-black text-warnaTombol font-mono">{{ totalJarak }} <span class="text-xs font-normal text-slate-400">KM</span></p>
      </div>
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-1 text-center shadow">
        <p class="text-[10px] text-slate-500 font-bold uppercase">Anak Dilayani</p>
        <p class="text-2xl font-black text-white font-mono">{{ totalAnakDilayani }}</p>
      </div>
    </div>

    <!-- History Table -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Tanggal</th>
              <th class="py-3 px-4">Nama Siswa</th>
              <th class="py-3 px-4">Sekolah Asal</th>
              <th class="py-3 px-4">Status Sesi</th>
              <th class="py-3 px-4">Jarak</th>
              <th class="py-3 px-4 text-right">Jam Operasional</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="(item, idx) in riwayatTerfilter" :key="idx" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-mono font-bold">{{ new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) }}</td>
              <td class="py-4 px-4 font-semibold text-white">{{ item.anak }}</td>
              <td class="py-4 px-4">{{ item.sekolah }}</td>
              <td class="py-4 px-4">
                <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[9px] uppercase">
                  {{ item.status }}
                </span>
              </td>
              <td class="py-4 px-4 font-mono">{{ item.jarak }} KM</td>
              <td class="py-4 px-4 text-right font-mono text-slate-400 font-semibold">{{ item.waktu }}</td>
            </tr>
            <tr v-if="riwayatTerfilter.length === 0">
              <td colspan="6" class="py-8 text-center text-slate-500 italic">Tidak ada histori perjalanan ditemukan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
