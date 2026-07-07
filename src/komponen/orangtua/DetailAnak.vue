<script setup lang="ts">
import { ref } from 'vue';
import { 
  ArrowLeft, Phone, MapPin, School, Clock, ShieldCheck 
} from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import PemilihPeta from '../umum/PemilihPeta.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';
import PetaLokasiLangsung from './PetaLokasiLangsung.vue';
import GarisWaktuPerjalanan from './GarisWaktuPerjalanan.vue';
import PenilaianSupir from './PenilaianSupir.vue';

interface Props {
  anak: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'kembali'): void;
}>();

const modalUbahAlamatTampil = ref(false);
const lintangBaru = ref(-0.9471);
const bujurBaru = ref(100.4172);
const alamatBaruTeks = ref('');
const alamatTerubah = ref(false);

const tanganiPetaBaru = (data: { lintang: number; bujur: number; alamat: string }) => {
  lintangBaru.value = data.lintang;
  bujurBaru.value = data.bujur;
  alamatBaruTeks.value = data.alamat;
};

const simpanAlamatBaru = () => {
  props.anak.alamatJemput = alamatBaruTeks.value;
  props.anak.lintangJemput = lintangBaru.value;
  props.anak.bujurJemput = bujurBaru.value;
  modalUbahAlamatTampil.value = false;
  alamatTerubah.value = true;
  setTimeout(() => {
    alamatTerubah.value = false;
  }, 3000);
};

// Mock Riwayat Perjalanan Sebelumnya
const riwayatSebelumnya = ref([
  { tanggal: 'Senin, 06 Juli 2026', tipe: 'Antar Jemput (PP)', status: 'rumah', supir: 'Pak Budi', durasi: '25 Menit' },
  { tanggal: 'Jumat, 03 Juli 2026', tipe: 'Antar Jemput (PP)', status: 'rumah', supir: 'Pak Budi', durasi: '28 Menit' },
  { tanggal: 'Kamis, 02 Juli 2026', tipe: 'Antar Jemput (PP)', status: 'rumah', supir: 'Pak Budi', durasi: '22 Menit' },
]);
</script>

