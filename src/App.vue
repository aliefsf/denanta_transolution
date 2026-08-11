<script setup lang="ts">
import PengaturanWaktuDemo from './komponen/umum/PengaturanWaktuDemo.vue';

// Widget simulasi waktu HANYA untuk mode dev (npm run dev) -- tidak pernah
// ikut ter-bundle ke build produksi (npm run build), lihat catatan di
// PengaturanWaktuDemo.vue.
const modeDev = import.meta.env.DEV;
</script>

<template>
  <router-view />
  <PengaturanWaktuDemo v-if="modeDev" />
</template>
