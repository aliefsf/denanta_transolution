<script setup lang="ts">
import { ref, computed } from 'vue';
import { Bell, CheckCheck, Eye, EyeOff, Info, Clock } from 'lucide-vue-next';
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

// State Kategori
const kategoriTerpilih = ref('semua');

// Mock Data Notifikasi
const daftarNotif = ref([
  { id: 'n-1', kategori: 'perjalanan', pesan: 'Aisyah Putri telah naik ke bus sekolah bersama Supir Budi.', waktu: '06:15 WIB', dibaca: false, detail: 'Armada B-102 dikendarai supir Budi meluncur dari Jl. Prof. M. Yamin menuju SD N 01 Padang dengan aman.' },
  { id: 'n-2', kategori: 'pembayaran', pesan: 'Pembayaran langganan bulan Juli jatuh tempo pada tanggal 7.', waktu: '08:00 WIB', dibaca: false, detail: 'Pembayaran dapat diselesaikan instant lewat portal online Midtrans Snap.' },
  { id: 'n-3', kategori: 'sistem', pesan: 'Armada Bus B-102 selesai melewati servis bulanan rutin.', waktu: 'Kemarin', dibaca: true, detail: 'Pemeriksaan ban, rem, dan aki selesai dilakukan di bengkel resmi.' },
  { id: 'n-4', kategori: 'perjalanan', pesan: 'Aisyah Putri telah sampai di sekolah dengan selamat.', waktu: 'Kemarin', dibaca: true, detail: 'Siswa masuk sekolah pada pukul 06:40 WIB.' }
]);

const filteredNotif = computed(() => {
  if (kategoriTerpilih.value === 'semua') return daftarNotif.value;
  return daftarNotif.value.filter(n => n.kategori === kategoriTerpilih.value);
});

const tandaiSemuaDibaca = () => {
  daftarNotif.value.forEach(n => n.dibaca = true);
  picuToast('Semua notifikasi ditandai sebagai dibaca!', 'sukses');
};

const toggleBaca = (id: string) => {
  const item = daftarNotif.value.find(n => n.id === id);
  if (item) {
    item.dibaca = !item.dibaca;
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
        <h1 class="text-xl font-bold text-white uppercase tracking-wider">Kotak Masuk Notifikasi</h1>
        <p class="text-xs text-slate-400">Pemberitahuan aktivitas pelacakan anak, pembayaran, dan informasi sistem.</p>
      </div>
      
      <button 
        @click="tandaiSemuaDibaca"
        class="text-xs font-bold text-warnaTombol hover:underline flex items-center gap-1.5 cursor-pointer bg-warnaSekunder/40 px-3.5 py-2 rounded-xl border border-warnaAksen/20"
      >
        <CheckCheck class="w-4 h-4" />
        Tandai Semua Dibaca
      </button>
    </div>

    <!-- Category Tabs -->
    <div class="flex border-b border-warnaAksen/20 text-xs">
      <button 
        @click="kategoriTerpilih = 'semua'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'semua' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Semua
      </button>
      <button 
        @click="kategoriTerpilih = 'perjalanan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'perjalanan' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Perjalanan
      </button>
      <button 
        @click="kategoriTerpilih = 'pembayaran'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'pembayaran' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Pembayaran
      </button>
      <button 
        @click="kategoriTerpilih = 'sistem'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'sistem' ? 'border-warnaTombol text-white' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Sistem
      </button>
    </div>

    <!-- Notifications List -->
    <div class="space-y-3">
      <div 
        v-for="notif in filteredNotif" 
        :key="notif.id"
        class="p-4 rounded-xl border transition-all flex items-start gap-4 relative overflow-hidden"
        :class="[
          notif.dibaca ? 'bg-warnaSekunder/40 border-warnaAksen/10' : 'bg-warnaSekunder border-warnaAksen/30 shadow-md'
        ]"
      >
        <!-- Unread Blue Dot -->
        <span v-if="!notif.dibaca" class="absolute left-0 top-0 bottom-0 w-1 bg-warnaTombol"></span>

        <!-- Icon Category -->
        <div 
          class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          :class="{
            'bg-warnaTombol/10 text-warnaTombol': notif.kategori === 'perjalanan',
            'bg-amber-500/10 text-amber-400': notif.kategori === 'pembayaran',
            'bg-blue-500/10 text-blue-400': notif.kategori === 'sistem'
          }"
        >
          <Bell v-if="notif.kategori === 'perjalanan'" class="w-4 h-4" />
          <Clock v-else-if="notif.kategori === 'pembayaran'" class="w-4 h-4" />
          <Info v-else class="w-4 h-4" />
        </div>

        <!-- Content -->
        <div class="flex-grow space-y-1.5">
          <div class="flex justify-between items-center text-[10px]">
            <span class="font-bold uppercase tracking-wider text-slate-400">{{ notif.kategori }}</span>
            <span class="text-slate-500 font-mono">{{ notif.waktu }}</span>
          </div>
          <p class="text-xs font-semibold text-white leading-relaxed">{{ notif.pesan }}</p>
          <p class="text-[11px] text-slate-400 leading-relaxed">{{ notif.detail }}</p>
        </div>

        <!-- Action read/unread -->
        <button 
          @click="toggleBaca(notif.id)"
          class="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
          :title="notif.dibaca ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
        >
          <Eye v-if="notif.dibaca" class="w-4 h-4" />
          <EyeOff v-else class="w-4 h-4" />
        </button>
      </div>

      <div v-if="filteredNotif.length === 0" class="text-center py-8 text-slate-500 italic text-xs">
        Tidak ada pemberitahuan di kategori ini.
      </div>
    </div>
  </div>
</template>
