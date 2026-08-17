<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAuthStore } from '../../penyimpanan/authStore';
import { formatWaktuRelatif } from '../../bantuan/formatWaktuRelatif';
import { petakanAnakTampilan } from '../../bantuan/petakanAnak';
import { infoTampilanNotifikasi } from '../../bantuan/notifikasiTampilan';
import { tautanWhatsapp } from '../../bantuan/nomorTelepon';
import { ambilWaktuSekarang } from '../../bantuan/waktuSimulasi';
import { useDataOrangTua } from '../../komposabel/useDataOrangTua';
import type { AnakTampilan } from '../../tipe';
import {
  Users, Calendar, AlertTriangle,
  ChevronRight, MessageCircle, School
} from 'lucide-vue-next';
import KartuUtama from '../umum/KartuUtama.vue';
import TombolUtama from '../umum/TombolUtama.vue';
import MemuatUtama from '../umum/MemuatUtama.vue';
import BadgeStatusAnak from './BadgeStatusAnak.vue';

const authStore = useAuthStore();
const {
  profil,
  anakAktifList,
  anakMenungguPembayaranList,
  perjalananHariIniList,
  langgananList,
  notifikasiList,
  sedangMemuat,
  error,
  sudahDimuat,
  muatSemua
} = useDataOrangTua();

const emit = defineEmits<{
  (e: 'buka-detail', anak: AnakTampilan): void;
  (e: 'ubah-tab', tab: string): void;
}>();

onMounted(() => {
  if (!sudahDimuat.value) muatSemua();
});

const namaPengguna = computed(
  () => profil.value?.pengguna.nama_lengkap || authStore.pengguna?.email?.split('@')[0] || 'Orang Tua'
);

// Menu/tab "Jadwal" (dan pintasan "Absen Harian" di sini) hanya berlaku
// utk langganan BULANAN -- lihat catatan yang sama di TataLetakOrangTua.vue.
const adaAnakLanggananBulanan = computed(() => anakAktifList.value.some((a) => a.jenis_langganan === 'bulanan'));

// Hanya anak dengan langganan LUNAS & masih berlaku yang tampil sebagai
// "pelanggan aktif" di dashboard (status perjalanan, jadwal, dsb) -- anak
// yang baru didaftarkan tapi pembayarannya belum/gagal diselesaikan TIDAK
// boleh dianggap pelanggan aktif, lihat anakAktifList di useDataOrangTua.ts.
const daftarAnak = computed<AnakTampilan[]>(() =>
  anakAktifList.value.map((anak) => petakanAnakTampilan(anak, perjalananHariIniList.value))
);

// Anak yang sudah didaftarkan tapi pembayarannya belum diselesaikan --
// ditampilkan terpisah dengan status "Menunggu Pembayaran" & ajakan
// menyelesaikan pembayaran, BUKAN sebagai pelanggan aktif.
const daftarAnakMenunggu = computed(() => anakMenungguPembayaranList.value);

// ==========================================
// Sisa Langganan per anak (bulanan MAUPUN harian)
// ==========================================
// Sisa langganan dihitung PER ANAK, bukan digabung jadi satu angka akun --
// tiap anak punya siklus langganannya sendiri (bulanan: berakhir akhir
// periode; harian: berakhir besok, karena satu baris langganan harian
// memang cuma berlaku 1 hari -- lihat buatAtauPerbaruiLanggananDanPembayaran
// di berlangganganLayanan.ts). Jenis layanan TIDAK dipakai untuk menyaring
// data mana yang dihitung -- baik bulanan maupun harian sama-sama masuk,
// supaya anak dengan deadline paling dekat (siapa pun jenis langganannya)
// yang tampil di kartu ringkasan.
interface SisaLanggananAnak {
  anakId: string;
  nama: string;
  sisaHari: number;
  tanggalBerakhir: string;
  kedaluwarsa: boolean;
}

