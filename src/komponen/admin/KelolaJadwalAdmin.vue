<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Plus, Trash2, CalendarDays, AlertTriangle, Loader2, ClipboardList, Clock, RefreshCw, Cloud } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { ambilDaftarSekolah } from '../../layanan/berlangganganLayanan';
import { ambilHariLiburRentang, tambahHariLibur, hapusHariLibur, sinkronkanHariLiburDariApi } from '../../layanan/kalenderLayanan';
import {
  ambilPengajuanCutiSemua,
  ambilPengajuanPerubahanJadwalSemua,
  type PengajuanCutiAdmin,
  type PengajuanPerubahanJadwalAdmin
} from '../../layanan/adminLayanan';
import { rekonsiliasiPengajuanPerubahanJadwal } from '../../layanan/orangTuaLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import { formatMataUang } from '../../bantuan/formatMataUang';
import type { HariLiburRow, SekolahRow } from '../../tipe';

// Sub-halaman: 'kalender' (hari libur nasional/sekolah, dikelola Admin),
// 'pengajuan' (cuti/libur per anak), 'perubahan_jadwal' (perubahan
// jam/alamat jemput-antar per anak) -- keduanya diajukan orang tua,
// read-only bagi Admin, murni informasi operasional.
const halamanTab = ref<'kalender' | 'pengajuan' | 'perubahan_jadwal'>('kalender');

const authStore = useAuthStore();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const LABEL_JENIS: Record<HariLiburRow['jenis'], string> = {
  nasional: 'Libur Nasional',
  cuti_bersama: 'Cuti Bersama',
  libur_sekolah: 'Libur Sekolah',
  khusus: 'Hari Khusus Tidak Aktif'
};

// Navigasi bulan yang sedang ditampilkan (default bulan berjalan)
const acuanBulan = ref(new Date());
const namaBulanTahun = computed(() =>
  acuanBulan.value.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
);

const daftarSekolah = ref<SekolahRow[]>([]);
const daftarLibur = ref<HariLiburRow[]>([]);
const sedangMemuat = ref(true);

const petaNamaSekolah = computed(() => {
  const peta = new Map<string, string>();
  daftarSekolah.value.forEach((s) => peta.set(s.id, s.nama));
  return peta;
});

