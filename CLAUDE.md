# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Denanta TranSolution — a school pickup/drop-off transport management SPA with four role-based dashboards (Admin, Orang Tua/parent, Supir/driver, Tamu/guest) and live GPS tracking via Supabase Realtime.

## Stack

Vue 3 (Composition API, `<script setup>`) · TypeScript ~6.0 · Vite 8 · Pinia · Vue Router 4 · Tailwind CSS 3 (dual palette, see Styling) · Supabase (auth + Postgres + RLS + real-time; PostGIS extension is enabled but unused — see Architecture notes) · Leaflet · Midtrans Snap (real Sandbox integration via Supabase Edge Functions, see Architecture notes) · Axios · Lucide Vue Next · `@vueuse/core`

## Language convention

All code, comments, variable names, UI text, and file/directory names are in **Indonesian (Bahasa)**. New code must follow the same convention.

## Commands

```bash
npm run dev      # Vite dev server (http://localhost:5173, auto-increments if busy)
npm run build    # vue-tsc -b && vite build  (typecheck first, then build)
npm run preview  # vite preview
```

No test, lint, or format scripts are configured. The only verification step is `npm run build`, which runs type-checking via `vue-tsc -b` before bundling — treat a clean build as the acceptance bar for any change. `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters: true`, so unused imports/vars fail the build, not just warn.

## Directory structure (Indonesian naming)

| Directory | Purpose |
|---|---|
| `src/komponen/` | Vue components, grouped by role: `admin/`, `orangtua/`, `supir/`, `tamu/`, `umum/` |
| `src/halaman/` | Page-level views; `tataletak/` for layout wrappers |
| `src/rute/` | Vue Router config + navigation guards |
| `src/penyimpanan/` | Pinia stores |
| `src/komposabel/` | Vue composables (including singleton/shared-state ones, see below) |
| `src/layanan/` | Data-access/service layer — one file per domain, wraps the Supabase client |
| `src/tipe/` | TypeScript interfaces/types, incl. DB row types (`*Row`) and UI view-models |
| `src/bantuan/` | Helper/utility functions (formatting, status-mapping, geofencing, timeouts) |
| `src/aset/css/` | Global CSS (`gaya.css`) |

## Architecture notes

