import { computed, ref } from 'vue';
import { useAuthStore } from '../penyimpanan/authStore';
import type {
  AnakRow,
  LanggananRow,
  NotifikasiRow,
  PembayaranRow,
  PenilaianRow
} from '../tipe';
import {
  ambilAnakOrangTua,
  ambilLanggananByAnakIds,
  ambilPembayaranOrangTua,
  ambilPenilaianOrangTua,
  ambilPerjalananHariIniByAnakIds,
  ambilProfilOrangTua,
  type PerjalananDenganSupir,
  type ProfilOrangTuaGabungan
} from '../layanan/orangTuaLayanan';
import { ambilNotifikasiPengguna, hapusNotifikasi, hapusSemuaNotifikasi } from '../layanan/notifikasiLayanan';
import {
  pantauPerjalananAnakRealtime,
  pantauNotifikasiRealtime,
  pantauLanggananAnakRealtime,
  pantauPembayaranOrangTuaRealtime,
  gunakanRealtimeSubscription,
  pantauLaporanKendalaRealtime
} from '../layanan/realtimeLayanan';
import { ambilTanggalWibSekarang } from '../bantuan/waktuSimulasi';

// State singleton (module-level) agar seluruh tab dashboard berbagi data yang
// sama tanpa mengambil ulang setiap kali berpindah tab, mirip pola useAuth.ts.
const profil = ref<ProfilOrangTuaGabungan | null>(null);
const anakList = ref<AnakRow[]>([]);
const langgananList = ref<LanggananRow[]>([]);
const perjalananHariIniList = ref<PerjalananDenganSupir[]>([]);
const notifikasiList = ref<NotifikasiRow[]>([]);
const pembayaranList = ref<PembayaranRow[]>([]);
const penilaianList = ref<PenilaianRow[]>([]);

const sedangMemuat = ref(false);
const error = ref<string | null>(null);
const sudahDimuat = ref(false);

// Kanal realtime status perjalanan (singleton, sama seperti state di atas)
// -- dipantau berdasarkan daftar anak_id akun orang tua yang sedang login.
let saluranPerjalanan: { unsubscribe: () => void } | null = null;
let anakIdsDipantau: string[] = [];

// Kanal realtime notifikasi (singleton) -- supaya bell/daftar notifikasi
// langsung ter-update begitu ada notifikasi baru (mis. keputusan penundaan
// pembayaran dari Admin) tanpa perlu berpindah tab/reload manual, sejajar
// dengan pola yang sama di TataLetakSupir.vue & TataLetakAdmin.vue.
let saluranNotifikasi: { unsubscribe: () => void } | null = null;

// Kanal realtime langganan & pembayaran (singleton) -- supaya kartu "Sisa
// Langganan"/"Status Langganan" di Dashboard dan daftar tagihan di
// RiwayatPembayaran.vue langsung berubah begitu Admin/webhook Midtrans
// melunasi pembayaran & memperpanjang tanggal_berakhir, tanpa refresh.
let saluranLangganan: { unsubscribe: () => void } | null = null;
let saluranPembayaran: { unsubscribe: () => void } | null = null;
let saluranProfil: { unsubscribe: () => void } | null = null;
let saluranLaporanKendala: { unsubscribe: () => void } | null = null;

/**
 * Mengosongkan seluruh state singleton di atas (termasuk menghentikan
 * kanal realtime yang sedang aktif) dan mengembalikan `sudahDimuat` ke
 * `false`. WAJIB dipanggil saat logout (lihat authStore.ts) -- tanpa ini,
 * begitu akun lain login di tab/sesi SPA yang sama (tanpa reload penuh
 * halaman), guard "if (!sudahDimuat.value) muatSemua()" di berbagai
 * komponen dashboard Orang Tua akan melewati fetch ulang dan menampilkan
 * anakList/profil milik akun sebelumnya untuk akun yang baru login.
 */
