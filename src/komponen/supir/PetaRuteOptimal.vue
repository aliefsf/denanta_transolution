<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize, Minimize } from 'lucide-vue-next';
import type { TugasAnakSupir } from '../../layanan/supirLayanan';
import { ambilRuteJalan } from '../../layanan/navigasiLayanan';
import { svgBus, htmlLencanaIkonBerdenyut } from '../../bantuan/ikonPeta';

interface Props {
  listAnak: TugasAnakSupir[];
  lintangSekolah?: number;
  bujurSekolah?: number;
  namaSekolah?: string;
  tinggi?: string;
  posisiSupir?: { lat: number; lng: number } | null;
  // Kontrol tombol "Simulasikan Pergerakan (Demo)" -- statusnya (loading/
  // berjalan/nonaktif) dihitung & dimiliki oleh parent (TugasSupir.vue),
  // komponen ini cuma menampilkan tombolnya. Lihat catatan lengkap di
  // dalam <template> soal kenapa tombol ini perlu duplikat di sini.
  modeSimulasiDemo?: boolean;
  sedangSimulasi?: boolean;
  sedangMuatRuteSimulasi?: boolean;
  simulasiNonaktif?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  lintangSekolah: -0.9320,
  bujurSekolah: 100.3800,
  namaSekolah: 'Sekolah Tujuan',
  tinggi: '380px',
  posisiSupir: null,
  modeSimulasiDemo: false,
  sedangSimulasi: false,
  sedangMuatRuteSimulasi: false,
  simulasiNonaktif: false
});

const emit = defineEmits<{
  (e: 'mulai-simulasi'): void;
}>();

// Data anak (nama/sekolah/kelas) berasal dari input orang tua saat
// pendaftaran, jadi WAJIB di-escape sebelum ditempel sebagai HTML mentah ke
// popup Leaflet -- tanpa ini, nama anak yang sengaja diisi tag HTML/script
// bisa jadi celah XSS di dashboard Supir.
const escapeHtml = (teks: string) =>
  teks.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

