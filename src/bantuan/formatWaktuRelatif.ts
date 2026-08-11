/**
 * Memformat timestamp ISO menjadi teks waktu relatif berbahasa Indonesia.
 * Contoh: "15 menit yang lalu", "Kemarin", "3 hari yang lalu"
 */
export function formatWaktuRelatif(waktuIso: string): string {
  const waktu = new Date(waktuIso);
  if (Number.isNaN(waktu.getTime())) return '-';

  const selisihDetik = Math.floor((Date.now() - waktu.getTime()) / 1000);

  if (selisihDetik < 60) return 'Baru saja';
  if (selisihDetik < 3600) return `${Math.floor(selisihDetik / 60)} menit yang lalu`;
  if (selisihDetik < 86400) return `${Math.floor(selisihDetik / 3600)} jam yang lalu`;
  if (selisihDetik < 172800) return 'Kemarin';
  if (selisihDetik < 604800) return `${Math.floor(selisihDetik / 86400)} hari yang lalu`;

  return waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
