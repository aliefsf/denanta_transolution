<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuth } from '../../komposabel/useAuth';
import { User, Mail, Phone, Lock, FileCheck, Star, Bus, ShieldCheck, ShieldAlert, Clock, Loader2, Truck, Upload, Check, AlertTriangle, RefreshCw } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import {
  ambilProfilSupirLengkap,
  perbaruiProfilSupir,
  ambilRatingSupir,
  unggahDokumenLegalitas,
  unggahFotoProfilSupir,
  type ProfilSupirLengkap,
  type RingkasanRatingSupir,
  type JenisDokumenLegalitas
} from '../../layanan/supirLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { gunakanRealtimeSubscription } from '../../layanan/realtimeLayanan';

const { perbaruiKataSandi, userProfile, currentUser } = useAuth();

// Sama seperti dropdown Jenis Kendaraan di Kelola Data Supir (Admin) --
// supir tidak bisa melihat data kendaraan supir lain untuk melengkapi opsi
// "dariData" seperti di sisi Admin, jadi cukup opsi dasar + "Lainnya".
const JENIS_KENDARAAN_DASAR = ['Toyota HiAce', 'Isuzu Elf', 'Suzuki Carry'];
const OPSI_LAINNYA = '__lainnya__';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const sedangMemuat = ref(true);
const sedangMenyimpanProfil = ref(false);
const sedangMenyimpanSandi = ref(false);

const profil = ref<ProfilSupirLengkap | null>(null);
const rating = ref<RingkasanRatingSupir>({ rataRating: 0, jumlahUlasan: 0, ulasan: [] });

// Form Data Diri & Kendaraan
const namaLengkap = ref('');
const noTelepon = ref('');
const jenisKendaraanPilihan = ref('');
const jenisKendaraanLainnya = ref('');
const platNomor = ref('');

// Foto Profil (OPSIONAL) -- pola sama seperti ProfilOrangTua.vue: dipilih
// lokal dulu (preview instan via URL.createObjectURL), baru benar-benar
// diunggah ke bucket 'profile-images' saat "Perbarui Profil" ditekan.
const fotoProfilUrl = ref('');
const berkasFotoBaru = ref<File | null>(null);
const previewFotoUrl = ref('');
const inputFotoProfil = ref<HTMLInputElement | null>(null);

const pilihFotoProfil = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    picuToast('Format foto harus PNG atau JPG.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    picuToast('Ukuran foto maksimal 5 MB.', 'error');
    return;
  }

  berkasFotoBaru.value = file;
  previewFotoUrl.value = URL.createObjectURL(file);
};

// Jenis kendaraan tersimpan yang BUKAN bagian dari JENIS_KENDARAAN_DASAR --
// dulu nilai custom ini disembunyikan di balik "+ Lainnya..." (dropdown
// tidak pernah benar-benar menampilkannya sebagai opsi), sekarang
// dimasukkan sebagai opsi dropdown sungguhan supaya langsung terlihat
// terpilih, bukan tersembunyi.
const jenisKendaraanCustomTersimpan = ref<string | null>(null);

const daftarOpsiKendaraan = computed(() => {
  const opsi = [...JENIS_KENDARAAN_DASAR];
  if (jenisKendaraanCustomTersimpan.value && !opsi.includes(jenisKendaraanCustomTersimpan.value)) {
    opsi.push(jenisKendaraanCustomTersimpan.value);
  }
  return opsi;
});

// Terisi kalau muat gagal/timeout -- template utama mengakses `profil.xxx`
// tanpa null-check (v-else tanpa syarat), jadi kalau `profil` tetap null
// setelah gagal muat, sebelumnya halaman ini CRASH (render error, layar
// blank) alih-alih menampilkan pesan yang bisa ditindaklanjuti pengguna.
const gagalMemuat = ref(false);

