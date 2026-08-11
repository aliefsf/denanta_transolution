<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import {
  MailCheck, AlertTriangle, Loader2, CheckCircle, ArrowLeft
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = (route.query.email as string) || '';
const tujuanSetelahVerifikasi = route.query.lanjut === 'berlangganan' ? '/berlangganan' : '/';

// Tanpa email tujuan, halaman ini tidak punya konteks apa pun -- kembalikan
// ke halaman daftar alih-alih menampilkan form yang tidak bisa dipakai.
onMounted(() => {
  if (!email) {
    router.replace('/daftar');
  }
});

const kodeOtp = ref('');
const errorPesan = ref<string | null>(null);
const suksesPesan = ref<string | null>(null);
const sedangLoading = ref(false);
const sedangKirimUlang = ref(false);

// Pembatasan percobaan input di sisi tampilan -- validitas/kedaluwarsa/
// sekali-pakai kode OTP itu sendiri tetap ditegakkan oleh Supabase di
// server, ini murni supaya pengguna tidak spam coba kode acak berkali-kali.
const percobaanGagal = ref(0);
const BATAS_PERCOBAAN = 5;
const terkunci = computed(() => percobaanGagal.value >= BATAS_PERCOBAAN);

// Cooldown tombol "Kirim Ulang Kode" (detik)
const cooldown = ref(0);
let timerId: ReturnType<typeof setInterval> | null = null;

function mulaiCooldown(detik: number) {
  cooldown.value = detik;
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }, 1000);
}

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});

