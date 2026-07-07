<script setup lang="ts">
import { ref } from 'vue';
import { Clock, CheckSquare, ShieldAlert, Check } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
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

// State Jadwal Mingguan
const jadwalMingguan = ref({
  Senin: true,
  Selasa: true,
  Rabu: true,
  Kamis: true,
  Jumat: true,
  Sabtu: false,
  Minggu: false
});

const simpanJadwalMingguan = () => {
  picuToast('Jadwal rutin mingguan berhasil disimpan!', 'sukses');
};

// State Absen Harian
const absenHariIni = ref<'masuk' | 'tidak_masuk'>('masuk');

const ubahAbsenHarian = (status: 'masuk' | 'tidak_masuk') => {
  absenHariIni.value = status;
  picuToast(`Absensi hari ini berhasil diubah menjadi: ${status === 'masuk' ? 'MASUK' : 'TIDAK MASUK'}`, 'sukses');
};

// State Ubah Jadwal Pulang
const pulangHari = ref('Senin');
const pulangWaktu = ref('13:00');
const biayaTambahan = ref(20000); // Simulasi biaya tambahan harian

const riwayatPerubahan = ref([
  { hari: 'Senin, 06 Juli 2026', waktu: '14:30 WIB', status: 'Disetujui' },
  { hari: 'Rabu, 01 Juli 2026', waktu: '15:00 WIB', status: 'Disetujui' }
]);

const ajukanPerubahanJadwal = () => {
  riwayatPerubahan.value.unshift({
    hari: `${pulangHari.value}, ${new Date().toLocaleDateString('id-ID')}`,
    waktu: `${pulangWaktu.value} WIB`,
    status: 'Menunggu Persetujuan'
  });
  picuToast('Pengajuan perubahan jadwal pulang berhasil dikirim ke supir!', 'sukses');
};

// State Cuti / Libur
const cutiMulai = ref('');
const cutiSelesai = ref('');
const cutiAlasan = ref('sakit');

