<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Clock, CalendarDays, ShieldAlert, Check, MapPin, AlertTriangle, Lock, Pencil, Trash2, CreditCard, Loader2 } from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import PemilihPeta from '../umum/PemilihPeta.vue';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import {
  ajukanAbsenHarian,
  ajukanCuti as ajukanCutiLayanan,
  perbaruiCuti as perbaruiCutiLayanan,
  hapusCuti as hapusCutiLayanan,
  ambilRiwayatCuti,
  ajukanPerubahanJadwal as ajukanPerubahanJadwalLayanan,
  konfirmasiPembayaranPerubahanJadwal as konfirmasiPembayaranPerubahanJadwalLayanan,
  perbaruiPengajuanPerubahanJadwal as perbaruiPengajuanPerubahanJadwalLayanan,
  hapusPengajuanPerubahanJadwal as hapusPengajuanPerubahanJadwalLayanan,
  editPengajuanPerubahanJadwalAktif as editPengajuanPerubahanJadwalAktifLayanan,
  batalkanPengajuanPerubahanJadwalAktif as batalkanPengajuanPerubahanJadwalAktifLayanan,
  ambilJadwalMingguan,
  ambilRiwayatAbsen,
  ambilRiwayatPerubahanJadwal,
  ambilKuotaPerubahanJadwal,
  ambilRiwayatPerubahanJadwalMingguan,
  ubahJadwalMingguan,
  rekonsiliasiPengajuanPerubahanJadwal,
  perbaruiAlamatAnak,
  type KuotaPerubahanJadwal
} from '../../layanan/orangTuaLayanan';
import { ambilPengaturanTarif, hitungBiayaPerubahanJadwal, type PengaturanTarifRow } from '../../layanan/tarifLayanan';
import { formatMataUang } from '../../bantuan/formatMataUang';
import { unduhStrukPembayaran } from '../../bantuan/strukPdf';
import { unduhInvoice as unduhInvoicePdf } from '../../bantuan/invoicePdf';
import { ambilHariLiburRentang, ambilTanggalAktifAbsensi } from '../../layanan/kalenderLayanan';
import { hitungJarakKm } from '../../bantuan/jarak';
import { buatKalenderBulanIni, tanggalLiburKeSet, rentangTanggalKeSet } from '../../bantuan/kalenderJadwal';
import { hitungTanggalAktifAbsensi, formatTanggalIndonesia, formatTanggalIndonesiaDenganHari, apakahDalamJendelaAksesPerubahanJadwal, apakahJendelaAbsensiTerbuka } from '../../bantuan/periodeAbsensi';
import { ambilWaktuSekarang, ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import { prosesPembayaranMidtrans } from '../../layanan/midtransLayanan';
import { pantauTabelAnakRealtime } from '../../layanan/realtimeLayanan';
import { denyutWaktuUI } from '../../bantuan/statusPerjalanan';
import { teksTerisi } from '../../bantuan/validasiForm';
import type { PengajuanPerubahanJadwalRow, PengajuanCutiRow, HariLiburRow, RiwayatPerubahanJadwalMingguanRow } from '../../tipe';

const { anakAktifList: seluruhAnakList, sedangMemuat: sedangMemuatAnak, sudahDimuat, muatAnak, profil } = useDataOrangTua();

// Fitur di halaman ini (jadwal mingguan, kalender hari efektif, absen
// harian, cuti/libur, perubahan jadwal) semuanya berbasis konsep "hari
// efektif sekolah per minggu" yang HANYA berlaku untuk langganan BULANAN --
// langganan harian dibayar & berlaku per hari (tidak punya pola mingguan
// untuk diatur). TataLetakOrangTua.vue sudah menyembunyikan tab "Jadwal"
// kalau akun sama sekali tidak punya anak bulanan, tapi begitu akun punya
// campuran bulanan+harian, dropdown "Pilih Anak" di halaman ini masih perlu
// disaring sendiri supaya anak berlangganan harian tidak bisa dipilih di
// sini. `seluruhAnakList` di sini sudah bersumber dari anakAktifList (anak
// yang langganannya sudah lunas & masih berlaku) -- anak yang belum
// menyelesaikan pembayaran tidak boleh bisa diatur jadwalnya sama sekali.
const anakList = computed(() => seluruhAnakList.value.filter((a) => a.jenis_langganan === 'bulanan'));

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const anakTerpilihId = ref<string | null>(null);
watch(
  anakList,
  (list) => {
    if (!anakTerpilihId.value && list.length > 0) anakTerpilihId.value = list[0].id;
  },
  { immediate: true }
);

const sedangMemuatJadwal = ref(false);

// State Jadwal Mingguan (kunci berbahasa Indonesia untuk kompatibilitas tampilan,
// dipetakan ke/dari kolom lowercase tabel jadwal_mingguan saat memuat/menyimpan)
const jadwalMingguan = ref({
  Senin: true,
  Selasa: true,
  Rabu: true,
  Kamis: true,
  Jumat: true,
  Sabtu: false,
  Minggu: false
});

// State Absen Harian -- menargetkan "tanggal aktif absensi" (lihat
// ambilTanggalAktifAbsensi di src/layanan/kalenderLayanan.ts), bukan lagi
// literal "hari ini": otomatis melompati Sabtu/Minggu DAN tanggal cuti
// bersama/libur nasional yang ditetapkan Admin (bukan hari operasional),
// lalu berpindah ke tanggal aktif berikutnya begitu lewat pukul 06:30 WIB
// pada tanggal yang sedang aktif -- pola yang sama dengan absensi kesiapan
// supir. Nilai awal pakai versi SINKRON (skip Sabtu/Minggu saja) supaya
// tidak perlu menunggu network sebelum render pertama; diperbarui ke versi
// ASYNC (ikut menyaring hari_libur Admin) di onMounted DAN dihitung ulang
// setiap denyutWaktuUI berdetak (lihat watch di bawah) -- SEBELUMNYA nilai
// ini hanya dihitung sekali saat halaman dibuka lalu beku selamanya, jadi
// begitu jam melewati batas 17:00 WIB (atau waktu simulasi digeser lewat
// PengaturanWaktuDemo.vue) sementara tab ini tetap terbuka, "tanggal aktif
// absensi" yang ditampilkan tidak pernah ikut berpindah tanpa reload manual.
const tanggalAktifAbsen = ref(hitungTanggalAktifAbsensi());
const tanggalAktifAbsenFormat = computed(() => formatTanggalIndonesia(tanggalAktifAbsen.value));
const tanggalAktifAbsenFormatLengkap = computed(() => formatTanggalIndonesiaDenganHari(tanggalAktifAbsen.value));
const absenHariIni = ref<'masuk' | 'tidak_masuk'>('masuk');
// Tombol Masuk Sekolah/Absen-Libur hanya aktif selama jendela pengisian
// absensi terbuka (17:00 WIB H-1 s.d. 06:30 WIB hari-H) -- pola yang sama
// dengan absensi kesiapan supir (lihat AbsensiSupir.vue). WAJIB computed +
// bergantung pada denyutWaktuUI (BUKAN nilai boolean biasa yang dihitung
// sekali) -- lihat catatan yang sama di atas soal tanggalAktifAbsen.
const jendelaAbsenTerbuka = computed(() => {
  void denyutWaktuUI.value;
  return apakahJendelaAbsensiTerbuka();
});

// Kalender Bulanan -- visualisasi tanggal yang otomatis dipetakan dari pola
// jadwalMingguan (Revisi Panel Pengguna #1). Reaktif terhadap jadwalMingguan
// supaya tanda tanggal langsung berubah begitu checkbox hari diklik, tanpa
// menunggu tombol "Simpan" ditekan. hariIniObj/hariIniIso JUGA WAJIB
// computed + denyutWaktuUI (bukan Date/string biasa yang dihitung sekali
// saat setup) -- lihat catatan di atas, ini yang menggerakkan
// namaBulanTahunIni & kalenderBulanIni supaya keduanya ikut waktu simulasi
// terkini, bukan waktu saat halaman pertama kali dibuka.
const hariIniObj = computed(() => {
  void denyutWaktuUI.value;
  return ambilWaktuSekarang();
});
const hariIniIso = computed(() => {
  void denyutWaktuUI.value;
  return ambilTanggalWibSekarang();
});

const namaBulanTahunIni = computed(() =>
  hariIniObj.value.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
);

// Hari libur bulan berjalan untuk sekolah anak yang sedang dipilih --
// dikecualikan dari kalender jadwal bulanan (lihat tanggalLiburKeSet di
// kalenderJadwal.ts), sinkron dengan estimasi biaya di wizard berlangganan.
const daftarHariLiburBulanIni = ref<HariLiburRow[]>([]);

// Cuti/libur anak yang sedang dipilih -- diratakan ke Set tanggal ISO harian
// dan digabung dengan hari_libur Admin, supaya kalender "Konfigurasi Jadwal
// Bulanan" otomatis menandai tanggal cuti begitu ditambah/diubah/dihapus
// (reaktif terhadap riwayatCuti, tidak perlu reload halaman).
const kalenderBulanIni = computed(() => {
  const tanggalLibur = tanggalLiburKeSet(daftarHariLiburBulanIni.value, anakTerpilihObj.value?.sekolah_id);
  // Konsisten dengan saringAnakTersediaUntukTanggal() di adminLayanan.ts:
  // cuti berstatus 'ditolak' tidak dianggap berlaku.
  const tanggalCuti = rentangTanggalKeSet(riwayatCuti.value.filter((c) => c.status !== 'ditolak'));
  for (const t of tanggalCuti) tanggalLibur.add(t);
  return buatKalenderBulanIni(jadwalMingguan.value, hariIniObj.value, tanggalLibur);
});

// State Ubah Jadwal (Pergi/Pulang)
const jenisPerubahan = ref<'pergi' | 'pulang'>('pulang');
const perubahanTanggal = ref(ambilTanggalWibSekarang());
const perubahanWaktu = ref('13:00');
const alamatPerubahan = ref('');
const lintangPerubahan = ref(0);
const bujurPerubahan = ref(0);
const tampilkanPetaPerubahan = ref(false);
const tipePerubahan = ref<'alamat' | 'jadwal'>('alamat');
const sedangMenyimpanAlamat = ref(false);

const tarifAktif = ref<PengaturanTarifRow | null>(null);

const anakTerpilihObj = computed(() => anakList.value.find((a) => a.id === anakTerpilihId.value) ?? null);

// Alamat default mengikuti alamat anak yang sudah tersimpan (jemput untuk
// Jadwal Pergi, antar untuk Jadwal Pulang) -- pengguna tetap bisa mengedit.
function terapkanAlamatDefault() {
  const anak = anakTerpilihObj.value;
  if (!anak) return;
  if (jenisPerubahan.value === 'pergi') {
    alamatPerubahan.value = anak.alamat_jemput;
    lintangPerubahan.value = anak.lintang_jemput;
    bujurPerubahan.value = anak.bujur_jemput;
  } else {
    alamatPerubahan.value = anak.alamat_antar;
    lintangPerubahan.value = anak.lintang_antar;
    bujurPerubahan.value = anak.bujur_antar;
  }
}

watch([anakTerpilihObj, jenisPerubahan], terapkanAlamatDefault, { immediate: true });

const tanganiPetaPerubahan = (data: { lintang: number; bujur: number; alamat: string }) => {
  lintangPerubahan.value = data.lintang;
  bujurPerubahan.value = data.bujur;
  alamatPerubahan.value = data.alamat;
};

// Jarak alamat perubahan ke sekolah anak -- basis perhitungan biaya tambahan
const jarakPerubahanKm = computed(() => {
  const sekolah = anakTerpilihObj.value?.sekolah;
  if (!sekolah?.lintang || !sekolah?.bujur) return 0;
  return hitungJarakKm(lintangPerubahan.value, bujurPerubahan.value, sekolah.lintang, sekolah.bujur);
});

// Biaya tambahan perubahan jadwal (Revisi Panel Pengguna #2): Rp15.000 dasar
// s.d. 3,5 km + Rp4.200/km berikutnya (dari pengaturan_tarif, lihat
// hitungBiayaPerubahanJadwal di tarifLayanan.ts).
const biayaTambahanHitung = computed(() => {
  if (!tarifAktif.value) return 0;
  return hitungBiayaPerubahanJadwal(tarifAktif.value, jarakPerubahanKm.value);
});

// Posisi pin yang sedang disesuaikan di halaman penuh PemilihPeta (belum
// dikonfirmasi) -- dipakai untuk menghitung estimasi biaya tambahan secara
// realtime dan mengopernya kembali ke PemilihPeta lewat prop `estimasi-biaya`.
const posisiDraftPeta = ref<{ lintang: number; bujur: number } | null>(null);

const tanganiPosisiPetaBerubah = (data: { lintang: number; bujur: number }) => {
  posisiDraftPeta.value = data;
};

const jarakDraftKm = computed(() => {
  if (!posisiDraftPeta.value) return 0;
  const sekolah = anakTerpilihObj.value?.sekolah;
  if (!sekolah?.lintang || !sekolah?.bujur) return 0;
  return hitungJarakKm(posisiDraftPeta.value.lintang, posisiDraftPeta.value.bujur, sekolah.lintang, sekolah.bujur);
});

const biayaTambahanDraft = computed(() => {
  if (!tarifAktif.value || !posisiDraftPeta.value) return null;
  return hitungBiayaPerubahanJadwal(tarifAktif.value, jarakDraftKm.value);
});

const riwayatPerubahan = ref<PengajuanPerubahanJadwalRow[]>([]);
// Baris berstatus 'ditolak' TETAP disimpan di database sebagai jejak
// riwayat (lihat catatan lengkap di konfirmasiHapusPerubahanJadwal() --
// dibutuhkan utk rollback sinkronisasi jadwal supir), tapi TIDAK perlu
// terus terlihat di daftar "Riwayat Pengajuan Perubahan" orang tua --
// sebelumnya baris "Dibatalkan" menumpuk tanpa batas di sana setiap kali
// pengguna mengulang pengajuan (mis. karena gerbang pembayaran sempat
// terasa lambat), bikin daftar terlihat penuh sampah. Disaring di sini
// (bukan dihapus di database) supaya satu computed ini otomatis menutupi
// baik baris lama yang sudah 'ditolak' dari awal DIMUAT, maupun baris yang
// BARU SAJA dibatalkan lewat tombol Hapus/Batalkan.
const riwayatPerubahanTampil = computed(() => riwayatPerubahan.value.filter((p) => p.status === 'disetujui'));

// State Cuti / Libur
const cutiMulai = ref('');
const cutiSelesai = ref('');
const cutiAlasan = ref('sakit');
const riwayatCuti = ref<PengajuanCutiRow[]>([]);
// null = mode tambah baru; terisi = sedang mengedit baris dengan id ini
const cutiIdSedangDiedit = ref<string | null>(null);

// Kuota & riwayat "Simpan Perubahan Jadwal" (jadwal mingguan) -- BEDA dari
// riwayatPerubahan di atas (itu utk fitur "Ajukan Perubahan Jadwal" yang
// terpisah). Lihat ubahJadwalMingguan()/ambilKuotaPerubahanJadwal() di
// orangTuaLayanan.ts.
const kuotaPerubahanJadwal = ref<KuotaPerubahanJadwal | null>(null);
const riwayatPerubahanJadwalMingguan = ref<RiwayatPerubahanJadwalMingguanRow[]>([]);

async function muatDataAnakTerpilih() {
  if (!anakTerpilihId.value) return;
  sedangMemuatJadwal.value = true;
  try {
    // Perbaikan mandiri (best-effort) dulu -- lihat catatan lengkap di
    // rekonsiliasiPengajuanPerubahanJadwal() (orangTuaLayanan.ts): kalau tab
    // sempat tertutup/koneksi terputus persis setelah Midtrans mengonfirmasi
    // lunas tapi sebelum langkah "terapkan perubahan jadwal" sempat
    // berjalan, pengajuan bisa nyangkut selamanya di status 'menunggu'
    // walau pembayarannya sudah lunas.
    // Jalankan rekonsiliasi di latar belakang (background) agar tidak menghambat pemuatan data utama
    rekonsiliasiPengajuanPerubahanJadwal().catch((err) => {
      console.error('Gagal merekonsiliasi pengajuan perubahan jadwal (background):', err);
    });

    const [jadwal, riwayatAbsen, riwayatPerubahanJadwal, riwayatCutiAnak] = await Promise.all([
      ambilJadwalMingguan(anakTerpilihId.value),
      ambilRiwayatAbsen(anakTerpilihId.value),
      ambilRiwayatPerubahanJadwal(anakTerpilihId.value),
      ambilRiwayatCuti(anakTerpilihId.value)
    ]);

    if (jadwal) {
      jadwalMingguan.value = {
        Senin: jadwal.senin, Selasa: jadwal.selasa, Rabu: jadwal.rabu, Kamis: jadwal.kamis,
        Jumat: jadwal.jumat, Sabtu: jadwal.sabtu, Minggu: jadwal.minggu
      };
    }

    const absenHariIniRow = riwayatAbsen.find((a) => a.tanggal === tanggalAktifAbsen.value);
    absenHariIni.value = absenHariIniRow?.status ?? 'masuk';

    riwayatPerubahan.value = riwayatPerubahanJadwal;
    riwayatCuti.value = riwayatCutiAnak;
    batalEditCuti();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat data jadwal.', 'error');
  } finally {
    sedangMemuatJadwal.value = false;
  }

  // Dipisah dari Promise.all di atas SENGAJA -- tabel
  // riwayat_perubahan_jadwal_mingguan adalah migrasi BARU yang mungkin
  // belum dijalankan Admin di Supabase (lihat skema_database.sql). Kalau
  // query ini gagal (mis. tabel belum ada), jangan sampai fitur inti
  // (absen harian, jadwal mingguan, cuti) ikut gagal dimuat hanya karena
  // fitur kuota/riwayat perubahan jadwal ini belum tersedia.
  try {
    const [kuota, riwayatJadwalMingguan] = await Promise.all([
      ambilKuotaPerubahanJadwal(anakTerpilihId.value),
      ambilRiwayatPerubahanJadwalMingguan(anakTerpilihId.value)
    ]);
    kuotaPerubahanJadwal.value = kuota;
    riwayatPerubahanJadwalMingguan.value = riwayatJadwalMingguan;
  } catch {
    // Biarkan kuotaPerubahanJadwal tetap null -- template menampilkan '-'
    // dan tombol Simpan tetap aktif (tidak diblokir kuota yang gagal dimuat).
  }
}

// Menghitung ulang tanggalAktifAbsen (versi ASYNC, ikut menyaring hari
// libur/cuti bersama Admin) -- dipanggil sekali di onMounted DAN setiap
// denyutWaktuUI berdetak (~tiap menit) supaya batas absensi ikut berpindah
// begitu waktu simulasi melewati pukul 17:00 WIB tanpa perlu reload halaman.
async function segarkanTanggalAktifAbsen() {
  try {
    tanggalAktifAbsen.value = await ambilTanggalAktifAbsensi();
  } catch {
    // Biarkan nilai sinkron terakhir (skip Sabtu/Minggu saja) bila gagal memuat
    tanggalAktifAbsen.value = hitungTanggalAktifAbsensi();
  }
}
watch(denyutWaktuUI, segarkanTanggalAktifAbsen);

onMounted(async () => {
  await segarkanTanggalAktifAbsen();
  if (!sudahDimuat.value) await muatAnak();
  await muatDataAnakTerpilih();
  try {
    tarifAktif.value = await ambilPengaturanTarif();
  } catch {
    // Biarkan biaya tampil 0 bila gagal memuat pengaturan tarif
  }
  try {
    const acuan = hariIniObj.value;
    const awalBulan = `${acuan.getFullYear()}-${String(acuan.getMonth() + 1).padStart(2, '0')}-01`;
    const akhirTanggal = new Date(acuan.getFullYear(), acuan.getMonth() + 1, 0).getDate();
    const akhirBulan = `${acuan.getFullYear()}-${String(acuan.getMonth() + 1).padStart(2, '0')}-${String(akhirTanggal).padStart(2, '0')}`;
    daftarHariLiburBulanIni.value = await ambilHariLiburRentang(awalBulan, akhirBulan);
  } catch {
    // Biarkan kalender tampil tanpa penanda libur bila gagal dimuat
  }
  mulaiRealtimePengajuan();
});

// Realtime pengajuan_cuti/pengajuan_absen/pengajuan_perubahan_jadwal milik
// SELURUH anak berlangganan bulanan akun ini (bukan cuma anak yang sedang
// dipilih di dropdown) -- begitu Admin/sistem mengubah status pengajuan
// (mis. hari libur baru memengaruhi kalender), atau pengajuan diajukan dari
// perangkat lain, data di halaman ini ikut ter-refresh tanpa reload manual.
// Direfetch lewat muatDataAnakTerpilih() (bukan patch in-place) supaya
// tetap sederhana & konsisten dgn kuota/kalender yang juga perlu dihitung
// ulang -- lihat catatan anti-over-engineering, cukup satu jalur refresh.
let saluranCuti: { unsubscribe: () => void } | null = null;
let saluranAbsen: { unsubscribe: () => void } | null = null;
let saluranPerubahanJadwal: { unsubscribe: () => void } | null = null;
let anakIdsDipantauJadwal: string[] = [];

function mulaiRealtimePengajuan() {
  const anakIds = anakList.value.map((a) => a.id);
  if (anakIds.length === 0) return;
  const sudahSama =
    anakIds.length === anakIdsDipantauJadwal.length && anakIds.every((id) => anakIdsDipantauJadwal.includes(id));
  if (sudahSama && saluranCuti) return;

  hentikanRealtimePengajuan();
  anakIdsDipantauJadwal = anakIds;

  const muatUlang = () => { void muatDataAnakTerpilih(); };
  saluranCuti = pantauTabelAnakRealtime('pengajuan_cuti', anakIds, muatUlang);
  saluranAbsen = pantauTabelAnakRealtime('pengajuan_absen', anakIds, muatUlang);
  saluranPerubahanJadwal = pantauTabelAnakRealtime('pengajuan_perubahan_jadwal', anakIds, muatUlang);
}

function hentikanRealtimePengajuan() {
  saluranCuti?.unsubscribe();
  saluranCuti = null;
  saluranAbsen?.unsubscribe();
  saluranAbsen = null;
  saluranPerubahanJadwal?.unsubscribe();
  saluranPerubahanJadwal = null;
  anakIdsDipantauJadwal = [];
}

onUnmounted(hentikanRealtimePengajuan);

// Anak baru bisa bertambah (mis. wizard Tambah Anak diselesaikan) selagi
// halaman ini terbuka -- segarkan langganan realtime supaya anak baru ikut
// terpantau tanpa perlu reload.
watch(anakList, () => mulaiRealtimePengajuan());

watch(anakTerpilihId, () => {
  // Batalkan edit pengajuan perubahan jadwal yang sedang berjalan -- baris
  // yang diedit terikat ke anak SEBELUMNYA, melanjutkan edit dgn anak baru
  // terpilih bisa menyimpan alamat/biaya yang dihitung dari sekolah anak
  // yang salah.
  batalEditPerubahanJadwal();
  muatDataAnakTerpilih();
});

// Checkbox jadwalMingguan cuma DRAFT lokal -- tidak menyentuh database sama
// sekali sampai tombol "Simpan Perubahan Jadwal" ini ditekan. Baru di sinilah
// validasi kuota (maks 2x/minggu) & jendela waktu dijalankan, jadwal resmi
// diperbarui, riwayat dicatat, dan notifikasi ke Admin/supir dikirim --
// lihat ubahJadwalMingguan() di orangTuaLayanan.ts utk detail lengkapnya.
const sedangMenyimpanJadwal = ref(false);

const jendelaPerubahanJadwalMingguanDiizinkan = computed(() => !jendelaAbsenTerbuka.value);
const kuotaHabis = computed(() => (kuotaPerubahanJadwal.value?.sisa ?? 1) <= 0);
const tombolSimpanJadwalNonaktif = computed(
  () => sedangMenyimpanJadwal.value || kuotaHabis.value || !jendelaPerubahanJadwalMingguanDiizinkan.value
);

const simpanJadwalMingguan = async () => {
  if (!anakTerpilihId.value || tombolSimpanJadwalNonaktif.value) return;
  // Minimal 1 hari wajib aktif -- pola kosong membuat anak tidak pernah
  // masuk daftar penugasan supir sama sekali walau langganan tetap aktif.
  if (!Object.values(jadwalMingguan.value).some(Boolean)) {
    picuToast('Pilih minimal 1 hari jadwal sebelum menyimpan.', 'error');
    return;
  }
  sedangMenyimpanJadwal.value = true;
  try {
    const hasil = await ubahJadwalMingguan({
      anakId: anakTerpilihId.value,
      namaAnak: namaAnakTerpilih.value,
      senin: jadwalMingguan.value.Senin,
      selasa: jadwalMingguan.value.Selasa,
      rabu: jadwalMingguan.value.Rabu,
      kamis: jadwalMingguan.value.Kamis,
      jumat: jadwalMingguan.value.Jumat,
      sabtu: jadwalMingguan.value.Sabtu,
      minggu: jadwalMingguan.value.Minggu
    });
    kuotaPerubahanJadwal.value = hasil.kuota;
    if (hasil.adaPerubahan) {
      riwayatPerubahanJadwalMingguan.value = await ambilRiwayatPerubahanJadwalMingguan(anakTerpilihId.value);
      picuToast(
        `Perubahan jadwal berhasil disimpan! Sisa kuota minggu ini: ${hasil.kuota.sisa}/${hasil.kuota.batas} kali.`,
        'sukses'
      );
    } else {
      picuToast('Tidak ada perubahan hari yang perlu disimpan.', 'info');
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan jadwal mingguan.', 'error');
  } finally {
    sedangMenyimpanJadwal.value = false;
  }
};

// Perubahan absen TIDAK langsung diterapkan saat tombol ditekan -- wajib
// lewat dialog konfirmasi dulu (mencegah salah pencet/human error yang bisa
// membuat supir gagal jemput atau datang tanpa perlu).
const modalKonfirmasiAbsenTampil = ref(false);
const statusAbsenDipilih = ref<'masuk' | 'tidak_masuk' | null>(null);
const sedangMengubahAbsen = ref(false);

const bukaKonfirmasiAbsen = (status: 'masuk' | 'tidak_masuk') => {
  if (!jendelaAbsenTerbuka || !anakTerpilihId.value || status === absenHariIni.value) return;
  statusAbsenDipilih.value = status;
  modalKonfirmasiAbsenTampil.value = true;
};

const konfirmasiUbahAbsenHarian = async () => {
  if (!anakTerpilihId.value || !statusAbsenDipilih.value) return;
  const status = statusAbsenDipilih.value;
  sedangMengubahAbsen.value = true;
  try {
    await ajukanAbsenHarian({
      anakId: anakTerpilihId.value,
      tanggal: tanggalAktifAbsen.value,
      status
    });
    absenHariIni.value = status;
    modalKonfirmasiAbsenTampil.value = false;
    picuToast(`Absensi tanggal ${tanggalAktifAbsenFormat} berhasil diubah menjadi: ${status === 'masuk' ? 'MASUK' : 'TIDAK MASUK'}`, 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui absensi.', 'error');
  } finally {
    sedangMengubahAbsen.value = false;
  }
};

// Fitur Ajukan Perubahan Jadwal terbuka pukul 00:00-15:00 WIB (lihat
// apakahDalamJendelaAksesPerubahanJadwal). denyutWaktuUI dibaca supaya
// computed ini otomatis ikut berubah begitu jam melewati batas, tanpa
// perlu reload halaman.
const jendelaPerubahanJadwalTerbuka = computed(() => {
  void denyutWaktuUI.value;
  return apakahDalamJendelaAksesPerubahanJadwal();
});

// Gerbang pembayaran (simulator Midtrans Snap) -- dibuka begitu pengajuan
// tersimpan TAPI masih ada biaya tambahan yang belum dibayar. Sinkronisasi
// ke jadwal supir & notifikasi Admin baru dijalankan SETELAH pembayaran ini
// dikonfirmasi (lihat konfirmasiPembayaranPerubahanJadwal di
// orangTuaLayanan.ts) -- kalau biaya tambahannya 0, langsung berlaku tanpa
// perlu ke gerbang ini sama sekali.
const modalBayarPerubahanTampil = ref(false);
const sedangKonfirmasiBayar = ref(false);
// Teks progres Midtrans Snap sungguhan ("Membuka jendela pembayaran...",
// "Menunggu konfirmasi pembayaran...", dst) -- lihat onProgres di
// prosesPembayaranMidtrans() (midtransLayanan.ts), pola yang sama persis
// dengan gerbang Snap di wizard berlangganan (HalamanBerlangganan.vue).
const progresBayarPerubahanTeks = ref('');
const dataMenungguBayar = ref<{
  pengajuanId: string;
  pembayaranId: string;
  idPesananMidtrans: string | null;
  anakId: string;
  namaAnak: string;
  jenisPerubahan: 'pergi' | 'pulang';
  tanggal: string;
  waktuBaru: string;
  alamatBaru: string;
  jumlah: number;
} | null>(null);

// Pengajuan yang tanggal+jam barunya SUDAH LEWAT (relatif thd waktu WIB
// simulasi saat ini) tidak boleh lagi diedit/dihapus/dibatalkan -- baris itu
// murni riwayat, perjalanan yang bersangkutan bisa jadi sudah berjalan atau
// bahkan selesai. Pengajuan lama (era sebelum kolom `tanggal` ada, hanya
// punya `hari` pola mingguan tanpa tanggal absolut) sengaja TIDAK dianggap
// lewat -- tidak ada dasar tanggal pasti utk dibandingkan. `denyutWaktuUI`
// dibaca supaya ini otomatis ikut re-evaluasi begitu jam berjalan lewat,
// sama seperti jendelaPerubahanJadwalTerbuka di atas.
function waktuPerubahanSudahLewat(hist: PengajuanPerubahanJadwalRow): boolean {
  void denyutWaktuUI.value;
  if (!hist.tanggal) return false;
  const jadwalBaru = new Date(`${hist.tanggal}T${hist.waktu_baru}`);
  return jadwalBaru.getTime() < ambilWaktuSekarang().getTime();
}

// Edit pengajuan -- null berarti mode "ajukan baru". Berlaku utk pengajuan
// yang masih 'menunggu' pembayaran MAUPUN yang sudah 'disetujui' (berlaku);
// perilaku simpannya beda tergantung `perubahanJadwalStatusSedangDiedit`,
// lihat simpanPerubahanJadwal(). Lihat juga mulaiEditPerubahanJadwal() &
// batalEditPerubahanJadwal() di bawah.
const perubahanJadwalIdSedangDiedit = ref<string | null>(null);
const perubahanJadwalStatusSedangDiedit = ref<'menunggu' | 'disetujui' | null>(null);
const formPerubahanJadwalEl = ref<HTMLElement | null>(null);

const mulaiEditPerubahanJadwal = (hist: PengajuanPerubahanJadwalRow) => {
  if (waktuPerubahanSudahLewat(hist)) return;

  perubahanJadwalIdSedangDiedit.value = hist.id;
  perubahanJadwalStatusSedangDiedit.value = hist.status === 'disetujui' ? 'disetujui' : 'menunggu';
  jenisPerubahan.value = hist.jenis_perubahan;
  perubahanTanggal.value = hist.tanggal;
  perubahanWaktu.value = hist.waktu_baru;
  alamatPerubahan.value = hist.alamat_baru ?? '';
  lintangPerubahan.value = hist.lintang_baru ?? 0;
  bujurPerubahan.value = hist.bujur_baru ?? 0;

  // Form "Ajukan Perubahan Jadwal" ada di atas daftar Riwayat -- tanpa
  // scroll otomatis ini, klik tombol edit TERLIHAT seperti tidak merespons
  // sama sekali kalau pengguna sedang men-scroll ke bagian riwayat di
  // bawah, padahal form-nya sudah terisi ulang di luar area pandang. Toast
  // di bawah ini SENGAJA ditambahkan sebagai konfirmasi yang tidak mungkin
  // terlewat, terlepas dari posisi scroll ATAU isi form yang kebetulan
  // terlihat sama seperti sebelumnya.
  picuToast(
    `Mode ubah aktif untuk jadwal ${jenisPerubahan.value === 'pergi' ? 'berangkat' : 'pulang'} ${hist.tanggal ? formatTanggalIndonesiaDenganHari(hist.tanggal) : hist.hari}, ${hist.waktu_baru}. Ubah data di form atas lalu klik "Simpan Perubahan".`,
    'info'
  );
  formPerubahanJadwalEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const batalEditPerubahanJadwal = () => {
  perubahanJadwalIdSedangDiedit.value = null;
  perubahanJadwalStatusSedangDiedit.value = null;
};

// Popup "Perubahan Jadwal Berhasil" -- ditampilkan SETELAH pengajuan
// benar-benar berlaku (baik langsung tanpa biaya, maupun setelah gerbang
// pembayaran dikonfirmasi), BUKAN sekadar toast notifikasi. Dipakai bareng
// oleh kedua jalur (lihat ajukanPerubahanJadwal() &
// konfirmasiBayarPerubahanJadwal() di bawah) supaya pengalamannya SAMA
// persis terlepas dari ada biaya tambahan atau tidak.
const modalHasilTransaksiTampil = ref(false);
const hasilTransaksiPopup = ref<{
  nomorInvoice: string;
  namaAnak: string;
  jenisTransaksi: string;
  tanggalBaru: string;
  waktuBaru: string;
  alamatBaru: string;
  total: number;
  sudahDibayar: boolean;
  waktuTransaksi: string;
} | null>(null);

const bukaPopupHasilTransaksi = (params: {
  nomorInvoice: string;
  namaAnak: string;
  jenisPerubahan: 'pergi' | 'pulang';
  tanggal: string;
  waktuBaru: string;
  alamatBaru: string;
  total: number;
  sudahDibayar: boolean;
}) => {
  hasilTransaksiPopup.value = {
    nomorInvoice: params.nomorInvoice,
    namaAnak: params.namaAnak,
    jenisTransaksi: `Perubahan Jadwal ${params.jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang'}`,
    tanggalBaru: formatTanggalIndonesiaDenganHari(params.tanggal),
    waktuBaru: params.waktuBaru,
    alamatBaru: params.alamatBaru,
    total: params.total,
    sudahDibayar: params.sudahDibayar,
    waktuTransaksi: ambilWaktuSekarang().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  };
  modalHasilTransaksiTampil.value = true;
};

// Struk (bukti transaksi yang SUDAH lunas/berlaku) -- dicetak dari popup
// "Perubahan Jadwal Berhasil" setelah transaksi selesai. Beda dari
// unduhInvoicePerubahanJadwal() di bawah (invoice utk TAGIHAN yang belum
// dibayar, dicetak dari gerbang pembayaran), mengikuti konvensi
// invoice-vs-struk yang sudah dipakai di RiwayatPembayaran.vue.
const cetakStrukPerubahanJadwal = () => {
  if (!hasilTransaksiPopup.value) return;
  const h = hasilTransaksiPopup.value;
  unduhStrukPembayaran({
    nomorStruk: h.nomorInvoice,
    namaOrangTua: profil.value?.pengguna.nama_lengkap || 'Orang Tua',
    kontakOrangTua: profil.value?.pengguna.nomor_telepon,
    tanggalBayar: h.waktuTransaksi,
    items: [
      { label: `${h.jenisTransaksi} -- ${h.namaAnak}`, jumlah: h.total },
    ],
    total: h.total,
    metode: h.sudahDibayar ? 'Midtrans' : 'Tidak ada biaya'
  });
  picuToast('Struk berhasil dicetak!', 'sukses');
};

// Invoice (TAGIHAN yang belum dibayar) -- dicetak dari gerbang pembayaran
// SEBELUM tombol "Konfirmasi Bayar Lunas" ditekan.
const unduhInvoicePerubahanJadwal = () => {
  if (!dataMenungguBayar.value) return;
  const d = dataMenungguBayar.value;
  unduhInvoicePdf({
    nomorInvoice: d.idPesananMidtrans || d.pengajuanId.slice(0, 8).toUpperCase(),
    namaOrangTua: profil.value?.pengguna.nama_lengkap || 'Orang Tua',
    kontakOrangTua: profil.value?.pengguna.nomor_telepon,
    tanggalTerbit: ambilWaktuSekarang().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    items: [
      { label: `Perubahan Jadwal ${d.jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang'} -- ${d.namaAnak}`, jumlah: d.jumlah }
    ],
    total: d.jumlah
  });
  picuToast('Invoice berhasil diunduh!', 'sukses');
};

// Konfirmasi dampak perubahan -- HANYA tampil saat mengedit pengajuan yang
// SUDAH 'disetujui' (berlaku), karena mengubahnya berarti mengganggu jadwal
// supir/Admin yang sudah menyesuaikan diri. Pengajuan baru & edit pengajuan
// yang masih 'menunggu' pembayaran langsung tersimpan tanpa konfirmasi ini.
const modalKonfirmasiDampakTampil = ref(false);

const ajukanPerubahanJadwal = async () => {
  if (!jendelaPerubahanJadwalTerbuka.value) {
    picuToast('Fitur Ajukan Perubahan Jadwal hanya dapat digunakan pukul 00.00-15.00 WIB.', 'error');
    return;
  }
  if (!anakTerpilihId.value || !anakTerpilihObj.value) return;
  if (!teksTerisi(alamatPerubahan.value)) {
    picuToast('Alamat penjemputan/pengantaran wajib diisi.', 'error');
    return;
  }

  if (tipePerubahan.value === 'jadwal') {
    if (!perubahanTanggal.value || perubahanTanggal.value < hariIniIso.value) {
      picuToast('Tanggal perubahan jadwal tidak boleh sebelum hari ini.', 'error');
      return;
    }

    if (perubahanJadwalStatusSedangDiedit.value === 'disetujui') {
      // Sudah berlaku & disinkronkan -- minta konfirmasi dampak dulu sebelum disimpan.
      modalKonfirmasiDampakTampil.value = true;
      return;
    }
  }

  await simpanPerubahanJadwal();
};

const konfirmasiDampakLanjutkan = async () => {
  modalKonfirmasiDampakTampil.value = false;
  await simpanPerubahanJadwal();
};

const simpanPerubahanJadwal = async () => {
  if (!anakTerpilihId.value || !anakTerpilihObj.value) return;

  if (tipePerubahan.value === 'alamat') {
    sedangMenyimpanAlamat.value = true;
    try {
      await perbaruiAlamatAnak({
        anakId: anakTerpilihId.value,
        namaAnak: anakTerpilihObj.value.nama_lengkap,
        jenisPerubahan: jenisPerubahan.value,
        alamatBaru: alamatPerubahan.value,
        lintangBaru: lintangPerubahan.value,
        bujurBaru: bujurPerubahan.value
      });
      picuToast('Alamat anak berhasil diperbarui untuk perjalanan berikutnya!', 'sukses');
      tampilkanPetaPerubahan.value = false;
      await muatAnak();
      await muatDataAnakTerpilih();
    } catch (err: any) {
      picuToast(err.message || 'Gagal memperbarui alamat anak.', 'error');
    } finally {
      sedangMenyimpanAlamat.value = false;
    }
    return;
  }

  try {
    let hasil: { pengajuan: PengajuanPerubahanJadwalRow; perluBayar: boolean; pembayaranId: string | null; idPesananMidtrans: string | null };

    if (perubahanJadwalIdSedangDiedit.value && perubahanJadwalStatusSedangDiedit.value === 'disetujui') {
      const pengajuan = await editPengajuanPerubahanJadwalAktifLayanan(perubahanJadwalIdSedangDiedit.value, {
        anakId: anakTerpilihId.value,
        namaAnak: anakTerpilihObj.value.nama_lengkap,
        tanggal: perubahanTanggal.value,
        waktuBaru: perubahanWaktu.value,
        biayaTambahan: biayaTambahanHitung.value,
        jenisPerubahan: jenisPerubahan.value,
        alamatBaru: alamatPerubahan.value,
        lintangBaru: lintangPerubahan.value,
        bujurBaru: bujurPerubahan.value
      });
      hasil = { pengajuan, perluBayar: false, pembayaranId: null, idPesananMidtrans: null };
    } else if (perubahanJadwalIdSedangDiedit.value) {
      const pengajuan = await perbaruiPengajuanPerubahanJadwalLayanan(perubahanJadwalIdSedangDiedit.value, {
        anakId: anakTerpilihId.value,
        tanggal: perubahanTanggal.value,
        waktuBaru: perubahanWaktu.value,
        biayaTambahan: biayaTambahanHitung.value,
        jenisPerubahan: jenisPerubahan.value,
        alamatBaru: alamatPerubahan.value,
        lintangBaru: lintangPerubahan.value,
        bujurBaru: bujurPerubahan.value
      });
      // perbaruiPengajuanPerubahanJadwal selalu menyisakan status 'menunggu' -- selalu perlu ke gerbang pembayaran.
      hasil = { pengajuan, perluBayar: true, pembayaranId: null, idPesananMidtrans: null };
    } else {
      hasil = await ajukanPerubahanJadwalLayanan({
        anakId: anakTerpilihId.value,
        namaAnak: anakTerpilihObj.value.nama_lengkap,
        orangTuaId: anakTerpilihObj.value.orang_tua_id,
        tanggal: perubahanTanggal.value,
        waktuBaru: perubahanWaktu.value,
        biayaTambahan: biayaTambahanHitung.value,
        jenisPerubahan: jenisPerubahan.value,
        alamatBaru: alamatPerubahan.value,
        lintangBaru: lintangPerubahan.value,
        bujurBaru: bujurPerubahan.value
      });
    }

    const pembayaranId = hasil.pembayaranId ?? hasil.pengajuan.pembayaran_id;
    const modeEditAktif = perubahanJadwalIdSedangDiedit.value !== null && perubahanJadwalStatusSedangDiedit.value === 'disetujui';

    const idx = riwayatPerubahan.value.findIndex((p) => p.id === hasil.pengajuan.id);
    if (idx !== -1) riwayatPerubahan.value.splice(idx, 1, hasil.pengajuan);
    else riwayatPerubahan.value.unshift(hasil.pengajuan);
    tampilkanPetaPerubahan.value = false;
    batalEditPerubahanJadwal();

    if (hasil.perluBayar && pembayaranId) {
      // Jangan sinkronkan ke jadwal supir / beri tahu Admin dulu -- tunggu
      // sampai pengguna menyelesaikan gerbang pembayaran di bawah.
      dataMenungguBayar.value = {
        pengajuanId: hasil.pengajuan.id,
        pembayaranId,
        idPesananMidtrans: hasil.idPesananMidtrans,
        anakId: anakTerpilihId.value,
        namaAnak: anakTerpilihObj.value.nama_lengkap,
        jenisPerubahan: jenisPerubahan.value,
        tanggal: perubahanTanggal.value,
        waktuBaru: perubahanWaktu.value,
        alamatBaru: alamatPerubahan.value,
        jumlah: biayaTambahanHitung.value
      };
      modalBayarPerubahanTampil.value = true;
    } else {
      bukaPopupHasilTransaksi({
        nomorInvoice: hasil.pengajuan.id.slice(0, 8).toUpperCase(),
        namaAnak: anakTerpilihObj.value.nama_lengkap,
        jenisPerubahan: jenisPerubahan.value,
        tanggal: perubahanTanggal.value,
        waktuBaru: perubahanWaktu.value,
        alamatBaru: alamatPerubahan.value,
        total: modeEditAktif ? biayaTambahanHitung.value : 0,
        sudahDibayar: modeEditAktif
      });
      picuToast(
        modeEditAktif
          ? 'Perubahan jadwal berhasil diperbarui & tetap berlaku! Admin & supir sudah diberi tahu.'
          : 'Pengajuan perubahan jadwal berhasil disimpan & langsung berlaku! Admin & supir sudah diberi tahu.',
        'sukses'
      );
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal mengajukan perubahan jadwal.', 'error');
  }
};

const tutupModalBayarPerubahan = () => {
  modalBayarPerubahanTampil.value = false;
  dataMenungguBayar.value = null;
};

// Alur pembayaran Midtrans Snap SUNGGUHAN untuk biaya tambahan perubahan
// jadwal -- sebelumnya tombol di sini langsung menandai baris `pembayaran`
// lunas dari client (simulasi murni, popup Snap tidak pernah benar-benar
// dibuka). Sekarang memakai prosesPembayaranMidtrans() yang sama persis
// dipakai wizard berlangganan (HalamanBerlangganan.vue): buka popup Snap
// sungguhan, tunggu webhook Midtrans mengonfirmasi baris `pembayaran`
// lunas/gagal, baru berdasarkan hasil itu perubahan jadwal diterapkan atau
// TIDAK diterapkan sama sekali.
const bayarPerubahanJadwalMidtrans = async () => {
  if (!dataMenungguBayar.value) return;
  const dataBayar = dataMenungguBayar.value;
  sedangKonfirmasiBayar.value = true;
  progresBayarPerubahanTeks.value = '';
  try {
    const hasilAkhir = await prosesPembayaranMidtrans(dataBayar.pembayaranId, {
      onProgres: (teks) => { progresBayarPerubahanTeks.value = teks; }
    });

    if (hasilAkhir === 'batal') {
      picuToast('Pembayaran belum selesai. Klik "Bayar Sekarang" lagi untuk mencoba lagi.', 'info');
      return;
    }
    if (hasilAkhir === 'gagal') {
      // Pembayaran gagal/dibatalkan Midtrans -- pengajuan TETAP 'menunggu'
      // (tidak disetujui/disinkronkan), tidak ada perubahan jadwal yang
      // diterapkan. Baris ini tetap terlihat di Riwayat Perubahan Jadwal
      // dan bisa diedit/dibayar ulang oleh pengguna kapan saja.
      modalBayarPerubahanTampil.value = false;
      dataMenungguBayar.value = null;
      picuToast('Pembayaran gagal/dibatalkan oleh Midtrans. Perubahan jadwal tidak diterapkan.', 'error');
      return;
    }

    // hasilAkhir === 'lunas' -- webhook Midtrans sudah mengonfirmasi baris
    // `pembayaran` lunas, baru sekarang perubahan jadwal diterapkan.
    const pengajuanFinal = await konfirmasiPembayaranPerubahanJadwalLayanan(dataBayar);
    const idx = riwayatPerubahan.value.findIndex((p) => p.id === pengajuanFinal.id);
    if (idx !== -1) riwayatPerubahan.value.splice(idx, 1, pengajuanFinal);
    modalBayarPerubahanTampil.value = false;
    dataMenungguBayar.value = null;
    bukaPopupHasilTransaksi({
      nomorInvoice: dataBayar.idPesananMidtrans || dataBayar.pengajuanId.slice(0, 8).toUpperCase(),
      namaAnak: dataBayar.namaAnak,
      jenisPerubahan: dataBayar.jenisPerubahan,
      tanggal: dataBayar.tanggal,
      waktuBaru: dataBayar.waktuBaru,
      alamatBaru: dataBayar.alamatBaru,
      total: dataBayar.jumlah,
      sudahDibayar: true
    });
    picuToast('Pembayaran perubahan jadwal berhasil diproses via Midtrans. Invoice dapat diunduh melalui popup ini atau riwayat pengajuan.', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memproses pembayaran.', 'error');
  } finally {
    sedangKonfirmasiBayar.value = false;
    progresBayarPerubahanTeks.value = '';
  }
};

// Hapus/Batalkan pengajuan perubahan jadwal -- dua jalur beda tergantung
// status baris:
// - 'menunggu' (belum dibayar/belum berlaku): HARD DELETE lewat
//   hapusPengajuanPerubahanJadwal() (RLS DELETE hanya izinkan status ini).
// - 'disetujui' (sudah berlaku, sudah disinkronkan ke jadwal supir): TIDAK
//   dihapus -- dibatalkan lewat batalkanPengajuanPerubahanJadwalAktif()
//   (baris tetap tersimpan sbg jejak riwayat berstatus 'ditolak', jadwal
//   anak di-rollback ke kondisi semula, dana yang sudah dibayar TIDAK
//   dikembalikan). Modal konfirmasi yang sama dipakai bareng, teksnya
//   menyesuaikan lewat computed `perubahanAkanDihapusAktif` di bawah.
const modalHapusPerubahanTampil = ref(false);
const perubahanAkanDihapus = ref<PengajuanPerubahanJadwalRow | null>(null);
const sedangMenghapusPerubahan = ref(false);
const perubahanAkanDihapusAktif = computed(() => perubahanAkanDihapus.value?.status === 'disetujui');

const bukaKonfirmasiHapusPerubahanJadwal = (hist: PengajuanPerubahanJadwalRow) => {
  if (waktuPerubahanSudahLewat(hist)) return;
  perubahanAkanDihapus.value = hist;
  modalHapusPerubahanTampil.value = true;
};

const konfirmasiHapusPerubahanJadwal = async () => {
  if (!perubahanAkanDihapus.value) return;
  const target = perubahanAkanDihapus.value;
  sedangMenghapusPerubahan.value = true;
  try {
    if (target.status === 'disetujui') {
      const hasil = await batalkanPengajuanPerubahanJadwalAktifLayanan(target.id, anakTerpilihObj.value?.nama_lengkap ?? 'Anak');
      const idx = riwayatPerubahan.value.findIndex((p) => p.id === hasil.id);
      if (idx !== -1) riwayatPerubahan.value.splice(idx, 1, hasil);
      picuToast('Perubahan jadwal berhasil dibatalkan & jadwal anak dikembalikan seperti semula.', 'sukses');
    } else {
      await hapusPengajuanPerubahanJadwalLayanan(target.id);
      riwayatPerubahan.value = riwayatPerubahan.value.filter((p) => p.id !== target.id);
      picuToast('Pengajuan perubahan jadwal berhasil dihapus!', 'sukses');
    }
    if (perubahanJadwalIdSedangDiedit.value === target.id) batalEditPerubahanJadwal();
    modalHapusPerubahanTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal memproses pembatalan pengajuan.', 'error');
  } finally {
    sedangMenghapusPerubahan.value = false;
  }
};

const batalEditCuti = () => {
  cutiIdSedangDiedit.value = null;
  cutiMulai.value = '';
  cutiSelesai.value = '';
  cutiAlasan.value = 'sakit';
};

const mulaiEditCuti = (cuti: PengajuanCutiRow) => {
  cutiIdSedangDiedit.value = cuti.id;
  cutiMulai.value = cuti.tanggal_mulai;
  cutiSelesai.value = cuti.tanggal_selesai;
  cutiAlasan.value = cuti.alasan;
};

const ajukanCuti = async () => {
  if (!cutiMulai.value || !cutiSelesai.value) {
    picuToast('Tanggal mulai dan selesai wajib diisi', 'error');
    return;
  }
  if (!cutiIdSedangDiedit.value && cutiMulai.value < hariIniIso.value) {
    picuToast('Tanggal mulai cuti tidak boleh sebelum hari ini.', 'error');
    return;
  }
  if (cutiSelesai.value < cutiMulai.value) {
    picuToast('Tanggal selesai cuti tidak boleh sebelum tanggal mulai.', 'error');
    return;
  }
  if (!anakTerpilihId.value) return;
  try {
    if (cutiIdSedangDiedit.value) {
      const hasil = await perbaruiCutiLayanan(cutiIdSedangDiedit.value, {
        anakId: anakTerpilihId.value,
        tanggalMulai: cutiMulai.value,
        tanggalSelesai: cutiSelesai.value,
        alasan: cutiAlasan.value
      });
      const idx = riwayatCuti.value.findIndex((c) => c.id === hasil.id);
      if (idx >= 0) riwayatCuti.value[idx] = hasil;
      picuToast('Perubahan cuti berhasil disimpan. Kalender otomatis diperbarui.', 'sukses');
    } else {
      const hasil = await ajukanCutiLayanan({
        anakId: anakTerpilihId.value,
        namaAnak: anakTerpilihObj.value?.nama_lengkap ?? '-',
        tanggalMulai: cutiMulai.value,
        tanggalSelesai: cutiSelesai.value,
        alasan: cutiAlasan.value
      });
      riwayatCuti.value.unshift(hasil);
      picuToast('Pengajuan cuti berhasil disimpan.', 'sukses');
    }
    batalEditCuti();
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan pengajuan cuti.', 'error');
  }
};

// Hapus TIDAK langsung tereksekusi dari klik tombol -- wajib lewat modal
// konfirmasi dulu, sama seperti pola hapus data lain di sistem ini (mis.
// hapus anak/hapus supir).
const modalHapusCutiTampil = ref(false);
const cutiAkanDihapus = ref<PengajuanCutiRow | null>(null);
const sedangMenghapusCuti = ref(false);

const bukaKonfirmasiHapusCuti = (cuti: PengajuanCutiRow) => {
  cutiAkanDihapus.value = cuti;
  modalHapusCutiTampil.value = true;
};

const konfirmasiHapusCuti = async () => {
  if (!cutiAkanDihapus.value) return;
  const id = cutiAkanDihapus.value.id;
  sedangMenghapusCuti.value = true;
  try {
    await hapusCutiLayanan(id);
    riwayatCuti.value = riwayatCuti.value.filter((c) => c.id !== id);
    if (cutiIdSedangDiedit.value === id) batalEditCuti();
    picuToast('Pengajuan cuti berhasil dihapus. Penanda pada kalender ikut hilang.', 'sukses');
    modalHapusCutiTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus pengajuan cuti.', 'error');
  } finally {
    sedangMenghapusCuti.value = false;
  }
};

const namaAnakTerpilih = computed(() => anakList.value.find((a) => a.id === anakTerpilihId.value)?.nama_lengkap ?? '');

const LABEL_ALASAN_CUTI: Record<string, string> = {
  sakit: 'Sakit',
  libur_sekolah: 'Libur Sekolah',
  pulang_kampung: 'Mudik / Acara Keluarga'
};
</script>

<template>
  <div class="space-y-6 relative min-h-[240px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuatAnak || sedangMemuatJadwal" pesan="Memuat data jadwal..." />

    <!-- Toast Alert -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="toastTampil = false"
    />

    <div>
      <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Pengaturan Jadwal & Absensi</h1>
      <p class="text-xs text-on-surface-variant">Atur absen harian anak, jadwal mingguan, dan pengajuan cuti libur.</p>
    </div>

    <!-- Empty State -->
    <div
      v-if="!sedangMemuatAnak && anakList.length === 0"
      class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-10 text-center space-y-2"
    >
      <p class="text-sm font-bold text-on-surface">Belum ada anak dengan langganan bulanan</p>
      <p class="text-xs text-on-surface-variant">Pengaturan jadwal & absensi hanya berlaku untuk anak berlangganan bulanan. Anak berlangganan harian tidak memiliki pola jadwal mingguan untuk diatur.</p>
    </div>

    <template v-else>
      <!-- Pemilih Anak (bila lebih dari satu) -->
      <div v-if="anakList.length > 1" class="max-w-xs">
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Pilih Anak:</label>
        <select
          v-model="anakTerpilihId"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
        >
          <option v-for="anak in anakList" :key="anak.id" :value="anak.id">{{ anak.nama_lengkap }}</option>
        </select>
      </div>

      <!-- Main Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left Column (2 Columns Width) -->
        <div class="lg:col-span-2 space-y-6">

          <!-- 1. Absen Harian (Attendance Toggle) -->
          <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <Clock class="w-4 h-4 text-primary" />
              Laporan Absensi Tanggal {{ tanggalAktifAbsenFormat }}{{ namaAnakTerpilih ? ` — ${namaAnakTerpilih}` : '' }}
            </h3>
            <p class="text-xs text-on-surface-variant">
              Pilih status kehadiran anak untuk tanggal tersebut. Tanggal ini otomatis berpindah ke hari aktif berikutnya begitu pukul <strong>17:00 WIB</strong> pada hari <strong>{{ tanggalAktifAbsenFormatLengkap }}</strong> terlewati.
            </p>
            <p v-if="!jendelaAbsenTerbuka" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Jendela pengisian absensi sedang <strong>tutup</strong>. Absensi hanya bisa diisi/diubah mulai pukul
              <strong>17:00 WIB</strong> (sore sebelumnya) sampai <strong>06:30 WIB</strong> (pagi hari-H).
            </p>

            <div class="grid grid-cols-2 gap-4">
              <button
                type="button"
                :disabled="!jendelaAbsenTerbuka"
                @click="bukaKonfirmasiAbsen('masuk')"
                class="flex flex-col items-center justify-center p-4 border rounded-xl transition-all"
                :class="[
                  absenHariIni === 'masuk' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-surface-container border-outline-variant/30 text-on-surface-variant',
                  jendelaAbsenTerbuka ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                ]"
              >
                <Check class="w-6 h-6 mb-1" />
                <span class="text-xs font-bold uppercase">Masuk Sekolah</span>
                <span class="text-[9px] text-on-surface-variant mt-0.5">Layanan berjalan seperti biasa</span>
              </button>

              <button
                type="button"
                :disabled="!jendelaAbsenTerbuka"
                @click="bukaKonfirmasiAbsen('tidak_masuk')"
                class="flex flex-col items-center justify-center p-4 border rounded-xl transition-all"
                :class="[
                  absenHariIni === 'tidak_masuk' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-surface-container border-outline-variant/30 text-on-surface-variant',
                  jendelaAbsenTerbuka ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                ]"
              >
                <ShieldAlert class="w-6 h-6 mb-1" />
                <span class="text-xs font-bold uppercase">Absen / Libur</span>
                <span class="text-[9px] text-on-surface-variant mt-0.5">Absen menjemput siswa</span>
              </button>
            </div>
          </div>

          <!-- 2. Konfigurasi Jadwal Bulanan -->
          <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays class="w-4 h-4 text-primary" />
              Konfigurasi Jadwal Bulanan
            </h3>
            <p class="text-xs text-on-surface-variant">Centang hari aktif sekolah anak -- sistem otomatis menandai tanggal yang sesuai pada kalender bulan berjalan. Perubahan baru berlaku setelah tombol <strong>Simpan Perubahan Jadwal</strong> ditekan.</p>

            <!-- Kuota perubahan jadwal minggu ini -->
            <div
              class="flex items-center justify-between text-xs px-3 py-2 rounded-xl border"
              :class="kuotaHabis ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-surface-container border-outline-variant/20 text-on-surface-variant'"
            >
              <span>Sisa perubahan jadwal minggu ini:</span>
              <span class="font-bold">{{ kuotaPerubahanJadwal ? `${kuotaPerubahanJadwal.sisa} kali` : '-' }}</span>
            </div>
            <p v-if="!jendelaPerubahanJadwalMingguanDiizinkan" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Perubahan jadwal sedang tidak dapat disimpan (mendekati waktu absensi, 17:00-06:30 WIB) supaya tidak mengganggu absensi yang sedang berjalan. Coba lagi setelah pukul <strong>06:30 WIB</strong>.
            </p>
            <p v-else-if="kuotaHabis" class="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Batas perubahan jadwal minggu ini sudah mencapai maksimal {{ kuotaPerubahanJadwal?.batas ?? 2 }} kali. Silakan lakukan perubahan kembali pada minggu berikutnya.
            </p>

            <div class="flex flex-wrap gap-4 py-2">
              <label
                v-for="(_, hari) in jadwalMingguan"
                :key="hari"
                class="flex items-center gap-2 cursor-pointer bg-surface-container px-4 py-2 rounded-xl border border-outline-variant/20 hover:border-outline-variant/50 transition-all text-xs"
              >
                <input
                  type="checkbox"
                  v-model="jadwalMingguan[hari]"
                  class="accent-primary rounded"
                />
                <span :class="jadwalMingguan[hari] ? 'text-on-surface font-bold' : 'text-on-surface-variant'">{{ hari }}</span>
              </label>
            </div>

            <!-- Visualisasi Kalender Bulanan -->
            <div class="pt-2 border-t border-outline-variant/20 space-y-2">
              <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide text-center">{{ namaBulanTahunIni }}</h4>
              <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-on-surface-variant">
                <span v-for="h in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']" :key="h">{{ h }}</span>
              </div>
              <div class="grid grid-cols-7 gap-1">
                <div
                  v-for="(sel, idx) in kalenderBulanIni"
                  :key="idx"
                  class="aspect-square flex items-center justify-center rounded-lg text-[11px] font-semibold"
                  :class="[
                    !sel ? '' : sel.libur ? 'bg-error-container/40 text-error line-through' : sel.aktif ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant',
                    sel?.hariIni ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest' : '',
                    sel?.lewat ? 'opacity-40 grayscale cursor-not-allowed' : ''
                  ]"
                  :title="sel?.lewat ? 'Tanggal sudah lewat, tidak dapat dipilih' : undefined"
                >
                  {{ sel?.tanggal ?? '' }}
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 text-[10px] text-on-surface-variant pt-1 flex-wrap">
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span> Jadwal Aktif</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-surface-container border border-outline-variant/40 inline-block"></span> Tidak Ada Jadwal</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-error-container inline-block"></span> Hari Libur</span>
              </div>
            </div>

            <div class="pt-2 flex justify-end">
              <TombolUtama
                tema="terang"
                varian="utama"
                class="text-xs"
                :nonaktif="tombolSimpanJadwalNonaktif"
                @click="simpanJadwalMingguan"
              >
                {{ sedangMenyimpanJadwal ? 'Menyimpan...' : 'Simpan Perubahan Jadwal' }}
              </TombolUtama>
            </div>

            <!-- Riwayat Perubahan Jadwal -->
            <div v-if="riwayatPerubahanJadwalMingguan.length > 0" class="pt-3 border-t border-outline-variant/20 space-y-2">
              <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Riwayat Perubahan Jadwal</h4>
              <div
                v-for="riwayat in riwayatPerubahanJadwalMingguan"
                :key="riwayat.id"
                class="text-[11px] bg-surface-container p-2.5 rounded-lg text-on-surface-variant"
              >
                <span class="font-mono">{{ new Date(riwayat.dibuat_pada).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) }}</span>
                —
                <span
                  v-for="(hari, idx) in (['senin','selasa','rabu','kamis','jumat','sabtu','minggu'] as const).filter((h) => riwayat.jadwal_sebelum[h] !== riwayat.jadwal_sesudah[h])"
                  :key="hari"
                >
                  {{ idx > 0 ? ', ' : '' }}{{ hari.charAt(0).toUpperCase() + hari.slice(1) }} {{ riwayat.jadwal_sesudah[hari] ? 'diaktifkan' : 'dinonaktifkan' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. Ajukan Perubahan Jadwal -->
          <div ref="formPerubahanJadwalEl" class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <Clock class="w-4 h-4 text-primary" />
              Ajukan Perubahan Jadwal
            </h3>
            <p class="text-xs text-on-surface-variant">Ajukan perubahan jadwal keberangkatan atau kepulangan khusus (misal: les/kelas tambahan).</p>

            <!-- Banner jendela waktu tertutup -->
            <div
              v-if="!jendelaPerubahanJadwalTerbuka"
              class="flex gap-3 text-xs text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200"
            >
              <Lock class="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p class="leading-relaxed">
                Fitur Ajukan Perubahan Jadwal sedang <strong>tertutup</strong>. Fitur ini hanya dapat digunakan pukul
                <strong>00.00-15.00 WIB</strong>. Silakan kembali lagi besok.
              </p>
            </div>

            <fieldset :disabled="!jendelaPerubahanJadwalTerbuka" class="contents">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Pilih Anak:</label>
                <select
                  v-model="anakTerpilihId"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
                >
                  <option v-for="anak in anakList" :key="anak.id" :value="anak.id">{{ anak.nama_lengkap }}</option>
                </select>
              </div>

              <div class="md:col-span-2">
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Tipe Perubahan:</label>
                <div class="flex gap-4 text-xs mt-1">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="alamat"
                      v-model="tipePerubahan"
                      class="accent-primary"
                    />
                    <span>Ubah Alamat Saja (Gratis)</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="jadwal"
                      v-model="tipePerubahan"
                      class="accent-primary"
                    />
                    <span>Ubah Jadwal Waktu</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Jenis Perubahan:</label>
                <select
                  v-model="jenisPerubahan"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
                >
                  <option value="pergi">Jadwal Pergi</option>
                  <option value="pulang">Jadwal Pulang</option>
                </select>
              </div>

              <div v-if="tipePerubahan === 'jadwal'">
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">Pilih Tanggal Keberangkatan:</label>
                <input
                  type="date"
                  v-model="perubahanTanggal"
                  :min="hariIniIso"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs font-mono"
                />
                <p v-if="perubahanTanggal" class="mt-1 text-[10px] text-on-surface-variant">
                  {{ formatTanggalIndonesiaDenganHari(perubahanTanggal) }}
                </p>
              </div>

              <div v-if="tipePerubahan === 'jadwal'" class="md:col-span-2">
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1.5">
                  Waktu {{ jenisPerubahan === 'pergi' ? 'Berangkat' : 'Pulang' }} Baru:
                </label>
                <input
                  type="time"
                  v-model="perubahanWaktu"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs font-mono"
                />
              </div>

              <div class="md:col-span-2 space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="block text-[10px] font-bold text-on-surface-variant uppercase">
                    Alamat {{ jenisPerubahan === 'pergi' ? 'Penjemputan' : 'Pengantaran' }}:
                  </label>
                  <button
                    type="button"
                    class="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                    @click="tampilkanPetaPerubahan = !tampilkanPetaPerubahan"
                  >
                    <MapPin class="w-3 h-3" />
                    {{ tampilkanPetaPerubahan ? 'Tutup Peta' : 'Ubah Titik Peta' }}
                  </button>
                </div>
                <input
                  type="text"
                  v-model="alamatPerubahan"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
                />
                <PemilihPeta
                  v-if="tampilkanPetaPerubahan"
                  tema="terang"
                  :lintang="lintangPerubahan"
                  :bujur="bujurPerubahan"
                  :awal-terkonfirmasi="true"
                  tinggi="220px"
                  :estimasi-biaya="tipePerubahan === 'jadwal' ? biayaTambahanDraft : null"
                  @posisi-berubah="tanganiPosisiPetaBerubah"
                  @pilih-lokasi="tanganiPetaPerubahan"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 text-xs">
              <span class="text-on-surface-variant">
                <template v-if="tipePerubahan === 'alamat'">
                  Biaya Tambahan: <strong class="text-emerald-600 font-bold">Gratis (Perubahan alamat tidak dikenakan biaya tambahan)</strong>
                </template>
                <template v-else>
                  Biaya Tambahan ({{ jarakPerubahanKm.toFixed(1) }} km): <strong class="text-primary">Rp {{ biayaTambahanHitung.toLocaleString('id-ID') }}</strong>
                </template>
              </span>
              <div class="flex gap-2">
                <TombolUtama v-if="perubahanJadwalIdSedangDiedit && tipePerubahan === 'jadwal'" tema="terang" varian="garis-luar" class="text-xs" @click="batalEditPerubahanJadwal">
                  Batal
                </TombolUtama>
                <TombolUtama tema="terang" varian="utama" class="text-xs" :nonaktif="!jendelaPerubahanJadwalTerbuka || sedangMenyimpanAlamat || sedangMenyimpanJadwal" @click="ajukanPerubahanJadwal">
                  {{ sedangMenyimpanAlamat ? 'Menyimpan...' : (perubahanJadwalIdSedangDiedit && tipePerubahan === 'jadwal' ? 'Simpan Perubahan' : tipePerubahan === 'alamat' ? 'Simpan Alamat Baru' : 'Ajukan Perubahan') }}
                </TombolUtama>
              </div>
            </div>
            </fieldset>

            <!-- Perubahan History -->
            <div class="pt-4 border-t border-outline-variant/20 space-y-2">
              <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Riwayat Pengajuan Perubahan:</h4>
              <div v-if="riwayatPerubahanTampil.length === 0" class="text-[11px] text-on-surface-variant text-center py-3">
                Belum ada riwayat pengajuan.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="hist in riwayatPerubahanTampil"
                  :key="hist.id"
                  class="flex justify-between items-center gap-2 bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/20 text-[11px]"
                >
                  <span class="text-on-surface font-bold min-w-0 truncate">
                    {{ hist.jenis_perubahan === 'pergi' ? 'Pergi' : 'Pulang' }} &mdash; {{ hist.tanggal ? formatTanggalIndonesiaDenganHari(hist.tanggal) : hist.hari }}, {{ hist.waktu_baru }}
                  </span>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <span
                      class="font-bold px-1.5 py-0.5 rounded"
                      :class="hist.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700' : hist.status === 'ditolak' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'"
                    >
                      {{ hist.status === 'disetujui' ? 'Berlaku' : hist.status === 'ditolak' ? 'Dibatalkan' : 'Menunggu Pembayaran' }}
                    </span>
                    <!-- Jadwal yang tanggal+jam barunya sudah lewat murni riwayat --
                         tidak bisa lagi diedit/dihapus/dibatalkan, perjalanannya
                         bisa jadi sudah berjalan/selesai. -->
                    <span
                      v-if="(hist.status === 'menunggu' || hist.status === 'disetujui') && waktuPerubahanSudahLewat(hist)"
                      title="Waktu perubahan ini sudah lewat, tidak dapat diubah/dibatalkan lagi."
                      class="p-1.5 flex items-center text-on-surface-variant"
                    >
                      <Lock class="w-3.5 h-3.5" />
                    </span>
                    <template v-else-if="hist.status === 'menunggu' || hist.status === 'disetujui'">
                      <button
                        type="button"
                        @click="mulaiEditPerubahanJadwal(hist)"
                        class="p-1.5 hover:bg-surface-container-high rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-primary"
                        :title="hist.status === 'disetujui' ? 'Ubah perubahan jadwal yang sudah berlaku ini' : 'Ubah pengajuan ini'"
                      >
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        @click="bukaKonfirmasiHapusPerubahanJadwal(hist)"
                        class="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-rose-500"
                        :title="hist.status === 'disetujui' ? 'Batalkan perubahan jadwal ini' : 'Hapus pengajuan ini'"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column (1 Column Width) -->
        <div class="space-y-6">
          <!-- 4. Pengaturan Libur/Cuti -->
          <KartuUtama tema="terang" judul="Pengaturan Libur / Cuti" subjudul="Anak tidak dijemput/diantar selama periode ini">
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mulai Tanggal:</label>
                <input
                  type="date"
                  v-model="cutiMulai"
                  :min="hariIniIso"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs font-mono"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Selesai Tanggal:</label>
                <input
                  type="date"
                  v-model="cutiSelesai"
                  :min="cutiMulai || hariIniIso"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs font-mono"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Alasan Cuti:</label>
                <select
                  v-model="cutiAlasan"
                  class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container text-xs"
                >
                  <option value="sakit">Sakit</option>
                  <option value="libur_sekolah">Libur Sekolah</option>
                  <option value="pulang_kampung">Mudik / Acara Keluarga</option>
                </select>
              </div>

              <div class="flex gap-2">
                <TombolUtama tema="terang" varian="utama" class="flex-1 text-xs" @click="ajukanCuti">
                  {{ cutiIdSedangDiedit ? 'Simpan Perubahan Cuti' : 'Konfirmasi Pengajuan Cuti' }}
                </TombolUtama>
                <TombolUtama v-if="cutiIdSedangDiedit" tema="terang" varian="garis-luar" class="text-xs" @click="batalEditCuti">
                  Batal
                </TombolUtama>
              </div>

              <!-- Riwayat Pengajuan Cuti -->
              <div class="pt-4 border-t border-outline-variant/20 space-y-2">
                <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Riwayat Pengajuan Cuti/Libur:</h4>
                <div v-if="riwayatCuti.length === 0" class="text-[11px] text-on-surface-variant text-center py-3">
                  Belum ada pengajuan cuti/libur.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="cuti in riwayatCuti"
                    :key="cuti.id"
                    class="flex justify-between items-center gap-2 bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/20 text-[11px]"
                  >
                    <div class="min-w-0">
                      <span class="text-on-surface font-bold block truncate">
                        {{ formatTanggalIndonesia(cuti.tanggal_mulai) }}<template v-if="cuti.tanggal_selesai !== cuti.tanggal_mulai"> s/d {{ formatTanggalIndonesia(cuti.tanggal_selesai) }}</template>
                      </span>
                      <span class="text-on-surface-variant">{{ LABEL_ALASAN_CUTI[cuti.alasan] || cuti.alasan }}</span>
                    </div>
                    <div class="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        @click="mulaiEditCuti(cuti)"
                        class="p-1.5 hover:bg-surface-container-high rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-primary"
                        title="Ubah pengajuan ini"
                      >
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        @click="bukaKonfirmasiHapusCuti(cuti)"
                        class="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-rose-500"
                        title="Hapus pengajuan ini"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </KartuUtama>
        </div>

      </div>
    </template>

    <!-- Modal Konfirmasi Ubah Absen -- mencegah salah pencet/human error -->
    <ModalUtama
      tema="terang"
      :tampil="modalKonfirmasiAbsenTampil"
      judul="Konfirmasi Perubahan Absensi"
      ukuran="sedang"
      @tutup="modalKonfirmasiAbsenTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center text-primary mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Ubah status kehadiran menjadi
          "{{ statusAbsenDipilih === 'masuk' ? 'Masuk Sekolah' : 'Absen / Libur' }}"
          untuk tanggal {{ tanggalAktifAbsenFormat }}?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Pastikan pilihan ini sudah benar -- supir akan menyesuaikan rute penjemputan berdasarkan status yang Anda konfirmasi.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMengubahAbsen" @click="modalKonfirmasiAbsenTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMengubahAbsen" @click="konfirmasiUbahAbsenHarian">
          {{ sedangMengubahAbsen ? 'Menyimpan...' : 'Ya, Ubah Status' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Gerbang Pembayaran Midtrans Snap SUNGGUHAN -- Perubahan Jadwal.
    Tampilan mengikuti pola yang SAMA persis dgn gerbang Snap di wizard
    berlangganan (HalamanBerlangganan.vue) supaya konsisten di seluruh
    fitur yang melibatkan pembayaran. Jadwal baru BARU disinkronkan ke
    supir & Admin diberi tahu setelah pembayaran di sini benar-benar
    dikonfirmasi lunas oleh webhook Midtrans (lihat
    bayarPerubahanJadwalMidtrans). -->
    <ModalUtama
      tema="terang"
      :tampil="modalBayarPerubahanTampil"
      judul="Gerbang Pembayaran Midtrans Snap"
      @tutup="tutupModalBayarPerubahan"
    >
      <div class="space-y-5 text-sm text-on-surface-variant p-2 text-left">
        <div class="flex items-center gap-3 border-b border-outline-variant/20 pb-3">
          <div class="w-9 h-9 rounded bg-primary flex items-center justify-center font-black text-white text-base">
            M
          </div>
          <div>
            <h4 class="text-base font-extrabold text-on-surface">Midtrans Snap</h4>
            <p class="text-[10px] text-on-surface-variant mt-0.5">Pembayaran Aman via Midtrans</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex justify-between text-xs">
            <span class="text-on-surface-variant">Nomor Pesanan:</span>
            <span class="font-mono text-on-surface font-bold">{{ dataMenungguBayar?.idPesananMidtrans || '-' }}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-on-surface-variant">Jumlah Pembayaran:</span>
            <span class="font-bold text-primary text-sm">{{ dataMenungguBayar ? formatMataUang(dataMenungguBayar.jumlah) : '-' }}</span>
          </div>

          <div class="bg-primary/5 border border-primary/10 p-5 rounded-xl flex flex-col items-center text-center gap-3">
            <CreditCard class="w-9 h-9 text-primary animate-bounce" />
            <p class="text-xs text-on-surface-variant max-w-xs leading-relaxed">
              Klik "Bayar Sekarang" untuk membuka jendela pembayaran aman Midtrans Snap. Anda bisa membayar dengan QRIS, E-Wallet, atau Virtual Account Bank.
            </p>
            <div v-if="sedangKonfirmasiBayar" class="flex items-center gap-2 text-xs text-primary font-semibold">
              <Loader2 class="w-4 h-4 animate-spin" />
              <span>{{ progresBayarPerubahanTeks || 'Memproses pembayaran...' }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangKonfirmasiBayar" @click="unduhInvoicePerubahanJadwal">Unduh Invoice</TombolUtama>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangKonfirmasiBayar" @click="tutupModalBayarPerubahan">Batal Bayar</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangKonfirmasiBayar" @click="bayarPerubahanJadwalMidtrans">
          {{ sedangKonfirmasiBayar ? 'Memproses...' : 'Bayar Sekarang' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Popup "Perubahan Jadwal Berhasil" -- tampil setelah pengajuan
    BENAR-BENAR berlaku (baik langsung tanpa biaya, maupun setelah gerbang
    pembayaran di atas dikonfirmasi). Bukan pengganti toast notifikasi,
    melainkan tambahan -- lihat bukaPopupHasilTransaksi(). -->
    <ModalUtama
      tema="terang"
      :tampil="modalHasilTransaksiTampil"
      judul="Perubahan Jadwal Berhasil"
      ukuran="sedang"
      @tutup="modalHasilTransaksiTampil = false"
    >
      <div v-if="hasilTransaksiPopup" class="space-y-4 text-left py-1">
        <div class="flex flex-col items-center text-center gap-2 pb-3 border-b border-outline-variant/20">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
            <Check class="w-7 h-7" />
          </div>
          <h3 class="text-base font-bold text-on-surface">
            {{ hasilTransaksiPopup.sudahDibayar ? 'Pembayaran Berhasil' : 'Perubahan Jadwal Tersimpan' }}
          </h3>
          <p class="text-xs text-on-surface-variant leading-relaxed">
            {{ hasilTransaksiPopup.sudahDibayar
              ? 'Pembayaran Anda telah berhasil diproses & jadwal baru langsung berlaku.'
              : 'Tidak ada biaya tambahan -- perubahan jadwal langsung berlaku.' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <p class="text-on-surface-variant">Nomor Invoice:</p>
            <p class="font-mono font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.nomorInvoice }}</p>
          </div>
          <div>
            <p class="text-on-surface-variant">Jenis Transaksi:</p>
            <p class="font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.jenisTransaksi }}</p>
          </div>
          <div>
            <p class="text-on-surface-variant">Nama Anak:</p>
            <p class="font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.namaAnak }}</p>
          </div>
          <div>
            <p class="text-on-surface-variant">Tanggal Transaksi:</p>
            <p class="font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.waktuTransaksi }}</p>
          </div>
          <div class="col-span-2">
            <p class="text-on-surface-variant">Jadwal Baru:</p>
            <p class="font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.tanggalBaru }}, pukul {{ hasilTransaksiPopup.waktuBaru }}</p>
          </div>
          <div class="col-span-2">
            <p class="text-on-surface-variant">Alamat Baru:</p>
            <p class="font-bold text-on-surface mt-0.5">{{ hasilTransaksiPopup.alamatBaru }}</p>
          </div>
        </div>

        <div class="bg-surface-container rounded-xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Total Pembayaran</p>
            <p class="text-xl font-bold text-primary">{{ hasilTransaksiPopup.total > 0 ? formatMataUang(hasilTransaksiPopup.total) : 'Rp 0 (Gratis)' }}</p>
          </div>
          <span class="font-bold px-2.5 py-1 rounded-full text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            {{ hasilTransaksiPopup.sudahDibayar ? 'Lunas' : 'Berlaku' }}
          </span>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalHasilTransaksiTampil = false">Tutup</TombolUtama>
        <TombolUtama tema="terang" varian="utama" @click="cetakStrukPerubahanJadwal">Cetak Struk</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Konfirmasi dampak perubahan -- HANYA saat mengedit pengajuan yang
    SUDAH 'disetujui' (berlaku). Lihat catatan di modalKonfirmasiDampakTampil. -->
    <ModalUtama
      tema="terang"
      :tampil="modalKonfirmasiDampakTampil"
      judul="Konfirmasi Perubahan"
      ukuran="sedang"
      @tutup="modalKonfirmasiDampakTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">Perubahan ini akan memengaruhi jadwal yang sedang berjalan</h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Perubahan jadwal ini sudah berlaku & sudah disinkronkan ke jadwal penjemputan/pengantaran supir. Menyimpan perubahan akan memperbarui jadwal supir dan mengirim informasi terbaru ke Admin. Apakah Anda yakin ingin melanjutkan?
        </p>
      </div>
      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalKonfirmasiDampakTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" @click="konfirmasiDampakLanjutkan">Ya, Lanjutkan</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus/Batalkan Pengajuan Perubahan Jadwal -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusPerubahanTampil"
      :judul="perubahanAkanDihapusAktif ? 'Konfirmasi Pembatalan Perubahan Jadwal' : 'Konfirmasi Hapus Pengajuan Perubahan Jadwal'"
      ukuran="sedang"
      @tutup="modalHapusPerubahanTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          {{ perubahanAkanDihapusAktif ? 'Yakin ingin membatalkan perubahan jadwal' : 'Hapus pengajuan perubahan jadwal' }}
          {{ perubahanAkanDihapus ? (perubahanAkanDihapus.jenis_perubahan === 'pergi' ? 'Pergi' : 'Pulang') : '' }}
          {{ perubahanAkanDihapus?.tanggal ? formatTanggalIndonesiaDenganHari(perubahanAkanDihapus.tanggal) : '' }}?
        </h3>
        <p v-if="perubahanAkanDihapusAktif" class="text-xs text-on-surface-variant leading-relaxed">
          Perubahan jadwal ini <strong>sudah berlaku</strong> & sudah disinkronkan ke jadwal supir. Kalau dibatalkan, jadwal anak akan dikembalikan ke jadwal sebelumnya, dan Admin/supir akan diberi tahu. <strong>Dana yang sudah dibayarkan untuk perubahan ini tidak dapat dikembalikan.</strong>
        </p>
        <p v-else class="text-xs text-on-surface-variant leading-relaxed">
          Pengajuan ini masih menunggu pembayaran & belum berlaku, sehingga aman dihapus. Kalau ada tagihan biaya tambahan yang belum dibayar, tagihan itu juga otomatis dibatalkan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapusPerubahan" @click="modalHapusPerubahanTampil = false">Batalkan</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapusPerubahan" @click="konfirmasiHapusPerubahanJadwal">
          {{ sedangMenghapusPerubahan ? 'Memproses...' : (perubahanAkanDihapusAktif ? 'Ya, Hapus Perubahan' : 'Ya, Hapus') }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Cuti -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusCutiTampil"
      judul="Konfirmasi Hapus Pengajuan Cuti"
      ukuran="sedang"
      @tutup="modalHapusCutiTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Hapus pengajuan cuti
          {{ cutiAkanDihapus ? formatTanggalIndonesia(cutiAkanDihapus.tanggal_mulai) : '' }}
          <template v-if="cutiAkanDihapus && cutiAkanDihapus.tanggal_selesai !== cutiAkanDihapus.tanggal_mulai">
            s/d {{ formatTanggalIndonesia(cutiAkanDihapus.tanggal_selesai) }}
          </template>?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Penanda cuti/libur pada kalender akan hilang, dan anak kembali masuk daftar penjemputan sesuai jadwal normal.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapusCuti" @click="modalHapusCutiTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapusCuti" @click="konfirmasiHapusCuti">
          {{ sedangMenghapusCuti ? 'Menghapus...' : 'Ya, Hapus' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
