<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Navigation, Loader2, ArrowDownWideNarrow, ArrowUpNarrowWide, CheckCircle2, Lock, PlayCircle, AlertTriangle } from 'lucide-vue-next';
import { useLokasiSupir } from '../../komposabel/useLokasiSupir';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import KartuTugas from './KartuTugas.vue';
import PetaRuteOptimal from './PetaRuteOptimal.vue';
import ModalLaporanKendala from './ModalLaporanKendala.vue';
import {
  ambilTugasHariIni,
  perbaruiStatusPerjalanan,
  laporkanKendala,
  selesaikanRuteHariIni,
  perbaruiStatusBertugas,
  type TugasAnakSupir,
  type KategoriKendala
} from '../../layanan/supirLayanan';
import type { StatusPerjalanan } from '../../tipe';
import { hitungJarakKm } from '../../bantuan/jarak';
import { ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import { ambilRuteJalan } from '../../layanan/navigasiLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import { useAuth } from '../../komposabel/useAuth';
import { gunakanRealtimeSubscription } from '../../layanan/realtimeLayanan';

const { currentUser } = useAuth();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// Filter States
const sesiTerpilih = ref<'pagi' | 'sore'>('pagi');
const sekolahTerpilih = ref('');
const urutanJarak = ref<'terjauh' | 'terdekat'>('terjauh');

// Gerbang "Mulai Bertugas" per sesi (pagi/sore) -- sebelum ditekan, daftar
// tugas tetap terlihat (read-only) tapi tombol ubah status dinonaktifkan.
// Disimpan di localStorage (bukan cuma ref biasa) supaya kalau supir tidak
// sengaja refresh halaman di tengah tugas, statusnya tidak ikut ke-reset
// jadi terkunci lagi -- kunci disertakan tanggal WIB hari ini supaya
// otomatis "lupa" begitu berganti hari.
//
// PENTING: nilai yang disimpan BUKAN cuma '1', tapi snapshot daftar
// perjalananId yang ditugaskan saat tombol ditekan. Kalau Admin membatalkan
// lalu menugaskan ULANG rute untuk sesi & tanggal yang SAMA (perjalananId
// baru terbit), snapshot lama tidak akan cocok lagi dengan tugas yang
// sekarang termuat -- gerbang otomatis terkunci lagi, supir wajib menekan
// "Mulai Bertugas" ulang untuk penugasan barunya. Tanpa ini, penugasan baru
// yang menggantikan penugasan lama yang sudah dibatalkan akan langsung
// "terlanjur mulai" tanpa supir sadar dan tanpa lokasi GPS-nya benar-benar
// diminta ulang.
const kunciSesiAktif = (sesi: 'pagi' | 'sore') => `denanta_sesi_bertugas_${ambilTanggalWibSekarang()}_${sesi}`;
const bacaSnapshotSesi = (sesi: 'pagi' | 'sore'): string[] | null => {
  try {
    const mentah = localStorage.getItem(kunciSesiAktif(sesi));
    if (!mentah) return null;
    const parsed = JSON.parse(mentah);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
const simpanSnapshotSesi = (sesi: 'pagi' | 'sore', perjalananIds: string[]) => {
  try {
    localStorage.setItem(kunciSesiAktif(sesi), JSON.stringify([...perjalananIds].sort()));
  } catch {
    // Biarkan gagal senyap (mis. mode privat) -- tombol tetap bisa ditekan
    // ulang, cuma tidak persisten lintas refresh.
  }
};
const hapusSnapshotSesi = (sesi: 'pagi' | 'sore') => {
  try {
    localStorage.removeItem(kunciSesiAktif(sesi));
  } catch {
    // Biarkan gagal senyap.
  }
};
const perjalananIdSesiSaatIni = (sesi: 'pagi' | 'sore') =>
  daftarTugas.value.filter((t) => t.jenisPerjalanan === sesi).map((t) => t.perjalananId).sort();

const sesiPagiAktif = ref(false);
const sesiSoreAktif = ref(false);
const sesiSaatIniAktif = computed(() => (sesiTerpilih.value === 'pagi' ? sesiPagiAktif.value : sesiSoreAktif.value));

// Dipanggil setiap kali daftarTugas selesai dimuat/berubah -- bandingkan
// snapshot tersimpan dengan perjalananId yang sekarang benar-benar
// ditugaskan; cocok persis -> tetap aktif (survive refresh), beda (mis.
// abis dibatalkan+ditugaskan ulang) -> kunci lagi & bersihkan localStorage
// basi supaya tidak dicek ulang terus-menerus.
const sinkronkanGerbangSesi = () => {
  for (const sesi of ['pagi', 'sore'] as const) {
    const snapshot = bacaSnapshotSesi(sesi);
    const idSekarang = perjalananIdSesiSaatIni(sesi);
    const cocok = snapshot !== null && idSekarang.length > 0 && JSON.stringify(snapshot) === JSON.stringify(idSekarang);
    if (sesi === 'pagi') sesiPagiAktif.value = cocok;
    else sesiSoreAktif.value = cocok;
    if (snapshot !== null && !cocok) hapusSnapshotSesi(sesi);
  }
};

const { mulaiLacak, errorLacak: errorLokasi, posisiSaatIni, mulaiSimulasiPergerakan, sedangSimulasi } = useLokasiSupir();

const mulaiBertugas = () => {
  mulaiLacak();
  simpanSnapshotSesi(sesiTerpilih.value, perjalananIdSesiSaatIni(sesiTerpilih.value));
  if (sesiTerpilih.value === 'pagi') sesiPagiAktif.value = true;
  else sesiSoreAktif.value = true;

  // Syarat marker muncul di peta Pemantauan Global Admin -- lihat catatan
  // lengkap di kolom sedang_bertugas (skema_database.sql) & ambilPosisiSupirAktif
  // (adminLayanan.ts). Best-effort: kalau gagal, GPS tetap jalan (mulaiLacak
  // di atas sudah terlanjur dipanggil), cuma marker Admin yang tertunda.
  perbaruiStatusBertugas(true).catch(() => {});
};

const sedangMemuat = ref(true);
const daftarTugas = ref<TugasAnakSupir[]>([]);

const muatTugasHariIni = async () => {
  sedangMemuat.value = true;
  try {
    const hariIni = ambilTanggalWibSekarang();
    daftarTugas.value = await denganBatasWaktu(ambilTugasHariIni(hariIni), 20000, 'Waktu memuat daftar tugas habis.');
    sinkronkanGerbangSesi();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar tugas.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Refetch DIAM-DIAM (tanpa toggle sedangMemuat/spinner layar penuh) --
// dipakai oleh realtime di bawah supaya penugasan baru dari Admin muncul
// tanpa mengganggu interaksi supir yang mungkin sedang membuka peta rute.
const muatTugasHariIniDiam = async () => {
  try {
    const hariIni = ambilTanggalWibSekarang();
    daftarTugas.value = await denganBatasWaktu(ambilTugasHariIni(hariIni), 20000, 'Waktu memuat daftar tugas habis.');
    sinkronkanGerbangSesi();
  } catch (err: any) {
    console.error('Gagal menyegarkan daftar tugas (realtime):', err);
  }
};

// Realtime: penugasan baru/dibatalkan dari Admin, atau perubahan status
// dari perangkat lain milik supir yang sama, langsung tampil di sini
// tanpa refresh. Difilter ke supir_id akun sendiri.
let saluranTugas: { unsubscribe: () => void } | null = null;

onMounted(() => {
  muatTugasHariIni();
  const supirId = currentUser.value?.id;
  if (supirId) {
    saluranTugas = gunakanRealtimeSubscription('perjalanan', `supir_id=eq.${supirId}`, muatTugasHariIniDiam);
  }
});

onUnmounted(() => {
  saluranTugas?.unsubscribe();
  saluranTugas = null;
});

// Sekolah tujuan yang tersedia untuk sesi terpilih
const daftarSekolahSesi = computed(() => {
  return [...new Set(daftarTugas.value.filter(t => t.jenisPerjalanan === sesiTerpilih.value).map(t => t.sekolah))];
});

watch(daftarSekolahSesi, (list) => {
  if (!list.includes(sekolahTerpilih.value)) {
    sekolahTerpilih.value = list[0] ?? '';
  }
}, { immediate: true });

// Filtered tasks based on selections
const tugasTerfilter = computed(() => {
  return daftarTugas.value.filter(a => a.jenisPerjalanan === sesiTerpilih.value && a.sekolah === sekolahTerpilih.value);
});

const sekolahAktif = computed(() => tugasTerfilter.value[0] ?? null);

// Daftar anak unik hari ini (dedupe by anakId) -- dipakai dropdown "Pilih
// Nama Anak" pada ModalLaporanKendala, lintas sesi/sekolah (bukan hanya
// yang sedang difilter), supaya supir bisa melaporkan kendala utk anak
// manapun yang ditugaskan padanya hari ini.
const daftarAnakUnik = computed(() => {
  const terlihat = new Set<string>();
  return daftarTugas.value.filter((a) => {
    if (terlihat.has(a.anakId)) return false;
    terlihat.add(a.anakId);
    return true;
  });
});

const koordinatAnak = (anak: TugasAnakSupir): [number, number] =>
  anak.jenisPerjalanan === 'pagi' ? [anak.lintangJemput, anak.bujurJemput] : [anak.lintangAntar, anak.bujurAntar];

const jarakKeSekolah = (anak: TugasAnakSupir): number => {
  if (!sekolahAktif.value) return 0;
  const [lat, lng] = koordinatAnak(anak);
  return hitungJarakKm(lat, lng, sekolahAktif.value.lintangSekolah, sekolahAktif.value.bujurSekolah);
};

// Urutan Titik Singgah -- diurutkan berdasarkan jarak ke sekolah sesuai filter terpilih
const tugasTerurut = computed(() => {
  const list = [...tugasTerfilter.value];
  list.sort((a, b) => {
    const jarakA = jarakKeSekolah(a);
    const jarakB = jarakKeSekolah(b);
    return urutanJarak.value === 'terjauh' ? jarakB - jarakA : jarakA - jarakB;
  });
  return list;
});

// Suggested route order details
const totalWaktuEst = computed(() => tugasTerfilter.value.length * 12);

// Simulasi Pergerakan (khusus demo, mis. sidang tugas akhir) -- lihat
// catatan lengkap di useLokasiSupir.ts. Titik jemput mentah (garis lurus
// antar anak) di sini cuma dipakai sebagai FALLBACK/permintaan ke OSRM --
// mulaiDemoSimulasi() di bawah menukarnya dengan geometri jalan sungguhan
// (ambilRuteJalan, sama seperti yang dipakai PetaRuteOptimal menggambar
// polyline) sebelum diberikan ke mulaiSimulasiPergerakan, supaya marker
// simulasi benar-benar mengikuti bentuk jalan, bukan garis lurus antar titik.
const titikJemputMentah = computed(() => {
  const titikAnak = tugasTerurut.value.map((anak) => {
    const [lat, lng] = koordinatAnak(anak);
    return { lat, lng };
  });
  const titikSekolah = sekolahAktif.value
    ? [{ lat: sekolahAktif.value.lintangSekolah, lng: sekolahAktif.value.bujurSekolah }]
    : [];

  // Sesi Sore (antar pulang): supir mulai DARI sekolah, baru ke rumah
  // masing-masing anak -- kebalikan dari sesi Pagi (mulai dari rumah,
  // berakhir di sekolah). Sama seperti yang diperbaiki di PetaRuteOptimal.vue.
  const titik = sesiTerpilih.value === 'sore' ? [...titikSekolah, ...titikAnak] : [...titikAnak, ...titikSekolah];
  return titik;
});
const sedangMuatRuteSimulasi = ref(false);
const mulaiDemoSimulasi = async () => {
  const titikMentah = titikJemputMentah.value;
  if (titikMentah.length < 2) return;

  sedangMuatRuteSimulasi.value = true;
  try {
    const jalurJalan = await ambilRuteJalan(titikMentah.map((t) => [t.lat, t.lng] as [number, number]));
    const titikJalur = jalurJalan
      ? jalurJalan.map(([lat, lng]) => ({ lat, lng }))
      : titikMentah; // OSRM gagal/offline -- fallback garis lurus, sama seperti PetaRuteOptimal
    mulaiSimulasiPergerakan(titikJalur, 60000);
  } finally {
    sedangMuatRuteSimulasi.value = false;
  }
};
// import.meta tidak bisa dipakai langsung di ekspresi template Vue,
// makanya nilainya "dititipkan" ke variabel biasa dulu di sini.
//
// SEBELUMNYA cuma import.meta.env.DEV -- otomatis bernilai false di build
// produksi (npm run build, termasuk yang di-deploy ke Vercel), jadi tombol
// ini ikut hilang total begitu di-hosting walau fiturnya masih dibutuhkan
// utk demo/sidang di lingkungan production juga. Sama seperti widget
// Simulasi Waktu (App.vue), sekarang bisa tetap ditampilkan di build
// produksi lewat env var VITE_TAMPILKAN_SIMULASI_WAKTU=true (dipasang di
// Vercel), tanpa perlu jalankan npm run dev.
const modeDev = import.meta.env.DEV || import.meta.env.VITE_TAMPILKAN_SIMULASI_WAKTU === 'true';

// Tombol "Tandai Tugas Hari Ini Telah Selesai" -- hanya bisa dipakai kalau
// seluruh titik singgah pada rute (sesi + sekolah) yang sedang ditampilkan
// sudah berstatus 'tiba' (Sampai Tujuan), dan belum pernah ditandai selesai.
const ruteSudahSelesaiDitandai = computed(() =>
  tugasTerfilter.value.length > 0 && tugasTerfilter.value.every(t => !!t.diselesaikanPada)
);
const semuaTitikSampaiTujuan = computed(() =>
  tugasTerfilter.value.length > 0 && tugasTerfilter.value.every(t => t.status === 'tiba')
);
const waktuRuteSelesai = computed(() => {
  const waktu = tugasTerfilter.value.find(t => t.diselesaikanPada)?.diselesaikanPada;
  if (!waktu) return null;
  return new Date(waktu).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) + ' WIB';
});

// Opsi status HARUS mengikuti sesi (pagi/sore) baris perjalanan yang
// sedang diedit -- sebelumnya satu daftar (termasuk 'pengantaran', yang
// semestinya khusus sore) dipakai untuk semua baris tanpa dibedakan,
// sehingga status "Pengantaran Pulang" bisa salah terpilih pada baris
// pagi dan malah menimpa waktu_jemput sesi pagi (dipakai checkpoint
// "Penjemputan Armada" di GarisWaktuPerjalanan.vue milik Orang Tua).
//
// 'di_sekolah' SENGAJA tidak dijadikan opsi tersendiri: baik 'di_sekolah'
// maupun 'tiba' sama-sama menulis waktu_antar (checkpoint "Tiba di
// Sekolah" utk pagi), dan trigger DB trg_jaga_penyelesaian_perjalanan
// mewajibkan literal status 'tiba' sebelum tombol "Tandai Tugas Hari Ini
// Telah Selesai" bisa dipakai -- kalau keduanya ditawarkan sebagai opsi
// terpisah, memilih salah satu lalu yang lain menimpa jam checkpoint yang
// sama dan terlihat seperti bug. Jadi utk pagi 'tiba' JADI SATU-SATUNYA
// status akhir, cukup diberi label "Sampai di Sekolah".
const opsiStatusPagi: { value: StatusPerjalanan; label: string }[] = [
  { value: 'dijadwalkan', label: 'Sedang di Rumah' },
  { value: 'penjemputan', label: 'Penjemputan' },
  { value: 'menuju_sekolah', label: 'Menuju Sekolah' },
  { value: 'tiba', label: 'Sampai di Sekolah' }
];

const opsiStatusSore: { value: StatusPerjalanan; label: string }[] = [
  { value: 'pengantaran', label: 'Pengantaran Pulang' },
  { value: 'tiba', label: 'Sampai Tujuan' }
];

const opsiStatusDropdown = (jenisPerjalanan: 'pagi' | 'sore') =>
  jenisPerjalanan === 'sore' ? opsiStatusSore : opsiStatusPagi;

// Modals State
const modalKendalaTampil = ref(false);
const sedangMemproses = ref(false);
const sedangMengubahStatus = ref<string | null>(null);
const anakAktif = ref<TugasAnakSupir | null>(null);

const bukaKendalaModal = (anak: TugasAnakSupir) => {
  anakAktif.value = anak;
  modalKendalaTampil.value = true;
};

// Handler status update lewat dropdown Urutan Titik Singgah
const ubahStatusDropdown = async (anak: TugasAnakSupir, statusBaru: StatusPerjalanan) => {
  if (statusBaru === anak.status) return;
  sedangMengubahStatus.value = anak.perjalananId;
  try {
    await perbaruiStatusPerjalanan(anak.perjalananId, statusBaru);
    picuToast(`Sukses memperbarui status perjalanan ${anak.nama}!`, 'sukses');
    await muatTugasHariIni();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui status perjalanan.', 'error');
  } finally {
    sedangMengubahStatus.value = null;
  }
};

// Handler kendala update
const laporkanKendalaBaru = async (data: { perjalananId: string; kategori: KategoriKendala; catatan: string; anakId?: string }) => {
  sedangMemproses.value = true;
  try {
    await laporkanKendala(data.perjalananId, data.kategori, data.catatan, data.anakId);
    picuToast('Laporan kendala berhasil dikirim ke admin & orang tua terkait!', 'sukses');
    modalKendalaTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal mengirim laporan kendala.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

// Handler "Tandai Tugas Hari Ini Telah Selesai"
const modalSelesaiTampil = ref(false);
const sedangMenyelesaikan = ref(false);

const konfirmasiSelesaikanRute = async () => {
  sedangMenyelesaikan.value = true;
  try {
    await selesaikanRuteHariIni(tugasTerfilter.value.map(t => t.perjalananId));
    picuToast('Tugas rute ini berhasil ditandai selesai!', 'sukses');
    modalSelesaiTampil.value = false;
    await muatTugasHariIni();

    // Kalau supir punya beberapa rute (sekolah) berbeda pada sesi yang sama,
    // rute yang baru ditandai selesai di atas belum tentu satu-satunya --
    // marker Admin (sedang_bertugas) baru dimatikan begitu SELURUH tugas
    // sesi ini (bukan cuma rute/sekolah yang sedang ditampilkan) benar-benar
    // sudah selesai.
    const sesiSelesai = daftarTugas.value
      .filter((t) => t.jenisPerjalanan === sesiTerpilih.value)
      .every((t) => !!t.diselesaikanPada);
    if (sesiSelesai) {
      perbaruiStatusBertugas(false).catch(() => {});
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal menandai tugas selesai.', 'error');
  } finally {
    sedangMenyelesaikan.value = false;
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
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Tugas Hari Ini</h1>
        <p class="text-xs text-on-surface-variant">Ikuti urutan rute optimal untuk efisiensi waktu penjemputan siswa.</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-2xl grid grid-cols-2 gap-4 soft-shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Pilih Sesi Perjalanan:</label>
        <select
          v-model="sesiTerpilih"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
        >
          <option value="pagi">Sesi Pagi (Jemput Sekolah)</option>
          <option value="sore">Sesi Sore (Antar Pulang)</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Filter Sekolah:</label>
        <select
          v-model="sekolahTerpilih"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
        >
          <option v-if="daftarSekolahSesi.length === 0" value="">Tidak ada tugas sesi ini</option>
          <option v-for="sch in daftarSekolahSesi" :key="sch" :value="sch">{{ sch }}</option>
        </select>
      </div>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <template v-else-if="tugasTerfilter.length === 0">
      <div class="text-center py-16 text-on-surface-variant italic text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-2xl">
        Tidak ada tugas penjemputan pada sesi & sekolah yang dipilih hari ini.
      </div>
    </template>

    <template v-else>
      <!-- Gerbang "Mulai Bertugas" -- lihat catatan sesiSaatIniAktif di
           script. Daftar tugas di bawah tetap terlihat (read-only) selama
           belum ditekan, cuma dropdown ubah status yang dinonaktifkan. -->
      <div
        v-if="!sesiSaatIniAktif"
        class="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4"
      >
        <div class="flex items-center gap-2.5 text-amber-800">
          <PlayCircle class="w-5 h-5 flex-shrink-0" />
          <div class="text-xs">
            <p class="font-bold">Sesi {{ sesiTerpilih === 'pagi' ? 'Pagi' : 'Sore' }} belum dimulai</p>
            <p class="text-amber-700">Tekan "Mulai Bertugas" untuk mengaktifkan lokasi Anda & mulai mengubah status perjalanan.</p>
          </div>
        </div>
        <TombolUtama tema="terang" varian="utama" class="justify-center bg-amber-600 hover:bg-amber-700 flex-shrink-0" @click="mulaiBertugas">
          <PlayCircle class="w-4 h-4" />
          Mulai Bertugas
        </TombolUtama>
      </div>
      <div
        v-else-if="errorLokasi"
        class="flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-700"
      >
        <AlertTriangle class="w-5 h-5 flex-shrink-0" />
        <p>{{ errorLokasi }}</p>
      </div>

      <!-- Layout: Detail Rute (utama, lebih besar) + Peta Navigasi (pendamping) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left (2 Columns): Detail Rute Terhitung -- kartu utama, interaktif -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-4 soft-shadow">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Detail Rute Terhitung</h3>
                <p class="text-[11px] text-on-surface-variant">Estimasi durasi optimal & status tiap titik singgah</p>
              </div>
              <div class="flex items-center gap-1.5">
                <label class="text-[10px] font-bold text-on-surface-variant uppercase">Urutkan:</label>
                <select
                  v-model="urutanJarak"
                  class="px-2.5 py-1.5 bg-surface-bright border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-[11px]"
                >
                  <option value="terjauh">Terjauh ke Terdekat</option>
                  <option value="terdekat">Terdekat ke Terjauh</option>
                </select>
              </div>
            </div>

            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div class="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span class="text-on-surface-variant">Total Titik Singgah:</span>
                  <span class="text-on-surface font-bold">{{ tugasTerfilter.length }} Titik</span>
                </div>
                <div class="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span class="text-on-surface-variant">Estimasi Waktu Tempuh:</span>
                  <span class="text-on-surface font-bold">{{ totalWaktuEst }} Menit</span>
                </div>
              </div>

              <!-- Sequence List -->
              <div class="space-y-2 pt-2">
                <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide flex items-center gap-1">
                  <component :is="urutanJarak === 'terjauh' ? ArrowDownWideNarrow : ArrowUpNarrowWide" class="w-3.5 h-3.5" />
                  Urutan Titik Singgah:
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(anak, idx) in tugasTerurut"
                    :key="anak.perjalananId"
                    class="flex items-center gap-3 bg-surface-container p-3 rounded-lg border border-outline-variant/20 text-[11px]"
                  >
                    <span class="w-6 h-6 rounded-full bg-primary text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                      {{ idx + 1 }}
                    </span>
                    <div class="overflow-hidden flex-grow min-w-0">
                      <p class="text-on-surface font-bold truncate">{{ anak.nama }}</p>
                      <p class="text-[9px] text-on-surface-variant truncate">
                        {{ anak.jenisPerjalanan === 'pagi' ? anak.alamatJemput : anak.alamatAntar }}
                        &middot; {{ jarakKeSekolah(anak).toFixed(1) }} km dari sekolah
                      </p>
                    </div>
                    <select
                      :value="anak.status"
                      :disabled="sedangMengubahStatus === anak.perjalananId || !!anak.diselesaikanPada || !sesiSaatIniAktif"
                      @change="ubahStatusDropdown(anak, ($event.target as HTMLSelectElement).value as StatusPerjalanan)"
                      class="flex-shrink-0 px-2 py-1.5 bg-surface-bright border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-[10px] font-semibold disabled:opacity-50"
                    >
                      <option v-for="opsi in opsiStatusDropdown(anak.jenisPerjalanan)" :key="opsi.value" :value="opsi.value">{{ opsi.label }}</option>
                    </select>
                  </div>

                  <div class="flex items-center gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-[11px]">
                    <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                      ✓
                    </span>
                    <div>
                      <p class="text-on-surface font-bold">Sekolah Tujuan</p>
                      <p class="text-[9px] text-on-surface-variant truncate">{{ sekolahTerpilih }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tombol Tandai Tugas Selesai -->
              <div class="pt-3 border-t border-outline-variant/20">
                <div
                  v-if="ruteSudahSelesaiDitandai"
                  class="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200"
                >
                  <CheckCircle2 class="w-4 h-4 flex-shrink-0" />
                  <span>Tugas rute ini telah diselesaikan{{ waktuRuteSelesai ? ` pada ${waktuRuteSelesai}` : '' }}.</span>
                </div>
                <template v-else>
                  <TombolUtama
                    tema="terang"
                    varian="utama"
                    class="w-full gap-1.5 justify-center bg-emerald-600 hover:bg-emerald-700"
                    :nonaktif="!semuaTitikSampaiTujuan || !sesiSaatIniAktif"
                    @click="modalSelesaiTampil = true"
                  >
                    <CheckCircle2 class="w-4 h-4" />
                    Tandai Tugas Hari Ini Telah Selesai
                  </TombolUtama>
                  <p v-if="!semuaTitikSampaiTujuan" class="flex items-center gap-1.5 text-[10px] text-on-surface-variant italic pt-2">
                    <Lock class="w-3.5 h-3.5 flex-shrink-0" />
                    Selesaikan seluruh titik singgah terlebih dahulu sebelum mengakhiri tugas.
                  </p>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Right (1 Column): Peta Navigasi -->
        <div class="space-y-6">
          <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <Navigation class="w-4 h-4 text-primary" />
                Peta Rute Navigasi
              </h3>
              <!-- Tombol Simulasi Pergerakan -- KHUSUS demo (mis. sidang
                   tugas akhir, tidak mungkin jalan kaki sungguhan sambil
                   presentasi). import.meta.env.DEV supaya tombol ini otomatis
                   tidak ikut ter-bundle/tampil di build produksi. -->
              <button
                v-if="modeDev"
                type="button"
                :disabled="sedangSimulasi || sedangMuatRuteSimulasi || titikJemputMentah.length < 2"
                @click="mulaiDemoSimulasi"
                class="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Menggerakkan marker supir otomatis mengikuti jalan sungguhan -- khusus demo/sidang"
              >
                {{ sedangMuatRuteSimulasi ? 'Menghitung rute...' : sedangSimulasi ? 'Simulasi Berjalan...' : 'Simulasikan Pergerakan (Demo)' }}
              </button>
            </div>
            <PetaRuteOptimal
              :listAnak="tugasTerurut"
              :lintang-sekolah="sekolahAktif?.lintangSekolah"
              :bujur-sekolah="sekolahAktif?.bujurSekolah"
              :nama-sekolah="sekolahTerpilih"
              :posisi-supir="posisiSaatIni"
              tinggi="320px"
              :mode-simulasi-demo="modeDev"
              :sedang-simulasi="sedangSimulasi"
              :sedang-muat-rute-simulasi="sedangMuatRuteSimulasi"
              :simulasi-nonaktif="titikJemputMentah.length < 2"
              @mulai-simulasi="mulaiDemoSimulasi"
            />
          </div>
        </div>

      </div>

      <!-- Student Cards List -->
      <div class="space-y-4">
        <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Daftar Penjemputan Siswa</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KartuTugas
            v-for="(anak, idx) in tugasTerurut"
            :key="anak.perjalananId"
            :anak="anak"
            :urutan="idx + 1"
            @buka-kendala="bukaKendalaModal"
          />
        </div>
      </div>
    </template>

    <!-- Modal Laporan Kendala -->
    <ModalLaporanKendala
      :tampil="modalKendalaTampil"
      :anak="anakAktif"
      :daftar-anak="daftarAnakUnik"
      :sedang-mengirim="sedangMemproses"
      @tutup="modalKendalaTampil = false"
      @kirim-kendala="laporkanKendalaBaru"
    />

    <!-- Modal Konfirmasi Selesaikan Tugas -->
    <ModalUtama
      tema="terang"
      :tampil="modalSelesaiTampil"
      judul="Selesaikan Tugas Perjalanan"
      @tutup="modalSelesaiTampil = false"
    >
      <p class="text-xs text-on-surface-variant leading-relaxed">
        Apakah Anda yakin ingin menyelesaikan tugas perjalanan hari ini? Setelah ditandai selesai, status seluruh titik
        singgah pada rute ini <strong>tidak dapat diubah kembali</strong>.
      </p>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenyelesaikan" @click="modalSelesaiTampil = false">
          Batal
        </TombolUtama>
        <TombolUtama
          tema="terang"
          varian="utama"
          class="bg-emerald-600 hover:bg-emerald-700"
          :nonaktif="sedangMenyelesaikan"
          @click="konfirmasiSelesaikanRute"
        >
          {{ sedangMenyelesaikan ? 'Menyimpan...' : 'Ya, Selesaikan Tugas' }}
        </TombolUtama>
      </template>
    </ModalUtama>

  </div>
</template>
