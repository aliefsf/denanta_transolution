<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { CheckCircle2, XCircle, HelpCircle, Clock, ClipboardList, Lock, LockOpen, Loader2, AlertTriangle, RefreshCw } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import {
  ambilRingkasanAbsensiHarian,
  perbaruiStatusKehadiran,
  type RingkasanAbsensiHarian,
  type StatusKehadiran
} from '../../layanan/supirLayanan';
import { formatTanggalIndonesia, formatTanggalIndonesiaDenganHari } from '../../bantuan/periodeAbsensi';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';

const emit = defineEmits<{
  (e: 'ubah-status', status: StatusKehadiran): void;
}>();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const sedangMemuat = ref(true);
const sedangMemproses = ref<StatusKehadiran | null>(null);
const ringkasan = ref<RingkasanAbsensiHarian | null>(null);
// Terisi kalau muat gagal/timeout -- SEBELUMNYA halaman ini tetap kosong
// permanen kalau gagal (template hanya render spinner ATAU konten, tidak ada
// keduanya kalau `ringkasan` tetap null), tanpa pesan apa pun selain toast
// yang otomatis hilang -- pengguna terjebak layar kosong tanpa cara mencoba
// lagi selain reload manual. State ini dipakai menampilkan pesan + tombol
// "Coba Lagi" pada kasus itu.
const gagalMemuat = ref(false);

