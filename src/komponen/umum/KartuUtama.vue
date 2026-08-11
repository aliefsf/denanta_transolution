<script setup lang="ts">
interface Props {
  judul?: string;
  subjudul?: string;
  tanpaPadding?: boolean;
  // 'gelap' dipakai halaman dengan tema lama, 'terang' dipakai halaman
  // dengan palet Material terang (Admin, Supir, Orang Tua, dst).
  tema?: 'gelap' | 'terang';
}

withDefaults(defineProps<Props>(), {
  tanpaPadding: false,
  tema: 'gelap',
});
</script>

<template>
  <div
    class="rounded-xl overflow-hidden transition-all duration-300 border"
    :class="tema === 'terang'
      ? 'bg-surface-container-lowest border-outline-variant/30 soft-shadow hover:border-outline-variant/60'
      : 'bg-warnaSekunder border-warnaAksen/30 shadow-lg hover:border-warnaAksen/60'"
  >
    <!-- Header Kartu -->
    <div
      v-if="judul || $slots.header"
      class="px-5 py-4 border-b flex items-center justify-between"
      :class="tema === 'terang' ? 'border-outline-variant/30' : 'border-warnaAksen/30'"
    >
      <slot name="header">
        <div>
          <h3 class="text-lg font-bold tracking-wide" :class="tema === 'terang' ? 'text-on-surface' : 'text-white'">{{ judul }}</h3>
          <p v-if="subjudul" class="text-xs mt-0.5" :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-400'">{{ subjudul }}</p>
        </div>
      </slot>
    </div>

    <!-- Body Kartu -->
    <div :class="tanpaPadding ? '' : 'p-5'">
      <slot />
    </div>

    <!-- Footer Kartu -->
    <div
      v-if="$slots.footer"
      class="px-5 py-3 border-t"
      :class="tema === 'terang' ? 'bg-surface-container border-outline-variant/20' : 'bg-warnaUtama/40 border-warnaAksen/20'"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
