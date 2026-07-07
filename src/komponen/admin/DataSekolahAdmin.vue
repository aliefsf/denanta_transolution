<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Trash2, MapPin } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
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

// Mock data Sekolah
const listSekolah = ref([
  { id: 'sch-1', nama: 'SD N 01 Padang', alamat: 'Jln. Sudirman No. 2, Padang Barat, Kota Padang', lintang: -0.9320, bujur: 100.3800, kelasList: ['Kelas 1-A', 'Kelas 2-B', 'Kelas 3-A', 'Kelas 4-A'] },
  { id: 'sch-2', nama: 'SMP N 1 Padang', alamat: 'Jln. Jenderal Ahmad Yani No. 5, Padang Barat, Kota Padang', lintang: -0.9250, bujur: 100.3750, kelasList: ['Kelas 7-A', 'Kelas 8-B', 'Kelas 9-C'] }
]);

// Modals State
const modalTambahTampil = ref(false);
const modalKelasTampil = ref(false);
const sekolahTerpilih = ref<any>(null);

// Form State Sekolah
const formNama = ref('');
const formAlamat = ref('');
const formLintang = ref(-0.9320);
const formBujur = ref(100.3800);

// Form State Kelas
const formKelasNama = ref('');

const resetFormSekolah = () => {
  formNama.value = '';
  formAlamat.value = '';
  formLintang.value = -0.9320;
  formBujur.value = 100.3800;
};

const tambahSekolah = () => {
  if (!formNama.value || !formAlamat.value) {
    picuToast('Mohon lengkapi seluruh data sekolah!', 'error');
    return;
  }

  listSekolah.value.push({
    id: `sch-${listSekolah.value.length + 1}`,
    nama: formNama.value,
    alamat: formAlamat.value,
    lintang: Number(formLintang.value),
    bujur: Number(formBujur.value),
    kelasList: []
  });

  picuToast('Sekolah baru berhasil didaftarkan!', 'sukses');
  modalTambahTampil.value = false;
  resetFormSekolah();
};

const hapusSekolah = (id: string) => {
  listSekolah.value = listSekolah.value.filter(s => s.id !== id);
  picuToast('Sekolah berhasil dihapus!', 'sukses');
};

const bukaModalKelas = (sekolah: any) => {
  sekolahTerpilih.value = sekolah;
  modalKelasTampil.value = true;
};

const tambahKelas = () => {
  if (!formKelasNama.value) return;
  
  if (sekolahTerpilih.value) {
    sekolahTerpilih.value.kelasList.push(formKelasNama.value);
    picuToast(`Kelas ${formKelasNama.value} berhasil ditambahkan ke ${sekolahTerpilih.value.nama}!`, 'sukses');
    formKelasNama.value = '';
  }
};

const hapusKelas = (sekolah: any, kelasName: string) => {
  sekolah.kelasList = sekolah.kelasList.filter((k: string) => k !== kelasName);
  picuToast(`Kelas ${kelasName} berhasil dihapus!`, 'sukses');
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Kelola Data Sekolah Mitra</h1>
        <p class="text-xs text-slate-400">Atur kordinat pemetaan sekolah dan kelas-kelas aktif.</p>
      </div>

      <TombolUtama varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
        <Plus class="w-4 h-4" /> Tambah Sekolah
      </TombolUtama>
    </div>

    <!-- Table of Schools -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Sekolah</th>
              <th class="py-3 px-4">Alamat Sekolah</th>
              <th class="py-3 px-4">Kordinat Maps</th>
              <th class="py-3 px-4">Kelas Terdaftar</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="sch in listSekolah" :key="sch.id" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-semibold text-white">{{ sch.nama }}</td>
              <td class="py-4 px-4 max-w-xs truncate" :title="sch.alamat">{{ sch.alamat }}</td>
              <td class="py-4 px-4 font-mono text-[10px] text-slate-400">
                <span class="flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-warnaTombol" /> {{ sch.lintang }}, {{ sch.bujur }}</span>
              </td>
              <td class="py-4 px-4">
                <span class="px-2 py-0.5 rounded bg-warnaAksen/30 text-white font-bold font-mono">{{ sch.kelasList.length }} Kelas</span>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button 
                  @click="bukaModalKelas(sch)" 
                  class="text-slate-400 hover:text-white p-1.5 border border-warnaAksen/20 rounded bg-warnaUtama/50 hover:bg-warnaAksen transition-colors cursor-pointer text-[10px] font-bold"
                >
                  Manage Kelas
                </button>
                <button 
                  @click="hapusSekolah(sch.id)" 
                  class="text-rose-400 hover:text-rose-300 p-1.5 border border-rose-500/10 rounded bg-rose-500/5 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  title="Hapus Sekolah"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tambah Sekolah -->
    <ModalUtama 
      :tampil="modalTambahTampil" 
      judul="Daftarkan Sekolah Baru" 
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Instansi Sekolah (Wajib):</label>
          <input 
            type="text" 
            v-model="formNama" 
            placeholder="E.g. SD Negeri 01 Padang"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Instansi Sekolah (Wajib):</label>
          <textarea 
            rows="2" 
            v-model="formAlamat" 
            placeholder="E.g. Jln. Sudirman No. 2, Padang Barat"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          ></textarea>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kordinat Lintang (Latitude):</label>
          <input 
            type="number" 
            step="0.0001"
            v-model="formLintang" 
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kordinat Bujur (Longitude):</label>
          <input 
            type="number" 
            step="0.0001"
            v-model="formBujur" 
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
          />
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" @click="tambahSekolah">Daftarkan Sekolah</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Manage Kelas -->
    <ModalUtama 
      v-if="sekolahTerpilih"
      :tampil="modalKelasTampil" 
      :judul="'Manage Kelas: ' + sekolahTerpilih.nama" 
      @tutup="modalKelasTampil = false"
    >
      <div class="space-y-4 text-xs text-slate-300">
        
        <!-- Input Form Tambah Kelas -->
        <div class="flex gap-2">
          <input 
            type="text" 
            v-model="formKelasNama" 
            placeholder="E.g. Kelas 6-B"
            class="flex-grow px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 text-xs"
          />
          <TombolUtama varian="utama" class="text-xs" @click="tambahKelas">Tambah</TombolUtama>
        </div>

        <!-- List Kelas terdaftar -->
        <div class="space-y-2">
          <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Daftar Kelas Aktif:</h4>
          
          <div class="max-h-40 overflow-y-auto space-y-1.5 bg-warnaUtama/50 p-3 rounded-xl border border-warnaAksen/20">
            <div 
              v-for="k in sekolahTerpilih.kelasList" 
              :key="k"
              class="flex justify-between items-center bg-warnaUtama px-3 py-2 rounded border border-warnaAksen/10 text-slate-200"
            >
              <span class="font-semibold">{{ k }}</span>
              <button 
                @click="hapusKelas(sekolahTerpilih, k)"
                class="text-rose-400 hover:text-rose-300 font-bold"
              >
                Hapus
              </button>
            </div>
            <div v-if="sekolahTerpilih.kelasList.length === 0" class="text-center text-slate-500 italic text-[11px] py-4">
              Belum ada kelas terdaftar.
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalKelasTampil = false">Selesai</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