const tanganiVerifikasi = async () => {
  if (terkunci.value) return;
  if (!kodeOtp.value || kodeOtp.value.trim().length < 4) {
    errorPesan.value = 'Masukkan kode OTP yang dikirim ke email Anda';
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;

  try {
    await authStore.verifikasiOtpPendaftaran(email, kodeOtp.value.trim());
    suksesPesan.value = 'Verifikasi berhasil! Akun Anda kini aktif.';
    setTimeout(() => {
      router.push(tujuanSetelahVerifikasi);
    }, 1200);
  } catch (err: any) {
    percobaanGagal.value += 1;
    if (terkunci.value) {
      errorPesan.value = 'Terlalu banyak percobaan gagal. Silakan minta kode OTP baru.';
    } else {
      errorPesan.value = err.message || 'Kode OTP salah atau sudah kedaluwarsa';
    }
  } finally {
    sedangLoading.value = false;
  }
};

const tanganiKirimUlang = async () => {
  if (cooldown.value > 0 || sedangKirimUlang.value) return;

  sedangKirimUlang.value = true;
  errorPesan.value = null;
  suksesPesan.value = null;

  try {
    await authStore.kirimUlangOtpPendaftaran(email);
    percobaanGagal.value = 0;
    kodeOtp.value = '';
    suksesPesan.value = 'Kode OTP baru telah dikirim ke email Anda.';
    mulaiCooldown(60);
  } catch (err: any) {
    errorPesan.value = err.message || 'Gagal mengirim ulang kode OTP';
  } finally {
    sedangKirimUlang.value = false;
  }
};
</script>

<template>
  <div class="bg-pattern-radial min-h-screen text-on-surface font-body-md antialiased relative flex flex-col items-center justify-center p-6 md:p-8">
    <div class="fixed top-0 left-0 w-full h-full z-0 pointer-events-none bg-pattern-radial-gradient"></div>

    <main class="relative z-10 w-full max-w-[400px]">
      <div class="bg-surface-container-lowest border border-solid border-outline-variant/30 rounded-[20px] custom-shadow p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden text-left">

        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-primary-container animate-spin mx-auto" />
            <p class="text-xs text-primary-container font-semibold">Memverifikasi Kode...</p>
          </div>
        </div>

        <!-- Success overlay -->
        <div v-if="suksesPesan && suksesPesan.startsWith('Verifikasi')" class="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 z-30 text-center gap-4">
          <div class="inline-flex items-center justify-center p-4 bg-emerald-100 text-emerald-600 rounded-full border border-solid border-emerald-300">
            <CheckCircle class="w-12 h-12" />
          </div>
          <h3 class="text-xl font-bold text-on-surface">Berhasil!</h3>
          <p class="text-sm text-slate-500 max-w-xs leading-relaxed">{{ suksesPesan }}</p>
        </div>

        <div class="flex flex-col items-center text-center gap-4">
          <div class="w-16 h-16 bg-[#e6f7f4] rounded-full flex items-center justify-center text-primary-container mb-2">
            <MailCheck class="w-8 h-8 text-primary-container" />
          </div>
          <h1 class="font-headline-md text-headline-md text-on-surface">Verifikasi Email Anda</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Kode OTP telah dikirim ke email
            <span class="font-semibold text-on-surface">{{ email }}</span>.
            Silakan masukkan kode tersebut untuk melanjutkan proses registrasi.
          </p>
          <p class="font-body-md text-xs text-on-surface-variant">
            Kode OTP berlaku selama <span class="font-semibold">5 menit</span>. Jika sudah kedaluwarsa, silakan minta kode baru.
          </p>
        </div>

        <!-- Alert Error -->
        <div v-if="errorPesan" class="bg-[#FCEBEB] text-[#E24B4A] p-3.5 rounded-[12px] border border-solid border-[#F8C6C6] flex items-start gap-2.5 font-body-md text-body-md">
          <AlertTriangle class="w-5 h-5 text-[#E24B4A] flex-shrink-0 mt-0.5" />
          <p class="leading-normal">{{ errorPesan }}</p>
        </div>

        <!-- Alert Sukses (kirim ulang) -->
        <div v-if="suksesPesan && !suksesPesan.startsWith('Verifikasi')" class="bg-emerald-50 text-emerald-700 p-3.5 rounded-[12px] border border-solid border-emerald-200 flex items-start gap-2.5 font-body-md text-body-md">
          <CheckCircle class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p class="leading-normal">{{ suksesPesan }}</p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="tanganiVerifikasi">
          <div class="flex flex-col gap-2">
            <label class="font-label-md text-label-md text-on-surface uppercase tracking-wider">Kode OTP</label>
            <input
              v-model="kodeOtp"
              required
              maxlength="10"
              inputmode="numeric"
              autocomplete="one-time-code"
              :disabled="terkunci"
              class="w-full bg-surface-bright border border-solid border-outline-variant rounded-[12px] py-3 px-4 text-center tracking-[0.5em] font-semibold text-lg text-on-surface placeholder:text-outline placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Masukkan kode OTP"
            />
          </div>

          <button
            type="submit"
            :disabled="terkunci"
            class="w-full bg-primary-container hover:bg-primary text-on-primary rounded-[12px] py-3 font-semibold text-sm transition-colors mt-1 cursor-pointer border-0 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verifikasi
          </button>
        </form>

        <p class="font-body-md text-body-md text-center text-on-surface-variant">
          Tidak menerima kode?
          <a
            class="text-primary-container font-semibold hover:text-primary transition-colors"
            :class="cooldown > 0 || sedangKirimUlang ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:underline'"
            @click="tanganiKirimUlang"
          >
            Kirim ulang{{ cooldown > 0 ? ` (${cooldown}s)` : '' }}
          </a>
        </p>

        <div class="flex justify-center">
          <router-link
            to="/daftar"
            class="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant hover:text-primary-container transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
            <span>Kembali ke Registrasi</span>
          </router-link>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.bg-pattern-radial-gradient {
  background-color: #F5FBFA;
  background-image:
    radial-gradient(circle at 15% 20%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%),
    radial-gradient(circle at 85% 80%, rgba(20, 163, 139, 0.05) 0%, rgba(20, 163, 139, 0) 40%);
}
</style>
