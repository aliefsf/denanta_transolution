<script setup lang="ts">
import { Phone, Mail, MapPin } from 'lucide-vue-next';
</script>

<template>
  <footer class="bg-surface-container-lowest dark:bg-surface-dim border-t border-solid border-outline-variant/30 w-full py-16 relative z-10">
    <div class="flex flex-col md:flex-row justify-between items-center md:items-start px-margin-mobile md:px-margin-desktop gap-10 md:gap-gutter max-w-[1280px] mx-auto text-center md:text-left">
      <div class="flex flex-col items-center md:items-start gap-4">
        <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-12 w-auto" />
        <span class="font-body-md text-body-md text-on-surface-variant max-w-sm leading-relaxed">Memberikan solusi mobilitas yang aman, cerdas, dan terpercaya bagi generasi masa depan di Padang.</span>
        <span class="font-body-md text-body-md text-on-surface-variant mt-4">© {{ new Date().getFullYear() }} Denanta TranSolution. All rights reserved.</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 md:gap-12 text-center md:text-left">
        <div class="flex flex-col items-center md:items-start gap-4">
          <h5 class="font-label-md font-bold text-on-background">Perusahaan</h5>
          <router-link to="/tentang" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Tentang Kami</router-link>
        </div>
        <div class="flex flex-col items-center md:items-start gap-4">
          <h5 class="font-label-md font-bold text-on-background">Layanan</h5>
          <router-link to="/tentang" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Antar Jemput</router-link>
          <router-link to="/berlangganan" class="text-on-surface-variant font-body-md hover:text-primary transition-colors">Rute</router-link>
        </div>
        <div class="flex flex-col items-center md:items-start gap-4">
          <h5 class="font-label-md font-bold text-on-background">Bantuan</h5>
          <a class="text-on-surface-variant font-body-md hover:text-primary transition-colors" href="/#faq">FAQ</a>
        </div>
        <div class="flex flex-col items-center md:items-start gap-4 min-w-0">
          <h5 class="font-label-md font-bold text-on-background">Hubungi Kami</h5>
          <a href="https://wa.me/6281213668215" target="_blank" class="flex items-center gap-2 text-on-surface-variant font-body-md hover:text-primary transition-colors">
            <Phone class="w-4 h-4 shrink-0" />
            <span>+6281213668215</span>
          </a>
          <a href="mailto:denantatransolution@gmail.com" class="flex items-start gap-2 min-w-0 text-on-surface-variant font-body-md hover:text-primary transition-colors">
            <Mail class="w-4 h-4 shrink-0 mt-0.5" />
            <span class="break-all">denantatransolution@gmail.com</span>
          </a>
          <span class="flex items-start gap-2 text-on-surface-variant font-body-md">
            <MapPin class="w-4 h-4 shrink-0 mt-0.5" />
            <span>Tanah Sirah Piai Nan XX, Kota Padang, Sumatera Barat</span>
          </span>
        </div>
      </div>
    </div>
  </footer>
</template>
