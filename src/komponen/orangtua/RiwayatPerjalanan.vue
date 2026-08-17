<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ChevronDown, ChevronUp, History } from 'lucide-vue-next';
import PenilaianSupir from './PenilaianSupir.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import { ambilRiwayatPerjalanan, type PerjalananDenganSupir } from '../../layanan/orangTuaLayanan';
import { pantauPerjalananAnakRealtime } from '../../layanan/realtimeLayanan';
import { LABEL_LAYANAN } from '../../bantuan/petakanAnak';
import { mapStatusPerjalananKeUI } from '../../bantuan/statusPerjalanan';

const { anakList, sedangMemuat: sedangMemuatAnak, sudahDimuat, muatAnak } = useDataOrangTua();

const anakTerpilih = ref('semua');
const filterTanggal = ref('');

const riwayatMentah = ref<PerjalananDenganSupir[]>([]);
const sedangMemuatRiwayat = ref(false);
const error = ref<string | null>(null);
const barisTerekspand = ref<Set<string>>(new Set());

const LABEL_STATUS: Record<string, string> = {
  berangkat: 'Pergi Sekolah',
  sekolah: 'Di Sekolah',
  pulang: 'Perjalanan Pulang',
  rumah: 'Tiba Rumah',
  absen: 'Absen / Libur'
};

interface BarisRiwayat {
  id: string;
  tanggal: string;
  anakId: string;
  anakNama: string;
  jenis: string;
  statusUI: string;
  waktuPergi: string;
  waktuPulang: string;
  supir: string;
  supirId: string | null;
  perjalananIdUntukPenilaian: string | null;
  durasi: string;
  lokasiJemput: string;
  lokasiTujuan: string;
  jarakTempuh: string;
}

function formatJamRentang(mulai: string | null, selesai: string | null): string {
  if (!mulai && !selesai) return '-';
  const format = (w: string | null) => (w ? new Date(w).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--');
  return `${format(mulai)} - ${format(selesai)}`;
}

function hitungDurasi(trips: PerjalananDenganSupir[]): string {
  const totalMenit = trips.reduce((sum, t) => {
    if (!t.waktu_jemput || !t.waktu_antar) return sum;
    const menit = Math.round((new Date(t.waktu_antar).getTime() - new Date(t.waktu_jemput).getTime()) / 60000);
    return sum + (Number.isNaN(menit) || menit < 0 ? 0 : menit);
  }, 0);
  return totalMenit > 0 ? `${totalMenit} Menit` : '-';
}

async function muatRiwayat() {
  if (anakList.value.length === 0) return;
  sedangMemuatRiwayat.value = true;
  error.value = null;
  try {
    riwayatMentah.value = await ambilRiwayatPerjalanan(anakList.value.map((a) => a.id));
  } catch (err: any) {
    error.value = err.message || 'Gagal memuat riwayat perjalanan.';
  } finally {
    sedangMemuatRiwayat.value = false;
  }
}

// Realtime -- baris riwayat baru (mis. sesi hari ini baru saja ditandai
// selesai/dibatalkan supir) langsung tampil tanpa refresh manual.
let saluranRiwayat: { unsubscribe: () => void } | null = null;
let anakIdsDipantau: string[] = [];

function mulaiRealtimeRiwayat() {
  const anakIds = anakList.value.map((a) => a.id);
  if (anakIds.length === 0) return;
  const sudahSama =
    anakIds.length === anakIdsDipantau.length && anakIds.every((id) => anakIdsDipantau.includes(id));
  if (sudahSama && saluranRiwayat) return;

  saluranRiwayat?.unsubscribe();
  anakIdsDipantau = anakIds;
  saluranRiwayat = pantauPerjalananAnakRealtime(anakIds, () => { muatRiwayat(); });
}

onMounted(async () => {
  if (!sudahDimuat.value) await muatAnak();
  await muatRiwayat();
  mulaiRealtimeRiwayat();
});

watch(anakList, () => mulaiRealtimeRiwayat());

onUnmounted(() => {
  saluranRiwayat?.unsubscribe();
  saluranRiwayat = null;
});

// Gabungkan trip pagi & sore per anak per tanggal menjadi satu baris tampilan
const daftarPerjalanan = computed<BarisRiwayat[]>(() => {
  const kelompok = new Map<string, PerjalananDenganSupir[]>();
  for (const trip of riwayatMentah.value) {
    const kunci = `${trip.anak_id}_${trip.tanggal_perjalanan}`;
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci)!.push(trip);
  }

  const baris: BarisRiwayat[] = [];
  for (const [kunci, trips] of kelompok) {
    const [anakId, tanggal] = kunci.split('_');
    const anak = anakList.value.find((a) => a.id === anakId);
    const tripPagi = trips.find((t) => t.jenis_perjalanan === 'pagi');
    const tripSore = trips.find((t) => t.jenis_perjalanan === 'sore');
    const tripTerbaru = tripSore ?? tripPagi ?? trips[0];

    const totalJarak = trips.reduce((sum, t) => sum + (t.jarak_km || 0), 0);
    const jarakTempuhTeks = totalJarak > 0 ? `${totalJarak.toFixed(1)} km` : '-';

    baris.push({
      id: kunci,
      tanggal,
      anakId,
      anakNama: anak?.nama_lengkap ?? '-',
      jenis: LABEL_LAYANAN[tripTerbaru.jenis_layanan] ?? tripTerbaru.jenis_layanan,
      statusUI: mapStatusPerjalananKeUI(tripTerbaru.status, tripTerbaru.jenis_perjalanan),
      waktuPergi: formatJamRentang(tripPagi?.waktu_jemput ?? null, tripPagi?.waktu_antar ?? null),
      waktuPulang: formatJamRentang(tripSore?.waktu_jemput ?? null, tripSore?.waktu_antar ?? null),
      supir: tripTerbaru.namaSupir || '-',
      supirId: tripTerbaru.supir_id,
      perjalananIdUntukPenilaian: tripTerbaru.id,
      durasi: hitungDurasi(trips),
      lokasiJemput: anak?.alamat_jemput || '-',
      lokasiTujuan: anak?.sekolah?.nama || anak?.alamat_antar || '-',
      jarakTempuh: jarakTempuhTeks
    });
  }

  return baris.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
});

