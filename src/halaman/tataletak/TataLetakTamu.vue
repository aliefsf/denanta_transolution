<script setup lang="ts">
import NavbarTamu from '../../komponen/umum/NavbarTamu.vue';
import FooterUtama from '../../komponen/umum/FooterUtama.vue';
</script>

<template>
  <div class="flex flex-col min-h-screen bg-warnaUtama text-slate-100">
    <!-- Navbar -->
    <NavbarTamu />

    <!-- Main Content Area -->
    <main class="flex-grow">
      <slot />
    </main>

    <!-- Footer -->
    <FooterUtama />
  </div>
</template>
