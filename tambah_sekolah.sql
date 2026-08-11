-- Tambah 2 data sekolah baru.
-- Catatan: alamat & koordinat masih placeholder (pusat Kota Padang),
-- silakan update ke alamat/koordinat asli sekolah setelah ini dijalankan.
INSERT INTO public.sekolah (nama, alamat, lintang, bujur)
VALUES
  ('SDSIT KARAKTER ANAK SHALIH', 'Jl. Rawang Ketaping, Ps. Ambacang, Kec. Kuranji, Kota Padang, Sumatera Barat 25176', -0.9400442690346994, 100.39600599428269),
  ('SDSIT DAR EL IMAN AKHWAT', 'Jl. Gurun Laweh No.22, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173', -0.9031330115101643, 100.37499130962507);

-- Verifikasi
SELECT id, nama, alamat, lintang, bujur FROM public.sekolah ORDER BY dibuat_pada DESC LIMIT 5;
