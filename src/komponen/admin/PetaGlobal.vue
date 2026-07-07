<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DriverPosition {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  status: 'aktif' | 'offline';
  sekolahTujuan: string;
}

interface Props {
  supirList: DriverPosition[];
  tinggi?: string;
}

const props = withDefaults(defineProps<Props>(), {
  tinggi: '450px'
});

const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;
let markers: { [key: string]: L.Marker } = {};

const renderMarkers = () => {
  const mapInstance = peta;
  if (!mapInstance) return;

  // Hapus marker lama
  Object.keys(markers).forEach(k => {
    mapInstance.removeLayer(markers[k]);
  });
  markers = {};

  // Tambah marker baru
  props.supirList.forEach(supir => {
    const isOnline = supir.status === 'aktif';
    const warnaBg = isOnline ? 'bg-emerald-500' : 'bg-slate-600';
    const warnaBorder = isOnline ? 'border-emerald-200' : 'border-slate-400';
    const pingEffect = isOnline ? '<span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>' : '';

    const customIcon = L.divIcon({
      html: `
        <div class="relative w-8 h-8 rounded-full ${warnaBg} border-2 ${warnaBorder} flex items-center justify-center shadow-lg text-white font-bold">
          ${pingEffect}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const m = L.marker([supir.lat, supir.lng], { icon: customIcon }).addTo(mapInstance)
      .bindPopup(`
        <div class="text-xs text-slate-800 space-y-1">
          <strong class="text-sm font-bold">${supir.nama}</strong><br>
          <span class="font-semibold text-slate-500">Status:</span> ${isOnline ? 'Online (Bertugas)' : 'Offline'}<br>
          <span class="font-semibold text-slate-500">Sekolah:</span> ${supir.sekolahTujuan}
        </div>
      `);
    
    markers[supir.id] = m;
  });
};

onMounted(() => {
  if (!wadahPeta.value) return;

  const mapInstance = L.map(wadahPeta.value).setView([-0.9471, 100.4172], 13); // Center Kota Padang
  peta = mapInstance;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
  }).addTo(mapInstance);

  renderMarkers();
});

watch(() => props.supirList, () => {
  renderMarkers();
}, { deep: true });

onUnmounted(() => {
  const mapInstance = peta;
  if (mapInstance) {
    Object.keys(markers).forEach(k => {
      mapInstance.removeLayer(markers[k]);
    });
    mapInstance.remove();
  }
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
  </div>
</template>
