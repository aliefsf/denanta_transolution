// Identitas warna PER SUPIR -- dipakai bersama oleh PetaGlobal.vue (marker &
// polyline di peta) dan PemantauanAdmin.vue (kartu "Status Armada" di
// sidebar) supaya warna yang ditampilkan di kartu SELALU sama persis dengan
// warna marker/jalur milik supir yang sama di peta (satu sumber kebenaran,
// bukan dihitung terpisah di 2 tempat yang bisa saja tidak sinkron).
//
// Warna ditetapkan SEKALI per supir.id begitu pertama kali terlihat (state
// module-level, singleton -- sama pola dengan useAuth.ts/useDataOrangTua.ts),
// lalu dipertahankan selama sesi berjalan -- tidak dihitung ulang dari
// index/posisi array tiap render, supaya tidak berubah/tertukar walau
// urutan daftar supir berubah (mis. sebagian offline lalu online lagi).
const PALET_WARNA_SUPIR = ['#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0d9488', '#ea580c', '#db2777', '#4f46e5'];
const warnaSupirMap: { [supirId: string]: string } = {};
let indeksWarnaBerikutnya = 0;

export function warnaUntukSupir(supirId: string): string {
  if (!warnaSupirMap[supirId]) {
    warnaSupirMap[supirId] = PALET_WARNA_SUPIR[indeksWarnaBerikutnya % PALET_WARNA_SUPIR.length];
    indeksWarnaBerikutnya++;
  }
  return warnaSupirMap[supirId];
}
