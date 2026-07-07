<script setup lang="ts">
import { ref, computed } from 'vue';
import { Plus, Trash2, Eye, MapPin, Phone } from 'lucide-vue-next';
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

// Mock data Anak
const listAnak = ref([
  {
    id: 'anak-1',
    nama: 'Aisyah Putri',
    ortu: 'Rafi Alief',
    noWaOrtu: '0812-3456-7890',
    sekolah: 'SD N 01 Padang',
    kelas: 'Kelas 4-A',
    layanan: 'Antar Jemput (PP)',
    statusLangganan: 'Aktif',
    alamat: 'Jln. Prof. M. Yamin No. 12, Padang',
    foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces'
  },
  {
    id: 'anak-2',
    nama: 'Dafa Pratama',
    ortu: 'Siti Aminah',
    noWaOrtu: '0813-7766-5544',
    sekolah: 'SMP N 1 Padang',
    kelas: 'Kelas 7-C',
    layanan: 'Jemput Saja',
    statusLangganan: 'Aktif',
    alamat: 'Jln. Khatib Sulaiman No. 45, Padang',
    foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces'
  }
]);

// Filters
const filterSekolah = ref('semua');
const filterStatus = ref('semua');

const anakTerfilter = computed(() => {
  return listAnak.value.filter(a => {
    const cocokSekolah = filterSekolah.value === 'semua' || a.sekolah === filterSekolah.value;
    const cocokStatus = filterStatus.value === 'semua' || a.statusLangganan === filterStatus.value;
    return cocokSekolah && cocokStatus;
  });
});

// Modals State
const modalTambahTampil = ref(false);
const modalDetailTampil = ref(false);
const anakTerpilih = ref<any>(null);

// Form State
const formNama = ref('');
const formOrtu = ref('');
const formWa = ref('');
const formSekolah = ref('SD N 01 Padang');
const formKelas = ref('');
const formLayanan = ref('Antar Jemput (PP)');
const formAlamat = ref('');

const resetForm = () => {
  formNama.value = '';
  formOrtu.value = '';
  formWa.value = '';
  formSekolah.value = 'SD N 01 Padang';
  formKelas.value = '';
  formLayanan.value = 'Antar Jemput (PP)';
  formAlamat.value = '';
};

const tambahAnak = () => {
  if (!formNama.value || !formOrtu.value || !formAlamat.value) {
    picuToast('Mohon lengkapi seluruh data siswa!', 'error');
    return;
  }

  listAnak.value.push({
    id: `anak-${listAnak.value.length + 1}`,
    nama: formNama.value,
    ortu: formOrtu.value,
    noWaOrtu: formWa.value || '08xx-xxxx-xxxx',
    sekolah: formSekolah.value,
    kelas: formKelas.value || 'Kelas 1',
    layanan: formLayanan.value,
    statusLangganan: 'Aktif',
    alamat: formAlamat.value,
    foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces'
  });

  picuToast('Siswa baru berhasil ditambahkan ke database!', 'sukses');
  modalTambahTampil.value = false;
  resetForm();
};

const hapusAnak = (id: string) => {
  listAnak.value = listAnak.value.filter(a => a.id !== id);
  picuToast('Data siswa berhasil dihapus!', 'sukses');
};

