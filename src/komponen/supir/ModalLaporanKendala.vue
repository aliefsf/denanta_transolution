<script setup lang="ts">
import { ref } from 'vue';
import { Send } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

interface Props {
  tampil: boolean;
  anak: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'kirim-kendala', data: { idAnak: string; kategori: string; catatan: string }): void;
}>();

const kategoriKendala = ref('macet');
const catatanKendala = ref('');

const kirimLaporan = () => {
  if (kategoriKendala.value === 'lainnya' && !catatanKendala.value) return;
  
  emit('kirim-kendala', {
    idAnak: props.anak?.id || 'all',
    kategori: kategoriKendala.value,
    catatan: catatanKendala.value || `Kendala: ${kategoriKendala.value}`
  });
  
  // Reset
  catatanKendala.value = '';
};
</script>

<template>
  <ModalUtama 
    :tampil="tampil" 
    judul="Laporkan Kendala Perjalanan" 
    @tutup="emit('tutup')"
  >
    <div class="space-y-4 text-xs text-slate-300">
      <div v-if="anak" class="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-300 rounded-xl">
        Laporan kendala ini akan otomatis dikirimkan ke <strong>Admin</strong> dan <strong>Orang Tua {{ anak.nama }}</strong> via WhatsApp terintegrasi.
      </div>
      
      <div class="space-y-1.5">
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Kategori Kendala:</label>
        <select 
          v-model="kategoriKendala"
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs"
        >
          <option value="macet">Kemacetan Lalu Lintas Padat</option>
          <option value="absen_lokasi">Anak Tidak Ada di Lokasi Penjemputan</option>
          <option value="ban_bocor">Gangguan Teknis Armada (Ban Bocor, Mogok)</option>
          <option value="kecelakaan">Darurat / Kecelakaan</option>
          <option value="lainnya">Lainnya (Tulis catatan tambahan)</option>
        </select>
      </div>

      <div class="space-y-1.5">
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Catatan Tambahan:</label>
        <textarea 
          rows="3" 
          v-model="catatanKendala" 
          placeholder="Tulis detail kronologis kendala..."
          class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <TombolUtama varian="garis-luar" @click="emit('tutup')">Batal</TombolUtama>
      <TombolUtama varian="utama" class="gap-1.5" @click="kirimLaporan">
        Kirim Laporan
        <Send class="w-3.5 h-3.5" />
      </TombolUtama>
    </template>
  </ModalUtama>
</template>
