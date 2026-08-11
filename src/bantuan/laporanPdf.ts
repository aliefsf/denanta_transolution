import jsPDF from 'jspdf';

/**
 * Cetak tabel laporan sederhana (header + baris, auto page-break) ke PDF,
 * lalu langsung memicu unduhan. Branding disamakan dengan strukPdf.ts.
 */
export function unduhLaporanPdf(
  judul: string,
  header: string[],
  baris: (string | number)[][],
  namaFile: string
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const kiri = 15;
  const kanan = 210 - 15;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 155, 142); // #0F9B8E, warna primer aplikasi
  doc.text('Denanta TranSolution', kiri, y);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Portal Admin — Laporan & Analisis Data', kiri, (y += 5));

  doc.setDrawColor(220, 220, 220);
  doc.line(kiri, (y += 4), kanan, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(judul, kiri, (y += 9));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Dicetak pada ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} WIB`,
    kiri,
    (y += 5)
  );

  y += 6;
  const jumlahKolom = header.length;
  const lebarKolom = (kanan - kiri) / jumlahKolom;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  header.forEach((h, i) => doc.text(h, kiri + i * lebarKolom, y));
  y += 2;
  doc.setDrawColor(30, 30, 30);
  doc.line(kiri, y, kanan, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  for (const row of baris) {
    y += 7;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      const teks = doc.splitTextToSize(String(cell), lebarKolom - 3) as string[];
      doc.text(teks, kiri + i * lebarKolom, y);
    });
  }

  if (baris.length === 0) {
    y += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Tidak ada data pada periode ini.', kiri, y);
  }

  doc.save(namaFile.endsWith('.pdf') ? namaFile : `${namaFile}.pdf`);
}
