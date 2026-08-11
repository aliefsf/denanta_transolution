<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Clock } from 'lucide-vue-next';
import { ambilWaktuSekarang, apakahWaktuSimulasiAktif } from '../../bantuan/waktuSimulasi';

interface Props {
  // 'gelap' dipakai halaman dengan tema lama (Orang Tua/Supir lama), 'terang'
  // dipakai halaman dengan palet Material terang (Admin, dst).
  tema?: 'gelap' | 'terang';
}

withDefaults(defineProps<Props>(), {
  tema: 'gelap'
});

// Selalu memakai zona waktu Asia/Jakarta (WIB, UTC+7) lewat Intl API,
// bukan zona waktu perangkat pengguna -- supaya jam tetap benar meskipun
// dibuka dari perangkat dengan zona waktu lain.
const formatTanggal = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const formatWaktu = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const teksJam = ref('');
const simulasiAktif = ref(false);

const perbaruiJam = () => {
  const sekarang = ambilWaktuSekarang();
  simulasiAktif.value = apakahWaktuSimulasiAktif();
  teksJam.value = `${formatTanggal.format(sekarang)} | ${formatWaktu.format(sekarang)} WIB`;
};

let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  perbaruiJam();
  interval = setInterval(perbaruiJam, 1000);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<template>
  <div
    class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold font-mono tabular-nums"
    :class="simulasiAktif
      ? 'bg-amber-50 border-amber-300 text-amber-700'
      : (tema === 'terang'
        ? 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
        : 'bg-warnaUtama border-warnaAksen/20 text-slate-400')"
    :title="simulasiAktif ? 'Waktu disimulasikan untuk demo -- bukan waktu asli' : ''"
  >
    <Clock class="w-3.5 h-3.5 flex-shrink-0" :class="simulasiAktif ? 'text-amber-600' : (tema === 'terang' ? 'text-primary' : 'text-warnaTombol')" />
    <span>{{ teksJam }}<template v-if="simulasiAktif"> (Simulasi)</template></span>
  </div>
</template>
