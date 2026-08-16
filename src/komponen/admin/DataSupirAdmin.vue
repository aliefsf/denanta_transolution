<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Plus, Trash2, Eye, Pencil, Loader2, Upload, AlertTriangle, User } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import {
  ambilDaftarSupir,
  buatAkunSupir,
  unggahDokumenSupir,
  perbaruiSupir,
  perbaruiFotoProfilSupir,
  perbaruiStatusVerifikasiSupir,
  togglAktifSupir,
  hapusSupir as hapusSupirLayanan,
  type SupirDenganPengguna
} from '../../layanan/adminLayanan';
import { unggahFotoProfilSupir } from '../../layanan/supirLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';

const JENIS_KENDARAAN_DASAR = ['Toyota HiAce', 'Isuzu Elf', 'Suzuki Carry'];
const OPSI_LAINNYA = '__lainnya__';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const listSupir = ref<SupirDenganPengguna[]>([]);
const sedangMemuat = ref(true);

const muatDaftarSupir = async () => {
  sedangMemuat.value = true;
  try {
    listSupir.value = await denganBatasWaktu(ambilDaftarSupir(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar supir.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime: refetch begitu ada perubahan pada tabel `supir` (verifikasi,
// aktif/nonaktif, dokumen) ATAU `pengguna` (nama/telepon) -- daftar
// mentah ini melibatkan join keduanya, jadi refetch penuh lebih sederhana
// & aman dibanding patch in-place per kolom. Event-driven (BUKAN interval).
let saluranSupir: { unsubscribe: () => void } | null = null;
let saluranPengguna: { unsubscribe: () => void } | null = null;

onMounted(() => {
  muatDaftarSupir();
  saluranSupir = pantauTabelAdminRealtime('supir', muatDaftarSupir);
  saluranPengguna = pantauTabelAdminRealtime('pengguna', muatDaftarSupir);
});

onUnmounted(() => {
  saluranSupir?.unsubscribe();
  saluranSupir = null;
  saluranPengguna?.unsubscribe();
  saluranPengguna = null;
});

// Modals State
const modalDetailTampil = ref(false);
const supirTerpilih = ref<SupirDenganPengguna | null>(null);

// Modal Tambah Supir
const modalTambahTampil = ref(false);
const sedangMenyimpan = ref(false);
const formEmail = ref('');
const formPassword = ref('');
const formNama = ref('');
const formTelepon = ref('');
const formKendaraan = ref('Toyota HiAce');
const formKendaraanLainnya = ref('');
const formPlat = ref('');
const formTipe = ref<'tetap' | 'sementara'>('tetap');
const formTanggalMulaiKerja = ref('');
const formTanggalSelesaiKerja = ref('');
const formKtp = ref<File | null>(null);
const formSim = ref<File | null>(null);
const formStnk = ref<File | null>(null);
// Foto Profil (Wajib) -- pola sama seperti ProfilSupir.vue: dipilih
// lokal dulu (preview instan via URL.createObjectURL), baru benar-benar
// diunggah setelah akun berhasil dibuat (butuh supirId hasil buatAkunSupir).
const formFoto = ref<File | null>(null);
const formFotoPreview = ref('');
const inputFotoTambah = ref<HTMLInputElement | null>(null);
const inputFotoEdit = ref<HTMLInputElement | null>(null);

// Opsi kendaraan baru yang dikonfirmasi admin lewat tombol "Tambah" pada sesi
// ini -- supaya langsung terlihat di dropdown sebelum baris supir manapun
// tersimpan. Begitu ada supir tersimpan dengan jenis ini, ia otomatis ikut
// muncul lewat data asli (lihat opsiJenisKendaraan) pada pemuatan berikutnya.
const opsiKendaraanTambahan = ref<string[]>([]);

const opsiJenisKendaraan = computed(() => {
  const dariData = listSupir.value.map((s) => s.jenis_kendaraan).filter((v): v is string => !!v);
  return Array.from(new Set([...JENIS_KENDARAAN_DASAR, ...dariData, ...opsiKendaraanTambahan.value]));
});

const tambahOpsiKendaraan = (nilaiBaru: string, target: 'tambah' | 'edit') => {
  const nilai = nilaiBaru.trim();
  if (!nilai) {
    picuToast('Isi dulu nama jenis kendaraannya!', 'error');
    return;
  }
  if (!opsiKendaraanTambahan.value.includes(nilai) && !JENIS_KENDARAAN_DASAR.includes(nilai)) {
    opsiKendaraanTambahan.value.push(nilai);
  }
  if (target === 'tambah') {
    formKendaraan.value = nilai;
    formKendaraanLainnya.value = '';
  } else {
    formEditKendaraan.value = nilai;
    formEditKendaraanLainnya.value = '';
  }
};

const resetFormTambah = () => {
  formEmail.value = '';
  formPassword.value = '';
  formNama.value = '';
  formTelepon.value = '';
  formKendaraan.value = 'Toyota HiAce';
  formKendaraanLainnya.value = '';
  formPlat.value = '';
  formTipe.value = 'tetap';
  formTanggalMulaiKerja.value = '';
  formTanggalSelesaiKerja.value = '';
  formKtp.value = null;
  formSim.value = null;
  formStnk.value = null;
  formFoto.value = null;
  formFotoPreview.value = '';
};

const MAKS_UKURAN_DOKUMEN = 10 * 1024 * 1024; // 10 MB, selaras dengan batas bucket "dokumen-supir"
const MAKS_UKURAN_FOTO = 5 * 1024 * 1024; // 5 MB, selaras dengan ProfilSupir.vue

const pilihFotoProfil = (e: Event, target: 'tambah' | 'edit') => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    picuToast('Format foto harus PNG atau JPG.', 'error');
    return;
  }
  if (file.size > MAKS_UKURAN_FOTO) {
    picuToast('Ukuran foto maksimal 5 MB.', 'error');
    return;
  }

  if (target === 'tambah') {
    formFoto.value = file;
    formFotoPreview.value = URL.createObjectURL(file);
  } else {
    formEditFoto.value = file;
    formEditFotoPreview.value = URL.createObjectURL(file);
  }
};

const pilihBerkas = (e: Event, target: 'ktp' | 'sim' | 'stnk') => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file && file.size > MAKS_UKURAN_DOKUMEN) {
    picuToast('Ukuran file maksimal 10MB!', 'error');
    input.value = '';
    return;
  }
  if (target === 'ktp') formKtp.value = file;
  else if (target === 'sim') formSim.value = file;
  else formStnk.value = file;
};

const tambahSupir = async () => {
  if (!formEmail.value || !formPassword.value || !formNama.value || !formPlat.value) {
    picuToast('Mohon lengkapi seluruh kolom wajib!', 'error');
    return;
  }
  if (formKendaraan.value === OPSI_LAINNYA && !formKendaraanLainnya.value) {
    picuToast('Mohon isi jenis kendaraan pada kolom "Jenis Lainnya"!', 'error');
    return;
  }
  if (formPassword.value.length < 6) {
    picuToast('Kata sandi minimal 6 karakter!', 'error');
    return;
  }
  if (!formKtp.value || !formSim.value || !formStnk.value) {
    picuToast('Dokumen KTP, SIM, dan STNK wajib diunggah!', 'error');
    return;
  }
  if (!formFoto.value) {
    picuToast('Foto profil supir wajib diunggah!', 'error');
    return;
  }
  if (formTipe.value === 'sementara' && !formTanggalMulaiKerja.value) {
    picuToast('Tanggal mulai bekerja wajib diisi untuk supir tipe Sementara!', 'error');
    return;
  }

  const jenisKendaraanFinal = formKendaraan.value === OPSI_LAINNYA ? formKendaraanLainnya.value : formKendaraan.value;

  sedangMenyimpan.value = true;
  try {
    const supirId = await buatAkunSupir({
      email: formEmail.value,
      password: formPassword.value,
      namaLengkap: formNama.value,
      nomorTelepon: formTelepon.value,
      jenisKendaraan: jenisKendaraanFinal,
      nomorPlat: formPlat.value,
      tipeSupir: formTipe.value,
      // Tanggal selesai opsional -- kalau kosong, disamakan dengan tanggal
      // mulai supaya akun hanya aktif 1 hari (lihat perbaruiSupir/buatAkunSupir
      // di adminLayanan.ts untuk enforcement lazy-nya).
      tanggalMulaiKerja: formTipe.value === 'sementara' ? formTanggalMulaiKerja.value : undefined,
      tanggalSelesaiKerja: formTipe.value === 'sementara' ? (formTanggalSelesaiKerja.value || formTanggalMulaiKerja.value) : undefined
    });

    // Unggah dokumen wajib setelah akun berhasil dibuat -- SENGAJA
    // dijalankan PARALEL (Promise.all), bukan satu-satu berurutan. Ketiga
    // dokumen ini independen (path storage beda-beda, tidak saling
    // bergantung), jadi menunggunya satu-satu cuma menjumlahkan waktu
    // ketiga upload padahal bisa berjalan bersamaan -- inilah penyebab
    // utama proses "Menyimpan..." terasa sangat lama sebelumnya.
    try {
      const [, , , fotoUrl] = await Promise.all([
        formKtp.value ? unggahDokumenSupir(supirId, 'ktp', formKtp.value) : null,
        formSim.value ? unggahDokumenSupir(supirId, 'sim', formSim.value) : null,
        formStnk.value ? unggahDokumenSupir(supirId, 'stnk', formStnk.value) : null,
        formFoto.value ? unggahFotoProfilSupir(supirId, formFoto.value) : null
      ]);
      if (fotoUrl) await perbaruiFotoProfilSupir(supirId, fotoUrl);
    } catch (errUpload: any) {
      picuToast(`Akun supir dibuat, tapi unggah dokumen/foto gagal: ${errUpload.message}`, 'error');
      modalTambahTampil.value = false;
      resetFormTambah();
      await muatDaftarSupir();
      return;
    }

    picuToast('Akun supir baru berhasil dibuat! Status dokumen: Menunggu Verifikasi.', 'sukses');
    modalTambahTampil.value = false;
    resetFormTambah();
    await muatDaftarSupir();
  } catch (err: any) {
    picuToast(err.message || 'Gagal membuat akun supir baru.', 'error');
  } finally {
    sedangMenyimpan.value = false;
  }
};

// Konfirmasi hapus supir -- aksi destruktif ke database, jadi tidak boleh
// langsung tereksekusi dari klik tombol Trash2. Harus lewat modal konfirmasi
// dulu, baru hapusSupirLayanan() dipanggil dari tombol "Ya, Hapus" di modal.
const modalHapusTampil = ref(false);
const supirAkanDihapus = ref<SupirDenganPengguna | null>(null);
const sedangMenghapus = ref(false);

const bukaKonfirmasiHapus = (supir: SupirDenganPengguna) => {
  supirAkanDihapus.value = supir;
  modalHapusTampil.value = true;
};

const konfirmasiHapusSupir = async () => {
  if (!supirAkanDihapus.value) return;
  const id = supirAkanDihapus.value.id;
  sedangMenghapus.value = true;
  try {
    await hapusSupirLayanan(id);
    listSupir.value = listSupir.value.filter(s => s.id !== id);
    picuToast('Data supir berhasil dihapus!', 'sukses');
    modalHapusTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus data supir.', 'error');
  } finally {
    sedangMenghapus.value = false;
  }
};

const bukaDetail = (supir: SupirDenganPengguna) => {
  supirTerpilih.value = supir;
  modalDetailTampil.value = true;
};

// Modal Edit Supir
const modalEditTampil = ref(false);
const supirIdEdit = ref<string | null>(null);
const formEditNama = ref('');
const formEditTelepon = ref('');
const formEditKendaraan = ref('');
const formEditKendaraanLainnya = ref('');
const formEditPlat = ref('');
const formEditTipe = ref<'tetap' | 'sementara'>('tetap');
const formEditTanggalMulaiKerja = ref('');
const formEditTanggalSelesaiKerja = ref('');
const formEditAktif = ref(true);
// Foto Profil (Wajib) -- fotoProfilLama dipakai sebagai fallback preview
// (foto yang sudah tersimpan), formEditFotoPreview cuma terisi kalau Admin
// memilih file baru di modal ini.
const fotoProfilLama = ref('');
const formEditFoto = ref<File | null>(null);
const formEditFotoPreview = ref('');
const formEditKtp = ref<File | null>(null);
const formEditSim = ref<File | null>(null);
const formEditStnk = ref<File | null>(null);

const pilihBerkasEdit = (e: Event, target: 'ktp' | 'sim' | 'stnk') => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file && file.size > MAKS_UKURAN_DOKUMEN) {
    picuToast('Ukuran file maksimal 10MB!', 'error');
    input.value = '';
    return;
  }
  if (target === 'ktp') formEditKtp.value = file;
  else if (target === 'sim') formEditSim.value = file;
  else formEditStnk.value = file;
};

