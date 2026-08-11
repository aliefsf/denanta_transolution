<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Download, AlertTriangle, FileText, Send, CalendarClock, CheckCircle2, RefreshCw, X, Trash2 } from 'lucide-vue-next';
import { supabase } from '../../layanan/supabase';
import { prosesPembayaranMidtrans } from '../../layanan/midtransLayanan';
import { formatMataUang } from '../../bantuan/formatMataUang';
import { unduhStrukPembayaran } from '../../bantuan/strukPdf';
import { unduhInvoice as unduhInvoicePdf } from '../../bantuan/invoicePdf';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import BadgeStatusPembayaran from './BadgeStatusPembayaran.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import {
  ajukanPenundaanPembayaran,
  ambilPenundaanPembayaran,
  buatPembayaranBulanBerikutnya,
  konfirmasiPembayaranBulanBerikutnya,
  unggahBuktiPenundaan,
  hapusPembayaran
} from '../../layanan/orangTuaLayanan';
import { ambilWaktuSekarang, ambilTanggalWibSekarang } from '../../bantuan/waktuSimulasi';
import type { PembayaranRow } from '../../tipe';

const router = useRouter();

const {
  anakList,
  langgananList,
  pembayaranList,
  profil,
  sedangMemuat,
  error: errorMuat,
  sudahDimuat,
  orangTuaId,
  muatSemua,
  muatPembayaran
} = useDataOrangTua();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

onMounted(async () => {
  if (!sudahDimuat.value) await muatSemua();
});

// ==========================================
// Reaktivasi Akun Tidak Aktif (langganan berakhir -- bulanan maupun harian)
// ==========================================
// Langganan TERKINI per anak (bukan pembayaran) -- diambil yang tanggal_berakhir
// paling jauh ke depan, konsisten dengan cara ambilStatusLanggananWizard()
// menentukan status di berlangganganLayanan.ts.
const langgananTerkiniByAnakId = computed(() => {
  const peta = new Map<string, (typeof langgananList.value)[number]>();
  for (const l of langgananList.value) {
    const ada = peta.get(l.anak_id);
    if (!ada || l.tanggal_berakhir > ada.tanggal_berakhir) peta.set(l.anak_id, l);
  }
  return peta;
});

const hariIniIso = ambilTanggalWibSekarang();

// Anak yang langganannya belum lunas ATAU sudah lewat tanggal_berakhir --
// inilah yang perlu dibayar ulang supaya akun aktif kembali.
const anakPerluDiaktifkan = computed(() => {
  return anakList.value.filter((a) => {
    const l = langgananTerkiniByAnakId.value.get(a.id);
    return !(l && l.sudah_dibayar && l.tanggal_berakhir >= hariIniIso);
  });
});

// Anak yang TIDAK PERNAH punya baris langganan lunas sama sekali (baru
// didaftarkan, pembayaran pertamanya belum/gagal diselesaikan) harus dapat
// pesan yang berbeda dari anak yang langganannya SUDAH PERNAH lunas lalu
// kedaluwarsa -- "langganan sudah berakhir" salah/membingungkan kalau anak
// itu belum pernah berlangganan sama sekali.
const pernahBerlanggananByAnakId = computed(() => {
  const set = new Set<string>();
  for (const l of langgananList.value) {
    if (l.sudah_dibayar) set.add(l.anak_id);
  }
  return set;
});

const anakBelumPernahBayar = computed(() =>
  anakPerluDiaktifkan.value.filter((a) => !pernahBerlanggananByAnakId.value.has(a.id))
);
const anakLanggananBerakhir = computed(() =>
  anakPerluDiaktifkan.value.filter((a) => pernahBerlanggananByAnakId.value.has(a.id))
);

const totalTagihanReaktivasi = computed(() =>
  anakPerluDiaktifkan.value.reduce((sum, a) => {
    const l = langgananTerkiniByAnakId.value.get(a.id);
    return sum + (l ? Number(l.biaya_bulanan) : 0);
  }, 0)
);

