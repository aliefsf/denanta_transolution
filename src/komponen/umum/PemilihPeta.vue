<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinned, X, Check, MapPin, Search, Loader2, LocateFixed } from 'lucide-vue-next';
import { ambilAlamatDariKoordinat, cariLokasi, type HasilPencarianLokasi } from '../../layanan/geocodingLayanan';
import { formatMataUang } from '../../bantuan/formatMataUang';

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
  // 'gelap' dipakai halaman dengan tema lama (Orang Tua/Supir), 'terang'
  // dipakai halaman dengan palet Material terang (Admin, Berlangganan, dst).
  tema?: 'gelap' | 'terang';
  // Estimasi biaya tambahan realtime (mis. biaya perubahan jadwal berbasis
  // jarak) untuk posisi pin yang sedang di-drag di halaman penuh -- diisi
  // reaktif oleh pemanggil lewat event `posisi-berubah` di bawah. Tidak
  // semua pemanggil punya konsep biaya (mis. Data Sekolah/alamat anak),
  // jadi opsional; kalau null/undefined baris estimasi biaya disembunyikan.
  estimasiBiaya?: number | null;
  // Mengunci tombol "Atur/Ubah Pin Point Maps" (tanpa menyembunyikannya) --
  // dipakai pemanggil yang mewajibkan field lain diisi dulu sebelum lokasi
  // boleh ditentukan (mis. jenis langganan di wizard berlangganan, supaya
  // rumus estimasi biaya yang tepat sudah diketahui sebelum peta dibuka).
  nonaktif?: boolean;
  // Set true HANYA kalau `lintang`/`bujur` di atas adalah lokasi yang
  // SUDAH TERSIMPAN sebelumnya di database (mis. alamat jemput anak yang
  // sedang diedit) -- BUKAN sekadar titik tengah viewport default. Dengan
  // ini, peta kecil (preview) langsung menampilkan penanda begitu komponen
  // dibuat/dibuat-ulang (mis. saat panel "Ubah Titik Peta" ditutup lalu
  // dibuka kembali, yang me-remount komponen ini dari nol lewat v-if),
  // alih-alih selalu menampilkan "Belum ada lokasi dipilih" walau alamatnya
  // sebenarnya sudah terisi. Default false supaya alur "anak/sekolah BARU"
  // (lintang/bujur masih berupa default kosong) tetap tidak dianggap
  // seolah-olah sudah dikonfirmasi.
  awalTerkonfirmasi?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  lintang: -0.9471, // Pusat Kota Padang -- hanya dipakai sebagai titik tengah viewport awal peta
  bujur: 100.4172,
  tinggi: '320px',
  tema: 'gelap',
  estimasiBiaya: null,
  nonaktif: false,
  awalTerkonfirmasi: false,
});

const emit = defineEmits<{
  (e: 'pilih-lokasi', data: { lintang: number; bujur: number; alamat: string; estimasiBiaya?: number | null }): void;
  // Ditembakkan setiap pin di halaman penuh berpindah (sebelum dikonfirmasi)
  // supaya pemanggil bisa menghitung ulang estimasi biaya secara live dan
  // mengopernya kembali lewat prop `estimasiBiaya`.
  (e: 'posisi-berubah', data: { lintang: number; bujur: number }): void;
}>();

// Peta kecil (preview saja, selalu terpasang inline di form) -- TIDAK
// interaktif: tidak ada zoom/drag/klik. Hanya menampilkan penanda statis
// dari lokasi yang SUDAH dikonfirmasi (lokasiTerkonfirmasi). Semua input
// lokasi wajib lewat halaman penuh (tombol "Atur Lokasi pada Maps").
const wadahPeta = ref<HTMLDivElement | null>(null);
let petaKecil: L.Map | null = null;
let penandaKecil: L.Marker | null = null;

