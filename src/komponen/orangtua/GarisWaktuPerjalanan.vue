<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock, MapPin } from 'lucide-vue-next';

interface Props {
  status: 'berangkat' | 'sekolah' | 'pulang' | 'rumah' | 'absen' | string;
  waktuPagi?: string;
  waktuSekolah?: string;
  waktuSore?: string;
  waktuRumah?: string;
}

const props = withDefaults(defineProps<Props>(), {
  waktuPagi: '06:30 WIB',
  waktuSekolah: '06:55 WIB',
  waktuSore: '13:00 WIB',
  waktuRumah: '13:25 WIB',
});

const tahapan = computed(() => {
  const stat = props.status.toLowerCase();
  return [
    {
      judul: 'Penjemputan Armada (Pagi)',
      deskripsi: 'Armada supir berangkat menjemput anak di rumah',
      waktu: props.waktuPagi,
      selesai: stat === 'berangkat' || stat === 'sekolah' || stat === 'pulang' || stat === 'rumah',
      aktif: stat === 'berangkat',
    },
    {
      judul: 'Tiba di Sekolah',
      deskripsi: 'Siswa absen masuk gerbang sekolah terpadu',
      waktu: props.waktuSekolah,
      selesai: stat === 'sekolah' || stat === 'pulang' || stat === 'rumah',
      aktif: stat === 'sekolah',
    },
    {
      judul: 'Penjemputan Pulang (Sore)',
      deskripsi: 'Armada supir menjemput anak dari sekolah',
      waktu: props.waktuSore,
      selesai: stat === 'pulang' || stat === 'rumah',
      aktif: stat === 'pulang',
    },
    {
      judul: 'Tiba di Rumah',
      deskripsi: 'Siswa sampai kembali di kediaman orang tua',
      waktu: props.waktuRumah,
      selesai: stat === 'rumah',
      aktif: stat === 'rumah',
    }
  ];
});
</script>

<template>
  <div class="space-y-6 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-warnaAksen/30">
    <div 
      v-for="(tahap, idx) in tahapan" 
      :key="idx" 
      class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
    >
      <!-- Indicator Dot -->
      <div 
        class="absolute -left-[21px] w-6 h-6 rounded-full flex items-center justify-center border-2"
        :class="[
          tahap.selesai ? 'bg-warnaTombol border-warnaTombol text-white' : 
          tahap.aktif ? 'bg-warnaUtama border-warnaTombol text-warnaTombol animate-pulse' :
          'bg-warnaUtama border-warnaAksen/40 text-slate-500'
        ]"
      >
        <CheckCircle2 v-if="tahap.selesai" class="w-3.5 h-3.5" />
        <Clock v-else-if="tahap.aktif" class="w-3.5 h-3.5" />
        <MapPin v-else class="w-3 h-3" />
      </div>

      <!-- Text Details -->
      <div>
        <h4 
          class="text-sm font-bold transition-colors"
          :class="tahap.selesai || tahap.aktif ? 'text-white' : 'text-slate-500'"
        >
          {{ tahap.judul }}
        </h4>
        <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ tahap.deskripsi }}</p>
      </div>

      <!-- Timestamp -->
      <div class="text-xs font-mono font-bold text-slate-400 bg-warnaSekunder/50 border border-warnaAksen/10 px-2 py-0.5 rounded-lg w-fit">
        {{ tahap.waktu }}
      </div>
    </div>
  </div>
</template>
