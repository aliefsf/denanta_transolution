<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShieldAlert } from 'lucide-vue-next';
import TataLetakSupir from './tataletak/TataLetakSupir.vue';
import DashboardSupir from '../komponen/supir/DashboardSupir.vue';
import AbsensiSupir from '../komponen/supir/AbsensiSupir.vue';
import TugasSupir from '../komponen/supir/TugasSupir.vue';
import RiwayatSupir from '../komponen/supir/RiwayatSupir.vue';
import ProfilSupir from '../komponen/supir/ProfilSupir.vue';
import NotifikasiSupir from '../komponen/supir/NotifikasiSupir.vue';
import { ambilStatusKehadiran, ambilStatusAktifSupir, type StatusKehadiran } from '../layanan/supirLayanan';

const route = useRoute();
const router = useRouter();

// Tab Aktif: dashboard, absensi, tugas, riwayat, notifikasi, profil
const tabAktif = ref<'dashboard' | 'absensi' | 'tugas' | 'riwayat' | 'notifikasi' | 'profil' | string>('dashboard');
const statusKehadiran = ref<StatusKehadiran>('belum_diisi');

// Akun yang dinonaktifkan Admin (togglAktifSupir() di adminLayanan.ts) hanya
// boleh mengakses "Profil Saya" -- default true (optimistis) supaya tidak
// ada kedipan layar terkunci sebelum status sebenarnya diketahui; begitu
// fetch di onMounted selesai dan ternyata false, tabAktif dipaksa ke
// 'profil' dan setiap percobaan pindah tab (baik dari sidebar maupun query
// ?tab= di URL) ditolak selama akun masih nonaktif.
const akunAktif = ref(true);

// Sinkronkan tabAktif dengan route.query.tab secara reaktif melalui pemantauan
// fullPath -- termasuk saat tombol back/forward perangkat/browser dipakai.
watch(
  () => route.fullPath,
  () => {
    if (route.query.tab && typeof route.query.tab === 'string') {
      tabAktif.value = akunAktif.value ? route.query.tab : 'profil';
    }
  },
  { immediate: true }
);

// router.push (bukan ubah tabAktif.value langsung) -- supaya tiap pindah tab
// tercatat sebagai entri riwayat browser, jadi tombol back bisa berpindah
// antar-tab (lihat catatan panjang yang sama di HalamanOrangTua.vue).
const ubahTab = (tab: string) => {
  const tujuan = akunAktif.value ? tab : 'profil';
  if (tabAktif.value === tujuan) return;
  router.push({ path: route.path, query: { ...route.query, tab: tujuan } });
};

watch(akunAktif, (aktif) => {
  if (!aktif) tabAktif.value = 'profil';
});

// AbsensiSupir.vue yang memanggil perbaruiStatusKehadiran() sendiri (termasuk
// menampilkan toast-nya sendiri) -- di sini cukup sinkronkan status terkini
// supaya badge header & ringkasan Dashboard ikut ter-update tanpa reload.
const sinkronStatusKehadiran = (status: StatusKehadiran) => {
  statusKehadiran.value = status;
};

onMounted(async () => {
  try {
    statusKehadiran.value = await ambilStatusKehadiran();
  } catch {
    // biarkan default 'belum_diisi' bila gagal memuat status awal
  }
  try {
    akunAktif.value = await ambilStatusAktifSupir();
  } catch {
    // Gagal memuat -- biarkan default true (optimistis), lebih baik daripada
    // salah mengunci akun aktif hanya karena request sempat gagal/timeout.
  }
});
</script>

<template>
  <div class="min-h-screen bg-background">
    <TataLetakSupir
      :tab-aktif="tabAktif"
      :status-kehadiran="statusKehadiran"
      :akun-aktif="akunAktif"
      @ubah-tab="ubahTab"
    >
      <div v-if="!akunAktif" class="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-4 py-3">
        <ShieldAlert class="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-rose-600" />
        <p class="leading-relaxed">
          <strong>Akun Anda dinonaktifkan sementara oleh Admin.</strong> Anda hanya dapat mengakses halaman Profil selama akun berstatus nonaktif.
        </p>
      </div>

      <DashboardSupir
        v-if="tabAktif === 'dashboard'"
        :status-kehadiran="statusKehadiran"
        @ubah-tab="ubahTab"
      />
      <AbsensiSupir
        v-else-if="tabAktif === 'absensi'"
        @ubah-status="sinkronStatusKehadiran"
      />
      <TugasSupir
        v-else-if="tabAktif === 'tugas'"
      />
      <RiwayatSupir
        v-else-if="tabAktif === 'riwayat'"
      />
      <NotifikasiSupir
        v-else-if="tabAktif === 'notifikasi'"
      />
      <ProfilSupir
        v-else-if="tabAktif === 'profil'"
      />
    </TataLetakSupir>
  </div>
</template>
