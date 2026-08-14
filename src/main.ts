import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './rute';
import './aset/css/gaya.css';
import App from './App.vue';

// Nonaktifkan restorasi scroll otomatis bawaan browser -- tanpa ini, saat
// halaman di-refresh (F5) browser mengingat & mengembalikan posisi scroll
// terakhir sebelum refresh (mis. landing page yang sempat di-scroll ke
// bawah dekat footer/FAQ akan tetap terbuka di posisi itu setelah refresh,
// bukan dari atas). Anchor hash di URL (mis. /#faq) tetap discroll browser
// secara native, tidak terpengaruh setelan ini.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

function tampilkanKesalahanFatal(pesan: string) {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#1a1a2e;color:#fff;font-family:sans-serif;">
      <div style="max-width:480px;text-align:center;">
        <h1 style="font-size:18px;margin-bottom:12px;">Aplikasi gagal dimuat</h1>
        <p style="font-size:13px;color:#c9c9c9;margin-bottom:16px;white-space:pre-wrap;">${pesan}</p>
        <button onclick="localStorage.clear();sessionStorage.clear();location.reload()" style="background:#e94560;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;">Muat Ulang & Bersihkan Sesi</button>
      </div>
    </div>
  `;
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  const app = createApp(App);

  app.config.errorHandler = (err) => {
    console.error('Vue error:', err);
  };

  app.use(createPinia());
  app.use(router);

  app.mount('#app');
} catch (err: any) {
  console.error('Gagal memuat aplikasi:', err);
  tampilkanKesalahanFatal(err?.message || String(err));
}
