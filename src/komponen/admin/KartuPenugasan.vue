<script setup lang="ts">
import { Trash2, ShieldCheck } from 'lucide-vue-next';

interface Props {
  penugasan: any;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'hapus', id: string): void;
}>();
</script>

<template>
  <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow flex flex-col justify-between">
    <div class="space-y-3">
      <!-- Sesi & Status Badge -->
      <div class="flex justify-between items-center text-xs">
        <span class="inline-block px-2.5 py-0.5 rounded-lg bg-warnaAksen/40 border border-warnaAksen text-white font-bold font-mono text-[10px]">
          Sesi: {{ penugasan.sesi.toUpperCase() }}
        </span>
        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
          <ShieldCheck class="w-3.5 h-3.5" /> Terkirim WA
        </span>
      </div>

      <!-- Detail Info -->
      <div class="space-y-1.5 text-xs text-slate-300">
        <div>
          <span class="text-slate-500 font-bold uppercase text-[9px]">Sekolah Asal/Tujuan:</span>
          <p class="text-white font-bold">{{ penugasan.sekolah }}</p>
        </div>
        <div>
          <span class="text-slate-500 font-bold uppercase text-[9px]">Supir Pendamping:</span>
          <p class="text-white font-bold">{{ penugasan.supir }}</p>
        </div>
        <div>
          <span class="text-slate-500 font-bold uppercase text-[9px]">Siswa Terdaftar ({{ penugasan.anakList.length }} Anak):</span>
          <p class="text-slate-400 font-medium truncate">{{ penugasan.anakList.join(', ') }}</p>
        </div>
      </div>
    </div>

    <!-- Action footer -->
    <div class="pt-3 border-t border-warnaAksen/20 flex justify-between items-center">
      <span class="text-[10px] text-slate-500 font-mono">Tgl: {{ penugasan.tanggal }}</span>
      <button 
        @click="emit('hapus', penugasan.id)"
        class="text-rose-400 hover:text-rose-300 p-1.5 border border-rose-500/10 rounded bg-rose-500/5 hover:bg-rose-500/20 transition-colors cursor-pointer"
        title="Batalkan Penugasan"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
