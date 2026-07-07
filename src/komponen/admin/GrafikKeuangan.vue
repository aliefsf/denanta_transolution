<script setup lang="ts">
// Simple SVG financial overview chart
</script>

<template>
  <div class="space-y-4">
    <div class="h-44 w-full">
      <svg viewBox="0 0 500 150" class="w-full h-full">
        <!-- Grid lines -->
        <line x1="50" y1="20" x2="450" y2="20" stroke="#16213e" stroke-width="1"/>
        <line x1="50" y1="70" x2="450" y2="70" stroke="#16213e" stroke-width="1"/>
        <line x1="50" y1="120" x2="450" y2="120" stroke="#16213e" stroke-width="1"/>

        <!-- Bars: Pemasukan (Emerald) vs Pengeluaran (Rose) -->
        <!-- Mei -->
        <rect x="80" y="50" width="14" height="70" rx="2" fill="#10b981" />
        <rect x="96" y="80" width="14" height="40" rx="2" fill="#ef4444" />

        <!-- Juni -->
        <rect x="200" y="40" width="14" height="80" rx="2" fill="#10b981" />
        <rect x="216" y="75" width="14" height="45" rx="2" fill="#ef4444" />

        <!-- Juli -->
        <rect x="320" y="30" width="14" height="90" rx="2" fill="#10b981" />
        <rect x="336" y="70" width="14" height="50" rx="2" fill="#ef4444" />

        <!-- Labels -->
        <text x="95" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Mei</text>
        <text x="215" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Juni</text>
        <text x="335" y="140" fill="#94a3b8" font-size="9" text-anchor="middle" font-weight="bold">Juli</text>
      </svg>
    </div>

    <!-- Legend -->
    <div class="flex justify-center gap-6 text-[10px] text-slate-400">
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500 inline-block"></span> Total Pemasukan</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-rose-500 inline-block"></span> Total Pengeluaran</span>
    </div>
  </div>
</template>
