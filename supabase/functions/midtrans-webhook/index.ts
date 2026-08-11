// Edge Function: midtrans-webhook
// Endpoint publik yang dipanggil LANGSUNG OLEH MIDTRANS (bukan oleh
// aplikasi/browser) setiap kali status suatu transaksi berubah (HTTP
// Notification). Di sinilah status pembayaran di database benar-benar
// dikonfirmasi/lunas -- bukan dari client, supaya tidak ada yang bisa
// "curang" menandai tagihannya sendiri lunas lewat console browser.
//
// PENTING saat deploy manual lewat Supabase Dashboard (Edge Functions ->
// Create a new function -> nama "midtrans-webhook" -> tempel isi file ini):
// WAJIB matikan opsi "Verify JWT" / "Enforce JWT Verification" untuk
// function ini saat membuat/mengedit -- Midtrans tidak mengirim token
// Supabase, jadi kalau verifikasi JWT masih menyala, semua notifikasi dari
// Midtrans akan otomatis ditolak 401 sebelum sempat sampai ke kode ini.
// Keamanannya digantikan oleh verifikasi signature_key di bawah.
//
// Setelah deploy, daftarkan URL function ini
// (https://<project-ref>.supabase.co/functions/v1/midtrans-webhook) sebagai
// "Payment Notification URL" di Midtrans Dashboard -> Settings ->
// Configuration.
//
// Secret yang dibutuhkan (Project Settings -> Edge Functions -> Secrets):
// MIDTRANS_SERVER_KEY (sama dengan yang dipakai buat-transaksi-midtrans).

import { createClient } from 'npm:@supabase/supabase-js@2.47.10';

