<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { FileDown, Users, Star, Award, Wallet, Printer, Loader2, Radio, AlertTriangle, User, MessageCircle, Eye, History, Truck, Calendar } from 'lucide-vue-next';
import { tautanWhatsapp } from '../../bantuan/nomorTelepon';
import FilterLaporan from './FilterLaporan.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import {
  ambilLaporanPelanggan,
  ambilLaporanPerformaSupir,
  ambilAktivitasKeuangan,
  ambilAktivitasKeuanganById,
  ambilLaporanKendala,
  ambilRiwayatLaporanKendala,
  type LaporanPelangganRow,
  type LaporanPerformaSupir,
  type AktivitasKeuangan,
  type LaporanKendalaAdmin,
  type RiwayatLaporanKendala
} from '../../layanan/adminLayanan';
import { pantauPembayaranRealtime, pantauLaporanKendalaRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { unduhExcel } from '../../bantuan/eksporExcel';
import { unduhLaporanPdf } from '../../bantuan/laporanPdf';
import { formatMataUang } from '../../bantuan/formatMataUang';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Sub-tabs: pelanggan, performa, keuangan, kendala
const laporanTab = ref('pelanggan');

const sedangMemuat = ref(true);
const listPelanggan = ref<LaporanPelangganRow[]>([]);
const listPerformaSupir = ref<LaporanPerformaSupir[]>([]);
const listAktivitasKeuangan = ref<AktivitasKeuangan[]>([]);
const listLaporanKendala = ref<LaporanKendalaAdmin[]>([]);

// Filter Laporan Kendala
const filterKendalaKategori = ref('semua');
const filterKendalaStatus = ref('semua');
// Filter tanggal terpisah dari FilterLaporan di atas (yang khusus tab
// Keuangan) -- tab Kendala perlu menyaring berdasarkan dibuatPada sendiri,
// default kosong (tidak membatasi apa pun) supaya laporan lama tidak
// otomatis tersembunyi begitu admin membuka tab ini.
const filterKendalaDari = ref('');
const filterKendalaSampai = ref('');

const laporanKendalaTersaring = computed(() => {
  const dariMs = filterKendalaDari.value ? new Date(`${filterKendalaDari.value}T00:00:00`).getTime() : null;
  const sampaiMs = filterKendalaSampai.value ? new Date(`${filterKendalaSampai.value}T23:59:59.999`).getTime() : null;
  return listLaporanKendala.value.filter((l) => {
    const cocokKategori = filterKendalaKategori.value === 'semua' || l.kategori === filterKendalaKategori.value;
    const cocokStatus = filterKendalaStatus.value === 'semua' || l.status === filterKendalaStatus.value;
    const waktu = new Date(l.dibuatPada).getTime();
    const cocokDari = dariMs === null || waktu >= dariMs;
    const cocokSampai = sampaiMs === null || waktu <= sampaiMs;
    return cocokKategori && cocokStatus && cocokDari && cocokSampai;
  });
});

const labelKategoriKendala = (kategori: LaporanKendalaAdmin['kategori']) =>
  kategori === 'kendala_anak' ? 'Kendala Anak' : 'Kendala Perjalanan';

const labelStatusKendala = (status: LaporanKendalaAdmin['status']) =>
  status === 'baru' ? 'Baru' : status === 'ditindak' ? 'Ditindak' : 'Selesai';

const kelasStatusKendala = (status: LaporanKendalaAdmin['status']) => {
  if (status === 'baru') return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (status === 'ditindak') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
};

// Tautan WhatsApp klik-langsung utk kontak terkait laporan kendala --
// Anak Terkait (orang tua/wali, khusus kategori kendala_anak yang memang
// menyasar satu anak spesifik) dan Supir pelapor (kedua kategori).
// Dibangun sebagai fungsi (bukan computed per baris) karena dipanggil dari
// v-for, pesan pra-isi disesuaikan konteks laporan masing-masing.
const tautanWaOrangTua = (laporan: LaporanKendalaAdmin) => {
  if (!laporan.kontakOrangTua || !laporan.namaAnak) return null;
  const pesan = `Assalamu'alaikum, kami dari Admin Denanta TranSolution ingin menginformasikan terkait laporan kendala pada ananda ${laporan.namaAnak}: "${laporan.deskripsi}"`;
  return tautanWhatsapp(laporan.kontakOrangTua, pesan);
};

const tautanWaSupir = (laporan: LaporanKendalaAdmin) => {
  if (!laporan.kontakSupir) return null;
  const pesan = `Assalamu'alaikum Pak/Bu ${laporan.namaSupir}, kami dari Admin Denanta TranSolution ingin menindaklanjuti laporan kendala yang Anda kirimkan: "${laporan.deskripsi}"`;
  return tautanWhatsapp(laporan.kontakSupir, pesan);
};


// ==========================================
// Modal Detail Laporan Kendala -- read-only: menampilkan info lengkap
// pelapor, isi laporan, konteks perjalanan terkait, dan riwayat perubahan
// status (ambilRiwayatLaporanKendala). Admin TIDAK bisa mengubah status di
// sini lagi -- itu sekarang wewenang Supir pelapor sendiri lewat panel
// mereka (RiwayatSupir.vue), karena merekalah yang tahu persis kapan
// kendalanya benar-benar ditindaklanjuti/selesai.
// ==========================================
const modalDetailKendalaTampil = ref(false);
const laporanDetailAktif = ref<LaporanKendalaAdmin | null>(null);
const riwayatDetailAktif = ref<RiwayatLaporanKendala[]>([]);
const sedangMemuatRiwayat = ref(false);

async function muatRiwayatDetail(laporanId: string) {
  sedangMemuatRiwayat.value = true;
  try {
    riwayatDetailAktif.value = await ambilRiwayatLaporanKendala(laporanId);
  } catch {
    riwayatDetailAktif.value = [];
  } finally {
    sedangMemuatRiwayat.value = false;
  }
}

const bukaDetailKendala = async (laporan: LaporanKendalaAdmin) => {
  laporanDetailAktif.value = laporan;
  modalDetailKendalaTampil.value = true;
  await muatRiwayatDetail(laporan.id);
};

const tutupDetailKendala = () => {
  modalDetailKendalaTampil.value = false;
  laporanDetailAktif.value = null;
  riwayatDetailAktif.value = [];
};

function formatWaktuSingkat(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' • ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

// Laporan Keuangan berbasis AKTIVITAS (satu baris = satu transaksi nyata,
// bukan agregat bulanan) -- disaring memakai rentang tanggal yang sama
// dengan FilterLaporan di atas (Mulai/Selesai Tanggal, termasuk preset
// sekali-klik Minggu Ini/Bulan Ini/Tahun Ini di komponen itu). Default
// bulan berjalan supaya konsisten dengan nilai awal FilterLaporan.
function keTanggalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const hariIniAwal = new Date();
const rentangKeuangan = ref<{ mulai: string; selesai: string }>({
  mulai: keTanggalIso(new Date(hariIniAwal.getFullYear(), hariIniAwal.getMonth(), 1)),
  selesai: keTanggalIso(new Date(hariIniAwal.getFullYear(), hariIniAwal.getMonth() + 1, 0))
});

const tanganiFilterDiterapkan = (data: { mulai: string; selesai: string }) => {
  rentangKeuangan.value = data;
  picuToast('Rentang periode laporan berhasil diperbarui!', 'info');
};

const aktivitasKeuanganTersaring = computed(() => {
  const mulai = new Date(`${rentangKeuangan.value.mulai}T00:00:00`).getTime();
  const selesai = new Date(`${rentangKeuangan.value.selesai}T23:59:59.999`).getTime();
  return listAktivitasKeuangan.value.filter((a) => {
    const waktu = new Date(a.waktuAktivitas).getTime();
    return waktu >= mulai && waktu <= selesai;
  });
});

const totalPendapatanTersaring = computed(() =>
  aktivitasKeuanganTersaring.value.filter((a) => a.status === 'lunas').reduce((sum, a) => sum + a.jumlah, 0)
);

// Laporan Pelanggan -- SEBELUMNYA selalu dikelompokkan per bulan kalender
// (3 bulan terakhir, hard-coded), tidak peduli filter tanggal di atas.
// Sekarang disaring & dikelompokkan PER HARI memakai rentang yang sama
// dengan tab Keuangan (rentangKeuangan), sehingga preset "Minggu Ini" dkk.
// pada FilterLaporan benar-benar berlaku juga untuk tab ini. Hanya
// menampilkan tanggal yang benar-benar punya langganan baru (tidak mengisi
// tanggal kosong) supaya tabel tidak jadi sangat panjang untuk rentang luas
// seperti "Tahun Ini".
interface BarisPelangganHarian {
  tanggal: string;
  aktif: number;
  baru: number;
}
const laporanPelangganTersaring = computed<BarisPelangganHarian[]>(() => {
  const mulai = new Date(`${rentangKeuangan.value.mulai}T00:00:00`).getTime();
  const selesai = new Date(`${rentangKeuangan.value.selesai}T23:59:59.999`).getTime();
  const perTanggal = new Map<string, { aktif: number; baru: number }>();
  for (const l of listPelanggan.value) {
    const waktu = new Date(l.tanggalMulai).getTime();
    if (waktu < mulai || waktu > selesai) continue;
    const tgl = String(l.tanggalMulai).slice(0, 10);
    const cur = perTanggal.get(tgl) ?? { aktif: 0, baru: 0 };
    cur.baru += 1;
    if (l.sudahDibayar) cur.aktif += 1;
    perTanggal.set(tgl, cur);
  }
  return Array.from(perTanggal.entries())
    .map(([tanggal, v]) => ({ tanggal, ...v }))
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
});

const totalAktifTersaring = computed(() => laporanPelangganTersaring.value.reduce((sum, b) => sum + b.aktif, 0));
const totalBaruTersaring = computed(() => laporanPelangganTersaring.value.reduce((sum, b) => sum + b.baru, 0));

function formatTanggalRingkas(tanggalIso: string): string {
  const d = new Date(`${tanggalIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return tanggalIso;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

const labelTipePembayaran: Record<string, string> = {
  bulanan: 'Langganan Bulanan',
  harian: 'Langganan Harian',
  tambahan: 'Biaya Tambahan',
  pembatalan: 'Pembatalan'
};

const labelStatusPembayaran: Record<string, string> = {
  lunas: 'Lunas',
  menunggu: 'Menunggu',
  gagal: 'Gagal',
  kedaluwarsa: 'Kedaluwarsa'
};

// "Hari, DD Bulan YYYY • HH:mm WIB" -- mencakup hari, tanggal, bulan, tahun,
// jam, DAN menit aktivitas sesuai permintaan (bukan cuma tanggal).
function formatWaktuAktivitas(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const tanggal = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tanggal} • ${jam} WIB`;
}

// Realtime: setiap INSERT/UPDATE pada tabel `pembayaran` (mis. pengguna lain
// baru saja bayar via wizard berlangganan / tagihan bulan berikutnya)
// langsung disisipkan/diperbarui di daftar tanpa admin perlu refresh.
let langgananRealtimePembayaran: { unsubscribe: () => void } | null = null;
let langgananRealtimeKendala: { unsubscribe: () => void } | null = null;

async function tanganiPembayaranRealtime(payload: any) {
  const id = payload?.new?.id ?? payload?.old?.id;
  if (!id) return;
  try {
    const aktivitas = await ambilAktivitasKeuanganById(id);
    if (!aktivitas) return;
    const idx = listAktivitasKeuangan.value.findIndex((a) => a.id === aktivitas.id);
    if (idx >= 0) listAktivitasKeuangan.value[idx] = aktivitas;
    else listAktivitasKeuangan.value.unshift(aktivitas);
  } catch {
    // Abaikan -- aktivitas akan tetap muncul saat halaman dimuat ulang berikutnya
  }
}

// Laporan kendala butuh join anak/orang_tua/perjalanan yang tidak ikut
// terkirim di payload realtime -- alih-alih merakit ulang secara manual,
// cukup muat ulang daftar lengkapnya dari ambilLaporanKendala() (ringan,
// jarang terjadi, dan menjamin data selalu konsisten dengan hasil join).
async function tanganiKendalaRealtime() {
  try {
    listLaporanKendala.value = await ambilLaporanKendala();
  } catch {
    // Abaikan -- daftar akan tetap muncul saat halaman dimuat ulang berikutnya
  }
}

onMounted(async () => {
  sedangMemuat.value = true;
  try {
    // 30 detik -- SENGAJA lebih lama dari batas hard-abort 35 detik pada
    // fetch kustom (src/layanan/supabase.ts) hampir tercapai, tapi masih di
    // bawahnya. Sebelumnya 10 detik jauh lebih pendek, jadi Promise.race di
    // denganBatasWaktu() sering menang duluan dengan pesan generik "Waktu
    // permintaan habis" padahal request aslinya cuma butuh waktu sedikit
    // lebih lama dari itu (lihat catatan yang sama soal perbaruiKataSandi()
    // di useAuth.ts -- kelas bug yang sama). Pesan juga dibuat spesifik per
    // jenis data supaya kalau memang gagal, jelas laporan mana yang bermasalah.
    // Promise.allSettled (BUKAN Promise.all) -- SENGAJA supaya satu laporan
    // yang gagal/lambat tidak ikut menggagalkan ketiga laporan lain yang
    // sebenarnya berhasil dimuat. Sebelumnya Promise.all membuat SATU
    // timeout membuat SEMUA tab tampil kosong ("0"/belum ada data), padahal
    // 3 dari 4 query lainnya sebenarnya sukses.
    const [pelanggan, performa, keuangan, kendala] = await Promise.allSettled([
      denganBatasWaktu(ambilLaporanPelanggan(), 30000, 'Waktu memuat laporan pelanggan habis'),
      denganBatasWaktu(ambilLaporanPerformaSupir(), 30000, 'Waktu memuat laporan performa supir habis'),
      denganBatasWaktu(ambilAktivitasKeuangan(), 30000, 'Waktu memuat laporan keuangan habis'),
      denganBatasWaktu(ambilLaporanKendala(), 30000, 'Waktu memuat laporan kendala habis')
    ]);

    const gagal: string[] = [];
    if (pelanggan.status === 'fulfilled') listPelanggan.value = pelanggan.value;
    else gagal.push('Pelanggan');
    if (performa.status === 'fulfilled') listPerformaSupir.value = performa.value;
    else gagal.push('Performa Supir');
    if (keuangan.status === 'fulfilled') listAktivitasKeuangan.value = keuangan.value;
    else gagal.push('Keuangan');
    if (kendala.status === 'fulfilled') listLaporanKendala.value = kendala.value;
    else gagal.push('Kendala');

    if (gagal.length > 0) {
      picuToast(`Gagal memuat laporan: ${gagal.join(', ')}. Coba muat ulang halaman.`, 'error');
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat data laporan.', 'error');
  } finally {
    sedangMemuat.value = false;
  }

  langgananRealtimePembayaran = pantauPembayaranRealtime(tanganiPembayaranRealtime);
  langgananRealtimeKendala = pantauLaporanKendalaRealtime(tanganiKendalaRealtime);
});

onUnmounted(() => {
  langgananRealtimePembayaran?.unsubscribe();
  langgananRealtimeKendala?.unsubscribe();
});

// Susun judul, nama file, header kolom, dan baris data CSV/PDF sesuai
// tab laporan yang sedang aktif -- ekspor selalu memakai data yang SEDANG
// TAMPIL di layar (konsisten dengan perilaku UI saat ini).
const dataEksporAktif = computed(() => {
  if (laporanTab.value === 'pelanggan') {
    return {
      judul: 'Laporan Pelanggan Aktif',
      namaFile: 'Laporan-Pelanggan-Aktif',
      header: ['Tanggal', 'Langganan Aktif (Lunas)', 'Langganan Baru'],
      baris: laporanPelangganTersaring.value.map((pel) => [formatTanggalRingkas(pel.tanggal), pel.aktif, pel.baru])
    };
  }
  if (laporanTab.value === 'performa') {
    return {
      judul: 'Laporan Performa Driver',
      namaFile: 'Laporan-Performa-Driver',
      header: ['Nama Driver', 'Total Sesi Perjalanan Selesai', 'Rata-rata Rating Wali'],
      baris: listPerformaSupir.value.map((sup) => [
        sup.nama,
        sup.totalPerjalanan,
        sup.rataRataRating !== null ? sup.rataRataRating.toFixed(1) : '-'
      ])
    };
  }
  if (laporanTab.value === 'keuangan') {
    return {
      judul: 'Laporan Keuangan',
      namaFile: 'Laporan-Keuangan',
      header: ['Waktu Aktivitas', 'Nama Orang Tua', 'Jenis Pembayaran', 'Jumlah', 'Status'],
      baris: aktivitasKeuanganTersaring.value.map((a) => [
        formatWaktuAktivitas(a.waktuAktivitas),
        a.namaOrangTua,
        labelTipePembayaran[a.tipePembayaran] ?? a.tipePembayaran,
        formatMataUang(a.jumlah),
        labelStatusPembayaran[a.status] ?? a.status
      ])
    };
  }
  return {
    judul: 'Laporan Kendala Supir',
    namaFile: 'Laporan-Kendala-Supir',
    header: ['Waktu', 'Jenis', 'Supir', 'Anak Terkait', 'Deskripsi', 'Status'],
    baris: laporanKendalaTersaring.value.map((l) => [
      formatWaktuAktivitas(l.dibuatPada),
      labelKategoriKendala(l.kategori),
      l.namaSupir,
      l.namaAnak ?? '-',
      l.deskripsi,
      labelStatusKendala(l.status)
    ])
  };
});

const cetakLaporan = () => {
  const { judul, namaFile, header, baris } = dataEksporAktif.value;
  unduhLaporanPdf(judul, header, baris, namaFile);
};

const sedangEksporExcel = ref(false);
const eksporExcel = async () => {
  const { judul, namaFile, header, baris } = dataEksporAktif.value;
  sedangEksporExcel.value = true;
  try {
    await unduhExcel(judul, namaFile, header, baris);
  } catch (err: any) {
    picuToast(err.message || 'Gagal mengekspor ke Excel.', 'error');
  } finally {
    sedangEksporExcel.value = false;
  }
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

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Kelola Laporan</h1>
        <p class="text-xs text-on-surface-variant">Tinjau performa armada, pertumbuhan pelanggan, dan laporan kendala supir.</p>
      </div>

      <div class="flex gap-2">
        <button
          @click="eksporExcel"
          :disabled="sedangEksporExcel"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest hover:bg-opacity-95 text-on-surface cursor-pointer border border-outline-variant/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="sedangEksporExcel" class="w-4 h-4 text-primary animate-spin" />
          <FileDown v-else class="w-4 h-4 text-primary" />
          {{ sedangEksporExcel ? 'Mengekspor...' : 'Ekspor Excel' }}
        </button>

        <button
          @click="cetakLaporan"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-opacity-95 text-white cursor-pointer border border-primary"
        >
          <Printer class="w-4 h-4 text-white" /> Cetak PDF
        </button>
      </div>
    </div>

    <!-- Filter Component -->
    <FilterLaporan @terapkan="tanganiFilterDiterapkan" />

    <!-- Tabs Navigation -->
    <div class="flex border-b border-outline-variant/30 text-xs">
      <button
        @click="laporanTab = 'pelanggan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'pelanggan' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <Users class="w-4 h-4" /> Pelanggan Aktif
      </button>
      <button
        @click="laporanTab = 'performa'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'performa' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <Award class="w-4 h-4" /> Performa Driver
      </button>
      <button
        @click="laporanTab = 'keuangan'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'keuangan' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <Wallet class="w-4 h-4" /> Laporan Keuangan
      </button>
      <button
        @click="laporanTab = 'kendala'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5"
        :class="laporanTab === 'kendala' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        <AlertTriangle class="w-4 h-4" /> Laporan Kendala
      </button>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <!-- Tab Contents -->
    <div v-else class="space-y-6">

      <!-- 1. Laporan Pelanggan -- disaring memakai rentang tanggal yang sama
           dengan FilterLaporan di atas (Minggu Ini/Bulan Ini/Tahun Ini/rentang
           custom), bukan lagi selalu 3 bulan kalender terakhir. -->
      <div v-if="laporanTab === 'pelanggan'" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-primary-container/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span class="font-semibold text-on-surface-variant">Total Langganan Aktif (Lunas) Periode Ini:</span>
            <span class="font-mono font-black text-primary text-sm">{{ totalAktifTersaring }} Wali Murid</span>
          </div>
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span class="font-semibold text-on-surface-variant">Total Langganan Baru Periode Ini:</span>
            <span class="font-mono font-black text-emerald-600 text-sm">+{{ totalBaruTersaring }}</span>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px] py-3">
                <th class="py-3 px-4">Tanggal</th>
                <th class="py-3 px-4">Langganan Aktif (Lunas)</th>
                <th class="py-3 px-4">Langganan Baru</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="pel in laporanPelangganTersaring" :key="pel.tanggal" class="hover:bg-surface-container transition-colors">
                <td class="py-3.5 px-4 font-bold">{{ formatTanggalRingkas(pel.tanggal) }}</td>
                <td class="py-3.5 px-4 font-mono font-bold">{{ pel.aktif }} Wali Murid</td>
                <td class="py-3.5 px-4 font-mono text-emerald-600 font-semibold">+{{ pel.baru }}</td>
              </tr>
              <tr v-if="laporanPelangganTersaring.length === 0">
                <td colspan="3" class="py-8 text-center text-on-surface-variant italic">Belum ada langganan baru pada periode ini.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. Laporan Performa Driver -->
      <div v-else-if="laporanTab === 'performa'" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px] py-3">
              <th class="py-3 px-4">Nama Driver</th>
              <th class="py-3 px-4">Total Sesi Perjalanan Selesai</th>
              <th class="py-3 px-4">Rata-rata Rating Wali</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
            <tr v-for="sup in listPerformaSupir" :key="sup.supirId" class="hover:bg-surface-container transition-colors">
              <td class="py-4 px-4 font-semibold text-on-surface">{{ sup.nama }}</td>
              <td class="py-4 px-4 font-mono">{{ sup.totalPerjalanan }} Trip</td>
              <td class="py-4 px-4 font-mono font-bold text-amber-600 flex items-center gap-1">
                <Star class="w-3.5 h-3.5 fill-current" /> {{ sup.rataRataRating !== null ? sup.rataRataRating.toFixed(1) : '-' }}
              </td>
            </tr>
            <tr v-if="listPerformaSupir.length === 0">
              <td colspan="3" class="py-8 text-center text-on-surface-variant italic">Belum ada data performa supir.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. Laporan Keuangan (berbasis aktivitas real-time, disaring lewat FilterLaporan di atas) -->
      <div v-else-if="laporanTab === 'keuangan'" class="space-y-4">
        <div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-fit">
          <Radio class="w-3 h-3 animate-pulse" /> Live -- aktivitas baru otomatis terekap
        </div>

        <div class="bg-primary-container/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
          <span class="font-semibold text-on-surface-variant">Total Pendapatan (Lunas) Periode Ini:</span>
          <span class="font-mono font-black text-primary text-sm">{{ formatMataUang(totalPendapatanTersaring) }}</span>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px] py-3">
                <th class="py-3 px-4">Waktu Aktivitas</th>
                <th class="py-3 px-4">Orang Tua</th>
                <th class="py-3 px-4">Jenis Pembayaran</th>
                <th class="py-3 px-4">Jumlah</th>
                <th class="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="a in aktivitasKeuanganTersaring" :key="a.id" class="hover:bg-surface-container transition-colors">
                <td class="py-3.5 px-4 font-mono text-[11px]">{{ formatWaktuAktivitas(a.waktuAktivitas) }}</td>
                <td class="py-3.5 px-4 font-semibold text-on-surface">{{ a.namaOrangTua }}</td>
                <td class="py-3.5 px-4">{{ labelTipePembayaran[a.tipePembayaran] ?? a.tipePembayaran }}</td>
                <td class="py-3.5 px-4 font-mono font-bold text-on-surface">{{ formatMataUang(a.jumlah) }}</td>
                <td class="py-3.5 px-4">
                  <span
                    class="px-2 py-0.5 rounded font-bold uppercase text-[9px]"
                    :class="{
                      'bg-emerald-50 text-emerald-700 border border-emerald-200': a.status === 'lunas',
                      'bg-amber-50 text-amber-700 border border-amber-200': a.status === 'menunggu',
                      'bg-rose-50 text-rose-700 border border-rose-200': a.status === 'gagal' || a.status === 'kedaluwarsa'
                    }"
                  >
                    {{ labelStatusPembayaran[a.status] ?? a.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="aktivitasKeuanganTersaring.length === 0">
                <td colspan="5" class="py-8 text-center text-on-surface-variant italic">Belum ada aktivitas keuangan pada periode ini.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Laporan Kendala Supir -->
      <div v-else-if="laporanTab === 'kendala'" class="space-y-4">
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 soft-shadow text-xs">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Jenis Kendala:</label>
            <select
              v-model="filterKendalaKategori"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="semua">Semua Jenis</option>
              <option value="kendala_perjalanan">Kendala Perjalanan</option>
              <option value="kendala_anak">Kendala Anak</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Status:</label>
            <select
              v-model="filterKendalaStatus"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="semua">Semua Status</option>
              <option value="baru">Baru</option>
              <option value="ditindak">Ditindak</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Dari Tanggal:</label>
            <input
              type="date"
              v-model="filterKendalaDari"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Sampai Tanggal:</label>
            <input
              type="date"
              v-model="filterKendalaSampai"
              :min="filterKendalaDari || undefined"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                  <th class="py-3 px-4">Waktu</th>
                  <th class="py-3 px-4">Jenis</th>
                  <th class="py-3 px-4">Supir</th>
                  <th class="py-3 px-4">Anak Terkait</th>
                  <th class="py-3 px-4">Deskripsi</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
                <tr v-for="laporan in laporanKendalaTersaring" :key="laporan.id" class="hover:bg-surface-container transition-colors align-top">
                  <td class="py-4 px-4 whitespace-nowrap font-mono text-[11px]">{{ formatWaktuAktivitas(laporan.dibuatPada) }}</td>
                  <td class="py-4 px-4">
                    <span
                      class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px] border"
                      :class="laporan.kategori === 'kendala_anak' ? 'bg-brand-tosca-light text-primary border-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/40'"
                    >
                      {{ labelKategoriKendala(laporan.kategori) }}
                    </span>
                  </td>
                  <td class="py-4 px-4 font-semibold text-on-surface">
                    <div class="flex items-center gap-1.5">
                      <span>{{ laporan.namaSupir }}</span>
                      <a
                        v-if="tautanWaSupir(laporan)"
                        :href="tautanWaSupir(laporan)!"
                        target="_blank"
                        rel="noopener"
                        title="Hubungi supir via WhatsApp"
                        class="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                      >
                        <MessageCircle class="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <div v-if="laporan.namaAnak" class="flex items-center gap-1.5">
                      <span class="flex items-center gap-1"><User class="w-3.5 h-3.5 flex-shrink-0" /> {{ laporan.namaAnak }}</span>
                      <a
                        v-if="tautanWaOrangTua(laporan)"
                        :href="tautanWaOrangTua(laporan)!"
                        target="_blank"
                        rel="noopener"
                        title="Hubungi orang tua/wali via WhatsApp"
                        class="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                      >
                        <MessageCircle class="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <span v-else>-</span>
                  </td>
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
                      @click="bukaDetailKendala(laporan)"
                      class="px-2.5 py-1.5 border border-outline-variant/40 text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye class="w-3.5 h-3.5" /> Detail
                    </button>
                  </td>
                </tr>
                <tr v-if="laporanKendalaTersaring.length === 0">
                  <td colspan="7" class="py-8 text-center text-on-surface-variant italic">Belum ada laporan kendala yang cocok dengan filter ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- Modal Detail Laporan Kendala: info lengkap pelapor, isi laporan,
         konteks perjalanan, riwayat perubahan status, dan aksi pengelolaan
         (ubah status + catatan penyelesaian) dalam satu tempat. -->
    <ModalUtama
      tema="terang"
      :tampil="modalDetailKendalaTampil"
      judul="Detail Laporan Kendala"
      @tutup="tutupDetailKendala"
    >
      <div v-if="laporanDetailAktif" class="space-y-5 text-sm text-left">
        <!-- Ringkasan -->
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px] border"
            :class="laporanDetailAktif.kategori === 'kendala_anak' ? 'bg-brand-tosca-light text-primary border-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/40'"
          >
            {{ labelKategoriKendala(laporanDetailAktif.kategori) }}
          </span>
          <span class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]" :class="kelasStatusKendala(laporanDetailAktif.status)">
            {{ labelStatusKendala(laporanDetailAktif.status) }}
          </span>
        </div>

        <!-- Info Pelapor & Konteks Perjalanan -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container p-3 rounded-xl text-xs">
          <div class="flex items-start gap-2">
            <Truck class="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-on-surface-variant uppercase text-[9px] font-bold tracking-wide">Pelapor (Supir)</p>
              <p class="font-semibold text-on-surface">{{ laporanDetailAktif.namaSupir }}</p>
              <a
                v-if="tautanWaSupir(laporanDetailAktif)"
                :href="tautanWaSupir(laporanDetailAktif)!"
                target="_blank" rel="noopener"
                class="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 mt-0.5"
              >
                <MessageCircle class="w-3 h-3" /> Hubungi via WhatsApp
              </a>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <Calendar class="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-on-surface-variant uppercase text-[9px] font-bold tracking-wide">Sesi Perjalanan</p>
              <p class="font-semibold text-on-surface">
                {{ laporanDetailAktif.jenisPerjalanan === 'pagi' ? 'Sesi Pagi (Jemput)' : laporanDetailAktif.jenisPerjalanan === 'sore' ? 'Sesi Sore (Antar)' : '-' }}
                <span v-if="laporanDetailAktif.tanggalPerjalanan" class="font-normal text-on-surface-variant">• {{ laporanDetailAktif.tanggalPerjalanan }}</span>
              </p>
            </div>
          </div>
          <div v-if="laporanDetailAktif.namaAnak" class="flex items-start gap-2 sm:col-span-2">
            <User class="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-on-surface-variant uppercase text-[9px] font-bold tracking-wide">Anak Terkait</p>
              <p class="font-semibold text-on-surface">{{ laporanDetailAktif.namaAnak }}</p>
              <a
                v-if="tautanWaOrangTua(laporanDetailAktif)"
                :href="tautanWaOrangTua(laporanDetailAktif)!"
                target="_blank" rel="noopener"
                class="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 mt-0.5"
              >
                <MessageCircle class="w-3 h-3" /> Hubungi Orang Tua/Wali
              </a>
            </div>
          </div>
        </div>

        <!-- Isi Laporan -->
        <div>
          <p class="text-on-surface-variant uppercase text-[9px] font-bold tracking-wide mb-1">Isi Laporan • {{ formatWaktuSingkat(laporanDetailAktif.dibuatPada) }}</p>
          <p class="text-on-surface leading-relaxed bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3">{{ laporanDetailAktif.deskripsi }}</p>
        </div>

        <!-- Riwayat Perubahan -->
        <div>
          <p class="text-on-surface-variant uppercase text-[9px] font-bold tracking-wide mb-1.5 flex items-center gap-1">
            <History class="w-3.5 h-3.5" /> Riwayat Perubahan
          </p>
          <div v-if="sedangMemuatRiwayat" class="flex justify-center py-4">
            <Loader2 class="w-5 h-5 text-primary animate-spin" />
          </div>
          <p v-else-if="riwayatDetailAktif.length === 0" class="text-xs text-on-surface-variant italic">Belum ada perubahan status pada laporan ini.</p>
          <ul v-else class="space-y-2">
            <li
              v-for="r in riwayatDetailAktif"
              :key="r.id"
              class="text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-on-surface">
                  {{ r.statusSebelum ? labelStatusKendala(r.statusSebelum as any) : 'Dibuat' }} → {{ labelStatusKendala(r.statusSesudah as any) }}
                </span>
                <span class="text-on-surface-variant font-mono text-[10px] whitespace-nowrap">{{ formatWaktuSingkat(r.dibuatPada) }}</span>
              </div>
              <p class="text-on-surface-variant mt-0.5">oleh {{ r.namaPengubah || 'Admin' }}</p>
              <p v-if="r.catatan" class="text-on-surface-variant italic mt-1">"{{ r.catatan }}"</p>
            </li>
          </ul>
        </div>

        <!-- Status hanya bisa diubah oleh Supir pelapor sendiri lewat panel
             mereka (Riwayat Perjalanan & Tugas -> Laporan Kendala Saya) --
             Admin di sini murni memantau. -->
        <div class="flex items-start gap-2 text-[11px] text-on-surface-variant bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3">
          <Eye class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Status penanganan ditandai sendiri oleh supir pelapor, bukan dari sini.</span>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="tutupDetailKendala">Tutup</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