const ajukanCuti = () => {
  if (!cutiMulai.value || !cutiSelesai.value) {
    picuToast('Tanggal mulai dan selesai wajib diisi', 'error');
    return;
  }
  picuToast('Pengaturan libur dikonfirmasi. Tagihan bulanan Anda akan dijeda otomatis selama masa cuti.', 'sukses');
  cutiMulai.value = '';
  cutiSelesai.value = '';
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
      <h1 class="text-xl font-bold text-white uppercase tracking-wider">Pengaturan Jadwal & Absensi</h1>
      <p class="text-xs text-slate-400">Atur absen harian anak, jadwal mingguan, dan pengajuan cuti libur.</p>
    </div>

    <!-- Main Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column (2 Columns Width) -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- 1. Absen Harian (Attendance Toggle) -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-warnaTombol" />
            Laporan Absensi Hari Ini
          </h3>
          <p class="text-xs text-slate-400">
            Pilih status kehadiran anak hari ini. Batas waktu perubahan adalah **30 menit sebelum jemput**.
          </p>

          <div class="grid grid-cols-2 gap-4">
            <button
              type="button"
              @click="ubahAbsenHarian('masuk')"
              class="flex flex-col items-center justify-center p-4 border rounded-xl transition-all cursor-pointer"
              :class="absenHariIni === 'masuk' ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400' : 'bg-warnaUtama border-warnaAksen/20 text-slate-400'"
            >
              <Check class="w-6 h-6 mb-1" />
              <span class="text-xs font-bold uppercase">Masuk Sekolah</span>
              <span class="text-[9px] text-slate-500 mt-0.5">Layanan berjalan seperti biasa</span>
            </button>
            
            <button
              type="button"
              @click="ubahAbsenHarian('tidak_masuk')"
              class="flex flex-col items-center justify-center p-4 border rounded-xl transition-all cursor-pointer"
              :class="absenHariIni === 'tidak_masuk' ? 'bg-rose-950/20 border-rose-500 text-rose-400' : 'bg-warnaUtama border-warnaAksen/20 text-slate-400'"
            >
              <ShieldAlert class="w-6 h-6 mb-1" />
              <span class="text-xs font-bold uppercase">Absen / Libur</span>
              <span class="text-[9px] text-slate-500 mt-0.5">Absen menjemput siswa</span>
            </button>
          </div>
        </div>

        <!-- 2. Atur Jadwal Mingguan -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare class="w-4 h-4 text-warnaTombol" />
            Konfigurasi Jadwal Rutin Mingguan
          </h3>
          <p class="text-xs text-slate-400">Centang hari aktif sekolah anak untuk jadwal penjemputan berkala.</p>

          <div class="flex flex-wrap gap-4 py-2">
            <label 
              v-for="(_, hari) in jadwalMingguan" 
              :key="hari"
              class="flex items-center gap-2 cursor-pointer bg-warnaUtama/50 px-4 py-2 rounded-xl border border-warnaAksen/20 hover:border-warnaAksen/50 transition-all text-xs"
            >
              <input 
                type="checkbox" 
                v-model="jadwalMingguan[hari]"
                class="accent-warnaTombol rounded"
              />
              <span :class="jadwalMingguan[hari] ? 'text-white font-bold' : 'text-slate-500'">{{ hari }}</span>
            </label>
          </div>

          <div class="pt-2 flex justify-end">
            <TombolUtama varian="utama" class="text-xs" @click="simpanJadwalMingguan">
              Simpan Jadwal Rutin
            </TombolUtama>
          </div>
        </div>

        <!-- 3. Ubah Jadwal Pulang Ad-Hoc -->
        <div class="bg-warnaSekunder border border-warnaAksen/30 p-5 rounded-2xl space-y-4 shadow">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-warnaTombol" />
            Ajukan Perubahan Jadwal Pulang
          </h3>
          <p class="text-xs text-slate-400">Ajukan perubahan jam kepulangan khusus (misal: les/kelas tambahan).</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Pilih Hari:</label>
              <select 
                v-model="pulangHari"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs"
              >
                <option value="Senin">Senin</option>
                <option value="Selasa">Selasa</option>
                <option value="Rabu">Rabu</option>
                <option value="Kamis">Kamis</option>
                <option value="Jumat">Jumat</option>
              </select>
            </div>
            
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Waktu Pulang Baru:</label>
              <input 
                type="time" 
                v-model="pulangWaktu"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs font-mono"
              />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 text-xs">
            <span class="text-slate-400">Biaya Tambahan Admin: <strong class="text-warnaTombol">Rp {{ biayaTambahan.toLocaleString('id-ID') }}</strong></span>
            <TombolUtama varian="utama" class="text-xs" @click="ajukanPerubahanJadwal">
              Ajukan Perubahan
            </TombolUtama>
          </div>

          <!-- Perubahan History -->
          <div class="pt-4 border-t border-warnaAksen/20 space-y-2">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Riwayat Pengajuan Perubahan:</h4>
            <div class="space-y-2">
              <div 
                v-for="(hist, idx) in riwayatPerubahan" 
                :key="idx"
                class="flex justify-between items-center bg-warnaUtama/50 px-3 py-2 rounded-lg border border-warnaAksen/10 text-[11px]"
              >
                <span class="text-slate-300 font-bold">{{ hist.hari }} &mdash; Jam Pulang: {{ hist.waktu }}</span>
                <span 
                  class="font-bold px-1.5 py-0.5 rounded"
                  :class="hist.status === 'Disetujui' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'"
                >
                  {{ hist.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right Column (1 Column Width) -->
      <div class="space-y-6">
        <!-- 4. Pengaturan Libur/Cuti -->
        <KartuUtama judul="Pengaturan Libur / Cuti" subjudul="Jeda layanan otomatis tanpa tagihan">
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mulai Tanggal:</label>
              <input 
                type="date" 
                v-model="cutiMulai"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs font-mono"
              />
            </div>
            
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selesai Tanggal:</label>
              <input 
                type="date" 
                v-model="cutiSelesai"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs font-mono"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Alasan Cuti:</label>
              <select 
                v-model="cutiAlasan"
                class="w-full px-3 py-2 bg-warnaUtama border border-warnaAksen/30 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-warnaTombol text-xs"
              >
                <option value="sakit">Sakit</option>
                <option value="libur_sekolah">Libur Sekolah</option>
                <option value="pulang_kampung">Mudik / Acara Keluarga</option>
              </select>
            </div>

            <TombolUtama varian="utama" class="w-full text-xs" @click="ajukanCuti">
              Konfirmasi Pengajuan Cuti
            </TombolUtama>
          </div>
        </KartuUtama>
      </div>

    </div>
  </div>
</template>