// Kartu popup anak -- foto profil di kiri (atau ikon fallback kalau belum
// ada foto), nama/sekolah/kelas di kanan, dipakai saat marker bernomor
// (ikonNomor) di-klik.
const kartuPopupAnak = (anak: TugasAnakSupir): string => {
  const fotoHtml = anak.foto
    ? `<img src="${escapeHtml(anak.foto)}" alt="${escapeHtml(anak.nama)}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" />`
    : `<div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  return `<div class="flex items-center gap-3 min-w-[190px]">
    ${fotoHtml}
    <div>
      <p class="text-sm font-bold text-slate-800 leading-tight">${escapeHtml(anak.nama)}</p>
      <p class="text-[11px] text-slate-500 leading-tight mt-0.5">${escapeHtml(anak.sekolah)}</p>
      <p class="text-[11px] text-slate-500 leading-tight">Kelas ${escapeHtml(anak.kelas)}</p>
    </div>
  </div>`;
};

const wadahLuar = ref<HTMLDivElement | null>(null);
const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;
let markers: L.Marker[] = [];
let rutePolyline: L.Polyline | null = null;
let markerSupir: L.Marker | null = null;

// Ikon marker posisi supir sendiri -- beda dari ikonSekolah/ikonNomor supaya
// gampang dibedakan sekilas (bus berwarna oranye + animasi denyut lewat CSS
// bawaan gaya.css .animate-pulse, dibungkus div biasa krn L.divIcon cuma
// terima HTML string mentah).
const ukuranIkonSupir = 32;
const ikonSupir = L.divIcon({
  html: htmlLencanaIkonBerdenyut(svgBus, 'bg-amber-500', 'bg-amber-400', ukuranIkonSupir),
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// Fullscreen -- pakai Fullscreen API bawaan browser (bukan cuma CSS
// fixed-position) supaya di HP juga membesar sungguhan. invalidateSize()
// WAJIB dipanggil setelah ukuran wadah berubah, kalau tidak Leaflet tetap
// merender di ukuran lama (area kosong/terpotong) sampai di-resize manual.
const sedangFullscreen = ref(false);

const toggleFullscreen = async () => {
  if (!wadahLuar.value) return;
  if (!document.fullscreenElement) {
    await wadahLuar.value.requestFullscreen().catch(() => {
      // Browser/HP tidak mendukung Fullscreen API -- biarkan gagal senyap,
      // tombol tetap tampil tapi tidak berefek.
    });
  } else {
    await document.exitFullscreen().catch(() => {});
  }
};

const tanganiPerubahanFullscreen = () => {
  sedangFullscreen.value = document.fullscreenElement === wadahLuar.value;
  nextTick(() => setTimeout(() => peta?.invalidateSize(), 100));
};

const sedangMuatRute = ref(false);
const ruteIkutiJalan = ref(true);
let idPermintaanRute = 0;

const koordinatAnak = (anak: TugasAnakSupir): [number, number] => {
  return anak.jenisPerjalanan === 'pagi'
    ? [anak.lintangJemput, anak.bujurJemput]
    : [anak.lintangAntar, anak.bujurAntar];
};

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

const renderPeta = async () => {
  const mapInstance = peta;
  if (!mapInstance) return;
  bersihkanPeta();

  const permintaanSaatIni = ++idPermintaanRute;
  const koordinatRute: [number, number][] = [];

  // Arah rute HARUS ikut jenis sesi -- sesi Pagi (jemput): supir mulai dari
  // rumah anak satu-satu, berakhir di sekolah. Sesi Sore (antar pulang):
  // supir mulai DARI sekolah (anak sudah di kendaraan), baru menuju rumah
  // masing-masing anak -- arahnya kebalikan. Tanpa pembedaan ini, rute sore
  // salah gambar seolah supir mulai dari rumah anak pertama, bukan sekolah.
  const sesiSore = props.listAnak[0]?.jenisPerjalanan === 'sore';

  // 1. Tambah penanda sekolah
  const mkSekolah = L.marker([props.lintangSekolah, props.bujurSekolah], { icon: ikonSekolah }).addTo(mapInstance)
    .bindPopup(`<strong class="text-slate-800">Sekolah: ${props.namaSekolah}</strong>`);
  markers.push(mkSekolah);

  if (sesiSore) koordinatRute.push([props.lintangSekolah, props.bujurSekolah]);

  // 2. Loop list anak untuk tambah marker ber-angka (Urutan)
  props.listAnak.forEach((anak, idx) => {
    const [lat, lng] = koordinatAnak(anak);
    koordinatRute.push([lat, lng]);

    const ikonNomor = L.divIcon({
      html: `<div class="w-8 h-8 rounded-full bg-primary border-2 border-white flex items-center justify-center shadow-md text-white font-extrabold text-xs">${idx + 1}</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const mkAnak = L.marker([lat, lng], { icon: ikonNomor }).addTo(mapInstance)
      .bindPopup(kartuPopupAnak(anak));

    markers.push(mkAnak);
  });

  // Sesi Pagi: koordinat sekolah ditambahkan di AKHIR rute (sesi Sore sudah
  // ditambahkan di AWAL sebelum loop di atas).
  if (!sesiSore) koordinatRute.push([props.lintangSekolah, props.bujurSekolah]);

  if (koordinatRute.length < 2) {
    mapInstance.setView([props.lintangSekolah, props.bujurSekolah], 13);
    return;
  }

  // 3. Coba ambil geometri rute yang mengikuti jalan sungguhan (OSRM); kalau
  // gagal (offline / server demo down), jatuh kembali ke garis lurus.
  sedangMuatRute.value = true;
  const jalurJalan = await ambilRuteJalan(koordinatRute);
  sedangMuatRute.value = false;

  // Abaikan hasil kalau props sudah berubah lagi sebelum fetch selesai
  if (permintaanSaatIni !== idPermintaanRute || !peta) return;

  ruteIkutiJalan.value = jalurJalan !== null;
  const jalurGambar = jalurJalan ?? koordinatRute;

  rutePolyline = L.polyline(jalurGambar, { color: '#0F9B8E', weight: 4, opacity: 0.85 }).addTo(mapInstance);
  mapInstance.fitBounds(rutePolyline.getBounds(), { padding: [50, 50] });
};

onMounted(() => {
  if (!wadahPeta.value) return;

  const mapInstance = L.map(wadahPeta.value).setView([props.lintangSekolah, props.bujurSekolah], 13);
  peta = mapInstance;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  renderPeta();
  perbaruiMarkerSupir(props.posisiSupir);

  document.addEventListener('fullscreenchange', tanganiPerubahanFullscreen);
});

