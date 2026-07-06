<script setup lang="ts">
import { ref } from 'vue';
import { Play, Square, MapPin, UserCheck } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

const melacak = ref(false);
const kordinatSimulasi = ref({ lat: -6.3725, lng: 106.8294 });
const anakJemputan = ref([
  { id: 1, nama: 'Rafi Alief', alamat: 'Kost Widya, Kukusan, Depok', status: 'Belum Dijemput' },
  { id: 2, nama: 'Aisyah Putri', alamat: 'Perumahan Pesona Khayangan, Depok', status: 'Sudah Dijemput' }
]);

const togglePelacakan = () => {
  melacak.value = !melacak.value;
  if (melacak.value) {
    // Jalankan interval simulasi pergeseran GPS
    const interval = setInterval(() => {
      if (!melacak.value) {
        clearInterval(interval);
        return;
      }
      kordinatSimulasi.value.lat += (Math.random() - 0.5) * 0.0005;
      kordinatSimulasi.value.lng += (Math.random() - 0.5) * 0.0005;
    }, 3000);
  }
};

const konfirmasiJemput = (id: number) => {
  const anak = anakJemputan.value.find(a => a.id === id);
  if (anak) {
    anak.status = anak.status === 'Belum Dijemput' ? 'Sudah Dijemput' : 'Belum Dijemput';
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-wide">Dashboard Supir</h2>
        <p class="text-slate-400 text-xs mt-0.5">Kirim lokasi GPS aktif dan kelola daftar jemputan siswa.</p>
      </div>
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
        :class="melacak ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="melacak ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
        {{ melacak ? 'GPS Aktif' : 'GPS Mati' }}
      </span>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Tracking Controller -->
      <div class="lg:col-span-1 space-y-6">
        <KartuUtama judul="Kontrol Pelacakan" subjudul="Kirim kordinat lokasi ke dashboard orang tua">
          <div class="space-y-6">
            <div class="p-5 bg-warnaUtama/50 border border-warnaAksen/20 rounded-xl space-y-4">
              <div>
                <p class="text-xs text-slate-400">Garis Lintang (Latitude)</p>
                <p class="text-base font-mono text-white mt-0.5">{{ kordinatSimulasi.lat.toFixed(6) }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">Garis Bujur (Longitude)</p>
                <p class="text-base font-mono text-white mt-0.5">{{ kordinatSimulasi.lng.toFixed(6) }}</p>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <TombolUtama
                :varian="melacak ? 'bahaya' : 'utama'"
                class="w-full gap-2 py-3"
                @click="togglePelacakan"
              >
                <component :is="melacak ? Square : Play" class="w-4 h-4 fill-current" />
                {{ melacak ? 'Matikan Pengiriman GPS' : 'Mulai Kirim GPS Lokasi' }}
              </TombolUtama>
              <p class="text-[10px] text-slate-400 text-center leading-relaxed">
                *Mengaktifkan GPS akan mengonsumsi daya baterai. Harap sambungkan ponsel ke pengisi daya.
              </p>
            </div>
          </div>
        </KartuUtama>

        <KartuUtama judul="Informasi Armada">
          <div class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-warnaAksen/20 pb-2">
              <span class="text-slate-400">Nama Armada:</span>
              <span class="text-white font-medium">Denanta Depok-1</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/20 pb-2">
              <span class="text-slate-400">Nomor Polisi:</span>
              <span class="text-white font-medium">B 1234 DTS</span>
            </div>
            <div class="flex justify-between pb-1">
              <span class="text-slate-400">Kapasitas Kursi:</span>
              <span class="text-white font-medium">7 Penumpang</span>
            </div>
          </div>
        </KartuUtama>
      </div>

      <!-- Right: Children Pick up List -->
      <div class="lg:col-span-2">
        <KartuUtama judul="Daftar Antar-Jemput Siswa" subjudul="Centang siswa yang telah berhasil dijemput">
          <div class="space-y-4">
            <div
              v-for="anak in anakJemputan"
              :key="anak.id"
              class="p-4 bg-warnaUtama/30 border border-warnaAksen/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:border-warnaAksen/40"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <p class="text-base font-bold text-white">{{ anak.nama }}</p>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-semibold"
                    :class="anak.status === 'Sudah Dijemput' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
                  >
                    {{ anak.status }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin class="w-3.5 h-3.5 text-warnaTombol" />
                  {{ anak.alamat }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <TombolUtama
                  :varian="anak.status === 'Sudah Dijemput' ? 'garis-luar' : 'aksen'"
                  ukuran="kecil"
                  class="gap-1.5"
                  @click="konfirmasiJemput(anak.id)"
                >
                  <UserCheck class="w-4 h-4" />
                  {{ anak.status === 'Sudah Dijemput' ? 'Batalkan' : 'Konfirmasi Jemput' }}
                </TombolUtama>
              </div>
            </div>
          </div>
        </KartuUtama>
      </div>
    </div>
  </div>
</template>
