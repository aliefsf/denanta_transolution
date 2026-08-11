-- =====================================================================
-- Buat akun admin langsung di Supabase Auth via SQL Editor.
-- Email   : admin@gmail.com
-- Password: admin123
--
-- Trigger trg_pengguna_baru (sudah aktif dari perbaikan sebelumnya) akan
-- otomatis membuat baris public.pengguna dengan peran 'admin' begitu baris
-- auth.users ini ter-insert -- tidak perlu insert manual ke public.pengguna.
--
-- Aman dijalankan ulang: kalau email sudah terdaftar, blok ini akan
-- di-skip lewat pengecekan IF NOT EXISTS di bawah.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_instance_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
    RAISE NOTICE 'Akun admin@gmail.com sudah ada, tidak dibuat ulang.';
    RETURN;
  END IF;

  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_instance_id,
    v_user_id,
    'authenticated',
    'authenticated',
    'admin@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('peran', 'admin', 'nama_lengkap', 'Administrator'),
    now(),
    now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    created_at, updated_at, last_sign_in_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@gmail.com'),
    'email',
    now(),
    now(),
    now()
  );
END $$;

-- Verifikasi
SELECT u.id, u.email, p.peran, p.nama_lengkap
FROM auth.users u
LEFT JOIN public.pengguna p ON p.id = u.id
WHERE u.email = 'admin@gmail.com';
