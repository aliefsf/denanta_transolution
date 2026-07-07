<script setup lang="ts">
import { Navigation, AlertTriangle, ExternalLink } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';

interface Props {
  anak: any;
  urutan: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'buka-status', anak: any): void;
  (e: 'buka-kendala', anak: any): void;
}>();

const dapatkanTeksStatus = (stat: string) => {
  switch (stat.toLowerCase()) {
    case 'berangkat':
      return { teks: 'Dalam Perjalanan Pergi', kelas: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'sekolah':
      return { teks: 'Tiba di Sekolah', kelas: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'pulang':
      return { teks: 'Dalam Perjalanan Pulang', kelas: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    case 'rumah':
      return { teks: 'Tiba di Rumah (Selesai)', kelas: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    default:
      return { teks: 'Belum Dijemput', kelas: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  }
};
</script>

<template>
  <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow flex flex-col justify-between">
    <div class="space-y-3">
      <!-- Header with Route Order & Status Badge -->
      <div class="flex justify-between items-center gap-2">
        <span class="inline-block px-2.5 py-0.5 rounded-lg bg-warnaAksen/40 border border-warnaAksen text-white font-bold font-mono text-[10px]">
          Urutan Rute: {{ urutan }}
        </span>
        <span 
          class="inline-block px-2.5 py-0.5 rounded-lg border text-[10px] font-bold"
          :class="dapatkanTeksStatus(anak.status).kelas"
        >
          {{ dapatkanTeksStatus(anak.status).teks }}
        </span>
      </div>

      <!-- Student Info -->
      <div class="flex items-start gap-3">
        <img :src="anak.foto" :alt="anak.nama" class="w-12 h-12 rounded-xl object-cover border border-warnaAksen/30 flex-shrink-0" />
        <div class="space-y-0.5">
          <h4 class="text-sm font-bold text-white">{{ anak.nama }}</h4>
          <p class="text-[10px] text-slate-400">{{ anak.sekolah }} | {{ anak.kelas }}</p>
          <p class="text-[10px] text-slate-500 truncate max-w-[200px]" :title="anak.alamatJemput">
            {{ anak.alamatJemput }}
          </p>
        </div>
      </div>
    </div>

    <!-- Actions Footer Bar -->
    <div class="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-warnaAksen/20">
      <!-- Google Maps External Link -->
      <a 
        :href="`https://www.google.com/maps/search/?api=1&query=${anak.lintangJemput},${anak.bujurJemput}`" 
        target="_blank" 
        class="col-span-2"
      >
        <TombolUtama varian="garis-luar" class="w-full text-[10px] py-1.5 gap-1 justify-center">
          <Navigation class="w-3.5 h-3.5" />
          Navigasi Google Maps
          <ExternalLink class="w-3 h-3 text-slate-500" />
        </TombolUtama>
      </a>

      <!-- Report Obstacle Button -->
      <button 
        @click="emit('buka-kendala', anak)"
        class="flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
      >
        <AlertTriangle class="w-3.5 h-3.5" />
        Kendala
      </button>

      <!-- Update Status Button -->
      <button 
        @click="emit('buka-status', anak)"
        class="flex items-center justify-center gap-1 py-2 rounded-xl bg-warnaTombol hover:bg-opacity-95 text-white font-bold text-[10px] cursor-pointer transition-colors"
      >
        Update Status
      </button>
    </div>
  </div>
</template>
