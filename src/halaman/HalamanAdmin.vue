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
import DaftarPenggunaAdmin from '../komponen/admin/DaftarPenggunaAdmin.vue';
import PengaturanAdmin from '../komponen/admin/PengaturanAdmin.vue';
import KelolaJadwalAdmin from '../komponen/admin/KelolaJadwalAdmin.vue';
import NotifikasiAdmin from '../komponen/admin/NotifikasiAdmin.vue';

// Tab Aktif: dashboard, pemantauan, supir, penugasan, anak, sekolah, laporan, pengguna, tarif, jadwal
// (mengikuti skenario use case Admin UC-A01 s.d. UC-A09)
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
    <DaftarPenggunaAdmin
      v-else-if="tabAktif === 'pengguna'"
    />
    <PengaturanAdmin
      v-else-if="tabAktif === 'tarif'"
    />
    <KelolaJadwalAdmin
      v-else-if="tabAktif === 'jadwal'"
    />
    <NotifikasiAdmin
      v-else-if="tabAktif === 'notifikasi'"
    />
  </TataLetakAdmin>
</template>
