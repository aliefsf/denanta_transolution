<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../penyimpanan/authStore';
import ModalUtama from '../komponen/umum/ModalUtama.vue';
import PemilihPeta from '../komponen/umum/PemilihPeta.vue';
import NotifikasiUtama from '../komponen/umum/NotifikasiUtama.vue';
import MemuatUtama from '../komponen/umum/MemuatUtama.vue';
import { formatMataUang } from '../bantuan/formatMataUang';
import { unduhStrukPembayaran } from '../bantuan/strukPdf';
import { unduhInvoice as unduhInvoicePdf } from '../bantuan/invoicePdf';
import { denganBatasWaktu } from '../bantuan/batasWaktu';
import { ambilProfilOrangTua, perbaruiProfilOrangTua } from '../layanan/orangTuaLayanan';
import {
  ambilAnakMenungguPembayaran,
  ambilDaftarSekolah,
  ambilStatusLanggananWizard,
  buatAnakBaru,
  buatAtauPerbaruiLanggananDanPembayaran,
  hapusAnak as hapusAnakLayanan,
  konfirmasiPembayaranLunas,
  perbaruiAnak,
  unggahFotoAnak
} from '../layanan/berlangganganLayanan';
import { ambilJadwalMingguan, simpanJadwalMingguan } from '../layanan/orangTuaLayanan';
import { resetDataOrangTua } from '../komposabel/useDataOrangTua';
import { supabase } from '../layanan/supabase';
import { prosesPembayaranMidtrans, cekStatusPembayaran } from '../layanan/midtransLayanan';
import { ambilPengaturanTarif, hitungBiayaBulanan, hitungBiayaHarian, type PengaturanTarifRow } from '../layanan/tarifLayanan';
import { ambilHariLiburRentang } from '../layanan/kalenderLayanan';
import { buatKalenderBulanIni, hitungHariEfektifSekolahBulanIni, tanggalLiburKeSet, type NamaHari } from '../bantuan/kalenderJadwal';
import { hitungJarakKm } from '../bantuan/jarak';
import { ambilWaktuSekarang } from '../bantuan/waktuSimulasi';
import { teksTerisi, apakahNomorTeleponValid } from '../bantuan/validasiForm';
import type { SekolahRow, HariLiburRow } from '../tipe';
import {
  CheckCircle, ArrowRight, ArrowLeft,
  MapPin, CreditCard, Mail, KeyRound, Lock,
  ChevronDown, User, Edit, Trash2, Plus, Info, Check, HelpCircle, AlertTriangle, Download, Loader2, Upload, RefreshCw
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Mode "Tambah Anak" -- dipicu lewat query `tambah=1` dari tombol "Tambah
// Anak" di halaman Pantau Anak (akun yang sudah aktif berlangganan). Wizard
// yang sama dipakai ulang, tapi: langkah 1 (Data Pengguna) dilewati karena
// profil sudah ada, status "sudah aktif" tidak memicu redirect ke
// dashboard (lihat guard router), dan progress bar ditampilkan sebagai 2
// tahap ("Data Anak Tambahan" / "Pembayaran") sesuai permintaan.
const modeTambahAnak = computed(() => route.query.tambah === '1');

// Wizard Step Tracker (0 to 4)
const langkahAktif = ref<number>(modeTambahAnak.value ? 2 : authStore.sudahLogin ? 1 : 0);
const sedangMemuat = ref(true);
const sedangMemproses = ref(false);

// Hitung persentase garis progress bar (0%, 33.3%, 66.6%, 100%)
const progressLineWidth = computed(() => {
  if (langkahAktif.value <= 1) return '0%';
  if (langkahAktif.value === 2) return '33.3%';
  if (langkahAktif.value === 3) return '66.6%';
  return '100%';
});

// Progress bar 2-tahap khusus mode Tambah Anak
const progressLineWidthTambah = computed(() => (langkahAktif.value >= 4 ? '100%' : '0%'));

// "Kembali" pada mode Tambah Anak SENGAJA memakai riwayat browser (bukan
// router.push('/orangtua') yang selalu mendarat di tab Dashboard) supaya
// benar-benar kembali ke halaman/tab sebelumnya (mis. tab Pantau Anak tempat
// tombol "Tambah Anak" diklik), bukan tab tetap yang belum tentu sama.
const kembaliKeDashboard = () => router.back();

// Notifikasi Toast
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

// ==========================================
// DATA STATE FORMULIR WIZARD
// ==========================================

// Langkah 0: Otentikasi & OTP (rute /berlangganan sudah dilindungi guard router
// yang mengarahkan pengguna belum login ke /daftar, jadi langkah ini praktiknya
// hanya jaring pengaman bila komponen ini pernah dirender tanpa sesi aktif)
const modeLogin = ref(false);
const authEmail = ref('');
const authSandi = ref('');
const otpSandi = ref('');
const otpTerkirim = ref(false);
const otpTerverifikasi = ref(false);

// Langkah 1: Profil Orang Tua (di-prefill dari akun yang login)
const namaOrangTua = ref(authStore.pengguna?.user_metadata?.nama_lengkap || '');
const emailOrangTua = ref(authStore.pengguna?.email || '');
const waOrangTua = ref(authStore.pengguna?.user_metadata?.nomor_telepon || '');
// Field "Alamat Domisili" sudah dihapus dari form, tapi ref ini tetap
// dipertahankan (selalu kosong) supaya payload ke perbaruiProfilOrangTua
// tetap mengirim `alamat` -- kolom orang_tua.alamat NOT NULL di database,
// string kosong tetap valid utk constraint itu (bukan NULL).
const alamatDomisili = ref('');

// Error inline per-field Langkah 1 (Data Pengguna) -- diisi hanya saat
// validasi ditolak (lihat simpanProfilOrangTua), dikosongkan lagi begitu
// pengguna mengetik ulang di field terkait (lihat watch di bawah).
const errorNamaOrangTua = ref('');
const errorWaOrangTua = ref('');
watch(namaOrangTua, () => { errorNamaOrangTua.value = ''; });
watch(waOrangTua, () => { errorWaOrangTua.value = ''; });

// Pola hari aktif per minggu -- dipakai di Tahap 3 ("Tentukan jadwal pilihan
// anda!") untuk memetakan hari terpilih ke tanggal kalender bulan berjalan,
// dan disimpan ke tabel jadwal_mingguan yang sama dipakai menu Jadwal di
// dashboard supaya orang tua tidak perlu mengulang konfigurasi.
type PolaHariAktif = Record<NamaHari, boolean>;

function buatDefaultHariAktif(): PolaHariAktif {
  return { Senin: true, Selasa: true, Rabu: true, Kamis: true, Jumat: true, Sabtu: false, Minggu: false };
}

// Langkah 2: Profil Anak (Bisa multiple) — id merujuk baris nyata tabel `anak`
interface DataAnak {
  id: string;
  nama: string;
  sekolahId: string;
  sekolah: string;
  kelas: string;
  hariAktif: PolaHariAktif;
  layanan: 'antar_jemput' | 'antar_saja' | 'jemput_saja';
  jenisLangganan: 'bulanan' | 'harian';
  alamatJemput: string;
  lintangJemput: number;
  bujurJemput: number;
  golonganDarah?: string;
  alergi?: string;
  urlFoto?: string;
  langgananId?: string;
  pembayaranId?: string;
  idPesananMidtrans?: string;
}

const listAnak = ref<DataAnak[]>([]);

// Form anak yang sedang diedit
const formNamaAnak = ref('');
const formSekolahId = ref('');
const formKelas = ref('');
const formHariAktif = ref<PolaHariAktif>(buatDefaultHariAktif());
const formLayanan = ref<'antar_jemput' | 'antar_saja' | 'jemput_saja'>('antar_jemput');
// Jenis langganan (bulanan/harian) WAJIB dipilih dulu di Langkah 2 sebelum
// pin point lokasi jemput bisa diisi -- menentukan rumus estimasi biaya mana
// yang berlaku (flat bulanan vs per-jarak harian), lihat estimasiBiayaAnakBaru
// & prop :nonaktif pada PemilihPeta di bawah.
const formJenisLangganan = ref<'bulanan' | 'harian' | ''>('');
const formAlamatJemput = ref('');
const formLintang = ref(-0.9471);
const formBujur = ref(100.4172);
const formDarah = ref('O');

// Foto anak (WAJIB) -- diunggah setelah anak-nya benar-benar tersimpan
// (butuh anakId untuk path storage, lihat unggahFotoAnak). formFotoAnakUrlLama
// dipakai saat editAnak() memuat ulang anak yang sudah punya foto ke form
// ini (anak lama DIHAPUS lalu dibuat ulang saat disimpan, lihat editAnak
// di bawah) -- kalau anak itu sudah punya foto sebelumnya, pengguna TIDAK
// wajib memilih file baru lagi (foto lama tetap dipakai), tapi anak yang
// BELUM PERNAH punya foto sama sekali wajib mengunggah sebelum bisa
// disimpan (lihat validasi errorFotoAnak di tambahAnakKeList).
const formFotoAnakBaru = ref<File | null>(null);
const formFotoAnakPreviewBaru = ref('');
const formFotoAnakUrlLama = ref('');
const fileInputFotoAnak = ref<HTMLInputElement | null>(null);

const triggerPilihFotoAnak = () => {
  fileInputFotoAnak.value?.click();
};

const tanganiPilihFotoAnak = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formatDiperbolehkan = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!formatDiperbolehkan.includes(file.type)) {
    picuToast('Format foto tidak sesuai. Silakan unggah file gambar dengan format JPG, PNG, atau WEBP.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    picuToast('Ukuran file maksimal adalah 2MB!', 'error');
    return;
  }

  formFotoAnakBaru.value = file;
  formFotoAnakPreviewBaru.value = URL.createObjectURL(file);
  errorFotoAnak.value = '';
};

// Error inline per-field Langkah 2 (Data Anak) -- lihat catatan yang sama
// di errorNamaOrangTua dkk (Langkah 1).
const errorNamaAnak = ref('');
const errorSekolahAnak = ref('');
const errorKelasAnak = ref('');
const errorJenisLanggananAnak = ref('');
const errorAlamatAnak = ref('');
const errorFotoAnak = ref('');
watch(formNamaAnak, () => { errorNamaAnak.value = ''; });
watch(formSekolahId, () => { errorSekolahAnak.value = ''; });
watch(formKelas, () => { errorKelasAnak.value = ''; });
watch(formJenisLangganan, () => { errorJenisLanggananAnak.value = ''; });
watch(formAlamatJemput, () => { errorAlamatAnak.value = ''; });
const formAlergi = ref('');
const lokasiValid = ref(true);

const modalRingkasanTampil = ref(false);

const daftarSekolah = ref<SekolahRow[]>([]);

// Daftar kelas mengikuti sekolah yang dipilih (dikelola Admin di menu Data
// Sekolah, lihat kelasTersedia di tipe SekolahRow) -- bukan lagi daftar
// statis generik "Kelas 1".."Kelas 12" yang tidak terhubung ke sekolah.
const daftarKelas = computed(() => daftarSekolah.value.find((s) => s.id === formSekolahId.value)?.kelasTersedia ?? []);

// Kelas yang sudah dipilih jadi tidak valid lagi kalau sekolah diganti --
// dikosongkan supaya orang tua tidak salah submit kelas milik sekolah lain.
watch(formSekolahId, () => {
  if (!daftarKelas.value.includes(formKelas.value)) {
    formKelas.value = '';
  }
});

