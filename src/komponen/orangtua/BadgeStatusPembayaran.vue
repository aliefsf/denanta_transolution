<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: 'lunas' | 'menunggu' | 'kedaluwarsa' | 'ditangguhkan' | string;
}

const props = defineProps<Props>();

const konfigurasiBadge = computed(() => {
  switch (props.status.toLowerCase()) {
    case 'lunas':
      return { teks: 'Lunas', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'menunggu':
      return { teks: 'Belum Bayar', kelas: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' };
    case 'kedaluwarsa':
      return { teks: 'Kedaluwarsa', kelas: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'ditangguhkan':
      return { teks: 'Ditangguhkan', kelas: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return { teks: 'Draft', kelas: 'bg-outline-variant/10 text-on-surface-variant border-outline-variant/40' };
  }
});
</script>

<template>
  <span 
    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
    :class="konfigurasiBadge.kelas"
  >
    {{ konfigurasiBadge.teks }}
  </span>
</template>
