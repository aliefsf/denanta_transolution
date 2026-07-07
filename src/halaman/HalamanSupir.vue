<script setup lang="ts">
import { ref } from 'vue';
import TataLetakSupir from './tataletak/TataLetakSupir.vue';
import DashboardSupir from '../komponen/supir/DashboardSupir.vue';
import TugasSupir from '../komponen/supir/TugasSupir.vue';
import RiwayatSupir from '../komponen/supir/RiwayatSupir.vue';
import ProfilSupir from '../komponen/supir/ProfilSupir.vue';
import NotifikasiUtama from '../komponen/umum/NotifikasiUtama.vue';

// Tab Aktif: dashboard, tugas, riwayat, profil
const tabAktif = ref<'dashboard' | 'tugas' | 'riwayat' | 'profil' | string>('dashboard');
const siapKerja = ref(true);

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const ubahStatusSiap = (status: boolean) => {
  siapKerja.value = status;
  picuToast(
    `Status kemudi diubah: ${status ? 'SIAP BERTUGAS (Notifikasi WhatsApp aktif)' : 'TIDAK SIAP (Layanan tugas dinonaktifkan)'}`,
    status ? 'sukses' : 'error'
  );
};
</script>

<template>
  <div class="min-h-screen bg-warnaUtama">
    <!-- Toast Alert -->
    <NotifikasiUtama 
      :tampil="toastTampil" 
      :pesan="toastPesan" 
      :tipe="toastTipe" 
      @tutup="toastTampil = false" 
    />

    <TataLetakSupir 
      :tab-aktif="tabAktif" 
      :siap-kerja="siapKerja"
      @ubah-tab="tabAktif = $event"
      @ubah-siap="ubahStatusSiap"
    >
      <DashboardSupir 
        v-if="tabAktif === 'dashboard'" 
        :siap-kerja="siapKerja"
        @ubah-tab="tabAktif = $event" 
        @ubah-siap="ubahStatusSiap"
      />
      <TugasSupir 
        v-else-if="tabAktif === 'tugas'" 
      />
      <RiwayatSupir 
        v-else-if="tabAktif === 'riwayat'" 
      />
      <ProfilSupir 
        v-else-if="tabAktif === 'profil'" 
      />
    </TataLetakSupir>
  </div>
</template>
