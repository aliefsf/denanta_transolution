<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, School, MapPin, Users, Pencil, Upload, User, Loader2 } from 'lucide-vue-next';
import TombolUtama from '../umum/TombolUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import PemilihPeta from '../umum/PemilihPeta.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import { useResetHariBerganti } from '../../komposabel/useResetHariBerganti';
import { petakanAnakTampilan } from '../../bantuan/petakanAnak';
import { ambilDaftarSekolah, unggahFotoAnak } from '../../layanan/berlangganganLayanan';
import { perbaruiDataAnak } from '../../layanan/orangTuaLayanan';
import type { AnakRow, AnakTampilan, SekolahRow } from '../../tipe';

const router = useRouter();
const {
  anakAktifList,
  anakMenungguPembayaranList,
  perjalananHariIniList,
  sedangMemuat,
  error,
  sudahDimuat,
  orangTuaId,
  muatSemua,
  muatAnak
} = useDataOrangTua();

const emit = defineEmits<{
  (e: 'buka-detail', anak: AnakTampilan): void;
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

// Hanya anak yang sudah jadi pelanggan aktif (langganan lunas & masih
// berlaku) yang boleh masuk daftar monitoring -- lihat catatan lengkap di
// anakAktifList (useDataOrangTua.ts). Anak yang belum menyelesaikan
// pembayaran ditampilkan terpisah di bawah, bukan sebagai kartu pemantauan.
const daftarAnak = computed<AnakTampilan[]>(() =>
  anakAktifList.value.map((anak) => petakanAnakTampilan(anak, perjalananHariIniList.value))
);

onMounted(() => {
  if (!sudahDimuat.value) muatSemua();
});

// Menyegarkan data tepat saat tanggal WIB berganti -- tanpa ini, marker
// "sedang bertugas" supir (dan status perjalanan hari ini) bisa tetap
// menempel di layar melewati tengah malam sampai ada event realtime lain
// yang kebetulan lewat. Sama seperti pola di TugasSupir.vue/DashboardSupir.vue.
useResetHariBerganti(muatSemua);

const detailAnak = (anak: AnakTampilan) => {
  emit('buka-detail', anak);
};

// Query `tambah=1` menandai bahwa kunjungan ke /berlangganan ini berasal
// dari alur "Tambah Anak" (akun sudah aktif berlangganan) -- guard router
// (src/rute/index.ts) memakai penanda ini supaya TIDAK langsung dialihkan
// balik ke /orangtua begitu terdeteksi sudah berlangganan.
const navigasiKeDaftarAnak = () => {
  router.push({ path: '/berlangganan', query: { tambah: '1' } });
};

// ==========================================
// Edit Data Anak
// ==========================================
// Sengaja HANYA mengedit data yang tidak berdampak ke tarif/langganan yang
// sudah berjalan (nama, sekolah/kelas, alamat+titik peta, foto) -- jenis
// layanan/jenis langganan sengaja tidak diikutkan di sini, itu mengubah
// perhitungan biaya berlangganan, lihat perbaruiAnak (berlangganganLayanan.ts).
const daftarSekolah = ref<SekolahRow[]>([]);
const modalEditTampil = ref(false);
const sedangMenyimpanEdit = ref(false);
const errorFotoEdit = ref('');

const anakEdit = ref({
  id: '',
  nama_lengkap: '',
  sekolah_id: '',
  kelas: '',
  alamat_jemput: '',
  lintang_jemput: -0.9471,
  bujur_jemput: 100.4172,
  url_foto: ''
});
const berkasFotoEditBaru = ref<File | null>(null);
const previewFotoEditUrl = ref('');

const daftarKelasEdit = computed(
  () => daftarSekolah.value.find((s) => s.id === anakEdit.value.sekolah_id)?.kelasTersedia ?? []
);

// Sekolah SENGAJA tidak bisa diubah dari modal ini -- biaya_bulanan dihitung
// dari jarak ke sekolah saat pendaftaran (hitungBiayaBulanan, tarifLayanan.ts)
// dan TIDAK pernah dihitung ulang otomatis kalau sekolah_id berubah setelah
// itu. Membiarkan pengguna ganti sekolah sendiri lewat sini bisa membuat
// tarif yang tersimpan tidak lagi mencerminkan jarak sekolah yang sebenarnya
// (anak pindah lebih jauh tapi tetap bayar tarif lama yang lebih murah, atau
// sebaliknya). Perubahan sekolah untuk sementara hanya lewat Admin, yang bisa
// menyesuaikan tarif secara manual bersamaan. Nama sekolah tetap ditampilkan
// (read-only) supaya orang tua bisa memastikan datanya benar.
const namaSekolahEdit = computed(
  () => daftarSekolah.value.find((s) => s.id === anakEdit.value.sekolah_id)?.nama ?? ''
);

const bukaModalEdit = async (anakId: string) => {
  const anakAsli = anakAktifList.value.find((a: AnakRow) => a.id === anakId);
  if (!anakAsli) return;

  anakEdit.value = {
    id: anakAsli.id,
    nama_lengkap: anakAsli.nama_lengkap,
    sekolah_id: anakAsli.sekolah_id,
    kelas: anakAsli.kelas,
    alamat_jemput: anakAsli.alamat_jemput,
    lintang_jemput: anakAsli.lintang_jemput,
    bujur_jemput: anakAsli.bujur_jemput,
    url_foto: anakAsli.url_foto || ''
  };
  berkasFotoEditBaru.value = null;
  previewFotoEditUrl.value = '';
  errorFotoEdit.value = '';
  modalEditTampil.value = true;

  if (daftarSekolah.value.length === 0) {
    try {
      daftarSekolah.value = await ambilDaftarSekolah();
    } catch (err: any) {
      picuToast(err.message || 'Gagal memuat daftar sekolah.', 'error');
    }
  }
};

const pilihFotoEdit = (e: Event) => {
  errorFotoEdit.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    errorFotoEdit.value = 'Format foto harus PNG atau JPG.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    errorFotoEdit.value = 'Ukuran foto maksimal 5 MB.';
    return;
  }

  berkasFotoEditBaru.value = file;
  previewFotoEditUrl.value = URL.createObjectURL(file);
};