const muatData = async () => {
  sedangMemuat.value = true;
  gagalMemuat.value = false;
  try {
    const [dataProfil, dataRating] = await denganBatasWaktu(
      Promise.all([ambilProfilSupirLengkap(), ambilRatingSupir()]),
      10000,
      'Waktu memuat data profil habis.'
    );
    profil.value = dataProfil;
    rating.value = dataRating;
    namaLengkap.value = dataProfil.namaLengkap;
    noTelepon.value = dataProfil.nomorTelepon ?? '';
    platNomor.value = dataProfil.nomorPlat;

    const dikenal = JENIS_KENDARAAN_DASAR.includes(dataProfil.jenisKendaraan);
    jenisKendaraanCustomTersimpan.value = dikenal ? null : dataProfil.jenisKendaraan;
    jenisKendaraanPilihan.value = dataProfil.jenisKendaraan;
    jenisKendaraanLainnya.value = '';
    fotoProfilUrl.value = userProfile.value?.foto_profil || '';
  } catch (err: any) {
    gagalMemuat.value = true;
    picuToast(err.message || 'Gagal memuat data profil.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Refetch DIAM-DIAM (tanpa spinner layar penuh) -- dipakai realtime supaya
// mis. status verifikasi dokumen yang diputuskan Admin langsung berubah di
// sini tanpa mengganggu form yang mungkin sedang diisi.
const muatDataDiam = async () => {
  try {
    const [dataProfil, dataRating] = await Promise.all([ambilProfilSupirLengkap(), ambilRatingSupir()]);
    profil.value = dataProfil;
    rating.value = dataRating;
    // Sengaja TIDAK menimpa namaLengkap/noTelepon/platNomor/jenisKendaraan --
    // itu field form yang mungkin sedang diketik supir sendiri; status
    // verifikasi & dokumen (dibaca lewat `profil`) sudah cukup lewat baris di atas.
  } catch (err) {
    console.error('Gagal menyegarkan profil supir (realtime):', err);
  }
};

let saluranSupir: { unsubscribe: () => void } | null = null;
let saluranPengguna: { unsubscribe: () => void } | null = null;
let saluranPenilaian: { unsubscribe: () => void } | null = null;

onMounted(() => {
  muatData();
  const id = currentUser.value?.id;
  if (id) {
    saluranSupir = gunakanRealtimeSubscription('supir', `id=eq.${id}`, muatDataDiam);
    saluranPengguna = gunakanRealtimeSubscription('pengguna', `id=eq.${id}`, muatDataDiam);
    // Rating baru dari orang tua (penilaian selesai perjalanan) langsung
    // memperbarui rata-rata & daftar ulasan di sini tanpa refresh.
    saluranPenilaian = gunakanRealtimeSubscription('penilaian', `supir_id=eq.${id}`, muatDataDiam);
  }
});

onUnmounted(() => {
  saluranSupir?.unsubscribe();
  saluranSupir = null;
  saluranPengguna?.unsubscribe();
  saluranPengguna = null;
  saluranPenilaian?.unsubscribe();
  saluranPenilaian = null;
});

const simpanProfil = async () => {
  const jenisKendaraanFinal = jenisKendaraanPilihan.value === OPSI_LAINNYA
    ? jenisKendaraanLainnya.value.trim()
    : jenisKendaraanPilihan.value;

  if (!jenisKendaraanFinal) {
    picuToast('Jenis kendaraan wajib diisi!', 'error');
    return;
  }

  sedangMenyimpanProfil.value = true;
  try {
    let fotoProfilBaru: string | undefined;
    if (berkasFotoBaru.value && currentUser.value?.id) {
      fotoProfilBaru = await unggahFotoProfilSupir(currentUser.value.id, berkasFotoBaru.value);
    }

    await perbaruiProfilSupir({
      namaLengkap: namaLengkap.value,
      nomorTelepon: noTelepon.value,
      jenisKendaraan: jenisKendaraanFinal,
      nomorPlat: platNomor.value,
      fotoProfil: fotoProfilBaru
    });

    // Sinkronkan state singleton useAuth() juga -- sapaan "Halo, ..." di
    // header TataLetakSupir.vue membaca dari sini (useAuth().userProfile),
    // BUKAN dari data lokal komponen ini, jadi tanpa ini nama/foto di header
    // tetap basi (nama/foto lama) sampai logout/login ulang walau data
    // profil pribadi sudah berhasil disimpan ke database.
    if (userProfile.value) {
      userProfile.value.nama = namaLengkap.value;
      if (fotoProfilBaru) userProfile.value.foto_profil = fotoProfilBaru;
    }
    if (fotoProfilBaru) {
      fotoProfilUrl.value = fotoProfilBaru;
      berkasFotoBaru.value = null;
      previewFotoUrl.value = '';
    }

    picuToast('Data profil pribadi berhasil diperbarui!', 'sukses');
    await muatData();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui profil.', 'error');
  } finally {
    sedangMenyimpanProfil.value = false;
  }
};

// Password
const sandiBaru = ref('');
const konfirmasiSandi = ref('');

const ubahSandi = async () => {
  if (!sandiBaru.value || !konfirmasiSandi.value) {
    picuToast('Silakan lengkapi seluruh kolom kata sandi', 'error');
    return;
  }
  if (sandiBaru.value !== konfirmasiSandi.value) {
    picuToast('Kata sandi baru dan konfirmasi kata sandi tidak cocok', 'error');
    return;
  }
  if (sandiBaru.value.length < 6) {
    picuToast('Kata sandi minimal 6 karakter', 'error');
    return;
  }

  sedangMenyimpanSandi.value = true;
  try {
    await perbaruiKataSandi(sandiBaru.value);
    picuToast('Kata sandi Anda berhasil diperbarui!', 'sukses');
    sandiBaru.value = '';
    konfirmasiSandi.value = '';
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui kata sandi.', 'error');
  } finally {
    sedangMenyimpanSandi.value = false;
  }
};

const labelVerifikasi = (status: string) => {
  switch (status) {
    case 'terverifikasi': return { teks: 'Terverifikasi', kelas: 'text-emerald-600' };
    case 'ditolak': return { teks: 'Ditolak', kelas: 'text-rose-600' };
    default: return { teks: 'Menunggu Verifikasi Admin', kelas: 'text-amber-600' };
  }
};

// Edit Dokumen Legalitas -- terkunci selama status_verifikasi === 'menunggu'
const MAKS_UKURAN_DOKUMEN = 10 * 1024 * 1024; // 10 MB, selaras dengan batas bucket "dokumen-supir"
const sedangUpload = ref<JenisDokumenLegalitas | null>(null);

const daftarDokumen: { jenis: JenisDokumenLegalitas; label: string }[] = [
  { jenis: 'ktp', label: 'KTP' },
  { jenis: 'sim', label: 'SIM' },
  { jenis: 'stnk', label: 'STNK' }
];

const urlDokumen = (jenis: JenisDokumenLegalitas): string | null => {
  if (!profil.value) return null;
  return jenis === 'ktp' ? profil.value.urlKtp : jenis === 'sim' ? profil.value.urlSim : profil.value.urlStnk;
};

const labelDokumen: Record<JenisDokumenLegalitas, string> = { ktp: 'KTP', sim: 'SIM', stnk: 'STNK' };

// Alur: klik "Ganti" -> file picker langsung terbuka -> begitu file dipilih,
// BARU muncul pop up konfirmasi (bukan sebaliknya) -- supir perlu melihat
// dulu file apa yang mau diunggah sebelum diminta konfirmasi. Supir boleh
// mengganti dokumen kapan saja, termasuk selagi pengajuan sebelumnya masih
// 'menunggu' keputusan Admin (lihat migrasi "SUPIR BOLEH GANTI DOKUMEN
// LEGALITAS KAPAN SAJA" di skema_database.sql) -- trigger
// trg_jaga_status_verifikasi_supir tetap otomatis memindahkan status ke
// 'menunggu' begitu upload ini berhasil, jadi tidak perlu diblokir di sisi
// UI/kebijakan storage lagi.
const inputFileRefs: Partial<Record<JenisDokumenLegalitas, HTMLInputElement>> = {};
const daftarInputFile = (jenis: JenisDokumenLegalitas) => (el: any) => {
  if (el) inputFileRefs[jenis] = el as HTMLInputElement;
};

const bukaFilePicker = (jenis: JenisDokumenLegalitas) => {
  if (sedangUpload.value !== null) return;
  inputFileRefs[jenis]?.click();
};

// File yang sudah dipilih tapi belum dikonfirmasi -- ditampilkan di modal.
const fileDipilih = ref<{ jenis: JenisDokumenLegalitas; file: File } | null>(null);

const pilihFileDokumen = (e: Event, jenis: JenisDokumenLegalitas) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  if (file.size > MAKS_UKURAN_DOKUMEN) {
    picuToast('Ukuran file maksimal 10MB!', 'error');
    return;
  }

  fileDipilih.value = { jenis, file };
};

const batalkanGantiDokumen = () => {
  fileDipilih.value = null;
};

const konfirmasiUnggahDokumen = async () => {
  const dipilih = fileDipilih.value;
  if (!dipilih) return;
  fileDipilih.value = null;

  sedangUpload.value = dipilih.jenis;
  try {
    await unggahDokumenLegalitas(dipilih.jenis, dipilih.file);
    picuToast(`Dokumen ${dipilih.jenis.toUpperCase()} berhasil diperbarui, menunggu verifikasi ulang Admin.`, 'sukses');
    await muatData();
  } catch (err: any) {
    picuToast(err.message || 'Gagal mengunggah dokumen.', 'error');
    // Segarkan juga saat gagal -- lihat catatan yang sama sebelumnya, badge
    // status harus selalu mencerminkan kondisi database terkini.
    await muatData();
  } finally {
    sedangUpload.value = null;
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

    <div class="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
        <User class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-on-background tracking-tight">Profil & Pengaturan Driver</h1>
        <p class="text-xs text-on-surface-variant">Tinjau kelengkapan dokumen berkendara, plat nomor bus, dan performa rating Anda.</p>
      </div>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <div v-else-if="gagalMemuat || !profil" class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle class="w-8 h-8 text-rose-500" />
      <p class="text-sm text-on-surface-variant max-w-sm">Gagal memuat data profil. Periksa koneksi internet Anda lalu coba lagi.</p>
      <TombolUtama tema="terang" varian="utama" class="gap-1.5" @click="muatData">
        <RefreshCw class="w-3.5 h-3.5" /> Coba Lagi
      </TombolUtama>
    </div>

    <!-- Layout Grid -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Left: Data Diri & Sandi Forms -->
      <div class="lg:col-span-2 space-y-6">

        <!-- 1. Edit Data Diri -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-4 soft-shadow">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <User class="w-4.5 h-4.5 text-primary" />
            Informasi Pribadi & Kontak
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="simpanProfil">
            <!-- Foto Profil (Opsional) -->
            <div class="flex items-center gap-4">
              <button
                type="button"
                class="relative w-16 h-16 rounded-full bg-surface-bright border border-outline-variant flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors flex-shrink-0"
                @click="inputFotoProfil?.click()"
              >
                <img
                  v-if="previewFotoUrl || fotoProfilUrl"
                  :src="previewFotoUrl || fotoProfilUrl"
                  alt="Foto profil"
                  class="w-full h-full object-cover"
                />
                <User v-else class="w-6 h-6 text-on-surface-variant" />
              </button>
              <div class="space-y-1">
                <input ref="inputFotoProfil" type="file" accept="image/png,image/jpeg,image/jpg" class="hidden" @change="pilihFotoProfil" />
                <TombolUtama tema="terang" varian="garis-luar" class="!py-1.5 !px-3 text-[11px] gap-1" @click.prevent="inputFotoProfil?.click()">
                  <Upload class="w-3.5 h-3.5" />
                  {{ fotoProfilUrl || previewFotoUrl ? 'Ganti Foto' : 'Unggah Foto' }}
                </TombolUtama>
                <p class="text-[10px] text-on-surface-variant">PNG/JPG, maksimal 5 MB.</p>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Lengkap Driver</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                  <User class="w-4 h-4" />
                </div>
                <input
                  type="text"
                  v-model="namaLengkap"
                  required
                  class="block w-full pl-10 pr-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Alamat Email</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail class="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    :value="profil?.email"
                    disabled
                    class="block w-full pl-10 pr-3 py-2 bg-surface-container/50 border border-outline-variant/50 rounded-xl text-on-surface-variant cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nomor WhatsApp</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Phone class="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    v-model="noTelepon"
                    required
                    placeholder="Contoh: 08123456789"
                    class="block w-full pl-10 pr-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/20">
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Jenis Kendaraan</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Truck class="w-4 h-4" />
                  </div>
                  <select
                    v-model="jenisKendaraanPilihan"
                    class="block w-full pl-10 pr-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container appearance-none"
                  >
                    <option v-for="opsi in daftarOpsiKendaraan" :key="opsi" :value="opsi">{{ opsi }}</option>
                    <option :value="OPSI_LAINNYA">+ Lainnya...</option>
                  </select>
                </div>
                <div v-if="jenisKendaraanPilihan === OPSI_LAINNYA" class="flex gap-2 mt-2">
                  <input
                    type="text"
                    v-model="jenisKendaraanLainnya"
                    required
                    placeholder="Tulis jenis kendaraan lain"
                    class="block w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                  />
                  <button
                    type="button"
                    title="Simpan jenis kendaraan"
                    :disabled="!jenisKendaraanLainnya.trim() || sedangMenyimpanProfil"
                    @click="simpanProfil"
                    class="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center border-0 cursor-pointer transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Loader2 v-if="sedangMenyimpanProfil" class="w-4 h-4 animate-spin" />
                    <Check v-else class="w-4 h-4" />
                  </button>
                </div>
                <p v-if="jenisKendaraanPilihan === OPSI_LAINNYA" class="text-[9px] text-on-surface-variant mt-1">
                  Tekan tombol centang untuk langsung menyimpan jenis kendaraan ini.
                </p>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Plat Nomor Kendaraan</label>
                <input
                  type="text"
                  v-model="platNomor"
                  required
                  class="block w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono"
                />
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama tema="terang" varian="utama" tipe="submit" :nonaktif="sedangMenyimpanProfil">
                {{ sedangMenyimpanProfil ? 'Menyimpan...' : 'Perbarui Profil' }}
              </TombolUtama>
            </div>
          </form>
        </div>

        <!-- 2. Ubah Kata Sandi -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-4 soft-shadow">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <Lock class="w-4.5 h-4.5 text-primary" />
            Keamanan & Kata Sandi
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="ubahSandi">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Kata Sandi Baru</label>
                <input
                  type="password"
                  v-model="sandiBaru"
                  required
                  placeholder="••••••••"
                  class="block w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  v-model="konfirmasiSandi"
                  required
                  placeholder="••••••••"
                  class="block w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                />
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama tema="terang" varian="utama" tipe="submit" :nonaktif="sedangMenyimpanSandi">
                {{ sedangMenyimpanSandi ? 'Menyimpan...' : 'Ubah Kata Sandi' }}
              </TombolUtama>
            </div>
          </form>
        </div>

      </div>

      <!-- Right: Vehicle, Docs & Ratings -->
      <div class="space-y-6">

        <!-- Vehicle info & Kepegawaian -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow text-xs">
          <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <Bus class="w-4.5 h-4.5 text-primary" />
            Data Armada & Status Driver
          </h3>

          <div class="space-y-3" v-if="profil">
            <div class="flex justify-between border-b border-outline-variant/10 pb-2">
              <span class="text-on-surface-variant">Jenis Kendaraan:</span>
              <span class="text-on-surface font-bold">{{ profil.jenisKendaraan }}</span>
            </div>
            <div class="flex justify-between border-b border-outline-variant/10 pb-2">
              <span class="text-on-surface-variant">Plat Nomor Kendaraan:</span>
              <span class="text-on-surface font-bold font-mono">{{ profil.nomorPlat }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-on-surface-variant">Status Kepegawaian:</span>
              <span class="px-2 py-0.5 rounded bg-primary-container/30 text-primary border border-primary/20 font-bold uppercase text-[9px]">
                {{ profil.tipeSupir === 'tetap' ? 'Tetap' : 'Sementara (Freelance)' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Documents Status verification + Edit Dokumen Legalitas -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow text-xs">
          <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <FileCheck class="w-4.5 h-4.5 text-primary" />
            Dokumen Legalitas
          </h3>

          <div class="space-y-3" v-if="profil">
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant">Status Verifikasi Akun:</span>
              <span class="font-bold flex items-center gap-1" :class="labelVerifikasi(profil.statusVerifikasi).kelas">
                <ShieldCheck v-if="profil.statusVerifikasi === 'terverifikasi'" class="w-3.5 h-3.5" />
                <Clock v-else-if="profil.statusVerifikasi === 'menunggu'" class="w-3.5 h-3.5" />
                <ShieldAlert v-else class="w-3.5 h-3.5" />
                {{ labelVerifikasi(profil.statusVerifikasi).teks }}
              </span>
            </div>

            <div
              v-if="profil.statusVerifikasi === 'menunggu'"
              class="flex gap-2 text-[10px] text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200"
            >
              <Clock class="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Pengajuan dokumen sedang diperiksa Admin. Anda tetap bisa mengganti dokumen lain/lagi kapan saja bila perlu.</span>
            </div>
            <p v-else class="text-[10px] text-on-surface-variant leading-relaxed">
              Ganti dokumen bila ada berkas yang kedaluwarsa atau perlu diperbarui. Setiap penggantian akan diverifikasi ulang oleh Admin.
            </p>

            <!-- Per-dokumen: lihat + ganti -->
            <div class="space-y-2 pt-1">
              <div
                v-for="dok in daftarDokumen"
                :key="dok.jenis"
                class="flex items-center justify-between gap-2 bg-surface-container p-2.5 rounded-lg border border-outline-variant/20"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-bold text-on-surface">{{ dok.label }}</span>
                  <a
                    v-if="urlDokumen(dok.jenis)"
                    :href="urlDokumen(dok.jenis)!"
                    target="_blank"
                    class="text-primary underline text-[10px] flex-shrink-0"
                  >
                    Lihat
                  </a>
                  <span v-else class="text-on-surface-variant italic text-[10px]">Belum diunggah</span>
                </div>

                <button
                  type="button"
                  class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex-shrink-0 border-0"
                  :class="sedangUpload !== null
                    ? 'bg-outline-variant/10 text-on-surface-variant cursor-not-allowed opacity-60'
                    : 'bg-primary-container/20 text-primary hover:bg-primary-container/30 cursor-pointer'"
                  :disabled="sedangUpload !== null"
                  @click="bukaFilePicker(dok.jenis)"
                >
                  <Loader2 v-if="sedangUpload === dok.jenis" class="w-3.5 h-3.5 animate-spin" />
                  <Upload v-else class="w-3.5 h-3.5" />
                  Ganti
                </button>
                <input
                  type="file"
                  :ref="daftarInputFile(dok.jenis)"
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  class="hidden"
                  @change="pilihFileDokumen($event, dok.jenis)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Ratings & Reviews -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow text-xs">
          <div class="flex justify-between items-center border-b border-outline-variant/20 pb-3">
            <h3 class="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <Star class="w-4.5 h-4.5 text-amber-500 fill-amber-500" />
              Nilai Kepuasan Wali
            </h3>
            <div class="text-right">
              <span class="text-on-surface font-extrabold font-mono text-sm bg-surface-container px-2 py-0.5 rounded border border-outline-variant/25">{{ rating.rataRating }} / 5.0</span>
              <p class="text-[9px] text-on-surface-variant mt-0.5">dari {{ rating.jumlahUlasan }} penilaian</p>
            </div>
          </div>

          <!-- Ulasan ditampilkan anonim -- tanpa identitas pengirim -->
          <div class="space-y-3">
            <div
              v-for="(ul, idx) in rating.ulasan"
              :key="idx"
              class="border-b border-outline-variant/10 pb-2 last:border-b-0 space-y-1"
            >
              <span class="text-amber-500 flex items-center gap-0.5">
                <Star class="w-3 h-3 fill-current" v-for="b in ul.bintang" :key="b" />
              </span>
              <p v-if="ul.komentar" class="text-[11px] text-on-surface-variant italic leading-relaxed">"{{ ul.komentar }}"</p>
            </div>
            <div v-if="rating.ulasan.length === 0" class="text-center text-on-surface-variant italic text-[11px] py-4">
              Belum ada ulasan diterima.
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Konfirmasi Unggah Dokumen -- muncul SETELAH file dipilih dari file
         picker (bukan sebelumnya), lihat catatan lengkap di pilihFileDokumen()/
         konfirmasiUnggahDokumen() (script). -->
    <ModalUtama
      tema="terang"
      :tampil="fileDipilih !== null"
      judul="Konfirmasi Unggah Dokumen"
      @tutup="batalkanGantiDokumen"
    >
      <div v-if="fileDipilih" class="space-y-3 text-sm text-left">
        <p class="text-on-surface leading-relaxed">
          Anda akan mengganti dokumen <strong>{{ labelDokumen[fileDipilih.jenis] }}</strong> dengan file:
        </p>
        <div class="flex items-center gap-2 text-xs bg-surface-container p-3 rounded-lg border border-outline-variant/30 font-mono truncate">
          <FileCheck class="w-4 h-4 text-primary flex-shrink-0" />
          <span class="truncate">{{ fileDipilih.file.name }}</span>
        </div>
        <div class="flex gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
          <Clock class="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            Status verifikasi akun Anda akan otomatis berubah menjadi <strong>"Menunggu Verifikasi Admin"</strong>
            begitu dokumen ini diunggah, sampai Admin memeriksa &amp; memutuskan ulang pengajuannya. Lanjutkan?
          </span>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="batalkanGantiDokumen">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" @click="konfirmasiUnggahDokumen">Ya, Unggah</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
