<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Trash2, ShieldAlert, Eye } from 'lucide-vue-next';
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

// Drivers List Mock Data
const listSupir = ref([
  { 
    id: 'dr-1', 
    nama: 'Budi Santoso', 
    email: 'budi@denantats.com', 
    telepon: '0821-7788-9900', 
    kendaraan: 'Toyota HiAce', 
    platNomor: 'BA 1024 TA', 
    tipe: 'Tetap',
    status: 'Aktif', 
    verifikasi: 'Terverifikasi', 
    riwayatKomplain: 'Tidak ada komplain' 
  },
  { 
    id: 'dr-2', 
    nama: 'Andi Pratama', 
    email: 'andi@denantats.com', 
    telepon: '0812-4455-6677', 
    kendaraan: 'Isuzu Elf', 
    platNomor: 'BA 9931 OP', 
    tipe: 'Sementara',
    status: 'Aktif', 
    verifikasi: 'Menunggu', 
    riwayatKomplain: 'Siswa tertinggal 1x (Juni)' 
  }
]);

// Modals State
const modalTambahTampil = ref(false);
const modalDetailTampil = ref(false);
const supirTerpilih = ref<any>(null);

// Form State
const formNama = ref('');
const formEmail = ref('');
const formTelepon = ref('');
const formKendaraan = ref('Toyota HiAce');
const formPlat = ref('');
const formTipe = ref('Tetap');

const resetForm = () => {
  formNama.value = '';
  formEmail.value = '';
  formTelepon.value = '';
  formKendaraan.value = 'Toyota HiAce';
  formPlat.value = '';
  formTipe.value = 'Tetap';
};

const tambahSupir = () => {
  if (!formNama.value || !formEmail.value || !formPlat.value) {
    picuToast('Mohon lengkapi seluruh kolom formulir!', 'error');
    return;
  }

  listSupir.value.push({
    id: `dr-${listSupir.value.length + 1}`,
    nama: formNama.value,
    email: formEmail.value,
    telepon: formTelepon.value || '08xx-xxxx-xxxx',
    kendaraan: formKendaraan.value,
    platNomor: formPlat.value,
    tipe: formTipe.value,
    status: 'Aktif',
    verifikasi: 'Menunggu',
    riwayatKomplain: 'Tidak ada komplain'
  });

  picuToast('Supir baru berhasil didaftarkan! Status dokumen: Menunggu Verifikasi.', 'sukses');
  modalTambahTampil.value = false;
  resetForm();
};

const hapusSupir = (id: string) => {
  listSupir.value = listSupir.value.filter(s => s.id !== id);
  picuToast('Data supir berhasil dihapus!', 'sukses');
};

const bukaDetail = (supir: any) => {
  supirTerpilih.value = supir;
  modalDetailTampil.value = true;
};

const verifikasiDokumen = (status: 'Terverifikasi' | 'Ditolak') => {
  if (supirTerpilih.value) {
    supirTerpilih.value.verifikasi = status;
    picuToast(`Status verifikasi supir ${supirTerpilih.value.nama} diubah menjadi: ${status.toUpperCase()}`, 'sukses');
    modalDetailTampil.value = false;
  }
};