const tanganiLokasiEdit = (data: { lintang: number; bujur: number; alamat: string }) => {
  anakEdit.value.lintang_jemput = data.lintang;
  anakEdit.value.bujur_jemput = data.bujur;
  anakEdit.value.alamat_jemput = data.alamat;
};

const simpanEditAnak = async () => {
  if (!anakEdit.value.nama_lengkap || !anakEdit.value.kelas) {
    picuToast('Nama dan kelas wajib diisi.', 'error');
    return;
  }

  sedangMenyimpanEdit.value = true;
  try {
    let urlFotoBaru: string | undefined;
    if (berkasFotoEditBaru.value && orangTuaId.value) {
      urlFotoBaru = await unggahFotoAnak(orangTuaId.value, anakEdit.value.id, berkasFotoEditBaru.value);
    }

    await perbaruiDataAnak({
      anakId: anakEdit.value.id,
      namaLengkap: anakEdit.value.nama_lengkap,
      sekolahId: anakEdit.value.sekolah_id,
      kelas: anakEdit.value.kelas,
      alamatJemput: anakEdit.value.alamat_jemput,
      lintangJemput: anakEdit.value.lintang_jemput,
      bujurJemput: anakEdit.value.bujur_jemput,
      urlFoto: urlFotoBaru
    });

    await muatAnak();
    modalEditTampil.value = false;
    picuToast('Data anak berhasil diperbarui!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan data anak.', 'error');
  } finally {
    sedangMenyimpanEdit.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 relative min-h-[240px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuat" pesan="Memuat data anak..." />

    <!-- Toast Alert -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="toastTampil = false"
    />

    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-xl font-bold text-on-background uppercase tracking-wider">Pantau Anak</h1>
        <p class="text-xs text-on-surface-variant">Pilih salah satu profil anak Anda untuk memantau detail perjalanan live.</p>
      </div>
      <TombolUtama tema="terang" varian="utama" class="gap-1 text-xs" @click="navigasiKeDaftarAnak">
        <Plus class="w-4 h-4" />
        Tambah Anak
      </TombolUtama>
    </div>

    <div v-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ error }}
    </div>

    <!-- Anak menunggu pembayaran -- belum menjadi pelanggan aktif, jadi
         TIDAK tampil di grid monitoring di bawah. -->
    <div
      v-if="!sedangMemuat && anakMenungguPembayaranList.length > 0"
      class="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 space-y-2"
    >
      <p class="text-xs font-bold uppercase tracking-wider">Menunggu Pembayaran</p>
      <p v-for="anak in anakMenungguPembayaranList" :key="anak.id" class="text-xs">
        <strong>{{ anak.nama_lengkap }}</strong> belum bisa dipantau karena pembayaran belum diselesaikan.
        <button type="button" class="text-primary font-bold hover:underline cursor-pointer" @click="navigasiKeDaftarAnak">
          Selesaikan sekarang
        </button>
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-if="!sedangMemuat && daftarAnak.length === 0 && anakMenungguPembayaranList.length === 0"
      class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-10 text-center space-y-3"
    >
      <Users class="w-10 h-10 text-on-surface-variant mx-auto" />
      <p class="text-sm font-bold text-on-surface">Belum ada anak terdaftar</p>
      <p class="text-xs text-on-surface-variant">Silakan daftarkan anak Anda melalui halaman berlangganan.</p>
      <TombolUtama tema="terang" varian="utama" class="text-xs mx-auto" @click="navigasiKeDaftarAnak">
        Daftarkan Anak Sekarang
      </TombolUtama>
    </div>

    <!-- Children Cards Grid -->
    <div v-if="daftarAnak.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="anak in daftarAnak"
        :key="anak.id"
        class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 soft-shadow flex flex-col justify-between space-y-6"
      >
        <div class="flex items-start gap-4">
          <img v-if="anak.foto" :src="anak.foto" :alt="anak.nama" class="w-16 h-16 rounded-2xl object-cover border border-outline-variant/30" />
          <div v-else class="w-16 h-16 rounded-2xl bg-primary-container/20 border border-outline-variant/30 flex items-center justify-center text-primary font-bold text-lg">
            {{ anak.nama.charAt(0) }}
          </div>
          <div class="space-y-1 flex-grow">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-lg font-bold text-on-surface">{{ anak.nama }}</h3>
              <button
                type="button"
                title="Edit Data Anak"
                class="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer flex-shrink-0"
                @click="bukaModalEdit(anak.id)"
              >
                <Pencil class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-on-surface-variant flex items-center gap-1">
              <School class="w-3.5 h-3.5 text-primary" /> {{ anak.sekolah }} ({{ anak.kelas }})
            </p>
            <p class="text-xs text-on-surface-variant flex items-center gap-1">
              <MapPin class="w-3.5 h-3.5 text-primary" /> {{ anak.alamatJemput }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-outline-variant/20 pt-4 text-xs">
          <div>
            <p class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Status Perjalanan</p>
            <div class="mt-1 flex items-center gap-2">
              <BadgeStatusAnak :status="anak.status" />
              <span
                v-if="anak.statusKendalaHariIni === 'aktif'"
                class="inline-flex items-center bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              >
                Ada Kendala
              </span>
              <span
                v-else-if="anak.statusKendalaHariIni === 'selesai'"
                class="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              >
                Kendala Selesai
              </span>
            </div>
          </div>
          <TombolUtama tema="terang" varian="utama" class="text-xs px-5" @click="detailAnak(anak)">
            Detail & Peta Live
          </TombolUtama>
        </div>
      </div>
    </div>

    <!-- Modal Edit Data Anak -->
    <ModalUtama
      tema="terang"
      :tampil="modalEditTampil"
      :judul="'Edit Data: ' + anakEdit.nama_lengkap"
      ukuran="lebar"
      @tutup="modalEditTampil = false"
    >
      <div class="space-y-4 text-xs">
        <!-- Foto -->
        <div class="flex flex-col items-center justify-center pb-2 border-b border-outline-variant/20">
          <div
            class="w-20 h-20 rounded-xl bg-surface-container border overflow-hidden flex items-center justify-center"
            :class="errorFotoEdit ? 'border-rose-400' : 'border-outline-variant/30'"
          >
            <img
              v-if="previewFotoEditUrl || anakEdit.url_foto"
              :src="previewFotoEditUrl || anakEdit.url_foto"
              alt="Foto Anak"
              class="w-full h-full object-cover"
            />
            <User v-else class="w-9 h-9 text-on-surface-variant" />
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            class="hidden"
            id="inputFotoEditAnak"
            @change="pilihFotoEdit"
          />
          <label
            for="inputFotoEditAnak"
            class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 border rounded-xl cursor-pointer transition-colors text-[11px] font-semibold"
            :class="errorFotoEdit ? 'border-rose-300 text-rose-600 bg-rose-50' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'"
          >
            <Upload class="w-3.5 h-3.5" />
            {{ anakEdit.url_foto || previewFotoEditUrl ? 'Ganti Foto' : 'Unggah Foto' }}
          </label>
          <span v-if="errorFotoEdit" class="text-[10px] text-rose-600 font-semibold mt-1.5">{{ errorFotoEdit }}</span>
          <span v-else class="text-[10px] text-on-surface-variant mt-1.5">Format PNG/JPG, maksimal 5 MB.</span>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nama Lengkap Anak</label>
          <input
            v-model="anakEdit.nama_lengkap"
            required
            type="text"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Sekolah</label>
            <div class="w-full h-10 px-3 rounded-xl border border-outline-variant/30 bg-surface-container text-on-surface-variant flex items-center">
              {{ namaSekolahEdit || '-' }}
            </div>
            <p class="text-[10px] text-on-surface-variant mt-1">
              Sekolah tidak dapat diubah sendiri (memengaruhi tarif). Hubungi Admin untuk memindahkan anak ke sekolah lain.
            </p>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Kelas / Jenjang</label>
            <select
              v-model="anakEdit.kelas"
              required
              class="w-full h-10 px-3 rounded-xl border border-outline-variant bg-surface-bright text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
            >
              <option value="" disabled>Pilih Kelas</option>
              <option v-for="cls in daftarKelasEdit" :key="cls" :value="cls">{{ cls }}</option>
            </select>
            <p v-if="anakEdit.sekolah_id && daftarKelasEdit.length === 0" class="text-[10px] text-on-surface-variant mt-1">
              Sekolah ini belum memiliki data kelas, hubungi admin.
            </p>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Alamat Jemput Anak</label>
          <textarea
            v-model="anakEdit.alamat_jemput"
            rows="2"
            class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container resize-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Titik Koordinat Penjemputan</label>
          <PemilihPeta
            :lintang="anakEdit.lintang_jemput"
            :bujur="anakEdit.bujur_jemput"
            :awal-terkonfirmasi="true"
            tinggi="220px"
            tema="terang"
            @pilih-lokasi="tanganiLokasiEdit"
          />
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenyimpanEdit" @click="modalEditTampil = false">
          Batal
        </TombolUtama>
        <TombolUtama tema="terang" varian="utama" class="gap-1.5" :nonaktif="sedangMenyimpanEdit" @click="simpanEditAnak">
          <Loader2 v-if="sedangMenyimpanEdit" class="w-3.5 h-3.5 animate-spin" />
          {{ sedangMenyimpanEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
