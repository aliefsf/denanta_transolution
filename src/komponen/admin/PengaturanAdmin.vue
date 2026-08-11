<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Wallet, Save, Loader2 } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import { ambilPengaturanTarif, perbaruiPengaturanTarif } from '../../layanan/tarifLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const sedangMemuat = ref(true);
const sedangMenyimpan = ref(false);

// Pricing Configuration (UC-A09: Mengelola Tarif)
const tarifPp = ref(0);
const tarifAntarSaja = ref(0);
const tarifJemputSaja = ref(0);
const tarifPerKm = ref(0);
const biayaMinHarian = ref(0);
const biayaMinPerubahanJadwal = ref(0);
const potonganHari = ref(0);

const muatTarif = async () => {
  sedangMemuat.value = true;
  try {
    const tarif = await denganBatasWaktu(ambilPengaturanTarif(), 20000);
    tarifPp.value = tarif.tarif_antar_jemput;
    tarifAntarSaja.value = tarif.tarif_antar_saja;
    tarifJemputSaja.value = tarif.tarif_jemput_saja;
    tarifPerKm.value = tarif.tarif_per_km;
    biayaMinHarian.value = tarif.biaya_minimal_harian;
    biayaMinPerubahanJadwal.value = tarif.biaya_minimal_perubahan_jadwal;
    potonganHari.value = tarif.potongan_hari_pendek_persen;
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat pengaturan tarif.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime -- kalau tarif diubah dari perangkat/tab admin lain, form ini
// ikut menyegarkan diri, KECUALI sedang dalam proses menyimpan (menghindari
// menimpa perubahan yang baru saja dikirim dengan hasil balapan/race).
let saluranTarif: { unsubscribe: () => void } | null = null;

onMounted(async () => {
  await muatTarif();
  saluranTarif = pantauTabelAdminRealtime('pengaturan_tarif', () => {
    if (!sedangMenyimpan.value) muatTarif();
  });
});

onUnmounted(() => {
  saluranTarif?.unsubscribe();
  saluranTarif = null;
});

const simpanTarif = async () => {
  sedangMenyimpan.value = true;
  try {
    await perbaruiPengaturanTarif({
      tarif_antar_jemput: Number(tarifPp.value),
      tarif_antar_saja: Number(tarifAntarSaja.value),
      tarif_jemput_saja: Number(tarifJemputSaja.value),
      tarif_per_km: Number(tarifPerKm.value),
      biaya_minimal_harian: Number(biayaMinHarian.value),
      biaya_minimal_perubahan_jadwal: Number(biayaMinPerubahanJadwal.value),
      potongan_hari_pendek_persen: Number(potonganHari.value)
    });
    picuToast('Konfigurasi tarif dasar platform berhasil disimpan!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan konfigurasi tarif.', 'error');
  } finally {
    sedangMenyimpan.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Toast Alert -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="toastTampil = false"
    />

    <div>
      <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Kelola Tarif</h1>
      <p class="text-xs text-on-surface-variant">Atur parameter tarif dasar dan tarif per kilometer untuk layanan.</p>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <div v-else class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-xl space-y-4 soft-shadow max-w-3xl">
      <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/30 pb-3">
        <Wallet class="w-4.5 h-4.5 text-primary" />
        Tarif & Parameter Layanan
      </h3>

      <form class="space-y-4 text-xs" @submit.prevent="simpanTarif">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tarif Bulanan PP:</label>
            <input
              type="number"
              v-model="tarifPp"
              required
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tarif Antar Saja:</label>
            <input
              type="number"
              v-model="tarifAntarSaja"
              required
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tarif Jemput Saja:</label>
            <input
              type="number"
              v-model="tarifJemputSaja"
              required
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Biaya Per KM Jarak Jauh:</label>
            <input
              type="number"
              v-model="tarifPerKm"
              required
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Biaya Minimal Harian (3.5 KM):</label>
            <input
              type="number"
              v-model="biayaMinHarian"
              required
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
          </div>
        </div>

        <!-- Biaya tambahan khusus langganan bulanan yang butuh jemput/antar di
             luar jadwal normal (fitur "Ajukan Perubahan Jadwal") -- SENGAJA
             parameter terpisah dari Biaya Minimal Harian, supaya tarif
             layanan harian (non-langganan) dan biaya tambahan jadwal berbeda
             (sudah langganan bulanan) tidak saling menimpa. -->
        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Biaya Minimal Perubahan Jadwal (Jadwal Berbeda, 3.5 KM):</label>
          <input
            type="number"
            v-model="biayaMinPerubahanJadwal"
            required
            class="w-full md:w-1/3 px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
          />
          <p class="text-[10px] text-on-surface-variant mt-1">Dipakai saat orang tua yang sudah berlangganan bulanan mengajukan jemput/antar di luar jadwal normal (mis. pulang lebih sore karena ekstrakurikuler) -- terpisah dari tarif Layanan Harian di atas.</p>
        </div>

        <!-- Discount Parameter -->
        <div class="space-y-1.5 border-t border-outline-variant/30 pt-4">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Persentase Potongan Hari Pendek (&le; 10 Hari Sekolah):</label>
          <div class="flex items-center gap-2 max-w-[200px]">
            <input
              type="number"
              v-model="potonganHari"
              required
              class="w-20 px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono font-bold"
            />
            <span class="text-on-surface font-bold">% Potongan</span>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <TombolUtama tema="terang" varian="utama" class="gap-1.5" tipe="submit" :nonaktif="sedangMenyimpan">
            <Save class="w-4 h-4" /> {{ sedangMenyimpan ? 'Menyimpan...' : 'Simpan Konfigurasi Tarif' }}
          </TombolUtama>
        </div>
      </form>
    </div>
  </div>
</template>
