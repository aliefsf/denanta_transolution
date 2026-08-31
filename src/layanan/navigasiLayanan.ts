import { hitungJarakKm } from '../bantuan/jarak';

export interface RuteLengkap {
  koordinat: [number, number][];
  jarakKm: number;
  durasiMenit: number;
  // false berarti OSRM gagal dihubungi & hasil di atas adalah fallback
  // garis lurus + kecepatan rata-rata -- dipakai pemanggil yang perlu
  // menampilkan indikator "rute mengikuti jalan" vs "perkiraan garis lurus".
  ikutiJalan: boolean;
}

/**
 * Kecepatan rata-rata kendaraan di dalam kota, dipakai sebagai FALLBACK
 * perhitungan estimasi waktu (Jarak / Kecepatan) kalau OSRM tidak bisa
 * dihubungi (offline / server demo down) sehingga durasi asli dari rute
 * tidak tersedia. 35 km/jam -- titik tengah rentang wajar 30-40 km/jam
 * untuk lalu lintas dalam kota.
 */
const KECEPATAN_RATA_RATA_KMJAM = 35;

/**
 * Estimasi waktu tempuh (menit) dari jarak lurus (Haversine, BUKAN jarak
 * jalan) -- dipakai hanya sebagai fallback terakhir kalau OSRM benar-benar
 * tidak bisa dihubungi sama sekali (lihat ambilRuteLengkap). Dibulatkan ke
 * atas dan minimal 1 menit supaya tidak pernah menampilkan "0 menit" untuk
 * jarak yang sangat dekat.
 */
export function estimasiMenitDariJarak(jarakKm: number, kecepatanKmJam: number = KECEPATAN_RATA_RATA_KMJAM): number {
  if (jarakKm <= 0) return 0;
  return Math.max(1, Math.round((jarakKm / kecepatanKmJam) * 60));
}

/**
 * Mengambil geometri RUTE JALAN sekaligus JARAK & DURASI dari OSRM Public
 * Demo Server dalam SATU kali permintaan -- `duration` yang dikembalikan
 * OSRM sudah memperhitungkan panjang rute jalan sungguhan (bukan cuma
 * jarak lurus), jadi ini sumber estimasi waktu yang PALING akurat. Kalau
 * OSRM gagal dihubungi, `durasiMenit` dihitung dari jarak lurus (Haversine)
 * dibagi kecepatan rata-rata kota (lihat estimasiMenitDariJarak) supaya
 * pemanggil tetap dapat estimasi yang masuk akal, bukan angka tetap.
 *
 * `titik` diberikan dalam urutan [lintang, bujur] (sesuai konvensi Leaflet)
 * dan minimal 2 titik. Mengembalikan null hanya kalau titik kurang dari 2.
 */
export async function ambilRuteLengkap(titik: [number, number][]): Promise<RuteLengkap | null> {
  if (titik.length < 2) return null;

  const jarakLurusTotalKm = titik.slice(1).reduce(
    (total, [lat, lng], i) => total + hitungJarakKm(titik[i][0], titik[i][1], lat, lng),
    0
  );

  try {
    const koordinatUrl = titik.map(([lintang, bujur]) => `${bujur},${lintang}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${koordinatUrl}?geometries=geojson&overview=full`;
    const respons = await fetch(url);
    if (!respons.ok) throw new Error('OSRM tidak merespons');

    const data = await respons.json();
    const rute = data?.routes?.[0];
    const koordinatGeoJson = rute?.geometry?.coordinates;
    if (!Array.isArray(koordinatGeoJson) || koordinatGeoJson.length < 2) throw new Error('Geometri rute tidak valid');

    // GeoJSON memakai urutan [bujur, lintang] -- balik ke [lintang, bujur] untuk Leaflet
    const koordinat = koordinatGeoJson.map(([bujur, lintang]: [number, number]) => [lintang, bujur] as [number, number]);

    // rute.distance dalam meter, rute.duration dalam detik (spesifikasi OSRM) --
    // dipakai langsung sebagai sumber kebenaran karena sudah menghitung
    // jarak jalan sungguhan, bukan garis lurus.
    const jarakKm = typeof rute.distance === 'number' ? rute.distance / 1000 : jarakLurusTotalKm;
    const durasiMenit = typeof rute.duration === 'number'
      ? Math.max(1, Math.round(rute.duration / 60))
      : estimasiMenitDariJarak(jarakKm);

    return { koordinat, jarakKm, durasiMenit, ikutiJalan: true };
  } catch {
    // OSRM gagal -- fallback SEPENUHNYA ke garis lurus + kecepatan rata-rata,
    // BUKAN angka tetap, supaya estimasi tetap naik-turun mengikuti jarak.
    return {
      koordinat: titik,
      jarakKm: jarakLurusTotalKm,
      durasiMenit: estimasiMenitDariJarak(jarakLurusTotalKm),
      ikutiJalan: false
    };
  }
}

/**
 * Mengambil geometri rute jalan (bukan garis lurus) dari OSRM -- versi
 * ringkas dari ambilRuteLengkap() untuk pemanggil yang cuma butuh polyline-nya
 * saja (menggambar peta) tanpa perlu jarak/durasi. Mengembalikan null bila
 * OSRM gagal dihubungi sama sekali, supaya pemanggil jatuh kembali ke garis
 * lurus sendiri (perilaku lama tetap dipertahankan persis untuk pemanggil ini).
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
