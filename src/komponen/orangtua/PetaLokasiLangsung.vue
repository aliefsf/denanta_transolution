<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, X } from 'lucide-vue-next';
import { ambilSupirById } from '../../layanan/orangTuaLayanan';
import { pantauSupirRealtime } from '../../layanan/realtimeLayanan';
import { ambilRuteJalan } from '../../layanan/navigasiLayanan';
import { svgRumah, svgSekolah, svgBus, htmlLencanaIkon } from '../../bantuan/ikonPeta';

interface Props {
  lintangRumah?: number;
  bujurRumah?: number;
  lintangSekolah?: number;
  bujurSekolah?: number;
  tinggi?: string;
  supirId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  lintangRumah: -0.9471,
  bujurRumah: 100.4172,
  lintangSekolah: -0.9320,
  bujurSekolah: 100.3800,
  tinggi: '400px',
  supirId: null,
});

const wadahPeta = ref<HTMLDivElement | null>(null);
let peta: L.Map | null = null;
let penandaBusKecil: L.Marker | null = null;

// Peta halaman penuh -- dibuat baru tiap dibuka, dihancurkan tiap ditutup,
// mengikuti pola yang sama dengan PemilihPeta.vue.
const wadahPetaPenuh = ref<HTMLDivElement | null>(null);
let petaPenuh: L.Map | null = null;
let penandaBusPenuh: L.Marker | null = null;
const halamanPenuhAktif = ref(false);

// Posisi bus terkini (sumber tunggal kebenaran) -- disinkronkan ke peta
// kecil & peta penuh (kalau sedang terbuka) tiap kali berubah.
const posisiBusTerkini = ref<{ lat: number; lng: number } | null>(null);
// Geometri rute (hasil OSRM atau fallback garis lurus) di-cache supaya
// tidak fetch ulang ke OSRM tiap kali peta penuh dibuka.
let jalurRuteCache: [number, number][] | null = null;

let langgananRealtime: { unsubscribe: () => void } | null = null;

const sedangMuatRute = ref(false);
const ruteIkutiJalan = ref(true);

// Ikon marker peta -- dibangun dari fungsi bersama di bantuan/ikonPeta.ts
// (svgRumah/svgSekolah/svgBus + htmlLencanaIkon) supaya badge legend di
// bawah bisa memakai HTML PERSIS SAMA, bukan aset/markup terpisah.
const ukuranIkonRumah = 32;
const ukuranIkonSekolah = 32;
const ukuranIkonBus = 36;

const ikonRumah = L.divIcon({
  html: htmlLencanaIkon(svgRumah, 'bg-blue-600', ukuranIkonRumah),
  className: '',
  iconSize: [ukuranIkonRumah, ukuranIkonRumah],
  iconAnchor: [ukuranIkonRumah / 2, ukuranIkonRumah / 2]
});

const ikonSekolah = L.divIcon({
  html: htmlLencanaIkon(svgSekolah, 'bg-emerald-600', ukuranIkonSekolah),
  className: '',
  iconSize: [ukuranIkonSekolah, ukuranIkonSekolah],
  iconAnchor: [ukuranIkonSekolah / 2, ukuranIkonSekolah / 2]
});

const ikonBus = L.divIcon({
  html: htmlLencanaIkon(svgBus, 'bg-primary', ukuranIkonBus),
  className: '',
  iconSize: [ukuranIkonBus, ukuranIkonBus],
  iconAnchor: [ukuranIkonBus / 2, ukuranIkonBus / 2]
});

// Badge legend -- versi diperkecil dari HTML marker yang sama persis (fungsi
// & konstanta SVG identik dengan divIcon di atas), jadi otomatis ikut
// berubah kalau desain marker di atas diubah.
const ukuranLencanaLegend = 22;
const legendRumah = htmlLencanaIkon(svgRumah, 'bg-blue-600', ukuranLencanaLegend);
const legendSekolah = htmlLencanaIkon(svgSekolah, 'bg-emerald-600', ukuranLencanaLegend);
const legendBus = htmlLencanaIkon(svgBus, 'bg-primary', ukuranLencanaLegend);

