<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: 'terjadwal' | 'penjemputan' | 'menuju_sekolah' | 'sekolah' | 'pulang' | 'sampai_tujuan' | 'rumah' | 'absen' | string;
}

const props = defineProps<Props>();

const konfigurasiBadge = computed(() => {
  switch (props.status.toLowerCase()) {
    case 'terjadwal':
      return { teks: 'Sedang di Rumah', kelas: 'bg-outline-variant/10 text-on-surface-variant border-outline-variant/40' };
    case 'penjemputan':
      return { teks: 'Sedang Dijemput', kelas: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'menuju_sekolah':
      return { teks: 'Menuju Sekolah', kelas: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'sekolah':
      return { teks: 'Di Sekolah', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'pulang':
      return { teks: 'Perjalanan Pulang', kelas: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'sampai_tujuan':
      return { teks: 'Sampai Tujuan', kelas: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'rumah':
      return { teks: 'Sedang di Rumah', kelas: 'bg-outline-variant/10 text-on-surface-variant border-outline-variant/40' };
    case 'absen':
      return { teks: 'Absen/Libur', kelas: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { teks: 'Belum Aktif', kelas: 'bg-outline-variant/10 text-on-surface-variant border-outline-variant/40' };
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
