<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Send } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import type { TugasAnakSupir } from '../../layanan/supirLayanan';
import type { KategoriKendala } from '../../layanan/supirLayanan';

interface Props {
  tampil: boolean;
  anak: TugasAnakSupir | null;
  daftarAnak: TugasAnakSupir[];
  sedangMengirim?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'tutup'): void;
  (e: 'kirim-kendala', data: { perjalananId: string; kategori: KategoriKendala; catatan: string; anakId?: string }): void;
}>();

const kategoriKendala = ref<KategoriKendala>('kendala_perjalanan');
const catatanKendala = ref('');
const anakTerpilihId = ref('');

watch(() => props.tampil, (tampil) => {
  if (tampil) {
    kategoriKendala.value = 'kendala_perjalanan';
    catatanKendala.value = '';
    anakTerpilihId.value = props.anak?.anakId ?? '';
  }
});

// Anak terkait Kendala Anak: default ke anak dari kartu yang dibuka, tapi
// supir bisa memilih anak lain lewat dropdown "Pilih Nama Anak" selama
// masih dalam daftar tugas hari ini (daftarAnak).
const anakKendalaAnak = computed(() => props.daftarAnak.find(a => a.anakId === anakTerpilihId.value) ?? null);

const pesanTujuan = computed(() => {
  if (kategoriKendala.value === 'kendala_anak') {
    return `Laporan kendala ini akan otomatis dikirimkan ke Admin dan Orang Tua ${anakKendalaAnak.value?.nama ?? '-'}.`;
  }
  return 'Laporan kendala ini akan otomatis dikirimkan ke Admin dan seluruh Orang Tua pada rute Anda hari ini.';
});

const kirimLaporan = () => {
  if (!props.anak || !catatanKendala.value.trim()) return;

  if (kategoriKendala.value === 'kendala_anak') {
    const target = anakKendalaAnak.value;
    if (!target) return;
    emit('kirim-kendala', {
      perjalananId: target.perjalananId,
      kategori: kategoriKendala.value,
      catatan: catatanKendala.value.trim(),
      anakId: target.anakId
    });
    return;
  }

  emit('kirim-kendala', {
    perjalananId: props.anak.perjalananId,
    kategori: kategoriKendala.value,
    catatan: catatanKendala.value.trim()
  });
};
</script>

<template>
  <ModalUtama
    tema="terang"
    :tampil="tampil"
    judul="Laporkan Kendala Perjalanan"
    @tutup="emit('tutup')"
  >
    <div class="space-y-4 text-xs text-on-surface-variant">
      <div class="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
        {{ pesanTujuan }}
      </div>

      <div class="space-y-1.5">
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Jenis Kendala:</label>
        <select
          v-model="kategoriKendala"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
        >
          <option value="kendala_perjalanan">Kendala Perjalanan</option>
          <option value="kendala_anak">Kendala Anak</option>
        </select>
      </div>

      <div v-if="kategoriKendala === 'kendala_anak'" class="space-y-1.5">
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Pilih Nama Anak:</label>
        <select
          v-model="anakTerpilihId"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
        >
          <option value="" disabled>Pilih anak...</option>
          <option v-for="a in daftarAnak" :key="a.anakId" :value="a.anakId">{{ a.nama }}</option>
        </select>
      </div>

      <div class="space-y-1.5">
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Deskripsi Kendala (wajib diisi):</label>
        <textarea
          rows="3"
          v-model="catatanKendala"
          placeholder="Tulis detail kronologis kendala..."
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <TombolUtama tema="terang" varian="garis-luar" @click="emit('tutup')">Batal</TombolUtama>
      <TombolUtama
        tema="terang"
        varian="utama"
        class="gap-1.5"
        :nonaktif="!catatanKendala.trim() || sedangMengirim || (kategoriKendala === 'kendala_anak' && !anakTerpilihId)"
        @click="kirimLaporan"
      >
        {{ sedangMengirim ? 'Mengirim...' : 'Kirim Laporan' }}
        <Send class="w-3.5 h-3.5" />
      </TombolUtama>
    </template>
  </ModalUtama>
</template>
