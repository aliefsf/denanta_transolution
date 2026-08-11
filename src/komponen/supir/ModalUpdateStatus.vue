<script setup lang="ts">
import { Bus, CheckCircle, XCircle } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import type { TugasAnakSupir } from '../../layanan/supirLayanan';
import type { StatusPerjalanan } from '../../tipe';

interface Props {
  tampil: boolean;
  anak: TugasAnakSupir | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'update-status', data: { perjalananId: string; statusBaru: StatusPerjalanan }): void;
}>();

const perbaruiStatus = (status: StatusPerjalanan) => {
  if (!props.anak) return;
  emit('update-status', {
    perjalananId: props.anak.perjalananId,
    statusBaru: status
  });
};
</script>

<template>
  <ModalUtama
    tema="terang"
    :tampil="tampil"
    judul="Perbarui Status Perjalanan Siswa"
    @tutup="emit('tutup')"
  >
    <div v-if="anak" class="space-y-6 text-xs text-on-surface-variant">
      <div class="flex items-center gap-4 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
        <img
          v-if="anak.foto"
          :src="anak.foto"
          :alt="anak.nama"
          class="w-12 h-12 rounded-xl object-cover border border-outline-variant/30"
        />
        <div class="space-y-1">
          <h4 class="text-sm font-bold text-on-surface">{{ anak.nama }}</h4>
          <p class="text-on-surface-variant">{{ anak.sekolah }} | {{ anak.kelas }}</p>
          <span class="inline-block px-2 py-0.5 rounded bg-primary-container/30 text-primary border border-primary/20 uppercase font-mono font-bold text-[9px]">
            Sesi: {{ anak.jenisPerjalanan }}
          </span>
        </div>
      </div>

      <div class="space-y-3">
        <h4 class="font-bold text-on-surface uppercase tracking-wider">Aksi Perubahan Status:</h4>

        <!-- Pagi Sesi Actions -->
        <div v-if="anak.jenisPerjalanan === 'pagi'" class="space-y-2">
          <!-- Naik Armada -->
          <button
            @click="perbaruiStatus('menuju_sekolah')"
            class="w-full flex items-center justify-between p-3.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-on-surface text-xs">Konfirmasi Anak Naik Armada</span>
              <p class="text-[9px] text-on-surface-variant mt-0.5">Siswa terjemput dari rumah, posisi bus terpantau real-time.</p>
            </div>
            <Bus class="w-5 h-5 text-primary" />
          </button>

          <!-- Tiba di Sekolah -->
          <button
            @click="perbaruiStatus('di_sekolah')"
            class="w-full flex items-center justify-between p-3.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-on-surface text-xs">Konfirmasi Tiba di Sekolah</span>
              <p class="text-[9px] text-on-surface-variant mt-0.5">Siswa telah diantar dan diserahterimakan ke pihak sekolah.</p>
            </div>
            <CheckCircle class="w-5 h-5 text-emerald-600" />
          </button>
        </div>

        <!-- Sore Sesi Actions -->
        <div v-else class="space-y-2">
          <!-- Naik Armada (Pulang) -->
          <button
            @click="perbaruiStatus('pengantaran')"
            class="w-full flex items-center justify-between p-3.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-on-surface text-xs">Konfirmasi Anak Naik Armada (Pulang)</span>
              <p class="text-[9px] text-on-surface-variant mt-0.5">Siswa terjemput dari sekolah, memulai rute pulang.</p>
            </div>
            <Bus class="w-5 h-5 text-primary" />
          </button>

          <!-- Tiba di Rumah -->
          <button
            @click="perbaruiStatus('tiba')"
            class="w-full flex items-center justify-between p-3.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-on-surface text-xs">Konfirmasi Tiba di Rumah</span>
              <p class="text-[9px] text-on-surface-variant mt-0.5">Siswa telah diserahterimakan kembali ke orang tua/wali.</p>
            </div>
            <CheckCircle class="w-5 h-5 text-emerald-600" />
          </button>
        </div>

        <!-- Tandai Tidak Hadir / Dibatalkan -->
        <button
          @click="perbaruiStatus('dibatalkan')"
          class="w-full flex items-center justify-between p-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer text-left transition-colors"
        >
          <div>
            <span class="font-bold text-rose-700 text-xs">Tandai Dibatalkan (Anak Tidak Hadir)</span>
            <p class="text-[9px] text-rose-500 mt-0.5">Anak tidak menggunakan layanan pada sesi ini hari ini.</p>
          </div>
          <XCircle class="w-5 h-5 text-rose-500" />
        </button>
      </div>
    </div>

    <template #footer>
      <TombolUtama tema="terang" varian="garis-luar" @click="emit('tutup')">Tutup</TombolUtama>
    </template>
  </ModalUtama>
</template>