const perjalananTerfilter = computed(() => {
  return daftarPerjalanan.value.filter((trip) => {
    const cocokAnak = anakTerpilih.value === 'semua' || trip.anakId === anakTerpilih.value;
    const cocokTanggal = !filterTanggal.value || trip.tanggal === filterTanggal.value;
    return cocokAnak && cocokTanggal;
  });
});

const toggleExpand = (id: string) => {
  if (barisTerekspand.value.has(id)) {
    barisTerekspand.value.delete(id);
  } else {
    barisTerekspand.value.add(id);
  }
};
</script>

<template>
  <div class="space-y-6 relative min-h-[200px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuatAnak || sedangMemuatRiwayat" pesan="Memuat riwayat perjalanan..." />

    <div class="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 soft-shadow">
      <div class="w-11 h-11 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
        <History class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-on-background tracking-tight">Histori Perjalanan Siswa</h1>
        <p class="text-xs text-on-surface-variant">Tinjau seluruh riwayat ketibaan dan kepulangan anak Anda.</p>
      </div>
    </div>

    <div v-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ error }}
    </div>

    <!-- Filter Bar -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 soft-shadow text-xs">
      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Filter Anak:</label>
        <select
          v-model="anakTerpilih"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
        >
          <option value="semua">Semua Anak</option>
          <option v-for="a in anakList" :key="a.id" :value="a.id">{{ a.nama_lengkap }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Pilih Tanggal:</label>
        <input
          type="date"
          v-model="filterTanggal"
          class="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container font-mono"
        />
      </div>
    </div>

    <!-- Riwayat Table -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden soft-shadow">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4">Tanggal</th>
              <th class="py-3 px-4">Nama Anak</th>
              <th class="py-3 px-4">Layanan</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/20 text-on-surface-variant">
            <template v-for="trip in perjalananTerfilter" :key="trip.id">
              <tr class="hover:bg-surface-container/40 transition-colors">
                <td class="py-4 px-4 font-mono font-bold">{{ new Date(trip.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</td>
                <td class="py-4 px-4 font-semibold text-on-surface">{{ trip.anakNama }}</td>
                <td class="py-4 px-4">{{ trip.jenis }}</td>
                <td class="py-4 px-4">
                  <span
                    class="px-2.5 py-0.5 rounded border font-semibold uppercase text-[10px]"
                    :class="trip.statusUI === 'rumah' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : trip.statusUI === 'absen' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                  >
                    {{ LABEL_STATUS[trip.statusUI] ?? trip.statusUI }}
                  </span>
                </td>
                <td class="py-4 px-4 text-right">
                  <button
                    @click="toggleExpand(trip.id)"
                    class="text-primary hover:underline font-bold flex items-center gap-0.5 ml-auto cursor-pointer"
                  >
                    Detail
                    <ChevronDown v-if="!barisTerekspand.has(trip.id)" class="w-3.5 h-3.5" />
                    <ChevronUp v-else class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              <!-- Expandable details -->
              <tr v-show="barisTerekspand.has(trip.id)" class="bg-surface-container/40">
                <td colspan="5" class="p-6 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs border-b border-outline-variant/20 pb-4">
                    <div class="space-y-3">
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Supir Pendamping:</p>
                        <p class="text-on-surface font-bold mt-1">{{ trip.supir }}</p>
                      </div>
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Lokasi Jemput:</p>
                        <p class="text-on-surface font-bold mt-1">{{ trip.lokasiJemput }}</p>
                      </div>
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Lokasi Tujuan (Sekolah):</p>
                        <p class="text-on-surface font-bold mt-1">{{ trip.lokasiTujuan }}</p>
                      </div>
                    </div>
                    <div class="space-y-3">
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Jam Operasional:</p>
                        <p class="text-on-surface mt-1">Pergi: <strong class="font-mono text-primary">{{ trip.waktuPergi }}</strong> | Pulang: <strong class="font-mono text-primary">{{ trip.waktuPulang }}</strong></p>
                      </div>
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Durasi Tempuh:</p>
                        <p class="text-on-surface font-bold mt-1 font-mono">{{ trip.durasi }}</p>
                      </div>
                      <div>
                        <p class="text-on-surface-variant font-bold uppercase text-[9px]">Total Jarak Tempuh:</p>
                        <p class="text-on-surface font-bold mt-1 font-mono text-warnaTombol">{{ trip.jarakTempuh }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Inline Driver Review Widget -- disembunyikan utk perjalanan berstatus
                       Absen/Libur karena anak tidak benar-benar diantar/dijemput, jadi tidak
                       ada layanan supir yang bisa dinilai. -->
                  <div v-if="trip.supirId && trip.statusUI !== 'absen'" class="max-w-md">
                    <PenilaianSupir :namaSupir="trip.supir" :supirId="trip.supirId" :perjalananId="trip.perjalananIdUntukPenilaian" />
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!sedangMemuatRiwayat && perjalananTerfilter.length === 0">
              <td colspan="5" class="py-8 text-center text-on-surface-variant italic">Tidak ada catatan perjalanan ditemukan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
