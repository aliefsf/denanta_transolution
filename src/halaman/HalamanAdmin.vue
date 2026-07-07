<script setup lang="ts">
import { ref } from 'vue';
import TataLetakAdmin from './tataletak/TataLetakAdmin.vue';
import DashboardAdmin from '../komponen/admin/DashboardAdmin.vue';
import PemantauanAdmin from '../komponen/admin/PemantauanAdmin.vue';
import DataSupirAdmin from '../komponen/admin/DataSupirAdmin.vue';
import PenugasanAdmin from '../komponen/admin/PenugasanAdmin.vue';
import DataAnakAdmin from '../komponen/admin/DataAnakAdmin.vue';
import DataSekolahAdmin from '../komponen/admin/DataSekolahAdmin.vue';
import LaporanAdmin from '../komponen/admin/LaporanAdmin.vue';
import KeuanganAdmin from '../komponen/admin/KeuanganAdmin.vue';
import DaftarPenggunaAdmin from '../komponen/admin/DaftarPenggunaAdmin.vue';
import PengumumanAdmin from '../komponen/admin/PengumumanAdmin.vue';
import LogAktivitasAdmin from '../komponen/admin/LogAktivitasAdmin.vue';
import PengaturanAdmin from '../komponen/admin/PengaturanAdmin.vue';

// Tab Aktif: dashboard, pemantauan, supir, penugasan, anak, sekolah, laporan, keuangan, pengguna, pengumuman, log, pengaturan
const tabAktif = ref<'dashboard' | string>('dashboard');
</script>

<template>
  <TataLetakAdmin :tab-aktif="tabAktif" @ubah-tab="tabAktif = $event">
    <DashboardAdmin 
      v-if="tabAktif === 'dashboard'" 
      @ubah-tab="tabAktif = $event" 
    />
    <PemantauanAdmin 
      v-else-if="tabAktif === 'pemantauan'" 
    />
    <DataSupirAdmin 
      v-else-if="tabAktif === 'supir'" 
    />
    <PenugasanAdmin 
      v-else-if="tabAktif === 'penugasan'" 
    />
    <DataAnakAdmin 
      v-else-if="tabAktif === 'anak'" 
    />
    <DataSekolahAdmin 
      v-else-if="tabAktif === 'sekolah'" 
    />
    <LaporanAdmin 
      v-else-if="tabAktif === 'laporan'" 
    />
    <KeuanganAdmin 
      v-else-if="tabAktif === 'keuangan'" 
    />
    <DaftarPenggunaAdmin 
      v-else-if="tabAktif === 'pengguna'" 
    />
    <PengumumanAdmin 
      v-else-if="tabAktif === 'pengumuman'" 
    />
    <LogAktivitasAdmin 
      v-else-if="tabAktif === 'log'" 
    />
    <PengaturanAdmin 
      v-else-if="tabAktif === 'pengaturan'" 
    />
  </TataLetakAdmin>
</template>
