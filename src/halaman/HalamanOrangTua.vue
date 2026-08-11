<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import TataLetakOrangTua from './tataletak/TataLetakOrangTua.vue';
import DashboardOrangTua from '../komponen/orangtua/DashboardOrangTua.vue';
import PantauAnak from '../komponen/orangtua/PantauAnak.vue';
import DetailAnak from '../komponen/orangtua/DetailAnak.vue';
import JadwalOrangTua from '../komponen/orangtua/JadwalOrangTua.vue';
import RiwayatPerjalanan from '../komponen/orangtua/RiwayatPerjalanan.vue';
import RiwayatPembayaran from '../komponen/orangtua/RiwayatPembayaran.vue';
import NotifikasiOrangTua from '../komponen/orangtua/NotifikasiOrangTua.vue';
import ProfilOrangTua from '../komponen/orangtua/ProfilOrangTua.vue';
import { useDataOrangTua } from '../komposabel/useDataOrangTua';
import { petakanAnakTampilan } from '../bantuan/petakanAnak';
import type { AnakTampilan } from '../tipe';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { anakAktifList, perjalananHariIniList } = useDataOrangTua();

// Akun tidak aktif (langganan berakhir, belum lanjut bayar) hanya boleh
// berada di tab 'pembayaran' -- lihat juga menuList di TataLetakOrangTua.vue
// yang menyembunyikan seluruh menu lain supaya tidak ada jalan UI menuju
// tab-tab tersebut, dan pengaman berlapis di bawah (perbaruiTabDariQuery +
// ubahTab) supaya tidak bisa diakali lewat query ?tab= atau event lama.
const akunAktif = computed(() => authStore.sudahBerlangganan);

// Tab Aktif: dashboard, pantau, detail-anak, jadwal, riwayat, pembayaran, notifikasi, profil
const tabAktif = ref<'dashboard' | 'pantau' | 'detail-anak' | 'jadwal' | 'riwayat' | 'pembayaran' | 'notifikasi' | 'profil' | string>(
  akunAktif.value ? 'dashboard' : 'pembayaran'
);

// Hanya menyimpan ID anak yang dipilih -- objek tampilannya dihitung ulang
// secara reaktif dari perjalananHariIniList (disinkronkan realtime oleh
// useDataOrangTua), supaya perubahan status dari panel Supir langsung
// tampil di panel Detail Anak tanpa refresh.
const anakTerpilihId = ref<string | null>(null);
const anakTerpilih = computed<AnakTampilan | null>(() => {
  const anak = anakAktifList.value.find((a) => a.id === anakTerpilihId.value);
  return anak ? petakanAnakTampilan(anak, perjalananHariIniList.value) : null;
});

// Menu Jadwal hanya berlaku utk anak berlangganan BULANAN (lihat catatan
// sama di TataLetakOrangTua.vue) -- dijaga juga di sini supaya tab 'jadwal'
// tidak bisa "dipaksa" tampil lewat query ?tab=jadwal pada akun yang semua
// anaknya berlangganan harian.
const adaAnakLanggananBulanan = computed(() => anakAktifList.value.some((a) => a.jenis_langganan === 'bulanan'));

const perbaruiTabDariQuery = () => {
  if (!akunAktif.value) {
    tabAktif.value = 'pembayaran';
    anakTerpilihId.value = null;
    return;
  }
  if (route.query.tab && typeof route.query.tab === 'string') {
    tabAktif.value = route.query.tab;
  }
  anakTerpilihId.value = typeof route.query.anak === 'string' ? route.query.anak : null;
};

// Sinkronkan tabAktif dengan route.query.tab secara reaktif melalui pemantauan
// fullPath -- SATU-SATUNYA tempat yang boleh mengubah tabAktif/anakTerpilihId
// langsung. Berlaku juga saat load pertama (immediate: true) MAUPUN saat
// tombol back/forward perangkat/browser ditekan (Vue Router otomatis
// memicu ulang route.fullPath saat riwayat berpindah), jadi tab yang
// ditampilkan selalu mengikuti entri riwayat yang sedang aktif.
watch(
  () => route.fullPath,
  () => {
    perbaruiTabDariQuery();
  },
  { immediate: true }
);

// Begitu akun tidak aktif terdeteksi belakangan (mis. baru selesai dimuat
// setelah komponen mount), atau sebaliknya baru aktif kembali setelah
// pembayaran berhasil di tab Pembayaran, sinkronkan ulang tab yang boleh
// diakses tanpa menunggu navigasi route berikutnya.
watch(akunAktif, (aktif) => {
  if (!aktif) tabAktif.value = 'pembayaran';
});

// Satu-satunya jalan mengubah tab dari komponen anak (menggantikan binding
// langsung "tabAktif = $event") -- memaksa tetap ke 'pembayaran' kalau akun
// sedang tidak aktif, supaya tidak bisa diakali lewat event ubah-tab lama
// yang mungkin masih dikirim komponen anak (mis. tombol dalam DashboardOrangTua).
//
// PENTING: pindah tab lewat router.push (query ?tab=), BUKAN sekadar
// mengubah tabAktif.value langsung -- supaya setiap pindah tab tercatat
// sebagai entri riwayat browser sungguhan. Tanpa ini, tombol back
// perangkat/browser dari tab mana pun (mis. Profil) tidak akan kembali ke
// tab sebelumnya (mis. Dashboard), melainkan langsung keluar dari /orangtua
// ke halaman sebelum dashboard dibuka (atau keluar dari website) -- karena
// dari sudut pandang riwayat browser, berpindah tab lewat ref biasa TIDAK
// PERNAH menambah entri apa pun. tabAktif sendiri tidak diubah di sini;
// perubahan sesungguhnya terjadi lewat watcher route.fullPath di atas
// begitu navigasi ini selesai.
const ubahTab = (tab: string) => {
  const tujuan = akunAktif.value ? tab : 'pembayaran';
  if (tabAktif.value === tujuan && anakTerpilihId.value === null) return;
  router.push({ path: route.path, query: { ...route.query, tab: tujuan, anak: undefined } });
};

const bukaDetailAnak = (anak: AnakTampilan) => {
  if (!akunAktif.value) return;
  router.push({ path: route.path, query: { ...route.query, tab: 'detail-anak', anak: anak.id } });
};

const kembaliKePantau = () => {
  router.push({ path: route.path, query: { ...route.query, tab: akunAktif.value ? 'pantau' : 'pembayaran', anak: undefined } });
};
</script>

<template>
  <TataLetakOrangTua :tab-aktif="tabAktif" @ubah-tab="ubahTab">
    <DashboardOrangTua 
      v-if="tabAktif === 'dashboard'" 
      @buka-detail="bukaDetailAnak" 
      @ubah-tab="ubahTab" 
    />
    <PantauAnak 
      v-else-if="tabAktif === 'pantau'" 
      @buka-detail="bukaDetailAnak" 
    />
    <DetailAnak
      v-else-if="tabAktif === 'detail-anak' && anakTerpilih"
      :anak="anakTerpilih"
      @kembali="kembaliKePantau"
    />
    <JadwalOrangTua
      v-else-if="tabAktif === 'jadwal' && adaAnakLanggananBulanan"
    />
    <DashboardOrangTua
      v-else-if="tabAktif === 'jadwal'"
      @buka-detail="bukaDetailAnak"
      @ubah-tab="ubahTab"
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
