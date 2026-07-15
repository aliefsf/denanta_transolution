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
    meta: { judul: 'Masuk - Denanta TranSolution' }
  },
  {
    path: '/daftar',
    name: 'Daftar',
    component: Daftar,
    meta: { judul: 'Daftar Akun - Denanta TranSolution' }
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
  routes
});

// Guard Rute Dinamis
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // Inisialisasi sesi login pada refresh halaman pertama kali
  if (!authStore.sudahLogin && authStore.pengguna === null) {
    await authStore.periksaLogin();
  }

  const judulDefault = 'Denanta TranSolution';
  document.title = (to.meta.judul as string) || judulDefault;

  // Jika pengguna sudah berlangganan dan mencoba mengakses halaman /berlangganan, arahkan ke dashboard orangtua
  if (to.path === '/berlangganan' && authStore.sudahLogin && authStore.sudahBerlangganan) {
    return next('/orangtua');
  }

  // Jika pengguna belum login (belum daftar) dan mencoba mengakses halaman /berlangganan, arahkan ke halaman pendaftaran (/daftar)
  if (to.path === '/berlangganan' && !authStore.sudahLogin) {
    return next('/daftar');
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
