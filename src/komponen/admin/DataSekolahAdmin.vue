<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Plus, Trash2, Pencil, MapPin, Loader2, AlertTriangle, X } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import PemilihPeta from '../umum/PemilihPeta.vue';
import { ambilDaftarSekolah } from '../../layanan/berlangganganLayanan';
import {
  tambahSekolah as tambahSekolahLayanan,
  perbaruiSekolah as perbaruiSekolahLayanan,
  hapusSekolah as hapusSekolahLayanan
} from '../../layanan/adminLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';
import type { SekolahRow } from '../../tipe';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const listSekolah = ref<SekolahRow[]>([]);
const sedangMemuat = ref(true);

const muatDaftarSekolah = async () => {
  sedangMemuat.value = true;
  try {
    listSekolah.value = await denganBatasWaktu(ambilDaftarSekolah(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar sekolah.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime: refetch begitu ada perubahan pada `sekolah` ATAU `kelas_sekolah`
// (kelasTersedia ikut ter-embed lewat join di ambilDaftarSekolah()) --
// event-driven, bukan interval berkala.
let saluranSekolah: { unsubscribe: () => void } | null = null;
let saluranKelas: { unsubscribe: () => void } | null = null;

onMounted(() => {
  muatDaftarSekolah();
  saluranSekolah = pantauTabelAdminRealtime('sekolah', muatDaftarSekolah);
  saluranKelas = pantauTabelAdminRealtime('kelas_sekolah', muatDaftarSekolah);
});

onUnmounted(() => {
  saluranSekolah?.unsubscribe();
  saluranSekolah = null;
  saluranKelas?.unsubscribe();
  saluranKelas = null;
});

// Modals State
const modalFormTampil = ref(false);
const modeForm = ref<'tambah' | 'edit'>('tambah');
const sekolahIdEdit = ref<string | null>(null);
const sedangMenyimpan = ref(false);

// Form State Sekolah
const formNama = ref('');
const formAlamat = ref('');
const formLintang = ref(-0.9320);
const formBujur = ref(100.3800);
const formKelasList = ref<string[]>([]);
const formTingkatBaru = ref('');
const formHurufKelasBaru = ref('');

const resetFormSekolah = () => {
  formNama.value = '';
  formAlamat.value = '';
  formLintang.value = -0.9320;
  formBujur.value = 100.3800;
  formKelasList.value = [];
  formTingkatBaru.value = '';
  formHurufKelasBaru.value = '';
};

// Kelas ditambahkan satu per satu ke daftar (chip) sebelum form disimpan --
// digabung dari dua input terpisah (Tingkat + Kelas, mis. "1" + "A" -> "1A")
// supaya penomoran & huruf rombel konsisten, bukan satu kolom teks bebas.
const tambahKelasKeForm = () => {
  const tingkat = formTingkatBaru.value.trim();
  const hurufKelas = formHurufKelasBaru.value.trim();
  if (!tingkat || !hurufKelas) return;

  const nama = `${tingkat}${hurufKelas}`;
  if (formKelasList.value.includes(nama)) {
    formTingkatBaru.value = '';
    formHurufKelasBaru.value = '';
    return;
  }
  formKelasList.value.push(nama);
  formTingkatBaru.value = '';
  formHurufKelasBaru.value = '';
};

const hapusKelasDariForm = (index: number) => {
  formKelasList.value.splice(index, 1);
};

const bukaTambah = () => {
  modeForm.value = 'tambah';
  sekolahIdEdit.value = null;
  resetFormSekolah();
  modalFormTampil.value = true;
};

const bukaEdit = (sch: SekolahRow) => {
  modeForm.value = 'edit';
  sekolahIdEdit.value = sch.id;
  formNama.value = sch.nama;
  formAlamat.value = sch.alamat;
  formLintang.value = sch.lintang;
  formBujur.value = sch.bujur;
  formKelasList.value = [...(sch.kelasTersedia ?? [])];
  formTingkatBaru.value = '';
  formHurufKelasBaru.value = '';
  modalFormTampil.value = true;
};

// Diisi/disinkronkan otomatis begitu admin menandai titik lokasi di peta
// (reverse geocoding) -- tetap bisa diedit manual sesudahnya di field alamat.
const tanganiLokasiPeta = (data: { lintang: number; bujur: number; alamat: string }) => {
  formLintang.value = data.lintang;
  formBujur.value = data.bujur;
  formAlamat.value = data.alamat;
};

const simpanSekolah = async () => {
  if (!formNama.value || !formAlamat.value) {
    picuToast('Mohon lengkapi seluruh data sekolah!', 'error');
    return;
  }
  if (formKelasList.value.length === 0) {
    picuToast('Mohon tambahkan minimal satu nama kelas!', 'error');
    return;
  }

  sedangMenyimpan.value = true;
  try {
    if (modeForm.value === 'tambah') {
      const sekolahBaru = await tambahSekolahLayanan({
        nama: formNama.value,
        alamat: formAlamat.value,
        lintang: Number(formLintang.value),
        bujur: Number(formBujur.value),
        kelasList: formKelasList.value
      });
      listSekolah.value.push(sekolahBaru);
      picuToast('Sekolah baru berhasil didaftarkan!', 'sukses');
    } else if (sekolahIdEdit.value) {
      const perubahan = {
        nama: formNama.value,
        alamat: formAlamat.value,
        lintang: Number(formLintang.value),
        bujur: Number(formBujur.value),
        kelasList: formKelasList.value
      };
      await perbaruiSekolahLayanan(sekolahIdEdit.value, perubahan);
      const idx = listSekolah.value.findIndex((s) => s.id === sekolahIdEdit.value);
      if (idx !== -1) listSekolah.value[idx] = { ...listSekolah.value[idx], ...perubahan, kelasTersedia: formKelasList.value };
      picuToast('Data sekolah berhasil diperbarui!', 'sukses');
    }
    modalFormTampil.value = false;
    resetFormSekolah();
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan data sekolah.', 'error');
  } finally {
    sedangMenyimpan.value = false;
  }
};

// Konfirmasi hapus sekolah -- aksi destruktif ke database, jadi tidak boleh
// langsung tereksekusi dari klik tombol Trash2. Harus lewat modal konfirmasi
// dulu, baru hapusSekolahLayanan() dipanggil dari tombol "Ya, Hapus" di modal.
const modalHapusTampil = ref(false);
const sekolahAkanDihapus = ref<SekolahRow | null>(null);
const sedangMenghapus = ref(false);

const bukaKonfirmasiHapus = (sch: SekolahRow) => {
  sekolahAkanDihapus.value = sch;
  modalHapusTampil.value = true;
};

const konfirmasiHapusSekolah = async () => {
  if (!sekolahAkanDihapus.value) return;
  const id = sekolahAkanDihapus.value.id;
  sedangMenghapus.value = true;
  try {
    await hapusSekolahLayanan(id);
    listSekolah.value = listSekolah.value.filter(s => s.id !== id);
    picuToast('Sekolah berhasil dihapus!', 'sukses');
    modalHapusTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus sekolah.', 'error');
  } finally {
    sedangMenghapus.value = false;
  }
};

const kataKunciCari = ref('');

const sekolahTerfilter = computed(() => {
  const kueri = kataKunciCari.value.toLowerCase().trim();
  if (!kueri) return listSekolah.value;
  return listSekolah.value.filter(s => {
    return (s.nama?.toLowerCase().includes(kueri)) ||
      (s.alamat?.toLowerCase().includes(kueri));
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
        <h1 class="text-xl font-bold text-on-surface uppercase tracking-wider">Kelola Data Sekolah Mitra</h1>
        <p class="text-xs text-on-surface-variant">Atur koordinat pemetaan sekolah mitra layanan antar-jemput.</p>
      </div>

      <TombolUtama tema="terang" varian="utama" class="gap-1.5 text-xs" @click="bukaTambah">
        <Plus class="w-4 h-4" /> Tambah Sekolah
      </TombolUtama>
    </div>

    <!-- Search Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl max-w-sm soft-shadow text-xs">
      <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Cari Sekolah Mitra:</label>
      <input
        type="text"
        v-model="kataKunciCari"
        placeholder="Cari nama atau alamat sekolah..."
        class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <!-- Table of Schools -->
    <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Sekolah</th>
              <th class="py-3 px-4">Alamat Sekolah</th>
              <th class="py-3 px-4">Koordinat Maps</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
            <tr v-for="sch in sekolahTerfilter" :key="sch.id" class="hover:bg-surface-container transition-colors">
              <td class="py-4 px-4 font-semibold text-on-surface">{{ sch.nama }}</td>
              <td class="py-4 px-4 max-w-xs truncate" :title="sch.alamat">{{ sch.alamat }}</td>
              <td class="py-4 px-4 font-mono text-[10px] text-on-surface-variant">
                <span class="flex items-center gap-1"><MapPin class="w-3.5 h-3.5 text-primary" /> {{ sch.lintang }}, {{ sch.bujur }}</span>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button
                  @click="bukaEdit(sch)"
                  class="text-on-surface-variant hover:text-on-surface p-1.5 border border-outline-variant/40 rounded bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  title="Edit Sekolah"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="bukaKonfirmasiHapus(sch)"
                  class="text-error hover:text-error p-1.5 border border-error/20 rounded bg-error-container/40 hover:bg-error-container transition-colors cursor-pointer"
                  title="Hapus Sekolah"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="sekolahTerfilter.length === 0">
              <td colspan="4" class="py-8 text-center text-on-surface-variant italic">
                {{ sedangMemuat ? 'Memuat data...' : 'Tidak ada data sekolah ditemukan.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tambah/Edit Sekolah -->
    <ModalUtama
      tema="terang"
      :tampil="modalFormTampil"
      :judul="modeForm === 'tambah' ? 'Daftarkan Sekolah Baru' : 'Edit Data Sekolah'"
      ukuran="lebar"
      @tutup="modalFormTampil = false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Instansi Sekolah (Wajib):</label>
          <input
            type="text"
            v-model="formNama"
            placeholder="E.g. SD Negeri 01 Padang"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Alamat Instansi Sekolah (Wajib):</label>
          <textarea
            rows="2"
            v-model="formAlamat"
            placeholder="E.g. Jln. Sudirman No. 2, Padang Barat"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          ></textarea>
        </div>

        <div class="col-span-2 space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Nama Kelas (Wajib, minimal satu):</label>
          <div class="flex gap-2">
            <input
              type="text"
              v-model="formTingkatBaru"
              @keydown.enter.prevent="tambahKelasKeForm"
              placeholder="Tingkat, e.g. 1"
              class="w-24 flex-shrink-0 px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <input
              type="text"
              v-model="formHurufKelasBaru"
              @keydown.enter.prevent="tambahKelasKeForm"
              placeholder="Kelas, e.g. A"
              class="flex-grow px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <TombolUtama tema="terang" varian="garis-luar" class="flex-shrink-0" @click="tambahKelasKeForm">
              <Plus class="w-4 h-4" />
            </TombolUtama>
          </div>
          <p class="text-[10px] text-on-surface-variant">Akan disimpan dengan format gabungan, mis. Tingkat "1" + Kelas "A" &rarr; "1A".</p>
          <div v-if="formKelasList.length > 0" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="(kls, idx) in formKelasList"
              :key="kls"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-tosca-light text-primary border border-primary/20 font-semibold text-[10px]"
            >
              {{ kls }}
              <button type="button" @click="hapusKelasDariForm(idx)" class="hover:text-error transition-colors cursor-pointer">
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
          <p v-else class="text-[10px] text-on-surface-variant italic">Belum ada kelas ditambahkan.</p>
        </div>

        <div class="col-span-2 space-y-1.5">
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Tandai Titik Lokasi di Peta:</label>
          <PemilihPeta
            :lintang="formLintang"
            :bujur="formBujur"
            :awal-terkonfirmasi="modeForm === 'edit'"
            tinggi="240px"
            tema="terang"
            @pilih-lokasi="tanganiLokasiPeta"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Koordinat Lintang (Latitude):</label>
          <input
            type="number"
            step="0.0001"
            v-model="formLintang"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Koordinat Bujur (Longitude):</label>
          <input
            type="number"
            step="0.0001"
            v-model="formBujur"
            class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono"
          />
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalFormTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="utama" :nonaktif="sedangMenyimpan" @click="simpanSekolah">
          {{ sedangMenyimpan ? 'Menyimpan...' : (modeForm === 'tambah' ? 'Daftarkan Sekolah' : 'Simpan Perubahan') }}
        </TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Sekolah -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Konfirmasi Hapus Sekolah"
      ukuran="sedang"
      @tutup="modalHapusTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Hapus sekolah "{{ sekolahAkanDihapus?.nama }}"?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Sekolah ini tidak akan lagi muncul sebagai pilihan pendaftaran anak. Data yang sudah dihapus tidak dapat dikembalikan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapus" @click="modalHapusTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapus" @click="konfirmasiHapusSekolah">
          {{ sedangMenghapus ? 'Menghapus...' : 'Ya, Hapus' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
