<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MapPin, Navigation } from 'lucide-vue-next';
import PetaGlobal from './PetaGlobal.vue';

// Filter States
const filterSekolah = ref('semua');
const filterSupir = ref('semua');
const filterStatus = ref('semua');

// Mock Data Supir (Positions)
const supirPositions = ref([
  { id: 'dr-1', nama: 'Budi Santoso', lat: -0.9471, lng: 100.4172, status: 'aktif' as 'aktif' | 'offline', sekolahTujuan: 'SD N 01 Padang' },
  { id: 'dr-2', nama: 'Andi Pratama', lat: -0.9410, lng: 100.4050, status: 'aktif' as 'aktif' | 'offline', sekolahTujuan: 'SMP N 1 Padang' },
  { id: 'dr-3', nama: 'Hendra Wijaya', lat: -0.9320, lng: 100.3800, status: 'offline' as 'aktif' | 'offline', sekolahTujuan: 'SD N 01 Padang' }
]);

const supirTerfilter = computed(() => {
  return supirPositions.value.filter(s => {
    const cocokSekolah = filterSekolah.value === 'semua' || s.sekolahTujuan === filterSekolah.value;
    const cocokSupir = filterSupir.value === 'semua' || s.id === filterSupir.value;
    const cocokStatus = filterStatus.value === 'semua' || s.status === filterStatus.value;
    return cocokSekolah && cocokSupir && cocokStatus;
  });
});

// Simulasi Supabase Realtime updates
let intervalRealtime: any = null;

onMounted(() => {
  intervalRealtime = setInterval(() => {
    // Sedikit ubah lat/lng supir aktif untuk simulasi pergerakan di peta
    supirPositions.value.forEach(s => {
      if (s.status === 'aktif') {
        s.lat += (Math.random() - 0.5) * 0.0008;
        s.lng += (Math.random() - 0.5) * 0.0008;
      }
    });
  }, 3000);
});

onUnmounted(() => {
  if (intervalRealtime) clearInterval(intervalRealtime);
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Pemantauan Armada Global</h1>
        <p class="text-xs text-slate-400">Pantau pergerakan realtime GPS seluruh armada antar-jemput aktif.</p>
      </div>
      
      <!-- Live Sync status badge -->
      <div class="flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        <span>Realtime Supabase Sync</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Sekolah:</label>
        <select 
          v-model="filterSekolah"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
        >
          <option value="semua">Semua Sekolah</option>
          <option value="SD N 01 Padang">SD N 01 Padang</option>
          <option value="SMP N 1 Padang">SMP N 1 Padang</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Supir:</label>
        <select 
          v-model="filterSupir"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
        >
          <option value="semua">Semua Supir</option>
          <option v-for="s in supirPositions" :key="s.id" :value="s.id">{{ s.nama }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Status Armada:</label>
        <select 
          v-model="filterStatus"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
        >
          <option value="semua">Semua Status</option>
          <option value="aktif">Online (Bertugas)</option>
          <option value="offline">Offline</option>
        </select>
      </div>
    </div>

    <!-- Map & Side List Row -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      <!-- Left (3 Columns): Map -->
      <div class="lg:col-span-3 bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Navigation class="w-4 h-4 text-warnaTombol" />
          Peta Lokasi Armada Aktif
        </h3>
        <PetaGlobal :supirList="supirTerfilter" />
      </div>

      <!-- Right (1 Column): Drivers List Status -->
      <div class="space-y-4">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Status Armada</h3>
        
        <div class="space-y-3">
          <div 
            v-for="s in supirTerfilter" 
            :key="s.id"
            class="bg-warnaSekunder border border-warnaAksen/20 p-4 rounded-xl space-y-3 shadow text-xs"
          >
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-bold text-white">{{ s.nama }}</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">Tujuan: {{ s.sekolahTujuan }}</p>
              </div>
              <span 
                class="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                :class="s.status === 'aktif' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'"
              >
                {{ s.status === 'aktif' ? 'Aktif' : 'Offline' }}
              </span>
            </div>
            
            <div v-if="s.status === 'aktif'" class="flex items-center gap-2 pt-2 border-t border-warnaAksen/10 text-[10px] text-slate-400">
              <MapPin class="w-3.5 h-3.5 text-warnaTombol" />
              <span class="font-mono">Lat: {{ s.lat.toFixed(4) }}, Lng: {{ s.lng.toFixed(4) }}</span>
            </div>
          </div>
          
          <div v-if="supirTerfilter.length === 0" class="text-center py-6 text-slate-500 italic text-xs">
            Tidak ada supir dengan kriteria filter tersebut.
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
