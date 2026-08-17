<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MapPin, Navigation, Loader2, Radar } from 'lucide-vue-next';
import PetaGlobal from './PetaGlobal.vue';
import { ambilPosisiSupirAktif, type PosisiSupirPeta } from '../../layanan/adminLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { warnaUntukSupir } from '../../bantuan/warnaSupir';
import { useResetHariBerganti } from '../../komposabel/useResetHariBerganti';

// Filter States
const filterSekolah = ref('semua');
const filterSupir = ref('semua');
const filterStatus = ref('semua');

const supirPositions = ref<PosisiSupirPeta[]>([]);
const sedangMemuat = ref(true);
const errorPesan = ref('');

const daftarSekolahUnik = computed(() => {
  const set = new Set<string>();
  for (const s of supirPositions.value) {
    if (s.sekolahTujuan) set.add(s.sekolahTujuan);
  }
  return Array.from(set);
});

const supirTerfilter = computed(() => {
  return supirPositions.value.filter(s => {
    const cocokSekolah = filterSekolah.value === 'semua' || s.sekolahTujuan === filterSekolah.value;
    const cocokSupir = filterSupir.value === 'semua' || s.id === filterSupir.value;
    const cocokStatus = filterStatus.value === 'semua' || s.status === filterStatus.value;
    return cocokSekolah && cocokSupir && cocokStatus;
  });
});

