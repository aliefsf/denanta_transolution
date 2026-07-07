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
const errorBatas = ref(false);

// Batas wilayah operasional Kota Padang
const apakahDalamKotaPadang = (lat: number, lng: number) => {
  return lat <= -0.75 && lat >= -1.15 && lng >= 100.25 && lng <= 100.55;
};

// Simulasi geocoding sederhana (peta ke alamat teks) untuk Kota Padang
const dapatkanNamaAlamat = (lat: number, lng: number) => {
  return `Jalan Prof. M. Yamin, dekat kordinat (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kota Padang`;
};

const handleUpdateLokasi = (lat: number, lng: number) => {
  koordinatAktif.value = { lat, lng };
  const valid = apakahDalamKotaPadang(lat, lng);
  errorBatas.value = !valid;
  
  emit('pilih-lokasi', {
    lintang: lat,
    bujur: lng,
    alamat: valid ? dapatkanNamaAlamat(lat, lng) : 'LOKASI DI LUAR BATAS OPERASIONAL KOTA PADANG'
  });
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
    handleUpdateLokasi(pos.lat, pos.lng);
  });

  // Dengarkan event klik peta untuk memindahkan penanda
  peta.on('click', (e: L.LeafletMouseEvent) => {
    if (!penanda) return;
    penanda.setLatLng(e.latlng);
    handleUpdateLokasi(e.latlng.lat, e.latlng.lng);
  });

  // Emit inisialisasi pertama kali
  handleUpdateLokasi(koordinatAktif.value.lat, koordinatAktif.value.lng);
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
      :class="{ 'border-rose-500': errorBatas }"
    ></div>
    
    <!-- Info Koordinat -->
    <div 
      class="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] px-3 py-2 rounded-lg border transition-colors duration-200"
      :class="errorBatas ? 'bg-rose-950/20 border-rose-500/30 text-rose-400' : 'bg-warnaSekunder/50 border-warnaAksen/20 text-slate-400'"
    >
      <div class="flex items-center gap-4">
        <span>Lintang: <strong class="font-mono text-slate-200">{{ koordinatAktif.lat.toFixed(6) }}</strong></span>
        <span>Bujur: <strong class="font-mono text-slate-200">{{ koordinatAktif.lng.toFixed(6) }}</strong></span>
      </div>
      <span v-if="errorBatas" class="font-bold uppercase tracking-wider text-[10px] animate-pulse">Di luar batas Kota Padang!</span>
      <span v-else class="text-warnaTombol font-semibold">Geser pin untuk ubah lokasi</span>
    </div>
  </div>
</template>

