/**
 * Menghasilkan URL Google Maps Navigation API
 */
export function dapatkanUrlGoogleMaps(lintang: number, bujur: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lintang},${bujur}`;
}

/**
 * Menghasilkan URL Waze Navigation API
 */
export function dapatkanUrlWaze(lintang: number, bujur: number): string {
  return `https://waze.com/ul?ll=${lintang},${bujur}&navigate=yes`;
}

/**
 * Membuka aplikasi navigasi eksternal (Google Maps / Waze) di tab browser baru
 */
export function bukaNavigasi(
  jenisLayanan: 'google' | 'waze',
  lintang: number,
  bujur: number
) {
  const url = jenisLayanan === 'google'
    ? dapatkanUrlGoogleMaps(lintang, bujur)
    : dapatkanUrlWaze(lintang, bujur);

  window.open(url, '_blank');
}
