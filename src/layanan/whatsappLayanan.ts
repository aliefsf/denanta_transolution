const fonnteApiKey = import.meta.env.VITE_WHATSAPP_API_KEY || '';
const fonnteBaseUrl = 'https://api.fonnte.com';

/**
 * Fungsi Inti: Mengirim pesan WhatsApp via Fonnte API Gateway
 */
export async function kirimPesanWhatsApp(
  nomor: string,
  pesan: string,
  urlTemplateMessage?: string
): Promise<{ sukses: boolean; detail?: any }> {
  if (!fonnteApiKey) {
    console.warn('API Key WhatsApp Fonnte tidak ditemukan di file .env. Simulasi log pengiriman:', { nomor, pesan });
    return { sukses: true, detail: 'Simulasi WhatsApp Terkirim (No API Key)' };
  }

  // Format nomor HP agar standar internasional (+62 / 62) jika memakai 0
  let nomorClean = nomor.replace(/[^0-9]/g, '');
  if (nomorClean.startsWith('0')) {
    nomorClean = '62' + nomorClean.slice(1);
  }

  try {
    const payload: any = {
      target: nomorClean,
      message: pesan,
    };

    if (urlTemplateMessage) {
      payload.url = urlTemplateMessage;
    }

    const response = await fetch(`${fonnteBaseUrl}/send`, {
      method: 'POST',
      headers: {
        'Authorization': fonnteApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const hasil = await response.json();
    return {
      sukses: hasil.status === true,
      detail: hasil
    };
  } catch (error) {
    console.error('Error saat mengirim pesan WhatsApp Fonnte:', error);
    return { sukses: false, detail: error };
  }
}

/**
 * Use Case 1: Notifikasi status perjalanan anak (Orang Tua)
 */
export async function kirimNotifPerjalanan(
  nomorOrangTua: string,
  namaSiswa: string,
  status: 'naik_bus' | 'tiba_sekolah' | 'pulang_sekolah' | 'sampai_rumah'
) {
  let deskripsiStatus = '';
  switch (status) {
    case 'naik_bus':
      deskripsiStatus = 'telah naik ke dalam bus antar-jemput dan perjalanan ke sekolah dimulai.';
      break;
    case 'tiba_sekolah':
      deskripsiStatus = 'telah tiba di sekolah tujuan dengan selamat.';
      break;
    case 'pulang_sekolah':
      deskripsiStatus = 'telah selesai sekolah dan naik ke bus untuk perjalanan pulang ke rumah.';
      break;
    case 'sampai_rumah':
      deskripsiStatus = 'telah sampai di rumah dengan selamat.';
      break;
  }

  const pesan = `*Denanta TranSolution - Laporan Perjalanan*\n\nHalo Bapak/Ibu Wali Murid, kami menginfokan bahwa anak Anda *${namaSiswa}* ${deskripsiStatus}\n\nTerima kasih atas kepercayaan Anda.\n_Dipantau secara realtime melalui aplikasi Denanta_`;
  return await kirimPesanWhatsApp(nomorOrangTua, pesan);
}

/**
 * Use Case 2: Pengingat / Tagihan Pembayaran bulanan (Orang Tua)
 */
export async function kirimPengingatTagihan(
  nomorOrangTua: string,
  bulan: string,
  jumlahTotal: number,
  jatohTempo: string = 'Tanggal 7'
) {
  const formatRupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(jumlahTotal);
  
  const pesan = `*Denanta TranSolution - Tagihan Bulanan*\n\nHalo Bapak/Ibu Wali Murid,\nTagihan layanan antar-jemput anak untuk periode *${bulan}* telah terbit sebesar *${formatRupiah}*.\n\nMohon lakukan pembayaran sebelum ${jatohTempo} melalui gerbang pembayaran instan Midtrans di dashboard aplikasi.\n\nTerima kasih.`;
  return await kirimPesanWhatsApp(nomorOrangTua, pesan);
}

/**
 * Use Case 3: Konfirmasi Penugasan Jadwal Supir (Supir)
 */
export async function kirimKonfirmasiPenugasan(
  nomorSupir: string,
  namaSupir: string,
  sekolahMitra: string,
  jumlahSiswa: number,
  sesi: 'pagi' | 'sore'
) {
  const pesan = `*Denanta TranSolution - Tugas Baru*\n\nHalo Driver *${namaSupir}*,\nAnda ditugaskan memimpin armada rute untuk *${sekolahMitra}* pada sesi *${sesi.toUpperCase()}* hari ini.\n\nTotal siswa jemputan: *${jumlahSiswa} Anak*.\nSilakan tinjau koordinat alamat penjemputan dan urutan rute optimal pada menu Tugas Supir.\n\nTetap utamakan keselamatan berkendara!`;
  return await kirimPesanWhatsApp(nomorSupir, pesan);
}

/**
 * Use Case 4: Notifikasi Keputusan Penundaan Pembayaran (Orang Tua)
 */
export async function kirimKeputusanPenundaan(
  nomorOrangTua: string,
  apakahDisetujui: boolean,
  alasanPenolakanAtauBatasPenundaan: string
) {
  const status = apakahDisetujui ? 'DISETUJUI' : 'DITOLAK';
  let detailPesan = '';
  
  if (apakahDisetujui) {
    detailPesan = `Pembayaran ditangguhkan dengan dispensasi toleransi jatuh tempo hingga tanggal ${alasanPenolakanAtauBatasPenundaan}.`;
  } else {
    detailPesan = `Pengajuan tidak dapat kami proses karena: "${alasanPenolakanAtauBatasPenundaan}". Harap segera melunasi tagihan aktif agar layanan penjemputan anak tidak tersuspensi.`;
  }

  const pesan = `*Denanta TranSolution - Keputusan Penangguhan Biaya*\n\nHalo Bapak/Ibu,\nPengajuan penangguhan tagihan bulanan Anda berstatus: *${status}*.\n\nDetail: ${detailPesan}\n\nTerima kasih.`;
  return await kirimPesanWhatsApp(nomorOrangTua, pesan);
}

/**
 * Use Case 5: Pengumuman Massal (Multi Penerima)
 */
export async function kirimPengumumanMassal(
  nomorList: string[],
  pesanPengumuman: string
) {
  console.log(`Mengirim broadcast massal Fonnte ke ${nomorList.length} nomor...`);
  const janjiKirim = nomorList.map(nomor => {
    const formatPesan = `*Denanta TranSolution - Pengumuman Resmi*\n\n${pesanPengumuman}`;
    return kirimPesanWhatsApp(nomor, formatPesan);
  });
  
  const hasil = await Promise.all(janjiKirim);
  const suksesCount = hasil.filter(h => h.sukses).length;
  return {
    total: nomorList.length,
    sukses: suksesCount,
    gagal: nomorList.length - suksesCount
  };
}
