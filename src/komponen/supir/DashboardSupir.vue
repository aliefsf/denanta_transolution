<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ClipboardList, UserCheck, Play, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, ArrowRight, CalendarX } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import { ambilTugasHariIni, type TugasAnakSupir, type StatusKehadiran } from '../../layanan/supirLayanan';
import { ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { useAuth } from '../../komposabel/useAuth';
import { gunakanRealtimeSubscription } from '../../layanan/realtimeLayanan';

const { currentUser } = useAuth();

interface Props {
  statusKehadiran: StatusKehadiran;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

const siapKerja = computed(() => props.statusKehadiran === 'siap');

const sedangMemuat = ref(true);
const daftarTugas = ref<TugasAnakSupir[]>([]);

const tugasPagi = computed(() => daftarTugas.value.filter(t => t.jenisPerjalanan === 'pagi'));
const tugasSore = computed(() => daftarTugas.value.filter(t => t.jenisPerjalanan === 'sore'));

const selesaiSet = new Set(['tiba', 'dibatalkan']);
const tugasPagiSelesai = computed(() => tugasPagi.value.length > 0 && tugasPagi.value.every(t => selesaiSet.has(t.status)));
const tugasSoreSelesai = computed(() => tugasSore.value.length > 0 && tugasSore.value.every(t => selesaiSet.has(t.status)));

const sekolahTujuanPagi = computed(() => [...new Set(tugasPagi.value.map(t => t.sekolah))].join(', ') || '-');
const sekolahAsalSore = computed(() => [...new Set(tugasSore.value.map(t => t.sekolah))].join(', ') || '-');

const muatTugasHariIni = async () => {
  sedangMemuat.value = true;
  try {
    const hariIni = ambilTanggalWibSekarang();
    daftarTugas.value = await denganBatasWaktu(ambilTugasHariIni(hariIni), 20000, 'Waktu memuat tugas hari ini habis.');
  } catch (err) {
    console.error('Gagal memuat tugas hari ini (dashboard supir):', err);
    daftarTugas.value = [];
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime: begitu Admin membuat/membatalkan penugasan, atau status
// perjalanan berubah (lewat menu Tugas Hari Ini), ringkasan sesi pagi/sore
// di dashboard ini ikut ter-update tanpa refresh. Difilter ke supir_id
// milik akun sendiri saja.
let saluranTugas: { unsubscribe: () => void } | null = null;

onMounted(() => {
  muatTugasHariIni();
  const supirId = currentUser.value?.id;
  if (supirId) {
    saluranTugas = gunakanRealtimeSubscription('perjalanan', `supir_id=eq.${supirId}`, muatTugasHariIni);
  }
});

onUnmounted(() => {
  saluranTugas?.unsubscribe();
  saluranTugas = null;
});

// Supir yang belum mengisi absensi (atau menandai "Tidak Bertugas") tidak
// boleh langsung masuk ke halaman Tugas -- diarahkan dulu ke Absensi
// Harian supaya statusnya jelas sebelum mulai menjemput/mengantar.
const mulaiBertugas = () => {
  if (!siapKerja.value) {
    emit('ubah-tab', 'absensi');
    return;
  }
  emit('ubah-tab', 'tugas');
};

const infoStatusKehadiran = computed(() => {
  switch (props.statusKehadiran) {
    case 'siap':
      return { label: 'SIAP BERTUGAS', kelas: 'text-emerald-600', ikon: CheckCircle2 };
    case 'tidak_siap':
      return { label: 'TIDAK BERTUGAS', kelas: 'text-rose-600', ikon: XCircle };
    default:
      return { label: 'BELUM DIISI', kelas: 'text-amber-600', ikon: HelpCircle };
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Dashboard Supir</h1>
        <p class="text-xs text-on-surface-variant">Ringkasan tugas antar jemput Anda hari ini.</p>
      </div>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <template v-else>
      <!-- Summary Indicators -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- 1. Jemput Pagi -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-2 soft-shadow">
          <div class="flex justify-between items-center text-on-surface-variant text-xs font-semibold">
            <span>Jumlah Siswa Jemput Pagi</span>
            <ClipboardList class="w-4 h-4 text-primary" />
          </div>
          <p class="text-3xl font-black text-on-surface tracking-wide">
            {{ tugasPagi.length }}
            <span class="text-xs font-normal text-on-surface-variant">anak</span>
          </p>
          <p class="text-[10px] text-on-surface-variant truncate" :title="sekolahTujuanPagi">Tujuan: {{ sekolahTujuanPagi }}</p>
        </div>

        <!-- 2. Antar Sore -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-2 soft-shadow">
          <div class="flex justify-between items-center text-on-surface-variant text-xs font-semibold">
            <span>Jumlah Siswa Antar Sore</span>
            <ClipboardList class="w-4 h-4 text-primary" />
          </div>
          <p class="text-3xl font-black text-on-surface tracking-wide">
            {{ tugasSore.length }}
            <span class="text-xs font-normal text-on-surface-variant">anak</span>
          </p>
          <p class="text-[10px] text-on-surface-variant truncate" :title="sekolahAsalSore">Asal: {{ sekolahAsalSore }}</p>
        </div>

        <!-- 3. Status Kehadiran (UC-S01, tri-state: reset otomatis begitu pukul 17:00 WIB terlewati) -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 soft-shadow">
          <div class="flex justify-between items-center text-on-surface-variant text-xs font-semibold">
            <span>Status Kehadiran</span>
            <UserCheck class="w-4 h-4 text-primary" />
          </div>
          <p class="text-lg font-bold flex items-center gap-1.5" :class="infoStatusKehadiran.kelas">
            <component :is="infoStatusKehadiran.ikon" class="w-5 h-5" />
            {{ infoStatusKehadiran.label }}
          </p>
          <button
            @click="emit('ubah-tab', 'absensi')"
            class="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border border-primary/30 bg-primary-container/20 text-primary hover:bg-primary-container/30 transition-colors cursor-pointer"
          >
            Isi / Lihat Absensi Harian
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Sessions Summary Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Pagi Sesi -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-4 soft-shadow">
          <div>
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Sesi Jemputan Pagi</h3>
            <p class="text-[11px] text-on-surface-variant">Tujuan: {{ sekolahTujuanPagi }}</p>
          </div>
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Total Siswa Sesi Pagi:</span>
              <span class="text-on-surface font-bold">{{ tugasPagi.length }} Anak</span>
            </div>
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Status Sesi Hari Ini:</span>
              <span class="font-bold uppercase" :class="tugasPagiSelesai ? 'text-emerald-600' : 'text-amber-600'">
                {{ tugasPagi.length === 0 ? 'Tidak Ada Tugas' : (tugasPagiSelesai ? 'Lengkap Selesai' : 'Belum Selesai') }}
              </span>
            </div>

            <div v-if="tugasPagi.length > 0 && !siapKerja && !tugasPagiSelesai" class="flex gap-2 text-[10px] text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
              <AlertTriangle class="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>Isi absensi harian dengan status "Siap Bertugas" di menu Absensi Harian sebelum memulai navigasi jemputan anak.</span>
            </div>

            <div v-if="tugasPagi.length === 0" class="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-on-surface-variant">
              <CalendarX class="w-4 h-4" />
              Belum ada jadwal/tugas dari Admin untuk sesi ini
            </div>
            <div v-else-if="tugasPagiSelesai" class="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 class="w-4 h-4" />
              Sesi Pagi Sudah Selesai
            </div>
            <div v-else class="pt-2 flex justify-end">
              <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs py-2" @click="mulaiBertugas">
                <Play class="w-3.5 h-3.5" />
                Mulai Tugas Pagi
              </TombolUtama>
            </div>
          </div>
        </div>

        <!-- Sore Sesi -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-4 soft-shadow">
          <div>
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Sesi Jemputan Sore</h3>
            <p class="text-[11px] text-on-surface-variant">Asal: {{ sekolahAsalSore }}</p>
          </div>
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Total Siswa Sesi Sore:</span>
              <span class="text-on-surface font-bold">{{ tugasSore.length }} Anak</span>
            </div>
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Status Sesi Hari Ini:</span>
              <span class="font-bold uppercase" :class="tugasSoreSelesai ? 'text-emerald-600' : 'text-amber-600'">
                {{ tugasSore.length === 0 ? 'Tidak Ada Tugas' : (tugasSoreSelesai ? 'Lengkap Selesai' : 'Belum Selesai') }}
              </span>
            </div>

            <div v-if="tugasSore.length > 0 && !siapKerja && !tugasSoreSelesai" class="flex gap-2 text-[10px] text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
              <AlertTriangle class="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>Isi absensi harian dengan status "Siap Bertugas" di menu Absensi Harian sebelum memulai navigasi antar anak.</span>
            </div>

            <div v-if="tugasSore.length === 0" class="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-on-surface-variant">
              <CalendarX class="w-4 h-4" />
              Belum ada jadwal/tugas dari Admin untuk sesi ini
            </div>
            <div v-else-if="tugasSoreSelesai" class="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 class="w-4 h-4" />
              Sesi Sore Sudah Selesai
            </div>
            <div v-else class="pt-2 flex justify-end">
              <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs py-2" @click="mulaiBertugas">
                <Play class="w-3.5 h-3.5" />
                Mulai Tugas Sore
              </TombolUtama>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>
