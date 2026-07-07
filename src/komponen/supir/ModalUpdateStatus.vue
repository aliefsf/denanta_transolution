<script setup lang="ts">
import { Bus, CheckCircle } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

interface Props {
  tampil: boolean;
  anak: any;
  sesi: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'update-status', data: { idAnak: string; statusBaru: string }): void;
}>();

const perbaruiStatus = (status: string) => {
  emit('update-status', {
    idAnak: props.anak.id,
    statusBaru: status
  });
};
</script>

<template>
  <ModalUtama 
    :tampil="tampil" 
    judul="Perbarui Status Perjalanan Siswa" 
    @tutup="emit('tutup')"
  >
    <div v-if="anak" class="space-y-6 text-xs text-slate-300">
      <div class="flex items-center gap-4 bg-warnaUtama/50 p-4 rounded-xl border border-warnaAksen/20">
        <img :src="anak.foto" :alt="anak.nama" class="w-12 h-12 rounded-xl object-cover border border-warnaAksen/30" />
        <div class="space-y-1">
          <h4 class="text-sm font-bold text-white">{{ anak.nama }}</h4>
          <p class="text-slate-400">{{ anak.sekolah }} | {{ anak.kelas }}</p>
          <span class="inline-block px-2 py-0.5 rounded bg-warnaTombol/10 text-warnaTombol border border-warnaTombol/20 uppercase font-mono font-bold text-[9px]">
            Sesi: {{ sesi }}
          </span>
        </div>
      </div>

      <div class="space-y-3">
        <h4 class="font-bold text-white uppercase tracking-wider">Aksi Perubahan Status:</h4>
        
        <!-- Pagi Sesi Actions -->
        <div v-if="sesi === 'pagi'" class="space-y-2">
          <!-- Naik Bus -->
          <button
            @click="perbaruiStatus('berangkat')"
            class="w-full flex items-center justify-between p-3.5 bg-warnaUtama hover:bg-warnaAksen border border-warnaAksen/20 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-white text-xs">Konfirmasi Anak Naik Bus</span>
              <p class="text-[9px] text-slate-500 mt-0.5">Siswa terjemput dari rumah, posisi bus terpantau real-time.</p>
            </div>
            <Bus class="w-5 h-5 text-warnaTombol" />
          </button>

          <!-- Tiba di Sekolah -->
          <button
            @click="perbaruiStatus('sekolah')"
            class="w-full flex items-center justify-between p-3.5 bg-warnaUtama hover:bg-warnaAksen border border-warnaAksen/20 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-white text-xs">Konfirmasi Tiba di Sekolah</span>
              <p class="text-[9px] text-slate-500 mt-0.5">Siswa telah diantar dan diserahterimakan ke pihak sekolah.</p>
            </div>
            <CheckCircle class="w-5 h-5 text-emerald-400" />
          </button>
        </div>

        <!-- Sore Sesi Actions -->
        <div v-else class="space-y-2">
          <!-- Naik Bus (Pulang) -->
          <button
            @click="perbaruiStatus('pulang')"
            class="w-full flex items-center justify-between p-3.5 bg-warnaUtama hover:bg-warnaAksen border border-warnaAksen/20 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-white text-xs">Konfirmasi Anak Naik Bus (Pulang)</span>
              <p class="text-[9px] text-slate-500 mt-0.5">Siswa terjemput dari sekolah, memulai rute pulang.</p>
            </div>
            <Bus class="w-5 h-5 text-warnaTombol" />
          </button>

          <!-- Tiba di Rumah -->
          <button
            @click="perbaruiStatus('rumah')"
            class="w-full flex items-center justify-between p-3.5 bg-warnaUtama hover:bg-warnaAksen border border-warnaAksen/20 rounded-xl cursor-pointer text-left transition-colors"
          >
            <div>
              <span class="font-bold text-white text-xs">Konfirmasi Tiba di Rumah</span>
              <p class="text-[9px] text-slate-500 mt-0.5">Siswa telah diserahterimakan kembali ke orang tua/wali.</p>
            </div>
            <CheckCircle class="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </div>
    </div>
    
    <template #footer>
      <TombolUtama varian="garis-luar" @click="emit('tutup')">Tutup</TombolUtama>
    </template>
  </ModalUtama>
</template>