// Klik "Selesaikan Pembayaran" mengarahkan ke wizard /berlangganan?tambah=1
// (alur "Tambah Anak" yang sama dipakai dari Pantau Anak) alih-alih modal
// pembayaran custom -- supaya tampilan "Rincian & Pembayaran Tagihan" (item
// tagihan per anak, Unduh Invoice, Bayar Sekarang via Midtrans Snap) SAMA
// PERSIS dengan Langkah 4 wizard, bukan duplikat UI yang berbeda tampilan.
// AMAN dipakai juga utk anak yang langganannya sudah PERNAH lunas lalu
// kedaluwarsa (bukan cuma anak yang belum pernah bayar sama sekali) --
// bayarSnapMidtrans() di HalamanBerlangganan.vue memanggil ulang
// buatAtauPerbaruiLanggananDanPembayaran() (idempoten) tepat sebelum
// transaksi dibuat, jadi tanggal_mulai/tanggal_berakhir baris langganan
// selalu disegarkan dari titik pembayaran ini, bukan dari tanggal draft lama.
const lanjutkanPembayaran = () => {
  if (anakPerluDiaktifkan.value.length === 0) return;
  router.push({ path: '/berlangganan', query: { tambah: '1' } });
};

// Label jenis tagihan -- ditampilkan sebagai kolom tersendiri di tabel
// supaya biaya langganan bulanan, langganan harian, dan biaya tambahan
// perubahan jadwal (jadwal berbeda) jelas terlihat berbeda, tidak tercampur
// jadi satu tampilan generik "tagihan bulan X".
const labelJenisTagihan: Record<string, string> = {
  bulanan: 'Langganan Bulanan',
  harian: 'Langganan Harian',
  tambahan: 'Biaya Tambahan (Jadwal Berbeda)',
  pembatalan: 'Pembatalan'
};

const daftarTagihan = computed(() =>
  pembayaranList.value.map((p: PembayaranRow) => ({
    id: p.id,
    jenis: labelJenisTagihan[p.tipe_pembayaran] ?? p.tipe_pembayaran,
    bulan: new Date(p.dibuat_pada).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    total: Number(p.jumlah),
    status: p.status,
    tglBayar: p.tanggal_pembayaran
  }))
);

// Unduh invoice (PDF) -- utk tagihan yang BELUM 'lunas'. jatuhTempoTerdekat
// dipakai sbg perkiraan tanggal jatuh tempo (dihitung di bawah, dari
// tanggal_jatuh_tempo langganan yang paling dekat).
const unduhInvoice = (tag: { id: string; bulan: string; total: number }) => {
  unduhInvoicePdf({
    nomorInvoice: tag.id.slice(0, 8).toUpperCase(),
    namaOrangTua: profil.value?.pengguna.nama_lengkap || 'Orang Tua',
    kontakOrangTua: profil.value?.pengguna.nomor_telepon,
    tanggalTerbit: ambilWaktuSekarang().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    tanggalJatuhTempo: jatuhTempoTerdekat.value,
    items: [{ label: `Tagihan Layanan Antar Jemput - ${tag.bulan}`, jumlah: tag.total }],
    total: tag.total
  });
  picuToast('Invoice berhasil diunduh!', 'sukses');
};

// Unduh struk pembayaran (PDF) -- hanya utk tagihan yang sudah 'lunas'.
const unduhStruk = (tag: { id: string; bulan: string; total: number; tglBayar: string | null }) => {
  unduhStrukPembayaran({
    nomorStruk: tag.id.slice(0, 8).toUpperCase(),
    namaOrangTua: profil.value?.pengguna.nama_lengkap || 'Orang Tua',
    kontakOrangTua: profil.value?.pengguna.nomor_telepon,
    tanggalBayar: tag.tglBayar
      ? new Date(tag.tglBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-',
    items: [{ label: `Tagihan Layanan Antar Jemput - ${tag.bulan}`, jumlah: tag.total }],
    total: tag.total,
    metode: 'Midtrans'
  });
  picuToast('Struk pembayaran berhasil diunduh!', 'sukses');
};

// Hapus tagihan (hanya untuk tagihan yang belum lunas).
const modalHapusTampil = ref(false);
const tagihanAkanDihapus = ref<{ id: string; jenis: string; bulan: string } | null>(null);
const sedangMenghapusTagihan = ref(false);

const bukaModalHapus = (tag: { id: string; jenis: string; bulan: string }) => {
  tagihanAkanDihapus.value = tag;
  modalHapusTampil.value = true;
};

const konfirmasiHapusTagihan = async () => {
  if (!tagihanAkanDihapus.value) return;
  sedangMenghapusTagihan.value = true;
  try {
    await hapusPembayaran(tagihanAkanDihapus.value.id);
    pembayaranList.value = pembayaranList.value.filter((p: PembayaranRow) => p.id !== tagihanAkanDihapus.value?.id);
    picuToast('Tagihan berhasil dihapus.', 'sukses');
    modalHapusTampil.value = false;
    tagihanAkanDihapus.value = null;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus tagihan.', 'error');
  } finally {
    sedangMenghapusTagihan.value = false;
  }
};

const labelBulanTahunBerjalan = computed(() => ambilWaktuSekarang().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));

