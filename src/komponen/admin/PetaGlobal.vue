<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ambilRuteJalan } from '../../layanan/navigasiLayanan';
import { warnaUntukSupir } from '../../bantuan/warnaSupir';

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

// Data MARKER (posisi realtime) dan data RUTE (polyline jalan) sengaja
// disimpan terpisah, masing-masing di-keyed per supir.id -- sebelumnya
// SEMUA layer (marker, polyline, marker tujuan) dihapus total lalu
// dibangun ulang dari nol setiap kali props.supirList berubah (termasuk
// setiap tick update GPS lewat realtime), dan cache rute ikut memasukkan
// lat/lng SUPIR SAAT ITU ke dalam cache key -- akibatnya cache selalu
// "miss" begitu posisi berubah sedikit saja, polyline sempat digambar
// ulang sebagai garis lurus (titik lama -> titik baru) sebelum OSRM
// selesai dihitung ulang, lalu balik lagi ke rute jalan begitu hasilnya
// datang -- berulang setiap update lokasi (persis gejala yang dilaporkan).
//
// Perbaikannya: marker cukup DIGESER (setLatLng) tanpa pernah disentuh
// polyline-nya, dan polyline HANYA dihitung ulang kalau tujuannya benar-
// benar berubah (cache key TIDAK memasukkan posisi supir sekarang).
let markers: { [supirId: string]: L.Marker } = {};
let polylines: { [supirId: string]: L.Polyline } = {};
let destMarkers: { [supirId: string]: L.Marker } = {};
// cacheKey (per supir+tujuan, BUKAN posisi sekarang) -> geometri jalan hasil OSRM
const ruteCache: { [key: string]: [number, number][] } = {};
// cacheKey rute yang SEDANG dipakai tiap supir -- dipakai mendeteksi apakah
// tujuannya berubah (baru perlu hitung ulang) atau tidak (polyline lama
// tetap dipertahankan apa adanya).
const cacheKeyAktif: { [supirId: string]: string } = {};

const kunciRute = (supir: DriverPosition) => `${supir.id}_${supir.destLat?.toFixed(5)}_${supir.destLng?.toFixed(5)}`;

