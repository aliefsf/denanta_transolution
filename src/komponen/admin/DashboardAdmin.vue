<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Users, Truck, Navigation, Wallet, MapPinned, LayoutDashboard } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { ambilRingkasanDashboard } from '../../layanan/adminLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';

const emit = defineEmits<{
  (e: 'ubah-tab', tab: string): void;
}>();

const sedangMemuat = ref(true);
const errorPesan = ref('');

const anakAktif = ref(0);
const supirBertugas = ref(0);
const perjalananBerlangsung = ref(0);
const perjalananSelesai = ref(0);
const pendapatanBulanIni = ref(0);

const muatRingkasan = async () => {
  try {
    const ringkasan = await denganBatasWaktu(ambilRingkasanDashboard(), 20000);
    anakAktif.value = ringkasan.anakAktif;
    supirBertugas.value = ringkasan.supirBertugas;
    perjalananBerlangsung.value = ringkasan.perjalananBerlangsung;
    perjalananSelesai.value = ringkasan.perjalananSelesai;
    pendapatanBulanIni.value = ringkasan.pendapatanBulanIni;
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal memuat ringkasan dashboard.';
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime: card statistik ikut berubah begitu ada perubahan pada salah
// satu dari 4 tabel sumbernya (lihat ambilRingkasanDashboard) -- event-driven,
// bukan interval berkala.
const saluranList: { unsubscribe: () => void }[] = [];

onMounted(async () => {
  sedangMemuat.value = true;
  await muatRingkasan();
  for (const tabel of ['anak', 'supir', 'perjalanan', 'pembayaran'] as const) {
    saluranList.push(pantauTabelAdminRealtime(tabel, muatRingkasan));
  }
});

onUnmounted(() => {
  saluranList.forEach((s) => s.unsubscribe());
  saluranList.length = 0;
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
        <LayoutDashboard class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-on-surface tracking-tight">Dashboard Administrator</h1>
        <p class="text-sm text-on-surface-variant">Ringkasan status operasional armada dan rekonsiliasi billing harian.</p>
      </div>
    </div>

    <div v-if="errorPesan" class="bg-error-container/40 border border-error/20 text-error p-3.5 rounded-xl text-xs">
      {{ errorPesan }}
    </div>

    <!-- 3 Widgets Row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- 1. Anak Aktif -->
      <div class="bg-surface-container-lowest rounded-xl p-5 space-y-2 border border-outline-variant/30 soft-shadow">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-on-surface-variant">Siswa Aktif</span>
          <span class="bg-brand-tosca-light text-primary p-2 rounded-lg"><Users class="w-4 h-4" /></span>
        </div>
        <p class="text-3xl font-black text-on-surface font-mono">{{ sedangMemuat ? '—' : anakAktif }}</p>
        <p class="text-[10px] text-on-surface-variant">Anak dengan status berlangganan aktif</p>
      </div>

      <!-- 2. Supir Bertugas -->
      <div class="bg-surface-container-lowest rounded-xl p-5 space-y-2 border border-outline-variant/30 soft-shadow">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-on-surface-variant">Supir Bertugas</span>
          <span class="bg-brand-tosca-light text-primary p-2 rounded-lg"><Truck class="w-4 h-4" /></span>
        </div>
        <p class="text-3xl font-black text-on-surface font-mono">{{ sedangMemuat ? '—' : supirBertugas }}</p>
        <p class="text-[10px] text-on-surface-variant">Supir aktif dan berstatus tersedia</p>
      </div>

      <!-- 3. Status Perjalanan -->
      <div class="bg-surface-container-lowest rounded-xl p-5 space-y-2 border border-outline-variant/30 soft-shadow">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-on-surface-variant">Status Perjalanan Hari Ini</span>
          <span class="bg-brand-tosca-light text-primary p-2 rounded-lg"><Navigation class="w-4 h-4" /></span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-on-surface font-mono">{{ sedangMemuat ? '—' : perjalananBerlangsung }}</span>
          <span class="text-xs text-on-surface-variant">Berlangsung</span>
          <span class="text-on-surface-variant font-mono">/</span>
          <span class="text-2xl font-black text-on-surface font-mono">{{ sedangMemuat ? '—' : perjalananSelesai }}</span>
          <span class="text-xs text-on-surface-variant">Selesai</span>
        </div>
      </div>
    </div>

    <!-- Pendapatan + Monitoring Global Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Pendapatan Bulan Ini -->
      <div class="bg-surface-container-lowest rounded-xl p-6 space-y-3 border border-outline-variant/30 soft-shadow flex flex-col justify-center">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-on-surface-variant">Pemasukan Bulan Ini</span>
          <span class="bg-brand-tosca-light text-primary p-2 rounded-lg"><Wallet class="w-4 h-4" /></span>
        </div>
        <p class="text-2xl md:text-3xl font-black text-primary font-mono">
          {{ sedangMemuat ? '—' : formatMataUang(pendapatanBulanIni) }}
        </p>
        <p class="text-[10px] text-emerald-600 font-semibold">Total pembayaran berstatus lunas sejak awal bulan</p>
      </div>

      <!-- Monitoring Global Shortcut -->
      <div class="bg-surface-container-lowest rounded-xl p-6 space-y-3 border border-outline-variant/30 soft-shadow flex flex-col justify-between">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold text-on-surface-variant">Monitoring Global</span>
          <span class="bg-brand-tosca-light text-primary p-2 rounded-lg"><MapPinned class="w-4 h-4" /></span>
        </div>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Pantau posisi GPS seluruh armada supir yang sedang bertugas secara langsung di peta.
        </p>
        <button
          @click="emit('ubah-tab', 'pemantauan')"
          class="self-start border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
        >
          Buka Pemantauan Armada
        </button>
      </div>
    </div>
  </div>
</template>