- **Entrypoint**: `src/main.ts` — creates the Vue app inside a `try/catch`, installs Pinia + Router, mounts `#app`. A global `unhandledrejection` listener and `app.config.errorHandler` log errors; if `createApp`/`mount` itself throws, a fatal-error fallback screen renders instead of a silent blank page (with a "clear session & reload" button). Preserve this pattern when touching bootstrap code — don't let startup failures fail silently.
- **Router** (`src/rute/index.ts`): `beforeEach` guard runs session recovery (`authStore.periksaLogin()`) **once** per app load (guarded by a module-level flag, not per-navigation) and is wrapped in try/catch so a failure can't block navigation forever. Guard order for `/orangtua`: not logged in → `/login`; logged in as `orangtua` but no active subscription → `/berlangganan`; subscription active → dashboard allowed. `meta.autentikasi` + `meta.peran` gate `/orangtua`, `/supir`, `/admin` generically; `meta.hanyaTamu` redirects already-logged-in users away from guest-only pages. Catch-all redirects to `/`.
- **Auth bootstrap must be timeout-guarded**: any Supabase Auth call made during app bootstrap (`authStore.periksaLogin`, `ambilPeranPengguna`, `periksaStatusBerlangganan`) is wrapped in `denganBatasWaktu()` (`src/bantuan/batasWaktu.ts`). A stale/invalid session token in `localStorage` can otherwise make `supabase.auth.getUser()`/token-refresh hang indefinitely, which blocks the router guard and renders a permanently blank screen. Apply the same wrapper to any new blocking call added to the bootstrap path.
- **Two auth paths — don't conflate them**: `useAuth` (`src/komposabel/useAuth.ts`) wraps real Supabase Auth and is the production path, consumed by `authStore`. `useAutentikasi` (`src/komposabel/useAutentikasi.ts`) is a legacy mock auth using the main Pinia store directly. Check which one a component actually imports before editing auth logic.
- **Subscription-gated dashboard flow**: after login, a parent account only reaches `/orangtua` if it has an active subscription — defined as: at least one `anak` row owned by the account has a `langganan` row with `sudah_dibayar = true` and `tanggal_berakhir >= today` (`authStore.periksaStatusBerlangganan`). Otherwise the router sends them to `/berlangganan`, a 4-stage wizard (`HalamanBerlangganan.vue`: Data Pengguna → Data Anak → Jenis Layanan/Langganan → Pembayaran). The wizard is resumable: `ambilStatusLanggananWizard()` (`src/layanan/berlangganganLayanan.ts`) classifies the account into `belum_ada_anak` / `belum_bayar` / `aktif` on mount and jumps to the matching step. Writes to `anak`/`langganan`/`pembayaran` in that service layer are idempotent upserts (keyed on "latest unpaid row per anak") so retrying a step never creates duplicate rows.
- **Midtrans payment IS real (via Supabase Edge Functions)** — this note previously said the project had no real payment backend and simulated confirmation client-side; that's outdated. `supabase/functions/buat-transaksi-midtrans/` holds `MIDTRANS_SERVER_KEY` server-side and requests a real Snap token; `supabase/functions/midtrans-webhook/` is a public endpoint Midtrans calls server-to-server, validated via SHA-512 signature (`order_id+status_code+gross_amount+ServerKey`) before updating `pembayaran.status`. Client-side `konfirmasiPembayaranLunas`-style code, if still present, is a legacy/demo fallback — the webhook is the authoritative source of "lunas". Still Sandbox-mode Midtrans API keys, not Production keys. `rekonsiliasiLayanan.ts` retains an older `Math.random()`-based demo path — treat that as a separate fallback module, not the main flow.
- **Other Supabase Edge Functions**: `buat-akun-supir/` (admin creates a driver account), `sinkron-hari-libur/`.
- **Data-access layer pattern**: `src/layanan/*Layanan.ts` files are the only place that should call the Supabase client directly for a given domain (e.g. `orangTuaLayanan.ts`, `berlangganganLayanan.ts`). Each starts with a `klienWajibAda()` guard that throws if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are unset, and functions `throw` on Supabase errors rather than swallowing them — callers (composables/components) are responsible for try/catch + user-facing error state.
- **Singleton composable pattern**: `useAuth.ts` and `useDataOrangTua.ts` hold their reactive state at **module scope** (not inside the exported function), so every component instance calling `useAuth()`/`useDataOrangTua()` shares the same data instead of re-fetching per component/tab. Follow this pattern for any new composable that caches server data across multiple dashboard tabs; a plain per-call `ref()` would cause redundant fetches and state desync between tabs.
- **Geofencing**: parent-submitted pickup/drop-off pins must fall inside Kota Padang, checked via a bounding-box (`lat` between -1.15/-0.75, `lng` between 100.25/100.55). Duplicated in `src/komponen/umum/PemilihPeta.vue` and `HalamanBerlangganan.vue` — keep both in sync if the boundary changes.
- **Status vocabulary bridging**: DB `perjalanan.status` enum (`dijadwalkan|penjemputan|menuju_sekolah|di_sekolah|pengantaran|tiba|dibatalkan`) is mapped to a simpler UI vocabulary (`berangkat|sekolah|pulang|rumah|absen`) via `mapStatusPerjalananKeUI()` in `src/bantuan/statusPerjalanan.ts` — don't compare against DB enum values directly in components.
- **Database schema** in `skema_database.sql`: Supabase PostgreSQL. `CREATE EXTENSION postgis` is present but **unused** — no `geometry`/`geography` columns or `ST_*` calls anywhere in the schema; all coordinates are plain `double precision` and distance is computed by a hand-written Haversine function (`hitung_jarak()`). Core tables: `pengguna`, `orang_tua`, `sekolah`, `anak`, `supir`, `langganan`, `perjalanan`, `log_status_perjalanan`, `pembayaran`, `penundaan_pembayaran`, `notifikasi`, `penilaian`, plus `jadwal_mingguan`/`pengajuan_absen`/`pengajuan_cuti`/`pengajuan_perubahan_jadwal` for the weekly-schedule feature. New user rows in `pengguna`/`orang_tua`/`supir` are auto-populated by the `trg_pengguna_baru` trigger on `auth.users` insert — **never** duplicate this with a manual client-side insert after `signUp()`, that causes an RLS violation.
- **RLS conventions**: every table has RLS enabled; write policies for parent-owned data follow the pattern `EXISTS (SELECT 1 FROM anak WHERE anak.id = <table>.anak_id AND anak.orang_tua_id = auth.uid())` for tables one hop from `anak`, or a direct `orang_tua_id = auth.uid()` check where the FK is direct. `dapatkan_peran_pengguna(auth.uid())` is a `SECURITY DEFINER` helper used in cross-role policies. Changes to `skema_database.sql` are **not** auto-applied — they must be run manually in the Supabase SQL editor; there is no migration tooling or CLI access configured in this environment.
- **Third-party integrations**: Midtrans Snap (real, see above), Supabase Realtime (`realtimeLayanan.ts` — live GPS/status subscriptions, e.g. `pantauSupirRealtime`), OSRM (`navigasiLayanan.ts` — real routing fetch to `router.project-osrm.org`) plus Google Maps deep links (Waze deep-link code exists but is unused/dead — no component calls it), Nominatim/OpenStreetMap (`geocodingLayanan.ts` — real geocoding fetch), and a payment reconciliation flow (`rekonsiliasiLayanan.ts`) tying Midtrans callbacks back to `pembayaran`/`penundaan_pembayaran`. `whatsappLayanan.ts` (Fonnte WhatsApp API) exists but is **dead code** — not imported anywhere in `src/`.

## Environment variables (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MIDTRANS_CLIENT_KEY=
VITE_MIDTRANS_SERVER_KEY=
VITE_WHATSAPP_API_KEY=
```

## Styling

Tailwind config (`tailwind.config.js`) mixes **two unrelated palettes** — check which one a component already uses before adding classes:
- Legacy dark theme: `warnaUtama` (#1a1a2e, dark bg), `warnaSekunder` (#16213e, card/panel bg), `warnaAksen` (#0f3460, borders/hover), `warnaTombol` (#e94560, primary buttons).
- Newer Material 3-style light palette (guest/landing pages, subscription wizard): `primary`/`primary-container`, `surface`/`surface-container-*`, `on-surface`/`on-surface-variant`, `outline`/`outline-variant`, `error`/`error-container`, etc.

Global dark theme base in `src/aset/css/gaya.css`. Fonts are mapped to `Inter` via custom `fontFamily`/`fontSize` keys (`headline-lg`, `title-lg`, `body-md`, etc.) rather than plain Tailwind size utilities — use those keys for new UI text to stay consistent with existing pages.

## Notable

- No monorepo — single package.
- No CI, no test suite, no linter/formatter config.
- No browser-automation and no Supabase CLI/deploy access are available in this environment — SQL schema changes and live manual testing must be handed off to the user.
- Build artifacts in `dist/` (gitignored).
