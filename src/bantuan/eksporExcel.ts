/**
 * Helper generik untuk mengekspor data tabel ke file Excel (.xlsx) SUNGGUHAN
 * yang rapi & terstruktur -- header berwarna, tebal, kolom otomatis
 * menyesuaikan lebar isi, baris berselang-seling, dan seluruh sel diberi
 * garis tabel. Menggantikan unduhCsv() lama (CSV murni teks tanpa metadata
 * apa pun, jadi TIDAK MUNGKIN punya warna/border/format sekuat apa pun
 * headernya ditulis -- itu keterbatasan format .csv itu sendiri, bukan
 * bug) -- satu-satunya cara laporan tampil "menarik" saat dibuka di Excel
 * adalah dengan benar-benar menulis file .xlsx, bukan .csv.
 */

const WARNA_HEADER = 'FF006B5A'; // primary teal aplikasi (ARGB)
const WARNA_HEADER_TEKS = 'FFFFFFFF';
const WARNA_JUDUL_TEKS = 'FF171D1B';
const WARNA_BARIS_GANJIL = 'FFFFFFFF';
const WARNA_BARIS_GENAP = 'FFF5FBF7'; // senada surface-container app
const WARNA_GARIS = 'FFD9E2DE';

export async function unduhExcel(
  judul: string,
  namaFile: string,
  header: string[],
  baris: (string | number)[][]
): Promise<void> {
  // Diimpor dinamis (bukan import statis di puncak file) -- exceljs
  // ukurannya besar dan cuma dipakai di satu halaman admin (LaporanAdmin.vue,
  // di balik klik tombol "Ekspor Excel"), jadi tidak perlu ikut membengkakkan
  // bundle utama yang dimuat SEMUA pengguna (termasuk landing page publik).
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Denanta TranSolution';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Laporan', {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const jumlahKolom = header.length;

  // Baris 1: Judul laporan -- digabung (merge) selebar tabel, huruf besar tebal.
  sheet.mergeCells(1, 1, 1, jumlahKolom);
  const selJudul = sheet.getCell(1, 1);
  selJudul.value = judul;
  selJudul.font = { size: 14, bold: true, color: { argb: WARNA_JUDUL_TEKS } };
  selJudul.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 26;

  // Baris 2: waktu ekspor -- konteks kapan data ini diambil.
  sheet.mergeCells(2, 1, 2, jumlahKolom);
  const selWaktu = sheet.getCell(2, 1);
  selWaktu.value = `Diekspor pada ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}`;
  selWaktu.font = { size: 9, italic: true, color: { argb: 'FF6D7A75' } };

  // Baris 3: baris kosong pemisah kecil antara judul & tabel data.
  sheet.getRow(3).height = 6;

  // Baris 4: header tabel -- latar warna primary, teks putih tebal, border.
  const barisHeader = sheet.getRow(4);
  header.forEach((teks, idx) => {
    const sel = barisHeader.getCell(idx + 1);
    sel.value = teks;
    sel.font = { bold: true, color: { argb: WARNA_HEADER_TEKS }, size: 10 };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA_HEADER } };
    sel.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sel.border = {
      top: { style: 'thin', color: { argb: WARNA_GARIS } },
      bottom: { style: 'thin', color: { argb: WARNA_GARIS } },
      left: { style: 'thin', color: { argb: WARNA_GARIS } },
      right: { style: 'thin', color: { argb: WARNA_GARIS } }
    };
  });
  barisHeader.height = 22;

  // Baris data -- mulai baris 5, berselang-seling warna, semua sel bergaris.
  baris.forEach((baris1, idxBaris) => {
    const row = sheet.getRow(5 + idxBaris);
    const warnaLatar = idxBaris % 2 === 0 ? WARNA_BARIS_GANJIL : WARNA_BARIS_GENAP;
    baris1.forEach((nilai, idxKolom) => {
      const sel = row.getCell(idxKolom + 1);
      sel.value = nilai;
      sel.font = { size: 10, color: { argb: 'FF171D1B' } };
      sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warnaLatar } };
      sel.alignment = { vertical: 'middle', horizontal: typeof nilai === 'number' ? 'right' : 'left' };
      sel.border = {
        top: { style: 'thin', color: { argb: WARNA_GARIS } },
        bottom: { style: 'thin', color: { argb: WARNA_GARIS } },
        left: { style: 'thin', color: { argb: WARNA_GARIS } },
        right: { style: 'thin', color: { argb: WARNA_GARIS } }
      };
    });
    row.height = 20;
  });

  // Lebar kolom otomatis mengikuti konten terpanjang (header ATAU baris data),
  // dibatasi 60 karakter supaya kolom deskripsi panjang tidak melebar berlebihan.
  header.forEach((judulKolom, idx) => {
    const panjangHeader = judulKolom.length;
    const panjangMaksData = baris.reduce((maks, b) => Math.max(maks, String(b[idx] ?? '').length), 0);
    sheet.getColumn(idx + 1).width = Math.min(Math.max(panjangHeader, panjangMaksData) + 4, 60);
  });

  // Baris ringkasan jumlah data di paling bawah.
  const barisRingkasan = sheet.getRow(5 + baris.length + 1);
  sheet.mergeCells(barisRingkasan.number, 1, barisRingkasan.number, jumlahKolom);
  const selRingkasan = barisRingkasan.getCell(1);
  selRingkasan.value = `Total ${baris.length} baris data.`;
  selRingkasan.font = { size: 9, italic: true, color: { argb: 'FF6D7A75' } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile.endsWith('.xlsx') ? namaFile : `${namaFile}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
