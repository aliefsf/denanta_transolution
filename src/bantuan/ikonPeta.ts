// Sumber tunggal untuk markup ikon marker peta (Leaflet divIcon) -- dipakai
// BERSAMA oleh marker sungguhan di peta MAUPUN badge pada legend/keterangan,
// supaya keduanya otomatis identik (bentuk, warna, proporsi ikon) dan tidak
// mungkin tidak sinkron seperti sebelumnya (legend cuma lingkaran polos,
// marker peta pakai ikon). Kalau desain marker berubah, ubah di sini saja --
// legend ikut berubah otomatis karena memakai fungsi yang sama.

export const svgRumah =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

export const svgSekolah =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>';

export const svgBus =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';

/** Badge bulat berisi ikon SVG -- dipakai sebagai html marker `L.divIcon` maupun (versi diperkecil) sebagai badge legend. */
export function htmlLencanaIkon(svg: string, kelasBg: string, ukuranPx: number): string {
  return `<div class="rounded-full ${kelasBg} border-2 border-white flex items-center justify-center shadow-lg text-white" style="width:${ukuranPx}px;height:${ukuranPx}px">${svg}</div>`;
}

/** Badge bulat dengan efek denyut (ping) di belakangnya -- dipakai untuk marker posisi supir/armada yang aktif bergerak. */
export function htmlLencanaIkonBerdenyut(svg: string, kelasBg: string, kelasBgDenyut: string, ukuranPx: number): string {
  return `<div class="relative flex items-center justify-center" style="width:${ukuranPx}px;height:${ukuranPx}px"><span class="absolute inset-0 rounded-full ${kelasBgDenyut} opacity-40 animate-ping"></span><div class="relative rounded-full ${kelasBg} border-2 border-white flex items-center justify-center shadow-lg text-white" style="width:${ukuranPx}px;height:${ukuranPx}px">${svg}</div></div>`;
}

/** Badge bulat berisi teks/angka (mis. urutan jemput) -- dipakai untuk marker anak bernomor. */
export function htmlLencanaTeks(teks: string, kelasBg: string, ukuranPx: number): string {
  return `<div class="rounded-full ${kelasBg} border-2 border-white flex items-center justify-center shadow-md text-white font-extrabold" style="width:${ukuranPx}px;height:${ukuranPx}px;font-size:${Math.max(9, Math.round(ukuranPx * 0.36))}px">${teks}</div>`;
}
