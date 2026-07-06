import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HalamanTamu from '../halaman/HalamanTamu.vue';
import HalamanOrangTua from '../halaman/HalamanOrangTua.vue';
import HalamanSupir from '../halaman/HalamanSupir.vue';
import HalamanAdmin from '../halaman/HalamanAdmin.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Tamu',
    component: HalamanTamu,
    meta: { judul: 'Beranda - Denanta TranSolution' }
  },
  {
    path: '/orangtua',
    name: 'OrangTua',
    component: HalamanOrangTua,
    meta: { judul: 'Dashboard Orang Tua - Denanta TranSolution' }
  },
  {
    path: '/supir',
    name: 'Supir',
    component: HalamanSupir,
    meta: { judul: 'Dashboard Supir - Denanta TranSolution' }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: HalamanAdmin,
    meta: { judul: 'Portal Admin - Denanta TranSolution' }
  },
  // Redirect route yang salah ke beranda
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Update judul halaman dinamis
router.beforeEach((to, _from, next) => {
  const judulDefault = 'Denanta TranSolution';
  document.title = (to.meta.judul as string) || judulDefault;
  next();
});

export default router;