export function resetDataOrangTua() {
  saluranPerjalanan?.unsubscribe();
  saluranPerjalanan = null;
  anakIdsDipantau = [];
  saluranNotifikasi?.unsubscribe();
  saluranNotifikasi = null;
  saluranLangganan?.unsubscribe();
  saluranLangganan = null;
  saluranPembayaran?.unsubscribe();
  saluranPembayaran = null;
  saluranProfil?.unsubscribe();
  saluranProfil = null;
  saluranLaporanKendala?.unsubscribe();
  saluranLaporanKendala = null;

  profil.value = null;
  anakList.value = [];
  langgananList.value = [];
  perjalananHariIniList.value = [];
  notifikasiList.value = [];
  pembayaranList.value = [];
  penilaianList.value = [];
  sedangMemuat.value = false;
  error.value = null;
  sudahDimuat.value = false;
}

export function useDataOrangTua() {
  const authStore = useAuthStore();

  const orangTuaId = computed(() => authStore.pengguna?.id ?? null);
  const belumLogin = computed(() => !authStore.sudahLogin || !orangTuaId.value);

  async function jalankan<T>(tugas: () => Promise<T>): Promise<T | null> {
    if (belumLogin.value) {
      error.value = null;
      return null;
    }
    try {
      return await tugas();
    } catch (err: any) {
      error.value = err.message || 'Gagal memuat data. Silakan coba lagi.';
      return null;
    }
  }

  async function muatProfil() {
    if (!orangTuaId.value) return;
    const hasil = await jalankan(() => ambilProfilOrangTua(orangTuaId.value as string));
    if (hasil) profil.value = hasil;
    mulaiRealtimeProfil();
  }

  // Realtime `pengguna`/`orang_tua` -- akun ini punya DUA state independen
  // yang sama-sama menyimpan salinan profil (singleton ini, dan
  // useAuth().userProfile) karena berasal dari dua halaman edit profil
  // berbeda (ProfilOrangTua.vue di dashboard, HalamanEditProfil.vue di
  // /profile/edit). Tanpa realtime di sini, mengedit profil lewat SALAH
  // SATU halaman tidak otomatis menyinkronkan sapaan "Halo, ..." di header
  // dashboard kalau perubahannya berasal dari halaman yang LAIN.
  function mulaiRealtimeProfil() {
    if (!orangTuaId.value || saluranProfil) return;
    const id = orangTuaId.value;
    const segarkan = () => muatProfil();
    const saluranPengguna = gunakanRealtimeSubscription('pengguna', `id=eq.${id}`, segarkan);
    const saluranOrangTua = gunakanRealtimeSubscription('orang_tua', `id=eq.${id}`, segarkan);
    saluranProfil = {
      unsubscribe: () => {
        saluranPengguna.unsubscribe();
        saluranOrangTua.unsubscribe();
      }
    };
  }

  async function muatAnak() {
    if (!orangTuaId.value) return;
    const hasil = await jalankan(() => ambilAnakOrangTua(orangTuaId.value as string));
    if (hasil) {
      anakList.value = hasil;
      const anakIds = hasil.map((a) => a.id);
      const hasilLangganan = await jalankan(() => ambilLanggananByAnakIds(anakIds));
      if (hasilLangganan) langgananList.value = hasilLangganan;
      mulaiRealtimePerjalanan();
      mulaiRealtimeLangganan(anakIds);
      mulaiRealtimeLaporanKendala();
    }
  }

  async function muatPerjalananHariIni() {
    const anakIds = anakList.value.map((a) => a.id);
    const hasil = await jalankan(() => ambilPerjalananHariIniByAnakIds(anakIds));
    if (hasil) perjalananHariIniList.value = hasil;
  }

  // Mulai/segarkan langganan realtime status perjalanan mengikuti anak_id
  // milik akun yang sedang login. Setiap perubahan status yang disimpan
  // supir (lihat perbaruiStatusPerjalanan di supirLayanan.ts) langsung
  // memperbarui perjalananHariIniList tanpa perlu refresh/polling manual.
  function mulaiRealtimePerjalanan() {
    const anakIds = anakList.value.map((a) => a.id);
    if (anakIds.length === 0) return;

    const sudahSamaSet =
      anakIds.length === anakIdsDipantau.length && anakIds.every((id) => anakIdsDipantau.includes(id));
    if (saluranPerjalanan && sudahSamaSet) return;

    saluranPerjalanan?.unsubscribe();
    anakIdsDipantau = anakIds;

    saluranPerjalanan = pantauPerjalananAnakRealtime(anakIds, (payload: any) => {
      const baris = (payload.new ?? payload.old) as (PerjalananDenganSupir & { tanggal_perjalanan: string }) | undefined;
      if (!baris?.id) return;

      const hariIni = ambilTanggalWibSekarang();
      if (baris.tanggal_perjalanan !== hariIni) return;

      if (payload.eventType === 'DELETE') {
        perjalananHariIniList.value = perjalananHariIniList.value.filter((p) => p.id !== baris.id);
        return;
      }

      const idx = perjalananHariIniList.value.findIndex((p) => p.id === baris.id);
      if (idx !== -1) {
        // Pertahankan namaSupir/kontakSupir hasil join yang tidak dikirim ulang oleh payload realtime.
        perjalananHariIniList.value.splice(idx, 1, { ...perjalananHariIniList.value[idx], ...payload.new });
        muatPerjalananHariIni();
      } else {
        // Baris baru (mis. sesi sore baru dibuat) -- muat ulang supaya nama/kontak supir ikut terisi.
        muatPerjalananHariIni();
      }
    });
  }

  // Realtime baris `langganan` milik anak-anak akun ini -- begitu Admin/webhook
  // Midtrans melunasi pembayaran & memperpanjang tanggal_berakhir, kartu
  // "Sisa Langganan"/status "pelanggan aktif" langsung ikut berubah tanpa
  // refresh (lihat anakSudahBerlanggananAktif di bawah, dipakai luas oleh
  // Dashboard/Pantau Anak/Jadwal).
  function mulaiRealtimeLangganan(anakIds: string[]) {
    if (anakIds.length === 0) return;
    saluranLangganan?.unsubscribe();
    saluranLangganan = pantauLanggananAnakRealtime(anakIds, (payload: any) => {
      const baris = (payload.new ?? payload.old) as LanggananRow | undefined;
      if (!baris?.id) return;

      if (payload.eventType === 'DELETE') {
        langgananList.value = langgananList.value.filter((l) => l.id !== baris.id);
        return;
      }
      const idx = langgananList.value.findIndex((l) => l.id === baris.id);
      if (idx !== -1) {
        langgananList.value.splice(idx, 1, payload.new as LanggananRow);
      } else {
        langgananList.value = [...langgananList.value, payload.new as LanggananRow];
      }
    });
  }

  // Realtime baris `pembayaran` milik akun ini -- daftar tagihan di
  // RiwayatPembayaran.vue langsung berubah status (menunggu -> lunas) begitu
  // webhook Midtrans mengonfirmasi, tanpa refresh.
  function mulaiRealtimePembayaran() {
    if (!orangTuaId.value || saluranPembayaran) return;
    saluranPembayaran = pantauPembayaranOrangTuaRealtime(orangTuaId.value, (payload: any) => {
      const baris = (payload.new ?? payload.old) as PembayaranRow | undefined;
      if (!baris?.id) return;

      if (payload.eventType === 'DELETE') {
        pembayaranList.value = pembayaranList.value.filter((p) => p.id !== baris.id);
        return;
      }
      const idx = pembayaranList.value.findIndex((p) => p.id === baris.id);
      if (idx !== -1) {
        pembayaranList.value.splice(idx, 1, payload.new as PembayaranRow);
      } else {
        pembayaranList.value = [payload.new as PembayaranRow, ...pembayaranList.value];
      }
    });
  }

  function mulaiRealtimeLaporanKendala() {
    if (!orangTuaId.value || saluranLaporanKendala) return;
    saluranLaporanKendala = pantauLaporanKendalaRealtime(() => {
      muatPerjalananHariIni();
    });
  }

  function hentikanRealtimePerjalanan() {
    saluranPerjalanan?.unsubscribe();
    saluranPerjalanan = null;
    anakIdsDipantau = [];
    saluranNotifikasi?.unsubscribe();
    saluranNotifikasi = null;
    saluranLangganan?.unsubscribe();
    saluranLangganan = null;
    saluranPembayaran?.unsubscribe();
    saluranPembayaran = null;
    saluranProfil?.unsubscribe();
    saluranProfil = null;
    saluranLaporanKendala?.unsubscribe();
    saluranLaporanKendala = null;
  }

  async function muatNotifikasi() {
    if (!orangTuaId.value) return;
    const hasil = await jalankan(() => ambilNotifikasiPengguna(orangTuaId.value as string));
    if (hasil) notifikasiList.value = hasil;

    if (!saluranNotifikasi) {
      saluranNotifikasi = pantauNotifikasiRealtime(orangTuaId.value, () => {
        muatNotifikasi();
        muatPerjalananHariIni();
      });
    }
  }

  async function hapusSatuNotifikasi(id: string) {
    await hapusNotifikasi(id);
    notifikasiList.value = notifikasiList.value.filter((n) => n.id !== id);
  }

  async function hapusSemuaNotifikasiPengguna() {
    if (!orangTuaId.value) return;
    await hapusSemuaNotifikasi(orangTuaId.value);
    notifikasiList.value = [];
  }

  async function muatPembayaran() {
    if (!orangTuaId.value) return;
    const hasil = await jalankan(() => ambilPembayaranOrangTua(orangTuaId.value as string));
    if (hasil) pembayaranList.value = hasil;
    mulaiRealtimePembayaran();
  }

  async function muatPenilaian() {
    if (!orangTuaId.value) return;
    const hasil = await jalankan(() => ambilPenilaianOrangTua(orangTuaId.value as string));
    if (hasil) penilaianList.value = hasil;
  }

  async function muatSemua() {
    if (belumLogin.value) {
      sudahDimuat.value = true;
      return;
    }
    sedangMemuat.value = true;
    error.value = null;
    try {
      await muatProfil();
      await muatAnak();
      await Promise.all([muatPerjalananHariIni(), muatNotifikasi(), muatPembayaran(), muatPenilaian()]);
    } finally {
      sedangMemuat.value = false;
      sudahDimuat.value = true;
    }
  }

  const jumlahNotifikasiBelumDibaca = computed(
    () => notifikasiList.value.filter((n) => !n.sudah_dibaca).length
  );

  // Anak dianggap "pelanggan aktif" HANYA kalau punya baris langganan
  // sudah_dibayar=true DENGAN tanggal_berakhir yang belum lewat -- bukan
  // sekadar anak.aktif=true (kolom itu cuma menandai baris anak belum
  // dihapus/nonaktifkan, TIDAK mencerminkan status pembayaran). Tanpa
  // pemisahan ini, anak yang baru saja didaftarkan lewat wizard tapi
  // pembayarannya belum/gagal diselesaikan (mis. pengguna menutup halaman
  // pembayaran) akan langsung tampil sebagai pelanggan aktif di
  // dashboard/monitoring/jadwal, padahal belum pernah bayar sepeser pun.
  // `anakList` MENTAH (tanpa filter ini) tetap dipertahankan apa adanya --
  // RiwayatPembayaran.vue & HalamanBerlangganan.vue justru butuh melihat
  // anak yang belum/belum lagi lunas untuk alur pembayaran/reaktivasi.
  function anakSudahBerlanggananAktif(anakId: string): boolean {
    const hariIni = ambilTanggalWibSekarang();
    return langgananList.value.some(
      (l) => l.anak_id === anakId && l.sudah_dibayar && l.tanggal_berakhir >= hariIni
    );
  }

  const anakAktifList = computed(() => anakList.value.filter((a) => anakSudahBerlanggananAktif(a.id)));
  const anakMenungguPembayaranList = computed(() =>
    anakList.value.filter((a) => !anakSudahBerlanggananAktif(a.id))
  );

  return {
    // state
    profil,
    anakList,
    anakAktifList,
    anakMenungguPembayaranList,
    langgananList,
    perjalananHariIniList,
    notifikasiList,
    pembayaranList,
    penilaianList,
    sedangMemuat,
    error,
    sudahDimuat,
    belumLogin,
    orangTuaId,
    jumlahNotifikasiBelumDibaca,
    // actions
    muatSemua,
    muatProfil,
    muatAnak,
    muatPerjalananHariIni,
    muatNotifikasi,
    muatPembayaran,
    muatPenilaian,
    hapusSatuNotifikasi,
    hapusSemuaNotifikasiPengguna,
    hentikanRealtimePerjalanan
  };
}