const bukaDetail = (anak: any) => {
  anakTerpilih.value = anak;
  modalDetailTampil.value = true;
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Data Siswa Antar Jemput</h1>
        <p class="text-xs text-slate-400">Tinjau profil sekolah anak, kelas, dan status kelayakan langganan.</p>
      </div>

      <TombolUtama varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
        <Plus class="w-4 h-4" /> Tambah Siswa
      </TombolUtama>
    </div>

    <!-- Filters -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Sekolah:</label>
        <select 
          v-model="filterSekolah"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
        >
          <option value="semua">Semua Sekolah</option>
          <option value="SD N 01 Padang">SD N 01 Padang</option>
          <option value="SMP N 1 Padang">SMP N 1 Padang</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Status Langganan:</label>
        <select 
          v-model="filterStatus"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
        >
          <option value="semua">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Tidak Aktif">Tidak Aktif</option>
        </select>
      </div>
    </div>

    <!-- Children Table -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Siswa</th>
              <th class="py-3 px-4">Wali Murid</th>
              <th class="py-3 px-4">Sekolah / Kelas</th>
              <th class="py-3 px-4">Layanan</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="anak in anakTerfilter" :key="anak.id" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-semibold text-white">{{ anak.nama }}</td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ anak.ortu }}</p>
                <p class="text-[10px] text-slate-500 font-mono">{{ anak.noWaOrtu }}</p>
              </td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ anak.sekolah }}</p>
                <p class="text-[10px] text-slate-400">{{ anak.kelas }}</p>
              </td>
              <td class="py-4 px-4">{{ anak.layanan }}</td>
              <td class="py-4 px-4">
                <span 
                  class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                  :class="anak.statusLangganan === 'Aktif' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'"
                >
                  {{ anak.statusLangganan }}
                </span>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button 
                  @click="bukaDetail(anak)" 
                  class="text-slate-400 hover:text-white p-1.5 border border-warnaAksen/20 rounded bg-warnaUtama/50 hover:bg-warnaAksen transition-colors cursor-pointer"
                  title="Detail & Alamat GPS"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>
                <button 
                  @click="hapusAnak(anak.id)" 
                  class="text-rose-400 hover:text-rose-300 p-1.5 border border-rose-500/10 rounded bg-rose-500/5 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  title="Hapus Data Siswa"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tambah Anak -->
    <ModalUtama 
      :tampil="modalTambahTampil" 
      judul="Tambah Data Siswa Baru" 
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Lengkap Siswa (Wajib):</label>
          <input 
            type="text" 
            v-model="formNama" 
            placeholder="E.g. Aisyah Putri"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>
        
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Wali Murid (Wajib):</label>
          <input 
            type="text" 
            v-model="formOrtu" 
            placeholder="E.g. Rafi Alief"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">WhatsApp Wali:</label>
          <input 
            type="tel" 
            v-model="formWa" 
            placeholder="E.g. 0812-3456-7890"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kelas Siswa:</label>
          <input 
            type="text" 
            v-model="formKelas" 
            placeholder="E.g. Kelas 4-A"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Sekolah Tujuan:</label>
          <select 
            v-model="formSekolah"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option value="SD N 01 Padang">SD N 01 Padang</option>
            <option value="SMP N 1 Padang">SMP N 1 Padang</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Jenis Layanan Antar-Jemput:</label>
          <select 
            v-model="formLayanan"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          >
            <option value="Antar Jemput (PP)">Antar Jemput (PP)</option>
            <option value="Antar Saja">Antar Saja (Rumah ke Sekolah)</option>
            <option value="Jemput Saja">Jemput Saja (Sekolah ke Rumah)</option>
          </select>
        </div>

        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Lengkap Domisili (Wajib):</label>
          <textarea 
            rows="3" 
            v-model="formAlamat" 
            placeholder="E.g. Jln. Prof. M. Yamin No. 12, Padang"
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" @click="tambahAnak">Simpan Data Siswa</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Detail Anak -->
    <ModalUtama 
      v-if="anakTerpilih"
      :tampil="modalDetailTampil" 
      :judul="'Profil Audit Siswa: ' + anakTerpilih.nama" 
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-4 text-xs text-slate-300">
        <div class="flex items-center gap-4 bg-warnaUtama/50 p-4 rounded-xl border border-warnaAksen/20">
          <img :src="anakTerpilih.foto" :alt="anakTerpilih.nama" class="w-14 h-14 rounded-xl object-cover border border-warnaAksen/30 flex-shrink-0" />
          <div class="space-y-1">
            <h4 class="text-sm font-bold text-white">{{ anakTerpilih.nama }}</h4>
            <p class="text-slate-400">{{ anakTerpilih.sekolah }} | {{ anakTerpilih.kelas }}</p>
            <span class="inline-block px-2.5 py-0.5 rounded bg-warnaTombol/10 text-warnaTombol border border-warnaTombol/20 uppercase font-mono font-bold text-[9px]">
              {{ anakTerpilih.layanan }}
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400 flex items-center gap-1"><Phone class="w-3.5 h-3.5" /> Wali Murid:</span>
            <span class="text-white font-bold">{{ anakTerpilih.ortu }} ({{ anakTerpilih.noWaOrtu }})</span>
          </div>
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400 flex items-center gap-1"><MapPin class="w-3.5 h-3.5" /> Alamat Domisili:</span>
            <span class="text-white font-medium text-right max-w-xs">{{ anakTerpilih.alamat }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalDetailTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
