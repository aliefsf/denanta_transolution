<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Override icon marker default Leaflet karena issue asset bundler
const ikonDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface Props {
  lintang?: number;
  bujur?: number;
  tinggi?: string;
}

const props = withDefaults(defineProps<Props>(), {
  lintang: -0.9471, // Pusat Kota Padang
  bujur: 100.4172,
  tinggi: '320px',
});

const emit = defineEmits<{
  (e: 'pilih-lokasi', data: { lintang: number; bujur: number; alamat: string }): void;
}>();

const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;
let penanda: L.Marker | null = null;

const koordinatAktif = ref({ lat: props.lintang, lng: props.bujur });

// Simulasi geocoding sederhana (peta ke alamat teks) untuk Kota Padang
const dapatkanNamaAlamat = (lat: number, lng: number) => {
  return `Jalan Prof. M. Yamin, dekat kordinat (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kota Padang`;
};

onMounted(() => {
  if (!wadahPeta.value) return;

  // Inisialisasi peta
  peta = L.map(wadahPeta.value).setView([koordinatAktif.value.lat, koordinatAktif.value.lng], 13);

  // Gunakan tile gratis CartoDB Dark Matter untuk estetika tema gelap Denanta
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20
  }).addTo(peta);

  // Buat penanda seret (draggable)
  penanda = L.marker([koordinatAktif.value.lat, koordinatAktif.value.lng], {
    icon: ikonDefault,
    draggable: true
  }).addTo(peta);

  // Dengarkan event ketika penanda diseret
  penanda.on('dragend', () => {
    if (!penanda) return;
    const pos = penanda.getLatLng();
    koordinatAktif.value = { lat: pos.lat, lng: pos.lng };
    emit('pilih-lokasi', {
      lintang: pos.lat,
      bujur: pos.lng,
      alamat: dapatkanNamaAlamat(pos.lat, pos.lng)
    });
  });

  // Dengarkan event klik peta untuk memindahkan penanda
  peta.on('click', (e: L.LeafletMouseEvent) => {
    if (!penanda) return;
    penanda.setLatLng(e.latlng);
    koordinatAktif.value = { lat: e.latlng.lat, lng: e.latlng.lng };
    emit('pilih-lokasi', {
      lintang: e.latlng.lat,
      bujur: e.latlng.lng,
      alamat: dapatkanNamaAlamat(e.latlng.lat, e.latlng.lng)
    });
  });

  // Emit inisialisasi pertama kali
  emit('pilih-lokasi', {
    lintang: koordinatAktif.value.lat,
    bujur: koordinatAktif.value.lng,
    alamat: dapatkanNamaAlamat(koordinatAktif.value.lat, koordinatAktif.value.lng)
  });
});

onUnmounted(() => {
  if (peta) {
    peta.remove();
  }
});
</script>

<template>
  <div class="space-y-2">
    <!-- Map Container -->
    <div 
      ref="wadahPeta" 
      :style="{ height: tinggi }" 
      class="w-full rounded-xl border border-warnaAksen/30 overflow-hidden shadow-inner relative z-10"
    ></div>
    
    <!-- Info Koordinat -->
    <div class="flex items-center justify-between text-[11px] text-slate-400 bg-warnaSekunder/50 px-3 py-1.5 rounded-lg border border-warnaAksen/20">
      <span>Lintang: <strong class="text-slate-200 font-mono">{{ koordinatAktif.lat.toFixed(6) }}</strong></span>
      <span>Bujur: <strong class="text-slate-200 font-mono">{{ koordinatAktif.lng.toFixed(6) }}</strong></span>
      <span class="text-warnaTombol font-semibold">Geser pin untuk ubah lokasi</span>
    </div>
  </div>
</template>
