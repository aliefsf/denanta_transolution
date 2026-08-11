<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Info } from 'lucide-vue-next';
import KartuUtama from './KartuUtama.vue';
import { formatMataUang } from '../../bantuan/formatMataUang';
import { ambilPengaturanTarif, hitungBiayaBulanan, hitungBiayaHarian, type PengaturanTarifRow } from '../../layanan/tarifLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';

const jenisLayanan = ref<'antar_jemput' | 'antar_saja' | 'jemput_saja'>('antar_jemput');
const jenisLangganan = ref<'bulanan' | 'harian'>('bulanan');
const jarakKm = ref(5);

const tarif = ref<PengaturanTarifRow | null>(null);
const sedangMemuat = ref(true);

onMounted(async () => {
  try {
    tarif.value = await denganBatasWaktu(ambilPengaturanTarif(), 20000);
  } catch {
    // Biarkan tarif tetap null; tampilan estimasi disembunyikan bila gagal dimuat
  } finally {
    sedangMemuat.value = false;
  }
});

// Hitung biaya berdasarkan pilihan
const biayaEstimasi = computed(() => {
  if (!tarif.value) return 0;
  if (jenisLangganan.value === 'harian') {
    return hitungBiayaHarian(tarif.value, jarakKm.value);
  }
  return hitungBiayaBulanan(tarif.value, jenisLayanan.value);
});
</script>

<template>
  <KartuUtama 
    judul="Kalkulator Estimasi Biaya" 
    subjudul="Hitung perkiraan biaya transportasi anak Anda secara instan"
  >
    <div class="space-y-6">
      <!-- Jenis Layanan -->
      <div>
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Jenis Layanan
        </label>
        <select 
          v-model="jenisLayanan"
          class="w-full px-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
        >
          <option value="antar_jemput">Antar Jemput (Pulang Pergi)</option>
          <option value="antar_saja">Antar Saja (Pagi)</option>
          <option value="jemput_saja">Jemput Saja (Siang/Sore)</option>
        </select>
      </div>

      <!-- Tipe Langganan -->
      <div>
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Siklus Pembayaran
        </label>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            @click="jenisLangganan = 'bulanan'"
            class="py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
            :class="jenisLangganan === 'bulanan' ? 'bg-warnaAksen border-warnaAksen text-white' : 'bg-warnaUtama border-warnaAksen/20 text-slate-400 hover:text-white'"
          >
            Bulanan
          </button>
          <button
            type="button"
            @click="jenisLangganan = 'harian'"
            class="py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
            :class="jenisLangganan === 'harian' ? 'bg-warnaAksen border-warnaAksen text-white' : 'bg-warnaUtama border-warnaAksen/20 text-slate-400 hover:text-white'"
          >
            Harian (Bayar per Trip)
          </button>
        </div>
      </div>

      <!-- Parameter Dinamis -->
      <div class="space-y-4">
        <!-- Input Jarak (Harian) -->
        <div v-if="jenisLangganan === 'harian'">
          <div class="flex justify-between text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            <span>Jarak Rumah ke Sekolah</span>
            <span class="text-warnaTombol font-mono">{{ jarakKm }} KM</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="30" 
            v-model.number="jarakKm" 
            class="w-full accent-warnaTombol bg-warnaUtama h-2 rounded-lg cursor-pointer"
          />
        </div>

      </div>

      <!-- Hasil Output Estimasi -->
      <div class="p-4 bg-warnaUtama/50 border border-warnaAksen/20 rounded-xl space-y-2 text-center">
        <p class="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Estimasi Biaya</p>
        <p v-if="sedangMemuat" class="text-sm text-slate-400">Memuat tarif terbaru...</p>
        <p v-else-if="!tarif" class="text-sm text-slate-400">Gagal memuat tarif, silakan muat ulang halaman.</p>
        <p v-else class="text-3xl font-black text-white tracking-wide">
          {{ formatMataUang(biayaEstimasi) }}
          <span class="text-xs font-normal text-slate-400">
            / {{ jenisLangganan === 'harian' ? 'trip' : 'bulan' }}
          </span>
        </p>
      </div>

      <!-- Catatan detail -->
      <div class="flex gap-2 text-[10px] text-slate-400 leading-relaxed bg-warnaUtama/20 p-3 rounded-lg border border-warnaAksen/10">
        <Info class="w-4 h-4 text-warnaTombol flex-shrink-0" />
        <p v-if="jenisLangganan === 'bulanan'">
          *Tarif bulanan flat sesuai jenis layanan, tidak dipengaruhi jarak maupun jumlah hari penjemputan. Jika jadwal pulang anak berubah di luar jadwal, berlaku biaya tambahan sesuai jarak.
        </p>
        <p v-else>
          *Biaya harian dihitung otomatis menggunakan GPS supir berdasarkan jarak penjemputan sebenarnya ke sekolah.
        </p>
      </div>
    </div>
  </KartuUtama>
</template>