const muatDaftarLibur = async () => {
  sedangMemuat.value = true;
  try {
    const tahun = acuanBulan.value.getFullYear();
    const bulan = acuanBulan.value.getMonth();
    const awalBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
    const akhirTanggal = new Date(tahun, bulan + 1, 0).getDate();
    const akhirBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(akhirTanggal).padStart(2, '0')}`;
    daftarLibur.value = await denganBatasWaktu(ambilHariLiburRentang(awalBulan, akhirBulan), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat kalender hari libur.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

const gantiBulan = (langkah: number) => {
  const acuan = acuanBulan.value;
  acuanBulan.value = new Date(acuan.getFullYear(), acuan.getMonth() + langkah, 1);
  muatDaftarLibur();
};

// "Sinkronkan dari API" -- mengambil kalender hari libur nasional dari API
// eksternal (lihat supabase/functions/sinkron-hari-libur) untuk tahun
// berjalan + tahun berikutnya. Baris manual Admin (sumber='manual') tidak
// pernah ikut ditimpa -- lihat catatan di kalenderLayanan.ts.
const sedangSinkron = ref(false);

const sinkronDariApi = async () => {
  sedangSinkron.value = true;
  try {
    const hasil = await sinkronkanHariLiburDariApi();
    if (hasil.kegagalanPerTahun) {
      const pesanGagal = Object.entries(hasil.kegagalanPerTahun).map(([thn, pesan]) => `${thn}: ${pesan}`).join('; ');
      picuToast(`Sinkron sebagian gagal (${pesanGagal}). Ditambah ${hasil.totalDitambah}, diperbarui ${hasil.totalDiperbarui}.`, 'error');
    } else {
      picuToast(`Sinkron berhasil! ${hasil.totalDitambah} hari libur baru ditambahkan, ${hasil.totalDiperbarui} diperbarui.`, 'sukses');
    }
    await muatDaftarLibur();
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyinkronkan kalender dari API.', 'error');
  } finally {
    sedangSinkron.value = false;
  }
};

// Pengajuan Cuti/Libur Wali -- daftar mentah semua anak, murni informasi
// operasional bagi Admin (bukan alur approve/reject, lihat catatan di
// ambilPengajuanCutiSemua()).
const daftarPengajuanCuti = ref<PengajuanCutiAdmin[]>([]);
const sedangMemuatPengajuan = ref(true);

const muatPengajuanCuti = async () => {
  sedangMemuatPengajuan.value = true;
  try {
    daftarPengajuanCuti.value = await denganBatasWaktu(ambilPengajuanCutiSemua(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat data pengajuan cuti/libur.', 'error');
  } finally {
    sedangMemuatPengajuan.value = false;
  }
};

// Pengajuan Perubahan Jadwal Jemput/Antar -- daftar mentah semua anak,
// murni informasi operasional bagi Admin (berlaku otomatis begitu
// diajukan, lihat ajukanPerubahanJadwal() di orangTuaLayanan.ts).
const daftarPengajuanPerubahanJadwal = ref<PengajuanPerubahanJadwalAdmin[]>([]);
const sedangMemuatPerubahanJadwal = ref(true);

const muatPengajuanPerubahanJadwal = async () => {
  sedangMemuatPerubahanJadwal.value = true;
  try {
    // Perbaikan mandiri dulu (best-effort) -- lihat catatan lengkap di
    // rekonsiliasiPengajuanPerubahanJadwal() (orangTuaLayanan.ts): pengajuan
    // yang pembayarannya sudah lunas tapi statusnya "nyangkut" di 'menunggu'
    // (mis. tab orang tua sempat tertutup persis setelah Midtrans sukses)
    // disinkronkan ulang di sini supaya Admin tidak melihat data basi.
    // Jalankan rekonsiliasi di latar belakang (background) agar tidak menghambat pemuatan data utama
    rekonsiliasiPengajuanPerubahanJadwal().catch((err) => {
      console.error('Gagal merekonsiliasi pengajuan perubahan jadwal (background):', err);
    });
    daftarPengajuanPerubahanJadwal.value = await denganBatasWaktu(ambilPengajuanPerubahanJadwalSemua(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat data pengajuan perubahan jadwal.', 'error');
  } finally {
    sedangMemuatPerubahanJadwal.value = false;
  }
};

// Cocok dengan opsi "Alasan Cuti" pada form Pengaturan Libur/Cuti di panel
// Orang Tua (JadwalOrangTua.vue) -- nilai mentah diterjemahkan ke label
// yang sama supaya tidak tampil sebagai raw value ("pulang_kampung") di
// tabel Admin.
const LABEL_ALASAN_CUTI: Record<string, string> = {
  sakit: 'Sakit',
  libur_sekolah: 'Libur Sekolah',
  pulang_kampung: 'Mudik / Acara Keluarga'
};

function formatWaktuPengajuan(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const tanggal = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tanggal} • ${jam} WIB`;
}

// Realtime -- event-driven, bukan interval berkala.
const saluranList: { unsubscribe: () => void }[] = [];
onUnmounted(() => {
  saluranList.forEach((s) => s.unsubscribe());
  saluranList.length = 0;
});