const formatTanggalId = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const daftarSisaLangganan = computed<SisaLanggananAnak[]>(() => {
  // Ambil baris langganan TERKINI per anak (tanggal_berakhir paling jauh ke
  // depan), konsisten dengan pola yang sama di RiwayatPembayaran.vue --
  // seorang anak bisa punya beberapa baris langganan historis (renewal
  // sebelumnya), yang relevan hanya periode yang sedang/baru saja berjalan.
  // Hanya baris langganan yang SUDAH LUNAS yang relevan di sini -- baris
  // draft (belum dibayar, mis. dibuat otomatis oleh trg_buat_langganan_otomatis
  // atau ditinggal di tengah wizard) tidak boleh ikut dihitung sebagai "sisa
  // langganan", supaya anak yang belum pernah bayar tidak tampil punya
  // countdown masa aktif.
  const langgananTerkiniByAnakId = new Map<string, (typeof langgananList.value)[number]>();
  for (const l of langgananList.value) {
    if (!l.sudah_dibayar) continue;
    const ada = langgananTerkiniByAnakId.get(l.anak_id);
    if (!ada || l.tanggal_berakhir > ada.tanggal_berakhir) langgananTerkiniByAnakId.set(l.anak_id, l);
  }

  const sekarang = ambilWaktuSekarang().getTime();
  return anakAktifList.value
    .map((anak) => {
      const l = langgananTerkiniByAnakId.get(anak.id);
      if (!l) return null;
      // Selisih hari TANPA di-clamp dulu -- dipakai utk menentukan
      // kedaluwarsa (<= 0 berarti tanggal_berakhir sudah lewat/hari ini).
      // sisaHari yang ditampilkan tetap di-clamp ke 0 supaya tidak pernah
      // menampilkan angka negatif ke pengguna.
      const selisihHariMentah = Math.ceil((new Date(l.tanggal_berakhir).getTime() - sekarang) / 86400000);
      return {
        anakId: anak.id,
        nama: anak.nama_lengkap,
        sisaHari: Math.max(0, selisihHariMentah),
        tanggalBerakhir: l.tanggal_berakhir,
        kedaluwarsa: selisihHariMentah <= 0
      };
    })
    .filter((x): x is SisaLanggananAnak => x !== null);
});

// Kartu ringkasan menampilkan anak dengan DEADLINE PALING DEKAT dari seluruh
// anak terdaftar YANG MASIH AKTIF -- bukan langganan yang terakhir dibuat,
// dan bukan cuma jenis layanan tertentu. Anak yang langganannya SUDAH
// kedaluwarsa sengaja DIKECUALIKAN dari kandidat: sisaHari-nya selalu
// clamped ke 0 (lihat di atas), jadi kalau tidak disaring, anak yang sudah
// lama habis masa langganannya akan terus "menang" selamanya di sort
// ascending (0 hari selalu jadi yang terkecil) dan menutupi anak lain yang
// sebenarnya baru mau jatuh tempo tapi belum benar-benar habis.
const sisaLanggananTerdekat = computed<SisaLanggananAnak | null>(() => {
  const aktif = daftarSisaLangganan.value.filter((x) => !x.kedaluwarsa);
  if (aktif.length === 0) return null;
  return [...aktif].sort((a, b) => a.sisaHari - b.sisaHari)[0];
});

const sisaLanggananByAnakId = computed(() => {
  const peta = new Map<string, SisaLanggananAnak>();
  for (const s of daftarSisaLangganan.value) peta.set(s.anakId, s);
  return peta;
});

const notifikasiTerbaru = computed(() =>
  notifikasiList.value.slice(0, 3).map((n) => ({
    id: n.id,
    kategori: n.tipe,
    judul: n.judul,
    pesan: n.pesan,
    waktu: formatWaktuRelatif(n.dibuat_pada),
    tampilan: infoTampilanNotifikasi(n.tipe, n.tipe_terkait)
  }))
);

const lihatLokasiLangsung = (anak: AnakTampilan) => {
  emit('buka-detail', anak);
};