const bukaEdit = (supir: SupirDenganPengguna) => {
  modalDetailTampil.value = false;
  supirIdEdit.value = supir.id;
  formEditNama.value = supir.nama_lengkap;
  formEditTelepon.value = supir.nomor_telepon ?? '';
  const dikenal = opsiJenisKendaraan.value.includes(supir.jenis_kendaraan);
  formEditKendaraan.value = dikenal ? supir.jenis_kendaraan : OPSI_LAINNYA;
  formEditKendaraanLainnya.value = dikenal ? '' : supir.jenis_kendaraan;
  formEditPlat.value = supir.nomor_plat;
  formEditTipe.value = supir.tipe_supir;
  formEditTanggalMulaiKerja.value = supir.tanggalMulaiKerja ?? '';
  formEditTanggalSelesaiKerja.value = supir.tanggalSelesaiKerja ?? '';
  formEditAktif.value = supir.aktif;
  fotoProfilLama.value = supir.fotoProfil ?? '';
  formEditFoto.value = null;
  formEditFotoPreview.value = '';
  formEditKtp.value = null;
  formEditSim.value = null;
  formEditStnk.value = null;
  modalEditTampil.value = true;
};

const simpanEditSupir = async () => {
  if (!supirIdEdit.value) return;
  if (!fotoProfilLama.value && !formEditFoto.value) {
    picuToast('Foto profil supir wajib diunggah!', 'error');
    return;
  }
  if (formEditTipe.value === 'sementara' && !formEditTanggalMulaiKerja.value) {
    picuToast('Tanggal mulai bekerja wajib diisi untuk supir tipe Sementara!', 'error');
    return;
  }

  const jenisKendaraanFinal = formEditKendaraan.value === OPSI_LAINNYA ? formEditKendaraanLainnya.value : formEditKendaraan.value;

  sedangMenyimpan.value = true;
  try {
    // Paralel -- lihat catatan yang sama di tambahSupir() soal kenapa ini
    // tidak lagi satu-satu berurutan. Foto diunggah DULU (kalau ada) supaya
    // URL-nya bisa disertakan langsung ke perbaruiSupir() di bawah.
    const [, , , fotoUrl] = await Promise.all([
      formEditKtp.value ? unggahDokumenSupir(supirIdEdit.value, 'ktp', formEditKtp.value) : null,
      formEditSim.value ? unggahDokumenSupir(supirIdEdit.value, 'sim', formEditSim.value) : null,
      formEditStnk.value ? unggahDokumenSupir(supirIdEdit.value, 'stnk', formEditStnk.value) : null,
      formEditFoto.value ? unggahFotoProfilSupir(supirIdEdit.value, formEditFoto.value) : null
    ]);

    await perbaruiSupir(supirIdEdit.value, {
      namaLengkap: formEditNama.value,
      nomorTelepon: formEditTelepon.value,
      jenisKendaraan: jenisKendaraanFinal,
      nomorPlat: formEditPlat.value,
      tipeSupir: formEditTipe.value,
      aktif: formEditAktif.value,
      tanggalMulaiKerja: formEditTanggalMulaiKerja.value || null,
      tanggalSelesaiKerja: formEditTanggalSelesaiKerja.value || formEditTanggalMulaiKerja.value || null,
      ...(fotoUrl ? { fotoProfil: fotoUrl } : {})
    });

    picuToast('Data supir berhasil diperbarui!', 'sukses');
    modalEditTampil.value = false;
    await muatDaftarSupir();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui data supir.', 'error');
  } finally {
    sedangMenyimpan.value = false;
  }
};

