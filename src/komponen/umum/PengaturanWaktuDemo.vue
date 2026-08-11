<script setup lang="ts">
// Widget KHUSUS DEV/DEMO -- tidak pernah muncul di build produksi
// (dibungkus import.meta.env.DEV di App.vue). Memungkinkan menggeser
// "waktu sekarang" yang dipakai seluruh logika bisnis sensitif-waktu
// (jendela absensi, kuota perubahan jadwal, dst. -- lihat
// src/bantuan/waktuSimulasi.ts) tanpa perlu mengubah jam sistem Windows,
// yang sering gagal karena Windows otomatis sinkron ulang lewat NTP.
import { ref, onMounted } from 'vue';
import { Clock, X } from 'lucide-vue-next';
import { ambilWaktuSekarang, apakahWaktuSimulasiAktif, aturWaktuSimulasi, resetWaktuSimulasi } from '../../bantuan/waktuSimulasi';

const terbuka = ref(false);
const aktif = ref(false);
const nilaiInput = ref('');

// Format value yg dibutuhkan <input type="datetime-local">: "YYYY-MM-DDTHH:mm"
function keInputDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  aktif.value = apakahWaktuSimulasiAktif();
  nilaiInput.value = keInputDatetimeLocal(ambilWaktuSekarang());
});

// PENTING: banyak komponen (JadwalOrangTua.vue, AbsensiSupir.vue,
// PenugasanAdmin.vue, dst.) menghitung tanggal/jendela waktu aktif HANYA
// SEKALI saat halaman dibuka (onMounted / const biasa, bukan computed yang
// terus mengikuti localStorage) -- mengganti offset di localStorage saja
// TIDAK membuat halaman yang sudah terlanjur ter-render otomatis menghitung
// ulang. Solusi paling sederhana & pasti benar: muat ulang seluruh halaman
// begitu simulasi diterapkan/direset, supaya semua komponen mulai dari nol
// dengan waktu yang baru.
const terapkan = () => {
  if (!nilaiInput.value) return;
  aturWaktuSimulasi(new Date(nilaiInput.value));
  window.location.reload();
};

const reset = () => {
  resetWaktuSimulasi();
  window.location.reload();
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999] font-sans">
    <button
      v-if="!terbuka"
      type="button"
      @click="terbuka = true"
      class="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border text-[11px] font-bold cursor-pointer transition-colors"
      :class="aktif ? 'bg-amber-500 border-amber-600 text-white' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'"
    >
      <Clock class="w-3.5 h-3.5" />
      {{ aktif ? 'Waktu Disimulasikan' : 'Simulasi Waktu (Dev)' }}
    </button>

    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72 space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
          <Clock class="w-4 h-4 text-amber-600" /> Simulasi Waktu (Dev)
        </h4>
        <button type="button" @click="terbuka = false" class="text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-0 p-0.5">
          <X class="w-4 h-4" />
        </button>
      </div>
      <p class="text-[10px] text-slate-500 leading-relaxed">
        Mengganti "waktu sekarang" yang dipakai aplikasi (jendela absensi, kuota jadwal, dst.) tanpa mengubah jam sistem. Tersimpan per-browser (localStorage), tidak memengaruhi timestamp di database.
      </p>
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Atur ke tanggal/jam:</label>
        <input
          type="datetime-local"
          v-model="nilaiInput"
          class="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          @click="terapkan"
          class="flex-1 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold cursor-pointer border-0 transition-colors"
        >
          Terapkan
        </button>
        <button
          type="button"
          @click="reset"
          class="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer border-0 transition-colors"
        >
          Reset ke Asli
        </button>
      </div>
      <p v-if="aktif" class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
        Simulasi aktif. Jam tetap berjalan maju dari titik ini.
      </p>
    </div>
  </div>
</template>
