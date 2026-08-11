import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuth } from '../komposabel/useAuth';
import { supabase } from '../layanan/supabase';
import { denganBatasWaktu } from '../bantuan/batasWaktu';
import { resetDataOrangTua } from '../komposabel/useDataOrangTua';
import { resetNotifikasiPengguna } from '../komposabel/useNotifikasiPengguna';
import { ambilTanggalWibSekarang } from '../bantuan/waktuSimulasi';

export const useAuthStore = defineStore('authStore', () => {
  const auth = useAuth();

  // State & Getters (Sinkronisasi reaktif dengan useAuth + Writable Mock Fallback)
  const _penggunaMock = ref<any | null>(null);
  const pengguna = computed({
    get: () => _penggunaMock.value !== null ? _penggunaMock.value : auth.currentUser.value,
    set: (val) => { _penggunaMock.value = val; }
  });

  const _sudahLoginMock = ref<boolean | null>(null);
  const sudahLogin = computed({
    get: () => _sudahLoginMock.value !== null ? _sudahLoginMock.value : auth.isAuthenticated.value,
    set: (val) => { _sudahLoginMock.value = val; }
  });

  const _peranMock = ref<string | null>(null);
  const peran = computed({
    get: () => _peranMock.value !== null ? _peranMock.value : (auth.userProfile.value?.peran || 'tamu'),
    set: (val) => { _peranMock.value = val; }
  });

  const sedangMemuat = ref(false);
  const sudahBerlangganan = ref(false);
  // Terpisah dari sudahBerlangganan -- true begitu akun punya minimal satu
  // baris `anak` terdaftar, TERLEPAS dari status pembayaran/kedaluwarsanya.
  // HANYA dipakai untuk kebutuhan tampilan ringan (mis. jumlah anak); jangan
  // dipakai lagi sebagai dasar keputusan wizard vs dashboard di router guard
  // -- lihat pernahBerlangganan di bawah untuk itu.
  const punyaAnakTerdaftar = ref(false);
  // Pembeda utama "pengguna baru yang belum pernah menyelesaikan pembayaran
  // sama sekali" (masih harus lewat wizard /berlangganan, TIDAK boleh masuk
  // /orangtua) dari "pengguna lama yang pernah berlangganan aktif setidaknya
  // sekali, entah sekarang masih aktif atau sudah kedaluwarsa" (boleh masuk
  // /orangtua, kalau sedang kedaluwarsa dibatasi ke menu Pembayaran saja --
  // lihat TataLetakOrangTua.vue/HalamanOrangTua.vue). Sebelumnya router guard
  // memakai punyaAnakTerdaftar untuk ini, yang salah: akun baru yang baru
  // mengisi Data Anak (tahap wizard ke-2) tapi belum pernah bayar juga sudah
  // punya baris anak, sehingga keliru dianggap "pelanggan lama" dan dilempar
  // ke dashboard alih-alih melanjutkan wizard ke tahap terakhirnya.
  const pernahBerlangganan = ref(false);

  // Getters
  const apakahOrangTua = computed(() => peran.value === 'orangtua');
  const apakahSupir = computed(() => peran.value === 'supir');
  const apakahAdmin = computed(() => peran.value === 'admin');

  // Actions
  async function periksaStatusBerlangganan(uid: string) {
    const db = supabase;
    if (!db || !uid) {
      sudahBerlangganan.value = false;
      punyaAnakTerdaftar.value = false;
      pernahBerlangganan.value = false;
      return;
    }

    try {
      // Langganan aktif = minimal satu anak milik akun ini punya baris langganan
      // yang sudah_dibayar = true dan belum melewati tanggal_berakhir.
      //
      // PENTING: filter aktif=true di sini WAJIB selaras dengan
      // ambilAnakOrangTua() (useDataOrangTua.ts) dan ambilStatusLanggananWizard()
      // (berlangganganLayanan.ts) yang SAMA-SAMA memfilter anak.aktif=true --
      // tanpa filter ini, akun yang anak satu-satunya sudah dihapus (soft
      // delete, anak.aktif=false) tapi PERNAH punya langganan lunas akan
      // dianggap "pelanggan lama" oleh pernahBerlangganan di bawah, sehingga
      // router guard mengunci mereka ke dashboard/menu Pembayaran (lihat
      // rute/index.ts) -- padahal RiwayatPembayaran.vue tidak py anak aktif
      // sama sekali utk direaktivasi (anakList di sana ikut terfilter
      // aktif=true), membuat pengguna terjebak tanpa tombol aksi apa pun.
      // Dengan filter ini, akun seperti itu kembali dianggap "belum ada
      // anak" dan diarahkan ke wizard /berlangganan utk mendaftarkan anak
      // baru -- konsisten dengan status 'belum_ada_anak' di
      // ambilStatusLanggananWizard().
      const { data: anakList, error: errAnak } = await denganBatasWaktu(
        db.from('anak').select('id').eq('orang_tua_id', uid).eq('aktif', true)
      );
      if (errAnak || !anakList || anakList.length === 0) {
        sudahBerlangganan.value = false;
        punyaAnakTerdaftar.value = false;
        pernahBerlangganan.value = false;
        return;
      }

      punyaAnakTerdaftar.value = true;

      const anakIds = anakList.map((a) => a.id);
      const hariIni = ambilTanggalWibSekarang();
      const { count, error: errLangganan } = await denganBatasWaktu(
        db
          .from('langganan')
          .select('*', { count: 'exact', head: true })
          .in('anak_id', anakIds)
          .eq('sudah_dibayar', true)
          .gte('tanggal_berakhir', hariIni)
      );

      sudahBerlangganan.value = !errLangganan && count !== null && count > 0;

      // pernahBerlangganan TIDAK mensyaratkan tanggal_berakhir >= hari ini --
      // sengaja dicek terpisah dari sudahBerlangganan supaya akun yang PERNAH
      // lunas tapi masa aktifnya sudah lewat (pelanggan lama kedaluwarsa)
      // tetap dianggap "pernah berlangganan", berbeda dari akun yang baru
      // mengisi data anak tapi belum pernah bayar sama sekali.
      if (sudahBerlangganan.value) {
        pernahBerlangganan.value = true;
      } else {
        const { count: countPernah, error: errPernah } = await denganBatasWaktu(
          db
            .from('langganan')
            .select('*', { count: 'exact', head: true })
            .in('anak_id', anakIds)
            .eq('sudah_dibayar', true)
        );
        pernahBerlangganan.value = !errPernah && countPernah !== null && countPernah > 0;
      }
    } catch {
      sudahBerlangganan.value = false;
      punyaAnakTerdaftar.value = false;
      pernahBerlangganan.value = false;
    }
  }

  function setSudahBerlangganan(status: boolean) {
    sudahBerlangganan.value = status;
  }

  async function ambilPeranPengguna(uid: string) {
    const hasilPeran = auth.userProfile.value?.peran || 'tamu';
    if (hasilPeran === 'orangtua') {
      await periksaStatusBerlangganan(uid);
    } else {
      sudahBerlangganan.value = false;
      punyaAnakTerdaftar.value = false;
      pernahBerlangganan.value = false;
    }
  }

  async function periksaLogin() {
    sedangMemuat.value = true;
    try {
      // Tunggu alur inisialisasi sesi singleton di useAuth (sudah timeout-guarded)
      // selesai, alih-alih memanggil auth.ambilPengguna() secara terpisah -- dua
      // pemanggilan sesi Supabase yang berjalan bersamaan saat cold boot (tab
      // ditutup lalu dibuka kembali) saling balapan dan membuat status login/
      // langganan gagal ter-set dengan benar.
      await denganBatasWaktu(auth.tungguSesiAwal());
      const user = auth.currentUser.value;
      if (user) {
        // Profil sudah dimuat oleh alur inisialisasi sesi di useAuth, tinggal
        // pakai peran yang sudah ada untuk cek status langganan.
        await ambilPeranPengguna(user.id);
      } else {
        sudahBerlangganan.value = false;
      }
    } catch {
      sudahBerlangganan.value = false;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function login(email: string, kataSandi: string) {
    sedangMemuat.value = true;
    try {
      const data = await auth.masuk(email, kataSandi);
      if (data?.user) {
        // Pemuatan data profil akan ditangani otomatis oleh onAuthStateChange di useAuth
        await ambilPeranPengguna(data.user.id);
      }
      return data;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function verifikasiOtpPendaftaran(email: string, token: string) {
    sedangMemuat.value = true;
    try {
      const data = await auth.verifikasiOtpDaftar(email, token);
      if (data?.user) {
        // Sama seperti login(): pemuatan profil ditangani onAuthStateChange
        // di useAuth, di sini tinggal cek status langganan sesuai peran.
        await ambilPeranPengguna(data.user.id);
      }
      return data;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function kirimUlangOtpPendaftaran(email: string) {
    return auth.kirimUlangOtpDaftar(email);
  }

  async function logout() {
    sedangMemuat.value = true;
    try {
      await auth.keluar();
      sudahBerlangganan.value = false;
      punyaAnakTerdaftar.value = false;
      pernahBerlangganan.value = false;
      // Wajib: bersihkan singleton data Orang Tua (anakList/profil/dst) DAN
      // notifikasi Admin/Supir (lihat useNotifikasiPengguna.ts) supaya akun
      // lain yang login berikutnya di tab/sesi SPA yang sama tidak
      // mewarisi data akun yang baru logout.
      resetDataOrangTua();
      resetNotifikasiPengguna();
    } finally {
      sedangMemuat.value = false;
    }
  }

  return {
    pengguna,
    peran,
    sudahLogin,
    sedangMemuat,
    sudahBerlangganan,
    punyaAnakTerdaftar,
    pernahBerlangganan,
    apakahOrangTua,
    apakahSupir,
    apakahAdmin,
    login,
    verifikasiOtpPendaftaran,
    kirimUlangOtpPendaftaran,
    logout,
    periksaLogin,
    ambilPeranPengguna,
    setSudahBerlangganan,
    periksaStatusBerlangganan
  };
});
