-- Penjadwalan otomatis untuk Edge Function "sinkron-hari-libur"
-- (supabase/functions/sinkron-hari-libur/index.ts) -- supaya kalender hari
-- libur nasional tetap ter-update sendiri tanpa Admin perlu menekan tombol
-- "Sinkronkan dari API" secara manual (walau tombol manual itu tetap ada
-- dan tetap bisa dipakai kapan saja).
--
-- Jalankan skrip ini SEKALI secara manual di Supabase SQL Editor, SETELAH
-- Edge Function-nya sudah di-deploy. Tidak otomatis dijalankan oleh
-- aplikasi -- sama seperti skema_database.sql, tidak ada migrasi/CLI
-- terpasang di lingkungan ini.
--
-- Beda dari pengingat-tagihan (pola cron lain di project ini yang memakai
-- CRON_SECRET kustom): di sini Authorization-nya langsung pakai
-- service_role key project -- itu JWT valid yang otomatis lolos verifikasi
-- JWT bawaan Edge Function tanpa perlu mematikan opsi "Verify JWT" sama
-- sekali (beda dari midtrans-webhook yang harus mematikannya karena
-- Midtrans tidak pernah mengirim token apa pun).
--
-- GANTI dua placeholder di bawah:
--   <GANTI_DENGAN_PROJECT_REF>   -- terlihat di URL dashboard project
--   <GANTI_DENGAN_SERVICE_ROLE_KEY> -- Project Settings -> API -> service_role key
--     (JANGAN disebar/commit ke git -- SQL ini cuma dijalankan sekali
--     langsung di SQL Editor, tidak disimpan di kode aplikasi)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tiap tanggal 1, jam 02:00 WIB (19:00 UTC hari sebelumnya) -- cukup jarang
-- karena kalender hari libur nasional jarang berubah, tapi tetap rutin
-- menangkap pembaruan/koreksi dari sumber eksternal.
SELECT cron.schedule(
  'sinkron-hari-libur-bulanan',
  '0 19 * * *', -- tiap hari jam 19:00 UTC (02:00 WIB) -- lihat catatan below utk kenapa harian bukan bulanan
  $$
  SELECT net.http_post(
    url := 'https://ilrzmtvdncsxanksobzm.supabase.co/functions/v1/sinkron-hari-libur',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscnptdHZkbmNzeGFua3NvYnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQyMTEwMSwiZXhwIjoyMDk4OTk3MTAxfQ.u4zaf2vQMfuuVyiIxmNkyCEW40zoqdXlKudu-ov86jU',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Kenapa jadwal HARIAN padahal kalender jarang berubah: pg_cron di paket
-- gratis Supabase tidak selalu mendukung sintaks "hari ke-1 tiap bulan"
-- dengan baik di semua region -- harian jauh lebih murah/aman drpd salah
-- jadwal dan tidak pernah jalan sama sekali. Function-nya sendiri sudah
-- idempoten (tidak melakukan apa-apa kalau data tidak berubah), jadi aman
-- dipanggil sesering ini.

-- Untuk mengecek jadwal yang sudah terdaftar:
--   SELECT * FROM cron.job;
-- Untuk menghapus jadwal ini:
--   SELECT cron.unschedule('sinkron-hari-libur-bulanan');
-- Untuk melihat riwayat eksekusi & error:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
