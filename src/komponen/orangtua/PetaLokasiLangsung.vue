<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


interface Props {
  lintangRumah?: number;
  bujurRumah?: number;
  lintangSekolah?: number;
  bujurSekolah?: number;
  tinggi?: string;
}

const props = withDefaults(defineProps<Props>(), {
  lintangRumah: -0.9471,
  bujurRumah: 100.4172,
  lintangSekolah: -0.9320,
  bujurSekolah: 100.3800,
  tinggi: '400px',
});

const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;

let penandaBus: L.Marker | null = null;
let ruteGaris: L.Polyline | null = null;
let intervalSimulasi: any = null;

// Custom icons using Leaflet DivIcon for beautiful, modern HTML markers instead of ugly default assets
const ikonRumah = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const ikonSekolah = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const ikonBus = L.divIcon({
  html: `<div class="w-9 h-9 rounded-full bg-warnaTombol border-2 border-white flex items-center justify-center shadow-xl text-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

onMounted(() => {
  if (!wadahPeta.value) return;

  // Inisiasi Peta
  peta = L.map(wadahPeta.value).setView([
    (props.lintangRumah + props.lintangSekolah) / 2,
    (props.bujurRumah + props.bujurSekolah) / 2
  ], 13);

  // CartoDB Dark Matter
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
  }).addTo(peta);

  // Penanda Rumah & Sekolah
  L.marker([props.lintangRumah, props.bujurRumah], { icon: ikonRumah }).addTo(peta)
    .bindPopup('<strong class="text-slate-800">Rumah Siswa</strong>');
  L.marker([props.lintangSekolah, props.bujurSekolah], { icon: ikonSekolah }).addTo(peta)
    .bindPopup('<strong class="text-slate-800">Sekolah Siswa</strong>');

  // Garis Rute (Polyline)
  const titikRute = [
    [props.lintangRumah, props.bujurRumah] as [number, number],
    [props.lintangRumah + 0.003, props.bujurRumah - 0.008] as [number, number],
    [props.lintangRumah + 0.008, props.bujurRumah - 0.018] as [number, number],
    [props.lintangSekolah, props.bujurSekolah] as [number, number]
  ];

  ruteGaris = L.polyline(titikRute, { color: '#0f3460', weight: 4, opacity: 0.8 }).addTo(peta);

  // Zoom fitbounds
  peta.fitBounds(ruteGaris.getBounds(), { padding: [40, 40] });

  // Inisiasi Penanda Bus
  let langkahAktif = 0;
  const totalLangkah = 40;
  
  // Hitung interpolasi koordinat rute
  const dapatkanKoordinatLangkah = (prog: number) => {
    // Sederhanakan dengan linear interpolasi antar titik rute
    const segmen = titikRute.length - 1;
    const rasioSegmen = 1 / segmen;
    const idxSegmen = Math.min(Math.floor(prog / rasioSegmen), segmen - 1);
    
    const progLokal = (prog - (idxSegmen * rasioSegmen)) / rasioSegmen;
    const awal = titikRute[idxSegmen];
    const akhir = titikRute[idxSegmen + 1];
    
    return [
      awal[0] + (akhir[0] - awal[0]) * progLokal,
      awal[1] + (akhir[1] - awal[1]) * progLokal
    ] as [number, number];
  };

  const posAwal = dapatkanKoordinatLangkah(0);
  penandaBus = L.marker(posAwal, { icon: ikonBus }).addTo(peta)
    .bindPopup('<strong class="text-slate-800">Bus Sekolah - DenantaTS</strong><br><span class="text-xs text-slate-500">Kec. 45 KM/Jam</span>');

  // Interval Simulasi Pergerakan Bus
  intervalSimulasi = setInterval(() => {
    langkahAktif = (langkahAktif + 1) % totalLangkah;
    const progress = langkahAktif / totalLangkah;
    const koordinatBaru = dapatkanKoordinatLangkah(progress);
    
    if (penandaBus) {
      penandaBus.setLatLng(koordinatBaru);
    }
  }, 1500);
});

onUnmounted(() => {
  if (intervalSimulasi) clearInterval(intervalSimulasi);
  if (peta) peta.remove();
});
</script>

<template>
  <div class="space-y-3">
    <!-- Map Canvas -->
    <div 
      ref="wadahPeta" 
      :style="{ height: tinggi }" 
      class="w-full rounded-2xl border border-warnaAksen/30 overflow-hidden shadow-2xl relative z-10"
    ></div>
    
    <!-- Legend Info -->
    <div class="grid grid-cols-3 gap-3 bg-warnaSekunder/40 border border-warnaAksen/20 p-3 rounded-xl text-center text-xs">
      <div class="flex items-center justify-center gap-1.5 text-blue-400">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
        <span>Kediaman</span>
      </div>
      <div class="flex items-center justify-center gap-1.5 text-warnaTombol font-semibold animate-pulse">
        <span class="w-2.5 h-2.5 rounded-full bg-warnaTombol"></span>
        <span>Posisi Armada</span>
      </div>
      <div class="flex items-center justify-center gap-1.5 text-emerald-400">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
        <span>Sekolah Tujuan</span>
      </div>
    </div>
  </div>
</template>
