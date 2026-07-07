<script setup lang="ts">
import { Check, X } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';
import ModalUtama from '../umum/ModalUtama.vue';

interface DeferralRequest {
  id: string;
  nama: string;
  alasan: string;
  jumlah: number;
  status: string;
}

interface Props {
  tampil: boolean;
  pengajuan: DeferralRequest | null;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'proses', status: 'disetujui' | 'ditolak'): void;
}>();
</script>

<template>
  <ModalUtama 
    v-if="pengajuan"
    :tampil="tampil" 
    :judul="'Review Pengajuan Penundaan: ' + pengajuan.nama" 
    @tutup="emit('tutup')"
  >
    <div class="space-y-4 text-xs text-slate-300">
      <div class="bg-amber-950/20 border border-amber-500/20 p-3.5 rounded-xl text-slate-300 leading-relaxed">
        Menolak pengajuan ini akan otomatis menonaktifkan status langganan siswa bersangkutan pada tanggal jatuh tempo, dan mengirimkan peringatan suspensi via WhatsApp.
      </div>

      <div class="space-y-2.5">
        <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
          <span class="text-slate-400 font-semibold">Nama Wali Murid:</span>
          <span class="text-white font-bold">{{ pengajuan.nama }}</span>
        </div>
        <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
          <span class="text-slate-400 font-semibold">Jumlah Tagihan Penangguhan:</span>
          <span class="text-warnaTombol font-extrabold font-mono text-sm">{{ formatMataUang(pengajuan.jumlah) }}</span>
        </div>
        <div class="space-y-1">
          <span class="text-slate-400 font-semibold block">Alasan Penundaan Pembayaran:</span>
          <p class="p-3 bg-warnaUtama/50 border border-warnaAksen/20 rounded-lg text-[11px] leading-relaxed italic text-white">
            "{{ pengajuan.alasan }}"
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <button 
        @click="emit('proses', 'ditolak')"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
      >
        <X class="w-4 h-4" /> Tolak Pengajuan
      </button>
      
      <button 
        @click="emit('proses', 'disetujui')"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
      >
        <Check class="w-4 h-4" /> Setujui Pengajuan
      </button>
    </template>
  </ModalUtama>
</template>