const toggleStatusSupir = (supir: any) => {
  supir.status = supir.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
  picuToast(`Status akun supir ${supir.nama} diubah menjadi: ${supir.status.toUpperCase()}`, 'info');
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Kelola Data Driver (Supir)</h1>
        <p class="text-xs text-slate-400">Verifikasi dokumen SIM/STNK/SKCK dan atur kepegawaian supir.</p>
      </div>

      <TombolUtama varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
        <Plus class="w-4 h-4" /> Tambah Supir
      </TombolUtama>
    </div>

    <!-- Table of Drivers -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Supir</th>
              <th class="py-3 px-4">Kontak & Email</th>
              <th class="py-3 px-4">Kendaraan / Plat</th>
              <th class="py-3 px-4">Kontrak</th>
              <th class="py-3 px-4">Verifikasi</th>
              <th class="py-3 px-4">Status Akun</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="supir in listSupir" :key="supir.id" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-semibold text-white">{{ supir.nama }}</td>
              <td class="py-4 px-4 space-y-0.5">
                <p>{{ supir.telepon }}</p>
                <p class="text-[10px] text-slate-500 font-mono">{{ supir.email }}</p>
              </td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ supir.kendaraan }}</p>
                <p class="text-[10px] text-slate-400 font-mono uppercase">{{ supir.platNomor }}</p>
              </td>
              <td class="py-4 px-4">
                <span class="px-2 py-0.5 rounded bg-warnaAksen/20 text-slate-300 text-[10px] font-semibold">{{ supir.tipe }}</span>
              </td>
              <td class="py-4 px-4">
                <span 
                  class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                  :class="{
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': supir.verifikasi === 'Terverifikasi',
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20': supir.verifikasi === 'Menunggu',
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20': supir.verifikasi === 'Ditolak'
                  }"
                >
                  {{ supir.verifikasi }}
                </span>
              </td>
              <td class="py-4 px-4">
                <button 
                  @click="toggleStatusSupir(supir)"
                  class="px-2.5 py-0.5 rounded-lg border font-bold uppercase text-[9px] cursor-pointer"
                  :class="supir.status === 'Aktif' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'"
                >
                  {{ supir.status }}
                </button>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button 
                  @click="bukaDetail(supir)" 
                  class="text-slate-400 hover:text-white p-1.5 border border-warnaAksen/20 rounded bg-warnaUtama/50 hover:bg-warnaAksen transition-colors cursor-pointer"
                  title="Detail & Verifikasi Dokumen"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>
                
                <button 
                  @click="hapusSupir(supir.id)" 
                  class="text-rose-400 hover:text-rose-300 p-1.5 border border-rose-500/10 rounded bg-rose-500/5 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  title="Hapus Driver"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tambah Supir -->
    <ModalUtama 
      :tampil="modalTambahTampil" 
      judul="Daftarkan Driver Baru" 
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Lengkap Driver (Wajib):</label>
          <input 
            type="text" 
            v-model="formNama" 
            placeholder="E.g. Budi Santoso"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>
        
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Email:</label>
          <input 
            type="email" 
            v-model="formEmail" 
            placeholder="E.g. budi@email.com"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nomor Handphone:</label>
          <input 
            type="tel" 
            v-model="formTelepon" 
            placeholder="E.g. 0821-7788-9900"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Plat Nomor Minibus (Wajib):</label>
          <input 
            type="text" 
            v-model="formPlat" 
            placeholder="E.g. BA 1024 TA"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 uppercase"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Jenis Kendaraan:</label>
          <select 
            v-model="formKendaraan"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option value="Toyota HiAce">Toyota HiAce Minibus</option>
            <option value="Isuzu Elf">Isuzu Elf Long</option>
            <option value="Suzuki Carry">Suzuki Carry Futura</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tipe Kepegawaian:</label>
          <select 
            v-model="formTipe"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option value="Tetap">Tetap (Fulltime)</option>
            <option value="Sementara">Sementara (Freelance)</option>
          </select>
        </div>

        <div class="col-span-2 space-y-2 border-t border-warnaAksen/20 pt-3">
          <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Upload Berkas Pendukung (Simulasi):</h4>
          <div class="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
            <label class="border border-warnaAksen/20 p-3 rounded-lg text-center cursor-pointer hover:border-warnaTombol transition-colors">
              <span>Upload SIM A/B</span>
            </label>
            <label class="border border-warnaAksen/20 p-3 rounded-lg text-center cursor-pointer hover:border-warnaTombol transition-colors">
              <span>Upload STNK</span>
            </label>
            <label class="border border-warnaAksen/20 p-3 rounded-lg text-center cursor-pointer hover:border-warnaTombol transition-colors">
              <span>Upload SKCK</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" @click="tambahSupir">Daftarkan Driver</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Detail & Verifikasi Dokumen -->
    <ModalUtama 
      v-if="supirTerpilih"
      :tampil="modalDetailTampil" 
      :judul="'Audit Berkas: ' + supirTerpilih.nama" 
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-5 text-xs text-slate-300">
        
        <!-- Dokumen Audit Status -->
        <div class="bg-warnaUtama/50 p-4 rounded-xl border border-warnaAksen/20 space-y-3">
          <h4 class="font-bold text-white uppercase text-[10px] tracking-wide border-b border-warnaAksen/25 pb-2">Status Audit Dokumen</h4>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div class="p-2 border border-warnaAksen/20 rounded bg-warnaUtama/30">
              <p class="text-[9px] text-slate-400 uppercase">SIM B-I</p>
              <span class="text-[10px] text-emerald-400 font-bold">AKTIF</span>
            </div>
            <div class="p-2 border border-warnaAksen/20 rounded bg-warnaUtama/30">
              <p class="text-[9px] text-slate-400 uppercase">STNK Pajak</p>
              <span class="text-[10px] text-emerald-400 font-bold">AKTIF</span>
            </div>
            <div class="p-2 border border-warnaAksen/20 rounded bg-warnaUtama/30">
              <p class="text-[9px] text-slate-400 uppercase">SKCK POLRI</p>
              <span class="text-[10px] text-emerald-400 font-bold">TERLAMPIR</span>
            </div>
          </div>
        </div>

        <!-- Ulasan / Pelanggaran History -->
        <div class="bg-warnaUtama/50 p-4 rounded-xl border border-warnaAksen/20 space-y-2">
          <h4 class="font-bold text-white uppercase text-[10px] tracking-wide">Riwayat Komplain / Pelanggaran:</h4>
          <div class="p-3 bg-rose-950/10 border border-rose-500/20 text-rose-300 rounded-lg flex items-start gap-2">
            <ShieldAlert class="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{{ supirTerpilih.riwayatKomplain }}</span>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="font-bold text-white uppercase text-[10px] tracking-wide">Aksi Verifikasi Admin:</h4>
          <p class="text-[11px] text-slate-400">Pilih Setujui jika seluruh dokumen fisik dan kepolisian telah sesuai standar.</p>
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="utama" class="bg-rose-600 hover:bg-rose-500 text-white" @click="verifikasiDokumen('Ditolak')">Tolak Berkas</TombolUtama>
        <TombolUtama varian="utama" class="bg-emerald-600 hover:bg-emerald-500 text-white" @click="verifikasiDokumen('Terverifikasi')">Setujui Berkas</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