// PENTING: kedua computed di bawah HARUS memakai langgananTerkiniByAnakId
// (baris langganan TERKINI per anak), bukan langgananList mentah -- akun
// yang sudah beberapa kali membayar/memperpanjang punya banyak baris
// langganan historis per anak (satu per periode), dan langgananList berisi
// SEMUANYA. Sebelumnya kedua computed ini memakai langgananList langsung,
// jadi tanggal jatuh tempo & tarif dasar tidak pernah "lupa" siklus lama --
// begitu langganan diperpanjang lewat "Lanjutkan Langganan" (baris baru
// dibuat, lihat aktifkanKembaliLangganan), tanggal jatuh tempo siklus LAMA
// yang sudah lunas tetap ikut dihitung dan (karena paling awal) selalu
// "menang" di sort ascending -- notifikasi jatuh tempo jadi permanen basi,
// tidak pernah memperbarui diri walau pembayaran baru sudah berhasil.
const tarifDasarLangganan = computed(() =>
  Array.from(langgananTerkiniByAnakId.value.values()).reduce((sum, l) => sum + Number(l.biaya_bulanan), 0)
);

// SEBELUMNYA menjumlahkan SEMUA baris `pembayaran` berstatus 'lunas' yang
// kebetulan dibuat di bulan kalender ini -- ini keliru untuk kartu
// "Ringkasan Billing Berjalan": kalau bulan ini kebetulan ada
// lebih dari satu transaksi lunas (mis. percobaan bayar ulang karena
// gerbang Midtrans sempat gagal/lambat, atau biaya tambahan perubahan
// jadwal terpisah), semuanya ikut terjumlah jadi "Total Pembayaran Lunas"
// yang jauh lebih besar dari tarif langganan sebenarnya -- padahal kartu
// ini seharusnya menunjukkan tagihan SIKLUS LANGGANAN AKTIF saat ini saja,
// bukan akumulasi seluruh transaksi bulan ini. Sekarang disaring memakai
// langganan_id dari langgananTerkiniByAnakId (siklus terkini per anak,
// SAMA PERSIS dgn dasar perhitungan tarifDasarLangganan di atas) DAN hanya
// tipe_pembayaran langganan sungguhan ('bulanan'/'harian') -- 'tambahan'
// (biaya perubahan jadwal) dan 'pembatalan' sengaja tidak ikut, itu bukan
// bagian dari tagihan langganan pokok.
const idLanggananTerkini = computed(() => new Set(Array.from(langgananTerkiniByAnakId.value.values()).map((l) => l.id)));
const totalLunasBulanIni = computed(() =>
  pembayaranList.value
    .filter((p) =>
      p.status === 'lunas' &&
      p.langganan_id !== null &&
      idLanggananTerkini.value.has(p.langganan_id) &&
      (p.tipe_pembayaran === 'bulanan' || p.tipe_pembayaran === 'harian')
    )
    .reduce((sum, p) => sum + Number(p.jumlah), 0)
);

const tanggalJatuhTempoRaw = computed<Date | null>(() => {
  const tanggalList = Array.from(langgananTerkiniByAnakId.value.values())
    .map((l) => l.tanggal_jatuh_tempo)
    .filter(Boolean)
    .sort();
  if (tanggalList.length === 0) return null;
  return new Date(tanggalList[0]);
});

const jatuhTempoTerdekat = computed(() => {
  if (!tanggalJatuhTempoRaw.value) return null;
  return tanggalJatuhTempoRaw.value.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
});

function selisihHari(target: Date): number {
  const sekarang = ambilWaktuSekarang();
  const awalHariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  const awalTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((awalTarget.getTime() - awalHariIni.getTime()) / 86400000);
}

// Revisi Panel Pengguna #6: tombol "Ajukan Penundaan Pembayaran" hanya
// muncul begitu memasuki H-7 sebelum jatuh tempo (termasuk sudah lewat).
// Sebelum itu, info deadline tetap tampil tapi tombolnya belum tersedia.
const hariMenujuJatuhTempo = computed(() => (tanggalJatuhTempoRaw.value ? selisihHari(tanggalJatuhTempoRaw.value) : null));
const sudahMasukH7 = computed(() => hariMenujuJatuhTempo.value !== null && hariMenujuJatuhTempo.value <= 7);