const muatPosisiSupir = async () => {
  try {
    supirPositions.value = await denganBatasWaktu(ambilPosisiSupirAktif(), 20000);
    errorPesan.value = '';
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal memuat posisi supir aktif.';
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime murni (BUKAN polling) -- pantau tabel `supir` tanpa filter
// (Admin memantau SELURUH armada). Perubahan posisi GPS (lintang_terkini/
// bujur_terkini) pada supir yang SUDAH tampil di peta cukup ditempel
// langsung (patch in-place, marker berpindah mulus tanpa flicker).
// Perubahan lain (mis. sedang_bertugas berganti true/false, supir baru
// mulai bertugas) butuh join nama+sekolah tujuan yang tidak ikut terkirim
// di payload realtime, jadi di-refetch penuh lewat muatPosisiSupir() --
// tetap event-driven, bukan interval berkala.
let saluranSupir: { unsubscribe: () => void } | null = null;

function tanganiPerubahanSupir(payload: any) {
  const baris = payload.new as { id: string; lintang_terkini: number | null; bujur_terkini: number | null; sedang_bertugas: boolean } | undefined;
  if (!baris?.id) {
    muatPosisiSupir();
    return;
  }

  const idx = supirPositions.value.findIndex((s) => s.id === baris.id);
  const hanyaPosisiBerubah = idx !== -1 && baris.sedang_bertugas === true;
  if (hanyaPosisiBerubah && baris.lintang_terkini != null && baris.bujur_terkini != null) {
    const salinan = [...supirPositions.value];
    salinan[idx] = { ...salinan[idx], lat: baris.lintang_terkini, lng: baris.bujur_terkini };
    supirPositions.value = salinan;
    return;
  }
  // Supir baru mulai/berhenti bertugas -- perlu join nama/sekolah, refetch penuh.
  muatPosisiSupir();
}

onMounted(() => {
  muatPosisiSupir();
  saluranSupir = pantauTabelAdminRealtime('supir', tanganiPerubahanSupir);
});

// Tanpa ini, marker supir yang lupa menandai tugasnya selesai baru hilang
// dari peta begitu ADA perubahan lain pada tabel `supir` yang memicu
// refetch (lihat tanganiPerubahanSupir) -- bisa saja tidak terjadi sama
// sekali sampai lama setelah tengah malam. Ini memastikan peta ikut
// menyegarkan diri TEPAT saat tanggal WIB berganti, sama seperti halaman
// "tugas hari ini" milik Supir.
useResetHariBerganti(muatPosisiSupir);

onUnmounted(() => {
  saluranSupir?.unsubscribe();
  saluranSupir = null;
});

</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
          <Radar class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-on-background tracking-tight">Pemantauan Armada Global</h1>
          <p class="text-xs text-on-surface-variant">Pantau pergerakan GPS seluruh armada antar-jemput aktif secara real-time.</p>
        </div>
      </div>

      <!-- Live Sync status badge -->
      <div class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        <span>Realtime Supabase</span>
      </div>
    </div>

    <div v-if="errorPesan" class="bg-error-container/40 border border-error/20 text-error p-3.5 rounded-xl text-xs">
      {{ errorPesan }}
    </div>

    <!-- Filters -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 soft-shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Sekolah:</label>
        <select
          v-model="filterSekolah"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
        >
          <option value="semua">Semua Sekolah</option>
          <option v-for="sek in daftarSekolahUnik" :key="sek" :value="sek">{{ sek }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Pilih Supir:</label>
        <select
          v-model="filterSupir"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
        >
          <option value="semua">Semua Supir</option>
          <option v-for="s in supirPositions" :key="s.id" :value="s.id">{{ s.nama }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Status Armada:</label>
        <select
          v-model="filterStatus"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
        >
          <option value="semua">Semua Status</option>
          <option value="aktif">Online (Bertugas)</option>
          <option value="offline">Offline</option>
        </select>
      </div>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <!-- Map & Side List Row -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-6">

      <!-- Left (3 Columns): Map -->
      <div class="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-xl space-y-4 soft-shadow">
        <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
          <Navigation class="w-4 h-4 text-primary" />
          Peta Lokasi Armada Aktif
        </h3>
        <PetaGlobal :supirList="supirTerfilter" />
      </div>

      <!-- Right (1 Column): Drivers List Status -->
      <div class="space-y-4">
        <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Status Armada</h3>

        <div class="space-y-3">
          <div
            v-for="(s, idx) in supirTerfilter"
            :key="s.id"
            class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl space-y-3 soft-shadow text-xs"
          >
            <div class="flex justify-between items-start">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <!-- Warna badge SAMA PERSIS dengan marker & jalur milik
                       supir ini di peta (warnaUntukSupir, keyed per id --
                       bukan per index, supaya tidak tertukar walau urutan
                       daftar berubah). Abu-abu netral kalau sedang offline,
                       sama seperti aturan warna marker di PetaGlobal.vue. -->
                  <span
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-extrabold flex-shrink-0"
                    :style="{ background: s.status === 'aktif' ? warnaUntukSupir(s.id) : '#475569' }"
                  >
                    {{ idx + 1 }}
                  </span>
                  <h4 class="font-bold text-on-surface text-sm">{{ s.nama }}</h4>
                </div>
                <p class="text-[11px] text-on-surface-variant">
                  <strong>Status:</strong>
                  <span class="ml-1 font-semibold" :class="s.status === 'aktif' ? 'text-primary' : 'text-on-surface-variant'">
                    Sedang Bertugas
                  </span>
                </p>
                <p class="text-[10px] text-on-surface-variant">Tujuan: {{ s.sekolahTujuan || '-' }}</p>
              </div>
              <span
                class="px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0"
                :class="s.status === 'aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-surface-container text-on-surface-variant border border-outline-variant'"
              >
                {{ s.status === 'aktif' ? 'Aktif' : 'Offline' }}
              </span>
            </div>

            <div v-if="s.status === 'aktif'" class="flex items-center gap-2 pt-2 border-t border-outline-variant/30 text-[10px] text-on-surface-variant">
              <MapPin class="w-3.5 h-3.5 text-primary" />
              <span class="font-mono">Lat: {{ s.lat.toFixed(4) }}, Lng: {{ s.lng.toFixed(4) }}</span>
            </div>
          </div>

          <div v-if="supirTerfilter.length === 0" class="text-center py-6 text-on-surface-variant italic text-xs">
            Tidak ada supir dengan kriteria filter tersebut.
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
