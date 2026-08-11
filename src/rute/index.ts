import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HalamanUtama from '../halaman/HalamanUtama.vue';
import HalamanTentang from '../halaman/HalamanTentang.vue';
import HalamanBerlangganan from '../halaman/HalamanBerlangganan.vue';
import HalamanOrangTua from '../halaman/HalamanOrangTua.vue';
import HalamanSupir from '../halaman/HalamanSupir.vue';
import HalamanAdmin from '../halaman/HalamanAdmin.vue';
import Login from '../halaman/Login.vue';
import Daftar from '../halaman/Daftar.vue';
import LupaKataSandi from '../halaman/LupaKataSandi.vue';
import KonfirmasiResetKataSandi from '../halaman/KonfirmasiResetKataSandi.vue';
import HalamanEditProfil from '../halaman/HalamanEditProfil.vue';
import VerifikasiOtp from '../halaman/VerifikasiOtp.vue';
import { useAuthStore } from '../penyimpanan/authStore';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Beranda',
    component: HalamanUtama,
    meta: { judul: 'Beranda - Denanta TranSolution' }
  },
  {
    path: '/tentang',
    name: 'Tentang',
    component: HalamanTentang,
    meta: { judul: 'Tentang Kami - Denanta TranSolution' }
  },
  {
    path: '/berlangganan',
    name: 'Berlangganan',
    component: HalamanBerlangganan,
    meta: { judul: 'Berlangganan - Denanta TranSolution' }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { judul: 'Masuk - Denanta TranSolution', hanyaTamu: true }
  },
  {
    path: '/daftar',
    name: 'Daftar',
    component: Daftar,
    meta: { judul: 'Daftar Akun - Denanta TranSolution' }
  },
  {
    path: '/register',
    name: 'Register',
    component: Daftar,
    meta: { judul: 'Daftar Akun - Denanta TranSolution' }
  },
  {
    path: '/verifikasi-otp',
    name: 'VerifikasiOtp',
    component: VerifikasiOtp,
    meta: { judul: 'Verifikasi OTP - Denanta TranSolution' }
  },
  {
    path: '/profile/edit',
    name: 'EditProfil',
    component: HalamanEditProfil,
    meta: { judul: 'Ubah Profil - Denanta TranSolution', autentikasi: true }
  },
  {
    path: '/lupa-kata-sandi',
    name: 'LupaKataSandi',
    component: LupaKataSandi,
    meta: { judul: 'Lupa Kata Sandi - Denanta TranSolution', hanyaTamu: true }
  },
  {
    path: '/konfirmasi-reset',
    name: 'KonfirmasiResetKataSandi',
    component: KonfirmasiResetKataSandi,
    meta: { judul: 'Atur Ulang Kata Sandi - Denanta TranSolution' }
  },
  {
    path: '/orangtua',
    name: 'OrangTua',
    component: HalamanOrangTua,
    meta: { judul: 'Dashboard Orang Tua - Denanta TranSolution', autentikasi: true, peran: ['orangtua'] }
  },
  {
    path: '/supir',
    name: 'Supir',
    component: HalamanSupir,
    meta: { judul: 'Dashboard Supir - Denanta TranSolution', autentikasi: true, peran: ['supir'] }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: HalamanAdmin,
    meta: { judul: 'Portal Admin - Denanta TranSolution', autentikasi: true, peran: ['admin'] }
  },
  // Redirect rute salah ke beranda
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Setiap perpindahan rute (navbar, tombol, dst.) WAJIB dimulai dari paling
  // atas -- tanpa ini, posisi scroll halaman sebelumnya ikut terbawa ke
  // halaman tujuan (mis. scroll ke bawah di Beranda lalu klik "Tentang
  // Kami" tetap membuka di posisi bawah). `savedPosition` tetap dihormati
  // saat tombol back/forward browser dipakai (perilaku standar SPA yang
  // wajar), dan `to.hash` tetap discroll ke elemen anchor-nya (dipakai
  // link section pada halaman yang sama, mis. FAQ/anchor di landing page)
  // supaya reset ini tidak mengganggu scroll-ke-section yang sudah ada.
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  }
});

