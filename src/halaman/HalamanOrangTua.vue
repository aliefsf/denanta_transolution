<script setup lang="ts">
import { ref } from 'vue';
import TataLetakOrangTua from './tataletak/TataLetakOrangTua.vue';
import DashboardOrangTua from '../komponen/orangtua/DashboardOrangTua.vue';
import PantauAnak from '../komponen/orangtua/PantauAnak.vue';
import DetailAnak from '../komponen/orangtua/DetailAnak.vue';
import JadwalOrangTua from '../komponen/orangtua/JadwalOrangTua.vue';
import RiwayatPerjalanan from '../komponen/orangtua/RiwayatPerjalanan.vue';
import RiwayatPembayaran from '../komponen/orangtua/RiwayatPembayaran.vue';
import NotifikasiOrangTua from '../komponen/orangtua/NotifikasiOrangTua.vue';
import ProfilOrangTua from '../komponen/orangtua/ProfilOrangTua.vue';

// Tab Aktif: dashboard, pantau, detail-anak, jadwal, riwayat, pembayaran, notifikasi, profil
const tabAktif = ref<'dashboard' | 'pantau' | 'detail-anak' | 'jadwal' | 'riwayat' | 'pembayaran' | 'notifikasi' | 'profil' | string>('dashboard');
const anakTerpilih = ref<any>(null);

const bukaDetailAnak = (anak: any) => {
  anakTerpilih.value = anak;
  tabAktif.value = 'detail-anak';
};

const kembaliKePantau = () => {
  tabAktif.value = 'pantau';
};
</script>

<template>
  <TataLetakOrangTua :tab-aktif="tabAktif" @ubah-tab="tabAktif = $event">
    <DashboardOrangTua 
      v-if="tabAktif === 'dashboard'" 
      @buka-detail="bukaDetailAnak" 
      @ubah-tab="tabAktif = $event" 
    />
    <PantauAnak 
      v-else-if="tabAktif === 'pantau'" 
      @buka-detail="bukaDetailAnak" 
    />
    <DetailAnak 
      v-else-if="tabAktif === 'detail-anak'" 
      :anak="anakTerpilih" 
      @kembali="kembaliKePantau" 
    />
    <JadwalOrangTua 
      v-else-if="tabAktif === 'jadwal'" 
    />
    <RiwayatPerjalanan 
      v-else-if="tabAktif === 'riwayat'" 
    />
    <RiwayatPembayaran 
      v-else-if="tabAktif === 'pembayaran'" 
    />
    <NotifikasiOrangTua 
      v-else-if="tabAktif === 'notifikasi'" 
    />
    <ProfilOrangTua 
      v-else-if="tabAktif === 'profil'" 
    />
  </TataLetakOrangTua>
</template>
