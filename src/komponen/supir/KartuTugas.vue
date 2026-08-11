<script setup lang="ts">
import { computed } from 'vue';
import { Navigation, AlertTriangle, ExternalLink, User } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import type { TugasAnakSupir } from '../../layanan/supirLayanan';
import { mapStatusPerjalananKeUI } from '../../bantuan/statusPerjalanan';

interface Props {
  anak: TugasAnakSupir;
  urutan: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'buka-kendala', anak: TugasAnakSupir): void;
}>();

const infoBadge = computed(() => {
  const statusUI = mapStatusPerjalananKeUI(props.anak.status, props.anak.jenisPerjalanan);
  switch (statusUI) {
    case 'terjadwal':
      return { teks: 'Belum Dijemput', kelas: 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/40' };
    case 'penjemputan':
      return { teks: 'Sedang Menjemput', kelas: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'menuju_sekolah':
      return { teks: 'Menuju Sekolah', kelas: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'sekolah':
      return { teks: 'Tiba di Sekolah', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'pulang':
      return { teks: 'Dalam Perjalanan Pulang', kelas: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'rumah':
      return { teks: 'Tiba di Rumah (Selesai)', kelas: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'absen':
      return { teks: 'Dibatalkan', kelas: 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/40' };
    default:
      return { teks: 'Belum Dijemput', kelas: 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/40' };
  }
});

const alamatTujuan = computed(() =>
  props.anak.jenisPerjalanan === 'pagi' ? props.anak.alamatJemput : props.anak.alamatAntar
);
const koordinatTujuan = computed(() =>
  props.anak.jenisPerjalanan === 'pagi'
    ? { lat: props.anak.lintangJemput, lng: props.anak.bujurJemput }
    : { lat: props.anak.lintangAntar, lng: props.anak.bujurAntar }
);
</script>

<template>
  <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow flex flex-col justify-between">
    <div class="space-y-3">
      <!-- Header with Route Order & Status Badge -->
      <div class="flex justify-between items-center gap-2">
        <span class="inline-block px-2.5 py-0.5 rounded-lg bg-primary-container/30 border border-primary/30 text-primary font-bold font-mono text-[10px]">
          Urutan Rute: {{ urutan }}
        </span>
        <span
          class="inline-block px-2.5 py-0.5 rounded-lg border text-[10px] font-bold"
          :class="infoBadge.kelas"
        >
          {{ infoBadge.teks }}
        </span>
      </div>

      <!-- Student Info -->
      <div class="flex items-start gap-3">
        <img
          v-if="anak.foto"
          :src="anak.foto"
          :alt="anak.nama"
          class="w-12 h-12 rounded-xl object-cover border border-outline-variant/30 flex-shrink-0"
        />
        <div v-else class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center border border-outline-variant/30 flex-shrink-0">
          <User class="w-6 h-6 text-on-surface-variant" />
        </div>
        <div class="space-y-0.5">
          <h4 class="text-sm font-bold text-on-surface">{{ anak.nama }}</h4>
          <p class="text-[10px] text-on-surface-variant">{{ anak.sekolah }} | {{ anak.kelas }}</p>
          <p class="text-[10px] text-on-surface-variant truncate max-w-[200px]" :title="alamatTujuan">
            {{ alamatTujuan }}
          </p>
        </div>
      </div>
    </div>

    <!-- Actions Footer Bar -->
    <div class="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-outline-variant/20">
      <!-- Google Maps External Link -->
      <a
        :href="`https://www.google.com/maps/search/?api=1&query=${koordinatTujuan.lat},${koordinatTujuan.lng}`"
        target="_blank"
      >
        <TombolUtama tema="terang" varian="garis-luar" class="w-full text-[10px] py-1.5 gap-1 justify-center">
          <Navigation class="w-3.5 h-3.5" />
          Navigasi
          <ExternalLink class="w-3 h-3 text-on-surface-variant" />
        </TombolUtama>
      </a>

      <!-- Report Obstacle Button -->
      <button
        @click="emit('buka-kendala', anak)"
        class="flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
      >
        <AlertTriangle class="w-3.5 h-3.5" />
        Kendala
      </button>
    </div>
    <p class="text-[9px] text-on-surface-variant text-center -mt-1">Ubah status perjalanan lewat "Detail Rute Terhitung" di atas.</p>
  </div>
</template>
