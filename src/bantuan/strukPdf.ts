import jsPDF from 'jspdf';
import { formatMataUang } from './formatMataUang';

export interface ItemStruk {
  label: string;
  jumlah: number;
}

export interface DataStrukPembayaran {
  nomorStruk: string;
  namaOrangTua: string;
  kontakOrangTua?: string | null;
  tanggalBayar: string; // sudah dalam format tampilan (mis. "22 Juli 2026")
  items: ItemStruk[];
  total: number;
  metode?: string;
}

/**
 * Membuat & langsung memicu unduhan struk pembayaran dalam format PDF --
 * dibuat murni di sisi klien (jsPDF), konsisten dengan arsitektur proyek
 * ini yang tidak punya backend (lihat catatan Midtrans simulasi di
 * CLAUDE.md). Dipakai setelah status pembayaran 'lunas', baik di layar
 * konfirmasi wizard berlangganan maupun Riwayat Pembayaran.
 */
export function unduhStrukPembayaran(data: DataStrukPembayaran): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const kiri = 15;
  const kanan = 138 - 15;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 155, 142); // #0F9B8E, warna primer aplikasi
  doc.text('Denanta TranSolution', kiri, y);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Kota Padang, Sumatra Barat', kiri, (y += 5));

  doc.setDrawColor(220, 220, 220);
  doc.line(kiri, (y += 4), kanan, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text('STRUK PEMBAYARAN', kiri, (y += 8));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`No. Struk: ${data.nomorStruk}`, kiri, (y += 7));
  doc.text(`Tanggal Bayar: ${data.tanggalBayar}`, kiri, (y += 5));
  if (data.metode) doc.text(`Metode: ${data.metode}`, kiri, (y += 5));

  doc.text('Diterbitkan Kepada:', kiri, (y += 7));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(data.namaOrangTua, kiri, (y += 5));
  if (data.kontakOrangTua) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(data.kontakOrangTua, kiri, (y += 5));
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(kiri, (y += 5), kanan, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Layanan', kiri, (y += 6));
  doc.text('Jumlah', kanan, y, { align: 'right' });
  doc.line(kiri, (y += 2), kanan, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  for (const item of data.items) {
    y += 6;
    doc.text(item.label, kiri, y);
    doc.text(formatMataUang(item.jumlah), kanan, y, { align: 'right' });
  }

  doc.line(kiri, (y += 4), kanan, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 155, 142);
  doc.text('Total Dibayar', kiri, (y += 7));
  doc.text(formatMataUang(data.total), kanan, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(16, 130, 90);
  doc.text('STATUS: LUNAS', kiri, (y += 9));

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('Struk ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah.', kiri, (y += 10));

  doc.save(`Struk-Pembayaran-${data.nomorStruk}.pdf`);
}
