<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../penyimpanan/authStore';
import TataLetakTamu from './tataletak/TataLetakTamu.vue';
import KartuUtama from '../komponen/umum/KartuUtama.vue';
import TombolUtama from '../komponen/umum/TombolUtama.vue';
import ModalUtama from '../komponen/umum/ModalUtama.vue';
import PemilihPeta from '../komponen/umum/PemilihPeta.vue';
import NotifikasiUtama from '../komponen/umum/NotifikasiUtama.vue';
import { formatMataUang } from '../bantuan/formatMataUang';
import { 
  CheckCircle, ArrowRight, 
  MapPin, CreditCard, Mail, KeyRound 
} from 'lucide-vue-next';
const authStore = useAuthStore();

// Wizard Step Tracker (0 to 3)
const langkahAktif = ref(authStore.sudahLogin ? 1 : 0);

// Notifikasi Toast
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// ==========================================
// DATA STATE FORMULIR WIZARD
// ==========================================

// Langkah 0: Otentikasi & OTP
const modeLogin = ref(false);
const authEmail = ref('');
const authSandi = ref('');
const otpSandi = ref('');
const otpTerkirim = ref(false);
const otpTerverifikasi = ref(false);

// Langkah 1: Profil Orang Tua
const namaOrangTua = ref(authStore.pengguna?.user_metadata?.nama_lengkap || authStore.pengguna?.nama_lengkap || '');
const emailOrangTua = ref(authStore.pengguna?.email || '');
const waOrangTua = ref(authStore.pengguna?.user_metadata?.nomor_telepon || authStore.pengguna?.nomor_telepon || '');
const alamatDomisili = ref('');
const kontakDarurat = ref('');

// Langkah 2: Profil Anak (Bisa multiple)
interface DataAnak {
  nama: string;
  sekolah: string;
  kelas: string;
  hariSekolah: number;
  layanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  golonganDarah?: string;
  alergi?: string;
}

const listAnak = ref<DataAnak[]>([]);

// Form anak yang sedang diedit
const formNamaAnak = ref('');
const formSekolah = ref('SD N 01 Padang');
const formKelas = ref('Kelas 1');
const formHariSekolah = ref(5);
const formLayanan = ref<'antar_jemput' | 'antar_saja' | 'jemput_saja'>('antar_jemput');
const formAlamatJemput = ref('');
const formLintang = ref(-0.9471);
const formBujur = ref(100.4172);
const formDarah = ref('O');
const formAlergi = ref('');

const modalRingkasanTampil = ref(false);

// Database Mock untuk dropdown
const daftarSekolah = ['SD N 01 Padang', 'SMP N 1 Padang', 'SMA N 2 Padang', 'SD Islam Al-Azhar Padang'];
const daftarKelas = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6', 'Kelas 7', 'Kelas 8', 'Kelas 9', 'Kelas 10', 'Kelas 11', 'Kelas 12'];

// Langkah 3: Midtrans & Checkout
const snapTampil = ref(false);
const pembayaranLunas = ref(false);
const virtualAccountBank = ref('bni');
const noVirtualAccount = ref('8802938172938472');

// ==========================================
// LOGIC HANDLERS
// ==========================================

// Peta handler
const tanganiLokasiPeta = (data: { lintang: number; bujur: number; alamat: string }) => {
  formLintang.value = data.lintang;
  formBujur.value = data.bujur;
  formAlamatJemput.value = data.alamat;
};

// Langkah 0: Registrasi / Login & OTP Mockup
const tanganiDaftarLoginMock = () => {
  if (!authEmail.value || !authSandi.value) {
    picuToast('Silakan lengkapi email dan kata sandi', 'error');
    return;
  }
  
  if (modeLogin.value) {
    // Simulasi login sukses
    picuToast('Login Berhasil!', 'sukses');
    emailOrangTua.value = authEmail.value;
    // Set mock user di store
    authStore.pengguna = { email: authEmail.value, id: 'usr-mock' };
    authStore.sudahLogin = true;
    authStore.peran = 'orangtua';
    langkahAktif.value = 1;
  } else {
    // Registrasi mengirim OTP
    otpTerkirim.value = true;
    picuToast('Kode OTP verifikasi email dikirim ke email Anda!', 'sukses');
  }
};

