<script setup lang="ts">
import { ref } from 'vue';
import { Users, Car, Map, Settings, Trash2, Edit } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';

const statistik = [
  { nama: 'Total Orang Tua', jumlah: 124, ikon: Users, warna: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { nama: 'Total Supir', jumlah: 18, ikon: Car, warna: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { nama: 'Total Rute Aktif', jumlah: 12, ikon: Map, warna: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
];

const daftarSupir = ref([
  { id: 1, nama: 'Budi Santoso', plat: 'B 1234 DTS', rute: 'Depok - Jaksel', status: 'Aktif' },
  { id: 2, nama: 'Joko Widodo', plat: 'B 5678 DTS', rute: 'Depok - Jaktim', status: 'Nonaktif' },
  { id: 3, nama: 'Roni Setiawan', plat: 'B 9101 DTS', rute: 'Margonda - UI', status: 'Aktif' }
]);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-wide">Portal Admin</h2>
        <p class="text-slate-400 text-xs mt-0.5">Kelola akun supir, orang tua, rute, dan tarif secara komprehensif.</p>
      </div>
      <TombolUtama varian="utama" ukuran="kecil" class="gap-1.5">
        <Settings class="w-4 h-4" />
        Pengaturan Sistem
      </TombolUtama>
    </div>

    <!-- Statistik Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-for="stat in statistik"
        :key="stat.nama"
        class="bg-warnaSekunder border border-warnaAksen/30 rounded-xl p-5 flex items-center gap-4 transition-all duration-200 hover:border-warnaAksen/50"
      >
        <div class="p-3 rounded-lg border" :class="stat.warna">
          <component :is="stat.ikon" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-xs text-slate-400">{{ stat.nama }}</p>
          <p class="text-2xl font-black text-white mt-1">{{ stat.jumlah }}</p>
        </div>
      </div>
    </div>

    <!-- Tables & Details -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left side: Table of Drivers -->
      <div class="lg:col-span-2">
        <KartuUtama judul="Manajemen Driver/Supir" subjudul="Pengelolaan status penugasan armada dan rute">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="border-b border-warnaAksen/30 text-slate-400 font-medium">
                  <th class="py-3 px-4">Nama</th>
                  <th class="py-3 px-4">Plat Nomor</th>
                  <th class="py-3 px-4">Rute Penugasan</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-warnaAksen/20">
                <tr
                  v-for="supir in daftarSupir"
                  :key="supir.id"
                  class="text-slate-300 hover:bg-warnaUtama/30 transition-colors"
                >
                  <td class="py-3 px-4 font-bold text-white">{{ supir.nama }}</td>
                  <td class="py-3 px-4 font-mono">{{ supir.plat }}</td>
                  <td class="py-3 px-4">{{ supir.rute }}</td>
                  <td class="py-3 px-4 text-center">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-semibold inline-block"
                      :class="supir.status === 'Aktif' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'"
                    >
                      {{ supir.status }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex justify-end gap-1.5">
                      <button class="p-1 hover:text-white transition-colors cursor-pointer" title="Edit">
                        <Edit class="w-4 h-4" />
                      </button>
                      <button class="p-1 hover:text-red-500 transition-colors cursor-pointer" title="Hapus">
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <template #footer>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400">Menampilkan 3 dari 18 Driver</span>
              <TombolUtama varian="aksen" ukuran="kecil">
                Tambah Supir Baru
              </TombolUtama>
            </div>
          </template>
        </KartuUtama>
      </div>

      <!-- Right side: Notifications/Quick config -->
      <div class="space-y-6">
        <KartuUtama judul="Portal Konfigurasi API" subjudul="Pastikan token dan kredensial valid">
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Supabase Client</label>
              <div class="flex items-center justify-between p-2 bg-warnaUtama/50 border border-warnaAksen/30 rounded-lg text-xs">
                <span class="text-slate-300 font-mono">SUPABASE_URL</span>
                <span class="text-emerald-400 font-bold">Terhubung</span>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gateway Midtrans</label>
              <div class="flex items-center justify-between p-2 bg-warnaUtama/50 border border-warnaAksen/30 rounded-lg text-xs">
                <span class="text-slate-300 font-mono">MIDTRANS_SANDBOX</span>
                <span class="text-emerald-400 font-bold">Terhubung</span>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider block">WhatsApp API</label>
              <div class="flex items-center justify-between p-2 bg-warnaUtama/50 border border-warnaAksen/30 rounded-lg text-xs">
                <span class="text-slate-300 font-mono">WHATSAPP_API</span>
                <span class="text-emerald-400 font-bold">Terhubung</span>
              </div>
            </div>
          </div>
        </KartuUtama>

        <KartuUtama judul="Aktifitas Sistem Terkini">
          <div class="space-y-3 text-xs text-slate-400">
            <div class="flex gap-2">
              <span class="text-warnaTombol font-bold">[18:25]</span>
              <p><strong class="text-slate-300">Driver Budi</strong> memperbarui status koordinat GPS (Rute Depok).</p>
            </div>
            <div class="flex gap-2">
              <span class="text-warnaTombol font-bold">[18:20]</span>
              <p><strong class="text-slate-300">Siswa Rafi</strong> berhasil dikonfirmasi jemput oleh Driver.</p>
            </div>
            <div class="flex gap-2">
              <span class="text-warnaTombol font-bold">[18:12]</span>
              <p><strong class="text-slate-300">Orang Tua</strong> melunasi tagihan bulan Juli senilai Rp 450.000.</p>
            </div>
          </div>
        </KartuUtama>
      </div>
    </div>
  </div>
</template>
