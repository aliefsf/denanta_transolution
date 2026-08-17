<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ArrowLeft, MapPin, School, Clock, ShieldCheck, User, MessageCircle, Lock, Check
} from 'lucide-vue-next';
import { tautanWhatsapp } from '../../bantuan/nomorTelepon';
import TombolUtama from '../umum/TombolUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import PemilihPeta from '../umum/PemilihPeta.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';
import PetaLokasiLangsung from './PetaLokasiLangsung.vue';
import GarisWaktuPerjalanan from './GarisWaktuPerjalanan.vue';
import PenilaianSupir from './PenilaianSupir.vue';
import { ambilRiwayatPerjalanan, perbaruiAlamatAnak, type PerjalananDenganSupir } from '../../layanan/orangTuaLayanan';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import { LABEL_LAYANAN } from '../../bantuan/petakanAnak';
import { formatWaktuTahapan } from '../../bantuan/statusPerjalanan';
import { ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import type { AnakTampilan } from '../../tipe';

interface Props {
  anak: AnakTampilan;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'kembali'): void;
}>();

// Salinan lokal reaktif agar bisa diperbarui setelah penyimpanan berhasil,
// tanpa memutasi prop secara langsung.
const anakData = ref<AnakTampilan>({ ...props.anak });
watch(
  () => props.anak,
  (val) => {
    anakData.value = { ...val };
  }
);

// Perjalanan pagi & sore hari ini -- disinkronkan realtime lewat useDataOrangTua,
// dipakai GarisWaktuPerjalanan agar setiap tahap mengikuti waktu_jemput/waktu_antar
// persis saat supir mengubah status (bukan jam tetap).
const { perjalananHariIniList } = useDataOrangTua();
const perjalananPagiHariIni = computed(
  () => perjalananHariIniList.value.find((p) => p.anak_id === anakData.value.id && p.jenis_perjalanan === 'pagi') ?? null
);
const perjalananSoreHariIni = computed(
  () => perjalananHariIniList.value.find((p) => p.anak_id === anakData.value.id && p.jenis_perjalanan === 'sore') ?? null
);

const modalUbahAlamatTampil = ref(false);
const lintangBaru = ref(anakData.value.lintangJemput);
const bujurBaru = ref(anakData.value.bujurJemput);
const alamatBaruTeks = ref('');
const sedangMenyimpanAlamat = ref(false);
const errorAlamat = ref<string | null>(null);

// Popup konfirmasi -- BUKAN transaksi berbayar (perubahan alamat berdiri
// sendiri di halaman ini selalu gratis, beda dari "Ajukan Perubahan Jadwal"
// yang punya biaya tambahan berbasis jarak & gerbang pembayaran sendiri di
// JadwalOrangTua.vue), jadi tidak ada invoice/struk di sini -- cukup
// konfirmasi visual bahwa alamat baru sudah tersimpan & diteruskan ke supir.
const modalAlamatBerhasilTampil = ref(false);
const alamatBerhasilDisimpan = ref('');

const tanganiPetaBaru = (data: { lintang: number; bujur: number; alamat: string }) => {
  lintangBaru.value = data.lintang;
  bujurBaru.value = data.bujur;
  alamatBaruTeks.value = data.alamat;
};

const simpanAlamatBaru = async () => {
  if (!alamatBaruTeks.value) return;
  sedangMenyimpanAlamat.value = true;
  errorAlamat.value = null;
  try {
    await perbaruiAlamatAnak({
      anakId: anakData.value.id,
      namaAnak: anakData.value.nama,
      alamatJemput: alamatBaruTeks.value,
      lintangJemput: lintangBaru.value,
      bujurJemput: bujurBaru.value
    });
    anakData.value.alamatJemput = alamatBaruTeks.value;
    anakData.value.lintangJemput = lintangBaru.value;
    anakData.value.bujurJemput = bujurBaru.value;
    modalUbahAlamatTampil.value = false;
    alamatBerhasilDisimpan.value = alamatBaruTeks.value;
    modalAlamatBerhasilTampil.value = true;
  } catch (err: any) {
    errorAlamat.value = err.message || 'Gagal memperbarui alamat penjemputan.';
  } finally {
    sedangMenyimpanAlamat.value = false;
  }
};

