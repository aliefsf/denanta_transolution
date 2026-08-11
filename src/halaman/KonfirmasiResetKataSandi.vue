<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../komposabel/useAuth';
import { KeyRound, AlertTriangle, CheckCircle, Loader2, Eye, EyeOff, XCircle } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuth();

// Halaman ini butuh sesi harus SIAP DIPAKAI sebelum tombol submit boleh
// ditekan -- kalau tidak, updateUser() (perbaruiKataSandi) bisa mengirim
// permintaan sebelum sesi recovery-nya benar-benar aktif.
const sesiSiap = ref(false);

const kataSandiBaru = ref('');
const konfirmasiSandi = ref('');
const tunjukkanSandi = ref(false);
const errorPesan = ref<string | null>(null);
const suksesUpdate = ref(false);
const sedangLoading = ref(false);

// Supabase mengembalikan pengguna ke halaman ini dengan parameter error di
// URL hash (mis. #error=access_denied&error_code=otp_expired) kalau tautan
// reset kata sandi yang diklik sudah kedaluwarsa/tidak valid -- SEBELUMNYA
// halaman ini tetap menampilkan form seolah normal walau sesi reset-nya
// sebenarnya tidak pernah terbentuk, baru gagal membingungkan setelah
// pengguna submit. Dicek sekali di awal supaya bisa langsung menampilkan
// pesan yang jelas & tautan untuk minta reset baru.
const tautanKedaluwarsa = ref(false);

onMounted(async () => {
  const hash = window.location.hash;
  if (hash.includes('error=') || hash.includes('error_code=')) {
    tautanKedaluwarsa.value = true;
    return;
  }
  if (!hash.includes('access_token')) {
    // Halaman dibuka bukan lewat tautan email reset yang valid sama sekali.
    tautanKedaluwarsa.value = true;
    return;
  }

  // JANGAN memanggil setSession()/getSession() manual di sini -- supabase-js
  // (detectSessionInUrl: true, bawaan) SUDAH otomatis memproses
  // access_token/refresh_token di URL hash ini sendiri saat client dibuat
  // (src/layanan/supabase.ts, sebelum komponen ini sempat mount). Sempat
  // dicoba menetapkan sesi manual di sini (setSession) sebagai percobaan
  // sebelumnya -- hasilnya malah request updateUser() berikutnya jadi
  // menggantung (dua proses auth berjalan bersamaan/saling tumpang tindih).
  // Solusi yang benar: cukup TUNGGU proses bootstrap sesi aplikasi (yang
  // sudah menunggu deteksi otomatis itu selesai) lewat tungguSesiAwal(),
  // lihat catatan lengkapnya di useAuth.ts.
  await auth.tungguSesiAwal();

  // Kalau setelah bootstrap selesai TETAP tidak ada sesi aktif, berarti
  // tautannya memang tidak valid (mis. sudah pernah dipakai sebelumnya).
  if (!auth.isAuthenticated.value) {
    tautanKedaluwarsa.value = true;
    return;
  }

  // Bersihkan token dari address bar -- baik alasan keamanan (jangan
  // sampai tertinggal di riwayat browser) maupun kerapian URL.
  window.history.replaceState(null, '', window.location.pathname);
  sesiSiap.value = true;
});

const tanganiResetPassword = async () => {
  if (!kataSandiBaru.value || !konfirmasiSandi.value) {
    errorPesan.value = 'Silakan isi kata sandi baru Anda';
    return;
  }

  if (kataSandiBaru.value !== konfirmasiSandi.value) {
    errorPesan.value = 'Kata sandi baru dan konfirmasi tidak cocok';
    return;
  }

  if (kataSandiBaru.value.length < 6) {
    errorPesan.value = 'Kata sandi minimal harus 6 karakter';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    await auth.perbaruiKataSandi(kataSandiBaru.value);
    suksesUpdate.value = true;

    // Auto redirect ke login setelah 3 detik
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  } catch (err: any) {
    console.error('[perbaruiKataSandi] Error asli:', err);
    errorPesan.value = err.message || 'Gagal memperbarui kata sandi baru Anda';
  } finally {
    sedangLoading.value = false;
  }
};
</script>

