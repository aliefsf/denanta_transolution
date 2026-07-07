<script setup lang="ts">
import { ref } from 'vue';
import { Wallet, Compass, Save } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Pricing Configuration
const tarifPp = ref(475000);
const tarifAntarSaja = ref(275000);
const tarifJemputSaja = ref(275000);
const tarifPerKm = ref(4200);
const biayaMinHarian = ref(20000);

// Discount Parameter
const potonganHari = ref(40); // Potongan 40% if school days <= 10 days

// Service Area Boundary Padang
const batasUtara = ref(-0.8000);
const batasSelatan = ref(-1.0000);
const batasBarat = ref(100.3000);
const batasTimur = ref(100.5000);

const simpanTarif = () => {
  picuToast('Konfigurasi tarif dasar platform berhasil disimpan!', 'sukses');
};

const simpanArea = () => {
  picuToast('Batas koordinat wilayah operasional Kota Padang berhasil diperbarui!', 'sukses');
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Pengaturan Platform & Keuangan</h1>
      <p class="text-xs text-slate-400">Atur tarif dasar langganan, potongan biaya sekolah, dan batas wilayah GPS.</p>
    </div>

    <!-- Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column (2 Columns): Pricing & Discount -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 1. Form Tarif Dasar -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <Wallet class="w-4.5 h-4.5 text-warnaTombol" />
            Tarif & Parameter Layanan
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="simpanTarif">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tarif Bulanan PP:</label>
                <input 
                  type="number" 
                  v-model="tarifPp" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono font-bold"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tarif Antar Saja:</label>
                <input 
                  type="number" 
                  v-model="tarifAntarSaja" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono font-bold"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tarif Jemput Saja:</label>
                <input 
                  type="number" 
                  v-model="tarifJemputSaja" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono font-bold"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Biaya Per KM Jarak Jauh:</label>
                <input 
                  type="number" 
                  v-model="tarifPerKm" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono font-bold"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Biaya Minimal Harian (3.5 KM):</label>
                <input 
                  type="number" 
                  v-model="biayaMinHarian" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono font-bold"
                />
              </div>
            </div>

            <!-- Discount Parameter -->
            <div class="space-y-1.5 border-t border-warnaAksen/20 pt-4">
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Persentase Potongan Hari Pendek (&le; 10 Hari Sekolah):</label>
              <div class="flex items-center gap-2 max-w-[200px]">
                <input 
                  type="number" 
                  v-model="potonganHari" 
                  required
                  class="w-20 px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none font-mono font-bold"
                />
                <span class="text-white font-bold">% Potongan</span>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama varian="utama" class="gap-1.5" tipe="submit">
                <Save class="w-4 h-4" /> Simpan Konfigurasi Tarif
              </TombolUtama>
            </div>
          </form>
        </div>
      </div>

      <!-- Right Column (1 Column): Service Area GPS Boundaries -->
      <div class="space-y-6">
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-xs">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <Compass class="w-4.5 h-4.5 text-warnaTombol" />
            Batas Wilayah Layanan Padang
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="simpanArea">
            <div class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Batas Lintang Utara:</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="batasUtara" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Batas Lintang Selatan:</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="batasSelatan" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Batas Bujur Barat:</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="batasBarat" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Batas Bujur Timur:</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="batasTimur" 
                  required
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 font-mono"
                />
              </div>
            </div>

            <TombolUtama varian="utama" class="w-full gap-1.5" tipe="submit">
              <Save class="w-4 h-4" /> Perbarui Batas GPS
            </TombolUtama>
          </form>
        </div>
      </div>

    </div>
  </div>
</template>
