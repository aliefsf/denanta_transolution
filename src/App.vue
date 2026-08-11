<script setup lang="ts">
import PengaturanWaktuDemo from './komponen/umum/PengaturanWaktuDemo.vue';

// Widget simulasi waktu -- tampil di mode dev (npm run dev) ATAU kalau
// VITE_TAMPILKAN_SIMULASI_WAKTU=true diset di environment variables (dipakai
// supaya bisa tetap tampil di build produksi/hosting Vercel, khusus selama
// masa testing & demo sidang -- tinggal hapus/ubah env var itu jadi false
// di Vercel kapan pun sudah tidak dibutuhkan lagi, tanpa perlu ubah kode).
// Lihat catatan lengkap di PengaturanWaktuDemo.vue.
const modeDev = import.meta.env.DEV || import.meta.env.VITE_TAMPILKAN_SIMULASI_WAKTU === 'true';
</script>

<template>
  <router-view />
  <PengaturanWaktuDemo v-if="modeDev" />
</template>
