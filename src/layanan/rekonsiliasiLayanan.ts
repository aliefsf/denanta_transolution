import { supabase } from './supabase';
import { kirimNotifikasi } from './notifikasiLayanan';

interface PembayaranLokal {
  id: string;
  langganan_id: string;
  jumlah: number;
  status: string;
  metode_pembayaran?: string;
}

/**
 * Simulasi pemanggilan API Status Transaksi Midtrans
 * GET /v2/{order_id}/status
 */
async function dapatkanStatusMidtrans(idPesanan: string): Promise<{ status_transaksi: string; tipe_pembayaran: string }> {
  // Simulasi pemanggilan API Midtrans
  console.log(`Mengontak Midtrans API untuk status pesanan: ${idPesanan}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  // Simulasi pengembalian status
  // 30% kemungkinan ada transaksi yang telah dilunasi di Midtrans tapi belum terupdate di lokal
  const acak = Math.random();
  if (acak < 0.3) {
    return { status_transaksi: 'settlement', tipe_pembayaran: 'qris' };
  } else if (acak < 0.5) {
    return { status_transaksi: 'expire', tipe_pembayaran: 'bank_transfer' };
  }
  return { status_transaksi: 'pending', tipe_pembayaran: 'bank_transfer' };
}

/**
 * Fungsi Inti: Melakukan rekonsiliasi data pembayaran lokal dengan API Midtrans
 */
export async function rekonsiliasiPembayaran(): Promise<{
  totalDiperiksa: number;
  totalPerubahan: number;
  rincianPerubahan: Array<{ id: string; statusLama: string; statusBaru: string }>;
}> {
  console.log('--- Memulai Proses Rekonsiliasi Pembayaran Harian ---');
  let daftarPembayaran: PembayaranLokal[] = [];

  // 1. Ambil transaksi berstatus 'Menunggu Pembayaran' dari database Supabase
  if (supabase) {
    const { data, error } = await supabase
      .from('pembayaran')
      .select('id, langganan_id, jumlah, status, metode_pembayaran')
      .eq('status', 'Menunggu Pembayaran');

    if (error) {
      console.error('Gagal mengambil data tagihan pembayaran untuk rekonsiliasi:', error.message);
      return { totalDiperiksa: 0, totalPerubahan: 0, rincianPerubahan: [] };
    }
    daftarPembayaran = data || [];
  } else {
    // Mock data untuk pengujian lokal/sandbox
    daftarPembayaran = [
      { id: 'pay-001', langganan_id: 'sub-01', jumlah: 475000, status: 'Menunggu Pembayaran' },
      { id: 'pay-002', langganan_id: 'sub-02', jumlah: 275000, status: 'Menunggu Pembayaran' },
      { id: 'pay-003', langganan_id: 'sub-03', jumlah: 475000, status: 'Menunggu Pembayaran' }
    ];
  }

  let totalDiperiksa = daftarPembayaran.length;
  let totalPerubahan = 0;
  const rincianPerubahan: Array<{ id: string; statusLama: string; statusBaru: string }> = [];

  // 2. Bandingkan setiap transaksi dengan status resmi di Midtrans
  for (const bayar of daftarPembayaran) {
    try {
      const infoMidtrans = await dapatkanStatusMidtrans(bayar.id);
      let statusTerbaru = bayar.status;

      if (infoMidtrans.status_transaksi === 'settlement' || infoMidtrans.status_transaksi === 'capture') {
        statusTerbaru = 'Lunas';
      } else if (['expire', 'cancel', 'deny'].includes(infoMidtrans.status_transaksi)) {
        statusTerbaru = 'Gagal';
      }

      // Jika ada perbedaan status, lakukan sinkronisasi
      if (statusTerbaru !== bayar.status) {
        if (supabase) {
          await supabase
            .from('pembayaran')
            .update({ 
              status: statusTerbaru,
              metode_pembayaran: infoMidtrans.tipe_pembayaran,
              diperbarui_pada: new Date().toISOString()
            })
            .eq('id', bayar.id);
            
          // Kirim notifikasi sukses lunas atau peringatan gagal
          const { data: dataLangganan } = await supabase
            .from('langganan')
            .select('anak_id')
            .eq('id', bayar.langganan_id)
            .single();

          if (dataLangganan) {
            const { data: dataAnak } = await supabase
              .from('anak')
              .select('orang_tua_id')
              .eq('id', dataLangganan.anak_id)
              .single();

            if (dataAnak) {
              // WAJIB lewat kirimNotifikasi() (RPC SECURITY DEFINER), bukan
              // insert langsung -- tabel notifikasi tidak punya kebijakan
              // RLS INSERT untuk peran non-admin, insert langsung selalu
              // ditolak. `tipe` juga NOT NULL (sebelumnya tidak disertakan
              // sama sekali di sini, jadi insert akan selalu gagal).
              await kirimNotifikasi({
                penggunaId: dataAnak.orang_tua_id,
                judul: 'Rekonsiliasi Billing',
                pesan: `Transaksi Anda dengan kode ${bayar.id} disinkronkan otomatis menjadi: ${statusTerbaru.toUpperCase()}`,
                tipe: 'pembayaran'
              });
            }
          }
        } else {
          console.log(`Simulasi Sinkronisasi Keuangan: Transaksi ${bayar.id} diubah dari "${bayar.status}" menjadi "${statusTerbaru}"`);
        }

        rincianPerubahan.push({
          id: bayar.id,
          statusLama: bayar.status,
          statusBaru: statusTerbaru
        });
        totalPerubahan++;
      }
    } catch (err) {
      console.error(`Gagal melakukan verifikasi status pesanan ${bayar.id}:`, err);
    }
  }

  console.log(`Rekonsiliasi Selesai. Diperiksa: ${totalDiperiksa}, Disinkronkan: ${totalPerubahan}`);
  return {
    totalDiperiksa,
    totalPerubahan,
    rincianPerubahan
  };
}

/**
 * Setup Jadwal Harian: Mengatur pemicuan rekonsiliasi harian otomatis (Cron Job)
 */
export function jalankanJadwalRekonsiliasiHarian(callbackLog?: (logText: string) => void) {
  console.log('Menyambungkan pemicu cron harian untuk pencocokan billing Midtrans...');
  
  // Di server/production, ini dijalankan menggunakan library node-cron:
  // cron.schedule('0 1 * * *', () => { rekonsiliasiPembayaran(); }); // Menjalankan jam 01.00 pagi setiap hari

  // Simulasi di client (menjalankan rekonsiliasi setiap 60 detik untuk keperluan simulasi/testing dashboard)
  const intervalId = setInterval(async () => {
    const hasil = await rekonsiliasiPembayaran();
    if (callbackLog) {
      const timestamp = new Date().toLocaleTimeString();
      callbackLog(`[${timestamp}] Cron Harian: Audit ${hasil.totalDiperiksa} mutasi, disinkronkan: ${hasil.totalPerubahan} transaksi.`);
    }
  }, 60000);

  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('Cron scheduler rekonsiliasi dihentikan.');
    }
  };
}