// Penanda armada HANYA dipasang kalau memang ada supir yang ditugaskan
// (props.supirId terisi) -- kalau supir sudah ditugaskan tapi belum pernah
// mengirim posisi GPS asli (lintang_terkini/bujur_terkini kosong), pin
// tetap ditampilkan di titik Rumah sebagai posisi awal perkiraan (bukan
// disembunyikan total), supaya orang tua tahu armada memang sudah
// ditugaskan -- lalu otomatis berpindah ke posisi asli begitu update
// GPS/realtime pertama diterima. Disinkronkan ke KEDUA peta (kecil & penuh,
// kalau sedang terbuka).
function perbaruiPosisiBus(lat: number, lng: number) {
  posisiBusTerkini.value = { lat, lng };
  if (peta) {
    if (penandaBusKecil) penandaBusKecil.setLatLng([lat, lng]);
    else penandaBusKecil = L.marker([lat, lng], { icon: ikonBus }).addTo(peta).bindPopup('<strong class="text-slate-800">Posisi Armada</strong>');
  }
  if (petaPenuh) {
    if (penandaBusPenuh) penandaBusPenuh.setLatLng([lat, lng]);
    else penandaBusPenuh = L.marker([lat, lng], { icon: ikonBus }).addTo(petaPenuh).bindPopup('<strong class="text-slate-800">Posisi Armada</strong>');
  }
}

function hapusPenandaBus() {
  posisiBusTerkini.value = null;
  if (penandaBusKecil && peta) peta.removeLayer(penandaBusKecil);
  penandaBusKecil = null;
  if (penandaBusPenuh && petaPenuh) petaPenuh.removeLayer(penandaBusPenuh);
  penandaBusPenuh = null;
}

async function mulaiPelacakanSupir() {
  langgananRealtime?.unsubscribe();
  langgananRealtime = null;

  if (!props.supirId) {
    hapusPenandaBus();
    return;
  }

  // Posisi awal: pakai GPS asli kalau sudah pernah dikirim, kalau belum
  // fallback ke titik Rumah supaya pin tetap terlihat begitu supir
  // ditugaskan (lihat catatan di perbaruiPosisiBus).
  let posisiAwal: [number, number] = [props.lintangRumah, props.bujurRumah];
  try {
    const supir = await ambilSupirById(props.supirId);
    if (supir?.lintang_terkini != null && supir?.bujur_terkini != null) {
      posisiAwal = [supir.lintang_terkini, supir.bujur_terkini];
    }
  } catch {
    // Tetap pakai fallback titik Rumah bila gagal mengambil posisi awal
  }
  perbaruiPosisiBus(posisiAwal[0], posisiAwal[1]);

  langgananRealtime = pantauSupirRealtime(props.supirId, (payload: any) => {
    const baris = payload?.new;
    if (baris?.lintang_terkini != null && baris?.bujur_terkini != null) {
      perbaruiPosisiBus(baris.lintang_terkini, baris.bujur_terkini);
    }
  });
}

// Ambil geometri rute (OSRM, fallback garis lurus) sekali saja & simpan di
// cache modul supaya peta kecil & peta penuh tidak fetch OSRM berulang.
async function ambilJalurRute(): Promise<[number, number][]> {
  if (jalurRuteCache) return jalurRuteCache;
  const titik: [number, number][] = [
    [props.lintangRumah, props.bujurRumah],
    [props.lintangSekolah, props.bujurSekolah]
  ];
  sedangMuatRute.value = true;
  const jalurJalan = await ambilRuteJalan(titik);
  sedangMuatRute.value = false;
  ruteIkutiJalan.value = jalurJalan !== null;
  jalurRuteCache = jalurJalan ?? titik;
  return jalurRuteCache;
}

// Menggambar penanda rumah/sekolah + garis rute pada instance peta manapun
// (dipakai baik oleh peta kecil maupun peta halaman penuh).
async function gambarKontenPeta(map: L.Map) {
  L.marker([props.lintangRumah, props.bujurRumah], { icon: ikonRumah }).addTo(map)
    .bindPopup('<strong class="text-slate-800">Rumah Siswa</strong>');
  L.marker([props.lintangSekolah, props.bujurSekolah], { icon: ikonSekolah }).addTo(map)
    .bindPopup('<strong class="text-slate-800">Sekolah Siswa</strong>');

  const jalur = await ambilJalurRute();
  if (!map) return;
  const garis = L.polyline(jalur, { color: '#0F9B8E', weight: 4, opacity: 0.8 }).addTo(map);
  map.fitBounds(garis.getBounds(), { padding: [40, 40] });
}

