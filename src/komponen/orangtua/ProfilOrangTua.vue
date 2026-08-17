<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { useAuth } from '../../komposabel/useAuth';
import { User, Mail, Lock, Phone, Camera } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import { ambilProfilOrangTua, perbaruiProfilOrangTua, unggahFotoProfil } from '../../layanan/orangTuaLayanan';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import { gunakanRealtimeSubscription } from '../../layanan/realtimeLayanan';

const authStore = useAuthStore();
const auth = useAuth();
// Dipakai HANYA untuk menyegarkan `profil` singleton setelah simpan --
// sapaan "Halo, ..." di TataLetakOrangTua.vue membaca dari situ, BUKAN dari
// state lokal komponen ini, jadi tanpa ini nama di header tetap basi
// (nama lama) sampai logout/login ulang walau data sudah berhasil disimpan.
const { muatProfil } = useDataOrangTua();

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
const namaLengkap = ref('');
const emailVal = ref(authStore.pengguna?.email || '');
const noWa = ref('');
// Alamat sudah dihapus dari form ini (alamat cuma relevan untuk data anak,
// bukan orang tua) -- ref ini dipertahankan (selalu diisi ulang dari nilai
// lama, TIDAK PERNAH diedit lagi lewat UI) supaya payload perbaruiProfilOrangTua
// tidak menimpa alamat lama dengan string kosong.
const alamatDomisili = ref('');
const kontakDarurat = ref('');
const sedangMemuatProfil = ref(false);
const sedangMenyimpanProfil = ref(false);
const errorProfil = ref<string | null>(null);

// Foto Profil (OPSIONAL) -- berkasFotoBaru ditahan lokal & baru diunggah ke
// bucket 'profile-images' saat "Simpan Profil Baru" ditekan (bukan langsung
// begitu dipilih), supaya pengguna bisa membatalkan tanpa foto lama sempat
// tertimpa. previewFotoUrl (object URL lokal) dipakai sbg pratinjau instan
// sebelum unggahan sungguhan selesai.
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

const muatDataProfil = async () => {
  if (!authStore.pengguna?.id) return;
  errorProfil.value = null;
  try {
    const { pengguna, orangTua } = await ambilProfilOrangTua(authStore.pengguna.id);
    namaLengkap.value = pengguna.nama_lengkap;
    emailVal.value = pengguna.email;
    noWa.value = orangTua?.nomor_whatsapp || pengguna.nomor_telepon || '';
    alamatDomisili.value = orangTua?.alamat || '';
    kontakDarurat.value = orangTua?.kontak_darurat || '';
    fotoProfilUrl.value = pengguna.foto_profil || '';
  } catch (err: any) {
    errorProfil.value = err.message || 'Gagal memuat profil.';
  } finally {
    sedangMemuatProfil.value = false;
  }
};

// Realtime -- kalau profil diubah dari perangkat/tab lain (mis. akun yang
// sama login di 2 tempat), form ini ikut menyegarkan diri, KECUALI sedang
// dalam proses menyimpan (menghindari menimpa perubahan yang baru saja
// dikirim dengan hasil balapan/race).
let saluranPengguna: { unsubscribe: () => void } | null = null;
let saluranOrangTua: { unsubscribe: () => void } | null = null;

onMounted(async () => {
  sedangMemuatProfil.value = true;
  await muatDataProfil();

  const id = authStore.pengguna?.id;
  if (id) {
    const segarkanJikaTidakMenyimpan = () => { if (!sedangMenyimpanProfil.value) muatDataProfil(); };
    saluranPengguna = gunakanRealtimeSubscription('pengguna', `id=eq.${id}`, segarkanJikaTidakMenyimpan);
    saluranOrangTua = gunakanRealtimeSubscription('orang_tua', `id=eq.${id}`, segarkanJikaTidakMenyimpan);
  }
});

onUnmounted(() => {
  saluranPengguna?.unsubscribe();
  saluranPengguna = null;
  saluranOrangTua?.unsubscribe();
  saluranOrangTua = null;
});

