<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: 'berangkat' | 'sekolah' | 'pulang' | 'rumah' | 'absen' | string;
}

const props = defineProps<Props>();

const konfigurasiBadge = computed(() => {
  switch (props.status.toLowerCase()) {
    case 'berangkat':
      return { teks: 'Pergi Sekolah', kelas: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'sekolah':
      return { teks: 'Di Sekolah', kelas: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'pulang':
      return { teks: 'Perjalanan Pulang', kelas: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    case 'rumah':
      return { teks: 'Tiba di Rumah', kelas: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'absen':
      return { teks: 'Absen/Libur', kelas: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    default:
      return { teks: 'Belum Aktif', kelas: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  }
});
</script>

<template>
  <span 
    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
    :class="konfigurasiBadge.kelas"
  >
    <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-current"></span>
    {{ konfigurasiBadge.teks }}
  </span>
</template>