// Riwayat perjalanan sebelumnya (real)
const riwayatSebelumnya = ref<PerjalananDenganSupir[]>([]);
const sedangMemuatRiwayat = ref(false);
const errorRiwayat = ref<string | null>(null);

onMounted(async () => {
  sedangMemuatRiwayat.value = true;
  errorRiwayat.value = null;
  try {
    const hariIni = ambilTanggalWibSekarang();
    const hasil = await ambilRiwayatPerjalanan([anakData.value.id]);
    riwayatSebelumnya.value = hasil.filter((p) => p.tanggal_perjalanan !== hariIni).slice(0, 10);
  } catch (err: any) {
    errorRiwayat.value = err.message || 'Gagal memuat riwayat perjalanan.';
  } finally {
    sedangMemuatRiwayat.value = false;
  }
});

function formatTanggalIndo(tanggalIso: string): string {
  const tanggal = new Date(tanggalIso);
  if (Number.isNaN(tanggal.getTime())) return tanggalIso;
  return tanggal.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function hitungDurasi(mulai: string | null, selesai: string | null): string {
  if (!mulai || !selesai) return '-';
  const menit = Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / 60000);
  if (Number.isNaN(menit) || menit < 0) return '-';
  return `${menit} Menit`;
}

const labelLayanan = computed(() => (trip: PerjalananDenganSupir) => LABEL_LAYANAN[trip.jenis_layanan] ?? trip.jenis_layanan);

// Waktu tepatnya supir mengubah status penjemputan (waktu_jemput) & tiba
// (waktu_antar) pada satu baris riwayat -- ditampilkan di Histori
// Perjalanan Sebelumnya supaya orang tua tahu jam pastinya, bukan cuma
// durasinya.
const labelWaktuTrip = computed(() => (trip: PerjalananDenganSupir) => {
  const jemput = formatWaktuTahapan(trip.waktu_jemput);
  const antar = formatWaktuTahapan(trip.waktu_antar);
  return `Jemput: ${jemput} • Tiba: ${antar}`;
});

// Live Share Location terkunci begitu anak "Sampai Tujuan" (checkpoint tiba
// sore) sampai perjalanan berikutnya dimulai lagi (status kembali jadi
// 'penjemputan' pada jadwal esok hari) -- 'sampai_tujuan' & 'rumah' adalah
// dua tahap dari kondisi yang sama (lihat apakahMasihSampaiTujuan di
// statusPerjalanan.ts), jadi keduanya mengunci fitur ini.
const liveShareTersedia = computed(
  () => anakData.value.status !== 'sampai_tujuan' && anakData.value.status !== 'rumah'
);

const tautanWhatsappSupir = computed(() => {
  if (!anakData.value.kontakSupir) return null;
  const pesan = `Assalamu'alaikum Pak ${anakData.value.namaSupir || ''}, saya orang tua dari ${anakData.value.nama}. Ingin menanyakan perihal penjemputan/pengantaran hari ini.`;
  return tautanWhatsapp(anakData.value.kontakSupir, pesan);
});

const laporanKendalaList = computed(() => {
  const list: any[] = [];
  if (perjalananPagiHariIni.value?.laporan_kendala) {
    list.push(...perjalananPagiHariIni.value.laporan_kendala);
  }
  if (perjalananSoreHariIni.value?.laporan_kendala) {
    list.push(...perjalananSoreHariIni.value.laporan_kendala);
  }
  return list.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
});

// Kendala yang MASIH AKTIF (belum 'selesai') ditonjolkan sebagai kartu besar
// -- itu yang benar-benar butuh perhatian orang tua saat ini. Yang sudah
// 'selesai' TIDAK PERNAH hilang dari database (log permanen), tapi kalau
// tetap ditampilkan sebesar itu selamanya, halaman ini lama-lama penuh
// kartu merah basi padahal masalahnya sudah beres -- jadi dipindah ke
// riwayat ringkas yang bisa dilipat (lihat kendalaSelesaiList & riwayatKendalaTerbuka).
const kendalaAktifList = computed(() => laporanKendalaList.value.filter((k) => k.status !== 'selesai'));
const kendalaSelesaiList = computed(() => laporanKendalaList.value.filter((k) => k.status === 'selesai'));
const riwayatKendalaTerbuka = ref(false);

