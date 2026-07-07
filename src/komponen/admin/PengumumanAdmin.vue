<script setup lang="ts">
import { ref } from 'vue';
import { Megaphone, Send } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Form State
const targetPenerima = ref('semua');
const subjekPengumuman = ref('');
const isiPesan = ref('');
const kirimWa = ref(true);
const jadwalKirim = ref('');

const kirimPengumuman = () => {
  if (!subjekPengumuman.value || !isiPesan.value) {
    picuToast('Subjek dan isi pesan wajib diisi!', 'error');
    return;
  }

  picuToast(
    `Pengumuman "${subjekPengumuman.value}" berhasil dikirim ke target: ${targetPenerima.value.toUpperCase()}! ${kirimWa.value ? 'WhatsApp terkirim.' : ''}`,
    'sukses'
  );

  // Reset
  subjekPengumuman.value = '';
  isiPesan.value = '';
  jadwalKirim.value = '';
};
</script>

<template>
  <div class="space-y-6">
    <!-- Toast Alert -->
    <NotifikasiUtama 
      :tampil="toastTampil" 
      :pesan="toastPesan" 
      :tipe="toastTipe" 
      @tutup="toastTampil = false" 
    />

    <div>
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Pengumuman & Notifikasi Massal</h1>
      <p class="text-xs text-slate-400">Kirim pemberitahuan massal terintegrasi WhatsApp ke wali murid dan supir.</p>
    </div>

    <!-- Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Broadcast Form (2 Columns) -->
      <div class="lg:col-span-2 bg-warnaSekunder border border-warnaAksen/30 p-6 rounded-2xl space-y-4 shadow-lg">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-warnaAksen/20 pb-3">
          <Megaphone class="w-4.5 h-4.5 text-warnaTombol" />
          Kirim Pengumuman Baru
        </h3>

        <form class="space-y-4 text-xs" @submit.prevent="kirimPengumuman">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Target Penerima:</label>
              <select 
                v-model="targetPenerima"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs font-semibold"
              >
                <option value="semua">Semua Pengguna & Driver</option>
                <option value="SD N 01 Padang">Siswa SD N 01 Padang</option>
                <option value="SMP N 1 Padang">Siswa SMP N 1 Padang</option>
                <option value="supir">Khusus Driver / Supir</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Jadwal Kirim (Opsional):</label>
              <input 
                type="datetime-local" 
                v-model="jadwalKirim"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Subjek / Judul Pengumuman:</label>
            <input 
              type="text" 
              v-model="subjekPengumuman" 
              required
              placeholder="E.g. Pemeliharaan Armada Rutin Bulan Juli"
              class="block w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Isi Pesan Pemberitahuan:</label>
            <textarea 
              rows="5" 
              v-model="isiPesan" 
              required
              placeholder="Tulis pengumuman di sini..."
              class="block w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none"
            ></textarea>
          </div>

          <!-- WhatsApp Option checkbox -->
          <div class="flex items-center gap-2 bg-warnaUtama/50 p-3 rounded-xl border border-warnaAksen/20">
            <input 
              type="checkbox" 
              id="send_wa" 
              v-model="kirimWa"
              class="accent-warnaTombol cursor-pointer" 
            />
            <label for="send_wa" class="text-slate-300 font-bold cursor-pointer">
              Kirim juga secara paralel melalui WhatsApp Gateway terintegrasi
            </label>
          </div>

          <div class="flex justify-end pt-2">
            <button 
              type="submit"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warnaTombol hover:bg-opacity-95 text-white cursor-pointer transition-colors"
            >
              Kirim Pengumuman <Send class="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      <!-- Right Column: Broadcast stats / explanation (1 Column) -->
      <div class="space-y-6">
        <KartuUtama judul="Laporan Gateway Broadcast" subjudul="Simulasi data outbox WhatsApp">
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Total WA Outbox Hari Ini:</span>
              <span class="text-white font-mono font-bold">128 Pesan</span>
            </div>
            <div class="flex justify-between border-b border-warnaAksen/10 pb-2">
              <span class="text-slate-400">Status Gateway API:</span>
              <span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> CONNECTED</span>
            </div>
            <div class="flex justify-between pb-2">
              <span class="text-slate-400">Rasio Pengiriman Sukses:</span>
              <span class="text-white font-mono font-bold">100% (No Bounce)</span>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>
  </div>
</template>
