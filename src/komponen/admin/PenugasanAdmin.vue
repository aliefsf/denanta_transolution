<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Plus, Send, Loader2, AlertTriangle, Clock } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import KartuPenugasan from './KartuPenugasan.vue';
import {
  ambilSupirTersedia,
  ambilSekolahDenganAnakAktif,
  ambilPenugasanHariIni,
  buatPenugasan as buatPenugasanLayanan,
  batalkanPenugasan,
  ambilAnakPerubahanJadwalPerluDitugaskan,
  tugaskanSupirPerubahanJadwal as tugaskanSupirPerubahanJadwalLayanan,
  type PenugasanHariIni,
  type SekolahDenganAnakAktif,
  type AnakPerubahanJadwalPerluDitugaskan
} from '../../layanan/adminLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { hitungTanggalAktifAbsensi } from '../../bantuan/periodeAbsensi';
import { ambilTanggalAktifAbsensi } from '../../layanan/kalenderLayanan';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Tanggal yang sedang ditampilkan pada grid penugasan -- default ke tanggal
// aktif absensi (bukan lagi "hari ini" literal), supaya selaras dengan
// tanggal yang sedang "dibuka" untuk absensi kesiapan supir (lihat
// ambilTanggalAktifAbsensi di src/layanan/kalenderLayanan.ts dan
// ambilSupirTersedia di adminLayanan.ts). Admin tetap bebas mengganti ke
// tanggal lain lewat date picker.
// Nilai awal pakai versi SINKRON (skip Sabtu/Minggu saja) supaya halaman
// langsung punya tanggal tanpa menunggu network -- begitu versi ASYNC
// (ikut menyaring cuti bersama Admin) selesai dimuat di onMounted, ref ini
// diperbarui kalau ternyata berbeda (mis. tanggal awal jatuh di hari libur
// yang ditetapkan Admin).
const tanggalTampil = ref(hitungTanggalAktifAbsensi());

// Form States
const modalTambahTampil = ref(false);
const formSupirId = ref('');
// 'keduanya' murni pilihan UI -- database (kolom jenis_perjalanan) cuma
// mengenal 'pagi'/'sore', jadi saat disimpan ini dipecah jadi dua penugasan.
const formSesi = ref<'pagi' | 'sore' | 'keduanya'>('pagi');
const sekolahTerpilih = ref<string[]>([]);

const listSupir = ref<{ id: string; nama_lengkap: string }[]>([]);
const listSekolahOptions = ref<SekolahDenganAnakAktif[]>([]);
const listPenugasan = ref<PenugasanHariIni[]>([]);

const sedangMemuat = ref(true);
const sedangMemproses = ref(false);

const muatDataPendukung = async () => {
  try {
    const [supir, sekolah] = await Promise.all([
      denganBatasWaktu(ambilSupirTersedia(), 20000),
      denganBatasWaktu(ambilSekolahDenganAnakAktif(tanggalTampil.value), 20000)
    ]);
    listSupir.value = supir;
    listSekolahOptions.value = sekolah;
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat data supir/sekolah.', 'error');
  }
};

