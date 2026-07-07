<script setup lang="ts">
import { ref } from 'vue';
import { FileDown, CheckCircle } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';
import KartuUtama from '../umum/KartuUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import GrafikKeuangan from './GrafikKeuangan.vue';
import ModalPersetujuan from './ModalPersetujuan.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Mock Financial Records
const pemasukanBulanan = ref(57000000);
const pemasukanHarian = ref(1200000);
const biayaTambahan = ref(380000);

const pengeluaranInsentif = ref(18400000);
const pengeluaranOperasional = ref(3500000);

// Deferral Requests Mock Data
const listPengajuan = ref([
  { id: 'def-1', nama: 'Rafi Alief', alasan: 'Gaji bulanan kantor mengalami keterlambatan hingga tanggal 10.', jumlah: 475000, status: 'Menunggu' },
  { id: 'def-2', nama: 'Siti Aminah', alasan: 'Keperluan medis darurat keluarga di awal bulan.', jumlah: 475000, status: 'Menunggu' }
]);

// Modal State
const modalPersetujuanTampil = ref(false);
const pengajuanTerpilih = ref<any>(null);

const bukaPersetujuan = (req: any) => {
  pengajuanTerpilih.value = req;
  modalPersetujuanTampil.value = true;
};

const prosesPengajuan = (status: 'disetujui' | 'ditolak') => {
  if (pengajuanTerpilih.value) {
    pengajuanTerpilih.value.status = status === 'disetujui' ? 'Disetujui' : 'Ditolak';
    picuToast(
      `Pengajuan penundaan ${pengajuanTerpilih.value.nama} berhasil ${status.toUpperCase()}! Notifikasi WhatsApp otomatis terkirim.`,
      status === 'disetujui' ? 'sukses' : 'error'
    );
    modalPersetujuanTampil.value = false;
  }
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Laporan & Administrasi Keuangan</h1>
        <p class="text-xs text-slate-400">Tinjau mutasi billing langganan dan persetujuan penundaan biaya.</p>
      </div>

      <button 
        @click="picuToast('Mengunduh laporan arus kas keuangan digital...', 'sukses')"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaAksen hover:bg-opacity-95 text-white cursor-pointer border border-warnaAksen"
      >
        <FileDown class="w-4 h-4 text-warnaTombol fill-warnaTombol" /> Ekspor Keuangan
      </button>
    </div>

    <!-- Reconciliation Banner -->
    <div class="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-400 shadow">
      <div class="flex items-center gap-2">
        <CheckCircle class="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <span>Status Rekonsiliasi Otomatis Midtrans: <strong class="uppercase font-mono">Sinkron (Sandbox Snap API)</strong></span>
      </div>
      <span class="text-[10px] text-slate-500">Terakhir cek: 1 menit yang lalu</span>
    </div>

    <!-- Main Grid: Charts & Summary -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left (2 Columns): SVG Financial Graph & Summary -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Grafik Arus Kas Keuangan</h3>
          <GrafikKeuangan />
        </div>

        <!-- Deferral Requests Table -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow">
          <div class="p-4 border-b border-warnaAksen/20">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider">Pengajuan Penundaan Pembayaran</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-warnaAksen/10 border-b border-warnaAksen/20 text-slate-400 font-bold uppercase tracking-wider text-[10px] py-3">
                  <th class="py-3 px-4">Nama Wali</th>
                  <th class="py-3 px-4">Alasan Pengajuan</th>
                  <th class="py-3 px-4">Jumlah Tagihan</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-warnaAksen/15 text-slate-300">
                <tr v-for="req in listPengajuan" :key="req.id" class="hover:bg-warnaUtama/20 transition-colors">
                  <td class="py-4 px-4 font-semibold text-white">{{ req.nama }}</td>
                  <td class="py-4 px-4 max-w-xs truncate" :title="req.alasan">{{ req.alasan }}</td>
                  <td class="py-4 px-4 font-mono font-bold text-warnaTombol">{{ formatMataUang(req.jumlah) }}</td>
                  <td class="py-4 px-4">
                    <span 
                      class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                      :class="{
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20': req.status === 'Menunggu',
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': req.status === 'Disetujui',
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20': req.status === 'Ditolak'
                      }"
                    >
                      {{ req.status }}
                    </span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button 
                      v-if="req.status === 'Menunggu'"
                      @click="bukaPersetujuan(req)"
                      class="text-warnaTombol hover:text-white px-3 py-1.5 border border-warnaAksen/25 rounded-xl hover:bg-warnaAksen transition-all cursor-pointer text-[10px] font-bold"
                    >
                      Review
                    </button>
                    <span v-else class="text-slate-500 text-[10px] italic">Selesai Audit</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right (1 Column): Cashflow breakdown -->
      <div class="space-y-6">
        <KartuUtama judul="Rincian Pos Keuangan" subjudul="Bulan Juli 2026">
          <div class="space-y-4 text-xs">
            <!-- Pemasukan -->
            <div class="space-y-2 border-b border-warnaAksen/10 pb-3">
              <h4 class="font-bold text-emerald-400 uppercase text-[9px] tracking-wider">Pos Pendapatan (Inflow):</h4>
              <div class="flex justify-between text-slate-300">
                <span>Langganan Bulanan:</span>
                <span class="font-mono font-bold">{{ formatMataUang(pemasukanBulanan) }}</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Langganan Harian:</span>
                <span class="font-mono font-bold">{{ formatMataUang(pemasukanHarian) }}</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Biaya Tambahan:</span>
                <span class="font-mono font-bold">{{ formatMataUang(biayaTambahan) }}</span>
              </div>
            </div>

            <!-- Pengeluaran -->
            <div class="space-y-2 pt-1 pb-2">
              <h4 class="font-bold text-rose-400 uppercase text-[9px] tracking-wider">Pos Pengeluaran (Outflow):</h4>
              <div class="flex justify-between text-slate-300">
                <span>Insentif Supir:</span>
                <span class="font-mono font-bold">{{ formatMataUang(pengeluaranInsentif) }}</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Biaya Operasional:</span>
                <span class="font-mono font-bold">{{ formatMataUang(pengeluaranOperasional) }}</span>
              </div>
            </div>

            <!-- Net Profit -->
            <div class="pt-3 border-t border-warnaAksen/20 flex justify-between items-center text-xs">
              <span class="text-white font-bold">Laba Bersih Operasional:</span>
              <span class="text-emerald-400 font-black text-sm font-mono">
                {{ formatMataUang((pemasukanBulanan + pemasukanHarian + biayaTambahan) - (pengeluaranInsentif + pengeluaranOperasional)) }}
              </span>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>

    <!-- Modal Persetujuan Audit Penundaan -->
    <ModalPersetujuan 
      :tampil="modalPersetujuanTampil"
      :pengajuan="pengajuanTerpilih"
      @tutup="modalPersetujuanTampil = false"
      @proses="prosesPengajuan"
    />
  </div>
</template>
