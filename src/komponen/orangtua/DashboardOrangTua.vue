<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { formatMataUang } from '../../bantuan/formatMataUang';
import { 
  Users, Calendar, CreditCard, Clock, 
  ChevronRight, Phone 
} from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';

const authStore = useAuthStore();

const emit = defineEmits<{
  (e: 'buka-detail', anak: any): void;
  (e: 'ubah-tab', tab: string): void;
}>();

// Mock Data Anak Terdaftar
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

// Mock Notifikasi Terbaru
const notifikasi = ref([
  { id: 'notif-1', kategori: 'perjalanan', pesan: 'Aisyah Putri telah naik ke bus sekolah bersama Supir Budi.', waktu: '15 menit yang lalu' },
  { id: 'notif-2', kategori: 'pembayaran', pesan: 'Pembayaran langganan bulan Juli jatuh tempo pada tanggal 7.', waktu: '1 jam yang lalu' },
  { id: 'notif-3', kategori: 'sistem', pesan: 'Armada Bus B-102 selesai melewati servis bulanan rutin.', waktu: '1 hari yang lalu' }
]);

const sisaHariLangganan = ref(25);
const totalTagihan = ref(475000);

const lihatLokasiLangsung = (anak: any) => {
  emit('buka-detail', anak);
};
</script>

<template>
  <div class="space-y-6">
    <!-- Welcome Greeting Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-white tracking-tight">Halo, {{ authStore.pengguna?.email?.split('@')[0] || 'Orang Tua' }}!</h1>
        <p class="text-xs text-slate-400">Selamat datang kembali di panel monitoring Denanta TranSolution.</p>
      </div>
      <div 
        v-if="sisaHariLangganan <= 5"
        class="bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2"
      >
        <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        <span>Langganan Anda segera berakhir dalam <strong>{{ sisaHariLangganan }} hari</strong>.</span>
      </div>
    </div>

    <!-- Summary Widgets Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. Status Anak -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Status Anak</span>
          <Clock class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-lg font-bold text-white leading-tight">
          {{ daftarAnak[0].status === 'berangkat' ? 'Perjalanan Pergi' : 'Di Sekolah' }}
        </p>
        <div class="pt-1">
          <BadgeStatusAnak :status="daftarAnak[0].status" />
        </div>
      </div>

      <!-- 2. Sisa Hari -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Sisa Langganan</span>
          <Calendar class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white tracking-wide">
          {{ sisaHariLangganan }}
          <span class="text-xs font-normal text-slate-400">hari lagi</span>
        </p>
        <p class="text-[10px] text-slate-500">Masa aktif s.d. akhir bulan berjalan</p>
      </div>

      <!-- 3. Tagihan -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Tagihan Bulan Ini</span>
          <CreditCard class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-2xl font-black text-white tracking-wide">
          {{ formatMataUang(totalTagihan) }}
        </p>
        <p class="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">LUNAS - Pembayaran Terverifikasi</p>
      </div>

      <!-- 4. Anak Terdaftar -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-4 space-y-2 shadow">
        <div class="flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>Anak Terdaftar</span>
          <Users class="w-4 h-4 text-warnaTombol" />
        </div>
        <p class="text-3xl font-black text-white tracking-wide">
          {{ daftarAnak.length }}
          <span class="text-xs font-normal text-slate-400">anak</span>
        </p>
        <p class="text-[10px] text-slate-500">Terdaftar di SD N 01 Padang</p>
      </div>
    </div>

    <!-- Main Content Area Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left: Children Status Cards & Shortcut -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Live Action Shortcut -->
        <div 
          v-if="daftarAnak[0].status === 'berangkat' || daftarAnak[0].status === 'pulang'"
          class="bg-gradient-to-r from-warnaAksen/40 to-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl flex items-center justify-between shadow"
        >
          <div class="space-y-1">
            <span class="w-fit inline-flex items-center gap-1 bg-warnaTombol/10 text-warnaTombol border border-warnaTombol/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Dalam Perjalanan
            </span>
            <h3 class="text-sm font-bold text-white">Lacak Posisi Anak Anda Secara Real-time</h3>
            <p class="text-xs text-slate-400">Siswa Aisyah Putri sedang dalam perjalanan bersama driver Budi.</p>
          </div>
          <TombolUtama varian="utama" class="gap-1 text-xs" @click="lihatLokasiLangsung(daftarAnak[0])">
            Lacak Posisi
            <ChevronRight class="w-4 h-4" />
          </TombolUtama>
        </div>

        <!-- Status Detail Anak Sekolah -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Status Anak Terdaftar</h3>
          
          <div 
            v-for="anak in daftarAnak" 
            :key="anak.id"
            class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow"
          >
            <div class="flex items-center gap-4">
              <img :src="anak.foto" :alt="anak.nama" class="w-12 h-12 rounded-xl object-cover border border-warnaAksen/30" />
              <div class="flex-grow">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-base font-bold text-white">{{ anak.nama }}</h4>
                  <BadgeStatusAnak :status="anak.status" />
                </div>
                <p class="text-xs text-slate-400 mt-0.5">{{ anak.sekolah }} | {{ anak.kelas }}</p>
              </div>
            </div>

            <!-- Driver Info and Map Shortcut -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-warnaAksen/20 text-xs">
              <div class="space-y-1.5 text-slate-300">
                <p class="text-slate-400">Driver Pendamping:</p>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-white">{{ anak.namaSupir }}</span>
                  <a :href="'tel:' + anak.kontakSupir" class="text-warnaTombol hover:underline flex items-center gap-0.5">
                    <Phone class="w-3.5 h-3.5" /> Hubungi
                  </a>
                </div>
              </div>

              <div class="flex items-center md:justify-end gap-2">
                <TombolUtama varian="garis-luar" class="text-xs py-2 w-full md:w-auto" @click="emit('ubah-tab', 'jadwal')">
                  Absen Harian
                </TombolUtama>
                <TombolUtama varian="utama" class="text-xs py-2 w-full md:w-auto" @click="emit('buka-detail', anak)">
                  Detail Pelacakan
                </TombolUtama>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Recent Alerts & Notifications -->
      <div class="space-y-6">
        <KartuUtama judul="Pemberitahuan Terbaru" subjudul="Aktivitas perjalanan dan administrasi terpadu">
          <div class="space-y-4">
            <div 
              v-for="notif in notifikasi" 
              :key="notif.id"
              class="border-b border-warnaAksen/10 pb-3 last:border-b-0 space-y-1"
            >
              <div class="flex justify-between items-center text-[10px]">
                <span 
                  class="font-bold uppercase tracking-wider"
                  :class="{
                    'text-warnaTombol': notif.kategori === 'perjalanan',
                    'text-amber-400': notif.kategori === 'pembayaran',
                    'text-blue-400': notif.kategori === 'sistem'
                  }"
                >
                  {{ notif.kategori }}
                </span>
                <span class="text-slate-500 font-mono">{{ notif.waktu }}</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">{{ notif.pesan }}</p>
            </div>
            
            <div class="pt-2 text-center">
              <button 
                @click="emit('ubah-tab', 'notifikasi')"
                class="text-xs font-bold text-warnaTombol hover:underline"
              >
                Lihat Seluruh Notifikasi
              </button>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>
  </div>
</template>
