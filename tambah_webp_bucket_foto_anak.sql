-- Jalankan manual di Supabase SQL Editor.
--
-- Menambahkan image/webp ke daftar format yang diizinkan pada bucket
-- foto-anak (sebelumnya cuma PNG/JPEG/JPG) -- foto profil anak sekarang
-- wajib diisi di seluruh alur tambah anak, jadi format yang diterima
-- diperluas sesuai permintaan.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'foto-anak';
