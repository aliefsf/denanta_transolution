<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

interface Props {
  tampil: boolean;
  pesan?: string;
  penuhLayar?: boolean;
  // 'gelap' dipakai halaman dengan tema lama, 'terang' dipakai halaman
  // dengan palet Material terang (Admin, Supir, Orang Tua, dst).
  tema?: 'gelap' | 'terang';
}

withDefaults(defineProps<Props>(), {
  tampil: false,
  pesan: 'Memuat data...',
  penuhLayar: false,
  tema: 'gelap',
});
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="tampil"
      :class="[
        penuhLayar ? 'fixed inset-0 z-50 backdrop-blur-md' : 'absolute inset-0 z-10 backdrop-blur-xs',
        penuhLayar ? (tema === 'terang' ? 'bg-white/75' : 'bg-black/75') : (tema === 'terang' ? 'bg-background/70' : 'bg-warnaUtama/70'),
        'flex items-center justify-center p-4'
      ]"
    >
      <div class="text-center space-y-3">
        <Loader2 class="w-10 h-10 animate-spin mx-auto" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'" />
        <p class="text-sm font-semibold tracking-wide" :class="tema === 'terang' ? 'text-on-surface' : 'text-white'">{{ pesan }}</p>
      </div>
    </div>
  </Transition>
</template>
