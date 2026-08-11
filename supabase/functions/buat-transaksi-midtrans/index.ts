// Edge Function: buat-transaksi-midtrans
// Membuat SATU transaksi Snap Midtrans yang SUNGGUHAN (bukan simulasi) untuk
// satu ATAU LEBIH baris `pembayaran` milik pengguna yang sedang login
// sekaligus (Pembayaran Gabungan Multi-Anak -- checkout/renewal 2+ anak
// dilunasi lewat SATU popup Snap untuk totalnya, bukan satu-satu per anak),
// lalu mengembalikan token Snap ke client agar popup pembayaran asli bisa
// dibuka.
//
// Kenapa ini WAJIB lewat Edge Function (server), bukan langsung dari client:
// Membuat transaksi ke Midtrans butuh Server Key yang rahasia -- kalau
// ditaruh di kode client (browser), siapa pun bisa mengambilnya lewat
// DevTools dan membuat transaksi palsu atas nama toko. Server Key di sini
// disimpan sebagai secret Edge Function (Deno.env.get), TIDAK PERNAH
// dikirim ke browser.
//
// Deploy manual (tidak ada Supabase CLI di environment dev proyek ini):
// buka Supabase Dashboard -> Edge Functions -> Create a new function ->
// beri nama "buat-transaksi-midtrans" -> tempel isi file ini -> Deploy.
// Sebelum deploy, set secret MIDTRANS_SERVER_KEY (dan opsional
// MIDTRANS_IS_PRODUCTION="true" kalau sudah lepas sandbox) lewat
// Project Settings -> Edge Functions -> Secrets.

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
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    const isProduksi = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';

    if (!serverKey) {
      return new Response(JSON.stringify({ error: 'MIDTRANS_SERVER_KEY belum diset sebagai secret Edge Function.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Tidak ada sesi login.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Klien atas nama pemanggil -- RLS tetap berlaku, jadi query pembayaran
    // di bawah otomatis gagal kalau baris itu bukan milik pengguna ini.
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

    const body = await req.json();
    // Terima pembayaranIds (array, alur baru) ATAU pembayaranId tunggal
    // (kompatibel ke belakang) -- selalu dinormalisasi jadi array di sini.
    const pembayaranIds: string[] = Array.isArray(body?.pembayaranIds)
      ? body.pembayaranIds
      : body?.pembayaranId
        ? [body.pembayaranId]
        : [];
    const waktuKlien = body?.waktuKlien;

    if (pembayaranIds.length === 0) {
      return new Response(JSON.stringify({ error: 'pembayaranIds wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: daftarBayar, error: errBayar } = await klienPemanggil
      .from('pembayaran')
      .select('id, jumlah, id_pesanan_midtrans, status')
      .in('id', pembayaranIds);
    if (errBayar || !daftarBayar || daftarBayar.length !== pembayaranIds.length) {
      return new Response(JSON.stringify({ error: 'Data pembayaran tidak ditemukan atau bukan milik Anda.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (daftarBayar.some((b) => b.status === 'lunas')) {
      return new Response(JSON.stringify({ error: 'Salah satu tagihan ini sudah lunas.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: pengguna } = await klienPemanggil
      .from('pengguna')
      .select('nama_lengkap, email, nomor_telepon')
      .eq('id', userData.user.id)
      .single();

    // Midtrans menolak transaction_details.order_id yang PERNAH dipakai
    // sebelumnya (mis. pengguna sempat memilih metode pembayaran lalu
    // membatalkan/menutup popup tanpa menyelesaikannya, lalu klik "Bayar
    // Sekarang" lagi) -- order_id lama tetap dianggap "sudah digunakan" di
    // sisi Midtrans walau transaksinya sendiri tidak pernah selesai. Supaya
    // retry selalu berhasil, order_id baru dibuat & disimpan SETIAP kali
    // fungsi ini dipanggil (webhook mengenali baris pembayaran lewat
    // id_pesanan_midtrans yang berlaku SAAT notifikasi diterima, jadi aman
    // diperbarui di sini). SATU order_id ini ditulis ke SEMUA baris
    // pembayaran yang dibayar bersamaan (kolomnya sudah tidak UNIQUE lagi,
    // lihat hapus_unique_id_pesanan_midtrans.sql) -- itulah yang membuat
    // banyak tagihan bisa lunas sekaligus lewat satu notifikasi webhook.
    const orderIdBaru = `ORDER-DNT-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    // waktuKlien: waktu "sekarang" versi klien (bisa digeser oleh fitur
    // waktu simulasi demo) SAAT transaksi ini dibuat -- dititipkan di sini
    // supaya midtrans-webhook nanti bisa memakainya sbg basis hitung
    // tanggal_berakhir langganan, bukan NOW() server (webhook dipanggil
    // langsung oleh Midtrans, tidak pernah tahu localStorage klien).
    const waktuKlienValid = typeof waktuKlien === 'string' && !isNaN(Date.parse(waktuKlien)) ? waktuKlien : null;
    const { error: errUpdateOrderId } = await klienPemanggil
      .from('pembayaran')
      .update({ id_pesanan_midtrans: orderIdBaru, waktu_klien_transaksi: waktuKlienValid })
      .in('id', pembayaranIds);
    if (errUpdateOrderId) {
      return new Response(JSON.stringify({ error: errUpdateOrderId.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const totalGrossAmount = daftarBayar.reduce((jumlah, b) => jumlah + Math.round(Number(b.jumlah)), 0);

    const midtransUrl = isProduksi
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const authBasic = btoa(`${serverKey}:`);
    const resMidtrans = await fetch(midtransUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${authBasic}`
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderIdBaru,
          gross_amount: totalGrossAmount
        },
        customer_details: {
          first_name: pengguna?.nama_lengkap || 'Pengguna Denanta',
          email: pengguna?.email || userData.user.email,
          phone: pengguna?.nomor_telepon || undefined
        }
      })
    });

    const hasilMidtrans = await resMidtrans.json();
    if (!resMidtrans.ok) {
      return new Response(JSON.stringify({ error: hasilMidtrans?.error_messages?.join(', ') || 'Gagal membuat transaksi Midtrans.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ token: hasilMidtrans.token, redirect_url: hasilMidtrans.redirect_url }), {
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