// Revisi Panel Pengguna #7: "Bayar Bulan Berikutnya" -- aktif mulai H-7
// sebelum tanggal_jatuh_tempo SIKLUS YANG SEDANG BERJALAN itu sendiri
// (SAMA PERSIS dengan gerbang "Ajukan Penundaan Pembayaran" di atas,
// sudahMasukH7/tanggalJatuhTempoRaw) -- BUKAN H-7 sebelum tanggal setahun
// bulan berikutnya seperti sebelumnya (itu salah: kalau siklus berjalan
// berakhir 31 Agustus, tombol harus muncul mulai 24 Agustus, bukan
// menunggu sampai 23 September/H-7 dari 30 September). Periode yang
// DIBAYAR tetap periode BERIKUTNYA (bulan setelah tanggal_jatuh_tempo),
// cuma gerbang kapan tombolnya muncul yang diperbaiki.
const periodeBulanBerikutnyaIso = computed(() => {
  if (!tanggalJatuhTempoRaw.value) return null;
  const acuan = tanggalJatuhTempoRaw.value;
  const d = new Date(acuan.getFullYear(), acuan.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
});

const namaBulanBerikutnya = computed(() => {
  if (!periodeBulanBerikutnyaIso.value) return '';
  return new Date(`${periodeBulanBerikutnyaIso.value}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
});

// Tombol hanya boleh tampil kalau: (1) sudah H-7 tanggal_jatuh_tempo siklus
// berjalan, DAN (2) langganannya MASIH AKTIF (bukan sudah kedaluwarsa --
// itu kasusnya "Lanjutkan Langganan"/reaktivasi, banner terpisah di atas).
const sudahMasukH7Berikutnya = computed(() => sudahMasukH7.value && anakPerluDiaktifkan.value.length === 0);

const sudahBayarBulanBerikutnya = computed(() =>
  !!periodeBulanBerikutnyaIso.value &&
  pembayaranList.value.some((p) => p.periode_bulan === periodeBulanBerikutnyaIso.value && p.status === 'lunas')
);

const sedangMemprosesBayarBerikutnya = ref(false);
const progresBayarBerikutnyaTeks = ref('');

const bayarBulanBerikutnya = async () => {
  if (!orangTuaId.value || !periodeBulanBerikutnyaIso.value || langgananTerkiniByAnakId.value.size === 0) return;
  sedangMemprosesBayarBerikutnya.value = true;
  try {
    // Kumpulkan dulu pembayaranId seluruh anak -- baru dilunasi lewat SATU
    // transaksi Snap gabungan (Pembayaran Gabungan Multi-Anak), bukan
    // satu-satu per anak. Lihat catatan lengkap di prosesPembayaranMidtrans
    // (midtransLayanan.ts).
    const antrianId: string[] = [];

    for (const langganan of langgananTerkiniByAnakId.value.values()) {
      const pembayaran = await buatPembayaranBulanBerikutnya({
        langgananId: langganan.id,
        orangTuaId: orangTuaId.value,
        jumlah: Number(langganan.biaya_bulanan),
        periodeBulan: periodeBulanBerikutnyaIso.value
      });
      if (pembayaran.status === 'lunas') continue;

      if (!supabase) {
        // Fallback mode simulasi lokal (Supabase tidak dikonfigurasi)
        await konfirmasiPembayaranBulanBerikutnya(pembayaran.id, langganan.id);
        continue;
      }

      antrianId.push(pembayaran.id);
    }

    if (antrianId.length > 0) {
      const label = antrianId.length > 1 ? `${antrianId.length} Anak` : '';
      const hasilAkhir = await prosesPembayaranMidtrans(antrianId, {
        onProgres: (teks) => { progresBayarBerikutnyaTeks.value = label ? `${teks} (${label})` : teks; }
      });

      if (hasilAkhir === 'batal') {
        picuToast('Pembayaran belum selesai. Klik "Bayar Bulan Berikutnya" lagi untuk mencoba lagi.', 'info');
        return;
      }
      if (hasilAkhir === 'gagal') {
        picuToast('Pembayaran gagal/dibatalkan oleh Midtrans. Silakan coba lagi.', 'error');
        return;
      }
    }
    // muatSemua() (bukan cuma muatPembayaran()) -- pembayaran periode
    // berikutnya sekarang JUGA memperpanjang tanggal_berakhir langganan
    // (lihat konfirmasiPembayaranBulanBerikutnya/midtrans-webhook), jadi
    // langgananList harus ikut disegarkan supaya tanggal jatuh tempo yang
    // ditampilkan di banner langsung mencerminkan periode yang baru.
    await muatSemua();
    picuToast(`Pembayaran untuk periode ${namaBulanBerikutnya.value} berhasil dikonfirmasi! Langganan Anda sudah diperpanjang.`, 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memproses pembayaran bulan berikutnya.', 'error');
  } finally {
    progresBayarBerikutnyaTeks.value = '';
    sedangMemprosesBayarBerikutnya.value = false;
  }
};

// State Request Penundaan
const modalPenundaanTampil = ref(false);
const alasanPenundaan = ref('');
const statusPenundaan = ref<'tidak_ada' | 'menunggu' | 'disetujui' | 'ditolak'>('tidak_ada');
const sedangMengajukan = ref(false);

// Bukti (OPSIONAL) -- screenshot mutasi/slip gaji, dsb. Tidak wajib diisi,
// pengajuan tetap bisa dikirim tanpa lampiran (lihat validasi di
// ajukanPenundaan() di bawah -- hanya alasan yang wajib).
const fileBuktiPenundaan = ref<File | null>(null);
const namaFileBuktiPenundaan = ref('');
const errorBuktiPenundaan = ref('');

const pilihFileBukti = (e: Event) => {
  errorBuktiPenundaan.value = '';
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) {
    fileBuktiPenundaan.value = null;
    namaFileBuktiPenundaan.value = '';
    return;
  }
  const jenisDiizinkan = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (!jenisDiizinkan.includes(file.type)) {
    errorBuktiPenundaan.value = 'Format file harus PNG, JPG, atau PDF.';
    fileBuktiPenundaan.value = null;
    namaFileBuktiPenundaan.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    errorBuktiPenundaan.value = 'Ukuran file maksimal 5 MB.';
    fileBuktiPenundaan.value = null;
    namaFileBuktiPenundaan.value = '';
    return;
  }
  fileBuktiPenundaan.value = file;
  namaFileBuktiPenundaan.value = file.name;
};

const hapusFileBukti = () => {
  fileBuktiPenundaan.value = null;
  namaFileBuktiPenundaan.value = '';
  errorBuktiPenundaan.value = '';
};

onMounted(async () => {
  if (!orangTuaId.value) return;
  try {
    const daftarPenundaan = await ambilPenundaanPembayaran(orangTuaId.value);
    const terbaru = daftarPenundaan[0];
    if (terbaru) {
      statusPenundaan.value = terbaru.status;
      alasanPenundaan.value = terbaru.alasan;
    }
  } catch {
    // Biarkan status default 'tidak_ada' bila gagal memuat
  }
});

const ajukanPenundaan = async () => {
  if (!alasanPenundaan.value) {
    picuToast('Alasan penundaan wajib diisi!', 'error');
    return;
  }
  if (!orangTuaId.value) return;

  sedangMengajukan.value = true;
  try {
    // Tombol ini hanya tampil begitu masuk H-7 menuju tanggal_jatuh_tempo
    // siklus BERJALAN yang sudah lunas (lihat sudahMasukH7) -- pada titik
    // itu belum tentu ada baris `pembayaran` berstatus 'menunggu' sama
    // sekali, karena tagihan periode BERIKUTNYA memang belum pernah dibuat
    // (sistem ini tidak punya cron yang otomatis menerbitkan invoice bulan
    // depan). Sebelum mengajukan penundaan, pastikan dulu tagihan periode
    // berikutnya ADA -- pakai fungsi idempoten yang sama dengan tombol
    // "Bayar Bulan Berikutnya" (buatPembayaranBulanBerikutnya), supaya
    // penundaan yang diajukan benar-benar menunda tagihan nyata, bukan
    // gagal karena kebetulan belum ada baris yang bisa ditunda.
    let pembayaranTertunggak = pembayaranList.value.find((p) => p.status === 'menunggu');
    if (!pembayaranTertunggak && periodeBulanBerikutnyaIso.value) {
      for (const langganan of langgananTerkiniByAnakId.value.values()) {
        const pembayaran = await buatPembayaranBulanBerikutnya({
          langgananId: langganan.id,
          orangTuaId: orangTuaId.value,
          jumlah: Number(langganan.biaya_bulanan),
          periodeBulan: periodeBulanBerikutnyaIso.value
        });
        if (pembayaran.status === 'menunggu' && !pembayaranTertunggak) pembayaranTertunggak = pembayaran;
      }
      await muatPembayaran();
    }

    if (!pembayaranTertunggak) {
      picuToast('Tidak ada tagihan yang menunggu pembayaran untuk ditunda.', 'error');
      return;
    }

    // Bukti bersifat OPSIONAL -- kalau ada file yang dipilih, unggah dulu
    // sebelum menyimpan pengajuan; kalau tidak, lewati saja tanpa lampiran.
    let buktiUrl: string | null = null;
    if (fileBuktiPenundaan.value) {
      buktiUrl = await unggahBuktiPenundaan(orangTuaId.value, fileBuktiPenundaan.value);
    }

    await ajukanPenundaanPembayaran({
      pembayaranId: pembayaranTertunggak.id,
      orangTuaId: orangTuaId.value,
      alasan: alasanPenundaan.value,
      buktiUrl
    });
    statusPenundaan.value = 'menunggu';
    modalPenundaanTampil.value = false;
    hapusFileBukti();
    picuToast('Pengajuan penundaan pembayaran berhasil dikirim ke Admin. Status WhatsApp akan dikirimkan segera.', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal mengajukan penundaan pembayaran.', 'error');
  } finally {
    sedangMengajukan.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 relative min-h-[200px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuat" pesan="Memuat data pembayaran..." />

    <!-- Toast Alert -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="toastTampil = false"
    />

    <div>
      <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Histori & Administrasi Pembayaran</h1>
      <p class="text-xs text-on-surface-variant">Kelola riwayat tagihan bulanan dan pengajuan penangguhan biaya.</p>
    </div>

    <div v-if="errorMuat" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ errorMuat }}
    </div>

    <!-- 0. Banner Reaktivasi: akun tidak aktif karena langganan berakhir
         (bulanan maupun harian) dan belum dilanjutkan pembayarannya. -->
    <div
      v-if="anakPerluDiaktifkan.length > 0"
      class="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 soft-shadow text-xs"
    >
      <div class="flex items-start gap-3">
        <RefreshCw class="w-8 h-8 text-rose-600 flex-shrink-0 mt-0.5" />
        <div class="space-y-1 text-rose-800">
          <h4 class="font-bold text-rose-900 text-sm">Layanan Tidak Aktif</h4>
          <p v-if="anakBelumPernahBayar.length > 0" class="leading-relaxed">
            <strong>{{ anakBelumPernahBayar.map((a) => a.nama_lengkap).join(', ') }}</strong> belum menjadi pelanggan aktif karena pembayaran pertama belum diselesaikan.
          </p>
          <p v-if="anakLanggananBerakhir.length > 0" class="leading-relaxed">
            Langganan untuk <strong>{{ anakLanggananBerakhir.map((a) => a.nama_lengkap).join(', ') }}</strong> sudah berakhir.
          </p>
          <p class="leading-relaxed">
            Selesaikan pembayaran sebesar <strong class="text-rose-900">{{ formatMataUang(totalTagihanReaktivasi) }}</strong>
            untuk mengaktifkan seluruh fitur layanan.
          </p>
        </div>
      </div>

      <div class="w-full md:w-auto flex-shrink-0">
        <TombolUtama
          tema="terang"
          varian="utama"
          class="w-full text-[11px] py-2 bg-rose-600 hover:bg-rose-700"
          @click="lanjutkanPembayaran"
        >
          Selesaikan Pembayaran
        </TombolUtama>
      </div>
    </div>

    <!-- 1. Deadline Alert Banner -->
    <div v-if="jatuhTempoTerdekat" class="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 soft-shadow text-xs">
      <div class="flex items-start gap-3">
        <AlertTriangle class="w-8 h-8 text-amber-600 flex-shrink-0 mt-0.5" />
        <div class="space-y-1 text-amber-800">
          <h4 class="font-bold text-amber-900 text-sm">Pemberitahuan Batas Pembayaran Bulanan</h4>
          <p class="leading-relaxed">
            Pembayaran langganan Anda jatuh tempo pada tanggal <strong>{{ jatuhTempoTerdekat }}</strong>. Peringatan jatuh tempo otomatis akan dikirim ke WhatsApp Anda.
          </p>
        </div>
      </div>

      <!-- Penundaan Trigger Button: hanya tampil mulai H-7 sebelum jatuh tempo -->
      <div v-if="statusPenundaan === 'tidak_ada' && sudahMasukH7" class="w-full md:w-auto">
        <TombolUtama tema="terang" varian="garis-luar" class="w-full text-[11px] py-2" @click="modalPenundaanTampil = true">
          Ajukan Penundaan Pembayaran
        </TombolUtama>
      </div>
      <p v-else-if="statusPenundaan === 'tidak_ada'" class="text-[10px] text-amber-700 italic w-full md:w-auto md:text-right">
        Opsi penundaan pembayaran tersedia mulai H-7 sebelum jatuh tempo.
      </p>
    </div>

    <!-- Bayar Bulan Berikutnya: aktif mulai H-7 sebelum jatuh tempo bulan depan -->
    <div
      v-if="sudahMasukH7Berikutnya"
      class="bg-primary-container/15 border border-primary/20 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 soft-shadow text-xs"
    >
      <div class="flex items-start gap-3">
        <CalendarClock class="w-8 h-8 text-primary flex-shrink-0 mt-0.5" />
        <div class="space-y-1 text-on-surface-variant">
          <h4 class="font-bold text-on-surface text-sm">Pembayaran Bulan Berikutnya Tersedia</h4>
          <p class="leading-relaxed">
            Anda dapat membayar lebih awal untuk periode <strong>{{ namaBulanBerikutnya }}</strong>
            sebesar <strong class="text-primary">{{ formatMataUang(tarifDasarLangganan) }}</strong>.
          </p>
        </div>
      </div>

      <div class="w-full md:w-auto">
        <span v-if="sudahBayarBulanBerikutnya" class="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] justify-center py-2">
          <CheckCircle2 class="w-4 h-4" /> Sudah Dibayar
        </span>
        <TombolUtama
          v-else
          tema="terang"
          varian="utama"
          class="w-full text-[11px] py-2"
          :nonaktif="sedangMemprosesBayarBerikutnya"
          @click="bayarBulanBerikutnya"
        >
          {{ sedangMemprosesBayarBerikutnya ? 'Memproses...' : 'Bayar Bulan Berikutnya' }}
        </TombolUtama>
      </div>
    </div>

    <!-- Status Tracking Penundaan if submitted -->
    <div
      v-if="statusPenundaan !== 'tidak_ada'"
      class="p-4 rounded-xl border flex items-center justify-between text-xs"
      :class="{
        'bg-amber-50 border-amber-200 text-amber-700': statusPenundaan === 'menunggu',
        'bg-emerald-50 border-emerald-200 text-emerald-700': statusPenundaan === 'disetujui',
        'bg-rose-50 border-rose-200 text-rose-700': statusPenundaan === 'ditolak'
      }"
    >
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-current animate-ping"></span>
        <span>
          Status Pengajuan Penundaan:
          <strong class="uppercase font-mono">{{ statusPenundaan }}</strong>
          <span v-if="statusPenundaan === 'menunggu'"> (Alasan: "{{ alasanPenundaan }}")</span>
          <span v-if="statusPenundaan === 'ditolak'"> (Layanan dinonaktifkan otomatis oleh Admin)</span>
        </span>
      </div>
    </div>

    <!-- Main Grid: Billing Summary and Past Invoices -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Table of Invoices (2 Columns) -->
      <div class="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden soft-shadow">
        <div class="p-4 border-b border-outline-variant/20">
          <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Daftar Faktur (Invoices)</h3>
        </div>
        <div v-if="!sedangMemuat && daftarTagihan.length === 0" class="p-8 text-center text-on-surface-variant text-xs italic">
          Belum ada riwayat tagihan.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-surface-container border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Nomor Invoice</th>
                <th class="py-3 px-4">Jenis Tagihan</th>
                <th class="py-3 px-4">Bulan Layanan</th>
                <th class="py-3 px-4">Jumlah Tagihan</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/15 text-on-surface-variant">
              <tr v-for="tag in daftarTagihan" :key="tag.id" class="hover:bg-surface-container/40 transition-colors">
                <td class="py-4 px-4 font-mono font-bold text-on-surface uppercase">{{ tag.id.slice(0, 8) }}</td>
                <td class="py-4 px-4">{{ tag.jenis }}</td>
                <td class="py-4 px-4 font-semibold">{{ tag.bulan }}</td>
                <td class="py-4 px-4 font-mono text-primary font-extrabold">{{ formatMataUang(tag.total) }}</td>
                <td class="py-4 px-4">
                  <BadgeStatusPembayaran :status="tag.status" />
                </td>
                <td class="py-4 px-4 text-right">
                  <!-- Sebelum lunas: unduh invoice (tagihan yang harus dibayar).
                       Setelah lunas: invoice tidak relevan lagi, diganti bukti
                       pembayaran (kuitansi transaksi yang sudah selesai). -->
                  <div v-if="tag.status !== 'lunas'" class="inline-flex items-center gap-1.5">
                    <button
                      @click="unduhInvoice(tag)"
                      class="text-primary hover:text-primary/80 p-2 border border-outline-variant/30 rounded-xl hover:bg-surface-container transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                    >
                      <Download class="w-3.5 h-3.5" /> Unduh Invoice
                    </button>
                    <button
                      @click="bukaModalHapus(tag)"
                      title="Hapus Tagihan"
                      class="text-rose-600 hover:text-rose-700 p-2 border border-rose-200 rounded-xl hover:bg-rose-50 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    v-else
                    @click="unduhStruk(tag)"
                    class="text-emerald-700 hover:text-emerald-800 p-2 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" /> Unduh Struk Pembayaran
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Billing Overview Box (1 Column) -->
      <div class="space-y-6">
        <KartuUtama tema="terang" judul="Ringkasan Billing Berjalan" :subjudul="labelBulanTahunBerjalan">
          <div class="space-y-4 text-xs">
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Total Anak Terdaftar:</span>
              <span class="text-on-surface font-bold">{{ anakList.length }} Siswa</span>
            </div>
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Tarif Dasar Langganan:</span>
              <span class="text-on-surface font-bold">{{ formatMataUang(tarifDasarLangganan) }}</span>
            </div>
            <div class="flex justify-between border-b border-outline-variant/20 pb-2">
              <span class="text-on-surface-variant">Diskon Promosi:</span>
              <span class="text-emerald-600 font-bold">- Rp 0</span>
            </div>
            <div class="flex justify-between pt-2">
              <span class="text-on-surface font-bold">Total Pembayaran Lunas:</span>
              <span class="text-primary font-black text-sm">{{ formatMataUang(totalLunasBulanIni) }}</span>
            </div>

            <div class="flex gap-2 text-[10px] text-on-surface-variant leading-relaxed bg-surface-container p-3 rounded-lg border border-outline-variant/20 mt-2">
              <FileText class="w-4 h-4 text-primary flex-shrink-0" />
              <span>
                Faktur resmi diterbitkan otomatis setiap awal bulan, sistem terintegrasi pembayaran digital instant.
              </span>
            </div>
          </div>
        </KartuUtama>
      </div>

    </div>

    <!-- Modal Form Penundaan Pembayaran -->
    <ModalUtama
      tema="terang"
      :tampil="modalPenundaanTampil"
      judul="Ajukan Penundaan Pembayaran Langganan"
      @tutup="modalPenundaanTampil = false"
    >
      <div class="space-y-4 text-xs">
        <p class="text-on-surface-variant leading-relaxed">
          Silakan ajukan penundaan pembayaran dengan mengisi alasan penundaan yang jelas. Admin akan meninjau dan mengirimkan konfirmasi.
        </p>

        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Alasan Penundaan Pembayaran (Wajib):</label>
          <textarea
            rows="3"
            v-model="alasanPenundaan"
            required
            placeholder="Mohon maaf, gajian bulanan mengalami kemunduran s.d. tanggal 10..."
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          ></textarea>
        </div>

        <div class="space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Bukti Pendukung (Opsional):</label>
          <div v-if="!namaFileBuktiPenundaan" class="relative">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              @change="pilihFileBukti"
              class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-container file:mr-3 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:bg-primary-container/30 file:text-primary file:text-[10px] file:font-bold file:cursor-pointer cursor-pointer"
            />
          </div>
          <div v-else class="flex items-center justify-between gap-2 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl">
            <span class="text-on-surface truncate">{{ namaFileBuktiPenundaan }}</span>
            <button
              type="button"
              @click="hapusFileBukti"
              class="text-rose-500 hover:text-rose-600 p-1 rounded-full border-0 bg-transparent cursor-pointer flex-shrink-0"
              title="Hapus file"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
          <p v-if="errorBuktiPenundaan" class="text-[10px] text-rose-600">{{ errorBuktiPenundaan }}</p>
          <p v-else class="text-[10px] text-on-surface-variant">Format PNG/JPG/PDF, maksimal 5 MB. Mis. screenshot mutasi rekening atau slip gaji.</p>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalPenundaanTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="gap-1.5" :nonaktif="sedangMengajukan" @click="ajukanPenundaan">
          {{ sedangMengajukan ? 'Mengirim...' : 'Kirim Pengajuan' }}
          <Send class="w-3.5 h-3.5" />
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Tagihan -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Hapus Tagihan"
      @tutup="modalHapusTampil = false"
    >
      <p class="text-xs text-on-surface-variant leading-relaxed">
        Yakin ingin menghapus tagihan <span class="font-bold text-on-surface">{{ tagihanAkanDihapus?.jenis }} - {{ tagihanAkanDihapus?.bulan }}</span>? Tindakan ini tidak dapat dibatalkan.
      </p>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapusTagihan" @click="modalHapusTampil = false">
          Batal
        </TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="!bg-rose-600 hover:!bg-rose-700 gap-1.5" :nonaktif="sedangMenghapusTagihan" @click="konfirmasiHapusTagihan">
          {{ sedangMenghapusTagihan ? 'Menghapus...' : 'Ya, Hapus Tagihan' }}
          <Trash2 class="w-3.5 h-3.5" />
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