const muatPenugasanHariIni = async () => {
  sedangMemuat.value = true;
  try {
    listPenugasan.value = await denganBatasWaktu(ambilPenugasanHariIni(tanggalTampil.value), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat penugasan.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Anak dgn pengajuan perubahan jadwal BERLAKU utk tanggal ini -- SENGAJA
// tidak ikut batch "Buat Penugasan" biasa (lihat pengecualian di
// saringAnakTersediaUntukTanggal(), adminLayanan.ts), jadi ditampilkan &
// ditugaskan terpisah di sini supaya jadwalnya yang beda tidak tercampur
// diam-diam ke rute rombongan sekolah normal.
const listAnakPerubahanJadwal = ref<AnakPerubahanJadwalPerluDitugaskan[]>([]);
const sedangMemuatPerubahanJadwal = ref(true);

const muatAnakPerubahanJadwal = async () => {
  sedangMemuatPerubahanJadwal.value = true;
  try {
    listAnakPerubahanJadwal.value = await denganBatasWaktu(ambilAnakPerubahanJadwalPerluDitugaskan(tanggalTampil.value), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat anak dengan perubahan jadwal.', 'error');
  } finally {
    sedangMemuatPerubahanJadwal.value = false;
  }
};

// Realtime: refetch begitu ada perubahan pada `perjalanan` (penugasan
// baru/dibatalkan), `supir` (tersedia/sedang bertugas), atau
// `pengajuan_perubahan_jadwal` (anak baru perlu ditugaskan supir) --
// event-driven, bukan interval berkala.
const saluranList: { unsubscribe: () => void }[] = [];

onMounted(async () => {
  await Promise.all([muatDataPendukung(), muatPenugasanHariIni(), muatAnakPerubahanJadwal()]);
  try {
    const tanggalAsync = await ambilTanggalAktifAbsensi();
    if (tanggalAsync !== tanggalTampil.value) tanggalTampil.value = tanggalAsync;
  } catch {
    // Biarkan nilai sinkron awal (skip Sabtu/Minggu saja) bila gagal memuat
  }

  saluranList.push(pantauTabelAdminRealtime('perjalanan', () => { muatPenugasanHariIni(); muatDataPendukung(); }));
  saluranList.push(pantauTabelAdminRealtime('supir', muatDataPendukung));
  saluranList.push(pantauTabelAdminRealtime('pengajuan_perubahan_jadwal', muatAnakPerubahanJadwal));
});

onUnmounted(() => {
  saluranList.forEach((s) => s.unsubscribe());
  saluranList.length = 0;
});

watch(tanggalTampil, () => {
  // Daftar sekolah/jumlah anak tersedia bergantung tanggal (jadwal_mingguan
  // + absen/libur pada tanggal itu), jadi ikut dimuat ulang -- bukan cuma
  // daftar penugasan yang sudah ada.
  sekolahTerpilih.value = [];
  muatPenugasanHariIni();
  muatDataPendukung();
  muatAnakPerubahanJadwal();
});

// Modal Tugaskan Supir utk satu anak dgn perubahan jadwal
const modalTugaskanPerubahanTampil = ref(false);
const anakPerubahanDipilih = ref<AnakPerubahanJadwalPerluDitugaskan | null>(null);
const formSupirIdPerubahan = ref('');
const sedangMenugaskanPerubahan = ref(false);

const bukaTugaskanPerubahanJadwal = (anak: AnakPerubahanJadwalPerluDitugaskan) => {
  anakPerubahanDipilih.value = anak;
  formSupirIdPerubahan.value = '';
  modalTugaskanPerubahanTampil.value = true;
};

const konfirmasiTugaskanPerubahanJadwal = async () => {
  if (!anakPerubahanDipilih.value || !formSupirIdPerubahan.value) {
    picuToast('Pilih supir untuk penugasan ini!', 'error');
    return;
  }
  const anak = anakPerubahanDipilih.value;
  sedangMenugaskanPerubahan.value = true;
  try {
    await tugaskanSupirPerubahanJadwalLayanan({
      pengajuanId: anak.pengajuanId,
      anakId: anak.anakId,
      namaAnak: anak.namaAnak,
      supirId: formSupirIdPerubahan.value,
      tanggal: tanggalTampil.value,
      jenisPerubahan: anak.jenisPerubahan,
      waktuBaru: anak.waktuBaru,
      alamatBaru: anak.alamatBaru
    });
    picuToast(`Supir berhasil ditugaskan untuk ${anak.namaAnak}!`, 'sukses');
    modalTugaskanPerubahanTampil.value = false;
    await Promise.all([muatAnakPerubahanJadwal(), muatPenugasanHariIni()]);
  } catch (err: any) {
    picuToast(err.message || 'Gagal menugaskan supir.', 'error');
  } finally {
    sedangMenugaskanPerubahan.value = false;
  }
};

// Konfirmasi batalkan penugasan -- aksi destruktif ke database (mengubah
// status perjalanan jadi 'dibatalkan'), jadi tidak boleh langsung
// tereksekusi dari klik tombol Trash2 di KartuPenugasan. Harus lewat modal
// konfirmasi dulu, baru batalkanPenugasan() dipanggil dari tombol "Ya,
// Batalkan" di modal.
const modalHapusTampil = ref(false);
const penugasanAkanDibatalkan = ref<PenugasanHariIni | null>(null);
const sedangMenghapus = ref(false);

const bukaKonfirmasiHapus = (penugasan: PenugasanHariIni) => {
  penugasanAkanDibatalkan.value = penugasan;
  modalHapusTampil.value = true;
};

// Modal Detail Penugasan -- KartuPenugasan cuma menampilkan ringkasan
// terpotong (nama sekolah/siswa yang di-truncate CSS), modal ini
// menampilkan daftar lengkap tanpa terpotong.
const modalDetailTampil = ref(false);
const penugasanDetail = ref<PenugasanHariIni | null>(null);

const bukaDetailPenugasan = (penugasan: PenugasanHariIni) => {
  penugasanDetail.value = penugasan;
  modalDetailTampil.value = true;
};

// Anak dengan pengajuan_perubahan_jadwal 'disetujui' (waktuKhusus terisi)
// WAJIB dipisah dari "Tugas Utama" -- waktu jemput/antarnya beda, tidak
// boleh tercampur dalam satu kelompok rute dengan anak berjadwal normal
// (lihat catatan lengkap di TugasAnakSupir.waktuKhusus, supirLayanan.ts).
const anakTugasUtama = computed(() => (penugasanDetail.value?.anakList ?? []).filter((a) => !a.waktuKhusus));
const anakPerubahanJadwal = computed(() => (penugasanDetail.value?.anakList ?? []).filter((a) => a.waktuKhusus));

// Siswa Tugas Utama dikelompokkan per sekolah (bukan satu daftar rata)
// supaya asal sekolah tiap anak lebih jelas -- urutan grup mengikuti
// sekolahList (urutan penugasan dibuat).
const anakPerSekolahDetail = computed(() => {
  const peta = new Map<string, { perjalananId: string; nama: string; alamatDiperbarui: boolean; waktuKhusus: string | null }[]>();
  for (const anak of anakTugasUtama.value) {
    if (!peta.has(anak.sekolah)) peta.set(anak.sekolah, []);
    peta.get(anak.sekolah)!.push(anak);
  }
  return Array.from(peta.entries()).map(([sekolah, anakList]) => ({ sekolah, anakList }));
});

const konfirmasiBatalkanPenugasan = async () => {
  if (!penugasanAkanDibatalkan.value) return;
  const perjalananIds = penugasanAkanDibatalkan.value.anakList.map(a => a.perjalananId);
  sedangMenghapus.value = true;
  try {
    await batalkanPenugasan(perjalananIds);
    picuToast('Penugasan berhasil dibatalkan!', 'sukses');
    modalHapusTampil.value = false;
    await muatPenugasanHariIni();
  } catch (err: any) {
    picuToast(err.message || 'Gagal membatalkan penugasan.', 'error');
  } finally {
    sedangMenghapus.value = false;
  }
};

const buatPenugasan = async () => {
  if (!formSupirId.value) {
    picuToast('Pilih supir untuk penugasan ini!', 'error');
    return;
  }
  if (sekolahTerpilih.value.length === 0) {
    picuToast('Pilih minimal satu sekolah/rute untuk ditugaskan!', 'error');
    return;
  }

  sedangMemproses.value = true;
  try {
    const sesiList: ('pagi' | 'sore')[] = formSesi.value === 'keduanya' ? ['pagi', 'sore'] : [formSesi.value];
    for (const sesi of sesiList) {
      await buatPenugasanLayanan({
        supirId: formSupirId.value,
        tanggal: tanggalTampil.value,
        jenisPerjalanan: sesi,
        sekolahIds: sekolahTerpilih.value
      });
    }
    picuToast('Penugasan berhasil dibuat!', 'sukses');
    modalTambahTampil.value = false;
    sekolahTerpilih.value = [];
    formSupirId.value = '';
    await muatPenugasanHariIni();
  } catch (err: any) {
    picuToast(err.message || 'Gagal membuat penugasan.', 'error');
  } finally {
    sedangMemproses.value = false;
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
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Penugasan Driver & Rute</h1>
        <p class="text-xs text-on-surface-variant">Atur penugasan harian supir berdasarkan sekolah dan sesi rute.</p>
      </div>

      <div class="flex items-center gap-2">
        <input
          type="date"
          v-model="tanggalTampil"
          class="px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono text-xs"
        />
        <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
          <Plus class="w-4 h-4" /> Tugaskan Manual
        </TombolUtama>
      </div>
    </div>

    <!-- Active Schedules Grid -->
    <div class="space-y-4">
      <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Jadwal Tugas Tanggal {{ tanggalTampil }}</h3>

      <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KartuPenugasan
            v-for="p in listPenugasan"
            :key="p.supirId + '|' + p.jenisPerjalanan"
            :penugasan="p"
            @hapus="bukaKonfirmasiHapus"
            @detail="bukaDetailPenugasan"
          />
        </div>
        <div v-if="listPenugasan.length === 0" class="text-center py-10 text-on-surface-variant italic text-xs">
          Belum ada penugasan terdaftar pada tanggal ini.
        </div>
      </template>
    </div>

    <!-- Anak dengan Perubahan Jadwal -- SENGAJA terpisah dari grid batch di
    atas (lihat catatan di script). Ditugaskan satu per satu supaya jam/
    alamat khususnya tidak tercampur ke rute rombongan sekolah normal. -->
    <div v-if="!sedangMemuatPerubahanJadwal && listAnakPerubahanJadwal.length > 0" class="space-y-3">
      <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
        <Clock class="w-4 h-4 text-primary" /> Anak dengan Perubahan Jadwal ({{ listAnakPerubahanJadwal.length }})
      </h3>
      <p class="text-[11px] text-on-surface-variant">
        Anak-anak berikut punya pengajuan perubahan jadwal yang sudah berlaku untuk tanggal ini -- jam/alamat jemput-antarnya beda dari jadwal normal, jadi ditugaskan terpisah dari rombongan sekolah di atas.
      </p>
      <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Anak</th>
                <th class="py-3 px-4">Sekolah</th>
                <th class="py-3 px-4">Jenis</th>
                <th class="py-3 px-4">Jam &amp; Alamat</th>
                <th class="py-3 px-4">Status Penugasan</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
              <tr v-for="anak in listAnakPerubahanJadwal" :key="anak.pengajuanId" class="hover:bg-surface-container transition-colors">
                <td class="py-3 px-4 font-semibold text-on-surface">{{ anak.namaAnak }}</td>
                <td class="py-3 px-4">{{ anak.namaSekolah }}</td>
                <td class="py-3 px-4">
                  <span
                    class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="anak.jenisPerubahan === 'pergi' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                  >
                    {{ anak.jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang' }}
                  </span>
                </td>
                <td class="py-3 px-4 max-w-xs">
                  <span class="font-mono text-[11px]">{{ anak.waktuBaru }}</span>
                  <span class="block truncate text-[10px] text-on-surface-variant" :title="anak.alamatBaru ?? '-'">{{ anak.alamatBaru ?? '-' }}</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                    :class="anak.sudahDitugaskan ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                  >
                    {{ anak.sudahDitugaskan ? `Supir: ${anak.namaSupir}` : 'Belum Ditugaskan' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <TombolUtama tema="terang" varian="garis-luar" class="text-[11px] !px-3 !py-1.5" @click="bukaTugaskanPerubahanJadwal(anak)">
                    {{ anak.sudahDitugaskan ? 'Ganti Supir' : 'Tugaskan' }}
                  </TombolUtama>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Tugaskan Supir utk Perubahan Jadwal -->
    <ModalUtama
      tema="terang"
      :tampil="modalTugaskanPerubahanTampil"
      judul="Tugaskan Supir -- Perubahan Jadwal"
      ukuran="sedang"
      @tutup="modalTugaskanPerubahanTampil = false"
    >
      <div v-if="anakPerubahanDipilih" class="space-y-4 text-xs">
        <div class="bg-surface-container rounded-xl p-3.5 space-y-1">
          <p class="font-bold text-on-surface">{{ anakPerubahanDipilih.namaAnak }} &mdash; {{ anakPerubahanDipilih.namaSekolah }}</p>
          <p class="text-on-surface-variant">
            {{ anakPerubahanDipilih.jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang' }} pukul <strong class="font-mono">{{ anakPerubahanDipilih.waktuBaru }}</strong>
          </p>
          <p class="text-on-surface-variant">{{ anakPerubahanDipilih.alamatBaru ?? '-' }}</p>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Pilih Supir:</label>
          <select
            v-model="formSupirIdPerubahan"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          >
            <option value="" disabled>Pilih supir tersedia</option>
            <option v-for="sup in listSupir" :key="sup.id" :value="sup.id">{{ sup.nama_lengkap }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenugaskanPerubahan" @click="modalTugaskanPerubahanTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenugaskanPerubahan" @click="konfirmasiTugaskanPerubahanJadwal">
          {{ sedangMenugaskanPerubahan ? 'Memproses...' : 'Tugaskan' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Penugasan Manual -->
    <ModalUtama
      tema="terang"
      :tampil="modalTambahTampil"
      judul="Buat Penugasan Rute Manual"
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="col-span-2 bg-surface-container rounded-xl px-3.5 py-2.5 flex items-center justify-between">
          <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Tanggal Penugasan:</span>
          <span class="font-mono font-bold text-on-surface">{{ tanggalTampil }}</span>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Pilih Supir:</label>
          <select
            v-model="formSupirId"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          >
            <option value="" disabled>Pilih supir tersedia</option>
            <option v-for="sup in listSupir" :key="sup.id" :value="sup.id">{{ sup.nama_lengkap }}</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Sesi Jemputan:</label>
          <select
            v-model="formSesi"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          >
            <option value="pagi">Sesi Pagi (Pergi Sekolah)</option>
            <option value="sore">Sesi Sore (Pulang Sekolah)</option>
            <option value="keduanya">Pergi dan Pulang (Kedua Sesi)</option>
          </select>
        </div>

        <!-- Multi Select Sekolah/Rute (List Checklist) -->
        <div class="col-span-2 space-y-2 border-t border-outline-variant/30 pt-3">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Pilih Sekolah/Rute (Bisa Multi-Select):</label>
          <p class="text-[10px] text-on-surface-variant">Seluruh anak aktif pada sekolah yang dipilih akan ditugaskan ke supir ini untuk sesi & tanggal di atas.</p>
          <div class="max-h-36 overflow-y-auto space-y-2 bg-surface-container p-3 rounded-xl border border-outline-variant/30">
            <label
              v-for="sekolah in listSekolahOptions"
              :key="sekolah.id"
              class="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-surface-container-high transition-colors"
            >
              <input
                type="checkbox"
                :value="sekolah.id"
                v-model="sekolahTerpilih"
                class="accent-primary"
              />
              <span class="text-on-surface">{{ sekolah.nama }} <span class="text-[9px] text-on-surface-variant">({{ sekolah.jumlahAnak }} anak)</span></span>
            </label>
            <div v-if="listSekolahOptions.length === 0" class="text-center text-on-surface-variant italic text-[11px] py-4">
              Tidak ada sekolah dengan anak berstatus aktif.
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="gap-1.5" :nonaktif="sedangMemproses" @click="buatPenugasan">
          {{ sedangMemproses ? 'Memproses...' : 'Tugaskan Manual' }}
          <Send class="w-3.5 h-3.5" />
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Detail Penugasan -->
    <ModalUtama
      tema="terang"
      :tampil="modalDetailTampil"
      judul="Detail Penugasan"
      @tutup="modalDetailTampil = false"
    >
      <div v-if="penugasanDetail" class="space-y-4 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <span class="text-on-surface-variant font-bold uppercase text-[9px]">Sesi:</span>
            <p class="text-on-surface font-bold uppercase">{{ penugasanDetail.jenisPerjalanan }}</p>
          </div>
          <div>
            <span class="text-on-surface-variant font-bold uppercase text-[9px]">Tanggal:</span>
            <p class="text-on-surface font-bold font-mono">{{ penugasanDetail.tanggal }}</p>
          </div>
          <div class="col-span-2">
            <span class="text-on-surface-variant font-bold uppercase text-[9px]">Supir Pendamping:</span>
            <p class="text-on-surface font-bold">{{ penugasanDetail.namaSupir }}</p>
          </div>
        </div>

        <div>
          <span class="text-on-surface-variant font-bold uppercase text-[9px]">
            Sekolah/Rute Terjadwal ({{ penugasanDetail.sekolahList.length }}):
          </span>
          <ul class="mt-1 space-y-1">
            <li
              v-for="sekolah in penugasanDetail.sekolahList"
              :key="sekolah"
              class="bg-surface-container px-3 py-1.5 rounded-lg text-on-surface"
            >
              {{ sekolah }}
            </li>
          </ul>
        </div>

        <div>
          <span class="text-on-surface-variant font-bold uppercase text-[9px]">
            Tugas Utama -- Siswa Terdaftar ({{ anakTugasUtama.length }} Anak):
          </span>
          <div class="mt-1 max-h-64 overflow-y-auto space-y-3 border border-outline-variant/20 rounded-lg p-2 bg-surface-container">
            <div v-for="grup in anakPerSekolahDetail" :key="grup.sekolah">
              <p class="text-[10px] font-bold text-primary uppercase tracking-wide px-1 mb-1">{{ grup.sekolah }} ({{ grup.anakList.length }})</p>
              <ul class="space-y-1">
                <li
                  v-for="(anak, idx) in grup.anakList"
                  :key="anak.perjalananId"
                  class="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-container-lowest text-on-surface"
                >
                  <span class="text-on-surface-variant font-mono text-[10px] w-5">{{ idx + 1 }}.</span>
                  <span class="font-medium">{{ anak.nama }}</span>
                  <!-- Orang tua mengubah alamat jemput/antar SETELAH anak ini
                       ditugaskan -- penugasan/supirnya TIDAK berubah, cuma
                       titik lokasinya yang perlu diperhatikan Admin/Supir. -->
                  <span
                    v-if="anak.alamatDiperbarui"
                    class="flex items-center gap-1 ml-auto text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0"
                    title="Alamat jemput/antar diperbarui orang tua setelah penugasan dibuat"
                  >
                    <AlertTriangle class="w-3 h-3" />
                    Alamat diperbarui
                  </span>
                </li>
              </ul>
            </div>
            <p v-if="anakTugasUtama.length === 0" class="text-[10px] text-on-surface-variant italic text-center py-2">
              Tidak ada siswa dengan jadwal normal pada penugasan ini.
            </p>
          </div>
        </div>

        <!-- Anak dengan perubahan jadwal 'disetujui' -- SENGAJA dipisah total
             dari daftar Tugas Utama di atas (bukan cuma ditandai), supaya
             Admin & Supir tidak keliru mencampur waktu jemput/antar mereka
             dengan anak berjadwal normal. -->
        <div v-if="anakPerubahanJadwal.length > 0">
          <span class="text-amber-700 font-bold uppercase text-[9px] flex items-center gap-1">
            <AlertTriangle class="w-3 h-3" />
            Perubahan Jadwal -- Terdapat {{ anakPerubahanJadwal.length }} Anak
          </span>
          <div class="mt-1 space-y-2">
            <div
              v-for="anak in anakPerubahanJadwal"
              :key="anak.perjalananId"
              class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-on-surface"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs">{{ anak.nama }}</span>
                <span class="text-[9px] font-bold text-amber-700 uppercase">Jadwal Baru: {{ anak.waktuKhusus }}</span>
              </div>
              <p class="text-[10px] text-on-surface-variant mt-0.5">{{ anak.sekolah }}</p>
              <p class="text-[10px] text-amber-700 mt-1">
                Catatan: anak harus dijemput/diantar pukul {{ anak.waktuKhusus }} sesuai permintaan perubahan jadwal orang tua -- jangan digabung dengan rute Tugas Utama.
              </p>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="utama" @click="modalDetailTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Batalkan Penugasan -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Konfirmasi Batalkan Penugasan"
      ukuran="sedang"
      @tutup="modalHapusTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Batalkan penugasan supir "{{ penugasanAkanDibatalkan?.namaSupir }}"?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          {{ penugasanAkanDibatalkan?.anakList.length }} anak pada sesi {{ penugasanAkanDibatalkan?.jenisPerjalanan }} akan kehilangan penugasan supirnya untuk tanggal ini. Aksi ini tidak dapat dibatalkan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapus" @click="modalHapusTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapus" @click="konfirmasiBatalkanPenugasan">
          {{ sedangMenghapus ? 'Memproses...' : 'Ya, Batalkan' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
