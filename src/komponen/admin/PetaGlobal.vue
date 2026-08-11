<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ambilRuteJalan } from '../../layanan/navigasiLayanan';

interface DriverPosition {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  status: 'aktif' | 'offline';
  sekolahTujuan: string | null;
  statusPerjalanan: string | null;
  destLat: number | null;
  destLng: number | null;
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
let polylines: L.Polyline[] = [];
let destMarkers: L.Marker[] = [];
const ruteCache: { [key: string]: [number, number][] } = {};

const renderMarkers = () => {
  const mapInstance = peta;
  if (!mapInstance) return;

  // Hapus marker lama
  Object.keys(markers).forEach(k => {
    mapInstance.removeLayer(markers[k]);
  });
  markers = {};

  // Hapus polyline dan marker tujuan lama
  polylines.forEach(p => mapInstance.removeLayer(p));
  polylines = [];
  destMarkers.forEach(m => mapInstance.removeLayer(m));
  destMarkers = [];

  // Tambah marker & rute baru
  props.supirList.forEach((supir, idx) => {
    const nomor = idx + 1;
    const isOnline = supir.status === 'aktif';
    const warnaBg = isOnline ? 'bg-primary' : 'bg-slate-600';
    const warnaBorder = isOnline ? 'border-primary-container/30' : 'border-slate-400';
    const pingEffect = isOnline ? '<span class="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping"></span>' : '';

    const customIcon = L.divIcon({
      html: `
        <div class="relative w-8 h-8 rounded-full ${warnaBg} border-2 ${warnaBorder} flex items-center justify-center shadow-lg text-white font-extrabold text-xs">
          ${pingEffect}
          <span class="relative z-10">${nomor}</span>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const m = L.marker([supir.lat, supir.lng], { icon: customIcon }).addTo(mapInstance)
      .bindPopup(`
        <div class="text-xs text-slate-800 space-y-1">
          <strong class="text-sm font-bold">${nomor}. ${supir.nama}</strong><br>
          <span class="font-semibold text-slate-500">Status:</span> ${isOnline ? 'Online (Bertugas)' : 'Offline'}<br>
          <span class="font-semibold text-slate-500">Sekolah:</span> ${supir.sekolahTujuan || '-'}
        </div>
      `);
    
    markers[supir.id] = m;

    // Gambar garis rute jika supir online dan memiliki koordinat tujuan
    if (isOnline && supir.destLat != null && supir.destLng != null) {
      // 1. Gambar polyline (garis rute jalan)
      const cacheKey = `${supir.id}_${supir.lat.toFixed(5)}_${supir.lng.toFixed(5)}_${supir.destLat.toFixed(5)}_${supir.destLng.toFixed(5)}`;
      let lineCoords: [number, number][] = [[supir.lat, supir.lng], [supir.destLat, supir.destLng]];
      
      if (ruteCache[cacheKey]) {
        lineCoords = ruteCache[cacheKey];
      }

      const line = L.polyline(lineCoords, {
        color: '#e94560', // warnaTombol (accent)
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 10'
      }).addTo(mapInstance);
      polylines.push(line);

      if (!ruteCache[cacheKey]) {
        ambilRuteJalan([[supir.lat, supir.lng], [supir.destLat, supir.destLng]]).then((coords) => {
          if (coords) {
            ruteCache[cacheKey] = coords;
            line.setLatLngs(coords);
          }
        });
      }

      // 2. Gambar penanda pin tujuan di akhir garis
      const destIcon = L.divIcon({
        html: `
          <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-md text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const destM = L.marker([supir.destLat, supir.destLng], { icon: destIcon }).addTo(mapInstance)
        .bindPopup(`<strong>Tujuan ${supir.nama}:</strong> ${supir.sekolahTujuan || 'Lokasi Tujuan'}`);
      destMarkers.push(destM);
    }
  });

  // Auto-zoom peta untuk memuat semua titik aktif (supir & rute tujuan)
  if (props.supirList.length > 0) {
    const points: L.LatLngExpression[] = [];
    props.supirList.forEach(s => {
      points.push([s.lat, s.lng]);
      if (s.destLat != null && s.destLng != null) {
        points.push([s.destLat, s.destLng]);
      }
    });
    if (points.length > 0) {
      mapInstance.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  }
};

onMounted(() => {
  if (!wadahPeta.value) return;

  const mapInstance = L.map(wadahPeta.value).setView([-0.9471, 100.4172], 13); // Center Kota Padang
  peta = mapInstance;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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
    polylines.forEach(p => mapInstance.removeLayer(p));
    destMarkers.forEach(m => mapInstance.removeLayer(m));
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
      class="w-full rounded-xl border border-outline-variant/30 overflow-hidden soft-shadow relative z-10"
    ></div>
  </div>
</template>