function formatWaktuLaporan(waktuIso: string | null | undefined): string {
  if (!waktuIso) return '-';
  const d = new Date(waktuIso);
  if (Number.isNaN(d.getTime())) return waktuIso;
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

function formatSesi(perjalananId: string): string {
  if (perjalananPagiHariIni.value?.id === perjalananId) return 'Perjalanan Pagi';
  if (perjalananSoreHariIni.value?.id === perjalananId) return 'Perjalanan Sore';
  return 'Perjalanan';
}

// Nama supir yang menangani perjalanan rujukan laporan kendala ini --
// perjalananPagiHariIni/perjalananSoreHariIni sudah lengkap dengan namaSupir
// lewat lengkapiNamaSupir() (orangTuaLayanan.ts), jadi tinggal dicocokkan ID-nya.
function namaSupirPelapor(perjalananId: string): string | null {
  if (perjalananPagiHariIni.value?.id === perjalananId) return perjalananPagiHariIni.value.namaSupir ?? null;
  if (perjalananSoreHariIni.value?.id === perjalananId) return perjalananSoreHariIni.value.namaSupir ?? null;
  return null;
}

function formatStatusSaatKejadian(status: string | null | undefined): string {
  if (!status) return 'Dijadwalkan';
  const map: Record<string, string> = {
    dijadwalkan: 'Dijadwalkan',
    penjemputan: 'Penjemputan',
    menuju_sekolah: 'Menuju Sekolah',
    di_sekolah: 'Di Sekolah',
    pengantaran: 'Pengantaran Pulang',
    tiba: 'Sampai Tujuan',
    dibatalkan: 'Dibatalkan'
  };
  return map[status] ?? status;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with back button -->
    <div class="flex items-center gap-3">
      <button
        @click="emit('kembali')"
        class="p-2 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
      >
        <ArrowLeft class="w-5 h-5" />
      </button>
      <div>
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Detail Perjalanan Siswa</h1>
        <p class="text-xs text-on-surface-variant">Informasi pergerakan armada dan riwayat absensi harian.</p>
      </div>
    </div>

    <!-- Main Detail Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Left (2 Columns): Map and Timeline -->
      <div class="lg:col-span-2 space-y-6">

        <!-- Banner Laporan Kendala Hari Ini -- HANYA yang masih aktif (belum
             'selesai'); yang sudah selesai dipindah ke riwayat ringkas di
             bawah supaya halaman ini tidak terus dipenuhi kartu merah basi. -->
        <div v-if="kendalaAktifList.length > 0" class="space-y-4">
          <div
            v-for="kendala in kendalaAktifList"
            :key="kendala.id"
            class="bg-rose-50/90 border border-rose-200 text-rose-900 rounded-2xl p-5 soft-shadow flex flex-col gap-3 relative overflow-hidden"
          >
            <!-- Background accent strip -->
            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>

            <div class="flex items-start justify-between gap-4 pl-2">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                    {{ kendala.kategori === 'kendala_anak' ? 'Kendala Anak' : 'Kendala Perjalanan' }}
                  </span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    :class="
                      kendala.status === 'selesai'
                        ? 'bg-emerald-100 text-emerald-700'
                        : kendala.status === 'ditindak'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700 border border-rose-200'
                    "
                  >
                    {{
                      kendala.status === 'selesai'
                        ? 'Selesai'
                        : kendala.status === 'ditindak'
                        ? 'Diproses'
                        : 'Belum Ditangani'
                    }}
                  </span>
                </div>
                <h4 class="text-xs md:text-sm font-bold text-on-surface">
                  {{ kendala.deskripsi }}
                </h4>
              </div>
              <span class="text-[10px] text-on-surface-variant font-mono font-bold whitespace-nowrap">
                {{ formatWaktuLaporan(kendala.dibuat_pada) }}
              </span>
            </div>

            <div class="text-[10px] md:text-xs text-on-surface-variant bg-surface-container/30 border border-outline-variant/20 rounded-xl px-3 py-2 flex flex-wrap gap-x-4 gap-y-1.5 items-center pl-4">
              <span>
                <strong>Sesi:</strong> {{ formatSesi(kendala.perjalanan_id) }}
              </span>
              <span class="hidden md:inline text-outline-variant">•</span>
              <span>
                <strong>Status saat kejadian:</strong> {{ formatStatusSaatKejadian(kendala.status_perjalanan) }}
              </span>
              <span v-if="namaSupirPelapor(kendala.perjalanan_id)" class="hidden md:inline text-outline-variant">•</span>
              <span v-if="namaSupirPelapor(kendala.perjalanan_id)">
                <strong>Supir Pelapor:</strong> {{ namaSupirPelapor(kendala.perjalanan_id) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Riwayat Kendala Sudah Selesai -- dilipat default, cuma ringkasan
             satu baris per laporan supaya tetap tercatat tanpa memenuhi
             halaman dengan kartu besar utk masalah yang sudah beres. -->
        <div v-if="kendalaSelesaiList.length > 0" class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden soft-shadow">
          <button
            type="button"
            @click="riwayatKendalaTerbuka = !riwayatKendalaTerbuka"
            class="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container/40 transition-colors cursor-pointer"
          >
            <span class="flex items-center gap-1.5">
              <Check class="w-3.5 h-3.5 text-emerald-600" />
              Riwayat Kendala Selesai Hari Ini ({{ kendalaSelesaiList.length }})
            </span>
            <span class="text-[10px] text-primary">{{ riwayatKendalaTerbuka ? 'Sembunyikan' : 'Lihat' }}</span>
          </button>
          <div v-if="riwayatKendalaTerbuka" class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
            <div v-for="kendala in kendalaSelesaiList" :key="kendala.id" class="px-4 py-2.5 text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700">Selesai</span>
              <span class="font-semibold text-on-surface">{{ kendala.kategori === 'kendala_anak' ? 'Kendala Anak' : 'Kendala Perjalanan' }}</span>
              <span class="text-on-surface-variant">-- {{ formatSesi(kendala.perjalanan_id) }}</span>
              <span class="text-on-surface-variant">-- {{ kendala.deskripsi }}</span>
              <span class="text-on-surface-variant font-mono ml-auto">{{ formatWaktuLaporan(kendala.dibuat_pada) }}</span>
            </div>
          </div>
        </div>

        <!-- Live Map Tracking Box -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <MapPin class="w-4 h-4 text-primary" />
              Peta Pelacakan Lokasi Langsung
            </h3>
            <span
              v-if="liveShareTersedia"
              class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
            >GPS Aktif</span>
            <span
              v-else
              class="text-[10px] text-on-surface-variant bg-outline-variant/10 px-2 py-0.5 rounded border border-outline-variant/40"
            >Terkunci</span>
          </div>

          <PetaLokasiLangsung
            v-if="liveShareTersedia"
            :lintangRumah="anakData.lintangJemput"
            :bujurRumah="anakData.bujurJemput"
            :lintang-sekolah="anakData.lintangSekolah ?? undefined"
            :bujur-sekolah="anakData.bujurSekolah ?? undefined"
            :supirId="anakData.supirId"
          />
          <div
            v-else
            class="flex flex-col items-center justify-center text-center gap-2 py-10 px-6 bg-surface-container/60 border border-outline-variant/20 rounded-2xl"
          >
            <div class="w-10 h-10 rounded-full bg-outline-variant/10 flex items-center justify-center">
              <Lock class="w-5 h-5 text-on-surface-variant" />
            </div>
            <p class="text-xs font-bold text-on-surface">Live Share Location Tidak Tersedia</p>
            <p class="text-[11px] text-on-surface-variant max-w-xs">
              Anak sudah sampai tujuan. Pelacakan akan aktif kembali begitu supir memulai penjemputan pada jadwal perjalanan berikutnya.
            </p>
          </div>
        </div>

        <!-- Today Journey Timeline -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-6 soft-shadow">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-primary" />
            Garis Waktu Absensi Perjalanan Hari Ini
          </h3>
          <GarisWaktuPerjalanan
            :perjalanan-pagi="perjalananPagiHariIni"
            :perjalanan-sore="perjalananSoreHariIni"
          />
        </div>

        <!-- Past Journey History -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-2xl space-y-4 soft-shadow relative min-h-[120px]">
          <MemuatUtama tema="terang" :tampil="sedangMemuatRiwayat" pesan="Memuat riwayat..." />
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Histori Perjalanan Sebelumnya</h3>
          <div v-if="errorRiwayat" class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {{ errorRiwayat }}
          </div>
          <div v-else-if="!sedangMemuatRiwayat && riwayatSebelumnya.length === 0" class="text-xs text-on-surface-variant text-center py-6">
            Belum ada riwayat perjalanan sebelumnya.
          </div>
          <div v-else class="divide-y divide-outline-variant/20">
            <div
              v-for="trip in riwayatSebelumnya"
              :key="trip.id"
              class="py-3 flex justify-between items-center text-xs"
            >
              <div>
                <p class="font-bold text-on-surface">{{ formatTanggalIndo(trip.tanggal_perjalanan) }}</p>
                <p class="text-on-surface-variant mt-0.5">Supir: {{ trip.namaSupir || '-' }} | Rute: {{ labelLayanan(trip) }}</p>
                <p class="text-on-surface-variant mt-0.5 font-mono text-[10px]">{{ labelWaktuTrip(trip) }}</p>
              </div>
              <div class="text-right space-y-1">
                <span
                  class="inline-block px-2 py-0.5 rounded border"
                  :class="trip.status === 'tiba' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : trip.status === 'dibatalkan' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                >
                  {{ trip.status === 'tiba' ? 'Selesai' : trip.status === 'dibatalkan' ? 'Dibatalkan' : 'Berlangsung' }}
                </span>
                <p class="text-[10px] text-on-surface-variant font-mono">{{ hitungDurasi(trip.waktu_jemput, trip.waktu_antar) }}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right (1 Column): Child Info & Actions -->
      <div class="space-y-6">
        <!-- Profile Card & Details -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow relative overflow-hidden">
          <div class="flex items-center gap-4 border-b border-outline-variant/20 pb-4">
            <img v-if="anakData.foto" :src="anakData.foto" :alt="anakData.nama" class="w-14 h-14 rounded-2xl object-cover border border-outline-variant/30" />
            <div v-else class="w-14 h-14 rounded-2xl bg-primary-container/20 border border-outline-variant/30 flex items-center justify-center text-primary font-bold">
              {{ anakData.nama.charAt(0) }}
            </div>
            <div>
              <h3 class="text-base font-bold text-on-surface">{{ anakData.nama }}</h3>
              <BadgeStatusAnak :status="anakData.status" class="mt-1" />
            </div>
          </div>

          <div class="space-y-4 text-xs">
            <div class="space-y-1">
              <p class="text-on-surface-variant flex items-center gap-1"><School class="w-3.5 h-3.5 text-primary" /> Sekolah & Kelas</p>
              <p class="text-on-surface font-bold">{{ anakData.sekolah }} | {{ anakData.kelas }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-on-surface-variant flex items-center gap-1"><ShieldCheck class="w-3.5 h-3.5 text-primary" /> Jenis Layanan</p>
              <p class="text-on-surface font-bold">{{ anakData.layanan }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-on-surface-variant flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-primary" /> Alamat Penjemputan</p>
              <p class="text-on-surface-variant font-semibold leading-relaxed">{{ anakData.alamatJemput }}</p>
            </div>

            <!-- Info Supir Bertugas -->
            <div class="space-y-1 pt-2 border-t border-outline-variant/20">
              <p class="text-on-surface-variant flex items-center gap-1"><User class="w-3.5 h-3.5 text-primary" /> Supir Bertugas</p>
              <div class="flex items-center gap-3 mt-1.5">
                <div class="w-10 h-10 rounded-full bg-surface-container overflow-hidden flex items-center justify-center flex-shrink-0 border border-outline-variant/30">
                  <img v-if="anakData.fotoSupir" :src="anakData.fotoSupir" :alt="anakData.namaSupir || 'Supir'" class="w-full h-full object-cover" />
                  <User v-else class="w-5 h-5 text-on-surface-variant" />
                </div>
                <div>
                  <p class="text-on-surface font-bold text-sm">{{ anakData.namaSupir || 'Belum ditugaskan' }}</p>
                  <p v-if="anakData.kontakSupir" class="text-on-surface-variant font-mono text-[11px]">{{ anakData.kontakSupir }}</p>
                </div>
              </div>
            </div>

            <!-- Action buttons parent -->
            <div class="space-y-2 pt-2">
              <TombolUtama tema="terang" varian="utama" class="w-full text-xs py-2.5" @click="modalUbahAlamatTampil = true">
                Perbarui Alamat Jemput
              </TombolUtama>
              <a v-if="tautanWhatsappSupir" :href="tautanWhatsappSupir" target="_blank" rel="noopener" class="block w-full">
                <TombolUtama tema="terang" varian="garis-luar" class="w-full text-xs py-2.5 gap-1.5 !text-emerald-600 !border-emerald-300 hover:!bg-emerald-50">
                  <MessageCircle class="w-4 h-4" />
                  Hubungi via WhatsApp
                </TombolUtama>
              </a>
            </div>
          </div>
        </div>

        <!-- Driver Review Box (Optional) -- disembunyikan bila status hari ini
             Absen/Libur, karena tidak ada layanan supir yang bisa dinilai. -->
        <PenilaianSupir
          v-if="anakData.namaSupir && anakData.status !== 'absen'"
          :namaSupir="anakData.namaSupir"
          :supirId="anakData.supirId"
          :perjalananId="anakData.perjalananId"
        />
      </div>

    </div>

    <!-- Modal Ubah Alamat Pin Point Map -->
    <ModalUtama
      tema="terang"
      :tampil="modalUbahAlamatTampil"
      judul="Pindahkan Koordinat Jemput Anak"
      ukuran="lebar"
      @tutup="modalUbahAlamatTampil = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-on-surface-variant">
          Silakan geser pin pada peta di bawah untuk memperbarui lokasi penjemputan anak Anda secara real-time. Rute supir otomatis menyesuaikan.
        </p>
        <PemilihPeta
          tema="terang"
          :lintang="anakData.lintangJemput"
          :bujur="anakData.bujurJemput"
          :awal-terkonfirmasi="true"
          @pilih-lokasi="tanganiPetaBaru"
        />
        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Deskripsi Alamat:</label>
          <input
            type="text"
            v-model="alamatBaruTeks"
            placeholder="Alamat akan terisi otomatis begitu pin ditentukan, atau isi manual di sini"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary-container"
          />
        </div>
        <div v-if="errorAlamat" class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {{ errorAlamat }}
        </div>
      </div>
      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalUbahAlamatTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenyimpanAlamat" @click="simpanAlamatBaru">
          {{ sedangMenyimpanAlamat ? 'Menyimpan...' : 'Simpan Alamat Baru' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Popup konfirmasi alamat berhasil diperbarui -- tanpa invoice, karena
    perubahan alamat berdiri sendiri di halaman ini selalu gratis. -->
    <ModalUtama
      tema="terang"
      :tampil="modalAlamatBerhasilTampil"
      judul="Alamat Berhasil Diperbarui"
      ukuran="sedang"
      @tutup="modalAlamatBerhasilTampil = false"
    >
      <div class="space-y-3 text-center py-2">
        <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
          <Check class="w-7 h-7" />
        </div>
        <h3 class="text-base font-bold text-on-surface">Alamat Penjemputan Diperbarui</h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Supir pendamping {{ anakData.namaSupir || '' }} akan mendapatkan rute terbaru di dashboard-nya.
        </p>
        <div class="bg-surface-container rounded-xl p-3.5 text-left space-y-1">
          <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Alamat Baru</p>
          <p class="text-xs font-bold text-on-surface">{{ alamatBerhasilDisimpan }}</p>
        </div>
      </div>
      <template #footer>
        <TombolUtama tema="terang" varian="utama" @click="modalAlamatBerhasilTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
