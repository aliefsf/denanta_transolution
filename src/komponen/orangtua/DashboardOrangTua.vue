<script setup lang="ts">
import { ref } from 'vue';
import { User, MapPin, Navigation, DollarSign, Bell } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

const anakList = ref([
  { id: 1, nama: 'Rafi Alief', status: 'Dalam Perjalanan', supir: 'Pak Budi', armada: 'Avanza B 1234 DTS' },
  { id: 2, nama: 'Aisyah Putri', status: 'Tiba di Sekolah', supir: 'Pak Budi', armada: 'Avanza B 1234 DTS' }
]);

const riwayatTagihan = ref([
  { bulan: 'Juli 2026', total: 450000, status: 'Lunas' },
  { bulan: 'Juni 2026', total: 450000, status: 'Lunas' }
]);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-wide">Dashboard Orang Tua</h2>
        <p class="text-slate-400 text-xs mt-0.5">Pantau keselamatan dan pembayaran antar-jemput anak Anda.</p>
      </div>
      <TombolUtama varian="aksen" ukuran="kecil" class="gap-1">
        <Bell class="w-4 h-4" />
        Notifikasi
      </TombolUtama>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Children & Map -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Status Anak -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KartuUtama
            v-for="anak in anakList"
            :key="anak.id"
            :judul="anak.nama"
            :subjudul="`Armada: ${anak.armada}`"
          >
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-400">Status Perjalanan:</span>
                <span
                  class="px-2 py-0.5 rounded text-xs font-semibold"
                  :class="anak.status === 'Dalam Perjalanan' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30' : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'"
                >
                  {{ anak.status }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-sm text-slate-300">
                <User class="w-4 h-4 text-warnaTombol" />
                <span>Supir: <strong class="text-white">{{ anak.supir }}</strong></span>
              </div>
            </div>
            <template #footer>
              <div class="flex justify-end gap-2">
                <TombolUtama varian="garis-luar" ukuran="kecil" class="gap-1">
                  <MapPin class="w-3.5 h-3.5" />
                  Hubungi Supir
                </TombolUtama>
              </div>
            </template>
          </KartuUtama>
        </div>

        <!-- Live Map Preview Mock -->
        <KartuUtama judul="Peta Pelacakan Live (Simulasi)" subjudul="Rute perjalanan armada Avanza B 1234 DTS">
          <div class="w-full h-80 bg-warnaUtama border border-warnaAksen/30 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
            <!-- Grid lines to make it look like a map -->
            <div class="absolute inset-0 bg-[linear-gradient(to_right,#0f3460_1px,transparent_1px),linear-gradient(to_bottom,#0f3460_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>
            
            <div class="z-10 text-center space-y-3 p-4">
              <div class="animate-bounce inline-flex items-center justify-center p-3 bg-warnaTombol rounded-full shadow-lg shadow-warnaTombol/40">
                <Navigation class="w-6 h-6 text-white rotate-45" />
              </div>
              <p class="text-white text-sm font-semibold">Simulasi Posisi Armada</p>
              <p class="text-slate-400 text-xs max-w-sm">Peta Leaflet interaktif akan diinisialisasi menggunakan data kordinat riil dari Supir.</p>
            </div>
            <div class="absolute bottom-4 left-4 right-4 bg-warnaSekunder/90 border border-warnaAksen/40 p-3 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p class="text-white font-bold">Posisi Saat Ini:</p>
                <p class="text-slate-300">Jalan Raya Margonda, Depok (Speed: 45 km/h)</p>
              </div>
              <span class="text-warnaTombol font-extrabold animate-pulse">● LIVE</span>
            </div>
          </div>
        </KartuUtama>
      </div>

      <!-- Right: Payments & Billing -->
      <div class="space-y-6">
        <KartuUtama judul="Manajemen Pembayaran" subjudul="Integrasi Midtrans untuk tagihan sekolah harian">
          <div class="space-y-6">
            <div class="p-4 bg-warnaUtama/50 border border-warnaAksen/20 rounded-lg text-center space-y-2">
              <p class="text-slate-400 text-xs">Tagihan Bulan Ini (Juli 2026)</p>
              <p class="text-3xl font-extrabold text-white">Rp 450.000</p>
              <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sudah Dilunasi
              </span>
            </div>

            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Riwayat Transaksi</h4>
              <div
                v-for="tagihan in riwayatTagihan"
                :key="tagihan.bulan"
                class="flex items-center justify-between text-sm py-2 border-b border-warnaAksen/20"
              >
                <div class="flex items-center gap-2">
                  <DollarSign class="w-4 h-4 text-emerald-400" />
                  <div>
                    <p class="text-white font-medium">{{ tagihan.bulan }}</p>
                    <p class="text-slate-400 text-xs">Rp {{ tagihan.total.toLocaleString('id-ID') }}</p>
                  </div>
                </div>
                <span class="text-emerald-400 text-xs font-semibold">{{ tagihan.status }}</span>
              </div>
            </div>

            <TombolUtama varian="utama" class="w-full">
              Bayar Tagihan Baru
            </TombolUtama>
          </div>
        </KartuUtama>

        <KartuUtama judul="Informasi Kontak Supir">
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-warnaAksen flex items-center justify-center text-white font-extrabold">
                B
              </div>
              <div>
                <p class="text-white font-bold text-sm">Pak Budi Santoso</p>
                <p class="text-slate-400 text-xs">Rute Depok - Jakarta Selatan</p>
              </div>
            </div>
            <p class="text-slate-400 text-xs leading-relaxed">
              Silakan hubungi supir secara berkala jika ada keterlambatan penjemputan anak secara mendadak.
            </p>
            <div class="grid grid-cols-2 gap-2">
              <TombolUtama varian="garis-luar" ukuran="kecil">
                WhatsApp
              </TombolUtama>
              <TombolUtama varian="garis-luar" ukuran="kecil">
                Telepon
              </TombolUtama>
            </div>
          </div>
        </KartuUtama>
      </div>
    </div>
  </div>
</template>
