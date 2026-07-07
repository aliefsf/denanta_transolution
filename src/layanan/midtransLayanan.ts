import { supabase } from './supabase';

const kunciKlien = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-demo';
const kunciServer = import.meta.env.VITE_MIDTRANS_SERVER_KEY || 'SB-Mid-server-demo';
const isSandbox = true; // Mode Sandbox untuk development/pengujian

// Helper untuk memuat script Snap.js secara dinamis di frontend
export function muatScriptSnap(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('midtrans-snap-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    // Gunakan URL Sandbox atau Production sesuai env
    script.src = isSandbox 
      ? 'https://app.sandbox.midtrans.com/snap/snap.js'
      : 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', kunciKlien);
    
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    
    document.body.appendChild(script);
  });
}

// Interface parameter transaksi
interface DetailPelanggan {
  nama: string;
  email: string;
  telepon: string;
}

interface DetailItem {
  id: string;
  harga: number;
  nama: string;
  kuantitas: number;
}

/**
 * Backend Mock / Client API Helper untuk membuat transaksi Snap Midtrans
 * POST /api/pembayaran/buat
 */
export async function buatTransaksiMidtrans(
  idPesanan: string,
  jumlahTotal: number,
  detailPelanggan: DetailPelanggan,
  detailItem: DetailItem[]
): Promise<{ tokenSnap: string; urlRedirect: string }> {
  // Simulasi pemanggilan API backend /api/pembayaran/buat
  console.log('Meminta token Snap dari backend Midtrans...', { idPesanan, jumlahTotal, detailPelanggan, detailItem });

  // Simulasi jeda jaringan
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Buat mock token Snap dan URL pembayaran
  const tokenSnapMock = `snap-token-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const urlRedirectMock = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${tokenSnapMock}`;

  return {
    tokenSnap: tokenSnapMock,
    urlRedirect: urlRedirectMock
  };
}

/**
 * Integrasi Frontend: Menampilkan pop-up pembayaran Snap Midtrans
 */
export async function bayarDenganMidtrans(
  tokenSnap: string,
  onSukses?: (hasil: any) => void,
  onMenunggu?: (hasil: any) => void,
  onError?: (err: any) => void
) {
  const scriptLoaded = await muatScriptSnap();
  if (!scriptLoaded) {
    if (onError) onError(new Error('Gagal memuat skrip pembayaran Midtrans Snap.js'));
    return;
  }

  // Panggil window.snap.pay yang disediakan oleh snap.js
  const snap = (window as any).snap;
  if (!snap) {
    if (onError) onError(new Error('Modul pembayaran Snap tidak ditemukan pada browser.'));
    return;
  }

  snap.pay(tokenSnap, {
    onSuccess: function (result: any) {
      console.log('Pembayaran Midtrans Sukses:', result);
      if (onSukses) onSukses(result);
    },
    onPending: function (result: any) {
      console.log('Pembayaran Midtrans Menunggu:', result);
      if (onMenunggu) onMenunggu(result);
    },
    onError: function (result: any) {
      console.error('Pembayaran Midtrans Error:', result);
      if (onError) onError(result);
    },
    onClose: function () {
      console.log('Pop-up pembayaran Midtrans ditutup oleh pengguna.');
    }
  });
}

/**
 * Verifikasi Hash Signature untuk keamanan Webhook (SHA-512)
 * Kriteria Midtrans: SHA512(order_id + status_code + gross_amount + server_key)
 */
export async function verifikasiSignatureMidtrans(
  idPesanan: string,
  statusCode: string,
  jumlahTotal: string,
  signatureKlien: string
): Promise<boolean> {
  // Dalam production, generate SHA-512 menggunakan library crypto NodeJS:
  // const hash = crypto.createHash('sha512').update(idPesanan + statusCode + jumlahTotal + ServerKey).digest('hex');
  // return hash === signatureKlien;

  // Mock verifikasi signature di client/simulasi dengan menyertakan semua parameter input
  console.log('Memverifikasi signature webhook Midtrans...', { 
    idPesanan, 
    statusCode, 
    jumlahTotal, 
    signatureKlien,
    kunciServerAktif: kunciServer.substring(0, 6) + '***'
  });
  return true;
}

/**
 * Handler Webhook Notifikasi Midtrans
 * POST /api/pembayaran/notifikasi
 */
export async function prosesNotifikasiMidtrans(dataNotifikasi: {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  payment_type: string;
}) {
  const { order_id, transaction_status, status_code, gross_amount, signature_key } = dataNotifikasi;

  // 1. Verifikasi Signature Key untuk keamanan
  const valid = await verifikasiSignatureMidtrans(order_id, status_code, gross_amount, signature_key);
  if (!valid) {
    throw new Error('Midtrans Webhook Security Warning: Invalid Signature Key!');
  }

  // 2. Tentukan status pembayaran lokal
  let statusPembayaranBaru = 'Menunggu';
  if (transaction_status === 'capture' || transaction_status === 'settlement') {
    statusPembayaranBaru = 'Lunas';
  } else if (transaction_status === 'pending') {
    statusPembayaranBaru = 'Menunggu Pembayaran';
  } else if (['deny', 'expire', 'cancel'].includes(transaction_status)) {
    statusPembayaranBaru = 'Gagal';
  }

  // 3. Update status pembayaran di database Supabase
  if (supabase) {
    const { error: errUpdate } = await supabase
      .from('pembayaran')
      .update({ 
        status: statusPembayaranBaru,
        metode_pembayaran: dataNotifikasi.payment_type,
        diperbarui_pada: new Date().toISOString()
      })
      .eq('id', order_id);

    if (errUpdate) {
      console.error('Gagal memperbarui status tabel pembayaran di Supabase:', errUpdate.message);
      return { status: 'error', pesan: errUpdate.message };
    }

    // 4. Kirim notifikasi realtime ke pengguna (tabel notifikasi)
    // Ambil data pembayaran untuk mengetahui orang_tua_id
    const { data: dataBayar } = await supabase
      .from('pembayaran')
      .select('langganan_id')
      .eq('id', order_id)
      .single();

    if (dataBayar) {
      const { data: dataLangganan } = await supabase
        .from('langganan')
        .select('anak_id')
        .eq('id', dataBayar.langganan_id)
        .single();

      if (dataLangganan) {
        const { data: dataAnak } = await supabase
          .from('anak')
          .select('orang_tua_id')
          .eq('id', dataLangganan.anak_id)
          .single();

        if (dataAnak) {
          await supabase.from('notifikasi').insert({
            pengguna_id: dataAnak.orang_tua_id,
            judul: 'Konfirmasi Pembayaran',
            pesan: `Pembayaran tagihan Anda dengan kode transaksi ${order_id} berstatus ${statusPembayaranBaru.toUpperCase()}`,
            dibaca: false
          });
        }
      }
    }
  } else {
    console.log('Simulasi Database Update: Mengubah status pembayaran', order_id, 'menjadi', statusPembayaranBaru);
  }

  return { status: 'sukses', status_pembayaran: statusPembayaranBaru };
}
