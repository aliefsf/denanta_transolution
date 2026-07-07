<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { User, Mail, Lock, Phone, MapPin } from 'lucide-vue-next';
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

// State Data Diri
const namaLengkap = ref('Rafi Alief');
const emailVal = ref(authStore.pengguna?.email || 'ortu@email.com');
const noWa = ref('0812-3456-7890');
const alamatDomisili = ref('Jln. Prof. M. Yamin No. 12, Padang Barat, Kota Padang');

const simpanProfil = () => {
  picuToast('Profil berhasil diperbarui!', 'sukses');
};

// State Password
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

// State Pengaturan Notifikasi
const notifPerjalanan = ref(true);
const notifPembayaran = ref(true);
const notifSistem = ref(false);

const simpanSetelanNotif = () => {
  picuToast('Pengaturan notifikasi berhasil disimpan!', 'sukses');
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Profil & Pengaturan Akun</h1>
      <p class="text-xs text-slate-400">Kelola informasi data diri, ubah kata sandi, dan setelan notifikasi WhatsApp.</p>
    </div>

    <!-- Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Profil & Edit Profil Form (2 Columns) -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- 1. Edit Data Diri -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <User class="w-4.5 h-4.5 text-warnaTombol" />
            Informasi Data Diri
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="simpanProfil">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nama Lengkap</label>
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
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Email (Unik)</label>
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
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nomor WhatsApp</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone class="w-4 h-4" />
                  </div>
                  <input 
                    type="tel" 
                    v-model="noWa" 
                    required
                    class="block w-full pl-10 pr-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Alamat Domisili Rumah</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 pt-2.5 pointer-events-none text-slate-500">
                  <MapPin class="w-4 h-4" />
                </div>
                <textarea 
                  rows="3" 
                  v-model="alamatDomisili" 
                  required
                  class="block w-full pl-10 pr-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
                ></textarea>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama varian="utama" tipe="submit">
                Simpan Profil Baru
              </TombolUtama>
            </div>
          </form>
        </div>

        <!-- 2. Ubah Kata Sandi -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
            <Lock class="w-4.5 h-4.5 text-warnaTombol" />
            Ubah Kata Sandi Akun
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

      <!-- Settings / Switches (1 Column) -->
      <div class="space-y-6">
        <KartuUtama judul="Preferensi Notifikasi" subjudul="Kirim pesan langsung ke WhatsApp">
          <div class="space-y-5 text-xs">
            <!-- Travel Category Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-white">Status Perjalanan Anak</h4>
                <p class="text-[10px] text-slate-500 leading-relaxed">Berangkat, tiba sekolah, perjalanan pulang.</p>
              </div>
              <input 
                type="checkbox" 
                v-model="notifPerjalanan"
                class="w-8 h-4 rounded-full accent-warnaTombol bg-warnaUtama cursor-pointer"
              />
            </div>

            <!-- Billing Category Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-white">Administrasi & Tagihan</h4>
                <p class="text-[10px] text-slate-500 leading-relaxed">Invoice bulanan dan pengingat jatuh tempo.</p>
              </div>
              <input 
                type="checkbox" 
                v-model="notifPembayaran"
                class="w-8 h-4 rounded-full accent-warnaTombol bg-warnaUtama cursor-pointer"
              />
            </div>

            <!-- System Category Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-white">Berita & Informasi Sistem</h4>
                <p class="text-[10px] text-slate-500 leading-relaxed">Pemberitahuan gangguan rute/pemeliharaan.</p>
              </div>
              <input 
                type="checkbox" 
                v-model="notifSistem"
                class="w-8 h-4 rounded-full accent-warnaTombol bg-warnaUtama cursor-pointer"
              />
            </div>

            <div class="pt-4 border-t border-warnaAksen/20">
              <TombolUtama varian="utama" class="w-full text-xs" @click="simpanSetelanNotif">
                Simpan Setelan
              </TombolUtama>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>
  </div>
</template>
