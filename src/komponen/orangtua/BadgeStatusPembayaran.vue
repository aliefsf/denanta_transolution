<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: 'lunas' | 'menunggu' | 'kedaluwarsa' | 'ditangguhkan' | string;
}

const props = defineProps<Props>();

const konfigurasiBadge = computed(() => {
  switch (props.status.toLowerCase()) {
    case 'lunas':
      return { teks: 'Lunas', kelas: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'menunggu':
      return { teks: 'Belum Bayar', kelas: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse' };
    case 'kedaluwarsa':
      return { teks: 'Kedaluwarsa', kelas: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    case 'ditangguhkan':
      return { teks: 'Ditangguhkan', kelas: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    default:
      return { teks: 'Draft', kelas: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
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