// Guard Rute Dinamis
let sesiSudahDiperiksa = false;

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // Inisialisasi sesi login pada refresh halaman pertama kali saja.
  // periksaLogin() sendiri sudah dibatasi waktu (lihat authStore.ts) supaya
  // token sesi yang kedaluwarsa/rusak di localStorage tidak membuat guard ini
  // menggantung selamanya dan aplikasi tampil blank.
  if (!sesiSudahDiperiksa) {
    sesiSudahDiperiksa = true;
    try {
      await authStore.periksaLogin();
    } catch (err) {
      console.error('Gagal memeriksa sesi login:', err);
    }
  }

  const judulDefault = 'Denanta TranSolution';
  document.title = (to.meta.judul as string) || judulDefault;

  // Admin dan Supir tidak pernah dibawa ke landing page -- selalu diarahkan
  // langsung ke dashboard masing-masing begitu terdeteksi sudah login.
  if (to.path === '/' && authStore.sudahLogin) {
    if (authStore.apakahAdmin) return next('/admin');
    if (authStore.apakahSupir) return next('/supir');
  }

  // Jika akun PERNAH berlangganan aktif setidaknya sekali (baik masih aktif
  // MAUPUN sudah berakhir/menunggak) dan mencoba mengakses /berlangganan,
  // arahkan ke dashboard orangtua -- akun seperti ini tidak lagi diarahkan ke
  // wizard ini untuk membayar (lihat perubahan guard /orangtua di bawah),
  // melainkan tetap masuk dashboard dengan menu dibatasi ke tab Pembayaran
  // (RiwayatPembayaran.vue) supaya bisa mengaktifkan kembali layanan tanpa
  // mengulang wizard pendaftaran anak. KECUALI kunjungan ini berasal dari
  // alur "Tambah Anak" di halaman Pantau Anak (query `tambah=1`), yang
  // memang sengaja membuka wizard yang sama untuk mendaftarkan anak tambahan
  // meski akun sudah aktif berlangganan.
  //
  // PENTING: pengecekan ini memakai pernahBerlangganan (pernah LUNAS
  // setidaknya sekali), BUKAN punyaAnakTerdaftar (sekadar punya baris anak).
  // Akun baru yang baru mengisi tahap Data Anak lalu keluar sebelum sempat
  // membayar tetap punya baris anak, tapi belum pernah lunas -- akun seperti
  // ini WAJIB tetap diarahkan melanjutkan wizard (bukan dilempar ke
  // dashboard), sesuai perbaikan alur "pengguna baru belum selesai
  // berlangganan".
  if (to.path === '/berlangganan' && authStore.sudahLogin && authStore.apakahOrangTua && authStore.pernahBerlangganan && to.query.tambah !== '1') {
    return next('/orangtua');
  }

  // Jika pengguna belum login (belum daftar) dan mencoba mengakses halaman /berlangganan, arahkan ke halaman pendaftaran (/daftar).
  // Query `lanjut` menandai bahwa pendaftaran ini berasal dari alur berlangganan, supaya
  // setelah berhasil daftar, Daftar.vue tahu harus melanjutkan ke /berlangganan (bukan ke landing page).
  if (to.path === '/berlangganan' && !authStore.sudahLogin) {
    return next({ path: '/daftar', query: { lanjut: 'berlangganan' } });
  }

  // Jika pengguna sudah login sebagai orang tua tapi belum PERNAH berhasil
  // berlangganan (lunas) sama sekali, wajibkan menyelesaikan alur
  // berlangganan (wizard pendaftaran) dulu sebelum masuk dashboard -- ini
  // mencakup baik akun yang benar-benar belum punya anak, MAUPUN akun yang
  // sudah sempat mengisi sebagian wizard (mis. sudah isi Data Anak) tapi
  // belum pernah menuntaskan pembayaran; keduanya harus melanjutkan wizard
  // dari tahap terakhir, bukan masuk dashboard. Akun yang PERNAH lunas
  // setidaknya sekali TETAP diizinkan masuk /orangtua walau langganannya
  // sedang tidak aktif (kedaluwarsa/menunggak) -- pembatasan aksesnya
  // dilakukan di dalam dashboard (menu dikunci ke tab Pembayaran, lihat
  // TataLetakOrangTua.vue & HalamanOrangTua.vue), bukan lewat redirect ke
  // wizard, supaya pengguna tidak perlu mengulang proses pendaftaran anak
  // hanya untuk memperpanjang langganan yang berakhir (berlaku sama untuk
  // langganan bulanan maupun harian).
  if (to.path === '/orangtua' && authStore.sudahLogin && authStore.apakahOrangTua && !authStore.pernahBerlangganan) {
    return next('/berlangganan');
  }

  // Jika halaman bertanda khusus Tamu tapi user sudah login, arahkan ke dashboard masing-masing
  if (to.meta.hanyaTamu && authStore.sudahLogin) {
    if (authStore.apakahAdmin) return next('/admin');
    if (authStore.apakahSupir) return next('/supir');
    if (authStore.apakahOrangTua) return next('/orangtua');
    return next('/');
  }

  // Jika rute memerlukan autentikasi
  if (to.meta.autentikasi) {
    if (!authStore.sudahLogin) {
      return next('/login');
    }

    // Jika rute memiliki batasan peran tertentu
    if (to.meta.peran && Array.isArray(to.meta.peran)) {
      const cocokPeran = to.meta.peran.includes(authStore.peran);
      if (!cocokPeran) {
        // Alihkan ke portal dashboard masing-masing yang sesuai dengan peran mereka
        if (authStore.apakahAdmin) return next('/admin');
        if (authStore.apakahSupir) return next('/supir');
        if (authStore.apakahOrangTua) return next('/orangtua');
        return next('/');
      }
    }
  }

  next();
});

export default router;