// Marker posisi supir SENGAJA di-update terpisah (bukan lewat renderPeta())
// -- renderPeta() menghitung ulang rute OSRM (fetch jaringan) tiap kali
// dipanggil, terlalu berat kalau dijalankan setiap beberapa detik mengikuti
// pergerakan GPS. Marker ini cukup digeser (setLatLng) tanpa memicu ulang
// perhitungan rute.
const perbaruiMarkerSupir = (posisi: { lat: number; lng: number } | null) => {
  if (!peta) return;
  if (!posisi) {
    if (markerSupir) {
      peta.removeLayer(markerSupir);
      markerSupir = null;
    }
    return;
  }
  if (markerSupir) {
    markerSupir.setLatLng([posisi.lat, posisi.lng]);
  } else {
    markerSupir = L.marker([posisi.lat, posisi.lng], { icon: ikonSupir, zIndexOffset: 1000 }).addTo(peta)
      .bindPopup('<strong class="text-slate-800">Posisi Anda Sekarang</strong>');
  }
};

watch(() => props.listAnak, () => {
  renderPeta();
}, { deep: true });

watch(() => props.posisiSupir, (posisi) => {
  perbaruiMarkerSupir(posisi);
}, { deep: true });

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', tanganiPerubahanFullscreen);
  bersihkanPeta();
  if (markerSupir && peta) peta.removeLayer(markerSupir);
  if (peta) peta.remove();
});
</script>

<template>
  <div class="space-y-3">
    <!-- Wadah Luar -- target Fullscreen API, jadi saat fullscreen aktif
         wadah ini (bukan cuma kanvas peta) yang membesar penuh layar,
         supaya legend & tombol tetap ikut terlihat. -->
    <div ref="wadahLuar" class="relative bg-surface-container-lowest" :class="sedangFullscreen ? 'p-3 flex flex-col justify-center h-screen' : ''">
      <!-- Map Canvas -->
      <div class="relative">
        <div
          ref="wadahPeta"
          :style="{ height: sedangFullscreen ? 'calc(100vh - 90px)' : tinggi }"
          class="w-full rounded-2xl border border-outline-variant/30 overflow-hidden shadow-md relative z-10"
        ></div>

        <!-- Tombol Fullscreen -->
        <button
          type="button"
          @click="toggleFullscreen"
          class="absolute top-3 right-3 z-20 bg-white/95 hover:bg-white text-on-surface p-2 rounded-lg shadow-md border-0 cursor-pointer transition-colors"
          :title="sedangFullscreen ? 'Keluar layar penuh' : 'Layar penuh'"
        >
          <Minimize v-if="sedangFullscreen" class="w-4 h-4" />
          <Maximize v-else class="w-4 h-4" />
        </button>

        <!-- Tombol Simulasi Pergerakan (Demo) -- duplikat dari tombol yang
             sama di header TugasSupir.vue, KHUSUS ditampilkan saat
             fullscreen aktif. Tombol asli itu berada di LUAR wadahLuar
             (target Fullscreen API di atas), jadi begitu fullscreen aktif
             browser cuma merender isi wadahLuar -- tombol aslinya jadi
             tidak terlihat/tidak bisa diklik sama sekali sampai pengguna
             keluar dulu dari fullscreen. Duplikat di sini (di DALAM
             wadahLuar) supaya pengguna tetap bisa menjalankan simulasi
             tanpa perlu keluar dari mode fullscreen. -->
        <button
          v-if="modeSimulasiDemo && sedangFullscreen"
          type="button"
          :disabled="sedangSimulasi || sedangMuatRuteSimulasi || simulasiNonaktif"
          @click="emit('mulai-simulasi')"
          class="absolute top-3 left-3 z-20 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          title="Menggerakkan marker supir otomatis mengikuti jalan sungguhan -- khusus demo/sidang"
        >
          {{ sedangMuatRuteSimulasi ? 'Menghitung rute...' : sedangSimulasi ? 'Simulasi Berjalan...' : 'Simulasikan Pergerakan (Demo)' }}
        </button>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant bg-surface-container/60 px-4 py-2 rounded-xl border border-outline-variant/20 mt-3">
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span> Urutan Jemput</span>
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Sekolah Tujuan</span>
        <span v-if="posisiSupir" class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Posisi Anda</span>
        <span class="text-primary font-semibold">
          {{ sedangMuatRute ? 'Menghitung rute jalan...' : (ruteIkutiJalan ? 'Rute mengikuti jalan' : 'Rute garis lurus (perkiraan)') }}
        </span>
      </div>
    </div>
  </div>
</template>
