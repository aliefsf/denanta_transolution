# Denanta TranSolution — AGENTS.md

## Stack

Vue 3 (Composition API, `<script setup>`) · TypeScript ~6.0 · Vite 8 · Pinia · Vue Router 4 · Tailwind CSS 3 (custom dark theme) · Supabase (auth + DB + real-time) · Leaflet · Midtrans · Axios · Lucide Vue Next · `@vueuse/core`

## Language

All code, comments, variable names, UI text, and file/directory names are in **Indonesian (Bahasa)**. New code must follow the same convention.

## Directory structure (Indonesian naming)

| Directory | Purpose |
|---|---|
| `src/komponen/` | Vue components, grouped by role: `admin/`, `orangtua/`, `supir/`, `tamu/`, `umum/` |
| `src/halaman/` | Page-level views; `tataletak/` for layout wrappers |
| `src/rute/` | Vue Router config |
| `src/penyimpanan/` | Pinia stores |
| `src/komposabel/` | Vue composables |
| `src/layanan/` | API services (Supabase client etc.) |
| `src/tipe/` | TypeScript interfaces/types |
| `src/bantuan/` | Helper/utility functions |
| `src/aset/css/` | Global CSS (`gaya.css`) |

## Commands

```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # vue-tsc -b && vite build  (typecheck first, then build)
npm run preview  # vite preview
```

No test, lint, or format scripts are configured. The only verification step is `npm run build` which runs type-checking.

## Architecture notes

- **Entrypoint**: `src/main.ts` → creates Vue app, installs Pinia + Router, mounts `#app`
- **Router** (`src/rute/index.ts`): dynamic guards check `meta.autentikasi` and `meta.peran`; routes `/orangtua`, `/supir`, `/admin` are role-locked. Catch-all redirects to `/`.
- **Two auth paths**: `useAuth` composable (`src/komposabel/useAuth.ts`) wraps real Supabase Auth; `useAutentikasi` (`src/komposabel/useAutentikasi.ts`) is a mock auth using the main store. `authStore` (`src/penyimpanan/authStore.ts`) uses `useAuth` for production login flow.
- **Supabase client**: `src/layanan/supabase.ts` — reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env.
- **Database schema** in `skema_database.sql`: Supabase PostgreSQL with PostGIS. Tables: `pengguna`, `orang_tua`, `sekolah`, `anak`, `supir`, `langganan`, `perjalanan`, `log_status_perjalanan`, `pembayaran`, `penundaan_pembayaran`, `notifikasi`, `penilaian`. Includes RLS policies, triggers, and stored functions.

## Environment variables (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MIDTRANS_CLIENT_KEY=
VITE_MIDTRANS_SERVER_KEY=
VITE_WHATSAPP_API_KEY=
```

## Styling

Tailwind custom dark theme colors (defined in `tailwind.config.js`):
- `warnaUtama` (#1a1a2e) — dark bg
- `warnaSekunder` (#16213e) — card/panel bg
- `warnaAksen` (#0f3460) — borders, hover
- `warnaTombol` (#e94560) — primary buttons

Global dark theme base in `src/aset/css/gaya.css`. Font: Outfit (preferred), fallback Inter/system.

## Notable

- No monorepo — single package.
- No CI, no test suite, no linter/formatter config.
- VSCode extension recommended: `Vue.volar`.
- Build artifacts in `dist/` (gitignored).