// Hari libur bulan berjalan (nasional/cuti bersama/libur sekolah dari menu
// "Kelola Jadwal" Admin) -- mengecualikan tanggal libur dari hari efektif
// sekolah saat menghitung estimasi biaya & pratinjau kalender (lihat
// hitungBiayaPerAnak/kalenderUntukAnak di bawah).
const daftarHariLibur = ref<HariLiburRow[]>([]);

const tarif = ref<PengaturanTarifRow | null>(null);
const sedangMemuatTarif = ref(false);

// SEBELUMNYA fetch sekali saja di onMounted, tanpa retry -- kalau request
// ini gagal/timeout (mis. hiccup jaringan sesaat), tarif.value tetap null
// SELAMANYA untuk sisa sesi wizard. hitungBiayaPerAnak() diam-diam
// mengembalikan 0 kalau tarif.value null (lihat definisinya di bawah),
// jadi bug-nya baru kelihatan di Langkah 4 (Pembayaran) sebagai "Rp 0" di
// semua tagihan -- tanpa peringatan apa pun selain toast yang sudah keburu
// hilang. Sekarang di-retry beberapa kali dulu (pola sama seperti
// muatProfilPengguna() di useAuth.ts), DAN bisa dipanggil ulang manual lewat
// tombol "Coba Lagi" yang muncul di Langkah 4 kalau ternyata masih gagal.
async function muatTarif(percobaan = 3) {
  sedangMemuatTarif.value = true;
  try {
    for (let i = 1; i <= percobaan; i++) {
      try {
        tarif.value = await denganBatasWaktu(
          ambilPengaturanTarif(),
          10000,
          'Gagal memuat pengaturan tarif: waktu permintaan habis.'
        );
        return;
      } catch (err: any) {
        if (i === percobaan) {
          picuToast(err.message || 'Gagal memuat pengaturan tarif.', 'error');
        } else {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    }
  } finally {
    sedangMemuatTarif.value = false;
  }
}

// Sekolah yang sedang dipilih di form anak (Langkah 2) -- dipakai sebagai
// titik referensi jarak untuk tarif Harian (per-km), sama seperti sekolah
// jadi acuan jarak di fitur Ajukan Perubahan Jadwal (JadwalOrangTua.vue).
const sekolahTerpilihAnakBaru = computed(() => daftarSekolah.value.find((s) => s.id === formSekolahId.value) ?? null);

// Posisi pin yang sedang disesuaikan di halaman penuh PemilihPeta (belum
// dikonfirmasi) -- diisi lewat event `posisi-berubah` supaya jarak & estimasi
// biaya Harian ikut ter-update REALTIME saat pin digeser/diklik, bukan
// memakai angka jarak yang tetap/hardcode.
const posisiDraftAnakBaru = ref<{ lintang: number; bujur: number } | null>(null);
const tanganiPosisiAnakBaruBerubah = (data: { lintang: number; bujur: number }) => {
  posisiDraftAnakBaru.value = data;
};

const jarakDraftAnakBaru = computed(() => {
  if (!posisiDraftAnakBaru.value || !sekolahTerpilihAnakBaru.value) return null;
  return hitungJarakKm(
    posisiDraftAnakBaru.value.lintang,
    posisiDraftAnakBaru.value.bujur,
    sekolahTerpilihAnakBaru.value.lintang,
    sekolahTerpilihAnakBaru.value.bujur
  );
});

// Estimasi biaya yang ditampilkan saat menentukan pin point lokasi jemput di
// Langkah 2 (Data Anak / Data Anak Tambahan) -- mengikuti jenis langganan
// yang dipilih orang tua (formJenisLangganan, WAJIB diisi dulu sebelum peta
// bisa dibuka): 'bulanan' pakai tarif flat (hitungBiayaBulanan, jenis layanan
// masih asumsi default antar_jemput -- baru bisa diubah di Langkah 3), 'harian'
// pakai tarif per-jarak (hitungBiayaHarian) dengan JARAK NYATA dari pin ke
// sekolah (jarakDraftAnakBaru) -- SEBELUMNYA memakai konstanta jarakEstimasiKm
// (selalu 5 km) sehingga semua lokasi menghasilkan angka yang sama persis
// berapa pun jaraknya ke sekolah; sekarang ikut berubah begitu pin digeser.
const estimasiBiayaAnakBaru = computed(() => {
  if (!tarif.value || !formJenisLangganan.value) return null;
  if (formJenisLangganan.value === 'harian') {
    return hitungBiayaHarian(tarif.value, jarakDraftAnakBaru.value ?? jarakEstimasiKm);
  }
  return hitungBiayaBulanan(tarif.value, formLayanan.value);
});

// Syarat sebelum pin point lokasi boleh diisi: Nama Anak, Sekolah, Kelas, dan
// Jenis Layanan wajib terisi lebih dulu -- bukan cuma Jenis Layanan seperti
// sebelumnya, supaya data anak yang dibuat (buatAnakBaru) selalu lengkap dan
// estimasi biaya (baik bulanan maupun harian, yang butuh anak.sekolahId
// untuk jarak ke sekolah) selalu punya konteks yang benar sejak awal.
const formAnakBelumLengkap = computed(() =>
  !formNamaAnak.value.trim() || !formSekolahId.value || !formKelas.value || !formJenisLangganan.value
);

// Langkah 3: Midtrans & Checkout
const pembayaranLunas = ref(false);
const progresBayarTeks = ref('');
// Diisi begitu prosesPembayaranMidtrans() mengembalikan 'timeout_setelah_sukses'
// (Midtrans sendiri sudah bilang sukses, cuma webhook kita yang belum sempat
// mengonfirmasi) -- dipakai tombol "Cek Status Sekarang" di bawah, lihat
// cekUlangStatusPembayaran().
const pembayaranIdsMenunggu = ref<string[]>([]);
const sedangMengecekStatus = ref(false);

// ==========================================
// LOGIC HANDLERS
// ==========================================

// Batas wilayah operasional Kota Padang — cermin dari PemilihPeta.vue
const apakahDalamKotaPadang = (lat: number, lng: number) => {
  return lat <= -0.75 && lat >= -1.15 && lng >= 100.25 && lng <= 100.55;
};

// Peta handler
const tanganiLokasiPeta = (data: { lintang: number; bujur: number; alamat: string }) => {
  formLintang.value = data.lintang;
  formBujur.value = data.bujur;
  formAlamatJemput.value = data.alamat;
  lokasiValid.value = apakahDalamKotaPadang(data.lintang, data.bujur);
};

// Langkah 0: Registrasi / Login & OTP Mockup (lihat catatan di atas — jalur ini
// praktiknya tidak tercapai karena guard router sudah mewajibkan login lebih dulu)
const tanganiDaftarLoginMock = () => {
  if (!authEmail.value || !authSandi.value) {
    picuToast('Silakan lengkapi email dan kata sandi', 'error');
    return;
  }
  if (modeLogin.value) {
    otpTerkirim.value = false;
    router.push('/login');
  } else {
    otpTerkirim.value = true;
    picuToast('Silakan selesaikan pendaftaran melalui halaman Daftar Akun.', 'info');
  }
};

const verifikasiOtpMock = () => {
  otpTerverifikasi.value = true;
  router.push({ path: '/daftar', query: { lanjut: 'berlangganan' } });
};

// Muat data awal: profil, daftar sekolah, dan status wizard untuk resume
onMounted(async () => {
  try {
    // Dibatasi waktu: token sesi yang kedaluwarsa/rusak di localStorage bisa
    // membuat permintaan Supabase menggantung tanpa pernah resolve/reject,
    // sehingga layar "Memuat status langganan..." tertahan selamanya.
    daftarSekolah.value = await denganBatasWaktu(
      ambilDaftarSekolah(),
      10000,
      'Gagal memuat daftar sekolah: waktu permintaan habis.'
    );
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar sekolah.', 'error');
  }

  await muatTarif();

  try {
    const acuan = new Date();
    const awalBulan = `${acuan.getFullYear()}-${String(acuan.getMonth() + 1).padStart(2, '0')}-01`;
    const akhirTanggal = new Date(acuan.getFullYear(), acuan.getMonth() + 1, 0).getDate();
    const akhirBulan = `${acuan.getFullYear()}-${String(acuan.getMonth() + 1).padStart(2, '0')}-${String(akhirTanggal).padStart(2, '0')}`;
    daftarHariLibur.value = await denganBatasWaktu(
      ambilHariLiburRentang(awalBulan, akhirBulan),
      10000,
      'Gagal memuat kalender hari libur: waktu permintaan habis.'
    );
  } catch (err: any) {
    // Biarkan estimasi biaya tetap dihitung tanpa pengurangan hari libur bila gagal dimuat
    picuToast(err.message || 'Gagal memuat kalender hari libur.', 'error');
  }

  if (!authStore.sudahLogin || !authStore.pengguna?.id) {
    sedangMemuat.value = false;
    return;
  }

  try {
    const { pengguna, orangTua } = await denganBatasWaktu(
      ambilProfilOrangTua(authStore.pengguna.id),
      10000,
      'Waktu permintaan memuat profil habis.'
    );
    namaOrangTua.value = pengguna.nama_lengkap;
    emailOrangTua.value = pengguna.email;
    waOrangTua.value = orangTua?.nomor_whatsapp || pengguna.nomor_telepon || '';
    alamatDomisili.value = orangTua?.alamat || '';
  } catch {
    // Biarkan nilai default/kosong bila gagal memuat profil
  }

  try {
    // Mode Tambah Anak memakai query khusus (ambilAnakMenungguPembayaran)
    // yang TIDAK short-circuit ke status 'aktif' -- akun ini memang sudah
    // aktif berlangganan untuk anak lain, kita hanya perlu tahu anak mana
    // yang belum lunas (baru ditambahkan/wizard sempat ditinggal).
    const status = modeTambahAnak.value
      ? await denganBatasWaktu(
          ambilAnakMenungguPembayaran(authStore.pengguna.id),
          10000,
          'Waktu permintaan memuat status langganan habis. Silakan muat ulang halaman.'
        )
      : await denganBatasWaktu(
          ambilStatusLanggananWizard(authStore.pengguna.id),
          10000,
          'Waktu permintaan memuat status langganan habis. Silakan muat ulang halaman.'
        );

    if (status.status === 'aktif' && !modeTambahAnak.value) {
      // replace -- akun ini sudah aktif, wizard ini bukan tujuan yang valid
      // untuk di-back ke sini lagi.
      router.replace('/orangtua');
      return;
    }

    if (status.status === 'belum_bayar') {
      listAnak.value = status.anakList.map((a) => {
        const langganan = status.langgananByAnakId[a.id];
        const pembayaran = langganan ? status.pembayaranByLanggananId[langganan.id] : undefined;
        return {
          id: a.id,
          nama: a.nama_lengkap,
          sekolahId: a.sekolah_id,
          sekolah: a.sekolah?.nama || '-',
          kelas: a.kelas,
          hariAktif: buatDefaultHariAktif(),
          layanan: a.jenis_layanan,
          jenisLangganan: a.jenis_langganan,
          alamatJemput: a.alamat_jemput,
          lintangJemput: a.lintang_jemput,
          bujurJemput: a.bujur_jemput,
          golonganDarah: a.golongan_darah || undefined,
          alergi: a.alergi || undefined,
          urlFoto: a.url_foto || undefined,
          langgananId: langganan?.id,
          pembayaranId: pembayaran?.id,
          idPesananMidtrans: pembayaran?.id_pesanan_midtrans
        };
      });

      // Muat ulang pola hari aktif yang mungkin sudah tersimpan sebelumnya
      // (mis. wizard sempat ditinggal di tengah jalan) -- best-effort, biarkan
      // default kalau gagal/belum ada baris jadwal_mingguan untuk anak ini.
      await Promise.all(
        listAnak.value.map(async (anak) => {
          try {
            const jadwal = await ambilJadwalMingguan(anak.id);
            if (jadwal) {
              anak.hariAktif = {
                Senin: jadwal.senin, Selasa: jadwal.selasa, Rabu: jadwal.rabu, Kamis: jadwal.kamis,
                Jumat: jadwal.jumat, Sabtu: jadwal.sabtu, Minggu: jadwal.minggu
              };
            }
          } catch {
            // Biarkan default bila gagal memuat
          }
        })
      );

      const semuaPunyaTagihan = listAnak.value.every((a) => a.langgananId && a.pembayaranId);
      langkahAktif.value = semuaPunyaTagihan ? 4 : 3;
    } else {
      listAnak.value = [];
      langkahAktif.value = modeTambahAnak.value ? 2 : 1;
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat status langganan Anda.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
});

// Langkah 1: Simpan Profil Orang Tua
const simpanProfilOrangTua = async () => {
  errorNamaOrangTua.value = teksTerisi(namaOrangTua.value) ? '' : 'Nama lengkap wajib diisi.';
  errorWaOrangTua.value = apakahNomorTeleponValid(waOrangTua.value)
    ? ''
    : teksTerisi(waOrangTua.value)
      ? 'Format nomor WhatsApp tidak valid (contoh: 08xxxxxxxxxx).'
      : 'Nomor WhatsApp wajib diisi.';
  if (errorNamaOrangTua.value || errorWaOrangTua.value) {
    picuToast('Mohon lengkapi seluruh data yang wajib diisi sebelum melanjutkan.', 'error');
    return;
  }
  if (!authStore.pengguna?.id) return;

  sedangMemproses.value = true;
  try {
    await perbaruiProfilOrangTua({
      userId: authStore.pengguna.id,
      namaLengkap: namaOrangTua.value,
      nomorTelepon: waOrangTua.value,
      alamat: alamatDomisili.value,
      nomorWhatsapp: waOrangTua.value
    });
    picuToast('Data profil orang tua berhasil disimpan!', 'sukses');
    langkahAktif.value = 2;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan profil.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

// Konfirmasi hapus anak dari list -- aksi destruktif ke database, jadi tidak
// boleh langsung tereksekusi dari klik tombol Trash2 (dipakai di dua tempat:
// step Data Anak & step Jenis Layanan). Harus lewat modal konfirmasi dulu,
// baru hapusAnakLayanan() dipanggil dari tombol "Ya, Hapus" di modal.
const modalHapusAnakTampil = ref(false);
const indexAnakAkanDihapus = ref<number | null>(null);
const anakAkanDihapus = computed(() => (indexAnakAkanDihapus.value !== null ? listAnak.value[indexAnakAkanDihapus.value] : null));

const bukaKonfirmasiHapusAnak = (index: number) => {
  indexAnakAkanDihapus.value = index;
  modalHapusAnakTampil.value = true;
};

const konfirmasiHapusAnak = async () => {
  if (indexAnakAkanDihapus.value === null) return;
  const index = indexAnakAkanDihapus.value;
  const anak = listAnak.value[index];
  sedangMemproses.value = true;
  try {
    await hapusAnakLayanan(anak.id);
    listAnak.value.splice(index, 1);
    picuToast('Data anak berhasil dihapus.', 'info');
    modalHapusAnakTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus data anak.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

const editAnak = async (index: number) => {
  const anak = listAnak.value[index];
  formNamaAnak.value = anak.nama;
  formSekolahId.value = anak.sekolahId;
  formKelas.value = anak.kelas;
  formHariAktif.value = { ...anak.hariAktif };
  formLayanan.value = anak.layanan;
  formJenisLangganan.value = anak.jenisLangganan;
  posisiDraftAnakBaru.value = null;
  formAlamatJemput.value = anak.alamatJemput;
  formLintang.value = anak.lintangJemput;
  formBujur.value = anak.bujurJemput;
  formDarah.value = anak.golonganDarah || 'O';
  formAlergi.value = anak.alergi || '';
  formFotoAnakBaru.value = null;
  formFotoAnakPreviewBaru.value = '';
  formFotoAnakUrlLama.value = anak.urlFoto || '';
  lokasiValid.value = true;

  sedangMemproses.value = true;
  try {
    await hapusAnakLayanan(anak.id);
    listAnak.value.splice(index, 1);
    picuToast('Data anak dimuat kembali ke formulir untuk diubah.', 'info');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat ulang data anak.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

// Langkah 2: Tambah Anak Ke List (INSERT nyata ke tabel anak). Return
// boolean sukses/gagal -- dipakai selesaikanLangkahAnak() supaya tidak
// diam-diam lanjut ke Langkah 3 kalau draft anak yang sedang diisi gagal
// validasi (mis. foto belum diunggah) padahal listAnak sudah tidak kosong
// karena anak SEBELUMNYA sudah berhasil ditambahkan.
const tambahAnakKeList = async (): Promise<boolean> => {
  errorNamaAnak.value = teksTerisi(formNamaAnak.value) ? '' : 'Nama anak wajib diisi.';
  errorSekolahAnak.value = teksTerisi(formSekolahId.value) ? '' : 'Sekolah wajib dipilih.';
  errorKelasAnak.value = teksTerisi(formKelas.value) ? '' : 'Kelas wajib dipilih.';
  errorJenisLanggananAnak.value = teksTerisi(formJenisLangganan.value) ? '' : 'Jenis layanan wajib dipilih.';
  errorAlamatAnak.value = teksTerisi(formAlamatJemput.value) ? '' : 'Alamat jemput/antar wajib diisi (tentukan titik lokasi pada peta).';
  // Foto WAJIB -- kecuali anak ini sedang diedit ulang dan sebelumnya sudah
  // punya foto (formFotoAnakUrlLama terisi dari editAnak()), pengguna tidak
  // wajib memilih file baru lagi.
  errorFotoAnak.value = (formFotoAnakBaru.value || formFotoAnakUrlLama.value)
    ? ''
    : 'Foto profil anak wajib diunggah sebelum melanjutkan.';

  if (errorNamaAnak.value || errorSekolahAnak.value || errorKelasAnak.value || errorJenisLanggananAnak.value || errorAlamatAnak.value || errorFotoAnak.value) {
    picuToast('Mohon lengkapi seluruh data yang wajib diisi sebelum melanjutkan.', 'error');
    return false;
  }
  if (!lokasiValid.value) {
    picuToast('Lokasi berada di luar wilayah operasional Kota Padang. Silakan pilih ulang titik lokasi pada peta.', 'error');
    return false;
  }
  if (!authStore.pengguna?.id) return false;

  sedangMemproses.value = true;
  try {
    const anakBaru = await buatAnakBaru({
      orangTuaId: authStore.pengguna.id,
      namaLengkap: formNamaAnak.value,
      sekolahId: formSekolahId.value,
      kelas: formKelas.value,
      golonganDarah: formDarah.value,
      alergi: formAlergi.value,
      alamatJemput: formAlamatJemput.value,
      lintangJemput: formLintang.value,
      bujurJemput: formBujur.value,
      jenisLayanan: formLayanan.value,
      jenisLangganan: formJenisLangganan.value as 'bulanan' | 'harian'
    });

    // Foto (WAJIB, sudah divalidasi di atas): file baru diunggah dulu; kalau
    // tidak ada file baru tapi anak ini sebelumnya sudah punya foto (mis.
    // sedang diedit ulang, lihat editAnak -- anak lama dihapus & dibuat
    // ulang), foto lamanya tetap dipakai tanpa perlu upload ulang.
    let urlFotoAnak: string | undefined;
    if (formFotoAnakBaru.value) {
      try {
        urlFotoAnak = await unggahFotoAnak(authStore.pengguna.id, anakBaru.id, formFotoAnakBaru.value);
      } catch (errFoto: any) {
        picuToast(errFoto.message || 'Data anak tersimpan, tapi foto gagal diunggah. Anda bisa menambahkannya lagi lewat menu Edit Profil.', 'error');
      }
    } else if (formFotoAnakUrlLama.value) {
      urlFotoAnak = formFotoAnakUrlLama.value;
    }
    if (urlFotoAnak) {
      try {
        await perbaruiAnak(anakBaru.id, { urlFoto: urlFotoAnak });
      } catch {
        // Biarkan gagal senyap -- anak & data lainnya sudah tersimpan valid,
        // foto bisa ditambahkan lagi lewat menu Edit Profil.
      }
    }

    listAnak.value.push({
      id: anakBaru.id,
      nama: anakBaru.nama_lengkap,
      sekolahId: anakBaru.sekolah_id,
      sekolah: anakBaru.sekolah?.nama || daftarSekolah.value.find((s) => s.id === formSekolahId.value)?.nama || '-',
      kelas: anakBaru.kelas,
      hariAktif: { ...formHariAktif.value },
      layanan: anakBaru.jenis_layanan,
      jenisLangganan: anakBaru.jenis_langganan,
      alamatJemput: anakBaru.alamat_jemput,
      lintangJemput: anakBaru.lintang_jemput,
      bujurJemput: anakBaru.bujur_jemput,
      golonganDarah: anakBaru.golongan_darah || undefined,
      alergi: anakBaru.alergi || undefined,
      urlFoto: urlFotoAnak
    });

    // Reset form anak
    formNamaAnak.value = '';
    formAlergi.value = '';
    formFotoAnakBaru.value = null;
    formFotoAnakPreviewBaru.value = '';
    formFotoAnakUrlLama.value = '';
    formJenisLangganan.value = '';
    posisiDraftAnakBaru.value = null;
    formHariAktif.value = buatDefaultHariAktif();
    // WAJIB direset juga -- tanpa ini, titik lokasi anak yang BARU SAJA
    // disimpan tetap "menempel" ke draft anak BERIKUTNYA (awal-terkonfirmasi
    // di PemilihPeta akan salah menganggapnya sudah dikonfirmasi).
    formAlamatJemput.value = '';
    formLintang.value = -0.9471;
    formBujur.value = 100.4172;
    lokasiValid.value = true;
    picuToast('Satu data anak berhasil ditambahkan!', 'sukses');
    return true;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan data anak.', 'error');
    return false;
  } finally {
    sedangMemproses.value = false;
  }
};

const selesaikanLangkahAnak = async () => {
  if (formNamaAnak.value.trim() !== '') {
    const berhasil = await tambahAnakKeList();
    // Gagal (mis. foto belum diunggah) -- JANGAN diam-diam lanjut ke
    // Langkah 3 hanya karena listAnak sudah tidak kosong dari anak
    // sebelumnya; pesan error sudah ditampilkan tambahAnakKeList() sendiri.
    if (!berhasil) return;
  }
  if (listAnak.value.length === 0) {
    picuToast('Silakan tambahkan minimal satu data anak sekolah', 'error');
    return;
  }
  langkahAktif.value = 3;
};

const selesaikanLangkahJenisLayanan = () => {
  if (listAnak.value.length === 0) {
    picuToast('Silakan tambahkan minimal satu data anak sekolah', 'error');
    return;
  }

  // Anak langganan BULANAN wajib punya minimal 1 hari aktif dipilih --
  // pola kosong (semua checkbox tidak dicentang) membuat kalender jadwal &
  // penugasan supir tidak punya dasar hari sama sekali, seolah anak tidak
  // pernah dijemput/diantar walau sudah bayar penuh.
  const anakTanpaHariAktif = listAnak.value.find(
    (anak) => anak.jenisLangganan === 'bulanan' && !Object.values(anak.hariAktif).some(Boolean)
  );
  if (anakTanpaHariAktif) {
    picuToast(`Pilih minimal 1 hari jadwal untuk ${anakTanpaHariAktif.nama || 'anak dengan langganan bulanan'}.`, 'error');
    return;
  }

  modalRingkasanTampil.value = true;
};

// Konfirmasi ringkasan -> simpan pilihan layanan & buat baris langganan+pembayaran nyata
const konfirmasiLanjutLangkah3 = async () => {
  if (!authStore.pengguna?.id) return;

  sedangMemproses.value = true;
  try {
    // Gerbang keamanan -- JANGAN pernah menyimpan baris pembayaran dengan
    // biaya 0 hanya karena pengaturan tarif kebetulan belum/gagal dimuat
    // (lihat catatan panjang di muatTarif()). Kalau masih null di titik
    // ini, coba muat ulang SEKALI lagi; kalau tetap gagal, batalkan alur
    // sebelum sempat menulis apa pun ke database -- lebih baik pengguna
    // menekan tombol ulang drpd terlanjur membuat tagihan Rp 0 yang nanti
    // ditolak Midtrans ("gross_amount harus >= 0.01") di Langkah 4.
    if (!tarif.value) {
      await muatTarif();
      if (!tarif.value) {
        picuToast('Gagal memuat pengaturan tarif. Periksa koneksi internet Anda lalu coba lagi.', 'error');
        return;
      }
    }

    for (const anak of listAnak.value) {
      await perbaruiAnak(anak.id, {
        jenisLayanan: anak.layanan,
        jenisLangganan: anak.jenisLangganan
      });

      // Simpan pola hari terpilih ke jadwal_mingguan -- dipakai juga sebagai
      // basis kalender "Konfigurasi Jadwal Bulanan" di menu Jadwal nanti,
      // dan sebagai filter penugasan Admin (buatPenugasan di adminLayanan.ts).
      // Disimpan utk SEMUA jenis langganan (bukan cuma "bulanan") supaya
      // pola hari langganan harian pun tidak hilang begitu wizard selesai.
      await simpanJadwalMingguan({
        anakId: anak.id,
        senin: anak.hariAktif.Senin,
        selasa: anak.hariAktif.Selasa,
        rabu: anak.hariAktif.Rabu,
        kamis: anak.hariAktif.Kamis,
        jumat: anak.hariAktif.Jumat,
        sabtu: anak.hariAktif.Sabtu,
        minggu: anak.hariAktif.Minggu
      });

      const biaya = hitungBiayaPerAnak(anak);
      const hasil = await buatAtauPerbaruiLanggananDanPembayaran({
        anakId: anak.id,
        orangTuaId: authStore.pengguna.id,
        jenisLangganan: anak.jenisLangganan,
        biaya
      });
      anak.langgananId = hasil.langganan.id;
      anak.pembayaranId = hasil.pembayaran.id;
      anak.idPesananMidtrans = hasil.pembayaran.id_pesanan_midtrans;
    }

    modalRingkasanTampil.value = false;
    langkahAktif.value = 4;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyiapkan tagihan langganan.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

// Langkah 3: Bayar via Midtrans Snap sungguhan. Setiap anak punya baris
// `pembayaran` tersendiri (lihat buatAtauPerbaruiLanggananDanPembayaran),
// jadi untuk keluarga dengan >1 anak, transaksi Midtrans dibuka satu per
// satu secara berurutan.
// Dipakai baik oleh alur sukses langsung (bayarSnapMidtrans) maupun alur
// "Cek Status Sekarang" (cekUlangStatusPembayaran) begitu pembayaran
// terkonfirmasi lunas -- supaya kedua jalur itu tidak menduplikasi logika
// yang sama persis.
const selesaikanSetelahLunas = async () => {
  if (!authStore.pengguna?.id) return;
  await authStore.periksaStatusBerlangganan(authStore.pengguna.id);
  // Jaring pengaman -- lihat catatan lengkap di bayarSnapMidtrans() soal
  // kenapa status ini dipaksa true, bukan cuma mengandalkan hasil query di
  // atas yang bisa saja timeout/gagal sesaat.
  authStore.sudahBerlangganan = true;
  authStore.pernahBerlangganan = true;
  // authStore.peran JUGA dipaksa di sini -- guard rute (src/rute/index.ts)
  // untuk /orangtua memeriksa authStore.peran, bukan cuma status
  // berlangganan. peran ini dibaca reaktif dari auth.userProfile (singleton
  // di useAuth.ts) yang bisa saja masih belum termuat/salah sesaat (fallback
  // ke 'tamu') kalau muatProfilPengguna() sempat gagal di seluruh
  // percobaannya -- terbukti dari laporan tombol "Masuk ke Halaman
  // Monitoring Anak" di bawah kadang tetap terlempar balik ke landing page
  // walau status berlangganan sudah benar. Halaman wizard ini SUDAH pasti
  // hanya bisa dicapai oleh akun berperan 'orangtua' (dijaga di guard rute
  // /berlangganan sendiri), jadi aman dipastikan di sini.
  authStore.peran = 'orangtua';
  resetDataOrangTua();
  pembayaranLunas.value = true;
  pembayaranIdsMenunggu.value = [];
};

const cekUlangStatusPembayaran = async () => {
  if (pembayaranIdsMenunggu.value.length === 0) return;
  sedangMengecekStatus.value = true;
  try {
    const status = await cekStatusPembayaran(pembayaranIdsMenunggu.value);
    if (status === 'lunas') {
      await selesaikanSetelahLunas();
      picuToast('Pembayaran berhasil dikonfirmasi lunas!', 'sukses');
    } else if (status === 'gagal') {
      pembayaranIdsMenunggu.value = [];
      picuToast('Pembayaran ternyata gagal/dibatalkan Midtrans. Silakan coba "Bayar Sekarang" lagi.', 'error');
    } else {
      picuToast('Belum ada konfirmasi baru, masih diproses. Coba cek lagi sesaat lagi.', 'info');
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal memeriksa status pembayaran.', 'error');
  } finally {
    sedangMengecekStatus.value = false;
  }
};

const bayarSnapMidtrans = async () => {
  if (!authStore.pengguna?.id) return;

  const antrian = listAnak.value.filter((a) => a.pembayaranId && a.langgananId);
  if (antrian.length === 0) return;

  sedangMemproses.value = true;
  try {
    // Jaring pengaman sebelum benar-benar membuka Midtrans -- kalau baris
    // `pembayaran` sempat tersimpan dengan jumlah 0 (mis. dibuat saat
    // pengaturan tarif belum sempat termuat), Midtrans akan menolaknya
    // dengan error "gross_amount harus >= 0.01" walau tampilan di layar
    // sudah menunjukkan harga yang benar (totalTagihan dihitung ulang
    // reaktif, tapi baris di database tidak otomatis ikut ter-update).
    // Sinkronkan ulang jumlah tagihan tiap anak persis sebelum transaksi
    // dibuat -- buatAtauPerbaruiLanggananDanPembayaran() aman dipanggil
    // ulang (idempoten, UPDATE baris yang sama, bukan duplikat).
    if (tarif.value) {
      for (const anak of antrian) {
        const biayaTerkini = hitungBiayaPerAnak(anak);
        const hasil = await buatAtauPerbaruiLanggananDanPembayaran({
          anakId: anak.id,
          orangTuaId: authStore.pengguna.id,
          jenisLangganan: anak.jenisLangganan,
          biaya: biayaTerkini
        });
        anak.langgananId = hasil.langganan.id;
        anak.pembayaranId = hasil.pembayaran.id;
        anak.idPesananMidtrans = hasil.pembayaran.id_pesanan_midtrans;
      }
    }

    // Fallback: Supabase tidak dikonfigurasi (mode mock lokal) -- langsung
    // lunaskan tanpa memanggil Edge Function/Midtrans sungguhan.
    if (!supabase) {
      for (const anak of antrian) {
        await konfirmasiPembayaranLunas(anak.pembayaranId!, anak.langgananId!, anak.jenisLangganan);
      }
      await selesaikanSetelahLunas();
      picuToast('Pembayaran berhasil dilunasi (mode simulasi lokal)!', 'sukses');
      return;
    }

    // Pembayaran Gabungan Multi-Anak: SATU transaksi Snap untuk total semua
    // anak dalam antrian sekaligus, bukan satu-satu per anak -- lihat
    // catatan lengkap di prosesPembayaranMidtrans (midtransLayanan.ts).
    const label = antrian.length > 1 ? `${antrian.length} Anak` : antrian[0].nama;
    const hasilAkhir = await prosesPembayaranMidtrans(
      antrian.map((a) => a.pembayaranId!),
      { onProgres: (teks) => { progresBayarTeks.value = `${teks} (${label})`; } }
    );

    if (hasilAkhir === 'batal') {
      picuToast('Pembayaran belum selesai. Klik "Bayar Sekarang" lagi untuk mencoba lagi.', 'info');
      return;
    }
    if (hasilAkhir === 'gagal') {
      picuToast('Pembayaran gagal/dibatalkan oleh Midtrans. Silakan coba lagi.', 'error');
      return;
    }
    if (hasilAkhir === 'timeout_setelah_sukses') {
      // Midtrans SENDIRI sudah mengonfirmasi sukses -- BUKAN kegagalan
      // pembayaran, cuma konfirmasi dari sistem kita yang belum sempat
      // datang. JANGAN disuruh "Bayar Sekarang" lagi (risiko bayar dua
      // kali) -- tampilkan tombol "Cek Status Sekarang" di bawah supaya
      // pengguna bisa memeriksa ulang kapan saja tanpa harus reload.
      pembayaranIdsMenunggu.value = antrian.map((a) => a.pembayaranId!);
      picuToast(
        'Pembayaran Anda sudah dikonfirmasi berhasil oleh Midtrans. Sistem kami masih memproses konfirmasinya -- klik "Cek Status Sekarang" di bawah beberapa saat lagi. Jangan membayar ulang.',
        'info'
      );
      return;
    }

    await selesaikanSetelahLunas();
    picuToast('Pembayaran berhasil dilunasi via Midtrans!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memproses pembayaran. Silakan coba lagi.', 'error');
  } finally {
    progresBayarTeks.value = '';
    sedangMemproses.value = false;
  }
};

// Hitung estimasi harga dari pengaturan tarif nyata (tabel pengaturan_tarif).
// Bulanan: tarif flat per jenis layanan. Harian: tarif dasar + per-km di atas
// jarak dasar, dihitung dari JARAK NYATA alamat jemput anak ke sekolahnya
// (hitungJarakKm) -- jarakEstimasiKm (5 km) hanya dipakai sebagai fallback
// kalau koordinat sekolah kebetulan tidak tersedia. SEBELUMNYA jarakEstimasiKm
// dipakai langsung sebagai jarak (bukan fallback), sehingga tarif Harian
// selalu menghasilkan angka yang sama persis untuk semua anak berapa pun
// jarak rumahnya ke sekolah -- kini konsisten dengan estimasi live di
// Langkah 2 (lihat jarakDraftAnakBaru/estimasiBiayaAnakBaru).
const jarakEstimasiKm = 5;
const hitungBiayaPerAnak = (anak: DataAnak) => {
  if (!tarif.value) return 0;
  if (anak.jenisLangganan === 'harian') {
    const sekolah = daftarSekolah.value.find((s) => s.id === anak.sekolahId);
    const jarak = sekolah
      ? hitungJarakKm(anak.lintangJemput, anak.bujurJemput, sekolah.lintang, sekolah.bujur)
      : jarakEstimasiKm;
    return hitungBiayaHarian(tarif.value, jarak);
  }
  // Dasar potongan biaya 40% adalah HARI EFEKTIF SEKOLAH dari kalender libur
  // Admin (hari_libur), BUKAN jumlah hari yang dipilih pengguna sendiri di
  // anak.hariAktif -- lihat hitungHariEfektifSekolahBulanIni() di
  // kalenderJadwal.ts. Pengguna yang cuma memilih sebagian hari (mis. 3 dari
  // 5 hari sekolah) tetap dikenakan tarif penuh, karena layanan tetap
  // tersedia selama periode langganan dan pengurangan itu murni pilihan
  // pengguna, bukan libur sekolah resmi.
  const tanggalLibur = tanggalLiburKeSet(daftarHariLibur.value, anak.sekolahId);
  return hitungBiayaBulanan(tarif.value, anak.layanan, hitungHariEfektifSekolahBulanIni(ambilWaktuSekarang(), tanggalLibur));
};

const namaBulanTahunIni = ambilWaktuSekarang().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const kalenderUntukAnak = (anak: DataAnak) =>
  buatKalenderBulanIni(anak.hariAktif, ambilWaktuSekarang(), tanggalLiburKeSet(daftarHariLibur.value, anak.sekolahId));

const totalTagihan = computed(() => {
  return listAnak.value.reduce((sum, anak) => sum + hitungBiayaPerAnak(anak), 0);
});

// Sebelum lunas: invoice digital (PDF asli via jsPDF, sama seperti struk
// pembayaran) yang bisa diunduh sebagai bukti tagihan. Setelah lunas,
// tombol yang relevan adalah unduhStruk().
const unduhInvoice = () => {
  unduhInvoicePdf({
    nomorInvoice: (listAnak.value[0]?.idPesananMidtrans || 'INVOICE').toUpperCase(),
    namaOrangTua: namaOrangTua.value || 'Orang Tua',
    kontakOrangTua: waOrangTua.value,
    tanggalTerbit: ambilWaktuSekarang().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    items: listAnak.value.map((anak) => ({
      label: `Layanan Antar Jemput untuk ${anak.nama}`,
      jumlah: hitungBiayaPerAnak(anak)
    })),
    total: totalTagihan.value
  });
  picuToast('Invoice berhasil diunduh!', 'sukses');
};

const unduhStruk = () => {
  unduhStrukPembayaran({
    nomorStruk: (listAnak.value[0]?.idPesananMidtrans || 'STRUK').toUpperCase(),
    namaOrangTua: namaOrangTua.value || 'Orang Tua',
    kontakOrangTua: waOrangTua.value,
    tanggalBayar: ambilWaktuSekarang().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    items: listAnak.value.map((anak) => ({
      label: `Layanan Antar Jemput untuk ${anak.nama}`,
      jumlah: hitungBiayaPerAnak(anak)
    })),
    total: totalTagihan.value,
    metode: 'Midtrans'
  });
  picuToast('Struk pembayaran berhasil diunduh!', 'sukses');
};
</script>

<template>
  <div class="min-h-screen bg-[#f5fbf7] text-slate-800 flex flex-col font-sans relative overflow-x-hidden">
    <!-- Header Minimalis Sederhana -->
    <header class="w-full bg-white border-b border-slate-100 h-20 px-6 md:px-12 flex justify-between items-center shadow-xs z-20 overflow-visible">
      <div class="flex items-center gap-2">
        <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-14 md:h-24 w-auto" />
      </div>
      <a href="https://wa.me/6281213668215" target="_blank" class="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-semibold no-underline">
        <HelpCircle class="w-4.5 h-4.5 text-[#14a38b]" />
        <span>Butuh Bantuan?</span>
      </a>
    </header>

    <main class="flex-grow flex items-start justify-center py-12 px-4 relative min-h-[300px]">
      <!-- Decorative Blur Blobs -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#14a38b]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-[#14a38b]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <!-- Toast Alert -->
      <NotifikasiUtama
        :tampil="toastTampil"
        :pesan="toastPesan"
        :tipe="toastTipe"
        @tutup="toastTampil = false"
      />

      <MemuatUtama :tampil="sedangMemuat" pesan="Memuat status langganan..." penuh-layar />

      <!-- Container Utama -->
      <div v-if="!sedangMemuat" class="w-full max-w-4xl space-y-8 z-10">

      <!-- Wizard Progress Bar Mode Tambah Anak (2-Step Indicator) -->
      <div v-if="modeTambahAnak" class="w-full max-w-md mx-auto mb-8 bg-white p-6 rounded-[16px] shadow-sm border border-slate-100 text-left">
        <div class="flex justify-between relative">
          <div class="absolute left-0 top-4 -translate-y-1/2 w-full h-[2px] bg-slate-200 -z-0"></div>
          <div
            class="absolute left-0 top-4 -translate-y-1/2 h-[2px] bg-[#14a38b] -z-0 transition-all duration-300"
            :style="{ width: progressLineWidthTambah }"
          ></div>

          <!-- Tahap 1: Data Anak Tambahan -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 2 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <Check v-if="langkahAktif > 3" class="w-4 h-4 text-white" />
              <span v-else>1</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 2 ? 'text-[#14a38b]' : 'text-slate-400'">Data Anak Tambahan</span>
          </div>

          <!-- Tahap 2: Pembayaran -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 4 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <span>2</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 4 ? 'text-[#14a38b]' : 'text-slate-400'">Pembayaran</span>
          </div>
        </div>
      </div>

      <!-- Wizard Progress Bar (4-Step Indicator) -->
      <div v-else-if="langkahAktif >= 1" class="w-full max-w-3xl mx-auto mb-8 bg-white p-6 rounded-[16px] shadow-sm border border-slate-100 text-left">
        <div class="flex justify-between relative">
          <!-- Line background -->
          <div class="absolute left-0 top-4 -translate-y-1/2 w-full h-[2px] bg-slate-200 -z-0"></div>
          <!-- Active Progress Line -->
          <div
            class="absolute left-0 top-4 -translate-y-1/2 h-[2px] bg-[#14a38b] -z-0 transition-all duration-300"
            :style="{ width: progressLineWidth }"
          ></div>
          
          <!-- Step 1: Data Pengguna -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 1 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <Check v-if="langkahAktif > 1" class="w-4 h-4 text-white" />
              <span v-else>1</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 1 ? 'text-[#14a38b]' : 'text-slate-400'">Data Pengguna</span>
          </div>

          <!-- Step 2: Data Anak -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 2 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <Check v-if="langkahAktif > 2" class="w-4 h-4 text-white" />
              <span v-else>2</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 2 ? 'text-[#14a38b]' : 'text-slate-400'">Data Anak</span>
          </div>

          <!-- Step 3: Jenis Layanan -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 3 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <Check v-if="langkahAktif > 3" class="w-4 h-4 text-white" />
              <span v-else>3</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 3 ? 'text-[#14a38b]' : 'text-slate-400'">Jenis Layanan</span>
          </div>

          <!-- Step 4: Pembayaran -->
          <div class="flex flex-col items-center gap-1.5 relative z-10 bg-white px-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors duration-200 text-xs"
              :class="langkahAktif >= 4 ? 'bg-[#14a38b] text-white' : 'bg-slate-200 text-slate-400'"
            >
              <span>4</span>
            </div>
            <span class="text-xs font-semibold tracking-wide text-center" :class="langkahAktif >= 4 ? 'text-[#14a38b]' : 'text-slate-400'">Pembayaran</span>
          </div>
        </div>
      </div>

      <!-- ==========================================
      LANGKAH 0: LOGIN / DAFTAR & OTP MOCK
      ========================================== -->
      <div v-if="langkahAktif === 0" class="space-y-6">
        <div class="w-full max-w-md mx-auto bg-white text-slate-800 rounded-[16px] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden text-left">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-slate-800 tracking-tight">{{ modeLogin ? 'Masuk ke Akun Anda' : 'Daftar Akun Baru' }}</h3>
            <p class="text-xs text-slate-500 mt-1">Langkah awal pendaftaran transportasi antar jemput</p>
          </div>

          <!-- OTP Verification View -->
          <div v-if="otpTerkirim && !otpTerverifikasi" class="space-y-6 max-w-sm mx-auto text-center py-4">
            <div class="inline-flex items-center justify-center p-3 bg-[#14a38b]/10 text-[#14a38b] rounded-full border border-[#14a38b]/20">
              <Mail class="w-8 h-8" />
            </div>
            <h4 class="text-base font-bold text-slate-800">Verifikasi OTP Email</h4>
            <p class="text-xs text-slate-500 leading-relaxed">
              Kami telah mengirimkan kode verifikasi 4-digit ke <strong class="text-slate-700">{{ authEmail }}</strong>. Silakan masukkan di bawah ini.
            </p>
            <div class="space-y-4">
              <input
                type="text"
                v-model="otpSandi"
                placeholder="Masukkan 4 digit OTP"
                maxlength="4"
                class="w-full tracking-widest text-center text-lg font-mono py-2.5 bg-white border border-slate-200 rounded-[10px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] outline-none"
              />
              <button 
                type="button" 
                class="w-full bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold py-2.5 px-4 rounded-[12px] transition-colors duration-200 shadow-xs border-0 cursor-pointer text-sm"
                @click="verifikasiOtpMock"
              >
                Verifikasi OTP
              </button>
            </div>
          </div>

          <!-- Form Email & Password Input -->
          <form v-else class="space-y-4" @submit.prevent="tanganiDaftarLoginMock">
            <div>
              <label class="block text-xs font-semibold text-slate-600 tracking-wide mb-2">Alamat Email</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail class="w-4.5 h-4.5" />
                </div>
                <input
                  type="email"
                  v-model="authEmail"
                  required
                  placeholder="nama@email.com"
                  class="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 tracking-wide mb-2">Kata Sandi</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound class="w-4.5 h-4.5" />
                </div>
                <input
                  type="password"
                  v-model="authSandi"
                  required
                  placeholder="••••••••"
                  class="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
                />
              </div>
            </div>

            <div class="pt-2">
              <button 
                type="submit" 
                class="w-full bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold py-2.5 px-4 rounded-[12px] transition-colors duration-200 shadow-xs border-0 cursor-pointer text-sm"
              >
                {{ modeLogin ? 'Masuk Sekarang' : 'Daftar & Kirim OTP' }}
              </button>
            </div>

            <div class="text-center text-xs pt-2">
              <button
                type="button"
                @click="modeLogin = !modeLogin; otpTerkirim = false;"
                class="text-[#14a38b] hover:underline font-bold bg-transparent border-0 cursor-pointer"
              >
                {{ modeLogin ? 'Belum punya akun? Daftar sekarang' : 'Sudah punya akun? Masuk saja' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ==========================================
      LANGKAH 1: DATA ORANG TUA / WALI
      ========================================== -->
      <div v-if="langkahAktif === 1" class="space-y-6">
        <div class="w-full max-w-2xl mx-auto bg-white text-slate-800 rounded-[16px] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden text-left">
          
          <h1 class="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Lengkapi Data Diri Kamu</h1>
          <p class="text-sm text-slate-500 mb-6 leading-relaxed">
            Data ini digunakan untuk menghubungi orang tua terkait informasi perjalanan dan layanan antar jemput.
          </p>

          <form class="flex flex-col gap-5" novalidate @submit.prevent="simpanProfilOrangTua">
            <!-- Nama Lengkap -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-slate-600 tracking-wide" for="nama_lengkap">Nama Lengkap</label>
              <input
                class="w-full rounded-[10px] border bg-white text-slate-800 focus:ring-1 px-4 py-3 text-sm transition-colors placeholder:text-slate-400 outline-none"
                :class="errorNamaOrangTua ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                id="nama_lengkap"
                name="nama_lengkap"
                v-model="namaOrangTua"
                placeholder="Masukkan nama lengkap"
                type="text"
              />
              <span v-if="errorNamaOrangTua" class="text-[11px] text-rose-600">{{ errorNamaOrangTua }}</span>
            </div>

            <!-- Email -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-slate-600 tracking-wide" for="email">Email</label>
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  class="w-full rounded-[10px] border border-slate-200 bg-slate-50 text-slate-400 pl-10 pr-4 py-3 text-sm cursor-not-allowed outline-none"
                  disabled
                  id="email"
                  name="email"
                  type="email"
                  v-model="emailOrangTua"
                />
              </div>
              <span class="text-[11px] text-slate-400">Email tidak dapat diubah.</span>
            </div>

            <!-- Nomor WhatsApp -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-slate-600 tracking-wide" for="whatsapp">Nomor WhatsApp</label>
              <input
                class="w-full rounded-[10px] border bg-white text-slate-800 focus:ring-1 px-4 py-3 text-sm transition-colors placeholder:text-slate-400 outline-none"
                :class="errorWaOrangTua ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                id="whatsapp"
                name="whatsapp"
                v-model="waOrangTua"
                placeholder="08xxxxxxxxxx"
                type="tel"
              />
              <span v-if="errorWaOrangTua" class="text-[11px] text-rose-600">{{ errorWaOrangTua }}</span>
            </div>

            <!-- Submit Button -->
            <div class="flex justify-end mt-2">
              <button
                class="bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold py-3 px-8 rounded-[12px] transition-colors duration-200 shadow-xs border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                type="submit"
                :disabled="sedangMemproses"
              >
                {{ sedangMemproses ? 'Menyimpan...' : 'Lanjutkan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
      <!-- ==========================================
      LANGKAH 2: DATA ANAK / SISWA & MAP PICKER
      ========================================== -->
      <div v-if="langkahAktif === 2" class="space-y-6">
        <div class="w-full max-w-2xl mx-auto bg-white text-slate-800 rounded-[16px] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden text-left">

          <button
            type="button"
            @click="modeTambahAnak ? kembaliKeDashboard() : (langkahAktif = 1)"
            class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#14a38b] transition-colors bg-transparent border-0 cursor-pointer mb-4 -ml-1 px-1 py-1"
          >
            <ArrowLeft class="w-4 h-4" />
            Kembali
          </button>

          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-slate-800 mb-1 tracking-tight">{{ modeTambahAnak ? 'Data Anak Tambahan' : 'Data Anak' }}</h1>
            <p class="text-sm text-slate-500">Tambahkan data anak yang akan menggunakan layanan antar jemput.</p>
          </div>

          <!-- Form Anak Card -->
          <div class="bg-slate-50/50 border border-slate-100 rounded-[12px] p-5 mb-5">
            <!-- Foto Anak (Wajib) -->
            <div class="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
              <div
                class="w-16 h-16 rounded-xl bg-white border overflow-hidden flex items-center justify-center shadow-inner flex-shrink-0"
                :class="errorFotoAnak ? 'border-rose-400' : 'border-slate-200'"
              >
                <img
                  v-if="formFotoAnakPreviewBaru || formFotoAnakUrlLama"
                  :src="formFotoAnakPreviewBaru || formFotoAnakUrlLama"
                  alt="Foto Anak"
                  class="w-full h-full object-cover"
                />
                <User v-else class="w-7 h-7 text-slate-400" />
              </div>
              <div class="flex flex-col gap-1">
                <input
                  ref="fileInputFotoAnak"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  class="hidden"
                  @change="tanganiPilihFotoAnak"
                />
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 border font-semibold text-xs rounded-[10px] transition-colors cursor-pointer w-fit"
                  :class="errorFotoAnak ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100' : 'border-slate-200 text-slate-600 bg-white hover:bg-white'"
                  @click="triggerPilihFotoAnak"
                >
                  <Upload class="w-3.5 h-3.5" :class="errorFotoAnak ? 'text-rose-400' : 'text-slate-400'" />
                  {{ (formFotoAnakPreviewBaru || formFotoAnakUrlLama) ? 'Ganti Foto' : 'Unggah Foto Anak (Wajib)' }}
                </button>
                <span v-if="errorFotoAnak" class="text-[11px] text-rose-600 font-semibold">{{ errorFotoAnak }}</span>
                <span v-else class="text-[10px] text-slate-400">Format: PNG, JPG, JPEG, atau WEBP (Maks. 2MB)</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-slate-600 tracking-wide">Nama Lengkap Anak</label>
                <input
                  v-model="formNamaAnak"
                  class="w-full h-11 px-4 rounded-[10px] border focus:ring-1 outline-none transition-all text-sm bg-white text-slate-800 placeholder-slate-400"
                  :class="errorNamaAnak ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                  placeholder="Masukkan nama lengkap anak"
                  type="text"
                />
                <span v-if="errorNamaAnak" class="text-[11px] text-rose-600">{{ errorNamaAnak }}</span>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-slate-600 tracking-wide">Sekolah</label>
                <div class="relative">
                  <select
                    v-model="formSekolahId"
                    class="w-full h-11 px-4 appearance-none rounded-[10px] border focus:ring-1 outline-none transition-all text-sm bg-white text-slate-800 pr-10"
                    :class="errorSekolahAnak ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                  >
                    <option disabled value="">Pilih sekolah</option>
                    <option v-for="sch in daftarSekolah" :key="sch.id" :value="sch.id">{{ sch.nama }}</option>
                  </select>
                  <ChevronDown class="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p v-if="errorSekolahAnak" class="text-[11px] text-rose-600">{{ errorSekolahAnak }}</p>
                <p v-else-if="daftarSekolah.length === 0" class="text-[10px] text-slate-400">Belum ada data sekolah terdaftar, hubungi admin.</p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-slate-600 tracking-wide">Kelas</label>
                <div class="relative">
                  <select
                    v-model="formKelas"
                    class="w-full h-11 px-4 appearance-none rounded-[10px] border focus:ring-1 outline-none transition-all text-sm bg-white text-slate-800 pr-10"
                    :class="errorKelasAnak ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                  >
                    <option disabled value="">Pilih kelas</option>
                    <option v-for="cls in daftarKelas" :key="cls" :value="cls">{{ cls }}</option>
                  </select>
                  <ChevronDown class="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p v-if="errorKelasAnak" class="text-[11px] text-rose-600">{{ errorKelasAnak }}</p>
                <p v-else-if="formSekolahId && daftarKelas.length === 0" class="text-[10px] text-slate-400">Sekolah ini belum memiliki data kelas, hubungi admin.</p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold text-slate-600 tracking-wide">Jenis Layanan</label>
                <div class="relative">
                  <select
                    v-model="formJenisLangganan"
                    class="w-full h-11 px-4 appearance-none rounded-[10px] border focus:ring-1 outline-none transition-all text-sm bg-white text-slate-800 pr-10"
                    :class="errorJenisLanggananAnak ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:border-[#14a38b] focus:ring-[#14a38b]'"
                  >
                    <option disabled value="">Pilih jenis layanan</option>
                    <option value="bulanan">Bulanan</option>
                    <option value="harian">Harian</option>
                  </select>
                  <ChevronDown class="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p v-if="errorJenisLanggananAnak" class="text-[11px] text-rose-600">{{ errorJenisLanggananAnak }}</p>
                <p v-else class="text-[10px] text-slate-400">Menentukan rumus estimasi biaya & wajib diisi sebelum menentukan pin lokasi.</p>
              </div>
            </div>
            <p v-if="errorAlamatAnak" class="text-[11px] text-rose-600 -mt-2 mb-4">{{ errorAlamatAnak }}</p>

            <!-- Map Picker Section -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-semibold text-slate-600 tracking-wide">Lokasi Jemput/Antar</label>
              <p v-if="formAnakBelumLengkap" class="text-[11px] text-amber-600 font-semibold">
                Lengkapi Nama Anak, Sekolah, Kelas, dan Jenis Layanan terlebih dahulu untuk mengaktifkan penentuan pin lokasi.
              </p>

              <!-- Leaflet Map Pin Point Picker -->
              <div class="w-full rounded-[12px] overflow-hidden border border-slate-200 relative">
                <PemilihPeta
                  tema="terang"
                  :lintang="formLintang"
                  :bujur="formBujur"
                  :awal-terkonfirmasi="!!formAlamatJemput"
                  :estimasi-biaya="estimasiBiayaAnakBaru"
                  :nonaktif="formAnakBelumLengkap"
                  @posisi-berubah="tanganiPosisiAnakBaruBerubah"
                  @pilih-lokasi="tanganiLokasiPeta"
                />
                <div class="absolute top-3 left-3 bg-white px-3 py-1.5 rounded-full shadow-xs text-[11px] font-bold text-slate-600 flex items-center gap-1.5 border border-slate-100 z-10">
                  <span class="w-2 h-2 rounded-full bg-[#14a38b] animate-pulse"></span>
                  Area Layanan: Kota Padang
                </div>
              </div>

              <!-- Address Field -->
              <div class="flex flex-col gap-1.5 mt-2">
                <label class="text-xs font-semibold text-slate-600 tracking-wide">Detail Alamat Jemput/Antar</label>
                <div class="relative">
                  <MapPin class="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                  <textarea
                    v-model="formAlamatJemput"
                    class="w-full pl-11 pr-4 py-2.5 rounded-[10px] border border-slate-200 focus:border-[#14a38b] focus:ring-1 focus:ring-[#14a38b] outline-none transition-all text-sm bg-white resize-none text-slate-800 placeholder-slate-400"
                    placeholder="Contoh: Jl. Khatib Sulaiman No. 12, Padang Utara (Patokan: Depan Masjid Raya)"
                    rows="2"
                  ></textarea>
                </div>
              </div>

              <!-- Info Banner -->
              <div
                class="rounded-[10px] p-3 flex items-start gap-2.5 mt-1 border"
                :class="lokasiValid ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'"
              >
                <Info class="w-4.5 h-4.5 flex-shrink-0 mt-0.5" :class="lokasiValid ? 'text-emerald-600' : 'text-rose-600'" />
                <p class="text-xs leading-normal">
                  {{ lokasiValid ? 'Pastikan titik lokasi yang dipilih berada di dalam wilayah operasional (Kota Padang).' : 'Titik lokasi di luar wilayah operasional Kota Padang — silakan geser pin ke area yang didukung.' }}
                </p>
              </div>
            </div>
          </div>

          <!-- List of Added Children (Summary Row) -->
          <div
            v-for="(anak, idx) in listAnak"
            :key="anak.id"
            class="bg-slate-50 border border-slate-100 rounded-[12px] p-4 flex items-center justify-between mb-3 text-left"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-[#14a38b]/10 flex items-center justify-center text-[#14a38b]">
                <User class="w-4.5 h-4.5" />
              </div>
              <div>
                <p class="font-bold text-slate-800 text-sm">{{ anak.nama }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ anak.sekolah }} • {{ anak.kelas }}</p>
              </div>
            </div>
            <div class="flex gap-1 text-slate-500">
              <button
                type="button"
                @click="editAnak(idx)"
                class="p-1.5 hover:bg-slate-200 rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-[#14a38b]"
              >
                <Edit class="w-4 h-4" />
              </button>
              <button
                type="button"
                @click="bukaKonfirmasiHapusAnak(idx)"
                class="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-rose-500"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Add Child Button (Dashed) -->
          <button
            type="button"
            @click="tambahAnakKeList"
            :disabled="sedangMemproses"
            class="w-full py-3.5 border-2 border-dashed border-[#14a38b]/40 text-[#14a38b] font-semibold text-sm rounded-[12px] hover:bg-[#14a38b]/5 transition-colors flex items-center justify-center gap-2 mb-6 cursor-pointer bg-transparent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus class="w-4 h-4" />
            {{ sedangMemproses ? 'Menyimpan...' : 'Tambah Anak Lain' }}
          </button>

          <!-- Bottom Navigation -->
          <div class="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
            <button
              type="button"
              @click="modeTambahAnak ? kembaliKeDashboard() : (langkahAktif = 1)"
              class="px-8 py-3 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm"
            >
              Kembali
            </button>
            <button
              type="button"
              @click="selesaikanLangkahAnak"
              class="px-8 py-3 rounded-[12px] bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      </div>
      <!-- ==========================================
      LANGKAH 3: PILIHAN JENIS LAYANAN
      ========================================== -->
      <div v-if="langkahAktif === 3" class="space-y-6">
        <div class="w-full max-w-2xl mx-auto bg-white text-slate-800 rounded-[16px] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden text-left">

          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Jenis Layanan</h1>
            <p class="text-sm text-slate-500">Konfigurasi jenis layanan penjemputan dan frekuensi hari sekolah untuk masing-masing anak.</p>
          </div>

          <div class="space-y-5">
            <div
              v-for="(anak, idx) in listAnak"
              :key="anak.id"
              class="bg-slate-50/50 border border-slate-100 rounded-[12px] p-5"
            >
              <div class="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <span class="w-5.5 h-5.5 rounded-full bg-[#14a38b]/10 text-[#14a38b] flex items-center justify-center font-bold text-xs">{{ idx + 1 }}</span>
                <h3 class="font-bold text-slate-800 text-sm">{{ anak.nama }}</h3>
                <span class="text-xs text-slate-400 font-medium">({{ anak.sekolah }} - {{ anak.kelas }})</span>
                <!-- Jenis langganan (Bulanan/Harian) SUDAH dipilih di Langkah 2
                     saat anak ditambahkan -- di sini cuma ditampilkan, tidak
                     bisa diedit ulang, supaya tidak ada pilihan ganda yang
                     membingungkan antar tahap. -->
                <span
                  class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  :class="anak.jenisLangganan === 'harian' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-[#14a38b]/10 text-[#14a38b] border border-[#14a38b]/20'"
                >
                  {{ anak.jenisLangganan === 'harian' ? 'Harian' : 'Bulanan' }}
                </span>
                <button
                  type="button"
                  @click="bukaKonfirmasiHapusAnak(idx)"
                  :disabled="sedangMemproses"
                  title="Hapus anak ini dari langganan"
                  class="ml-auto p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors border-0 cursor-pointer bg-transparent flex items-center text-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              <div class="grid grid-cols-1 gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-slate-600 tracking-wide">Pilih Layanan</label>
                  <div class="relative">
                    <select
                      v-model="anak.layanan"
                      class="w-full h-11 px-4 appearance-none rounded-[10px] border border-slate-200 focus:border-[#14a38b] focus:ring-1 focus:ring-[#14a38b] outline-none transition-all text-sm bg-white text-slate-800 pr-10"
                    >
                      <option value="antar_jemput">Antar Jemput (PP)</option>
                      <option value="antar_saja">Antar Saja (Pagi)</option>
                      <option value="jemput_saja">Jemput Saja (Sore)</option>
                    </select>
                    <ChevronDown class="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div v-if="anak.jenisLangganan === 'bulanan'" class="flex flex-col gap-2 pt-1">
                  <label class="text-xs font-semibold text-slate-600 tracking-wide">Tentukan jadwal pilihan anda!</label>

                  <div class="flex flex-wrap gap-2">
                    <label
                      v-for="(_, hari) in anak.hariAktif"
                      :key="hari"
                      class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:border-[#14a38b]/50 transition-all text-xs"
                    >
                      <input type="checkbox" v-model="anak.hariAktif[hari]" class="accent-[#14a38b] rounded" />
                      <span :class="anak.hariAktif[hari] ? 'text-slate-800 font-bold' : 'text-slate-400'">{{ hari }}</span>
                    </label>
                  </div>

                  <!-- Visualisasi Kalender Bulan Berjalan -->
                  <div class="bg-white border border-slate-100 rounded-[10px] p-3 space-y-2 mt-1">
                    <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">{{ namaBulanTahunIni }}</h4>
                    <div class="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400">
                      <span v-for="h in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']" :key="h">{{ h }}</span>
                    </div>
                    <div class="grid grid-cols-7 gap-1">
                      <div
                        v-for="(sel, idx) in kalenderUntukAnak(anak)"
                        :key="idx"
                        class="aspect-square flex items-center justify-center rounded-md text-[10px] font-semibold"
                        :class="[
                          !sel ? '' : sel.libur ? 'bg-rose-50 text-rose-500 line-through' : sel.aktif ? 'bg-[#14a38b] text-white' : 'bg-slate-50 text-slate-400',
                          sel?.hariIni ? 'ring-2 ring-[#14a38b] ring-offset-1' : '',
                          sel?.lewat ? 'opacity-40 grayscale cursor-not-allowed' : ''
                        ]"
                        :title="sel?.lewat ? 'Tanggal sudah lewat, tidak dapat dipilih' : undefined"
                      >
                        {{ sel?.tanggal ?? '' }}
                      </div>
                    </div>
                    <div class="flex items-center justify-center gap-3 text-[9px] text-slate-400 pt-1">
                      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#14a38b] inline-block"></span> Jadwal Aktif</span>
                      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-400 inline-block"></span> Hari Libur</span>
                    </div>
                  </div>
                  <p class="text-[10px] text-slate-400 leading-normal">
                    Pilih minimal 1 hari jadwal penjemputan/pengantaran rutin (wajib). Biaya langganan bulanan mengikuti tarif layanan dan jumlah hari efektif sekolah dari kalender Admin -- bukan jumlah hari yang Anda pilih di sini.
                  </p>
                </div>
              </div>

              <!-- Cost breakdown for this child -->
              <div v-if="tarif" class="mt-4 flex justify-between items-center bg-[#14a38b]/5 p-3.5 rounded-[10px] border border-[#14a38b]/10">
                <span class="text-xs font-semibold text-[#14a38b]">Jumlah Biaya:</span>
                <span class="font-mono text-[#14a38b] font-extrabold text-sm">{{ formatMataUang(hitungBiayaPerAnak(anak)) }}</span>
              </div>
              <div v-else class="mt-4 text-xs text-slate-400 italic">Memuat tarif...</div>
              <p v-if="anak.jenisLangganan === 'harian'" class="text-[10px] text-slate-400 mt-2 leading-normal">
                Estimasi awal (tarif dasar + contoh jarak 5km). Biaya final dihitung otomatis berdasarkan jarak tempuh aktual setiap perjalanan.
              </p>
            </div>
          </div>

          <!-- Ringkasan Total (semua anak) -->
          <div v-if="tarif && listAnak.length > 0" class="mt-5 flex justify-between items-center bg-slate-800 text-white p-4 rounded-[12px]">
            <span class="text-sm font-semibold">Jumlah Biaya ({{ listAnak.length }} Anak):</span>
            <span class="font-mono font-extrabold text-base">{{ formatMataUang(totalTagihan) }}</span>
          </div>

          <!-- Bottom Navigation -->
          <div class="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
            <button
              type="button"
              @click="langkahAktif = 2"
              class="px-8 py-3 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm"
            >
              Kembali
            </button>
            <button
              type="button"
              @click="selesaikanLangkahJenisLayanan"
              class="px-8 py-3 rounded-[12px] bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm"
            >
              Lanjutkan
            </button>
        </div>
      </div>
    </div>

      <!-- ==========================================
      LANGKAH 4: SIMULASI MIDTRANS & DIGITAL INVOICE
      ========================================== -->
      <div v-if="langkahAktif === 4" class="space-y-6">
        <div class="w-full max-w-2xl mx-auto bg-white text-slate-800 rounded-[16px] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden text-left">
          
          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Rincian & Pembayaran Tagihan</h1>
            <p class="text-sm text-slate-500">Lakukan pembayaran aman menggunakan Midtrans Snap</p>
          </div>

          <!-- Gerbang: kalau pengaturan tarif gagal dimuat, JANGAN tampilkan
               rincian tagihan sama sekali (bisa salah tampil Rp 0) -- tampilkan
               peringatan + tombol coba lagi sampai tarif benar-benar berhasil dimuat. -->
          <div v-if="sedangMemuatTarif" class="flex items-center justify-center py-12">
            <Loader2 class="w-7 h-7 text-[#14a38b] animate-spin" />
          </div>
          <div v-else-if="!tarif" class="flex flex-col items-center gap-3 py-10 text-center bg-rose-50 border border-rose-200 rounded-[12px] px-6">
            <AlertTriangle class="w-8 h-8 text-rose-500" />
            <p class="text-sm text-rose-700 max-w-sm">Gagal memuat pengaturan tarif, sehingga rincian tagihan tidak bisa ditampilkan. Periksa koneksi internet Anda lalu coba lagi.</p>
            <button
              type="button"
              @click="muatTarif()"
              class="px-4 py-2 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw class="w-3.5 h-3.5" /> Coba Lagi
            </button>
          </div>

          <div v-else class="space-y-6">
            <div class="space-y-2">
              <span class="text-xs font-semibold text-slate-600 tracking-wide uppercase">Item Tagihan Berlangganan:</span>
              <div class="divide-y divide-slate-100 bg-slate-50 rounded-[12px] border border-slate-100 p-4">
                <div
                  v-for="anak in listAnak"
                  :key="anak.id"
                  class="flex justify-between items-center py-2.5 text-sm text-slate-600"
                >
                  <div>
                    <p class="font-bold text-slate-800">{{ anak.nama }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">{{ anak.sekolah }} - {{ anak.layanan === 'antar_jemput' ? 'Antar Jemput (PP)' : 'Satu Arah' }}</p>
                  </div>
                  <span class="font-mono text-slate-700 font-bold text-sm">{{ formatMataUang(hitungBiayaPerAnak(anak)) }}</span>
                </div>

                <div class="flex justify-between items-center pt-3 mt-3 border-t border-slate-200 text-sm">
                  <span class="font-bold text-slate-700">Total Pembayaran Bulan Pertama:</span>
                  <span class="font-black text-[#14a38b] tracking-wide text-base">{{ formatMataUang(totalTagihan) }}</span>
                </div>
              </div>
            </div>

            <!-- Payment Action -->
            <div v-if="!pembayaranLunas && pembayaranIdsMenunggu.length === 0" class="bg-[#14a38b]/5 border border-[#14a38b]/10 p-5 rounded-[12px] flex flex-col items-center text-center space-y-3">
              <CreditCard class="w-10 h-10 text-[#14a38b] animate-bounce" />
              <h4 class="text-base font-bold text-slate-800">Selesaikan Pembayaran via Midtrans</h4>
              <p class="text-xs text-slate-500 max-w-md leading-relaxed">
                Silakan klik tombol di bawah ini untuk menampilkan jendela pembayaran aman Midtrans Snap. Anda bisa membayar menggunakan QRIS, E-Wallet, atau Virtual Account Bank.
              </p>
              <button
                type="button"
                :disabled="sedangMemproses"
                class="px-4 py-2 border border-[#14a38b]/30 text-[#14a38b] font-semibold text-xs rounded-[10px] hover:bg-[#14a38b]/5 transition-colors bg-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                @click="unduhInvoice"
              >
                <Download class="w-3.5 h-3.5" /> Unduh Invoice
              </button>

              <div v-if="sedangMemproses" class="flex flex-col items-center gap-2">
                <div class="flex items-center gap-2 text-xs text-[#14a38b] font-semibold">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  <span>{{ progresBayarTeks || 'Memproses pembayaran...' }}</span>
                </div>
              </div>

              <div class="flex gap-3 justify-center w-full pt-1">
                <button
                  type="button"
                  :disabled="sedangMemproses"
                  class="px-6 py-2.5 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="langkahAktif = 3"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  :disabled="sedangMemproses"
                  class="px-8 py-2.5 rounded-[12px] bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  @click="bayarSnapMidtrans"
                >
                  {{ sedangMemproses ? 'Memproses...' : 'Bayar Sekarang' }}
                </button>
              </div>
            </div>

            <!-- Menunggu konfirmasi lambat: Midtrans SUDAH bilang sukses, webhook
                 kita belum sempat mengonfirmasi dalam batas waktu -- lihat catatan
                 lengkap di prosesPembayaranMidtrans() (midtransLayanan.ts). SENGAJA
                 bukan pesan error/gagal, dan TIDAK menawarkan "Bayar Sekarang" lagi. -->
            <div
              v-if="!pembayaranLunas && pembayaranIdsMenunggu.length > 0"
              class="bg-amber-50 border border-amber-200 p-5 rounded-[12px] flex flex-col items-center text-center space-y-3"
            >
              <Loader2 class="w-8 h-8 text-amber-600 animate-spin" />
              <h4 class="text-sm font-bold text-amber-900">Menunggu Konfirmasi Sistem</h4>
              <p class="text-xs text-amber-800 max-w-md leading-relaxed">
                Pembayaran Anda sudah dikonfirmasi berhasil oleh Midtrans. Sistem kami masih memproses konfirmasinya --
                ini bisa memakan waktu beberapa saat. Klik tombol di bawah untuk memeriksa ulang. Jangan membayar ulang.
              </p>
              <button
                type="button"
                :disabled="sedangMengecekStatus"
                class="px-6 py-2.5 rounded-[12px] bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                @click="cekUlangStatusPembayaran"
              >
                <Loader2 v-if="sedangMengecekStatus" class="w-4 h-4 animate-spin" />
                {{ sedangMengecekStatus ? 'Memeriksa...' : 'Cek Status Sekarang' }}
              </button>
            </div>

            <!-- Paid/Success Invoice view -->
            <div v-if="pembayaranLunas" class="space-y-6">
              <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-[12px] flex items-center gap-3.5 text-emerald-800">
                <CheckCircle class="w-8 h-8 text-emerald-600 flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-bold text-emerald-800">Pembayaran Sukses Terverifikasi!</h4>
                  <p class="text-xs text-emerald-600 mt-0.5 leading-relaxed">
                    Terima kasih, tagihan bulan pertama pendaftaran antar-jemput anak Anda telah lunas didebet secara real-time.
                  </p>
                </div>
              </div>

              <!-- Struk Pembayaran (tampil setelah pembayaran berhasil) -->
              <div class="bg-slate-50 border border-slate-100 p-5 md:p-6 rounded-[12px] space-y-5 shadow-xs relative">
                <div class="flex justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">STRUK PEMBAYARAN</h3>
                    <p class="text-[10px] text-slate-400 mt-0.5">No. Struk: {{ listAnak[0]?.idPesananMidtrans || '-' }}</p>
                  </div>
                  <div class="text-right">
                    <h3 class="text-xs font-black text-[#14a38b] tracking-tight">DenantaTS</h3>
                    <p class="text-[10px] text-slate-400 mt-0.5">Kota Padang, Sumatra Barat</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p class="text-slate-400">Diterbitkan Kepada:</p>
                    <p class="text-slate-700 font-bold mt-1">{{ namaOrangTua }}</p>
                    <p class="text-slate-500 mt-0.5">{{ waOrangTua }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-slate-400">Tanggal Bayar:</p>
                    <p class="text-slate-700 font-bold mt-1">{{ ambilWaktuSekarang().toLocaleDateString('id-ID') }}</p>
                    <span class="text-emerald-600 font-bold tracking-wider text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1">LUNAS - MIDTRANS</span>
                  </div>
                </div>

                <div class="border-t border-slate-200 pt-4">
                  <div class="flex justify-between text-xs font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1.5">
                    <span>Layanan Penjemputan</span>
                    <span>Total</span>
                  </div>
                  <div
                    v-for="anak in listAnak"
                    :key="anak.id"
                    class="flex justify-between text-xs text-slate-600 py-1"
                  >
                    <span>Layanan Antar Jemput untuk {{ anak.nama }}</span>
                    <span class="font-mono">{{ formatMataUang(hitungBiayaPerAnak(anak)) }}</span>
                  </div>
                  <div class="flex justify-between text-sm font-bold text-slate-700 border-t border-slate-200 pt-3 mt-3">
                    <span>Total Tagihan:</span>
                    <span class="text-[#14a38b] font-black text-base">{{ formatMataUang(totalTagihan) }}</span>
                  </div>
                </div>

                <div class="pt-2 flex justify-end">
                  <button
                    type="button"
                    class="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-[10px] hover:bg-slate-100 transition-colors bg-white cursor-pointer"
                    @click="unduhStruk"
                  >
                    Unduh Struk Pembayaran
                  </button>
                </div>
              </div>

              <!-- Button redirect to parents dashboard -- replace (bukan
                   RouterLink push biasa) supaya tombol back tidak membawa
                   pengguna balik ke layar sukses/wizard pembayaran ini. -->
              <div class="flex justify-center pt-2">
                <button
                  type="button"
                  @click="router.replace('/orangtua')"
                  class="inline-flex items-center gap-2 bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold py-3 px-8 rounded-[12px] transition-colors duration-200 shadow-xs border-0 cursor-pointer text-sm"
                >
                  Masuk ke Halaman Monitoring Anak
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


    <!-- ==========================================
    POPUP 1: MODAL RINGKASAN DATA (LANGKAH 2)
    ========================================== -->
    <ModalUtama
      tema="terang"
      :tampil="modalRingkasanTampil"
      judul="Ringkasan Formulir Berlangganan"
      ukuran="lebar"
      @tutup="modalRingkasanTampil = false"
    >
      <div class="space-y-6 text-sm text-slate-600 p-1">
        <p class="text-xs text-slate-400">
          Silakan periksa kembali kelayakan seluruh informasi pendaftaran di bawah ini sebelum melanjutkan ke pembayaran.
        </p>

        <!-- Orang Tua Info -->
        <div class="bg-slate-50 border border-slate-100 p-4 rounded-[12px] space-y-2 text-left">
          <h4 class="text-xs font-bold text-[#14a38b] uppercase tracking-wider">Detail Orang Tua / Wali</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <span class="text-slate-500">Nama Wali: <strong class="text-slate-700 font-bold">{{ namaOrangTua }}</strong></span>
            <span class="text-slate-500">No. WhatsApp: <strong class="text-slate-700 font-bold">{{ waOrangTua }}</strong></span>
          </div>
        </div>

        <!-- Anak List Info -->
        <div class="bg-slate-50 border border-slate-100 p-4 rounded-[12px] space-y-3 text-left">
          <h4 class="text-xs font-bold text-[#14a38b] uppercase tracking-wider">Detail Anak Sekolah</h4>
          <div class="space-y-3">
            <div
              v-for="(anak, idx) in listAnak"
              :key="anak.id"
              class="border-b border-slate-200/50 pb-2.5 last:border-b-0 text-xs space-y-1"
            >
              <p class="font-bold text-slate-800">{{ idx+1 }}. {{ anak.nama }} ({{ anak.sekolah }})</p>
              <p class="text-slate-500">Kelas: <span class="text-slate-700 font-semibold">{{ anak.kelas }}</span> | Layanan: <span class="text-slate-700 font-semibold capitalize">{{ anak.layanan.replace('_', ' ') }}</span> | Langganan: <span class="text-slate-700 font-semibold capitalize">{{ anak.jenisLangganan }}</span></p>
              <p class="text-slate-400 truncate">Titik Koordinat: <span class="text-slate-500 font-mono">({{ anak.lintangJemput.toFixed(5) }}, {{ anak.bujurJemput.toFixed(5) }})</span></p>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button 
          type="button"
          class="px-6 py-2.5 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm"
          @click="modalRingkasanTampil = false"
        >
          Batal / Koreksi
        </button>
        <button 
          type="button"
          class="px-6 py-2.5 rounded-[12px] bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="sedangMemproses" 
          @click="konfirmasiLanjutLangkah3"
        >
          {{ sedangMemproses ? 'Memproses...' : 'Konfirmasi & Lanjut Bayar' }}
        </button>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Anak -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusAnakTampil"
      judul="Konfirmasi Hapus Data Anak"
      ukuran="sedang"
      @tutup="modalHapusAnakTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-slate-800">
          Hapus data "{{ anakAkanDihapus?.nama }}" dari langganan ini?
        </h3>
        <p class="text-xs text-slate-500 leading-relaxed">
          Data yang sudah dihapus tidak dapat dikembalikan. Anda perlu mengisi ulang datanya dari awal jika berubah pikiran.
        </p>
      </div>

      <template #footer>
        <button
          type="button"
          class="px-6 py-2.5 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="sedangMemproses"
          @click="modalHapusAnakTampil = false"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-6 py-2.5 rounded-[12px] bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="sedangMemproses"
          @click="konfirmasiHapusAnak"
        >
          {{ sedangMemproses ? 'Menghapus...' : 'Ya, Hapus' }}
        </button>
      </template>
    </ModalUtama>
      </div>
    </main>
  </div>
</template>
