<script setup lang="ts">
import { ref } from 'vue';
import { Download, AlertTriangle, FileText, Send } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';
import TombolUtama from '../umum/TombolUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import BadgeStatusPembayaran from './BadgeStatusPembayaran.vue';
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

// State Invoice
const daftarTagihan = ref([
  { id: 'inv-1', bulan: 'Juli 2026', total: 475000, status: 'lunas', tglBayar: '2026-07-02' },
  { id: 'inv-2', bulan: 'Juni 2026', total: 475000, status: 'lunas', tglBayar: '2026-06-03' },
  { id: 'inv-3', bulan: 'Mei 2026', total: 475000, status: 'lunas', tglBayar: '2026-05-02' }
]);

// State Request Penundaan
const modalPenundaanTampil = ref(false);
const alasanPenundaan = ref('');
const statusPenundaan = ref<'tidak_ada' | 'menunggu' | 'disetujui' | 'ditolak'>('tidak_ada');

const ajukanPenundaan = () => {
  if (!alasanPenundaan.value) {
    picuToast('Alasan penundaan wajib diisi!', 'error');
    return;
  }
  statusPenundaan.value = 'menunggu';
  modalPenundaanTampil.value = false;
  picuToast('Pengajuan penundaan pembayaran berhasil dikirim ke Admin. Status WhatsApp akan dikirimkan segera.', 'sukses');
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Histori & Administrasi Pembayaran</h1>
      <p class="text-xs text-slate-400">Kelola riwayat tagihan bulanan dan pengajuan penangguhan biaya.</p>
    </div>

    <!-- 1. Deadline Alert Banner (tanggal 7 jatuh tempo) -->
    <div class="bg-amber-950/20 border border-amber-500/30 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow text-xs">
      <div class="flex items-start gap-3">
        <AlertTriangle class="w-8 h-8 text-amber-400 flex-shrink-0 mt-0.5" />
        <div class="space-y-1 text-slate-300">
          <h4 class="font-bold text-white text-sm">Pemberitahuan Batas Pembayaran Bulanan</h4>
          <p class="leading-relaxed">
            Pembayaran langganan bulan <strong>Agustus 2026</strong> jatuh tempo pada tanggal <strong>7 Agustus 2026</strong>. Tagihan akan diterbitkan di akhir bulan berjalan. Peringatan jatuh tempo otomatis akan dikirim ke WhatsApp Anda.
          </p>
        </div>
      </div>
      
      <!-- Penundaan Trigger Button -->
      <div v-if="statusPenundaan === 'tidak_ada'" class="w-full md:w-auto">
        <TombolUtama varian="garis-luar" class="w-full text-[11px] py-2" @click="modalPenundaanTampil = true">
          Ajukan Penundaan Pembayaran
        </TombolUtama>
      </div>
    </div>

    <!-- Status Tracking Penundaan if submitted -->
    <div 
      v-if="statusPenundaan !== 'tidak_ada'"
      class="p-4 rounded-xl border flex items-center justify-between text-xs"
      :class="{
        'bg-amber-950/20 border-amber-500/30 text-amber-400': statusPenundaan === 'menunggu',
        'bg-emerald-950/20 border-emerald-500/30 text-emerald-400': statusPenundaan === 'disetujui',
        'bg-rose-950/20 border-rose-500/30 text-rose-400': statusPenundaan === 'ditolak'
      }"
    >
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-current animate-ping"></span>
        <span>
          Status Pengajuan Penundaan: 
          <strong class="uppercase font-mono">{{ statusPenundaan }}</strong>
          <span v-if="statusPenundaan === 'menunggu'"> (Alasan: "{{ alasanPenundaan }}")</span>
          <span v-if="statusPenundaan === 'ditolak'"> (Layanan dinonaktifkan otomatis oleh Admin)</span>
        </span>
      </div>
      <button 
        v-if="statusPenundaan === 'menunggu'"
        @click="statusPenundaan = 'tidak_ada'; alasanPenundaan = '';"
        class="underline font-bold"
      >
        Batalkan
      </button>
    </div>

    <!-- Main Grid: Billing Summary and Past Invoices -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Table of Invoices (2 Columns) -->
      <div class="lg:col-span-2 bg-warnaSekunder border border-warnaAksen/30 rounded-2xl overflow-hidden shadow-lg">
        <div class="p-4 border-b border-warnaAksen/20">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Daftar Faktur (Invoices)</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-warnaAksen/10 border-b border-warnaAksen/20 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Nomor Invoice</th>
                <th class="py-3 px-4">Bulan Layanan</th>
                <th class="py-3 px-4">Jumlah Tagihan</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-warnaAksen/15 text-slate-300">
              <tr v-for="tag in daftarTagihan" :key="tag.id" class="hover:bg-warnaUtama/20 transition-colors">
                <td class="py-4 px-4 font-mono font-bold text-white uppercase">{{ tag.id.replace('inv', 'INV-DNT-2026-000') }}</td>
                <td class="py-4 px-4 font-semibold">{{ tag.bulan }}</td>
                <td class="py-4 px-4 font-mono text-warnaTombol font-extrabold">{{ formatMataUang(tag.total) }}</td>
                <td class="py-4 px-4">
                  <BadgeStatusPembayaran :status="tag.status" />
                </td>
                <td class="py-4 px-4 text-right">
                  <button 
                    @click="picuToast(`Mengunduh invoice digital ${tag.id.toUpperCase()}...`, 'info')"
                    class="text-warnaTombol hover:text-white p-2 border border-warnaAksen/20 rounded-xl hover:bg-warnaAksen/30 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                  >
                    <Download class="w-3.5 h-3.5" /> Unduh PDF
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Billing Overview Box (1 Column) -->
      <div class="space-y-6">
        <KartuUtama judul="Ringkasan Billing Berjalan" subjudul="Bulan Juli 2026">
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Total Anak Terdaftar:</span>
              <span class="text-white font-bold">1 Siswa</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Tarif Dasar Langganan:</span>
              <span class="text-white font-bold">{{ formatMataUang(475000) }}</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Diskon Promosi:</span>
              <span class="text-emerald-400 font-bold">- Rp 0</span>
            </div>
            <div class="flex justify-between pt-2">
              <span class="text-slate-200 font-bold">Total Pembayaran Lunas:</span>
              <span class="text-warnaTombol font-black text-sm">{{ formatMataUang(475000) }}</span>
            </div>

            <div class="flex gap-2 text-[10px] text-slate-500 leading-relaxed bg-warnaUtama/30 p-3 rounded-lg border border-warnaAksen/10 mt-2">
              <FileText class="w-4 h-4 text-warnaTombol flex-shrink-0" />
              <span>
                Faktur resmi diterbitkan otomatis setiap awal bulan, sistem terintegrasi pembayaran digital instant.
              </span>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>

    <!-- Modal Form Penundaan Pembayaran -->
    <ModalUtama 
      :tampil="modalPenundaanTampil" 
      judul="Ajukan Penundaan Pembayaran Langganan" 
      @tutup="modalPenundaanTampil = false"
    >
      <div class="space-y-4 text-xs">
        <p class="text-slate-400 leading-relaxed">
          Silakan ajukan penundaan pembayaran dengan mengisi alasan penundaan yang jelas. Admin akan meninjau dan mengirimkan konfirmasi.
        </p>

        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Alasan Penundaan Pembayaran (Wajib):</label>
          <textarea 
            rows="3" 
            v-model="alasanPenundaan" 
            required
            placeholder="Mohon maaf, gajian bulanan mengalami kemunduran s.d. tanggal 10..."
            class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
          ></textarea>
        </div>
      </div>
      
      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalPenundaanTampil = false">Batal</TombolUtama>
        <TombolUtama varian="utama" class="gap-1.5" @click="ajukanPenundaan">
          Kirim Pengajuan
          <Send class="w-3.5 h-3.5" />
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