const verifikasiOtpMock = () => {
  if (otpSandi.value === '1234' || otpSandi.value.length === 4) {
    otpTerverifikasi.value = true;
    emailOrangTua.value = authEmail.value;
    authStore.pengguna = { email: authEmail.value, id: 'usr-mock' };
    authStore.sudahLogin = true;
    authStore.peran = 'orangtua';
    picuToast('Verifikasi OTP Berhasil!', 'sukses');
    langkahAktif.value = 1;
  } else {
    picuToast('Kode OTP salah! Coba gunakan kode "1234"', 'error');
  }
};

// Langkah 1: Simpan Profil Orang Tua
const simpanProfilOrangTua = () => {
  if (!namaOrangTua.value || !waOrangTua.value || !alamatDomisili.value) {
    picuToast('Silakan lengkapi data profil wajib (Nama, WA, Alamat)', 'error');
    return;
  }
  picuToast('Data profil orang tua berhasil disimpan!', 'sukses');
  langkahAktif.value = 2;
};

// Langkah 2: Tambah Anak Ke List
const tambahAnakKeList = () => {
  if (!formNamaAnak.value || !formAlamatJemput.value) {
    picuToast('Nama anak dan alamat jemput wajib diisi', 'error');
    return;
  }

  listAnak.value.push({
    nama: formNamaAnak.value,
    sekolah: formSekolah.value,
    kelas: formKelas.value,
    hariSekolah: formHariSekolah.value,
    layanan: formLayanan.value,
    alamatJemput: formAlamatJemput.value,
    lintangJemput: formLintang.value,
    bujurJemput: formBujur.value,
    golonganDarah: formDarah.value,
    alergi: formAlergi.value
  });

  // Reset form anak
  formNamaAnak.value = '';
  formAlergi.value = '';
  picuToast('Satu data anak berhasil ditambahkan!', 'sukses');
};

const selesaikanLangkahAnak = () => {
  if (listAnak.value.length === 0) {
    // Jika user lupa klik "tambah", tapi form diisi, tambahkan otomatis
    if (formNamaAnak.value) {
      tambahAnakKeList();
    } else {
      picuToast('Silakan tambahkan minimal satu data anak sekolah', 'error');
      return;
    }
  }
  // Buka popup validasi ringkasan
  modalRingkasanTampil.value = true;
};

const konfirmasiLanjutLangkah3 = () => {
  modalRingkasanTampil.value = false;
  langkahAktif.value = 3;
};

// Langkah 3: Bayar snap midtrans simulator
const bayarSnapMidtrans = () => {
  snapTampil.value = true;
};

const selesaikanPembayaranMock = () => {
  snapTampil.value = false;
  pembayaranLunas.value = true;
  authStore.setSudahBerlangganan(true);
  picuToast('Pembayaran berhasil dilunasi via Midtrans Snap!', 'sukses');
};

// Hitung total harga
const hitungBiayaPerAnak = (layanan: string, hari: number) => {
  let tarifHarian = 15000;
  if (layanan === 'antar_jemput') {
    tarifHarian = 25000;
  }
  return tarifHarian * (hari * 4);
};

const totalTagihan = computed(() => {
  return listAnak.value.reduce((sum, anak) => sum + hitungBiayaPerAnak(anak.layanan, anak.hariSekolah), 0);
});
</script>