// Widget ringkasan ke-3 -- memanfaatkan statusKendalaHariIni yang sudah
// dipetakan petakanAnakTampilan() (lihat perbaikan badge Pantau Anak),
// supaya orang tua langsung lihat dari dashboard kalau ada kendala yang
// masih butuh perhatian, tanpa perlu pindah tab.
const jumlahKendalaAktif = computed(() => daftarAnak.value.filter((a) => a.statusKendalaHariIni === 'aktif').length);
</script>

<template>
  <div class="space-y-6 relative min-h-[240px]">
    <MemuatUtama tema="terang" :tampil="sedangMemuat" pesan="Memuat data dashboard..." />

    <!-- Welcome Greeting Header -->
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-container/40 via-surface-container-lowest to-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 soft-shadow">
      <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/5"></div>
      <div class="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-primary/5"></div>
      <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-primary">Portal Orang Tua</p>
          <h1 class="text-2xl font-extrabold text-on-background tracking-tight mt-0.5">Halo, {{ namaPengguna }}!</h1>
          <p class="text-xs text-on-surface-variant mt-1">Selamat datang kembali di panel monitoring Denanta TranSolution.</p>
        </div>
        <div
          v-if="sisaLanggananTerdekat !== null && sisaLanggananTerdekat.sisaHari <= 5"
          class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
        >
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0"></span>
          <span>
            Langganan <strong>{{ sisaLanggananTerdekat.nama }}</strong> segera berakhir dalam
            <strong>{{ sisaLanggananTerdekat.sisaHari }} hari</strong>.
          </span>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
      {{ error }}
    </div>

    <!-- Anak menunggu pembayaran: sudah didaftarkan tapi belum jadi pelanggan
         aktif -- ditampilkan terpisah dari daftar pelanggan aktif di bawah,
         supaya tidak pernah dikira sudah aktif berlangganan. -->
    <div
      v-if="!sedangMemuat && daftarAnakMenunggu.length > 0"
      class="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 space-y-3"
    >
      <p class="text-xs font-bold uppercase tracking-wider">Menunggu Pembayaran</p>
      <div v-for="anak in daftarAnakMenunggu" :key="anak.id" class="flex items-center justify-between gap-3 text-xs">
        <span>
          <strong>{{ anak.nama_lengkap }}</strong> sudah didaftarkan, tapi belum menjadi pelanggan aktif karena pembayaran belum diselesaikan.
        </span>
        <TombolUtama tema="terang" varian="utama" class="text-[11px] py-1.5 px-3 flex-shrink-0" @click="emit('ubah-tab', 'pembayaran')">
          Selesaikan Pembayaran
        </TombolUtama>
      </div>
    </div>

    <!-- Empty State: belum ada anak terdaftar sama sekali (aktif maupun menunggu) -->
    <div
      v-if="!sedangMemuat && daftarAnak.length === 0 && daftarAnakMenunggu.length === 0"
      class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-10 text-center space-y-3"
    >
      <Users class="w-10 h-10 text-on-surface-variant mx-auto" />
      <p class="text-sm font-bold text-on-surface">Belum ada anak terdaftar</p>
      <p class="text-xs text-on-surface-variant">Daftarkan anak Anda untuk mulai memantau perjalanan antar jemput.</p>
      <TombolUtama tema="terang" varian="utama" class="text-xs mx-auto" @click="emit('ubah-tab', 'pantau')">
        Kelola Data Anak
      </TombolUtama>
    </div>

    <template v-if="daftarAnak.length > 0">
      <!-- Summary Widgets Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- 1. Sisa Hari (anak dengan deadline paling dekat) -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-2 soft-shadow hover:border-primary/30 transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Sisa Langganan</span>
            <div class="w-9 h-9 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
              <Calendar class="w-5 h-5 text-primary" />
            </div>
          </div>
          <template v-if="sisaLanggananTerdekat">
            <p class="text-3xl font-black text-on-surface tracking-wide leading-none pt-1">
              {{ sisaLanggananTerdekat.sisaHari }}
              <span class="text-xs font-normal text-on-surface-variant">hari lagi</span>
            </p>
            <p class="text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/20">
              <span class="font-bold text-on-surface">{{ sisaLanggananTerdekat.nama }}</span> &middot; berakhir {{ formatTanggalId(sisaLanggananTerdekat.tanggalBerakhir) }}
            </p>
          </template>
          <p v-else class="text-3xl font-black text-on-surface tracking-wide pt-1">-</p>
        </div>

        <!-- 2. Anak Terdaftar -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-2 soft-shadow hover:border-primary/30 transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Anak Terdaftar</span>
            <div class="w-9 h-9 rounded-xl bg-primary-container/30 flex items-center justify-center flex-shrink-0">
              <Users class="w-5 h-5 text-primary" />
            </div>
          </div>
          <p class="text-3xl font-black text-on-surface tracking-wide leading-none pt-1">
            {{ daftarAnak.length }}
            <span class="text-xs font-normal text-on-surface-variant">anak</span>
          </p>
          <p class="text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/20">Terdaftar di {{ daftarAnak[0]?.sekolah ?? '-' }}</p>
        </div>

        <!-- 3. Kendala Aktif -->
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-2 soft-shadow hover:border-primary/30 transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Kendala Aktif</span>
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="jumlahKendalaAktif > 0 ? 'bg-rose-100' : 'bg-primary-container/30'"
            >
              <AlertTriangle class="w-5 h-5" :class="jumlahKendalaAktif > 0 ? 'text-rose-600' : 'text-primary'" />
            </div>
          </div>
          <p class="text-3xl font-black tracking-wide leading-none pt-1" :class="jumlahKendalaAktif > 0 ? 'text-rose-600' : 'text-on-surface'">
            {{ jumlahKendalaAktif }}
            <span class="text-xs font-normal text-on-surface-variant">laporan</span>
          </p>
          <p class="text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/20">
            {{ jumlahKendalaAktif > 0 ? 'Belum ditandai selesai hari ini' : 'Tidak ada kendala hari ini' }}
          </p>
        </div>
      </div>

      <!-- Main Content Area Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left: Children Status Cards & Shortcut -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Live Action Shortcut -->
          <div
            v-if="daftarAnak[0] && ['penjemputan', 'menuju_sekolah', 'pulang'].includes(daftarAnak[0].status)"
            class="bg-primary-container/20 border border-primary/20 p-5 rounded-2xl flex items-center justify-between soft-shadow"
          >
            <div class="space-y-1">
              <span class="w-fit inline-flex items-center gap-1 bg-primary-container/30 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Dalam Perjalanan
              </span>
              <h3 class="text-sm font-bold text-on-surface">Lacak Posisi Anak Anda Secara Real-time</h3>
              <p class="text-xs text-on-surface-variant">Siswa {{ daftarAnak[0].nama }} sedang dalam perjalanan bersama driver {{ daftarAnak[0].namaSupir || '-' }}.</p>
            </div>
            <TombolUtama tema="terang" varian="utama" class="gap-1 text-xs" @click="lihatLokasiLangsung(daftarAnak[0])">
              Lacak Posisi
              <ChevronRight class="w-4 h-4" />
            </TombolUtama>
          </div>

          <!-- Status Detail Anak Sekolah -->
          <div class="space-y-3">
            <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Status Anak Terdaftar</h3>

            <div
              v-for="anak in daftarAnak"
              :key="anak.id"
              class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-2xl space-y-4 soft-shadow hover:border-primary/30 transition-colors"
            >
              <div class="flex items-center gap-4">
                <img v-if="anak.foto" :src="anak.foto" :alt="anak.nama" class="w-14 h-14 rounded-xl object-cover border-2 border-primary-container/50 flex-shrink-0" />
                <div v-else class="w-14 h-14 rounded-xl bg-primary-container/20 border-2 border-primary-container/50 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                  {{ anak.nama.charAt(0) }}
                </div>
                <div class="flex-grow min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-base font-bold text-on-surface">{{ anak.nama }}</h4>
                    <BadgeStatusAnak :status="anak.status" />
                    <span
                      v-if="anak.statusKendalaHariIni === 'aktif'"
                      class="inline-flex items-center bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    >
                      Ada Kendala
                    </span>
                  </div>
                  <p class="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                    <School class="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" /> {{ anak.sekolah }} &middot; {{ anak.kelas }}
                  </p>
                </div>
              </div>

              <!-- Driver Info and Sisa Langganan -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20 text-xs">
                <div class="space-y-1.5 text-on-surface-variant">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Driver Pendamping</p>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-on-surface">{{ anak.namaSupir || 'Belum ditugaskan' }}</span>
                    <a
                      v-if="anak.kontakSupir"
                      :href="tautanWhatsapp(anak.kontakSupir, `Assalamu'alaikum Pak/Bu ${anak.namaSupir || ''}, saya orang tua dari ${anak.nama}. Ingin menanyakan perihal penjemputan/pengantaran hari ini.`)"
                      target="_blank"
                      rel="noopener"
                      class="text-emerald-600 hover:underline flex items-center gap-0.5"
                    >
                      <MessageCircle class="w-3.5 h-3.5" /> Hubungi
                    </a>
                  </div>
                </div>

                <div v-if="sisaLanggananByAnakId.get(anak.id)" class="space-y-1.5 text-on-surface-variant md:text-right">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Sisa Langganan</p>
                  <p>
                    <span class="font-bold text-on-surface">{{ sisaLanggananByAnakId.get(anak.id)!.sisaHari }} Hari</span>
                    <span class="text-on-surface-variant"> &middot; Berakhir {{ formatTanggalId(sisaLanggananByAnakId.get(anak.id)!.tanggalBerakhir) }}</span>
                  </p>
                </div>
              </div>

              <div class="flex items-center md:justify-end gap-2 pt-2 text-xs">
                <TombolUtama v-if="adaAnakLanggananBulanan" tema="terang" varian="garis-luar" class="text-xs py-2 w-full md:w-auto" @click="emit('ubah-tab', 'jadwal')">
                  Absen Harian
                </TombolUtama>
                <TombolUtama tema="terang" varian="utama" class="text-xs py-2 w-full md:w-auto" @click="emit('buka-detail', anak)">
                  Detail Pelacakan
                </TombolUtama>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Recent Alerts & Notifications -->
        <div class="space-y-6">
          <KartuUtama tema="terang" judul="Pemberitahuan Terbaru" subjudul="Aktivitas perjalanan dan administrasi terpadu">
            <div v-if="notifikasiTerbaru.length === 0" class="text-xs text-on-surface-variant text-center py-6">
              Belum ada pemberitahuan.
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="notif in notifikasiTerbaru"
                :key="notif.id"
                class="flex items-start gap-3 border-b border-outline-variant/20 pb-3 last:border-b-0"
              >
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="notif.tampilan.kelasIkon"
                >
                  <component :is="notif.tampilan.ikon" class="w-4 h-4" />
                </div>
                <div class="flex-grow space-y-1 min-w-0">
                  <div class="flex flex-wrap justify-between items-center gap-x-3 gap-y-0.5 text-[10px]">
                    <span class="font-bold uppercase tracking-wider text-on-surface-variant">{{ notif.kategori }}</span>
                    <span class="text-on-surface-variant font-mono whitespace-nowrap">{{ notif.waktu }}</span>
                  </div>
                  <!-- Judul = info paling penting (mis. "Penjemputan Dimulai: Ananda"), ditonjolkan dibanding isi pesan -->
                  <p class="text-xs font-bold text-on-surface leading-snug">{{ notif.judul }}</p>
                  <p class="text-[11px] text-on-surface-variant leading-relaxed">{{ notif.pesan }}</p>
                </div>
              </div>

              <div class="pt-2 text-center">
                <button
                  @click="emit('ubah-tab', 'notifikasi')"
                  class="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Lihat Seluruh Notifikasi
                </button>
              </div>
            </div>
          </KartuUtama>
        </div>

      </div>
    </template>
  </div>
</template>
