<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Loader2, AlertTriangle, CheckCircle2, History } from 'lucide-vue-next';
import {
  ambilRiwayatPerjalanan,
  ambilLaporanKendalaSupir,
  perbaruiStatusLaporanKendalaSupir,
  type RiwayatPerjalananSupir,
  type LaporanKendalaSupir
} from '../../layanan/supirLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
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

// Filter
const filterTanggal = ref('');

const sedangMemuat = ref(true);
const riwayatSupir = ref<RiwayatPerjalananSupir[]>([]);

const muatRiwayat = async () => {
  sedangMemuat.value = true;
  try {
    riwayatSupir.value = await denganBatasWaktu(ambilRiwayatPerjalanan(filterTanggal.value || undefined), 20000, 'Waktu memuat riwayat perjalanan habis.');
  } catch (err) {
    console.error('Gagal memuat riwayat perjalanan supir:', err);
    riwayatSupir.value = [];
  } finally {
    sedangMemuat.value = false;
  }
};

onMounted(muatRiwayat);
watch(filterTanggal, muatRiwayat);

// ==========================================
// Laporan Kendala Saya -- supir sendiri yang menandai status
// ditindak/selesai dari laporan yang mereka kirim (lihat TugasSupir.vue,
// ModalLaporanKendala), BUKAN Admin (Admin sekarang read-only, lihat
// catatan lengkap di LaporanAdmin.vue).
// ==========================================
const sedangMemuatKendala = ref(true);
const daftarKendala = ref<LaporanKendalaSupir[]>([]);
const sedangMemperbaruiKendala = ref<string | null>(null);

const muatLaporanKendala = async () => {
  sedangMemuatKendala.value = true;
  try {
    daftarKendala.value = await denganBatasWaktu(ambilLaporanKendalaSupir(), 20000, 'Waktu memuat laporan kendala habis.');
  } catch (err) {
    console.error('Gagal memuat laporan kendala supir:', err);
    daftarKendala.value = [];
  } finally {
    sedangMemuatKendala.value = false;
  }
};

onMounted(muatLaporanKendala);

const labelKategoriKendala = (kategori: LaporanKendalaSupir['kategori']) =>
  kategori === 'kendala_anak' ? 'Kendala Anak' : 'Kendala Perjalanan';

const labelStatusKendala = (status: LaporanKendalaSupir['status']) =>
  status === 'baru' ? 'Belum Ditangani' : status === 'ditindak' ? 'Diproses' : 'Selesai';

const kelasStatusKendala = (status: LaporanKendalaSupir['status']) => {
  if (status === 'baru') return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (status === 'ditindak') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
};

const ubahStatusKendala = async (laporan: LaporanKendalaSupir, status: 'ditindak' | 'selesai') => {
  sedangMemperbaruiKendala.value = laporan.id;
  try {
    const statusSebelum = laporan.status;
    await perbaruiStatusLaporanKendalaSupir(laporan.id, status, statusSebelum);
    laporan.status = status;
    picuToast('Status laporan kendala berhasil diperbarui!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui status laporan kendala.', 'error');
  } finally {
    sedangMemperbaruiKendala.value = null;
  }
};

const totalPerjalanan = computed(() => riwayatSupir.value.length);
const totalJarak = computed(() => {
  const sum = riwayatSupir.value.reduce((sum, item) => sum + item.jarakKm, 0);
  return sum.toFixed(1);
});
const totalAnakDilayani = computed(() => {
  const setAnak = new Set(riwayatSupir.value.map(item => item.anak));
  return setAnak.size;
});