<template>
  <TataLetakTamu>
    <!-- Toast Alert -->
    <NotifikasiUtama 
      :tampil="toastTampil" 
      :pesan="toastPesan" 
      :tipe="toastTipe" 
      @tutup="toastTampil = false" 
    />

    <div class="max-w-4xl mx-auto px-4 py-12 text-slate-100 space-y-8">
      
      <!-- Wizard Progress Bar -->
      <div class="bg-warnaSekunder border border-warnaAksen/30 rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div class="flex items-center w-full justify-around text-center text-xs md:text-sm">
          <div class="flex flex-col items-center gap-1">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold" :class="langkahAktif >= 0 ? 'bg-warnaTombol text-white' : 'bg-warnaUtama text-slate-500 border border-warnaAksen/20'">0</span>
            <span class="text-[10px] md:text-xs" :class="langkahAktif >= 0 ? 'text-white font-semibold' : 'text-slate-500'">Autentikasi</span>
          </div>
          <div class="h-0.5 bg-warnaAksen/40 flex-grow max-w-[50px] md:max-w-[100px]"></div>
          <div class="flex flex-col items-center gap-1">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold" :class="langkahAktif >= 1 ? 'bg-warnaTombol text-white' : 'bg-warnaUtama text-slate-500 border border-warnaAksen/20'">1</span>
            <span class="text-[10px] md:text-xs" :class="langkahAktif >= 1 ? 'text-white font-semibold' : 'text-slate-500'">Data Wali</span>
          </div>
          <div class="h-0.5 bg-warnaAksen/40 flex-grow max-w-[50px] md:max-w-[100px]"></div>
          <div class="flex flex-col items-center gap-1">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold" :class="langkahAktif >= 2 ? 'bg-warnaTombol text-white' : 'bg-warnaUtama text-slate-500 border border-warnaAksen/20'">2</span>
            <span class="text-[10px] md:text-xs" :class="langkahAktif >= 2 ? 'text-white font-semibold' : 'text-slate-500'">Data Anak</span>
          </div>
          <div class="h-0.5 bg-warnaAksen/40 flex-grow max-w-[50px] md:max-w-[100px]"></div>
          <div class="flex flex-col items-center gap-1">
            <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold" :class="langkahAktif >= 3 ? 'bg-warnaTombol text-white' : 'bg-warnaUtama text-slate-500 border border-warnaAksen/20'">3</span>
            <span class="text-[10px] md:text-xs" :class="langkahAktif >= 3 ? 'text-white font-semibold' : 'text-slate-500'">Pembayaran</span>
          </div>
        </div>
      </div>

      <!-- ==========================================
      LANGKAH 0: LOGIN / DAFTAR & OTP MOCK
      ========================================== -->
      <div v-if="langkahAktif === 0" class="space-y-6">
        <KartuUtama 
          :judul="modeLogin ? 'Masuk ke Akun Anda' : 'Daftar Akun Baru'" 
          subjudul="Langkah awal pendaftaran transportasi antar jemput"
        >
          <!-- OTP Verification View -->
          <div v-if="otpTerkirim && !otpTerverifikasi" class="space-y-6 max-w-sm mx-auto text-center py-6">
            <div class="inline-flex items-center justify-center p-3 bg-warnaAksen/30 text-warnaTombol rounded-full border border-warnaAksen/50">
              <Mail class="w-10 h-10" />
            </div>
            <h4 class="text-base font-bold text-white">Verifikasi OTP Email</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Kami telah mengirimkan kode verifikasi 4-digit ke <strong class="text-slate-200">{{ authEmail }}</strong>. Silakan masukkan di bawah ini.
            </p>
            <div class="space-y-4">
              <input 
                type="text" 
                v-model="otpSandi" 
                placeholder="Masukkan 4 digit OTP (misal: 1234)" 
                maxlength="4"
                class="w-full tracking-widest text-center text-lg font-mono py-2 bg-warnaUtama border border-warnaAksen/40 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-warnaTombol"
              />
              <TombolUtama varian="utama" class="w-full" @click="verifikasiOtpMock">
                Verifikasi OTP
              </TombolUtama>
            </div>
          </div>

          <!-- Form Email & Password Input -->
          <form v-else class="space-y-5" @submit.prevent="tanganiDaftarLoginMock">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Alamat Email</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail class="w-4 h-4" />
                </div>
                <input 
                  type="email" 
                  v-model="authEmail" 
                  required 
                  placeholder="nama@email.com"
                  class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Kata Sandi</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound class="w-4 h-4" />
                </div>
                <input 
                  type="password" 
                  v-model="authSandi" 
                  required 
                  placeholder="••••••••"
                  class="block w-full pl-10 pr-3 py-2.5 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
            </div>

            <div class="pt-2">
              <TombolUtama varian="utama" tipe="submit" class="w-full py-2.5">
                {{ modeLogin ? 'Masuk Sekarang' : 'Daftar & Kirim OTP' }}
              </TombolUtama>
            </div>

            <div class="text-center text-xs pt-2">
              <button 
                type="button" 
                @click="modeLogin = !modeLogin; otpTerkirim = false;"
                class="text-warnaTombol hover:underline font-bold"
              >
                {{ modeLogin ? 'Belum punya akun? Daftar sekarang' : 'Sudah punya akun? Masuk saja' }}
              </button>
            </div>
          </form>
        </KartuUtama>
      </div>

      <!-- ==========================================
      LANGKAH 1: DATA ORANG TUA / WALI
      ========================================== -->
      <div v-if="langkahAktif === 1" class="space-y-6">
        <KartuUtama 
          judul="Langkah 1: Profil Orang Tua / Wali" 
          subjudul="Lengkapi data profil penanggung jawab utama tagihan sekolah"
        >
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Nama Lengkap Wali</label>
              <input 
                type="text" 
                v-model="namaOrangTua" 
                placeholder="Rafi Alief"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email (Auto-fill)</label>
                <input 
                  type="email" 
                  disabled 
                  v-model="emailOrangTua"
                  class="w-full px-3 py-2 bg-warnaUtama/50 border border-warnaAksen/20 rounded-xl text-slate-500 cursor-not-allowed text-sm"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Nomor WhatsApp Aktif</label>
                <input 
                  type="tel" 
                  v-model="waOrangTua" 
                  placeholder="0812-XXXX-XXXX"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Alamat Domisili Rumah</label>
              <textarea 
                rows="3" 
                v-model="alamatDomisili" 
                placeholder="Jalan Prof. M. Yamin No. 12, Padang Barat, Kota Padang"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
              ></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Nomor Kontak Darurat (Opsional)</label>
              <input 
                type="tel" 
                v-model="kontakDarurat" 
                placeholder="0813-XXXX-XXXX"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
              />
            </div>

            <div class="flex justify-end pt-4">
              <TombolUtama varian="utama" class="gap-1.5" @click="simpanProfilOrangTua">
                Simpan & Lanjutkan
                <ArrowRight class="w-4 h-4" />
              </TombolUtama>
            </div>
          </div>
        </KartuUtama>
      </div>

      <!-- ==========================================
      LANGKAH 2: DATA ANAK / SISWA & MAP PICKER
      ========================================== -->
      <div v-if="langkahAktif === 2" class="space-y-6">
        <KartuUtama 
          judul="Langkah 2: Data Anak Sekolah" 
          subjudul="Tambahkan profil siswa beserta peta rute jemputan"
        >
          <!-- Added Children Badges/Summary if any -->
          <div v-if="listAnak.length > 0" class="mb-6 p-4 bg-warnaUtama/50 border border-warnaAksen/30 rounded-xl space-y-2">
            <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wide">Daftar Anak yang Akan Didaftarkan:</h4>
            <div class="space-y-2">
              <div 
                v-for="(anak, idx) in listAnak" 
                :key="idx" 
                class="flex items-center justify-between bg-warnaSekunder p-2.5 rounded-lg border border-warnaAksen/10 text-xs"
              >
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-warnaTombol text-white font-extrabold flex items-center justify-center text-[10px]">{{ idx+1 }}</span>
                  <span class="font-bold text-white">{{ anak.nama }}</span>
                  <span class="text-slate-400">({{ anak.sekolah }} - {{ anak.kelas }})</span>
                </div>
                <span class="font-mono text-warnaTombol font-extrabold">{{ formatMataUang(hitungBiayaPerAnak(anak.layanan, anak.hariSekolah)) }}</span>
              </div>
            </div>
          </div>

          <!-- Form inputs child -->
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Nama Lengkap Anak</label>
                <input 
                  type="text" 
                  v-model="formNamaAnak" 
                  placeholder="Aisyah Putri"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
              
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Jenis Layanan</label>
                <select 
                  v-model="formLayanan"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                >
                  <option value="antar_jemput">Antar Jemput (PP)</option>
                  <option value="antar_saja">Antar Saja (Pagi)</option>
                  <option value="jemput_saja">Jemput Saja (Sore)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Pilih Sekolah</label>
                <select 
                  v-model="formSekolah"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                >
                  <option v-for="sch in daftarSekolah" :key="sch" :value="sch">{{ sch }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Pilih Kelas</label>
                <select 
                  v-model="formKelas"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                >
                  <option v-for="cls in daftarKelas" :key="cls" :value="cls">{{ cls }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Jumlah Hari Sekolah se-Minggu</label>
                <input 
                  type="number" 
                  min="1" 
                  max="6" 
                  v-model.number="formHariSekolah"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
            </div>

            <!-- Leaflet Map Pin Point Picker -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">Pin Point Alamat Penjemputan di Peta</label>
              <PemilihPeta @pilih-lokasi="tanganiLokasiPeta" />
              <div class="flex items-start gap-2 bg-warnaUtama/40 p-2.5 rounded-lg border border-warnaAksen/20 mt-2 text-xs">
                <MapPin class="w-4 h-4 text-warnaTombol flex-shrink-0 mt-0.5" />
                <p class="text-slate-300 font-semibold leading-relaxed">
                  Lokasi Terdeteksi: <span class="font-normal text-slate-400">{{ formAlamatJemput }}</span>
                </p>
              </div>
            </div>

            <!-- Opsional Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Golongan Darah (Opsional)</label>
                <select 
                  v-model="formDarah"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Catatan Alergi / Kesehatan (Opsional)</label>
                <input 
                  type="text" 
                  v-model="formAlergi" 
                  placeholder="Alergi udang / asma"
                  class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-warnaTombol text-sm"
                />
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex flex-wrap justify-between items-center gap-4 pt-6 border-t border-warnaAksen/20">
              <TombolUtama varian="garis-luar" @click="tambahAnakKeList">
                + Tambah Anak Lainnya
              </TombolUtama>
              <div class="flex gap-2">
                <TombolUtama varian="garis-luar" @click="langkahAktif = 1">
                  Kembali
                </TombolUtama>
                <TombolUtama varian="utama" class="gap-1.5" @click="selesaikanLangkahAnak">
                  Simpan & Lanjutkan
                  <ArrowRight class="w-4 h-4" />
                </TombolUtama>
              </div>
            </div>
          </div>
        </KartuUtama>
      </div>

      <!-- ==========================================
      LANGKAH 3: SIMULASI MIDTRANS & DIGITAL INVOICE
      ========================================== -->
      <div v-if="langkahAktif === 3" class="space-y-6">
        <!-- Billing Summary -->
        <KartuUtama 
          judul="Langkah 3: Rincian & Pembayaran Tagihan" 
          subjudul="Lakukan pembayaran aman menggunakan Midtrans Snap"
        >
          <div class="space-y-6">
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Item Tagihan Berlangganan:</h4>
              <div class="divide-y divide-warnaAksen/20 bg-warnaUtama/50 rounded-xl border border-warnaAksen/30 p-4">
                <div 
                  v-for="(anak, idx) in listAnak" 
                  :key="idx" 
                  class="flex justify-between items-center py-2 text-sm text-slate-300"
                >
                  <div>
                    <p class="font-bold text-white">{{ anak.nama }}</p>
                    <p class="text-xs text-slate-400">{{ anak.sekolah }} - {{ anak.layanan === 'antar_jemput' ? 'Antar Jemput (PP)' : 'Satu Arah' }}</p>
                  </div>
                  <span class="font-mono text-white font-bold">{{ formatMataUang(hitungBiayaPerAnak(anak.layanan, anak.hariSekolah)) }}</span>
                </div>
                
                <div class="flex justify-between items-center pt-3 mt-3 border-t border-warnaAksen/40 text-base">
                  <span class="font-bold text-slate-300">Total Pembayaran Bulan Pertama:</span>
                  <span class="font-black text-warnaTombol tracking-wide text-lg">{{ formatMataUang(totalTagihan) }}</span>
                </div>
              </div>
            </div>

            <!-- Payment Action -->
            <div v-if="!pembayaranLunas" class="bg-warnaUtama/20 border border-warnaAksen/10 p-5 rounded-2xl flex flex-col items-center text-center space-y-4">
              <CreditCard class="w-12 h-12 text-warnaTombol animate-bounce" />
              <h4 class="text-base font-bold text-white">Selesaikan Pembayaran via Midtrans</h4>
              <p class="text-xs text-slate-400 max-w-md leading-relaxed">
                Silakan klik tombol di bawah ini untuk menampilkan jendela pembayaran aman Midtrans Snap. Anda bisa membayar menggunakan QRIS, E-Wallet, atau Virtual Account Bank.
              </p>
              <TombolUtama varian="utama" class="w-full sm:w-fit py-3 px-8 text-sm" @click="bayarSnapMidtrans">
                Bayar Sekarang
              </TombolUtama>
            </div>

            <!-- Paid/Success Invoice view -->
            <div v-else class="space-y-6">
              <div class="bg-emerald-950/20 border border-emerald-500/30 p-5 rounded-2xl flex items-center gap-4 text-emerald-400">
                <CheckCircle class="w-10 h-10 flex-shrink-0" />
                <div>
                  <h4 class="text-base font-bold text-white">Pembayaran Sukses Terverifikasi!</h4>
                  <p class="text-xs text-slate-300">
                    Terima kasih, tagihan bulan pertama pendaftaran antar-jemput anak Anda telah lunas didebet secara real-time.
                  </p>
                </div>
              </div>

              <!-- Digital Invoice Download Mock -->
              <div class="bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-6 shadow-md relative">
                <div class="flex justify-between border-b border-warnaAksen/30 pb-4">
                  <div>
                    <h3 class="text-base font-bold text-white">INVOICE DIGITAL</h3>
                    <p class="text-[10px] text-slate-400">No. Inv: INV-DNT-2026-0001</p>
                  </div>
                  <div class="text-right">
                    <h3 class="text-sm font-extrabold text-white">DenantaTS</h3>
                    <p class="text-[10px] text-slate-400">Kota Padang, Sumatra Barat</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p class="text-slate-400">Diterbitkan Kepada:</p>
                    <p class="text-white font-bold">{{ namaOrangTua }}</p>
                    <p class="text-slate-300">{{ waOrangTua }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-slate-400">Tanggal Bayar:</p>
                    <p class="text-white font-bold">{{ new Date().toLocaleDateString('id-ID') }}</p>
                    <p class="text-emerald-400 font-bold uppercase">LUNAS - MIDTRANS</p>
                  </div>
                </div>

                <div class="border-t border-warnaAksen/20 pt-4">
                  <div class="flex justify-between text-xs font-bold text-white mb-2">
                    <span>Layanan Penjemputan</span>
                    <span>Total</span>
                  </div>
                  <div 
                    v-for="(anak, idx) in listAnak" 
                    :key="idx"
                    class="flex justify-between text-xs text-slate-300 py-1"
                  >
                    <span>Layanan Antar Jemput untuk {{ anak.nama }}</span>
                    <span>{{ formatMataUang(hitungBiayaPerAnak(anak.layanan, anak.hariSekolah)) }}</span>
                  </div>
                  <div class="flex justify-between text-sm font-bold text-white border-t border-warnaAksen/30 pt-3 mt-3">
                    <span>Total Tagihan:</span>
                    <span class="text-warnaTombol font-extrabold">{{ formatMataUang(totalTagihan) }}</span>
                  </div>
                </div>

                <div class="pt-6 flex justify-end">
                  <TombolUtama varian="garis-luar" class="text-xs" @click="picuToast('Mengunduh berkas PDF Invoice Mockup...', 'info')">
                    Unduh PDF Invoice
                  </TombolUtama>
                </div>
              </div>

              <!-- Button redirect to parents dashboard -->
              <div class="flex justify-center">
                <router-link :to="{ path: '/orangtua', query: { tab: 'pantau' } }">
                  <TombolUtama varian="utama" class="gap-2">
                    Masuk ke Halaman Monitoring Anak
                    <ArrowRight class="w-5 h-5" />
                  </TombolUtama>
                </router-link>
              </div>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>

    <!-- ==========================================
    POPUP 1: MODAL RINGKASAN DATA (LANGKAH 2)
    ========================================== -->
    <ModalUtama 
      :tampil="modalRingkasanTampil" 
      judul="Ringkasan Formulir Berlangganan" 
      ukuran="lebar"
      @tutup="modalRingkasanTampil = false"
    >
      <div class="space-y-6 text-sm text-slate-300">
        <p class="text-xs text-slate-400">
          Silakan periksa kembali kelayakan seluruh informasi pendaftaran di bawah ini sebelum melanjutkan ke pembayaran.
        </p>

        <!-- Orang Tua Info -->
        <div class="bg-warnaUtama/50 border border-warnaAksen/20 p-4 rounded-xl space-y-2">
          <h4 class="text-xs font-bold text-warnaTombol uppercase tracking-wider">Detail Orang Tua / Wali</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <span class="text-slate-400">Nama Wali: <strong class="text-slate-200">{{ namaOrangTua }}</strong></span>
            <span class="text-slate-400">No. WhatsApp: <strong class="text-slate-200">{{ waOrangTua }}</strong></span>
            <span class="text-slate-400 col-span-2">Alamat Domisili: <strong class="text-slate-200">{{ alamatDomisili }}</strong></span>
          </div>
        </div>

        <!-- Anak List Info -->
        <div class="bg-warnaUtama/50 border border-warnaAksen/20 p-4 rounded-xl space-y-3">
          <h4 class="text-xs font-bold text-warnaTombol uppercase tracking-wider">Detail Anak Sekolah</h4>
          <div class="space-y-3">
            <div 
              v-for="(anak, idx) in listAnak" 
              :key="idx"
              class="border-b border-warnaAksen/20 pb-2 last:border-b-0 text-xs space-y-1"
            >
              <p class="font-bold text-white">{{ idx+1 }}. {{ anak.nama }} ({{ anak.sekolah }})</p>
              <p class="text-slate-400">Kelas: <span class="text-slate-200">{{ anak.kelas }}</span> | Layanan: <span class="text-slate-200 capitalize">{{ anak.layanan.replace('_', ' ') }}</span></p>
              <p class="text-slate-400 truncate">Titik Koordinat: <span class="text-slate-200 font-mono">({{ anak.lintangJemput.toFixed(5) }}, {{ anak.bujurJemput.toFixed(5) }})</span></p>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <TombolUtama varian="garis-luar" @click="modalRingkasanTampil = false">
          Batal / Koreksi
        </TombolUtama>
        <TombolUtama varian="utama" @click="konfirmasiLanjutLangkah3">
          Konfirmasi & Lanjut Bayar
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- ==========================================
    POPUP 2: MODAL SIMULATOR MIDTRANS SNAP (LANGKAH 3)
    ========================================== -->
    <ModalUtama 
      :tampil="snapTampil" 
      judul="Gerbang Pembayaran Midtrans Snap (Sandbox)" 
      @tutup="snapTampil = false"
    >
      <div class="space-y-6 text-sm text-slate-300 p-2">
        <div class="flex items-center gap-3 border-b border-warnaAksen/20 pb-4">
          <div class="w-10 h-10 rounded bg-white flex items-center justify-center font-black text-black">
            M
          </div>
          <div>
            <h4 class="text-base font-extrabold text-white">Midtrans Snap</h4>
            <p class="text-[10px] text-slate-400">Simulator Sandbox Pembayaran Aman</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex justify-between text-xs text-slate-400">
            <span>Nomor Pesanan:</span>
            <span class="font-mono text-white">ORDER-DNT-2026-9812</span>
          </div>
          <div class="flex justify-between text-xs text-slate-400">
            <span>Jumlah Pembayaran:</span>
            <span class="font-bold text-warnaTombol text-sm">{{ formatMataUang(totalTagihan) }}</span>
          </div>

          <div class="border border-warnaAksen/30 p-4 rounded-xl space-y-3 bg-warnaUtama/50">
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider">Pilih Metode Pembayaran VA</label>
            <select 
              v-model="virtualAccountBank"
              class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-sm"
            >
              <option value="bni">BNI Virtual Account</option>
              <option value="mandiri">Mandiri Bill Payment</option>
              <option value="bri">BRI Virtual Account</option>
              <option value="gopay">GoPay (QRIS)</option>
            </select>
          </div>

          <div class="p-4 bg-warnaUtama/50 border border-warnaAksen/30 rounded-xl text-center space-y-2">
            <p class="text-xs text-slate-400">Nomor Virtual Account Anda:</p>
            <p class="text-xl font-bold font-mono tracking-widest text-white">{{ noVirtualAccount }}</p>
            <p class="text-[9px] text-slate-500 leading-relaxed">*Simulasi ini terintegrasi snap client-side SDK untuk validasi transaksi.</p>
          </div>
        </div>
      </div>
      
      <template #footer>
        <TombolUtama varian="garis-luar" @click="snapTampil = false">
          Batal Bayar
        </TombolUtama>
        <TombolUtama varian="utama" @click="selesaikanPembayaranMock">
          Konfirmasi Bayar Lunas
        </TombolUtama>
      </template>
    </ModalUtama>

  </TataLetakTamu>
</template>
