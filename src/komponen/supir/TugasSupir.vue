<script setup lang="ts">
import { ref, computed } from 'vue';
import { Navigation } from 'lucide-vue-next';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import KartuTugas from './KartuTugas.vue';
import PetaRuteOptimal from './PetaRuteOptimal.vue';
import ModalUpdateStatus from './ModalUpdateStatus.vue';
import ModalLaporanKendala from './ModalLaporanKendala.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Filter States
const sesiTerpilih = ref('pagi');
const sekolahTerpilih = ref('SD N 01 Padang');

const daftarSekolah = ['SD N 01 Padang', 'SMP N 1 Padang'];

// Mock Data Tugas Anak
const listAnakTugas = ref([
  {
    id: 'anak-1',
    nama: 'Aisyah Putri',
    sekolah: 'SD N 01 Padang',
    kelas: 'Kelas 4-A',
    alamatJemput: 'Jln. Prof. M. Yamin No. 12, Padang',
    lintangJemput: -0.9471,
    bujurJemput: 100.4172,
    status: 'Belum Dijemput', // Belum Dijemput, berangkat (Menuju Sekolah), sekolah (Tiba di Sekolah), pulang, rumah
    foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces'
  },
  {
    id: 'anak-2',
    nama: 'Rafi Alief',
    sekolah: 'SD N 01 Padang',
    kelas: 'Kelas 5-B',
    alamatJemput: 'Jln. M. Hatta No. 8, Padang',
    lintangJemput: -0.9410,
    bujurJemput: 100.4050,
    status: 'Belum Dijemput',
    foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces'
  },
  {
    id: 'anak-3',
    nama: 'Dafa Pratama',
    sekolah: 'SMP N 1 Padang',
    kelas: 'Kelas 7-C',
    alamatJemput: 'Jln. Khatib Sulaiman No. 45, Padang',
    lintangJemput: -0.9200,
    bujurJemput: 100.3600,
    status: 'Belum Dijemput',
    foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces'
  }
]);

// Filtered tasks based on selections
const tugasTerfilter = computed(() => {
  return listAnakTugas.value.filter(a => {
    // Siswa dicocokkan dengan sekolah terpilih
    return a.sekolah === sekolahTerpilih.value;
  });
});

// Suggested route order details
const totalJarak = computed(() => {
  return (tugasTerfilter.value.length * 2.3).toFixed(1);
});

const totalWaktuEst = computed(() => {
  return tugasTerfilter.value.length * 12;
});

// Modals State
const modalStatusTampil = ref(false);
const modalKendalaTampil = ref(false);
const anakAktif = ref<any>(null);

const bukaStatusModal = (anak: any) => {
  anakAktif.value = anak;
  modalStatusTampil.value = true;
};

const bukaKendalaModal = (anak: any) => {
  anakAktif.value = anak;
  modalKendalaTampil.value = true;
};

// Handler status update
const perbaruiStatusBaru = (data: { idAnak: string; statusBaru: string }) => {
  const anak = listAnakTugas.value.find(a => a.id === data.idAnak);
  if (anak) {
    anak.status = data.statusBaru;
    picuToast(`Sukses memperbarui status perjalanan ${anak.nama}!`, 'sukses');
  }
  modalStatusTampil.value = false;
};

// Handler kendala update
const laporkanKendalaBudi = (data: { idAnak: string; kategori: string; catatan: string }) => {
  const anak = listAnakTugas.value.find(a => a.id === data.idAnak);
  picuToast(`Kendala "${data.kategori.replace('_', ' ')}" dilaporkan untuk siswa ${anak?.nama || 'Semua'}!`, 'info');
  modalKendalaTampil.value = false;
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

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Tugas Penjemputan Hari Ini</h1>
        <p class="text-xs text-slate-400">Ikuti urutan rute optimal untuk efisiensi waktu penjemputan siswa.</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl grid grid-cols-2 gap-4 shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Pilih Sesi Perjalanan:</label>
        <select 
          v-model="sesiTerpilih"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs"
        >
          <option value="pagi">Sesi Pagi (Jemput Sekolah)</option>
          <option value="sore">Sesi Sore (Antar Pulang)</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Filter Sekolah:</label>
        <select 
          v-model="sekolahTerpilih"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs"
        >
          <option v-for="sch in daftarSekolah" :key="sch" :value="sch">{{ sch }}</option>
        </select>
      </div>
    </div>

    <!-- Layout: Map Route and Cards List -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left (2 Columns): Leaflet Optimal Route Map -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Navigation class="w-4 h-4 text-warnaTombol" />
            Peta Rute Navigasi Teroptimasi
          </h3>
          <PetaRuteOptimal :listAnak="tugasTerfilter" />
        </div>

        <!-- Student Cards List -->
        <div class="space-y-4">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Daftar Penjemputan Siswa</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KartuTugas 
              v-for="(anak, idx) in tugasTerfilter" 
              :key="anak.id"
              :anak="anak"
              :urutan="idx + 1"
              @buka-status="bukaStatusModal"
              @buka-kendala="bukaKendalaModal"
            />
          </div>
        </div>
      </div>

      <!-- Right (1 Column): Suggested Sequence Details -->
      <div class="space-y-6">
        <KartuUtama judul="Detail Rute Terhitung" subjudul="Estimasi jarak dan durasi optimal">
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Total Jarak Rute:</span>
              <span class="text-white font-bold">{{ totalJarak }} KM</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Estimasi Waktu Tempuh:</span>
              <span class="text-white font-bold">{{ totalWaktuEst }} Menit</span>
            </div>

            <!-- Sequence List -->
            <div class="space-y-2 pt-2">
              <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Urutan Titik Singgah:</h4>
              <div class="space-y-2">
                <div 
                  v-for="(anak, idx) in tugasTerfilter" 
                  :key="anak.id"
                  class="flex items-center gap-2 bg-warnaUtama/50 p-2.5 rounded-lg border border-warnaAksen/10 text-[11px]"
                >
                  <span class="w-5 h-5 rounded-full bg-warnaTombol text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                    {{ idx + 1 }}
                  </span>
                  <div class="overflow-hidden">
                    <p class="text-white font-bold truncate">{{ anak.nama }}</p>
                    <p class="text-[9px] text-slate-500 truncate">{{ anak.alamatJemput }}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20 text-[11px]">
                  <span class="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                    ✓
                  </span>
                  <div>
                    <p class="text-white font-bold">Sekolah Tujuan</p>
                    <p class="text-[9px] text-slate-500 truncate">{{ sekolahTerpilih }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>

    <!-- Modal Update Status Perjalanan -->
    <ModalUpdateStatus 
      :tampil="modalStatusTampil"
      :anak="anakAktif"
      :sesi="sesiTerpilih"
      @tutup="modalStatusTampil = false"
      @update-status="perbaruiStatusBaru"
    />

    <!-- Modal Laporan Kendala -->
    <ModalLaporanKendala 
      :tampil="modalKendalaTampil"
      :anak="anakAktif"
      @tutup="modalKendalaTampil = false"
      @kirim-kendala="laporkanKendalaBudi"
    />

  </div>
</template>
