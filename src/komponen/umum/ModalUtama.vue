<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  tampil: boolean;
  judul?: string;
  ukuran?: 'sedang' | 'lebar' | 'penuh';
}

const props = withDefaults(defineProps<Props>(), {
  ukuran: 'sedang',
});

const emit = defineEmits<{
  (e: 'tutup'): void;
}>();

const tutupModal = () => {
  emit('tutup');
};

const tanganiEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.tampil) {
    tutupModal();
  }
};

onMounted(() => {
  window.addEventListener('keydown', tanganiEsc);
});

onUnmounted(() => {
  window.removeEventListener('keydown', tanganiEsc);
});
</script>

<template>
  <Teleport to="body">
    <!-- Overlay & Container -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="tampil" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        <!-- Latar belakang gelap transparan -->
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" @click="tutupModal"></div>

        <!-- Konten Modal -->
        <div
          class="relative bg-warnaSekunder border border-warnaAksen/40 rounded-2xl shadow-2xl overflow-hidden w-full transition-all duration-300"
          :class="{
            'max-w-md': ukuran === 'sedang',
            'max-w-2xl': ukuran === 'lebar',
            'max-w-5xl': ukuran === 'penuh'
          }"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-warnaAksen/30">
            <slot name="header">
              <h3 class="text-lg font-bold text-white tracking-wide">{{ judul }}</h3>
            </slot>
            <button
              @click="tutupModal"
              class="text-slate-400 hover:text-white transition-colors duration-200 text-2xl font-light focus:outline-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 max-h-[75vh] overflow-y-auto">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-4 bg-warnaUtama/30 border-t border-warnaAksen/20 flex justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