const buatIkonSupir = (supir: DriverPosition, nomor: number, warna: string) => {
  const isOnline = supir.status === 'aktif';
  // Offline tetap abu-abu netral (tidak online = tidak punya jalur untuk
  // dibedakan warnanya) -- warna identitas cuma dipakai selagi aktif.
  const warnaLatar = isOnline ? warna : '#475569';
  const pingEffect = isOnline
    ? `<span class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style="background:${warna}"></span>`
    : '';
  return L.divIcon({
    html: `
      <div class="relative w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-lg text-white font-extrabold text-xs" style="background:${warnaLatar}">
        ${pingEffect}
        <span class="relative z-10">${nomor}</span>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const popupSupir = (supir: DriverPosition, nomor: number, warna: string) => `
  <div class="text-xs text-slate-800 space-y-1">
    <strong class="text-sm font-bold flex items-center gap-1.5">
      <span style="display:inline-block;width:9px;height:9px;border-radius:9999px;background:${warna}"></span>
      ${nomor}. ${supir.nama}
    </strong>
    <span class="font-semibold text-slate-500">Status:</span> ${supir.status === 'aktif' ? 'Online (Bertugas)' : 'Offline'}<br>
    <span class="font-semibold text-slate-500">Sekolah:</span> ${supir.sekolahTujuan || '-'}
  </div>
`;

// Warna tujuan SENGAJA tetap satu warna tetap (rose), TIDAK mengikuti
// warnaUntukSupir seperti marker/polyline -- kalau tujuan ikut memakai
// warna supir yang sama, begitu supir sudah dekat/hampir sampai (koordinat
// hampir berhimpit dengan tujuan), pin tujuan yang lebih kecil jadi
// nyaris tak kasat mata karena warnanya sama & tertimpa marker supir yang
// z-index-nya sengaja lebih tinggi (lihat zIndexOffset: 1000 di atas) --
// dengan warna kontras tetap (rose vs warna supir apa pun), sisa pin yang
// masih terlihat di baliknya tetap jelas dikenali sebagai marker tujuan.
const buatDestIcon = () => L.divIcon({
  html: `
    <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-md text-white">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
  `,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -30]
});

const renderMarkers = () => {
  const mapInstance = peta;
  if (!mapInstance) return;

  const idAktif = new Set(props.supirList.map((s) => s.id));

  // Buang marker/polyline/tujuan milik supir yang sudah tidak ada di daftar
  // (mis. selesai bertugas) -- yang MASIH ada di daftar TIDAK disentuh di
  // sini sama sekali, cuma di-update di loop bawah.
  Object.keys(markers).forEach((id) => {
    if (!idAktif.has(id)) {
      mapInstance.removeLayer(markers[id]);
      delete markers[id];
    }
  });
  Object.keys(polylines).forEach((id) => {
    if (!idAktif.has(id)) {
      mapInstance.removeLayer(polylines[id]);
      delete polylines[id];
      delete cacheKeyAktif[id];
    }
  });
  Object.keys(destMarkers).forEach((id) => {
    if (!idAktif.has(id)) {
      mapInstance.removeLayer(destMarkers[id]);
      delete destMarkers[id];
    }
  });

  props.supirList.forEach((supir, idx) => {
    const nomor = idx + 1;
    const isOnline = supir.status === 'aktif';
    const warna = warnaUntukSupir(supir.id);

    // 1. Marker posisi -- GESER kalau sudah ada (data MARKER, murni posisi
    // realtime), jangan pernah dibongkar-pasang ulang.
    if (markers[supir.id]) {
      markers[supir.id].setLatLng([supir.lat, supir.lng]);
      markers[supir.id].setIcon(buatIkonSupir(supir, nomor, warna));
      markers[supir.id].setPopupContent(popupSupir(supir, nomor, warna));
    } else {
      markers[supir.id] = L.marker([supir.lat, supir.lng], { icon: buatIkonSupir(supir, nomor, warna), zIndexOffset: 1000 })
        .addTo(mapInstance)
        .bindPopup(popupSupir(supir, nomor, warna));
    }

    // 2. Rute (data RUTE, terpisah total dari posisi) -- hanya dihitung
    // ulang kalau TUJUANNYA berubah (kunciRute tidak memasukkan posisi
    // supir sekarang), atau supir baru pertama kali online/tidak lagi
    // punya tujuan. Polyline yang sudah ada TIDAK PERNAH ditimpa garis
    // lurus hanya karena posisi supir berpindah.
    if (isOnline && supir.destLat != null && supir.destLng != null) {
      const cacheKey = kunciRute(supir);

      if (cacheKeyAktif[supir.id] !== cacheKey) {
        // Tujuan berubah (atau baru pertama kali) -- hitung ulang.
        cacheKeyAktif[supir.id] = cacheKey;

        if (polylines[supir.id]) {
          mapInstance.removeLayer(polylines[supir.id]);
          delete polylines[supir.id];
        }

        const garisAwal: [number, number][] = ruteCache[cacheKey] ?? [[supir.lat, supir.lng], [supir.destLat, supir.destLng]];
        const line = L.polyline(garisAwal, {
          color: warna, // identitas warna per supir -- lihat warnaUntukSupir()
          weight: 3,
          opacity: 0.8,
          dashArray: '5, 10'
        }).addTo(mapInstance);
        polylines[supir.id] = line;

        if (!ruteCache[cacheKey]) {
          ambilRuteJalan([[supir.lat, supir.lng], [supir.destLat, supir.destLng]]).then((coords) => {
            if (coords) {
              ruteCache[cacheKey] = coords;
              // Cuma terapkan kalau supir ini masih menuju tujuan yang sama
              // saat hasil OSRM datang (bisa saja sudah berganti tujuan lagi).
              if (cacheKeyAktif[supir.id] === cacheKey && polylines[supir.id] === line) {
                line.setLatLngs(coords);
              }
            }
          });
        }
      }
      // cacheKey SAMA -- tujuan belum berubah, polyline yang sudah ada
      // dibiarkan apa adanya, tidak disentuh sama sekali.

      // 3. Marker tujuan -- geser kalau sudah ada & tujuannya sama, buat
      // ulang kalau tujuan berubah.
      if (destMarkers[supir.id]) {
        destMarkers[supir.id].setLatLng([supir.destLat, supir.destLng]);
      } else {
        destMarkers[supir.id] = L.marker([supir.destLat, supir.destLng], { icon: buatDestIcon(), zIndexOffset: 500 })
          .addTo(mapInstance)
          .bindPopup(`<strong>Tujuan ${supir.nama}:</strong> ${supir.sekolahTujuan || 'Lokasi Tujuan'}`);
      }
    } else {
      // Supir offline/tidak lagi punya tujuan -- bersihkan rute & tujuannya.
      if (polylines[supir.id]) {
        mapInstance.removeLayer(polylines[supir.id]);
        delete polylines[supir.id];
        delete cacheKeyAktif[supir.id];
      }
      if (destMarkers[supir.id]) {
        mapInstance.removeLayer(destMarkers[supir.id]);
        delete destMarkers[supir.id];
      }
    }
  });
};

// Auto-zoom HANYA dijalankan sekali saat data pertama kali termuat --
// sebelumnya dipanggil di setiap renderMarkers() (termasuk tiap tick GPS),
// jadi peta ikut "meloncat"/re-zoom terus-menerus mengikuti pergerakan
// supir, mengganggu admin yang sedang menggeser/zoom manual.
let sudahFitBounds = false;
const fitBoundsAwal = () => {
  const mapInstance = peta;
  if (!mapInstance || sudahFitBounds || props.supirList.length === 0) return;
  const points: L.LatLngExpression[] = [];
  props.supirList.forEach(s => {
    points.push([s.lat, s.lng]);
    if (s.destLat != null && s.destLng != null) {
      points.push([s.destLat, s.destLng]);
    }
  });
  if (points.length > 0) {
    mapInstance.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    sudahFitBounds = true;
  }
};

onMounted(() => {
  if (!wadahPeta.value) return;

  const mapInstance = L.map(wadahPeta.value).setView([-0.9471, 100.4172], 13); // Center Kota Padang
  peta = mapInstance;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  renderMarkers();
  fitBoundsAwal();
});

watch(() => props.supirList, () => {
  renderMarkers();
  fitBoundsAwal();
}, { deep: true });

onUnmounted(() => {
  const mapInstance = peta;
  if (mapInstance) {
    Object.keys(markers).forEach(k => mapInstance.removeLayer(markers[k]));
    Object.keys(polylines).forEach(k => mapInstance.removeLayer(polylines[k]));
    Object.keys(destMarkers).forEach(k => mapInstance.removeLayer(destMarkers[k]));
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
