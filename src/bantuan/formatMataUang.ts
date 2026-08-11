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

/**
 * Membulatkan nominal ke kelipatan Rp100 terdekat (mis. Rp15.050 -> Rp15.100,
 * Rp15.040 -> Rp15.000, Rp15.260 -> Rp15.300) -- dipakai di SETIAP
 * perhitungan biaya tambahan berbasis jarak/tarif (perubahan jadwal, biaya
 * harian, potongan hari pendek langganan bulanan, dst.) supaya nominal akhir
 * yang tampil ke pengguna, dikirim ke pembayaran, dan dicetak di invoice/struk
 * selalu konsisten satu sama lain -- tidak ada lagi sisa satuan/puluhan ganjil
 * akibat perkalian desimal (mis. tarif per-km x jarak pecahan).
 */
export function bulatkanKeRatusan(nominal: number): number {
  return Math.round(nominal / 100) * 100;
}
