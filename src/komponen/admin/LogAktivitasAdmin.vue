<script setup lang="ts">
import { ref, computed } from 'vue';
import { FileSpreadsheet } from 'lucide-vue-next';
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

// Filter States
const filterPengguna = ref('semua');
const filterAksi = ref('semua');
const filterTanggal = ref('');

// Mock Log Data
const listLogs = ref([
  { waktu: '2026-07-07 07:05:12', pengguna: 'Admin', aksi: 'KIRIM_PENGUMUMAN', detail: 'Mengirim notifikasi pemeliharaan bus ke seluruh supir.' },
  { waktu: '2026-07-07 06:40:02', pengguna: 'Supir Budi', aksi: 'UPDATE_STATUS', detail: 'Mengubah status Aisyah Putri ke Tiba di Sekolah.' },
  { waktu: '2026-07-07 06:15:30', pengguna: 'Supir Budi', aksi: 'UPDATE_STATUS', detail: 'Mengubah status Aisyah Putri ke Naik Bus.' },
  { waktu: '2026-07-06 14:30:15', pengguna: 'Admin', aksi: 'VERIFIKASI_DOKUMEN', detail: 'Menyetujui dokumen SIM B-I milik supir Andi Pratama.' }
]);

const logsTerfilter = computed(() => {
  return listLogs.value.filter(log => {
    const cocokUser = filterPengguna.value === 'semua' || log.pengguna.toLowerCase().includes(filterPengguna.value.toLowerCase());
    const cocokAksi = filterAksi.value === 'semua' || log.aksi === filterAksi.value;
    const cocokTanggal = !filterTanggal.value || log.waktu.startsWith(filterTanggal.value);
    return cocokUser && cocokAksi && cocokTanggal;
  });
});

const eksporLog = () => {
  picuToast('Mengunduh seluruh log aktivitas audit dalam format .CSV...', 'sukses');
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Log Aktivitas & Audit Sistem</h1>
        <p class="text-xs text-slate-400">Tinjau seluruh riwayat eksekusi instruksi dan perubahan status oleh pengguna.</p>
      </div>

      <button 
        @click="eksporLog"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaAksen hover:bg-opacity-95 text-white cursor-pointer border border-warnaAksen"
      >
        <FileSpreadsheet class="w-4 h-4 text-warnaTombol fill-warnaTombol" /> Ekspor Audit Logs
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filter Pengguna:</label>
        <select 
          v-model="filterPengguna"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
        >
          <option value="semua">Semua Pengguna</option>
          <option value="Admin">Admin</option>
          <option value="Supir">Khusus Driver (Supir)</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kategori Tindakan:</label>
        <select 
          v-model="filterAksi"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1"
        >
          <option value="semua">Semua Aksi</option>
          <option value="UPDATE_STATUS">UPDATE STATUS</option>
          <option value="KIRIM_PENGUMUMAN">KIRIM PENGUMUMAN</option>
          <option value="VERIFIKASI_DOKUMEN">VERIFIKASI DOKUMEN</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pilih Tanggal:</label>
        <input 
          type="date" 
          v-model="filterTanggal"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 font-mono"
        />
      </div>
    </div>

    <!-- Log Table -->
    <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-warnaAksen/20 border-b border-warnaAksen/30 text-slate-400 font-bold uppercase tracking-wider text-[10px] py-3">
              <th class="py-3 px-4">Timestamp Waktu</th>
              <th class="py-3 px-4">Pelaku Pengguna</th>
              <th class="py-3 px-4">Jenis Aksi</th>
              <th class="py-3 px-4">Rincian Deskripsi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-warnaAksen/20 text-slate-300 font-mono text-[11px]">
            <tr v-for="(log, idx) in logsTerfilter" :key="idx" class="hover:bg-warnaUtama/20 transition-colors">
              <td class="py-4 px-4 text-slate-400 font-semibold">{{ log.waktu }}</td>
              <td class="py-4 px-4 font-bold text-white">{{ log.pengguna }}</td>
              <td class="py-4 px-4">
                <span class="px-2 py-0.5 rounded bg-warnaAksen/30 text-slate-200 font-bold text-[9px]">{{ log.aksi }}</span>
              </td>
              <td class="py-4 px-4 text-slate-300">{{ log.detail }}</td>
            </tr>
            <tr v-if="logsTerfilter.length === 0">
              <td colspan="4" class="py-8 text-center text-slate-500 italic font-sans text-xs">Tidak ada riwayat log audit ditemukan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
