<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock, MapPin } from 'lucide-vue-next';
import { formatWaktuTahapan } from '../../bantuan/statusPerjalanan';
import type { PerjalananRow } from '../../tipe';

interface Props {
  perjalananPagi?: PerjalananRow | null;
  perjalananSore?: PerjalananRow | null;
}

const props = withDefaults(defineProps<Props>(), {
  perjalananPagi: null,
  perjalananSore: null,
});

// Setiap tahap dibaca langsung dari waktu_jemput/waktu_antar milik baris
// `perjalanan` pagi & sore hari ini -- kolom ini diisi oleh perbaruiStatusPerjalanan()
// (supirLayanan.ts) persis pada saat supir mengubah status, jadi garis waktu ini
// otomatis mengikuti perubahan status supir (lihat juga realtime sync di
// useDataOrangTua.ts) alih-alih menampilkan jam tetap yang tidak berubah.
const tahapan = computed(() => {
  const pagi = props.perjalananPagi;
  const sore = props.perjalananSore;

  return [
    {
      judul: 'Penjemputan Armada (Pagi)',
      deskripsi: 'Armada supir berangkat menjemput anak di rumah',
      waktu: formatWaktuTahapan(pagi?.waktu_jemput),
      selesai: !!pagi?.waktu_jemput,
      aktif: !!pagi && pagi.status !== 'dibatalkan' && !pagi.waktu_jemput,
    },
    {
      judul: 'Tiba di Sekolah',
      deskripsi: 'Siswa absen masuk gerbang sekolah terpadu',
      waktu: formatWaktuTahapan(pagi?.waktu_antar),
      selesai: !!pagi?.waktu_antar,
      aktif: !!pagi?.waktu_jemput && !pagi?.waktu_antar,
    },
    {
      judul: 'Pengantaran Pulang',
      deskripsi: 'Armada supir mengantar anak pulang dari sekolah',
      waktu: formatWaktuTahapan(sore?.waktu_jemput),
      selesai: !!sore?.waktu_jemput,
      aktif: !!sore && sore.status !== 'dibatalkan' && !!pagi?.waktu_antar && !sore.waktu_jemput,
    },
    {
      judul: 'Tiba di Rumah',
      deskripsi: 'Siswa sampai kembali di kediaman orang tua',
      waktu: formatWaktuTahapan(sore?.waktu_antar),
      selesai: !!sore?.waktu_antar,
      aktif: !!sore?.waktu_jemput && !sore?.waktu_antar,
    }
  ];
});
</script>

<template>
  <div class="space-y-6 relative pl-10 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/30">
    <div
      v-for="(tahap, idx) in tahapan"
      :key="idx"
      class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
    >
      <!-- Indicator Dot -->
      <div
        class="absolute -left-9 w-6 h-6 rounded-full flex items-center justify-center border-2"
        :class="[
          tahap.selesai ? 'bg-primary border-primary text-white' :
          tahap.aktif ? 'bg-surface-container-lowest border-primary text-primary animate-pulse' :
          'bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant'
        ]"
      >
        <CheckCircle2 v-if="tahap.selesai" class="w-3.5 h-3.5" />
        <Clock v-else-if="tahap.aktif" class="w-3.5 h-3.5" />
        <MapPin v-else class="w-3 h-3" />
      </div>

      <!-- Text Details -->
      <div>
        <h4
          class="text-sm font-bold transition-colors"
          :class="tahap.selesai || tahap.aktif ? 'text-on-surface' : 'text-on-surface-variant'"
        >
          {{ tahap.judul }}
        </h4>
        <p class="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{{ tahap.deskripsi }}</p>
      </div>

      <!-- Timestamp -->
      <div class="text-xs font-mono font-bold text-on-surface-variant bg-surface-container border border-outline-variant/20 px-2 py-0.5 rounded-lg w-fit">
        {{ tahap.waktu }}
      </div>
    </div>
  </div>
</template>
