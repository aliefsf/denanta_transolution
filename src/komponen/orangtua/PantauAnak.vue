<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, School, MapPin } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';

const router = useRouter();

const emit = defineEmits<{
  (e: 'buka-detail', anak: any): void;
}>();

// Mock Data Anak
const daftarAnak = ref([
  {
    id: 'anak-1',
    nama: 'Aisyah Putri',
    sekolah: 'SD N 01 Padang',
    kelas: 'Kelas 4-A',
    layanan: 'Antar Jemput (PP)',
    status: 'berangkat', // berangkat, sekolah, pulang, rumah, absen
    namaSupir: 'Pak Budi',
    kontakSupir: '+628123456789',
    alamatJemput: 'Jln. Prof. M. Yamin No. 12, Padang',
    foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces'
  }
]);

const detailAnak = (anak: any) => {
  emit('buka-detail', anak);
};

const navigasiKeDaftarAnak = () => {
  router.push('/berlangganan');
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Pantau Anak</h1>
        <p class="text-xs text-slate-400">Pilih salah satu profil anak Anda untuk memantau detail perjalanan live.</p>
      </div>
      <TombolUtama varian="utama" class="gap-1 text-xs" @click="navigasiKeDaftarAnak">
        <Plus class="w-4 h-4" />
        Tambah Anak
      </TombolUtama>
    </div>

    <!-- Children Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div 
        v-for="anak in daftarAnak" 
        :key="anak.id"
        class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-6"
      >
        <div class="flex items-start gap-4">
          <img :src="anak.foto" :alt="anak.nama" class="w-16 h-16 rounded-2xl object-cover border border-warnaAksen/30" />
          <div class="space-y-1">
            <h3 class="text-lg font-bold text-white">{{ anak.nama }}</h3>
            <p class="text-xs text-slate-400 flex items-center gap-1">
              <School class="w-3.5 h-3.5 text-warnaTombol" /> {{ anak.sekolah }} ({{ anak.kelas }})
            </p>
            <p class="text-xs text-slate-400 flex items-center gap-1">
              <MapPin class="w-3.5 h-3.5 text-warnaTombol" /> {{ anak.alamatJemput }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-warnaAksen/20 pt-4 text-xs">
          <div>
            <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Status Perjalanan</p>
            <div class="mt-1">
              <BadgeStatusAnak :status="anak.status" />
            </div>
          </div>
          <TombolUtama varian="utama" class="text-xs px-5" @click="detailAnak(anak)">
            Detail & Peta Live
          </TombolUtama>
        </div>
      </div>
    </div>
  </div>
</template>
