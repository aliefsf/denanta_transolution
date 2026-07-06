<script setup lang="ts">
import NavbarUtama from '../komponen/umum/NavbarUtama.vue';
import FooterUtama from '../komponen/umum/FooterUtama.vue';
import DashboardSupir from '../komponen/supir/DashboardSupir.vue';
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <NavbarUtama />

    <main class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardSupir />
    </main>

    <FooterUtama />
  </div>
</template>
