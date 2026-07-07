<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import PenilaianSupir from './PenilaianSupir.vue';

// Mock Data
const anakTerpilih = ref('semua');
const filterTanggal = ref('');

const daftarAnak = ['Aisyah Putri'];

const daftarPerjalanan = ref([
  {
    id: 'trip-1',
    tanggal: '2026-07-06',
    anak: 'Aisyah Putri',
    jenis: 'Antar Jemput (PP)',
    status: 'rumah',
    waktuPergi: '06:15 - 06:40',
    waktuPulang: '13:00 - 13:25',
    supir: 'Pak Budi',
    durasi: '25 Menit',
    terekspand: false,
  },
  {
    id: 'trip-2',
    tanggal: '2026-07-03',
    anak: 'Aisyah Putri',
    jenis: 'Antar Jemput (PP)',
    status: 'rumah',
    waktuPergi: '06:20 - 06:48',
    waktuPulang: '13:00 - 13:28',
    supir: 'Pak Budi',
    durasi: '28 Menit',
    terekspand: false,
  },
  {
    id: 'trip-3',
    tanggal: '2026-07-02',
    anak: 'Aisyah Putri',
    jenis: 'Antar Jemput (PP)',
    status: 'rumah',
    waktuPergi: '06:12 - 06:34',
    waktuPulang: '13:05 - 13:27',
    supir: 'Pak Budi',
    durasi: '22 Menit',
    terekspand: false,
  }
]);

const perjalananTerfilter = computed(() => {
  return daftarPerjalanan.value.filter(trip => {
    const cocokAnak = anakTerpilih.value === 'semua' || trip.anak === anakTerpilih.value;
    const cocokTanggal = !filterTanggal.value || trip.tanggal === filterTanggal.value;
    return cocokAnak && cocokTanggal;
  });
});

const toggleExpand = (id: string) => {
  const trip = daftarPerjalanan.value.find(t => t.id === id);
  if (trip) {
    trip.terekspand = !trip.terekspand;
  }
};
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Histori Perjalanan Siswa</h1>
      <p class="text-xs text-slate-400">Tinjau seluruh riwayat ketibaan dan kepulangan anak Anda.</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Anak:</label>
        <select 
          v-model="anakTerpilih"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
        >
          <option value="semua">Semua Anak</option>
          <option v-for="a in daftarAnak" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Tanggal:</label>
        <input 
          type="date" 
          v-model="filterTanggal"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol font-mono"
        />
      </div>
    </div>

    <!-- Riwayat Table -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Tanggal</th>
              <th class="py-3 px-4">Nama Anak</th>
              <th class="py-3 px-4">Layanan</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <template v-for="trip in perjalananTerfilter" :key="trip.id">
              <tr class="hover:bg-warnaUtama/20 transition-colors">
                <td class="py-4 px-4 font-mono font-bold">{{ new Date(trip.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</td>
                <td class="py-4 px-4 font-semibold text-white">{{ trip.anak }}</td>
                <td class="py-4 px-4">{{ trip.jenis }}</td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase text-[10px]">Tiba Rumah</span>
                </td>
                <td class="py-4 px-4 text-right">
                  <button 
                    @click="toggleExpand(trip.id)" 
                    class="text-warnaTombol hover:underline font-bold flex items-center gap-0.5 ml-auto cursor-pointer"
                  >
                    Detail
                    <ChevronDown v-if="!trip.terekspand" class="w-3.5 h-3.5" />
                    <ChevronUp v-else class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              <!-- Expandable details -->
              <tr v-show="trip.terekspand" class="bg-warnaUtama/30">
                <td colspan="5" class="p-6 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs border-b border-warnaAksen/10 pb-4">
                    <div>
                      <p class="text-slate-500 font-bold uppercase text-[9px]">Supir Pendamping:</p>
                      <p class="text-white font-bold mt-1">{{ trip.supir }}</p>
                    </div>
                    <div>
                      <p class="text-slate-500 font-bold uppercase text-[9px]">Durasi Tempuh:</p>
                      <p class="text-white font-bold mt-1 font-mono">{{ trip.durasi }}</p>
                    </div>
                    <div>
                      <p class="text-slate-500 font-bold uppercase text-[9px]">Jam Operasional:</p>
                      <p class="text-white mt-1">Pergi: <strong class="font-mono text-warnaTombol">{{ trip.waktuPergi }}</strong> | Pulang: <strong class="font-mono text-warnaTombol">{{ trip.waktuPulang }}</strong></p>
                    </div>
                  </div>

                  <!-- Inline Driver Review Widget -->
                  <div class="max-w-md">
                    <PenilaianSupir :namaSupir="trip.supir" />
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="perjalananTerfilter.length === 0">
              <td colspan="5" class="py-8 text-center text-slate-500 italic">Tidak ada catatan perjalanan ditemukan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
