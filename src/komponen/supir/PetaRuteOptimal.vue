<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  listAnak: any[];
  lintangSekolah?: number;
  bujurSekolah?: number;
  tinggi?: string;
}

const props = withDefaults(defineProps<Props>(), {
  lintangSekolah: -0.9320,
  bujurSekolah: 100.3800,
  tinggi: '380px'
});

const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;
let markers: L.Marker[] = [];
let rutePolyline: L.Polyline | null = null;

// Custom Div Icon for the school
const ikonSekolah = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const bersihkanPeta = () => {
  markers.forEach(m => {
    if (peta) peta.removeLayer(m);
  });
  markers = [];
  if (rutePolyline) {
    if (peta) peta.removeLayer(rutePolyline);
    rutePolyline = null;
  }
};

const renderPeta = () => {
  const mapInstance = peta;
  if (!mapInstance) return;
  bersihkanPeta();

  const koordinatRute: [number, number][] = [];

  // 1. Tambah penanda sekolah
  const mkSekolah = L.marker([props.lintangSekolah, props.bujurSekolah], { icon: ikonSekolah }).addTo(mapInstance)
    .bindPopup('<strong class="text-slate-800">Sekolah: SD N 01 Padang</strong>');
  markers.push(mkSekolah);

  // 2. Loop list anak untuk tambah marker ber-angka (Urutan)
  props.listAnak.forEach((anak, idx) => {
    const lat = anak.lintangJemput || -0.9471 + (idx * 0.002);
    const lng = anak.bujurJemput || 100.4172 - (idx * 0.002);

    koordinatRute.push([lat, lng]);

    const ikonNomor = L.divIcon({
      html: `<div class="w-8 h-8 rounded-full bg-warnaTombol border-2 border-white flex items-center justify-center shadow-md text-white font-extrabold text-xs">${idx + 1}</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const mkAnak = L.marker([lat, lng], { icon: ikonNomor }).addTo(mapInstance)
      .bindPopup(`<strong class="text-slate-800">Titik ${idx + 1}: ${anak.nama}</strong><br><span class="text-xs text-slate-500">${anak.alamatJemput}</span>`);
    
    markers.push(mkAnak);
  });

  // Tambahkan koordinat sekolah di akhir rute
  koordinatRute.push([props.lintangSekolah, props.bujurSekolah]);

  // 3. Gambar Rute Polyline
  if (koordinatRute.length > 1) {
    rutePolyline = L.polyline(koordinatRute, { color: '#e94560', weight: 4, opacity: 0.85 }).addTo(mapInstance);
    mapInstance.fitBounds(rutePolyline.getBounds(), { padding: [50, 50] });
  }
};

onMounted(() => {
  if (!wadahPeta.value) return;

  const mapInstance = L.map(wadahPeta.value).setView([props.lintangSekolah, props.bujurSekolah], 13);
  peta = mapInstance;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
  }).addTo(mapInstance);

  renderPeta();
});

watch(() => props.listAnak, () => {
  renderPeta();
}, { deep: true });

onUnmounted(() => {
  bersihkanPeta();
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

    <!-- Legend -->
    <div class="flex items-center justify-between text-[11px] text-slate-400 bg-warnaSekunder/40 px-4 py-2 rounded-xl border border-warnaAksen/20">
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-warnaTombol inline-block"></span> Urutan Jemput</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Sekolah Tujuan</span>
      <span class="text-warnaTombol font-semibold">Rute navigasi optimal terhitung</span>
    </div>
  </div>
</template>
