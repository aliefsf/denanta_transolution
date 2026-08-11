<script setup lang="ts">
import { ref, watch } from 'vue';
import { Check, X, Paperclip } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';
import ModalUtama from '../umum/ModalUtama.vue';

interface DeferralRequest {
  id: string;
  nama: string;
  alasan: string;
  buktiUrl?: string | null;
  jumlah: number;
  status: string;
  dibuatPada?: string;
}

interface Props {
  tampil: boolean;
  pengajuan: DeferralRequest | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'proses', status: 'disetujui' | 'ditolak', hariPerpanjangan: number): void;
}>();

// Durasi toleransi yang diberikan admin -- BUKAN lagi angka tetap 7 hari,
// admin memilih sendiri berapa lama masa tenggang diperpanjang per kasus.
// Direset ke default setiap kali modal dibuka utk pengajuan baru.
const hariPerpanjangan = ref(7);
watch(
  () => props.tampil,
  (tampil) => {
    if (tampil) hariPerpanjangan.value = 7;
  }
);
</script>

<template>
  <ModalUtama 
    tema="terang" 
    v-if="pengajuan"
    :tampil="tampil" 
    :judul="'Review Pengajuan Penundaan: ' + pengajuan.nama" 
    @tutup="emit('tutup')"
  >
    <div class="space-y-4 text-xs text-on-surface-variant">
      <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-800 leading-relaxed">
        Menolak pengajuan ini akan otomatis menonaktifkan status langganan siswa bersangkutan pada tanggal jatuh tempo, dan mengirimkan peringatan suspensi via WhatsApp.
      </div>

      <div class="space-y-2.5">
        <div class="flex justify-between border-b border-outline-variant/30 pb-2">
          <span class="text-on-surface-variant font-semibold">Nama Wali Murid:</span>
          <span class="text-on-surface font-bold">{{ pengajuan.nama }}</span>
        </div>
        <div class="flex justify-between border-b border-outline-variant/30 pb-2">
          <span class="text-on-surface-variant font-semibold">Jumlah Tagihan Penangguhan:</span>
          <span class="text-primary font-extrabold font-mono text-sm">{{ formatMataUang(pengajuan.jumlah) }}</span>
        </div>
        <div v-if="pengajuan.dibuatPada" class="flex justify-between border-b border-outline-variant/30 pb-2">
          <span class="text-on-surface-variant font-semibold">Waktu Pengajuan:</span>
          <span class="text-on-surface font-bold font-mono text-[11px]">
            {{ new Date(pengajuan.dibuatPada).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) }}
          </span>
        </div>
        <div class="space-y-1">
          <span class="text-on-surface-variant font-semibold block">Alasan Penundaan Pembayaran:</span>
          <p class="p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-[11px] leading-relaxed italic text-on-surface">
            "{{ pengajuan.alasan }}"
          </p>
        </div>

        <div v-if="pengajuan.buktiUrl" class="space-y-1">
          <span class="text-on-surface-variant font-semibold block">Bukti Lampiran:</span>
          <a
            :href="pengajuan.buktiUrl"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-1.5 p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-[11px] text-primary font-semibold hover:underline w-fit"
          >
            <Paperclip class="w-3.5 h-3.5" /> Lihat File Bukti
          </a>
        </div>

        <div class="space-y-1.5">
          <label class="text-on-surface-variant font-semibold block">Durasi Perpanjangan Masa Tenggang (Hari):</label>
          <input
            type="number"
            min="1"
            v-model.number="hariPerpanjangan"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono"
          />
          <p class="text-[10px] text-on-surface-variant leading-relaxed">
            Tanggal jatuh tempo & masa aktif langganan siswa akan diperpanjang {{ hariPerpanjangan || 0 }} hari dari hari ini begitu disetujui.
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        @click="emit('proses', 'ditolak', 0)"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white cursor-pointer transition-colors"
      >
        <X class="w-4 h-4" /> Tolak Pengajuan
      </button>

      <button
        :disabled="!hariPerpanjangan || hariPerpanjangan < 1"
        @click="emit('proses', 'disetujui', hariPerpanjangan)"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check class="w-4 h-4" /> Setujui Pengajuan
      </button>
    </template>
  </ModalUtama>
</template>
