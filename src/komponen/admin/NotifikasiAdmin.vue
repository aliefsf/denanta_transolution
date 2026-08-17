<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CheckCheck, Eye, EyeOff, Trash2, Bell } from 'lucide-vue-next';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import ModalUtama from '../umum/ModalUtama.vue';
import { formatWaktuRelatif } from '../../bantuan/formatWaktuRelatif';
import { infoTampilanNotifikasi, kategoriPengirimNotifikasiAdmin, warnaGarisNotifikasi } from '../../bantuan/notifikasiTampilan';
import { useNotifikasiPengguna } from '../../komposabel/useNotifikasiPengguna';

const {
  notifikasiList,
  sedangMemuat,
  error,
  sudahDimuat,
  muatNotifikasi,
  tandaiSatuDibaca,
  tandaiSemuaDibaca: tandaiSemuaDibacaAksi,
  hapusSatu,
  hapusSemua
} = useNotifikasiPengguna();

// Toast Alert
const toastTampil = ref(false);
const toastPesan = ref('');
const toastTipe = ref<'sukses' | 'error' | 'info'>('info');

const picuToast = (pesan: string, tipe: 'sukses' | 'error' | 'info' = 'info') => {
  toastPesan.value = pesan;
  toastTipe.value = tipe;
  toastTampil.value = true;
};

onMounted(() => {
  if (!sudahDimuat.value) muatNotifikasi();
});

// State Kategori -- SEBELUMNYA per tipe umum (perjalanan/pembayaran/sistem),
// sekarang per PENGIRIM (Pengguna/Supir) supaya Admin bisa langsung
// menyaring "notifikasi dari siapa" -- lebih relevan buat alur kerja Admin
// drpd tipe teknis di database. Lihat kategoriPengirimNotifikasiAdmin() di
// notifikasiTampilan.ts untuk pemetaan tipe_terkait -> pengirimnya.
const kategoriTerpilih = ref('semua');

const LABEL_KATEGORI: Record<string, string> = {
  pengguna: 'Pengguna',
  supir: 'Supir',
  lainnya: 'Lainnya'
};

const daftarNotif = computed(() =>
  notifikasiList.value.map((n) => ({
    id: n.id,
    kategori: kategoriPengirimNotifikasiAdmin(n.tipe_terkait),
    labelKategori: LABEL_KATEGORI[kategoriPengirimNotifikasiAdmin(n.tipe_terkait)],
    pesan: n.judul,
    detail: n.pesan,
    waktu: formatWaktuRelatif(n.dibuat_pada),
    dibaca: n.sudah_dibaca,
    tampilan: infoTampilanNotifikasi(n.tipe, n.tipe_terkait)
  }))
);

const filteredNotif = computed(() => {
  if (kategoriTerpilih.value === 'semua') return daftarNotif.value;
  return daftarNotif.value.filter((n) => n.kategori === kategoriTerpilih.value);
});

const tandaiSemuaDibaca = async () => {
  try {
    await tandaiSemuaDibacaAksi();
    picuToast('Semua notifikasi ditandai sebagai dibaca!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal menandai notifikasi.', 'error');
  }
};

