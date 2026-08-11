/**
 * Mengambil geometri rute jalan (bukan garis lurus) dari OSRM Public Demo
 * Server, dipakai untuk menggambar polyline navigasi di peta supir yang
 * mengikuti jalan sungguhan seperti Google Maps.
 *
 * `titik` diberikan dalam urutan [lintang, bujur] (sesuai konvensi Leaflet)
 * dan minimal 2 titik. Mengembalikan null bila permintaan gagal (mis. offline
 * atau server demo OSRM sedang tidak tersedia) supaya pemanggil bisa
 * jatuh kembali (fallback) ke garis lurus antar titik.
 */
export async function ambilRuteJalan(titik: [number, number][]): Promise<[number, number][] | null> {
  if (titik.length < 2) return null;

  try {
    const koordinatUrl = titik.map(([lintang, bujur]) => `${bujur},${lintang}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${koordinatUrl}?geometries=geojson&overview=full`;
    const respons = await fetch(url);
    if (!respons.ok) return null;

    const data = await respons.json();
    const koordinatGeoJson = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(koordinatGeoJson) || koordinatGeoJson.length < 2) return null;

    // GeoJSON memakai urutan [bujur, lintang] -- balik ke [lintang, bujur] untuk Leaflet
    return koordinatGeoJson.map(([bujur, lintang]: [number, number]) => [lintang, bujur] as [number, number]);
  } catch {
    return null;
  }
}

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
