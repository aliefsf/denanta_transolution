-- Jalankan manual di Supabase SQL Editor.
--
-- Menambahkan kolom `sedang_bertugas` pada tabel `supir` -- menentukan kapan
-- marker supir muncul di peta Pemantauan Global Admin (ambilPosisiSupirAktif,
-- src/layanan/adminLayanan.ts). Sebelumnya syaratnya dari status baris
-- `perjalanan` (penjemputan/menuju_sekolah/dst), sekarang diganti: true SEJAK
-- supir menekan "Mulai Bertugas" (TugasSupir.vue) sampai seluruh tugas pada
-- sesi itu ditandai selesai. Kolom `tersedia` yang sudah ada TIDAK dipakai
-- untuk ini -- itu murni cerminan absensi harian (status_kehadiran), dipakai
-- utk kelayakan penugasan oleh Admin, konsep yang berbeda.

ALTER TABLE supir
  ADD COLUMN IF NOT EXISTS sedang_bertugas boolean DEFAULT false NOT NULL;
