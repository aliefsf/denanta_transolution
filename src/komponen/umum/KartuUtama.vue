<script setup lang="ts">
interface Props {
  judul?: string;
  subjudul?: string;
  tanpaPadding?: boolean;
}

withDefaults(defineProps<Props>(), {
  tanpaPadding: false,
});
</script>

<template>
  <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-warnaAksen/60">
    <!-- Header Kartu -->
    <div v-if="judul || $slots.header" class="px-5 py-4 border-b border-warnaAksen/30 flex items-center justify-between">
      <slot name="header">
        <div>
          <h3 class="text-lg font-bold text-white tracking-wide">{{ judul }}</h3>
          <p v-if="subjudul" class="text-xs text-slate-400 mt-0.5">{{ subjudul }}</p>
        </div>
      </slot>
    </div>

    <!-- Body Kartu -->
    <div :class="tanpaPadding ? '' : 'p-5'">
      <slot />
    </div>

    <!-- Footer Kartu -->
    <div v-if="$slots.footer" class="px-5 py-3 bg-warnaUtama/40 border-t border-warnaAksen/20">
      <slot name="footer" />
    </div>
  </div>
</template>
