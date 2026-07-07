<script setup lang="ts">
import { ref } from 'vue';
import { Star } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';

interface Props {
  namaSupir: string;
}

defineProps<Props>();

const ratingTerpilih = ref(0);
const ratingHover = ref(0);
const komentarReview = ref('');
const sudahDikirim = ref(false);

const setRating = (star: number) => {
  ratingTerpilih.value = star;
};

const kirimUlasan = () => {
  if (ratingTerpilih.value === 0) return;
  sudahDikirim.value = true;
};
</script>

<template>
  <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-warnaTombol/5 via-transparent to-transparent opacity-60"></div>
    
    <div class="relative z-10 space-y-3">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
        <Star class="w-4 h-4 text-warnaTombol fill-warnaTombol" />
        Beri Nilai Supir ({{ namaSupir }})
      </h3>
      <p class="text-xs text-slate-400">Ulasan Anda membantu kami menjaga standar keselamatan berkendara.</p>

      <div v-if="!sudahDikirim" class="space-y-4 pt-1">
        <!-- Interactive Star Selection -->
        <div class="flex items-center gap-2 justify-center py-2">
          <button
            v-for="star in 5"
            :key="star"
            type="button"
            @click="setRating(star)"
            @mouseover="ratingHover = star"
            @mouseleave="ratingHover = 0"
            class="text-slate-500 hover:text-amber-400 transition-colors focus:outline-none cursor-pointer"
          >
            <Star 
              class="w-8 h-8 transition-transform duration-150 active:scale-125"
              :class="{
                'text-amber-400 fill-amber-400': (ratingHover || ratingTerpilih) >= star,
                'text-slate-600': (ratingHover || ratingTerpilih) < star
              }"
            />
          </button>
        </div>

        <!-- Review Comment Text Area -->
        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Komentar / Masukan (Opsional)</label>
          <textarea 
            rows="2" 
            v-model="komentarReview" 
            placeholder="Supir sangat hati-hati dan tepat waktu..."
            class="w-full text-xs px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol"
          ></textarea>
        </div>

        <TombolUtama 
          varian="utama" 
          class="w-full text-xs py-2" 
          :disabled="ratingTerpilih === 0"
          @click="kirimUlasan"
        >
          Kirim Penilaian
        </TombolUtama>
      </div>

      <!-- Success Feedback View -->
      <div v-else class="text-center py-6 space-y-2">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
          ✓
        </div>
        <p class="text-xs font-bold text-white">Ulasan Berhasil Dikirim!</p>
        <p class="text-[10px] text-slate-400">Terima kasih atas kontribusi ulasan berharga Anda.</p>
      </div>
    </div>
  </div>
</template>
