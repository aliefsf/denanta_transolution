-- Jalankan manual di Supabase SQL Editor.
--
-- Bucket Storage untuk foto profil anak (opsional, diisi orang tua) --
-- ditampilkan di kartu tugas Supir, peta rute navigasi, dsb. Mengikuti pola
-- yang sama dengan bucket profile-images (public-read, hanya pemilik yang
-- boleh unggah/ubah/hapus) -- lihat blok "STORAGE: BUCKET FOTO PROFIL" di
-- skema_database.sql sebagai referensi pola. Struktur path objek:
-- foto-anak/{orang_tua_id}/{anak_id}.jpg -- folder root HARUS sama dengan
-- auth.uid() orang tua yang login (BUKAN anak_id, karena anak tidak punya
-- akun auth sendiri), supaya kebijakan folder-ownership di bawah berlaku.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'foto-anak',
  'foto-anak',
  true,
  2097152, -- 2 MB, selaras dengan validasi ukuran di frontend
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Foto Anak: Orang tua mengunggah foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua mengunggah foto anak miliknya sendiri"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Anak: Siapa saja dapat melihat (public-read)" ON storage.objects;
CREATE POLICY "Foto Anak: Siapa saja dapat melihat (public-read)"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'foto-anak');

DROP POLICY IF EXISTS "Foto Anak: Orang tua memperbarui foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua memperbarui foto anak miliknya sendiri"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Foto Anak: Orang tua menghapus foto anak miliknya sendiri" ON storage.objects;
CREATE POLICY "Foto Anak: Orang tua menghapus foto anak miliknya sendiri"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'foto-anak'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
