<script setup lang="ts">
import { ref } from 'vue';
import { Sparkles, Plus, Send } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import KartuPenugasan from './KartuPenugasan.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Form States
const modalTambahTampil = ref(false);
const formSekolah = ref('SD N 01 Padang');
const formSupir = ref('Budi Santoso');
const formTanggal = ref('2026-07-07');
const formSesi = ref('pagi');

const anakTerpilih = ref<string[]>([]);

// Mock Data
const listSekolah = ['SD N 01 Padang', 'SMP N 1 Padang'];
const listSupir = ['Budi Santoso', 'Andi Pratama', 'Hendra Wijaya'];
const listAnakOptions = ref([
  { id: 'a-1', nama: 'Aisyah Putri', sekolah: 'SD N 01 Padang' },
  { id: 'a-2', nama: 'Rafi Alief', sekolah: 'SD N 01 Padang' },
  { id: 'a-3', nama: 'Dafa Pratama', sekolah: 'SMP N 1 Padang' }
]);

const listPenugasan = ref([
  {
    id: 'assign-1',
    sekolah: 'SD N 01 Padang',
    supir: 'Budi Santoso',
    tanggal: '2026-07-07',
    sesi: 'pagi',
    anakList: ['Aisyah Putri', 'Rafi Alief']
  }
]);

const hapusPenugasan = (id: string) => {
  listPenugasan.value = listPenugasan.value.filter(p => p.id !== id);
  picuToast('Penugasan berhasil dibatalkan!', 'sukses');
};

const buatPenugasan = () => {
  if (anakTerpilih.value.length === 0) {
    picuToast('Pilih minimal satu anak untuk ditugaskan!', 'error');
    return;
  }

  // Get names of selected children
  const names = listAnakOptions.value
    .filter(a => anakTerpilih.value.includes(a.id))
    .map(a => a.nama);

  listPenugasan.value.push({
    id: `assign-${listPenugasan.value.length + 1}`,
    sekolah: formSekolah.value,
    supir: formSupir.value,
    tanggal: formTanggal.value,
    sesi: formSesi.value,
    anakList: names
  });

  picuToast('Penugasan berhasil dibuat! Notifikasi otomatis dikirim ke driver dan orang tua via WhatsApp.', 'sukses');
  modalTambahTampil.value = false;
  anakTerpilih.value = [];
};

// Auto-assign algorithm
const runAutoAssign = () => {
  picuToast('Menghitung rute terdekat dan posisi GPS supir...', 'info');
  setTimeout(() => {
    // Simulate assigning Dafa Pratama to Andi Pratama for SMP N 1 Padang
    listPenugasan.value.push({
      id: `assign-auto`,
      sekolah: 'SMP N 1 Padang',
      supir: 'Andi Pratama',
      tanggal: '2026-07-07',
      sesi: 'pagi',
      anakList: ['Dafa Pratama']
    });
    picuToast('Saran Optimal Berhasil: Andi Pratama ditugaskan ke SMP N 1 Padang!', 'sukses');
  }, 1000);
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Penugasan Driver & Rute</h1>
        <p class="text-xs text-slate-400">Atur penugasan harian supir berdasarkan sekolah dan sesi rute.</p>
      </div>

      <div class="flex gap-2">
        <!-- Auto Assign Button -->
        <button 
          @click="runAutoAssign"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaAksen hover:bg-opacity-95 text-white cursor-pointer border border-warnaAksen"
        >
          <Sparkles class="w-4 h-4 text-warnaTombol fill-warnaTombol" /> Auto-Assign Rute
        </button>

        <TombolUtama varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
          <Plus class="w-4 h-4" /> Tugaskan Manual
        </TombolUtama>
      </div>
    </div>

    <!-- Active Schedules Grid -->
    <div class="space-y-4">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider">Jadwal Tugas Sesi Berjalan</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KartuPenugasan 
          v-for="p in listPenugasan" 
          :key="p.id" 
          :penugasan="p" 
          @hapus="hapusPenugasan"
        />
      </div>
      <div v-if="listPenugasan.length === 0" class="text-center py-10 text-slate-500 italic text-xs">
        Belum ada penugasan terdaftar hari ini.
      </div>
    </div>

    <!-- Modal Penugasan Manual -->
    <ModalUtama 
      :tampil="modalTambahTampil" 
      judul="Buat Penugasan Rute Manual" 
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Sekolah:</label>
          <select 
            v-model="formSekolah"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option v-for="sch in listSekolah" :key="sch" :value="sch">{{ sch }}</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Supir:</label>
          <select 
            v-model="formSupir"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option v-for="sup in listSupir" :key="sup" :value="sup">{{ sup }}</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tanggal Tugas:</label>
          <input 
            type="date" 
            v-model="formTanggal"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Sesi Jemputan:</label>
          <select 
            v-model="formSesi"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option value="pagi">Sesi Pagi (Pergi Sekolah)</option>
            <option value="sore">Sesi Sore (Pulang Sekolah)</option>
          </select>
        </div>

        <!-- Multi Select Anak (List Checklist) -->
        <div class="col-span-2 space-y-2 border-t border-warnaAksen/20 pt-3">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pilih Siswa (Bisa Multi-Select):</label>
          <div class="max-h-36 overflow-y-auto space-y-2 bg-warnaUtama/50 p-3 rounded-xl border border-warnaAksen/20">
            <label 
              v-for="anak in listAnakOptions" 
              :key="anak.id"
              class="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-warnaUtama/85 transition-colors"
            >
              <input 
                type="checkbox" 
                :value="anak.id"
                v-model="anakTerpilih"
                class="accent-warnaTombol"
              />
              <span class="text-white">{{ anak.nama }} <span class="text-[9px] text-slate-500">({{ anak.sekolah }})</span></span>
            </label>
          </div>
        </div>

      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" class="gap-1.5" @click="buatPenugasan">
          Tugaskan Manual
          <Send class="w-3.5 h-3.5" />
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
