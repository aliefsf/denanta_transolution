<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  tipe?: 'button' | 'submit' | 'reset';
  varian?: 'utama' | 'sekunder' | 'aksen' | 'bahaya' | 'garis-luar';
  ukuran?: 'kecil' | 'sedang' | 'besar';
  nonaktif?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  tipe: 'button',
  varian: 'utama',
  ukuran: 'sedang',
  nonaktif: false,
});

const kelasVarian = computed(() => {
  switch (props.varian) {
    case 'utama':
      return 'bg-warnaTombol hover:bg-opacity-90 text-white shadow-md focus:ring-warnaTombol';
    case 'sekunder':
      return 'bg-warnaSekunder hover:bg-warnaAksen text-white shadow focus:ring-warnaAksen';
    case 'aksen':
      return 'bg-warnaAksen hover:bg-opacity-90 text-white focus:ring-warnaAksen';
    case 'bahaya':
      return 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
    case 'garis-luar':
      return 'bg-transparent border border-warnaAksen text-slate-300 hover:bg-warnaSekunder focus:ring-warnaAksen';
    default:
      return 'bg-warnaTombol text-white';
  }
});

const kelasUkuran = computed(() => {
  switch (props.ukuran) {
    case 'kecil':
      return 'px-3 py-1.5 text-xs font-medium';
    case 'sedang':
      return 'px-4 py-2 text-sm font-semibold';
    case 'besar':
      return 'px-6 py-3 text-base font-bold';
    default:
      return 'px-4 py-2 text-sm font-semibold';
  }
});
</script>

<template>
  <button
    :type="tipe"
    :disabled="nonaktif"
    class="inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-warnaUtama disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
    :class="[kelasVarian, kelasUkuran]"
  >
    <slot />
  </button>
</template>