const simpanProfil = async () => {
  if (!authStore.pengguna?.id) return;
  sedangMenyimpanProfil.value = true;
  errorProfil.value = null;
  try {
    let fotoProfilBaru: string | undefined;
    if (berkasFotoBaru.value) {
      fotoProfilBaru = await unggahFotoProfil(authStore.pengguna.id, berkasFotoBaru.value);
    }

    await perbaruiProfilOrangTua({
      userId: authStore.pengguna.id,
      namaLengkap: namaLengkap.value,
      nomorTelepon: noWa.value,
      alamat: alamatDomisili.value,
      kontakDarurat: kontakDarurat.value,
      nomorWhatsapp: noWa.value,
      fotoProfil: fotoProfilBaru
    });

    if (fotoProfilBaru) {
      fotoProfilUrl.value = fotoProfilBaru;
      berkasFotoBaru.value = null;
      previewFotoUrl.value = '';
    }
    await muatProfil();
    picuToast('Profil berhasil diperbarui!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan profil.', 'error');
  } finally {
    sedangMenyimpanProfil.value = false;
  }
};

// State Password
const sandiLama = ref('');
const sandiBaru = ref('');
const konfirmasiSandi = ref('');
const sedangMengubahSandi = ref(false);

const perbaruiSandi = async () => {
  if (!sandiLama.value || !sandiBaru.value || !konfirmasiSandi.value) {
    picuToast('Silakan lengkapi seluruh kolom kata sandi', 'error');
    return;
  }
  if (sandiBaru.value !== konfirmasiSandi.value) {
    picuToast('Kata sandi baru dan konfirmasi kata sandi tidak cocok', 'error');
    return;
  }
  sedangMengubahSandi.value = true;
  try {
    await auth.perbaruiKataSandi(sandiBaru.value);
    picuToast('Kata sandi Anda berhasil diperbarui!', 'sukses');
    sandiLama.value = '';
    sandiBaru.value = '';
    konfirmasiSandi.value = '';
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui kata sandi.', 'error');
  } finally {
    sedangMengubahSandi.value = false;
  }
};

</script>

<template>
  <div class="space-y-6 relative min-h-[200px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuatProfil" pesan="Memuat profil..." />

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
        <h1 class="text-lg font-bold text-on-background tracking-tight">Profil & Pengaturan Akun</h1>
        <p class="text-xs text-on-surface-variant">Kelola informasi data diri dan ubah kata sandi.</p>
      </div>
    </div>

    <div v-if="errorProfil" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ errorProfil }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <!-- 1. Edit Data Diri -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-4 soft-shadow">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <User class="w-4.5 h-4.5 text-primary" />
            Informasi Data Diri
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
                  <Camera class="w-3.5 h-3.5" />
                  {{ fotoProfilUrl || previewFotoUrl ? 'Ganti Foto' : 'Unggah Foto' }}
                </TombolUtama>
                <p class="text-[10px] text-on-surface-variant">PNG/JPG, maksimal 5 MB.</p>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Lengkap</label>
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
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Alamat Email (Unik)</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail class="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    v-model="emailVal"
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
                    v-model="noWa"
                    required
                    placeholder="Contoh: 08123456789"
                    class="block w-full pl-10 pr-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <TombolUtama tema="terang" varian="utama" tipe="submit" :nonaktif="sedangMenyimpanProfil">
                {{ sedangMenyimpanProfil ? 'Menyimpan...' : 'Simpan Profil Baru' }}
              </TombolUtama>
            </div>
          </form>
        </div>

        <!-- 2. Ubah Kata Sandi -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-4 soft-shadow">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/20 pb-3">
            <Lock class="w-4.5 h-4.5 text-primary" />
            Ubah Kata Sandi Akun
          </h3>

          <form class="space-y-4 text-xs" @submit.prevent="perbaruiSandi">
            <div>
              <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Kata Sandi Lama</label>
              <input
                type="password"
                v-model="sandiLama"
                required
                placeholder="••••••••"
                class="block w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
              />
            </div>

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
              <TombolUtama tema="terang" varian="utama" tipe="submit" :nonaktif="sedangMengubahSandi">
                {{ sedangMengubahSandi ? 'Menyimpan...' : 'Ubah Kata Sandi' }}
              </TombolUtama>
            </div>
          </form>
        </div>
    </div>
  </div>
</template>
