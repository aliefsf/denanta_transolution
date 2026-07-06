/**
 * Memformat angka nominal menjadi mata uang Rupiah (IDR)
 * Contoh: 450000 menjadi Rp 450.000
 * 
 * @param nominal Angka nominal yang akan diformat
 * @returns string Hasil format mata uang Rupiah
 */
export function formatMataUang(nominal: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(nominal);
}
