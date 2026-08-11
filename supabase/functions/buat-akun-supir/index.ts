// Edge Function: buat-akun-supir
// Membuat akun login (Supabase Auth) baru untuk supir atas nama admin.
//
// Kenapa ini harus lewat Edge Function (server), bukan langsung dari client:
// supabase.auth.signUp() dari client dengan anon key akan MENGGANTI sesi
// login yang sedang aktif di browser (admin) dengan sesi akun baru itu --
// jadi tidak bisa dipakai admin untuk membuat akun orang lain tanpa
// membajak sesinya sendiri. Fungsi ini berjalan di server memakai
// SUPABASE_SERVICE_ROLE_KEY (auto-tersedia di environment Edge Function,
// TIDAK PERNAH dikirim ke client) lewat supabase.auth.admin.createUser(),
// yang tidak menyentuh sesi browser manapun.
//
// Deploy manual (tidak ada Supabase CLI di environment dev proyek ini):
// buka Supabase Dashboard -> Edge Functions -> Create a new function ->
// beri nama "buat-akun-supir" -> tempel isi file ini -> Deploy.

import { createClient } from 'npm:@supabase/supabase-js@2.47.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Tidak ada sesi login.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Klien atas nama pemanggil (admin) -- dipakai HANYA untuk verifikasi identitas & peran.
    const klienPemanggil = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: errUser } = await klienPemanggil.auth.getUser();
    if (errUser || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sesi login tidak valid.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: penggunaPemanggil, error: errPeran } = await klienPemanggil
      .from('pengguna')
      .select('peran')
      .eq('id', userData.user.id)
      .single();
    if (errPeran || penggunaPemanggil?.peran !== 'admin') {
      return new Response(JSON.stringify({ error: 'Hanya admin yang boleh membuat akun supir.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      email, password, namaLengkap, nomorTelepon, jenisKendaraan, nomorPlat, tipeSupir,
      tanggalMulaiKerja, tanggalSelesaiKerja
    } = body ?? {};

    if (!email || !password || !namaLengkap || !nomorPlat) {
      return new Response(JSON.stringify({ error: 'Data supir belum lengkap.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Supir "sementara" wajib punya tanggal mulai bekerja -- tanggal selesai
    // opsional, kalau kosong disamakan dengan tanggal mulai (akun hanya
    // aktif 1 hari). Lihat nonaktifkanSupirSementaraKedaluwarsa() di
    // src/layanan/adminLayanan.ts untuk enforcement-nya.
    if (tipeSupir === 'sementara' && !tanggalMulaiKerja) {
      return new Response(JSON.stringify({ error: 'Tanggal mulai bekerja wajib diisi untuk supir sementara.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const tanggalSelesaiKerjaFinal = tipeSupir === 'sementara' ? (tanggalSelesaiKerja || tanggalMulaiKerja) : null;

    // Klien service-role -- bypass RLS, dipakai untuk membuat akun & baris supir.
    const klienAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userBaru, error: errBuat } = await klienAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        peran: 'supir',
        nama_lengkap: namaLengkap,
        nomor_telepon: nomorTelepon ?? ''
      }
    });
    if (errBuat) {
      return new Response(JSON.stringify({ error: errBuat.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // trg_pengguna_baru (lihat skema_database.sql) otomatis membuat baris
    // public.pengguna + public.supir begitu auth.users ter-insert. Lengkapi
    // detail kendaraan yang tidak diisi trigger (defaultnya string kosong).
    // status_verifikasi langsung "terverifikasi" karena dokumen sudah
    // diperiksa admin sendiri saat mengisi formulir ini. `aktif: true`
    // SENGAJA disetel eksplisit di sini -- kolom `aktif` pada tabel `supir`
    // punya DEFAULT false (dirancang untuk alur pendaftaran mandiri yang
    // butuh verifikasi admin dulu), tapi akun yang dibuat LEWAT FORM ADMIN
    // INI sudah pasti diverifikasi admin sendiri saat itu juga, jadi wajar
    // langsung aktif tanpa perlu langkah tambahan "aktifkan" manual di popup
    // Edit Supir setelahnya.
    const { error: errSupir } = await klienAdmin
      .from('supir')
      .update({
        jenis_kendaraan: jenisKendaraan ?? '',
        nomor_plat: nomorPlat,
        tipe_supir: tipeSupir ?? 'tetap',
        status_verifikasi: 'terverifikasi',
        aktif: true,
        tanggal_mulai_kerja: tipeSupir === 'sementara' ? tanggalMulaiKerja : null,
        tanggal_selesai_kerja: tanggalSelesaiKerjaFinal
      })
      .eq('id', userBaru.user.id);
    if (errSupir) {
      return new Response(JSON.stringify({ error: errSupir.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ id: userBaru.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Terjadi kesalahan tak terduga.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
