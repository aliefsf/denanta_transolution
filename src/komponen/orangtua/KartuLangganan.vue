<script setup lang="ts">
import { ShieldCheck, Calendar, CreditCard, Users } from 'lucide-vue-next';
import { formatMataUang } from '../../bantuan/formatMataUang';

interface Props {
  jenisLayanan: string;
  totalBiaya: number;
  sisaHari: number;
  jumlahAnak: number;
  jatohTempo: string;
}

defineProps<Props>();
</script>

<template>
  <div class="bg-gradient-to-br from-warnaSekunder to-warnaUtama border border-warnaAksen/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-warnaTombol/10 via-transparent to-transparent opacity-60"></div>
    
    <div class="flex justify-between items-start gap-4 relative z-10">
      <div class="space-y-1">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
          <ShieldCheck class="w-3.5 h-3.5" />
          Langganan Aktif
        </span>
        <h3 class="text-lg font-extrabold text-white pt-1">{{ jenisLayanan }}</h3>
      </div>
      <div class="text-right">
        <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Biaya Bulanan</p>
        <p class="text-2xl font-black text-warnaTombol tracking-wide">{{ formatMataUang(totalBiaya) }}</p>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-warnaAksen/20 relative z-10 text-xs">
      <div class="space-y-1">
        <p class="text-slate-400 flex items-center gap-1"><Users class="w-3.5 h-3.5 text-warnaTombol" /> Anak Terdaftar</p>
        <p class="text-slate-200 font-bold">{{ jumlahAnak }} Anak</p>
      </div>
      <div class="space-y-1">
        <p class="text-slate-400 flex items-center gap-1"><Calendar class="w-3.5 h-3.5 text-warnaTombol" /> Masa Aktif</p>
        <p class="text-slate-200 font-bold">{{ sisaHari }} Hari Lagi</p>
      </div>
      <div class="space-y-1">
        <p class="text-slate-400 flex items-center gap-1"><CreditCard class="w-3.5 h-3.5 text-warnaTombol" /> Jatuh Tempo</p>
        <p class="text-slate-200 font-bold">{{ jatohTempo }}</p>
      </div>
    </div>
  </div>
</template>
