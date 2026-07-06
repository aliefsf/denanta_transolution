/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warnaUtama: '#1a1a2e',
        warnaSekunder: '#16213e',
        warnaAksen: '#0f3460',
        warnaTombol: '#e94560',
      },
    },
  },
  plugins: [],
}