<template>
  <div class="bg-pattern-radial min-h-screen text-on-surface font-body-md antialiased relative flex flex-col items-center justify-center p-6 md:p-8">

    <!-- Background Gradient Pattern (Frame Style) -->
    <div class="fixed top-0 left-0 w-full h-full z-0 pointer-events-none bg-pattern-radial-gradient"></div>

    <main class="relative z-10 w-full max-w-[400px]">

      <!-- STATE: Tautan Kedaluwarsa/Tidak Valid -->
      <div v-if="tautanKedaluwarsa" class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col items-center text-center gap-4">
        <div class="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center text-[#E24B4A]">
          <XCircle class="w-8 h-8" />
        </div>
        <h1 class="font-headline-md text-headline-md text-on-surface">Tautan Sudah Tidak Berlaku</h1>
        <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Tautan atur ulang kata sandi ini sudah kedaluwarsa atau sudah pernah dipakai. Silakan minta tautan baru dari halaman Masuk.
        </p>
        <router-link to="/login" class="w-full">
          <button type="button" class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors cursor-pointer border-0 shadow-sm mt-2">
            Kembali ke Halaman Masuk
          </button>
        </router-link>
      </div>

      <!-- STATE: Berhasil -->
      <div v-else-if="suksesUpdate" class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col items-center text-center gap-4">
        <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-solid border-emerald-300">
          <CheckCircle class="w-8 h-8" />
        </div>
        <h1 class="font-headline-md text-headline-md text-on-surface">Kata Sandi Berhasil Diperbarui!</h1>
        <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Kata sandi Anda telah berhasil diubah. Anda akan diarahkan kembali ke halaman Masuk dalam beberapa saat...
        </p>
        <router-link to="/login" class="w-full">
          <button type="button" class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors cursor-pointer border-0 shadow-sm mt-2">
            Masuk Sekarang
          </button>
        </router-link>
      </div>

      <!-- STATE: Memeriksa Tautan (menetapkan sesi recovery, sekilas) -->
      <div v-else-if="!sesiSiap" class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-8 flex flex-col items-center text-center gap-3">
        <Loader2 class="w-8 h-8 text-primary-container animate-spin" />
        <p class="text-sm text-on-surface-variant">Memeriksa tautan...</p>
      </div>

      <!-- STATE: Form Atur Ulang -->
      <div v-else class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden text-left">

        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Menyimpan kata sandi baru...</p>
            <p class="text-xs text-on-surface-variant">Proses ini kadang butuh waktu hingga 30 detik, mohon tunggu</p>
          </div>
        </div>

        <!-- Header -->
        <div class="flex flex-col items-center text-center gap-4">
          <div class="w-16 h-16 bg-[#e6f7f4] rounded-full flex items-center justify-center text-primary-container mb-2">
            <KeyRound class="w-8 h-8 text-primary-container" />
          </div>
          <h1 class="font-headline-md text-headline-md text-on-surface">Atur Ulang Kata Sandi</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Masukkan kata sandi baru untuk akun Anda
          </p>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="bg-[#FCEBEB] text-[#E24B4A] p-3.5 rounded-[12px] border border-solid border-[#F8C6C6] flex items-start gap-2.5 font-body-md text-body-md">
          <AlertTriangle class="w-5 h-5 text-[#E24B4A] flex-shrink-0 mt-0.5" />
          <p class="leading-normal">{{ errorPesan }}</p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="tanganiResetPassword">
          <!-- Password Field -->
          <div class="flex flex-col gap-2">
            <label for="password" class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Kata Sandi Baru</label>
            <div class="relative">
              <KeyRound class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="password"
                :type="tunjukkanSandi ? 'text' : 'password'"
                required
                v-model="kataSandiBaru"
                placeholder="Minimal 6 karakter"
                class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[12px] py-3 pl-11 pr-11 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors"
              />
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors bg-transparent border-0 cursor-pointer p-0"
                @click="tunjukkanSandi = !tunjukkanSandi"
              >
                <EyeOff v-if="tunjukkanSandi" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Confirm Password Field -->
          <div class="flex flex-col gap-2">
            <label for="konfirmasiSandi" class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Konfirmasi Kata Sandi Baru</label>
            <div class="relative">
              <KeyRound class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="konfirmasiSandi"
                :type="tunjukkanSandi ? 'text' : 'password'"
                required
                v-model="konfirmasiSandi"
                placeholder="Ulangi kata sandi baru"
                class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[12px] py-3 pl-11 pr-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors cursor-pointer border-0 shadow-sm mt-2"
          >
            Perbarui Kata Sandi
          </button>
        </form>
      </div>

    </main>

  </div>
</template>

<style scoped>
/* Latar belakang radial tosca khas alur login/reset kata sandi */
.bg-pattern-radial-gradient {
  background-color: #F5FBFA;
  background-image:
    radial-gradient(circle at 15% 20%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%),
    radial-gradient(circle at 85% 80%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%);
}
</style>