// Peta halaman penuh (dibuat BARU dari nol tiap dibuka, dihancurkan tiap
// ditutup) -- bukan meresize instance yang sama. Dengan begini Leaflet
// langsung membaca ukuran kontainer yang sudah final saat peta dibuat,
// tidak pernah butuh invalidateSize()/resize-observer yang rawan meleset
// timing-nya di dalam Modal/Teleport. Satu-satunya tempat pin bisa
// digeser/ditentukan.
const wadahPetaPenuh = ref<HTMLDivElement | null>(null);
let petaPenuh: L.Map | null = null;
let penandaPenuh: L.Marker | null = null;

// Lokasi yang SUDAH dikonfirmasi pengguna (lewat dialog konfirmasi) --
// inilah yang ditampilkan sebagai preview statis di peta kecil dan yang
// terakhir dikirim ke form pemanggil. Sengaja mulai null tanpa pengecualian
// (termasuk saat props lintang/bujur berisi koordinat tersimpan dari data
// yang sedang diedit) -- lokasi default/sebelumnya tidak boleh dianggap
// aktif sebelum pengguna sendiri mengonfirmasi ulang.
const lokasiTerkonfirmasi = ref<{ lat: number; lng: number; alamat: string } | null>(null);

// Pin yang sedang disesuaikan di halaman penuh -- draf sementara, belum
// dikirim ke form pemanggil. Dibuang begitu halaman penuh ditutup tanpa
// konfirmasi (lihat tutupHalamanPenuh).
const pinDraft = ref<{ lat: number; lng: number } | null>(null);
const alamatDraft = ref('');
const dialogKonfirmasiTampil = ref(false);

const errorBatas = ref(false);
const sedangMuatAlamat = ref(false);
let idPermintaanAlamat = 0;

const halamanPenuhAktif = ref(false);

// Kolom pencarian lokasi (mirip search box Google Maps) di halaman penuh --
// mengetik nama tempat/alamat lalu memilih salah satu hasil langsung
// memindahkan pin & viewport peta ke koordinat tersebut, tanpa perlu mencari
// manual dengan drag/klik. Debounce supaya tidak memanggil Nominatim di
// setiap ketikan huruf.
const kueriPencarian = ref('');
const hasilPencarian = ref<HasilPencarianLokasi[]>([]);
const sedangMencari = ref(false);
const dropdownHasilTampil = ref(false);
let timerDebouncePencarian: ReturnType<typeof setTimeout> | null = null;
let idPencarianSaatIni = 0;

const tanganiInputPencarian = () => {
  if (timerDebouncePencarian) clearTimeout(timerDebouncePencarian);

  const kueri = kueriPencarian.value.trim();
  if (!kueri) {
    hasilPencarian.value = [];
    dropdownHasilTampil.value = false;
    sedangMencari.value = false;
    return;
  }

  timerDebouncePencarian = setTimeout(async () => {
    const permintaanSaatIni = ++idPencarianSaatIni;
    sedangMencari.value = true;
    const hasil = await cariLokasi(kueri);
    if (permintaanSaatIni !== idPencarianSaatIni) return; // hasil basi, sudah ada ketikan baru

    hasilPencarian.value = hasil;
    dropdownHasilTampil.value = true;
    sedangMencari.value = false;
  }, 400);
};

const bersihkanPencarian = () => {
  kueriPencarian.value = '';
  hasilPencarian.value = [];
  dropdownHasilTampil.value = false;
};

// Memilih salah satu hasil pencarian: pindahkan viewport peta halaman penuh
// ke koordinat tersebut lalu jalankan alur yang sama seperti klik langsung
// di peta (tanganiPinDraftBaru) supaya pin, validasi batas Kota Padang, dan
// reverse-geocoding alamat tetap konsisten dengan cara input lain.
const pilihHasilPencarian = (hasil: HasilPencarianLokasi) => {
  if (petaPenuh) petaPenuh.setView([hasil.lintang, hasil.bujur], 17);
  tanganiPinDraftBaru(hasil.lintang, hasil.bujur);
  kueriPencarian.value = hasil.label;
  dropdownHasilTampil.value = false;
};