const toggleBaca = async (id: string) => {
  const item = notifikasiList.value.find((n) => n.id === id);
  if (!item) return;
  try {
    if (!item.sudah_dibaca) {
      await tandaiSatuDibaca(id);
    } else {
      // Menandai balik ke "belum dibaca" -- lihat catatan lama, belum ada
      // fungsi layanan untuk itu, jadi cuma diubah di tampilan lokal.
      item.sudah_dibaca = false;
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal memperbarui status notifikasi.', 'error');
  }
};

const hapusSatuNotif = async (id: string) => {
  try {
    await hapusSatu(id);
  } catch (err: any) {
    picuToast(err.message || 'Gagal menghapus notifikasi.', 'error');
  }
};

// "Bersihkan Semua" bersifat DESTRUKTIF & tidak bisa dibatalkan -- WAJIB
// konfirmasi dulu (beda dari hapus satu-satu yang cukup sekali klik),
// mengikuti pola modal konfirmasi logout yang sudah ada di TataLetakAdmin.vue.
const modalBersihkanTampil = ref(false);
const sedangMembersihkan = ref(false);

const konfirmasiBersihkanSemua = async () => {
  sedangMembersihkan.value = true;
  try {
    await hapusSemua();
    picuToast('Semua notifikasi berhasil dihapus!', 'sukses');
  } catch (err: any) {
    picuToast(err.message || 'Gagal membersihkan notifikasi.', 'error');
  } finally {
    sedangMembersihkan.value = false;
    modalBersihkanTampil.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 relative min-h-[200px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuat" pesan="Memuat notifikasi..." />

    <!-- Toast Alert -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="toastTampil = false"
    />

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
          <Bell class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-on-background tracking-tight">Kotak Masuk Notifikasi</h1>
          <p class="text-xs text-on-surface-variant">Pemberitahuan laporan kendala, pengajuan cuti/perubahan jadwal, dan aktivitas pembayaran.</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="tandaiSemuaDibaca"
          class="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer bg-surface-container-lowest px-3.5 py-2 rounded-xl border border-outline-variant/30"
        >
          <CheckCheck class="w-4 h-4" />
          Tandai Semua Dibaca
        </button>
        <button
          v-if="notifikasiList.length > 0"
          @click="modalBersihkanTampil = true"
          class="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1.5 cursor-pointer bg-surface-container-lowest px-3.5 py-2 rounded-xl border border-outline-variant/30"
        >
          <Trash2 class="w-4 h-4" />
          Bersihkan Semua
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ error }}
    </div>

    <!-- Category Tabs -->
    <div class="flex border-b border-outline-variant/20 text-xs">
      <button
        @click="kategoriTerpilih = 'semua'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'semua' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        Semua
      </button>
      <button
        @click="kategoriTerpilih = 'pengguna'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'pengguna' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        Pengguna
      </button>
      <button
        @click="kategoriTerpilih = 'supir'"
        class="py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-all"
        :class="kategoriTerpilih === 'supir' ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'"
      >
        Supir
      </button>
    </div>

    <!-- Notifications List -->
    <div class="space-y-3">
      <div
        v-for="notif in filteredNotif"
        :key="notif.id"
        class="p-4 rounded-xl border transition-all flex items-start gap-4 relative overflow-hidden"
        :class="[
          notif.dibaca ? 'bg-surface-container/40 border-outline-variant/10' : 'bg-surface-container-lowest border-outline-variant/30 soft-shadow'
        ]"
      >
        <!-- Unread Dot -->
        <span v-if="!notif.dibaca" class="absolute left-0 top-0 bottom-0 w-1" :class="warnaGarisNotifikasi(notif.tampilan.sentimen)"></span>

        <!-- Icon -- per kejadian spesifik, lihat notifikasiTampilan.ts -->
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          :class="notif.tampilan.kelasIkon"
        >
          <component :is="notif.tampilan.ikon" class="w-4.5 h-4.5" />
        </div>

        <!-- Content -->
        <div class="flex-grow space-y-1.5">
          <div class="flex flex-wrap justify-between items-center gap-x-3 gap-y-0.5 text-[10px]">
            <span class="font-bold uppercase tracking-wider text-on-surface-variant">{{ notif.labelKategori }}</span>
            <span class="text-on-surface-variant font-mono whitespace-nowrap">{{ notif.waktu }}</span>
          </div>
          <p class="text-sm font-bold text-on-surface leading-snug">{{ notif.pesan }}</p>
          <p class="text-[11px] text-on-surface-variant leading-relaxed">{{ notif.detail }}</p>
        </div>

        <!-- Action read/unread + hapus -->
        <div class="flex items-center gap-0.5 flex-shrink-0">
          <button
            @click="toggleBaca(notif.id)"
            class="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
            :title="notif.dibaca ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
          >
            <Eye v-if="notif.dibaca" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
          <button
            @click="hapusSatuNotif(notif.id)"
            class="text-on-surface-variant hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
            title="Hapus notifikasi"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-if="!sedangMemuat && filteredNotif.length === 0" class="text-center py-8 text-on-surface-variant italic text-xs">
        Tidak ada pemberitahuan di kategori ini.
      </div>
    </div>

    <!-- Modal Konfirmasi Bersihkan Semua -->
    <ModalUtama
      tema="terang"
      :tampil="modalBersihkanTampil"
      judul="Bersihkan Semua Notifikasi"
      ukuran="sedang"
      @tutup="modalBersihkanTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-2">
          <Trash2 class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-on-surface">Hapus seluruh notifikasi?</h3>
        <p class="text-xs text-on-surface-variant leading-relaxed">Semua notifikasi di kotak masuk ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
      </div>

      <template #footer>
        <button
          type="button"
          class="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold hover:text-on-surface transition-colors bg-transparent border-0 cursor-pointer text-sm"
          :disabled="sedangMembersihkan"
          @click="modalBersihkanTampil = false"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors border-0 cursor-pointer text-sm disabled:opacity-60"
          :disabled="sedangMembersihkan"
          @click="konfirmasiBersihkanSemua"
        >
          {{ sedangMembersihkan ? 'Menghapus...' : 'Ya, Hapus Semua' }}
        </button>
      </template>
    </ModalUtama>
  </div>
</template>
