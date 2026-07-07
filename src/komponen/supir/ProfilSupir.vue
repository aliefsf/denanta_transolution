<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { User, Mail, Phone, Lock, FileCheck, Star, Bus, ShieldCheck } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';

const authStore = useAuthStore();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// State Data Pribadi
const namaLengkap = ref('Budi Santoso');
const emailVal = ref(authStore.pengguna?.email || 'supir@email.com');
const noTelepon = ref('0821-7788-9900');

// State Data Kendaraan
const jenisKendaraan = ref('Minibus Toyota HiAce (Warna Kuning)');
const platNomor = ref('BA 1024 TA');
const statusKepegawaian = ref('Tetap'); // Tetap / Sementara (freelance)

// State Verifikasi Dokumen
const statusSim = ref('Terverifikasi (SIM B-I Umum)');
const statusStnk = ref('Terverifikasi (Aktif s.d 2029)');
const statusSkck = ref('Terverifikasi (SKCK Aktif)');

// Mock Ratings
const rataRating = ref(4.9);
const daftarUlasan = ref([
  { pengirim: 'Orang Tua Aisyah', bintang: 5, komentar: 'Sangat ramah, datang tepat waktu dan mengemudi dengan sangat hati-hati.' },
  { pengirim: 'Orang Tua Budi', bintang: 4, komentar: 'Pelayanan bagus, sangat sabar menunggu anak bersiap.' }
]);

const simpanProfil = () => {
  picuToast('Data profil pribadi berhasil diperbarui!', 'sukses');
};

// Password
const sandiLama = ref('');
const sandiBaru = ref('');
const konfirmasiSandi = ref('');

const perbaruiSandi = () => {
  if (!sandiLama.value || !sandiBaru.value || !konfirmasiSandi.value) {
    picuToast('Silakan lengkapi seluruh kolom kata sandi', 'error');
    return;
  }
  if (sandiBaru.value !== konfirmasiSandi.value) {
    picuToast('Kata sandi baru dan konfirmasi kata sandi tidak cocok', 'error');
    return;
  }
  picuToast('Kata sandi Anda berhasil diperbarui!', 'sukses');
  sandiLama.value = '';
  sandiBaru.value = '';
  konfirmasiSandi.value = '';
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Profil & Pengaturan Driver</h1>
      <p class="text-xs text-slate-400">Tinjau kelengkapan dokumen berkendara, plat nomor bus, dan performa rating Anda.</p>
    </div>

    <!-- Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left: Data Diri & Sandi Forms -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- 1. Edit Data Diri -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <User class="w-4.5 h-4.5 text-warnaTombol" />
            Informasi Pribadi & Kontak
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="simpanProfil">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Lengkap Driver</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User class="w-4 h-4" />
                </div>
                <input 
                  type="text" 
                  v-model="namaLengkap" 
                  required
                  class="block w-full pl-10 pr-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Email</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail class="w-4 h-4" />
                  </div>
                  <input 
                    type="email" 
                    v-model="emailVal" 
                    disabled
                    class="block w-full pl-10 pr-3 py-2 bg-warnaUtama/50 border border-warnaAksen/20 rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nomor Handphone</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone class="w-4 h-4" />
                  </div>
                  <input 
                    type="tel" 
                    v-model="noTelepon" 
                    required
                    class="block w-full pl-10 pr-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama varian="utama" tipe="submit">
                Perbarui Profil
              </TombolUtama>
            </div>
          </form>
        </div>

        <!-- 2. Ubah Kata Sandi -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <Lock class="w-4.5 h-4.5 text-warnaTombol" />
            Keamanan & Kata Sandi
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="perbaruiSandi">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kata Sandi Lama</label>
              <input 
                type="password" 
                v-model="sandiLama" 
                required
                placeholder="••••••••"
                class="block w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
              />
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kata Sandi Baru</label>
                <input 
                  type="password" 
                  v-model="sandiBaru" 
                  required
                  placeholder="••••••••"
                  class="block w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                />
              </div>
              
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Konfirmasi Kata Sandi Baru</label>
                <input 
                  type="password" 
                  v-model="konfirmasiSandi" 
                  required
                  placeholder="••••••••"
                  class="block w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                />
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama varian="utama" tipe="submit">
                Ubah Kata Sandi
              </TombolUtama>
            </div>
          </form>
        </div>

      </div>

      <!-- Right: Vehicle, Docs & Ratings -->
      <div class="space-y-6">
        
        <!-- Vehicle info & Kepegawaian -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-xs">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <Bus class="w-4.5 h-4.5 text-warnaTombol" />
            Data Armada & Status Driver
          </h3>

          <div class="space-y-3">
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Jenis Kendaraan:</span>
              <span class="text-white font-bold">{{ jenisKendaraan }}</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Plat Nomor Kendaraan:</span>
              <span class="text-white font-bold font-mono">{{ platNomor }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Status Kepegawaian:</span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase text-[9px]">{{ statusKepegawaian }}</span>
            </div>
          </div>
        </div>

        <!-- Documents Status verification -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-xs">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <FileCheck class="w-4.5 h-4.5 text-warnaTombol" />
            Verifikasi Kelengkapan Dokumen
          </h3>

          <div class="space-y-3">
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Lisensi Mengemudi (SIM):</span>
              <span class="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck class="w-3.5 h-3.5" /> {{ statusSim }}</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Surat Tanda Nomor Kendaraan:</span>
              <span class="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck class="w-3.5 h-3.5" /> {{ statusStnk }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Dokumen Kepolisian (SKCK):</span>
              <span class="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck class="w-3.5 h-3.5" /> {{ statusSkck }}</span>
            </div>
          </div>
        </div>

        <!-- Ratings & Reviews -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow text-xs">
          <div class="flex justify-between items-center border-b border-warnaAksen/20 pb-3">
            <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Star class="w-4.5 h-4.5 text-warnaTombol fill-warnaTombol" />
              Nilai Kepuasan Wali
            </h3>
            <span class="text-white font-extrabold font-mono text-sm bg-warnaUtama px-2 py-0.5 rounded border border-warnaAksen/25">{{ rataRating }} / 5.0</span>
          </div>

          <div class="space-y-3">
            <div 
              v-for="(ul, idx) in daftarUlasan" 
              :key="idx"
              class="border-b border-warnaAksen/10 pb-2 last:border-b-0 space-y-1"
            >
              <div class="flex justify-between items-center text-[10px]">
                <span class="text-slate-400 font-bold">{{ ul.pengirim }}</span>
                <span class="text-amber-400 flex items-center gap-0.5">
                  <Star class="w-3 h-3 fill-current" v-for="b in ul.bintang" :key="b" />
                </span>
              </div>
              <p class="text-[11px] text-slate-300 italic leading-relaxed">"{{ ul.komentar }}"</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