const muatRingkasan = async () => {
  sedangMemuat.value = true;
  gagalMemuat.value = false;
  try {
    // Dibatasi 10 detik (sama seperti halaman Admin) -- tanpa ini, query yang
    // macet (mis. koneksi lambat) bisa menggantung jauh lebih lama dari batas
    // waktu fetch global (35 detik) sebelum akhirnya menampilkan error.
    ringkasan.value = await denganBatasWaktu(ambilRingkasanAbsensiHarian(), 20000, 'Waktu memuat status absensi habis.');
  } catch (err: any) {
    gagalMemuat.value = true;
    picuToast(err.message || 'Gagal memuat status absensi.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

onMounted(muatRingkasan);

const infoStatus = computed(() => {
  switch (ringkasan.value?.status) {
    case 'siap':
      return { label: 'Siap Bertugas', kelas: 'text-emerald-600 bg-emerald-50 border-emerald-200', ikon: CheckCircle2 };
    case 'tidak_siap':
      return { label: 'Tidak Bertugas', kelas: 'text-rose-600 bg-rose-50 border-rose-200', ikon: XCircle };
    default:
      return { label: 'Belum Diisi', kelas: 'text-amber-600 bg-amber-50 border-amber-200', ikon: HelpCircle };
  }
});

const waktuPengisian = computed(() => {
  if (!ringkasan.value?.diperbaruiPada) return '-';
  return new Date(ringkasan.value.diperbaruiPada).toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short'
  }) + ' WIB';
});

// Judul dinamis mengikuti tanggal aktif absensi (periode berpindah begitu
// pukul 17:00 WIB tanggal berjalan terlewati -- lihat
// hitungTanggalAktifAbsensi() di src/bantuan/periodeAbsensi.ts), bukan lagi
// "Hari Ini" statis.
const judulLaporan = computed(() => {
  if (!ringkasan.value?.tanggalAktif) return 'Laporan Absensi';
  return `Laporan Absensi Tanggal ${formatTanggalIndonesia(ringkasan.value.tanggalAktif)}`;
});

const tanggalAktifFormatLengkap = computed(() => {
  if (!ringkasan.value?.tanggalAktif) return '';
  return formatTanggalIndonesiaDenganHari(ringkasan.value.tanggalAktif);
});

// Tombol nonaktif kalau salah satu dari dua alasan kunci terpenuhi: sudah
// ada penugasan (terkunci), atau akun supir sementara ini rentang tanggal
// kerjanya sudah berakhir (masaKerjaBerakhir). Tidak ada lagi batasan jam
// pengisian -- absensi bebas diisi kapan saja.
const formTerkunci = computed(() => !!ringkasan.value?.terkunci || !!ringkasan.value?.masaKerjaBerakhir);

const pilihStatus = async (status: StatusKehadiran) => {
  if (formTerkunci.value || sedangMemproses.value) return;
  sedangMemproses.value = status;
  try {
    await perbaruiStatusKehadiran(status);
    picuToast(
      status === 'siap'
        ? 'Absensi tersimpan! Anda sekarang tersedia untuk menerima tugas dari Admin.'
        : 'Absensi tersimpan: Tidak Bertugas hari ini.',
      status === 'siap' ? 'sukses' : 'info'
    );
    emit('ubah-status', status);
    await muatRingkasan();
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan absensi.', 'error');
    await muatRingkasan();
  } finally {
    sedangMemproses.value = null;
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

    <div>
      <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Absensi Harian Supir</h1>
      <p class="text-xs text-on-surface-variant">Isi kesiapan Anda setiap hari agar dapat menerima penugasan dari Admin.</p>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <div v-else-if="gagalMemuat" class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle class="w-8 h-8 text-rose-500" />
      <p class="text-sm text-on-surface-variant max-w-sm">Gagal memuat status absensi. Periksa koneksi internet Anda lalu coba lagi.</p>
      <TombolUtama tema="terang" varian="utama" class="gap-1.5" @click="muatRingkasan">
        <RefreshCw class="w-3.5 h-3.5" /> Coba Lagi
      </TombolUtama>
    </div>

    <template v-else-if="ringkasan">
      <!-- Status Besar -->
      <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 soft-shadow space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center border" :class="infoStatus.kelas">
              <component :is="infoStatus.ikon" class="w-7 h-7" />
            </div>
            <div>
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{{ judulLaporan }}</p>
              <p class="text-xl font-black" :class="infoStatus.kelas.split(' ')[0]">{{ infoStatus.label }}</p>
            </div>
          </div>

          <!-- Tombol Aksi -->
          <div class="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <TombolUtama
              tema="terang"
              varian="utama"
              class="gap-1.5 justify-center"
              :class="formTerkunci ? '!bg-surface-container-high !text-on-surface-variant !shadow-none' : 'bg-emerald-600 hover:bg-emerald-700'"
              :nonaktif="formTerkunci || sedangMemproses !== null"
              @click="pilihStatus('siap')"
            >
              <Loader2 v-if="sedangMemproses === 'siap'" class="w-3.5 h-3.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5" />
              Siap Bertugas
            </TombolUtama>
            <TombolUtama
              tema="terang"
              varian="bahaya"
              class="gap-1.5 justify-center"
              :class="formTerkunci ? '!bg-surface-container-high !text-on-surface-variant !shadow-none' : ''"
              :nonaktif="formTerkunci || sedangMemproses !== null"
              @click="pilihStatus('tidak_siap')"
            >
              <Loader2 v-if="sedangMemproses === 'tidak_siap'" class="w-3.5 h-3.5 animate-spin" />
              <XCircle v-else class="w-3.5 h-3.5" />
              Tidak Bertugas
            </TombolUtama>
          </div>
        </div>

        <!-- Info Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/20">
          <div class="flex items-start gap-2 text-xs bg-surface-container p-3 rounded-xl">
            <Clock class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-[9px] font-bold text-on-surface-variant uppercase">Waktu Pengisian</p>
              <p class="text-on-surface font-semibold">{{ waktuPengisian }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2 text-xs bg-surface-container p-3 rounded-xl">
            <ClipboardList class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-[9px] font-bold text-on-surface-variant uppercase">Status Tugas</p>
              <p class="text-on-surface font-semibold">{{ ringkasan.sudahDapatTugas ? 'Sudah Mendapat Tugas' : 'Belum Mendapat Tugas' }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2 text-xs bg-surface-container p-3 rounded-xl">
            <component :is="formTerkunci ? Lock : LockOpen" class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-[9px] font-bold text-on-surface-variant uppercase">Status Perubahan</p>
              <p class="text-on-surface font-semibold">
                {{ ringkasan.masaKerjaBerakhir ? 'Terkunci (Masa Kerja Berakhir)' : ringkasan.terkunci ? 'Terkunci Sistem' : 'Masih Dapat Diubah' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Banner Penjelasan -->
      <div
        v-if="ringkasan.masaKerjaBerakhir"
        class="flex gap-3 text-xs text-rose-800 bg-rose-50 p-4 rounded-xl border border-rose-200"
      >
        <Lock class="w-5 h-5 text-rose-600 flex-shrink-0" />
        <p class="leading-relaxed">
          Masa kerja Anda sebagai <strong>supir sementara</strong> sudah <strong>berakhir</strong>. Halaman absensi masih bisa dibuka
          untuk melihat riwayat status, tetapi seluruh tombol aksi tidak dapat digunakan lagi. Hubungi Admin apabila Anda masih
          perlu bertugas.
        </p>
      </div>
      <div
        v-else-if="ringkasan.terkunci"
        class="flex gap-3 text-xs text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200"
      >
        <Lock class="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p class="leading-relaxed">
          Absensi Anda <strong>terkunci</strong> karena sudah ada penugasan dari Admin untuk periode ini. Status kehadiran tidak
          dapat diubah selama penugasan masih berlaku. Sistem akan mengembalikan status menjadi <strong>Belum Diisi</strong> secara
          otomatis begitu periode berpindah ke tanggal aktif berikutnya (pukul <strong>17:00 WIB</strong>
          pada <strong>{{ tanggalAktifFormatLengkap }}</strong>), lalu Anda perlu mengisi absensi ulang untuk periode selanjutnya.
        </p>
      </div>
      <div
        v-else
        class="flex gap-3 text-xs text-on-surface-variant bg-surface-container p-4 rounded-xl border border-outline-variant/20"
      >
        <AlertTriangle class="w-5 h-5 text-primary flex-shrink-0" />
        <p class="leading-relaxed">
          Pilih <strong>Siap Bertugas</strong> agar akun Anda tersedia untuk menerima penugasan rute dari Admin pada periode ini.
          Anda bisa mengubah status kapan saja, sampai Admin membuatkan penugasan untuk tanggal <strong>{{ tanggalAktifFormatLengkap }}</strong>.
        </p>
      </div>
    </template>
  </div>
</template>
