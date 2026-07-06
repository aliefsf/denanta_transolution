<template>
  <footer class="bg-warnaUtama border-t border-warnaAksen/30 text-slate-400 py-8 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Brand Info -->
        <div>
          <span class="text-lg font-extrabold text-white tracking-wider flex items-center mb-3">
            Denanta<span class="text-warnaTombol">TS</span>
          </span>
          <p class="text-sm text-slate-400 leading-relaxed">
            Denanta TranSolution adalah platform integratif manajemen transportasi antar-jemput sekolah yang aman, tepercaya, dan terpantau secara real-time.
          </p>
        </div>

        <!-- Links -->
        <div>
          <h4 class="text-white font-bold text-sm uppercase tracking-wider mb-3">Tautan Cepat</h4>
          <ul class="space-y-2 text-sm">
            <li>
              <router-link to="/" class="hover:text-warnaTombol transition-colors duration-200">Halaman Utama</router-link>
            </li>
            <li>
              <router-link to="/orangtua" class="hover:text-warnaTombol transition-colors duration-200">Dashboard Orang Tua</router-link>
            </li>
            <li>
              <router-link to="/supir" class="hover:text-warnaTombol transition-colors duration-200">Dashboard Supir</router-link>
            </li>
            <li>
              <router-link to="/admin" class="hover:text-warnaTombol transition-colors duration-200">Admin Portal</router-link>
            </li>
          </ul>
        </div>

        <!-- Contact/Social -->
        <div>
          <h4 class="text-white font-bold text-sm uppercase tracking-wider mb-3">Kontak & Bantuan</h4>
          <p class="text-sm text-slate-400 leading-relaxed mb-1">
            Email: <span class="text-slate-300">hubungi@denantats.co.id</span>
          </p>
          <p class="text-sm text-slate-400 leading-relaxed">
            Telepon: <span class="text-slate-300">+62 812-3456-7890</span>
          </p>
          <div class="mt-4 flex gap-3">
            <span class="w-8 h-8 rounded-full bg-warnaSekunder hover:bg-warnaAksen flex items-center justify-center text-white transition-colors duration-200 cursor-pointer">
              f
            </span>
            <span class="w-8 h-8 rounded-full bg-warnaSekunder hover:bg-warnaAksen flex items-center justify-center text-white transition-colors duration-200 cursor-pointer">
              t
            </span>
            <span class="w-8 h-8 rounded-full bg-warnaSekunder hover:bg-warnaAksen flex items-center justify-center text-white transition-colors duration-200 cursor-pointer">
              ig
            </span>
          </div>
        </div>
      </div>

      <!-- Copyright -->
      <div class="border-t border-warnaAksen/20 mt-8 pt-6 text-center text-xs">
        <p>&copy; {{ new Date().getFullYear() }} Denanta TranSolution. Hak Cipta Dilindungi.</p>
      </div>
    </div>
  </footer>
</template>
