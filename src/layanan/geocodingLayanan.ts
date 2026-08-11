/**
 * Reverse geocoding (koordinat -> deskripsi alamat) lewat OpenStreetMap
 * Nominatim Public API -- gratis, tanpa API key, dipakai PemilihPeta.vue
 * supaya field Deskripsi Alamat terisi otomatis begitu pin point ditentukan
 * di semua fitur pin-maps (profil, alamat anak, perubahan jadwal, dst).
 *
 * Mengembalikan null bila permintaan gagal (offline, rate limit, dsb) supaya
 * pemanggil bisa jatuh kembali ke teks fallback berbasis koordinat.
 */
export async function ambilAlamatDariKoordinat(lintang: number, bujur: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lintang}&lon=${bujur}&addressdetails=0&accept-language=id`;
    const respons = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!respons.ok) return null;

    const data = await respons.json();
    return typeof data?.display_name === 'string' ? (data.display_name as string) : null;
  } catch {
    return null;
  }
}

export interface HasilPencarianLokasi {
  lintang: number;
  bujur: number;
  label: string;
}

/**
 * Forward geocoding (nama tempat/alamat -> daftar kandidat koordinat) lewat
 * Nominatim Public API -- dipakai kolom pencarian lokasi di PemilihPeta.vue
 * (mirip search box Google Maps) supaya pengguna bisa mengetik nama sekolah/
 * alamat lalu langsung memindahkan pin ke sana, tanpa harus mencari manual di
 * peta. Dibatasi (viewbox + bounded=1) ke wilayah operasional Kota Padang
 * (sama seperti apakahDalamKotaPadang() di PemilihPeta.vue) supaya hasil
 * yang muncul relevan dengan area layanan, bukan seluruh Indonesia.
 */
export async function cariLokasi(kueri: string): Promise<HasilPencarianLokasi[]> {
  const q = kueri.trim();
  if (!q) return [];

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}` +
      `&addressdetails=0&accept-language=id&countrycodes=id` +
      `&viewbox=100.25,-0.75,100.55,-1.15&bounded=1&limit=6`;
    const respons = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!respons.ok) return [];

    const data = await respons.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((d: any) => ({
        lintang: Number(d.lat),
        bujur: Number(d.lon),
        label: typeof d.display_name === 'string' ? d.display_name : `${d.lat}, ${d.lon}`
      }))
      .filter((d) => Number.isFinite(d.lintang) && Number.isFinite(d.bujur));
  } catch {
    return [];
  }
}
