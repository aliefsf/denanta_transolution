<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { User, Eye, Clock, AlertTriangle, Users } from 'lucide-vue-next';
import ModalUtama from '../umum/ModalUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import NotifikasiUtama from '../umum/NotifikasiUtama.vue';
import ModalPersetujuan from './ModalPersetujuan.vue';
import { formatMataUang } from '../../bantuan/formatMataUang';
import {
  ambilDaftarPengguna,
  setujuiPenundaanPembayaran,
  tolakPenundaanPembayaran,
  type PenggunaDenganRingkasan
} from '../../layanan/adminLayanan';
import { pantauTabelAdminRealtime } from '../../layanan/realtimeLayanan';
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

const listPengguna = ref<PenggunaDenganRingkasan[]>([]);
const sedangMemuat = ref(true);

const muatDaftarPengguna = async () => {
  sedangMemuat.value = true;
  try {
    listPengguna.value = await denganBatasWaktu(ambilDaftarPengguna(), 20000);
  } catch (err: any) {
    picuToast(err.message || 'Gagal memuat daftar pengguna.', 'error');
  } finally {
    sedangMemuat.value = false;
  }
};

// Realtime: refetch begitu ada perubahan pada pengguna/anak/langganan/
// penundaan_pembayaran -- daftar ini join banyak tabel (status langganan,
// pengajuan penundaan bayar), jadi refetch penuh event-driven.
const saluranList: { unsubscribe: () => void }[] = [];
onMounted(() => {
  muatDaftarPengguna();
  for (const tabel of ['pengguna', 'anak', 'langganan', 'penundaan_pembayaran'] as const) {
    saluranList.push(pantauTabelAdminRealtime(tabel, muatDaftarPengguna));
  }
});

onUnmounted(() => {
  saluranList.forEach((s) => s.unsubscribe());
  saluranList.length = 0;
});

// Filter
const filterStatus = ref('semua');
const kataKunciCari = ref('');

const penggunaTerfilter = computed(() => {
  const kueri = kataKunciCari.value.toLowerCase().trim();
  return listPengguna.value.filter(u => {
    const cocokStatus = filterStatus.value === 'semua' || u.statusBerlangganan === filterStatus.value;
    const cocokKataKunci = !kueri ||
      (u.nama_lengkap?.toLowerCase().includes(kueri)) ||
      (u.email?.toLowerCase().includes(kueri)) ||
      (u.nomor_telepon?.toLowerCase().includes(kueri));
    return cocokStatus && cocokKataKunci;
  });
});

// Modals State
const modalDetailTampil = ref(false);
const penggunaTerpilih = ref<PenggunaDenganRingkasan | null>(null);

const bukaDetail = (usr: PenggunaDenganRingkasan) => {
  penggunaTerpilih.value = usr;
  modalDetailTampil.value = true;
};

// UC-A07: Menyetujui/Menolak Penundaan Pembayaran (dari detail pengguna ini)
const modalPersetujuanTampil = ref(false);
const sedangMemproses = ref(false);

const bukaPersetujuan = () => {
  modalPersetujuanTampil.value = true;
};

const prosesPengajuan = async (status: 'disetujui' | 'ditolak', hariPerpanjangan: number) => {
  const pengajuan = penggunaTerpilih.value?.pengajuanPenundaan;
  const orangTuaId = penggunaTerpilih.value?.id;
  if (!pengajuan || !orangTuaId) return;

  sedangMemproses.value = true;
  try {
    if (status === 'disetujui') {
      await setujuiPenundaanPembayaran({ penundaanId: pengajuan.id, langgananId: pengajuan.langgananId, orangTuaId, hariPerpanjangan });
    } else {
      await tolakPenundaanPembayaran({ penundaanId: pengajuan.id, langgananId: pengajuan.langgananId, orangTuaId });
    }
    picuToast(
      `Pengajuan penundaan ${penggunaTerpilih.value?.nama_lengkap} berhasil ${status.toUpperCase()}!`,
      status === 'disetujui' ? 'sukses' : 'error'
    );
    modalPersetujuanTampil.value = false;
    modalDetailTampil.value = false;
    await muatDaftarPengguna();
  } catch (err: any) {
    picuToast(err.message || 'Gagal memproses pengajuan penundaan.', 'error');
  } finally {
    sedangMemproses.value = false;
  }
};

// Daftar terpisah khusus pengguna dengan pengajuan penundaan pembayaran
// yang masih MENUNGGU tinjauan -- supaya admin tidak perlu menyusuri/
// menyaring seluruh tabel wali murid satu per satu untuk menemukan mana
// yang butuh direspons. Tetap di halaman yang sama (bukan rute terpisah),
// tabel utama di bawahnya tidak berubah (masih menampilkan semua wali).
const penggunaMenungguPenundaan = computed(() =>
  listPengguna.value.filter((u) => u.pengajuanPenundaan?.status === 'menunggu')
);