const verifikasiDokumen = async (status: 'terverifikasi' | 'ditolak') => {
  if (!supirTerpilih.value) return;
  try {
    await perbaruiStatusVerifikasiSupir(supirTerpilih.value.id, status);
    supirTerpilih.value.status_verifikasi = status;
    picuToast(`Status verifikasi supir ${supirTerpilih.value.nama_lengkap} diubah menjadi: ${status.toUpperCase()}`, 'sukses');
    modalDetailTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui status verifikasi.', 'error');
  }
};

const toggleStatusSupir = async (supir: SupirDenganPengguna) => {
  const aktifBaru = !supir.aktif;
  try {
    await togglAktifSupir(supir.id, aktifBaru);
    supir.aktif = aktifBaru;
    picuToast(`Status akun supir ${supir.nama_lengkap} diubah menjadi: ${aktifBaru ? 'AKTIF' : 'TIDAK AKTIF'}`, 'info');
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui status akun supir.', 'error');
  }
};

const kataKunciCari = ref('');

const supirTerfilter = computed(() => {
  const kueri = kataKunciCari.value.toLowerCase().trim();
  if (!kueri) return listSupir.value;
  return listSupir.value.filter(s => {
    return (s.nama_lengkap?.toLowerCase().includes(kueri)) ||
      (s.nomor_plat?.toLowerCase().includes(kueri)) ||
      (s.nomor_telepon?.toLowerCase().includes(kueri));
  });
});
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
        <h1 class="text-xl font-bold text-on-surface uppercase tracking-wider">Kelola Data Driver (Supir)</h1>
        <p class="text-xs text-on-surface-variant">Verifikasi dokumen KTP/SIM/STNK dan atur kepegawaian supir.</p>
      </div>

      <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs" @click="modalTambahTampil = true">
        <Plus class="w-4 h-4" /> Tambah Supir
      </TombolUtama>
    </div>

    <!-- Search Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl max-w-sm soft-shadow text-xs">
      <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Cari Supir:</label>
      <input
        type="text"
        v-model="kataKunciCari"
        placeholder="Cari nama, plat, atau telepon..."
        class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <!-- Table of Drivers -->
    <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Supir</th>
              <th class="py-3 px-4">Kontak & Email</th>
              <th class="py-3 px-4">Kendaraan / Plat</th>
              <th class="py-3 px-4">Kontrak</th>
              <th class="py-3 px-4">Verifikasi</th>
              <th class="py-3 px-4">Status Akun</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
            <tr v-for="supir in supirTerfilter" :key="supir.id" class="hover:bg-surface-container transition-colors">
              <td class="py-4 px-4 font-semibold text-on-surface">{{ supir.nama_lengkap }}</td>
              <td class="py-4 px-4 space-y-0.5">
                <p>{{ supir.nomor_telepon || '-' }}</p>
                <p class="text-[10px] text-on-surface-variant font-mono">{{ supir.email }}</p>
              </td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ supir.jenis_kendaraan }}</p>
                <p class="text-[10px] text-on-surface-variant font-mono uppercase">{{ supir.nomor_plat }}</p>
              </td>
              <td class="py-4 px-4 space-y-0.5">
                <span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-semibold capitalize">{{ supir.tipe_supir }}</span>
                <p v-if="supir.tipe_supir === 'sementara' && supir.tanggalMulaiKerja" class="text-[10px] text-on-surface-variant font-mono">
                  {{ supir.tanggalMulaiKerja }} s/d {{ supir.tanggalSelesaiKerja || supir.tanggalMulaiKerja }}
                </p>
              </td>
              <td class="py-4 px-4">
                <span
                  class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                  :class="{
                    'bg-emerald-50 text-emerald-700 border border-emerald-200': supir.status_verifikasi === 'terverifikasi',
                    'bg-orange-50 text-orange-700 border border-orange-200': supir.status_verifikasi === 'menunggu',
                    'bg-rose-50 text-rose-700 border border-rose-200': supir.status_verifikasi === 'ditolak'
                  }"
                >
                  {{ supir.status_verifikasi }}
                </span>
              </td>
              <td class="py-4 px-4">
                <button
                  @click="toggleStatusSupir(supir)"
                  class="px-2.5 py-0.5 rounded-lg border font-bold uppercase text-[9px] cursor-pointer"
                  :class="supir.aktif ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                >
                  {{ supir.aktif ? 'Aktif' : 'Tidak Aktif' }}
                </button>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button
                  @click="bukaDetail(supir)"
                  class="text-on-surface-variant hover:text-on-surface p-1.5 border border-outline-variant/40 rounded bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  title="Detail & Verifikasi Dokumen"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>

                <button
                  @click="bukaEdit(supir)"
                  class="text-on-surface-variant hover:text-on-surface p-1.5 border border-outline-variant/40 rounded bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  title="Edit Data Supir"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>

                <button
                  @click="bukaKonfirmasiHapus(supir)"
                  class="text-error hover:text-error p-1.5 border border-error/20 rounded bg-error-container/40 hover:bg-error-container transition-colors cursor-pointer"
                  title="Hapus Driver"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="supirTerfilter.length === 0">
              <td colspan="7" class="py-8 text-center text-on-surface-variant italic">
                {{ sedangMemuat ? 'Memuat data...' : 'Tidak ada data supir ditemukan.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail Supir -->
    <ModalUtama
      tema="terang"
      v-if="supirTerpilih"
      :tampil="modalDetailTampil"
      :judul="'Detail Supir: ' + supirTerpilih.nama_lengkap"
      ukuran="lebar"
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-5 text-xs text-on-surface-variant">

        <!-- Profil -->
        <div class="bg-surface-container p-4 rounded-xl border border-outline-variant/30 space-y-2.5">
          <h4 class="font-bold text-on-surface uppercase text-[10px] tracking-wide border-b border-outline-variant/30 pb-2">Profil Supir</h4>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Email:</span>
            <span class="text-on-surface font-bold font-mono">{{ supirTerpilih.email }}</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Nomor WhatsApp:</span>
            <span class="text-on-surface font-bold font-mono">{{ supirTerpilih.nomor_telepon || '-' }}</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Kendaraan:</span>
            <span class="text-on-surface font-bold">{{ supirTerpilih.jenis_kendaraan }}</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Plat Nomor:</span>
            <span class="text-on-surface font-bold font-mono uppercase">{{ supirTerpilih.nomor_plat }}</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Tipe Kepegawaian:</span>
            <span class="text-on-surface font-bold capitalize">{{ supirTerpilih.tipe_supir }}</span>
          </div>
          <div v-if="supirTerpilih.tipe_supir === 'sementara' && supirTerpilih.tanggalMulaiKerja" class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span>Rentang Kerja:</span>
            <span class="text-on-surface font-bold font-mono">{{ supirTerpilih.tanggalMulaiKerja }} s/d {{ supirTerpilih.tanggalSelesaiKerja || supirTerpilih.tanggalMulaiKerja }}</span>
          </div>
          <div class="flex justify-between">
            <span>Status Akun:</span>
            <span class="font-bold" :class="supirTerpilih.aktif ? 'text-emerald-700' : 'text-rose-700'">{{ supirTerpilih.aktif ? 'Aktif' : 'Tidak Aktif' }}</span>
          </div>
        </div>

        <!-- Dokumen Audit Status -->
        <div class="bg-surface-container p-4 rounded-xl border border-outline-variant/30 space-y-3">
          <h4 class="font-bold text-on-surface uppercase text-[10px] tracking-wide border-b border-outline-variant/30 pb-2">Status Berkas Dokumen</h4>
          <div class="grid grid-cols-3 gap-3 text-center">
            <a
              :href="supirTerpilih.url_ktp || undefined"
              target="_blank"
              rel="noopener"
              class="p-2 border border-outline-variant/30 rounded bg-surface-container-lowest block"
              :class="supirTerpilih.url_ktp ? 'hover:border-primary cursor-pointer' : 'pointer-events-none'"
            >
              <p class="text-[9px] text-on-surface-variant uppercase">KTP</p>
              <span class="text-[10px] font-bold" :class="supirTerpilih.url_ktp ? 'text-emerald-700' : 'text-on-surface-variant'">
                {{ supirTerpilih.url_ktp ? 'Terlampir' : 'Belum Diunggah' }}
              </span>
            </a>
            <a
              :href="supirTerpilih.url_sim || undefined"
              target="_blank"
              rel="noopener"
              class="p-2 border border-outline-variant/30 rounded bg-surface-container-lowest block"
              :class="supirTerpilih.url_sim ? 'hover:border-primary cursor-pointer' : 'pointer-events-none'"
            >
              <p class="text-[9px] text-on-surface-variant uppercase">SIM</p>
              <span class="text-[10px] font-bold" :class="supirTerpilih.url_sim ? 'text-emerald-700' : 'text-on-surface-variant'">
                {{ supirTerpilih.url_sim ? 'Terlampir' : 'Belum Diunggah' }}
              </span>
            </a>
            <a
              :href="supirTerpilih.url_stnk || undefined"
              target="_blank"
              rel="noopener"
              class="p-2 border border-outline-variant/30 rounded bg-surface-container-lowest block"
              :class="supirTerpilih.url_stnk ? 'hover:border-primary cursor-pointer' : 'pointer-events-none'"
            >
              <p class="text-[9px] text-on-surface-variant uppercase">STNK</p>
              <span class="text-[10px] font-bold" :class="supirTerpilih.url_stnk ? 'text-emerald-700' : 'text-on-surface-variant'">
                {{ supirTerpilih.url_stnk ? 'Terlampir' : 'Belum Diunggah' }}
              </span>
            </a>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="font-bold text-on-surface uppercase text-[10px] tracking-wide">Aksi Verifikasi Admin:</h4>
          <p class="text-[11px] text-on-surface-variant">Pilih Setujui jika seluruh dokumen fisik dan kepolisian telah sesuai standar.</p>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="bukaEdit(supirTerpilih)">Ubah Data</TombolUtama>
        <TombolUtama tema="terang" varian="utama" @click="verifikasiDokumen('ditolak')">Tolak Berkas</TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="bg-emerald-600 hover:bg-emerald-500 text-white" @click="verifikasiDokumen('terverifikasi')">Setujui Berkas</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Tambah Supir -->
    <ModalUtama
      tema="terang"
      :tampil="modalTambahTampil"
      judul="Daftarkan Driver Baru"
      ukuran="lebar"
      @tutup="modalTambahTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="col-span-2 flex items-center gap-4">
          <button
            type="button"
            class="relative w-16 h-16 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors flex-shrink-0"
            @click="inputFotoTambah?.click()"
          >
            <img v-if="formFotoPreview" :src="formFotoPreview" alt="Foto profil" class="w-full h-full object-cover" />
            <User v-else class="w-6 h-6 text-on-surface-variant" />
          </button>
          <div class="space-y-1">
            <input ref="inputFotoTambah" type="file" accept="image/png,image/jpeg,image/jpg" class="hidden" @change="pilihFotoProfil($event, 'tambah')" />
            <TombolUtama tema="terang" varian="garis-luar" class="!py-1.5 !px-3 text-[11px] gap-1" @click.prevent="inputFotoTambah?.click()">
              <Upload class="w-3.5 h-3.5" />
              {{ formFotoPreview ? 'Ganti Foto' : 'Unggah Foto Profil (Wajib)' }}
            </TombolUtama>
            <p class="text-[10px] text-on-surface-variant">PNG/JPG, maksimal 5 MB.</p>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Lengkap Driver (Wajib):</label>
          <input
            type="text"
            v-model="formNama"
            placeholder="E.g. Budi Santoso"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nomor WhatsApp:</label>
          <input
            type="tel"
            v-model="formTelepon"
            placeholder="Contoh: 0821-7788-9900 (Nomor WhatsApp)"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Alamat Email (Wajib, untuk login):</label>
          <input
            type="email"
            v-model="formEmail"
            placeholder="E.g. budi@email.com"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Kata Sandi Awal (Wajib, min. 6 karakter):</label>
          <input
            type="text"
            v-model="formPassword"
            placeholder="Kata sandi login supir"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Plat Nomor Minibus (Wajib):</label>
          <input
            type="text"
            v-model="formPlat"
            placeholder="E.g. BA 1024 TA"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary uppercase"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Jenis Kendaraan:</label>
          <select
            v-model="formKendaraan"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option v-for="opsi in opsiJenisKendaraan" :key="opsi" :value="opsi">{{ opsi }}</option>
            <option :value="OPSI_LAINNYA">+ Tambah Lainnya...</option>
          </select>
          <div v-if="formKendaraan === OPSI_LAINNYA" class="flex gap-2 mt-2">
            <input
              type="text"
              v-model="formKendaraanLainnya"
              placeholder="Tulis jenis kendaraan baru"
              class="flex-grow px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <TombolUtama tema="terang" varian="utama" class="text-xs shrink-0" @click="tambahOpsiKendaraan(formKendaraanLainnya, 'tambah')">Tambah</TombolUtama>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tipe Kepegawaian:</label>
          <select
            v-model="formTipe"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="tetap">Tetap (Fulltime)</option>
            <option value="sementara">Sementara (Freelance)</option>
          </select>
        </div>

        <template v-if="formTipe === 'sementara'">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Mulai Bekerja (Wajib):</label>
            <input
              type="date"
              v-model="formTanggalMulaiKerja"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Selesai Bekerja (Opsional):</label>
            <input
              type="date"
              v-model="formTanggalSelesaiKerja"
              :min="formTanggalMulaiKerja || undefined"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p class="text-[10px] text-on-surface-variant mt-1">Kosongkan jika akun hanya aktif 1 hari (tanggal mulai bekerja).</p>
          </div>
        </template>

        <div class="col-span-2 space-y-2 border-t border-outline-variant/30 pt-3">
          <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Unggah Dokumen Legalitas (Wajib):</h4>
          <div class="grid grid-cols-3 gap-2">
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formKtp ? formKtp.name : 'Upload KTP' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkas($event, 'ktp')" />
            </label>
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formSim ? formSim.name : 'Upload SIM' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkas($event, 'sim')" />
            </label>
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formStnk ? formStnk.name : 'Upload STNK' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkas($event, 'stnk')" />
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalTambahTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenyimpan" @click="tambahSupir">
          {{ sedangMenyimpan ? 'Menyimpan...' : 'Daftarkan Driver' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Edit Supir -->
    <ModalUtama
      tema="terang"
      :tampil="modalEditTampil"
      judul="Ubah Data Supir"
      ukuran="lebar"
      @tutup="modalEditTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="col-span-2 flex items-center gap-4">
          <button
            type="button"
            class="relative w-16 h-16 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors flex-shrink-0"
            @click="inputFotoEdit?.click()"
          >
            <img v-if="formEditFotoPreview || fotoProfilLama" :src="formEditFotoPreview || fotoProfilLama" alt="Foto profil" class="w-full h-full object-cover" />
            <User v-else class="w-6 h-6 text-on-surface-variant" />
          </button>
          <div class="space-y-1">
            <input ref="inputFotoEdit" type="file" accept="image/png,image/jpeg,image/jpg" class="hidden" @change="pilihFotoProfil($event, 'edit')" />
            <TombolUtama tema="terang" varian="garis-luar" class="!py-1.5 !px-3 text-[11px] gap-1" @click.prevent="inputFotoEdit?.click()">
              <Upload class="w-3.5 h-3.5" />
              {{ formEditFotoPreview || fotoProfilLama ? 'Ganti Foto' : 'Unggah Foto Profil (Wajib)' }}
            </TombolUtama>
            <p class="text-[10px] text-on-surface-variant">PNG/JPG, maksimal 5 MB.</p>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Lengkap Driver:</label>
          <input
            type="text"
            v-model="formEditNama"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nomor WhatsApp:</label>
          <input
            type="tel"
            v-model="formEditTelepon"
            placeholder="Contoh: 08123456789"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Plat Nomor Minibus:</label>
          <input
            type="text"
            v-model="formEditPlat"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary uppercase"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tipe Kepegawaian:</label>
          <select
            v-model="formEditTipe"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="tetap">Tetap (Fulltime)</option>
            <option value="sementara">Sementara (Freelance)</option>
          </select>
        </div>

        <template v-if="formEditTipe === 'sementara'">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Mulai Bekerja (Wajib):</label>
            <input
              type="date"
              v-model="formEditTanggalMulaiKerja"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Tanggal Selesai Bekerja (Opsional):</label>
            <input
              type="date"
              v-model="formEditTanggalSelesaiKerja"
              :min="formEditTanggalMulaiKerja || undefined"
              class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p class="text-[10px] text-on-surface-variant mt-1">Kosongkan jika akun hanya aktif 1 hari (tanggal mulai bekerja).</p>
          </div>
        </template>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Status Akun:</label>
          <select
            v-model="formEditAktif"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option :value="true">Aktif</option>
            <option :value="false">Tidak Aktif</option>
          </select>
        </div>

        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Jenis Kendaraan:</label>
          <select
            v-model="formEditKendaraan"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option v-for="opsi in opsiJenisKendaraan" :key="opsi" :value="opsi">{{ opsi }}</option>
            <option :value="OPSI_LAINNYA">+ Tambah Lainnya...</option>
          </select>
          <div v-if="formEditKendaraan === OPSI_LAINNYA" class="flex gap-2 mt-2">
            <input
              type="text"
              v-model="formEditKendaraanLainnya"
              placeholder="Tulis jenis kendaraan baru"
              class="flex-grow px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <TombolUtama tema="terang" varian="utama" class="text-xs shrink-0" @click="tambahOpsiKendaraan(formEditKendaraanLainnya, 'edit')">Tambah</TombolUtama>
          </div>
        </div>

        <div class="col-span-2 space-y-2 border-t border-outline-variant/30 pt-3">
          <h4 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Ganti Dokumen Legalitas:</h4>
          <div class="grid grid-cols-3 gap-2">
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formEditKtp ? formEditKtp.name : 'Ganti KTP' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkasEdit($event, 'ktp')" />
            </label>
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formEditSim ? formEditSim.name : 'Ganti SIM' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkasEdit($event, 'sim')" />
            </label>
            <label class="border border-outline-variant/40 p-3 rounded-lg text-center cursor-pointer hover:border-primary transition-colors flex flex-col items-center gap-1 text-[10px] text-on-surface-variant">
              <Upload class="w-4 h-4 text-primary" />
              <span>{{ formEditStnk ? formEditStnk.name : 'Ganti STNK' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" class="hidden" @change="pilihBerkasEdit($event, 'stnk')" />
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalEditTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenyimpan" @click="simpanEditSupir">
          {{ sedangMenyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Supir -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Konfirmasi Hapus Supir"
      ukuran="sedang"
      @tutup="modalHapusTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Hapus data supir "{{ supirAkanDihapus?.nama_lengkap }}"?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Penugasan aktif milik supir ini akan ikut hilang, dan data yang sudah dihapus tidak dapat dikembalikan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapus" @click="modalHapusTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapus" @click="konfirmasiHapusSupir">
          {{ sedangMenghapus ? 'Menghapus...' : 'Ya, Hapus' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
