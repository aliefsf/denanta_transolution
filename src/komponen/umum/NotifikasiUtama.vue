<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-vue-next';

interface Props {
  tampil: boolean;
  pesan: string;
  tipe?: 'sukses' | 'error' | 'info';
  durasiMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tampil: false,
  tipe: 'info',
  durasiMs: 4000,
});

const emit = defineEmits<{
  (e: 'tutup'): void;
}>();

const tutup = () => {
  emit('tutup');
};

let timer: any = null;

const mulaiTimer = () => {
  if (timer) clearTimeout(timer);
  if (props.tampil) {
    timer = setTimeout(() => {
      tutup();
    }, props.durasiMs);
  }
};

onMounted(() => {
  mulaiTimer();
});

watch(() => props.tampil, () => {
  mulaiTimer();
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tampil"
        class="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm z-[9999] bg-warnaSekunder border rounded-xl shadow-2xl pointer-events-auto overflow-hidden flex items-stretch"
        :class="{
          'border-emerald-500/40': tipe === 'sukses',
          'border-rose-500/40': tipe === 'error',
          'border-warnaAksen/50': tipe === 'info'
        }"
      >
        <!-- Icon section with dynamic side color -->
        <div
          class="w-12 flex items-center justify-center text-white"
          :class="{
            'bg-emerald-600': tipe === 'sukses',
            'bg-rose-600': tipe === 'error',
            'bg-warnaAksen': tipe === 'info'
          }"
        >
          <CheckCircle v-if="tipe === 'sukses'" class="w-5 h-5" />
          <AlertCircle v-else-if="tipe === 'error'" class="w-5 h-5" />
          <Info v-else class="w-5 h-5" />
        </div>

        <!-- Content section -->
        <div class="flex-grow p-4 flex items-center justify-between">
          <p class="text-sm text-slate-200 pr-4 leading-relaxed">{{ pesan }}</p>
          <button
            @click="tutup"
            class="text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
