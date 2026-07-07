<script setup lang="ts">
import { ref, computed } from 'vue';
import { User, Eye } from 'lucide-vue-next';
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

// Mock User Data (Orang Tua)
const listPengguna = ref([
  { id: 'usr-1', nama: 'Rafi Alief', email: 'ortu@email.com', whatsapp: '0812-3456-7890', jumlahAnak: 1, status: 'Aktif' },
  { id: 'usr-2', nama: 'Siti Aminah', email: 'siti@email.com', whatsapp: '0813-7766-5544', jumlahAnak: 1, status: 'Aktif' },
  { id: 'usr-3', nama: 'Hendra Wijaya', email: 'hendra@email.com', whatsapp: '0852-1122-3344', jumlahAnak: 0, status: 'Tidak Aktif' }
]);

// Filter
const filterStatus = ref('semua');

const penggunaTerfilter = computed(() => {
  return listPengguna.value.filter(u => {
    return filterStatus.value === 'semua' || u.status === filterStatus.value;
  });
});

// Modals State
const modalDetailTampil = ref(false);
const penggunaTerpilih = ref<any>(null);

const bukaDetail = (usr: any) => {
  penggunaTerpilih.value = usr;
  modalDetailTampil.value = true;
};

const toggleStatusPengguna = (usr: any) => {
  usr.status = usr.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
  picuToast(`Status akun wali ${usr.nama} diubah menjadi: ${usr.status.toUpperCase()}`, 'info');
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Kelola Daftar Pengguna (Wali Murid)</h1>
      <p class="text-xs text-slate-400">Tinjau hak akses akun dan status keaktifan berlangganan wali.</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl max-w-sm shadow text-xs">
      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Status Berlangganan:</label>
      <select 
        v-model="filterStatus"
        class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
      >
        <option value="semua">Semua Status</option>
        <option value="Aktif">Aktif Berlangganan</option>
        <option value="Tidak Aktif">Tidak Aktif</option>
      </select>
    </div>

    <!-- Users Table -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px] py-3">
              <th class="py-3 px-4">Nama Lengkap</th>
              <th class="py-3 px-4">Email</th>
              <th class="py-3 px-4">Nomor WhatsApp</th>
              <th class="py-3 px-4">Siswa Didaftarkan</th>
              <th class="py-3 px-4">Status Akun</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300">
            <tr v-for="usr in penggunaTerfilter" :key="usr.id" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 font-semibold text-white">{{ usr.nama }}</td>
              <td class="py-4 px-4 font-mono">{{ usr.email }}</td>
              <td class="py-4 px-4 font-mono">{{ usr.whatsapp }}</td>
              <td class="py-4 px-4 font-bold font-mono">{{ usr.jumlahAnak }} Anak</td>
              <td class="py-4 px-4">
                <button 
                  @click="toggleStatusPengguna(usr)"
                  class="px-2.5 py-0.5 rounded-lg border font-bold uppercase text-[9px] cursor-pointer"
                  :class="usr.status === 'Aktif' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'"
                >
                  {{ usr.status }}
                </button>
              </td>
              <td class="py-4 px-4 text-right">
                <button 
                  @click="bukaDetail(usr)" 
                  class="text-slate-400 hover:text-white p-1.5 border border-warnaAksen/20 rounded bg-warnaUtama/50 hover:bg-warnaAksen transition-colors cursor-pointer"
                  title="Detail Wali"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail User -->
    <ModalUtama 
      v-if="penggunaTerpilih"
      :tampil="modalDetailTampil" 
      :judul="'Profil Wali: ' + penggunaTerpilih.nama" 
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-4 text-xs text-slate-300">
        <div class="flex items-center gap-4 bg-warnaUtama/50 p-4 rounded-xl border border-warnaAksen/20">
          <div class="w-12 h-12 rounded-xl bg-warnaTombol/10 flex items-center justify-center text-warnaTombol flex-shrink-0">
            <User class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <h4 class="text-sm font-bold text-white">{{ penggunaTerpilih.nama }}</h4>
            <p class="text-slate-400 font-mono">{{ penggunaTerpilih.email }}</p>
          </div>
        </div>

        <div class="space-y-2.5 pt-2">
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">WhatsApp Hubungan:</span>
            <span class="text-white font-bold font-mono">{{ penggunaTerpilih.whatsapp }}</span>
          </div>
          <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
            <span class="text-slate-400">Total Anak Terdaftar:</span>
            <span class="text-white font-bold">{{ penggunaTerpilih.jumlahAnak }} Siswa</span>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalDetailTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
