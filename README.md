# Denanta TranSolution (Denanta TS)

Denanta TranSolution adalah platform integratif manajemen dan pemantauan transportasi antar-jemput sekolah secara real-time. Proyek ini dibangun menggunakan Vue 3 + Vite dengan TypeScript, Tailwind CSS, Pinia, dan diintegrasikan dengan database Supabase serta payment gateway Midtrans.

## Fitur Utama

1. **Pelacakan Live GPS**: Menghubungkan pelacakan koordinat dari supir bus sekolah secara langsung ke dashboard orang tua.
2. **Dashboard Multi-Role**:
   - **Tamu (Guest)**: Halaman landing informasi publik dan pendaftaran kemitraan.
   - **Orang Tua**: Memantau lokasi anak secara real-time, riwayat tagihan, dan rincian armada.
   - **Supir**: Mengirimkan koordinat GPS secara real-time dan mengonfirmasi status jemputan siswa.
   - **Admin**: Mengelola rute, armada supir, akun orang tua, dan konfigurasi API sistem.
3. **Notifikasi WhatsApp**: Notifikasi instan status keberangkatan/ketibaan armada sekolah.
4. **Gerbang Pembayaran**: Integrasi tagihan bulanan/harian sekolah terpadu via Midtrans.

---

## Spesifikasi Teknologi

- **Core Framework**: Vue 3 (Composition API & `<script setup>`)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Kustom Tema Gelap)
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **Real-time & DB**: `@supabase/supabase-js`
- **Peta Interaktif**: `leaflet`
- **Ikonografi**: `lucide-vue-next`
- **HTTP Client**: `axios`

---

## Struktur Folder Proyek

```text
├── public/                 # File statis publik
├── src/
│   ├── aset/               # File aset statis (gambar, font, css global)
│   │   └── css/
│   │       └── gaya.css    # Kustom CSS & Tailwind Directive
│   ├── bantuan/            # Helper/Utility functions (format mata uang, dll)
│   ├── halaman/            # Komponen halaman utama (Views)
│   │   ├── HalamanAdmin.vue
│   │   ├── HalamanOrangTua.vue
│   │   ├── HalamanSupir.vue
│   │   └── HalamanTamu.vue
│   ├── komponen/           # Komponen UI Reusable
│   │   ├── admin/          # Subkomponen dashboard admin
│   │   ├── orangtua/       # Subkomponen dashboard orang tua
│   │   ├── supir/          # Subkomponen dashboard supir
│   │   ├── tamu/           # Subkomponen landing page tamu
│   │   └── umum/           # Komponen umum (tombol, navbar, modal, dll)
│   ├── komposabel/         # Vue composables untuk logic reusable (useAutentikasi, dll)
│   ├── layanan/            # Pemanggilan API (Supabase client, axios, dll)
│   ├── penyimpanan/        # Pinia store untuk state management
│   ├── rute/               # Konfigurasi Vue Router 4
│   ├── tipe/               # TypeScript interfaces & types
│   ├── App.vue             # Komponen Root
│   └── main.ts             # Entry point aplikasi
├── .env.example            # Contoh template environment variables
├── .env                    # Konfigurasi environment lokal (diabaikan oleh git)
├── tailwind.config.js      # Konfigurasi tema Tailwind CSS
├── postcss.config.js       # Konfigurasi PostCSS
├── tsconfig.json           # Konfigurasi TypeScript compiler
└── package.json            # Daftar dependensi & script proyek
```

---

## Panduan Pengembangan Lokal

### 1. Prasyarat
Pastikan Anda telah menginstal Node.js (versi 18+) dan npm di sistem Anda.

### 2. Instalasi Dependensi
Jalankan perintah berikut di direktori proyek:
```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Lalu isi nilai variabel sesuai konfigurasi kredensial layanan Anda (Supabase, Midtrans, WhatsApp API).

### 4. Menjalankan Server Pengembangan
Untuk menjalankan aplikasi secara lokal di mode development:
```bash
npm run dev
```
Buka peramban (browser) dan akses alamat `http://localhost:5173`.

### 5. Kompilasi untuk Produksi
Untuk melakukan build produksi:
```bash
npm run build
```

---

## Branding Warna Kustom (Tema Gelap)

Aplikasi ini menggunakan skema warna tema gelap sesuai branding **Denanta**:
- **Warna Utama (`bg-warnaUtama`)**: `#1a1a2e` (Latar belakang gelap premium)
- **Warna Sekunder (`bg-warnaSekunder`)**: `#16213e` (Latar belakang kartu/panel)
- **Warna Aksen (`bg-warnaAksen`)**: `#0f3460` (Batas panel, hover, dan fokus elemen)
- **Warna Tombol (`bg-warnaTombol`)**: `#e94560` (Tombol aksi utama, pink/merah branding)