function buatPetaDasar(container: HTMLElement): L.Map {
  const map = L.map(container).setView([
    (props.lintangRumah + props.lintangSekolah) / 2,
    (props.bujurRumah + props.bujurSekolah) / 2
  ], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
  }).addTo(map);
  return map;
}

const tanganiEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && halamanPenuhAktif.value) tutupHalamanPenuh();
};

const bukaHalamanPenuh = () => {
  halamanPenuhAktif.value = true;
  window.addEventListener('keydown', tanganiEsc);
  nextTick(async () => {
    if (!wadahPetaPenuh.value) return;
    petaPenuh = buatPetaDasar(wadahPetaPenuh.value);
    await gambarKontenPeta(petaPenuh);
    if (posisiBusTerkini.value) {
      perbaruiPosisiBus(posisiBusTerkini.value.lat, posisiBusTerkini.value.lng);
    }
  });
};

function tutupHalamanPenuh() {
  halamanPenuhAktif.value = false;
  window.removeEventListener('keydown', tanganiEsc);
  if (petaPenuh) {
    petaPenuh.remove();
    petaPenuh = null;
    penandaBusPenuh = null;
  }
}

onMounted(async () => {
  if (!wadahPeta.value) return;
  peta = buatPetaDasar(wadahPeta.value);
  await gambarKontenPeta(peta);
  mulaiPelacakanSupir();
});

watch(() => props.supirId, () => {
  mulaiPelacakanSupir();
});

onUnmounted(() => {
  window.removeEventListener('keydown', tanganiEsc);
  langgananRealtime?.unsubscribe();
  if (peta) peta.remove();
  if (petaPenuh) petaPenuh.remove();
});
</script>

<template>
  <div class="space-y-3">
    <!-- Map Canvas -->
    <div
      ref="wadahPeta"
      :style="{ height: tinggi }"
      class="w-full rounded-2xl border border-outline-variant/30 overflow-hidden shadow-md relative z-10"
    >
      <button
        type="button"
        @click="bukaHalamanPenuh"
        class="absolute top-3 right-3 z-[1000] w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-colors cursor-pointer border-0 bg-white/90 hover:bg-white text-on-surface"
        title="Lihat peta ukuran penuh"
      >
        <Maximize2 class="w-4 h-4" />
      </button>
    </div>

    <!-- Legend Info -- badge memakai HTML marker yang sama persis dengan peta di atas (lihat legendRumah/legendBus/legendSekolah) -->
    <div class="grid grid-cols-3 gap-3 bg-surface-container/60 border border-outline-variant/20 p-3 rounded-xl text-center text-xs">
      <div class="flex items-center justify-center gap-1.5 text-blue-700">
        <span v-html="legendRumah"></span>
        <span>Kediaman</span>
      </div>
      <div class="flex items-center justify-center gap-1.5 text-primary font-semibold" :class="{ 'animate-pulse': supirId }">
        <span v-html="legendBus"></span>
        <span>Posisi Armada</span>
      </div>
      <div class="flex items-center justify-center gap-1.5 text-emerald-700">
        <span v-html="legendSekolah"></span>
        <span>Sekolah Tujuan</span>
      </div>
    </div>
    <p class="text-center text-[11px] text-primary font-semibold">
      {{ sedangMuatRute ? 'Menghitung rute jalan...' : (ruteIkutiJalan ? 'Rute mengikuti jalan' : 'Rute garis lurus (perkiraan)') }}
    </p>
  </div>

  <!-- Halaman penuh -- di-Teleport ke <body>, instance peta baru terpisah total dari layout pemanggil -->
  <Teleport to="body">
    <div v-if="halamanPenuhAktif" class="fixed inset-0 z-[9999] flex flex-col bg-background">
      <div class="flex-shrink-0 h-14 flex items-center justify-between px-4 border-b bg-surface-container-lowest border-outline-variant/30">
        <span class="font-bold text-sm text-on-surface">Peta Pelacakan Lokasi Langsung</span>
        <button
          type="button"
          @click="tutupHalamanPenuh"
          class="p-2 rounded-lg cursor-pointer border-0 bg-transparent transition-colors text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          title="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
      <div ref="wadahPetaPenuh" class="flex-1 min-h-0 relative"></div>
    </div>
  </Teleport>
</template>
