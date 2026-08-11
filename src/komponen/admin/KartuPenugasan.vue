<script setup lang="ts">
import { Trash2, ShieldCheck, Eye } from 'lucide-vue-next';
import type { PenugasanHariIni } from '../../layanan/adminLayanan';

interface Props {
  penugasan: PenugasanHariIni;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'hapus', penugasan: PenugasanHariIni): void;
  (e: 'detail', penugasan: PenugasanHariIni): void;
}>();
</script>

<template>
  <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-xl space-y-4 soft-shadow flex flex-col justify-between">
    <div class="space-y-3">
      <!-- Sesi & Status Badge -->
      <div class="flex justify-between items-center text-xs">
        <span class="inline-block px-2.5 py-0.5 rounded-lg bg-brand-tosca-light border border-primary/30 text-primary font-bold font-mono text-[10px]">
          Sesi: {{ penugasan.jenisPerjalanan.toUpperCase() }}
        </span>
        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
          <ShieldCheck class="w-3.5 h-3.5" /> Terjadwal
        </span>
      </div>

      <!-- Detail Info -->
      <div class="space-y-1.5 text-xs text-on-surface-variant">
        <div>
          <span class="text-on-surface-variant font-bold uppercase text-[9px]">Sekolah/Rute Terjadwal ({{ penugasan.sekolahList.length }}):</span>
          <p class="text-on-surface font-bold">{{ penugasan.sekolahList.join(', ') || '-' }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant font-bold uppercase text-[9px]">Supir Pendamping:</span>
          <p class="text-on-surface font-bold">{{ penugasan.namaSupir }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant font-bold uppercase text-[9px]">Siswa Terdaftar ({{ penugasan.anakList.length }} Anak):</span>
          <p class="text-on-surface-variant font-medium truncate">{{ penugasan.anakList.map(a => a.nama).join(', ') }}</p>
        </div>
      </div>
    </div>

    <!-- Action footer -->
    <div class="pt-3 border-t border-outline-variant/30 flex justify-between items-center">
      <span class="text-[10px] text-on-surface-variant font-mono">Tgl: {{ penugasan.tanggal }}</span>
      <div class="flex items-center gap-2">
        <button
          @click="emit('detail', penugasan)"
          class="text-primary hover:text-primary/80 p-1.5 border border-primary/30 rounded bg-primary-container/10 hover:bg-primary-container/20 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
          title="Lihat Detail Penugasan"
        >
          <Eye class="w-3.5 h-3.5" /> Lihat Detail
        </button>
        <button
          @click="emit('hapus', penugasan)"
          class="text-rose-600 hover:text-rose-700 p-1.5 border border-rose-200 rounded bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
          title="Batalkan Penugasan"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