async function sha512Hex(teks: string): Promise<string> {
  const data = new TextEncoder().encode(teks);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      return new Response(JSON.stringify({ error: 'MIDTRANS_SERVER_KEY belum diset.' }), { status: 500 });
    }

    const body = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status
    } = body ?? {};

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return new Response(JSON.stringify({ error: 'Payload notifikasi tidak lengkap.' }), { status: 400 });
    }

    // Verifikasi signature sesuai dokumentasi Midtrans:
    // SHA512(order_id + status_code + gross_amount + ServerKey)
    const signatureAsli = await sha512Hex(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (signatureAsli !== signature_key) {
      return new Response(JSON.stringify({ error: 'Signature tidak valid.' }), { status: 403 });
    }

    const klienAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Pembayaran Gabungan Multi-Anak: satu order_id Midtrans bisa terdaftar
    // di LEBIH DARI SATU baris `pembayaran` (satu per anak, lihat
    // buat-transaksi-midtrans/index.ts) -- kolomnya sengaja tidak lagi
    // UNIQUE, jadi query ini WAJIB mengambil semua baris, bukan .single().
    const { data: daftarBayar, error: errBayar } = await klienAdmin
      .from('pembayaran')
      .select('id, langganan_id, orang_tua_id, status, tipe_pembayaran, waktu_klien_transaksi, periode_bulan')
      .eq('id_pesanan_midtrans', order_id);
    if (errBayar || !daftarBayar || daftarBayar.length === 0) {
      return new Response(JSON.stringify({ error: 'Data pembayaran untuk order_id ini tidak ditemukan.' }), { status: 404 });
    }

    let statusBaru: 'lunas' | 'gagal' | 'menunggu' = 'menunggu';
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      statusBaru = 'lunas';
    } else if (['expire', 'cancel', 'deny'].includes(transaction_status)) {
      statusBaru = 'gagal';
    }

    // Notifikasi bisa dikirim Midtrans lebih dari sekali untuk transaksi
    // yang sama (retry) -- baris yang statusnya sudah final (lunas)
    // dilewati satu-satu supaya tanggal_mulai/tanggal_berakhir langganannya
    // tidak ikut ter-reset oleh notifikasi susulan yang telat. Kalau
    // SEMUA baris di batch ini sudah lunas, tidak ada kerjaan sama sekali.
    const bayarBelumLunas = daftarBayar.filter((b) => b.status !== 'lunas');
    if (bayarBelumLunas.length === 0) {
      return new Response(JSON.stringify({ status: 'sudah_diproses_sebelumnya' }), { status: 200 });
    }

    const transaksiId: string | undefined = body.transaction_id;
    const idBelumLunas = bayarBelumLunas.map((b) => b.id);

    const { error: errUpdateBayar } = await klienAdmin
      .from('pembayaran')
      .update({
        status: statusBaru,
        id_transaksi_midtrans: transaksiId ?? null,
        tanggal_pembayaran: statusBaru === 'lunas' ? new Date().toISOString() : null,
        diperbarui_pada: new Date().toISOString()
      })
      .in('id', idBelumLunas);
    if (errUpdateBayar) {
      return new Response(JSON.stringify({ error: errUpdateBayar.message }), { status: 500 });
    }

    // Kalau lunas dan ini pembayaran langganan (bukan biaya tambahan lepas),
    // aktifkan langganannya SATU PER SATU -- hitung ulang masa aktif dari
    // SEKARANG (saat pembayaran benar-benar dikonfirmasi), bukan dari
    // tanggal draft dibuat. Tiap anak dalam batch ini bisa punya
    // tipe_pembayaran (bulanan/harian) berbeda, jadi hariBerlaku dihitung
    // per baris, bukan sekali untuk semuanya.
    if (statusBaru === 'lunas') {
      for (const bayar of bayarBelumLunas) {
        if (!bayar.langganan_id) continue;
        const hariBerlaku = bayar.tipe_pembayaran === 'harian' ? 1 : 30;
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        // `periode_bulan` terisi HANYA untuk pembayaran "Bayar Periode
        // Berikutnya" (dibayar LEBIH AWAL, mulai H-7 sebelum tanggal_jatuh_tempo
        // siklus yang sedang berjalan -- lihat RiwayatPembayaran.vue) --
        // langganannya SAAT INI masih aktif & belum berakhir. Basis
        // perpanjangan HARUS tanggal_berakhir yang SUDAH ADA (bukan waktu
        // transaksi/"sekarang"), supaya periode baru MENYAMBUNG persis
        // dari akhir periode lama, bukan malah memotong sisa hari periode
        // berjalan yang sebenarnya belum habis (mis. dibayar tanggal 24
        // Agustus utk periode berikutnya, TIDAK boleh membuat periode baru
        // dihitung mulai 24 Agustus -- harus tetap mulai dari tanggal
        // 31 Agustus, akhir periode berjalan yang sudah dibayar sebelumnya).
        let basisMulai: Date;
        if (bayar.periode_bulan) {
          const { data: langgananSaatIni, error: errBaca } = await klienAdmin
            .from('langganan')
            .select('tanggal_berakhir')
            .eq('id', bayar.langganan_id)
            .single();
          if (errBaca) {
            return new Response(JSON.stringify({ error: errBaca.message }), { status: 500 });
          }
          basisMulai = new Date(langgananSaatIni.tanggal_berakhir);
        } else {
          // Pembayaran biasa (wizard/reaktivasi) -- pakai waktu klien (bisa
          // digeser fitur waktu simulasi demo) kalau dititipkan saat
          // transaksi dibuat, webhook ini dipanggil langsung oleh Midtrans
          // (server-to-server) jadi NOW() server TIDAK ikut waktu simulasi
          // klien kalau tidak dititipkan begini.
          basisMulai = bayar.waktu_klien_transaksi ? new Date(bayar.waktu_klien_transaksi) : new Date();
        }

        const berakhir = new Date(basisMulai);
        berakhir.setDate(berakhir.getDate() + hariBerlaku);

        const { error: errLangganan } = await klienAdmin
          .from('langganan')
          .update({
            sudah_dibayar: true,
            tanggal_mulai: fmt(basisMulai),
            tanggal_berakhir: fmt(berakhir),
            tanggal_jatuh_tempo: fmt(berakhir)
          })
          .eq('id', bayar.langganan_id);
        if (errLangganan) {
          return new Response(JSON.stringify({ error: errLangganan.message }), { status: 500 });
        }
      }
    }

    // Notifikasi ke orang tua -- insert langsung (klien service-role bypass
    // RLS, tidak perlu lewat RPC buat_notifikasi seperti dari client biasa).
    // Satu notifikasi untuk seluruh batch (semua baris dalam satu order_id
    // dibuat oleh orang tua yang sama), bukan satu per anak, supaya tidak
    // membanjiri daftar notifikasi kalau checkout-nya untuk banyak anak.
    const orangTuaId = bayarBelumLunas[0].orang_tua_id;
    const jumlahAnak = bayarBelumLunas.length;
    await klienAdmin.from('notifikasi').insert({
      pengguna_id: orangTuaId,
      judul: statusBaru === 'lunas' ? 'Pembayaran Berhasil' : 'Pembayaran Gagal',
      pesan: statusBaru === 'lunas'
        ? `Pembayaran Anda dengan kode ${order_id} (${jumlahAnak} tagihan) telah dikonfirmasi lunas.`
        : `Pembayaran Anda dengan kode ${order_id} gagal/dibatalkan. Silakan coba lagi.`,
      tipe: 'pembayaran'
    });

    // Beri tahu Admin juga tiap kali ada pembayaran yang BERHASIL dikonfirmasi
    // lunas -- SEBELUMNYA cuma orang tua yang diberi tahu, Admin tidak
    // punya cara tahu ada transaksi baru selain cek manual berkala di menu
    // Keuangan. Sengaja hanya untuk 'lunas' (bukan 'gagal') -- transaksi
    // gagal/dibatalkan orang tua tidak butuh tindak lanjut Admin apa pun.
    if (statusBaru === 'lunas') {
      const { data: daftarAdmin } = await klienAdmin.from('pengguna').select('id').eq('peran', 'admin');
      if (daftarAdmin && daftarAdmin.length > 0) {
        await klienAdmin.from('notifikasi').insert(
          daftarAdmin.map((a: { id: string }) => ({
            pengguna_id: a.id,
            judul: 'Pembayaran Diterima',
            pesan: `Pembayaran dengan kode ${order_id} (${jumlahAnak} tagihan) telah dikonfirmasi lunas oleh Midtrans.`,
            tipe: 'pembayaran',
            tipe_terkait: 'pembayaran_diterima'
          }))
        );
      }
    }

    return new Response(JSON.stringify({ status: 'ok', status_pembayaran: statusBaru, jumlah_diproses: idBelumLunas.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Terjadi kesalahan tak terduga.' }), { status: 500 });
  }
});
