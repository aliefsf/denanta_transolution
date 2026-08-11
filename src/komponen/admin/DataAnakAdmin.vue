<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Trash2, Eye, MapPin, Phone, User, Loader2, AlertTriangle, Search } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import { ambilDaftarAnak, hapusAnakAdmin, type AnakDenganRingkasan } from '../../layanan/adminLayanan';
import { denganBatasWaktu } from '../../bantuan/batasWaktu';

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

const listAnak = ref<AnakDenganRingkasan[]>([]);
const sedangMemuat = ref(true);

const muatDaftarAnak = async () => {
  sedangMemuat.value = true;
  try {
    listAnak.value = await denganBatasWaktu(ambilDaftarAnak(), 10000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar anak.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

onMounted(muatDaftarAnak);

// Filters
const filterSekolah = ref('semua');
const filterStatus = ref('semua');
const kataKunciCari = ref('');

const daftarSekolahUnik = computed(() => {
  const set = new Set<string>();
  for (const a of listAnak.value) set.add(a.namaSekolah);
  return Array.from(set);
});

const anakTerfilter = computed(() => {
  const kueri = kataKunciCari.value.trim().toLowerCase();
  return listAnak.value.filter(a => {
    const cocokSekolah = filterSekolah.value === 'semua' || a.namaSekolah === filterSekolah.value;
    const cocokStatus = filterStatus.value === 'semua' || a.statusBerlangganan === filterStatus.value;
    const cocokKataKunci = !kueri ||
      (a.nama_lengkap?.toLowerCase().includes(kueri)) ||
      (a.kelas?.toLowerCase().includes(kueri)) ||
      (a.namaSekolah?.toLowerCase().includes(kueri));
    return cocokSekolah && cocokStatus && cocokKataKunci;
  });
});

// Modals State
const modalDetailTampil = ref(false);
const anakTerpilih = ref<AnakDenganRingkasan | null>(null);

// Konfirmasi hapus anak -- aksi destruktif ke database, jadi tidak boleh
// langsung tereksekusi dari klik tombol Trash2. Harus lewat modal konfirmasi
// dulu, baru hapusAnakAdmin() dipanggil dari tombol "Ya, Hapus" di modal.
const modalHapusTampil = ref(false);
const anakAkanDihapus = ref<AnakDenganRingkasan | null>(null);
const sedangMenghapus = ref(false);

const bukaKonfirmasiHapus = (anak: AnakDenganRingkasan) => {
  anakAkanDihapus.value = anak;
  modalHapusTampil.value = true;
};

const konfirmasiHapusAnak = async () => {
  if (!anakAkanDihapus.value) return;
  const id = anakAkanDihapus.value.id;
  sedangMenghapus.value = true;
  try {
    await hapusAnakAdmin(id);
    listAnak.value = listAnak.value.filter(a => a.id !== id);
    picuToast('Data siswa berhasil dihapus!', 'sukses');
    modalHapusTampil.value = false;
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus data siswa.', 'error');
  } finally {
    sedangMenghapus.value = false;
  }
};

const bukaDetail = (anak: AnakDenganRingkasan) => {
  anakTerpilih.value = anak;
  modalDetailTampil.value = true;
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
      <h1 class="text-xl font-bold text-on-surface uppercase tracking-wider">Data Siswa Antar Jemput</h1>
      <p class="text-xs text-on-surface-variant">Tinjau profil sekolah anak, kelas, dan status kelayakan langganan. Pendaftaran siswa baru dilakukan melalui wizard berlangganan orang tua.</p>
    </div>

    <!-- Filters -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 soft-shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Cari Siswa:</label>
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            v-model="kataKunciCari"
            placeholder="Cari nama, kelas, atau sekolah..."
            class="w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Sekolah:</label>
        <select
          v-model="filterSekolah"
          class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="semua">Semua Sekolah</option>
          <option v-for="sek in daftarSekolahUnik" :key="sek" :value="sek">{{ sek }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Status Langganan:</label>
        <select
          v-model="filterStatus"
          class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="semua">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Tidak Aktif">Tidak Aktif</option>
        </select>
      </div>
    </div>

    <div v-if="sedangMemuat" class="flex items-center justify-center py-16">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
    </div>

    <!-- Children Table -->
    <div v-else class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Nama Siswa</th>
              <th class="py-3 px-4">Wali Murid</th>
              <th class="py-3 px-4">Sekolah / Kelas</th>
              <th class="py-3 px-4">Layanan</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
            <tr v-for="anak in anakTerfilter" :key="anak.id" class="hover:bg-surface-container transition-colors">
              <td class="py-4 px-4 font-semibold text-on-surface">{{ anak.nama_lengkap }}</td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ anak.namaOrangTua }}</p>
                <p class="text-[10px] text-on-surface-variant font-mono">{{ anak.noWhatsappOrangTua || '-' }}</p>
              </td>
              <td class="py-4 px-4 space-y-0.5">
                <p class="font-semibold">{{ anak.namaSekolah }}</p>
                <p class="text-[10px] text-on-surface-variant">{{ anak.kelas }}</p>
              </td>
              <td class="py-4 px-4 capitalize">{{ anak.jenis_layanan.replace('_', ' ') }}</td>
              <td class="py-4 px-4">
                <span
                  class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                  :class="anak.statusBerlangganan === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                >
                  {{ anak.statusBerlangganan }}
                </span>
              </td>
              <td class="py-4 px-4 text-right space-x-1.5">
                <button
                  @click="bukaDetail(anak)"
                  class="text-on-surface-variant hover:text-on-surface p-1.5 border border-outline-variant/40 rounded bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  title="Detail & Alamat GPS"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="bukaKonfirmasiHapus(anak)"
                  class="text-error hover:text-error p-1.5 border border-error/20 rounded bg-error-container/40 hover:bg-error-container transition-colors cursor-pointer"
                  title="Hapus Data Siswa"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="anakTerfilter.length === 0">
              <td colspan="6" class="py-8 text-center text-on-surface-variant italic">Belum ada data siswa terdaftar.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail Anak -->
    <ModalUtama
      tema="terang"
      v-if="anakTerpilih"
      :tampil="modalDetailTampil"
      :judul="'Profil Audit Siswa: ' + anakTerpilih.nama_lengkap"
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-4 text-xs text-on-surface-variant">
        <div class="flex items-center gap-4 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
          <div class="w-14 h-14 rounded-xl bg-brand-tosca-light flex items-center justify-center text-primary flex-shrink-0">
            <User class="w-7 h-7" />
          </div>
          <div class="space-y-1">
            <h4 class="text-sm font-bold text-on-surface">{{ anakTerpilih.nama_lengkap }}</h4>
            <p class="text-on-surface-variant">{{ anakTerpilih.namaSekolah }} | {{ anakTerpilih.kelas }}</p>
            <span class="inline-block px-2.5 py-0.5 rounded bg-brand-tosca-light text-primary border border-primary/20 uppercase font-mono font-bold text-[9px] capitalize">
              {{ anakTerpilih.jenis_layanan.replace('_', ' ') }}
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span class="text-on-surface-variant flex items-center gap-1"><Phone class="w-3.5 h-3.5" /> Wali Murid:</span>
            <span class="text-on-surface font-bold">{{ anakTerpilih.namaOrangTua }} ({{ anakTerpilih.noWhatsappOrangTua || '-' }})</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/20 pb-2">
            <span class="text-on-surface-variant flex items-center gap-1"><MapPin class="w-3.5 h-3.5" /> Alamat Jemput:</span>
            <span class="text-on-surface font-medium text-right max-w-xs">{{ anakTerpilih.alamat_jemput }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalDetailTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Konfirmasi Hapus Anak -->
    <ModalUtama
      tema="terang"
      :tampil="modalHapusTampil"
      judul="Konfirmasi Hapus Data Siswa"
      ukuran="sedang"
      @tutup="modalHapusTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-error-container/20 rounded-full flex items-center justify-center text-error mx-auto mb-2">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">
          Hapus data siswa "{{ anakAkanDihapus?.nama_lengkap }}"?
        </h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          Riwayat perjalanan dan langganan anak ini akan ikut terhapus, dan tidak dapat dikembalikan.
        </p>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" :nonaktif="sedangMenghapus" @click="modalHapusTampil = false">Batal</TombolUtama>
        <TombolUtama tema="terang" varian="bahaya" :nonaktif="sedangMenghapus" @click="konfirmasiHapusAnak">
          {{ sedangMenghapus ? 'Menghapus...' : 'Ya, Hapus' }}
        </TombolUtama>
      </template>
    </ModalUtama>
  </div>
</template>