// Buka langsung modal Review Persetujuan dari daftar ringkas ini, tanpa
// harus lewat modal Detail Profil dulu (beda dengan bukaDetail() yang
// dipakai tombol mata di tabel utama).
const tinjauPenundaan = (usr: PenggunaDenganRingkasan) => {
  penggunaTerpilih.value = usr;
  modalPersetujuanTampil.value = true;
};

const pengajuanUntukModal = computed(() => {
  if (!penggunaTerpilih.value?.pengajuanPenundaan) return null;
  return {
    id: penggunaTerpilih.value.pengajuanPenundaan.id,
    alasan: penggunaTerpilih.value.pengajuanPenundaan.alasan,
    buktiUrl: penggunaTerpilih.value.pengajuanPenundaan.buktiUrl,
    jumlah: penggunaTerpilih.value.pengajuanPenundaan.jumlah,
    status: penggunaTerpilih.value.pengajuanPenundaan.status,
    nama: penggunaTerpilih.value.nama_lengkap,
    dibuatPada: penggunaTerpilih.value.pengajuanPenundaan.dibuatPada
  };
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

    <div class="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
        <Users class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-on-surface tracking-tight">Kelola Daftar Pengguna (Wali Murid)</h1>
        <p class="text-xs text-on-surface-variant">Tinjau status keaktifan berlangganan wali dan pengajuan penundaan pembayaran.</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 soft-shadow text-xs max-w-2xl">
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Cari Wali Murid:</label>
        <input
          type="text"
          v-model="kataKunciCari"
          placeholder="Cari nama, email, atau WhatsApp..."
          class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Status Berlangganan:</label>
        <select
          v-model="filterStatus"
          class="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="semua">Semua Status</option>
          <option value="Aktif">Aktif Berlangganan</option>
          <option value="Tidak Aktif">Tidak Aktif</option>
        </select>
      </div>
    </div>

    <!-- Pengajuan Penundaan Pembayaran -- daftar terpisah, hanya yg masih menunggu tinjauan.
         Blok independen (bukan bagian rantai v-if/v-else spinner<->tabel di bawah) supaya
         tetap tampil BERDAMPINGAN dengan tabel utama, bukan menggantikannya. -->
    <div
      v-if="penggunaMenungguPenundaan.length > 0"
      class="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden soft-shadow"
    >
      <div class="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
        <AlertTriangle class="w-4 h-4 text-amber-600" />
        <h3 class="text-xs font-bold text-amber-900 uppercase tracking-wider">
          Pengajuan Penundaan Pembayaran Menunggu Tinjauan ({{ penggunaMenungguPenundaan.length }})
        </h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-amber-100/60 text-amber-800 font-bold uppercase tracking-wider text-[10px]">
              <th class="py-2.5 px-4">Nama Lengkap</th>
              <th class="py-2.5 px-4">Jumlah Tagihan</th>
              <th class="py-2.5 px-4">Alasan</th>
              <th class="py-2.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-200/60 text-amber-900">
            <tr v-for="usr in penggunaMenungguPenundaan" :key="usr.id" class="hover:bg-amber-100/40 transition-colors">
              <td class="py-3 px-4 font-semibold">{{ usr.nama_lengkap }}</td>
              <td class="py-3 px-4 font-mono font-bold">{{ formatMataUang(usr.pengajuanPenundaan?.jumlah ?? 0) }}</td>
              <td class="py-3 px-4 italic truncate max-w-xs">"{{ usr.pengajuanPenundaan?.alasan }}"</td>
              <td class="py-3 px-4 text-right">
                <button
                  @click="tinjauPenundaan(usr)"
                  class="text-amber-800 hover:text-white px-3 py-1.5 border border-amber-300 rounded-xl hover:bg-amber-600 transition-all cursor-pointer text-[10px] font-bold"
                >
                  Tinjau
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Users Table -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px] py-3">
              <th class="py-3 px-4">Nama Lengkap</th>
              <th class="py-3 px-4">Email</th>
              <th class="py-3 px-4">Nomor WhatsApp</th>
              <th class="py-3 px-4">Siswa Didaftarkan</th>
              <th class="py-3 px-4">Status Akun</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-on-surface-variant">
            <tr v-for="usr in penggunaTerfilter" :key="usr.id" class="hover:bg-surface-container transition-colors">
              <td class="py-4 px-4 font-semibold text-on-surface">{{ usr.nama_lengkap }}</td>
              <td class="py-4 px-4 font-mono">{{ usr.email }}</td>
              <td class="py-4 px-4 font-mono">{{ usr.nomor_telepon || '-' }}</td>
              <td class="py-4 px-4 font-bold font-mono">{{ usr.jumlahAnak }} Anak</td>
              <td class="py-4 px-4">
                <div class="flex items-center gap-1.5">
                  <span
                    class="px-2.5 py-0.5 rounded-lg border font-bold uppercase text-[9px]"
                    :class="usr.statusBerlangganan === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                  >
                    {{ usr.statusBerlangganan }}
                  </span>
                  <span
                    v-if="usr.pengajuanPenundaan?.status === 'menunggu'"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold uppercase text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                    title="Ada pengajuan penundaan pembayaran menunggu tinjauan"
                  >
                    <Clock class="w-3 h-3" /> Penundaan
                  </span>
                </div>
              </td>
              <td class="py-4 px-4 text-right">
                <button
                  @click="bukaDetail(usr)"
                  class="text-on-surface-variant hover:text-on-surface p-1.5 border border-outline-variant/40 rounded bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  title="Detail Wali"
                >
                  <Eye class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="penggunaTerfilter.length === 0">
              <td colspan="6" class="py-8 text-center text-on-surface-variant italic">
                {{ sedangMemuat ? 'Memuat data...' : 'Belum ada data pengguna orang tua terdaftar.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail User -->
    <ModalUtama
      tema="terang"
      v-if="penggunaTerpilih"
      :tampil="modalDetailTampil"
      :judul="'Profil Wali: ' + penggunaTerpilih.nama_lengkap"
      @tutup="modalDetailTampil = false"
    >
      <div class="space-y-4 text-xs text-on-surface-variant">
        <div class="flex items-center gap-4 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
          <div class="w-12 h-12 rounded-xl bg-brand-tosca-light flex items-center justify-center text-primary flex-shrink-0">
            <User class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <h4 class="text-sm font-bold text-on-surface">{{ penggunaTerpilih.nama_lengkap }}</h4>
            <p class="text-on-surface-variant font-mono">{{ penggunaTerpilih.email }}</p>
          </div>
        </div>

        <div class="space-y-2.5 pt-2">
          <div class="flex justify-between border-b border-outline-variant/30 pb-2">
            <span class="text-on-surface-variant">WhatsApp Hubungan:</span>
            <span class="text-on-surface font-bold font-mono">{{ penggunaTerpilih.nomor_telepon || '-' }}</span>
          </div>
          <div class="flex justify-between border-b border-outline-variant/30 pb-2">
            <span class="text-on-surface-variant">Total Anak Terdaftar:</span>
            <span class="text-on-surface font-bold">{{ penggunaTerpilih.jumlahAnak }} Siswa</span>
          </div>
        </div>

        <!-- UC-A07: Penundaan Pembayaran -->
        <div v-if="penggunaTerpilih.pengajuanPenundaan" class="pt-2 space-y-2">
          <h5 class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Pengajuan Penundaan Pembayaran</h5>
          <div class="bg-surface-container p-3.5 rounded-xl border border-outline-variant/30 space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-on-surface-variant">Jumlah Tagihan:</span>
              <span class="text-primary font-extrabold font-mono">{{ formatMataUang(penggunaTerpilih.pengajuanPenundaan.jumlah) }}</span>
            </div>
            <p class="p-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-[11px] leading-relaxed italic text-on-surface">
              "{{ penggunaTerpilih.pengajuanPenundaan.alasan }}"
            </p>
            <div class="flex items-center justify-between pt-1">
              <span
                class="px-2.5 py-0.5 rounded font-bold uppercase text-[9px]"
                :class="{
                  'bg-amber-100 text-amber-700 border border-amber-200': penggunaTerpilih.pengajuanPenundaan.status === 'menunggu',
                  'bg-emerald-100 text-emerald-700 border border-emerald-200': penggunaTerpilih.pengajuanPenundaan.status === 'disetujui',
                  'bg-rose-100 text-rose-700 border border-rose-200': penggunaTerpilih.pengajuanPenundaan.status === 'ditolak'
                }"
              >
                {{ penggunaTerpilih.pengajuanPenundaan.status }}
              </span>
              <button
                v-if="penggunaTerpilih.pengajuanPenundaan.status === 'menunggu'"
                @click="bukaPersetujuan"
                class="text-primary hover:text-white px-3 py-1.5 border border-primary/25 rounded-xl hover:bg-primary transition-all cursor-pointer text-[10px] font-bold"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <TombolUtama tema="terang" varian="garis-luar" @click="modalDetailTampil = false">Tutup</TombolUtama>
      </template>
    </ModalUtama>

    <!-- Modal Persetujuan Penundaan Pembayaran -->
    <ModalPersetujuan
      :tampil="modalPersetujuanTampil"
      :pengajuan="pengajuanUntukModal"
      @tutup="modalPersetujuanTampil = false"
      @proses="prosesPengajuan"
    />
  </div>
</template>