onMounted(async () => {
  try {
    daftarSekolah.value = await denganBatasWaktu(ambilDaftarSekolah(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar sekolah.', 'error');
  }
  await Promise.all([muatDaftarLibur(), muatPengajuanCuti(), muatPengajuanPerubahanJadwal()]);

  saluranList.push(pantauTabelAdminRealtime('hari_libur', muatDaftarLibur));
  saluranList.push(pantauTabelAdminRealtime('pengajuan_cuti', muatPengajuanCuti));
  saluranList.push(pantauTabelAdminRealtime('pengajuan_perubahan_jadwal', muatPengajuanPerubahanJadwal));
});

// Modal Tambah Hari Libur
const modalFormTampil = ref(false);
const sedangMenyimpan = ref(false);

const hariIniIso = ambilTanggalWibSekarang();
const formTanggal = ref('');
const formTanggalSelesai = ref('');
const formNama = ref('');
const formJenis = ref<HariLiburRow['jenis']>('nasional');
const formSekolahId = ref('');

const resetForm = () => {
  formTanggal.value = '';
  formTanggalSelesai.value = '';
  formNama.value = '';
  formJenis.value = 'nasional';
  formSekolahId.value = '';
};

const bukaTambah = () => {
  resetForm();
  modalFormTampil.value = true;
};

const simpanHariLibur = async () => {
  if (!formTanggal.value || !formNama.value) {
    picuToast('Tanggal dan nama hari libur wajib diisi!', 'error');
    return;
  }
  if (formTanggal.value < hariIniIso) {
    picuToast('Tanggal hari libur tidak boleh sebelum hari ini.', 'error');
    return;
  }
  if (formTanggalSelesai.value && formTanggalSelesai.value < formTanggal.value) {
    picuToast('Tanggal berakhir tidak boleh sebelum tanggal mulai.', 'error');
    return;
  }
  if (formJenis.value === 'libur_sekolah' && !formSekolahId.value) {
    picuToast('Pilih sekolah untuk jenis Libur Sekolah.', 'error');
    return;
  }

  sedangMenyimpan.value = true;
  try {
    const liburBaru = await tambahHariLibur({
      tanggal: formTanggal.value,
      tanggalSelesai: formTanggalSelesai.value || undefined,
      nama: formNama.value,
      jenis: formJenis.value,
      sekolahId: formJenis.value === 'libur_sekolah' ? formSekolahId.value : null,
      dibuatOleh: authStore.pengguna?.id
    });
    // Hanya masukkan ke list bila jatuh di bulan yang sedang ditampilkan
    const tahun = acuanBulan.value.getFullYear();
    const bulan = acuanBulan.value.getMonth();
    const awalBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
    const akhirTanggal = new Date(tahun, bulan + 1, 0).getDate();
    const akhirBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(akhirTanggal).padStart(2, '0')}`;
    const liburDiBulanIni = liburBaru.filter((l) => l.tanggal >= awalBulan && l.tanggal <= akhirBulan);
    if (liburDiBulanIni.length > 0) {
      daftarLibur.value = [...daftarLibur.value, ...liburDiBulanIni].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    }
    picuToast(
      liburBaru.length > 1 ? `${liburBaru.length} tanggal hari libur berhasil ditambahkan!` : 'Hari libur baru berhasil ditambahkan!',
      'sukses'
    );
    modalFormTampil.value = false;
    resetForm();
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan hari libur.', 'error');
  } finally {
    sedangMenyimpan.value = false;
  }
};

// Modal Konfirmasi Hapus
const modalHapusTampil = ref(false);
const liburAkanDihapus = ref<HariLiburRow | null>(null);
const sedangMenghapus = ref(false);

const bukaKonfirmasiHapus = (libur: HariLiburRow) => {
  liburAkanDihapus.value = libur;
  modalHapusTampil.value = true;
};

const konfirmasiHapusLibur = async () => {
  if (!liburAkanDihapus.value) return;
  const id = liburAkanDihapus.value.id;
  sedangMenghapus.value = true;
  try {
    await hapusHariLibur(id);
    daftarLibur.value = daftarLibur.value.filter((l) => l.id !== id);
    picuToast('Hari libur berhasil dihapus!', 'sukses');
    modalHapusTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus hari libur.', 'error');
  } finally {
    sedangMenghapus.value = false;
  }
};

function formatTanggalIndo(tanggalIso: string): string {
  const tanggal = new Date(tanggalIso + 'T00:00:00');
  if (Number.isNaN(tanggal.getTime())) return tanggalIso;
  return tanggal.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
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

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
          <CalendarDays class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-on-surface tracking-tight">Kelola Jadwal</h1>
          <p class="text-xs text-on-surface-variant">Atur kalender operasional -- libur nasional, cuti bersama, libur sekolah, dan hari khusus tidak aktif. Data ini jadi acuan sistem menghitung hari efektif sekolah & estimasi biaya langganan.</p>
        </div>
      </div>

      <div v-if="halamanTab === 'kalender'" class="flex items-center gap-2">
        <TombolUtama
          tema="terang"
          varian="garis-luar"
          class="gap-1.5 text-xs"
          :nonaktif="sedangSinkron"
          @click="sinkronDariApi"
          title="Ambil kalender hari libur nasional terbaru dari API eksternal (tahun berjalan + tahun berikutnya)"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': sedangSinkron }" />
          {{ sedangSinkron ? 'Menyinkronkan...' : 'Sinkronkan dari API' }}
        </TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs" @click="bukaTambah">
          <Plus class="w-4 h-4" /> Tambah Hari Libur
        </TombolUtama>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="flex border-b border-outline-variant/30 text-xs">
      <button
        @click="halamanTab = 'kalender'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="halamanTab === 'kalender' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <CalendarDays class="w-4 h-4" /> Kalender Hari Libur
      </button>
      <button
        @click="halamanTab = 'pengajuan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="halamanTab === 'pengajuan' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <ClipboardList class="w-4 h-4" /> Pengajuan Cuti/Libur Wali
      </button>
      <button
        @click="halamanTab = 'perubahan_jadwal'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="halamanTab === 'perubahan_jadwal' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <Clock class="w-4 h-4" /> Perubahan Jadwal
      </button>
    </div>

    <template v-if="halamanTab === 'kalender'">
      <!-- Navigasi Bulan -->
      <div class="flex items-center justify-center gap-4 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3 soft-shadow">
        <button
          type="button"
          @click="gantiBulan(-1)"
          class="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer text-xs font-bold"
        >
          &larr; Sebelumnya
        </button>
        <span class="flex items-center gap-1.5 text-sm font-bold text-on-surface uppercase tracking-wide">
          <CalendarDays class="w-4 h-4 text-primary" /> {{ namaBulanTahun }}
        </span>
        <button
          type="button"
          @click="gantiBulan(1)"
          class="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer text-xs font-bold"
        >
          Selanjutnya &rarr;
        </button>
      </div>

      <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
      </div>

      <!-- Table of Hari Libur -->
      <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Tanggal</th>
                <th class="py-3 px-4">Nama</th>
                <th class="py-3 px-4">Jenis</th>
                <th class="py-3 px-4">Sekolah</th>
                <th class="py-3 px-4">Sumber</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="libur in daftarLibur" :key="libur.id" class="hover:bg-surface-container transition-colors">
                <td class="py-4 px-4 font-mono text-[11px] text-on-surface">{{ formatTanggalIndo(libur.tanggal) }}</td>
                <td class="py-4 px-4 font-semibold text-on-surface">{{ libur.nama }}</td>
                <td class="py-4 px-4">
                  <span
                    class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="{
                      'bg-rose-50 text-rose-700 border-rose-200': libur.jenis === 'nasional',
                      'bg-amber-50 text-amber-700 border-amber-200': libur.jenis === 'cuti_bersama',
                      'bg-blue-50 text-blue-700 border-blue-200': libur.jenis === 'libur_sekolah',
                      'bg-slate-100 text-slate-700 border-slate-200': libur.jenis === 'khusus'
                    }"
                  >
                    {{ LABEL_JENIS[libur.jenis] }}
                  </span>
                </td>
                <td class="py-4 px-4">{{ libur.sekolah_id ? (petaNamaSekolah.get(libur.sekolah_id) ?? '-') : 'Semua Sekolah' }}</td>
                <td class="py-4 px-4">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="libur.sumber === 'api' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-surface-container text-on-surface-variant border-outline-variant/40'"
                  >
                    <Cloud v-if="libur.sumber === 'api'" class="w-3 h-3" />
                    {{ libur.sumber === 'api' ? 'API' : 'Manual' }}
                  </span>
                </td>
                <td class="py-4 px-4 text-right">
                  <button
                    @click="bukaKonfirmasiHapus(libur)"
                    class="text-error hover:text-error p-1.5 border border-error/20 rounded bg-error-container/40 hover:bg-error-container transition-colors cursor-pointer"
                    title="Hapus Hari Libur"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              <tr v-if="daftarLibur.length === 0">
                <td colspan="6" class="py-8 text-center text-on-surface-variant italic">Belum ada hari libur terdaftar untuk bulan ini.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Pengajuan Cuti/Libur Wali -- informasi operasional (read-only bagi
    Admin), diajukan orang tua lewat menu Jadwal di panel mereka. Dipakai
    sebagai acuan anak mana yang tidak perlu dijemput pada tanggal tertentu
    (penugasan otomatis sudah mengecualikan anak ini, lihat
    saringAnakTersediaUntukTanggal di adminLayanan.ts). -->
    <template v-else-if="halamanTab === 'pengajuan'">
      <div v-if="sedangMemuatPengajuan" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
      </div>
      <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Orang Tua</th>
                <th class="py-3 px-4">Anak</th>
                <th class="py-3 px-4">Tanggal Cuti/Libur</th>
                <th class="py-3 px-4">Alasan</th>
                <th class="py-3 px-4">Waktu Pengajuan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="p in daftarPengajuanCuti" :key="p.id" class="hover:bg-surface-container transition-colors">
                <td class="py-4 px-4 font-semibold text-on-surface">{{ p.namaOrangTua }}</td>
                <td class="py-4 px-4">{{ p.namaAnak }}</td>
                <td class="py-4 px-4 font-mono text-[11px]">
                  {{ formatTanggalIndo(p.tanggalMulai) }}
                  <template v-if="p.tanggalSelesai !== p.tanggalMulai"> s/d {{ formatTanggalIndo(p.tanggalSelesai) }}</template>
                </td>
                <td class="py-4 px-4">{{ (p.alasan && LABEL_ALASAN_CUTI[p.alasan]) || p.alasan || '-' }}</td>
                <td class="py-4 px-4 font-mono text-[11px]">{{ formatWaktuPengajuan(p.diajukanPada) }}</td>
              </tr>
              <tr v-if="daftarPengajuanCuti.length === 0">
                <td colspan="5" class="py-8 text-center text-on-surface-variant italic">Belum ada pengajuan cuti/libur dari orang tua.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Pengajuan Perubahan Jadwal Jemput/Antar -- informasi operasional
    (read-only bagi Admin), diajukan orang tua lewat menu Jadwal di panel
    mereka. Berlaku otomatis begitu diajukan (lihat ajukanPerubahanJadwal()
    di orangTuaLayanan.ts, yang juga menyinkronkan tabel perjalanan --
    jadwal lama dibatalkan & jadwal baru diperbarui catatannya). -->
    <template v-else>
      <div v-if="sedangMemuatPerubahanJadwal" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
      </div>
      <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Orang Tua</th>
                <th class="py-3 px-4">Anak</th>
                <th class="py-3 px-4">Jenis</th>
                <th class="py-3 px-4">Tanggal &amp; Jam Baru</th>
                <th class="py-3 px-4">Alamat Baru</th>
                <th class="py-3 px-4">Biaya Tambahan</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Waktu Pengajuan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="p in daftarPengajuanPerubahanJadwal" :key="p.id" class="hover:bg-surface-container transition-colors">
                <td class="py-4 px-4 font-semibold text-on-surface">{{ p.namaOrangTua }}</td>
                <td class="py-4 px-4">{{ p.namaAnak }}</td>
                <td class="py-4 px-4">
                  <span
                    class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="p.jenisPerubahan === 'pergi' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                  >
                    {{ p.jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang' }}
                  </span>
                </td>
                <td class="py-4 px-4 font-mono text-[11px]">
                  {{ p.tanggal ? formatTanggalIndo(p.tanggal) : (p.hari ?? '-') }} &middot; {{ p.waktuBaru }}
                </td>
                <td class="py-4 px-4 max-w-xs truncate" :title="p.alamatBaru ?? '-'">{{ p.alamatBaru ?? '-' }}</td>
                <td class="py-4 px-4 font-mono text-[11px]">{{ p.biayaTambahan > 0 ? formatMataUang(p.biayaTambahan) : '-' }}</td>
                <td class="py-4 px-4">
                  <span
                    class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="p.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'ditolak' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                  >
                    {{ p.status === 'disetujui' ? 'Berlaku' : p.status === 'ditolak' ? 'Dibatalkan' : 'Menunggu' }}
                  </span>
                </td>
                <td class="py-4 px-4 font-mono text-[11px]">{{ formatWaktuPengajuan(p.diajukanPada) }}</td>
              </tr>
              <tr v-if="daftarPengajuanPerubahanJadwal.length === 0">
                <td colspan="8" class="py-8 text-center text-on-surface-variant italic">Belum ada pengajuan perubahan jadwal dari orang tua.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modal Tambah Hari Libur -->
    <ModalUtama
      tema="terang"
      :tampil="modalFormTampil"
      judul="Tambah Hari Libur"
      ukuran="sedang"
      @tutup="modalFormTampil = false"
    >
      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Mulai (Wajib):</label>
          <input
            type="date"
            v-model="formTanggal"
            :min="hariIniIso"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Berakhir (Opsional):</label>
          <input
            type="date"
            v-model="formTanggalSelesai"
            :min="formTanggal || hariIniIso"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
          />
          <p class="text-[10px] text-on-surface-variant mt-1">Isi jika libur berlangsung beberapa hari berturut-turut (mis. cuti bersama). Kosongkan jika hanya 1 hari.</p>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Hari Libur (Wajib):</label>
          <input
            type="text"
            v-model="formNama"
            placeholder="E.g. Hari Kemerdekaan RI"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Jenis (Wajib):</label>
          <select
            v-model="formJenis"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="nasional">Libur Nasional</option>
            <option value="cuti_bersama">Cuti Bersama</option>
            <option value="libur_sekolah">Libur Sekolah</option>
            <option value="khusus">Hari Khusus Tidak Aktif</option>
          </select>
        </div>

        <div v-if="formJenis === 'libur_sekolah'">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Sekolah (Wajib):</label>
          <select
            v-model="formSekolahId"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="" disabled>Pilih sekolah</option>
            <option v-for="s in daftarSekolah" :key="s.id" :value="s.id">{{ s.nama }}</option>
          </select>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalFormTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenyimpan" @click="simpanHariLibur">
          {{ sedangMenyimpan ? 'Menyimpan...' : 'Tambahkan' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Konfirmasi Hapus Hari Libur"
      ukuran="sedang"
      @tutup="modalHapusTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Hapus "{{ liburAkanDihapus?.nama }}"?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Tanggal ini akan kembali dihitung sebagai hari efektif sekolah pada perhitungan biaya langganan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapus" @click="modalHapusTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapus" @click="konfirmasiHapusLibur">
          {{ sedangMenghapus ? 'Menghapus...' : 'Ya, Hapus' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