<template>
  <div class="space-y-6">
    <!-- Header with back button -->
    <div class="flex items-center gap-3">
      <button 
        @click="emit('kembali')" 
        class="p-2 bg-warnaSekunder hover:bg-warnaAksen border border-warnaAksen/30 rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors"
      >
        <ArrowLeft class="w-5 h-5" />
      </button>
      <div>
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Detail Perjalanan Siswa</h1>
        <p class="text-xs text-slate-400">Informasi pergerakan armada dan riwayat absensi harian.</p>
      </div>
    </div>

    <!-- Alert success ubah alamat -->
    <div v-if="alamatTerubah" class="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl text-emerald-400 text-xs">
      Sukses memperbarui rute alamat penjemputan anak! Supir pendamping akan mendapatkan rute terbaru di dashboard-nya.
    </div>

    <!-- Main Detail Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left (2 Columns): Map and Timeline -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- Live Map Tracking Box -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin class="w-4 h-4 text-warnaTombol" />
              Peta Pelacakan Lokasi Langsung
            </h3>
            <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">GPS Aktif</span>
          </div>

          <PetaLokasiLangsung 
            :lintangRumah="anak.lintangJemput || -0.9471" 
            :bujurRumah="anak.bujurJemput || 100.4172" 
          />
        </div>

        <!-- Today Journey Timeline -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-6 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-warnaTombol" />
            Garis Waktu Absensi Perjalanan Hari Ini
          </h3>
          <GarisWaktuPerjalanan :status="anak.status" />
        </div>

        <!-- Past Journey History -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Histori Perjalanan Sebelumnya</h3>
          <div class="divide-y divide-warnaAksen/20">
            <div 
              v-for="(tri, idx) in riwayatSebelumnya" 
              :key="idx" 
              class="py-3 flex justify-between items-center text-xs"
            >
              <div>
                <p class="font-bold text-white">{{ tri.tanggal }}</p>
                <p class="text-slate-400 mt-0.5">Supir: {{ tri.supir }} | Rute: {{ tri.tipe }}</p>
              </div>
              <div class="text-right space-y-1">
                <span class="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Selesai</span>
                <p class="text-[10px] text-slate-500 font-mono">{{ tri.durasi }}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right (1 Column): Child Info & Actions -->
      <div class="space-y-6">
        <!-- Profile Card & Details -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow relative overflow-hidden">
          <div class="flex items-center gap-4 border-b border-warnaAksen/20 pb-4">
            <img :src="anak.foto" :alt="anak.nama" class="w-14 h-14 rounded-2xl object-cover border border-warnaAksen/30" />
            <div>
              <h3 class="text-base font-bold text-white">{{ anak.nama }}</h3>
              <BadgeStatusAnak :status="anak.status" class="mt-1" />
            </div>
          </div>

          <div class="space-y-4 text-xs">
            <div class="space-y-1">
              <p class="text-slate-400 flex items-center gap-1"><School class="w-3.5 h-3.5 text-warnaTombol" /> Sekolah & Kelas</p>
              <p class="text-slate-200 font-bold">{{ anak.sekolah }} | {{ anak.kelas }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-slate-400 flex items-center gap-1"><ShieldCheck class="w-3.5 h-3.5 text-warnaTombol" /> Jenis Layanan</p>
              <p class="text-slate-200 font-bold">{{ anak.layanan }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-slate-400 flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-warnaTombol" /> Alamat Penjemputan</p>
              <p class="text-slate-300 font-semibold leading-relaxed">{{ anak.alamatJemput }}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-3 text-center border-t border-warnaAksen/20 pt-4">
              <div class="bg-warnaUtama/50 border border-warnaAksen/20 p-2.5 rounded-xl">
                <p class="text-slate-500 text-[10px] uppercase font-bold">Golongan Darah</p>
                <p class="text-sm font-bold text-white mt-1">{{ anak.golonganDarah || 'O' }}</p>
              </div>
              <div class="bg-warnaUtama/50 border border-warnaAksen/20 p-2.5 rounded-xl">
                <p class="text-slate-500 text-[10px] uppercase font-bold">Alergi Medis</p>
                <p class="text-xs font-bold text-white mt-1.5 truncate">{{ anak.alergi || 'Tidak Ada' }}</p>
              </div>
            </div>

            <!-- Action buttons parent -->
            <div class="space-y-2 pt-2">
              <TombolUtama varian="utama" class="w-full text-xs py-2.5" @click="modalUbahAlamatTampil = true">
                Perbarui Alamat Jemput
              </TombolUtama>
              <a :href="'tel:' + anak.kontakSupir" class="block w-full">
                <TombolUtama varian="garis-luar" class="w-full text-xs py-2.5 gap-1.5">
                  <Phone class="w-4 h-4 text-warnaTombol" />
                  Hubungi Supir (Budi)
                </TombolUtama>
              </a>
            </div>
          </div>
        </div>

        <!-- Driver Review Box (Optional) -->
        <PenilaianSupir :namaSupir="anak.namaSupir" />
      </div>

    </div>

    <!-- Modal Ubah Alamat Pin Point Map -->
    <ModalUtama 
      :tampil="modalUbahAlamatTampil" 
      judul="Pindahkan Koordinat Jemput Anak" 
      ukuran="lebar"
      @tutup="modalUbahAlamatTampil = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-slate-400">
          Silakan geser pin pada peta di bawah untuk memperbarui lokasi penjemputan anak Anda secara real-time. Rute supir otomatis menyesuaikan.
        </p>
        <PemilihPeta @pilih-lokasi="tanganiPetaBaru" />
        <div class="bg-warnaUtama/50 p-3 rounded-xl border border-warnaAksen/30 text-xs">
          <p class="text-slate-400">Alamat Baru Terdeteksi:</p>
          <p class="text-white font-bold mt-1">{{ alamatBaruTeks }}</p>
        </div>
      </div>
      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalUbahAlamatTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" @click="simpanAlamatBaru">Simpan Alamat Baru</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
