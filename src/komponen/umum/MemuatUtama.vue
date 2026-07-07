<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

interface Props {
  tampil: boolean;
  pesan?: string;
  penuhLayar?: boolean;
}

withDefaults(defineProps<Props>(), {
  tampil: false,
  pesan: 'Memuat data...',
  penuhLayar: false,
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
        penuhLayar ? 'fixed inset-0 z-50 bg-black/75 backdrop-blur-md' : 'absolute inset-0 z-10 bg-warnaUtama/70 backdrop-blur-xs',
        'flex items-center justify-center p-4'
      ]"
    >
      <div class="text-center space-y-3">
        <Loader2 class="w-10 h-10 text-warnaTombol animate-spin mx-auto" />
        <p class="text-sm font-semibold text-white tracking-wide">{{ pesan }}</p>
      </div>
    </div>
  </Transition>
</template>
