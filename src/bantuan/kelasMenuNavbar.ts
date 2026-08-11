/**
 * Kelas Tailwind utk item menu navbar publik (Beranda/Tentang Kami/dst di
 * HalamanUtama.vue & HalamanTentang.vue) -- dipusatkan di sini supaya efek
 * pill aktif & hover-scale-nya konsisten persis sama di kedua halaman,
 * bukan disalin manual per file (rawan devisiasi begitu salah satu diubah
 * tanpa mengubah yang lain). Padding disamakan di kedua state (aktif/tidak)
 * supaya ukuran antar item menu tidak "melompat" saat pindah halaman.
 */
export function kelasMenuNavbar(aktif: boolean): string {
  return aktif
    ? 'rounded-full bg-primary text-white font-semibold px-4 py-2 font-body-md text-body-md transition-all duration-200 cursor-pointer'
    : 'rounded-full text-on-surface-variant font-medium px-4 py-2 font-body-md text-body-md transition-all duration-200 ease-out cursor-pointer hover:text-primary hover:bg-primary-container/10 hover:scale-[1.08]';
}

/**
 * Varian block/full-width utk drawer menu mobile (hamburger) -- pill bulat
 * penuh tidak cocok utk daftar item selebar layar, jadi aktif ditandai
 * rounded-xl full-width + aksen kiri, dan skala hover dibuat lebih kecil
 * (1.02) supaya tidak "meluber" ke luar drawer yang sempit.
 */
export function kelasMenuNavbarMobile(aktif: boolean): string {
  return aktif
    ? 'block rounded-xl bg-primary text-white font-semibold py-2 px-3 border-l-4 border-primary transition-all duration-200 cursor-pointer'
    : 'block rounded-xl text-on-surface-variant font-medium py-2 px-3 border-l-4 border-transparent transition-all duration-200 ease-out cursor-pointer hover:text-primary hover:bg-primary-container/10 hover:scale-[1.02]';
}