const formatJamOperasional = (item: RiwayatPerjalananSupir) => {
  const fmt = (waktu: string | null) => waktu ? new Date(waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
  return `${fmt(item.waktuJemput)} - ${fmt(item.waktuAntar)}`;
};

const labelStatus = (status: string) => status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai';
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

    <div class="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
        <History class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-on-background tracking-tight">Riwayat Perjalanan & Tugas</h1>
        <p class="text-xs text-on-surface-variant">Tinjau rangkuman produktivitas dan perjalanan armada Anda yang telah selesai.</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-2xl max-w-sm soft-shadow text-xs">
      <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Pilih Tanggal Perjalanan:</label>
      <input
        type="date"
        v-model="filterTanggal"
        class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono"
      />
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <template v-else>
      <!-- Summary Widgets Grid -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-1 text-center soft-shadow">
          <p class="text-[10px] text-on-surface-variant font-bold uppercase">Total Perjalanan</p>
          <p class="text-2xl font-black text-on-surface font-mono">{{ totalPerjalanan }}</p>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-1 text-center soft-shadow">
          <p class="text-[10px] text-on-surface-variant font-bold uppercase">Total Jarak Tempuh</p>
          <p class="text-2xl font-black text-primary font-mono">{{ totalJarak }} <span class="text-xs font-normal text-on-surface-variant">KM</span></p>
        </div>
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-1 text-center soft-shadow">
          <p class="text-[10px] text-on-surface-variant font-bold uppercase">Anak Dilayani</p>
          <p class="text-2xl font-black text-on-surface font-mono">{{ totalAnakDilayani }}</p>
        </div>
      </div>

      <!-- History Table -->
      <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden soft-shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Tanggal</th>
                <th class="py-3 px-4">Nama Siswa</th>
                <th class="py-3 px-4">Sekolah</th>
                <th class="py-3 px-4">Sesi</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Jam Operasional</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/20 text-on-surface-variant">
              <tr v-for="(item, idx) in riwayatSupir" :key="idx" class="hover:bg-surface-container/40 transition-colors">
                <td class="py-4 px-4 font-mono font-bold">{{ new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) }}</td>
                <td class="py-4 px-4 font-semibold text-on-surface">{{ item.anak }}</td>
                <td class="py-4 px-4">{{ item.sekolah }}</td>
                <td class="py-4 px-4 uppercase">{{ item.jenisPerjalanan }}</td>
                <td class="py-4 px-4">
                  <span
                    class="px-2 py-0.5 rounded border font-bold text-[9px] uppercase"
                    :class="item.status === 'dibatalkan' ? 'bg-outline-variant/10 text-on-surface-variant border-outline-variant/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'"
                  >
                    {{ labelStatus(item.status) }}
                  </span>
                </td>
                <td class="py-4 px-4 text-right font-mono text-on-surface-variant font-semibold">{{ formatJamOperasional(item) }}</td>
              </tr>
              <tr v-if="riwayatSupir.length === 0">
                <td colspan="6" class="py-8 text-center text-on-surface-variant italic">Tidak ada histori perjalanan ditemukan.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Laporan Kendala Saya -- supir sendiri yang menandai status
         ditindak/selesai, Admin hanya melihat (read-only). -->
    <div>
      <h2 class="text-sm font-bold text-on-background uppercase tracking-wider">Laporan Kendala Saya</h2>
      <p class="text-xs text-on-surface-variant">Tandai sendiri status penanganan kendala yang pernah Anda laporkan.</p>
    </div>

    <div v-if="sedangMemuatKendala" class="flex items-center justify-center py-10">
      <Loader2 class="w-6 h-6 text-primary animate-spin" />
    </div>
    <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Waktu</th>
              <th class="py-3 px-4">Jenis</th>
              <th class="py-3 px-4">Anak Terkait</th>
              <th class="py-3 px-4">Deskripsi</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/20 text-on-surface-variant">
            <tr v-for="laporan in daftarKendala" :key="laporan.id" class="hover:bg-surface-container/40 transition-colors">
              <td class="py-4 px-4 font-mono text-[11px]">
                {{ new Date(laporan.dibuatPada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }} WIB
              </td>
              <td class="py-4 px-4">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase bg-surface-container text-on-surface-variant border-outline-variant/40">
                  <AlertTriangle class="w-3 h-3" /> {{ labelKategoriKendala(laporan.kategori) }}
                </span>
              </td>
              <td class="py-4 px-4">{{ laporan.namaAnak ?? '-' }}</td>
              <td class="py-4 px-4 max-w-xs">
                <p class="line-clamp-2">{{ laporan.deskripsi }}</p>
              </td>
              <td class="py-4 px-4">
                <span class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]" :class="kelasStatusKendala(laporan.status)">
                  {{ labelStatusKendala(laporan.status) }}
                </span>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                <button
                  v-if="laporan.status === 'baru'"
                  :disabled="sedangMemperbaruiKendala === laporan.id"
                  @click="ubahStatusKendala(laporan, 'ditindak')"
                  class="px-2.5 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Tandai Ditindak
                </button>
                <button
                  v-if="laporan.status !== 'selesai'"
                  :disabled="sedangMemperbaruiKendala === laporan.id"
                  @click="ubahStatusKendala(laporan, 'selesai')"
                  class="px-2.5 py-1.5 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" /> Tandai Selesai
                </button>
                <span v-if="laporan.status === 'selesai'" class="text-on-surface-variant italic">Selesai</span>
              </td>
            </tr>
            <tr v-if="daftarKendala.length === 0">
              <td colspan="6" class="py-8 text-center text-on-surface-variant italic">Belum ada laporan kendala yang pernah Anda kirimkan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
