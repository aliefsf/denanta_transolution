<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Star } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import { ambilPenilaianUntukPerjalanan, kirimPenilaian } from '../../layanan/orangTuaLayanan';
import { useAuthStore } from '../../penyimpanan/authStore';

interface Props {
  namaSupir: string;
  supirId?: string | null;
  perjalananId?: string | null;
}

const props = defineProps<Props>();
const authStore = useAuthStore();

const ratingTerpilih = ref(0);
const ratingHover = ref(0);
const komentarReview = ref('');
const sudahDikirim = ref(false);
const sedangMengirim = ref(false);
const sedangMemeriksa = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  if (!props.perjalananId || !authStore.pengguna?.id) return;
  sedangMemeriksa.value = true;
  try {
    const existing = await ambilPenilaianUntukPerjalanan(authStore.pengguna.id, props.perjalananId);
    if (existing) {
      ratingTerpilih.value = existing.bintang;
      komentarReview.value = existing.komentar || '';
      sudahDikirim.value = true;
    }
  } catch {
    // Biarkan form kosong bila gagal memeriksa penilaian yang sudah ada
  } finally {
    sedangMemeriksa.value = false;
  }
});

const setRating = (star: number) => {
  ratingTerpilih.value = star;
};

const kirimUlasan = async () => {
  if (ratingTerpilih.value === 0) return;

  if (!props.perjalananId || !props.supirId || !authStore.pengguna?.id) {
    error.value = 'Belum ada perjalanan aktif untuk dinilai.';
    return;
  }

  sedangMengirim.value = true;
  error.value = null;
  try {
    await kirimPenilaian({
      orangTuaId: authStore.pengguna.id,
      supirId: props.supirId,
      perjalananId: props.perjalananId,
      bintang: ratingTerpilih.value,
      komentar: komentarReview.value
    });
    sudahDikirim.value = true;
  } catch (err: any) {
    error.value = err.message || 'Gagal mengirim penilaian. Silakan coba lagi.';
  } finally {
    sedangMengirim.value = false;
  }
};
</script>

<template>
  <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-60"></div>

    <div class="relative z-10 space-y-3">
      <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
        <Star class="w-4 h-4 text-amber-500 fill-amber-500" />
        Beri Nilai Supir ({{ namaSupir }})
      </h3>
      <p class="text-xs text-on-surface-variant">Ulasan Anda membantu kami menjaga standar keselamatan berkendara.</p>

      <div v-if="error" class="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
        {{ error }}
      </div>

      <div v-if="!sudahDikirim && !sedangMemeriksa" class="space-y-4 pt-1">
        <!-- Interactive Star Selection -->
        <div class="flex items-center gap-2 justify-center py-2">
          <button
            v-for="star in 5"
            :key="star"
            type="button"
            @click="setRating(star)"
            @mouseover="ratingHover = star"
            @mouseleave="ratingHover = 0"
            class="text-on-surface-variant hover:text-amber-500 transition-colors focus:outline-none cursor-pointer"
          >
            <Star
              class="w-8 h-8 transition-transform duration-150 active:scale-125"
              :class="{
                'text-amber-500 fill-amber-500': (ratingHover || ratingTerpilih) >= star,
                'text-outline-variant': (ratingHover || ratingTerpilih) < star
              }"
            />
          </button>
        </div>

        <!-- Review Comment Text Area -->
        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Komentar / Masukan (Opsional)</label>
          <textarea
            rows="2"
            v-model="komentarReview"
            placeholder="Supir sangat hati-hati dan tepat waktu..."
            class="w-full text-xs px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          ></textarea>
        </div>

        <TombolUtama
          tema="terang"
          varian="utama"
          class="w-full text-xs py-2"
          :nonaktif="ratingTerpilih === 0 || sedangMengirim"
          @click="kirimUlasan"
        >
          {{ sedangMengirim ? 'Mengirim...' : 'Kirim Penilaian' }}
        </TombolUtama>
      </div>

      <!-- Success Feedback View -->
      <div v-else-if="sudahDikirim" class="text-center py-6 space-y-2">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
          ✓
        </div>
        <p class="text-xs font-bold text-on-surface">Ulasan Berhasil Dikirim!</p>
        <p class="text-[10px] text-on-surface-variant">Terima kasih atas kontribusi ulasan berharga Anda.</p>
      </div>
    </div>
  </div>
</template>
