<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  tampil: boolean;
  judul?: string;
  ukuran?: 'sedang' | 'lebar' | 'penuh';
  // 'gelap' dipakai halaman dengan tema lama (Orang Tua/Supir), 'terang'
  // dipakai halaman dengan palet Material terang (Admin, Berlangganan, dst).
  tema?: 'gelap' | 'terang';
}

const props = withDefaults(defineProps<Props>(), {
  ukuran: 'sedang',
  tema: 'gelap',
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
          class="relative border rounded-2xl shadow-2xl overflow-hidden w-full transition-all duration-300"
          :class="[
            tema === 'terang' ? 'bg-surface-container-lowest border-outline-variant/40' : 'bg-warnaSekunder border-warnaAksen/40',
            {
              'max-w-md': ukuran === 'sedang',
              'max-w-2xl': ukuran === 'lebar',
              'max-w-5xl': ukuran === 'penuh'
            }
          ]"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b"
            :class="tema === 'terang' ? 'border-outline-variant/30' : 'border-warnaAksen/30'"
          >
            <slot name="header">
              <h3 class="text-lg font-bold tracking-wide" :class="tema === 'terang' ? 'text-on-surface' : 'text-white'">{{ judul }}</h3>
            </slot>
            <button
              @click="tutupModal"
              class="transition-colors duration-200 text-2xl font-light focus:outline-none cursor-pointer"
              :class="tema === 'terang' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-400 hover:text-white'"
            >
              &times;
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 max-h-[75vh] overflow-y-auto">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 border-t flex justify-end gap-3"
            :class="tema === 'terang' ? 'bg-surface-container border-outline-variant/30' : 'bg-warnaUtama/30 border-warnaAksen/20'"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