// Tombol "Gunakan Lokasi Saya" -- membaca koordinat GPS perangkat lewat
// Geolocation API browser lalu menjalankan alur yang SAMA seperti klik
// manual di peta (tanganiPinDraftBaru), supaya pin, validasi batas Kota
// Padang, dan reverse-geocoding alamat tetap konsisten dengan cara input
// lain. Kalau pengguna menolak izin (atau browser tidak mendukung), input
// manual lewat klik/drag/pencarian tetap tersedia seperti biasa.
const sedangMengambilLokasiSaya = ref(false);
const errorLokasiSaya = ref('');

const gunakanLokasiSaya = () => {
  if (!navigator.geolocation) {
    errorLokasiSaya.value = 'Perangkat/browser ini tidak mendukung fitur lokasi otomatis. Silakan tentukan lokasi secara manual di peta.';
    return;
  }
  errorLokasiSaya.value = '';
  sedangMengambilLokasiSaya.value = true;
  navigator.geolocation.getCurrentPosition(
    (posisi) => {
      sedangMengambilLokasiSaya.value = false;
      const { latitude, longitude } = posisi.coords;
      if (petaPenuh) petaPenuh.setView([latitude, longitude], 17);
      tanganiPinDraftBaru(latitude, longitude);
    },
    () => {
      sedangMengambilLokasiSaya.value = false;
      errorLokasiSaya.value = 'Akses lokasi tidak diberikan. Silakan aktifkan izin lokasi pada pengaturan perangkat atau masukkan lokasi secara manual.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

// Batas wilayah operasional Kota Padang
const apakahDalamKotaPadang = (lat: number, lng: number) => {
  return lat <= -0.75 && lat >= -1.15 && lng >= 100.25 && lng <= 100.55;
};

const teksAlamatFallback = (lat: number, lng: number) => `Titik koordinat (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kota Padang`;

function buatPenandaDraggable(map: L.Map, lat: number, lng: number, onDrag: (lat: number, lng: number) => void): L.Marker {
  const penanda = L.marker([lat, lng], { icon: ikonDefault, draggable: true }).addTo(map);
  penanda.on('dragend', () => {
    const pos = penanda.getLatLng();
    onDrag(pos.lat, pos.lng);
  });
  return penanda;
}

// Satu-satunya titik yang mengubah pin draf -- dipanggil dari klik/drag di
// peta halaman penuh, menjalankan reverse geocoding LOKAL (belum di-emit ke
// form pemanggil -- itu baru terjadi lewat konfirmasiLokasi() setelah
// dialog konfirmasi disetujui), dan memberitahu pemanggil lewat
// `posisi-berubah` supaya estimasi biaya bisa dihitung ulang live.
const tanganiPinDraftBaru = async (lat: number, lng: number) => {
  pinDraft.value = { lat, lng };

  if (petaPenuh) {
    if (penandaPenuh) penandaPenuh.setLatLng([lat, lng]);
    else penandaPenuh = buatPenandaDraggable(petaPenuh, lat, lng, tanganiPinDraftBaru);
  }

  emit('posisi-berubah', { lintang: lat, bujur: lng });

  const valid = apakahDalamKotaPadang(lat, lng);
  errorBatas.value = !valid;

  if (!valid) {
    alamatDraft.value = 'LOKASI DI LUAR BATAS OPERASIONAL KOTA PADANG';
    return;
  }

  alamatDraft.value = teksAlamatFallback(lat, lng);

  const permintaanSaatIni = ++idPermintaanAlamat;
  sedangMuatAlamat.value = true;
  const alamatAsli = await ambilAlamatDariKoordinat(lat, lng);
  sedangMuatAlamat.value = false;

  // Pin sudah berpindah lagi sebelum permintaan ini selesai -- abaikan hasil basi
  if (permintaanSaatIni !== idPermintaanAlamat) return;
  alamatDraft.value = alamatAsli ?? teksAlamatFallback(lat, lng);
};

const bukaDialogKonfirmasi = () => {
  if (!pinDraft.value || errorBatas.value) return;
  dialogKonfirmasiTampil.value = true;
};

const konfirmasiLokasi = () => {
  if (!pinDraft.value) return;
  const alamatFinal = alamatDraft.value || teksAlamatFallback(pinDraft.value.lat, pinDraft.value.lng);
  lokasiTerkonfirmasi.value = { lat: pinDraft.value.lat, lng: pinDraft.value.lng, alamat: alamatFinal };
  dialogKonfirmasiTampil.value = false;
  emit('pilih-lokasi', {
    lintang: pinDraft.value.lat,
    bujur: pinDraft.value.lng,
    alamat: alamatFinal,
    estimasiBiaya: props.estimasiBiaya
  });
  tutupHalamanPenuh();
  perbaruiPenandaKecil();
};

// Sinkronkan penanda statis di peta kecil dengan lokasi yang sudah
// dikonfirmasi -- dipanggil setelah konfirmasi dan saat peta kecil pertama
// dibuat (kalau kebetulan sudah ada lokasi terkonfirmasi sebelumnya di
// sesi yang sama).
function perbaruiPenandaKecil() {
  if (!petaKecil || !lokasiTerkonfirmasi.value) return;
  const { lat, lng } = lokasiTerkonfirmasi.value;
  if (penandaKecil) penandaKecil.setLatLng([lat, lng]);
  else penandaKecil = L.marker([lat, lng], { icon: ikonDefault, interactive: false }).addTo(petaKecil);
  petaKecil.setView([lat, lng], 15);
}

function bersihkanPenandaKecil() {
  if (penandaKecil && petaKecil) {
    petaKecil.removeLayer(penandaKecil);
    penandaKecil = null;
  }
}

// Reaktif terhadap perubahan props (BUKAN cuma sekali saat mount) -- penting
// utk kasus komponen ini TIDAK di-remount saat form pemanggil memuat ulang
// data yang berbeda ke field yang sama (mis. tombol edit anak di
// HalamanBerlangganan.vue: form Data Anak tetap satu instance PemilihPeta
// yang sama, cuma prop lintang/bujur/awalTerkonfirmasi-nya yang berubah).
// Tanpa watcher ini, peta kecil tetap menampilkan "Belum ada lokasi
// dipilih" walau field lintang/bujur di form sudah terisi ulang.
watch(
  () => [props.awalTerkonfirmasi, props.lintang, props.bujur] as const,
  ([terkonfirmasi, lat, lng]) => {
    if (!terkonfirmasi) {
      // Form pemanggil kembali ke keadaan kosong (mis. reset utk menambah
      // anak baru setelah anak sebelumnya disimpan) -- pin lama TIDAK BOLEH
      // ikut "menempel" ke draft anak berikutnya.
      lokasiTerkonfirmasi.value = null;
      bersihkanPenandaKecil();
      return;
    }
    lokasiTerkonfirmasi.value = { lat, lng, alamat: lokasiTerkonfirmasi.value?.alamat ?? '' };
    perbaruiPenandaKecil();
  },
  { immediate: true }
);

function buatPeta(container: HTMLElement, lat: number, lng: number, interaktif: boolean): L.Map {
  const map = L.map(container, {
    zoomControl: interaktif,
    dragging: interaktif,
    touchZoom: interaktif,
    doubleClickZoom: interaktif,
    scrollWheelZoom: interaktif,
    boxZoom: interaktif,
    keyboard: interaktif
  }).setView([lat, lng], 15);

  // CartoDB (voyager/dark_all) SEKARANG mewajibkan API key -- tanpa key,
  // tile-nya diganti watermark "API KEY REQUIRED" oleh CARTO. Diganti ke
  // tile OpenStreetMap standar (gratis, tanpa key) untuk kedua tema --
  // variasi terang/gelap CartoDB jadi tidak tersedia lagi sampai ada
  // alternatif tile gratis-tanpa-key yang mendukung tema gelap.
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  return map;
}

const tanganiEsc = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  if (dialogKonfirmasiTampil.value) {
    dialogKonfirmasiTampil.value = false;
    return;
  }
  if (dropdownHasilTampil.value) {
    dropdownHasilTampil.value = false;
    return;
  }
  if (halamanPenuhAktif.value) tutupHalamanPenuh();
};

const bukaHalamanPenuh = () => {
  if (props.nonaktif) return;
  halamanPenuhAktif.value = true;
  // Draf dimulai dari lokasi yang sudah dikonfirmasi sebelumnya (kalau ada)
  // supaya pengguna bisa langsung menyesuaikan, atau kosong (wajib klik
  // dulu) kalau memang belum pernah ada lokasi terkonfirmasi.
  pinDraft.value = lokasiTerkonfirmasi.value ? { lat: lokasiTerkonfirmasi.value.lat, lng: lokasiTerkonfirmasi.value.lng } : null;
  alamatDraft.value = lokasiTerkonfirmasi.value?.alamat ?? '';
  errorBatas.value = false;
  errorLokasiSaya.value = '';
  bersihkanPencarian();
  window.addEventListener('keydown', tanganiEsc);
  nextTick(() => {
    if (!wadahPetaPenuh.value) return;
    const pusat = pinDraft.value ?? { lat: props.lintang, lng: props.bujur };
    petaPenuh = buatPeta(wadahPetaPenuh.value, pusat.lat, pusat.lng, true);
    petaPenuh.on('click', (e: L.LeafletMouseEvent) => {
      tanganiPinDraftBaru(e.latlng.lat, e.latlng.lng);
    });
    if (pinDraft.value) {
      penandaPenuh = buatPenandaDraggable(petaPenuh, pinDraft.value.lat, pinDraft.value.lng, tanganiPinDraftBaru);
      petaPenuh.setView([pinDraft.value.lat, pinDraft.value.lng], 16);
    }
  });
};

function tutupHalamanPenuh() {
  halamanPenuhAktif.value = false;
  window.removeEventListener('keydown', tanganiEsc);
  if (petaPenuh) {
    petaPenuh.remove();
    petaPenuh = null;
    penandaPenuh = null;
  }
  // Buang draf yang belum dikonfirmasi -- preview peta kecil tidak boleh
  // menampilkan lokasi yang belum benar-benar dikonfirmasi.
  pinDraft.value = null;
  alamatDraft.value = '';
  errorBatas.value = false;
}

onMounted(() => {
  if (!wadahPeta.value) return;

  petaKecil = buatPeta(wadahPeta.value, props.lintang, props.bujur, false);
  // lokasiTerkonfirmasi (kalau props.awalTerkonfirmasi true) sudah diisi
  // oleh watcher immediate di atas SEBELUM baris ini jalan -- cukup
  // sinkronkan penanda peta yang baru saja dibuat.
  perbaruiPenandaKecil();

  // Selain kasus awalTerkonfirmasi, sengaja TIDAK memasang penanda maupun
  // emit 'pilih-lokasi' saat mount -- pin baru muncul & alamat baru
  // disinkronkan setelah pengguna membuka halaman penuh, menentukan pin,
  // DAN mengonfirmasi lewat dialog "Ya, Gunakan Lokasi Ini", supaya lokasi
  // default/sebelumnya tidak pernah dianggap aktif secara diam-diam.
});

onUnmounted(() => {
  window.removeEventListener('keydown', tanganiEsc);
  if (timerDebouncePencarian) clearTimeout(timerDebouncePencarian);
  petaKecil?.remove();
  petaPenuh?.remove();
});
</script>

<template>
  <div class="space-y-2">
    <!-- Map Container: PREVIEW SAJA, tidak interaktif -- semua input lokasi wajib lewat halaman penuh -->
    <div
      ref="wadahPeta"
      :style="{ height: tinggi }"
      class="w-full rounded-xl border overflow-hidden shadow-inner relative z-10 pointer-events-none"
      :class="tema === 'terang' ? 'border-outline-variant/40' : 'border-warnaAksen/30'"
    >
      <!-- Hint saat belum ada lokasi terkonfirmasi sama sekali -->
      <div v-if="!lokasiTerkonfirmasi" class="absolute inset-0 z-[500] flex items-center justify-center px-4">
        <span
          class="px-3 py-1.5 rounded-lg text-[11px] font-semibold shadow-md text-center"
          :class="tema === 'terang' ? 'bg-white/90 text-on-surface' : 'bg-warnaSekunder/90 text-slate-200'"
        >
          Belum ada lokasi dipilih
        </span>
      </div>
    </div>

    <!-- Info Alamat/Koordinat Terkonfirmasi -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] px-3 py-2 rounded-lg border transition-colors duration-200"
      :class="tema === 'terang' ? 'bg-surface-container border-outline-variant/30 text-on-surface-variant' : 'bg-warnaSekunder/50 border-warnaAksen/20 text-slate-400'"
    >
      <div class="flex items-center gap-4">
        <span>Lintang: <strong class="font-mono" :class="tema === 'terang' ? 'text-on-surface' : 'text-slate-200'">{{ lokasiTerkonfirmasi ? lokasiTerkonfirmasi.lat.toFixed(6) : '-' }}</strong></span>
        <span>Bujur: <strong class="font-mono" :class="tema === 'terang' ? 'text-on-surface' : 'text-slate-200'">{{ lokasiTerkonfirmasi ? lokasiTerkonfirmasi.lng.toFixed(6) : '-' }}</strong></span>
      </div>
      <span v-if="!lokasiTerkonfirmasi" class="italic" :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-500'">Peta hanya pratinjau</span>
      <span v-else class="font-semibold" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'">Lokasi tersimpan</span>
    </div>

    <!-- Satu-satunya jalan masuk untuk menentukan/mengubah lokasi -->
    <button
      type="button"
      :disabled="nonaktif"
      @click="bukaHalamanPenuh"
      class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        nonaktif ? 'cursor-not-allowed' : 'cursor-pointer',
        tema === 'terang' ? 'bg-primary text-white hover:bg-[#0D7A68]' : 'bg-warnaTombol text-white hover:bg-opacity-90'
      ]"
    >
      <MapPinned class="w-4 h-4" />
      {{ lokasiTerkonfirmasi ? 'Ubah Pin Point Maps' : 'Atur Lokasi pada Maps' }}
    </button>
  </div>

  <!-- Halaman penuh pemilihan lokasi -- di-Teleport ke <body> dan dibuat
       sebagai instance peta baru, terlepas total dari layout form/Modal
       pemanggil. Satu-satunya tempat pin bisa digeser/ditentukan. -->
  <Teleport to="body">
    <div
      v-if="halamanPenuhAktif"
      class="fixed inset-0 z-[9999] flex flex-col"
      :class="tema === 'terang' ? 'bg-background' : 'bg-warnaUtama'"
    >
      <!-- Header -->
      <div
        class="flex-shrink-0 h-14 flex items-center justify-between px-4 border-b"
        :class="tema === 'terang' ? 'bg-surface-container-lowest border-outline-variant/30' : 'bg-warnaSekunder border-warnaAksen/30'"
      >
        <span class="font-bold text-sm" :class="tema === 'terang' ? 'text-on-surface' : 'text-white'">Pilih Lokasi di Peta</span>
        <button
          type="button"
          @click="tutupHalamanPenuh"
          class="p-2 rounded-lg cursor-pointer border-0 bg-transparent transition-colors"
          :class="tema === 'terang' ? 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container' : 'text-slate-300 hover:text-white hover:bg-warnaAksen/40'"
          title="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Area Peta: mengisi sisa ruang di antara header & footer -->
      <div class="flex-1 min-h-0 relative">
        <div ref="wadahPetaPenuh" class="absolute inset-0"></div>

        <!-- Kolom Pencarian Lokasi (mirip search box Google Maps) -->
        <div class="absolute top-3 left-3 right-3 sm:right-auto sm:w-96 z-[600]">
          <div
            class="flex items-center gap-2 px-3 py-2 rounded-xl shadow-md border"
            :class="tema === 'terang' ? 'bg-white border-outline-variant/40' : 'bg-warnaSekunder border-warnaAksen/30'"
          >
            <Search class="w-4 h-4 flex-shrink-0" :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-400'" />
            <input
              type="text"
              v-model="kueriPencarian"
              @input="tanganiInputPencarian"
              @focus="hasilPencarian.length > 0 && (dropdownHasilTampil = true)"
              placeholder="Cari nama tempat atau alamat..."
              class="flex-grow bg-transparent border-0 outline-none text-sm"
              :class="tema === 'terang' ? 'text-on-surface placeholder:text-on-surface-variant' : 'text-slate-100 placeholder:text-slate-500'"
            />
            <Loader2 v-if="sedangMencari" class="w-4 h-4 flex-shrink-0 animate-spin" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'" />
            <button
              v-else-if="kueriPencarian"
              type="button"
              @click="bersihkanPencarian"
              class="flex-shrink-0 p-0.5 rounded cursor-pointer border-0 bg-transparent"
              :class="tema === 'terang' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-400 hover:text-white'"
              title="Bersihkan pencarian"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Dropdown Hasil Pencarian -->
          <div
            v-if="dropdownHasilTampil"
            class="mt-1.5 rounded-xl shadow-md border overflow-hidden max-h-64 overflow-y-auto"
            :class="tema === 'terang' ? 'bg-white border-outline-variant/40' : 'bg-warnaSekunder border-warnaAksen/30'"
          >
            <button
              v-for="(hasil, idx) in hasilPencarian"
              :key="idx"
              type="button"
              @click="pilihHasilPencarian(hasil)"
              class="w-full flex items-start gap-2 px-3 py-2.5 text-left text-xs border-0 cursor-pointer transition-colors"
              :class="[
                tema === 'terang' ? 'hover:bg-surface-container text-on-surface bg-transparent' : 'hover:bg-warnaAksen/40 text-slate-200 bg-transparent',
                idx > 0 ? (tema === 'terang' ? 'border-t border-outline-variant/20' : 'border-t border-warnaAksen/20') : ''
              ]"
            >
              <MapPin class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'" />
              <span>{{ hasil.label }}</span>
            </button>
            <div
              v-if="!sedangMencari && hasilPencarian.length === 0"
              class="px-3 py-2.5 text-xs italic"
              :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-400'"
            >
              Tidak ada lokasi ditemukan di wilayah Kota Padang.
            </div>
          </div>
        </div>

        <div v-if="!pinDraft" class="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none px-4">
          <span
            class="px-4 py-2 rounded-lg text-sm font-semibold shadow-md text-center"
            :class="tema === 'terang' ? 'bg-white/90 text-on-surface' : 'bg-warnaSekunder/90 text-slate-200'"
          >
            Klik pada peta untuk menentukan lokasi
          </span>
        </div>

        <!-- Tombol "Gunakan Lokasi Saya" -- pojok kanan bawah area peta,
             sengaja terpisah dari kolom pencarian (kiri atas) supaya tidak
             menutupi area peta dan tetap mudah ditemukan saat halaman penuh. -->
        <div class="absolute bottom-3 right-3 z-[600] flex flex-col items-end gap-2">
          <span
            v-if="errorLokasiSaya"
            class="max-w-xs px-3 py-2 rounded-lg text-[11px] font-semibold shadow-md text-right"
            :class="tema === 'terang' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-rose-950/90 text-rose-200 border border-rose-800'"
          >
            {{ errorLokasiSaya }}
          </span>
          <button
            type="button"
            @click="gunakanLokasiSaya"
            :disabled="sedangMengambilLokasiSaya"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border-0 shadow-md cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-wait"
            :class="tema === 'terang' ? 'bg-white text-primary hover:bg-primary-container/30' : 'bg-warnaSekunder text-warnaTombol hover:bg-warnaAksen/40'"
          >
            <Loader2 v-if="sedangMengambilLokasiSaya" class="w-4 h-4 animate-spin" />
            <LocateFixed v-else class="w-4 h-4" />
            {{ sedangMengambilLokasiSaya ? 'Mengambil lokasi...' : 'Gunakan Lokasi Saya' }}
          </button>
        </div>
      </div>

      <!-- Footer: alamat terpilih + estimasi biaya realtime + tombol konfirmasi -->
      <div
        class="flex-shrink-0 px-4 py-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        :class="tema === 'terang' ? 'bg-surface-container-lowest border-outline-variant/30' : 'bg-warnaSekunder border-warnaAksen/30'"
      >
        <div class="text-xs space-y-1" :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-400'">
          <div v-if="pinDraft && !errorBatas" class="font-semibold" :class="tema === 'terang' ? 'text-on-surface' : 'text-slate-200'">
            Lokasi Terpilih: {{ sedangMuatAlamat ? 'Mengambil nama alamat...' : alamatDraft }}
          </div>
          <div class="flex items-center gap-4">
            <span>Lintang: <strong class="font-mono" :class="tema === 'terang' ? 'text-on-surface' : 'text-slate-200'">{{ pinDraft ? pinDraft.lat.toFixed(6) : '-' }}</strong></span>
            <span>Bujur: <strong class="font-mono" :class="tema === 'terang' ? 'text-on-surface' : 'text-slate-200'">{{ pinDraft ? pinDraft.lng.toFixed(6) : '-' }}</strong></span>
          </div>
          <div v-if="pinDraft && !errorBatas && estimasiBiaya != null" class="font-bold" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'">
            Estimasi Biaya: {{ formatMataUang(estimasiBiaya) }}
          </div>
          <span v-if="errorBatas" class="font-bold uppercase tracking-wider text-[10px] text-rose-400 animate-pulse block">Di luar batas Kota Padang!</span>
          <span v-else-if="!pinDraft" class="font-medium block" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'">Klik pada peta untuk menentukan lokasi</span>
          <span v-else class="font-medium block" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'">Geser pin atau klik peta untuk ubah lokasi</span>
        </div>
        <button
          type="button"
          @click="bukaDialogKonfirmasi"
          :disabled="!pinDraft || errorBatas"
          class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-0 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          :class="tema === 'terang' ? 'bg-primary text-white hover:bg-[#0D7A68]' : 'bg-warnaTombol text-white hover:bg-opacity-90'"
        >
          <Check class="w-4 h-4" />
          Gunakan Lokasi Ini
        </button>
      </div>
    </div>
  </Teleport>

  <!-- Dialog Konfirmasi -- overlay terpisah di atas segalanya (z lebih
       tinggi dari halaman penuh). Baru pada titik inilah pilih-lokasi
       benar-benar dikirim ke form pemanggil. -->
  <Teleport to="body">
    <div v-if="dialogKonfirmasiTampil" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        class="w-full max-w-sm rounded-2xl p-6 space-y-4 text-center shadow-xl"
        :class="tema === 'terang' ? 'bg-white text-on-surface' : 'bg-warnaSekunder text-slate-100'"
      >
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
          :class="tema === 'terang' ? 'bg-primary-container/20 text-primary' : 'bg-warnaTombol/20 text-warnaTombol'"
        >
          <MapPin class="w-6 h-6" />
        </div>
        <h3 class="font-bold text-sm">Apakah Anda yakin menggunakan lokasi ini?</h3>
        <p class="text-xs leading-relaxed" :class="tema === 'terang' ? 'text-on-surface-variant' : 'text-slate-400'">{{ alamatDraft }}</p>
        <p v-if="estimasiBiaya != null" class="text-xs font-bold" :class="tema === 'terang' ? 'text-primary' : 'text-warnaTombol'">
          Estimasi Biaya: {{ formatMataUang(estimasiBiaya) }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            @click="dialogKonfirmasiTampil = false"
            class="flex-1 px-4 py-2.5 rounded-xl font-semibold text-xs border cursor-pointer transition-colors"
            :class="tema === 'terang' ? 'border-outline-variant text-on-surface-variant hover:bg-surface-container' : 'border-warnaAksen text-slate-300 hover:bg-warnaAksen/30'"
          >
            Kembali Edit Lokasi
          </button>
          <button
            type="button"
            @click="konfirmasiLokasi"
            class="flex-1 px-4 py-2.5 rounded-xl font-semibold text-xs border-0 cursor-pointer transition-colors"
            :class="tema === 'terang' ? 'bg-primary text-white hover:bg-[#0D7A68]' : 'bg-warnaTombol text-white hover:bg-opacity-90'"
          >
            Ya, Gunakan Lokasi Ini
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
