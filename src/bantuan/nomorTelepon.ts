/**
 * Menormalkan nomor telepon (mis. "0812-3456-7890") ke format internasional
 * tanpa simbol (mis. "6281234567890") yang dipakai skema URL wa.me & API
 * WhatsApp Fonnte -- pola sama dengan normalisasi di layanan/whatsappLayanan.ts.
 */
export function formatNomorWhatsapp(nomor: string): string {
  let nomorBersih = nomor.replace(/[^0-9]/g, '');
  if (nomorBersih.startsWith('0')) {
    nomorBersih = '62' + nomorBersih.slice(1);
  }
  return nomorBersih;
}

/**
 * Membangun tautan wa.me siap-klik dari nomor telepon mentah, opsional
 * dengan pesan pembuka yang sudah di-encode.
 */
export function tautanWhatsapp(nomor: string, pesan?: string): string {
  const nomorFormat = formatNomorWhatsapp(nomor);
  return pesan ? `https://wa.me/${nomorFormat}?text=${encodeURIComponent(pesan)}` : `https://wa.me/${nomorFormat}`;
}
